#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chequeador del árbol Linear de HOS-1352 (`arbol.json`).

Lee la spec consolidada (fuente de verdad de los ACs) y el árbol propuesto.
Falla con exit 1 si:
  (a) algún AC:<pieza>:<n> de la spec consolidada no está en exactamente una hoja.
  (b) un hoja referencia un AC que no existe en la spec.
  (c) hay ciclos en `depende_de`.
  (d) una hoja de PR cubre ACs de más de una pieza.
  (e) un `padre` no existe (sólo la raíz puede tener padre nulo).

Extras defensivos: `depende_de` roto, valores `existente` duplicados o fuera del
snapshot verificado de Linear (2026-10-04), piezas de la spec sin hojas, y nodos
no-hoja con ACs.

Uso: python3 chequeo.py [ruta-alternativa/arbol.json]
"""
import ast, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC_BASE = HERE.parent.parent          # .specs/HOS-1352-billing-verticals-redesign/
SPEC = SPEC_BASE / "spec-consolidada"
AC_TOKEN = re.compile(r"AC:[A-Z0-9a-z]+:[0-9]+")

# Snapshot verificado en Linear el 2026-10-04 (consulta de sólo lectura).
LINEAR_CONOCIDAS = {
    "HOS-1352",                                          # raíz
    "HOS-1353", "HOS-1354",                              # épicas
    *(f"HOS-{n}" for n in range(1355, 1377)),            # V1..V9 y B1..B13
    "HOS-1400", "HOS-1401", "HOS-1402",                  # U1..U3
}

def spec_piezas():
    """(tokens por pieza, piezas) sobre 10-corte/ y 20-fase-*/ como `rg -o`."""
    per_file = defaultdict(set)
    piezas = set()
    dirs = [SPEC / "10-corte"] + sorted(SPEC.glob("20-fase-*"))
    for d in dirs:
        for f in sorted(d.rglob("*.md")):
            per_file[f.stem] |= set(AC_TOKEN.findall(f.read_text(encoding="utf-8")))
            piezas.add(f.stem)
    union = set().union(*per_file.values())
    return union, piezas

def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "arbol.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    nodos = data["nodos"]
    fallos = []

    claves = [n["clave"] for n in nodos]
    dup_claves = [k for k, c in Counter(claves).items() if c > 1]
    if dup_claves:
        fallos.append(f"claves duplicadas: {dup_claves}")
    dup_titles = [title for title, count in Counter(n["titulo"] for n in nodos if not n["existente"]).items() if count > 1]
    if dup_titles:
        fallos.append(f"títulos nuevos duplicados: {dup_titles}")
    by = {n["clave"]: n for n in nodos}
    padres_usados = {n["padre"] for n in nodos if n["padre"]}
    hojas = [n["clave"] for n in nodos if n["clave"] not in padres_usados]
    hoja_set = set(hojas)
    for key in hojas:
        if not by[key]["acs"]:
            fallos.append(f"hoja sin AC de PR: {key}")

    # (e) padre existe; sólo la raíz puede ser nula
    raices = [n["clave"] for n in nodos if not n["padre"]]
    if raices != [data.get("raiz")]:
        fallos.append(f"raíces sin padre: {raices} (esperaba sólo {data.get('raiz')})")
    for n in nodos:
        if n["padre"] and n["padre"] not in by:
            fallos.append(f"(e) {n['clave']}: padre inexistente {n['padre']!r}")
        seen = {n['clave']}
        p = n['padre']
        while p in by:
            if p in seen:
                fallos.append(f"ciclo de padres desde {n['clave']}: {p}")
                break
            seen.add(p)
            p = by[p]['padre']

    # depende_de existe + (c) ciclos
    for n in nodos:
        for d in n["depende_de"]:
            if d not in by:
                fallos.append(f"depende_de roto: {n['clave']} → {d!r}")
    color, ciclo = {}, None
    def dfs(k, stack):
        nonlocal ciclo
        if k in color:
            if color[k] == 1 and ciclo is None:
                ciclo = stack[stack.index(k):] + [k]
            return
        color[k] = 1
        for d in by.get(k, {}).get("depende_de", []):
            if d in by:
                dfs(d, stack + [k])
        color[k] = 2
    for k in list(by):
        dfs(k, [])
    if ciclo:
        fallos.append(f"(c) ciclo en depende_de: {' → '.join(ciclo)}")

    # (a)(b)(d) cobertura de ACs en hojas
    union_spec, piezas_spec = spec_piezas()
    conteo = Counter()
    for n in nodos:
        if not n["acs"]:
            continue
        if n["clave"] not in hoja_set:
            fallos.append(f"nodo no-hoja con ACs: {n['clave']}")
        if len(n["acs"]) > 4:
            fallos.append(f"hoja demasiado grande (>4 AC): {n['clave']}")
        for tok in n["acs"]:
            conteo[tok] += 1
            if tok not in union_spec:
                fallos.append(f"(b) AC fuera de la spec en {n['clave']}: {tok}")
            if tok.split(":")[1] not in piezas_spec:
                fallos.append(f"pieza de AC inexistente en {n['clave']}: {tok}")
        partes = {tok.split(":")[1] for tok in n["acs"]}
        if len(partes) > 1:
            fallos.append(f"(d) hoja {n['clave']} cubre piezas {sorted(partes)}")
    faltantes = sorted(union_spec - set(conteo))
    repetidos = sorted(k for k, c in conteo.items() if c > 1)
    if faltantes:
        muestra = ", ".join(faltantes[:15]) + ("…" if len(faltantes) > 15 else "")
        fallos.append(f"(a) ACs de la spec sin hoja: {len(faltantes)} → {muestra}")
    if repetidos:
        fallos.append(f"(a) ACs en más de una hoja: {repetidos}")

    piezas_con_hoja = {tok.split(":")[1] for tok in conteo}
    sin_hoja = sorted(piezas_spec - piezas_con_hoja)
    if sin_hoja:
        fallos.append(f"piezas de la spec sin hojas: {sin_hoja}")

    # El grafo de la spec se declara en aristas.py; no basta con que las
    # dependencias del árbol sean internamente válidas.
    tree = ast.parse((HERE.parent / "41-corte-del-mvp" / "aristas.py").read_text(encoding="utf-8"))
    graph = {}
    for stmt in tree.body:
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
            if stmt.targets[0].id in {"INTRA", "CRUZADAS"}:
                graph[stmt.targets[0].id] = ast.literal_eval(stmt.value)
    expected = set(graph["INTRA"]) | {(a, b) for a, b, _ in graph["CRUZADAS"]}
    piece_re = re.compile(r"[UVB]\d+[ab]?")
    pieces = {k: v for k, v in by.items() if piece_re.fullmatch(k)}
    actual = {(d, k) for k, n in pieces.items() for d in n["depende_de"]}
    if expected != actual:
        fallos.append(f"aristas de piezas: faltan {sorted(expected - actual)}; sobran {sorted(actual - expected)}")
    for piece, node in pieces.items():
        descendants = [n for n in nodos if n["acs"] and n["acs"][0].split(":")[1] == piece]
        entry = [n for n in descendants if not any(d in {v["clave"] for v in descendants} for d in n["depende_de"])]
        if len(entry) != 1:
            fallos.append(f"{piece}: esperaba una sola hoja de entrada, hay {len(entry)}")
            continue
        for predecessor in node["depende_de"]:
            exits = [n["clave"] for n in nodos if n["acs"] and n["acs"][0].split(":")[1] == predecessor
                     and not any(n["clave"] in other["depende_de"] for other in nodos if other["acs"] and other["acs"][0].split(":")[1] == predecessor)]
            if len(exits) != 1 or exits[0] not in entry[0]["depende_de"]:
                fallos.append(f"{piece}: hoja de entrada no depende de salida de {predecessor}: {exits}")

    # existentes
    vistos = Counter()
    for n in nodos:
        e = n["existente"]
        if e:
            vistos[e] += 1
            if e not in LINEAR_CONOCIDAS:
                fallos.append(f"existente desconocida en Linear: {e} (nodo {n['clave']})")
    dupes = [e for e, c in vistos.items() if c > 1]
    if dupes:
        fallos.append(f"issues existentes duplicadas: {dupes}")

    if fallos:
        print(f"✗ árbol inválido: {len(fallos)} problemas")
        for f in fallos:
            print("  ·", f)
        sys.exit(1)
    print(f"✓ árbol sano: {len(nodos)} nodos · {len(hojas)} hojas · "
          f"{len(conteo)} ACs cubiertas (igual a spec: {len(conteo)==len(union_spec)}) · "
          f"{len(piezas_spec)} piezas · sin ciclos · padres y dependencias resueltos")
    sys.exit(0)

if __name__ == "__main__":
    main()
