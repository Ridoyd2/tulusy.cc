import hashlib
import hmac
import math
import mimetypes
import secrets
import shutil
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import (
    BASE_DIR,
    BLOCKED_HOSTING_EXTENSIONS,
    DEFAULT_HOSTING_EXPIRY_DAYS,
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
                upload_confirmed INTEGER DEFAULT 1
            )
        """)

        existing_cols = {
            row[1] for row in cursor.execute("PRAGMA table_info(hosted_files)").fetchall()
        }
        if "purge_after" not in existing_cols:
            cursor.execute("ALTER TABLE hosted_files ADD COLUMN purge_after INTEGER DEFAULT 0")
        if "upload_confirmed" not in existing_cols:
            cursor.execute("ALTER TABLE hosted_files ADD COLUMN upload_confirmed INTEGER DEFAULT 1")

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


def sanitize_filename(filename: str) -> str:
    """Strips directory components and control characters from a filename."""
    clean = filename.replace("\\", "/").split("/")[-1].strip()
    clean = "".join(c for c in clean if ord(c) >= 32 and c not in '<>:"|?*')
    return clean or "unnamed_file"


def is_extension_allowed(filename: str) -> bool:
    """Verifies filename is safe and not an executable / malicious payload."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
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
) -> Dict[str, Any]:
    """
    Creates an anonymous upload session.
    Returns presigned PUT / Multipart URLs for Cloudflare R2 (or fallback direct local route).
    """
    safe_name = sanitize_filename(filename)

    if file_size <= 0:
        raise ValueError("File cannot be empty (0 bytes).")

    if file_size > MAX_HOSTING_FILE_SIZE:
        raise ValueError(f"File size exceeds maximum allowed 5GB limit ({file_size} bytes).")

    if not is_extension_allowed(safe_name):
        raise ValueError("Executable files are restricted for security.")

    file_id = generate_file_id()
    delete_token = secrets.token_hex(16)
    created_at = int(time.time())

    if expiry_hours is not None and expiry_hours > 0:
        capped_hours = max(1, min(168, expiry_hours))
        expires_at = created_at + (capped_hours * 3600)
        expiry_days = max(1, round(capped_hours / 24))
    else:
        expiry_days = max(1, min(7, expiry_days))
        expires_at = created_at + (expiry_days * 86400)

    guessed_type, _ = mimetypes.guess_type(safe_name)
    final_content_type = content_type or guessed_type or "application/octet-stream"

    password_hash = hash_password(password.strip()) if password and password.strip() else ""

    r2_client = get_r2_client()
    storage_type = "r2" if r2_client else "local"
    storage_key = f"files/{file_id}/{safe_name}"

    upload_url = f"/api/hosting/upload-direct/{file_id}"
    upload_mode = "single"
    multipart_data: Dict[str, Any] = {}

    if storage_type == "r2":
        should_multipart = use_multipart and file_size > MULTIPART_THRESHOLD_BYTES
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

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO hosted_files (
                id, original_name, file_size, content_type, storage_type,
                storage_key, created_at, expires_at, delete_token,
                downloads_count, max_downloads, password_hash, is_deleted,
                purge_after, upload_confirmed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?)
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
            ),
        )

    return {
        "file_id": file_id,
        "filename": safe_name,
        "file_size": file_size,
        "upload_url": upload_url,
        "upload_mode": upload_mode,
        "storage_type": storage_type,
        "expires_at": expires_at,
        "delete_token": delete_token,
        "expiry_days": expiry_days,
        **multipart_data,
    }


def complete_multipart_session(file_id: str, upload_id: str, parts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Finalizes a multipart upload in Cloudflare R2 and verifies uploaded size."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0",
            (file_id,),
        ).fetchone()
        if not row:
            raise ValueError("Upload session not found or expired.")
        if row["storage_type"] != "r2":
            raise ValueError("Multipart upload is only valid for R2 storage sessions.")
        if row["expires_at"] <= int(time.time()):
            raise ValueError("Upload session has expired.")
        storage_key = row["storage_key"]

    r2_client = get_r2_client()
    if not r2_client:
        raise RuntimeError("Cloudflare R2 is not configured.")

    sorted_parts = sorted(
        [{"PartNumber": int(p["PartNumber"]), "ETag": str(p["ETag"])} for p in parts],
        key=lambda p: p["PartNumber"],
    )
    r2_client.complete_multipart_upload(
        Bucket=R2_BUCKET_NAME,
        Key=storage_key,
        UploadId=upload_id,
        MultipartUpload={"Parts": sorted_parts},
    )
    return confirm_upload_session(file_id)


