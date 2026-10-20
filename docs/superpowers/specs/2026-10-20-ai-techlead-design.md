# Спецификация: AI-техлид для GigaCode CLI (субагенты) — дизайн

Ревизия 2 (после грилинга 2026-10-20).

## Context
Техлиду/PO нужен агент, который контролирует команду: запущен ли спринт, у всех ли есть
работа, PR без движения >1 дня, гигиена релизных тикетов Release 2.0, автотесты и покрытие —
и выдаёт **одну локальную HTML-страницу для стендапа** с сигналами и рекомендациями;
автотестерам — быстрый разбор падений. Сервера нет: запускает техлид/PO у себя в
**GigaCode CLI** (устроен как Qwen Code) из рабочей папки команды, где лежат конфиг и
подключённые MCP (Atlassian, Bitbucket, Jenkins, TestOps). Если MCP не подключён — агент
ищет инструкцию по подключению в Confluence.

## Ключевые решения
| # | Решение |
|---|---------|
| 1 | Упаковка — субагенты (как в Qwen Code: `~/.gigacode/agents/*.md`), оркестратор — команда `/standup`; субагент не вызывает субагентов |
| 2 | «Занят» = есть задача в `jira.statuses.active`, где он исполнитель, **или** открытый PR, где он автор/ревьюер |
| 3 | «Движение» PR = только действия людей (коммит автора, коммент, апрув, needs work); боты из `bitbucket.bots` и CI игнорируются; сигнал указывает **чей ход** (ревьюеры / автор) |
| 4 | Выходные агент определяет сам; праздники и отсутствия ведёт тимлид в `techlead.yaml`; при отклонении без объяснения агент **спрашивает** «нет ли отпуска/праздника?» и после «да» дописывает в конфиг |
| 5 | Рабочая папка — git-репо команды в Bitbucket: `pull` перед запуском, после — предложить `commit`+`push` (с подтверждением); один снимок в день (перезапись); `raw/`, `latest.js`, `.env` — в `.gitignore` |
| 6 | `/standup` не анализирует причины падений — только счётчики, список, «новое»/flaky; анализ — в `/tests` |
| 7 | `/tests` кластеризует падения по сигнатуре, пишет `reports/tests-YYYY-MM-DD.json` (коммитится); вкладка «Тесты» его показывает; `/standup` подтягивает краткую причину, если сегодняшний разбор есть |
| 8 | Release 2.0 — **тип задачи** Jira (тикет на вывод в пром). Контроль — гигиена: тикеты заведены, ведутся (статус двигается, дата не просрочена при открытом тикете), есть связи с задачами/сторями; ближайшие и прошедшие релизы |
| 9 | Задача в `jira.statuses.ready_for_release` без связи с Release 2.0 — 🟡 (кроме `release.exclude_types`) |
| 10 | УКЗ/МПР — обычные задачи (загрузка людей, «без движения»), без отдельного блока |
| 11 | Тесты: **TestOps** — результаты, история, flaky, стектрейсы, покрытие; **Jenkins** — состояние джоб (упала до тестов, зависла, давно не запускалась) и консольный лог для `/tests`; маппинг джоба ↔ проект TestOps в конфиге |
| 12 | Покрытие = доля автоматизированных кейсов от всех активных по проекту TestOps, цель `coverage_target`, динамика по снимкам |
| 13 | Только чтение внешних систем. У каждого сигнала — «скопировать напоминание» (готовый текст: кому, что, ссылка) |
| 14 | Токены — в переменных окружения (`~/.zshrc` или `.env` в `.gitignore`); `settings.json` коммитится только со ссылками `$VAR`; preflight проверяет переменные и сканирует коммитимые файлы на секреты перед commit |

