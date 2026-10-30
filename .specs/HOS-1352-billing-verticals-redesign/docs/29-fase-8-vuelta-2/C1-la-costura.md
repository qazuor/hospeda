---
title: "FASE 8 vuelta 2 · C1 — la costura"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · C1 — la costura

Ataqué la frontera entre las dos épicas: el contrato de cobertura entero (`$D/12`), contra lo que
cada lado hace de verdad. Recorrí la firma de la fuente y quién la produce, el aviso de ida y su
censo de emisores, el empuje inverso de `PURGED`, las siete entradas de la dirección inversa del
§4.1, la regla de vigilancia del §4.2, las dos implementaciones y sus tres defensas (§5, §6), y lo
crucé con `V/02` §2.2 y §3.2, `V/03` §2 y §9, `V/15` §2.5–§2.6, `V/11` §3, `B/02` §2.4, `B/03`
§3.2 y §8, `B/10` §4.3, `B/14` §3–§4, `B/16` §4.2, las dos descomposiciones (las dependencias
entre unidades y los criterios de `V4` y `B4`), el glosario del núcleo y el corte del `16`. Medí
contra `1cccd9119d`, sin mover el árbol.

Son **7 hallazgos**: **0 CRITICA, 2 ALTA, 4 MEDIA y 1 BAJA**. La idea más grave: la
discontinuación de una vertical es un acto de billing que escribe dentro de verticales —corre
`PB2`, escribe el reloj de inactividad, invalida el caché y fija la fecha de fin de servicio con
fechas de cobro— sin pasar por el contrato que dice que la única escritura es `extenderTrial`; un
constructor de `B12` que respete el contrato deja el borrado del día 180 adelantado 90 días. Y la
tabla de transiciones de billing, que es lo que lee quien emite el aviso, dice «en el mismo acto»,
la misma frase que el §3.1 tachó porque, leída como «dentro de la transacción», perdía el evento
en todos los casos.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2C1-001 — La discontinuación escribe en verticales por fuera del contrato, y respetarlo adelanta el borrado 90 días

**Qué se rompe.** El §4.2 del contrato dice que billing sólo escribe en verticales con
`extenderTrial` y que cualquier otra escritura es filtración. Pero `B/10` §4.3, que es de `B12`, le
manda al barrido del día del fin de servicio que haga cuatro cosas del lado de verticales. Corre
`PB2` sobre las fichas, que es una transición de `V6` con su lock. Escribe
`listing.inactiva_desde` en cada ficha de la vertical, que es el hecho 4 del reloj. Invalida el
caché de la vertical entera, que es de `V3`. Y además recorre las fichas de la vertical, cosa que
ninguna consulta del §4.1 contesta. Encima de eso, la fecha de fin de servicio es una columna de
verticales y se calcula con *«el último día ya pagado por cualquier compromiso vivo»*: o billing la
escribe en una tabla de verticales, o verticales la calcula con fechas de cobro, que el §4 prohíbe
cruzar. Ninguna de las dos direcciones está declarada. La tabla de dependencias de `B12` sólo
registra que **lee** `admiteAltas`/`finDeServicio` de `V2`. No tiene flecha hacia `V6` (`PB2`), ni
hacia `V3` (la invalidación), ni hacia el escritor del hecho 4. Dos constructores de `B12` lo
resuelven distinto. Uno respeta el §4.2 y no escribe el hecho 4. El otro escribe en tablas de
verticales sin contrato, que es justo la filtración que el §4.2 manda detectar. Y el glosario dice
qué pasa en el primer caso: sin ese ejecutor el hard delete se adelanta hasta 90 días.

**El camino.**

1. Juan tiene dos fichas en Gastronomía. El día 0 el owner anuncia que discontinúa la vertical y los
   tres avisos le prometen hasta cuándo puede exportar.
