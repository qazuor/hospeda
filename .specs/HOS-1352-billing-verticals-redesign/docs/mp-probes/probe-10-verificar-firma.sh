#!/usr/bin/env bash
# =============================================================================
# SONDA 10 — ¿La firma de los webhooks se puede verificar?
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Cierra `EX-13` y alimenta el §51 (idempotencia) y
# `M-CONC-01`.
#
# QUÉ PREGUNTA
# ------------
# Que el header `x-signature` LLEGUE ya se midió. Que se pueda VERIFICAR es
# otra cosa, y es la que importa: si no se puede verificar, cualquiera que
# adivine la URL puede inventar un cobro.
#
# CÓMO
# ----
# El header viene como `ts=<epoch>,v1=<hex64>`. La verificación es un
# HMAC-SHA256, con la clave secreta de la aplicación, sobre un "manifiesto"
# armado con datos del propio request. **Cuál es exactamente ese manifiesto es
# lo que esta sonda mide**: se prueban varias formas candidatas contra firmas
# REALES ya recibidas, y se reporta cuál reproduce el `v1`.
#
# Probar varias no es tanteo: es la única forma honesta de cerrar la fila. Dar
# por buena la forma documentada sin comprobarla sería completar una fila desde
# documentación, que es justo lo que el §58 prohíbe. Y este proveedor ya
# demostró cinco veces que lo que dice y lo que hace no siempre coinciden.
#
# LO QUE NO PUEDE PASAR
# ---------------------
# Que "ninguna forma coincide" se lea como "la firma no es verificable". Puede
# significar que falta una forma. Por eso la sonda además verifica que su
# propio HMAC funciona, con un vector de prueba conocido: si ese control
# fallara, el problema es la herramienta y no el proveedor.
#
#   SINK_URL=https://... bash probe-10-verificar-firma.sh
#
# La clave se lee de ~/.config/hospeda/mp-webhook-secret.txt y NUNCA se
# imprime: este script queda versionado en el repo.
# =============================================================================
set -uo pipefail

: "${SINK_URL:?falta SINK_URL — la URL del Worker receptor}"
SECRET_FILE="${SECRET_FILE:-$HOME/.config/hospeda/mp-webhook-secret.txt}"
TOKEN_FILE="${TOKEN_FILE:-$HOME/.config/hospeda/hos1352-sink-token.txt}"
[ -f "$SECRET_FILE" ] || { echo "no está $SECRET_FILE"; exit 1; }
[ -f "$TOKEN_FILE" ]  || { echo "no está $TOKEN_FILE"; exit 1; }

SECRET="$(tr -d '\n' < "$SECRET_FILE")"
TOKEN="$(tr -d '\n' < "$TOKEN_FILE")"

echo "############ SONDA 10 — verificar la firma · $(date -Is)"

RESP="$(curl -sS "$SINK_URL/dump?t=$TOKEN")"
printf '%s' "$RESP" | jq -e '.eventos' >/dev/null 2>&1 || {
  echo "el receptor no devolvió lo esperado"; exit 1; }

# El JSON va por ARCHIVO, no por tubería: el heredoc de abajo ya ocupa stdin,
# así que un `printf | python3 - <<EOF` deja a python leyendo el script y no
# los datos. Falla con un JSONDecodeError que no se parece en nada a la causa.
VOLCADO="$(mktemp)"
trap 'rm -f "$VOLCADO"' EXIT
printf '%s' "$RESP" > "$VOLCADO"

SECRET="$SECRET" VOLCADO="$VOLCADO" python3 - <<'PY'
import hashlib, hmac, json, os, sys

secret = os.environ["SECRET"].encode()
with open(os.environ["VOLCADO"]) as fh:
    datos = json.load(fh)

# --- control de la herramienta ----------------------------------------------
# Vector conocido de HMAC-SHA256 (RFC 4231, caso 2). Si esto falla, lo que
# está roto es el script, no el proveedor.
ctrl = hmac.new(b"Jefe", b"what do ya want for nothing?", hashlib.sha256).hexdigest()
esperado = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
print(f"control HMAC-SHA256: {'OK' if ctrl == esperado else 'FALLA — no se puede concluir nada'}")
if ctrl != esperado:
    sys.exit(1)

def formas(data_id, request_id, ts):
    """Formas candidatas del manifiesto. La primera es la documentada."""
    return {
        "id:<data.id>;request-id:<x-request-id>;ts:<ts>;":
            f"id:{data_id};request-id:{request_id};ts:{ts};",
        "idem, con data.id en minúsculas":
            f"id:{data_id.lower()};request-id:{request_id};ts:{ts};",
        "sin el punto y coma final":
            f"id:{data_id};request-id:{request_id};ts:{ts}",
        "sin request-id":
            f"id:{data_id};ts:{ts};",
        "sólo ts y id, invertidos":
            f"ts:{ts};id:{data_id};",
    }

eventos = [e for e in datos["eventos"] if e["headers"].get("x-signature")]
print(f"entregas firmadas disponibles: {len(eventos)}\n")
if not eventos:
    print("no hay ninguna entrega firmada para verificar")
    sys.exit(0)

ganadora, revisadas = None, 0
for ev in eventos:
    h = ev["headers"]
    firma = h["x-signature"]
    partes = dict(p.split("=", 1) for p in firma.split(",") if "=" in p)
    ts, v1 = partes.get("ts", ""), partes.get("v1", "")
    data_id = ev["query"].get("data.id") or ev["query"].get("id") or ""
    request_id = h.get("x-request-id", "")
    revisadas += 1

    print(f"── {ev['llegada']}  type={ev['query'].get('type')}  data.id={data_id}")
    for nombre, manifiesto in formas(data_id, request_id, ts).items():
        calc = hmac.new(secret, manifiesto.encode(), hashlib.sha256).hexdigest()
        ok = hmac.compare_digest(calc, v1)
        print(f"   {'✅ COINCIDE' if ok else '  no'}  {nombre}")
        if ok and ganadora is None:
            ganadora = nombre
    print()
    if revisadas >= 3:
        break

print("=" * 70)
if ganadora:
    print(f"LA FIRMA SE VERIFICA. Manifiesto: {ganadora}")
    print("EX-13 se puede cerrar: el receptor puede rechazar un POST no firmado")
    print("por el proveedor, y por lo tanto la URL no es un agujero abierto.")
else:
    print("NINGUNA forma candidata reprodujo el v1.")
    print("Eso NO prueba que la firma no sea verificable: puede faltar una forma,")
    print("o la clave puede no ser la de esta aplicación. EX-13 sigue PARCIAL.")
PY