# KomunitasAI

**Bendahara Digital Otomatis untuk Komunitas Indonesia**

## Tentang

Pengelolaan keuangan komunitas skala kecil seperti RT/RW, arisan, koperasi, event, dan patungan sering kali menyita waktu dan rentan kesalahan. Pencatatan manual, penagihan iuran, dan pembuatan laporan menjadi beban administratif yang berat bagi pengurus.

KomunitasAI hadir sebagai solusi bendahara digital berbasis ElizaOS yang bekerja secara otonom. Sistem ini tidak hanya mencatat transaksi, tetapi juga secara aktif menagih iuran, memantau pembayaran, mengirim pengingat, dan membuat laporan keuangan—semuanya berjalan otomatis tanpa intervensi manual.

Dengan 6 AI agent spesialis dan integrasi DOKU MCP yang mendukung 39 metode pembayaran, KomunitasAI memberikan pengalaman pengelolaan keuangan yang profesional namun mudah digunakan melalui antarmuka chat yang natural.

## Fitur Utama

- 🤖 **6 AI Agent Spesialis** — BendaharaAI (general), BendaharaRT, BendaharaArisan, BendaharaKoperasi, BendaharaEvent, BendaharaPatungan
- 💳 **Tagihan Otomatis via DOKU Checkout** — 39 metode pembayaran (e-wallet, virtual account, QRIS, kartu kredit, dll)
- 🔄 **Autonomous Task Loop** — billing otomatis tanggal 1, monitoring setiap 6 jam, laporan akhir bulan
- 🎯 **Multi-Step Workflow Otomatis** — FULL_BILLING_WORKFLOW (tagih → cek status → reminder → laporan)
- 💬 **Onboarding Conversational** — agent bertanya data komunitas via chat, tidak perlu form
- 🗑️ **Reset Data dengan Konfirmasi LLM** — hapus data dengan konfirmasi natural language
- 🖥️ **Dashboard React + Floating Chat Widget** — UI modern dengan Tailwind CSS
- 💾 **PostgreSQL Persistence** — semua data tersimpan aman dan terstruktur

## Demo Flow (5 Menit)

Ikuti langkah berikut untuk mendemonstrasikan KomunitasAI kepada juri:

**Step 1: Buka Dashboard**

```
Akses http://localhost:3000
Pilih agent "BendaharaRT" dari dropdown
```

**Step 2: Buat Komunitas Baru**

```
Chat: "buat komunitas baru"
Agent akan bertanya:
- Nama komunitas? (contoh: "RT 05 RW 03")
- Iuran bulanan? (contoh: "50000")
- Nama anggota? (contoh: "Budi, Siti, Andi")
```

**Step 3: Tagih Semua Warga**

```
Chat: "tagih semua warga bulan ini"
Agent membuat invoice DOKU untuk setiap anggota
Lihat link pembayaran yang dihasilkan
```

**Step 4: Simulasi Pembayaran**

```
Chat: "simulasi bayar untuk Budi"
Sistem mensimulasikan pembayaran sukses
Kas komunitas bertambah otomatis
```

**Step 5: Cek Saldo Kas**

```
Chat: "berapa saldo kas sekarang?"
Agent menampilkan saldo terkini dan rincian transaksi
```

**Step 6: Jalankan Workflow Billing**

```
Chat: "jalankan workflow billing lengkap"
Agent menjalankan FULL_BILLING_WORKFLOW:
1. Buat tagihan untuk semua anggota
2. Cek status pembayaran
3. Kirim reminder ke yang belum bayar
4. Generate laporan
```

**Step 7: Buat Laporan Keuangan**

```
Chat: "buat laporan bulan ini"
Agent menghasilkan laporan lengkap:
- Total pemasukan
- Total pengeluaran
- Saldo akhir
- Daftar yang belum bayar
```

## Cara Menjalankan

**1. Setup Environment**

```bash
cp .env.example .env
```

