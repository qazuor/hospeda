---
title: Master Spec 09 — Conciliación
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 9
---

# 09 · Conciliación

El §23 pide un proceso periódico contra el proveedor que detecte webhooks faltantes,
duplicados, pagos y suscripciones huérfanas, estados que no coinciden y preapprovals
desconocidos.

`DEC-CONC-002` ya decidió la forma. Este capítulo la ejecuta: qué corre, cuándo, qué compara y
qué hace con cada diferencia.

---

## 1. Por qué la forma canónica no aplica

Lo normal sería extraer dos inventarios en paralelo —el nuestro y el del proveedor— y
enfrentarlos. **Acá uno de los dos no se puede obtener**, y no es una opinión: está medido.

El buscador de suscripciones del proveedor **falla en tres direcciones y no avisa en ninguna**
(`RC-1`):

| lo que se le pide | lo que devuelve |
|---|---|
| filtrar por nuestra referencia | **la ignora** y devuelve todo |
| filtrar por un estado inválido | **cero resultados con `200`** — no un error |
| filtrar por un estado válido | **un subconjunto plausible**: en producción, `cancelled` trajo **15 de 69** |

**El tercero es el peor**: un barrido que liste desde el proveedor procesa parte de la cartera y
**termina en verde**. Y para cerrar el punto, el buscador devuelve **menos campos** que el `GET`
por id (`RC-4`), mientras que leer **por id sí es confiable** (`RC-2`).

---

## 2. Las cuatro partes

### 2.1 El inventario sale de nuestra base

Se guarda el id de cada suscripción y se leen **de a una, por id**. **El buscador del proveedor
no es fuente de verdad de nada.**

**Consecuencia que conviene decir en voz alta**: guardar ese id deja de ser una comodidad y pasa
a ser **la condición de que la conciliación exista**. Una suscripción cuyo id se pierde es
invisible para el barrido, y sólo reaparece si cobra y emite un webhook.

### 2.2 Las huérfanas se detectan por webhook, no por barrido

Si sólo miramos los ids que ya tenemos, una suscripción que **nunca registramos** no aparecería
jamás. La cubre el otro lado: **toda suscripción que cobra emite un webhook**, así que uno que
llegue de un preapproval desconocido **es** la detección.

### 2.3 Un barrido diario para lo que el webhook no cubre

Sobre todo para lo que **diverge en silencio**. El caso exacto: **mutar el monto no emite
webhook** (`EX-15`), así que un cambio de precio que el proveedor aceptó y no aplicó no tiene
ninguna vía de aviso — sólo aparece releyendo.

### 2.4 Sólo se repara el vínculo automáticamente

Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
sólo dice de quién es. Y está medido que se puede hacer sobre una suscripción viva (`EX-19`).

**Toda divergencia de monto, estado o cobro pone la marca `requiere_conciliación` y la mira una
persona.** Es el criterio del owner aplicado por tercera vez: **la línea no es «automático contra
manual», es «toca plata o no toca plata»**.

---

## 3. Qué compara el barrido, campo por campo

Por cada fila de nuestro inventario —suscripción principal o suscripción de complemento
(`DEC-ADDON-002`)— que no esté en un estado terminal, **más las terminales que las cuatro
salvedades de abajo devuelven al barrido**:

