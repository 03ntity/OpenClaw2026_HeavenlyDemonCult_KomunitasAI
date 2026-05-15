# 🏘️ KomunitasAI — Master Build Plan
### OpenClaw Agenthon 2026 | RISTEK x Build Club
> *AI Agent yang otomatis kelola keuangan komunitas Indonesia — dari arisan RT sampai koperasi.*

---

## 📋 Daftar Isi

1. [Ringkasan Proyek](#1-ringkasan-proyek)
2. [Problem & Solution](#2-problem--solution)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Struktur Folder Project](#4-struktur-folder-project)
5. [Database Schema](#5-database-schema)
6. [Daftar Tool Calls (Lengkap)](#6-daftar-tool-calls-lengkap)
7. [Autonomous Loop — Detail Alur](#7-autonomous-loop--detail-alur)
8. [DOKU Payment Integration](#8-doku-payment-integration)
9. [ElizaOS Agent Setup](#9-elizaos-agent-setup)
10. [API Endpoints](#10-api-endpoints)
11. [Frontend Dashboard](#11-frontend-dashboard)
12. [Timeline Build 12 Jam](#12-timeline-build-12-jam)
13. [Demo Video Script](#13-demo-video-script)
14. [Pitch Deck Outline](#14-pitch-deck-outline)
15. [README Template](#15-readme-template)
16. [Submission Checklist](#16-submission-checklist)

---

## 1. Ringkasan Proyek

| Atribut | Detail |
|---|---|
| **Nama Proyek** | KomunitasAI |
| **Tagline** | Bendahara digital otomatis untuk komunitas Indonesia |
| **Target Pengguna** | Bendahara RT, pengurus arisan, ketua koperasi, panitia event |
| **Tech Stack Utama** | ElizaOS, Node.js/TypeScript, DOKU API, PostgreSQL, React |
| **Track** | General + Best Payment Use Case (DOKU) |
| **Framework Agent** | ElizaOS (elizaos.ai) |
| **Tipe Sistem** | Multi-Agent System dengan Autonomous Loop |

### Apa yang membuat ini berbeda?
KomunitasAI bukan chatbot biasa. Ini adalah sistem multi-agent yang **berjalan sendiri tanpa disuruh** — menagih iuran, memonitor pembayaran, mengirim reminder, dan membuat laporan secara otomatis. Bendahara hanya perlu setup sekali, lalu agen yang bekerja.

---

## 2. Problem & Solution

### 2.1 Pain Point Nyata

**Bendahara RT / Komunitas:**
- Harus wa satu-satu setiap bulan untuk nagih iuran (30–100 orang)
- Sering lupa siapa yang sudah bayar dan belum
- Rekap manual di Excel rentan salah
- Tidak ada laporan transparan yang bisa dibagikan ke warga
- Tidak dibayar, tapi kerjanya melelahkan

**Anggota Komunitas:**
- Lupa tanggal jatuh tempo
- Bingung berapa yang harus dibayar
- Tidak tahu saldo kas komunitas digunakan untuk apa
- Arisan: tidak tahu giliran siapa bulan ini

**Koperasi Simpan Pinjam:**
- Tracking pinjaman manual
- Reminder cicilan tidak konsisten
- Laporan keuangan dibuat manual tiap bulan

### 2.2 Solusi

KomunitasAI hadir sebagai **"Bendahara Digital"** yang:

```
SEBELUM KomunitasAI:
Bendahara → WA manual 50 orang → tunggu konfirmasi → rekap Excel → buat laporan manual
[waktu: ~5 jam/bulan per komunitas]

SESUDAH KomunitasAI:
Bendahara → setup sekali → Agent kerja sendiri
[waktu: ~10 menit/bulan untuk review laporan]
```

### 2.3 Use Case yang Didukung

| Use Case | Deskripsi |
|---|---|
| **Iuran RT/RW** | Tagih iuran bulanan warga secara otomatis |
| **Arisan** | Kelola giliran, tagih setoran, catat pemenang |
| **Koperasi** | Simpanan wajib + tracking cicilan pinjaman |
| **Kas Kelas/Alumni** | Patungan event, kas bersama |
| **Event Komunitas** | Kelola pembayaran pendaftaran event |

---

## 3. Arsitektur Sistem

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│              React Dashboard (Bendahara UI)                 │
│         [Lihat Kas] [Daftar Anggota] [Laporan]              │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API / WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                    ELIZAOS RUNTIME                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              ORCHESTRATOR AGENT                     │   │
│   │   - Terima input natural language dari bendahara    │   │
│   │   - Delegate task ke sub-agent yang tepat          │   │
│   │   - Jalankan scheduled autonomous loop             │   │
│   └───────────────┬─────────────────┬───────────────────┘   │
│                   │                 │                        │
│   ┌───────────────▼──┐   ┌──────────▼──────────────────┐    │
│   │  BILLING AGENT   │   │     REPORTING AGENT         │    │
│   │                  │   │                             │    │
│   │ - Buat invoice   │   │ - Generate laporan bulanan  │    │
│   │ - Monitor status │   │ - Hitung arisan schedule    │    │
│   │ - Kirim reminder │   │ - Deteksi anomali           │    │
│   └────────┬─────────┘   └──────────┬──────────────────┘    │
│            │                        │                        │
└────────────┼────────────────────────┼────────────────────────┘
             │                        │
┌────────────▼──────────┐   ┌─────────▼──────────────────────┐
│    DOKU PAYMENT API   │   │         DATABASE               │
│                       │   │       (PostgreSQL)             │
│ - Create payment link │   │                                │
│ - Check status        │   │ - communities                  │
│ - Webhook receiver    │   │ - members                      │
└───────────────────────┘   │ - invoices                     │
                            │ - transactions                 │
┌───────────────────────┐   │ - kas_entries                  │
│  NOTIFICATION SERVICE │   └────────────────────────────────┘
│                       │
│ - WhatsApp/WA API     │
│ - Web Push            │
│ - Email               │
└───────────────────────┘
```

### 3.2 Agent Interaction Flow

```
Bendahara ketik: "Tagih semua warga iuran bulan ini"
         │
         ▼
Orchestrator Agent menerima input
         │
         ├─► Parsing intent: BULK_BILLING
         │
         ├─► Memanggil tool: get_all_members(community_id)
         │        └─► Return: [member1, member2, ..., member50]
         │
         ├─► Delegate ke Billing Agent
         │        │
         │        ├─► bulk_create_invoices() → DOKU API
         │        │        └─► Return: [payment_link_1, ..., payment_link_50]
         │        │
         │        └─► send_invoice_notifications() → WA/Push
         │
         └─► Response ke bendahara:
             "✅ 50 tagihan berhasil dibuat dan dikirim ke semua anggota.
              Total tagihan: Rp 5.000.000
              Jatuh tempo: 7 hari"
```

---

## 4. Struktur Folder Project

```
OpenClaw2026_NamaTim_KomunitasAI/
│
├── 📁 src/
│   ├── 📁 agents/                    # ElizaOS Agent definitions
│   │   ├── orchestrator.ts           # Main orchestrator agent
│   │   ├── billing-agent.ts          # Handles billing & payment
│   │   └── reporting-agent.ts        # Handles reports & analytics
│   │
│   ├── 📁 plugins/                   # ElizaOS custom plugins
│   │   ├── 📁 doku-plugin/
│   │   │   ├── index.ts              # Plugin entry point
│   │   │   ├── actions.ts            # DOKU-related actions
│   │   │   └── doku-client.ts        # DOKU API client
│   │   │
│   │   ├── 📁 community-plugin/
│   │   │   ├── index.ts
│   │   │   ├── actions.ts            # Community management actions
│   │   │   └── providers.ts          # Data providers for agents
│   │   │
│   │   └── 📁 notification-plugin/
│   │       ├── index.ts
│   │       └── notifier.ts           # WA / push notifications
│   │
│   ├── 📁 tools/                     # Tool call implementations
│   │   ├── payment-tools.ts          # create_payment_link, check_status, dll
│   │   ├── community-tools.ts        # get_members, update_kas, dll
│   │   ├── reporting-tools.ts        # generate_report, arisan_schedule, dll
│   │   └── query-tools.ts            # natural language query tools
│   │
│   ├── 📁 database/
│   │   ├── schema.sql                # Database schema lengkap
│   │   ├── migrations/               # DB migration files
│   │   └── db.ts                     # Database connection & queries
│   │
│   ├── 📁 scheduler/
│   │   └── autonomous-loop.ts        # Cron jobs & autonomous triggers
│   │
│   ├── 📁 api/                       # REST API untuk frontend
│   │   ├── routes/
│   │   │   ├── communities.ts
│   │   │   ├── members.ts
│   │   │   ├── invoices.ts
│   │   │   └── reports.ts
│   │   └── server.ts                 # Express server
│   │
│   └── 📁 webhook/
│       └── doku-webhook.ts           # Terima callback dari DOKU
│
├── 📁 frontend/                      # React dashboard
│   ├── 📁 src/
│   │   ├── 📁 pages/
│   │   │   ├── Dashboard.tsx         # Halaman utama
│   │   │   ├── Members.tsx           # Manajemen anggota
│   │   │   ├── Invoices.tsx          # Daftar tagihan
│   │   │   └── Reports.tsx           # Laporan keuangan
│   │   ├── 📁 components/
│   │   └── App.tsx
│   └── package.json
│
├── 📁 characters/                    # ElizaOS character files
│   └── bendahara-ai.json             # Karakter utama agent
│
├── .env.example                      # Template environment variables
├── package.json
├── tsconfig.json
├── docker-compose.yml                # Untuk deployment mudah
└── README.md
```

---

## 5. Database Schema

```sql
-- =============================================
-- DATABASE SCHEMA: KomunitasAI
-- =============================================

-- Tabel komunitas (RT, arisan, koperasi, dll)
CREATE TABLE communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,          -- "RT 05 RW 03 Kelapa Gading"
  type          VARCHAR(50) NOT NULL,            -- 'rt', 'arisan', 'koperasi', 'event'
  description   TEXT,
  admin_id      UUID NOT NULL,                  -- FK ke users
  monthly_fee   DECIMAL(15, 2) DEFAULT 0,       -- Iuran bulanan default
  created_at    TIMESTAMP DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

-- Tabel anggota komunitas
CREATE TABLE members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID REFERENCES communities(id),
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),                    -- Untuk WA notifikasi
  email         VARCHAR(255),
  address       TEXT,
  join_date     DATE DEFAULT CURRENT_DATE,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT                            -- Catatan khusus
);

-- Tabel invoice / tagihan
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID REFERENCES communities(id),
  member_id       UUID REFERENCES members(id),
  amount          DECIMAL(15, 2) NOT NULL,
  description     VARCHAR(255),                 -- "Iuran RT Januari 2026"
  due_date        DATE NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  payment_link    TEXT,                          -- URL payment link DOKU
  doku_invoice_id VARCHAR(255),                  -- ID dari DOKU
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  reminder_count  INT DEFAULT 0                  -- Berapa kali reminder sudah dikirim
);

-- Tabel transaksi kas
CREATE TABLE kas_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID REFERENCES communities(id),
  type          VARCHAR(10) NOT NULL,            -- 'income' atau 'expense'
  amount        DECIMAL(15, 2) NOT NULL,
  category      VARCHAR(100),                   -- 'iuran', 'keamanan', 'kebersihan', dll
  description   TEXT,
  reference_id  UUID,                           -- FK ke invoices jika dari pembayaran
  recorded_by   VARCHAR(100) DEFAULT 'agent',   -- 'agent' atau nama admin
  date          DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Tabel arisan (khusus use case arisan)
CREATE TABLE arisan_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID REFERENCES communities(id),
  period        VARCHAR(20),                    -- "2026-01"
  winner_id     UUID REFERENCES members(id),
  total_pot     DECIMAL(15, 2),
  draw_date     DATE,
  is_completed  BOOLEAN DEFAULT FALSE
);

-- Tabel log aktivitas agent
CREATE TABLE agent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID REFERENCES communities(id),
  action        VARCHAR(100),                   -- 'bulk_invoice_created', 'reminder_sent', dll
  details       JSONB,                          -- Detail aktivitas
  created_at    TIMESTAMP DEFAULT NOW()
);

-- View: Ringkasan kas komunitas
CREATE VIEW kas_summary AS
SELECT
  community_id,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS current_balance
FROM kas_entries
GROUP BY community_id;

-- View: Status tagihan bulan ini
CREATE VIEW monthly_invoice_status AS
SELECT
  community_id,
  COUNT(*) AS total_invoices,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS overdue_count,
  SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_collected
FROM invoices
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
GROUP BY community_id;
```

---

## 6. Daftar Tool Calls (Lengkap)

Setiap tool call adalah fungsi yang bisa dipanggil oleh agent secara otonom.

### 6.1 Payment Tools

```typescript
// ✅ TOOL: create_payment_link
// Deskripsi: Membuat payment link via DOKU untuk satu anggota
// Dipanggil oleh: Billing Agent
{
  name: "create_payment_link",
  parameters: {
    member_id: string,        // UUID anggota
    amount: number,           // Jumlah dalam Rupiah
    description: string,      // "Iuran RT Januari 2026"
    due_date: string,         // "2026-01-31"
    community_id: string
  },
  returns: {
    payment_link: string,     // "https://checkout.doku.com/..."
    invoice_id: string,       // ID invoice di DOKU
    expires_at: string
  }
}

// ✅ TOOL: bulk_create_invoices
// Deskripsi: Buat tagihan untuk SEMUA anggota aktif sekaligus
// Dipanggil oleh: Orchestrator Agent (dari scheduled loop)
{
  name: "bulk_create_invoices",
  parameters: {
    community_id: string,
    month: string,            // "2026-01"
    amount?: number           // Override amount, default pakai monthly_fee komunitas
  },
  returns: {
    created_count: number,
    invoices: Array<{ member_id, payment_link, invoice_id }>,
    failed_count: number
  }
}

// ✅ TOOL: check_payment_status
// Deskripsi: Cek apakah invoice sudah dibayar (via DOKU API)
// Dipanggil oleh: Billing Agent (dalam monitoring loop)
{
  name: "check_payment_status",
  parameters: {
    invoice_id: string        // ID invoice di database lokal
  },
  returns: {
    status: "paid" | "pending" | "expired",
    paid_at?: string,
    amount_paid?: number
  }
}

// ✅ TOOL: get_unpaid_invoices
// Deskripsi: Ambil semua invoice yang belum dibayar
{
  name: "get_unpaid_invoices",
  parameters: {
    community_id: string,
    month?: string            // Default: bulan ini
  },
  returns: {
    invoices: Array<{
      invoice_id, member_name, amount, due_date, reminder_count
    }>
  }
}
```

### 6.2 Community Management Tools

```typescript
// ✅ TOOL: get_all_members
// Deskripsi: Ambil semua anggota aktif dari suatu komunitas
{
  name: "get_all_members",
  parameters: {
    community_id: string,
    active_only?: boolean     // Default: true
  },
  returns: {
    members: Array<{ id, name, phone, email }>,
    total: number
  }
}

// ✅ TOOL: send_payment_reminder
// Deskripsi: Kirim reminder ke anggota yang belum bayar
// Dipanggil otomatis setelah 3 hari belum bayar
{
  name: "send_payment_reminder",
  parameters: {
    invoice_id: string,
    channel: "whatsapp" | "push" | "email",
    custom_message?: string   // Pesan custom, default pakai template
  },
  returns: {
    success: boolean,
    message_id: string
  }
}

// ✅ TOOL: update_kas_balance
// Deskripsi: Catat transaksi masuk/keluar ke kas komunitas
{
  name: "update_kas_balance",
  parameters: {
    community_id: string,
    type: "income" | "expense",
    amount: number,
    category: string,         // "iuran", "kebersihan", "keamanan", dll
    description: string,
    reference_id?: string     // Invoice ID jika dari pembayaran
  },
  returns: {
    entry_id: string,
    new_balance: number
  }
}

// ✅ TOOL: get_kas_summary
// Deskripsi: Ambil ringkasan saldo kas komunitas
{
  name: "get_kas_summary",
  parameters: {
    community_id: string,
    period?: string           // "2026-01" atau "all"
  },
  returns: {
    total_income: number,
    total_expense: number,
    current_balance: number,
    last_updated: string
  }
}

// ✅ TOOL: mark_invoice_paid_manual
// Deskripsi: Tandai invoice sebagai lunas secara manual
// (untuk kasus bayar tunai / transfer langsung)
{
  name: "mark_invoice_paid_manual",
  parameters: {
    invoice_id: string,
    proof_note?: string       // Catatan bukti bayar
  },
  returns: {
    success: boolean,
    updated_invoice: object
  }
}
```

### 6.3 Reporting Tools

```typescript
// ✅ TOOL: generate_monthly_report
// Deskripsi: Buat laporan keuangan bulanan lengkap
// Auto-trigger tiap akhir bulan
{
  name: "generate_monthly_report",
  parameters: {
    community_id: string,
    month: string             // "2026-01"
  },
  returns: {
    report_id: string,
    summary: {
      total_collected: number,
      total_expenses: number,
      net_balance: number,
      collection_rate: string,  // "85%"
      paid_members: number,
      unpaid_members: number
    },
    transactions: Array<object>,
    pdf_url?: string
  }
}

// ✅ TOOL: calculate_arisan_schedule
// Deskripsi: Hitung jadwal dan giliran pemenang arisan
{
  name: "calculate_arisan_schedule",
  parameters: {
    community_id: string,
    start_date: string,
    contribution_per_period: number
  },
  returns: {
    schedule: Array<{
      period: string,
      winner_name: string,
      total_pot: number
    }>
  }
}

// ✅ TOOL: detect_payment_anomaly
// Deskripsi: Deteksi anggota yang punya pola telat bayar berulang
{
  name: "detect_payment_anomaly",
  parameters: {
    community_id: string,
    months_back?: number      // Default: 3 bulan terakhir
  },
  returns: {
    flagged_members: Array<{
      member_id, member_name,
      late_payment_count, avg_days_late
    }>
  }
}
```

### 6.4 Natural Language Query Tools

```typescript
// ✅ TOOL: answer_kas_query
// Deskripsi: Jawab pertanyaan natural language seputar keuangan komunitas
// Contoh: "Berapa saldo kas kita?", "Siapa yang belum bayar?"
{
  name: "answer_kas_query",
  parameters: {
    community_id: string,
    query: string             // Pertanyaan dalam bahasa natural
  },
  returns: {
    answer: string,           // Jawaban dalam bahasa natural
    data?: object             // Data mentah jika diperlukan
  }
}
```

---

## 7. Autonomous Loop — Detail Alur

Ini adalah inti dari sistem — agent berjalan sendiri tanpa perlu diinstruksikan.

### 7.1 Monthly Billing Loop (Trigger: Tanggal 1 setiap bulan, 08.00 WIB)

```
[CRON: 0 8 1 * *] — Setiap tanggal 1, jam 08.00

START: Monthly Billing Loop
│
├─► 1. Ambil semua komunitas aktif dari DB
│       → SELECT * FROM communities WHERE is_active = true
│
├─► 2. Untuk setiap komunitas:
│   │
│   ├─► a. Cek apakah konfigurasi billing sudah lengkap
│   │       (monthly_fee > 0 && ada anggota aktif)
│   │
│   ├─► b. Panggil bulk_create_invoices(community_id, bulan_ini)
│   │       → DOKU API: buat payment link per anggota
│   │       → Simpan ke tabel invoices
│   │
│   ├─► c. Panggil send_invoice_notifications() untuk semua anggota
│   │       → Kirim pesan WA: "Halo [Nama], tagihan iuran RT bulan [Bulan]
│   │          sebesar Rp [Amount] telah diterbitkan.
│   │          Bayar sebelum [Due Date]: [Payment Link]"
│   │
│   └─► d. Log aktivitas ke agent_logs
│
END: Semua komunitas sudah ditagih
```

### 7.2 Payment Monitoring Loop (Trigger: Setiap 6 jam)

```
[CRON: 0 */6 * * *] — Setiap 6 jam sekali

START: Payment Monitoring Loop
│
├─► 1. Ambil semua invoice berstatus 'pending'
│
├─► 2. Untuk setiap invoice pending:
│   │
│   ├─► a. Panggil check_payment_status(invoice_id)
│   │       → Hit DOKU API untuk cek status real-time
│   │
│   ├─► b. Jika STATUS = 'paid':
│   │   │   → Update status invoice → 'paid'
│   │   │   → Panggil update_kas_balance() → catat pemasukan
│   │   │   → Kirim notif ke bendahara: "✅ [Nama] sudah bayar Rp [Amount]"
│   │   │   → Kirim konfirmasi ke anggota: "✅ Pembayaran diterima. Terima kasih!"
│   │   └─► Log aktivitas
│   │
│   ├─► c. Jika STATUS = 'pending' && sudah lewat 3 hari && reminder_count < 3:
│   │   │   → Panggil send_payment_reminder(invoice_id)
│   │   │   → Update reminder_count + 1
│   │   └─► Log aktivitas
│   │
│   └─► d. Jika STATUS = 'pending' && sudah lewat due_date:
│           → Update status invoice → 'overdue'
│           → Kirim notif ke bendahara tentang invoice overdue
│           └─► Log aktivitas
│
END: Semua invoice sudah dicek
```

### 7.3 Monthly Report Loop (Trigger: Tanggal terakhir setiap bulan, 21.00 WIB)

```
[CRON: 0 21 28-31 * *] — Tanggal 28-31, jam 21.00 (dengan pengecekan hari terakhir)

START: Monthly Report Loop
│
├─► 1. Cek apakah ini hari terakhir bulan ini
│
├─► 2. Untuk setiap komunitas aktif:
│   │
│   ├─► a. Panggil generate_monthly_report(community_id, bulan_ini)
│   │
│   ├─► b. Panggil detect_payment_anomaly() → identifikasi anggota sering telat
│   │
│   ├─► c. Kirim ringkasan laporan ke bendahara:
│   │       "📊 Laporan Keuangan [Nama Komunitas] — [Bulan]
│   │        ✅ Terkumpul: Rp [Amount] ([X] dari [Total] anggota)
│   │        ⚠️ Belum bayar: [X] anggota
│   │        💰 Saldo kas: Rp [Balance]
│   │        📎 Laporan lengkap: [Link]"
│   │
│   └─► d. Kirim laporan transparansi ke semua anggota (opsional)
│
END: Semua laporan sudah dikirim
```

---

## 8. DOKU Payment Integration

### 8.1 Setup DOKU

```typescript
// src/plugins/doku-plugin/doku-client.ts

const DOKU_BASE_URL = process.env.DOKU_BASE_URL || "https://api-sandbox.doku.com";
const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;

// Fungsi utama: Buat payment link
export async function createPaymentLink(params: {
  invoiceNumber: string;
  amount: number;
  description: string;
  customerName: string;
  customerPhone: string;
  expiryMinutes?: number;
}) {
  const response = await fetch(`${DOKU_BASE_URL}/checkout/v1/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": DOKU_CLIENT_ID,
      "Request-Id": generateRequestId(),
      "Request-Timestamp": new Date().toISOString(),
      "Signature": generateSignature(params),
    },
    body: JSON.stringify({
      order: {
        invoice_number: params.invoiceNumber,
        amount: params.amount,
        currency: "IDR",
        callback_url: `${process.env.APP_URL}/webhook/doku`,
        auto_redirect: true,
      },
      customer: {
        name: params.customerName,
        phone: params.customerPhone,
      },
      payment: {
        payment_due_date: params.expiryMinutes || 4320, // 3 hari default
      },
    }),
  });

  const data = await response.json();
  return {
    payment_url: data.response.payment.url,
    invoice_id: data.response.order.invoice_number,
  };
}
```

### 8.2 DOKU Webhook Handler

```typescript
// src/webhook/doku-webhook.ts
// DOKU akan hit endpoint ini setiap ada perubahan status pembayaran

app.post("/webhook/doku", async (req, res) => {
  const { order, payment } = req.body;

  // Verifikasi signature dari DOKU
  const isValid = verifyDokuSignature(req.headers, req.body);
  if (!isValid) return res.status(401).json({ error: "Invalid signature" });

  if (payment.status === "SUCCESS") {
    // 1. Update status invoice di DB
    await updateInvoiceStatus(order.invoice_number, "paid");

    // 2. Catat ke kas
    await updateKasBalance({
      type: "income",
      amount: order.amount,
      description: `Pembayaran ${order.invoice_number}`,
    });

    // 3. Notifikasi ke bendahara & anggota
    await sendPaymentConfirmation(order.invoice_number);
  }

  res.json({ status: "ok" });
});
```

### 8.3 Environment Variables yang Dibutuhkan

```bash
# .env.example

# DOKU Payment
DOKU_CLIENT_ID=your_client_id_here
DOKU_SECRET_KEY=your_secret_key_here
DOKU_BASE_URL=https://api-sandbox.doku.com   # Ganti ke production saat deploy

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/komunitasai

# App
APP_URL=https://your-app-url.com             # Untuk webhook callback
PORT=3000

# AI (ElizaOS)
OPENAI_API_KEY=your_openai_key               # Atau Anthropic key
ANTHROPIC_API_KEY=your_anthropic_key

# Notifications (opsional)
WHATSAPP_API_KEY=your_wa_key
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

---

## 9. ElizaOS Agent Setup

### 9.1 Character File (Kepribadian Agent)

```json
// characters/bendahara-ai.json
{
  "name": "BendaharaAI",
  "username": "bendahara_ai",
  "plugins": ["@komunitas/doku-plugin", "@komunitas/community-plugin"],
  "clients": ["direct"],
  "modelProvider": "anthropic",
  "settings": {
    "voice": { "model": "en_US-male-medium" }
  },
  "bio": [
    "Aku adalah Bendahara Digital untuk komunitasmu.",
    "Aku mengelola keuangan komunitas secara otomatis dan transparan.",
    "Aku bisa menagih iuran, memonitor pembayaran, dan membuat laporan keuangan.",
    "Aku selalu menjawab dalam Bahasa Indonesia yang ramah dan profesional."
  ],
  "lore": [
    "Dibuat untuk membantu bendahara RT, arisan, dan koperasi di seluruh Indonesia.",
    "Setiap transaksi dicatat dengan transparan untuk kepercayaan komunitas."
  ],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": { "text": "Siapa yang belum bayar iuran bulan ini?" }
      },
      {
        "user": "BendaharaAI",
        "content": {
          "text": "Berikut anggota yang belum bayar iuran bulan ini:\n\n1. Pak Budi (No. 12) - Rp 50.000\n2. Bu Sari (No. 23) - Rp 50.000\n3. Pak Joko (No. 31) - Rp 50.000\n\nTotal belum terkumpul: Rp 150.000. Mau aku kirimkan reminder sekarang?"
        }
      }
    ],
    [
      {
        "user": "{{user1}}",
        "content": { "text": "Tagih semua warga iuran bulan ini" }
      },
      {
        "user": "BendaharaAI",
        "content": {
          "text": "Baik! Aku sedang membuat 45 tagihan untuk semua anggota aktif...\n\n✅ Selesai! 45 tagihan berhasil dibuat.\n💰 Total tagihan: Rp 2.250.000\n📅 Jatuh tempo: 7 hari\n📱 Notifikasi sudah dikirim ke semua anggota."
        }
      }
    ]
  ],
  "style": {
    "all": [
      "Selalu jawab dalam Bahasa Indonesia",
      "Gunakan emoji yang relevan untuk memudahkan pemahaman",
      "Selalu konfirmasi sebelum melakukan aksi yang tidak bisa dibatalkan",
      "Berikan ringkasan angka yang jelas dan mudah dipahami"
    ]
  }
}
```

### 9.2 Registrasi Plugin di ElizaOS

```typescript
// src/index.ts — Entry point utama

import { AgentRuntime, createAgent } from "@elizaos/core";
import { DokuPlugin } from "./plugins/doku-plugin";
import { CommunityPlugin } from "./plugins/community-plugin";
import { NotificationPlugin } from "./plugins/notification-plugin";
import { startAutonomousLoop } from "./scheduler/autonomous-loop";
import character from "../characters/bendahara-ai.json";

async function main() {
  // Inisialisasi agent ElizaOS
  const runtime = new AgentRuntime({
    character,
    plugins: [
      DokuPlugin,
      CommunityPlugin,
      NotificationPlugin,
    ],
  });

  await runtime.initialize();
  console.log("✅ BendaharaAI agent started!");

  // Jalankan autonomous loop
  startAutonomousLoop(runtime);
  console.log("✅ Autonomous loops scheduled!");
}

main().catch(console.error);
```

---

## 10. API Endpoints

Endpoint ini digunakan oleh frontend dashboard untuk berkomunikasi dengan backend.

```
BASE URL: /api/v1

# COMMUNITIES
GET    /communities                    → List semua komunitas user
POST   /communities                    → Buat komunitas baru
GET    /communities/:id                → Detail komunitas
PUT    /communities/:id                → Update komunitas

# MEMBERS
GET    /communities/:id/members        → List anggota
POST   /communities/:id/members        → Tambah anggota
DELETE /communities/:id/members/:mid   → Hapus/nonaktifkan anggota

# INVOICES
GET    /communities/:id/invoices       → List semua tagihan (bisa filter by status/bulan)
POST   /communities/:id/invoices/bulk  → Buat tagihan massal (trigger manual)
PATCH  /invoices/:id/mark-paid         → Tandai lunas manual

# KAS
GET    /communities/:id/kas            → Ringkasan saldo kas
GET    /communities/:id/kas/entries    → Riwayat transaksi
POST   /communities/:id/kas/entries    → Tambah transaksi manual

# REPORTS
GET    /communities/:id/reports/:month → Laporan bulanan
GET    /communities/:id/reports/anomaly → Deteksi anomali pembayaran

# AGENT (Chat Interface)
POST   /agent/chat                     → Kirim pesan ke BendaharaAI agent

# WEBHOOK
POST   /webhook/doku                   → Callback dari DOKU (payment status update)
```

---

## 11. Frontend Dashboard

### 11.1 Halaman Utama (Dashboard)

Komponen yang harus ada:
- **KasSummaryCard** — Saldo kas saat ini, income bulan ini, expense bulan ini
- **InvoiceStatusChart** — Pie chart: sudah bayar vs belum bayar
- **RecentTransactions** — 5 transaksi terbaru
- **AgentChatWidget** — Floating chat untuk ngobrol dengan BendaharaAI
- **UpcomingDueDate** — Tagihan yang akan jatuh tempo dalam 3 hari

### 11.2 Halaman Anggota

- Tabel anggota dengan filter aktif/nonaktif
- Status pembayaran bulan ini per anggota (✅ Lunas / ⚠️ Belum)
- Tombol "Kirim Reminder" per anggota
- Tambah/hapus anggota

### 11.3 Halaman Laporan

- Dropdown pilih bulan
- Ringkasan statistik bulanan
- Tabel transaksi lengkap
- Tombol export PDF / share ke WhatsApp

---

## 12. Timeline Build 12 Jam

> **Start:** Jumat, 15 Mei 2026, 09.45 WIB
> **Deadline:** Jumat, 15 Mei 2026, 23.00 WIB

### JAM 0 — 09.45 s/d 10.45 WIB (1 jam)
**SETUP AWAL**
- [ ] Buat GitHub repo: `OpenClaw2026_NamaTim_KomunitasAI` (WAJIB setelah 09.45!)
- [ ] Init project: `npm init`, setup TypeScript, install ElizaOS
- [ ] Setup database PostgreSQL (bisa pakai Supabase free tier)
- [ ] Jalankan `schema.sql` untuk buat tabel
- [ ] Setup `.env` dengan DOKU sandbox credentials
- [ ] Commit pertama: "chore: initial project setup"

### JAM 1–3 — 10.45 s/d 12.45 WIB (2 jam)
**CORE AGENT & DATABASE**
- [ ] Buat `characters/bendahara-ai.json`
- [ ] Setup ElizaOS runtime dasar (`src/index.ts`)
- [ ] Implementasi `community-tools.ts`: `get_all_members`, `get_unpaid_invoices`, `update_kas_balance`
- [ ] Buat CommunityPlugin dan daftarkan tools
- [ ] Test: agent bisa jawab "Siapa anggota komunitas ini?" dengan data dari DB
- [ ] Commit: "feat: core agent + community tools"

### JAM 3–5 — 12.45 s/d 14.45 WIB (2 jam)
**DOKU PAYMENT INTEGRATION**
- [ ] Implementasi `doku-client.ts`: `createPaymentLink`, `checkPaymentStatus`
- [ ] Implementasi `payment-tools.ts`: `create_payment_link`, `bulk_create_invoices`, `check_payment_status`
- [ ] Setup webhook handler `/webhook/doku`
- [ ] Test dengan DOKU sandbox: buat payment link, simulasi pembayaran
- [ ] Commit: "feat: DOKU payment integration"

### JAM 5–7 — 14.45 s/d 16.45 WIB (2 jam)
**AUTONOMOUS LOOP**
- [ ] Implementasi `autonomous-loop.ts` dengan node-cron
- [ ] Monthly billing loop (trigger manual untuk demo)
- [ ] Payment monitoring loop (check status setiap 6 jam)
- [ ] Reminder logic (kirim setelah 3 hari belum bayar)
- [ ] Test: jalankan billing loop secara manual, pastikan invoice terbuat & notif terkirim
- [ ] Commit: "feat: autonomous billing & monitoring loop"

### JAM 7–8 — 16.45 s/d 17.45 WIB (1 jam)
**REPORTING AGENT**
- [ ] Implementasi `reporting-tools.ts`: `generate_monthly_report`, `detect_payment_anomaly`
- [ ] Natural language query tool: `answer_kas_query`
- [ ] Test: tanya "Berapa saldo kas bulan ini?" → agent jawab dengan data akurat
- [ ] Commit: "feat: reporting agent + NL queries"

### JAM 8–9.5 — 17.45 s/d 19.15 WIB (1.5 jam)
**FRONTEND DASHBOARD (MINIMAL)**
- [ ] Setup React + Tailwind di folder `/frontend`
- [ ] Buat halaman Dashboard: KasSummaryCard + InvoiceStatusChart
- [ ] Buat chat widget untuk ngobrol dengan agent
- [ ] Connect ke API backend
- [ ] Commit: "feat: frontend dashboard"

### JAM 9.5–11 — 19.15 s/d 20.45 WIB (1.5 jam)
**TESTING, POLISH & DOKUMENTASI**
- [ ] End-to-end test: setup komunitas → tagih → bayar → cek laporan
- [ ] Fix bug yang ditemukan
- [ ] Tulis `README.md` yang lengkap (lihat template di bawah)
- [ ] Pastikan `docker-compose.yml` atau instruksi run berfungsi
- [ ] Commit: "docs: complete README + bug fixes"

### JAM 11–12 — 20.45 s/d 21.45 WIB (1 jam)
**DEMO VIDEO**
- [ ] Rekam demo video sesuai script di bawah (maks 2 menit)
- [ ] Upload ke YouTube sebagai Unlisted
- [ ] Judul video: `OpenClaw2026_NamaTim_KomunitasAI`

### SPARE TIME — 21.45 s/d 23.00 WIB (1.15 jam buffer)
**PITCH DECK + SUBMIT**
- [ ] Buat pitch deck 5 slide (Canva/Google Slides → export PDF)
- [ ] Nama file: `OpenClaw2026_NamaTim_KomunitasAI.pdf`
- [ ] Submit ke Devpost sebelum 23.00 WIB
- [ ] Centang label **Best Payment Use Case**
- [ ] Pastikan semua link bisa diakses publik

---

## 13. Demo Video Script

> **Durasi target: 90 detik** (buffer 30 detik)
> **Format:** Screen recording + voice over

```
[0:00–0:10] OPENING
Tampilkan dashboard KomunitasAI
VO: "Ini adalah KomunitasAI — bendahara digital otomatis untuk komunitas Indonesia."

[0:10–0:25] PROBLEM
VO: "Setiap bulan, bendahara RT harus wa satu-satu untuk nagih iuran. 
     Dengan KomunitasAI, ini semua otomatis."

[0:25–0:55] DEMO AUTONOMOUS LOOP
Trigger billing loop manual → tampilkan 45 payment link terbuat
VO: "Cukup satu klik, agen langsung buat 45 tagihan dan kirim ke semua anggota."
Simulasi pembayaran dari anggota → tampilkan notifikasi real-time masuk
VO: "Saat anggota bayar, kas langsung terupdate secara real-time."

[0:55–1:15] DEMO NATURAL LANGUAGE
Ketik di chat: "Siapa yang belum bayar iuran bulan ini?"
Agent jawab dengan daftar nama
Ketik: "Kirim reminder ke semua yang belum bayar"
Agent kirim reminder, tampilkan konfirmasi
VO: "Bendahara tinggal ngobrol natural, agen yang kerjakan semuanya."

[1:15–1:35] DEMO LAPORAN
Tampilkan generate_monthly_report → laporan muncul
VO: "Di akhir bulan, agen otomatis buat laporan transparansi yang bisa dibagikan ke warga."

[1:35–1:50] CLOSING
Tampilkan halaman dashboard dengan statistik
VO: "KomunitasAI — untuk 4 juta lebih RT di Indonesia yang butuh bendahara yang tidak pernah lelah."
```

---

## 14. Pitch Deck Outline

> **Maks 5 slide, format PDF**

### Slide 1 — Cover
- Logo KomunitasAI
- Tagline: *"Bendahara Digital untuk Komunitas Indonesia"*
- Nama tim & anggota (singkat)
- OpenClaw Agenthon 2026

### Slide 2 — Problem Statement
- 3 pain point utama (dengan visual/ikon)
- Data: "4+ juta RT di Indonesia, semua dikelola manual"
- Quote relatable: *"WA group RT penuh tagihan iuran yang diabaikan"*

### Slide 3 — Solution & AI Agent Workflow
- Diagram arsitektur multi-agent (simpel, visual)
- Alur autonomous loop dalam 4 langkah
- Screenshot dashboard & chat interface

### Slide 4 — Key Features & Tech Stack
- 4–5 fitur utama dengan ikon
- Tech stack: ElizaOS · DOKU API · Node.js · PostgreSQL · React
- Highlight: "Autonomous loop — berjalan sendiri 24/7"

### Slide 5 — Impact & Future
- Dampak langsung: berapa bendahara yang bisa terbantu
- Roadmap: WhatsApp Bot, mobile app, koperasi digital
- Call to action

---

## 15. README Template

```markdown
# KomunitasAI 🏘️
> Bendahara digital otomatis untuk komunitas Indonesia

## Deskripsi
KomunitasAI adalah AI Agent berbasis ElizaOS yang secara otonom mengelola 
keuangan komunitas — dari penagihan iuran, monitoring pembayaran, 
pengiriman reminder, hingga pembuatan laporan keuangan transparan.

## Prerequisites
- Node.js v18+
- PostgreSQL 14+
- DOKU API credentials (sandbox tersedia gratis)

## Cara Menjalankan

### 1. Clone repository
git clone https://github.com/[username]/OpenClaw2026_NamaTim_KomunitasAI
cd OpenClaw2026_NamaTim_KomunitasAI

### 2. Install dependencies
npm install

### 3. Setup environment
cp .env.example .env
# Isi DOKU_CLIENT_ID, DOKU_SECRET_KEY, DATABASE_URL

### 4. Setup database
psql -U postgres -c "CREATE DATABASE komunitasai"
psql -U postgres -d komunitasai -f src/database/schema.sql

### 5. Jalankan aplikasi
npm run dev

### 6. Akses dashboard
Buka http://localhost:3000

## Cara Menggunakan
1. Daftarkan komunitas baru dari dashboard
2. Tambahkan anggota beserta nomor HP
3. Set iuran bulanan
4. Klik "Aktifkan Auto-Billing" — agen akan berjalan otomatis!

## Demo
[Link YouTube demo video]

## Tim
- [Nama 1] — Full-stack Development
- [Nama 2] — ...
```

---

## 16. Submission Checklist

### Sebelum Submit

**GitHub Repository:**
- [ ] Repo dibuat SETELAH 09.45 WIB tanggal 15 Mei 2026
- [ ] Nama repo: `OpenClaw2026_NamaTim_KomunitasAI`
- [ ] Status: **Public**
- [ ] Ada file `README.md` dengan instruksi instalasi lengkap
- [ ] Commit history menunjukkan progres selama kompetisi
- [ ] Tidak ada commit setelah 23.00 WIB

**Demo Video:**
- [ ] Judul: `OpenClaw2026_NamaTim_KomunitasAI`
- [ ] Durasi: maksimal 2 menit
- [ ] Upload ke YouTube, mode akses: **Unlisted**
- [ ] Audio jelas, tampilan produk terlihat dengan baik
- [ ] Autonomous loop dan tool calls terlihat berjalan

**Pitch Deck:**
- [ ] Nama file: `OpenClaw2026_NamaTim_KomunitasAI.pdf`
- [ ] Format: PDF
- [ ] Maks 5 slide
- [ ] Mencakup semua 5 poin yang disyaratkan

### Saat Submit di Devpost

- [ ] Nama tim format: `OpenClaw2026_NamaTim`
- [ ] Project Description: deskripsi naratif lengkap
- [ ] GitHub Repository link
- [ ] Demo Video (YouTube Unlisted)
- [ ] Pitch Deck PDF ter-upload
- [ ] Label **Best Payment Use Case** dicentang ✅
- [ ] AI Tools / Models Used: ElizaOS, Claude/GPT-4o, DOKU API
- [ ] Submit sebelum **23.00 WIB, 15 Mei 2026**

### Verifikasi Akhir
- [ ] Semua link GitHub, YouTube, dan Devpost bisa dibuka tanpa perlu request permission
- [ ] README README cukup jelas untuk dijalankan oleh juri dari nol
- [ ] Demo video menampilkan alur agent bekerja secara autonomous

---

*Good luck! Semangat build-nya! 🚀*
*"Komunitas yang kuat dimulai dari transparansi finansial."*
```
