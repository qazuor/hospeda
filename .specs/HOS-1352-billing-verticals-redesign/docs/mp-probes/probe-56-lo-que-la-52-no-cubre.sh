#!/usr/bin/env bash
# =============================================================================
# SONDA 56 — Lo que la sonda 52 no cubre, con los dos canales escuchando
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Batería IPN del 2026-09-29
# (RESULTS-2026-09-29-bateria-ipn.md). Cubre, con el receptor en `ok`:
#   - EX-15 ampliada: ¿cambiar la tarjeta de una viva (`EX-36`) avisa? ¿y
#     reescribir el `reason` (`EX-19`)? ¿y un cambio de tarjeta RECHAZADO (402)?
#   - RF-7 en sandbox: ¿un reembolso total / parcial de una orden avisa, por
#     qué canal, y con qué id?
#   - pago rechazado: ¿una orden con tarjeta que rechaza avisa, y por dónde?
#   - control: una orden aprobada (con los tópicos de órdenes tildados desde
#     el 2026-09-29 ~14:40Z; la sonda 52 del 29/09 madrugada no vio NINGUNA
#     entrega de una orden con `notifications_topics: []`).
#
# POR QUÉ ASÍ
# -----------
# La aplicación `Hospeda Test` tiene IPN → `/ipn` y Webhooks → `/webhooks`
# del receptor de la sonda 08. El canal de cada entrega sale del path. Las
# acciones van a 90 s (WH-2: la atribución por cercanía no es segura, así que
# además se atribuye por id releído). Los reembolsos van por la Orders API: la
# de Payments da `401` a la cuenta de pruebas (RESULTS-2026-09-15, RF-1..3).
#
# LA SECUENCIA
#   01 crear preapproval autorizado (master APRO)          [sujeto P]
#   02 PUT card_token_id → Visa APRO (otra marca: EX-36)   [P]
#   03 PUT reason → otro texto (EX-19)                      [P]
#   04 PUT card_token_id → master OTHE (rechazo: 402)       [P]
#   05 orden aprobada O1, ARS 100
#   06 orden con tarjeta OTHE (rechazo)
#   07 reembolso TOTAL de O1   (POST /v1/orders/{id}/refund, sin body)
#   08 orden aprobada O2, ARS 100
#   09 reembolso PARCIAL de O2, ARS 40
#   10 cancelar P
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=... bash probe-56-lo-que-la-52-no-cubre.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-56}"
ESPERA="${ESPERA:-90}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

# Guard de entorno (sonda 42): sólo corre contra la cuenta de PRUEBAS.
curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me" | jq -e '.tags | index("test_user")' >/dev/null \
  || { echo "ABORTA: las credenciales no son de la cuenta de pruebas"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante_envio\tpaso\taccion\thttp\trecurso\tresultado\n' > "$BITACORA"
echo "run=$STAMP" > "$OUT/run.txt"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')
MASTER=$(grep -oP 'card_number:"\K[0-9]+' "$(dirname "$0")/probe-52-los-dos-canales.sh" | head -1)
VISA="4509953566233704"   # Visa crédito MLA, catálogo público de prueba (sonda 42)

anotar() {
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$BITACORA"
  printf '  %-3s %-36s HTTP %-3s %-36s → %s   [enviada %s]\n' "$2" "$3" "$4" "$5" "$6" "$1"
}
tokenizar() { # <numero> <titular>
  curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw "$(jq -cn --arg num "$1" --arg n "$2" '{
    card_number:$num, security_code:"123", expiration_month:11, expiration_year:2030,
    cardholder:{name:$n, identification:{type:"DNI", number:"12345678"}}}')" | jq -r '.id // empty'
}
llamar() { # <metodo> <url> <archivo> <cuerpo> [clave-idempotencia]
  local code n=0 espera=5 extra=()
  [ -n "${5:-}" ] && extra=(-H "X-Idempotency-Key: $5")
  while : ; do
    code=$(curl -sS -o "$3" -w '%{http_code}' -X "$1" "$2" "${H[@]}" "${extra[@]}" --data-raw "$4")
    [ "$code" = "429" ] || break
    n=$((n + 1)); [ "$n" -le 5 ] || break
    sleep "$espera"; espera=$((espera * 2))
  done
  printf '%s' "$code"
}
releer_p() { curl -sS "${H[@]}" "$API/preapproval/$PID_" | jq -r '"\(.status) · card \(.card_id) \(.payment_method_id) · mod \(.last_modified)"'; }

