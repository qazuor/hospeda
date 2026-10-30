#!/usr/bin/env python3
# =============================================================================
# SONDA 55 — Leer el receptor separando los dos canales, y verificar la firma
# =============================================================================
# NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
#
# Programa: HOS-1352. Lector de la batería IPN del 2026-09-29
# (RESULTS-2026-09-29-bateria-ipn.md). Cubre la parte OFFLINE de EX-13 (firma
# en cada canal), EX-14 (`live_mode` en cada canal), WH-1 (duplicados por
# canal y entre canales), WH-2 (latencia) y EX-2 (`version` por canal).
#
# POR QUÉ EXISTE
# --------------
# Desde el 2026-09-29 ~14:40Z la aplicación `Hospeda Test` tiene las DOS URL
# apuntadas al receptor de la sonda 08: IPN → `/ipn`, Webhooks → `/webhooks`.
# El canal de cada entrega sale del PATH que la recibió, no del formato del
# cuerpo. El lector de la sonda 08 no separa canales ni verifica firmas; éste
# sí, y no muta nada: sólo lee el dump.
#
# LA FIRMA
# --------
# Se prueba el manifiesto medido en la sonda 10
# (`id:<id>;request-id:<x-request-id>;ts:<ts>;`) con el id de la QUERY de
# cada canal (`data.id` en Webhooks, `id` en IPN), más variantes. Control de
# la herramienta con el vector RFC 4231 caso 2: si falla, no se concluye nada.
#
#   python3 probe-55-leer-los-dos-canales.py --desde 2026-09-29T15:00:00Z \
#       [--hasta ...] [--dump archivo.json] [--json salida.json]
#
# Sin --dump, baja el dump del receptor (token en
# ~/.config/hospeda/hos1352-sink-token.txt, nunca se imprime). La clave de
# firma se lee de ~/.config/hospeda/mp-webhook-secret.txt y nunca se imprime.
# =============================================================================
import argparse
import hashlib
import hmac
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

SINK = os.environ.get("SINK_URL", "https://hos1352-webhook-sink.qazuor.workers.dev")
HOME = os.path.expanduser("~")


def leer(ruta):
    with open(ruta) as fh:
        return fh.read().strip()


