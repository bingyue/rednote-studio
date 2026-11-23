import re, hashlib, json
from .models import ComplianceRule, ComplianceCheck, ComplianceFinding, ReviewDecision
from sqlalchemy import select
from .db import uid
from .skills import execute


def fields(post):
    return {
        "title": post.title,
        "body": post.body,
        "tags": " ".join(post.tags),
        "cover.title": post.cover.get("title", ""),
        "cover.subtitle": post.cover.get("subtitle", ""),
    }


def rules_digest(db, workspace):
    rules = db.scalars(
        select(ComplianceRule)
        .where(ComplianceRule.workspace_id == workspace)
        .order_by(ComplianceRule.id)
    ).all()
    return hashlib.sha256(
        json.dumps([(r.id, r.term, r.enabled, r.maintained_at) for r in rules]).encode()
    ).hexdigest()


def check_post(db, post, ai=False):
    check = ComplianceCheck(
        id=uid(),
        workspace_id=post.workspace_id,
        post_id=post.id,
        revision=post.revision,
        rules_digest=rules_digest(db, post.workspace_id),
    )
    db.add(check)
    db.flush()
    rules = db.scalars(
        select(ComplianceRule).where(
            ComplianceRule.workspace_id == post.workspace_id,
            ComplianceRule.enabled == True,
        )
    ).all()
    for field, text in fields(post).items():
        for rule in rules:
            for match in re.finditer(re.escape(rule.term), text, re.IGNORECASE):
                if rule.term == "第一" and text[match.end() : match.end() + 1] in [
                    "步",
                    "次",
                    "天",
                    "段",
                    "件",
                    "章",
                ]:
                    continue  # 顺序表达不是排名效果主张
                before = text[max(0, match.start() - 8) : match.start()]
                context = (
                    "前文含否定或引用语境，应结合全文判断。"
                    if any(x in before for x in ["不", "避免", "所谓", "拒绝", "不能"])
                    else "词语命中仅提示复核，不代表违法结论。"
                )
                db.add(
                    ComplianceFinding(
                        workspace_id=post.workspace_id,
                        check_id=check.id,
                        rule_id=rule.id,
                        field=field,
                        span_start=match.start(),
                        span_end=match.end(),
                        matched_text=match.group(),
                        risk_type=rule.risk_type,
                        severity=rule.severity,
                        explanation=rule.explanation + " " + context,
                        suggestion=rule.suggestion,
                        source_type="rule",
                    )
                )
    if ai:
        try:
            out, provider, _ = execute(
                "compliance_review",
                {},
                {
                    "title": post.title,
                    "body": post.body,
                    "tags": post.tags,
                    "cover": post.cover,
                },
            )
            check.context_status = f"{provider} 语境辅助：" + out["summary"]
            # Contextual notes have explicit whole-document scope, never fabricated offsets.
            for item in out["items"]:
                db.add(
                    ComplianceFinding(
                        workspace_id=post.workspace_id,
                        check_id=check.id,
                        field="context",
                        span_start=0,
                        span_end=0,
                        matched_text=item["title"],
                        risk_type="语境复核",
                        severity="low",
                        explanation=item["detail"],
                        suggestion="人工核实并记录理由",
                        source_type="ai_context"
                        if provider != "mock"
                        else "mock_context",
                    )
                )
        except Exception:
            check.context_status = "AI 语境复核失败，规则检查已保留；可重试"
    db.flush()
    return check


def unresolved(db, check):
    findings = db.scalars(
        select(ComplianceFinding).where(ComplianceFinding.check_id == check.id)
    ).all()
    return [
        f
        for f in findings
        if not db.scalar(
            select(ReviewDecision).where(ReviewDecision.finding_id == f.id)
        )
    ]
