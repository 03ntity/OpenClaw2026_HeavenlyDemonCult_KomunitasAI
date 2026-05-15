import { describe, expect, it, spyOn, beforeAll, afterAll } from "bun:test";
import plugin from "../plugin";
import { logger } from "@elizaos/core";
import dotenv from "dotenv";

dotenv.config();

beforeAll(() => {
  spyOn(logger, "info");
  spyOn(logger, "error");
  spyOn(logger, "warn");
});

afterAll(() => {});

describe("Provider", () => {
  it("should have providers defined", () => {
    expect(plugin.providers).toBeDefined();
    expect(Array.isArray(plugin.providers)).toBe(true);
    expect(plugin.providers!.length).toBeGreaterThan(0);
  });

  it("should have KOMUNITAS_FINANCE_CONTEXT provider", () => {
    const provider = plugin.providers?.find(
      (p) => p.name === "KOMUNITAS_FINANCE_CONTEXT",
    );
    expect(provider).toBeDefined();
    expect(typeof provider?.get).toBe("function");
    expect(typeof provider?.description).toBe("string");
  });

  it("provider should have required structure", () => {
    plugin.providers?.forEach((provider) => {
      expect(provider).toHaveProperty("name");
      expect(provider).toHaveProperty("get");
      expect(typeof provider.name).toBe("string");
      expect(typeof provider.get).toBe("function");
    });
  });

  it("provider get should return ProviderResult shape when DB empty", async () => {
    const provider = plugin.providers?.find(
      (p) => p.name === "KOMUNITAS_FINANCE_CONTEXT",
    );
    if (!provider) return;

    const mockService = {
      listCommunities: async () => [],
      isDokuConfigured: () => false,
    };

    const mockRuntime = {
      getService: () => mockService,
    } as any;

    const result = await provider.get(mockRuntime, {} as any, {} as any);
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("values");
    expect((result.values as any).onboardingRequired).toBe(true);
  });
});
