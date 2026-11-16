import asyncio
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import RedirectResponse, FileResponse
from pydantic import BaseModel, Field

from app.config import MAX_HOSTING_FILE_SIZE, R2_BUCKET_NAME
from app.services.r2_storage_service import (
    create_upload_session,
    get_file_metadata,
    prepare_download,
    delete_hosted_file,
    get_r2_client,
    HOSTING_DIR,
    get_db
)

router = APIRouter(prefix="/api/hosting", tags=["File Hosting"])


class InitUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0, description="Size in bytes")
    content_type: Optional[str] = None
    expiry_days: int = Field(1, ge=1, le=7)
    expiry_hours: Optional[int] = Field(None, ge=1, le=168)
    max_downloads: int = Field(0, ge=0)
    password: Optional[str] = None


class DownloadRequest(BaseModel):
    password: Optional[str] = None


class ReportRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)


async def _cleanup_local_dir(dir_path: Path, file_id: Optional[str] = None):
    await asyncio.sleep(2)
    if dir_path and dir_path.exists():
        shutil.rmtree(dir_path, ignore_errors=True)
    if file_id:
        with get_db() as conn:
            conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))


async def _cleanup_burned_r2_object(storage_key: str, file_id: str):
    await asyncio.sleep(45)
    r2_client = get_r2_client()
    if r2_client and storage_key:
        try:
            r2_client.delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
        except Exception as e:
            print(f"Error deleting burned R2 object {storage_key}: {e}")
    with get_db() as conn:
        conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))


@router.post("/init-upload")
async def init_upload(req: InitUploadRequest):
    """
    Initializes an anonymous upload session.
    Generates a pre-signed PUT URL for direct browser-to-Cloudflare-R2 upload (up to 5GB).
    """
    try:
        session = create_upload_session(
            filename=req.filename,
            file_size=req.file_size,
            content_type=req.content_type,
            expiry_days=req.expiry_days,
            expiry_hours=req.expiry_hours,
            max_downloads=req.max_downloads,
            password=req.password
        )
        return {
            "status": "success",
            "data": session
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize upload session: {e}")


@router.post("/upload-direct/{file_id}")
async def upload_direct(file_id: str, file: UploadFile = File(...)):
    """
    Fallback upload endpoint when Cloudflare R2 credentials are not yet configured.
    Streams large files directly to server disk in chunks while enforcing size limits.
    """
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0", (file_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Upload session not found or expired.")
        original_name = row["original_name"]

    target_dir = HOSTING_DIR / file_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / original_name

    total_written = 0
    try:
        with open(target_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                total_written += len(chunk)
                if total_written > MAX_HOSTING_FILE_SIZE:
                    raise ValueError("Uploaded file exceeds 5GB maximum limit.")
                buffer.write(chunk)
    except ValueError as ve:
        shutil.rmtree(target_dir, ignore_errors=True)
        with get_db() as conn:
            conn.execute("UPDATE hosted_files SET is_deleted = 1 WHERE id = ?", (file_id,))
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        shutil.rmtree(target_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Upload stream error: {e}")

    with get_db() as conn:
        conn.execute("UPDATE hosted_files SET file_size = ? WHERE id = ?", (total_written, file_id))

    return {"status": "success", "message": "File uploaded", "file_id": file_id}


@router.post("/confirm-upload/{file_id}")
async def confirm_upload(file_id: str):
    """Verifies that an R2 or direct upload was completed."""
    meta = get_file_metadata(file_id)
    if not meta:
        raise HTTPException(status_code=404, detail="File session expired or invalid.")
    return {"status": "success", "file": meta}


@router.get("/info/{file_id}")
async def get_info(file_id: str):
    """Public metadata for the anonymous download page."""
    meta = get_file_metadata(file_id)
    if not meta:
        raise HTTPException(status_code=404, detail="File does not exist or has expired.")
    return {"status": "success", "file": meta}


@router.post("/download/{file_id}")
async def download_file(
    file_id: str,
    background_tasks: BackgroundTasks,
    req: Optional[DownloadRequest] = None
):
    """
    Generates download URL or serves file.
    If Cloudflare R2: returns presigned GET URL with Content-Disposition attachment.
    If local: serves direct FileResponse and cleans up if single-download burn is set.
    """
    password = req.password if req else None
    try:
        res = prepare_download(file_id, password)
        if res["type"] == "redirect":
            if res.get("burn") and res.get("storage_key"):
                background_tasks.add_task(_cleanup_burned_r2_object, res["storage_key"], file_id)
            return {"status": "success", "download_url": res["url"], "filename": res["filename"]}
        else:
            if res.get("burn") and res.get("file_dir"):
                background_tasks.add_task(_cleanup_local_dir, res["file_dir"], file_id)
            return FileResponse(
                path=res["path"],
                filename=res["filename"],
                media_type=res["content_type"]
            )
    except PermissionError as pe:
        raise HTTPException(status_code=401, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/direct-download/{file_id}")
async def direct_download(
    file_id: str,
    background_tasks: BackgroundTasks,
    p: Optional[str] = Query(None)
):
    """GET endpoint allowing direct browser downloads."""
    try:
        res = prepare_download(file_id, p)
        if res["type"] == "redirect":
            if res.get("burn") and res.get("storage_key"):
                background_tasks.add_task(_cleanup_burned_r2_object, res["storage_key"], file_id)
            return RedirectResponse(url=res["url"])
        else:
            if res.get("burn") and res.get("file_dir"):
                background_tasks.add_task(_cleanup_local_dir, res["file_dir"], file_id)
            return FileResponse(
                path=res["path"],
                filename=res["filename"],
                media_type=res["content_type"]
            )
    except PermissionError:
        raise HTTPException(status_code=401, detail="Password required or incorrect.")
    except ValueError:
        raise HTTPException(status_code=404, detail="File expired or not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete/{file_id}")
async def delete_file(file_id: str, token: str = Query(...)):
    """Allows anonymous uploader to delete the file immediately using their secret delete token."""
    try:
        success = delete_hosted_file(file_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="File already deleted or not found.")
        return {"status": "success", "message": "File deleted permanently."}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report/{file_id}")
async def report_file(file_id: str, req: ReportRequest):
    """Logs abuse/DMCA report for legal & AdSense compliance."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO file_reports (file_id, reason, created_at) VALUES (?, ?, ?)",
            (file_id, req.reason, int(time.time()))
        )
    return {"status": "success", "message": "Report received."}
