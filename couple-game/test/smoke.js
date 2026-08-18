'use strict';

/**
 * Smoke test tanpa framework: menjalankan server lalu memainkan dua klien
 * (dua "HP") melewati semua mode. Jalankan dengan `npm test`.
 */

const assert = require('assert');
const { io } = require('socket.io-client');
const { server } = require('../server');

const PORT = Number(process.env.SMOKE_PORT) || 4321;

function connect() {
  const socket = io(`http://localhost:${PORT}`, { transports: ['websocket'] });
  const states = [];
  socket.on('state', (s) => states.push(s));
  socket.waitFor = (predicate, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), 15000);
    const check = () => {
      const hit = states.filter(Boolean).reverse().find(predicate);
      if (hit) {
        clearTimeout(timer);
        socket.off('state', check);
        resolve(hit);
      }
    };
    socket.on('state', check);
    check();
  });
  return socket;
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));

  const a = connect();
  const b = connect();

  const created = await emit(a, 'room:create', { name: 'Dina' });
  assert.ok(created.ok && created.code.length === 4, 'room dibuat');
  const joined = await emit(b, 'room:join', { code: created.code, name: 'Rangga' });
  assert.ok(joined.ok, `join berhasil: ${JSON.stringify(joined)}`);
  await a.waitFor((s) => s.full, 'room penuh');

  // --- kuis ---
  a.emit('game:select', { mode: 'quiz' });
  const quizState = await b.waitFor((s) => s.mode === 'quiz' && s.quiz.phase === 'answer', 'kuis mulai');
  const options = quizState.quiz.question.options;
  a.emit('quiz:submit', { self: options[0], guess: options[1] });
  b.emit('quiz:submit', { self: options[1], guess: options[0] });
  const reveal = await a.waitFor((s) => s.quiz && s.quiz.phase === 'reveal', 'reveal kuis');
  assert.strictEqual(reveal.quiz.result.detail.length, 2, 'dua hasil tebakan');
  assert.ok(reveal.quiz.result.detail.every((d) => d.correct), 'kedua tebakan benar');
  a.emit('quiz:next');
  await a.waitFor((s) => s.quiz && s.quiz.phase === 'answer' && s.quiz.round === 2, 'ronde 2');

  // --- truth or dare ---
  a.emit('game:select', { mode: 'td' });
  const tdState = await a.waitFor((s) => s.mode === 'td' && s.td.phase === 'pick', 'td mulai');
  const first = tdState.td.yourTurn ? a : b;
  first.emit('td:pick', { type: 'dare' });
  const card = await b.waitFor((s) => s.td && s.td.phase === 'card', 'kartu dare muncul');
  assert.ok(card.td.card && card.td.type === 'dare', 'kartu dare terisi');
  first.emit('td:resolve', { completed: true });
  await b.waitFor((s) => s.td && s.td.phase === 'pick' && s.td.history.length === 1, 'giliran berganti');

  // --- sinkron hati ---
  a.emit('game:select', { mode: 'sync' });
  await a.waitFor((s) => s.mode === 'sync' && s.sync.phase === 'ready', 'sync siap');
  a.emit('sync:ready', { ready: true });
  b.emit('sync:ready', { ready: true });
  const countdown = await a.waitFor((s) => s.sync && s.sync.phase === 'countdown', 'countdown jalan');
  const delay = countdown.sync.goAt - Date.now() + 120;
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
  a.emit('sync:tap');
  b.emit('sync:tap');
  const result = await a.waitFor((s) => s.sync && s.sync.phase === 'result', 'hasil sync');
  assert.strictEqual(result.sync.last.falseStart, false, 'tidak false start');
  assert.ok(result.sync.last.gap !== null, 'selisih tap terhitung');

  // --- chat ---
  a.emit('chat:send', { text: 'love you 💕' });
  const chatted = await b.waitFor((s) => s.chat.some((m) => m.text === 'love you 💕'), 'chat sampai');
  assert.ok(chatted, 'chat tersinkron');

  a.close();
  b.close();
  await new Promise((resolve) => server.close(resolve));
  process.stdout.write('SMOKE TEST OK: room, kuis, truth or dare, sinkron hati, chat\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`SMOKE TEST GAGAL: ${err.message}\n`);
  process.exit(1);
});
