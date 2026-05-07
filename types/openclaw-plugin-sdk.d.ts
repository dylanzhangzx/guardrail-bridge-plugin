/**
 * Local type stubs for the OpenClaw plugin SDK subpaths used by this plugin.
 *
 * At runtime, OpenClaw resolves bare specifiers `openclaw/plugin-sdk/*` against
 * its host-injected SDK loader. For local TypeScript checks (without depending
 * on the host monorepo or a published SDK package), this file declares the
 * minimal shape of each used export.
 *
 * If you upgrade against a newer plugin SDK, sync the relevant signatures here.
 * Sources:
 *   - openclaw/packages/plugin-sdk/src/core.ts
 *   - openclaw/packages/plugin-sdk/src/state-paths.ts
 *   - openclaw/packages/plugin-sdk/src/ssrf-runtime.ts
 */

declare module "openclaw/plugin-sdk/core" {
  export interface PluginLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  }

  export interface PluginServiceDescriptor {
    id: string;
    start: () => void | Promise<void>;
    stop: () => void | Promise<void>;
  }

  export interface BeforeDispatchEvent {
    content?: string;
    body?: string;
    channel?: string;
    sessionKey?: string;
    senderId?: string;
    isGroup?: boolean;
    timestamp?: number;
  }

  export interface BeforeDispatchContext {
    channelId?: string;
    accountId?: string;
    conversationId?: string;
    sessionKey?: string;
    senderId?: string;
  }

  export interface BeforeDispatchResult {
    handled: boolean;
    text?: string;
  }

  export type BeforeDispatchHandler = (
    event: BeforeDispatchEvent,
    ctx: BeforeDispatchContext,
  ) => Promise<BeforeDispatchResult | void> | BeforeDispatchResult | void;

  export interface OpenClawPluginApi {
    pluginConfig: Record<string, unknown>;
    logger: PluginLogger;
    registerService(descriptor: PluginServiceDescriptor): void;
    on(event: "before_dispatch", handler: BeforeDispatchHandler): void;
    on(event: string, handler: (...args: unknown[]) => unknown): void;
  }
}

declare module "openclaw/plugin-sdk/state-paths" {
  /** Returns the absolute path of the OpenClaw runtime state directory (~/.openclaw). */
  export function resolveStateDir(): string;
}

declare module "openclaw/plugin-sdk/ssrf-runtime" {
  export interface SsrfGuardedFetchInput {
    url: string;
    init?: RequestInit;
    timeoutMs?: number;
    auditContext?: string;
  }

  export interface SsrfGuardedFetchResult {
    response: Response;
    release: () => Promise<void>;
  }

  /** SSRF-guarded fetch wrapper provided by the OpenClaw plugin runtime. */
  export function fetchWithSsrFGuard(
    input: SsrfGuardedFetchInput,
  ): Promise<SsrfGuardedFetchResult>;
}
