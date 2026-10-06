---
title: "FASE 5 · 12 · aplicación — núcleo y contrato"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · 12 · aplicación de las decisiones del owner al núcleo y al contrato

Fuente única: `10-decisiones-del-owner.md` (lotes 1 a 6 y el de simplificación del corte),
`20-simplificacion-del-corte.md` (piezas `S-NN`) y `00-consolidado.md` (racimos `R5-NN`). Todo lo
que cambia está tachado al lado de lo nuevo o lleva ✚, con su origen entre paréntesis.

## 1. Archivos tocados

- `$D/nucleo/00-indice.md`
- `$D/nucleo/01-glosario.md`
- `$D/nucleo/02-modelo-de-datos.md`
- `$D/nucleo/04-invariantes.md`
- `$D/nucleo/07-outbox-y-notificaciones.md`
- `$D/nucleo/08-auditoria-y-observabilidad.md`
- `$D/12-contrato-de-cobertura.md`

`$D/nucleo/03-maquinas-de-estado.md` no se tocó: ningún término de las decisiones aparece en él
(§3 de este registro).

## 2. Qué se aplicó

### Lote 2 A · el outbox lo construye `U2` (`R5-10`)

- `NUCLEO/07` §1.4 nuevo: quién lo construye, dependencias y lo que trae.
  `nucleo/07:67` «Quién lo construye: `U2`, el outbox común»
- Ídem, la unidad, sobre el precedente del newsletter.
  `nucleo/07:69` «**Lo construye `U2`**, una unidad del paraguas como `U1`:»
- `NUCLEO/02` §2.6, fila `outbox`.
  `nucleo/02:258` «Lo construye `U2`, que absorbe la bitácora de correos renombrada desde `billing_notification_log`»
- Glosario §1.7, fila *Outbox*.
  `nucleo/01:369` «lo construye `U2` y absorbe la bitácora de correos»
- Índice, fila del cap. `07`.
  `nucleo/00:119` «**lo construye `U2`** (§1.4; FASE 5, owner 2026-09-30, lote 2 A)»

### Lote 1 B · `billing_notification_log` con nombre neutro (`R5-02`)

Sin nombre nuevo decidido en los informes: se escribe con perífrasis (*«la bitácora de correos,
que `U1` renombra desde `billing_notification_log` a un nombre neutro»*). El diseño no necesita el
nombre, así que no vuelve al owner.

- `NUCLEO/07` §1.4, punto 2: sin la columna ni la FK de cliente del cobro, índice propio fuera
  del extra `004`, absorbida por `U2`.
  `nucleo/07:76` «neutro, sin la columna ni la FK de cliente del cobro y con su índice propio fuera del extra»

### Lote 2 B · correlación, id de corrida y huso en `U2`; el reloj en `B1` (`R5-11`)

- `NUCLEO/07` §1.4, punto 3: el reloj no es de `U2`.
  `nucleo/07:82` «leen no es de `U2`: sigue siendo la interfaz que construye `B1`»
- `NUCLEO/07` §3, consecuencia 2: el huso de los jobs.
  `nucleo/07:148` «la infraestructura de jobs `U2`** (§1.4; FASE 5, owner 2026-09-30, lote 2 B): hoy el»
- `NUCLEO/08` §2.4 nuevo.
  `nucleo/08:170` «Quién lo construye: `U2` ✚»
- Ídem, lo que construye.
  `nucleo/08:172` «**La correlación acuñada en el borde, su campo en el evento y»
- Ídem, el reloj.
  `nucleo/08:176` «**El reloj con que un job lee la hora no es de `U2`**»
- Índice, fila del cap. `08`.
  `nucleo/00:120` «**que construye `U2`** (§2.4; FASE 5, owner 2026-09-30, lote 2 B)»
- Contrato §7.1, punto 5: la FASE 5 no mueve el reloj.
  `D/12:1561` «no lo mueve**: el reloj sigue en `B1`»

### Lote 2 C · las bases de desarrollo y test con `db:migrate` (`R5-12`)

- `NUCLEO/02` §1.4, después de *«el seed deja el que encuentra»*.
  `nucleo/02:143` «nocturno pasan a armarse con `db:migrate`**, como ya hace la del e2e de cada PR»

### Lote 2 D · catálogo como SQL generado; pruebas por el script del corte (`R5-13`) y `S-12`

- `NUCLEO/02` §1.4, punto 2: el SQL generado y el guard.
  `nucleo/02:100` «**La migración lleva el catálogo como SQL generado por un script TypeScript**»
- Ídem, la prueba del corte la escribe el script, sólo para las cinco.
  `nucleo/02:102` «**La prueba del corte ya no la escribe la migración: la escribe después»
