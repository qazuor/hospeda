---
title: "FASE 5 · publicación de los artifacts del cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · publicación de los artifacts del cobro

Programa HOS-1352. Republicación de la épica de billing y de las fichas `B1`…`B13` contra el diseño
de `73e6f0b167` (la FASE 5 aplicada entera; la publicación anterior era de `7a224777ad`). Siglas:
`$B` = `.specs/HOS-1354-billing-cobro-y-proveedor`; `B/desc` = `$B/descomposicion.md`. Sin commits,
sin push, sin tocar Linear. Fuentes: `10-`, `15-`, `16-`, `17-`, `21-`, `24-`, `27-`, `28-` de esta
carpeta y el diff `7a224777ad..73e6f0b167` de `$B`.

Cifras usadas en las páginas, verificadas con script antes de escribirlas: matriz **117 = 63 · 16 ·
24 · 14** (`contar-filas-de-la-matriz.py`; de las 14 `UNKNOWN`, 13 son del cobro y `EX-49` de
verticales); log **142**; guards **34 = 18 · 15 · 1**; unidades **24**; dependencias entre épicas 12.

## 1. Republicados (9)

Cada uno se bajó con `read` + `path`, se le sacó el envoltorio del servicio y además el
`<!doctype>`/`<html>`/`<head>`/`<body>` propio (las versiones anteriores tenían los dos, uno dentro
del otro), se editó el contenido sin tocar el diseño y se republicó con `url`, sin `icon`. La
relectura posterior da en los nueve **un solo** `<!doctype>`, un `<html>` y un `<body>`, el título de
siempre y el pie *«contra el diseño vigente (FASE 5)»*.

### Épica de billing — <https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ> (versión 12)

- Recuadro de arriba: suma `U2`, el outbox común, entre `U1` y las primeras que encolan (B4 y B12).
- Fila `DEC-MIG-005`: de las fichas se conserva sólo la de cada una de las cinco cuentas de la lista
  cerrada; las demás se borran en el corte (`DEC-MIG-007`, lote 1 J).
- Fila `DEC-MIG-005`: sale *«el cobro en vuelo del corte … se asienta sobre la lápida sin marca
  (`G3-1`)»*; entra el cobro tardío de un débito viejo como cualquier desconocido (lote C).
- Tabla de unidades: B4 arranca con *«B3, B5, V4 y `U2`»*; B12 con *«B13 y `U2`»*.
- Camino crítico: párrafo nuevo sobre `U2` (lo esperan B4 y B12; no mueve el camino crítico ni suma
  dependencias entre épicas); *«B4 con B3, B5, V4 y `U2`»*.
- Título de la tabla por unidad: *«la revisión del owner, la vuelta 3 y la FASE 5»*.
- Fila B1: variables de Mercado Pago que `U1` no borra (salvo `STATEMENT_DESCRIPTOR`); el reloj
  queda, la correlación, el id de corrida y el huso son de `U2`.
- Fila B4: el aviso se encola en el outbox de `U2`.
- Fila B6: devoluciones de una orden de a una (índice parcial), id por resta, `409` es error.
- Fila B11: sale *«el detector del día siguiente al corte»*; entran la devolución frenada y el cobro
  tardío por la lápida de recepción.
- Fila B12: sus correos salen por el outbox de `U2`.
- §«Lo que queda sin medir» reescrito: 63/16/24/14, trece del cobro, `EX-44`/`EX-45`/`EX-47` en
  sandbox antes de B11 fuera del paso 0, cinco que no se miden (`EX-42`, `EX-46`, `EX-48`, `EX-50`,
  `EX-54`), `EX-57`/`EX-58` `VERIFIED` y `EX-59` `PARTIALLY_SUPPORTED` con el sujeto retirado.
- Guards del programa: 33 → **34 (18 · 15 · 1)**, el 34 es `G18` de `V1`; `U2` no suma.
- Pie: FASE 9 vuelta 3 → FASE 5.

### B1 — <https://claude.ai/artifact/XS15EzcyrUFXkHrqRPk7mp> (versión 6)

- Párrafo nuevo: quedan para B1 las variables de Mercado Pago que `U1` no borra, todas salvo
  `STATEMENT_DESCRIPTOR`; `U1` se lleva las cuatro de rate limit y las diez del sistema viejo
  (lote 2 E).
- Párrafo nuevo: el reloj sigue en B1; la correlación, el id de corrida y el huso son de `U2`
  (lote 2 B).
