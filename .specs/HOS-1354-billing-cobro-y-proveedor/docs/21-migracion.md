---
title: Master Spec 21 — Migración
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 21
cierra:
  - M-MIG-01
  - O-MIG-01
  - R-MIG-01
---

# 21 · Migración

Mitad **BILLING** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 1. La premisa del §56, medida · cierra `O-MIG-01`

### 1.1 La objeción

El §56 razona: *«Como hay pocos customers actuales: si migrar automáticamente agrega mucha
complejidad/riesgo: preferir coordinación manual y nueva subscription»*. **La premisa —*«hay pocos
customers»*— es una afirmación sobre el estado real del sistema y el PDR no da el número.** Toda
la preferencia por la coordinación manual descansa ahí, y también el tamaño del riesgo de
`R-MIG-01`.

`O-MIG-01` pedía **medirla, no heredarla**. Es el §61 aplicado al propio PDR.

### 1.2 Está medida, y la premisa es cierta por mucho

Medición de producción del **2026-09-15**, sólo lectura
([`07-facts-inventory.md`](../../HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md)), **re-verificada el 2026-09-17 a las 12:52
`-03`** con la consulta 2 de ese documento, **sin un solo cambio**:

| | |
|---|---|
| **pagos registrados en toda la historia** | **0** |
| suscripciones vivas | 8, **todas mensuales** |
| con compromiso de cobro vivo | **3** (`trialing`, alojamiento) |
| cortesías sin vínculo con el proveedor | **2** (`comp`) |
| gastronomías · experiencias · partners | **0 · 0 · 0** |

**«Pocos customers» son tres compromisos de cobro y cero pagos cobrados en la historia del
sistema.** No hay historial de pagos que preservar, y tres de las cinco verticales no tienen un
solo dato: su rediseño no arrastra deuda de datos, sólo de código.

**`DEC-MIG-001` queda apoyada en una premisa verificada**, no en una heredada. La objeción se
cerró midiendo, que es la única forma en que se cierra una objeción de este tipo.

### 1.3 Y caduca

`S-METH-01`: esta medición vale mientras el hecho no cambie, y **este hecho cambia solo** — el
2026-09-26 (§3). Se re-verifica antes de implementar nada de FASE 10, con la consulta que el
inventario deja escrita.

**Y la re-verificación cuenta más que `billing_subscriptions` vivas** (FASE 8 completa,
`F-8CA3-012`; FASE 9 completa, `DB-5` del informe 09): también las soft-deleted y las tablas que el
corte descarta sin nombrar hasta ahora —compras de addon, canjes de promo, grants de destaque y
`entity_subscriptions`—. Ya no es para decidir qué se conserva, porque no se conserva nada (§4;
owner 2026-09-25, FASE 9 completa, `2a`): es para saber **a quién hay que llamar** y qué le toca
perder a cada uno antes de que el corte lo descarte.

**Y cuenta fichas por dueño en las cinco verticales**, con la clase `L1`–`L8` de `V/21` §2.4.
**La población a avisar** es toda persona con una ficha que no sea `L1` o con una suscripción
viva en el sistema viejo, **medida el día del corte** (FASE 9 vuelta 1, R7). Quien tiene sólo
fichas `L1` no pierde nada y no se avisa. **Y lista las fichas con `moderation_state = REJECTED`**,
que no se traducen: el admin las modera después con `PB10` si quiere (`V/21` §2.4; owner
2026-09-26, `G1-2`).

> 📌 **Caducó el 2026-09-26** (FASE 9 completa, `CT-6`): ese día el sistema actual cobra el primer
> pago de su historia (la suscripción `ed00a8fd…`, compromiso 1 del §3.1). Desde entonces *«cero pagos»* del §1.2 y *«no hay débitos
> corriendo»* del §3.1 describen la medición del 2026-09-17, no el estado del sistema. Los pagos
> del sistema viejo no pasan al nuevo ni se conservan (§4).

---

## 2. La cartera actual: no se migra, y lo que se conserva

*(Los §2.1–2.3 de esta mitad se retiraron con la decisión de no migrar; los números §2.4 y §2.5 se conservan porque todo el diseño los cita así. Hasta el 2026-09-25 este §2 iba después del §3 y sin encabezado propio; se reordenó sin cambiar su texto — FASE 9 completa, `C-10`.)*

### 2.4 No se migra: se cancelan las ocho y quien tenga algo vivo se suscribe de nuevo

