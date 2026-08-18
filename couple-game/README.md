# LoveLink 💞 — Permainan Multiplayer Online untuk Pasangan

Permainan web realtime untuk 2 orang (pasangan). Boleh dibuka terus dalam pelayar telefon,
tanpa perlu pasang apa-apa: seorang buka bilik, pasangan masuk guna kod 4 aksara.

## Mod Permainan

| Mod | Cara main |
| --- | --- |
| 💌 **Sejauh Mana Awak Kenal?** | 6 pusingan. Setiap pusingan awak jawab soalan tentang diri sendiri **dan** teka jawapan pasangan. Tekaan betul = 1 mata. |
| 🎲 **Truth or Dare Pasangan** | Bergilir-gilir, pilih Truth atau Dare, kemudian tanda selesai atau langkau. Dare selesai = 2 mata, truth = 1 mata. |
| 💓 **Seirama Hati** | Hati menyala pada masa rawak; awak berdua kena tekan serentak. Makin kecil jarak tekan (ms), makin banyak love point. Menipu (tekan sebelum menyala) = 0. |

Ada juga chat realtime dalam bilik dan love point bersama.

## Menjalankan Secara Setempat

```bash
cd couple-game
npm install
npm start          # lalai http://localhost:3000
PORT=8080 npm start
```

Buka pada telefon dalam rangkaian yang sama melalui `http://<IP-komputer>:3000`, atau
deploy ke mana-mana hosting Node (Render, Railway, Fly.io, VPS) — cukup
`npm install && npm start`, pelayan membaca `process.env.PORT`.

## Cara Main Bersama

1. Orang pertama isi nama panggilan → **Buka Bilik Baharu**.
2. Tekan butang ⇪ untuk kongsi kod/pautan kepada pasangan (WhatsApp dll).
3. Pasangan buka pautan atau isi kod 4 aksara → **Masuk**.
4. Selepas kedua-duanya masuk, pilih mod dan main. Pilihan mod terus selari pada kedua-dua telefon.

## Seni Bina

```
couple-game/
├── server.js          # Express + Socket.IO, pengendali event bagi setiap bilik
├── src/rooms.js       # RoomStore: state bilik, peraturan setiap mod, masking state per pemain
├── src/content.js     # bank soalan kuiz, kad truth & dare, avatar
└── public/            # klien statik (mobile-first, tanpa framework)
    ├── index.html
    ├── styles.css
    └── app.js
```

- State disimpan **in-memory** bagi setiap bilik (`Map` kod → bilik), maksimum 2 pemain aktif.
- Setiap pemain menerima state yang sudah di-mask: jawapan pasangan disembunyikan
  sampai fasa reveal.
- Sambung semula automatik: kalau sambungan telefon terputus, masuk semula dengan nama
  yang sama akan menyambung slot pemain yang lama.
- Bilik dibersihkan automatik (idle > 6 jam, atau kosong > 30 minit).

## Lint

```bash
npm run lint
```
