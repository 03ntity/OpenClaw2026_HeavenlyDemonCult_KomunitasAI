# KomunitasAI

**Autonomous AI treasurer for Indonesian communities.**

KomunitasAI adalah agent bendahara digital berbasis ElizaOS untuk membantu RT/RW, arisan, koperasi, event, dan patungan mengelola kas komunitas lewat chat. Agent dapat membuat tagihan DOKU, mengirim invoice ke WhatsApp, memantau pembayaran, mencatat pemasukan/pengeluaran kas, mengirim reminder, dan membuat laporan bulanan.

## What It Does

- **Conversational onboarding**: buat komunitas dan daftar anggota cukup lewat chat.
- **DOKU payment integration**: buat payment link, QRIS, dan virtual account/bank transfer.
- **WhatsApp delivery via WAHA**: kirim invoice, QRIS sebagai gambar, reminder, dan konfirmasi pembayaran ke WhatsApp.
- **DOKU webhook**: saat pembayaran sukses, agent otomatis menandai invoice lunas dan mencatat kas masuk.
- **Payment notifications**: member yang ditagih, admin/bendahara, dan user yang menjalankan workflow bisa menerima notifikasi pembayaran sukses.
- **Idempotent notification delivery**: pesan WhatsApp dilindungi dari double-send saat scheduler/action berjalan bersamaan.
- **Autonomous workflow schedule**: workflow bisa dijalankan manual atau dijadwalkan, misalnya setiap 1 menit, 1 jam, atau harian.
- **Cash ledger**: catat pemasukan/pengeluaran kas seperti `catat pengeluaran Rp 20.000 untuk bayar sampah`.
- **Monthly report**: laporan bulanan berisi pemasukan, pengeluaran, net balance, collection rate, dan status pembayaran anggota.
- **React dashboard**: dashboard lokal untuk melihat ringkasan komunitas, anggota, invoice, kas, dan log aktivitas.

## Example Chat Commands

```text
buat komunitas baru
```

```text
tagih semua warga bulan ini
```

```text
kirim tagihan QRIS untuk Yanto
```

```text
kirim tagihan bank transfer BCA untuk Siti
```

```text
jalankan workflow billing lengkap
```

```text
jalankan workflow setiap 1 jam
```

```text
catat pengeluaran Rp 20.000 untuk bayar sampah
```

```text
buat laporan bulan ini
```

## Architecture

```text
User / Admin
   |
   | chat / dashboard / WhatsApp webhook
   v
ElizaOS Runtime
   |
   | actions, providers, routes, service
   v
KomunitasAI Plugin
   |
   +-- PostgreSQL: communities, members, invoices, kas, logs, schedules
   +-- DOKU MCP/API: payment link, QRIS, VA, status check, webhook
   +-- WAHA: send WhatsApp text/image and receive WhatsApp messages
```

Payment flow:

```text
Agent creates invoice
   -> DOKU returns payment link / QRIS / VA
   -> WAHA sends invoice to member
   -> Member pays
   -> DOKU calls /webhook/doku
   -> Agent marks invoice paid
   -> Kas income is recorded
   -> Member/admin/workflow requester receive payment success notification
```

## Tech Stack

| Area            | Technology           |
| --------------- | -------------------- |
| Agent runtime   | ElizaOS              |
| Language        | TypeScript           |
| Package manager | Bun                  |
| Database        | PostgreSQL           |
| Payment         | DOKU MCP/API         |
| WhatsApp        | WAHA                 |
| Frontend        | React + Tailwind CSS |
| Validation      | Zod                  |

## Requirements

Install these first:

1. **Git**: untuk clone repository.
2. **Bun**: JavaScript runtime/package manager. Install from `https://bun.sh`.
3. **PostgreSQL**: database untuk menyimpan komunitas, invoice, kas, dan logs.
4. **LLM provider key**: OpenAI/OpenRouter/Anthropic atau gateway OpenAI-compatible.
5. **DOKU sandbox credentials**: untuk membuat payment link, QRIS, dan VA.
6. **WAHA server**: opsional tapi diperlukan untuk kirim/terima WhatsApp.

## Beginner Installation Guide

### 1. Clone Repository

```bash
git clone https://github.com/03ntity/OpenClaw2026_HeavenlyDemonCult_KomunitasAI.git
cd OpenClaw2026_HeavenlyDemonCult_KomunitasAI
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Create Environment File

Copy contoh environment:

```bash
cp .env.example .env
```

Di Windows PowerShell, jika `cp` tidak tersedia:

```powershell
Copy-Item .env.example .env
```

### 4. Configure Database

Buat database PostgreSQL, misalnya `komunitas_ai`, lalu isi `.env`:

```env
POSTGRES_URL=postgresql://postgres:password@localhost:5432/komunitas_ai
```

Ganti `postgres`, `password`, dan nama database sesuai setup lokal.

### 5. Configure LLM

Pilih salah satu.

OpenAI:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_SMALL_MODEL=gpt-4o-mini
OPENAI_LARGE_MODEL=gpt-4o
```

