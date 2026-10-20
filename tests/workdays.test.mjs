import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workdaysBetween } from '../extension/runtime/bin/workdays.mjs';

const CLI = fileURLToPath(new URL('../extension/runtime/bin/workdays.mjs', import.meta.url));
const run = (arg) => spawnSync('node', arg === undefined ? [CLI] : [CLI, arg], { encoding: 'utf8' });

test('Пт 16.10 -> Вт 20.10 = 2', () => {
  assert.equal(workdaysBetween('2026-10-16', '2026-10-20'), 2);
});
test('праздник 19.10 -> 1', () => {
  assert.equal(workdaysBetween('2026-10-16', '2026-10-20', { holidays: ['2026-10-19'] }), 1);
});
test('отсутствие 19-20.10 -> 0', () => {
  assert.equal(workdaysBetween('2026-10-16', '2026-10-20', { absent: [{ from: '2026-10-19', to: '2026-10-20' }] }), 0);
});
test('from == to и to < from -> 0', () => {
  assert.equal(workdaysBetween('2026-10-20', '2026-10-20'), 0);
  assert.equal(workdaysBetween('2026-10-21', '2026-10-20'), 0);
});
test('неверная дата', () => {
  assert.throws(() => workdaysBetween('2026-13-01', '2026-10-20'), /invalid date/);
  assert.throws(() => workdaysBetween('2026-10-16', '2026-02-30'), /invalid date/);
  assert.throws(() => workdaysBetween('abc', '2026-10-20'), /invalid date/);
});
test('CLI: считает по items', () => {
  const r = run(JSON.stringify({
    today: '2026-10-20',
    holidays: ['2026-10-19'],
    items: [
      { id: 'PAY-1', since: '2026-10-16' },
      { id: 'PAY-2', since: '2026-10-09', absent: [{ from: '2026-10-12', to: '2026-10-14' }] },
    ],
  }));
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { 'PAY-1': 1, 'PAY-2': 3 });
});
test('CLI: без holidays/absent', () => {
  const r = run(JSON.stringify({ today: '2026-10-20', items: [{ id: 'A', since: '2026-10-16' }] }));
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { A: 2 });
});
test('CLI: нет аргумента / плохой JSON / плохая дата -> 2', () => {
  for (const arg of [undefined, '{oops', JSON.stringify({ today: '2026-02-30', items: [] })]) {
    const r = run(arg);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.length > 0);
  }
});
