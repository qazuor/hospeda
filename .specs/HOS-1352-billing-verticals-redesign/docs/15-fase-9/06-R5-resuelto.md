---
title: "FASE 9 · R5 resuelto — la migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 — R5 resuelto: la migración

`DEC-METH-004` define «resuelto» con dos condiciones y las dos son obligatorias: el camino de cada
hallazgo, reejecutado **sobre el texto corregido**, ya no llega; y la regla corregida se verifica
contra **todo el dominio que cuantifica** — los **54 casos** que
[`00-dominios-de-los-racimos.md`](./00-dominios-de-los-racimos.md) §R5 enumeró.

Este documento escribe ocho reglas (`R5-A` … `R5-H`), dice en qué archivo y § va cada una, recorre
las 48 celdas y los 6 órdenes, y nombra lo que no puede cerrar.

**Los paths se abrevian igual que en el documento de dominios**: `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, `V` es `HOS-1353-verticales-capacidades-y-autorizacion/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Dos límites, declarados antes de empezar.**

1. **La FASE 5 no está hecha** (`DEC-METH-003`, gate sin abrir), así que todo lo de acá se apoya en
   lo **medido** — el inventario de `07-facts-inventory.md` y lo que el capítulo 21 midió — y **no**
   en el código legacy. Cada vez que una conclusión dependería de cómo es el sistema actual, este
   documento la marca **no sostenible todavía** en vez de afirmarla.
2. **La caducidad del 2026-09-26 no es un bloqueante.** `F-8B3-018` la midió y el owner decidió el
   2026-09-19 ignorarla por ahora, con motivo escrito. Acá no aparece como urgencia: aparece una sola
   vez, en el §7, como **el umbral a partir del cual el método elegido deja de servir**.

---

## 1. Las ocho filas, una por una

### 1.0 El error de origen: «las cinco que importan» es un recorte, no una regla

El inventario midió **ocho** suscripciones vivas y tituló *«Detalle de las cinco que importan»*
(`07-facts-inventory.md`, «Suscripciones vivas»). Ese título era una decisión de **presentación**:
las cinco son las que tienen fechas que mirar. El capítulo 21 lo leyó como el **conjunto a migrar**
— *«**Son cinco relaciones y se transcriben una por una a mano** (`DEC-MIG-001`: cero código de
migración)»* (`V/21` §2.2) — y con eso las otras tres salieron del alcance sin que nadie lo decida.

> **`R5-A` · La migración cuantifica sobre las OCHO filas vivas medidas, no sobre cinco.** El recorte
> de «las cinco que importan» ordena una tabla de fechas; no define un alcance.

**Va en `V/21` §2.2, reemplazando la frase de las cinco, y en `B/21` §1.2, en la tabla de cifras.**

Y la regla que hace que esto no vuelva a pasar, porque es el defecto de fondo:

> **`R5-B` · La ausencia de una fila de `trial` es una AFIRMACIÓN, no una omisión.** Dice *«esta
> persona nunca consumió su trial»*, y el sistema actúa en consecuencia: `PRE_TRIAL` no tiene fila
> (R3-E), `T1` ya no pregunta por un trial previo (R3-D) y dispara. **Una fila que no se escribe
> regala un trial completo.** Por eso ninguna decisión comercial sobre estas ocho personas se
> representa dejando de escribir: se escribe la fila y, si hay que apartarse, se firma el
> apartamiento.

**Va en `V/21`, como §2.4 nueva, pegada a la tabla de transcripción.**

### 1.1 Las ocho, con su destino

| # | qué es, medido | qué se escribe | qué NO se escribe, y por qué |
|---|---|---|---|
| `F1` | `trialing`, alojamiento, mensual, compromiso vivo, trial al 2026-09-26 | `trial` · `subscription` histórica `CANCELLED` · `provider_link` · `billing_option` | ninguna concesión: el orden la cubre (§2) |
| `F2` | ídem, trial al 2026-11-25 | ídem | ídem |
| `F3` | ídem, trial al 2026-11-30 | ídem | ídem |
| `F4` | `comp`, alojamiento, **sin trial**, fin de período 2126-06-30, **sin vínculo** | `permanent_grant` con su `version_de_plan` | **nada de `trial`**: nunca consumió uno, y escribirlo sería escribir un hecho falso |
| `F5` | `comp`, alojamiento, **sin trial**, fin de período 2126-07-21, **sin vínculo** | ídem | ídem |
| `F6` | `abandoned`, alojamiento, **con trial**, sin vínculo | `trial` consumida | nada de `subscription`: no hay compromiso que preservar |
| `F7` | ídem | ídem | ídem |
| `F8` | `abandoned`, **turista**, **con trial**, sin vínculo | `trial` consumida, en la vertical **Turista** | ídem |

### 1.2 `F1`, `F2`, `F3` — las tres con compromiso de cobro vivo

Son las únicas con vínculo vivo al proveedor en toda la base (`07-facts-inventory.md`). Su
migración es la única que toca al proveedor, y por eso es la que tiene punto de no retorno.

**Su título y su compromiso se migran distinto, y ésa es la frase que disuelve `F-8C2-002`.**

> **`R5-C` · El TÍTULO se transcribe; el COMPROMISO se vuelve a crear.** La fila de `trial` es un
> título: cubre sin cobrar, no tiene contraparte en el proveedor y se escribe tal cual. El
> preapproval es un compromiso de cobro: no se transcribe, se **vuelve a autorizar**, porque la
> persona tiene que volver a consentir un débito (`DEC-MIG-001`, implicación 2). `DEC-MIG-001` y
> `V/21` §2.3 **no describen dos operaciones sobre las mismas filas**: describen las dos mitades de
> una, sobre dos objetos distintos de la misma fila.

**Va en `V/21`, encabezando el §2.3, y en `B/21` §3.2 (a), reemplazando el reenvío a un § que no
existe en ese archivo.**

La separación no se inventa acá: `NUCLEO/01` §1.4 ya define la suscripción principal como *«**El
compromiso de pago** que da acceso a una vertical»*, aparte de las seis fuentes de cobertura del §36, y
[`02-R2-resuelto.md`](./02-R2-resuelto.md) §1.4 ya cortó las fuentes en clases —`TÍTULO` y
`COMPLEMENTO`— por exactamente este eje.

**Qué se escribe, celda por celda.**

