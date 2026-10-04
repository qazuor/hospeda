---
title: "FASE 8 vuelta 2 · A2 — máquinas, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · A2 — máquinas, carreras y huérfanos

Recorrí las tres máquinas de verticales de `V/03` (Trial `T1`–`T8`, Publicación `PB1`–`PB12` con
el lock por `user + vertical` y el reconciliador diario de cobertura, Postulación de Partner
`PP1`–`PP3`), las reglas de lectura de `NUCLEO/03` §1, los seis hechos del reloj de `NUCLEO/01`
§1.2, el modelo de `V/02` (§2.2, §2.5, §2.7, §3, §4), `V/11` §3 y §8, `V/18`, la tabla de
nacimiento del corte de `V/21` §2.4 y el aviso, el empuje inverso y la dirección inversa del
contrato (`12-contrato…` §2, §3, §4.1). Crucé cada tabla de transiciones contra los eventos que
el contrato y el núcleo emiten, buscando estados sin salida, eventos que dos filas leen a
destiempo, locks que una transición toma y otra no, y filas que quedan colgando. Medí contra el
HEAD `1cccd9119d` del worktree `hospeda-spec-hos-1352-billing-redesign`.

Son **8 hallazgos**: **0 CRITICA, 1 ALTA, 5 MEDIA y 2 BAJA**. La idea más grave: el camino que
el propio corte le nombra al dueño que contrata por teléfono —contratar, y que sus fichas vuelvan
solas por `PB3`— **nunca ejerce el evento de activación**, así que ni `T6` ni `T8` le consumen el
trial: paga meses, cancela, y el día que publica sin cobertura `T1` le regala un trial completo.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2A2-001 — El dueño del corte que contrata sin publicar se guarda el trial para cuando cancele

**Qué se rompe.** `T6` y `T8` son las dos filas que escriben la fila de `trial` consumida de
quien ya es cliente, y las dos cuelgan del evento de activación: `T6` **es** ese evento y `T8`
exige que ya se haya ejercido, leído del registro del sistema nuevo. Para una vertical con ficha
el evento es `PB1`. Pero el dueño del corte que contrata sin publicar nunca hace un `PB1`: sus
fichas nacen `UNPUBLISHED_BY_BILLING` y **vuelven solas por `PB3`**, y el diseño dice en dos
lugares que restituir no es publicar. Queda pagando, con sus fichas a la vista, en `PRE_TRIAL`
**sin fila**. El día que cancela y publica sin cobertura, `T1` —que no mira si ya ejerció el
evento— le arranca un trial completo con el plan de `rank` más alto. Es exactamente la puerta
que el diseño dice que `T6` existe para cerrar: *«se guardaría un trial para el día que
cancele»*. Y no es un borde: es el procedimiento que `V/21` §2.4 describe para la cartera del
corte (*«se los llama»*, *«al contratar, las fichas vuelven solas por `PB3`»*), y el anfitrión de
una sola ficha —el caso típico— no vuelve a hacer ningún `PB1` en toda su vida de cliente.

**El camino.**

1. Juan tenía una ficha pública en el sistema viejo. El corte la hace nacer
   `UNPUBLISHED_BY_BILLING` y a Juan en `PRE_TRIAL` sin fila (`2g`).
2. Lo llaman, contrata por el checkout (no pasa por el botón de la fila 23). Su suscripción
   emite y `cubierto` pasa a verdadero; `PB3` le republica la ficha.
3. A los 30 minutos se acredita el primer pago: el aviso despierta `T8`, pero la guarda *«ya
   ejerció el evento de activación»* lee el registro nuevo y no encuentra ningún `PB1`. `T8` no
   dispara. `T6` tampoco: su evento es el `PB1` que nunca ocurrió.
