#!/usr/bin/env bash
# =============================================================================
# SONDA 52 — Los dos canales de avisos: qué llega por IPN y qué por Webhooks
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Cubre lo que se puede de WH-6, EX-15 (reabierta, canal
# IPN), WH-5 (reabierta, mecanismo en sandbox) sin tocar el panel de ninguna
# aplicación. Lee con probe-08-leer-webhooks.sh (--crudo) o con el filtro de
# RESULTS-2026-09-29.md.
#
# POR QUÉ EXISTE
# --------------
# El receptor de hospeda2 descarta en silencio toda entrega sin
# `source_news=webhooks` (HOS-159), o sea todo el canal IPN. Las filas medidas
# con un solo canal escuchando se reabrieron. La aplicación de pruebas tiene
# su URL de Webhooks apuntada al receptor de la sonda 08, pero la URL de IPN
# se configura sólo en el panel, y tocarlo necesita OK del owner. Esta sonda
# mide lo que SÍ se puede sin panel: la `notification_url` por recurso.
#
# LA SECUENCIA (90 s entre acciones, instante de ENVÍO anotado)
# -------------------------------------------------------------
#   1  crear preapproval autorizado, CON `notification_url` marcada
#      (control: la sonda 01 midió que vuelve null; si algo llega con la
#      marca, el canal por recurso existe para suscripciones)
#   2  SUBIR el monto 2500 → 3500 (EX-54 mide el correo; acá sólo el aviso)
#   3  pausar · 4 reanudar · 5 cancelar
#   6  pago por /v1/payments con `notification_url` SIN `source_news`
#   7  pago por /v1/payments con `notification_url?source_news=webhooks`
#   8  pago por /v1/payments con `notification_url?source_news=ipn`
#      (6-8: ¿el proveedor INTERPRETA `source_news`, o es sólo nuestra marca?)
#   9  orden por /v1/orders con `notification_url` (si la rechaza, se anota y
#      se crea sin ella)
#  10  preapproval autorizado con tarjeta RECHAZADA (titular OTHE): ¿el
#      proveedor lo cancela solo, y avisa? (mecanismo de WH-5 en sandbox)
#
# Cada URL lleva `canal=<paso>&run=<STAMP>`: así una entrega se atribuye por
# la URL que la recibió, sin inferencias.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-52-los-dos-canales.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
SINK="${SINK_URL:-https://hos1352-webhook-sink.qazuor.workers.dev}"
OUT="${OUT_DIR:-/tmp/mp-probe-52}"
ESPERA="${ESPERA:-90}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante_envio\tpaso\taccion\thttp\trecurso\testado_releido\n' > "$BITACORA"
echo "run=$STAMP" > "$OUT/run.txt"

H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')

nurl() { printf '%s/?canal=%s&run=%s%s' "$SINK" "$1" "$STAMP" "${2:-}"; }

anotar() { # <instante> <paso> <accion> <http> <recurso> <estado>
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$BITACORA"
  printf '  %-4s %-34s HTTP %-3s %-34s → %s   [enviada %s]\n' "$2" "$3" "$4" "$5" "$6" "$1"
}

tokenizar() { # <titular>
  curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw "$(jq -cn --arg n "$1" '{
    card_number:"5031755734530604", security_code:"123", expiration_month:11, expiration_year:2030,
    cardholder:{name:$n, identification:{type:"DNI", number:"12345678"}}}')" | jq -r '.id // empty'
}

# Un 429 local_rate_limited no es respuesta del negocio (sonda 09): se reintenta.
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

echo "############ SONDA 52 — los dos canales · $(date -Is) · run=$STAMP"

# --- 1. crear, con notification_url marcada ----------------------------------
TOK=$(tokenizar APRO); [ -n "$TOK" ] || { echo "no se pudo tokenizar"; exit 1; }
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg x "HOS-1352-s52-$STAMP" --arg u "$(nurl 01-preapproval)" '{
  reason:"HOS1352 sonda 52", payer_email:$e, back_url:"https://www.hospeda.com.ar",
  external_reference:$x, card_token_id:$t, status:"authorized", notification_url:$u,
  auto_recurring:{frequency:1, frequency_type:"months", transaction_amount:2500, currency_id:"ARS"}}')
