#!/usr/bin/env node
// Использование: node validate.mjs <schema.json> <data.json>
// exit 0 — валидно; 1 — ошибки в stderr; 2 — нечитаемый/невалидный JSON.
import { readFileSync } from 'node:fs';
import { validate } from './lib/schema.mjs';

const [schemaPath, dataPath] = process.argv.slice(2);
if (!schemaPath || !dataPath) {
  console.error('usage: validate.mjs <schema.json> <data.json>');
  process.exit(2);
}
const read = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`cannot read JSON ${p}: ${e.message}`);
    process.exit(2);
  }
};
const errors = validate(read(schemaPath), read(dataPath));
if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
