---
title: "FASE 8 vuelta 1 · A2 — máquinas, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · A2 — máquinas, carreras y huérfanos

Ataqué las máquinas de estado de la épica de verticales —trial (`T1`–`T8`), publicación
(`PB1`–`PB12`), postulación de Partner (`PP1`–`PP3`)— y su borde con la de addon de la épica de
billing (`A5`/`A6`), más las reglas de lectura del núcleo (`NUCLEO/03` §1). Busqué pares
`(estado, evento)` sin fila, estados sin salida para quien los habita, prosas que citan una tabla
que ya cambió, eventos que llegan en otro orden (el primer pago, el encendido, el reconciliador
diario leyendo en medio de una transición) y entidades que quedan colgando cuando algo del otro
lado cambia (una ficha borrada con un addon vivo, un trial en una vertical que se discontinúa).

Son **10 hallazgos**: **0 CRITICA, 2 ALTA, 6 MEDIA y 2 BAJA**. Lo más grave en una línea: una
ficha en `UNPUBLISHED_BY_BILLING` sin cobertura no tiene ninguna salida que el dueño pueda
ejecutar, y el camino que el corte le promete a toda la cartera vieja —«volver a publicar arranca
tu trial»— no existe en la tabla.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal en una sola línea
del archivo, con su `archivo:línea`; `$D`, `$V` y `$B` son los prefijos de la base de esta fase.

## ALTA

### F-8V1A2-001 — La ficha bajada por billing no tiene salida del dueño: «volver a publicar arranca el trial» es inejecutable

**Qué se rompe.** `PB1` sale sólo de `DRAFT`, `PB6` sólo de `PUBLISHED` y `PB8` sólo de
`ARCHIVED`. Una ficha en `UNPUBLISHED_BY_BILLING` de un dueño **sin cobertura** sólo puede salir
por `PB3` (exige que la cobertura vuelva), por `PB4` (el día 90) o borrándose (`PB12`). Pero dos
textos le prometen a esa persona que su próxima publicación le arranca el trial por `T1`: el
corte, a **toda la cartera vieja** (decisión `2g`: «sólo les respetamos la ficha»), y la rama del
primer cobro rechazado de `6c`. La ficha respetada no se puede publicar; la única forma de
estrenar el trial es crear un duplicado, y el cupo del trial es una ficha, así que cuando `T1`
vuelve `cubierto` verdadero, `PB3` no tiene lugar para la original. La otra vía es esperar 90
días a que `PB4` la archive y traerla con `PB8` a borrador. La fila 23 de `V/19` agrava el caso:
el botón de suscribirse manda a publicar a quien «todavía no publicó en esa vertical», y el dueño
viejo no tiene en el registro nuevo ningún `PB1`.

**El camino.**

1. Juan tiene una ficha publicada de Alojamiento en el sistema viejo y no tiene suscripción.
2. El corte le escribe `inactiva_desde` y lo deja en `PRE_TRIAL`; la primera corrida del
   reconciliador diario corre `PB2`: la ficha pasa a `UNPUBLISHED_BY_BILLING`.
3. Juan recibe la llamada, entra y quiere «volver a publicar» para estrenar su trial. No hay
   botón que lo haga: `PB1` exige `DRAFT` y no existe `UNPUBLISHED_BY_BILLING → DRAFT`.
4. Toca «suscribirme»; la fila 23 lo manda a publicar. Vuelve al paso 3.
5. Si crea una ficha nueva, `T1` dispara sobre ella, ocupa el único cupo del trial y la ficha que
   el owner quiso respetar sigue abajo; si no, espera al día 90 (`PB4`) y a `PB8`.

La misma forma alcanza a quien se suscribió antes de publicar, publicó en la ventana del primer
cobro y lo tuvo rechazado (`S16`): `V/03` §2 le dice que su próximo `PB1` arranca el trial, y su
ficha también quedó en `UNPUBLISHED_BY_BILLING`.

**La evidencia.**

- «publicar —o el botón de suscribirse, que manda a publicar a quien todavía no publicó en esa»
  — `$V/docs/21-migracion.md:155`
