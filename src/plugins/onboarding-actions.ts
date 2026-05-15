import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
} from "@elizaos/core";
import { randomUUID } from "node:crypto";
import * as db from "../database/db.ts";
import { getKomunitasService } from "./komunitas-service.ts";
import { sendCallback, getStringOption, rupiah } from "./helpers.ts";
import {
  type OnboardingContext,
  COMMUNITY_FIELDS,
  MEMBER_FIELDS,
  COMMUNITY_TYPE_LABELS,
  parseCommunityType,
  parseMoneyInput,
  getOnboardingPrompt,
  getCommunityTypeFromRuntime,
} from "./onboarding.ts";
import { generateCharacter, saveCharacterFile } from "./character-generator.ts";
import type { CommunityType } from "./types.ts";

async function getCtx(runtime: IAgentRuntime): Promise<OnboardingContext> {
  try {
    const raw = await db.getOnboardingState(runtime.agentId);
    if (raw) return raw as OnboardingContext;
  } catch {}
  return { state: "EMPTY" };
}

async function saveCtx(runtime: IAgentRuntime, ctx: OnboardingContext) {
  await db.setOnboardingState(runtime.agentId, ctx as Record<string, unknown>);
}

async function clearCtx(runtime: IAgentRuntime) {
  await db.setOnboardingState(runtime.agentId, { state: "READY" });
}

function parseBatchMembers(input: string): string[] {
  const lines = input.split(/[\n,;]+/);
  return lines
    .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter((line) => line.length > 1);
}

function isBatchInput(input: string): boolean {
  return (
    input.includes("\n") ||
    input.includes(",") ||
    /^\d+[\.\)]/.test(input.trim())
  );
}

export const startOnboardingAction: Action = {
  name: "START_ONBOARDING",
  similes: ["SETUP_KOMUNITAS", "BUAT_KOMUNITAS_BARU", "MULAI_SETUP"],
  description: "Starts the onboarding flow to create a new community.",
  validate: async () => true,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const typeFromCharacter = getCommunityTypeFromRuntime(runtime as any);
    const ctx: OnboardingContext = typeFromCharacter
      ? {
          state: "COLLECTING_COMMUNITY",
          communityType: typeFromCharacter,
          draft: {},
        }
      : { state: "CHOOSING_TYPE" };
    await saveCtx(runtime, ctx);
    const label = typeFromCharacter
      ? COMMUNITY_TYPE_LABELS[typeFromCharacter]
      : "";
    const greeting = typeFromCharacter
      ? `Halo! Saya siap jadi bendahara digital ${label} kamu.\n\n`
      : "";
    const text = greeting + getOnboardingPrompt(ctx);
    await sendCallback(callback, message, text, ["START_ONBOARDING"]);
    return { success: true };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Buat komunitas baru" } },
      {
        name: "{{name2}}",
        content: {
          text: "Baik! Mari setup komunitas baru.",
          actions: ["START_ONBOARDING"],
        },
      },
    ],
  ],
};

