# API

前缀 `/api/v1`；运行时完整 OpenAPI 位于 `/docs`、`/openapi.json`，可直接试用。错误格式 `{code,message,details,request_id}`，响应附 X-Request-ID。私有请求可配置 `Authorization: Bearer <STUDIO_ACCESS_TOKEN>`；`X-Workspace-ID` 只选择本地主体已有成员关系的工作区，不控制身份。

| API | 行为 |
|---|---|
| GET/POST /posts | 列表（可 account_id 筛选）、新建 |
| GET/PATCH/DELETE /posts/{id} | 读取、修改、删除。PATCH 必须带 revision；有任务的稿件不可删除 |
| GET/POST /posts/{id}/versions | 历史或手动快照 |
| POST /posts/{id}/restore/{version_id} | 带 revision 恢复为新版本 |
| GET/POST /accounts；GET/PATCH /accounts/{id} | 本人/授权账号资料 |
| POST /accounts/{id}/profile、/style-samples | 本地引用、自己的风格样本 |
| GET/POST /ideas、/assets | 灵感、multipart 文件上传 |
| GET /assets/{id}/file | 校验工作区后读取图片 |
| GET /templates、/skills | 内容模板、Skill 契约 |
| POST /skills/{id}/run | `{post_id?,input:{...}}`；返回持久化的 Run，失败状态可读 |
| GET /skill-runs、/skill-runs/{id} | 最近 50 条、单次详情及用量 |
| POST /posts/{id}/pipeline | 固定五步组合，返回待预览 patch；不改稿件 |
| GET/POST /posts/{id}/compliance-check | 当前有效检查、重新检查；`?ai=true` 添加语境建议 |
| GET/POST /compliance-rules；PATCH /compliance-rules/{id} | 维护演示与自定义规则 |
| POST /compliance-findings/{id}/ignore | `{reason}`，至少四字，保存审计 |
| GET/POST /publish-tasks；GET /publish-tasks/{id} | 列表、新任务、快照和日志 |
| GET /publish-tasks/{id}/preflight | 逐项预检结果 |
| POST /publish-tasks/{id}/refresh | 使用最新稿件版本，回到 DRAFT |
| POST /publish-tasks/{id}/prepare | `{final_confirmed:true}`，通过预检后 READY |
| POST /publish-tasks/{id}/transition | 人工开始、取消、失败（失败需原因） |
| POST /publish-tasks/{id}/confirm | `{url,user_confirmed:true}`，记录人工证据 |
| GET /publications | 作品历史 |
| GET/POST /post-metrics/import | 历史快照；`{rows:[{post_id,views,likes,comments,saves,followers}]}` |
| GET /analytics/summary | 最新快照汇总 |
| GET/PATCH /settings | 模型状态与编辑字数建议，无 Key |
| GET /health | 服务健康与平台授权状态 |

上传支持 JPEG/PNG/WebP，最大 10 MB、2500 万像素，先验证再重新编码为 JPEG，移除 EXIF；随机 UUID 文件名。SVG/HTML/伪造图片拒绝。

示例：

```bash
curl http://127.0.0.1:8010/api/v1/accounts
curl -X POST http://127.0.0.1:8010/api/v1/posts \
  -H 'Content-Type: application/json' \
  -d '{"account_id":"替换为账号UUID","title":"我的日常清单","body":"分享自己的真实体验。"}'
```

400/422 输入或预检无效；401 缺令牌；403 非授权工作区/来源；404 不存在或不属于工作区；409 乐观锁/状态/重复冲突；413 文件过大。未知异常不返回 SQL、密钥或路径，日志只记录请求 ID 与异常类型。
