# 02 · Núcleo — outbox y notificaciones

Parte del núcleo de la spec consolidada: el mecanismo de entrega de correos, la deduplicación, el
huso horario, la supresión, lo que el proveedor manda por su cuenta y el catálogo de correos. Es el
texto vigente del capítulo 07 del núcleo, sin tachados; lo construye [U2](10-corte/U2.md#pieza-u2)
(§1.4). Las acciones administrativas que este texto nombra son los ítems `ACC:n` de
[`02-nucleo.md`](02-nucleo.md#acc-1); los plazos, los `PLAZO:n` del mismo archivo.

El §42 del PDR pone los schedules en la base, el §43 garantiza que un fallo de correo no afecta al
dominio, y el §44 exige que el intento quede registrado. Los cuatro huecos que este capítulo cierra
(`M-MAIL-01` a `M-MAIL-04`) son las cuatro cosas que esos tres párrafos dan por resueltas y no lo
están: **cuándo** se manda, **una sola vez**, **a quién sí y a quién no**, y **qué manda el
proveedor por su cuenta**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:17, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:19, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:22

## 1. El outbox

El §44 fija los estados: `pending`, `processing`, `sent`, `failed`, `retry`, más el id del
proveedor y los intentos. Esta spec agrega lo que el §44 no dice.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:28, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:30

### 1.1 El correo se encola dentro de la transacción de dominio, y se manda afuera

La transición escribe su estado **y** la fila de outbox en la misma transacción. Lo que queda
afuera es el **envío**, que lo hace un proceso aparte leyendo la cola.

Es lo que hace cierto al §43 —*«Si falla mail: acción de dominio permanece»*— sin perder el
aviso: si el envío se cae, la fila sigue en `pending` y se reintenta. Encolar dentro y mandar
afuera es la única combinación que no pierde ninguno de los dos.

**Y la fila guarda la dirección del destinatario al encolarse** (verificación corta, 2026-09-29,
lote N-F): el envío manda a esa dirección, no a la que la cuenta tenga cuando sale. Es lo que hace
que un correo encolado antes de que la acción 24 ([ACC:24](02-nucleo.md#acc-24)) dé de baja la
cuenta llegue a la dirección real y no al seudónimo que la baja escribe: soporte borra las dos
fichas de Juan con la 23 ([ACC:23](02-nucleo.md#acc-23)) y un minuto después da de baja la
cuenta, y los dos correos de confirmación de [PB12](04-catalogos.md#trans-v-pb12) salen igual
(§4.2).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:33, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:35, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:38, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:42

### 1.2 `processing` necesita dueño y vencimiento

Un estado `processing` sin nada más es una fila que se queda trabada para siempre cuando el
proceso que la tomó muere. Lleva **quién la tomó** y **hasta cuándo**; vencido ese plazo,
vuelve a `pending`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:49, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:51

### 1.3 Un `failed` definitivo que era obligatorio se escala

El §43 dice que el dominio no se frena, no que nadie se entere. Si un correo **transaccional no
suprimible** (§4) agota sus reintentos, eso es un evento que mira una persona, porque el cliente
no recibió algo que teníamos la obligación de mandarle.

**Y si ese correo era el que precede a una cancelación, el `failed` no la traba** (owner
2026-09-25; FASE 9 completa, decisión 1): se cancela igual y se escala como no-entregable, igual
que sin destinatario (§5.3, regla 2). El `failed` definitivo es, por definición de este outbox, una
falla que no pasó, y esperarla dejaba [S17](04-catalogos.md#trans-b-s17) y
[S6](04-catalogos.md#trans-b-s6) sin ocurrir nunca: cobraban las dos suscripciones, o el moroso
conservaba el servicio sin límite.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:55, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:57, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:61

### 1.4 Quién lo construye: `U2`, el outbox común

(FASE 5, owner 2026-09-30, lote 2 A.) **Lo construye [U2](10-corte/U2.md#pieza-u2)**, una unidad
del paraguas como [U1](10-corte/U1.md#pieza-u1): depende de `U1` y va antes de las primeras
unidades que encolan, [V4](10-corte/V4.md#pieza-v4) y [B3](10-corte/B3.md#pieza-b3) —que encolan
antes los avisos del trial, el correo del alta y el de antes de cancelar— y, por transitividad,
[V6](10-corte/V6.md#pieza-v6), `V9a`, [V9b](20-fase-1/V9b.md#pieza-v9b), [B4](10-corte/B4.md#pieza-b4),
`B5`, `B7`, [B12](20-fase-3/B12.md#pieza-b12) y las demás que encolan (corte del MVP, owner
2026-10-02, [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br): las flechas `U2 → V4` y
`U2 → B3`). Se construye **sobre el precedente del newsletter**, que es
el único outbox que hay hoy en el repositorio, y trae tres cosas más:

1. **La supresión del §4**, entera: rebote duro, cuenta borrada, opt-out y tope diario.
2. **La bitácora de correos**, que `U1` renombra desde `billing_notification_log` a un nombre
   neutro, sin la columna ni la FK de cliente del cobro y con su índice propio fuera del extra
   `004` (FASE 5, owner 2026-09-30, lote 1 B). Hoy registra cada correo de la plataforma, sea del
   tipo que sea, después de mandarlo y fuera de toda transacción. `U2` la absorbe: desde `U2` el
   registro del intento del §44 es uno solo.
3. **Lo que los jobs necesitan para cumplir el §3 y el §2 de la auditoría**
   ([`02-nucleo-auditoria.md`](02-nucleo-auditoria.md), §2): el huso del mercado, el id de corrida
   y la correlación de punta a punta (FASE 5, owner 2026-09-30, lote 2 B). El reloj que leen no es
   de `U2`: sigue siendo la interfaz que construye [B1](10-corte/B1.md#pieza-b1)
   (`12-contrato…` §7.1, punto 5).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:67, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:69, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:70, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:74, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:75, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:80

## 2. Que se mande una sola vez · cierra `M-MAIL-02`

El §44 garantiza que el intento quede **registrado**. No garantiza que sea **único**, y no es lo
mismo: un job que corre dos veces, un reintento, o dos instancias en paralelo mandan dos correos
con el §44 perfectamente cumplido.

**La clave de deduplicación, y es una columna con restricción de unicidad:**

```text
(destinatario, plantilla, ocurrencia)
```

Donde **ocurrencia** es lo que identifica *este* envío y no otro de la misma plantilla:

| tipo de correo | qué es la ocurrencia |
|---|---|
| de **schedule** (avisos previos, campaña, recordatorios de renovación, retención) | el sujeto, el hito **y la fecha objetivo vigente de ese hito**: `trial:<id>:pre:-2d:2026-10-04`, `sub:<id>:renov:-5d:2026-11-01`, `listing:<id>:ret:-180d:2027-01-12` |
| de **evento** (cobro fallido, cancelación, aumento aplicado) | el id del evento de dominio que lo causó |

**La clave se calcula antes de encolar, no antes de enviar.** Si se calculara al enviar, dos
procesos ya habrían encolado dos filas y la restricción llegaría tarde.

**Y el reloj del JOB no entra en la clave, que es otra cosa que la fecha objetivo.** Un aviso de
«faltan 2 días» tiene una sola ocurrencia **por fecha de vencimiento**, aunque el job corra cada
hora: si la fecha **del cálculo** entrara en la clave, correrlo dos veces el mismo día seguiría
mandando dos. Lo que entra es **a qué día apunta el aviso**, no **cuándo se lo evaluó**.

**La fecha objetivo va en la ocurrencia SIEMPRE, y no como excepción de un sujeto.** Es la regla
entera y no tiene lista: **todo hito de schedule cuelga de una fecha, y toda fecha de la que
cuelga un hito se puede mover**. El trial se extiende por [T4](04-catalogos.md#trans-v-t4)
(cap. 03), la renovación llega una vez por ciclo, y el reloj de retención se reinicia por
cualquiera de los **cinco hechos** del §1.2 del cap. 01 del núcleo, el 1, el 2, el 3, el 5 y el 6
(el quinto, FASE 8 completa, `F-8CA2-001`, owner 2026-09-25; el sexto, FASE 9 completa, decisión
5b; el 4 salió con la revisión del owner, 2026-09-28, C8: FASE 9 vuelta 3, F-8V3A2-007). Una
ocurrencia sin fecha es única sólo mientras su hito ocurra **una vez en la vida del sujeto**, y
ningún hito del catálogo del §6 cumple eso.

> ⚠️ **Escrito como excepción por sujeto, esto ya falló una vez, y falló en silencio.** Una
> versión anterior nombraba **un** sujeto —el trial— y **una** transición —`T4`—, y la retención
> no aparecía. Cuando [DEC-DATA-002](01-decisiones-vigentes.md#dec-data-002) volvió reiniciable el
> reloj de retención, sus **tres** avisos (§6) pasaron a corresponder de nuevo en cada ciclo y la
> clave sin fecha los suprimía como duplicados: el segundo día 180 borraba el contenido publicable
> de la ficha **sin avisar y sin abrir la ventana de exportación**, que es con lo que `V/02` §4.2
> regla 3 defiende ese borrado. Y no se veía: la clave **se calcula antes de encolar**, así que la
> fila no llegaba a la cola, no quedaba `failed` y no escalaba por el §1.3. **Una regla con lista
> de sujetos envejece cada vez que aparece un sujeto nuevo; ésta no tiene lista.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:86, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:88, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:92, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:98, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:102, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:105, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:108, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:113, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:117, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:120

## 3. El huso horario es un invariante · cierra `M-MAIL-01`

El §10.7 y el §42 definen todas sus ventanas en días: *«10 días antes»*, *«-1 día»*, *«+60
días»*. **Un cálculo hecho en otro huso manda el correo el día equivocado**, y una ventana de
«últimos N días» cuenta mal.

**El invariante**: toda ventana expresada en días se computa en el huso del mercado
—`America/Argentina/Buenos_Aires`—, y **el instante se guarda siempre en UTC**. El PDR fija el
mercado sin ambigüedad: el §29 nombra la normativa argentina y el §6 su terminología.

Tres consecuencias operativas:

1. **«Tres días antes» significa un día del calendario, no 72 horas.** El límite del día es
   medianoche del huso del mercado.
2. **Un proceso que corre en UTC tiene que convertir**, y eso incluye a los jobs: el error no se
   ve en un servidor en UTC y sí se ve en la máquina de quien desarrolla, o al revés. **Lo lleva a
   la infraestructura de jobs [U2](10-corte/U2.md#pieza-u2)** (§1.4; FASE 5, owner 2026-09-30,
   lote 2 B): hoy el programador de jobs no fija ningún huso.
3. **Se cruza con la cuota mensual de [DEC-ENT-002](01-decisiones-vigentes.md#dec-ent-002)**: el
   momento del reset es una ventana temporal y se computa igual, en el huso del mercado. **Y el día
   del reset es el del ciclo de cada persona**, no el primero del mes (revisión del owner,
   2026-09-28, C4; `V/15` §7): el día del `desde` del título, leído en este huso, con los meses
   cortos cerrando el último día.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:132, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:134, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:138, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:142, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:144, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:146, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:150

## 4. Transaccional o comercial, y quién suprime a quién · cierra `M-MAIL-03`

El §42 y el §43 no dicen nada sobre supresión: ni opt-out, ni rebote duro, ni cuenta borrada, ni
tope diario. Y falta la distinción que ordena todo lo demás.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:157, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:159

### 4.1 Las dos clases

| clase | cuáles | se suprimen |
|---|---|---|
| **Transaccional, no suprimible** | aviso de aumento (§29), fallo de cobro y avisos del grace (§20, §42.3), vencimiento de trial (§10.7 pre), los **tres** de la retención —los dos previos de [DEC-DATA-001](01-decisiones-vigentes.md#dec-data-001) y el del archivado, §6—, confirmación de una operación que el cliente pidió, y el aviso que **precede** a una cancelación ([DEC-MAIL-001](01-decisiones-vigentes.md#dec-mail-001)), **y el de suspensión por contracargo** (§6; FASE 8 completa, pendiente 6, owner 2026-09-25), **y los dos de la disputa resuelta** (§6; FASE 8 completa, pendiente 8, owner 2026-09-25), **y los tres de una migración de un plan retirado** (§6; revisión del owner, 2026-09-28, C15), que son un aviso de aumento o de baja que el cliente no eligió | **no**, salvo por §4.2 |
| **Comercial, suprimible** | la campaña de recuperación post-trial del §10.7 (+1, +5, +15, +30, +60) | **sí** |

**Mezclarlas es a la vez un problema legal y de reputación del dominio de envío**, y si se
suprimen las dos juntas se dejan de mandar avisos obligatorios. Los avisos de retención son el
ejemplo exacto: si cayeran bajo el opt-out comercial, se dejaría de avisar justo a quien está
por perder su contenido. **Y el del archivado es el que menos se puede suprimir de los tres**,
porque su destinatario puede ser alguien que está **al día y pausado** (§6) y que no tiene
ninguna otra forma de enterarse de que su ficha cambió de estado.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:162, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:166, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:167, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:169

### 4.2 La jerarquía de supresión, en orden

| # | causa | suprime | por qué |
|---|---|---|---|
| 1 | **rebote duro** | **todo**, incluso lo transaccional | la dirección no existe: no hay a quién mandarle |
| 2 | **cuenta borrada** | todo **lo que se encola después de la baja**: lo encolado antes sale a la dirección que guardó su fila (§1.1). Una cuenta dada de baja por la acción 24 ([ACC:24](02-nucleo.md#acc-24)) es una cuenta borrada para esta fila (verificación corta, 2026-09-29, lote N-F) | ídem |
| 3 | **opt-out** | sólo lo comercial | es una preferencia sobre marketing, no sobre la relación contractual |
| 4 | **tope diario** | sólo lo comercial | protege la reputación del dominio sin tocar obligaciones |

**Un rebote duro sobre un correo obligatorio no es un no-envío: es un evento.** Se registra como
no entregable y se escala (§1.3), porque el cliente no recibió algo que teníamos que mandarle y
alguien tiene que poder llegar por otra vía.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:176, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:180, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:181, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:185

### 4.3 El tope diario cuenta por destinatario, no global

Un tope global convierte un pico de actividad en correos perdidos para gente que no tuvo nada que
ver. Por destinatario, el que recibe mucho es el que se frena.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:189, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:191

## 5. Lo que el proveedor manda por su cuenta · cierra `M-MAIL-04`

Está medido sobre la casilla real del owner: **43 correos del proveedor en un día**. Le escribe
al cliente **por su cuenta y siempre primero** en cuatro momentos: **alta**, **cambio de monto**,
**pausa** y **cancelación** ([EX-3](04-catalogos.md#mp-ex-3)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:196, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:198

### 5.1 Tres de esos correos afirman cosas que sus propios datos desmienten

| lo que dice | lo que pasó |
|---|---|
| *«Pagaste la suscripción»*, en el alta | el correo sale ~18 s después de autorizar y **el cobro llega ~26 min más tarde**; en dos sujetos medidos **no llegó nunca** |
| *«Cobramos $15 para validar tu tarjeta»* | el cargo registrado es de **$0** |
| el rechazo `2084`, *«no se puede reembolsar»* | sí se puede: sobre el mismo pago, ARS 5 se rechazó y ARS 14 entró |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:202, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:206, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:207, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:208

### 5.2 Y dos son ambiguos de una forma que nos cuesta plata

- **`paused` y `cancelled` llegan idénticos**: los dos dicen *«por un pago no realizado o por
  opción del vendedor»*. Una **cortesía** y una **mora** son indistinguibles para el cliente.
- **Los cuatro lo mandan a nuestra puerta** (*«contactá con el vendedor»*): **no hay
  autogestión**, todo cae en nuestro soporte. Hay que dimensionarlo así, no como excepción.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:210, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:212, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:214

### 5.3 Las tres reglas, ya decididas

1. **Los correos falsos se ANTICIPAN, no se desmienten**
   ([DEC-MAIL-001](01-decisiones-vigentes.md#dec-mail-001)). Desmentir es una pelea que se pierde:
   el suyo llega primero y con su marca. El nuestro de alta avisa que va a llegar uno diciendo que
   ya pagó, y da la fecha del primer cobro real.
2. **Nuestro correo bloquea la acción sólo antes de cancelar.** Es la excepción declarada al
   §64.25 ([INV:25](02-nucleo.md#inv-25)), acotada al único punto donde el correo del proveedor
   hace daño. Y **sale gratis**: la cancelación de la vieja ocurre cuando llega el webhook de que
   la nueva quedó autorizada, que es un momento que controlamos; si el correo falla, no se cancela
   y se reintenta, y el estado intermedio no es destructivo porque las dos conviven
   ([EX-6](04-catalogos.md#mp-ex-6)). **Salvo que no haya a quién mandarlo**: con rebote duro o
   cuenta borrada (§4.2) el reintento no tiene salida y dejaba a las dos cobrando, así que ahí se
   cancela igual y el no-entregable se escala (FASE 8 completa, `F-8CB2-001`, owner 2026-09-25).
   **Y salvo que el correo haya agotado sus reintentos** (`failed` definitivo, §1.3): tampoco tiene
   salida —*«el reintento supone una falla que pasa»*, y ésta no pasó—, así que se cancela igual y
   se escala como no-entregable, con la misma forma que la de arriba (owner 2026-09-25; FASE 9
   completa, decisión 1, que precisa `DEC-MAIL-001`). El bloqueo vale para **toda** cancelación que
   ejecutamos en el proveedor, y cada fila de `B/03` que cancela lo lleva escrito.
3. **Nuestra comunicación desambigua lo que el proveedor dejó ambiguo**: si pausamos por
   cortesía, se dice; si es por mora, se dice.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:217, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:219, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:222, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:229, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:234

### 5.4 El `reason` es copy, no un identificador

Está medido que **el `reason` es el texto que el cliente ve** en el asunto y el encabezado del
correo del proveedor, y que **se puede reescribir** sobre una suscripción viva
([EX-3](04-catalogos.md#mp-ex-3), [EX-19](04-catalogos.md#mp-ex-19)).

**Nunca lleva un slug interno ni un id.** Es un invariante ([INV:D9](02-nucleo.md#inv-d9)) y se
vigila con un guard, porque es el tipo de campo que alguien completa con lo que tiene a mano.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:237, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:239, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:242

## 6. El catálogo de correos

Todos los schedules salen de la base (§42). Los valores de abajo son **defaults**, no constantes.
**Y son plazos de la lista cerrada de `NUCLEO/02` §1.5** (los `PLAZO:n` de
[`02-nucleo.md`](02-nucleo.md#plazo-1); revisión del owner, 2026-09-28, C9): los cambia el
`SUPER_ADMIN` con *«cambiar un plazo»* ([ACC:22](02-nucleo.md#acc-22)), el panel rechaza un aviso
que no salga antes del hecho que anuncia, y cada reloj guarda la versión con la que arrancó, así
que un cambio no adelanta un aviso de un reloj ya arrancado.

| momento | clase | schedule default | de dónde sale |
|---|---|---|---|
| trial por vencer | transaccional | 10, 5, 2 y 0 días antes. (La salvedad para una vertical que no admite altas salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan.) | §10.7 |
| trial vencido — recuperación | **comercial** | +1, +5, +15, +30, +60 días, y **termina ahí**. (La condición de que la vertical admitiera altas salió con la revisión del owner, 2026-09-28, C8.) | §10.7 |
| renovación por venir | transaccional | 5 y 1 día antes. **El hito cuelga de la fecha del próximo cobro** (cap. 02 §2.2, épica de billing) y **esa fecha se mueve** —el proveedor la corre en los casos de [PS-6](04-catalogos.md#mp-ps-6), y sobre un pagador manual la mueven el pago registrado, la vuelta de una pausa y el tope de una reapertura tardía (cap. 03 §7.2)—, así que la ocurrencia la lleva, como todo schedule (§2) | §42.2 |
| cobro fallido / grace | transaccional | configurable dentro de la ventana, **relativo al vencimiento**. **Si la fila entró al grace con un cambio de plan en curso** —la predecesora que llega al grace durante la ventana, por [S4](04-catalogos.md#trans-b-s4)—, **cada uno lleva además una línea que dice que el cambio de plan sigue pendiente** (FASE 8 completa, owner 2026-09-25). **Y dicen que al cambiar la tarjeta se reintenta el cobro en el momento**: [GR-1](04-catalogos.md#mp-gr-1) quedó `VERIFIED` el 2026-09-26 (sonda 49: el mismo registro cobró con el medio nuevo ≈1-2 min después del cambio; una muestra); si ese cobro no entra antes del fin del grace, el correo dice que va a tener que volver a suscribirse | §42.3, [DEC-SUB-002](01-decisiones-vigentes.md#dec-sub-002) |
| **suspendido por contracargo** | transaccional, **no suprimible** | **al suspender por un contracargo** (`S6` por su tercer evento, cap. 03 §3.2, épica de billing) — **y también al cortar por un contracargo una fila en `CANCEL_SCHEDULED`** ([S12](04-catalogos.md#trans-b-s12) por su segundo evento): es el mismo correo (orquestador, FASE 8 completa, pendiente 8, derivado de [DEC-SUB-020](01-decisiones-vigentes.md#dec-sub-020)). **Es un correo propio y no el de mora**: el cobro entró y la persona lo desconoció ante su banco, así que el de mora le diría que no pagó. **Texto base, del owner**: *«Desconociste el cargo de $X del día Y en tu banco. Mientras se resuelve, suspendimos el servicio. Si fue un error, podés volver a suscribirte desde acá.»* | `DEC-SUB-020` (su 📌, [DEC-SUB-020#📌1](01-decisiones-vigentes.md#dec-sub-020-p1)), cap. 19 §4 fila 10-ter (épica de billing); FASE 8 completa, pendiente 6, owner 2026-09-25 |
| **la disputa se resolvió a favor de la persona** | transaccional | **al leer `settled`** sobre un pago en `CHARGED_BACK` (cap. 03 §6, épica de billing): la disputa se perdió para nosotros y el pago queda en `CHARGED_BACK`. **Texto base, del owner**: *«La disputa se resolvió a tu favor; tu suscripción sigue **suspendida**; podés volver cuando quieras.»* cuando la fila está `SUSPENDED`, y *«sigue cancelada»* cuando está `CANCELLED` (FASE 8 completa, owner 2026-09-25). **Lo lee el barrido**, que relee los pagos en `CHARGED_BACK` hasta que su `status_detail` se resuelva (cap. 09 §3, épica de billing; FASE 8 completa, owner 2026-09-25) | FASE 8 completa, pendiente 8, owner 2026-09-25; cap. 19 §4 fila 10-ter (épica de billing) |
| **la disputa se resolvió a nuestro favor** | transaccional | **al correr [P7](04-catalogos.md#trans-b-p7)** —se leyó `reimbursed`— (cap. 03 §6, épica de billing): el cargo era correcto y el cobro vuelve a valer. **Texto base, del owner**: *«La disputa se resolvió; el cargo era correcto; podés volver a suscribirte desde acá.»* | FASE 8 completa, pendiente 8, owner 2026-09-25; `DEC-SUB-020`; cap. 19 §4 fila 10-ter (épica de billing) |
| aumento de precio | transaccional | **3 contactos**: al anunciar, a 30 días y a 7 días, cada uno con **la fecha de ese cliente**; **por correo, nunca sólo por una notificación dentro del producto**, que no deja constancia de haber llegado (`B/22` §1.3, `.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:74`) | [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002) |
| **migración de un plan retirado** | transaccional, **no suprimible** | **3 contactos**: al anunciar, **30 días y 7 días antes de la fecha de renovación de ese cliente** (revisión del owner, casos vecinos, 2026-09-29, caso 21) (la de su renovación, que en un anual puede estar a diez meses); el tercero sale **antes** de que [S37](04-catalogos.md#trans-b-s37) mute el monto (cap. 03 §3.2, épica de billing), como el aviso que precede a una cancelación. Cada uno con qué cambia, el precio actual y el nuevo, la fecha y si pierde su promo; **y el tercero dice, en general, que Mercado Pago también le va a mandar un aviso del cambio de monto**, sin citar su texto, que no se mide ([EX-54](04-catalogos.md#mp-ex-54); mediciones del 2026-09-29, M-5). **Los de 30 y 7 días salen sólo si la fila de alcance del cliente sigue `PENDIENTE`** (cap. 02 §2.2, épica de billing): una que salió a `FUERA`, también por *«terminó»*, no los recibe (verificación corta, 2026-09-29, lote M-A). **Un cliente en `PARA_RESOLVER`**, que no tiene su ciclo en el destino, **recibe sólo el del anuncio, con un texto propio: que lo van a contactar**, sin fecha ni precio nuevo (`B/10` §3.7 punto 5; verificación corta, 2026-09-29, lote N-E) | revisión del owner, 2026-09-28, C15; `B/10` §3.7, épica de billing |
| **la migración se canceló** | transaccional | **al cancelar el `SUPER_ADMIN` una migración anunciada** ([ACC:17](02-nucleo.md#acc-17)), a cada cliente que todavía no se aplicó **(su fila de alcance en `PENDIENTE`; una `FUERA` no lo recibe: verificación corta, 2026-09-29, lote M-A; ni una `PARA_RESOLVER`, que sólo recibe el anuncio: lote N-E)**: ***«ya no cambia nada»***; **y a cada uno ya aplicado cuya fecha de aplicación no llegó** (está dentro de sus siete días, con el monto mutado), el mismo correo con otro texto: **la cancelación no lo alcanza, porque su cambio ya empezó**, con su precio nuevo y su fecha (revisión del owner, casos vecinos, 2026-09-29, caso 25) | revisión del owner, 2026-09-28, `L1-h` |
| **tu promo termina** | transaccional | **antes del último cobro con descuento** de una promo de «primer cobro» o de «N cobros» —el cobro con el que su contador llega a 0 (`promo_redemption.cobros_restantes`, cap. 02 §2.4, épica de billing)—. Dice *«tu promo termina; desde el mes que viene pagás $X»*, con **$X el monto sin esa promo, recalculado con las que siguen vivas** (cap. 14 §2.4, épica de billing). **Anticipa el correo del proveedor** que avisa el cambio de monto ([CT-3](04-catalogos.md#mp-ct-3); §5.3 regla 1, `DEC-MAIL-001` punto 2). Una promo `forever` no termina, así que no lo recibe. **7 días antes, configurable**, como todo schedule de este catálogo; **en una promo de «primer cobro» no sale aparte: se unifica con el aviso del canje** (cap. 19 §4 fila 7-bis, épica de billing), porque ahí el último cobro con descuento es el primero (FASE 8 completa, pendiente 8, owner 2026-09-25) | FASE 8 completa, pendiente 7, owner 2026-09-25; cap. 03 §3.2 ([S30](04-catalogos.md#trans-b-s30)) y cap. 19 §4 fila 7-bis (épica de billing) |
| antes de cancelar | transaccional | **bloquea la acción** si falla de forma transitoria; **si no hay destinatario** (rebote duro o cuenta borrada, §4.2) **o si agotó sus reintentos** (`failed` definitivo, §1.3) **no bloquea**: se cancela y el no-entregable se escala | `DEC-MAIL-001` (precisada el 2026-09-25; el `failed`, owner 2026-09-25, FASE 9 completa, decisión 1) |
| excedente por downgrade | transaccional | al pedirlo, **con el criterio escrito**: se despublican las publicadas más recientemente; **y los destaques recurrentes de las fichas que baja, que se siguen cobrando** hasta que los dé de baja (FASE 9 vuelta 1; owner 2026-09-26, `G2-3`) | [DEC-SUB-008](01-decisiones-vigentes.md#dec-sub-008), [DEC-ADDON-001](01-decisiones-vigentes.md#dec-addon-001) |
| reanudación tras pausa | transaccional | al reanudar. **Dice una sola cosa: qué día se le cobra** | [DEC-SUB-010](01-decisiones-vigentes.md#dec-sub-010) |
| pausa por cortesía | transaccional | al otorgarla y al vencer; desambigua el correo del proveedor | [DEC-GRANT-003](01-decisiones-vigentes.md#dec-grant-003) |
| pierde la cortesía al pausar | transaccional | antes de confirmar, y **el cliente elige** | [DEC-GRANT-004](01-decisiones-vigentes.md#dec-grant-004) |
| **restitución tras recuperar cupo** | transaccional | al republicar solas ([PB3](04-catalogos.md#trans-v-pb3), [PB7](04-catalogos.md#trans-v-pb7)), **con el criterio escrito**: vuelve primero la que cayó al final. Dice cuáles volvieron, cuáles no y que las que no entraron no se borran | [DEC-DATA-003](01-decisiones-vigentes.md#dec-data-003), `V/03` §9, `V/15` §4.3 |
| retención | transaccional | antes del día 90, **al archivar** y antes del día 180 (los plazos 1, 2 y 4, [PLAZO:1](02-nucleo.md#plazo-1), [PLAZO:2](02-nucleo.md#plazo-2) y [PLAZO:4](02-nucleo.md#plazo-4), con sus valores iniciales; el previo al borrado cuenta sobre la fecha que anunció el archivado, `V/02` §2.5: revisión del owner, 2026-09-28, C9 y N7), **los dos previos contados desde el más tardío de dos instantes, `listing.inactiva_desde` (`V/02` §2.5) y el `pausaTerminadaEn` que devuelve `retenciónDetenida` (`12-contrato…` §4.1), con la versión de plazos que guarda la ficha (`listing.plazos_version`), y el previo al borrado nunca antes de la fecha que anunció el archivado: apuntan al día en que actuaría su lector (el archivado de [PB4](04-catalogos.md#trans-v-pb4) o [PB5](04-catalogos.md#trans-v-pb5), o el borrado de [PB9](04-catalogos.md#trans-v-pb9), `V/03` §9), y la fecha objetivo de su ocurrencia (§2) sale de esa cuenta; el del medio sale con el acto de archivar** (verificación corta, 2026-09-29, lote M-H) — un reloj **reiniciable**, así que los tres pueden corresponder más de una vez sobre la misma ficha y su ocurrencia lleva la fecha objetivo, como todo schedule (§2). **Los dos previos releen la cobertura del `user + vertical` antes de salir, y no salen si está cubierto** (FASE 8 completa, `F-8CA2-015`, owner 2026-09-25): sobre una ficha publicada y cubierta `inactiva_desde` puede tener hasta 90 días, y sin relectura a un cliente al día le llegaba *«tu ficha se va a archivar»* cada ~90 días, por un archivado —o un borrado— que la relectura de `PB4` o de `PB9` no iba a dejar ocurrir. **No escriben el reloj**: no salir no es reiniciarlo. **Y releen además el estado de la ficha y la pausa** (revisión del owner, 2026-09-28, N7, C14): no salen sobre una ficha `MODERATED` ni `PURGED`, ni mientras la pregunta `retenciónDetenida` del contrato (`12-contrato…` §4.1) conteste `sí`, porque anunciarían un archivado o un borrado que `PB4`, `PB5` y `PB9` no van a ejecutar. El del archivado no necesita la relectura: sale con el acto, y el acto ya no ocurre en esos casos. **El del medio —*«al archivar»*— vale para `PB4` y para `PB5`, y nombra los destaques recurrentes sobre esa ficha, que se siguen cobrando aunque esté archivada** (`V/19` §4 fila 18; FASE 9 vuelta 1, R3 caso `m`, owner 2026-09-26, `G2-3`) | [DEC-DATA-001](01-decisiones-vigentes.md#dec-data-001); el del medio, `F-8cC1-001`; la relectura de los previos, `F-8CA2-015` |
| **ficha moderada** | transaccional | **al moderar** ([PB10](04-catalogos.md#trans-v-pb10), `V/03` §9). **Existe porque el dueño no está mirando**: la modera un admin, así que la fila 24 de `V/19` §4 no tiene pantalla que la muestre en el instante del acto. Dice el motivo; que la ficha no se ve hasta que un admin levante la moderación; **qué puede hacer mientras tanto: verla, exportarla, editarla para arreglar lo que se le pide y borrarla, no publicarla** (revisión del owner, 2026-09-28, `g3`); y **los destaques recurrentes sobre esa ficha, que se siguen cobrando hasta que los dé de baja**, con el camino para darlos de baja (FASE 9 vuelta 1, §4 punto 4 de `22-verificado-G2`: `G2-3` se apoya en que el acto se lo dice, y este catálogo no tenía ninguna fila de moderación) | `V/19` §4 fila 24, `V/03` §9 (`PB10`), `DEC-ADDON-001`; owner 2026-09-26, `G2-3` |
| **pedido de arreglo** | transaccional | **al abrirlo** (revisión del owner, 2026-09-28, C10): un admin le pide al dueño que arregle algo **sin bajar la ficha**, que sigue publicada. Dice el motivo, la fecha sugerida si la hay, que la ficha sigue a la vista y cómo avisar que ya lo corrigió | `V/03` §9 (*«la moderación en dos niveles»*), [ACC:12](02-nucleo.md#acc-12) |
| **cambio de nivel de la moderación** | transaccional | **cuando el admin cambia su elección** (revisión del owner, 2026-09-28, C10, `L2-i`): de pedido de arreglo a baja (`PB10`: dice lo mismo que *«ficha moderada»*, y que el pedido sigue abierto) o de baja a sólo pedido de arreglo ([PB11](04-catalogos.md#trans-v-pb11) o [PB13](04-catalogos.md#trans-v-pb13): dice a dónde volvió la ficha, publicada si tenía cobertura y cupo o en borrador si era borrador, y que el pedido sigue abierto) | `V/03` §9 |
| **moderación levantada** | transaccional | **al levantar la baja o cerrar el pedido** (`PB11`, `PB13`, o el cierre del pedido de arreglo; revisión del owner, 2026-09-28, C10). **Salvo el cierre que hace la llegada de la ficha a `PURGED`, que no manda correo** (`V/02` §4.1: diría a dónde volvió una ficha borrada; FASE 9 vuelta 3, `F-8V3A2-004`). Dice a dónde volvió la ficha y, si volvió a borrador, que publicarla es suyo. **Cierra la mitad del ítem del §12 que decía que levantar no tenía aviso** | `V/03` §9 |
| **ficha borrada por su dueño** | transaccional | **al borrar cualquier ficha, desde cualquier estado de salida de [PB12](04-catalogos.md#trans-v-pb12)** (revisión del owner, 2026-09-28, `g3`, y casos vecinos, 2026-09-29, caso 15: sale en todo `PB12`, no sólo sobre una moderada): confirma que se borró, qué se borró y que no vuelve. **Cuando la borra soporte con la acción 23 ([ACC:23](02-nucleo.md#acc-23)), es el mismo correo con una línea más, que dice que se borró a pedido suyo**; no es una fila nueva del catálogo (revisión del owner, casos vecinos, 2026-09-29, caso H-G). **Sale aunque soporte dé de baja la cuenta enseguida**: la fila guarda la dirección al encolarse (§1.1; verificación corta, 2026-09-29, lote N-F) | `V/03` §9 (`PB12`) |
| **contenido de tu ficha editado por soporte** | transaccional | **al ejecutar la acción administrativa 15** ([ACC:15](02-nucleo.md#acc-15)). **Existe por la misma razón que el de la ficha moderada**: el acto lo hace un admin y el dueño no está mirando. Dice que soporte editó el contenido de su ficha, cuándo y qué partes, que no se publicó, no se destacó ni se borró por eso, y a quién responder si no lo pidió | `V/19` §4 fila 26, `NUCLEO/08` §3 fila 15; FASE 9 vuelta 2, `F-8V2D1-002` |
| **tu alerta de precio se cerró** | transaccional (confirmado por el owner: el turista pidió el servicio, y un opt-out del marketing no le puede esconder que la alerta dejó de vigilar; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-l`) | **cuando la ficha de la alerta llega a `PURGED`** (`PB9` o `PB12`, `V/03` §9), que la cierra (`V/02` §4.1). Dice que la alerta se cerró porque esa ficha ya no existe, y no por qué dejó de existir | `V/19` §4 fila 27, `V/02` §4.1; owner 2026-09-27, FASE 9 vuelta 2, `R9` |
| **cambio de plan con una cuota en reintento** | transaccional | **antes de confirmar el cambio**, mientras la predecesora siga viva. **Vale igual si la cuota se paga a mano** —transferencia registrada por [MP1](04-catalogos.md#trans-b-mp1) o por [MP4](04-catalogos.md#trans-b-mp4), cap. 03 §7 (épica de billing)—: es la segunda puerta del mismo pago, **y es la del pagador manual**: las dos puertas son una por método de pago. **Sobre un pagador con tarjeta ya `SUSPENDED` este aviso no corre**: `S6` canceló el preapproval al suspender y no hay cuota que pueda entrar ([DEC-SUB-019](01-decisiones-vigentes.md#dec-sub-019)). **Desde [DEC-SUB-021](01-decisiones-vigentes.md#dec-sub-021) (owner 2026-09-25) no tiene población al confirmar**: en el grace el cambio de plan no se ofrece, así que no se confirma ninguno con una cuota en reintento. La cuota puede aparecer **después**, si la predecesora entra en el grace durante la ventana (`S4`); **entonces recibe los correos normales del grace** —la fila *«cobro fallido / grace»*—, **más una línea que dice que el cambio de plan sigue pendiente** (FASE 8 completa, owner 2026-09-25; cap. 12 §5.3, épica de billing) | cap. 12 §5.3 (épica de billing) |
| **reapertura tras un pago manual tardío** | transaccional | al reabrir (`MP4`, cap. 03 §7.1, épica de billing). **Dice tres cosas y ninguna es opcional**: que el servicio volvió y desde cuándo; **qué pasó con la ficha** —vuelve sola si estaba archivada **y el cupo del plan le alcanza** (`PB7`), y si el hard delete ya corrió, **que el contenido no vuelve** —ni la ficha, que quedó en `PURGED` (`V/03` §9, `PB9`; FASE 8 completa, `F-8CA2-008`)—; y **qué período compró esta transferencia y cuándo vence la próxima cuota**, que el pago tardío acaba de decidir y no es siempre lo mismo: si la reapertura cayó dentro del período pagado, el pago cubre ese período y la próxima cuota vence el día en que termina; si el atraso fue más largo, el pago **se reimputa al período que arranca hoy** y la próxima cuota vence **dentro de un ciclo** (cap. 03 §7.2, *«al reabrir por `MP4`»*, épica de billing). **Y mueve la campaña que viene detrás**: *«renovación por venir»* cuelga de la fecha del próximo cobro, que esta reapertura acaba de correr, así que vuelve a corresponder contra la fecha nueva, y **no la suprime la clave**, porque la ocurrencia de un schedule lleva la fecha objetivo vigente (§2) | cap. 03 §7.1 y §7.2 (épica de billing), `V/02` §4.1 |
| **el alta que quedó sin completarse** | transaccional | **al llevarla a `ABANDONED`**, por **su único camino, [S3](04-catalogos.md#trans-b-s3)**, cuando venció su ventana (cap. 03 §3.2, épica de billing; [S28](90-retirados.md#trans-b-s28) salió con la revisión del owner, 2026-09-28, C8). **Dice que el alta no quedó hecha y que no se le cobró nada**, **cuándo venció su plazo** —la fecha **de esa persona**, nunca una cifra escrita a mano: son **dos** plazos según el método de pago ([DEC-SUB-016](01-decisiones-vigentes.md#dec-sub-016))— y **que puede volver a empezar**. **Y si tenía una cortesía diferida, que esos N meses se cerraron y no vuelven** (en meses desde `F-8CB1-001`; `B/19` §4 fila 18, `.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:137`; la fuente de este catálogo, `NUCLEO/07` §6, todavía dice «días») ([DEC-GRANT-011](01-decisiones-vigentes.md#dec-grant-011)), **con el número** | cap. 03 §3.2 (`S3`) y §3.4, cap. 19 §4 fila 18 (épica de billing), `DEC-SUB-016`, `DEC-GRANT-011`, [DEC-GRANT-012](01-decisiones-vigentes.md#dec-grant-012) |
| **el alta rechazada** | transaccional | **al rechazarse el primer cobro** ([S16](04-catalogos.md#trans-b-s16), cap. 03 §3.2, épica de billing). **Dice qué hacer según por qué la rechazaron**, con el mapa de `status_detail` de [DEC-MP-004](01-decisiones-vigentes.md#dec-mp-004): si fue el antifraude del proveedor, que la tarjeta está bien y que pruebe más tarde u otro dispositivo; si fue la tarjeta, que revise su medio de pago; y un texto genérico para lo que no esté en el mapa. **Desambigua el correo del proveedor**, que en el caso del antifraude dice *«por motivos de seguridad, tu pago fue rechazado»* sin decir que no hay nada que arreglar | `DEC-MP-004`, cap. 19 §4 fila 19 (épica de billing) |
| **reembolso de revocación fallido** | transaccional, **no suprimible**, a `SUPER_ADMIN` | **al producirse**: cuando el `refund` de una revocación llega a `FAILED` ([RF5](04-catalogos.md#trans-b-rf5), cap. 03 §6.1, épica de billing). Su texto lo propone el PR de [B11](10-corte/B11.md#pieza-b11) (BS) | `DEC-OBS-001` (la excepción del correo inmediato, [`02-nucleo-auditoria.md`](02-nucleo-auditoria.md) §4.1); lo construye `B11` (corte del MVP, owner 2026-10-02, [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br)) |
| **cobro duplicado detectado** | transaccional, **no suprimible**, a `SUPER_ADMIN` | **al producirse**: cuando se abre la marca con motivo `COBRO_DUPLICADO` (cap. 02 §2.5, motivo 20, épica de billing). Su texto lo propone el PR de [B11](10-corte/B11.md#pieza-b11) (BS) | `DEC-OBS-001` (la excepción del correo inmediato, [`02-nucleo-auditoria.md`](02-nucleo-auditoria.md) §4.1); lo construye `B11` (corte del MVP, owner 2026-10-02, [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br)) |

La fila de la pausa que provocaba el cierre de una vertical salió con la revisión del owner
(2026-09-28, C8): las verticales no se discontinúan, así que no hay pausa alcanzada por un cierre ni
`S25` que la termine; con ella salió el párrafo que la justificaba.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:247, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:249, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:255, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:257, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:258, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:259, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:260, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:261, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:262, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:263, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:264, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:265, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:266, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:267, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:268, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:269, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:270, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:271, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:272, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:273, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:274, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:275, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:276, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:277, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:278, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:279, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:280, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:281, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:282, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:283, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:284, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:285, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:286, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:287, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:288, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:307

**El del alta sin completar existe porque el hecho no lo produce la persona y ella no está
mirando.** La fila llega a `ABANDONED` por el job que recorre las vencidas (cap. 03 §3.4 punto 2,
épica de billing), o sea **sin ningún acto del cliente en el instante en que ocurre**: el mismo
motivo por el que existen el de *«reanudación tras pausa»* y el de la reapertura. Lleva la última
frase porque ese mismo instante **cierra el saldo de una cortesía diferida**
([DEC-GRANT-011](01-decisiones-vigentes.md#dec-grant-011)), y este correo es el único lugar donde
eso se le dice: sin él la persona se enteraría **por dejar de ver los meses** en «Mi Suscripción»
(en meses desde la FASE 8 completa, `F-8CB1-001`) (cap. 19 §3.1, épica de billing), que es
enterarse por una ausencia. **Y el plazo no se escribe en el texto**:
[DEC-SUB-016](01-decisiones-vigentes.md#dec-sub-016) le dio a esa ventana **dos** duraciones según
el método de pago, así que el correo lleva la **fecha** de vencimiento de esa persona: la regla 2
del §4 del cap. 19 aplicada acá.

**Los avisos de retención son tres y no dos, y el del medio es el que faltaba.** Los dos de
[DEC-DATA-001](01-decisiones-vigentes.md#dec-data-001) se escribieron para alguien que se fue: uno
le avisa que la ficha va a salir del sitio y el otro que el contenido se va a borrar. **El día 90
no avisaba nada**, y el que se archiva puede ser un cliente al día que no canceló nada (la pausa
del dueño ya no lo cruza, porque detiene el reloj: revisión del owner, 2026-09-28, C14; queda el
que perdió la cobertura por otra causa y vuelve). El aviso al archivar dice las tres cosas que ese
cliente necesita y ninguna estaba: **que no se borró nada**, **que vuelve sola cuando recupere la
cobertura —o cuando el cupo vuelva a alcanzar—** si hay lugar para ella
([PB7](04-catalogos.md#trans-v-pb7), [DEC-DATA-003](01-decisiones-vigentes.md#dec-data-003)) o a
mano cuando quiera y **sin pagar** ([PB8](04-catalogos.md#trans-v-pb8)), y **desde cuándo se
cuentan los 180**, que es `listing.inactiva_desde` (`V/02` §2.5) y no una fecha que la superficie
tenga que inventar.

**El de *«cambio de plan con una cuota en reintento»* no es un aviso más: es la condición bajo la
cual se aceptó la decisión.** Se decidió perdonar el período impago y **no cancelar la predecesora
antes de tiempo** —cancelarla contradice [INV:D7](02-nucleo.md#inv-d7), y si el cliente abandona
el checkout se queda sin nada—, así que su cuota sigue en `recycling` y **puede entrar**. Un cobro
que sorprende es un reclamo; uno anunciado es un trámite.

**Y tiene que decir las DOS ramas, no sólo que el cobro puede entrar.** El cap. 12 §5.3 (épica de
billing) decidió que ese cobro **no reactiva la suscripción vieja y queda pendiente hasta que la
sucesión se resuelva**, con dos desenlaces opuestos que dependen de lo único que está en manos del
cliente: **si termina el checkout, se le devuelve; si lo abandona, le queda** y le paga el período
que está usando. Un aviso que nombra el cobro y calla el destino de esa plata anuncia el hecho y
esconde la decisión, que es lo contrario de por qué este correo existe. El alcance espejo está en
cap. 19 §4, fila 15 (épica de billing).

**Y tiene que decir que la devolución NO es instantánea**, que es la tercera cosa.
[DEC-RF-002](01-decisiones-vigentes.md#dec-rf-002) puso el reembolso en manos de una persona —al
cerrar la sucesión el sistema **abre la marca con motivo `REEMBOLSO_POR_CONFIRMAR`** (cap. 02
(billing) §2.5) y **no ejecuta el reembolso solo**—, así que entre el cierre del cambio de plan y
la plata de vuelta hay una espera que depende de que alguien mire. **Es el precio aceptado de no
abrir el único dominio que el diseño tiene vacío a propósito** —operaciones automáticas sobre
dinero, cap. 08 §3 del núcleo, ver [ACC:13](02-nucleo.md#acc-13)— y este correo es donde ese
precio se acota: un cliente que sabe que la devolución lleva unas horas espera; uno que la esperaba
en el acto reclama. Sin la frase el correo promete algo que la decisión no da, y es un camino
**normal**, no excepcional: `DEC-RF-002` lo declara así en voz alta.

**Y el aviso alcanza a las dos puertas del mismo pago, no sólo al reciclado.** El cap. 12 §5.3
(épica de billing) declara que el pago del período impago puede entrar por el reciclado del
proveedor **o** por un pago manual que el admin registra, y que el desenlace es el mismo. La
puerta manual es además la única que el cliente abre **a propósito**: transferir la cuota vieja
mientras cambia de plan es un acto suyo, así que avisarle antes es todavía más de lo que este
correo existe para hacer. El nombre de la fila quedó como estaba —*«una cuota en reintento»*, que
es el caso mayoritario— y lo que se amplió es su alcance.

**El de la reapertura existe porque el acto no lo hace el cliente, y porque puede devolver menos
de lo que su nombre promete.** Lo dispara un admin al registrar una transferencia que llegó tarde
([MP4](04-catalogos.md#trans-b-mp4)), así que la persona se entera de que volvió **sólo si se lo
decimos**: es el mismo motivo por el que existe el de *«reanudación tras pausa»*, que también sale
de un cambio de estado que el cliente no ejecutó. Y lleva la segunda mitad porque la reapertura
**no es reversible hacia atrás**: si la suspensión cruzó el día 180, el hard delete ya se llevó el
contenido de la ficha (`V/02` §4.1) y **la ficha no vuelve**: quedó en `PURGED`, que es final y no
la republica nada (`V/03` §9, [PB9](04-catalogos.md#trans-v-pb9); FASE 8 completa, `F-8CA2-008`,
owner 2026-09-25). Anunciar la vuelta y callar eso es prometer una ventana que no se tiene, que es
el criterio que el cap. 12 §4.5, punto 3 (épica de billing) ya fijó para el otro aviso que podía
mentir por omisión. **No reemplaza a los tres avisos de retención**: aquéllos se mandan antes, y
éste describe lo que quedó después.

**El schedule del grace es relativo al vencimiento y no absoluto**: como la ventana es
configurable por plan, un schedule con días fijos se cae fuera de la ventana en los planes con
grace más corto ([DEC-SUB-002](01-decisiones-vigentes.md#dec-sub-002)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:290, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:309, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:314, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:320, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:328, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:339, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:347, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:360

## 7. Lo que este capítulo NO cierra

- **El texto de cada correo** no es parte de esta spec.
- **Qué pasa si un cliente responde un correo**: no hay canal de entrada modelado, y el §5.2
  mide que el proveedor manda todo a nuestra puerta. Queda anotado como superficie de soporte
  del capítulo 19, no como hueco de notificaciones.
- **El envío es al menos una vez, no exactamente una** (FASE 8 completa, `F-8CB2-011`; declarado
  por [DEC-METH-015](01-decisiones-vigentes.md#dec-meth-015), FASE 9 completa). La clave del §2
  impide encolar dos veces, no mandar dos: un proceso que manda y muere antes de marcar `sent`
  pierde el `processing` por vencimiento (§1.2) y la fila sale de nuevo. El daño es un correo
  repetido —también el que sale antes de cancelar (cap. 03 (billing) §3.2, precisión 3)—, nunca
  una acción de dominio. **Causa**: el proveedor de correo no está elegido y no se sabe si acepta
  una clave de idempotencia.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:372, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:374, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:375, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:378
