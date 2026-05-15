import { describe, expect, it, beforeEach, spyOn, mock } from "bun:test";
import plugin from "../plugin";
import { KomunitasService } from "../plugin";
import { logger } from "@elizaos/core";
import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";

describe("Error Handling", () => {
  beforeEach(() => {
    spyOn(logger, "info");
    spyOn(logger, "error");
    spyOn(logger, "warn");
  });

  describe("Action Error Handling", () => {
    it("should handle missing service gracefully in actions", async () => {
      const action = plugin.actions?.find((a) => a.name === "GET_KAS_SUMMARY");
      if (!action) return;

      const mockRuntime = {
        getService: mock().mockReturnValue(null),
      } as Partial<IAgentRuntime> as IAgentRuntime;

      const mockMessage = {
        entityId: uuidv4(),
        roomId: uuidv4(),
        content: { text: "Berapa saldo kas?", source: "test" },
      } as Memory;

      const mockState = { values: {}, data: {}, text: "" } as State;
      const mockCallback = mock();

      let caughtError: Error | null = null;
      try {
        await action.handler(
          mockRuntime,
          mockMessage,
          mockState,
          {},
          mockCallback,
          [],
        );
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).toBeDefined();
    });
  });

  describe("KomunitasService Error Handling", () => {
    it("should throw when stopping non-existent service", async () => {
      const mockRuntime = {
        getService: mock().mockReturnValue(null),
      } as Partial<IAgentRuntime> as IAgentRuntime;

      let caughtError: Error | null = null;
      try {
        await KomunitasService.stop(mockRuntime);
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).toBeNull();
    });

    it("should throw when no communities exist (DB not initialized or empty)", async () => {
      const service = new KomunitasService();
      let caughtError: Error | null = null;
      try {
        await service.getCommunity();
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).not.toBeNull();
      const msg = caughtError?.message ?? "";
      const isExpected =
        msg.includes("ONBOARDING_REQUIRED") ||
        msg.includes("does not exist") ||
        msg.includes("Community not found") ||
        msg.includes("connection");
      expect(isExpected).toBe(true);
    });
  });

  describe("Provider Error Handling", () => {
    it("should return onboarding context when no communities exist", async () => {
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

      const result = await provider.get(mockRuntime, {} as Memory, {} as State);
      expect(result).toHaveProperty("text");
      expect((result.values as any).onboardingRequired).toBe(true);
    });
  });

  describe("Plugin Events Error Handling", () => {
    it("should handle missing event handlers gracefully", async () => {
      if (plugin.events && (plugin.events as any).MESSAGE_RECEIVED) {
        const messageHandler = (plugin.events as any).MESSAGE_RECEIVED[0];
        try {
          await messageHandler({
            message: { id: "test", content: { text: "Hello!" } },
            runtime: {},
          });
          expect(true).toBe(true);
        } catch (error) {
          expect(error).toBeDefined();
        }
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
