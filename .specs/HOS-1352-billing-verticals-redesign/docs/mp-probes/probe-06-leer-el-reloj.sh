#!/usr/bin/env bash
# =============================================================================
# SONDA 06 — Leer el reloj
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Es la mitad que MIDE de la sonda 05: vuelve sobre los
# sujetos que aquella dejó vivos y registra qué hizo el proveedor por su
# cuenta mientras nadie miraba.
#
# QUÉ MIDE, Y POR QUÉ ASÍ
# -----------------------
# Cada corrida guarda una FOTO completa de cada sujeto y la compara contra la
# foto anterior. Lo que se registra como hallazgo es el DELTA, no el estado:
# "el proveedor cobró" es un hecho; "está en authorized" no dice si cobró.
#
# Por eso esta sonda no concluye nada en su primera corrida. La primera fija
# la línea de base; de la segunda en adelante cada fila de la matriz se marca
# contra un cambio observado entre dos lecturas fechadas.
#
# Se lee por `GET /preapproval/{id}`, por id, nunca por `external_reference`:
# el search de preapprovals lo IGNORA EN SILENCIO y devuelve todo (RC-1). El
# manifiesto de la sonda 05 es lo único que sabe qué hay que mirar.
#
#   OUT_DIR=/tmp/mp-probe-05 bash probe-06-leer-el-reloj.sh
#   OUT_DIR=/tmp/mp-probe-05 REANUDAR=1 bash probe-06-leer-el-reloj.sh
#
# `REANUDAR=1` reanuda el sujeto pausado y toma una foto inmediatamente antes
# y otra inmediatamente después. Ese par es lo que decide PS-5 y PS-6, o sea
# si el §26.4 es implementable: hay que correrlo UNA sola vez, con la pausa ya
# cumplida, porque reanudar no se puede deshacer.
#
# Credenciales por entorno. NUNCA en el repo.
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-05}"
MANIFEST="$OUT/manifiesto.json"
REANUDAR="${REANUDAR:-0}"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
[ -f "$MANIFEST" ] || { echo "no hay manifiesto en $MANIFEST — ¿corrió la sonda 05?"; exit 1; }

AHORA="$(date -u +%Y%m%dT%H%M%SZ)"
FOTOS="$OUT/fotos"
mkdir -p "$FOTOS"

T0=$(jq -r '.arrancado' "$MANIFEST")
echo "############ SONDA 06 — leer el reloj · $(date -Is)"
echo "############ el reloj arrancó: $T0"
echo "############ fotos: $FOTOS/<slug>/<sello>.json"

