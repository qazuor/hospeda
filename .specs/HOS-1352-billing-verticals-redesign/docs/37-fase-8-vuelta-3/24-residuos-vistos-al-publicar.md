---
title: "FASE 9 vuelta 3 · aplicación — residuos vistos al publicar"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: los residuos vistos al publicar

Al publicar las fichas de las unidades, los agentes encontraron renglones vigentes del diseño que
contradicen el capítulo que manda, y las fichas siguieron al capítulo. Acá se corrigen en la
fuente. Un solo agente, con permiso sobre `$V/*`, `$B/*`, `$D/nucleo/*`, el contrato y `16-`.
Medido en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits. Todo es escritura,
sin decisión. El origen de cada enmienda es
`(residuo visto al publicar, 2026-09-30; vale <capítulo>)`, y lo viejo queda tachado.

## 1. Qué se aplicó

### Residuo 1: el criterio de `V6`

- La ficha del corte ya no nace `UNPUBLISHED_BY_BILLING` (vale `V/21` §2.4, C12).
  `$V/descomposicion.md:603` «ninguna ficha del corte nace `UNPUBLISHED_BY_BILLING`»
- La población del paso 4c: las `PURGED` y las `L5`/`L7` que el viejo servía, y se saltea con cero
  (vale `16-fase-7…` §4.2).
  `$V/descomposicion.md:603` «y si el recuento del paso 0 da cero, el 4c se saltea»
- La cláusula de `N-B-01` se tacha. Vale `V/03` §2, que la sacó con `R15` (C12, `L1-b`), no con C8
  como decía el pedido: la vuelta bajo un título que paga era del dueño del corte que contrataba sin
  publicar.
  `$V/descomposicion.md:603` «la vuelta bajo un título que paga salió con `R15`»
- El recorrido de `G-R9`: 28 con FK y 10 con `entity_type`, y la lista nombra 40 (vale `V/20` §2).
  `$V/descomposicion.md:603` «28 tablas con FK y 10 con `entity_type` sobre la rama después de la
  limpieza del principio»

### Residuo 2: `V/19` §4

- Fila 18: la fecha que imprime el aviso de archivado es la que el archivado escribió (vale
  `V/03` §9, `PB4` y `PB5`).
  `V/19:65` «`listing.borrado_anunciado`, la que el archivado escribió con la versión de plazos de la
  ficha»
- Su espejo en `V/02` §2.5, que decía que la fila 18 imprimía `inactiva_desde` + 180. El aviso sigue
  siendo el sexto lector de la columna, porque `PB4` y `PB5` calculan la fecha sobre ese reloj: el
  conteo de lectores no se mueve.
  `V/02:534` «calculan sobre este reloj y escriben en»
- Fila 23: **no tiene residuo vigente**. Su caso 1 (*«esta vertical ya no admite altas»*) ya estaba
  tachado con C8. El renglón con *«vertical sin altas»* que cita la fila 23 es el criterio de `V8`,
  y se corrige abajo, en el residuo 3.

### Residuo 3: `V3`, `V8` y `V9` en `$V/descomposicion.md`

- Fila de `V3`: la invalidación de una vertical entera por el fin de servicio (vale `V/02` §3.2).
  `$V/descomposicion.md:56` «la fila del fin de servicio salió con la revisión del owner»
- Criterio de `V3`.
  `$V/descomposicion.md:600` «sin fin de servicio de una vertical no hay invalidación de la vertical
  entera»
- Criterio de `V8`: la vertical sin altas que no ofrece nada (vale `V/19` §4 fila 23).
  `$V/descomposicion.md:605` «el caso 1 salió con la revisión del owner, 2026-09-28, C8»
- Criterio de `V9`: el día del fin de servicio y `N-B-03` (vale `V/03` §9, `PB9`).
  `$V/descomposicion.md:606` «la cláusula salió con el hecho 4»

### Residuo 4: `$B/descomposicion.md`

- Fila de `B1`: once reglas propias, y son doce (vale `B/20` §3.2, `RP1` a `RP12`).
  `$B/descomposicion.md:127` «la duodécima es `RP12`»
