---
title: "FASE 8 vuelta 3 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · A3 — datos, migración y acoplamiento

Ataqué el modelo de datos de verticales (`V/02` entero, `NUCLEO/02`), la migración de las dos
épicas (`V/21`, `B/21`), el procedimiento del corte y la limpieza del principio
(`16-fase-7-del-paraguas.md` §4.2 a §4.6), la retención y lo que cuelga de `listing`, lo legal
(`V/22`, la baja de cuenta de `NUCLEO/08` §1.3 y §3), la dirección inversa del contrato
(`12-contrato…` §4 y §4.1) y la ventana de la cuota (`V/15` §3 y §7). Contrasté contra el código
actual del worktree donde el diseño calla sobre algo que el código ya hace (esquema de
`accommodations` y el carril de extras). HEAD medido: `923b23586b`.

Son **9 hallazgos**: **0 CRITICA, 4 ALTA, 3 MEDIA y 2 BAJA**. La idea más grave: el corte escribe
cosas en un orden que el propio diseño hace imposible. La prueba gratis del corte se escribe antes
de que exista el catálogo que la define, y la tabla de traducción lee columnas que la limpieza del
principio ya borró del esquema. Además, el paso 6 barre el carril de extras, que es donde viven las
dos defensas de base del trial y de la postulación.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3A3-001 — La prueba gratis del corte se escribe antes de que exista su catálogo

**Qué se rompe.** El paso 3 del corte pone la prueba gratis activa de cada dueño `L8` dentro de la
migración estructural. Esa fila, según `V/21` §2.4, lleva el plan de trial derivado de la versión
vigente y vendible, las versiones vigentes al arrancar (el piso del trinquete) y un fin calculado
con los días de prueba de la vertical. Pero el catálogo de producción (verticales, planes de trial,
pre-trial, piso y vendibles con sus versiones) nace en el paso 3a, que corre **después** de la
migración estructural. En el momento en que se escribe la prueba no existe ninguna de las filas que
la definen. El diseño ya vio este problema para los plazos y lo arregló moviendo la versión 1 de
los plazos adentro de la migración estructural "antes que la escritura `C` y la prueba del corte".
Para el catálogo no hizo lo mismo. Hay dos salidas y dos implementadores eligen distinto: una FK
estricta hace fallar el paso 3 (aborto), o las referencias quedan anulables o como placeholder y la
fila nace sin plan, sin piso de trinquete y sin fin. Una prueba sin fin nunca dispara `T3`, así que
el dueño se queda con servicio gratis sin término.

**El camino.**

1. Juan tiene una ficha `L8` en Alojamiento el día del corte.
2. El paso 3 corre la migración estructural, que tiene que escribirle a Juan su fila de `trial`
   en `TRIAL_ACTIVE`.
3. En ese instante no hay ningún `plan` ni `plan_version` de Alojamiento. Los crea el 3a, que
   todavía no corrió.
4. Si el implementador puso FK, la migración falla y el corte entra en la rama de aborto, ya con
   los preapprovals del 1b cancelados. Si puso referencias nulas para que pase, la fila de Juan
   queda sin fin.
5. Juan nunca ve vencer su prueba, `PB2` nunca le baja la ficha y nunca contrata.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:137`
  — "y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:138`
  — "corren en el carril de datos del despliegue, después de la migración estructural y antes de que arranque el proceso nuevo"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:384`
  — "trial derivado de la versión vigente y vendible, las versiones vigentes al arrancar"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:389`
  — "en la migración estructural del paso 3, **una sola vez**, como la"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:303`
  — "estado del cap. 03 §2, referencia al plan de trial"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:164`
  — "antes que la escritura `C` y la prueba del corte, que la guardan, y el paso 3a sólo la verifica"

**Qué haría falta decidir o escribir.** Una de dos: la prueba del corte sale de la migración
estructural y pasa a un paso posterior al 3a (y antes del 3b, porque el grant del 3b convierte las
pruebas de las dos cuentas del owner), o el catálogo de producción entra a la migración estructural
como entraron los plazos. Y queda por fijar qué pasa con la fila de `trial` si el 3a no da las
validaciones del panel y el corte no sigue.

### F-8V3A3-002 — La limpieza del principio borra las columnas que la tabla de traducción lee