> **El sistema nuevo no hereda una sola fila.**

La opción no existía hasta que el owner dijo de quién eran las ocho: **dos son suyas** —sin cliente
real detrás, regenerables de cero— y **las tres `trialing` son clientes contactables**. Las tres
`abandoned` no tienen nada vivo — **verificado del lado del proveedor el 2026-09-24**, recorriendo
los 108 preapprovals de la cuenta: ninguna de esas tres altas llegó a crear uno (una de esas
personas volvió a suscribirse y es una de las tres `trialing`). La migración estaba bien resuelta; lo que cambió es que **dejó de
hacer falta**. El detalle del costo de cada camino y de qué se pierde está en el §2 de la mitad de
verticales.

**Las dos cortesías se escriben como `permanent_grant`, exactamente como el *Free Forever* del
diseño nuevo**, sin nada especial — y se pueden **regenerar de cero** si conviene. Es el
instrumento del diseño nuevo para *«esta persona tiene esto sin pagar, indefinidamente»*, y
converge con el grant anclado al plan del cap. 02 §2.4: **no hace falta inventar nada para
cortesías heredadas, son el caso normal**.

**Qué plan anclan** (owner 2026-09-26, `G1-3`): **el vendible de `rank` más alto de Alojamiento
vigente el día del corte, en la vertical en que tenían `comp`**. Son cuentas propias de
demostración, y el grant lee la versión vigente (`12-contrato…` §2.8), así que un cambio de
catálogo posterior les llega solo. Si el owner algún día quiere esas cuentas para probar un plan
intermedio, se revoca el grant y se escribe otro: no se diseña para eso. El plan tiene que existir
antes del 3b, y por eso el catálogo de producción es el paso 3a (`16-fase-7-del-paraguas.md`
§4.2).

**Y esas dos filas cruzan la frontera, así que la mitad de verticales las tiene que ver.** Un
`GRANT` con `hasta: NO_VENCE` es de clase `TÍTULO` (`12-contrato…` §2.4), de modo que las dos
cuentas amanecen con `cubierto` **verdadero**: no las alcanza `PB2` y, el día que publiquen algo,
la transición que dispara es `T6` y no `T1`. La verificación completa ~~—y el orden entre esta
escritura y el paso 4, que hay que fijar en el procedimiento—~~ está en la mitad de verticales,
cap. 21 §2.4; **el orden quedó fijado en el procedimiento**: los grants son el paso 3b, antes de
las lápidas del paso 4 (`16-fase-7-del-paraguas.md` §4.2; FASE 9 completa, `DB-7`). Se dice acá porque **el efecto lo produce esta escritura y se observa allá**.

**Con una precisión que no es de forma: un ANCLA por cada vertical de su scope, sobre UNA sola fila
de grant.** Un grant ancla **un plan por vertical** (`12-contrato…` §2.8, `B/02` §2.4), porque un
plan pertenece a una sola. Las dos formas equivocadas quedaron descartadas por escrito y conviene
nombrar las dos: escribir **un grant con un plan** para un scope de dos verticales es el defecto
que el contrato cerró —*«la segunda vertical resolvería sus capacidades leyendo el plan de la
primera»*—; y escribir **dos grants** de una vertical cada uno es el otro extremo, porque revocar
pasaría a ser dos actos en vez de uno. Lo que se multiplica es la fila de
`permanent_grant_vertical`, **nunca la concesión**.

### 2.5 Cancelar no es olvidar: el compromiso viejo se conserva

**Ésta es la única fila ~~que el sistema nuevo sí escribe~~ ~~de billing que el sistema nuevo sí
escribe~~ de rastro que el corte escribe** —~~del lado de verticales el corte escribe además una
fila de `trial` ya consumida por cada dueño existente, que es el mismo tipo de rastro (`V/21` §2.4;
FASE 8 completa, owner 2026-09-25)~~ **los dos `permanent_grant` del §2.4 también son filas nuevas
de billing, pero son cortesías vigentes, no rastro; y del lado de verticales el corte ya no escribe
filas de `trial`, porque los clientes actuales se tratan como nuevos** (owner 2026-09-25; FASE 9
completa, `2g`; `V/21` §2.4)—, y no contradice *«no se hereda ninguna fila»*: no se hereda **nada vivo**. Lo que se escribe es una lápida.

> **El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su `provider_link`,
> escrita DESPUÉS de cancelarlo en el proveedor.**

