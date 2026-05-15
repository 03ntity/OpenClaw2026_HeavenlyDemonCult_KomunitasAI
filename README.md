# KomunitasAI

Bendahara digital otomatis untuk komunitas Indonesia.

Pengelolaan keuangan untuk komunitas skala kecil seperti RT, arisan, koperasi, dan kas kelas sering kali menyita waktu. Pencatatan manual rentan terhadap kesalahan manusia. KomunitasAI hadir sebagai agen AI berbasis ElizaOS yang bertindak layaknya bendahara sungguhan. Sistem ini bekerja secara mandiri untuk mengotomatiskan penagihan, memantau pembayaran, dan membuat laporan keuangan.

## Fitur Utama

- **Penagihan Otomatis:** Sistem membuat dan mendistribusikan tagihan iuran secara berkala kepada seluruh anggota.
- **Pemantauan Pembayaran:** Pelacakan status pembayaran berjalan secara real-time melalui integrasi DOKU API.
- **Pengingat Pintar:** Agen secara aktif mengirimkan pesan pengingat kepada anggota yang belum melunasi tagihan.
- **Laporan Keuangan:** Pembuatan ringkasan pemasukan dan pengeluaran berjalan secara otomatis.
- **Chat Agent:** Pengurus dan anggota dapat menanyakan informasi saldo atau status iuran melalui antarmuka percakapan natural.

## Prerequisites

Pastikan Anda telah memasang kebutuhan berikut sebelum memulai:

- Bun
- PostgreSQL
- Akun Sandbox DOKU

## Cara Install dan Jalankan

1. Salin file template environment:

   ```bash
   cp .env.example .env
   ```

2. Buka file `.env` dan isi variabel `POSTGRES_URL` dengan alamat database PostgreSQL Anda.

3. Masukkan kredensial dari akun Sandbox DOKU ke dalam file `.env`.

4. Unduh semua dependensi proyek:

   ```bash
   bun install
   ```

5. Mulai server dalam mode pengembangan:
   ```bash
   bun run dev
   ```

## Cara Demo

Ikuti panduan langkah demi langkah berikut untuk mendemonstrasikan kemampuan KomunitasAI:

1. **Tambah Komunitas:** Buat profil entitas komunitas baru pada antarmuka sistem.
2. **Tambah Anggota:** Masukkan data diri anggota komunitas yang akan menerima tagihan.
3. **Tagih Iuran:** Perintahkan agen untuk membuat tagihan iuran.
4. **Simulasi Bayar:** Buka halaman pembayaran dan gunakan akun DOKU sandbox untuk menyimulasikan transaksi sukses.
5. **Cek Saldo:** Gunakan fitur chat untuk bertanya kepada agen mengenai total kas komunitas saat ini.
6. **Generate Laporan:** Minta agen menyusun laporan keuangan terbaru.

## Tech Stack

- ElizaOS
- React
- Tailwind CSS
- PostgreSQL
- DOKU API

## Tim

HeavenlyDemonCult - OpenClaw Agenthon 2026

## License

MIT License