- «nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la tengan que»
  — `$V/docs/21-migracion.md:75`
- «despublica la primera corrida del reconciliador diario de cobertura»
  — `$V/docs/21-migracion.md:148`
- «persona queda en `PRE_TRIAL`: su próximo `PB1`, sin cobertura, arranca el trial por `T1`.»
  — `$V/docs/03-maquinas-de-estado.md:223`
- «`UNPUBLISHED_BY_BILLING`, desde donde no salía ninguna otra fila —`PB1` sale sólo de `DRAFT`—, y»
  — `$V/docs/03-maquinas-de-estado.md:584`
- «| PB6 | `PUBLISHED` | el dueño despublica | `DRAFT` | y **no devuelve el trial** (§10.2) |»
  — `$V/docs/03-maquinas-de-estado.md:511`
- «vertical. El cupo del trial es uno más de esos cupos, así que el invariante 6 queda cubierto sin»
  — `$V/docs/03-maquinas-de-estado.md:760`

**Qué haría falta decidir o escribir.** Si el dueño sin cobertura puede sacar su ficha de
`UNPUBLISHED_BY_BILLING` (a `DRAFT`, o publicándola con un `T1` que la tome como su ficha de
trial), y en qué estado amanece la ficha vieja del corte. Es una decisión del owner, porque
toca `2g` («les respetamos la ficha») y la regla de `UNPUBLISHED_BY_BILLING ≠ DRAFT`. Mientras
no se decida, dos implementadores de V6 hacen cosas distintas: uno agrega la salida que el texto
supone, el otro deja a la cartera entera abajo.

### F-8V1A2-002 — `V/03` sigue mandando el borrado de la ficha por `A5`, y reabre la colisión que `K-9` cerró

**Qué se rompe.** En la épica de billing el borrado de la ficha salió de la orfandad: `A6` es la
única fila que lo ejecuta, porque con `A5` y `A6` compartiendo `(ACTIVE, llegada a PURGED)` sin
guardas disjuntas la regla 7 del núcleo deja **sin correr a las dos** y el addon sigue cobrando.
Las notas de `PB9` y de `PB12` y la prosa de «la moderación y el borrado del dueño» siguen
diciendo que la llegada a `PURGED` deja **huérfano** al addon `LISTING` por `A5`. Quien
implementa el emisor en V6 lee eso y dispara la orfandad; quien implementa la tabla de addon ya
no tiene «borrado» en la condición de huérfano. Si se cablean las dos cosas, vuelve exactamente
el solapamiento que `K-9` describió; si se cablea sólo la de `V/03`, `A5` no corre porque la
condición de huérfano no se cumple mientras Juan sigue pagando la principal.

**El camino.**

1. Juan paga Premium en Gastronomía y un destaque mensual (`LISTING`) sobre su ficha.
2. Borra la ficha (`PB12`); la ficha llega a `PURGED`.
3. El implementador de V6 emitió «el addon queda huérfano» (`V/03`); en billing la orfandad de
   `LISTING` se lee sobre las principales vivas, y la de Juan está viva: `A5` no corre.
4. Si además se emitió «ficha borrada» y `A6` escucha, las dos filas comparten el par y, por la
   regla 7, ninguna se ejecuta.
5. El preapproval del destaque sigue debitando cada mes sobre una ficha que ya no existe.

**La evidencia.**

- «el addon `LISTING` que apuntaba a ella **queda huérfano** (`A5`)»
  — `$V/docs/03-maquinas-de-estado.md:514`
- «Es el evento que `B/16` §4.2 llama *«la ficha se borró»* —el addon `LISTING` queda huérfano y `A5`»
  — `$V/docs/03-maquinas-de-estado.md:681`
- «*«la ficha se borró»* es **cualquier llegada a `PURGED`**, así que `PB9` también deja huérfano al»
  — `$V/docs/03-maquinas-de-estado.md:683`
- «es la ÚNICA fila que ejecuta el borrado de la ficha»
  — `$B/docs/03-maquinas-de-estado.md:2484`
- «El borrado de la ficha ya no es orfandad: es sólo el evento de `A6`»
  — `$B/docs/03-maquinas-de-estado.md:2483`
