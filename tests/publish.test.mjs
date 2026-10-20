import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const CLI = new URL('../extension/runtime/bin/publish.mjs', import.meta.url).pathname;
const FIX = new URL('./fixtures/', import.meta.url).pathname;
const DATE = '2026-10-20';

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'pub-'));
  mkdirSync(join(cwd, 'reports'));
  return cwd;
}
const run = (cwd, ...args) => spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
const load = (cwd) => {
  const w = {};
  runInNewContext(readFileSync(join(cwd, 'reports/latest.js'), 'utf8'), { window: w });
  return w;
};
const put = (cwd, name, obj) =>
  writeFileSync(join(cwd, 'reports', name), typeof obj === 'string' ? obj : JSON.stringify(obj));
const fixture = (n) => JSON.parse(readFileSync(FIX + n, 'utf8'));

test('валидный отчёт публикуется, REPORT читается через vm', () => {
  const cwd = setup();
  const r = fixture('report.json');
  put(cwd, `${DATE}.json`, r);
  const p = run(cwd, '--date', DATE);
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /published reports\/latest\.js/);
  assert.equal(load(cwd).REPORT.sprint.name, r.sprint.name);
});

test('нет tests-отчёта → TESTS_REPORT === null', () => {
  const cwd = setup();
  put(cwd, `${DATE}.json`, fixture('report.json'));
  assert.equal(run(cwd, '--date', DATE).status, 0);
  assert.equal(load(cwd).TESTS_REPORT, null);
});

test('tests-отчёт включается', () => {
  const cwd = setup();
  put(cwd, `${DATE}.json`, fixture('report.json'));
  put(cwd, `tests-${DATE}.json`, fixture('tests-report.json'));
  assert.equal(run(cwd, '--date', DATE).status, 0);
  assert.equal(JSON.stringify(load(cwd).TESTS_REPORT), JSON.stringify(fixture('tests-report.json')));
});

test('невалидный отчёт → exit 1, latest.js не тронут', () => {
  const cwd = setup();
  writeFileSync(join(cwd, 'reports/latest.js'), 'OLD');
  put(cwd, `${DATE}.json`, { nope: 1 });
  const p = run(cwd, '--date', DATE);
  assert.equal(p.status, 1);
  assert.match(p.stderr, new RegExp(`${DATE}\\.json`));
  assert.equal(readFileSync(join(cwd, 'reports/latest.js'), 'utf8'), 'OLD');
});

test('невалидный tests-отчёт → exit 1, latest.js не тронут', () => {
  const cwd = setup();
  writeFileSync(join(cwd, 'reports/latest.js'), 'OLD');
  put(cwd, `${DATE}.json`, fixture('report.json'));
  put(cwd, `tests-${DATE}.json`, { nope: 1 });
  const p = run(cwd, '--date', DATE);
  assert.equal(p.status, 1);
  assert.match(p.stderr, /tests-/);
  assert.equal(readFileSync(join(cwd, 'reports/latest.js'), 'utf8'), 'OLD');
});

test('повторный publish перезаписывает файл', () => {
  const cwd = setup();
  put(cwd, `${DATE}.json`, fixture('report.json'));
  run(cwd, '--date', DATE);
  const a = readFileSync(join(cwd, 'reports/latest.js'), 'utf8');
  run(cwd, '--date', DATE);
  assert.equal(readFileSync(join(cwd, 'reports/latest.js'), 'utf8'), a);
  assert.ok(!existsSync(join(cwd, 'reports/latest.js.tmp')));
});

test('</script> в данных экранируется', () => {
  const cwd = setup();
  const r = fixture('report.json');
  r.sprint.name = 'x</script><b>';
  put(cwd, `${DATE}.json`, r);
  assert.equal(run(cwd, '--date', DATE).status, 0);
  const text = readFileSync(join(cwd, 'reports/latest.js'), 'utf8');
  assert.ok(text.includes('<\\/script>'));
  assert.ok(!text.includes('</script>'));
  assert.equal(load(cwd).REPORT.sprint.name, 'x</script><b>');
});

test('нет отчёта → exit 1 с сообщением', () => {
  const cwd = setup();
  const p = run(cwd, '--date', DATE);
  assert.equal(p.status, 1);
  assert.match(p.stderr, /нет отчёта reports\/2026-10-20\.json — сначала запустите \/standup/);
});

test('плохая дата → exit 2; битый JSON → exit 2', () => {
  const cwd = setup();
  assert.equal(run(cwd, '--date', '20-10-2026').status, 2);
  put(cwd, `${DATE}.json`, '{broken');
  assert.equal(run(cwd, '--date', DATE).status, 2);
});

test('--dir и дата по умолчанию (сегодня)', () => {
  const cwd = setup();
  mkdirSync(join(cwd, 'out'));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  writeFileSync(join(cwd, 'out', `${today}.json`), JSON.stringify(fixture('report.json')));
  const p = run(cwd, '--dir', 'out');
  assert.equal(p.status, 0, p.stderr);
  assert.ok(existsSync(join(cwd, 'out/latest.js')));
});