- **`D1` `trial`** — una fila con la fecha de fin que ya tenía (`V/21` §2.3, sin cambios). Su
  **estado** lo decide el reloj del día de la migración, con una regla y no caso por caso:
  `TRIAL_ACTIVE` si la fecha de fin todavía no llegó, `TRIAL_EXPIRED` si ya pasó. Para `F1` la fecha
  es el 2026-09-26 y la implementación es FASE 10 (§65), así que **`F1` llega expirada con
  certeza**; para `F2` y `F3` depende de la fecha de FASE 10 y la regla la resuelve sola.
- **`D2` `subscription`** — **dos filas, y ninguna es la misma cosa.** Una **histórica**, escrita a
  mano, en `CANCELLED`, que es donde aterriza el compromiso viejo (§1.5). Y la **nueva**, que
  **no se escribe a mano**: nace por `S1` cuando la persona elige su plan, como cualquier alta
  (`B/03` §3.2).
- **`D3` `provider_link`** — uno, colgado de la fila histórica, con el id del preapproval viejo.
  La suscripción nueva recibe el suyo por el camino normal de `B3`.
- **`D4` concesiones** — **ninguna.** La pregunta que el dominio dejó abierta —*«¿una `trialing`
  migrada arrastra alguna concesión?»*— tiene respuesta negativa **porque el orden del §2 la vuelve
  innecesaria**: nadie queda sin título en ningún momento de la ventana, así que no hay nada que
  compensar. Si el orden fuera el otro, sí haría falta, y eso es parte del argumento del §2.
- **`D5` `plan_version` anclada + piso del trinquete** — sí, y **no se puede transcribir**: ver §1.5.
- **`D6` `billing_option`** — el ciclo **mensual** del `plan_version` que la persona elija. Las ocho
  filas son mensuales (`07-facts-inventory.md`: *«Ocho filas en total, todas de ciclo **mensual**»*),
  así que el ciclo no se elige: se hereda. El **monto** no se hereda — es el del catálogo nuevo.

### 1.3 `F4` y `F5` — las dos cortesías perpetuas

Son el caso que `F-8A3-004` señala como *«descritas por una regla que sólo sabe escribir filas de
`trial`»*, y tiene razón: no hay trial que transcribir.

**Lo que son, en el vocabulario nuevo, se lee de los tres hechos medidos**: fin de período en el año
**2126**, **cero** vínculo con el proveedor, **cero** trial. Eso no es una suscripción con una fecha
lejana: es servicio sin obligación de pago y sin fin. El instrumento del modelo nuevo que dice
exactamente eso es el **grant permanente**: `B/14`, tabla de apertura — *«**grant permanente** (§35)
| la **obligación** | se cancela toda obligación de pago cubierta (§35.3, `DEC-GRANT-001`)»*.

> **`R5-D` · Una `comp` heredada aterriza en `permanent_grant`, una fila por vertical de su scope,
> con `hasta: NO_VENCE`.** No en `courtesy_grant`: la cortesía es temporal —*«días o meses»*,
> `B/02` §2.4— y su mecanismo es **pausar una suscripción** (`DEC-GRANT-003`, y la columna `E-4`
> que [`02-R2-resuelto.md`](./02-R2-resuelto.md) §2.3 le agrega), y estas dos personas **no tienen
> suscripción**: `S13` es justamente la transición que lleva a `CANCELLED` a quien recibe un *Free
> Forever*, *«el acceso pasa a darlo el grant»* (`B/03` §3.2).

**Va en `B/21`, como §2 nueva — el § que hoy falta en ese archivo.**

**Y no llevan fila de `trial`.** Ésta es la aplicación de `R5-B` en la dirección contraria y conviene
verla: escribirles un `trial` consumido sería escribir un hecho que la medición niega
(`trial_start` y `trial_end` vienen en `—` para las dos). Quedan en `PRE_TRIAL`, que es **verdadero**,
y si algún día hacen el evento de activación de su vertical, `T1` dispara y consumen el trial que
nunca consumieron. Es correcto por las reglas y es inocuo: su cobertura ya no depende de eso.

**`D2`, `D3` y `D6` quedan vacíos, y no es una omisión**: no hay compromiso (medido: `0` con vínculo),
así que no hay `subscription` ni `provider_link`; y un grant no tiene ciclo ni precio, así que no hay
`billing_option` — `billing_option` es *«el ciclo y su precio»* colgado de `plan_version`
(`B/02` §2.1), y lo que lee un ciclo y un precio es una suscripción, no una concesión.

**`D5` sí**: el grant necesita su `version_de_plan`, que es la referencia no anulable que el contrato
exige a toda fuente ([`02-R2-resuelto.md`](./02-R2-resuelto.md) §1.3). **Cuál** es esa versión no está
medido — ver §1.6.

### 1.4 `F6`, `F7`, `F8` — las tres `abandoned` con trial

Son las que quedaron fuera de «las cinco» y las que `F-8A3-004` mide como *«3 de los 22 usuarios de
producción»* que recibirían un trial completo.

> **`R5-E` · Toda fila viva con `trial_end` no nulo recibe una fila de `trial`, con la fecha que
> tenía.** El estado sale de la misma regla del §1.2 — `TRIAL_ACTIVE` si la fecha no llegó,
> `TRIAL_EXPIRED` si pasó. **Regalarle el trial de nuevo a alguna de las tres es una decisión
> comercial legítima, y se ejecuta escribiendo la fila en `TRIAL_ACTIVE` con la fecha que el owner
> elija — nunca dejando de escribirla.**

**Va en `V/21` §2.3, como tercera fila de la tabla, y su segunda mitad en la §2.4 nueva de `R5-B`.**

`F8` es de **Turista**, y la vertical existe y tiene trial: `V/10` §1, ítem 1 del Eje 2 —*«evento que
activa el trial | Turista: pulsar *Empezar* (`DEC-TRIAL-006`)»*—. Su fila va en la vertical Turista.
Turista no publica ficha (`NUCLEO/01` §1.2), así que su fila no arrastra `listing` ni `PB2`.

**`D2`, `D3`, `D4` y `D6` quedan vacíos.** Medido: `0` con compromiso de cobro vivo para las tres
(`07-facts-inventory.md`, columna *«con compromiso de cobro vivo»*, filas `abandoned`). No hay id de
proveedor que hacer resoluble, no hay obligación que cancelar y no hay ciclo que heredar. **`D5` sí**,
igual que las demás: el `trial` pide plan de trial y piso del trinquete.

### 1.5 Las dos cosas que NO se pueden transcribir, y hay que decirlo

**Primera: el piso del trinquete.**

