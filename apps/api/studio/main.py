import os, re, json, time, io, secrets, csv
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import select, delete, func, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.exc import IntegrityError
from PIL import Image, UnidentifiedImageError
from .db import session, DATA_DIR, now, uid
from .models import *
from .schemas import *
from .seed import LOCAL_USER, LOCAL_WORKSPACE, version, snapshot
from .skills import definitions, execute
from .compliance import check_post, unresolved, rules_digest

app = FastAPI(title="RedNote Studio API", version="1.0.0")
origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:4174,http://localhost:4174,http://localhost:8088,http://127.0.0.1:8088",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Workspace-ID"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.environ.get(
        "ALLOWED_HOSTS", "localhost,127.0.0.1,testserver,api"
    ).split(","),
)


@app.middleware("http")
async def request_context(request, call_next):
    request.state.request_id = uid()
    if (
        request.method not in ["GET", "HEAD", "OPTIONS"]
        and request.headers.get("origin")
        and request.headers["origin"] not in origins
    ):
        return JSONResponse(
            status_code=403,
            content={
                "code": "ORIGIN_DENIED",
                "message": "请求来源未授权",
                "details": None,
                "request_id": request.state.request_id,
            },
        )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def error_response(request, code, message, status, details=None):
    return JSONResponse(
        status_code=status,
        content={
            "code": code,
            "message": message,
            "details": details,
            "request_id": getattr(request.state, "request_id", uid()),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    return error_response(request, "REQUEST_REJECTED", str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return error_response(
        request,
        "VALIDATION_ERROR",
        "输入格式不正确",
        422,
        [
            {"field": ".".join(map(str, e["loc"])), "message": e["msg"]}
            for e in exc.errors()
        ],
    )


@app.exception_handler(StaleDataError)
async def stale_error(request, exc):
    return error_response(
        request, "VERSION_CONFLICT", "稿件已被修改，请重新加载后重试", 409
    )


@app.exception_handler(IntegrityError)
async def conflict_error(request, exc):
    return error_response(request, "CONFLICT", "记录冲突或已提交，请刷新后查看", 409)


@app.exception_handler(Exception)
async def server_error(request, exc):
    # Do not leak model credentials, SQL, paths or prompts in HTTP responses.
    import logging

    logging.getLogger("studio").error(
        "request_id=%s exception_type=%s",
        getattr(request.state, "request_id", "unknown"),
        type(exc).__name__,
    )
    return error_response(
        request, "INTERNAL_ERROR", "请求未完成，请查看服务日志并使用请求 ID 排查", 500
    )


LOCAL_SESSION = secrets.token_urlsafe(32)


def scope(request: Request, response: Response, db: Session = Depends(session)):
    token = os.environ.get("STUDIO_ACCESS_TOKEN")
    if token:
        bearer_ok = secrets.compare_digest(
            request.headers.get("authorization", ""), "Bearer " + token
        )
        cookie_ok = secrets.compare_digest(
            request.cookies.get("studio_session", ""), LOCAL_SESSION
        )
        if not bearer_ok and not cookie_ok:
            raise HTTPException(401, "需要工作台访问令牌")
        if bearer_ok:
            response.set_cookie(
                "studio_session",
                LOCAL_SESSION,
                httponly=True,
                samesite="strict",
                secure=request.url.scheme == "https",
                max_age=28800,
            )
    workspace = request.headers.get("x-workspace-id", LOCAL_WORKSPACE)
    if not db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace,
            WorkspaceMember.user_id == LOCAL_USER,
        )
    ):
        raise HTTPException(403, "无权访问该工作区")
    return workspace


def record(db, model, id, w):
    obj = db.get(model, id)
    if not obj or obj.workspace_id != w:
        raise HTTPException(404, "记录不存在或不属于当前工作区")
    return obj


def serialize(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def account_data(db, a):
    data = serialize(a)
    p = db.scalar(select(BrowserProfileRef).where(BrowserProfileRef.account_id == a.id))
    data["profile"] = serialize(p) if p else None
    data["style_samples"] = [
        serialize(s)
        for s in db.scalars(
            select(CreatorStyleSample).where(CreatorStyleSample.account_id == a.id)
        )
    ]
    data["publication_count"] = db.scalar(
        select(func.count())
        .select_from(PublicationRecord)
        .join(PublishTask, PublicationRecord.task_id == PublishTask.id)
        .where(PublishTask.account_id == a.id)
    )
    return data


def validate_assets(db, data, w):
    for aid in data.get("asset_ids", []):
        record(db, Asset, aid, w)
    bg = (data.get("cover") or {}).get("background_asset_id")
    if bg:
        record(db, Asset, bg, w)


def sync_post_children(db, p):
    db.execute(delete(PostTag).where(PostTag.post_id == p.id))
    db.execute(delete(PostAsset).where(PostAsset.post_id == p.id))
    for tag in p.tags:
        db.add(PostTag(post_id=p.id, name=tag[:100]))
    for aid in p.asset_ids:
        db.add(PostAsset(post_id=p.id, asset_id=aid))


def task_data(db, t):
    data = serialize(t)
    v = db.get(PostVersion, t.version_id)
    data["snapshot"] = v.snapshot
    data["revision"] = v.revision
    a = db.get(CreatorAccount, t.account_id)
    data["account_name"] = a.name
    pub = db.scalar(select(PublicationRecord).where(PublicationRecord.task_id == t.id))
    data["publication"] = serialize(pub) if pub else None
    data["events"] = [
        serialize(e)
        for e in db.scalars(
            select(PublishEvent)
            .where(PublishEvent.task_id == t.id)
            .order_by(PublishEvent.created_at)
        )
    ]
    return data


def transition(db, t, status, detail=""):
    old = t.status
    # Conditional UPDATE makes concurrent state transitions mutually exclusive.
    updated = db.execute(
        update(PublishTask)
        .where(PublishTask.id == t.id, PublishTask.status == old)
        .values(
            status=status,
            updated_at=now(),
            error=detail if status == "FAILED" else None,
        ),
        execution_options={"synchronize_session": False},
    )
    if updated.rowcount != 1:
        raise HTTPException(409, "任务状态已变化，请刷新")
    db.expire(t)
    db.refresh(t)
    db.add(
        PublishEvent(
            workspace_id=t.workspace_id,
            task_id=t.id,
            user_id=LOCAL_USER,
            from_status=old,
            to_status=status,
            detail=detail,
        )
    )


P = "/api/v1"


@app.get(P + "/health")
def health():
    return {
        "status": "ok",
        "service": "RedNote Studio",
        "publishing": "manual",
        "official_api": "not_authorized",
    }


@app.get(P + "/settings")
def settings(w=Depends(scope), db=Depends(session)):
    workspace = db.get(Workspace, w)
    return {
        "workspace": serialize(workspace),
        "ai_mode": "live"
        if os.getenv("AI_MODE") == "live" and os.getenv("AI_API_KEY")
        else "mock",
        "ai_model": os.getenv("AI_MODEL", "未配置"),
        "official_publisher": False,
        "browser_assist": "复制 / 导出 / 用户打开官方页面",
        "profile_status": "未检测 · 需人工检查",
    }


@app.patch(P + "/settings")
def save_settings(data: SettingsInput, w=Depends(scope), db=Depends(session)):
    ws = db.get(Workspace, w)
    ws.settings = data.model_dump()
    db.commit()
    return serialize(ws)


@app.get(P + "/accounts")
def accounts(w=Depends(scope), db=Depends(session)):
    return [
        account_data(db, a)
        for a in db.scalars(
            select(CreatorAccount)
            .where(CreatorAccount.workspace_id == w)
            .order_by(CreatorAccount.created_at)
        )
    ]


@app.post(P + "/accounts", status_code=201)
def create_account(data: AccountInput, w=Depends(scope), db=Depends(session)):
    if data.authorized and not data.authorization.strip():
        raise HTTPException(422, "请填写授权来源")
    a = CreatorAccount(workspace_id=w, **data.model_dump())
    db.add(a)
    db.commit()
    return account_data(db, a)


@app.get(P + "/accounts/{id}")
def get_account(id: str, w=Depends(scope), db=Depends(session)):
    return account_data(db, record(db, CreatorAccount, id, w))


@app.patch(P + "/accounts/{id}")
def edit_account(id: str, data: AccountInput, w=Depends(scope), db=Depends(session)):
    a = record(db, CreatorAccount, id, w)
    for k, v in data.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return account_data(db, a)


@app.post(P + "/accounts/{id}/profile")
def profile_ref(id: str, data: ProfileInput, w=Depends(scope), db=Depends(session)):
    record(db, CreatorAccount, id, w)
    p = db.scalar(select(BrowserProfileRef).where(BrowserProfileRef.account_id == id))
    if not p:
        p = BrowserProfileRef(workspace_id=w, account_id=id)
        db.add(p)
    p.alias = data.alias
    p.local_ref = data.local_ref
    db.commit()
    return serialize(p)


@app.post(P + "/accounts/{id}/style-samples")
def style_sample(id: str, data: StyleInput, w=Depends(scope), db=Depends(session)):
    record(db, CreatorAccount, id, w)
    if not data.own_work:
        raise HTTPException(422, "仅接受你拥有使用权的样本")
    s = CreatorStyleSample(workspace_id=w, account_id=id, **data.model_dump())
    db.add(s)
    db.commit()
    return serialize(s)


@app.get(P + "/posts")
def posts(account_id: str | None = None, w=Depends(scope), db=Depends(session)):
    query = select(Post).where(Post.workspace_id == w)
    if account_id:
        record(db, CreatorAccount, account_id, w)
        query = query.where(Post.account_id == account_id)
    return [serialize(p) for p in db.scalars(query.order_by(Post.updated_at.desc()))]


@app.post(P + "/posts", status_code=201)
def create_post(data: PostCreate, w=Depends(scope), db=Depends(session)):
    record(db, CreatorAccount, data.account_id, w)
    values = data.model_dump()
    validate_assets(db, values, w)
    p = Post(workspace_id=w, **values)
    db.add(p)
    db.flush()
    sync_post_children(db, p)
    version(db, p, "新建草稿")
    db.commit()
    return serialize(p)


@app.get(P + "/posts/{id}")
def get_post(id: str, w=Depends(scope), db=Depends(session)):
    return serialize(record(db, Post, id, w))


@app.patch(P + "/posts/{id}")
def edit_post(id: str, data: PostPatch, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    if p.revision != data.revision:
        raise HTTPException(409, "版本冲突：稿件已有新版本，请重新加载")
    values = data.model_dump(exclude_none=True, exclude={"revision", "reason"})
    if values.get("account_id"):
        record(db, CreatorAccount, values["account_id"], w)
    validate_assets(db, values, w)
    if any(getattr(p, k) != v for k, v in values.items()):
        for k, v in values.items():
            setattr(p, k, v)
        p.updated_at = now()
        db.flush()
        sync_post_children(db, p)
        version(db, p, data.reason)
    db.commit()
    return serialize(p)


@app.delete(P + "/posts/{id}", status_code=204)
def remove_post(id: str, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    if db.scalar(select(PublishTask).where(PublishTask.post_id == id)):
        raise HTTPException(409, "稿件已有发布记录，请保留以供审计")
    db.execute(delete(PostMetricImport).where(PostMetricImport.post_id == id))
    db.delete(p)
    db.commit()


@app.get(P + "/posts/{id}/versions")
def versions(id: str, w=Depends(scope), db=Depends(session)):
    record(db, Post, id, w)
    return [
        serialize(v)
        for v in db.scalars(
            select(PostVersion)
            .where(PostVersion.post_id == id)
            .order_by(PostVersion.revision.desc())
        )
    ]


@app.post(P + "/posts/{id}/versions")
def add_version(id: str, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    p.updated_at = now()
    db.flush()
    v = version(db, p, "手动快照")
    db.commit()
    return serialize(v)


@app.post(P + "/posts/{id}/restore/{version_id}")
def restore(
    id: str, version_id: str, data: PostPatch, w=Depends(scope), db=Depends(session)
):
    p = record(db, Post, id, w)
    v = record(db, PostVersion, version_id, w)
    if v.post_id != id:
        raise HTTPException(404, "版本不属于该稿件")
    if p.revision != data.revision:
        raise HTTPException(409, "稿件已变化，请刷新")
    for k, value in v.snapshot.items():
        setattr(p, k, value)
    p.updated_at = now()
    db.flush()
    sync_post_children(db, p)
    version(db, p, f"恢复版本 {v.revision}")
    db.commit()
    return serialize(p)


@app.get(P + "/ideas")
def ideas(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(Idea).where(Idea.workspace_id == w).order_by(Idea.created_at.desc())
        )
    ]


@app.post(P + "/ideas", status_code=201)
def add_idea(data: IdeaInput, w=Depends(scope), db=Depends(session)):
    i = Idea(workspace_id=w, **data.model_dump())
    db.add(i)
    db.commit()
    return serialize(i)


@app.get(P + "/templates")
def templates(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(ContentTemplate).where(ContentTemplate.workspace_id == w)
        )
    ]


@app.get(P + "/assets")
def assets(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(Asset)
            .where(Asset.workspace_id == w)
            .order_by(Asset.created_at.desc())
        )
    ]


@app.post(P + "/assets", status_code=201)
async def upload(file: UploadFile = File(...), w=Depends(scope), db=Depends(session)):
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "图片不能超过 10 MB")
    if file.content_type not in ["image/png", "image/jpeg", "image/webp"]:
        raise HTTPException(422, "只支持 PNG、JPEG、WebP 图片")
    try:
        with Image.open(io.BytesIO(data)) as im:
            if (
                im.format not in ["PNG", "JPEG", "WEBP"]
                or im.width * im.height > 25000000
            ):
                raise ValueError()
            im.verify()
        with Image.open(io.BytesIO(data)) as im:
            # Decode and re-encode to remove metadata and embedded payloads.
            clean = io.BytesIO()
            im.convert("RGB").save(clean, format="JPEG", quality=94)
            width, height = im.size
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "图片内容无效或尺寸过大")
    folder = DATA_DIR / "uploads"
    folder.mkdir(exist_ok=True)
    filename = uid() + ".jpg"
    (folder / filename).write_bytes(clean.getvalue())
    asset = Asset(
        workspace_id=w,
        name=Path(file.filename or "image").name[:200],
        filename=filename,
        mime="image/jpeg",
        size=len(clean.getvalue()),
        width=width,
        height=height,
    )
    db.add(asset)
    db.commit()
    return serialize(asset)


