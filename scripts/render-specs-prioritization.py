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

UI: light/dark toggle, zebra striping, click-to-edit (edit-in-place), and each spec
laid out as two rows (a key row + a detail grid) so wide records don't get cramped.

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

# Columns shown on the spec's first (key) row. The rest go in the detail grid below.
MAIN_COLS = ["rank", "spec", "name", "avance", "prioridad", "estado_manual", "estado"]
# Columns derived from the index — never editable from the UI.
READONLY = {"rank", "spec", "name", "avance", "estado", "estado_real"}
# Owner-owned columns — editable when served.
EDITABLE = {
    "prioridad", "estado_manual", "notes", "descripcion", "por_que_ahora",
    "por_que_no_ahora", "beneficio", "peligros", "estimado", "se_cruza_con",
}
# Columns rendered as wrapping multi-line cells / textareas.
LONG_COLS = {
    "estado_real", "descripcion", "por_que_ahora", "por_que_no_ahora",
    "beneficio", "peligros", "se_cruza_con", "name", "notes",
}
# Allowed values for the status selects ("-" means unset).
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
    target = next((r for r in rows if r[ri] == str(rank)), None)
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
        "mainCols": [c for c in MAIN_COLS if c in header],
        "detailCols": [c for c in header if c not in MAIN_COLS],
        "editable": sorted(EDITABLE),
        "long": sorted(LONG_COLS),
        "estadoOpts": ESTADO_OPTS,
        "canEdit": editable,
    }
    return _TEMPLATE.replace("__CFG__", json.dumps(cfg, ensure_ascii=False))


