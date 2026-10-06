#!/usr/bin/env bash
# =============================================================================
# SONDA 17 — ¿Existe la casilla del comprador de prueba?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
# No se importa desde ningún lado, no participa de ningún build, no se deploya.
#
# Programa: HOS-1352. Decide si `EX-3` es medible en sandbox.
#
# LA PREGUNTA DE `EX-3`
# ---------------------
# Qué le comunica el proveedor al cliente POR SU CUENTA cuando cancelamos,
# pausamos o modificamos una suscripción. Importa para `M-MAIL-04`: si el
# proveedor ya le manda un correo al cliente diciendo que su suscripción se
# canceló, nuestro correo puede sonar redundante o —peor— contradictorio.
#
# EL PLAN OBVIO Y POR QUÉ SE MIDE ANTES
# -------------------------------------
# El plan era pedirle al owner acceso a la casilla del comprador de prueba y
# mirar qué llegó. Antes de pedir un acceso conviene comprobar que la casilla
# EXISTA: los compradores de prueba de Mercado Pago tienen direcciones del
# tipo `test_user_<n>@testuser.com`, y un dominio sin servidores de correo no
# puede recibir nada de nadie, ni del proveedor ni de nosotros.
#
# Si el dominio no tiene MX, la conclusión NO es "falta un acceso": es que
# **`EX-3` no se puede medir en sandbox por ningún medio**, porque el correo
# que se quiere observar no se puede haber enviado. Eso es un hallazgo con
# consecuencia —hay que medirlo en producción, sobre una cuenta real— y no un
# `UNKNOWN` sin explicación.
#
# ES DE SÓLO LECTURA. No crea, no muta y no cancela nada.
#
#   source ~/.config/hospeda/mp-sandbox-creds.sh && bash probe-17-casilla-del-comprador.sh
# =============================================================================
set -uo pipefail

API="https://api.mercadopago.com"
OUT="${OUT_DIR:-/tmp/mp-probe-17}"
mkdir -p "$OUT"

: "${MP_ACCESS_TOKEN:?falta MP_ACCESS_TOKEN}"
: "${MP_BUYER_EMAIL:?falta MP_BUYER_EMAIL}"

echo "############ SONDA 17 — casilla del comprador de prueba · $(date -Is)"
echo "############ salida: $OUT"

VENDEDOR=$(curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API/users/me")
printf '%s' "$VENDEDOR" > "$OUT/users-me.json"
EMAIL_V=$(printf '%s' "$VENDEDOR" | jq -r '.email // "?"')

echo
echo "######## las dos direcciones en juego"
printf '  vendedor:  %s\n  comprador: %s\n' "$EMAIL_V" "$MP_BUYER_EMAIL"

dominio() { printf '%s' "${1##*@}"; }
D_V=$(dominio "$EMAIL_V"); D_C=$(dominio "$MP_BUYER_EMAIL")

echo
echo "######## ¿los dominios pueden recibir correo? (registros MX)"
# Un dominio sin MX no recibe correo de nadie. Es la pregunta previa a
# cualquier discusión sobre accesos.
for d in "$D_V" "$D_C"; do
  echo "  --- $d"
  if command -v dig >/dev/null 2>&1; then
    dig +short MX "$d" | tee "$OUT/mx-$d.txt" | sed 's/^/      MX: /'
    [ -s "$OUT/mx-$d.txt" ] || echo "      MX: (ninguno)"
    dig +short A "$d" | sed 's/^/      A:  /' || true
  elif command -v host >/dev/null 2>&1; then
    host -t MX "$d" | tee "$OUT/mx-$d.txt" | sed 's/^/      /'
  else
    echo "      ⚠ no hay dig ni host: no se puede resolver DNS desde acá"
  fi
done

echo
echo "######## ¿el proveedor expone la casilla o los avisos por API?"
# Si hubiera un endpoint que devuelva las notificaciones enviadas al pagador,
# `EX-3` se mediría sin casilla. Se pregunta en vez de suponer; un 404 o un
# 401 son respuestas válidas y se registran como tales.
preguntar() { # <etiqueta> <ruta>
  local et="$1" ruta="$2" code
  code=$(curl -sS -o "$OUT/$et.json" -w '%{http_code}' \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN" "$API$ruta")
  printf '  %-22s %-46s HTTP %s\n' "$et" "$ruta" "$code"
  head -c 220 "$OUT/$et.json" | sed 's/^/      /'; echo
}
preguntar usuarios-prueba "/users/test_user"
preguntar mensajes        "/messages/packs"

echo
echo "######## ¿de quién es el dominio del comprador?"
# La primera corrida obligó a agregar esto. El chequeo de MX a secas no
# alcanzaba: el dominio SÍ tiene MX, y apunta a `localhost`. Un MX a localhost
# es un agujero negro —cualquier servidor que intente entregar ahí se conecta
# a sí mismo— así que "tiene MX" y "recibe correo" no son lo mismo. Mirar
# quién opera el dominio decide entre las dos lecturas.
curl -sS -m 20 -o "$OUT/sitio-$D_C.html" -w "  http://$D_C/ → HTTP %{http_code} · %{content_type}\n" \
  "http://$D_C/" || echo "  (no respondió)"
printf '  <title>: %s\n' \
  "$(grep -io '<title>[^<]*</title>' "$OUT/sitio-$D_C.html" 2>/dev/null | head -1 | sed 's/<[^>]*>//g')"

echo
echo "######## veredicto"
MX_C="$(cat "$OUT/mx-$D_C.txt" 2>/dev/null)"
case "$(printf '%s' "$MX_C" | tr -d ' \t')" in
  ''|'0.'|*localhost*)
    echo "  El MX del dominio del comprador es un AGUJERO NEGRO: \"${MX_C:-ninguno}\"."
    echo "  Un MX a localhost —o la ausencia de MX— significa que ningún servidor"
    echo "  de correo del mundo puede entregar un mensaje a esa dirección."
    echo "  ⇒ El correo que EX-3 quiere observar NO SE PUEDE HABER ENVIADO."
    echo "  ⇒ EX-3 es INMEDIBLE EN SANDBOX, y NO por falta de un acceso:"
    echo "     pedir la casilla no cambiaría el resultado."
    echo "     Medirlo exige una cuenta real con una casilla real (producción)."
    ;;
  *)
    echo "  El dominio del comprador tiene MX reales (\"$MX_C\"): la casilla"
    echo "  podría existir y EX-3 se puede intentar medir pidiendo acceso."
    ;;
esac

echo
echo "############ fin · evidencia en $OUT"