@app.get(P + "/assets/{id}/file")
def asset_file(id: str, w=Depends(scope), db=Depends(session)):
    a = record(db, Asset, id, w)
    if not re.fullmatch(r"[a-f0-9-]{36}\.jpg", a.filename):
        raise HTTPException(400, "文件路径无效")
    path = DATA_DIR / "uploads" / a.filename
    if not path.is_file():
        raise HTTPException(404, "素材文件不存在")
    return FileResponse(path, media_type=a.mime)


@app.get(P + "/skills")
def skills(w=Depends(scope)):
    return definitions()


@app.post(P + "/skills/{skill_id}/run")
def run_skill(skill_id: str, data: RunInput, w=Depends(scope), db=Depends(session)):
    if skill_id not in [s["id"] for s in definitions()]:
        raise HTTPException(404, "未知 Skill")
    context = {}
    if data.post_id:
        p = record(db, Post, data.post_id, w)
        context = snapshot(p)
        a = record(db, CreatorAccount, p.account_id, w)
        context.update(
            {
                k: getattr(a, k)
                for k in ["positioning", "audience", "tone", "topics", "banned_words"]
            }
        )
    run = SkillRun(
        workspace_id=w, skill_id=skill_id, post_id=data.post_id, input=data.input
    )
    db.add(run)
    db.commit()
    start = time.perf_counter()
    try:
        out, provider, usage = execute(skill_id, data.input, context)
        run.output = out
        run.provider = provider
        run.status = "SUCCEEDED"
        db.add(
            AIUsageRecord(
                workspace_id=w,
                run_id=run.id,
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
            )
        )
    except Exception as e:
        run.status = "FAILED"
        run.error = (
            str(e)[:400]
            if isinstance(e, (ValueError, RuntimeError))
            else "输入或输出 Schema 校验失败"
        )
    run.duration_ms = int((time.perf_counter() - start) * 1000)
    db.commit()
    return serialize(run)


