#!/usr/bin/env bash
# =============================================================================
# SONDA 59 — EX-58: ¿la devolución de una orden es idempotente, y se relee por id?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Mediciones del 2026-09-30. Pregunta EX-58 sobre
# `POST /v1/orders/{id}/refund` (Orders API, sandbox):
#   (1) ¿EXIGE `X-Idempotency-Key`? (llamada sin la cabecera)
#   (2) ¿la RESPETA? misma clave + mismo cuerpo → ¿mismo REF…? misma clave +
#       otro monto → ¿rechazo, la primera, u otra devolución?
#   (3) la relectura `GET /v1/orders/{id}` ¿nombra cada devolución por id y con
#       su monto propio? Dos parciales del MISMO monto (caso RF3) ¿se distinguen?
#   (+) ¿la respuesta del POST trae el id `REF…` o sólo la relectura?
#
# Condiciona RF2/RF3 (.specs/HOS-1354-.../docs/03*.md §6.1) y la revocación del
# addon de única vez (B/22 §2.2, DEC-RF-001). Evidencia previa: sonda 56 pasos
# 56·07/56·09 (201, `REF01M3PW…` sin decir de dónde salió).
#
# LA SECUENCIA (todas sobre órdenes creadas acá; sin cancelar nada ajeno)
#   01 orden aprobada O1, ARS 100
#   02 parcial 10 de O1 SIN clave                          (pregunta 1)
#   03 parcial 30 de O1 con clave K1                       (pregunta 2, base)
#   04 parcial 30 de O1 con clave K1, MISMO cuerpo          (pregunta 2a)
#   05 parcial 25 de O1 con clave K1, OTRO monto            (pregunta 2b)
#   06 parcial 30 de O1 con clave K2 (otra)                 (RF3: dos del mismo monto)
#   07 relectura de O1 (inmediata), 08 a +2 min, 09 a +10 min
#   10 orden aprobada O2, ARS 100
#   11 reembolso TOTAL de O2 SIN cuerpo y SIN clave         (pregunta 1, otra forma)
#   12 relectura de O2
#   13 control: POST refund sobre una orden INEXISTENTE (id basura), con clave
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=... bash probe-59-ex58-devolucion-idempotente.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-59}"
ESPERA="${ESPERA:-5}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

# Guard de entorno (sonda 42/56): sólo corre contra la cuenta de PRUEBAS.
curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me" | jq -e '.tags | index("test_user")' >/dev/null \
  || { echo "ABORTA: las credenciales no son de la cuenta de pruebas"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante_envio\tpaso\taccion\thttp\trecurso\tresultado\n' > "$BITACORA"
echo "run=$STAMP" > "$OUT/run.txt"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')
MASTER="5031755734530604"   # Mastercard de prueba MLA (sondas 51/52)
K1="s59-$STAMP-K1"
K2="s59-$STAMP-K2"