OpenRouter:

```env
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_SMALL_MODEL=google/gemini-2.0-flash-001
OPENROUTER_LARGE_MODEL=google/gemini-2.5-flash
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_EMBEDDING_DIMENSIONS=1536
```

OpenAI-compatible gateway lain:

```env
OPENAI_API_KEY=your_gateway_key
OPENAI_BASE_URL=https://your-gateway.example.com/v1
OPENAI_SMALL_MODEL=your-small-model
OPENAI_LARGE_MODEL=your-large-model
```

Jika gateway tidak support embeddings, isi embedding provider terpisah:

```env
OPENAI_EMBEDDING_URL=https://openrouter.ai/api/v1
OPENAI_EMBEDDING_API_KEY=your_embedding_key
OPENAI_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
```

### 6. Configure DOKU

Isi kredensial sandbox DOKU:

```env
DOKU_CLIENT_ID=your_doku_client_id
DOKU_SECRET_KEY=your_doku_secret_key
DOKU_MCP_URL=https://api-sandbox.doku.com/doku-mcp-server/mcp
DOKU_AUTHORIZATION=Basic your-base64-encoded-api-key-colon
```

`DOKU_AUTHORIZATION` mengikuti format docs DOKU MCP: Base64 dari `<api-key>:` lalu diberi prefix `Basic `. Untuk backward compatibility, `DOKU_MCP_API_KEY=your_raw_api_key` masih didukung dan akan diubah menjadi header Basic otomatis.

Untuk webhook lokal, expose server dengan tunnel seperti ngrok/cloudflared, lalu set:

```env
APP_URL=https://your-public-url.example.com
```

Webhook endpoint yang perlu diarahkan dari DOKU:

```text
POST https://your-public-url.example.com/webhook/doku
```

### 7. Configure WAHA WhatsApp

WAHA dipakai untuk mengirim invoice/reminder/QRIS/konfirmasi ke WhatsApp.

```env
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=your_waha_api_key
WAHA_SESSION=default
```

Jika ingin admin/bendahara juga menerima notifikasi pembayaran sukses:

```env
KOMUNITAS_ADMIN_WHATSAPP=6281111111111
```

Bisa lebih dari satu nomor:

```env
KOMUNITAS_ADMIN_WHATSAPP=6281111111111,6282222222222
```

WAHA webhook endpoint untuk pesan masuk:

```text
POST https://your-public-url.example.com/webhook/waha
```

### 8. Optional Demo Mode

Untuk demo hackathon, reminder bisa dibuat terus berjalan walaupun sudah melewati batas normal:

```env
WORKFLOW_DEMO_MODE=true
```

Untuk penggunaan normal, biarkan kosong atau `false`.

### 9. Run The Agent

Development mode:

```bash
bun run dev
```

Production-like mode:

```bash
bun run start
```

Lalu buka dashboard:

```text
http://localhost:3000
```

## Recommended First Run

1. Buka dashboard lokal.
2. Pilih character agent, misalnya `BendaharaRT`.
3. Ketik:

```text
buat komunitas baru
```

4. Isi data dalam satu pesan, contoh:

```text
Nama komunitas: RT 06 RW 05 Kelapa Gading
Iuran bulanan: 100000
Daftar anggota:
1. Yanto - 081234567890
2. Siti - 081234567891
```

5. Buat tagihan:

```text
tagih semua warga bulan ini
```

6. Jalankan monitoring:

```text
cek pembayaran pending
```

7. Catat pengeluaran:

```text
catat pengeluaran Rp 20.000 untuk bayar sampah
```

8. Buat laporan:

```text
buat laporan bulan ini
```

## API Routes