4. Juan paga ocho meses, cancela. `PB2` baja la ficha.
5. Dos meses después Juan publica un borrador nuevo sin cobertura: `T1` cumple todas sus
   guardas (evento, días > 0, `cubierto` falso, admite altas, sin fila de hash) y le arranca un
   trial con las capacidades del premium, gratis, a un ex-cliente de ocho meses.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:210`
  — "resuelto el 2026-09-26). Al contratar, las fichas que siguen"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:211`
  — "abajo vuelven solas por `PB3`, hasta llenar el cupo (FASE 9 vuelta 1, R1; owner 2026-09-26,"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1027`
  — "y `PB7` hace lo mismo un estado más atrás: restituir no es publicar. Leerlo al revés le"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:70`
  — "haber publicado en el sistema viejo no cuenta, así que todo dueño del corte llega acá"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:221`
  — "un pago después. El registro del evento de activación es el que `T7` ya lee (abajo), así que"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:487`
  — "escribirla esa persona se guardaría un trial para el día que cancele — un trial gratis para"

**Qué haría falta decidir o escribir.** Si la vuelta de una ficha por `PB3`/`PB7` bajo un título
que convierte cuenta, para `T8` (y para el registro que lee `T7`), como ejercicio del evento de
activación —sólo para esa guarda, sin que restituir pase a ser publicar para `T1`—, o si el owner
acepta que la cartera del corte que contrata sin publicar conserva su trial para después de
cancelar (y entonces el ⚠️ tiene que decirlo donde `2g` se aplica).

## MEDIA

### F-8V2A2-002 — «El lock de la máquina de trial» se nombra y no se define, y `T8` puede perder la carrera contra `PB1`

**Qué se rompe.** El contrato y `T4` apoyan una garantía (*«`T3` y el canje no se pisan»*) en un
lock de la máquina de trial que ningún texto define: ni qué clave toma, ni qué filas lo toman
(la de `T3` no lo nombra), ni si es el mismo lock por `user + vertical` que toma `PB1`. Donde
más importa es en el par `T6`/`T8`, cuyas guardas leen cada una lo que escribe la otra
transacción: `T6` lee `cobrada` y `T8` lee el registro del `PB1`. Si el primer pago se acredita
mientras `PB1` está en vuelo, cada una ve el estado anterior de la otra y ninguna escribe la
fila; como el evento de `T8` ocurre una sola vez, nadie la escribe después. La persona queda
pagando en `PRE_TRIAL` y termina como en el paso 5 del hallazgo 001. Sólo lo cierra que `T8`
evalúe dentro del mismo lock que `PB1`, y eso no está escrito.

**El camino.**

1. Juan se suscribe antes de publicar; su fila trae `cobrada: no`.
2. A los 30 minutos publica: `PB1` toma el lock, ve `cubierto` verdadero, evalúa `T6` con
   `cobrada: no` y no dispara.
3. En el mismo instante Mercado Pago acredita el primer cobro; el aviso despierta `T8`, que lee
   el registro de eventos antes de que el `PB1` de Juan esté commiteado: *«no ejerció»*.
4. Commitea `PB1`. Ni `T6` ni `T8` escribieron la fila; ninguna transición la va a escribir.
5. Juan cancela meses después y su próxima publicación sin cobertura dispara `T1`.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1068`
  — "techo ya aplicado (`V/11` §3) y dentro del lock de la máquina de trial, así que `T3` y el canje no"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:808`
  — "Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y"
- El silencio: `rg -n -F "lock de la máquina" $V $D/nucleo $D/12-contrato-de-cobertura.md`
  devuelve sólo el contrato:1068, `V/descomposicion.md`:57 y `B/14`:344, las tres como
  referencia; ninguna define la clave ni las filas que lo toman.

**Qué haría falta decidir o escribir.** Qué es ese lock (clave y filas que lo toman, `T3` y `T8`
incluidas) y si coincide con el de publicación; si no coincide, cómo se evalúan `T6` y `T8` para
que su carrera no deje la fila sin escribir.

### F-8V2A2-003 — `T4` mira el estado y no la fecha: con `T3` atrasado, un canje revive un trial ya vencido

