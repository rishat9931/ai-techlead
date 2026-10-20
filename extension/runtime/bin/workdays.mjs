#!/usr/bin/env node
// Использование: node workdays.mjs '<json>'
// json: {"today":"YYYY-MM-DD","holidays":[...],"items":[{"id","since","absent":[{"from","to"}]}]}
// Вывод: {"<id>": рабочих дней в (since, today]}. exit 0 — ок; 2 — неверный ввод.
import { pathToFileURL } from 'node:url';

const DAY = 86400000;

function parse(s) {
  const m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    if (d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]) return t;
  }
  throw new Error(`invalid date: ${JSON.stringify(s)}`);
}

export function workdaysBetween(from, to, { holidays = [], absent = [] } = {}) {
  const f = parse(from);
  const t = parse(to);
  const hol = new Set(holidays.map((h) => parse(h)));
  const abs = absent.map((a) => [parse(a.from), parse(a.to)]);
  let n = 0;
  for (let d = f + DAY; d <= t; d += DAY) {
    const wd = new Date(d).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (hol.has(d)) continue;
    if (abs.some(([a, b]) => d >= a && d <= b)) continue;
    n++;
  }
  return n;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: workdays.mjs \'<json>\'');
    process.exit(2);
  }
  try {
    const { today, holidays = [], items = [] } = JSON.parse(arg);
    parse(today);
    const out = {};
    for (const it of items) {
      out[it.id] = workdaysBetween(it.since, today, { holidays, absent: it.absent ?? [] });
    }
    console.log(JSON.stringify(out));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
