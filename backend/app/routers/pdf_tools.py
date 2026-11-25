import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional

from app.config import LEGACY_UNSUPPORTED_DOC_FORMATS, WRITABLE_IMAGE_FORMATS
from app.services.utils import (
    DOC_MEDIA_TYPES,
    IMAGE_MEDIA_TYPES,
    cleanup_task_dir,
    create_task_dir,
    create_zip_archive,
    ensure_upload_extension,
    get_safe_stem,
    normalize_format_alias,
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
from app.services.markup_service import convert_markup_or_ebook
from app.services.data_service import convert_structured_data
from app.services.excel_service import (
    convert_xlsx_to_pdf,
    convert_xlsx_to_csv,
    convert_csv_to_xlsx,
    convert_csv_to_pdf,
    convert_pdf_to_xlsx,
    convert_pdf_to_csv,
)

router = APIRouter(prefix="/api/convert", tags=["PDF Tools & Universal"])


_MARKUP_EBOOK_SOURCES = {"md", "html", "rtf", "epub"}
_MARKUP_TARGETS_BY_SOURCE = {
    "md": {"html", "pdf", "docx", "epub", "txt"},
    "html": {"md", "pdf", "docx", "epub", "txt"},
    "rtf": {"txt", "pdf", "docx", "html", "md", "epub"},
    "epub": {"txt", "html", "md", "pdf", "docx"},
}
_DATA_FORMATS = {"json", "yaml", "xml"}
_DATA_TARGETS = _DATA_FORMATS | {"csv", "xlsx", "pdf", "txt"}


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
        target_img_fmt = validate_target_format(normalize_format_alias(format), WRITABLE_IMAGE_FORMATS - {"pdf"})
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
            p, _ = ensure_upload_extension(p, file.content_type)
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
        all_known_targets = WRITABLE_IMAGE_FORMATS | {
            "docx", "pptx", "xlsx", "csv", "txt",
            "md", "html", "epub", "json", "yaml", "xml",
        }
        target_fmt = validate_target_format(normalize_format_alias(target_format), all_known_targets)

        input_path = await save_upload_file(file, upload_dir)
        input_path, source_ext = ensure_upload_extension(input_path, file.content_type)
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
                media_type = DOC_MEDIA_TYPES["docx"]
            elif target_fmt == "pptx":
                out_file = output_dir / f"{stem}.pptx"
                await asyncio.to_thread(convert_pdf_to_pptx, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["pptx"]
            elif target_fmt == "xlsx":
                out_file = output_dir / f"{stem}.xlsx"
                await asyncio.to_thread(convert_pdf_to_xlsx, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["xlsx"]
            elif target_fmt == "csv":
                out_file = output_dir / f"{stem}.csv"
                await asyncio.to_thread(convert_pdf_to_csv, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["csv"]
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_pdf_to_txt, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["txt"]
            elif target_fmt in ("html", "md", "epub"):
                out_file = output_dir / f"{stem}.{target_fmt}"
                await asyncio.to_thread(convert_markup_or_ebook, input_path, "pdf", target_fmt, out_file)
                media_type = DOC_MEDIA_TYPES[target_fmt]
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
                media_type = DOC_MEDIA_TYPES["pdf"]
            elif target_fmt == "csv":
                out_file = output_dir / f"{stem}.csv"
                await asyncio.to_thread(convert_xlsx_to_csv, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["csv"]
            elif target_fmt in _DATA_FORMATS:
                out_file = output_dir / f"{stem}.{target_fmt}"
                await asyncio.to_thread(convert_structured_data, input_path, "xlsx", target_fmt, out_file)
                media_type = DOC_MEDIA_TYPES[target_fmt]
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext == "csv":
            if target_fmt == "xlsx":
                out_file = output_dir / f"{stem}.xlsx"
                await asyncio.to_thread(convert_csv_to_xlsx, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["xlsx"]
            elif target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_csv_to_pdf, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["pdf"]
            elif target_fmt in _DATA_FORMATS:
                out_file = output_dir / f"{stem}.{target_fmt}"
                await asyncio.to_thread(convert_structured_data, input_path, "csv", target_fmt, out_file)
                media_type = DOC_MEDIA_TYPES[target_fmt]
            else:
                raise ValueError(f"Unsupported conversion from .csv to .{target_fmt}")

        # 3. Word / PowerPoint / Text Documents
        elif source_ext == "docx":
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_docx_to_pdf, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["pdf"]
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_docx_to_txt, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["txt"]
            elif target_fmt in ("html", "md", "epub"):
                out_file = output_dir / f"{stem}.{target_fmt}"
                await asyncio.to_thread(convert_markup_or_ebook, input_path, "docx", target_fmt, out_file)
                media_type = DOC_MEDIA_TYPES[target_fmt]
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext == "pptx":
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_pptx_to_pdf, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["pdf"]
            elif target_fmt == "txt":
                out_file = output_dir / f"{stem}.txt"
                await asyncio.to_thread(convert_pptx_to_txt, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["txt"]
            else:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")

        elif source_ext == "txt":
            if target_fmt == "pdf":
                out_file = output_dir / f"{stem}.pdf"
                await asyncio.to_thread(convert_txt_to_pdf, input_path, out_file)
                media_type = DOC_MEDIA_TYPES["pdf"]
            elif target_fmt in ("html", "md", "epub"):
                out_file = output_dir / f"{stem}.{target_fmt}"
                await asyncio.to_thread(convert_markup_or_ebook, input_path, "txt", target_fmt, out_file)
                media_type = DOC_MEDIA_TYPES[target_fmt]
            else:
                raise ValueError(f"Unsupported conversion from .txt to .{target_fmt}")

        # 3b. Markdown, HTML, RTF, EPUB
        elif source_ext in _MARKUP_EBOOK_SOURCES:
            allowed_targets = _MARKUP_TARGETS_BY_SOURCE[source_ext]
            if target_fmt not in allowed_targets:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")
            out_file = output_dir / f"{stem}.{target_fmt}"
            await asyncio.to_thread(convert_markup_or_ebook, input_path, source_ext, target_fmt, out_file)
            media_type = DOC_MEDIA_TYPES[target_fmt]

        # 3c. Structured Data (JSON, YAML, XML)
        elif source_ext in _DATA_FORMATS:
            if target_fmt == source_ext or target_fmt not in _DATA_TARGETS:
                raise ValueError(f"Unsupported conversion from .{source_ext} to .{target_fmt}")
            out_file = output_dir / f"{stem}.{target_fmt}"
            await asyncio.to_thread(convert_structured_data, input_path, source_ext, target_fmt, out_file)
            media_type = DOC_MEDIA_TYPES[target_fmt]

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
