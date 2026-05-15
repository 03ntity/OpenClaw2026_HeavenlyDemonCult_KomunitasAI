import type { RouteRequest, RouteResponse } from "@elizaos/core";
import { getKomunitasService } from "./komunitas-service.ts";
import { routeJson } from "./helpers.ts";
import {
  rtRwCharacter,
  arisanCharacter,
  koperasiCharacter,
  eventCharacter,
  patunganCharacter,
} from "../agents/characters.ts";

export const summaryRoute = {
  name: "komunitas-summary",
  path: "/api/v1/komunitas/summary",
  type: "GET" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const [members, kas, kasEntries, invoices, logs] = await Promise.all([
      service.listMembers(community.id),
      service.getKasSummary(community.id),
      service.listKasEntries(community.id),
      service.listInvoices(community.id),
      service.getLogs(community.id),
    ]);
    routeJson(res, {
      community,
      members,
      kas,
      kasEntries: kasEntries.slice(0, 10),
      invoices,
      logs: logs.slice(0, 10),
      dokuConfigured: service.isDokuConfigured(),
    });
  },
};

export const sendRemindersRoute = {
  name: "komunitas-send-reminders",
  path: "/api/v1/komunitas/reminders/send",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.sendPaymentReminders(
        (req as any).body ?? {},
      );
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const simulatePaymentRoute = {
  name: "komunitas-simulate-payment",
  path: "/api/v1/komunitas/payments/simulate",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.simulatePayment((req as any).body ?? {});
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const simulatePaymentByIdRoute = {
  name: "komunitas-simulate-payment-by-id",
  path: "/api/v1/invoices/:invoiceId/simulate-payment",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const invoiceId =
        (req as any).params?.invoiceId ?? (req as any).body?.invoiceId;
      const result = await service.simulatePayment({ invoiceId });
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const runBillingLoopRoute = {
  name: "komunitas-run-billing-loop",
  path: "/api/v1/agent/actions/run-billing-loop",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.bulkCreateInvoices((req as any).body ?? {});
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const runMonitoringLoopRoute = {
  name: "komunitas-run-monitoring-loop",
  path: "/api/v1/agent/actions/run-monitoring-loop",
  type: "POST" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.checkPendingPayments();
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const runReportLoopRoute = {
  name: "komunitas-run-report-loop",
  path: "/api/v1/agent/actions/run-report-loop",
  type: "POST" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    const service = getKomunitasService(runtime);
    routeJson(res, await service.generateMonthlyReport());
  },
};

export const bulkBillingRoute = {
  name: "komunitas-bulk-billing",
  path: "/api/v1/komunitas/billing/bulk",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.bulkCreateInvoices((req as any).body ?? {});
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const monitorPaymentsRoute = {
  name: "komunitas-monitor-payments",
  path: "/api/v1/komunitas/payments/check",
  type: "POST" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.checkPendingPayments();
      routeJson(res, result);
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const reportRoute = {
  name: "komunitas-report",
  path: "/api/v1/komunitas/reports/current",
  type: "POST" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    const service = getKomunitasService(runtime);
    routeJson(res, await service.generateMonthlyReport());
  },
};

export const dokuWebhookRoute = {
  name: "doku-webhook",
  path: "/webhook/doku",
  type: "POST" as const,
  public: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const body = (req as any).body ?? {};
      const target = "/webhook/doku";
      const isValid = service.verifyDokuWebhook(
        (req as any).headers,
        body,
        target,
      );
      if (!isValid)
        return routeJson(res, { error: "Invalid DOKU signature" }, 401);

      const invoice = await service.handleDokuWebhook(body);
      routeJson(res, { status: "ok", invoice });
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const charactersRoute = {
  name: "komunitas-characters",
  path: "/api/v1/komunitas/characters",
  type: "GET" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, _runtime: any) => {
    const characters = [
      rtRwCharacter,
      arisanCharacter,
      koperasiCharacter,
      eventCharacter,
      patunganCharacter,
    ];
    routeJson(res, {
      characters: characters.map((c) => ({
        name: c.name,
        username: c.username,
        communityType: (c.settings as any)?.communityType,
        characterJson: c,
      })),
    });
  },
};

export const allRoutes = [
  summaryRoute,
  sendRemindersRoute,
  simulatePaymentRoute,
  simulatePaymentByIdRoute,
  runBillingLoopRoute,
  runMonitoringLoopRoute,
  runReportLoopRoute,
  bulkBillingRoute,
  monitorPaymentsRoute,
  reportRoute,
  dokuWebhookRoute,
  charactersRoute,
];