export const handleOnboardingInputAction: Action = {
  name: "HANDLE_ONBOARDING_INPUT",
  similes: ["ONBOARDING_STEP", "LANJUT_SETUP"],
  description: "Processes user input during the onboarding flow.",
  validate: async (runtime) => {
    const ctx = await getCtx(runtime);
    return ctx.state !== "EMPTY" && ctx.state !== "READY";
  },
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const ctx = await getCtx(runtime);
    const input = (message.content.text ?? "").trim();

    if (ctx.state === "CHOOSING_TYPE") {
      const typeFromCharacter = getCommunityTypeFromRuntime(runtime as any);
      const type = typeFromCharacter ?? parseCommunityType(input);
      if (!type) {
        const text = `Pilihan tidak dikenali. Ketik angka 1-5:\n1. RT/RW\n2. Arisan\n3. Koperasi\n4. Event\n5. Lainnya`;
        await sendCallback(callback, message, text, [
          "HANDLE_ONBOARDING_INPUT",
        ]);
        return { success: true };
      }
      const newCtx: OnboardingContext = {
        state: "COLLECTING_COMMUNITY",
        communityType: type,
        draft: {},
      };
      await saveCtx(runtime, newCtx);
      const label = COMMUNITY_TYPE_LABELS[type];
      const prompt = getOnboardingPrompt(newCtx);
      const text = `Oke, kita setup ${label}!\n\n${prompt}`;
      await sendCallback(callback, message, text, ["HANDLE_ONBOARDING_INPUT"]);
      return { success: true };
    }

    if (ctx.state === "COLLECTING_COMMUNITY" && ctx.communityType) {
      const fields = COMMUNITY_FIELDS[ctx.communityType];
      const draft = ctx.draft ?? {};
      const nextField = fields.find((f) => !draft[f.key as keyof typeof draft]);

      if (!nextField) {
        const text = "Data komunitas sudah lengkap.";
        await sendCallback(callback, message, text, [
          "HANDLE_ONBOARDING_INPUT",
        ]);
        return { success: true };
      }

      if (nextField.key === "monthlyFee") {
        const amount = parseMoneyInput(input);
        if (!amount) {
          const text = `Nominal tidak valid. Masukkan angka saja, contoh: 50000`;
          await sendCallback(callback, message, text, [
            "HANDLE_ONBOARDING_INPUT",
          ]);
          return { success: true };
        }
        (draft as any)[nextField.key] = amount;
      } else {
        (draft as any)[nextField.key] = input;
      }

      const remaining = fields.filter((f) => !(draft as any)[f.key]);

      if (remaining.length > 0) {
        const updatedCtx: OnboardingContext = { ...ctx, draft: draft as any };
        await saveCtx(runtime, updatedCtx);
        const text = getOnboardingPrompt(updatedCtx);
        await sendCallback(callback, message, text, [
          "HANDLE_ONBOARDING_INPUT",
        ]);
        return { success: true };
      }

      const communityId = `community-${ctx.communityType}-${randomUUID().slice(0, 8)}`;
      const communityDraft = draft as any;

      await db.initSchema();
      await db.createCommunity({
        id: communityId,
        name: communityDraft.name,
        type: ctx.communityType,
        description: communityDraft.description ?? communityDraft.address,
        monthlyFee: communityDraft.monthlyFee,
      });

      const character = generateCharacter({
        communityId,
        communityName: communityDraft.name,
        communityType: ctx.communityType,
        monthlyFee: communityDraft.monthlyFee,
      });
      saveCharacterFile(communityId, character);

      const newCtx: OnboardingContext = {
        state: "COLLECTING_MEMBERS",
        communityType: ctx.communityType,
        communityId,
        memberDraft: {},
        memberCount: 0,
      };
      await saveCtx(runtime, newCtx);

      const label = COMMUNITY_TYPE_LABELS[ctx.communityType];
      const text = [
        `Komunitas "${communityDraft.name}" (${label}) berhasil dibuat!`,
        `Character file disimpan untuk agent baru.`,
        ``,
        `Sekarang tambah anggota pertama.`,
        getOnboardingPrompt(newCtx),
      ].join("\n");
      await sendCallback(callback, message, text, ["HANDLE_ONBOARDING_INPUT"]);
      return { success: true, data: { communityId } };
    }

    if (
      ctx.state === "COLLECTING_MEMBERS" &&
      ctx.communityType &&
      ctx.communityId
    ) {
      const fields = MEMBER_FIELDS[ctx.communityType];
      const memberDraft = ctx.memberDraft ?? {};
      const normalized = input.toLowerCase();
      const isDone = [
        "selesai",
        "tidak",
        "stop",
        "done",
        "sudah",
        "cukup",
      ].includes(normalized);

      if (isDone) {
        await clearCtx(runtime);
        const memberCount = ctx.memberCount ?? 0;
        const text = [
          `Setup selesai! ${memberCount} anggota terdaftar di komunitas.`,
          ``,
          `Kamu sekarang bisa:`,
          `- "Tagih iuran bulan ini" — buat invoice DOKU untuk semua anggota`,
          `- "Berapa saldo kas?" — cek saldo`,
          `- "Siapa yang belum bayar?" — lihat tunggakan`,
        ].join("\n");
        await sendCallback(callback, message, text, [
          "HANDLE_ONBOARDING_INPUT",
        ]);
        return { success: true };
      }

      const nextField = fields.find(
        (f) => !f.optional && !(memberDraft as any)[f.key],
      );

      // Detect batch input — multiple names separated by newline/comma
      if (nextField?.key === "name" && isBatchInput(input)) {
        const names = parseBatchMembers(input);
        if (names.length > 1) {
          let memberCount = ctx.memberCount ?? 0;
          for (const name of names) {
            const memberId = `member-${randomUUID().slice(0, 8)}`;
            await db.upsertMember({
              id: memberId,
              communityId: ctx.communityId,
              name,
            });
            memberCount++;
          }
          const updatedCtx: OnboardingContext = {
            ...ctx,
            memberDraft: {},
            memberCount,
          };
          await saveCtx(runtime, updatedCtx);
          const text = [
            `✅ ${names.length} anggota berhasil ditambahkan sekaligus:`,
            names.map((n, i) => `${i + 1}. ${n}`).join("\n"),
            ``,
            `Total anggota terdaftar: ${memberCount} orang.`,
            `Tambah lagi? Ketik nama atau "selesai" untuk mengakhiri.`,
          ].join("\n");
          await sendCallback(callback, message, text, [
            "HANDLE_ONBOARDING_INPUT",
          ]);
          return { success: true };
        }
      }

      if (nextField) {
        (memberDraft as any)[nextField.key] = input;
        const remaining = fields.filter(
          (f) => !f.optional && !(memberDraft as any)[f.key],
        );

        if (remaining.length > 0) {
          const updatedCtx: OnboardingContext = {
            ...ctx,
            memberDraft: memberDraft as any,
          };
          await saveCtx(runtime, updatedCtx);
          const text = getOnboardingPrompt(updatedCtx);
          await sendCallback(callback, message, text, [
            "HANDLE_ONBOARDING_INPUT",
          ]);
          return { success: true };
        }

        const memberId = `member-${randomUUID().slice(0, 8)}`;
        const md = memberDraft as any;
        const phone = md.phone
          ? md.phone.replace(/^0/, "62").replace(/[^0-9]/g, "")
          : undefined;
        const address =
          md.address ?? (md.houseNumber ? `No. ${md.houseNumber}` : undefined);

        await db.upsertMember({
          id: memberId,
          communityId: ctx.communityId,
          name: md.name,
          phone,
          address,
        });

        const memberCount = (ctx.memberCount ?? 0) + 1;
        const updatedCtx: OnboardingContext = {
          ...ctx,
          memberDraft: {},
          memberCount,
        };
        await saveCtx(runtime, updatedCtx);

        const text = [
          `Anggota ke-${memberCount} (${md.name}) berhasil ditambahkan.`,
          ``,
          `Tambah anggota lagi? Ketik nama anggota berikutnya, atau ketik "selesai" untuk mengakhiri.`,
        ].join("\n");
        await sendCallback(callback, message, text, [
          "HANDLE_ONBOARDING_INPUT",
        ]);
        return { success: true };
      }

      (memberDraft as any)["name"] = input;
      const updatedCtx: OnboardingContext = {
        ...ctx,
        memberDraft: memberDraft as any,
      };
      await saveCtx(runtime, updatedCtx);
      const text = getOnboardingPrompt(updatedCtx);
      await sendCallback(callback, message, text, ["HANDLE_ONBOARDING_INPUT"]);
      return { success: true };
    }

    const text =
      "Tidak ada proses setup yang sedang berjalan. Ketik 'buat komunitas baru' untuk memulai.";
    await sendCallback(callback, message, text, ["HANDLE_ONBOARDING_INPUT"]);
    return { success: true };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "RT" } },
      {
        name: "{{name2}}",
        content: {
          text: "Oke, kita setup RT/RW!",
          actions: ["HANDLE_ONBOARDING_INPUT"],
        },
      },
    ],
  ],
};

