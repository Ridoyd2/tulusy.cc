import os
from pathlib import Path
import uvicorn

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

if __name__ == "__main__":
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    host = os.getenv("UVICORN_HOST", "127.0.0.1").strip()
    port = int(os.getenv("UVICORN_PORT", "8480").strip() or "8480")
    workers = int(os.getenv("UVICORN_WORKERS", "1").strip() or "1")
    reload_flag = (
        os.getenv("UVICORN_RELOAD", "false" if app_env == "production" else "true").lower()
        in ("true", "1", "yes")
    ) and workers == 1

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        workers=workers if not reload_flag else 1,
        reload=reload_flag,
        proxy_headers=True,
        forwarded_allow_ips="127.0.0.1",
    )
