---
title: "FASE 9 vuelta 1 · los 100 caminos reejecutados"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — los 100 caminos reejecutados

`DEC-METH-004` cierra un hallazgo sólo cuando su camino, reejecutado sobre el texto corregido, deja
de llegar, y un racimo sólo cuando la regla corregida se verificó contra todo su dominio. Los
arreglos se aplicaron el 2026-09-26 (registros `11-` a `18-`, con las decisiones de
[`10-`](./10-decisiones-del-owner.md)). Cinco agentes Opus, uno por grupo, reejecutaron los 100
caminos (`21-` a `25-`). Ninguno editó un capítulo.

## 1. El resultado

| informe | grupo | hallazgos | DEJA | SIGUE | DECLARADO | OTRA | casos vecinos nuevos |
|---|---|---|---|---|---|---|---|
| [`21`](./21-verificado-G1.md) | G1 · el corte (R1, R6, R7) | 27 | 24 | 0 | 3 | 0 | 3 (1 MEDIA, 2 BAJA) |
| [`22`](./22-verificado-G2.md) | G2 · PURGED y addons (R2, R3, R9) | 17 | 13 | 1 | 3 | 0 | 3 (1 ALTA, 1 MEDIA, 1 BAJA) |
| [`23`](./23-verificado-G3.md) | G3 · motivos (R4, R12) | 18 | 13 | 1 | 4 | 0 | 5 (2 ALTA, 1 MEDIA, 2 BAJA) |
| [`24`](./24-verificado-G4.md) | G4 · frontera y ventas (R5, R8, R10) | 18 | 18 | 0 | 0 | 0 | 9 (2 ALTA, 6 MEDIA, 1 BAJA) |
| [`25`](./25-verificado-G5-y-registro.md) | G5 · resto y registro (R11) | 20 | 18 | 1 | 1 | 0 | 4 (1 ALTA, 3 MEDIA) |
| | **total** | **100** | **86** | **3** | **11** | **0** | **24** |

*DECLARADO* = residuo con causa escrita en el «NO cierra» del capítulo, por decisión del owner o
por `DEC-METH-015`.

**`N-G2V-01` y `N-G4V-05` son el mismo hallazgo**, encontrado por dos verificadores sin verse: el
empuje de «la ficha llegó a `PURGED`» (contrato §3.1) no sale después del commit, y como `A6`
relee `fichaPurgada` antes de cancelar, un empuje previo al commit lee `no` y no hace nada —anula
`G2-1` en todos los casos, no sólo cuando el empuje se pierde—. Contado una vez, los casos vecinos
son **23**, y los **ALTA únicos son cinco**: `N-G2V-01`/`N-G4V-05`, `N-G3V-01`, `N-G3V-02`,
`N-G4V-01` y `N-1` (G5). **Ninguno es CRITICA.**

## 2. Los racimos

| racimo | dominio cubierto | qué queda afuera |
|---|---|---|
| **R1** (el crítico) | **sí** | — |
| R2 | sí | salvedades de texto (§4 de `22-`) |
| R3 | no | el aviso de `PB5` no nombra los destaques |
| R4 | no | el lado del barrido: casos 1, 4, 5, 8, 9 y 17 (`N-G3V-01`, `N-G3V-02`) |
| R5 | no | `Preference` sin vencimiento, la sonda del paso 3, reabrir ventas tras un aborto |
| R6 | sí | — |
| R7 | sí | — |
| R8 | no | estado de la ficha para `A1`, `vendible` en `S1`, orden del empuje, invalidación de addons |
| R9 | sí | — |
| R10 | sí | — |
| R11 | sí | — |
| R12 | sí | — |

## 3. Los que siguen llegando

- `F-8V1A2-005`: el panel lee «`APROBADA` sin vínculo», pero `V/02` no declara dónde vive el
  vínculo.
- `F-8V1B2-005`: dos frases gemelas de la corregida (`B/03` ~1480 y `B/05` ~361) siguen diciendo
  que la marca impide la sucesión.
- `F-8V1D1-002`: la lectura ancha se sigue llamando «cobrada» en el criterio de `B10`, `B/spec` y
  `V/15`.

## 4. Lo que esto dice del corte

El crítico declarado de la vuelta (R1) **deja de llegar y su dominio queda cubierto**. La tanda de
arreglos de hoy **no generó ningún CRITICA** según la verificación, pero sí cinco ALTA de caso
vecino —la misma clase que en la vuelta anterior dejó 47 de 133 abiertos—. La verificación no es
la revisión adversarial: el criterio de corte de `DEC-METH-013` se mide con la FASE 8 vuelta 2,
ciega, y atribuyendo contra los diffs.

## 5. Recuento del registro (`25-` §3)

Coinciden con script: 126 decisiones (15 METH), matriz 98 filas (56 · 15 · 23 · 4), 22 motivos, 15
acciones, 10 máquinas, 6 hechos del reloj, `S1`–`S36`, `T1`–`T8`, publicación 6 estados y 12
transiciones, firma de 7 campos, 31 guards (18 · 13), 10 salidas de la predecesora con `S18` en 8.
Los textos que afirman otra cifra están listados como BAJA en `25-` §4.
