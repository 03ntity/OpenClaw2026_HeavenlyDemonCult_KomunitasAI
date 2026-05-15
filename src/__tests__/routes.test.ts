import { describe, expect, it, mock } from "bun:test";
import plugin from "../plugin";

describe("Plugin Routes", () => {
  it("should have routes defined", () => {
    expect(plugin.routes).toBeDefined();
    expect(Array.isArray(plugin.routes)).toBe(true);
    expect(plugin.routes!.length).toBeGreaterThan(0);
  });

  it("should have komunitas summary route", () => {
    const route = plugin.routes?.find(
      (r) => r.path === "/api/v1/komunitas/summary",
    );
    expect(route).toBeDefined();
    expect(route?.type).toBe("GET");
    expect(typeof route?.handler).toBe("function");
  });

  it("should have DOKU webhook route", () => {
    const route = plugin.routes?.find((r) => r.path === "/webhook/doku");
    expect(route).toBeDefined();
    expect(route?.type).toBe("POST");
  });

  it("should have billing route", () => {
    const route = plugin.routes?.find(
      (r) => r.path === "/api/v1/komunitas/billing/bulk",
    );
    expect(route).toBeDefined();
    expect(route?.type).toBe("POST");
  });

  it("should validate route structure", () => {
    plugin.routes?.forEach((route) => {
      expect(route).toHaveProperty("path");
      expect(route).toHaveProperty("type");
      expect(route).toHaveProperty("handler");
      expect(typeof route.path).toBe("string");
      expect(route.path.startsWith("/")).toBe(true);
      expect(["GET", "POST", "PUT", "DELETE", "PATCH"]).toContain(route.type);
      expect(typeof route.handler).toBe("function");
    });
  });

  it("should have unique route paths", () => {
    const paths = plugin.routes?.map((r) => `${r.type}:${r.path}`) ?? [];
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });
});
