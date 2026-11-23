import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEditor } from "../../apps/web/src/useEditor";
import { DiffModal } from "../../apps/web/src/ui";
import { Highlight } from "../../apps/web/src/Editor";
import { defaultCover, type Post } from "../../apps/web/src/types";
import { replaceSpan } from "../../apps/web/src/api";
const initial: Post = {
  id: "test",
  account_id: "account",
  title: "原来的标题",
  body: "原来的正文",
  tags: [],
  cover: defaultCover,
  asset_ids: [],
  revision: 1,
  updated_at: new Date().toISOString(),
  is_demo: false,
};
function Harness() {
  const e = useEditor(initial);
  return (
    <>
      <input
        aria-label="title"
        value={e.draft.title}
        onChange={(x) => e.change({ title: x.target.value })}
      />
      <output>{e.status}</output>
      <button onClick={() => e.save().catch(() => {})}>save</button>
      <span>{e.error}</span>
    </>
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
});
describe("editor persistence", () => {
  it("saves edited fields with optimistic revision and displays persisted state", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, opts) => {
        const body = JSON.parse(String(opts?.body));
        return new Response(
          JSON.stringify({ ...initial, ...body, revision: 2 }),
        );
      });
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "新标题" },
    });
    await userEvent.click(screen.getByText("save"));
    await waitFor(() => expect(screen.getByText("已保存")).toBeVisible());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      revision: 1,
      title: "新标题",
    });
  });
  it("keeps unsaved input and shows version conflict rather than claiming saved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "版本冲突" }), { status: 409 }),
    );
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "需要保留的本地修改" },
    });
    await userEvent.click(screen.getByText("save"));
    await waitFor(() => expect(screen.getByText("保存失败")).toBeVisible());
    expect(screen.getByLabelText("title")).toHaveValue("需要保留的本地修改");
    expect(screen.getByText("版本冲突")).toBeVisible();
  });
});
describe("AI and risk review", () => {
  it("previews both versions, edits a suggestion and applies only on explicit acceptance", async () => {
    const apply = vi.fn().mockResolvedValue(undefined),
      close = vi.fn();
    render(
      <DiffModal
        patch={{ title: "AI 标题" }}
        post={initial}
        onApply={apply}
        onClose={close}
      />,
    );
    expect(screen.getByText(initial.title)).toBeVisible();
    expect(apply).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("修改建议 title"));
    await userEvent.type(screen.getByLabelText("修改建议 title"), "我的标题");
    await userEvent.click(screen.getByRole("button", { name: /确认应用/ }));
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith({ title: "我的标题" }),
    );
    expect(close).toHaveBeenCalled();
  });
  it("retains the original without applying when rejected", async () => {
    const apply = vi.fn(),
      close = vi.fn();
    render(
      <DiffModal
        patch={{ body: "生成内容" }}
        post={initial}
        onApply={apply}
        onClose={close}
      />,
    );
    await userEvent.click(screen.getByText("保留原稿"));
    expect(apply).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
  it("uses Unicode codepoint offsets for emoji and highlights the exact finding", () => {
    const text = "🌿保证有效";
    const f: any = {
      id: "f",
      span_start: 1,
      span_end: 5,
      explanation: "请复核",
    };
    render(<Highlight text={text} findings={[f]} />);
    expect(screen.getByText("保证有效").tagName).toBe("MARK");
    expect(replaceSpan(text, 1, 5, "需要验证")).toBe("🌿需要验证");
  });
});
