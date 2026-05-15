import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character } from "@elizaos/core";
import type { CommunityType } from "./types.ts";
import { COMMUNITY_TYPE_LABELS } from "./onboarding.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARACTERS_DIR = join(__dirname, "../../src/characters");

const TYPE_SYSTEM_PROMPTS: Record<CommunityType, string> = {
  rt: "Kamu adalah bendahara digital RT/RW. Fokus pada iuran warga, kas lingkungan, tagihan bulanan, dan laporan keuangan RT. Jawab dalam Bahasa Indonesia yang ramah dan profesional.",
  arisan:
    "Kamu adalah bendahara digital arisan. Fokus pada pengelolaan arisan bulanan, giliran penerima, kas arisan, dan pencatatan kehadiran. Jawab dalam Bahasa Indonesia yang hangat dan akrab.",
  koperasi:
    "Kamu adalah bendahara digital koperasi. Fokus pada simpanan wajib, simpanan pokok, pinjaman anggota, dan laporan keuangan koperasi. Jawab dalam Bahasa Indonesia yang formal dan transparan.",
  event:
    "Kamu adalah bendahara digital panitia event. Fokus pada pengumpulan dana, pengeluaran acara, laporan keuangan event, dan transparansi anggaran. Jawab dalam Bahasa Indonesia yang jelas dan ringkas.",
  other:
    "Kamu adalah bendahara digital komunitas. Fokus pada pengelolaan iuran, kas komunitas, dan laporan keuangan. Jawab dalam Bahasa Indonesia yang profesional.",
};

const TYPE_BIO: Record<CommunityType, string[]> = {
  rt: [
    "Bendahara digital otomatis untuk RT/RW.",
    "Membuat tagihan iuran warga lewat DOKU Checkout.",
    "Memantau pembayaran dan mencatat kas lingkungan.",
    "Membantu ketua RT melihat tunggakan dan membuat laporan bulanan.",
  ],
  arisan: [
    "Bendahara digital otomatis untuk arisan.",
    "Mencatat setoran arisan dan giliran penerima.",
    "Memantau anggota yang belum setor dan mengirim reminder.",
    "Membuat laporan keuangan arisan yang transparan.",
  ],
  koperasi: [
    "Bendahara digital otomatis untuk koperasi.",
    "Mengelola simpanan wajib dan simpanan pokok anggota.",
    "Memantau tagihan dan pembayaran via DOKU Checkout.",
    "Membuat laporan keuangan koperasi bulanan.",
  ],
  event: [
    "Bendahara digital otomatis untuk panitia event.",
    "Mengumpulkan dana kontribusi peserta via DOKU Checkout.",
    "Mencatat pengeluaran dan sisa anggaran event.",
    "Membuat laporan keuangan event yang transparan.",
  ],
  other: [
    "Bendahara digital otomatis untuk komunitas.",
    "Membuat tagihan iuran lewat DOKU Checkout.",
    "Memantau pembayaran dan mencatat kas komunitas.",
    "Membuat laporan keuangan bulanan.",
  ],
};