@app.get(P + "/skill-runs")
def skill_runs(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(SkillRun)
            .where(SkillRun.workspace_id == w)
            .order_by(SkillRun.created_at.desc())
            .limit(50)
        )
    ]


@app.get(P + "/skill-runs/{id}")
def skill_run(id: str, w=Depends(scope), db=Depends(session)):
    run = record(db, SkillRun, id, w)
    d = serialize(run)
    u = db.scalar(select(AIUsageRecord).where(AIUsageRecord.run_id == id))
    d["usage"] = serialize(u) if u else None
    return d


@app.get(P + "/compliance-rules")
def rules(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(ComplianceRule).where(ComplianceRule.workspace_id == w)
        )
    ]


@app.post(P + "/compliance-rules", status_code=201)
def add_rule(data: RuleInput, w=Depends(scope), db=Depends(session)):
    rule = ComplianceRule(workspace_id=w, **data.model_dump())
    db.add(rule)
    db.commit()
    return serialize(rule)


@app.patch(P + "/compliance-rules/{id}")
def change_rule(id: str, data: RuleInput, w=Depends(scope), db=Depends(session)):
    r = record(db, ComplianceRule, id, w)
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    r.maintained_at = now()
    db.commit()
    return serialize(r)


def check_data(db, check):
    d = serialize(check)
    d["findings"] = []
    for f in db.scalars(
        select(ComplianceFinding).where(ComplianceFinding.check_id == check.id)
    ):
        fd = serialize(f)
        decision = db.scalar(
            select(ReviewDecision).where(ReviewDecision.finding_id == f.id)
        )
        fd["decision"] = serialize(decision) if decision else None
        rule = db.get(ComplianceRule, f.rule_id) if f.rule_id else None
        fd["source"] = rule.source if rule else check.context_status
        d["findings"].append(fd)
    return d


