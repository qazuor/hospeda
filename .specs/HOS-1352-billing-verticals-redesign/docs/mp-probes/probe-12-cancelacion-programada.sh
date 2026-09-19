#!/usr/bin/env bash
# =============================================================================
# SONDA 12 — ¿Existe la cancelación programada a fin de período?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Cubre `CN-1` y alimenta el §24 (cancelación) y
# `DEC-GRANT-001` / `DEC-ENT-004`, que cancelan sin reembolso.
#
# POR QUÉ IMPORTA
# ---------------
# El §24 distingue cancelar YA de cancelar AL FIN DEL PERÍODO. Lo primero está
# medido: `PA-5`, inmediato e irreversible. Lo segundo no, y la diferencia es
# grande: si el proveedor no lo soporta, hay que **emularlo** — dejar viva la
# suscripción y cancelarla con un cron el día que corresponde — con todo lo que
# eso implica (un cron que se cae deja cobrando a alguien que pidió la baja).
#
# QUÉ SE PRUEBA
# -------------
# `auto_recurring` acepta un `end_date`. Si se puede fijar sobre una
# suscripción autorizada, y el proveedor deja de cobrar en esa fecha, eso ES la
# cancelación programada y no hay nada que emular.
#
#   1. crear con `end_date` futura          → ¿se acepta?
#   2. fijar `end_date` sobre una ya viva   → ¿se acepta y QUEDA?
#   3. relectura campo por campo            → el 2xx no prueba nada (§0)
#   4. ¿en qué estado queda? ¿sigue `authorized`?
#
# Lo que esta sonda NO puede responder: si el proveedor **efectivamente** deja
# de cobrar al llegar esa fecha. Eso lo dice el reloj, no una llamada.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-12-cancelacion-programada.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-12}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

FIN=$(date -u -d '+3 days' +%Y-%m-%dT%H:%M:%S.000Z)
echo "############ SONDA 12 — cancelación programada · $(date -Is)"
echo "############ end_date de prueba: $FIN"

tokenizar() {
  curl -sS -X POST "$API/v1/card_tokens" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw '{"card_number":"5031755734530604","security_code":"123",
                 "expiration_month":11,"expiration_year":2030,
                 "cardholder":{"name":"APRO","identification":{"type":"DNI","number":"12345678"}}}' \
    | jq -r '.id // empty'
}

# Reintento ante 429: un `local_rate_limited` no es una respuesta del negocio.
llamar() { # <archivo> <metodo> <path> [body]
  local arch="$1" metodo="$2" ruta="$3" body="${4:-}" code espera=5 n=0
  while : ; do
    if [ -n "$body" ]; then
      code=$(curl -sS -o "$OUT/$arch.json" -w '%{http_code}' -X "$metodo" "$API$ruta" \
        -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
        --data-raw "$body")
    else
      code=$(curl -sS -o "$OUT/$arch.json" -w '%{http_code}' -X "$metodo" "$API$ruta" \
        -H "Authorization: Bearer $MP_ACCESS_TOKEN")
    fi
    [ "$code" = "429" ] || break
    n=$((n+1)); [ "$n" -le 5 ] || break
    echo "    (429 — reintento $n en ${espera}s)"; sleep "$espera"; espera=$((espera*2))
  done
  printf '%s' "$code"
}

resumen() { jq -c '{status, monto:.auto_recurring.transaction_amount,
                    end_date:.auto_recurring.end_date,
                    next_payment_date, message} | with_entries(select(.value != null))' "$1"; }

# --- 1. crear YA con end_date ------------------------------------------------
echo; echo "######## 1. crear directamente con end_date"
TOK="$(tokenizar)"
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" --arg f "$FIN" '{
  reason:"HOS1352 fin programado al crear", payer_email:$e,
  back_url:"https://www.hospeda.com.ar", external_reference:"HOS-1352-cn1-crear",
  card_token_id:$t, status:"authorized",
  auto_recurring:{frequency:1, frequency_type:"days", transaction_amount:2000,
                  currency_id:"ARS", end_date:$f}}')
code=$(llamar "01-crear-con-end-date" POST /preapproval "$BODY")
echo "  HTTP $code"; resumen "$OUT/01-crear-con-end-date.json"
A=$(jq -r '.id // empty' "$OUT/01-crear-con-end-date.json")
if [ -n "$A" ]; then
  llamar "02-relectura-A" GET "/preapproval/$A" >/dev/null
  echo -n "  RELECTURA: "; resumen "$OUT/02-relectura-A.json"
fi

# --- 2. fijar end_date sobre una ya viva -------------------------------------
echo; echo "######## 2. fijar end_date sobre una suscripción ya autorizada"
TOK="$(tokenizar)"
BODY=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$TOK" '{
  reason:"HOS1352 fin programado despues", payer_email:$e,
  back_url:"https://www.hospeda.com.ar", external_reference:"HOS-1352-cn1-despues",
  card_token_id:$t, status:"authorized",
  auto_recurring:{frequency:1, frequency_type:"days", transaction_amount:2000,
                  currency_id:"ARS"}}')
code=$(llamar "03-crear-simple" POST /preapproval "$BODY")
B=$(jq -r '.id // empty' "$OUT/03-crear-simple.json")
echo "  crear → HTTP $code · id: ${B:-—}"
if [ -n "$B" ]; then
  code=$(llamar "04-poner-end-date" PUT "/preapproval/$B" \
    "{\"auto_recurring\":{\"end_date\":\"$FIN\",\"currency_id\":\"ARS\",\"transaction_amount\":2000}}")
  echo "  fijar end_date → HTTP $code"; resumen "$OUT/04-poner-end-date.json"
  llamar "05-relectura-B" GET "/preapproval/$B" >/dev/null
  echo -n "  RELECTURA: "; resumen "$OUT/05-relectura-B.json"
  echo
  # Lo que decide la fila: que el campo QUEDE, no que el PUT devuelva 200.
  QUEDO=$(jq -r '.auto_recurring.end_date // "NO QUEDÓ"' "$OUT/05-relectura-B.json")
  if [ "$QUEDO" = "NO QUEDÓ" ]; then
    echo "  → El end_date NO sobrevivió a la relectura: otro caso del §0."
    echo "    La cancelación programada habría que EMULARLA con un cron."
  else
    echo "  → end_date quedó en $QUEDO, y la suscripción sigue"
    echo "    $(jq -r '.status' "$OUT/05-relectura-B.json"). Falta ver si el proveedor"
    echo "    efectivamente deja de cobrar ese día: eso lo dice el reloj."
  fi
fi

# --- limpieza ----------------------------------------------------------------
echo; echo "######## limpieza"
for id in "$A" "$B"; do
  [ -n "$id" ] || continue
  code=$(llamar "cancelar-$id" PUT "/preapproval/$id" '{"status":"cancelled"}')
  echo "  cancelar $id → HTTP $code"
done

echo; echo "############ FIN. Requests y responses en $OUT"
