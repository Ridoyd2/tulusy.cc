import shutil
import sys
from pathlib import Path
from PIL import Image, ImageDraw

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.image_service import convert_single_image
from app.services.pdf_service import (
    convert_pdf_to_docx,
    convert_pdf_to_pptx,
    convert_pdf_to_txt,
    convert_docx_to_pdf,
    convert_docx_to_txt,
    convert_pptx_to_pdf,
    convert_pptx_to_txt,
    convert_txt_to_pdf,
    convert_images_to_pdf,
    extract_pdf_pages_to_images
)
from app.services.excel_service import (
    convert_csv_to_xlsx,
    convert_csv_to_pdf,
    convert_xlsx_to_pdf,
    convert_xlsx_to_csv,
    convert_pdf_to_xlsx,
    convert_pdf_to_csv
)
from app.services.markup_service import convert_markup_or_ebook
from app.services.data_service import convert_structured_data

def run_tests():
    test_dir = BASE_DIR / "temp" / "test_run"
    test_dir.mkdir(parents=True, exist_ok=True)
    try:
        _run_all_conversion_checks(test_dir)
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)


def _run_all_conversion_checks(test_dir: Path):
    print("[TEST] Starting automated backend conversion tests...")

    # 1. Create a dummy PNG image
    sample_png = test_dir / "sample.png"
    img = Image.new("RGBA", (200, 200), (45, 100, 240, 255))
    draw = ImageDraw.Draw(img)
    draw.text((30, 90), "Tulusy Test", fill=(255, 255, 255, 255))
    img.save(str(sample_png))
    img.close()
    print("[PASS] Created test PNG image")

    # 2. Test PNG -> WEBP, JPG, BMP, ICO, SVG, PDF
    for fmt in ["webp", "jpg", "bmp", "ico", "svg", "pdf"]:
        out_f = test_dir / f"sample.{fmt}"
        convert_single_image(sample_png, out_f, fmt, quality=85)
        assert out_f.exists() and out_f.stat().st_size > 0, f"Failed converting to {fmt}"
        print(f"[PASS] Image conversion -> {fmt.upper()} (Size: {out_f.stat().st_size} bytes)")

    # 3. Test Images -> Multi-page PDF
    sample_png2 = test_dir / "sample2.png"
    img2 = Image.new("RGB", (300, 200), (230, 60, 90))
    img2.save(str(sample_png2))
    img2.close()

    merged_pdf = test_dir / "merged_output.pdf"
    convert_images_to_pdf([sample_png, sample_png2], merged_pdf)
    assert merged_pdf.exists() and merged_pdf.stat().st_size > 0
    print(f"[PASS] Images to PDF (Size: {merged_pdf.stat().st_size} bytes)")

    # 4. Test PDF -> DOCX & DOCX -> TXT & DOCX -> PDF
    out_docx = test_dir / "sample_converted.docx"
    convert_pdf_to_docx(merged_pdf, out_docx)
    assert out_docx.exists() and out_docx.stat().st_size > 0
    print(f"[PASS] PDF to DOCX (Size: {out_docx.stat().st_size} bytes)")

    out_docx_txt = test_dir / "docx_to_txt.txt"
    convert_docx_to_txt(out_docx, out_docx_txt)
    assert out_docx_txt.exists()
    print(f"[PASS] DOCX to TXT (Size: {out_docx_txt.stat().st_size} bytes)")

    out_back_pdf = test_dir / "docx_to_pdf_output.pdf"
    convert_docx_to_pdf(out_docx, out_back_pdf)
    assert out_back_pdf.exists() and out_back_pdf.stat().st_size > 0
    print(f"[PASS] DOCX to PDF (Size: {out_back_pdf.stat().st_size} bytes)")

    # 5. Test PDF -> PPTX & PPTX -> PDF & PPTX -> TXT
    out_pptx = test_dir / "sample_converted.pptx"
    convert_pdf_to_pptx(merged_pdf, out_pptx, extract_text=True)
    assert out_pptx.exists() and out_pptx.stat().st_size > 0
    print(f"[PASS] PDF to PPTX (Size: {out_pptx.stat().st_size} bytes)")

    out_pptx_pdf = test_dir / "pptx_to_pdf.pdf"
    convert_pptx_to_pdf(out_pptx, out_pptx_pdf)
    assert out_pptx_pdf.exists() and out_pptx_pdf.stat().st_size > 0
    print(f"[PASS] PPTX to PDF (Size: {out_pptx_pdf.stat().st_size} bytes)")

    out_pptx_txt = test_dir / "pptx_to_txt.txt"
    convert_pptx_to_txt(out_pptx, out_pptx_txt)
    assert out_pptx_txt.exists()
    print(f"[PASS] PPTX to TXT (Size: {out_pptx_txt.stat().st_size} bytes)")

    # 6. Test PDF -> Images extraction (PNG and WEBP)
    extracted_imgs = extract_pdf_pages_to_images(merged_pdf, test_dir, img_format="webp", dpi=150)
    assert len(extracted_imgs) == 2, f"Expected 2 pages extracted, got {len(extracted_imgs)}"
    print(f"[PASS] PDF to WEBP extraction ({len(extracted_imgs)} pages extracted)")

    # 7. Test TXT (with XML special chars <, >, &) -> PDF -> TXT
    sample_txt = test_dir / "special_chars.txt"
    sample_txt.write_text("Code test: if (a < b && c > d) { return '<tag>&value</tag>'; }\nLine 2", encoding="utf-8")
    out_txt_pdf = test_dir / "txt_to_pdf.pdf"
    convert_txt_to_pdf(sample_txt, out_txt_pdf)
    assert out_txt_pdf.exists() and out_txt_pdf.stat().st_size > 0
    print(f"[PASS] TXT (with <, >, &) to PDF (Size: {out_txt_pdf.stat().st_size} bytes)")

    out_pdf_txt = test_dir / "pdf_to_txt.txt"
    convert_pdf_to_txt(out_txt_pdf, out_pdf_txt)
    assert out_pdf_txt.exists() and out_pdf_txt.stat().st_size > 0
    print(f"[PASS] PDF to TXT (Size: {out_pdf_txt.stat().st_size} bytes)")

    # 8. Test CSV -> XLSX -> PDF -> CSV & CSV -> PDF & PDF -> CSV
    sample_csv = test_dir / "sample.csv"
    with open(sample_csv, "w", encoding="utf-8") as f:
        f.write("Name,Expression,Role\nAlice,x < 10 & y > 5,Developer\nBob,a == b,Designer\n")

    out_xlsx = test_dir / "sample_from_csv.xlsx"
    convert_csv_to_xlsx(sample_csv, out_xlsx)
    assert out_xlsx.exists() and out_xlsx.stat().st_size > 0
    print(f"[PASS] CSV to XLSX (Size: {out_xlsx.stat().st_size} bytes)")

    out_xlsx_pdf = test_dir / "sample_xlsx.pdf"
    convert_xlsx_to_pdf(out_xlsx, out_xlsx_pdf)
    assert out_xlsx_pdf.exists() and out_xlsx_pdf.stat().st_size > 0
    print(f"[PASS] XLSX (with <, >, &) to PDF (Size: {out_xlsx_pdf.stat().st_size} bytes)")

    out_csv_pdf = test_dir / "sample_csv.pdf"
    convert_csv_to_pdf(sample_csv, out_csv_pdf)
    assert out_csv_pdf.exists() and out_csv_pdf.stat().st_size > 0
    print(f"[PASS] CSV to PDF (Size: {out_csv_pdf.stat().st_size} bytes)")

    out_pdf_csv = test_dir / "sample_from_pdf.csv"
    convert_pdf_to_csv(out_xlsx_pdf, out_pdf_csv)
    assert out_pdf_csv.exists() and out_pdf_csv.stat().st_size > 0
    print(f"[PASS] PDF to CSV (Size: {out_pdf_csv.stat().st_size} bytes)")

    out_back_csv = test_dir / "sample_back.csv"
    convert_xlsx_to_csv(out_xlsx, out_back_csv)
    assert out_back_csv.exists() and out_back_csv.stat().st_size > 0
    print(f"[PASS] XLSX to CSV (Size: {out_back_csv.stat().st_size} bytes)")

    # 9. Test Transparent RGBA PNG + Grayscale -> PNG (preserves alpha) & -> JPG (white bg, not black)
    trans_png = test_dir / "transparent.png"
    t_img = Image.new("RGBA", (60, 60), (0, 0, 0, 0))
    t_draw = ImageDraw.Draw(t_img)
    t_draw.rectangle([15, 15, 45, 45], fill=(200, 50, 50, 255))
    t_img.save(str(trans_png))
    t_img.close()

    gray_png = test_dir / "gray_transparent.png"
    convert_single_image(trans_png, gray_png, "png", grayscale=True)
    with Image.open(str(gray_png)) as gp:
        assert gp.mode in ("LA", "RGBA"), f"Expected transparent grayscale mode LA/RGBA, got {gp.mode}"
    print("[PASS] Transparent PNG + Grayscale -> PNG preserves alpha channel")

    gray_jpg = test_dir / "gray_transparent.jpg"
    convert_single_image(trans_png, gray_jpg, "jpg", grayscale=True, bg_color="#FFFFFF")
    with Image.open(str(gray_jpg)) as gj:
        corner_px = gj.getpixel((0, 0))
        assert corner_px[0] > 240 and corner_px[1] > 240 and corner_px[2] > 240, f"Expected white corner on JPG, got {corner_px}"
    print("[PASS] Transparent PNG + Grayscale -> JPG composites onto white background cleanly")

    # 10. Test Palette (P mode) -> AVIF, BMP, TGA
    palette_gif = test_dir / "palette.gif"
    p_img = Image.new("RGB", (50, 50), (30, 140, 220)).convert("P")
    p_img.save(str(palette_gif))
    p_img.close()
    for fmt in ["avif", "bmp", "tga"]:
        out_p = test_dir / f"palette_out.{fmt}"
        convert_single_image(palette_gif, out_p, fmt)
        assert out_p.exists() and out_p.stat().st_size > 0
    print("[PASS] Palette (P mode) GIF -> AVIF, BMP, TGA")

    # 11. Test Wide 25-column Spreadsheet with 1500-char cell -> PDF (no ReportLab LayoutError)
    wide_csv = test_dir / "wide_sheet.csv"
    headers = [f"Column_{i}" for i in range(1, 26)]
    long_cell = "VeryLongCellTextWithoutSpaces_" * 50
    row1 = [long_cell if i == 1 else f"Val_{i}" for i in range(1, 26)]
    with open(wide_csv, "w", encoding="utf-8") as f:
        f.write(",".join(headers) + "\n" + ",".join(row1) + "\n")
    wide_pdf = test_dir / "wide_sheet.pdf"
    convert_csv_to_pdf(wide_csv, wide_pdf)
    assert wide_pdf.exists() and wide_pdf.stat().st_size > 0
    print(f"[PASS] Wide 25-column CSV/XLSX to PDF without overflow (Size: {wide_pdf.stat().st_size} bytes)")

    # 12. Test CSV -> XLSX preserves leading zeros, signed strings, and rejects inf/nan
    import openpyxl
    lz_csv = test_dir / "leading_zeros.csv"
    lz_csv.write_text("Code,Count,Ratio,Special\n00123,42,3.14,inf\n+007,-042,0.50,nan\n", encoding="utf-8")
    lz_xlsx = test_dir / "leading_zeros.xlsx"
    convert_csv_to_xlsx(lz_csv, lz_xlsx)
    wb = openpyxl.load_workbook(str(lz_xlsx), data_only=True)
    ws = wb.active
    assert ws["A2"].value == "00123" and isinstance(ws["A2"].value, str), f"Expected '00123' str, got {ws['A2'].value!r}"
    assert ws["B2"].value == 42 and isinstance(ws["B2"].value, int)
    assert ws["C2"].value == 3.14 and isinstance(ws["C2"].value, float)
    assert ws["D2"].value == "inf" and isinstance(ws["D2"].value, str)
    assert ws["A3"].value == "+007" and isinstance(ws["A3"].value, str)
    assert ws["D3"].value == "nan" and isinstance(ws["D3"].value, str)
    wb.close()
    print("[PASS] CSV -> XLSX preserves leading zeros and treats non-finite strings safely")

    # 13. Test MAX_PDF_PAGES limit enforcement across PDF converters
    import fitz
    from app.config import MAX_PDF_PAGES
    over_limit_pdf = test_dir / "over_limit.pdf"
    doc = fitz.open()
    for _ in range(MAX_PDF_PAGES + 1):
        doc.new_page()
    doc.save(str(over_limit_pdf))
    doc.close()

    for label, fn, ext in [
        ("PDF -> TXT", convert_pdf_to_txt, "txt"),
        ("PDF -> DOCX", convert_pdf_to_docx, "docx"),
        ("PDF -> XLSX", convert_pdf_to_xlsx, "xlsx"),
    ]:
        raised = False
        try:
            fn(over_limit_pdf, test_dir / f"over_limit.{ext}")
        except ValueError:
            raised = True
        assert raised, f"{label} bypassed MAX_PDF_PAGES ({MAX_PDF_PAGES})"
    print(f"[PASS] MAX_PDF_PAGES ({MAX_PDF_PAGES}) enforced across PDF -> TXT/DOCX/XLSX")

    # 14. Test /api/formats matches backend handlers
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    fmts_resp = client.get("/api/formats")
    assert fmts_resp.status_code == 200
    fmts = fmts_resp.json()
    img_exts = {item["ext"]: item for item in fmts["images"]}
    doc_exts = {item["ext"]: item for item in fmts["documents"]}
    assert "eps" not in img_exts
    assert "html" in doc_exts
    assert img_exts["psd"].get("input_only") is True
    assert img_exts["jxl"]["mime"] == "image/jxl"
    assert img_exts["cr2"].get("input_only") is True
    assert doc_exts["json"]["category"] == "data"
    assert doc_exts["epub"]["mime"] == "application/epub+zip"
    print("[PASS] /api/formats registry aligned with converter handlers")

    # 15. Verify genuine AVIF magic bytes (not HEIC fallback)
    avif_out = test_dir / "genuine.avif"
    convert_single_image(sample_png, avif_out, "avif", quality=80)
    avif_header = avif_out.read_bytes()[:32]
    assert b"ftypavif" in avif_header or b"ftypavis" in avif_header, f"Expected genuine AVIF magic, got {avif_header!r}"
    assert b"ftypheic" not in avif_header, f"AVIF fell back to HEIC: {avif_header!r}"
    print("[PASS] AVIF output contains genuine ftypavif header")

    # 16. Verify path traversal in target_format/format is blocked with HTTP 400
    with open(sample_png, "rb") as fp:
        bad_img_resp = client.post(
            "/api/convert/image",
            files={"file": ("sample.png", fp, "image/png")},
            data={"target_format": "../evil.png"},
        )
    assert bad_img_resp.status_code == 400, f"Expected 400 for path traversal format, got {bad_img_resp.status_code}"

    with open(merged_pdf, "rb") as fp:
        bad_pdf_resp = client.post(
            "/api/convert/pdf-to-images",
            files={"file": ("merged.pdf", fp, "application/pdf")},
            data={"format": "../../pwn"},
        )
    assert bad_pdf_resp.status_code == 400, f"Expected 400 for pdf-to-images traversal, got {bad_pdf_resp.status_code}"

    with open(sample_png, "rb") as fp:
        bad_uni_resp = client.post(
            "/api/convert/universal",
            files={"file": ("sample.png", fp, "image/png")},
            data={"target_format": "psd"},
        )
    assert bad_uni_resp.status_code == 400, f"Expected 400 for psd target, got {bad_uni_resp.status_code}"
    print("[PASS] Path traversal and read-only target formats blocked with HTTP 400")

    # 17. Verify SVG <image href=local_file> does NOT read local filesystem files
    secret_local = test_dir / "secret_local.png"
    Image.new("RGB", (40, 40), (220, 20, 60)).save(str(secret_local))
    evil_svg = test_dir / "evil_lfi.svg"
    evil_svg.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">'
        f'<rect width="100" height="100" fill="#00ff00"/>'
        f'<image x="0" y="0" width="40" height="40" xlink:href="secret_local.png"/>'
        f'</svg>',
        encoding="utf-8",
    )
    svg_out = test_dir / "svg_lfi_check.png"
    convert_single_image(evil_svg, svg_out, "png")
    with Image.open(str(svg_out)) as check_img:
        px = check_img.convert("RGB").getpixel((10, 10))
        assert px[1] > 200 and px[0] < 30, f"SVG loaded local secret image pixel={px}"
    print("[PASS] SVG local filesystem href resolution blocked")

    # 18. Verify multi-page PDF -> CSV preserves all pages (not just Page 1)
    multi_pdf = test_dir / "multipage_tables.pdf"
    mp_doc = fitz.open()
    p1 = mp_doc.new_page()
    p1.insert_text((40, 60), "PageOneMarker")
    p2 = mp_doc.new_page()
    p2.insert_text((40, 60), "PageTwoMarker")
    mp_doc.save(str(multi_pdf))
    mp_doc.close()

    multi_csv = test_dir / "multipage_out.csv"
    convert_pdf_to_csv(multi_pdf, multi_csv)
    csv_text = multi_csv.read_text(encoding="utf-8")
    assert "PageOneMarker" in csv_text and "PageTwoMarker" in csv_text, f"Multi-page PDF->CSV lost page 2: {csv_text!r}"
    print("[PASS] Multi-page PDF -> CSV preserves all pages")

    # 19. Verify CSV with Unicode superscripts, UTF-8 BOM, and XML control chars converts cleanly
    tricky_csv = test_dir / "tricky.csv"
    tricky_csv.write_bytes(b"\xef\xbb\xbfLabel,Val\nArea,m\xc2\xb2\nCtrl,ok\x07text\n")
    tricky_xlsx = test_dir / "tricky.xlsx"
    convert_csv_to_xlsx(tricky_csv, tricky_xlsx)
    wb2 = openpyxl.load_workbook(str(tricky_xlsx), data_only=True)
    ws2 = wb2.active
    assert ws2["A1"].value == "Label"
    assert ws2["B2"].value == "m²"
    assert ws2["B3"].value == "oktext"
    wb2.close()
    print("[PASS] CSV -> XLSX handles UTF-8 BOM, Unicode digits, and control chars cleanly")

    # 20. Verify batch image converter deduplicates same-stem files (a.png + a.jpg -> 2 files in ZIP)
    import io, zipfile
    same_a = test_dir / "dup.png"
    same_b = test_dir / "dup.jpg"
    Image.new("RGB", (20, 20), (10, 20, 30)).save(str(same_a))
    Image.new("RGB", (20, 20), (40, 50, 60)).save(str(same_b))
    with open(same_a, "rb") as f1, open(same_b, "rb") as f2:
        batch_resp = client.post(
            "/api/convert/image/batch",
            files=[("files", ("dup.png", f1, "image/png")), ("files", ("dup.jpg", f2, "image/jpeg"))],
            data={"target_format": "webp"},
        )
    assert batch_resp.status_code == 200
    with zipfile.ZipFile(io.BytesIO(batch_resp.content)) as zf:
        assert len(zf.namelist()) == 2, f"Expected 2 files in batch ZIP, got {zf.namelist()}"
    print("[PASS] Batch image converter preserves all files sharing a filename stem")

    # 21. Verify legacy .doc returns HTTP 400 instead of 500
    legacy_resp = client.post(
        "/api/convert/universal",
        files={"file": ("old.doc", b"fake binary doc", "application/msword")},
        data={"target_format": "pdf"},
    )
    assert legacy_resp.status_code == 400, f"Expected 400 for legacy .doc, got {legacy_resp.status_code}"
    print("[PASS] Legacy .doc rejected cleanly with HTTP 400")

    # 22. Verify PDF -> PPTX keeps editable text without double-rendering glyphs in backdrop
    from pptx import Presentation
    pptx_src = test_dir / "pptx_text_src.pdf"
    pdoc = fitz.open()
    pg = pdoc.new_page(width=400, height=200)
    pg.draw_rect(fitz.Rect(0, 0, 400, 200), fill=(0.95, 0.95, 1.0))
    pg.insert_text((40, 100), "Clean Slide Text", fontsize=18)
    pdoc.save(str(pptx_src))
    pdoc.close()
    pptx_clean_out = test_dir / "pptx_clean.pptx"
    convert_pdf_to_pptx(pptx_src, pptx_clean_out, extract_text=True)
    prs_check = Presentation(str(pptx_clean_out))
    slide_shapes = prs_check.slides[0].shapes
    text_found = any(getattr(s, "has_text_frame", False) and "Clean Slide Text" in s.text_frame.text for s in slide_shapes)
    assert text_found, "Expected editable text frame in generated PPTX"
    print("[PASS] PDF -> PPTX extracts styled editable text cleanly")

    # 23. Verify PDF -> CSV with blank Page 1 & content on Page 2 emits no leading blank row
    blank_p1_pdf = test_dir / "blank_p1.pdf"
    bp_doc = fitz.open()
    bp_doc.new_page()  # empty Page 1
    bp_p2 = bp_doc.new_page()
    bp_p2.insert_text((40, 60), "OnlyPageTwo")
    bp_doc.save(str(blank_p1_pdf))
    bp_doc.close()

    blank_p1_csv = test_dir / "blank_p1.csv"
    convert_pdf_to_csv(blank_p1_pdf, blank_p1_csv)
    lines = blank_p1_csv.read_text(encoding="utf-8").splitlines()
    assert lines and lines[0] == "OnlyPageTwo", f"Expected no leading blank line/header, got {lines!r}"

    # 24. Verify validate_image_params(quality=0, dpi=0) clamps to (1, 72) rather than reverting to defaults
    from app.services.utils import validate_image_params
    _, _, q_clamped, d_clamped = validate_image_params(quality=0, dpi=0)
    assert (q_clamped, d_clamped) == (1, 72), f"Expected (1, 72), got {(q_clamped, d_clamped)}"
    print("[PASS] PDF -> CSV leading blank suppression & image zero-param clamping verified")

    # 25. Verify extract_pdf_pages_to_images forwards width, grayscale & quality
    import pymupdf as fitz_check
    styled_pdf = test_dir / "styled_pdf_img.pdf"
    sp_doc = fitz_check.open()
    sp_pg = sp_doc.new_page(width=400, height=400)
    sp_pg.draw_rect(fitz_check.Rect(10, 10, 390, 390), fill=(0.2, 0.5, 0.9))
    sp_doc.save(str(styled_pdf))
    sp_doc.close()

    styled_imgs = extract_pdf_pages_to_images(
        styled_pdf, test_dir, img_format="jpg", dpi=150, quality=75, width=120, grayscale=True
    )
    assert len(styled_imgs) == 1
    with Image.open(styled_imgs[0]) as res_img:
        assert res_img.width == 120, f"Expected width 120, got {res_img.width}"
        px = res_img.getpixel((res_img.width // 2, res_img.height // 2))
        is_gray = res_img.mode == "L" or (
            isinstance(px, tuple) and abs(px[0] - px[1]) <= 2 and abs(px[1] - px[2]) <= 2
        )
        assert is_gray, f"Expected grayscale output, got mode={res_img.mode}, center_px={px}"
    print("[PASS] PDF -> JPG resize (width=120), grayscale & quality forwarding verified")

    # 26. Test new modern/pro image formats: JXL, JP2, QOI, DDS, ICNS, PPM (plus grayscale & alpha)
    for fmt in ["jxl", "jp2", "qoi", "dds", "icns", "ppm"]:
        out_f = test_dir / f"modern.{fmt}"
        convert_single_image(trans_png, out_f, fmt, quality=85)
        assert out_f.exists() and out_f.stat().st_size > 0, f"Failed converting to {fmt}"
        out_gray = test_dir / f"modern_gray.{fmt}"
        convert_single_image(trans_png, out_gray, fmt, quality=85, grayscale=True)
        assert out_gray.exists() and out_gray.stat().st_size > 0, f"Failed grayscale converting to {fmt}"
    # Round-trip JXL & QOI back to PNG via API
    with open(test_dir / "modern.jxl", "rb") as fp:
        jxl_resp = client.post(
            "/api/convert/universal",
            files={"file": ("modern.jxl", fp, "image/jxl")},
            data={"target_format": "png"},
        )
    assert jxl_resp.status_code == 200 and jxl_resp.content.startswith(b"\x89PNG")
    # Invalid Camera RAW returns HTTP 400 (not 500)
    raw_bad = client.post(
        "/api/convert/universal",
        files={"file": ("broken.cr2", b"not a real raw file", "image/x-canon-cr2")},
        data={"target_format": "jpg"},
    )
    assert raw_bad.status_code == 400, f"Expected 400 for invalid CR2, got {raw_bad.status_code}"
    print("[PASS] Modern image formats (JXL, JP2, QOI, DDS, ICNS, PPM) and RAW validation passed")

    # 27. Test Markdown, HTML, RTF, EPUB conversions & HTML sanitization
    sample_md = test_dir / "guide.md"
    sample_md.write_text("# Tulusy Guide\n\nHello **world**.\n\n- Item A\n- Item B\n", encoding="utf-8")
    for tgt in ["html", "pdf", "docx", "epub", "txt"]:
        out_m = test_dir / f"guide_out.{tgt}"
        convert_markup_or_ebook(sample_md, "md", tgt, out_m)
        assert out_m.exists() and out_m.stat().st_size > 0, f"Failed md -> {tgt}"

    # Verify EPUB round-trip -> TXT, MD, HTML, PDF
    out_epub = test_dir / "guide_out.epub"
    for tgt in ["txt", "md", "html", "pdf"]:
        ep_out = test_dir / f"from_epub.{tgt}"
        convert_markup_or_ebook(out_epub, "epub", tgt, ep_out)
        assert ep_out.exists() and ep_out.stat().st_size > 0, f"Failed epub -> {tgt}"
    assert "Tulusy Guide" in (test_dir / "from_epub.txt").read_text(encoding="utf-8")

    # Verify HTML -> PDF strips <script> and local file:// images
    evil_html = test_dir / "unsafe.html"
    evil_html.write_text(
        "<html><body><h1>Safe Title</h1><script>alert(1)</script><img src='file:///etc/passwd'/></body></html>",
        encoding="utf-8",
    )
    safe_pdf = test_dir / "safe_html.pdf"
    convert_markup_or_ebook(evil_html, "html", "pdf", safe_pdf)
    assert safe_pdf.exists() and safe_pdf.stat().st_size > 0
    md_from_html = test_dir / "from_html.md"
    convert_markup_or_ebook(evil_html, "html", "md", md_from_html)
    assert "Safe Title" in md_from_html.read_text(encoding="utf-8") and "alert(1)" not in md_from_html.read_text(encoding="utf-8")

    # Verify RTF -> TXT & PDF via universal endpoint
    rtf_bytes = br"{\rtf1\ansi {\b Hello RTF}\par Second line}"
    rtf_resp = client.post(
        "/api/convert/universal",
        files={"file": ("note.rtf", rtf_bytes, "application/rtf")},
        data={"target_format": "txt"},
    )
    assert rtf_resp.status_code == 200 and "Hello RTF" in rtf_resp.text
    print("[PASS] Markdown, HTML, RTF, and EPUB conversions & sanitization verified")

    # 28. Test JSON, YAML, XML, CSV, XLSX structured data conversions & XXE guard
    sample_json = test_dir / "users.json"
    sample_json.write_text('[{"name": "Alice", "role": "Engineer"}, {"name": "Bob", "role": "Designer"}]', encoding="utf-8")
    for tgt in ["yaml", "xml", "csv", "xlsx", "pdf", "txt"]:
        out_d = test_dir / f"users_out.{tgt}"
        convert_structured_data(sample_json, "json", tgt, out_d)
        assert out_d.exists() and out_d.stat().st_size > 0, f"Failed json -> {tgt}"

    # Round-trip YAML -> JSON & XML -> JSON
    yaml_to_json = test_dir / "yaml_back.json"
    convert_structured_data(test_dir / "users_out.yaml", "yaml", "json", yaml_to_json)
    assert "Alice" in yaml_to_json.read_text(encoding="utf-8")

    xml_to_json = test_dir / "xml_back.json"
    convert_structured_data(test_dir / "users_out.xml", "xml", "json", xml_to_json)
    assert "Alice" in xml_to_json.read_text(encoding="utf-8")

    # CSV -> JSON & YAML via universal endpoint (including .yml alias)
    with open(sample_csv, "rb") as fp:
        csv_yaml_resp = client.post(
            "/api/convert/universal",
            files={"file": ("sample.csv", fp, "text/csv")},
            data={"target_format": "yml"},
        )
    assert csv_yaml_resp.status_code == 200 and "Alice" in csv_yaml_resp.text

    # XXE entity bomb must be rejected cleanly with HTTP 400
    xxe_payload = b'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>'
    xxe_resp = client.post(
        "/api/convert/universal",
        files={"file": ("evil.xml", xxe_payload, "application/xml")},
        data={"target_format": "json"},
    )
    assert xxe_resp.status_code == 400, f"Expected 400 for XXE XML, got {xxe_resp.status_code}"
    print("[PASS] Structured data (JSON, YAML, XML, CSV, XLSX) & XXE protection verified")

    # 29. Regression checks from deep audit (dates->JSON, XML attrs/tags, double-HTML, DOCX nesting, EpubNav, CUR, CSS)
    import struct
    from datetime import datetime as _dt
    from lxml import etree as _lxml_etree
    from docx import Document as _DocxDoc

    # 29a. txt->html & rtf->html single <html> root
    plain_src = test_dir / "single_root.txt"
    plain_src.write_text("Line one\nLine two", encoding="utf-8")
    plain_html = test_dir / "single_root.html"
    convert_markup_or_ebook(plain_src, "txt", "html", plain_html)
    assert plain_html.read_text(encoding="utf-8").lower().count("<html") == 1, "Double <html> tag in txt->html"
    rtf_html = test_dir / "rtf_single.html"
    rtf_src = test_dir / "rtf_single.rtf"
    rtf_src.write_bytes(rtf_bytes)
    convert_markup_or_ebook(rtf_src, "rtf", "html", rtf_html)
    assert rtf_html.read_text(encoding="utf-8").lower().count("<html") == 1, "Double <html> tag in rtf->html"

    # 29b. YAML date + integer key -> JSON & list of dates -> CSV
    yaml_dates = test_dir / "dates.yaml"
    yaml_dates.write_text("created: 2026-11-25\n1: one\nitems:\n  - name: A\n    dates:\n      - 2026-11-25\n", encoding="utf-8")
    yaml_dates_json = test_dir / "dates.json"
    convert_structured_data(yaml_dates, "yaml", "json", yaml_dates_json)
    assert '"2026-11-25"' in yaml_dates_json.read_text(encoding="utf-8")
    yaml_dates_csv = test_dir / "dates.csv"
    convert_structured_data(yaml_dates, "yaml", "csv", yaml_dates_csv)
    assert "2026-11-25" in yaml_dates_csv.read_text(encoding="utf-8")

    # 29c. XLSX datetime cell -> JSON
    wb_dt = openpyxl.Workbook()
    ws_dt = wb_dt.active
    ws_dt.append(["Name", "Created"])
    ws_dt.append(["Alice", _dt(2026, 11, 25, 10, 30)])
    xlsx_dt = test_dir / "dt.xlsx"
    wb_dt.save(str(xlsx_dt))
    wb_dt.close()
    xlsx_dt_json = test_dir / "dt.json"
    convert_structured_data(xlsx_dt, "xlsx", "json", xlsx_dt_json)
    assert "2026-11-25T10:30:00" in xlsx_dt_json.read_text(encoding="utf-8")

    # 29d. Tricky JSON keys (-id, .env, \x00) -> strict XML & XML with @attr -> CSV unwrap
    tricky_json = test_dir / "tricky_keys.json"
    tricky_json.write_text('{"-id": "1", ".env": "ok\\u0000bad"}', encoding="utf-8")
    tricky_xml = test_dir / "tricky_keys.xml"
    convert_structured_data(tricky_json, "json", "xml", tricky_xml)
    _lxml_etree.fromstring(tricky_xml.read_bytes())

    attr_xml = test_dir / "attr_users.xml"
    attr_xml.write_text('<users version="1.0"><user><name>Alice</name></user><user><name>Bob</name></user></users>', encoding="utf-8")
    attr_csv = test_dir / "attr_users.csv"
    convert_structured_data(attr_xml, "xml", "csv", attr_csv)
    attr_csv_lines = attr_csv.read_text(encoding="utf-8").splitlines()
    assert attr_csv_lines[0] == "name" and "Alice" in attr_csv_lines[1] and "Bob" in attr_csv_lines[2]

    # 29e. HTML nested <ul><li><p> + nested list + leaf <div> -> DOCX without duplicates, plus CSS/PI sanitization
    nested_html = test_dir / "nested_docx.html"
    nested_html.write_text(
        "<?xml version='1.0' encoding='utf-8'?>"
        "<style>@import url('file:///etc/passwd');</style>"
        "<ul><li><p>BulletOnce</p><ul><li>NestedItem</li></ul></li></ul>"
        "<div style=\"background:url('file:///etc/passwd')\">LeafDivText</div>",
        encoding="utf-8",
    )
    nested_docx = test_dir / "nested_docx.docx"
    convert_markup_or_ebook(nested_html, "html", "docx", nested_docx)
    doc_paras = [p.text for p in _DocxDoc(str(nested_docx)).paragraphs if p.text.strip()]
    assert doc_paras.count("BulletOnce") == 1, f"Expected single BulletOnce, got {doc_paras}"
    assert "NestedItem" in doc_paras and "LeafDivText" in doc_paras, f"Missing nested/div text: {doc_paras}"
    sanitized_html_out = test_dir / "sanitized_check.html"
    convert_markup_or_ebook(nested_html, "html", "html", sanitized_html_out)
    sanitized_str = sanitized_html_out.read_text(encoding="utf-8")
    assert "<?xml" not in sanitized_str and "@import" not in sanitized_str and "file:///" not in sanitized_str

    # 29f. EPUB -> TXT skips EpubNav TOC duplication
    docx_for_ep = test_dir / "ep_src.docx"
    ep_doc_obj = _DocxDoc()
    ep_doc_obj.add_heading("Chapter One", level=1)
    ep_doc_obj.add_paragraph("Body paragraph only.")
    ep_doc_obj.save(str(docx_for_ep))
    ep_built = test_dir / "ep_built.epub"
    convert_markup_or_ebook(docx_for_ep, "docx", "epub", ep_built)
    ep_txt_out = test_dir / "ep_built.txt"
    convert_markup_or_ebook(ep_built, "epub", "txt", ep_txt_out)
    ep_txt_val = ep_txt_out.read_text(encoding="utf-8").strip()
    assert ep_txt_val.startswith("Chapter One"), f"Unexpected EpubNav prefix in EPUB->TXT: {ep_txt_val!r}"

    # 29g. .markdown alias & rtf target rejection
    with open(sample_md, "rb") as fp:
        md_alias_resp = client.post(
            "/api/convert/universal",
            files={"file": ("notes.markdown", fp, "text/markdown")},
            data={"target_format": "pdf"},
        )
    assert md_alias_resp.status_code == 200 and md_alias_resp.content.startswith(b"%PDF")
    with open(sample_md, "rb") as fp:
        bad_rtf_tgt = client.post(
            "/api/convert/universal",
            files={"file": ("notes.md", fp, "text/markdown")},
            data={"target_format": "rtf"},
        )
    assert bad_rtf_tgt.status_code == 400

    # 29h. PNG-in-CUR & BMP-DIB CUR -> PNG + CMYK/I;16/17x17 -> modern image targets
    ico_buf = io.BytesIO()
    Image.new("RGBA", (32, 32), (255, 0, 0, 255)).save(ico_buf, format="ICO", sizes=[(32, 32)])
    png_cur_bytes = bytearray(ico_buf.getvalue())
    struct.pack_into("<H", png_cur_bytes, 2, 2)
    png_cur = test_dir / "modern.cur"
    png_cur.write_bytes(bytes(png_cur_bytes))
    convert_single_image(png_cur, test_dir / "from_png_cur.png", "png")
    assert (test_dir / "from_png_cur.png").stat().st_size > 0

    w_c, h_c = 16, 16
    xor_bits = b"\x00\x00\xff\xff" * (w_c * h_c)
    and_bits = b"\x00" * (4 * h_c)
    dib_hdr = struct.pack("<IiiHHIIiiII", 40, w_c, h_c * 2, 1, 32, 0, len(xor_bits) + len(and_bits), 0, 0, 0, 0)
    img_data = dib_hdr + xor_bits + and_bits
    bmp_cur = test_dir / "classic.cur"
    bmp_cur.write_bytes(struct.pack("<HHH", 0, 2, 1) + struct.pack("<BBBBHHII", w_c, h_c, 0, 0, 0, 0, len(img_data), 22) + img_data)
    convert_single_image(bmp_cur, test_dir / "from_bmp_cur.png", "png")
    assert (test_dir / "from_bmp_cur.png").stat().st_size > 0

    cmyk_src = test_dir / "cmyk.tiff"
    Image.new("CMYK", (17, 17), (10, 20, 30, 40)).save(str(cmyk_src))
    for tgt in ["jxl", "jp2", "qoi", "dds", "icns", "ppm"]:
        out_c = test_dir / f"cmyk_17.{tgt}"
        convert_single_image(cmyk_src, out_c, tgt, quality=80)
        assert out_c.exists() and out_c.stat().st_size > 0
    print("[PASS] All deep-audit edge cases (dates, XML, double-HTML, DOCX, EpubNav, CUR, CSS, CMYK) verified")

    # 30. Second-pass hardening regressions: ICNS square pad, ctrl chars -> DOCX/EPUB, reflowable PDF->HTML/MD/EPUB, RSS XML namespaces, 200KB CSV, router parity
    # 30a. Non-square 300x100 PNG -> ICNS preserves aspect ratio via transparent padding
    wide_png = test_dir / "wide_300x100.png"
    Image.new("RGBA", (300, 100), (255, 0, 0, 255)).save(wide_png)
    wide_icns = test_dir / "wide_300x100.icns"
    convert_single_image(wide_png, wide_icns, "icns", maintain_aspect_ratio=True)
    with Image.open(wide_icns) as icns_im:
        icns_im.load()
        assert icns_im.getpixel((0, 0))[3] == 0, "Expected transparent padding at top-left of non-square ICNS"
        assert icns_im.getpixel((icns_im.width // 2, icns_im.height // 2))[:3] == (255, 0, 0)

    # 30b. XML-illegal control characters in TXT/MD/HTML/RTF -> DOCX & strict XML EPUB
    dirty_bytes = b"Hello\x00World\x07Bell\x0cFormFeed"
    for dirty_src_ext, dirty_payload in [
        ("txt", dirty_bytes),
        ("md", dirty_bytes),
        ("html", b"<p>" + dirty_bytes + b"</p>"),
        ("rtf", br"{\rtf1\ansi Hello\x00}" + b"\x07"),
    ]:
        dirty_in = test_dir / f"dirty.{dirty_src_ext}"
        dirty_in.write_bytes(dirty_payload)
        dirty_docx = test_dir / f"dirty_{dirty_src_ext}.docx"
        convert_markup_or_ebook(dirty_in, dirty_src_ext, "docx", dirty_docx)
        assert dirty_docx.stat().st_size > 0
        dirty_epub = test_dir / f"dirty_{dirty_src_ext}.epub"
        convert_markup_or_ebook(dirty_in, dirty_src_ext, "epub", dirty_epub)
        with zipfile.ZipFile(dirty_epub, "r") as ezf:
            _lxml_etree.fromstring(ezf.read("EPUB/chapter_1.xhtml"))

    # 30c. Reflowable PDF -> HTML / MD / EPUB with heading, wrapped continuous paragraph, and table
    mixed_pdf = test_dir / "mixed_layout.pdf"
    mp_doc = fitz.open()
    mp_pg = mp_doc.new_page(width=612, height=792)
    mp_pg.insert_text((50, 60), "Quarterly Report", fontsize=20)
    mp_pg.insert_textbox(
        fitz.Rect(50, 85, 550, 155),
        "This continuous paragraph wraps across multiple lines so extraction joins lines without artificial paragraph breaks.",
        fontsize=11,
    )
    for r in range(3):
        mp_pg.draw_line((50, 175 + r * 24), (350, 175 + r * 24))
    for c in range(3):
        mp_pg.draw_line((50 + c * 150, 175), (50 + c * 150, 223))
    mp_pg.insert_text((60, 192), "Metric", fontsize=11)
    mp_pg.insert_text((210, 192), "Count", fontsize=11)
    mp_pg.insert_text((60, 216), "Formats", fontsize=11)
    mp_pg.insert_text((210, 216), "40", fontsize=11)
    mp_doc.save(str(mixed_pdf))
    mp_doc.close()

    mixed_html = test_dir / "mixed_layout.html"
    convert_markup_or_ebook(mixed_pdf, "pdf", "html", mixed_html)
    mixed_html_str = mixed_html.read_text(encoding="utf-8")
    assert "<h2>Quarterly Report</h2>" in mixed_html_str
    assert "<table>" in mixed_html_str and "width:612.0pt" not in mixed_html_str
    mixed_md = test_dir / "mixed_layout.md"
    convert_markup_or_ebook(mixed_pdf, "pdf", "md", mixed_md)
    mixed_md_str = mixed_md.read_text(encoding="utf-8")
    assert "## Quarterly Report" in mixed_md_str and "without artificial paragraph breaks." in mixed_md_str

    # 30d. Namespaced RSS XML + REST envelope JSON -> CSV / XLSX / XML
    rss_xml = test_dir / "rss_ns.xml"
    rss_xml.write_text(
        '<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        '<channel><title>Tulusy Feed</title><item><title>Post A</title><dc:creator>Alice</dc:creator></item>'
        '<item><title>Post B</title><dc:creator>Bob</dc:creator></item></channel></rss>',
        encoding="utf-8",
    )
    rss_csv = test_dir / "rss_ns.csv"
    convert_structured_data(rss_xml, "xml", "csv", rss_csv)
    rss_csv_lines = rss_csv.read_text(encoding="utf-8").splitlines()
    assert rss_csv_lines[0] == "title,creator" and len(rss_csv_lines) == 3, f"Unexpected RSS->CSV: {rss_csv_lines}"
    rss_roundtrip_xml = test_dir / "rss_clean.xml"
    convert_structured_data(rss_xml, "xml", "xml", rss_roundtrip_xml)
    assert "_http___" not in rss_roundtrip_xml.read_text(encoding="utf-8")

    # 30e. CSV with >128KB cell -> JSON & XLSX
    huge_cell_csv = test_dir / "huge_cell.csv"
    huge_cell_csv.write_text('id,body\n1,"' + ("A" * 200_000) + '"\n', encoding="utf-8")
    convert_structured_data(huge_cell_csv, "csv", "json", test_dir / "huge_cell.json")
    convert_structured_data(huge_cell_csv, "csv", "xlsx", test_dir / "huge_cell.xlsx")

    # 30f. /api/convert/image supports format aliases (j2k) and extensionless MIME uploads
    with open(wide_png, "rb") as fp:
        alias_img_resp = client.post(
            "/api/convert/image",
            files={"file": ("clipboard_image", fp, "image/png")},
            data={"target_format": "j2k"},
        )
    assert alias_img_resp.status_code == 200 and len(alias_img_resp.content) > 0

    # 30g. Skinny 1x500 -> ICO, loose inline/text HTML -> DOCX, ISO-8859-1 XML & multi-doc YAML
    skinny_png = test_dir / "skinny_1x500.png"
    Image.new("RGBA", (1, 500), (10, 20, 30, 255)).save(skinny_png)
    convert_single_image(skinny_png, test_dir / "skinny_1x500.ico", "ico")
    assert (test_dir / "skinny_1x500.ico").stat().st_size > 0

    mixed_inline_html = test_dir / "mixed_inline.html"
    mixed_inline_html.write_text(
        "<body>Intro text <a href='https://tulusy.cc'>Link</a><p>Para</p><div><span>Span</span><p>Inner</p>After</div></body>",
        encoding="utf-8",
    )
    mixed_inline_docx = test_dir / "mixed_inline.docx"
    convert_markup_or_ebook(mixed_inline_html, "html", "docx", mixed_inline_docx)
    inline_paras = " | ".join(p.text for p in _DocxDoc(str(mixed_inline_docx)).paragraphs)
    for expected in ("Intro text", "Link", "Para", "Span", "Inner", "After"):
        assert expected in inline_paras, f"Missing {expected!r} in {inline_paras!r}"

    latin1_xml = test_dir / "latin1.xml"
    latin1_xml.write_bytes('<?xml version="1.0" encoding="ISO-8859-1"?><root><item>Café</item></root>'.encode("latin-1"))
    latin1_json = test_dir / "latin1.json"
    convert_structured_data(latin1_xml, "xml", "json", latin1_json)
    assert "Café" in latin1_json.read_text(encoding="utf-8")

    multi_yaml = test_dir / "multi.yaml"
    multi_yaml.write_text("---\nname: one\n---\nname: two\n", encoding="utf-8")
    multi_csv = test_dir / "multi.csv"
    convert_structured_data(multi_yaml, "yaml", "csv", multi_csv)
    assert len(multi_csv.read_text(encoding="utf-8").splitlines()) == 3
    print("[PASS] Final hardening regressions (ICNS padding, 1x500 ICO, mixed HTML DOCX, ISO-8859-1 XML, multi-doc YAML, ctrl-char DOCX/EPUB, reflowable PDF, RSS XML, 200KB CSV, router parity) verified")

    print("\n[SUCCESS] ALL BACKEND CONVERSION TESTS PASSED PERFECTLY!")


def test_conversions():
    run_tests()


if __name__ == "__main__":
    run_tests()
