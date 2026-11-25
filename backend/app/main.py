from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.routers import image_converter, document_converter, pdf_tools, web_tools, file_host
from app.config import SUPPORTED_IMAGE_FORMATS, SUPPORTED_DOC_FORMATS, ALLOWED_ORIGINS, TEMP_FILE_TTL_SECONDS
from app.services.utils import startup_cleanup, cleanup_stale_temp_dirs
from app.services.r2_storage_service import cleanup_expired_files_job

async def periodic_expiry_cleanup():
    """Background task to regularly purge expired hosted files and stale converter temp directories."""
    while True:
        try:
            await asyncio.to_thread(cleanup_expired_files_job)
            await asyncio.to_thread(cleanup_stale_temp_dirs, TEMP_FILE_TTL_SECONDS)
        except Exception as e:
            print(f"Error running periodic expiry cleanup: {e}")
        await asyncio.sleep(600)  # Run every 10 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: clean stale temp directories safely
    startup_cleanup()
    cleanup_task = asyncio.create_task(periodic_expiry_cleanup())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Tulusy API",
    description="Universal Image, Document, and File Processing Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for local frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Include Routers
app.include_router(image_converter.router)
app.include_router(document_converter.router)
app.include_router(pdf_tools.router)
app.include_router(web_tools.router)
app.include_router(file_host.router)

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Tulusy Engine",
        "version": "1.0.0",
        "supported_images": SUPPORTED_IMAGE_FORMATS,
        "supported_docs": SUPPORTED_DOC_FORMATS
    }

@app.get("/api/formats")
def get_supported_formats():
    return {
        "images": [
            {"ext": "png", "name": "PNG Image", "mime": "image/png", "category": "image", "lossless": True},
            {"ext": "jpg", "name": "JPEG Image", "mime": "image/jpeg", "category": "image", "lossless": False},
            {"ext": "webp", "name": "WebP Modern Image", "mime": "image/webp", "category": "image", "lossless": True},
            {"ext": "avif", "name": "AVIF Next-Gen Image", "mime": "image/avif", "category": "image", "lossless": False},
            {"ext": "jxl", "name": "JPEG XL Next-Gen Image", "mime": "image/jxl", "category": "image", "lossless": True},
            {"ext": "jp2", "name": "JPEG 2000 Image", "mime": "image/jp2", "category": "image", "lossless": True},
            {"ext": "qoi", "name": "QOI Quite OK Image", "mime": "image/qoi", "category": "image", "lossless": True},
            {"ext": "dds", "name": "DDS DirectDraw Surface", "mime": "image/vnd-ms.dds", "category": "image", "lossless": True},
            {"ext": "ppm", "name": "PPM Netpbm Pixmap", "mime": "image/x-portable-pixmap", "category": "image", "lossless": True},
            {"ext": "svg", "name": "SVG Vector Graphic", "mime": "image/svg+xml", "category": "vector", "lossless": True},
            {"ext": "ico", "name": "ICO Windows Icon", "mime": "image/x-icon", "category": "icon", "lossless": True},
            {"ext": "icns", "name": "ICNS macOS App Icon", "mime": "image/icns", "category": "icon", "lossless": True},
            {"ext": "cur", "name": "CUR Windows Cursor", "mime": "image/x-icon", "category": "icon", "lossless": True, "input_only": True},
            {"ext": "bmp", "name": "BMP Bitmap Image", "mime": "image/bmp", "category": "image", "lossless": True},
            {"ext": "tiff", "name": "TIFF High-Res Image", "mime": "image/tiff", "category": "image", "lossless": True},
            {"ext": "gif", "name": "GIF Animated Image", "mime": "image/gif", "category": "image", "lossless": True},
            {"ext": "heic", "name": "HEIC Apple Photo", "mime": "image/heic", "category": "image", "lossless": False},
            {"ext": "psd", "name": "Photoshop PSD Document", "mime": "image/vnd.adobe.photoshop", "category": "image", "lossless": True, "input_only": True},
            {"ext": "tga", "name": "TGA Truevision Targa", "mime": "image/x-tga", "category": "image", "lossless": True},
            {"ext": "cr2", "name": "Canon CR2 Camera RAW", "mime": "image/x-canon-cr2", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "cr3", "name": "Canon CR3 Camera RAW", "mime": "image/x-canon-cr3", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "nef", "name": "Nikon NEF Camera RAW", "mime": "image/x-nikon-nef", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "arw", "name": "Sony ARW Camera RAW", "mime": "image/x-sony-arw", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "dng", "name": "Adobe DNG Camera RAW", "mime": "image/x-adobe-dng", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "raf", "name": "Fujifilm RAF Camera RAW", "mime": "image/x-fuji-raf", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "orf", "name": "Olympus ORF Camera RAW", "mime": "image/x-olympus-orf", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "rw2", "name": "Panasonic RW2 Camera RAW", "mime": "image/x-panasonic-rw2", "category": "raw", "lossless": True, "input_only": True},
            {"ext": "pdf", "name": "PDF Document (Image Page)", "mime": "application/pdf", "category": "document", "lossless": True}
        ],
        "documents": [
            {"ext": "docx", "name": "Microsoft Word Document", "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "category": "document"},
            {"ext": "pptx", "name": "Microsoft PowerPoint Presentation", "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "category": "document"},
            {"ext": "pdf", "name": "Portable Document Format (PDF)", "mime": "application/pdf", "category": "document"},
            {"ext": "txt", "name": "Plain Text File", "mime": "text/plain", "category": "document"},
            {"ext": "md", "name": "Markdown Document", "mime": "text/markdown", "category": "document"},
            {"ext": "html", "name": "HTML Web Document", "mime": "text/html", "category": "document"},
            {"ext": "rtf", "name": "Rich Text Format", "mime": "application/rtf", "category": "document", "input_only": True},
            {"ext": "epub", "name": "EPUB E-Book", "mime": "application/epub+zip", "category": "document"},
            {"ext": "xlsx", "name": "Excel Spreadsheet", "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "category": "document"},
            {"ext": "csv", "name": "Comma Separated Values", "mime": "text/csv", "category": "data"},
            {"ext": "json", "name": "JSON Data", "mime": "application/json", "category": "data"},
            {"ext": "yaml", "name": "YAML Configuration", "mime": "application/yaml", "category": "data"},
            {"ext": "xml", "name": "XML Structured Data", "mime": "application/xml", "category": "data"},
        ]
    }
