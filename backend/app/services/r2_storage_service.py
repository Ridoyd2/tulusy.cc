import hashlib
import hmac
import math
import mimetypes
import re
import secrets
import shutil
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import (
    BASE_DIR,
    BLOCKED_HOSTING_EXTENSIONS,
    DEFAULT_HOSTING_EXPIRY_DAYS,
    FOREVER_INACTIVITY_DAYS,
    FOREVER_INACTIVITY_SECONDS,
    HOSTING_DIR,
    MAX_HOSTING_FILE_SIZE,
    R2_ACCESS_KEY_ID,
    R2_ACCOUNT_ID,
    R2_BUCKET_NAME,
    R2_SECRET_ACCESS_KEY,
)

DB_PATH = BASE_DIR / "data" / "file_host.db"
LEGACY_PASSWORD_SALT = "tulusy_anon_salt_2026"
BURN_PURGE_GRACE_SECONDS = 1800  # Matches presigned GET URL ExpiresIn (30 minutes)
MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024  # 64 MB
SINGLE_PUT_MAX_BYTES = 4_800_000_000  # Keep safe margin below R2 5,000,000,000-byte single PUT limit
_MIME_RE = re.compile(r"^[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+$")

EXPIRY_MODE_FIXED = "fixed"
EXPIRY_MODE_FOREVER = "forever_idle_7d"  # Hosted while active; purged after 7 days without views/downloads
VALID_EXPIRY_MODES = (EXPIRY_MODE_FIXED, EXPIRY_MODE_FOREVER)


