#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# HOS-1352 · FASE 1C · Sonda 01 — fundamentos del preapproval
#
# CÓDIGO NO PRODUCTIVO Y DESCARTABLE. No lo importa nada, no entra en ningún
# build, y no debe usarse como referencia de implementación. Existe para que
# los resultados de la matriz sean REPRODUCIBLES por otro agente meses después
# (PDR §58-61, mejora S-METH-01).
#
# Qué responde: P-1, P-5, F-1..F-4, CD-1, AD-1, PR-1, PR-2, RC-1.
# Qué NO responde: todo lo que requiere un preapproval AUTORIZADO — pausa real,
# renovaciones, grace, webhooks, reembolsos. Eso necesita completar el flujo en
# el init_point con la cuenta del comprador de prueba.
#
# Resultados de la corrida del 2026-09-15: ./RESULTS-2026-09-15.md
#
# Uso:
#   export MP_TOKEN=<access token de la cuenta de PRUEBA>
#   bash probe-01-preapproval-basics.sh
#
# SEGURIDAD: el script verifica que el token sea de una cuenta de prueba ANTES
# de crear nada, y aborta si no lo es. No lo saltees: con un token productivo
# estas llamadas crean suscripciones reales.
# ---------------------------------------------------------------------------
set -uo pipefail

API=https://api.mercadopago.com
OUT="${OUT:-./out}"
mkdir -p "$OUT"

if [ -z "${MP_TOKEN:-}" ]; then
  echo "FALTA MP_TOKEN. Abortando." >&2
  exit 1
fi

auth=(-H "Authorization: Bearer $MP_TOKEN")
json=(-H "Content-Type: application/json")

# --- Guarda de seguridad: ¿es una cuenta de prueba? ------------------------
echo "== Verificando la cuenta =="
me=$(curl -s "${auth[@]}" "$API/users/me")
is_test=$(echo "$me" | jq -r '(.tags // []) | index("test_user") | if . == null then "no" else "si" end')
echo "$me" | jq -c '{id, nickname, site_id, tags}'
if [ "$is_test" != "si" ]; then
  echo "ABORTA: la cuenta NO está marcada como test_user. No se crea nada." >&2
  exit 2
fi

# El pagador tiene que ser un test user EXISTENTE. Un email inventado produce
# un 400 opaco ("User bad request") que no dice cuál es el problema.
PAYER="${PAYER:-test_user_5529635850066455346@testuser.com}"
BACK="https://staging.hospeda.com.ar/billing/return"

created_ids=()

create () { # $1 ref, $2 auto_recurring
  local ref="$1" ar="$2" body resp
  body=$(jq -nc --arg r "$ref" --arg p "$PAYER" --arg b "$BACK" --argjson ar "$ar" \
    '{reason:$r, external_reference:$r, payer_email:$p, back_url:$b, auto_recurring:$ar}')
  resp=$(curl -s -X POST "$API/preapproval" "${auth[@]}" "${json[@]}" -d "$body")
  echo "$body" > "$OUT/req-$ref.json"
  echo "$resp" > "$OUT/resp-$ref.json"
  local id; id=$(echo "$resp" | jq -r '.id // empty')
  [ -n "$id" ] && created_ids+=("$id")
  echo "[$ref] $(echo "$resp" | jq -c '{status, msg:.message, freq:.auto_recurring.frequency, ftype:.auto_recurring.frequency_type, next:.next_payment_date}')"
}

echo
echo "== P-1 / F-1..F-4 — creación por API y frecuencias =="
create f1  '{"frequency":1,"frequency_type":"months","transaction_amount":1000,"currency_id":"ARS"}'
create f2  '{"frequency":3,"frequency_type":"months","transaction_amount":1000,"currency_id":"ARS"}'
create f3  '{"frequency":6,"frequency_type":"months","transaction_amount":1000,"currency_id":"ARS"}'
create f4  '{"frequency":12,"frequency_type":"months","transaction_amount":1000,"currency_id":"ARS"}'
create f4b '{"frequency":1,"frequency_type":"years","transaction_amount":1000,"currency_id":"ARS"}'