export const addMemberAction: Action = {
  name: "ADD_MEMBER",
  similes: ["TAMBAH_ANGGOTA", "DAFTARKAN_ANGGOTA", "REGISTER_MEMBER"],
  description: "Adds a new member to the active community.",
  validate: async () => true,
  handler: async (
    runtime,
    message,
    _state,
    options,
    callback,
  ): Promise<ActionResult> => {
    try {
      const service = getKomunitasService(runtime);
      const community = await service.getCommunity();
      const name =
        getStringOption(options, "name") ?? message.content.text?.trim();
      if (!name) throw new Error("Nama anggota diperlukan.");

      const phone = getStringOption(options, "phone");
      const address = getStringOption(options, "address");
      const memberId = `member-${randomUUID().slice(0, 8)}`;

      await db.upsertMember({
        id: memberId,
        communityId: community.id,
        name,
        phone: phone?.replace(/^0/, "62").replace(/[^0-9]/g, ""),
        address,
      });

      const text = `Anggota "${name}" berhasil ditambahkan ke ${community.name}.`;
      await sendCallback(callback, message, text, ["ADD_MEMBER"]);
      return { success: true, data: { memberId, name } };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await sendCallback(callback, message, `Gagal tambah anggota: ${text}`, [
        "ADD_MEMBER",
      ]);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(text),
      };
    }
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Tambah anggota Pak Budi" } },
      {
        name: "{{name2}}",
        content: {
          text: "Anggota berhasil ditambahkan.",
          actions: ["ADD_MEMBER"],
        },
      },
    ],
  ],
};

export const listCommunitiesAction: Action = {
  name: "LIST_COMMUNITIES",
  similes: ["DAFTAR_KOMUNITAS", "LIHAT_KOMUNITAS", "SHOW_COMMUNITIES"],
  description: "Lists all communities in the database.",
  validate: async () => true,
  handler: async (
    runtime,
    message,
    _state,
    _options,
    callback,
  ): Promise<ActionResult> => {
    const service = getKomunitasService(runtime);
    const communities = await service.listCommunities();
    if (communities.length === 0) {
      const text =
        "Belum ada komunitas. Ketik 'buat komunitas baru' untuk memulai.";
      await sendCallback(callback, message, text, ["LIST_COMMUNITIES"]);
      return { success: true };
    }
    const rows = communities.map(
      (c, i) =>
        `${i + 1}. ${c.name} (${COMMUNITY_TYPE_LABELS[c.type as CommunityType] ?? c.type}) — iuran ${rupiah(c.monthlyFee)}`,
    );
    const text = `Ada ${communities.length} komunitas:\n\n${rows.join("\n")}`;
    await sendCallback(callback, message, text, ["LIST_COMMUNITIES"]);
    return { success: true, data: { communities } };
  },
  examples: [
    [
      { name: "{{name1}}", content: { text: "Tampilkan semua komunitas" } },
      {
        name: "{{name2}}",
        content: { text: "Daftar komunitas:", actions: ["LIST_COMMUNITIES"] },
      },
    ],
  ],
};

export const onboardingActions = [
  startOnboardingAction,
  handleOnboardingInputAction,
  addMemberAction,
  listCommunitiesAction,
];
