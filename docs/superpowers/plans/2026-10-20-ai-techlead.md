# AI-техлид для GigaCode — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширение для GigaCode CLI (совместимое с Qwen Code): субагенты собирают данные из Jira/Bitbucket/Jenkins/TestOps через MCP, аналитик строит снимок, локальная страница показывает стендап.

**Architecture:** Пакет `extension/` ставится через `<cli> extensions install`. Он даёт субагентов (`agents/*.md`) и команды (`commands/*.md`). Детерминированную работу делают Node-скрипты в `extension/runtime/bin/`: проверка по схеме, рабочие дни, публикация `latest.js`, поиск секретов. Схемы и `dashboard.html` тоже лежат там. `/techlead-init` копирует `runtime/` в рабочую папку команды как `.techlead/`, потому что в командах и агентах нет подстановки пути к расширению. LLM-части (сбор, анализ) пишут JSON, скрипты его проверяют и публикуют.

**Tech Stack:** Markdown + YAML frontmatter (агенты, команды); Node ≥ 18, ESM, без зависимостей (`node:test`, `node:fs`); vanilla HTML/CSS/JS; headless Chrome для смоук-теста страницы.

**Spec:** `docs/superpowers/specs/2026-10-20-ai-techlead-design.md`. Эталон страницы и данных: `prototype/dashboard.html`, `prototype/reports/latest.js`.

## Global Constraints

- Внешние системы только читаются. Писать можно в `reports/`, а в `techlead.yaml` — только после «да» пользователя.
- Без npm-зависимостей: только встроенные модули Node. Node ≥ 18.
- Скрипты принимают и отдают JSON. YAML читает только LLM: в Node нет встроенного YAML-парсера.
- Токены лежат только в env. `settings.json` содержит ссылки `${VAR}`.
- Тексты на русском, ссылки на всё.
- Совместимость с GigaCode и Qwen Code: манифест в двух экземплярах — `gigacode-extension.json` и `qwen-extension.json`, содержимое идентично.
- MCP-инструменты называются `mcp__<server>__<tool>`. Имена серверов (`atlassian`, `bitbucket`, `jenkins`, `testops`) берутся из `techlead.yaml → mcp.required`.
- Рабочие дни: Пн–Пт минус `calendar.holidays` минус `absent` человека.

## Review Focus

1. Не задан какой-то необязательный блок конфига (нет `calendar`, `absent`, `bots`). Ожидание: значения по умолчанию, без падения. Тест — в Task 2 (workdays без праздников) и Task 3 (отчёт без `tests_report`).
2. Отчёт без какого-то источника: `jenkins: unavailable`, пустые `tests.jobs`. Ожидание: страница показывает плашку и пустое состояние, без ошибок JS. Тест — в Task 5.
3. Повторный `/standup` в тот же день. Ожидание: снимок дня перезаписывается, не дублируется. Тест — в Task 3.
4. Токен попал в `techlead.yaml` или `settings.json`. Ожидание: скан находит его, коммит не предлагается. Тест — в Task 4.
5. Строки из Jira с `<script>` или кавычками в названии задачи. Ожидание: страница экранирует текст. Тест — в Task 5.

---

## Файлы

```
extension/
  gigacode-extension.json, qwen-extension.json
  agents/techlead-preflight.md, jira-collector.md, bitbucket-collector.md,
         jenkins-collector.md, testops-collector.md, techlead-analyst.md, tests-analyst.md
  commands/techlead-init.md, standup.md, tests.md, pr.md
  runtime/                         → копируется в <рабочая папка>/.techlead/
    VERSION
    dashboard.html
    bin/lib/schema.mjs             мини-валидатор JSON Schema (type, required, properties, items, enum)
    bin/validate.mjs               CLI: validate <schema> <file>
    bin/workdays.mjs               рабочие дни между датами
    bin/publish.mjs                reports/<date>.json (+ tests-<date>.json) → reports/latest.js
    bin/secret-scan.mjs            поиск токенов в файлах
    schemas/report.schema.json, tests-report.schema.json, raw.schema.json
    templates/techlead.yaml, settings.json, gitignore, env.example
tests/*.test.mjs                   node --test tests/
tests/fixtures/report.json, tests-report.json   (из prototype/reports/latest.js)
scripts/install.sh                 установка расширения в GigaCode/Qwen
README.md
package.json                       { "type": "module", "scripts": { "test": "node --test tests/" } }
```

---

### Task 1: Схемы, мини-валидатор, фикстуры

