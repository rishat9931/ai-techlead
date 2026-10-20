import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const COMMANDS = fileURLToPath(new URL('../extension/commands/', import.meta.url));
const AGENTS = fileURLToPath(new URL('../extension/agents/', import.meta.url));
const BIN = fileURLToPath(new URL('../extension/runtime/bin/', import.meta.url));

const NAMES = ['techlead-init', 'standup', 'tests', 'pr'];

// Минимальный разбор: "---\n<frontmatter>\n---\n<тело>"
function parse(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const fm = lines.slice(1, end).join('\n');
  const description = (fm.match(/^description:[ \t]*(.*)$/m) || [])[1]?.trim() ?? '';
  return { description, body: lines.slice(end + 1).join('\n') };
}

const read = (n) => readFileSync(join(COMMANDS, `${n}.md`), 'utf8');

for (const n of NAMES) {
  test(`${n}.md: существует, frontmatter с description`, () => {
    assert.ok(existsSync(join(COMMANDS, `${n}.md`)), `${n}.md`);
    const text = read(n);
    assert.ok(text.startsWith('---\n'), 'начинается с ---');
    const p = parse(text);
    assert.ok(p, 'frontmatter закрыт ---');
    assert.ok(p.description.length > 0, 'description не пустой');
    assert.ok(p.body.trim().length > 0, 'тело не пустое');
  });

  test(`${n}.md: упомянутые агенты существуют`, () => {
    const { body } = parse(read(n));
    const re = /\b(techlead-preflight|[a-z]+-collector|[a-z-]+-analyst)\b/g;
    for (const [, a] of body.matchAll(re)) {
      assert.ok(existsSync(join(AGENTS, `${a}.md`)), `агент ${a}`);
    }
  });

  test(`${n}.md: упомянутые .techlead/bin/*.mjs существуют`, () => {
    const { body } = parse(read(n));
    for (const [, x] of body.matchAll(/\.techlead\/bin\/([\w.-]+\.mjs)/g)) {
      assert.ok(existsSync(join(BIN, x)), x);
    }
  });

  test(`${n}.md: есть раздел «Запрещено»`, () => {
    assert.ok(parse(read(n)).body.includes('Запрещено'));
  });
}

test('standup.md: оркестрация — preflight, сборщики, аналитик, вопросы, publish, secret-scan, «да»', () => {
  const { body } = parse(read('standup'));
  for (const s of [
    'techlead-preflight', 'jira-collector', 'bitbucket-collector', 'jenkins-collector', 'testops-collector',
    'techlead-analyst', 'meta.questions', 'secret-scan.mjs', 'publish.mjs', '«да»', 'git pull --ff-only',
  ]) {
    assert.ok(body.includes(s), s);
  }
});

test('tests.md: {{args}}, tests-analyst и режим tests', () => {
  const { body } = parse(read('tests'));
  for (const s of ['{{args}}', 'tests-analyst', 'testops-collector', 'jenkins-collector', 'publish.mjs']) {
    assert.ok(body.includes(s), s);
  }
});

test('pr.md: bitbucket-collector, workdays.mjs, pr_stale_days; не публикует', () => {
  const { body } = parse(read('pr'));
  for (const s of ['bitbucket-collector', 'workdays.mjs', 'pr_stale_days']) assert.ok(body.includes(s), s);
  assert.ok(!body.includes('publish.mjs'), 'pr не публикует');
});

test('techlead-init.md: папки расширения и создаваемые файлы', () => {
  const { body } = parse(read('techlead-init'));
  for (const s of [
    '$TECHLEAD_EXTENSION_DIR', '~/.gigacode/extensions/ai-techlead', '~/.qwen/extensions/ai-techlead',
    '.techlead/VERSION', 'techlead.yaml', '.gigacode/settings.json', '.gitignore', '.env.example', 'dashboard.html', 'reports/',
  ]) {
    assert.ok(body.includes(s), s);
  }
});
