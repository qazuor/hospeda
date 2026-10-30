#!/usr/bin/env bash
# =============================================================================
# SONDA 53 — Dos suscripciones vivas para que el PAGADOR actúe sobre ellas
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Prepara EX-52 (el pagador cancela desde su cuenta) y
# EX-53 (el pagador pausa desde su cuenta). Esos actos son del owner, logueado
# como el comprador de prueba: este script sólo deja los sujetos listos y
# anota su estado de partida, para que después se pueda comparar campo por
# campo contra una cancelación nuestra (`PUT status=cancelled`, sonda 52) y
# contra una por rechazo en el alta (sonda 52, paso 10).
#
# Sandbox, tarjeta de prueba APRO, frecuencia mensual (un solo cobro, al alta).
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-53-sujetos-para-el-pagador.sh
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-53-sujetos-para-el-pagador.sh --leer
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-$HOME/.config/hospeda}"
MANIFIESTO="$OUT/manifiesto-sonda-53.json"
: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')

leer() { # <id>
  curl -sS "${H[@]}" "$API/preapproval/$1" | jq -c '{id, status, reason, last_modified,
    next_payment_date, payer_id, card_id, external_reference,
    summarized: (.summarized | {charged_quantity, last_charged_date})}'
}

if [ "${1:-}" = "--leer" ]; then
  [ -f "$MANIFIESTO" ] || { echo "no está $MANIFIESTO"; exit 1; }
  echo "############ SONDA 53 — estado actual · $(date -Is)"
  for id in $(jq -r '.[].id' "$MANIFIESTO"); do leer "$id"; done
  exit
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
crear() { # <sufijo> <reason>
  local tok
  tok=$(curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw '{"card_number":"5031755734530604",
    "security_code":"123","expiration_month":11,"expiration_year":2030,
    "cardholder":{"name":"APRO","identification":{"type":"DNI","number":"12345678"}}}' | jq -r '.id // empty')
  curl -sS -X POST "$API/preapproval" "${H[@]}" --data-raw "$(jq -cn --arg e "$MP_BUYER_EMAIL" \
    --arg t "$tok" --arg x "HOS-1352-s53-$STAMP-$1" --arg r "$2" '{
    reason:$r, payer_email:$e, back_url:"https://www.hospeda.com.ar", external_reference:$x,
    card_token_id:$t, status:"authorized",
    auto_recurring:{frequency:1, frequency_type:"months", transaction_amount:1500, currency_id:"ARS"}}')" \
    | jq -c --arg s "$1" '{sujeto:$s, id, status, date_created}'
}

echo "############ SONDA 53 — crear sujetos · $(date -Is)"
A=$(crear cancelar "HOS1352 EX-52 cancelar desde la app")
sleep 5
B=$(crear pausar "HOS1352 EX-53 pausar desde la app")
jq -s . <<<"$A"$'\n'"$B" > "$MANIFIESTO"
cat "$MANIFIESTO"
for id in $(jq -r '.[].id' "$MANIFIESTO"); do leer "$id"; done
echo "manifiesto: $MANIFIESTO"
