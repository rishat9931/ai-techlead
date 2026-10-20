# AI-техлид для GigaCode CLI

## Что это

Расширение для GigaCode CLI (совместимо с Qwen Code), которое собирает для техлида картину по команде из Jira, Bitbucket, Jenkins и TestOps и показывает её одной HTML-страницей. Команды: `/standup`, `/tests`, `/pr`. Всё только на чтение.

## Как устроено

- `extension/agents/` — 7 субагентов: коллекторы (jira, bitbucket, jenkins, testops), `techlead-preflight` (проверка MCP и env), `techlead-analyst` и `tests-analyst` (анализ).
- `extension/commands/` — слэш-команды `/standup`, `/tests`, `/pr`, `/techlead-init`.
- `extension/runtime/` — код без LLM: `bin/` (скрипты), `schemas/`, `templates/`, `dashboard.html`, `VERSION`. `/techlead-init` копирует его в `.techlead/` папки команды.

Поток `/standup`:

```
/standup -> preflight (MCP, env) -> коллекторы параллельно (jira | bitbucket | jenkins | testops)
         -> raw-данные в reports/raw/ -> analyst (сигналы, риски) -> reports/latest.js
         -> dashboard.html (страница читает reports/latest.js)
```

## Установка

```bash
scripts/install.sh            # gigacode, если есть в PATH, иначе qwen
scripts/install.sh qwen       # явно выбрать CLI
```

Скрипт вызывает `<cli> extensions install extension/` (копирует в `~/.<cli>/extensions/ai-techlead`); если у CLI нет такой команды, копирует папку сам. Повторный запуск переустанавливает расширение. Root не нужен. Обновление вручную: `<cli> extensions update ai-techlead`.

## Подготовка папки команды

1. Создайте пустую папку команды, перейдите в неё и запустите `gigacode`.
2. Выполните `/techlead-init`: создаются `.techlead/`, `techlead.yaml`, `.gigacode/settings.json`, `.gitignore`, `.env.example`, `dashboard.html`, `reports/`. Существующие файлы не перезаписываются без вашего «да».
3. Заполните `techlead.yaml` (проекты Jira, репозитории Bitbucket, джобы Jenkins, проекты TestOps, пороги).
4. Задайте переменные окружения из `.env.example` в `~/.zshrc` или в `.env` (он в `.gitignore`). Токены хранятся только там.
5. В `.gigacode/settings.json` лежат шаблоны MCP-серверов со ссылками `${VAR}`. Команды запуска MCP возьмите из Confluence и подставьте в `command`/`args`; проверьте `gigacode mcp list`.

## Использование

- `/standup` — полный сбор и анализ, затем страница `dashboard.html`.
- `/tests [джоба]` — состояние автотестов (Jenkins + TestOps), по умолчанию все джобы из `techlead.yaml`.
- `/pr` — открытые pull request: возраст, ревью, зависшие.

Страница показывает сводку, сигналы и риски по людям и задачам, PR, сборки и тесты со ссылками на источники. Отчёты лежат в `reports/` и коммитятся в git (кроме `reports/raw/` и `reports/latest.js`), поэтому можно смотреть динамику.

## Безопасность

- Только чтение: никаких записей в Jira, Bitbucket, Jenkins, TestOps.
- Токены только в env, в yaml, отчётах и git их нет.
- Перед коммитом отчётов выполняется secret-scan.
- Любое действие, выходящее за чтение (запись файлов вне `reports/`, коммит, перезапись), — только после явного согласия.

## Что проверить при первом запуске в GigaCode

Допущения, не проверенные на реальном GigaCode:

- [ ] Пути `~/.gigacode/extensions/`, папки `agents/` и `commands/`, имя манифеста `gigacode-extension.json` (в Qwen Code проверено на `qwen-extension.json`).
- [ ] Субагенты видят MCP-серверы сессии.
- [ ] Имена MCP-инструментов имеют вид `mcp__<server>__<tool>`.
- [ ] Существует `gigacode mcp list`.
- [ ] Субагенты вызываются параллельно (коллекторы в одном сообщении).

## Разработка

```bash
npm test      # node --test tests/*.test.mjs
```

Тест страницы (`tests/dashboard.test.mjs`) требует установленный Chrome. Прототип страницы и примеры отчётов лежат в `prototype/`.
