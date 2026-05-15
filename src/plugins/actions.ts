import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
} from "@elizaos/core";
import { getKomunitasService, KomunitasService } from "./komunitas-service.ts";
import {
  getKasEntryTypeOption,
  getNumberOption,
  getStringOption,
  handleOnboardingError,
  validateHasCommunity,
  rupiah,
  sendCallback,
  toMonth,
} from "./helpers.ts";
import * as dbModule from "../database/db.ts";

const pendingResetConfirmations = new Map<
  string,
  { communityId: string; ts: number }
>();

const FIVE_MINUTES = 5 * 60 * 1000;

function hasResetKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("hapus data") ||
    lower.includes("hapus semua") ||
    lower.includes("hapus transaksi") ||
    lower.includes("reset data") ||
    lower.includes("bersihkan data") ||
    lower.includes("flush database") ||
    lower.includes("clear data") ||
    lower.includes("kosongkan data") ||
    lower === "hapus" ||
    lower === "reset" ||
    lower === "bersihkan" ||
    lower === "flush" ||
    lower === "kosongkan"
  );
}

// ── GET_ALL_MEMBERS ─────────────────────────────────────────────────────

export const getAllMembersAction: Action = {
  name: "GET_ALL_MEMBERS",
  similes: ["LIST_MEMBERS", "CEK_ANGGOTA", "DAFTAR_ANGGOTA"],
  description: "Lists all active members in the active community.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const members = await service.listMembers(
      getStringOption(options, "communityId"),
      true,
    );
    const rows = members.map(
      (member, index) =>
        `${index + 1}. ${member.name}${member.phone ? ` (${member.phone})` : ""}`,
    );
    const text = members.length
      ? `Ada ${members.length} anggota aktif:\n\n${rows.join("\n")}`
      : "Belum ada anggota aktif di komunitas ini.";
    await sendCallback(callback, message, text, ["GET_ALL_MEMBERS"]);
    return { success: true, data: { members } };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Tampilkan semua anggota" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek daftar anggota aktif.",
          actions: ["GET_ALL_MEMBERS"],
        },
      },
    ],
  ],
};

// ── CREATE_PAYMENT_LINK ─────────────────────────────────────────────────

export const createPaymentLinkAction: Action = {
  name: "CREATE_PAYMENT_LINK",
  similes: ["CREATE_SINGLE_INVOICE", "BUAT_PAYMENT_LINK", "TAGIH_ANGGOTA"],
  description: "Creates one DOKU Checkout payment link for an active member.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.createPaymentLinkForMember({
        communityId: getStringOption(options, "communityId"),
        memberId: getStringOption(options, "memberId"),
        period: getStringOption(options, "period"),
        amount: getNumberOption(options, "amount"),
        dueDays: getNumberOption(options, "dueDays"),
      });
      const text = result.created
        ? `Payment link DOKU dibuat untuk ${result.member.name}: ${rupiah(result.invoice.amount)}. Link: ${result.invoice.paymentLink}`
        : `${result.member.name} sudah punya invoice periode ${result.invoice.period}. Link: ${result.invoice.paymentLink}`;
      await sendCallback(callback, message, text, ["CREATE_PAYMENT_LINK"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(
        callback,
        message,
        `Gagal membuat payment link: ${text}`,
        ["CREATE_PAYMENT_LINK"],
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Buat payment link untuk anggota" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku buat satu payment link DOKU.",
          actions: ["CREATE_PAYMENT_LINK"],
        },
      },
    ],
  ],
};

// ── BULK_CREATE_INVOICES ────────────────────────────────────────────────

