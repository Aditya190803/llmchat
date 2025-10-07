#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but was not found in PATH." >&2
  exit 1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "This script must be run from inside a Git repository." >&2
  exit 1
fi

mapfile -t status_lines < <(git status --porcelain)
if ((${#status_lines[@]} == 0)); then
  echo "Nothing to commit. Working tree is clean."
  exit 0
fi

declare -A group_file_list
declare -A group_display
declare -a group_order

for line in "${status_lines[@]}"; do
  [[ -z "$line" ]] && continue
  status="${line:0:2}"
  file="${line:3}"

  if [[ "$file" == *" -> "* ]]; then
    file="${file##* -> }"
  fi

  if [[ "$file" == */* ]]; then
    group="${file%%/*}"
  else
    group="$file"
  fi

  if [[ -z "${group_file_list[$group]+x}" ]]; then
    group_order+=("$group")
    group_file_list["$group"]=""
    group_display["$group"]=""
  fi

  group_file_list["$group"]+="$file"$'\n'
  group_display["$group"]+="$status $file"$'\n'

done

echo "Detected change groups:"
for group in "${group_order[@]}"; do
  echo "  - $group"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    printf "      %s\n" "$line"
  done <<< "${group_display[$group]}"
  echo
  read -rp "Stage and commit this group? [y/N] " answer
  case "${answer,,}" in
    y|yes)
      mapfile -t files_to_add < <(printf '%s' "${group_file_list[$group]}" | sed '/^$/d')
      if ((${#files_to_add[@]} == 0)); then
        echo "No files to stage for group $group; skipping." >&2
        continue
      fi

      git add -- "${files_to_add[@]}"
      staged=$(git diff --cached --name-only)
      if [[ -z "$staged" ]]; then
        echo "No changes staged for commit; skipping group $group." >&2
        git reset -- "${files_to_add[@]}"
        continue
      fi

      default_message="${group}: update"
      read -rp "Commit message [${default_message}]: " message
      message="${message:-$default_message}"

      if [[ -z "$message" ]]; then
        echo "Empty commit message; unstaging files." >&2
        git reset -- "${files_to_add[@]}"
        continue
      fi

      git commit -m "$message"
      ;;
    *)
      echo "Skipping group $group."
      ;;
  esac
  echo
 done

if git status --porcelain | grep -q '^[[:space:][:alnum:]]'; then
  echo "There are still unstaged changes remaining."
else
  echo "All tracked changes have been committed."
fi

read -rp "Push current branch to origin? [y/N] " push_answer
case "${push_answer,,}" in
  y|yes)
    current_branch=$(git symbolic-ref --short HEAD)
    git push origin "$current_branch"
    ;;
  *)
    echo "Skipping git push."
    ;;
esac