def abort_multipart_session(file_id: str, upload_id: str) -> None:
    """Aborts an in-flight or failed R2 multipart upload and removes session availability."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT storage_type, storage_key FROM hosted_files WHERE id = ?",
            (file_id,),
        ).fetchone()
        if not row:
            return
        if row["storage_type"] == "r2":
            r2_client = get_r2_client()
            if r2_client:
                try:
                    r2_client.abort_multipart_upload(
                        Bucket=R2_BUCKET_NAME,
                        Key=row["storage_key"],
                        UploadId=upload_id,
                    )
                except Exception:
                    pass
        conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))


def confirm_upload_session(file_id: str) -> Dict[str, Any]:
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
            raise ValueError("File session expired.")

        storage_type = row["storage_type"]
        storage_key = row["storage_key"]
        actual_size = row["file_size"]

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
                cursor.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))
                raise ValueError("Uploaded file size is invalid or exceeds 5GB limit.")
        else:
            local_path = HOSTING_DIR / file_id / row["original_name"]
            if not local_path.is_file():
                raise ValueError("Uploaded file was not found on server storage.")
            actual_size = local_path.stat().st_size

        cursor.execute(
            "UPDATE hosted_files SET upload_confirmed = 1, file_size = ? WHERE id = ?",
            (actual_size, file_id),
        )

    meta = get_file_metadata(file_id)
    if not meta:
        raise ValueError("File session could not be confirmed.")
    return meta


def get_file_metadata(file_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves public metadata for confirmed, non-expired hosted files."""
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

        return {
            "file_id": row["id"],
            "filename": row["original_name"],
            "file_size": row["file_size"],
            "content_type": row["content_type"],
            "created_at": row["created_at"],
            "expires_at": row["expires_at"],
            "downloads_count": row["downloads_count"],
            "requires_password": bool(row["password_hash"]),
            "is_burn_after_reading": row["max_downloads"] == 1,
            "seconds_remaining": max(0, row["expires_at"] - now),
        }


def prepare_download(file_id: str, password: Optional[str] = None, issue_stream_token: bool = False) -> Dict[str, Any]:
    """Validates download permissions, atomically updates download counts, and returns URL or local path."""
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

        if row["password_hash"]:
            if not password or not verify_password(password.strip(), row["password_hash"]):
                raise PermissionError("Incorrect password for this file.")

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

        if storage_type == "r2":
            r2_client = get_r2_client()
            if not r2_client:
                raise RuntimeError("Cloudflare R2 is currently unreachable.")

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

            cursor.execute(
                "UPDATE hosted_files SET downloads_count = ?, is_deleted = ?, purge_after = ? WHERE id = ?",
                (
                    new_downloads,
                    1 if is_burn else 0,
                    now + BURN_PURGE_GRACE_SECONDS if is_burn else 0,
                    file_id,
                ),
            )

            return {
                "type": "redirect",
                "url": download_url,
                "filename": filename,
                "burn": is_burn,
                "storage_key": storage_key,
            }

        # Local storage path
        cursor.execute(
            "UPDATE hosted_files SET downloads_count = ?, is_deleted = ?, purge_after = ? WHERE id = ?",
            (new_downloads, 1 if is_burn else 0, now + 300 if is_burn else 0, file_id),
        )

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
            }

        return {
            "type": "file",
            "path": HOSTING_DIR / file_id / filename,
            "filename": filename,
            "content_type": content_type,
            "burn": is_burn,
            "file_dir": HOSTING_DIR / file_id,
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
            raise ValueError("Download token is invalid or expired.")

        cursor.execute("DELETE FROM download_tokens WHERE token = ?", (token,))
        file_row = cursor.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND storage_type = 'local' AND is_deleted < 2",
            (file_id,),
        ).fetchone()
        if not file_row:
            raise ValueError("File is no longer available.")

        local_path = HOSTING_DIR / file_id / file_row["original_name"]
        if not local_path.is_file():
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

        cursor.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))

        storage_type = row["storage_type"]
        storage_key = row["storage_key"]

        if storage_type == "r2":
            r2_client = get_r2_client()
            if r2_client:
                try:
                    r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
                except Exception as e:
                    print(f"Error deleting R2 object {storage_key}: {e}")
        else:
            file_dir = HOSTING_DIR / file_id
            if file_dir.exists():
                shutil.rmtree(file_dir, ignore_errors=True)

        return True


def cleanup_expired_files_job(force: bool = False):
    """Background worker to purge expired, stale unconfirmed, or post-grace burned files."""
    now = int(time.time())
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
        expired_files = cursor.execute(
            """
            SELECT * FROM hosted_files
            WHERE (expires_at <= ? AND is_deleted < 2)
               OR (is_deleted = 1 AND purge_after > 0 AND purge_after <= ?)
               OR (is_deleted = 1 AND purge_after = 0 AND created_at <= ?)
               OR (upload_confirmed = 0 AND created_at <= ? AND is_deleted < 2)
            """,
            (now, now, now - BURN_PURGE_GRACE_SECONDS, now - 7200),
        ).fetchall()

        if not expired_files:
            return

        r2_client = get_r2_client()

        for row in expired_files:
            file_id = row["id"]
            storage_type = row["storage_type"]
            storage_key = row["storage_key"]

            if storage_type == "r2" and r2_client:
                try:
                    r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
                except Exception as e:
                    print(f"Error purging expired R2 file {file_id}: {e}")
            elif storage_type == "local":
                file_dir = HOSTING_DIR / file_id
                if file_dir.exists():
                    shutil.rmtree(file_dir, ignore_errors=True)

            cursor.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))
