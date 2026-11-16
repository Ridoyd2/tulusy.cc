import os
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

    print("\n[SUCCESS] ALL BACKEND CONVERSION TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
