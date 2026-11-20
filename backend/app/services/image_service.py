import base64
import io
from pathlib import Path
from typing import Optional, List, Tuple
from PIL import Image, ImageOps, UnidentifiedImageError, features
import pillow_heif
from app.config import MAX_IMAGE_DIMENSION, MAX_IMAGE_FRAMES, MAX_PDF_PAGES, WRITABLE_IMAGE_FORMATS
from app.services.utils import validate_image_params, validate_target_format

# Register HEIF/HEIC opener with Pillow
pillow_heif.register_heif_opener()

# Keep Pillow decompression bomb guard active while allowing configured MAX_IMAGE_DIMENSION
Image.MAX_IMAGE_PIXELS = max(89_478_485, MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION)

try:
    from psd_tools import PSDImage
    HAS_PSD = True
except ImportError:
    HAS_PSD = False

try:
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPDF, renderPM
    HAS_SVGLIB = True
except ImportError:
    HAS_SVGLIB = False

try:
    import pymupdf as fitz
except ImportError:
    import fitz

def load_image(input_path: Path) -> List[Image.Image]:
    """
    Loads an image from any supported file format into a list of PIL Images (multi-frame for GIF/PDF/TIFF).
    """
    ext = input_path.suffix.lower().lstrip('.')

    # 1. Handle SVG files safely from memory stream (blocks local file xlink:href / XML entity resolution)
    if ext == 'svg':
        if not HAS_SVGLIB:
            raise ValueError("SVG rasterization support is not installed on the server.")
        try:
            svg_bytes = input_path.read_bytes()
            if not svg_bytes.strip():
                raise ValueError("SVG file is empty.")
            drawing = svg2rlg(io.BytesIO(svg_bytes), resolve_entities=False)
            if not drawing or drawing.width <= 0 or drawing.height <= 0:
                raise ValueError("Invalid or empty SVG document.")

            max_pt = max(float(drawing.width), float(drawing.height))
            safe_dpi = max(1, int(min(300.0, (MAX_IMAGE_DIMENSION * 72.0) / max_pt))) if max_pt > 0 else 300

            buf = io.BytesIO()
            try:
                try:
                    renderPM.drawToFile(drawing, buf, fmt="PNG", dpi=safe_dpi)
                    buf.seek(0)
                    with Image.open(buf) as rendered:
                        return [rendered.copy()]
                except Exception:
                    # Fallback when rlPyCairo/renderPM backend is unavailable (e.g., Windows)
                    pdf_bytes = renderPDF.drawToString(drawing)
                    svg_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                    try:
                        pix = svg_doc[0].get_pixmap(dpi=safe_dpi, alpha=True)
                        return [Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)]
                    finally:
                        svg_doc.close()
            finally:
                buf.close()
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Could not render SVG image: {e}")

    # 2. Handle PSD files
    if ext == 'psd':
        if not HAS_PSD:
            raise ValueError("PSD format support is not installed on the server.")
        try:
            psd = PSDImage.open(str(input_path))
            pil_img = psd.composite()
            if not pil_img:
                raise ValueError("PSD file has no composite image.")
            return [pil_img]
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Could not decode PSD image: {e}")

    # 3. Handle PDF files as image input
    if ext == 'pdf':
        try:
            doc = fitz.open(str(input_path))
        except Exception as e:
            raise ValueError(f"Invalid or corrupted PDF file: {e}")
        try:
            if doc.needs_pass:
                raise ValueError("Password-protected PDFs are not supported.")
            if len(doc) == 0:
                raise ValueError("PDF document contains no pages.")
            if len(doc) > MAX_PDF_PAGES:
                raise ValueError(f"PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
            frames = []
            for page in doc:
                pix = page.get_pixmap(dpi=300, alpha=False)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                frames.append(img)
            if frames:
                return frames
        finally:
            doc.close()

    # 4. Standard and HEIC/HEIF / TIFF / WebP / BMP / GIF etc. via Pillow
    try:
        img = Image.open(str(input_path))
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as e:
        raise ValueError(f"Could not decode image file '{input_path.name}': {e}")

    frames: List[Image.Image] = []
    try:
        n_frames = getattr(img, "n_frames", 1)
        if n_frames > MAX_IMAGE_FRAMES:
            raise ValueError(f"Animated image exceeds maximum supported frame limit ({MAX_IMAGE_FRAMES} frames).")

        is_animated = getattr(img, "is_animated", False) and n_frames > 1
        if not is_animated:
            try:
                transposed = ImageOps.exif_transpose(img)
                frames = [transposed.copy()]
                if transposed is not img:
                    transposed.close()
            except Exception:
                frames = [img.copy()]
        else:
            try:
                while True:
                    if len(frames) >= MAX_IMAGE_FRAMES:
                        raise ValueError(f"Animated image exceeds maximum supported frame limit ({MAX_IMAGE_FRAMES} frames).")
                    frames.append(img.copy())
                    img.seek(img.tell() + 1)
            except EOFError:
                pass
            except (ValueError, AttributeError, OSError) as exc:
                if isinstance(exc, ValueError) and "maximum supported frame limit" in str(exc):
                    raise
                pass  # Non-seekable image or end of sequence

        if not frames:
            frames = [img.copy()]
    except Exception:
        for f in frames:
            try:
                f.close()
            except Exception:
                pass
        raise
    finally:
        try:
            img.close()
        except Exception:
            pass

    return frames


def _composite_to_rgb(img: Image.Image, bg_color: Optional[str] = "#FFFFFF") -> Image.Image:
    """Flattens any image with transparency (RGBA, LA, P) onto a solid RGB background."""
    fill = bg_color or "#FFFFFF"
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        try:
            bg = Image.new("RGB", rgba.size, fill)
        except ValueError:
            bg = Image.new("RGB", rgba.size, "#FFFFFF")
        bg.paste(rgba, mask=rgba.split()[-1])
        rgba.close()
        return bg
    if img.mode != "RGB":
        return img.convert("RGB")
    return img.copy()


def _normalize_mode_for_resize(img: Image.Image) -> Image.Image:
    """Normalizes exotic modes (CMYK, P, 1, I;16, F, etc.) to RGB/RGBA/L/LA before resizing or export."""
    if img.mode in ("RGB", "RGBA", "L", "LA"):
        return img
    if img.mode == "P":
        return img.convert("RGBA" if "transparency" in img.info else "RGB")
    if img.mode in ("PA", "RGBa"):
        return img.convert("RGBA")
    return img.convert("RGB")


def apply_image_transformations(
    image: Image.Image,
    width: Optional[int] = None,
    height: Optional[int] = None,
    maintain_aspect_ratio: bool = True,
    grayscale: bool = False,
    bg_color: Optional[str] = None
) -> Image.Image:
    """Applies resizing, color adjustments, and background fills while preserving alpha channels."""
    img = image.copy()

    # Resize if dimensions provided
    orig_w, orig_h = img.size
    if width or height:
        target_w = width or orig_w
        target_h = height or orig_h

        if maintain_aspect_ratio:
            if width and not height:
                target_h = int(orig_h * (width / orig_w))
            elif height and not width:
                target_w = int(orig_w * (height / orig_h))
            else:
                # fit within bounding box
                ratio = min(width / orig_w, height / orig_h)
                target_w = int(orig_w * ratio)
                target_h = int(orig_h * ratio)

        target_w = max(1, target_w)
        target_h = max(1, target_h)
        if target_w > MAX_IMAGE_DIMENSION or target_h > MAX_IMAGE_DIMENSION:
            img.close()
            raise ValueError(f"Resulting dimensions ({target_w}x{target_h}) exceed maximum supported size ({MAX_IMAGE_DIMENSION}px).")

        normalized = _normalize_mode_for_resize(img)
        if normalized is not img:
            img.close()
            img = normalized
        resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        img.close()
        img = resized

    # Grayscale conversion (preserve alpha channel if transparent so backgrounds don't turn black)
    if grayscale:
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            alpha = rgba.split()[-1]
            lum = ImageOps.grayscale(rgba.convert("RGB"))
            merged = Image.merge("LA", (lum, alpha))
            rgba.close()
            lum.close()
            img.close()
            img = merged
        else:
            norm = _normalize_mode_for_resize(img)
            gray = ImageOps.grayscale(norm)
            if norm is not img:
                norm.close()
            img.close()
            img = gray

    return img


def convert_single_image(
    input_path: Path,
    output_path: Path,
    target_format: str,
    quality: int = 90,
    width: Optional[int] = None,
    height: Optional[int] = None,
    maintain_aspect_ratio: bool = True,
    dpi: int = 300,
    grayscale: bool = False,
    bg_color: Optional[str] = "#FFFFFF",
    ico_sizes: Optional[List[Tuple[int, int]]] = None
) -> Path:
    """
    Converts any input image to the designated target format with custom settings.
    """
    width, height, quality, dpi = validate_image_params(width, height, quality, dpi)
    target_format = validate_target_format(target_format, WRITABLE_IMAGE_FORMATS)
    frames = load_image(input_path)

    if not frames:
        raise ValueError(f"Could not decode image from {input_path.name}")

    processed_frames: List[Image.Image] = []
    try:
        processed_frames = [
            apply_image_transformations(
                frame,
                width=width,
                height=height,
                maintain_aspect_ratio=maintain_aspect_ratio,
                grayscale=grayscale,
                bg_color=bg_color
            )
            for frame in frames
        ]

        primary_img = processed_frames[0]

        # Format-specific export routing
        if target_format in ["jpg", "jpeg"]:
            rgb_img = _composite_to_rgb(primary_img, bg_color)
            try:
                rgb_img.save(str(output_path), "JPEG", quality=quality, dpi=(dpi, dpi), optimize=True)
            finally:
                rgb_img.close()

        elif target_format == "png":
            png_img = _normalize_mode_for_resize(primary_img)
            try:
                png_img.save(str(output_path), "PNG", optimize=True, dpi=(dpi, dpi))
            finally:
                if png_img is not primary_img:
                    png_img.close()

        elif target_format == "webp":
            webp_frames = [_normalize_mode_for_resize(f) for f in processed_frames]
            try:
                save_kwargs = {"quality": quality, "method": 4}
                if len(webp_frames) > 1:
                    raw_duration = frames[0].info.get("duration", 100)
                    duration = raw_duration if isinstance(raw_duration, (int, list, tuple)) and raw_duration else 100
                    webp_frames[0].save(
                        str(output_path),
                        "WEBP",
                        save_all=True,
                        append_images=webp_frames[1:],
                        duration=duration,
                        loop=frames[0].info.get("loop", 0),
                        **save_kwargs
                    )
                else:
                    webp_frames[0].save(str(output_path), "WEBP", **save_kwargs)
            finally:
                for orig, norm in zip(processed_frames, webp_frames):
                    if norm is not orig:
                        norm.close()

        elif target_format == "avif":
            if not features.check("avif"):
                raise RuntimeError("AVIF encoding requires Pillow >= 11.3 with libavif support.")
            export_img = primary_img
            if export_img.mode not in ("RGB", "RGBA"):
                export_img = export_img.convert("RGBA" if export_img.mode in ("LA", "P") else "RGB")
            try:
                export_img.save(str(output_path), "AVIF", quality=quality)
            finally:
                if export_img is not primary_img:
                    export_img.close()

        elif target_format in ["heic", "heif"]:
            export_img = primary_img
            if export_img.mode not in ("RGB", "RGBA"):
                export_img = export_img.convert("RGBA" if export_img.mode in ("LA", "P") else "RGB")
            try:
                heif_file = pillow_heif.from_pillow(export_img)
                heif_file.save(str(output_path), quality=quality, format="HEIF")
            finally:
                if export_img is not primary_img:
                    export_img.close()

        elif target_format == "ico":
            if not ico_sizes:
                ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
            ico_img = primary_img.convert("RGBA") if primary_img.mode != "RGBA" else primary_img
            try:
                max_dim = max(ico_img.width, ico_img.height)
                filtered_sizes = [s for s in ico_sizes if s[0] <= max_dim and s[1] <= max_dim]
                if not filtered_sizes:
                    filtered_sizes = [(min(256, ico_img.width), min(256, ico_img.height))]
                ico_img.save(str(output_path), format="ICO", sizes=filtered_sizes)
            finally:
                if ico_img is not primary_img:
                    ico_img.close()

        elif target_format == "bmp":
            rgb_img = _composite_to_rgb(primary_img, bg_color)
            try:
                rgb_img.save(str(output_path), "BMP")
            finally:
                rgb_img.close()

        elif target_format in ["tiff", "tif"]:
            tiff_frames = [_normalize_mode_for_resize(f) for f in processed_frames]
            try:
                if len(tiff_frames) > 1:
                    tiff_frames[0].save(
                        str(output_path),
                        "TIFF",
                        save_all=True,
                        append_images=tiff_frames[1:],
                        dpi=(dpi, dpi),
                        compression="tiff_deflate"
                    )
                else:
                    tiff_frames[0].save(str(output_path), "TIFF", dpi=(dpi, dpi), compression="tiff_deflate")
            finally:
                for orig, norm in zip(processed_frames, tiff_frames):
                    if norm is not orig:
                        norm.close()

        elif target_format == "gif":
            gif_frames = [_normalize_mode_for_resize(f) for f in processed_frames]
            try:
                if len(gif_frames) > 1:
                    raw_duration = frames[0].info.get("duration", 100)
                    duration = raw_duration if isinstance(raw_duration, (int, list, tuple)) and raw_duration else 100
                    gif_frames[0].save(
                        str(output_path),
                        "GIF",
                        save_all=True,
                        append_images=gif_frames[1:],
                        duration=duration,
                        loop=frames[0].info.get("loop", 0),
                        optimize=True
                    )
                else:
                    gif_frames[0].save(str(output_path), "GIF")
            finally:
                for orig, norm in zip(processed_frames, gif_frames):
                    if norm is not orig:
                        norm.close()

        elif target_format == "pdf":
            rgb_frames = [_composite_to_rgb(f, bg_color) for f in processed_frames]
            try:
                if len(rgb_frames) > 1:
                    rgb_frames[0].save(str(output_path), "PDF", save_all=True, append_images=rgb_frames[1:], resolution=dpi)
                else:
                    rgb_frames[0].save(str(output_path), "PDF", resolution=dpi)
            finally:
                for rf in rgb_frames:
                    rf.close()

        elif target_format == "svg":
            svg_img = _normalize_mode_for_resize(primary_img)
            try:
                buf = io.BytesIO()
                svg_img.save(buf, format="PNG")
                b64_data = base64.b64encode(buf.getvalue()).decode('ascii')
                w, h = svg_img.size
                svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <image width="{w}" height="{h}" xlink:href="data:image/png;base64,{b64_data}"/>
</svg>'''
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(svg_content)
            finally:
                if svg_img is not primary_img:
                    svg_img.close()

        elif target_format == "tga":
            tga_img = primary_img
            if tga_img.mode not in ("RGB", "RGBA", "L"):
                tga_img = tga_img.convert("RGBA" if tga_img.mode in ("LA", "P") else "RGB")
            try:
                tga_img.save(str(output_path), "TGA")
            finally:
                if tga_img is not primary_img:
                    tga_img.close()
    finally:
        for f in frames:
            try:
                f.close()
            except Exception:
                pass
        for pf in processed_frames:
            try:
                pf.close()
            except Exception:
                pass

    return output_path
