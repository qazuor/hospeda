#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chequeador del árbol Linear de HOS-1787 (`arbol.json`).

Lee los sub-specs tokenizados (fuente de verdad de los ACs), `docs/06-guards.md` (fuente
de verdad de los guards) y el árbol propuesto. Falla con exit 1 si:
  (a) algún AC:<n>:<k> o guard G-FAC-* no está en exactamente una hoja.
  (b) una hoja referencia un AC o un guard que no existe.
  (c) hay ciclos en `depende_de`.
  (d) una hoja cubre ACs o guards de más de un sub-spec, o de un sub-spec distinto del
      hijo bajo el que cuelga.
  (e) un `padre` no existe (sólo la raíz puede tener padre nulo).
  (f) `depende_de` apunta a una clave que no es nodo ni issue externa declarada.
  (g) un nodo no-hoja tiene ACs o guards.
  (h) una dependencia entre hojas de hijos distintos contradice el orden de los hijos
      (la hoja de X depende de una hoja de Y y Y no está upstream de X), o una relación
      de hijos no queda materializada por ninguna arista entre hojas.
  (i) una hoja no declara «**Sub-spec:** sub-specs/<archivo> § «…»» con su archivo y
      secciones reales.

  (j) una hoja no declara `etapa` válida (`pre-corte`, `mvp`, `post-mvp`, DEC-FAC-082), su
      label de etapa no coincide, una hoja `pre-corte` depende de una `mvp`/`post-mvp` o una
      `mvp` depende de una `post-mvp`; o el label que se agrega a un hijo existente no es el
      de la etapa más temprana de sus hojas.

Extras defensivos: texto verbatim de cada AC en la descripción de su hoja, «Fuera de
alcance» presente, ids DEC-FAC existentes, hojas sin AC sólo con «Sin AC propio», hojas de
más de 4 ACs, labels fuera del conjunto permitido, existentes duplicadas o fuera del
snapshot, relaciones de hijos distintas del snapshot de Linear.

Uso: python3 chequeo.py [ruta-alternativa/arbol.json]
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = HERE.parent.parent                      # .specs/HOS-1787-rubros-y-comer-y-salir/
SUBSPECS = SPEC / "sub-specs"
GUARDS_MD = SPEC / "docs" / "06-guards.md"
DECISIONES = SPEC / "docs" / "01-decision-log.md"
AC_TOKEN = re.compile(r"\*\*(AC:\d+:\d+)\*\* — ")

# Snapshot informado por el orquestador el 2026-10-25 (issues y relaciones ya en Linear).
LINEAR_CONOCIDAS = {"HOS-1787", *(f"HOS-{n}" for n in range(1801, 1810))}
EXTERNAS_CONOCIDAS = {"HOS-1798", "HOS-1797", "HOS-1352"}
RELACIONADAS_CONOCIDAS = {"HOS-1810"}
ETAPAS = ("pre-corte", "mvp", "post-mvp")   # en orden: una etapa sólo puede depender de sí misma o de las anteriores
RELACIONES_LINEAR = {  # (dependiente, bloqueante) en claves del árbol
    ("1", "HOS-1798"), ("2", "1"), ("3", "2"), ("4", "2"), ("4", "3"), ("9", "1"), ("9", "2"),
    ("5", "3"), ("5", "4"), ("5", "9"), ("6", "3"), ("6", "4"), ("6", "9"), ("6", "HOS-1797"),
    ("7", "2"), ("7", "3"), ("8", "3"),
}
LABELS_OK = {"kind-spec", "source-agent", "status-needs-smoke-staging", "pre-corte-1352", "pre_v1_product", "post_v1", "area-web", "area-admin", "area-api",
             "area-db", "area-auth", "area-billing", "area-content", "area-devops"}


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def spec_acs():
    """{token: (n, archivo, texto)} sólo dentro de «## Criterio de aceptación»."""
    out = {}
    for f in sorted(SUBSPECS.glob("*.md")):
        n = int(f.name.split("-")[0])
        sec = f.read_text(encoding="utf-8").split("## Criterio de aceptación", 1)
        if len(sec) < 2:
            continue
        for m in re.finditer(r"^- \*\*(AC:\d+:\d+)\*\* — (.*?)(?=^- |^## |\Z)", sec[1], re.S | re.M):
            tok = m.group(1)
            if tok in out:
                out[tok] = (n, f.name, None)  # duplicado: se reporta abajo
            else:
                out[tok] = (n, f.name, norm(m.group(2)))
        bullets = len(re.findall(r"^- ", sec[1].split("\n## ")[0], re.M))
        tokens = len(AC_TOKEN.findall(sec[1].split("\n## ")[0]))
        if bullets != tokens:
            out[f"__sin_token__{f.name}"] = (n, f.name, f"{bullets - tokens} bullets sin token")
    return out