**Files:** Create `package.json`, `extension/runtime/bin/lib/schema.mjs`, `extension/runtime/bin/validate.mjs`, `extension/runtime/schemas/{report,tests-report,raw}.schema.json`, `tests/fixtures/{report,tests-report}.json`, `tests/schema.test.mjs`

**Interfaces:**
- Produces: `validate(schema, data) → string[]` (список ошибок вида `"$.sprint.day: expected number"`, пустой = валидно); CLI `node validate.mjs <schema.json> <data.json>` → exit 0/1, ошибки в stderr.
- `report.schema.json` повторяет контракт спеки. В `meta` добавлены: `team` (string), `thresholds` (object: pr_stale_days, pr_critical_days, task_stale_days — их использует страница). `tests_report` — string или null.

- [ ] Step 1: тесты `tests/schema.test.mjs`. Проверяют, что фикстура `report.json` валидна; что без `sprint` выдаётся ошибка `$.sprint: required`; что `status.level: "blue"` даёт ошибку enum; что `tests-report.json` валиден; что raw-файл `{source:"jira", collected_at, error:"timeout"}` валиден.
- [ ] Step 2: `node --test tests/` → FAIL (нет модуля).
- [ ] Step 3: `schema.mjs` (~60 строк: рекурсия по `type` с поддержкой массива типов, `required`, `properties`, `items`, `enum`); `validate.mjs`; три схемы; фикстуры из `prototype/reports/latest.js` (+ `meta.thresholds`).
- [ ] Step 4: `node --test tests/` → PASS.
- [ ] Step 5: commit `feat: схемы отчётов и валидатор`.

### Task 2: Рабочие дни

**Files:** Create `extension/runtime/bin/workdays.mjs`, `tests/workdays.test.mjs`

**Interfaces:**
- Produces: `workdaysBetween(from, to, {holidays=[], absent=[]}) → number` — количество рабочих дней в интервале (from, to]: выходные, праздники и дни отсутствия не считаются. CLI: `node workdays.mjs '<json>'`, где json = `{"today":"2026-10-20","holidays":[],"items":[{"id":"PAY-1","since":"2026-10-15","absent":[{"from","to"}]}]}`, вывод: `{"PAY-1":3}`.

- [ ] Step 1: тесты.
  - Пт 16.10 → Вт 20.10 = 2.
  - Тот же интервал с праздником 19.10 = 1.
  - Отсутствие 19–20.10 = 0.
  - from == to → 0.
  - Без `holidays` работает.
  - Неверная дата → исключение с текстом `invalid date`.
- [ ] Step 2: FAIL.
- [ ] Step 3: реализация в UTC по датам `YYYY-MM-DD`.
- [ ] Step 4: PASS.
- [ ] Step 5: commit.

### Task 3: Публикация снимка

**Files:** Create `extension/runtime/bin/publish.mjs`, `tests/publish.test.mjs`

**Interfaces:**
- Consumes: `validate` (Task 1).
- Produces: CLI `node .techlead/bin/publish.mjs [--dir reports] [--date YYYY-MM-DD]`.
  - Проверяет `reports/<date>.json` по схеме `report.schema.json`.
  - Если есть `reports/tests-<date>.json`, проверяет и его.
  - Пишет `reports/latest.js` = `window.REPORT = …;\nwindow.TESTS_REPORT = …|null;`.
  - Вывод: `published reports/latest.js`. При ошибках валидации — exit 1, `latest.js` не трогается.
  - Схемы ищет относительно себя: `../schemas`.

- [ ] Step 1: тесты (временная папка).
  - Валидный отчёт → `latest.js` создан, загрузка через `vm` даёт `REPORT.sprint.name`.
  - Нет tests-отчёта → `TESTS_REPORT === null`.
  - Невалидный отчёт → exit 1, старый `latest.js` не изменён.
  - Повторный publish → файл перезаписан, а не дописан.
  - Текст `</script>` в данных экранируется как `<\/script>`.
- [ ] Step 2: FAIL. Step 3: реализация. Step 4: PASS. Step 5: commit.

### Task 4: Поиск секретов

**Files:** Create `extension/runtime/bin/secret-scan.mjs`, `tests/secret-scan.test.mjs`

**Interfaces:**
- Produces: `scan(text) → [{line, rule}]`. CLI: `node secret-scan.mjs <files…>` → exit 1 и список `file:line rule`, если что-то найдено.
- Правила:
  - `token-like`: `(token|password|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"'$]{12,}`. Значения с `${` или `$` не считаются.
  - `bearer`: `Bearer [A-Za-z0-9._-]{20,}`.
  - `jira-pat`: `[A-Za-z0-9]{44}` рядом со словом token.
  - `private-key`: `-----BEGIN .*PRIVATE KEY-----`.