**Qué se rompe.** `U1` borra de la rama, al principio del programa, "todo lo que sólo el sistema
viejo usa", junto con el esquema de las tablas viejas y "las columnas que las copian". La migración
que genera ese borrado recién se aplica en el paso 3 del corte. En el código actual,
`owner_suspended` (la pausa con suspensión), `plan_restricted` (el excedente de un downgrade) y
`billing_unpublished_at` son columnas de `accommodations` que sólo escribe y lee el cobro viejo. Son
justo las columnas de `L5` y `L7` en la tabla de traducción de `V/21` §2.4. `B/21` §4 afirma que el
corte no necesita leer nada de eso, y su única salvaguarda ("corre antes de retirarlas") no se puede
cumplir por orden de migraciones: la de `U1` se genera meses antes que la de `V6` y se aplica
primero. Sin esas columnas, `L7` es indistinguible de `L8`. Una ficha que el sistema viejo tenía
fuera del sitio por una pausa con suspensión o por pasarse del cupo nace `PUBLISHED`, y su dueño
recibe una prueba gratis que el diseño le reserva a quien tenía la ficha a la vista.

**El camino.**

1. Juan pausó su suscripción con suspensión en el sistema viejo. Sus dos alojamientos quedan
   `ACTIVE` + `PUBLIC` con `owner_suspended = true`, fuera del sitio.
2. `U1` saca `owner_suspended` y `plan_restricted` del esquema porque sólo los usa el cobro viejo.
   El guard de drift exige commitear la migración que los borra.
3. En el paso 3 esa migración corre antes que la de clasificación de `V6`. O la clasificación
   falla por columna inexistente, o `V6` (que ya no ve las columnas en el esquema) clasifica sólo
   con `lifecycle_state` y `visibility`.
4. Los dos alojamientos de Juan caen en `L8`: nacen `PUBLISHED` y Juan recibe la prueba del corte.
5. Juan, que tenía el servicio suspendido, amanece con dos fichas publicadas y cobertura gratis. El
   recuento del paso 0 de dueños con más de una `L8` "no es gate", así que el corte sigue.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:508`
  — "sus crons, su adaptador y todo lo que sólo el"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:510`
  — "esquema de las tablas viejas de billing, cuyo borrado genera la migración que las saca de la base en"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:414`
  — "Las tablas viejas de billing, con todo lo que tengan adentro, y las columnas que las copian"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:425`
  — "no siembra trials consumidos, que era lo único que las leía."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:227`
  — "`ACTIVE` + `PUBLIC` y (`owner_suspended` o `plan_restricted`)"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:228`
  — "`ACTIVE` + `PUBLIC`, sin ninguna de las dos marcas"
- `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:106` (código actual)
  — "paused WITH service suspension. Public reads filter it out and the"
- `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:112` (código actual)
  — "remediation flow (host exceeded their new plan's MAX_ACCOMMODATIONS cap)."

**Qué haría falta decidir o escribir.** Qué columnas de `accommodations` sobreviven a `U1` hasta el
corte (como mínimo `lifecycle_state`, `visibility`, `deleted_at`, `billing_unpublished_at`,
`owner_suspended` y `plan_restricted`), quién las borra después del paso 3 y en qué orden va la
migración que las borra respecto de la de clasificación. También hay que corregir la frase de
`B/21` §4 de que el corte no lee nada del cobro viejo.

### F-8V3A3-003 — El paso 6 barre el carril de extras y las filas que escriben las migraciones

**Qué se rompe.** El paso 6 reemplaza `packages/db/src/migrations/**` entero por "una sola
migración de partida, generada de la base de producción ya cortada". El carril de extras vive
adentro de ese árbol (`packages/db/src/migrations/extras/`), y ahí el diseño pone las dos defensas
de base que no se pueden expresar en Drizzle: el trigger que rechaza todo `DELETE` sobre `trial`
(invariante 2) y el trigger que rechaza una postulación durante la espera. En el código actual ahí
viven además la vista materializada del buscador y el trigger de `updated_at`. "Generada de la base"
admite dos lecturas: una generación de Drizzle, que no ve triggers, funciones ni vistas
materializadas, o un volcado de esquema, que sí los ve. Tampoco dice si incluye las filas que
escriben las migraciones: la tabla de claves que "escribe la migración desde el catálogo", la
versión 1 de los plazos y el espejo de verticales. Producción conserva los objetos porque el paso
6 no corre nada. Pero toda base que se arme después desde el repositorio (un `staging` rehecho, la
plantilla de worktrees, la base de CI, una recuperación sin backup) nace sin el trigger del trial,
y nada lo detecta, porque ningún guard mira triggers.

