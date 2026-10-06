#!/usr/bin/env python3
"""Lists the HOS-1352 leaf issues that are ready to implement.

A leaf is ready when it is not started and every leaf it depends on
(``depende_de`` in ``42-arbol-linear/arbol.json``, materialised in Linear as
"blocked by") is already Done. Read-only: it never writes to Linear.

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
    request = urllib.request.Request(
        "https://api.linear.app/graphql",
        json.dumps({"query": query}).encode(),
        {"Authorization": os.environ["LINEAR_API_KEY"], "Content-Type": "application/json"},
    )
    data = json.load(urllib.request.urlopen(request))
    if "errors" in data:
        raise RuntimeError(data["errors"])
    return data["data"]


def main() -> None:
    nodes = {n["clave"]: n for n in json.loads((ARBOL / "arbol.json").read_text())["nodos"]}
    created = json.loads((ARBOL / "creados.json").read_text())["creados"]
    parents = {n["padre"] for n in nodes.values()}
    leaves = [k for k in nodes if k not in parents and k in created]
    state: dict[str, tuple[str, str, str]] = {}
    for i in range(0, len(leaves), 50):
        chunk = leaves[i : i + 50]
        body = " ".join(
            f'n{j}:issue(id:"{created[k]}"){{identifier title state{{type}}}}' for j, k in enumerate(chunk)
        )
        data = graphql("query{" + body + "}")
        for j, k in enumerate(chunk):
            issue = data[f"n{j}"]
            state[k] = (issue["identifier"], issue["state"]["type"], issue["title"])

    def done(key: str) -> bool:
        # A dependency on a container counts as done when all its leaves are done.
        if key in state:
            return state[key][1] == "completed"
        kids = [k for k in nodes if nodes[k]["padre"] == key]
        return bool(kids) and all(done(k) for k in kids)

    ready = [
        k for k in leaves
        if state[k][1] in ("backlog", "unstarted", "triage") and all(done(d) for d in nodes[k]["depende_de"])
    ]
    started = [k for k in leaves if state[k][1] == "started"]
    total_done = sum(1 for k in leaves if state[k][1] == "completed")
    print(f"hojas: {len(leaves)} · hechas: {total_done} · en curso: {len(started)} · listas: {len(ready)}")
    for k in started:
        print(f"  EN CURSO  {state[k][0]}  {k:10}  {state[k][2]}")
    for k in ready if "--todas" in sys.argv else ready[:5]:
        print(f"  LISTA     {state[k][0]}  {k:10}  {state[k][2]}")


if __name__ == "__main__":
    main()
