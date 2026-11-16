from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.routers import image_converter, document_converter, pdf_tools, web_tools, file_host
from app.config import SUPPORTED_IMAGE_FORMATS, SUPPORTED_DOC_FORMATS, ALLOWED_ORIGINS
from app.services.utils import startup_cleanup
from app.services.r2_storage_service import cleanup_expired_files_job

async def periodic_expiry_cleanup():
    """Background task to regularly purge expired files (7-day lifecycle)."""
    while True:
        try:
            cleanup_expired_files_job()
        except Exception as e:
            print(f"Error running periodic expiry cleanup: {e}")
        await asyncio.sleep(600)  # Run every 10 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: clean temp directories
    startup_cleanup()
    cleanup_task = asyncio.create_task(periodic_expiry_cleanup())
    yield
    cleanup_task.cancel()

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
            {"ext": "svg", "name": "SVG Vector Graphic", "mime": "image/svg+xml", "category": "vector", "lossless": True},
            {"ext": "ico", "name": "ICO Windows Icon", "mime": "image/x-icon", "category": "icon", "lossless": True},
            {"ext": "bmp", "name": "BMP Bitmap Image", "mime": "image/bmp", "category": "image", "lossless": True},
            {"ext": "tiff", "name": "TIFF High-Res Image", "mime": "image/tiff", "category": "image", "lossless": True},
            {"ext": "gif", "name": "GIF Animated Image", "mime": "image/gif", "category": "image", "lossless": True},
            {"ext": "heic", "name": "HEIC Apple Photo", "mime": "image/heic", "category": "image", "lossless": False},
            {"ext": "psd", "name": "Photoshop PSD Document", "mime": "image/vnd.adobe.photoshop", "category": "image", "lossless": True},
            {"ext": "tga", "name": "TGA Truevision Targa", "mime": "image/x-tga", "category": "image", "lossless": True},
            {"ext": "pdf", "name": "PDF Document (Image Page)", "mime": "application/pdf", "category": "document", "lossless": True}
        ],
        "documents": [
            {"ext": "docx", "name": "Microsoft Word Document", "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "category": "document"},
            {"ext": "pptx", "name": "Microsoft PowerPoint Presentation", "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "category": "document"},
            {"ext": "pdf", "name": "Portable Document Format (PDF)", "mime": "application/pdf", "category": "document"},
            {"ext": "txt", "name": "Plain Text File", "mime": "text/plain", "category": "document"},
            {"ext": "xlsx", "name": "Excel Spreadsheet", "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "category": "document"},
            {"ext": "csv", "name": "Comma Separated Values", "mime": "text/csv", "category": "document"}
        ]
    }
