#!/usr/bin/env python3
"""Verify the literal citations of the FASE 8 vuelta 1 reports.

Each citation unit (a bullet with its continuation lines, or a table row) that
holds exactly one backticked `path:line` and one quote (« » or straight) is
checked. A citation passes when the quote appears
literally within +-5 lines of the cited line; it is DESPLAZADA when it appears
elsewhere in the file, and FALLA when it does not appear at all.

Usage (from this folder): python3 verificar-citas.py [REPORT.md ...]
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SPECS = HERE.parents[2]
ROOTS = {
    "$D": SPECS / "HOS-1352-billing-verticals-redesign" / "docs",
    "$V": SPECS / "HOS-1353-verticales-capacidades-y-autorizacion",
    "$B": SPECS / "HOS-1354-billing-cobro-y-proveedor",
}
REF = re.compile(
    r"`([^`\s]+\.(?:md|py|mjs)|[BVDN]/\d\d|nucleo/\d\d):(\d+)(?:[-–]\d+)?`")
QUOTE = re.compile(r"«(.+?)»")
WS = re.compile(r"\s+")


def norm(text: str) -> str:
    """Collapse whitespace so quotes that span wrapped source lines match."""
    return WS.sub(" ", text.replace("*", "")).strip()


def resolve(raw: str) -> pathlib.Path | None:
    short = re.fullmatch(r"([BVDN]|nucleo)/(\d\d)", raw)
    if short:
        base = {"B": ROOTS["$B"] / "docs", "V": ROOTS["$V"] / "docs", "D": ROOTS["$D"],
                "N": ROOTS["$D"] / "nucleo", "nucleo": ROOTS["$D"] / "nucleo"}[short.group(1)]
        hits = sorted(base.glob(short.group(2) + "-*.md"))
        return hits[0] if len(hits) == 1 else None
    for key, root in ROOTS.items():
        for pre in (key + "/", key[1:] + "/"):
            if raw.startswith(pre):
                rest = raw[len(pre):]
                for cand in (root / rest, root / "docs" / rest):
                    if cand.exists():
                        return cand
                return root / rest
    if raw.startswith("N/"):
        return ROOTS["$D"] / "nucleo" / raw[2:]
    raw = raw.removeprefix("./").removeprefix(".specs/")
    for cand in (SPECS / raw, ROOTS["$D"] / raw, SPECS.parent / raw):
        if cand.exists():
            return cand
    return None


def items(lines: list[str]) -> list[tuple[int, str]]:
    """Group a report into citation units: a bullet with its continuation
    lines, or a single table row. Returns (first line number, text)."""
    out: list[tuple[int, str]] = []
    cur: list[str] = []
    first = 0
    for i, line in enumerate(lines):
        s = line.strip()
        starts = s.startswith(("- ", "* ", "|")) or re.match(r"\d+\. ", s)
        if not cur and s and not starts and not s.startswith("#"):
            cur, first = [s], i + 1
            continue
        if starts or not s or s.startswith("#"):
            if cur:
                out.append((first, " ".join(cur)))
            cur, first = ([s], i + 1) if starts else ([], 0)
            if s.startswith("|"):
                out.append((first, s))
                cur = []
        elif cur:
            cur.append(s)
    if cur:
        out.append((first, " ".join(cur)))
    return out


def quote_of(text: str) -> str | None:
    """The cited text: outermost « » (quotes may nest), else straight quotes."""
    a, b = text.find("«"), text.rfind("»")
    if a != -1 and b > a:
        return text[a + 1:b]
    m = re.search(r'"(.+)"', text)
    return m.group(1) if m else None


def check(report: pathlib.Path) -> tuple[int, int, list[str]]:
    ok = moved = 0
    bad: list[str] = []
    for ln, text in items(report.read_text().splitlines()):
        refs = list(REF.finditer(text))
        if len(refs) != 1:
            continue
        raw = quote_of(REF.sub("", text))
        if not raw:
            continue
        m = refs[0]
        quote = norm(raw.strip().strip("*").strip())
        path = resolve(m.group(1))
        if path is None or not path.exists():
            bad.append(f"{report.name}:{ln} RUTA {m.group(1)}")
            continue
        src = path.read_text().splitlines()
        n = int(m.group(2))
        near = norm(" ".join(src[max(0, n - 6):n + 5]))
        if quote in near:
            ok += 1
        elif quote in norm(path.read_text()):
            moved += 1
            bad.append(f"{report.name}:{ln} DESPLAZADA {m.group(1)}:{n}")
        else:
            bad.append(f"{report.name}:{ln} FALLA {m.group(1)}:{n} «{quote[:70]}»")
    return ok, moved, bad


def main() -> int:
    reports = [pathlib.Path(a) for a in sys.argv[1:]] or sorted(
        p for p in HERE.glob("[A-D][0-9]-*.md"))
    fails = 0
    for r in reports:
        ok, moved, bad = check(r)
        falla = sum("FALLA" in b or "RUTA" in b for b in bad)
        fails += falla
        print(f"{r.name}: {ok} ok · {moved} desplazadas · {falla} fallas")
        for b in bad:
            print("   ", b)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
