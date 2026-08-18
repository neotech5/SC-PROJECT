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
      if (!res || !res.ok) return homeError((res && res.error) || 'Gagal membuka bilik.');
      history.replaceState(null, '', '?room=' + res.code);
      showRoom();
      return null;
    });
  });

  el('btn-join').addEventListener('click', function () {
    var code = el('code').value.trim().toUpperCase();
    if (code.length < 4) return homeError('Kod bilik mesti 4 aksara.');
    homeError('');
    socket.emit('room:join', { code: code, name: currentName() }, function (res) {
      if (!res || !res.ok) return homeError((res && res.error) || 'Gagal masuk bilik.');
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
    var text = 'Jom main LoveLink dengan saya 💞 Kod bilik: ' + state.code + '\n' + url;
    if (navigator.share) {
      navigator.share({ title: 'LoveLink', text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Pautan bilik telah disalin!'); });
    } else {
      toast('Kod bilik: ' + state.code);
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
    var you = state.you || { avatar: '🐻', name: 'Awak', score: 0 };
    var partner = state.partner;
    var youNode = el('player-you');
    youNode.querySelector('.avatar').textContent = you.avatar;
    youNode.querySelector('.pname').textContent = you.name + ' (awak)';
    youNode.querySelector('.pscore').textContent = you.score;

    var partnerNode = el('player-partner');
    partnerNode.querySelector('.avatar').textContent = partner ? partner.avatar : '❓';
    partnerNode.querySelector('.pname').textContent = partner ? partner.name : 'Menanti…';
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
      log.innerHTML = '<div class="empty">Belum ada pesanan. Sapa pasangan awak 💌</div>';
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
      + '<h2>Menanti pasangan 💌</h2>'
      + '<p>Hantar kod <b>' + esc(state.code) + '</b> kepada pasangan awak, atau kongsi pautan ini:</p>'
      + '<p style="word-break:break-all"><b>' + esc(url) + '</b></p>'
      + '<p class="waiting-dots">Permainan bermula sebaik dia masuk</p>'
      + '</div>';
  }

  function menuPanel() {
    return '<div class="panel"><h2>Nak main apa? 💘</h2><p>Pilih mod, pasangan awak ikut secara automatik.</p></div>'
      + '<button class="mode-card" data-mode="quiz"><span class="emoji">💌</span><span>'
      + '<b>Sejauh Mana Awak Kenal?</b><small>Jawab tentang diri awak, teka jawapan dia. 6 pusingan.</small></span></button>'
      + '<button class="mode-card" data-mode="td"><span class="emoji">🎲</span><span>'
      + '<b>Truth or Dare Pasangan</b><small>Bergilir cabut kad truth atau dare.</small></span></button>'
      + '<button class="mode-card" data-mode="sync"><span class="emoji">💓</span><span>'
      + '<b>Seirama Hati</b><small>Tekan hati serentak. Makin serentak, makin banyak love point.</small></span></button>';
  }

  function quizPanel() {
    var q = state.quiz;
    if (q.phase === 'done') {
      var you = state.you;
      var partner = state.partner || { name: 'Pasangan', score: 0 };
      var total = you.score + partner.score;
      var verdict = total >= 10 ? 'Awak berdua memang saling kenal! 💞'
        : total >= 6 ? 'Boleh tahan, masih boleh lebih rapat 💗'
          : 'Masa untuk berkenalan semula, banyakkan berbual 😄';
      return '<div class="panel center"><h2>Keputusan Akhir</h2>'
        + '<p class="gap-result">' + total + '/' + (q.total * 2) + '<small>tekaan betul berdua</small></p>'
        + '<p>' + esc(you.name) + ': <b>' + you.score + '</b> &nbsp;•&nbsp; ' + esc(partner.name) + ': <b>' + partner.score + '</b></p>'
        + '<p>' + verdict + '</p>'
        + '<button class="btn primary" data-action="mode-quiz">Main Lagi</button>'
        + '<button class="btn ghost" data-action="menu">Tukar Mod</button></div>';
    }

    if (q.phase === 'reveal') {
      var rows = (q.result ? q.result.detail : []).map(function (d) {
        return '<div class="reveal-row ' + (d.correct ? 'correct' : 'wrong') + '">'
          + '<span>' + esc(d.avatar) + '</span><span>'
          + '<span class="who">' + esc(d.name) + (d.correct ? ' teka betul 🎉' : ' salah teka 🙈') + '</span>'
          + '<span class="detail">Tekaan: <b>' + esc(d.guess) + '</b> · Jawapan sebenar pasangan: <b>' + esc(d.partnerSelf) + '</b></span>'
          + '</span></div>';
      }).join('');
      return '<div class="panel"><div class="progress">PUSINGAN ' + q.round + '/' + q.total + '</div>'
        + '<div class="question">' + esc(q.result ? q.result.question : '') + '</div>'
        + rows
        + (q.result && q.result.bothCorrect ? '<p class="pill ok">Sefahaman! +2 love</p>' : '')
        + '<button class="btn primary" data-action="quiz-next">' + (q.round >= q.total ? 'Lihat Keputusan' : 'Pusingan Seterusnya') + '</button>'
        + '</div>';
    }

    if (q.submitted) {
      return '<div class="panel center"><h2>Jawapan dihantar ✔</h2>'
        + '<p class="waiting-dots">Menanti ' + esc(state.partner ? state.partner.name : 'pasangan') + ' selesai menjawab</p>'
        + '<p>Pusingan ' + q.round + '/' + q.total + '</p></div>';
    }

    var step = quizDraft.step;
    var prompt = step === 'self'
      ? 'Jawab dengan jujur tentang <b>diri awak</b>'
      : 'Sekarang teka jawapan <b>' + esc(state.partner ? state.partner.name : 'pasangan') + '</b>';
    var chosen = step === 'self' ? quizDraft.self : quizDraft.guess;
    var options = q.question.options.map(function (opt) {
      return '<button class="option' + (chosen === opt ? ' selected' : '') + '" data-option="' + esc(opt) + '">' + esc(opt) + '</button>';
    }).join('');

    return '<div class="panel">'
      + '<div class="progress">PUSINGAN ' + q.round + '/' + q.total + '</div>'
      + '<div class="question">' + esc(q.question.q) + '</div>'
      + '<div class="step-label">' + prompt + '</div>'
      + '<div class="options">' + options + '</div>'
      + (step === 'self'
        ? '<button class="btn primary" data-action="quiz-step-guess"' + (quizDraft.self ? '' : ' disabled') + '>Teruskan Teka Dia</button>'
        : '<div class="btn-pair"><button class="btn ghost" data-action="quiz-step-self">‹ Ubah Jawapan Saya</button>'
          + '<button class="btn primary" data-action="quiz-submit"' + (quizDraft.guess ? '' : ' disabled') + '>Hantar</button></div>')
      + (q.partnerSubmitted ? '<p class="pill">Pasangan sudah menjawab</p>' : '')
      + '</div>';
  }

  function tdPanel() {
    var td = state.td;
    var history = td.history.length
      ? '<div class="panel"><h2>Rekod</h2><ul class="history">' + td.history.map(function (h) {
        return '<li><b>' + esc(h.name) + '</b> · ' + esc(h.type) + ' · ' + (h.completed ? 'selesai ✅' : 'langkau ❌') + '<br>' + esc(h.card) + '</li>';
      }).join('') + '</ul></div>'
      : '';

    if (td.phase === 'pick') {
      var body = td.yourTurn
        ? '<h2>Giliran awak 🎲</h2><p>Pilih kad awak.</p>'
          + '<div class="btn-pair"><button class="btn primary" data-action="td-truth">Truth</button>'
          + '<button class="btn ghost" data-action="td-dare">Dare</button></div>'
        : '<h2>Giliran ' + esc(td.turnName) + '</h2><p class="waiting-dots">Dia sedang memilih truth atau dare</p>';
      return '<div class="panel center">' + body + '</div>' + history;
    }

    var card = '<div class="card-td"><span class="kind">' + (td.type === 'dare' ? 'DARE' : 'TRUTH') + '</span>' + esc(td.card) + '</div>';
    if (td.yourTurn) {
      return '<div class="panel">' + card
        + '<div class="btn-pair"><button class="btn primary" data-action="td-done">Sudah Dibuat</button>'
        + '<button class="btn ghost" data-action="td-skip">Langkau</button></div></div>' + history;
    }
    return '<div class="panel">' + card + '<p class="center waiting-dots">Menanti ' + esc(td.turnName) + ' menyelesaikannya</p></div>' + history;
  }

  function syncPanel() {
    var s = state.sync;

    if (s.phase === 'done') {
      var verdict = s.totalPoints >= 11 ? 'Memang seirama! 💞' : s.totalPoints >= 6 ? 'Cukup serentak 💗' : 'Perlu berlatih bersama lagi 😅';
      return '<div class="panel center"><h2>Seirama Hati tamat</h2>'
        + '<p class="gap-result">' + s.totalPoints + '<small>daripada maksimum ' + (s.total * 3) + ' mata</small></p>'
        + '<p>' + verdict + '</p>'
        + '<ul class="history">' + s.results.map(function (r) {
          return '<li>Pusingan ' + r.round + ': ' + (r.gap == null ? 'gagal' : 'jarak ' + r.gap + ' ms') + ' · +' + r.points + '</li>';
        }).join('') + '</ul>'
        + '<button class="btn primary" data-action="mode-sync">Main Lagi</button>'
        + '<button class="btn ghost" data-action="menu">Tukar Mod</button></div>';
    }

    if (s.phase === 'result') {
      var r = s.last || {};
      var headline = r.falseStart ? 'Terlalu awal! 😬' : r.missing ? 'Ada yang tak tekan 😴'
        : r.gap <= 150 ? 'Seirama! 💞' : r.gap <= 400 ? 'Hampir serentak 💗' : r.gap <= 800 ? 'Beza sedikit ✨' : 'Beza jauh 😅';
      return '<div class="panel center"><div class="progress">PUSINGAN ' + r.round + '/' + s.total + '</div>'
        + '<h2>' + headline + '</h2>'
        + '<p class="gap-result">' + (r.gap == null ? '—' : r.gap + ' ms') + '<small>jarak tekan · +' + r.points + ' love point</small></p>'
        + (r.taps || []).map(function (t) {
          return '<p>' + esc(t.avatar + ' ' + t.name) + ': ' + (t.reaction == null ? 'tidak tekan' : t.reaction + ' ms') + '</p>';
        }).join('')
        + '<button class="btn primary" data-action="sync-next">Pusingan Seterusnya</button></div>';
    }

    if (s.phase === 'countdown') {
      var remaining = s.goAt - (Date.now() + clockOffset);
      var go = remaining <= 0;
      return '<div class="panel center"><div class="progress">PUSINGAN ' + s.round + '/' + s.total + '</div>'
        + '<h2>' + (go ? 'TEKAN SEKARANG!' : 'Bersedia…') + '</h2>'
        + '<p>' + (go ? 'Tekan hati serentak dengan pasangan awak.' : 'Jangan tekan sebelum hati menyala, nanti dikira menipu.') + '</p>'
        + '<button class="heart-btn ' + (go ? 'go' : 'waiting') + '" data-action="sync-tap"' + (s.tapped ? ' disabled' : '') + '>'
        + (s.tapped ? '✔' : go ? '💗' : '🖤') + '</button>'
        + (s.tapped ? '<p class="waiting-dots">Menanti pasangan menekan</p>' : '')
        + '</div>';
    }

    return '<div class="panel center"><div class="progress">PUSINGAN ' + s.round + '/' + s.total + '</div>'
      + '<h2>Seirama Hati 💓</h2>'
      + '<p>Hati akan menyala selepas beberapa saat. Tekan secepat dan seserentak mungkin!</p>'
      + '<button class="btn ' + (state.you && state.you.ready ? 'ghost' : 'primary') + '" data-action="sync-ready">'
      + (state.you && state.you.ready ? 'Sedia ✔ (batalkan)' : 'Saya Sedia') + '</button>'
      + '<p>' + esc(state.partner ? state.partner.name : 'Pasangan') + ': '
      + (state.partner && state.partner.ready ? 'sedia ✔' : 'belum sedia') + '</p></div>';
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
          if (title) title.textContent = 'TEKAN SEKARANG!';
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

  socket.on('disconnect', function () { toast('Sambungan terputus, mencuba menyambung semula…'); });
  socket.on('connect', function () {
    if (state) socket.emit('room:join', { code: state.code, name: currentName() }, function () {});
  });
}());
