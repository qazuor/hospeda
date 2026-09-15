#!/usr/bin/env bash
# =============================================================================
# SONDA 11 — ¿Se puede reembolsar?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Cubre `RF-1` (total), `RF-2` (parcial) y `RF-3` (plazo).
#
# POR QUÉ SE VUELVE A INTENTAR
# ----------------------------
# Un intento anterior devolvió `401 "Unauthorized use of live credentials"` y
# la conclusión registrada fue la correcta: **eso no dice que el proveedor no
# reembolse, dice que ESAS credenciales no pueden pedirlo**. Las filas quedaron
# `UNKNOWN`, no `NOT_SUPPORTED`.
#
# Después se aprendió por qué: las credenciales del modo de pruebas actual de
# Mercado Pago pertenecen a un **usuario vendedor de prueba** y empiezan con
# `APP_USR-`, indistinguibles de unas productivas. O sea que el `401` pudo ser
# de una configuración distinta de la que hay ahora. Vale volver a medir: una
# fila `UNKNOWN` cuya causa se entendió es una fila que hay que reintentar, no
# una conclusión.
#
# QUÉ HACE
# --------
# Sobre pagos REALES de las sondas anteriores, que están `approved`:
#   1. reembolso PARCIAL de uno  (RF-2)
#   2. reembolso TOTAL de otro   (RF-1)
#   3. relee los dos             — el 2xx no prueba nada (§0)
#   4. lista los reembolsos del proveedor
#
# El parcial va primero a propósito: si el total se hiciera antes sobre el
# mismo pago, el parcial ya no tendría sobre qué probarse.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-11-reembolsos.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-11}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"

echo "############ SONDA 11 — reembolsos · $(date -Is)"
echo "############ salida: $OUT"

# Dos pagos aprobados distintos, los más recientes. Se eligen por consulta y no
# a mano para que la sonda se pueda volver a correr.
mapfile -t PAGOS < <(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  "$API/v1/payments/search?sort=date_created&criteria=desc&limit=20" \
  | jq -r '.results[] | select(.status=="approved") | "\(.id)|\(.transaction_amount)"')

[ "${#PAGOS[@]}" -ge 2 ] || { echo "hacen falta 2 pagos aprobados y hay ${#PAGOS[@]}"; exit 1; }

P_PARCIAL="${PAGOS[0]%%|*}"; M_PARCIAL="${PAGOS[0]##*|}"
P_TOTAL="${PAGOS[1]%%|*}";   M_TOTAL="${PAGOS[1]##*|}"
echo "  parcial sobre: $P_PARCIAL (ARS $M_PARCIAL)"
echo "  total   sobre: $P_TOTAL (ARS $M_TOTAL)"

intentar() { # <etiqueta> <pago> <body|->
  local etiqueta="$1" pago="$2" body="$3" code
  if [ "$body" = "-" ]; then
    code=$(curl -sS -o "$OUT/$etiqueta.json" -w '%{http_code}' -X POST "$API/v1/payments/$pago/refunds" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      -H "X-Idempotency-Key: hos1352-$etiqueta-$(date +%s)")
  else
    code=$(curl -sS -o "$OUT/$etiqueta.json" -w '%{http_code}' -X POST "$API/v1/payments/$pago/refunds" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      -H "X-Idempotency-Key: hos1352-$etiqueta-$(date +%s)" --data-raw "$body")
  fi
  printf '\n=== %-22s HTTP %s\n    ' "$etiqueta" "$code"
  jq -c '{id, status, amount, message, error} | with_entries(select(.value != null))' "$OUT/$etiqueta.json"
}

# --- RF-2: parcial ----------------------------------------------------------
intentar "RF-2-parcial" "$P_PARCIAL" "{\"amount\": 100}"

# --- RF-1: total ------------------------------------------------------------
# Sin body = reembolso total, según la forma habitual del endpoint.
intentar "RF-1-total" "$P_TOTAL" "-"

# --- relectura: lo único que prueba algo (§0) -------------------------------
echo; echo "######## RELECTURA de los dos pagos"
for p in "$P_PARCIAL" "$P_TOTAL"; do
  curl -sS -o "$OUT/pago-$p.json" -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/v1/payments/$p"
  printf '  %s → ' "$p"
  jq -c '{status, status_detail, monto: .transaction_amount,
          reembolsado: .transaction_amount_refunded,
          refunds: [.refunds[]? | {id, amount, status}]}' "$OUT/pago-$p.json"
done

echo; echo "############ FIN. Requests y responses en $OUT"
