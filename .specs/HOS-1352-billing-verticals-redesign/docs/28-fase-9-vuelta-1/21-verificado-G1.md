---
title: "FASE 9 vuelta 1 · verificación de G1 (el corte y la ficha vieja)"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — verificación de G1

Verificación con el criterio de `DEC-METH-004` (opción 3) de los **27 hallazgos** de
`01-G1-el-corte-y-la-ficha-vieja.md` §1 (racimos R1, R6 y R7 y los sueltos de A3/C2), contra el
texto vigente del worktree al 2026-09-26 (HEAD `4347cfd9de`), después de `11-aplicado-G1.md` y de
los registros `12-` a `18-`. Cada camino se re-ejecutó con el texto de hoy; donde el diseño afirma
algo del sistema viejo, se miró el código del repo.

Decisiones del owner que cambian la salida esperada: `G1-4` (elegida contra la recomendación: la
pérdida se declara, no se devuelve) y `G3-2` (la lápida de recepción usa la forma de fila de R6).

---

## 1. Resumen

**24 DEJA · 0 SIGUE · 3 DECLARADO · 0 OTRA.** Los tres racimos tienen el dominio cubierto; salen
**tres hallazgos nuevos** de caso vecino (§3: una MEDIA y dos BAJA) y cuatro notas de texto (§4).

