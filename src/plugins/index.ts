import { type Action, type Plugin, logger } from "@elizaos/core";
import { configSchema } from "./types.ts";
import { allActions } from "./actions.ts";
import { onboardingActions } from "./onboarding-actions.ts";
import { komunitasProvider } from "./provider.ts";
import { allRoutes } from "./routes.ts";
import { KomunitasService } from "./komunitas-service.ts";
import { komunitasEvaluator } from "./evaluator.ts";

export { KomunitasService, getKomunitasService } from "./komunitas-service.ts";

const leanActionDescriptions: Record<string, string> = {
  ADD_MEMBER: "Tambah anggota aktif.",
  ANSWER_KAS_QUERY: "Jawab pertanyaan kas dari data sistem.",
  BULK_CREATE_INVOICES: "Tagih semua anggota aktif.",
  CALCULATE_SPLIT_BILL: "Hitung patungan rata.",
  CALL_DOKU_MCP_TOOL: "Panggil tool DOKU MCP.",
  CHECK_PAYMENT_STATUS: "Cek status invoice DOKU.",
  CREATE_BANK_TRANSFER_BILL: "Buat tagihan VA/bank transfer.",
  CREATE_PAYMENT_LINK: "Buat payment link untuk anggota.",
  CREATE_QRIS_BILL: "Buat tagihan QRIS.",
  DETECT_PAYMENT_ANOMALY: "Cari invoice bermasalah.",
  FULL_BILLING_WORKFLOW: "Jalankan workflow tagih, cek, reminder, laporan.",
  GENERATE_MONTHLY_REPORT: "Buat laporan bulanan.",
  GET_ALL_MEMBERS: "Tampilkan anggota aktif.",
  GET_KAS_SUMMARY: "Tampilkan saldo kas.",
  GET_UNPAID_INVOICES: "Tampilkan invoice pending.",
  LIST_COMMUNITIES: "Tampilkan komunitas.",
  LIST_DOKU_MCP_TOOLS: "Tampilkan tool DOKU MCP.",
  MARK_INVOICE_PAID_MANUAL: "Tandai invoice lunas manual.",
  RUN_BILLING_LOOP: "Jalankan billing loop demo.",
  RUN_MONITORING_LOOP: "Cek semua invoice pending.",
  RUN_REPORT_LOOP: "Jalankan report loop demo.",
  SEND_PAYMENT_REMINDERS: "Kirim reminder pembayaran.",
  SET_WORKFLOW_SCHEDULE: "Atur jadwal workflow.",
  SIMULATE_PAYMENT: "Simulasikan pembayaran demo.",
  START_ONBOARDING: "Mulai setup komunitas.",
  UPDATE_KAS_BALANCE: "Catat pemasukan/pengeluaran kas.",
};

const keepOneExample = new Set([
  "ADD_MEMBER",
  "BULK_CREATE_INVOICES",
  "GET_KAS_SUMMARY",
  "GET_UNPAID_INVOICES",
  "START_ONBOARDING",
]);

const promptLeanActions: Action[] = [...onboardingActions, ...allActions].map(
  (action) => ({
    ...action,
    description: leanActionDescriptions[action.name] ?? action.description,
    examples: keepOneExample.has(action.name)
      ? (action.examples ?? []).slice(0, 1)
      : [],
  }),
);

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
  actions: promptLeanActions,
  providers: [komunitasProvider],
  evaluators: [komunitasEvaluator],
  routes: allRoutes,
};

export default plugin;
