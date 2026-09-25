---
title: "FASE 8 completa · A2 — Máquinas, carreras y huérfanos (lado verticales)"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · A2 — Máquinas, carreras y huérfanos (lado verticales)

Ataqué las tres máquinas de verticales (Trial, Publicación, Postulación de Partner) contra lo que
les hace la de suscripción, más el reloj de inactividad, el contrato de cobertura como único
canal entre las dos épicas, y las entidades que cuelgan de una suscripción (fichas, trial, addons,
grants, presencia de Partner) en cada forma en que esa suscripción muere o nunca nace. También
busqué carreras entre un evento de billing y un acto del dueño sobre la misma vertical, y relojes
que se pisan sobre la misma columna.

Salen **17 hallazgos**: **4 CRITICA**, **6 ALTA**, **6 MEDIA**, **1 BAJA**. Los cuatro críticos
comparten una forma: **el diseño arregló el camino que miraba y dejó una fila, una columna o un
aviso sin quien lo mueva del otro lado**. El más grave en una línea: **el reloj de inactividad se
cuenta desde su último reinicio y no desde que la ficha perdió la cobertura, así que una pausa del
catálogo puede terminar con el contenido de un cliente al día borrado a mitad de la pausa** — y
`D16` (120 < 180) certifica en verde una premisa que el mecanismo no cumple.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8CA2-001 — El reloj de inactividad arranca en el último reinicio, no en la pérdida de cobertura: el hard delete cae a mitad de una pausa

**Qué se rompe.** El contenido publicable de un cliente que **no canceló nada** (pausó, con la
pausa que le vendemos) se borra de forma irreversible antes de que reanude. Y `D16` sigue en
verde, porque compara dos cifras de catálogo sobre una premisa —«el reloj arranca el día que
empieza la pausa»— que ninguna escritura hace verdadera.

**El camino.**

1. Juan tiene una ficha `PUBLISHED` y cubierta en Alojamiento. Su `listing.inactiva_desde` quedó
   en el instante X: la última vez que `PB4` la evaluó al día 90, releyó, la encontró cubierta y
   reinició el reloj (hecho 2). En régimen estable la columna tiene **hasta 90 días** de
   antigüedad, porque nada más la toca mientras la ficha está publicada y cubierta.
2. En X+85 Juan pausa 4 meses (`S8`, ~120 días). `cubierto` pasa a falso, `PB2` baja la ficha.
   **Ninguno de los cuatro hechos se escribe**: perder la cobertura no es un hecho, y `PB2` tiene
   prohibido escribir la columna.
3. X+90 (día 5 de la pausa): `PB4` relee, no está cubierto, **archiva**.
4. X+180 (día 95 de la pausa): el hard delete relee, no está cubierto, **borra el contenido**.
5. X+205: Juan reanuda (`S10`). `PB7` le republica una ficha vacía (ver `F-8CA2-008`).

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:48`:

> El tiempo que lleva **sin estar a la vez publicada y cubierta**, contado desde **el más
> reciente** de los cuatro hechos que la reinician.

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:56` (hecho 3):

> una ficha publicada no acumula inactividad; su reloj arranca recién cuando deja de estarlo

— pero ninguno de los cuatro hechos es «deja de estarlo»; la lista es cerrada y `PB2` está
excluida por nombre, `nucleo/01-glosario.md:136-137`:

