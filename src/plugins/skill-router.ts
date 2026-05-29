import {
  ModelType,
  type Action,
  type Content,
  type IAgentRuntime,
  type Memory,
  type UUID,
} from "@elizaos/core";
import { randomUUID } from "node:crypto";
import { allActions } from "./actions.ts";
import { onboardingActions } from "./onboarding-actions.ts";

type SkillRoute =
  | {
      handled: true;
      mode: "llm" | "skill";
      text: string;
      actionName?: string;
    }
  | { handled: false; mode: "agent" };

type SkillDefinition = {
  actionName: string;
  patterns: RegExp[];
};

const SKILLS: SkillDefinition[] = [
  {
    actionName: "START_ONBOARDING",
    patterns: [/\b(buat|setup|mulai).*\bkomunitas\b/i],
  },
  {
    actionName: "CREATE_QRIS_BILL",
    patterns: [
      /\b(qris).*\b(tagih|buat|invoice|bayar)\b/i,
      /\b(tagih|buat|invoice|bayar).*\b(qris)\b/i,
    ],
  },
  {
    actionName: "CREATE_BANK_TRANSFER_BILL",
    patterns: [
      /\b(bank transfer|transfer bank|virtual account|va).*\b(tagih|buat|invoice|bayar)\b/i,
      /\b(tagih|buat).*\b(bank transfer|transfer bank|virtual account|va)\b/i,
    ],
  },
  {
    actionName: "CREATE_PAYMENT_LINK",
    patterns: [
      /\b(payment link|link pembayaran).*\b(buat|tagih)\b/i,
      /\b(buat|tagih).*\b(payment link|link pembayaran)\b/i,
    ],
  },
  {
    actionName: "BULK_CREATE_INVOICES",
    patterns: [
      /\b(tagih|buatkan?).*\b(semua|seluruh).*\b(warga|anggota|member|peserta)\b/i,
      /\b(tagih|buatkan?).*\biuran\b.*\b(bulan ini|semua)\b/i,
    ],
  },
  {
    actionName: "GET_UNPAID_INVOICES",
    patterns: [
      /\b(siapa|mana|daftar|list).*\b(belum bayar|nunggak|tunggakan)\b/i,
      /\b(invoice|tagihan).*\b(pending|belum bayar)\b/i,
    ],
  },
  {
    actionName: "GET_KAS_SUMMARY",
    patterns: [/\b(berapa|cek|lihat|tampilkan).*\b(saldo|kas)\b/i],
  },
  {
    actionName: "ANSWER_KAS_QUERY",
    patterns: [
      /\b(kas).*\b(untuk apa|dipakai|riwayat|pengeluaran|pemasukan)\b/i,
    ],
  },
  {
    actionName: "UPDATE_KAS_BALANCE",
    patterns: [/\b(catat|tambah|input).*\b(pemasukan|pengeluaran|kas)\b/i],
  },
  {
    actionName: "GET_ALL_MEMBERS",
    patterns: [
      /\b(tampilkan|lihat|daftar|list).*\b(anggota|member|warga|peserta)\b/i,
    ],
  },
  {
    actionName: "ADD_MEMBER",
    patterns: [
      /\b(tambah|daftarkan?|add).*\b(anggota|member|warga|peserta)\b/i,
    ],
  },
  {
    actionName: "SEND_PAYMENT_REMINDERS",
    patterns: [/\b(kirim|send).*\b(reminder|pengingat)\b/i],
  },
  {
    actionName: "CHECK_PAYMENT_STATUS",
    patterns: [/\b(cek|lihat).*\b(status).*\b(pembayaran|invoice|tagihan)\b/i],
  },
  {
    actionName: "GENERATE_MONTHLY_REPORT",
    patterns: [/\b(buat|generate|tampilkan).*\b(laporan|report)\b/i],
  },
  {
    actionName: "FULL_BILLING_WORKFLOW",
    patterns: [/\b(jalankan|run).*\b(workflow).*\b(billing|tagih)?\b/i],
  },
  {
    actionName: "RUN_BILLING_LOOP",
    patterns: [/\b(jalankan|run).*\b(billing loop)\b/i],
  },
  {
    actionName: "RUN_MONITORING_LOOP",
    patterns: [
      /\b(jalankan|run|cek).*\b(monitoring|monitor).*\b(pembayaran|invoice)?\b/i,
    ],
  },
  {
    actionName: "RUN_REPORT_LOOP",
    patterns: [/\b(jalankan|run).*\b(report loop)\b/i],
  },
  {
    actionName: "SIMULATE_PAYMENT",
    patterns: [/\b(simulasi|simulate).*\b(bayar|pembayaran)\b/i],
  },
  {
    actionName: "MARK_INVOICE_PAID_MANUAL",
    patterns: [/\b(tandai|mark).*\b(lunas|paid|sudah bayar)\b/i],
  },
  {
    actionName: "SET_WORKFLOW_SCHEDULE",
    patterns: [
      /\b(atur|set|ubah|hentikan|cancel).*\b(jadwal|schedule|otomatis)\b/i,
    ],
  },
  {
    actionName: "CALCULATE_SPLIT_BILL",
    patterns: [/\b(hitung|calculate).*\b(patungan|split bill|split)\b/i],
  },
  {
    actionName: "DETECT_PAYMENT_ANOMALY",
    patterns: [/\b(deteksi|cek|lihat).*\b(anomali|bermasalah)\b/i],
  },
  {
    actionName: "LIST_COMMUNITIES",
    patterns: [/\b(tampilkan|lihat|daftar|list).*\bkomunitas\b/i],
  },
  {
    actionName: "LIST_DOKU_MCP_TOOLS",
    patterns: [/\b(tampilkan|lihat|daftar|list).*\b(tool|tools).*\bdoku\b/i],
  },
  {
    actionName: "CALL_DOKU_MCP_TOOL",
    patterns: [/\b(call|panggil|jalankan).*\b(doku mcp|tool doku)\b/i],
  },
];

