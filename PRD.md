# Product Requirements Document: KomunitasAI

## 1. Product Overview

**KomunitasAI** adalah bendahara digital otomatis untuk komunitas Indonesia. Produk ini membantu bendahara RT, arisan, koperasi kecil, kas kelas, dan komunitas event untuk membuat tagihan, memonitor pembayaran, mengirim reminder, mencatat kas, dan membuat laporan keuangan secara otomatis.

Untuk MVP hackathon, KomunitasAI berfokus pada satu alur utama: bendahara membuat komunitas, menambahkan anggota, membuat tagihan iuran massal, melihat status pembayaran, dan mendapatkan ringkasan laporan kas. AI agent digunakan sebagai antarmuka natural language dan autonomous worker untuk menjalankan billing, reminder, monitoring, dan reporting.

## 2. Goals

### Product Goals

- Mengurangi pekerjaan manual bendahara dalam menagih iuran komunitas.
- Membuat status pembayaran anggota mudah dipantau.
- Menyediakan pencatatan kas yang transparan dan mudah dibagikan.
- Menunjukkan autonomous agent loop yang bisa bekerja tanpa instruksi manual terus-menerus.
- Menampilkan integrasi pembayaran DOKU sebagai use case pembayaran utama.

### Hackathon Goals

- Demo end-to-end berjalan dalam waktu 90-120 detik.
- Menonjolkan penggunaan AI agent, tool calls, autonomous loop, dan DOKU payment.
- MVP bisa dijalankan lokal oleh juri melalui instruksi README.
- Tetap realistis untuk dibangun dalam waktu terbatas.

## 3. Non-Goals

Fitur berikut tidak masuk scope MVP:

- Sistem autentikasi multi-user penuh.
- WhatsApp Business API production.
- Rekonsiliasi bank otomatis selain DOKU webhook/status.
- Mobile app native.
- Akuntansi koperasi lengkap seperti SHU, bunga pinjaman, audit ledger kompleks.
- Permission system detail antar role komunitas.
- PDF report production-grade.

## 4. Target Users

### Primary User: Bendahara Komunitas

Contoh: bendahara RT, pengurus arisan, bendahara kas kelas, panitia event.

Kebutuhan utama:

- Cepat tahu siapa yang sudah dan belum bayar.
- Bisa membuat tagihan massal tanpa input satu-satu.
- Bisa mengirim reminder dengan mudah.
- Bisa melihat saldo kas dan transaksi.
- Bisa membuat laporan bulanan yang ringkas.

### Secondary User: Anggota Komunitas

Kebutuhan utama:

- Mendapat link pembayaran yang jelas.
- Mendapat reminder jika belum bayar.
- Bisa melihat transparansi kas secara ringkas.

## 5. Problem Statement

Bendahara komunitas di Indonesia masih banyak melakukan proses keuangan secara manual: menagih melalui grup chat, mencatat pembayaran di spreadsheet, mengecek mutasi satu per satu, dan membuat laporan secara manual. Proses ini memakan waktu, mudah salah, dan sering tidak transparan untuk anggota.

KomunitasAI menyelesaikan masalah ini dengan agent yang dapat membuat tagihan, memonitor pembayaran, memperbarui kas, mengingatkan anggota, dan menjawab pertanyaan bendahara menggunakan bahasa natural.

## 6. MVP Scope

### Must Have

- Dashboard ringkasan komunitas.
- Manajemen anggota sederhana.
- Pembuatan tagihan massal untuk anggota aktif.
- Payment link berbasis DOKU sandbox atau mock-compatible client.
- Status invoice: `pending`, `paid`, `overdue`, `cancelled`.
- Webhook atau simulasi webhook DOKU untuk menandai pembayaran lunas.
- Pencatatan kas otomatis saat invoice paid.
- Agent chat untuk query dan aksi utama.
- Autonomous loop yang bisa dipicu manual untuk demo:
  - bulk billing loop,
  - payment monitoring loop,
  - reminder loop,
  - report generation loop.
- Laporan bulanan ringkas.

### Should Have

- Filter invoice berdasarkan status dan bulan.
- Reminder manual untuk anggota belum bayar.
- Mark paid manual untuk pembayaran tunai.
- Seed data demo komunitas RT.
- Activity log agent.
- README dengan setup dan demo flow.

