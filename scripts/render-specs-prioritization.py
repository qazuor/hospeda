#!/usr/bin/env python3
"""Render specs-prioritization.csv as an interactive HTML table.

The CSV is pipe-delimited (``|``). Two modes:

  - **static** (default): writes a self-contained read-only ``specs-prioritization.html``
    and opens it. Good for a quick look; cannot persist edits (``file://`` is sandboxed).
  - **--serve**: runs a tiny localhost editor. Owner-owned columns (``prioridad``,
    ``estado_manual``, ``notes`` and the judgment columns) become editable and every
    change is persisted back to the CSV (one cell at a time, keyed by ``rank``).

Two status columns by design:
  - ``estado``        — derived from .qtm/specs/index.json (the source of truth). READ-ONLY.
  - ``estado_manual`` — owner-managed override / personal status. EDITABLE.

Usage:
    python3 scripts/render-specs-prioritization.py            # static, build + open
    python3 scripts/render-specs-prioritization.py --no-open  # static, build only
    python3 scripts/render-specs-prioritization.py --serve    # editable, localhost:8765
"""
from __future__ import annotations

import argparse
import json
import os
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "specs-prioritization." + "csv")
OUT_PATH = os.path.join(ROOT, "specs-prioritization.html")

# Columns derived from the index — never editable from the UI.
READONLY = {"rank", "spec", "name", "avance", "estado", "estado_real"}
# Owner-owned columns — editable when served.
EDITABLE = {
    "prioridad", "estado_manual", "notes", "descripcion", "por_que_ahora",
    "por_que_no_ahora", "beneficio", "peligros", "estimado", "se_cruza_con",
}
# Columns rendered as wrapping multi-line cells.
LONG_COLS = {
    "estado_real", "descripcion", "por_que_ahora", "por_que_no_ahora",
    "beneficio", "peligros", "se_cruza_con", "name", "notes",
}
# Allowed values for the manual status select ("-" means unset).
ESTADO_OPTS = ["-", "backlog", "in progress", "done", "blocked"]


def read_rows() -> tuple[list[str], list[list[str]]]:
    with open(CSV_PATH, encoding="utf-8") as fh:
        lines = [ln.rstrip("\n") for ln in fh if ln.strip()]
    header = lines[0].split("|")
    width = len(header)
    rows = [(ln.split("|") + [""] * width)[:width] for ln in lines[1:]]
    return header, rows


def save_cell(rank: str, col: str, value: str) -> dict:
    """Persist one cell to the CSV, keyed by the unique ``rank``. Returns a result dict."""
    if col not in EDITABLE:
        return {"ok": False, "error": "column '%s' is not editable" % col}
    # A value can never contain the delimiter or a newline.
    value = value.replace("|", "/").replace("\r", " ").replace("\n", " ").strip()
    if value == "":
        value = "-"
    if col == "estado_manual" and value not in ESTADO_OPTS:
        return {"ok": False, "error": "invalid estado_manual '%s'" % value}

    header, rows = read_rows()
    if col not in header:
        return {"ok": False, "error": "unknown column '%s'" % col}
    ci, ri = header.index(col), header.index("rank")
    target = None
    for r in rows:
        if r[ri] == str(rank):
            target = r
            break
    if target is None:
        return {"ok": False, "error": "rank '%s' not found" % rank}
    target[ci] = value

    with open(CSV_PATH, "w", encoding="utf-8") as fh:
        fh.write("|".join(header) + "\n")
        for r in rows:
            fh.write("|".join(r) + "\n")
    return {"ok": True, "rank": rank, "col": col, "value": value}