> Lo único que corre ese día es `PB2`, y **`PB2` escribiendo esta columna es exactamente el caso
> con que `V/20` §2 manda probar `G-R6-B` en rojo**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:434-436`:

> **Y se cuentan sobre una columna, no sobre una derivación: `listing.inactiva_desde`** (§2.5). El
> día 90 es `inactiva_desde + 90` y el 180 es `inactiva_desde + 180`

El diseño **ya midió la antigüedad de la columna, y la arregló para un solo caso**,
`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:256-259`:

> **Sin ella el borrado se adelanta hasta 90 días.** Entre dos evaluaciones de `PB4` hay 90 días,
> así que la fecha que la columna trae al llegar este día puede tener esa antigüedad: el hard
> delete caería en `fin_de_servicio + 90` en vez de en `+ 180`

La premisa que sostiene la pausa, `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:479-482`:

> Entre el primer día de la pausa y ese reinicio hay **120 días** contra los **180** del borrado,
> y las pausas encadenadas no acumulan porque cada reanudación reinicia. Que las dos cifras sigan
> en ese orden es `D16`

y `nucleo/04-invariantes.md:142` (`D16`), que compara «el tope de pausa del catálogo contra el día
del hard delete». Con la columna arrancando hasta 90 días antes de la pausa, la cuenta real es
`120 + 90 = 210 > 180`.

**Severidad**: `CRITICA`. Borrado irreversible de datos de un cliente que paga, por el producto
que le vendemos (pausa), y el único guard que lo vigila (`G-R5`) da verde por construcción. Lo
mismo vale para toda otra pérdida de cobertura (suspensión, baja, fin de trial): el 90/180
prometido en los avisos es en realidad «entre 0 y 90» / «entre 90 y 180».

**Necesita decisión del owner**: **no**. Es corrección de diseño: falta un hecho —«la ficha deja de
estar a la vez publicada y cubierta»— que el propio hecho 3 declara y nadie escribe; el
discontinuado ya tiene el mismo parche (hecho 4) por la misma razón.

---

### F-8CA2-002 — Un aviso de cobertura perdido encierra la ficha de un cliente que paga, para siempre y sin señal

**Qué se rompe.** El cliente recontrata y paga; su ficha queda en `UNPUBLISHED_BY_BILLING` (o en
`ARCHIVED`) indefinidamente. La red que el diseño puso contra el aviso perdido **reinicia el
reloj en vez de restituir**, así que lo único que hace es impedir que el caso se note. El dueño no
tiene ninguna transición propia para salir de ahí.

**El camino.**

1. Juan está `SUSPENDED`; `PB2` le bajó sus 3 fichas a `UNPUBLISHED_BY_BILLING`.
2. Vuelve por el checkout (`S1` → `S2`): `cubierto` pasa a verdadero. **El aviso «la cobertura
   cambió» se pierde** (el diseño declara que pasa).
3. `PB3` es por **cambio** y el cambio no llegó: no dispara. El reconciliador de excedentes cuelga
   de la misma lista, así que tampoco corre.
4. Día 90: `PB4` relee, encuentra a Juan cubierto, **no archiva y reinicia el reloj**. No
   restituye. El ciclo se repite cada 90 días, para siempre.
5. Juan no puede hacer nada: `PB1` sale sólo de `DRAFT`, `PB6` sólo de `PUBLISHED`, `PB8` sólo de
   `ARCHIVED`. Paga el plan y sus fichas no se ven.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:113-119`:

> **Y como un aviso se puede perder, el que ACTÚA vuelve a preguntar antes de actuar.** `PB4`, `PB5`
> y el hard delete del día 180 **releen la cobertura del `user + vertical` en el momento de ejecutar**
> y, si está cubierta, reinician el reloj en vez de avanzar. [...] el
> propio diseño ya declara que estos avisos se pierden

`nucleo/01-glosario.md:90-91`:

> ⚠️ **Y esto NO toca el evento de `PB3` ni el de `PB7`, que siguen siendo un CAMBIO.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:616-619` — el aviso
alimenta a `PB2`, a la lista de invalidación **y** al reconciliador (*«una lista, dos
consumidores»*), así que perderlo apaga los tres a la vez.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:320-322`:

> si el `user + vertical` está cubierto, no archivan y **reinician el
> reloj** [...] Un
> aviso perdido pasa así a costar un retraso en el reinicio y nunca un archivado indebido

Y las filas que dejan al dueño sin salida, `03-maquinas-de-estado.md:293` y `:298`: `PB1` desde
`DRAFT`, `PB6` desde `PUBLISHED`.

**Severidad**: `CRITICA`. Plata cobrada por un servicio (publicación) que no se presta, sin
límite de tiempo, sin marca, sin aviso y sin salida para el cliente. El diseño afirma que el aviso
perdido «cuesta un retraso»: cuesta la publicación entera.

**Necesita decisión del owner**: **no**. Es corrección: la relectura que ya existe tiene que
restituir (ejecutar la primera rama de `PB3`/`PB7` sobre el estado leído), no sólo reiniciar.

---

### F-8CA2-003 — Un addon recurrente de scope `LISTING` sobrevive a la muerte de la suscripción principal y sigue cobrando por nada

**Qué se rompe.** Débito mensual real a un ex-cliente por una capacidad que el pliegue descarta.
La única puerta que lo corta por orfandad —«la ficha se borró»— no tiene transición en la máquina
de publicación.

**El camino.**

1. Juan tiene Alojamiento `ACTIVE` y un «Destaque» mensual (`PERIÓDICO`, scope `LISTING`) sobre su
   ficha F, con su propia suscripción de complemento y su preapproval.
2. Juan da de baja Alojamiento: `S11` → `S12` → `CANCELLED`. `PB2` baja F a
   `UNPUBLISHED_BY_BILLING`.
