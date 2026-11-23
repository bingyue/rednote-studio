from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Literal


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Cover(Strict):
    template: Literal["editorial", "minimal", "memo"] = "editorial"
    title: str = Field(default="把灵感，写成作品", max_length=80)
    subtitle: str = Field(default="MAKE SOMETHING THAT MATTERS", max_length=160)
    background: str = "#f3eddf"
    foreground: str = "#343c32"
    accent: str = "#ff5948"
    font_size: int = Field(default=90, ge=40, le=140)
    font: Literal["serif", "sans-serif"] = "serif"
    width: int = Field(default=1080, ge=600, le=2000)
    height: int = Field(default=1440, ge=600, le=2600)
    background_asset_id: str | None = None
    crop_x: float = Field(default=0.5, ge=0, le=1)
    crop_y: float = Field(default=0.5, ge=0, le=1)

    @field_validator("background", "foreground", "accent")
    @classmethod
    def color(cls, v):
        import re

        if not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            raise ValueError("颜色必须是六位 HEX")
        return v


class PostCreate(Strict):
    account_id: str
    title: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=50000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    cover: Cover = Field(default_factory=Cover)
    asset_ids: list[str] = Field(default_factory=list, max_length=18)


class PostPatch(Strict):
    revision: int = Field(ge=1)
    account_id: str | None = None
    title: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, max_length=50000)
    tags: list[str] | None = Field(default=None, max_length=30)
    cover: Cover | None = None
    asset_ids: list[str] | None = Field(default=None, max_length=18)
    reason: str = Field(default="自动保存", max_length=100)


class AccountInput(Strict):
    name: str = Field(min_length=1, max_length=100)
    niche: str = Field(default="生活方式", max_length=100)
    positioning: str = Field(default="", max_length=3000)
    audience: str = Field(default="", max_length=300)
    tone: str = Field(default="真诚、有细节", max_length=300)
    topics: list[str] = Field(default_factory=list, max_length=30)
    banned_words: list[str] = Field(default_factory=list, max_length=100)
    authorization: str = Field(default="本人账号", min_length=1, max_length=100)
    authorized: bool = True
    color: str = "#e76c52"


class ProfileInput(Strict):
    alias: str = Field(max_length=100)
    local_ref: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$")


class IdeaInput(Strict):
    title: str = Field(min_length=1, max_length=300)
    note: str = Field(default="", max_length=5000)


class RuleInput(Strict):
    term: str = Field(min_length=1, max_length=100)
    risk_type: str = Field(default="自定义", max_length=100)
    severity: Literal["low", "medium", "high"] = "medium"
    explanation: str = Field(default="请结合上下文人工复核", max_length=3000)
    suggestion: str = Field(min_length=1, max_length=300)
    source: str = Field(default="用户自定义规则", max_length=2000)
    enabled: bool = True


class RunInput(Strict):
    post_id: str | None = None
    input: dict = Field(default_factory=dict)


class TaskInput(Strict):
    post_id: str
    scheduled_at: str | None = None


class ConfirmInput(Strict):
    url: str = Field(min_length=1, max_length=1000)
    user_confirmed: bool


class DecisionInput(Strict):
    reason: str = Field(min_length=4, max_length=2000)


class PrepareInput(Strict):
    final_confirmed: bool = False


class TransitionInput(Strict):
    status: Literal["PUBLISHING_ASSISTED", "CANCELLED", "FAILED"]
    error: str = Field(default="", max_length=2000)


class MetricRow(Strict):
    post_id: str
    views: int = Field(default=0, ge=0, le=10**10)
    likes: int = Field(default=0, ge=0, le=10**10)
    comments: int = Field(default=0, ge=0, le=10**10)
    saves: int = Field(default=0, ge=0, le=10**10)
    followers: int = Field(default=0, ge=0, le=10**10)


class MetricInput(Strict):
    rows: list[MetricRow] = Field(min_length=1, max_length=1000)


class StyleInput(Strict):
    content: str = Field(min_length=10, max_length=20000)
    own_work: bool


class SettingsInput(Strict):
    title_limit: int = Field(default=20, ge=1, le=500)
    body_limit: int = Field(default=1000, ge=10, le=50000)
    rule_source: str = Field(default="编辑建议，可按账号平台规则更新", max_length=500)
