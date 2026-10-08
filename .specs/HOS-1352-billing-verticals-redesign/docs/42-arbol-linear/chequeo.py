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
  (f) una hoja no declara su fase (`corte`: hecha, mvp, fase-1..fase-4) o
      depende de una hoja de una fase posterior a la suya.
  (g) una dependencia de una hoja del MVP no dice qué usa (`por_que`): la regla
      es que cada hoja depende de la hoja que CREA lo que usa, no de un orden.
  (h) una salida no espera a todas las hojas de su pieza en su misma fase.

La forma vieja («una sola hoja de entrada por pieza» y «la entrada espera la
salida de la pieza anterior») se retiró el 2026-10-07: describía un orden, no
un uso, y forzaba aristas que estiraban el camino crítico sin razón.

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
    # Regla real del grafo (2026-10-07, reemplaza «una sola hoja de entrada» y
    # «la entrada espera la salida de la pieza anterior»): cada hoja depende de
    # la hoja que crea lo que usa, sin ciclos (ya chequeado arriba), y cada
    # salida depende de todos los sumideros de su pieza en su fase.
    fases = {"hecha": 0, "mvp": 1, "fase-1": 2, "fase-2": 3, "fase-3": 4, "fase-4": 5}
    hojas_n = [by[k] for k in hojas]
    for n in hojas_n:
        if n.get("corte") not in fases:
            fallos.append(f"(f) {n['clave']}: `corte` ausente o inválido: {n.get('corte')!r}")
    for n in hojas_n:
        for dep in n["depende_de"]:
            if dep in hoja_set and n.get("corte") in fases and by[dep].get("corte") in fases \
                    and fases[by[dep]["corte"]] > fases[n["corte"]]:
                fallos.append(f"(f) {n['clave']} ({n['corte']}) depende de {dep} ({by[dep]['corte']}), de una fase posterior")
        # (g) en el MVP cada dependencia dice qué usa de la hoja que lo crea
        if n.get("corte") == "mvp":
            motivos = n.get("por_que") or {}
            for dep in n["depende_de"]:
                if not str(motivos.get(dep, "")).strip():
                    fallos.append(f"(g) {n['clave']} → {dep}: dependencia sin motivo en `por_que`")
            for dep in motivos:
                if dep not in n["depende_de"]:
                    fallos.append(f"(g) {n['clave']}: motivo para {dep}, que no está en depende_de")

    def alcanza(k):
        vistos, pila = set(), list(by[k]["depende_de"])
        while pila:
            d = pila.pop()
            if d in vistos or d not in by:
                continue
            vistos.add(d)
            pila.extend(by[d]["depende_de"])
        return vistos

    # (h) cada salida espera a todas las hojas de su pieza en su misma fase
    grupos = defaultdict(list)
    for n in hojas_n:
        grupos[(n["acs"][0].split(":")[1], n.get("corte"))].append(n["clave"])
    for (pieza, fase), claves_g in sorted(grupos.items(), key=lambda x: (x[0][0], str(x[0][1]))):
        salidas = [k for k in claves_g if by[k].get("salida")]
        if len(salidas) > 1:
            fallos.append(f"(h) {pieza}/{fase}: más de una salida: {salidas}")
        for ex in salidas:
            faltan = sorted(set(claves_g) - {ex} - alcanza(ex))
            if faltan:
                fallos.append(f"(h) salida {ex} no espera a {faltan}")

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
    por_fase = Counter(by[k].get("corte") for k in hojas)
    print(f"✓ árbol sano: {len(nodos)} nodos · {len(hojas)} hojas ({dict(sorted(por_fase.items()))}) · "
          f"{len(conteo)} ACs cubiertas (igual a spec: {len(conteo)==len(union_spec)}) · "
          f"{len(piezas_spec)} piezas · sin ciclos · padres y dependencias resueltos")
    sys.exit(0)

if __name__ == "__main__":
    main()