3. La condición de huérfano de `LISTING` es «la ficha se borró»: F existe. No es huérfano. `A5` no
   corre, `S21` no corre, el preapproval del complemento **sigue cobrando**.
4. El pliegue descarta la fuente `COMPLEMENTO` (no hay `TÍTULO`): Juan paga cada mes un destaque
   sobre una ficha que no se ve.
5. Para cortarlo por la vía de orfandad tendría que borrar F, y la máquina de publicación no tiene
   ninguna transición de borrado (`F-8CA2-004`). Sólo le queda descubrirlo y darse de baja él.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:372`:

> | `LISTING` | la ficha **se borró** — y `DEC-ADDON-001` ya decidió que eso lo **consume**: no se libera ni se reasigna |

`16-addons.md:524-525`:

> `DEC-ADDON-002` implicación 6: **cancelar el plan NO cancela los addons.** Cada addon recurrente
> es su propio preapproval y **sigue cobrando por su cuenta** hasta que alguien lo cancele.

`16-addons.md:461-462` lo dice para el grant y vale igual acá:

> En `LISTING`, `USER` y `GLOBAL` el objetivo **nunca murió** —la ficha y la cuenta siguen ahí—

Y el propio capítulo declara absurdo lo que deja pasar, `16-addons.md:649-651`:

> **La razón, escrita y no implícita: el addon COMPLEMENTA algo que ya no está.** Sostener días de
> un destaque sobre una ficha despublicada —o sobre una vertical que el cliente ya no tiene— **no le
> da nada a nadie**

`A6` necesita un evento que verticales no emite, `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2043`:

> | A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` |

**Severidad**: `CRITICA`. Plata real cobrada todos los meses sin contraprestación, a quien ya se
fue, sin que ninguna marca ni barrido lo vea (el barrido busca instancias terminales con preapproval
vivo, y ésta no es terminal). Vale también para `USER`/`GLOBAL` cuando no queda ningún título en
ninguna vertical.

**Necesita decisión del owner**: **sí**. Hay dos correcciones con política distinta: ampliar la
orfandad de `LISTING` a «el título de la vertical del objetivo dejó de ser fila viva», o cortar
los complementos sin título por la vía de `A5`. Las dos cambian qué se le cobra a quién.

---

### F-8CA2-004 — Ni la baja por moderación ni el borrado de una ficha tienen transición: la única defensa de `DEC-TRIAL-005` es inejecutable

**Qué se rompe.** Desde `DEC-TRIAL-005` **toda** moderación es reactiva: el contenido sale
público sin revisión y se corrige después. Pero la máquina de publicación no tiene ninguna fila que
baje una ficha por decisión nuestra, ni una que la borre. Por la regla 1 del núcleo, esos actos no
se ejecutan. Si un implementador los mapea a un estado existente, la máquina los deshace sola.

**El camino.**

1. Juan publica spam: `PB1`, visible en el acto.
2. Un admin quiere bajarlo. No hay fila `PUBLISHED → (moderada)`. Opciones del implementador:
   - llevarla a `DRAFT` (como `PB6`): Juan la republica con `PB1` un segundo después;
   - llevarla a `UNPUBLISHED_BY_BILLING`: `PB3` la republica en el próximo cambio de cobertura o
     de cupo;
   - no hacer nada: es una `TRANSICIÓN_NO_DECLARADA`, se registra y no se ejecuta.
3. Lo mismo con «borrar la ficha», que el PDR nombra (§10.2) y del que dependen `A6` y la
   orfandad de `LISTING`.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:479-482`:

> 2. **Nada filtra el contenido antes de que sea público.** Una ficha mal cargada, spam o
>    contenido inapropiado sale al sitio y se corrige después.
> 3. **Consecuencia nueva, registrada como `E-TRIAL-04`**: toda moderación pasa a ser
>    reactiva, y bajar una ficha ya publicada **no devuelve el trial**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:291-300`:
las ocho filas `PB1`…`PB8`, **ninguna** con un evento de moderación ni de borrado, y la regla que
lo vuelve inejecutable, `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:34-35`:

> 1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa.

El diseño nombra el estado que no declara, `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:47`:

> | **el estado del recurso** | una ficha en borrador, archivada o eliminada acepta operaciones si su dueño está en regla |

y el PDR exige el caso, `.specs/HOS-1352-billing-verticals-redesign/docs/00-PDR.md:679`: *«borrar ficha;»*.

**Severidad**: `CRITICA`. Operación principal inejecutable: es el único control de contenido que
dejó `DEC-TRIAL-005`, y además la puerta de `A6` (`F-8CA2-003`). Cualquier mapeo improvisado lo
revierte la propia máquina.