anotar() {
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$BITACORA"
  printf '  %-3s %-44s HTTP %-3s %-34s → %s\n' "$2" "$3" "$4" "$5" "$6"
}
tokenizar() {
  curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw "$(jq -cn --arg num "$MASTER" '{
    card_number:$num, security_code:"123", expiration_month:11, expiration_year:2030,
    cardholder:{name:"APRO", identification:{type:"DNI", number:"12345678"}}}')" | jq -r '.id // empty'
}
# <metodo> <url> <archivo> <cuerpo|-> [clave|-]   ('-' = sin cuerpo / sin clave)
llamar() {
  local code n=0 espera=5 extra=() data=()
  [ "${5:--}" != "-" ] && extra=(-H "X-Idempotency-Key: $5")
  [ "$4" != "-" ] && data=(--data-raw "$4")
  while : ; do
    code=$(curl -sS -D "$3.headers" -o "$3" -w '%{http_code}' -X "$1" "$2" "${H[@]}" "${extra[@]}" "${data[@]}")
    [ "$code" = "429" ] || break
    n=$((n + 1)); [ "$n" -le 5 ] || break
    sleep "$espera"; espera=$((espera * 2))
  done
  printf '%s' "$code"
}
# Resumen de refunds de una respuesta (POST o GET).
refunds_de() {
  jq -c '{status, status_detail, refunded_amount: (.transactions.payments[0].refunded_amount // .refunded_amount // null),
    refunds: [.transactions.refunds[]? | {id, transaction_id, amount, status, reference_id}],
    err: (.errors // .message // null)}' "$1" 2>/dev/null | cut -c1-400
}
orden() { # <paso> <accion>
  local tok t c
  tok=$(tokenizar)
  t=$(date -Ins)
  c=$(llamar POST "$API/v1/orders" "$OUT/$1.json" "$(jq -cn --arg t "$tok" --arg e "$MP_BUYER_EMAIL" --arg x "HOS-1352-s59-$STAMP-$1" '{
    type:"online", external_reference:$x, total_amount:"100.00", processing_mode:"automatic", payer:{email:$e},
    transactions:{payments:[{amount:"100.00", payment_method:{id:"master", type:"credit_card", token:$t, installments:1}}]}}')" "s59-$STAMP-$1")
  anotar "$t" "$1" "$2" "$c" "$(jq -r '.id // "?"' "$OUT/$1.json")" \
    "$(jq -r '"\(.status // .message)/\(.status_detail // "-") · pago \(.transactions.payments[0].id // "?")"' "$OUT/$1.json")"
}
reembolso() { # <paso> <orden-id> <cuerpo|-> <clave|-> <accion>
  sleep "$ESPERA"
  local t c
  t=$(date -Ins); c=$(llamar POST "$API/v1/orders/$2/refund" "$OUT/$1.json" "$3" "$4")
  anotar "$t" "$1" "$5" "$c" "$2" "$(refunds_de "$OUT/$1.json")"
}
releer() { # <paso> <orden-id> <accion>
  local t c
  t=$(date -Ins); c=$(llamar GET "$API/v1/orders/$2" "$OUT/$1.json" - -)
  anotar "$t" "$1" "$3" "$c" "$2" "$(refunds_de "$OUT/$1.json")"
}
parcial() { jq -cn --arg id "$1" --arg a "$2" '{transactions:[{id:$id, amount:$a}]}'; }

echo "############ SONDA 59 · $(date -Is) · run=$STAMP"

orden 01 "orden aprobada O1 (100)"
O1=$(jq -r '.id // empty' "$OUT/01.json"); TX1=$(jq -r '.transactions.payments[0].id // empty' "$OUT/01.json")
[ -n "$O1" ] && [ -n "$TX1" ] || { echo "ABORTA: no se creó O1"; cat "$OUT/01.json"; exit 1; }

reembolso 02 "$O1" "$(parcial "$TX1" 10.00)" -   "parcial 10 SIN clave"
reembolso 03 "$O1" "$(parcial "$TX1" 30.00)" "$K1" "parcial 30 clave K1"
reembolso 04 "$O1" "$(parcial "$TX1" 30.00)" "$K1" "parcial 30 clave K1 MISMO cuerpo"
reembolso 05 "$O1" "$(parcial "$TX1" 25.00)" "$K1" "parcial 25 clave K1 OTRO monto"
reembolso 06 "$O1" "$(parcial "$TX1" 30.00)" "$K2" "parcial 30 clave K2 (RF3 mismo monto)"
releer 07 "$O1" "relectura O1 inmediata"

orden 10 "orden aprobada O2 (100)"
O2=$(jq -r '.id // empty' "$OUT/10.json")
reembolso 11 "$O2" - - "TOTAL sin cuerpo y SIN clave"
releer 12 "$O2" "relectura O2"
reembolso 13 "ORDTST01ZZZZZZZZZZZZZZZZZZZZZZZZ" "$(parcial "$TX1" 1.00)" "s59-$STAMP-basura" "control: orden inexistente"

sleep 120; releer 08 "$O1" "relectura O1 +2 min"
sleep 480; releer 09 "$O1" "relectura O1 +10 min"; releer 14 "$O2" "relectura O2 +10 min"

echo; column -t -s$'\t' "$BITACORA"
echo "############ FIN · $(date -Is) · run=$STAMP · O1=$O1 O2=$O2"