2. Una de sus fichas la archivó `PB4` hace 80 días: su `inactiva_desde` es de hace 170 días.
3. Llega el fin de servicio. El barrido de `B12`, construido contra el §4.2 del contrato, cancela
   las suscripciones pero no toca `listing.inactiva_desde`, porque escribir en verticales no está
   entre lo que el contrato admite, y `B12` no tiene dependencia con quien sabe escribirlo.
4. Diez días después `PB9` relee la cobertura: la vertical discontinuada no cubre a nadie, así que
   da falso. Borra el contenido de la ficha y la pasa a `PURGED`.
5. Juan va a exportar en la fecha que le prometieron y la ficha ya no existe. Ningún detector lo
   señala, porque `PB9` hizo lo que su fila dice.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1166`
  — "verticales algo que no sea `extenderTrial`, o recibir de verticales un hecho que no sea el del"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:278`
  — "Las fichas de las tres primeras filas las baja este mismo barrido, cuyo `PB2` ahora tiene su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:280`
  — "Y el barrido del día invalida las entradas de caché de la vertical entera"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:314`
  — "Así que el barrido de este día, además de despublicar y de consumar las bajas, le escribe"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:250`
  — "el último día ya pagado por cualquier compromiso vivo en la vertical )"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:980`
  — "No cruzan montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de"
- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:336`
  — "| 6 | B12 — el retiro y la discontinuación | `admiteAltas` y `finDeServicio` (`B/10` §4.6, que ya las lee), y `vigente`/`vendible` | V2 |"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:182`
  — "vieja —hasta 90 días antes de la que los tres avisos de la discontinuación le prometieron al"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:607`
  — "el barrido del día del fin de servicio (`B/10` §4.3), cuyo `PB2` ahora sí tiene su evento, y"

La fila de `V/descomposicion.md` §2.10 sí nombra la invocación de `V3` por `B12`, pero ninguna
entrada del §4.1 ni ninguna fila de dependencias de `B/descomposicion.md` §2.6 la recoge. No
encontré ningún escritor declarado de `vertical.fin_de_servicio`:

```text
rg -n "escrib\w* .{0,40}fin_de_servicio|fin_de_servicio.{0,40}escrib" $D/nucleo $V $B $D/12-…
→ sólo B/10:313 y glosario:175, que dicen que el hecho 4 «no tenía quién lo escribiera»
```

**Qué haría falta decidir o escribir.** Si el barrido del fin de servicio es de billing, qué
entradas del §4.1 (una operación como `extenderTrial`, o un empuje como el del §3.1) le dan a
verticales el hecho *«la vertical llegó a su fin de servicio»*, para que `PB2`, el hecho 4 y la
invalidación los ejecute verticales. O si no, cuál de las dos reglas cede. Y quién escribe
`vertical.fin_de_servicio`, con qué dato de billing y por qué pregunta cruza.

### F-8V2C1-002 — La tabla de billing emite el aviso «en el mismo acto», la frase que el §3.1 tachó por perder el evento siempre

**Qué se rompe.** El contrato fija que el aviso sale **después del commit** (§3). Del empuje
gemelo explica por qué: emitido dentro de la transacción, el consumidor relee, ve el estado viejo y
el evento se consume sin efecto, *«en todo borrado»*. Pero la tabla de transiciones de billing, que
es lo que tiene delante el que emite, sólo dice *«en el mismo acto»*. Y la frase del propio
contrato que abre el censo de emisores dice lo mismo, *«en el mismo acto»*. Ninguno de los
criterios de `B4` pide el orden. Si el constructor de `B4`/`B7` emite dentro de la transacción, el
«aviso perdido» que el diseño declara como residuo raro pasa a ser el camino principal. `T2`, `T5` y
`T8` nunca disparan, porque el reconciliador diario no corre la máquina de trial. `PB2` y `PB3` se
atrasan un día en cada cambio de cobertura. Y la invalidación del caché llega antes del commit, así
que una lectura concurrente vuelve a cachear el estado viejo.

**El camino.**

