import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Optional, List

from app.config import WRITABLE_IMAGE_FORMATS
from app.services.utils import (
    IMAGE_MEDIA_TYPES,
    cleanup_task_dir,
    create_task_dir,
    create_zip_archive,
    get_safe_stem,
    save_upload_file,
    validate_target_format,
)
from app.services.image_service import convert_single_image

router = APIRouter(prefix="/api/convert/image", tags=["Image Converter"])


@router.post("")
async def convert_image_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_format: str = Form(...),
    quality: Optional[int] = Form(90),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    maintain_aspect_ratio: Optional[bool] = Form(True),
    dpi: Optional[int] = Form(300),
    grayscale: Optional[bool] = Form(False),
    bg_color: Optional[str] = Form("#FFFFFF")
):
    """
    Universal single image converter endpoint.
    """
    task_id, upload_dir, output_dir = create_task_dir()

    try:
        target_fmt = validate_target_format(target_format, WRITABLE_IMAGE_FORMATS)
        input_path = await save_upload_file(file, upload_dir)
        stem = get_safe_stem(file.filename, "converted_image")
        output_filename = f"{stem}.{target_fmt}"
        output_path = output_dir / output_filename

        await asyncio.to_thread(
            convert_single_image,
            input_path=input_path,
            output_path=output_path,
            target_format=target_fmt,
            quality=quality if quality is not None else 90,
            width=width,
            height=height,
            maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
            dpi=dpi if dpi is not None else 300,
            grayscale=grayscale or False,
            bg_color=bg_color or "#FFFFFF"
        )

        # Schedule cleanup after sending response
        background_tasks.add_task(cleanup_task_dir, task_id)
        media_type = IMAGE_MEDIA_TYPES.get(target_fmt, "application/octet-stream")

        return FileResponse(
            path=str(output_path),
            filename=output_filename,
            media_type=media_type
        )
    except HTTPException:
        await cleanup_task_dir(task_id)
        raise
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"Image conversion failed: {str(e)}")


@router.post("/batch")
async def convert_image_batch_endpoint(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    target_format: str = Form(...),
    quality: Optional[int] = Form(90),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None)
):
    """
    Batch image converter, returning a ZIP archive containing all converted images.
    """
    task_id, upload_dir, output_dir = create_task_dir()
    converted_files = []

    try:
        if not files:
            raise ValueError("No files uploaded for batch conversion.")
        target_fmt = validate_target_format(target_format, WRITABLE_IMAGE_FORMATS)

        for file in files:
            input_path = await save_upload_file(file, upload_dir)
            base_stem = get_safe_stem(input_path.name, "converted_image")
            output_path = output_dir / f"{base_stem}.{target_fmt}"
            counter = 1
            while output_path.exists():
                output_path = output_dir / f"{base_stem}_{counter}.{target_fmt}"
                counter += 1

            await asyncio.to_thread(
                convert_single_image,
                input_path=input_path,
                output_path=output_path,
                target_format=target_fmt,
                quality=quality if quality is not None else 90,
                width=width,
                height=height
            )
            converted_files.append(output_path)

        zip_path = output_dir / f"converted_images_{target_fmt}.zip"
        await asyncio.to_thread(create_zip_archive, converted_files, zip_path)

        background_tasks.add_task(cleanup_task_dir, task_id)

        return FileResponse(
            path=str(zip_path),
            filename=f"converted_images_{target_fmt}.zip",
            media_type="application/zip"
        )
    except HTTPException:
        await cleanup_task_dir(task_id)
        raise
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"Batch conversion failed: {str(e)}")
