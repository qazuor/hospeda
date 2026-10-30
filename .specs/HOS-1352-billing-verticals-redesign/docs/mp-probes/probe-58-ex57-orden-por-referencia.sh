#!/usr/bin/env bash
# =============================================================================
# SONDA 58 — EX-57: ¿se encuentra una orden de `/v1/orders` por su
#            `external_reference` sin conocer su id?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# Programa: HOS-1352. Ojo: el número de la sonda (58) NO es el de la fila (EX-57).
#
# POR QUÉ EXISTE
# --------------
# `A3` sólo confirma y nunca crea: si la respuesta de `POST /v1/orders` se
# pierde, la instancia queda con su clave y SIN id de orden. La comprobación de
# órdenes pagadas (`B/09` §3) y el motivo 23 sin id (`DEC-CONC-001`) necesitan
# encontrar esa orden por lo único que tenemos: el `external_reference`.
#
# QUÉ SE MIDE (cada vía con control de basura: la misma búsqueda con una
# referencia que no existe, para distinguir «filtra» de «ignora el filtro»)
#   a1  GET /v1/orders?begin_date&end_date&external_reference   (doc oficial:
#       «Search orders», begin_date/end_date obligatorios; SDK Node
#       src/clients/order/search)
#   a2  GET /v1/orders?external_reference                         (sin fechas)
#   a3  GET /v1/orders/search?external_reference                  (el que se adivina)
#   a0  GET /v1/orders?begin_date&end_date                        (sin ref: total base)
#   b1  GET /v1/payments/search?external_reference                (¿la orden propaga
#       su ref al pago?)
#   b2  GET /v1/payments/{reference_id del pago de la orden}      (qué ref lleva)
#   c1  GET /merchant_orders/search?external_reference
# Casos: orden APRO (aprobada) y orden OTHE (rechazo: 402 con la orden adentro,
# EX-30 / sonda 56·06). Lecturas a t0, +2 min y +10 min.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=... bash probe-58-ex57-orden-por-referencia.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-58}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

# Guard de entorno (sonda 42/56): sólo corre contra la cuenta de PRUEBAS.
curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me" | jq -e '.tags | index("test_user")' >/dev/null \
  || { echo "ABORTA: las credenciales no son de la cuenta de pruebas"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante\tronda\tvia\tref\thttp\ttotal\tids_devueltos\tnota\n' > "$BITACORA"
echo "run=$STAMP" > "$OUT/run.txt"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json')
MASTER="5031755734530604"   # master crédito MLA de prueba (sondas 51/52/56)
BEGIN="$(date -u -d '-1 day' +%Y-%m-%dT%H:%M:%SZ)"

REF_A="HOS-1352-s58-$STAMP-APRO"
REF_R="HOS-1352-s58-$STAMP-OTHE"
REF_X="HOS-1352-s58-$STAMP-INEXISTENTE"

tokenizar() { # <titular>
  curl -sS -X POST "$API/v1/card_tokens" "${H[@]}" --data-raw "$(jq -cn --arg num "$MASTER" --arg n "$1" '{
    card_number:$num, security_code:"123", expiration_month:11, expiration_year:2030,
    cardholder:{name:$n, identification:{type:"DNI", number:"12345678"}}}')" | jq -r '.id // empty'
}
llamar() { # <metodo> <url> <archivo> [cuerpo] [clave-idempotencia]
  local code n=0 espera=5 extra=() data=()
  [ -n "${5:-}" ] && extra=(-H "X-Idempotency-Key: $5")
  [ -n "${4:-}" ] && data=(--data-raw "$4")
  while : ; do
    code=$(curl -sS -o "$3" -w '%{http_code}' -X "$1" "$2" "${H[@]}" "${extra[@]}" "${data[@]}")
    [ "$code" = "429" ] || break
    n=$((n + 1)); [ "$n" -le 5 ] || break
    sleep "$espera"; espera=$((espera * 2))
  done
  printf '%s' "$code"
}
anotar() { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$BITACORA"
  printf '  %-4s %-3s %-12s HTTP %-3s total=%-5s ids=%-60s %s\n' "$2" "$3" "${4##*-}" "$5" "$6" "$7" "$8"; }

echo "############ SONDA 58 · $(date -Is) · run=$STAMP · FASE=${FASE:-medir}"

