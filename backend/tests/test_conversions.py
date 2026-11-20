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

def run_tests():
    test_dir = BASE_DIR / "temp" / "test_run"
    test_dir.mkdir(parents=True, exist_ok=True)
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
    assert "html" not in doc_exts
    assert img_exts["psd"].get("input_only") is True
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

    print("\n[SUCCESS] ALL BACKEND CONVERSION TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
