# External Plugin Spec Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `/Users/zhang/Documents/python/guardrails/` with the upstream `extensions/guardrails/` external-plugin template (2026.4.29 version) and the `plugin-package-contract` source-of-truth, removing local SDK type stubs in favor of installing the published `openclaw` npm package.

**Architecture:** Three coupled changes — (1) `package.json` rewrite to match upstream's external-plugin shape (rename, peer/dev deps, `openclaw.{install,bundle,release}`, drop deprecated compat sub-fields), (2) replace the hand-written `types/openclaw-plugin-sdk.d.ts` stub + `tsconfig.paths` shim with a real `npm install openclaw` (`tokenjuice` CHANGELOG note discourages local compatibility shims), (3) sync user-facing docs (`README.md`, `CLAUDE.md`, `docs/README.md`) so they no longer reference the deleted stub.

**Tech Stack:** Node.js + TypeScript ESM (NodeNext) + vitest. The plugin runs inside an OpenClaw host that resolves `openclaw/plugin-sdk/*` via the `openclaw` npm package's subpath `exports`.

---

## File Structure

| File | Responsibility | Operation |
|------|---------------|-----------|
| `package.json` | Plugin metadata + npm dependencies + `openclaw.*` plugin manifest extensions | Rewrite |
| `tsconfig.json` | TypeScript config; remove local stub `paths` mapping; let NodeNext resolve `openclaw/plugin-sdk/*` from `node_modules/openclaw` | Modify |
| `types/openclaw-plugin-sdk.d.ts` | Hand-written SDK type stub | Delete |
| `types/` (directory) | Empty after stub deletion | Remove (rmdir) |
| `README.md` | Project overview; remove stub references | Modify |
| `CLAUDE.md` | Future Claude Code guidance; update SDK contact surface section | Modify |
| `docs/README.md` | Doc index; remove stub-sync instruction | Modify |
| `package-lock.json` | npm lockfile | Created by `npm install` |
| `node_modules/` | Installed dependencies | Created by `npm install` |

---

## Task 1: Rewrite package.json

**Files:**
- Modify: `/Users/zhang/Documents/python/guardrails/package.json`

**Reference:** This shape mirrors `/Users/zhang/Documents/python/openclaw-guardrails/extensions/guardrails/package.json` (the upstream double-form template), adapted for a third-party publication: name scope changed to `@dknownai/`, removed `devDependencies."@openclaw/plugin-sdk": "workspace:*"` (workspace-only), and added the standalone `devDependencies` (typescript/vitest/@types/node) needed when this repo is built outside the monorepo.

- [ ] **Step 1: Read current package.json to confirm starting point**

Run:
```bash
cat /Users/zhang/Documents/python/guardrails/package.json
```

Expected: shows current name `@openclaw/guardrails`, no `peerDependencies`, no `openclaw.install/bundle/release`, has `compat.minGatewayVersion` and `build.pluginSdkVersion`.

- [ ] **Step 2: Overwrite package.json with the aligned content**

Write `/Users/zhang/Documents/python/guardrails/package.json` with this exact content:

```json
{
  "name": "@dknownai/openclaw-guardrails",
  "version": "2026.4.26",
  "private": false,
  "description": "Pre-agent guardrails plugin for OpenClaw — blacklist, HTTP moderation, and import connectors.",
  "type": "module",
  "license": "MIT",
  "files": [
    "index.ts",
    "api.ts",
    "openclaw.plugin.json",
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "assets/"
  ],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "openclaw": ">=2026.4.26"
  },
  "dependencies": {
    "@monyone/aho-corasick": "^1.1.8",
    "jiti": "^2.6.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "openclaw": "^2026.4.26",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "openclaw": {
    "extensions": [
      "./index.ts"
    ],
    "install": {
      "npmSpec": "@dknownai/openclaw-guardrails",
      "defaultChoice": "npm",
      "minHostVersion": ">=2026.4.26"
    },
    "compat": {
      "pluginApi": ">=2026.4.26"
    },
    "build": {
      "openclawVersion": "2026.4.26"
    },
    "bundle": {
      "stageRuntimeDependencies": true
    },
    "release": {
      "publishToClawHub": true,
      "publishToNpm": true
    }
  }
}
```

