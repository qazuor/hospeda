---
title: "FASE 9 vuelta 1 · lo aplicado por G1 (el corte y la ficha vieja)"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — lo aplicado por G1

Aplicación de `01-G1-el-corte-y-la-ficha-vieja.md` (§2, §3 y su §5, 30 ítems) con las decisiones
del owner de `10-decisiones-del-owner.md`: `G1-1` (1), `G1-2` (1), `G1-3` (1), **`G1-4` (1, contra
la recomendación)** y `G1-5` (1). Tenidas en cuenta: `G3-1` (2) y `G3-2` (1).

Rutas: `V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B` =
`.specs/HOS-1354-billing-cobro-y-proveedor`, `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`.
Las líneas son las del 2026-09-26 al terminar; otros grupos siguen editando los mismos archivos.

## 1. Qué se aplicó

| # | ítem / decisión | archivo:línea | estado |
|---|---|---|---|
| 1 | `V/03` §9, `PB1`: `desde` = `DRAFT` o `UNPUBLISHED_BY_BILLING`, nota de la rama del trial (`G1-1`) | `V/docs/03-maquinas-de-estado.md:512` | hecho |
| 2 | `V/03` §9: estado de nacimiento de la ficha del corte | `V/docs/03-maquinas-de-estado.md:543` | hecho |
| 3 | `V/03` §9: las cuatro apariciones de *«`PB1` sale sólo de `DRAFT`»* | `V/docs/03-maquinas-de-estado.md:522`, `:551`, `:597`, `:1028` | hecho |
| 4 | `V/03` §9, *«Tres cosas…»* punto 1 | `V/docs/03-maquinas-de-estado.md:986` | hecho |
| 5 | `V/03` §2, bullet del rechazo del primer cobro | `V/docs/03-maquinas-de-estado.md:226` | hecho |
| 6 | `V/21` §2.4: párrafo de nacimiento, tabla `L1`–`L8`, dos capas, recuadro del guion; «NO cierra» con tres puntos | `V/docs/21-migracion.md:157`–`:208`; NO cierra `:416`, `:421`, `:424` | hecho |
| 7 | `V/02` §2.5, `listing`: nace en el estado de la tabla | `V/docs/02-modelo-de-datos.md:341` | hecho |
| 8 | `V/19` §4, filas 21 y 23 | `V/docs/19-superficies.md:67`, `:69` | hecho |
| 9 | `D/16` §4.2: quinto acto; *«Las otras tres»* | `D/16-fase-7-del-paraguas.md:170`, `:176`–`:187` | hecho |
| 10 | `V/descomposicion`, V6: alcance y criterio | `V/descomposicion.md:59`, `:486` | hecho |
| 11 | `B/21` §4: `is_featured` y `partner_subscriptions` | `B/docs/21-migracion.md:337` | hecho |
| 12 | `B/02` §2.2: `clase = LÁPIDA` y sus restricciones (con la de recepción de `G3-2` y la columna `origen_de_lápida`) | `B/docs/02-modelo-de-datos.md:47`, `:75` | hecho |
| 13 | `B/21` §2.5: qué lleva la lápida, sobre qué ids, quién la dispara; tachar *«sin lápida»* y *«la escribe una persona…»* | `B/docs/21-migracion.md:147`–`:157`, `:178`, `:208` | hecho |
| 14 | `B/09` §3, salvedad 4: la relectura de una lápida mira sólo el estado | `B/docs/09-conciliacion.md:189` | hecho |
| 15 | `D/16` §4.2, fila 4 y prosa del id que sólo estaba en el proveedor | `D/16-fase-7-del-paraguas.md:130`, `:155` | hecho |
| 16 | `B/descomposicion`, B11: la escritura de la lápida (alcance y criterio) | `B/descomposicion.md:137`, `:705` | hecho |
| 17 | la población del aviso: `B/21` §1.3, `V/21` §2.5, §4 y NO cierra, `D/16` §4.2 | `B/docs/21-migracion.md:75`; `V/docs/21-migracion.md:368`, `:381`, `:401`; `D/16-fase-7-del-paraguas.md:187` | **parcial**: falta `D/07` consulta 3, fuera del alcance de edición (§4) |
| 18 | `D/16` §4.2: paso 3a del catálogo y su verificación | `D/16-fase-7-del-paraguas.md:128` | hecho |
| 19 | `V/02` §2.1: `vertical` en `plan_version`, `vigente` mutable, `UNIQUE(id, plan_id)`, FK compuesta | `V/docs/02-modelo-de-datos.md:48` | hecho |
| 20 | `B/02` §2.2: las dos FK compuestas de `subscription`; `UNIQUE(id, plan_version_id)` en `billing_option` | `B/docs/02-modelo-de-datos.md:47`, `:31` | hecho |
| 21 | `V/02` §4.1: fotos en el almacenamiento externo; `PURGED` no borra la fila | `V/docs/02-modelo-de-datos.md:574` | hecho |
| 22 | `D/16` §4.2: las herramientas del corte; `B/descomposicion` lo cita | `D/16-fase-7-del-paraguas.md:221`; `B/descomposicion.md:765` | hecho |
| 23 | `D/16` §4.2, paso 0: la mitad en producción | `D/16-fase-7-del-paraguas.md:122` | hecho |
| 24 | `D/16` §4.2, aborto: redespliegue del viejo y reencendido verificado | `D/16-fase-7-del-paraguas.md:256` | hecho |
| 25 | `D/16` §4.2, paso 3: URL del webhook y entrega real | `D/16-fase-7-del-paraguas.md:127` | hecho |
| 26 | `D/16` §4.2: lo que la persona ve en la ventana | `D/16-fase-7-del-paraguas.md:214` | hecho |
| 27 | `D/16` §4.2: correo del aviso con el envío en el manifiesto | `D/16-fase-7-del-paraguas.md:209` | hecho |
| 28 | `V/02` §5: trigger que rechaza `DELETE` sobre `trial` | `V/docs/02-modelo-de-datos.md:738` | hecho |
| 29 | `V/02` §3.2: tachar la fila de suscripciones ancladas | `V/docs/02-modelo-de-datos.md:498` | hecho |
| 30 | `D/16` §1 y §3: el rollback ya aparece | `D/16-fase-7-del-paraguas.md:50`, `:75` | hecho |
| `G1-1` | `PB1` desde `UNPUBLISHED_BY_BILLING` sólo si arranca un trial | ítems 1–10 | hecho |
| `G1-2` | la borrada nace `PURGED` con el contenido borrado; `REJECTED` no se traduce y se lista | `V/docs/21-migracion.md:170`, `:185`, `:190`, NO cierra `:427`; `B/docs/21-migracion.md:78`; `V/descomposicion.md:59` | hecho |
| `G1-3` | los grants anclan el vendible de `rank` más alto de Alojamiento | `B/docs/21-migracion.md:109`; `D/16-fase-7-del-paraguas.md:129`; `B/descomposicion.md:135` (B9) | hecho |
| `G1-4` | se acepta y se declara la pérdida; el trial la compensa de hecho; el aviso lo dice | `B/docs/21-migracion.md:362` (NO cierra); `D/16-fase-7-del-paraguas.md:192`–`:200` (guion del aviso) | hecho |
| `G1-5` | reseñas conservadas sin mostrarse; calendario desconectado, token revocado y borrado | `V/docs/02-modelo-de-datos.md:574`; `V/docs/03-maquinas-de-estado.md:520`, `:523` | hecho |
| `G3-2` | la lápida de recepción usa la forma de fila de R6 | `B/docs/02-modelo-de-datos.md:47`, `:75`; `B/docs/21-migracion.md:157` | hecho (coordinado) |