La fila de `trial` guarda *«referencia al plan de trial, **referencia a las versiones vigentes al
arrancar** (el piso del trinquete), inicio, fin y el hash irreversible del correo normalizado»*
(`V/02` §2.2). Las versiones vigentes al arrancar eran las del **2026-08-27** y el **2026-09-01** — y
**no existen**: el catálogo nuevo lo siembra `V2` el día de la migración. No hay nada que referenciar.

> **`R5-F` · El piso del trinquete de una fila migrada es el catálogo vigente el día de la migración,
> no el del día en que el trial arrancó.** Es el único campo de la transcripción que se
> **reinterpreta**, y se declara acá porque `V/21` §2.3 dice lo contrario —*«el estado se transcribe,
> no se reinterpreta»*— y tiene que decir cuál es su excepción.

**Va en `V/21` §2.3, como tercera consecuencia debajo de la tabla.**

**Segunda: el compromiso viejo no se adopta como suscripción viva, y no es una elección.**

La tentación es escribir el preapproval viejo como `subscription` + `provider_link` para que la
conciliación lo vea. **La base lo rechaza**: `UNIQUE(user_id, vertical) WHERE clase = principal AND
estado ∈ {vivos}` (`B/02` §2.2). Si la fila histórica queda en un estado vivo, `S1` **no puede crear
la nueva** —su condición es *«no hay otra viva para ese `user + vertical`»* (`B/03` §3.2)— y el orden
del §2 se vuelve imposible de ejecutar. Los tres estados no-vivos son `ABANDONED`, `CANCELLED` y
`RECONCILIATION_REQUIRED`, y el que describe lo que pasó es `CANCELLED`.

> **`R5-G` · El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su
> `provider_link`, escrita DESPUÉS de cancelarlo en el proveedor.** Es lo que hace resoluble para
> siempre el id del preapproval viejo: si llega un webhook suyo, el barrido del `09` §2.2 lo
> encuentra y resuelve *«cancelado durante la migración»* en vez de *«huérfana»*. No cuelga de un
> estado vivo, así que no compite con la suscripción nueva por el `UNIQUE` del §11.

**Va en `B/21`, en la §2 nueva.** Y con ella, la frase que aclara qué significa la decisión:

> **`R5-H` · «Cero código de migración» (`DEC-MIG-001`) significa cero lógica de conversión, no cero
> filas escritas a mano.** Ocho filas escritas a mano con una lista al lado no son un migrador: son
> el procedimiento manual que la decisión eligió. Lo que la decisión prohíbe —y sigue prohibido— es
> escribir código que **derive** el destino de una fila a partir de la vieja.

**Va en `01-decision-log.md`, `DEC-MIG-001`, como implicación 6.**

### 1.6 La medición que falta, y es chica

Para escribir las ocho filas hacen falta tres datos que el inventario **no leyó**, y conviene decirlo
antes que descubrirlo el día de la migración:

| dato | para qué | por qué falta |
|---|---|---|
| `trial_start` y `trial_end` de `F6`, `F7`, `F8` | su fila de `trial` lleva las dos fechas | la consulta 2 filtra `status IN ('trialing','comp')` |
| el plan de las ocho | anclar `plan_version` en la histórica y en el grant | la consulta 1 agrupa por status, vertical y ciclo, no por plan |
| el id de preapproval de `F1`, `F2`, `F3` | el `provider_link` de la fila histórica | la consulta 2 sólo pregunta `mp_subscription_id IS NOT NULL` |

Es **una cuarta consulta read-only** sobre las mismas ocho filas, del mismo alcance que el owner ya
autorizó en la pregunta 24 de FASE 1A. No lee código, ni esquema, ni comportamiento.

---

## 2. El orden, y el punto de no retorno

### 2.1 De qué lado empieza: de VERTICALES, y no hay elección

`F-8A3-009` lo nombra en su paso 5 y ninguna de las dos mitades lo dice: la fila de `trial` pide
*«referencia al plan de trial»* y *«referencia a las versiones vigentes al arrancar»* (`V/02` §2.2),
que son filas de `plan_version` — la unidad **`V2`** de la épica de verticales. Y `billing_option`
cuelga de `plan_version`, así que **`B2` también espera a `V2`** (ya declarado: `B/descomposicion.md`
§2, *«La única sin ninguna atadura con la pasarela… es **B2**: su gate es `V2`, de la otra épica»*).

**Ninguna fila se escribe antes de que el catálogo exista.** No es una preferencia: sin
`plan_version` no hay a qué apuntar, y el contrato no admite una fuente sin referencia
([`02-R2-resuelto.md`](./02-R2-resuelto.md) §1.3, *«una fuente sin referencia resoluble no se puede
expresar»*).

### 2.2 Entre los dos actos irreversibles: se AUTORIZA primero

`F-8C2-001` plantea el par y no elige. Los dos son irreversibles y hay que elegir igual:

| | **Orden A — cancelar primero** | **Orden B — autorizar primero** |
|---|---|---|
| qué pasa en la ventana | la persona **no tiene compromiso** vivo | conviven **dos** preapprovals del mismo pagador (`EX-6`) |
| si sale mal | abandona el checkout, `S3` cancela el nuevo a las 72 h, y el viejo **ya no existe** (`PA-5`) | el viejo llega a su fecha dentro de la ventana y **cobra** |
| ¿se puede deshacer? | **no.** `ABANDONED → ACTIVE` no existe y cancelar en el proveedor es irreversible | **sí.** Un cobro se reembolsa: `refund` existe (`B/02` §2.3) |
| ¿se puede evitar? | **no.** «¿va a completar el checkout?» no es dato | **sí.** Las tres fechas de cobro están medidas |

> **El orden es B: se autoriza primero.** El criterio no es cuál falla menos: es **cuál falla de
> forma reversible**. La falla de A deja a una persona que nos estaba pagando sin título y sin
> camino de vuelta; la de B mueve plata que se puede devolver. Y la de B, además, **se puede
> programar fuera de la ventana**, porque las tres fechas —2026-09-26, 2026-11-25, 2026-11-30— están
> medidas y son de las pocas cosas del programa que se conocen con anticipación.

**Va en `B/21` §3.2 (a), reemplazando *«No hay nada que parar ni que coexistir»*.** Esa frase es la
que hoy niega la única coexistencia que el programa sí necesita, y `F-8C2-001` la cita como el lugar
donde el diseño lo permite.

Y van con él **dos condiciones**, sin las cuales el orden B no vale:

