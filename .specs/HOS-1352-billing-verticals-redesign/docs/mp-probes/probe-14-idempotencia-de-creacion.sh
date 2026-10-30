#!/usr/bin/env bash
# =============================================================================
# SONDA 14 — ¿La creación de una suscripción es idempotente?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Alimenta `M-CONC-01` (nada se cobra dos veces) y el
# contrato de errores del reconciliador.
#
# LA PREGUNTA
# -----------
# Un checkout que reintenta —el usuario hace doble clic, el cliente HTTP
# reintenta un timeout, un job se re-encola— puede mandar el mismo POST dos
# veces. Si el proveedor crea DOS suscripciones, el cliente queda con dos
# compromisos de cobro y nosotros con un estado local que sólo conoce uno.
#
# Hay dos mecanismos posibles de deduplicación y NINGUNO está medido:
#   A. `external_reference` — nuestra referencia semántica.
#   B. `X-Idempotency-Key`  — el header estándar del proveedor.
#
# Y una tercera pregunta que importa tanto como las otras dos: qué hace el
# proveedor si llega la MISMA clave con un CUERPO DISTINTO. Un proveedor puede
# devolver el recurso viejo (y entonces nuestro cambio se pierde en silencio),
# rechazar con un error (y entonces hay que distinguirlo de un fallo real), o
# crear uno nuevo (y entonces la clave no sirve para nada).
#
# POR QUÉ ES GRATIS
# -----------------
# Los sujetos se crean SIN `card_token_id`, así que nacen `pending`: el
# proveedor no cobra nada hasta que alguien autoriza en el navegador, y nadie
# va a autorizar. Ciclo mensual, no diario, para que ni por accidente entren
# en la ventana del reloj de la sonda 05.
#
# LA REGLA QUE ATRAVIESA TODO (§0 de RESULTS-2026-09-15.md)
# --------------------------------------------------------
# Un 2xx no prueba que algo se haya aplicado. Acá el desenlace no se lee del
# código de estado sino de los IDS DEVUELTOS y de una relectura de cada uno.
# Dos `201` con el mismo id son una deduplicación; dos `201` con ids distintos
# son dos suscripciones.
#
# QUÉ DEJA
# --------
# Cancela todo lo que crea, y lo verifica por relectura. Si algún sujeto queda
# vivo lo dice al final, con su id.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-14-idempotencia-de-creacion.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-14}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACK_URL="https://www.hospeda.com.ar"
CREADOS="$OUT/creados.txt"; : > "$CREADOS"

echo "############ SONDA 14 — idempotencia de creación · $(date -Is)"
echo "############ salida: $OUT"

# --- crear ------------------------------------------------------------------
# <etiqueta> <external_reference> <idempotency-key|-> <monto>
crear() {
  local et="$1" xref="$2" key="$3" monto="$4" body code id
  body=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg r "HOS1352 idem $et" \
                --arg x "$xref" --arg b "$BACK_URL" --argjson m "$monto" '
    {reason:$r, payer_email:$e, back_url:$b, external_reference:$x,
     auto_recurring:{frequency:1, frequency_type:"months",
                     transaction_amount:$m, currency_id:"ARS"}}')
  printf '%s' "$body" > "$OUT/$et.request.json"

  if [ "$key" = "-" ]; then
    code=$(curl -sS -o "$OUT/$et.response.json" -w '%{http_code}' -X POST "$API/preapproval" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data-raw "$body")
  else
    code=$(curl -sS -o "$OUT/$et.response.json" -w '%{http_code}' -X POST "$API/preapproval" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      -H "X-Idempotency-Key: $key" --data-raw "$body")
  fi
  id=$(jq -r '.id // empty' "$OUT/$et.response.json")

  # Los diagnósticos van a STDERR a propósito: el id se captura por
  # sustitución de comandos, y si el texto saliera por stdout quedaría DENTRO
  # de la variable. Entonces una creación fallida daría una variable no vacía
  # y cualquier chequeo `[ -n "$id" ]` pasaría por el texto del error.
  printf '  %-12s HTTP %-3s · xref %-34s · key %-14s · id %s\n' \
    "$et" "$code" "$xref" "$key" "${id:-—}" >&2
  [ -n "$id" ] || printf '               error: %s\n' \
    "$(jq -c '{message, error, status, cause}' "$OUT/$et.response.json")" >&2
  [ -z "$id" ] || echo "$et|$id" >> "$CREADOS"
  printf '%s' "$id"
}

