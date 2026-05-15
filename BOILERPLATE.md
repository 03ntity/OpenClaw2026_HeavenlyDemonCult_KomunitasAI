# KomunitasAI — Panduan Setup Agent Baru

Setiap tipe komunitas punya agent tersendiri dengan karakter dan bahasa yang berbeda.
Pilih template yang sesuai, isi data komunitas, dan jalankan.

---

## Tipe Agent yang Tersedia

| File                                 | Agent             | Untuk                                      |
| ------------------------------------ | ----------------- | ------------------------------------------ |
| `characters/rt-rw.character.json`    | BendaharaRT       | RT, RW, lingkungan perumahan               |
| `characters/arisan.character.json`   | BendaharaArisan   | Arisan bulanan, arisan PKK                 |
| `characters/koperasi.character.json` | BendaharaKoperasi | Koperasi simpan pinjam                     |
| `characters/event.character.json`    | BendaharaEvent    | Panitia event, 17 Agustus, dll             |
| `characters/patungan.character.json` | BendaharaPatungan | Split bill, patungan liburan, makan bareng |

---

## Cara Setup Agent Baru

### Langkah 1 — Copy character file

```bash
cp characters/rt-rw.character.json characters/rt-05-rw-03.character.json
```

### Langkah 2 — Edit nama dan komunitas

Buka file yang baru di-copy, ubah field berikut:

```json
{
  "name": "BendaharaRT05",
  "username": "bendahara_rt05",
  "settings": {
    "communityType": "rt",
    "communityName": "RT 05 RW 03 Kelapa Gading",
    "monthlyFee": 50000
  }
}
```

Field yang wajib diubah:

- `name` — nama agent (tampil di chat)
- `username` — username unik (huruf kecil, underscore)
- `settings.communityName` — nama komunitas lengkap
- `settings.monthlyFee` — iuran bulanan dalam rupiah

### Langkah 3 — Jalankan agent

```bash
elizaos start --character characters/rt-05-rw-03.character.json
```

Atau tambahkan ke `src/index.ts` untuk multi-agent:

```typescript
import rt05Character from "../characters/rt-05-rw-03.character.json";

export const projectAgent: ProjectAgent = {
  character: rt05Character,
  plugins: [starterPlugin],
};
```

### Langkah 4 — Setup komunitas via chat

Saat pertama kali chat, agent akan tanya:

1. Nama komunitas (jika belum diset di character file)
2. Data anggota satu per satu

Atau langsung ketik:

```
Buat komunitas baru
```

---

## Contoh Setup Per Tipe

### RT/RW

```json
{
  "name": "BendaharaRT05",
  "settings": {
    "communityType": "rt",
    "communityName": "RT 05 RW 03 Kelapa Gading",
    "monthlyFee": 50000
  }
}
```

### Arisan

```json
{
  "name": "BendaharaArisanPKK",
  "settings": {
    "communityType": "arisan",
    "communityName": "Arisan PKK RT 05",
    "monthlyFee": 200000
  }
}
```

### Koperasi

```json
{
  "name": "BendaharaKopMajuBersama",
  "settings": {
    "communityType": "koperasi",
    "communityName": "Koperasi Maju Bersama",
    "monthlyFee": 100000
  }
}
```

### Event

```json
{
  "name": "BendaharaPanitia17an",
  "settings": {
    "communityType": "event",
    "communityName": "Panitia 17 Agustus 2026",
    "monthlyFee": 75000
  }
}
```

### Patungan

```json
{
  "name": "BendaharaPatunganBali",
  "settings": {
    "communityType": "other",
    "splitBill": true,
    "communityName": "Patungan Liburan Bali 2026",
    "monthlyFee": 500000
  }
}
```

---

## Multi-Agent (Beberapa Komunitas Sekaligus)

Untuk menjalankan beberapa agent sekaligus, tambahkan semua character ke `src/index.ts`:

```typescript
import { type Project } from "@elizaos/core";
import starterPlugin from "./plugin.ts";

import rt05 from "../characters/rt-05-rw-03.character.json";
import arisanPkk from "../characters/arisan-pkk.character.json";

const project: Project = {
  agents: [
    { character: rt05, plugins: [starterPlugin] },
    { character: arisanPkk, plugins: [starterPlugin] },
  ],
};

export default project;
```

Setiap agent punya session chat terpisah dan data komunitas terpisah di database.

---

## Environment Variables yang Diperlukan

```bash
# Database (wajib)
POSTGRES_URL=postgresql://user:pass@host:5432/komunitas-ai

# Model AI (pilih salah satu)
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# DOKU Payment (untuk tagihan)
DOKU_CLIENT_ID=BRN-xxxx
DOKU_MCP_API_KEY=doku_key_sandbox_xxx
```

---

## Struktur Database

Semua agent berbagi satu database PostgreSQL, tapi data dipisah per `community_id`.
Satu agent = satu komunitas = satu `community_id` di tabel `communities`.

```
communities
  └── members (anggota komunitas)
  └── invoices (tagihan iuran)
  └── kas_entries (catatan kas)
  └── agent_logs (log aktivitas)
```
