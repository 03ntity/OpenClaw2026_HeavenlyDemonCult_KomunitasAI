import { createHash, createHmac, randomUUID } from "node:crypto";
import { logger } from "@elizaos/core";
import type {
  DokuPaymentParams,
  DokuPaymentResult,
  DokuStatusResult,
  KomunitasConfig,
} from "./types.ts";
import { getHeader } from "./helpers.ts";

const MCP_SANDBOX_URL = "https://api-sandbox.doku.com/doku-mcp-server/mcp";

function sanitizeName(name: unknown): string {
  return (
    String(name ?? "Customer")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .slice(0, 50) || "Customer"
  );
}

function sanitizePhone(phone?: string): string {
  if (!phone) return "08000000000";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 5) return "08000000000";
  if (digits.length > 16) return digits.slice(0, 16);
  return digits;
}

type JsonRpcResponse = {
  jsonrpc: string;
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
};

export type DokuMcpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

type DirectPaymentResult = {
  requestId: string;
  invoiceNumber: string;
  paymentInstruction: string;
  paymentUrl?: string;
  paymentCode?: string;
  qrString?: string;
  raw: unknown;
};

/**
 * DOKU MCP Client — replaces the raw REST DokuClient with
 * JSON-RPC calls through DOKU's MCP Server.
 *
 * Provides 35+ payment tools including checkout, QRIS, VA,
 * e-wallet, convenience store, and BNPL/installments.
 */
export class DokuMcpClient {
  private readonly config: KomunitasConfig;
  private readonly mcpUrl: string;
  private readonly authHeader: string;
  private protocolVersion: string | null = null;
  private availableTools: Set<string> | null = null;
  private toolDefinitions: DokuMcpToolDefinition[] = [];
  private initializePromise: Promise<void> | null = null;

  constructor(config: KomunitasConfig) {
    this.config = config;
    this.mcpUrl = config.DOKU_MCP_URL ?? buildMcpUrl(config.DOKU_BASE_URL);
    this.authHeader = this.buildAuthHeader();
  }

  get isConfigured(): boolean {
    return Boolean(
      this.config.DOKU_CLIENT_ID?.trim() &&
      (this.config.DOKU_AUTHORIZATION?.trim() ||
        this.config.DOKU_MCP_API_KEY?.trim()),
    );
  }

  // ── Payment Link / Checkout ───────────────────────────────────────────

  /**
   * Create a hosted DOKU checkout page with all available payment methods.
   * Returns a shareable URL that the payer opens to choose payment method.
   */
  async createPaymentLink(
    params: DokuPaymentParams,
  ): Promise<DokuPaymentResult> {
    this.assertConfigured();

    const toolRequest = {
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      currency: "IDR",
      customerName: sanitizeName(params.customerName),
      customerPhone: sanitizePhone(params.customerPhone),
      customerEmail: params.customerEmail ?? "",
    };

    const raw = await this.callToolWithFallback<{
      message?: string | string[];
      invoiceNumber?: string;
      response?: {
        order?: { invoice_number?: string };
        payment?: {
          url?: string;
          token_id?: string;
          expired_date?: string;
          expired_datetime?: string;
        };
      };
    }>(["create_checkout_link", "create_payment_link"], toolRequest);

    logger.info(
      {
        rawKeys: raw ? Object.keys(raw) : null,
        hasResponse: !!raw?.response,
        hasPayment: !!raw?.response?.payment,
      },
      "DOKU MCP createPaymentLink raw response",
    );

    const payment = raw?.response?.payment;
    const order = raw?.response?.order;
    const paymentUrl = payment?.url ?? findStringDeep(raw, [/url/i]);
    const invoiceNumber =
      order?.invoice_number ??
      raw?.invoiceNumber ??
      findStringDeep(raw, [/invoice/i, /order.*number/i]) ??
      params.invoiceNumber;

    if (!paymentUrl) {
      throw new Error(
        `DOKU MCP tidak mengembalikan payment URL. Response: ${JSON.stringify(raw).slice(0, 200)}`,
      );
    }

    return {
      requestId: payment?.token_id ?? randomUUID(),
      invoiceNumber,
      paymentUrl,
      expiresAt: payment?.expired_datetime,
      raw,
    };
  }

  // ── Transaction Status ────────────────────────────────────────────────

