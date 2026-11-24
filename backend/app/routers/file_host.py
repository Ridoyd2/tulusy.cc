import asyncio
import shutil
import sqlite3
import time
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.config import FOREVER_INACTIVITY_SECONDS, HOSTING_DIR, MAX_HOSTING_FILE_SIZE
from app.services.r2_storage_service import (
    abort_multipart_session,
    complete_multipart_session,
    confirm_upload_session,
    consume_local_stream_token,
    create_upload_session,
    delete_hosted_file,
    get_db,
    get_file_metadata,
    prepare_download,
    record_file_view,
)

router = APIRouter(prefix="/api/hosting", tags=["File Hosting"])


class InitUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0, description="Size in bytes")
    content_type: Optional[str] = None
    expiry_days: int = Field(1, ge=1, le=7)
    expiry_hours: Optional[int] = Field(None, ge=1, le=168)
    expiry_mode: Literal["fixed", "forever_idle_7d"] = "fixed"
    max_downloads: int = Field(0, ge=0)
    password: Optional[str] = None
    use_multipart: bool = False


class MultipartPart(BaseModel):
    PartNumber: int = Field(..., ge=1, le=10000)
    ETag: str = Field(..., min_length=1)


class CompleteMultipartRequest(BaseModel):
    upload_id: str = Field(..., min_length=1)
    parts: List[MultipartPart] = Field(..., min_length=1)


class AbortMultipartRequest(BaseModel):
    upload_id: str = Field(..., min_length=1)


class DownloadRequest(BaseModel):
    password: Optional[str] = None


class ReportRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)


def _mark_file_purged(file_id: str) -> None:
    with get_db() as conn:
        conn.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))


async def _cleanup_local_dir(dir_path: Path, file_id: Optional[str] = None):
    await asyncio.sleep(1)
    if dir_path and dir_path.exists():
        await asyncio.to_thread(shutil.rmtree, dir_path, True)
    if file_id and (not dir_path or not dir_path.exists()):
        await asyncio.to_thread(_mark_file_purged, file_id)


def _claim_local_upload_session(file_id: str) -> str:
    now = int(time.time())
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM hosted_files WHERE id = ? AND is_deleted = 0",
            (file_id,),
        ).fetchone()
        if not row:
            raise LookupError("Upload session not found or expired.")
        if row["storage_type"] != "local":
            raise ValueError("Direct server upload is disabled when R2 storage is active.")
        if row["upload_confirmed"] == 1:
            raise FileExistsError("Upload session has already been completed.")
        if row["upload_confirmed"] == -1:
            raise FileExistsError("Upload session is already in progress.")
        if row["expires_at"] <= now:
            conn.execute("UPDATE hosted_files SET is_deleted = 1, purge_after = ? WHERE id = ?", (now, file_id))
            conn.commit()
            raise TimeoutError("Upload session has expired.")
        conn.execute(
            "UPDATE hosted_files SET upload_confirmed = -1 WHERE id = ? AND upload_confirmed = 0",
            (file_id,),
        )
        return str(row["original_name"])


def _release_local_upload_claim(file_id: str, total_written: Optional[int] = None, delete: bool = False) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        if delete:
            cursor.execute("UPDATE hosted_files SET is_deleted = 2 WHERE id = ?", (file_id,))
            return True
        if total_written is not None:
            # Forever shares start their 7-day idle window when the upload completes
            now = int(time.time())
            cursor.execute(
                """
                UPDATE hosted_files
                SET file_size = ?,
                    upload_confirmed = 1,
                    last_viewed_at = CASE WHEN expiry_mode = 'forever_idle_7d' THEN ? ELSE last_viewed_at END,
                    expires_at = CASE WHEN expiry_mode = 'forever_idle_7d' THEN MAX(expires_at, ?) ELSE expires_at END
                WHERE id = ? AND upload_confirmed = -1 AND is_deleted = 0
                """,
                (total_written, now, now + FOREVER_INACTIVITY_SECONDS, file_id),
            )
            return cursor.rowcount > 0
        cursor.execute(
            "UPDATE hosted_files SET upload_confirmed = 0 WHERE id = ? AND upload_confirmed = -1",
            (file_id,),
        )
        return True


