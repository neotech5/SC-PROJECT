'use strict';

const { AVATARS, pickQuizQuestions, pickCard } = require('./content');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 2;
const QUIZ_ROUNDS = 6;
const SYNC_ROUNDS = 5;
const SYNC_TAP_TIMEOUT_MS = 6000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const CHAT_HISTORY = 40;

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function scoreGap(gapMs) {
  if (gapMs <= 150) return 3;
  if (gapMs <= 400) return 2;
  if (gapMs <= 800) return 1;
  return 0;
}

/**
 * In-memory store of couple rooms. Every mutation returns the room so the
 * caller can broadcast a fresh view to both partners.
 */
class RoomStore {
  constructor({ onChange } = {}) {
    this.rooms = new Map();
    this.onChange = onChange || (() => {});
    this.timers = new Map();
  }

  createRoom(player) {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();

    const room = {
      code,
      createdAt: Date.now(),
      lastActive: Date.now(),
      players: [],
      mode: 'menu',
      chat: [],
      love: 0,
      quiz: null,
      td: null,
      sync: null,
    };
    this.rooms.set(code, room);
    this.joinRoom(code, player);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(String(code || '').trim().toUpperCase()) || null;
  }

  joinRoom(code, { id, name }) {
    const room = this.getRoom(code);
    if (!room) return { error: 'Kode room tidak ditemukan.' };

    const existing = room.players.find((p) => p.name.toLowerCase() === name.toLowerCase() && !p.connected);
    if (existing) {
      existing.id = id;
      existing.connected = true;
      room.lastActive = Date.now();
      return { room, player: existing, rejoined: true };
    }

    const active = room.players.filter((p) => p.connected);
    if (active.length >= MAX_PLAYERS) return { error: 'Room sudah penuh (maksimal 2 orang).' };

    const player = {
      id,
      name,
      avatar: AVATARS[room.players.length % AVATARS.length],
      score: 0,
      connected: true,
      ready: false,
    };
    room.players.push(player);
    room.lastActive = Date.now();
    return { room, player };
  }

  leaveRoom(code, playerId) {
    const room = this.getRoom(code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
      player.ready = false;
    }
    room.lastActive = Date.now();
    if (room.players.every((p) => !p.connected)) this.clearTimer(code);
    return room;
  }

  isFull(room) {
    return room.players.filter((p) => p.connected).length === MAX_PLAYERS;
  }

  partnerOf(room, playerId) {
    return room.players.find((p) => p.id !== playerId) || null;
  }

  addChat(code, playerId, text) {
    const room = this.getRoom(code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    const clean = String(text || '').slice(0, 300).trim();
    if (!clean) return null;
    room.chat.push({ from: player.name, avatar: player.avatar, text: clean, ts: Date.now() });
    if (room.chat.length > CHAT_HISTORY) room.chat.shift();
    room.lastActive = Date.now();
    return room;
  }

  /* ----------------------------- mode handling ---------------------------- */

  selectMode(code, mode) {
    const room = this.getRoom(code);
    if (!room) return null;
    if (!this.isFull(room)) return room;

    this.clearTimer(code);
    room.mode = mode;
    room.lastActive = Date.now();

    if (mode === 'quiz') {
      room.quiz = {
        questions: pickQuizQuestions(QUIZ_ROUNDS),
        index: 0,
        total: QUIZ_ROUNDS,
        phase: 'answer',
        answers: {},
        result: null,
      };
      room.players.forEach((p) => { p.score = 0; });
    } else if (mode === 'td') {
      room.td = {
        turnId: room.players.filter((p) => p.connected)[0].id,
        phase: 'pick',
        type: null,
        card: null,
        history: [],
      };
    } else if (mode === 'sync') {
      room.sync = {
        round: 0,
        total: SYNC_ROUNDS,
        phase: 'ready',
        goAt: null,
        taps: {},
        results: [],
      };
      room.players.forEach((p) => { p.ready = false; });
    } else {
      room.mode = 'menu';
      room.quiz = null;
      room.td = null;
      room.sync = null;
    }
    return room;
  }

  backToMenu(code) {
    return this.selectMode(code, 'menu');
  }

  /* -------------------------------- quiz ---------------------------------- */

  submitQuiz(code, playerId, { self, guess }) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'quiz' || room.quiz.phase !== 'answer') return room;
    const question = room.quiz.questions[room.quiz.index];
    if (!question) return room;
    if (!question.options.includes(self) || !question.options.includes(guess)) return room;

