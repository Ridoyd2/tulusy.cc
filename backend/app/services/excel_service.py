import csv
from pathlib import Path
from typing import List, Optional
from xml.sax.saxutils import escape

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

try:
    import pymupdf as fitz
except ImportError:
    import fitz


def _safe_cell_text(val: str) -> str:
    cleaned = "".join(ch for ch in val if ch == "\t" or ch == "\n" or ord(ch) >= 32)
    return escape(cleaned)


def convert_xlsx_to_pdf(xlsx_path: Path, pdf_path: Path) -> Path:
    """Converts an Excel workbook (.xlsx) to a formatted tabular PDF document."""
    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True)
    try:
        pdf_doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=landscape(letter),
            leftMargin=20,
            rightMargin=20,
            topMargin=20,
            bottomMargin=20
        )
        styles = getSampleStyleSheet()
        normal_style = styles["Normal"]
        normal_style.fontSize = 8
        normal_style.leading = 10

        story = []

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]

            title_style = ParagraphStyle(
                "SheetTitle",
                parent=styles["Heading2"],
                fontSize=12,
                leading=14,
                textColor=colors.HexColor("#1E293B"),
                spaceAfter=8
            )
            story.append(Paragraph(_safe_cell_text(f"Sheet: {sheet_name}"), title_style))

            raw_rows = []
            max_cols = 0
            MAX_PDF_COLS = 18
            MAX_CELL_CHARS = 800
            for row in sheet.iter_rows(values_only=True):
                if any(cell is not None for cell in row):
                    trimmed = list(row[:MAX_PDF_COLS])
                    row_vals = []
                    for cell in trimmed:
                        s = str(cell) if cell is not None else ""
                        if len(s) > MAX_CELL_CHARS:
                            s = s[:MAX_CELL_CHARS] + "..."
                        row_vals.append(s)
                    raw_rows.append(row_vals)
                    max_cols = max(max_cols, len(row_vals))

            if not raw_rows or max_cols == 0:
                story.append(Paragraph("Empty Sheet", normal_style))
                story.append(Spacer(1, 15))
                continue

            # Compute proportional column widths fitting landscape letter (792pt - 40pt margins = 752pt)
            available_width = 752.0
            col_weights = []
            for c_idx in range(max_cols):
                max_len = max(
                    (len(r[c_idx]) if c_idx < len(r) else 4 for r in raw_rows[:100]),
                    default=8
                )
                col_weights.append(max(6, min(max_len, 45)))
            total_weight = sum(col_weights) or 1
            col_widths = [(w / total_weight) * available_width for w in col_weights]

            cell_style = ParagraphStyle(
                "TableCell",
                parent=normal_style,
                fontSize=7 if max_cols > 10 else 8,
                leading=9 if max_cols > 10 else 10,
                wordWrap="CJK"
            )

            table_data = []
            for row in raw_rows:
                padded = row + [""] * (max_cols - len(row))
                cell_paragraphs = [Paragraph(_safe_cell_text(val), cell_style) for val in padded]
                table_data.append(cell_paragraphs)

            t = Table(table_data, colWidths=col_widths, repeatRows=1)
            t_style = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
            t.setStyle(TableStyle(t_style))
            story.append(t)
            story.append(Spacer(1, 20))

        if not story:
            story.append(Paragraph("Empty Excel Document", styles["Normal"]))

        pdf_doc.build(story)
    finally:
        wb.close()

    return pdf_path


def convert_xlsx_to_csv(xlsx_path: Path, csv_path: Path) -> Path:
    """Exports the first active worksheet of an Excel file to CSV format."""
    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True)
    try:
        sheet = wb.active
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            for row in sheet.iter_rows(values_only=True):
                if any(cell is not None for cell in row):
                    writer.writerow([cell if cell is not None else "" for cell in row])
    finally:
        wb.close()

    return csv_path


def convert_csv_to_xlsx(csv_path: Path, xlsx_path: Path) -> Path:
    """Converts a CSV file into a cleanly styled Excel (.xlsx) spreadsheet."""
    wb = openpyxl.Workbook()
    try:
        ws = wb.active
        ws.title = "Data"

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0")
        )

        with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for row_idx, row in enumerate(reader, start=1):
                for col_idx, value in enumerate(row, start=1):
                    val = value.strip()
                    if val.isdigit():
                        cell_val = int(val)
                    else:
                        try:
                            cell_val = float(val)
                        except ValueError:
                            cell_val = val

                    cell = ws.cell(row=row_idx, column=col_idx, value=cell_val)
                    cell.border = thin_border

                    if row_idx == 1:
                        cell.font = header_font
                        cell.fill = header_fill
                        cell.alignment = Alignment(horizontal="center", vertical="center")

        for col in ws.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=10)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(min(max_len + 3, 50), 12)

        wb.save(str(xlsx_path))
    finally:
        wb.close()

    return xlsx_path


def convert_csv_to_pdf(csv_path: Path, pdf_path: Path) -> Path:
    """Converts a CSV file to a tabular PDF document."""
    temp_xlsx = pdf_path.parent / f"_tmp_{csv_path.stem}.xlsx"
    try:
        convert_csv_to_xlsx(csv_path, temp_xlsx)
        convert_xlsx_to_pdf(temp_xlsx, pdf_path)
    finally:
        temp_xlsx.unlink(missing_ok=True)
    return pdf_path


def convert_pdf_to_xlsx(pdf_path: Path, xlsx_path: Path) -> Path:
    """Extracts tabular data from a PDF document into an Excel spreadsheet (.xlsx)."""
    doc = fitz.open(str(pdf_path))
    wb = openpyxl.Workbook()
    try:
        wb.remove(wb.active)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1")
        )

        has_any_data = False

        for page_idx, page in enumerate(doc):
            ws = wb.create_sheet(title=f"Page {page_idx + 1}")
            tables = page.find_tables()
            current_row = 1

            if tables and tables.tables:
                has_any_data = True
                for table in tables.tables:
                    extracted = table.extract()
                    for r_idx, row in enumerate(extracted):
                        for c_idx, cell_value in enumerate(row):
                            cell = ws.cell(row=current_row + r_idx, column=c_idx + 1, value=cell_value or "")
                            cell.border = thin_border
                            if r_idx == 0:
                                cell.font = header_font
                                cell.fill = header_fill

                    current_row += len(extracted) + 2
            else:
                text_blocks = page.get_text("blocks")
                if text_blocks:
                    has_any_data = True
                    for block in text_blocks:
                        if len(block) >= 5 and block[4].strip():
                            lines = block[4].strip().split("\n")
                            for l_idx, line in enumerate(lines):
                                ws.cell(row=current_row + l_idx, column=1, value=line.strip())
                            current_row += len(lines) + 1

            for col in ws.columns:
                max_len = max((len(str(cell.value or "")) for cell in col), default=10)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(min(max_len + 3, 50), 14)

        if not has_any_data:
            ws = wb.create_sheet(title="Data")
            ws.cell(row=1, column=1, value="No table data detected in PDF")

        wb.save(str(xlsx_path))
    finally:
        doc.close()
        wb.close()

    return xlsx_path


def convert_pdf_to_csv(pdf_path: Path, csv_path: Path) -> Path:
    """Extracts tabular or line data from a PDF into a CSV file."""
    temp_xlsx = csv_path.parent / f"_tmp_{pdf_path.stem}.xlsx"
    try:
        convert_pdf_to_xlsx(pdf_path, temp_xlsx)
        convert_xlsx_to_csv(temp_xlsx, csv_path)
    finally:
        temp_xlsx.unlink(missing_ok=True)
    return csv_path
