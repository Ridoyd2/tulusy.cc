import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List, Optional

from app.services.utils import create_task_dir, save_upload_file, cleanup_task_dir, create_zip_archive
from app.services.pdf_service import (
    extract_pdf_pages_to_images,
    convert_images_to_pdf,
    convert_pdf_to_docx,
    convert_pdf_to_pptx,
    convert_pdf_to_txt,
    convert_docx_to_pdf,
    convert_docx_to_txt,
    convert_pptx_to_pdf,
    convert_pptx_to_txt,
    convert_txt_to_pdf,
)
from app.services.image_service import convert_single_image
from app.services.excel_service import (
    convert_xlsx_to_pdf,
    convert_xlsx_to_csv,
    convert_csv_to_xlsx,
    convert_csv_to_pdf,
    convert_pdf_to_xlsx,
    convert_pdf_to_csv,
)

router = APIRouter(prefix="/api/convert", tags=["PDF Tools & Universal"])


@router.post("/pdf-to-images")
async def pdf_to_images_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    format: str = Form("png"),
    dpi: int = Form(300)
):
    """Extracts all pages from a PDF as images, returned as single image (if 1 page) or ZIP archive."""
    task_id, upload_dir, output_dir = create_task_dir()
    try:
        input_path = await save_upload_file(file, upload_dir)
        extracted = await asyncio.to_thread(
            extract_pdf_pages_to_images,
            pdf_path=input_path,
            output_dir=output_dir,
            img_format=format,
            dpi=dpi
        )

        if not extracted:
            raise HTTPException(status_code=400, detail="No pages found in PDF")

        background_tasks.add_task(cleanup_task_dir, task_id)

        if len(extracted) == 1:
            return FileResponse(
                path=str(extracted[0]),
                filename=extracted[0].name,
                media_type=f"image/{format}"
            )
        else:
            zip_path = output_dir / f"{input_path.stem}_pages.zip"
            await asyncio.to_thread(create_zip_archive, extracted, zip_path)
            return FileResponse(
                path=str(zip_path),
                filename=f"{input_path.stem}_pages.zip",
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
        raise HTTPException(status_code=500, detail=f"PDF to images extraction failed: {str(e)}")


@router.post("/images-to-pdf")
async def images_to_pdf_endpoint(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    output_name: Optional[str] = Form("merged_document.pdf")
):
    """Merges multiple images into a single PDF document."""
    task_id, upload_dir, output_dir = create_task_dir()
    try:
        saved_paths = []
        for file in files:
            p = await save_upload_file(file, upload_dir)
            saved_paths.append(p)

        safe_name = (output_name or "merged_document.pdf").replace("\\", "/").split("/")[-1]
        out_pdf = output_dir / (safe_name if safe_name.endswith(".pdf") else f"{safe_name}.pdf")
        await asyncio.to_thread(convert_images_to_pdf, saved_paths, out_pdf)

        background_tasks.add_task(cleanup_task_dir, task_id)

        return FileResponse(
            path=str(out_pdf),
            filename=out_pdf.name,
            media_type="application/pdf"
        )
    except HTTPException:
        await cleanup_task_dir(task_id)
        raise
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"Images to PDF failed: {str(e)}")


@router.post("/universal")
async def universal_convert_endpoint(
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
    Universal routing endpoint: automatically picks the right conversion pipeline
    based on input file extension and target format.
    """
    task_id, upload_dir, output_dir = create_task_dir()
    try:
        input_path = await save_upload_file(file, upload_dir)
        source_ext = input_path.suffix.lower().lstrip(".")
        target_fmt = target_format.lower().lstrip(".")
        stem = Path(file.filename).stem if (file.filename and file.filename.strip()) else "converted_file"
        if not stem:
            stem = "converted_file"

        # 1. PDF Source Routes
        if source_ext == "pdf":
            if target_fmt in ["docx", "doc"]:
                out_file = output_dir / f"{stem}.docx"
                await asyncio.to_thread(convert_pdf_to_docx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif target_fmt in ["pptx", "ppt"]:
                out_file = output_dir / f"{stem}.pptx"
                await asyncio.to_thread(convert_pdf_to_pptx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            elif target_fmt in ["xlsx", "xls"]:
                out_file = output_dir / f"{stem}.xlsx"
                await asyncio.to_thread(convert_pdf_to_xlsx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif target_fmt == "csv":
                out_file = output_dir / f"{stem}.csv"
                await asyncio.to_thread(convert_pdf_to_csv, input_path, out_file)
                media_type = "text/csv"
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_pdf_to_txt, input_path, out_file)
                media_type = "text/plain"
            else:
                extracted = await asyncio.to_thread(
                    extract_pdf_pages_to_images, input_path, output_dir, img_format=target_fmt, dpi=dpi or 300
                )
                if not extracted:
                    raise ValueError("No pages found in PDF")
                if len(extracted) == 1:
                    out_file = extracted[0]
                    media_type = f"image/{target_fmt}"
                else:
                    out_file = output_dir / f"{stem}_pages.zip"
                    await asyncio.to_thread(create_zip_archive, extracted, out_file)
                    media_type = "application/zip"

        # 2. Spreadsheets (XLSX / XLS / CSV)
        elif source_ext in ["xlsx", "xls"]:
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_xlsx_to_pdf, input_path, out_file)
                media_type = "application/pdf"
            elif target_fmt == "csv":
                out_file = output_dir / f"{stem}.csv"
                await asyncio.to_thread(convert_xlsx_to_csv, input_path, out_file)
                media_type = "text/csv"
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext == "csv":
            if target_fmt in ["xlsx", "xls"]:
                out_file = output_dir / f"{stem}.xlsx"
                await asyncio.to_thread(convert_csv_to_xlsx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_csv_to_pdf, input_path, out_file)
                media_type = "application/pdf"
            else:
                raise ValueError(f"Unsupported conversion from .csv to .{target_fmt}")

        # 3. Word / PowerPoint / Text Documents
        elif source_ext in ["docx", "doc"]:
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_docx_to_pdf, input_path, out_file)
                media_type = "application/pdf"
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_docx_to_txt, input_path, out_file)
                media_type = "text/plain"
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext in ["pptx", "ppt"]:
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_pptx_to_pdf, input_path, out_file)
                media_type = "application/pdf"
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_pptx_to_txt, input_path, out_file)
                media_type = "text/plain"
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext == "txt":
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_txt_to_pdf, input_path, out_file)
                media_type = "application/pdf"
            else:
                raise ValueError(f"Unsupported conversion from .txt to .{target_fmt}")

        # 4. Image to Any Image / PDF / Vector / Icon
        else:
            out_file = output_dir / f"{stem}.{target_fmt}"
            await asyncio.to_thread(
                convert_single_image,
                input_path=input_path,
                output_path=out_file,
                target_format=target_fmt,
                quality=quality or 90,
                width=width,
                height=height,
                maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
                dpi=dpi or 300,
                grayscale=grayscale or False,
                bg_color=bg_color or "#FFFFFF"
            )
            media_map = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp",
                "avif": "image/avif",
                "svg": "image/svg+xml",
                "ico": "image/x-icon",
                "gif": "image/gif",
                "bmp": "image/bmp",
                "tiff": "image/tiff",
                "pdf": "application/pdf",
            }
            media_type = media_map.get(target_fmt, "application/octet-stream")

        background_tasks.add_task(cleanup_task_dir, task_id)

        return FileResponse(
            path=str(out_file),
            filename=out_file.name,
            media_type=media_type
        )
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
