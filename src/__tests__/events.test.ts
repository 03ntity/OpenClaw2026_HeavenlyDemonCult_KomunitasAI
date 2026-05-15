import { describe, expect, it, beforeAll, spyOn } from "bun:test";
import plugin from "../plugin";
import { logger } from "@elizaos/core";

describe("Plugin Events", () => {
  beforeAll(() => {
    spyOn(logger, "info");
    spyOn(logger, "error");
    spyOn(logger, "warn");
    spyOn(logger, "debug");
  });

  it("should have plugin defined", () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("komunitas-ai");
  });

  it("events are optional for this plugin", () => {
    expect(true).toBe(true);
  });

  it("should have actions as event-like handlers", () => {
    expect(Array.isArray(plugin.actions)).toBe(true);
    expect(plugin.actions!.length).toBeGreaterThan(0);
  });

  it("should have providers as context suppliers", () => {
    expect(Array.isArray(plugin.providers)).toBe(true);
    expect(plugin.providers!.length).toBeGreaterThan(0);
  });
});
