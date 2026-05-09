# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Standalone external plugin for OpenClaw — `guardrail-bridge`. Hooks the OpenClaw host's `before_dispatch` event to inspect inbound user messages and optionally block them based on two connector strategies.

## Common commands

```bash
npm install
npm test                       # all vitest suites
npm test -- src/normalize.test.ts   # one test file
npm test -- -t "blacklist hot reload"  # filter by name
npm run typecheck              # tsc --noEmit
npm run build                  # emit runtime JS to dist/
npm pack                       # build and create local install tarball
```

Published/local archive installs ship compiled runtime output under `dist/`. `openclaw.extensions` keeps the TypeScript source entry and `openclaw.runtimeExtensions` points OpenClaw at `./dist/index.js` for packaged runtime loading.

## Architecture

### Loading & lifecycle

- `index.ts` exports `default plugin = { id, name, description, register(api) }`. `api: OpenClawPluginApi` is host-injected.
- `register()` reads `api.pluginConfig`, computes one `EffectiveChannelConfig` per channel + a global one (via `src/config.ts:resolveChannelConfig`), creates the connector backends, and binds a single `api.on("before_dispatch", ...)` hook that dispatches per-channel.
- Connector instances are **deduplicated** by hashed config key, so two channels using identical settings share the same backend (and hot-reload watcher).
- Cleanup goes through `api.registerService({ stop })` calling collected disposables.

### Two connector types

All connectors converge on a single `BackendFn = (text, context) => Promise<GuardrailsDecision>` (see `src/config.ts`). The host-facing handler in `src/handler.ts` maps `{ action: "pass" }` → `{ handled: false }` and `{ action: "block" }` → `{ handled: true, text: blockMessage }`.

- **Blacklist** (`src/builtin-blacklist-connector.ts`): Aho-Corasick (`@monyone/aho-corasick`) over a keyword file. Default path is `<openclaw-state-dir>/guardrail-bridge/keywords.txt`, seeded from `assets/keywords.default.txt` on first use. Optional `fs.watch`-based hot reload with debounce. Text passes through `src/normalize.ts` first (NFC, fullwidth→halfwidth, zero-width strip, optional lowercase).
- **HTTP** (`src/http-connector.ts` + `src/providers/`): provider registry pattern. Built-ins (`dknownai`, `dknownai-cn`, `secra`, `hidylan`) cannot be overridden; custom adapters register via `registerHttpProvider()` (re-exported from `api.ts`). All HTTP calls go through `fetchWithSsrFGuard` from the SDK so SSRF policy and timeouts are enforced by the host. Adapters implement `GuardrailsProviderAdapter` (`src/provider-types.ts`).

### SDK contact surface (only 3 subpaths)

This plugin imports from the OpenClaw plugin SDK in exactly three places:

| Subpath                            | Symbol               | Used in                                      |
| ---------------------------------- | -------------------- | -------------------------------------------- |
| `openclaw/plugin-sdk/core`         | `OpenClawPluginApi`  | `index.ts`                                   |
| `openclaw/plugin-sdk/state-paths`  | `resolveStateDir`    | `src/builtin-blacklist-connector.ts`         |
| `openclaw/plugin-sdk/ssrf-runtime` | `fetchWithSsrFGuard` | `src/providers/*.ts`                         |

These are bare specifiers. At runtime, the OpenClaw host (the `openclaw` npm package) provides them via its subpath `exports`. For local typecheck, this repo declares `openclaw` in `peerDependencies` (runtime) and `devDependencies` (so `npm install` pulls real types into `node_modules/openclaw/dist/plugin-sdk/*.d.ts`). No local SDK stub is maintained — when the SDK signature changes, update the call sites and rerun `npm run typecheck`. See `docs/plugin-sdk/sdk-migration.md` for documented deprecation/migration paths.

`src/handler.ts` deliberately defines its own `BeforeDispatchEvent` / `BeforeDispatchContext` / `BeforeDispatchResult` types to avoid coupling to non-public SDK paths — preserve this pattern.

### Configuration model

`src/config.ts` is the single source for config types and `resolveConfig` / `resolveChannelConfig`. Per-channel overrides do **partial merge** for object fields (`http`, `blacklist`) and **direct overwrite** for scalars (`blockMessage`, `fallbackOnError`, `timeoutMs`). The auto-detection rule when `connector` is empty: pick whichever of http/blacklist looks configured. Channels can independently enable a connector even when the global one is empty.

The runtime `configSchema` lives in `openclaw.plugin.json` — keep that schema and the TypeScript types in `src/config.ts` in sync.

### Tests

Each `src/*.ts` has a co-located `*.test.ts`. The top-level `index.test.ts` is the integration suite for the plugin entry. Tests mock SDK subpaths with `vi.mock("openclaw/plugin-sdk/...", ...)` — see `src/builtin-blacklist-connector.test.ts` for the pattern.

## Important conventions

- ESM with NodeNext resolution. `.ts` source uses `.js` import suffixes (`from "./config.js"`) — the standard for TypeScript ESM emitted as Node ESM. Don't rewrite to `.ts` extensions.
- The plugin entry in `index.ts` is the legacy plain-object shape. Preserve it unless explicitly migrating the entry API.
- Built-in HTTP provider names (`dknownai`, `dknownai-cn`, `secra`, `hidylan`) are reserved — `registerHttpProvider` rejects collisions.
- `package.json` declares `openclaw.compat` and `openclaw.build`; SDK is **not** a runtime dependency.

## Operational guardrails

Hard rules for working in this repository.

### Never bypass signing or hooks without explicit user request

Never add `--no-verify`, `--no-gpg-sign`, `-c commit.gpgsign=false`, `-c core.hooksPath=/dev/null`, or any equivalent bypass flag to a git command unless the user has explicitly asked for that bypass in the current turn.

If a commit fails on a hook or signing check, investigate the root cause and tell the user what's blocking — don't paper over it.

