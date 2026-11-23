from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from .db import uid, now
from .models import *
from .schemas import Cover
from .skills import definitions, writer

LOCAL_USER = "00000000-0000-4000-8000-000000000001"
LOCAL_WORKSPACE = "00000000-0000-4000-8000-000000000002"
SOURCE = "演示启发式词库（非平台官方禁词清单）；参考：https://pgy.xiaohongshu.com/faq；维护 2026-10-25"


def snapshot(post):
    return {
        k: getattr(post, k)
        for k in ["account_id", "title", "body", "tags", "cover", "asset_ids"]
    }


def version(db, post, reason="自动保存"):
    v = PostVersion(
        workspace_id=post.workspace_id,
        post_id=post.id,
        revision=post.revision,
        snapshot=snapshot(post),
        reason=reason,
    )
    db.add(v)
    db.flush()
    return v


def seed(db):
    if db.get(User, LOCAL_USER):
        return
    db.add(User(id=LOCAL_USER, name="我的创作空间"))
    db.flush()
    db.add(
        Workspace(
            id=LOCAL_WORKSPACE,
            owner_id=LOCAL_USER,
            name="我的创作空间",
            settings={
                "title_limit": 20,
                "body_limit": 1000,
                "rule_source": "编辑建议，可按平台当前提示调整",
            },
        )
    )
    db.flush()
    db.add(WorkspaceMember(workspace_id=LOCAL_WORKSPACE, user_id=LOCAL_USER))
    accounts = []
    for name, niche, pos, audience, color in [
        (
            "林间有序",
            "职场效率",
            "记录轻盈工作与自我成长，把时间留给重要的事",
            "刚开始工作的年轻人",
            "#ee765d",
        ),
        (
            "阿橙的城市漫游",
            "城市探店",
            "步行、咖啡与城市角落的日常观察",
            "喜欢周末探索的城市青年",
            "#93a48c",
        ),
        (
            "慢慢住好",
            "居家好物",
            "用小预算，把家住成喜欢的样子",
            "租房与独居人群",
            "#c3a879",
        ),
    ]:
        a = CreatorAccount(
            workspace_id=LOCAL_WORKSPACE,
            name=name,
            niche=niche,
            positioning=pos,
            audience=audience,
            color=color,
            topics=[niche, "生活记录"],
            is_demo=True,
        )
        db.add(a)
        db.flush()
        accounts.append(a)
        db.add(
            BrowserProfileRef(
                workspace_id=LOCAL_WORKSPACE,
                account_id=a.id,
                alias=name + " · 独立环境",
                local_ref="creator-" + str(len(accounts)),
            )
        )
        db.add(
            CreatorStyleSample(
                workspace_id=LOCAL_WORKSPACE,
                account_id=a.id,
                content="今天想和你分享一件小事。不赶时间，慢慢来。把真正有用的部分留下，也给生活留一点空白。",
            )
        )
    titles = [
        "周一不慌张的工作仪式",
        "把下班后的时间还给自己",
        "租房书桌的留白练习",
        "我的一周轻量计划",
        "周末的一杯咖啡地图",
        "小房间，也有舒展的角落",
        "整理待办，只留下三件事",
        "沿着街角慢慢走",
        "一盏灯的阅读角",
        "做减法的工作清单",
        "藏在巷子里的面包香",
        "预算内的温柔改造",
        "用十分钟收回专注力",
        "城市散步的三个停靠点",
        "让厨房更顺手",
        "低能量日也有自己的节奏",
        "雨天探店笔记",
        "我的周末整理手账",
        "不焦虑的周日复盘",
        "把日常写成一封信",
    ]
    posts = []
    for idx, title in enumerate(titles):
        a = accounts[idx % 3]
        patch = writer(title, {"audience": a.audience}, {})
        if idx == 0:
            patch["body"] = (
                "以前的周一，总是从打开几十条消息开始。\n\n后来我给自己留了 15 分钟，先不回复任何人，和自己对齐这一天。\n\n01 / 清空桌面，只留下今天要用的东西\n一杯温水、一本笔记本，还有一张写着三件事的便签。\n\n02 / 写下今天最重要的一件事\n不是最长的待办清单，而是完成后会觉得「今天值得」的那一件。\n\n03 / 给专注留一段完整的时间\n我会关掉消息提醒，给自己 25 分钟。这个方法保证有效，让你告别所有焦虑。\n\n不需要一下子变得很自律。能轻一点开始，就已经很好了。\n\n你有什么让周一更从容的小习惯？"
            )
            patch["cover"] = Cover(
                title="周一不慌张\n从这 3 件\n小事开始",
                subtitle="我的 15 分钟工作日仪式",
            ).model_dump()
            patch["tags"] = ["职场效率", "工作日仪式感", "自我成长"]
        p = Post(
            workspace_id=LOCAL_WORKSPACE,
            account_id=a.id,
            **{**patch, "title": title},
            is_demo=True,
        )
        db.add(p)
        db.flush()
        version(db, p, "演示初稿")
        posts.append(p)
        if idx < 3:
            p.body += "\n\n留一点空间，给正在发生的生活。"
            db.flush()
            version(db, p, "补充结尾")
    for i, n, c, d, icon in __import__("studio.skills", fromlist=["CATALOG"]).CATALOG:
        db.add(
            SkillDefinition(id=i, spec=next(x for x in definitions() if x["id"] == i))
        )
    groups = [
        (
            "绝对化与保证",
            ["保证有效", "最好", "第一", "唯一", "100%", "永久", "绝对", "零风险"],
            "medium",
            "描述具体体验与适用条件",
            "可能适合部分人",
        ),
        (
            "效果与收益",
            ["稳赚", "月入十万", "一夜暴富", "保本", "躺赚"],
            "high",
            "收益缺乏依据，需要核实",
            "效果因人而异",
        ),
        (
            "健康主张",
            ["治愈", "根治", "包治", "无副作用", "药到病除"],
            "high",
            "医疗健康表述需要专业依据",
            "请咨询有资质的专业人士",
        ),
        (
            "教育承诺",
            ["保过", "必上岸", "提分神器"],
            "high",
            "培训效果承诺需要复核",
            "记录学习过程",
        ),
        (
            "站外引流",
            ["加微信", "私下转账", "扫码领钱"],
            "medium",
            "请核实适用场景及当前平台规则",
            "在平台内交流",
        ),
        (
            "权利与隐私",
            ["偷拍", "盗图", "身份证号码"],
            "high",
            "检查肖像、版权和个人信息授权",
            "使用已获授权的素材",
        ),
    ]
    for kind, terms, severity, explanation, suggestion in groups:
        for term in terms:
            db.add(
                ComplianceRule(
                    workspace_id=LOCAL_WORKSPACE,
                    term=term,
                    risk_type=kind,
                    severity=severity,
                    explanation=explanation,
                    suggestion=suggestion,
                    source=SOURCE,
                )
            )
    for i in range(5):
        p = posts[15 + i]
        v = db.scalar(
            select(PostVersion)
            .where(PostVersion.post_id == p.id)
            .order_by(PostVersion.revision.desc())
        )
        due = (datetime.now(timezone.utc) + timedelta(days=i - 2)).isoformat()
        status = "PUBLISHED_CONFIRMED" if i < 2 else "SCHEDULED_REMINDER"
        t = PublishTask(
            workspace_id=LOCAL_WORKSPACE,
            post_id=p.id,
            account_id=p.account_id,
            version_id=v.id,
            status=status,
            operator_id=LOCAL_USER,
            scheduled_at=due,
            is_demo=True,
        )
        db.add(t)
        db.flush()
        if i < 2:
            db.add(
                PublicationRecord(
                    workspace_id=LOCAL_WORKSPACE,
                    task_id=t.id,
                    post_id=p.id,
                    url=f"demo://publication/{i + 1}",
                    confirmed_by=LOCAL_USER,
                    is_demo=True,
                    evidence="演示历史记录，未真实发布",
                )
            )
        else:
            db.add(
                ScheduleReminder(workspace_id=LOCAL_WORKSPACE, task_id=t.id, due_at=due)
            )
    for i in range(12):
        # Six dated observations for each of the two demo publications.
        db.add(
            PostMetricImport(
                workspace_id=LOCAL_WORKSPACE,
                post_id=posts[15 + i % 2].id,
                views=320 + i * 137,
                likes=25 + i * 9,
                comments=3 + i,
                saves=14 + i * 7,
                followers=i,
                created_at=(
                    datetime.now(timezone.utc) - timedelta(days=6 - i // 2)
                ).isoformat(),
                is_demo=True,
            )
        )
    for title, note in [
        ("下班后的 30 分钟", "不做效率竞赛，做一点喜欢的事"),
        ("城市里的一平米绿意", "从窗边那盆植物开始"),
        ("我的周日重启清单", "整理空间，也整理心情"),
    ]:
        db.add(Idea(workspace_id=LOCAL_WORKSPACE, title=title, note=note))
    db.add(
        ContentTemplate(
            workspace_id=LOCAL_WORKSPACE,
            name="真实体验清单",
            content={
                "body": "我的真实场景\n\n尝试过程\n\n有用与不适合的地方\n\n给读者的一步行动"
            },
        )
    )
    db.commit()