**El camino.**

1. Pasa el corte y se corre el paso 6 con `drizzle-kit`: la migración de partida tiene tablas y
   columnas, y el directorio de extras queda vacío.
2. Meses después se rehace `staging` desde el repositorio: migración de partida, `db:apply-extras`
   (que no encuentra nada) y seed.
3. En esa base, un camino de código que borra la fila de `trial` de Juan pasa sin error, porque
   no existe el trigger que lo rechazaría.
4. Juan se registra otra vez con el mismo correo y estrena un segundo trial. El test de
   integración que prueba el invariante contra esa base da verde, porque ahí la restricción nunca
   existió.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:145`
  — "pasa a ser **una sola migración de partida**, generada de la base de producción ya cortada"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:907`
  — "rechaza con un trigger que rechaza todo `DELETE` sobre `trial`**, en el carril de extras"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:908`
  — "(`packages/db/src/migrations/extras/`): ningún camino legítimo borra esa fila, porque el borrado"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:581`
  — "y un trigger del carril de extras que rechaza la inserción"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:110`
  — "la tabla de claves la escribe la migración desde el catálogo, y toda asignación apunta a ella por FK"

El silencio: `rg -n "extras" .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`
devuelve cero líneas. El procedimiento del corte no nombra el carril de extras en ningún paso.

**Qué haría falta decidir o escribir.** Si el paso 6 deja afuera `migrations/extras/` o lo
consolida. Cómo se genera la migración de partida (y si lleva triggers, funciones y vistas
materializadas). Y qué filas de referencia lleva: tabla de claves, versión 1 de los plazos y
verticales.

### F-8V3A3-004 — Un trigger del código actual borra los favoritos que el diseño conserva

**Qué se rompe.** `V/02` §4.1 decide que en `PURGED` los favoritos de un turista se conservan, y
justifica que nada cae por arrastre porque `PURGED` no hace `DELETE` de la fila. Pero el carril de
extras del código actual tiene un trigger `AFTER UPDATE` sobre `accommodations` que borra de
`user_bookmarks` todos los favoritos de una ficha cuando su `deleted_at` pasa de nulo a no nulo.
Eso es un soft delete, no un `DELETE`. El diseño no dice si llegar a `PURGED` escribe `deleted_at`,
y la tabla de traducción equipara las dos cosas: toda ficha con `deleted_at` no nulo nace `PURGED`.
El borrado de ficha que existe hoy es un soft delete, así que un implementador que construya
`PB12` o `PB9` sobre él le borra los favoritos a terceros. `G-R9` mira FK y `entity_type`, no
triggers, así que nada lo detecta.

**El camino.**

1. Ana, turista, tiene guardado como favorito el alojamiento de Juan.
2. Juan borra su ficha. `PB12` la lleva a `PURGED` y el implementador, siguiendo la equivalencia
   `deleted_at` ↔ `PURGED` de la tabla de traducción, también escribe `deleted_at`.
3. El trigger `trg_softdelete_bookmarks_on_accommodations` borra la fila de Ana en
   `user_bookmarks`.
4. Ana pierde el favorito que el diseño le prometía conservar ("para él la ficha no existe").
   Nadie se entera: ni `G-R9` ni ningún test de la lista cerrada miran triggers.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:732`
  — "**se conservan**: para él la ficha no existe (cap. 17 §1.2, precisión 7), y la superficie la trata así"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:708`
  — "el borrado es del contenido, no un `DELETE` de `listing`, así que ningún `ON DELETE CASCADE` corre"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:221`
  — "**`PURGED`, con el contenido borrado** como en `PB12` (`G1-2`)"
- `packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql:23` (código actual)
  — "Handles both AFTER DELETE (hard-delete) and AFTER UPDATE (soft-delete)."
