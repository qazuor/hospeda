#!/usr/bin/env bash
# =============================================================================
# SONDA 09 — Provocar webhooks reales, en un orden que conocemos
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Alimenta la sonda 08 (el receptor) con tráfico real del
# proveedor. Cubre WH-1, WH-2, WH-3, WH-5 y EX-2.
#
# LA IDEA
# -------
# Se ejecuta una secuencia de acciones sobre UNA suscripción descartable,
# **anotando el instante exacto de cada una**. Como el orden de las causas es
# conocido, el orden de los efectos se vuelve medible:
#
#   · si los eventos llegan en otro orden → WH-3 queda demostrado
#   · si alguno no llega nunca           → WH-5
#   · si alguno llega dos veces          → WH-1
#   · la diferencia entre el instante de la acción y el de la llegada → WH-2
#
# Sin esta secuencia sólo se puede mirar lo que caiga, y "lo que caiga" no
# permite afirmar que algo llegó fuera de orden: hace falta saber cuál era el
# orden verdadero.
#
# NO TOCA LOS SUJETOS DEL RELOJ de la sonda 05. Crea el suyo y lo cancela.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-09-disparar-webhooks.sh
#
# Después, esperar y leer con:
#   SINK_URL=https://hos1352-webhook-sink.qazuor.workers.dev bash probe-08-leer-webhooks.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-09}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

# Segundos entre acciones. Con acciones separadas por ~1 s NO se puede
# atribuir qué evento salió de cuál: la primera corrida dejó 3 eventos para 5
# acciones y la asignación quedaba a criterio del que lee. Espaciarlas es lo
# que convierte la atribución en una lectura y no en una inferencia.
ESPERA="${ESPERA:-20}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante\taccion\thttp\testado_releido\n' > "$BITACORA"

echo "############ SONDA 09 — disparar webhooks · $(date -Is)"
echo "############ bitácora: $BITACORA"

# Un token se usa una sola vez (EX-12).
TOK=$(curl -sS -X POST "$API/v1/card_tokens" \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data-raw '{"card_number":"5031755734530604","security_code":"123",
               "expiration_month":11,"expiration_year":2030,
               "cardholder":{"name":"APRO","identification":{"type":"DNI","number":"12345678"}}}' \
  | jq -r '.id // empty')
[ -n "$TOK" ] || { echo "no se pudo tokenizar"; exit 1; }

anotar() { # <accion> <http> <estado>
  printf '%s\t%s\t%s\t%s\n' "$(date -Ins)" "$1" "$2" "$3" >> "$BITACORA"
  printf '  %-28s HTTP %-3s → %s   [%s]\n' "$1" "$2" "$3" "$(date +%H:%M:%S.%3N)"
}

# --- 1. crear -----------------------------------------------------------------
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg x "HOS-1352-wh-$STAMP" '{
  reason:"HOS1352 disparador de webhooks", payer_email:$e,
  back_url:"https://www.hospeda.com.ar", external_reference:$x,
  card_token_id:$t, status:"authorized",
  auto_recurring:{frequency:1, frequency_type:"days",
                  transaction_amount:2500, currency_id:"ARS"}}')
code=$(curl -sS -o "$OUT/01-crear.json" -w '%{http_code}' -X POST "$API/preapproval" \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data-raw "$BODY")
ID=$(jq -r '.id // empty' "$OUT/01-crear.json")
anotar "crear (cobra al instante)" "$code" "$(jq -r '.status // "?"' "$OUT/01-crear.json")"
[ -n "$ID" ] || { jq -c '{message}' "$OUT/01-crear.json"; exit 1; }
echo "  id de la suscripción: $ID"
echo "$ID" > "$OUT/id-$STAMP.txt"

paso() { # <accion> <json>
  local accion="$1" patch="$2" code estado
  sleep "$ESPERA"
  code=$(curl -sS -o "$OUT/${accion// /_}.json" -w '%{http_code}' -X PUT "$API/preapproval/$ID" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$patch")
  # relectura: el 2xx no prueba nada (§0)
  estado=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$ID" \
    | jq -r '"\(.status)/\(.auto_recurring.transaction_amount)"')
  anotar "$accion" "$code" "$estado"
}

# --- 2..5. la secuencia, en un orden que después se compara -------------------
# Cada paso es de un TIPO distinto a propósito: si el proveedor sólo notifica
# algunos, se ve cuáles.
paso "cambiar monto a 3500" '{"auto_recurring":{"transaction_amount":3500,"currency_id":"ARS"}}'
paso "pausar"               '{"status":"paused"}'
paso "reanudar"             '{"status":"authorized"}'
paso "cancelar"             '{"status":"cancelled"}'

echo
column -t -s$'\t' "$BITACORA"
cat <<TXT

############ FIN · $(date -Is)

  Cinco acciones, con su instante anotado. Ahora hay que ESPERAR y leer:

      SINK_URL=https://hos1352-webhook-sink.qazuor.workers.dev bash probe-08-leer-webhooks.sh

  Qué mirar, y qué NO concluir:

  · Si el receptor devuelve 0 en los primeros segundos, **eso no es una
    ausencia**: el listado de KV es eventualmente consistente. Esperar ~60 s.
  · Si pasados varios minutos faltan eventos de algunos pasos, eso SÍ es WH-5,
    y hay que revisar antes si la aplicación tiene seleccionados los tipos de
    evento en el panel (notification_events vino null).
  · Comparar el orden de llegada contra el orden de esta bitácora: es lo único
    que permite afirmar WH-3.
TXT