- Criterio de `B4`: ninguna fuente pasado el fin de servicio de una vertical (vale el
  contrato §2.6, sacada entera por C8). El caso de `GRANT` con su `piso` queda.
  `$B/descomposicion.md:844` «sacada entera por la revisión del owner, 2026-09-28, C8»
- Fila de `B10`: `S26` como tercer origen del `S12` del complemento (vale `B/03` §3.2).
  `$B/descomposicion.md:136` «y `S12` viene siempre de `S11`»

### Residuo 5: `B/19` §4 fila 21

- Los desenlaces del botón son tres, no cuatro: la fila 20 de `B/19` salió con C8.
  `B/19:140` «tres desenlaces son publicar, el checkout, o ninguno»

### Otros encontrados por búsqueda

Búsqueda sobre texto vigente (lo tachado se descarta antes de buscar, también cuando el tachado
cruza líneas, y las frases partidas en dos renglones se buscan unidas).

- `V/15` §4: la historia de la lista de invalidación contaba la entrada del fin de servicio de una
  vertical como si estuviera (vale `V/02` §3.2). Partida en dos renglones, `rg` por línea no la ve.
  `V/15:354` «esa fila salió con la revisión del owner, 2026-09-28, C8»
- Criterio de `B10`, el destaque de una principal que `S26` dejó en `CANCEL_SCHEDULED` con la
  marca 15 (vale `B/03` §3.2: el 15 es sólo la revocación).
  `$B/descomposicion.md:850` «y el 15 es sólo la revocación»
- `S12`-vía-`S26` como camino que pasó al motivo 15, en tres lugares.
  `B/02:1030` «y el 15 es sólo la revocación»
- El mismo, en el texto del motivo 14.
  `B/03:1289` «y abajo va nombrado~~»
- El mismo, en la anotación de la fila del motivo 14.
  `B/03:1344` «pasó a la fila de abajo, `V2-n`)~~»
- `B/19` §6, la fila de la marca 14: catorce transiciones, y cinco que no son un acto del
  cliente. Son once y una sola, `S17` (vale `B/03` §3.2: las otras cuatro eran de la
  discontinuación).
  `B/19:237` «una sola no es un acto del cliente, y cae acá: `S17`»
- Las transiciones que sacan a una principal de las filas vivas eran catorce en cinco renglones
  más, contadas con `S25`, `S27` y `S28`. Son once (vale `B/16` §4.3, que ya las recontó con C8).
  `B/03:182` «once transiciones de `B/16` §4.3»
- La misma cifra, en la razón del 2 que va entero al 14.
  `B/03:1352` «vale el recuento de arriba»
- La misma, en `S21` y la orfandad.
  `B/03:2538` «y hoy son **once**, sin `S25`, `S27` y `S28`»
- La misma, en la ventana de revocación.
  `B/03:2555` «**once** transiciones del `B/16` §4.3»
- La misma, en el criterio de `B10`.
  `$B/descomposicion.md:850` «una de las ~~catorce~~ once»
- La misma, en la fila de `B10`.
  `$B/descomposicion.md:136` «once desde que salieron `S25`, `S27` y `S28` con C8»

Sin residuo vigente en `$D/nucleo`, en el contrato y en `16-`: todo renglón con
`discontin\w*`, «fin de servicio» de una vertical, `admite_altas`, `situaciónDeVertical`, `D14` o
el hecho 4 ya está tachado, o dice que la discontinuación salió o queda fuera de esta versión. Los
«discontinuada» de `B/06`, `B/20`, `B/spec.md` y `16-` son la API de devoluciones del proveedor
(`R-MP-01`), no una vertical. El «fin de servicio» de una suscripción, de un addon o de una
sucesora no se tocó. `S25`–`S28` en `B/03` §9 quedan bajo su marca de historia (*«las dos
entradas de arriba quedan como historia»*).

## 2. Lo que no se aplicó y por qué

- La fila 23 de `V/19` §4: no tenía texto vigente que corregir (arriba).
- La cláusula de `V6` de las tres fichas del corte que suben por `PB3` en orden (`N-G1-01`): no se
  tocó, porque `V/03` §9 sigue vigente con esa regla. Ver el §7.

