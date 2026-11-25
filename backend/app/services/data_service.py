import csv
import json
import math
import re
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Dict, List, Tuple
from xml.etree import ElementTree as ET

import defusedxml.ElementTree as DET
import openpyxl
import yaml
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from app.config import MAX_DATA_TABLE_ROWS
from app.services.excel_service import _open_xlsx, _sanitize_excel_value
from app.services.pdf_service import convert_txt_to_pdf
from app.services.utils import ensure_csv_field_size_limit, strip_xml_control_chars


_SAFE_XML_TAG_RE = re.compile(r"[^A-Za-z0-9_.-]")


def _strip_xml_ns(name: str) -> str:
    if name.startswith("{") and "}" in name:
        return name.split("}", 1)[1]
    return name


def _sanitize_xml_tag(name: str, fallback: str = "item") -> str:
    clean = _SAFE_XML_TAG_RE.sub("_", _strip_xml_ns(str(name or "").strip()))
    if not clean or not (clean[0].isalpha() or clean[0] == "_") or clean.lower().startswith("xml"):
        clean = f"{fallback}_{clean}" if clean else fallback
    return clean


def _json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    if isinstance(obj, set):
        return list(obj)
    return str(obj)


def _normalize_for_json(val: Any) -> Any:
    if isinstance(val, dict):
        return {str(k): _normalize_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_normalize_for_json(v) for v in val]
    if isinstance(val, float) and not math.isfinite(val):
        return None
    return val


def _safe_json_dumps(obj: Any, indent: int | None = None) -> str:
    return json.dumps(
        _normalize_for_json(obj),
        indent=indent,
        ensure_ascii=False,
        default=_json_default,
    )


def _normalize_for_yaml(val: Any) -> Any:
    if isinstance(val, dict):
        return {
            (k if isinstance(k, (str, int, float, bool)) else str(k)): _normalize_for_yaml(v)
            for k, v in val.items()
        }
    if isinstance(val, (list, tuple, set)):
        return [_normalize_for_yaml(v) for v in val]
    if isinstance(val, float) and not math.isfinite(val):
        return None
    return val


def _xml_element_to_data(elem: ET.Element) -> Any:
    children = list(elem)
    text = (elem.text or "").strip()
    if not children and not elem.attrib:
        return text

    result: Dict[str, Any] = {}
    for k, v in elem.attrib.items():
        local_k = _strip_xml_ns(k)
        if local_k == "xmlns" or k.startswith("{http://www.w3.org/2000/xmlns/}"):
            continue
        attr_key = f"@{local_k}"
        if attr_key not in result:
            result[attr_key] = v
    if text:
        result["#text"] = text
    for child in children:
        val = _xml_element_to_data(child)
        tag = _strip_xml_ns(child.tag)
        if tag in result:
            existing = result[tag]
            if isinstance(existing, list):
                existing.append(val)
            else:
                result[tag] = [existing, val]
        else:
            result[tag] = val
    return result


def _data_to_xml_element(tag: str, value: Any) -> ET.Element:
    elem = ET.Element(_sanitize_xml_tag(tag))
    if isinstance(value, dict):
        for k, v in value.items():
            key_str = str(k)
            if key_str.startswith("@") and len(key_str) > 1:
                elem.set(_sanitize_xml_tag(key_str[1:], "attr"), strip_xml_control_chars(v))
            elif key_str == "#text":
                elem.text = strip_xml_control_chars(v)
            elif isinstance(v, list):
                for item in v:
                    elem.append(_data_to_xml_element(key_str, item))
            else:
                elem.append(_data_to_xml_element(key_str, v))
    elif isinstance(value, list):
        for item in value:
            elem.append(_data_to_xml_element("item", item))
    elif value is not None:
        if isinstance(value, (datetime, date, time)):
            elem.text = value.isoformat()
        else:
            elem.text = strip_xml_control_chars(value)
    return elem


def _flatten_dict(obj: Any, prefix: str = "") -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else str(k)
            if isinstance(v, dict):
                out.update(_flatten_dict(v, key))
            elif isinstance(v, list):
                out[key] = _safe_json_dumps(v)
            else:
                out[key] = v
    else:
        out[prefix or "value"] = obj
    return out