## ⚠ Допущения о GigaCode (сверить при установке)
`~/.gigacode/agents/*.md` (frontmatter `name`, `description`, `tools`),
`~/.gigacode/commands/*.toml` (`description`, `prompt`, `{{args}}`, `@{file}`, `!{cmd}`),
проектный `.gigacode/settings.json` с `mcpServers` и подстановкой `$VAR`/`${VAR}`; субагенты
видят MCP сессии. GigaCode-специфика изолирована во frontmatter, `.toml` и `install/`.

## Структура
```
ИСХОДНИКИ ПАКЕТА (этот репо)            → УСТАНОВКА в ~/.gigacode/
agents/
  techlead-preflight.md                  папка, конфиг, env, MCP; инструкции из Confluence
  jira-collector.md                      спринт, люди, Release 2.0, ready-без-релиза → raw/jira.json
  bitbucket-collector.md                 PR по репо из конфига → raw/bitbucket.json
  jenkins-collector.md                   состояние джоб → raw/jenkins.json
  testops-collector.md                   лончи, падения, flaky, покрытие → raw/testops.json
  techlead-analyst.md                    raw + прошлый снимок → отчёт
  tests-analyst.md                       падения → кластеры, причины, черновики багов
commands/
  standup.toml                           полный цикл
  tests.toml                             /tests [джоба]
  pr.toml                                /pr — зависшие PR в чат
  techlead-init.toml                     создать techlead.yaml, settings.json, .gitignore, .env.example, dashboard.html
ai-techlead/
  dashboard.html                         шаблон (vanilla JS, без сети)
  report.schema.json, tests-report.schema.json, raw.schema.json
  templates/techlead.yaml, settings.json, gitignore, env.example
  fixtures/example-report.json, example-tests-report.json
install/install.sh
docs/superpowers/specs/…

РАБОЧАЯ ПАПКА КОМАНДЫ = git-репо в Bitbucket
techlead.yaml
.gigacode/settings.json                  mcpServers, токены через $VAR
.env (в .gitignore), .env.example
dashboard.html
reports/YYYY-MM-DD.json, reports/tests-YYYY-MM-DD.json      ← в git
reports/raw/…, reports/latest.js                            ← .gitignore
```

## techlead.yaml
```yaml
team:
  name: <команда>
  members:
    - name: <Имя Фамилия>
      role: dev                       # dev|qa|aqa|analyst
      jira: <login>
      bitbucket: <login>
      absent: [ { from: 2026-11-02, to: 2026-11-13, reason: отпуск } ]
calendar:
  holidays: [2026-11-04, 2026-12-31]  # заполняет тимлид
jira:
  project: <KEY>
  board_id: <ID>
  statuses:
    active: [В работе, Ревью, Тестирование]
    blocked: [Заблокировано]
    ready_for_release: [Готово к выводу]
    done: [Готово, Закрыто]
release:
  issue_type: "Release 2.0"
  ahead_days: 14
  back_days: 30
  exclude_types: [Аналитика, Техдолг]
bitbucket:
  repositories: [ { project: <PROJ>, repo: <slug> } ]
  bots: [jenkins, sonar]
jenkins:
  jobs: [ { name: <folder/job>, testops_project: <id>, smoke: false } ]
  max_idle_days: 2                    # джоба давно не запускалась
testops:
  projects: [ { id: <id>, name: <name> } ]
  coverage_target: 80
tests:
  top_clusters: 10
  mass_failure_pct: 30                # >X% упало → гипотеза «окружение»
thresholds:
  pr_stale_days: 1
  pr_critical_days: 2
  task_stale_days: 2
  max_wip_per_person: 2
  flaky_history_runs: 10
mcp:
  required:
    atlassian: { env: [JIRA_TOKEN],      probe: "jira: текущий пользователь" }
    bitbucket: { env: [BITBUCKET_TOKEN], probe: "список PR первого репо" }
    jenkins:   { env: [JENKINS_TOKEN],   probe: "статус первой джобы" }
    testops:   { env: [TESTOPS_TOKEN],   probe: "первый проект" }
  setup_docs:
    confluence_space: <SPACE>
    search: "подключение MCP {name}"
    pages: { }
    fallback_url: <ссылка>
```