- «leída al pie de la letra, **ninguna corría y el addon seguía cobrando**»
  — `$B/docs/16-addons.md:474`

**Qué haría falta escribir.** Corregir las tres menciones de `V/03` §9 para que digan `A6` (y el
evento que V6 emite: «la ficha llegó a `PURGED`», no «el addon quedó huérfano»). No hay decisión
nueva: `K-9` ya la tomó. El conteo de pares de `G-R4` no lo detecta porque lee tablas, y la
contradicción está en una nota.

## MEDIA

### F-8V1A2-003 — `T7` le consume el trial a quien sólo publicó con una suscripción que nunca cobró

**Qué se rompe.** `DEC-TRIAL-010` y `6c` construyeron `cobrada` para que un alta que no ocurrió
no consuma el trial: `T2`, `T5`, `T6` y `T8` esperan el primer pago. `T7` no: su guarda es «ya
ejerció el evento de activación» y declara que `cubierto` no participa. Con los días en cero se
puede publicar teniendo cualquier título, incluida una `SUSCRIPCIÓN` con `cobrada: no`. Si ese
primer cobro se rechaza, la persona nunca fue cliente, pero el registro append-only dice que
publicó, y el día del encendido `T7` le escribe la fila consumida. La tabla que justifica `T7`
dice «ya fue cliente», y este sujeto no lo fue.

**El camino.**

1. Partner (o cualquier vertical) tiene los días de trial en cero.
2. Juan se suscribe, y en los minutos antes del primer cobro publica: `PB1` pasa porque está
   cubierto.
3. El primer cobro se rechaza: `S16`, `CHARGE_DECLINED`, `PB2` baja la ficha. Juan no pagó nunca.
4. Meses después la vertical enciende su trial: `T7` encuentra el `PB1` en el registro y le
   escribe la fila de `trial` consumida.
5. Juan vuelve a publicar: `T1` no dispara. Perdió un trial que nunca usó, por un alta que no
   ocurrió.

**La evidencia.**

- «y un alta que no ocurrió no consume el trial»
  — `$V/docs/03-maquinas-de-estado.md:137`
- «ya fue cliente y ya ejerció el evento que arranca el trial. Devolvérselo el día del encendido es el reseteo del §10.2»
  — `$V/docs/03-maquinas-de-estado.md:371`
- «`SUSCRIPCIÓN` con `cobrada: no` es de clase `TÍTULO`.»
  — `$D/12-contrato-de-cobertura.md:163`

La fila `T7` (`$V/docs/03-maquinas-de-estado.md:57`) declara que `cubierto` no participa y no pide
que el título con el que se publicó haya convertido.

**Qué haría falta decidir.** Si «ya ejerció el evento» se lee sobre cualquier `PB1` o sólo sobre
el que se hizo con un título que convierte (o con un trial). Es del owner: toca el alcance de
`DEC-TRIAL-010` sobre `T7`.

### F-8V1A2-004 — `spec.md` describe `T8` al revés de la tabla

**Qué se rompe.** La tabla dice que `T8` consume la fila al primer pago **de quien ya ejerció el
evento de activación**, y la tabla de `T7` dice que quien nunca publicó, «tenga o no
suscripción», sigue en `PRE_TRIAL`. El `spec.md` de la épica dice que `T8` consume la fila de
quien pagó **sin haber publicado**. Un implementador que parte del spec le quema el trial al
primer pago a quien nunca publicó; el que parte de la tabla se lo conserva. Es exactamente la
población de `DEC-TRIAL-008`.

**El camino.**

1. Juan se suscribe a Experiencia desde un enlace directo, sin publicar nada.
2. Se acredita el primer pago.
3. Con el spec, `T8` escribe la fila consumida; con la tabla, Juan sigue en `PRE_TRIAL`.
4. Juan cancela sin haber publicado. Un año después vuelve: con una implementación tiene trial,
   con la otra no.

**La evidencia.**

- «convierte, y quien pagó sin haber publicado consume su fila por `T8`, al primer pago. La superficie»
  — `$V/spec.md:220`
