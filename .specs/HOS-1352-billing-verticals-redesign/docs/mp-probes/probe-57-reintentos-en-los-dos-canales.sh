#!/usr/bin/env bash
# =============================================================================
# SONDA 57 — La escalera inicial de reintentos, en los dos canales
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Batería IPN del 2026-09-29
# (RESULTS-2026-09-29-bateria-ipn.md). Cubre WH-4 (reintentos) y el mecanismo
# de WH-5 (supersesión) con el canal IPN escuchando, que las mediciones del
# 2026-09-15 y 09-23 no tenían.
#
# CÓMO
# ----
# Pone el receptor de la sonda 08 en `mode=fail` (responde 500 a TODO), hace
# tres hechos y lo vuelve a `ok`. La ventana en fail se acota a lo mínimo
# (~3,5 min) porque el receptor es compartido: todo lo que llegue en ella,
# de cualquier corrida, recibe 500. Los instantes exactos de entrada y salida
# se imprimen y quedan en la bitácora.
#
#   01 [fail] crear preapproval Q autorizado      → payment (2 canales), ap, preapproval
#   02 [fail] pausar Q (+60 s)                    → preapproval, versión MAYOR que la de 01
#   03 [fail] orden aprobada O (+60 s)            → payment (2 canales), ¿order?
#   04 volver a `ok` (+45 s)
#
# Después se lee el receptor durante ~40 min: el primer reintento programado
# (+18,8 min en WH-4) llega con el receptor ya en `ok`, recibe 200 y cierra la
# escalera. Eso mide: duplicado inmediato, primer reintento, y si la versión
# vieja del preapproval (el alta) se abandona cuando existe la de la pausa
# (supersesión, WH-5) — ahora también en IPN.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=... bash probe-57-reintentos-en-los-dos-canales.sh
#   ... bash probe-57-reintentos-en-los-dos-canales.sh --cancelar <preapproval>   # al terminar la lectura
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
SINK="${SINK_URL:-https://hos1352-webhook-sink.qazuor.workers.dev}"
OUT="${OUT_DIR:-/tmp/mp-probe-57}"
mkdir -p "$OUT"
: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"
TOKEN="$(tr -d '\n' < "${TOKEN_FILE:-$HOME/.config/hospeda/hos1352-sink-token.txt}")"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')

curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me" | jq -e '.tags | index("test_user")' >/dev/null \
  || { echo "ABORTA: las credenciales no son de la cuenta de pruebas"; exit 1; }

if [ "${1:-}" = "--cancelar" ]; then
  : "${2:?falta el id}"
  curl -sS -X PUT "${H[@]}" "$API/preapproval/$2" --data-raw '{"status":"cancelled"}' | jq -c '{id, status, last_modified}'
  exit
fi

modo() { curl -sS -X POST "$SINK/mode?t=$TOKEN&m=$1" | jq -r .mode; }
MASTER=$(grep -oP 'card_number:"\K[0-9]+' "$(dirname "$0")/probe-52-los-dos-canales.sh" | head -1)
tokenizar() {
  curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw "$(jq -cn --arg num "$MASTER" '{
    card_number:$num, security_code:"123", expiration_month:11, expiration_year:2030,
    cardholder:{name:"APRO", identification:{type:"DNI", number:"12345678"}}}')" | jq -r '.id // empty'
}
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
B="$OUT/bitacora-$STAMP.tsv"
anotar() { printf '%s\t%s\n' "$(date -u +%FT%T.%3NZ)" "$1" | tee -a "$B"; }

echo "############ SONDA 57 · run=$STAMP"
[ "$(curl -sS "$SINK/mode?t=$TOKEN" | jq -r .mode)" = "ok" ] || { echo "ABORTA: el receptor no está en ok"; exit 1; }

# Si algo falla a mitad, el receptor NO queda en fail.
trap 'anotar "salida (trap) → modo $(modo ok)"' EXIT

anotar "ENTRA fail → $(modo fail)"

TOK=$(tokenizar)
curl -sS -X POST "$API/preapproval" "${H[@]}" -o "$OUT/01.json" --data-raw "$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg x "HOS-1352-s57-$STAMP" '{
  reason:"HOS1352 sonda 57", payer_email:$e, back_url:"https://www.hospeda.com.ar",
  external_reference:$x, card_token_id:$t, status:"authorized",
  auto_recurring:{frequency:1, frequency_type:"months", transaction_amount:2500, currency_id:"ARS"}}')"
Q=$(jq -r '.id // empty' "$OUT/01.json")
anotar "01 crear Q → ${Q:-FALLÓ $(jq -c . "$OUT/01.json" | cut -c1-120)}"
[ -n "$Q" ] || exit 1
echo "$Q" > "$OUT/Q.txt"

sleep 60
curl -sS -X PUT "$API/preapproval/$Q" "${H[@]}" -o "$OUT/02.json" --data-raw '{"status":"paused"}'
anotar "02 pausar Q → $(jq -r '.status // .message' "$OUT/02.json")"

sleep 60
TOK=$(tokenizar)
curl -sS -X POST "$API/v1/orders" "${H[@]}" -H "X-Idempotency-Key: s57-$STAMP-03" -o "$OUT/03.json" \
  --data-raw "$(jq -cn --arg t "$TOK" --arg e "$MP_BUYER_EMAIL" --arg x "HOS-1352-s57-$STAMP-03" '{
    type:"online", external_reference:$x, total_amount:"100.00", processing_mode:"automatic", payer:{email:$e},
    transactions:{payments:[{amount:"100.00", payment_method:{id:"master", type:"credit_card", token:$t, installments:1}}]}}')"
anotar "03 orden O → $(jq -r '"\(.id) \(.status) pago \(.transactions.payments[0].id) ref \(.transactions.payments[0].reference_id // "?")"' "$OUT/03.json")"

sleep 45
anotar "SALE fail → $(modo ok)"
trap - EXIT
curl -sS "${H[@]}" "$API/preapproval/$Q" | jq -c '{id, status, last_modified}' | tee -a "$B"
echo "############ FIN · leer el receptor ~40 min · Q=$Q · cancelar con --cancelar $Q"