# --- FASE=complemento: sólo lecturas, sobre órdenes ya creadas -------------------
# Qué agrega: (k1) ¿el filtro es exacto o por prefijo?; (k2) ¿la ventana de
# fechas filtra por creación?; (k3) ¿qué ventana máxima acepta, y encuentra una
# orden de ayer (sonda 56·06)?; (k4) ¿`/v1/payments/search` necesita fechas y
# encuentra la de ayer? Parámetros: RUN58 (stamp de la corrida medir).
if [ "${FASE:-medir}" = complemento ]; then
  : "${RUN58:?falta RUN58}"
  enc() { jq -rn --arg v "$1" '$v|@uri'; }
  q() { # <tag> <path?query>
    local f="$OUT/comp-$1.json" c
    c=$(llamar GET "$API$2" "$f")
    printf '%s\tcomp\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -Ins)" "$1" "$2" "$c" \
      "$(jq -r '(.paging.total // "-")|tostring' "$f" 2>/dev/null)" \
      "$(jq -r '[(.data // .results // [])[]? | "\(.id)@\(.external_reference // "null")@\(.created_date // .date_created)"] | .[0:4] | join(",")' "$f" 2>/dev/null | cut -c1-240)" \
      "$(jq -c '.errors // .message // empty' "$f" 2>/dev/null | cut -c1-160)" | tee -a "$BITACORA" | cut -f3-
  }
  d() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }
  NOW1="$(d '+1 hour')"
  REF_OK="HOS-1352-s58-$RUN58-APRO"
  REF_AYER="HOS-1352-s56-20260929T151232Z-06"
  q k1-prefijo  "/v1/orders?begin_date=$(enc "$(d '-1 day')")&end_date=$(enc "$NOW1")&external_reference=$(enc "HOS-1352-s58-$RUN58")"
  q k1-exacto   "/v1/orders?begin_date=$(enc "$(d '-1 day')")&end_date=$(enc "$NOW1")&external_reference=$(enc "$REF_OK")"
  q k2-ventana-posterior "/v1/orders?begin_date=$(enc "$(d '-5 min')")&end_date=$(enc "$NOW1")&external_reference=$(enc "$REF_OK")"
  for dias in 2 7 30 31 60 90 91 180 365; do
    q "k3-ayer-${dias}d" "/v1/orders?begin_date=$(enc "$(d "-$dias day")")&end_date=$(enc "$NOW1")&external_reference=$(enc "$REF_AYER")"
  done
  # Borde de la ventana (el 30d+1h dio `maximum allowed is 1 month`):
  NOW0="$(d 'now')"
  for rango in "29 day" "30 day" "30 day +1 min" "30 day -1 min"; do
    q "k3b-${rango// /_}" "/v1/orders?begin_date=$(enc "$(d "-$rango")")&end_date=$(enc "$NOW0")&external_reference=$(enc "$REF_AYER")"
  done
  q k3-sin-ref-30d"/v1/orders?begin_date=$(enc "$(d '-30 day')")&end_date=$(enc "$NOW1")&page_size=5"
  q k4-pagos-ayer  "/v1/payments/search?external_reference=$(enc "$REF_AYER")"
  q k4-pagos-prefijo "/v1/payments/search?external_reference=$(enc "HOS-1352-s58-$RUN58")"
  exit 0
fi

# --- crear las dos órdenes ------------------------------------------------------
orden() { # <tag> <titular> <ref>
  local tok c
  tok=$(tokenizar "$2")
  c=$(llamar POST "$API/v1/orders" "$OUT/crear-$1.json" "$(jq -cn --arg t "$tok" --arg e "$MP_BUYER_EMAIL" --arg x "$3" '{
    type:"online", external_reference:$x, total_amount:"100.00", processing_mode:"automatic", payer:{email:$e},
    transactions:{payments:[{amount:"100.00", payment_method:{id:"master", type:"credit_card", token:$t, installments:1}}]}}')" "s58-$STAMP-$1")
  # Un 402 trae la orden en `.data` (sonda 56·06); un 201 la trae en la raíz.
  jq -c --arg c "$c" '(.data // .) as $o | {http:$c, id:$o.id, status:$o.status, status_detail:$o.status_detail,
     ext:$o.external_reference, pago:$o.transactions.payments[0].id, ref_pago:$o.transactions.payments[0].reference_id,
     estado_pago:$o.transactions.payments[0].status}' "$OUT/crear-$1.json" | tee "$OUT/resumen-$1.json"
}
orden APRO APRO "$REF_A"
orden OTHE OTHE "$REF_R"
OID_A=$(jq -r '.id // empty' "$OUT/resumen-APRO.json");  PAY_A=$(jq -r '.ref_pago // empty' "$OUT/resumen-APRO.json")
OID_R=$(jq -r '.id // empty' "$OUT/resumen-OTHE.json");  PAY_R=$(jq -r '.ref_pago // empty' "$OUT/resumen-OTHE.json")
echo "O_A=$OID_A pago=$PAY_A · O_R=$OID_R pago=$PAY_R"

