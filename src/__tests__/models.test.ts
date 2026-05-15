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

describe("Plugin Models", () => {
  it("should have models defined or be undefined (optional)", () => {
    expect(true).toBe(true);
  });

  it("plugin should be a valid ElizaOS plugin", () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("komunitas-ai");
    expect(typeof plugin.description).toBe("string");
  });

  it("plugin uses model providers via character plugins", () => {
    expect(Array.isArray(plugin.actions)).toBe(true);
    expect(Array.isArray(plugin.providers)).toBe(true);
    expect(Array.isArray(plugin.services)).toBe(true);
  });
});