- Ídem, lo que se resigna.
  `nucleo/02:105` «operación atómica: con cinco filas no importa (FASE 5, owner 2026-09-30, lote 2 D;»
- Ídem, tachado *«ni una prueba sin plan»*.
  `nucleo/02:98` «catálogo a medias ~~ni una prueba sin plan~~ (la prueba ya no está en la migración: abajo).»
- `NUCLEO/02` §1.5, la versión 1 de los plazos.
  `nucleo/02:192` «(la prueba la escribe después el script del corte: FASE 5, owner 2026-09-30, lote 2 D)»
- Glosario §1.2, la prueba activa del corte (con `S-12`).
  `nucleo/01:76` «**de cada una de las cinco cuentas de la lista, que escribe el script del corte con la»

### Lote 1 H · `G8` sin el carril de extras (`R5-08`)

- `NUCLEO/04`, invariante 32.
  `nucleo/04:78` «la de migraciones sin el carril de extras, que no se reemplaza en el paso 6»

### Lote 1 J · sólo las cinco fichas; y `S-14` (la escritura `C` sigue)

- Glosario §1.2, fila `C`.
  `nucleo/01:60` «**cada ficha de la lista cerrada que fija el owner, una por cada una de las cinco cuentas de `DEC-MIG-007`»

### Lote 1 A · el paso de cobertura en las rutas de escritura (`R5-01`)

- Contrato §1, nota nueva.
  `D/12:40` «**En las rutas de escritura de las verticales, ese paso lo agrega `V5`** ✚»

### Lote 3 C · se retiran las puertas de borrado y restauración (`R5-17`)

- `NUCLEO/08` §3, debajo de *«ningún borrado de ficha sale de otra fila que `PB9` o `PB12`»*.
  `nucleo/08:259` «**Y las puertas que hoy borran por otro lado se retiran**»
- Ídem.
  `nucleo/08:261` «**desaparecen el borrado físico de fichas y de cuentas»
- Contrato §3.1, el borrado que no pasa por `PB9` ni por `PB12`.
  `D/12:999` «FASE 5 ese borrado tampoco queda** (owner 2026-09-30, lote»

### Lote 3 D · los plazos sin valor antes del merge de `V6` (`R5-19`)

- `NUCLEO/02` §1.5.
  `nucleo/02:190` «corte en `staging`~~ **antes del merge de `V6`**»

### Lote 4 B · el rol de socio (`R5-24`)

- `NUCLEO/08` §3, fila de la postulación de Partner: aprobar asigna el rol, el paso 3 pregunta
  por su familia, y no se quita (`V/17` §4.1).
  `nucleo/08:195` «**Aprobar asigna además el rol de socio**»

### Lote 4 C · salen `impersonate`, `set-role` y `USER_IMPERSONATE` (`R5-25`)

- `NUCLEO/08` §3, cita de *«entrar como»*.
  `nucleo/08:275` «2026-09-30, lote 4 C): `impersonate` y `set-role` del plugin `admin` de Better Auth»
- Ídem, el segundo camino para asignar roles.
  `nucleo/08:277` «Con `set-role` sale además un segundo camino para»

### Lote 4 E · `trial` y las tablas de sólo agregar sin `deleted_at` (`R5-29`)

- `NUCLEO/04`, invariante 2.
  `nucleo/04:45` «**Y nace sin `deleted_at`**, como toda tabla de sólo agregar»
- `NUCLEO/08` §1.3.
  `nucleo/08:76` «y nace sin `deleted_at`**»
- `NUCLEO/02` §2.6, fila `domain_event`.
  `nucleo/02:257` «append-only, **y sin `deleted_at`**»

### Simplificación del corte

- `S-40` (la lápida del corte) y `S-70` en lo que el núcleo decía: glosario §1.2, la comparación
  con la lápida, tachada.
  `nucleo/01:69` «(la lápida del corte salió: un cobro»
- `S-72` (las esperas del corte): `NUCLEO/02` §1.5 (b), tachado.
  `nucleo/02:207` «(el corte ya no tiene esperas: FASE 5, simplificación del corte, S-72)»
- Lote E (el log del §11): índice, `DEC-MIG-004` entera y los 📌 de `DEC-MIG-005` fuera de las
  fuentes.
  `nucleo/00:58` «reemplazó; y desde el 2026-09-30 (FASE 5, simplificación del corte, lote E) `DEC-MIG-004`»

### Otro

- Índice: las decisiones del log, recontadas con script (`DEC-METH-017`, `DEC-MIG-007`,
  `DEC-ARCH-015`).
  `nucleo/00:44` «**142** al 2026-09-30, con las tres de la FASE 5»

## 3. Lo que no se aplicó y por qué

- **Lote 1 C, D, E, F, G e I** (migraciones de datos del seed, `partners`, `service_suspended` y
  compañía, `is_featured`/`featured_by_entitlement`, `archive-abandoned-drafts`, los enums de la
  base): ninguno de mis archivos los nombra (`rg` sin hits: `is_featured|isFeatured`,
  `featured_by_entitlement`, `pgEnum|entity_type_enum`, `service_suspended|plan_restricted|…`,
  `archive-abandoned`). En F, la opción que agregaba una acción *«destacar»* a `NUCLEO/08` §3 no se
  eligió, así que el catálogo no cambia.
- **Lote 2 E** (variables de entorno): no aparecen en el núcleo ni en el contrato.
- **Lote 3 A y B** (el estado nuevo reemplaza `lifecycle_state`, `visibility`, `moderation_state`):
  ninguna de las tres columnas aparece en mis archivos. Lote 3 E y F (crons apagados, tres actos
  del paso 3): el núcleo no describe el paso 3 a ese nivel; es de `16-`.
- **Lote 4 A** (postulación propia de Partner) y **4 D** (`404` a ficha ajena `RESTRICTED`):
  `RESTRICTED` y `alliance_leads` no aparecen; la fila de la postulación en `NUCLEO/08` §3 ya
  remite a `V/18`. **Lote 5 F y 6 G**: son de `B/03` y de `V/17`/`V/02`.
- **Piezas `S-NN`** que no están en mis archivos (`rg` sin hits en `nucleo/` y `12-`): `L1`–`L8`,
  `origen_de_lápida`, detector del corte, Worker, `PAGO_TARDÍO_RECHAZADO`, manifiesto, recuentos,
  `DEC-MIG-002/003/006`. `S-14` es MANTENER: la fila `C` sigue; sólo se precisó su población por la
  J del lote 1.
- **Cómo absorbe `U2` la bitácora** (la misma tabla extendida o sus filas llevadas al outbox): los
  informes no lo dicen y el capítulo no lo necesita; queda para el diseño de `U2`, sin elegir.
- **Discrepancia en `10-decisiones-del-owner.md`, lote 3 C**: dice *«el borrado del dueño pasa a
  `PB9`»*, pero la opción elegida en `00-consolidado.md` (`R5-17`, opción 1) dice *«pasa a ser el
  del diseño»*, que es `PB12` (`NUCLEO/08` §1.3 paso 2 y el correo de `NUCLEO/07` §6); `PB9` es el
  borrado del día 180. Apliqué la opción tal como se le planteó al owner, sin nombrar la fila.
  `10-` es histórico y no se edita.

## 4. Para otro dueño

- **`V/02` (dueño de verticales), §2.2 y §5 (`trial`)**: agregar que `trial` nace sin
  `deleted_at` (lote 4 E), como ya dice `NUCLEO/04` invariante 2.
- **`V/20` §2, fila `G8`** (línea 56 según el consolidado): la lista de pendientes deja de cubrir
  `extras/` (lote 1 H), como ya dice `NUCLEO/04` invariante 32.
- **`V/descomposicion.md` y `B/descomposicion.md`**: `V6`, `V9`, `B4` y `B12` dependen de `U2`;
  `U2` es la unidad 24 y no suma a las doce dependencias entre épicas.
- **`16-fase-7-del-paraguas.md` §4.2 paso 3**: que la prueba del corte y los seudónimos los escribe
  el script después de la migración (lote 2 D), como ya dicen `NUCLEO/02` §1.4 y §1.5 y el glosario.
- **Quien aplique el lote 3 C en `V/03` §9 o en `V/descomposicion.md`**: el borrado del dueño es
  `PB12`, no `PB9` (§3 de este registro).

## 5. Vuelve al owner

### 5.1 ¿La tabla de claves también va como SQL generado?

`NUCLEO/02` §1.4 dice que *«la tabla de claves la escribe la migración desde el catálogo»*
(`nucleo/02:123`), y el catálogo de claves vive en código TypeScript (§1.2). Es el mismo problema
que el lote 2 D resolvió para el catálogo de producción (una migración es SQL y no puede llamar
TypeScript), pero la decisión habla de *«el catálogo»* del paso 3 y no nombra la tabla de claves,
que llega antes, con `V1`.

Ejemplo: `V1` agrega la clave que deja a Juan destacar su ficha. Si la migración no la escribe en
la tabla de claves, el panel no la puede asignar a ningún plan y el guard de la base la rechaza.

1. **El mismo mecanismo**: un script TypeScript genera el SQL de la tabla de claves desde el
   catálogo, se commitea, y el mismo guard lo regenera y compara. Costo: bajo, es la pieza que el
   lote 2 D ya pide construir. Riesgo: bajo. **Recomendada**: una sola forma para las dos cargas.
2. **SQL escrito a mano en cada migración que agrega una clave**, sin guard. Costo: nulo hoy.
   Riesgo: el catálogo en código y la tabla se separan en silencio, que es lo que `G3` vigilaba.
3. **La carga el seed `required`**. Costo bajo. Riesgo: contradice el lote 2 C (una sola fuente
   para las filas de referencia).

## 6. Conteos

- **Cambios aplicados: 25** (contados sobre las viñetas del §2 menos las de contexto y las citas
  repetidas de un mismo cambio): `07` 2, `08` 5, `02` 7, `01` 3, `04` 2, `00` 3, contrato 3.
- **Decisiones del log**: `rg -c '^### DEC-' $D/01-decision-log.md` → 143, menos la plantilla: 142.
- **markdownlint**: `npx markdownlint-cli2 <los siete archivos>` → 0 errores antes y 0 después.
- **Líneas tocadas**: `git diff --stat` sobre los siete archivos → contrato 18, `00` 10, `01` 20,
  `02` 30, `04` 4, `07` 21, `08` 25.