- Pie.

### B4 — <https://claude.ai/artifact/PhznPesGdJNckEgUJukffC> (versión 8)

- Recuadro: *«se construye con B3, B5, V4 y U2»*, con la razón (el aviso se encola en el outbox).
- §«Devuelve un puntero»: *«El aviso se encola en el outbox común, que construye `U2`»*.
- «Depende de»: suma `U2`, que es del paraguas y no suma dependencias entre épicas.
- Pie.

### B6 — <https://claude.ai/artifact/7Rgsqbpv4xexx9dbzbaqwF> (versión 9)

- Recuadro: *«con `EX-58` medida antes»* → `EX-58` ya medida, `VERIFIED` desde el 30/09.
- §«El cobro de única vez…»: sale la rama del lote AK (*«toma la devolución de su mismo monto»*);
  entra la lista de cuatro: de a una con índice parcial (J), id por resta y sin la rama del mismo
  monto (5 F), `409` como error de programación y la nota de `RF-6` del pago (5 F), la devolución
  frenada la manda el barrido (M).
- Criterio: sale *«con dos devoluciones del mismo monto sigue en `CONFIRMED`»*; entra el de dos
  devoluciones pedidas a la vez sobre la misma orden (el de `B/desc:849`).
- «Depende de»: `EX-58` ya medida.
- Pie.

### B7 — <https://claude.ai/artifact/BxvBsVpS1pypNgdaFqb9ZY> (versión 10)

- Párrafo del cobro sobre una lápida reescrito: sale la lápida del corte (`G3-1`, `R2`, `V2-a`,
  `EX-48` en el paso 0); queda la de recepción como única, y el cobro tardío de un débito viejo
  entra por ahí como cualquier desconocido (lote C).
- Pie.

### B9 — <https://claude.ai/artifact/Fe1bqQkj8QThu75uKsHjev> (versión 9)

- Sale *«como la del paso 4 con sus lápidas»*; entra que los dos `permanent_grant` son la única
  escritura del corte que le queda a la épica y que `B/21` es capítulo sólo de B9 (`B/desc:914`).
- Pie.

### B10 — <https://claude.ai/artifact/CcSEbDa1dofcH7KH1RwZp3> (versión 10)

- `A3`: sale *«si el proveedor permite … (`EX-57`, que se mide antes de construir B11); si no lo
  permite, el caso queda sin detector y declarado»*; entra *«el proveedor permite encontrar una
  orden por esa referencia (`EX-57`, `VERIFIED` desde el 30/09)»*.
- Pie.

### B11 — <https://claude.ai/artifact/TCB6UEHbuxKDnLqYkHHmTC> (versión 10)

- Comprobación de órdenes pagadas: *«condicionada a `EX-57`»* → *«que `EX-57` midió posible»*.
- Viñeta nueva: la devolución de una orden que la base frenó la manda el barrido (5 F, J, M).
- Lápida de recepción: sale *«la misma forma de fila que la lápida del corte,
  `origen_de_lápida = RECEPCIÓN`»*; entra `clase = LÁPIDA`, forma de R6, la columna salió (I).
- Lápida de recepción: el reintento sigue la regla general del correo (K).
- *«El cobro que cae sobre una lápida, del corte o de recepción»* → *«sobre la lápida de
  recepción»*.
- §«La lápida del corte también es de acá» (dos párrafos: herramienta del paso 4, Worker, ventana
  del día del corte, detector y su segunda corrida) reemplazada por §«El cobro tardío de un débito
  viejo entra como cualquier desconocido», con la salvedad 4 en once filas y una lápida.
- §matriz: *«Nueve filas … dieciséis `UNKNOWN` … 61»* → *«Cinco filas abiertas … catorce … 63»*;
  salen `EX-48`, `EX-50`, `EX-57`, `EX-59` de la lista; `EX-44`, `EX-45`, `EX-47` en sandbox antes
  de B11; nota de las que ya no están abiertas.
- §«Si el barrido no corre»: el id de corrida, la correlación y el huso los agrega `U2`.
- Criterio: salen la herramienta del corte escribiendo lápidas, el cobro sobre la lápida del corte
  por día, la herramienta del paso 4 corrida dos veces, *«si `EX-57` lo permite»* y la primera
  corrida del detector posterior; entran los cuatro de `B/desc:854` de la FASE 5 (cobro tardío,
  salvedad 4, orden de a una con resta, devolución frenada).