def _data_to_table_rows(data: Any) -> Tuple[List[str], List[List[Any]]]:
    """Extracts tabular headers and rows from lists of dicts, single dicts, or XML/REST envelopes."""
    cur = data
    for _ in range(5):
        if not isinstance(cur, dict):
            break
        content_keys = [k for k in cur.keys() if not str(k).startswith("@") and k != "#text"]
        if len(content_keys) == 1 and isinstance(cur[content_keys[0]], (list, dict)):
            cur = cur[content_keys[0]]
            continue
        record_list_keys = [
            k for k in content_keys
            if isinstance(cur[k], list) and cur[k] and all(isinstance(it, dict) for it in cur[k])
        ]
        if len(record_list_keys) == 1:
            cur = cur[record_list_keys[0]]
            continue
        break

    if isinstance(cur, list):
        if not cur:
            return ["value"], []
        if all(isinstance(item, dict) for item in cur):
            flat_rows = [_flatten_dict(item) for item in cur]
            headers: List[str] = []
            seen = set()
            for r in flat_rows:
                for k in r.keys():
                    if k not in seen:
                        seen.add(k)
                        headers.append(k)
            rows = [[r.get(h, "") for h in headers] for r in flat_rows]
            return headers, rows
        return ["value"], [
            [_safe_json_dumps(item) if isinstance(item, (dict, list)) else item]
            for item in cur
        ]

    if isinstance(cur, dict):
        flat = _flatten_dict(cur)
        return ["key", "value"], [[k, v] for k, v in flat.items()]

    return ["value"], [[cur]]


def _load_structured_data(input_path: Path, source_ext: str) -> Any:
    src = source_ext.lower().lstrip(".")

    if src == "json":
        raw_text = input_path.read_text(encoding="utf-8-sig", errors="replace")
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON syntax: {e}")

    if src in ("yaml", "yml"):
        raw_text = input_path.read_text(encoding="utf-8-sig", errors="replace")
        try:
            docs = [{} if d is None else d for d in yaml.safe_load_all(raw_text)]
            if not docs:
                return {}
            return docs[0] if len(docs) == 1 else docs
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML syntax: {e}")

    if src == "xml":
        try:
            root = DET.fromstring(input_path.read_bytes())
            return {_strip_xml_ns(root.tag): _xml_element_to_data(root)}
        except Exception as e:
            raise ValueError(f"Invalid or unsafe XML document: {e}")

    if src == "csv":
        ensure_csv_field_size_limit()
        try:
            with open(input_path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
                rows = list(csv.reader(f))
        except csv.Error as e:
            raise ValueError(f"Invalid CSV format: {e}")
        if not rows:
            return []
        headers = [h.strip() or f"col_{idx + 1}" for idx, h in enumerate(rows[0])]
        records = []
        for row in rows[1:]:
            if not any(cell.strip() for cell in row):
                continue
            record = {
                headers[idx]: (row[idx] if idx < len(row) else "")
                for idx in range(len(headers))
            }
            records.append(record)
        return records

    if src == "xlsx":
        wb = _open_xlsx(input_path, data_only=True)
        try:
            sheets_out: Dict[str, List[Dict[str, Any]]] = {}
            for name in wb.sheetnames:
                ws = wb[name]
                raw_rows = [list(r) for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
                if not raw_rows:
                    sheets_out[name] = []
                    continue
                headers = [str(c).strip() if c is not None else f"col_{idx + 1}" for idx, c in enumerate(raw_rows[0])]
                records = []
                for row in raw_rows[1:]:
                    records.append({
                        headers[idx]: (row[idx] if idx < len(row) else None)
                        for idx in range(len(headers))
                    })
                sheets_out[name] = records
            if len(sheets_out) == 1:
                return next(iter(sheets_out.values()))
            return sheets_out
        finally:
            wb.close()

    raise ValueError(f"Unsupported structured data source format: .{src}")


def _write_rows_to_xlsx(headers: List[str], rows: List[List[Any]], xlsx_path: Path) -> Path:
    if len(rows) > MAX_DATA_TABLE_ROWS:
        raise ValueError(
            f"Tabular export exceeds maximum supported row limit ({MAX_DATA_TABLE_ROWS} rows)."
        )
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
            bottom=Side(style="thin", color="E2E8F0"),
        )
        col_max_lens: List[int] = []
        for col_idx, h in enumerate(headers, start=1):
            safe_h = _sanitize_excel_value(h)
            col_max_lens.append(max(len(str(safe_h or "")), 10))
            cell = ws.cell(row=1, column=col_idx, value=safe_h)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")

        for r_idx, row in enumerate(rows, start=2):
            for c_idx, val in enumerate(row, start=1):
                if isinstance(val, bool):
                    safe_val: Any = val
                elif isinstance(val, (int, float)):
                    safe_val = val if math.isfinite(val) else str(val)
                elif isinstance(val, (datetime, date, time)):
                    safe_val = val.isoformat()
                elif isinstance(val, (dict, list)):
                    safe_val = _sanitize_excel_value(_safe_json_dumps(val))
                else:
                    safe_val = _sanitize_excel_value("" if val is None else str(val))
                if r_idx <= 201 and c_idx - 1 < len(col_max_lens):
                    col_max_lens[c_idx - 1] = max(col_max_lens[c_idx - 1], len(str(safe_val or "")))
                cell = ws.cell(row=r_idx, column=c_idx, value=safe_val)
                cell.border = thin_border

        for col_idx, max_len in enumerate(col_max_lens, start=1):
            col_letter = openpyxl.utils.get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = max(min(max_len + 3, 50), 12)

        wb.save(str(xlsx_path))
    finally:
        wb.close()
    return xlsx_path


def _csv_cell_value(val: Any) -> Any:
    if val is None:
        return ""
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, (dict, list)):
        return _safe_json_dumps(val)
    return val


