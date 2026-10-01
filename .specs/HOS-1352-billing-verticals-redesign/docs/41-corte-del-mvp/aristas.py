#!/usr/bin/env python3
"""(1) Cuenta las filas vivas de la tabla de dependencias entre épicas (B/descomposicion.md §2.6).
(2) Verifica dos asignaciones corte/posterior contra el grafo: ninguna unidad del corte puede
depender de una diferida."""
import re
import os
W=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')) + '/'
txt=open(W+'HOS-1354-billing-cobro-y-proveedor/descomposicion.md',encoding='utf-8').read().split('\n')
vivas=[l.split('|')[1].strip() for l in txt[353:370] if re.match(r'\| \d+ ',l)]
tach=[l.split('|')[1].strip() for l in txt[353:370] if re.match(r'\| ~~\d+~~ ',l)]
print('filas vivas §2.6:',len(vivas),vivas,'· tachadas:',tach)

# Grafo ORIGINAL, transcripto de V/descomposicion.md §3, B/descomposicion.md §3,
# D/16 §4.6 (U1-U3) y B/descomposicion.md §2.6 (cruzadas). (desde, hacia): 'hacia' depende de 'desde'.
INTRA=[('U1','V1'),('U1','B1'),('U1','U2'),('U1','U3'),('U2','V6'),('U2','V9'),('U2','B4'),('U2','B12'),
 ('V1','V2'),('V2','V3'),('V3','V4'),('V4','V5'),('V5','V6'),('V6','V8'),('V5','V7'),('V7','V8'),
 ('V4','V9'),('V6','V9'),
 ('B1','B3'),('B2','B3'),('B3','B4'),('B3','B5'),('B5','B4'),('B5','B7'),('B5','B11'),('B5','B6'),('B1','B6'),
 ('B7','B8'),('B8','B9'),('B9','B10'),('B10','B13'),('B13','B12')]
CROSS=[('V2','B2','1'),('V4','B4','2'),('V2','B7','3'),('V2','B8','4'),('V2','B8','5'),('V2','B12','6'),
 ('V2','B3','7'),('V6','B10','9'),('V2','B10','9'),('V4','B9','10'),('V6','B10','11'),('V9','B10','11'),
 ('V2','B9','12'),('B1','V4','14')]
print('filas cruzadas transcriptas:',len({c[2] for c in CROSS}),sorted({c[2] for c in CROSS},key=int))
def check(nombre,E,later):
    bad=[(a,b) for a,b in E if b not in later and a in later]
    print(f'\n== {nombre}: {len(E)} aristas chequeadas · violaciones: {len(bad)}')
    for a,b in bad: print(f'   ✗ {b} (corte) depende de {a} (diferida)')
    return E
E0=INTRA+[(a,b) for a,b,_ in CROSS]
units0={x for e in E0 for x in e}
print('unidades en el grafo original:',len(units0))
# A) lectura previa del handoff aplicada sin partir nada
check('A · lectura previa del handoff, sin partir',E0,{'B8','B10','V7','V9','B12'})
# B) propuesta: se parten V8, V9, B8, B9, B13 (sufijo a = corte, b = posterior)
SPLIT={'V8':('V8a','V8b'),'V9':('V9a','V9b'),'B8':('B8a','B8b'),'B9':('B9a','B9b'),'B13':('B13a','B13b')}
E1=[]
for a,b in E0:
    if (a,b) in [('B8','B9')]:  # la arista real es la sucesión (S9, R17): la lleva B9b, no B9a
        E1+=[('B8b','B9b'),('B8a','B9a')]; continue
    if (a,b)==('B10','B13'): E1+=[('B10','B13b')]; continue          # sólo lo de addons
    if (a,b)==('V7','V8'): E1+=[('V7','V8b')]; continue              # sólo lo de Partner
    if (a,b)==('B9','B10'): E1+=[('B9b','B10')]; continue
    if (a,b)==('B13','B12'): E1+=[('B13b','B12')]; continue
    if (a,b) in [('V2','B8')]: E1+=[('V2','B8b')]; continue          # filas 4 y 5: pausa y dirección
    if (a,b)==('V4','B9'): E1+=[('V4','B9b')]; continue              # fila 10: extenderTrial, canje de promo
    if (a,b)==('V2','B9'): E1+=[('V2','B9a')]; continue              # fila 12: piso del grant
    if (a,b)==('V9','B10'): E1+=[('V9b','B10')]; continue            # empuje de PB9
    a2=SPLIT.get(a,(a,a)); b2=SPLIT.get(b,(b,b))
    E1+=[(a2[0],b2[0])] if a in SPLIT or b in SPLIT else [(a,b)]
    if b in SPLIT: E1+=[(a2[1] if a in SPLIT else a,b2[1])]
for k,(x,y) in SPLIT.items(): E1+=[(x,y)]                            # la parte b espera a la a
E1+=[('B4','B9a'),('B8a','B13a'),('B7','B13a'),('B5','B13a'),('V6','V9a')]  # nuevas, explícitas
E1=sorted(set(E1))
later={'V7','V8b','V9b','B8b','B9b','B10','B12','B13b'}
check('B · propuesta (5 partidas)',E1,later)
units1={x for e in E1 for x in e}
print('unidades (con partidas):',len(units1),'· corte:',len(units1-later),'· posteriores:',len(later))
for a,b in E1: print(f'   {a:5}→ {b:5} {"posterior" if b in later else "CORTE":9} desde {"posterior" if a in later else "CORTE"}')
