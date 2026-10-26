#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
environment="${1:-review}"
if [[ "$environment" != review && "$environment" != production ]]; then
  printf 'Usage: scripts/deploy.sh [review|production]\n' >&2
  exit 2
fi
if [[ "$environment" == production ]]; then
  [[ "$(git branch --show-current)" == main ]] || { printf 'Production requires main\n' >&2; exit 1; }
  git fetch origin main --quiet
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || { printf 'Production requires exact origin/main HEAD\n' >&2; exit 1; }
fi
python scripts/build.py
python scripts/check.py
git diff --exit-code -- site/
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || { printf 'Commit the exact site before deployment\n' >&2; exit 1; }
SWA_CLI_DEPLOYMENT_TOKEN="$(az staticwebapp secrets list --name peppy-the-peptide --resource-group peppy-course-rg --query properties.apiKey -o tsv)"
[[ -n "$SWA_CLI_DEPLOYMENT_TOKEN" ]] || { printf 'Azure deployment token unavailable\n' >&2; exit 1; }
export SWA_CLI_DEPLOYMENT_TOKEN
trap 'unset SWA_CLI_DEPLOYMENT_TOKEN' EXIT
npx -y @azure/static-web-apps-cli@2.1.0 deploy ./site --env "$environment"
