# 参与贡献

欢迎改进 RedNote Studio。先阅读 README 和 docs/12-known-limitations.md，确认当前实现范围。

## 问题反馈

请通过仓库 Issues 提供操作系统、Python / Node 版本、运行模式、复现步骤、预期与实际结果。日志和截图请删除密钥、登录材料与个人信息。Mock 与真实模型问题请分开描述。

## 提交修改

1. Fork 仓库并创建分支。
2. 按 README 安装依赖，用演示数据开发。
3. 运行与修改相关的检查；行为变化补充对应测试。
4. 提交 Pull Request，说明问题、改动和验证结果。

```bash
make check
make test-backend
make test-frontend
make build
# 涉及完整界面流程时
make test-e2e
```

不要提交 `.env`、`runtime/`、真实账号 Profile、客户资料或依赖目录。新增 Skill 请遵循 docs/05-skills-and-prompts.md 中的结构化契约，保持 Mock 与真实模型模式可区分，保留人工预览步骤。

贡献的代码按本项目 MIT 许可证分发。引入第三方素材或代码时请注明来源和许可证。