**Qué lleva y sobre qué ids** (FASE 9 vuelta 1, R6). Se escribe una lápida por cada preapproval
que el paso 1b canceló y el paso 2 verificó, **conocido por la base o no, sondas incluidas**; no se
escribe sobre las sondas del manifiesto, que siguen vivas. Lleva `clase = LÁPIDA`, `origen_de_lápida = CORTE`,
`estado = CANCELLED` y su `provider_link`, y nada más: ni usuario, ni vertical, ni versión, ni billing option
(`B/02` §2.2). El barrido no necesita más para lo único que hace con ella —encontrar el id y
tratarlo por la salvedad 4 del cap. 09 §3—, y el corte no tendría de dónde sacarlo sin leer las
tablas que retira. **La dispara una persona**: el operador corre, en el paso 4, la herramienta del
corte sobre el manifiesto que produjo el 1b. La escritura la construye y la prueba **B11**. **La
misma forma de fila la usa la lápida de recepción** que el webhook escribe al recibir un
preapproval desconocido que no nombra ninguna fila (cap. 09 §2.4; owner 2026-09-26, `G3-2`): la
diferencia es quién la escribe —`origen_de_lápida = RECEPCIÓN`—, no qué lleva.

**Qué pasa sin ella, y es el caso que la justifica.** Los preapprovals vivos se cancelan en
el proveedor y no queda rastro. **Cuáles son los saca el recorrido sin filtro del proveedor, no
nuestra base**, y antes se cancelan los `preapproval_plan` viejos para cerrar sus links
(`16-fase-7-del-paraguas.md` §4.2, pasos 1a y 1b): el 2026-09-24 ese recorrido encontró una
autorización viva que la base no conocía, y los cinco planes viejos seguían vendiendo. Si alguna emite un cobro después del corte —porque la cancelación
se aceptó y no se aplicó, o porque el cobro ya estaba en vuelo— **ese webhook llega como un
preapproval desconocido**, y el sistema nuevo tiene **un solo camino automático** para un
desconocido: re-vincularlo. ~~El candidato más plausible del emparejamiento es **la suscripción nueva
de esa misma persona**, que acaba de contratar. **El cobro viejo se imputa como pago del ciclo
nuevo: pagó dos veces y el sistema registra una.**~~ Sin regla, el candidato más plausible del
emparejamiento era **la suscripción nueva de esa misma persona**, que acaba de contratar, y el cobro
viejo se imputaba como pago del ciclo nuevo: pagó dos veces y el sistema registraba una.

> **La regla de re-vinculación** (owner 2026-09-25; FASE 9 completa, `2b`; cierra `F-8CB3-008`):
> **un desconocido se re-vincula sólo si su `external_reference` nombra una fila nuestra que no
> tenga otro `provider_link` vivo. Todo otro desconocido abre la marca `requiere_conciliación`** —con
> motivo `TRANSICIÓN_NO_DECLARADA`, el 6 de `B/02` §2.5, el mismo que escribe el cap. 09 §2.4—, y
> lo mira una persona. **Si lo que llega es un cobro aprobado, el motivo es
> `PAGO_TARDÍO_RECHAZADO`; y si el desconocido no nombra ninguna fila, la marca cuelga de una
> lápida de recepción** (`origen_de_lápida = RECEPCIÓN`) que el handler escribe al recibirlo (cap.
> 09 §2.4; FASE 9 vuelta 1, `F-8V1B3-001`; owner 2026-09-26, `G3-2`). *«Otro `provider_link`
> vivo»* se lee *«la fila ya tiene su `provider_link`»* (`B/02` §2.2, `UNIQUE(subscription_id)`;
> FASE 9 vuelta 1, R12).

Cada preapproval del sistema nuevo nace con ~~nuestro `external_reference` (`PA-2`)~~ **el `id`
de su fila de `subscription`** como `external_reference` (`PA-2`, `B/02` §2.2; FASE 9 vuelta 1,
R12), así que una
huérfana legítima siempre nombra su fila; lo que venga del sistema viejo —~~un cobro en vuelo sin
lápida porque su id sólo estaba en el proveedor,~~ una sonda que siguió viva (desde R6 el id que
sólo estaba en el proveedor tiene lápida; FASE 9 vuelta 1)— no la nombra y termina
en una persona. **Ya no hay candidato plausible**: la suscripción nueva de la misma persona tiene su
propio `provider_link` vivo, así que no puede recibir el cobro viejo. La precondición ~~se escribe en~~
**está escrita en** el cap. 09 §2.4, que es donde vive la re-vinculación, con las mismas palabras
(FASE 9 completa; verificado contra ese § en la misma pasada).

