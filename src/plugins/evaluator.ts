import { logger, type Evaluator, type IAgentRuntime } from "@elizaos/core";

const FINANCE_KEYWORDS = [
  "payment",
  "iuran",
  "kas",
  "saldo",
  "bayar",
  "invoice",
  "anggota",
  "komunitas",
  "tagihan",
  "laporan",
];

export const komunitasEvaluator: Evaluator = {
  name: "KOMUNITAS_FINANCE_EVALUATOR",
  description: "Extracts community finance facts from conversation messages.",
  examples: [],

  validate: async (_runtime, message) => {
    const text = message.content.text?.toLowerCase() ?? "";
    return FINANCE_KEYWORDS.some((keyword) => text.includes(keyword));
  },

  handler: async (runtime: IAgentRuntime, message) => {
    const text = message.content.text?.trim();
    if (!text) return;
    try {
      const result = await (runtime as any).generateText({
        context: `Extract key community finance facts from this message in Indonesian bullet points. Message: "${text}"`,
      });
      logger.info(
        { evaluator: "KOMUNITAS_FINANCE_EVALUATOR", facts: result },
        "KomunitasAI finance facts extracted",
      );
    } catch {}
  },
};