**Qué se rompe.** El contrato deja de emitir la fuente de trial cuando pasa su `hasta`, con o sin
`T3`, y el reconciliador baja la ficha y escribe el hecho 5. Pero la máquina sigue en
`TRIAL_ACTIVE` hasta que corra el job de `T3`, y la condición de `T4` es sólo el estado. Un canje
de extensión que llega en esa ventana es `ACEPTADA`: corre la fecha de fin hacia adelante, la
fuente vuelve a emitirse y `PB3` republica. Es lo que el §32 prohíbe con *«nunca después»*, y
`V/11` §7 declara que el cruce con la campaña de recuperación es imposible *por construcción*
justamente porque ningún camino extiende un trial vencido.

**El camino.**

1. El trial de Juan vence el lunes; el job de `T3` está caído desde el domingo.
2. El martes la fuente ya no se emite; el reconciliador le baja la ficha (`PB2`, hecho 5).
3. El miércoles Juan canjea un código *«+15 días»*: `extenderTrial` corre `T4`, la máquina está en
   `TRIAL_ACTIVE`, el techo alcanza: `ACEPTADA`.
4. La fecha de fin pasa a ser el lunes + 15; la fuente vuelve, `PB3` le republica la ficha. Juan
   obtuvo días de trial después de vencido.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:76`
  — "Y desde la fecha de fin de servicio de su vertical, `TRIAL_ACTIVE` tampoco es fuente viva,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:392`
  — "El `hasta` es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:354`
  — "única transición que extiende es T4, que exige `TRIAL_ACTIVE`. Entre las dos no hay"

**Qué haría falta decidir o escribir.** Si la guarda de `T4` (canje y cortesía) exige además que
la fecha de fin no haya pasado, o si `extenderTrial` corre `T3` primero cuando la encuentra
vencida.

### F-8V2A2-004 — `PB8`, `PB9`, `PB10` y `PB11` no están en ninguna lista del lock, y la única irreversible compite con dos

**Qué se rompe.** El § del lock clasifica las transiciones en las que ocupan cupo (toman el lock) y
las que lo liberan (no lo necesitan), y en esa segunda lista nombra `PB4`, `PB6`, `PB10` y `PB12`.
`PB9` —el hard delete— no está en ninguna, igual que `PB8` y `PB11`. `PB9` sale de `ARCHIVED`, el
mismo `desde` de `PB7` (que sí toma el lock) y de `PB8` (acto del dueño). El diseño ya acepta que
una transición sin lock actúe sobre una lectura vieja (`PB4` contra `PB3`, devuelto por el
reconciliador); para `PB9` no hay devolución: `PURGED` es final y el reconciliador no lo mira. El
día que más gente actúa sobre una ficha archivada es el que el aviso le imprime como fecha de
borrado, que es el mismo día que corre `PB9`.

**El camino.**

1. A Juan le llega el aviso de archivado: *«el contenido se borra a partir del 12/03»*.
2. El 12/03 a la mañana corre el job de `PB9`: lee `inactiva_desde` y el estado `ARCHIVED`, relee
   la cobertura (falsa).
3. En el mismo minuto Juan entra y reactiva la ficha (`PB8`, hecho 1) o paga y el aviso dispara
   `PB7`.
4. Nada ordena a `PB9` contra `PB8`/`PB7`: si `PB9` escribe sobre la lectura del paso 2, borra el
   contenido que Juan acaba de reactivar (o que su pago acaba de restituir), sin marca y sin red.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:827`
  — "Las que liberan cupo no lo necesitan —`PB4`, `PB6`, `PB10`, `PB12`—: una carrera con ellas"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:854`
  — "sin lock puede archivar una ficha que `PB3` acaba de republicar. Las dos las devuelve el"
- El silencio: `rg -n "PB9" .../03-maquinas-de-estado.md | rg -i lock` no devuelve nada (exit 1).

**Qué haría falta decidir o escribir.** Si `PB9` toma el lock por `user + vertical` y relee
estado, reloj y cobertura dentro de él (o una regla general: toda transición verifica su `desde`
en la misma escritura), y a qué lista van `PB8` y `PB11`. La misma pregunta vale para `PB10`
contra `PB3`: una moderación que se cruza con una restitución puede dejar publicada la ficha que
el admin acaba de bajar.

### F-8V2A2-005 — La guarda de `PP1` por correo deja a un tercero bloquear la postulación legítima

