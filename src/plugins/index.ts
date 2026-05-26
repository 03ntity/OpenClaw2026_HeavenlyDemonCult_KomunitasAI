import { type Plugin, logger } from "@elizaos/core";
import { configSchema } from "./types.ts";
import { allActions } from "./actions.ts";
import { onboardingActions } from "./onboarding-actions.ts";
import { komunitasProvider } from "./provider.ts";
import { allRoutes } from "./routes.ts";
import { KomunitasService } from "./komunitas-service.ts";
import { komunitasEvaluator } from "./evaluator.ts";

export { KomunitasService, getKomunitasService } from "./komunitas-service.ts";

const plugin: Plugin = {
  name: "komunitas-ai",
  description:
    "KomunitasAI finance automation plugin with DOKU Checkout sandbox integration.",
  priority: 10,
  config: {
    DOKU_CLIENT_ID: process.env.DOKU_CLIENT_ID,
    DOKU_SECRET_KEY: process.env.DOKU_SECRET_KEY,
    DOKU_MCP_API_KEY: process.env.DOKU_MCP_API_KEY,
    DOKU_AUTHORIZATION: process.env.DOKU_AUTHORIZATION,
    DOKU_MCP_URL: process.env.DOKU_MCP_URL,
    DOKU_BASE_URL: process.env.DOKU_BASE_URL || "https://api-sandbox.doku.com",
    APP_URL: process.env.APP_URL,
  },
  async init(config: Record<string, string>) {
    const validated = configSchema.parse({
      DOKU_CLIENT_ID: config.DOKU_CLIENT_ID || process.env.DOKU_CLIENT_ID,
      DOKU_SECRET_KEY: config.DOKU_SECRET_KEY || process.env.DOKU_SECRET_KEY,
      DOKU_MCP_API_KEY: config.DOKU_MCP_API_KEY || process.env.DOKU_MCP_API_KEY,
      DOKU_AUTHORIZATION:
        config.DOKU_AUTHORIZATION || process.env.DOKU_AUTHORIZATION,
      DOKU_MCP_URL: config.DOKU_MCP_URL || process.env.DOKU_MCP_URL,
      DOKU_BASE_URL:
        config.DOKU_BASE_URL ||
        process.env.DOKU_BASE_URL ||
        "https://api-sandbox.doku.com",
      APP_URL: config.APP_URL || process.env.APP_URL,
    });
    if (validated.DOKU_CLIENT_ID)
      process.env.DOKU_CLIENT_ID = validated.DOKU_CLIENT_ID;
    if (validated.DOKU_SECRET_KEY)
      process.env.DOKU_SECRET_KEY = validated.DOKU_SECRET_KEY;
    if (validated.DOKU_MCP_API_KEY)
      process.env.DOKU_MCP_API_KEY = validated.DOKU_MCP_API_KEY;
    if (validated.DOKU_AUTHORIZATION)
      process.env.DOKU_AUTHORIZATION = validated.DOKU_AUTHORIZATION;
    if (validated.DOKU_MCP_URL)
      process.env.DOKU_MCP_URL = validated.DOKU_MCP_URL;
    process.env.DOKU_BASE_URL = validated.DOKU_BASE_URL;
    if (validated.APP_URL) process.env.APP_URL = validated.APP_URL;
    logger.info(
      {
        dokuBaseUrl: validated.DOKU_BASE_URL,
        dokuMcpUrl: validated.DOKU_MCP_URL,
        dokuConfigured: Boolean(
          validated.DOKU_CLIENT_ID &&
          (validated.DOKU_AUTHORIZATION || validated.DOKU_MCP_API_KEY),
        ),
      },
      "KomunitasAI plugin initialized",
    );
  },
  services: [KomunitasService],
  actions: [...onboardingActions, ...allActions],
  providers: [komunitasProvider],
  evaluators: [komunitasEvaluator],
  routes: allRoutes,
};

export default plugin;
