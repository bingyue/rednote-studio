import { assetUrl } from "./api";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Search,
  Copy,
  Download,
  ExternalLink,
  Check,
  ShieldCheck,
  Clock3,
  FolderOpen,
  Upload,
  Lightbulb,
  ImagePlus,
  Settings2,
  Monitor,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  api,
  useData,
  useUI,
  send,
  refresh,
  copy,
  download,
  when,
} from "./api";
import { PageTitle, AsyncButton, Empty, Modal, ErrorBox } from "./ui";
import {
  type Account,
  type Post,
  type Skill,
  type Asset,
  type Task,
  type Patch,
  statusName,
  defaultCover,
} from "./types";
import { SkillRunner } from "./SkillRunner";
import { skillIcons } from "./Editor";
import { Cover } from "./Cover";

export function SkillsPage() {
  const skills = useData<Skill[]>("/skills"),
    posts = useData<Post[]>("/posts"),
    accounts = useData<Account[]>("/accounts");
  const { id } = useParams(),
    navigate = useNavigate(),
    ui = useUI();
  const [category, setCategory] = useState("全部");
  const [picked, setPicked] = useState("");
  const active = skills.data?.find((s) => s.id === id);
  const post =
    posts.data?.find((p) => p.id === (picked || ui.post)) || posts.data?.[0];
  const apply = async (patch: Patch) => {
    if (!post) return;

    await send(
      "/posts/" + post.id,
      { revision: post.revision, ...patch, reason: "Skills 工作台应用" },
      "PATCH",
    );
    await refresh();
    ui.notify("已应用到稿件，可在版本历史恢复原稿");
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="YOUR PERSONAL CONTENT TEAM"
        title="让灵感，多一种可能"
        subtitle="8 个专注创作的 Skills，随时加入你的创作过程。"
      >
        <span className="badge green">
          <span className="status-dot" />
          支持无 Key 本地演示
        </span>
      </PageTitle>
      <div className="skills-banner">
        <div>
          <span className="eyebrow">LESS BUSYWORK. MORE CREATION.</span>
          <h2>
            你负责表达，
            <br />
            把重复的工作交给 Skills。
          </h2>
          <p>每次生成都可以预览、编辑，再应用到自己的稿件。</p>
          <Link to="/create">
            回到创作台 <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="skill-orbit">
          <span>✳</span>
          <div className="orbit-label">IDEA → STORY → COVER</div>
        </div>
      </div>
      <div className="filters">
        {["全部", "策划", "写作", "设计", "优化与合规"].map((c) => (
          <button
            className={category === c ? "active" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
        <span className="muted">8 个创作伙伴</span>
      </div>
      <div className="skills-grid">
        {skills.data
          ?.filter((s) => category === "全部" || s.category === category)
          .map((s) => {
            const Icon = skillIcons[s.id];
            return (
              <button
                className="skill-card"
                onClick={() => navigate("/skills/" + s.id)}
                key={s.id}
              >
                <div className="card-top">
                  <span className={"skill-icon " + s.category}>
                    <Icon size={24} />
                  </span>
                  <span className="category">{s.category}</span>
                </div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="card-bottom">
                  <span>v{s.version} · 可应用到稿件</span>
                  <ArrowUpRight size={18} />
                </div>
              </button>
            );
          })}
      </div>
      {skills.error && <ErrorBox message={skills.error.message} />}
      <div className="soft-note">
        <ShieldCheck size={18} />
        所有生成内容由你确认后才会应用，原稿保留在版本历史中。
      </div>
      {active && (
        <Modal title={active.name} onClose={() => navigate("/skills")} wide>
          <label>
            应用目标稿件
            <select
              value={post?.id || ""}
              onChange={(e) => setPicked(e.target.value)}
            >
              {posts.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "未命名笔记"}
                </option>
              ))}
            </select>
          </label>
          <SkillRunner
            key={active.id + "-" + post?.id}
            skill={active}
            post={post}
            account={accounts.data?.find((a) => a.id === post?.account_id)}
            onApply={post ? apply : undefined}
          />
        </Modal>
      )}
    </div>
  );
}

export function PublishingPage() {
  const tasks = useData<Task[]>("/publish-tasks"),
    posts = useData<Post[]>("/posts");
  const [view, setView] = useState("list"),
    [filter, setFilter] = useState("all"),
    [newTask, setNewTask] = useState(false),
    [selected, setSelected] = useState(""),
    [scheduled, setScheduled] = useState(""),
    [week, setWeek] = useState(0);
  const navigate = useNavigate();
  const all = tasks.data || [];
  const visible = all.filter(
    (t) =>
      filter === "all" ||
      (filter === "pending"
        ? !["PUBLISHED_CONFIRMED", "CANCELLED", "FAILED"].includes(t.status)
        : t.status === filter),
  );
  const today = new Date();
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7) + week * 7);
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="page">
      <PageTitle
        eyebrow="MAKE IT OUT INTO THE WORLD"
        title="好内容，准备出发"
        subtitle="从最后一次检查，到发布后的第一条记录。"
      >
        <Link className="btn btn-outline" to="/history">
          <Clock3 size={15} />
          历史作品
        </Link>
        <Button onClick={() => setNewTask(true)}>
          <Plus size={16} />
          创建发布任务
        </Button>
      </PageTitle>
      <div className="publishing-stats">
        {[
          [
            "待发布",
            all.filter(
              (t) =>
                !["PUBLISHED_CONFIRMED", "CANCELLED", "FAILED"].includes(
                  t.status,
                ),
            ).length,
            "每篇都值得认真对待",
          ],
          [
            "定时提醒",
            all.filter((t) => t.status === "SCHEDULED_REMINDER").length,
            "在合适的时间，提醒自己",
          ],
          [
            "已人工确认",
            all.filter((t) => t.status === "PUBLISHED_CONFIRMED").length,
            "积累属于你的作品",
          ],
        ].map(([label, count, sub]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {count}
              <small> 篇</small>
            </strong>
            <p>{sub}</p>
          </div>
        ))}
      </div>
      <div className="list-toolbar">
        <div className="filters">
          {[
            ["all", "全部任务"],
            ["pending", "待发布"],
            ["PUBLISHED_CONFIRMED", "已确认"],
            ["CANCELLED", "已取消"],
            ["FAILED", "未完成"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <List size={14} />
            列表
          </button>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            <CalendarDays size={14} />
            周历
          </button>
        </div>
      </div>
      {view === "list" ? (
        <div className="task-list">
          <div className="task-header">
            <span>内容 / 目标账号</span>
            <span>计划时间</span>
            <span>发布状态</span>
            <span />
          </div>
          {visible.map((t) => (
            <Link key={t.id} className="task-row" to={"/publishing/" + t.id}>
              <div className="task-title">
                <div
                  className="mini-cover"
                  style={{
                    background: t.snapshot.cover.background,
                    color: t.snapshot.cover.foreground,
                  }}
                >
                  {t.snapshot.cover.title}
                </div>
                <div>
                  <h3>{t.snapshot.title || "未命名笔记"}</h3>
                  <p>
                    {t.account_name} <span>· v{t.revision}</span>
                    {t.is_demo && <span> · 演示</span>}
                  </p>
                </div>
              </div>
              <span>{t.scheduled_at ? when(t.scheduled_at) : "随时准备"}</span>
              <span className={"badge status-" + t.status}>
                {statusName[t.status]}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="calendar-heading">
            <h3>
              {days[0].toLocaleDateString()} — {days[6].toLocaleDateString()}
            </h3>
            <div className="actions">
              <Button
                variant="ghost"
                aria-label="上一周"
                onClick={() => setWeek((w) => w - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" onClick={() => setWeek(0)}>
                本周
              </Button>
              <Button
                variant="ghost"
                aria-label="下一周"
                onClick={() => setWeek((w) => w + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          <div className="calendar">
            {days.map((d) => (
              <div className="calendar-day" key={d.toISOString()}>
                <header>
                  <span>
                    {["日", "一", "二", "三", "四", "五", "六"][d.getDay()]}
                  </span>
                  <b>{d.getDate()}</b>
                </header>
                {visible
                  .filter(
                    (t) =>
                      t.scheduled_at &&
                      new Date(t.scheduled_at).toDateString() ===
                        d.toDateString(),
                  )
                  .map((t) => (
                    <Link key={t.id} to={"/publishing/" + t.id}>
                      <small>{t.account_name}</small>
                      <strong>{t.snapshot.title}</strong>
                      <span>{statusName[t.status]}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {!visible.length && (
        <Empty
          title="给下一篇作品，留一个位置"
          detail="在创作台准备好内容，或在这里创建发布任务。"
        />
      )}
      <div className="soft-note">
        <Clock3 size={17} />
        排期是定时提醒。保持工作台打开可查看到期任务；不会在后台自动发布。
      </div>
      {newTask && (
        <Modal title="安排一篇好内容" onClose={() => setNewTask(false)}>
          <label>
            选择稿件
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">请选择</option>
              {posts.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "未命名笔记"}
                </option>
              ))}
            </select>
          </label>
          <label>
            提醒时间（可选，本地时区）
            <input
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </label>
          <p className="muted">
            不填时间时创建待准备任务。排期只提供提醒，不会自动发布。
          </p>
          <AsyncButton
            disabled={!selected}
            action={async () => {
              const t = await send("/publish-tasks", {
                post_id: selected,
                scheduled_at: scheduled
                  ? new Date(scheduled).toISOString()
                  : null,
              });
              await refresh();
              navigate("/publishing/" + t.id);
            }}
          >
            创建任务 <ArrowUpRight size={15} />
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}

export function TaskPage() {
  const { id } = useParams(),
    task = useData<Task>("/publish-tasks/" + id),
    checks = useData<{ label: string; ok: boolean }[]>(
      "/publish-tasks/" + id + "/preflight",
    );
  const [final, setFinal] = useState(false),
    [done, setDone] = useState(false),
    [url, setUrl] = useState(""),
    [fail, setFail] = useState(false),
    [reason, setReason] = useState("");
  const t = task.data;
  const mutate = async (path: string, data: unknown) => {
    await send(`/publish-tasks/${id}${path}`, data);
    await refresh();
  };
  if (task.error) return <ErrorBox message={task.error.message} />;
  if (!t) return <div className="loading">正在读取任务…</div>;
  const finished = ["PUBLISHED_CONFIRMED", "CANCELLED", "FAILED"].includes(
    t.status,
  );
  return (
    <div className="page">
      <Link className="back-link" to="/publishing">
        <ChevronLeft size={15} />
        发布工作台
      </Link>
      <PageTitle
        eyebrow="A THOUGHTFUL LAST CHECK"
        title="发布前，再看一眼"
        subtitle={`${t.account_name} · 内容版本 ${t.revision} · ${statusName[t.status]}`}
      >
        <span className={"badge status-" + t.status}>
          {statusName[t.status]}
        </span>
      </PageTitle>
      <div className="publish-detail">
        <div className="panel publish-checks">
          <h2>
            <ShieldCheck size={21} />
            发布准备清单
          </h2>
          {checks.data?.map((c) => (
            <div
              key={c.label}
              className={"preflight-row " + (c.ok ? "ok" : "")}
            >
              <span>
                {c.ok ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
              </span>
              {c.label}
            </div>
          ))}
          {!finished && t.status !== "PUBLISHING_ASSISTED" && (
            <>
              <Link to={"/create/" + t.post_id} className="text-link">
                返回稿件修改 / 检查内容 <ArrowUpRight size={14} />
              </Link>
              <AsyncButton
                variant="ghost"
                action={() => mutate("/refresh", {})}
              >
                <RefreshCw size={14} />
                使用稿件最新版本
              </AsyncButton>
              <label className="check-label final-check">
                <input
                  type="checkbox"
                  checked={final}
                  onChange={(e) => setFinal(e.target.checked)}
                />
                我已核对最终文案、账号、封面与素材使用权
              </label>
              <AsyncButton
                disabled={!final || checks.data?.some((c) => !c.ok)}
                action={() => mutate("/prepare", { final_confirmed: final })}
              >
                确认最终稿，完成预检 <Check size={15} />
              </AsyncButton>
            </>
          )}
          {t.status === "READY" && (
            <div className="next-step">
              <h3>下一步，进入人工发布</h3>
              <p>准备好复制文案与下载图片，然后由你在官方页面提交。</p>
              <AsyncButton
                action={() =>
                  mutate("/transition", { status: "PUBLISHING_ASSISTED" })
                }
              >
                开始人工发布 <ArrowUpRight size={15} />
              </AsyncButton>
            </div>
          )}
          {t.status === "PUBLISHING_ASSISTED" && (
            <div className="confirm-box">
              <h3>在官方页面发布后，回到这里</h3>
              <label>
                真实作品链接
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.xiaohongshu.com/explore/…"
                  type="url"
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => setDone(e.target.checked)}
                />
                我已在目标账号完成发布，并核对该链接
              </label>
              <AsyncButton
                disabled={!done || !url.trim()}
                action={() => mutate("/confirm", { url, user_confirmed: done })}
              >
                确认并记录作品 <CheckCircle2 size={15} />
              </AsyncButton>
              <p className="tiny muted">
                记录依据为你的人工确认，工作台不会声称已向平台验证。
              </p>
            </div>
          )}
          {t.publication && (
            <div className="success-box">
              <CheckCircle2 size={24} />
              <h3>
                {t.publication.is_demo ? "演示历史记录" : "已保存人工发布记录"}
              </h3>
              <p>{t.publication.evidence}</p>
              {!t.publication.is_demo && (
                <a href={t.publication.url} target="_blank" rel="noreferrer">
                  查看作品 <ExternalLink size={14} />
                </a>
              )}
              <Link to="/history">进入历史作品 →</Link>
            </div>
          )}
          {!finished && (
            <div className="actions task-actions">
              <AsyncButton
                variant="ghost"
                action={async () => {
                  if (confirm("取消该发布任务？草稿仍会保留。"))
                    await mutate("/transition", { status: "CANCELLED" });
                }}
              >
                取消任务
              </AsyncButton>
              {t.status === "PUBLISHING_ASSISTED" && (
                <Button variant="ghost" onClick={() => setFail(true)}>
                  记录未完成原因
                </Button>
              )}
            </div>
          )}
          <details className="event-log">
            <summary>操作记录 · {t.events.length}</summary>
            {t.events.map((e, i) => (
              <p key={i}>
                {when(e.created_at)} · {statusName[e.to_status] || e.to_status}
                <br />
                {e.detail}
              </p>
            ))}
          </details>
        </div>
        <div className="panel publish-materials">
          <h2>你的发布素材</h2>
          <Cover config={t.snapshot.cover} compact />
          <h3>{t.snapshot.title}</h3>
          <div className="actions">
            <AsyncButton
              variant="outline"
              action={() => copy(t.snapshot.title)}
            >
              <Copy size={14} />
              复制标题
            </AsyncButton>
            <AsyncButton
              variant="outline"
              action={() =>
                copy(
                  t.snapshot.body +
                    "\n\n" +
                    t.snapshot.tags.map((s) => "#" + s).join(" "),
                )
              }
            >
              <Copy size={14} />
              复制正文
            </AsyncButton>
          </div>
          <div className="material-body">{t.snapshot.body}</div>
          <div className="actions">
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "rednote-note.md",
                  `# ${t.snapshot.title}\n\n${t.snapshot.body}\n\n${t.snapshot.tags.map((s) => "#" + s).join(" ")}`,
                )
              }
            >
              <Download size={14} />
              下载文案
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "rednote-publish.json",
                  JSON.stringify(
                    {
                      format: "rednote-studio/1",
                      title: t.snapshot.title,
                      body: t.snapshot.body,
                      tags: t.snapshot.tags,
                      account_name: t.account_name,
                      task_id: t.id,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              导出扩展资料
            </Button>
          </div>
          {t.snapshot.asset_ids.length > 0 && (
            <div className="asset-grid">
              {t.snapshot.asset_ids.map((a) => (
                <div key={a}>
                  <img src={assetUrl(a)} alt="发布图片" />
                  <a href={assetUrl(a)} download={a + ".jpg"}>
                    下载图片
                  </a>
                </div>
              ))}
            </div>
          )}
          <a
            className="btn btn-primary official-link"
            href="https://creator.xiaohongshu.com/publish/publish"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            打开小红书创作页
          </a>
          <p className="tiny muted">
            请核对浏览器中登录的账号为「{t.account_name}」。Profile
            环境可在账号页配置。
          </p>
        </div>
      </div>
      {fail && (
        <Modal title="记录发布未完成的原因" onClose={() => setFail(false)}>
          <label>
            原因
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <AsyncButton
            disabled={!reason.trim()}
            action={async () => {
              await mutate("/transition", { status: "FAILED", error: reason });
              setFail(false);
            }}
          >
            保存记录
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}

const blankAccount = {
  name: "",
  niche: "生活方式",
  positioning: "",
  audience: "",
  tone: "真诚、有细节",
  topics: [] as string[],
  banned_words: [] as string[],
  authorization: "本人账号",
  authorized: true,
  color: "#e76c52",
};
export function AccountsPage() {
  const accounts = useData<Account[]>("/accounts"),
    { id } = useParams(),
    navigate = useNavigate();
  const [create, setCreate] = useState(false);
  const chosen = accounts.data?.find((a) => a.id === id);
  return (
    <div className="page">
      <PageTitle
        eyebrow="DIFFERENT VOICES. ALL YOURS."
        title="每个账号，都有自己的样子"
        subtitle="保存账号定位与个人风格，在独立的浏览器环境中创作。"
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} />
          添加账号
        </Button>
      </PageTitle>
      <div className="account-grid">
        {accounts.data?.map((a) => (
          <Link to={"/accounts/" + a.id} className="account-card" key={a.id}>
            <div className="account-card-top">
              <span className="avatar large" style={{ background: a.color }}>
                {a.name[0]}
              </span>
              <span className="badge">
                {a.is_demo ? "演示账号" : a.authorization}
              </span>
            </div>
            <h2>{a.name}</h2>
            <span className="niche">{a.niche}</span>
            <p>{a.positioning || "为这个账号写下一句清晰的定位。"}</p>
            <div className="topic-tags">
              {a.topics.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
            <div className="account-footer">
              <span>
                <Monitor size={15} />
                {a.profile ? "已关联本地引用" : "未关联环境"}
              </span>
              <ArrowUpRight size={18} />
            </div>
            <p className="tiny muted">登录状态：未检测 · 需人工检查</p>
          </Link>
        ))}
      </div>
      <div className="profile-explainer">
        <div className="profile-illustration">
          <Monitor size={46} />
          <span>01</span>
          <span>02</span>
          <span>03</span>
        </div>
        <div>
          <h2>让不同的创作，拥有独立空间</h2>
          <p>
            每个账号关联一个本地 Chrome
            Profile。你在自己的浏览器里扫码登录，工作台只保存环境名称和引用。
          </p>
          <span className="badge green">
            <ShieldCheck size={13} />
            浏览器登录信息留在本机
          </span>
        </div>
      </div>
      {(chosen || create) && (
        <Modal
          title={chosen ? "账号与创作风格" : "添加自己的创作账号"}
          onClose={() => {
            setCreate(false);
            navigate("/accounts");
          }}
          wide
        >
          <AccountForm
            key={chosen?.id || "new"}
            account={chosen}
            onSaved={async () => {
              await refresh();
              setCreate(false);
              navigate("/accounts");
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function AccountForm({
  account,
  onSaved,
}: {
  account?: Account;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(
    account
      ? (Object.fromEntries(
          Object.keys(blankAccount).map((k) => [k, (account as any)[k]]),
        ) as typeof blankAccount)
      : blankAccount,
  );
  const [profile, setProfile] = useState(account?.profile?.local_ref || ""),
    [alias, setAlias] = useState(account?.profile?.alias || ""),
    [sample, setSample] = useState(""),
    [own, setOwn] = useState(false);
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <>
      <div className="form-grid">
        <label>
          账号昵称
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label>
          领域 / 类别
          <input
            value={form.niche}
            onChange={(e) => set("niche", e.target.value)}
          />
        </label>
        <label className="full">
          账号定位
          <textarea
            rows={3}
            value={form.positioning}
            onChange={(e) => set("positioning", e.target.value)}
          />
        </label>
        <label>
          目标受众
          <input
            value={form.audience}
            onChange={(e) => set("audience", e.target.value)}
          />
        </label>
        <label>
          表达语气
          <input
            value={form.tone}
            onChange={(e) => set("tone", e.target.value)}
          />
        </label>
        <label>
          常用话题（逗号分隔）
          <input
            value={form.topics.join(",")}
            onChange={(e) => set("topics", e.target.value.split(/[,，]/))}
          />
        </label>
        <label>
          避免使用的词（逗号分隔）
          <input
            value={form.banned_words.join(",")}
            onChange={(e) => set("banned_words", e.target.value.split(/[,，]/))}
          />
        </label>
        <label>
          本人 / 授权来源
          <input
            value={form.authorization}
            onChange={(e) => set("authorization", e.target.value)}
          />
        </label>
        <label>
          标记色
          <input
            type="color"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
          />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={form.authorized}
          onChange={(e) => set("authorized", e.target.checked)}
        />
        我拥有该账号或已取得管理授权
      </label>
      <AsyncButton
        disabled={!form.name.trim() || !form.authorization.trim()}
        action={async () => {
          await send(
            account ? "/accounts/" + account.id : "/accounts",
            form,
            account ? "PATCH" : "POST",
          );
          await onSaved();
        }}
      >
        保存账号资料
      </AsyncButton>
      {account && (
        <>
          <hr />
          <h3>
            <Monitor size={17} />
            本地浏览器环境
          </h3>
          <p className="muted">
            状态：未检测。保存引用不会创建目录或读取登录信息。
          </p>
          <div className="form-grid">
            <label>
              环境别名
              <input value={alias} onChange={(e) => setAlias(e.target.value)} />
            </label>
            <label>
              本地引用 ID
              <input
                pattern="[a-zA-Z0-9_-]+"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="例如 creator-one"
              />
            </label>
          </div>
          <AsyncButton
            variant="outline"
            disabled={!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/.test(profile)}
            action={async () => {
              await send("/accounts/" + account.id + "/profile", {
                alias,
                local_ref: profile,
              });
              await refresh();
              useUI.getState().notify("环境引用已保存");
            }}
          >
            保存环境引用
          </AsyncButton>
          <p className="tiny muted">
            在项目目录打开终端，使用本地助手。首次创建会要求确认，打开后由你正常登录。
          </p>
          <code className="command">
            python3 apps/profile-helper/helper.py create{" "}
            {profile || "creator-one"}
            <br />
            python3 apps/profile-helper/helper.py open{" "}
            {profile || "creator-one"}
          </code>
          <AsyncButton
            variant="ghost"
            action={() =>
              copy(
                `python3 apps/profile-helper/helper.py open ${/^[a-zA-Z0-9_-]+$/.test(profile) ? profile : "creator-one"}`,
              )
            }
          >
            <Copy size={14} />
            复制打开命令
          </AsyncButton>
          <a
            className="btn btn-outline"
            href="https://creator.xiaohongshu.com/"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            当前浏览器打开后台
          </a>
          <hr />
          <h3>我的风格样本</h3>
          {account.style_samples.map((s, i) => (
            <blockquote key={i}>{s.content}</blockquote>
          ))}
          <label>
            添加自己的历史内容
            <textarea
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              rows={3}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={own}
              onChange={(e) => setOwn(e.target.checked)}
            />
            我确认拥有这段内容的使用权
          </label>
          <AsyncButton
            variant="outline"
            disabled={!own || sample.length < 10}
            action={async () => {
              await send("/accounts/" + account.id + "/style-samples", {
                content: sample,
                own_work: own,
              });
              setSample("");
              await refresh();
              useUI.getState().notify("风格样本已保存");
            }}
          >
            保存风格样本
          </AsyncButton>
        </>
      )}
    </>
  );
}

export function AssetsPage() {
  const assets = useData<Asset[]>("/assets"),
    ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      await api("/assets", { method: "POST", body: data });
      await refresh();
      useUI.getState().notify("图片已存入素材库");
    } catch (e) {
      useUI.getState().notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="YOUR PERSONAL COLLECTION"
        title="把值得用的，留在手边"
        subtitle="自己的照片、获得授权的素材，都是好内容的起点。"
      >
        <Button disabled={busy} onClick={() => ref.current?.click()}>
          <Upload size={15} />
          {busy ? "上传中…" : "上传图片"}
        </Button>
        <input
          hidden
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </PageTitle>
      <div className="asset-grid library">
        {assets.data?.map((a) => (
          <article className="panel" key={a.id}>
            <img src={assetUrl(a.id)} alt={a.name} />
            <h3>{a.name}</h3>
            <p>
              {a.width} × {a.height}
            </p>
            <a href={assetUrl(a.id)} download={a.name}>
              下载素材 <Download size={14} />
            </a>
          </article>
        ))}
      </div>
      {!assets.data?.length && (
        <Empty
          title="灵感需要一点真实的素材"
          detail="上传 PNG、JPEG 或 WebP，单张不超过 10 MB。图片会移除 EXIF 等元数据。"
        >
          <Button onClick={() => ref.current?.click()}>
            <ImagePlus size={16} />
            添加第一张图片
          </Button>
        </Empty>
      )}
    </div>
  );
}
export function IdeasPage() {
  const ideas = useData<any[]>("/ideas"),
    accounts = useData<Account[]>("/accounts"),
    navigate = useNavigate(),
    ui = useUI();
  const [show, setShow] = useState(false),
    [title, setTitle] = useState(""),
    [note, setNote] = useState("");
  return (
    <div className="page">
      <PageTitle
        eyebrow="SMALL IDEAS, BIG POSSIBILITIES"
        title="先记下来，灵感会长大"
        subtitle="把一闪而过的念头，变成下一篇内容的种子。"
      >
        <Button onClick={() => setShow(true)}>
          <Plus size={16} />
          收集灵感
        </Button>
      </PageTitle>
      <div className="ideas-grid">
        {ideas.data?.map((i, index) => (
          <article className={"idea-card idea-" + (index % 3)} key={i.id}>
            <div className="eyebrow">
              IDEA / {String(index + 1).padStart(2, "0")}
            </div>
            <Lightbulb size={22} />
            <h2>{i.title}</h2>
            <p>{i.note}</p>
            <AsyncButton
              variant="ghost"
              action={async () => {
                const p = await send("/posts", {
                  account_id: ui.account || accounts.data?.[0]?.id,
                  title: i.title,
                  body: i.note,
                  cover: { ...defaultCover, title: i.title },
                });
                await refresh();
                navigate("/create/" + p.id);
              }}
            >
              用这个灵感开始 <ArrowUpRight size={15} />
            </AsyncButton>
          </article>
        ))}
      </div>
      {!ideas.data?.length && <Empty title="今天，有什么值得写下来？" />}
      {show && (
        <Modal title="收集一个新灵感" onClose={() => setShow(false)}>
          <label>
            灵感标题
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            补充几句话
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
            />
          </label>
          <AsyncButton
            disabled={!title.trim()}
            action={async () => {
              await send("/ideas", { title, note });
              setShow(false);
              setTitle("");
              setNote("");
              await refresh();
            }}
          >
            存进灵感箱
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}

export function HistoryPage() {
  const publications = useData<any[]>("/publications"),
    metrics = useData<any[]>("/post-metrics/import"),
    summary = useData("/analytics/summary");
  const [csv, setCsv] = useState(""),
    [show, setShow] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const latest = new Map<string, any>();
  metrics.data?.forEach((m) => latest.set(m.post_id, m));
  const importCsv = async () => {
    const lines = csv
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split(",").map((x) => x.trim()));
    const headers = lines.shift();
    const expected = [
      "post_id",
      "views",
      "likes",
      "comments",
      "saves",
      "followers",
    ];
    if (headers?.join(",") !== expected.join(","))
      throw new Error("CSV 表头需为：" + expected.join(","));
    const rows = lines
      .filter((l) => l.some(Boolean))
      .map((l) => {
        if (l.length !== 6 || l.slice(1).some((x) => !/^\d+$/.test(x)))
          throw new Error("每行需包含稿件 ID 和 5 个非负整数");
        return Object.fromEntries(
          l.map((v, i) => [expected[i], i === 0 ? v : Number(v)]),
        );
      });
    await send("/post-metrics/import", { rows });
    await refresh();
    setShow(false);
    useUI.getState().notify(`已导入 ${rows.length} 条表现快照`);
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="YOUR BODY OF WORK"
        title="每一篇，都在积累"
        subtitle="记录作品，回看反馈，找到自己的创作节奏。"
      >
        <Button
          variant="outline"
          onClick={() => {
            download(
              "metrics-template.csv",
              "post_id,views,likes,comments,saves,followers\n" +
                (publications.data?.[0]?.post_id || "POST_UUID") +
                ",0,0,0,0,0",
            );
          }}
        >
          <Download size={14} />
          CSV 模板
        </Button>
        <Button onClick={() => setShow(true)}>
          <Upload size={14} />
          导入表现数据
        </Button>
      </PageTitle>
      <div className="publishing-stats">
        {[
          ["作品记录", summary.data?.published || 0],
          ["浏览", summary.data?.latest_metrics.views || 0],
          ["收藏", summary.data?.latest_metrics.saves || 0],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>每篇最新快照 · 含演示记录</p>
          </div>
        ))}
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>作品</th>
              <th>确认时间</th>
              <th>浏览</th>
              <th>点赞 / 评论 / 收藏</th>
              <th>涨粉</th>
              <th>记录</th>
            </tr>
          </thead>
          <tbody>
            {publications.data?.map((p) => {
              const m = latest.get(p.post_id);
              return (
                <tr key={p.id}>
                  <td>
                    <Link to={"/publishing/" + p.task_id}>{p.title}</Link>
                    <small className="table-id">{p.post_id}</small>
                  </td>
                  <td>{when(p.created_at)}</td>
                  <td>{m?.views ?? "—"}</td>
                  <td>{m ? `${m.likes} / ${m.comments} / ${m.saves}` : "—"}</td>
                  <td>{m?.followers ?? "—"}</td>
                  <td>
                    {p.is_demo ? (
                      <span className="badge">演示记录</span>
                    ) : (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        查看作品 ↗
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!publications.data?.length && (
          <Empty
            title="第一篇作品，正在路上"
            detail="完成人工发布确认后，它会出现在这里。"
          />
        )}
      </div>
      <div className="soft-note">
        <Lightbulb size={18} />
        复盘建议：比较收藏与评论的变化，再回看具体选题和表达。数据为人工导入快照，不代表平台实时数据。
      </div>
      {show && (
        <Modal title="导入作品表现快照" onClose={() => setShow(false)} wide>
          <p className="muted">
            一行一篇作品，使用表格中稿件 ID。新快照不会覆盖旧记录。
          </p>
          <input
            hidden
            ref={file}
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 500000) {
                  useUI.getState().notify("CSV 请小于 500 KB");
                  return;
                }
                setCsv(await f.text());
              }
            }}
          />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <FolderOpen size={14} />
            选择 CSV 文件
          </Button>
          <label>
            CSV 内容
            <textarea
              rows={8}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="post_id,views,likes,comments,saves,followers"
            />
          </label>
          <AsyncButton disabled={!csv.trim()} action={importCsv}>
            校验并导入
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}

export function SettingsPage() {
  const settings = useData("/settings"),
    rules = useData<any[]>("/compliance-rules");
  const [form, setForm] = useState<any>(null),
    [rule, setRule] = useState<any>(null),
    [token, setToken] = useState("");
  const config = form || settings.data?.workspace.settings;
  return (
    <div className="page">
      <PageTitle
        eyebrow="MAKE THIS SPACE YOURS"
        title="按照你的方式创作"
        subtitle="配置模型、编辑建议和自己的风险词库。"
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>
            <Sparkles size={20} />
            AI 供应商
          </h2>
          <span className="badge green">
            {settings.data?.ai_mode === "live"
              ? "OpenAI-compatible 模型"
              : "确定性 Mock · 开箱可用"}
          </span>
          <p>模型密钥由后端环境变量保管。界面不接收、不保存 API Key。</p>
          <code className="command">
            AI_MODE=live
            <br />
            AI_BASE_URL=https://api.openai.com/v1
            <br />
            AI_MODEL=你的模型名称
            <br />
            AI_API_KEY=仅设置在本地 .env
          </code>
          <p className="tiny muted">
            设置后重启后端。请求失败会保留运行记录，不会伪装生成成功。
          </p>
          <h3>访问令牌（如部署时启用）</h3>
          <input
            aria-label="工作台访问令牌"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="仅保留在当前页面内存"
          />
          <Button
            variant="outline"
            onClick={() => {
              useUI.getState().setToken(token);
              setToken("");
              refresh();
            }}
          >
            应用访问令牌
          </Button>
        </section>
        <section className="panel">
          <h2>
            <Settings2 size={20} />
            编辑建议
          </h2>
          {config && (
            <>
              <div className="form-grid">
                <label>
                  标题建议字数
                  <input
                    type="number"
                    min={1}
                    value={config.title_limit}
                    onChange={(e) =>
                      setForm({ ...config, title_limit: +e.target.value })
                    }
                  />
                </label>
                <label>
                  正文建议字数
                  <input
                    type="number"
                    min={10}
                    value={config.body_limit}
                    onChange={(e) =>
                      setForm({ ...config, body_limit: +e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                规则来源说明
                <input
                  value={config.rule_source}
                  onChange={(e) =>
                    setForm({ ...config, rule_source: e.target.value })
                  }
                />
              </label>
              <p className="muted tiny">
                这些是可维护的编辑建议，不表示平台永久限制。请以当前官方创作页面的提示为准。
              </p>
              <AsyncButton
                action={async () => {
                  await send("/settings", config, "PATCH");
                  await refresh();
                  useUI.getState().notify("编辑规则已更新");
                }}
              >
                保存设置
              </AsyncButton>
            </>
          )}
          <hr />
          <h3>
            <ShieldCheck size={18} />
            隐私与发布能力
          </h3>
          <p>
            默认数据保存在本机。浏览器 Profile 助手不上传 Cookie。官方发布 API
            尚未授权。
          </p>
          <p className="tiny muted">
            扩展：支持用户主动导入资料、复制、下载与打开官方页面，不会自动点击提交。
          </p>
        </section>
      </div>
      <section className="panel rule-panel">
        <div className="panel-heading">
          <h2>
            自己的风险词库{" "}
            <span className="badge">{rules.data?.length || 0} 条</span>
          </h2>
          <Button
            variant="outline"
            onClick={() =>
              setRule({
                term: "",
                risk_type: "自定义",
                severity: "medium",
                explanation: "请结合上下文人工复核",
                suggestion: "",
                source: "用户自定义规则",
                enabled: true,
              })
            }
          >
            <Plus size={15} />
            添加规则
          </Button>
        </div>
        <p className="muted">
          演示词库是启发式提示，并非平台官方禁词清单。维护日期与参考来源可在每条规则中查看。
        </p>
        <div className="rules-list">
          {rules.data?.map((r) => (
            <button key={r.id} onClick={() => setRule(r)}>
              <span className={"risk " + r.severity}>{r.severity}</span>
              <strong>{r.term}</strong>
              <span>{r.risk_type}</span>
              <span>{r.enabled ? "启用" : "已停用"}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>
      {rule && (
        <Modal
          title={rule.id ? "编辑风险规则" : "添加风险规则"}
          onClose={() => setRule(null)}
        >
          <div className="form-grid">
            <label>
              匹配词
              <input
                value={rule.term}
                onChange={(e) => setRule({ ...rule, term: e.target.value })}
              />
            </label>
            <label>
              分类
              <input
                value={rule.risk_type}
                onChange={(e) =>
                  setRule({ ...rule, risk_type: e.target.value })
                }
              />
            </label>
            <label>
              等级
              <select
                value={rule.severity}
                onChange={(e) => setRule({ ...rule, severity: e.target.value })}
              >
                <option value="low">低 · 提示</option>
                <option value="medium">中 · 复核</option>
                <option value="high">高 · 重点复核</option>
              </select>
            </label>
            <label>
              建议替换
              <input
                value={rule.suggestion}
                onChange={(e) =>
                  setRule({ ...rule, suggestion: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            解释
            <textarea
              value={rule.explanation}
              onChange={(e) =>
                setRule({ ...rule, explanation: e.target.value })
              }
            />
          </label>
          <label>
            依据 / 来源
            <textarea
              value={rule.source}
              onChange={(e) => setRule({ ...rule, source: e.target.value })}
            />
          </label>
          <p className="tiny muted">
            维护时间：
            {rule.maintained_at ? when(rule.maintained_at) : "保存时记录"}
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
            />
            启用此规则
          </label>
          <AsyncButton
            disabled={!rule.term.trim() || !rule.suggestion.trim()}
            action={async () => {
              const data = Object.fromEntries(
                [
                  "term",
                  "risk_type",
                  "severity",
                  "explanation",
                  "suggestion",
                  "source",
                  "enabled",
                ].map((k) => [k, rule[k]]),
              );
              await send(
                rule.id ? "/compliance-rules/" + rule.id : "/compliance-rules",
                data,
                rule.id ? "PATCH" : "POST",
              );
              setRule(null);
              await refresh();
            }}
          >
            保存规则
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}
