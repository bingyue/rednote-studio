import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, LoaderCircle, ArrowUpRight, AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";
import { useUI } from "./api";
import type { Patch, Post } from "./types";
export function AsyncButton({
  action,
  children,
  variant = "default",
  disabled = false,
  ...props
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...props}
      variant={variant}
      disabled={disabled || busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await action();
        } catch (e) {
          useUI.getState().notify((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle size={15} className="spin" /> : null}
      {children}
    </Button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input,textarea,select,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={20} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">✳</div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {children}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="red-dot">.</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function DiffModal({
  patch,
  post,
  onApply,
  onClose,
}: {
  patch: Patch;
  post: Post;
  onApply: (p: Patch) => Promise<unknown>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(patch);
  return (
    <Modal title="先看一看，再应用到稿件" onClose={onClose} wide>
      <p className="muted">
        原稿已保留在版本历史。你可以编辑建议，再决定是否采用。
      </p>
      <div className="diff-grid">
        {Object.entries(value).map(([k, v]) => (
          <div className="diff-pair" key={k}>
            <div className="diff-before">
              <span>原稿 · {k}</span>
              <pre>
                {typeof (post as any)[k] === "object"
                  ? JSON.stringify((post as any)[k], null, 2)
                  : (post as any)[k]}
              </pre>
            </div>
            <div className="diff-after">
              <span>建议 · {k}</span>
              {typeof v === "string" ? (
                <textarea
                  aria-label={"修改建议 " + k}
                  value={v}
                  rows={k === "body" ? 12 : 3}
                  onChange={(e) => setValue({ ...value, [k]: e.target.value })}
                />
              ) : (
                <pre>{JSON.stringify(v, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={onClose}>
          保留原稿
        </Button>
        <AsyncButton
          action={async () => {
            await onApply(value);
            onClose();
          }}
        >
          确认应用 <ArrowUpRight size={15} />
        </AsyncButton>
      </div>
    </Modal>
  );
}
