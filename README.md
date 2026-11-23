# RedNote Studio

**一个人的小红书 AI 内容团队。**

面向独立创作者、内容运营者和 Agent 开发者的本地创作工作台。从一个选题出发，完成 **灵感 → Skills → 文案与封面 → 内容复核 → 人工发布 → 作品记录**，让生成结果进入可编辑、可追踪的工作流程。

**作者：邴越｜越哥聊AI｜FDE前线**

FDE 垂直 Agent 开源实战系列 · Python / FastAPI + React / TypeScript · [MIT License](LICENSE)

[快速启动](#安装与启动) · [五分钟演示](#五分钟走完一次创作) · [八个-skills](#八个-skills) · [架构](#架构与目录) · [参与贡献](CONTRIBUTING.md) · [作者与更多实战](#作者与更多实战)

> 当前版本是单用户本地工作台。默认 Mock 模式无需模型密钥；接入兼容模型后可运行真实 AI。小红书发布由用户在官方页面手动完成。本项目与小红书官方无隶属或背书关系。

![创作工作台](docs/create-desktop.png)

## 为什么做这个项目

创作者需要的不只是一段生成文案，还需要管理选题、账号风格、修改版本、封面和发布记录。RedNote Studio 把这些步骤放进同一工作台，并让 AI 建议先经过预览和编辑，再写入稿件。

对开发者而言，这也是一个可以拆解的垂直 Agent 案例：结构化 Skill 契约、模型输出校验、人工确认、版本冲突处理、执行记录与本地数据持久化如何一起工作。

## 五分钟走完一次创作

以“给新手讲清楚一个 AI 工具”为演示主题：

1. 打开创作工作台，选择演示账号，新建稿件并填写主题和受众。
2. 运行选题 Skill，预览结果并选择一个方向；运行写作、标题或风格改写。
3. 对比原稿与建议，修改后应用，查看自动保存和历史版本。
4. 选择封面模板，调整标题、配色与字号，导出 PNG。
5. 执行内容检查，核对提示并记录人工复核意见。
6. 创建发布任务，复制文案、下载图片，在官方创作页手动发布；填写实际作品链接后查看历史记录。

**可得到：** 可编辑稿件、封面 PNG、Skill 运行记录、复核记录和发布任务。演示模式不会产生真实平台发布或真实运营数据。详细流程见 [演示脚本](docs/11-demo-script.md)。

## 立即体验

正式应用：**http://127.0.0.1:5174/create**（运行下面的启动命令）。API 文档：http://127.0.0.1:8010/docs。

不安装依赖：直接双击 [`prototype/index.html`](prototype/index.html)。这是单文件**交互原型 / 演示数据**，所有依赖内嵌，无 CDN，无 API 请求。原型独立使用 localStorage，正式应用全部写操作进入后端数据库。

## 安装与启动

需要 Python 3.12+、Node.js 22+、npm、make；默认安装命令还需要 uv。推荐在 macOS / Linux 或 Windows WSL 中运行 Makefile；macOS、Linux 都可开发，Profile 助手也支持已安装 Chrome 的 Windows。

```bash
# 下载本仓库并解压，或 git clone 后进入项目目录
cd rednote-studio
cp .env.example .env
make setup
make init
make dev
```

`make setup` 安装锁定依赖并创建测试模块的本地软链接。`make init` 执行 Alembic 迁移和幂等种子导入；`make dev` 会先确认两个端口空闲，执行迁移/导入并同时启动前后端。Ctrl+C 停止本次启动的进程，不会停止其他服务。

不使用 uv：

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r apps/api/requirements-lock.txt
npm --prefix apps/web ci
ln -s apps/web/node_modules node_modules  # 仅在项目根目录没有 node_modules 时执行
make init
make dev
```

分开启动：`make api` 与 `make web`。数据库位于 `runtime/studio.db`，图片位于 `runtime/uploads/`。备份请停止服务后复制整个 `runtime/`。不要把 `.env`、数据库、Profile 或账号材料提交到 Git。

若端口被占用，可指定新端口（前端必须和后端允许来源一致）：

```bash
ALLOWED_ORIGINS=http://127.0.0.1:5180 .venv/bin/python -m uvicorn studio.main:app --app-dir apps/api --port 8020 --host 127.0.0.1
API_PROXY=http://127.0.0.1:8020 npm --prefix apps/web run dev -- --port 5180
```

## 可以做什么

| 工作台 | 可运行能力 |
|---|---|
| 创作 | 三栏编辑器、Markdown、话题、多图片、700ms 自动保存、乐观锁、版本恢复、撤销 AI 应用、实时预览 |
| Skills | 8 个结构化 Skill、独立运行/稿件上下文、结果对比、编辑后应用、重试、运行历史、固定五步组合 |
| 封面 | 三种模板、文字/字体/颜色/字号/尺寸、图片背景与裁切位置、安全区校验、PNG 导出 |
| 内容检查 | 27 条演示规则、自定义词库、Unicode 定位、否定语境提示、顺序表达识别、可选模型语境辅助、人工复核记录 |
| 发布 | 列表/周历、到期提醒、稿件快照、预检、人工复制/下载/官方页打开、链接确认、并发与重复保护、审计记录 |
| 账号 | 3 个定位不同的演示账号、可新增编辑本人/授权账号、风格样本、独立 Profile 引用与 CLI |
| 子功能 | 素材库、灵感转草稿、内容模板、历史作品、CSV 快照导入、最新快照汇总 |

默认有 20 篇演示草稿、多个历史版本、5 个演示任务、12 条效果快照、3 个账号、8 个 Skills、27 条规则。演示历史使用 `demo://` 标识，不声称真实发布。CSV 只接收已经进入历史作品的稿件。

## 模型

默认 `AI_MODE=mock`，不需要网络、Key 或平台账号。Mock 输出可复现，不表示实时热点、热度或账号数据。

真实调用在 `.env` 设置 `AI_MODE=live`、`AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`，然后重启后端。兼容 `/chat/completions` 与 JSON object response format。固定系统指令隔离参考资料，每次校验 JSON Schema；最多 2 次尝试，单次 20 秒超时。失败可见且持久化，不会悄悄换成 Mock。Token 用量被记录；没有供应商价格时费用显示未估算。

## 浏览器扩展

Chrome 打开 `chrome://extensions` → 开发者模式 → 加载已解压扩展 → 选择 `apps/extension`。也提供 [`apps/extension/rednote-extension.zip`](apps/extension/rednote-extension.zip)。

发布任务页「导出扩展资料」→ 扩展主动导入 JSON → 复制文案/下载/打开官方创作页。仅使用 `storage`、`clipboardWrite`，无 host permissions、无 content script，不读取 Cookie，不操作敏感页面 DOM，不点击发布。资料保留在扩展本地存储，点「清除本地稿件」可移除。

扩展代码与弹窗流程有浏览器模拟测试；**未在用户真实 Chrome 扩展安装环境、已登录小红书页面验证**。页面 DOM 自动填写和官方发布 API 均未启用。

## 本地 Chrome Profile 助手

在账号详情保存别名和引用 ID（例如 `creator-one`），然后在本机运行：

```bash
python3 apps/profile-helper/helper.py create creator-one
python3 apps/profile-helper/helper.py open creator-one
python3 apps/profile-helper/helper.py status creator-one
python3 apps/profile-helper/helper.py list
python3 apps/profile-helper/helper.py delete creator-one
```

创建会要求输入引用 ID 确认；删除必须先关闭浏览器、通过路径校验，并依次输入 ID 和 `DELETE ID` 两次确认。默认目录 `~/.rednote-studio/profiles`，可用 `REDNOTE_PROFILE_ROOT` 指向 ExtSSD 上专用新目录。CLI 仅在用户调用时启动可见 Chrome 窗口，不读取或上传认证信息。`status` 仅报告本地目录/浏览器锁，不宣称账号已登录。

## 测试与构建

```bash
make check
make test-backend
make test-frontend
node apps/web/node_modules/@playwright/test/cli.js install chromium  # 首次没有测试浏览器时
make prototype
make test-e2e
make extension
```

E2E 在隔离的临时 SQLite 数据库运行，使用 `8011/5175`，不会修改你的正式演示数据库。测试中的作品链接是合成 fixture，仅验证记录流程，不是真实平台发布。

`npm --prefix apps/web run build` 同时运行 TypeScript 检查和 Vite 生产构建。`make prototype` 用同一套 React 界面和设计系统生成离线 HTML。测试结果和验证边界见 [`docs/10-test-and-acceptance.md`](docs/10-test-and-acceptance.md)。

## Docker 与数据库

```bash
docker compose up --build
# 打开 http://127.0.0.1:8088/create
```

前端 Nginx 代理 `/api`，后端仅在容器内部暴露，宿主机端口绑定 loopback。SQLite 和图片使用 `studio-data` 命名卷。Profile 助手始终单独运行在本机，不在容器中执行。

SQLAlchemy 已配置 PostgreSQL 方言与驱动，可设置 `DATABASE_URL=postgresql+psycopg://user:password@host/database` 后执行迁移。当前验收使用 SQLite；PostgreSQL 未实测。S3 与多人登录/邀请界面尚未实现，当前为**单用户本地 Demo**，不是可直接面向公网部署的多租户服务。数据模型预留工作区成员，所有业务读取/写入校验固定本地主体的工作区成员关系；不能用请求头冒充其他用户。可设置 `STUDIO_ACCESS_TOKEN` 作为本地工作台访问令牌，不能替代多人身份认证。

## 文档

[`docs/00-PRD.md`](docs/00-PRD.md) 保存原始需求。其余文档覆盖页面、架构、数据模型、API、Skills、风险引擎、浏览器边界、安全、测试、演示脚本与已知限制。发布记录依据是**用户人工确认**，平台未授权的发布、同步、登录检测能力不会冒充实现。


## 八个 Skills

| Skill | 用途 |
|---|---|
| 爆款结构拆解 | 从有权使用的参考文本提取结构与原创方向 |
| 选题生成 | 根据主题和受众生成选题、切入点与形式 |
| 标题优化 | 提供多个标题角度与注意事项 |
| 笔记写作 | 生成正文、话题、封面配置和配图建议 |
| 封面设计 | 生成可编辑配置，由 Canvas 导出 PNG |
| 内容语境复核 | 提供语境建议，结合规则检查与人工确认 |
| 搜索表达优化 | 优化关键词与话题表达，不承诺排名或流量 |
| 风格改写 | 根据本人或获授权的样本调整文风 |

固定五步组合为“选题 → 文案 → 标题 → 语境建议 → 封面”。当前不提供自由 DAG 编排；契约、输入输出与执行边界见 [Skill Engine](docs/05-skills-and-prompts.md)。

## 架构与目录

```text
React 工作台 → FastAPI → Skill Engine → Mock / 兼容模型 API
                   ├─ SQLite：稿件、版本、任务、运行记录
                   └─ 本地文件：图片素材
Chrome 扩展：用户主动导入稿件，辅助复制与下载
Profile 助手：本地独立 CLI
```

| 目录 | 内容 |
|---|---|
| `apps/web` | React + TypeScript + Vite 工作台 |
| `apps/api` | FastAPI、SQLAlchemy、Alembic、Skills 与规则引擎 |
| `apps/extension` | Chrome 手动发布辅助扩展 |
| `apps/profile-helper` | 本地 Chrome Profile 管理工具 |
| `data/demo` | 合成演示数据 |
| `prototype` | 可离线打开的单文件交互原型 |
| `tests` | 后端、前端和浏览器流程测试 |
| `docs` | 架构、API、演示和验收说明 |

## 参与贡献与许可证

欢迎提交可复现的问题、Skill 改进、文档修正与测试补充。提交方式和检查命令见 [贡献指南](CONTRIBUTING.md)。请勿在 Issue、截图或提交中包含账号登录材料、客户信息或模型密钥。

项目原创代码采用 [MIT License](LICENSE)，允许学习、修改和商业使用，分发时须保留许可证及版权声明。第三方依赖保留各自许可证；作者及项目品牌不表示对衍生项目的背书。

## 作者与更多实战

**邴越**，持续分享 AI 工具应用、垂直 Agent 与企业 AI 工程化交付实践。

- **越哥聊AI**：关注 AI 工具使用、内容创作与 Agent 实操，可在内容平台搜索同名账号。
- **FDE前线**：微信公众号，分享行业场景、交付方法与工程实践。
- **[Awesome FDE](https://github.com/fdeopen/awesome-fde)**：FDE 学习路线、案例索引、工作模板与开源资料。

如果这个项目对你有帮助，欢迎 Star、分享你的使用案例，或通过 Issue / Pull Request 一起改进。引用案例或制作教程时，欢迎注明 **RedNote Studio · 邴越 / 越哥聊AI / FDE前线** 并链接回本仓库。