T=$(date -Ins); code=$(llamar POST "$API/preapproval" "$OUT/01-crear.json" "$BODY")
ID=$(jq -r '.id // empty' "$OUT/01-crear.json")
[ -n "$ID" ] || { jq -c . "$OUT/01-crear.json"; exit 1; }
curl -sS "${H[@]}" "$API/preapproval/$ID" > "$OUT/01-relectura.json"
anotar "$T" 01 "crear preapproval" "$code" "$ID" \
  "$(jq -r '"\(.status) · notification_url=\(.notification_url // "null")"' "$OUT/01-relectura.json")"

paso_pa() { # <paso> <accion> <json>
  sleep "$ESPERA"
  local t c
  t=$(date -Ins); c=$(llamar PUT "$API/preapproval/$ID" "$OUT/$1.json" "$3")
  anotar "$t" "$1" "$2" "$c" "$ID" "$(curl -sS "${H[@]}" "$API/preapproval/$ID" \
    | jq -r '"\(.status)/\(.auto_recurring.transaction_amount)"')"
}
paso_pa 02 "subir monto 2500 → 3500" '{"auto_recurring":{"transaction_amount":3500,"currency_id":"ARS"}}'
paso_pa 03 "pausar"   '{"status":"paused"}'
paso_pa 04 "reanudar" '{"status":"authorized"}'
paso_pa 05 "cancelar" '{"status":"cancelled"}'

# --- 6-8. pagos con notification_url -----------------------------------------
pago() { # <paso> <sufijo-url> <descripcion>
  sleep "$ESPERA"
  local tok t c pid
  tok=$(tokenizar APRO)
  t=$(date -Ins)
  c=$(llamar POST "$API/v1/payments" "$OUT/$1.json" "$(jq -cn --arg t "$tok" --arg e "$MP_BUYER_EMAIL" \
      --arg u "$(nurl "$1-pago" "$2")" --arg x "HOS-1352-s52-$STAMP-$1" '{
      transaction_amount:100, token:$t, installments:1, payment_method_id:"master",
      description:"HOS1352 sonda 52", external_reference:$x, notification_url:$u,
      payer:{email:$e}}')" "s52-$STAMP-$1")
  pid=$(jq -r '.id // "?"' "$OUT/$1.json")
  anotar "$t" "$1" "$3" "$c" "$pid" "$(jq -r '"\(.status // .message)"' "$OUT/$1.json")"
}
pago 06 ""                      "pago · nurl sin source_news"
pago 07 "&source_news=webhooks" "pago · nurl source_news=webhooks"
pago 08 "&source_news=ipn"      "pago · nurl source_news=ipn"

# --- 9. orden por /v1/orders --------------------------------------------------
sleep "$ESPERA"
TOK=$(tokenizar APRO)
ORD=$(jq -cn --arg t "$TOK" --arg e "$MP_BUYER_EMAIL" --arg x "HOS-1352-s52-$STAMP-09" --arg u "$(nurl 09-orden)" '{
  type:"online", external_reference:$x, total_amount:"100.00", processing_mode:"automatic",
  notification_url:$u, payer:{email:$e},
  transactions:{payments:[{amount:"100.00", payment_method:{id:"master", type:"credit_card", token:$t, installments:1}}]}}')
T=$(date -Ins); code=$(llamar POST "$API/v1/orders" "$OUT/09-orden.json" "$ORD" "s52-$STAMP-09")
if [ "${code:0:1}" != "2" ]; then
  anotar "$T" 09 "orden CON notification_url" "$code" "-" "$(jq -c '.errors // .message // .' "$OUT/09-orden.json" | cut -c1-120)"
  TOK=$(tokenizar APRO)
  ORD=$(printf '%s' "$ORD" | jq -c --arg t "$TOK" 'del(.notification_url) | .transactions.payments[0].payment_method.token=$t')
  T=$(date -Ins); code=$(llamar POST "$API/v1/orders" "$OUT/09b-orden.json" "$ORD" "s52-$STAMP-09b")
  anotar "$T" 09b "orden SIN notification_url" "$code" "$(jq -r '.id // "?"' "$OUT/09b-orden.json")" \
    "$(jq -r '"\(.status) · pago \(.transactions.payments[0].id // "?")"' "$OUT/09b-orden.json")"
else
  anotar "$T" 09 "orden CON notification_url" "$code" "$(jq -r '.id // "?"' "$OUT/09-orden.json")" \
    "$(jq -r '"\(.status) · pago \(.transactions.payments[0].id // "?")"' "$OUT/09-orden.json")"
fi

# --- 10. preapproval con tarjeta rechazada ------------------------------------
sleep "$ESPERA"
TOK=$(tokenizar OTHE)
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg x "HOS-1352-s52-$STAMP-10" --arg u "$(nurl 10-rechazada)" '{
  reason:"HOS1352 sonda 52 rechazada", payer_email:$e, back_url:"https://www.hospeda.com.ar",
  external_reference:$x, card_token_id:$t, status:"authorized", notification_url:$u,
  auto_recurring:{frequency:1, frequency_type:"months", transaction_amount:2500, currency_id:"ARS"}}')
T=$(date -Ins); code=$(llamar POST "$API/preapproval" "$OUT/10-rechazada.json" "$BODY")
RID=$(jq -r '.id // empty' "$OUT/10-rechazada.json")
anotar "$T" 10 "preapproval tarjeta OTHE" "$code" "${RID:--}" "$(jq -r '"\(.status // .message)"' "$OUT/10-rechazada.json")"
echo "${RID:-}" > "$OUT/id-rechazada.txt"
if [ -n "$RID" ]; then
  for s in 30 90 180; do
    sleep "$s"
    anotar "$(date -Ins)" "10+" "relectura rechazada" "-" "$RID" \
      "$(curl -sS "${H[@]}" "$API/preapproval/$RID" | jq -r '"\(.status) · mod \(.last_modified)"')"
  done
fi

echo; column -t -s$'\t' "$BITACORA"
echo "$ID" > "$OUT/id-preapproval.txt"
echo "############ FIN · $(date -Is) · leer el receptor filtrando run=$STAMP y los ids de la bitácora"