echo "############ SONDA 56 · $(date -Is) · run=$STAMP"

# --- 01 crear P ---------------------------------------------------------------
TOK=$(tokenizar "$MASTER" APRO)
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg x "HOS-1352-s56-$STAMP" '{
  reason:"HOS1352 sonda 56", payer_email:$e, back_url:"https://www.hospeda.com.ar",
  external_reference:$x, card_token_id:$t, status:"authorized",
  auto_recurring:{frequency:1, frequency_type:"months", transaction_amount:2500, currency_id:"ARS"}}')
T=$(date -Ins); code=$(llamar POST "$API/preapproval" "$OUT/01.json" "$BODY")
PID_=$(jq -r '.id // empty' "$OUT/01.json")
[ -n "$PID_" ] || { jq -c . "$OUT/01.json"; exit 1; }
anotar "$T" 01 "crear preapproval P" "$code" "$PID_" "$(releer_p)"

paso_p() { # <paso> <accion> <json>
  sleep "$ESPERA"
  local t c
  t=$(date -Ins); c=$(llamar PUT "$API/preapproval/$PID_" "$OUT/$1.json" "$3")
  anotar "$t" "$1" "$2" "$c" "$PID_" "$(releer_p) · resp $(jq -c '.message // .status // empty' "$OUT/$1.json" | cut -c1-60)"
}
paso_p 02 "cambiar tarjeta → Visa APRO" "$(jq -cn --arg t "$(tokenizar "$VISA" APRO)" '{card_token_id:$t}')"
paso_p 03 "reescribir reason" '{"reason":"HOS1352 sonda 56 reason nuevo"}'
paso_p 04 "cambiar tarjeta → master OTHE" "$(jq -cn --arg t "$(tokenizar "$MASTER" OTHE)" '{card_token_id:$t}')"

orden() { # <paso> <titular> <accion>
  sleep "$ESPERA"
  local tok t c
  tok=$(tokenizar "$MASTER" "$2")
  t=$(date -Ins)
  c=$(llamar POST "$API/v1/orders" "$OUT/$1.json" "$(jq -cn --arg t "$tok" --arg e "$MP_BUYER_EMAIL" --arg x "HOS-1352-s56-$STAMP-$1" '{
    type:"online", external_reference:$x, total_amount:"100.00", processing_mode:"automatic", payer:{email:$e},
    transactions:{payments:[{amount:"100.00", payment_method:{id:"master", type:"credit_card", token:$t, installments:1}}]}}')" "s56-$STAMP-$1")
  anotar "$t" "$1" "$3" "$c" "$(jq -r '.id // "?"' "$OUT/$1.json")" \
    "$(jq -r '"\(.status // .message)/\(.status_detail // "-") · pago \(.transactions.payments[0].id // "?") ref \(.transactions.payments[0].reference_id // "?") \(.transactions.payments[0].status // "")"' "$OUT/$1.json")"
}
reembolso() { # <paso> <orden-json> <cuerpo> <accion>
  sleep "$ESPERA"
  local oid t c
  oid=$(jq -r '.id' "$OUT/$2.json")
  t=$(date -Ins); c=$(llamar POST "$API/v1/orders/$oid/refund" "$OUT/$1.json" "$3" "s56-$STAMP-$1")
  anotar "$t" "$1" "$4" "$c" "$oid" \
    "$(jq -c '{status, status_detail, refunds: [.transactions.refunds[]? | {id, amount, status, reference_id}], err: (.errors // .message)}' "$OUT/$1.json" | cut -c1-200)"
}

orden 05 APRO "orden aprobada O1"
orden 06 OTHE "orden tarjeta OTHE"
reembolso 07 05 '' "reembolso TOTAL de O1"
orden 08 APRO "orden aprobada O2"
TX2=$(jq -r '.transactions.payments[0].id' "$OUT/08.json")
reembolso 09 08 "$(jq -cn --arg id "$TX2" '{transactions:[{id:$id, amount:"40.00"}]}')" "reembolso PARCIAL 40 de O2"
paso_p 10 "cancelar P" '{"status":"cancelled"}'

echo; column -t -s$'\t' "$BITACORA"
echo "############ FIN · $(date -Is) · run=$STAMP · P=$PID_"