### Could Have

- Export laporan ke PDF.
- Share summary ke WhatsApp via generated text/link.
- Grafik status pembayaran.
- Deteksi anggota sering telat.
- Arisan draw schedule sederhana.

## 7. Core User Flows

### Flow 1: Setup Komunitas

1. Bendahara membuka dashboard.
2. Bendahara membuat komunitas baru.
3. Bendahara mengisi nama, tipe komunitas, dan iuran bulanan.
4. Sistem menyimpan komunitas.
5. Dashboard menampilkan komunitas aktif.

Acceptance criteria:

- Komunitas baru muncul di dashboard.
- Iuran bulanan tersimpan dan dipakai sebagai default invoice amount.

### Flow 2: Tambah Anggota

1. Bendahara masuk ke halaman anggota.
2. Bendahara menambahkan nama, nomor HP, email opsional, dan alamat opsional.
3. Sistem menyimpan anggota sebagai aktif.
4. Anggota muncul dalam tabel.

Acceptance criteria:

- Anggota baru bisa ditagih.
- Anggota nonaktif tidak ikut bulk billing.

### Flow 3: Buat Tagihan Massal

1. Bendahara klik `Tagih Bulan Ini` atau mengetik di agent chat: `Tagih semua warga iuran bulan ini`.
2. Orchestrator agent memanggil billing tool.
3. Sistem membuat invoice untuk semua anggota aktif.
4. Sistem membuat DOKU payment link atau mock payment link.
5. Sistem menampilkan jumlah invoice berhasil dibuat.

Acceptance criteria:

- Satu invoice dibuat per anggota aktif.
- Invoice memiliki amount, due date, description, status `pending`, dan payment link.
- Agent mengembalikan ringkasan total tagihan.

### Flow 4: Pembayaran Masuk

1. Anggota membayar melalui payment link atau demo men-trigger simulasi pembayaran.
2. DOKU webhook/status check mengirim status sukses.
3. Sistem mengubah invoice menjadi `paid`.
4. Sistem mencatat transaksi income ke kas.
5. Dashboard saldo kas ter-update.

Acceptance criteria:

- Invoice paid tidak tercatat dua kali ke kas.
- Kas bertambah sesuai nominal invoice.
- Agent log mencatat pembayaran.

### Flow 5: Cek Siapa Belum Bayar

1. Bendahara mengetik: `Siapa yang belum bayar iuran bulan ini?`
2. Agent memanggil query tool invoice.
3. Agent menampilkan daftar anggota unpaid dan total nominal belum terkumpul.

Acceptance criteria:

- Jawaban memakai data invoice aktual.
- Jika semua sudah bayar, agent menjawab jelas bahwa tidak ada tunggakan.

### Flow 6: Kirim Reminder

1. Bendahara klik reminder atau mengetik: `Kirim reminder ke semua yang belum bayar`.
2. Agent mengambil invoice unpaid.
3. Sistem mengirim reminder via mock notification.
4. Reminder count bertambah.

Acceptance criteria:

- Reminder hanya dikirim ke invoice unpaid.
- Sistem membatasi reminder otomatis maksimal 3 kali per invoice.
- Log aktivitas tersimpan.

### Flow 7: Generate Laporan Bulanan

1. Bendahara membuka halaman laporan atau mengetik: `Buat laporan bulan ini`.
2. Reporting agent menghitung total terkumpul, pengeluaran, saldo, paid count, unpaid count, dan collection rate.
3. Sistem menampilkan ringkasan laporan.

Acceptance criteria:

- Angka laporan konsisten dengan transaksi dan invoice.
- Laporan bisa ditampilkan ulang tanpa mengubah data transaksi.

## 8. Functional Requirements

### Community Management

- Sistem dapat membuat, membaca, dan mengubah komunitas.
- Sistem dapat menyimpan tipe komunitas: `rt`, `arisan`, `koperasi`, `event`, atau `other`.
- Sistem dapat menyimpan default monthly fee.

### Member Management