**2. Isi Konfigurasi di `.env`**

```env
POSTGRES_URL=postgresql://user:password@localhost:5432/komunitasai
OPENAI_API_KEY=sk-your-openai-key
DOKU_CLIENT_ID=your-doku-client-id
DOKU_SECRET_KEY=your-doku-secret-key
DOKU_MCP_API_KEY=your-doku-mcp-api-key
```

**3. Install Dependencies**

```bash
bun install
```

**4. Jalankan ElizaOS**

```bash
elizaos start
```

**5. Akses Dashboard**

```
Buka browser: http://localhost:3000
```

## Arsitektur

```
┌─────────────────┐
│  React Dashboard│
│  + Chat Widget  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ElizaOS Runtime│
│  (6 AI Agents)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ KomunitasService│
│  + Task Loops   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│DOKU MCP│ │PostgreSQL│
│35 Tools│ │ Database │
└────────┘ └──────────┘
```

**Flow:**

1. User berinteraksi via chat widget
2. ElizaOS agent memproses intent dengan LLM
3. KomunitasService menjalankan business logic
4. DOKU MCP menangani payment operations (35+ tools)
5. PostgreSQL menyimpan semua data transaksi
6. Autonomous loops berjalan di background (billing, monitoring, reporting)

## Tech Stack

| Komponen            | Teknologi                      |
| ------------------- | ------------------------------ |
| **AI Runtime**      | ElizaOS                        |
| **LLM Provider**    | OpenAI GPT-4o-mini             |
| **Frontend**        | React 19 + Tailwind CSS        |
| **Database**        | PostgreSQL                     |
| **Payment Gateway** | DOKU MCP (39 payment channels) |
| **Package Manager** | Bun                            |
| **Language**        | TypeScript                     |

## API Routes

| Method | Endpoint                                           | Deskripsi                          |
| ------ | -------------------------------------------------- | ---------------------------------- |
| GET    | `/komunitas-ai/api/v1/komunitas/summary`           | Ringkasan semua komunitas          |
| POST   | `/komunitas-ai/api/v1/komunitas/billing/bulk`      | Tagih semua anggota sekaligus      |
| POST   | `/komunitas-ai/api/v1/komunitas/payments/simulate` | Simulasi pembayaran (sandbox)      |
| GET    | `/komunitas-ai/api/v1/komunitas/characters`        | Daftar 6 AI agents                 |
| POST   | `/komunitas-ai/webhook/doku`                       | Webhook notifikasi pembayaran DOKU |
| GET    | `/komunitas-ai/api/v1/komunitas/:id/report`        | Generate laporan keuangan          |
| POST   | `/komunitas-ai/api/v1/komunitas/reset`             | Reset data komunitas               |

## Autonomous Task Loops

KomunitasAI menjalankan 3 background loops secara otomatis:

**1. Billing Loop** (Setiap tanggal 1)

- Membuat tagihan untuk semua anggota
- Mengirim invoice via DOKU Checkout

**2. Monitoring Loop** (Setiap 6 jam)

- Cek status pembayaran
- Kirim reminder ke yang belum bayar
- Update status transaksi

**3. Report Loop** (Akhir bulan)

- Generate laporan keuangan lengkap
- Kirim notifikasi ke pengurus
- Archive data bulan sebelumnya

## Multi-Step Workflow

**FULL_BILLING_WORKFLOW** menjalankan 4 tahap secara berurutan:

```
1. CREATE_INVOICES
   ↓
2. CHECK_PAYMENT_STATUS
   ↓
3. SEND_REMINDERS
   ↓
4. GENERATE_REPORT
```

Workflow ini bisa dipicu manual via chat atau berjalan otomatis sesuai schedule.

## Tim

**HeavenlyDemonCult** — OpenClaw Agenthon 2026

## License

MIT License

---

**🚀 KomunitasAI: Bendahara yang Tidak Pernah Tidur**
