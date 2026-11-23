import { assetUrl } from "./api";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  Search,
  FileText,
  Lightbulb,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Check,
  History,
  MoreHorizontal,
  Bold,
  Italic,
  List,
  Quote,
  Smile,
  Hash,
  Undo2,
  ImagePlus,
  Trash2,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  ScanSearch,
  Type,
  PenLine,
  PanelsTopLeft,
  Fingerprint,
  Clock3,
  Send,
  RefreshCw,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  api,
  useData,
  useUI,
  send,
  when,
  length,
  replaceSpan,
  refresh,
} from "./api";
import {
  type Account,
  type Post,
  type Skill,
  type Patch,
  type Check as CheckData,
  type Finding,
  type Asset,
  defaultCover,
} from "./types";
import { AsyncButton, Modal, DiffModal, ErrorBox, Empty } from "./ui";
import { SkillRunner } from "./SkillRunner";
import { Cover } from "./Cover";
import { useEditor } from "./useEditor";
import Markdown from "react-markdown";
export const skillIcons: Record<string, typeof Sparkles> = {
  viral_deconstruction: ScanSearch,
  topic_ideation: Lightbulb,
  title_optimizer: Type,
  note_writer: PenLine,
  cover_designer: PanelsTopLeft,
  compliance_review: ShieldCheck,
  seo_optimizer: Search,
  style_rewriter: Fingerprint,
};
export function Highlight({
  text,
  findings,
}: {
  text: string;
  findings: Finding[];
}) {
  const chars = Array.from(text);
  const segments = [];
  let at = 0;
  for (const f of [...findings].sort((a, b) => a.span_start - b.span_start)) {
    if (f.span_start < at) continue;
    segments.push(chars.slice(at, f.span_start).join(""));
    segments.push(
      <mark title={f.explanation} key={f.id}>
        {chars.slice(f.span_start, f.span_end).join("")}
      </mark>,
    );
    at = f.span_end;
  }
  segments.push(chars.slice(at).join(""));
  return <>{segments}</>;
}
export default function CreatePage() {
  const posts = useData<Post[]>("/posts");
  const { id } = useParams();
  const { post } = useUI();
  if (posts.isPending) return <div className="loading">正在打开创作台…</div>;
  if (posts.error) return <ErrorBox message={posts.error.message} />;
  const selected = id
    ? posts.data?.find((p) => p.id === id)
    : posts.data?.find((p) => p.id === post) ||
      posts.data?.find((p) => p.title === "周一不慌张的工作仪式") ||
      posts.data?.[0];
  if (!selected) return <NewPostEmpty />;
  return (
    <Editor key={selected.id} initial={selected} posts={posts.data || []} />
  );
}
function NewPostEmpty() {
  const accounts = useData<Account[]>("/accounts"),
    navigate = useNavigate();
  return (
    <Empty
      title="你的下一篇好内容，从这里开始"
      detail="先创建草稿，给一个小小的想法留个位置。"
    >
      <AsyncButton
        disabled={!accounts.data?.length}
        action={async () => {
          const p = await send("/posts", { account_id: accounts.data![0].id });
          await refresh();
          navigate("/create/" + p.id);
        }}
      >
        <Plus size={16} />
        创建第一篇草稿
      </AsyncButton>
    </Empty>
  );
}
function Editor({ initial, posts }: { initial: Post; posts: Post[] }) {
  const { draft, change, save, replace, status, error } = useEditor(initial);
  const accounts = useData<Account[]>("/accounts").data || [],
    skills = useData<Skill[]>("/skills").data || [],
    assets = useData<Asset[]>("/assets").data || [],
    settings = useData("/settings").data;
  const navigate = useNavigate(),
    ui = useUI();
  const account = accounts.find((a) => a.id === draft.account_id);
  const [tab, setTab] = useState("write"),
    [search, setSearch] = useState(""),
    [skill, setSkill] = useState<Skill | null>(null),
    [check, setCheck] = useState<CheckData | null>(null),
    [versions, setVersions] = useState<any[] | null>(null),
    [preview, setPreview] = useState<Patch | null>(null),
    [undo, setUndo] = useState<Patch | null>(null),
    [left, setLeft] = useState(true),
    [right, setRight] = useState(true),
    [showAssets, setShowAssets] = useState(false),
    [tagText, setTagText] = useState(""),
    [ignore, setIgnore] = useState<Finding | null>(null),
    [reason, setReason] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null),
    uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ui.setPost(initial.id);
    api<CheckData | null>(`/posts/${initial.id}/compliance-check`)
      .then(setCheck)
      .catch(() => {});
  }, [initial.id]);
  const validCheck =
    check && check.revision === draft.revision && status === "已保存"
      ? check
      : null;
  const apply = async (patch: Patch) => {
    await save();
    setUndo({
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      cover: draft.cover,
    });
    change(patch);
    await save("应用 Skill 建议");
    ui.notify("已应用建议，原稿保留在版本历史");
  };
  const newPost = async () => {
    await save();
    const p = await send("/posts", {
      account_id: ui.account || draft.account_id,
      cover: defaultCover,
    });
    await refresh();
    navigate("/create/" + p.id);
  };
  const checkContent = async (ai = false) => {
    const p = await save();
    setCheck(await send(`/posts/${p.id}/compliance-check?ai=${ai}`, {}));
    ui.notify("检查完成，请复核提示与上下文");
  };
  const replaceFinding = async (f: Finding) => {
    if (!validCheck) throw new Error("检查已过期，请重新运行");
    if (f.field === "context") throw new Error("语境提示需要人工复核");
    if (f.field.startsWith("cover.")) {
      const key = f.field.split(".")[1] as "title" | "subtitle";
      change({
        cover: {
          ...draft.cover,
          [key]: replaceSpan(
            draft.cover[key],
            f.span_start,
            f.span_end,
            f.suggestion,
          ),
        },
      });
    } else if (f.field === "tags") {
      change({
        tags: replaceSpan(
          draft.tags.join(" "),
          f.span_start,
          f.span_end,
          f.suggestion,
        ).split(" "),
      });
    } else {
      const key = f.field as "title" | "body";
      change({
        [key]: replaceSpan(draft[key], f.span_start, f.span_end, f.suggestion),
      });
    }
    await save("采用风险改写建议");
    await checkContent();
  };
  const format = (before: string, after = "") => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const a = textarea.selectionStart,
      b = textarea.selectionEnd;
    change({
      body:
        draft.body.slice(0, a) +
        before +
        draft.body.slice(a, b) +
        after +
        draft.body.slice(b),
    });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(a + before.length, b + before.length);
    });
  };
  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const a = await api<Asset>("/assets", { method: "POST", body: form });
    change({ asset_ids: [...draft.asset_ids, a.id] });
    await save("添加素材");
    await refresh();
  };
  const prepare = async () => {
    await save();
    const existing = (await api<any[]>("/publish-tasks")).find(
      (t) =>
        t.post_id === draft.id && !["CANCELLED", "FAILED"].includes(t.status),
    );
    const t = existing || (await send("/publish-tasks", { post_id: draft.id }));
    await refresh();
    navigate("/publishing/" + t.id);
  };
  const limit = settings?.workspace.settings || {
    title_limit: 20,
    body_limit: 1000,
  };
  return (
    <div className="creation">
      <div className="creation-heading">
        <div>
          <div className="eyebrow">YOUR CREATIVE SPACE</div>
          <h1>
            把今天的灵感，写成好内容<span className="red-dot">.</span>
          </h1>
          <p>从一个小小的想法，到一篇属于你的作品。</p>
        </div>
        <AsyncButton
          variant="outline"
          action={async () => {
            await save();
            navigate("/ideas");
          }}
        >
          <Lightbulb size={15} />
          灵感收件箱 <ArrowUpRight size={14} />
        </AsyncButton>
      </div>
      <div className="creation-toolbar">
        <div className="toolbar-left">
          <span className="avatar small" style={{ background: account?.color }}>
            {account?.name[0]}
          </span>
          <select
            aria-label="稿件绑定账号"
            value={draft.account_id}
            onChange={(e) => change({ account_id: e.target.value })}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="separator" />
          <span
            className={"save-status " + (status === "保存失败" ? "red" : "")}
          >
            <span
              className={
                status === "已保存" ? "status-dot" : "status-dot amber"
              }
            />
            {status} {status === "已保存" && when(draft.updated_at)}
          </span>
        </div>
        <div className="actions">
          <AsyncButton
            className="new-note-mobile"
            variant="outline"
            title="新建笔记"
            action={newPost}
          >
            <Plus size={15} />
          </AsyncButton>
          <span className="badge">
            {initial.is_demo ? "演示草稿" : "我的草稿"}
          </span>
          <AsyncButton
            variant="ghost"
            action={async () => {
              await save();
              ui.notify("草稿已保存");
            }}
          >
            <Check size={15} />
            保存草稿
          </AsyncButton>
          <AsyncButton action={prepare}>
            准备发布 <ArrowUpRight size={15} />
          </AsyncButton>
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <div
        className={
          "editor-layout " +
          (!left ? "left-closed " : "") +
          (!right ? "right-closed" : "")
        }
      >
        {left && (
          <aside className="draft-sidebar">
            <div className="panel-heading">
              <h3>
                我的草稿 <span>{posts.length}</span>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                aria-label="收起草稿"
                onClick={() => setLeft(false)}
              >
                <PanelLeftClose size={15} />
              </Button>
            </div>
            <AsyncButton variant="outline" action={newPost}>
              <Plus size={15} />
              新建笔记
            </AsyncButton>
            <div className="search-input">
              <Search size={14} />
              <input
                placeholder="搜索草稿…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="drafts-list">
              {posts
                .filter(
                  (p) =>
                    (!ui.account || p.account_id === ui.account) &&
                    p.title.includes(search),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    className={
                      "draft-row " + (p.id === draft.id ? "selected" : "")
                    }
                    onClick={async () => {
                      try {
                        await save();
                        navigate("/create/" + p.id);
                      } catch {}
                    }}
                  >
                    <FileText size={17} />
                    <div>
                      <strong>{p.title || "未命名笔记"}</strong>
                      <span>
                        {when(p.updated_at)} <i>草稿</i>
                      </span>
                    </div>
                  </button>
                ))}
            </div>
            <div className="positioning">
              <div className="eyebrow">MY NORTH STAR</div>
              <h4>{account?.niche} · 账号定位</h4>
              <p>{account?.positioning}</p>
              <Link to={"/accounts/" + account?.id}>
                调整创作风格 <ArrowUpRight size={13} />
              </Link>
            </div>
            <button
              className="template-link"
              onClick={async () => {
                const templates = await api<any[]>("/templates");
                if (templates[0]) setPreview(templates[0].content);
              }}
            >
              <PanelsTopLeft size={15} />
              从内容模板开始 <ChevronRight size={14} />
            </button>
          </aside>
        )}
        <main className="document">
          <div className="document-tabs">
            <div className="tab-group">
              {!left && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="展开草稿"
                  onClick={() => setLeft(true)}
                >
                  <PanelLeftOpen size={15} />
                </Button>
              )}
              {[
                ["write", "文案编辑"],
                ["cover", "封面设计"],
                ["preview", "笔记预览"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="actions">
              <AsyncButton
                variant="ghost"
                title="版本历史"
                action={async () => {
                  await save();
                  setVersions(await api(`/posts/${draft.id}/versions`));
                }}
              >
                <History size={16} />
              </AsyncButton>
              {undo && (
                <AsyncButton
                  variant="ghost"
                  title="撤销 AI 修改"
                  action={async () => {
                    change(undo);
                    await save("撤销 AI 修改");
                    setUndo(null);
                  }}
                >
                  <Undo2 size={16} />
                </AsyncButton>
              )}
              {!right && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="展开助手"
                  onClick={() => setRight(true)}
                >
                  <PanelRightOpen size={15} />
                </Button>
              )}
            </div>
          </div>
          {tab === "write" && (
            <>
              <div className="document-content">
                <div className="document-kicker">
                  <span>图文笔记</span>
                  <span>LET YOUR IDEAS GROW</span>
                </div>
                <input
                  className="title-input"
                  aria-label="笔记标题"
                  placeholder="给这篇笔记，一个好标题…"
                  value={draft.title}
                  onChange={(e) => change({ title: e.target.value })}
                  maxLength={500}
                />
                <div className="title-count">
                  <span>
                    {length(draft.title)} / {limit.title_limit} 字
                  </span>
                  {length(draft.title) > limit.title_limit && (
                    <span className="red">超出当前编辑建议</span>
                  )}
                  <button
                    onClick={() =>
                      setSkill(skills.find((s) => s.id === "title_optimizer")!)
                    }
                  >
                    <Sparkles size={13} />
                    试试 AI 标题
                  </button>
                </div>
                <div className="format-toolbar">
                  <button aria-label="加粗" onClick={() => format("**", "**")}>
                    <Bold size={15} />
                  </button>
                  <button aria-label="斜体" onClick={() => format("*", "*")}>
                    <Italic size={15} />
                  </button>
                  <button aria-label="列表" onClick={() => format("\n- ")}>
                    <List size={16} />
                  </button>
                  <button aria-label="引用" onClick={() => format("\n> ")}>
                    <Quote size={15} />
                  </button>
                  <span />
                  <button aria-label="添加表情" onClick={() => format("🌿 ")}>
                    <Smile size={15} />
                  </button>
                  <button aria-label="添加话题符号" onClick={() => format("#")}>
                    <Hash size={15} />
                  </button>
                  <span className="format-label">Markdown</span>
                </div>
                <textarea
                  ref={bodyRef}
                  aria-label="笔记正文"
                  className="body-editor"
                  placeholder="写下你的真实体验，剩下的交给灵感。"
                  value={draft.body}
                  onChange={(e) => change({ body: e.target.value })}
                />
                <div className="body-footer">
                  <span>
                    {length(draft.body)} / {limit.body_limit} 字
                  </span>
                  <span>你的经历，就是最好的素材。</span>
                </div>
                <div className="tags">
                  <Hash size={15} />
                  {draft.tags.map((tag, i) => (
                    <button
                      key={i}
                      title="点击移除话题"
                      onClick={() =>
                        change({ tags: draft.tags.filter((_, j) => i !== j) })
                      }
                    >
                      #{tag} <span>×</span>
                    </button>
                  ))}
                  <input
                    aria-label="添加话题"
                    placeholder="添加话题，回车确认"
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagText.trim()) {
                        change({
                          tags: Array.from(
                            new Set([
                              ...draft.tags,
                              tagText.trim().replace(/^#/, ""),
                            ]),
                          ).slice(0, 30),
                        });
                        setTagText("");
                      }
                    }}
                  />
                </div>
                <div className="attachments-heading">
                  <span>
                    图片素材 <b>{draft.asset_ids.length + 1}</b>
                  </span>
                  <button onClick={() => setShowAssets(true)}>
                    从素材库添加 <Plus size={13} />
                  </button>
                </div>
                <div className="attachments">
                  <button
                    className="cover-thumb"
                    onClick={() => setTab("cover")}
                    style={{
                      background: draft.cover.background,
                      color: draft.cover.foreground,
                    }}
                  >
                    <span>封面</span>
                    <strong>{draft.cover.title}</strong>
                    <small>编辑封面 ↗</small>
                  </button>
                  {draft.asset_ids.map((a) => (
                    <div className="attachment" key={a}>
                      <img src={assetUrl(a)} alt="笔记图片" />
                      <button
                        aria-label="移除图片"
                        onClick={() =>
                          change({
                            asset_ids: draft.asset_ids.filter((id) => id !== a),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="upload-tile"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <ImagePlus size={22} />
                    <span>上传图片</span>
                    <small>PNG / JPG / WebP</small>
                  </button>
                  <input
                    hidden
                    ref={uploadRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        upload(e.target.files[0]).catch((e) =>
                          ui.notify(e.message),
                        );
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="document-bottom">
                <span>
                  <ShieldCheck size={14} />
                  你的创作，始终由你掌控
                </span>
                <AsyncButton
                  variant="ghost"
                  action={async () => {
                    if (!confirm("删除此草稿及其版本？此操作不可撤销。"))
                      return;
                    await api(`/posts/${draft.id}`, { method: "DELETE" });
                    await refresh();
                    ui.setPost("");
                    navigate("/create");
                  }}
                >
                  <Trash2 size={14} />
                </AsyncButton>
              </div>
            </>
          )}
          {tab === "cover" && (
            <div className="document-content">
              <Cover
                config={draft.cover}
                onChange={(cover) => change({ cover })}
                assets={assets}
              />
            </div>
          )}
          {tab === "preview" && (
            <div className="note-preview">
              <Cover config={draft.cover} compact />
              <h2>{draft.title}</h2>
              <div className="markdown">
                <Markdown>{draft.body}</Markdown>
              </div>
              <p className="red">{draft.tags.map((t) => "#" + t).join(" ")}</p>
              <span className="muted">
                预览效果仅供编辑参考，实际展示以平台为准。
              </span>
            </div>
          )}
        </main>
        {right && (
          <aside className="assistant-panel">
            <div className="panel-heading">
              <h3>
                <Sparkles size={17} />
                创作助手
              </h3>
              <Button
                variant="ghost"
                size="icon"
                aria-label="收起助手"
                onClick={() => setRight(false)}
              >
                <PanelRightClose size={15} />
              </Button>
            </div>
            <div className="assistant-intro">
              <span className="badge green">
                {settings?.ai_mode === "live"
                  ? "模型已连接"
                  : "本地 Mock · 无需 Key"}
              </span>
              <p>
                一个人的创作，
                <br />
                <strong>也有一整支内容团队。</strong>
              </p>
            </div>
            <div className="skill-quick-grid">
              {skills.map((s) => {
                const Icon = skillIcons[s.id] || Sparkles;
                return (
                  <button
                    key={s.id}
                    onClick={() =>
                      s.id === "compliance_review"
                        ? checkContent().catch((e) => ui.notify(e.message))
                        : setSkill(s)
                    }
                  >
                    <Icon size={18} />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
            <AsyncButton
              variant="secondary"
              className="pipeline-button"
              action={async () => {
                await save();
                const result = await send(`/posts/${draft.id}/pipeline`, {});
                setPreview(result.patch);
                ui.notify("5 个步骤已完成，应用后需重新检查内容");
              }}
            >
              <Sparkles size={15} />
              从选题到封面，一起完成 <ArrowUpRight size={14} />
            </AsyncButton>
            <div className="compliance-section">
              <div className="panel-heading">
                <h3>发布前，检查一下</h3>
                <span className="tiny muted">
                  {validCheck ? "v" + validCheck.revision : "待检查"}
                </span>
              </div>
              <AsyncButton variant="outline" action={() => checkContent()}>
                <ShieldCheck size={15} />
                检查内容
              </AsyncButton>
              <div className="check-note">
                规则提示不等于违规结论，需结合上下文复核。
              </div>
              {validCheck ? (
                <>
                  <div
                    className={
                      "check-summary " +
                      (validCheck.findings.some((f) => !f.decision)
                        ? "warning"
                        : "success")
                    }
                  >
                    <ShieldCheck size={15} />
                    {validCheck.findings.filter((f) => !f.decision).length
                      ? `${validCheck.findings.filter((f) => !f.decision).length} 处内容建议复核`
                      : "当前版本风险复核已完成"}
                  </div>
                  {validCheck.findings.map((f) => (
                    <div
                      className={"finding " + (f.decision ? "resolved" : "")}
                      key={f.id}
                    >
                      <div>
                        <span className={"risk " + f.severity}>
                          {f.severity === "high" ? "重点复核" : "风险提示"}
                        </span>
                        <small>{f.field}</small>
                      </div>
                      <strong>“{f.matched_text}”</strong>
                      <p>{f.explanation}</p>
                      <div className="suggestion">建议：{f.suggestion}</div>
                      <details>
                        <summary>规则来源</summary>
                        <p>{f.source}</p>
                      </details>
                      {f.decision ? (
                        <p className="success">已复核：{f.decision.reason}</p>
                      ) : (
                        <div className="actions">
                          {f.field !== "context" && (
                            <AsyncButton
                              variant="ghost"
                              action={() => replaceFinding(f)}
                            >
                              采用建议
                            </AsyncButton>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIgnore(f);
                              setReason("");
                            }}
                          >
                            记录复核理由
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {validCheck.findings.some((f) => f.field === "body") && (
                    <details className="highlight-preview">
                      <summary>查看正文命中位置</summary>
                      <pre>
                        <Highlight
                          text={draft.body}
                          findings={validCheck.findings.filter(
                            (f) => f.field === "body",
                          )}
                        />
                      </pre>
                    </details>
                  )}
                  <p className="tiny muted">{validCheck.context_status}</p>
                </>
              ) : (
                <div className="check-empty">
                  <ShieldCheck size={25} />
                  <p>
                    每次修改后重新检查，
                    <br />
                    让建议与最新稿件保持一致。
                  </p>
                </div>
              )}
              <AsyncButton variant="ghost" action={() => checkContent(true)}>
                加入 AI 语境复核 <ChevronRight size={13} />
              </AsyncButton>
            </div>
            <div className="quiet-tip">
              <span>✳</span>
              <p>
                真实的细节，
                <br />
                比完美的表达更动人。
              </p>
            </div>
          </aside>
        )}
      </div>
      {skill && (
        <Modal title={skill.name} onClose={() => setSkill(null)} wide>
          <SkillRunner
            skill={skill}
            post={draft}
            account={account}
            onApply={apply}
            beforeRun={() => save()}
          />
        </Modal>
      )}
      {preview && (
        <DiffModal
          post={draft}
          patch={preview}
          onApply={apply}
          onClose={() => setPreview(null)}
        />
      )}
      {versions && (
        <Modal
          title="每一次修改，都有迹可循"
          onClose={() => setVersions(null)}
          wide
        >
          {versions.map((v) => (
            <div className="version-row" key={v.id}>
              <div>
                <strong>
                  版本 {v.revision} · {v.reason}
                </strong>
                <p className="muted">{when(v.created_at)}</p>
                <details>
                  <summary>{v.snapshot.title || "未命名笔记"}</summary>
                  <pre>{v.snapshot.body}</pre>
                </details>
              </div>
              <AsyncButton
                variant="outline"
                disabled={v.revision === draft.revision}
                action={async () => {
                  const p = await save();
                  replace(
                    await send(`/posts/${draft.id}/restore/${v.id}`, {
                      revision: p.revision,
                    }),
                  );
                  await refresh();
                  setVersions(null);
                  ui.notify("已恢复版本，新快照已保留");
                }}
              >
                恢复此版本
              </AsyncButton>
            </div>
          ))}
        </Modal>
      )}
      {showAssets && (
        <Modal title="从素材库添加" onClose={() => setShowAssets(false)}>
          <div className="asset-grid">
            {assets.map((a) => (
              <button
                key={a.id}
                disabled={draft.asset_ids.includes(a.id)}
                onClick={() => {
                  change({ asset_ids: [...draft.asset_ids, a.id] });
                  setShowAssets(false);
                }}
              >
                <img src={assetUrl(a.id)} alt={a.name} />
                <span>{a.name}</span>
              </button>
            ))}
          </div>
          {!assets.length && (
            <Empty
              title="还没有素材"
              detail="上传自己的图片，让创作更有辨识度。"
            />
          )}
        </Modal>
      )}
      {ignore && (
        <Modal title="记录你的复核判断" onClose={() => setIgnore(null)}>
          <p>
            “{ignore.matched_text}” · {ignore.risk_type}
          </p>
          <label>
            为何在当前语境下保留此表达？
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="至少 4 个字，说明依据或授权情况"
            />
          </label>
          <AsyncButton
            disabled={reason.trim().length < 4}
            action={async () => {
              await send(`/compliance-findings/${ignore.id}/ignore`, {
                reason,
              });
              setCheck(await api(`/posts/${draft.id}/compliance-check`));
              setIgnore(null);
            }}
          >
            保存复核记录
          </AsyncButton>
        </Modal>
      )}
    </div>
  );
}
