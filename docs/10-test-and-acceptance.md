# 测试与验收记录

验收日期：2026-10-25（Asia/Shanghai）。测试使用隔离的临时数据库，没有对外发布内容，也没有操作真实账号 Cookie。

| 检查 | 实际结果 |
|---|---|
| Python 后端与助手 pytest | 19 项通过，1.30 秒 |
| Vitest / Testing Library | 5 项通过 |
| Playwright Chromium E2E | 6 项通过，10.3 秒（最终回归） |
| TypeScript + Vite 生产构建 | 通过 |
| 单文件 HTML 生成 | 通过，约 778 KB，内嵌 React/CSS/Mock 数据 |
| Docker Compose config | 通过 |
| Docker 镜像构建 | API/Web 均成功 |
| Docker 启动 | API healthy；http://127.0.0.1:8088/create 返回 200；/api/v1/health 返回 ok。验收后已停止容器，保留本地 5174 演示服务 |
| 实际供应商模型 / 真实 Chrome 扩展安装 / 平台发布 | 未验证，无授权/凭据，不声称完成 |

后端覆盖：创建、自动保存、冲突、版本恢复/删除；八个 Skill Schema 和 Mock；非法输入审计；规则命中位置、emoji、否定语境、顺序语境；理由记录与过期保护；多账号绑定与非成员工作区拒绝；发布状态、预检、账号版本变化、重复/并发数据库约束；非法链接/来源/素材/路径；CSV 原子验证；规则修改使检查失效；本地令牌及 HttpOnly 会话；Profile 创建/删除双确认/路径与符号链接/安全浏览器参数；模型适配器重试和提示词隔离、失败不泄密。

前端单元覆盖：编辑保存携带 revision、冲突保留本地输入、AI 差异预览后编辑与接受、拒绝不写入、Unicode 风险高亮。

Playwright：
1. 新稿 → 选题 → 预览应用 → 写作 → 预览应用 → 切封面模板并下载 PNG → 检查 → 创建任务 → 最终稿预检 → 人工确认合成链接 → 历史出现。
2. 同稿切账号、保存并刷新验证，风险忽略理由、编辑后失效、采用建议并重检。
3. `file://` 单 HTML 四个导航、Skill 执行、本地编辑保存刷新；网络请求断言为零。
4. 390px 窄屏编辑、导航与 Skills 无横向溢出。
5. 设置规则保存、授权账号创建、草稿空筛选。
6. 扩展 popup 模拟 Chrome API：拒绝坏 JSON、导入、复制、下载、固定官方 URL 打开、清除。

修复记录：
- 初次构建发现 AsyncButton JSX 闭合错误，修复后 TypeScript 构建通过。
- 测试发现“第一步”误命中“第一”，新增顺序语境例外和后端回归。
- Vitest 根目录文件访问配置导致初次未加载测试，显式工作区允许范围后通过。
- 首轮浏览器测试中异步创建/保存未等待就刷新；测试改为等待新稿和保存回执，持续覆盖后端真实持久化。
- 导航可访问名称原本混入装饰箭头和计数，改为独立 aria-label。

剩余提示：Vite 单入口 bundle 大于 500 KB 的体积提示（gzip 约 173 KB）；Starlette TestClient 对 httpx 的弃用提示。均不影响当前验证，但后续应做路由代码分割和升级测试客户端。

命令：`make test-backend`、`make test-frontend`、`make prototype`、`make test-e2e`、`docker compose build`、`docker compose up -d`。Playwright 保留失败截图与 trace 至 test-results，HTML 报告至 playwright-report（不提交 Git）。
