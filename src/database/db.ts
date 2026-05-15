import { Pool, type QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";

export type CommunityType = "rt" | "arisan" | "koperasi" | "event" | "other";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";
export type KasEntryType = "income" | "expense";

export interface CommunityRow {
  id: string;
  name: string;
  type: CommunityType;
  description: string | null;
  monthly_fee: number;
  is_active: boolean;
  created_at: string;
}

export interface MemberRow {
  id: string;
  community_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  joined_at: string;
}

export interface InvoiceRow {
  id: string;
  community_id: string;
  member_id: string;
  amount: number;
  description: string;
  period: string;
  due_date: string;
  status: InvoiceStatus;
  payment_link: string;
  doku_invoice_id: string;
  doku_request_id: string;
  paid_at: string | null;
  created_at: string;
  reminder_count: number;
}

export interface KasEntryRow {
  id: string;
  community_id: string;
  type: KasEntryType;
  amount: number;
  category: string;
  description: string;
  reference_id: string | null;
  recorded_by: "agent" | "admin";
  date: string;
  created_at: string;
}

export interface AgentLogRow {
  id: string;
  community_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface KasSummary {
  total_income: number;
  total_expense: number;
  current_balance: number;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      "postgresql://localhost:5432/komunitas-ai";
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS communities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('rt','arisan','koperasi','event','other')),
  description TEXT,
  monthly_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id           TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY,
  community_id     TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_id        TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount           NUMERIC(15,2) NOT NULL,
  description      TEXT NOT NULL,
  period           TEXT NOT NULL,
  due_date         DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  payment_link     TEXT NOT NULL DEFAULT '',
  doku_invoice_id  TEXT NOT NULL DEFAULT '',
  doku_request_id  TEXT NOT NULL DEFAULT '',
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_count   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kas_entries (
  id            TEXT PRIMARY KEY,
  community_id  TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount        NUMERIC(15,2) NOT NULL,
  category      TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  reference_id  TEXT,
  recorded_by   TEXT NOT NULL DEFAULT 'agent',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id            TEXT PRIMARY KEY,
  community_id  TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  details       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id               TEXT PRIMARY KEY,
  community_id     TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  notification_key TEXT NOT NULL UNIQUE,
  channel          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'sending',
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_state (
  agent_id    TEXT NOT NULL,
  state       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id)
);

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id              TEXT PRIMARY KEY,
  community_id    TEXT NOT NULL UNIQUE REFERENCES communities(id) ON DELETE CASCADE,
  workflow_type   TEXT NOT NULL DEFAULT 'full_billing',
  interval_ms     BIGINT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  requester_phone TEXT,
  requester_channel TEXT,
  next_run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workflow_schedules
  ADD COLUMN IF NOT EXISTS requester_phone TEXT;

ALTER TABLE workflow_schedules
  ADD COLUMN IF NOT EXISTS requester_channel TEXT;

CREATE INDEX IF NOT EXISTS idx_members_community ON members(community_id);
CREATE INDEX IF NOT EXISTS idx_invoices_community ON invoices(community_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(community_id, period);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(community_id, status);
CREATE INDEX IF NOT EXISTS idx_kas_community ON kas_entries(community_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_community ON agent_logs(community_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_community
  ON notification_deliveries(community_id);
`;

export async function initSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(SCHEMA_SQL);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

const mapCommunity = (r: QueryResultRow): CommunityRow => ({
  id: r.id,
  name: r.name,
  type: r.type,
  description: r.description,
  monthly_fee: Number(r.monthly_fee),
  is_active: r.is_active,
  created_at: iso(r.created_at),
});

const mapMember = (r: QueryResultRow): MemberRow => ({
  id: r.id,
  community_id: r.community_id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  is_active: r.is_active,
  joined_at: iso(r.joined_at),
});

const mapInvoice = (r: QueryResultRow): InvoiceRow => ({
  id: r.id,
  community_id: r.community_id,
  member_id: r.member_id,
  amount: Number(r.amount),
  description: r.description,
  period: r.period,
  due_date: r.due_date,
  status: r.status,
  payment_link: r.payment_link,
  doku_invoice_id: r.doku_invoice_id,
  doku_request_id: r.doku_request_id,
  paid_at: r.paid_at ? iso(r.paid_at) : null,
  created_at: iso(r.created_at),
  reminder_count: r.reminder_count,
});

const mapKasEntry = (r: QueryResultRow): KasEntryRow => ({
  id: r.id,
  community_id: r.community_id,
  type: r.type,
  amount: Number(r.amount),
  category: r.category,
  description: r.description,
  reference_id: r.reference_id,
  recorded_by: r.recorded_by,
  date:
    typeof r.date === "string"
      ? r.date
      : (r.date as Date).toISOString().slice(0, 10),
  created_at: iso(r.created_at),
});

const mapAgentLog = (r: QueryResultRow): AgentLogRow => ({
  id: r.id,
  community_id: r.community_id,
  action: r.action,
  details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
  created_at: iso(r.created_at),
});

const iso = (v: Date | string | null | undefined): string => {
  if (!v) return new Date().toISOString();
  return typeof v === "string" ? v : v.toISOString();
};

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

export async function findCommunities(): Promise<CommunityRow[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM communities WHERE is_active = TRUE ORDER BY created_at DESC",
  );
  return rows.map(mapCommunity);
}

export async function findCommunity(
  id: string,
): Promise<CommunityRow | undefined> {
  const { rows } = await getPool().query(
    "SELECT * FROM communities WHERE id = $1",
    [id],
  );
  return rows[0] ? mapCommunity(rows[0]) : undefined;
}

export async function createCommunity(data: {
  id: string;
  name: string;
  type: CommunityType;
  description?: string;
  monthlyFee: number;
}): Promise<CommunityRow> {
  const { rows } = await getPool().query(
    `INSERT INTO communities (id, name, type, description, monthly_fee)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.id, data.name, data.type, data.description ?? null, data.monthlyFee],
  );
  return mapCommunity(rows[0]);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function findMembers(
  communityId: string,
  activeOnly = true,
): Promise<MemberRow[]> {
  const query = activeOnly
    ? "SELECT * FROM members WHERE community_id = $1 AND is_active = TRUE ORDER BY name"
    : "SELECT * FROM members WHERE community_id = $1 ORDER BY name";
  const { rows } = await getPool().query(query, [communityId]);
  return rows.map(mapMember);
}

export async function findMember(id: string): Promise<MemberRow | undefined> {
  const { rows } = await getPool().query(
    "SELECT * FROM members WHERE id = $1",
    [id],
  );
  return rows[0] ? mapMember(rows[0]) : undefined;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function findInvoices(
  communityId: string,
  filters?: { status?: string; month?: string; memberId?: string },
): Promise<InvoiceRow[]> {
  const conditions = ["community_id = $1"];
  const params: unknown[] = [communityId];
  let idx = 2;

  if (filters?.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.month) {
    conditions.push(`period = $${idx++}`);
    params.push(filters.month);
  }
  if (filters?.memberId) {
    conditions.push(`member_id = $${idx++}`);
    params.push(filters.memberId);
  }

  const { rows } = await getPool().query(
    `SELECT * FROM invoices WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(mapInvoice);
}

export async function findInvoice(id: string): Promise<InvoiceRow | undefined> {
  const { rows } = await getPool().query(
    "SELECT * FROM invoices WHERE id = $1",
    [id],
  );
  return rows[0] ? mapInvoice(rows[0]) : undefined;
}

export async function createInvoice(data: {
  id: string;
  communityId: string;
  memberId: string;
  amount: number;
  description: string;
  period: string;
  dueDate: string;
  paymentLink: string;
  dokuInvoiceId: string;
  dokuRequestId: string;
}): Promise<InvoiceRow> {
  const { rows } = await getPool().query(
    `INSERT INTO invoices
       (id, community_id, member_id, amount, description, period, due_date,
        payment_link, doku_invoice_id, doku_request_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
    [
      data.id,
      data.communityId,
      data.memberId,
      data.amount,
      data.description,
      data.period,
      data.dueDate,
      data.paymentLink,
      data.dokuInvoiceId,
      data.dokuRequestId,
    ],
  );
  return mapInvoice(rows[0]);
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  paidAt?: string,
): Promise<void> {
  if (status === "paid" && paidAt) {
    await getPool().query(
      "UPDATE invoices SET status = $1, paid_at = $2 WHERE id = $3",
      [status, paidAt, id],
    );
  } else {
    await getPool().query("UPDATE invoices SET status = $1 WHERE id = $2", [
      status,
      id,
    ]);
  }
}

export async function markInvoicePaidAtomic(
  invoiceId: string,
  paidAt: string,
  kasData: {
    id: string;
    communityId: string;
    type: KasEntryType;
    amount: number;
    category: string;
    description: string;
    referenceId: string;
    recordedBy?: "agent" | "admin";
    date: string;
  },
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE invoices SET status = $1, paid_at = $2 WHERE id = $3",
      ["paid", paidAt, invoiceId],
    );
    await client.query(
      `INSERT INTO kas_entries (id, community_id, type, amount, category, description, reference_id, recorded_by, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        kasData.id,
        kasData.communityId,
        kasData.type,
        kasData.amount,
        kasData.category,
        kasData.description,
        kasData.referenceId,
        kasData.recordedBy ?? "agent",
        kasData.date,
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function incrementReminderCount(id: string): Promise<void> {
  await getPool().query(
    "UPDATE invoices SET reminder_count = reminder_count + 1 WHERE id = $1",
    [id],
  );
}

export async function findInvoiceByDokuId(
  dokuInvoiceId: string,
): Promise<InvoiceRow | undefined> {
  const { rows } = await getPool().query(
    "SELECT * FROM invoices WHERE doku_invoice_id = $1",
    [dokuInvoiceId],
  );
  return rows[0] ? mapInvoice(rows[0]) : undefined;
}

// ---------------------------------------------------------------------------
// Kas Entries
// ---------------------------------------------------------------------------

export async function findKasEntries(
  communityId: string,
): Promise<KasEntryRow[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM kas_entries WHERE community_id = $1 ORDER BY created_at DESC",
    [communityId],
  );
  return rows.map(mapKasEntry);
}

export async function createKasEntry(data: {
  id: string;
  communityId: string;
  type: KasEntryType;
  amount: number;
  category: string;
  description: string;
  referenceId?: string;
  recordedBy?: "agent" | "admin";
  date?: string;
}): Promise<KasEntryRow> {
  const { rows } = await getPool().query(
    `INSERT INTO kas_entries (id, community_id, type, amount, category, description, reference_id, recorded_by, date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      data.id,
      data.communityId,
      data.type,
      data.amount,
      data.category,
      data.description,
      data.referenceId ?? null,
      data.recordedBy ?? "agent",
      data.date ?? new Date().toISOString().slice(0, 10),
    ],
  );
  return mapKasEntry(rows[0]);
}

export async function findKasEntryByReference(
  referenceId: string,
): Promise<KasEntryRow | undefined> {
  const { rows } = await getPool().query(
    "SELECT * FROM kas_entries WHERE reference_id = $1 LIMIT 1",
    [referenceId],
  );
  return rows[0] ? mapKasEntry(rows[0]) : undefined;
}

export async function getKasSummary(communityId: string): Promise<KasSummary> {
  const { rows } = await getPool().query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
     FROM kas_entries WHERE community_id = $1`,
    [communityId],
  );
  const totalIncome = Number(rows[0]?.total_income ?? 0);
  const totalExpense = Number(rows[0]?.total_expense ?? 0);
  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    current_balance: totalIncome - totalExpense,
  };
}

// ---------------------------------------------------------------------------
// Agent Logs
// ---------------------------------------------------------------------------

export async function findLogs(communityId: string): Promise<AgentLogRow[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM agent_logs WHERE community_id = $1 ORDER BY created_at DESC LIMIT 100",
    [communityId],
  );
  return rows.map(mapAgentLog);
}

export async function createLog(data: {
  id: string;
  communityId: string;
  action: string;
  details: Record<string, unknown>;
}): Promise<AgentLogRow> {
  const { rows } = await getPool().query(
    "INSERT INTO agent_logs (id, community_id, action, details) VALUES ($1,$2,$3,$4) RETURNING *",
    [data.id, data.communityId, data.action, JSON.stringify(data.details)],
  );
  return mapAgentLog(rows[0]);
}

export async function claimNotificationDelivery(data: {
  id: string;
  communityId: string;
  notificationKey: string;
  channel: string;
}): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `INSERT INTO notification_deliveries
       (id, community_id, notification_key, channel, status)
     VALUES ($1,$2,$3,$4,'sending')
     ON CONFLICT (notification_key) DO NOTHING`,
    [data.id, data.communityId, data.notificationKey, data.channel],
  );
  return rowCount === 1;
}

export async function updateNotificationDeliveryStatus(
  notificationKey: string,
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  await getPool().query(
    `UPDATE notification_deliveries
     SET status = $1, error = $2, updated_at = NOW()
     WHERE notification_key = $3`,
    [status, error ?? null, notificationKey],
  );
}

export async function resetCommunityData(communityId: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM agent_logs WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM kas_entries WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM invoices WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM members WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM communities WHERE id = $1", [communityId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function resetCommunityTransactions(
  communityId: string,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM agent_logs WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM kas_entries WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("DELETE FROM invoices WHERE community_id = $1", [
      communityId,
    ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Onboarding State (persistent across sessions/restarts)
// ---------------------------------------------------------------------------

export async function getOnboardingState(
  agentId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await getPool().query(
    "SELECT state FROM onboarding_state WHERE agent_id = $1",
    [agentId],
  );
  if (!rows[0]) return null;
  return typeof rows[0].state === "string"
    ? JSON.parse(rows[0].state)
    : rows[0].state;
}

export async function setOnboardingState(
  agentId: string,
  state: Record<string, unknown>,
): Promise<void> {
  await getPool().query(
    `INSERT INTO onboarding_state (agent_id, state, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (agent_id) DO UPDATE
       SET state = EXCLUDED.state, updated_at = NOW()`,
    [agentId, JSON.stringify(state)],
  );
}

export async function clearOnboardingState(agentId: string): Promise<void> {
  await getPool().query("DELETE FROM onboarding_state WHERE agent_id = $1", [
    agentId,
  ]);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedDemoData(): Promise<{
  community: CommunityRow;
  members: MemberRow[];
}> {
  // Idempotent: skip if community already exists
  const existing = await findCommunity("community-rt-05");
  if (existing) {
    // ensure invoices table is clean (keep structure, just truncate transactions)
    await getPool().query("DELETE FROM invoices");
    await getPool().query("DELETE FROM kas_entries");
    await getPool().query("DELETE FROM agent_logs");

    const members = await findMembers("community-rt-05");
    return { community: existing, members };
  }

  await createCommunity({
    id: "community-rt-05",
    name: "RT 05 RW 03 Kelapa Gading",
    type: "rt",
    description: "Komunitas demo untuk iuran bulanan warga.",
    monthlyFee: 50000,
  });

  const memberData = [
    { id: "member-budi", name: "Pak Budi", phone: "628121110001" },
    { id: "member-sari", name: "Bu Sari", phone: "628121110002" },
    { id: "member-joko", name: "Pak Joko", phone: "628121110003" },
    { id: "member-nina", name: "Bu Nina", phone: "628121110004" },
    { id: "member-andi", name: "Pak Andi", phone: "628121110005" },
  ];

  for (const m of memberData) {
    await getPool().query(
      `INSERT INTO members (id, community_id, name, phone, is_active)
       VALUES ($1,$2,$3,$4,TRUE) ON CONFLICT DO NOTHING`,
      [m.id, "community-rt-05", m.name, m.phone],
    );
  }

  await createKasEntry({
    id: "kas-seed-1",
    communityId: "community-rt-05",
    type: "income",
    amount: 250000,
    category: "saldo-awal",
    description: "Saldo awal kas RT",
    recordedBy: "admin",
  });

  await createKasEntry({
    id: "kas-seed-2",
    communityId: "community-rt-05",
    type: "expense",
    amount: 75000,
    category: "kebersihan",
    description: "Perlengkapan kebersihan lingkungan",
    recordedBy: "admin",
  });

  await createLog({
    id: randomUUID(),
    communityId: "community-rt-05",
    action: "system_seeded",
    details: { source: "seedDemoData" },
  });

  const community = (await findCommunity("community-rt-05"))!;
  const members = await findMembers("community-rt-05");
  return { community, members };
}

export async function resetDemoData(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM agent_logs");
    await client.query("DELETE FROM kas_entries");
    await client.query("DELETE FROM invoices");
    await client.query("DELETE FROM members");
    await client.query("DELETE FROM communities");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Upsert a community row (for in-memory-to-DB migration compatibility).
 */
export async function upsertCommunity(
  data: CommunityRow,
): Promise<CommunityRow> {
  const { rows } = await getPool().query(
    `INSERT INTO communities (id,name,type,description,monthly_fee,is_active,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type,
       description=EXCLUDED.description, monthly_fee=EXCLUDED.monthly_fee,
       is_active=EXCLUDED.is_active
     RETURNING *`,
    [
      data.id,
      data.name,
      data.type,
      data.description,
      data.monthly_fee,
      data.is_active,
      data.created_at,
    ],
  );
  return mapCommunity(rows[0]);
}

export async function upsertMember(data: {
  id: string;
  communityId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}): Promise<MemberRow> {
  const { rows } = await getPool().query(
    `INSERT INTO members (id,community_id,name,phone,email,address,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone,
       email=EXCLUDED.email, address=EXCLUDED.address, is_active=EXCLUDED.is_active
     RETURNING *`,
    [
      data.id,
      data.communityId,
      data.name,
      data.phone ?? null,
      data.email ?? null,
      data.address ?? null,
      data.isActive ?? true,
    ],
  );
  return mapMember(rows[0]);
}

export interface WorkflowScheduleRow {
  id: string;
  community_id: string;
  workflow_type: string;
  interval_ms: number;
  is_active: boolean;
  requester_phone: string | null;
  requester_channel: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

const mapSchedule = (r: QueryResultRow): WorkflowScheduleRow => ({
  id: r.id,
  community_id: r.community_id,
  workflow_type: r.workflow_type,
  interval_ms: Number(r.interval_ms),
  is_active: r.is_active,
  requester_phone: r.requester_phone ?? null,
  requester_channel: r.requester_channel ?? null,
  next_run_at: iso(r.next_run_at),
  created_at: iso(r.created_at),
  updated_at: iso(r.updated_at),
});

export async function upsertWorkflowSchedule(data: {
  communityId: string;
  workflowType?: string;
  intervalMs: number;
  isActive?: boolean;
  requesterPhone?: string;
  requesterChannel?: string;
}): Promise<WorkflowScheduleRow> {
  const { rows } = await getPool().query(
    `INSERT INTO workflow_schedules
       (id, community_id, workflow_type, interval_ms, is_active,
        requester_phone, requester_channel, next_run_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (community_id) DO UPDATE SET
       workflow_type      = EXCLUDED.workflow_type,
       interval_ms        = EXCLUDED.interval_ms,
       is_active          = EXCLUDED.is_active,
       requester_phone    = COALESCE(EXCLUDED.requester_phone, workflow_schedules.requester_phone),
       requester_channel  = COALESCE(EXCLUDED.requester_channel, workflow_schedules.requester_channel),
       next_run_at        = NOW(),
       updated_at         = NOW()
     RETURNING *`,
    [
      randomUUID(),
      data.communityId,
      data.workflowType ?? "full_billing",
      data.intervalMs,
      data.isActive ?? true,
      data.requesterPhone ?? null,
      data.requesterChannel ?? null,
    ],
  );
  return mapSchedule(rows[0]);
}

export async function getWorkflowSchedule(
  communityId: string,
): Promise<WorkflowScheduleRow | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM workflow_schedules WHERE community_id = $1`,
    [communityId],
  );
  return rows[0] ? mapSchedule(rows[0]) : null;
}

export async function listActiveWorkflowSchedules(): Promise<
  WorkflowScheduleRow[]
> {
  const { rows } = await getPool().query(
    `SELECT * FROM workflow_schedules WHERE is_active = TRUE`,
  );
  return rows.map(mapSchedule);
}

export async function deactivateWorkflowSchedule(
  communityId: string,
): Promise<void> {
  await getPool().query(
    `UPDATE workflow_schedules SET is_active = FALSE, updated_at = NOW() WHERE community_id = $1`,
    [communityId],
  );
}

export async function updateNextRunAt(communityId: string): Promise<void> {
  await getPool().query(
    `UPDATE workflow_schedules
     SET next_run_at = NOW() + (interval_ms || ' milliseconds')::interval, updated_at = NOW()
     WHERE community_id = $1`,
    [communityId],
  );
}
