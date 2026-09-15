#!/usr/bin/env bash
# =============================================================================
# SONDA 01 — Preapproval sin autorizar
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352 — rediseño de Verticales y Billing.
# Cubre las filas de 06-mp-validation-matrix.md que NO requieren una
# suscripción autorizada por el pagador.
#
# Credenciales: se leen del entorno. NUNCA se escriben acá ni en el repo.
#   source <ruta-fuera-del-repo>/creds.sh && bash probe-01-preapproval-unauthorized.sh
#
# Registra request y response de cada prueba (PDR §59) en el directorio de
# salida, para que otro agente pueda reproducir y auditar meses después.
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-01}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN — hacé source del archivo de credenciales}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

BACK_URL="https://www.hospeda.com.ar"
CREATED_IDS="$OUT/created-preapproval-ids.txt"
: > "$CREATED_IDS"

# --- helpers ----------------------------------------------------------------
n=0
# call <nombre> <metodo> <path> [body]
call() {
  n=$((n + 1))
  local name="$1" method="$2" path="$3" body="${4:-}"
  local tag; tag="$(printf '%02d' "$n")-${name}"
  local code

  if [ -n "$body" ]; then
    printf '%s' "$body" > "$OUT/$tag.request.json"
    code=$(curl -sS -o "$OUT/$tag.response.json" -w '%{http_code}' \
      -X "$method" "$API$path" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
      -H 'Content-Type: application/json' \
      --data-raw "$body")
  else
    printf '(sin body) %s %s\n' "$method" "$path" > "$OUT/$tag.request.json"
    code=$(curl -sS -o "$OUT/$tag.response.json" -w '%{http_code}' \
      -X "$method" "$API$path" \
      -H "Authorization: Bearer $MP_ACCESS_TOKEN")
  fi

  echo "$code" > "$OUT/$tag.status"
  printf '\n=== %s → HTTP %s\n' "$tag" "$code"
  jq -c 'if type=="object" then
           {id, status, reason, external_reference,
            init_point: (if .init_point then "(presente)" else null end),
            next_payment_date, date_created,
            auto_recurring, items,
            message, error, cause}
           | with_entries(select(.value != null))
         else . end' "$OUT/$tag.response.json" 2>/dev/null \
    || head -c 400 "$OUT/$tag.response.json"

  # guardar ids creados para poder limpiar
  jq -r 'select(type=="object") | .id // empty' "$OUT/$tag.response.json" 2>/dev/null \
    | grep -E '^[0-9a-f]{32}$' >> "$CREATED_IDS" || true
}

pre_body() { # <reason> <frequency> <frequency_type> <amount> [extra_auto_recurring] [extra_root]
  local reason="$1" freq="$2" ftype="$3" amount="$4" extra_ar="${5:-}" extra_root="${6:-}"
  jq -cn --arg reason "$reason" --arg email "$MP_BUYER_EMAIL" --arg back "$BACK_URL" \
     --argjson freq "$freq" --arg ftype "$ftype" --argjson amount "$amount" \
     --argjson extra_ar "${extra_ar:-{\}}" --argjson extra_root "${extra_root:-{\}}" '
    {reason: $reason, payer_email: $email, back_url: $back, status: "pending",
     external_reference: ("HOS-1352-" + $reason),
     auto_recurring: ({frequency: $freq, frequency_type: $ftype,
                       transaction_amount: $amount, currency_id: "ARS"} + $extra_ar)
    } + $extra_root'
}

echo "############ SONDA 01 — preapproval sin autorizar"
echo "############ $(date -Is) · salida: $OUT"

# --- PA-1 / PA-2: creación por API y linking con nuestro dominio -------------
echo; echo "######## PA-1 + PA-2 — creación por API y external_reference"
call "PA1-crear-basico" POST /preapproval "$(pre_body "pa1-basico" 1 months 1500)"

