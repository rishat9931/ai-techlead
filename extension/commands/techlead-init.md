---
description: Подготовить рабочую папку команды для AI-техлида — runtime .techlead/, techlead.yaml, settings.json, .gitignore, .env.example, dashboard.html
---
Ты настраиваешь текущую папку (cwd) как рабочую папку AI-техлида. Действуешь shell-командами (run_shell_command)
по шагам ниже, по порядку. Существующие файлы **не перезаписываешь** без явного «да»; создаёшь только недостающее.

Дополнительные пожелания пользователя (могут быть пустыми): {{args}}

## Шаги

1. **Папка расширения** `<ext>` — первая существующая из:
   1) `$TECHLEAD_EXTENSION_DIR` (если переменная задана);
   2) `~/.gigacode/extensions/ai-techlead`;
   3) `~/.qwen/extensions/ai-techlead`.
   Проверка: `test -d "<путь>/runtime"`. Ни одной нет → сообщи, что расширение не установлено
   (подсказка: задать `TECHLEAD_EXTENSION_DIR` или переустановить расширение), и закончи.

2. **Runtime → `.techlead/`.**
   - `.techlead/` нет → `mkdir -p .techlead && cp -R "<ext>/runtime/." .techlead/`.
   - Есть `.techlead/VERSION` → сравни с `<ext>/runtime/VERSION`. Совпадают — «runtime актуален», пропусти.
     Различаются (или `VERSION` нет) → покажи обе версии и спроси «Обновить .techlead/?»; только после «да»
     скопируй заново (`cp -R "<ext>/runtime/." .techlead/`). `.techlead/` содержит только код расширения —
     данные команды там не хранятся.

3. **Файлы команды** — для каждого: есть → «уже есть, пропущен»; нет → создать.
   - `techlead.yaml` ← `cp .techlead/templates/techlead.yaml techlead.yaml`.
   - `.gigacode/settings.json` ← `mkdir -p .gigacode && cp .techlead/templates/settings.json .gigacode/settings.json`.
     Если ты запущен в Qwen Code, а не в GigaCode, — тот же шаг с `.qwen/settings.json` (`mkdir -p .qwen`); не уверен,
     в каком CLI работаешь, — спроси. Ниже `.gigacode/` читай как выбранный каталог.
     Если файл уже есть — **не читай его целиком** (там могут быть токены). Выведи только имена серверов:
     `node -e "try{const j=JSON.parse(require('fs').readFileSync('.gigacode/settings.json','utf8'));console.log(Object.keys(j.mcpServers||{}).join(' '))}catch(e){console.log('unreadable')}" 2>/dev/null`.
     Сравни с ключами `mcpServers` шаблона (`atlassian`, `bitbucket`, `jenkins`, `testops`). Каких-то нет —
     предложи дописать **только недостающие** блоки из шаблона (в них только ссылки `${VAR}`), покажи их и
     выполни слияние node-скриптом, не трогающим существующие ключи, **только после «да»**.
   - `.gitignore` ← дописать недостающие строки из `.techlead/templates/gitignore` (`reports/raw/`,
     `reports/latest.js`, `.env`): сначала добей перевод строки в конце файла —
     `[ -s .gitignore ] && [ "$(tail -c1 .gitignore)" != "" ] && echo >> .gitignore`, затем для каждой строки
     `grep -qxF '<строка>' .gitignore 2>/dev/null || echo '<строка>' >> .gitignore`
     (файла нет — создаётся). Существующие строки не трогай.
   - `.env.example` ← `cp .techlead/templates/env.example .env.example`.
   - `dashboard.html` ← `cp .techlead/dashboard.html dashboard.html` (страница грузит `reports/latest.js`).
     Если `dashboard.html` есть и отличается от `.techlead/dashboard.html` (после обновления runtime) — спроси
     «Обновить dashboard.html?» и копируй только после «да».
   - `reports/` ← `mkdir -p reports`.

4. **Отчёт** — список: создано / пропущено (уже было) / обновлено.

5. **Что заполнить дальше** — чек-лист:
   - [ ] `techlead.yaml`: заменить все плейсхолдеры `<…>` (найти: `grep -n '<' techlead.yaml`) — команда, участники
     с логинами Jira/Bitbucket, проект и доска Jira, репозитории, джобы Jenkins ↔ проекты TestOps,
     `mcp.setup_docs` (пространство Confluence, `fallback_url`); праздники — `calendar.holidays`.
   - [ ] Переменные окружения `JIRA_TOKEN`, `BITBUCKET_TOKEN`, `JENKINS_TOKEN`, `TESTOPS_TOKEN` — в `~/.zshrc`
     (`export NAME=…`) или в `.env` по образцу `.env.example` (`.env` в `.gitignore`). Значения в чат не вставлять.
   - [ ] `.gigacode/settings.json`: команды запуска MCP-серверов (`command`, `args`) — со страниц Confluence
     «подключение MCP …»; в `env` оставить только ссылки `${VAR}`.
   - [ ] Перезапустить CLI, чтобы подхватились MCP-серверы и переменные.
   - [ ] Закоммитить `techlead.yaml`, `.gigacode/settings.json`, `.gitignore`, `.env.example`, `dashboard.html`
     (не `.env`).
   - [ ] Запустить `/standup`.

## Запрещено
- Перезаписывать существующие файлы (`techlead.yaml`, `.gigacode/settings.json`, `dashboard.html`, `.techlead/`)
  без явного «да»; удалять файлы.
- Читать или печатать `.env` и содержимое `settings.json` (только имена серверов), печатать значения токенов.
- Записывать токены в какие-либо файлы — только ссылки `${VAR}`.
- Обращаться к внешним системам и писать в них.
- Выполнять `git commit` / `git push` без явного «да».