1. Juan está en `TRIAL_ACTIVE` en Alojamiento, con diez días por delante. Se suscribe a Básico.
2. A los 30 minutos Mercado Pago acredita el primer cobro. `P1` corre y, **dentro de su
   transacción**, emite el aviso porque la fila pasa de `cobrada: no` a `sí`.
3. La máquina de trial recibe el aviso, pregunta `cobertura()` y lee `cobrada: no`, porque `P1`
   todavía no commiteó. `T2` no dispara y el aviso ya se consumió.
4. Durante diez días Juan tiene los dos títulos sumados: el plan de trial, que es el premium, más
   Básico.
5. `T3` vence el trial y lo manda a `TRIAL_EXPIRED` con su suscripción paga. Arranca la campaña de
   recuperación: *«tu prueba venció»*, a un cliente que paga. `T5` no va a disparar nunca, porque
   el título ya estaba.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:142`
  — "§3 del contrato en el mismo acto; el censo de emisores está allá"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:864`
  — "Emite el aviso, en el mismo acto, toda escritura que cambia la respuesta del §2.1 para algún"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:882`
  — "El aviso sale después del commit de lo que cambió la respuesta, igual que la invalidación"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:945`
  — "Por qué después del commit, y no «en el mismo acto» a secas (FASE 9 vuelta 1, `N-G2V-01` y"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:950`
  — "no pasaba de vez en cuando sino en todo borrado: el camino principal caía entero a la red del"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1198`
  — ">    el aviso de un título que aparece durante el trial —o, desde `DEC-TRIAL-010`, el del primer"

El silencio de billing sobre el orden:

```text
rg -n "después del commit" $B
→ sólo B/16:980, que habla del empuje de PURGED (§3.1), no del aviso del §3
```

**Qué haría falta decidir o escribir.** Que `B/03` §3.2 y la frase del censo del §3 digan
*«después del commit»* igual que el §3.1. Y que el criterio de `B4` pruebe el caso: un consumidor
que relee justo después de recibir el aviso tiene que ver el estado nuevo.

## MEDIA

### F-8V2C1-003 — El censo de emisores no nombra el anclaje de una vertical nueva, y verticales sólo se entera por el aviso

**Qué se rompe.** `NUCLEO/08` §3 tiene tres actos sobre un grant: otorgar, **anclarle una vertical
nueva** y revocar. `B/14` avisa que el anclaje es el segundo momento en que un grant empieza a
cubrir. Pero el censo de emisores del §3, que se presenta como *«el»* censo, nombra sólo *«otorgar
y revocar»*. Del lado de verticales, `V/02` §3.2 declara que el aviso es *«el único transporte»*
de un cambio de billing, y cuenta el anclaje como un cambio de cobertura. Cuando el beneficiario no
tenía suscripción en esa vertical, `S13` no mueve ninguna fila, así que no sale ningún aviso por
esa vía. Si el constructor de `B9` sigue el censo, el anclaje no emite. `PB3` se atrasa un día
(hasta el reconciliador). `T2` no dispara nunca, porque el reconciliador no corre la máquina de
trial.

**El camino.**

1. Juan tiene un grant *Free Forever* en Alojamiento y un trial corriendo en Gastronomía, con 20
   días por delante.
2. `SUPER_ADMIN` le ancla Gastronomía al grant. El anclaje no está en el censo, así que no se emite
   ningún aviso.
3. Juan queda con el trial (el plan premium) y el grant de Gastronomía sumados hasta que `T3` vence
   el trial.
4. `T3` lo pasa a `TRIAL_EXPIRED` y le arranca la campaña de recuperación: *«tu prueba venció,
   suscribite»*, a alguien a quien le acaban de regalar la vertical para siempre.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:872`
  — "extienden o cierran una cortesía; otorgar y revocar un grant (`NUCLEO/08` §3); `A2`, `A4`, `A5`"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:153`
  — "| otorgar, anclarle una vertical nueva, o revocar un grant permanente | §35, §35.4, `12-contrato…` §2.8 |"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:528`
  — "El anclaje es la tercera escritura que cambia la cobertura"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:426`
  — "se lee como el único momento en que un grant empieza a cubrir, y desde que el scope es el conjunto"

