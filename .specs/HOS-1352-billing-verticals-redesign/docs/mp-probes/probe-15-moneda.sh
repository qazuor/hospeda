#!/usr/bin/env bash
# =============================================================================
# SONDA 15 — ¿Se puede cobrar en una moneda que no sea ARS?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Alimenta `M-MP-01`.
#
# LA PREGUNTA
# -----------
# Toda la matriz de precios está escrita en pesos. Si mañana hay un cliente que
# paga en dólares —o si el proveedor convierte por su cuenta— eso cambia el
# modelo de datos (una columna de moneda por plan, por suscripción y por
# cobro) y cambia la conciliación. Es más barato saberlo ahora que después.
#
# TRES DESENLACES, Y HAY QUE DISTINGUIRLOS
# ----------------------------------------
#   1. RECHAZA        → la moneda es ARS y punto. El modelo se simplifica.
#   2. ACEPTA de veras → hay multi-moneda y hay que modelarla.
#   3. ACEPTA Y CONVIERTE / IGNORA en silencio → el peor caso: el código cree
#      que cobra USD 10 y el proveedor cobra ARS 10. Es exactamente la forma
#      del §0, y sólo se ve releyendo.
#
# El caso 3 es la razón de que esta sonda exista en vez de leer la
# documentación: un `201` con `currency_id: "USD"` en la respuesta TAMPOCO
# alcanza — se compara contra la RELECTURA.
#
# POR QUÉ ES GRATIS
# -----------------
# Sin `card_token_id`: los sujetos nacen `pending` y no cobran. Se cancelan al
# final y se verifica por relectura.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-15-moneda.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-15}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACK_URL="https://www.hospeda.com.ar"
CREADOS="$OUT/creados.txt"; : > "$CREADOS"

echo "############ SONDA 15 — moneda · $(date -Is)"
echo "############ salida: $OUT"
echo
echo "  La cuenta vendedora, según el proveedor:"
curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me" \
  | jq -c '{site_id, country_id, nickname}' | sed 's/^/    /'

probar() { # <moneda> <monto> <por qué>
  local cur="$1" monto="$2" que="$3" body code id leido
  # la clave de archivo lleva el monto: la misma moneda se prueba dos veces
  local k="$cur-$monto"
  body=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg r "HOS1352 moneda $cur" \
                --arg x "HOS-1352-moneda-$STAMP-$k" --arg b "$BACK_URL" \
                --arg c "$cur" --argjson m "$monto" '
    {reason:$r, payer_email:$e, back_url:$b, external_reference:$x,
     auto_recurring:{frequency:1, frequency_type:"months",
                     transaction_amount:$m, currency_id:$c}}')
  printf '%s' "$body" > "$OUT/$k.request.json"
  code=$(curl -sS -o "$OUT/$k.response.json" -w '%{http_code}' -X POST "$API/preapproval" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$body")
  id=$(jq -r '.id // empty' "$OUT/$k.response.json")

  printf '\n=== %-5s pedido: %s %s · %s\n    HTTP %s\n' "$cur" "$monto" "$cur" "$que" "$code"

  if [ -z "$id" ]; then
    echo "    RECHAZA: $(jq -c '{message, error, cause}' "$OUT/$k.response.json")"
    return
  fi
  echo "$cur|$id" >> "$CREADOS"

  # RELECTURA — un `201` con la moneda pedida en la respuesta no prueba que
  # haya quedado guardada así (§0).
  curl -sS -o "$OUT/$k.relectura.json" -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/preapproval/$id" >/dev/null
  leido=$(jq -r '.auto_recurring.currency_id // "?"' "$OUT/$k.relectura.json")
  echo "    RELECTURA: $(jq -c '{status, moneda: .auto_recurring.currency_id,
                                 monto: .auto_recurring.transaction_amount}' \
                          "$OUT/$k.relectura.json")"
  if [ "$leido" = "$cur" ]; then
    echo "    → ACEPTA Y GUARDA \"$cur\""
  else
    echo "    ⚠ PEDIMOS \"$cur\" Y QUEDÓ \"$leido\" — aceptado y descartado en silencio (§0)"
  fi
}

probar ARS 100  "control: la moneda de la cuenta"
probar USD 10   "M-MP-01: ¿se puede cobrar en dólares?"
probar BRL 50   "otra moneda real de la región"
probar XXX 100  "control negativo: una moneda que no existe"

# --- el control que la primera corrida obligó a agregar ----------------------
# `USD 10` no se rechazó por la MONEDA: se rechazó con
# "Cannot pay an amount lower than $ 15.00", que es el piso en PESOS medido en
# `PC-2`. O sea que `USD` pasó la validación de moneda —a diferencia de `BRL` y
# `XXX`, que mueren en "Invalid field -> auto_recurring.currency_id"— y el
# número se evaluó contra el piso argentino.
#
# Eso deja la pregunta peor que antes, no mejor: si el piso es el de pesos,
# ¿qué guarda cuando el monto lo supera? Un `USD` aceptado y guardado como
# `ARS` sería el §0 en su forma más cara. Se mide, no se supone.
probar USD 100  "control: el mismo USD por encima del piso de ARS 15"

# Y esto es lo que decide entre las dos lecturas posibles de lo de arriba.
# Si el piso se evalúa ANTES que la moneda, entonces una moneda inválida con un
# monto chico devuelve el mensaje del PISO y no el de la moneda — y ese mensaje
# no dice nada sobre si la moneda era válida. Se comprueba con la moneda que ya
# sabemos inválida (`BRL`, que con 50 murió en "Invalid field"): si con 10
# devuelve "lower than $ 15.00", el orden queda probado y `USD 10` deja de ser
# evidencia de nada.
probar BRL 10   "control del ORDEN: moneda ya sabida inválida, monto bajo el piso"
probar ARS 10   "control del piso en la moneda propia"

# --- limpieza ---------------------------------------------------------------
echo
echo "######## LIMPIEZA — cancelar todo lo creado, y verificarlo"
while IFS='|' read -r cur id; do
  [ -n "$id" ] || continue
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$API/preapproval/$id" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw '{"status":"cancelled"}')
  estado=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$id" \
    | jq -r '.status // "?"')
  printf '  %-5s %s · PUT cancelled HTTP %-3s → relectura: %s' "$cur" "$id" "$code" "$estado"
  [ "$estado" = "cancelled" ] && echo " ✓" || echo "  ⚠ QUEDA VIVO"
done < <(sort -u "$CREADOS")

echo
echo "############ fin · evidencia en $OUT"