_TEMPLATE = r"""<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Specs Prioritization</title>
<style>
  * { box-sizing: border-box; }
  html[data-theme=dark] {
    --bg:#0f172a; --fg:#e2e8f0; --panel:#1e293b; --panel2:#334155; --border:#243149;
    --zebra:#162136; --muted:#94a3b8; --input:#0b1322; --accent:#38bdf8; --ok:#6ee7b7; --err:#fca5a5;
  }
  html[data-theme=light] {
    --bg:#f8fafc; --fg:#0f172a; --panel:#e9eef5; --panel2:#d6deea; --border:#cbd5e1;
    --zebra:#eef2f8; --muted:#64748b; --input:#ffffff; --accent:#0284c7; --ok:#047857; --err:#b91c1c;
  }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 1rem; background: var(--bg); color: var(--fg); }
  h1 { font-size: 1.2rem; margin: 0 0 .25rem; display:inline-block; }
  .mode { font-size: .75rem; color: var(--muted); margin-bottom: .6rem; }
  .mode b.edit { color: var(--ok); } .mode b.ro { color: var(--err); }
  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .6rem; position: sticky; top: 0; background: var(--bg); padding: .5rem 0; z-index: 5; }
  .toolbar input, .toolbar select { background: var(--panel); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: .4rem .6rem; font-size: .85rem; }
  .toolbar input[type=search] { min-width: 220px; }
  .count { margin-left: auto; font-size: .8rem; color: var(--muted); }
  .saved { font-size: .8rem; color: var(--ok); min-width: 86px; }
  button { background: var(--panel2); color: var(--fg); border: none; border-radius: 6px; padding: .4rem .7rem; cursor: pointer; font-size: .85rem; }
  button:hover { filter: brightness(1.15); }
  .tablewrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: .8rem; }
  th, td { text-align: left; vertical-align: top; }
  thead th { position: sticky; top: 0; background: var(--panel); cursor: pointer; white-space: nowrap; user-select: none; padding: .5rem .55rem; border-bottom: 1px solid var(--border); }
  thead th:hover { background: var(--panel2); }
  thead th.ed { color: var(--ok); } thead th .arrow { color: var(--accent); font-size: .7rem; }
  tr.main td { padding: .5rem .55rem .35rem; border-top: 2px solid var(--border); background: var(--esttint, transparent); }
  tr.detail td { padding: 0 .55rem .55rem; background: var(--esttint, transparent); }
  tr.main td:first-child, tr.detail td:first-child { border-left: 4px solid var(--estbar, transparent); }
  tr.main.zebra td, tr.detail.zebra td { background-image: linear-gradient(0deg, rgba(127,127,127,.06), rgba(127,127,127,.06)); }
  td.long { max-width: 320px; white-space: normal; }
  td.short { white-space: nowrap; }
  .colrank { color: var(--muted); font-size: .72rem; font-variant-numeric: tabular-nums; }
  .colspec { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); font-size: .92rem; font-weight: 700; }
  .colname { font-size: .92rem; font-weight: 600; line-height: 1.25; }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: .3rem .9rem; padding: .1rem 0 0 .25rem; }
  .field { font-size: .78rem; min-width: 0; line-height: 1.35; }
  .field .label { color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: .66rem; letter-spacing: .05em; display: block; margin-bottom: .08rem; }
  .badge { display: inline-block; padding: .12rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600; white-space: nowrap; }
  .badge.done { background: #064e3b; color: #6ee7b7; }
  .badge.inprogress { background: #1e3a8a; color: #93c5fd; }
  .badge.blocked { background: #7f1d1d; color: #fca5a5; }
  .badge.backlog { background: #475569; color: #e2e8f0; }
  .badge.empty { background: transparent; color: var(--muted); }
  .badge.pick { background: transparent; color: var(--accent); border: 1px dashed var(--accent); cursor: pointer; }
  .val.editable:has(.badge) { border-bottom: none; padding: 0; }
  .badge.idx { font-size: .64rem; opacity: .7; font-weight: 500; }
  .pchip { display: inline-block; font-weight: 700; padding: .1rem .45rem; border-radius: 5px; font-size: .72rem; }
  .pchip.P0 { background: #7f1d1d; color: #fecaca; } .pchip.P1 { background: #7c2d12; color: #fed7aa; }
  .pchip.P2 { background: #713f12; color: #fde68a; } .pchip.P3 { background: #334155; color: #cbd5e1; }
  .pchip.P4 { background: #1f2937; color: #9ca3af; } .pchip.none { color: var(--muted); }
  .fg { display: inline-flex; align-items: center; gap: .25rem; flex-wrap: wrap; }
  .fglabel { font-size: .72rem; color: var(--muted); margin-right: .1rem; }
  .filt { cursor: pointer; opacity: .38; transition: opacity .1s; border-radius: 999px; }
  .filt:hover { opacity: .7; }
  .filt.on { opacity: 1; outline: 2px solid var(--accent); outline-offset: 1px; }
  .prog { display: inline-flex; align-items: center; gap: .4rem; }
  .prog .track { width: 52px; height: 6px; background: var(--panel2); border-radius: 3px; overflow: hidden; }
  .prog .fill { display: block; height: 100%; background: var(--accent); }
  .prog .txt { font-size: .72rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .val { display: inline-block; min-width: 1rem; max-width: 100%; white-space: pre-wrap; word-break: break-word; }
  .val .empty { color: var(--muted); }
  .val.editable { cursor: text; border-bottom: 1px dashed var(--border); padding: 0 .1rem; border-radius: 3px; }
  .val.editable:hover { background: var(--panel2); border-bottom-color: var(--accent); }
  .cell { width: 100%; background: var(--input); color: var(--fg); border: 1px solid var(--accent); border-radius: 5px; padding: .25rem .35rem; font: inherit; }
  textarea.cell { min-height: 3rem; resize: vertical; }
  .cell:focus { outline: none; }
</style>
</head>
<body>
<h1>Specs Prioritization</h1>
<button id="theme" style="margin-left:.6rem">◐ tema</button>
<div class="mode" id="mode"></div>
<div class="toolbar">
  <input type="search" id="q" placeholder="Buscar en todo..." />
  <span class="fg" id="fg_estado_manual"><span class="fglabel">mi estado:</span></span>
  <span class="fg" id="fg_prioridad"><span class="fglabel">prioridad:</span></span>
  <span class="fg" id="fg_estado"><span class="fglabel">index:</span></span>
  <label style="font-size:.8rem;color:var(--muted);display:flex;align-items:center;gap:.3rem"><input type="checkbox" id="empty" /> campos vacíos</label>
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
const ED = new Set(CFG.editable), LONG = new Set(CFG.long), canEdit = CFG.canEdit;
let sortCol = idx["rank"] ?? 0, sortAsc = true;

// theme
const root = document.documentElement;
root.dataset.theme = localStorage.getItem("spp-theme") || "dark";
document.getElementById("theme").onclick = () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("spp-theme", root.dataset.theme);
};

document.getElementById("mode").innerHTML = canEdit
  ? 'Modo <b class="edit">editable</b> — click en un campo para editar; se guarda solo. Columnas verdes = editables.'
  : 'Modo <b class="ro">solo lectura</b> — corré <code>python3 scripts/render-specs-prioritization.py --serve</code> para editar.';

function badge(v) {
  const k = (v || "").toLowerCase();
  if (!v || v === "-") return '<span class="badge empty">—</span>';
  let cls = "backlog";
  if (k === "done") cls = "done"; else if (k === "in progress") cls = "inprogress";
  else if (k === "blocked") cls = "blocked";
  return '<span class="badge ' + cls + '">' + v + "</span>";
}
function estBar(v) {
  const k = (v || "").toLowerCase();
  if (k === "done") return "#10b981"; if (k === "in progress") return "#3b82f6";
  if (k === "blocked") return "#ef4444"; if (k === "backlog") return "#64748b";
  return "transparent";
}
function estTint(v) {
  const k = (v || "").toLowerCase();
  if (k === "done") return "rgba(16,185,129,.24)"; if (k === "in progress") return "rgba(59,130,246,.24)";
  if (k === "blocked") return "rgba(239,68,68,.26)"; if (k === "backlog") return "rgba(100,116,139,.20)";
  return "transparent";
}
// estado_manual: make the owner's editable status obvious (a clear affordance)
function manualBadge(v) {
  if (!canEdit) return badge(v);
  if (!v || v === "-") return '<span class="badge pick">elegir ▾</span>';
  return badge(v).replace("</span>", " ▾</span>");
}
function idxBadge(v) { return badge(v).replace('class="badge ', 'class="badge idx '); }
function prioChip(v) {
  if (!v || v === "-") return '<span class="pchip none">—</span>';
  const c = ["P0", "P1", "P2", "P3", "P4"].includes(v) ? v : "none";
  return '<span class="pchip ' + c + '">' + v + "</span>";
}
function avanceCell(v) {
  const m = /^(\d+)\/(\d+)$/.exec(v || "");
  if (m && +m[2] > 0) {
    const pct = Math.round(100 * (+m[1]) / (+m[2]));
    return '<span class="prog"><span class="track"><span class="fill" style="width:' + pct + '%"></span></span><span class="txt">' + v + "</span></span>";
  }
  return '<span class="txt" style="color:var(--muted)">' + (!v || v === "-" ? "—" : v) + "</span>";
}
function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function uniq(col) { const s = new Set(); rows.forEach(r => { if (r[col] && r[col] !== "-") s.add(r[col]); }); return [...s].sort(); }

function flashSaved(msg, ok) {
  const el = document.getElementById("saved");
  el.textContent = msg; el.style.color = ok ? "var(--ok)" : "var(--err)";
  if (ok) setTimeout(() => { el.textContent = ""; }, 1500);
}
let warned = false;
async function saveCell(rank, col, value) {
  try {
    const res = await fetch("/cell", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank: String(rank), col, value }) });
    const data = await res.json();
    if (data.ok) { rows.find(r => r[idx["rank"]] === String(rank))[idx[col]] = data.value; flashSaved("guardado ✓", true); return data.value; }
    flashSaved("error: " + data.error, false); return null;
  } catch (e) {
    if (!warned) { alert("No se pudo guardar. Abrí con --serve (server local), no con file://."); warned = true; }
    flashSaved("sin conexión", false); return null;
  }
}

// edit-in-place: a span that shows the value and swaps to an input on click
function paint(span, col, val) {
  span.dataset.val = val;
  if (col === "estado") span.innerHTML = idxBadge(val);
  else if (col === "estado_manual") span.innerHTML = manualBadge(val);
  else if (col === "prioridad") span.innerHTML = prioChip(val);
  else if (col === "avance") span.innerHTML = avanceCell(val);
  else if (col === "rank") span.innerHTML = '<span class="colrank">#' + esc(val) + "</span>";
  else if (col === "spec") span.innerHTML = '<span class="colspec">' + esc(val) + "</span>";
  else if (col === "name") span.innerHTML = '<span class="colname">' + esc(val) + "</span>";
  else if (!val || val === "-") span.innerHTML = '<span class="empty">—</span>';
  else span.textContent = val;
}
function valSpan(col, rank, val) {
  const span = document.createElement("span");
  span.className = "val";
  paint(span, col, val);
  if (canEdit && ED.has(col)) {
    span.classList.add("editable");
    span.title = "Click para editar";
    span.onclick = () => startEdit(span, col, rank);
  }
  return span;
}
function startEdit(span, col, rank) {
  const oldVal = span.dataset.val || "-";
  const cur = oldVal === "-" ? "" : oldVal;
  let input;
  if (col === "estado_manual") {
    input = document.createElement("select"); input.className = "cell";
    CFG.estadoOpts.forEach(o => { const op = document.createElement("option"); op.value = o; op.textContent = o; if (o === oldVal) op.selected = true; input.appendChild(op); });
  } else if (LONG.has(col)) {
    input = document.createElement("textarea"); input.className = "cell"; input.value = cur;
  } else {
    input = document.createElement("input"); input.className = "cell"; input.value = cur;
  }
  span.replaceWith(input); input.focus(); if (input.select) input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    let val = oldVal;
    if (save && input.value !== cur) { const saved = await saveCell(rank, col, input.value); val = (saved === null) ? oldVal : saved; }
    const back = valSpan(col, rank, val);
    input.replaceWith(back);
    if (save && col === "estado_manual") render();  // refresh row tint/bar from my status
  };
  if (col === "estado_manual") { input.onchange = () => finish(true); input.onblur = () => finish(false); }
  else {
    input.onblur = () => finish(true);
    input.onkeydown = (e) => { if (e.key === "Enter" && !LONG.has(col)) { e.preventDefault(); input.blur(); } if (e.key === "Escape") finish(false); };
  }
}

function renderHead() {
  const tr = document.getElementById("head"); tr.innerHTML = "";
  const HL = { estado: "estado · index", estado_manual: "mi estado" };
  CFG.mainCols.forEach(col => {
    const i = idx[col], th = document.createElement("th");
    if (canEdit && ED.has(col)) th.className = "ed";
    th.innerHTML = (HL[col] || col) + '<span class="arrow">' + (i === sortCol ? (sortAsc ? " ▲" : " ▼") : "") + "</span>";
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
  const ei = idx["estado"], mi = idx["estado_manual"], pi = idx["prioridad"];
  let view = rows.filter(r => {
    if (FILT.estado_manual.size && !FILT.estado_manual.has(r[mi])) return false;
    if (FILT.estado.size && !FILT.estado.has(r[ei])) return false;
    if (FILT.prioridad.size && !FILT.prioridad.has(r[pi])) return false;
    if (q && !r.join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  view.sort((a, b) => { const c = cmp(a[sortCol], b[sortCol]); return sortAsc ? c : -c; });

  const showEmpty = document.getElementById("empty").checked;
  const body = document.getElementById("body"); body.innerHTML = "";
  view.forEach((r, vi) => {
    const rank = r[idx["rank"]], z = (vi % 2 === 1) ? " zebra" : "";
    const eMan = r[idx["estado_manual"]];
    const est = (eMan && eMan !== "-") ? eMan : "";  // row color follows MY status only
    const bar = estBar(est), tint = estTint(est);
    const main = document.createElement("tr"); main.className = "main" + z; main.style.setProperty("--estbar", bar); main.style.setProperty("--esttint", tint);
    CFG.mainCols.forEach(col => {
      const td = document.createElement("td");
      td.className = (LONG.has(col) ? "long" : "short");
      td.appendChild(valSpan(col, rank, r[idx[col]]));
      main.appendChild(td);
    });
    const det = document.createElement("tr"); det.className = "detail" + z; det.style.setProperty("--estbar", bar); det.style.setProperty("--esttint", tint);
    const td = document.createElement("td"); td.colSpan = CFG.mainCols.length;
    const grid = document.createElement("div"); grid.className = "detail-grid";
    CFG.detailCols.forEach(col => {
      const v = r[idx[col]];
      const isEmpty = !v || v === "-";
      if (isEmpty && !showEmpty) return;  // hide empty detail fields for cleaner scan
      const f = document.createElement("div"); f.className = "field";
      const lab = document.createElement("span"); lab.className = "label"; lab.textContent = col;
      f.appendChild(lab); f.appendChild(valSpan(col, rank, v)); grid.appendChild(f);
    });
    td.appendChild(grid); det.appendChild(td);
    body.appendChild(main);
    if (grid.children.length) body.appendChild(det);  // skip empty detail rows
  });
  document.getElementById("count").textContent = view.length + " / " + rows.length + " specs";
  renderHead();
}
// multi-value filters: a Set per column, empty Set = no filter (OR within a group)
const FILT = { estado_manual: new Set(), estado: new Set(), prioridad: new Set() };
function buildChips(col, containerId, values, renderChip) {
  const cont = document.getElementById(containerId);
  values.forEach(v => {
    const ch = document.createElement("span");
    ch.className = "filt"; ch.innerHTML = renderChip(v);
    ch.onclick = () => { const s = FILT[col]; s.has(v) ? s.delete(v) : s.add(v); ch.classList.toggle("on"); render(); };
    cont.appendChild(ch);
  });
}
const STATUS_VALS = CFG.estadoOpts.filter(v => v !== "-");
buildChips("estado_manual", "fg_estado_manual", STATUS_VALS, badge);
buildChips("prioridad", "fg_prioridad", uniq(idx["prioridad"]), prioChip);
buildChips("estado", "fg_estado", STATUS_VALS, idxBadge);

document.getElementById("empty").checked = canEdit;  // show empties when editing, hide for clean read-only scan
document.getElementById("q").addEventListener("input", render);
document.getElementById("empty").addEventListener("change", render);
document.getElementById("reset").onclick = () => {
  document.getElementById("q").value = "";
  Object.values(FILT).forEach(s => s.clear());
  document.querySelectorAll(".filt.on").forEach(el => el.classList.remove("on"));
  document.getElementById("empty").checked = canEdit;
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
