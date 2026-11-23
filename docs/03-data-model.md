# 数据模型

UUID 主键，UTC ISO 8601 时间，业务实体 workspace_id 外键与索引。模型位于 `apps/api/studio/models.py`。

| 类别 | 实体 / 关系 |
|---|---|
| 身份 | User → Workspace.owner_id；WorkspaceMember (workspace,user) 唯一 |
| 账号 | CreatorAccount；BrowserProfileRef 每账号唯一，只保存本地引用；CreatorStyleSample |
| 创作 | Post → Account；PostVersion (post,revision) 唯一；PostTag；PostAsset → Asset；ContentTemplate；Idea |
| AI | SkillDefinition 存标准契约；SkillRun 存输入、输出、状态、耗时、版本、错误；AIUsageRecord |
| 检查 | ComplianceRule；ComplianceCheck → Post/revision/rules_digest；ComplianceFinding → Check/Rule；ReviewDecision 每 Finding 唯一 |
| 发布 | PublishTask → Post/Account/PostVersion；PublishEvent；ScheduleReminder；PublicationRecord 每 task 唯一、workspace/url 唯一 |
| 表现 | PostMetricImport → Post，按导入时间追加，汇总取每稿最新快照 |

Post 的 revision 同时是 SQLAlchemy version_id_col。每次修改在一个事务里更新主体、关联标签/素材及新版本快照。恢复操作复制历史快照到一个新 revision，历史不会被覆盖。

PublishTask 包含版本与账号快照引用、操作主体、状态、更新时间、错误。数据库部分唯一索引 `uq_publish_active_post` 阻止同稿件同时存在多个非 FAILED/CANCELLED 的任务。人工确认采用条件 UPDATE + 事务 + PublicationRecord 唯一约束，避免并发双重确认。

合规检查与稿件 revision 绑定；词库内容/启用状态/维护日期的 SHA-256 指纹变化时，旧检查自动失效。ReviewDecision 保存操作者和理由，不静默删除风险证据。

迁移：`001_initial` 创建初始关系模型；`002_concurrency` 增补规则指纹与唯一索引。`make init` 可重复执行，种子导入在本地用户已存在时不重复插入。`data/demo/seed.json` 是离线原型的明确演示 fixture，不包含用户密钥。

轻团队只预留关系模型和工作区权限边界；目前不提供成员邀请、用户登录、评论协作或多个身份切换。不要将固定本地主体当作多人认证。
