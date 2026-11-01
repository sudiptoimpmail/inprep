/* Interview Prep — flashcards with spaced repetition. All progress stays on the device (localStorage). */
(function () {
  'use strict';
  var KEY = 'ipp.v1';
  var DAY = 86400000;
  var INTERVAL = [0, 1, 3, 7, 16, 35]; // days per box
  var NEW_PER_SESSION = 20;

  var DATA = null, DECKS = {}, CARDS = {}, ORDER = [], GROUPS = [];
  var S = load();
  var app = document.getElementById('app');
  var session = null; // {key, title, queue:[ids], i, revealed, done, back}

  // ---------- storage ----------
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    s.c = s.c || {}; s.cfg = s.cfg || { fs: 1, perSession: NEW_PER_SESSION, theme: '' }; s.hideInstall = !!s.hideInstall;
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }
  function rec(id) { return S.c[id]; }
  function applyCfg() {
    document.documentElement.style.setProperty('--fs', S.cfg.fs || 1);
    if (S.cfg.theme) document.documentElement.setAttribute('data-theme', S.cfg.theme); else document.documentElement.removeAttribute('data-theme');
  }

  // ---------- helpers ----------
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
    starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>'
  };
  function bar(title, left, right, line) {
    return '<div class="bar' + (line ? ' line' : '') + '">' + (left || '<span class="btn-icon"></span>') + '<h1>' + esc(title) + '</h1>' + (right || '<span class="btn-icon"></span>') + '</div>';
  }
  function backBtn(href, label) { return '<button class="btn-icon" data-go="' + esc(href) + '" aria-label="Back">' + ICON.back + esc(label || 'Back') + '</button>'; }
  function toast(msg) {
    var t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1400);
  }
  function now() { return Date.now(); }

  // ---------- card state ----------
  // A record {b: box 0-5, d: due time, n: reviews, s: starred, ghost: starred but never studied}
  function isNew(id) { var r = rec(id); return !r || !!r.ghost; }
  function isDue(id) { var r = rec(id); return !!r && !r.ghost && r.d <= now(); }
  function stats(ids) {
    var k = 0, l = 0, n = 0, due = 0;
    ids.forEach(function (id) { var r = rec(id); if (!r || r.ghost) n++; else { if (r.b >= 3) k++; else l++; if (r.d <= now()) due++; } });
    return { k: k, l: l, n: n, due: due, total: ids.length };
  }
  function grade(id, g) {
    var r = rec(id) || { b: 0, d: 0, n: 0, s: false };
    if (r.ghost) { delete r.ghost; r.b = 0; }
    if (g === 'again') r.b = 0;
    else if (g === 'good') r.b = Math.min(r.b + 1, 5);
    else if (g === 'easy') r.b = Math.min(r.b + 2, 5);
    r.d = g === 'again' ? now() : now() + INTERVAL[r.b] * DAY - 3600000;
    r.n = (r.n || 0) + 1; r.l = now();
    S.c[id] = r; save();
  }
  function toggleStar(id) {
    var r = rec(id) || { b: 0, d: now(), n: 0, s: false, ghost: true };
    r.s = !r.s; S.c[id] = r;
    if (r.ghost && !r.s) delete S.c[id];
    save(); return r.s;
  }
  function starred(id) { var r = rec(id); return !!(r && r.s); }

  // ---------- data ----------
  function index(d) {
    DATA = d;
    d.decks.forEach(function (dk) {
      DECKS[dk.id] = dk; dk.ids = [];
      if (GROUPS.indexOf(dk.group) < 0) GROUPS.push(dk.group);
      dk.cards.forEach(function (c) { c.deck = dk.id; CARDS[c.id] = c; dk.ids.push(c.id); ORDER.push(c.id); });
    });
  }
  function searchText(c) { if (c._t == null) c._t = (c.f + ' ' + c.s + ' ' + plain(c.b)).toLowerCase(); return c._t; }

  // ---------- sessions ----------
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buildQueue(ids, mode) {
    if (mode === 'all') return ids.slice();
    if (mode === 'shuffle') return shuffle(ids.slice());
    if (mode === 'star') return ids.filter(starred);
    if (mode === 'weak') return ids.filter(function (id) { var r = rec(id); return r && !r.ghost && r.b < 3; });
    var due = ids.filter(isDue).sort(function (a, b) { return rec(a).d - rec(b).d; });
    var fresh = ids.filter(isNew).slice(0, S.cfg.perSession || NEW_PER_SESSION);
    return due.concat(fresh);
  }
  function scopeIds(scope) {
    if (scope === 'all') return ORDER;
    if (scope === 'star') return ORDER.filter(starred);
    return DECKS[scope] ? DECKS[scope].ids : [];
  }
  function scopeTitle(scope) { return scope === 'all' ? 'All decks' : scope === 'star' ? 'Starred' : (DECKS[scope] ? DECKS[scope].title : ''); }

  // ---------- router ----------
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  window.addEventListener('hashchange', route);
  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var p = h.split('/');
    window.scrollTo(0, 0);
    if (!DATA) return;
    if (!h) return home();
    if (p[0] === 'd') return deckView(p[1]);
    if (p[0] === 's') return study(p[1], p[2] || 'due');
    if (p[0] === 'b') return browse(p[1]);
    if (p[0] === 'c') return single(p[1], p[2]);
    if (p[0] === 'q') return searchView(p.slice(1).join('/'));
    if (p[0] === 'settings') return settings();
    home();
  }

  // ---------- screens ----------
  function home() {
    session = null;
    var st = stats(ORDER);
    var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var h = bar('', '<span class="btn-icon"></span>', '<button class="btn-icon" data-go="#settings" aria-label="Settings">' + ICON.gear + '</button>');
    h += '<div class="page">';
    h += '<div><h2 class="title-xl">Interview Prep</h2><p class="sub">' + ORDER.length + ' cards · ' + DATA.decks.length + ' decks · stories, leadership, system design, cloud, data and AI</p></div>';
    if (ios && !standalone && !S.hideInstall) h += '<div class="install"><div>Install it: tap <b>Share</b> then <b>Add to Home Screen</b>. It then opens full-screen and works offline.</div><button data-act="hide-install" aria-label="Dismiss">×</button></div>';
    h += '<div class="stats"><div class="stat due"><b>' + st.due + '</b><span>due now</span></div><div class="stat"><b>' + st.k + '</b><span>known</span></div><div class="stat"><b>' + st.n + '</b><span>not started</span></div></div>';
    h += '<div class="row2"><button class="primary" data-go="#s/all/due">Study now</button><button class="secondary" data-go="#s/all/shuffle">Shuffle all</button></div>';
    h += '<label class="search">' + ICON.search + '<input id="q" type="search" placeholder="Search all ' + ORDER.length + ' cards" enterkeyhint="search" autocomplete="off"></label>';
    var nStar = ORDER.filter(starred).length;
    if (nStar) h += '<div class="list"><button class="item" data-go="#d/star"><div class="main"><div class="t">Starred</div><div class="m">' + nStar + ' cards you marked</div></div><span class="chev">' + ICON.chev + '</span></button></div>';
    GROUPS.forEach(function (g) {
      h += '<div class="group"><h2>' + esc(g) + '</h2><div class="list">';
      DATA.decks.filter(function (d) { return d.group === g; }).forEach(function (d) {
        var s = stats(d.ids), t = s.total || 1;
        h += '<button class="item" data-go="#d/' + d.id + '"><div class="main"><div class="t">' + esc(d.title) + '</div><div class="m">' + s.total + ' cards' + (s.k ? ' · ' + s.k + ' known' : '') + '</div><div class="pbar"><i class="k" style="width:' + (s.k / t * 100) + '%"></i><i class="l" style="width:' + (s.l / t * 100) + '%"></i></div></div>';
        h += '<span class="badge' + (s.due ? '' : ' zero') + '">' + (s.due ? s.due + ' due' : (s.n ? s.n + ' new' : '✓')) + '</span></button>';
      });
      h += '</div></div>';
    });
    h += '<p class="note">Progress is saved on this phone only. Back it up from Settings.</p></div>';
    app.innerHTML = h;
    var q = document.getElementById('q');
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) go('#q/' + encodeURIComponent(q.value.trim())); });
  }

  function deckView(id) {
    var ids = scopeIds(id), title = scopeTitle(id), dk = DECKS[id];
    if (!ids.length && id !== 'star') return home();
    var s = stats(ids);
    var h = bar('', backBtn('#', 'Decks'), '<button class="btn-icon" data-go="#b/' + id + '" aria-label="Browse">' + ICON.list + '</button>');
    h += '<div class="page"><div><h2 class="title-xl">' + esc(title) + '</h2>' + (dk && dk.blurb ? '<p class="sub" style="margin-top:6px">' + esc(dk.blurb) + '</p>' : '') + '</div>';
    h += '<div class="pills"><span class="pill">' + s.total + ' cards</span><span class="pill n">' + s.n + ' new</span><span class="pill l">' + s.l + ' learning</span><span class="pill k">' + s.k + ' known</span></div>';
    var q = buildQueue(ids, 'due');
    h += '<button class="primary" data-go="#s/' + id + '/due"' + (q.length ? '' : ' disabled') + '>' + (q.length ? 'Study ' + q.length + ' cards' : 'All caught up') + '</button>';
    h += '<div class="row2"><button class="secondary" data-go="#s/' + id + '/shuffle">Shuffle all</button><button class="secondary" data-go="#s/' + id + '/all">In order</button></div>';
    var weak = buildQueue(ids, 'weak').length, star = ids.filter(starred).length;
    h += '<div class="row2"><button class="secondary" data-go="#s/' + id + '/weak"' + (weak ? '' : ' disabled') + '>Still learning (' + weak + ')</button><button class="secondary" data-go="#s/' + id + '/star"' + (star ? '' : ' disabled') + '>Starred (' + star + ')</button></div>';
    h += '<div class="list">';
    ids.slice(0, 400).forEach(function (cid, i) {
      var c = CARDS[cid], r = rec(cid);
      var st = !r || r.ghost ? 'new' : r.b >= 3 ? 'known' : 'learning';
      h += '<button class="item" data-go="#c/' + cid + '/' + id + '"><div class="main"><div class="t">' + (starred(cid) ? '★ ' : '') + esc(c.f) + '</div><div class="m">' + esc(c.s || (id === 'star' ? DECKS[c.deck].title : '')) + '</div></div><span class="badge' + (st === 'new' ? ' zero' : '') + '">' + st + '</span></button>';
    });
    h += '</div></div>';
    app.innerHTML = h;
  }

  function browse(id) { go('#d/' + id); }

  function renderBack(html) {
    var wrap = document.createElement('div'); wrap.className = 'content'; wrap.innerHTML = html;
    wrap.querySelectorAll('table').forEach(function (t) { if (!t.parentElement.classList.contains('tw')) { var w = document.createElement('div'); w.className = 'tw'; t.parentNode.insertBefore(w, t); w.appendChild(t); } });
    wrap.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    return wrap;
  }

  function cardHTML(c, revealed) {
    var dk = DECKS[c.deck];
    var h = '<div class="card' + (revealed ? '' : ' hidden-back') + '" id="card">';
    h += '<span class="swipe-tag l">Again</span><span class="swipe-tag r">Got it</span>';
    h += '<div class="chip"><span>' + esc(dk.title) + '</span></div>';
    h += '<button class="star' + (starred(c.id) ? ' on' : '') + '" data-act="star" aria-label="Star">' + (starred(c.id) ? ICON.star : ICON.starO) + '</button>';
    h += '<div class="scroll" id="scroll"><div class="front">' + esc(c.f) + '</div>';
    if (c.s) h += '<p class="sub-h">' + esc(c.s) + '</p>';
    if (c.t && c.t.length) h += '<div class="tags">' + c.t.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
    h += revealed ? '<div id="back"></div>' : '<div class="reveal-hint">Say your answer, then tap to reveal</div>';
    h += '</div></div>';
    return h;
  }

  function study(scope, mode) {
    var key = scope + '/' + mode;
    if (!session || session.key !== key) {
      session = { key: key, scope: scope, mode: mode, queue: buildQueue(scopeIds(scope), mode), i: 0, revealed: false, graded: 0 };
    }
    drawStudy();
  }
  function drawStudy() {
    var s = session, total = s.queue.length;
    var back = s.scope === 'all' || s.scope === 'star' ? '#' : '#d/' + s.scope;
    var title = scopeTitle(s.scope);
    if (s.i >= total) {
      app.innerHTML = '<div class="study">' + bar(title, backBtn(back, 'Done'), '', true) + '<div class="done"><div class="big">' + (total ? 'Session done' : 'Nothing due') + '</div><p class="sub">' + (total ? s.graded + ' cards reviewed. Cards you marked “Again” come back first next time.' : 'Every card here is scheduled for later. Shuffle to review anyway.') + '</p><button class="primary" data-act="reshuffle" style="max-width:320px">Shuffle this deck</button><button class="secondary" data-go="' + back + '" style="max-width:320px">Back</button></div></div>';
      return;
    }
    var c = CARDS[s.queue[s.i]];
    var h = '<div class="study">' + bar((s.i + 1) + ' of ' + total, backBtn(back, 'Close'), '<button class="btn-icon" data-act="skip" aria-label="Skip">Skip</button>');
    h += '<div class="prog"><i style="width:' + (s.i / total * 100) + '%"></i></div>';
    h += '<div class="stage">' + cardHTML(c, s.revealed) + '</div>';
    if (!s.revealed) h += '<div class="actions one"><button class="grade nav" data-act="reveal">Show answer</button></div>';
    else h += '<div class="actions"><button class="grade again" data-act="again">Again<small>see soon</small></button><button class="grade good" data-act="good">Got it<small>' + nextLabel(c.id, 'good') + '</small></button><button class="grade easy" data-act="easy">Easy<small>' + nextLabel(c.id, 'easy') + '</small></button></div>';
    h += '</div>';
    app.innerHTML = h;
    if (s.revealed) document.getElementById('back').appendChild(renderBack(c.b));
    bindCard();
  }
  function nextLabel(id, g) {
    var r = rec(id), b = r && !r.ghost ? r.b : 0;
    b = g === 'good' ? Math.min(b + 1, 5) : Math.min(b + 2, 5);
    var d = INTERVAL[b]; return d <= 1 ? 'tomorrow' : 'in ' + d + ' days';
  }
  function answer(g) {
    var s = session; if (!s) return;
    var id = s.queue[s.i];
    grade(id, g); s.graded++;
    if (g === 'again') { var pos = Math.min(s.i + 4, s.queue.length); s.queue.splice(pos, 0, id); }
    var card = document.getElementById('card');
    if (card) { card.classList.add(g === 'again' ? 'swipe-l' : 'swipe-r'); }
    setTimeout(function () { s.i++; s.revealed = false; drawStudy(); }, card ? 180 : 0);
  }

  function single(id, scope) {
    var c = CARDS[id]; if (!c) return home();
    var list = scope === 'q' ? (window._lastHits || [id]) : scopeIds(scope || c.deck);
    var i = list.indexOf(id);
    var back = scope === 'q' ? '#q/' + encodeURIComponent(window._lastQ || '') : '#d/' + (scope || c.deck);
    var h = '<div class="study">' + bar((i + 1) + ' of ' + list.length, backBtn(back, 'Back'), '');
    h += '<div class="stage">' + cardHTML(c, true) + '</div>';
    h += '<div class="actions two"><button class="grade nav" data-go="' + (i > 0 ? '#c/' + list[i - 1] + '/' + (scope || c.deck) : back) + '">‹ Previous</button><button class="grade nav" data-go="' + (i < list.length - 1 ? '#c/' + list[i + 1] + '/' + (scope || c.deck) : back) + '">Next ›</button></div></div>';
    app.innerHTML = h;
    document.getElementById('back').appendChild(renderBack(c.b));
    session = { single: true, id: id };
    bindCard();
  }

  function searchView(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = ORDER.filter(function (id) { var t = searchText(CARDS[id]); return words.every(function (w) { return t.indexOf(w) >= 0; }); });
    hits.sort(function (a, b) { var fa = CARDS[a].f.toLowerCase(), fb = CARDS[b].f.toLowerCase(); return (fb.indexOf(words[0]) >= 0) - (fa.indexOf(words[0]) >= 0); });
    window._lastHits = hits; window._lastQ = q;
    var h = bar('Search', backBtn('#', 'Decks'), '', true) + '<div class="page"><label class="search">' + ICON.search + '<input id="q" type="search" value="' + esc(q) + '" enterkeyhint="search" autocomplete="off"></label>';
    h += '<p class="sub">' + hits.length + ' cards match “' + esc(q) + '”</p>';
    if (hits.length) {
      h += '<div class="list">';
      hits.slice(0, 200).forEach(function (id) {
        var c = CARDS[id];
        h += '<button class="item hit" data-go="#c/' + id + '/q"><div class="main"><div class="t">' + esc(c.f) + '</div><div class="m">' + esc(DECKS[c.deck].title) + '</div></div><span class="chev">' + ICON.chev + '</span></button>';
      });
      h += '</div>';
    } else h += '<div class="empty">No cards match. Try fewer words.</div>';
    h += '</div>';
    app.innerHTML = h;
    var inp = document.getElementById('q');
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.value.trim()) go('#q/' + encodeURIComponent(inp.value.trim())); });
  }

  function settings() {
    var fs = S.cfg.fs || 1, th = S.cfg.theme || '', per = S.cfg.perSession || NEW_PER_SESSION;
    function seg(name, opts, cur) { return '<div class="seg">' + opts.map(function (o) { return '<button data-set="' + name + '" data-val="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
    var h = bar('Settings', backBtn('#', 'Decks'), '', true) + '<div class="page">';
    h += '<div class="list">';
    h += '<div class="setting"><span>Text size</span>' + seg('fs', [[0.9, 'S'], [1, 'M'], [1.12, 'L'], [1.25, 'XL']], fs) + '</div>';
    h += '<div class="setting"><span>Appearance</span>' + seg('theme', [['', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], th) + '</div>';
    h += '<div class="setting"><span>New cards per session</span>' + seg('perSession', [[10, '10'], [20, '20'], [40, '40'], [999, 'All']], per) + '</div>';
    h += '</div>';
    h += '<div class="group"><h2>Back up or move progress</h2><p class="note">Copy this text into Notes to keep a backup, or paste a backup here to restore it on another phone.</p><textarea class="io" id="io" spellcheck="false"></textarea><div class="row2" style="margin-top:10px"><button class="secondary" data-act="export">Copy backup</button><button class="secondary" data-act="import">Restore from text</button></div></div>';
    h += '<div class="group"><h2>Reset</h2><button class="secondary danger" data-act="reset" id="resetBtn">Reset all progress</button></div>';
    h += '<p class="note">' + ORDER.length + ' cards in ' + DATA.decks.length + ' decks. Spaced repetition: “Got it” moves a card to 1, 3, 7, 16 then 35 days; “Again” brings it back in this session.</p></div>';
    app.innerHTML = h;
  }

  // ---------- gestures on the study card ----------
  function openZoom(fg) {
    var svg = fg.querySelector('svg'), vb = (svg.getAttribute('viewBox') || svg.getAttribute('viewbox') || '0 0 720 360').split(/[\s,]+/);
    var w = Math.max(Math.round((+vb[2] || 720) * 0.8), window.innerWidth - 24);
    var z = document.createElement('div'); z.className = 'zoom';
    var cap = fg.querySelector('figcaption');
    z.innerHTML = '<div class="zoom-bar"><span>' + (cap ? esc(cap.textContent) : 'Diagram') + '</span><button aria-label="Close">Done</button></div><div class="zoom-body"><div class="zoom-fig" style="width:' + w + 'px">' + svg.outerHTML + '</div><p class="zoom-hint">Scroll sideways. Turn the phone sideways for a bigger view.</p></div>';
    z.querySelector('button').addEventListener('click', function () { z.remove(); });
    document.body.appendChild(z);
  }
  function bindCard() {
    var card = document.getElementById('card'); if (!card) return;
    var x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false, horiz = false;
    var tl = card.querySelector('.swipe-tag.l'), tr = card.querySelector('.swipe-tag.r');
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="star"]') || e.target.closest('a,summary,details')) return;
      var fg = e.target.closest('.content figure');
      if (fg && fg.querySelector('svg')) { openZoom(fg); return; }
      if (session && !session.single && !session.revealed) { session.revealed = true; drawStudy(); }
    });
    if (!session || session.single) return;
    card.addEventListener('touchstart', function (e) { if (!session.revealed || e.target.closest('.tw,pre,figure')) return; var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; dragging = true; decided = false; horiz = false; card.style.transition = 'none'; }, { passive: true });
    card.addEventListener('touchmove', function (e) {
      if (!dragging) return; var t = e.touches[0]; var ddx = t.clientX - x0, ddy = t.clientY - y0;
      if (!decided && (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)) { decided = true; horiz = Math.abs(ddx) > Math.abs(ddy) * 1.3; }
      if (!horiz) return;
      dx = ddx; card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 30) + 'deg)';
      tl.style.opacity = dx < -30 ? Math.min(1, -dx / 100) : 0; tr.style.opacity = dx > 30 ? Math.min(1, dx / 100) : 0;
    }, { passive: true });
    card.addEventListener('touchend', function () {
      if (!dragging) return; dragging = false; card.style.transition = '';
      if (horiz && Math.abs(dx) > 90) { card.style.transform = ''; answer(dx > 0 ? 'good' : 'again'); }
      else { card.style.transform = ''; tl.style.opacity = 0; tr.style.opacity = 0; }
    });
  }

  // ---------- global clicks & keys ----------
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g && !g.disabled) { e.preventDefault(); go(g.getAttribute('data-go')); return; }
    var a = e.target.closest('[data-act]');
    if (a) {
      var act = a.getAttribute('data-act');
      if (act === 'reveal') { session.revealed = true; drawStudy(); }
      else if (act === 'again' || act === 'good' || act === 'easy') answer(act);
      else if (act === 'skip') { session.i++; session.revealed = false; drawStudy(); }
      else if (act === 'star') {
        var id = session && session.single ? session.id : session.queue[session.i];
        var on = toggleStar(id); a.classList.toggle('on', on); a.innerHTML = on ? ICON.star : ICON.starO; toast(on ? 'Starred' : 'Removed star');
      }
      else if (act === 'reshuffle') { var sc = session.scope; session = null; go('#s/' + sc + '/shuffle'); route(); }
      else if (act === 'hide-install') { S.hideInstall = true; save(); home(); }
      else if (act === 'export') {
        var io = document.getElementById('io'); io.value = JSON.stringify({ app: 'interview-prep', v: 1, c: S.c, cfg: S.cfg });
        io.select();
        try { navigator.clipboard.writeText(io.value).then(function () { toast('Backup copied'); }, function () { toast('Select the text and copy it'); }); } catch (err) { toast('Select the text and copy it'); }
      }
      else if (act === 'import') {
        try { var d = JSON.parse(document.getElementById('io').value); if (!d || !d.c) throw 0; S.c = d.c; if (d.cfg) S.cfg = d.cfg; save(); applyCfg(); toast('Progress restored'); }
        catch (err) { toast('That text is not a backup from this app'); }
      }
      else if (act === 'reset') {
        if (a.dataset.armed) { S.c = {}; save(); toast('Progress reset'); go('#'); }
        else { a.dataset.armed = '1'; a.textContent = 'Tap again to erase all progress'; setTimeout(function () { delete a.dataset.armed; a.textContent = 'Reset all progress'; }, 3500); }
      }
      return;
    }
    var st = e.target.closest('[data-set]');
    if (st) {
      var k = st.getAttribute('data-set'), v = st.getAttribute('data-val');
      S.cfg[k] = k === 'theme' ? v : Number(v); save(); applyCfg(); settings();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (!session || session.single || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!session.revealed) { session.revealed = true; drawStudy(); } else answer('good'); }
    else if (session.revealed && e.key === '1') answer('again');
    else if (session.revealed && e.key === '2') answer('good');
    else if (session.revealed && e.key === '3') answer('easy');
  });

  // ---------- boot ----------
  applyCfg();
  fetch('data/cards.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { index(d); route(); })
    .catch(function () { app.innerHTML = '<div class="boot">Could not load the cards. Open the app once while online, then it works offline.</div>'; });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
