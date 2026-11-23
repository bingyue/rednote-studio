import { QueryClient, useQuery } from "@tanstack/react-query";
import { create } from "zustand";
export const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: false },
  },
});
export const useUI = create<{
  account: string;
  setAccount: (id: string) => void;
  post: string;
  setPost: (id: string) => void;
  toast: string;
  notify: (message: string) => void;
  token: string;
  setToken: (token: string) => void;
}>((set) => ({
  account: "",
  setAccount: (account) => set({ account }),
  post: "",
  setPost: (post) => set({ post }),
  toast: "",
  notify: (toast) => {
    set({ toast });
    setTimeout(() => set({ toast: "" }), 4500);
  },
  token: "",
  setToken: (token) => set({ token }),
}));
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useUI.getState().token;
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: "服务暂时不可用" }));
    throw new Error(
      `${e.message}${e.request_id ? " · " + e.request_id.slice(0, 8) : ""}`,
    );
  }
  return r.status === 204 ? undefined : r.json();
}
export function useData<T = any>(path: string) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api<T>(path) });
}
export function refresh() {
  return client.invalidateQueries();
}
export const send = (path: string, data: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });
export function download(
  name: string,
  data: Blob | string,
  type = "text/plain;charset=utf-8",
) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  useUI.getState().notify("已复制到剪贴板");
}
export const length = (text: string) => Array.from(text).length;
export const replaceSpan = (
  text: string,
  start: number,
  end: number,
  replacement: string,
) => {
  const parts = Array.from(text);
  return (
    parts.slice(0, start).join("") + replacement + parts.slice(end).join("")
  );
};
export const when = (date: string) =>
  new Date(date).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

declare global {
  interface Window {
    __REDNOTE_PROTOTYPE__?: boolean;
    __REDNOTE_ASSETS__?: Record<string, string>;
  }
}
export const assetUrl = (id: string) =>
  window.__REDNOTE_ASSETS__?.[id] || "/api/v1/assets/" + id + "/file";
