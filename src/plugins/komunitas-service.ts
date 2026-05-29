import { type IAgentRuntime, logger, Service } from "@elizaos/core";
import { generateTextSafe } from "./helpers.ts";
import { randomUUID } from "node:crypto";
import * as db from "../database/db.ts";
import { DokuMcpClient } from "./doku-mcp-client.ts";
import { loadWahaConfig, WahaClient } from "./waha-client.ts";
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
  readonly wahaClient: WahaClient;

  constructor(
    runtime?: IAgentRuntime,
    config: KomunitasConfig = loadKomunitasConfig(),
  ) {
    super(runtime);
    this.komunitasConfig = config;
    this.doku = new DokuMcpClient(config);
    this.wahaClient = new WahaClient(loadWahaConfig());
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

  async setWorkflowSchedule(
    communityId: string,
    intervalMs: number,
    requester?: { phone?: string; channel?: string },
  ): Promise<void> {
    await db.upsertWorkflowSchedule({
      communityId,
      intervalMs,
      isActive: true,
      requesterPhone: requester?.phone,
      requesterChannel: requester?.channel,
    });
  }

  async cancelWorkflowSchedule(communityId: string): Promise<void> {
    await db.deactivateWorkflowSchedule(communityId);
  }

  async getSchedulerStatus(communityId: string): Promise<boolean> {
    const schedule = await db.getWorkflowSchedule(communityId);
    return Boolean(schedule?.is_active);
  }

  async recordScheduledWorkflowCompleted(
    communityId: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    await db.updateNextRunAt(communityId);
    await this.log(communityId, "scheduled_workflow_completed", result);
  }

  async rememberWorkflowRequester(
    communityId: string,
    requester?: { phone?: string; channel?: string },
  ): Promise<void> {
    if (!requester?.phone) return;
    await this.log(communityId, "workflow_requester_registered", {
      phone: requester.phone,
      channel: requester.channel ?? "whatsapp",
    });
  }

  isDokuConfigured() {
    return this.doku.isConfigured;
  }

  async listDokuMcpTools() {
    return this.doku.listTools();
  }

  async callDokuMcpTool(
    toolName: string,
    toolRequest: Record<string, unknown> = {},
  ) {
    return this.doku.callRawTool(toolName, toolRequest);
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
      `KAI${period.replace("-", "")}${randomUUID().slice(0, 8)}`,
    );
    const description = `Iuran ${community.name} ${period}`;

    let paymentUrl = "";
    let dokuInvoiceId = invoiceNumber;
    let dokuRequestId = randomUUID() as string;

    try {
      const payment = await this.doku.createPaymentLink({
        invoiceNumber,
        amount,
        description,
        customerName: String(member.name ?? "Customer"),
        customerPhone: member.phone,
        dueMinutes: dueDays * 24 * 60,
      });
      paymentUrl = payment.paymentUrl;
      dokuInvoiceId = payment.invoiceNumber;
      dokuRequestId = payment.requestId;
    } catch (e) {
      logger.warn(
        {
          memberId: member.id,
          error: e instanceof Error ? e.message : String(e),
        },
        "DOKU payment link creation failed, creating invoice without payment link",
      );
    }

    const invoiceRow = await db.createInvoice({
      id: randomUUID(),
      communityId: community.id,
      memberId: member.id,
      amount,
      description,
      period,
      dueDate: addDays(new Date(), dueDays).toISOString().slice(0, 10),
      paymentLink: paymentUrl,
      dokuInvoiceId,
      dokuRequestId,
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

  async createDirectPaymentForMember(params: {
    communityId?: string;
    memberId?: string;
    period?: string;
    amount?: number;
    dueDays?: number;
    method: "qris" | "va";
    bank?: string;
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
    const amount = params.amount ?? community.monthlyFee;
    const dueDays = params.dueDays ?? 7;
    const invoiceNumber = sanitizeInvoiceNumberLocal(
      `KAI${period.replace("-", "")}${params.method.toUpperCase()}${randomUUID().slice(0, 6)}`,
    );
    const description =
      params.method === "qris"
        ? `QRIS ${community.name} ${period}`
        : `VA ${params.bank?.toUpperCase() ?? "BANK"} ${community.name} ${period}`;

    const payment =
      params.method === "qris"
        ? await this.doku.createQrisPayment({
            invoiceNumber,
            amount,
            customerName: String(member.name ?? "Customer"),
          })
        : await this.doku.createVirtualAccount({
            invoiceNumber,
            amount,
            customerName: String(member.name ?? "Customer"),
            customerEmail: member.email,
            bank: params.bank ?? "BCA",
          });

    const instruction =
      payment.paymentUrl ??
      payment.paymentCode ??
      payment.qrString ??
      payment.paymentInstruction;

    const invoiceRow = await db.createInvoice({
      id: randomUUID(),
      communityId: community.id,
      memberId: member.id,
      amount,
      description,
      period,
      dueDate: addDays(new Date(), dueDays).toISOString().slice(0, 10),
      paymentLink: instruction,
      dokuInvoiceId: payment.invoiceNumber,
      dokuRequestId: payment.requestId,
    });
    const invoice = rowToInvoice(invoiceRow);
    await this.log(community.id, "direct_payment_created", {
      invoiceId: invoice.id,
      memberId: member.id,
      method: params.method,
      bank: params.bank,
      amount,
      dokuInvoiceId: payment.invoiceNumber,
    });

    return { community, member, invoice, payment, method: params.method };
  }

  async bulkCreateInvoices(params: {
    communityId?: string;
    period?: string;
    amount?: number;
    dueDays?: number;
    runtime?: IAgentRuntime;
  }) {
    const community = await this.getCommunity(params.communityId);
    const period = params.period ?? toMonth();
    const amount = params.amount ?? community.monthlyFee;
    const members = await this.listMembers(community.id, true);
    const created: Invoice[] = [];
    const skipped: Member[] = [];
    const errors: Array<{ member: Member; error: string }> = [];
    let waSent = 0;
    let waSkippedDuplicate = 0;
    let waFailed = 0;

    const waTemplate = `Halo {{nama}}! 👋\n\nTagihan ${community.name} bulan {{periode}} sebesar {{nominal}} telah dibuat.\n\n💳 {{link}}\n\nTerima kasih 🙏`;
    let aiWaTemplate: string | null = null;
    if (
      process.env.KOMUNITAS_USE_AI_WA_TEMPLATE === "true" &&
      params.runtime &&
      this.wahaClient.isConfigured
    ) {
      try {
        aiWaTemplate =
          (await generateTextSafe(
            params.runtime,
            `Kamu adalah bendahara digital komunitas "${community.name}" (tipe: ${community.type}).
Buat pesan WhatsApp singkat dan natural untuk memberitahu anggota bahwa tagihan mereka sudah dibuat.
Pesan harus:
- Sesuai konteks komunitas (RT/arisan/koperasi/event/patungan)
- Menyebut nama anggota sebagai {{nama}}
- Menyebut nominal sebagai {{nominal}}
- Menyebut periode sebagai {{periode}}
- Menyebut link pembayaran sebagai {{link}}
- Singkat, ramah, natural seperti pesan WhatsApp asli
- Boleh pakai emoji secukupnya
Jawab HANYA dengan teks pesan, tanpa penjelasan.`,
          )) || null;
      } catch {
        aiWaTemplate = null;
      }
    }

    await mapWithConcurrency(
      members,
      getPositiveIntEnv("KOMUNITAS_BULK_CONCURRENCY", 4),
      async (member) => {
        try {
          const result = await this.createPaymentLinkForMember({
            communityId: community.id,
            memberId: member.id,
            period,
            amount,
            dueDays: params.dueDays ?? 7,
          });
          if (!result.created) {
            skipped.push(member);
            return;
          }
          created.push(result.invoice);

          if (this.wahaClient.isConfigured && member.phone) {
            const inv = result.invoice;
            const waMsg = (aiWaTemplate ?? waTemplate)
              .replace(/\{\{nama\}\}/g, member.name)
              .replace(/\{\{nominal\}\}/g, rupiah(amount))
              .replace(/\{\{periode\}\}/g, period)
              .replace(/\{\{link\}\}/g, inv.paymentLink || "-");
            const delivery = await this.sendWhatsAppOnce({
              communityId: community.id,
              notificationKey: `invoice-created:${community.id}:${member.id}:${period}:${amount}`,
              phone: member.phone,
              text: waMsg,
              logAction: "invoice_notification_sent",
              logDetails: {
                invoiceId: inv.id,
                memberId: member.id,
                period,
                channel: "whatsapp",
              },
              failureLogAction: "invoice_notification_failed",
              failureLogDetails: {
                invoiceId: inv.id,
                memberId: member.id,
                period,
              },
            });
            if (delivery === "sent") waSent += 1;
            if (delivery === "skipped") waSkippedDuplicate += 1;
            if (delivery === "failed") waFailed += 1;
          }
        } catch (error) {
          errors.push({
            member,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    await this.log(community.id, "bulk_invoice_created", {
      period,
      amount,
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      waSent,
      waSkippedDuplicate,
      waFailed,
    });

    return { community, period, created, skipped, errors };
  }

  async checkPendingPayments(communityId?: string) {
    const id = communityId ?? (await this.getActiveCommunityId());
    const pending = await this.listInvoices(id, { status: "pending" });
    const paid: Invoice[] = [];
    const unchanged: Invoice[] = [];

    await mapWithConcurrency(
      pending,
      getPositiveIntEnv("KOMUNITAS_DOKU_STATUS_CONCURRENCY", 4),
      async (invoice) => {
        try {
          const status = await this.doku.checkPaymentStatus(
            invoice.dokuInvoiceId,
          );
          const normalized = String(status.status).toUpperCase();
          if (normalized === "SUCCESS" || normalized === "PAID") {
            paid.push(await this.markInvoicePaid(invoice.id, status.paidAt));
          } else {
            unchanged.push(invoice);
          }
        } catch (error) {
          logger.warn(
            {
              invoiceId: invoice.id,
              dokuInvoiceId: invoice.dokuInvoiceId,
              error: error instanceof Error ? error.message : String(error),
            },
            "DOKU payment status check failed, continuing with next invoice",
          );
          unchanged.push(invoice);
        }
      },
    );

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
    const community = await this.getCommunity(invoice.communityId);
    const memberRow = await db.findMember(invoice.memberId);
    const member = memberRow ? rowToMember(memberRow) : undefined;

    const existingEntry = await db.findKasEntryByReference(invoiceId);
    if (!existingEntry) {
      await db.markInvoicePaidAtomic(invoiceId, paidAt, {
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
    } else {
      await db.updateInvoiceStatus(invoiceId, "paid", paidAt);
    }

    await this.log(invoice.communityId, "invoice_paid", {
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      amount: invoice.amount,
      memberName: member?.name,
    });

    const paidInvoice = { ...invoice, status: "paid" as const, paidAt };
    await this.notifyInvoicePaid(community, member, paidInvoice);
    return paidInvoice;
  }

  private async notifyInvoicePaid(
    community: Community,
    member: Member | undefined,
    invoice: Invoice,
  ): Promise<void> {
    if (!this.wahaClient.isConfigured) return;
    const adminPhones = await this.getPaymentObserverPhones(community.id);
    const memberMessage = [
      `✅ Pembayaran diterima`,
      ``,
      `Halo ${member?.name ?? "Member"}, pembayaran tagihan ${community.name} sudah tercatat lunas.`,
      `Nominal: ${rupiah(invoice.amount)}`,
      `Invoice: ${invoice.dokuInvoiceId}`,
      `Dibayar pada: ${new Date(invoice.paidAt ?? new Date()).toLocaleString("id-ID")}`,
      ``,
      `Terima kasih 🙏`,
    ].join("\n");

    if (member?.phone) {
      await this.sendWhatsAppOnce({
        communityId: community.id,
        notificationKey: `payment-confirmation:${invoice.id}:member:${member.id}`,
        phone: member.phone,
        text: memberMessage,
        logAction: "payment_confirmation_sent",
        logDetails: {
          invoiceId: invoice.id,
          memberId: member.id,
          recipient: "member",
          channel: "whatsapp",
        },
        failureLogAction: "payment_confirmation_failed",
        failureLogDetails: {
          invoiceId: invoice.id,
          memberId: member.id,
          recipient: "member",
        },
      });
    }

    const adminMessage = [
      `✅ Pembayaran sukses`,
      ``,
      `${member?.name ?? "Member"} sudah membayar tagihan ${community.name}.`,
      `Nominal: ${rupiah(invoice.amount)}`,
      `Periode: ${invoice.period}`,
      `Invoice: ${invoice.dokuInvoiceId}`,
      `Dibayar pada: ${new Date(invoice.paidAt ?? new Date()).toLocaleString("id-ID")}`,
    ].join("\n");

    for (const adminPhone of adminPhones) {
      await this.sendWhatsAppOnce({
        communityId: community.id,
        notificationKey: `payment-confirmation:${invoice.id}:admin:${adminPhone}`,
        phone: adminPhone,
        text: adminMessage,
        logAction: "payment_admin_notification_sent",
        logDetails: {
          invoiceId: invoice.id,
          memberId: member?.id,
          recipient: "admin",
          adminPhone,
          channel: "whatsapp",
        },
        failureLogAction: "payment_admin_notification_failed",
        failureLogDetails: {
          invoiceId: invoice.id,
          memberId: member?.id,
          recipient: "admin",
          adminPhone,
        },
      });
    }
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
    const demoMode = process.env.WORKFLOW_DEMO_MODE === "true";
    const unpaid = await this.listInvoices(community.id, {
      status: "pending",
      month: params.period ?? toMonth(),
    });
    const reminded = demoMode
      ? unpaid
      : unpaid.filter((invoice) => invoice.reminderCount < 3);
    const members = new Map(
      (await this.listMembers(community.id, false)).map((member) => [
        member.id,
        member,
      ]),
    );
    let waSent = 0;
    let waFailed = 0;
    let waSkippedDuplicate = 0;

    for (const invoice of reminded) {
      const member = members.get(invoice.memberId);
      if (!this.wahaClient.isConfigured || !member?.phone) {
        await db.incrementReminderCount(invoice.id);
        continue;
      }

      const message = `Halo ${member.name}! 👋 Reminder iuran ${community.name} bulan ${invoice.period} sebesar ${rupiah(invoice.amount)} belum dibayar. Link pembayaran: ${invoice.paymentLink}. Terima kasih 🙏`;
      const delivery = await this.sendWhatsAppOnce({
        communityId: community.id,
        notificationKey: `reminder:${community.id}:${invoice.id}:${invoice.reminderCount + 1}`,
        phone: member.phone,
        text: message,
        logAction: "reminder_notification_sent",
        logDetails: {
          invoiceId: invoice.id,
          memberId: member.id,
          reminderNumber: invoice.reminderCount + 1,
          channel: "whatsapp",
        },
        failureLogAction: "reminder_notification_failed",
        failureLogDetails: {
          invoiceId: invoice.id,
          memberId: member.id,
          reminderNumber: invoice.reminderCount + 1,
        },
      });
      if (delivery === "sent") {
        await db.incrementReminderCount(invoice.id);
        waSent += 1;
      } else if (delivery === "failed") {
        waFailed += 1;
      } else {
        waSkippedDuplicate += 1;
      }
    }
    await this.log(community.id, "reminder_sent", {
      period: params.period ?? toMonth(),
      reminderCount: reminded.length,
      waSent,
      waFailed,
      waSkippedDuplicate,
      demoMode,
    });
    return {
      community,
      reminded,
      skipped: unpaid.length - reminded.length,
      waSent,
      waFailed,
      waSkippedDuplicate,
    };
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

  private async sendWhatsAppOnce(params: {
    communityId: string;
    notificationKey: string;
    phone: string;
    text: string;
    logAction?: string;
    logDetails?: Record<string, unknown>;
    failureLogAction?: string;
    failureLogDetails?: Record<string, unknown>;
  }): Promise<"sent" | "skipped" | "failed"> {
    const claimed = await db.claimNotificationDelivery({
      id: randomUUID(),
      communityId: params.communityId,
      notificationKey: params.notificationKey,
      channel: "whatsapp",
    });

    if (!claimed) {
      logger.info(
        { notificationKey: params.notificationKey },
        "WhatsApp notification skipped because it was already claimed",
      );
      return "skipped";
    }

    try {
      await this.wahaClient.sendText(params.phone, params.text);
      await db.updateNotificationDeliveryStatus(params.notificationKey, "sent");
      if (params.logAction) {
        await this.log(params.communityId, params.logAction, {
          ...(params.logDetails ?? {}),
          notificationKey: params.notificationKey,
        });
      }
      return "sent";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.updateNotificationDeliveryStatus(
        params.notificationKey,
        "failed",
        message,
      );
      logger.warn(
        { notificationKey: params.notificationKey, error: message },
        "WAHA notification delivery failed",
      );
      if (params.failureLogAction) {
        await this.log(params.communityId, params.failureLogAction, {
          ...(params.failureLogDetails ?? {}),
          notificationKey: params.notificationKey,
          error: message,
        });
      }
      return "failed";
    }
  }

  private async getPaymentObserverPhones(communityId: string) {
    const phones = new Set(getAdminWhatsAppPhones());
    try {
      const schedule = await db.getWorkflowSchedule(communityId);
      if (schedule?.requester_phone) phones.add(schedule.requester_phone);
    } catch (error) {
      logger.warn(
        {
          communityId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to load workflow requester notification target",
      );
    }
    try {
      const logs = await db.findLogs(communityId);
      for (const log of logs) {
        if (log.action !== "workflow_requester_registered") continue;
        const phone = log.details?.phone;
        if (typeof phone === "string" && phone.trim()) phones.add(phone.trim());
      }
    } catch (error) {
      logger.warn(
        {
          communityId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to load workflow requester logs",
      );
    }
    return [...phones];
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

const getAdminWhatsAppPhones = () =>
  (
    process.env.KOMUNITAS_ADMIN_WHATSAPP ||
    process.env.KOMUNITAS_ADMIN_WHATSAPP_NUMBERS ||
    process.env.ADMIN_WHATSAPP_PHONE ||
    ""
  )
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);

function getPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}