1. **El viejo se cancela cuando entra `S2`, no cuando vence `S3`.** `S2` es *«webhook de autorizada,
   confirmado por relectura»* (`B/03` §3.2): el instante en que el compromiso nuevo existe de verdad.
   Esperar a las 72 h alargaría la ventana de doble preapproval sin ninguna razón.
2. **Cada fila se ejecuta fuera de su fecha de cobro**, con margen. `B/03` §4 ya obliga a ese margen
   por otra razón medida —*«el cobro del proveedor llega tarde y el retraso es variable»*— y acá vale
   igual.

### 2.3 La secuencia completa

| # | paso | quién lo hace | qué lee | ¿reversible? |
|---|---|---|---|---|
| 0 | la cuarta consulta del §1.6 | quien ejecute la unidad del §4 | producción, sólo lectura | n/a |
| 1 | `V2` siembra `plan`, `plan_version` y sus claves | `V2` | — | sí |
| 2 | `B2` siembra `billing_option` | `B2` | `plan_version` | sí |
| 3 | `B9` deja los grants enchufados como fuente | `B9` | catálogo | sí |
| 4 | se escriben las **ocho** filas de título: 6 `trial` + 2 `permanent_grant` | la unidad del §4 | §1.6 + catálogo | **sí** |
| 5 | se verifica que `cobertura()` responde para los 8 `user + vertical` | ídem | contrato | sí |
| 6 | se contacta a `F1`, `F2`, `F3` y cada uno elige plan → `S1` | la persona | pricing | sí (`S3` limpia) |
| 7 | entra `S2` de esa persona | el proveedor | webhook + relectura | sí |
| 8 | **se cancela su preapproval viejo en el proveedor** | la unidad del §4 | `provider_link` histórico | **NO** |
| 9 | se escribe su `subscription` `CANCELLED` + `provider_link` (`R5-G`) | ídem | el id cancelado | sí |

**Los pasos 6 a 9 se ejecutan fila por fila, no en lote**, y la fila siguiente no arranca hasta que
la anterior cerró en el paso 9. Son tres.

> **El punto de no retorno es el paso 8, y es por fila, no por operación.** Antes de él todo se
> deshace: las filas de título se borran, y la suscripción nueva muere sola por `S3` cancelando su
> propio preapproval. Desde el paso 8, la fila de esa persona no tiene vuelta atrás, y las otras dos
> siguen enteras.

---

## 3. El rollback

`F-8C2-005` midió que la palabra no aparece en ningún documento de diseño. Acá aparece, y aparece
con su límite: **R5 puede escribir el rollback de la migración; no puede escribir el del programa.**

### 3.1 Hasta dónde se vuelve, por fila

| desde | qué se deshace | cómo |
|---|---|---|
| pasos 1–3 (catálogo) | todo | son filas de catálogo; se corrigen y se vuelven a sembrar |
| paso 4 (títulos) | **todo** | se borran las filas de `trial` y de `permanent_grant`. Ninguna tocó al proveedor |
| paso 6 (`S1`) | todo | `S3` la lleva a `ABANDONED` a las 72 h **y cancela su preapproval** (`B/03` §3.2) |
| paso 7 (`S2`) | todo, con costo | la suscripción nueva está viva: se la da de baja por `S11`, que cancela en el proveedor |
| **paso 8** | **NADA** | `PA-5`: cancelar en el proveedor es irreversible |
| paso 9 | la fila histórica se puede reescribir; **el hecho que registra, no** | — |

**Desde el paso 8 no hay vuelta atrás, y no es que sea caro: es que no existe.** Tres reglas del
propio diseño lo cierran, y las tres están escritas antes de este documento:
`CANCEL_SCHEDULED → ACTIVE` **no existe** —*«arrepentirse **no es una transición: es una suscripción
nueva**»*—, `CANCELLED → cualquier cosa` **no existe**, y `ABANDONED → ACTIVE` **no existe** porque
*«la ventana venció y el preapproval se canceló»* (`B/03` §3.3). La vuelta atrás de un paso 8 no es
un rollback: es **un alta nueva, con un consentimiento nuevo de la persona**.

### 3.2 Qué queda inconsistente si se corta en el medio

La pregunta que importa, porque la operación es de tres filas y se ejecuta de a una:

| se corta en | qué queda | ¿la persona tiene cobertura? | ¿hay riesgo de cobro? |
|---|---|---|---|
| después del 4, antes del 6 | títulos escritos, compromisos viejos vivos | **sí**, por su título | **sí**, el viejo cobra en su fecha — y es lo que hace hoy |
| entre el 6 y el 7 | una `PENDING_AUTHORIZATION` abierta | sí | ídem, más nada: la nueva no cobra hasta `S2` |
| **entre el 7 y el 8** | **dos preapprovals vivos** | sí | **doble**. Es la ventana, y es la que el §2.2 programa fuera de la fecha |
| después del 8, antes del 9 | el id cancelado **no es resoluble** | sí | no, pero un webhook tardío del viejo cae como huérfano en `09` §2.2 |
| con una fila hecha y dos no | mezcla | sí, las tres | sólo las no hechas, y en su fecha conocida |

**La única inconsistencia que no se repara sola es la de «después del 8, antes del 9».** Dura lo que
tarda una escritura y su reparación es escribir la fila: por eso el paso 9 existe como paso y no como
comentario.

### 3.3 Lo que este documento NO puede escribir, y es de `F-8C2-005`

**El programa despliega una sola vez y no tiene vuelta atrás, y eso sigue igual después de este
documento.** `DEC-ARCH-007` implicación 3 —*«La FASE 10 se desarrolla en paralelo y **despliega una
sola vez**»*— y el §65, que pone `rollback`, `rollout`, `coexistence`, `staging` y `feature flags`
como contenido obligatorio de la **FASE 7**, que se partió entre dos épicas que **no despliegan**.

R5 no puede cerrar eso: el rollback de *ocho filas* no es el rollback de *un reemplazo del sistema de
cobro*. Lo que R5 sí aporta es **acotarlo**: después de este documento, la parte irreversible del
despliegue que toca dinero real está **nombrada, fechada y acotada a tres filas y a un solo paso**.
Todo lo demás del despliegue —el código— es reversible por los medios habituales, porque **producción
nunca cobró nada** (`07-facts-inventory.md`, «El titular»). Sigue abierto, y es del owner (§7,
decisión 5).

---

## 4. Quién la ejecuta