# --- lecturas --------------------------------------------------------------------
enc() { jq -rn --arg v "$1" '$v|@uri'; }
# Resume una respuesta de búsqueda: total e ids, sea cual sea la forma
# (orders: {data,paging}; payments/merchant_orders: {results|elements, paging}).
resumir_total() { jq -r '(.paging.total // .total // (.data|length?) // (.results|length?) // (.elements|length?) // "-")|tostring' "$1" 2>/dev/null || echo "-"; }
resumir_ids() { jq -r '[(.data // .results // .elements // [])[]? | "\(.id)@\(.external_reference // "null")"] | .[0:6] | join(",")' "$1" 2>/dev/null | cut -c1-200; }

ronda() { # <etiqueta>
  local r=$1 t f c END
  END="$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
  echo "---- ronda $r · $(date -Is)"
  f="$OUT/$r-a0.json"; t=$(date -Ins)
  c=$(llamar GET "$API/v1/orders?begin_date=$(enc "$BEGIN")&end_date=$(enc "$END")&page_size=50" "$f")
  anotar "$t" "$r" a0 "(sin-ref)" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // .error // empty' "$f" 2>/dev/null | cut -c1-80)"
  for par in "A:$REF_A" "R:$REF_R" "X:$REF_X"; do
    local k=${par%%:*} ref=${par#*:}
    f="$OUT/$r-a1-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/v1/orders?begin_date=$(enc "$BEGIN")&end_date=$(enc "$END")&external_reference=$(enc "$ref")" "$f")
    anotar "$t" "$r" a1 "$ref" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // .errors // empty' "$f" 2>/dev/null | cut -c1-80)"
    f="$OUT/$r-a2-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/v1/orders?external_reference=$(enc "$ref")" "$f")
    anotar "$t" "$r" a2 "$ref" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // .errors // empty' "$f" 2>/dev/null | cut -c1-120)"
    f="$OUT/$r-a3-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/v1/orders/search?external_reference=$(enc "$ref")" "$f")
    anotar "$t" "$r" a3 "$ref" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // .errors // empty' "$f" 2>/dev/null | cut -c1-120)"
    f="$OUT/$r-b1-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/v1/payments/search?external_reference=$(enc "$ref")&limit=10" "$f")
    anotar "$t" "$r" b1 "$ref" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // empty' "$f" 2>/dev/null | cut -c1-80)"
    f="$OUT/$r-c1-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/merchant_orders/search?external_reference=$(enc "$ref")" "$f")
    anotar "$t" "$r" c1 "$ref" "$c" "$(resumir_total "$f")" "$(resumir_ids "$f")" "$(jq -c '.message // empty' "$f" 2>/dev/null | cut -c1-80)"
  done
  for par in "A:$PAY_A" "R:$PAY_R"; do
    local k=${par%%:*} pid=${par#*:}
    [ -n "$pid" ] || continue
    f="$OUT/$r-b2-$k.json"; t=$(date -Ins)
    c=$(llamar GET "$API/v1/payments/$pid" "$f")
    anotar "$t" "$r" b2 "pago:$pid" "$c" "-" "$(jq -r '"\(.id)@\(.external_reference // "null")"' "$f" 2>/dev/null)" \
      "$(jq -c '{status, status_detail, order, metadata, description}' "$f" 2>/dev/null | cut -c1-160)"
  done
}

ronda t0
sleep "${ESPERA_1:-120}"; ronda t2
sleep "${ESPERA_2:-480}"; ronda t10

echo; column -t -s$'\t' "$BITACORA"
echo "############ FIN · $(date -Is) · run=$STAMP · O_A=$OID_A · O_R=$OID_R"