- `packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql:56` (código actual)
  — "Soft delete: only act when deleted_at transitions NULL → non-NULL."

El silencio: `rg -n "deleted_at|bookmark|trigger"` sobre las tres carpetas de alcance, el contrato
y el `16-` sólo encuentra la clase `L1`, el trigger de `trial` y el de postulación. Ningún capítulo
nombra este trigger ni dice si `PURGED` escribe `deleted_at`.

**Qué haría falta decidir o escribir.** Si llegar a `PURGED` escribe `deleted_at` o no. Y en
cualquier caso, qué se hace con este trigger: sacarlo, acotarlo o sumarlo a la lista cerrada de
`V/02` §4.1 como un escritor más sobre `user_bookmarks`, con su guard.

## MEDIA

### F-8V3A3-005 — Una clave medida de scope global no sabe en qué ventana contar

**Qué se rompe.** `V/15` §3.2 deja que toda clave de entitlement y de limit declare scope global,
que se resuelve por `user`. La ventana de la cuota, `cuota_ventana`, está atada a una vertical
(`UNIQUE(user_id, vertical, clave, abre)`, a lo sumo una abierta por `(user, vertical, clave)`) y
toma el ancla del título que da la cuota. Para una clave medida global que otorgan dos planes de
dos verticales, el diseño no dice qué vertical lleva la fila ni qué título ancla. Si cada vertical
abre su ventana, cada una se controla contra el cupo agregado del conjunto efectivo, y el consumo
se parte en dos filas que no se ven entre sí.

**El camino.**

1. Juan tiene un plan de Alojamiento y uno de Gastronomía, y cada uno le otorga 100 consultas de
   una clave medida declarada global.
2. El conjunto efectivo de Juan resuelve un cupo global (por `user`) según la estrategia de la
   clave.
3. Juan consume desde Alojamiento: se abre la ventana `(Juan, ALOJAMIENTO, clave)` y la compara
   contra ese cupo. Consume desde Gastronomía: se abre `(Juan, GASTRONOMÍA, clave)`, que arranca
   en cero.
4. Juan gasta dos veces el cupo por mes, o, si el implementador eligió otra vertical, gasta menos
   de lo que pagó.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:244`
  — "Cada clave de entitlement y de limit declara su scope en el catálogo: de vertical, o global."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:304`
  — "a lo sumo una abierta por `(user, vertical, clave)`"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:548`
  — "cupo se resuelve en cada consumo contra el conjunto efectivo (§2), y por eso la regla 5 sale sola,"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:519`
  — "Con más de un título vivo, ancla el que da la cuota; si dos la dan, el que"

El silencio: `rg -n -i "global"` sobre el alcance, filtrado por `medid|cuota|ventana`, no devuelve
ninguna línea de verticales. No hay regla para una clave medida global.

**Qué haría falta decidir o escribir.** Si una clave medida puede ser global. Si puede, cómo se
guarda su ventana: una fila por `user` sin vertical, con qué ancla entre títulos de verticales
distintas y cómo se acomoda la `UNIQUE`.

### F-8V3A3-006 — La baja de cuenta decide la pregunta legal 5 y deja el correo de la postulación en claro

**Qué se rompe.** `V/22` deja abierta la pregunta 5 (si se puede conservar el seudónimo del correo
después de un pedido de supresión) y escribe que, si la respuesta es no, hay que poder borrarlo.
Mientras tanto, la acción 24 que soporte ya ejecuta desde el corte seudonimiza sólo nombre, correo y
teléfono de la fila de `user`, y declara que la fila de `trial` sigue con su seudónimo "así que la
traba contra repetir la prueba sigue". O sea: la baja ya contesta que sí antes de que conteste el
abogado. Además, `postulacion` guarda "el correo que se escribió en el formulario" en claro, y
ningún capítulo le pone retención ni lo alcanza con la baja. Soporte tiene que adivinar qué hacer
con esas dos filas.

**El camino.**

1. Juan, partner, fue postulado y aprobado. Tiene fila de `postulacion` con su correo en claro y
   una fila de `trial` con su seudónimo.
