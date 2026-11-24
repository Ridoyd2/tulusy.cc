import asyncio
import re
import shutil
import time
import uuid
import zipfile
from pathlib import Path
from typing import Iterable, List, Optional, Tuple
from fastapi import UploadFile
from app.config import (
    MAX_FILE_SIZE,
    MAX_IMAGE_DIMENSION,
    OUTPUT_DIR,
    TEMP_FILE_TTL_SECONDS,
    UPLOAD_DIR,
)

IMAGE_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heif",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "tga": "image/x-tga",
    "pdf": "application/pdf",
}


_WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def sanitize_filename_component(raw_name: Optional[str], default_name: str = "unnamed_file") -> str:
    """Strips directory components, control chars, trailing dots, and Windows-unsafe filename characters."""
    raw = (raw_name or "").replace("\\", "/").split("/")[-1].strip()
    clean = "".join(c for c in raw if ord(c) >= 32 and c not in '<>:"|?*').strip(" .")
    if not clean or clean in (".", ".."):
        return default_name
    base_part = clean.split(".", 1)[0].upper()
    if base_part in _WINDOWS_RESERVED_NAMES:
        clean = f"_{clean}"
    return clean


def get_safe_stem(filename: Optional[str], default_name: str = "converted_file") -> str:
    """Returns a sanitized filename stem safe for writing into task output directories."""
    clean = sanitize_filename_component(filename, default_name=default_name)
    stem = Path(clean).stem.strip(" .")
    return stem or default_name


def validate_target_format(target_format: str, allowed_formats: Iterable[str]) -> str:
    """Normalizes and validates a target format token against an allowlist to block path traversal."""
    fmt = (target_format or "").strip().lower().lstrip(".")
    if not fmt or not re.fullmatch(r"[a-z0-9]{1,10}", fmt) or fmt not in set(allowed_formats):
        raise ValueError(f"Unsupported or invalid target format: '{target_format}'")
    return fmt


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
    safe_filename = sanitize_filename_component(upload_file.filename, default_name="unnamed_file")

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


async def cleanup_task_dir(task_id: str):
    """Cleans up temporary directories associated with a task, with a slight delay to avoid Windows file locks."""
    await asyncio.sleep(2)  # Wait for file handles to be fully released by OS
    try:
        task_upload = UPLOAD_DIR / task_id
        task_output = OUTPUT_DIR / task_id
        if task_upload.exists():
            await asyncio.to_thread(shutil.rmtree, task_upload, True)
        if task_output.exists():
            await asyncio.to_thread(shutil.rmtree, task_output, True)
    except Exception as e:
        print(f"Error during cleanup of task {task_id}: {e}")


def cleanup_stale_temp_dirs(max_age_seconds: int = TEMP_FILE_TTL_SECONDS) -> None:
    """Removes stale temporary task directories older than max_age_seconds (multi-worker safe)."""
    cutoff = time.time() - max(60, max_age_seconds)
    try:
        for d in [UPLOAD_DIR, OUTPUT_DIR]:
            if not d.exists():
                continue
            for item in d.iterdir():
                try:
                    if item.stat().st_mtime > cutoff:
                        continue
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    else:
                        item.unlink(missing_ok=True)
                except OSError:
                    continue
    except Exception as e:
        print(f"Error during stale temp cleanup: {e}")


def startup_cleanup():
    """Cleans up stale temporary directories on startup without disturbing sibling workers' active tasks."""
    cleanup_stale_temp_dirs(TEMP_FILE_TTL_SECONDS)

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
    safe_quality = max(1, min(100, quality if quality is not None else 90))
    safe_dpi = max(72, min(600, dpi if dpi is not None else 300))
    return width, height, safe_quality, safe_dpi
