#!/usr/bin/env bash
# =============================================================================
# SONDA 02 — Ciclo de vida de una suscripción AUTORIZADA
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Cubre las filas de 06-mp-validation-matrix.md que
# requieren una suscripción efectivamente autorizada por el pagador.
#
# La autorización se consigue por API con un card_token, sin pasar por el
# navegador: POST /preapproval con card_token_id + status "authorized".
#
# Credenciales por entorno. NUNCA en el repo.
#   source <fuera-del-repo>/creds.sh && bash probe-02-authorized-lifecycle.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-02}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_PUBLIC_KEY:?falta MP_PUBLIC_KEY}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

BACK_URL="https://www.hospeda.com.ar"

n=0
call() { # <nombre> <metodo> <path> [body]
  n=$((n + 1))
  local name="$1" method="$2" path="$3" body="${4:-}" tag code
  tag="$(printf '%02d' "$n")-${name}"
  if [ -n "$body" ]; then
    printf '%s' "$body" > "$OUT/$tag.request.json"
    code=$(curl -sS -o "$OUT/$tag.response.json" -w '%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-raw "$body")
  else
    printf '(sin body) %s %s\n' "$method" "$path" > "$OUT/$tag.request.json"
    code=$(curl -sS -o "$OUT/$tag.response.json" -w '%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN")
  fi
  echo "$code" > "$OUT/$tag.status"
  printf '\n=== %s → HTTP %s\n' "$tag" "$code"
  jq -c 'if type=="object" then
           {id, status, reason, next_payment_date, date_created, last_modified,
            payment_method_id, card_id, auto_recurring, summarized,
            message, error, cause} | with_entries(select(.value != null))
         else . end' "$OUT/$tag.response.json" 2>/dev/null || head -c 500 "$OUT/$tag.response.json"
}

echo "############ SONDA 02 — ciclo de vida autorizado · $(date -Is) · salida: $OUT"

# --- paso 0: tokenizar una tarjeta de prueba --------------------------------
# Tarjeta de prueba de Argentina. El nombre "APRO" fuerza aprobación.
echo; echo "######## paso 0 — tokenizar tarjeta de prueba"
CARD=$(jq -cn '{
  card_number:"5031755734530604", security_code:"123",
  expiration_month:11, expiration_year:2030,
  cardholder:{name:"APRO", identification:{type:"DNI", number:"12345678"}}}')
printf '%s' "$CARD" | sed 's/"card_number":"[0-9]*"/"card_number":"(redactado)"/' > "$OUT/00-card-token.request.json"
curl -sS -o "$OUT/00-card-token.response.json" \
  -X POST "$API/v1/card_tokens?public_key=$MP_PUBLIC_KEY" \
  -H 'Content-Type: application/json' --data-raw "$CARD"
CARD_TOKEN=$(jq -r '.id // empty' "$OUT/00-card-token.response.json")
if [ -z "$CARD_TOKEN" ]; then
  echo "!! no se pudo tokenizar. Respuesta:"; jq -c '{status,message,error,cause}' "$OUT/00-card-token.response.json"
  echo "!! sin card_token no hay autorización por API: abortando."
  exit 1
fi
echo "card_token obtenido: ${CARD_TOKEN:0:8}… (se redacta)"

# --- PA-3: crear YA AUTORIZADA ----------------------------------------------
echo; echo "######## PA-3 — crear un preapproval ya autorizado"
AUTH_BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg b "$BACK_URL" --arg t "$CARD_TOKEN" '{
  reason:"HOS1352 autorizada", payer_email:$e, back_url:$b, status:"authorized",
  external_reference:"HOS-1352-auth-01", card_token_id:$t,
  auto_recurring:{frequency:1, frequency_type:"months",
                  transaction_amount:1500, currency_id:"ARS"}}')
call "PA3-crear-autorizada" POST /preapproval "$AUTH_BODY"
SUB=$(jq -r '.id // empty' "$OUT/01-PA3-crear-autorizada.response.json")
if [ -z "$SUB" ]; then echo "!! no se creó la autorizada: abortando."; exit 1; fi
echo "   suscripción autorizada: $SUB"

# --- PC-1 / PC-3: mutar el monto sobre una AUTORIZADA ------------------------
echo; echo "######## PC-1 + PC-3 — cambiar el monto de una suscripción autorizada"
call "PC1-subir-monto"  PUT "/preapproval/$SUB" \
  '{"auto_recurring":{"transaction_amount":2200,"currency_id":"ARS"}}'
call "PC1-verificar"    GET "/preapproval/$SUB"
echo "   -- ¿y bajarlo? (mecanismo candidato de cortesía, BD-MP-02) --"
call "CT2-bajar-monto"  PUT "/preapproval/$SUB" \
  '{"auto_recurring":{"transaction_amount":15,"currency_id":"ARS"}}'
echo "   -- ¿y a cero? --"
call "CT2-monto-cero"   PUT "/preapproval/$SUB" \
  '{"auto_recurring":{"transaction_amount":0,"currency_id":"ARS"}}'
call "PC1-restaurar"    PUT "/preapproval/$SUB" \
  '{"auto_recurring":{"transaction_amount":1500,"currency_id":"ARS"}}'

# --- EX-4: cambiar la FRECUENCIA sobre una autorizada ------------------------
echo; echo "######## EX-4 — cambiar el ciclo sobre una suscripción autorizada"
call "EX4-cambiar-frecuencia" PUT "/preapproval/$SUB" \
  '{"auto_recurring":{"frequency":12,"frequency_type":"months","transaction_amount":14000,"currency_id":"ARS"}}'
call "EX4-verificar" GET "/preapproval/$SUB"

# --- PS-1..PS-6: pausa -------------------------------------------------------
echo; echo "######## PS-1..PS-6 — pausar y reanudar"
call "PS1-pausar"        PUT "/preapproval/$SUB" '{"status":"paused"}'
call "PS1-verificar"     GET "/preapproval/$SUB"
call "PS3-reanudar"      PUT "/preapproval/$SUB" '{"status":"authorized"}'
call "PS5-fechas-tras-reanudar" GET "/preapproval/$SUB"

# --- RC-2: historial de pagos de la suscripción ------------------------------
echo; echo "######## RC-2 — historial de pagos"
call "RC2-pagos-por-sub" GET "/v1/payments/search?preapproval_id=$SUB"

# --- EX-8: ¿se respeta la primera fecha corrida TRAS autorizar? --------------
echo; echo "######## EX-8 — start_date futura sobre una suscripción AUTORIZADA"
CARD2=$(jq -cn '{
  card_number:"4509953566233704", security_code:"123",
  expiration_month:11, expiration_year:2030,
  cardholder:{name:"APRO", identification:{type:"DNI", number:"12345678"}}}')
curl -sS -o "$OUT/00b-card-token2.response.json" \
  -X POST "$API/v1/card_tokens?public_key=$MP_PUBLIC_KEY" \
  -H 'Content-Type: application/json' --data-raw "$CARD2"
TOKEN2=$(jq -r '.id // empty' "$OUT/00b-card-token2.response.json")
FUTURE=$(date -u -d '+20 days' +%Y-%m-%dT%H:%M:%S.000Z)
echo "   start_date solicitada: $FUTURE"
DEFERRED=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg b "$BACK_URL" --arg t "$TOKEN2" --arg d "$FUTURE" '{
  reason:"HOS1352 corrida 20d", payer_email:$e, back_url:$b, status:"authorized",
  external_reference:"HOS-1352-auth-diferida", card_token_id:$t,
  auto_recurring:{frequency:1, frequency_type:"months", start_date:$d,
                  transaction_amount:1500, currency_id:"ARS"}}')
