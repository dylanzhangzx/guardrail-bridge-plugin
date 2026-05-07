# Security 注记

## 名称澄清

OpenClaw 安全文档（`docs/gateway/security/index.md` 等）中频繁出现 "guardrails" 一词，**绝大多数指代通用安全控制概念**（exec approvals、prompt 内容控制、tool 策略等），并非本插件。本插件名称恰好与该术语撞车，但语义不同：

- 通用 "guardrails"：sandboxing、approvals、allowlists、prompt sanitization 等"操作员意图防护"。
- 本插件 `@openclaw/guardrails`：**入站消息内容检查**，挂在 `before_dispatch` hook 上做关键字 / 远端审核 / 自定义脚本拦截。

二者解决不同层面问题，互补而非替代。

## 本插件的安全考虑

### Import connector

`import` connector 通过 `jiti` 加载本地 `.ts` / `.js` 脚本并执行，**等价于在 OpenClaw 进程内运行受信代码**。

- 仅接受**绝对路径**；相对路径会拒绝加载并输出错误。
- 启动时输出明显警告：`guardrails: import connector executes TRUSTED LOCAL CODE — verify script path before production use`。
- 出错时按 `fallbackOnError` 决定放行还是拦截。建议在生产部署中使用 `fallbackOnError: "block"`，避免脚本崩溃导致策略静默失效。
- 不要从用户配置中拼接 script 路径——确保路径来源是部署方自身控制。

### HTTP connector

- 所有 provider 都通过 SDK 的 `fetchWithSsrFGuard` 发起请求，自动应用 OpenClaw host 的 SSRF 策略（私网拦截、host allowlist 等）。
- `apiKey` 可通过 OpenClaw 的 `${env:VAR_NAME}` / SecretRef 机制注入，避免明文写入配置文件。
- `timeoutMs` 默认 5s 上限 30s；超时按 `fallbackOnError` 处理。

### Blacklist connector

- 默认状态目录写入：第一次启用且 `blacklistFile: true` 时，会把内置 `assets/keywords.default.txt` 拷贝到 `~/.openclaw/guardrails/keywords.txt`。如不希望产生该副作用，把 `blacklistFile` 设为 `false` 或自定义路径。
- 关键字文件本身没有访问控制——确保运行 OpenClaw 的用户对该路径有读写权限即可。
- 文本归一化（NFC、全角→半角、去零宽字符、可选小写）已包含常见绕过手段防护，但**不是反对抗设计**：高对抗场景应叠加 HTTP / import 层。

### Fallback 策略

- 默认 `fallbackOnError: "pass"`：网络抖动 / API 故障时优先保证可用性。
- 高合规场景应改为 `block`，并配合冗余 connector（如 channel 维度配 import 兜底）。

## 上游参考

完整 OpenClaw 安全模型见原仓库 `docs/gateway/security/index.md`。本仓库不维护该文档的副本——它会随 OpenClaw 主版本演进。