**Qué haría falta decidir o escribir.** Agregar el anclaje al censo del §3 en el mismo acto, y
revisar si hay otros actos del catálogo de `NUCLEO/08` §3 que cambien la respuesta y no estén en el
censo.

### F-8V2C1-004 — Escribir el piso del grant exige saber la versión vigente del plan, y ninguna pregunta del §4.1 la contesta

**Qué se rompe.** El piso del trinquete es *«la versión de ese plan que estaba vigente el día que
se firmó»*, y lo escribe billing en `permanent_grant_vertical`. El contrato afirma que billing nunca
lee `plan_version`. Pero la única pregunta del §4.1 sobre planes, `políticaDePlan`, recibe una
versión, no un plan: no hay pregunta que diga *«cuál es la versión vigente del plan P»*. La
herramienta del corte (paso 3b) además ancla *«al vendible de `rank` más alto»*, y el `rank` sólo
existe en tablas de verticales. Quien construye el otorgamiento, el anclaje o el 3b tiene que
adivinar. Una opción es leer `plan_version` directo, la filtración que el §4.2 vigila. La otra es
aceptar la versión que mande la pantalla de administración, una superficie que por definición *«no
decide nada»*. Si la pantalla manda una versión que no es la vigente, el trinquete queda con un
piso más generoso que el que se aprobó, para siempre.

**El camino.**

1. `SUPER_ADMIN` le otorga a Juan un grant en Alojamiento anclado a Premium. La pantalla, abierta
   desde antes de que se publicara Premium v3, le manda a billing la versión v2.
2. Billing no tiene pregunta para comprobar que v2 ya no es la vigente sin leer `plan_version`, y
   guarda v2 como piso.
