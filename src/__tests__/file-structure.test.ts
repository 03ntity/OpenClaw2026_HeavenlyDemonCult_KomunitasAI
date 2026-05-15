import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { logger } from "@elizaos/core";

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function directoryExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

describe("Project Structure Validation", () => {
  const rootDir = path.resolve(__dirname, "../..");

  describe("Directory Structure", () => {
    it("should have the expected directory structure", () => {
      expect(directoryExists(path.join(rootDir, "src"))).toBe(true);
      expect(directoryExists(path.join(rootDir, "src", "__tests__"))).toBe(
        true,
      );
    });

    it("should have a dist directory after building (skipped if not built)", () => {
      if (!directoryExists(path.join(rootDir, "dist"))) {
        logger.warn("Dist directory not found — run bun run build first");
        return;
      }
      expect(directoryExists(path.join(rootDir, "dist"))).toBe(true);
    });
  });

  describe("Source Files", () => {
    it("should contain the required source files", () => {
      expect(fileExists(path.join(rootDir, "src", "index.ts"))).toBe(true);
      expect(fileExists(path.join(rootDir, "src", "plugin.ts"))).toBe(true);
    });

    it("should have properly structured main files", () => {
      const indexContent = fs.readFileSync(
        path.join(rootDir, "src", "index.ts"),
        "utf8",
      );
      expect(indexContent).toContain("character");
      expect(indexContent).toContain("plugin");

      const pluginContent = fs.readFileSync(
        path.join(rootDir, "src", "plugin.ts"),
        "utf8",
      );
      expect(pluginContent).toContain("export default");
    });
  });

  describe("Configuration Files", () => {
    it("should have the required configuration files", () => {
      expect(fileExists(path.join(rootDir, "package.json"))).toBe(true);
      expect(fileExists(path.join(rootDir, "tsconfig.json"))).toBe(true);
      expect(fileExists(path.join(rootDir, "tsconfig.build.json"))).toBe(true);
      expect(fileExists(path.join(rootDir, "bunfig.toml"))).toBe(true);
    });

    it("should have the correct package.json configuration", () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
      );
      expect(packageJson.name).toBeTruthy();
      expect(typeof packageJson.name).toBe("string");
      expect(packageJson.scripts).toHaveProperty("build");
      expect(packageJson.scripts).toHaveProperty("test");
      expect(packageJson.dependencies).toHaveProperty("@elizaos/core");
      expect(packageJson.devDependencies).toBeTruthy();
    });

    it("should have proper TypeScript configuration", () => {
      const tsConfig = JSON.parse(
        fs.readFileSync(path.join(rootDir, "tsconfig.json"), "utf8"),
      );
      expect(tsConfig).toHaveProperty("compilerOptions");
      expect(tsConfig.compilerOptions).toHaveProperty("target");
      expect(tsConfig.compilerOptions).toHaveProperty("module");
      expect(tsConfig).toHaveProperty("include");
    });
  });

  describe("Build Output", () => {
    it("should check for expected build output structure", () => {
      if (directoryExists(path.join(rootDir, "dist"))) {
        const files = fs.readdirSync(path.join(rootDir, "dist"));
        expect(files.length).toBeGreaterThan(0);
        const hasJsFiles = files.some((file) => file.endsWith(".js"));
        expect(hasJsFiles).toBe(true);
      } else {
        logger.warn("Dist directory not found, skipping build output tests");
      }
    });

    it("should verify the build script exists", () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
      );
      expect(packageJson.scripts).toHaveProperty("build");
      expect(fileExists(path.join(rootDir, "build.ts"))).toBe(true);
    });
  });

  describe("Documentation", () => {
    it("should have README files", () => {
      expect(fileExists(path.join(rootDir, "README.md"))).toBe(true);
    });

    it("should have appropriate documentation content", () => {
      const readmeContent = fs.readFileSync(
        path.join(rootDir, "README.md"),
        "utf8",
      );
      expect(readmeContent).toContain("KomunitasAI");
      expect(readmeContent.length).toBeGreaterThan(200);
    });
  });
});
