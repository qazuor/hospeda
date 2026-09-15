#!/usr/bin/env bash
# =============================================================================
# SONDA 05 — Arrancar el reloj
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352.
#
# POR QUÉ EXISTE
# --------------
# Diecisiete filas de la matriz no están en UNKNOWN por falta de permisos ni
# de endpoint: están en UNKNOWN porque NO PASÓ TIEMPO. Una renovación, un
# cobro fallido, la política de reintentos del proveedor y los efectos reales
# de una pausa sólo se ven cuando el proveedor ejecuta un ciclo por su cuenta.
# La pausa de la sonda 02 duró 1,3 segundos: alcanzó para las transiciones y
# no para nada más.
#
# EL ATAJO, Y DE DÓNDE SALE
# -------------------------
# De una medición que ya está hecha, no de una suposición. Al probar
# `frequency_type: "years"` el proveedor respondió:
#
#     400 "Invalid value for frequency type, valid ones are [days, months]"
#
# O sea que `days` es un valor válido del modelo. Si un ciclo DIARIO se acepta
# y se autoriza, el primer ciclo real ocurre en ~24 h en vez de ~30 días, y
# las diecisiete filas se vuelven medibles en un día.
#
# Eso NO está medido todavía: es exactamente lo primero que mide esta sonda, y
# se mide por RELECTURA, no por el código de estado (ver abajo).
#
# LA REGLA QUE ATRAVIESA TODO (§0 de RESULTS-2026-09-15.md)
# --------------------------------------------------------
# Mercado Pago acepta cambios que no aplica y responde 2xx. Cinco casos
# medidos. Por eso cada sujeto de esta sonda se RELEE después de crearse y se
# compara campo por campo contra lo que se pidió: si el proveedor "acepta"
# `days` y lo guarda como otra cosa, esta sonda lo tiene que ver ANTES de que
# alguien se pase 24 h esperando una renovación que nunca iba a ocurrir.
#
# QUÉ DEJA
# --------
# Siete suscripciones vivas en el sandbox y un manifiesto JSON. No concluye
# nada por sí sola: la lee la sonda 06, a las 24 h, 48 h y 72 h.
#
# Filas que apunta a desbloquear:
#   RN-1..3 · GR-1..3 · PS-2, PS-4, PS-5, PS-6 · PA-4 · EX-1 · UP-1, UP-2
#   DW-1, DW-2 · CT-1, CT-3
#
# Credenciales por entorno. NUNCA en el repo.
#   source <fuera-del-repo>/creds.sh && bash probe-05-arrancar-el-reloj.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-05}"
MANIFEST="$OUT/manifiesto.json"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACK_URL="https://www.hospeda.com.ar"
MANANA=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%S.000Z)

echo "############ SONDA 05 — arrancar el reloj · $(date -Is)"
echo "############ salida: $OUT · manifiesto: $MANIFEST"

