import type { CommunityType } from "./types.ts";

export type OnboardingState =
  | "EMPTY"
  | "CHOOSING_TYPE"
  | "COLLECTING_COMMUNITY"
  | "AWAITING_BATCH_INPUT"
  | "COLLECTING_MEMBERS"
  | "READY";

export type OnboardingContext = {
  state: OnboardingState;
  communityType?: CommunityType;
  communityId?: string;
  pendingField?: string;
  draft?: Partial<CommunityDraft>;
  memberDraft?: Partial<MemberDraft>;
  memberCount?: number;
};

export type CommunityDraft = {
  name: string;
  type: CommunityType;
  description?: string;
  monthlyFee: number;
  address?: string;
};

export type MemberDraft = {
  name: string;
  phone?: string;
  address?: string;
  houseNumber?: string;
};

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  rt: "RT/RW",
  arisan: "Arisan",
  koperasi: "Koperasi",
  event: "Event",
  other: "Lainnya",
};

export const COMMUNITY_FIELDS: Record<
  CommunityType,
  Array<{ key: keyof CommunityDraft; label: string; hint: string }>
> = {
  rt: [
    {
      key: "name",
      label: "Nama RT/RW",
      hint: "contoh: RT 05 RW 03 Kelapa Gading",
    },
    {
      key: "address",
      label: "Kelurahan/Kecamatan",
      hint: "contoh: Kelurahan Kelapa Gading Barat",
    },
    { key: "monthlyFee", label: "Iuran bulanan (Rp)", hint: "contoh: 50000" },
  ],
  arisan: [
    { key: "name", label: "Nama arisan", hint: "contoh: Arisan PKK RT 05" },
    {
      key: "description",
      label: "Jadwal kumpul",
      hint: "contoh: Setiap Jumat pertama",
    },
    { key: "monthlyFee", label: "Nominal arisan (Rp)", hint: "contoh: 200000" },
  ],
  koperasi: [
    {
      key: "name",
      label: "Nama koperasi",
      hint: "contoh: Koperasi Simpan Pinjam Maju Bersama",
    },
    {
      key: "description",
      label: "Jenis koperasi",
      hint: "contoh: Simpan Pinjam",
    },
    {
      key: "monthlyFee",
      label: "Iuran wajib bulanan (Rp)",
      hint: "contoh: 100000",
    },
  ],
  event: [
    {
      key: "name",
      label: "Nama event",
      hint: "contoh: Panitia 17 Agustus 2026",
    },
    {
      key: "description",
      label: "Tanggal event",
      hint: "contoh: 17 Agustus 2026",
    },
    {
      key: "monthlyFee",
      label: "Target iuran per orang (Rp)",
      hint: "contoh: 75000",
    },
  ],
  other: [
    {
      key: "name",
      label: "Nama komunitas",
      hint: "contoh: Komunitas Belajar Coding",
    },
    {
      key: "description",
      label: "Deskripsi singkat",
      hint: "contoh: Komunitas belajar programming",
    },
    { key: "monthlyFee", label: "Iuran bulanan (Rp)", hint: "contoh: 25000" },
  ],
};

export const MEMBER_FIELDS: Record<
  CommunityType,
  Array<{
    key: keyof MemberDraft;
    label: string;
    hint: string;
    optional?: boolean;
  }>
