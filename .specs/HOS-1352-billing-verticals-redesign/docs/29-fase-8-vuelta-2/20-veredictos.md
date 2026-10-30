---
title: "FASE 9 vuelta 2 · los 56 caminos reejecutados"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2: los 56 caminos reejecutados

`DEC-METH-004` cierra un hallazgo sólo cuando su camino, reejecutado sobre el texto corregido, deja
de llegar, y un racimo sólo cuando la regla corregida se verificó contra todo su dominio. Los
arreglos se aplicaron el 2026-09-27 (registros `11-` a `18-`, con las decisiones de
[`10-`](./10-decisiones-del-owner.md)). La vuelta 1 cerró con este paso
([`28-…/20-veredictos.md`](../28-fase-9-vuelta-1/20-veredictos.md)) y la vuelta 2 no lo tenía: el
owner pidió hacerlo antes de decidir con qué seguir (2026-09-27, noche). Tres agentes Opus, uno por
par de grupos, reejecutaron los 56 caminos (`21-` a `23-`) sobre HEAD `d421d1ddf1`. Ninguno editó
un capítulo. No es una FASE 8: no es ciega ni arranca de cero, y no hay vuelta 3 (`DEC-METH-013`).

## 1. El resultado

| informe | grupos | hallazgos | DEJA | SIGUE | DECLARADO | OTRA | casos vecinos nuevos |
|---|---|---|---|---|---|---|---|
| [`21`](./21-verificado-A-B.md) | A y B · máquinas de billing y el corte | 23 | 22 | 1 | 0 | 0 | 3 (2 MEDIA, 1 BAJA) |
| [`22`](./22-verificado-C-D.md) | C y D · la costura y verticales | 25 | 25 | 0 | 0 | 0 | 3 (1 MEDIA, 2 BAJA) |
| [`23`](./23-verificado-E-F-y-lo-nuevo.md) | E y F, y el mecanismo nuevo de `16-`…`18-` | 8 | 8 | 0 | 0 | 0 | 7 (3 MEDIA, 4 BAJA) |
| | **total** | **56** | **55** | **1** | **0** | **0** | **13** |

Contado con script sobre las tablas de veredictos de los tres informes: los 56 IDs aparecen una
vez cada uno, sin faltantes.

**El crítico (`F-8V2B1-001`, R1) deja de llegar con su dominio entero cubierto**: la baja desde
cada estado, los catorce disparadores de orfandad recontados sobre la tabla de transiciones (no
sobre la lista), `S36`, `S32`/`S33`, el espejo y `S7` por `R18-b`, y el orden `S21` antes que
`S12` de `R1-c`. Su gemelo `F-8V2D1-001` también deja.

**Ningún caso vecino es CRITICA**, ni nuevo ni heredado. Tendencia de casos vecinos al cierre de
cada vuelta: 23 (vuelta 1) contra 13 nuevos (vuelta 2).

## 2. El que sigue llegando

`F-8V2B3-002` (R2, ALTA, plata). La regla de `R2` decide si un cobro sobre la lápida del corte es
posterior al corte mirando el `date_created` del registro de cobro, pero ese registro es uno por
ciclo y su fecha no se mueve con los reintentos. Juan: el viejo le rechaza la renovación el 25/11,
el corte es el 05/12, cambia la tarjeta el 12/12 y el reintento cobra. El cobro se asienta sin marca
y sin devolución, porque el registro es del 25/11. Detalle en `21-` §2.2.

## 3. Los casos vecinos

**Nuevos (13)**, `N-A-*`, `N-B-*` y `N-C-*`, con su severidad en cada informe. Los MEDIA son:

- `N-A-01` y `N-A-03` (plata): `S26` no dice qué hace con un addon `USER`/`GLOBAL`, y uno
  compatible con dos verticales puede seguir cobrando sin título.
- `N-B-01`: `T8` puede evaluar antes de que `PB3` suba la ficha, y el trial queda regalado.
- `N-C-02` (plata de Hospeda): el motivo 24 se reabre sobre un pago ya resuelto y, con el default
  «devolver», puede llevar a una doble devolución.
- `N-C-04` y `N-C-05`: la acción 16 escribe en verticales fuera del contrato, y su reintento no
  tiene actor.

**Heredados de `11-`…`18-`**: cada informe los rechequeó contra el texto de hoy. Una parte ya la
había cerrado un registro posterior; los que siguen abiertos, con su severidad y su clase (pide
decisión o es arreglo de texto), están en el § de casos vecinos de cada informe. Los MEDIA
abiertos: `S22` durante el crédito, `S36` con un pago retenido por `S19` (dos propuestas de
devolución sobre el mismo pago), la selección de `S32` en la baja sin confirmar, `PB10` contra `PB3`
y `PB9`, el cobro por debajo del esperado que nadie marca y acortar la cola sin fila en el catálogo.

## 4. Lo que le toca al owner

Diez preguntas distintas una vez unidas las repetidas (la selección de `S32` y la clase del correo
de la alerta de precio aparecen en dos informes). Cada una tiene opciones, recomendación y ejemplo
con Juan en su informe:

| # | pregunta | informe | plata |
|---|---|---|---|
| 1 | qué fecha decide que un cobro sobre la lápida es posterior al corte (el SIGUE) | `21-` P1 | sí |
| 2 | `S22` sobre una sucesora que vive del crédito | `21-` P2 | sí |
| 3 | confirmar la selección de `S32` en la baja con `CANCEL_SCHEDULED` en la exclusión | `21-` P3, `23-` P5 | sí |
| 4 | que `S26` aplique la selección de `S32` y esos complementos abran el motivo 15 | `21-` P4 | sí |
| 5 | un disparador de `S32` para el `USER`/`GLOBAL` que queda sin título | `21-` P5 | sí |
| 6 | el cobro por debajo del esperado | `23-` P1 | sí |
| 7 | acortar la cola: dentro de la fila 16 o fila propia | `23-` P2 | no |
| 8 | la acción 16 y el contrato: capa de composición o segunda escritura | `23-` P3 | no |
| 9 | el actor del reintento de la acción 16 | `23-` P4 | no |
| 10 | Outlook en la lista del seudónimo, el guard de la lista de `PURGED` y la clase del correo de la alerta de precio | `22-` P1 a P3, `23-` P5 | no |

Los arreglos de texto sin decisión (`N-B-01`…`03`, `N-C-01`, `N-C-02`, `N-C-03`, `N-C-06`,
`N-C-07`, las notas de texto vencido de `22-`) se aplican en la misma tanda que las respuestas.

## 5. Estado de la vuelta

La FASE 9 vuelta 2 queda **verificada**: 55 de 56 dejan de llegar, el crítico con su dominio
cubierto, y ningún CRITICA abierto. Para cerrarla según `DEC-METH-008` punto 1 falta aplicar las
respuestas del owner al § 4 y los arreglos de texto; lo que el owner elija no arreglar se declara con
causa en el «NO cierra» del capítulo.
