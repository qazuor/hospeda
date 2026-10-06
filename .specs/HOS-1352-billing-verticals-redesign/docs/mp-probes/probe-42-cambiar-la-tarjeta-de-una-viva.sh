#!/usr/bin/env bash
# =============================================================================
# SONDA 42 — Cambiarle la tarjeta a una suscripción viva
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352.
#
# QUÉ MIDE, Y POR QUÉ ASÍ
# -----------------------
# Dos preguntas con un solo experimento.
#
# (1) ¿Se le puede cambiar el MEDIO DE PAGO a una suscripción existente, sin
#     recrearla? La doc oficial del `PUT /preapproval/{id}` dice que acepta
#     `card_token_id` y que sirve para actualizar «el motivo, monto, medio de
#     pago, status». Nadie lo midió. Importa por sí solo: a un cliente se le
#     vence la tarjeta o se la roban, y si esto no anda la única salida es
#     cancelar y rehacer la suscripción pasando de nuevo por el checkout.
#
# (2) ¿Cómo se porta el proveedor ante un COBRO FALLIDO? No se puede medir
#     porque no se puede fabricar: las tarjetas de prueba que rechazan mueren
#     en el ALTA con `400 CC_VAL_433` (`PA-4`), porque dar de alta con
#     `status:"authorized"` valida cobrando en ese mismo momento. El rodeo es
#     dar de alta con la tarjeta buena —ya hecho, la suscripción está viva y
#     lleva dos cobros— y cambiársela DESPUÉS por una que rechaza. Si entra, el
#     cobro del ciclo siguiente falla y ahí recién se puede mirar qué hace el
#     proveedor: si reintenta, cuántas veces, en qué estado deja la suscripción,
#     si avisa por webhook, y a dónde la manda al agotar los reintentos.
#
# Medido antes de escribir esto: los cardholders de rechazo (`FUND`, `OTHE`,
# `CALL`, `CONT`) **tokenizan sin objeción** (`status: active` los cuatro). O
# sea el bloqueo de `PA-4` no es de la tarjeta ni del token: es del alta.
#
# CÓMO SE VERIFICA — no alcanza el 200
# ------------------------------------
# El §0 ya mordió nueve veces: un `2xx` no prueba que el cambio se aplicó, y
# `EX-34` midió que sobre una suscripción viva las fechas devuelven `200` sin
# escribir nada y sin mover `last_modified`. Acá el delator es **`card_id`**,
# que el preapproval expone. Se compara campo por campo antes y después, y
# `last_modified` es la prueba de que el proveedor escribió algo.
#
# GUARD DE ENTORNO — la lección del 2026-09-16
# --------------------------------------------
# `EX-14` midió que **`live_mode: true` no distingue sandbox de producción**, y
# el token es `APP_USR-` en los dos. En esta misma máquina conviven las
# credenciales de producción, donde el reloj tiene una TARJETA REAL. Un `source`
# del archivo equivocado y este mismo script, con la misma salida `200`, muta
# una suscripción real. Lo que SÍ distingue es `GET /users/me`: la cuenta de
# pruebas trae `tags: ["test_user", ...]`. Este script **aborta** si no lo ve.
#
#   OUT_DIR=/tmp/mp-probe-42 bash probe-42-cambiar-la-tarjeta-de-una-viva.sh
#   OUT_DIR=/tmp/mp-probe-42 TITULAR=OTHE bash probe-42-...       # otro rechazo
#   OUT_DIR=/tmp/mp-probe-42 REVERTIR=1 bash probe-42-...         # vuelve a APRO
#
# Credenciales por entorno. NUNCA en el repo. El número de la tarjeta de prueba
# se lee de la sonda 05: no se escribe acá ni se imprime.
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-42}"
SUJETO="${SUJETO:-0e678ead9616489e976c13ef22a1f0ae}"   # renov-falla3
TITULAR="${TITULAR:-FUND}"
REVERTIR="${REVERTIR:-0}"
[ "$REVERTIR" = "1" ] && TITULAR="APRO"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_PUBLIC_KEY:?falta MP_PUBLIC_KEY}"

mkdir -p "$OUT"
AHORA="$(date -u +%Y%m%dT%H%M%SZ)"

echo "############ SONDA 42 — cambiarle la tarjeta a una viva · $(date -Is)"
echo "############ sujeto: $SUJETO · titular: $TITULAR"

# --- guard de entorno -------------------------------------------------------
# No se muta nada hasta saber de quién es la cuenta. Un error acá cuesta plata
# real, y la respuesta del proveedor no avisa (`EX-14`).
yo=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me")
printf '%s' "$yo" > "$OUT/$AHORA.users-me.json"
es_test=$(printf '%s' "$yo" | jq -r '[.tags[]? | select(. == "test_user")] | length')
nick=$(printf '%s' "$yo" | jq -r '.nickname // "?"')
mail=$(printf '%s' "$yo" | jq -r '.email // "?"')
echo "############ cuenta: $nick · $mail"
if [ "$es_test" != "1" ]; then
  echo
  echo "  ✋ ABORTA: la cuenta NO tiene el tag 'test_user'."
  echo "     Esta sonda muta una suscripción y hace que un cobro FALLE."
  echo "     Sobre una cuenta productiva eso toca plata de un cliente real."
  echo "     Si de verdad querés correrla acá, es una decisión del dueño, no del script."
  exit 2
