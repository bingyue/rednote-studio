from sqlalchemy import (
    String,
    Text,
    Integer,
    Boolean,
    JSON,
    ForeignKey,
    UniqueConstraint,
    Index,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, uid, now


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class Scoped(Identity):
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)


class User(Identity, Base):
    __tablename__ = "users"
    name: Mapped[str] = mapped_column(String(100))


class Workspace(Identity, Base):
    __tablename__ = "workspaces"
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))
    settings: Mapped[dict] = mapped_column(JSON, default=dict)


class WorkspaceMember(Identity, Base):
    __tablename__ = "workspace_members"
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(20), default="owner")
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)


class CreatorAccount(Scoped, Base):
    __tablename__ = "creator_accounts"
    name: Mapped[str] = mapped_column(String(100))
    niche: Mapped[str] = mapped_column(String(100), default="生活方式")
    positioning: Mapped[str] = mapped_column(Text, default="")
    audience: Mapped[str] = mapped_column(String(300), default="")
    tone: Mapped[str] = mapped_column(String(300), default="真诚、有细节")
    topics: Mapped[list] = mapped_column(JSON, default=list)
    banned_words: Mapped[list] = mapped_column(JSON, default=list)
    authorization: Mapped[str] = mapped_column(String(100), default="本人账号")
    authorized: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(20), default="#e76c52")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class BrowserProfileRef(Scoped, Base):
    __tablename__ = "browser_profile_refs"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("creator_accounts.id"), unique=True
    )
    alias: Mapped[str] = mapped_column(String(100), default="")
    local_ref: Mapped[str] = mapped_column(String(60), default="")
    status: Mapped[str] = mapped_column(String(100), default="未检测 · 需人工检查")


class CreatorStyleSample(Scoped, Base):
    __tablename__ = "creator_style_samples"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("creator_accounts.id"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    own_work: Mapped[bool] = mapped_column(Boolean, default=True)


class Post(Scoped, Base):
    __tablename__ = "posts"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("creator_accounts.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(500), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    cover: Mapped[dict] = mapped_column(JSON, default=dict)
    asset_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(40), default="DRAFT")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    __mapper_args__ = {"version_id_col": revision}


class PostVersion(Scoped, Base):
    __tablename__ = "post_versions"
    post_id: Mapped[str] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    revision: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(String(100), default="自动保存")
    __table_args__ = (UniqueConstraint("post_id", "revision"),)


class PostTag(Identity, Base):
    __tablename__ = "post_tags"
    post_id: Mapped[str] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))


class Asset(Scoped, Base):
    __tablename__ = "assets"
    name: Mapped[str] = mapped_column(String(200))
    filename: Mapped[str] = mapped_column(String(100))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)


class PostAsset(Identity, Base):
    __tablename__ = "post_assets"
    post_id: Mapped[str] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"))


class ContentTemplate(Scoped, Base):
    __tablename__ = "content_templates"
    name: Mapped[str] = mapped_column(String(100))
    content: Mapped[dict] = mapped_column(JSON)


class Idea(Scoped, Base):
    __tablename__ = "ideas"
    title: Mapped[str] = mapped_column(String(300))
    note: Mapped[str] = mapped_column(Text, default="")


class SkillDefinition(Identity, Base):
    __tablename__ = "skill_definitions"
    spec: Mapped[dict] = mapped_column(JSON)


class SkillRun(Scoped, Base):
    __tablename__ = "skill_runs"
    skill_id: Mapped[str] = mapped_column(String(100), index=True)
    post_id: Mapped[str | None] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"), nullable=True
    )
    input: Mapped[dict] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="RUNNING")
    provider: Mapped[str] = mapped_column(String(30), default="mock")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    prompt_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)


class AIUsageRecord(Scoped, Base):
    __tablename__ = "ai_usage_records"
    run_id: Mapped[str] = mapped_column(ForeignKey("skill_runs.id"), index=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[str | None] = mapped_column(String(100), nullable=True)


class ComplianceRule(Scoped, Base):
    __tablename__ = "compliance_rules"
    term: Mapped[str] = mapped_column(String(100))
    risk_type: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    explanation: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str] = mapped_column(String(300))
    source: Mapped[str] = mapped_column(Text, default="用户自定义规则")
    maintained_at: Mapped[str] = mapped_column(String(40), default=now)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ComplianceCheck(Scoped, Base):
    __tablename__ = "compliance_checks"
    post_id: Mapped[str] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    revision: Mapped[int] = mapped_column(Integer)
    rules_digest: Mapped[str] = mapped_column(String(64), default="")
    context_status: Mapped[str] = mapped_column(
        String(300), default="本地语境提示；未调用 AI"
    )


class ComplianceFinding(Scoped, Base):
    __tablename__ = "compliance_findings"
    check_id: Mapped[str] = mapped_column(
        ForeignKey("compliance_checks.id", ondelete="CASCADE"), index=True
    )
    rule_id: Mapped[str | None] = mapped_column(
        ForeignKey("compliance_rules.id"), nullable=True
    )
    field: Mapped[str] = mapped_column(String(50))
    span_start: Mapped[int] = mapped_column(Integer)
    span_end: Mapped[int] = mapped_column(Integer)
    matched_text: Mapped[str] = mapped_column(Text)
    risk_type: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(20))
    explanation: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str] = mapped_column(Text)
    review_required: Mapped[bool] = mapped_column(Boolean, default=True)
    source_type: Mapped[str] = mapped_column(String(30), default="rule")


class ReviewDecision(Scoped, Base):
    __tablename__ = "review_decisions"
    finding_id: Mapped[str] = mapped_column(
        ForeignKey("compliance_findings.id", ondelete="CASCADE"), unique=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)


class PublishTask(Scoped, Base):
    __tablename__ = "publish_tasks"
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("creator_accounts.id"))
    version_id: Mapped[str] = mapped_column(ForeignKey("post_versions.id"))
    status: Mapped[str] = mapped_column(String(40), default="DRAFT", index=True)
    scheduled_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    operator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        Index(
            "uq_publish_active_post",
            "post_id",
            unique=True,
            sqlite_where=text("status NOT IN ('CANCELLED','FAILED')"),
            postgresql_where=text("status NOT IN ('CANCELLED','FAILED')"),
        ),
    )


class ScheduleReminder(Scoped, Base):
    __tablename__ = "schedule_reminders"
    task_id: Mapped[str] = mapped_column(ForeignKey("publish_tasks.id"), unique=True)
    due_at: Mapped[str] = mapped_column(String(40))


class PublicationRecord(Scoped, Base):
    __tablename__ = "publication_records"
    task_id: Mapped[str] = mapped_column(ForeignKey("publish_tasks.id"), unique=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    confirmed_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    evidence: Mapped[str] = mapped_column(
        String(100), default="用户人工确认，未向平台验证"
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("workspace_id", "url"),)


class PostMetricImport(Scoped, Base):
    __tablename__ = "post_metric_imports"
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id"), index=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    saves: Mapped[int] = mapped_column(Integer, default=0)
    followers: Mapped[int] = mapped_column(Integer, default=0)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class PublishEvent(Scoped, Base):
    __tablename__ = "publish_events"
    task_id: Mapped[str] = mapped_column(ForeignKey("publish_tasks.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[str] = mapped_column(String(40))
    to_status: Mapped[str] = mapped_column(String(40))
    detail: Mapped[str] = mapped_column(Text, default="")
