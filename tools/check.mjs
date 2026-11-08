import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: { HOLIDAYS: [] }, console };
vm.createContext(ctx);
for (const f of ['data/holidays-1.js', 'data/holidays-2.js', 'data/holidays-3.js', 'data/holidays-4.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
}
const H = ctx.window.HOLIDAYS;

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const problems = [];
const ids = new Set();

const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y, m) => new Date(y, m + 1, 0).getDate();

function resolve(h, year) {
  if (h.m) {
    if (h.m === 2 && h.d === 29 && !isLeap(year)) return null;
    return { m: h.m, d: h.d };
  }
  const r = h.r;
  if (!r) return null;
  if (r[0] === 'doy') {
    const dt = new Date(year, 0, r[1]);
    return { m: dt.getMonth() + 1, d: dt.getDate() };
  }
  const month = r[1] - 1, dow = r[2];
  if (r[0] === 'nth') {
    const first = new Date(year, month, 1);
    const offset = (dow - first.getDay() + 7) % 7;
    const day = 1 + offset + (r[3] - 1) * 7;
    if (day > dim(year, month)) return null;
    return { m: month + 1, d: day };
  }
  if (r[0] === 'last') {
    const last = new Date(year, month + 1, 0);
    const off = (last.getDay() - dow + 7) % 7;
    return { m: month + 1, d: last.getDate() - off };
  }
  return null;
}

H.forEach((h, i) => {
  const where = `#${i} ${h.t || '(без названия)'}`;
  for (const f of ['t', 'e', 'l', 'c', 's', 'f']) {
    if (!h[f] || typeof h[f] !== 'string') problems.push(`${where}: нет поля ${f}`);
  }
  if (!Array.isArray(h.h) || h.h.length < 1) problems.push(`${where}: нет идей, как отметить`);
  if (!h.m && !h.r) problems.push(`${where}: нет ни m/d, ни правила`);
  if (h.m) {
    if (h.m < 1 || h.m > 12) problems.push(`${where}: плохой месяц ${h.m}`);
    if (h.d < 1 || h.d > 31) problems.push(`${where}: плохой день ${h.d}`);
    if (h.d > dim(2026, h.m - 1) && !(h.m === 2 && h.d === 29)) problems.push(`${where}: дня ${h.d} нет в месяце ${h.m}`);
  }
  if (ids.has(h.t)) problems.push(`дубль названия: ${h.t}`);
  ids.add(h.t);
  if (!['fun','food','geek','nature','local','people'].includes(h.c)) problems.push(`${where}: неизвестная категория ${h.c}`);
});

function coverage(year) {
  const map = new Map();
  H.forEach(h => {
    const r = resolve(h, year);
    if (!r) return;
    const k = `${r.m}-${r.d}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(h.t);
  });
  return map;
}

const y = 2026;
const map = coverage(y);
const totalDays = isLeap(y) ? 366 : 365;
const empty = [];
for (let m = 1; m <= 12; m++) {
  for (let d = 1; d <= dim(y, m - 1); d++) {
    if (!map.has(`${m}-${d}`)) empty.push(`${d} ${MONTHS[m - 1]}`);
  }
}

console.log('Всего записей:', H.length);
console.log('Записей с фиксированной датой:', H.filter(h => h.m).length);
console.log('Записей с правилом:', H.filter(h => h.r).length);
console.log(`Дней с праздником в ${y}:`, map.size, 'из', totalDays);
console.log('Пустых дней:', empty.length);
console.log('Пусто:', empty.join(', '));

// распределение по месяцам
const perMonth = Array.from({ length: 12 }, (_, i) => 0);
for (const k of map.keys()) perMonth[+k.split('-')[0] - 1]++;
console.log('По месяцам:', perMonth.join(', '));

// максимум праздников в день
let maxK = '', maxV = 0;
for (const [k, v] of map) if (v.length > maxV) { maxV = v.length; maxK = k; }
console.log('Максимум в день:', maxV, '—', maxK, map.get(maxK).join(' | '));

// проверка «плавающих» дат на 2026
const rules = H.filter(h => h.r);
console.log('\nПлавающие праздники в 2026:');
for (const h of rules) {
  const r = resolve(h, 2026);
  console.log(' ', h.t, '→', r ? `${r.d} ${MONTHS[r.m - 1]}` : 'нет в этом году');
}

console.log('\nПроблемы:', problems.length ? '\n' + problems.join('\n') : 'нет');
process.exitCode = problems.length ? 1 : 0;