> = {
  rt: [
    { key: "name", label: "Nama lengkap", hint: "contoh: Pak Budi Santoso" },
    { key: "houseNumber", label: "Nomor rumah", hint: "contoh: No. 12A" },
    { key: "phone", label: "Nomor HP (WhatsApp)", hint: "contoh: 08121234567" },
  ],
  arisan: [
    { key: "name", label: "Nama lengkap", hint: "contoh: Bu Sari Dewi" },
    { key: "phone", label: "Nomor HP (WhatsApp)", hint: "contoh: 08121234567" },
  ],
  koperasi: [
    { key: "name", label: "Nama lengkap", hint: "contoh: Pak Joko Widodo" },
    { key: "phone", label: "Nomor HP", hint: "contoh: 08121234567" },
    {
      key: "address",
      label: "Alamat",
      hint: "contoh: Jl. Mawar No. 5",
      optional: true,
    },
  ],
  event: [
    { key: "name", label: "Nama lengkap", hint: "contoh: Bu Nina Hartati" },
    {
      key: "phone",
      label: "Nomor HP",
      hint: "contoh: 08121234567",
      optional: true,
    },
  ],
  other: [
    { key: "name", label: "Nama lengkap", hint: "contoh: Pak Andi Wijaya" },
    {
      key: "phone",
      label: "Nomor HP",
      hint: "contoh: 08121234567",
      optional: true,
    },
  ],
};

export function getOnboardingPrompt(ctx: OnboardingContext): string {
  if (ctx.state === "EMPTY") {
    return [
      "Halo! Saya siap jadi bendahara digital komunitas kamu.",
      "",
      "Ayo mulai setup. Apa nama komunitas ini?",
      `(${ctx.communityType ? COMMUNITY_FIELDS[ctx.communityType][0].hint : "contoh: RT 05 RW 03 Kelapa Gading"})`,
    ].join("\n");
  }

  if (ctx.state === "CHOOSING_TYPE") {
    return [
      "Halo! Saya BendaharaAI, siap jadi bendahara digital komunitas kamu.",
      "",
      "Sebelum mulai, komunitas ini untuk apa?",
      "1. RT/RW — iuran warga, kas lingkungan",
      "2. Arisan — kelola arisan bulanan",
      "3. Koperasi — simpan pinjam, iuran wajib",
      "4. Event — panitia acara, patungan",
      "5. Lainnya",
      "",
      "Ketik angka atau nama pilihanmu.",
    ].join("\n");
  }

  if (ctx.state === "COLLECTING_COMMUNITY" && ctx.communityType) {
    return getBatchFormPrompt(ctx.communityType);
  }

  if (ctx.state === "AWAITING_BATCH_INPUT" && ctx.communityType) {
    return getBatchFormPrompt(ctx.communityType);
  }

  if (ctx.state === "COLLECTING_MEMBERS" && ctx.communityType) {
    const fields = MEMBER_FIELDS[ctx.communityType];
    const draft = ctx.memberDraft ?? {};
    const nextField = fields.find((f) => !draft[f.key] && !f.optional);
    if (nextField) {
      const count = ctx.memberCount ?? 0;
      return `Anggota ke-${count + 1} — ${nextField.label}?\n(${nextField.hint})`;
    }
    return `Data anggota ke-${(ctx.memberCount ?? 0) + 1} sudah lengkap. Tambah anggota lagi? (ya/tidak)`;
  }

  return "";
}

export function getBatchFormPrompt(
  type: CommunityType,
  _agentName?: string,
): string {
  const forms: Record<CommunityType, string[]> = {
    rt: [
      "Isi info berikut dalam satu pesan:",
      "",
      "Nama RT/RW: [contoh: RT 05 RW 03 Kelapa Gading]",
      "Kelurahan/Kecamatan: [contoh: Kelapa Gading Barat]",
      "Iuran bulanan (Rp): [contoh: 50000]",
      "",
      "Daftar warga (nama - nomor HP):",
      "1. [nama] - [nomor HP]",
      "2. [nama] - [nomor HP]",
    ],
    arisan: [
      "Isi info berikut dalam satu pesan:",
      "",
      "Nama arisan: [contoh: Arisan PKK RT 05]",
      "Jadwal kumpul: [contoh: Setiap Jumat pertama]",
      "Nominal arisan (Rp): [contoh: 200000]",
      "",
      "Daftar peserta (nama - nomor HP):",
      "1. [nama] - [nomor HP]",
      "2. [nama] - [nomor HP]",
    ],
    koperasi: [
      "Isi info berikut dalam satu pesan:",
      "",
      "Nama koperasi: [contoh: Koperasi Maju Bersama]",
      "Jenis koperasi: [contoh: Simpan Pinjam]",
      "Iuran wajib bulanan (Rp): [contoh: 100000]",
      "",
      "Daftar anggota (nama - nomor HP):",
      "1. [nama] - [nomor HP]",
      "2. [nama] - [nomor HP]",
    ],
    event: [
      "Isi info berikut dalam satu pesan:",
      "",
      "Nama event: [contoh: Panitia 17 Agustus 2026]",
      "Tanggal event: [contoh: 17 Agustus 2026]",
      "Kontribusi per orang (Rp): [contoh: 75000]",
      "",
      "Daftar peserta (nama - nomor HP):",
      "1. [nama] - [nomor HP]",
      "2. [nama] - [nomor HP]",
    ],
    other: [
      "Isi info berikut dalam satu pesan:",
      "",
      "Nama patungan: [contoh: Patungan Liburan Bali]",
      "Nominal per orang (Rp): [contoh: 500000]",
      "",
      "Daftar peserta (nama - nomor HP):",
      "1. [nama] - [nomor HP]",
      "2. [nama] - [nomor HP]",
    ],
  };

  return forms[type].join("\n");
}