Fuera de la lista del §5 y derivado de la misma causa (texto que R1 dejó falso): `V/21` §2.4 punto 3
de los grants del owner (`V/docs/21-migracion.md:130`), el paréntesis sobre `PB2` y la escritura
`C` (`:231`), *«hasta que publica o contrata»* (`:265`), la primera frase tachada del párrafo
*«Qué pasa entonces»* (`:144`), la ficha de B9 con los grants del corte (`B/descomposicion.md:135`)
y el bullet *«`B/21` es capítulo de dos unidades»* (`B/descomposicion.md:765`).

Ningún conteo cerrado cambió: seis estados y doce transiciones (se ensanchó un `desde`), 22
motivos, 14 acciones (G5 las lleva a 15, no yo), 10 máquinas.

Markdownlint sobre los diez archivos tocados: 0 issues (exit 0).

## 2. Lo que dejó declarado la opción elegida contra la recomendación (`G1-4`)

El owner eligió la 1 (aceptar y declarar) contra la 2 (devolver completo antes del corte). Quedó
escrito en dos lugares:

- **`B/21` «NO cierra»** (`B/docs/21-migracion.md:362`): lo pagado en el sistema viejo por un
  período que el corte corta, o por un addon vigente, se pierde y no se devuelve. Lo compensa de
  hecho el trial de `2g`, sin equivalencia calculada, y un addon no tiene trial que lo reemplace.
  **Causa**: coherencia con `2a` y `2d`, owner 2026-09-26, `G1-4`. **Mueve plata**, así que se
  declara con su detector: la re-verificación de `B/21` §1.3 lista quién pagó y qué, y un reclamo
  posterior se atiende contra el comprobante del proveedor (el «NO cierra» anterior del mismo
  capítulo). Se separa explícitamente del cobro en vuelo, que es `G3-1`.