Con la lápida, el barrido del cap. 09 **encuentra el id** y resuelve *«cancelado durante el
corte»* en vez de *«huérfana»*. Y **no compite por el candado del §11**, porque `CANCELLED` no está
entre los estados vivos (cap. 02 §2.2).

> **Y el barrido la recorre de verdad, que es lo que hacía falta decir.** La lápida es una
> `CANCELLED`, o sea un estado terminal, y *«los estados terminales de una suscripción no se
> barren»* la sacaba del barrido **en el mismo acto de escribirla**: el capítulo le atribuía a un
> mecanismo un trabajo que ese mecanismo tenía escrito que no hacía. La cubre la **salvedad 4**
> del cap. 09 §3, porque su preapproval lo canceló una llamada **nuestra**, ~~**hecha a mano y sin
> nadie que verifique**~~ **la del sistema viejo en el paso 1b, verificada por el paso 2 releyendo
> por id** ([`16-fase-7-del-paraguas.md`](../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md)
> §4.2; FASE 9 completa, `CT-2`/`C-6`), así que vuelve al barrido **hasta que la relectura la vea
> `cancelled`**. **Entra al barrido aunque el paso 2 ya la haya visto `cancelled`**, y no mueve
> ninguna cifra del cap. 09: ~~la escribe una persona, sin idempotencia ni registro de nuestro lado,~~
> la dispara una persona con la herramienta del corte, sobre el manifiesto del 1b (FASE 9 vuelta 1, R6),
> y la primera relectura del barrido es la que la confirma desde el sistema nuevo. Es exactamente
> el caso que el párrafo de arriba describe —*«la cancelación se aceptó y no se aplicó»*—, y sin
> la salvedad el único aviso llegaba **después del cobro**, por la vía del webhook del §2.2.
>
> ~~**La lápida es la única fila `CANCELLED` de todo el sistema que ninguna transición produce**~~
> **Las lápidas son las únicas filas `CANCELLED` de todo el sistema que ninguna transición
> produce, y son dos** —la del corte (`origen_de_lápida = CORTE`, de la herramienta del paso 4) y
> la de recepción (`RECEPCIÓN`, que escribe el handler al recibir un desconocido que no nombra
> ninguna fila); desde `G3-2` son dos formas de la misma fila, las dos con `clase = LÁPIDA` (owner
> 2026-09-26; FASE 9 vuelta 1, corregido el *«única»*)—, y
> eso no es exclusivo del corte: cualquier escritura manual futura hereda el mismo agujero. Por
> eso la exención del cap. 09 §3 quedó escrita como **criterio** —quién dejó al preapproval sin
> poder cobrar— y no como enumeración de transiciones: una fila que no nace de ninguna transición
> no aparece en ninguna enumeración de transiciones.

**El orden importa y es parte de la regla**: primero se cancela en el proveedor, después se
escribe. Al revés quedaría una lápida sobre un preapproval que sigue vivo, que es peor que no
tenerla — afirmaría que está cerrado algo que cobra.

**El cobro en vuelo del corte que sale bien no se devuelve** (owner 2026-09-26, `G3-1`, contra la
recomendación; FASE 9 vuelta 1, `F-8V1B3-002`). Un cobro del preapproval viejo que el proveedor
procesa **después** de que el paso 1b lo canceló —porque ya estaba en vuelo— llega por su evento,
encuentra la lápida por su `provider_link` y **se asienta sobre ella sin marca**: se escribe su
`payment` colgado de la lápida, la lápida sigue `CANCELLED`, no se extiende nada y a nadie se le
propone devolverlo. **La lápida del corte (`origen_de_lápida = CORTE`) no entra al desempate de
motivos** (cap. 05 §3) **ni a la comparación de cobros del barrido** (cap. 09 §3): los registros de
su preapproval no abren nada, sean del sistema viejo o del cobro en vuelo. Es la posición de `2d`
—la diferencia de un corte abortado no se devuelve— y de `G1-4` —lo pagado en el sistema viejo por
un período que el corte corta se acepta y se declara— extendida al cobro que cae en la ventana del
corte: el cliente arranca de cero con un trial nuevo (`2g`). **Lo que la lápida sigue haciendo es
la salvedad 4**: si la cancelación del 1b no se aplicó, el barrido la relee por estado, la reintenta
y marca a los 3 días (cap. 09 §3); ese detector no depende del cobro. Lo que la decisión deja sin
cerrar está en *«lo que este capítulo NO cierra»*. **No alcanza a la lápida de recepción**
(`origen_de_lápida = RECEPCIÓN`, cap. 09 §2.4), cuyo cobro sí va a `PAGO_TARDÍO_RECHAZADO` con la
propuesta de devolver (owner 2026-09-26, `G3-2`).

