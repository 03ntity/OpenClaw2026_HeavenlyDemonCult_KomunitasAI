import { type IAgentRuntime, logger, Service } from "@elizaos/core";
import { randomUUID } from "node:crypto";
import * as db from "../database/db.ts";
import { DokuMcpClient } from "./doku-mcp-client.ts";
import {
  addDays,
  rowToCommunity,
  rowToInvoice,
  rowToKasEntry,
  rowToMember,
  toMonth,
  rupiah,
} from "./helpers.ts";
import type {
  AgentLog,
  Community,
  Invoice,
  InvoiceStatus,
  KasEntry,
  KasEntryType,
  KomunitasConfig,
  Member,
  MonthlyReport,
} from "./types.ts";
import { loadKomunitasConfig } from "./types.ts";

export class KomunitasService extends Service {
  static serviceType = "komunitas";
  capabilityDescription =
    "Manages KomunitasAI community finance state, DOKU Checkout integration, billing, reminders, and reports.";

  private readonly komunitasConfig: KomunitasConfig;
  private readonly doku: DokuMcpClient;

  constructor(
    runtime?: IAgentRuntime,
    config: KomunitasConfig = loadKomunitasConfig(),
  ) {
    super(runtime);
    this.komunitasConfig = config;
    this.doku = new DokuMcpClient(config);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info("Starting KomunitasAI service");
    const service = new KomunitasService(runtime, loadKomunitasConfig());
    await service.initDb();
    return service;
  }

  private async initDb() {
    await db.initSchema();
    logger.info("KomunitasAI database initialized");
  }

  static async stop(runtime: IAgentRuntime) {
    const service = runtime.getService(
      KomunitasService.serviceType,
    ) as KomunitasService | null;
    if (service) await service.stop();
  }

  async stop() {
    logger.info("Stopping KomunitasAI service");
  }

  isDokuConfigured() {
    return this.doku.isConfigured;
  }

  // ── Read methods ──────────────────────────────────────────────────────

  async listCommunities(): Promise<Community[]> {
    const rows = await db.findCommunities();
    return rows.map(rowToCommunity);
  }

  async getCommunity(communityId?: string): Promise<Community> {
    if (communityId) {
      const row = await db.findCommunity(communityId);
      if (!row) throw new Error(`Community not found: ${communityId}`);
      return rowToCommunity(row);
    }
    const rows = await db.findCommunities();
    if (rows.length === 0) {
      throw new Error(
        "ONBOARDING_REQUIRED: Belum ada komunitas. Ketik 'buat komunitas baru' untuk memulai setup.",
      );
    }
    return rowToCommunity(rows[0]);
  }

  private async getActiveCommunityId(): Promise<string> {
    const rows = await db.findCommunities();
    if (rows.length === 0) {
      throw new Error(
        "ONBOARDING_REQUIRED: Belum ada komunitas. Ketik 'buat komunitas baru' untuk memulai setup.",
      );
    }
    return rows[0].id;
  }