`F-8A3-009` lo midió: la migración es un capítulo de las dos épicas y **no es una unidad de ninguna**
de las 22 (`V1`…`V9` en `V/descomposicion.md` §2, `B1`…`B13` en `B/descomposicion.md` §2), y cada
mitad delega en la otra — `B/21` §3.2 (a) remite a un *«§2.3»* que vive en la otra épica, y `V/21`
cierra diciendo que *«cómo se ejecuta la transcripción de las cinco —quién, cuándo, con qué
verificación— es FASE 7»*.

> **La migración es la unidad de trabajo 23, se llama `M1`, y vive en la épica de BILLING.**

**Por qué en billing y no en verticales**, aunque escriba seis filas de `trial`, que es una entidad de
verticales: porque **el riesgo de la unidad es el paso 8**, y el paso 8 es un acto contra el
proveedor. La unidad tiene que ser dueña de lo que puede salir mal, no de lo que tiene más filas.
Escribir un `trial` es un `INSERT`; cancelar un preapproval es irreversible.

| | |
|---|---|
| **unidad** | `M1` — *La migración de las ocho filas vivas* |
| **épica** | billing (`HOS-1354`) |
| **qué deja funcionando** | las ocho personas que hoy están en el sistema están en el nuevo, con su título, y las tres con compromiso vivo tienen uno nuevo y ninguno viejo |
| **capítulos** | `B/21` entero · `V/21` entero · `B/02` §2.2 y §2.4 · `V/02` §2.2 |
| **depende de** | `V2` y `V4` (verticales) · `B2`, `B3`, `B4`, `B9` (billing) |
| **guards** | — |
| **qué deja demostrado** | que `cobertura()` responde para los 8 `user + vertical`, y que ningún preapproval viejo queda vivo |

**Va en `B/descomposicion.md` §2, como fila 14 de la tabla, y en `V/descomposicion.md` §4, como la
línea que hoy no tiene sobre las filas vivas.**

**Y la referencia cruzada que esto crea es legítima, a diferencia de la que `F-8A3-009` denuncia.**
`NUCLEO/00-indice.md` declara que *«**las dos épicas no se referencian entre sí.** Lo único que cruza
es el contrato de cobertura»*, y eso es una regla sobre el **diseño**. `M1` depende de `V2` y `V4` en
el **grafo de ejecución**, que ya cruza y está declarado que cruza: `B2` tiene por gate a `V2`
(`B/descomposicion.md` §2). Lo que `F-8A3-009` denuncia no es una dependencia de orden: es un
**reenvío de contenido** —*«se transcriben según §2.3»*, a un § de otro archivo— y eso lo elimina
`R5-C`, que pone la operación completa en `B/21`.

---

## 5. Los caminos de los hallazgos, reejecutados

Cada camino se recorre **sobre el texto corregido** por `R5-A`…`R5-H`. Primero el que sigue llegando.

### `F-8C2-005` — SIGUE LLEGANDO en su paso 6; su paso 4 deja de ser cierto

| paso del hallazgo | qué pasa ahora |
|---|---|
| 1 · `DEC-ARCH-007` impl. 3: *«despliega una sola vez»* | **igual**. No se toca |
| 2 · el §65 pone `rollback` como contenido de FASE 7 | **igual** |
| 3 · impl. 4: las fases 5, 6 y 7 se parten limpio | **igual** |
| 4 · *«`rollback` aparece cero veces»*, medido con `rg` | **deja de ser cierto**: el §3 de este documento lo escribe para la migración |
| 5 · las descomposiciones cubren 2 de los 10 ítems de FASE 7 | **pasa a 3 de 10** para el alcance de `M1`: orden, grafo y **migración** |
| 6 · *«la estrategia de despliegue se partió entre dos épicas que no despliegan; y el que despliega no tiene fase que se la escriba»* | **SIGUE LLEGANDO, entero.** Es del programa, no de R5 |

**Qué lo cerraría**: la decisión 5 del §7. No se cierra escribiendo: se cierra decidiendo si el
despliegue del programa lleva flag, coexistencia y vuelta atrás, y quién escribe esa fase.

### `F-8C2-001` — NO LLEGA; corta en su paso 4. Su decisión de owner sigue viva

| paso | qué pasa ahora |
|---|---|
| 1 · `DEC-MIG-001` manda dar de alta y cancelar; los tres deben re-autorizar | **igual** |
| 2 · «dar de alta» es `B3`, con su ventana de 72 h y `S3` | **igual**, y ahora es el paso 6 de una secuencia escrita |
| 3 · «cancelar el viejo» es irreversible (`PA-5`) | **igual**, y ahora tiene nombre: es el **paso 8** |
| 4 · *«Orden A — cancelar primero…»* | **CORTA ACÁ.** El orden A está descartado por escrito, con su razón (§2.2) |
| 5 · *«Orden B — autorizar primero…»* | el orden B **es** el elegido, y sus dos riesgos tienen condición: cancelar en `S2` y programar fuera de la fecha |
| 6 · *«Ningún documento elige»* | **deja de ser cierto**: `B/21` §3.2 (a) elige, y dice por qué |

**Lo que sigue siendo del owner** es lo que el hallazgo dice que es suyo y no cambió: *«qué se le
promete a una de esas tres personas durante la ventana —y quién absorbe el costo si abandona el
checkout»*. El orden lo decide el diseño; la promesa, no (§7, decisión 2).

### `F-8C2-002` — NO LLEGA; corta en su paso 2, y sus pasos 5 y 6 también

| paso | qué pasa ahora |
|---|---|
| 1 · la persona del compromiso 2 tiene trial hasta el 2026-11-25 | **igual** |
| 2 · *«con eso está cubierta… y **no necesita re-autorizar nada**»* | **CORTA ACÁ.** Confunde cobertura con compromiso: está cubierta **y** tiene que re-autorizar, porque lo que se re-autoriza es el débito posterior al trial, no la cobertura (`R5-C`) |
| 3 · *«si no se le cancela… el preapproval viejo cobra»* | no ocurre: el paso 8 es obligatorio y va inmediatamente después de `S2` |
| 4 · *«si se le cancela y no se le da alta nueva…»* | no ocurre: el orden prohíbe cancelar antes de `S2` |
| 5 · la fila de `trial` pide `plan_version`, que es `V2`, y **nadie lo dice** | **deja de ser cierto**: §2.1 y `M1` lo declaran |
| 6 · *«el §2.3 al que la mitad billing remite **no existe en su archivo**»* | **deja de ser cierto**: `R5-C` y `R5-D` ponen la operación completa en `B/21` §2 |

