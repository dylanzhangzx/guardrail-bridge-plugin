# 插件清单与 configSchema 注解

本文档把 `openclaw.plugin.json` 中的 `configSchema` 字段说明整理成可阅读形式，便于配置时对照。规范权威定义以 `openclaw.plugin.json` 为准。

## 顶层

| 字段              | 类型                      | 默认值 | 说明                                                                                          |
| ----------------- | ------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `connector`       | `"" \| "blacklist" \| "http"` | `""`   | connector 类型。空字符串或省略 = 自动从 http/blacklist 字段推断；全局 connector 可选，channels 可独立启用 |
| `timeoutMs`       | number (500–30000)        | 5000   | 单次检查超时                                                                                  |
| `fallbackOnError` | `"pass" \| "block"`       | `pass` | 出错时的回退动作                                                                              |
| `blockMessage`    | string                    | `This request has been blocked by the guardrail-bridge policy.` | 拦截时回复用户的提示文案 |
| `http`            | object                    |        | HTTP 引擎配置，详见下                                                                          |
| `blacklist`       | object                    |        | Blacklist 关键字匹配 connector 配置，详见下                                                    |
| `channels`        | object                    |        | 按 channel ID 覆写，详见下                                                                     |

## `http`

| 字段       | 类型                    | 默认值                 | 说明                                                                                                   |
| ---------- | ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `provider` | string                  |                        | HTTP provider 名称。内置：`dknownai` / `dknownai-cn` / `secra` / `hidylan`；自定义需通过 `registerHttpProvider()` 注册 |
| `apiKey`   | string                  |                        | Provider API key。`dknownai` / `dknownai-cn` / `secra` 必填；`hidylan` 当前可选                  |
| `apiUrl`   | string                  |                        | Endpoint URL。可选，覆盖内置 provider 的默认 URL。`dknownai` 默认 `https://open.dknownai.com/v1/guard`，`dknownai-cn` 默认 `https://open.dknowc.cn/v1/guard` |
| `model`    | string                  |                        | 模型名。当前内置 `dknownai` / `dknownai-cn` / `secra` / `hidylan` 忽略                              |
| `params`   | object                  |                        | Provider 特定参数（如 `project_id`、`region`）                                                          |

## `blacklist`

| 字段             | 类型                          | 默认值 | 说明                                                                                                          |
| ---------------- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `blacklistFile`  | `true \| string \| false`     | false  | 关键字文件源。`true` = 默认路径 `~/.openclaw/guardrail-bridge/keywords.txt`；string = 自定义路径；`false` = 禁用     |
| `caseSensitive`  | boolean                       | false  | 大小写敏感匹配                                                                                                |
| `hot`            | boolean                       | false  | 文件变更自动重载                                                                                              |
| `hotDebounceMs`  | number (50–5000)              | 300    | 热重载防抖间隔                                                                                                |

## `channels.<channelId>`

每个 channel 可独立启用 connector，即使全局未配置；字段做**部分覆盖**：`http` / `blacklist` 与全局浅合并；`blockMessage` / `fallbackOnError` / `timeoutMs` 直接覆盖。

| 字段              | 类型                              | 说明                                                              |
| ----------------- | --------------------------------- | ----------------------------------------------------------------- |
| `connector`       | `"blacklist" \| "http"` | 此 channel 的 connector，可独立于全局启用                          |
| `http`            | partial of 顶层 `http` 字段        | 字段级覆写                                                        |
| `blacklist`       | partial of 顶层 `blacklist` 字段   | 字段级覆写                                                        |
| `blockMessage`    | string                            | 覆盖全局 `blockMessage`                                           |
| `fallbackOnError` | `"pass" \| "block"`               | 覆盖全局 `fallbackOnError`                                        |
| `timeoutMs`       | number (500–30000)                | 覆盖全局 `timeoutMs`                                              |

## activation

| 字段        | 默认值 | 说明                              |
| ----------- | ------ | --------------------------------- |
| `onStartup` | true   | 在 OpenClaw 启动时立即激活并注册 `before_dispatch` hook |

> 该插件需要在 gateway 启动时运行 `register()`，否则不会注册 `before_dispatch` hook，也不会初始化 blacklist / HTTP connector。
