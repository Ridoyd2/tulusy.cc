import html as html_lib
import re
import statistics
import warnings
from pathlib import Path
from typing import List, Tuple
from xml.sax.saxutils import escape

import ebooklib
import markdown as md_lib
from bs4 import (
    BeautifulSoup,
    Comment,
    Doctype,
    NavigableString,
    ProcessingInstruction,
    Tag,
    XMLParsedAsHTMLWarning,
)
from docx import Document
from ebooklib import epub
from striprtf.striprtf import rtf_to_text

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

from app.config import MAX_PDF_PAGES
from app.services.pdf_service import _open_docx, _open_valid_pdf, convert_txt_to_pdf
from app.services.utils import strip_xml_control_chars


MAX_EPUB_CHAPTERS = 500
MAX_EPUB_CHARS = 10_000_000

_DEFAULT_HTML_CSS = """
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.6; max-width: 780px; margin: 32px auto; padding: 0 20px; }
h1, h2, h3, h4 { color: #0f172a; margin-top: 1.4em; margin-bottom: 0.5em; line-height: 1.3; }
p { margin: 0.65em 0; }
pre, code { font-family: Consolas, Monaco, monospace; background: #f1f5f9; border-radius: 4px; }
code { padding: 2px 5px; font-size: 0.9em; }
pre { padding: 12px 14px; overflow-x: auto; }
blockquote { border-left: 3px solid #cbd5e1; margin: 1em 0; padding: 0.25em 1em; color: #475569; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
th { background: #f8fafc; }
""".strip()

_SAFE_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$", re.I)
_UNSAFE_STYLE_RE = re.compile(r"url\s*\(|expression\s*\(|@import", re.I)
_DOCX_CONTAINER_TAGS = {
    "html", "body", "div", "section", "article", "main", "header", "footer", "aside", "nav", "figure", "figcaption",
}
_DOCX_BLOCK_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "pre", "blockquote", "table", "div", "section", "article", "main"}


def _read_utf8_text(path: Path) -> str:
    return strip_xml_control_chars(path.read_text(encoding="utf-8-sig", errors="replace"))


def _wrap_html_document(title: str, body_html: str) -> str:
    safe_title = escape(title or "Document")
    return (
        "<!DOCTYPE html>\n"
        "<html lang=\"en\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\">\n"
        f"  <title>{safe_title}</title>\n"
        f"  <style>{_DEFAULT_HTML_CSS}</style>\n"
        "</head>\n"
        "<body>\n"
        f"{body_html}\n"
        "</body>\n"
        "</html>\n"
    )


def _sanitize_html_for_render(raw_html: str) -> str:
    """Strips active tags, CSS resource loads, XML PIs, control bytes, and unsafe URLs before rendering."""
    clean_input = re.sub(r"^\s*<\?xml[^>]*\?>\s*", "", strip_xml_control_chars(raw_html), flags=re.I)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", XMLParsedAsHTMLWarning)
        soup = BeautifulSoup(clean_input, "html.parser")

    for node in list(soup.find_all(string=lambda s: isinstance(s, (ProcessingInstruction, Comment, Doctype)))):
        node.extract()

    for tag in soup.find_all([
        "script", "style", "iframe", "object", "embed",
        "form", "meta", "link", "base", "svg", "math", "noscript", "template",
    ]):
        tag.decompose()

    for tag in soup.find_all(True):
        for attr in list(tag.attrs.keys()):
            attr_lower = attr.lower()
            if attr_lower.startswith("on"):
                del tag.attrs[attr]
            elif attr_lower == "style" and _UNSAFE_STYLE_RE.search(str(tag.attrs.get(attr) or "")):
                del tag.attrs[attr]
        if tag.name == "img":
            src = str(tag.get("src") or "").strip()
            if not _SAFE_DATA_IMAGE_RE.match(src):
                tag.decompose()
        elif tag.name == "a":
            href = str(tag.get("href") or "").strip()
            if href.lower().startswith(("javascript:", "vbscript:", "file:")):
                del tag.attrs["href"]

    body = soup.body
    return "".join(str(child) for child in body.contents) if body else str(soup)


