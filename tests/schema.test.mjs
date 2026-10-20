import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validate } from '../extension/runtime/bin/lib/schema.mjs';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const reportSchema = load('../extension/runtime/schemas/report.schema.json');
const testsSchema = load('../extension/runtime/schemas/tests-report.schema.json');
const rawSchema = load('../extension/runtime/schemas/raw.schema.json');
const report = () => load('./fixtures/report.json');

test('fixture report.json is valid', () => {
  assert.deepEqual(validate(reportSchema, report()), []);
});

test('missing sprint -> $.sprint: required', () => {
  const r = report(); delete r.sprint;
  assert.ok(validate(reportSchema, r).includes('$.sprint: required'));
});

test('status.level blue -> enum error', () => {
  const r = report(); r.status.level = 'blue';
  assert.ok(validate(reportSchema, r).includes('$.status.level: expected one of red|yellow|green'));
});

test('wrong type -> expected number', () => {
  const r = report(); r.sprint.day = 'x';
  assert.ok(validate(reportSchema, r).includes('$.sprint.day: expected number'));
});

test('array item path uses [i]', () => {
  const r = report(); delete r.signals[0].reminder;
  assert.ok(validate(reportSchema, r).includes('$.signals[0].reminder: required'));
});

test('type arrays and integer', () => {
  const s = { type: 'object', properties: { a: { type: ['string', 'null'] }, n: { type: 'integer' } } };
  assert.deepEqual(validate(s, { a: null, n: 2 }), []);
  assert.deepEqual(validate(s, { n: 2.5 }), ['$.n: expected integer']);
});

test('fixture tests-report.json is valid', () => {
  assert.deepEqual(validate(testsSchema, load('./fixtures/tests-report.json')), []);
});

test('raw with error only is valid; without source is not', () => {
  assert.deepEqual(validate(rawSchema, { source: 'jira', collected_at: '2026-10-20T09:00:00+03:00', error: 'timeout' }), []);
  assert.ok(validate(rawSchema, { collected_at: 'x' }).includes('$.source: required'));
});

test('CLI exit codes', () => {
  const bin = new URL('../extension/runtime/bin/validate.mjs', import.meta.url).pathname;
  const sch = new URL('../extension/runtime/schemas/report.schema.json', import.meta.url).pathname;
  const fx = new URL('./fixtures/report.json', import.meta.url).pathname;
  const tr = new URL('./fixtures/tests-report.json', import.meta.url).pathname;
  const ok = spawnSync('node', [bin, sch, fx], { encoding: 'utf8' });
  assert.equal(ok.status, 0); assert.equal(ok.stderr, '');
  const bad = spawnSync('node', [bin, sch, tr], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /\$\.sprint: required/);
  const gone = spawnSync('node', [bin, sch, '/nonexistent.json'], { encoding: 'utf8' });
  assert.equal(gone.status, 2); assert.ok(gone.stderr.length > 0);
});

test('meta.questions items are typed', () => {
  const r = report(); r.meta.questions = [{ person: 1 }];
  const e = validate(reportSchema, r);
  assert.ok(e.includes('$.meta.questions[0].person: expected string'));
  assert.ok(e.includes('$.meta.questions[0].text: required'));
});

test('enums: invalid whose_turn, category, job state rejected', () => {
  const r = report();
  r.prs[0].whose_turn = 'nobody';
  r.signals[0].category = 'x';
  r.tests.jobs = [{ name: 'j', state: 'broken' }];
  const e = validate(reportSchema, r);
  assert.ok(e.includes('$.prs[0].whose_turn: expected one of reviewers|author'));
  assert.ok(e.includes('$.signals[0].category: expected one of sprint|people|pr|release|tests|coverage'));
  assert.ok(e.includes('$.tests.jobs[0].state: expected one of ok|failed_before_tests|hung|idle'));
});