- **Guion del aviso en `D/16` §4.2** (`D/16-fase-7-del-paraguas.md:192`–`:200`): el punto 3 dice
  que lo pagado no se devuelve y que el trial lo compensa de hecho, sin prometer equivalencia; el
  punto 4 pide no contratar ni comprar nada en el viejo después del aviso. Y el correo con envío
  registrado en el manifiesto es la única constancia de que la pérdida se avisó.

Riesgo que la opción deja y queda a la vista: un cliente que pagó días que no usa puede
desconocer el cobro ante el banco, y del lado nuestro sólo queda el envío del aviso registrado.

## 3. Propuestas para el log y la matriz

Ninguna. `DEC-MIG-005` punto 1 ya admite que el corte lea tablas viejas antes de retirarlas, y
ninguna de las decisiones aplicadas contradice el texto de una `DEC-` ni una fila de la matriz.

## 4. Residuos y choques con otros grupos

1. **`D/07` consulta 3 (R7) no se tocó**: `D/07-facts-inventory.md` no está en el alcance de
   edición. Texto a aplicar por quien pueda: *«una consulta por tabla de ficha de cada vertical,
   agrupada por dueño y por clase `L1`–`L8` (`V/21` §2.4), en lugar del único `count(*)` de
   alojamientos»*. Mientras no esté, `B/21` §1.3 describe una consulta que el inventario no tiene.
2. **Coordinación con G3 sobre la forma de la lápida**: G3 dejó en `B/02` un ⚠️ pidiendo que el
   origen quedara escrito en la fila. Se resolvió con la columna **`origen_de_lápida`** (`CORTE` o
   `RECEPCIÓN`), no nula exactamente cuando `clase = LÁPIDA` e inmutable, y se le agregó a su ⚠️
   una frase que lo nombra (`B/docs/02-modelo-de-datos.md:75`). G3 ya la usa en `B/21` §2.5.
3. **`B/21:213` («la lápida es la única fila `CANCELLED` que ninguna transición produce»)** sigue
   diciendo «única»; con `G3-2` hay dos escritores de esa forma. No lo toqué porque es la región de
   G3 (`B/05`/`B/21` §2.5 del cobro); lo dejo señalado.
4. **`D/16` §4.2, sondas del manifiesto**: el párrafo dice que sus cobros *«caen en la marca por la
   precondición de re-vinculación»*; con `G3-2` caen en una lápida de recepción. Es de G3.
5. **`G1-5` no tiene unidad nombrada** para la revocación del token de calendario en `PB9`/`PB12`
   (V9 y V6). El texto del capítulo lo pide; la descomposición no lo asigna todavía.
6. **`V/19` fila 23 la toca también G4 (R10, la regla del botón)**; mi agregado es la frase del
   registro del sistema nuevo, al final de la primera columna.

## Key Learnings

1. Tachar un párrafo que ya tiene tachados adentro rompe el markdown (`~~` no anida): hay que
   tachar los tramos vivos por separado, y un `~~` seguido de espacio no abre tachado.
2. Una afirmación de un documento de resolución sobre el esquema viejo se verifica contra el
   código antes de copiarla a un «NO cierra»: `accommodations` sí tiene `deleted_by_id`, así que
   la causa honesta de la pérdida de `L1` es la decisión del owner, no la falta del dato.
3. Cuando dos grupos escriben la misma forma de fila, el dato que distingue sus orígenes tiene
   que vivir en la fila (`origen_de_lápida`) y no en el estado de una marca que se puede levantar.
4. Ensanchar un `desde` deja frases viejas que lo niegan en varios lugares del capítulo; se
   buscan con variantes (`sólo de .DRAFT.` partido en dos líneas) y no sólo con la frase exacta.