  /**
   * Check transaction status by DOKU invoice number.
   * Returns status, amount, and optional paid-at timestamp.
   */
  async checkPaymentStatus(dokuInvoiceId: string): Promise<DokuStatusResult> {
    this.assertConfigured();

    const toolRequest = { invoiceNumber: dokuInvoiceId };

    const raw = await this.callTool<{
      message: Array<{
        status: string;
        amount: number;
        invoice_number: string;
        paid_amount: number | null;
        approval_code: string | null;
        payment_channel_id: string | null;
      }>;
      total_data: number;
    }>("get_transaction_by_invoice_number", toolRequest);

    if (raw.total_data === 0) {
      return {
        requestId: "",
        status: "NOT_FOUND",
        amount: 0,
        raw,
      };
    }

    const tx = raw.message[0];
    const normalizedStatus = mapDokuStatus(tx.status);

    return {
      requestId: tx.invoice_number,
      status: normalizedStatus,
      amount: tx.amount,
      paidAt: normalizedStatus === "SUCCESS" ? undefined : undefined,
      raw,
    };
  }

  // ── Payment Methods ───────────────────────────────────────────────────

  /**
   * Fetch all payment categories and channels enabled for this merchant.
   */
  async getPaymentMethods(): Promise<{
    totalChannels: number;
    totalCategories: number;
    categories: Record<string, string[]>;
  }> {
    this.assertConfigured();
    const raw = await this.callTool<{
      totalChannels: number;
      totalCategories: number;
      categories: Record<string, string[]>;
    }>("get_merchant_payment_methods", {});
    return raw;
  }

  async listTools(): Promise<DokuMcpToolDefinition[]> {
    await this.initializeMcp();
    return this.toolDefinitions;
  }

  async callRawTool<T = Record<string, unknown>>(
    toolName: string,
    toolRequest: Record<string, unknown> = {},
  ): Promise<T> {
    return this.callTool<T>(toolName, toolRequest);
  }

  // ── Customer Management ───────────────────────────────────────────────

  async createCustomer(data: { name: string; email?: string; phone?: string }) {
    this.assertConfigured();
    return this.callTool("create_customer", data);
  }

  async getCustomerByEmail(email: string) {
    this.assertConfigured();
    return this.callTool("get_customer_by_email", { email });
  }

  // ── Advanced Payment Tools (exposed for direct use) ───────────────────

  async createQrisPayment(params: {
    amount: number;
    invoiceNumber: string;
    customerName: string;
  }): Promise<DirectPaymentResult> {
    this.assertConfigured();
    const raw = await this.callToolWithFallback(
      ["generate_payment_qris", "create_qris_payment"],
      {
        invoiceNumber: params.invoiceNumber,
        amount: params.amount,
        customerName: sanitizeName(params.customerName),
      },
    );
    return normalizeDirectPaymentResult(raw, params.invoiceNumber, "QRIS");
  }

  async createVirtualAccount(params: {
    amount: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail?: string;
    bank: string;
  }): Promise<DirectPaymentResult> {
    this.assertConfigured();
    const raw = await this.callToolWithFallback(
      ["generate_payment_virtual_account", "create_virtual_account_payment"],
      {
        invoiceNumber: params.invoiceNumber,
        amount: params.amount,
        customerName: sanitizeName(params.customerName),
        customerEmail: params.customerEmail ?? "",
        bank: params.bank.toUpperCase(),
      },
    );
    return normalizeDirectPaymentResult(
      raw,
      params.invoiceNumber,
      `${params.bank.toUpperCase()} Virtual Account`,
    );
  }

  // ── Webhook Signature Verification ────────────────────────────────────

  /**
   * Verify DOKU webhook signature using HMAC-SHA256.
   * Same mechanism whether using MCP or direct REST.
   */
  verifyWebhookSignature(params: {
    headers: unknown;
    body: unknown;
    requestTarget: string;
  }): boolean {
    this.assertConfigured();
    const clientId = getHeader(params.headers, "Client-Id");
    const requestId = getHeader(params.headers, "Request-Id");
    const timestamp = getHeader(params.headers, "Request-Timestamp");
    const signature = getHeader(params.headers, "Signature");

    if (!clientId || !requestId || !timestamp || !signature) return false;
    if (clientId !== this.config.DOKU_CLIENT_ID) return false;

    const digest = createHash("sha256")
      .update(JSON.stringify(params.body))
      .digest("base64");

    const component = [
      `Client-Id:${this.config.DOKU_CLIENT_ID}`,
      `Request-Id:${requestId}`,
      `Request-Timestamp:${timestamp}`,
      `Request-Target:${params.requestTarget}`,
      `Digest:${digest}`,
    ].join("\n");

    const expected = `HMACSHA256=${createHmac(
      "sha256",
      this.config.DOKU_SECRET_KEY!,
    )
      .update(component)
      .digest("base64")}`;

    return signature === expected;
  }

