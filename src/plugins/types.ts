import { z } from "zod";

export type CommunityType = "rt" | "arisan" | "koperasi" | "event" | "other";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";
export type KasEntryType = "income" | "expense";

export type Community = {
  id: string;
  name: string;
  type: CommunityType;
  description?: string;
  monthlyFee: number;
  isActive: boolean;
  createdAt: string;
};

export type Member = {
  id: string;
  communityId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  joinedAt: string;
};

export type Invoice = {
  id: string;
  communityId: string;
  memberId: string;
  amount: number;
  description: string;
  period: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentLink: string;
  dokuInvoiceId: string;
  dokuRequestId: string;
  paidAt?: string;
  createdAt: string;
  reminderCount: number;
};

export type KasEntry = {
  id: string;
  communityId: string;
  type: KasEntryType;
  amount: number;
  category: string;
  description: string;
  referenceId?: string;
  recordedBy: "agent" | "admin";
  date: string;
  createdAt: string;
};

export type AgentLog = {
  id: string;
  communityId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type MonthlyReport = {
  communityId: string;
  month: string;
  totalCollected: number;
  totalExpenses: number;
  netBalance: number;
  collectionRate: string;
  paidMembers: number;
  unpaidMembers: number;
  generatedAt: string;
};

export type DokuPaymentParams = {
  invoiceNumber: string;
  amount: number;
  description: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  dueMinutes: number;
};

export type DokuPaymentResult = {
  requestId: string;
  invoiceNumber: string;
  paymentUrl: string;
  expiresAt?: string;
  raw: unknown;
};

export type DokuStatusResult = {
  requestId: string;
  status: string;
  amount: number;
  paidAt?: string;
  raw: unknown;
};

export type KomunitasConfig = z.infer<typeof configSchema>;

export const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const configSchema = z.object({
  DOKU_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  DOKU_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  DOKU_MCP_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  DOKU_AUTHORIZATION: z.preprocess(emptyToUndefined, z.string().optional()),
  DOKU_MCP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DOKU_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("https://api-sandbox.doku.com"),
  ),
  APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export const loadKomunitasConfig = (): KomunitasConfig =>
  configSchema.parse({
    DOKU_CLIENT_ID: process.env.DOKU_CLIENT_ID,
    DOKU_SECRET_KEY: process.env.DOKU_SECRET_KEY,
    DOKU_MCP_API_KEY: process.env.DOKU_MCP_API_KEY,
    DOKU_AUTHORIZATION: process.env.DOKU_AUTHORIZATION,
    DOKU_MCP_URL: process.env.DOKU_MCP_URL,
    DOKU_BASE_URL: process.env.DOKU_BASE_URL || "https://api-sandbox.doku.com",
    APP_URL: process.env.APP_URL,
  });

export const defaultCommunityId = "community-rt-05";
