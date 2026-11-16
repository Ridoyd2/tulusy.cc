import io
import os
from pathlib import Path
from typing import List, Optional
from xml.sax.saxutils import escape

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from pdf2docx import Converter as PDF2DocxConverter
from pptx import Presentation
from pptx.util import Inches, Pt
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from docx import Document
from app.config import MAX_PDF_PAGES
from app.services.image_service import convert_single_image, load_image, _composite_to_rgb


def _safe_para_text(text: str) -> str:
    """Escapes XML entities so ReportLab Paragraph parser never crashes on <, >, or &."""
    cleaned = "".join(ch for ch in text if ch == "\t" or ch == "\n" or ord(ch) >= 32)
    return escape(cleaned)


def convert_pdf_to_docx(pdf_path: Path, docx_path: Path) -> Path:
    """Converts a PDF file to a fully editable Word (.docx) document."""
    cv = PDF2DocxConverter(str(pdf_path))
    try:
        cv.convert(str(docx_path), start=0, end=None)
    finally:
        cv.close()
    return docx_path


def convert_pdf_to_txt(pdf_path: Path, txt_path: Path) -> Path:
    """Extracts plain text from all pages of a PDF document."""
    doc = fitz.open(str(pdf_path))
    try:
        pages_text = []
        for idx, page in enumerate(doc):
            text = page.get_text("text").strip()
            if text:
                pages_text.append(f"--- Page {idx + 1} ---\n{text}")
        content = "\n\n".join(pages_text) if pages_text else ""
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(content)
    finally:
        doc.close()
    return txt_path


def convert_pdf_to_pptx(pdf_path: Path, pptx_path: Path, extract_text: bool = True) -> Path:
    """
    Converts a PDF file to an editable PowerPoint presentation (.pptx).
    Renders high-res page backdrops and overlays editable text blocks.
    """
    doc = fitz.open(str(pdf_path))
    try:
        if len(doc) > MAX_PDF_PAGES:
            raise ValueError(f"PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
        prs = Presentation()
        blank_slide_layout = prs.slide_layouts[6]

        for page_index, page in enumerate(doc):
            page_rect = page.rect
            width_in = max(1.0, min(56.0, page_rect.width / 72.0))
            height_in = max(1.0, min(56.0, page_rect.height / 72.0))

            if page_index == 0:
                prs.slide_width = Inches(width_in)
                prs.slide_height = Inches(height_in)

            slide = prs.slides.add_slide(blank_slide_layout)

            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            img_stream = io.BytesIO(img_bytes)
            slide.shapes.add_picture(img_stream, Inches(0), Inches(0), Inches(width_in), Inches(height_in))

            if extract_text:
                text_instances = page.get_text("blocks")
                for block in text_instances:
                    if len(block) >= 5 and block[4].strip():
                        bx0, by0, bx1, by1, text_content = block[0], block[1], block[2], block[3], block[4]
                        left = Inches(bx0 / 72.0)
                        top = Inches(by0 / 72.0)
                        width = Inches(max(0.2, (bx1 - bx0) / 72.0))
                        height = Inches(max(0.2, (by1 - by0) / 72.0))

                        tx_box = slide.shapes.add_textbox(left, top, width, height)
                        tf = tx_box.text_frame
                        tf.word_wrap = True
                        p = tf.paragraphs[0]
                        p.text = text_content.strip()
                        p.font.size = Pt(11)

        prs.save(str(pptx_path))
    finally:
        doc.close()
    return pptx_path


def convert_docx_to_pdf(docx_path: Path, pdf_path: Path) -> Path:
    """Converts a DOCX file to PDF using python-docx and reportlab."""
    doc = Document(str(docx_path))
    pdf_doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for p in doc.paragraphs:
        if p.text.strip():
            story.append(Paragraph(_safe_para_text(p.text), styles["Normal"]))
            story.append(Spacer(1, 6))

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                story.append(Paragraph(_safe_para_text(row_text), styles["Normal"]))
                story.append(Spacer(1, 4))

    if not story:
        story.append(Paragraph("Empty Document", styles["Normal"]))

    pdf_doc.build(story)
    return pdf_path


def convert_docx_to_txt(docx_path: Path, txt_path: Path) -> Path:
    """Extracts plain text from a DOCX file."""
    doc = Document(str(docx_path))
    lines = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            row_text = "\t".join(cell.text.strip() for cell in row.cells)
            if row_text.strip():
                lines.append(row_text)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(lines))
    return txt_path