- «la persona **ya ejerció el evento de activación** en esa vertical»
  — `$V/docs/03-maquinas-de-estado.md:58`
- «**nunca publicó ahí**, tenga o no suscripción»
  — `$V/docs/03-maquinas-de-estado.md:372`

**Qué haría falta escribir.** Alinear el spec con la tabla (el que pagó sin publicar queda en
`PRE_TRIAL` y se consume por `T6` cuando publique). No hay decisión nueva.

### F-8V1A2-005 — La postulación de Partner tiene dos actos en la prosa que su tabla no declara

**Qué se rompe.** La regla 1 del núcleo dice que lo que no está en la tabla no pasa. La tabla de
postulación tiene tres filas y termina en `APROBADA`/`RECHAZADA`. La prosa y la superficie
necesitan dos actos más: **reclamar** la cuenta (el panel lista las «aprobadas sin reclamar», así
que el reclamo es un hecho que hay que distinguir) y **darla de baja** («el admin puede darla de
baja»). Ninguno tiene fila, ni estado de llegada, ni dato donde quedar. Además la espera entre un
rechazo y una postulación nueva está escrita como nota de `PP3`, mientras que la fila que crea la
postulación (`PP1`) no tiene condición: nada impide dos `PENDIENTE` del mismo correo.

**El camino.**

1. Juan postula; el admin aprueba (`PP2`) y le llega el aviso para reclamar.
2. Juan no reclama. El admin ve la fila en «aprobadas sin reclamar» y la quiere dar de baja.
3. No hay transición: por la regla 1 el acto no se ejecuta, se registra y la fila sigue
   `APROBADA` para siempre, en el panel.
4. Si Juan reclama, tampoco cambia nada en la máquina: el panel no tiene de dónde leer que ya no
   está «sin reclamar».

**La evidencia.**

- «**La tabla de transiciones es exhaustiva.** Lo que no está, no pasa. Un intento de»
  — `$D/nucleo/03-maquinas-de-estado.md:35`
- «| **Postulación de Partner** | `PENDIENTE` · `APROBADA` · `RECHAZADA` |»
  — `$D/nucleo/01-glosario.md:442`
- «panel y el admin puede darla de baja. Un vencimiento automático no evitaría ningún daño —no hay»
  — `$V/docs/18-partner.md:259`
- «habilita postular de nuevo pasada la espera configurable»
  — `$V/docs/03-maquinas-de-estado.md:1140`
- «| PP1 | — | alguien completa el formulario del §17.3 | `PENDIENTE` |»
  — `$V/docs/03-maquinas-de-estado.md:1138`
- «las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar**»
  — `$V/docs/19-superficies.md:77`

**Qué haría falta escribir.** Si «reclamada» y «dada de baja» son estados (y sus filas) o datos
fuera de la máquina, y dónde vive la guarda de la espera y de la unicidad de `PENDIENTE`. Es
diseño, no decisión del owner.

### F-8V1A2-006 — Un trial vivo en una vertical que se discontinúa sigue recibiendo las dos campañas que piden suscribirse

**Qué se rompe.** El día 0 de la discontinuación `S1` deja de admitir altas y sucesiones. El
trial en curso no se mueve: sigue en `TRIAL_ACTIVE` hasta `T3`. Nada saca de agenda la campaña
previa (que `T1` agendó y que pide suscribirse antes del vencimiento), y `T3`, al vencer, arranca
la campaña de recuperación (+1 a +60 días), también para suscribirse. Ninguna de las dos mira
`admite_altas` ni `fin_de_servicio`. La persona recibe hasta 60 días de correos comerciales que
la mandan a un checkout que `S1` rechaza, en una vertical que ya le anunció el cierre.

**El camino.**

1. Juan está en `TRIAL_ACTIVE` en Experiencia; faltan 10 días.
2. `SUPER_ADMIN` anuncia la discontinuación: `S1` ya no admite altas.
3. Le llegan «faltan 5 días», «faltan 2 días»: suscribite. Toca el botón y el alta se rechaza.
4. `T3` vence el trial y arranca la recuperación: cinco correos más, hasta el día +60, para una
   vertical cerrada.

