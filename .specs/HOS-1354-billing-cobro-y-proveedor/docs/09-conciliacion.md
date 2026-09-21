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
(`DEC-ADDON-002`)— que no esté en un estado terminal, **más las terminales que la salvedad del
complemento devuelve al barrido**:

| se compara | contra | si difieren |
|---|---|---|
| estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se evalúa la transición contra la tabla del cap. 03. Si no existe, se pone la **marca** |
| monto vigente | `transaction_amount` | se pone la **marca** — es el caso que no avisa por ningún canal |
| fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`) |
| cobros del período | los `authorized_payments` del preapproval | ver §4 |
| la `version` del recurso | la última que aplicamos | si la del proveedor es mayor, **el recurso cambió sin avisarnos**: se relee entero |

**Los estados terminales de una SUSCRIPCIÓN no se barren**: `CANCELLED`, `ABANDONED` y
`CHARGE_DECLINED` no pueden divergir hacia nada que nos importe, y barrerlos es gastar llamadas
sobre la parte de la cartera que más crece.

**Y la exención vale por la razón que hace terminal a cada uno, no por la palabra «terminal».**
En los tres, la autorización quedó imposibilitada de cobrar por algo que ya ocurrió y que no
depende de que una llamada nuestra haya salido bien: `S3` canceló el preapproval al vencer la
ventana, `S12` y `S17` lo cancelan sobre una fila cuyo preapproval `S11` ya canceló *«de
inmediato»* o cuya relectura lo confirma (`B/03` §3.2), y en `CHARGE_DECLINED` **lo canceló el
proveedor** en el mismo milisegundo del rechazo (`B/12` §4.4, medido el 2026-09-17).

**Una instancia de addon en estado terminal SÍ se barre, hasta que la relectura la vea
`cancelled`.** Ahí la garantía no existe: su preapproval es propio (`DEC-ADDON-002`), el
proveedor no lo tocó y **lo cancelamos nosotros** cuando `A3`, `A4`, `A5` —la que declara al
addon huérfano— o `A6` la llevan a un estado terminal (`B/03` §8) — una llamada que puede fallar,
y **mutar o cancelar no emite webhook**
(`EX-15`), así que no hay ninguna otra vía de aviso. Es exactamente el detector que `B/16` §4.3
declara —*«un addon en estado terminal con su preapproval vivo es una discrepancia que el barrido
ve»*—, y sin esta salvedad el addon salía del barrido **en el mismo acto** en que pasaba a ser
detectable: la exención de arriba lo apagaba. El costo está acotado por su propia condición de
corte —deja de barrerse apenas la relectura confirma la cancelación—, así que no es la cartera
terminal entera sino la cola de las que todavía no confirmaron.

**Y hay una comprobación que no le pregunta nada al proveedor: la sucesión abierta sobre una fila
muerta.** Si una fila que el barrido alcanza tiene `sucede_a` **no nulo** y la predecesora a la
que apunta **ya no es fila viva** (`NUCLEO/01` §2.4), la sucesión debería estar cerrada y no lo
está: `S18` no corrió. Se pone la **marca**. Cuesta cero llamadas —las dos filas están en nuestra
base— y vigila el único estado que deja el candado `A` **vacío**, que es el que permite que un
alta nueva entre sin que nada la rechace y queden dos preapprovals cobrando. La rama legítima de
ese estado —la cancelación de `S17` que falló sobre un preapproval vivo— **ya trae la marca
puesta**, así que esto no la duplica: lo que encuentra es la que llegó ahí **sin** marca, o sea
por un camino que `G-R1-C` no alcanzó a impedir.

> **Con una excepción, y sin ella la comprobación da falso positivo en un camino normal.** `S18`
> exige la sucesora **`ACTIVE`**, y la tabla de `B/03` §3.2 enumera **tres** transiciones por las
> que la predecesora deja de ser fila viva **antes** de que eso pase —`S12`, `S13` y `S16`—, con la
> sucesora todavía en `PENDING_AUTHORIZATION` y dentro de su ventana. Ahí `S18` **no es que no
> corrió: todavía no puede correr**, y marcar es acusar de incidente al cliente que está por
> terminar su checkout. **La comprobación no alcanza a la sucesora que sigue siendo fila viva en
> `PENDING_AUTHORIZATION` con su ventana abierta**; cuando la ventana vence, `S3` la mata y la fila
> sale del barrido por su propio estado terminal.
>
> Esto **no** abre el agujero que la comprobación vigila: mientras la sucesora no autorizó no hay
> dos autorizaciones que puedan cobrar, que es la condición del candado `A`. Lo escribió la
> **FASE 9-bis-2**, y el defecto lo introdujo su propia familia de la sucesión al hacer de `S18`
> una transición aparte.

**Y una segunda que tampoco le pregunta nada al proveedor: el pago pendiente por `S19` cuya
sucesión ya terminó.** Si una fila tiene un pago acreditado **pendiente de resolución**
(`B/03` §3.2, `S19`) y ya **no** es la predecesora de una sucesión en curso —la sucesora murió, o
la sucesión se cerró—, su destino estaba determinado y nadie lo ejecutó: se resuelve por la rama
que le corresponda de las cuatro de `B/12` §5.3, y si la rama no es determinable, se pone la
**marca**. Cuesta cero llamadas y cubre el único estado que el arreglo de `S19` puede dejar
colgado: **un pago retenido para siempre**, que del lado del cliente se lee como un cobro sin
servicio y sin devolución. Hace falta porque el reloj del grace **no corre** mientras ese pago
esté pendiente (`S6`): sin esta comprobación no hay nada que lo destrabe solo.

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
