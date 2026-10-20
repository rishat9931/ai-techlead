import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';

const AGENTS = fileURLToPath(new URL('../extension/agents/', import.meta.url));
const BIN = fileURLToPath(new URL('../extension/runtime/bin/', import.meta.url));

const files = existsSync(AGENTS) ? readdirSync(AGENTS).filter((f) => f.endsWith('.md')).sort() : [];

// Минимальный разбор: "---\n<frontmatter>\n---\n<тело>"
function parse(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const fm = lines.slice(1, end).join('\n');
  const field = (k) => (fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')) || [])[1]?.trim() ?? '';
  return { name: field('name'), description: field('description'), body: lines.slice(end + 1).join('\n') };
}

test('есть пять базовых агентов', () => {
  for (const n of ['techlead-preflight', 'jira-collector', 'bitbucket-collector', 'jenkins-collector', 'testops-collector']) {
    assert.ok(files.includes(`${n}.md`), n);
  }
});

for (const f of files) {
  const text = readFileSync(join(AGENTS, f), 'utf8');
  const parsed = parse(text);

  test(`${f}: frontmatter, name, description`, () => {
    assert.ok(text.startsWith('---\n'), 'начинается с ---');
    assert.ok(parsed, 'frontmatter закрыт ---');
    assert.equal(parsed.name, basename(f, '.md'));
    assert.ok(parsed.description.length > 0, 'description не пустой');
  });

  test(`${f}: тело не короче 40 строк`, () => {
    assert.ok(parsed.body.split('\n').length >= 40);
  });

  test(`${f}: упомянутые .techlead/bin/*.mjs существуют`, () => {
    for (const [, x] of parsed.body.matchAll(/\.techlead\/bin\/([\w.-]+\.mjs)/g)) {
      assert.ok(existsSync(join(BIN, x)), x);
    }
  });

  if (f.endsWith('-collector.md')) {
    test(`${f}: только чтение и raw.schema.json`, () => {
      assert.ok(parsed.body.includes('только чтение'), 'только чтение');
      assert.ok(parsed.body.includes('raw.schema.json'), 'raw.schema.json');
    });
  }
}

test('контракты сборщиков: in_sprint в jira, job в testops', () => {
  const body = (n) => parse(readFileSync(join(AGENTS, `${n}.md`), 'utf8')).body;
  assert.match(body('jira-collector'), /\bin_sprint\b/);
  assert.match(body('testops-collector'), /launches\[\]`: `\{project, job,/);
});