**La evidencia.**

- «arranca la campaña de recuperación y el reloj de retención»
  — `$V/docs/03-maquinas-de-estado.md:53`
- «la máquina **no se mueve**: sigue en `TRIAL_ACTIVE` hasta `T3`»
  — `$B/docs/10-verticales-planes-billing-options.md:271`
- «suscripciones, porque `S1` también lo exige, para el alta nueva y para la sucesión»
  — `$B/docs/10-verticales-planes-billing-options.md:151`
- «+1, +5, +15, +30, +60 días, y **termina ahí**»
  — `$D/nucleo/07-outbox-y-notificaciones.md:226`

**Qué haría falta escribir.** Si el anuncio de discontinuación cancela la campaña previa y si `T3`
arranca la recuperación en una vertical que no admite altas. No mueve plata; es un hueco que el
implementador tendría que adivinar.

### F-8V1A2-007 — El destaque de una ficha moderada o excedente sigue debitando sin fin, y ninguna fila lo alcanza

**Qué se rompe.** El addon `LISTING` recurrente muere por orfandad (ninguna principal viva en ese
`user + vertical`) o por borrado (`A6`). Una ficha que un admin modera (`PB10`) o que el
reconciliador de excedentes baja por la segunda rama de `PB2` sigue existiendo y su dueño sigue
pagando la principal: ni una condición ni la otra se cumplen, y el preapproval del destaque
debita todos los meses sobre una ficha que no se ve. `MODERATED` no tiene reloj que la saque, así
que el débito puede durar indefinidamente. `DEC-ADDON-001` aceptó perder días de un addon con la
ficha **despublicada por suspensión** —un estado con salida y con fecha—; el propio `B/16` dice
que sostener un destaque sobre una ficha despublicada no le da nada a nadie. Ninguna de las dos
lecturas cubre un débito recurrente sin horizonte.

**El camino.**

1. Juan paga Premium y un destaque mensual sobre su ficha A.
2. Un admin modera la ficha A (`PB10`). Juan no puede republicarla: sólo un admin la saca.
3. Juan sigue pagando la principal por sus otras fichas: el destaque no es huérfano; la ficha no
   se borró: `A6` no corre.
4. Mientras dure la moderación, el destaque se cobra cada mes. Lo mismo si baja de plan y el
   criterio «cae lo más reciente primero» despublica justo la ficha destacada.

**La evidencia.**

- «ninguna suscripción principal de ese `user + vertical` —la vertical de la ficha— es fila viva, y no hay ahí un ancla viva»
  — `$B/docs/16-addons.md:428`
- «un destaque sobre una ficha despublicada —o sobre una vertical que el cliente ya no tiene—»
  — `$B/docs/16-addons.md:817`
- «el addon **no está huérfano**, la ficha existe, y sin embargo no sirve para nada mientras el»
  — `$D/01-decision-log.md:738`
- «apunta a algo que ya no existe) y la ficha queda **despublicada por suspensión** (§21) — ahí»
  — `$D/01-decision-log.md:737`

**Qué haría falta decidir.** Si `DEC-ADDON-001` se extiende a una ficha moderada o excedente con
un addon recurrente (se cobra igual, con aviso) o si ese caso corta el complemento. Es del owner:
es plata del cliente en un camino plausible, sin detector (el barrido no lo ve porque la
instancia no es terminal).

### F-8V1A2-008 — El reconciliador diario decide con una lectura hecha antes del lock, y `PB2` no la repite adentro

**Qué se rompe.** El lock por `user + vertical` hace que `PB1` reevalúe cobertura, conjunto y cupo
**dentro** del lock. Para `PB2` el texto dice sólo que toma el mismo lock y que, si corre después
de un `PB1`, «encuentra la ficha recién publicada entre las que baja»: no dice que relea
`cubierto`. El reconciliador diario pregunta primero y corre la transición después. Si entre las
dos cosas la cobertura volvió (un `S2` que recontrata), `PB2` baja la ficha de alguien que ya
pagó y escribe el hecho 5 con un instante falso. Lo devuelve la fila 2 del reconciliador al día
siguiente.

