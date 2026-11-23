import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))
from studio.db import SessionLocal
from studio.seed import seed

with SessionLocal() as db:
    seed(db)
print("Demo data ready (idempotent).")
