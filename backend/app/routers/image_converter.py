import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Optional, List

from app.services.utils import create_task_dir, save_upload_file, cleanup_task_dir, create_zip_archive
from app.services.image_service import convert_single_image

router = APIRouter(prefix="/api/convert/image", tags=["Image Converter"])

def get_safe_stem(filename: Optional[str], default_name: str = "converted_image") -> str:
    if filename and filename.strip():
        stem = Path(filename).stem
        if stem:
            return stem
    return default_name

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
        input_path = await save_upload_file(file, upload_dir)
        target_fmt = target_format.lower().lstrip('.')
        output_filename = f"{get_safe_stem(file.filename)}.{target_fmt}"
        output_path = output_dir / output_filename
        
        await asyncio.to_thread(
            convert_single_image,
            input_path=input_path,
            output_path=output_path,
            target_format=target_fmt,
            quality=quality or 90,
            width=width,
            height=height,
            maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
            dpi=dpi or 300,
            grayscale=grayscale or False,
            bg_color=bg_color or "#FFFFFF"
        )
        
        # Schedule cleanup after sending response
        background_tasks.add_task(cleanup_task_dir, task_id)
        
        media_type = "application/octet-stream"
        if target_fmt in ["jpg", "jpeg"]:
            media_type = "image/jpeg"
        elif target_fmt == "png":
            media_type = "image/png"
        elif target_fmt == "webp":
            media_type = "image/webp"
        elif target_fmt == "svg":
            media_type = "image/svg+xml"
        elif target_fmt == "pdf":
            media_type = "application/pdf"
            
        return FileResponse(
            path=str(output_path),
            filename=output_filename,
            media_type=media_type
        )
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
        target_fmt = target_format.lower().lstrip('.')
        for file in files:
            input_path = await save_upload_file(file, upload_dir)
            output_filename = f"{input_path.stem}.{target_fmt}"
            output_path = output_dir / output_filename
            
            await asyncio.to_thread(
                convert_single_image,
                input_path=input_path,
                output_path=output_path,
                target_format=target_fmt,
                quality=quality or 90,
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
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"Batch conversion failed: {str(e)}")