# =============================================================================
echo
echo "######## CASO A — mismo external_reference, SIN clave de idempotencia"
echo "         Si dedupe por nuestra referencia, los dos ids son iguales."
XREF_A="HOS-1352-idem-$STAMP-A"
A1=$(crear a1 "$XREF_A" - 100)
A2=$(crear a2 "$XREF_A" - 100)

echo
if [ -n "$A1" ] && [ -n "$A2" ]; then
  if [ "$A1" = "$A2" ]; then echo "  → DEDUPLICA por external_reference (mismo id)"
  else echo "  → NO deduplica: DOS suscripciones distintas con la misma referencia"; fi
else
  echo "  → uno de los dos no se creó: ver los errores de arriba"
fi

# =============================================================================
echo
echo "######## CASO B — misma X-Idempotency-Key, cuerpo IDÉNTICO"
echo "         (external_reference distinto del caso A, para aislar el header)"
KEY_B="hos1352-$STAMP-b"
XREF_B="HOS-1352-idem-$STAMP-B"
B1=$(crear b1 "$XREF_B" "$KEY_B" 100)
B2=$(crear b2 "$XREF_B" "$KEY_B" 100)

echo
if [ -n "$B1" ] && [ -n "$B2" ]; then
  if [ "$B1" = "$B2" ]; then echo "  → DEDUPLICA por X-Idempotency-Key (mismo id)"
  else echo "  → NO deduplica: el header no tiene efecto sobre /preapproval"; fi
else
  echo "  → uno de los dos no se creó: ver los errores de arriba"
fi

# =============================================================================
echo
echo "######## CASO C — la MISMA clave del caso B, con un MONTO DISTINTO"
echo "         Tres desenlaces posibles y cada uno pide un manejo distinto:"
echo "         devuelve el viejo (nuestro cambio se pierde) · rechaza · crea otro."
C1=$(crear c1 "$XREF_B" "$KEY_B" 777)
echo
if [ -n "$C1" ]; then
  if [ "$C1" = "$B1" ]; then
    echo "  → DEVUELVE EL RECURSO VIEJO: el cuerpo nuevo se descarta EN SILENCIO"
  else
    echo "  → crea uno NUEVO pese a repetir la clave"
  fi
else
  echo "  → RECHAZA la clave repetida con cuerpo distinto (ver el error de arriba)"
fi

# --- relectura de todo lo creado (§0) ---------------------------------------
echo
echo "######## RELECTURA — el 2xx no prueba nada"
while IFS='|' read -r et id; do
  [ -n "$id" ] || continue
  curl -sS -o "$OUT/$et.relectura.json" -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/preapproval/$id" >/dev/null
  printf '  %-12s %s\n' "$et" \
    "$(jq -c '{id, status, external_reference,
               monto: .auto_recurring.transaction_amount,
               ciclo: "\(.auto_recurring.frequency) \(.auto_recurring.frequency_type)"}' \
       "$OUT/$et.relectura.json")"
done < <(sort -u "$CREADOS")

# --- limpieza ---------------------------------------------------------------
# Un `pending` no cobra, pero dejarlo vivo ensucia la lectura de cualquier
# sonda futura que liste suscripciones. Y si cancelar un `pending` NO se
# puede, eso también es un dato: es el estado en el que queda un checkout
# abandonado (`EX-1`).
echo
echo "######## LIMPIEZA — cancelar todo lo creado, y verificarlo"
while IFS='|' read -r et id; do
  [ -n "$id" ] || continue
  code=$(curl -sS -o "$OUT/$et.cancel.json" -w '%{http_code}' -X PUT "$API/preapproval/$id" \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    --data-raw '{"status":"cancelled"}')
  estado=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$id" \
    | jq -r '.status // "?"')
  printf '  %-12s %s · PUT cancelled HTTP %-3s → relectura: %s' "$et" "$id" "$code" "$estado"
  [ "$estado" = "cancelled" ] && echo " ✓" || echo "  ⚠ QUEDA VIVO"
done < <(sort -u "$CREADOS")

echo
echo "############ fin · evidencia en $OUT"