@contextmanager
def get_db():
    """Provides a managed sqlite3 connection with WAL concurrency safety."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA busy_timeout=15000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initializes SQLite database tables, indexes, and idempotent schema migrations."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            with get_db() as conn:
                conn.execute("PRAGMA journal_mode=WAL")
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS hosted_files (
                        id TEXT PRIMARY KEY,
                        original_name TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        content_type TEXT NOT NULL,
                        storage_type TEXT NOT NULL,
                        storage_key TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        expires_at INTEGER NOT NULL,
                        delete_token TEXT NOT NULL,
                        downloads_count INTEGER DEFAULT 0,
                        max_downloads INTEGER DEFAULT 0,
                        password_hash TEXT DEFAULT '',
                        is_deleted INTEGER DEFAULT 0,
                        purge_after INTEGER DEFAULT 0,
                        upload_confirmed INTEGER DEFAULT 1,
                        multipart_upload_id TEXT DEFAULT '',
                        expiry_mode TEXT DEFAULT 'fixed',
                        views_count INTEGER DEFAULT 0,
                        last_viewed_at INTEGER DEFAULT 0
                    )
                """)

                existing_cols = {
                    row[1] for row in cursor.execute("PRAGMA table_info(hosted_files)").fetchall()
                }
                if "purge_after" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN purge_after INTEGER DEFAULT 0")
                if "upload_confirmed" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN upload_confirmed INTEGER DEFAULT 1")
                if "multipart_upload_id" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN multipart_upload_id TEXT DEFAULT ''")
                if "expiry_mode" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN expiry_mode TEXT DEFAULT 'fixed'")
                if "views_count" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN views_count INTEGER DEFAULT 0")
                if "last_viewed_at" not in existing_cols:
                    cursor.execute("ALTER TABLE hosted_files ADD COLUMN last_viewed_at INTEGER DEFAULT 0")

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS file_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_id TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS download_tokens (
                        token TEXT PRIMARY KEY,
                        file_id TEXT NOT NULL,
                        expires_at INTEGER NOT NULL
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS maintenance_state (
                        key TEXT PRIMARY KEY,
                        updated_at INTEGER NOT NULL
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_expires_at ON hosted_files(expires_at)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_is_deleted ON hosted_files(is_deleted)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_purge_after ON hosted_files(purge_after)")
            return
        except sqlite3.OperationalError:
            if attempt == 4:
                raise
            time.sleep(0.1 * (attempt + 1))


init_db()


def get_r2_client():
    """Returns a boto3 S3 client configured for Cloudflare R2 if credentials are set, else None."""
    if not (R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME):
        return None
    if R2_ACCOUNT_ID == "your_cloudflare_account_id_here":
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


_WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def sanitize_filename(filename: str) -> str:
    """Strips directory components, control chars, trailing dots, and Windows reserved device names."""
    clean = (filename or "").replace("\\", "/").split("/")[-1].strip()
    clean = "".join(c for c in clean if ord(c) >= 32 and c not in '<>:"|?*')
    clean = clean.strip(" .")
    if not clean or clean in (".", ".."):
        return "unnamed_file"
    base_part = clean.split(".", 1)[0].upper()
    if base_part in _WINDOWS_RESERVED_NAMES:
        clean = f"_{clean}"
    return clean


def is_extension_allowed(filename: str) -> bool:
    """Verifies normalized filename is safe and not an executable / malicious payload."""
    normalized = sanitize_filename(filename)
    ext = normalized.rsplit(".", 1)[-1].lower() if "." in normalized else ""
    return ext not in BLOCKED_HOSTING_EXTENSIONS


def generate_file_id() -> str:
    """Generates a clean, short, URL-safe alphanumeric file ID (8 chars)."""
    alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def hash_password(password: str) -> str:
    """Hashes a file access password using salted scrypt."""
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies password against salted scrypt (or legacy SHA-256) in constant time."""
    if not stored_hash:
        return True
    if stored_hash.startswith("scrypt$"):
        parts = stored_hash.split("$", 2)
        if len(parts) != 3:
            return False
        try:
            salt = bytes.fromhex(parts[1])
            expected = bytes.fromhex(parts[2])
        except ValueError:
            return False
        derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=len(expected))
        return hmac.compare_digest(derived, expected)

    legacy = hashlib.sha256(f"{LEGACY_PASSWORD_SALT}_{password}".encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def _build_content_disposition(filename: str) -> str:
    ascii_name = "".join(c if 32 <= ord(c) < 127 and c not in '"\\' else "_" for c in filename) or "download"
    encoded_name = quote(filename)
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"


def sanitize_content_type(content_type: Optional[str], safe_name: str) -> str:
    """Validates and normalizes a Content-Type header value, preventing header injection."""
    if content_type:
        base_type = content_type.split(";", 1)[0].strip().lower()
        if len(base_type) <= 128 and _MIME_RE.fullmatch(base_type):
            return base_type
    guessed_type, _ = mimetypes.guess_type(safe_name)
    return guessed_type or "application/octet-stream"


def _allocate_unique_file_id() -> str:
    """Generates a unique file ID that does not collide with existing rows."""
    with get_db() as conn:
        for _ in range(10):
            candidate = generate_file_id()
            exists = conn.execute("SELECT 1 FROM hosted_files WHERE id = ?", (candidate,)).fetchone()
            if not exists:
                return candidate
    raise RuntimeError("Could not allocate unique file ID.")


def create_upload_session(
    filename: str,
    file_size: int,
    content_type: Optional[str] = None,
    expiry_days: int = DEFAULT_HOSTING_EXPIRY_DAYS,
    expiry_hours: Optional[int] = None,
    max_downloads: int = 0,
    password: Optional[str] = None,
    auto_confirm: bool = True,
    use_multipart: bool = False,
    expiry_mode: str = EXPIRY_MODE_FIXED,
) -> Dict[str, Any]:
    """
    Creates an anonymous upload session.
    Returns presigned PUT / Multipart URLs for Cloudflare R2 (or fallback direct local route).
    expiry_mode="forever_idle_7d" keeps the file hosted while active and purges it after
    FOREVER_INACTIVITY_DAYS without any browser view or download.
    """
    safe_name = sanitize_filename(filename)

    if file_size <= 0:
        raise ValueError("File cannot be empty (0 bytes).")

    if file_size > MAX_HOSTING_FILE_SIZE:
        raise ValueError(f"File size exceeds maximum allowed 5GB limit ({file_size} bytes).")

    if not is_extension_allowed(safe_name):
        raise ValueError("Executable files are restricted for security.")

    mode = (expiry_mode or EXPIRY_MODE_FIXED).strip().lower()
    if mode not in VALID_EXPIRY_MODES:
        raise ValueError("Invalid expiry mode.")
    if mode == EXPIRY_MODE_FOREVER and max_downloads > 0:
        raise ValueError("Download-limited or burn-on-read files cannot use forever retention.")

    file_id = _allocate_unique_file_id()
    delete_token = secrets.token_hex(16)
    created_at = int(time.time())

    if mode == EXPIRY_MODE_FOREVER:
        expiry_days = FOREVER_INACTIVITY_DAYS
        expires_at = created_at + FOREVER_INACTIVITY_SECONDS
    elif expiry_hours is not None and expiry_hours > 0:
        capped_hours = max(1, min(168, expiry_hours))
        expires_at = created_at + (capped_hours * 3600)
        expiry_days = max(1, round(capped_hours / 24))
    else:
        expiry_days = max(1, min(7, expiry_days))
        expires_at = created_at + (expiry_days * 86400)

    final_content_type = sanitize_content_type(content_type, safe_name)

    password_hash = hash_password(password.strip()) if password and password.strip() else ""

    r2_client = get_r2_client()
    storage_type = "r2" if r2_client else "local"
    storage_key = f"files/{file_id}/{safe_name}"

    upload_url = f"/api/hosting/upload-direct/{file_id}"
    upload_mode = "single"
    multipart_upload_id = ""
    multipart_data: Dict[str, Any] = {}

    if storage_type == "r2":
        should_multipart = (use_multipart and file_size > MULTIPART_THRESHOLD_BYTES) or file_size > SINGLE_PUT_MAX_BYTES
        if should_multipart:
            # Target 32 MB chunks while guaranteeing <= 5000 parts for up to 5 GB files
            part_size = max(32 * 1024 * 1024, math.ceil(file_size / 5000))
            part_count = max(1, math.ceil(file_size / part_size))
            mpu = r2_client.create_multipart_upload(
                Bucket=R2_BUCKET_NAME,
                Key=storage_key,
                ContentType=final_content_type,
            )
            upload_id = mpu["UploadId"]
            multipart_upload_id = upload_id
            part_urls: List[Dict[str, Any]] = []
            for part_num in range(1, part_count + 1):
                part_url = r2_client.generate_presigned_url(
                    "upload_part",
                    Params={
                        "Bucket": R2_BUCKET_NAME,
                        "Key": storage_key,
                        "UploadId": upload_id,
                        "PartNumber": part_num,
                    },
                    ExpiresIn=7200,
                )
                part_urls.append({"part_number": part_num, "upload_url": part_url})
            upload_mode = "multipart"
            upload_url = ""
            multipart_data = {
                "upload_id": upload_id,
                "part_size": part_size,
                "parts": part_urls,
            }
        else:
            upload_url = r2_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": R2_BUCKET_NAME,
                    "Key": storage_key,
                    "ContentType": final_content_type,
                },
                ExpiresIn=3600,
            )

    confirmed_flag = 1 if auto_confirm else 0

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO hosted_files (
                    id, original_name, file_size, content_type, storage_type,
                    storage_key, created_at, expires_at, delete_token,
                    downloads_count, max_downloads, password_hash, is_deleted,
                    purge_after, upload_confirmed, multipart_upload_id,
                    expiry_mode, views_count, last_viewed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?, ?, ?, 0, ?)
                """,
                (
                    file_id,
                    safe_name,
                    file_size,
                    final_content_type,
                    storage_type,
                    storage_key,
                    created_at,
                    expires_at,
                    delete_token,
                    max_downloads,
                    password_hash,
                    confirmed_flag,
                    multipart_upload_id,
                    mode,
                    created_at,
                ),
            )
    except Exception:
        if storage_type == "r2" and multipart_upload_id and r2_client:
            try:
                r2_client.abort_multipart_upload(
                    Bucket=R2_BUCKET_NAME,
                    Key=storage_key,
                    UploadId=multipart_upload_id,
                )
            except Exception:
                pass
        raise

    return {
        "file_id": file_id,
        "filename": safe_name,
        "file_size": file_size,
        "content_type": final_content_type,
        "upload_url": upload_url,
        "upload_mode": upload_mode,
        "storage_type": storage_type,
        "expires_at": expires_at,
        "delete_token": delete_token,
        "expiry_days": expiry_days,
        "expiry_mode": mode,
        "is_forever": mode == EXPIRY_MODE_FOREVER,
        **multipart_data,
    }


def complete_multipart_session(file_id: str, upload_id: str, parts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Finalizes a multipart upload in Cloudflare R2 atomically and verifies uploaded size."""
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0",
            (file_id,),
        ).fetchone()
        if not row:
            raise ValueError("Upload session not found or expired.")
        if row["storage_type"] != "r2":
            raise ValueError("Multipart upload is only valid for R2 storage sessions.")
        if row["upload_confirmed"] != 0:
            raise ValueError("Upload session is already confirmed or in progress.")
        if row["expires_at"] <= now:
            cursor.execute("UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?", (now, file_id))
            conn.commit()
            raise ValueError("Upload session has expired.")
        expected_upload_id = row["multipart_upload_id"] or ""
        if not expected_upload_id or not hmac.compare_digest(expected_upload_id, upload_id.strip()):
            raise ValueError("Invalid multipart upload ID for this session.")
        cursor.execute(
            "UPDATE hosted_files SET upload_confirmed = -1 WHERE id = ? AND upload_confirmed = 0 AND is_deleted = 0",
            (file_id,),
        )
        if cursor.rowcount == 0:
            raise ValueError("Upload session is already confirmed or in progress.")
        storage_key = row["storage_key"]

    r2_client = get_r2_client()
    if not r2_client:
        with get_db() as conn:
            conn.execute(
                "UPDATE hosted_files SET upload_confirmed = 0 WHERE id = ? AND upload_confirmed = -1 AND is_deleted = 0",
                (file_id,),
            )
        raise RuntimeError("Cloudflare R2 is not configured.")

    sorted_parts = sorted(
        [{"PartNumber": int(p["PartNumber"]), "ETag": str(p["ETag"])} for p in parts],
        key=lambda p: p["PartNumber"],
    )
    try:
        r2_client.complete_multipart_upload(
            Bucket=R2_BUCKET_NAME,
            Key=storage_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": sorted_parts},
        )
    except ClientError as ce:
        with get_db() as conn:
            conn.execute(
                "UPDATE hosted_files SET upload_confirmed = 0 WHERE id = ? AND upload_confirmed = -1 AND is_deleted = 0",
                (file_id,),
            )
        raise ValueError(f"Failed to finalize multipart upload in R2 storage: {ce}")
    except Exception:
        with get_db() as conn:
            conn.execute(
                "UPDATE hosted_files SET upload_confirmed = 0 WHERE id = ? AND upload_confirmed = -1 AND is_deleted = 0",
                (file_id,),
            )
        raise

    try:
        return confirm_upload_session(file_id, allow_in_progress=True)
    except Exception:
        with get_db() as conn:
            conn.execute(
                "UPDATE hosted_files SET upload_confirmed = 0 WHERE id = ? AND upload_confirmed = -1 AND is_deleted = 0",
                (file_id,),
            )
        raise


def abort_multipart_session(file_id: str, upload_id: str) -> None:
    """Aborts an unconfirmed R2 multipart upload only when upload_id matches the pending session."""
    storage_key: Optional[str] = None
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT storage_type, storage_key, upload_confirmed, is_deleted, multipart_upload_id FROM hosted_files WHERE id = ?",
            (file_id,),
        ).fetchone()
        if not row or row["is_deleted"] != 0:
            return
        if row["upload_confirmed"] != 0:
            raise PermissionError("Cannot abort an already confirmed upload session.")
        if row["storage_type"] != "r2":
            raise ValueError("Multipart abort is only valid for R2 sessions.")
        expected_upload_id = row["multipart_upload_id"] or ""
        if not expected_upload_id or not hmac.compare_digest(expected_upload_id, upload_id.strip()):
            raise PermissionError("Invalid multipart upload ID.")
        storage_key = row["storage_key"]
        conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))

    if storage_key:
        r2_client = get_r2_client()
        if r2_client:
            try:
                r2_client.abort_multipart_upload(
                    Bucket=R2_BUCKET_NAME,
                    Key=storage_key,
                    UploadId=upload_id,
                )
            except Exception:
                pass


def confirm_upload_session(file_id: str, allow_in_progress: bool = False) -> Dict[str, Any]:
    """Verifies that uploaded bytes actually exist in R2/local storage before activating the share link."""
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0",
            (file_id,),
        ).fetchone()
        if not row:
            raise ValueError("File session expired or invalid.")
        if row["expires_at"] <= now:
            cursor.execute("UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?", (now, file_id))
            conn.commit()
            raise ValueError("File session expired.")
        if row["upload_confirmed"] == -1 and not allow_in_progress:
            raise ValueError("Upload is still in progress.")
        storage_type = row["storage_type"]
        storage_key = row["storage_key"]
        original_name = row["original_name"]

    actual_size: int
    if storage_type == "r2":
        r2_client = get_r2_client()
        if not r2_client:
            raise RuntimeError("Cloudflare R2 is currently unreachable.")
        try:
            head = r2_client.head_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
            actual_size = int(head.get("ContentLength", 0))
        except ClientError:
            raise ValueError("Uploaded file was not found in R2 storage.")
        if actual_size <= 0 or actual_size > MAX_HOSTING_FILE_SIZE:
            try:
                r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
            except Exception:
                pass
            with get_db() as conn:
                conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))
            raise ValueError("Uploaded file size is invalid or exceeds 5GB limit.")
    else:
        local_path = HOSTING_DIR / file_id / original_name
        if not local_path.is_file():
            raise ValueError("Uploaded file was not found on server storage.")
        actual_size = local_path.stat().st_size
        if actual_size <= 0 or actual_size > MAX_HOSTING_FILE_SIZE:
            shutil.rmtree(HOSTING_DIR / file_id, ignore_errors=True)
            with get_db() as conn:
                conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))
            raise ValueError("Uploaded file size is invalid or exceeds 5GB limit.")

    # Forever shares get a fresh 7-day idle window once the upload actually completes (slow multi-GB
    # uploads must not lose idle time). Already-confirmed rows are never refreshed by re-confirming.
    confirm_now = int(time.time())
    status_clause = "(upload_confirmed >= 0 OR upload_confirmed = -1)" if allow_in_progress else "upload_confirmed >= 0"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            UPDATE hosted_files
            SET upload_confirmed = 1,
                file_size = ?,
                last_viewed_at = CASE
                    WHEN expiry_mode = ? AND upload_confirmed != 1 THEN ? ELSE last_viewed_at END,
                expires_at = CASE
                    WHEN expiry_mode = ? AND upload_confirmed != 1 THEN MAX(expires_at, ?) ELSE expires_at END
            WHERE id = ? AND is_deleted = 0 AND {status_clause} AND expires_at > ?
            """,
            (
                actual_size,
                EXPIRY_MODE_FOREVER,
                confirm_now,
                EXPIRY_MODE_FOREVER,
                confirm_now + FOREVER_INACTIVITY_SECONDS,
                file_id,
                confirm_now,
            ),
        )
        if cursor.rowcount == 0:
            raise ValueError("File session expired or invalid.")

    meta = get_file_metadata(file_id)
    if not meta:
        raise ValueError("File session could not be confirmed.")
    return meta


def _row_expiry_mode(row: sqlite3.Row) -> str:
    try:
        mode = row["expiry_mode"]
    except (IndexError, KeyError):
        mode = None
    return mode if mode in VALID_EXPIRY_MODES else EXPIRY_MODE_FIXED


def _build_public_metadata(row: sqlite3.Row, now: int) -> Dict[str, Any]:
    """Shapes a hosted_files row into the public download-page metadata payload."""
    mode = _row_expiry_mode(row)
    expires_at = int(row["expires_at"])
    return {
        "file_id": row["id"],
        "filename": row["original_name"],
        "file_size": row["file_size"],
        "content_type": row["content_type"],
        "created_at": row["created_at"],
        "expires_at": expires_at,
        "downloads_count": row["downloads_count"],
        "views_count": row["views_count"] or 0,
        "last_viewed_at": row["last_viewed_at"] or row["created_at"],
        "expiry_mode": mode,
        "is_forever": mode == EXPIRY_MODE_FOREVER,
        "requires_password": bool(row["password_hash"]),
        "is_burn_after_reading": row["max_downloads"] == 1,
        "seconds_remaining": max(0, expires_at - now),
    }


def get_file_metadata(file_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves public metadata for confirmed, non-expired hosted files (read-only: never counts views)."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0 AND upload_confirmed = 1",
            (file_id,),
        ).fetchone()
        if not row:
            return None

        now = int(time.time())
        if row["expires_at"] <= now:
            cursor.execute(
                "UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?",
                (now, file_id),
            )
            return None

        return _build_public_metadata(row, now)


# Link-preview unfurlers, crawlers, uptime monitors, headless browsers, and CLI/HTTP libraries.
# These must never count as views or keep an otherwise idle "forever" share alive.
_AUTOMATED_UA_RE = re.compile(
    r"((?<!cu)bot|crawler|spider|slurp|archiver|scraper|preview|unfurl|headless|lighthouse|"
    r"phantomjs|playwright|puppeteer|selenium|discord|whatsapp|telegram|slack|"
    r"facebookexternalhit|facebookcatalog|twitterbot|linkedinbot|pinterest|embedly|iframely|"
    r"applebot|google-inspectiontool|mastodon|http\.rb|cardyb|vkshare|"
    r"uptimerobot|pingdom|statuscake|betterstack|hetrixtools|site24x7|"
    r"curl/|wget/|python-requests|python-urllib|python-httpx|httpx/|aiohttp/|"
    r"go-http-client|java/|okhttp/|axios/|node-fetch|undici|libwww-perl|postmanruntime)",
    re.IGNORECASE,
)


def is_bot_or_prefetch_request(user_agent: Optional[str], purpose: Optional[str] = None) -> bool:
    """True for empty/automated User-Agents and speculative prefetch/prerender requests."""
    if purpose and any(tok in purpose.lower() for tok in ("prefetch", "prerender", "preview")):
        return True
    ua = (user_agent or "").strip()
    if not ua:
        return True
    return bool(_AUTOMATED_UA_RE.search(ua))


def record_file_view(
    file_id: str,
    user_agent: Optional[str] = None,
    purpose: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Records a human browser visit to the download page.
    Increments views_count and, for forever shares, slides expires_at to now + 7 days.
    Automated/prefetch requests return metadata with counted=False and perform no writes.
    Expired links are never revived. No viewer IP or identifier is stored.
    """
    if not file_id or len(file_id) > 64:
        return None

    automated = is_bot_or_prefetch_request(user_agent, purpose)
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        if not automated:
            conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0 AND upload_confirmed = 1",
            (file_id,),
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] <= now:
            cursor.execute(
                "UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?",
                (now, file_id),
            )
            return None

        if automated:
            meta = _build_public_metadata(row, now)
            meta["counted"] = False
            return meta

        new_expires_at = int(row["expires_at"])
        if _row_expiry_mode(row) == EXPIRY_MODE_FOREVER:
            new_expires_at = max(new_expires_at, now + FOREVER_INACTIVITY_SECONDS)

        cursor.execute(
            """
            UPDATE hosted_files
            SET views_count = COALESCE(views_count, 0) + 1, last_viewed_at = ?, expires_at = ?
            WHERE id = ? AND is_deleted = 0 AND upload_confirmed = 1 AND expires_at > ?
            """,
            (now, new_expires_at, file_id, now),
        )
        if cursor.rowcount == 0:
            return None

        updated = cursor.execute("SELECT * FROM hosted_files WHERE id = ?", (file_id,)).fetchone()
        meta = _build_public_metadata(updated, now)
        meta["counted"] = True
        return meta


def prepare_download(file_id: str, password: Optional[str] = None, issue_stream_token: bool = False) -> Dict[str, Any]:
    """Validates download permissions, atomically updates download counts, and returns URL or local path."""
    # Step 1: Read-only validation & scrypt verification outside SQLite write lock
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0 AND upload_confirmed = 1",
            (file_id,),
        ).fetchone()
        if not row:
            raise ValueError("File not found or has already expired.")

        now = int(time.time())
        if row["expires_at"] <= now:
            conn.execute(
                "UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?",
                (now, file_id),
            )
            conn.commit()
            raise ValueError("This file has expired and is no longer available.")

        password_hash = row["password_hash"]
        storage_type_hint = row["storage_type"]

    if password_hash:
        if not password or not verify_password(password.strip(), password_hash):
            raise PermissionError("Incorrect password for this file.")

    r2_client = None
    if storage_type_hint == "r2":
        r2_client = get_r2_client()
        if not r2_client:
            raise RuntimeError("Cloudflare R2 is currently unreachable.")

    # Step 2: Atomic conditional update inside BEGIN IMMEDIATE
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0 AND upload_confirmed = 1",
            (file_id,),
        ).fetchone()
        if not row:
            raise ValueError("File not found or has already expired.")

        now = int(time.time())
        if row["expires_at"] <= now:
            cursor.execute(
                "UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?",
                (now, file_id),
            )
            conn.commit()
            raise ValueError("This file has expired and is no longer available.")

        storage_type = row["storage_type"]
        storage_key = row["storage_key"]
        filename = row["original_name"]
        content_type = row["content_type"]

        if storage_type == "local":
            local_path = HOSTING_DIR / file_id / filename
            if not local_path.exists():
                raise ValueError("File upload was not completed or file is missing.")

        new_downloads = row["downloads_count"] + 1
        is_burn = row["max_downloads"] > 0 and new_downloads >= row["max_downloads"]

        # Downloads count as link activity: forever shares slide their 7-day idle window forward
        current_expires_at = int(row["expires_at"])
        if _row_expiry_mode(row) == EXPIRY_MODE_FOREVER and not is_burn:
            new_expires_at = max(current_expires_at, now + FOREVER_INACTIVITY_SECONDS)
        else:
            new_expires_at = current_expires_at
        seconds_remaining = max(0, new_expires_at - now)

        if storage_type == "r2":
            if not r2_client:
                r2_client = get_r2_client()
            if not r2_client:
                raise RuntimeError("Cloudflare R2 is currently unreachable.")
            burn_purge_after = now + BURN_PURGE_GRACE_SECONDS
        else:
            burn_purge_after = now + 300

        cursor.execute(
            """
            UPDATE hosted_files
            SET downloads_count = ?, is_deleted = ?, purge_after = ?, expires_at = ?, last_viewed_at = ?
            WHERE id = ?
            """,
            (
                new_downloads,
                1 if is_burn else 0,
                burn_purge_after if is_burn else 0,
                new_expires_at,
                now,
                file_id,
            ),
        )

        if storage_type != "r2":
            if issue_stream_token:
                stream_token = secrets.token_urlsafe(24)
                cursor.execute(
                    "INSERT INTO download_tokens (token, file_id, expires_at) VALUES (?, ?, ?)",
                    (stream_token, file_id, now + 180),
                )
                return {
                    "type": "redirect",
                    "url": f"/api/hosting/stream/{file_id}?token={stream_token}",
                    "filename": filename,
                    "burn": is_burn,
                    "expires_at": new_expires_at,
                    "seconds_remaining": seconds_remaining,
                }

            return {
                "type": "file",
                "path": HOSTING_DIR / file_id / filename,
                "filename": filename,
                "content_type": content_type,
                "burn": is_burn,
                "file_dir": HOSTING_DIR / file_id,
                "expires_at": new_expires_at,
                "seconds_remaining": seconds_remaining,
            }

    content_disposition = _build_content_disposition(filename)
    download_url = r2_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": R2_BUCKET_NAME,
            "Key": storage_key,
            "ResponseContentDisposition": content_disposition,
            "ResponseContentType": content_type,
        },
        ExpiresIn=BURN_PURGE_GRACE_SECONDS,
    )
    return {
        "type": "redirect",
        "url": download_url,
        "filename": filename,
        "burn": is_burn,
        "storage_key": storage_key,
        "expires_at": new_expires_at,
        "seconds_remaining": seconds_remaining,
    }


def consume_local_stream_token(file_id: str, token: str) -> Dict[str, Any]:
    """Consumes a single-use local download stream token without holding file contents in JS RAM."""
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        tok_row = cursor.execute(
            "SELECT * FROM download_tokens WHERE token = ? AND file_id = ?",
            (token, file_id),
        ).fetchone()
        if not tok_row or tok_row["expires_at"] < now:
            cursor.execute("DELETE FROM download_tokens WHERE token = ?", (token,))
            conn.commit()
            raise ValueError("Download token is invalid or expired.")

        cursor.execute("DELETE FROM download_tokens WHERE token = ?", (token,))
        file_row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND storage_type = 'local' AND is_deleted < 2",
            (file_id,),
        ).fetchone()
        if not file_row:
            conn.commit()
            raise ValueError("File is no longer available.")

        local_path = HOSTING_DIR / file_id / file_row["original_name"]
        if not local_path.is_file():
            conn.commit()
            raise ValueError("File missing on server storage.")

        return {
            "path": local_path,
            "filename": file_row["original_name"],
            "content_type": file_row["content_type"],
            "burn": file_row["is_deleted"] == 1,
            "file_dir": HOSTING_DIR / file_id,
        }


def delete_hosted_file(file_id: str, delete_token: str) -> bool:
    """Allows the anonymous uploader to delete their file immediately using their secret token."""
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted < 2",
            (file_id,),
        ).fetchone()
        if not row:
            return False

        if not secrets.compare_digest(row["delete_token"], delete_token.strip()):
            raise PermissionError("Invalid delete token.")

        storage_type = row["storage_type"]
        storage_key = row["storage_key"]
        multipart_upload_id = row["multipart_upload_id"] or ""
        upload_confirmed = row["upload_confirmed"]

        # Mark pending purge immediately so concurrent requests cannot view/download while storage deletes
        cursor.execute(
            "UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?",
            (now, file_id),
        )

    purged = False
    if storage_type == "r2":
        r2_client = get_r2_client()
        if r2_client:
            try:
                if upload_confirmed == 0 and multipart_upload_id:
                    try:
                        r2_client.abort_multipart_upload(
                            Bucket=R2_BUCKET_NAME,
                            Key=storage_key,
                            UploadId=multipart_upload_id,
                        )
                    except ClientError:
                        pass
                r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
                purged = True
            except Exception as e:
                print(f"Error deleting R2 object {storage_key}: {e}")
    else:
        file_dir = HOSTING_DIR / file_id
        if file_dir.exists():
            shutil.rmtree(file_dir, ignore_errors=True)
        purged = not file_dir.exists()

    if purged:
        with get_db() as conn:
            conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))

    return True


def _is_r2_not_found(err: ClientError) -> bool:
    code = str(err.response.get("Error", {}).get("Code", ""))
    return code in ("404", "NoSuchKey", "NoSuchUpload")


def cleanup_expired_files_job(force: bool = False):
    """Background worker to purge expired, stale unconfirmed, or post-grace burned files."""
    now = int(time.time())
    expired_rows: List[Dict[str, Any]] = []
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        if not force:
            lease_row = cursor.execute(
                "SELECT updated_at FROM maintenance_state WHERE key = 'expiry_cleanup'"
            ).fetchone()
            if lease_row and (now - lease_row["updated_at"]) < 540:
                return
            cursor.execute(
                """
                INSERT INTO maintenance_state (key, updated_at) VALUES ('expiry_cleanup', ?)
                ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at
                """,
                (now,),
            )

        cursor.execute("DELETE FROM download_tokens WHERE expires_at <= ?", (now,))

        # Purge only when:
        # 1) Regular TTL expired (expires_at <= now), OR
        # 2) Burned file passed its post-download grace window (purge_after > 0 and purge_after <= now), OR
        # 3) Legacy burned row without purge_after older than 30 min, OR
        # 4) Abandoned unconfirmed upload older than 2 hours.
        rows = cursor.execute(
            """
            SELECT id, storage_type, storage_key, upload_confirmed, multipart_upload_id
            FROM hosted_files
            WHERE (expires_at <= ? AND is_deleted < 2)
               OR (is_deleted = 1 AND purge_after > 0 AND purge_after <= ?)
               OR (is_deleted = 1 AND purge_after = 0 AND created_at <= ?)
               OR (upload_confirmed <= 0 AND created_at <= ? AND is_deleted < 2)
            """,
            (now, now, now - BURN_PURGE_GRACE_SECONDS, now - 7200),
        ).fetchall()
        expired_rows = [dict(r) for r in rows]

    if not expired_rows:
        return

    r2_client = get_r2_client() if any(r["storage_type"] == "r2" for r in expired_rows) else None
    purged_ids: List[str] = []

    for row in expired_rows:
        file_id = row["id"]
        storage_type = row["storage_type"]
        storage_key = row["storage_key"]
        multipart_upload_id = row.get("multipart_upload_id") or ""

        if storage_type == "r2":
            if not r2_client:
                continue
            try:
                if row["upload_confirmed"] == 0 and multipart_upload_id:
                    try:
                        r2_client.abort_multipart_upload(
                            Bucket=R2_BUCKET_NAME,
                            Key=storage_key,
                            UploadId=multipart_upload_id,
                        )
                    except ClientError as ce:
                        if not _is_r2_not_found(ce):
                            raise
                try:
                    r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
                except ClientError as ce:
                    if not _is_r2_not_found(ce):
                        raise
                purged_ids.append(file_id)
            except Exception as e:
                print(f"Error purging expired R2 file {file_id}: {e}")
        elif storage_type == "local":
            file_dir = HOSTING_DIR / file_id
            if file_dir.exists():
                shutil.rmtree(file_dir, ignore_errors=True)
            if not file_dir.exists():
                purged_ids.append(file_id)

    if purged_ids:
        with get_db() as conn:
            conn.executemany(
                "UPDATE hosted_files SET is_deleted = 2 WHERE id = ?",
                [(fid,) for fid in purged_ids],
            )
