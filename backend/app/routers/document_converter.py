import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Callable

from app.services.utils import create_task_dir, save_upload_file, cleanup_task_dir, get_safe_stem
from app.services.pdf_service import (
    convert_pdf_to_docx,
    convert_pdf_to_pptx,
    convert_docx_to_pdf,
    convert_txt_to_pdf,
)
from app.services.excel_service import (
    convert_xlsx_to_pdf,
    convert_xlsx_to_csv,
    convert_csv_to_xlsx,
    convert_pdf_to_xlsx,
)

router = APIRouter(prefix="/api/convert/doc", tags=["Document Converter"])


async def _run_doc_conversion(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    output_ext: str,
    media_type: str,
    label: str,
    converter_fn: Callable[..., Path],
    *converter_args,
) -> FileResponse:
    """Uploads input, executes synchronous converter in a worker thread, and schedules cleanup."""
    task_id, upload_dir, output_dir = create_task_dir()
    try:
        input_path = await save_upload_file(file, upload_dir)
        output_filename = f"{get_safe_stem(file.filename, 'converted_document')}.{output_ext}"
        output_path = output_dir / output_filename

        await asyncio.to_thread(converter_fn, input_path, output_path, *converter_args)
        background_tasks.add_task(cleanup_task_dir, task_id)

        return FileResponse(path=str(output_path), filename=output_filename, media_type=media_type)
    except HTTPException:
        await cleanup_task_dir(task_id)
        raise
    except ValueError as ve:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await cleanup_task_dir(task_id)
        raise HTTPException(status_code=500, detail=f"{label} conversion failed: {str(e)}")


@router.post("/pdf-to-docx")
async def pdf_to_docx_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts PDF to editable Word document (.docx)."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "PDF to DOCX",
        convert_pdf_to_docx,
    )


@router.post("/pdf-to-pptx")
async def pdf_to_pptx_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts PDF to editable PowerPoint presentation (.pptx)."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "PDF to PPTX",
        convert_pdf_to_pptx,
        True,
    )


@router.post("/docx-to-pdf")
async def docx_to_pdf_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts DOCX to PDF."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "pdf",
        "application/pdf",
        "DOCX to PDF",
        convert_docx_to_pdf,
    )


@router.post("/txt-to-pdf")
async def txt_to_pdf_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts TXT to PDF."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "pdf",
        "application/pdf",
        "TXT to PDF",
        convert_txt_to_pdf,
    )


@router.post("/xlsx-to-pdf")
async def xlsx_to_pdf_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts XLSX to formatted PDF."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "pdf",
        "application/pdf",
        "XLSX to PDF",
        convert_xlsx_to_pdf,
    )


@router.post("/xlsx-to-csv")
async def xlsx_to_csv_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts XLSX to CSV."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "csv",
        "text/csv",
        "XLSX to CSV",
        convert_xlsx_to_csv,
    )


@router.post("/csv-to-xlsx")
async def csv_to_xlsx_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Converts CSV to styled XLSX."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "CSV to XLSX",
        convert_csv_to_xlsx,
    )


@router.post("/pdf-to-xlsx")
async def pdf_to_xlsx_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Extracts PDF tables to XLSX."""
    return await _run_doc_conversion(
        background_tasks,
        file,
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "PDF to XLSX",
        convert_pdf_to_xlsx,
    )