# La foto anterior de un sujeto, si la hay.
anterior() { ls -1 "$FOTOS/$1"/*.json 2>/dev/null | sort | tail -1; }

# Resumen canónico de un sujeto. Es lo que se compara entre fotos: si algo no
# entra acá, no se puede afirmar que cambió.
RESUMEN='{
  status: .sub.status,
  ciclo: "\(.sub.auto_recurring.frequency) \(.sub.auto_recurring.frequency_type)",
  monto: .sub.auto_recurring.transaction_amount,
  next_payment_date: .sub.next_payment_date,
  last_charged_date: .sub.summarized.last_charged_date,
  cobros: .sub.summarized.charged_quantity,
  cobrado_total: .sub.summarized.charged_amount,
  intentos_pendientes: .sub.summarized.pending_charge_quantity,
  monto_pendiente: .sub.summarized.pending_charge_amount,
  pagos: [.pagos.results[]? | {id, status, status_detail, amount: .transaction_amount,
                               fecha: .date_created}],
  autorizados: [.autorizados.results[]? | {id, status, payment: .payment.status,
                                           monto: .transaction_amount,
                                           fecha: .debit_date // .date_created}]
}'

# Toma una foto completa y la deja en disco. Imprime el resumen.
foto() { # <slug> <id> [sufijo]
  local slug="$1" id="$2" sufijo="${3:-}" dir="$FOTOS/$slug" archivo
  mkdir -p "$dir"
  archivo="$dir/$AHORA$sufijo.json"

  local sub pagos autorizados ref
  sub=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/$id")
  ref=$(printf '%s' "$sub" | jq -r '.external_reference // empty')
  # Los dos caminos de RC-2, los dos verificados. Se piden los dos a propósito:
  # si alguna vez discrepan, eso mismo es el hallazgo.
  autorizados=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/authorized_payments/search?preapproval_id=$id")
  pagos=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "$API/v1/payments/search?external_reference=$ref")

  jq -n --argjson sub "$sub" --argjson pagos "$pagos" --argjson autorizados "$autorizados" \
        --arg leido "$(date -Is)" --arg slug "$slug" \
    '{slug:$slug, leido:$leido, sub:$sub, pagos:$pagos, autorizados:$autorizados}' > "$archivo"
  printf '%s' "$archivo"
}

resumir() { jq -c "$RESUMEN" "$1"; }

# --- recorrido --------------------------------------------------------------
jq -r '.sujetos[] | "\(.slug)|\(.id)"' "$MANIFEST" | while IFS='|' read -r slug id; do
  prev="$(anterior "$slug")"
  nueva="$(foto "$slug" "$id")"

  printf '\n=== %-14s %s\n' "$slug" "$id"
  if [ -z "$prev" ]; then
    echo "    (primera lectura: línea de base, no hay nada que comparar todavía)"
    echo -n "    AHORA:  "; resumir "$nueva"
  else
    local_antes="$(resumir "$prev")"
    local_ahora="$(resumir "$nueva")"
    echo "    antes:  $local_antes"
    echo "    ahora:  $local_ahora"
    if [ "$local_antes" = "$local_ahora" ]; then
      echo "    → SIN CAMBIOS desde $(basename "$prev" .json)"
    else
      echo "    → CAMBIÓ:"
      # el delta campo por campo: lo único que se puede afirmar
      jq -n --argjson a "$local_antes" --argjson b "$local_ahora" \
        '[$b | to_entries[] | select(.value != $a[.key])
          | "         \(.key): \($a[.key] | tostring) → \(.value | tostring)"] | .[]' -r
    fi
  fi
done

# --- reanudación de la pausa ------------------------------------------------
if [ "$REANUDAR" = "1" ]; then
  PID=$(jq -r '.sujetos[] | select(.slug=="pausa-real") | .id' "$MANIFEST")
  if [ -z "$PID" ]; then
    echo; echo "no hay sujeto pausa-real en el manifiesto"
  else
    echo; echo "######## REANUDAR — PS-5 y PS-6 (§26.4). Una sola vez, no se deshace."
    antes="$(foto pausa-real "$PID" -antes-de-reanudar)"
    echo -n "  antes de reanudar: "; resumir "$antes"
    code=$(curl -sS -o "$OUT/reanudar.response.json" -w '%{http_code}' -X PUT "$API/preapproval/$PID" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data-raw '{"status":"authorized"}')
    echo "  PUT authorized → HTTP $code"
    # el 2xx no dice nada (§0): decide la relectura
    despues="$(foto pausa-real "$PID" -despues-de-reanudar)"
    echo -n "  después:           "; resumir "$despues"
    echo "  → lo que decide §26.4 es si next_payment_date se corrió por los días de pausa"
    echo "    o si quedó donde estaba. Comparar las dos líneas de arriba, campo por campo."
  fi
fi

cat <<TXT

############ FIN · $(date -Is)

  Fotos crudas en $FOTOS. Cada fila de la matriz que se marque con esta sonda
  cita DOS fotos fechadas y el delta entre ellas, nunca una sola lectura.

  Si todos los sujetos dicen SIN CAMBIOS y ya pasaron más de 24 h desde $T0,
  eso NO es un error de la sonda: es el hallazgo. Significa que un ciclo
  diario no produjo cobro, y entonces hay que mirar si el ciclo quedó
  realmente en days (ver la RELECTURA de la sonda 05).
TXT
