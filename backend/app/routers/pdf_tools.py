import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional

from app.config import LEGACY_UNSUPPORTED_DOC_FORMATS, WRITABLE_IMAGE_FORMATS
from app.services.utils import (
    IMAGE_MEDIA_TYPES,
    cleanup_task_dir,
    create_task_dir,
    create_zip_archive,
    get_safe_stem,
    save_upload_file,
    validate_target_format,
)
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


_MIME_EXT_MAP = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/heic": "heic",
    "image/heif": "heic",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
    "image/x-tga": "tga",
    "image/vnd.adobe.photoshop": "psd",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}


@router.post("/pdf-to-images")
async def pdf_to_images_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    format: str = Form("png"),
    dpi: int = Form(300),
    quality: Optional[int] = Form(90),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    maintain_aspect_ratio: Optional[bool] = Form(True),
    grayscale: Optional[bool] = Form(False),
    bg_color: Optional[str] = Form("#FFFFFF"),
):
    """Extracts all pages from a PDF as images, returned as single image (if 1 page) or ZIP archive."""
    task_id, upload_dir, output_dir = create_task_dir()
    try:
        target_img_fmt = validate_target_format(format, WRITABLE_IMAGE_FORMATS - {"pdf"})
        input_path = await save_upload_file(file, upload_dir)
        extracted = await asyncio.to_thread(
            extract_pdf_pages_to_images,
            pdf_path=input_path,
            output_dir=output_dir,
            img_format=target_img_fmt,
            dpi=dpi if dpi is not None else 300,
            quality=quality if quality is not None else 90,
            width=width,
            height=height,
            maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
            grayscale=grayscale or False,
            bg_color=bg_color or "#FFFFFF",
        )

        if not extracted:
            raise HTTPException(status_code=400, detail="No pages found in PDF")

        background_tasks.add_task(cleanup_task_dir, task_id)

        if len(extracted) == 1:
            return FileResponse(
                path=str(extracted[0]),
                filename=extracted[0].name,
                media_type=IMAGE_MEDIA_TYPES.get(target_img_fmt, "application/octet-stream")
            )
        else:
            zip_stem = get_safe_stem(file.filename, "document")
            zip_path = output_dir / f"{zip_stem}_pages.zip"
            await asyncio.to_thread(create_zip_archive, extracted, zip_path)
            return FileResponse(
                path=str(zip_path),
                filename=f"{zip_stem}_pages.zip",
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
        if not files:
            raise ValueError("No images provided to merge.")
        saved_paths = []
        for file in files:
            p = await save_upload_file(file, upload_dir)
            saved_paths.append(p)

        safe_stem = get_safe_stem(output_name, "merged_document")
        out_pdf = output_dir / f"{safe_stem}.pdf"
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
        all_known_targets = WRITABLE_IMAGE_FORMATS | {"docx", "pptx", "xlsx", "csv", "txt"}
        target_fmt = validate_target_format(target_format, all_known_targets)

        input_path = await save_upload_file(file, upload_dir)
        source_ext = input_path.suffix.lower().lstrip(".")
        if not source_ext:
            raw_mime = (file.content_type or "").split(";", 1)[0].strip().lower()
            source_ext = _MIME_EXT_MAP.get(raw_mime, "")
            if source_ext:
                renamed_path = input_path.with_name(f"{input_path.name}.{source_ext}")
                input_path.rename(renamed_path)
                input_path = renamed_path
        stem = get_safe_stem(file.filename, "converted_file")

        if source_ext in LEGACY_UNSUPPORTED_DOC_FORMATS:
            raise ValueError(
                f"Legacy binary .{source_ext} files are not supported. Please re-save as .{source_ext}x and try again."
            )

        # 1. PDF Source Routes
        if source_ext == "pdf":
            if target_fmt == "pdf":
                raise ValueError("Source file is already a PDF.")
            if target_fmt == "docx":
                out_file = output_dir / f"{stem}.docx"
                await asyncio.to_thread(convert_pdf_to_docx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif target_fmt == "pptx":
                out_file = output_dir / f"{stem}.pptx"
                await asyncio.to_thread(convert_pdf_to_pptx, input_path, out_file)
                media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            elif target_fmt == "xlsx":
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
            elif target_fmt in (WRITABLE_IMAGE_FORMATS - {"pdf"}):
                extracted = await asyncio.to_thread(
                    extract_pdf_pages_to_images,
                    input_path,
                    output_dir,
                    img_format=target_fmt,
                    dpi=dpi if dpi is not None else 300,
                    quality=quality if quality is not None else 90,
                    width=width,
                    height=height,
                    maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
                    grayscale=grayscale or False,
                    bg_color=bg_color or "#FFFFFF",
                )
                if not extracted:
                    raise ValueError("No pages found in PDF")
                if len(extracted) == 1:
                    out_file = extracted[0]
                    media_type = IMAGE_MEDIA_TYPES.get(target_fmt, "application/octet-stream")
                else:
                    out_file = output_dir / f"{stem}_pages.zip"
                    await asyncio.to_thread(create_zip_archive, extracted, out_file)
                    media_type = "application/zip"
            else:
                raise ValueError(f"Unsupported conversion from .pdf to .{target_fmt}")

        # 2. Spreadsheets (XLSX / CSV)
        elif source_ext == "xlsx":
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
            if target_fmt == "xlsx":
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
        elif source_ext == "docx":
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

        elif source_ext == "pptx":
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
            if target_fmt not in WRITABLE_IMAGE_FORMATS:
                raise ValueError(f"Unsupported image target format: .{target_fmt}")
            out_file = output_dir / f"{stem}.{target_fmt}"
            await asyncio.to_thread(
                convert_single_image,
                input_path=input_path,
                output_path=out_file,
                target_format=target_fmt,
                quality=quality if quality is not None else 90,
                width=width,
                height=height,
                maintain_aspect_ratio=maintain_aspect_ratio if maintain_aspect_ratio is not None else True,
                dpi=dpi if dpi is not None else 300,
                grayscale=grayscale or False,
                bg_color=bg_color or "#FFFFFF"
            )
            media_type = IMAGE_MEDIA_TYPES.get(target_fmt, "application/octet-stream")

        background_tasks.add_task(cleanup_task_dir, task_id)

        return FileResponse(
            path=str(out_file),
            filename=out_file.name,
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
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
