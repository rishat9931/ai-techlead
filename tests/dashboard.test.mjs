import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

// withReport=false -> страница без reports/latest.js; tab — какая вкладка откроется
function build({ withReport = true, mutate, mutateTests, tab = 'standup' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dash-'));
  mkdirSync(join(dir, 'reports'));
  const setTab = `<script>try{localStorage.setItem('standup.tab',${JSON.stringify(tab)});localStorage.removeItem('standup.person');}catch(e){}</script>`;
  const html = readFileSync(HTML, 'utf8').replace('<head>', '<head>' + COUNTER + setTab);
  writeFileSync(join(dir, 'dashboard.html'), html);
  if (withReport) {
    const r = JSON.parse(readFileSync(FIX + 'report.json', 'utf8'));
    if (mutate) mutate(r);
    writeFileSync(join(dir, 'reports', `${DATE}.json`), JSON.stringify(r));
    const tr = JSON.parse(readFileSync(FIX + 'tests-report.json', 'utf8'));
    if (mutateTests) mutateTests(tr);
    writeFileSync(join(dir, 'reports', `tests-${DATE}.json`), JSON.stringify(tr));
    const p = spawnSync('node', [CLI, '--dir', join(dir, 'reports'), '--date', DATE], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
  }
  return dir;
}

// headless Chrome изредка зависает без вывода — одна повторная попытка с новым профилем
function dump(dir) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(dir, 'profile' + attempt)}`,
      '--virtual-time-budget=3000', '--dump-dom',
      'file://' + join(dir, 'dashboard.html')], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
    if (r.stdout && r.stdout.includes('</html>')) return r.stdout;
  }
  return '';
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

// ---------- деградированные отчёты ----------

// только отрисованный #app — без исходника скрипта страницы
const appHtml = (out) => { const i = out.indexOf('id="app"'), j = out.indexOf('<script src="reports/latest.js"'); return out.slice(i, j > i ? j : undefined); };
const run = (opts) => { const out = dump(build(opts)); assert.match(out, /ERRORS:0/); return appHtml(out); };

test('пустой спринт — «Нет активного спринта», без NaN/undefined', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.sprint = {}; } });
  assert.match(out, /Нет активного спринта/);
  assert.match(out, /Кто чем занят/);
  assert.ok(!/NaN|undefined/.test(out));
});

test('спринт при недоступной Jira — «Данные недоступны»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.sprint = {}; r.meta.sources.jira = 'unavailable'; } });
  assert.match(out, /Данные недоступны/);
});

test('пустые releases/tests/coverage — страница рисуется, видны пустые состояния', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.releases = {}; r.tests = {}; r.coverage = {}; } });
  assert.match(out, /Релизы/);
  assert.match(out, /Нет запланированных/);
  assert.match(out, /Лончей нет/);
  assert.match(out, /Данных о покрытии нет/);
  assert.ok(!/NaN|undefined/.test(out));
});

test('покрытие при недоступном TestOps — «Данные недоступны»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.tests = {}; r.coverage = {}; r.meta.sources.testops = 'unavailable'; } });
  assert.match(out, /Данные недоступны/);
});

test('XSS во флагах, id и роли экранируется', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => {
    r.people[0].flags = ['<img src=x onerror=alert(1)>'];
    r.people[0].role = '<img src=x onerror=alert(2)>';
    r.prs[0].id = '<img src=x onerror=alert(3)>';
    r.meta.sources['<img src=x onerror=alert(4)>'] = 'ok';
  } });
  assert.ok(!out.includes('<img src="x"'));
});

test('PR без whose_turn — «неясно», а не ход автора', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.prs = [r.prs[0]]; delete r.prs[0].whose_turn; } });
  assert.match(out, /неясно/);
  assert.ok(!/<td>автор: /.test(out));
});

test('источник partial — «частично», джобы Jenkins показываются', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => {
    r.meta.sources.jenkins = 'partial';
    r.tests.jobs = [{ name: 'smoke', state: 'hung', last_run: null, url: 'https://j.example/smoke' }];
  } });
  assert.match(out, /class="dot partial"/);
  assert.match(out, /частично/);
  assert.match(out, /зависла/);
  assert.ok(!/Состояние джоб Jenkins неизвестно/.test(out));
});

test('ссылки только http(s): нет href="" и javascript:', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => {
    delete r.signals[0].url;
    r.signals[1].url = 'javascript:alert(1)';
    r.meta.setup_hints[0].doc_url = 'JavaScript:alert(2)';
    r.people[0].active[0].url = 'https://jira.example/PAY-1271';
  } });
  assert.ok(!out.includes('href=""'));
  assert.ok(!/href="javascript:/i.test(out));
  assert.match(out, /href="https:\/\/jira\.example\/PAY-1271"/);
});

test('сигнал без age_days сортируется как 0 и не ломает страницу', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.signals.forEach((s) => { delete s.age_days; }); } });
  assert.match(out, /Требует внимания/);
});

test('тип релиза из meta.release_type рядом с заголовком «Релизы»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.meta.release_type = 'Release 2.0'; } });
  assert.match(out, /<h2>Релизы <span class="muted small">Release 2\.0<\/span><\/h2>/);
  assert.match(run({}), /<h2>Релизы<\/h2>/);
});

test('вкладка «Тесты»: jira_bug-строка — приглушённый текст, meta.notes — список', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'tests', mutateTests: (tr) => {
    tr.clusters[0].jira_bug = 'не проверено: Jira недоступна';
    tr.meta.notes = ['pay-smoke #418: упало 45 из 120 (38%) — гипотеза: окружение'];
  } });
  assert.match(out, /Разбор падений/);
  assert.match(out, /не проверено: Jira недоступна/);
  assert.match(out, /упало 45 из 120/);
  assert.ok(!out.includes('href=""'));
});