**Lo que sigue siendo del owner**: el hallazgo dice *«si las cinco se transcriben **o** se dan de alta
de nuevo son dos promesas distintas»*. Con `R5-C` **no son dos promesas**, son una: se le conserva el
trial y se le pide que autorice el débito de después. Que esa sea la promesa correcta es comercial
(§7, decisión 2, la misma que `F-8C2-001`).

### `F-8A3-004` — NO LLEGA; corta en su paso 4 y en su paso 5

| paso | qué pasa ahora |
|---|---|
| 1 · el inventario cuenta ocho | **igual** |
| 2 · *«Detalle de las cinco que importan»* excluye las tres `abandoned` | **igual** como título de tabla, y `R5-A` le quita el papel de alcance |
| 3 · el capítulo 21 adopta ese cinco | **deja de ser cierto**: `R5-A` reemplaza la frase |
| 4 · *«los tres `abandoned`… reciben un trial completo»* | **CORTA ACÁ.** `R5-E` les escribe su fila; `R5-B` explica por qué no escribirla era una afirmación |
| 5 · *«las dos `comp` no tienen trial… si se transcriben literalmente se escriben como trial; si no, pierden su concesión»* | **CORTA ACÁ.** `R5-D`: `permanent_grant`, y **ninguna fila de `trial`**, porque nunca consumieron uno |

**Condicionado.** El paso 5 vuelve a llegar si el owner rechaza `permanent_grant` como instrumento
(§7, decisión 1). El hallazgo mismo lo declara: *«Necesita decisión del owner — **sí** para las dos
`comp`»*. El paso 4 no está condicionado a nada.

### `F-8B3-006` — NO LLEGA; corta en su paso 3

| paso | qué pasa ahora |
|---|---|
| 1 · se transcriben las cinco y la única regla escrita es la del trial | **deja de ser cierto**: son ocho y hay cuatro reglas de destino |
| 2 · las tres `trialing` son las únicas con vínculo vivo | **igual**, y es un hecho |
| 3 · *«Nada manda escribir `subscription` ni `provider_link` para ellas»* | **CORTA ACÁ.** `R5-G` manda escribir las dos, con su estado y su momento |
| 4 · llega el 2026-11-25, el webhook entra por un preapproval desconocido | no ocurre: el id quedó resoluble en el paso 9, y el barrido del `09` §2.2 lo encuentra |
| 5 · *«se le cobró y no tiene servicio»* | no ocurre: si llegara a cobrar, tiene título (su `trial`) y suscripción nueva |
| 6 · `DEC-MIG-002`: la cohorte crece con cada alta | **igual**, y es cierto. La regla escala fila por fila; el umbral está en el §7 |

### `F-8A3-009` — NO LLEGA; corta en su paso 1

| paso | qué pasa ahora |
|---|---|
| 1 · *«`V1` a `V9`… el capítulo 21 no aparece en la columna capítulos de ninguna»* | **CORTA ACÁ.** `M1` existe, está en billing, y lleva los dos capítulos 21 |
| 2 · `B/21` §3.2 (a) remite a un §2.3 que vive en la otra épica | **deja de ser cierto**: `R5-C` y `R5-D` escriben la operación en `B/21` §2 |
| 3 · *«las dos épicas no se referencian entre sí»* | **igual**, y `M1` no lo viola: cruza en el grafo de ejecución, como `B2` (§4) |
| 4 · la mitad verticales cierra con *«es FASE 7»* | **deja de ser cierto**: el procedimiento está en el §2 de este documento y su dueño en el §4 |
| 5 · *«las filas de `subscription` anclan una `plan_version`… ninguna de las dos mitades lo dice»* | **deja de ser cierto**: §2.1 lo dice, y es lo que fija de qué lado empieza |

**Pendiente de aplicar**, como todo lo de este documento: `M1` no existe hasta que alguien la escriba
en `B/descomposicion.md` §2 (§7, decisión 3).

---

## 6. El dominio recorrido — los 54 casos

El dominio son **48 celdas** (8 filas medidas × 6 entidades destino) más **6 órdenes** (3 filas con
compromiso vivo × 2 órdenes posibles). De los 48, la FASE 8 ya había probado fallando **11**; los 6
órdenes son los otros 6 de los «17 ya probados» del documento de dominios.

> **Una corrección de aritmética, no de conclusión.** La tabla de bloques de
> `00-dominios-de-los-racimos.md` §R5.5 suma 37 pero cuenta `D6` tres veces (en *«las 8 filas × D6»*
> y otra vez dentro de los bloques de `F6`–`F8` y de `F1`–`F3`) y deja afuera `(F1,F2,F3) × D1` y
> `(F1,F2,F3) × D5`. La partición correcta de los 37 sin mirar es: `F1`–`F3` × {`D1`,`D4`,`D5`,`D6`}
> = 12, `F4`–`F5` × {`D1`,`D2`,`D3`,`D5`,`D6`} = 10, `F6`–`F8` × {`D2`,`D3`,`D4`,`D5`,`D6`} = 15.
> **El total, 37, no cambia.**

### 6.1 Las 48 celdas

`✅` = cerrado, con regla escrita. `⛔` = abierto, y la última columna dice qué lo cierra.
`(8)` marca las 11 celdas que la FASE 8 ya había probado fallando.

| fila | `D1` `trial` | `D2` `subscription` | `D3` `provider_link` | `D4` concesión | `D5` `plan_version` + piso | `D6` `billing_option` |
|---|---|---|---|---|---|---|
| `F1` | ✅ fila con su fecha; `TRIAL_EXPIRED` por reloj | ✅ **(8)** dos: histórica `CANCELLED` + nueva por `S1` | ✅ **(8)** uno, en la histórica, con el id viejo | ✅ ninguna — el orden B la vuelve innecesaria | ✅ sí; piso = catálogo del día (`R5-F`) | ✅ mensual, de la versión que elija |
| `F2` | ✅ ídem | ✅ **(8)** ídem | ✅ **(8)** ídem | ✅ ninguna | ✅ ídem | ✅ ídem |
| `F3` | ✅ ídem | ✅ **(8)** ídem | ✅ **(8)** ídem | ✅ ninguna | ✅ ídem | ✅ ídem |
| `F4` | ✅ **nada**: nunca consumió trial | ✅ nada: sin compromiso (`S13`) | ✅ nada: `mp_subscription_id` nulo, medido | ⛔ **(8)** `permanent_grant`, recomendado | ⛔ la `version_de_plan` del grant | ✅ nada: un grant no tiene ciclo |
| `F5` | ✅ **nada** | ✅ nada | ✅ nada | ⛔ **(8)** ídem | ⛔ ídem | ✅ nada |
| `F6` | ✅ **(8)** fila consumida, con su fecha | ✅ nada: sin compromiso, medido | ✅ nada: sin id | ✅ nada, salvo apartamiento firmado | ✅ sí; piso = catálogo del día | ✅ nada |
| `F7` | ✅ **(8)** ídem | ✅ nada | ✅ nada | ✅ nada | ✅ ídem | ✅ nada |
| `F8` | ✅ **(8)** ídem, vertical **Turista** | ✅ nada | ✅ nada | ✅ nada | ✅ ídem | ✅ nada |

