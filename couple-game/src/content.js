'use strict';

const QUIZ_QUESTIONS = [
  { q: 'Bila dia sedang moody, dia lebih suka ...', options: ['Dipeluk', 'Dibiar sendiri dulu', 'Dibawa makan', 'Dibawa berbual'] },
  { q: 'Menu makan malam impian dia?', options: ['Nasi lemak', 'Sushi', 'Ayam goreng', 'Pizza'] },
  { q: 'Jenis dating yang paling dia suka?', options: ['Tengok wayang di rumah', 'Jalan-jalan di mall', 'Piknik di taman', 'Cari makan malam'] },
  { q: 'Dia lebih pilih ...', options: ['Pantai', 'Gunung', 'Bandar besar', 'Kampung'] },
  { q: 'Tabiat dia sebelum tidur?', options: ['Scroll telefon', 'Baca / dengar muzik', 'Terus tidur', 'Berbual dulu'] },
  { q: 'Hadiah yang paling buat dia gembira?', options: ['Surat tulisan tangan', 'Barang yang lama diidam', 'Makanan kegemaran', 'Masa berdua tanpa telefon'] },
  { q: 'Kalau ada duit lebih, dia akan ...', options: ['Simpan', 'Belanja pasangan', 'Beli skincare/gadget', 'Bercuti'] },
  { q: 'Perkara kecil yang paling dia hargai?', options: ['Mesej "dah makan?"', 'Dihantar balik', 'Dibelikan air kegemaran', 'Dipanggil nama manja'] },
  { q: 'Filem yang dia akan pilih malam ini?', options: ['Romantik', 'Seram', 'Komedi', 'Aksi'] },
  { q: 'Dia paling tak tahan kalau ...', options: ['Ditipu', 'Mesej tak dibalas', 'Dibanding-bandingkan', 'Ditinggal masa merajuk'] },
  { q: 'Bangun pagi, benda pertama dia cari?', options: ['Telefon', 'Air', 'Pasangannya', 'Tandas'] },
  { q: 'Muzik yang paling kerap dia pasang?', options: ['Pop Melayu', 'K-Pop', 'Lo-fi / instrumental', 'Rock / metal'] },
  { q: 'Bila bergaduh, dia biasanya ...', options: ['Diam dulu', 'Terus bercakap', 'Menangis', 'Buat lawak supaya reda'] },
  { q: 'Percutian ideal berdua selama seminggu?', options: ['Langkawi', 'Jepun', 'Staycation dalam bandar sendiri', 'Road trip'] },
  { q: 'Panggilan manja kegemaran dia?', options: ['Sayang', 'Bie / Beb', 'Abang / Kakak', 'Nama panggilan pelik'] },
  { q: 'Dia lebih suka dapat kejutan ...', options: ['Depan orang ramai', 'Berdua sahaja', 'Melalui hadiah dihantar', 'Tak suka kejutan'] },
  { q: 'Minuman wajib dia?', options: ['Kopi', 'Teh', 'Boba', 'Air kosong'] },
  { q: 'Kalau hujung minggu, dia nak ...', options: ['Tidur sepuas hati', 'Keluar rumah', 'Kemas rumah', 'Main game'] },
];

const TRUTHS = [
  'Bila kali pertama awak sedar awak suka pada saya?',
  'Perkara apa tentang saya yang paling buat awak jatuh cinta?',
  'Tabiat saya yang buat awak geram tetapi awak tahan sahaja?',
  'Bila kali terakhir awak menangis kerana saya?',
  'Rahsia kecil yang awak belum pernah ceritakan kepada saya?',
  'Detik paling romantik kita pada pandangan awak?',
  'Apa yang awak takutkan tentang hubungan kita?',
  'Kalau boleh minta satu perkara daripada saya, apa dia?',
  'Mesej saya yang mana masih awak simpan sampai sekarang?',
  'Apa yang awak nak ubah tentang diri awak untuk saya?',
  'Siapa yang lebih kerap mengalah pada pandangan awak?',
  'Impian yang awak nak capai bersama saya dalam 5 tahun?',
];

const DARES = [
  'Hantar voice note cakap "saya sayang awak" secara berlagu.',
  'Cerita 3 perkara yang awak suka tentang saya, tanpa berhenti.',
  'Tukar nama panggilan saya dalam telefon awak jadi paling lawak, hantar screenshot.',
  'Nyanyi satu rangkap lagu yang paling melekat dengan hubungan kita.',
  'Karang sajak 4 baris tentang saya, sekarang.',
  'Selfie dengan muka paling buruk dan hantar kepada saya.',
  'Tulis status/story tentang saya (boleh close friend sahaja).',
  'Lakonkan cara saya merajuk, saya yang menilai.',
  'Janjikan satu perkara kecil yang awak akan buat untuk saya esok.',
  'Tiru gaya saya bercakap selama 1 minit.',
  'Hantar gambar pertama kita yang ada dalam galeri awak.',
  'Cakap sesuatu yang manis kepada saya dalam bahasa lain.',
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
