/* global io */
(function () {
  'use strict';

  var socket = io();
  var state = null;
  var quizDraft = { self: null, guess: null, step: 'self' };
  var clockOffset = 0;
  var countdownTimer = null;
  var lastChatLength = 0;

  var el = function (id) { return document.getElementById(id); };
  var viewHome = el('view-home');
  var viewRoom = el('view-room');
  var stage = el('stage');

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var toastTimer = null;
  function toast(text) {
    var node = el('toast');
    node.textContent = text;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2800);
  }

  function showRoom() {
    viewHome.classList.remove('active');
    viewRoom.classList.add('active');
  }

  /* ------------------------------- home ---------------------------------- */

  var savedName = localStorage.getItem('lovelink:name');
  if (savedName) el('name').value = savedName;

  var params = new URLSearchParams(location.search);
  var prefill = params.get('room') || (location.hash || '').replace('#', '');
  if (prefill) el('code').value = prefill.toUpperCase().slice(0, 4);

  function currentName() {
    var name = el('name').value.trim();
    localStorage.setItem('lovelink:name', name);
    return name;
  }

  function homeError(message) {
    var node = el('home-error');
    node.textContent = message || '';
    node.hidden = !message;
  }

  el('btn-create').addEventListener('click', function () {
    homeError('');
    socket.emit('room:create', { name: currentName() }, function (res) {
      if (!res || !res.ok) return homeError((res && res.error) || 'Gagal membuat room.');
      history.replaceState(null, '', '?room=' + res.code);
      showRoom();
      return null;
    });
  });

  el('btn-join').addEventListener('click', function () {
    var code = el('code').value.trim().toUpperCase();
    if (code.length < 4) return homeError('Kode room 4 karakter ya.');
    homeError('');
    socket.emit('room:join', { code: code, name: currentName() }, function (res) {
      if (!res || !res.ok) return homeError((res && res.error) || 'Gagal gabung room.');
      history.replaceState(null, '', '?room=' + res.code);
      showRoom();
      return null;
    });
    return null;
  });

  el('code').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') el('btn-join').click();
  });

  /* ------------------------------ room chrome ----------------------------- */

  el('btn-back').addEventListener('click', function () {
    if (state && state.mode !== 'menu') socket.emit('game:menu');
  });

  el('btn-share').addEventListener('click', function () {
    if (!state) return;
    var url = location.origin + '/?room=' + state.code;
    var text = 'Ayo main LoveLink bareng aku 💞 Kode room: ' + state.code + '\n' + url;
    if (navigator.share) {
      navigator.share({ title: 'LoveLink', text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Link room dicopy!'); });
    } else {
      toast('Kode room: ' + state.code);
    }
  });

  el('chat-toggle').addEventListener('click', function () {
    el('chat').classList.toggle('closed');
    el('chat-badge').hidden = true;
  });

  el('chat-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = el('chat-input');
    if (!input.value.trim()) return;
    socket.emit('chat:send', { text: input.value });
    input.value = '';
  });

  /* ------------------------------- rendering ------------------------------ */

  function renderPlayers() {
    var you = state.you || { avatar: '🐻', name: 'Kamu', score: 0 };
    var partner = state.partner;
    var youNode = el('player-you');
    youNode.querySelector('.avatar').textContent = you.avatar;
    youNode.querySelector('.pname').textContent = you.name + ' (kamu)';
    youNode.querySelector('.pscore').textContent = you.score;

    var partnerNode = el('player-partner');
    partnerNode.querySelector('.avatar').textContent = partner ? partner.avatar : '❓';
    partnerNode.querySelector('.pname').textContent = partner ? partner.name : 'Menunggu…';
    partnerNode.querySelector('.pscore').textContent = partner ? partner.score : 0;
    partnerNode.classList.toggle('offline', !(partner && partner.connected));

    el('room-code').textContent = state.code;
    el('love-count').textContent = state.love;

    var turnName = state.td ? state.td.turnName : null;
    youNode.classList.toggle('turn', Boolean(turnName && state.you && turnName === state.you.name));
    partnerNode.classList.toggle('turn', Boolean(turnName && partner && turnName === partner.name));
  }

  function renderChat() {
    var log = el('chat-log');
    if (!state.chat.length) {
      log.innerHTML = '<div class="empty">Belum ada pesan. Sapa pasangan kamu 💌</div>';
    } else {
      log.innerHTML = state.chat.map(function (m) {
        return '<div class="msg"><b>' + esc(m.avatar + ' ' + m.from) + ':</b> ' + esc(m.text) + '</div>';
      }).join('');
      log.scrollTop = log.scrollHeight;
    }
    if (state.chat.length > lastChatLength && el('chat').classList.contains('closed')) {
      el('chat-badge').hidden = false;
    }
    lastChatLength = state.chat.length;
  }

  function waitingPanel() {
    var url = location.origin + '/?room=' + state.code;
    return '<div class="panel center">'
      + '<h2>Menunggu pasangan 💌</h2>'
      + '<p>Kirim kode <b>' + esc(state.code) + '</b> ke pasangan kamu, atau bagikan link ini:</p>'
      + '<p style="word-break:break-all"><b>' + esc(url) + '</b></p>'
      + '<p class="waiting-dots">Game mulai otomatis setelah dia gabung</p>'
      + '</div>';
  }

  function menuPanel() {
    return '<div class="panel"><h2>Mau main apa? 💘</h2><p>Pilih mode, pasangan kamu ikut otomatis.</p></div>'
      + '<button class="mode-card" data-mode="quiz"><span class="emoji">💌</span><span>'
      + '<b>Seberapa Kenal Kamu?</b><small>Jawab tentang dirimu, tebak jawaban dia. 6 ronde.</small></span></button>'
      + '<button class="mode-card" data-mode="td"><span class="emoji">🎲</span><span>'
      + '<b>Truth or Dare Couple</b><small>Giliran tarik kartu truth atau dare.</small></span></button>'
      + '<button class="mode-card" data-mode="sync"><span class="emoji">💓</span><span>'
      + '<b>Sinkron Hati</b><small>Tap hati sebarengan. Makin kompak, makin banyak love point.</small></span></button>';
  }

  function quizPanel() {
    var q = state.quiz;
    if (q.phase === 'done') {
      var you = state.you;
      var partner = state.partner || { name: 'Pasangan', score: 0 };
      var total = you.score + partner.score;
      var verdict = total >= 10 ? 'Kalian saling kenal banget! 💞'
        : total >= 6 ? 'Lumayan kompak, masih bisa lebih dekat 💗'
          : 'Waktunya PDKT ulang, ngobrol lebih banyak ya 😄';
      return '<div class="panel center"><h2>Hasil Akhir</h2>'
        + '<p class="gap-result">' + total + '/' + (q.total * 2) + '<small>tebakan benar berdua</small></p>'
        + '<p>' + esc(you.name) + ': <b>' + you.score + '</b> &nbsp;•&nbsp; ' + esc(partner.name) + ': <b>' + partner.score + '</b></p>'
        + '<p>' + verdict + '</p>'
        + '<button class="btn primary" data-action="mode-quiz">Main Lagi</button>'
        + '<button class="btn ghost" data-action="menu">Ganti Mode</button></div>';
    }

    if (q.phase === 'reveal') {
      var rows = (q.result ? q.result.detail : []).map(function (d) {
        return '<div class="reveal-row ' + (d.correct ? 'correct' : 'wrong') + '">'
          + '<span>' + esc(d.avatar) + '</span><span>'
          + '<span class="who">' + esc(d.name) + (d.correct ? ' menebak benar 🎉' : ' salah tebak 🙈') + '</span>'
          + '<span class="detail">Tebakan: <b>' + esc(d.guess) + '</b> · Jawaban asli pasangan: <b>' + esc(d.partnerSelf) + '</b></span>'
          + '</span></div>';
      }).join('');
      return '<div class="panel"><div class="progress">RONDE ' + q.round + '/' + q.total + '</div>'
        + '<div class="question">' + esc(q.result ? q.result.question : '') + '</div>'
        + rows
        + (q.result && q.result.bothCorrect ? '<p class="pill ok">Kompak! +2 love</p>' : '')
        + '<button class="btn primary" data-action="quiz-next">' + (q.round >= q.total ? 'Lihat Hasil' : 'Ronde Berikutnya') + '</button>'
        + '</div>';
    }

    if (q.submitted) {
      return '<div class="panel center"><h2>Jawaban terkirim ✔</h2>'
        + '<p class="waiting-dots">Nunggu ' + esc(state.partner ? state.partner.name : 'pasangan') + ' selesai jawab</p>'
        + '<p>Ronde ' + q.round + '/' + q.total + '</p></div>';
    }

    var step = quizDraft.step;
    var prompt = step === 'self'
      ? 'Jawab jujur tentang <b>diri kamu</b>'
      : 'Sekarang tebak jawaban <b>' + esc(state.partner ? state.partner.name : 'pasangan') + '</b>';
    var chosen = step === 'self' ? quizDraft.self : quizDraft.guess;
    var options = q.question.options.map(function (opt) {
      return '<button class="option' + (chosen === opt ? ' selected' : '') + '" data-option="' + esc(opt) + '">' + esc(opt) + '</button>';
    }).join('');

    return '<div class="panel">'
      + '<div class="progress">RONDE ' + q.round + '/' + q.total + '</div>'
      + '<div class="question">' + esc(q.question.q) + '</div>'
      + '<div class="step-label">' + prompt + '</div>'
      + '<div class="options">' + options + '</div>'
      + (step === 'self'
        ? '<button class="btn primary" data-action="quiz-step-guess"' + (quizDraft.self ? '' : ' disabled') + '>Lanjut Tebak Dia</button>'
        : '<div class="btn-pair"><button class="btn ghost" data-action="quiz-step-self">‹ Ubah Jawabanku</button>'
          + '<button class="btn primary" data-action="quiz-submit"' + (quizDraft.guess ? '' : ' disabled') + '>Kirim</button></div>')
      + (q.partnerSubmitted ? '<p class="pill">Pasangan sudah jawab</p>' : '')
      + '</div>';
  }

  function tdPanel() {
    var td = state.td;
    var history = td.history.length
      ? '<div class="panel"><h2>Riwayat</h2><ul class="history">' + td.history.map(function (h) {
        return '<li><b>' + esc(h.name) + '</b> · ' + esc(h.type) + ' · ' + (h.completed ? 'selesai ✅' : 'skip ❌') + '<br>' + esc(h.card) + '</li>';
      }).join('') + '</ul></div>'
      : '';

    if (td.phase === 'pick') {
      var body = td.yourTurn
        ? '<h2>Giliran kamu 🎲</h2><p>Pilih kartu kamu.</p>'
          + '<div class="btn-pair"><button class="btn primary" data-action="td-truth">Truth</button>'
          + '<button class="btn ghost" data-action="td-dare">Dare</button></div>'
        : '<h2>Giliran ' + esc(td.turnName) + '</h2><p class="waiting-dots">Dia sedang milih truth atau dare</p>';
      return '<div class="panel center">' + body + '</div>' + history;
    }

    var card = '<div class="card-td"><span class="kind">' + (td.type === 'dare' ? 'DARE' : 'TRUTH') + '</span>' + esc(td.card) + '</div>';
    if (td.yourTurn) {
      return '<div class="panel">' + card
        + '<div class="btn-pair"><button class="btn primary" data-action="td-done">Sudah Dilakukan</button>'
        + '<button class="btn ghost" data-action="td-skip">Skip</button></div></div>' + history;
    }
    return '<div class="panel">' + card + '<p class="center waiting-dots">Menunggu ' + esc(td.turnName) + ' menyelesaikan</p></div>' + history;
  }

  function syncPanel() {
    var s = state.sync;

    if (s.phase === 'done') {
      var verdict = s.totalPoints >= 11 ? 'Sehati banget! 💞' : s.totalPoints >= 6 ? 'Cukup kompak 💗' : 'Perlu latihan bareng lagi 😅';
      return '<div class="panel center"><h2>Sinkron Hati selesai</h2>'
        + '<p class="gap-result">' + s.totalPoints + '<small>dari maksimal ' + (s.total * 3) + ' poin</small></p>'
        + '<p>' + verdict + '</p>'
        + '<ul class="history">' + s.results.map(function (r) {
          return '<li>Ronde ' + r.round + ': ' + (r.gap == null ? 'gagal' : 'selisih ' + r.gap + ' ms') + ' · +' + r.points + '</li>';
        }).join('') + '</ul>'
        + '<button class="btn primary" data-action="mode-sync">Main Lagi</button>'
        + '<button class="btn ghost" data-action="menu">Ganti Mode</button></div>';
    }

    if (s.phase === 'result') {
      var r = s.last || {};
      var headline = r.falseStart ? 'Kecepetan! 😬' : r.missing ? 'Ada yang nggak tap 😴'
        : r.gap <= 150 ? 'Sehati! 💞' : r.gap <= 400 ? 'Hampir bareng 💗' : r.gap <= 800 ? 'Beda tipis ✨' : 'Beda jauh 😅';
      return '<div class="panel center"><div class="progress">RONDE ' + r.round + '/' + s.total + '</div>'
        + '<h2>' + headline + '</h2>'
        + '<p class="gap-result">' + (r.gap == null ? '—' : r.gap + ' ms') + '<small>selisih tap · +' + r.points + ' love point</small></p>'
        + (r.taps || []).map(function (t) {
          return '<p>' + esc(t.avatar + ' ' + t.name) + ': ' + (t.reaction == null ? 'tidak tap' : t.reaction + ' ms') + '</p>';
        }).join('')
        + '<button class="btn primary" data-action="sync-next">Ronde Berikutnya</button></div>';
    }

    if (s.phase === 'countdown') {
      var remaining = s.goAt - (Date.now() + clockOffset);
      var go = remaining <= 0;
      return '<div class="panel center"><div class="progress">RONDE ' + s.round + '/' + s.total + '</div>'
        + '<h2>' + (go ? 'TAP SEKARANG!' : 'Siap-siap…') + '</h2>'
        + '<p>' + (go ? 'Tap hati bareng pasangan kamu.' : 'Jangan tap sebelum hati menyala, nanti dianggap curang.') + '</p>'
        + '<button class="heart-btn ' + (go ? 'go' : 'waiting') + '" data-action="sync-tap"' + (s.tapped ? ' disabled' : '') + '>'
        + (s.tapped ? '✔' : go ? '💗' : '🖤') + '</button>'
        + (s.tapped ? '<p class="waiting-dots">Nunggu pasangan tap</p>' : '')
        + '</div>';
    }

    return '<div class="panel center"><div class="progress">RONDE ' + s.round + '/' + s.total + '</div>'
      + '<h2>Sinkron Hati 💓</h2>'
      + '<p>Hati akan menyala setelah beberapa saat. Tap secepat dan sebarengan mungkin!</p>'
      + '<button class="btn ' + (state.you && state.you.ready ? 'ghost' : 'primary') + '" data-action="sync-ready">'
      + (state.you && state.you.ready ? 'Siap ✔ (batalkan)' : 'Aku Siap') + '</button>'
      + '<p>' + esc(state.partner ? state.partner.name : 'Pasangan') + ': '
      + (state.partner && state.partner.ready ? 'siap ✔' : 'belum siap') + '</p></div>';
  }

  function renderStage() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    if (!state.full) {
      stage.innerHTML = waitingPanel();
      return;
    }
    if (state.mode === 'quiz' && state.quiz) stage.innerHTML = quizPanel();
    else if (state.mode === 'td' && state.td) stage.innerHTML = tdPanel();
    else if (state.mode === 'sync' && state.sync) stage.innerHTML = syncPanel();
    else stage.innerHTML = menuPanel();

    if (state.mode === 'sync' && state.sync && state.sync.phase === 'countdown' && !state.sync.tapped) {
      var goAt = state.sync.goAt;
      countdownTimer = setInterval(function () {
        var heart = stage.querySelector('.heart-btn');
        if (!heart) return;
        if (goAt - (Date.now() + clockOffset) <= 0) {
          heart.classList.remove('waiting');
          heart.classList.add('go');
          heart.textContent = '💗';
          clearInterval(countdownTimer);
          countdownTimer = null;
          var title = stage.querySelector('h2');
          if (title) title.textContent = 'TAP SEKARANG!';
        }
      }, 60);
    }
  }

  function render() {
    if (!state) return;
    showRoom();
    renderPlayers();
    renderChat();
    renderStage();
  }

  /* ------------------------------ interactions ---------------------------- */

  stage.addEventListener('click', function (event) {
    var modeCard = event.target.closest('.mode-card');
    if (modeCard) {
      socket.emit('game:select', { mode: modeCard.dataset.mode });
      return;
    }

    var option = event.target.closest('.option');
    if (option) {
      if (quizDraft.step === 'self') quizDraft.self = option.dataset.option;
      else quizDraft.guess = option.dataset.option;
      render();
      return;
    }

    var actionNode = event.target.closest('[data-action]');
    if (!actionNode) return;
    var action = actionNode.dataset.action;

    if (action === 'menu') socket.emit('game:menu');
    else if (action === 'mode-quiz') socket.emit('game:select', { mode: 'quiz' });
    else if (action === 'mode-sync') socket.emit('game:select', { mode: 'sync' });
    else if (action === 'quiz-step-guess') { quizDraft.step = 'guess'; render(); }
    else if (action === 'quiz-step-self') { quizDraft.step = 'self'; render(); }
    else if (action === 'quiz-submit') socket.emit('quiz:submit', { self: quizDraft.self, guess: quizDraft.guess });
    else if (action === 'quiz-next') socket.emit('quiz:next');
    else if (action === 'td-truth') socket.emit('td:pick', { type: 'truth' });
    else if (action === 'td-dare') socket.emit('td:pick', { type: 'dare' });
    else if (action === 'td-done') socket.emit('td:resolve', { completed: true });
    else if (action === 'td-skip') socket.emit('td:resolve', { completed: false });
    else if (action === 'sync-ready') socket.emit('sync:ready', { ready: !(state.you && state.you.ready) });
    else if (action === 'sync-tap') socket.emit('sync:tap');
    else if (action === 'sync-next') socket.emit('sync:next');
  });

  /* -------------------------------- socket -------------------------------- */

  socket.on('state', function (next) {
    var prev = state;
    state = next;
    if (next.sync && next.sync.serverNow) clockOffset = next.sync.serverNow - Date.now();
    var newRound = !prev || !prev.quiz || !next.quiz
      || prev.quiz.round !== next.quiz.round || prev.quiz.phase !== next.quiz.phase;
    if (newRound) quizDraft = { self: null, guess: null, step: 'self' };
    render();
  });

  socket.on('toast', function (payload) {
    if (payload && payload.text) toast(payload.text);
  });

  socket.on('disconnect', function () { toast('Koneksi terputus, mencoba menyambung…'); });
  socket.on('connect', function () {
    if (state) socket.emit('room:join', { code: state.code, name: currentName() }, function () {});
  });
}());
