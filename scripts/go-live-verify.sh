#!/usr/bin/env bash
# Verify docstoc.io is live and legacy chasa.io hosts 301 to docstoc.
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

redirect_to() {
  local name="$1" url="$2" expect_host="$3"
  loc=$(curl -sS -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 15 "$url" || echo "000")
  code="${loc%% *}"
  target="${loc#* }"
  if [[ "$code" == "301" && "$target" == https://${expect_host}/* ]]; then
    echo "OK  $name (301 → $target)"
  elif [[ "$code" == "301" && "$target" == https://${expect_host} ]]; then
    echo "OK  $name (301 → $target)"
  else
    echo "FAIL $name (got $code → $target, want 301 → https://${expect_host}/…) $url"
    fail=1
  fi
}

echo "=== docstoc go-live verification ==="
check "Homepage" "https://docstoc.io/"
check "App" "https://docstoc.io/app/"
check "Sitemap" "https://docstoc.io/sitemap.xml"
check "API health" "https://api.docstoc.io/"
check "MCP" "https://api.docstoc.io/mcp" "200"
redirect_to "www.docstoc.io" "https://www.docstoc.io/" "docstoc.io"
redirect_to "chasa.io cutover" "https://chasa.io/" "docstoc.io"
redirect_to "www.chasa.io cutover" "https://www.chasa.io/" "docstoc.io"
redirect_to "api.chasa.io cutover" "https://api.chasa.io/mcp" "api.docstoc.io"

if [[ $fail -eq 0 ]]; then
  echo "All checks passed — docstoc is live."
else
  echo "Some checks failed."
  echo "  docstoc.io fails     → Pages custom domain + deploy"
  echo "  chasa redirects fail → Pages _middleware.ts + redeploy web"
  echo "  api.chasa.io fails   → Worker legacy redirect + deploy worker"
  exit 1
fi