- [ ] Step 1: тесты.
  - `"token": "${JIRA_TOKEN}"` → чисто.
  - `JIRA_TOKEN=abcd1234efgh5678ijkl` → находка.
  - `Authorization: Bearer eyJhbGciOi…` → находка.
  - Обычный YAML из шаблона → чисто.
- [ ] Step 2–5: FAIL → реализация → PASS → commit.

### Task 5: Страница

**Files:** Create `extension/runtime/dashboard.html` (из `prototype/dashboard.html`), `tests/dashboard.test.mjs`

**Interfaces:**
- Consumes: `reports/latest.js` (Task 3).
- Изменения относительно прототипа:
  - пороги для бейджей берутся из `REPORT.meta.thresholds`, а не из константы `TH`;
  - джобы Jenkins рендерятся по схеме `{name, state: ok|failed_before_tests|hung|idle, last_run, url}` с русскими подписями;
  - если `window.REPORT` нет, показывается «Отчёта ещё нет — запустите /standup».

- [ ] Step 1: тест. Ищет Chrome: `CHROME_BIN` или стандартные пути macOS и Linux; если не найден — `t.skip`. Собирает временную папку из `dashboard.html` и `reports/latest.js`, построенного из фикстуры. Запускает `--headless=new --dump-dom` с внедрённым скриптом, который пишет в `document.title` число ошибок `window.onerror`. Проверки:
  - ошибок 0, в DOM есть «Кто чем занят» и «Jenkins не подключён»;
  - без `latest.js` — есть «Отчёта ещё нет»;
  - фикстура с названием задачи `<img src=x onerror=alert(1)>` — в DOM нет `<img src="x"`.
- [ ] Step 2: FAIL (нет файла). Step 3: перенос и правки. Step 4: PASS. Step 5: commit.

### Task 6: Шаблоны рабочей папки

**Files:** Create `extension/runtime/templates/{techlead.yaml,settings.json,gitignore,env.example}`, `extension/runtime/VERSION` (`0.1.0`), `tests/templates.test.mjs`

**Шаблоны:**
- `techlead.yaml` — как в спеке, с комментариями на русском, плейсхолдеры `<...>`.
- `settings.json` — `mcpServers` atlassian, bitbucket, jenkins, testops: `command` = `<команда запуска MCP из Confluence>`, env через `${JIRA_TOKEN}` и т. п.
- `gitignore` — `reports/raw/`, `reports/latest.js`, `.env`.
- `env.example` — четыре переменные без значений.

- [ ] Step 1: тесты.
  - `settings.json` парсится как JSON, во всех `env` значения вида `${…}`.
  - `secret-scan` по всем шаблонам чист.
  - `gitignore` содержит три строки.
  - `techlead.yaml` содержит ключи верхнего уровня `team: calendar: jira: release: bitbucket: jenkins: testops: tests: thresholds: mcp:` (проверка регуляркой по `^key:`).
- [ ] Step 2–5.

### Task 7: Preflight и сборщики

**Files:** Create `extension/agents/{techlead-preflight,jira-collector,bitbucket-collector,jenkins-collector,testops-collector}.md`, `tests/agents.test.mjs`

**Формат агента:**
```markdown
---
name: jira-collector
description: Собирает данные Jira для AI-техлида (спринт, люди, Release 2.0). Вызывается из /standup.
---
<системный промпт>
```
Поле `tools` не задаётся (наследуются все): маски по MCP-инструментам в GigaCode не проверены. Ограничение «только свой MCP, только чтение» задаётся в тексте промпта.

**Общий блок каждого сборщика:**
- Вход: путь к `techlead.yaml`, дата, папка `reports/raw/<дата>/`.
- Выход: `reports/raw/<дата>/<source>.json` = `{source, collected_at, data|error}`.
- Перед возвратом — проверка: `node .techlead/bin/validate.mjs .techlead/schemas/raw.schema.json <файл>`.
- Ответ оркестратору: 3–5 строк, без дампа.
- Нельзя: писать во внешние системы, выдумывать данные. При ошибке MCP — `error` в файле.

**Содержание `data` по источникам:**
- **jira**:
  - `sprint` {name, state, start, end, sp_done, sp_total, scope_added[]};
  - `issues[]` {key, title, type, status, status_group, assignee, last_status_change, links[], url} — задачи спринта и задачи в работе вне спринта;
  - `releases[]` {key, title, status, planned_date, closed_date, last_status_change, links[], url} — тип `release.issue_type` в окнах `ahead_days` / `back_days`;
  - `ready_without_release[]`, `unknown_people[]`.
  - Статусы сопоставляются с группами из `jira.statuses`.