3. v2 tenía 30 fichas y v3 bajó a 20, que es lo que se quería regalar. El trinquete le deja a Juan
   30 para siempre, y nadie lo decidió.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:774`
  — "estaba vigente el día que se firmó, nunca una copia de sus valores, por la misma razón que el"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:703`
  — "mismo plan con sus propias tablas. Billing nunca lee `plan_version` (FASE 9 vuelta 1,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1025`
  — "políticaDePlan(versiónDePlan)  → { díasDeGrace, permitePausa, vigente, vendible }"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:130`
  — "anclados al vendible de `rank` más alto de Alojamiento, en la vertical en que tenían `comp`"

**Qué haría falta decidir o escribir.** Una pregunta del §4.1 que devuelva la versión vigente de un
plan de una vertical, o que resuelva *«el vendible de `rank` más alto»*. O, si no, la regla
de que billing valida la versión que recibe con `políticaDePlan(v).vigente` y rechaza si no es la
vigente.

### F-8V2C1-005 — `G13` prohíbe en producción una implementación de la que la real depende

**Qué se rompe.** La implementación de arranque resuelve dos fuentes de verdad: el trial y el
título `BASE`. La real *«no toca nada de lo construido»* y se enchufa encima, y el trial lo sigue
resolviendo verticales *«en las dos implementaciones»*. O sea que en producción corre código de la
de arranque. `G13` falla si *«la implementación de arranque llega a producción»*, y ningún
documento dice qué parte es *«la de arranque»*. ¿Es el módulo entero? Entonces `G13` falla siempre,
o fuerza a reescribir la resolución del trial, contra el §5.2. ¿Es sólo el `no` para las cuatro
fuentes de billing? Entonces hay que decirlo, porque un predicado que mira el módulo y se
«arregla» con una excepción deja pasar justo ese `no`. Si el `no` llega a producción, `cubierto` es
falso para todo cliente que paga y `PB2` le baja las fichas mientras se le sigue cobrando.

**El camino.**

1. El constructor de `V4` escribe `G13` como «el build de producción no importa
   `cobertura-arranque`», que es donde vive la resolución del trial y de `BASE`.
2. `B4` enchufa la real reusando ese módulo, como manda el §5.2, y `G13` se pone rojo en el primer
   build de producción.
3. El PR final es *«enorme y nadie lo puede revisar»* (`DEC-ARCH-007`). Alguien le agrega una
   excepción a `G13` para destrabar, y con la excepción pasa también el cableado que devuelve `no`
   para las fuentes de billing.
4. Juan paga Premium, `cubierto` da falso, `PB2` le baja las fichas y Mercado Pago le sigue
   cobrando.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1210`
  — "responde que no a las cuatro de billing: suscripción, cortesía, grant y addon. Y emite el aviso"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1248`
  — "lo construido: se enchufa como fuente y como emisor del aviso."
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:600`
  — "- La fuente de trial la resuelve verticales en las dos implementaciones (§5.1; §5.2 *«no toca"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57`
  — "| G13 ✚ | la implementación de arranque de `cobertura()` llega a producción |"

**Qué haría falta decidir o escribir.** El predicado de `G13` sobre un objeto nombrado: qué pieza
es *«la de arranque»* que no puede llegar (el `no` a las cuatro fuentes de billing, no la
resolución del trial ni la de `BASE`), y cómo se reconoce en un build.

### F-8V2C1-006 — `B4` exige un caso que la implementación de arranque no pase, y el contrato quiere el mismo juego verde contra las dos

**Qué se rompe.** El contrato define un solo juego que *«ya corrió meses contra la otra»*. Su caso
distintivo separa una implementación correcta de una constante, y **las dos implementaciones
correctas lo pasan** (`PRE_TRIAL` con `cubierto: no` y `fuentes` no vacío). El criterio de `B4` lee
*«si pasa con las dos»* como las dos implementaciones del contrato y exige un caso que la de
arranque **no** pase. Un juego único con un caso que falla contra la de arranque está en rojo
durante toda la épica de verticales, o lleva ese caso condicionado a la implementación. Condicionado
es *«un caso que no puede fallar»*, lo que el mismo § prohíbe. Los constructores de `V4` y de `B4`
arman juegos incompatibles, y el que queda tiene casos que no prueban nada contra una de las dos.

**El camino.**

1. Juan, constructor de `B4`, agrega el caso *«una suscripción `ACTIVE` cubre»*, que la de arranque
   no pasa porque responde `no` a toda fuente de billing.
2. El juego único, que `V4` corre desde hace meses contra la de arranque, se pone rojo.
3. Para destrabar, el caso se marca `skipIf(arranque)`. Contra la de arranque ya no puede fallar, y
   el juego *«único»* pasa a ser dos juegos con nombre de uno.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:725`
  — "| B4 | el juego de casos corre contra las dos implementaciones y hay al menos uno que la de arranque no pasa"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1286`
  — "en vez de un día de sorpresas. Para cuando llegue, ese juego ya corrió meses contra la otra."
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1242`
  — "> en `PRE_TRIAL` tiene `cubierto: no` y `fuentes` no vacío. Si ese caso pasa con las dos"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1290`
  — "siempre lo mismo — si pasa con las dos, no está probando nada."

**Qué haría falta decidir o escribir.** Qué es *«las dos»* en el §6.2 (las dos implementaciones o
la correcta contra la constante). Y si los casos de las fuentes de billing son del juego único o de
un juego propio de la real.

## BAJA

### F-8V2C1-007 — El censo de emisores dice que sólo `T1`–`T5` mueven la fuente de trial, y `T6`, `T7` y `T8` también la mueven

**Qué se rompe.** En `PRE_TRIAL` el trial emite una fuente, la de pre-trial. `T6`, `T7` y `T8`
llevan a la persona a `TRIAL_CONVERTED`, que no emite, así que cambian `fuentes`. Según la regla
general del §3 (*«toda escritura que cambia la respuesta»*), emiten. El censo nombra sólo cinco
transiciones, y lo mismo el §5.1 para la implementación de arranque. Hoy no hay daño: la fuente que
desaparece es de clase `BASE`, así que no mueve `cubierto`. Además, la invalidación del caché se
dispara con *«toda transición de la máquina de trial»*. Pero el censo sin cifra que el §3 promete ya
no coincide con la tabla de `V/03` §2.

**El camino.**

1. Juan, en `PRE_TRIAL`, publica mientras está cubierto por un grant. `T6` lo pasa a
   `TRIAL_CONVERTED` y la fuente de pre-trial desaparece.
2. El constructor de `V4` sigue el censo y no emite el aviso. Hoy ningún consumidor pierde nada,
   pero el primero que se agregue y lea `fuentes` por el aviso no se va a enterar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:873`
  — "y `A6`; y `T1`, `T2`, `T3`, `T4` y `T5`, que mueven la fuente de trial, en las dos"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:66`
  — "| `PRE_TRIAL` | sí | la versión de pre-trial de la vertical | `SIN_EMPEZAR` |"

**Qué haría falta decidir o escribir.** Sumar `T6`, `T7` y `T8` al censo, o decir por qué la
desaparición de una fuente de clase `BASE` no emite.

## Ataques que intenté y el diseño resistió

- **Carrera `PB1` contra la pérdida de cobertura**: `PB2` toma el mismo lock que `PB1` y relee
  `cubierto` adentro (`V/03` §9), así que la ficha no queda publicada sin cobertura.
- **Carrera `A1` contra el borrado de la ficha**: `A1` exige una suscripción `ACTIVE` y pagando en
  la vertical, así que `PB9` no puede borrar (relee cubierto verdadero). `PB12` es un acto del
  propio dueño, así que la carrera requiere que Juan compita consigo mismo en milisegundos. Una
  instancia ya commiteada en `PENDING_AUTHORIZATION` la alcanza el empuje de `A6`.
- **`extenderTrial` con la respuesta perdida**: la clave de canje la vuelve idempotente y el
  criterio de `V4` lo prueba (reintento después de `ACEPTADA` no extiende dos veces).
- **La versión de pre-trial o de piso sumando cupo a un título**: `G-R3` (a) prohíbe claves
  comerciales y entitlements medidos en las dos versiones no vendibles, así que el pliegue en
  `SUMA` no agrega nada.
- **Complemento cobrando sin título durante la pausa del cliente**: `B/16` §4.2 pausa los
  complementos recurrentes con la principal. Los residuos que quedan están declarados.
- **El aviso duplicado**: todos los consumidores releen. El único efecto, el hecho 5 reescrito por
  el recálculo, está aceptado en `NUCLEO/01` §1.2 ⚠️ punto 3.

## Fuera de mi vector

- **El corte, paso 3b**: los grants del owner los escribe la herramienta de `B9` y se afirma que
  *«el grant las sube por `PB3`»* en minutos. Eso depende de que la herramienta emita el aviso y de
  que el consumidor ya esté corriendo, y el aviso no tiene transporte durable. Si no, son hasta un
  día sobre dos cuentas del owner. Le toca al vector de corte y liberación.
- **`P6` (contracargo) y `cobrada`**: no está escrito si un contracargo del único pago devuelve
  `cobrada` a `no`, ni si eso emite. Le toca al vector de máquinas.

## Key Learnings

1. La regla *«billing sólo escribe en verticales con `extenderTrial`»* no la cumple la
   discontinuación. Los actos que recorren fichas desde billing son el lugar donde el corte se
   filtra sin que el §4.1 lo registre.
2. Una frase tachada en un § (*«en el mismo acto»*) puede seguir viva en el documento que el
   implementador lee primero. La corrección tiene que llegar al texto del emisor, no sólo al
   contrato.
3. Un censo *«sin cifra»* no protege si su redacción enumera actos sueltos. El anclaje y `T6`–`T8`
   quedaron afuera porque el censo nombra filas y no la regla que las genera.
4. Una pregunta del §4.1 que recibe una versión no contesta nada sobre *«la vigente de un plan»*.
   Cada escritura de billing que necesita la vigente es una lectura no declarada en espera.
