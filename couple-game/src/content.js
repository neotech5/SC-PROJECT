'use strict';

const QUIZ_QUESTIONS = [
  { q: 'Kalau lagi bete, dia lebih suka ...', options: ['Dipeluk', 'Ditinggal sendiri dulu', 'Diajak makan', 'Diajak ngobrol'] },
  { q: 'Menu makan malam impian dia?', options: ['Bakso', 'Sushi', 'Ayam geprek', 'Pizza'] },
  { q: 'Tipe kencan paling dia suka?', options: ['Nonton di rumah', 'Jalan ke mall', 'Piknik di taman', 'Kulineran malam'] },
  { q: 'Dia lebih milih ...', options: ['Pantai', 'Gunung', 'Kota besar', 'Kampung halaman'] },
  { q: 'Kebiasaan dia sebelum tidur?', options: ['Scroll HP', 'Baca / dengar musik', 'Langsung tidur', 'Ngobrol dulu'] },
  { q: 'Hadiah yang paling bikin dia senang?', options: ['Surat tulisan tangan', 'Barang yang lama diincar', 'Makanan favorit', 'Waktu berdua tanpa HP'] },
  { q: 'Kalau ada uang lebih, dia akan ...', options: ['Ditabung', 'Traktir pasangan', 'Belanja skincare/gadget', 'Liburan'] },
  { q: 'Hal kecil yang paling dia hargai?', options: ['Chat "udah makan?"', 'Dianterin pulang', 'Dibeliin minum favorit', 'Dipanggil nama sayang'] },
  { q: 'Film yang bakal dia pilih malam ini?', options: ['Romantis', 'Horor', 'Komedi', 'Action'] },
  { q: 'Dia paling gak tahan kalau ...', options: ['Dibohongi', 'Diabaikan chat', 'Dibanding-bandingin', 'Ditinggal ngambek'] },
  { q: 'Bangun pagi, hal pertama yang dia cari?', options: ['HP', 'Air minum', 'Pasangannya', 'Kamar mandi'] },
  { q: 'Musik yang paling sering dia putar?', options: ['Pop Indonesia', 'K-Pop', 'Lo-fi / instrumental', 'Rock / metal'] },
  { q: 'Kalau lagi berantem, dia biasanya ...', options: ['Diam dulu', 'Ngomong langsung', 'Nangis', 'Bercanda biar cair'] },
  { q: 'Liburan ideal berdua selama seminggu?', options: ['Bali', 'Jepang', 'Staycation di kota sendiri', 'Road trip'] },
  { q: 'Panggilan sayang favorit dia?', options: ['Sayang', 'Beb', 'Bun / Yah', 'Nama panggilan aneh'] },
  { q: 'Dia lebih suka dikasih kejutan ...', options: ['Di depan orang banyak', 'Berdua aja', 'Lewat hadiah dikirim', 'Gak suka kejutan'] },
  { q: 'Minuman andalan dia?', options: ['Kopi', 'Teh', 'Boba', 'Air putih'] },
  { q: 'Kalau weekend, dia pengennya ...', options: ['Tidur sepuasnya', 'Keluar rumah', 'Beres-beres', 'Main game'] },
];

const TRUTHS = [
  'Kapan pertama kali kamu sadar suka sama aku?',
  'Hal apa dari aku yang paling bikin kamu jatuh cinta?',
  'Kebiasaan aku yang bikin kamu kesel tapi kamu tahan-tahan?',
  'Kapan terakhir kamu nangis karena aku?',
  'Rahasia kecil yang belum pernah kamu ceritain ke aku?',
  'Momen paling romantis kita menurut kamu?',
  'Apa yang kamu takutin dari hubungan kita?',
  'Kalau boleh minta satu hal dari aku, apa?',
  'Chat aku yang mana yang kamu simpan sampai sekarang?',
  'Hal apa yang pengen kamu ubah dari diri kamu buat aku?',
  'Siapa yang lebih sering ngalah menurut kamu?',
  'Mimpi yang pengen kamu wujudkan bareng aku dalam 5 tahun?',
];

const DARES = [
  'Kirim voice note bilang "aku sayang kamu" pakai nada lagu.',
  'Ceritain 3 hal yang kamu suka dari aku, tanpa berhenti.',
  'Ganti nama panggilan aku di HP kamu jadi yang paling lucu, screenshot.',
  'Nyanyi 1 bait lagu yang paling nempel di hubungan kita.',
  'Bikin puisi 4 baris tentang aku, sekarang.',
  'Selfie dengan ekspresi paling jelek lalu kirim ke aku.',
  'Tulis status/story tentang aku (boleh close friend saja).',
  'Peragakan cara aku ngambek, aku yang nilai.',
  'Janjikan satu hal kecil yang kamu lakukan besok buat aku.',
  'Tiru gaya bicara aku selama 1 menit.',
  'Kirim foto pertama kita yang ada di galeri kamu.',
  'Bilang hal manis ke aku pakai bahasa daerah/asing.',
];

const AVATARS = ['🐻', '🐰', '🦊', '🐼', '🐨', '🐧', '🦄', '🐥'];

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickQuizQuestions(count) {
  return shuffle(QUIZ_QUESTIONS).slice(0, count);
}

function pickCard(type) {
  const pool = type === 'dare' ? DARES : TRUTHS;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { QUIZ_QUESTIONS, TRUTHS, DARES, AVATARS, shuffle, pickQuizQuestions, pickCard };