- **bitbucket**: `prs[]` {repo, id, title, author, reviewers[], created, last_human_activity {at, who, what}, whose_turn, build, conflicts, needs_work, jira_key, url}. Только репозитории из конфига; события логинов из `bitbucket.bots` пропускаются.
- **jenkins**: `jobs[]` {name, state, last_run, url, console_excerpt?}. `console_excerpt` (последние 60 строк) — только в режиме `/tests` и только для `failed_before_tests` / `hung`.
- **testops**:
  - `launches[]` {project, name, passed, failed, broken, skipped, started_at, url};
  - `failures[]` {test, project, message, trace_top, first_failed_at, history: [pass|fail…], url};
  - `coverage[]` {project, automated, total}.
  - Глубина истории — `flaky_history_runs`.

**techlead-preflight** — шаги из спеки. Вход: список нужных источников (по умолчанию все). Выход (печатает JSON в ответе):
```json
{"ok_sources":["atlassian"],"missing":[{"name":"jenkins","reason":"нет переменной JENKINS_TOKEN","setup_steps":["…"],"settings_snippet":{},"doc_url":"…"}],"stop":false,"stop_reason":null}
```
Проверки:
- `test -f techlead.yaml`;
- переменные из `mcp.required.*.env` заданы (`printenv NAME`, значения не печатать);
- сервер есть в `.gigacode/settings.json`, `~/.gigacode/settings.json` или списке `gigacode mcp list` (с фолбэком на `qwen`);
- пробный вызов `probe`;
- поиск в Confluence: сначала `setup_docs.pages`, затем CQL `space = <SPACE> AND text ~ "<search>"`;
- `stop = true`, если нет `techlead.yaml` или Atlassian.

- [ ] Step 1: `tests/agents.test.mjs` (для всех `extension/agents/*.md`):
  - frontmatter начинается с `---`;
  - `name` совпадает с именем файла;
  - `description` не пустой;
  - тело не короче 40 строк;
  - каждая упомянутая `.techlead/bin/<x>.mjs` существует в `extension/runtime/bin/`;
  - в сборщиках есть «только чтение» и «raw.schema.json».
- [ ] Step 2: FAIL. Step 3: пять промптов. Step 4: PASS. Step 5: commit.

### Task 8: Аналитики

**Files:** Create `extension/agents/{techlead-analyst,tests-analyst}.md`

**techlead-analyst:**
- Вход: `techlead.yaml`, `reports/raw/<дата>/*.json`, предыдущий `reports/YYYY-MM-DD.json` (самый свежий до сегодняшнего), `reports/tests-<дата>.json`, если есть.
- Алгоритм:
  - (1) Дни без движения задач и PR считаются через `node .techlead/bin/workdays.mjs` — одним вызовом на все элементы.
  - (2) Сопоставление людей по логинам; PR связываются с задачами по `jira_key`.
  - (3) Сигналы по списку из спеки, пороги — `thresholds`. Каждому сигналу — `id`, `owner`, `reminder` (по образцу прототипа: обращение по имени, что сделать, срок, ссылка).
  - (4) Отклонения без объяснения (нет работы; без движения больше порога) записываются в `meta.questions[]` {person, text} — их задаёт оркестратор.
  - (5) Дельты к прошлому снимку: `is_new` для падений, `coverage.delta_prev`.
  - (6) Короткая причина `short_cause` — из `tests-<дата>.json` по имени теста.
  - (7) `status.summary` — одна фраза о 2–3 главных проблемах, `level` — по максимальному сигналу.
  - (8) 3–5 рекомендаций.
- Выход: `reports/<дата>.json`, затем `node .techlead/bin/validate.mjs`. При ошибке — исправить и проверить снова, максимум 2 раза.
- В схему `report.schema.json` (Task 1) добавить `meta.questions` (array).

**tests-analyst:**
- Вход: raw testops/jenkins, `tests` из конфига, необязательный фильтр по джобе.
- Действия:
  - кластеры по сигнатуре: тип исключения + сообщение без чисел, UUID и дат + верхний фрейм;
  - если упало больше `mass_failure_pct`% лонча — гипотеза «окружение»;
  - разбор `top_clusters`: категория, причина, `jira_bug` (поиск в Jira по сигнатуре или имени теста через Atlassian MCP, только чтение), `suggested_bug`, если бага нет;
  - для `flaky` — история прогонов.