@app.post(P + "/posts/{id}/compliance-check")
def compliance(id: str, ai: bool = False, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    check = check_post(db, p, ai)
    db.commit()
    return check_data(db, check)


@app.get(P + "/posts/{id}/compliance-check")
def last_compliance(id: str, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    check = db.scalar(
        select(ComplianceCheck)
        .where(ComplianceCheck.post_id == id, ComplianceCheck.revision == p.revision)
        .order_by(ComplianceCheck.created_at.desc())
    )
    return (
        check_data(db, check)
        if check and check.rules_digest == rules_digest(db, w)
        else None
    )


@app.post(P + "/compliance-findings/{id}/ignore")
def ignore(id: str, data: DecisionInput, w=Depends(scope), db=Depends(session)):
    f = record(db, ComplianceFinding, id, w)
    check = record(db, ComplianceCheck, f.check_id, w)
    p = record(db, Post, check.post_id, w)
    if p.revision != check.revision:
        raise HTTPException(409, "检查结果已过期，请重新检查")
    if len(data.reason.strip()) < 4:
        raise HTTPException(422, "请填写至少四个字的具体理由")
    if db.scalar(select(ReviewDecision).where(ReviewDecision.finding_id == id)):
        raise HTTPException(409, "已记录复核意见")
    d = ReviewDecision(
        workspace_id=w, finding_id=id, user_id=LOCAL_USER, reason=data.reason
    )
    db.add(d)
    db.commit()
    return serialize(d)


TERMINAL = ["PUBLISHED_CONFIRMED", "CANCELLED", "FAILED"]


@app.get(P + "/publish-tasks")
def tasks(w=Depends(scope), db=Depends(session)):
    return [
        task_data(db, t)
        for t in db.scalars(
            select(PublishTask)
            .where(PublishTask.workspace_id == w)
            .order_by(PublishTask.created_at.desc())
        )
    ]


@app.post(P + "/publish-tasks", status_code=201)
def create_task(data: TaskInput, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, data.post_id, w)
    a = record(db, CreatorAccount, p.account_id, w)
    if not a.authorized:
        raise HTTPException(422, "该账号尚未确认授权")
    existing = db.scalar(
        select(PublishTask).where(
            PublishTask.post_id == p.id,
            PublishTask.status.notin_(["CANCELLED", "FAILED"]),
        )
    )
    if existing:
        raise HTTPException(
            409, "该稿件已有发布任务或记录，请打开现有任务；再次发布请创建新稿件"
        )
    if data.scheduled_at:
        try:
            due = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
            if due.tzinfo is None or due <= datetime.now(timezone.utc):
                raise ValueError()
        except ValueError:
            raise HTTPException(422, "提醒时间需要是带时区的未来时间")
        data.scheduled_at = due.astimezone(timezone.utc).isoformat()
    v = db.scalar(
        select(PostVersion).where(
            PostVersion.post_id == p.id, PostVersion.revision == p.revision
        )
    )
    t = PublishTask(
        workspace_id=w,
        post_id=p.id,
        account_id=p.account_id,
        version_id=v.id,
        scheduled_at=data.scheduled_at,
        operator_id=LOCAL_USER,
        status="SCHEDULED_REMINDER" if data.scheduled_at else "DRAFT",
    )
    db.add(t)
    db.flush()
    if data.scheduled_at:
        db.add(ScheduleReminder(workspace_id=w, task_id=t.id, due_at=data.scheduled_at))
    db.add(
        PublishEvent(
            workspace_id=w,
            task_id=t.id,
            user_id=LOCAL_USER,
            from_status="CREATED",
            to_status=t.status,
            detail="用户创建人工发布任务",
        )
    )
    db.commit()
    return task_data(db, t)


@app.get(P + "/publish-tasks/{id}")
def task(id: str, w=Depends(scope), db=Depends(session)):
    return task_data(db, record(db, PublishTask, id, w))


def preflight(db, t):
    p = record(db, Post, t.post_id, t.workspace_id)
    a = record(db, CreatorAccount, p.account_id, t.workspace_id)
    v = db.get(PostVersion, t.version_id)
    check = db.scalar(
        select(ComplianceCheck)
        .where(ComplianceCheck.post_id == p.id, ComplianceCheck.revision == p.revision)
        .order_by(ComplianceCheck.created_at.desc())
    )
    limits = db.get(Workspace, t.workspace_id).settings
    checks = [
        {"label": "标题与正文完整", "ok": bool(p.title.strip() and p.body.strip())},
        {
            "label": "封面或图片已准备",
            "ok": bool(p.cover.get("title", "").strip() or p.asset_ids),
        },
        {"label": "账号已确认授权", "ok": a.authorized},
        {
            "label": "任务与当前稿件版本、账号一致",
            "ok": v.revision == p.revision and t.account_id == p.account_id,
        },
        {
            "label": "当前版本已完成风险复核",
            "ok": bool(
                check
                and check.rules_digest == rules_digest(db, p.workspace_id)
                and not unresolved(db, check)
            ),
        },
        {
            "label": "文案长度符合当前编辑规则",
            "ok": len(p.title) <= limits.get("title_limit", 20)
            and len(p.body) <= limits.get("body_limit", 1000),
        },
    ]
    return checks


@app.get(P + "/publish-tasks/{id}/preflight")
def preflight_route(id: str, w=Depends(scope), db=Depends(session)):
    return preflight(db, record(db, PublishTask, id, w))


@app.post(P + "/publish-tasks/{id}/refresh")
def refresh_task(id: str, w=Depends(scope), db=Depends(session)):
    t = record(db, PublishTask, id, w)
    if t.status in TERMINAL or t.status == "PUBLISHING_ASSISTED":
        raise HTTPException(409, "任务已执行，不能更新快照")
    p = record(db, Post, t.post_id, w)
    v = db.scalar(
        select(PostVersion).where(
            PostVersion.post_id == p.id, PostVersion.revision == p.revision
        )
    )
    t.version_id = v.id
    t.account_id = p.account_id
    transition(db, t, "DRAFT", "用户更新内容版本，需重新预检")
    db.commit()
    return task_data(db, t)


@app.post(P + "/publish-tasks/{id}/prepare")
def prepare(id: str, data: PrepareInput, w=Depends(scope), db=Depends(session)):
    t = record(db, PublishTask, id, w)
    if t.status not in ["DRAFT", "SCHEDULED_REMINDER", "READY"]:
        raise HTTPException(409, "当前状态不能预检")
    checks = preflight(db, t)
    if not all(c["ok"] for c in checks):
        raise HTTPException(
            422, "预检未通过：" + "、".join(c["label"] for c in checks if not c["ok"])
        )
    if not data.final_confirmed:
        raise HTTPException(422, "请确认已核对最终文案、账号及素材使用权")
    transition(db, t, "READY", "最终稿由用户确认")
    db.commit()
    return task_data(db, t)


@app.post(P + "/publish-tasks/{id}/transition")
def task_transition(
    id: str, data: TransitionInput, w=Depends(scope), db=Depends(session)
):
    t = record(db, PublishTask, id, w)
    allowed = {
        "READY": ["PUBLISHING_ASSISTED", "CANCELLED"],
        "DRAFT": ["CANCELLED"],
        "SCHEDULED_REMINDER": ["CANCELLED"],
        "PUBLISHING_ASSISTED": ["FAILED", "CANCELLED"],
    }
    if data.status not in allowed.get(t.status, []):
        raise HTTPException(409, "不允许的发布状态跳转")
    if data.status == "PUBLISHING_ASSISTED" and not all(
        c["ok"] for c in preflight(db, t)
    ):
        raise HTTPException(422, "内容或授权已变化，请重新预检")
    if data.status == "FAILED" and not data.error.strip():
        raise HTTPException(422, "请记录失败原因")
    transition(db, t, data.status, data.error)
    db.commit()
    return task_data(db, t)


@app.post(P + "/publish-tasks/{id}/confirm")
def confirm(id: str, data: ConfirmInput, w=Depends(scope), db=Depends(session)):
    t = record(db, PublishTask, id, w)
    if t.status != "PUBLISHING_ASSISTED":
        raise HTTPException(409, "请先开始人工发布；已确认的任务不可重复提交")
    if not record(db, CreatorAccount, t.account_id, w).authorized:
        raise HTTPException(422, "账号授权已撤回")
    if not data.user_confirmed:
        raise HTTPException(422, "需要本人确认已在官方页面完成发布")
    u = urlparse(data.url.strip())
    host = (u.hostname or "").lower()
    valid_path = (
        host in ["www.xiaohongshu.com", "xiaohongshu.com"]
        and re.fullmatch(r"/(explore|discovery/item)/[a-fA-F0-9]{24}/?", u.path)
    ) or (
        host == "xhslink.com" and re.fullmatch(r"/(a/|o/)?[A-Za-z0-9]{4,80}/?", u.path)
    )
    if (
        u.scheme != "https"
        or u.username
        or u.password
        or ":" in u.netloc
        or not valid_path
    ):
        raise HTTPException(
            422,
            "请粘贴有效的小红书笔记 HTTPS 链接（explore、discovery/item 或 xhslink）",
        )
    canonical = (
        "https://"
        + ("www.xiaohongshu.com" if host == "xiaohongshu.com" else host)
        + u.path.rstrip("/")
    )
    if db.scalar(
        select(PublicationRecord).where(
            PublicationRecord.workspace_id == w, PublicationRecord.url == canonical
        )
    ):
        raise HTTPException(409, "此链接已记录，不能重复确认")
    transition(db, t, "PUBLISHED_CONFIRMED", "用户回填链接并确认实际操作")
    pub = PublicationRecord(
        workspace_id=w,
        task_id=t.id,
        post_id=t.post_id,
        url=canonical,
        confirmed_by=LOCAL_USER,
    )
    db.add(pub)
    db.commit()
    return task_data(db, t)


@app.get(P + "/publications")
def publications(w=Depends(scope), db=Depends(session)):
    return [
        {
            **serialize(r),
            "title": db.get(
                PostVersion, db.get(PublishTask, r.task_id).version_id
            ).snapshot["title"],
        }
        for r in db.scalars(
            select(PublicationRecord)
            .where(PublicationRecord.workspace_id == w)
            .order_by(PublicationRecord.created_at.desc())
        )
    ]


@app.get(P + "/post-metrics/import")
def metrics(w=Depends(scope), db=Depends(session)):
    return [
        serialize(x)
        for x in db.scalars(
            select(PostMetricImport)
            .where(PostMetricImport.workspace_id == w)
            .order_by(PostMetricImport.created_at)
        )
    ]


@app.post(P + "/post-metrics/import")
def import_metrics(data: MetricInput, w=Depends(scope), db=Depends(session)):
    for row in data.rows:
        record(db, Post, row.post_id, w)
        if not db.scalar(
            select(PublicationRecord).where(PublicationRecord.post_id == row.post_id)
        ):
            raise HTTPException(422, "仅可为历史作品导入表现快照")
    for row in data.rows:
        db.add(PostMetricImport(workspace_id=w, **row.model_dump()))
    db.commit()
    return {"imported": len(data.rows), "mode": "manual_snapshot"}


@app.get(P + "/analytics/summary")
def analytics(w=Depends(scope), db=Depends(session)):
    rows = list(
        db.scalars(
            select(PostMetricImport)
            .where(PostMetricImport.workspace_id == w)
            .order_by(PostMetricImport.created_at)
        )
    )
    latest = {r.post_id: r for r in rows}
    return {
        "published": db.scalar(
            select(func.count())
            .select_from(PublicationRecord)
            .where(PublicationRecord.workspace_id == w)
        ),
        "drafts": db.scalar(
            select(func.count()).select_from(Post).where(Post.workspace_id == w)
        ),
        "latest_metrics": {
            k: sum(getattr(r, k) for r in latest.values())
            for k in ["views", "likes", "comments", "saves", "followers"]
        },
        "note": "按每篇作品最新人工快照汇总，包含明确标识的演示数据",
    }


@app.post(P + "/posts/{id}/pipeline")
def pipeline(id: str, w=Depends(scope), db=Depends(session)):
    p = record(db, Post, id, w)
    context = snapshot(p)
    combined = {}
    runs = []
    for skill_id in [
        "topic_ideation",
        "note_writer",
        "title_optimizer",
        "compliance_review",
        "cover_designer",
    ]:
        run = SkillRun(
            workspace_id=w,
            skill_id=skill_id,
            post_id=id,
            input={"topic": context["title"]},
        )
        db.add(run)
        db.commit()
        start = time.perf_counter()
        try:
            out, provider, usage = execute(skill_id, run.input, context)
            run.output = out
            run.provider = provider
            run.status = "SUCCEEDED"
            context.update(out["patch"])
            combined.update(out["patch"])
            db.add(
                AIUsageRecord(
                    workspace_id=w,
                    run_id=run.id,
                    prompt_tokens=usage.get("prompt_tokens", 0),
                    completion_tokens=usage.get("completion_tokens", 0),
                )
            )
        except Exception:
            run.status = "FAILED"
            run.error = "组合步骤失败，请检查模型配置或重试"
        run.duration_ms = int((time.perf_counter() - start) * 1000)
        db.commit()
        runs.append(serialize(run))
        if run.status == "FAILED":
            raise HTTPException(422, f"{skill_id} 运行失败；已保存审计记录，稿件未修改")
    return {
        "patch": combined,
        "runs": runs,
        "note": "此处合规为建议，应用后仍需执行绑定最终版本的规则检查",
    }