**Necesita decisión del owner**: **sí**, en parte. Que falten filas es corrección; **qué estado es
«moderada»** (¿vuelve sola al recuperar cobertura? ¿el dueño la puede republicar?) es política.

---

## ALTA

### F-8CA2-005 — La presencia de Partner no tiene máquina: un Gold que deja de pagar sigue publicado

**Qué se rompe.** El glosario declara que la presencia de Partner es una entidad **con su propio
ciclo de publicación**; ese ciclo no existe en ningún capítulo, y los dos que podrían tenerlo se
remiten mutuamente. `PB2` es de fichas, y el reconciliador de excedentes trabaja con limits,
mientras que la presencia es un **entitlement booleano**. Nadie baja la presencia cuando muere la
suscripción Gold, ni cuando un Gold baja a Silver.

**El camino.**

1. Juan es Partner Gold con su página publicada.
2. Deja de pagar: `S4` → `S6` → `SUSPENDED`, o baja a Silver por sucesión.
3. El aviso de cobertura dispara `PB2` sobre **fichas**; Juan no tiene fichas.
4. Su página sigue pública, con la presencia pagada que ya no paga. No hay transición que la baje
   ni estado al que bajarla.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:47`:

> | **Presencia de Partner** | [...] es una entidad distinta con su propio ciclo de publicación. |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:186-187`:

> - **El ciclo de publicación de la presencia** es del capítulo 19

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:79-81`:

> - **El ciclo de publicación de la presencia de Partner** (cap. 18, épica de verticales): que
>   existe y que la da el plan Gold está decidido; cómo se publica es diseño de producto, no de
>   billing.

`18-partner.md:48-50` (es booleano, no limit, así que el reconciliador de limits no la alcanza) y
`nucleo/03-maquinas-de-estado.md:19-22` (son **nueve** máquinas; la presencia no es ninguna).

**Severidad**: `ALTA`. Servicio pago entregado sin cobro, indefinidamente, acotado a Partner Gold
(población chica y administrada, recuperable a mano por un admin).

**Necesita decisión del owner**: **no** para que exista la máquina (el glosario ya la promete);
**sí** para su forma, porque V/19 la declara «diseño de producto».

---

### F-8CA2-006 — `T2` y `T6` queman el trial de por vida con una suscripción cuyo primer cobro después se rechaza

**Qué se rompe.** El trial es único de por vida y **no vuelve nunca**. `T2`/`T6` lo consumen
sobre la aparición de un título que en los 26–44 minutos siguientes puede morir por `S16` sin haber
cobrado nada. Resultado: sin trial, sin suscripción, sin haber pagado, y la ficha abajo.

**El camino.**

1. Juan está en `TRIAL_ACTIVE` en Alojamiento, día 5 de 30.
2. Se suscribe al Básico: `S2` → `ACTIVE`, emite fuente → `T2` → `TRIAL_CONVERTED` (terminal).
3. A los 30 minutos el proveedor rechaza el primer cobro: `S16` → `CHARGE_DECLINED`, no emite.
4. `cubierto` pasa a falso → `PB2` le baja la ficha. Sus 25 días de trial desaparecieron por una
   suscripción que nunca cobró. Variante `T6`: contrata antes de publicar, publica en esa ventana,
   y la fila de trial nace **consumida**.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:45`:

> | T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` | — |

`03-maquinas-de-estado.md:254-255`:

> Lo que no pierde es
> nada: **la condición garantiza que hay un título vivo**, así que no necesita probar lo que ya
> tiene.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:123` (`S2` emite y eso
mueve el trial) y `:137` (`S16`, desde `ACTIVE`). La ventana, `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:251-253`:

> el servicio que recibió se mide en minutos
> —el cobro real llega **entre 26 y 44 minutos** después de autorizar (`PA-3`, re-medido el
> 2026-09-17)—

**Severidad**: `ALTA`. No se pierde plata, pero se destruye el activo «más caro que una persona
tiene una sola vez en la vida» (palabras del propio `V/03` §2) por un rechazo de tarjeta; y el
camino es normal (tarjeta que no pasa), no un borde.

**Necesita decisión del owner**: **sí**. Esperar el primer cobro antes de convertir cambia el
vocabulario del contrato (hoy la frontera no distingue «autorizó» de «cobró»), y `DEC-TRIAL-008`
cerró abrir hechos nuevos.

---

### F-8CA2-007 — La discontinuación no baja las fichas de quien tiene un grant anclado en esa vertical