- Sistem dapat menambah, membaca, mengubah, dan menonaktifkan anggota.
- Sistem dapat membedakan anggota aktif dan nonaktif.
- Sistem dapat mencari atau filter anggota.

### Invoice Management

- Sistem dapat membuat invoice tunggal dan invoice massal.
- Sistem dapat menghindari duplicate invoice untuk anggota, komunitas, dan periode yang sama.
- Sistem dapat memperbarui status invoice.
- Sistem dapat menandai invoice lunas manual.

### Payment Integration

- Sistem dapat membuat payment link DOKU.
- Sistem dapat berjalan dengan mock payment provider jika credential DOKU tidak tersedia.
- Sistem dapat menerima webhook pembayaran.
- Sistem dapat memverifikasi webhook jika signature tersedia.

### Kas Management

- Sistem dapat mencatat pemasukan dan pengeluaran.
- Sistem dapat mengaitkan pemasukan invoice dengan `reference_id`.
- Sistem dapat menghitung saldo berjalan.

### Agent Chat

- Agent dapat menjawab pertanyaan ringkasan kas.
- Agent dapat menjawab daftar unpaid invoices.
- Agent dapat memicu bulk invoice.
- Agent dapat memicu reminder.
- Agent dapat memicu laporan bulanan.

### Autonomous Loop

- Sistem memiliki scheduled jobs untuk billing bulanan, monitoring pembayaran, reminder, dan report bulanan.
- Untuk demo, setiap loop harus bisa dipanggil manual melalui endpoint atau UI button.

### Dashboard

- Dashboard menampilkan saldo kas, income bulan ini, expense bulan ini, dan status invoice.
- Dashboard menampilkan transaksi terbaru.
- Dashboard menyediakan chat widget agent.
- Dashboard menyediakan aksi demo utama: create invoices, simulate payment, generate report.

## 9. Non-Functional Requirements

- Aplikasi harus bisa dijalankan lokal dengan `npm install` dan `npm run dev`.
- Environment variable sensitif tidak boleh di-commit.
- Data demo harus bisa dibuat melalui seed script.
- API response harus konsisten dalam format JSON.
- Error harus ditampilkan dengan pesan yang bisa dipahami.
- Untuk demo, sistem harus tetap berjalan meskipun DOKU credential tidak ada.
- Kode harus TypeScript-first dan mudah dibaca.

## 10. Data Model

Entitas utama:

- `communities`
- `members`
- `invoices`
- `kas_entries`
- `arisan_sessions`
- `agent_logs`

Relasi utama:

- Satu community memiliki banyak members.
- Satu community memiliki banyak invoices.
- Satu invoice dimiliki satu member.
- Satu paid invoice dapat menghasilkan satu kas entry income.
- Agent logs mencatat aktivitas per community.

## 11. API Requirements

### Communities

- `GET /api/v1/communities`
- `POST /api/v1/communities`
- `GET /api/v1/communities/:id`
- `PUT /api/v1/communities/:id`

### Members

- `GET /api/v1/communities/:id/members`
- `POST /api/v1/communities/:id/members`
- `PUT /api/v1/communities/:id/members/:memberId`
- `DELETE /api/v1/communities/:id/members/:memberId`

### Invoices

- `GET /api/v1/communities/:id/invoices`
- `POST /api/v1/communities/:id/invoices/bulk`
- `PATCH /api/v1/invoices/:invoiceId/mark-paid`
- `POST /api/v1/invoices/:invoiceId/simulate-payment`

### Kas

- `GET /api/v1/communities/:id/kas`
- `GET /api/v1/communities/:id/kas/entries`
- `POST /api/v1/communities/:id/kas/entries`

### Reports

- `GET /api/v1/communities/:id/reports/:month`
- `POST /api/v1/communities/:id/reports/:month/generate`

### Agent

- `POST /api/v1/agent/chat`
- `POST /api/v1/agent/actions/run-billing-loop`
- `POST /api/v1/agent/actions/run-monitoring-loop`
- `POST /api/v1/agent/actions/run-report-loop`

### Webhook

- `POST /webhook/doku`

## 12. Agent Tool Requirements

### Payment Tools

- `create_payment_link`
- `bulk_create_invoices`
- `check_payment_status`
- `get_unpaid_invoices`

