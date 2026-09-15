#!/usr/bin/env bash
# =============================================================================
# SONDA 08 (lector) — qué mandó Mercado Pago, tal cual lo mandó
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Lee lo que acumuló el Worker de
# `probe-08-webhook-sink/worker.js` y lo muestra sin interpretarlo.
#
# Cubre WH-1 (duplicados), WH-2 (demorados), WH-3 (fuera de orden),
# WH-4 (reintentos), WH-5 (faltantes) y EX-2 (orden confiable), más la
# pregunta que hasta ahora era inobservable: **si la firma se puede verificar**.
#
# Por qué existe este lector y no se mira staging: la tabla de staging guarda
# el evento YA NORMALIZADO por nuestro código —el proveedor manda
# `subscription_authorized_payment` y el log lo llama `invoice.updated`— y no
# guarda headers, así que `x-signature` no se ve. El §58 exige medir al
# proveedor, no a nuestra lectura de él.
#
# ⚠ EL LISTADO DE KV ES EVENTUALMENTE CONSISTENTE. Medido el 2026-09-15: se
# mandaron 3 eventos, el dump inmediato mostró 1, después mostró 0, y un
# borrado posterior todavía encontró 1. O sea que **un `total: 0` recién
# ocurrido NO significa que el proveedor no haya mandado nada**: significa que
# el listado todavía no lo ve. Esperar ~60 s antes de concluir una ausencia,
# y para WH-5 (un evento que nunca llega) esperar mucho más que eso.
#
#   SINK_URL=https://... bash probe-08-leer-webhooks.sh            # resumen
#   SINK_URL=https://... bash probe-08-leer-webhooks.sh --crudo    # todo, en JSON
#   SINK_URL=https://... bash probe-08-leer-webhooks.sh --fail     # 500 → provoca reintentos
#   SINK_URL=https://... bash probe-08-leer-webhooks.sh --ok       # vuelve a 200
#   SINK_URL=https://... bash probe-08-leer-webhooks.sh --borrar   # vacía lo acumulado
#
# El token se lee de ~/.config/hospeda/hos1352-sink-token.txt y NUNCA se
# imprime: este script queda versionado en el repo.
# =============================================================================
set -uo pipefail

: "${SINK_URL:?falta SINK_URL — la URL del Worker receptor}"
TOKEN_FILE="${TOKEN_FILE:-$HOME/.config/hospeda/hos1352-sink-token.txt}"
[ -f "$TOKEN_FILE" ] || { echo "no está $TOKEN_FILE"; exit 1; }
TOKEN="$(tr -d '\n' < "$TOKEN_FILE")"

modo() { curl -sS -X POST "$SINK_URL/mode?t=$TOKEN&m=$1" | jq -c .; }

case "${1:-}" in
  --fail)   echo "el receptor pasa a responder 500: Mercado Pago va a reintentar"; modo fail; exit ;;
  --ok)     echo "el receptor vuelve a responder 200"; modo ok; exit ;;
  --borrar) curl -sS -X DELETE "$SINK_URL/dump?t=$TOKEN" | jq -c .; exit ;;
esac

RESP="$(curl -sS "$SINK_URL/dump?t=$TOKEN")"
printf '%s' "$RESP" | jq -e '.eventos' >/dev/null 2>&1 || {
  echo "el receptor no devolvió lo esperado:"; printf '%s\n' "${RESP:0:300}"; exit 1; }

if [ "${1:-}" = "--crudo" ]; then printf '%s\n' "$RESP"; exit; fi

echo "############ SONDA 08 — lo recibido · $(date -Is)"
printf '%s' "$RESP" | jq -r '"total de entregas: \(.total)"'
if [ "$(printf '%s' "$RESP" | jq -r '.total')" = "0" ]; then
  echo
  echo "  ⚠ CERO NO ES UNA AUSENCIA TODAVÍA. El listado de KV es eventualmente"
  echo "    consistente: un evento recién llegado puede no aparecer. Esperá ~60 s"
  echo "    y volvé a leer antes de concluir que el proveedor no mandó nada."
fi
echo

# Una fila por entrega. `tipo` y `recurso` salen de la QUERY del POST, que es
# lo que manda el proveedor — no de ningún nombre nuestro.
echo "=== entregas, por instante de llegada ==="
printf '%s' "$RESP" | jq -r '
  .eventos[] |
  [ .llegada,
    (.query.type // .query.topic // "?"),
    (.query["data.id"] // .query.id // "?"),
    (.headers["x-request-id"] // "-"),
    (if .headers["x-signature"] then "firmado" else "SIN FIRMA" end)
  ] | @tsv' | column -t -s$'\t'

echo
echo "=== WH-1 / WH-4 — ¿el mismo recurso llegó más de una vez? ==="
printf '%s' "$RESP" | jq -r '
  .eventos
  | group_by((.query.type // .query.topic // "?") + "|" + (.query["data.id"] // .query.id // "?"))
  | map(select(length > 1))
  | if length == 0 then "  (ninguno repetido todavía)"
    else .[] | "  \(.[0].query.type // "?") · recurso \(.[0].query["data.id"] // "?") → \(length) entregas:\n" +
               (map("      \(.llegada)  id-de-evento \(.query.id // "-")") | join("\n"))
    end'

echo
echo "=== EX-2 — ¿el id del evento sirve para deduplicar? ==="
echo "  (si un mismo recurso llegó varias veces con IDS DISTINTOS, NO sirve:"
echo "   la clave de idempotencia tiene que salir de tipo + id del recurso)"

echo
echo "=== La firma: qué headers manda de verdad ==="
printf '%s' "$RESP" | jq -r '
  (.eventos[0].headers // {})
  | to_entries
  | map(select(.key | test("signature|request-id|timestamp|hook|mercado"; "i")))
  | if length == 0 then "  (sin headers de firma en la primera entrega)"
    else .[] | "  \(.key): \(.value)" end'

echo
echo "############ Para el detalle completo: --crudo"
