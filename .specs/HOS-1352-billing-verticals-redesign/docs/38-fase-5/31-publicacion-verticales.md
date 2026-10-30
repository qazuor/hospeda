---
title: "FASE 5 · publicación de los artifacts de la épica de verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · publicación: la épica de verticales y sus nueve fichas

Republicación de los artifacts de verticales después de la FASE 5 (commits `7a224777ad..73e6f0b167`),
con el OK del owner del 2026-09-30 ([`03-handoff.md`](../03-handoff.md), *«Última actualización:
2026-09-30 (noche)»*). Fuentes: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), los
registros `13-`, `14-`, `21-`, `23-`, `26-` y `28-`, y `$V/descomposicion.md` en `73e6f0b167`
(`$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`).

Cifras verificadas con script antes de escribirlas: log **142**; matriz **117 = 63 · 16 · 24 · 14**
(`contar-filas-de-la-matriz.py`); guards **34 = 18 · 15 · 1**, recontados sobre la columna `guards` de
las dos tablas de unidades (`V1` 4, `V3` 2, `V4` 4, `V5` 5, `V6` 3; `B1` 7, `B2` 1, `B3` 4, `B7` 1,
`B8` 1, `B10` 1; `G8` en `U1`); unidades **24**; dependencias entre épicas **12** (sin cambio en
`B/descomposicion.md` §2.6).

Método: cada página se bajó con `read` + `path`, se le sacó el esqueleto duplicado (el envoltorio
del servicio más el `<!doctype>`/`<html>`/`<head>`/`<body>` propio que traía adentro) y se
republicó sólo el contenido (`<title>`, fuentes, `<style>` y el cuerpo), con el mismo diseño. Todas
las republicadas se releyeron con `read` + `path`: un solo `<!doctype>`, un `<html>` y un `<body>`,
y la marca *«diseño vigente (FASE 5)»* presente.

## 1. Qué cambió en cada artifact

### Épica de verticales — <https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP> (versión 9)

- Lede: el diseño cerrado *«después de la FASE 5»*, no de la FASE 9 vuelta 3.
- Recuadro inicial: la FASE 5 ya fijó el package, `@repo/billing-verticals-contract`; `U1` deja las
  rutas con permiso y propiedad; entra `U2`, que esperan `V6` y `V9`.
- La frontera: el package del contrato con su nombre.
- Sección nueva *«Lo que cambió el 30/09: la FASE 5»*: `U1` creció (gates fuera, columnas de pago de
  `partners`, `is_featured`/`featured_by_entitlement`, `archive-abandoned-drafts`, enums
  recreados); `U2` y las 24 unidades; `V5` (paso de cobertura, `404` a `RESTRICTED`, sale la
  impersonación, `fullAdminRole` vacío); el estado nuevo de la ficha y las puertas de borrado;
  postulación propia y rol de socio; `G18` y los 34 guards; el corte de cinco cuentas; plazos antes
  del merge de `V6` y `trial` sin `deleted_at`.
- Viñeta *«El corte (C12)»* de la sección 28–30/09: pasada a pasado y remitida a la simplificación
  de la FASE 5; queda el paso 6.
- *«Cómo se comprueba»*: diecinueve → **veinte** guards en el catálogo (diez con id propio, con
  `G18`), diecisiete → **dieciocho** de esta épica, 33 → **34** en el programa (18 · 15 · 1).
- *«Las nueve unidades»*: `V6` y `V9` esperan a `U2`, que no suma a las dependencias entre épicas;
  la fila de `V1` en la tabla pasa a `G1 · G3 · G14 · G18`.
- *«Sin deuda de datos»*: sale la tabla de ocho clases; entran las cinco cuentas de `DEC-MIG-007`,
  el borrado de las demás fichas, la tabla de paso y la prueba que escribe la herramienta de `V6`.
- Pie: *«(FASE 5)»*.

### V1 — <https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o> (versión 5)

- Lede: suma la tabla de claves como SQL generado y pasa a **cuatro** guards, con `G18`.
- Recuadro: la FASE 5 ya fijó el nombre del package (`DEC-ARCH-015`); sale *«lo que queda antes de
  escribir código»*.
- Título de la sección del package con su nombre.
- Sección nueva *«La tabla de claves viaja como SQL generado, y `G18` la vigila»* (lotes de la
  aplicación E y Q).
