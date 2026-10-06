---
title: "FASE 9 vuelta 3 · aplicación — verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: grupo V, verticales

Aplicación, en `$V/spec.md`, `$V/descomposicion.md` y `$V/docs/*`, de las decisiones de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y de la escritura sin decisión de
[`00-hallazgos.md`](./00-hallazgos.md) que cae en esos archivos. Medido en el worktree
`hospeda-spec-hos-1352-billing-redesign`. Donde el grupo N ya había escrito su lado (contrato §4.1,
§6.3 y §7.1; `NUCLEO/08` §3), este lado se alineó a lo que dice N y no al revés.

## 1. Qué se aplicó

### Lote A (R1, `F-8V3A1-001` y `F-8V3A1-002`): el reclamo de Partner

- `V/18` §2.4, regla 2: el reclamo que verifica cierra sesiones y credenciales previas.
  `V/18:272`: «credenciales previas (FASE 9 vuelta 3, owner 2026-09-30, lote A; `F-8V3A1-001`): queda viva»
- La capacidad es la misma con que la acción 24 borra credenciales, que N ya escribió.
  `V/18:276`: «cuenta borra las credenciales (`NUCLEO/08` §3, acción 24). La cuenta podía ser»
- `V/18` §2.4, regla 4 nueva: escritura sólo sobre `owner_user_id` nulo y link de un solo uso.
  `V/18:285`: «4. El reclamo escribe `owner_user_id` sólo si está nulo, y el link de reclamo es de un solo»