const AMBIGUOUS_TOOL_HINTS = [
  /\b(invoice|iuran|kas|saldo|anggota|member|warga|peserta|komunitas|doku|qris|payment|tagihan|laporan|workflow|billing|reminder)\b/i,
  /\b\d+[\s.]*(rb|ribu|jt|juta|rupiah|rp)\b/i,
  /\brp\s*\d+/i,
];

const allSkillActions = [...onboardingActions, ...allActions];

export async function routeKomunitasMessage(
  runtime: IAgentRuntime,
  text: string,
  metadata: Record<string, unknown> = {},
): Promise<SkillRoute> {
  const normalized = text.trim();
  if (!normalized) return { handled: false, mode: "agent" };

  const onboardingAction = findAction("HANDLE_ONBOARDING_INPUT");
  if (
    onboardingAction &&
    (await canRun(onboardingAction, runtime, normalized, metadata))
  ) {
    return executeSkill(runtime, onboardingAction, normalized, metadata);
  }

  const skill = matchSkill(normalized);
  if (skill) {
    const action = findAction(skill.actionName);
    if (action && (await canRun(action, runtime, normalized, metadata))) {
      return executeSkill(runtime, action, normalized, metadata);
    }
    return { handled: false, mode: "agent" };
  }

  if (shouldAskFullAgent(normalized)) {
    return { handled: false, mode: "agent" };
  }

  return {
    handled: true,
    mode: "llm",
    text: await generateLightweightReply(runtime, normalized),
  };
}

function matchSkill(text: string) {
  return SKILLS.find((skill) =>
    skill.patterns.some((pattern) => pattern.test(text)),
  );
}

function shouldAskFullAgent(text: string) {
  if (text.length > 240) return true;
  return AMBIGUOUS_TOOL_HINTS.some((pattern) => pattern.test(text));
}

function findAction(name: string) {
  return allSkillActions.find((action) => action.name === name);
}

async function canRun(
  action: Action,
  runtime: IAgentRuntime,
  text: string,
  metadata: Record<string, unknown>,
) {
  if (!action.validate) return true;
  try {
    return await action.validate(
      runtime as any,
      createRouteMemory(runtime, text, metadata),
      undefined as any,
    );
  } catch {
    return false;
  }
}

async function executeSkill(
  runtime: IAgentRuntime,
  action: Action,
  text: string,
  metadata: Record<string, unknown>,
): Promise<SkillRoute> {
  const callbacks: Content[] = [];
  const message = createRouteMemory(runtime, text, metadata);
  const callback = async (content: Content) => {
    callbacks.push(content);
    return [];
  };

  await action.handler(
    runtime,
    message,
    undefined,
    getSkillOptions(action.name, text),
    callback,
  );
  const responseText = callbacks
    .map((content) => content.text)
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n\n")
    .trim();

  return {
    handled: true,
    mode: "skill",
    actionName: action.name,
    text: responseText || "Selesai.",
  };
}

function getSkillOptions(actionName: string, text: string) {
  if (actionName === "ADD_MEMBER") {
    const name = text
      .replace(/\b(tambah|daftarkan?|add)\b/gi, "")
      .replace(/\b(anggota|member|warga|peserta)\b/gi, "")
      .trim();
    return name ? { name } : {};
  }
  return {};
}

function createRouteMemory(
  runtime: IAgentRuntime,
  text: string,
  metadata: Record<string, unknown>,
): Memory {
  const roomId = randomUUID() as UUID;
  return {
    id: randomUUID() as UUID,
    entityId: (metadata.entityId as UUID | undefined) ?? (randomUUID() as UUID),
    agentId: runtime.agentId,
    roomId,
    worldId: roomId,
    content: {
      text,
      source: String(metadata.source ?? "komunitas-skill-router"),
      metadata,
    },
    createdAt: Date.now(),
  } as Memory;
}

async function generateLightweightReply(
  runtime: IAgentRuntime,
  text: string,
): Promise<string> {
  const reply = await runtime.useModel(ModelType.TEXT_SMALL, {
    prompt: buildLightweightReplyPrompt(text),
    maxTokens: 140,
    temperature: 0.3,
    stopSequences: ["\nUser:", "\nPengguna:"],
  });
  return cleanReply(reply);
}

function buildLightweightReplyPrompt(text: string) {
  return `Kamu BendaharaAI, asisten bendahara digital komunitas Indonesia.
Jawab dalam Bahasa Indonesia yang singkat, hangat, dan natural.
Jangan pakai tool, jangan sebut proses internal, jangan mengarang data kas/invoice.
Jika user bertanya kemampuan umum, beri contoh perintah singkat.

User: ${text}
BendaharaAI:`;
}

function cleanReply(text: string) {
  return String(text ?? "")
    .replace(/^BendaharaAI:\s*/i, "")
    .trim()
    .slice(0, 800);
}