**Cuarenta y cuatro de cuarenta y ocho.** Los cuatro abiertos son las dos celdas de `D4` y las dos de
`D5` de `F4` y `F5`, y las cuatro se cierran con **una sola decisión**: si el instrumento de una
cortesía perpetua heredada es `permanent_grant`, su `version_de_plan` queda determinada por `E-3` de
[`02-R2-resuelto.md`](./02-R2-resuelto.md) §2.2 — que también es una decisión abierta del owner, y es
la misma.

**Qué agrega el recorrido, y no estaba enumerado.** Tres cosas:

1. **`D6` no aplica a cinco de las ocho filas.** El bloque *«las 8 filas × `D6`»* que el dominio
   enumeraba —*«las 8 son mensuales: hay un ciclo y un precio que nadie escribe»*— se contesta 3 y 5:
   el ciclo se hereda sólo donde hay suscripción. Un grant y un trial no tienen precio.
2. **Las celdas `D2`/`D3` de `F1`–`F3` no son una fila cada una: son dos.** El dominio las enumeró
   como *«(`F1`,`F2`,`F3`) × `D2` `subscription`»*, una celda por fila; el recorrido muestra que cada
   una necesita **dos** suscripciones con estados distintos y **una sola** de ellas se escribe a mano.
3. **`D5` es la única entidad destino que las ocho filas comparten**, y es también la única cuyo
   contenido **no se puede transcribir** (`R5-F`). Que el campo más universal sea el único
   irrecuperable no estaba a la vista en la enumeración.

### 6.2 Los 6 órdenes

| # | fila | orden | veredicto |
|---|---|---|---|
| 1 | `F1` | A — cancelar primero | ❌ descartado: su trial vence el 2026-09-26 y llega a FASE 10 **expirado**, así que A la deja sin ningún título durante la ventana |
| 2 | `F1` | **B — autorizar primero** | ✅ elegido. Su fecha de cobro es la más cercana y la más conocida: programable |
| 3 | `F2` | A | ❌ descartado: aunque su trial la cubra, si abandona el checkout no hay vuelta (`PA-5`) |
| 4 | `F2` | **B** | ✅ elegido, con la ventana fuera del 2026-11-25 |
| 5 | `F3` | A | ❌ ídem |
| 6 | `F3` | **B** | ✅ elegido, con la ventana fuera del 2026-11-30 |

**Seis de seis.** Y el recorrido deja ver algo que el par A/B no mostraba: **para `F1` los dos órdenes
no son simétricos como para `F2` y `F3`.** El argumento de que *«el trial transcripto lo cubre»* —que
`F-8C2-001` usa en su paso 4 para atenuar el orden A— **es falso para `F1`**, porque su trial ya
habrá vencido. Si alguien eligiera A, `F1` sería el caso donde más daño hace, y es la primera de las
tres por fecha.

### 6.3 El recuento de los 54

| bloque | casos | cerrados | abiertos |
|---|---|---|---|
| 8 filas × 6 entidades destino | 48 | **44** | **4** |
| 3 filas con compromiso vivo × 2 órdenes | 6 | **6** | 0 |
| **total** | **54** | **50** | **4** |

**Cincuenta cerrados, cuatro abiertos.** Los cuatro están abiertos por **una** decisión comercial
—qué instrumento recibe una cortesía perpetua heredada— y ninguno por falta de análisis: los 54
tienen veredicto escrito.

**Y dos cosas que el dominio no contaba como casos y este documento contesta igual**: la migración
**sí** es una unidad de trabajo, la 23 (`M1`, §4), y `rollback` **sí** aparece ahora en un documento
de diseño, acotado a la migración (§3).

---

## 7. Qué requiere decisión del owner

Seis, cada una con lo que cuesta y lo que arriesga no hacerla. Y el umbral, al final.

1. **El instrumento de `F4` y `F5`: `permanent_grant`, una fila por vertical, `hasta: NO_VENCE`.**
   **Costo**: firmar dos grants, y aceptar `E-3` (`permanent_grant.version_de_plan`) que
   [`02-R2-resuelto.md`](./02-R2-resuelto.md) §2.2 ya recomienda por otra razón.
   **Riesgo de no decidir**: es el único bloqueo de las 4 celdas abiertas. Si no se decide, esas dos
   personas quedan sin destino escrito y `F-8A3-004` vuelve a llegar en su paso 5 — o, peor, alguien
   las transcribe literalmente según `V/21` §2.3 y **les escribe un trial que nunca tuvieron**.

2. **Qué se le promete a `F1`, `F2` y `F3` durante la ventana, y quién absorbe el costo si alguno
   abandona el checkout.** Es la decisión que `F-8C2-001` y `F-8C2-002` declaran del owner, y el §2
   **no la toma**: el §2 toma el orden.
   **Costo**: una conversación con tres personas, y decidir si se les ofrece algo por volver a
   autorizar un débito que nunca se les cobró.
   **Riesgo de no decidir**: el orden B queda escrito y su paso 6 —*«se contacta»*— sin guion. El
   atenuante que `DEC-MIG-001` ya registró sigue valiendo: *«nunca se les cobró nada, así que no
   pierden dinero»*.

3. **Crear `M1` como unidad 23 en `B/descomposicion.md` §2, con dueño.**
   **Costo**: una fila en una tabla, y aceptar que billing lleva una unidad que escribe filas de una
   entidad de verticales (§4 explica por qué).
   **Riesgo de no hacerlo**: `F-8A3-009` vuelve a llegar entero, y es *«el candidato natural a
   descubrirse el día del despliegue»*. Nota: [`01-R6-resuelto.md`](./01-R6-resuelto.md) §5 ya pide
   **otra** unidad nueva —*«sacar `commerce` de fuentes activas»*—; son dos, y no son la misma.

