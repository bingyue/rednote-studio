import { build } from "../apps/web/node_modules/esbuild/lib/main.js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const result = await build({
  entryPoints: ["apps/web/src/prototype-entry.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  minify: true,
  write: false,
  jsx: "automatic",
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = readdirSync("apps/web/dist/assets")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync("apps/web/dist/assets/" + f, "utf8"))
  .join("\n");
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
writeFileSync(
  "prototype/index.html",
  `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RedNote Studio · 交互原型 / 演示数据</title><style>${css}\n.mode-label{font-size:11px!important;color:#d57953!important;display:flex!important}.app-footer:before{content:'交互原型 / 演示数据';color:#dc8160}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);
console.log("Offline prototype:", resolve("prototype/index.html"));
