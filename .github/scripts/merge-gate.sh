#!/usr/bin/env bash
# Wait for path-scoped CI workflows triggered for this PR. Pass if all
# observed required workflows succeed; fail if any failed; pass when none
# triggered (their `paths:` filters didn't match).
#
# Required env: GH_TOKEN, GH_REPO ("owner/name"), HEAD_SHA.

set -euo pipefail

KNOWN=("Web CI" "Terraform CI" "Actions CI")
names_json=$(printf '%s\n' "${KNOWN[@]}" | jq -Rn '[inputs]')

fetch_states() {
  gh api \
    "repos/${GH_REPO}/actions/runs?head_sha=${HEAD_SHA}&event=pull_request&per_page=100" \
  | jq -r --argjson names "$names_json" '
      .workflow_runs
      | map(select(.name | IN($names[])))
      | group_by(.name)
      | map(max_by(.run_started_at))
      | .[]
      | [.name, .status, (.conclusion // "")] | @tsv'
}

# The gate's own job can start before its siblings register in the API,
# so retry discovery briefly before concluding "none triggered".
states=""
required=()
for attempt in 1 2 3 4; do
  states=$(fetch_states)
  required=()
  while IFS=$'\t' read -r name _ _; do
    [[ -n "$name" ]] && required+=("$name")
  done <<<"$states"
  (( ${#required[@]} > 0 )) && break
  (( attempt < 4 )) && sleep 5
done

summary=${GITHUB_STEP_SUMMARY:-/dev/null}
if (( ${#required[@]} == 0 )); then
  {
    echo "### Merge Gate"
    echo "No CI workflows triggered for this PR — gate passes."
  } >> "$summary"
  echo "No CI workflows triggered for this PR; gate passes."
  exit 0
fi

{
  echo "### Merge Gate"
  echo "Required workflows (observed): ${required[*]}"
} >> "$summary"
echo "Required workflows: ${required[*]}"

deadline=$(( $(date +%s) + 25 * 60 ))
interval=20

while :; do
  pending=()
  failed=()
  while IFS=$'\t' read -r name status conclusion; do
    if [[ "$status" != "completed" ]]; then
      pending+=("$name [$status]")
    elif [[ "$conclusion" != "success" && "$conclusion" != "skipped" ]]; then
      failed+=("$name [$conclusion]")
    fi
  done <<<"$states"

  if (( ${#pending[@]} == 0 )); then
    if (( ${#failed[@]} > 0 )); then
      echo "::error::Required workflows failed: ${failed[*]}"
      exit 1
    fi
    echo "All required workflows succeeded."
    exit 0
  fi

  echo "pending=(${pending[*]}) failed=(${failed[*]})"

  if (( $(date +%s) >= deadline )); then
    break
  fi
  sleep "$interval"
  states=$(fetch_states)
done

echo "::error::Timed out waiting for required workflows."
exit 1