**Qué se rompe.** El día del fin de servicio «las fichas pasan a `UNPUBLISHED_BY_BILLING` por
`PB2`». Pero `PB2` dispara **por el cambio de `cubierto`**, y para un beneficiario de *Free
Forever* anclado a esa vertical `cubierto` sigue verdadero para siempre: el grant emite
`NO_VENCE`, lee la versión vigente «vendible o no», y la discontinuación no toca grants. La
vertical cerrada sigue prestando servicio a esa población, con fichas publicables nuevas incluidas.

**El camino.**

1. Juan tiene *Free Forever* con ancla en Gastronomía y dos fichas publicadas.
2. `SUPER_ADMIN` discontinúa Gastronomía; llega el fin de servicio.
3. El barrido corre `PB2`… cuyo evento no ocurrió: o se ejecuta sin evento (regla 1: no se
   ejecuta) o no se ejecuta. Las fichas de Juan siguen arriba.
4. Día 90: `PB4` relee, Juan está cubierto, reinicia. Nunca se archiva, nunca se borra. Juan
   puede además publicar fichas nuevas (`PB1` lo autoriza su grant).

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:234-235`:

> **El día del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING` por PB2 del capítulo
> 03 §9

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:294`:

> | PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` |

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:550-551`:

> **La fuente `GRANT` de una vertical existe mientras el ancla de esa vertical esté VIVA.**

Busqué `grant`, `ancla` y `permanent_grant` en `B/10` §4: la discontinuación sólo trata
suscripciones (`S26`–`S28`) y cortesías diferidas; el ancla del grant no aparece. Y
`17-autorizacion.md:321-322` confirma que la discontinuación no toca el acceso por otra vía.

**Severidad**: `ALTA`. Deja la discontinuación incompleta para una población chica y conocida
(grants los firma `SUPER_ADMIN`), recuperable a mano.

**Necesita decisión del owner**: **sí**. Qué le pasa a un *Free Forever* cuando su vertical cierra
(¿se desancla? ¿se revoca esa ancla?) es política; `12-contrato…` §2.8 declara «desanclar no está
declarado».

---

### F-8CA2-008 — `PB7`/`PB3` republican una ficha que el hard delete ya vació, y le dan prioridad en el cupo

**Qué se rompe.** El hard delete borra el contenido y **no mueve el estado**. Si el dueño recupera
la cobertura después del día 180, `PB7` publica automáticamente una página vacía. Y por el
criterio de vuelta —«primero la publicada menos recientemente»— la ficha vacía, que suele ser la
más vieja, **ocupa el cupo antes que las fichas intactas**.

**El camino.**

1. Juan tiene 4 fichas; la A (la más vieja) quedó archivada y pasó el día 180: contenido borrado,
   estado `ARCHIVED`.
2. Juan recontrata un plan con cupo 3. `PB3`/`PB7` ordenan una sola cola por fecha de publicación.
3. Suben A (vacía) y dos más; una intacta queda abajo. El sitio público muestra una ficha sin
   texto ni fotos.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:326-328`:

> El **hard delete del día 180** no es una transición de publicación —no mueve la ficha de estado: le borra el contenido

`03-maquinas-de-estado.md:404-406`:

> **El criterio es el inverso exacto del de bajada: vuelve primero la que cayó al final.** Como
> *«cae lo más reciente primero»* (`DEC-SUB-008`), eso es **la publicada menos recientemente entre
> las que están abajo**

`03-maquinas-de-estado.md:299` (`PB7` sólo mira el origen, no el contenido). El diseño conoce la
ficha vacía, pero sólo para un correo, `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:297-298`:

> si la suspensión cruzó el día 180, el hard delete ya se llevó el contenido de la ficha
> (`V/02` §4.1) y lo que vuelve es una ficha vacía.

**Severidad**: `ALTA`. Publicación pública de páginas vacías y desplazamiento de fichas intactas
de un cliente que paga; recuperable a mano con `PB6`/`PB1`.

**Necesita decisión del owner**: **no**. Es corrección (la guarda de `PB3`/`PB7` tiene que excluir
lo vaciado).

---

### F-8CA2-009 — Carrera `PB1` contra `PB2`: publicar mientras se pierde la cobertura deja la ficha pública gratis hasta 90 días

**Qué se rompe.** `PB1` se autoriza con la cobertura leída en t0; `PB2` recorre las publicadas en
t1; `PB1` escribe en t2. La ficha queda `PUBLISHED` sin cobertura, **sin ningún evento que la
vuelva a mirar**, y `PB1` además **reinicia** el reloj (hecho 3): la red de `PB4` la alcanza recién
90 días después.

**El camino.**

