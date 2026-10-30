---
title: "FASE 9 completa · los 133 caminos reejecutados"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — los 133 caminos reejecutados

`DEC-METH-004` cierra un hallazgo sólo cuando **su camino, reejecutado sobre el texto corregido, ya
no llega**, y un racimo sólo cuando **la regla corregida se verificó contra todo su dominio**. El
25/09 se escribieron los arreglos de los 14 racimos (consolidado
[`25-fase-8-completa/00-hallazgos.md`](../25-fase-8-completa/00-hallazgos.md) §5). Esta carpeta es
la verificación: nueve agentes Opus, uno por grupo de racimos, reejecutaron los 133 caminos y
declararon y recorrieron cada dominio. **Ninguno editó un capítulo**: las correcciones se proponen.

## 1. El resultado

| archivo | racimos | hallazgos | DEJA | SIGUE | OTRA | al owner |
|---|---|---|---|---|---|---|
| [`01`](./01-R1-R3-R8-grace-S6-y-cambio-de-plan.md) | R1, R3, R8 | 24 | 21 | 2 | 1 | 4 |
| [`02`](./02-R2-el-corte.md) | R2 | 10 | 2 | 7 | 1 | 6 |
| [`03`](./03-R4-R6-cortesia-promos-y-addons.md) | R4, R6 | 10 | 6 | 4 | 0 | 5 |
| [`04`](./04-R5-R7-correo-y-conciliacion.md) | R5, R7 | 15 | 13 | 1 | 1 | 2 |
| [`05`](./05-R9-F8CA2004-reloj-y-publicacion.md) | R9, `F-8CA2-004` | 9 | 9 | 0 | 0 | 2 |
| [`06`](./06-R10-R11-cobertura.md) | R10, R11 | 11 | 11 | 0 | 0 | 2 |
| [`07`](./07-R12-R14-trial-y-cupos.md) | R12, R14 | 13 | 10 | 0 | 3 | 3 |
| [`08`](./08-R13-F8CA1001-partner-y-vertical-de-la-ficha.md) | R13, `F-8CA1-001` | 6 | 5 | 0 | 1 | 3 |
| [`09`](./09-resto-y-registro.md) | resto y registro | 35 | 9 | 22 | 4 | 6 |
| | **total** | **133** | **86** | **36** | **11** | **33** |

*DEJA* = deja de llegar · *SIGUE* = sigue llegando · *OTRA* = llega a otra cosa.

## 2. Lo que esto corrige del consolidado

El §5 del consolidado dice *«ninguno quedó abierto»*. **Es falso para 47 hallazgos** (36 que siguen
llegando y 11 que llegan a otra cosa). Hay dos causas:

1. **Hallazgos que nadie tocó.** Una resolución por racimo cita algunos miembros y deja a los demás
   sin texto. Buscando el ID en todo el corpus (fuera de `25-` y `26-`), no aparecen, por ejemplo,
   `F-8CB1-015`, `F-8CB3-008`, `F-8CC2-005`, `F-8CB2-003`, `F-8CC1-004`, `F-8CA1-008`,
   `F-8CB3-004` ni `F-8CB2-009`. **Del resto que no entró en racimo, 26 de 35 no se trataron.**
2. **Arreglos que abren el caso vecino.** La regla corregida vale para la fila que nombraba el
   hallazgo y no para su gemela: `T6` al lado de `T2`/`T5`, el `paused` al lado del `cancelled`,
   «la principal más reciente» frente a una sucesión abandonada, `PB11` sin reiniciar el reloj.

## 3. Los conteos del registro

Recontados con script por `09`: **coinciden todos** con el handoff. Log 117 decisiones (117 IDs
únicos, 15 de metodología y 102 funcionales **por prefijo**), matriz 98 filas (55 · 14 · 23 · 6),
20 motivos de marca, 13 acciones administrativas, máquina de publicación con 6 estados y 12
transiciones, 1624 referencias `B/NN §x` y `V/NN §x` sin ninguna rota, y ningún ID de decisión
citado que no exista.

## 4. Lo que sigue

Los 33 puntos al owner se tratan uno por uno. Las contradicciones de texto y los residuos de borde
propuestos se aplican a los capítulos después de esas decisiones, porque varias dependen de ellas.
Los dominios de cada racimo están declarados en su archivo, en la sección de dominio.