export const bulkCreateInvoicesAction: Action = {
  name: "BULK_CREATE_INVOICES",
  similes: ["TAGIH_IURAN", "CREATE_PAYMENT_LINKS", "BULK_BILLING"],
  description:
    "Creates DOKU Checkout payment links for all active community members.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.bulkCreateInvoices({});
      const total = result.created.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      );
      const text = `Selesai. ${result.created.length} tagihan DOKU dibuat untuk ${result.community.name}. Total tagihan ${rupiah(total)}. ${result.skipped.length} anggota dilewati karena sudah punya invoice periode ini.`;
      await sendCallback(callback, message, text, ["BULK_CREATE_INVOICES"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(callback, message, `Gagal membuat tagihan: ${text}`, [
        "BULK_CREATE_INVOICES",
      ]);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Tagih semua warga iuran bulan ini" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku buatkan tagihan DOKU untuk semua anggota aktif.",
          actions: ["BULK_CREATE_INVOICES"],
        },
      },
    ],
  ],
};

// ── CHECK_PAYMENT_STATUS ────────────────────────────────────────────────

export const checkPaymentStatusAction: Action = {
  name: "CHECK_PAYMENT_STATUS",
  similes: ["CEK_STATUS_PEMBAYARAN", "MONITOR_PAYMENT", "CHECK_DOKU_STATUS"],
  description: "Checks a pending invoice payment status through DOKU.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.checkPaymentStatus(
        getStringOption(options, "invoiceId"),
      );
      const text = `Status DOKU untuk invoice ${result.invoice.id}: ${String(result.status.status)}. Status lokal sekarang ${result.invoice.status}.`;
      await sendCallback(callback, message, text, ["CHECK_PAYMENT_STATUS"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(
        callback,
        message,
        `Gagal cek status pembayaran: ${text}`,
        ["CHECK_PAYMENT_STATUS"],
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Cek status pembayaran DOKU" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek status invoice pending ke DOKU.",
          actions: ["CHECK_PAYMENT_STATUS"],
        },
      },
    ],
  ],
};

// ── RUN_MONITORING_LOOP ─────────────────────────────────────────────────

export const runMonitoringLoopAction: Action = {
  name: "RUN_MONITORING_LOOP",
  similes: ["CHECK_PENDING_PAYMENTS", "RUN_PAYMENT_MONITORING_LOOP"],
  description: "Runs payment monitoring for all pending invoices.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.checkPendingPayments(
        getStringOption(options, "communityId"),
      );
      const text = `Monitoring selesai. Dicek ${result.checked.length} invoice, ${result.paid.length} terdeteksi lunas, ${result.unchanged.length} masih pending.`;
      await sendCallback(callback, message, text, ["RUN_MONITORING_LOOP"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(callback, message, `Monitoring gagal: ${text}`, [
        "RUN_MONITORING_LOOP",
      ]);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Jalankan monitoring pembayaran" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek semua invoice pending ke DOKU.",
          actions: ["RUN_MONITORING_LOOP"],
        },
      },
    ],
  ],
};

// ── SIMULATE_PAYMENT ────────────────────────────────────────────────────

export const simulatePaymentAction: Action = {
  name: "SIMULATE_PAYMENT",
  similes: ["SIMULASI_BAYAR", "DEMO_PAYMENT", "SIMULATE_DOKU_WEBHOOK"],
  description: "Marks a pending invoice as paid for local demo simulation.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.simulatePayment({
        communityId: getStringOption(options, "communityId"),
        invoiceId: getStringOption(options, "invoiceId"),
      });
      const text = `Simulasi pembayaran berhasil. Invoice ${result.invoice.id} ditandai lunas dan kas bertambah ${rupiah(result.invoice.amount)}.`;
      await sendCallback(callback, message, text, ["SIMULATE_PAYMENT"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(
        callback,
        message,
        `Simulasi pembayaran gagal: ${text}`,
        ["SIMULATE_PAYMENT"],
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Simulasikan pembayaran masuk" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku tandai satu invoice pending sebagai lunas untuk demo.",
          actions: ["SIMULATE_PAYMENT"],
        },
      },
    ],
  ],
};

// ── GET_UNPAID_INVOICES ─────────────────────────────────────────────────