4. **Autorizar la cuarta consulta read-only del §1.6.**
   **Costo**: una consulta, del mismo alcance que la pregunta 24 de FASE 1A ya autorizó. No lee
   código ni esquema.
   **Riesgo de no hacerlo**: tres de las ocho filas **no se pueden escribir** — no se conocen sus
   fechas — y las otras cinco se escriben sin saber a qué plan anclarlas. Es la precondición del
   paso 0, y es lo más barato de todo el racimo.

5. **El rollback del PROGRAMA — sigue abierto, y R5 no lo puede cerrar.**
   **Costo**: decidir si la FASE 10 despliega con flag, con coexistencia o de una sola vez, y quién
   escribe esa fase dado que las dos épicas no despliegan (`DEC-ARCH-007` impl. 3 y 4).
   **Riesgo de no decidir**: es el paso 6 de `F-8C2-005`, el único camino que sigue llegando después
   de este documento. Atenuante medido, y no es chico: **producción nunca cobró nada**, así que hoy
   la parte irreversible del despliegue son exactamente los tres pasos 8 del §2.3.

6. **Aplicar las ocho reglas a los archivos.** Nada de este documento tiene efecto hasta que el texto
   esté en `V/21`, `B/21`, `01-decision-log.md` y las dos descomposiciones (la lista completa, al
   final). **Riesgo**: los seis caminos vuelven a llegar, porque `DEC-METH-004` los evalúa sobre el
   texto corregido y el texto corregido todavía no existe.

### 7.1 El umbral: desde dónde el método deja de servir

La transcripción manual es barata **porque son pocas**, y `DEC-MIG-002` lo declara sin adornos:
*«Lo que esta decisión NO afirma: que la transcripción manual escale»*. El owner decidió el
2026-09-19 seguir tomando altas, con motivo escrito, y esto **no lo discute**. Lo que sigue es lo
único útil que se puede decir: **cuál es el umbral.**

Son dos, y el segundo no es un número de filas.

**Umbral 1 — el volumen: alrededor de veinte filas.** No porque escribir la número veintiuno cueste
más, sino porque los pasos 6 a 9 se ejecutan **fila por fila y en serie** (§2.3), cada uno con una
conversación, una ventana de hasta 72 h y un acto irreversible verificado uno por uno. Hasta unas
veinte, eso entra en una operación que una persona puede sostener y verificar de punta a punta. Por
arriba, la verificación deja de ser por fila y pasa a ser por muestreo — y **un muestreo sobre actos
irreversibles no es una verificación**.

**Umbral 2 — el primer cobro, y es el que manda.** Hoy el dominio destino son **seis** entidades
porque **producción nunca cobró nada** (`07-facts-inventory.md`: *«Pagos registrados | **0**»*). El
día que cobre la primera, el dominio pasa a **ocho**: aparece `payment` —*«suscripción, monto,
moneda, estado, **id del hecho en el proveedor**»*, con `UNIQUE(proveedor, id_del_hecho)`— y aparece
`receipt`, con **`UNIQUE(numero)`, sin huecos** (`B/02` §2.3). Y ninguna de las ocho reglas de este
documento describe qué se hace con ellos.

> **El umbral real no es cuántas filas hay: es si alguna ya cobró.** Con cero pagos, migrar es
> escribir títulos y volver a pedir un consentimiento. Con un pago, migrar pasa a incluir **una serie
> de comprobantes sin huecos**, que es lo único de todo el modelo que no se puede reconstruir después
> ni escribir a mano sin romper su propia restricción.

`F-8B3-018` midió que ese día está agendado —el 2026-09-26— y el owner decidió no tratarlo como
bloqueante, con motivo escrito: *«los pocos que hay son conocidos y se les puede hablar»*. Esto no lo
contradice. Lo que agrega es **qué mirar ese día**, que es una pregunta y no una alarma: *¿cobró, y
hay un comprobante emitido?* Si la respuesta es que no —porque falló, o porque se canceló antes—, el
método sigue sirviendo tal como está escrito. Si es que sí, **el §1 de este documento necesita dos
filas más** y la cuarta consulta del §1.6 necesita dos columnas más.

---

## Qué queda pendiente de aplicar

Este documento **no edita ningún archivo**. Las ocho reglas son texto a pegar, y hasta que se pegue,
los seis caminos siguen llegando sobre el texto de hoy.

| regla | archivo | dónde |
|---|---|---|
| `R5-A` | `V/21-migracion.md` · `B/21-migracion.md` | §2.2, reemplaza *«son cinco relaciones»* · §1.2, la tabla |
| `R5-B` | `V/21-migracion.md` | §2.4 **nueva** |
| `R5-C` | `V/21-migracion.md` · `B/21-migracion.md` | encabezando §2.3 · §3.2 (a) |
| `R5-D` | `B/21-migracion.md` | §2 **nueva** — el § que hoy falta en ese archivo |
| `R5-E` | `V/21-migracion.md` | §2.3, tercera fila de la tabla |
| `R5-F` | `V/21-migracion.md` | §2.3, tercera consecuencia |
| `R5-G` | `B/21-migracion.md` | §2 nueva |
| `R5-H` | `01-decision-log.md` | `DEC-MIG-001`, implicación 6 |
| `M1` | `B/descomposicion.md` · `V/descomposicion.md` | §2, fila 14 · §4 |
| el orden | `B/21-migracion.md` | §3.2 (a), reemplaza *«No hay nada que parar ni que coexistir»* |
| el rollback | `B/21-migracion.md` | §5 **nueva** |

---

## Lo que este documento NO decide

- **No reabre `DEC-ARCH-004` a `007` ni `DEC-MIG-002`.** El orden, el dueño y el rollback se
  escribieron **dentro** de esas decisiones, incluida la partición en dos épicas.
- **No ejecuta la migración ni escribe un script.** `DEC-MIG-001` sigue mandando cero lógica de
  conversión, y `R5-H` sólo aclara qué quiere decir eso.
- **No clasifica el código legacy.** Las 27 tablas del gap siguen sin medir y `DEC-METH-003` sigue
  cerrado. Todo lo de acá cuantifica sobre las **ocho filas medidas**, y nada más.
- **No afirma qué significa `abandoned` en el sistema actual.** Lo medido es `trial_end` no nulo y
  `mp_subscription_id` nulo. Si esas tres filas representan trials que corrieron o checkouts que
  nunca se completaron **no es sostenible todavía**: leerlo pide código, o sea FASE 5.
- **No decide el despliegue del programa.** El §3.3 dice con todas las letras hasta dónde llega el
  rollback que R5 puede escribir, y el §7 decisión 5 deja el resto donde estaba.
