#!/usr/bin/env python3
"""Lists the HOS-1352 leaf issues that are ready to implement.

A leaf is ready when it is not started and every leaf it depends on
(``depende_de`` in ``42-arbol-linear/arbol.json``, materialised in Linear as
"blocked by") is already Done. It also honours Linear-only "blocks" relations
(inverse relations of type ``blocks`` that arbol.json does not know about): a
leaf stays held back until each blocking issue is completed. Leaves whose
``corte`` starts with ``fase-`` are never proposed (absent ``corte`` = mvp).
Read-only: only GraphQL queries, never mutations.

Usage: python3 siguiente.py [--todas]   (default: only the first 5 ready leaves)
Needs LINEAR_API_KEY in the environment.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ARBOL = HERE.parent / "42-arbol-linear"


def graphql(query: str) -> dict:
    if not os.environ.get("LINEAR_API_KEY"):
        sys.exit("Falta LINEAR_API_KEY en el entorno: no puedo consultar Linear.")
    request = urllib.request.Request(
        "https://api.linear.app/graphql",
        json.dumps({"query": query}).encode(),
        {"Authorization": os.environ["LINEAR_API_KEY"], "Content-Type": "application/json"},
    )
    data = json.load(urllib.request.urlopen(request))
    if "errors" in data:
        raise RuntimeError(data["errors"])
    return data["data"]


def linear_blockers(issue: dict) -> tuple[list[str], list[str]]:
    """Linear "blocks" relations on this issue: (open blockers, canceled blockers).

    A completed blocker no longer blocks. A canceled one does not block either
    (otherwise the leaf would wait forever), but it is reported for review.
    """
    relations = (issue.get("inverseRelations") or {}).get("nodes") or []
    blocking = [r["issue"] for r in relations if r.get("type") == "blocks"]
    open_ = [b["identifier"] for b in blocking if b["state"]["type"] not in ("completed", "canceled")]
    canceled = [b["identifier"] for b in blocking if b["state"]["type"] == "canceled"]
    return open_, canceled


def is_deferred(node: dict) -> bool:
    """True when the leaf belongs to a later phase (``corte`` = fase-N). Absent = mvp."""
    return str(node.get("corte") or "mvp").startswith("fase-")


def main() -> None:
    nodes = {n["clave"]: n for n in json.loads((ARBOL / "arbol.json").read_text())["nodos"]}
    created = json.loads((ARBOL / "creados.json").read_text())["creados"]
    parents = {n["padre"] for n in nodes.values()}
    all_leaves = [k for k in nodes if k not in parents]
    # A leaf without an issue in creados.json is reported, never hidden.
    no_issue = [k for k in all_leaves if k not in created and not is_deferred(nodes[k])]
    leaves = [k for k in all_leaves if k in created]
    state: dict[str, tuple[str, str, str]] = {}
    held: dict[str, list[str]] = {}
    canceled: dict[str, list[str]] = {}
    for i in range(0, len(leaves), 50):
        chunk = leaves[i : i + 50]
        body = " ".join(
            f'n{j}:issue(id:"{created[k]}"){{identifier title state{{type}} '
            f'inverseRelations{{nodes{{type issue{{identifier state{{type name}}}}}}}}}}}}' for j, k in enumerate(chunk)
        )
        data = graphql("query{" + body + "}")
        for j, k in enumerate(chunk):
            issue = data[f"n{j}"]
            state[k] = (issue["identifier"], issue["state"]["type"], issue["title"])
            held[k], canceled[k] = linear_blockers(issue)

    def done(key: str) -> bool:
        # A dependency on a container counts as done when all its leaves are done.
        if key in state:
            return state[key][1] == "completed"
        kids = [k for k in nodes if nodes[k]["padre"] == key]
        return bool(kids) and all(done(k) for k in kids)

    ready = [
        k for k in leaves
        if state[k][1] in ("backlog", "unstarted", "triage")
        and not is_deferred(nodes[k])
        and all(done(d) for d in nodes[k]["depende_de"])
        and not held[k]
    ]
    # Ready by arbol.json but held back by a Linear-only "blocks" relation.
    linear_held = [
        k for k in leaves
        if state[k][1] in ("backlog", "unstarted", "triage")
        and not is_deferred(nodes[k])
        and all(done(d) for d in nodes[k]["depende_de"])
        and held[k]
    ]
    started = [k for k in leaves if state[k][1] == "started"]
    total_done = sum(1 for k in leaves if state[k][1] == "completed")
    print(f"hojas: {len(leaves)} · hechas: {total_done} · en curso: {len(started)} · listas: {len(ready)}")
    for k in started:
        print(f"  EN CURSO  {state[k][0]}  {k:10}  {state[k][2]}")
    for k in ready if "--todas" in sys.argv else ready[:5]:
        print(f"  LISTA     {state[k][0]}  {k:10}  {state[k][2]}")
    for k in linear_held:
        print(f"  RETENIDA  {state[k][0]}  {k:10}  bloqueada en Linear por {', '.join(held[k])}")
    for k in leaves:
        if canceled[k] and state[k][1] != "completed":
            print(f"  AVISO     {state[k][0]}  {k:10}  bloqueador cancelado, revisar: {', '.join(canceled[k])}")
    for k in no_issue:
        print(f"  SIN ISSUE {'':9}{k:10}  hoja sin issue en creados.json: {nodes[k]['titulo']}")


if __name__ == "__main__":
    main()