> ⚠️ **Esta regla ya estaba escrita y no se aplicó.** Se decidió junto con el resto de la
> migración, y **al decidir que no se migra se la llevó puesta el mismo movimiento** — aunque no
> migra nada: sólo conserva el rastro de lo que se cancela. Es el modo de falla que conviene
> recordar: **una decisión que vuelve innecesario un trabajo puede llevarse algo que seguía
> haciendo falta.**

**Qué deja de existir con esto, y no es que se resuelva: se elimina.** La migración dejaba afuera
las relaciones con trial, transcribía un trial y dejaba los compromisos sin vínculo, tenía un punto
de no retorno sin lado elegido, describía dos operaciones distintas en dos lugares, y **nadie la
ejecutaba**. Los cinco problemas **pierden sujeto**, y la unidad de trabajo que iba a escribirla no
se crea.

**Lo único que sobrevive es de otro tamaño**: el **rollback del PROGRAMA** —qué se hace si hay que
volver atrás el reemplazo entero del sistema de cobro— que no es el rollback de ocho filas y no se
escribe acá. **Y ya está decidido: pasado el paso 3 del corte, sólo hacia adelante**; antes, la
rama de aborto restaura el backup (`16-fase-7-del-paraguas.md` §4.2 y §4.3; owner 2026-09-25, FASE 9
completa, `2c` y `2e`).

---

## 3. El cobro durante el rediseño · cierra `R-MIG-01`

### 3.1 El hueco cambia de forma cuando se lo mide

`R-MIG-01` lo planteaba así: *«si hay débitos automáticos activos, siguen corriendo durante todo
el programa»*, y lo llamaba **el riesgo operativo más grande del programa**.

**No hay débitos corriendo.** Cero pagos en la historia del sistema *(medido el 2026-09-17;
caduca el 2026-09-26 con el compromiso 1, §1.3 — FASE 9 completa, `CT-6`)*. Lo que hay son **tres
compromisos que todavía no cobraron**, con fecha:

| compromiso | primer cobro |
|---|---|
| 1 | **2026-09-26** |
| 2 | 2026-11-25 |
| 3 | 2026-11-30 |

### 3.2 Y entonces son tres problemas distintos, no uno

**(a) Las ocho relaciones vivas.** No hay nada que parar ni que coexistir, y **tampoco nada que
transcribir**: **no se migra ninguna** (§2.4). Las tres `abandoned` no tienen nada vivo, las dos
`comp` son del owner, y las tres `trialing` son clientes contactables que se resuscriben. Ninguna
de las tres opciones que el hueco planteaba —coexistencia de dos motores, corte con migración
asistida, congelamiento— hace falta para éstas.

**(b) El 2026-09-26.** Esa fecha llega **durante FASE 2 o 3**, y la implementación está en FASE 10
(§65). O sea que **ese primer cobro de la historia del sistema ocurre bajo el sistema ACTUAL, no
bajo éste.** No es una pregunta de migración: es una operación que necesita a alguien mirándola el
día que pase. Este capítulo la registra con fecha para que no llegue por sorpresa.

