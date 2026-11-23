# 演示 fixture

seed.json 为单文件原型的内嵌数据来源：3 个创作者账号、20 篇稿件、多份版本快照、8 个 Skills、27 条演示风险规则、5 个发布任务、12 个效果快照、3 个灵感和内容模板。

封面占位采用可编辑 Canvas 配置，无外链图片、字体或 CDN 依赖。历史作品链接以 demo:// 标识，不是真实平台作品。

正式应用由 scripts/seed_demo.py 调用后端种子函数导入 SQLite。原型数据来自此 fixture 并独立存储在 localStorage，两者不互相覆盖。