  async listMembers(
    communityId?: string,
    activeOnly = true,
  ): Promise<Member[]> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const rows = await db.findMembers(id, activeOnly);
    return rows.map(rowToMember);
  }

  async listInvoices(
    communityId?: string,
    filters: { status?: InvoiceStatus; month?: string } = {},
  ): Promise<Invoice[]> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const rows = await db.findInvoices(id, filters);
    return rows.map(rowToInvoice);
  }

  async listKasEntries(communityId?: string): Promise<KasEntry[]> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const rows = await db.findKasEntries(id);
    return rows.map(rowToKasEntry);
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const row = await db.findInvoice(invoiceId);
    if (!row) throw new Error(`Invoice not found: ${invoiceId}`);
    return rowToInvoice(row);
  }

  async getKasSummary(communityId?: string): Promise<{
    totalIncome: number;
    totalExpense: number;
    currentBalance: number;
    lastUpdated: string;
  }> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const summary = await db.getKasSummary(id);
    return {
      totalIncome: summary.total_income,
      totalExpense: summary.total_expense,
      currentBalance: summary.current_balance,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── Write methods ─────────────────────────────────────────────────────

  async updateKasBalance(params: {
    communityId?: string;
    type: KasEntryType;
    amount: number;
    category: string;
    description: string;
    referenceId?: string;
    recordedBy?: "agent" | "admin";
  }) {
    const community = await this.getCommunity(params.communityId);
    const entryId = randomUUID();
    const row = await db.createKasEntry({
      id: entryId,
      communityId: community.id,
      type: params.type,
      amount: params.amount,
      category: params.category,
      description: params.description,
      referenceId: params.referenceId,
      recordedBy: params.recordedBy ?? "agent",
    });
    const summary = await db.getKasSummary(community.id);
    await this.log(community.id, "kas_entry_created", {
      entryId,
      type: row.type,
      amount: row.amount,
      category: row.category,
      currentBalance: summary.current_balance,
    });
    return {
      entry: rowToKasEntry(row),
      newBalance: summary.current_balance,
    };
  }

  async createPaymentLinkForMember(params: {
    communityId?: string;
    memberId?: string;
    period?: string;
    amount?: number;
    dueDays?: number;
  }) {
    const community = await this.getCommunity(params.communityId);
    const members = await this.listMembers(community.id, true);
    let member: Member | undefined;
    if (params.memberId) {
      const row = await db.findMember(params.memberId);
      if (row) member = rowToMember(row);
    }
    member ??= members[0];
    if (!member) throw new Error("Tidak ada anggota aktif untuk ditagih.");
    if (member.communityId !== community.id) {
      throw new Error("Anggota tidak termasuk komunitas aktif.");
    }

    const period = params.period ?? toMonth();
    const existingInvoices = await this.listInvoices(community.id, {
      month: period,
    });
    const duplicate = existingInvoices.find(
      (inv) => inv.memberId === member.id && inv.status !== "cancelled",
    );
    if (duplicate) {
      return { community, member, invoice: duplicate, created: false };
    }

    const amount = params.amount ?? community.monthlyFee;
    const dueDays = params.dueDays ?? 7;
    const invoiceNumber = sanitizeInvoiceNumberLocal(
      `KAI${period}${member.id}${Date.now()}`,
    );
    const description = `Iuran ${community.name} ${period}`;
    const payment = await this.doku.createPaymentLink({
      invoiceNumber,
      amount,
      description,
      customerName: member.name,
      customerPhone: member.phone,
      dueMinutes: dueDays * 24 * 60,
    });
    const invoiceRow = await db.createInvoice({
      id: randomUUID(),
      communityId: community.id,
      memberId: member.id,
      amount,
      description,
      period,
      dueDate: addDays(new Date(), dueDays).toISOString().slice(0, 10),
      paymentLink: payment.paymentUrl,
      dokuInvoiceId: payment.invoiceNumber,
      dokuRequestId: payment.requestId,
    });
    const invoice = rowToInvoice(invoiceRow);
    await this.log(community.id, "invoice_created", {
      invoiceId: invoice.id,
      memberId: member.id,
      amount,
      period,
    });
    return { community, member, invoice, created: true };
  }

  async bulkCreateInvoices(params: {
    communityId?: string;
    period?: string;
    amount?: number;
    dueDays?: number;
  }) {
    const community = await this.getCommunity(params.communityId);
    const period = params.period ?? toMonth();
    const amount = params.amount ?? community.monthlyFee;
    const members = await this.listMembers(community.id, true);
    const created: Invoice[] = [];
    const skipped: Member[] = [];

    for (const member of members) {
      const result = await this.createPaymentLinkForMember({
        communityId: community.id,
        memberId: member.id,
        period,
        amount,
        dueDays: params.dueDays ?? 7,
      });
      if (!result.created) {
        skipped.push(member);
        continue;
      }
      created.push(result.invoice);
    }

    await this.log(community.id, "bulk_invoice_created", {
      period,
      amount,
      createdCount: created.length,
      skippedCount: skipped.length,
    });

    return { community, period, created, skipped };
  }

  async checkPendingPayments(communityId?: string) {
    const id = communityId ?? (await this.getActiveCommunityId());
    const pending = await this.listInvoices(id, { status: "pending" });
    const paid: Invoice[] = [];
    const unchanged: Invoice[] = [];

    for (const invoice of pending) {
      const status = await this.doku.checkPaymentStatus(invoice.dokuInvoiceId);
      const normalized = String(status.status).toUpperCase();
      if (normalized === "SUCCESS" || normalized === "PAID") {
        paid.push(await this.markInvoicePaid(invoice.id, status.paidAt));
      } else {
        unchanged.push(invoice);
      }
    }

    await this.log(id, "payment_monitoring_completed", {
      checkedCount: pending.length,
      paidCount: paid.length,
      unchangedCount: unchanged.length,
    });

    return { checked: pending, paid, unchanged };
  }

  async checkPaymentStatus(invoiceId?: string) {
    const pending = await this.listInvoices(undefined, {
      status: "pending",
    });
    const invoice = invoiceId ? await this.getInvoice(invoiceId) : pending[0];
    if (!invoice) {
      throw new Error("Tidak ada invoice pending untuk dicek.");
    }
    const status = await this.doku.checkPaymentStatus(invoice.dokuInvoiceId);
    const normalized = String(status.status).toUpperCase();
    const updated =
      normalized === "SUCCESS" || normalized === "PAID"
        ? await this.markInvoicePaid(invoice.id, status.paidAt)
        : invoice;
    await this.log(invoice.communityId, "payment_status_checked", {
      invoiceId: invoice.id,
      dokuInvoiceId: invoice.dokuInvoiceId,
      status: status.status,
    });
    return { invoice: updated, status };
  }

  async markInvoicePaid(
    invoiceId: string,
    paidAt = new Date().toISOString(),
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice.status === "paid") return invoice;

    await db.updateInvoiceStatus(invoiceId, "paid", paidAt);

    const existingEntry = await db.findKasEntryByReference(invoiceId);
    if (!existingEntry) {
      await db.createKasEntry({
        id: randomUUID(),
        communityId: invoice.communityId,
        type: "income",
        amount: invoice.amount,
        category: "iuran",
        description: `Pembayaran ${invoice.description}`,
        referenceId: invoice.id,
        recordedBy: "agent",
        date: paidAt.slice(0, 10),
      });
    }

    await this.log(invoice.communityId, "invoice_paid", {
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      amount: invoice.amount,
    });

    return { ...invoice, status: "paid", paidAt };
  }

  async simulatePayment(params: { invoiceId?: string; communityId?: string }) {
    const community = await this.getCommunity(params.communityId);
    const pending = await this.listInvoices(community.id, {
      status: "pending",
    });
    const invoice = params.invoiceId
      ? await this.getInvoice(params.invoiceId)
      : pending[0];

    if (!invoice) {
      throw new Error("Tidak ada invoice pending yang bisa disimulasikan.");
    }
    if (invoice.communityId !== community.id) {
      throw new Error("Invoice tidak termasuk komunitas aktif.");
    }

    const paidInvoice = await this.markInvoicePaid(invoice.id);
    await this.log(community.id, "payment_simulated", {
      invoiceId: paidInvoice.id,
      dokuInvoiceId: paidInvoice.dokuInvoiceId,
      amount: paidInvoice.amount,
    });
    return { community, invoice: paidInvoice };
  }

  async markInvoicePaidManual(params: { invoiceId?: string; note?: string }) {
    const pending = await this.listInvoices(undefined, {
      status: "pending",
    });
    const invoice = params.invoiceId
      ? await this.getInvoice(params.invoiceId)
      : pending[0];
    if (!invoice) {
      throw new Error("Tidak ada invoice pending untuk ditandai lunas.");
    }
    const paidInvoice = await this.markInvoicePaid(invoice.id);
    await this.log(invoice.communityId, "invoice_marked_paid_manual", {
      invoiceId: paidInvoice.id,
      note: params.note,
    });
    return paidInvoice;
  }

  async sendPaymentReminders(params: {
    communityId?: string;
    period?: string;
  }) {
    const community = await this.getCommunity(params.communityId);
    const unpaid = await this.listInvoices(community.id, {
      status: "pending",
      month: params.period ?? toMonth(),
    });
    const reminded = unpaid.filter((invoice) => invoice.reminderCount < 3);
    for (const invoice of reminded) {
      await db.incrementReminderCount(invoice.id);
    }
    await this.log(community.id, "reminder_sent", {
      period: params.period ?? toMonth(),
      reminderCount: reminded.length,
    });
    return { community, reminded, skipped: unpaid.length - reminded.length };
  }

  async generateMonthlyReport(
    communityId?: string,
    month = toMonth(),
  ): Promise<MonthlyReport> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const invoices = await this.listInvoices(id, { month });
    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "paid",
    );
    const entries = await this.listKasEntries(id);
    const monthEntries = entries.filter((entry) =>
      entry.date.startsWith(month),
    );
    const totalExpenses = monthEntries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalCollected = paidInvoices.reduce(
      (sum, invoice) => sum + invoice.amount,
      0,
    );
    const paidMembers = new Set(paidInvoices.map((invoice) => invoice.memberId))
      .size;
    const activeMembers = (await this.listMembers(id, true)).length;
    const collectionRate =
      activeMembers === 0
        ? "0%"
        : `${Math.round((paidMembers / activeMembers) * 100)}%`;

    const report: MonthlyReport = {
      communityId: id,
      month,
      totalCollected,
      totalExpenses,
      netBalance: totalCollected - totalExpenses,
      collectionRate,
      paidMembers,
      unpaidMembers: Math.max(activeMembers - paidMembers, 0),
      generatedAt: new Date().toISOString(),
    };
    await this.log(id, "monthly_report_generated", report);
    return report;
  }

  async detectPaymentAnomaly(communityId?: string, month = toMonth()) {
    const id = communityId ?? (await this.getActiveCommunityId());
    const memberRows = await this.listMembers(id, true);
    const members = new Map(memberRows.map((m) => [m.id, m]));
    const invoices = await this.listInvoices(id, { month });
    const anomalies = invoices
      .filter(
        (invoice) =>
          invoice.status === "overdue" ||
          (invoice.status === "pending" && invoice.reminderCount >= 2),
      )
      .map((invoice) => ({
        invoice,
        member: members.get(invoice.memberId),
        reason:
          invoice.status === "overdue"
            ? "Invoice sudah overdue"
            : `Sudah diingatkan ${invoice.reminderCount} kali`,
      }));
    await this.log(id, "payment_anomaly_detected", {
      month,
      anomalyCount: anomalies.length,
    });
    return { month, anomalies };
  }

  async handleDokuWebhook(body: any) {
    const dokuInvoiceId = body?.order?.invoice_number;
    if (!dokuInvoiceId)
      throw new Error("DOKU webhook missing order.invoice_number");

    const invoiceRow = await db.findInvoiceByDokuId(dokuInvoiceId);
    if (!invoiceRow)
      throw new Error(`Invoice not found for DOKU invoice ${dokuInvoiceId}`);

    const status = String(
      body?.transaction?.status ?? body?.payment?.status ?? "",
    ).toUpperCase();
    if (status === "SUCCESS" || status === "PAID") {
      return this.markInvoicePaid(
        invoiceRow.id,
        body?.transaction?.date ?? new Date().toISOString(),
      );
    }
    return rowToInvoice(invoiceRow);
  }

  verifyDokuWebhook(headers: unknown, body: unknown, requestTarget: string) {
    return this.doku.verifyWebhookSignature({ headers, body, requestTarget });
  }

  async getLogs(communityId?: string): Promise<AgentLog[]> {
    const id = communityId ?? (await this.getActiveCommunityId());
    const rows = await db.findLogs(id);
    return rows.map(
      (r) =>
        ({
          id: r.id,
          communityId: r.community_id,
          action: r.action,
          details: r.details,
          createdAt: r.created_at,
        }) as AgentLog,
    );
  }

  private async log(
    communityId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await db.createLog({
      id: randomUUID(),
      communityId,
      action,
      details,
    });
  }
}

export const getKomunitasService = (runtime: IAgentRuntime) => {
  const service = runtime.getService(
    KomunitasService.serviceType,
  ) as KomunitasService | null;
  if (!service) throw new Error("KomunitasAI service is not registered");
  return service;
};

// Local copy of sanitizeInvoiceNumber to avoid circular deps
const sanitizeInvoiceNumberLocal = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").slice(0, 30);