**Qué se rompe.** `PP1` rechaza una postulación si hay otra `PENDIENTE` del mismo correo, o una
`RECHAZADA` dentro de la espera. El formulario es público y *«cualquiera puede escribir cualquier
dirección»*: quien carga el correo de otro negocio le ocupa el lugar, y cuando el admin rechaza la
basura, le arranca la espera al dueño real. Además la guarda no es una restricción de la tabla, así
que dos envíos simultáneos pasan los dos y dejan dos `PENDIENTE` —y, aprobadas, dos filas de
Partner— para un mismo correo.

**El camino.**

1. Un competidor completa el formulario con el correo de Juan y contenido inventado: `PENDIENTE`.
2. Juan intenta postularse: `PP1` lo rechaza, porque ya hay una `PENDIENTE` de su correo.
3. El admin rechaza la postulación falsa (`PP3`); se le comunica a Juan, que nunca la envió.
4. Juan vuelve a intentar: `PP1` lo rechaza durante toda la espera configurable.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:230`
  — "así que cualquiera puede escribir cualquier dirección."
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:489`
  — "La unicidad de `PENDIENTE` por correo y la espera tras un rechazo son la guarda de `PP1`, no una restricción de la tabla"

**Qué haría falta decidir o escribir.** Si la guarda de `PP1` mira un correo probado (y no uno
escrito en un formulario público), o si el admin tiene cómo anular la espera; y si la unicidad
de `PENDIENTE` por correo es una restricción de la base.

### F-8V2A2-006 — `PURGED` promete tratar «uno por uno» lo que cuelga de la ficha y enumera dos

**Qué se rompe.** `V/02` §4.1 dice que el borrado es del contenido y no de la fila, y que por eso
*«lo que cuelga de la ficha se trata acá, uno por uno»*; después trata las reseñas y el
calendario. En el código actual cuelgan de la ficha además las conversaciones con turistas
(`onDelete: restrict`), las alertas de precio de turistas, las promociones del dueño, los
listados y la reputación externos, la ocupación y los datos de IA. Sin `DELETE` de la fila,
ninguno cae por arrastre y ninguno tiene fila de tratamiento: quedan colgando de una ficha que
no existe, cada implementador decide qué pasa con ellos, y algunos son datos de terceros
(`DEC-DATA-005`).

**El camino.**

1. Juan, turista, creó una alerta de precio sobre la ficha de Ana y le escribió dos mensajes.
2. La ficha de Ana llega a `PURGED` por `PB9`.
3. El job de alertas sigue evaluando una ficha sin contenido ni precio; la bandeja de Juan muestra
   una conversación sobre algo que no existe, y nadie decidió si Ana puede seguir contestando.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:614`
  — "así que ningún `ON DELETE CASCADE` corre y lo que cuelga de la ficha se trata acá, uno por uno"
- (código actual) `rg -l "references\(\(\) => accommodations\.id" packages/db/src` devuelve
  además de reseñas, media, FAQ y calendario: `conversations`, `tourist_price_alerts`,
  `owner_promotion`, `accommodation_external_listings`, `accommodation_external_reputation`,
  `accommodationOccupancy` y `accommodation_iaData`.

**Qué haría falta decidir o escribir.** La lista cerrada de lo que cuelga de `listing`, con el
tratamiento de cada uno al llegar a `PURGED` (se borra, se conserva oculto, se desactiva).

## BAJA

### F-8V2A2-007 — `T3` dice que arranca «el reloj de retención», que no es un efecto suyo

**Qué se rompe.** El reloj de retención es `listing.inactiva_desde`, y la lista de sus escritores
es cerrada y la vigila `G-R6-B`: `T3` no es ninguno. Lo que lo arranca cuando vence un trial es el
hecho 5, que ejecutan `PB2` o el recálculo por el cambio de `cubierto`. Quien implemente la celda
de efectos de `T3` al pie de la letra escribe la columna desde la máquina de trial y pone el guard
en rojo, o duplica el hecho 5.

**El camino.**

1. El trial de Juan vence (`T3`).
2. El implementador de V4 lee *«arranca … el reloj de retención»* y escribe `inactiva_desde` desde
   `T3`; `G-R6-B` lo rechaza como escritor fuera de la lista.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:53`
  — "arranca la campaña de recuperación si la vertical admite altas (`NUCLEO/07` §6; FASE 9 vuelta 1, `F-8V1A2-006`) y el reloj de retención;"