    room.quiz.answers[playerId] = { self, guess };
    room.lastActive = Date.now();

    const active = room.players.filter((p) => p.connected);
    if (active.every((p) => room.quiz.answers[p.id])) {
      const detail = active.map((p) => {
        const partner = this.partnerOf(room, p.id);
        const mine = room.quiz.answers[p.id];
        const theirs = partner ? room.quiz.answers[partner.id] : null;
        const correct = Boolean(theirs && mine.guess === theirs.self);
        if (correct) p.score += 1;
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          self: mine.self,
          guess: mine.guess,
          partnerSelf: theirs ? theirs.self : null,
          correct,
        };
      });
      const bothCorrect = detail.length === MAX_PLAYERS && detail.every((d) => d.correct);
      if (bothCorrect) room.love += 2;
      room.quiz.phase = 'reveal';
      room.quiz.result = { question: question.q, detail, bothCorrect };
    }
    return room;
  }

  nextQuizRound(code) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'quiz' || room.quiz.phase !== 'reveal') return room;
    room.quiz.answers = {};
    room.quiz.result = null;
    room.quiz.index += 1;
    room.quiz.phase = room.quiz.index >= room.quiz.total ? 'done' : 'answer';
    room.lastActive = Date.now();
    return room;
  }

  /* ---------------------------- truth or dare ----------------------------- */

  pickCard(code, playerId, type) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'td' || room.td.phase !== 'pick') return room;
    if (room.td.turnId !== playerId) return room;
    room.td.type = type === 'dare' ? 'dare' : 'truth';
    room.td.card = pickCard(room.td.type);
    room.td.phase = 'card';
    room.lastActive = Date.now();
    return room;
  }

  resolveCard(code, playerId, completed) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'td' || room.td.phase !== 'card') return room;
    if (room.td.turnId !== playerId) return room;

    const player = room.players.find((p) => p.id === playerId);
    if (completed && player) {
      player.score += room.td.type === 'dare' ? 2 : 1;
      room.love += 1;
    }
    room.td.history.unshift({
      name: player ? player.name : '?',
      type: room.td.type,
      card: room.td.card,
      completed: Boolean(completed),
    });
    room.td.history = room.td.history.slice(0, 10);

    const partner = this.partnerOf(room, playerId);
    room.td.turnId = partner && partner.connected ? partner.id : playerId;
    room.td.type = null;
    room.td.card = null;
    room.td.phase = 'pick';
    room.lastActive = Date.now();
    return room;
  }

  /* --------------------------- sinkron hati ------------------------------- */

  setReady(code, playerId, ready) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'sync' || room.sync.phase !== 'ready') return room;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return room;
    player.ready = Boolean(ready);
    room.lastActive = Date.now();

    const active = room.players.filter((p) => p.connected);
    if (active.length === MAX_PLAYERS && active.every((p) => p.ready)) {
      room.sync.phase = 'countdown';
      room.sync.taps = {};
      room.sync.goAt = Date.now() + 2000 + Math.floor(Math.random() * 2500);
      this.setTimer(code, () => this.finishSyncRound(code), room.sync.goAt - Date.now() + SYNC_TAP_TIMEOUT_MS);
    }
    return room;
  }

  tap(code, playerId) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'sync' || room.sync.phase !== 'countdown') return room;
    if (room.sync.taps[playerId]) return room;
    room.sync.taps[playerId] = Date.now();
    room.lastActive = Date.now();

    const active = room.players.filter((p) => p.connected);
    if (active.every((p) => room.sync.taps[p.id])) {
      this.clearTimer(code);
      this.finishSyncRound(code);
      return this.getRoom(code);
    }
    return room;
  }

  finishSyncRound(code) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'sync' || room.sync.phase !== 'countdown') return room;
    this.clearTimer(code);

    const active = room.players.filter((p) => p.connected);
    const taps = active.map((p) => ({ player: p, at: room.sync.taps[p.id] || null }));
    const falseStart = taps.some((t) => t.at !== null && t.at < room.sync.goAt);
    const missing = taps.some((t) => t.at === null);

    let gap = null;
    let points = 0;
    if (!falseStart && !missing && taps.length === MAX_PLAYERS) {
      gap = Math.abs(taps[0].at - taps[1].at);
      points = scoreGap(gap);
    }
    room.love += points;
    room.sync.results.push({
      round: room.sync.round + 1,
      gap,
      points,
      falseStart,
      missing,
      taps: taps.map((t) => ({
        name: t.player.name,
        avatar: t.player.avatar,
        reaction: t.at ? t.at - room.sync.goAt : null,
      })),
    });
    room.sync.round += 1;
    room.sync.phase = room.sync.round >= room.sync.total ? 'done' : 'result';
    room.players.forEach((p) => { p.ready = false; });
    room.lastActive = Date.now();
    this.onChange(code);
    return room;
  }

  nextSyncRound(code) {
    const room = this.getRoom(code);
    if (!room || room.mode !== 'sync' || room.sync.phase !== 'result') return room;
    room.sync.phase = 'ready';
    room.sync.taps = {};
    room.sync.goAt = null;
    room.players.forEach((p) => { p.ready = false; });
    room.lastActive = Date.now();
    return room;
  }

  /* -------------------------------- timers -------------------------------- */

  setTimer(code, fn, delay) {
    this.clearTimer(code);
    this.timers.set(code, setTimeout(fn, Math.max(0, delay)));
  }

  clearTimer(code) {
    const timer = this.timers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(code);
    }
  }

  sweep(now = Date.now()) {
    this.rooms.forEach((room, code) => {
      const idle = now - room.lastActive > ROOM_TTL_MS;
      const empty = room.players.every((p) => !p.connected) && now - room.lastActive > 30 * 60 * 1000;
      if (idle || empty) {
        this.clearTimer(code);
        this.rooms.delete(code);
      }
    });
  }

  /* -------------------------- serialisation ------------------------------- */

  /** State for one player; hides data the partner should not see yet. */
  view(room, playerId) {
    const me = room.players.find((p) => p.id === playerId) || null;
    const partner = me ? this.partnerOf(room, me.id) : null;

    const base = {
      code: room.code,
      mode: room.mode,
      love: room.love,
      full: this.isFull(room),
      chat: room.chat,
      you: me && { id: me.id, name: me.name, avatar: me.avatar, score: me.score, ready: me.ready },
      partner: partner && {
        id: partner.id,
        name: partner.name,
        avatar: partner.avatar,
        score: partner.score,
        ready: partner.ready,
        connected: partner.connected,
      },
    };

    if (room.mode === 'quiz' && room.quiz) {
      const question = room.quiz.questions[room.quiz.index] || null;
      base.quiz = {
        phase: room.quiz.phase,
        round: Math.min(room.quiz.index + 1, room.quiz.total),
        total: room.quiz.total,
        question,
        submitted: Boolean(me && room.quiz.answers[me.id]),
        partnerSubmitted: Boolean(partner && room.quiz.answers[partner.id]),
        result: room.quiz.phase === 'answer' ? null : room.quiz.result,
      };
    }

    if (room.mode === 'td' && room.td) {
      base.td = {
        phase: room.td.phase,
        yourTurn: Boolean(me && room.td.turnId === me.id),
        turnName: (room.players.find((p) => p.id === room.td.turnId) || {}).name || '',
        type: room.td.type,
        card: room.td.card,
        history: room.td.history,
      };
    }

    if (room.mode === 'sync' && room.sync) {
      const last = room.sync.results[room.sync.results.length - 1] || null;
      base.sync = {
        phase: room.sync.phase,
        round: Math.min(room.sync.round + 1, room.sync.total),
        total: room.sync.total,
        goAt: room.sync.phase === 'countdown' ? room.sync.goAt : null,
        serverNow: Date.now(),
        tapped: Boolean(me && room.sync.taps[me.id]),
        last,
        results: room.sync.results,
        totalPoints: room.sync.results.reduce((sum, r) => sum + r.points, 0),
      };
    }

    return base;
  }
}

module.exports = { RoomStore, randomCode, scoreGap, QUIZ_ROUNDS, SYNC_ROUNDS, MAX_PLAYERS };
