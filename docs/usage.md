# Guardrails 使用文档

本文档面向最终用户，说明如何在 OpenClaw 中开启与配置本插件。

## 1. 工作原理

插件挂在 OpenClaw 的 `before_dispatch` hook 上：在用户消息进入 Agent 之前进行检查。命中策略时返回 `{ handled: true, text: blockMessage }`，OpenClaw 据此截断本次对话流并直接回复 `blockMessage`；未命中则放行（返回 `{ handled: false }`），消息继续送到 Agent。

## 2. 配置入口

在 OpenClaw 的 config 文件中（通常是 `~/.openclaw/config.json5` 或环境指定路径）：

```json5
{
  plugins: {
    entries: {
      "@openclaw/guardrails": {
        // …configuration…
      },
    },
  },
}
```

> 全局 connector **可选**：即使不写顶层 `connector`，也可以在 `channels.<channelId>` 下为单个 channel 单独启用。

## 3. 三种 connector

### 3.1 Blacklist（关键字黑名单）

```json5
{
  connector: "blacklist",
  blacklist: {
    blacklistFile: true,         // true=默认路径 ~/.openclaw/guardrails/keywords.txt; string=自定义路径; false=禁用
    caseSensitive: false,
    hot: false,                  // true 时文件变更自动重载
    hotDebounceMs: 300,
  },
  blockMessage: "您的请求被安全策略拦截。",
}
```

关键字文件每行一个词，`#` 开头为注释；可在词后写 `|level`（`low|medium|high|critical`）进行分级标记（仅作元信息，不影响判定）。文本会先做 NFC 归一化、全角→半角、去零宽字符、（必要时）小写，再进行 Aho-Corasick 多模匹配。

首次启用且默认路径不存在时，会从插件自带的 `assets/keywords.default.txt` 复制一份作为种子。

### 3.2 HTTP（远端审核 API）

```json5
{
  connector: "http",
  http: {
    provider: "openai-moderation",      // 或 "dknownai" / "secra" / "hidylan" / 自定义
    apiKey: "${env:OPENAI_API_KEY}",
    apiUrl: "",                         // 可选：覆盖 endpoint
    model: "omni-moderation-latest",    // 仅 openai-moderation 使用
    params: {},                         // provider 特定参数
  },
  timeoutMs: 5000,
  fallbackOnError: "pass",              // 网络故障时的回退策略
}
```

内置 provider：

| 名称                | apiKey 要求 | 备注                              |
| ------------------- | ----------- | --------------------------------- |
| `openai-moderation` | 必填        | 走 OpenAI moderation endpoint     |
| `dknownai`          | 必填        |                                   |
| `secra`             | 必填        |                                   |
| `hidylan`           | 可选        | 当前实现把 apiKey 视作可选        |

#### 注册自定义 provider

```typescript
import { registerHttpProvider } from "@openclaw/guardrails/api";

registerHttpProvider("my-provider", {
  async init(config) {
    /* 一次性初始化（auth、连接池等） */
  },
  async check(text, context, config, fallbackOnError, timeoutMs) {
    // 返回 { action: "pass" } 或 { action: "block", blockMessage?: "…" }
  },
});
```

注意：内置 provider 的名字（`openai-moderation` / `dknownai` / `secra` / `hidylan`）不可被覆盖。

### 3.3 Import（动态加载本地脚本）

```json5
{
  connector: "import",
  import: {
    script: "/absolute/path/to/my-checker.ts",   // 必须绝对路径
    args: { threshold: 0.8 },                    // 透传给 init/check
    hot: true,
    hotDebounceMs: 300,
  },
  timeoutMs: 5000,
  fallbackOnError: "block",                      // 自定义代码出错可选择更严格
}
```

脚本（`.ts` / `.js` 均可，由 `jiti` 加载）需要导出：

```typescript
export async function init(args) {
  /* 一次性初始化 */
}

export async function check(text, context, args) {
  if (/* 命中策略 */) {
    return { action: "block", blockMessage: "命中规则 X" };
  }
  return { action: "pass" };
}
```

⚠️ **安全警告**：import connector 加载的是**受信任的本地代码**。生产环境务必校验脚本路径来源。插件启动时会输出 `import connector executes TRUSTED LOCAL CODE` 警告，且非绝对路径会拒绝加载。

## 4. 通用字段

| 字段              | 默认值 | 说明                                       |
| ----------------- | ------ | ------------------------------------------ |
| `timeoutMs`       | 5000   | 单次检查超时（500–30000）                  |
| `fallbackOnError` | `pass` | 出错回退：`pass` 放行 \| `block` 拦截     |
| `blockMessage`    | `This request has been blocked by the guardrails policy.` | 拦截时回复给用户的话术 |

## 5. 按 channel 覆写

```json5
{
  "@openclaw/guardrails": {
    connector: "blacklist",            // 全局默认
    blacklist: { blacklistFile: true },

    channels: {
      "discord:@announcements": {
        connector: "http",             // 该 channel 切换到 HTTP
        http: { provider: "openai-moderation", apiKey: "${env:OPENAI_KEY}" },
        blockMessage: "公告频道仅接受合规内容。",
      },
      "telegram:@vip": {
        // 即使全局已设置，也可通过设置 connector 来独立启用 / 关闭
        connector: "import",
        import: { script: "/srv/checkers/vip.ts" },
      },
    },
  },
}
```

每个 channel 的字段是**部分覆盖**：`http` / `blacklist` / `import` 子对象会与全局对应字段做浅合并，`blockMessage` / `fallbackOnError` / `timeoutMs` 直接覆盖。

## 6. 故障排查

- 启动时插件会日志输出 `guardrails: plugin registered (...)`，描述启用了哪些 channel handler。
- 若所有 connector 都未配置，会输出 `guardrails: no effective connector configured, plugin disabled`。
- HTTP connector 初始化失败（如 apiKey 缺失）会输出 `guardrails: failed to init HTTP adapter: ...`，并按 `fallbackOnError` 决定后续放行或拦截。
- Blacklist connector 默认会在第一次启用时把内置 `keywords.default.txt` 写入用户状态目录；如不希望写入，把 `blacklistFile` 改成自定义路径或 `false`。