| se compara | contra | si difieren |
|---|---|---|
| estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se evalúa la transición contra la tabla del cap. 03. Si no existe, se pone la **marca** |
| monto vigente | `transaction_amount` | se pone la **marca** — es el caso que no avisa por ningún canal |
| fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`) |
| cobros del período | los `authorized_payments` del preapproval | ver §4 |
| la `version` del recurso | la última que aplicamos | si la del proveedor es mayor, **el recurso cambió sin avisarnos**: se relee entero |

**Los estados terminales de una SUSCRIPCIÓN —`CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`— no se
barren cuando ya no pueden divergir hacia nada que nos importe**, y barrerlos ahí es gastar
llamadas sobre la parte de la cartera que más crece. **La condición no es el estado**: es la de
abajo, y las cuatro salvedades son las poblaciones que no la cumplen.

**Y la exención vale por la razón que hace terminal a cada uno, no por la palabra «terminal».** La
razón, escrita como criterio y no como lista, es una sola:

> **Una fila terminal está exenta cuando su autorización quedó imposibilitada de cobrar por algo
> que NO depende de que una llamada nuestra haya salido bien.** Son dos casos y nada más: **lo
> canceló el proveedor**, o **nuestra llamada ya fue confirmada por una relectura**.

**Escrita como enumeración de transiciones, la garantía era falsa, y hay que decir dónde.** La
versión anterior nombraba tres —`S3`, `S12`/`S17` y `CHARGE_DECLINED`— sobre un conjunto de
**once** puertas a un estado terminal, y de las tres que nombraba una era al revés:

| puerta a un estado terminal | ¿quién dejó el preapproval sin poder cobrar? | ¿exenta? |
|---|---|---|
| `S16` → `CHARGE_DECLINED` | **el proveedor**, en el mismo milisegundo del rechazo (`B/12` §4.4, medido el 2026-09-17) | **sí** |
| el **espejo** del §10.1 → `CANCELLED` | **el proveedor**, por su cuenta: el espejo copia ese hecho | **sí** |
| `S17` → `CANCELLED` | nuestra llamada, **pero con relectura**: si falla, `S17` **no ocurre** y la fila no llega a terminal (`B/03` §3.2) | **sí**, por construcción |
| `S12` → `CANCELLED` | nuestra llamada: la de `S11`, *«de inmediato»* (`DEC-SUB-009`), emitida un tiempo antes y **no confirmada al llegar acá** | **no** |
| `S3` → `ABANDONED` | **nuestra llamada**: el job que recorre las vencidas *«cancela el preapproval en el proveedor»* (`B/03` §3.4 punto 2), y `B/06` §6 lo subraya con `EX-1` todavía `UNKNOWN` — *«es lo único que impide una autorización viva que puede cobrar»* | **no** |
| `S13` → `CANCELLED` | **nuestra llamada**, y `S13` no tiene rama de fallo declarada: su destino es `CANCELLED` pase lo que pase con la llamada | **no** |
| `S20` → `CANCELLED` — la **suscripción de complemento** que el grant convierte a costo $0 (`B/03` §3.2, `B/16` §3.4) | **nuestra llamada**, y como `S13` no tiene rama de fallo declarada: el addon pasa a $0 pase lo que pase con la llamada, porque el §35.2 lo declara gratis desde el acto | **no** |
| `S21` → `CANCELLED` — la **suscripción de complemento** cuya instancia se apagó por `A5` o por `A6` (`B/03` §3.2 y §8, `B/16` §4.4) | **nuestra llamada**, la que `A5`/`A6` mandan sobre **este mismo** preapproval —hay uno solo—, y `S21` no tiene rama de fallo: la fila llega a `CANCELLED` pase lo que pase con la llamada, porque la instancia ya está apagada | **no** |
| `S22` → `CANCELLED` — la **baja pedida estando pausado** (`B/03` §3.2) | **nuestra llamada**, *«de inmediato»* como la de `S11`, y sin rama de fallo: la persona pidió irse y la fila llega a `CANCELLED` pase lo que pase con la llamada | **no** |
| `S23` → `CANCELLED` — la **baja pedida estando suspendido** (`B/03` §3.2) | **nuestra llamada** si el preapproval seguía vivo, con la misma forma que `S22` | **no** — **salvo sobre un pagador manual, que sí está exenta**: ahí no hubo llamada porque no hay débito que detener (`B/06` §7), así que no queda ninguna autorización que pueda cobrar ni ninguna relectura que confirmar |
| la **lápida** del corte → `CANCELLED` | **una persona a mano** contra la API del proveedor, *«sin idempotencia, sin registro y sin nadie que verifique»* (`B/21` §2.5 y `16-fase-7-del-paraguas.md` §4.2) | **no** |

**Las cuatro salvedades que devuelven una terminal al barrido, y por qué cada una.** La exención
vale por el criterio de arriba, así que se cae exactamente donde ese criterio no alcanza:

| # | qué vuelve al barrido | hasta cuándo | por qué la exención no la cubre |
|---|---|---|---|
| 1 | **la suscripción de complemento de una instancia de addon en estado terminal** — seleccionada **por el estado terminal de la instancia** y, desde `S21`, también **por el suyo propio** cuando llegó a `CANCELLED` junto con ella (`B/16` §4.4) | hasta que la relectura la vea `cancelled` | su preapproval lo cancelamos **nosotros**, con una llamada que puede fallar — ver abajo |
| 2 | **una suscripción terminal con la marca `requiere_conciliación` puesta** | hasta que una persona la levante (`S15`) | la exención es sobre *«no puede divergir hacia nada que nos importe»*, y una fila marcada **ya divergió**: lo que el barrido le aporta no es la comparación con el proveedor sino **el reloj de la marca**, que es lo único que hace que el caso no quede abierto para siempre |
| 3 | **una suscripción terminal con un pago acreditado pendiente de resolución** por `S19` — un `payment` **o un `manual_payment`**, porque `S19` retiene el pago del período impago entre por la puerta que entre (`B/03` §3.2) | hasta que la bandera se apague | es plata del cliente en nuestra cuenta. La rama 1 de `B/12` §5.3 deja la predecesora en `CANCELLED` **con un reembolso por confirmar**, así que sin esta salvedad el desenlace que mueve dinero es el único que ningún proceso vuelve a mirar |
| 4 | **una suscripción terminal cuyo preapproval lo canceló una llamada NUESTRA todavía sin confirmar** — **siete** de las **ocho** filas *«no»* de la tabla de arriba: `S12`, `S3`, `S13`, **`S20`**, **`S22`**, **`S23`** y la lápida. **La octava, `S21`, entra por la 1 y no por acá** (ver abajo). **`S20` es de complemento y las otras seis son principales**, y eso no cambia nada acá: lo que la salvedad mira es **quién canceló**, no de qué clase es la fila. **Y `S23` entra sólo cuando hubo llamada**: sobre un pagador manual no la hubo, así que esa mitad ya está exenta en la tabla de arriba y no vuelve al barrido a esperar una relectura que no existe | hasta que la relectura lo vea `cancelled` | es la salvedad 1 aplicada a la suscripción, y por la misma razón exacta: cancelar **no emite webhook** (`EX-15`), así que si la llamada no se aplicó **no hay ninguna otra vía de aviso** y el primer aviso es el cobro. El costo está acotado por su condición de corte —deja de barrerse apenas la relectura confirma—, así que no es la cartera terminal entera sino la cola de las que todavía no confirmaron |

> **La 4 es la que cierra el caso de `S13`, y por eso `S13` no necesita una rama de fallo propia
> como la de `S17`.** `S17` puede no ocurrir porque su cierre depende de la cancelación; `S13`
> **tiene que ocurrir igual** —el §35.3 ordena cortar la obligación de pago y el acceso ya lo da
> el grant—, así que su fila llega a `CANCELLED` aunque la llamada falle. Lo que no puede pasar es
> que en ese caso salga del barrido: el beneficiario de un *Free Forever* seguiría pagando todos
> los meses y el único mecanismo declarado para lo que diverge en silencio tendría escrito que no
> lo mira. La 4 es ese mecanismo, y no cuesta ninguna decisión nueva: es la salvedad 1 con otro
> sujeto.
>
> **Y `S20` entra por la 4 y no por la 1, aunque su sujeto sea un complemento.** La 1 selecciona
> la suscripción de complemento **por el estado terminal de su instancia**, y en `S20` la
> instancia **no** es terminal: sigue `ACTIVE`, a costo $0 (`B/16` §3.4). La fila terminal es la
> suscripción, y la canceló una llamada nuestra que puede fallar — exactamente el sujeto de la
> 4. Si la 1 fuera la puerta, la población quedaría vacía y el preapproval seguiría cobrando el
> addon que acabamos de declarar gratis.
>
> **Y `S21` es el reverso exacto: entra por la 1 y no por la 4.** Allá la instancia sobrevive y la
> fila terminal es sólo la suscripción; **acá las dos llegan a terminal en el mismo acto**
> (`B/16` §4.4), que es justo el sujeto que la 1 selecciona, con la misma condición de corte —hasta
> que la relectura vea el preapproval `cancelled`— y sobre **el mismo** preapproval, porque hay uno
> solo (`DEC-ADDON-002`). Contarla también en la 4 sería barrer dos veces la misma fila por dos
> puertas que terminan en la misma llamada. **Las dos salvedades siguen siendo poblaciones
> distintas**: la 4 son suscripciones cuya cancelación no tiene ninguna instancia detrás, y la 1
> son las que sí.

**La 2 y la 3 se solapan a propósito, y no es redundancia**: la 2 cubre la fila que ya tiene la
marca, la 3 cubre la que **debería** tenerla y no la tiene porque `S18` no llegó a ponerla — que
es el caso que la segunda comprobación de más abajo detecta. Sin la 3, esa comprobación nombra una
rama que su propio alcance excluye.

**Y esto es lo que vuelve consistente la frase de más abajo** —*«una fila con la marca
`requiere_conciliación` SÍ se barre»*—, que hasta acá contradecía al encabezado de este § cada vez
que la fila marcada era terminal.

**Una instancia de addon en estado terminal SÍ se barre, hasta que la relectura la vea
`cancelled`.** Ahí la garantía no existe: su preapproval es propio (`DEC-ADDON-002`), el
proveedor no lo tocó y **lo cancelamos nosotros** cuando `A3`, `A5` —la que lo declara
huérfano, o la que revoca el grant del que colgaba su ancla-título— o `A6` la llevan a un estado terminal
(`B/03` §8) — una llamada que puede fallar,
y **mutar o cancelar no emite webhook**
(`EX-15`), así que no hay ninguna otra vía de aviso. Es exactamente el detector que `B/16` §4.3
declara —*«un addon en estado terminal con su preapproval vivo es una discrepancia que el barrido
ve»*—, y sin esta salvedad el addon salía del barrido **en el mismo acto** en que pasaba a ser
detectable: la exención de arriba lo apagaba. El costo está acotado por su propia condición de
corte —deja de barrerse apenas la relectura confirma la cancelación—, así que no es la cartera
terminal entera sino la cola de las que todavía no confirmaron.

> **El sujeto de esta salvedad son DOS filas, y conviene decir cuál es cuál.** El estado terminal
> es de la **instancia** (`A3`, `A5`, `A6` — `B/03` §8) y el preapproval es de su **suscripción de
> complemento** (`DEC-ADDON-002`, `B/02` §2.4): son dos entidades con dos columnas de estado. Lo
> que la salvedad devuelve al barrido es **la suscripción de complemento**, **seleccionada por el
> estado terminal de la instancia que cuelga de ella** — y eso es lo que hace evaluable el
> detector, porque lo que hay que releer es el preapproval y el preapproval es de la suscripción.
> **Y la instancia pudo llegar a terminal desde cualquiera de sus dos estados vivos**, no sólo
> desde `ACTIVE`: `A5` sale también de `PENDING_AUTHORIZATION` (`B/03` §8), y ahí el preapproval
> existe igual —es el que el checkout iba a autorizar—, así que la llamada que puede fallar es la
> misma y la salvedad lo cubre sin cambiar su condición de corte.
> **En qué estado queda esa suscripción de complemento cuando su instancia muere: `CANCELLED` en
> el acto, y ya está declarado.** Era el hueco que este § dejaba nombrado —ninguna transición del
> §3.2 la llevaba a un estado terminal por esa causa, y por la regla 1 del núcleo eso no se podía
> escribir— y lo cierra **`S21`** (`B/03` §3.2), con la decisión del owner del 2026-09-21 (`DEC-ADDON-004`): **sin
> período de gracia y sin sostener servicio**, porque la capacidad ya la apagó `A5` y lo que un
> `CANCEL_SCHEDULED` sostendría es la fila de un cobro, no un servicio. El razonamiento entero
> —incluido por qué **no** se aplica el patrón de `DEC-SUB-009`, y por qué el período ya cobrado
> **no se reembolsa** automáticamente (`DEC-RF-002`)— está en `B/16` §4.4.
>
> **Y la salvedad ya puede nombrar su sujeto de las dos maneras, que es lo que cambió acá.** Antes
> sólo lo podía seleccionar **por el estado terminal de la instancia**, justamente porque la fila
> de complemento no tenía estado propio que declarara nada; ahora lo tiene. **La selección
> indirecta no sobra por eso, y es la mitad que hace falta escribir**: es la única que ve la
> corrida que ejecutó `A5` y no llegó a `S21`, donde la fila de complemento sigue diciendo `ACTIVE`
> y para las cinco comparaciones de arriba eso **coincide**.
>
> **`S20` es el otro caso y sigue siendo otro.** Ahí la causa es el grant, la instancia
> **sobrevive** y la fila terminal es sólo la suscripción; acá la instancia **muere** y la pregunta
> era qué pasa con su cobro. Dos huecos distintos con el mismo sujeto, y **los dos cerrados**: uno
> por `S20`, el otro por `S21`.
>
> **`A4` no está en esa lista y antes sí estaba.** `A4` es *«llega su fecha de fin → `EXPIRED`»*,
> o sea la vigencia `DÍAS_FIJOS`, y un preapproval propio existe **sólo** si el cobro es
> `PERIÓDICO` (`B/16` §1.2): la taxonomía declara que **`PERIÓDICO` + `DÍAS_FIJOS` no existe**
> (`B/16` §1.3). Nombrarla hacía contar una población vacía y escribir una rama muerta.

**Y hay una comprobación que no le pregunta nada al proveedor: la sucesión abierta sobre una fila
muerta.** Si una fila que el barrido alcanza tiene `sucede_a` **no nulo** y la predecesora a la
que apunta **ya no es fila viva** (`NUCLEO/01` §2.4), la sucesión debería estar cerrada y no lo
está: `S18` no corrió. Se pone la **marca**. Cuesta cero llamadas —las dos filas están en nuestra
base— y vigila el único estado que deja el candado `A` **vacío**, que es el que permite que un
alta nueva entre sin que nada la rechace y queden dos preapprovals cobrando. La rama legítima de
ese estado —la cancelación de `S17` que falló sobre un preapproval vivo— **ya trae la marca
puesta**, así que esto no la duplica: lo que encuentra es la que llegó ahí **sin** marca, o sea
por un camino que `G-R1-C` no alcanzó a impedir.

> **Y la comprobación NO lleva excepción para la sucesora en `PENDING_AUTHORIZATION`: llevaba
> una, y era el agujero.** El argumento decía que `S18` exige la sucesora **`ACTIVE`**, que las
> transiciones por las que la predecesora se muere sola —`S12`, `S13`, `S16` y el espejo del
> §10.1— dejan a la sucesora esperando autorización, y que ahí `S18` *«no es que no corrió:
> todavía no puede correr»*. La premisa se cayó: **desde `B/03` §3.2, `S18` también sale de
> `PENDING_AUTHORIZATION`** cuando la predecesora murió por `S12`, por `S16` o por el espejo,
> justamente para que la sucesora ocupe el candado `A`. En esos tres casos `S18` **sí puede
> correr**, así que una sucesión abierta sobre una predecesora muerta es un incidente y se marca,
> sin esperar nada.
>
> **Y la razón que daba la excepción miraba el lado equivocado del candado.** Decía que *«mientras
> la sucesora no autorizó no hay dos autorizaciones que puedan cobrar, que es la condición del
> candado `A`»*. La condición del candado `A` **no es** que haya dos autorizaciones cobrando: es
> que haya **una fila viva con `sucede_a` nulo** que lo ocupe. Mientras no la hay, el `INSERT` de
> un tercero **no se rechaza** — y `B/12` §4.4 le pide al cliente al que le rechazaron el primer
> cobro que haga exactamente eso. Las dos autorizaciones aparecían **después**, y para entonces la
> sucesión ya no se podía cerrar: `S18` tendría que limpiar `sucede_a` y la base rechazaría la
> escritura por colisión en `A`.
>
> **Lo único que esta comprobación no marca es `S13`**, y no por excepción sino por su propio
> estado: `S13` alcanza también a la sucesora, así que no queda ninguna sucesión abierta sobre una
> fila muerta —quedan **las dos** muertas—, y no hay candado vacío que aprovechar. **Lo que sí
> queda por mirar es el preapproval**, porque el efecto de `S13` es una llamada nuestra que puede
> fallar: eso lo cubre la **salvedad 4**, que devuelve las dos filas al barrido hasta que la
> relectura las vea `cancelled`. Las dos mitades son distintas y hacen falta las dos: una vigila
> el candado, la otra la autorización.

**Y una segunda que tampoco le pregunta nada al proveedor: el pago pendiente por `S19` cuya
sucesión ya terminó.** Si una fila tiene un pago acreditado **pendiente de resolución**
(`B/03` §3.2, `S19`) y ya **no** es la predecesora de una sucesión en curso —la sucesora murió, o
la sucesión se cerró—, su destino estaba determinado y nadie lo ejecutó: se resuelve por la rama
que le corresponda de las seis de `B/12` §5.3, y si la rama no es determinable, se pone la
**marca**. Cuesta cero llamadas y cubre el único estado que el arreglo de `S19` puede dejar
colgado: **un pago retenido para siempre**, que del lado del cliente se lee como un cobro sin
servicio y sin devolución. Hace falta porque el reloj del grace **no corre** mientras ese pago
esté pendiente (`S6`): sin esta comprobación no hay nada que lo destrabe solo.

> **Los dos casos que enumera son alcanzables, y uno de ellos sólo lo es por la salvedad 3.**
> *«La sucesora murió»* deja la predecesora en `GRACE_PERIOD` o `SUSPENDED`, que el barrido
> recorre por su estado. *«La sucesión se cerró»* la deja en `CANCELLED` por `S17` — **terminal**,
> y sin la salvedad 3 esta mitad de la comprobación era inalcanzable por construcción: nombraba
> justo la rama que su propio alcance excluía. Es la rama que mueve dinero, y la única de las
> cuatro que lo hace.
>
> **Y es un backstop, no el disparador.** En el curso normal los cuatro actos de `B/03` §3.2 ya
> resolvieron el pago antes de que el barrido llegue: `S18` pone la marca —por la rama 1 y por la
> rama 5—, `S3` lo reevalúa, `S13` apaga la bandera. Esta comprobación existe para la corrida en
> que alguno no se ejecutó.

**Y una tercera, que tampoco le pregunta nada al proveedor: la vertical que `S13` —o `S20`— no
alcanzó a cerrar.** Si un beneficiario tiene un **ancla viva** en la vertical V —una fila de
`permanent_grant_vertical` cuyo grant tiene **`revocado_en` nulo** (`B/02` §2.4, `NUCLEO/01`
§2.4)— y además **una de estas dos cosas**, el fan-out no terminó de correr y se pone la
**marca**:

| qué no debería existir | qué acto quedó a medias | qué le está pasando al beneficiario |
|---|---|---|
| una **fila viva principal** suya en V | `S13` | **paga todos los meses una vertical que el grant le regaló**, con el §35.3 ordenando lo contrario |
| una **fila viva de complemento** suya cuyo addon es **compatible con V**, si el grant lleva `includesAddons: true` | `S20` (`B/03` §3.2, `B/16` §3.4) | **paga todos los meses un addon que el flag le declaró gratis**, con el §35.2 ordenando lo contrario |

Cuesta cero llamadas —todas esas filas están en nuestra base, **incluida la columna que contesta
si el grant sigue vivo**— y cubre el único estado que ese fan-out puede dejar colgado. **Es una
comprobación y no dos**: los dos actos corren en el mismo instante, fallan del mismo modo y se
arreglan reanudando lo mismo, así que partirla sería contar dos veces el mismo barrido. **Y la
segunda fila no corre si el flag es `false`**: ahí el complemento vivo es lo correcto, no una
divergencia.

> **La segunda fila alcanza también a la corrida que `S20` cortó ENTRE sus dos escrituras, y eso
> depende del orden en que están declaradas** (`B/03` §3.2). `S20` escribe primero el ancla-título
> sobre la instancia y recién después cancela el cobro, así que una corrida cortada deja la fila
> de complemento **todavía viva** — que es exactamente lo que esta comprobación pregunta. Con el
> orden inverso preguntaba por la mitad que ya se había ejecutado y la población le quedaba
> vacía.
>
> **Hace falta porque ése es, con esas palabras, el estado que el diseño declara indetectable.**
> `B/03` §3.2 lo escribe al justificar el alcance de `S13`: *«la fila está `ACTIVE`, el proveedor
> dice `authorized`, y para el barrido eso **coincide**»*. Las cinco comparaciones de arriba no lo
> ven —los dos lados dicen lo mismo— y las otras cuatro comprobaciones miran `sucede_a`, el pago
> pendiente y **una instancia de addon**, no las filas de suscripción del beneficiario. **La
> cuarta sí mira un ancla** —su segunda mitad pregunta si la que era título de una instancia se
> retiró—, y aun así no ve esto: su sujeto es la **instancia**, y acá el que quedó colgado es un
> **cobro**, con su instancia perfectamente sana.
>
> **Y cubre los dos disparadores de `S13`, no uno.** Desde que el scope son anclas, `S13` lo lanza
> el **otorgamiento** y también el **anclaje de una vertical nueva a un grant vivo**
> (`12-contrato…` §2.8), así que la ejecución parcial tiene dos orígenes. La comprobación no
> pregunta por el acto: pregunta por el **resultado**, que es el mismo en los dos.
>
> **No necesita excepción por carrera.** `S13` corre en el mismo acto del otorgamiento o del
> anclaje y el barrido es diario (§7); no hay ventana legítima en la que un ancla viva conviva con
> una fila viva principal en su vertical. Si alguna vez la hubiera, el desenlace es la marca —una
> persona—, no una cancelación automática.
>
> **Y la segunda fila tampoco la necesita, aunque `S20` sí tenga una ventana interna.** Entre sus
> dos escrituras —el ancla-título primero, el cobro después (`B/03` §3.2)— existe un instante en
> que el ancla ya está viva y la fila de complemento todavía también. Esa ventana **no es
> legítima: es el estado que esta comprobación tiene que levantar**, y dura lo que dura el acto
> frente a un barrido diario. Exentarla sería apagar el detector justo sobre la población que lo
> obliga a existir.
>
> **Es el detector de un racimo, no de un caso.** La misma comprobación ve la vertical que `S13`
> no alcanzó por una corrida cortada, la que no alcanzó porque **el acto nuevo no la disparó**, y
> la que alcanzó con la llamada al proveedor fallida —esa última la ve **además** la salvedad 4,
> por el otro lado—. Ninguna de las tres la cierra; las tres las detecta. **Y las mismas tres
> valen para `S20`**, con el complemento en lugar de la principal: es el mismo fan-out, en el
> mismo acto, con la misma llamada por fila.
>
> **En `S20` la primera de las tres tiene una granularidad más fina, y siguen siendo tres.** Una
> corrida de `S20` puede cortarse **dentro de una fila**, entre sus dos escrituras, porque `S20`
> escribe sobre dos entidades (`B/03` §3.2). Es el mismo caso —*«el fan-out no llegó»*— visto más
> de cerca, no uno nuevo, y lo ve esta misma comprobación **gracias al orden**: la fila de
> complemento sigue viva hasta la segunda escritura.

**Y una cuarta, que tampoco le pregunta nada al proveedor: la instancia de addon viva cuyo
objetivo ya murió.** Si una instancia está en uno de sus **dos** estados con autorización que
puede cobrar —`PENDING_AUTHORIZATION` o `ACTIVE` (`B/03` §8)— y su objetivo **ya cumple la
condición de orfandad del `B/16` §4.2**, **o el ancla que era su título ya no es la de un grant
vivo** —el `permanent_grant` de esa ancla tiene **`revocado_en` escrito** (`B/02` §2.4,
`NUCLEO/01` §2.4)—, `A5` no
corrió: se pone la **marca**. Cuesta cero llamadas —la instancia, su objetivo y el ancla del
grant están todos en nuestra base— y **no reescribe el predicado: lo delega** en el §4.2, que es
su único dueño.

> **La segunda mitad no es un adorno del enunciado: sin ella la comprobación es ciega a tres de
> los cuatro scopes.** El evento de `A5` tiene **tres** cláusulas desde `B/03` §8, y la tercera
> —*«se revoca el grant del que cuelga el ancla que era su título»*— es la única que corta un
> addon de scope `LISTING`,
> `USER` o `GLOBAL` cuyo título era un grant: su objetivo es una ficha o una cuenta que **siguen
> existiendo**, así que la condición de orfandad **no se cumple nunca** y una comprobación
> escrita sólo sobre el objetivo no encuentra a nadie. Es la misma delegación: el predicado de la
> tercera cláusula vive en `B/03` §8, no acá. **Y se lee igual de barata con el enunciado nuevo**:
> que el grant del ancla siga vivo es un dato de nuestra base **desde que es una columna**
> —`permanent_grant.revocado_en`, `B/02` §2.4—, así que la comprobación sigue costando **cero
> llamadas**.
>
> **Esa frase se escribió antes que la columna, y hasta la FASE 9-bis-4 era falsa.** `B/02` §2.4
> no declaraba para el grant **ni estado ni revocación**, así que *«que siga vivo»* no era un dato
> de nuestra base: era un acto que nadie había guardado, y esta mitad del predicado —como la
> tercera comprobación entera y como la tercera mitad de la orfandad— **no se podía evaluar**.
> Lo que cambió no es el enunciado sino contra qué se lee.
>
> **Y la pregunta se hace DESPUÉS de la revocación, que es por qué el ancla no se borra.** Si
> revocar borrara las filas de `permanent_grant_vertical`, esta mitad se quedaría sin sujeto
> —`addon_instance` apuntaría a una fila que no existe— justo en el instante en que tiene que
> contestar. Revocar **marca el instrumento**; las anclas sobreviven como filas y dejan de ser
> vivas todas a la vez (`B/02` §2.4).
>
> **Es el reverso exacto de la salvedad 1, y hacen falta las dos.** La salvedad 1 mira una
> instancia **terminal** con el preapproval **vivo** —`A5` corrió y la llamada al proveedor no se
> aplicó, **o corrió `A5` y no `S21`**—; ésta mira una instancia **viva** con el objetivo
> **muerto** —`A5` no corrió—. Ninguna de las dos ve el caso de la otra, y entre las dos cubren
> las dos mitades del *«el que no puede fallar»* del `B/16` §4.3. **Y `S21` no agrega ninguna**:
> su ejecución parcial no pide comprobación propia, porque su fila ya vuelve al barrido por la 1.
> La quinta, que sí existe, es la de la pausa vencida y llegó por otro sujeto (más abajo).
>
> **Hace falta porque este estado es indetectable por comparación, con las mismas palabras que el
> de `S13`**: la instancia dice `ACTIVE`, el proveedor dice `authorized`, y para las cinco
> comparaciones de arriba eso **coincide**. El detector que el `B/16` §4.3 declara —*«un addon en
> estado terminal con su preapproval vivo»*— busca justo lo contrario, así que sobre esta
> población está apagado.
>
> **Es un backstop, no el disparador.** En el curso normal `A5` ya cerró la instancia en alguno de
> los **cuatro** momentos que el `B/16` §4.3 enumera —el cuarto es la revocación del grant o el
> retiro de un ancla—. Esta comprobación existe para la corrida en que ninguno se ejecutó, y su
> desenlace es la marca —una persona—, nunca una cancelación automática.

**Y una quinta, que tampoco le pregunta nada al proveedor: la pausa vencida que no reanudó.** Si
hay una `subscription_pause` **sin `fin_real`** cuyo **`fin_previsto` ya pasó** (`B/02` §2.2) y su
suscripción sigue en `PAUSED`, `S10` no corrió: se pone la **marca**. Cuesta cero llamadas —la
pausa y la suscripción están las dos en nuestra base— y cubre el único estado que **la salida que
devuelve el servicio** puede dejar colgado.

**Las otras dos salidas de `PAUSED` no producen ese estado, y por eso la comprobación no las
nombra.** `S22` —la baja— y `S13` —el grant— mandan la fila a `CANCELLED`, así que la tercera
condición de arriba (*«su suscripción sigue en `PAUSED`»*) **deja de cumplirse** y el caso sale
del detector por donde corresponde. `S22` además escribe el `fin_real` de la pausa, que es la
primera condición. Una pausa cerrada por cualquiera de las dos **no queda colgada y no produce un
falso positivo**.

> **Hace falta porque este estado es indetectable por comparación, y acá los dos lados dicen lo
> mismo de verdad.** `PS-4` mide que el proveedor **no tiene auto-reanudación**, así que su
> preapproval sigue `paused` igual que nuestra fila: para las cinco comparaciones de arriba eso
> **coincide**, exactamente como en el caso de `S13`. Y las otras cuatro comprobaciones miran
> `sucede_a`, el pago pendiente de `S19`, las filas vivas bajo un ancla y una instancia de addon;
> **ninguna mira el reloj de una fila**.
>
> **Es la comprobación que mira el TIEMPO REAL de una fila, y por eso no la cubre `D16`.** `D16`
> compara *«el tope de una pausa que declara el catálogo»* contra el día del hard delete
> (cap. 04 §3, núcleo) — **dos cifras de configuración**, las dos verdaderas mientras nadie las
> toque y **las dos ciegas a que una pausa concreta lleve 140 días abierta**. `G-R5` sigue en
> verde en ese escenario, y tiene razón: no es su pregunta.
>
> **Y lo que está en juego no es sólo el cobro.** Una reanudación que no ocurre deja al cliente
> **sin servicio y sin cobro** desde el día en que su pausa vencía, y —porque `cubierto` sigue
> falso— con el reloj de inactividad de verticales corriendo hacia el hard delete del día 180
> (`V/02` §4.1, `NUCLEO/01` §1.2). Es la única de las cinco comprobaciones cuyo desenlace no
> atendido **borra datos del cliente**.
>
> **Es un backstop, no el disparador.** En el curso normal la rama de fallo de `S10` (`B/03` §3.2)
> ya puso la marca cuando la relectura vio el preapproval todavía `paused`. Esta comprobación
> existe para la corrida que **no se ejecutó nunca**, que es el modo que ninguna relectura
> produce. Su desenlace es la marca —una persona—, nunca una reanudación automática a ciegas.

**Una fila con la marca `requiere_conciliación` SÍ se barre**, y conviene decir por qué, porque la
intuición contraria es fuerte y costaba caro.

Parecía razonable sacarla: ya divergió, hay una persona mirándola, y volver a compararla sólo
agrega ruido. **Pero lo que se apaga así no es el ruido: es el único detector.** Una suscripción a
la que el proveedor le cobra un monto distinto del pactado entra en un estado del que **el sistema
deja de hablar** —se alerta una vez, sale del barrido, y la marca además le bloquea al cliente el
único acto con el que podría salir—, y **el cobro equivocado sigue saliendo de su tarjeta todos los
meses**.

> **Lo que se agrega es el AVISO, nunca la comparación.** El barrido sigue corriendo sobre la fila;
> lo que no vuelve a emitir es una alerta por corrida sobre un caso ya abierto.

**Y no hace falta inventar el mecanismo: es el de `DEC-OBS-001`**, que ya decidió exactamente esto
para el mismo problema —*«el correo es agregado, con límite de frecuencia, en vez de uno por
evento»*— y cuyo canal primario es el listado accionable, no el correo.

**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**: es una divergencia de plata
que nadie resolvió, y sin reloj el servicio que la fila sostiene **no tiene cota**. El plazo es
configuración, como todos los del §42.

---

## 4. Los tres modos de «cero cobros», y ninguno se distingue solo

Es la trampa mejor documentada de este carril, y casi produce dos conclusiones falsas durante la
medición. `GET /authorized_payments/search?preapproval_id=` devuelve **cero** por tres causas
distintas:

| causa | cómo se distingue |
|---|---|
| **no cobró nunca** | el preapproval tiene `charged_quantity` en cero o nulo |
| **lag**: cobró y el endpoint todavía no lo indexó | **el contador del preapproval se actualiza ANTES que el endpoint de cobros** — está medido: a las 21:33 decía `charged_quantity: 1` y el search devolvía 0; minutos después devolvía 1 |
| **el id es de otra cuenta** | la lectura por id del preapproval falla |

**La regla que sale de esto: la conciliación nunca concluye «no cobró» desde ese endpoint.**
Concluye desde el contador del preapproval, y usa el endpoint para traer el detalle. Al revés, un
reconciliador que vea subir el contador y vaya a buscar el cobro **no lo encuentra**, y eso no es
una divergencia.

---

## 5. El bug vivo que pasa a ser caso de uso

Hay un error real en producción —webhooks de suscripción que fallan porque el preapproval no
resuelve a ninguna suscripción nuestra, la API responde `500` y los encola hasta cinco veces—
registrado durante FASE 1C y **no tocado**, porque el §4 prohíbe tocar código productivo.

**Ese error es exactamente el detector de §2.2 funcionando.** El sistema detecta la huérfana
bien; lo que está mal es lo que hace después. **Cuando se arregle, no debe silenciarse: tiene que
convertirse en el disparador de la re-vinculación.**

> Esto aparece acá como **modo de falla ya observado**, no como razón de diseño: la forma de la
> conciliación la fija `DEC-CONC-002`, no este incidente.

---

## 6. Dos límites que no se pueden correr

1. **Más allá de doce meses, la única fuente somos nosotros.** La documentación del proveedor
   dice que su buscador de pagos cubre sólo los últimos doce meses. El histórico es nuestro o no
   existe — y eso alcanza al histórico de reembolsos (`DEC-RF-001`).
2. **El cobro del proveedor llega tarde y el retraso es variable**: ~33 minutos en una renovación
   de sandbox, ~26 en producción, ~100 segundos en un alta. **El barrido no puede tratar como
   divergencia un cobro que todavía no apareció**, y por eso su ventana de tolerancia se fija
   contra el retraso medido, no contra la fecha nominal.

---

## 7. Frecuencia y orden

| proceso | cuándo | por qué esa frecuencia |
|---|---|---|
| **detección por webhook** | continua | es el camino principal (§2.2) |
| **barrido de la cartera** | **diario** | es lo que `DEC-CONC-002` fijó, y alcanza para lo que diverge en silencio: un monto mal aplicado cuesta un ciclo, no un día |
| **barrido de creaciones sin respuesta** | **cada pocos minutos** | es el estado intermedio de `DEC-CONC-001`: una creación que quedó sin respuesta puede haber cobrado, y ahí el tiempo sí importa |

**Los dos barridos son idempotentes**: correrlos dos veces no produce nada distinto, porque
ninguno escribe salvo la reparación de vínculo del §2.4.

---

## Lo que este capítulo NO cierra

- **`RF-3` sigue `UNKNOWN`**: qué pasa al reembolsar un pago de más de 180 días. Alcanza a la
  reparación de una divergencia vieja y es del capítulo 13.
- **Las cinco filas del grace** (`RN-2`, `RN-3`, `GR-1`, `GR-2`, `GR-3`) se contestan el
  2026-09-17. Hasta entonces, **la ventana de tolerancia del §6.2 no se puede fijar para el caso
  de un cobro fallido**, porque no se sabe cuántas veces reintenta el proveedor ni en qué estado
  deja la suscripción mientras lo hace.
