import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = new URL('../extension/runtime/bin/publish.mjs', import.meta.url).pathname;
const HTML = new URL('../extension/runtime/dashboard.html', import.meta.url).pathname;
const FIX = new URL('./fixtures/', import.meta.url).pathname;
const DATE = '2026-10-20';

const CHROME = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));

const COUNTER = `<script>(function(){var n=0;window.onerror=function(){n++;};window.addEventListener('load',function(){setTimeout(function(){document.title='ERRORS:'+n;},300);});})();</script>`;

// withReport=false -> страница без reports/latest.js
function build({ withReport = true, mutate } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dash-'));
  mkdirSync(join(dir, 'reports'));
  const html = readFileSync(HTML, 'utf8').replace('<head>', '<head>' + COUNTER);
  writeFileSync(join(dir, 'dashboard.html'), html);
  if (withReport) {
    const r = JSON.parse(readFileSync(FIX + 'report.json', 'utf8'));
    if (mutate) mutate(r);
    writeFileSync(join(dir, 'reports', `${DATE}.json`), JSON.stringify(r));
    copyFileSync(FIX + 'tests-report.json', join(dir, 'reports', `tests-${DATE}.json`));
    const p = spawnSync('node', [CLI, '--dir', join(dir, 'reports'), '--date', DATE], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
  }
  return dir;
}

function dump(dir) {
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom',
    'file://' + join(dir, 'dashboard.html')], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
  return r.stdout || '';
}

test('страница рисуется без ошибок', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build());
  assert.match(out, /ERRORS:0/);
  assert.match(out, /Кто чем занят/);
  assert.match(out, /Jenkins не подключён/);
});

test('без latest.js — «Отчёта ещё нет»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  assert.match(dump(build({ withReport: false })), /Отчёта ещё нет/);
});

test('XSS в названии задачи экранируется', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build({ mutate: (r) => { r.people[0].active[0].title = '<img src=x onerror=alert(1)>'; } }));
  assert.match(out, /ERRORS:0/);
  assert.ok(!out.includes('<img src="x"'));
});

test('джобы Jenkins выводятся с русскими подписями', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build({ mutate: (r) => {
    r.meta.sources.jenkins = 'ok';
    r.tests.jobs = [
      { name: 'smoke', state: 'hung', last_run: '2026-10-19T10:00:00+03:00', url: 'https://j.example/smoke' },
      { name: 'nightly', state: 'idle', last_run: '2026-10-10T10:00:00+03:00', url: 'https://j.example/nightly' },
    ];
  } }));
  assert.match(out, /ERRORS:0/);
  assert.match(out, /зависла/);
  assert.match(out, /давно не запускалась/);
});
