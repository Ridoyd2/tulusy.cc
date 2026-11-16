import os
import uuid
import shutil
import zipfile
from pathlib import Path
from typing import List, Tuple
from fastapi import UploadFile
from app.config import UPLOAD_DIR, OUTPUT_DIR, MAX_FILE_SIZE, MAX_IMAGE_DIMENSION

def create_task_dir() -> Tuple[str, Path, Path]:
    """Creates isolated upload and output directories for a specific conversion task."""
    task_id = str(uuid.uuid4())
    task_upload_dir = UPLOAD_DIR / task_id
    task_output_dir = OUTPUT_DIR / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)
    task_output_dir.mkdir(parents=True, exist_ok=True)
    return task_id, task_upload_dir, task_output_dir

async def save_upload_file(upload_file: UploadFile, destination: Path) -> Path:
    """Saves an uploaded file to the specified path asynchronously with size limit and name deduplication."""
    raw_name = upload_file.filename or "unnamed_file"
    safe_filename = raw_name.replace('\\', '/').split('/')[-1].strip()
    if not safe_filename or safe_filename in (".", ".."):
        safe_filename = "unnamed_file"

    target_path = destination / safe_filename
    if target_path.exists():
        stem = target_path.stem or "file"
        suffix = target_path.suffix
        counter = 1
        while target_path.exists():
            target_path = destination / f"{stem}_{counter}{suffix}"
            counter += 1

    total_bytes = 0
    try:
        with open(target_path, "wb") as buffer:
            while content := await upload_file.read(1024 * 1024):  # 1MB chunks
                total_bytes += len(content)
                if total_bytes > MAX_FILE_SIZE:
                    raise ValueError(
                        f"File '{safe_filename}' exceeds the maximum converter file size limit ({MAX_FILE_SIZE // (1024 * 1024)}MB)."
                    )
                await asyncio.to_thread(buffer.write, content)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise

    return target_path

import asyncio

async def cleanup_task_dir(task_id: str):
    """Cleans up temporary directories associated with a task, with a slight delay to avoid Windows file locks."""
    await asyncio.sleep(2)  # Wait for file handles to be fully released by OS
    try:
        task_upload = UPLOAD_DIR / task_id
        task_output = OUTPUT_DIR / task_id
        if task_upload.exists():
            shutil.rmtree(task_upload, ignore_errors=True)
        if task_output.exists():
            shutil.rmtree(task_output, ignore_errors=True)
    except Exception as e:
        print(f"Error during cleanup of task {task_id}: {e}")

def startup_cleanup():
    """Cleans up all temporary directories on application startup."""
    try:
        for d in [UPLOAD_DIR, OUTPUT_DIR]:
            if d.exists():
                for item in d.iterdir():
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    else:
                        item.unlink(missing_ok=True)
    except Exception as e:
        print(f"Error during startup cleanup: {e}")

def create_zip_archive(files: List[Path], zip_path: Path) -> Path:
    """Packages a list of files into a ZIP archive with automatic duplicate filename disambiguation."""
    used_names: dict[str, int] = {}
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in files:
            arcname = file.name
            if arcname in used_names:
                used_names[arcname] += 1
                arcname = f"{file.stem}_{used_names[arcname]}{file.suffix}"
            else:
                used_names[arcname] = 0
            zipf.write(file, arcname=arcname)
    return zip_path

def sanitize_ext(ext: str) -> str:
    """Sanitizes extension format (removes leading dots, lowercases)."""
    return ext.lstrip('.').strip().lower()


def validate_image_params(
    width: int | None = None,
    height: int | None = None,
    quality: int = 90,
    dpi: int = 300,
) -> tuple[int | None, int | None, int, int]:
    """Validates and clamps image conversion parameters to prevent memory DoS."""
    if width is not None and (width < 1 or width > MAX_IMAGE_DIMENSION):
        raise ValueError(f"Width must be between 1 and {MAX_IMAGE_DIMENSION} pixels.")
    if height is not None and (height < 1 or height > MAX_IMAGE_DIMENSION):
        raise ValueError(f"Height must be between 1 and {MAX_IMAGE_DIMENSION} pixels.")
    safe_quality = max(1, min(100, quality or 90))
    safe_dpi = max(72, min(600, dpi or 300))
    return width, height, safe_quality, safe_dpi