def build_html(editable: bool) -> str:
    header, rows = read_rows()
    cfg = {
        "header": header,
        "rows": rows,
        "readonly": sorted(READONLY),
        "editable": sorted(EDITABLE),
        "long": sorted(LONG_COLS),
        "estadoOpts": ESTADO_OPTS,
        "canEdit": editable,
    }
    return _TEMPLATE.replace("__CFG__", json.dumps(cfg, ensure_ascii=False))


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
  h1 { font-size: 1.2rem; margin: 0 0 .25rem; }
  .mode { font-size: .75rem; color: #94a3b8; margin-bottom: .6rem; }
  .mode b.edit { color: #6ee7b7; } .mode b.ro { color: #fca5a5; }
  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .6rem; position: sticky; top: 0; background: #0f172a; padding: .5rem 0; z-index: 5; }
  .toolbar input, .toolbar select { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: .4rem .6rem; font-size: .85rem; }
  .toolbar input[type=search] { min-width: 220px; }
  .count { margin-left: auto; font-size: .8rem; color: #94a3b8; }
  .saved { font-size: .8rem; color: #6ee7b7; min-width: 90px; }
  button.reset { background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: .4rem .7rem; cursor: pointer; font-size: .85rem; }
  button.reset:hover { background: #475569; }
  .tablewrap { overflow-x: auto; border: 1px solid #1e293b; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: .8rem; }
  th, td { border-bottom: 1px solid #1e293b; padding: .4rem .55rem; text-align: left; vertical-align: top; }
  thead th { position: sticky; top: 0; background: #1e293b; cursor: pointer; white-space: nowrap; user-select: none; }
  thead th:hover { background: #334155; }
  thead th.ed { color: #6ee7b7; } thead th .arrow { color: #38bdf8; font-size: .7rem; }
  tbody tr:hover { background: #15213a; }
  td.long { max-width: 300px; white-space: normal; }
  td.short { white-space: nowrap; }
  .badge { display: inline-block; padding: .12rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600; white-space: nowrap; }
  .badge.done { background: #064e3b; color: #6ee7b7; }
  .badge.inprogress { background: #1e3a8a; color: #93c5fd; }
  .badge.blocked { background: #7f1d1d; color: #fca5a5; }
  .badge.backlog { background: #334155; color: #cbd5e1; }
  .badge.empty { background: transparent; color: #475569; }
  .prio { font-weight: 700; }
  td input.cell, td textarea.cell, td select.cell { width: 100%; background: #0b1322; color: #e2e8f0; border: 1px solid #233149; border-radius: 5px; padding: .25rem .35rem; font: inherit; }
  td textarea.cell { min-height: 2.4rem; resize: vertical; }
  td input.cell:focus, td textarea.cell:focus, td select.cell:focus { outline: none; border-color: #38bdf8; }
  td .cell.dirty { border-color: #6ee7b7; }
</style>
</head>
<body>
<h1>Specs Prioritization</h1>
<div class="mode" id="mode"></div>
<div class="toolbar">
  <input type="search" id="q" placeholder="Buscar en todo..." />
  <select id="estado"><option value="">estado (index): todos</option></select>
  <select id="estado_manual"><option value="">estado_manual: todos</option></select>
  <select id="prioridad"><option value="">prioridad: todas</option></select>
  <button class="reset" id="reset">Reset</button>
  <span class="saved" id="saved"></span>
  <span class="count" id="count"></span>
</div>
<div class="tablewrap">
  <table><thead><tr id="head"></tr></thead><tbody id="body"></tbody></table>
</div>
<script>
const CFG = __CFG__;
const header = CFG.header, rows = CFG.rows;
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const RO = new Set(CFG.readonly), ED = new Set(CFG.editable), LONG = new Set(CFG.long);
const canEdit = CFG.canEdit;
let sortCol = idx["rank"] ?? 0, sortAsc = true;

document.getElementById("mode").innerHTML = canEdit
  ? 'Modo <b class="edit">editable</b> — los cambios se guardan en el CSV al instante. Columnas verdes = editables.'
  : 'Modo <b class="ro">solo lectura</b> — corré <code>python3 scripts/render-specs-prioritization.py --serve</code> para editar.';

function badge(v) {
  const k = (v || "").toLowerCase();
  if (!v || v === "-") return '<span class="badge empty">—</span>';
  let cls = "backlog";
  if (k === "done") cls = "done"; else if (k === "in progress") cls = "inprogress";
  else if (k === "blocked") cls = "blocked"; else if (k === "backlog") cls = "backlog";
  return '<span class="badge ' + cls + '">' + v + "</span>";
}
function uniq(col) { const s = new Set(); rows.forEach(r => { if (r[col] && r[col] !== "-") s.add(r[col]); }); return [...s].sort(); }
function fillSelect(el, col) { uniq(col).forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; el.appendChild(o); }); }

function flashSaved(msg, ok) {
  const el = document.getElementById("saved");
  el.textContent = msg; el.style.color = ok ? "#6ee7b7" : "#fca5a5";
  if (ok) setTimeout(() => { el.textContent = ""; }, 1500);
}

let warned = false;
async function saveCell(rank, col, value, inputEl) {
  if (!canEdit) return;
  try {
    const res = await fetch("/cell", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank: String(rank), col, value }) });
    const data = await res.json();
    if (data.ok) {
      rows.find(r => r[idx["rank"]] === String(rank))[idx[col]] = data.value;
      if (inputEl) inputEl.classList.remove("dirty");
      flashSaved("guardado ✓", true);
    } else { flashSaved("error: " + data.error, false); }
  } catch (e) {
    if (!warned) { alert("No se pudo guardar. Abrí con --serve (server local), no con file://."); warned = true; }
    flashSaved("sin conexión", false);
  }
}

function editor(col, rank, val) {
  if (col === "estado_manual") {
    const sel = document.createElement("select");
    sel.className = "cell";
    CFG.estadoOpts.forEach(o => { const op = document.createElement("option"); op.value = o; op.textContent = o; if (o === (val || "-")) op.selected = true; sel.appendChild(op); });
    sel.onchange = () => saveCell(rank, col, sel.value, sel);
    return sel;
  }
  const long = LONG.has(col);
  const el = document.createElement(long ? "textarea" : "input");
  el.className = "cell"; el.value = (val === "-" ? "" : val);
  el.oninput = () => el.classList.add("dirty");
  el.onblur = () => { if (el.classList.contains("dirty")) saveCell(rank, col, el.value, el); };
  el.onkeydown = (e) => { if (!long && e.key === "Enter") el.blur(); };
  return el;
}

function renderHead() {
  const tr = document.getElementById("head"); tr.innerHTML = "";
  header.forEach((h, i) => {
    const th = document.createElement("th");
    if (canEdit && ED.has(h)) th.className = "ed";
    th.innerHTML = h + '<span class="arrow">' + (i === sortCol ? (sortAsc ? " ▲" : " ▼") : "") + "</span>";
    th.onclick = () => { if (sortCol === i) sortAsc = !sortAsc; else { sortCol = i; sortAsc = true; } render(); };
    tr.appendChild(th);
  });
}
function cmp(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && /^[-\d.]+$/.test(a) && /^[-\d.]+$/.test(b)) return na - nb;
  return (a || "").localeCompare(b || "", "es", { numeric: true });
}
function render() {
  const q = document.getElementById("q").value.toLowerCase().trim();
  const fe = document.getElementById("estado").value;
  const fm = document.getElementById("estado_manual").value;
  const fp = document.getElementById("prioridad").value;
  const ei = idx["estado"], mi = idx["estado_manual"], pi = idx["prioridad"];
  let view = rows.filter(r => {
    if (fe && r[ei] !== fe) return false;
    if (fm && r[mi] !== fm) return false;
    if (fp && r[pi] !== fp) return false;
    if (q && !r.join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  view.sort((a, b) => { const c = cmp(a[sortCol], b[sortCol]); return sortAsc ? c : -c; });
  const body = document.getElementById("body"); body.innerHTML = "";
  view.forEach(r => {
    const tr = document.createElement("tr");
    const rank = r[idx["rank"]];
    r.forEach((cell, i) => {
      const col = header[i];
      const td = document.createElement("td");
      td.className = LONG.has(col) ? "long" : "short";
      if (canEdit && ED.has(col)) { td.appendChild(editor(col, rank, cell)); }
      else if (col === "estado" || col === "estado_manual") { td.innerHTML = badge(cell); }
      else if (col === "prioridad") { td.className += " prio"; td.textContent = cell; }
      else td.textContent = cell;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  document.getElementById("count").textContent = view.length + " / " + rows.length + " specs";
  renderHead();
}
fillSelect(document.getElementById("estado"), idx["estado"]);
fillSelect(document.getElementById("estado_manual"), idx["estado_manual"]);
fillSelect(document.getElementById("prioridad"), idx["prioridad"]);
["q", "estado", "estado_manual", "prioridad"].forEach(id => document.getElementById(id).addEventListener("input", render));
document.getElementById("reset").onclick = () => {
  ["q", "estado", "estado_manual", "prioridad"].forEach(id => document.getElementById(id).value = "");
  render();
};
render();
</script>
</body>
</html>
"""


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path in ("/", "/index.html", "/specs-prioritization.html"):
            self._send(200, build_html(editable=True).encode("utf-8"), "text/html; charset=utf-8")
        else:
            self._send(404, b"not found", "text/plain")

    def do_POST(self) -> None:
        if self.path != "/cell":
            self._send(404, b"not found", "text/plain")
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
            result = save_cell(str(data.get("rank", "")), data.get("col", ""), str(data.get("value", "")))
        except Exception as exc:  # noqa: BLE001 — report any failure to the client
            result = {"ok": False, "error": str(exc)}
        self._send(200, json.dumps(result).encode("utf-8"), "application/json")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-open", action="store_true", help="do not open a browser")
    parser.add_argument("--serve", action="store_true", help="run the editable localhost server")
    parser.add_argument("--port", type=int, default=8765, help="port for --serve (default 8765)")
    args = parser.parse_args()

    if args.serve:
        url = "http://127.0.0.1:%d/" % args.port
        with ThreadingHTTPServer(("127.0.0.1", args.port), _Handler) as httpd:
            print("Editable server at", url, "(Ctrl+C to stop) — edits persist to the CSV")
            if not args.no_open:
                webbrowser.open(url)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nstopped")
        return

    html = build_html(editable=False)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(html)
    header, rows = read_rows()
    print("Wrote", OUT_PATH, "(%d specs, read-only)" % len(rows))
    if not args.no_open:
        webbrowser.open("file://" + OUT_PATH)


if __name__ == "__main__":
    main()
