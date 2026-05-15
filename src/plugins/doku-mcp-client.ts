import { createHash, createHmac } from "node:crypto";
import type {
  DokuPaymentParams,
  DokuPaymentResult,
  DokuStatusResult,
  KomunitasConfig,
} from "./types.ts";
import { getHeader } from "./helpers.ts";

const MCP_SANDBOX_URL = "https://api-sandbox.doku.com/doku-mcp-server/mcp";

type JsonRpcResponse = {
  jsonrpc: string;
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
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

  constructor(config: KomunitasConfig) {
    this.config = config;
    this.mcpUrl = MCP_SANDBOX_URL;
    this.authHeader = this.buildAuthHeader();
  }

  get isConfigured(): boolean {
    return Boolean(
      this.config.DOKU_CLIENT_ID?.trim() &&
      this.config.DOKU_MCP_API_KEY?.trim(),
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
      customerName: params.customerName,
      customerPhone: params.customerPhone ?? "",
      customerEmail: params.customerEmail ?? "",
    };

    const raw = await this.callTool<{
      response: {
        order: { invoice_number: string };
        payment: {
          url: string;
          token_id: string;
          expired_date: string;
          expired_datetime: string;
        };
      };
    }>("create_doku_direct_checkout", toolRequest);

    return {
      requestId: raw.response.payment.token_id,
      invoiceNumber: raw.response.order.invoice_number,
      paymentUrl: raw.response.payment.url,
      expiresAt: raw.response.payment.expired_datetime,
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
  }) {
    this.assertConfigured();
    return this.callTool("create_qris_payment", params);
  }

  async createVirtualAccount(params: {
    amount: number;
    invoiceNumber: string;
    customerName: string;
    customerEmail?: string;
    bank: string;
  }) {
    this.assertConfigured();
    return this.callTool("create_virtual_account_payment", params);
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
        "DOKU MCP belum dikonfigurasi. Isi DOKU_CLIENT_ID dan DOKU_MCP_API_KEY di .env.",
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
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: { toolRequest: JSON.stringify(params) },
      },
    });

    const response = await fetch(this.mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": this.config.DOKU_CLIENT_ID!,
        Authorization: this.authHeader,
        Accept: "application/json, text/event-stream",
      },
      body,
    });

    const json: JsonRpcResponse = await response.json().catch(() => ({}));

    if (!response.ok || json.error) {
      const msg = json.error?.message ?? `DOKU MCP error (${response.status})`;
      const detail = json.error?.data ? JSON.stringify(json.error.data) : "";
      throw new Error(`${msg} ${detail}`.trim());
    }

    // Parse the tool response from MCP content format
    if (
      json.result?.content &&
      Array.isArray(json.result.content) &&
      json.result.content[0]?.text
    ) {
      return JSON.parse(json.result.content[0].text) as T;
    }

    return json.result as unknown as T;
  }

  private buildAuthHeader(): string {
    const apiKey = this.config.DOKU_MCP_API_KEY;
    if (!apiKey) return "";
    const encoded = btoa(`${apiKey}:`);
    return `Basic ${encoded}`;
  }
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
