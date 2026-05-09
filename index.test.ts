import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./src/http-connector.js", () => {
  return {
    resolveHttpAdapter: vi.fn().mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    }),
  };
});

import plugin from "./index.js";
import { resolveHttpAdapter } from "./src/http-connector.js";

function makeApi(pluginConfig: Record<string, unknown> = {}) {
  return {
    pluginConfig,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    on: vi.fn(),
    registerService: vi.fn(),
  } as any;
}

describe("index.ts plugin registration", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function writeKeywordsFile(content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "guardrail-bridge-test-"));
    tempDirs.push(dir);
    const file = path.join(dir, "keywords.txt");
    writeFileSync(file, content);
    return file;
  }

  it("registers nothing when no connector configured globally or per-channel", () => {
    const api = makeApi({});
    plugin.register(api);
    expect(api.on).not.toHaveBeenCalled();
    expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("no effective connector"));
  });

  it("registers blacklist connector when connector explicitly set", () => {
    const api = makeApi({
      connector: "blacklist",
      blacklist: { blacklistFile: false },
    });
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
  });

  it("explicit connector field overrides auto-detection", () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    });
    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-xxx" },
      blacklist: { blacklistFile: true },
    });
    plugin.register(api);
    expect(api.on).toHaveBeenCalledTimes(1);
  });

  it("auto-detects HTTP when http.provider provided", () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    });
    const api = makeApi({ http: { provider: "dknownai", apiKey: "dk-xxx" } });
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
  });

  it("http adapter async init failure → backendFn returns fallback", async () => {
    vi.mocked(resolveHttpAdapter).mockRejectedValue(new Error("adapter init error"));

    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-test" },
      fallbackOnError: "block",
      blockMessage: "Adapter unavailable",
    });
    plugin.register(api);

    await vi.waitFor(() => {
      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed to init HTTP adapter"),
      );
    });

    const handler = api.on.mock.calls[0][1];
    const result = await handler({ content: "text", channel: "test" }, { channelId: "test" });
    expect(result.handled).toBe(true);
    expect(result.text).toBe("Adapter unavailable");
  });

  it("uses channel-level blacklist overrides at runtime", async () => {
    const globalFile = writeKeywordsFile("global-only");
    const channelFile = writeKeywordsFile("channel-only");

    const api = makeApi({
      connector: "blacklist",
      blacklist: { blacklistFile: globalFile, caseSensitive: true },
      blockMessage: "Global block",
      channels: {
        discord: {
          blacklist: { blacklistFile: channelFile },
          blockMessage: "Discord block",
        },
      },
    });
    plugin.register(api);

    const handler = api.on.mock.calls[0][1];

    const discordResult = await handler(
      { content: "channel-only", channel: "discord" },
      { channelId: "discord" },
    );
    expect(discordResult.handled).toBe(true);
    expect(discordResult.text).toBe("Discord block");

    const globalResult = await handler(
      { content: "channel-only", channel: "telegram" },
      { channelId: "telegram" },
    );
    expect(globalResult.handled).toBe(false);
  });
});

describe("index.ts — channel-only enable", () => {
  it("registers plugin when only a channel has a connector (no global)", async () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "block" }),
    });

    const api = makeApi({
      blockMessage: "Default block",
      channels: {
        webchat: {
          connector: "http",
          http: { provider: "dknownai", apiKey: "dk-xxx" },
        },
      },
    });
    plugin.register(api);

    expect(api.on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));

    const handler = api.on.mock.calls[0][1];

    // webchat channel → http → block
    const webchatResult = await handler(
      { content: "hello", channel: "webchat" },
      { channelId: "webchat" },
    );
    expect(webchatResult.handled).toBe(true);

    // unknown channel → no default → passthrough
    const unknownResult = await handler(
      { content: "hello", channel: "telegram" },
      { channelId: "telegram" },
    );
    expect(unknownResult.handled).toBe(false);
  });

  it("multiple channels with different connectors, no global", async () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "block" }),
    });

    const api = makeApi({
      blockMessage: "Blocked",
      blacklist: { blacklistFile: false },
      channels: {
        webchat: {
          connector: "http",
          http: { provider: "dknownai", apiKey: "dk-xxx" },
        },
        discord: {
          connector: "blacklist",
        },
      },
    });
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
  });
});

