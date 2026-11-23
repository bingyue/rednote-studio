import { assetUrl } from "./api";
import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import { Button } from "./components/ui/button";
import { type CoverConfig, type Asset } from "./types";
import { useUI } from "./api";
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      if (ctx.measureText(line + char).width > max && line) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
export async function drawCover(canvas: HTMLCanvasElement, c: CoverConfig) {
  canvas.width = c.width;
  canvas.height = c.height;
  const x = canvas.getContext("2d")!;
  const w = c.width,
    h = c.height,
    p = w * 0.085;
  x.fillStyle = c.background;
  x.fillRect(0, 0, w, h);
  if (c.background_asset_id) {
    const img = new Image();
    img.src = assetUrl(c.background_asset_id);
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("背景图片加载失败"));
    });
    const scale = Math.max(w / img.width, h / img.height);
    x.drawImage(
      img,
      (w - img.width * scale) * c.crop_x,
      (h - img.height * scale) * c.crop_y,
      img.width * scale,
      img.height * scale,
    );
    x.fillStyle = c.background + "cc";
    x.fillRect(0, 0, w, h);
  }
  x.fillStyle = c.foreground;
  x.textBaseline = "top";
  x.font = `500 ${w * 0.024}px sans-serif`;
  x.fillText("THE LITTLE THINGS / 日常创作", p, p);
  x.strokeStyle = c.foreground + "40";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(p, p + w * 0.07);
  x.lineTo(w - p, p + w * 0.07);
  x.stroke();
  if (c.template === "editorial") {
    x.fillStyle = c.accent;
    x.beginPath();
    x.arc(w * 0.84, h * 0.69, w * 0.19, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = c.foreground + "22";
    x.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.arc(w * 0.84, h * 0.69, w * (0.2 + i * 0.018), 0, Math.PI * 2);
      x.stroke();
    }
  } else if (c.template === "memo") {
    x.fillStyle = "#ffffff99";
    x.fillRect(p * 0.7, h * 0.23, w - p * 1.4, h * 0.55);
    x.fillStyle = c.accent + "77";
    x.save();
    x.translate(w * 0.47, h * 0.23);
    x.rotate(-0.08);
    x.fillRect(-w * 0.13, -w * 0.03, w * 0.26, w * 0.06);
    x.restore();
  } else {
    x.fillStyle = c.accent;
    x.fillRect(p, h * 0.24, w * 0.1, w * 0.015);
  }
  x.fillStyle = c.foreground;
  x.font = `${c.font === "serif" ? 600 : 700} ${c.font_size}px ${c.font === "serif" ? '"Songti SC", "Noto Serif CJK SC", serif' : '"PingFang SC", sans-serif'}`;
  const lines = wrap(x, c.title, w - p * 2);
  let y = h * 0.3;
  for (const line of lines) {
    x.fillText(line, p, y);
    y += c.font_size * 1.32;
  }
  x.font = `400 ${w * 0.031}px sans-serif`;
  const sub = wrap(x, c.subtitle, w - p * 2);
  let sy = Math.max(y + w * 0.08, h * 0.76);
  for (const line of sub) {
    x.fillText(line, p, sy);
    sy += w * 0.047;
  }
  x.fillStyle = c.foreground;
  x.font = `500 ${w * 0.024}px sans-serif`;
  x.fillText("好内容，从一件小事开始", p, h - p - w * 0.03);
  x.textAlign = "right";
  x.fillText("STUDIO / 01", w - p, h - p - w * 0.03);
  return sy > h - p - w * 0.08;
}
export function Cover({
  config,
  onChange,
  assets = [],
  compact = false,
}: {
  config: CoverConfig;
  onChange?: (c: CoverConfig) => void;
  assets?: Asset[];
  compact?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const off = document.createElement("canvas");
    drawCover(off, config)
      .then((o) => {
        if (live && ref.current) {
          ref.current.width = off.width;
          ref.current.height = off.height;
          ref.current.getContext("2d")!.drawImage(off, 0, 0);
          setOverflow(o);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [config]);
  const update = (patch: Partial<CoverConfig>) =>
    onChange?.({ ...config, ...patch });
  const exportPNG = () => {
    if (error || overflow) {
      useUI.getState().notify(error || "请缩小字号或减少文字，确保安全区域");
      return;
    }
    ref.current?.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "rednote-cover.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    });
  };
  return (
    <div className={"cover-workbench " + (compact ? "compact" : "")}>
      <div className="cover-preview">
        <canvas ref={ref} aria-label="封面预览" />
        {(error || overflow) && (
          <div className="warning">
            {error || "文字超出安全区，请调整字号或文案"}
          </div>
        )}
      </div>
      {onChange && (
        <div className="cover-controls">
          <div className="eyebrow">COVER STUDIO</div>
          <h3>让第一眼，有记忆点</h3>
          <div className="template-picker">
            {(["editorial", "minimal", "memo"] as const).map((t, i) => (
              <button
                key={t}
                className={config.template === t ? "selected" : ""}
                onClick={() => update({ template: t })}
              >
                {["编辑手记", "极简留白", "灵感便签"][i]}
              </button>
            ))}
          </div>
          <label>
            封面主标题
            <textarea
              value={config.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={80}
              rows={3}
            />
          </label>
          <label>
            副标题
            <input
              value={config.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
              maxLength={160}
            />
          </label>
          <div className="form-row">
            <label>
              底色
              <input
                type="color"
                value={config.background}
                onChange={(e) => update({ background: e.target.value })}
              />
            </label>
            <label>
              文字
              <input
                type="color"
                value={config.foreground}
                onChange={(e) => update({ foreground: e.target.value })}
              />
            </label>
            <label>
              点缀
              <input
                type="color"
                value={config.accent}
                onChange={(e) => update({ accent: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              字体
              <select
                value={config.font}
                onChange={(e) =>
                  update({ font: e.target.value as CoverConfig["font"] })
                }
              >
                <option value="serif">宋体 · 编辑感</option>
                <option value="sans-serif">黑体 · 简洁</option>
              </select>
            </label>
            <label>
              尺寸
              <select
                value={`${config.width}:${config.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split(":").map(Number);
                  update({ width, height });
                }}
              >
                <option value="1080:1440">3:4 竖版</option>
                <option value="1080:1080">1:1 方形</option>
                <option value="1080:1920">9:16 长图</option>
              </select>
            </label>
          </div>
          <label>
            字号 · {config.font_size}
            <input
              type="range"
              min={40}
              max={140}
              value={config.font_size}
              onChange={(e) => update({ font_size: +e.target.value })}
            />
          </label>
          <label>
            背景图片
            <select
              value={config.background_asset_id || ""}
              onChange={(e) =>
                update({ background_asset_id: e.target.value || null })
              }
            >
              <option value="">纯色背景</option>
              {assets.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {config.background_asset_id && (
            <>
              <label>
                水平裁切
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.crop_x}
                  onChange={(e) => update({ crop_x: +e.target.value })}
                />
              </label>
              <label>
                垂直裁切
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.crop_y}
                  onChange={(e) => update({ crop_y: +e.target.value })}
                />
              </label>
            </>
          )}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={exportPNG}
        disabled={!!error || overflow}
      >
        <Download size={14} />
        导出 PNG
      </Button>
      <span className="muted tiny">
        <ImageIcon size={12} /> {config.width} × {config.height} · 本地渲染
      </span>
    </div>
  );
}
