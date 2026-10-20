# Спецификация: AI-техлид для GigaCode CLI (субагенты) — дизайн

## Context
Техлиду/PO нужен агент, который контролирует команду: запущен ли спринт, есть ли задачи у
каждого, PR без движения >1 дня, Релиз 2.0 / баги / УКЗ / МПР, автотесты (Jenkins, TestOps),
покрытие — и выдаёт **одну локальную HTML-страницу для стендапа** с сигналами и
рекомендациями; автотестерам — быстрый разбор падений. Сервера нет: запускает техлид/PO у
себя в **GigaCode CLI** (по устройству как Gemini/Qwen CLI) из рабочей папки команды, где
лежат конфиг и подключённые MCP (Atlassian, Bitbucket, Jenkins, TestOps). Если MCP не
подключён — агент ищет инструкцию по подключению в Confluence.

Согласовано в брейншторме: упаковка — **субагенты + субагенты-сборщики**, оркестратор —
команда `/standup` (субагенты не вызывают субагентов); подход «шаблон + JSON-снимки»; только
чтение внешних систем. Проект `/Users/alex/work/ai-techlead` пуст — это исходники пакета.

## Шаги после одобрения
1. `git init` в `/Users/alex/work/ai-techlead`, сохранить дизайн в
   `docs/superpowers/specs/2026-10-20-ai-techlead-design.md`, коммит; пользователь ревьюит.
2. `superpowers:writing-plans` → план реализации → выбор способа исполнения.

## ⚠ Допущения о GigaCode (сверить при установке)
Каталоги `~/.gigacode/agents/*.md` (frontmatter `name`, `description`, `tools`),
`~/.gigacode/commands/*.toml` (`description`, `prompt`, `{{args}}`, `@{file}`, `!{cmd}`),
проектный `.gigacode/settings.json` с `mcpServers`; субагент не может вызвать субагента;
субагентам доступны MCP-инструменты сессии. Всё GigaCode-специфичное изолировано в
`install/` и frontmatter — промпты переносимы (отладка возможна в Claude Code).

## Структура
```
ИСХОДНИКИ ПАКЕТА (этот репо)            → УСТАНОВКА в ~/.gigacode/
agents/
  techlead-preflight.md                  проверка папки, конфига, MCP; инструкции из Confluence
  jira-collector.md                      спринт, люди, Релиз 2.0, баги, УКЗ/МПР → raw/jira.json
  bitbucket-collector.md                 PR по репо из конфига → raw/bitbucket.json
  jenkins-collector.md                   прогоны, падения, логи, история → raw/jenkins.json
  testops-collector.md                   лончи, история, покрытие → raw/testops.json
  techlead-analyst.md                    raw + прошлый снимок → итоговый отчёт по схеме
commands/
  standup.toml                           полный цикл
  tests.toml                             /tests [джоба]: preflight(jenkins,testops) → 2 сборщика → разбор в чат
  pr.toml                                /pr: preflight(bitbucket) → сборщик → зависшие PR в чат
  techlead-init.toml                     создать techlead.yaml, .gigacode/settings.json, dashboard.html в папке
ai-techlead/
  dashboard.html                         шаблон (vanilla JS, без сети, читает reports/latest.js)
  report.schema.json, raw.schema.json    контракты
  templates/techlead.yaml, settings.json
  fixtures/example-report.json           для проверки шаблона
install/install.sh                       копирует agents/, commands/, ai-techlead/ в ~/.gigacode/
docs/superpowers/specs/…

РАБОЧАЯ ПАПКА КОМАНДЫ (cwd запуска)
techlead.yaml
.gigacode/settings.json                  mcpServers
dashboard.html
reports/raw/YYYY-MM-DD/*.json, reports/YYYY-MM-DD.json, reports/latest.js
```

