/* Праздничный дурдом — логика без зависимостей. */
(function () {
  'use strict';

  var HOLIDAYS = window.HOLIDAYS || [];
  var CATS = {
    fun:      { name: 'Смешные и странные', icon: '🎪', color: '#ff6b6b' },
    food:     { name: 'Еда и напитки',      icon: '🍕', color: '#ffb703' },
    geek:     { name: 'Наука и гики',       icon: '🚀', color: '#4cc9f0' },
    nature:   { name: 'Животные и природа', icon: '🐾', color: '#43aa8b' },
    local:    { name: 'Города и страны',    icon: '📍', color: '#9b5de5' },
    people:   { name: 'Люди и доброта',     icon: '💛', color: '#f15bb5' }
  };
  var MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var WD_SHORT = ['пн','вт','ср','чт','пт','сб','вс'];
  var WD_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

  // Каждому празднику — стабильный id
  HOLIDAYS.forEach(function (h, i) { h.id = 'h' + i; });

  var today = new Date();
  today.setHours(12, 0, 0, 0);

  var state = {
    date: new Date(today),
    viewMonth: today.getMonth(),
    viewYear: today.getFullYear(),
    query: '',
    cat: 'all',
    favsOnly: false,
    favs: loadFavs()
  };

  // ─── утилиты ──────────────────────────────────────────────
  function loadFavs() {
    try {
      var raw = localStorage.getItem('pd_favs_v1');
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveFavs() {
    try { localStorage.setItem('pd_favs_v1', JSON.stringify(state.favs)); } catch (e) {}
  }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function makeDate(y, m, d) { return new Date(y, m, d, 12, 0, 0, 0); }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  // ─── вычисление дат ───────────────────────────────────────
  function resolve(h, year) {
    if (h.m) {
      if (h.m === 2 && h.d === 29 && !isLeap(year)) return null;
      return { m: h.m, d: h.d };
    }
    var r = h.r;
    if (!r) return null;
    if (r[0] === 'doy') {
      var dt = new Date(year, 0, r[1], 12, 0, 0);
      return { m: dt.getMonth() + 1, d: dt.getDate() };
    }
    var month = r[1] - 1;
    var dow = r[2];
    if (r[0] === 'nth') {
      var first = new Date(year, month, 1);
      var offset = (dow - first.getDay() + 7) % 7;
      var day = 1 + offset + (r[3] - 1) * 7;
      if (day > daysInMonth(year, month)) return null;
      return { m: month + 1, d: day };
    }
    if (r[0] === 'last') {
      var last = new Date(year, month + 1, 0);
      var off = (last.getDay() - dow + 7) % 7;
      return { m: month + 1, d: last.getDate() - off };
    }
    return null;
  }

  function holidaysOn(date) {
    var m = date.getMonth() + 1, d = date.getDate(), y = date.getFullYear();
    var out = [];
    for (var i = 0; i < HOLIDAYS.length; i++) {
      var h = HOLIDAYS[i];
      var r = resolve(h, y);
      if (r && r.m === m && r.d === d) out.push(h);
    }
    return out;
  }

  function nextHolidayDays(from, limit) {
    var res = [];
    var cursor = new Date(from);
    for (var i = 1; i <= limit && res.length < 10; i++) {
      cursor.setDate(cursor.getDate() + 1);
      var hs = holidaysOn(cursor);
      if (hs.length) {
        res.push({ date: new Date(cursor), items: hs });
      }
    }
    return res;
  }

  // Все праздники с датой в конкретном году — для сетки и поиска
  function allWithDates(year) {
    var out = [];
    for (var i = 0; i < HOLIDAYS.length; i++) {
      var h = HOLIDAYS[i];
      var r = resolve(h, year);
      if (r) out.push({ h: h, m: r.m, d: r.d });
    }
    out.sort(function (a, b) {
      return (a.m - b.m) || (a.d - b.d) || (a.h.t < b.h.t ? -1 : 1);
    });
    return out;
  }

  // ─── конфетти ─────────────────────────────────────────────
  var confettiCanvas = null, confettiCtx = null, particles = [], confettiRunning = false;
  function initConfetti() {
    confettiCanvas = document.getElementById('confetti');
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }
  function resizeCanvas() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  function burst(x, y, count) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#ff6b6b', '#ffb703', '#4cc9f0', '#43aa8b', '#9b5de5', '#f15bb5', '#ffd166'];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 4 + Math.random() * 9;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
        life: 90 + Math.random() * 50,
        age: 0,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }
    if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(tick); }
  }
  function burstRain(count) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#ff6b6b', '#ffb703', '#4cc9f0', '#43aa8b', '#9b5de5', '#f15bb5', '#ffd166'];
    var w = window.innerWidth;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: -30 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        color: colors[(Math.random() * colors.length) | 0],
        life: 150 + Math.random() * 90,
        age: 0,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }
    if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(tick); }
  }

  function tick() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age++;
      p.vy += 0.22;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      var alpha = Math.max(0, 1 - p.age / p.life);
      if (alpha <= 0 || p.y > confettiCanvas.height + 50) { particles.splice(i, 1); continue; }
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha = alpha;
      confettiCtx.fillStyle = p.color;
      if (p.shape === 'rect') {
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        confettiCtx.beginPath();
        confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        confettiCtx.fill();
      }
      confettiCtx.restore();
    }
    if (particles.length) {
      requestAnimationFrame(tick);
    } else {
      confettiRunning = false;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // ─── рендер: герой дня ────────────────────────────────────
  function catBadge(h) {
    var c = CATS[h.c] || { name: 'Праздник', icon: '🎉', color: '#666' };
    return '<span class="badge badge-cat" style="--cat:' + c.color + '">' + c.icon + ' ' + esc(c.name) + '</span>';
  }

  function heroCard(h, isMain) {
    var cat = CATS[h.c] || { color: '#666' };
    var howList = (h.h || []).map(function (x) {
      return '<li class="how-item"><span class="how-mark">→</span>' + esc(x) + '</li>';
    }).join('');
    var fav = state.favs.indexOf(h.id) !== -1;
    return '' +
      '<article class="hero-card ' + (isMain ? 'hero-card--main' : '') + '" style="--cat:' + cat.color + '">' +
        '<span class="hero-watermark" aria-hidden="true">' + h.e + '</span>' +
        '<div class="hero-card-head">' +
          '<div class="hero-emoji" aria-hidden="true">' + h.e + '</div>' +
          '<div class="hero-main">' +
            '<div class="hero-badges">' + catBadge(h) +
              '<span class="badge badge-loc">📍 ' + esc(h.l) + '</span>' +
            '</div>' +
            '<h2 class="hero-title">' + esc(h.t) + '</h2>' +
            '<p class="hero-desc">' + esc(h.s) + '</p>' +
          '</div>' +
        '</div>' +
        (howList ? '<div class="how-block"><div class="how-title">Как отметить</div><ul class="how-list">' + howList + '</ul></div>' : '') +
        (h.f ? '<div class="fact"><span class="fact-mark">💡</span><div><strong>Факт в тему.</strong> ' + esc(h.f) + '</div></div>' : '') +
        '<div class="hero-card-foot">' +
          '<button class="btn btn-like ' + (fav ? 'is-fav' : '') + '" data-action="fav" data-id="' + h.id + '">' +
            '<span class="heart">' + (fav ? '♥' : '♡') + '</span>' + (fav ? 'В избранном' : 'Сохранить') +
          '</button>' +
          '<button class="btn btn-ghost" data-action="share" data-id="' + h.id + '">Поделиться</button>' +
        '</div>' +
      '</article>';
  }

  function dayHeader(date) {
    var isToday = sameDay(date, today);
    var wd = WD_FULL[date.getDay()];
    var dateStr = date.getDate() + ' ' + MONTHS[date.getMonth()];
    var diff = daysBetween(today, date);
    var rel = '';
    if (diff === 0) rel = 'сегодня';
    else if (diff === 1) rel = 'завтра';
    else if (diff === -1) rel = 'вчера';
    else if (diff > 1) rel = 'через ' + diff + ' ' + plural(diff, 'день', 'дня', 'дней');
    else rel = Math.abs(diff) + ' ' + plural(Math.abs(diff), 'день', 'дня', 'дней') + ' назад';

    return '' +
      '<div class="day-head">' +
        '<div class="day-head-left">' +
          '<div class="day-kicker">' + (isToday ? 'Сегодня' : 'Выбранный день') + '</div>' +
          '<h1 class="day-title">' + dateStr + '<span class="day-year">' + date.getFullYear() + '</span></h1>' +
          '<div class="day-sub">' + wd.charAt(0).toUpperCase() + wd.slice(1) + ' · ' + rel + '</div>' +
        '</div>' +
        '<div class="day-head-right">' +
          '<div class="day-nav">' +
            '<button class="round-btn" data-action="prev-day" aria-label="Предыдущий день">←</button>' +
            '<button class="round-btn" data-action="today" aria-label="Сегодня">сегодня</button>' +
            '<button class="round-btn" data-action="next-day" aria-label="Следующий день">→</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var GEN_A = ['Тёплых', 'Вторых', 'Мокрых', 'Ленивых', 'Хрустящих', 'Беззвучных', 'Полосатых',
    'Уютных', 'Нелепых', 'Медленных', 'Пушистых', 'Кислых', 'Круглых', 'Спонтанных', 'Спящих'];
  var GEN_B = ['носков', 'завтраков', 'обнимашек', 'варенья', 'облаков', 'тапочек', 'пельменей',
    'прогулок', 'мемов', 'подушек', 'лимонада', 'котов', 'пледов', 'бутербродов', 'лампочек'];

  function emptyHero(date) {
    var next = nextHolidayDays(date, 400)[0];
    var nextHtml = '';
    if (next) {
      var diff = daysBetween(date, next.date);
      var h0 = next.items[0];
      nextHtml = '' +
        '<div class="nearest">' +
          '<div class="nearest-kicker">Ближайший повод</div>' +
          '<button class="nearest-body" data-action="go" data-m="' + (next.date.getMonth() + 1) + '" data-d="' + next.date.getDate() + '" data-y="' + next.date.getFullYear() + '">' +
            '<span class="nearest-emoji">' + h0.e + '</span>' +
            '<span class="nearest-text"><strong>' + esc(h0.t) + '</strong>' +
              '<span class="nearest-meta">' + next.date.getDate() + ' ' + MONTHS[next.date.getMonth()] +
              ' · через ' + diff + ' ' + plural(diff, 'день', 'дня', 'дней') + '</span>' +
            '</span>' +
            '<span class="nearest-arrow">→</span>' +
          '</button>' +
        '</div>';
    }
    return '' +
      '<article class="hero-card hero-card--empty">' +
        '<div class="empty-emoji">🎈</div>' +
        '<h2 class="hero-title">В этот день официального повода нет</h2>' +
        '<p class="hero-desc">Так тоже бывает. Зато можно придумать свой праздник — и это будет самый честный из всех.</p>' +
        '<div class="generator">' +
          '<div class="generator-label">Генератор повода</div>' +
          '<div class="generator-out" id="gen-out">День тёплых носков</div>' +
          '<button class="btn btn-primary" data-action="gen">Придумать ещё</button>' +
        '</div>' +
        nextHtml +
      '</article>';
  }

  function renderHero() {
    var el = document.getElementById('hero');
    var hs = holidaysOn(state.date);
    var html = dayHeader(state.date);
    if (hs.length) {
      html += '<div class="hero-stack">';
      hs.slice(0, 1).forEach(function (h) { html += heroCard(h, true); });
      if (hs.length > 1) {
        html += '<div class="more-head">Ещё в этот день</div><div class="more-grid">';
        hs.slice(1).forEach(function (h) {
          html += '<article class="mini-card" style="--cat:' + ((CATS[h.c] || {}).color || '#666') + '">' +
            '<div class="mini-emoji">' + h.e + '</div>' +
            '<div class="mini-body">' +
              '<h3 class="mini-title">' + esc(h.t) + '</h3>' +
              '<div class="mini-loc">📍 ' + esc(h.l) + '</div>' +
              '<p class="mini-desc">' + esc(h.s) + '</p>' +
            '</div>' +
            '<button class="mini-fav" data-action="fav" data-id="' + h.id + '" aria-label="Сохранить">' +
              (state.favs.indexOf(h.id) !== -1 ? '♥' : '♡') + '</button>' +
          '</article>';
        });
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += emptyHero(state.date);
    }
    el.innerHTML = html;
  }

  // ─── рендер: ближайшие дни ────────────────────────────────
  function renderUpcoming() {
    var el = document.getElementById('upcoming');
    var list = nextHolidayDays(state.date, 45).slice(0, 6);
    if (!list.length) { el.innerHTML = ''; return; }
    var html = '<div class="section-head"><h2 class="section-title">Скоро</h2>' +
      '<div class="section-sub">Шесть ближайших дней с поводом</div></div>' +
      '<div class="upcoming-scroller">';
    list.forEach(function (d) {
      var h = d.items[0];
      var isT = sameDay(d.date, today);
      html += '<button class="day-chip' + (isT ? ' is-today' : '') + '" data-action="go" data-m="' +
        (d.date.getMonth() + 1) + '" data-d="' + d.date.getDate() + '" data-y="' + d.date.getFullYear() + '">' +
        '<span class="dc-date">' + d.date.getDate() + ' ' + MONTHS[d.date.getMonth()].slice(0, 3) + '</span>' +
        '<span class="dc-emoji">' + h.e + '</span>' +
        '<span class="dc-title">' + esc(h.t) + '</span>' +
        '<span class="dc-loc">' + esc(h.l) + '</span>' +
      '</button>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  // ─── рендер: календарь ────────────────────────────────────
  function renderCalendar() {
    var el = document.getElementById('calendar');
    var y = state.viewYear, m = state.viewMonth;
    var first = new Date(y, m, 1);
    var startOffset = (first.getDay() + 6) % 7; // с понедельника
    var dim = daysInMonth(y, m);
    var prevDim = daysInMonth(y, m - 1 < 0 ? 11 : m - 1);

    var html = '' +
      '<div class="cal-head">' +
        '<div><div class="cal-title">' + MONTHS_NOM[m] + ' ' + y + '</div>' +
        '<div class="cal-sub">Нажмите на день</div></div>' +
        '<div class="cal-nav">' +
          '<button class="round-btn" data-action="prev-month" aria-label="Предыдущий месяц">←</button>' +
          '<button class="round-btn" data-action="next-month" aria-label="Следующий месяц">→</button>' +
        '</div>' +
      '</div>' +
      '<div class="cal-grid cal-grid--wd">' +
        WD_SHORT.map(function (w) { return '<div class="cal-wd">' + w + '</div>'; }).join('') +
      '</div>' +
      '<div class="cal-grid">';

    for (var i = 0; i < startOffset; i++) {
      var pd = prevDim - startOffset + i + 1;
      html += '<div class="cal-day is-other">' + pd + '</div>';
    }
    for (var d = 1; d <= dim; d++) {
      var date = makeDate(y, m, d);
      var has = holidaysOn(date).length > 0;
      var cls = 'cal-day';
      if (sameDay(date, today)) cls += ' is-today';
      if (sameDay(date, state.date)) cls += ' is-selected';
      html += '<button class="' + cls + '" data-action="go" data-m="' + (m + 1) + '" data-d="' + d + '" data-y="' + y + '">' +
        '<span class="cal-num">' + d + '</span>' +
        (has ? '<span class="cal-dot"></span>' : '') +
      '</button>';
    }
    var total = startOffset + dim;
    var tail = (7 - (total % 7)) % 7;
    for (var t = 1; t <= tail; t++) {
      html += '<div class="cal-day is-other">' + t + '</div>';
    }
    html += '</div>' +
      '<div class="cal-legend"><span class="cal-dot"></span> есть праздник <span class="cal-legend-hint">← стрелки на клавиатуре тоже работают</span></div>';

    el.innerHTML = html;
  }

  // ─── рендер: все праздники ────────────────────────────────
  function matchesQuery(item, q) {
    if (!q) return true;
    var h = item.h;
    var hay = [h.t, h.l, h.s, h.f, (h.h || []).join(' '), (CATS[h.c] || {}).name].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderExplore() {
    var el = document.getElementById('explore');
    var year = state.date.getFullYear();
    var all = allWithDates(year);
    var q = state.query.trim().toLowerCase();
    var cat = state.cat;

    var filtered = all.filter(function (item) {
      if (state.favsOnly && state.favs.indexOf(item.h.id) === -1) return false;
      if (cat !== 'all' && item.h.c !== cat) return false;
      return matchesQuery(item, q);
    });

    var chips = '<button class="chip' + (cat === 'all' ? ' is-active' : '') + '" data-action="cat" data-cat="all">✨ Все</button>';
    Object.keys(CATS).forEach(function (k) {
      chips += '<button class="chip' + (cat === k ? ' is-active' : '') + '" data-action="cat" data-cat="' + k + '">' +
        CATS[k].icon + ' ' + esc(CATS[k].name) + '</button>';
    });

    var headTitle = state.favsOnly ? 'Избранное' : 'Все праздники';
    var headSub = state.favsOnly
      ? (state.favs.length ? 'Сохранённые поводы: ' + state.favs.length : 'Пока пусто — жмите ♡ на карточках')
      : 'В базе ' + all.length + ' дат на ' + year + ' год';

    var html = '' +
      '<div class="section-head">' +
        '<div><h2 class="section-title">' + headTitle + '</h2>' +
        '<div class="section-sub">' + headSub + '</div></div>' +
        '<label class="search">' +
          '<span class="search-icon">🔎</span>' +
          '<input id="search-input" type="search" placeholder="Найти праздник, город или еду…" value="' + esc(state.query) + '" />' +
        '</label>' +
      '</div>' +
      '<div class="chips">' + chips + '</div>';

    if (!filtered.length) {
      html += '<div class="empty-state"><div class="empty-state-emoji">🙈</div>' +
        '<h3>Ничего не нашлось</h3>' +
        '<p>' + (state.favsOnly ? 'Сохраните что-нибудь — и оно появится здесь.' : 'Попробуйте другой запрос или категорию.') + '</p></div>';
    } else {
      html += '<div class="grid">';
      filtered.forEach(function (item) {
        var h = item.h;
        var c = CATS[h.c] || { color: '#666', name: '' };
        var fav = state.favs.indexOf(h.id) !== -1;
        html += '<article class="card" style="--cat:' + c.color + '">' +
          '<div class="card-top">' +
            '<span class="card-date">' + item.d + ' ' + MONTHS[item.m - 1] + '</span>' +
            '<button class="card-fav' + (fav ? ' is-fav' : '') + '" data-action="fav" data-id="' + h.id + '" aria-label="В избранное">' +
              (fav ? '♥' : '♡') + '</button>' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="card-emoji">' + h.e + '</div>' +
            '<div>' +
              '<h3 class="card-title">' + esc(h.t) + '</h3>' +
              '<div class="card-loc">📍 ' + esc(h.l) + '</div>' +
            '</div>' +
          '</div>' +
          '<p class="card-desc">' + esc(h.s) + '</p>' +
          '<div class="card-foot"><span class="card-cat">' + c.icon + ' ' + esc(c.name) + '</span>' +
            '<button class="card-more" data-action="go" data-m="' + item.m + '" data-d="' + item.d + '" data-y="' + year + '">Открыть →</button>' +
          '</div>' +
        '</article>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderHeaderCounts() {
    var badge = document.getElementById('fav-count');
    if (badge) badge.textContent = state.favs.length;
    var btn = document.getElementById('fav-toggle');
    if (btn) btn.classList.toggle('is-active', state.favsOnly);
  }

  function renderAll() {
    renderHero();
    renderUpcoming();
    renderCalendar();
    renderExplore();
    renderHeaderCounts();
  }

  // ─── действия ─────────────────────────────────────────────
  function goTo(y, m, d) {
    state.date = makeDate(y, m, d);
    state.viewYear = y;
    state.viewMonth = m;
    state.favsOnly = false;
    renderAll();
    updateHash();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    burst(window.innerWidth / 2, window.innerHeight * 0.35, 26);
  }

  function shiftDay(delta) {
    var d = new Date(state.date);
    d.setDate(d.getDate() + delta);
    goTo(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i === -1) { state.favs.push(id); toast('Сохранено ♥'); }
    else { state.favs.splice(i, 1); toast('Убрано из избранного'); }
    saveFavs();
    renderAll();
  }

  function shareHoliday(id) {
    var h = HOLIDAYS.filter(function (x) { return x.id === id; })[0];
    var names = h ? h.t : 'праздник';
    var emoji = h ? h.e : '🎉';
    var text = state.date.getDate() + ' ' + MONTHS[state.date.getMonth()] + ' — ' + emoji + ' ' + names + '. ' +
      (h ? h.s : '') + ' Найдено в «Праздничном дурдоме».';
    if (navigator.share) {
      navigator.share({ title: 'Праздничный дурдом', text: text }).catch(function () {});
      return;
    }
    copyText(text);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Скопировано — можно вставить в чат'); },
        function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Скопировано'); } catch (e) { toast('Не получилось скопировать'); }
    document.body.removeChild(ta);
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2200);
  }

  function randomHoliday() {
    var y = state.date.getFullYear();
    for (var attempt = 0; attempt < 40; attempt++) {
      var h = HOLIDAYS[(Math.random() * HOLIDAYS.length) | 0];
      var r = resolve(h, y);
      if (r) {
        state.date = makeDate(y, r.m, r.d);
        state.viewYear = y;
        state.viewMonth = r.m - 1;
        state.favsOnly = false;
        renderAll();
        updateHash();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        burst(window.innerWidth / 2, window.innerHeight * 0.4, 70);
        toast('Случайный повод: ' + h.t);
        return;
      }
    }
  }

  function generateHoliday() {
    var out = document.getElementById('gen-out');
    if (!out) return;
    var a = GEN_A[(Math.random() * GEN_A.length) | 0];
    var b = GEN_B[(Math.random() * GEN_B.length) | 0];
    out.textContent = 'День ' + a.toLowerCase() + ' ' + b;
    out.classList.remove('pop');
    void out.offsetWidth;
    out.classList.add('pop');
  }

  // ─── hash ─────────────────────────────────────────────────
  function updateHash() {
    var d = state.date;
    var hash = '#' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (location.hash !== hash) {
      try { history.replaceState(null, '', hash); } catch (e) { /* file:// может запретить */ }
    }
  }

  function readHash() {
    var m = /^#(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(location.hash);
    if (!m) return false;
    var y = +m[1], mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > daysInMonth(y, mo - 1)) return false;
    state.date = makeDate(y, mo - 1, da);
    state.viewYear = y;
    state.viewMonth = mo - 1;
    return true;
  }

  // ─── события ──────────────────────────────────────────────
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      var action = t.getAttribute('data-action');

      if (action === 'go') {
        goTo(+t.getAttribute('data-y'), +t.getAttribute('data-m') - 1, +t.getAttribute('data-d'));
      } else if (action === 'fav') {
        e.stopPropagation();
        toggleFav(t.getAttribute('data-id'));
      } else if (action === 'share') {
        shareHoliday(t.getAttribute('data-id'));
      } else if (action === 'today') {
        goTo(today.getFullYear(), today.getMonth(), today.getDate());
      } else if (action === 'prev-day') {
        shiftDay(-1);
      } else if (action === 'next-day') {
        shiftDay(1);
      } else if (action === 'prev-month') {
        var pm = state.viewMonth - 1, py = state.viewYear;
        if (pm < 0) { pm = 11; py--; }
        state.viewMonth = pm; state.viewYear = py;
        renderCalendar();
      } else if (action === 'next-month') {
        var nm = state.viewMonth + 1, ny = state.viewYear;
        if (nm > 11) { nm = 0; ny++; }
        state.viewMonth = nm; state.viewYear = ny;
        renderCalendar();
      } else if (action === 'cat') {
        state.cat = t.getAttribute('data-cat');
        renderExplore();
      } else if (action === 'gen') {
        generateHoliday();
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'search-input') {
        state.query = e.target.value;
        var cursor = e.target.selectionStart;
        renderExplore();
        var input = document.getElementById('search-input');
        if (input) { input.focus(); try { input.setSelectionRange(cursor, cursor); } catch (err) {} }
      }
    });

    var favToggle = document.getElementById('fav-toggle');
    if (favToggle) {
      favToggle.addEventListener('click', function () {
        state.favsOnly = !state.favsOnly;
        if (state.favsOnly) {
          // чтобы избранное не «пряталось» за старым поиском и фильтром
          state.query = '';
          state.cat = 'all';
        }
        renderAll();
        var el = document.getElementById('explore');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    var randomBtn = document.getElementById('random-btn');
    if (randomBtn) randomBtn.addEventListener('click', randomHoliday);
    var todayBtn = document.getElementById('today-btn');
    if (todayBtn) todayBtn.addEventListener('click', function () {
      goTo(today.getFullYear(), today.getMonth(), today.getDate());
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { shiftDay(-1); }
      else if (e.key === 'ArrowRight') { shiftDay(1); }
    });

    window.addEventListener('hashchange', function () {
      if (readHash()) renderAll();
    });
  }

  // ─── старт ────────────────────────────────────────────────
  function init() {
    initConfetti();
    readHash();
    bind();
    renderAll();
    updateHash();
    // Праздничный «дождь» при загрузке
    setTimeout(function () { burstRain(45); }, 300);
    setTimeout(function () { burstRain(30); }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