def render_html_to_pdf(raw_html: str, pdf_path: Path) -> Path:
    """Renders sanitized HTML directly to a paginated PDF using PyMuPDF Story."""
    clean_body = _sanitize_html_for_render(raw_html).strip() or "<p></p>"
    doc_html = _wrap_html_document("Document", clean_body)
    mediabox = pymupdf.paper_rect("letter")
    where = mediabox + (42, 42, -42, -42)
    story = pymupdf.Story(html=doc_html)
    writer = pymupdf.DocumentWriter(str(pdf_path))
    try:
        more = 1
        page_count = 0
        while more:
            if page_count >= MAX_PDF_PAGES:
                raise ValueError(f"Rendered PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
            dev = writer.begin_page(mediabox)
            more, _ = story.place(where)
            story.draw(dev, None)
            writer.end_page()
            page_count += 1
    finally:
        writer.close()
    return pdf_path


def _html_node_to_markdown(node) -> str:
    if isinstance(node, NavigableString):
        return str(node)
    if not isinstance(node, Tag):
        return ""

    name = node.name.lower()
    if name in ("script", "style", "head", "meta", "link"):
        return ""

    inner = "".join(_html_node_to_markdown(c) for c in node.children)
    if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
        level = int(name[1])
        return f"\n\n{'#' * level} {inner.strip()}\n\n"
    if name == "p":
        return f"\n\n{inner.strip()}\n\n"
    if name == "br":
        return "  \n"
    if name == "hr":
        return "\n\n---\n\n"
    if name in ("strong", "b"):
        core = inner.strip()
        if not core:
            return ""
        lead = " " if inner[:1].isspace() else ""
        trail = " " if inner[-1:].isspace() else ""
        return f"{lead}**{core}**{trail}"
    if name in ("em", "i"):
        core = inner.strip()
        if not core:
            return ""
        lead = " " if inner[:1].isspace() else ""
        trail = " " if inner[-1:].isspace() else ""
        return f"{lead}*{core}*{trail}"
    if name == "code" and node.parent and node.parent.name != "pre":
        return f"`{inner.strip()}`"
    if name == "pre":
        return f"\n\n```\n{node.get_text().strip()}\n```\n\n"
    if name == "blockquote":
        lines = [f"> {line}" for line in inner.strip().splitlines() if line.strip()]
        return "\n\n" + "\n".join(lines) + "\n\n"
    if name == "a":
        href = str(node.get("href") or "").strip()
        label = inner.strip() or href
        return f"[{label}]({href})" if href else label
    if name == "li":
        return f"- {inner.strip()}\n"
    if name in ("ul", "ol"):
        return f"\n{inner}\n"
    if name == "table":
        rows = []
        for tr in node.find_all("tr"):
            cells = [c.get_text(" ", strip=True).replace("|", "\\|") for c in tr.find_all(["th", "td"])]
            if cells:
                rows.append("| " + " | ".join(cells) + " |")
        if len(rows) >= 1:
            col_count = rows[0].count("|") - 1
            sep = "| " + " | ".join(["---"] * max(1, col_count)) + " |"
            rows.insert(1, sep)
        return "\n\n" + "\n".join(rows) + "\n\n" if rows else ""
    return inner


def html_to_markdown_text(raw_html: str) -> str:
    """Converts HTML markup to readable Markdown text."""
    soup = BeautifulSoup(_sanitize_html_for_render(raw_html), "html.parser")
    text = "".join(_html_node_to_markdown(c) for c in soup.contents)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def html_to_plain_text(raw_html: str) -> str:
    """Extracts clean plain text from HTML."""
    soup = BeautifulSoup(_sanitize_html_for_render(raw_html), "html.parser")
    lines = [line.strip() for line in soup.get_text("\n").splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _extract_li_own_text(li_tag: Tag) -> str:
    """Extracts text owned directly by an <li> without pulling in nested <ul>/<ol> sub-lists."""
    chunks: List[str] = []
    for child in li_tag.children:
        if isinstance(child, Tag) and child.name and child.name.lower() in ("ul", "ol"):
            continue
        txt = child.get_text(" ", strip=True) if isinstance(child, Tag) else str(child).strip()
        if txt:
            chunks.append(txt)
    return " ".join(chunks).strip()


def _has_docx_block_descendant(tag: Tag) -> bool:
    return any(
        isinstance(d, Tag) and d.name and d.name.lower() in _DOCX_BLOCK_TAGS
        for d in tag.descendants
    )


def _walk_docx_blocks(container: Tag, doc: Document) -> bool:
    """Recursively emits DOCX paragraphs, headings, lists, tables, and inline runs without nesting duplication."""
    wrote = False
    inline_buf: List[str] = []

    def flush_inline() -> None:
        nonlocal wrote
        if not inline_buf:
            return
        combined = " ".join("".join(inline_buf).split()).strip()
        inline_buf.clear()
        if combined:
            doc.add_paragraph(combined)
            wrote = True

    for child in container.children:
        if isinstance(child, NavigableString):
            inline_buf.append(str(child))
            continue
        if not isinstance(child, Tag) or not child.name:
            continue

        name = child.name.lower()
        if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            flush_inline()
            text = child.get_text(" ", strip=True)
            if text:
                doc.add_heading(text, level=min(int(name[1]), 4))
                wrote = True
        elif name in ("p", "pre", "blockquote"):
            flush_inline()
            text = child.get_text() if name == "pre" else child.get_text(" ", strip=True)
            if text.strip():
                doc.add_paragraph(text if name == "pre" else text.strip())
                wrote = True
        elif name in ("ul", "ol"):
            flush_inline()
            list_style = "List Number" if name == "ol" else "List Bullet"
            for li in child.find_all("li", recursive=False):
                own_text = _extract_li_own_text(li)
                if own_text:
                    doc.add_paragraph(own_text, style=list_style)
                    wrote = True
                for sub_list in li.find_all(["ul", "ol"], recursive=False):
                    if _walk_docx_blocks(sub_list, doc):
                        wrote = True
        elif name == "li":
            flush_inline()
            own_text = _extract_li_own_text(child)
            if own_text:
                doc.add_paragraph(own_text, style="List Bullet")
                wrote = True
            for sub_list in child.find_all(["ul", "ol"], recursive=False):
                if _walk_docx_blocks(sub_list, doc):
                    wrote = True
        elif name == "table":
            flush_inline()
            rows = child.find_all("tr")
            if rows:
                cols = max(len(r.find_all(["th", "td"])) for r in rows)
                if cols > 0:
                    tbl = doc.add_table(rows=len(rows), cols=cols)
                    for r_idx, tr in enumerate(rows):
                        for c_idx, cell in enumerate(tr.find_all(["th", "td"])[:cols]):
                            tbl.cell(r_idx, c_idx).text = cell.get_text(" ", strip=True)
                    wrote = True
        elif name == "br":
            inline_buf.append("\n")
        elif name == "hr":
            flush_inline()
        elif _has_docx_block_descendant(child):
            flush_inline()
            if _walk_docx_blocks(child, doc):
                wrote = True
        elif name in _DOCX_CONTAINER_TAGS:
            flush_inline()
            text = child.get_text(" ", strip=True)
            if text:
                doc.add_paragraph(text)
                wrote = True
        else:
            inline_buf.append(child.get_text(" ", strip=False))

    flush_inline()
    return wrote


def _write_html_to_docx(raw_html: str, docx_path: Path) -> Path:
    """Builds a structured Word (.docx) document from sanitized HTML elements."""
    soup = BeautifulSoup(_sanitize_html_for_render(raw_html), "html.parser")
    doc = Document()
    wrote_block = _walk_docx_blocks(soup, doc)

    if not wrote_block:
        fallback_text = html_to_plain_text(raw_html)
        for line in fallback_text.splitlines():
            if line.strip():
                doc.add_paragraph(line.strip())

    doc.save(str(docx_path))
    return docx_path


def _write_html_to_epub(raw_html: str, epub_path: Path, title: str = "Converted Book") -> Path:
    """Packages sanitized HTML into a valid EPUB container."""
    clean_body = _sanitize_html_for_render(raw_html).strip() or "<p>Empty Document</p>"
    book = epub.EpubBook()
    book.set_identifier(f"tulusy-{epub_path.stem}")
    book.set_title(title or "Converted Book")
    book.set_language("en")

    chapter = epub.EpubHtml(title=title or "Content", file_name="chapter_1.xhtml", lang="en")
    chapter.content = (
        "<?xml version='1.0' encoding='utf-8'?>\n"
        "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n"
        f"<head><title>{escape(title or 'Content')}</title></head>\n"
        f"<body>{clean_body}</body>\n"
        "</html>"
    ).encode("utf-8")

    book.add_item(chapter)
    book.toc = (epub.Link("chapter_1.xhtml", title or "Content", "chap_1"),)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]
    epub.write_epub(str(epub_path), book)
    return epub_path


def _text_to_body_html(text: str) -> str:
    blocks = [f"<p>{html_lib.escape(line.strip())}</p>" for line in text.splitlines() if line.strip()]
    return "\n".join(blocks) or "<p></p>"


def _markdown_to_body_html(md_text: str) -> str:
    return md_lib.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists", "nl2br"])


def _read_epub_body_html(epub_path: Path) -> str:
    try:
        book = epub.read_epub(str(epub_path))
    except Exception as e:
        raise ValueError(f"Invalid or corrupted EPUB file: {e}")

    all_doc_items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
    non_nav_items = [
        item for item in all_doc_items
        if not isinstance(item, epub.EpubNav) and item.get_id() != "nav"
    ]
    selected_items = non_nav_items if non_nav_items else all_doc_items

    items_by_id = {item.get_id(): item for item in selected_items}
    ordered_items = []
    seen_ids = set()
    for spine_id, _ in getattr(book, "spine", []):
        if spine_id in items_by_id and spine_id not in seen_ids:
            ordered_items.append(items_by_id[spine_id])
            seen_ids.add(spine_id)
    for item_id, item in items_by_id.items():
        if item_id not in seen_ids:
            ordered_items.append(item)

    if len(ordered_items) > MAX_EPUB_CHAPTERS:
        raise ValueError(f"EPUB exceeds maximum supported chapter limit ({MAX_EPUB_CHAPTERS} chapters).")

    parts: List[str] = []
    total_chars = 0
    for item in ordered_items:
        raw_content = item.get_content()
        html_str = raw_content.decode("utf-8", errors="replace")
        total_chars += len(html_str)
        if total_chars > MAX_EPUB_CHARS:
            raise ValueError("EPUB content exceeds maximum supported unpacked text limit.")
        cleaned = _sanitize_html_for_render(html_str).strip()
        if cleaned:
            parts.append(cleaned)

    if not parts:
        raise ValueError("EPUB archive contains no readable text chapters.")
    return "\n<hr/>\n".join(parts)


def _docx_to_html_body(docx_path: Path) -> str:
    doc = _open_docx(docx_path)
    parts: List[str] = []
    for p in doc.paragraphs:
        txt = p.text.strip()
        if not txt:
            continue
        style_name = (p.style.name if p.style else "") or ""
        if style_name.startswith("Heading"):
            parts.append(f"<h2>{html_lib.escape(txt)}</h2>")
        else:
            parts.append(f"<p>{html_lib.escape(txt)}</p>")
    for tbl in doc.tables:
        rows_html = []
        for r_idx, row in enumerate(tbl.rows):
            tag = "th" if r_idx == 0 else "td"
            cells = "".join(f"<{tag}>{html_lib.escape(c.text.strip())}</{tag}>" for c in row.cells)
            rows_html.append(f"<tr>{cells}</tr>")
        if rows_html:
            parts.append(f"<table>{''.join(rows_html)}</table>")
    return "\n".join(parts) or "<p>Empty Document</p>"


def _bbox_in_tables(bbox: Tuple[float, float, float, float], table_bboxes: List[Tuple[float, float, float, float]]) -> bool:
    mx = (bbox[0] + bbox[2]) / 2.0
    my = (bbox[1] + bbox[3]) / 2.0
    return any((tb[0] - 2.0 <= mx <= tb[2] + 2.0) and (tb[1] - 2.0 <= my <= tb[3] + 2.0) for tb in table_bboxes)


def _pdf_to_html_body(pdf_path: Path) -> str:
    """Extracts semantic, reflowable headings, paragraphs, emphasis, and tables per PDF page."""
    doc = _open_valid_pdf(pdf_path)
    parts: List[str] = []
    try:
        for idx, page in enumerate(doc):
            rendered_tables: List[Tuple[float, float, str]] = []
            rendered_bboxes: List[Tuple[float, float, float, float]] = []

            try:
                found_tables = page.find_tables()
                table_objs = list(found_tables.tables) if found_tables and found_tables.tables else []
            except Exception:
                table_objs = []

            for tbl in table_objs:
                rows_data = tbl.extract() or []
                rows_html = []
                for r_idx, row in enumerate(rows_data):
                    cell_texts = [" ".join(strip_xml_control_chars(c).split()) for c in row]
                    if not any(cell_texts):
                        continue
                    tag = "th" if r_idx == 0 else "td"
                    cells = "".join(f"<{tag}>{html_lib.escape(txt)}</{tag}>" for txt in cell_texts)
                    rows_html.append(f"<tr>{cells}</tr>")
                if rows_html:
                    tb = tuple(tbl.bbox)
                    rendered_bboxes.append(tb)
                    rendered_tables.append((tb[1], tb[0], f"<table>{''.join(rows_html)}</table>"))

            text_dict = page.get_text("dict")
            blocks = [b for b in text_dict.get("blocks", []) if b.get("type") == 0]

            all_sizes = [
                round(float(span.get("size") or 11.0), 1)
                for block in blocks
                for line in block.get("lines", [])
                if not _bbox_in_tables(tuple(line.get("bbox", (0, 0, 0, 0))), rendered_bboxes)
                for span in line.get("spans", [])
                if strip_xml_control_chars(span.get("text")).strip()
            ]
            body_size = statistics.median(all_sizes) if all_sizes else 11.0

            page_items: List[Tuple[float, float, str]] = list(rendered_tables)
            for block in blocks:
                kept_lines = [
                    line
                    for line in block.get("lines", [])
                    if not _bbox_in_tables(tuple(line.get("bbox", (0, 0, 0, 0))), rendered_bboxes)
                ]
                if not kept_lines:
                    continue

                line_inline_parts: List[str] = []
                line_plain_parts: List[str] = []
                max_sz = 0.0
                for line in kept_lines:
                    span_inline: List[str] = []
                    span_plain: List[str] = []
                    for span in line.get("spans", []):
                        raw_txt = strip_xml_control_chars(span.get("text"))
                        if not raw_txt:
                            continue
                        span_plain.append(raw_txt)
                        sz = float(span.get("size") or body_size)
                        if raw_txt.strip():
                            max_sz = max(max_sz, sz)
                        esc = html_lib.escape(raw_txt)
                        flags = int(span.get("flags") or 0)
                        if esc.strip():
                            if flags & 16:
                                esc = f"<strong>{esc}</strong>"
                            if flags & 2:
                                esc = f"<em>{esc}</em>"
                        span_inline.append(esc)
                    joined_inline = "".join(span_inline).strip()
                    joined_plain = "".join(span_plain).strip()
                    if joined_inline and joined_plain:
                        line_inline_parts.append(joined_inline)
                        line_plain_parts.append(joined_plain)

                if not line_inline_parts:
                    continue

                first_bbox = kept_lines[0].get("bbox", block.get("bbox", (0, 0, 0, 0)))
                y0 = float(first_bbox[1])
                x0 = float(first_bbox[0])
                plain_text = " ".join(line_plain_parts).strip()

                if len(plain_text) <= 180 and max_sz >= max(15.0, body_size * 1.3):
                    page_items.append((y0, x0, f"<h2>{html_lib.escape(plain_text)}</h2>"))
                elif len(plain_text) <= 180 and max_sz >= max(13.0, body_size * 1.15):
                    page_items.append((y0, x0, f"<h3>{html_lib.escape(plain_text)}</h3>"))
                else:
                    page_items.append((y0, x0, f"<p>{' '.join(line_inline_parts)}</p>"))

            if page_items:
                page_items.sort(key=lambda it: (round(it[0], 1), round(it[1], 1)))
                parts.append(f"<section data-page='{idx + 1}'>\n" + "\n".join(x[2] for x in page_items) + "\n</section>")
    finally:
        doc.close()
    return "\n<hr/>\n".join(parts) or "<p></p>"


def convert_markup_or_ebook(input_path: Path, source_ext: str, target_ext: str, output_path: Path) -> Path:
    """
    Unified converter across Markdown, HTML, RTF, EPUB, and text/HTML projections of PDF, DOCX, TXT.
    """
    src = source_ext.lower().lstrip(".")
    tgt = target_ext.lower().lstrip(".")
    title = input_path.stem

    # Normalize source into a sanitized body HTML fragment
    if src == "md":
        body_html = _markdown_to_body_html(_read_utf8_text(input_path))
    elif src in ("html", "htm"):
        body_html = _sanitize_html_for_render(_read_utf8_text(input_path))
    elif src == "rtf":
        plain_text = strip_xml_control_chars(rtf_to_text(_read_utf8_text(input_path), errors="ignore"))
        if tgt == "txt":
            output_path.write_text(plain_text, encoding="utf-8")
            return output_path
        if tgt == "md":
            output_path.write_text(plain_text.strip(), encoding="utf-8")
            return output_path
        body_html = _text_to_body_html(plain_text)
    elif src == "epub":
        body_html = _read_epub_body_html(input_path)
    elif src == "docx":
        body_html = _docx_to_html_body(input_path)
    elif src == "pdf":
        body_html = _pdf_to_html_body(input_path)
    elif src == "txt":
        raw_txt = _read_utf8_text(input_path)
        if tgt == "md":
            output_path.write_text(raw_txt, encoding="utf-8")
            return output_path
        body_html = _text_to_body_html(raw_txt)
    else:
        raise ValueError(f"Unsupported markup/ebook source format: .{src}")

    if tgt == "html":
        output_path.write_text(_wrap_html_document(title, body_html), encoding="utf-8")
        return output_path
    if tgt == "md":
        output_path.write_text(html_to_markdown_text(body_html), encoding="utf-8")
        return output_path
    if tgt == "txt":
        output_path.write_text(html_to_plain_text(body_html), encoding="utf-8")
        return output_path
    if tgt == "pdf":
        if src == "txt":
            return convert_txt_to_pdf(input_path, output_path)
        return render_html_to_pdf(body_html, output_path)
    if tgt == "docx":
        return _write_html_to_docx(body_html, output_path)
    if tgt == "epub":
        return _write_html_to_epub(body_html, output_path, title=title)

    raise ValueError(f"Unsupported conversion from .{src} to .{tgt}")