# --- FR-1..FR-4: las cuatro frecuencias del §19 ------------------------------
echo; echo "######## FR-1..FR-4 — mensual, trimestral, semestral, anual"
call "FR1-mensual"     POST /preapproval "$(pre_body "fr1-mensual"     1  months 1500)"
call "FR2-trimestral"  POST /preapproval "$(pre_body "fr2-trimestral"  3  months 4000)"
call "FR3-semestral"   POST /preapproval "$(pre_body "fr3-semestral"   6  months 7500)"
call "FR4-anual-months" POST /preapproval "$(pre_body "fr4-anual"      12 months 14000)"
echo "   -- error path: frequency_type 'years' --"
call "FR4-anual-years" POST /preapproval "$(pre_body "fr4-years" 1 years 14000)"
echo "   -- error path: frecuencia arbitraria (5 meses) --"
call "FR5-cinco-meses" POST /preapproval "$(pre_body "fr5-cinco" 5 months 5000)"

# --- PC-2: límites de monto (piso, cero, negativo) ---------------------------
echo; echo "######## PC-2 — límites de monto"
call "PC2-monto-1"     POST /preapproval "$(pre_body "pc2-uno"  1 months 1)"
call "PC2-monto-0"     POST /preapproval "$(pre_body "pc2-cero" 1 months 0)"
call "PC2-monto-neg"   POST /preapproval "$(pre_body "pc2-neg"  1 months -100)"

# --- EX-5: ¿una autorización puede cubrir más de un monto? -------------------
echo; echo "######## EX-5 — ¿un preapproval cubre más de un ítem?"
echo "   -- variante A: auto_recurring como array --"
ARR=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg b "$BACK_URL" '{
  reason:"ex5-array", payer_email:$e, back_url:$b, status:"pending",
  external_reference:"HOS-1352-ex5-array",
  auto_recurring:[{frequency:1,frequency_type:"months",transaction_amount:1500,currency_id:"ARS"},
                  {frequency:1,frequency_type:"months",transaction_amount:800,currency_id:"ARS"}]}')
call "EX5-array" POST /preapproval "$ARR"
echo "   -- variante B: campo items con dos líneas --"
ITEMS=$(jq -cn --arg e "$MP_BUYER_EMAIL" --arg b "$BACK_URL" '{
  reason:"ex5-items", payer_email:$e, back_url:$b, status:"pending",
  external_reference:"HOS-1352-ex5-items",
  auto_recurring:{frequency:1,frequency_type:"months",transaction_amount:1500,currency_id:"ARS"},
  items:[{title:"Plan Basic",unit_price:1500,quantity:1},
         {title:"Addon +20 fotos",unit_price:800,quantity:1}]}')
call "EX5-items" POST /preapproval "$ITEMS"

# --- EX-7: primera fecha de cobro corrida (compensación en días) -------------
echo; echo "######## EX-7 — start_date futura: ¿corre la primera fecha de cobro?"
FUTURE=$(date -u -d '+20 days' +%Y-%m-%dT%H:%M:%S.000Z)
echo "   start_date solicitada: $FUTURE"
call "EX7-start-date-futura" POST /preapproval \
  "$(pre_body "ex7-corrida" 1 months 1500 "$(jq -cn --arg d "$FUTURE" '{start_date:$d}')")"

# --- RC-1: ¿el estado que devuelve el GET coincide con el del search? --------
echo; echo "######## RC-1 + PA-5 — cancelación, irreversibilidad, y GET vs search"
VICTIM=$(head -1 "$CREATED_IDS")
if [ -n "${VICTIM:-}" ]; then
  echo "   sujeto: $VICTIM"
  call "RC1-get-antes"   GET "/preapproval/$VICTIM"
  call "PA5-cancelar"    PUT "/preapproval/$VICTIM" '{"status":"cancelled"}'
  call "PA5-recancelar"  PUT "/preapproval/$VICTIM" '{"status":"cancelled"}'
  call "RC1-get-despues" GET "/preapproval/$VICTIM"
  echo "   -- el search puede tardar en reflejar el cambio: se consulta inmediatamente --"
  call "RC1-search" GET "/preapproval/search?external_reference=HOS-1352-pa1-basico"
else
  echo "   !! no se creó ningún preapproval: no hay sujeto para PA-5/RC-1"
fi

echo; echo "############ FIN. Requests y responses completos en $OUT"
echo "############ preapprovals creados:"; cat "$CREATED_IDS"