describe("index.ts channel routing", () => {
  it("routes different channels to different handlers", async () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-xxx" },
      blacklist: { blacklistFile: false },
      channels: {
        webchat: {
          connector: "blacklist",
        },
      },
    });
    plugin.register(api);

    expect(api.on).toHaveBeenCalledWith("before_dispatch", expect.any(Function));
    expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("1 channel handler"));
  });

  it("channel-level blockMessage overrides global", async () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "block" }),
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-test" },
      blockMessage: "Global block",
      channels: {
        slack: { blockMessage: "Slack block" },
      },
    });
    plugin.register(api);

    const handler = api.on.mock.calls[0][1];

    // Slack channel should use channel-level blockMessage
    const slackResult = await handler(
      { content: "hello", channel: "slack" },
      { channelId: "slack" },
    );
    expect(slackResult.text).toBe("Slack block");

    // Unknown channel should use global blockMessage
    const unknownResult = await handler(
      { content: "hello", channel: "unknown" },
      { channelId: "unknown" },
    );
    expect(unknownResult.text).toBe("Global block");
  });

  it("unknown channel falls back to global handler", async () => {
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-test" },
      channels: {
        discord: { blockMessage: "Discord only" },
      },
    });
    plugin.register(api);

    const handler = api.on.mock.calls[0][1];
    const result = await handler(
      { content: "hello", channel: "telegram" },
      { channelId: "telegram" },
    );
    expect(result.handled).toBe(false); // pass from global
  });

  it("supports different HTTP providers per channel", async () => {
    const secraCheck = vi.fn().mockResolvedValue({ action: "pass" });
    const dknownaiCheck = vi.fn().mockResolvedValue({ action: "block" });

    vi.mocked(resolveHttpAdapter).mockImplementation(async (config: any) => {
      if (config.provider === "secra") {
        return { check: secraCheck };
      }
      if (config.provider === "dknownai") {
        return { check: dknownaiCheck };
      }
      return null;
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "secra", apiKey: "se-test" },
      blockMessage: "Blocked",
      channels: {
        discord: {
          http: { provider: "dknownai", apiKey: "dk-test" },
        },
      },
    });
    plugin.register(api);

    const handler = api.on.mock.calls[0][1];

    // Default channel (secra) → pass
    const defaultResult = await handler(
      { content: "hello", channel: "telegram" },
      { channelId: "telegram" },
    );
    expect(defaultResult.handled).toBe(false);
    expect(secraCheck).toHaveBeenCalled();

    // Discord channel (dknownai) → block
    const discordResult = await handler(
      { content: "hello", channel: "discord" },
      { channelId: "discord" },
    );
    expect(discordResult.handled).toBe(true);
    expect(discordResult.text).toBe("Blocked");
    expect(dknownaiCheck).toHaveBeenCalled();
  });

  it("passes per-channel HttpConfig to adapter.check()", async () => {
    let capturedConfig: any;
    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockImplementation((_text: string, _ctx: any, config: any) => {
        capturedConfig = config;
        return Promise.resolve({ action: "pass" });
      }),
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "dknownai", apiKey: "dk-global" },
      channels: {
        slack: {
          http: { apiKey: "sk-slack-override" },
        },
      },
    });
    plugin.register(api);

    const handler = api.on.mock.calls[0][1];
    await handler({ content: "hi", channel: "slack" }, { channelId: "slack" });
    expect(capturedConfig.apiKey).toBe("sk-slack-override");
  });

  it("registered provider: adapter init separates same provider with different config", async () => {
    vi.mocked(resolveHttpAdapter).mockClear();

    const checkFn = vi.fn().mockResolvedValue({ action: "pass" });

    vi.mocked(resolveHttpAdapter).mockImplementation(async () => {
      return { check: checkFn };
    });

    const api = makeApi({
      connector: "http",
      http: { provider: "my-safety", apiKey: "ms-A" },
      channels: {
        discord: {
          http: { apiKey: "ms-B" },
        },
      },
    });
    plugin.register(api);

    expect(resolveHttpAdapter).toHaveBeenCalledTimes(2);

    const handler = api.on.mock.calls[0][1];

    await handler({ content: "a", channel: "telegram" }, { channelId: "telegram" });
    await handler({ content: "b", channel: "discord" }, { channelId: "discord" });
    expect(checkFn).toHaveBeenCalledTimes(2);
  });

  it("registered provider: adapter init reuses same config with reordered params", async () => {
    vi.mocked(resolveHttpAdapter).mockClear();

    vi.mocked(resolveHttpAdapter).mockResolvedValue({
      check: vi.fn().mockResolvedValue({ action: "pass" }),
    });

    const api = makeApi({
      connector: "http",
      http: {
        provider: "my-safety",
        apiKey: "ms-A",
        params: { outer: { b: 2, a: 1 } },
      },
      channels: {
        discord: {
          http: {
            params: { outer: { a: 1, b: 2 } },
          },
        },
      },
    });
    plugin.register(api);

    expect(resolveHttpAdapter).toHaveBeenCalledTimes(1);
  });

  it("registered provider: concurrent handlers share one pending adapter init", async () => {
    vi.mocked(resolveHttpAdapter).mockClear();

    const checkFn = vi.fn().mockResolvedValue({ action: "pass" });
    let resolveAdapter!: (adapter: { check: typeof checkFn }) => void;
    vi.mocked(resolveHttpAdapter).mockReturnValue(
      new Promise((resolve) => {
        resolveAdapter = resolve;
      }),
    );

    const api = makeApi({
      connector: "http",
      http: { provider: "my-safety", apiKey: "ms-A" },
      channels: {
        discord: {
          http: { provider: "my-safety", apiKey: "ms-A" },
        },
      },
    });
    plugin.register(api);

    expect(resolveHttpAdapter).toHaveBeenCalledTimes(1);

    const handler = api.on.mock.calls[0][1];
    const globalPromise = handler({ content: "a", channel: "telegram" }, { channelId: "telegram" });
    const discordPromise = handler({ content: "b", channel: "discord" }, { channelId: "discord" });

    resolveAdapter({ check: checkFn });

    await Promise.all([globalPromise, discordPromise]);
    expect(checkFn).toHaveBeenCalledTimes(2);
  });
});