**El camino.**

1. Juan canceló (`CANCELLED`) y sus fichas siguen publicadas por un aviso perdido.
2. El reconciliador, a las 03:00:00, lee `cubierto` falso para Juan en Alojamiento.
3. A las 03:00:01 Juan recontrata y se autoriza (`S2`): `cubierto` verdadero.
4. A las 03:00:02 el reconciliador corre `PB2` primera rama bajo el lock, sin releer: las fichas
   de Juan bajan y reciben `inactiva_desde`.
5. Juan paga y no se ve hasta la corrida del día siguiente.

**La evidencia.**

- «dentro del lock son **los pasos 5 a 7** del cap. 17 §1.2 —fuente viva, conjunto efectivo y cupo—,»
  — `$V/docs/03-maquinas-de-estado.md:753`
- «`PB2` entra después y encuentra la ficha recién publicada entre las que baja.»
  — `$V/docs/03-maquinas-de-estado.md:756`
- «compara con el estado de sus fichas y, si no coinciden, corre la transición que el aviso habría»
  — `$V/docs/03-maquinas-de-estado.md:999`

**Qué haría falta escribir.** Que `PB2` (las dos ramas) y el reconciliador reevalúen `cubierto` y
el cupo dentro del lock antes de escribir, igual que `PB1`. No hay decisión nueva: es `B/05` §2,
`C1`, aplicada a la otra transición.

## BAJA

### F-8V1A2-009 — `T6` y `T8` escriben la misma fila de `trial` sin lock declarado

**Qué se rompe.** `T8` dispara con el primer pago acreditado; `T6`, con un `PB1` cuando ya hay un
título que convierte. Si el pago se acredita y en el mismo instante el dueño publica otro
borrador, las dos leen «no hay fila con ese hash» y las dos escriben. El lock sólo cubre las
transiciones que ocupan cupo. La segunda choca con el `UNIQUE`, que es la falla que el
propio `V/03` describe como «pagaba y no podía publicar». Se resuelve al reintentar (la guarda de
hash ya ve la fila), así que queda en residuo.

**El camino.**

1. Juan, en `PRE_TRIAL`, publicó con su suscripción sin cobrar.
2. Se acredita el primer pago (`T8`) mientras Juan publica un segundo borrador (`PB1` + `T6`).
3. La transacción de `PB1` choca con el `UNIQUE` y falla: Juan ve un error al publicar.

**La evidencia.**

- «qué pasaba después — con `PB1` y `T6` en la misma transacción, **la persona pagaba y no podía»
  — `$V/docs/03-maquinas-de-estado.md:307`
- «> **Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y»
  — `$V/docs/03-maquinas-de-estado.md:746`

**Qué haría falta escribir.** Que las escrituras de la fila de `trial` (`T1`, `T6`, `T7`, `T8`)
tomen el mismo lock, o que el choque se resuelva como «ya consumida» y no como error.

### F-8V1A2-010 — Ordinales y censos vencidos alrededor de `T1`–`T8`

**Qué se rompe.** La tabla «las tres consecuencias del par» tiene seis filas desde que `6c` metió
la de `cobrada: no` en el tercer lugar, y la prosa sigue llamando «tercera» a la que ahora es la
cuarta (días en cero) y «cuarta» a la que ahora es la quinta (vertical cerrada a altas); el título
del apartado de `T7` repite el ordinal viejo. En `V/18` quedó «las tres» después de pasar a
cuatro salidas. Y el §3 del contrato nombra a `T2` y `T5` como los que esperan el aviso del primer
pago, sin `T8`, que también lo espera.

**El camino.** Juan (implementador de V4) busca «la tercera fila» para escribir el test de `T7` y
encuentra la de `cobrada: no`; cablea el consumidor del aviso contra la lista del contrato y `T8`
no despierta.

**La evidencia.**

- «**Las tres consecuencias del par, recorridas** — la mitad de catálogo × los dos valores de»
  — `$V/docs/03-maquinas-de-estado.md:252`
- «**La tercera fila es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una»
  — `$V/docs/03-maquinas-de-estado.md:264`
