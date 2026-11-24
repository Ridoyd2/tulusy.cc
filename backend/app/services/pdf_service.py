import io
from pathlib import Path
from typing import List, Optional
from xml.sax.saxutils import escape
from zipfile import BadZipFile

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from pdf2docx import Converter as PDF2DocxConverter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from docx import Document
from docx.opc.exceptions import PackageNotFoundError as DocxPackageNotFoundError
from pptx.exc import PackageNotFoundError as PptxPackageNotFoundError
from app.config import MAX_PDF_PAGES, MAX_TXT_PDF_LINES, WRITABLE_IMAGE_FORMATS
from app.services.image_service import convert_single_image, load_image, _composite_to_rgb
from app.services.utils import get_safe_stem, validate_image_params, validate_target_format


def _open_valid_pdf(pdf_path: Path):
    """Opens and validates a PDF against corruption, encryption, empty page count, and MAX_PDF_PAGES."""
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise ValueError(f"Invalid or corrupted PDF file: {e}")

    if doc.needs_pass:
        doc.close()
        raise ValueError("Password-protected PDFs are not supported.")
    if len(doc) == 0:
        doc.close()
        raise ValueError("PDF document contains no pages.")
    if len(doc) > MAX_PDF_PAGES:
        doc.close()
        raise ValueError(f"PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
    return doc


def _ensure_pdf_page_limit(pdf_path: Path) -> None:
    """Validates PDF page count and integrity against MAX_PDF_PAGES."""
    doc = _open_valid_pdf(pdf_path)
    doc.close()


def _safe_para_text(text: str) -> str:
    """Escapes XML entities so ReportLab Paragraph parser never crashes on <, >, or &."""
    cleaned = "".join(ch for ch in text if ch == "\t" or ch == "\n" or ord(ch) >= 32)
    return escape(cleaned).replace("\n", "<br/>")


def convert_pdf_to_docx(pdf_path: Path, docx_path: Path) -> Path:
    """Converts a PDF file to a fully editable Word (.docx) document."""
    _ensure_pdf_page_limit(pdf_path)
    cv = PDF2DocxConverter(str(pdf_path))
    try:
        cv.convert(str(docx_path), start=0, end=None)
    finally:
        cv.close()
    return docx_path


def convert_pdf_to_txt(pdf_path: Path, txt_path: Path) -> Path:
    """Extracts plain text from all pages of a PDF document."""
    doc = _open_valid_pdf(pdf_path)
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
    Extracts editable text blocks (with styling/scale) and strips rasterized text from
    the backdrop so text never doubles up visually.
    """
    doc = _open_valid_pdf(pdf_path)
    try:
        prs = Presentation()
        blank_slide_layout = prs.slide_layouts[6]

        slide_w_in = 10.0
        slide_h_in = 7.5

        for page_index, page in enumerate(doc):
            page_rect = page.rect
            page_w_in = max(1.0, min(56.0, page_rect.width / 72.0))
            page_h_in = max(1.0, min(56.0, page_rect.height / 72.0))

            if page_index == 0:
                slide_w_in = page_w_in
                slide_h_in = page_h_in
                prs.slide_width = Inches(slide_w_in)
                prs.slide_height = Inches(slide_h_in)

            # Fit page proportionally onto deck slide dimensions (handles mixed portrait/landscape PDFs)
            scale = min(slide_w_in / page_w_in, slide_h_in / page_h_in)
            render_w_in = page_w_in * scale
            render_h_in = page_h_in * scale
            offset_x_in = (slide_w_in - render_w_in) / 2.0
            offset_y_in = (slide_h_in - render_h_in) / 2.0

            slide = prs.slides.add_slide(blank_slide_layout)

            text_blocks = []
            if extract_text:
                text_dict = page.get_text("dict")
                for block in text_dict.get("blocks", []):
                    if block.get("type") == 0 and block.get("lines"):
                        text_blocks.append(block)

                if text_blocks:
                    # Remove text glyphs before rendering the backdrop image so editable text doesn't double-render
                    page.add_redact_annot(page.rect, fill=None)
                    page.apply_redactions(
                        images=getattr(fitz, "PDF_REDACT_IMAGE_NONE", 0),
                        graphics=getattr(fitz, "PDF_REDACT_LINE_ART_NONE", 0),
                    )

            pix = page.get_pixmap(dpi=200, alpha=False)
            img_bytes = pix.tobytes("png")
            img_stream = io.BytesIO(img_bytes)
            slide.shapes.add_picture(
                img_stream,
                Inches(offset_x_in),
                Inches(offset_y_in),
                Inches(render_w_in),
                Inches(render_h_in),
            )

            if extract_text and text_blocks:
                for block in text_blocks:
                    bx0, by0, bx1, by1 = block.get("bbox", (0, 0, 0, 0))
                    lines_data = []
                    for line in block.get("lines", []):
                        spans = [s for s in line.get("spans", []) if s.get("text")]
                        if spans:
                            lines_data.append(spans)
                    if not lines_data:
                        continue

                    left = Inches(offset_x_in + (bx0 / 72.0) * scale)
                    top = Inches(offset_y_in + (by0 / 72.0) * scale)
                    width = Inches(max(0.25, ((bx1 - bx0) / 72.0) * scale))
                    height = Inches(max(0.2, ((by1 - by0) / 72.0) * scale))

                    tx_box = slide.shapes.add_textbox(left, top, width, height)
                    tf = tx_box.text_frame
                    tf.word_wrap = True
                    tf.margin_left = 0
                    tf.margin_right = 0
                    tf.margin_top = 0
                    tf.margin_bottom = 0

                    for l_idx, spans in enumerate(lines_data):
                        p = tf.paragraphs[0] if l_idx == 0 else tf.add_paragraph()
                        for span in spans:
                            run = p.add_run()
                            run.text = span.get("text", "")
                            span_size = float(span.get("size") or 11.0) * scale
                            run.font.size = Pt(max(6.0, min(72.0, span_size)))
                            flags = int(span.get("flags") or 0)
                            if flags & 16:
                                run.font.bold = True
                            if flags & 2:
                                run.font.italic = True
                            color_int = span.get("color")
                            if isinstance(color_int, int):
                                r = (color_int >> 16) & 0xFF
                                g = (color_int >> 8) & 0xFF
                                b = color_int & 0xFF
                                run.font.color.rgb = RGBColor(r, g, b)

        prs.save(str(pptx_path))
    finally:
        doc.close()
    return pptx_path


def _open_docx(docx_path: Path) -> Document:
    try:
        return Document(str(docx_path))
    except (DocxPackageNotFoundError, BadZipFile, ValueError, KeyError, OSError) as e:
        raise ValueError(f"Invalid or corrupted DOCX document: {e}")


def _open_pptx(pptx_path: Path) -> Presentation:
    try:
        return Presentation(str(pptx_path))
    except (PptxPackageNotFoundError, BadZipFile, ValueError, KeyError, OSError) as e:
        raise ValueError(f"Invalid or corrupted PPTX presentation: {e}")


def _extract_pptx_shape_lines(shape) -> List[str]:
    """Recursively extracts paragraph/table text lines from PPTX shapes, tables, and groups."""
    lines: List[str] = []
    if getattr(shape, "has_text_frame", False):
        for paragraph in shape.text_frame.paragraphs:
            text = paragraph.text.strip()
            if text:
                lines.append(text)
    if getattr(shape, "has_table", False):
        for row in shape.table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                lines.append(row_text)
    if hasattr(shape, "shapes"):
        for child in shape.shapes:
            lines.extend(_extract_pptx_shape_lines(child))
    return lines


def convert_docx_to_pdf(docx_path: Path, pdf_path: Path) -> Path:
    """Converts a DOCX file to PDF using python-docx and reportlab."""
    doc = _open_docx(docx_path)
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
    doc = _open_docx(docx_path)
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
    prs = _open_pptx(pptx_path)
    pdf_doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for idx, slide in enumerate(prs.slides, start=1):
        story.append(Paragraph(f"<b>Slide {idx}</b>", styles["Heading3"]))
        slide_lines: List[str] = []
        for shape in slide.shapes:
            slide_lines.extend(_extract_pptx_shape_lines(shape))

        if slide_lines:
            for line in slide_lines:
                story.append(Paragraph(_safe_para_text(line), styles["Normal"]))
                story.append(Spacer(1, 4))
        else:
            story.append(Paragraph("<i>(Visual slide)</i>", styles["Normal"]))
        story.append(Spacer(1, 14))

    if not story:
        story.append(Paragraph("Empty Presentation", styles["Normal"]))

    pdf_doc.build(story)
    return pdf_path


def convert_pptx_to_txt(pptx_path: Path, txt_path: Path) -> Path:
    """Extracts text from a PPTX presentation to a plain UTF-8 text file."""
    prs = _open_pptx(pptx_path)
    blocks = []
    for idx, slide in enumerate(prs.slides, start=1):
        slide_lines = [f"--- Slide {idx} ---"]
        for shape in slide.shapes:
            slide_lines.extend(_extract_pptx_shape_lines(shape))
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

    with open(txt_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        for line_num, line in enumerate(f, start=1):
            if line_num > MAX_TXT_PDF_LINES:
                raise ValueError(f"Text file exceeds maximum supported line limit for PDF conversion ({MAX_TXT_PDF_LINES} lines).")
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
    dpi: int = 300,
    quality: int = 90,
    width: Optional[int] = None,
    height: Optional[int] = None,
    maintain_aspect_ratio: bool = True,
    grayscale: bool = False,
    bg_color: Optional[str] = "#FFFFFF",
) -> List[Path]:
    """Extracts all pages from a PDF document as high-resolution images in any supported format."""
    img_format = validate_target_format(img_format, WRITABLE_IMAGE_FORMATS - {"pdf"})
    width, height, quality, dpi = validate_image_params(width, height, quality, dpi)
    doc = _open_valid_pdf(pdf_path)
    generated_files: List[Path] = []

    base_name = get_safe_stem(pdf_path.name, "document")

    try:
        for idx, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi, alpha=False)
            out_file = output_dir / f"{base_name}_page_{idx + 1}.{img_format}"

            if img_format == "png" and width is None and height is None and not grayscale:
                pix.save(str(out_file), "png")
            else:
                temp_png = output_dir / f"_tmp_{base_name}_{idx + 1}.png"
                pix.save(str(temp_png), "png")
                try:
                    convert_single_image(
                        input_path=temp_png,
                        output_path=out_file,
                        target_format=img_format,
                        quality=quality,
                        width=width,
                        height=height,
                        maintain_aspect_ratio=maintain_aspect_ratio,
                        dpi=dpi,
                        grayscale=grayscale,
                        bg_color=bg_color or "#FFFFFF",
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