  // ── Internal Helpers ──────────────────────────────────────────────────

  private assertConfigured() {
    if (!this.isConfigured) {
      throw new Error(
        "DOKU MCP belum dikonfigurasi. Isi DOKU_CLIENT_ID dan DOKU_AUTHORIZATION atau DOKU_MCP_API_KEY di .env.",
      );
    }
  }

  /**
   * Call an MCP tool via JSON-RPC and return the parsed tool response.
   */
  private async callTool<T = Record<string, unknown>>(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    await this.initializeMcp();
    if (this.availableTools && !this.availableTools.has(toolName)) {
      throw new Error(`DOKU MCP tool tidak tersedia: ${toolName}`);
    }

    const json = await this.callMcpRpc("tools/call", {
      name: toolName,
      arguments: { toolRequest: JSON.stringify(params) },
    });

    if (json.error) {
      const msg = json.error.message;
      const detail = json.error?.data ? JSON.stringify(json.error.data) : "";
      throw new Error(`${msg} ${detail}`.trim());
    }

    if (
      json.result?.content &&
      Array.isArray(json.result.content) &&
      json.result.content[0]?.text
    ) {
      const text = json.result.content[0].text;
      try {
        const parsed = typeof text === "string" ? JSON.parse(text) : text;
        logger.debug(
          { toolName, parsedKeys: parsed ? Object.keys(parsed) : null },
          "DOKU MCP tool response parsed",
        );
        return parsed as T;
      } catch (e) {
        logger.error(
          { toolName, text: text.slice(0, 200), error: String(e) },
          "DOKU MCP failed to parse tool response text",
        );
        throw new Error(`DOKU MCP response parse error: ${String(e)}`);
      }
    }

    return json.result as unknown as T;
  }