1. Juan está en `GRACE_PERIOD`, último día. Abre el editor de un borrador.
2. t0: autorización de `PB1` → cubierto (grace emite), pasa los pasos 5–7.
3. t1: `S6` → `SUSPENDED`, aviso, `PB2` baja las publicadas. El borrador aún es `DRAFT`.
4. t2: `PB1` escribe `PUBLISHED` y `inactiva_desde = t2`.
5. No hay otro cambio de cobertura. El reconciliador ya corrió en t1. La ficha queda pública 90
   días sin pagar.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:302-303`:

> **`PB2` y `PB3` se disparan por el CAMBIO de `cubierto` —o por el del cupo—, no por una lista de
> transiciones**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:289-290`:

> Y no hace falta una lista nueva: **es la misma lista que invalida el caché** (cap. 02 §3.2), con
> sus siete entradas.

— y `PB1` no está en esa lista (`V/02` §3.2, `02-modelo-de-datos.md:375-386`). La única regla de
concurrencia del programa es de la otra máquina, `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:69-70`:

> la tabla del capítulo 03 se reevalúa contra el estado actual, no contra el
> que el proceso leyó al empezar.

Busqué `carrera|concurren|lock|serializ` en toda la épica de verticales y el núcleo: la única
aparición es la palabra «carreras» en la lista de escenarios de `V/20` §1.

**Severidad**: `ALTA`. Acceso indebido acotado (una ventana chica, hasta 90 días de publicación
gratis), sin plata cobrada de más.

**Necesita decisión del owner**: **no**. Corrección: la máquina de publicación necesita la misma
regla de relectura en la transacción que billing declaró para la suya.

---

### F-8CA2-010 — Dos `PB1` concurrentes superan cualquier cupo, incluido «una sola ficha en trial»

**Qué se rompe.** El invariante 6 (máximo una ficha en trial) y todo limit de fichas se hacen
cumplir en el paso 7 como lectura-y-después-escritura, sin restricción de base ni relectura. Dos
publicaciones en paralelo pasan las dos. Y el exceso no lo corrige nadie: `PB1` no dispara el
reconciliador.

**El camino.**

1. Juan en `PRE_TRIAL` con dos borradores abre dos pestañas y publica los dos a la vez.
2. Cada `PB1` evalúa «¿le queda cupo?» sobre 0 publicadas → sí. `T1` corre una sola vez (el
   `UNIQUE` de `trial` lo frena), pero las **dos** fichas quedan publicadas.
3. Mismo camino para un plan de 3 fichas: 4 publicadas pagando 3.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:56`:

> | 6 | máximo una ficha en trial | el primer override de esa misma lista (`DEC-TRIAL-001`) |

(nivel servicio: `04-invariantes.md:51`), y el paso, `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:66`:

> | 7 | **limits** | ¿le queda cupo? | excedido |

**Severidad**: `ALTA`. Evade el precio por cantidad de fichas (el eje de los tiers) con una
técnica trivial; el exceso es permanente mientras nada recalcule.

**Necesita decisión del owner**: **no**. Corrección.

---

## MEDIA

### F-8CA2-011 — `V/11` §5.3 y `V/15` §2.6 pliegan distinto un addon `USER`/`GLOBAL` sobre un trial

**Qué se rompe.** `V/11` §5.3 dice que un addon `USER`/`GLOBAL` no aporta nada a una vertical cuyo
único título es un trial. El gate que ejecuta el pliegue (`V/15` §2.6, con su guard `G-R2`) sólo
descarta complementos **cuando no hay ningún `TÍTULO`**, y un trial corriendo **es** `TÍTULO`. El
que implemente el lugar que pliega mete el addon en el trial, y rompe el §64.7 que `V/11` dice
proteger.

**El camino.** Juan paga «+30 fotos» `GLOBAL` en Alojamiento y abre un trial en Gastronomía. La
resolución de Gastronomía ve un `TÍTULO` (el trial) y suma el addon.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:249-250`:

> **Un addon de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un
> trial.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:130-132`:

> **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`, más
> las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva.**

y `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:211` (`TRIAL` con
`fecha` es `TÍTULO`). `V/15` §2.6 dice que *«una frase no es un gate»*: acá la regla de `V/11` es la
frase.

**Severidad**: `MEDIA`. Dos lugares, dos resultados; el daño es capacidad de más sobre un trial.

**Necesita decisión del owner**: **no**.

---

### F-8CA2-012 — `T7` no alcanza a los partners dados de alta por el camino B, y `V/18` afirma que sí

