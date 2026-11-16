import io
import os
from pathlib import Path
from typing import Optional, List, Tuple
from PIL import Image, ImageOps
import pillow_heif
from app.config import MAX_PDF_PAGES
from app.services.utils import validate_image_params

# Register HEIF/HEIC opener with Pillow
pillow_heif.register_heif_opener()

try:
    from psd_tools import PSDImage
    HAS_PSD = True
except ImportError:
    HAS_PSD = False

try:
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPM
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
    
    # 1. Handle SVG files
    if ext == 'svg' and HAS_SVGLIB:
        try:
            drawing = svg2rlg(str(input_path))
            if drawing:
                # Render to high-res PNG in memory
                buf = io.BytesIO()
                renderPM.drawToFile(drawing, buf, fmt="PNG", dpi=300)
                buf.seek(0)
                return [Image.open(buf)]
        except Exception as e:
            print(f"SVG load error via svglib: {e}")

    # 2. Handle PSD files
    if ext == 'psd' and HAS_PSD:
        try:
            psd = PSDImage.open(str(input_path))
            pil_img = psd.composite()
            if pil_img:
                return [pil_img]
        except Exception as e:
            print(f"PSD load error via psd_tools: {e}")

    # 3. Handle PDF files as image input
    if ext == 'pdf':
        doc = fitz.open(str(input_path))
        try:
            if len(doc) > MAX_PDF_PAGES:
                raise ValueError(f"PDF exceeds maximum supported page limit ({MAX_PDF_PAGES} pages).")
            frames = []
            for page in doc:
                pix = page.get_pixmap(dpi=300)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                frames.append(img)
            if frames:
                return frames
        finally:
            doc.close()

    # 4. Standard and HEIC/HEIF / TIFF / WebP / BMP / GIF etc. via Pillow
    img = Image.open(str(input_path))
    frames = []
    try:
        is_animated = getattr(img, "is_animated", False) and getattr(img, "n_frames", 1) > 1
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
                    frames.append(img.copy())
                    img.seek(img.tell() + 1)
            except (EOFError, ValueError, AttributeError, OSError):
                pass  # End of frame sequence or non-seekable image

        if not frames:
            frames = [img.copy()]
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
        if img.mode == "P":
            img = img.convert("RGBA" if "transparency" in img.info else "RGB")
        img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Grayscale conversion (preserve alpha channel if transparent so backgrounds don't turn black)
    if grayscale:
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            alpha = rgba.split()[-1]
            lum = ImageOps.grayscale(rgba.convert("RGB"))
            img = Image.merge("LA", (lum, alpha))
            rgba.close()
        else:
            img = ImageOps.grayscale(img)

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
    target_format = target_format.lower().lstrip('.')
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
            if primary_img.mode not in ("RGB", "RGBA", "L", "LA"):
                primary_img = primary_img.convert("RGBA")
            primary_img.save(str(output_path), "PNG", optimize=True, dpi=(dpi, dpi))

        elif target_format == "webp":
            save_kwargs = {"quality": quality, "method": 4}
            if len(processed_frames) > 1:
                primary_img.save(
                    str(output_path),
                    "WEBP",
                    save_all=True,
                    append_images=processed_frames[1:],
                    duration=frames[0].info.get("duration", 100),
                    loop=frames[0].info.get("loop", 0),
                    **save_kwargs
                )
            else:
                primary_img.save(str(output_path), "WEBP", **save_kwargs)

        elif target_format == "avif":
            export_img = primary_img
            if export_img.mode not in ("RGB", "RGBA"):
                export_img = export_img.convert("RGBA" if export_img.mode in ("LA", "P") else "RGB")
            try:
                export_img.save(str(output_path), "AVIF", quality=quality)
            except Exception:
                heif_file = pillow_heif.from_pillow(export_img)
                heif_file.save(str(output_path), quality=quality, enc_format="AVIF")

        elif target_format in ["heic", "heif"]:
            export_img = primary_img
            if export_img.mode not in ("RGB", "RGBA"):
                export_img = export_img.convert("RGBA" if export_img.mode in ("LA", "P") else "RGB")
            heif_file = pillow_heif.from_pillow(export_img)
            heif_file.save(str(output_path), quality=quality, enc_format="HEIC")

        elif target_format == "ico":
            if not ico_sizes:
                ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
            ico_img = primary_img.convert("RGBA") if primary_img.mode != "RGBA" else primary_img
            ico_img.save(str(output_path), format="ICO", sizes=ico_sizes)

        elif target_format == "bmp":
            rgb_img = _composite_to_rgb(primary_img, bg_color)
            try:
                rgb_img.save(str(output_path), "BMP")
            finally:
                rgb_img.close()

        elif target_format in ["tiff", "tif"]:
            if len(processed_frames) > 1:
                primary_img.save(
                    str(output_path),
                    "TIFF",
                    save_all=True,
                    append_images=processed_frames[1:],
                    dpi=(dpi, dpi),
                    compression="tiff_deflate"
                )
            else:
                primary_img.save(str(output_path), "TIFF", dpi=(dpi, dpi), compression="tiff_deflate")

        elif target_format == "gif":
            if len(processed_frames) > 1:
                primary_img.save(
                    str(output_path),
                    "GIF",
                    save_all=True,
                    append_images=processed_frames[1:],
                    duration=frames[0].info.get("duration", 100),
                    loop=frames[0].info.get("loop", 0),
                    optimize=True
                )
            else:
                primary_img.save(str(output_path), "GIF")

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
            import base64
            buf = io.BytesIO()
            primary_img.save(buf, format="PNG")
            b64_data = base64.b64encode(buf.getvalue()).decode('ascii')
            w, h = primary_img.size
            svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <image width="{w}" height="{h}" xlink:href="data:image/png;base64,{b64_data}"/>
</svg>'''
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(svg_content)

        elif target_format == "tga":
            tga_img = primary_img
            if tga_img.mode not in ("RGB", "RGBA", "L"):
                tga_img = tga_img.convert("RGBA" if tga_img.mode in ("LA", "P") else "RGB")
            tga_img.save(str(output_path), "TGA")

        else:
            primary_img.save(str(output_path), format=target_format.upper())
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
