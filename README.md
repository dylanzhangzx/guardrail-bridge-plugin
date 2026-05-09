# Guardrail Bridge Plugin

Pre-agent security plugin for OpenClaw. Detects manipulation attempts and blocks policy-violating content before Agent dispatch.

## Compatibility

- **Supported OpenClaw versions**: `>=2026.4.26`
- **Supported Plugin API**: `>=2026.4.26`

The packaged runtime is built against OpenClaw `2026.4.26`, and the compatibility metadata is declared in both `peerDependencies.openclaw` and `openclaw.compat.pluginApi`.

## Distribution Paths

- **ClawHub / OpenClaw install target**: `clawhub:guardrail-bridge`
- **npm package**: `@guardrail-bridge/guardrail-bridge`

Published archives include the runtime bundle, plugin manifest, assets, and end-user documentation only.

## What It Does

This plugin runs before user messages are dispatched to the Agent and can block requests based on two safety strategies:

- **Blacklist**: Local keyword matching using Aho-Corasick multi-pattern search over a configurable keyword file.
- **HTTP**: Remote moderation API with built-in providers: `dknownai`, `dknownai-cn`, `secra`, `hidylan`.

Each channel can choose its own connector and override connector options. A global connector is optional.

## HTTP Providers

### DKnownAI

Detects prompt injection, jailbreak, and agent hijacking attempts for deployments that need remote security review.

- **Provider names**: `dknownai` (international), `dknownai-cn` (China)
- **API key required**: Yes
- **Website**: [dknownai.com](https://dknownai.com/)

### Secra

Remote content moderation provider for adding extra message safety review.

- **Provider name**: `secra`
- **API key required**: Yes
- **Website**: [secra.ai](https://secra.ai/)

### Hidylan

Remote prompt-injection checking provider for identifying unsafe instructions and policy-bypass attempts.

- **Provider name**: `hidylan`
- **API key required**: Optional
- **Website**: [hidylan.ai](https://hidylan.ai/)

## Configuration

### Quick Start: Blacklist

Enable the plugin in the OpenClaw config:

```json5
{
  plugins: {
    entries: {
      "guardrail-bridge": {
        enabled: true,
        config: {
          connector: "blacklist",
          blacklist: {
            blacklistFile: true,
            caseSensitive: false,
            hot: true,
          },
          blockMessage: "This request has been blocked by the guardrail policy.",
          fallbackOnError: "pass",
        },
      },
    },
  },
}
```

### HTTP Provider Example: DKnownAI

```json5
{
  plugins: {
    entries: {
      "guardrail-bridge": {
        enabled: true,
        config: {
          connector: "http",
          http: {
            provider: "dknownai",
            apiKey: "${DKNOWNAI_API_KEY}",
          },
          fallbackOnError: "block",
        },
      },
    },
  },
}
```

### HTTP Provider Example: Secra

```json5
{
  plugins: {
    entries: {
      "guardrail-bridge": {
        enabled: true,
        config: {
          connector: "http",
          http: {
            provider: "secra",
            apiKey: "${SECRA_API_KEY}",
          },
          fallbackOnError: "block",
        },
      },
    },
  }
}
```

### HTTP Provider Example: Hidylan

```json5
{
  plugins: {
    entries: {
      "guardrail-bridge": {
        enabled: true,
        config: {
          connector: "http",
          http: {
            provider: "hidylan",
            apiKey: "${HIDYLAN_API_KEY}",
          },
          fallbackOnError: "block",
        },
      },
    },
  }
}
```

### Configuring API Keys

There are three ways to provide API keys:

Use provider-specific environment variable names so users can tell connectors apart, for example `DKNOWNAI_API_KEY`, `SECRA_API_KEY`, or `HIDYLAN_API_KEY`.

1. **Environment variable** (recommended):

   ```json5
   "apiKey": "${DKNOWNAI_API_KEY}"
   ```

   Set the environment variable before starting OpenClaw:
   ```bash
   export DKNOWNAI_API_KEY=sk-...
   ```

2. **Plain text** (not recommended for production):

   ```json5
   "apiKey": "sk-..."
   ```

3. **Per-channel override**:

   ```json5
   {
     "guardrail-bridge": {
       config: {
         channels: {
           "discord:@announcements": {
             connector: "http",
             http: {
               provider: "dknownai",
               apiKey: "${DKNOWNAI_API_KEY}",
             },
             blockMessage: "Only compliant content is allowed.",
           },
         },
       },
     },
   }
   ```

### Common Fields

| Field | Default | Description |
| --- | --- | --- |
| `connector` | `""` | Connector type: `"blacklist"` or `"http"`. Empty auto-detects from config. |
| `timeoutMs` | 5000 | Single check timeout in milliseconds (500–30000). |
| `fallbackOnError` | `"pass"` | Fallback action when a connector fails: `"pass"` or `"block"`. |
| `blockMessage` | `This request has been blocked by the guardrail-bridge policy.` | Message returned to the user when a request is blocked. |

### Blacklist Configuration

| Field | Default | Description |
| --- | --- | --- |
| `blacklistFile` | `false` | Keyword file source. `true` = `~/.openclaw/guardrail-bridge/keywords.txt`; string = custom path; `false` = disabled. |
| `caseSensitive` | `false` | Enables case-sensitive matching. |
| `hot` | `false` | Automatically reload the keyword file when it changes. |
| `hotDebounceMs` | 300 | Hot-reload debounce interval in milliseconds. |

### HTTP Configuration

| Field | Required | Description |
| --- | --- | --- |
| `provider` | Yes | Provider name: `dknownai`, `dknownai-cn`, `secra`, or `hidylan`. |
| `apiKey` | Yes (except `hidylan`) | Provider API key. Can use environment variable substitution. |
| `apiUrl` | No | Optional endpoint override. |
| `model` | No | Model name. Current built-in providers ignore this field. |
| `params` | No | Provider-specific parameters (e.g., `project_id`, `region`). |

## Installation

You can install the plugin through either ClawHub or npm. The install identifiers are different.

### Install from ClawHub

```bash
openclaw plugins install clawhub:guardrail-bridge
```

### Install from npm

```bash
openclaw plugins install npm:@guardrail-bridge/guardrail-bridge
```

Restart the OpenClaw gateway after installing or changing plugin configuration.


## Documentation

- English: [`docs/usage.md`](./docs/usage.md), [`docs/manifest-schema.md`](./docs/manifest-schema.md), [`docs/security-notes.md`](./docs/security-notes.md)
- 中文: [`README-zh.md`](./README-zh.md), [`docs/usage-zh.md`](./docs/usage-zh.md), [`docs/manifest-schema-zh.md`](./docs/manifest-schema-zh.md), [`docs/security-notes-zh.md`](./docs/security-notes-zh.md)

## License

MIT