- Sección de `G8`: la lista de pendientes ya no cubre `extras/` (lote 1 H).
- *«Está lista cuando»*: el criterio de `G18` y *«cuatro guards»*.
- Pie: *«(FASE 5)»*.

### V2 — <https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R> (versión 10)

- *«Los planes viven enteros en la base»*: el catálogo viaja como SQL generado (lote 2 D), `V2` le
  suma su carga a `G18`, y la prueba del corte sale de la migración (la escribe la herramienta de
  `V6`).
- *«Está lista cuando»*: un cambio en el catálogo sin regenerar su SQL pone rojo a `G18`.
- Pie: *«(FASE 5)»*.

### V4 — <https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa> (versión 9)

- *«El trial es único de por vida»*: `trial` nace sin `deleted_at` y el trigger rechaza el `DELETE`
  (lote 4 E).
- *«El corte»*: la prueba es de las cinco cuentas y la escribe la herramienta del corte de `V6`
  después de la migración, con la función de la aplicación (lote 2 D, lote de la aplicación B).
- *«Está lista cuando»*: el criterio de `trial` sin `deleted_at`.
- Pie: *«(FASE 5)»*.

### V5 — <https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX> (versión 9)

- Recuadro: `V5` cierra el hueco que abre `U1` en las rutas.
- Paso 3 de la lista: en Partner, la familia del rol de socio.
- Sección nueva *«El paso de cobertura, en toda ruta de escritura de vertical»* (lote 1 A).
- Paso 4: sale la excepción VIP; una ficha ajena `RESTRICTED` contesta `404` (lote 4 D).
- Párrafo nuevo del rol de socio en el paso 3, que no se quita (lote 4 B, F, N).
- Subsección nueva *«Sale la impersonación que el código de hoy tiene apagada»*: `impersonate`,
  `set-role`, el botón, `USER_IMPERSONATE`, HOS-354 y `fullAdminRole` vacío (lote 4 C y lote de la
  aplicación L).
- *«Está lista cuando»*: los cinco criterios nuevos (cobertura, `404`, socio, plugin, `fullAdminRole`).
- Pie: *«(FASE 5)»*.

### V6 — <https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY> (versión 9)

- Lede: la migración del corte carga las cinco fichas y borra las demás.
- Recuadro: espera a `V5` **y a `U2`**, porque `PB12` encola su correo.
- Sección nueva *«El estado nuevo reemplaza a tres columnas de hoy»*: `lifecycle_state`,
  `visibility`, `moderation_state`; qué filas revalidan; los lectores de `owner_suspended`,
  `plan_restricted` y `billing_unpublished_at`; las puertas de borrado y restauración (lote 3 A, B,
  C).
- Lista de `PURGED`: 28 con FK y 10 con `entity_type` → **29 y 9** (`BD-011`).
- Reloj: la escritura del corte es de las cinco fichas, no de *«toda ficha existente»*.
- Sección del corte reescrita: *«El corte: cinco fichas, y las demás se borran»* (lista cerrada,
  tabla de paso fuera de Drizzle, herramienta de `V6` para las pruebas, un solo gate, catálogo como
  SQL generado, plazos antes del merge de `V6`, 5b desde la tabla de paso, 4c siempre, paso 6).
  Salen la tabla `L1`–`L8`, el recuento de seudónimos, el de Gastronomía y Experiencia y la cifra
  *«la tabla del corte tiene 15 filas»* (el paso 4 salió, S-40; no se volvió a contar).
- *«Está lista cuando»*: reemplazado lo de `L1`–`L8` por el criterio de `$V/descomposicion.md` §4 fila
  `V6` (cinco fichas, tabla de paso, 5b, 4c, columnas viejas sin lectores, puertas, plazos).
- *«Depende de»*: `V5` y `U2`.
- Pie: *«(FASE 5)»*.

### V7 — <https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb> (versión 7)

- Lede: suma la postulación propia y el rol de socio.
- Recuadro: lo que `U1` borra de `partners` (las seis columnas, FK y tres crons), la presencia
  invisible entre `U1` y `V7`, y `V7` borra `starts_at`/`ends_at` (lote 1 D, lote de la aplicación H,
  segunda tanda O).