| Method | Endpoint                                       | Description                                          |
| ------ | ---------------------------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/v1/komunitas/summary`                    | Ringkasan komunitas, anggota, kas, invoice, dan logs |
| `POST` | `/api/v1/komunitas/reminders/send`             | Kirim reminder pembayaran                            |
| `POST` | `/api/v1/komunitas/payments/simulate`          | Simulasi pembayaran sukses                           |
| `POST` | `/api/v1/invoices/:invoiceId/simulate-payment` | Simulasi pembayaran untuk invoice tertentu           |
| `POST` | `/api/v1/komunitas/billing/bulk`               | Buat invoice massal                                  |
| `POST` | `/api/v1/komunitas/payments/check`             | Cek status pembayaran pending                        |
| `POST` | `/api/v1/komunitas/reports/current`            | Buat laporan bulanan                                 |
| `POST` | `/api/v1/agent/actions/run-billing-loop`       | Jalankan billing loop                                |
| `POST` | `/api/v1/agent/actions/run-monitoring-loop`    | Jalankan monitoring loop                             |
| `POST` | `/api/v1/agent/actions/run-report-loop`        | Jalankan report loop                                 |
| `POST` | `/webhook/doku`                                | Webhook pembayaran DOKU                              |
| `POST` | `/webhook/waha`                                | Webhook pesan masuk WAHA                             |
| `GET`  | `/api/v1/komunitas/characters`                 | Daftar character agent                               |
| `GET`  | `/api/v1/doku-mcp/tools`                       | Daftar semua tools DOKU MCP dari `tools/list`        |
| `POST` | `/api/v1/doku-mcp/tools/call`                  | Panggil tool DOKU MCP apa pun lewat `tools/call`     |

## Core Actions

| Action                      | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `HANDLE_ONBOARDING_INPUT`   | Membuat komunitas dan anggota dari input chat             |
| `GET_ALL_MEMBERS`           | Menampilkan anggota aktif                                 |
| `CREATE_PAYMENT_LINK`       | Membuat satu DOKU payment link                            |
| `CREATE_QRIS_BILL`          | Membuat tagihan QRIS dan mengirim gambar QRIS ke WhatsApp |
| `CREATE_BANK_TRANSFER_BILL` | Membuat tagihan virtual account/bank transfer             |
| `BULK_CREATE_INVOICES`      | Membuat invoice untuk semua anggota aktif                 |
| `CHECK_PAYMENT_STATUS`      | Mengecek status pembayaran DOKU                           |
| `SEND_PAYMENT_REMINDERS`    | Mengirim reminder pembayaran                              |
| `UPDATE_KAS_BALANCE`        | Mencatat pemasukan/pengeluaran kas                        |
| `GET_KAS_SUMMARY`           | Melihat saldo kas                                         |
| `GENERATE_MONTHLY_REPORT`   | Membuat laporan bulanan                                   |
| `SET_WORKFLOW_SCHEDULE`     | Menjadwalkan workflow otomatis                            |
| `FULL_BILLING_WORKFLOW`     | Menjalankan tagih, cek pembayaran, reminder, dan laporan  |
| `LIST_DOKU_MCP_TOOLS`       | Mengambil daftar semua tools DOKU MCP yang tersedia       |
| `CALL_DOKU_MCP_TOOL`        | Memanggil tool DOKU MCP generic berdasarkan `toolName`    |

## Notes For Payments And WhatsApp

- QRIS dikirim sebagai gambar ke WhatsApp jika DOKU mengembalikan `qrString` atau payment URL yang bisa dirender.
- Link staging/payment tetap disertakan di caption WhatsApp.
- Saat pembayaran sukses, agent dapat mengirim notifikasi ke member, admin, dan requester workflow.
- Notification delivery memakai tabel `notification_deliveries` agar pesan yang sama tidak terkirim dua kali.
- Jika WAHA belum dikonfigurasi, fungsi keuangan tetap berjalan, tetapi pesan WhatsApp tidak dikirim.

## Troubleshooting

### `input?.trim is not a function`

Pastikan sudah memakai versi terbaru kode ini. Handler onboarding sudah dibuat lebih aman untuk input non-string.

### WhatsApp message terkirim double

Pastikan service sudah direstart setelah update terbaru. Database perlu membuat tabel `notification_deliveries`.

### Workflow berjalan sekali lalu berhenti

Cek log scheduler dan pastikan schedule tersimpan di tabel `workflow_schedules`. Gunakan command:

```text
jalankan workflow setiap 1 menit
```

### Payment success tidak memicu notifikasi

Periksa:

- `APP_URL` sudah public dan bisa diakses DOKU.
- DOKU webhook diarahkan ke `/webhook/doku`.
- `DOKU_SECRET_KEY` benar jika signature verification aktif.
- `WAHA_BASE_URL`, `WAHA_API_KEY`, dan `WAHA_SESSION` benar.
- Nomor admin diisi pada `KOMUNITAS_ADMIN_WHATSAPP` jika ingin admin mendapat notifikasi.

### Amount kas salah

Gunakan format eksplisit:

```text
catat pengeluaran Rp 20.000 untuk bayar sampah
```

Action kas sekarang tidak memakai default nominal. Jika nominal tidak jelas, transaksi tidak akan dicatat.

## Development Commands

```bash
bun run type-check
```

```bash
bun run build
```

```bash
bun run format
```

## Team

**HeavenlyDemonCult**  
OpenClaw Agenthon 2026

## License

MIT License
