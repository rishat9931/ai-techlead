import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ext = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const read = (f) => JSON.parse(readFileSync(join(ext, f), 'utf8'));

test('манифесты gigacode и qwen идентичны', () => {
  assert.deepEqual(read('gigacode-extension.json'), read('qwen-extension.json'));
});

test('version совпадает с runtime/VERSION', () => {
  const v = readFileSync(join(ext, 'runtime', 'VERSION'), 'utf8').trim();
  assert.equal(read('gigacode-extension.json').version, v);
});

test('name, agents, commands; без contextFileName', () => {
  for (const f of ['gigacode-extension.json', 'qwen-extension.json']) {
    const m = read(f);
    assert.equal(m.name, 'ai-techlead');
    assert.equal('contextFileName' in m, false);
    for (const key of ['agents', 'commands']) {
      const dir = join(ext, m[key]);
      assert.ok(existsSync(dir), `${key} dir exists`);
      assert.ok(readdirSync(dir).length > 0, `${key} dir non-empty`);
    }
  }
});