- *«Quién postula»*: la postulación es propia, no `alliance_leads` (lote 4 A).
- Subsección nueva *«El rol de socio llega con el reclamo, y no se quita»* (lote 4 B, F, N).
- *«Está lista cuando»*: `alliance_leads`, rol en el reclamo, alta directa sin dueño ni rol, el rol
  se conserva, `starts_at`/`ends_at` no existen después de `V7`.
- Pie: *«(FASE 5)»*.

### V8 — <https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq> (versión 8)

- Botón de suscribirse: las cinco cuentas del corte no llegan; toda otra cuenta llega como quien no
  publicó (sale *«el que sólo tenía borradores»*).
- *«Qué lee cada superficie»*: el panel lee la postulación propia, no `alliance_leads`; la home sin
  destacados hasta el complemento (lote 1 F).
- Acciones 23 y 24: la 24 reemplaza a `user/admin/hardDelete.ts` (`USER_HARD_DELETE`), que `V8`
  retira (lote 3 C).
- *«Está lista cuando»*: no queda ruta que borre físicamente una cuenta.
- Pie: *«(FASE 5)»*.

### V9 — <https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd> (versión 9)

- Recuadro: espera a `V4`, `V6` **y `U2`**, porque encola los avisos de retención.
- Escritura del corte: las cinco fichas, no *«toda ficha existente»*.
- Plazos sin valor: los fija el owner **antes del merge de `V6`** (lote 3 D), no antes del ensayo.
- Lista de proveedores: el corte escribe la prueba de las cinco cuentas, no *«de la cartera»*.
- *«Depende de»*: `V4`, `V6` y `U2`.
- Pie: *«(FASE 5)»*.

## 2. Sin cambios

- **V3** — <https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6>: no se republicó. La FASE 5 no tocó su
  fila ni su criterio en `$V/descomposicion.md` (§2 y §4 iguales en el diff), y `14-` §1 da
  `V/15-entitlements-y-limits.md` revisado y sin cambios. Su pie sigue diciendo *«(FASE 9 vuelta
  3)»*, que es cierto para su contenido.

## 3. Dónde falta el link a `U2`

La ficha de `U2` todavía no existe. Está nombrada **«`U2`, el outbox común»**, sin link, en:

- la épica: recuadro inicial, sección *«Lo que cambió el 30/09»* y sección *«Las nueve unidades»*;
- `V6`: recuadro y *«Depende de»*;
- `V9`: recuadro y *«Depende de»*.

