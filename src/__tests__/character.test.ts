import { describe, expect, it } from "bun:test";
import { character } from "../index";

describe("Character Configuration", () => {
  it("should have all required fields", () => {
    expect(character).toHaveProperty("name");
    expect(character).toHaveProperty("bio");
    expect(character).toHaveProperty("plugins");
    expect(character).toHaveProperty("system");
    expect(character).toHaveProperty("messageExamples");
  });

  it("should have the correct name", () => {
    expect(typeof character.name).toBe("string");
    expect(character.name.length).toBeGreaterThan(0);
  });

  it("should have plugins defined as an array", () => {
    expect(Array.isArray(character.plugins)).toBe(true);
  });

  it("should have conditionally included plugins based on environment variables", () => {
    expect(character.plugins).toContain("@elizaos/plugin-sql");

    if (process.env.OPENAI_API_KEY) {
      expect(character.plugins).toContain("@elizaos/plugin-openai");
    }

    if (
      process.env.ANTHROPIC_API_KEY &&
      !process.env.OPENAI_API_KEY &&
      !process.env.OPENROUTER_API_KEY
    ) {
      expect(character.plugins).toContain("@elizaos/plugin-anthropic");
    }
  });

  it("should have a non-empty system prompt", () => {
    expect(character.system).toBeTruthy();
    if (character.system) {
      expect(typeof character.system).toBe("string");
      expect(character.system.length).toBeGreaterThan(0);
    }
  });

  it("should have personality traits in bio array", () => {
    expect(Array.isArray(character.bio)).toBe(true);
    if (character.bio && Array.isArray(character.bio)) {
      expect(character.bio.length).toBeGreaterThan(0);
      // Check if bio entries are non-empty strings
      character.bio.forEach((trait) => {
        expect(typeof trait).toBe("string");
        expect(trait.length).toBeGreaterThan(0);
      });
    }
  });

  it("should have message examples for training", () => {
    expect(Array.isArray(character.messageExamples)).toBe(true);
    if (character.messageExamples && Array.isArray(character.messageExamples)) {
      expect(character.messageExamples.length).toBeGreaterThan(0);

      // Check structure of first example
      const firstExample = character.messageExamples[0];
      expect(Array.isArray(firstExample)).toBe(true);
      expect(firstExample.length).toBeGreaterThan(1); // At least a user message and a response

      // Check that messages have name and content
      firstExample.forEach((message) => {
        expect(message).toHaveProperty("name");
        expect(message).toHaveProperty("content");
        expect(message.content).toHaveProperty("text");
      });
    }
  });
});
