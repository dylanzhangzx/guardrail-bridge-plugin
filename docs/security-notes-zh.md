# Security 注记

## 名称澄清

OpenClaw 安全文档（`docs/gateway/security/index.md` 等）中频繁出现 "guardrails" 一词，**绝大多数指代通用安全控制概念**（exec approvals、prompt 内容控制、tool 策略等），并非本插件。本插件名称恰好与该术语撞车，但语义不同：

- 通用 "guardrails"：sandboxing、approvals、allowlists、prompt sanitization 等“操作员意图防护”。
- 本插件 `guardrail-bridge`：**入站消息内容检查**，挂在 `before_dispatch` hook 上做关键字 / 远端审核拦截。

二者解决不同层面问题，互补而非替代。

## 本插件的安全考虑

### HTTP connector

- 所有 provider 都通过 SDK 的 `fetchWithSsrFGuard` 发起请求，自动应用 OpenClaw host 的 SSRF 策略（私网拦截、host allowlist 等）。
- `apiKey` 可通过 OpenClaw 的 `${VAR_NAME}` 机制注入，避免明文写入配置文件。
- `timeoutMs` 默认 5s，上限 30s；超时按 `fallbackOnError` 处理。

### Blacklist connector

- 默认状态目录写入：第一次启用且 `blacklistFile: true` 时，会把内置 `assets/keywords.default.txt` 拷贝到 `~/.openclaw/guardrail-bridge/keywords.txt`。如不希望产生该副作用，把 `blacklistFile` 设为 `false` 或自定义路径。
- 关键字文件本身没有访问控制——确保运行 OpenClaw 的用户对该路径有读写权限即可。
- 文本归一化（NFC、全角→半角、去零宽字符、可选小写）已包含常见绕过手段防护，但**不是反对抗设计**：高对抗场景应叠加 HTTP 层。

### Fallback 策略

- 默认 `fallbackOnError: "pass"`：网络抖动 / API 故障时优先保证可用性。
- 高合规场景应改为 `block`，并配合更可靠的 HTTP provider 或 channel 维度的差异化策略。

## 安全边界

本插件只负责入站消息内容检查，不替代 OpenClaw host 自身的 sandbox、审批、SSRF 防护、secret 管理和工具调用策略。
