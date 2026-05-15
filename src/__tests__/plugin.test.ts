import { describe, expect, it, spyOn, beforeAll, afterAll } from "bun:test";
import plugin from "../plugin";
import { KomunitasService } from "../plugin";
import { logger } from "@elizaos/core";
import dotenv from "dotenv";

dotenv.config();

beforeAll(() => {
  spyOn(logger, "info");
  spyOn(logger, "error");
  spyOn(logger, "warn");
});

afterAll(() => {});

describe("Plugin Configuration", () => {
  it("should have correct plugin metadata", () => {
    expect(plugin.name).toBe("komunitas-ai");
    expect(typeof plugin.description).toBe("string");
    expect(plugin.description.length).toBeGreaterThan(0);
    expect(plugin.config).toBeDefined();
  });

  it("should include DOKU config keys", () => {
    expect(plugin.config).toHaveProperty("DOKU_CLIENT_ID");
    expect(plugin.config).toHaveProperty("DOKU_MCP_API_KEY");
    expect(plugin.config).toHaveProperty("DOKU_BASE_URL");
  });

  it("should initialize without throwing when config is valid", async () => {
    let error: Error | null = null;
    try {
      await plugin.init?.({
        DOKU_CLIENT_ID: "BRN-TEST",
        DOKU_MCP_API_KEY: "test-key",
        DOKU_BASE_URL: "https://api-sandbox.doku.com",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeNull();
  });

  it("should have services defined", () => {
    expect(plugin.services).toBeDefined();
    expect(Array.isArray(plugin.services)).toBe(true);
    expect(plugin.services!.length).toBeGreaterThan(0);
  });

  it("should have KomunitasService registered", () => {
    const hasService = plugin.services?.some(
      (s: any) => s.serviceType === "komunitas" || s === KomunitasService,
    );
    expect(hasService).toBe(true);
  });

  it("should have actions, providers, and routes", () => {
    expect(Array.isArray(plugin.actions)).toBe(true);
    expect(plugin.actions!.length).toBeGreaterThan(0);
    expect(Array.isArray(plugin.providers)).toBe(true);
    expect(plugin.providers!.length).toBeGreaterThan(0);
    expect(Array.isArray(plugin.routes)).toBe(true);
    expect(plugin.routes!.length).toBeGreaterThan(0);
  });
});

describe("KomunitasService", () => {
  it("should have correct serviceType", () => {
    expect(KomunitasService.serviceType).toBe("komunitas");
  });

  it("should have static start method", () => {
    expect(typeof KomunitasService.start).toBe("function");
  });

  it("should have static stop method", () => {
    expect(typeof KomunitasService.stop).toBe("function");
  });

  it("should instantiate without runtime", () => {
    const service = new KomunitasService();
    expect(service).toBeDefined();
    expect(typeof service.isDokuConfigured).toBe("function");
    expect(typeof service.listCommunities).toBe("function");
    expect(typeof service.getCommunity).toBe("function");
    expect(typeof service.bulkCreateInvoices).toBe("function");
    expect(typeof service.generateMonthlyReport).toBe("function");
  });

  it("isDokuConfigured should return boolean", () => {
    const service = new KomunitasService();
    expect(typeof service.isDokuConfigured()).toBe("boolean");
  });
});