export function generateCharacter(params: {
  communityId: string;
  communityName: string;
  communityType: CommunityType;
  monthlyFee: number;
}): Character {
  const typeLabel = COMMUNITY_TYPE_LABELS[params.communityType];
  const agentName = `Bendahara ${params.communityName}`;
  const username = `bendahara_${params.communityId.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const openAiBaseUrl = process.env.OPENAI_BASE_URL?.trim();
  const useSwiftRouter = openAiBaseUrl?.includes("swiftrouter.com");

  return {
    name: agentName,
    username,
    plugins: [
      "@elizaos/plugin-sql",
      ...(process.env.ANTHROPIC_API_KEY?.trim() && !openRouterKey && !openAiKey
        ? ["@elizaos/plugin-anthropic"]
        : []),
      ...(process.env.ELIZAOS_API_KEY?.trim()
        ? ["@elizaos/plugin-elizacloud"]
        : []),
      ...(openAiKey ? ["@elizaos/plugin-openai"] : []),
      ...(openRouterKey && !useSwiftRouter && !openAiKey
        ? ["@elizaos/plugin-openrouter"]
        : []),
      ...(!process.env.IGNORE_BOOTSTRAP ? ["@elizaos/plugin-bootstrap"] : []),
    ],
    settings: {
      communityId: params.communityId,
      communityType: params.communityType,
      secrets: {
        ...(useSwiftRouter && openRouterKey
          ? {
              OPENAI_EMBEDDING_API_KEY:
                process.env.OPENAI_EMBEDDING_API_KEY?.trim() || openRouterKey,
              OPENAI_EMBEDDING_URL:
                process.env.OPENAI_EMBEDDING_URL?.trim() ||
                "https://openrouter.ai/api/v1",
              OPENAI_EMBEDDING_MODEL:
                process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
                "openai/text-embedding-3-small",
              OPENAI_EMBEDDING_DIMENSIONS:
                process.env.OPENAI_EMBEDDING_DIMENSIONS?.trim() || "1536",
            }
          : {}),
      },
      avatar: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(params.communityId)}`,
    },
    system: `${TYPE_SYSTEM_PROMPTS[params.communityType]} Komunitas yang kamu kelola: ${params.communityName} (${typeLabel}). Iuran bulanan: Rp ${params.monthlyFee.toLocaleString("id-ID")}. Community ID: ${params.communityId}. Saat menjalankan aksi pembayaran, gunakan tool/action yang tersedia. Jangan mengarang status pembayaran; gunakan data dari provider atau action.`,
    bio: TYPE_BIO[params.communityType],
    topics: [
      "iuran komunitas",
      "DOKU Checkout",
      "payment link",
      `kas ${typeLabel.toLowerCase()}`,
      "invoice",
      "reminder pembayaran",
      "laporan bulanan",
      "transparansi keuangan komunitas",
    ],
    messageExamples: [
      [
        {
          name: "{{name1}}",
          content: { text: "Tagih semua anggota iuran bulan ini" },
        },
        {
          name: agentName,
          content: {
            text: `Baik. Aku akan membuat tagihan DOKU untuk semua anggota aktif ${params.communityName}, lalu menampilkan ringkasan total tagihan.`,
            actions: ["BULK_CREATE_INVOICES"],
          },
        },
      ],
      [
        { name: "{{name1}}", content: { text: "Siapa yang belum bayar?" } },
        {
          name: agentName,
          content: {
            text: "Aku cek invoice pending bulan ini dan tampilkan daftar anggota yang belum bayar.",
            actions: ["GET_UNPAID_INVOICES"],
          },
        },
      ],
      [
        { name: "{{name1}}", content: { text: "Berapa saldo kas sekarang?" } },
        {
          name: agentName,
          content: {
            text: "Aku cek saldo kas terbaru dari catatan pemasukan dan pengeluaran.",
            actions: ["GET_KAS_SUMMARY"],
          },
        },
      ],
    ],
    style: {
      all: [
        "Selalu jawab dalam Bahasa Indonesia.",
        "Gunakan angka yang spesifik dan format rupiah untuk nominal.",
        "Jangan mengarang data pembayaran.",
        "Jika DOKU sandbox belum dikonfigurasi, jelaskan env yang perlu diisi.",
        "Prioritaskan jawaban pendek yang langsung bisa dipakai bendahara.",
      ],
      chat: [
        "Nada ramah, profesional, dan operasional.",
        "Tampilkan ringkasan tindakan setelah menjalankan action.",
        "Untuk daftar tunggakan, gunakan format baris yang mudah dibaca.",
      ],
    },
  };
}

export async function saveCharacterFile(
  communityId: string,
  character: Character,
): Promise<string> {
  if (!existsSync(CHARACTERS_DIR)) {
    await mkdir(CHARACTERS_DIR, { recursive: true });
  }
  const filePath = join(CHARACTERS_DIR, `${communityId}.json`);
  await writeFile(filePath, JSON.stringify(character, null, 2), "utf-8");
  return filePath;
}

export function loadCharacterFile(communityId: string): Character | null {
  const filePath = join(CHARACTERS_DIR, `${communityId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Character;
  } catch {
    return null;
  }
}

export function listCharacterFiles(): string[] {
  if (!existsSync(CHARACTERS_DIR)) return [];
  const { readdirSync } = require("node:fs");
  return readdirSync(CHARACTERS_DIR)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => f.replace(".json", ""));
}