### Community Tools

- `get_all_members`
- `send_payment_reminder`
- `update_kas_balance`
- `get_kas_summary`
- `mark_invoice_paid_manual`

### Reporting Tools

- `generate_monthly_report`
- `detect_payment_anomaly`
- `answer_kas_query`

## 13. UX Requirements

### Dashboard

- Harus langsung menunjukkan kondisi keuangan komunitas.
- Primary actions harus mudah ditemukan:
  - tagih bulan ini,
  - kirim reminder,
  - simulasi pembayaran,
  - buat laporan.
- Jangan memakai landing page marketing sebagai layar utama.

### Agent Chat

- Chat harus terasa seperti asisten bendahara.
- Jawaban harus ringkas, memakai angka jelas, dan berbahasa Indonesia.
- Untuk aksi berisiko, agent harus memberi konfirmasi atau ringkasan aksi.

### Visual Direction

- UI harus terasa seperti dashboard kerja, bukan landing page.
- Gunakan layout padat, tabel jelas, dan kartu statistik sederhana.
- Gunakan warna status yang familiar:
  - paid: hijau,
  - pending: kuning/biru,
  - overdue: merah,
  - cancelled: abu-abu.

## 14. Demo Requirements

Demo utama harus menampilkan:

1. Dashboard KomunitasAI dengan data komunitas RT.
2. Bendahara menjalankan bulk billing.
3. Sistem membuat banyak invoice dan payment link.
4. Simulasi pembayaran satu atau beberapa anggota.
5. Saldo kas berubah otomatis.
6. Agent menjawab pertanyaan `Siapa yang belum bayar?`
7. Agent mengirim reminder.
8. Laporan bulanan dibuat.

## 15. Success Metrics

### MVP Success

- Bulk billing untuk minimal 10 anggota demo berhasil.
- Payment simulation mengubah invoice menjadi paid.
- Kas summary berubah otomatis.
- Agent chat bisa menjalankan minimal 4 intent:
  - cek kas,
  - cek unpaid,
  - tagih iuran,
  - buat laporan.
- Demo flow selesai di bawah 2 menit.

### Product Impact Metrics

- Waktu bendahara membuat tagihan turun dari hitungan jam menjadi kurang dari 1 menit.
- Status pembayaran bisa diketahui real-time.
- Laporan bulanan bisa dibuat otomatis.

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| DOKU credential belum siap | Demo payment gagal | Sediakan mock payment provider dengan interface sama |
| ElizaOS integration terlalu lama | Agent tidak siap demo | Buat deterministic agent action router untuk MVP |
| Database setup lambat | Onboarding juri sulit | Sediakan seed script dan fallback SQLite/in-memory jika perlu |
| Webhook butuh public URL | Local demo sulit | Sediakan endpoint simulate payment |
| Scope terlalu luas | MVP tidak selesai | Fokus hanya RT monthly fee flow |

## 17. Milestone Plan

### Milestone 1: Foundation

- Project bisa dijalankan.
- Env example tersedia.
- Database schema dan seed data tersedia.
- Dashboard bisa membuka data komunitas demo.

### Milestone 2: Billing Core

- Members dan invoices berjalan.
- Bulk invoice bisa membuat invoice untuk semua anggota aktif.
- Mock/DOKU payment link tersimpan.

### Milestone 3: Payment and Kas

- Simulate payment/webhook berjalan.
- Invoice paid memperbarui kas.
- Dashboard menampilkan saldo dan invoice status.

### Milestone 4: Agent and Loops

- Agent chat menjalankan intent utama.
- Manual trigger autonomous loop tersedia.
- Reminder dan report generation berjalan.

### Milestone 5: Demo Polish

- README selesai.
- Seed data demo rapi.
- Demo flow stabil.
- Pitch/demo script final.

## 18. Open Questions

- Apakah DOKU sandbox credential sudah tersedia?
- Apakah ingin memakai database PostgreSQL lokal, Supabase, atau fallback lokal untuk demo?
- Apakah ElizaOS wajib benar-benar menjalankan semua tool, atau cukup agent-compatible action layer untuk MVP?
- Nama tim final apa yang akan dipakai untuk repo, deck, dan video?