- «cuarta fila de la tabla de arriba y el efecto buscado. Hasta esta pasada `T1` no miraba la»
  — `$V/docs/03-maquinas-de-estado.md:282`
- «#### La tercera fila no es un estado final: `T7` la cierra el día del encendido»
  — `$V/docs/03-maquinas-de-estado.md:332`
- «**la razón es la configuración de hoy, no una propiedad de Partner**: las tres dependen de dos»
  — `$V/docs/18-partner.md:90`
- «pero es el hecho que `T2` y `T5` esperan; sin aviso, `T2` quedaría esperando hasta que `T3` venciera»
  — `$D/12-contrato-de-cobertura.md:827`

**Qué haría falta escribir.** Renumerar las referencias (o nombrar las filas por su contenido) y
agregar `T8` al censo del §3.

## Ataques que intenté y el diseño resistió

- **Conteo de la máquina de publicación.** Seis estados y doce transiciones cierran contra la
  tabla (`PB1`–`PB12`), y el glosario lista los mismos seis.
- **Pares `(desde, evento)` duplicados en trial y publicación.** Recorrí `T1`–`T8` y `PB1`–`PB12`:
  el único par con dos filas es `T1`/`T6`, separado por `cubierto`; los diez casos de «mismo
  `desde`, otro evento» de la regla 7 están bien descriptos.
- **`MODERATED` como agujero de retención.** Ni archiva ni borra (no está en el `desde` de
  `PB4`/`PB5`/`PB9`), no cuenta para el cupo, y `PB11` reinicia el reloj: el camino
  `PB11 → PB5 → PB9` que borraba en días está cerrado.
- **`PB7` publicando un borrador archivado por `PB5`.** La guarda mira el origen en el registro.
- **`PURGED` volviendo por `PB3`/`PB7`.** No está en su `desde`; es final.
- **Trial que vence antes del primer cobro.** `T5` ahora espera `cobrada` y convierte al primer
  pago; el caso «pagando en `TRIAL_EXPIRED`» está cerrado.
- **Carrera `PB1` contra `PB2` en el camino normal.** Con el lock y la reevaluación de `PB1`
  adentro, no queda ficha publicada sin cobertura (el hueco está en la otra dirección: 008).
- **Addon comprado en la ventana del checkout cuya principal muere.** `A5` sale también de
  `PENDING_AUTHORIZATION` y se reevalúa al llegar a `ACTIVE` por `A2`.

## Fuera de mi vector

- **Cortesía durante un trial con una suscripción sin cobrar al lado.** `T4` extiende el trial
  «por promo o cortesía» y `B/14` §4.5 dice que la cortesía durante el trial extiende; pero si en
  la ventana del primer cobro (hasta 72 h en una sucesora) hay una `ACTIVE`, la cortesía tiene dos
  instrumentos posibles (extender el trial o pausar la fila por `S9`). Le toca a quien ataque
  promos y cortesías.
- **La presencia de Partner sin reloj de retención** está declarada en `V/18` §1.6; si se quiere
  un plazo, es de retención/legal.

## Key Learnings

1. Un estado intermedio que protege al dueño de una republicación automática
   (`UNPUBLISHED_BY_BILLING`) se vuelve una trampa cuando el mismo dueño, sin cobertura, necesita
   sacarlo él: hay que mirar las salidas de cada estado **desde cada actor**, no sólo desde el
   sistema.
2. Cuando una decisión mueve una responsabilidad entre dos tablas (`K-9`: el borrado pasó de
   `A5` a `A6`), las notas de la otra épica que citan la vieja quedan fuera del alcance de `G-R4`,
   que cuenta tablas y no prosa.
3. `cobrada` se agregó a cuatro transiciones de trial y no a la quinta que también consume
   (`T7`): una guarda nueva sobre una familia de filas hay que contrastarla contra **todas** las
   filas que escriben el mismo efecto, no sólo contra las del mismo evento.
4. Los ordinales de filas («la tercera fila») caducan en cuanto alguien inserta una fila en el
   medio; conviene nombrar las filas por su contenido.
