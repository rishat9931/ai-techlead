#!/usr/bin/env bash
# Установка расширения ai-techlead: scripts/install.sh [gigacode|qwen]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/../extension" && pwd)"

CLI="${1:-}"
if [ -z "$CLI" ]; then
  if command -v gigacode >/dev/null 2>&1; then CLI=gigacode; else CLI=qwen; fi
fi
case "$CLI" in
  gigacode|qwen) ;;
  *) echo "Использование: $0 [gigacode|qwen]" >&2; exit 2 ;;
esac
if ! command -v "$CLI" >/dev/null 2>&1; then
  echo "Не найден CLI '$CLI' в PATH." >&2
  exit 1
fi

DEST="$HOME/.$CLI/extensions/ai-techlead"
echo "CLI: $CLI"
echo "Источник: $EXT_DIR"

installed=0
if "$CLI" extensions --help >/dev/null 2>&1; then
  # Переустановка: install отказывается ставить поверх, а update сравнивает только версии —
  # поэтому сначала снимаем старую копию штатной командой.
  if [ -d "$DEST" ]; then
    echo "Уже установлено в $DEST — переустанавливаю."
    "$CLI" extensions uninstall ai-techlead || true
  fi
  if "$CLI" extensions install "$EXT_DIR" --consent || "$CLI" extensions install "$EXT_DIR" </dev/null; then
    installed=1
  else
    echo "'$CLI extensions install' не сработала, копирую вручную." >&2
  fi
else
  echo "'$CLI extensions' не поддерживается, копирую вручную."
fi

if [ "$installed" -eq 0 ]; then
  if [ -e "$DEST" ]; then
    echo "Будет заменена существующая копия: $DEST"
    rm -rf "$DEST"
  fi
  mkdir -p "$(dirname "$DEST")"
  cp -R "$EXT_DIR" "$DEST"
  echo "Скопировано в $DEST"
fi

cat <<MSG

Готово. Дальше:
  1. cd в папку вашей команды (рабочую папку для отчётов).
  2. Запустите $CLI.
  3. Выполните /techlead-init — он подготовит папку (.techlead/, techlead.yaml, .env.example).
  4. Заполните techlead.yaml и переменные окружения, затем /standup.
MSG
