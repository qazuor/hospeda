---
title: "FASE 9 vuelta 1 · G3 aplicado — el desempate de motivos y la conciliación"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G3 aplicado

Registro de la aplicación de `03-G3-motivos-y-conciliacion.md` y de las decisiones `G3-1` (**2**,
contra la recomendación) y `G3-2` (**1**) de `10-decisiones-del-owner.md`. Abreviaturas: `B/NN` es
`.specs/HOS-1354-billing-cobro-y-proveedor/docs/NN-*.md`; `D/16` es
`.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`. Las líneas son las del
worktree al cierre de esta pasada; otros grupos editan los mismos archivos y pueden correrlas.

## 1. Qué se aplicó

| ítem (§5 del documento) o decisión | archivo:línea | estado |
|---|---|---|
| 1 · `B/05` §3, condición 1: «cualquier otro estado» y remite al desempate | `B/05:268` | hecho, con el texto de la opción 2 de `G3-1` (la lápida del corte tampoco corre el §) |
| 2 · `B/05` §3, desempate por criterio, lista de lo que no se desempata, los dos productores | `B/05:307-331` | hecho; la lápida del corte **no** está en la primera fila (va a un párrafo propio, «lo que no desempata por decisión»), y la lápida de recepción entra en la tercera |
| 3 · `B/05` §2 `C2`, primera fila: extensión con `max` | `B/05:113` | hecho |
| 4 · `B/03` `S11`: `max(vigente, fórmula)`; `S26`: remite al `max` | `B/03:157`, `B/03:172` | hecho |
| 5 · `B/02` §2.5, «quién abre» de 2, 3, 7 y 19 | `B/02:939`, `:940`, `:944`, `:956` | hecho; en el 7 además se corrigió «menos la condición 1 sobre una `CANCELLED`» (quedaba chica frente a la primera fila nueva) y en el 19 se agregó que sobre la lápida del corte no compara |
| 6 · `B/09` §3, cobros del período | `B/09:132` | hecho con el texto de la opción 2: la lápida del corte sale de la comparación, sin corte temporal |
| 7 · `B/21` §2.5: fin de servicio de la lápida como corte temporal | `B/21:225` | **reescrito por `G3-1`** (lo condicionaba el propio documento): no se escribe fecha de fin de servicio en la lápida —choca con el «y nada más» de R6— porque con la opción 2 ya no hace falta; en su lugar va el párrafo del cobro en vuelo que se asienta sin marca. El ⚠️ de `EX-16` pierde sujeto |
| 8 · `B/02` §2.2 `provider_link`: suscripción, `UNIQUE(subscription_id)`, valor del `external_reference` | `B/02:51` | hecho |
| 9 · `B/09` §2.4: `external_reference` = `id` de la fila; desconocido con cobro → 7 | `B/09:75-86` | hecho, junto con la lápida de recepción de `G3-2` |
| 10 · `B/09` §7: reuso sólo del que nombra la fila, duplicados, búsqueda vacía, idempotencia | `B/09:820`, `B/09:835` | hecho; puntero corto también en `B/05:71` (§1.2, que el resumen del documento nombraba para `F-8V1B2-008`) |
| 11 · `B/09` «NO cierra»: `pending` duplicado posterior a `S2` | `B/09:964` | hecho |
| 12 · `B/03` `S14` y `S15`: colgar sube la versión; `S15` escribe contra ella | `B/03:160`, `B/03:161` | hecho |
| 13 · `B/03` §10.1 salvedad de `S6` por reloj agotado; «NO cierra» del segundo/tercer evento | `B/03:2706`, `B/03:2930` | hecho |
| 14 · `B/05` §3 excepción de la predecesora; `B/02` la marca bloquea la escritura de `sucede_a` | `B/05:351-355`, `B/02:255-261` | hecho |
| 15 · `B/03` `S31`: misma transacción que `S6`/`S12` | `B/03:177` | hecho |
| 16 · `D/16` §4.2 paso 2 y §4.3 | `D/16:125`, `D/16:285` | hecho; el bullet de §4.3 va como párrafo porque el § no tiene lista |
| 17 · `B/03` `S6` sobre `ACTIVE`: `P1`, no `S5` | `B/03:152` | hecho |
| 18 · `B/02` §2.5: `S33` en el 8, re-vinculación sin cobro en el 6 | `B/02:945`, `B/02:943` | hecho |
| 19 · `B/03` §4: el espejo entre las salidas del grace | `B/03:1567` | hecho; se nombran sólo las dos salvedades de `S6` que alcanzan al grace (la de `S16` es sobre `ACTIVE`) |
| 20 · `B/09` §3, dos frases sobre `EX-15` | `B/09:189`, `B/09:283` | hecho |
| `G3-1` (opción 2) | `B/05:318-324`, `B/09:132`, `B/02:956`, `B/21:225-238`, `B/21:377-393` | hecho |
| `G3-2` (opción 1) | `B/09:75-86`, `B/02:63-76`, `B/05:309`, `B/02:944`, `B/21:176-182`, `B/21:213-215`, `D/16:285` | hecho; la forma de fila y la columna `origen_de_lápida` son de G1 (R6) y se citan, no se redefinen |
| coherencia `B/21` §2.5, recuadro de la re-vinculación | `B/21:172-189` | hecho: el valor del `external_reference`, el motivo 7 con cobro y la lápida de recepción, para que la frase «con las mismas palabras» que el cap. 09 §2.4 siga siendo cierta |