## Поток /standup
0. `git pull` (ошибка/конфликт → предупредить, продолжить локально).
1. **techlead-preflight** → `{ok_sources, missing:[{name, reason, setup_steps, settings_snippet, doc_url}]}`:
   - нет `techlead.yaml` → стоп, предложить `/techlead-init`; невалидный → стоп со списком полей;
   - по каждому MCP: env-переменные заданы? сервер в settings.json? `probe` отвечает? →
     `ok | нет переменной | не настроен | не отвечает (auth/timeout)`;
   - не подключён и Atlassian ok → Confluence (`pages[name]`, иначе поиск) → шаги, фрагмент
     settings.json, ссылка; без «да» ничего не пишет;
   - нет Atlassian → `fallback_url` + шаблон блока → стоп;
   - нет Bitbucket/Jenkins/TestOps → «продолжить без них?»; да → источник `unavailable` + ссылка.
2. **Сборщики параллельно** (ok-источники): свой MCP + запись `reports/raw/<дата>/<source>.json`;
   оркестратору 3–5 строк. Ошибка → `{"error": …}`.
3. **techlead-analyst** → `reports/<дата>.json`; подтягивает `reports/tests-<дата>.json`, если есть.
4. **Вопросы по отклонениям**: для сигналов «нет задач» / «без движения» по людям без
   `absent` — один пакетный вопрос «у кого отпуск/больничный, был ли праздник?»; ответы →
   (после «да») в `techlead.yaml`, сигналы пересчитываются (человек → серый «отсутствует до …»,
   его PR/задачи → «нужен заменяющий»).
5. `reports/latest.js`, открыть `dashboard.html`, 3 строки в чат.
6. Сканирование коммитимых файлов на токены → предложить `commit` + `push`.

## Поток /tests [джоба]
preflight (testops, jenkins) → testops-collector + jenkins-collector (с консольными логами
упавших/сломанных джоб) → **tests-analyst**: кластеры по сигнатуре (тип исключения,
нормализованное сообщение, верхний фрейм); упало >`mass_failure_pct`% → гипотеза
«окружение»; разбор top-`top_clusters` кластеров по представителю: категория
`баг продукта | ошибка теста | окружение | данные | flaky`, причина 1–2 предложения, есть ли
баг в Jira, черновик бага → `reports/tests-<дата>.json` → краткий итог в чат → предложить commit.

## Контракт отчёта (report.schema.json)
```jsonc
{
  "meta":    { "generated_at","generated_by","sources":{"jira":"ok","jenkins":"unavailable"},"setup_hints":[{name,doc_url}],"tests_report":"tests-2026-10-20.json|null" },
  "status":  { "level":"red|yellow|green","summary" },
  "sprint":  { "name","state","start","end","day","days_total","done_pct","sp_done","sp_total","scope_added":[],"risk" },
  "people":  [ { "name","role","absent":{to,reason}|null,"active":[{key,title,status,days_no_move,url}],"prs":[],"blockers":[],"flags":[] } ],
  "signals": [ { "id","level","category":"sprint|people|pr|release|tests|coverage","text","owner","age_days","url","reminder" } ],
  "prs":     [ { "repo","id","title","author","reviewers","age_days","idle_days","whose_turn":"reviewers|author","last_human_activity","build","jira_key","url" } ],
  "releases":{ "upcoming":[{key,title,planned_date,status,days_no_move,linked:[key],issues:[]}],
               "past":[{key,title,planned_date,closed_date,status,linked:[key],issues:[]}],
               "ready_without_release":[{key,title,assignee,url}] },
  "tests":   { "jobs":[{name,state:"ok|failed_before_tests|hung|idle",last_run,url}],
               "launches":[{project,name,passed,failed,broken,skipped,url}],
               "failures":[{test,project,is_new,flaky_rate,short_cause|null,url}] },
  "coverage":{ "projects":[{name,automated,total,pct,target,delta_prev}] },
  "recommendations":[ { "who","what","when","why" } ]
}
```
`tests-report.schema.json`: `{meta, clusters:[{signature,category,cause,tests:[{name,url}],count,jira_bug|null,suggested_bug:{title,description}|null,jenkins_log_excerpt}]}`.

