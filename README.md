# @openclaw/guardrails

Pre-agent guardrails plugin for [OpenClaw](https://github.com/openclaw/openclaw)：在用户消息进入 Agent 前进行内容检查，匹配命中后阻断并返回提示。

支持三种检查器（connector）：

| Connector   | 用途                                | 关键依赖                                      |
| ----------- | ----------------------------------- | --------------------------------------------- |
| `blacklist` | 关键字黑名单（Aho-Corasick 多模匹配） | `@monyone/aho-corasick`                       |
| `http`      | 远端 HTTP 内容审核 API              | 内置 `openai-moderation` / `dknownai` / `secra` / `hidylan` |
| `import`    | 动态加载本地脚本（自定义检查器）     | `jiti`                                        |

每个 channel 可独立选择 connector 并覆写参数；全局 connector 可选。

## 快速使用

在 OpenClaw 配置中开启该插件：

```json5
{
  plugins: {
    entries: {
      "@openclaw/guardrails": {
        connector: "blacklist",
        blacklist: {
          blacklistFile: true,        // 默认路径 ~/.openclaw/guardrails/keywords.txt
          caseSensitive: false,
          hot: true,                  // 文件变更自动热重载
        },
        blockMessage: "您的请求被安全策略拦截。",
        fallbackOnError: "pass",     // 出错时放行
      },
    },
  },
}
```

完整字段说明见 [`docs/manifest-schema.md`](./docs/manifest-schema.md) 与 [`openclaw.plugin.json`](./openclaw.plugin.json) 中的 `configSchema`。

## 项目结构

```
.
├── index.ts                        # 插件入口，对接 OpenClaw before_dispatch hook
├── api.ts                          # 公开扩展 API（registerHttpProvider 等）
├── openclaw.plugin.json            # 插件清单（manifest）+ configSchema
├── src/
│   ├── config.ts                   # 配置归一化、共享类型
│   ├── handler.ts                  # before_dispatch 调度
│   ├── builtin-blacklist-connector.ts  # 黑名单 connector
│   ├── http-connector.ts           # HTTP connector + provider 注册表
│   ├── import-connector.ts         # 动态导入 connector（jiti）
│   ├── normalize.ts                # 文本归一化（NFC、零宽字符、全半角）
│   ├── provider-types.ts           # GuardrailsProviderAdapter 接口
│   └── providers/                  # 内置 HTTP provider 实现
├── assets/keywords.default.txt     # 默认黑名单
└── docs/                           # 使用文档与开发参考
```

## 开发

```bash
npm install
npm run typecheck
npm test
```

测试套件涵盖配置解析、各 connector、文本归一化、HTTP provider 与 import connector 的端到端行为。

## 与 OpenClaw 的关系

- 运行时：本插件被 OpenClaw host 加载，`openclaw/plugin-sdk/*` 通过 `openclaw` npm 包的 subpath `exports` 解析。
- 类型：`openclaw` 在 `peerDependencies` 中声明运行依赖，并通过 `devDependencies` 在本仓库本地拉取真实 SDK 类型；不维护本地存根。
- 兼容性：本插件使用 SDK 的 `core`、`state-paths`、`ssrf-runtime` 三个 subpath。host 升级时如出现签名漂移，参考 [`docs/plugin-sdk/sdk-migration.md`](./docs/plugin-sdk/sdk-migration.md) 调整代码即可。

## 许可证

MIT
