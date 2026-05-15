import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";

describe("Build Order Integration Test", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const distDir = path.join(rootDir, "dist");
  const tsupBuildMarker = path.join(distDir, "index.js");

  beforeAll(async () => {
    if (fs.existsSync(distDir)) {
      await fs.promises.rm(distDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(distDir)) {
      await fs.promises.rm(distDir, { recursive: true, force: true });
    }
  });

  it("should produce index.js after bun build", async () => {
    await $`cd ${rootDir} && bun run build`;
    expect(fs.existsSync(tsupBuildMarker)).toBe(true);
    const distFiles = fs.readdirSync(distDir);
    expect(distFiles.some((file) => file === "index.js")).toBe(true);
  }, 30000);

  it("should produce a non-empty index.js", async () => {
    expect(fs.existsSync(tsupBuildMarker)).toBe(true);
    const stat = fs.statSync(tsupBuildMarker);
    expect(stat.size).toBeGreaterThan(0);
  });
});
