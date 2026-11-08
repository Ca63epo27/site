import fs from 'node:fs';
import vm from 'node:vm';

function fakeEl(id) {
  return {
    id,
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return null; },
    focus() {},
    select() {},
    offsetWidth: 1,
    getContext() {
      return {
        clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
        beginPath() {}, arc() {}, fill() {}, fillRect() {},
        set globalAlpha(v) {}, set fillStyle(v) {}
      };
    },
    scrollIntoView() {}
  };
}

const elements = new Map();
const document = {
  readyState: 'complete',
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, fakeEl(id));
    return elements.get(id);
  },
  addEventListener() {},
  createElement() { return fakeEl('tmp'); },
  body: { appendChild() {}, removeChild() {} }
};

const storage = new Map();
const ctx = {
  window: {
    HOLIDAYS: [],
    innerWidth: 1200,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    scrollTo() {}
  },
  document,
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v))
  },
  navigator: {},
  history: { replaceState() {} },
  location: { hash: '' },
  requestAnimationFrame: () => 0,
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  console
};
ctx.window.document = document;
ctx.window.localStorage = ctx.localStorage;
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of ['data/holidays-1.js', 'data/holidays-2.js', 'data/holidays-3.js', 'data/holidays-4.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
}
vm.runInContext(fs.readFileSync('app.js', 'utf8'), ctx, { filename: 'app.js' });

const hero = elements.get('hero')._html;
const upcoming = elements.get('upcoming')._html;
const calendar = elements.get('calendar')._html;
const explore = elements.get('explore')._html;

const checks = [
  ['hero отрисован', hero.length > 300],
  ['hero содержит заголовок дня', /day-title/.test(hero)],
  ['hero содержит карточку или пустое состояние', /hero-card/.test(hero)],
  ['upcoming отрисован', /day-chip/.test(upcoming)],
  ['calendar отрисован', /cal-day/.test(calendar) && /cal-grid/.test(calendar)],
  ['explore отрисован', /class="card"/.test(explore)],
  ['в explore есть чипы категорий', /data-action="cat"/.test(explore)],
  ['есть поиск', /search-input/.test(explore)],
  ['есть избранное-кнопки', /data-action="fav"/.test(explore)],
  ['нет "undefined" в разметке', !/undefined/.test(hero + upcoming + calendar + explore)]
];

let ok = true;
for (const [name, pass] of checks) {
  console.log((pass ? 'ok  ' : 'FAIL') + ' — ' + name);
  if (!pass) ok = false;
}

const titles = [...explore.matchAll(/<h3 class="card-title">([^<]+)<\/h3>/g)].map(m => m[1]);
console.log('\nКарточек в «Все праздники»:', titles.length);
console.log('Первые три:', titles.slice(0, 3).join(' · '));

const calDays = (calendar.match(/class="cal-day/g) || []).length;
console.log('Ячеек в календаре:', calDays);

process.exitCode = ok ? 0 : 1;
