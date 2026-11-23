# Skill Engine 与提示词

实现 `apps/api/studio/skills.py`。8 个标准契约均含 id、version、name、category、input_schema、output_schema、executor、capabilities、timeout、requires_ai、status。当前提示词版本 1.0.0。

| ID | 输入重点 | 输出与应用 |
|---|---|---|
| viral_deconstruction | 有权使用的参考文本 | 开场、结构、受众、方法、原创方向；原创提纲 body |
| topic_ideation | 主题、受众、目标 | 10 条选题/切入点/关键词/形式，每条可应用标题 |
| title_optimizer | 当前标题/正文 | 5 个角度标题与注意事项，可选择应用 |
| note_writer | 主题、要点、受众、语气 | 标题、正文、话题、封面配置与配图建议 |
| cover_designer | 标题、模板 | 可编辑 cover；前端 Canvas 生成实际 PNG |
| compliance_review | 当前文案、标签、封面 | 语境建议；编辑器的检查路由再组合词库与持久化结果 |
| seo_optimizer | 文案、领域词 | 意图、主次词、自然嵌入、话题 patch |
| style_rewriter | 自己的样本、使用权确认 | 风格画像、改写 body、差异解释 |

统一输出：`{summary,items:[{title,detail,patch?}],patch}`。patch 只允许 title/body/tags/cover。输入 Schema 禁止额外字段；输出 Schema 限定类型与内容，选题数/标题数单独验证，封面经过 Pydantic 校验。不存在动态代码/SQL 执行。

系统指令固定在后端。参考文本、样本、账号受众与风格位于单独的 user JSON 数据消息中，明确作为不可信数据。要求原创、避免照抄及未验证数据/收益/经历。结果必须经预览才能由界面接受，服务端 Skill 路由不会改稿件或创建发布。

MockProvider 的每个 Skill 都有结构化结果，依主题和内容可重复生成。它不是实时热点检索，不推断阅读量。真实适配器只在 `AI_MODE=live` 且 Key 存在时启用；单次 HTTP 20 秒，最多两次；总契约超时预算 45 秒。失败 Run 保留 error，不切换假成功。用量不含 Key；没有价格表不输出虚构费用。

固定组合「选题→文案→标题→语境建议→封面」在临时上下文中合并 patch，各步 Run 审计记录保留，全部完成后只返回一个待预览结果。应用之后仍须对最终稿执行词库检查。暂不实现自由 DAG。
