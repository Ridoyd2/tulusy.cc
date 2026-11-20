import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()

UPLOAD_DIR = BASE_DIR / "temp" / "uploads"
OUTPUT_DIR = BASE_DIR / "temp" / "outputs"
HOSTING_DIR = BASE_DIR / "data" / "hosted_files"
DATA_DIR = BASE_DIR / "data"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
HOSTING_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Maximum upload file size for converters (configurable via MAX_FILE_SIZE_MB; default 100MB)
_max_file_mb = int(os.getenv("MAX_FILE_SIZE_MB", "100").strip() or "100")
MAX_FILE_SIZE = max(1, _max_file_mb) * 1024 * 1024

# Safety caps against decompression/PDF page-explosion DoS
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "16384").strip() or "16384")
MAX_IMAGE_FRAMES = int(os.getenv("MAX_IMAGE_FRAMES", "300").strip() or "300")
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "200").strip() or "200")
MAX_XLSX_PDF_ROWS = int(os.getenv("MAX_XLSX_PDF_ROWS", "5000").strip() or "5000")
MAX_TXT_PDF_LINES = int(os.getenv("MAX_TXT_PDF_LINES", "10000").strip() or "10000")
TEMP_FILE_TTL_SECONDS = int(os.getenv("TEMP_FILE_TTL_SECONDS", "3600").strip() or "3600")

# Maximum file hosting size: 5GB
MAX_HOSTING_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5 GB in bytes
DEFAULT_HOSTING_EXPIRY_DAYS = 1  # 24 Hours (1 Day) default expiration

# CORS allowed origins
_default_origins = (
    "https://tulusy.cc,https://www.tulusy.cc"
    if APP_ENV == "production"
    else "https://tulusy.cc,https://www.tulusy.cc,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3480,http://127.0.0.1:3480"
)
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

# Cloudflare R2 Configuration
# Endpoint format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "").strip()
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "").strip()
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").strip()  # e.g., https://cdn.tulusy.cc or https://pub-...r2.dev

# Outbound Origin-IP Protection for Load Tester & Web Tools
# 1. OUTBOUND_PROXY_URL: HTTP/SOCKS5 proxy (e.g. http://127.0.0.1:40000 from `warp-cli mode proxy`)
# 2. CF_WORKER_RELAY_URL: Cloudflare Worker URL (see cloudflare-worker-relay.js) that proxies requests from CF Edge
# 3. PROTECT_VPS_IP: Blocks direct unproxied outbound load tests in production so attackers cannot log your VPS IP
OUTBOUND_PROXY_URL = os.getenv("OUTBOUND_PROXY_URL", "").strip()
CF_WORKER_RELAY_URL = os.getenv("CF_WORKER_RELAY_URL", "").strip()
CF_WORKER_SECRET = os.getenv("CF_WORKER_SECRET", "").strip()
PROTECT_VPS_IP = os.getenv("PROTECT_VPS_IP", "true").lower() in ("true", "1", "yes")

_extra_protected = {
    d.strip().lower().rstrip(".")
    for d in os.getenv("PROTECTED_DOMAINS", "").split(",")
    if d.strip()
}
PROTECTED_SELF_DOMAINS = {
    "tulusy.cc",
    "www.tulusy.cc",
    "tulusy.com",
    "www.tulusy.com",
    "toolsy4u.com",
    "www.toolsy4u.com",
} | _extra_protected

# Dangerous extensions blocked for anonymous security & AdSense policy protection
BLOCKED_HOSTING_EXTENSIONS = {
    "exe", "bat", "cmd", "sh", "bash", "vbs", "msi", "scr", "com", "pif",
    "jar", "ps1", "app", "dmg", "deb", "rpm", "apk"
}

# Supported formats mappings and metadata
SUPPORTED_IMAGE_FORMATS = [
    "png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "tiff", "ico",
    "svg", "heic", "heif", "psd", "tga", "pdf"
]

WRITABLE_IMAGE_FORMATS = {
    "png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "tiff", "tif",
    "ico", "svg", "heic", "heif", "tga", "pdf"
}

LEGACY_UNSUPPORTED_DOC_FORMATS = {"doc", "ppt", "xls"}

SUPPORTED_DOC_FORMATS = [
    "pdf", "docx", "pptx", "txt", "xlsx", "csv"
]