call "EX8-autorizada-con-fecha-corrida" POST /preapproval "$DEFERRED"
SUB2=$(jq -r '.id // empty' "$OUT/*EX8*.response.json" 2>/dev/null \
  || jq -r '.id // empty' "$OUT/$(ls "$OUT" | grep EX8 | grep response | head -1)")
[ -n "${SUB2:-}" ] && call "EX8-verificar" GET "/preapproval/$SUB2"

# --- EX-6: N autorizadas conviviendo del mismo pagador -----------------------
echo; echo "######## EX-6 — ¿conviven dos suscripciones autorizadas del mismo pagador?"
echo "   (las dos anteriores ya son dos autorizadas del mismo payer_email)"
call "EX6-listar-autorizadas" GET "/preapproval/search?status=authorized"

# --- CN-1 / CN-2: cancelación de una autorizada ------------------------------
echo; echo "######## CN-1 + CN-2 — cancelar una suscripción autorizada"
call "CN2-cancelar"  PUT "/preapproval/$SUB" '{"status":"cancelled"}'
call "CN2-verificar" GET "/preapproval/$SUB"
echo "   -- ¿se puede reanudar una cancelada? --"
call "CN2-reanimar"  PUT "/preapproval/$SUB" '{"status":"authorized"}'

echo; echo "############ FIN. Requests y responses en $OUT"
echo "############ autorizadas creadas: $SUB ${SUB2:-}"