def spec_guards():
    text = GUARDS_MD.read_text(encoding="utf-8")
    return {m.group(1): int(m.group(2)) for m in re.finditer(r"^\| (G-FAC-[0-9A-Z]+) \| sub-spec (\d) \|", text, re.M)}


def headings(fname):
    return {re.sub(r"^#+ ", "", l).strip() for l in (SUBSPECS / fname).read_text(encoding="utf-8").split("\n") if l.startswith("#")}


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "arbol.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    nodos = data["nodos"]
    externas = set(data.get("externas", {}))
    fallos = []

    relacionadas = set(data.get("relacionadas", {}))
    if relacionadas - RELACIONADAS_CONOCIDAS:
        fallos.append(f"relacionadas desconocidas: {sorted(relacionadas - RELACIONADAS_CONOCIDAS)}")
    if externas - EXTERNAS_CONOCIDAS:
        fallos.append(f"externas desconocidas: {sorted(externas - EXTERNAS_CONOCIDAS)}")
    claves = [n["clave"] for n in nodos]
    dup = [k for k, c in Counter(claves).items() if c > 1]
    if dup:
        fallos.append(f"claves duplicadas: {dup}")
    dup_t = [t for t, c in Counter(n["titulo"] for n in nodos if not n["existente"]).items() if c > 1]
    if dup_t:
        fallos.append(f"títulos nuevos duplicados: {dup_t}")
    by = {n["clave"]: n for n in nodos}
    raiz = data.get("raiz")
    padres = {n["padre"] for n in nodos if n["padre"]}
    hojas = [n for n in nodos if n["clave"] not in padres]

    # (e) padres
    raices = [n["clave"] for n in nodos if not n["padre"]]
    if raices != [raiz]:
        fallos.append(f"(e) raíces sin padre: {raices} (esperaba sólo {raiz})")
    for n in nodos:
        if n["padre"] and n["padre"] not in by:
            fallos.append(f"(e) {n['clave']}: padre inexistente {n['padre']!r}")
        seen, p = {n["clave"]}, n["padre"]
        while p in by:
            if p in seen:
                fallos.append(f"(e) ciclo de padres desde {n['clave']}")
                break
            seen.add(p)
            p = by[p]["padre"]

    def hijo_de(clave):
        """La clave del hijo de la raíz bajo el que cuelga un nodo (o None)."""
        k = clave
        while k in by and by[k]["padre"] and by[k]["padre"] != raiz:
            k = by[k]["padre"]
        return k if k in by and by[k]["padre"] == raiz else None

    # (f) depende_de + (c) ciclos
    for n in nodos:
        for d in n["depende_de"]:
            if d not in by and d not in externas:
                fallos.append(f"(f) depende_de roto: {n['clave']} → {d!r}")
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

    # (a)(b)(d)(g)(i) cobertura y declaración de cada hoja
    acs, guards = spec_acs(), spec_guards()
    for tok, (_, fname, txt) in acs.items():
        if tok.startswith("__sin_token__"):
            fallos.append(f"(a) {fname}: {txt}")
        elif txt is None:
            fallos.append(f"(a) token repetido en la spec: {tok} ({fname})")
    acs = {k: v for k, v in acs.items() if not k.startswith("__")}
    decs = set(re.findall(r"^## (DEC-FAC-\d+)", DECISIONES.read_text(encoding="utf-8"), re.M))
    hoja_claves = {n["clave"] for n in hojas}
    conteo_ac, conteo_g = Counter(), Counter()
    for n in nodos:
        for lab in n["labels"] + n.get("labels_agregar", []):
            if lab not in LABELS_OK:
                fallos.append(f"label no permitido en {n['clave']}: {lab}")
        if not n["existente"] and "source-agent" not in n["labels"]:
            fallos.append(f"nodo nuevo sin `source-agent`: {n['clave']}")
        for d in n["depende_de"]:
            if d in relacionadas:
                fallos.append(f"{n['clave']} depende de una issue sólo relacionada: {d}")
        if (n["acs"] or n.get("guards")) and n["clave"] not in hoja_claves:
            fallos.append(f"(g) nodo no-hoja con ACs o guards: {n['clave']}")
    sin_hojas = set(data.get("sin_hojas", {}))
    for n in hojas:
        k, desc = n["clave"], n["descripcion"]
        if n["existente"]:
            if hijo_de(k) != k or k not in sin_hojas:
                fallos.append(f"hoja existente sin justificar en `sin_hojas`: {k}")
            continue
        hijo = hijo_de(k)
        items = n["acs"] + n.get("guards", [])
        if not items and "**Sin AC propio:**" not in desc:
            fallos.append(f"hoja sin AC ni guard y sin «Sin AC propio»: {k}")
        if len(n["acs"]) > 4:
            fallos.append(f"hoja demasiado grande (>4 AC): {k}")
        partes = set()
        for tok in n["acs"]:
            conteo_ac[tok] += 1
            if tok not in acs:
                fallos.append(f"(b) AC inexistente en {k}: {tok}")
                continue
            partes.add(acs[tok][0])
            if f"`{tok}` — {acs[tok][2]}" not in norm(desc):
                fallos.append(f"texto del AC no verbatim en {k}: {tok}")
        for g in n.get("guards", []):
            conteo_g[g] += 1
            if g not in guards:
                fallos.append(f"(b) guard inexistente en {k}: {g}")
                continue
            partes.add(guards[g])
            if f"Guard `{g}`" not in desc:
                fallos.append(f"guard no declarado en la descripción de {k}: {g}")
        if hijo is not None and hijo.isdigit():
            partes.add(int(hijo))
        if len(partes) > 1:
            fallos.append(f"(d) hoja {k} mezcla sub-specs/hijo {sorted(partes)}")
        # (i) declaración del sub-spec
        m = re.search(r"\*\*Sub-spec:\*\* sub-specs/(\d)-[\w-]+\.md (§ «[^»]+»(?: · § «[^»]+»)*)", desc)
        if not m:
            fallos.append(f"(i) hoja sin «**Sub-spec:** sub-specs/… § «…»»: {k}")
        else:
            fname = re.search(r"sub-specs/(\d-[\w-]+\.md)", desc).group(1)
            if not (SUBSPECS / fname).exists():
                fallos.append(f"(i) {k}: sub-spec inexistente {fname}")
            else:
                if partes and int(m.group(1)) not in partes:
                    fallos.append(f"(i) {k}: declara {fname} pero cubre {sorted(partes)}")
                hs = headings(fname)
                for sec in re.findall(r"§ «([^»]+)»", m.group(2)):
                    if sec not in hs:
                        fallos.append(f"(i) {k}: sección inexistente en {fname}: «{sec}»")
        if "**Fuera de alcance:**" not in desc:
            fallos.append(f"hoja sin «Fuera de alcance»: {k}")
        dm = re.search(r"\*\*Decisiones:\*\* (.*)", desc)
        if not dm or not re.findall(r"DEC-FAC-\d+", dm.group(1)):
            fallos.append(f"hoja sin «Decisiones»: {k}")
        else:
            for d in re.findall(r"DEC-FAC-\d+", dm.group(1)):
                if d not in decs:
                    fallos.append(f"decisión inexistente en {k}: {d}")
    falt_ac = sorted(set(acs) - set(conteo_ac), key=lambda t: tuple(map(int, t.split(":")[1:])))
    falt_g = sorted(set(guards) - set(conteo_g))
    rep = sorted(t for t, c in (conteo_ac + conteo_g).items() if c > 1)
    if falt_ac:
        fallos.append(f"(a) ACs sin hoja: {len(falt_ac)} → {', '.join(falt_ac[:15])}")
    if falt_g:
        fallos.append(f"(a) guards sin hoja: {falt_g}")
    if rep:
        fallos.append(f"(a) ítems en más de una hoja: {rep}")
    subspecs = {v[0] for v in acs.values()}
    con_hoja = {int(hijo_de(n["clave"])) for n in hojas if not n["existente"] and (hijo_de(n["clave"]) or "").isdigit()}
    if subspecs - con_hoja:
        fallos.append(f"sub-specs sin hojas: {sorted(subspecs - con_hoja)}")

    # (h) orden entre hijos
    rel = {(r["dependiente"], r["bloqueante"]) for r in data.get("relaciones_hijo", []) if r.get("existe_en_linear")}
    prop = {(r["dependiente"], r["bloqueante"]) for r in data.get("relaciones_hijo", []) if not r.get("existe_en_linear")}
    if rel != RELACIONES_LINEAR:
        fallos.append(f"(h) relaciones_hijo existentes ≠ snapshot de Linear: faltan {sorted(RELACIONES_LINEAR - rel)}; sobran {sorted(rel - RELACIONES_LINEAR)}")
    if prop & RELACIONES_LINEAR:
        fallos.append(f"(h) relaciones a crear que ya existen en Linear: {sorted(prop & RELACIONES_LINEAR)}")
    for a, b in prop:
        for x in (a, b):
            if x not in externas and not (x in by and by[x]["padre"] == raiz and by[x]["existente"]):
                fallos.append(f"(h) relación a crear con un extremo que no es hijo existente ni externa: {a} ← {b}")
    grafo = {}
    for a, b in rel | prop:
        grafo.setdefault(a, set()).add(b)

    def upstream(x):
        vistos, pila = set(), [x]
        while pila:
            for b in grafo.get(pila.pop(), ()):
                if b not in vistos:
                    vistos.add(b)
                    pila.append(b)
        return vistos

    materializadas = set()
    for n in hojas:
        if n["existente"]:
            continue
        hx = hijo_de(n["clave"])
        for d in n["depende_de"]:
            hy = d if d in externas else hijo_de(d)
            if hy == hx:
                continue
            if d in by and d not in hoja_claves:
                fallos.append(f"(h) {n['clave']} depende de un nodo no-hoja de otro hijo: {d}")
            if hy not in upstream(hx):
                fallos.append(f"(h) {n['clave']} (hijo {hx}) depende de {d} (hijo {hy}), que no está upstream")
            elif (hx, hy) in rel | prop:
                materializadas.add((hx, hy))
    for par in sorted((rel | prop) - materializadas):
        if par[0] not in sin_hojas and par[0] not in externas:
            fallos.append(f"(h) relación de hijos sin arista entre hojas: {par[0]} ← {par[1]}")
    for n in nodos:
        if n["existente"] and n["padre"] == raiz and set(n["depende_de"]) != {b for a, b in rel | prop if a == n["clave"]}:
            fallos.append(f"(h) depende_de del hijo {n['clave']} ≠ relaciones_hijo")

    # (j) etapas
    etapa_label = data.get("etapa_label", {})
    if set(etapa_label) != set(ETAPAS):
        fallos.append(f"(j) etapa_label no cubre {ETAPAS}: {sorted(etapa_label)}")
    etapa_de = {}
    for n in hojas:
        if n["existente"]:
            continue
        e = n.get("etapa")
        if e not in ETAPAS:
            fallos.append(f"(j) hoja sin etapa válida: {n['clave']} ({e!r})")
            continue
        etapa_de[n["clave"]] = e
        de_etapa = [l for l in n["labels"] if l in etapa_label.values()]
        if de_etapa != [etapa_label.get(e)]:
            fallos.append(f"(j) {n['clave']}: labels de etapa {de_etapa}, esperaba [{etapa_label.get(e)}]")
        if f"**Etapa:** `{e}`" not in n["descripcion"]:
            fallos.append(f"(j) {n['clave']}: la descripción no declara su etapa")
    for k, e in etapa_de.items():
        for d in by[k]["depende_de"]:
            if d in etapa_de and ETAPAS.index(etapa_de[d]) > ETAPAS.index(e):
                fallos.append(f"(j) {k} ({e}) depende de {d} ({etapa_de[d]})")
    for n in nodos:
        if n["existente"] and n["padre"] == raiz:
            mias = [etapa_de[h["clave"]] for h in hojas if h["clave"] in etapa_de and hijo_de(h["clave"]) == n["clave"]]
            agrega = n.get("labels_agregar", [])
            if len(agrega) != 1 or agrega[0] not in etapa_label.values():
                fallos.append(f"(j) hijo {n['clave']}: labels_agregar debe ser un label de etapa: {agrega}")
            elif mias and agrega[0] != etapa_label[min(mias, key=ETAPAS.index)]:
                fallos.append(f"(j) hijo {n['clave']}: agrega {agrega[0]}, pero su etapa más temprana es {min(mias, key=ETAPAS.index)}")
            elif not mias and n["clave"] not in sin_hojas:
                fallos.append(f"(j) hijo {n['clave']} sin hojas con etapa")

    # existentes
    vistos = Counter(n["existente"] for n in nodos if n["existente"])
    for e in vistos:
        if e not in LINEAR_CONOCIDAS:
            fallos.append(f"existente desconocida en Linear: {e}")
    if [e for e, c in vistos.items() if c > 1]:
        fallos.append(f"issues existentes duplicadas: {[e for e, c in vistos.items() if c > 1]}")

    if fallos:
        print(f"✗ árbol inválido: {len(fallos)} problemas")
        for f in fallos:
            print("  ·", f)
        sys.exit(1)
    sin_ac = sum(1 for n in hojas if not n["existente"] and not n["acs"] and not n.get("guards"))
    por_etapa = {e: sum(1 for v in etapa_de.values() if v == e) for e in ETAPAS}
    print(f"✓ árbol sano: {len(nodos)} nodos · {len([h for h in hojas if not h['existente']])} hojas de PR "
          f"({sin_ac} sin AC propio) · {len(conteo_ac)}/{len(acs)} ACs y {len(conteo_g)}/{len(guards)} guards cubiertos, "
          f"cada uno en una sola hoja · {len(subspecs)} sub-specs · sin ciclos · orden de hijos y de etapas respetado · "
          + " / ".join(f"{e}: {c}" for e, c in por_etapa.items()))
    if prop:
        print("  relaciones de hijos a crear en Linear: " + "; ".join(f"{a} ← {b}" for a, b in sorted(prop)))
    sys.exit(0)


if __name__ == "__main__":
    main()
