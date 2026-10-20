import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scan } from '../extension/runtime/bin/secret-scan.mjs';

const rt = (p) => fileURLToPath(new URL(`../extension/runtime/${p}`, import.meta.url));
const read = (p) => readFileSync(rt(p), 'utf8');
const FILES = ['techlead.yaml', 'settings.json', 'gitignore', 'env.example'].map((f) => `templates/${f}`);

test('settings.json: валидный JSON, env только ${VAR}', () => {
  const s = JSON.parse(read('templates/settings.json'));
  assert.deepEqual(Object.keys(s.mcpServers), ['atlassian', 'bitbucket', 'jenkins', 'testops']);
  for (const srv of Object.values(s.mcpServers)) {
    assert.ok(srv.command);
    for (const v of Object.values(srv.env)) assert.match(v, /^\$\{[A-Z_]+\}$/);
  }
});

test('secret-scan по шаблонам чист', () => {
  for (const f of FILES) assert.deepEqual(scan(read(f)), [], f);
});

test('gitignore содержит три строки', () => {
  const lines = read('templates/gitignore').split('\n');
  for (const l of ['reports/raw/', 'reports/latest.js', '.env']) assert.ok(lines.includes(l), l);
});

test('techlead.yaml: ключи верхнего уровня', () => {
  const y = read('templates/techlead.yaml');
  const keys = ['team', 'calendar', 'jira', 'release', 'bitbucket', 'jenkins', 'testops', 'tests', 'thresholds', 'mcp'];
  for (const k of keys) assert.match(y, new RegExp(`^${k}:`, 'm'), k);
  assert.deepEqual([...y.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]), keys);
});

test('env.example и VERSION', () => {
  const e = read('templates/env.example');
  for (const v of ['JIRA_TOKEN', 'BITBUCKET_TOKEN', 'JENKINS_TOKEN', 'TESTOPS_TOKEN']) assert.match(e, new RegExp(`^${v}=$`, 'm'));
  assert.equal(read('VERSION'), '0.1.0\n');
});
