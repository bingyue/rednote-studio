import { useState, useRef, useCallback, useEffect } from "react";
import { send, client } from "./api";
import type { Post } from "./types";
const content = (p: Post) =>
  JSON.stringify([p.account_id, p.title, p.body, p.tags, p.cover, p.asset_ids]);
export function useEditor(initial: Post) {
  const [draft, setDraft] = useState(initial),
    [status, setStatus] = useState("已保存"),
    [error, setError] = useState("");
  const current = useRef(draft),
    persisted = useRef(initial),
    chain = useRef(Promise.resolve(initial));
  current.current = draft;
  const save = useCallback((reason = "自动保存") => {
    const task = chain.current
      .catch(() => persisted.current)
      .then(async () => {
        const next = current.current;
        if (content(next) === content(persisted.current))
          return persisted.current;
        setStatus("保存中");
        setError("");
        try {
          const data = await send(
            `/posts/${next.id}`,
            {
              revision: persisted.current.revision,
              account_id: next.account_id,
              title: next.title,
              body: next.body,
              tags: next.tags,
              cover: next.cover,
              asset_ids: next.asset_ids,
              reason,
            },
            "PATCH",
          );
          persisted.current = data;
          setDraft((latest) =>
            content(latest) === content(next)
              ? data
              : {
                  ...latest,
                  revision: data.revision,
                  updated_at: data.updated_at,
                },
          );
          setStatus("已保存");
          client.invalidateQueries({ queryKey: ["/posts"] });
          return data;
        } catch (e) {
          setStatus("保存失败");
          setError((e as Error).message);
          throw e;
        }
      });
    chain.current = task;
    return task;
  }, []);
  useEffect(() => {
    if (content(draft) === content(persisted.current)) return;
    setStatus("待保存");
    const timer = setTimeout(() => void save().catch(() => {}), 700);
    return () => clearTimeout(timer);
  }, [draft, save]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (content(current.current) !== content(persisted.current)) {
        e.preventDefault();
        e.returnValue = "有尚未保存的修改";
      }
    };
    window.addEventListener("beforeunload", handler);
    const navigation = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest("a[href]") &&
        content(current.current) !== content(persisted.current)
      ) {
        e.preventDefault();
        e.stopPropagation();
        void save().catch(() => {});
        setError("正在保存，请保存完成后再切换页面");
      }
    };
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", navigation, true);
      void save().catch(() => {});
    };
  }, [save]);
  const change = useCallback((patch: Partial<Post>) => {
    current.current = { ...current.current, ...patch };
    setDraft(current.current);
  }, []);
  const replace = useCallback((p: Post) => {
    persisted.current = p;
    current.current = p;
    setDraft(p);
    setStatus("已保存");
  }, []);
  return { draft, change, save, replace, status, error };
}
