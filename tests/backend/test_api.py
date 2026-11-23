from studio.db import SessionLocal, uid
from studio.models import User, Workspace, WorkspaceMember, CreatorAccount, Post
from studio.seed import LOCAL_USER

P = "/api/v1"


def patch(client, post, **values):
    return client.patch(
        P + "/posts/" + post["id"], json={"revision": post["revision"], **values}
    )


def test_draft_autosave_restore_delete(client, post):
    assert post["revision"] == 1
    old = client.get(P + "/posts/" + post["id"] + "/versions").json()[0]
    updated = patch(client, post, title="编辑后的标题").json()
    assert updated["revision"] == 2
    assert patch(client, post, body="旧客户端").status_code == 409
    restored = client.post(
        P + f"/posts/{post['id']}/restore/{old['id']}",
        json={"revision": updated["revision"]},
    ).json()
    assert restored["title"] == post["title"] and restored["revision"] == 3
    assert len(client.get(P + "/posts/" + post["id"] + "/versions").json()) == 3
    assert client.delete(P + "/posts/" + post["id"]).status_code == 204
    assert client.get(P + "/posts/" + post["id"]).status_code == 404


def test_all_skills_schema_and_failures(client, post):
    skills = client.get(P + "/skills").json()
    assert len(skills) == 8
    for s in skills:
        r = client.post(
            P + f"/skills/{s['id']}/run",
            json={
                "post_id": post["id"],
                "input": {
                    "topic": "轻量工作",
                    "reference": "今天记录一个我自己的真实生活片段。",
                    "own_sample": "我的习惯是先慢下来。再认真记录。",
                    "own_work": True,
                },
            },
        ).json()
        assert r["status"] == "SUCCEEDED", (s["id"], r)
        assert r["output"]["items"] and isinstance(r["output"]["patch"], dict)
        assert r["provider"] == "mock"
        assert (
            client.get(P + "/skill-runs/" + r["id"]).json()["usage"]["prompt_tokens"]
            == 0
        )
    invalid = client.post(
        P + "/skills/note_writer/run",
        json={"post_id": post["id"], "input": {"command": "rm -rf"}},
    ).json()
    assert invalid["status"] == "FAILED" and invalid["error"]
    assert client.post(P + "/skills/unknown/run", json={"input": {}}).status_code == 404
    bad = client.post(
        P + "/skills/style_rewriter/run",
        json={"input": {"own_sample": "第三方内容", "own_work": False}},
    ).json()
    assert bad["status"] == "FAILED"
    pipeline = client.post(P + "/posts/" + post["id"] + "/pipeline", json={}).json()
    assert len(pipeline["runs"]) == 5 and pipeline["patch"]["cover"]
    assert client.get(P + "/posts/" + post["id"]).json()["body"] == post["body"]