export const getUnpaidInvoicesAction: Action = {
  name: "GET_UNPAID_INVOICES",
  similes: ["CEK_BELUM_BAYAR", "WHO_IS_UNPAID", "LIST_PENDING_INVOICES"],
  description: "Lists members with pending invoices for the current month.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const invoices = await service.listInvoices(community.id, {
      status: "pending",
      month: toMonth(),
    });
    const memberList = await service.listMembers(community.id);
    const members = new Map(memberList.map((m) => [m.id, m]));
    const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const rows = invoices.map(
      (invoice, index) =>
        `${index + 1}. ${members.get(invoice.memberId)?.name ?? invoice.memberId} - ${rupiah(invoice.amount)}`,
    );
    const text = invoices.length
      ? `Ada ${invoices.length} anggota yang belum bayar bulan ini.\n\n${rows.join("\n")}\n\nTotal belum terkumpul: ${rupiah(total)}.`
      : "Semua invoice bulan ini sudah lunas atau belum ada invoice pending.";
    await sendCallback(callback, message, text, ["GET_UNPAID_INVOICES"]);
    return { success: true, data: { invoices } };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Siapa yang belum bayar iuran bulan ini?" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek invoice pending bulan ini.",
          actions: ["GET_UNPAID_INVOICES"],
        },
      },
    ],
  ],
};

// ── SEND_PAYMENT_REMINDERS ──────────────────────────────────────────────

export const sendReminderAction: Action = {
  name: "SEND_PAYMENT_REMINDERS",
  similes: ["KIRIM_REMINDER", "REMIND_UNPAID_MEMBERS"],
  description:
    "Increments reminder counters for pending invoices and records reminder logs.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const result = await service.sendPaymentReminders({});
    const text = `Reminder disiapkan untuk ${result.reminded.length} invoice pending. ${result.skipped} invoice dilewati karena sudah mencapai batas reminder.`;
    await sendCallback(callback, message, text, ["SEND_PAYMENT_REMINDERS"]);
    return { success: true, data: result };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Kirim reminder ke semua yang belum bayar" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku kirim reminder ke invoice yang masih pending.",
          actions: ["SEND_PAYMENT_REMINDERS"],
        },
      },
    ],
  ],
};

// ── GET_KAS_SUMMARY ─────────────────────────────────────────────────────

