# 扩展与本地环境

Chrome MV3 扩展位于 apps/extension。权限只有 storage、clipboardWrite；无网站读取权限，无 content script。扩展 JSON 输入大小 ≤200 KB，限定固定格式和文本字段长度，使用 textContent 渲染；不执行导入材料里的脚本。

用户从发布任务导出 JSON，主动在 popup 导入；可以复制标题、复制正文与话题、下载文本、打开小红书官方创作页、清除本地资料。扩展本地存储只有稿件资料；不会读取 Cookie、密码、浏览器指纹或后台账号状态。

本地助手 `apps/profile-helper/helper.py` 仅有 create/open/status/list/delete 五个命令。引用 ID 白名单、路径解析、根目录标记、Profile 标记、符号链接拒绝、删除前浏览器锁检查；创建确认、删除双确认。用参数数组调用 Chrome，不启用 shell，不接收任意 URL 或命令。只打开固定官方创作页的可见窗口。

Web 只保存 alias/local_ref。出于本地应用尚未安装的默认条件，本版使用可复制 CLI 指令，不伪造“已连接”状态，也没有远程本地桥接服务或深链注册。实际 Chrome 登录由用户扫码或正常登录；状态仅显示未检测/人工检查。

测试：CLI 创建/状态/删除确认、路径穿越、符号链接、启动参数白名单均覆盖。扩展弹窗的导入/复制/下载/清除通过模拟 chrome API 的浏览器测试；这不能替代真实 Chrome 加载扩展和已登录页面测试。发布页 DOM 自动填充未实现，需要后续用户授权和规则验证。
