#!/usr/bin/env python3
"""Planifica o crea el árbol HOS-1352. Sin --apply nunca hace mutaciones.

Uso: python3 crear_arbol.py [--dry-run | --apply]
En --apply requiere LINEAR_API_KEY; no carga archivos .env.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
TREE = HERE / "arbol.json"
CREATED = HERE / "creados.json"
API = "https://api.linear.app/graphql"
MARKER = "Árbol HOS-1352 — clave:"


def graphql(query, variables, key):
    request = Request(API, json.dumps({"query": query, "variables": variables}).encode(),
                      {"Authorization": key, "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=30) as response:
            body = json.load(response)
    except (HTTPError, URLError) as error:
        raise RuntimeError(f"Linear no respondió correctamente: {error}") from error
    if body.get("errors"):
        raise RuntimeError("Linear GraphQL: " + "; ".join(e.get("message", "error") for e in body["errors"]))
    return body["data"]


def save_state(state):
    # Reemplazo atómico: un corte nunca deja JSON parcial.
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=HERE, prefix=".creados-", delete=False) as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
        temp = Path(handle.name)
    os.replace(temp, CREATED)


def ordered(nodes):
    by = {n["clave"]: n for n in nodes}
    if len(by) != len(nodes):
        raise ValueError("Hay claves duplicadas")
    result, active, done = [], set(), set()

    def visit(key):
        if key in active:
            raise ValueError(f"Ciclo de padres: {key}")
        if key in done:
            return
        if key not in by:
            raise ValueError(f"Padre inexistente en el árbol: {key}")
        active.add(key)
        parent = by[key]["padre"]
        if parent:
            visit(parent)
        active.remove(key)
        done.add(key)
        result.append(by[key])

    for node in nodes:
        visit(node["clave"])
    return result, by


def remote_snapshot(key, team_id):
    labels = {}
    specificity = {}
    after = None
    while True:
        data = graphql("query($first:Int!,$after:String){issueLabels(first:$first,after:$after){nodes{id name team{id}} pageInfo{hasNextPage endCursor}}}",
                       {"first": 250, "after": after}, key)["issueLabels"]
        for label in data["nodes"]:
            owner = label["team"]["id"] if label["team"] else None
            if owner not in (None, team_id):
                continue
            rank = 1 if owner == team_id else 0
            if label["name"] in labels and specificity[label["name"]] == rank:
                raise ValueError(f"Label duplicado en HOS: {label['name']}")
            if label["name"] not in labels or rank > specificity[label["name"]]:
                labels[label["name"]] = label["id"]
                specificity[label["name"]] = rank
        if not data["pageInfo"]["hasNextPage"]:
            break
        after = data["pageInfo"]["endCursor"]
    issues = []
    after = None
    while True:
        data = graphql("query($id:String!,$first:Int!,$after:String){team(id:$id){issues(first:$first,after:$after){nodes{id identifier title description} pageInfo{hasNextPage endCursor}}}}",
                       {"id": team_id, "first": 250, "after": after}, key)["team"]["issues"]
        issues.extend(data["nodes"])
        if not data["pageInfo"]["hasNextPage"]:
            break
        after = data["pageInfo"]["endCursor"]
    return labels, issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Plan sin mutaciones (default)")
    mode.add_argument("--apply", action="store_true", help="Crear en Linear")
    args = parser.parse_args()
    check = subprocess.run([sys.executable, str(HERE / "chequeo.py")], capture_output=True, text=True)
    if check.returncode:
        raise ValueError(check.stdout.strip() or check.stderr.strip())
    nodes, by = ordered(json.loads(TREE.read_text(encoding="utf-8"))["nodos"])
    state = json.loads(CREATED.read_text(encoding="utf-8")) if CREATED.exists() else {"creados": {}, "relaciones": []}
    made = state["creados"]
    if set(made) - set(by) or any(by[k]["existente"] for k in made):
        raise ValueError("creados.json contiene una clave desconocida o existente")
    key = os.environ.get("LINEAR_API_KEY")
    if args.apply and not key:
        raise ValueError("Falta LINEAR_API_KEY")
    team_id, labels, remote = None, {}, []
    if key:
        try:
            teams = graphql("query{teams{nodes{id key}}}", {}, key)["teams"]["nodes"]
        except RuntimeError:
            if args.apply:
                raise
            print("Aviso: Linear no está accesible; dry-run local sin preflight remoto.")
            key = None
    if key:
        matches = [team for team in teams if team["key"] == "HOS"]
        if len(matches) != 1:
            raise ValueError("No existe exactamente un team con key HOS")
        team_id = matches[0]["id"]
        labels, remote = remote_snapshot(key, team_id)
        missing = sorted({label for n in nodes if not n["existente"] for label in n["labels"]} - set(labels))
        if missing:
            raise ValueError(f"Labels inexistentes en team HOS: {missing}")
        identifiers = {issue["identifier"]: issue for issue in remote}
        for n in nodes:
            if n["existente"] and n["existente"] not in identifiers:
                raise ValueError(f"Padre/issue existente no encontrada en HOS: {n['existente']}")
        for k, issue_id in made.items():
            if not any(i["id"] == issue_id for i in remote):
                raise ValueError(f"creados.json apunta a issue ausente de HOS: {k}")
        # Recupera un issue creado justo antes de un corte, antes de escribir otro.
        for n in nodes:
            if n["existente"] or n["clave"] in made:
                continue
            found = [i for i in remote if f"{MARKER} `{n['clave']}`" in (i["description"] or "")]
            if len(found) > 1:
                raise ValueError(f"Dos issues remotas tienen la clave {n['clave']}")
            if found:
                made[n["clave"]] = found[0]["id"]
            elif any(i["title"] == n["titulo"] for i in remote):
                raise ValueError(f"Ya existe un issue con el título de {n['clave']}; revisar antes de crear")
    elif args.apply:
        raise ValueError("Falta LINEAR_API_KEY")

    planned = [n for n in nodes if not n["existente"] and n["clave"] not in made]
    # Las dependencias de contenedores existentes ya están materializadas por
    # las hojas de entrada/salida; no se muta ningún issue existente.
    relations = [(n["clave"], d) for n in nodes if not n["existente"]
                 for d in n["depende_de"] if not by[d]["existente"]]
    print(f"{'APPLY' if args.apply else 'DRY-RUN'} · team HOS · {len(planned)} nodos por crear · {len(relations)} relaciones blocked by")
    if not key:
        print("Preflight remoto pendiente: labels, padres y duplicados se validarán en --apply.")
    grouped = defaultdict(list)
    for n in planned:
        grouped[n["padre"]].append(n["clave"])
    for parent, keys in grouped.items():
        print(f"  bajo {parent}: {', '.join(keys)}")
    if not args.apply:
        return

    # Todo el preflight anterior termina antes de la primera mutación.
    if made and not CREATED.exists():
        save_state(state)
    existing = {n["clave"]: next(i["id"] for i in remote if i["identifier"] == n["existente"])
                for n in nodes if n["existente"]}
    ids = {**existing, **made}
    for n in planned:
        parent_id = ids.get(n["padre"])
        if not parent_id:
            raise ValueError(f"Padre no resuelto: {n['padre']}")
        description = n["descripcion"].rstrip() + f"\n\n{MARKER} `{n['clave']}`"
        response = graphql("mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id identifier}}}",
                           {"input": {"teamId": team_id, "parentId": parent_id, "title": n["titulo"],
                                      "description": description, "labelIds": [labels[name] for name in n["labels"]]}}, key)["issueCreate"]
        if not response["success"] or not response["issue"]:
            raise RuntimeError(f"Linear no creó {n['clave']}")
        ids[n["clave"]] = response["issue"]["id"]
        made[n["clave"]] = response["issue"]["id"]
        save_state(state)
        print(f"creado {n['clave']} → {response['issue']['identifier']}")
    # Sólo relaciona nodos nuevos: los existentes no reciben mutaciones.
    recorded = {tuple(pair) for pair in state["relaciones"]}
    for dependent, blocker in relations:
        pair = (dependent, blocker)
        if pair in recorded:
            continue
        current = graphql("query($id:String!){issue(id:$id){relations(first:250){nodes{type issue{id} relatedIssue{id}}}}}",
                          {"id": ids[blocker]}, key)["issue"]
        already = current and any(r["type"] == "blocks" and r["issue"]["id"] == ids[blocker]
                                  and r["relatedIssue"]["id"] == ids[dependent]
                                  for r in current["relations"]["nodes"])
        if already:
            state["relaciones"].append(list(pair))
            recorded.add(pair)
            save_state(state)
            continue
        response = graphql("mutation($input:IssueRelationCreateInput!){issueRelationCreate(input:$input){success issueRelation{id}}}",
                           {"input": {"issueId": ids[blocker], "relatedIssueId": ids[dependent], "type": "blocks"}}, key)["issueRelationCreate"]
        if not response["success"]:
            raise RuntimeError(f"No se creó relación {dependent} blocked by {blocker}")
        state["relaciones"].append(list(pair))
        recorded.add(pair)
        save_state(state)
        print(f"relación {dependent} blocked by {blocker}")


if __name__ == "__main__":
    try:
        main()
    except (KeyError, ValueError, RuntimeError, OSError, json.JSONDecodeError) as error:
        print(f"✗ {error}", file=sys.stderr)
        sys.exit(1)