**(c) Las altas nuevas.** ~~Es lo único de los tres que sigue abierto, y **no lo cierra esta spec.**~~
**Cerrado por el log**: se siguen tomando (`DEC-MIG-002`) y se resuelven como la cartera, sin
transcribir (`DEC-MIG-003`, `DEC-MIG-004` #16) — §3.3 (FASE 9 completa, `C-9`).

### 3.3 Las altas nuevas se siguen tomando (`DEC-MIG-002`) y se resuelven como la cartera (`DEC-MIG-003`, `DEC-MIG-004` #16)

*(Título hasta el 2026-09-25: ~~«Las altas nuevas son una decisión del owner, y se declara
abierta»~~. FASE 9 completa, `C-9`.)*

Qué pasa con quien se suscriba **mientras dura el rediseño** es una decisión comercial, no
técnica: congelar altas tiene costo de negocio, y no congelarlas agranda la cohorte que después
hay que transcribir a mano —que es precisamente lo que hoy hace barata a la opción (a)—.

Las tres opciones del hueco, con lo que cuesta cada una **dado el número medido**:

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **seguir tomando altas** en el sistema actual | ninguno comercial | la cohorte crece, y con ella se vuelve inviable *«no migrar»*: hoy son 8 y el umbral medido está en unas 20 (~~§2.4~~ `V/21` §2.5; FASE 9 completa, `C-10`) |
| 2 | **congelar altas nuevas** hasta FASE 10 | comercial, y no es chico: tres verticales todavía no vendieron nada | cero cohorte nueva |
| 3 | **coexistencia de dos motores** | el más caro de construir | contamina la arquitectura nueva, que es lo que el §56 pide no hacer |

**No se completa en silencio** (§67). ~~Queda declarada como decisión del owner en
[`04-open-decisions.md`](../../HOS-1352-billing-verticals-redesign/docs/04-open-decisions.md) — la única que este capítulo abre en vez de
cerrar.~~ **Y ya no está abierta**: el owner eligió la opción 1 (`DEC-MIG-002`, se siguen tomando
altas en el sistema actual), y `DEC-MIG-003` le sacó la mitad cara —*«se transcriben a mano»*—: las
altas nuevas **no se transcriben**, se cancelan en el corte y se las llama como a la cartera
(`DEC-MIG-004` #16; FASE 9 completa, `C-9`). Lo que sigue vigente es la condición de caducidad de
`V/21` §2.5: si la cartera pasa de unas veinte, se vuelve a discutir.

---

## 4. Lo que NO se migra, y no es una omisión

- **Todo lo vivo**: ninguna fila se transcribe (§2.4). Lo único que ~~se escribe~~ escribe billing es la lápida del
  §2.5, que no es una transcripción: es el rastro del id que se canceló, **y los dos
  `permanent_grant` del §2.4**, que son cortesías del diseño nuevo. ~~**Verticales escribe el
  otro rastro**, la fila de `trial` consumida (`V/21` §2.4; FASE 8 completa, owner 2026-09-25).~~
  **Verticales no escribe filas de `trial`**: el corte trata a los clientes actuales como nuevos y
  sólo les respeta la ficha (`V/21` §2.4; owner 2026-09-25, FASE 9 completa, `2g`).
- **Los pagos**: ~~no hay ninguno.~~ los hay desde el 2026-09-26, bajo el sistema viejo (§1.3), y
  **no se conservan** (FASE 9 completa, `CT-6` y `2a`).
- **Las tablas viejas de billing, con todo lo que tengan adentro, y las columnas que las copian**
  (owner 2026-09-25; FASE 9 completa, `2a`; cierra `F-8CB3-014`, `F-8CA3-007`, `F-8CC2-007`): **no
  se conserva nada** —ni se transcribe, ni se congela en solo lectura, ni se exporta—. Eso abarca
  `billing_*` entero (suscripciones, pagos, compras de addon, canjes de promo), los grants de
  destaque, `entity_subscriptions`, **`partner_subscriptions`** (FASE 9 vuelta 1, `F-8V1C2-014`) y
  las columnas denormalizadas que el código de hoy lee, como `featured_by_entitlement` **y
  `is_featured`**: ninguna ficha nace destacada; el destaque es una capacidad comercial (FASE 9
  vuelta 1, R1). El sistema nuevo no lee ninguna, y se retiran con el código que las lee
  (FASE 5). *«Recién arrancamos; a los clientes que hay los contactamos en persona, de a uno, y se
  vuelven a suscribir. Guardarlo sólo deja basura que después cuesta limpiar.»* **El corte no
  necesita leerlas**: los ids que cancela salen del proveedor (`16-fase-7…` §4.2, paso 1b) y, desde
  `2g`, no siembra trials consumidos, que era lo único que las leía. **Si algún día algo del corte
  volviera a leerlas, corre antes de retirarlas.**
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- ~~**Qué pasa con las altas nuevas durante el rediseño** (§3.3): decisión del owner, declarada
  abierta.~~ Cerrado: §3.3 (FASE 9 completa, `C-9`).
- **Un contracargo o un reclamo sobre un pago del sistema viejo no tiene comprobante del lado de
  Hospeda después del corte** (declarado por `DEC-METH-015`, FASE 9 completa; `F-8CB3-014`,
  `F-8CA3-007`). **Causa**: el owner decidió no conservar nada del sistema viejo (`2a`); la población
  son los pocos pagos que el sistema actual cobre entre el 2026-09-26 y el corte, de clientes que el
  owner llama uno por uno. El comprobante sigue existiendo del lado de MercadoPago.
- **Lo pagado en el sistema viejo por un período que el corte corta, o por un addon vigente, se
  pierde y no se devuelve** (declarado por `DEC-METH-015`; owner 2026-09-26, `G1-4`, elegida
  contra la recomendación de devolver completo antes del corte; `F-8V1C2-002`). El cliente que
  pagó un ciclo el 25/11 y ve el corte el 05/12 pierde los días que le quedaban, y el addon que
  compró deja de existir con las tablas viejas (§4). **Lo compensa de hecho el trial de `2g`**:
  al publicar su ficha estrena el trial entero de un cliente nuevo (`V/21` §2.4), que suele cubrir
  esos días —pero no es una equivalencia calculada, y un addon no tiene trial que
  lo reemplace—. **El aviso previo lo dice** (`16-fase-7-del-paraguas.md` §4.2, guion del aviso),
  y le pide que no contrate ni compre nada en el sistema viejo después de recibirlo. **Causa**:
  es la posición coherente con `2a` (no se conserva nada del sistema viejo) y con `2d` (la
  diferencia de un corte abortado no se devuelve); el owner prefiere un trial nuevo a unos pocos
  reembolsos a mano. **Mueve plata, y por eso se declara con su detector**: la re-verificación del
  §1.3 lista quién pagó y qué, y es la lista con la que el owner llama; un reclamo que llegue
  después del corte se atiende contra el comprobante del proveedor (punto anterior), no contra
  nada nuestro. No da acceso indebido ni borra datos de nadie más. **Y no es el cobro en vuelo del
  corte**, que tiene su propia decisión (`G3-1`: se asienta sobre la lápida sin marca, §2.5).
- **El cobro en vuelo del corte que sale bien se asienta sobre la lápida sin marca y no se
  devuelve** (declarado por `DEC-METH-015`; owner 2026-09-26, `G3-1`, elegida contra la
  recomendación de proponer devolverlo con confirmación de una persona; `F-8V1B3-002`, `F-8V1B1-007`,
  `F-8V1C2-013`). Un cobro del preapproval viejo que el proveedor procesa después de la
  cancelación del paso 1b no le compra nada a nadie: el cliente arranca de cero con trial (`2g`).
  **Lo que deja**: (1) el cliente pagó un mes que no usa, lo ve en su resumen y **puede
  desconocerlo ante el banco**, y el comprobante de ese cobro no existe del lado de Hospeda más
  allá del `payment` asentado sobre la lápida (el punto del contracargo, arriba); (2) **la herramienta
  no se lo pone delante a nadie**: la lápida del corte queda fuera del desempate (cap. 05 §3) y de
  la comparación de cobros (cap. 09 §3), así que ningún listado lo muestra; (3) si el evento de ese
  cobro se pierde, **tampoco queda el `payment`**, porque el barrido no compara cobros sobre la
  lápida. **Causa**: el owner eligió la posición coherente con `2d` y con su `G1-4`, y prefiere
  tratarlo en la llamada uno por uno a ese cliente antes que con una confirmación por cobro.
  **Población**: los clientes con un cobro en vuelo en la ventana de minutos del paso 1b —a lo sumo
  los tres de la cartera—. **Detector**: el `payment` asentado sobre la lápida, que una consulta
  sobre las lápidas del corte con `payment` lista, y la re-verificación del §1.3, que es la lista
  con la que el owner llama. **No cubre** la cancelación del 1b que no se aplicó: ésa la detecta la
  salvedad 4 del cap. 09 §3 y marca a los 3 días.
- ~~**La precondición de la re-vinculación en el cap. 09 §2.4** (§2.5, `2b`) todavía no está escrita
  allá. **Causa**: el cap. 09 es de otra pasada de esta misma ronda; hasta que la tenga, la regla vive
  sólo en este capítulo.~~ **Cerrado el 2026-09-25**: está escrita en el cap. 09 §2.4, con el motivo 6
  (`TRANSICIÓN_NO_DECLARADA`), y las dos redacciones coinciden (FASE 9 completa, `2b`).
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.
