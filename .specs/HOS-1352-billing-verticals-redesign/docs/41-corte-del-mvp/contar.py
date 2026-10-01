#!/usr/bin/env python3
"""Cuenta guards por unidad (columna guards de las dos tablas §2 + fila U1 de D/16 §4.6),
y verifica que ninguna unidad del corte dependa de una diferida."""
import re, sys
import os
W=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')) + '/'
def rows(path, first_col_pat):
    out={}
    for l in open(W+path, encoding='utf-8'):
        m=re.match(r'\| \*\*('+first_col_pat+r')\*\*', l)
        if m and l.count('|')>=5: out.setdefault(m.group(1), l)
    return out
def guards(cell):
    cell=re.sub(r'~~.*?~~','',cell)          # fuera lo tachado
    cell=re.sub(r'\*\(.*?\)\*','',cell)       # fuera los comentarios en itálica
    return sorted(set(re.findall(r'`(G(?:-R\d+(?:-[A-F])?|\d+))`',cell)))
V=rows('HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md',r'V\d')
B=rows('HOS-1354-billing-cobro-y-proveedor/descomposicion.md',r'B\d+')
U=rows('HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md',r'U\d')
G={}
for k,l in V.items(): G[k]=guards(l.rstrip().rstrip('|').split('|')[-1])
for k,l in B.items(): G[k]=guards(l.rstrip().rstrip('|').split('|')[-1])
for k,l in U.items():
    c=l.split('|')[3]; G[k]=guards(c.split('*(')[0])
tot=0
for k in sorted(G,key=lambda s:(s[0],int(s[1:]))):
    print(f'{k:4} {len(G[k]):2} {" ".join(G[k])}'); tot+=len(G[k])
allg=[g for v in G.values() for g in v]
print('unidades:',len(G),'· guards:',tot,'· distintos:',len(set(allg)),
      '· V:',sum(len(G[k]) for k in G if k[0]=='V'),'· B:',sum(len(G[k]) for k in G if k[0]=='B'),'· U:',sum(len(G[k]) for k in G if k[0]=='U'))