- La frase de las tres reglas pasa a cinco.
  `V/18:262`: «correo y se lo llevaba. ~~Tres~~ Cinco reglas lo cierran (las dos últimas, FASE 9 vuelta 3, owner»
- `V/02` §2.7, fila `partner`: la escritura condicional.
  `V/02:593`: «Y el reclamo lo escribe sólo si está nulo»
- `V/19` §4, fila 32 nueva: la pantalla del link ya usado.
  `V/19:79`: «al abrir un link de reclamo de un Partner que ya tiene dueño»

### Lote B (R1, `F-8V3A2-002`): una cuenta, un Partner

- `V/18` §2.4, regla 5 nueva.
  `V/18:292`: «5. Una cuenta, un Partner (FASE 9 vuelta 3, owner 2026-09-30, lote B; `F-8V3A2-002`). La base»
- `V/02` §2.7: la unicidad parcial sobre `owner_user_id`.
  `V/02:593`: «`UNIQUE(owner_user_id)` donde `owner_user_id` no es nulo»
- `V/18` §1.4: la sola presencia por suscripción ahora la garantiza la base.
  `V/18:76`: «presencia por suscripción, ese scope la identifica sin ambigüedad. Y ahora lo garantiza la»
- `V/19` §4, fila 33 nueva: la pantalla del segundo reclamo.
  `V/19:80`: «al reclamar un segundo Partner desde una cuenta que ya es dueña de uno»

### Lotes I y M (R13, `F-8V3A1-005`) y la otra mitad de R13 (`F-8V3A1-003`)

- `V/17` §1.2, paso 1: `PP1` como segunda excepción del guest.
  `V/17:71`: «y en `PP1`, postular un Partner, que es la segunda excepción»
- `V/17` §1.2, precisión 9 nueva, con el captcha y la guarda de `PP1`.
  `V/17:236`: «9. Postular un Partner (`PP1`) es la segunda excepción del guest en el paso 1 (FASE 9 vuelta»
- `V/17` §3.3, fila del visitante sin cuenta.
  `V/17:479`: «y en `PP1`, postular un Partner (§1.2, precisión 9; FASE 9 vuelta 3, owner 2026-09-30, lotes I y M)»
- `V/03` §11, fila `PP1`.
  `V/03:1314`: ««Alguien» puede no tener cuenta»
- `F-8V3A1-003`: conversaciones, reseñas y comentarios, de quien los escribe, con la respuesta
  sobre una ficha no pública y sin exención por superficie (`V/17` §1.2, precisión 7).
  `V/17:211`: «Las conversaciones, las reseñas y los comentarios no son escritura sobre la ficha: son de»
- El resumen de `$V/spec.md`.
  `$V/spec.md:187`: «Las conversaciones, las reseñas y los comentarios son de quien los escribe»

### Lote O (R22, `F-8V3A2-003`): `PB13` en la cola

- `V/03` §9, fila `PB13`.
  `V/03:495`: «la ficha entra a la misma cola ordenada que `PB3` y `PB7`, junto con las publicadas del dueño en la vertical»
- `V/03` §9, el apartado de cuáles vuelven.
  `V/03:934`: «La ficha que vuelve de la moderación por `PB13` entra a esta misma cola, y recupera su lugar si»

### Lote H (R10, `F-8V3A3-006`) y `F-8V3A1-004`: la baja de cuenta

- `V/02` §2.2: el seudónimo se conserva hasta la pregunta 5, y la tarea puntual si es en contra.
  `V/02:422`: «El seudónimo de esa fila se conserva hasta que el abogado conteste la pregunta 5»
- `V/02` §4.1, fila de lo que se conserva.
  `V/02:721`: «tras la baja de la cuenta, el seudónimo se conserva hasta que conteste el abogado»
- `V/22` §3.3: quién es el escritor nuevo.
  `V/22:118`: «El escritor nuevo es una tarea puntual de soporte que los borra todos, y se anota quién»
- `postulacion.correo` (`F-8V3A3-006`), alineado a la acción 24 que escribió N.
  `V/02:592`: «El correo es un dato personal que la baja de cuenta alcanza»
- La cuenta sin acceso (`F-8V3A1-004`), alineado a N: `user.deleted_at` leído por el paso 1.
  `V/17:71`: «Una cuenta dada de baja no es un actor autenticado»
- El mismo dato en `V/02` §2.2.
  `V/02:419`: «con dato: la baja escribe `user.deleted_at`, que el paso 1 de la cadena lee»

### Lotes C y N (R2 y R3) en `V/21` §2.4

- Lote C: la prueba del corte después del catálogo, los dos en la migración estructural.
  `V/21:401`: «escritura `C` de `inactiva_desde` (`NUCLEO/01` §1.2). Y después de cargar el catálogo de»
- Lote N: las tres columnas sobreviven a `U1` y las borra una migración posterior a la
  clasificación.
  `V/21:219`: «Y las tres columnas que la tabla lee sobreviven a la limpieza del principio hasta el corte»
- La fila de `V2` en `$V/descomposicion.md` §2.11: la migración del catálogo pasa al paso 3.
  `$V/descomposicion.md:487`: «dentro de la migración estructural del paso 3, antes de la prueba del corte; el 3a sólo la verifica»

### R5 (`F-8V3C1-002`, `F-8V3D1-001`): `G13` con las seis respuestas

- `V/20` §2, fila `G13`: las seis, con la misma cifra que el contrato §6.3 que escribió N.
  `V/20:57`: «Son las seis respuestas de arranque que contestan por billing»
- `$V/spec.md`, tabla de guards.
  `$V/spec.md:407`: «un build destinado a producción importa una de las seis respuestas de arranque»

### R11 (`F-8V3A2-004`, `F-8V3A3-007`) y R15 (`F-8V3A3-004`): la lista de `PURGED`

- `V/02` §4.1: fila nueva de `pedido_de_arreglo`, que se cierra sin correo y se conserva.
  `V/02:744`: «se cierra en el mismo acto, sin correo, y la fila se conserva como registro de la moderación»
- `V/02` §2.5: quién lo cierra.
  `V/02:442`: «y lo cierra también, en el mismo acto y sin correo, la llegada de la ficha a `PURGED`»
- `V/02` §4.1, última fila: `addon_instance` en lugar de las dos tablas del cobro viejo.
  `V/02:748`: «la instancia de un addon de alcance `LISTING` es de billing, y la trata `A6`»
- `V/02` §4.1: el recuento de la columna de tablas.
  `V/02:752`: «(38 del código actual que sobreviven a la»
- R15: `PURGED` no escribe `deleted_at`, y el trigger de favoritos queda sin disparador.
  `V/02:743`: «Y llegar a `PURGED` no escribe `deleted_at`»
- `V/20` §2, fila `G-R9`.
  `V/20:71`: «y la lista nombra 40: esas 38 y las dos del modelo nuevo»

### R19 (`F-8V3C1-003`): la clave de canje

- `V/02` §2.2: tabla nueva `canje_de_trial`, alineada al contrato §4.1 de N (guarda sólo el
  canje aplicado).
  `V/02:310`: «`canje_de_trial` ✚ (FASE 9 vuelta 3, `F-8V3C1-003`)»
- `V/03` §2, fila `T4`.
  `V/03:55`: «y guarda la clave de canje en `canje_de_trial` cuando aplica la extensión»

### R23 (`F-8V3A2-005`): los borrados remotos de `PB9` y `PB12`

- `V/02` §4.1: después del commit, filas marcadas pendientes y una corrida diaria que reintenta.
  `V/02:757`: «Los dos borrados remotos van después del commit, y la fila los recuerda hasta que se»
- `V/03` §9, fila `PB9` (y `PB12` por remisión).
  `V/03:491`: «Los dos borrados remotos, el de las fotos en el almacenamiento externo y el del token, van después del commit»

### R24 (`F-8V3A2-006`): el hecho 5 y el lock

- `V/03` §9, ⚠️ del reconciliador: la frase corregida y el punto 5, abierto.
  `V/03:1229`: «dos pueden adelantar un borrado: el punto 1, con un»
- El punto 5.
  `V/03:1282`: «5. El hecho 5 de una ficha no publicada llega con el recálculo, y `PB9` puede correr antes»

### R25 (`F-8V3A3-005`): la ventana de una clave global

- `V/15` §3.2: una clave medida es siempre de vertical.
  `V/15:258`: «Una clave medida es siempre de vertical (FASE 9 vuelta 3, `F-8V3A3-005`). Su ventana»
- `V/02` §2.2, fila `cuota_ventana`.
  `V/02:311`: «La clave medida es siempre de vertical»

### R29 (`F-8V3C1-007`) lado verticales

- `V/02` §2.1: re-apuntar `addon_product.version_id` es de billing, alineado a `NUCLEO/08` §3.
  `V/02:89`: «Y quien lo re-apunta es billing, no»

### R20 (`F-8V3C1-005`, `F-8V3C1-006`, `F-8V3C1-008`) lado verticales

- `$V/descomposicion.md`, fila `V1`, alineada al contrato §7.1 de N.
  `$V/descomposicion.md:54`: «`V1` escribe las interfaces, las validaciones y los simuladores de todas las entradas, las de ida y las de la dirección inversa»
- Fila `V4`: la duodécima dependencia entre épicas.
  `$V/descomposicion.md:57`: «y lee la hora por la interfaz del reloj del package del contrato, que escribe `B1`»
- §3: la cuenta de dependencias.
  `$V/descomposicion.md:535`: «que son doce desde la FASE 9 vuelta 3 por otra razón»

### R21 (`F-8V3A1-006`) lado verticales

- `V/17` §3.2 regla 1: ⚠️ con las dos lecturas, sin elegir (N lo deja abierto en `NUCLEO/08` §3).
  `V/17:382`: ««De `SUPER_ADMIN`» es un rol, y el paso 3 pregunta por permiso»

### R12 en los archivos de V

- `F-8V3A2-007`: los seis hechos de `V/02` §2.5 pasan a cinco.
  `V/02:474`: «Cada uno de los ~~cuatro~~ ~~cinco~~ ~~seis~~ cinco del cap. 01 §1.2»
- `F-8V3A2-008`: `MODERATED` sale también por `PB13` (`V/03` §9 y `V/11` §2.1).
  `V/03:1147`: «~~`PB11`~~ `PB11` o `PB13` (FASE 9 vuelta 3, `F-8V3A2-008`)»
- `F-8V3A2-008` en el trial.
  `V/11:82`: «a donde estaba: a `DRAFT`»
- `F-8V3A2-008`: `T1` ya no exige que la vertical admita altas.
  `V/03:292`: «la condición de que la vertical admita altas salió con la»
- `F-8V3A3-008`: el corte sí escribe filas de `trial`, y `T7` sale de los escritores.
  `V/02:309`: «Desde C12 el corte sí escribe una, la de arriba»
- `F-8V3A3-009`: `V/22` tiene una pregunta, no seis.
  `V/22:134`: «La pregunta 5, la única que queda»
- `F-8V3A3-009`: el título del §2.
  `V/22:33`: «~~Las tres preguntas legales~~ La pregunta legal que queda»
- `F-8V3D1-004`: `V/17` §3.4 cuenta veintidós.
  `V/17:533`: «~~veintiuna~~ veintidós acciones administrativas»
- `F-8V3D1-004`: `V/17` §3.5 cuenta 24 y nombra la 25.
  `V/17:580`: «la 25, vaciar la presencia de un Partner a pedido de su dueño: verificación corta, 2026-09-29, lote N-G»
- `F-8V3D1-005`: la fila de `V6` con trece transiciones.
  `$V/descomposicion.md:59`: «trece transiciones, de `PB1` a `PB13`»
- `F-8V3D1-007`: la cita a `V/02` §2.4 dentro de V (tres lugares; los de `NUCLEO/08` y `B/02` son
  de otros grupos).
  `V/02:833`: «§2.2: FASE 9 vuelta 3, `F-8V3D1-007`»

### Unidades

- `$V/descomposicion.md` §2.12 nuevo, con unidad y criterio para todo lo agregado.
  `$V/descomposicion.md:490`: «2.12 Lo que la FASE 9 vuelta 3 agregó, y qué unidad lo construye»

## 2. Lo que no se aplicó y por qué

- **R24 (`F-8V3A2-006`) queda abierto**: ninguna de las dos salidas del racimo lo cierra desde
  verticales sola (§6, pregunta 2). Se corrigió el ⚠️ y se declaró el punto 5 como abierto, no
  como residuo aceptado, porque borra datos.
- **R21 (`F-8V3A1-006`) queda abierto** en V, alineado con N, que lo deja como pregunta en
  `NUCLEO/08` §3 (§6, pregunta 1).
- **`F-8V3D1-006`** (seis hechos en `B/03` §7.1 y `B/descomposicion.md`): no tiene espejo vivo en V;
  el único de V era `V/02` §2.5, aplicado como `F-8V3A2-007`.
- **`F-8V3D1-007`** en `NUCLEO/08` §3 y `B/02`: no son archivos de V. N ya lo corrigió en
  `NUCLEO/08` §3; en `B/02` no quedan citas vivas a `V/02` §2.4 (medido con `rg`).
- **La fila de `G8`/`G16` en `V/20` (lote N)**: no cambia. `G8` busca una palabra que ninguna de
  las tres columnas tiene, y `G16` no está en `V/20` (es de `B/20`). Se dijo en `V/21` §2.4.
- **R29 y R20, la parte que no es de V** (el acto de billing, la entrada del §4.1, la fila de
  `NUCLEO/08` §3, el contrato §7.1): ya las escribieron N y B; V se alineó.
- **`F-8V3A2-008`, el renglón del 3b** en `16-fase-7…` §4.2: es de N, y ya está corregido.

## 3. Conteos recontados

| lista | viejo → nuevo | comando | espejos actualizados |
|---|---|---|---|
| reglas del reclamo, `V/18` §2.4 | 3 → 5 | lectura de la lista numerada | `V/18` §2.4 |
| precisiones del paso 4, `V/17` §1.2 | 8 → 9 | lectura de la lista numerada | `V/17` §1.2, `$V/spec.md` |
| acciones administrativas, `V/17` §3.4 (capacidad del actor) | 21 → 22 | `python3` que quita tachados y busca `veintiun` | `V/17` §3.4, dos lugares |
| acciones administrativas, `V/17` §3.5 | 23 → 24 | ídem | `V/17` §3.5 |
| transiciones de publicación, fila `V6` | 12 → 13 (sin cambio en la máquina) | `V/03` §9 ya decía trece | `$V/descomposicion.md` §2 |
| tablas de la lista cerrada de `PURGED`, `V/02` §4.1 | 40 → 40 (salen 2, entran 2) | `python3` sobre la cuarta columna, sin tachados: 40 nombres, 40 distintos | `V/02` §4.1, `V/20` §2 (`G-R9`) |
| filas de `V/19` §4 | 31 → 33 | lectura de la tabla | ningún espejo con cifra (medido con `rg`) |
| respuestas de arranque que vigila `G13` | 4 → 6 | contrato §6.3 dice seis | `V/20` §2, `$V/spec.md` |
| dependencias entre épicas | 11 → 12 (lo cambió N) | `16-fase-7…` §4.6 | `$V/descomposicion.md` §3 |
| tablas de `V/02` §2.2 | +1 (`canje_de_trial`) | sin conteo congelado | ninguno |
| guards de V | 19 → 19 | no se agregó ninguno | ninguno |

## 4. Para otro grupo

- **Cuarto agente, `$D/03-handoff.md:257`** (no es de ningún grupo): «publicación 6 estados / 12
  transiciones, 8 precisiones», que pasa a decir 13 transiciones y 9 precisiones.
  Razón: `PB13` (C10) y la precisión 9 (lotes I y M).
- **N, `12-contrato-de-cobertura.md:1169`**: «La columna es de `V/02` y la construye `V4`», que
  pasa a decir "La tabla es `canje_de_trial`, de `V/02` §2.2, y la construye `V4`". Razón: una columna en la
  fila de `trial` guarda una sola clave, y un trial se puede extender más de una vez.
- **N, `NUCLEO/08` §3, fila de la acción 24**: la acción escribe `user.deleted_at`, y eso dispara
  `trg_softdelete_bookmarks_on_users` del carril de extras, que borra los favoritos que otros
  guardaron sobre esa cuenta (caso vecino 3 del §7). Propuesta: nombrarlo en la fila, «y el
  trigger de soft delete de `users` borra los favoritos que otros guardaron sobre esa cuenta».
  Razón: es una escritura sobre datos de terceros que hoy no está en ningún capítulo.
- **N, `NUCLEO/07` §6, fila *«moderación levantada»***: «al levantar la baja o cerrar el pedido»
  pasa a «al levantar la baja o cerrar el pedido, salvo el cierre que hace la llegada de la ficha
  a `PURGED`, que no manda correo (`V/02` §4.1)». Razón: R11, el correo diría a dónde volvió una
  ficha borrada.
- **N, `NUCLEO/08` §3 (R21)**: las dos lecturas del §6, pregunta 1, son las mismas que N deja
  abiertas; que la respuesta se escriba en las dos puntas (`NUCLEO/08` §3 y `V/17` §3.2).
- **B, `B/14` §3.2 (cerca de `claveDeCanje`)**: nombrar dónde la guarda verticales,
  «(verticales la guarda en `canje_de_trial`, `V/02` §2.2)». Razón: R19.
- **B y N, R23**: la corrida diaria que reintenta los borrados remotos usa el vigía de cron
  externo del reconciliador (`B/09` §7.1 lo describe para el barrido). Si el vigía cuenta jobs, es
  un job más.

## 5. Propuestas para el log y la matriz

- **`DEC-DATA-005`** (`rg -n "DEC-DATA-005" $D/01-decision-log.md` lo encuentra): 📌 precisada el
  2026-09-30, con OK del owner (lote H): «tras la baja de la cuenta, el seudónimo de la fila de
  `trial` se conserva hasta que el abogado conteste la pregunta 5 de `V/22`; si contesta en contra,
  soporte los borra todos con una tarea puntual, y se anota quién la corrió y cuándo». Razón: la
  decisión dice que la baja «es otro proceso», y ahora ese proceso tiene regla para el seudónimo.
- **Decisión nueva del owner, lotes A y B** (ID a asignar por quien edite el log; no reusa ninguno
  retirado): «El reclamo de un Partner escribe `owner_user_id` sólo si está nulo, y su link es de un
  solo uso; si verifica la cuenta, cierra todas sus sesiones y credenciales previas. Una cuenta es
  dueña de a lo sumo un Partner, con unicidad en la base; el reclamo de un segundo deriva a
  soporte». Razón: son dos decisiones de producto (a qué cuenta pertenece un Partner) que hoy
  viven sólo en `V/18` §2.4.
- **Decisión nueva del owner, lotes I y M**: «Postular un Partner no exige cuenta: es la segunda
  excepción del guest en el paso 1, acotada a esa escritura, con captcha (Turnstile) y una sola
  postulación abierta por correo». Razón: cambia la cadena de autorización, que es de un
  capítulo con decisiones propias (`DEC-AUTH-*`).
- Matriz: ninguna.

## 6. Preguntas abiertas

1. **R21 (`F-8V3A1-006`): qué es «de `SUPER_ADMIN`».**
   - Lectura A: el permiso de cada una de esas acciones lo trae sólo el rol `SUPER_ADMIN`, y el
     override por usuario no lo puede dar. Daño: ninguno sobre plata; cuesta flexibilidad (dar el
     poder a otra cuenta pide darle el rol entero).
   - Lectura B: el permiso se puede asignar por override, y asignar un permiso de la tabla es una
     fila de `NUCLEO/08` §3 con su auditoría. Daño: ninguno si la fila existe; si se construye el
     override antes que la fila, un `CLIENT_MANAGER` fija precios sin rastro.
   - Recomendación: A. Es la que no pide una fila nueva ni un proceso de auditoría de asignaciones,
     y un owner que opera solo no necesita delegar precios.
2. **R24 (`F-8V3A2-006`): el hecho 5 que llega tarde y `PB9`.**
   - Lectura A: el recálculo toma el lock de `user + vertical`. Daño: no cierra la carrera, porque
     el lock ordena el recálculo y `PB9` cuando corren a la vez, y el caso es que `PB9` corra antes
     de que el recálculo arranque (el aviso está atrasado). Queda un borrado adelantado sin aviso.
   - Lectura B: `PB9` exige que el reloj sea posterior a la última pérdida de cobertura. Daño:
     ninguno sobre el cliente, pero pide un dato que el contrato no devuelve hoy (cuándo pasó
     `cubierto` a falso), así que es un campo nuevo en `cobertura()` o en `retenciónDetenida`, del
     grupo N.
   - Recomendación: B, con el campo en el contrato; y mientras no exista, que `PB9` no borre en la
     misma corrida en que lee `cubierto` falso por primera vez sobre un reloj que escribió el
     hecho 2, lo que pide saber qué hecho escribió el reloj (otra columna). Ninguna de las dos es
     gratis: por eso no se eligió.
3. **Lote A: la sesión que abrió el reclamo.** Se escribió que queda sólo la sesión del reclamo y la
   credencial con que se abrió. Si esa credencial fuera la contraseña que puso el ocupante (que
   la dueña no conoce), no hay caso: la dueña entra por recuperación, que fija una contraseña suya.
   No se encontró una lectura con daño distinto; se deja anotado por si el implementador de `V7`
   encuentra un camino de sesión que no pase por una credencial.

## 7. Casos vecinos

1. **El link de reclamo no lleva, escrito, un secreto.** El diseño dice que la prueba es leer la
   casilla, y eso sólo vale si el link no se puede adivinar (si fuera `/reclamar/<partner_id>`,
   cualquiera reclama). Ningún capítulo de V dice que el link lleva un secreto que viaja sólo en
   el aviso. No se tocó.
2. **Un link sin usar lo gana quien lee primero la casilla.** Con el link de un solo uso y sin
   vencimiento, una casilla compartida sigue decidiendo el dueño si alguien lo usa antes que la
   dueña. Es la premisa del diseño (leer la casilla es la prueba), no un defecto nuevo; la dueña
   va a soporte por la fila 32 de `V/19`.
3. **La acción 24 dispara un trigger de soft delete sobre `users`.** El carril de extras del código
   actual (`packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql`, leído en
   hospeda2) tiene `trg_softdelete_bookmarks_on_users`: cuando `users.deleted_at` pasa de nulo a no
   nulo borra de `user_bookmarks` las filas con `entity_type` de usuario y ese id, o sea los
   favoritos que otras personas guardaron sobre esa cuenta, no los que la persona guardó. Con la
   acción 24 escribiendo `user.deleted_at` (N), eso pasa en cada baja. Parece deseable, pero ningún
   capítulo lo nombra.
4. **Gastronomía y Experiencia no tienen trigger de favoritos por soft delete**: el mismo archivo
   los tiene sólo sobre `accommodations`, `destinations`, `events`, `users` y `posts`. No cambia nada
   hoy, porque `PURGED` no escribe `deleted_at` en ninguna tabla de ficha.
5. **La cita de `V/19` fila 28 a una ficha `PURGED`** dice «en la bandeja de los dos»; la regla
   nueva de `V/17` precisión 7 deja al turista sin mensajes nuevos también sobre una ficha que dejó
   de publicarse sin llegar a `PURGED`, y `V/19` no tiene fila para ese caso intermedio.

## Key Learnings

1. Antes de escribir una pregunta abierta sobre algo de la frontera, mirar si otro grupo ya lo
   escribió en esta tanda: N había resuelto R20 (interfaces en `V1`, `V4` sobre `B1`),
   `postulacion.correo` y «sin acceso», y la primera versión de este registro los tenía como
   abiertos.
2. Un lock no cierra una carrera cuando el que llega tarde todavía no arrancó: R24 no se arregla
   ordenando dos escrituras que no corren a la vez.
3. «Un solo uso» no pidió una columna: escribir sólo sobre `owner_user_id` nulo ya gasta el link.
4. Una lista cerrada que nombra tablas del código actual tiene que restar lo que borra la limpieza
   del principio, o el guard que la recorre en la rama y la lista dicen cosas distintas.