export function parseBatchFormInput(
  input: string,
  _type: CommunityType,
): {
  name?: string;
  description?: string;
  monthlyFee?: number;
  memberLines: string[];
} {
  const result: {
    name?: string;
    description?: string;
    monthlyFee?: number;
    memberLines: string[];
  } = { memberLines: [] };

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const memberMatch = trimmed.match(/^\d+[.)]\s*(.+)$/);
    if (memberMatch?.[1]) {
      const raw = memberMatch[1].trim();
      if (raw && !raw.includes("[")) result.memberLines.push(raw);
      continue;
    }

    if (!trimmed.includes(":")) continue;

    const colonIdx = trimmed.indexOf(":");
    const rawKey = trimmed.slice(0, colonIdx).toLowerCase().trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!value || value.includes("[contoh:") || value.startsWith("[")) continue;

    if (rawKey.includes("nama")) {
      result.name = value;
      continue;
    }

    if (
      rawKey.includes("nominal") ||
      rawKey.includes("iuran") ||
      rawKey.includes("kontribusi")
    ) {
      const amount = parseMoneyInput(value);
      if (amount) result.monthlyFee = amount;
      continue;
    }

    if (
      rawKey.includes("jadwal") ||
      rawKey.includes("jenis") ||
      rawKey.includes("tanggal") ||
      rawKey.includes("kelurahan") ||
      rawKey.includes("kecamatan") ||
      rawKey.includes("deskripsi")
    ) {
      result.description = value;
    }
  }

  return result;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  return digits.startsWith("0") ? digits.replace(/^0/, "62") : digits;
}

export function getCommunityTypeFromRuntime(runtime: {
  character?: { settings?: Record<string, unknown> };
}): CommunityType | null {
  const type = runtime?.character?.settings?.communityType;
  if (typeof type === "string") {
    const valid: CommunityType[] = [
      "rt",
      "arisan",
      "koperasi",
      "event",
      "other",
    ];
    if (valid.includes(type as CommunityType)) return type as CommunityType;
  }
  return null;
}

export function parseCommunityType(input: string): CommunityType | null {
  const normalized = input.toLowerCase().trim();
  const map: Record<string, CommunityType> = {
    "1": "rt",
    rt: "rt",
    "rt/rw": "rt",
    rw: "rt",
    "2": "arisan",
    arisan: "arisan",
    "3": "koperasi",
    koperasi: "koperasi",
    "4": "event",
    event: "event",
    panitia: "event",
    "5": "other",
    lainnya: "other",
    other: "other",
  };
  return map[normalized] ?? null;
}

export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/[^0-9]/g, "");
  const value = parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isOnboardingComplete(ctx: OnboardingContext): boolean {
  return ctx.state === "READY" && Boolean(ctx.communityId);
}