def _record_file_report(file_id: str, reason: str) -> bool:
    with get_db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM hosted_files WHERE id = ? AND is_deleted < 2",
            (file_id,),
        ).fetchone()
        if not exists:
            return False
        conn.execute(
            "INSERT INTO file_reports (file_id, reason, created_at) VALUES (?, ?, ?)",
            (file_id, reason, int(time.time())),
        )
    return True


@router.post("/init-upload")
async def init_upload(req: InitUploadRequest):
    """
    Initializes an anonymous upload session.
    Generates pre-signed PUT or Multipart URLs for Cloudflare R2 (up to 5GB).
    """
    try:
        session = await asyncio.to_thread(
            create_upload_session,
            filename=req.filename,
            file_size=req.file_size,
            content_type=req.content_type,
            expiry_days=req.expiry_days,
            expiry_hours=req.expiry_hours,
            max_downloads=req.max_downloads,
            password=req.password,
            auto_confirm=False,
            use_multipart=req.use_multipart,
            expiry_mode=req.expiry_mode,
        )
        return {"status": "success", "data": session}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize upload session: {e}")


@router.post("/upload-direct/{file_id}")
async def upload_direct(file_id: str, file: UploadFile = File(...)):
    """
    Fallback upload endpoint when Cloudflare R2 credentials are not configured.
    Guards against concurrent/active/R2/expired sessions and streams writes off the event loop.
    """
    try:
        original_name = await asyncio.to_thread(_claim_local_upload_session, file_id)
    except LookupError as le:
        raise HTTPException(status_code=404, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except FileExistsError as fee:
        raise HTTPException(status_code=409, detail=str(fee))
    except TimeoutError as te:
        raise HTTPException(status_code=410, detail=str(te))

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
                await asyncio.to_thread(buffer.write, chunk)
        if total_written <= 0:
            raise ValueError("Uploaded file cannot be empty.")
    except ValueError as ve:
        await asyncio.to_thread(shutil.rmtree, target_dir, True)
        await asyncio.to_thread(_release_local_upload_claim, file_id, None, True)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await asyncio.to_thread(shutil.rmtree, target_dir, True)
        await asyncio.to_thread(_release_local_upload_claim, file_id, None, False)
        raise HTTPException(status_code=500, detail=f"Upload stream error: {e}")

    committed = await asyncio.to_thread(_release_local_upload_claim, file_id, total_written, False)
    if not committed:
        await asyncio.to_thread(shutil.rmtree, target_dir, True)
        raise HTTPException(status_code=404, detail="Upload session was cancelled or deleted.")
    return {"status": "success", "message": "File uploaded", "file_id": file_id}


@router.post("/complete-multipart/{file_id}")
async def complete_multipart(file_id: str, req: CompleteMultipartRequest):
    """Completes a browser R2 multipart upload and confirms the hosted session."""
    try:
        parts_payload = [{"PartNumber": p.PartNumber, "ETag": p.ETag} for p in req.parts]
        meta = await asyncio.to_thread(complete_multipart_session, file_id, req.upload_id, parts_payload)
        return {"status": "success", "file": meta}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to complete multipart upload: {e}")


@router.post("/abort-multipart/{file_id}")
async def abort_multipart(file_id: str, req: AbortMultipartRequest):
    """Aborts an in-flight or failed R2 multipart upload cleanly when upload_id matches."""
    try:
        await asyncio.to_thread(abort_multipart_session, file_id, req.upload_id)
        return {"status": "success"}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/confirm-upload/{file_id}")
async def confirm_upload(file_id: str):
    """Verifies uploaded object presence in R2 or local storage and activates the session."""
    try:
        meta = await asyncio.to_thread(confirm_upload_session, file_id)
        return {"status": "success", "file": meta}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not verify upload: {e}")


@router.get("/info/{file_id}")
async def get_info(file_id: str):
    """Public metadata for the anonymous download page (read-only: never counts as a view)."""
    meta = await asyncio.to_thread(get_file_metadata, file_id)
    if not meta:
        raise HTTPException(status_code=404, detail="File does not exist or has expired.")
    return {"status": "success", "file": meta}


@router.post("/view/{file_id}")
async def register_file_view(file_id: str, request: Request):
    """
    Records a human browser visit to the download page.
    Forever shares slide their 7-day idle window forward; bots, link unfurlers, and
    prefetch/prerender requests are ignored (counted=false). No viewer IP is stored.
    """
    user_agent = request.headers.get("user-agent")
    purpose = (
        request.headers.get("sec-purpose")
        or request.headers.get("purpose")
        or request.headers.get("x-moz")
    )
    res = await asyncio.to_thread(record_file_view, file_id, user_agent, purpose)
    if not res:
        raise HTTPException(status_code=404, detail="File does not exist or has expired.")
    counted = bool(res.pop("counted", False))
    return {"status": "success", "counted": counted, "file": res}


@router.post("/download/{file_id}")
async def download_file(
    file_id: str,
    req: Optional[DownloadRequest] = None,
):
    """
    Returns download URL (presigned R2 URL or short-lived single-use local stream URL).
    If Burn-on-Read is active on R2, cleanup preserves the 30-min presigned URL download window.
    Downloads refresh the 7-day idle window of forever shares.
    """
    password = req.password if req else None
    try:
        res = await asyncio.to_thread(prepare_download, file_id, password, True)
        return {
            "status": "success",
            "download_url": res["url"],
            "filename": res["filename"],
            "expires_at": res.get("expires_at"),
            "seconds_remaining": res.get("seconds_remaining"),
        }
    except PermissionError as pe:
        raise HTTPException(status_code=401, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream/{file_id}")
async def stream_local_file(
    file_id: str,
    background_tasks: BackgroundTasks,
    token: str = Query(...),
):
    """Streams a local-fallback hosted file directly to disk using a one-time stream token."""
    try:
        res = await asyncio.to_thread(consume_local_stream_token, file_id, token)
        if res.get("burn") and res.get("file_dir"):
            background_tasks.add_task(_cleanup_local_dir, res["file_dir"], file_id)
        return FileResponse(
            path=res["path"],
            filename=res["filename"],
            media_type=res["content_type"],
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.get("/direct-download/{file_id}")
async def direct_download(
    file_id: str,
    background_tasks: BackgroundTasks,
    p: Optional[str] = Query(None),
):
    """GET endpoint allowing direct browser downloads."""
    try:
        res = await asyncio.to_thread(prepare_download, file_id, p, False)
        if res["type"] == "redirect":
            return RedirectResponse(url=res["url"])
        if res.get("burn") and res.get("file_dir"):
            background_tasks.add_task(_cleanup_local_dir, res["file_dir"], file_id)
        return FileResponse(
            path=res["path"],
            filename=res["filename"],
            media_type=res["content_type"],
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
        success = await asyncio.to_thread(delete_hosted_file, file_id, token)
        if not success:
            raise HTTPException(status_code=404, detail="File already deleted or not found.")
        return {"status": "success", "message": "File deleted permanently."}
    except HTTPException:
        raise
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report/{file_id}")
async def report_file(file_id: str, req: ReportRequest):
    """Logs abuse/DMCA report for an active hosted file."""
    recorded = await asyncio.to_thread(_record_file_report, file_id, req.reason)
    if not recorded:
        raise HTTPException(status_code=404, detail="Hosted file not found.")
    return {"status": "success", "message": "Report received."}