## techlead.yaml
```yaml
team:
  name: <команда>
  members:
    - { name: <Имя Фамилия>, role: dev, jira: <login>, bitbucket: <login> }  # dev|qa|aqa|analyst
jira:   { project: <KEY>, board_id: <ID>, release: "Релиз 2.0", issue_types: [Bug, Story, Task, УКЗ, МПР] }
bitbucket:
  repositories: [ { project: <PROJ>, repo: <slug> } ]
jenkins: { jobs: [<folder/job>], smoke_jobs: [<folder/smoke>] }
testops: { projects: [ { id: <id>, name: <name> } ], coverage_target: 80 }
thresholds: { pr_stale_days: 1, pr_critical_days: 2, task_stale_days: 2, max_wip_per_person: 2, flaky_history_runs: 10 }
mcp:
  required:
    atlassian: { probe: "jira: текущий пользователь" }
    bitbucket: { probe: "список PR первого репо" }
    jenkins:   { probe: "статус первой джобы" }
    testops:   { probe: "первый проект" }
  setup_docs:
    confluence_space: <SPACE>
    search: "подключение MCP {name}"
    pages: { }                    # опционально: name → pageId
    fallback_url: <ссылка>
```

## Поток /standup (оркестратор = команда)
1. **techlead-preflight** → вердикт `{ok_sources, missing:[{name, reason, setup_steps, settings_snippet, doc_url}]}`.
   - Нет `techlead.yaml` в cwd → стоп, предложить `/techlead-init`.
   - Невалидный конфиг → стоп со списком полей.
   - По каждому MCP: есть ли в `.gigacode/settings.json` + ответ на `probe` → `ok | не настроен | не отвечает (auth/timeout)`.
   - Не подключён, Atlassian ok → Confluence: `setup_docs.pages[name]`, иначе поиск `search` в
     `confluence_space` → шаги + фрагмент `settings.json` + ссылка. В settings.json не пишет без «да».
   - Atlassian не подключён → `fallback_url` + шаблон блока atlassian из пакета → стоп.
   - Без Bitbucket/Jenkins/TestOps → спросить «продолжить без них?»; да → источник помечается
     недоступным со ссылкой на инструкцию.
2. **Сборщики параллельно** (только ok-источники). Каждый: только свой MCP + запись в
   `reports/raw/<дата>/<source>.json` по `raw.schema.json`; возвращает оркестратору 3–5 строк, не дамп.
   Ошибка → `{"error": …}` в raw-файле.
3. **techlead-analyst**: читает config, raw, предыдущий `reports/*.json` → дельты, сигналы,
   анализ падений, рекомендации → `reports/<дата>.json` по `report.schema.json`.
4. Оркестратор: `reports/latest.js` (`window.REPORT = …;`), открыть `dashboard.html`, 3 строки
   в чат (статус, главный риск, первое действие).

## Контракт отчёта (report.schema.json)
```jsonc
{
  "meta":    { "generated_at","generated_by","sources":{"jira":"ok","jenkins":"unavailable","…":"…"},"setup_hints":[{name,doc_url}] },
  "status":  { "level":"red|yellow|green","summary" },
  "sprint":  { "name","state","start","end","day","days_total","done_pct","sp_done","sp_total","scope_added":[],"risk" },
  "people":  [ { "name","role","in_progress":[{key,title,status,days_no_move,url}],"prs":[],"blockers":[],"flags":[] } ],
  "signals": [ { "level","category":"sprint|people|pr|release|tests|coverage","text","owner","age_days","url" } ],
  "prs":     [ { "repo","id","title","author","reviewers","age_days","idle_days","last_activity","build","jira_key","url" } ],
  "release": { "name","done","in_progress","todo","blockers":[],"bugs":{"critical","new_24h","unassigned"},"ukz_mpr":[] },
  "tests":   { "jobs":[{name,status,passed,failed,skipped,url,source}],
               "failures":[{test,job,first_failed,is_new,flaky_rate,category,cause,jira_bug,suggested_bug,url}] },
  "coverage":{ "projects":[{name,pct,target,delta_prev_sprint}],"release_features_without_tests":[] },
  "recommendations":[ { "who","what","when","why" } ]
}
```

