#!/usr/bin/env bash
# =============================================================================
# SONDA 03 — ¿Se puede recrear una suscripción sin pedir la tarjeta de nuevo?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Es la sonda que decide `DEC-SUB-005`: si el cambio de
# ciclo se puede hacer cancelando y recreando, hace falta saber cuánta fricción
# le cuesta al cliente. Cubre las filas EX-9 y EX-10.
#
# Contexto: EX-4 salió NOT_SUPPORTED — el ciclo de una suscripción autorizada
# no se puede mutar. La salida es cancelar y recrear, y eso necesita un
# card_token. La pregunta es si ese token se puede sacar de la tarjeta que el
# cliente YA autorizó, sin que la vuelva a cargar entera.
#
# Credenciales por entorno. NUNCA en el repo.
#   CARD_ID=<id de una tarjeta guardada> \
#   source <fuera-del-repo>/creds.sh && bash probe-03-saved-card-recreate.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-03}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"
: "${CARD_ID:?falta CARD_ID — el id de una tarjeta ya guardada por una suscripción autorizada}"

FUTURE=$(date -u -d '+18 days' +%Y-%m-%dT%H:%M:%S.000Z)

echo "############ SONDA 03 — recrear con tarjeta guardada · $(date -Is)"
echo "############ salida: $OUT · card_id: $CARD_ID"

# Dos variantes de tokenización, y para cada una la prueba REAL: crear la
# suscripción. Un 201 al tokenizar no prueba que el token sirva — de hecho una
# de las dos variantes devuelve 201 y después falla.
for variant in "sin-cvv" "con-cvv"; do
  echo; echo "######## variante: $variant"

  if [ "$variant" = "sin-cvv" ]; then
    BODY="{\"card_id\":\"$CARD_ID\"}"
  else
    BODY="{\"card_id\":\"$CARD_ID\",\"security_code\":\"123\"}"
  fi

  printf '%s' "$BODY" | sed 's/"security_code":"[0-9]*"/"security_code":"(redactado)"/' \
    > "$OUT/$variant-01-token.request.json"
  code=$(curl -sS -o "$OUT/$variant-01-token.response.json" -w '%{http_code}' \
    -X POST "$API/v1/card_tokens" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$BODY")
  TOK=$(jq -r '.id // empty' "$OUT/$variant-01-token.response.json")
  # nunca imprimir el token: este script queda versionado en el repo
  if [ -n "$TOK" ]; then TOKMSG="generado"; else TOKMSG="NO generado"; fi
  echo "  tokenizar        → HTTP $code · token: $TOKMSG"

  [ -z "$TOK" ] && { echo "  (sin token: no hay nada más que probar en esta variante)"; continue; }

  SUB_BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg d "$FUTURE" --arg v "$variant" '{
    reason: ("HOS1352 recrear " + $v), payer_email: $e,
    back_url: "https://www.hospeda.com.ar", status: "authorized",
    external_reference: ("HOS-1352-recrear-" + $v), card_token_id: $t,
    auto_recurring: {frequency: 3, frequency_type: "months", start_date: $d,
                     transaction_amount: 4000, currency_id: "ARS"}}')
  printf '%s' "$SUB_BODY" | sed 's/"card_token_id":"[^"]*"/"card_token_id":"(redactado)"/' \
    > "$OUT/$variant-02-preapproval.request.json"
  code=$(curl -sS -o "$OUT/$variant-02-preapproval.response.json" -w '%{http_code}' \
    -X POST "$API/preapproval" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$SUB_BODY")
  echo "  crear suscripción → HTTP $code"
  jq -c '{status, message} | with_entries(select(.value != null))' \
    "$OUT/$variant-02-preapproval.response.json"

  # LO QUE DECIDE: una relectura independiente. Un 2xx de este proveedor no
  # prueba que el cambio se haya aplicado — ya se midió tres veces.
  NEW=$(jq -r '.id // empty' "$OUT/$variant-02-preapproval.response.json")
  if [ -n "$NEW" ]; then
    curl -sS -o "$OUT/$variant-03-releer.response.json" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$NEW"
    echo -n "  RELECTURA         → "
    jq -c '{status,
            frequency: .auto_recurring.frequency,
            monto: .auto_recurring.transaction_amount,
            next_payment_date,
            cobrado_al_crear: .summarized.charged_quantity}' \
      "$OUT/$variant-03-releer.response.json"
  fi
done

echo; echo "############ FIN. Requests y responses en $OUT"
