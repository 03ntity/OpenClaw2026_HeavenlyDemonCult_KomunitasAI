import { describe, expect, it, spyOn, beforeAll, afterAll } from "bun:test";
import plugin from "../plugin";
import { logger } from "@elizaos/core";
import {
  runCoreActionTests,
  documentTestResult,
} from "./utils/core-test-utils";
import dotenv from "dotenv";

dotenv.config();

beforeAll(() => {
  spyOn(logger, "info");
  spyOn(logger, "error");
  spyOn(logger, "warn");
});

afterAll(() => {});

describe("Actions", () => {
  it("should pass core action tests", () => {
    if (plugin.actions) {
      const coreTestResults = runCoreActionTests(plugin.actions);
      expect(coreTestResults).toBeDefined();
      expect(coreTestResults.formattedNames).toBeDefined();
      expect(coreTestResults.formattedActions).toBeDefined();
      expect(coreTestResults.composedExamples).toBeDefined();
      documentTestResult("Core Action Tests", coreTestResults);
    }
  });

  it("should have at least 16 actions", () => {
    expect(plugin.actions).toBeDefined();
    expect(plugin.actions!.length).toBeGreaterThanOrEqual(16);
    documentTestResult("Action count", { count: plugin.actions?.length });
  });

  it("should include onboarding actions", () => {
    const names = plugin.actions?.map((a) => a.name) ?? [];
    expect(names).toContain("START_ONBOARDING");
    expect(names).toContain("HANDLE_ONBOARDING_INPUT");
    expect(names).toContain("ADD_MEMBER");
    expect(names).toContain("LIST_COMMUNITIES");
    documentTestResult("Onboarding actions present", { names });
  });

  it("should include billing actions", () => {
    const names = plugin.actions?.map((a) => a.name) ?? [];
    expect(names).toContain("BULK_CREATE_INVOICES");
    expect(names).toContain("GET_KAS_SUMMARY");
    expect(names).toContain("GENERATE_MONTHLY_REPORT");
    expect(names).toContain("SIMULATE_PAYMENT");
    documentTestResult("Billing actions present", { names });
  });

  it("each action should have required structure", () => {
    plugin.actions?.forEach((action) => {
      expect(action).toHaveProperty("name");
      expect(action).toHaveProperty("description");
      expect(action).toHaveProperty("validate");
      expect(action).toHaveProperty("handler");
      expect(action).toHaveProperty("examples");
      expect(typeof action.name).toBe("string");
      expect(typeof action.description).toBe("string");
      expect(typeof action.validate).toBe("function");
      expect(typeof action.handler).toBe("function");
      expect(Array.isArray(action.examples)).toBe(true);
    });
    documentTestResult("Action structure valid", {
      count: plugin.actions?.length,
    });
  });
});
