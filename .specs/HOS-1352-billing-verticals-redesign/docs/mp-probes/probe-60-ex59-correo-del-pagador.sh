#!/usr/bin/env bash
# =============================================================================
# SONDA 60 — EX-59: ¿alguna lectura trae el correo del pagador de un
#            preapproval cuyo GET lo trae vacío?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352, mediciones del 2026-09-30 (EX-57/58/59). El número de la
# sonda (60) NO es el de la fila (EX-59).
#
# SÓLO LECTURA. No crea, no modifica, no cancela nada. Sujetos: preapprovals
# ya existentes en sandbox (por defecto los tres vivos a propósito de las
# sondas 53 y del anexo del 29/09). Se pueden pasar otros por SUJETOS="id id".
#
# QUÉ MIDE, por sujeto
#   A  GET /preapproval/{id}                                → payer_email (EX-19)
#   B  GET /preapproval/search (sin filtro, paginado)       → la fila del sujeto
#   C  GET /preapproval/search?payer_email=<correo>         → ¿vuelve el sujeto?
#      + control de basura (correo inexistente)             → filtra o ignora
#   D  GET /preapproval/search?payer_id=<payer_id> + basura → (sin documentar)
#   E  GET /authorized_payments/search?preapproval_id=      → campos de pagador
#   F  GET /authorized_payments/{id}                        → ídem (EX-16: 404)
#   G  GET /v1/payments/{payment.id}                        → payer.email
#   H  GET /v1/payments/search?external_reference=<ref>     → payer.email
#      + control de basura
#   I  GET /users/{payer_id}                                → ¿trae email?
# En cada respuesta se listan TODAS las rutas JSON cuyo valor contiene '@'
# (no sólo los campos con nombre conocido), y el valor se enmascara.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && OUT_DIR=... bash probe-60-ex59-correo-del-pagador.sh
#
# VARIANTE PRODUCCIÓN (PREPARADA, NO SE CORRE SIN DECISIÓN DEL OWNER)
# -------------------------------------------------------------------
# Con ENTORNO=produccion la sonda NO aborta por falta de `test_user`; exige en
# cambio las tres guardas siguientes, y sigue siendo SÓLO GET:
#   1. CONFIRMO_PRODUCCION_SOLO_LECTURA=si  (acto explícito)
#   2. SUJETOS con ids concretos (nunca el default de sandbox)
#   3. CORREO_CANDIDATO para el paso C (si falta, C se saltea)
# y `llamar` rechaza cualquier método que no sea GET. El token de producción lo
# carga el owner en MP_ACCESS_TOKEN; esta sonda no lee ningún archivo de
# credenciales de producción.
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-60}"
ENTORNO="${ENTORNO:-sandbox}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"

YO=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me")
if [ "$ENTORNO" = "sandbox" ]; then
  # Guard de entorno (sonda 42/56): sólo corre contra la cuenta de PRUEBAS.
  printf '%s' "$YO" | jq -e '.tags | index("test_user")' >/dev/null \
    || { echo "ABORTA: las credenciales no son de la cuenta de pruebas"; exit 1; }
  : "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"
  CORREO_CANDIDATO="${CORREO_CANDIDATO:-$MP_BUYER_EMAIL}"
  SUJETOS="${SUJETOS:-b12af185fca2497488a3ad8d88397a66 e676665043ad46359b4089bc621bed20 a459aa5013be493194dc0c8c89c30494}"
elif [ "$ENTORNO" = "produccion" ]; then
  [ "${CONFIRMO_PRODUCCION_SOLO_LECTURA:-}" = "si" ] || { echo "ABORTA: falta CONFIRMO_PRODUCCION_SOLO_LECTURA=si"; exit 1; }
  printf '%s' "$YO" | jq -e '.tags | index("test_user")' >/dev/null \
    && { echo "ABORTA: ENTORNO=produccion con un token de PRUEBAS"; exit 1; }
  [ -n "${SUJETOS:-}" ] || { echo "ABORTA: en producción SUJETOS es obligatorio"; exit 1; }
  CORREO_CANDIDATO="${CORREO_CANDIDATO:-}"
else
  echo "ABORTA: ENTORNO desconocido: $ENTORNO"; exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BITACORA="$OUT/bitacora-$STAMP.tsv"
printf 'instante\tsujeto\tpaso\tlectura\thttp\tresultado\n' > "$BITACORA"
echo "run=$STAMP entorno=$ENTORNO" > "$OUT/run.txt"
H=(-H "Authorization: Bearer $MP_ACCESS_TOKEN")
BASURA="no-existe-hos1352-s60-$STAMP@example.invalid"

