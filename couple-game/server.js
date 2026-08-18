'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { RoomStore } = require('./src/rooms');

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const store = new RoomStore({ onChange: (code) => broadcast(code) });

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/healthz', (req, res) => res.json({ ok: true, rooms: store.rooms.size }));

function broadcast(code) {
  const room = store.getRoom(code);
  if (!room) return;
  room.players.forEach((player) => {
    if (!player.connected) return;
    io.to(player.id).emit('state', store.view(room, player.id));
  });
}

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

io.on('connection', (socket) => {
  socket.data.code = null;

  const withRoom = (handler) => (...args) => {
    const code = socket.data.code;
    if (!code || !store.getRoom(code)) return;
    handler(code, ...args);
  };

  socket.on('room:create', ({ name } = {}, ack) => {
    const playerName = cleanName(name) || 'Kamu';
    const room = store.createRoom({ id: socket.id, name: playerName });
    socket.data.code = room.code;
    socket.join(room.code);
    if (typeof ack === 'function') ack({ ok: true, code: room.code });
    broadcast(room.code);
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    const playerName = cleanName(name) || 'Pasangan';
    const result = store.joinRoom(code, { id: socket.id, name: playerName });
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    socket.data.code = result.room.code;
    socket.join(result.room.code);
    if (typeof ack === 'function') ack({ ok: true, code: result.room.code });
    io.to(result.room.code).emit('toast', { text: `${playerName} masuk ke room 💕` });
    broadcast(result.room.code);
  });

  socket.on('chat:send', withRoom((code, { text } = {}) => {
    if (store.addChat(code, socket.id, text)) broadcast(code);
  }));

  socket.on('game:select', withRoom((code, { mode } = {}) => {
    store.selectMode(code, mode);
    broadcast(code);
  }));

  socket.on('game:menu', withRoom((code) => {
    store.backToMenu(code);
    broadcast(code);
  }));

  socket.on('quiz:submit', withRoom((code, payload = {}) => {
    store.submitQuiz(code, socket.id, payload);
    broadcast(code);
  }));

  socket.on('quiz:next', withRoom((code) => {
    store.nextQuizRound(code);
    broadcast(code);
  }));

  socket.on('td:pick', withRoom((code, { type } = {}) => {
    store.pickCard(code, socket.id, type);
    broadcast(code);
  }));

  socket.on('td:resolve', withRoom((code, { completed } = {}) => {
    store.resolveCard(code, socket.id, completed);
    broadcast(code);
  }));

  socket.on('sync:ready', withRoom((code, { ready } = {}) => {
    store.setReady(code, socket.id, ready !== false);
    broadcast(code);
  }));

  socket.on('sync:tap', withRoom((code) => {
    store.tap(code, socket.id);
    broadcast(code);
  }));

  socket.on('sync:next', withRoom((code) => {
    store.nextSyncRound(code);
    broadcast(code);
  }));

  socket.on('disconnect', () => {
    const code = socket.data.code;
    if (!code) return;
    const room = store.leaveRoom(code, socket.id);
    if (!room) return;
    io.to(code).emit('toast', { text: 'Pasangan kamu terputus, tunggu dia join lagi ya.' });
    broadcast(code);
  });
});

setInterval(() => store.sweep(), 10 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    process.stdout.write(`LoveLink jalan di http://localhost:${PORT}\n`);
  });
}

module.exports = { app, server, io, store };