## Страница
Статус-строка (🟢/🟡/🔴, спринт, день X/Y, %, риск, источники) → «Требует внимания» →
«Кто чем занят» (Сотрудник | В работе | Движение | PR | Проблема) → PR | Релиз 2.0 →
Автотесты + покрытие → Рекомендации. Клик — детали (стектрейс/причина, история PR); фильтр по
сотруднику; вкладка «Тесты»; плашка недоступного источника со ссылкой на инструкцию; пустые
состояния.

## Сигналы (пороги из thresholds, рабочие дни)
- 🔴 нет активного спринта; блокер Релиза 2.0; красный smoke; сотрудник без задач; PR без
  движения > `pr_critical_days`.
- 🟡 PR без движения > `pr_stale_days`; задача без движения > `task_stale_days`; WIP >
  `max_wip_per_person`; новый flaky; покрытие ниже цели или упало; задача без PR / PR без
  Jira-ключа; риск не закрыть спринт; человек в PR/задачах не из конфига.

## Промпты субагентов (ядро содержания)
**Общее для всех:** только чтение; без выдумывания данных; ссылки на всё; по-русски, кратко;
писать только в `reports/`.

**techlead-preflight** — tools: чтение файлов, Atlassian MCP (Confluence-поиск), пробные
вызовы всех MCP. Выход — вердикт (см. поток, шаг 1).

**jira-collector** — tools: Atlassian MCP. Активный спринт доски (даты, SP, добавленное после
старта); по каждому члену команды — задачи в работе, дни без смены статуса (changelog),
блокеры; задачи без исполнителя/оценки; fixVersion «Релиз 2.0» — прогресс, блокеры; баги
(критичные, за 24 ч, без исполнителя, просроченные); УКЗ/МПР — статусы, сроки.

**bitbucket-collector** — tools: Bitbucket MCP. Только `bitbucket.repositories`. Открытые PR:
автор, ревьюеры, created, последняя активность (коммит/коммент/апрув), статус сборки,
конфликты, запрошенные изменения, Jira-ключ из ветки/названия.

**jenkins-collector** — tools: Jenkins MCP. Для `jobs` + `smoke_jobs`: последний билд, счётчики,
упавшие тесты со стектрейсом (обрезать до сути), история последних `flaky_history_runs` по каждому
упавшему тесту, первый билд падения.

**testops-collector** — tools: TestOps MCP. Последние лончи, результаты, история тест-кейсов,
% покрытия/автоматизации по проектам, кейсы/фичи Релиза 2.0 без автотестов.

**techlead-analyst** — tools: чтение/запись файлов. Роль техлида: не пересказ, а выводы.
Сопоставление людей по логинам, PR↔задача, падение Jenkins↔лонч TestOps↔баг Jira; дельты с
прошлым снимком; сигналы; классификация падений `баг продукта | ошибка теста | окружение |
данные | flaky` + причина 1–2 предложения + черновик бага, если его нет; паттерны (узкие места
ревью/QA, нестабильное окружение, повторяющиеся падения, перегрузка/недогрузка, риски релиза);
3–5 рекомендаций «кто → что → когда → почему». Мало данных — так и сказать.

## Проверка
- `dashboard.html` на `fixtures/example-report.json`: все блоки, пустые состояния, плашка источника.
- Отчёт и raw валидны по схемам.
- Preflight: (а) нет `techlead.yaml`; (б) убран bitbucket из settings → находит инструкцию в
  Confluence; (в) нет atlassian → fallback и стоп.
- Смоук в GigaCode: `/standup` на реальных MCP, ручная сверка 2–3 сигналов с Jira/Bitbucket.

## Вне скоупа
Автоисправление тестов через PR (следующий этап), уведомления, сервер/cron, автозапись в
settings.json без подтверждения.
