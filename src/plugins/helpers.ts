import {
  type Content,
  type HandlerCallback,
  type Memory,
  type RouteResponse,
} from "@elizaos/core";
import type * as db from "../database/db.ts";
import type {
  AgentLog,
  Community,
  Invoice,
  InvoiceStatus,
  KasEntry,
  KasEntryType,
  Member,
} from "./types.ts";

export const toMonth = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const rupiah = (amount: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;

export const sanitizeInvoiceNumber = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").slice(0, 30);

export const getHeader = (
  headers: unknown,
  name: string,
): string | undefined => {
  const normalizedName = name.toLowerCase();
  if (!headers) return undefined;
  if (typeof (headers as any).get === "function")
    return (headers as any).get(name) ?? undefined;
  const match = Object.entries(headers as Record<string, unknown>).find(
    ([key]) => key.toLowerCase() === normalizedName,
  );
  return typeof match?.[1] === "string" ? match[1] : undefined;
};

// ── DB row → domain type mappers ────────────────────────────────────────

export const rowToCommunity = (r: db.CommunityRow): Community => ({
  id: r.id,
  name: r.name,
  type: r.type as Community["type"],
  description: r.description ?? undefined,
  monthlyFee: r.monthly_fee,
  isActive: r.is_active,
  createdAt: r.created_at,
});

export const rowToMember = (r: db.MemberRow): Member => ({
  id: r.id,
  communityId: r.community_id,
  name: r.name,
  phone: r.phone ?? undefined,
  email: r.email ?? undefined,
  address: r.address ?? undefined,
  isActive: r.is_active,
  joinedAt: r.joined_at,
});

export const rowToInvoice = (r: db.InvoiceRow): Invoice => ({
  id: r.id,
  communityId: r.community_id,
  memberId: r.member_id,
  amount: r.amount,
  description: r.description,
  period: r.period,
  dueDate: r.due_date,
  status: r.status as InvoiceStatus,
  paymentLink: r.payment_link,
  dokuInvoiceId: r.doku_invoice_id,
  dokuRequestId: r.doku_request_id,
  paidAt: r.paid_at ?? undefined,
  createdAt: r.created_at,
  reminderCount: r.reminder_count,
});

export const rowToKasEntry = (r: db.KasEntryRow): KasEntry => ({
  id: r.id,
  communityId: r.community_id,
  type: r.type as KasEntryType,
  amount: r.amount,
  category: r.category,
  description: r.description,
  referenceId: r.reference_id ?? undefined,
  recordedBy: r.recorded_by as "agent" | "admin",
  date: r.date,
  createdAt: r.created_at,
});

export const rowToAgentLog = (r: db.AgentLogRow): AgentLog => ({
  id: r.id,
  communityId: r.community_id,
  action: r.action,
  details: r.details,
  createdAt: r.created_at,
});

// ── Action helpers ──────────────────────────────────────────────────────

export const sendCallback = async (
  callback: HandlerCallback | undefined,
  message: Memory,
  text: string,
  actions: string[],
) => {
  const content: Content = {
    text,
    actions,
    source: message.content.source,
  };
  await callback?.(content);
};

export const getOption = (options: unknown, key: string) =>
  options && typeof options === "object"
    ? (options as Record<string, unknown>)[key]
    : undefined;

export const getStringOption = (options: unknown, key: string) => {
  const value = getOption(options, key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export const getNumberOption = (options: unknown, key: string) => {
  const value = getOption(options, key);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const getKasEntryTypeOption = (options: unknown) => {
  const value = getStringOption(options, "type");
  return value === "income" || value === "expense" ? value : undefined;
};

export const routeJson = (res: RouteResponse, body: unknown, status = 200) => {
  if (typeof (res as any).status === "function")
    return (res as any).status(status).json(body);
  return res.json(body);
};