**Qué haría falta decidir o escribir.** Que la celda diga que el reloj lo arranca el hecho 5 por
el cambio de `cubierto`, como ya dice para la publicación.

### F-8V2A2-008 — El censo de emisores del aviso omite `T6`, `T7` y `T8`, que sacan una fuente

**Qué se rompe.** El contrato define que emite el aviso *«toda escritura que … agrega o saca una
fuente»* y enumera `T1`–`T5`. `T6`, `T7` y `T8` llevan de `PRE_TRIAL` a `TRIAL_CONVERTED`, y en
ese acto la fuente de trial de `PRE_TRIAL` deja de emitirse: sacan una fuente y no figuran. Hoy no
mueve plata (el caché se invalida por su propia fila, *«toda transición de la máquina de
trial»*), pero el censo que se declara cerrado está incompleto.

**El camino.**

1. Juan, cubierto por un grant, publica: `T6` le escribe la fila consumida y su fuente de pre-trial
   desaparece.
2. El implementador del emisor sigue el censo del contrato y no emite aviso desde `T6`.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:873`
  — "y `A6`; y `T1`, `T2`, `T3`, `T4` y `T5`, que mueven la fuente de trial, en las dos"

**Qué haría falta decidir o escribir.** Sumar `T6`, `T7` y `T8` al censo, o declarar por qué la
fuente de pre-trial que se apaga no emite.

## Ataques que intenté y el diseño resistió

- **`T1` y `T6` a la vez sobre el mismo par**: disjuntos por `cubierto`; y la carrera de dos
  escrituras de la fila la resuelve el `UNIQUE` de hash leído como guarda (`V/03` §2).
- **Dos `PB1` simultáneos pasando el cupo o dos fichas en trial**: el lock por `user + vertical`
  y el conteo adentro (`V/03` §9, `R14`).
- **`PB1` contra `PB2` dejando una ficha publicada sin cobertura**: `PB2` toma el mismo lock y
  relee (`F-8V1A2-008`).
- **Encendido del trial con ventana para ex-clientes**: `V/11` §8.3 exige los tres pasos como un
  solo acto.
- **`T2` contra `T3` al acreditarse el pago el día del vencimiento**: si gana `T3`, el mismo aviso
  mueve por `T5`; las dos filas tienen evento distinto.
- **Ficha moderada archivada o borrada por el reloj**: `PB4`/`PB5`/`PB9` no tienen `MODERATED` en
  su `desde`, y `PB11` reinicia con el hecho 6.
- **`PB7` publicando un borrador archivado por `PB5`**: mira el origen en el registro append-only.
- **Empuje de `PURGED` antes del commit**: el orden quedó fijado después del commit, con
  `fichaPurgada` como red.

## Fuera de mi vector

- **`admiteDestaque` admite `ARCHIVED` y `UNPUBLISHED_BY_BILLING`**: la razón por la que excluye
  `MODERATED` —vender un destaque que no se ve y se sigue cobrando— vale igual para una ficha
  archivada de un dueño cubierto (`12-contrato…` §4.1). Le toca al vector de addons/cobro.

## Key Learnings

1. Toda guarda que lee «ya ejerció el evento de activación» depende de que el camino principal
   pase por `PB1`; los caminos de restitución (`PB3`/`PB7`) la dejan ciega por diseño.
2. Dos transacciones cuyas guardas leen cada una lo que escribe la otra (`T6`/`T8`) necesitan el
   mismo lock, y el lock de la máquina de trial está nombrado pero no definido.
3. Una guarda de estado sin guarda de fecha falla cuando el job de reloj se atrasa: el contrato
   ya apaga la fuente por `hasta`, la máquina no.
4. La clasificación del lock en «ocupan» y «liberan» cupo deja afuera justo la transición
   irreversible (`PB9`).