**Qué se rompe.** El evento candidato de Partner es la **aprobación de la postulación**. El camino
B (alta directa del admin) **no pasa por la postulación**, así que esos partners no tienen el hecho
que `T7` busca en el registro. El día del encendido quedan en `PRE_TRIAL` sin fila; si cancelan y
vuelven por postulación, `T1` les da un trial entero: el reseteo del §10.2 que `T7` existe para
cerrar.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:116-117`:

> **Y la espera nunca bloquea al admin**: el camino B del §17.3 —alta directa— no pasa por la
> postulación

`18-partner.md:88-91`:

> Para Partner el candidato a evento de activación es la
> aprobación del admin (`DEC-TRIAL-003`, implicación 1), así que `T7` alcanzaría a **los partners ya
> aprobados**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:50` (`T7`
exige haber ejercido **el hecho declarado**).

**Severidad**: `MEDIA`. El evento de Partner todavía no está elegido; queda como condición del
encendido que el procedimiento de `V/11` §8.3 no nombra.

**Necesita decisión del owner**: **sí** (qué hecho cuenta como «ya ejerció» para el camino B).

---

### F-8CA2-013 — El corte deja a toda la cartera publicada en `PRE_TRIAL` con el evento ya ejercido: trial nuevo al primer `PB1`

**Qué se rompe.** El principio que funda `T7` —quien ya ejerció el evento de activación no estrena
trial— se aplica en el encendido y **no en el corte**. Todos los anfitriones con fichas publicadas
amanecen en `PRE_TRIAL` sin fila; al publicar cualquier borrador disparan `T1` y reciben el
trial entero. `V/21` cuenta el riesgo sobre **seis** personas; la población es toda la cartera
publicada.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:77-80`:

> **el
> 100 % de los usuarios de producción amanece ahí**. Y el evento que los sacaría **ya ocurrió**

`21-migracion.md:64-65`:

> - **El «trial ya consumido» de seis personas** —las tres `abandoned` y las tres `trialing`—, que
>   sin migrarlo **podrían repetir trial**.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:160`:

> ya fue cliente y ya ejerció el evento que arranca el trial. Devolvérselo el día del encendido es el reseteo del §10.2

**Severidad**: `MEDIA`. Puede ser aceptable comercialmente, pero hoy es una contradicción no
declarada.

**Necesita decisión del owner**: **sí**.

---

### F-8CA2-014 — El hard delete y `PB5` corren sobre la misma columna sin orden: con N ≥ 6 meses se borran borradores nunca archivados

**Qué se rompe.** El día 180 borra «los borradores» y no exige `ARCHIVED`; `PB5` archiva borradores
a los N meses, y N es configuración sin cota contra 180. Con N ≥ 6, el contenido de un borrador se
borra sin haber pasado por el archivado ni por su aviso. Lo mismo si el job de `PB4` estuvo caído:
no hay precondición de estado que ordene los dos relojes.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:442`:

> | **Se borra** al día 180 | el contenido publicable de la ficha (textos, fotos, FAQ, horarios), los borradores

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:297`: `PB5`,
*«`N` es configuración»*. `G-R5` sólo compara la pausa contra el 180 (`V/20` §2); nada compara N.

**Severidad**: `MEDIA`. Depende de un valor de configuración; es un segundo `D16` sin guard.

**Necesita decisión del owner**: **no**.

---

### F-8CA2-015 — Los avisos previos de retención no releen la cobertura: a un cliente al día le llega «tu ficha se va a archivar»

**Qué se rompe.** Los avisos antes del 90 y antes del 180 se programan sobre `inactiva_desde`, que
en una ficha publicada y cubierta tiene hasta 90 días de antigüedad (`F-8CA2-001`). Sólo `PB4`,
`PB5` y el hard delete releen; los avisos son lectores, no relectores. Cada ~90 días, cada cliente
al día recibe un aviso transaccional no suprimible de archivado que no va a ocurrir.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:223`:

> | retención | transaccional | antes del día 90, **al archivar** y antes del día 180, **los tres contados sobre `listing.inactiva_desde`**

y la lista de relectores, que no los incluye, `nucleo/01-glosario.md:121` (*«Son TRES los que
releen»*).

**Severidad**: `MEDIA`. No toca plata ni datos; genera reclamos y le quita credibilidad al aviso que
sí importa.

**Necesita decisión del owner**: **no**.

---

### F-8CA2-016 — `S7` declara «se restituye la publicación» sin cupo; `PB3` la condiciona al cupo

**Qué se rompe.** Dos tablas describen la misma consecuencia de forma distinta. `S2` y `S29` dicen
explícitamente que la tabla de suscripción **no dispara** transiciones de la otra épica; `S7` sí
declara un efecto de publicación, sin la condición de cupo ni el orden de `PB3`. Un implementador de
billing que lea `S7` republica todo.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:128` (efectos de `S7`):
*«se restituye la publicación»*; contra `:123`: *«esta tabla **no dispara** una transición de la
otra épica»*, y `V/03:295` (`PB3` … *«y el cupo alcanza»*).

