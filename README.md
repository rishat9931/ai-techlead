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

Расширение ставится один раз на машину. Работает из любой папки, где запущен `gigacode`.

**1. Проверьте окружение**

```bash
gigacode --version   # GigaCode CLI установлен
node --version       # Node 18+ (нужен скриптам расширения)
git --version
```

**2. Получите пакет**

Склонируйте или скопируйте этот репозиторий, например в `~/work/ai-techlead`:

```bash
git clone <url репозитория> ~/work/ai-techlead
```

**3. Установите расширение в GigaCode**

```bash
cd ~/work/ai-techlead
scripts/install.sh gigacode
```

Скрипт вызывает `gigacode extensions install ./extension`. Если у CLI нет такой команды, он сам копирует папку `extension/` в `~/.gigacode/extensions/ai-techlead`. Root не нужен.

То же самое вручную: `gigacode extensions install ~/work/ai-techlead/extension`.

Для Qwen Code: `scripts/install.sh qwen`. Без аргумента скрипт выбирает `gigacode`, если тот есть в PATH, иначе `qwen`.

**4. Проверьте, что GigaCode видит расширение**

```bash
gigacode extensions list    # в списке есть ai-techlead
```

Запустите `gigacode` и проверьте:

- `/help` — есть команды `/standup`, `/tests`, `/pr`, `/techlead-init`;
- `/agents manage` — есть 7 агентов: `techlead-preflight`, `jira-collector`, `bitbucket-collector`, `jenkins-collector`, `testops-collector`, `techlead-analyst`, `tests-analyst`.

**Обновление.** После `git pull` в `~/work/ai-techlead` снова выполните `scripts/install.sh gigacode`: он переустановит расширение. Затем в папке каждой команды выполните `/techlead-init`. Он сравнит версию `.techlead/` и предложит обновить её.

### Если команды или агенты не появились

1. Проверьте, что есть папка `~/.gigacode/extensions/ai-techlead/` и в ней лежит `gigacode-extension.json`. Возможно, ваша версия GigaCode ждёт другое имя манифеста (см. «Что проверить при первом запуске»).
2. Обходной путь без механизма расширений — положить агентов и команды в пользовательские папки GigaCode:

   ```bash
   mkdir -p ~/.gigacode/agents ~/.gigacode/commands
   cp ~/work/ai-techlead/extension/agents/*.md   ~/.gigacode/agents/
   cp ~/work/ai-techlead/extension/commands/*.md ~/.gigacode/commands/
   echo 'export TECHLEAD_EXTENSION_DIR="$HOME/work/ai-techlead/extension"' >> ~/.zshrc
   source ~/.zshrc
   ```

   `TECHLEAD_EXTENSION_DIR` нужен, чтобы `/techlead-init` нашёл скрипты и шаблоны.

## Подготовка папки команды

Делается один раз на команду. Папка команды — отдельный git-репозиторий (лучше в Bitbucket), чтобы техлид и PO видели общую историю снимков.

1. Создайте папку или склонируйте репозиторий команды, перейдите в неё и запустите `gigacode`:

   ```bash
   mkdir ~/work/team-payments && cd ~/work/team-payments && git init
   gigacode
   ```

2. Выполните `/techlead-init`. Создаются `.techlead/`, `techlead.yaml`, `.gigacode/settings.json`, `.gitignore`, `.env.example`, `dashboard.html`, `reports/`. Существующие файлы без вашего «да» не перезаписываются.
3. Заполните в `techlead.yaml` все `<...>`: состав команды с логинами Jira и Bitbucket, проект и доску Jira, репозитории Bitbucket, джобы Jenkins, проекты TestOps, пространство Confluence с инструкциями по MCP (`mcp.setup_docs`). Праздники и отпуска ведёт тимлид там же.
4. Подключите MCP-серверы. В `.gigacode/settings.json` лежат шаблоны серверов `atlassian`, `bitbucket`, `jenkins`, `testops`. Команды их запуска возьмите из Confluence и подставьте в `command`/`args`. Токены в этот файл не пишите: там стоят ссылки `${JIRA_TOKEN}` и т. п.
5. Задайте токены в `~/.zshrc` или в `.env` (он в `.gitignore`):

   ```bash
   export JIRA_TOKEN=...
   export BITBUCKET_TOKEN=...
   export JENKINS_TOKEN=...
   export TESTOPS_TOKEN=...
   ```

6. Перезапустите `gigacode` в папке команды и выполните `/standup`. Сначала агент проверит подключения. Если какой-то MCP не подключён, он найдёт инструкцию в Confluence (пространство из `mcp.setup_docs`) и покажет шаги.

Совет: заведите в Confluence страницы «Подключение MCP atlassian / bitbucket / jenkins / testops». Тогда preflight будет показывать их автоматически, а их id можно указать в `mcp.setup_docs.pages`.

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
