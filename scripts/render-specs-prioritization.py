#!/usr/bin/env python3
"""Render specs-prioritization.csv as a standalone interactive HTML table.

The CSV is pipe-delimited (``|``). The generated HTML is fully self-contained
(data is embedded as JSON, no external assets) and supports:
  - global text search across every column
  - per-column filters for ``estado`` and ``prioridad``
  - click-to-sort on any column header (toggles asc/desc)
  - colored status badges (backlog / in progress / done / blocked)
  - a live count of visible vs total rows

Usage:
    python3 scripts/render-specs-prioritization.py            # build + open in browser
    python3 scripts/render-specs-prioritization.py --no-open  # build only
    python3 scripts/render-specs-prioritization.py --serve    # serve on localhost:8765
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import socketserver
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "specs-prioritization." + "csv")
OUT_PATH = os.path.join(ROOT, "specs-prioritization.html")

# Long free-text columns get a narrower default width and wrap.
LONG_COLS = {
    "estado_real", "descripcion", "por_que_ahora", "por_que_no_ahora",
    "beneficio", "peligros", "se_cruza_con", "name",
}


def read_rows() -> tuple[list[str], list[list[str]]]:
    with open(CSV_PATH, encoding="utf-8") as fh:
        lines = [ln.rstrip("\n") for ln in fh if ln.strip()]
    header = lines[0].split("|")
    rows = [ln.split("|") for ln in lines[1:]]
    # Pad/truncate defensively so every row matches the header width.
    width = len(header)
    rows = [(r + [""] * width)[:width] for r in rows]
    return header, rows


def build_html(header: list[str], rows: list[list[str]]) -> str:
    payload = json.dumps({"header": header, "rows": rows}, ensure_ascii=False)
    long_cols = json.dumps(sorted(LONG_COLS))
    return _TEMPLATE.replace("__DATA__", payload).replace("__LONGCOLS__", long_cols)


_TEMPLATE = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Specs Prioritization</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 1rem; background: #0f172a; color: #e2e8f0; }
  h1 { font-size: 1.25rem; margin: 0 0 .75rem; }
  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .75rem; position: sticky; top: 0; background: #0f172a; padding: .5rem 0; z-index: 5; }
  .toolbar input, .toolbar select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: .4rem .6rem; font-size: .85rem; }
  .toolbar input[type=search] { min-width: 240px; }
  .count { margin-left: auto; font-size: .8rem; color: #94a3b8; }
  button.reset { background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: .4rem .7rem; cursor: pointer; font-size: .85rem; }
  button.reset:hover { background: #475569; }
  .tablewrap { overflow-x: auto; border: 1px solid #1e293b; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: .8rem; }
  th, td { border-bottom: 1px solid #1e293b; padding: .5rem .6rem; text-align: left; vertical-align: top; }
  thead th { position: sticky; top: 0; background: #1e293b; cursor: pointer; white-space: nowrap; user-select: none; }
  thead th:hover { background: #334155; }
  thead th .arrow { color: #38bdf8; font-size: .7rem; }
  tbody tr:hover { background: #15213a; }
  td.long { max-width: 320px; white-space: normal; }
  td.short { white-space: nowrap; }
  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600; white-space: nowrap; }
  .badge.done { background: #064e3b; color: #6ee7b7; }
  .badge.inprogress { background: #1e3a8a; color: #93c5fd; }
  .badge.blocked { background: #7f1d1d; color: #fca5a5; }
  .badge.backlog { background: #334155; color: #cbd5e1; }
  .prio { font-weight: 700; }
</style>
</head>
<body>
<h1>Specs Prioritization</h1>
<div class="toolbar">
  <input type="search" id="q" placeholder="Buscar en todo..." />
  <select id="estado"><option value="">estado: todos</option></select>
  <select id="prioridad"><option value="">prioridad: todas</option></select>
  <button class="reset" id="reset">Reset</button>
  <span class="count" id="count"></span>
</div>
<div class="tablewrap">
  <table>
    <thead><tr id="head"></tr></thead>
    <tbody id="body"></tbody>
  </table>
</div>
<script>
const DATA = __DATA__;
const LONG = new Set(__LONGCOLS__);
const header = DATA.header;
const rows = DATA.rows;
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

let sortCol = header.includes("rank") ? idx["rank"] : 0;
let sortAsc = true;

function badge(v) {
  const k = (v || "").toLowerCase();
  let cls = "backlog";
  if (k === "done") cls = "done";
  else if (k === "in progress") cls = "inprogress";
  else if (k === "blocked") cls = "blocked";
  else if (k === "backlog") cls = "backlog";
  return '<span class="badge ' + cls + '">' + (v || "") + "</span>";
}

function uniq(col) {
  const s = new Set();
  rows.forEach(r => { if (r[col] && r[col] !== "-") s.add(r[col]); });
  return [...s].sort();
}

function fillSelect(el, col) {
  uniq(col).forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v; el.appendChild(o);
  });
}

function renderHead() {
  const tr = document.getElementById("head");
  tr.innerHTML = "";
  header.forEach((h, i) => {
    const th = document.createElement("th");
    const arrow = i === sortCol ? (sortAsc ? " ▲" : " ▼") : "";
    th.innerHTML = h + '<span class="arrow">' + arrow + "</span>";
    th.onclick = () => {
      if (sortCol === i) sortAsc = !sortAsc; else { sortCol = i; sortAsc = true; }
      render();
    };
    tr.appendChild(th);
  });
}

function cmp(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  const bothNum = !isNaN(na) && !isNaN(nb) && /^[-\d.]+$/.test(a) && /^[-\d.]+$/.test(b);
  if (bothNum) return na - nb;
  return (a || "").localeCompare(b || "", "es", { numeric: true });
}

function render() {
  const q = document.getElementById("q").value.toLowerCase().trim();
  const fe = document.getElementById("estado").value;
  const fp = document.getElementById("prioridad").value;
  const ei = idx["estado"], pi = idx["prioridad"];

  let view = rows.filter(r => {
    if (fe && r[ei] !== fe) return false;
    if (fp && r[pi] !== fp) return false;
    if (q && !r.join(" ").toLowerCase().includes(q)) return false;
    return true;
  });

  view.sort((a, b) => {
    const c = cmp(a[sortCol], b[sortCol]);
    return sortAsc ? c : -c;
  });

  const body = document.getElementById("body");
  body.innerHTML = "";
  view.forEach(r => {
    const tr = document.createElement("tr");
    r.forEach((cell, i) => {
      const td = document.createElement("td");
      td.className = LONG.has(header[i]) ? "long" : "short";
      if (header[i] === "estado") td.innerHTML = badge(cell);
      else if (header[i] === "prioridad") { td.className += " prio"; td.textContent = cell; }
      else td.textContent = cell;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  document.getElementById("count").textContent = view.length + " / " + rows.length + " specs";
  renderHead();
}

fillSelect(document.getElementById("estado"), idx["estado"]);
fillSelect(document.getElementById("prioridad"), idx["prioridad"]);
["q", "estado", "prioridad"].forEach(id => document.getElementById(id).addEventListener("input", render));
document.getElementById("reset").onclick = () => {
  document.getElementById("q").value = "";
  document.getElementById("estado").value = "";
  document.getElementById("prioridad").value = "";
  render();
};
render();
</script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-open", action="store_true", help="build only, do not open a browser")
    parser.add_argument("--serve", action="store_true", help="serve the HTML on localhost:8765")
    parser.add_argument("--port", type=int, default=8765, help="port for --serve (default 8765)")
    args = parser.parse_args()

    header, rows = read_rows()
    html = build_html(header, rows)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("Wrote", OUT_PATH, "(%d specs)" % len(rows))

    if args.serve:
        os.chdir(ROOT)
        rel = os.path.basename(OUT_PATH)
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("127.0.0.1", args.port), handler) as httpd:
            url = "http://127.0.0.1:%d/%s" % (args.port, rel)
            print("Serving at", url, "(Ctrl+C to stop)")
            if not args.no_open:
                webbrowser.open(url)
            httpd.serve_forever()
    elif not args.no_open:
        webbrowser.open("file://" + OUT_PATH)


if __name__ == "__main__":
    main()