def convert_pptx_to_pdf(pptx_path: Path, pdf_path: Path) -> Path:
    """Extracts text and slide structure from a PPTX presentation into a clean PDF."""
    prs = Presentation(str(pptx_path))
    pdf_doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for idx, slide in enumerate(prs.slides, start=1):
        story.append(Paragraph(f"<b>Slide {idx}</b>", styles["Heading3"]))
        slide_has_text = False
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                for paragraph in shape.text_frame.paragraphs:
                    text = paragraph.text.strip()
                    if text:
                        slide_has_text = True
                        story.append(Paragraph(_safe_para_text(text), styles["Normal"]))
                        story.append(Spacer(1, 4))
        if not slide_has_text:
            story.append(Paragraph("<i>(Visual slide)</i>", styles["Normal"]))
        story.append(Spacer(1, 14))

    if not story:
        story.append(Paragraph("Empty Presentation", styles["Normal"]))

    pdf_doc.build(story)
    return pdf_path


def convert_pptx_to_txt(pptx_path: Path, txt_path: Path) -> Path:
    """Extracts text from a PPTX presentation to a plain UTF-8 text file."""
    prs = Presentation(str(pptx_path))
    blocks = []
    for idx, slide in enumerate(prs.slides, start=1):
        slide_lines = [f"--- Slide {idx} ---"]
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                for paragraph in shape.text_frame.paragraphs:
                    if paragraph.text.strip():
                        slide_lines.append(paragraph.text.strip())
        blocks.append("\n".join(slide_lines))
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(blocks))
    return txt_path


def convert_txt_to_pdf(txt_path: Path, pdf_path: Path) -> Path:
    """Converts plain text file to formatted PDF."""
    pdf_doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]
    story = []

    with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                story.append(Paragraph(_safe_para_text(line_str), normal_style))
            else:
                story.append(Spacer(1, 10))

    if not story:
        story.append(Paragraph("Empty Document", normal_style))

    pdf_doc.build(story)
    return pdf_path


def extract_pdf_pages_to_images(
    pdf_path: Path,
    output_dir: Path,
    img_format: str = "png",
    dpi: int = 300
) -> List[Path]:
    """Extracts all pages from a PDF document as high-resolution images in any supported format."""
    doc = fitz.open(str(pdf_path))
    generated_files: List[Path] = []

    base_name = pdf_path.stem or "document"
    img_format = img_format.lower().lstrip(".")
    dpi = max(72, min(600, dpi or 300))

    try:
        if len(doc) > MAX_PDF_PAGES:
            raise ValueError(f"PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
        for idx, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi)
            out_file = output_dir / f"{base_name}_page_{idx + 1}.{img_format}"

            if img_format == "png":
                pix.save(str(out_file), "png")
            elif img_format in ["jpg", "jpeg"]:
                pix.save(str(out_file), "jpeg")
            elif img_format == "webp":
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img.save(str(out_file), "WEBP", quality=92)
                img.close()
            else:
                temp_png = output_dir / f"_tmp_{base_name}_{idx + 1}.png"
                pix.save(str(temp_png), "png")
                try:
                    convert_single_image(
                        input_path=temp_png,
                        output_path=out_file,
                        target_format=img_format,
                        dpi=dpi
                    )
                finally:
                    temp_png.unlink(missing_ok=True)

            generated_files.append(out_file)
    finally:
        doc.close()

    return generated_files


def convert_images_to_pdf(image_paths: List[Path], output_pdf: Path) -> Path:
    """Combines multiple image files (including SVG, PSD, HEIC, PNG, JPG, etc.) into a single unified PDF file."""
    if not image_paths:
        raise ValueError("No images provided to create PDF")

    pil_images: List[Image.Image] = []
    try:
        for img_p in image_paths:
            loaded_frames = load_image(img_p)
            for frame in loaded_frames:
                try:
                    pil_images.append(_composite_to_rgb(frame, "#FFFFFF"))
                finally:
                    frame.close()

        if not pil_images:
            raise ValueError("Could not decode any images to create PDF")

        first_img = pil_images[0]
        first_img.save(
            str(output_pdf),
            "PDF",
            resolution=300.0,
            save_all=True,
            append_images=pil_images[1:] if len(pil_images) > 1 else []
        )
    finally:
        for img_obj in pil_images:
            try:
                img_obj.close()
            except Exception:
                pass

    return output_pdf
