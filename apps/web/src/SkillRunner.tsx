import { useState } from "react";
import { Sparkles, ArrowUpRight, RotateCcw, CheckCheck } from "lucide-react";
import { Button } from "./components/ui/button";
import { api, send, useData, when } from "./api";
import { AsyncButton, DiffModal, ErrorBox } from "./ui";
import type { Account, Patch, Post, Skill, SkillRun } from "./types";
export function SkillRunner({
  skill,
  post,
  account,
  onApply,
  beforeRun,
}: {
  skill: Skill;
  post?: Post;
  account?: Account;
  onApply?: (p: Patch) => Promise<unknown>;
  beforeRun?: () => Promise<unknown>;
}) {
  const [topic, setTopic] = useState(post?.title || "");
  const [reference, setReference] = useState("");
  const [sample, setSample] = useState(
    account?.style_samples[0]?.content || "",
  );
  const [own, setOwn] = useState(false);
  const [standalone, setStandalone] = useState(!post);
  const [goal, setGoal] = useState("分享具体、可实践的经验");
  const [points, setPoints] = useState("");
  const [run, setRun] = useState<SkillRun | null>(null);
  const [preview, setPreview] = useState<Patch | null>(null);
  const [error, setError] = useState("");
  const history = useData<SkillRun[]>("/skill-runs");
  const execute = async () => {
    setError("");
    await beforeRun?.();
    const input: Record<string, unknown> = { topic, goal, points };
    if (skill.id === "viral_deconstruction") input.reference = reference;
    if (skill.id === "style_rewriter") {
      input.own_sample = sample;
      input.own_work = own;
    }
    if (skill.id === "seo_optimizer")
      input.keywords = points.split(/[，,\s]+/).filter(Boolean);
    if (account) {
      input.audience = account.audience;
      input.style = account.tone;
    }
    const result = await send(`/skills/${skill.id}/run`, {
      post_id: standalone ? null : post?.id,
      input,
    });
    setRun(result);
    history.refetch();
    if (result.status === "FAILED") setError(result.error);
  };
  return (
    <div className="skill-runner">
      <div className="inline-meta">
        <span className="badge">PROMPT v{skill.version}</span>
        <span className="muted">{skill.category}</span>
      </div>
      <p>{skill.description}</p>
      <label>
        主题 / 本次创作目标
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例如：周一不慌张的工作仪式"
        />
      </label>
      <label>
        目标
        <input value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <label>
        {skill.id === "seo_optimizer"
          ? "领域关键词（逗号分隔）"
          : "要点 / 补充说明"}
        <textarea
          rows={2}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="写下具体场景与想传递的信息"
        />
      </label>
      {skill.id === "viral_deconstruction" && (
        <label>
          参考笔记（请确认有使用权）
          <textarea
            rows={5}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      )}
      {skill.id === "style_rewriter" && (
        <>
          <label>
            自己的风格样本
            <textarea
              rows={4}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={own}
              onChange={(e) => setOwn(e.target.checked)}
            />
            这是我拥有使用权的历史内容
          </label>
        </>
      )}
      {post && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={!standalone}
            onChange={(e) => setStandalone(!e.target.checked)}
          />
          读取当前稿件与账号风格
        </label>
      )}
      <AsyncButton action={execute}>
        <Sparkles size={16} />
        {run ? "重新运行" : "运行 Skill"}
      </AsyncButton>
      {error && <ErrorBox message={error} />}
      {run?.status === "SUCCEEDED" && run.output && (
        <div className="skill-result">
          <div className="inline-meta">
            <span className="badge green">
              {run.provider === "mock" ? "本地 Mock" : "模型生成"}
            </span>
            <span>
              {run.duration_ms} ms ·{" "}
              {run.provider === "mock"
                ? "无模型费用"
                : "用量见运行详情，未配置价格"}
            </span>
          </div>
          <h3>{run.output.summary}</h3>
          {run.output.items.map((item, i) => (
            <article className="result-item" key={i}>
              <div className="result-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
                {item.patch && post && onApply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(item.patch!)}
                  >
                    预览并应用 <ArrowUpRight size={14} />
                  </Button>
                )}
              </div>
            </article>
          ))}
          {Object.keys(run.output.patch).length > 0 && post && onApply && (
            <Button onClick={() => setPreview(run.output!.patch)}>
              <CheckCheck size={16} />
              预览全部修改
            </Button>
          )}
          {skill.id === "compliance_review" && (
            <p className="warning">
              这里展示语境建议；请返回稿件执行绑定版本的「检查内容」。
            </p>
          )}
          <details>
            <summary>运行记录与用量</summary>
            <AsyncButton
              variant="ghost"
              action={async () => {
                const data = await api(`/skill-runs/${run.id}`);
                alert(JSON.stringify(data.usage, null, 2));
              }}
            >
              查看用量
            </AsyncButton>
            <code>{run.id}</code>
            <p>输入输出已经后端持久化，模型密钥不会传到浏览器。</p>
          </details>
        </div>
      )}
      <details className="history-list">
        <summary>
          最近运行 ·{" "}
          {history.data?.filter((h) => h.skill_id === skill.id).length || 0}
        </summary>
        {history.data
          ?.filter((h) => h.skill_id === skill.id)
          .slice(0, 8)
          .map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setRun(h);
                setError(h.error || "");
              }}
            >
              <RotateCcw size={12} />
              {when(h.created_at)} ·{" "}
              {h.status === "SUCCEEDED" ? "查看结果" : "失败记录"}
            </button>
          ))}
      </details>
      {preview && post && onApply && (
        <DiffModal
          patch={preview}
          post={post}
          onApply={onApply}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