**Severidad**: `MEDIA`.

**Necesita decisión del owner**: **no**.

---

## BAJA

### F-8CA2-017 — `V/03` §2 sigue diciendo que los pares con dos destinos son tres

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:110-111`:

> y uno de los **tres** que el diseño declara hoy — los otros dos son
> `S5`/`S19` y `S7`/`S19`

El núcleo dice cuatro (`nucleo/03-maquinas-de-estado.md:77`), y el mismo `V/03` lo reconoce 60
líneas más abajo (`:172-173`). Es registro.

**Severidad**: `BAJA`. **Necesita decisión del owner**: **no**.

---

## Ataques que intenté y el diseño resistió

- **Canje de extensión contra el job de vencimiento del trial.** `B/14` §3.2–§3.3: gana el estado
  escrito con concurrencia optimista, y el job relee la fecha de fin dentro de su transacción.
- **`T1`/`T6` disparando a la vez.** Guardas complementarias por `cubierto`, disjuntas por
  construcción (`V/03` §2, `nucleo/03` regla 7).
- **Re-registro con el mismo correo para otro trial.** `UNIQUE(hash_del_correo_normalizado,
  vertical)` sin condición de estado (`V/02` §2.2), y la fila de `trial` sobrevive al hard delete.
- **Suspendido que conserva capacidades por su addon.** El pliegue descarta `COMPLEMENTO` sin
  `TÍTULO` (`V/15` §2.6, `G-R2`).
- **Checkout abierto como cobertura gratis repetible.** `PENDING_AUTHORIZATION` no emite fuente
  (`12-contrato…` §2.6).
- **Upgrade que deja el excedente abajo para siempre.** Segunda rama de `PB3`/`PB7` por cupo
  (`DEC-DATA-003`) — resiste si el aviso llega; ver `F-8CA2-002` si no llega.
- **Grant anclado en una vertical nueva que sigue cobrando la principal.** `S13` corre sobre el
  anclaje (`12-contrato…` §2.8).
- **Revocar un grant devuelve el trial.** `DEC-TRIAL-009` lo decide (dato del log; no se reabre).
- **`PB4` archivando justo cuando vuelve la cobertura.** Con la regla de `B/05` §C1 aplicada a la
  fila de la ficha, cualquiera de los dos órdenes termina en `PUBLISHED`. Resiste **si** se aplica;
  que no esté declarada para verticales es `F-8CA2-009`.

## Fuera de mi vector

- **Saldo de cortesía diferido para siempre en una vertical discontinuada**: declarado y abierto
  (`B/14:447-458`).
- **`S10` que falla al reanudar una cortesía**: la fuente deja de emitir al pasar su fecha y `PB2`
  baja las fichas por una falla nuestra; está declarado como riesgo con marca
  (`B/03:131`), pero el reloj de verticales sigue corriendo (`F-8CA2-001` lo agrava).
- **`BD-TRIAL-01` y la invalidación del caché**: publicar una versión vendible que cambia la
  derivación del plan de trial no figura en la lista de `V/02` §3.2 si no hay suscripciones
  ancladas; está bajo la pregunta abierta de `V/11` (*«Lo que este capítulo NO cierra»*).

## Key Learnings

1. Una columna «reloj» escrita sólo por hechos de **reinicio** no puede contar «desde que dejó de
   estar»: sin un escritor en la pérdida, arrastra la antigüedad del último reinicio. El diseño lo
   corrigió para la discontinuación (hecho 4) y no para el resto.
2. Una relectura puesta como red contra avisos perdidos tiene que ejecutar **el efecto que el aviso
   habría disparado**, no sólo el suyo; si no, esconde el caso.
3. Las orfandades definidas por «el objetivo se borró» dependen de que exista una transición de
   borrado; la máquina de publicación no tiene ninguna, y tampoco tiene moderación.
4. Las carreras de la épica de verticales (publicar contra perder cobertura, dos publicaciones
   contra un cupo) no tienen regla: la única regla de concurrencia del programa es de billing.
5. Las entidades «publicables» que no son fichas (presencia de Partner) quedan fuera de `PB2`, y dos
   capítulos que se remiten mutuamente dejan su máquina sin dueño.
