#!/usr/bin/env python3
"""Shared helpers for the consolidated-spec tooling of HOS-1352 (DEC-METH-019).

Every source is read from the FROZEN commit (``SHA``) through ``git show``, never from the
working tree, so an inventory is reproducible no matter what happens to the files later.
Paths are always relative to the repository root.
"""
import functools
import hashlib
import os
import re
import subprocess
import sys

# The commit the whole consolidation is anchored to (owner method, DEC-METH-019 point 1). Re-frozen
# after the owner's BY-CB and the 19 residues of the second triage round were applied to the sources
# (it was 0dbe4482764a…, then f46a76c394…, then dab68c3ded…, then fed4c735ba…, then f80c0f2715…,
# then 4278aa1adc…, then 17f9702675…, then c7a3fac900…, then e291df0b5b… after the owner's CC and CD
# and the residues of the first blind-verification round, then 254684691f… after the owner's CE,
# then b949031c70… once the CE row named the options it discarded, then 69cbe79360… after CF and CG;
# then 591034c665… after CH and CI; re-frozen again after CJ, the source residues of the third
# blind-verification round and the residue of letter Q; then 9149b84a25…; now after the
# fourth round source corrections, including the counter-review adjustments; now CK from round five).
SHA = '3c3e88b9b59cb7d766bc34848b8ffd657eb95770'

# Repository root: scripts/ -> spec-consolidada/ -> HOS-1352.../ -> .specs/ -> repo.
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))

S = '.specs/'
D = S + 'HOS-1352-billing-verticals-redesign/docs/'
V = S + 'HOS-1353-verticales-capacidades-y-autorizacion/'
B = S + 'HOS-1354-billing-cobro-y-proveedor/'
SPEC = S + 'HOS-1352-billing-verticals-redesign/spec-consolidada/'

PIEZA_RX = r'[UVB]\d+[ab]?'

# The 38 files the live design is spread over (DEC-METH-019, "Problema"): both epics entire,
# the nucleus, the partition, the contract and the umbrella phase-7 document.
def corpus_38():
    files = [f for f in ls(V) + ls(B) if f.endswith('.md')]
    files += [f for f in ls(D + 'nucleo/') if f.endswith('.md')]
    files += [D + '11-particion-del-programa.md', D + '12-contrato-de-cobertura.md',
              D + '16-fase-7-del-paraguas.md']
    return sorted(files)


@functools.lru_cache(maxsize=None)
def ls(prefix):
    """Files tracked at SHA under ``prefix`` (recursive)."""
    out = subprocess.run(['git', '-C', ROOT, 'ls-tree', '-r', '--name-only', SHA, prefix],
                         check=True, capture_output=True, text=True).stdout
    return tuple(l for l in out.split('\n') if l)


@functools.lru_cache(maxsize=None)
def lines(path):
    """The file at SHA, split into lines (index 0 is line 1)."""
    r = subprocess.run(['git', '-C', ROOT, 'show', f'{SHA}:{path}'], capture_output=True)
    if r.returncode != 0:
        sys.exit(f'✗ {path} does not exist at {SHA[:10]}')
    return tuple(r.stdout.decode('utf-8').split('\n'))


def line_hash(path, n):
    """sha256 of line ``n`` (1-based) of ``path`` at SHA, without the newline."""
    return hashlib.sha256(lines(path)[n - 1].encode('utf-8')).hexdigest()


def worktree_line_hash(path, n):
    """sha256 of the same line in the working tree, or None if the file/line is gone."""
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        return None
    L = open(p, encoding='utf-8').read().split('\n')
    return hashlib.sha256(L[n - 1].encode('utf-8')).hexdigest() if n <= len(L) else None


def section(path, head_rx):
    """(first, last) 1-based lines of the section whose heading matches ``head_rx``, up to the
    next heading of the same or higher level. Located by heading, never by line number."""
    L = lines(path)
    for i, l in enumerate(L):
        m = re.match(r'^(#+)\s', l)
        if m and re.search(head_rx, l):
            lvl = len(m.group(1))
            for j in range(i + 1, len(L)):
                m2 = re.match(r'^(#+)\s', L[j])
                if m2 and len(m2.group(1)) <= lvl:
                    return i + 1, j
            return i + 1, len(L)
    sys.exit(f'✗ section /{head_rx}/ not found in {path}')


def cells(line):
    return line.strip().strip('|').split('|')


def table_after(path, rng, header_rx):
    """Rows of the first table inside ``rng`` whose header matches: [(line_no, cells)]."""
    L = lines(path)
    a, b = rng
    for n in range(a, b + 1):
        if L[n - 1].startswith('|') and re.search(header_rx, L[n - 1]):
            rows = []
            for k in range(n + 2, len(L) + 1):
                if not L[k - 1].startswith('|'):
                    break
                rows.append((k, cells(L[k - 1])))
            return rows
    sys.exit(f'✗ table /{header_rx}/ not found in {path}:{a}-{b}')


def _solo_parentesis(t):
    """True when ``t`` is exactly one balanced parenthesis, «(…)», from its first char to its last."""
    if not t.startswith('(') or not t.endswith(')'):
        return False
    depth = 0
    for k, ch in enumerate(t):
        depth += {'(': 1, ')': -1}.get(ch, 0)
        if depth == 0 and k < len(t) - 1:
            return False
    return depth == 0


def struck_cell(c):
    """A cell is struck when nothing it says survives outside ~~…~~: what is left is markup, ✚, or —
    for a cell that opens struck — one trailing parenthesis that dates the strike («~~x~~ (owner …,
    C8)»). A cell that only STARTS struck and goes on with the live text that replaces it
    («~~monto vigente~~ **monto esperado, derivado**») is alive (second blind-verification round,
    pattern P-K, H2-VA8-3: three live rows of B11 and B13a were dropped that way)."""
    if '~~' not in c:
        return False
    resto = re.sub(r'[\s✚*`]', '', re.sub(r'~~.*?~~', '', c, flags=re.S))
    if not resto:
        return True
    return bool(re.match(r'^\s*(?:\*\*)?~~', c)) and _solo_parentesis(resto)


def dead_row(cs):
    """A row is dead when its id cell is struck ENTIRE (struck_cell, not merely starting with ~~),
    when ALL its non-empty content is struck, or when its second cell says **Sale**."""
    if struck_cell(cs[0]):
        return True
    body = [c for c in cs[1:] if c.strip() and c.strip() not in ('—', '-')]
    if body and all(struck_cell(c) for c in body):
        return True
    return bool(len(cs) > 1 and re.search(r'\*\*Sale\*\*', cs[1]))


def row_state(cs):
    """VIVO, MUERTO, or MIXTO (some cell starts struck but the row is not dead)."""
    if dead_row(cs):
        return 'MUERTO'
    return 'MIXTO' if any(re.match(r'^\s*(?:\*\*)?~~', c) for c in cs[1:]) else 'VIVO'


def unstrike(text):
    """Drop struck spans (~~...~~) and italic asides *(...)*."""
    text = re.sub(r'~~.*?~~', '', text)
    return re.sub(r'\*\([^*]*?\)\*', '', text)


def slug(cid):
    """Anchor slug of a canonical id: lowercase, 📌 -> p, runs of other chars -> '-'."""
    return re.sub(r'[^a-z0-9]+', '-', cid.lower().replace('📌', 'p')).strip('-')


def git_head():
    return subprocess.run(['git', '-C', ROOT, 'rev-parse', 'HEAD'], check=True,
                          capture_output=True, text=True).stdout.strip()
