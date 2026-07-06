import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import analytics, attachments, audit, auth, dashboard, records, users

logger = logging.getLogger("qas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="QAS — Quality, Security & Environment", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log the full traceback server-side; never leak internals to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error — please try again or contact support."},
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(records.router)
app.include_router(attachments.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        logger.exception("Health check: database unreachable")
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "down"})


# Serve the built frontend (frontend/dist) so the whole app runs on one port.
# In development, Vite (port 5173) still proxies /api here as before.
_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        # SPA fallback: let React Router handle /analytics, /quality/…, etc.
        return FileResponse(_dist / "index.html")
