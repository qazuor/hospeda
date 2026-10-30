#!/usr/bin/env bash
# =============================================================================
# SONDA 07 — Qué se puede hacer sobre una suscripción PAUSADA
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Alimenta `BD-MP-01` (mecanismo de pausa), `PS-*`, y
# acota el alcance de `DEC-MP-001` (cambio de precio sobre vigentes).
#
# DE DÓNDE SALE
# -------------
# Al correr la sonda 05 se intentó pausar una suscripción que YA estaba
# pausada y el proveedor contestó:
#
#     400 "You can not modify a paused preapproval."
#
# Ese mensaje sugiere algo mucho más grande que lo que se probó: que estando
# pausada NO SE PUEDE MODIFICAR NADA. Pero lo único medido fue un intento de
# re-pausar. Tomar el mensaje por la conclusión sería exactamente lo que el
# §58 prohíbe — y además este proveedor ya demostró que lo que dice y lo que
# hace no siempre coinciden (§0 de RESULTS: cinco casos de 2xx que no
# aplicaron nada).
#
# Así que se prueba de verdad, sobre sujetos descartables:
#
#   sujeto A   pausar → intentar CAMBIAR EL MONTO → reanudar
#              Es la pregunta que importa: si un aumento no entra sobre una
#              pausada, `DEC-MP-001` tiene un agujero y hay que declararlo.
#   sujeto B   pausar → intentar CANCELAR
#              Si tampoco se puede, una pausa sería una trampa: el cliente no
#              podría darse de baja sin reanudar primero.
#
# Los dos sujetos se cancelan al final. NO se tocan los de la sonda 05: el
# `pausa-real` de aquélla tiene que quedar pausado 24 h para medir PS-2.
#
# Credenciales por entorno. NUNCA en el repo.
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-07-que-se-puede-sobre-una-pausada.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-07}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

echo "############ SONDA 07 — qué se puede sobre una pausada · $(date -Is)"
echo "############ salida: $OUT"

# Un token se usa UNA sola vez (medido con la sonda 05): uno por sujeto.
tokenizar() {
  curl -sS -X POST "$API/v1/card_tokens" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw '{"card_number":"5031755734530604","security_code":"123",
                 "expiration_month":11,"expiration_year":2030,
                 "cardholder":{"name":"APRO","identification":{"type":"DNI","number":"12345678"}}}' \
    | jq -r '.id // empty'
}

crear() { # <slug> → imprime el id
  local slug="$1" tok body id
  tok="$(tokenizar)"
  [ -n "$tok" ] || { echo "  (no se pudo tokenizar $slug)" >&2; return 1; }
  body=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg t "$tok" --arg x "HOS-1352-pausada-$STAMP-$slug" '{
    reason:"HOS1352 pausada", payer_email:$e, back_url:"https://www.hospeda.com.ar",
    external_reference:$x, card_token_id:$t, status:"authorized",
    auto_recurring:{frequency:1, frequency_type:"days",
                    transaction_amount:2000, currency_id:"ARS"}}')
  curl -sS -o "$OUT/$slug.crear.json" -X POST "$API/preapproval" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$body" >/dev/null
  id=$(jq -r '.id // empty' "$OUT/$slug.crear.json")
  [ -n "$id" ] || { jq -c '{message}' "$OUT/$slug.crear.json" >&2; return 1; }
  printf '%s' "$id"
}

# Cada intento: se manda, se RELEE, y se reporta lo que quedó de verdad. El
# código de estado por sí solo no decide nada (§0).
#
# REINTENTA ANTE 429. La primera corrida de esta sonda se comió un
# `429 local_rate_limited` JUSTO en el intento que decidía, y un 429 no dice
# nada sobre si la operación está permitida: dice que no llegó a evaluarse.
# Un experimento que confunde "me frenaron" con "no se puede" inventa un
# NOT_SUPPORTED que no existe.
intento() { # <id> <etiqueta> <json> <qué se espera saber>
  local id="$1" etiqueta="$2" patch="$3" que="$4" code tag espera=5 n=0
  tag="$(printf '%s' "$etiqueta" | tr ' /' '__')"
  while : ; do
    code=$(curl -sS -o "$OUT/$tag.response.json" -w '%{http_code}' -X PUT "$API/preapproval/$id" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data-raw "$patch")
    [ "$code" = "429" ] || break
    n=$((n + 1))
    [ "$n" -le 5 ] || { echo "    (429 cinco veces seguidas: se abandona este intento)"; break; }
    echo "    (429 local_rate_limited — reintento $n en ${espera}s)"
    sleep "$espera"; espera=$((espera * 2))
  done
  curl -sS -o "$OUT/$tag.relectura.json" -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/preapproval/$id"
  printf '  %-34s HTTP %-3s  %s\n' "$etiqueta" "$code" "$que"
  printf '    dijo:     '; jq -c '{message} | with_entries(select(.value != null))' \
    "$OUT/$tag.response.json"
  printf '    QUEDÓ:    '; jq -c '{status, monto: .auto_recurring.transaction_amount,
                                   next_payment_date}' "$OUT/$tag.relectura.json"
}

# --- sujeto A: ¿se puede cambiar el monto estando pausada? -------------------
echo; echo "######## sujeto A — pausar, cambiar el monto, reanudar"
A=$(crear A) || exit 1
echo "  id: $A"
intento "$A" "1. pausar"                 '{"status":"paused"}' "la transición ya era VERIFIED (PS-1)"
intento "$A" "2. cambiar monto a 3000"   '{"auto_recurring":{"transaction_amount":3000,"currency_id":"ARS"}}' \
        "← LA QUE IMPORTA: acota DEC-MP-001"
intento "$A" "3. reanudar"               '{"status":"authorized"}' "PS-3"
intento "$A" "4. cambiar monto ya reanudada" '{"auto_recurring":{"transaction_amount":3000,"currency_id":"ARS"}}' \
        "control: si acá SÍ entra, el bloqueo era de la pausa"

# --- sujeto B: ¿se puede cancelar estando pausada? --------------------------
echo; echo "######## sujeto B — pausar y cancelar"
B=$(crear B) || exit 1
echo "  id: $B"
intento "$B" "1. pausar"   '{"status":"paused"}'    ""
intento "$B" "2. cancelar" '{"status":"cancelled"}' "← si NO se puede, la pausa es una trampa"

# --- limpieza ---------------------------------------------------------------
# Estos dos sujetos no tienen que seguir cobrando: no son parte del reloj.
echo; echo "######## limpieza"
for id in "$A" "$B"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$API/preapproval/$id" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw '{"status":"cancelled"}')
  estado=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$id" | jq -r '.status')
  printf '  cancelar %s → HTTP %s · quedó: %s\n' "$id" "$code" "$estado"
done

echo; echo "############ FIN. Requests y responses en $OUT"