## Страница
Статус-строка (🟢/🟡/🔴, спринт, день X/Y, %, риск, источники) → «Требует внимания» (у каждого
сигнала «скопировать напоминание») → «Кто чем занят» (Сотрудник | В работе | Движение | PR |
Проблема; отсутствующие — серым) → PR (чей ход) | Релизы (ближайшие, прошедшие, готовое без
релиза) → Автотесты (джобы, лончи, падения, покрытие) → Рекомендации. Вкладка «Тесты» —
кластеры из `tests-*.json`. Фильтр по сотруднику; плашка недоступного источника; пустые
состояния.

## Сигналы (рабочие дни = без выходных, `calendar.holidays` и `absent` человека)
- 🔴 нет активного спринта; красный smoke; джоба smoke упала до тестов/зависла; присутствующий
  сотрудник без работы; PR без движения > `pr_critical_days`.
- 🟡 PR без движения > `pr_stale_days`; задача (вкл. УКЗ/МПР) без движения > `task_stale_days`;
  WIP > `max_wip_per_person`; Release 2.0 без связей / без движения / дата прошла, тикет открыт;
  задача в `ready_for_release` без Release 2.0; новый flaky; покрытие ниже цели или упало;
  джоба не запускалась > `max_idle_days`; задача без PR / PR без Jira-ключа; риск не закрыть
  спринт; человек в PR/задачах не из конфига; у отсутствующего есть открытые PR/задачи.

## Промпты субагентов
**Общее:** только чтение внешних систем; без выдумывания; ссылки на всё; по-русски, кратко;
писать только в `reports/` (и в `techlead.yaml` — только по подтверждению, через оркестратора).

- **techlead-preflight** — чтение файлов, env, Atlassian (Confluence-поиск), пробы всех MCP.
- **jira-collector** — активный спринт (даты, SP, scope_added); по людям — задачи в `active`/
  `blocked`, дни без смены статуса (changelog); задачи без исполнителя/оценки; Release 2.0 в
  окнах `ahead_days`/`back_days` — статус, дата, связи, движение; задачи в `ready_for_release`
  без связи с Release 2.0.
- **bitbucket-collector** — открытые PR по репо из конфига; активность без `bots`; чей ход;
  сборка, конфликты, Jira-ключ.
- **jenkins-collector** — по `jenkins.jobs`: последний билд, состояние; в режиме `/tests` —
  консольный лог (обрезанный) для упавших до тестов/зависших.
- **testops-collector** — последние лончи по проектам, упавшие тесты со стектрейсами, история
  `flaky_history_runs`, automated/total.
- **techlead-analyst** — сопоставление людей, PR↔задача; рабочие дни; дельты; сигналы +
  `reminder`; паттерны; 3–5 рекомендаций «кто → что → когда → почему».
- **tests-analyst** — см. поток /tests.

## Проверка
- `dashboard.html` на фикстурах: все блоки, пустые состояния, отсутствующие, плашка источника,
  вкладка «Тесты», копирование напоминания.
- Отчёты и raw валидны по схемам.
- Расчёт рабочих дней: выходные, праздник, отпуск.
- Preflight: нет `techlead.yaml`; нет env-переменной; убран bitbucket → инструкция из
  Confluence; нет atlassian → стоп.
- Скан секретов: токен в коммитимом файле → коммит не предлагается.
- Смоук в GigaCode: `/standup` и `/tests` на реальных MCP, ручная сверка 2–3 сигналов.

## Вне скоупа
Автоисправление тестов через PR; запись в Jira/Bitbucket; уведомления; сервер/cron;
покрытие сторей автотестами; глубокая аналитика релизов (сроки, откаты).