export const getKasSummaryAction: Action = {
  name: "GET_KAS_SUMMARY",
  similes: ["CEK_SALDO_KAS", "KAS_SUMMARY", "SALDO_KOMUNITAS"],
  description: "Returns the current cash balance summary.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const input = (message.content.text ?? "").trim();
    const resetType = getStringOption(options, "type");

    const isPendingConfirmation = await dbModule.getOnboardingState(
      `reset_confirm_${runtime.agentId}`,
    );

    if (!isPendingConfirmation) {
      const invoices = await service.listInvoices(community.id);
      const members = await service.listMembers(community.id);
      await dbModule.setOnboardingState(`reset_confirm_${runtime.agentId}`, {
        pending: true,
        communityId: community.id,
      });
      const text = [
        `⚠️ Kamu mau bersihkan data apa untuk komunitas **"${community.name}"**?`,
        ``,
        `**Opsi 1 — Hapus transaksi saja** (anggota tetap ada):`,
        `- ${invoices.length} invoice`,
        `- Semua catatan kas & log aktivitas`,
        `→ Balas: **"hapus transaksi saja"**`,
        ``,
        `**Opsi 2 — Hapus semua data** (termasuk ${members.length} anggota & komunitas):`,
        `→ Balas: **"hapus semua data"**`,
        ``,
        `Atau balas **"batal"** untuk membatalkan.`,
      ].join("\n");
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
      return { success: true, data: { awaitingConfirmation: true } };
    }

    await dbModule.clearOnboardingState(`reset_confirm_${runtime.agentId}`);

    const intent =
      resetType === "all"
        ? "confirm_all"
        : resetType === "transactions"
          ? "confirm_transactions"
          : await classifyResetIntent(runtime, input);

    if (intent === "cancel" || intent === "unknown") {
      const text =
        intent === "cancel"
          ? `Oke, tidak jadi hapus data. Data komunitas "${community.name}" tetap aman. 😊`
          : `Tidak yakin maksudnya apa. Data tidak dihapus. Ketik "hapus data komunitas" untuk mulai ulang.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
      return { success: true, data: { cancelled: true } };
    }

    if (intent === "confirm_all") {
      await dbModule.resetCommunityData(community.id);
      await dbModule.clearOnboardingState(runtime.agentId);
      const text = `✅ Semua data komunitas "${community.name}" telah dihapus. Ketik "buat komunitas baru" untuk setup ulang.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
    } else {
      await dbModule.resetCommunityTransactions(community.id);
      const text = `✅ Data transaksi komunitas "${community.name}" telah dibersihkan. Anggota dan komunitas tetap ada.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
    }

    return {
      success: true,
      data: { reset: true, intent, communityId: community.id },
    };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Berapa saldo kas sekarang?" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek saldo kas komunitas.",
          actions: ["GET_KAS_SUMMARY"],
        },
      },
    ],
  ],
};

// ── ANSWER_KAS_QUERY ────────────────────────────────────────────────────

export const answerKasQueryAction: Action = {
  name: "ANSWER_KAS_QUERY",
  similes: ["JAWAB_PERTANYAAN_KAS", "QUERY_KAS", "TANYA_SALDO"],
  description:
    "Answers natural language cash summary questions using actual kas data.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const summary = await service.getKasSummary(community.id);
    const allEntries = await service.listKasEntries(community.id);
    const entries = allEntries.slice(0, 5);
    const text = [
      `Saldo kas ${community.name} saat ini ${rupiah(summary.currentBalance)}.`,
      `Total pemasukan ${rupiah(summary.totalIncome)} dan pengeluaran ${rupiah(summary.totalExpense)}.`,
      entries.length
        ? `Transaksi terbaru: ${entries
            .map((entry) => `${entry.description} (${rupiah(entry.amount)})`)
            .join("; ")}.`
        : "Belum ada transaksi terbaru.",
    ].join("\n");
    await sendCallback(callback, message, text, ["ANSWER_KAS_QUERY"]);
    return { success: true, data: { summary, entries } };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Kas dipakai untuk apa saja?" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku jawab berdasarkan transaksi kas aktual.",
          actions: ["ANSWER_KAS_QUERY"],
        },
      },
    ],
  ],
};

// ── UPDATE_KAS_BALANCE ──────────────────────────────────────────────────

export const updateKasBalanceAction: Action = {
  name: "UPDATE_KAS_BALANCE",
  similes: ["CATAT_KAS", "TAMBAH_TRANSAKSI_KAS", "RECORD_KAS_ENTRY"],
  description: "Records one income or expense entry in community cash ledger.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const type = getKasEntryTypeOption(options) ?? "expense";
    const amount = getNumberOption(options, "amount") ?? 25000;
    const category =
      getStringOption(options, "category") ??
      (type === "income" ? "pemasukan-manual" : "pengeluaran-manual");
    const description =
      getStringOption(options, "description") ??
      (type === "income"
        ? "Pemasukan manual dari agent"
        : "Pengeluaran manual dari agent");
    const result = await service.updateKasBalance({
      communityId: getStringOption(options, "communityId"),
      type,
      amount,
      category,
      description,
      referenceId: getStringOption(options, "referenceId"),
    });
    const text = `Kas dicatat: ${type === "income" ? "pemasukan" : "pengeluaran"} ${rupiah(amount)} untuk ${category}. Saldo baru ${rupiah(result.newBalance)}.`;
    await sendCallback(callback, message, text, ["UPDATE_KAS_BALANCE"]);
    return { success: true, data: result };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Catat pengeluaran kas" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku catat transaksi kas.",
          actions: ["UPDATE_KAS_BALANCE"],
        },
      },
    ],
  ],
};

// ── MARK_INVOICE_PAID_MANUAL ────────────────────────────────────────────

export const markInvoicePaidManualAction: Action = {
  name: "MARK_INVOICE_PAID_MANUAL",
  similes: ["TANDAI_LUNAS", "MARK_PAID_MANUAL", "BAYAR_TUNAI"],
  description:
    "Marks one pending invoice as paid manually and records kas income once.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const invoice = await service.markInvoicePaidManual({
        invoiceId: getStringOption(options, "invoiceId"),
        note: getStringOption(options, "note"),
      });
      const text = `Invoice ${invoice.id} ditandai lunas manual. Kas bertambah ${rupiah(invoice.amount)}.`;
      await sendCallback(callback, message, text, ["MARK_INVOICE_PAID_MANUAL"]);
      return { success: true, data: { invoice } };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(callback, message, `Gagal tandai lunas: ${text}`, [
        "MARK_INVOICE_PAID_MANUAL",
      ]);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Tandai satu invoice lunas manual" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku tandai invoice pending sebagai lunas manual.",
          actions: ["MARK_INVOICE_PAID_MANUAL"],
        },
      },
    ],
  ],
};

// ── GENERATE_MONTHLY_REPORT ─────────────────────────────────────────────

export const generateMonthlyReportAction: Action = {
  name: "GENERATE_MONTHLY_REPORT",
  similes: ["BUAT_LAPORAN", "MONTHLY_REPORT", "LAPORAN_BULANAN"],
  description: "Generates a monthly finance report for the community.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const report = await service.generateMonthlyReport();
    const text = [
      `Laporan ${report.month} selesai.`,
      `Terkumpul: ${rupiah(report.totalCollected)}.`,
      `Pengeluaran: ${rupiah(report.totalExpenses)}.`,
      `Net bulan ini: ${rupiah(report.netBalance)}.`,
      `Collection rate: ${report.collectionRate} (${report.paidMembers} lunas, ${report.unpaidMembers} belum).`,
    ].join("\n");
    await sendCallback(callback, message, text, ["GENERATE_MONTHLY_REPORT"]);
    return { success: true, data: report };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Buat laporan bulan ini" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku buatkan laporan keuangan bulan ini.",
          actions: ["GENERATE_MONTHLY_REPORT"],
        },
      },
    ],
  ],
};

// ── DETECT_PAYMENT_ANOMALY ──────────────────────────────────────────────

export const detectPaymentAnomalyAction: Action = {
  name: "DETECT_PAYMENT_ANOMALY",
  similes: ["DETEKSI_ANOMALI", "CEK_YANG_SERING_TELAT", "PAYMENT_ANOMALY"],
  description: "Detects overdue or repeatedly reminded pending invoices.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const result = await service.detectPaymentAnomaly(
      getStringOption(options, "communityId"),
      getStringOption(options, "month") ?? toMonth(),
    );
    const rows = result.anomalies.map(
      (item, index) =>
        `${index + 1}. ${item.member?.name ?? item.invoice.memberId} - ${item.reason}`,
    );
    const text = result.anomalies.length
      ? `Ditemukan ${result.anomalies.length} anomali pembayaran:\n\n${rows.join("\n")}`
      : "Belum ada anomali pembayaran untuk periode ini.";
    await sendCallback(callback, message, text, ["DETECT_PAYMENT_ANOMALY"]);
    return { success: true, data: result };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Siapa yang sering telat bayar?" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Aku cek invoice overdue dan reminder berulang.",
          actions: ["DETECT_PAYMENT_ANOMALY"],
        },
      },
    ],
  ],
};

// ── RUN_BILLING_LOOP ────────────────────────────────────────────────────

export const runBillingLoopAction: Action = {
  name: "RUN_BILLING_LOOP",
  similes: ["RUN_MONTHLY_BILLING_LOOP", "JALANKAN_LOOP_TAGIHAN"],
  description: "Runs the manual monthly billing loop for demo.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const result = await service.bulkCreateInvoices({
        communityId: getStringOption(options, "communityId"),
        period: getStringOption(options, "period"),
        amount: getNumberOption(options, "amount"),
        dueDays: getNumberOption(options, "dueDays"),
      });
      const total = result.created.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      );
      const text = `Billing loop selesai. ${result.created.length} invoice dibuat, ${result.skipped.length} dilewati, total ${rupiah(total)}.`;
      await sendCallback(callback, message, text, ["RUN_BILLING_LOOP"]);
      return { success: true, data: result };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(callback, message, `Billing loop gagal: ${text}`, [
        "RUN_BILLING_LOOP",
      ]);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Jalankan billing loop" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku jalankan loop billing bulanan.",
          actions: ["RUN_BILLING_LOOP"],
        },
      },
    ],
  ],
};

// ── RUN_REPORT_LOOP ─────────────────────────────────────────────────────

export const runReportLoopAction: Action = {
  name: "RUN_REPORT_LOOP",
  similes: ["RUN_MONTHLY_REPORT_LOOP", "JALANKAN_LOOP_LAPORAN"],
  description: "Runs the manual monthly report loop for demo.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const report = await service.generateMonthlyReport(
      getStringOption(options, "communityId"),
      getStringOption(options, "month") ?? toMonth(),
    );
    const text = `Report loop selesai. Terkumpul ${rupiah(report.totalCollected)}, pengeluaran ${rupiah(report.totalExpenses)}, collection rate ${report.collectionRate}.`;
    await sendCallback(callback, message, text, ["RUN_REPORT_LOOP"]);
    return { success: true, data: report };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Jalankan report loop" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku jalankan loop laporan bulanan.",
          actions: ["RUN_REPORT_LOOP"],
        },
      },
    ],
  ],
};

// ── CALCULATE_SPLIT_BILL ────────────────────────────────────────────────

export const calculateSplitBillAction: Action = {
  name: "CALCULATE_SPLIT_BILL",
  similes: ["HITUNG_PATUNGAN", "SPLIT_BILL", "BAGI_BIAYA", "HITUNG_BAGI_RATA"],
  description:
    "Calculates split bill — divides total expenses equally among active members and shows who owes what.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const members = await service.listMembers(community.id, true);
    const entries = await service.listKasEntries(community.id);
    const summary = await service.getKasSummary(community.id);

    const totalExpense = summary.totalExpense;
    const totalIncome = summary.totalIncome;
    const perPerson =
      members.length > 0 ? Math.ceil(totalExpense / members.length) : 0;
    const invoices = await service.listInvoices(community.id, {
      status: "paid",
    });
    const paidMemberIds = new Set(invoices.map((inv) => inv.memberId));

    const rows = members.map((m, i) => {
      const hasPaid = paidMemberIds.has(m.id);
      return `${i + 1}. ${m.name} — ${hasPaid ? "sudah bayar" : `belum bayar ${rupiah(perPerson)}`}`;
    });

    const text = [
      `Ringkasan patungan ${community.name}:`,
      `Total pengeluaran: ${rupiah(totalExpense)}`,
      `Total terkumpul: ${rupiah(totalIncome)}`,
      `Jumlah peserta: ${members.length} orang`,
      `Bagian per orang: ${rupiah(perPerson)}`,
      ``,
      `Status pembayaran:`,
      ...rows,
      ``,
      `Sisa yang belum terkumpul: ${rupiah(Math.max(totalExpense - totalIncome, 0))}`,
    ].join("\n");

    await sendCallback(callback, message, text, ["CALCULATE_SPLIT_BILL"]);
    return {
      success: true,
      data: { totalExpense, totalIncome, perPerson, members: members.length },
    };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Hitung patungan" } },
      {
        name: "{{name2}}",
        content: {
          text: "Aku hitung pembagian biaya untuk semua peserta.",
          actions: ["CALCULATE_SPLIT_BILL"],
        },
      },
    ],
  ],
};

// ── FULL_BILLING_WORKFLOW ───────────────────────────────────────────────

export const fullBillingWorkflowAction: Action = {
  name: "FULL_BILLING_WORKFLOW",
  similes: [
    "JALANKAN_WORKFLOW",
    "FULL_WORKFLOW",
    "AUTONOMOUS_BILLING",
    "TAGIH_DAN_LAPORAN",
  ],
  description:
    "Autonomous multi-step workflow: create invoices → check payments → send reminders → generate report.",
  validate: validateHasCommunity,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const steps: Record<string, unknown>[] = [];

    let invoiceCount = 0;
    let paidCount = 0;
    let reminderCount = 0;
    let collectionRate = "0%";

    try {
      const billing = await service.bulkCreateInvoices({});
      invoiceCount = billing.created.length;
      steps.push({
        step: "billing",
        created: invoiceCount,
        skipped: billing.skipped.length,
      });
    } catch (e) {
      steps.push({
        step: "billing",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const monitoring = await service.checkPendingPayments();
      paidCount = monitoring.paid.length;
      steps.push({
        step: "monitoring",
        paid: paidCount,
        unchanged: monitoring.unchanged.length,
      });
    } catch (e) {
      steps.push({
        step: "monitoring",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const reminders = await service.sendPaymentReminders({});
      reminderCount = reminders.reminded.length;
      steps.push({ step: "reminders", sent: reminderCount });
    } catch (e) {
      steps.push({
        step: "reminders",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const report = await service.generateMonthlyReport();
      collectionRate = report.collectionRate;
      steps.push({
        step: "report",
        collectionRate,
        totalCollected: report.totalCollected,
      });
    } catch (e) {
      steps.push({
        step: "report",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const text = `Workflow selesai: ${invoiceCount} invoice dibuat, ${paidCount} sudah bayar, ${reminderCount} reminder dikirim. Collection rate: ${collectionRate}.`;
    await sendCallback(callback, message, text, ["FULL_BILLING_WORKFLOW"]);
    return { success: true, data: { steps } };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Jalankan workflow billing lengkap" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Menjalankan workflow otonom: tagih → cek bayar → reminder → laporan.",
          actions: ["FULL_BILLING_WORKFLOW"],
        },
      },
    ],
  ],
};

type ResetIntent =
  | "confirm_transactions"
  | "confirm_all"
  | "cancel"
  | "unknown";

async function classifyResetIntent(
  runtime: IAgentRuntime,
  userInput: string,
): Promise<ResetIntent> {
  const lower = userInput.toLowerCase();

  if (
    lower.includes("batal") ||
    lower.includes("cancel") ||
    lower.includes("tidak jadi") ||
    lower.includes("jangan")
  )
    return "cancel";

  if (
    lower.includes("semua") ||
    lower.includes("all") ||
    lower.includes("komunitas") ||
    lower.includes("anggota")
  )
    return "confirm_all";

  if (
    lower.includes("transaksi") ||
    lower.includes("invoice") ||
    lower.includes("kas") ||
    lower.includes("log")
  )
    return "confirm_transactions";

  const result = await (runtime as any).generateText({
    context: `Klasifikasikan intent user. Input: "${userInput}". Pilih: confirm_transactions, confirm_all, cancel, atau unknown. Jawab SATU kata saja.`,
  });

  const trimmed = (result ?? "").trim().toLowerCase() as ResetIntent;
  const valid: ResetIntent[] = [
    "confirm_transactions",
    "confirm_all",
    "cancel",
    "unknown",
  ];
  return valid.includes(trimmed) ? trimmed : "unknown";
}

export const resetCommunityDataAction: Action = {
  name: "RESET_COMMUNITY_DATA",
  similes: [
    "HAPUS_DATA",
    "RESET_DATA",
    "BERSIHKAN_DATABASE",
    "FLUSH_DATABASE",
    "HAPUS_SEMUA",
  ],
  description:
    "Resets community data after user confirmation. Uses LLM to interpret user intent before proceeding.",
  validate: async (runtime, message) => {
    const hasCommunity = await validateHasCommunity(runtime);
    if (!hasCommunity) return false;

    const text = (message.content.text ?? "").toLowerCase();
    const pendingKey = runtime.agentId;
    const pending = pendingResetConfirmations.get(pendingKey);
    const isStillPending = pending && Date.now() - pending.ts < FIVE_MINUTES;

    return isStillPending || hasResetKeyword(text);
  },
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const community = await service.getCommunity();
    const input = (message.content.text ?? "").trim();
    const resetType = getStringOption(options, "type");
    const text = input.toLowerCase();
    const hasKeyword = hasResetKeyword(text);

    const pendingKey = `${runtime.agentId}`;
    const pending = pendingResetConfirmations.get(pendingKey);
    const isStillPending = pending && Date.now() - pending.ts < FIVE_MINUTES;

    if (!isStillPending && !hasKeyword) {
      const invoices = await service.listInvoices(community.id);
      const members = await service.listMembers(community.id);
      pendingResetConfirmations.set(pendingKey, {
        communityId: community.id,
        ts: Date.now(),
      });
      const text = [
        `⚠️ Kamu mau bersihkan data apa untuk komunitas **"${community.name}"**?`,
        ``,
        `**Opsi 1 — Hapus transaksi saja** (anggota tetap ada):`,
        `- ${invoices.length} invoice`,
        `- Semua catatan kas & log aktivitas`,
        `→ Balas: **"hapus transaksi saja"**`,
        ``,
        `**Opsi 2 — Hapus semua data** (termasuk ${members.length} anggota & komunitas):`,
        `→ Balas: **"hapus semua data"**`,
        ``,
        `Atau balas **"batal"** untuk membatalkan.`,
      ].join("\n");
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
      return { success: true, data: { awaitingConfirmation: true } };
    }

    pendingResetConfirmations.delete(pendingKey);

    const intent =
      resetType === "all"
        ? "confirm_all"
        : resetType === "transactions"
          ? "confirm_transactions"
          : await classifyResetIntent(runtime, input);

    if (intent === "cancel" || intent === "unknown") {
      const text =
        intent === "cancel"
          ? `Oke, tidak jadi hapus data. Data komunitas "${community.name}" tetap aman. 😊`
          : `Tidak yakin maksudnya apa. Data tidak dihapus. Ketik "hapus data komunitas" untuk mulai ulang.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
      return { success: true, data: { cancelled: true } };
    }

    if (intent === "confirm_all") {
      await dbModule.resetCommunityData(community.id);
      await dbModule.clearOnboardingState(runtime.agentId);
      const text = `✅ Semua data komunitas "${community.name}" telah dihapus. Ketik "buat komunitas baru" untuk setup ulang.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
    } else {
      await dbModule.resetCommunityTransactions(community.id);
      const text = `✅ Data transaksi komunitas "${community.name}" telah dibersihkan. Anggota dan komunitas tetap ada.`;
      await sendCallback(callback, message, text, ["RESET_COMMUNITY_DATA"]);
    }

    return {
      success: true,
      data: { reset: true, intent, communityId: community.id },
    };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "hapus semua data komunitas" } },
      {
        name: "{{name2}}",
        content: {
          text: "⚠️ Aku perlu konfirmasi sebelum menghapus data.",
          actions: ["RESET_COMMUNITY_DATA"],
        },
      },
    ],
  ],
};

// ── Exported list ───────────────────────────────────────────────────────

export const allActions: Action[] = [
  getAllMembersAction,
  createPaymentLinkAction,
  bulkCreateInvoicesAction,
  checkPaymentStatusAction,
  runMonitoringLoopAction,
  simulatePaymentAction,
  getUnpaidInvoicesAction,
  sendReminderAction,
  getKasSummaryAction,
  answerKasQueryAction,
  updateKasBalanceAction,
  markInvoicePaidManualAction,
  generateMonthlyReportAction,
  detectPaymentAnomalyAction,
  runBillingLoopAction,
  runReportLoopAction,
  calculateSplitBillAction,
  fullBillingWorkflowAction,
  resetCommunityDataAction,
];