# --- tokenizar --------------------------------------------------------------
# Las tarjetas de prueba de Argentina. El NOMBRE DEL TITULAR es lo que decide
# el resultado del cobro, no el número:
#   APRO → aprueba · FUND → rechaza por fondos insuficientes
# `FUND` es el sujeto de PA-4 y el que puede producir un cobro fallido real
# sin tener que esperar a que una tarjeta buena falle sola.
tokenizar() { # <nombre-titular> → imprime el token, o vacío
  local titular="$1" body resp
  body=$(jq -cn --arg n "$titular" '{
    card_number:"5031755734530604", security_code:"123",
    expiration_month:11, expiration_year:2030,
    cardholder:{name:$n, identification:{type:"DNI", number:"12345678"}}}')
  resp=$(curl -sS -X POST "$API/v1/card_tokens" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$body")
  # el token no se imprime nunca: este script queda versionado
  printf '%s' "$resp" | jq -r '.id // empty'
}

TOK_APRO="$(tokenizar APRO)"
TOK_FUND="$(tokenizar FUND)"
[ -n "$TOK_APRO" ] || { echo "sin token APRO: no hay nada que arrancar"; exit 1; }
echo "tokens → APRO: $([ -n "$TOK_APRO" ] && echo ok || echo FALLÓ) · FUND: $([ -n "$TOK_FUND" ] && echo ok || echo FALLÓ)"

# --- crear un sujeto --------------------------------------------------------
# Devuelve el id, y deja request, response y RELECTURA en disco.
crear() { # <slug> <token|-> <monto> <start_date|-> <descripción>
  local slug="$1" tok="$2" monto="$3" inicio="$4" desc="$5"
  local body id code

  body=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg r "HOS1352 reloj $slug" \
                --arg x "HOS-1352-reloj-$STAMP-$slug" --arg b "$BACK_URL" \
                --argjson m "$monto" --arg i "$inicio" '
    {reason:$r, payer_email:$e, back_url:$b, external_reference:$x,
     auto_recurring: ({frequency:1, frequency_type:"days",
                       transaction_amount:$m, currency_id:"ARS"}
                      + (if $i == "-" then {} else {start_date:$i} end))}')
  # los campos que dependen del token se agregan aparte para no imprimirlo
  if [ "$tok" != "-" ]; then
    body=$(printf '%s' "$body" | jq -c --arg t "$tok" '. + {card_token_id:$t, status:"authorized"}')
  fi

  # El request se guarda TAL CUAL se manda, salvo el token. Agregar una clave
  # que no se mandó falsifica la evidencia.
  printf '%s' "$body" | jq -c 'if has("card_token_id") then .card_token_id = "(redactado)" else . end' \
    > "$OUT/$slug.request.json"
  code=$(curl -sS -o "$OUT/$slug.response.json" -w '%{http_code}' -X POST "$API/preapproval" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$body")
  id=$(jq -r '.id // empty' "$OUT/$slug.response.json")

  printf '\n=== %-14s %s\n    HTTP %s · id: %s\n' "$slug" "$desc" "$code" "${id:-—}"
  [ -n "$id" ] || { jq -c '{message, error, cause}' "$OUT/$slug.response.json"; echo "$slug|"; return; }

  # RELECTURA — lo único que prueba algo (§0). Si `days` se aceptó y se guardó
  # como otra cosa, se ve acá y no dentro de 24 h.
  curl -sS -o "$OUT/$slug.relectura.json" -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/preapproval/$id"
  echo -n "    RELECTURA: "
  jq -c '{status,
          ciclo: "\(.auto_recurring.frequency) \(.auto_recurring.frequency_type)",
          monto: .auto_recurring.transaction_amount,
          next_payment_date,
          cobros: .summarized.charged_quantity,
          free_trial: .auto_recurring.free_trial}' "$OUT/$slug.relectura.json"

  local ft
  ft=$(jq -r '.auto_recurring.frequency_type // "?"' "$OUT/$slug.relectura.json")
  [ "$ft" = "days" ] || echo "    ⚠ PEDIMOS days Y QUEDÓ \"$ft\" — el atajo no existe, ver §0"
  echo "$slug|$id"
}

# --- los siete sujetos ------------------------------------------------------
{
  crear renov-ok       "$TOK_APRO" 2000 -         "RN-1: renovación exitosa a las 24 h"
  crear renov-falla    "$TOK_FUND" 2000 "$MANANA" "PA-4 + RN-2 + GR-1..3: cobro que falla"
  crear pausa-real     "$TOK_APRO" 2000 -         "PS-2/4/5/6: se pausa abajo, por 24 h reales"
  crear sin-autorizar  -           2000 -         "EX-1: nunca se autoriza. ¿Vence? ¿Cuándo?"
  crear monto-baja     "$TOK_APRO" 2000 -         "DW-1/DW-2: el monto baja a 1000"
  crear monto-sube     "$TOK_APRO" 2000 -         "UP-1/UP-2: el monto sube a 4000"
  crear cortesia-piso  "$TOK_APRO" 2000 -         "CT-1/CT-3: el monto baja al piso de ARS 15"
} | tee "$OUT/creacion.log"

ids() { grep -E "^$1\|" "$OUT/creacion.log" | tail -1 | cut -d'|' -f2; }

# --- las mutaciones que hay que dejar hechas HOY -----------------------------
# El sentido de cada una es qué hace el proveedor con ella EN EL CICLO
# SIGUIENTE. Si se aplican mañana, hay que esperar un día más.
mutar() { # <slug> <json-de-auto_recurring> <qué mide>
  local slug="$1" patch="$2" que="$3" id code
  id="$(ids "$slug")"
  [ -n "$id" ] || { echo "  ($slug no existe: se saltea)"; return; }
  code=$(curl -sS -o "$OUT/$slug.mutacion.json" -w '%{http_code}' -X PUT "$API/preapproval/$id" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw "$patch")
  curl -sS -o "$OUT/$slug.relectura-post-mutacion.json" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$id"
  printf '  %-14s HTTP %-3s · %s\n    ' "$slug" "$code" "$que"
  jq -c '{status, monto: .auto_recurring.transaction_amount, next_payment_date,
          cobros: .summarized.charged_quantity}' "$OUT/$slug.relectura-post-mutacion.json"
}

echo; echo "######## mutaciones (se releen en el acto, §0)"
mutar monto-baja      '{"auto_recurring":{"transaction_amount":1000,"currency_id":"ARS"}}' \
      "¿el cobro de mañana sale 1000?"
mutar monto-sube      '{"auto_recurring":{"transaction_amount":4000,"currency_id":"ARS"}}' \
      "¿cobra la diferencia YA, o recién mañana?"
mutar cortesia-piso   '{"auto_recurring":{"transaction_amount":15,"currency_id":"ARS"}}' \
      "¿el piso de ARS 15 sirve como cortesía?"
mutar pausa-real      '{"status":"paused"}' \
      "queda pausada 24 h REALES: PS-2, PS-4, PS-5, PS-6"

# --- manifiesto -------------------------------------------------------------
# Es lo que la sonda 06 vuelve a leer mañana. Sin esto, el experimento se
# pierde: no hay forma de encontrar estas suscripciones por external_reference
# (RC-1: el search lo ignora en silencio).
jq -n --arg t0 "$(date -Is)" --arg stamp "$STAMP" '
  {arrancado: $t0, stamp: $stamp, sujetos: $sujetos}' \
  --argjson sujetos "$(
    for s in renov-ok renov-falla pausa-real sin-autorizar monto-baja monto-sube cortesia-piso; do
      printf '{"slug":"%s","id":"%s"}\n' "$s" "$(ids "$s")"
    done | jq -sc '[.[] | select(.id != "")]'
  )" > "$MANIFEST"

echo; echo "############ manifiesto:"; jq -c '.sujetos[]' "$MANIFEST"
cat <<TXT

############ FIN. El reloj arrancó: $(date -Is)

  Volver con la SONDA 06 a las 24 h, 48 h y 72 h:

      OUT_DIR=$OUT bash probe-06-leer-el-reloj.sh

  Y cuando se quiera medir la reanudación de la pausa (PS-5/PS-6), con la
  pausa ya cumplida:

      OUT_DIR=$OUT REANUDAR=1 bash probe-06-leer-el-reloj.sh

  Ninguna fila de la matriz se marca desde este log: se marca desde lo que
  devuelva la 06, que es la que ve al proveedor ejecutar un ciclo por su
  cuenta.
TXT
