# GIGACODE.md — AI-техлид для GigaCode CLI

## Что это

Расширение для GigaCode CLI (совместимо с Qwen Code), которое собирает для техлида картину по команде из Jira, Bitbucket, Jenkins и TestOps и показывает её одной HTML-страницей (`dashboard.html`). Слэш-команды: `/standup`, `/tests`, `/pr`, `/techlead-init`. **Всё только на чтение** внешних систем — никаких записей в Jira/Bitbucket/Jenkins/TestOps.

Проект — не приложение в обычном смысле: основная «логика» живёт в промптах субагентов и команд (Markdown-файлы), а код без LLM вынесен в `extension/runtime/bin/` (Node.js 18+, ESM).

## Структура

```
extension/
  gigacode-extension.json   # манифест (имя ai-techlead, версия 0.2.0, указывает agents/ и commands/)
  qwen-extension.json       # тот же манифест для Qwen Code
  agents/                   # 7 субагентов (Markdown с frontmatter name/description)
    techlead-preflight.md   #   проверка MCP/env перед сбором, подсказки из Confluence
    jira-collector.md       #   коллекторы — по одному источнику, пишут reports/raw/<дата>/
    bitbucket-collector.md
    jenkins-collector.md
    testops-collector.md
    techlead-analyst.md     #   анализ raw -> reports/<дата>.json
    tests-analyst.md        #   анализ тестов -> reports/tests-<дата>.json
  commands/                 # оркестраторы слэш-команд: standup.md, tests.md, pr.md, techlead-init.md
  runtime/                  # код без LLM; /techlead-init копирует его в .techlead/ папки команды
    bin/publish.mjs         #   сводит отчёты в reports/latest.js для дашборда (exit 0/1/2)
    bin/secret-scan.mjs     #   скан файлов перед коммитом (exit 0 — чисто, 1 — находки, 2 — ошибка)
    bin/validate.mjs        #   валидация JSON по схемам
    bin/workdays.mjs        #   рабочие дни с учётом праздников из techlead.yaml
    bin/lib/schema.mjs
    schemas/                # raw.schema.json, report.schema.json, tests-report.schema.json
    templates/              # techlead.yaml, settings.json, env.example, gitignore
    dashboard.html          # страница читает reports/latest.js
    VERSION                 # сверяется /techlead-init'ом с версией в .techlead/
prototype/                  # прототип дашборда и примеры отчётов
scripts/install.sh          # установка расширения (gigacode | qwen)
tests/*.test.mjs            # node:test
docs/superpowers/specs/     # дизайн-документ 2026-10-20-ai-techlead-design.md
```

Поток `/standup`: preflight → коллекторы **параллельно** в `reports/raw/<дата>/` → аналитик → `reports/<дата>.json` → `publish.mjs` → открытие `dashboard.html` → итог в 3 строки → secret-scan → коммит снимка (только после явного «да»).

## Команды

```bash
npm test                       # node --test tests/*.test.mjs
scripts/install.sh gigacode    # установка расширения в ~/.gigacode/extensions/ai-techlead
scripts/install.sh qwen        # то же для Qwen Code
```

- Тест страницы `tests/dashboard.test.mjs` требует установленный Chrome.
- Отдельный файл тестов: `node --test tests/publish.test.mjs`.
- Собирать нечего; зависимости нет (package.json без dependencies).

## Конвенции разработки

### Промпты как первичный код
- Агенты и команды — Markdown-файлы с YAML-frontmatter (`name`, `description`). Имя файла = значение `name`.
- Оркестраторы (`commands/`) вызывают субагентов, субагенты **не вызывают субагентов**.
- Коллекторы обязаны валидировать вывод по `schemas/raw.schema.json` и явно упоминать «только чтение» — тесты это проверяют (`tests/agents.test.mjs`, `tests/commands.test.mjs`).
- Любой путь `.techlead/bin/*.mjs`, упомянутый в промпте агента, должен существовать в `extension/runtime/bin/` — есть тест.
- Ответы субагентов структурированы и коротки (например, preflight возвращает ровно один ```json-блок + ≤3 строки человеку); оркестратор не пересказывает полный JSON.

### Контракты данных
- Данные между шагами ходят через файлы (`reports/raw/`, `reports/*.json`), а не через контекст диалога.
- Схемы JSON — источник правды: сначала меняй схему, потом промпт и скрипты.
- `reports/raw/` и `reports/latest.js` не коммитятся; остальное в `reports/` — коммитится снимками.

### Безопасность (жёсткие правила)
- Только чтение внешних систем; любые запись/коммит/перезапись — только после явного «да» пользователя.
- Токены — только в переменных окружения (`${JIRA_TOKEN}` и т. п. в шаблонах). Никогда не печатать значения, не читать `.env` и `settings.json` целиком; preflight проверяет серверы пробными вызовами, а имена ключей печатает отдельной node-однострочником.
- Перед коммитом отчётов — обязательный `node .techlead/bin/secret-scan.mjs <файлы>`; при находках коммит не предлагается.
- Коммитить точечным списком файлов (`git add <файлы>`), не `git add .`.

### Стиль
- Язык всех текстов (README, промпты, комментарии, сообщения тестов) — русский.
- Скрипты — ESM (`.mjs`), Node 18+ без внешних зависимостей.
- Изменения синхронны по всем артефактам: схема → промпт → скрипт → тест → `VERSION` (для изменения поведения рантайма поднимай версию).

## Тестирование

Тесты валидируют согласованность между слоями: существование агентов и их frontmatter, упоминаемые скрипты и схемы, шаблоны (`templates.test.mjs`), манифест (`manifest.test.mjs`), работу `bin/`-скриптов (`publish`, `secret-scan`, `workdays`), валидацию данных по схемам (`schema.test.mjs`) и дашборд (`dashboard.test.mjs`, нужен Chrome). При добавлении нового промпта/скрипта/схемы — обнови или добавь соответствующий тест; `npm test` должен проходить полностью.
