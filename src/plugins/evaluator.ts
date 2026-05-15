import { logger, type Evaluator } from "@elizaos/core";

const FINANCE_KEYWORDS = [
  "payment",
  "iuran",
  "kas",
  "saldo",
  "bayar",
  "invoice",
  "anggota",
  "komunitas",
];

export const komunitasEvaluator: Evaluator = {
  name: "KOMUNITAS_FINANCE_EVALUATOR",
  description:
    "Extracts simple community finance facts from relevant conversation messages.",

  validate: async (_runtime, message) => {
    const text = message.content.text?.toLowerCase() ?? "";
    return FINANCE_KEYWORDS.some((keyword) => text.includes(keyword));
  },

  handler: async (runtime, message) => {
    const text = message.content.text?.trim();
    if (!text) return;

    const extractedFacts = await (runtime as any).generateText({
      context: `Extract key community finance facts from this message.

Message: "${text}"

Return concise bullet points in Indonesian. Focus only on payment, iuran, kas, saldo, invoice, anggota, or komunitas facts. If no clear fact exists, return "Tidak ada fakta keuangan yang jelas."`,
    });

    logger.info(
      {
        evaluator: "KOMUNITAS_FINANCE_EVALUATOR",
        facts: extractedFacts,
      },
      "KomunitasAI finance facts extracted",
    );
  },
  examples: [],
};
