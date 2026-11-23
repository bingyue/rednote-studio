import { useState } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  PenLine,
  Shapes,
  Send,
  Users,
  Image,
  Settings,
  HelpCircle,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  Clock3,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { useData, useUI, refresh } from "./api";
import type { Account, Task } from "./types";
import { Button } from "./components/ui/button";
import { Modal } from "./ui";
import CreatePage from "./Editor";
import {
  SkillsPage,
  PublishingPage,
  TaskPage,
  AccountsPage,
  AssetsPage,
  IdeasPage,
  HistoryPage,
  SettingsPage,
} from "./Pages";
export default function App() {
  const accounts = useData<Account[]>("/accounts"),
    settings = useData("/settings"),
    tasks = useData<Task[]>("/publish-tasks");
  const ui = useUI(),
    [help, setHelp] = useState(false),
    [menu, setMenu] = useState(false),
    [token, setToken] = useState("");
  const location = useLocation();
  const current =
    accounts.data?.find((a) => a.id === ui.account) || accounts.data?.[0];
  const due =
    tasks.data?.filter(
      (t) =>
        t.status === "SCHEDULED_REMINDER" &&
        t.scheduled_at &&
        new Date(t.scheduled_at) <= new Date(),
    ).length || 0;
  return (
    <div className="app-shell">
      <aside className={"main-sidebar " + (menu ? "mobile-open" : "")}>
        <Link className="brand" to="/create">
          <span className="brand-mark">
            R<span>✳</span>
          </span>
          <div>
            RedNote<span>STUDIO</span>
          </div>
        </Link>
        <div className="workspace-label">
          我的创作空间 <span>PERSONAL</span>
        </div>
        <nav aria-label="主导航">
          {[
            ["/create", "创作", PenLine],
            ["/skills", "Skills", Shapes],
            ["/publishing", "发布", Send],
            ["/accounts", "账号", Users],
          ].map(([path, label, Icon]) => {
            const I = Icon as typeof PenLine;
            return (
              <NavLink
                aria-label={label as string}
                key={path as string}
                to={path as string}
                onClick={() => setMenu(false)}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <I size={19} />
                <span>{label as string}</span>
                {path === "/publishing" && due > 0 ? (
                  <b className="nav-count">{due}</b>
                ) : (
                  <span className="nav-arrow">↗</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="asterisk">✳</span>
          <p>
            一个人的创作，
            <br />
            也可以从容一点。
          </p>
          <Link to="/ideas">
            收集一个灵感 <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link to="/history">
            <Clock3 size={17} />
            历史作品
          </Link>
          <Link to="/settings">
            <Settings size={17} />
            偏好设置
          </Link>
          <button onClick={() => setHelp(true)}>
            <HelpCircle size={17} />
            使用指南
          </button>
          <div className="connection">
            <span className="status-dot" />
            本地工作台 <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <Button
              className="mobile-toggle"
              variant="ghost"
              size="icon"
              aria-label="主导航菜单"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </Button>
            <span>工作台</span>
            <i>/</i>
            <strong>
              {location.pathname.startsWith("/create")
                ? "创作空间"
                : location.pathname.startsWith("/skills")
                  ? "Skills"
                  : location.pathname.startsWith("/publishing")
                    ? "发布管理"
                    : location.pathname.startsWith("/accounts")
                      ? "账号管理"
                      : location.pathname === "/assets"
                        ? "素材库"
                        : location.pathname === "/ideas"
                          ? "灵感箱"
                          : location.pathname === "/history"
                            ? "历史作品"
                            : "设置"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="mode-label">
              <span className="status-dot" />
              {window.__REDNOTE_PROTOTYPE__
                ? "交互原型 / 演示数据"
                : settings.data?.ai_mode === "live"
                  ? "AI 已连接"
                  : "Mock 演示模式"}
            </span>
            <Link to="/assets">
              <Image size={16} />
              <span>素材库</span>
            </Link>
            <span className="separator" />
            <span
              className="avatar small"
              style={{ background: current?.color }}
            >
              {current?.name[0] || "我"}
            </span>
            <select
              aria-label="工作账号筛选"
              value={ui.account}
              onChange={(e) => ui.setAccount(e.target.value)}
            >
              <option value="">全部账号</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </header>
        {accounts.error && (
          <div className="connection-error">
            <h3>工作台暂时无法连接</h3>
            <p>{accounts.error.message}</p>
            <p>请确认后端已启动。如启用了访问令牌，在此输入。</p>
            <input
              aria-label="连接令牌"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button
              onClick={() => {
                ui.setToken(token);
                setToken("");
                refresh();
              }}
            >
              重新连接
            </Button>
          </div>
        )}
        {due > 0 && (
          <Link to="/publishing" className="due-banner">
            <Clock3 size={15} />
            {due} 个发布提醒已到期，打开任务准备发布 <ArrowUpRight size={14} />
          </Link>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/create/:id" element={<CreatePage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/skills/:id" element={<SkillsPage />} />
          <Route path="/publishing" element={<PublishingPage />} />
          <Route path="/publishing/:id" element={<TaskPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h2>这个页面暂时不在创作台里</h2>
                <Link to="/create">返回创作</Link>
              </div>
            }
          />
        </Routes>
        <footer className="app-footer">
          REDNOTE STUDIO <span>用自己的声音，记录值得分享的生活。</span>
          <span>本地优先 · 人工确认发布</span>
        </footer>
      </div>
      {ui.toast && (
        <div className="toast" role="status">
          <ShieldCheck size={17} />
          {ui.toast}
        </div>
      )}
      {help && (
        <Modal title="从灵感到作品，六步就好" onClose={() => setHelp(false)}>
          <ol className="help-steps">
            <li>新建笔记，选择自己的账号。</li>
            <li>运行选题、写作等 Skill，预览差异后应用。</li>
            <li>编辑正文与封面，导出 PNG。</li>
            <li>检查内容，处理提示或记录复核理由。</li>
            <li>准备发布，复制文案并在官方页面人工提交。</li>
            <li>回填真实作品链接，确认后进入历史作品。</li>
          </ol>
          <p className="muted">
            演示账号和数据均有标记；Mock 生成不代表实时热点或平台数据。扩展与
            Profile 助手安装方式请看项目 README。
          </p>
          <a href="http://127.0.0.1:8010/docs" target="_blank" rel="noreferrer">
            开发者 API 文档 ↗
          </a>
        </Modal>
      )}
    </div>
  );
}
