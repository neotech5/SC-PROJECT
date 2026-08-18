# LoveLink 💞 — Game Multiplayer Online untuk Pasangan

Game web realtime untuk 2 orang (pasangan couple). Dibuka langsung di browser HP,
tanpa install apa pun: satu orang buat room, pasangan gabung pakai kode 4 karakter.

## Mode Permainan

| Mode | Cara main |
| --- | --- |
| 💌 **Seberapa Kenal Kamu?** | 6 ronde. Tiap ronde kamu menjawab pertanyaan tentang dirimu sendiri **dan** menebak jawaban pasangan. Tebakan benar = 1 poin. |
| 🎲 **Truth or Dare Couple** | Giliran bergantian, pilih Truth atau Dare, lalu tandai selesai atau skip. Dare selesai = 2 poin, truth = 1 poin. |
| 💓 **Sinkron Hati** | Hati menyala di waktu acak; kalian berdua harus tap sebarengan. Makin kecil selisih tap (ms), makin banyak love point. Curang (tap sebelum menyala) = 0. |

Plus chat realtime di dalam room dan love point bersama.

## Menjalankan Secara Lokal

```bash
cd couple-game
npm install
npm start          # default http://localhost:3000
PORT=8080 npm start
```

Buka di HP yang satu jaringan lewat `http://<IP-komputer>:3000`, atau deploy ke
hosting Node apa pun (Render, Railway, Fly.io, VPS) — cukup `npm install && npm start`,
server membaca `process.env.PORT`.

## Cara Main Bareng

1. Orang pertama isi nama panggilan → **Buat Room Baru**.
2. Tekan tombol ⇪ untuk share kode/link ke pasangan (WhatsApp dll).
3. Pasangan buka link atau isi kode 4 karakter → **Gabung**.
4. Setelah keduanya masuk, pilih mode dan main. Pilihan mode langsung sinkron di kedua HP.

## Arsitektur

```
couple-game/
├── server.js          # Express + Socket.IO, event handler per room
├── src/rooms.js       # RoomStore: state room, aturan tiap mode, masking state per pemain
├── src/content.js     # bank pertanyaan kuis, kartu truth & dare, avatar
└── public/            # klien statis (mobile-first, tanpa framework)
    ├── index.html
    ├── styles.css
    └── app.js
```

- State disimpan **in-memory** per room (`Map` kode → room), maksimal 2 pemain aktif.
- Tiap pemain menerima state yang sudah di-masking: jawaban pasangan disembunyikan
  sampai fase reveal.
- Reconnect otomatis: kalau koneksi HP terputus, masuk lagi dengan nama yang sama
  akan melanjutkan slot pemain yang lama.
- Room dibersihkan otomatis (idle > 6 jam, atau kosong > 30 menit).

## Lint

```bash
npm run lint
```
