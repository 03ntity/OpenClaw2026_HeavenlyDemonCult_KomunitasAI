import type { RouteRequest, RouteResponse } from "@elizaos/core";
import { createHash, randomUUID } from "node:crypto";
import { getKomunitasService } from "./komunitas-service.ts";
import { routeJson } from "./helpers.ts";
import { routeKomunitasMessage } from "./skill-router.ts";
import { normalizeWahaPhone } from "./waha-client.ts";
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

export const wahaWebhookRoute = {
  name: "waha-webhook",
  path: "/webhook/waha",
  type: "POST" as const,
  public: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    const service = getKomunitasService(runtime);
    const body = (req as any).body ?? {};
    const payload = body?.payload ?? {};

    if (body?.event !== "message" || payload?.fromMe === true) {
      return routeJson(res, { status: "ignored" });
    }

    const phone = extractWahaPhone(payload?.from);
    const messageText = typeof payload?.body === "string" ? payload.body : "";
    if (!phone || !messageText.trim()) {
      return routeJson(res, { status: "ignored" });
    }

    try {
      const memberMatch = await findMemberByPhone(service, phone);
      if (!memberMatch) {
        await sendWahaSafely(
          service,
          phone,
          "Nomor kamu belum terdaftar di komunitas manapun.",
        );
        return routeJson(res, { status: "ok", memberFound: false });
      }

      const routed = await routeKomunitasMessage(runtime, messageText, {
        phone,
        communityId: memberMatch.member.communityId,
        source: "whatsapp",
      });
      if (routed.handled) {
        await sendWahaSafely(service, phone, routed.text);
        return routeJson(res, {
          status: "ok",
          memberFound: true,
          routed: routed.mode,
          actionName: routed.actionName,
        });
      }

      await sendWahaSafely(
        service,
        phone,
        "Pesan kamu diterima, sedang diproses...",
      );

      const agentResponse = await submitWahaMessageToAgent(
        phone,
        messageText,
        memberMatch.member.communityId,
        runtime.agentId,
      );

      await sendWahaSafely(service, phone, agentResponse);
      return routeJson(res, { status: "ok", memberFound: true });
    } catch (error) {
      await sendWahaSafely(
        service,
        phone,
        "Maaf, pesan kamu belum bisa diproses sekarang. Coba lagi nanti ya.",
      );
      return routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        200,
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

export const dokuMcpToolsRoute = {
  name: "doku-mcp-tools",
  path: "/api/v1/doku-mcp/tools",
  type: "GET" as const,
  rawPath: true,
  handler: async (_req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const tools = await service.listDokuMcpTools();
      routeJson(res, { tools });
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const dokuMcpCallToolRoute = {
  name: "doku-mcp-call-tool",
  path: "/api/v1/doku-mcp/tools/call",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    try {
      const service = getKomunitasService(runtime);
      const body = ((req as any).body ?? {}) as Record<string, unknown>;
      const toolName =
        typeof body.toolName === "string"
          ? body.toolName
          : typeof body.name === "string"
            ? body.name
            : "";
      if (!toolName.trim()) {
        return routeJson(res, { error: "toolName is required" }, 400);
      }
      const toolRequest =
        body.toolRequest &&
        typeof body.toolRequest === "object" &&
        !Array.isArray(body.toolRequest)
          ? (body.toolRequest as Record<string, unknown>)
          : body.arguments &&
              typeof body.arguments === "object" &&
              !Array.isArray(body.arguments)
            ? (body.arguments as Record<string, unknown>)
            : {};
      const result = await service.callDokuMcpTool(toolName, toolRequest);
      routeJson(res, { toolName, toolRequest, result });
    } catch (error) {
      routeJson(
        res,
        { error: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
};

export const lightweightReplyRoute = {
  name: "komunitas-skill-reply",
  path: "/api/v1/agent/lightweight-reply",
  type: "POST" as const,
  rawPath: true,
  handler: async (req: RouteRequest, res: RouteResponse, runtime: any) => {
    const body = ((req as any).body ?? {}) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return routeJson(res, { handled: false });

    routeJson(
      res,
      await routeKomunitasMessage(runtime, text, {
        ...(typeof body.agentId === "string" ? { agentId: body.agentId } : {}),
        source: "dashboard",
      }),
    );
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
  wahaWebhookRoute,
  charactersRoute,
  dokuMcpToolsRoute,
  dokuMcpCallToolRoute,
  lightweightReplyRoute,
];

function extractWahaPhone(from: unknown): string {
  if (typeof from !== "string") return "";
  return from.replace("@c.us", "").replace("@s.whatsapp.net", "");
}

async function findMemberByPhone(
  service: ReturnType<typeof getKomunitasService>,
  phone: string,
) {
  const target = normalizeWahaPhone(phone);
  const communities = await service.listCommunities();
  for (const community of communities) {
    const members = await service.listMembers(community.id, true);
    const member = members.find(
      (candidate) =>
        candidate.phone && normalizeWahaPhone(candidate.phone) === target,
    );
    if (member) return { community, member };
  }
  return null;
}

async function sendWahaSafely(
  service: ReturnType<typeof getKomunitasService>,
  phone: string,
  text: string,
) {
  if (!service.wahaClient.isConfigured) return;
  try {
    await service.wahaClient.sendText(phone, text);
  } catch {
    // Webhook processing must not fail just because WhatsApp delivery failed.
  }
}

async function submitWahaMessageToAgent(
  phone: string,
  content: string,
  communityId: string,
  agentId?: string,
): Promise<string> {
  if (!agentId) return "Pesan kamu sudah diterima oleh BendaharaAI.";

  const port = process.env.SERVER_PORT ?? 3000;
  const baseUrl = `http://localhost:${port}`;
  const channelId = randomUUID();
  const authorId = uuidFromText(`waha:${phone}`);

  const serverResponse = await fetch(
    `${baseUrl}/api/messaging/message-servers`,
  );
  const serverData = await serverResponse.json().catch(() => ({}));
  const messageServerId =
    serverData?.data?.messageServers?.[0]?.id ??
    "00000000-0000-0000-0000-000000000000";

  const response = await fetch(
    `${baseUrl}/api/messaging/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_server_id: messageServerId,
        author_id: authorId,
        content,
        source_type: "client_chat",
        transport: "http",
        metadata: {
          phone,
          communityId,
          targetAgentId: agentId,
          user_display_name: phone,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElizaOS messaging failed: ${response.status}`);
  }

  const body = await response.json().catch(() => ({}));
  return (
    extractAgentText(body) ?? "Pesan kamu sudah diterima oleh BendaharaAI."
  );
}

function extractAgentText(body: any): string | null {
  const text =
    body?.agentResponse?.text ??
    body?.data?.agentResponse?.text ??
    body?.response?.text ??
    body?.data?.response?.text ??
    body?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

function uuidFromText(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
