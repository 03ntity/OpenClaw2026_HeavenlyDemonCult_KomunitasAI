import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import plugin from "../plugin";
import { logger } from "@elizaos/core";
import dotenv from "dotenv";

dotenv.config();

describe("Plugin Configuration Schema", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    spyOn(logger, "info");
    spyOn(logger, "error");
    spyOn(logger, "warn");
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should accept valid DOKU config", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({
        DOKU_CLIENT_ID: "BRN-0217-TEST",
        DOKU_MCP_API_KEY: "doku_key_sandbox_test",
        DOKU_BASE_URL: "https://api-sandbox.doku.com",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeNull();
  });

  it("should accept empty configuration", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({});
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeNull();
  });

  it("should accept config with extra properties", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({
        DOKU_CLIENT_ID: "BRN-TEST",
        EXTRA_PROPERTY: "ignored",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeNull();
  });

  it("should set DOKU_BASE_URL env from config", async () => {
    delete process.env.DOKU_BASE_URL;
    await plugin.init?.({
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });
    expect(process.env.DOKU_BASE_URL).toBe("https://api-sandbox.doku.com");
  });

  it("should set DOKU_CLIENT_ID env from config", async () => {
    delete process.env.DOKU_CLIENT_ID;
    await plugin.init?.({
      DOKU_CLIENT_ID: "BRN-TEST-123",
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });
    expect(process.env.DOKU_CLIENT_ID).toBe("BRN-TEST-123");
  });

  it("should set DOKU_MCP_API_KEY env from config", async () => {
    delete process.env.DOKU_MCP_API_KEY;
    await plugin.init?.({
      DOKU_MCP_API_KEY: "doku_key_test_abc123",
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });
    expect(process.env.DOKU_MCP_API_KEY).toBe("doku_key_test_abc123");
  });

  it("should set DOKU_AUTHORIZATION env from config", async () => {
    delete process.env.DOKU_AUTHORIZATION;
    await plugin.init?.({
      DOKU_AUTHORIZATION: "Basic ZG9rdV9rZXk6",
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });
    expect(process.env.DOKU_AUTHORIZATION).toBe("Basic ZG9rdV9rZXk6");
  });

  it("should set DOKU_MCP_URL env from config", async () => {
    delete process.env.DOKU_MCP_URL;
    await plugin.init?.({
      DOKU_MCP_URL: "https://api-sandbox.doku.com/doku-mcp-server/mcp",
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });
    expect(process.env.DOKU_MCP_URL).toBe(
      "https://api-sandbox.doku.com/doku-mcp-server/mcp",
    );
  });

  it("should reject invalid DOKU_BASE_URL", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({
        DOKU_BASE_URL: "not-a-valid-url",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
  });

  it("should reject invalid DOKU_MCP_URL", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({
        DOKU_MCP_URL: "not-a-valid-url",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
  });
});