Key differences from current:
- `name`: `@openclaw/guardrails` → `@dknownai/openclaw-guardrails`
- `private: false` added (required to publish)
- `peerDependencies.openclaw: ">=2026.4.26"` added
- `devDependencies.openclaw: "^2026.4.26"` added
- `compat.minGatewayVersion` removed (replaced by `install.minHostVersion`)
- `build.pluginSdkVersion` removed
- `openclaw.install.{npmSpec, defaultChoice, minHostVersion}` added
- `openclaw.bundle.stageRuntimeDependencies: true` added
- `openclaw.release.{publishToClawHub: true, publishToNpm: true}` added
- `files` array no longer needs to ship `types/` (stub will be deleted)

Note: `openclaw.install.localPath` is intentionally omitted — that field is meaningful only for monorepo bundled plugins where it points at the in-repo source dir; for a standalone external repo, the package itself is the source.

- [ ] **Step 3: Verify the rewrite**

Run:
```bash
node -e 'const p=require("/Users/zhang/Documents/python/guardrails/package.json"); console.log(JSON.stringify({name:p.name, peer:p.peerDependencies, dev:Object.keys(p.devDependencies||{}), openclawKeys:Object.keys(p.openclaw||{})}, null, 2))'
```

Expected output:
```json
{
  "name": "@dknownai/openclaw-guardrails",
  "peer": {
    "openclaw": ">=2026.4.26"
  },
  "dev": [
    "@types/node",
    "openclaw",
    "typescript",
    "vitest"
  ],
  "openclawKeys": [
    "extensions",
    "install",
    "compat",
    "build",
    "bundle",
    "release"
  ]
}
```

---

## Task 2: Remove local SDK type stub and tsconfig paths shim

**Files:**
- Delete: `/Users/zhang/Documents/python/guardrails/types/openclaw-plugin-sdk.d.ts`
- Remove (empty dir): `/Users/zhang/Documents/python/guardrails/types/`
- Modify: `/Users/zhang/Documents/python/guardrails/tsconfig.json`

**Why:** With `openclaw` installed as devDependency, NodeNext module resolution finds `openclaw/plugin-sdk/*` via the package's subpath `exports`. The stub + `paths` mapping become both redundant and (per `tokenjuice` CHANGELOG entry, 2026.4.29) discouraged.

- [ ] **Step 1: Delete the stub file**

Run:
```bash
rm /Users/zhang/Documents/python/guardrails/types/openclaw-plugin-sdk.d.ts && rmdir /Users/zhang/Documents/python/guardrails/types
```

Expected: silent success. Verify with `ls /Users/zhang/Documents/python/guardrails/types 2>&1` returning `No such file or directory`.

- [ ] **Step 2: Rewrite tsconfig.json**