anotar() {
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$BITACORA"
  printf '  %-8s %-3s %-58s HTTP %-3s → %s\n' "${2:0:8}" "$3" "$4" "$5" "$6"
}
llamar() { # <url> <archivo>   — SÓLO GET, con reintento ante 429
  local code n=0 espera=5
  while : ; do
    code=$(curl -sS -o "$2" -w '%{http_code}' -X GET "$1" "${H[@]}")
    [ "$code" = "429" ] || break
    n=$((n + 1)); [ "$n" -le 5 ] || break
    sleep "$espera"; espera=$((espera * 2))
  done
  printf '%s' "$code"
}
# Rutas JSON con un string que contiene '@', valor enmascarado (3 chars + dominio).
arrobas() { # <archivo> [filtro-jq-previo]
  jq -r "${2:-.}"' | [paths(strings) as $p | select(getpath($p) | test("@"))
     | "\($p | map(tostring) | join("."))=\(getpath($p) | sub("^(?<a>.{0,3})[^@]*@"; "\(.a)***@"))"]
     | if length == 0 then "SIN @" else join(" ") end' "$1" 2>/dev/null || echo "no-json"
}

echo "############ SONDA 60 · $(date -Is) · run=$STAMP · entorno=$ENTORNO"

# --- B: el buscador SIN filtro, paginado entero una vez ----------------------
SIN="$OUT/B-search-sin-filtro.json"; echo '[]' > "$SIN"
off=0; total=0
while : ; do
  f="$OUT/B-page-$off.json"; t=$(date -Ins)
  c=$(llamar "$API/preapproval/search?limit=100&offset=$off&sort=date_created:desc" "$f")
  [ "$c" = "200" ] || { anotar "$t" "-" B "preapproval/search sin filtro offset=$off" "$c" "$(head -c 150 "$f")"; break; }
  total=$(jq -r '.paging.total' "$f")
  jq -s '.[0] + .[1].results' "$SIN" "$f" > "$SIN.tmp" && mv "$SIN.tmp" "$SIN"
  off=$((off + 100)); [ "$off" -lt "$total" ] && [ "$off" -lt 10000 ] || break
done
FILAS=$(jq 'length' "$SIN")
CONMAIL=$(jq '[.[] | select((.payer_email // "") != "")] | length' "$SIN")
anotar "$(date -Ins)" "-" B "preapproval/search sin filtro (paginado)" "200" \
  "filas=$FILAS total=$total · con payer_email no vacío=$CONMAIL · rutas con @ en filas: $(jq -c '[.[] | [paths(strings) as $p | select(getpath($p)|test("@")) | ($p|map(tostring)|join("."))]] | flatten | group_by(.) | map({(.[0]):length}) | add // {}' "$SIN")"

# --- C: filtro por correo + basura --------------------------------------------
if [ -n "$CORREO_CANDIDATO" ]; then
  # Paginado entero (la primera corrida leyó sólo 100 de 135 y dio un NO falso).
  enc=$(jq -rn --arg e "$CORREO_CANDIDATO" '$e|@uri'); t=$(date -Ins)
  echo '{"results":[]}' > "$OUT/C-search-correo.json"; off=0; ctot=0
  while : ; do
    c=$(llamar "$API/preapproval/search?payer_email=$enc&limit=100&offset=$off" "$OUT/C-page-$off.json")
    [ "$c" = "200" ] || break
    ctot=$(jq -r '.paging.total' "$OUT/C-page-$off.json")
    jq -s '{results: (.[0].results + .[1].results), paging: .[1].paging}' "$OUT/C-search-correo.json" "$OUT/C-page-$off.json" > "$OUT/C.tmp" && mv "$OUT/C.tmp" "$OUT/C-search-correo.json"
    off=$((off + 100)); [ "$off" -lt "$ctot" ] || break
  done
  anotar "$t" "-" C "preapproval/search?payer_email=<candidato> (paginado)" "$c" \
    "total=$ctot leídas=$(jq '.results | length' "$OUT/C-search-correo.json") · con payer_email no vacío=$(jq '[.results[]? | select((.payer_email // "") != "")] | length' "$OUT/C-search-correo.json")"
  encb=$(jq -rn --arg e "$BASURA" '$e|@uri'); t=$(date -Ins)
  c=$(llamar "$API/preapproval/search?payer_email=$encb&limit=100" "$OUT/C-search-basura.json")
  anotar "$t" "-" C "preapproval/search?payer_email=<basura>" "$c" "total=$(jq -r '.paging.total' "$OUT/C-search-basura.json")"
fi

