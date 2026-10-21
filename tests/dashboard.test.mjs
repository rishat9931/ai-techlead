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
function build({ withReport = true, mutate, mutateTests, tab = 'overview' } = {}) {
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

test('обзор рисуется без ошибок: KPI и баннер неподключённого источника', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build());
  assert.match(out, /ERRORS:0/);
  assert.match(out, /Jenkins не подключён/);
  assert.match(out, /class="k">Статус</);
  const outTeam = dump(build({ tab: 'team' }));
  assert.match(outTeam, /ERRORS:0/);
  assert.match(outTeam, /Кто чем занят/);
  assert.match(outTeam, /Требует внимания/);
});

test('без latest.js — «Отчёта ещё нет»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  assert.match(dump(build({ withReport: false })), /Отчёта ещё нет/);
});

test('XSS в названии задачи экранируется', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build({ tab: 'team', mutate: (r) => { r.people[0].active[0].title = '<img src=x onerror=alert(1)>'; } }));
  assert.match(out, /ERRORS:0/);
  assert.ok(!out.includes('<img src="x"'));
});

test('джобы Jenkins выводятся с русскими подписями', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = dump(build({ tab: 'autotests', mutate: (r) => {
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

test('пустой спринт — пилюля «Нет активного спринта», без NaN/undefined', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.sprint = {}; } });
  assert.match(out, /Нет активного спринта/);
  assert.ok(!/NaN|undefined/.test(out));
});

test('спринт при недоступной Jira — «Данные недоступны»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ mutate: (r) => { r.sprint = {}; r.meta.sources.jira = 'unavailable'; } });
  assert.match(out, /Данные недоступны/);
});

test('пустые releases — «Нет», страница рисуется', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'releases', mutate: (r) => { r.releases = {}; } });
  assert.match(out, /Конвейер релизов/);
  assert.match(out, /Стадии релиза не заданы/);
  assert.ok(!/NaN|undefined/.test(out));
});

test('цель спринта — отдельной карточкой на обзоре (как в PO Cockpit)', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'overview' });
  assert.match(out, /Цель спринта/);
  assert.match(out, /Редизайн лидов на ИФТ и релиз Маркирования 3\.9\.0 на ПРОМ/);
  const empty = run({ tab: 'overview', mutate: (r) => { delete r.sprint.goal; } });
  assert.match(empty, /Цель спринта в Jira не заполнена/);
});

test('релизы: открытые — на стадиях конвейера, выведенные — отдельно, «просрочки» нет', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'releases' });
  assert.match(out, /class="cols"/);
  assert.match(out, /class="stagecol"/);
  assert.match(out, /Ожидает вывода/);
  assert.match(out, /Выведено на ПРОМ/);
  // открытый релиз с прошедшей плановой датой остаётся в конвейере, а не в «прошедших»
  assert.ok(!/Прошедшие за 30 дней/.test(out));
  const pipeline = out.slice(out.indexOf('Конвейер релизов'), out.indexOf('Выведено на ПРОМ'));
  assert.match(pipeline, /PAY-1240/);
  assert.ok(!/просроч/i.test(pipeline));
});

test('релиз вне стадий конвейера попадает в колонку «статус вне конвейера»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'releases' });
  assert.match(out, /статус вне конвейера/);
  const outside = out.slice(out.indexOf('статус вне конвейера'));
  assert.match(outside.slice(0, 600), /PAY-1291/);
});

test('пустые tests/coverage — пустые состояния автотестов', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'autotests', mutate: (r) => { r.tests = {}; r.coverage = {}; } });
  assert.match(out, /Лончей нет/);
  assert.match(out, /Падений нет/);
  assert.match(out, /Данных о покрытии нет/);
  assert.ok(!/NaN|undefined/.test(out));
});

test('автотесты при недоступном TestOps — «Данные недоступны»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'autotests', mutate: (r) => { r.tests = {}; r.coverage = {}; r.meta.sources.testops = 'unavailable'; } });
  assert.match(out, /Данные недоступны/);
});

test('XSS во флагах, id и роли экранируется (команда и PR)', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const mutate = (r) => {
    r.people[0].flags = ['<img src=x onerror=alert(1)>'];
    r.people[0].role = '<img src=x onerror=alert(2)>';
    r.prs[0].id = '<img src=x onerror=alert(3)>';
    r.meta.sources['<img src=x onerror=alert(4)>'] = 'ok';
  };
  for (const tab of ['team', 'prs']) {
    const out = run({ tab, mutate });
    assert.ok(!out.includes('<img src="x"'));
  }
});

test('PR без whose_turn — «неясно», а не ход автора', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'prs', mutate: (r) => { r.prs = [r.prs[0]]; delete r.prs[0].whose_turn; } });
  assert.match(out, /неясно/);
  assert.ok(!/<td>автор: /.test(out));
});

test('источник partial — «частично», джобы Jenkins показываются', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'autotests', mutate: (r) => {
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
  const mutate = (r) => {
    delete r.signals[0].url;
    r.signals[1].url = 'javascript:alert(1)';
    r.meta.setup_hints[0].doc_url = 'JavaScript:alert(2)';
    r.people[0].active[0].url = 'https://jira.example/PAY-1271';
  };
  const out = run({ tab: 'team', mutate });
  assert.ok(!out.includes('href=""'));
  assert.ok(!/href="javascript:/i.test(out));
  assert.match(out, /href="https:\/\/jira\.example\/PAY-1271"/);
  const outOverview = run({ tab: 'overview', mutate });
  assert.ok(!/href="javascript:/i.test(outOverview));
});

test('сигнал без age_days сортируется как 0 и не ломает страницу', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'team', mutate: (r) => { r.signals.forEach((s) => { delete s.age_days; }); } });
  assert.match(out, /Требует внимания/);
});

test('тип релиза из meta.release_type рядом с заголовком «Релизы»', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'releases', mutate: (r) => { r.meta.release_type = 'Release 2.0'; } });
  assert.match(out, /<h2>Релизы <span class="muted small">Release 2\.0<\/span><\/h2>/);
  assert.match(run({ tab: 'releases' }), /<h2>Релизы<\/h2>/);
});

test('вкладка «Разбор падений»: jira_bug-строка — приглушённый текст, meta.notes — список', (t) => {
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

test('прежняя вкладка «standup» из localStorage открывает обзор', (t) => {
  if (!CHROME) return t.skip('chrome not found');
  const out = run({ tab: 'standup' });
  assert.match(out, /class="k">Статус</);
});
