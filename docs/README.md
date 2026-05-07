# 文档索引

## 使用文档

- [`usage.md`](./usage.md) — Guardrails 插件的中文使用指南：connector 选择、配置示例、按 channel 覆写、故障排查
- [`manifest-schema.md`](./manifest-schema.md) — `openclaw.plugin.json` 中 `configSchema` 的字段说明对照表
- [`security-notes.md`](./security-notes.md) — 安全考量：import connector 的可信代码执行、HTTP SSRF 策略、blacklist 文件副作用

## 插件 SDK 开发参考

来自 OpenClaw 主仓库 `docs/plugins/`，归档于 [`plugin-sdk/`](./plugin-sdk/)：

- [`plugin-sdk/building-plugins.md`](./plugin-sdk/building-plugins.md) — 外部插件开发入门，含 `package.json` / `openclaw.plugin.json` 模板、`definePluginEntry` 入口规范、ClawHub 发布流程
- [`plugin-sdk/sdk-migration.md`](./plugin-sdk/sdk-migration.md) — 插件 SDK 迁移指南：旧 compat barrel → 现代 focused subpath，runtime config 写入规范，弃用清单与时间线
- [`plugin-sdk/sdk-testing.md`](./plugin-sdk/sdk-testing.md) — 测试工具与模式：`createTestPluginApi`、契约测试、vitest 配置

## 与本仓库的关系

`plugin-sdk/` 下的文档是 OpenClaw 主仓的副本快照（@2026.4.26），不会自动同步。当 host 升级 SDK 时，请：

1. 重新从 OpenClaw 主仓 `docs/plugins/` 拉取最新版替换；
2. 升级 `package.json` 中的 `peerDependencies.openclaw` / `devDependencies.openclaw` 版本到目标 host 版本，重跑 `npm install` 即可拉到新 SDK 类型；如果接口签名变化导致类型错误，按 `sdk-migration.md` 调整调用点。
