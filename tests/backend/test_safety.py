import importlib.util
from pathlib import Path
import pytest
from sqlalchemy.exc import IntegrityError
from studio.models import PublishTask
from studio.db import SessionLocal

P = "/api/v1"


def test_db_rejects_duplicate_active_task(client, post):
    task = client.post(P + "/publish-tasks", json={"post_id": post["id"]}).json()
    with SessionLocal() as db:
        db.add(
            PublishTask(
                **{
                    k: task[k]
                    for k in [
                        "workspace_id",
                        "post_id",
                        "account_id",
                        "version_id",
                        "status",
                        "operator_id",
                    ]
                }
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_changed_rule_invalidates_previous_review(client, post):
    client.post(P + "/posts/" + post["id"] + "/compliance-check")
    task = client.post(P + "/publish-tasks", json={"post_id": post["id"]}).json()
    client.post(
        P + "/compliance-rules", json={"term": "真实", "suggestion": "核实依据"}
    )
    assert client.get(P + "/posts/" + post["id"] + "/compliance-check").json() is None
    assert (
        client.post(
            P + "/publish-tasks/" + task["id"] + "/prepare",
            json={"final_confirmed": True},
        ).status_code
        == 422
    )


def helper():
    spec = importlib.util.spec_from_file_location(
        "helper", Path(__file__).resolve().parents[2] / "apps/profile-helper/helper.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_helper_rejects_escape_and_symlinks(tmp_path, monkeypatch):
    h = helper()
    h.BASE = tmp_path / "profiles"
    for value in ["../evil", "/etc/passwd", "a/b", ";ls", ""]:
        with pytest.raises(ValueError):
            h.profile_path(value)
    h.safe_root()
    (h.BASE / "linked").symlink_to(tmp_path)
    with pytest.raises(ValueError):
        h.profile_path("linked")


def test_helper_create_status_double_confirm_delete(tmp_path, monkeypatch, capsys):
    h = helper()
    h.BASE = tmp_path / "profiles"
    answers = iter(["my-profile"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    assert h.main(["create", "my-profile"]) == 0
    assert (h.BASE / "my-profile" / "rednote-profile.json").exists()
    assert h.main(["status", "my-profile"]) == 0
    answers = iter(["my-profile", "wrong"])
    assert h.main(["delete", "my-profile"]) == 1
    assert (h.BASE / "my-profile").exists()
    answers = iter(["my-profile", "DELETE my-profile"])
    assert h.main(["delete", "my-profile"]) == 0
    assert not (h.BASE / "my-profile").exists()


def test_helper_open_uses_argument_array_and_visible_official_page(
    tmp_path, monkeypatch
):
    h = helper()
    h.BASE = tmp_path / "profiles"
    monkeypatch.setattr("builtins.input", lambda _: "my-profile")
    h.main(["create", "my-profile"])
    monkeypatch.setattr(h, "chrome", lambda: "/safe/chrome")
    calls = []
    monkeypatch.setattr(
        h.subprocess, "Popen", lambda args, **kwargs: calls.append((args, kwargs))
    )
    assert h.main(["open", "my-profile"]) == 0
    assert calls[0][0][-1] == "https://creator.xiaohongshu.com/"
    assert "--new-window" in calls[0][0] and not calls[0][1].get("shell")


def test_bearer_token_required_when_enabled(client, monkeypatch):
    monkeypatch.setenv("STUDIO_ACCESS_TOKEN", "unit-test-only")
    assert client.get(P + "/posts").status_code == 401
    assert (
        client.get(P + "/posts", headers={"Authorization": "Bearer wrong"}).status_code
        == 401
    )
    assert (
        client.get(
            P + "/posts", headers={"Authorization": "Bearer unit-test-only"}
        ).status_code
        == 200
    )
