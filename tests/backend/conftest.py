import os, sys, tempfile
from pathlib import Path

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="rednote-tests-")
os.environ["AI_MODE"] = "mock"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/api"))
import pytest
from fastapi.testclient import TestClient
from studio.db import Base, engine, SessionLocal
from studio.main import app
from studio.seed import seed


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def post(client):
    account = client.get("/api/v1/accounts").json()[0]
    return client.post(
        "/api/v1/posts",
        json={
            "account_id": account["id"],
            "title": "我的日常清单",
            "body": "分享真实体验，给生活留一点空间。",
        },
    ).json()
