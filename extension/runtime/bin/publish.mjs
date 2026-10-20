#!/usr/bin/env node
// Использование: node publish.mjs [--dir reports] [--date YYYY-MM-DD]
// Валидирует отчёты и пишет <dir>/latest.js для dashboard.html.
// exit 0 — ок; 1 — ошибка валидации/нет отчёта; 2 — неверные аргументы/битый JSON.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validate } from './lib/schema.mjs';

const SCHEMAS = resolve(dirname(fileURLToPath(import.meta.url)), '../schemas');

class PublishError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new PublishError(`cannot read JSON ${path}: ${e.message}`, 2);
  }
}

const serialize = (x) => JSON.stringify(x, null, 2).replaceAll('</', '<\\/');

export function publish({ dir = 'reports', date = today() } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new PublishError(`неверная дата "${date}", ожидается YYYY-MM-DD`, 2);
  }
  const base = resolve(process.cwd(), dir);
  const reportFile = join(base, `${date}.json`);
  const testsFile = join(base, `tests-${date}.json`);
  if (!existsSync(reportFile)) {
    throw new PublishError(`нет отчёта ${dir}/${date}.json — сначала запустите /standup`, 1);
  }
  const report = readJson(reportFile);
  const tests = existsSync(testsFile) ? readJson(testsFile) : null;

  const errors = [];
  const check = (schemaName, data, label) => {
    const schema = readJson(join(SCHEMAS, schemaName));
    for (const e of validate(schema, data)) errors.push(`${label}: ${e}`);
  };
  check('report.schema.json', report, `${date}.json`);
  if (tests !== null) check('tests-report.schema.json', tests, `tests-${date}.json`);
  if (errors.length) throw new PublishError(errors.join('\n'), 1);

  const file = join(base, 'latest.js');
  const tmp = `${file}.tmp`;
  writeFileSync(
    tmp,
    `window.REPORT = ${serialize(report)};\nwindow.TESTS_REPORT = ${tests === null ? 'null' : serialize(tests)};\n`,
  );
  renameSync(tmp, file);
  return { file };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i];
    if ((k !== '--dir' && k !== '--date') || args[i + 1] === undefined) {
      console.error('usage: publish.mjs [--dir reports] [--date YYYY-MM-DD]');
      process.exit(2);
    }
    opts[k.slice(2)] = args[i + 1];
  }
  try {
    const { file } = publish(opts);
    console.log(`published ${opts.dir ?? 'reports'}/latest.js`);
  } catch (e) {
    if (!(e instanceof PublishError)) throw e;
    console.error(e.message);
    process.exit(e.code);
  }
}
