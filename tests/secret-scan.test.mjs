import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../extension/runtime/bin/secret-scan.mjs';

const CLI = fileURLToPath(new URL('../extension/runtime/bin/secret-scan.mjs', import.meta.url));
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
const tmp = mkdtempSync(join(tmpdir(), 'secscan-'));
const file = (name, text) => {
  const p = join(tmp, name);
  writeFileSync(p, text);
  return p;
};

test('ссылка ${VAR} -> чисто', () => {
  assert.deepEqual(scan('"token": "${JIRA_TOKEN}"'), []);
  assert.deepEqual(scan('TOKEN=$JIRA_TOKEN_VALUE_X'), []);
});
test('JIRA_TOKEN=... -> token-like', () => {
  assert.deepEqual(scan('JIRA_TOKEN=abcd1234efgh5678ijkl'), [{ line: 1, rule: 'token-like' }]);
});
test('JSON "apiKey": "..." и password: ... -> token-like', () => {
  assert.deepEqual(scan('{"apiKey": "abcd1234efgh5678"}'), [{ line: 1, rule: 'token-like' }]);
  assert.deepEqual(scan('\n  password: hunter2hunter2hunter2'), [{ line: 2, rule: 'token-like' }]);
});
test('короткое значение -> чисто', () => {
  assert.deepEqual(scan('password: short'), []);
});
test('<placeholder> игнорируется', () => {
  assert.deepEqual(scan('token: <ваш-токен-из-настроек>'), []);
  assert.deepEqual(scan('token: "<paste-your-token-here>"'), []);
});
test('Bearer', () => {
  assert.deepEqual(scan('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6'), [{ line: 1, rule: 'bearer' }]);
  assert.deepEqual(scan('Bearer short'), []);
});
test('private-key', () => {
  assert.deepEqual(scan('x\n-----BEGIN RSA PRIVATE KEY-----'), [{ line: 2, rule: 'private-key' }]);
});
test('jira-pat: 44 символов рядом с token', () => {
  const pat = 'A'.repeat(44);
  assert.deepEqual(scan(`my token is ${pat}`), [{ line: 1, rule: 'jira-pat' }]);
  assert.deepEqual(scan(`Token ${'b1'.repeat(30)}`), [{ line: 1, rule: 'jira-pat' }]);
  assert.deepEqual(scan(`value ${pat}`), []);
  assert.deepEqual(scan(`token ${'A'.repeat(43)}`), []);
});
test('обычный YAML -> чисто', () => {
  const yaml = 'team:\n  name: Platform\n  jira:\n    url: https://jira.example.com\n    token_env: JIRA_TOKEN\n  reports_dir: reports\n';
  assert.deepEqual(scan(yaml), []);
});
test('несколько правил в одной строке, каждое один раз', () => {
  const r = scan('token=abcd1234efgh5678ijkl Bearer abcdefghijklmnopqrstuv token=zzzzzzzzzzzzzzzz');
  assert.deepEqual(r, [{ line: 1, rule: 'token-like' }, { line: 1, rule: 'bearer' }]);
});
test('несколько находок в файле', () => {
  const r = scan('ok\nsecret: abcdefghijkl1234\n-----BEGIN PRIVATE KEY-----');
  assert.deepEqual(r, [{ line: 2, rule: 'token-like' }, { line: 3, rule: 'private-key' }]);
});

test('CLI: без файлов -> 2', () => {
  const r = run();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});
test('CLI: нечитаемый файл -> 2', () => {
  assert.equal(run(join(tmp, 'nope.json')).status, 2);
});
test('CLI: чистый файл -> 0 и пустой вывод', () => {
  const r = run(file('clean.json', '{"token": "${JIRA_TOKEN}"}'));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
test('CLI: находки -> 1, file:line rule, без значения секрета', () => {
  const secret = 'abcd1234efgh5678ijkl';
  const p = file('bad.yaml', `a: 1\nJIRA_TOKEN=${secret}\n`);
  const r = run(p);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, `${p}:2 token-like\n`);
  assert.ok(!r.stdout.includes(secret) && !r.stderr.includes(secret));
});