def test_compliance_unicode_offsets_context_and_ignore(client, post):
    updated = patch(
        client,
        post,
        body="🌿 不要相信保证有效，保证有效需要依据。",
        cover={"title": "最好的一天"},
    ).json()
    result = client.post(
        P + "/posts/" + post["id"] + "/compliance-check?ai=true"
    ).json()
    hits = [f for f in result["findings"] if f["field"] == "body"]
    assert len(hits) == 2
    for f in hits:
        assert updated["body"][f["span_start"] : f["span_end"]] == f["matched_text"]
    assert any(f["source_type"] == "mock_context" for f in result["findings"])
    f = hits[0]
    assert (
        client.post(
            P + "/compliance-findings/" + f["id"] + "/ignore",
            json={"reason": "已核实为否定语境"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            P + "/compliance-findings/" + f["id"] + "/ignore",
            json={"reason": "重复判断不可覆盖"},
        ).status_code
        == 409
    )
    changed = patch(client, updated, body="已修改").json()
    assert client.get(P + "/posts/" + post["id"] + "/compliance-check").json() is None
    assert (
        client.post(
            P + "/compliance-findings/" + hits[1]["id"] + "/ignore",
            json={"reason": "过期结果不得接受"},
        ).status_code
        == 409
    )


def test_workspace_account_binding_and_foreign_scope(client, post):
    accounts = client.get(P + "/accounts").json()
    changed = patch(client, post, account_id=accounts[1]["id"]).json()
    assert changed["account_id"] == accounts[1]["id"]
    assert any(
        p["id"] == post["id"]
        for p in client.get(P + "/posts?account_id=" + accounts[1]["id"]).json()
    )
    with SessionLocal() as db:
        other = User(name="other")
        db.add(other)
        db.flush()
        ws = Workspace(owner_id=other.id, name="Private")
        db.add(ws)
        db.flush()
        a = CreatorAccount(workspace_id=ws.id, name="Private account")
        db.add(a)
        db.flush()
        p = Post(workspace_id=ws.id, account_id=a.id, title="Private")
        db.add(p)
        db.commit()
        aid = a.id
        pid = p.id
        wid = ws.id
    assert client.get(P + "/accounts/" + aid).status_code == 404
    assert client.get(P + "/posts/" + pid).status_code == 404
    assert patch(client, changed, account_id=aid).status_code == 404
    assert client.get(P + "/posts", headers={"X-Workspace-ID": wid}).status_code == 403


def test_publish_state_machine_and_repeated_link(client, post):
    t = client.post(P + "/publish-tasks", json={"post_id": post["id"]}).json()
    path = P + "/publish-tasks/" + t["id"]
    assert (
        client.post(P + "/publish-tasks", json={"post_id": post["id"]}).status_code
        == 409
    )
    assert (
        client.post(
            path + "/confirm",
            json={
                "url": "https://www.xiaohongshu.com/explore/" + "a" * 24,
                "user_confirmed": True,
            },
        ).status_code
        == 409
    )
    assert (
        client.post(path + "/prepare", json={"final_confirmed": True}).status_code
        == 422
    )
    client.post(P + "/posts/" + post["id"] + "/compliance-check")
    assert (
        client.post(path + "/prepare", json={"final_confirmed": False}).status_code
        == 422
    )
    assert (
        client.post(path + "/prepare", json={"final_confirmed": True}).json()["status"]
        == "READY"
    )
    changed = patch(client, post, title="内容修改后").json()
    assert (
        client.post(
            path + "/transition", json={"status": "PUBLISHING_ASSISTED"}
        ).status_code
        == 422
    )
    client.post(path + "/refresh")
    client.post(P + "/posts/" + post["id"] + "/compliance-check")
    client.post(path + "/prepare", json={"final_confirmed": True})
    assert (
        client.post(
            path + "/transition", json={"status": "PUBLISHING_ASSISTED"}
        ).json()["status"]
        == "PUBLISHING_ASSISTED"
    )
    for url in [
        "https://xiaohongshu.com.evil.example/explore/" + "a" * 24,
        "javascript:alert(1)",
        "https://www.xiaohongshu.com/",
        "https://evil@www.xiaohongshu.com/explore/" + "a" * 24,
    ]:
        assert (
            client.post(
                path + "/confirm", json={"url": url, "user_confirmed": True}
            ).status_code
            == 422
        )
    result = client.post(
        path + "/confirm",
        json={
            "url": "https://www.xiaohongshu.com/explore/"
            + "a" * 24
            + "?xsec_token=private",
            "user_confirmed": True,
        },
    )
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "PUBLISHED_CONFIRMED"
    assert "?" not in result.json()["publication"]["url"]
    assert (
        client.post(
            path + "/confirm",
            json={
                "url": "https://www.xiaohongshu.com/explore/" + "a" * 24,
                "user_confirmed": True,
            },
        ).status_code
        == 409
    )
    assert any(
        p["post_id"] == post["id"] for p in client.get(P + "/publications").json()
    )
    assert client.delete(P + "/posts/" + post["id"]).status_code == 409


def test_negative_upload_paths_input_and_origin(client, post):
    assert (
        client.post(
            P + "/assets",
            files={
                "file": (
                    "../evil.svg",
                    b'<svg onload="alert(1)"></svg>',
                    "image/svg+xml",
                )
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            P + "/assets", files={"file": ("fake.jpg", b"not image", "image/jpeg")}
        ).status_code
        == 422
    )
    import io
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (20, 20)).save(buf, format="PNG")
    r = client.post(
        P + "/assets", files={"file": ("../../path.png", buf.getvalue(), "image/png")}
    )
    assert r.status_code == 201
    asset = r.json()
    assert "/" not in asset["filename"] and asset["name"] == "path.png"
    assert (
        client.get(P + "/assets/" + asset["id"] + "/file").headers["content-type"]
        == "image/jpeg"
    )
    assert patch(client, post, asset_ids=[asset["id"]]).status_code == 200
    assert (
        client.post(
            P + "/accounts/" + post["account_id"] + "/profile",
            json={"alias": "bad", "local_ref": "../../etc"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            P + "/ideas",
            json={"title": "x"},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            P + "/posts",
            json={"account_id": post["account_id"], "title": "x", "unexpected": True},
        ).status_code
        == 422
    )
    assert client.get(P + "/posts/" + uid()).json()["request_id"]


def test_metrics_atomic_validation_latest_snapshot(client, post):
    pub = client.get(P + "/publications").json()[0]
    pid = pub["post_id"]
    assert (
        client.post(
            P + "/post-metrics/import",
            json={
                "rows": [
                    {"post_id": pid, "views": 100},
                    {"post_id": post["id"], "views": 30},
                ]
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            P + "/post-metrics/import", json={"rows": [{"post_id": pid, "views": -1}]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            P + "/post-metrics/import",
            json={"rows": [{"post_id": pid, "views": 9000, "likes": 10, "saves": 3}]},
        ).json()["imported"]
        == 1
    )
    assert (
        client.get(P + "/analytics/summary").json()["latest_metrics"]["views"] >= 9000
    )


def test_seeds_and_settings(client):
    assert len(client.get(P + "/posts").json()) == 20
    assert len(client.get(P + "/accounts").json()) == 3
    assert len(client.get(P + "/publish-tasks").json()) == 5
    assert len(client.get(P + "/post-metrics/import").json()) >= 12
    assert len(client.get(P + "/compliance-rules").json()) >= 20
    assert client.get(P + "/settings").json()["ai_mode"] == "mock"
    assert (
        client.patch(
            P + "/settings",
            json={"title_limit": 30, "body_limit": 2000, "rule_source": "用户编辑要求"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            P + "/compliance-rules", json={"term": "强制", "suggestion": "自愿"}
        ).status_code
        == 201
    )


def test_ordinal_context_is_not_ranking_claim(client, post):
    updated = patch(
        client, post, body="第一步：记录。第一天：实践。行业第一需要证据。"
    ).json()
    result = client.post(P + "/posts/" + post["id"] + "/compliance-check").json()
    hits = [f for f in result["findings"] if f["matched_text"] == "第一"]
    assert (
        len(hits) == 1
        and updated["body"][hits[0]["span_start"] - 2 : hits[0]["span_start"]] == "行业"
    )


def test_same_origin_image_session_uses_httponly_cookie(client, monkeypatch):
    monkeypatch.setenv("STUDIO_ACCESS_TOKEN", "only-local-token")
    r = client.get(
        P + "/settings", headers={"Authorization": "Bearer only-local-token"}
    )
    assert r.status_code == 200
    assert (
        "HttpOnly" in r.headers["set-cookie"]
        and "SameSite=strict" in r.headers["set-cookie"]
    )
    assert client.get(P + "/accounts").status_code == 200


def test_unknown_route_has_uniform_error(client):
    response = client.get("/api/v1/not-a-route")
    assert response.status_code == 404
    assert set(response.json()) == {"code", "message", "details", "request_id"}
