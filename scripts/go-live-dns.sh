#!/usr/bin/env bash
# Attach chasa.io + www to Pages via proxied CNAMEs, then verify.
# Requires a Cloudflare API token with Zone.DNS Edit on chasa.io:
#   export CLOUDFLARE_API_TOKEN=...
# Optional: CLOUDFLARE_ZONE_ID (defaults to chasa.io zone in this account)
set -euo pipefail

ZONE_ID="${CLOUDFLARE_ZONE_ID:-b270fd325fb601987a9f5fd3e406530b}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-d7764515fd9887154193dc04810d81d8}"
PAGES_TARGET="chasa-71s.pages.dev"
API="https://api.cloudflare.com/client/v4"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN (Zone → DNS → Edit on chasa.io)."
  echo "Create at: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

upsert_cname() {
  local name="$1"
  local existing id
  existing=$(curl -sS "${API}/zones/${ZONE_ID}/dns_records?type=CNAME&name=${name}" "${auth[@]}")
  id=$(python3 -c "import json,sys; r=json.load(sys.stdin); print(r['result'][0]['id'] if r.get('success') and r.get('result') else '')" <<<"$existing")
  local body
  body=$(python3 -c "import json; print(json.dumps({'type':'CNAME','name':'$name','content':'$PAGES_TARGET','proxied':True,'ttl':1}))")
  if [[ -n "$id" ]]; then
    echo "Updating CNAME $name → $PAGES_TARGET"
    curl -sS -X PUT "${API}/zones/${ZONE_ID}/dns_records/${id}" "${auth[@]}" -d "$body" \
      | python3 -c "import json,sys; r=json.load(sys.stdin); assert r.get('success'), r; print('OK', r['result']['name'], '→', r['result']['content'])"
  else
    echo "Creating CNAME $name → $PAGES_TARGET"
    curl -sS -X POST "${API}/zones/${ZONE_ID}/dns_records" "${auth[@]}" -d "$body" \
      | python3 -c "import json,sys; r=json.load(sys.stdin); assert r.get('success'), r; print('OK', r['result']['name'], '→', r['result']['content'])"
  fi
}

upsert_cname "chasa.io"
upsert_cname "www.chasa.io"

echo "Waiting for Pages custom domains…"
for i in 1 2 3 4 5 6; do
  sleep 5
  curl -sS "${API}/accounts/${ACCOUNT_ID}/pages/projects/chasa/domains" "${auth[@]}" \
    | python3 -c "
import json,sys
r=json.load(sys.stdin)
for d in r.get('result') or []:
  print(d['name'], d['status'], (d.get('verification_data') or {}).get('error_message',''))
" || true
done

echo
echo "Next (manual if not already set): Bulk Redirects — www.chasa.io → https://chasa.io (301, preserve path + query)."
echo "Then run: ./scripts/go-live-verify.sh"
