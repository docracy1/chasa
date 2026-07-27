#!/usr/bin/env bash
# Verify Chasa is live on chasa.io + api.chasa.io. Run after attaching Pages custom domains.
set -euo pipefail

fail=0
check() {
  local name="$1" url="$2" expect="${3:-200}"
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $name ($code) $url"
  else
    echo "FAIL $name (got $code, want $expect) $url"
    fail=1
  fi
}

echo "=== Chasa go-live verification ==="
check "Homepage" "https://chasa.io/"
check "App" "https://chasa.io/app/"
check "Sitemap" "https://chasa.io/sitemap.xml"
check "Zapier doc" "https://chasa.io/docs/zapier-wave-overdue-import.json"
check "API health" "https://api.chasa.io/"
check "MCP" "https://api.chasa.io/mcp" "200"
check "www redirect" "https://www.chasa.io/" "301"

if [[ $fail -eq 0 ]]; then
  echo "All checks passed — Chasa is live."
else
  echo "Some checks failed."
  echo "  chasa.io fails      → Workers & Pages → chasa → Custom domains → add chasa.io"
  echo "  www redirect fails  → Bulk Redirects: www.chasa.io → https://chasa.io (301, subpath matching)"
  exit 1
fi
