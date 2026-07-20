#!/usr/bin/env bash

set -euo pipefail

repository="${GPU_MODE_THUMBNAIL_REPOSITORY:-msaroufim/render-gpu-mode-thumbnails}"
workflow="${GPU_MODE_THUMBNAIL_WORKFLOW:-process-speaker-intake.yml}"
ref="${GPU_MODE_THUMBNAIL_REF:-main}"
job_id=""
wait_for_completion=true

usage() {
  printf '%s\n' \
    "Usage: scripts/dispatch_intake_queue.sh [--job-id ID] [--no-wait]" \
    "" \
    "Dispatch the private GPU MODE speaker-intake queue through GitHub Actions." \
    "The authenticated GitHub user must be able to run Actions in ${repository}."
}

while (($#)); do
  case "$1" in
    --job-id)
      if (($# < 2)); then
        printf '%s\n' "error: --job-id requires a value" >&2
        exit 2
      fi
      job_id="$2"
      shift 2
      ;;
    --no-wait)
      wait_for_completion=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf '%s\n' "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  printf '%s\n' "error: GitHub CLI (gh) is required" >&2
  exit 1
fi

gh auth status >/dev/null

dispatch=(workflow run "$workflow" --repo "$repository" --ref "$ref")
if [[ -n "$job_id" ]]; then
  dispatch+=(-f "job_id=$job_id")
fi

run_url="$(gh "${dispatch[@]}")"
if [[ ! "$run_url" =~ ^https://github\.com/.+/actions/runs/[0-9]+$ ]]; then
  printf '%s\n' "error: GitHub did not return a workflow run URL" >&2
  exit 1
fi

printf '%s\n' "$run_url"

if [[ "$wait_for_completion" == true ]]; then
  run_id="${run_url##*/}"
  gh run watch "$run_id" --repo "$repository" --exit-status
  gh run view "$run_id" --repo "$repository" --log \
    | awk '/Completed thumbnail job|No queued thumbnail submissions/ { print }'
fi