**markdownlint** sobre los seis archivos tocados: exit 0, «0 issues». El único error que dio mi
pasada (MD028 en `B/02`, dos blockquotes pegados) se arregló pasando la nota de la lápida de
recepción a párrafo.

**Cifras cerradas**: ningún ítem mueve los 22 motivos (7 SÍ, 3 puede, 12 no), ni los doce que abre
`S14`, ni S1–S35. Las acciones administrativas las mueve `G5-2` a 15; este registro no escribió
esa cifra en ningún capítulo.

## 2. Lo que la opción elegida contra la recomendación dejó declarado (`G3-1`)

La opción 2 hace que el cobro del preapproval viejo que el proveedor procesa después del paso 1b
**se asiente sobre la lápida del corte sin marca**, y que esa lápida quede **fuera del desempate**
(`B/05` §3) **y de la comparación de cobros** (`B/09` §3). Declarado en `B/21` «NO cierra» con
causa y «owner 2026-09-26, `G3-1`»:

1. El cliente pagó un mes que no usa, lo ve en su resumen y puede desconocerlo ante el banco; del
   lado de Hospeda sólo queda el `payment` asentado sobre la lápida.
2. Ninguna herramienta se lo pone delante a nadie: sin marca no hay listado.
3. Si el evento de ese cobro se pierde, tampoco queda el `payment`, porque el barrido no compara
   cobros sobre la lápida del corte.

Detector declarado: una consulta de lápidas del corte con `payment`, y la re-verificación del
`B/21` §1.3 con la que el owner llama. Lo que **no** cubre la decisión: la cancelación del 1b que no
se aplicó, que la sigue detectando la salvedad 4 del `B/09` §3 (relectura por estado, marca a los
3 días). Y **no alcanza a la lápida de recepción**, cuyo cobro va a `PAGO_TARDÍO_RECHAZADO` con
**SÍ**.

Consecuencia de derivación: el ítem 7 del documento (fin de servicio de la lápida como corte
temporal, y su ⚠️ sobre `EX-16`) **perdió sujeto** y no se escribió. Además chocaba con R6, que da
a la lápida «`clase`, `origen_de_lápida`, `estado`, `provider_link` y nada más».

## 3. Propuestas para el log y la matriz

Ninguna. `G3-1` y `G3-2` ya están en `10-decisiones-del-owner.md`; si el orquestador las pasa al
decision log, lo hace desde ahí.

## 4. Residuos y choques con otros grupos

- **G1 (R6) y la lápida de recepción**: G1 escribió `origen_de_lápida` (`CORTE` / `RECEPCIÓN`) en
  `B/02` §2.2 y en `B/21` §2.5 mientras yo aplicaba, y además completó mi nota de `B/02` con esa
  columna. Se retiró mi frase provisoria «se coordina ahí» y se cita la columna en `B/05` §3 y en
  `B/02`. Sin choque abierto.
- **`B/21` §2.5, «la lápida es la única fila `CANCELLED` que ninguna transición produce»**: con
  `G3-2` son dos formas de esa fila. Se agregó la salvedad al lado, sin tachar, porque el criterio
  que el párrafo defiende sigue igual.
- **`B/02` §2.5 motivo 19** nombra «la decimocuarta» acción administrativa. Con `G5-2` las acciones
  pasan a 15, y si la nueva entra antes en la lista, el ordinal se mueve. Es de G5; no lo toqué.
- **`B/03` `S19`** figuraba en el resumen del documento para `F-8V1B2-005`, pero la lista de
  aplicación no le daba texto: la regla nueva vive en `B/05` §3 y `B/02` §2.2, y `S19` no la
  contradice. No se tocó.
- **La tercera fila del desempate** ahora incluye «todo cobro sobre una lápida de recepción»,
  aunque su marca se haya levantado: eso depende de `origen_de_lápida`, y si R6 cambiara esa
  columna habría que revisar esta frase.

## Key Learnings

1. Una opción elegida contra la recomendación puede vaciar ítems de aplicación que el documento no
   marcaba como condicionados: el corte temporal de la lápida sólo servía para comparar cobros, y
   con la opción 2 no hay comparación.
2. Cuando dos grupos escriben la misma fila en paralelo, la coordinación sale sola si cada uno cita
   al otro por el nombre del dato (`origen_de_lápida`) y no por la prosa: G1 completó mi nota con su
   columna sin pisar nada.
3. Dos blockquotes separados por una línea en blanco rompen MD028; una nota nueva al lado de un
   blockquote existente va como párrafo.
4. Al tachar una celda que ya contenía tachados propios, hay que partir el tachado en tramos: un
   `~~` que envuelve otro `~~` no anida y rompe el render.
