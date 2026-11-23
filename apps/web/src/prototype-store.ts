import fixture from "../../../data/demo/seed.json";
import { defaultCover } from "./types";
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const key = "rednote-studio-prototype-v1";
let state: any;
try {
  state = JSON.parse(localStorage.getItem(key) || "null") || clone(fixture);
} catch {
  state = clone(fixture);
}
window.__REDNOTE_PROTOTYPE__ = true;
window.__REDNOTE_ASSETS__ = state.assetFiles || {};
const persist = () => {
  state.assetFiles = window.__REDNOTE_ASSETS__;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    throw new Error("原型本地存储空间不足，请删除图片或重置原型数据");
  }
};
const id = () => crypto.randomUUID(),
  now = () => new Date().toISOString();
const find = (table: string, value: string) => {
  const item = state[table].find((x: any) => x.id === value);
  if (!item) throw new Error("原型记录不存在");
  return item;
};
const snap = (p: any) =>
  Object.fromEntries(
    ["account_id", "title", "body", "tags", "cover", "asset_ids"].map((k) => [
      k,
      clone(p[k]),
    ]),
  );
const version = (p: any, reason: string) => {
  const v = {
    id: id(),
    post_id: p.id,
    revision: p.revision,
    snapshot: snap(p),
    reason,
    created_at: now(),
  };
  state.versions.push(v);
  return v;
};
const task = (t: any) => ({
  ...t,
  snapshot: find("versions", t.version_id).snapshot,
  revision: find("versions", t.version_id).revision,
  account_name: find("accounts", t.account_id).name,
});
function runSkill(skill: string, input: any, post: any) {
  const topic = input.topic || post?.title || "日常小事";
  if (skill === "viral_deconstruction" && !input.reference)
    throw new Error("请粘贴参考内容");
  if (skill === "style_rewriter" && (!input.own_work || !input.own_sample))
    throw new Error("请提供自己的内容并确认使用权");
  const replace = (v: any): any =>
    typeof v === "string"
      ? v
          .replaceAll("__TOPIC__", topic)
          .replaceAll("__BODY__", post?.body || "写下自己的真实体验。")
      : Array.isArray(v)
        ? v.map(replace)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v).map(([k, a]) => [k, replace(a)]),
            )
          : v;
  const out = replace(state.mockOutputs[skill]);
  if (!out) throw new Error("未知 Skill");
  const r = {
    id: id(),
    skill_id: skill,
    post_id: post?.id,
    input,
    output: out,
    status: "SUCCEEDED",
    provider: "mock",
    duration_ms: 120,
    prompt_version: "1.0.0",
    error: null,
    created_at: now(),
  };
  state.skillRuns.unshift(r);
  return r;
}
function compliance(p: any, ai = false) {
  const check: any = {
    id: id(),
    post_id: p.id,
    revision: p.revision,
    context_status: ai ? "原型 Mock 语境提示，需人工核对" : "原型本地规则检查",
    findings: [],
  };
  const fields = {
    title: p.title,
    body: p.body,
    tags: p.tags.join(" "),
    "cover.title": p.cover.title,
    "cover.subtitle": p.cover.subtitle,
  };
  for (const [field, value] of Object.entries(fields))
    for (const r of state.rules.filter((r: any) => r.enabled)) {
      let from = 0;
      while (true) {
        const start = value.indexOf(r.term, from);
        if (start < 0) break;
        if (
          r.term === "第一" &&
          ["步", "次", "天", "段", "件", "章"].includes(
            value[start + r.term.length],
          )
        ) {
          from = start + r.term.length;
          continue;
        }
        check.findings.push({
          id: id(),
          rule_id: r.id,
          field,
          span_start: Array.from(value.slice(0, start)).length,
          span_end: Array.from(value.slice(0, start + r.term.length)).length,
          matched_text: r.term,
          risk_type: r.risk_type,
          severity: r.severity,
          explanation: r.explanation + "（演示规则，仅建议人工复核）",
          suggestion: r.suggestion,
          source: r.source,
          source_type: "rule",
          review_required: true,
          decision: null,
        });
        from = start + r.term.length;
      }
    }
  state.checks = state.checks.filter((c: any) => c.post_id !== p.id);
  state.checks.push(check);
  return check;
}
function preflight(t: any) {
  const p = find("posts", t.post_id),
    v = find("versions", t.version_id),
    c = state.checks.find(
      (c: any) => c.post_id === p.id && c.revision === p.revision,
    );
  return [
    { label: "标题与正文完整", ok: !!(p.title && p.body) },
    { label: "封面或图片已准备", ok: !!p.cover.title },
    { label: "账号已确认授权", ok: find("accounts", p.account_id).authorized },
    {
      label: "任务与当前稿件版本、账号一致",
      ok: p.revision === v.revision && p.account_id === t.account_id,
    },
    {
      label: "当前版本已完成风险复核",
      ok: !!c && !c.findings.some((f: any) => !f.decision),
    },
    {
      label: "文案长度符合当前编辑规则",
      ok:
        Array.from(p.title).length <=
          state.settings.workspace.settings.title_limit &&
        Array.from(p.body).length <=
          state.settings.workspace.settings.body_limit,
    },
  ];
}
async function handle(
  path: string,
  method: string,
  data: any,
  options: RequestInit,
) {
  const parts = path.split("?")[0].split("/").filter(Boolean),
    [table, pid, action, sub] = parts;
  const get = method === "GET";
  if (table === "health") return { status: "ok", mode: "offline-prototype" };
  if (table === "settings") {
    if (!get) state.settings.workspace.settings = data;
    return state.settings;
  }
  if (table === "skills") {
    if (get) return state.skills;
    return runSkill(
      pid,
      data.input || {},
      data.post_id ? find("posts", data.post_id) : null,
    );
  }
  if (table === "skill-runs") {
    return pid
      ? {
          ...find("skillRuns", pid),
          usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost: 0 },
        }
      : state.skillRuns;
  }
  if (table === "accounts") {
    if (get) return pid ? find("accounts", pid) : state.accounts;
    if (action === "profile") {
      const a = find("accounts", pid);
      a.profile = { ...data, status: "原型未检测 · 需人工检查" };
      return a.profile;
    }
    if (action === "style-samples") {
      if (!data.own_work) throw new Error("请确认使用权");
      const s = { ...data, id: id() };
      find("accounts", pid).style_samples.push(s);
      return s;
    }
    if (pid) {
      Object.assign(find("accounts", pid), data);
      return find("accounts", pid);
    }
    const a = {
      ...data,
      id: id(),
      profile: null,
      style_samples: [],
      publication_count: 0,
      is_demo: true,
    };
    state.accounts.push(a);
    return a;
  }
  if (table === "posts") {
    if (!pid) {
      if (get)
        return [...state.posts].sort((a, b) =>
          b.updated_at.localeCompare(a.updated_at),
        );
      const p = {
        id: id(),
        title: "",
        body: "",
        tags: [],
        asset_ids: [],
        cover: clone(defaultCover),
        ...data,
        revision: 1,
        is_demo: true,
        updated_at: now(),
      };
      state.posts.unshift(p);
      version(p, "新建原型草稿");
      return p;
    }
    const p = find("posts", pid);
    if (action === "versions") {
      if (get)
        return state.versions
          .filter((v: any) => v.post_id === pid)
          .sort((a: any, b: any) => b.revision - a.revision);
      p.revision++;
      return version(p, "原型手动快照");
    }
    if (action === "restore") {
      Object.assign(p, clone(find("versions", sub).snapshot));
      p.revision++;
      p.updated_at = now();
      version(p, "恢复原型版本");
      return p;
    }
    if (action === "compliance-check") {
      return get
        ? state.checks.find(
            (c: any) => c.post_id === pid && c.revision === p.revision,
          ) || null
        : compliance(p, path.includes("ai=true"));
    }
    if (action === "pipeline") {
      const context = clone(p),
        patch: any = {},
        runs = [];
      for (const skill of [
        "topic_ideation",
        "note_writer",
        "title_optimizer",
        "compliance_review",
        "cover_designer",
      ]) {
        const r = runSkill(skill, { topic: context.title }, context);
        runs.push(r);
        Object.assign(context, r.output.patch);
        Object.assign(patch, r.output.patch);
      }
      return { patch, runs };
    }
    if (get) return p;
    if (method === "DELETE") {
      if (state.tasks.some((t: any) => t.post_id === pid))
        throw new Error("该稿件已有发布记录");
      state.posts = state.posts.filter((p: any) => p.id !== pid);
      return null;
    }
    if (p.revision !== data.revision) throw new Error("版本已变化，请刷新");
    const { revision, reason, ...patch } = data;
    Object.assign(p, patch);
    p.revision++;
    p.updated_at = now();
    version(p, reason || "原型自动保存");
    return p;
  }
  if (table === "compliance-rules") {
    if (get) return state.rules;
    if (pid) {
      Object.assign(find("rules", pid), data);
      state.checks = [];
      return find("rules", pid);
    }
    const r = { ...data, id: id(), maintained_at: now() };
    state.rules.push(r);
    state.checks = [];
    return r;
  }
  if (table === "compliance-findings") {
    for (const c of state.checks) {
      const f = c.findings.find((f: any) => f.id === pid);
      if (f) {
        if (data.reason.trim().length < 4) throw new Error("理由至少四个字");
        f.decision = { reason: data.reason };
        return f.decision;
      }
    }
    throw new Error("检查结果已过期");
  }
  if (table === "ideas") {
    if (get) return state.ideas;
    const idea = { ...data, id: id(), created_at: now() };
    state.ideas.unshift(idea);
    return idea;
  }
  if (table === "templates") return state.templates;
  if (table === "assets") {
    if (get) return state.assets;
    const file = (options.body as FormData).get("file") as File;
    if (
      !file ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error("离线原型图片限 PNG/JPEG/WebP、2 MB");
    const a = {
      id: id(),
      name: file.name,
      width: 0,
      height: 0,
      mime: file.type,
    };
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    window.__REDNOTE_ASSETS__![a.id] = url;
    state.assets.push(a);
    return a;
  }
  if (table === "publish-tasks") {
    if (!pid) {
      if (get) return state.tasks.map(task);
      const p = find("posts", data.post_id);
      if (
        state.tasks.some(
          (t: any) =>
            t.post_id === p.id && !["FAILED", "CANCELLED"].includes(t.status),
        )
      )
        throw new Error("该稿件已有任务，请打开现有任务");
      const v = state.versions.find(
        (v: any) => v.post_id === p.id && v.revision === p.revision,
      );
      const t = {
        id: id(),
        post_id: p.id,
        account_id: p.account_id,
        version_id: v.id,
        status: data.scheduled_at ? "SCHEDULED_REMINDER" : "DRAFT",
        scheduled_at: data.scheduled_at,
        updated_at: now(),
        created_at: now(),
        is_demo: true,
        publication: null,
        events: [],
      };
      state.tasks.unshift(t);
      return task(t);
    }
    const t = find("tasks", pid);
    if (action === "preflight") return preflight(t);
    if (get) return task(t);
    const old = t.status;
    if (action === "refresh") {
      const p = find("posts", t.post_id);
      const v = state.versions.find(
        (v: any) => v.post_id === p.id && v.revision === p.revision,
      );
      t.version_id = v.id;
      t.account_id = p.account_id;
      t.status = "DRAFT";
    }
    if (action === "prepare") {
      if (!data.final_confirmed || preflight(t).some((c) => !c.ok))
        throw new Error("请先完成预检项目");
      t.status = "READY";
    }
    if (action === "transition") {
      if (data.status === "PUBLISHING_ASSISTED" && t.status !== "READY")
        throw new Error("请先预检");
      t.status = data.status;
    }
    if (action === "confirm") {
      if (t.status !== "PUBLISHING_ASSISTED" || !data.user_confirmed)
        throw new Error("请先开始人工发布并确认");
      if (
        !/^https:\/\/(www\.)?xiaohongshu\.com\/(explore|discovery\/item)\/[a-f0-9]{24}/i.test(
          data.url,
        ) &&
        !/^https:\/\/xhslink\.com\/[a-z0-9/]+/i.test(data.url)
      )
        throw new Error("请输入笔记 HTTPS 链接");
      t.status = "PUBLISHED_CONFIRMED";
      t.publication = {
        id: id(),
        task_id: t.id,
        post_id: t.post_id,
        url: data.url,
        is_demo: true,
        evidence: "离线原型模拟确认，未实际发布",
        title: task(t).snapshot.title,
        created_at: now(),
      };
      state.publications.unshift(t.publication);
    }
    t.updated_at = now();
    t.events.push({
      created_at: now(),
      from_status: old,
      to_status: t.status,
      detail: "交互原型中的本地模拟操作",
    });
    return task(t);
  }
  if (table === "publications")
    return state.publications.map((p: any) => ({
      ...p,
      title: p.title || find("posts", p.post_id).title,
    }));
  if (table === "post-metrics") {
    if (get) return state.metrics;
    for (const row of data.rows)
      state.metrics.push({
        ...row,
        id: id(),
        is_demo: true,
        created_at: now(),
      });
    return { imported: data.rows.length };
  }
  if (table === "analytics") {
    const latest = new Map();
    state.metrics.forEach((m: any) => latest.set(m.post_id, m));
    return {
      published: state.publications.length,
      drafts: state.posts.length,
      latest_metrics: Object.fromEntries(
        ["views", "likes", "comments", "saves", "followers"].map((k) => [
          k,
          [...latest.values()].reduce((s, m) => s + m[k], 0),
        ]),
      ),
    };
  }
  throw new Error("此离线原型暂不支持该操作");
}
window.fetch = async (input, options = {}) => {
  const path = String(input).replace(/^.*\/api\/v1/, "");
  try {
    const data =
      typeof options.body === "string" ? JSON.parse(options.body) : {};
    const result = await handle(path, options.method || "GET", data, options);
    if (options.method && options.method !== "GET") persist();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        message: (e as Error).message,
        code: "PROTOTYPE_ERROR",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }
};
