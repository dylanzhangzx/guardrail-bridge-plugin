# Plugin Manifest and configSchema Reference

This document describes the `configSchema` fields in `openclaw.plugin.json` in a readable format. The authoritative schema is `openclaw.plugin.json`.

## Top-level fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `connector` | `"" \| "blacklist" \| "http"` | `""` | Connector type. Empty string or omitted means auto-detect from `http` or `blacklist` fields. The global connector is optional; channels can enable connectors independently. |
| `timeoutMs` | number (500–30000) | 5000 | Single check timeout in milliseconds. |
| `fallbackOnError` | `"pass" \| "block"` | `pass` | Fallback action when a connector errors. |
| `blockMessage` | string | `This request has been blocked by the guardrail-bridge policy.` | Message returned to the user when a request is blocked. |
| `http` | object | | HTTP connector configuration. |
| `blacklist` | object | | Blacklist keyword-matching connector configuration. |
| `channels` | object | | Per-channel overrides keyed by channel ID. |

## `http`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `provider` | string | | HTTP provider name. Built-ins: `dknownai`, `dknownai-cn`, `secra`, `hidylan`. Custom providers must be registered with `registerHttpProvider()`. |
| `apiKey` | string | | Provider API key. Required by `dknownai`, `dknownai-cn`, and `secra`; currently optional for `hidylan`. |
| `apiUrl` | string | | Optional endpoint override. `dknownai` defaults to `https://open.dknownai.com/v1/guard`; `dknownai-cn` defaults to `https://open.dknowc.cn/v1/guard`. |
| `model` | string | | Model name. Current built-in providers ignore this field. |
| `params` | object | | Provider-specific parameters, such as `project_id` or `region`. |

## `blacklist`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `blacklistFile` | `true \| string \| false` | false | Keyword file source. `true` means the default path `~/.openclaw/guardrail-bridge/keywords.txt`; string means a custom path; `false` disables file loading. |
| `caseSensitive` | boolean | false | Enables case-sensitive matching. |
| `hot` | boolean | false | Automatically reload the keyword file when it changes. |
| `hotDebounceMs` | number (50–5000) | 300 | Hot-reload debounce interval in milliseconds. |

## `channels.<channelId>`

Each channel can enable a connector independently, even when no global connector is configured. Channel object fields are partial overrides: `http` and `blacklist` are shallow-merged with global objects; `blockMessage`, `fallbackOnError`, and `timeoutMs` directly replace global values.

| Field | Type | Description |
| --- | --- | --- |
| `connector` | `"blacklist" \| "http"` | Connector for this channel. |
| `http` | partial top-level `http` | Field-level HTTP overrides. |
| `blacklist` | partial top-level `blacklist` | Field-level blacklist overrides. |
| `blockMessage` | string | Overrides global `blockMessage`. |
| `fallbackOnError` | `"pass" \| "block"` | Overrides global `fallbackOnError`. |
| `timeoutMs` | number (500–30000) | Overrides global `timeoutMs`. |

## activation

| Field | Default | Description |
| --- | --- | --- |
| `onStartup` | true | Activates the plugin on OpenClaw startup and registers the `before_dispatch` hook. |

> This plugin must run `register()` when the gateway starts. Otherwise it will not register the `before_dispatch` hook or initialize blacklist / HTTP connectors.
