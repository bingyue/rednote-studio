const el = (id) => document.getElementById(id);
let draft = null;
function validate(value) {
  if (
    !value ||
    value.format !== "rednote-studio/1" ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    value.title.length > 1000 ||
    value.body.length > 100000 ||
    !Array.isArray(value.tags) ||
    value.tags.length > 30 ||
    value.tags.some((x) => typeof x !== "string" || x.length > 100) ||
    typeof value.account_name !== "string"
  )
    throw new Error("资料格式无效，请从工作台重新导出");
  return {
    format: value.format,
    title: value.title,
    body: value.body,
    tags: value.tags,
    account_name: value.account_name.slice(0, 100),
    task_id: String(value.task_id || "").slice(0, 100),
  };
}
function render() {
  el("content").hidden = !draft;
  if (!draft) return;
  el("title").textContent = draft.title;
  el("body").textContent = draft.body;
  el("account").textContent = "请核对目标账号：" + draft.account_name;
}
const status = (text) => (el("status").textContent = text);
async function safe(fn) {
  try {
    await fn();
  } catch (e) {
    status(e.message);
  }
}
el("file").onchange = (e) =>
  safe(async () => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200000) throw new Error("文件不能超过 200 KB");
    draft = validate(JSON.parse(await file.text()));
    await chrome.storage.local.set({ draft });
    render();
    status("已导入。尚未向任何平台发送内容。");
  });
const full = () =>
  draft.body + "\n\n" + draft.tags.map((t) => "#" + t).join(" ");
el("copy-title").onclick = () =>
  safe(async () => {
    await navigator.clipboard.writeText(draft.title);
    status("标题已复制");
  });
el("copy-body").onclick = () =>
  safe(async () => {
    await navigator.clipboard.writeText(full());
    status("正文已复制");
  });
el("open").onclick = () =>
  chrome.tabs.create({
    url: "https://creator.xiaohongshu.com/publish/publish",
  });
el("download").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([draft.title + "\n\n" + full()], {
      type: "text/plain;charset=utf-8",
    }),
  );
  a.download = "rednote-note.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status("文案已导出");
};
el("clear").onclick = () =>
  safe(async () => {
    await chrome.storage.local.remove("draft");
    draft = null;
    render();
    status("本地稿件已清除");
  });
safe(async () => {
  const result = await chrome.storage.local.get("draft");
  if (result.draft) {
    draft = validate(result.draft);
    render();
    status("已恢复你主动导入的资料");
  }
});