## 3. Conteos recontados

| lista | viejo → nuevo | comando | espejos |
|---|---|---|---|
| reglas propias del falso, `B/20` §3.2 | once → doce en la fila de `B1` | filas `RP` de la tabla de `B/20` §3.2: 12 | la fila de `B1`; `B/descomposicion.md:219` y `B/20:650` ya decían doce |
| transiciones que sacan a una principal de las filas vivas | catorce → once en `B/03:182`, `:1352`, `:2538`, `:2555`, `B/19:237` y `B/descomposicion.md:136`, `:850` | la enumeración de `B/03` §3.2 junto a la línea 1318: `S3`, `S12`, `S13`, `S16`, `S17`, el espejo del §10.1, `S22`, `S23`, `S24`, `S31`, `S36` = 11 | `B/16:746`, `:788`, `:820` y `:825` ya decían once |
| las que no son acto del cliente (misma lista) | cinco → una (`S17`) en `B/19:237` | la misma enumeración; `B/03:1331` ya decía una | ninguno más |
| desenlaces del botón, `B/19` fila 21 | cuatro → tres | lectura de la fila | ninguno |
| tablas de `G-R9` en el criterio de `V6` | 29/11 → 28/10, la lista nombra 40 | script sobre la última columna de la tabla de `V/02` §4.1: 40 nombres, 40 distintos | `V/20:71` ya lo decía |
| lectores de `listing.inactiva_desde`, `V/02` §2.5 | seis → seis (no cambia) | el aviso al archivar sigue leyendo el reloj por `PB4`/`PB5` | ninguno |

## 4. Para otro grupo

Ninguno: trabajé solo con permiso sobre todos los archivos que toqué.

## 5. Propuestas para el log y la matriz

Ninguna.

## 6. Preguntas abiertas

Ninguna. Ningún residuo resultó ser una elección.

## 7. Casos vecinos

- `V/02:731` sigue diciendo «Son 29 tablas con FK a» y 11 con `entity_type` del código actual,
  mientras su propia tabla nombra 40 que ya no incluyen las dos del cobro viejo y sí las dos del
  modelo nuevo (`F-8V3A3-007`). No es de la discontinuación ni estaba en el pedido; `V/20:71` tiene
  la cifra de la rama.
- La regla de `V/03` §9 sobre la ficha del corte sin evento de publicación (`N-G1-01`) y su cláusula
  en `V6` (*«tres fichas del corte de un mismo dueño … suben por `PB3` con cupo 1»*) siguen
  vigentes. Desde C12 hay una sola ficha a la vista por dueño y las `L5`/`L7` nacen `DRAFT`, así
  que el caso de las tres casi no tiene sujeto; decidir si se retira es del capítulo, no de un
  residuo.
- Los renglones de `G-R5` en `$V/descomposicion.md` (§2.7, la fila de `V9`, la línea 454) y en
  `$B/descomposicion.md` §2 quedan como historia bajo su marca de C14; ninguno describe la
  discontinuación.
- `V/19:67`, la fila 20, dice *«(`PB9`, día 180)»*: desde C9 el día es el del plazo de borrado. No se
  tocó.

## Key Learnings

1. Un residuo partido entre dos renglones (*«fin de\nservicio»*) no lo encuentra `rg` por línea:
   hay que buscar sobre el texto aplanado, y sacar lo tachado antes, porque un tachado también
   cruza líneas.
2. El pedido atribuía `N-B-01` a C8; el capítulo lo retira con `R15` (C12, `L1-b`). El origen de un
   tachado se toma del capítulo que manda, no del pedido.
3. La discontinuación dejaba cifras infladas lejos de su vocabulario: *«catorce transiciones»* y
   *«cinco no son acto del cliente»* no nombran ninguna vertical y contaban `S25`, `S27` y `S28`.
   Buscar sólo las palabras de la discontinuación no las encuentra; hay que buscar sus números.
4. Corregir una superficie arrastra el espejo del modelo de datos que la cita (`V/19` fila 18 →
   `V/02` §2.5); ahí había que ver que el conteo de lectores no cambiara.
