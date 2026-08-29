#!/usr/bin/env bash
# Remove rua= from _dmarc.<zone> TXT to stop aggregate DMARC reports (e.g. from Google).
# Requires CLOUDFLARE_API_TOKEN with Zone → DNS → Edit on the zone.
set -euo pipefail

ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-docstoc.io}"
API="https://api.cloudflare.com/client/v4"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN (Zone → DNS → Edit on ${ZONE_NAME})."
  exit 1
fi

auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

zone_id="${CLOUDFLARE_ZONE_ID:-}"
if [[ -z "$zone_id" ]]; then
  zone_id=$(curl -sS "${API}/zones?name=${ZONE_NAME}" "${auth[@]}" \
    | python3 -c "import json,sys; r=json.load(sys.stdin); assert r.get('success') and r['result'], r; print(r['result'][0]['id'])")
fi

record_name="_dmarc.${ZONE_NAME}"
existing=$(curl -sS "${API}/zones/${zone_id}/dns_records?type=TXT&name=${record_name}" "${auth[@]}")
record_id=$(python3 -c "import json,sys; r=json.load(sys.stdin); print(r['result'][0]['id'] if r.get('success') and r.get('result') else '')" <<<"$existing")
if [[ -z "$record_id" ]]; then
  echo "No _dmarc TXT record found on ${record_name} — nothing to do."
  exit 0
fi

current=$(python3 -c "import json,sys; r=json.load(sys.stdin); print(r['result'][0]['content'])" <<<"$existing")
new=$(python3 -c "
import re
s = '''${current//\'/\\\'}'''
s = re.sub(r';\\s*rua=[^;]*', '', s, flags=re.I)
s = re.sub(r';\\s*ruf=[^;]*', '', s, flags=re.I)
s = re.sub(r'rua=[^;]*;\\s*', '', s, flags=re.I)
s = re.sub(r';\\s*;', ';', s)
print(s.strip())
")

if [[ "$current" == "$new" ]]; then
  echo "_dmarc on ${ZONE_NAME} has no rua= clause — already clean."
  exit 0
fi

body=$(python3 -c "import json; print(json.dumps({'type':'TXT','name':'${record_name}','content':$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$new"),'ttl':1}))")

echo "Updating _dmarc on ${ZONE_NAME}:"
echo "  was: ${current}"
echo "  now: ${new}"
curl -sS -X PUT "${API}/zones/${zone_id}/dns_records/${record_id}" "${auth[@]}" -d "$body" \
  | python3 -c "import json,sys; r=json.load(sys.stdin); assert r.get('success'), r; print('OK')"