- «Depende de»: `EX-44`/`EX-45`/`EX-47` antes; `EX-57` medida; una sola lápida, la migración ya no
  es su capítulo.
- Pie.

### B12 — <https://claude.ai/artifact/TuSxTZSU9xcUTy7Fp9uE6q> (versión 10)

- Recuadro: espera también a `U2`, porque sus correos se encolan ahí.
- «Depende de»: suma `U2` (lote 2 A), sin mover el camino crítico.
- Pie.

## 2. Sin cambios (5), no republicados

- **B2** (<https://claude.ai/artifact/W7vHN5g24wAL6UcvPjMNmN>): su fila y su criterio no cambiaron;
  el catálogo como SQL generado (lote 2 D) es de verticales, no de B2. Sólo el pie diría «FASE 9
  vuelta 3».
- **B3** (<https://claude.ai/artifact/SZWTgCVsibxQQBoCv1BqS1>): su fila no cambió. Lo único de la
  FASE 5 que la roza es que `provider_notification` nace sin `deleted_at` (`B/02:1241`, lote 4 E), y
  la ficha no enumera columnas; se dejó.
- **B5** (<https://claude.ai/artifact/TCjMHoQtCmbE1GDvJndrKu>): ni la fila ni el criterio cambiaron.
- **B8** (<https://claude.ai/artifact/UASiMLVL8iS9WVjPD2EU9d>): sin cambios; `PB9` sigue siendo el
  borrado del día 180 (`V/03:496`), así que *«`PB4`, `PB5` y `PB9` no actúan»* es correcto.
- **B13** (<https://claude.ai/artifact/7rdj5o5UFqbar5vD5ixsLn>): sin cambios; las acciones
  administrativas vivas siguen en **25** (`nucleo/08`) y los correos de la migración los manda B12.

## 3. Dónde falta el link a `U2`

La ficha de `U2` todavía no existe; queda nombrada como *«`U2`, el outbox común»* sin link en:

- Épica: recuadro de arriba, tabla de unidades (B4 y B12), párrafo del camino crítico, filas B1,
  B4 y B12 de la tabla por unidad, y el párrafo de guards.
- B1: párrafo del reloj.
- B4: recuadro, §«Devuelve un puntero» y «Depende de».
- B11: §«Si el barrido no corre».
- B12: recuadro y «Depende de».

Cuando exista, linkear la primera mención de cada página.

## 4. Residuos en la fuente (sin tocar)

- `$B/docs/06-proveedor.md:442`: «**Catorce de las dieciséis filas de 117**» (encabezado de la tabla
  de `UNKNOWN` del §11). Vale: catorce `UNKNOWN`, trece del cobro, como dice el mismo archivo en
  `:28`.
- `$B/descomposicion.md:883-887` (§5, *«Las otras fichas del programa»*): lista paraguas,
  verticales, billing y contrato; no nombra la ficha de `U1`
  (<https://claude.ai/artifact/DAqq2XU5iLpm3p9Mb9wGNq>) ni la de `U2`, que es la que esperan B4 y
  B12. Vale: sumarlas cuando exista la de `U2`.
- `$B/descomposicion.md:440` y `$B/spec.md:273` (`EX-46`): la unidad sigue siendo *«B11 · la
  herramienta del corte (paso 4b)»*. No es residuo: el 4b vive en `16-fase-7…:141` (la sonda de la
  entrega); se anota para que nadie lo lea como la lápida que salió.

Barrido de apoyo: script en Python sobre `$B` que borra los tachados multilínea y busca «lápida del
corte», `origen_de_lápida`, «de su mismo monto», «paso 4», «detector del día siguiente» y `G3-1`
fuera de un contexto que diga que salieron: **cero** vivos.

## 5. Descripciones de Linear que quedaron con contenido viejo

Según lo visto en las fichas (sus descripciones se escribieron con la publicación del 2026-09-30,
sobre el diseño de `7a224777ad`); no se leyó ni se tocó Linear:

- **HOS-1354** (épica): `DEC-MIG-005` con `G3-1`, `U2` ausente, matriz 61/16/24/16, *«EX-57 y
  EX-59 antes de B11»*, `EX-48` en el paso 0, guards 33 (17 · 15 · 1).
- **HOS-1364** (B1): sin las variables de Mercado Pago ni el reparto reloj/`U2`.
- **HOS-1367** (B4): dependencias sin `U2`.
- **HOS-1369** (B6): *«EX-58 se mide antes»* y la rama *«de su mismo monto»* (lote AK).
- **HOS-1370** (B7): la lápida del corte con `G3-1`, `R2` y `EX-48`.
- **HOS-1372** (B9): *«como la del paso 4 con sus lápidas»*.
- **HOS-1373** (B10): `EX-57` como condición abierta.
- **HOS-1374** (B11): la lápida del corte, el paso 4, el Worker, el detector, la matriz de nueve
  filas y *«EX-57 y EX-59 antes»*.
- **HOS-1375** (B12): dependencias sin `U2`.

Sin cambios de contenido: HOS-1365 (B2), HOS-1366 (B3), HOS-1368 (B5), HOS-1371 (B8), HOS-1376
(B13).

## 6. Conteos

- Artifacts: 14 revisados, **9 republicados**, 5 sin cambios.
- Reemplazos aplicados con un script que exige una sola coincidencia por par: épica 14 (más la
  sección de la matriz), B1 3, B4 5, B6 5, B7 1 (más el párrafo de la lápida), B9 2, B10 2, B11 13
  (más las dos secciones), B12 3.
- Relectura: `<!doctype` = 1, `<html` = 1, `<body` = 1 en los nueve; pie «FASE 5» = 1 en los nueve.

## Segunda pasada: links a U2 y Linear

Ficha de `U2`: <https://claude.ai/artifact/SSqQ7sSpUXzfiTCUbM8fGb>; issue: HOS-1401. Cada artifact se
leyó con `read` (sin `path` y con `path`), se le sacó el envoltorio del servicio y se aplicaron los
reemplazos con un script que exige exactamente una coincidencia por par
(`scratchpad/link-cobro/apply.py`). Sólo links: el texto no cambió. Publicados con `url`, sin
`icon`; la relectura da en los cinco un `<!doctype>`, un `<html>`, un `<body>`, el título de siempre
y cero `<code>U2</code>` sin link.

### Artifacts

- **Épica** (versión 13): nueve menciones linkeadas: recuadro, tabla de unidades (B4 y B12), las
  dos del camino crítico, filas B1, B4 y B12 de la tabla por unidad y el párrafo de guards.
- **B1** (versión 7): párrafo del reloj.
- **B4** (versión 9): recuadro, §«Devuelve un puntero» y «Depende de», que suma el link a HOS-1401.
- **B11** (versión 11): §«Si el barrido no corre».
- **B12** (versión 11): recuadro y «Depende de», que suma el link a HOS-1401.

### Linear

Cada escritura con `save_issue` + `patch` (anclas de una coincidencia), sin tocar estado,
prioridad, etiquetas ni relaciones; releídas con `get_issue` o con el estado que devolvió la
escritura. Ningún timeout. Las descripciones no tienen un pie único «Escrita el…»: acumulan líneas
«Actualizada el…», así que en cada una se agregó la línea del 30/09/2026 contra la FASE 5.

- **HOS-1354** (épica):
  - recuadro: `U2`, el outbox común, con link a HOS-1401, lo esperan B4 y B12;
  - fila `DEC-MIG-005`: fichas sólo de las cinco cuentas; lo pagado se pierde (`G1-4`); el cobro
    tardío entra como cualquier desconocido; la lápida del corte salió;
  - título y apertura de §«Lo que sumaron…»: suma la FASE 5;
  - viñetas B1 (variables de Mercado Pago; reloj/`U2`), B4 (outbox de `U2`), B6 (`EX-58`
    `VERIFIED`; devoluciones de a una, resta, `409`), B11 (sale el detector del día siguiente;
    `EX-57` `VERIFIED`; devolución frenada; cobro tardío por la lápida de recepción), B12 (outbox);
  - tabla de unidades: B4 «B3, B5, V4 y `U2`»; B11 sin «lápidas del corte»; B12 «B13 y `U2`»;
  - camino crítico: párrafo de `U2` y B4 con `U2`;
  - guards 33 (17 · 15 · 1) → 34 (18 · 15 · 1), el 34 es `G18`, `U2` no suma;
  - matriz 61/16/24/16 → 63/16/24/14, esperan medición 9, trece del cobro; `EX-44`/`EX-45`/`EX-47`
    en sandbox antes de B11; `EX-42`/`EX-48`/`EX-50` no se miden; `EX-57`/`EX-58` `VERIFIED`,
    `EX-59` `PARTIALLY_SUPPORTED`.
- **HOS-1364** (B1): párrafo de las variables de Mercado Pago que `U1` no borra; párrafo del reloj
  que sigue en B1 y la correlación, el id de corrida y el huso de `U2` (link a HOS-1401).
- **HOS-1367** (B4): recuadro con `U2` (link); «se encola en el outbox común» en §«Devuelve un
  puntero»; «Dependencias» suma HOS-1401.
- **HOS-1369** (B6):
  - recuadro: `EX-58` ya medida, `VERIFIED`;
  - «Deja funcionando»: devoluciones de a una, id por resta, `409` como error;
  - §«El cobro de única vez…»: sale la rama «de su mismo monto» (AK); entran índice parcial, resta,
    `409`, nota de `RF-6` y devolución frenada;
  - criterio: sale «con dos devoluciones del mismo monto sigue en `CONFIRMED`»; entran las dos
    devoluciones pedidas a la vez;
  - filas `UNKNOWN`: `EX-58` ya no está abierta.
- **HOS-1370** (B7): §«El pago que llega tarde»: sale la lápida del corte (`G3-1`, `V2-a`, `EX-48`),
  entra el cobro tardío por la lápida de recepción; matriz 61/16/24/16 → 63/16/24/14.
- **HOS-1372** (B9): sale «como la del paso 4 con sus lápidas»; los dos `permanent_grant` son la
  única escritura del corte que le queda a la épica y `B/21` es capítulo sólo de B9.
- **HOS-1373** (B10): `EX-57` pasa de condición a `VERIFIED` (dos lugares, sale «si no, queda sin
  detector»); «dieciséis `UNKNOWN`… 61… quince» → «catorce… 63… trece».
- **HOS-1374** (B11):
  - «Deja funcionando»: sale la lápida del corte con `origen_de_lápida = CORTE`;
  - los párrafos «Y desde…» de vuelta 2, verificación y vuelta 3: tachados el cobro del día del
    corte, el paso 4, la ventana (`V2-a`, `EX-48`), las anuales (`EX-50`), el detector (P-B) y el
    Worker; sale «condicionada a `EX-57`», el alta en la segunda corrida y «`EX-57` y `EX-59` se
    miden antes»;
  - capítulos: el `21` deja de ser de B11;
  - lápida de recepción: `clase = LÁPIDA`, forma de R6, sale la columna (I); reintento con la regla
    general del correo (K); «sobre una lápida, del corte o de recepción» → «de recepción»;
  - §«Las lápidas del corte (R6)» → §«El cobro tardío de un débito viejo entra como cualquier
    desconocido», con la salvedad 4 en once filas y una lápida;
  - §«Lo que la FASE 9 vuelta 2 le agregó»: tachadas las viñetas del cobro del día y del paso 4;
    viñeta nueva de la devolución frenada;
  - §«Si el barrido no corre»: id de corrida, correlación y huso de `U2` (link a HOS-1401);
  - criterio: salen la herramienta del corte escribiendo lápidas, el cobro sobre la lápida del
    corte por día, el paso 4 corrido dos veces, «si `EX-57` lo permite» y el detector (P-B); entran
    los cuatro de `B/desc:854`;
  - filas `UNKNOWN`: «nueve de las dieciséis… 61» → «cinco de las catorce… 63», `EX-44`/`EX-45`/`EX-47`
    en sandbox antes, `EX-57`/`EX-59`/`EX-48`/`EX-50` como ya no abiertas.
- **HOS-1375** (B12): recuadro y «Dependencias» suman `U2` con link a HOS-1401.
- **HOS-1365** (B2), **HOS-1366** (B3), **HOS-1368** (B5), **HOS-1371** (B8), **HOS-1376** (B13):
  sin cambios. Leídas buscando 23, 33, 14 y 16 `UNKNOWN`, 139, 61, «lápida del corte», `EX-57`,
  `EX-58`, `EX-59`, `EX-48` y `G3-1`: ninguna cifra ni mención vieja fuera de las líneas de
  historial.

Correcciones sobre la marcha, las dos releídas: en HOS-1370 el motivo había quedado escrito sin
tilde (`PAGO_TARDIO_RECHAZADO`) y se corrigió; en HOS-1374 Linear partió los tachados que tenían
código adentro (`~~…(~~`~~R2~~`~~)~~`) y se reescribieron sin backticks dentro del tachado.