echo
echo "== CD-1 — ¿respeta una primera fecha de cobro corrida? =="
FUTURE=$(date -u -d '+20 days' +%Y-%m-%dT%H:%M:%S.000Z)
echo "start_date pedido: $FUTURE"
create cd1 "$(jq -nc --arg s "$FUTURE" '{frequency:1,frequency_type:"months",start_date:$s,transaction_amount:1000,currency_id:"ARS"}')"
echo "   -> comparar next_payment_date contra el start_date pedido"

echo
echo "== AD-1 — ¿un preapproval cubre más de un ítem? =="
echo -n "[ad1a array]  "
curl -s -X POST "$API/preapproval" "${auth[@]}" "${json[@]}" -d "$(jq -nc --arg p "$PAYER" --arg b "$BACK" \
  '{reason:"ad1a",external_reference:"ad1a",payer_email:$p,back_url:$b,auto_recurring:[{frequency:1,frequency_type:"months",transaction_amount:1000,currency_id:"ARS"},{frequency:1,frequency_type:"months",transaction_amount:500,currency_id:"ARS"}]}')" \
  | jq -c '{status, msg:.message}'
echo -n "[ad1b items]  "
r=$(curl -s -X POST "$API/preapproval" "${auth[@]}" "${json[@]}" -d "$(jq -nc --arg p "$PAYER" --arg b "$BACK" \
  '{reason:"ad1b",external_reference:"ad1b",payer_email:$p,back_url:$b,items:[{title:"plan",unit_price:1000},{title:"addon",unit_price:500}],auto_recurring:{frequency:1,frequency_type:"months",transaction_amount:1000,currency_id:"ARS"}}')")
echo "$r" | jq -c '{status, amount:.auto_recurring.transaction_amount, items_en_respuesta:(.items != null)}'
id=$(echo "$r" | jq -r '.id // empty'); [ -n "$id" ] && created_ids+=("$id")

echo
echo "== PR-1 / PR-2 — mutación de monto y piso (sobre un PENDING) =="
PID=$(jq -r '.id' "$OUT/resp-f2.json")
for amt in 1500 1 0; do
  echo -n "[monto -> $amt] "
  curl -s -X PUT "$API/preapproval/$PID" "${auth[@]}" "${json[@]}" \
    -d "{\"auto_recurring\":{\"transaction_amount\":$amt,\"currency_id\":\"ARS\"}}" \
    | jq -c '{status, msg:.message, amount:.auto_recurring.transaction_amount}'
done

echo
echo "== P-5 — cancelación, y limpieza =="
for id in "${created_ids[@]}"; do
  echo -n "cancel $id -> "
  curl -s -X PUT "$API/preapproval/$id" "${auth[@]}" "${json[@]}" -d '{"status":"cancelled"}' | jq -rc '.status // .message'
done

echo
echo "== RC-1 — ¿el search refleja el estado real? =="
echo "Compará, para cada id, el status del GET directo contra el del search."
for id in "${created_ids[@]}"; do
  direct=$(curl -s "${auth[@]}" "$API/preapproval/$id" | jq -r '.status')
  ref=$(curl -s "${auth[@]}" "$API/preapproval/$id" | jq -r '.external_reference')
  viasearch=$(curl -s "${auth[@]}" "$API/preapproval/search?external_reference=$ref&limit=1" | jq -r '.results[0].status // "n/a"')
  echo "  $ref  GET=$direct  SEARCH=$viasearch"
done

echo
echo "== Reintento de cancelación sobre uno ya cancelado =="
curl -s -X PUT "$API/preapproval/${created_ids[0]}" "${auth[@]}" "${json[@]}" -d '{"status":"cancelled"}' | jq -c '{status, msg:.message}'

echo
echo "Listo. Requests y responses crudos en $OUT/"