def bajar_dump():
    token = leer(os.environ.get("TOKEN_FILE", f"{HOME}/.config/hospeda/hos1352-sink-token.txt"))
    # El borde de Cloudflare contesta 403 al user-agent de urllib: se manda uno explícito.
    req = urllib.request.Request(f"{SINK}/dump?t={urllib.parse.quote(token)}",
                                 headers={"User-Agent": "hos1352-sonda-55"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def canal_de(url):
    path = urllib.parse.urlparse(url).path
    if path.startswith("/ipn"):
        return "ipn"
    if path.startswith("/webhooks"):
        return "webhooks"
    return f"otro:{path}"


def recurso_de(ev):
    q = ev["query"]
    return q.get("data.id") or q.get("id") or ""


def tipo_de(ev):
    q = ev["query"]
    return q.get("type") or q.get("topic") or "?"


def cuerpo(ev):
    try:
        return json.loads(ev["body_crudo"]) if ev["body_crudo"] else {}
    except json.JSONDecodeError:
        return {"_no_json": ev["body_crudo"][:80]}


def verificar(ev, secreto):
    firma = ev["headers"].get("x-signature")
    if not firma:
        return "SIN FIRMA"
    partes = dict(p.split("=", 1) for p in firma.split(",") if "=" in p)
    ts, v1 = partes.get("ts", ""), partes.get("v1", "")
    rid = ev["headers"].get("x-request-id", "")
    rec = recurso_de(ev)
    b = cuerpo(ev)
    candidatos = {
        "doc(id query)": f"id:{rec};request-id:{rid};ts:{ts};",
        "doc(id minúsc.)": f"id:{rec.lower()};request-id:{rid};ts:{ts};",
        "doc(resource cuerpo)": f"id:{b.get('resource', '')};request-id:{rid};ts:{ts};",
        "sin id": f"request-id:{rid};ts:{ts};",
    }
    for nombre, m in candidatos.items():
        if hmac.compare_digest(hmac.new(secreto, m.encode(), hashlib.sha256).hexdigest(), v1):
            return f"OK {nombre}"
    return "NO COINCIDE"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", required=True)
    ap.add_argument("--hasta", default="9999")
    ap.add_argument("--dump")
    ap.add_argument("--json")
    a = ap.parse_args()

    ctrl = hmac.new(b"Jefe", b"what do ya want for nothing?", hashlib.sha256).hexdigest()
    if ctrl != "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843":
        print("control HMAC FALLA: no se puede concluir nada")
        sys.exit(1)
    secreto = leer(os.environ.get("SECRET_FILE", f"{HOME}/.config/hospeda/mp-webhook-secret.txt")).encode()

    datos = json.load(open(a.dump)) if a.dump else bajar_dump()
    evs = [e for e in datos["eventos"] if a.desde <= e["llegada"] < a.hasta]
    print(f"control HMAC-SHA256: OK · entregas en ventana: {len(evs)} (dump total {datos['total']})")

    filas = []
    for e in evs:
        b = cuerpo(e)
        filas.append({
            "llegada": e["llegada"],
            "canal": canal_de(e["url"]),
            "tipo": tipo_de(e),
            "recurso": recurso_de(e),
            "action": b.get("action", ""),
            "version": b.get("version", ""),
            "date": b.get("date") or b.get("date_created") or "",
            "live_mode": b.get("live_mode", ""),
            "notif_id": b.get("id", ""),
            "ua": e["headers"].get("user-agent", ""),
            "request_id": e["headers"].get("x-request-id", ""),
            "firma": verificar(e, secreto),
            "cuerpo": e["body_crudo"][:300],
        })

    print("\n=== entregas ===")
    for f in filas:
        print(f"{f['llegada']}  {f['canal']:<8} {f['tipo']:<32} {f['recurso']:<34} "
              f"{str(f['action']):<16} v{f['version']!s:<3} {f['firma']:<18} live={f['live_mode']!s}")

    print("\n=== por canal ===")
    por = defaultdict(lambda: defaultdict(int))
    for f in filas:
        por[f["canal"]][f["tipo"]] += 1
    for c, d in por.items():
        print(f"{c}: " + ", ".join(f"{k}={v}" for k, v in sorted(d.items())))

    print("\n=== firma por canal ===")
    fir = defaultdict(lambda: defaultdict(int))
    for f in filas:
        fir[f["canal"]][f["firma"]] += 1
    for c, d in fir.items():
        print(f"{c}: " + ", ".join(f"{k}={v}" for k, v in d.items()))

    print("\n=== claves repetidas dentro de cada canal (tipo, recurso, version) ===")
    rep = defaultdict(list)
    for f in filas:
        rep[(f["canal"], f["tipo"], f["recurso"], f["version"])].append(f["llegada"])
    n = 0
    for k, v in rep.items():
        if len(v) > 1:
            n += 1
            print(f"{k}: {len(v)} → {', '.join(v)}")
    print(f"total claves repetidas: {n}")

    print("\n=== recursos que llegaron por los DOS canales ===")
    canales = defaultdict(set)
    for f in filas:
        canales[f["recurso"]].add(f["canal"])
    for r, cs in canales.items():
        if len(cs) > 1:
            ts = [(f["llegada"], f["canal"]) for f in filas if f["recurso"] == r]
            print(f"{r}: " + " · ".join(f"{c}@{t[11:23]}" for t, c in ts))

    if a.json:
        with open(a.json, "w") as fh:
            json.dump(filas, fh, indent=1, ensure_ascii=False)
        print(f"\nfilas guardadas en {a.json}")


if __name__ == "__main__":
    main()
