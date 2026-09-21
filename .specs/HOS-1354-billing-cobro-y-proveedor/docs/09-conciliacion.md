---
title: Master Spec 09 — Conciliación
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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
**siete** puertas a un estado terminal, y de las tres que nombraba una era al revés:

| puerta a un estado terminal | ¿quién dejó el preapproval sin poder cobrar? | ¿exenta? |
|---|---|---|
| `S16` → `CHARGE_DECLINED` | **el proveedor**, en el mismo milisegundo del rechazo (`B/12` §4.4, medido el 2026-09-17) | **sí** |
| el **espejo** del §10.1 → `CANCELLED` | **el proveedor**, por su cuenta: el espejo copia ese hecho | **sí** |
| `S17` → `CANCELLED` | nuestra llamada, **pero con relectura**: si falla, `S17` **no ocurre** y la fila no llega a terminal (`B/03` §3.2) | **sí**, por construcción |
| `S12` → `CANCELLED` | nuestra llamada: la de `S11`, *«de inmediato»* (`DEC-SUB-009`), emitida un tiempo antes y **no confirmada al llegar acá** | **no** |
| `S3` → `ABANDONED` | **nuestra llamada**: el job que recorre las vencidas *«cancela el preapproval en el proveedor»* (`B/03` §3.4 punto 2), y `B/06` §6 lo subraya con `EX-1` todavía `UNKNOWN` — *«es lo único que impide una autorización viva que puede cobrar»* | **no** |
| `S13` → `CANCELLED` | **nuestra llamada**, y `S13` no tiene rama de fallo declarada: su destino es `CANCELLED` pase lo que pase con la llamada | **no** |
| la **lápida** del corte → `CANCELLED` | **una persona a mano** contra la API del proveedor, *«sin idempotencia, sin registro y sin nadie que verifique»* (`B/21` §2.5 y `16-fase-7-del-paraguas.md` §4.2) | **no** |

**Las cuatro salvedades que devuelven una terminal al barrido, y por qué cada una.** La exención
vale por el criterio de arriba, así que se cae exactamente donde ese criterio no alcanza:

| # | qué vuelve al barrido | hasta cuándo | por qué la exención no la cubre |
|---|---|---|---|
| 1 | **una instancia de addon** en estado terminal | hasta que la relectura la vea `cancelled` | su preapproval lo cancelamos **nosotros**, con una llamada que puede fallar — ver abajo |
| 2 | **una suscripción terminal con la marca `requiere_conciliación` puesta** | hasta que una persona la levante (`S15`) | la exención es sobre *«no puede divergir hacia nada que nos importe»*, y una fila marcada **ya divergió**: lo que el barrido le aporta no es la comparación con el proveedor sino **el reloj de la marca**, que es lo único que hace que el caso no quede abierto para siempre |
| 3 | **una suscripción terminal con un pago acreditado pendiente de resolución** por `S19` | hasta que la bandera se apague | es plata del cliente en nuestra cuenta. La rama 1 de `B/12` §5.3 deja la predecesora en `CANCELLED` **con un reembolso por confirmar**, así que sin esta salvedad el desenlace que mueve dinero es el único que ningún proceso vuelve a mirar |
| 4 | **una suscripción terminal cuyo preapproval lo canceló una llamada NUESTRA todavía sin confirmar** — las cuatro filas *«no»* de la tabla de arriba: `S12`, `S3`, `S13` y la lápida | hasta que la relectura lo vea `cancelled` | es la salvedad 1 aplicada a la suscripción, y por la misma razón exacta: cancelar **no emite webhook** (`EX-15`), así que si la llamada no se aplicó **no hay ninguna otra vía de aviso** y el primer aviso es el cobro. El costo está acotado por su condición de corte —deja de barrerse apenas la relectura confirma—, así que no es la cartera terminal entera sino la cola de las que todavía no confirmaron |

> **La 4 es la que cierra el caso de `S13`, y por eso `S13` no necesita una rama de fallo propia
> como la de `S17`.** `S17` puede no ocurrir porque su cierre depende de la cancelación; `S13`
> **tiene que ocurrir igual** —el §35.3 ordena cortar la obligación de pago y el acceso ya lo da
> el grant—, así que su fila llega a `CANCELLED` aunque la llamada falle. Lo que no puede pasar es
> que en ese caso salga del barrido: el beneficiario de un *Free Forever* seguiría pagando todos
> los meses y el único mecanismo declarado para lo que diverge en silencio tendría escrito que no
> lo mira. La 4 es ese mecanismo, y no cuesta ninguna decisión nueva: es la salvedad 1 con otro
> sujeto.

**La 2 y la 3 se solapan a propósito, y no es redundancia**: la 2 cubre la fila que ya tiene la
marca, la 3 cubre la que **debería** tenerla y no la tiene porque `S18` no llegó a ponerla — que
es el caso que la segunda comprobación de más abajo detecta. Sin la 3, esa comprobación nombra una
rama que su propio alcance excluye.

**Y esto es lo que vuelve consistente la frase de más abajo** —*«una fila con la marca
`requiere_conciliación` SÍ se barre»*—, que hasta acá contradecía al encabezado de este § cada vez
que la fila marcada era terminal.

**Una instancia de addon en estado terminal SÍ se barre, hasta que la relectura la vea
`cancelled`.** Ahí la garantía no existe: su preapproval es propio (`DEC-ADDON-002`), el
proveedor no lo tocó y **lo cancelamos nosotros** cuando `A3`, `A5` —la que declara al
addon huérfano— o `A6` la llevan a un estado terminal (`B/03` §8) — una llamada que puede fallar,
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
> **Lo que sigue sin estar declarado es en qué estado queda esa suscripción de complemento cuando
> su instancia muere por orfandad**: ninguna transición del §3.2 la lleva a un estado terminal por
> esa causa, y por la regla 1 del núcleo eso no se puede escribir. Queda nombrado y **no se
> resuelve acá**: elegir el estado de llegada es elegir si sostiene servicio hasta una fecha, que
> es una decisión de producto.
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
que le corresponda de las cinco de `B/12` §5.3, y si la rama no es determinable, se pone la
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

**Y una tercera, que tampoco le pregunta nada al proveedor: la vertical que `S13` no alcanzó a
cerrar.** Si un beneficiario tiene un **ancla viva** en la vertical V (`permanent_grant_vertical`,
`B/02` §2.4) y además una **fila viva principal** suya en V, `S13` no terminó de correr: se pone
la **marca**. Cuesta cero llamadas —las dos filas están en nuestra base— y cubre el único estado
que el fan-out de `S13` puede dejar colgado: **el beneficiario de un *Free Forever* pagando todos
los meses una vertical que el grant le regaló**, con el §35.3 ordenando lo contrario.

> **Hace falta porque ése es, con esas palabras, el estado que el diseño declara indetectable.**
> `B/03` §3.2 lo escribe al justificar el alcance de `S13`: *«la fila está `ACTIVE`, el proveedor
> dice `authorized`, y para el barrido eso **coincide**»*. Las cinco comparaciones de arriba no lo
> ven —los dos lados dicen lo mismo— y las otras dos comprobaciones miran `sucede_a` y el pago
> pendiente, no los grants.
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
> **Es el detector de un racimo, no de un caso.** La misma comprobación ve la vertical que `S13`
> no alcanzó por una corrida cortada, la que no alcanzó porque **el acto nuevo no la disparó**, y
> la que alcanzó con la llamada al proveedor fallida —esa última la ve **además** la salvedad 4,
> por el otro lado—. Ninguna de las tres la cierra; las tres las detecta.

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