| hallazgo | veredicto | línea que lo corta o lo declara |
|---|---|---|
| `F-8V1C2-001` (R1, CRÍT) | DEJA | `$V/docs/03-maquinas-de-estado.md:528` «Desde `UNPUBLISHED_BY_BILLING` sale sólo por la segunda rama: si esta publicación dispara `T1`» |
| `F-8V1A2-001` (R1) | DEJA | `$V/docs/03-maquinas-de-estado.md:225` «también sobre la ficha que `PB2` bajó, porque `PB1` sale de `UNPUBLISHED_BY_BILLING` cuando» |
| `F-8V1A3-002` (R1) | DEJA | `$D/16-fase-7-del-paraguas.md:194` «dueño las recupera publicándolas, que le arranca el trial» |
| `F-8V1D1-001` (R1) | DEJA | `$V/docs/19-superficies.md:70` «Lo que se lee es el registro del sistema nuevo, el mismo que leen `T7` y `T8`» |
| `F-8V1A3-001` (R1) | DEJA | `$V/docs/21-migracion.md:156` «En qué estado nace cada ficha, y está determinado (FASE 9 vuelta 1, R1; owner 2026-09-26,» |
| `F-8V1A3-012` (R6) | DEJA | `$B/docs/21-migracion.md:150` «y nada más: ni usuario, ni vertical, ni versión, ni billing option» |
| `F-8V1B3-003` (R6) | DEJA | `$B/docs/02-modelo-de-datos.md:47` «`user`, vertical, versión anclada y billing option son no nulos salvo en `clase = LÁPIDA`» |
| `F-8V1C2-005` (R6) | DEJA | `$B/docs/21-migracion.md:148` «que el paso 1b canceló y el paso 2 verificó, conocido por la base o no, sondas incluidas» |
| `F-8V1D1-010` (R6) | DEJA | `$D/16-fase-7-del-paraguas.md:131` «una persona, con la herramienta del corte (de B11), sobre la base nueva y el manifiesto del 1b» |
| `F-8V1A3-011` (R7) | DEJA | `$B/docs/21-migracion.md:74` «La población a avisar es toda persona con una ficha que no sea `L1` o con una suscripción» |
| `F-8V1C2-009` (R7) | DEJA | `$V/docs/21-migracion.md:405` «a la población de `B/21` §1.3 (FASE 9 vuelta 1, R7) y cuándo se cancelan sus suscripciones» |
| `F-8V1A3-004` | DEJA | `$D/16-fase-7-del-paraguas.md:129` «las data-migrations del catálogo nuevo (verticales con su evento, `admite_altas` y fin de servicio;» |
| `F-8V1C2-002` | DECLARADO | `$B/docs/21-migracion.md:365` «pierde y no se devuelve (declarado por `DEC-METH-015`; owner 2026-09-26, `G1-4`, elegida» |
| `F-8V1A3-006` | DEJA | `$V/docs/02-modelo-de-datos.md:48` «`UNIQUE(id, plan_id)`, que pide la FK de `B/02` §2.4» |
| `F-8V1A3-007` | DEJA | `$B/docs/02-modelo-de-datos.md:47` «y `(versión, vertical)` → `plan_version(id, vertical)`: la billing option es de la versión anclada» |
| `F-8V1A3-010` | DEJA | `$V/docs/02-modelo-de-datos.md:597` «Y `PURGED` conserva la fila: el borrado es del contenido, no un `DELETE` de `listing`» |
| `F-8V1C2-004` | DEJA | `$D/16-fase-7-del-paraguas.md:243` «Estado de nacimiento y escritura `C` (paso 3): V6 (`V/21` §2.4; R1).» |
| `F-8V1C2-006` | DEJA | `$D/16-fase-7-del-paraguas.md:122` «con una mitad en producción: sobre un plan propio sin suscriptores (como la sonda 50) se cancela» |
| `F-8V1C2-007` | DEJA | `$D/16-fase-7-del-paraguas.md:274` «3 alcanzó a reemplazar la imagen: se vuelve a desplegar la imagen vieja, se reencienden su» |
| `F-8V1C2-008` | DEJA | `$D/16-fase-7-del-paraguas.md:128` «verificada con una entrega real (el alta de una sonda propia) antes del paso 4» |
| `F-8V1C2-010` | DECLARADO | `$D/16-fase-7-del-paraguas.md:230` «entra al corte con `billing_unpublished_at` y nace `UNPUBLISHED_BY_BILLING` (`V/21` §2.4, `L5`),» |
| `F-8V1C2-011` | DEJA | `$D/16-fase-7-del-paraguas.md:221` «con el envío registrado en el manifiesto del corte» |
| `F-8V1A3-013` | DEJA | `$V/docs/02-modelo-de-datos.md:759` «rechaza con un trigger que rechaza todo `DELETE` sobre `trial`, en el carril de extras» |
| `F-8V1A3-015` | DEJA | `$V/docs/02-modelo-de-datos.md:513` «la suscripción lee su versión anclada, que es inmutable; una versión nueva no la cambia» |
| `F-8V1C2-012` | DECLARADO | `$V/docs/21-migracion.md:128` «ningún `PB2` les baja nada y el grant del 3b las sube por `PB3`: el residuo son los minutos» |
| `F-8V1C2-014` | DEJA | `$B/docs/21-migracion.md:340` «destaque, `entity_subscriptions`, `partner_subscriptions` (FASE 9 vuelta 1, `F-8V1C2-014`) y» |
| `F-8V1C2-015` | DEJA | `$D/16-fase-7-del-paraguas.md:75` «hasta que el §4.3 lo decidió (FASE 9 vuelta 1, `F-8V1C2-015`).» |

Notas de veredicto:

- `F-8V1C2-010` queda **DECLARADO**, pero el mecanismo que la declaración describe no es el del
  código: el viejo no escribe `billing_unpublished_at` al cancelar (§4, nota 1). El estado de
  nacimiento no cambia (la ficha entra como `L8` y nace igual `UNPUBLISHED_BY_BILLING`).
- `F-8V1C2-012` queda **DECLARADO** y no DEJA: el camino sigue llegando a minutos de ficha abajo
  en las dos cuentas del owner, y el residuo está aceptado por escrito en `V/21` §2.4 punto 3.
- `F-8V1C2-009` DEJA en su camino (Juan sin suscripción ahora está en la población), pero la parte
  de *«consulta reproducible»* quedó como **descripción** en `D/07`, no como SQL (§4, nota 3).

---

## 2. Los racimos

### 2.1 R1 · la ficha vieja nace sin estado y el dueño no puede estrenar el trial

**Camino de Juan re-ejecutado.** Juan tiene «Cabañas del Río» `ACTIVE` + `PUBLIC` en el viejo,
sin suscripción viva. (1) El corte le escribe el estado de nacimiento: la ficha es `L8` y nace
`UNPUBLISHED_BY_BILLING` con `inactiva_desde` = instante del corte. (2) Juan está en `PRE_TRIAL`,
sin fila de `trial` (el corte no escribe filas de `trial`). (3) Toca «publicar» sobre esa ficha:
`PB1` sale de `UNPUBLISHED_BY_BILLING` por su segunda rama, porque `T1` dispara (la vertical declara
evento, días > 0, `cubierto` falso, admite altas, el hash no tiene fila). (4) La ficha queda
`PUBLISHED` y Juan en `TRIAL_ACTIVE`. Si en cambio toca «suscribirme», la fila 23 lee el registro
del sistema nuevo, donde Juan no ejerció el evento, y lo manda a publicar. **El paso 3 del camino
original (*«no hay acción»*) ya no llega.**

**G-R4 y conteo.** El par `(UNPUBLISHED_BY_BILLING, «el dueño publica»)` sigue con una sola fila;
`PB3`/`PB7` tienen otro evento y `PB10`/`PB12` otro actor. Seis estados y doce transiciones.

**Recorrido del dominio declarado** (eje 1 × eje 2, más `C5` y los dos casos de control):

| caso | dónde se contesta | ¿cubierto? |
|---|---|---|
| las ocho clases `L1`–`L8`: orden de evaluación y estado de nacimiento | `$V/docs/21-migracion.md:157` «La migración estructural del corte le escribe a cada ficha preexistente el estado» | sí; contra el código: `lifecycle_state` tiene 4 valores y `visibility` 3, así que `L2`–`L8` cubren todo el producto sin hueco |
| `L1` (borrada) × cualquiera: nace `PURGED` con el contenido borrado | `$V/docs/21-migracion.md:170` «`PURGED`, con el contenido borrado como en `PB12` (`G1-2`)» | sí; la borrada por un admin, declarada |
| `L1` borrada por un admin (residuo de `G1-2`) | `$V/docs/21-migracion.md:430` «Una ficha vieja borrada por un admin, y no por su dueño, pierde su contenido en el corte» | DECLARADO |
| `L4` (bajada por el dueño) × cualquiera: nace `DRAFT` y ningún cambio de cobertura la sube | `$V/descomposicion.md:510` «una ficha `INACTIVE` sin `billing_unpublished_at` nace `DRAFT` y ningún cambio de cobertura la publica» | sí |
| `L5`/`L7`/`L8` × `C1`: `PB1` por la rama de trial | `$V/docs/03-maquinas-de-estado.md:528` «Desde `UNPUBLISHED_BY_BILLING` sale sólo por la segunda rama: si esta publicación dispara `T1`» | sí |
| `L7` por `owner_suspended`: ¿es una suspensión administrativa que el corte convertiría en publicable? | `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:105` «Denormalized flag (SPEC-143 #29): true when the owner's subscription is» | sí: la marca es de la pausa de billing, no un castigo; mapearla a `UNPUBLISHED_BY_BILLING` es correcto |
| `L2`/`L3`/`L4`/`L6` × `C1`: `PB1` desde `DRAFT` dispara `T1` | `$V/docs/21-migracion.md:207` «ficha**, que `PB1` admite desde `UNPUBLISHED_BY_BILLING` o desde `DRAFT` cuando arranca un trial» | sí |
| `L3` (archivada vieja): no llega a `PB9` sin el aviso del archivado | `$V/docs/21-migracion.md:157` «La migración estructural del corte le escribe a cada ficha preexistente el estado» | sí: la tabla la hace nacer `DRAFT` (fila `L3`), así que pasa por `PB5` y su aviso |
| varias fichas × `C1`: una sola durante el trial | `$V/docs/21-migracion.md:424` «Durante el trial vuelve una sola ficha (§2.4; declarado por `DEC-METH-015`, FASE 9 vuelta 1,» | DECLARADO; y al contratar, **cuáles vuelven no tiene dato de orden**: hallazgo nuevo `N-G1-01` (§3) |
| cualquiera × `C1`, contrata sin publicar | `$V/docs/21-migracion.md:419` «Quien contrata sin publicar paga desde el primer cobro (§2.4; declarado por `DEC-METH-015`,» | DECLARADO |
| abajo o `DRAFT` × `C2` (vertical sin trial) | `$V/docs/21-migracion.md:427` «En una vertical sin trial, el dueño del corte no tiene trial que estrenar (§2.4; declarado» | DECLARADO; la pantalla es la fila 21 y, sin altas, `B/19` fila 20 |
| `L5`/`L7`/`L8` × `C3` (grant): sube por `PB3` | `$V/docs/21-migracion.md:127` «de esas dos cuentas nacen `UNPUBLISHED_BY_BILLING` como todas (tabla de abajo), así que» | sí |
| `DRAFT` × `C3`: `PB1` por la primera rama y `T6` consume | `$V/docs/03-maquinas-de-estado.md:56` «crea la fila de `trial`, consumida, sin reloj y sin campaña» | sí, igual que hoy |
| cualquiera × `C4` (ventana antes del 3b) | `$D/16-fase-7-del-paraguas.md:130` «para que esas dos cuentas estén abajo sólo minutos: sus fichas nacen `UNPUBLISHED_BY_BILLING` como todas» | DECLARADO (el mismo residuo de `F-8V1C2-012`) |
| `moderation_state = PENDING`/`APPROVED`: no se traduce | `packages/service-core/src/services/accommodation/accommodation.service.ts:2166` «filters on `moderationState` today, so making this one gate reads would» | sí; verificado además que las rutas públicas sólo la proyectan, no la filtran |
| `REJECTED` × cualquiera: no se traduce, se lista | `$V/docs/21-migracion.md:184` «el default de toda fila. `REJECTED` tampoco se traduce: se lista en la re-verificación de» | sí: hoy el dueño también podía re-activarla (la columna no gobierna la vista), así que publicarla no cambia nada |
| `is_featured`: no cruza | `$B/docs/21-migracion.md:342` «`is_featured`: ninguna ficha nace destacada; el destaque es una capacidad comercial (FASE 9» | sí |
| `C5` (primer cobro rechazado, fuera del corte) | `$V/docs/03-maquinas-de-estado.md:225` «también sobre la ficha que `PB2` bajó, porque `PB1` sale de `UNPUBLISHED_BY_BILLING` cuando» | sí; `T7` no la alcanza porque sólo dispara en el encendido, así que la promesa de `PRE_TRIAL` es verdadera |
| dueño cubierto con una ficha abajo por excedente | `$V/docs/03-maquinas-de-estado.md:538` «`PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)» | sí: no sale por `PB1`; vuelve por `PB3` |
| dueño en `TRIAL_EXPIRED` o con el hash consumido | `$V/docs/19-superficies.md:68` «sigue sin publicar (desde R1 puede estar en `UNPUBLISHED_BY_BILLING`; FASE 9 vuelta 1)» | sí: fila 21 |
| qué es haber publicado, para el botón (billing) | `$V/docs/19-superficies.md:70` «Lo que se lee es el registro del sistema nuevo, el mismo que leen `T7` y `T8`» | sí; `B/19` fila 21 ya no repite la regla, la cita |

**Dominio cubierto: sí.** Ninguna celda deja al dueño del corte sin un acto que ejerza `T1`
cuando la vertical ofrece trial. El único vecino que salió no rompe `2g`: es el orden de subida
al contratar (`N-G1-01`).

### 2.2 R6 · la lápida no tiene fuente para sus columnas ni dueño

**Camino re-ejecutado.** El 1b cancela el preapproval de Juan (`owner-pro`) y el paso 2 lo verifica.
En el paso 4 el operador corre la herramienta de B11 sobre el manifiesto: escribe `clase = LÁPIDA`,
`origen_de_lápida = CORTE`, `CANCELLED` y su `provider_link`, sin usuario ni versión, y la base lo
admite porque la restricción exime a la lápida. Un cobro tardío encuentra la fila; la relectura
del barrido mira sólo el estado. **Los pasos 2–4 del camino original (*«no hay `owner-pro`»*, *«la
ancla al Pro nuevo»*, *«compara contra un precio que nunca pagó»*) ya no llegan.**

| caso | dónde se contesta | ¿cubierto? |
|---|---|---|
| `P1` conocido por la base | `$B/docs/21-migracion.md:148` «que el paso 1b canceló y el paso 2 verificó, conocido por la base o no, sondas incluidas» | sí |
| `P2` sólo en el proveedor | `$D/16-fase-7-del-paraguas.md:161` «lo reconoce, después del paso 4, su lápida, porque desde R6 todo id cancelado y verificado tiene una» | sí |
| `P3` sonda cancelada en el 1b | `$D/16-fase-7-del-paraguas.md:131` «sembrar las lápidas (`B/21` §2.5) con los ids cancelados y verificados, conocidos por la base o no, sondas incluidas salvo las del manifiesto» | sí |
| `P4` sonda del manifiesto: sin lápida del corte, cae en una de recepción | `$D/16-fase-7-del-paraguas.md:137` «Las enumeradas cobran la tarjeta del owner y caen» | sí (y su forma de fila es el vecino `N-G1-02`, §3) |
| `P5` ya `cancelled` antes del 1b: no está en el censo, no cobra | `$D/16-fase-7-del-paraguas.md:125` «es todo estado releído distinto de `cancelled`: `pending`, `authorized` y `paused`» | sí |
| qué columnas lleva | `$B/docs/21-migracion.md:150` «y nada más: ni usuario, ni vertical, ni versión, ni billing option» | sí |
| la base la admite sin usuario ni versión | `$B/docs/02-modelo-de-datos.md:47` «`user`, vertical, versión anclada y billing option son no nulos salvo en `clase = LÁPIDA`» | sí |
| quién la escribe (tabla y prosa iguales) | `$B/docs/21-migracion.md:154` «corte sobre el manifiesto que produjo el 1b. La escritura la construye y la prueba B11.» | sí |
| unidad dueña y criterio | `$B/descomposicion.md:137` «y el criterio de que una fila principal sin usuario ni versión la rechaza la base» | sí |
| qué hace el barrido con ella | `$B/docs/09-conciliacion.md:195` «Sobre una lápida la relectura mira sólo el estado: no tiene versión contra la cual comparar un monto» | sí |

**Dominio cubierto: sí.** La coordinación con G3 (`origen_de_lápida`) está escrita en la fila, y
el *«única»* de `B/21` ya dice *«son dos»*.

### 2.3 R7 · la población del aviso se contó en suscripciones

**Camino re-ejecutado.** Juan cargó un alojamiento en 2025 y nunca tuvo suscripción. La población de
`B/21` §1.3 es toda persona con una ficha que no sea `L1`: Juan entra, recibe la llamada y el
correo registrado en el manifiesto, y el guion le dice que la ficha queda en pausa y cómo estrena
el trial. **El paso 2 del camino original (*«no está entre las tres llamadas»*) ya no llega.**

| caso | dónde se contesta | ¿cubierto? |
|---|---|---|
| (a) ficha a la vista (`L7`, `L8`) | `$B/docs/21-migracion.md:74` «La población a avisar es toda persona con una ficha que no sea `L1` o con una suscripción» | sí |
| (b) ficha abajo o en borrador (`L2`–`L6`) | ídem, más el guion: `$D/16-fase-7-del-paraguas.md:199` «y dice qué pasa con su ficha y cómo estrena el trial (`V/21` §2.4; FASE 9 vuelta 1, R7)» | sí |
| (c) sólo suscripción viva, sin ficha | `$B/docs/21-migracion.md:75` «viva en el sistema viejo, medida el día del corte (FASE 9 vuelta 1, R7). Quien tiene sólo» | sí (una baja programada del viejo sigue `active` con `cancel_at_period_end`, así que cuenta como viva y entra) |
| (d) sólo fichas `L1` | `$B/docs/21-migracion.md:75` «viva en el sistema viejo, medida el día del corte (FASE 9 vuelta 1, R7). Quien tiene sólo» | sí: sin aviso, no pierde nada |
| las cinco verticales | `$B/docs/21-migracion.md:73` «Y cuenta fichas por dueño en las cinco verticales, con la clase `L1`–`L8` de `V/21` §2.4.» | sí |
| el cero de las otras tres, re-contado | `$V/docs/21-migracion.md:384` «Gastronomía, experiencia y partner: cero filas al 2026-09-15; se re-cuentan el día del corte» | sí, con la salvedad de que la consulta está descrita y no escrita (§4, nota 3) |
| el umbral se mide en personas | `$V/docs/21-migracion.md:373` «en unas veinte, y arriba de eso deja de ser viable. El umbral se mide en personas a llamar,» | sí |

**Dominio cubierto: sí.**

---

## 3. Hallazgos nuevos (casos vecinos)

### `N-G1-01` — MEDIA · la ficha del corte no tiene fecha de publicación, y el orden de «cuáles vuelven» se calcula con ella

**Vecino de qué.** R1 le dio a toda ficha del corte un estado (`UNPUBLISHED_BY_BILLING`) y un reloj
(`inactiva_desde`), pero no el tercer dato que ese estado consume: **cuándo se publicó**, que es
con lo que se ordena la subida por `PB3`/`PB7`. Ese dato sale del registro de eventos de dominio del
sistema nuevo, y una ficha del corte no tiene ahí ninguna publicación: nació por migración, no por
`PB1`.

- `$V/docs/03-maquinas-de-estado.md:893` «El dato con el que se ordena ya existe y no pide columna nueva: cuándo se publicó cada ficha,»
- `$V/docs/03-maquinas-de-estado.md:895` «append-only de eventos de dominio (cap. 08 §1.2 y §1.3, núcleo), igual que el origen que `PB7`»
- `$V/docs/21-migracion.md:211` «abajo vuelven solas por `PB3`, hasta llenar el cupo (FASE 9 vuelta 1, R1; owner 2026-09-26,»

**Camino de Juan.**

1. Juan tiene tres alojamientos a la vista en el viejo. En el corte los tres nacen
   `UNPUBLISHED_BY_BILLING`, sin ningún evento de publicación en el registro nuevo.
2. No publica: contrata Básico (cupo 1) por teléfono. `S1` lo cubre y `PB3` tiene que elegir
   *«la publicada menos recientemente entre las que están abajo»*.
3. Las tres candidatas no tienen fecha de publicación: el criterio no ordena, y la ficha que queda
   visible es la que la implementación recorra primero. Es exactamente lo que el §9 dice que no
   puede pasar (*«la diferencia entre una máquina de estados y una convención»*).
4. Variante: Juan estrena el trial publicando una (esa sí tiene evento), el trial vence, `PB2` la
   baja, y contrata con cupo 2. Compiten una ficha con fecha y dos sin fecha: tampoco hay regla.
5. El aviso de la fila 19 tiene que decirle *«el criterio»*, y no hay uno que decir.

**Por qué MEDIA.** Es una decisión de visibilidad pública sin regla, sobre un dueño que paga; no
mueve plata ni da acceso. **Salida posible (no decido):** declarar que la escritura de nacimiento
del corte cuenta como publicación en el instante del corte para las `L5`/`L7`/`L8` (con un
desempate estable entre ellas), o escribir el desempate para candidatas sin fecha. Es de V6.

### `N-G1-02` — BAJA · la lápida de recepción nace `CANCELLED` sobre un preapproval que sigue vivo

**Vecino de qué.** La restricción que R6 escribió para la lápida del corte —`clase = LÁPIDA` exige
`estado = CANCELLED`— vale también para su gemela de recepción (`G3-2`), y la de recepción se
escribe sobre un preapproval que **nadie canceló**: una sonda del manifiesto, o una autorización que
el censo no vio. El capítulo dice que eso es lo peor que puede afirmar una lápida.

- `$B/docs/02-modelo-de-datos.md:47` «Hay dos escritores de esa forma, y ninguno es una transición»
- `$B/docs/21-migracion.md:225` «escribe. Al revés quedaría una lápida sobre un preapproval que sigue vivo, que es peor que no»
- `$B/docs/09-conciliacion.md:195` «una suscripción terminal cuyo preapproval lo canceló una llamada NUESTRA todavía sin confirmar»

**Camino de Juan.** El censo del 1b no vio una autorización de Juan (el residuo declarado de
`F-8V1B3-005`). Un mes después cobra: el handler escribe una lápida de recepción `CANCELLED` y
cuelga la marca. La salvedad 4 no la alcanza (nadie de nuestro lado la canceló), así que el barrido
nunca reintenta cancelarla; cuando una persona levanta la marca, la fila queda terminal y fuera
del barrido con un preapproval que cobra todos los meses. Cada cobro vuelve a abrir la marca, así
que no es silencioso, pero la fila afirma *«cerrado»* sobre algo que cobra, y nada del diseño
manda a cancelarlo.

**Por qué BAJA.** Cada cobro abre una marca que ve una persona; la contradicción es de texto y de
responsabilidad (nadie tiene el acto de cancelar), no un cobro sin detector. La región es de G3.

### `N-G1-03` — BAJA · la FK `(versión, vertical)` de `subscription` apunta a una unicidad que `plan_version` no declara

**Vecino de qué.** Para `F-8V1A3-006` se agregó a `plan_version` la `UNIQUE(id, plan_id)` que pide
la FK de los grants; para `F-8V1A3-007` se agregó a `subscription` una FK compuesta a
`plan_version(id, vertical)`. La unicidad gemela, `UNIQUE(id, vertical)` sobre `plan_version`, no
se escribió. Postgres no acepta una FK compuesta sin una restricción única sobre exactamente esas
columnas, aunque `id` sea clave.

- `$V/docs/02-modelo-de-datos.md:48` «FK compuesta `(plan_id, vertical)` → `plan(id, vertical)`, sobre la `UNIQUE(id, vertical)` de `plan`»
- `$B/docs/02-modelo-de-datos.md:47` «y `(versión, vertical)` → `plan_version(id, vertical)`: la billing option es de la versión anclada»

**Camino.** El implementador de B1 escribe la FK tal como dice `B/02`; `db:generate` produce la
migración y `db:migrate` falla con *«there is no unique constraint matching given keys»*. Se
detecta en el primer intento, por eso BAJA; la corrección es una línea en `V/02` §2.1.

---

## 4. Texto vencido o contradicciones (BAJA)

1. **La declaración de `F-8V1C2-010` describe un mecanismo que el código viejo no tiene.** Dice que
   el viejo, al recibir la cancelación del 1b, *«baja las fichas del dueño»* y que la ficha entra con
   `billing_unpublished_at` (`L5`). El código sólo estampa esa columna en el cron de vencimiento del
   trial; al cancelar una suscripción refresca el caché `entity_subscriptions` y no toca
   `lifecycle_state`. La ficha entra como `L8`, no `L5`, y nace igual `UNPUBLISHED_BY_BILLING`, así
   que el resultado no cambia; el texto sí está mal.
   - `$D/16-fase-7-del-paraguas.md:229` «baja las fichas del dueño. No se suprime: el aviso previo lo anticipa.»
   - `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:119` «set when BILLING took this listing down — today only the»
   - `apps/api/src/services/subscription-linked-entities.service.ts:89` «billing took down (`billingUnpublishedAt`, stamped by the trial-expiry»
2. **`D/16` §4.2 quedó con un *«Las dos»* sin antecedente.** Al reescribir el quinto acto y
   agregar la población del aviso, la frase *«Las dos escriben filas del esquema nuevo»* quedó
   pegada a una oración que habla del aviso y del trial.
   - `$D/16-fase-7-del-paraguas.md:199` «cómo estrena el trial (`V/21` §2.4; FASE 9 vuelta 1, R7). Las dos escriben filas del»
3. **La consulta de la población está descrita, no escrita.** `D/07` agregó un párrafo que dice qué
   consulta va, pero el bloque SQL sigue con el único `count(*)` de alojamientos. `B/21` §1.3 y
   `V/21` §4 citan como reproducible algo que todavía no tiene texto ejecutable.
   - `$D/07-facts-inventory.md:152` «La consulta 3 no cuenta la población del aviso del corte (FASE 9 vuelta 1, R7; 2026-09-26).»
   - `$D/07-facts-inventory.md:149` «UNION ALL SELECT 'alojamientos', count(*)::text FROM accommodations WHERE deleted_at IS NULL;»
4. ***«Conserva el trial sin usar»* es cierto sólo hasta su próximo `PB1`.** El dueño del corte que
   contrata sin publicar y después publica otra ficha estando cubierto dispara `T6`, que consume el
   trial sin darlo. No es defecto (lo eligió pagando), pero la frase del «NO cierra» promete algo
   que la primera publicación cubierta le quita.
   - `$V/docs/21-migracion.md:421` «`PB3` le sube la ficha y `T8` no escribe nada, porque no ejerció el evento en el sistema nuevo:»

---

## Key Learnings

1. Un estado asignado por migración hereda **todos** los datos que la máquina lee de ese estado,
   no sólo el reloj: `UNPUBLISHED_BY_BILLING` consume además la fecha de publicación para el orden
   de subida, y una ficha que no nació por `PB1` no la tiene (`N-G1-01`).
2. Una restricción de forma escrita para un escritor (la lápida del corte, cancelada antes de
   escribirse) se aplica sola al segundo escritor de la misma forma (`G3-2`), donde la precondición
   es falsa: al compartir forma de fila hay que re-leer cada restricción contra cada escritor.
3. Las afirmaciones del diseño sobre el sistema viejo se verifican contra el código antes de
   aceptarlas: la columna `billing_unpublished_at` sólo la escribe el cron del trial, así que
   *«el viejo baja las fichas al cancelar»* era falso aunque el estado resultante coincidiera.
4. Agregar una FK compuesta obliga a revisar la unicidad del lado referenciado: el arreglo de la
   fila vecina (`UNIQUE(id, plan_id)`) hizo creer que el lado de `plan_version` estaba completo.
5. En el dominio de R1, las columnas viejas son cerradas y chicas (4 × 3 valores): contar el
   producto contra los enums del código es la forma rápida de probar que `L1`–`L8` no dejan hueco.