Cuando exista, hay que linkear esas siete menciones. La tabla de la épica no tiene fila de `U1` ni de
`U2` (lista sólo las nueve `V*`), y ninguna ficha `V*` linkea tampoco la de `U1`
(<https://claude.ai/artifact/DAqq2XU5iLpm3p9Mb9wGNq>).

## 4. Residuos en la fuente (no se editaron)

1. `$V/spec.md:414`: *«Y la regla que vale para los ~~diecisiete~~ … ~~veintiuno~~ diecinueve»*.
   Vale **veinte**: el catálogo de `$V/docs/20-testing.md` §2 suma `G18`, y la misma spec lo dice en
   `:66` y `:392` (*«veinte guards»*).
2. `$V/descomposicion.md:651-654`: *«Las otras cuatro fichas del programa»* lista el paraguas, las
   dos épicas y el contrato. Falta la de `U1` (<https://claude.ai/artifact/DAqq2XU5iLpm3p9Mb9wGNq>,
   publicada el 2026-09-30) y, cuando exista, la de `U2`.
3. `$V/descomposicion.md:536` (§2.13, fila de las puertas de borrado): asigna la baja física de
   cuentas a `V8`, pero `13-` §4 punto 8 lo deja *«confirmar al escribir `V8`»* (el consolidado da
   `V6`, `V5`, `V8` y `V4`). La ficha de `V8` sigue a la descomposición; si se confirma otra unidad,
   cambia esa ficha.
4. La cifra *«la tabla del corte tiene 15 filas»* que tenía la ficha de `V6` no se recontó contra
   `16-fase-7-del-paraguas.md` §4.2 después de que salieron el paso 4 (S-40) y otras filas; se sacó de
   la ficha en vez de corregirla. Si alguna otra ficha (tablero, paraguas) la cita, está sin
   verificar.

## 5. Descripciones de Linear que quedaron viejas

No se tocó Linear ni se leyeron las descripciones: lo que sigue sale de lo que cambió en cada ficha,
cuyas descripciones de Linear se escribieron en la salida 5 (2026-09-30, antes de la FASE 5).

| issue | unidad | qué les falta |
|---|---|---|
| HOS-1353 | épica | `U1` creció, `U2` y las 24 unidades, `G18` y 34 guards (18 acá), el corte de cinco cuentas, impersonación afuera, nombre del package |
| HOS-1355 | `V1` | `G18` y la tabla de claves como SQL generado; cuatro guards; nombre del package |
| HOS-1356 | `V2` | catálogo como SQL generado vigilado por `G18`; la prueba del corte fuera de la migración |
| HOS-1357 | `V3` | nada (sin cambios en la FASE 5) |
| HOS-1358 | `V4` | `trial` sin `deleted_at`; la prueba de las cinco la escribe la herramienta de `V6` |
| HOS-1359 | `V5` | paso de cobertura, `404` a `RESTRICTED`, rol de socio en el paso 3, impersonación y `set-role` afuera, `fullAdminRole` vacío, HOS-354 |
| HOS-1360 | `V6` | depende de `U2`; estado nuevo y columnas viejas; puertas de borrado; corte de cinco fichas con tabla de paso; 29/9 tablas; plazos antes del merge |
| HOS-1361 | `V7` | postulación propia; rol de socio en el reclamo; alta directa sin dueño; `starts_at`/`ends_at` |
| HOS-1362 | `V8` | baja física de cuentas retirada; botón para las cinco cuentas; home sin destacados; panel de postulaciones |
| HOS-1363 | `V9` | depende de `U2`; plazos antes del merge de `V6`; las cinco fichas del corte |

## Segunda pasada: links a U2 y Linear

Hecha el 2026-09-30, después de publicada la ficha de `U2`
(<https://claude.ai/artifact/SSqQ7sSpUXzfiTCUbM8fGb>, issue
[HOS-1401](https://linear.app/hospeda-beta/issue/HOS-1401)).

### Artifacts: las siete menciones de §3, linkeadas

Método: `read` sin `path` (para poder republicar) y `read` + `path` para el archivo; se sacó el
envoltorio del servicio y se reemplazó `<code>U2</code>, el outbox común` por un link a la ficha de
`U2`, con un script que exigía exactamente una coincidencia por reemplazo. Republicadas con `url` y
sin `icon`, y releídas: un `<!doctype>`, un `<html>` y un `<body>` cada una, y un `diff` contra la
versión anterior sin otra diferencia que los links.

| artifact | versión | dónde |
|---|---|---|
| Épica (`UZzqK6P7ZyfAFuWrw5n4BP`) | 10 | recuadro inicial; *«Lo que cambió el 30/09»*; *«Las nueve unidades»* |
| `V6` (`Lqmv2r3Vt53ugG2iBKnJEY`) | 10 | recuadro; *«Depende de»* |
| `V9` (`5Nc7PT6fyh67GoL7Lfmwcd`) | 10 | recuadro; *«Depende de»* |

`HOS-1401` no se agregó a ningún artifact: ninguna de las tres páginas lista issues fuera de su
propio pie. `U1` sigue sin link en las tres, igual que antes (no había un patrón que copiar).

### Linear: qué patch se aplicó en cada issue

Todas con `save_issue` + `patch` anclado, releídas con `get_issue` después de cada escritura. Estado,
prioridad, etiquetas y relaciones sin tocar. Ningún timeout. Los pies de estas descripciones no
decían *«Escrita el …»* sino *«Última actualización: … (FASE 9 vuelta 3 …)»* o una serie de
*«Actualizada el …»*: se conservaron y se agregó al final una línea *«Actualizada el 30/09/2026
contra el diseño vigente (FASE 5, `38-fase-5/`): …»* con lo que cambió.

#### HOS-1353 (épica)

- Recuadro: la FASE 5 ya decidió qué se reescribe y fijó `@repo/billing-verticals-contract`; qué
  hace `U1`; `U2` con link a su ficha y a HOS-1401, que V6 y V9 esperan.
- Frontera: el package con su nombre.
- Sección nueva *«Lo que cambió el 30/09: la FASE 5»* (ocho viñetas: `U1` creció, `U2` y 24
  unidades, V5, estado nuevo y puertas de borrado, Partner, `G18` y 34 guards, corte de cinco
  cuentas, plazos y `trial` sin `deleted_at`).
- Viñeta *«El corte (C12)»* de la sección 28–30/09: pasada a pasado y remitida a la FASE 5.
- *«Lo que sigue valiendo»*, viñeta del corte: sin `L1` ni `R9-b`; 5b desde la tabla de paso, 4c
  siempre.
- Tabla de unidades: fila V1 `G1 G3 G14` → `G1 G3 G14 G18`.
- *«Las nueve unidades»*: V6 y V9 esperan a `U2` (link a ficha y HOS-1401), sin sumar dependencias
  entre épicas.
- *«Cómo se comprueba»*: diecinueve → veinte guards (diez con id, con `G18`), diecisiete →
  dieciocho, 33 → 34 (18 · 15 · 1).
- *«Sin deuda de datos»*: sale *«se conservan … sus fichas»* y la tabla `L1`–`L8`; entran las
  cinco cuentas (`DEC-MIG-007`), el borrado de las demás fichas, la tabla de paso y la herramienta
  de V6.
- Pie agregado. Sin cambio: doce dependencias y matriz *«117 filas, 16 `UNKNOWN`»* (ya coincidían).

#### HOS-1355 (V1)

- Recuadro: sale *«lo que queda antes de escribir código … la FASE 5»*; la FASE 5 ya fijó
  `@repo/billing-verticals-contract` (`DEC-ARCH-015`).
- *«Deja funcionando»*: suma la tabla de claves como SQL generado, vigilada por `G18`.
- *«Guards que nacen acá»*: suma `G18`.
- Título *«El package del contrato»* con el nombre del package.
- Sección nueva *«La tabla de claves viaja como SQL generado, y `G18` la vigila»*, con el párrafo de
  `G8` sin `extras/` (lote 1 H).
- *«Está lista cuando»*: el criterio de `G18`; *«`G1`, `G3` o `G14`»* → *«`G1`, `G3`, `G14` o
  `G18`»*.
- Pie agregado.

#### HOS-1356 (V2)

- Recuadro: *«queda el gate de la FASE 5»* → la FASE 5 ya está cerrada.
- *«Guards que nacen acá»*: le suma a `G18` la carga del catálogo.
- *«Los planes viven enteros en la base»*: la prueba del corte sale de la migración (la escribe la
  herramienta de V6); el catálogo viaja como SQL generado y V2 le suma su carga a `G18`.
- *«Está lista cuando»*: un cambio en el catálogo sin regenerar su SQL pone rojo a `G18`.
- Pie agregado.

**HOS-1357 (V3)**: sin cambios. Leída: nada de la FASE 5 la toca. Ver el residuo 1 abajo.

#### HOS-1358 (V4)

- Recuadro: gate de la FASE 5 → cerrada.
- *«Deja funcionando»*: la derivación del plan de trial la reusa la herramienta del corte de V6, no
  la migración; suma `trial` sin `deleted_at` con el trigger (lote 4 E).
- *«El trial, único de por vida»*: `trial` nace sin `deleted_at`.
- *«Siete transiciones»*: *«el corte que publica a la cartera»* → las cinco cuentas que conserva.
- *«El corte»*: prueba a las cinco cuentas (`DEC-MIG-007`), escrita después de la migración por la
  herramienta de V6.
- *«Está lista cuando»*: `trial` sin `deleted_at` y el trigger rechaza el `DELETE`.
- Pie agregado.

#### HOS-1359 (V5)

- Recuadro: gate de la FASE 5 → cerrada; V5 cierra el hueco que abre `U1`.
- *«Deja funcionando»*: bloque *«Desde la FASE 5»* (paso de cobertura, `RESTRICTED` → `404`, rol de
  socio en el paso 3, impersonación y `set-role` afuera con HOS-354, `fullAdminRole` vacío).
- Tabla de pasos, fila 3: *«permiso (en Partner, la familia del rol de socio)»*.
- Sección nueva *«El paso de cobertura, en toda ruta de escritura de vertical»* (lote 1 A).
- Paso 4: sale la excepción VIP (`403` → `404`, lote 4 D).
- *«Actor y sujeto»*: sale la impersonación apagada y `fullAdminRole` queda vacío; viñeta nueva del
  rol de socio.
- *«Está lista cuando»*: los cinco criterios nuevos.
- Pie agregado.

#### HOS-1360 (V6)

- Recuadro: espera a V5 **y a `U2`** (link a ficha y HOS-1401), porque `PB12` encola su correo;
  gate de la FASE 5 → cerrada.
- *«Deja funcionando»*: el corte de cinco fichas con tabla de paso, SQL generado y herramienta de la
  prueba (sale `L1`–`L8`, lote N); bloque *«Desde la FASE 5»* (estado nuevo, columnas viejas sin
  lectores, puertas de borrado, plazos antes del merge).
- Lista de `PURGED`: 28 con FK y 10 con `entity_type` → 29 y 9 (`BD-011`).
- Sección nueva *«El estado nuevo reemplaza a tres columnas de hoy»* (lotes 3 A, B, C).
- *«El reloj y los plazos»*: los plazos sin valor, antes del merge de V6 (lote 3 D).
- Sección del corte reescrita como *«El corte: cinco fichas, y las demás se borran»*; sale la cifra
  *«tabla del corte, 15 filas»*.
- *«Está lista cuando»*: `G-R9` da 29 y 9; los criterios de `L1`–`L8` reemplazados por los de §4
  fila V6 (cinco fichas, tabla de paso, 5b, 4c, columnas sin lectores, puertas, plazos).
- *«Dependencias»*: V5 y `U2` (ficha y HOS-1401).
- Pie agregado.

#### HOS-1361 (V7)

- Recuadro: gate de la FASE 5 → cerrada; párrafo nuevo con lo que `U1` borra de `partners` (seis
  columnas, FK, tres crons), la presencia invisible hasta V7 y `starts_at`/`ends_at`.
- *«Deja funcionando»*: bloque *«Desde la FASE 5»* (postulación propia, rol de socio, alta directa
  sin dueño, migración de `starts_at`/`ends_at`).
- *«Quién postula»*: la postulación es propia, no `alliance_leads`.
- Subsección nueva *«El rol de socio llega con el reclamo, y no se quita»*.
- *«Está lista cuando»*: `alliance_leads`, rol en el reclamo, alta sin dueño ni rol, rol conservado,
  `starts_at`/`ends_at` inexistentes después de V7.
- Pie agregado.

#### HOS-1362 (V8)

- Recuadro: gate de la FASE 5 → cerrada.
- Botón de suscribirse: *«el dueño del corte con una ficha a la vista / el que sólo tenía
  borradores»* → las cinco cuentas del corte no llegan; toda otra cuenta llega como quien no
  publicó.
- *«Qué lee cada superficie»*: postulaciones de la postulación propia, no `alliance_leads`; home sin
  destacados hasta el complemento (lote 1 F).
- Acciones: la 24 reemplaza a `user/admin/hardDelete.ts` (`USER_HARD_DELETE`), que V8 retira.
- *«Está lista cuando»*: no queda ruta que borre físicamente una cuenta.
- Pie agregado.

#### HOS-1363 (V9)

- Recuadro: espera a V4, V6 **y `U2`** (link a ficha y HOS-1401), porque encola los avisos de
  retención; gate de la FASE 5 → cerrada.
- Escritura `C`: *«toda ficha que ya existe ese día»* → las cinco fichas que conserva el corte.
- Plazos sin valor: *«antes del ensayo del corte»* → antes del merge de V6 (lote 3 D).
- Seudónimo: *«la prueba activa de la cartera»* → de las cinco cuentas.
- *«Dependencias»*: V4, V6 y `U2` (ficha y HOS-1401).
- Pie agregado.

### Residuos vistos en esta pasada (no se editaron)

1. **HOS-1357 (V3)** conserva *«Por encima de todas las unidades queda el gate de la FASE 5 del
   programa»*, que ya no es cierto; se dejó por la instrucción de no tocar V3. Es una línea.
2. **La ficha de V3** (<https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6>, versión
   `1790779998-1c01`) tiene **doble esqueleto**: dos `<!doctype>`, dos `<html>` y dos `<body>`
   (el envoltorio del servicio más el propio). No se republicó en la FASE 5 y no se tocó acá.
3. La búsqueda por número no encontró otras cifras viejas en las diez descripciones: `23` aparece
   sólo como *«23 son capacidad del actor»* y *«la 23»* (acción), que son vigentes; no hay 33, 17,
   139 ni `61·16·24·16`.