# --- por sujeto -----------------------------------------------------------------
for P in $SUJETOS; do
  s="$OUT/$P"; mkdir -p "$s"
  t=$(date -Ins); c=$(llamar "$API/preapproval/$P" "$s/A.json")
  PAYER=$(jq -r '.payer_id // empty' "$s/A.json"); REF=$(jq -r '.external_reference // empty' "$s/A.json")
  anotar "$t" "$P" A "GET /preapproval/{id}" "$c" \
    "payer_email=$(jq -c '.payer_email' "$s/A.json") payer_id=$PAYER status=$(jq -r .status "$s/A.json") · @: $(arrobas "$s/A.json")"

  anotar "$(date -Ins)" "$P" B "fila del sujeto en search sin filtro" "-" \
    "$(jq -r --arg p "$P" '[.[] | select(.id == $p)] | if length == 0 then "NO APARECE" else (.[0] | "payer_email=\(.payer_email|tojson) payer_id=\(.payer_id)") end' "$SIN") · @: $(arrobas "$SIN" "[.[] | select(.id == \"$P\")]")"

  if [ -n "$CORREO_CANDIDATO" ]; then
    anotar "$(date -Ins)" "$P" C "¿aparece en search?payer_email=<candidato>?" "-" \
      "$(jq -r --arg p "$P" 'if ([.results[]? | select(.id == $p)] | length) > 0 then "SÍ" else "NO" end' "$OUT/C-search-correo.json") · ¿en basura? $(jq -r --arg p "$P" 'if ([.results[]? | select(.id == $p)] | length) > 0 then "SÍ" else "NO" end' "$OUT/C-search-basura.json")"
  fi

  if [ -n "$PAYER" ]; then
    t=$(date -Ins); c=$(llamar "$API/preapproval/search?payer_id=$PAYER&limit=100" "$s/D.json")
    anotar "$t" "$P" D "preapproval/search?payer_id=<suyo>" "$c" \
      "total=$(jq -r '.paging.total // .message' "$s/D.json") · sujeto $(jq -r --arg p "$P" 'if ([.results[]? | select(.id == $p)] | length) > 0 then "SÍ" else "NO" end' "$s/D.json")"
    t=$(date -Ins); c=$(llamar "$API/preapproval/search?payer_id=1&limit=100" "$s/D-basura.json")
    anotar "$t" "$P" D "preapproval/search?payer_id=1 (basura)" "$c" "total=$(jq -r '.paging.total // .message' "$s/D-basura.json")"
  fi

  if [ -n "$PAYER" ]; then # I: la identidad pública del payer_id (EX-56)
    t=$(date -Ins); c=$(llamar "$API/users/$PAYER" "$s/I.json")
    anotar "$t" "$P" I "GET /users/{payer_id}" "$c" \
      "user_type=$(jq -r '.user_type // .message' "$s/I.json") claves=$(jq -c 'keys' "$s/I.json") · ¿trae email? $(jq -r 'has("email")' "$s/I.json")"
  fi

  t=$(date -Ins); c=$(llamar "$API/authorized_payments/search?preapproval_id=$P" "$s/E.json")
  anotar "$t" "$P" E "authorized_payments/search?preapproval_id=" "$c" \
    "n=$(jq -r '.results | length' "$s/E.json") · claves payer*: $(jq -c '[.results[]? | keys[] | select(test("payer"))] | unique' "$s/E.json") · @: $(arrobas "$s/E.json")"

  for AP in $(jq -r '.results[]?.id' "$s/E.json"); do
    t=$(date -Ins); c=$(llamar "$API/authorized_payments/$AP" "$s/F-$AP.json")
    anotar "$t" "$P" F "GET /authorized_payments/$AP" "$c" "@: $(arrobas "$s/F-$AP.json")"
  done

  for PAY in $(jq -r '.results[]?.payment.id // empty' "$s/E.json"); do
    t=$(date -Ins); c=$(llamar "$API/v1/payments/$PAY" "$s/G-$PAY.json")
    anotar "$t" "$P" G "GET /v1/payments/$PAY" "$c" \
      "¿=candidato? $(jq -r --arg e "$CORREO_CANDIDATO" 'if (.payer.email // "") == $e then "SÍ" else "NO" end' "$s/G-$PAY.json") payer.email=$(jq -r '.payer.email // "null" | sub("^(?<a>.{0,3})[^@]*@"; "\(.a)***@")' "$s/G-$PAY.json") payer.id=$(jq -r '.payer.id // "null"' "$s/G-$PAY.json") ext_ref=$(jq -r '.external_reference // "null"' "$s/G-$PAY.json") · @: $(arrobas "$s/G-$PAY.json")"
  done

  if [ -n "$REF" ]; then
    encr=$(jq -rn --arg e "$REF" '$e|@uri'); t=$(date -Ins)
    c=$(llamar "$API/v1/payments/search?external_reference=$encr" "$s/H.json")
    anotar "$t" "$P" H "v1/payments/search?external_reference=<suya>" "$c" \
      "total=$(jq -r '.paging.total // .message' "$s/H.json") · payer.email: $(jq -r '[.results[]? | .payer.email // "null" | sub("^(?<a>.{0,3})[^@]*@"; "\(.a)***@")] | join(",")' "$s/H.json")"
    t=$(date -Ins); c=$(llamar "$API/v1/payments/search?external_reference=no-existe-s60-$STAMP" "$s/H-basura.json")
    anotar "$t" "$P" H "v1/payments/search?external_reference=<basura>" "$c" "total=$(jq -r '.paging.total // .message' "$s/H-basura.json")"
  fi
done

echo; column -t -s$'\t' "$BITACORA"
echo "############ FIN · $(date -Is) · run=$STAMP"