  private async callToolWithFallback<T = Record<string, unknown>>(
    toolNames: string[],
    params: Record<string, unknown>,
  ): Promise<T> {
    let lastError: unknown;
    for (const toolName of toolNames) {
      try {
        return await this.callTool<T>(toolName, params);
      } catch (error) {
        lastError = error;
        logger.warn(
          {
            toolName,
            error: error instanceof Error ? error.message : String(error),
          },
          "DOKU MCP tool call failed, trying fallback if available",
        );
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async initializeMcp(): Promise<void> {
    this.assertConfigured();
    if (this.availableTools) return;
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = (async () => {
      const initResult = await this.callMcpRpc<{
        result?: {
          protocolVersion?: string;
          serverInfo?: { name?: string; version?: string };
        };
      }>("initialize", {}, 0);

      if (initResult.error) {
        throw new Error(initResult.error.message);
      }

      this.protocolVersion = initResult.result?.protocolVersion ?? null;
      const serverInfo = initResult.result?.serverInfo;
      logger.info(
        {
          mcpUrl: this.mcpUrl,
          protocolVersion: this.protocolVersion,
          serverName: serverInfo?.name,
          serverVersion: serverInfo?.version,
        },
        "DOKU MCP initialized",
      );

      const toolsResult = await this.callMcpRpc<{
        result?: { tools?: DokuMcpToolDefinition[] };
      }>("tools/list", {}, 1);

      if (toolsResult.error) {
        throw new Error(toolsResult.error.message);
      }

      const tools = toolsResult.result?.tools ?? [];
      this.toolDefinitions = tools;
      this.availableTools = new Set(tools.map((tool) => tool.name));
      logger.info(
        { toolCount: tools.length, tools: tools.map((tool) => tool.name) },
        "DOKU MCP tools loaded",
      );
    })();

    try {
      await this.initializePromise;
    } catch (error) {
      this.initializePromise = null;
      throw error;
    }
  }

  private async callMcpRpc<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown>,
    requestId = Date.now(),
  ): Promise<JsonRpcResponse & T> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response: Response;

    try {
      const headers: Record<string, string> = {
        "client-id": this.config.DOKU_CLIENT_ID!,
        authorization: this.authHeader,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      };
      if (this.protocolVersion) {
        headers["mcp-protocol-version"] = this.protocolVersion;
      }

      response = await fetch(this.mcpUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    const json = parseJsonRpcResponse(text);

    if (!response.ok) {
      const detail = json.error?.message ?? text.slice(0, 300);
      throw new Error(
        `DOKU MCP RPC ${method} failed (${response.status}): ${detail}`,
      );
    }

    return json as JsonRpcResponse & T;
  }

  private buildAuthHeader(): string {
    if (this.config.DOKU_AUTHORIZATION?.trim()) {
      return this.config.DOKU_AUTHORIZATION.trim();
    }
    const apiKey = this.config.DOKU_MCP_API_KEY;
    if (!apiKey) return "";
    const encoded = Buffer.from(`${apiKey}:`).toString("base64");
    return `Basic ${encoded}`;
  }
}

function buildMcpUrl(baseUrl?: string): string {
  if (!baseUrl) return MCP_SANDBOX_URL;
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/mcp")) return trimmed;
  if (trimmed.includes("doku-mcp-server")) return `${trimmed}/mcp`;
  return `${trimmed}/doku-mcp-server/mcp`;
}

function parseJsonRpcResponse(text: string): JsonRpcResponse {
  const trimmed = text.trim();
  if (!trimmed) return {} as JsonRpcResponse;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as JsonRpcResponse;

  const dataLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");

  for (let i = dataLines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(dataLines[i]) as JsonRpcResponse;
    } catch {
      continue;
    }
  }

  throw new Error(`DOKU MCP response parse error: ${trimmed.slice(0, 200)}`);
}

/**
 * Normalise DOKU status strings to a consistent set.
 */
function mapDokuStatus(raw: string): string {
  const upper = String(raw).toUpperCase().trim();
  if (upper === "SUCCESS" || upper === "PAID" || upper === "CAPTURED")
    return "SUCCESS";
  if (upper === "PENDING" || upper === "ORDER_GENERATED") return "PENDING";
  if (upper === "FAILED") return "FAILED";
  if (upper === "EXPIRED") return "EXPIRED";
  if (upper === "VOID" || upper === "CANCELLED") return "CANCELLED";
  return upper;
}

function findStringDeep(
  value: unknown,
  patterns: RegExp[],
): string | undefined {
  const seen = new Set<unknown>();
  const visit = (item: unknown): string | undefined => {
    if (!item || seen.has(item)) return undefined;
    if (typeof item === "string") return undefined;
    if (typeof item !== "object") return undefined;
    seen.add(item);

    for (const [key, rawValue] of Object.entries(
      item as Record<string, unknown>,
    )) {
      if (
        typeof rawValue === "string" &&
        patterns.some((pattern) => pattern.test(key))
      ) {
        return rawValue;
      }
    }

    for (const rawValue of Object.values(item as Record<string, unknown>)) {
      if (Array.isArray(rawValue)) {
        for (const child of rawValue) {
          const found = visit(child);
          if (found) return found;
        }
      } else {
        const found = visit(rawValue);
        if (found) return found;
      }
    }
    return undefined;
  };
  return visit(value);
}

function normalizeDirectPaymentResult(
  raw: unknown,
  fallbackInvoiceNumber: string,
  label: string,
): DirectPaymentResult {
  const invoiceNumber =
    findStringDeep(raw, [/invoice/i, /order.*number/i]) ??
    fallbackInvoiceNumber;
  const paymentUrl = findStringDeep(raw, [/url/i, /deeplink/i, /redirect/i]);
  const paymentCode = findStringDeep(raw, [
    /virtual.*account/i,
    /\bva\b/i,
    /payment.*code/i,
    /account.*number/i,
  ]);
  const qrString = findStringDeep(raw, [/qr/i, /qris/i]);
  const token = findStringDeep(raw, [/token/i, /request/i, /reference/i]);

  const instructionParts = [
    `${label} berhasil dibuat.`,
    `Invoice: ${invoiceNumber}.`,
    paymentCode ? `Kode/VA: ${paymentCode}.` : "",
    paymentUrl ? `Link: ${paymentUrl}.` : "",
    qrString ? `QRIS payload: ${qrString}.` : "",
  ].filter(Boolean);

  return {
    requestId: token ?? invoiceNumber,
    invoiceNumber,
    paymentInstruction: instructionParts.join(" "),
    paymentUrl,
    paymentCode,
    qrString,
    raw,
  };
}
