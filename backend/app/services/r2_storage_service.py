import os
import time
import shutil
import secrets
import hashlib
import sqlite3
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import contextmanager
from urllib.parse import quote
import boto3
from botocore.config import Config
from app.config import (
    BASE_DIR,
    HOSTING_DIR,
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    MAX_HOSTING_FILE_SIZE,
    DEFAULT_HOSTING_EXPIRY_DAYS,
    BLOCKED_HOSTING_EXTENSIONS
)

DB_PATH = BASE_DIR / "data" / "file_host.db"


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
    """Initializes SQLite database tables and WAL mode for hosted files metadata."""
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
                is_deleted INTEGER DEFAULT 0
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS file_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                created_at INTEGER NOT NULL
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
            s3={"addressing_style": "path"}
        )
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
    """Hashes a file access password using SHA-256."""
    salt = "tulusy_anon_salt_2026"
    return hashlib.sha256(f"{salt}_{password}".encode("utf-8")).hexdigest()


def create_upload_session(
    filename: str,
    file_size: int,
    content_type: Optional[str] = None,
    expiry_days: int = DEFAULT_HOSTING_EXPIRY_DAYS,
    expiry_hours: Optional[int] = None,
    max_downloads: int = 0,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates an anonymous upload session.
    Returns presigned PUT URL for Cloudflare R2 (or fallback direct local route).
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

    if storage_type == "r2":
        upload_url = r2_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": R2_BUCKET_NAME,
                "Key": storage_key,
                "ContentType": final_content_type,
            },
            ExpiresIn=3600
        )
    else:
        upload_url = f"/api/hosting/upload-direct/{file_id}"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO hosted_files (
                id, original_name, file_size, content_type, storage_type,
                storage_key, created_at, expires_at, delete_token,
                downloads_count, max_downloads, password_hash, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)
        """, (
            file_id, safe_name, file_size, final_content_type, storage_type,
            storage_key, created_at, expires_at, delete_token,
            max_downloads, password_hash
        ))

    return {
        "file_id": file_id,
        "filename": safe_name,
        "file_size": file_size,
        "upload_url": upload_url,
        "storage_type": storage_type,
        "expires_at": expires_at,
        "delete_token": delete_token,
        "expiry_days": expiry_days
    }


def get_file_metadata(file_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves public metadata for the download page."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0", (file_id,))
        row = cursor.fetchone()
        if not row:
            return None

        now = int(time.time())
        if row["expires_at"] <= now:
            cursor.execute("UPDATE hosted_files SET is_deleted = 1 WHERE id = ?", (file_id,))
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
            "seconds_remaining": max(0, row["expires_at"] - now)
        }


def prepare_download(file_id: str, password: Optional[str] = None) -> Dict[str, Any]:
    """Validates download permissions, atomically updates download counts, and returns URL or local path."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0", (file_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError("File not found or has already expired.")

        now = int(time.time())
        if row["expires_at"] <= now:
            cursor.execute("UPDATE hosted_files SET is_deleted = 1 WHERE id = ?", (file_id,))
            raise ValueError("This file has expired and is no longer available.")

        if row["password_hash"]:
            if not password or hash_password(password.strip()) != row["password_hash"]:
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

        cursor.execute(
            "UPDATE hosted_files SET downloads_count = ?, is_deleted = ? WHERE id = ?",
            (new_downloads, 1 if is_burn else 0, file_id)
        )

        if storage_type == "r2":
            r2_client = get_r2_client()
            if not r2_client:
                raise RuntimeError("Cloudflare R2 is currently unreachable.")

            ascii_name = "".join(c if 32 <= ord(c) < 127 and c not in '"\\' else "_" for c in filename) or "download"
            encoded_name = quote(filename)
            content_disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"

            download_url = r2_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": R2_BUCKET_NAME,
                    "Key": storage_key,
                    "ResponseContentDisposition": content_disposition,
                    "ResponseContentType": content_type
                },
                ExpiresIn=1800
            )

            return {
                "type": "redirect",
                "url": download_url,
                "filename": filename,
                "burn": is_burn,
                "storage_key": storage_key
            }
        else:
            local_path = HOSTING_DIR / file_id / filename
            return {
                "type": "file",
                "path": local_path,
                "filename": filename,
                "content_type": content_type,
                "burn": is_burn,
                "file_dir": HOSTING_DIR / file_id
            }


def delete_hosted_file(file_id: str, delete_token: str) -> bool:
    """Allows the anonymous uploader to delete their file immediately using their secret token."""
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0", (file_id,))
        row = cursor.fetchone()
        if not row:
            return False

        if row["delete_token"] != delete_token.strip():
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
    """Background worker to purge expired or burned files from R2 and disk with multi-worker lease."""
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        if not force:
            cursor.execute(
                "SELECT updated_at FROM maintenance_state WHERE key = 'expiry_cleanup'"
            )
            lease_row = cursor.fetchone()
            if lease_row and (now - lease_row["updated_at"]) < 540:
                return
            cursor.execute(
                """
                INSERT INTO maintenance_state (key, updated_at) VALUES ('expiry_cleanup', ?)
                ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at
                """,
                (now,),
            )

        # is_deleted = 0 (active but expired) or is_deleted = 1 (soft-deleted/burned/expired, storage not yet purged)
        cursor.execute(
            "SELECT * FROM hosted_files WHERE (expires_at <= ? AND is_deleted < 2) OR (is_deleted = 1 AND created_at <= ?)",
            (now, now - 60)
        )
        expired_files = cursor.fetchall()

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
