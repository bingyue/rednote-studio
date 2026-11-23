import os, sys, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="rednote-e2e-")
os.environ["AI_MODE"] = "mock"
os.environ["ALLOWED_ORIGINS"] = "http://127.0.0.1:5175"
sys.path.insert(0, str(root / "apps/api"))
from studio.db import Base, engine, SessionLocal
from studio.seed import seed

Base.metadata.create_all(engine)
with SessionLocal() as db:
    seed(db)
os.execv(
    sys.executable,
    [
        sys.executable,
        "-m",
        "uvicorn",
        "studio.main:app",
        "--app-dir",
        str(root / "apps/api"),
        "--host",
        "127.0.0.1",
        "--port",
        "8011",
    ],
)
