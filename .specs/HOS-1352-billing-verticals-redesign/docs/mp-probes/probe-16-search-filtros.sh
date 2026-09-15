#!/usr/bin/env bash
# =============================================================================
# SONDA 16 — ¿Por qué filtra de verdad `/preapproval/search`?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Completa `RC-1` (§23, reconciliación).
#
# LA PREGUNTA, Y POR QUÉ NO ES ACADÉMICA
# --------------------------------------
# Ya está medido que el `search` **ignora `external_reference` en silencio**:
# devuelve el catálogo entero con nuestra referencia, con una válida ajena y
# con basura. Un filtro que se ignora no devuelve error: devuelve TODO. Un
# reconciliador que confíe en él va a leer la primera fila de una lista que no
# filtró nada y tratarla como "la suscripción del cliente X".
#
# Lo que falta saber es de qué OTROS filtros se puede depender, porque de eso
# depende si un barrido de conciliación es posible sin guardar el id del
# proveedor para cada fila local.
#
# EL MÉTODO: EL CONTROL CON BASURA
# --------------------------------
# Preguntar con un valor válido no distingue nada — un filtro que funciona y
# uno que se ignora pueden devolver resultados los dos. Lo que distingue es
# preguntar con un valor que NO puede matchear:
#
#   basura → 0 resultados  ⇒ el filtro se aplica
#   basura → N resultados  ⇒ el filtro SE IGNORA (y N suele ser el total)
#
# Por eso cada filtro se pregunta tres veces: sin filtro (línea de base), con
# un valor real, y con basura.
#
# ES DE SÓLO LECTURA. No crea, no muta y no cancela nada.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-16-search-filtros.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-16}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

echo "############ SONDA 16 — filtros del search · $(date -Is)"
echo "############ salida: $OUT"

TOTAL=""

consultar() { # <etiqueta> <query-string> <qué se espera distinguir>
  local et="$1" qs="$2" que="$3" code total n
  code=$(curl -sS -o "$OUT/$et.json" -w '%{http_code}' \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/preapproval/search?$qs")
  total=$(jq -r '.paging.total // "?"' "$OUT/$et.json")
  n=$(jq -r '(.results // []) | length' "$OUT/$et.json")

  # El diagnóstico va a STDERR y el total por STDOUT: la línea de base se
  # captura por sustitución de comandos, y si el texto saliera por stdout
  # quedaría DENTRO de la variable y el veredicto compararía contra el texto.
  printf '  %-26s HTTP %-3s · total %-6s · devueltos %-4s · %s\n' "$et" "$code" "$total" "$n" "$que" >&2
  [ "$code" = "200" ] || printf '      error: %s\n' \
    "$(jq -c '{message, error, cause}' "$OUT/$et.json" 2>/dev/null)" >&2
  printf '%s' "$total"
}

echo
echo "######## línea de base — sin ningún filtro"
TOTAL=$(consultar base "limit=1" "cuántas suscripciones ve esta cuenta")
echo "         → cualquier consulta que devuelva $TOTAL no filtró nada."

echo
echo "######## payer_email"
consultar email-real  "limit=1&payer_email=$MP_BUYER_EMAIL" "el comprador real" >/dev/null
consultar email-basura "limit=1&payer_email=nadie-$STAMP@testuser.com" "CONTROL: nadie tiene este mail" >/dev/null

echo
echo "######## status"
for s in authorized pending cancelled paused; do
  consultar "status-$s" "limit=1&status=$s" "estado real del modelo" >/dev/null
done
consultar status-basura "limit=1&status=chupacabra" "CONTROL: estado que no existe" >/dev/null

echo
echo "######## external_reference — se re-verifica lo ya medido en RC-1"
consultar xref-basura "limit=1&external_reference=HOS-1352-no-existe-$STAMP" "CONTROL: referencia inventada" >/dev/null

echo
echo "######## combinado — ¿se componen los filtros que sí andan?"
consultar combinado "limit=1&status=authorized&payer_email=$MP_BUYER_EMAIL" "status + payer_email" >/dev/null
consultar combinado-imposible "limit=1&status=authorized&payer_email=nadie-$STAMP@testuser.com" \
  "CONTROL: un filtro real y uno imposible" >/dev/null

echo
echo "######## veredicto"
veredicto() { # <etiqueta-basura> <nombre del filtro>
  local t; t=$(jq -r '.paging.total // "?"' "$OUT/$1.json" 2>/dev/null)
  if [ "$t" = "0" ]; then printf '  %-20s SE APLICA (basura → 0)\n' "$2"
  elif [ "$t" = "$TOTAL" ]; then printf '  %-20s SE IGNORA (basura → %s, el total entero)\n' "$2" "$t"
  else printf '  %-20s ambiguo: basura → %s, total %s — mirar el JSON\n' "$2" "$t" "$TOTAL"; fi
}
veredicto email-basura       "payer_email"
veredicto status-basura      "status"
veredicto xref-basura        "external_reference"
veredicto combinado-imposible "status+payer_email"

echo
echo "############ fin · evidencia en $OUT"