2. Juan pide la supresión de sus datos. Soporte ejecuta los tres pasos de `NUCLEO/08` §1.3.
3. La acción 24 reemplaza nombre, correo y teléfono en `user`. La fila de `trial` conserva el
   seudónimo y `postulacion` conserva el correo tal cual.
4. Si el abogado contesta que no a la pregunta 5, no existe el escritor que borra el seudónimo, y
   el correo de la postulación nunca estuvo en ninguna lista de lo que se borra.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:106`
  — "un pedido de supresión, con la única finalidad de no otorgar un segundo trial gratuito?"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:115`
  — "hay que poder borrar el seudónimo de una fila que hoy se"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:203`
  — "Su nombre, su correo y su teléfono se reemplazan, sus sesiones se cierran y queda sin acceso."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:413`
  — "`trial` sigue apuntándola, así que esta FK no cambia y la traba contra repetir la prueba sigue"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:581`
  — "el correo que se escribió en el formulario, el estado de `03` §11"

El silencio: `rg -n -i "postulaci.*(retenci|borr|anonim|seudonim)"` (y su inverso) sobre `V` y el
núcleo no devuelve nada. La postulación no tiene retención ni entra en la baja.

**Qué haría falta decidir o escribir.** Si la acción 24 conserva el seudónimo mientras la pregunta
5 está abierta, y quién lo borra si la respuesta llega en contra. Y qué hace la baja con
`postulacion.correo`: seudonimizarlo, borrarlo o conservarlo con finalidad declarada.

### F-8V3A3-007 — La lista cerrada de `PURGED` apunta a tablas que el corte borra y omite una propia

**Qué se rompe.** La última fila de la lista cerrada de `V/02` §4.1 dice que `entity_subscriptions`
y `featured_listing_addon_grants` "son de billing, y los trata `A6`". Pero `B/21` §4 las borra en el
paso 3 del corte junto con todo el cobro viejo, y `A6` actúa sobre `addon_instance`, que no figura
en la lista. Al mismo tiempo, la tabla nueva del propio diseño que cuelga de una ficha,
`pedido_de_arreglo` (la ficha, el motivo, la fecha sugerida y el aviso del dueño), no tiene fila.
`G-R9` va a fallar el día que alguien la cree y va a obligar a decidir en el momento, sin criterio
escrito, si el motivo del admin y el aviso del dueño se conservan o se borran.

**El camino.**

1. La unidad que construye la moderación en dos niveles crea `pedido_de_arreglo` con FK a la
   ficha.
2. `G-R9` falla porque la tabla no está en la lista cerrada.
3. El implementador la agrega eligiendo solo. Un pedido abierto sobre la ficha de Juan que llega a
   `PURGED` o se borra (y con él lo que Juan contestó) o queda vivo sobre una ficha que no existe.
4. Mientras tanto, la lista sigue diciendo que `A6` trata dos tablas que no existen desde el
   corte.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:736`
  — "el vínculo de un addon y el caché de suscripción son de billing, y los trata `A6` (`B/03` §8)"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:418`
  — "destaque, `entity_subscriptions`, **`partner_subscriptions`** (FASE 9 vuelta 1, `F-8V1C2-014`) y"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:431`
  — "la ficha, **el motivo**, una fecha sugerida (anulable), **si el dueño avisó que corrigió**"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:739`
  — "la columna de tablas nombra hoy las 40, una por una"

El silencio: `rg -n "pedido_de_arreglo" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md`
sólo devuelve la línea 431, la de su definición. No aparece en la lista cerrada.

**Qué haría falta decidir o escribir.** Qué le pasa a `pedido_de_arreglo` en `PURGED`. Qué tablas
del modelo nuevo (`addon_instance` con objetivo `LISTING`, el registro de eventos) entran a la
lista en lugar de las dos que el corte borra.

## BAJA

### F-8V3A3-008 — `V/02` §2.2 sigue diciendo que el corte no escribe filas de `trial`

**Qué se rompe.** La fila de `trial` del modelo de datos dice que el corte no escribe ninguna y que
los dueños viejos arrancan en `PRE_TRIAL` sin fila. Desde C12, `V/21` §2.4 hace que la migración del
corte le escriba una fila `TRIAL_ACTIVE` a cada dueño con una `L8`. La misma línea sigue contando a
`T7` entre los escritores, y `T7` salió.

**El camino.**

1. Un implementador de `V4` arma la lista de escritores de `trial` desde `V/02` §2.2.
2. No incluye la escritura del corte y le rechaza a `V6` la prueba del corte, o espera un `T7`
   que no existe.
3. Juan, dueño `L8`, amanece sin prueba y con la ficha publicada sin cobertura hasta la primera
   corrida del reconciliador.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:303`
  — "**El corte no escribe ninguna** (owner 2026-09-25; FASE 9 completa, decisión 2g)"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:381`
  — "ficha `L8` una fila de `trial` en `TRIAL_ACTIVE`, que arranca en el instante del corte.**"

**Qué haría falta decidir o escribir.** Alinear la fila de `trial` de `V/02` §2.2 con C12 y sacar
`T7` de sus escritores.

### F-8V3A3-009 — `V/22` promete seis preguntas legales y tiene una

**Qué se rompe.** El capítulo declara que la consulta legal queda sólo por el seudónimo del correo,
pero su cierre sigue hablando de "las seis preguntas". Quien arme el pliego para el abogado no sabe
si faltan cinco.

**El camino.**

1. Juan, abogado, recibe el pliego armado desde `V/22`.
2. Lee que quedan seis preguntas abiertas y encuentra una sola en la tabla del §4.
3. Pide las otras cinco y la consulta se demora.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:131`
  — "**Las seis preguntas**, por definición."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:39`
  — "medido. **La consulta legal queda sólo por el seudónimo del correo** (§3.3, pregunta 5). Lo que"

**Qué haría falta decidir o escribir.** Corregir el conteo del cierre y del título del §2.

## Ataques que intenté y el diseño resistió

- **Dos cuentas del corte con el mismo seudónimo en la misma vertical**: el paso 2 lo cuenta antes
  del 1a y del paso 3 y exige cero (`16-` §4.2), así que la `UNIQUE` no tira la migración a mitad.
- **El reloj de las fichas viejas con su `created_at`**: la escritura `C` pone el instante del
  corte y el aborto no la cuenta (`V/21` §2.4), así que no hay borrado masivo en la primera corrida.
- **La baja de cuenta choca con `trial.user_id ON DELETE RESTRICT`**: la acción 24 seudonimiza y no
  borra, y los datos de facturación quedan copiados en cada `receipt` (`NUCLEO/08` §3).
- **Carrera al abrir la ventana de la cuota**: las dos aperturas calculan el mismo `abre` desde el
  ancla y la `UNIQUE(user_id, vertical, clave, abre)` rechaza la segunda.
- **Billing leyendo tablas de verticales para el cambio de plan**: el veredicto
  `direcciónDeCambio` lo emite verticales, y `ficha`/`admiteDestaque` cubren lo que necesita `A1`
  (`12-contrato…` §4.1).
- **Fichas de Gastronomía o Experiencia sin regla de traducción**: el recuento antes del 1a y en el
  paso 2 detiene el corte si aparece una (`V/21` §2.4, `16-` §4.2).

## Fuera de mi vector

- **Partner con presencia y sin suscripción vieja el día del corte**: no entra en la población a
  avisar (ficha no `L1` o suscripción viva) y su página pasa a 404 sin aviso. Vale medirlo para el
  vector de corte y comunicación.
- **Una ficha `MODERATED` bloquea la baja de cuenta**: `PB12` no corre desde `MODERATED` y la
  acción 24 exige toda ficha en `PURGED`. Le toca al vector de autorización y moderación.

## Key Learnings

1. Todo lo que el corte escribe en la migración estructural hay que chequearlo contra lo que nace
   en el 3a. Los plazos se movieron por esa razón y el catálogo quedó del lado equivocado.
2. "Borrar todo lo que sólo usa el sistema viejo" al principio del programa choca con cualquier
   lectura del corte sobre columnas viejas. Drizzle aplica la migración de `U1` antes que la de
   `V6`.
3. Reemplazar `packages/db/src/migrations/**` se lleva también el carril de extras, que es donde
   el diseño guarda las restricciones que Drizzle no puede expresar.
4. Una lista cerrada que se vigila por FK y `entity_type` no ve los triggers del carril de extras,
   que pueden borrar filas de terceros por un soft delete.
