#!/usr/bin/env node
// Использование: node secret-scan.mjs <файл…>
// Печатает "file:line rule" на каждую находку (значение секрета не печатается).
// exit 0 — чисто; 1 — есть находки; 2 — нет файлов / файл нечитаем.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TOKEN_LIKE = /(?:token|password|secret|api[_-]?key)["']?\s*[:=]\s*["']?([^\s"'$]{12,})/gi;
const BEARER = /Bearer [A-Za-z0-9._-]{20,}/;
const JIRA_PAT = /\b[A-Za-z0-9]{44,}\b/;
const PRIVATE_KEY = /-----BEGIN .*PRIVATE KEY-----/;

function tokenLike(line) {
  for (const m of line.matchAll(TOKEN_LIKE)) {
    if (!m[1].startsWith('<')) return true; // <...> — шаблонный плейсхолдер
  }
  return false;
}

const RULES = [
  ['token-like', tokenLike],
  ['bearer', (l) => BEARER.test(l)],
  ['jira-pat', (l) => /token/i.test(l) && JIRA_PAT.test(l)],
  ['private-key', (l) => PRIVATE_KEY.test(l)],
];

export function scan(text) {
  const out = [];
  text.split(/\r?\n/).forEach((l, i) => {
    for (const [rule, hit] of RULES) if (hit(l)) out.push({ line: i + 1, rule });
  });
  return out;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: secret-scan.mjs <file…>');
    process.exit(2);
  }
  let found = false;
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch (e) {
      console.error(`cannot read ${f}: ${e.code ?? e.message}`);
      process.exit(2);
    }
    for (const { line, rule } of scan(text)) {
      console.log(`${f}:${line} ${rule}`);
      found = true;
    }
  }
  process.exit(found ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