fi
echo "############ ✅ cuenta de pruebas — se puede mutar"

# Resumen canónico: si un campo no entra acá, no se puede afirmar que cambió.
RESUMEN='{status, card_id, payment_method_id, payer_id,
          monto: .auto_recurring.transaction_amount,
          ciclo: "\(.auto_recurring.frequency) \(.auto_recurring.frequency_type)",
          next_payment_date, last_modified,
          cobros: .summarized.charged_quantity,
          cobrado_total: .summarized.charged_amount,
          intentos_pendientes: .summarized.pending_charge_quantity,
          monto_pendiente: .summarized.pending_charge_amount}'

leer() { curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$SUJETO"; }

echo
echo "=== ANTES ==="
antes=$(leer); printf '%s' "$antes" > "$OUT/$AHORA.antes.json"
printf '%s' "$antes" | jq -c "$RESUMEN"

# --- tokenizar --------------------------------------------------------------
# Un token se usa UNA SOLA VEZ (`EX-12`): cada corrida tokeniza de nuevo.
# `TARJETA=visa` usa OTRA tarjeta física. Es la única forma de contestar si
# `card_id` cambia: con la misma Mastercard el proveedor reusa el mismo id y el
# delator no se mueve, aunque el cambio se haya aplicado.
if [ "${TARJETA:-master}" = "visa" ]; then
  NUM="4509953566233704"   # Visa crédito MLA, catálogo público de prueba de MP
else
  NUM=$(grep -oP 'card_number:"\K[0-9]+' "$(dirname "$0")/probe-05-arrancar-el-reloj.sh" | head -1)
fi
[ -n "$NUM" ] || { echo "no pude leer la tarjeta de prueba de la sonda 05"; exit 1; }

echo
echo "=== TOKENIZAR ($TITULAR) ==="
tok_resp=$(curl -sS -X POST "$API/v1/card_tokens?public_key=$MP_PUBLIC_KEY" \
  -H 'Content-Type: application/json' \
  --data-raw "$(jq -nc --arg n "$TITULAR" --arg num "$NUM" \
    '{card_number:$num, security_code:"123", expiration_month:11, expiration_year:2030,
      cardholder:{name:$n, identification:{type:"DNI", number:"12345678"}}}')")
TOK=$(printf '%s' "$tok_resp" | jq -r '.id // empty')
if [ -z "$TOK" ]; then
  echo "  ✋ no se pudo tokenizar: $(printf '%s' "$tok_resp" | jq -c '{message, cause}')"
  exit 1
fi
echo "  token creado (redactado) · titular $(printf '%s' "$tok_resp" | jq -r '.cardholder.name') · last4 $(printf '%s' "$tok_resp" | jq -r '.last_four_digits')"

# --- el PUT -----------------------------------------------------------------
# Un solo campo. `EX-20` midió que un PUT con varios campos se aplica A MEDIAS
# con un solo 200, así que mandar el token solo es lo único interpretable.
echo
echo "=== PUT card_token_id ==="
code=$(curl -sS -o "$OUT/$AHORA.put.json" -w '%{http_code}' -X PUT "$API/preapproval/$SUJETO" \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data-raw "$(jq -nc --arg t "$TOK" '{card_token_id:$t}')")
echo "  HTTP $code · $(jq -c 'if .message then {message, error, cause} else {card_id, payment_method_id} end' "$OUT/$AHORA.put.json")"

# --- la relectura, que es lo único que decide -------------------------------
sleep 2
echo
echo "=== DESPUÉS (relectura) ==="
despues=$(leer); printf '%s' "$despues" > "$OUT/$AHORA.despues.json"
printf '%s' "$despues" | jq -c "$RESUMEN"

echo
echo "=== DELTA campo por campo ==="
a=$(printf '%s' "$antes"   | jq -c "$RESUMEN")
b=$(printf '%s' "$despues" | jq -c "$RESUMEN")
if [ "$a" = "$b" ]; then
  echo "  → SIN CAMBIOS. El 200 no escribió nada: otro caso del §0."
  echo "    Y ojo: 'last_modified' tampoco se movió, que es la prueba dura."
else
  jq -n --argjson a "$a" --argjson b "$b" \
    '[$b | to_entries[] | select(.value != $a[.key])
      | "  \(.key): \($a[.key] | tostring) → \(.value | tostring)"] | .[]' -r
fi

cat <<TXT

############ FIN · $(date -Is)

  Lo que decide la pregunta (1) es si **card_id** cambió. Si cambió, el medio de
  pago de una suscripción viva SE PUEDE actualizar sin recrearla.

  Lo que decide la pregunta (2) es el cobro del ciclo siguiente, que NO se ve
  hoy: hay que releer el sujeto después de su next_payment_date. Con 33 minutos
  de lag medidos el 2026-09-16, conviene leer bien pasada la hora.

  Para volver atrás: REVERTIR=1, que le pone un token APRO de nuevo.
TXT