def convert_structured_data(input_path: Path, source_ext: str, target_ext: str, output_path: Path) -> Path:
    """Converts between JSON, YAML, XML, CSV, XLSX, PDF, and TXT."""
    src = source_ext.lower().lstrip(".")
    tgt = target_ext.lower().lstrip(".")
    data = _load_structured_data(input_path, src)

    if tgt == "json":
        output_path.write_text(_safe_json_dumps(data, indent=2) + "\n", encoding="utf-8")
        return output_path

    if tgt in ("yaml", "yml"):
        output_path.write_text(
            yaml.safe_dump(_normalize_for_yaml(data), sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )
        return output_path

    if tgt == "xml":
        if isinstance(data, dict) and len(data) == 1:
            root_tag, root_val = next(iter(data.items()))
            root_el = _data_to_xml_element(root_tag, root_val)
        elif isinstance(data, list):
            root_el = ET.Element("records")
            for item in data:
                root_el.append(_data_to_xml_element("record", item))
        else:
            root_el = _data_to_xml_element("root", data)
        ET.indent(root_el, space="  ")
        xml_bytes = ET.tostring(root_el, encoding="utf-8", xml_declaration=True)
        output_path.write_bytes(xml_bytes + b"\n")
        return output_path

    if tgt == "csv":
        headers, rows = _data_to_table_rows(data)
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for r in rows:
                writer.writerow([_csv_cell_value(v) for v in r])
        return output_path

    if tgt == "xlsx":
        headers, rows = _data_to_table_rows(data)
        return _write_rows_to_xlsx(headers, rows, output_path)

    if tgt in ("txt", "pdf"):
        if src == "json":
            formatted = _safe_json_dumps(data, indent=2)
        elif src in ("yaml", "yml"):
            formatted = yaml.safe_dump(_normalize_for_yaml(data), sort_keys=False, allow_unicode=True)
        else:
            formatted = input_path.read_text(encoding="utf-8-sig", errors="replace")

        if tgt == "txt":
            output_path.write_text(formatted, encoding="utf-8")
            return output_path

        tmp_txt = output_path.parent / f"_tmp_{output_path.stem}.txt"
        try:
            tmp_txt.write_text(formatted, encoding="utf-8")
            return convert_txt_to_pdf(tmp_txt, output_path)
        finally:
            tmp_txt.unlink(missing_ok=True)

    raise ValueError(f"Unsupported structured data conversion from .{src} to .{tgt}")