Write `/Users/zhang/Documents/python/guardrails/tsconfig.json` with this exact content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["index.ts", "api.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Key differences:
- Removed `typeRoots` (the custom `./types` entry no longer exists)
- Removed `paths` block entirely
- Removed `allowImportingTsExtensions` (defaulted to false anyway)
- Removed `types/**/*.d.ts` from `include`

- [ ] **Step 3: Verify tsconfig has no stub references**

Run:
```bash
grep -E "paths|types/openclaw|typeRoots" /Users/zhang/Documents/python/guardrails/tsconfig.json
```

Expected: no matches (empty output).

---

## Task 3: Update user-facing docs to drop stub references

**Files:**
- Modify: `/Users/zhang/Documents/python/guardrails/README.md` (lines 57, 73)
- Modify: `/Users/zhang/Documents/python/guardrails/CLAUDE.md` (line 48)
- Modify: `/Users/zhang/Documents/python/guardrails/docs/README.md` (line 22)

- [ ] **Step 1: Patch README.md project-structure block**

In `/Users/zhang/Documents/python/guardrails/README.md`, locate this block (around line 47–60):

```markdown
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
├── types/openclaw-plugin-sdk.d.ts  # 本地 SDK 类型存根
└── docs/                           # 使用文档与开发参考
```

Replace the line `├── types/openclaw-plugin-sdk.d.ts  # 本地 SDK 类型存根` with nothing (delete the line). The closing line becomes:

```markdown
├── assets/keywords.default.txt     # 默认黑名单
└── docs/                           # 使用文档与开发参考
```

- [ ] **Step 2: Patch README.md "与 OpenClaw 的关系" section**

In `/Users/zhang/Documents/python/guardrails/README.md`, locate the section (around line 71–74):

```markdown
## 与 OpenClaw 的关系

- 运行时：OpenClaw host 加载本插件时，会通过其内部模块解析向 `openclaw/plugin-sdk/*` 注入实现。本仓库 `types/openclaw-plugin-sdk.d.ts` 仅提供本地 TypeScript 类型存根，无运行时副作用。
- 兼容性：本插件依赖 SDK 中的 `core`、`state-paths`、`ssrf-runtime` 三个 subpath。当 host 升级 SDK 时，参考 [`docs/plugin-sdk/sdk-migration.md`](./docs/plugin-sdk/sdk-migration.md) 同步类型存根。
```

Replace with:

```markdown
## 与 OpenClaw 的关系

- 运行时：本插件被 OpenClaw host 加载，`openclaw/plugin-sdk/*` 通过 `openclaw` npm 包的 subpath `exports` 解析。
- 类型：`openclaw` 在 `peerDependencies` 中声明运行依赖，并通过 `devDependencies` 在本仓库本地拉取真实 SDK 类型；不维护本地存根。
- 兼容性：本插件使用 SDK 的 `core`、`state-paths`、`ssrf-runtime` 三个 subpath。host 升级时如出现签名漂移，参考 [`docs/plugin-sdk/sdk-migration.md`](./docs/plugin-sdk/sdk-migration.md) 调整代码即可。
```

- [ ] **Step 3: Patch CLAUDE.md "SDK contact surface" paragraph**

In `/Users/zhang/Documents/python/guardrails/CLAUDE.md`, locate (around line 47–50):

```markdown
These are bare specifiers resolved by the host at runtime. `types/openclaw-plugin-sdk.d.ts` is a hand-written stub providing **only** the shapes used here — for local typecheck, not runtime. When upgrading against a newer SDK, sync this file (see `docs/plugin-sdk/sdk-migration.md`).
```

Replace with:

```markdown
These are bare specifiers. At runtime, the OpenClaw host (the `openclaw` npm package) provides them via its subpath `exports`. For local typecheck, this repo declares `openclaw` in `peerDependencies` (runtime) and `devDependencies` (so `npm install` pulls real types into `node_modules/openclaw/dist/plugin-sdk/*.d.ts`). No local SDK stub is maintained — when the SDK signature changes, update the call sites and rerun `npm run typecheck`. See `docs/plugin-sdk/sdk-migration.md` for documented deprecation/migration paths.
```

- [ ] **Step 4: Patch docs/README.md "与本仓库的关系" section**

In `/Users/zhang/Documents/python/guardrails/docs/README.md`, locate (around line 18–23):

```markdown
## 与本仓库的关系

`plugin-sdk/` 下的文档是 OpenClaw 主仓的副本快照（@2026.4.26），不会自动同步。当 host 升级 SDK 时，请：

1. 重新从 OpenClaw 主仓 `docs/plugins/` 拉取最新版替换；
2. 若 SDK 接口签名有变，同步更新 [`/types/openclaw-plugin-sdk.d.ts`](../types/openclaw-plugin-sdk.d.ts) 中的类型存根。
```

Replace with:

```markdown
## 与本仓库的关系

`plugin-sdk/` 下的文档是 OpenClaw 主仓的副本快照（@2026.4.26），不会自动同步。当 host 升级 SDK 时，请：

1. 重新从 OpenClaw 主仓 `docs/plugins/` 拉取最新版替换；
2. 升级 `package.json` 中的 `peerDependencies.openclaw` / `devDependencies.openclaw` 版本到目标 host 版本，重跑 `npm install` 即可拉到新 SDK 类型；如果接口签名变化导致类型错误，按 `sdk-migration.md` 调整调用点。
```

- [ ] **Step 5: Verify all stub references are gone**

Run:
```bash
grep -rn "openclaw-plugin-sdk.d.ts\|types/openclaw" /Users/zhang/Documents/python/guardrails/ --include='*.md' --include='*.json' --include='*.ts' 2>/dev/null
```

Expected: no matches (empty output).

---

## Task 4: Install dependencies via npm

**Files:**
- Created: `/Users/zhang/Documents/python/guardrails/package-lock.json`
- Created: `/Users/zhang/Documents/python/guardrails/node_modules/`

- [ ] **Step 1: Run npm install in plugin root**

Run:
```bash
cd /Users/zhang/Documents/python/guardrails && npm install 2>&1 | tail -30
```

Expected: installs `openclaw`, `@monyone/aho-corasick`, `jiti`, `typescript`, `vitest`, `@types/node`. Final lines should show `added N packages` with no `ERR!` lines. A peer-dep info line about `openclaw` is acceptable (since openclaw is also in devDependencies, the peer requirement is satisfied locally).

If `npm install` fails because the `openclaw` npm package is not reachable (private registry, network issue), document the error and stop — do not work around with the local stub. Tell the user; they may need to configure registry access.

- [ ] **Step 2: Verify openclaw package is actually installed**

Run:
```bash
ls /Users/zhang/Documents/python/guardrails/node_modules/openclaw/package.json && \
  node -e 'const p=require("/Users/zhang/Documents/python/guardrails/node_modules/openclaw/package.json"); console.log(p.name, p.version); console.log("has core:", !!p.exports?.["./plugin-sdk/core"]); console.log("has state-paths:", !!p.exports?.["./plugin-sdk/state-paths"]); console.log("has ssrf-runtime:", !!p.exports?.["./plugin-sdk/ssrf-runtime"])'
```

Expected:
```
/Users/zhang/Documents/python/guardrails/node_modules/openclaw/package.json
openclaw <some version >=2026.4.26>
has core: true
has state-paths: true
has ssrf-runtime: true
```

If any subpath is missing, the installed `openclaw` version doesn't expose what guardrails needs — stop and check version compatibility.

---

## Task 5: Typecheck against real SDK types

- [ ] **Step 1: Run typecheck**

Run:
```bash
cd /Users/zhang/Documents/python/guardrails && npm run typecheck 2>&1 | tail -40
```

Expected: 0 errors. Successful runs print only the `> tsc --noEmit` echo line and exit 0.

- [ ] **Step 2: If errors appear, triage**

Likely error categories and what to do:

- **Real type drift** (e.g., `OpenClawPluginApi.on()` signature changed in upstream): adjust the calling code in `index.ts` to match. Do NOT re-add a stub. Note the change for follow-up.
- **Cannot find module 'openclaw/plugin-sdk/...'**: openclaw package is missing the subpath. Check `node_modules/openclaw/package.json#exports`. May need to bump the openclaw version.
- **Implicit any from removed stub fields**: e.g., if our stub described an event payload field that the real SDK doesn't expose. Add a narrower local type beside the call site (not a full module declaration).

Apply fixes in the source file (`index.ts` is the most likely site since it's the only file importing from `openclaw/plugin-sdk/core`). Re-run typecheck until clean.

If errors are extensive enough that ad-hoc fixes won't converge, stop and report — the migration may need a separate plan.

---

## Task 6: Run tests against real SDK

- [ ] **Step 1: Run vitest**

Run:
```bash
cd /Users/zhang/Documents/python/guardrails && npm test 2>&1 | tail -30
```

Expected: all tests pass. Vitest summary should show `Test Files  N passed (N)` and `Tests  M passed (M)`.

- [ ] **Step 2: If tests fail, triage**

The mocks in `src/builtin-blacklist-connector.test.ts` and `src/http-connector.test.ts` use `vi.mock("openclaw/plugin-sdk/state-paths", ...)` and `vi.mock("openclaw/plugin-sdk/ssrf-runtime", ...)`. With the real package now resolvable, vitest still uses the mock factory (vi.mock is hoisted before resolution), so behavior should not change.

Likely failure categories:

- **Mock factory now type-checked against real types**: If a mock returns a value that doesn't match the real SDK signature, vitest may warn but tests should still run. Adjust the mock factory shape to match the real type.
- **A previously-stubbed export was named differently in reality**: tests reference `resolveStateDir` / `fetchWithSsrFGuard` — those names are confirmed in upstream source (no rename expected).

If failures occur, fix the test file (not the production code, unless the production code is also wrong against real types). Re-run.

---

## Task 7: Final review and stage for commit

- [ ] **Step 1: Inspect the working tree changes**

Run:
```bash
cd /Users/zhang/Documents/python/guardrails && git status --short && echo "---" && git diff --stat HEAD
```

Expected changes (give or take file ordering):
- modified `package.json`
- modified `tsconfig.json`
- modified `README.md`
- modified `CLAUDE.md`
- modified `docs/README.md`
- deleted `types/openclaw-plugin-sdk.d.ts`
- new `package-lock.json`
- new `docs/superpowers/plans/2026-05-07-external-plugin-spec-alignment.md`

`node_modules/` should be ignored by `.gitignore`.

- [ ] **Step 2: Confirm node_modules is gitignored**

Run:
```bash
cd /Users/zhang/Documents/python/guardrails && git check-ignore -v node_modules
```

Expected: prints `.gitignore:1:node_modules/    node_modules` (or similar) confirming the rule fires.

- [ ] **Step 3: Show the user a final diff summary and stop**

Print a short summary of:
- Files changed (count + list)
- Critical line counts (`package.json`: -X +Y, `tsconfig.json`: -X +Y, etc.)
- Whether typecheck and tests passed

**Do NOT commit.** The user's standing instruction is to never commit without explicit ask. The user can run `git commit` themselves after final review.

---

## Self-Review Checklist (run before handoff)

1. **Spec coverage:** Each of the 10 gap items from the alignment report has at least one task implementing it:
   - Gap 1 (peerDependencies.openclaw): Task 1
   - Gap 2 (devDependencies.openclaw): Task 1
   - Gap 3 (delete stub): Task 2 + verification in Task 5/6
   - Gap 4 (delete tsconfig paths): Task 2
   - Gap 5 (drop compat.minGatewayVersion): Task 1
   - Gap 6 (drop build.pluginSdkVersion): Task 1
   - Gap 7 (add openclaw.install): Task 1
   - Gap 8 (add openclaw.bundle): Task 1
   - Gap 9 (add openclaw.release): Task 1
   - Gap 10 (rename to @dknownai/openclaw-guardrails): Task 1
   - Plus doc consistency (Task 3) and validation (Tasks 4–6)

2. **No placeholders:** No "TBD", "implement later", or unspecified content. Every command shown is executable. Every replacement string is complete.

3. **Type consistency:** The plan does not introduce new type names — it only changes config and removes a stub. Source code (`index.ts`, `src/*.ts`) is unchanged unless typecheck/test surfaces a real drift; if so, the fix is local and described in Task 5 Step 2.