- Выход: `reports/tests-<дата>.json` + проверка по схеме.

- [ ] Step 1: тест Task 7 автоматически покрывает новые файлы; добавить проверку, что в `techlead-analyst.md` упоминаются `workdays.mjs`, `validate.mjs`, `meta.questions`.
- [ ] Step 2: FAIL. Step 3: два промпта + правка схемы, фикстура `meta.questions: []`. Step 4: PASS. Step 5: commit.

### Task 9: Команды

**Files:** Create `extension/commands/{techlead-init,standup,tests,pr}.md`, `tests/commands.test.mjs`

**techlead-init:**
- Находит папку расширения: первая существующая из `~/.gigacode/extensions/ai-techlead`, `~/.qwen/extensions/ai-techlead`, `$TECHLEAD_EXTENSION_DIR`.
- Копирует `runtime/` в `./.techlead/` (если там уже есть — сравнивает `VERSION` и предлагает обновить).
- Создаёт файлы, которых ещё нет: `techlead.yaml`, `.gigacode/settings.json`, `.gitignore` (дописывает недостающие строки), `.env.example`, `dashboard.html` (копия), `reports/`.
- Ничего не перезаписывает без «да». В конце — список, что заполнить.

**standup (оркестратор):**
- (0) `git pull --ff-only`; если не вышло — предупредить.
- (1) Субагент `techlead-preflight`; если `stop` — показать причины и инструкции, конец. Если `missing` есть — показать инструкции и спросить «продолжить без них?».
- (2) Параллельно — субагенты-сборщики для ok-источников (Atlassian → jira-collector), каждому дата и пути.
- (3) Субагент `techlead-analyst`.
- (4) Если в `meta.questions` есть вопросы — задать одним сообщением. По ответам предложить правку `techlead.yaml` (отпуска, праздники); после «да» — правка и повтор шага 3.
- (5) `node .techlead/bin/publish.mjs`, открыть `dashboard.html` (`open` / `xdg-open` / `start`).
- (6) Три строки итога.
- (7) `node .techlead/bin/secret-scan.mjs` по `git diff --name-only` + новые файлы. Если чисто — предложить `git add reports/*.json techlead.yaml && git commit && git push`.

**tests:** `{{args}}` = необязательная джоба. Шаги: preflight(testops, jenkins) → testops-collector + jenkins-collector (режим `/tests`) → tests-analyst → publish (обновит `TESTS_REPORT`, если сегодняшний отчёт есть) → итог в чат по кластерам → предложить commit.

**pr:** preflight(bitbucket) → bitbucket-collector → в чат таблица зависших PR (порог `pr_stale_days`, считается через workdays) с чьим ходом и готовыми напоминаниями. Файлы не пишутся, кроме raw.

- [ ] Step 1: тест: у каждой команды есть frontmatter `description`; каждое упомянутое имя агента (`techlead-preflight`, `*-collector`, `*-analyst`) существует в `extension/agents/`; упомянутые `.techlead/bin/*.mjs` существуют.
- [ ] Step 2: FAIL. Step 3: четыре команды. Step 4: PASS. Step 5: commit.

### Task 10: Манифест, установка, README

**Files:** Create `extension/gigacode-extension.json`, `extension/qwen-extension.json`, `scripts/install.sh`, `README.md`, `tests/manifest.test.mjs`

```json
{ "name": "ai-techlead", "version": "0.1.0", "agents": "agents", "commands": "commands" }
```
`install.sh [gigacode|qwen]`: выполняет `<cli> extensions install "$(dirname "$0")/../extension"`. Если такой команды у CLI нет — копирует в `~/.<cli>/extensions/ai-techlead`.

README: установка; `/techlead-init`; заполнение `techlead.yaml` и env; `/standup`, `/tests`, `/pr`; что проверить в GigaCode (допущения из спеки).

- [ ] Step 1: тест: два манифеста идентичны; `version` = `runtime/VERSION`; папки `agents` и `commands` существуют.
- [ ] Step 2–4.
- [ ] Step 5: смоук в Qwen Code с изолированным HOME (без касания реального `~/.qwen`): `HOME=$(mktemp -d) qwen extensions install ./extension` → `HOME=… qwen extensions list` показывает `ai-techlead`.
- [ ] Step 6: commit.

## Вне плана (ручная проверка у пользователя)
`/techlead-init` + `/standup` в GigaCode на реальных MCP; сверка 2–3 сигналов с Jira и Bitbucket; проверка preflight без одного MCP.
