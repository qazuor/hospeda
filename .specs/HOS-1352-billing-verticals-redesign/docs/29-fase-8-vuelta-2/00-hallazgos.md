---
title: "FASE 8 vuelta 2 · el consolidado de los 56 hallazgos"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 — el consolidado

Nueve agentes adversariales atacaron el diseño vigente el 2026-09-26, sobre el HEAD `1cccd9119d`
del worktree `hospeda-spec-hos-1352-billing-redesign`. Es la **vuelta 2 de 2** del tope de
`DEC-METH-013`, la última: si en ésta sigue habiendo críticos, se pasa a declarar. El alcance fue
el mismo de la vuelta 1: el núcleo, las dos épicas con sus descomposiciones, el contrato de
cobertura y el corte (`16-fase-7-del-paraguas.md`). Trabajaron **ciegos entre sí y ciegos del
historial**, y ninguno tocó otro archivo que su informe.

Este documento no repite los hallazgos: los **agrupa por causa**. La convergencia entre agentes
ciegos es la señal de severidad. Salió **sólo de los nueve informes**, del log de decisiones, de la
matriz y de los capítulos que los informes citan; no se leyeron `14-`…`26-`, `28-`, el worklog, el
handoff ni engram.

> **Lo que este documento NO hace.** No propone soluciones y no decide nada. Donde cambia una
> severidad lo dice como **propuesta del consolidador**, con su razón. Qué racimo se arregla y cuál
> se declara con causa lo decide el owner.

---

## 1. Los números, recontados

Contados con script sobre los nueve archivos: `rg -c "^### F-8V2"` por archivo, y cada `###`
asignado a la sección `## CRITICA/ALTA/MEDIA/BAJA` que lo contiene. **Dan 56: 1 CRITICA, 21 ALTA,
26 MEDIA y 8 BAJA**, que es lo que traía el pedido. Coincide también con el resumen que cada
informe escribe en su introducción.

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA |
|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 4 | 0 | 3 | 1 | 0 |
| `A2` | máquinas, carreras y huérfanos | 8 | 0 | 1 | 5 | 2 |
| `A3` | datos, migración y acoplamiento | 6 | 0 | 2 | 3 | 1 |
| `B1` | doble cobro y pérdida de pago | 6 | 1 | 2 | 3 | 0 |
| `B2` | máquinas, idempotencia y carreras | 5 | 0 | 3 | 2 | 0 |
| `B3` | conciliación, datos y migración | 9 | 0 | 3 | 5 | 1 |
| `C1` | la costura | 7 | 0 | 2 | 4 | 1 |
| `C2` | liberación, coexistencia y migración | 7 | 0 | 4 | 2 | 1 |
| `D1` | coherencia del conjunto | 4 | 0 | 1 | 1 | 2 |
| | **total** | **56** | **1** | **21** | **26** | **8** |

**Las citas de los informes se verificaron con script.** `27-fase-8-vuelta-1/verificar-citas.py`
sobre los nueve informes: **225 ok, 0 desplazadas, 0 fallas** (A1 21, A2 18, A3 22, B1 29, B2 24,
B3 36, C1 33, C2 25, D1 17). Ninguna cita inventada, incluidas las del código actual.

---

## 2. Los racimos

Un racimo es un conjunto de hallazgos con **una sola causa**. A diferencia de la vuelta 1, acá
**todo** hallazgo tiene racimo, así que hay dos clases: los **convergentes** (R1–R13), donde
llegan agentes distintos, y los **de un solo agente** (R14–R28), que no aportan convergencia pero
sí una causa. Dentro de cada clase van ordenados por lo que está en juego: plata y acceso primero,
después la costura y el corte, después registro.

| racimo | causa | sev. | agentes |
|---|---|---|---|
| **R1** | el acto que termina la principal no alcanza al complemento recurrente | **CRÍT** | `B1`, `D1` |
| **R2** | la lápida del corte y las terminales dan por muerto a un preapproval cancelado | ALTA | `B1`, `B3`, `C2` |
| **R3** | la ventana entre apuntar la URL (paso 3) y sembrar las lápidas (paso 4) no está gobernada | ALTA | `B3`, `C2` |
| **R4** | el cobro de única vez no tiene identidad de pedido, ejecutor de recuperación ni detector | ALTA | `B1`, `B2` |
| **R5** | el hecho 4 lo escribe billing en verticales, fuera del contrato y sin unidad | ALTA | `A3`, `C1` |
| **R6** | la rama de aborto declara que no queda nada externo que el backup no restaure | ALTA | `A3`, `C2` |
| **R7** | la identidad de Partner se ancla en un correo que nadie probó | ALTA | `A1`, `A2` |
| **R8** | el handler de desconocidos no consulta el manifiesto de sondas | MEDIA | `B3`, `C2` |
| **R9** | `listing` no está mapeado al esquema físico que existe hoy | MEDIA | `A2`, `A3` |
| **R10** | la acción administrativa 15 quedó a medio especificar | MEDIA | `A1`, `D1` |
| **R11** | el ancla de un grant no tiene de dónde resolver su plan | MEDIA | `B3`, `C1` |
| **R12** | el censo de emisores del aviso enumera filas, no la regla | MEDIA | `A2`, `C1` (+ `D1`) |
| **R13** | una corrección que no llegó a la frase vecina | BAJA | `A2`, `A3`, `C2` |
| **R14** | la precisión 7 y el sujeto sin anclar abren lo ajeno | ALTA | `A1` |
| **R15** | quien paga sin pasar por `PB1` conserva el trial | ALTA | `A2` |
| **R16** | el emisor lee «en el mismo acto», la frase que el contrato tachó | ALTA | `C1` |
| **R17** | la sucesora que vive del crédito no tiene período | ALTA | `B1` |
| **R18** | una transición que cancela antes de escribir y pierde la carrera | ALTA | `B2` |
| **R19** | la fila de `refund` no sabe qué devolución del proveedor es la suya | ALTA | `B2` |
| **R20** | la comparación de monto mira el preapproval y no el cobro, y sin reglas | ALTA | `B3` |
| **R21** | la población a avisar sale de la base y el censo del proveedor | ALTA | `C2` |
| **R22** | transiciones de verticales fuera del lock o con guarda sin fecha | MEDIA | `A2` |
| **R23** | el seudónimo del correo no tiene función escrita | MEDIA | `A3` |
| **R24** | retirar todos los planes no cierra la vertical a trials | MEDIA | `A3` |
| **R25** | qué corre al asentar un cobro sobre una lápida | MEDIA | `B3` |
| **R26** | «la implementación de arranque» no está delimitada | MEDIA | `C1` |
| **R27** | el corte despublica por escritura directa y el caché público no se entera | MEDIA | `C2` |
| **R28** | `S36` no llegó a las enumeraciones de segundo orden | BAJA | `D1` |

En los convergentes quedan **31** hallazgos y en los de un solo agente **25**: **56**, ninguno
huérfano (§8, verificado con script). Críticos: **1 declarado** (`F-8V2B1-001`, en R1), **que el
consolidador sostiene** (§3), y **ninguna ALTA propuesta para subir** (§4).

### Convergencias que traía el pedido, confirmadas o descartadas

| convergencia | veredicto | dónde quedó |
|---|---|---|
| hecho 4 y fin de servicio (`A3-001`, `C1-001`) | **confirmada**: misma causa, dos caminos (glosario y descomposición; contrato y dependencias) | R5 |
| ventana entre pasos 3 y 4 (`B3-003`, `C2-002`) | **confirmada**: los dos llegan al mismo par *(lápida de recepción, choque del `UNIQUE`)* | R3 |
| sondas vivas que cancela el handler (`B3-004`, `C2-005`) | **confirmada** | R8 |
| población del cobro en vuelo (`B1-006`, `B3-002`, y `C2-004`) | **confirmada, más ancha**: tres caminos distintos al mismo número falso, y `B3-006` comparte la premisa | R2 |
| addon de única vez (`B1-003`, `B2-003`, `B2-004`) | **confirmada**: `B1-003` y `B2-004` son el mismo hallazgo; `B2-003` es otro mecanismo con la misma causa | R4 |
| `S36` y la orfandad (`D1-001`, `D1-003`, `D1-004`) con la CRÍT `B1-001` | **partida**: `D1-001` converge con `B1-001` por el **efecto** (el complemento cobra después de que la principal se fue); `D1-003` y `D1-004` comparten con `D1-001` la **causa** (`S36` entró tarde) pero no el efecto | R1 y R28 |
| censo de emisores sin `T6`–`T8` (`A2-008`, `C1-007`) | **confirmada**, y `D1` lo vio y lo descartó como no-hallazgo por la misma razón que los dos le dan BAJA | R12 |
| trial sin consumir (`A2-001`) | **sin convergencia**: `A2-002` es del mismo agente | R15 |
| «en el mismo acto» (`C1-002`) | **sin convergencia**; su desenlace para `T8` es el de R15 por otra causa | R16 |

Cinco convergencias que el pedido no traía, encontradas al leer: la rama de aborto (`A3-002` con
`C2-001`, R6), el correo de Partner (`A1-003` con `A2-005`, R7), `listing` contra el esquema
actual (`A2-006` con `A3-003`, R9), la acción 15 (`A1-004` con `D1-002`, R10) y el ancla del 3b,
que dos agentes atacan sobre la misma línea `16-fase-7…:130` (`C1-004` con `B3-009`, R11).

### R1 · El acto que termina la principal no alcanza al complemento recurrente — CRÍT, 2 agentes

Un addon recurrente es su propio preapproval (`DEC-ADDON-002`, implicación 6: *cancelar el plan no
cancela los addons*), y lo apaga sólo la orfandad (`A5`) o el borrado (`A6`). Dos caminos, vistos
por dos agentes ciegos, dejan ese preapproval cobrando después de que la principal se fue:

- **`S11`** (la baja desde `ACTIVE`) cancela el preapproval de la principal y la deja en
  `CANCEL_SCHEDULED`, que es **fila viva**: el complemento no queda huérfano hasta `S12`. Con su
  propio aniversario, cobra un mes entero adentro de la ventana; en `S12` muere y `S21` abre el
  motivo 14, *«el cliente actuó»*, con propuesta **no devolver** (`F-8V2B1-001`).
- **`S36`** (la revocación del derecho de arrepentimiento) no está en la enumeración de `B/16`
  §4.3 a la que `A5` remite *«y no copiadas acá»*: una implementación que sigue la lista no evalúa
  la orfandad al revocar, y el backstop es la cuarta comprobación del barrido, al día siguiente
  (`F-8V2D1-001`). Y aun cuando la orfandad corre, el motivo que le toca es el 14.

- `F-8V2B1-001` **CRÍT** · `F-8V2D1-001` ALTA
- Convergencia: `B1` llega por el dinero (qué cobra después de la baja), `D1` por la coherencia (la
  lista que no se recontó). Los dos terminan en el mismo cobro y en el mismo motivo 14. `B1`
  anota además, en su «fuera de mi vector», que la revocación con addons es pregunta del pliego
  legal, que es la segunda mitad de `D1-001`.
- Vecino: `F-8V2B1-005` (qué pago devuelve `S36` sobre una sucesora) es de R17.

**Severidad.** R1 es CRÍT por `F-8V2B1-001`, verificada en §3: plata cobrada de más en el camino
principal de la baja de todo cliente con un addon recurrente, sin marca que proponga devolverla.
`F-8V2D1-001` queda ALTA: es un camino plausible y no el principal (una revocación con addon), el
backstop existe y llega al día siguiente, y un implementador que lee el predicado en vez de la
lista no tiene el daño.

**Juan.**

1. Juan paga su plan el día 1 y tiene un destaque recurrente con aniversario el día 20.
2. El día 3 pide la baja. `S11` cancela el preapproval del plan y fija fin de servicio el día 31;
   la pantalla de baja le dice que el cobro del destaque *«se corta»*.
3. El día 20 Mercado Pago le cobra un mes entero de destaque: ese preapproval nunca se canceló.
4. El día 31 `S12` corta la principal, `A5` apaga el destaque y `S21` abre el motivo 14. La
   persona que mira la marca ve la propuesta **no devolver**. Juan pagó 30 días y recibió 11.

**Qué hace falta decidir.** Decisión del owner, porque es la política de `DEC-SUB-009` aplicada a
una fila que no nombra: *¿el complemento recurrente se cancela en el proveedor en el acto de la baja
(sosteniendo su servicio hasta el fin de la principal, la forma de `DEC-SUB-009`), o su cobro
posterior a la baja va a un motivo con propuesta «devolver»?* El diseño sugiere lo primero:
`DEC-SUB-009` eligió cancelar ya precisamente porque la alternativa *«cobra plata que no
corresponde»*. Una segunda pregunta, también del owner y del pliego legal: *¿qué motivo escribe
`S21` cuando la orfandad la causó `S36`?* Después es aplicación: `S36` en la lista de `B/16` §4.3
y en el recuento de `B/03` §3.2 (catorce), y la fila 3-bis de `B/19` §4 para los cuatro scopes y
sin prometer que el cobro *«se corta»* mientras pueda cobrar.

### R2 · La lápida del corte y las terminales dan por muerto a un preapproval cancelado — ALTA, 3 agentes

`G3-1` (owner 2026-09-26) decidió que el cobro en vuelo del corte que sale bien se asienta sobre la
lápida **sin marca y sin devolución**, y lo declaró con una población: *«la ventana de minutos del
paso 1b —a lo sumo los tres de la cartera—»*. Tres agentes ciegos llegan a que esa población es
falsa, cada uno por otro lado:

- el registro de cobro **reintenta durante un ciclo** (`GR-3`), `recycling` se midió **sobre
  preapprovals ya cancelados** (`RC-6`), y cambiar la tarjeta dispara un reintento inmediato que
  cobra (`GR-1`): un cliente con la renovación rechazada al corte puede cobrar semanas después
  (`F-8V2B3-002`);
- el código actual documenta **seis preapprovals que leyeron `cancelled` y horas después
  `authorized`**, y el gate del paso 2 relee una sola vez: el preapproval vuelve a cobrar después
  del corte y cae sobre la lápida sin marca (`F-8V2C2-004`);
- desde `DEC-MIG-002` se siguen tomando altas, así que «tres» es un número que vence
  (`F-8V2B1-006`).

La premisa de fondo —*cancelado no puede cobrar*— es de diseño y no de medición (`GR-2` sigue
`UNKNOWN`), y sostiene además la exención de las terminales en el barrido (`F-8V2B3-006`).

- `F-8V2B3-002` ALTA · `F-8V2C2-004` ALTA · `F-8V2B1-006` MEDIA · `F-8V2B3-006` MEDIA
- La matriz lo dice en `GR-2`, en la columna de lo que queda abierto:
  - `$D/06-mp-validation-matrix.md:201` — «un cobro ya en vuelo en el instante de `S6`»
- Y la declaración que los tres contradicen:
  - `B/21:398` — «en la ventana de minutos del paso 1b»

**Severidad.** ALTA. Es plata cobrada sin servicio y el detector declarado no la alcanza (la
re-verificación del §1.3 se mide el día del corte, antes del cobro, y *«una consulta que lista»*
no tiene quién ni cuándo la corra). Pero depende de un comportamiento del proveedor sin medir o de
una reversión observada en pocos casos, sobre una población de un solo día; y la salvedad 4 del
barrido sí ve, a los 3 días, el preapproval que volvió a vivir. Es el candidato más cercano a CRÍT
y el §4 dice por qué no se propone.

**Juan.**

1. El 25/11 rechaza la renovación de Juan en el sistema viejo; el registro queda reintentando.
2. El 05/12 el paso 1b cancela su preapproval, el paso 2 lo relee `cancelled` y el paso 4 le
   escribe la lápida. El owner lo llama: arranca de cero con trial.
3. El 12/12 Juan hace caso al correo del proveedor y cambia la tarjeta; el reintento cobra.
4. El handler nuevo asienta el `payment` sobre la lápida sin marca. Nadie lo lista, y la lista con
   la que el owner llamó es del 05/12.

**Qué hace falta decidir.** Decisión del owner, porque es `G3-1` con otra población: *¿se sostiene
«no devolver» si la población real es todo cliente del viejo con un registro abierto o una
cancelación que se deshace, durante un ciclo después del corte?* Antes de eso hay dos mediciones
del paso 0 que la podrían achicar: si cancelar un preapproval corta el reciclado de un registro
abierto, y si una cancelación releída horas después sigue `cancelled`. Después es aplicación: la
población leída de la re-verificación y no fija, un detector que corra **después** del corte (la
consulta de lápidas con `payment`, con fecha y dueño), y la exención de las terminales atada a
que el registro del ciclo haya cerrado.

### R3 · La ventana entre el paso 3 y el paso 4 del corte no está gobernada — ALTA, 2 agentes

El handler nuevo recibe webhooks desde que el paso 3 apunta la URL; las lápidas del corte recién se
siembran en el paso 4. El corte razona como si el viejo tragara todo desconocido, pero el código
viejo **devuelve 500 a propósito** a un cobro que no resuelve (HOS-276), y todo evento del rollout
falla y se reentrega. Ese reintento llega al handler nuevo **antes** de la lápida del corte: el
handler escribe una **lápida de recepción** con `PAGO_TARDÍO_RECHAZADO` (propuesta devolver, lo
opuesto a `G3-1`), y después el paso 4 choca con el `UNIQUE` del `provider_link`. Qué hace la
herramienta ante ese choque no está escrito, y el paso 4 es condición del paso 5, ya pasado el punto
de no retorno.

- `F-8V2B3-003` ALTA · `F-8V2C2-002` ALTA
- Convergencia exacta: los dos citan la misma línea del rollout (`16-fase-7…:146`) y el mismo par
  de consecuencias. `C2` agrega el mecanismo del viejo (el 500 del handler de cobros contra el
  `local_row_not_found` del de estado).

**Severidad.** ALTA. El daño de plata va **a favor** del cliente (se le propone devolver lo que
`G3-1` decidió no devolver) y lo confirma una persona; el daño operativo es un corte trabado con
las altas cerradas. Contradicción que dos implementadores de la herramienta resuelven distinto.

**Juan.**

1. Un cobro del preapproval de Juan que sólo conocía el proveedor entra durante el 1b; el viejo
   responde 500 y Mercado Pago programa el reintento.
2. El paso 3 apaga el viejo y apunta la URL al nuevo.
3. A los 35 minutos llega el reintento: sin lápida del corte, el handler escribe la de recepción
   con la marca de devolver.
4. El paso 4 choca con el `UNIQUE`. Según la herramienta, el corte se traba con las altas
   cerradas, o sigue y alguien le devuelve a Juan un cobro que el owner decidió no devolver.

**Qué hace falta decidir.** Aplicación, con una elección de orden que conviene mostrarle al owner:
sembrar las lápidas antes de apuntar la URL, que el handler consulte el manifiesto del 1b, o que la
herramienta del paso 4 convierta una lápida de recepción en lápida del corte. Y la regla de la
herramienta ante un `provider_link` que ya existe, más si 3b y paso 4 se pueden correr dos veces.

### R4 · El cobro de única vez no tiene identidad de pedido, ejecutor de recuperación ni detector — ALTA, 2 agentes

El addon `UNA_VEZ` se cobra por `/v1/orders`, idempotente **sólo por la clave** (`EX-41`), y la
clave se acuña **por llamada**. De ahí salen tres huecos de la misma causa:

- **nadie reenvía** la orden sin respuesta: `B/16` da la recuperación por cerrada (*«se reenvía con
  la misma clave»*) en voz pasiva, sin actor; el barrido de creaciones busca preapprovals; y `A3`,
  sobre la de única vez, no relee nada antes de abandonar (`F-8V2B1-003`, `F-8V2B2-004`);
- **nada identifica el pedido**: dos clics, dos `A1`, dos claves, dos órdenes, dos cobros; la
  instancia no tiene candado (`F-8V2B2-003`);
- y en los dos casos **no hay detector ni camino de devolución**: el pago de única vez no admite
  marca ni lo ve la conciliación, y `S36` sólo alcanza suscripciones.

La última parte **está declarada con verdad** en el «NO cierra» de `B/16`:

- `B/16:963` — «su pago no lo ve la conciliación ni admite una marca»

Lo que no está declarado es que la recuperación no tiene ejecutor (el mismo ítem la da por
cerrada) ni el doble clic.

- `F-8V2B1-003` ALTA · `F-8V2B2-003` ALTA · `F-8V2B2-004` MEDIA → **ALTA** (propuesta, §4)
- `B1-003` y `B2-004` son el mismo hallazgo con dos severidades; los dos citan el mismo silencio
  (`B/16:94-98`, `:963`, `B/05:74`).

**Severidad.** ALTA. Plata perdida (paga y no recibe) o cobrada de más (dos cobros), sin detector,
en caminos plausibles que no son el principal (timeout o muerte del proceso; doble clic).

**Juan.**

1. Juan compra «Boost 7 días»; la página tarda y aprieta dos veces *«pagar»*.
2. Nacen dos instancias, dos claves, dos órdenes: Mercado Pago cobra dos veces.
3. Ningún barrido ve pagos de única vez y ninguno admite marca. Sólo aparece si Juan reclama, y
   entonces no hay acto que le devuelva el segundo cobro.

**Qué hace falta decidir.** Aplicación: de dónde sale la clave (del pedido del cliente y no de la
llamada) y qué identifica *este* pedido sin impedir una recompra legítima; quién recorre las
claves persistidas sin resultado y cuándo, o que `A3` reenvíe con la misma clave antes de
abandonar; y qué acto devuelve un pago de única vez cuando corresponde. Este último punto amplía el
«NO cierra» de `B/16`, así que el owner tiene que verlo: hoy el pago de única vez **no tiene camino
de devolución**, no sólo de detección.

### R5 · El hecho 4 lo escribe billing en verticales, fuera del contrato y sin unidad — ALTA, 2 agentes

`B/10` §4.3 le asigna al barrido del día del fin de servicio (de `B12`, billing) escribir
`listing.inactiva_desde` en cada ficha de la vertical —el hecho 4 del reloj—, correr `PB2` e
invalidar el caché. El contrato dice que la única escritura de billing en verticales es
`extenderTrial` y que cualquier otra es filtración. Las descomposiciones no le dan a esa escritura
ninguna unidad: `B12` se lleva el barrido *«que invalida el caché»*, `V3` la invalidación, y la
fila de `V9` nombra los ejecutores de los hechos 5 y 6 pero no el del 4. Además `C1` encuentra que
nadie escribe `vertical.fin_de_servicio`, y que su fórmula lee fechas de cobro que el contrato no
deja cruzar.

- `F-8V2A3-001` ALTA · `F-8V2C1-001` ALTA
- Convergencia: `A3` llega desde el glosario y las descomposiciones; `C1` desde la regla de
  vigilancia del contrato y la tabla de dependencias de `B12`. Los dos citan la misma línea del
  glosario sobre el daño (`01-glosario.md:182`).

**Severidad.** ALTA, y se consideró CRÍT (§4): el daño es **datos borrados sin detector** (el hard
delete hasta 90 días antes de la fecha prometida) y dos agentes ciegos lo ven. No se propone porque
`B/10` §4.3 asigna la escritura **con todas las letras** al barrido de `B12`, que es el capítulo de
esa unidad, y la regla del contrato es de vigilancia, no un guard:

- `B/10:314` — «le escribe `listing.inactiva_desde` a cada ficha de la vertical»
- `$D/12-contrato-de-cobertura.md:1161` — «Se mira, no se resuelve en el lugar.»

Es una contradicción que dos implementadores resuelven distinto con daño: ALTA por definición.

**Juan.**

1. Juan tiene una ficha de Gastronomía sin cobertura; `PB4` la archivó hace 80 días.
2. El owner anuncia la discontinuación y los tres avisos le prometen hasta cuándo puede exportar.
3. En el fin de servicio, un `B12` construido contra el contrato no escribe `inactiva_desde`, y
   `V9` tampoco, porque cree que es de billing.
4. Diez días después `PB9` borra el contenido y la ficha queda `PURGED`. Juan va a exportar en la
   fecha prometida y la ficha no existe. Ningún detector lo señala.

**Qué hace falta decidir.** Decisión del owner, porque cambia el contrato (`DEC-ARCH-006`): *¿la
escritura del hecho 4, la corrida de `PB2` de ese día y la invalidación siguen en billing y entran
al §4.1 como segunda escritura declarada, o el fin de servicio pasa a ser un hecho que billing le
da a verticales y verticales ejecuta?* Y quién escribe `vertical.fin_de_servicio`, con qué dato de
billing y por qué pregunta cruza. El texto vigente de `B/10` sugiere lo primero. Después es
aplicación: la fila de la unidad que lo construye y la flecha de dependencia que falta.

### R6 · La rama de aborto declara que no queda nada externo que el backup no restaure — ALTA, 2 agentes

La rama de aborto restaura el backup del 2b y afirma que lo único del proveedor que el backup no
puede pisar es la sonda de la entrega:

- `$D/16-fase-7-del-paraguas.md:277` — «Lo que el backup no puede pisar es un objeto del proveedor, y no hay ninguno»

Dos agentes encuentran, cada uno, un objeto externo más que el paso 3 ya tocó y el aborto no
devuelve:

- las `L1` nacen `PURGED` *«con el contenido borrado como en `PB12`»*, y `PB12` borra las fotos del
  almacenamiento externo y revoca en el proveedor el token del calendario; eso corre en el paso 3,
  antes de saber si el paso 3 queda sano (`F-8V2A3-002`);
- el paso 3 apunta la URL de notificación del proveedor al handler nuevo, y la rama de aborto
  reenciende el webhook viejo **sin devolver la URL**: quien se re-suscribe por el link reactivado,
  como la propia rama le pide, paga y el viejo nunca lo vincula (`F-8V2C2-001`).

- `F-8V2A3-002` ALTA · `F-8V2C2-001` ALTA
- `C2-001` queda condicionado a que la ruta nueva sea distinta de la vieja; el corte dice *«la
  ruta del handler nuevo»* y no fija el path.

**Severidad.** ALTA. Plata cobrada sin asiento (`C2`) y datos borrados sin detector (`A3`), en un
camino plausible que no es el principal: la rama de aborto.

**Juan.**

1. El paso 3 apunta la URL al handler nuevo; el 3b falla y se aborta.
2. Se restaura el backup y se redespliega el viejo; nadie toca la URL.
3. Juan, cancelado en el 1b, se re-suscribe por el link del plan reactivado. Mercado Pago no le da
   trial y le cobra en el acto.
4. El aviso va a la ruta nueva, que no existe en la imagen vieja; se pierde. El viejo nunca vincula
   el preapproval: Juan paga cada mes con la ficha abajo.

**Qué hace falta decidir.** Aplicación: un inventario de lo que el paso 3 cambia afuera de la base
(URL de notificación, almacenamiento de medios, tokens de calendario, la sonda) con su inverso en la
rama de aborto, verificado como el apuntado; o mover el borrado externo de las `L1` después del paso
5, cuando ya no hay aborto. Si alguna pérdida se acepta, se declara con su población.

### R7 · La identidad de Partner se ancla en un correo que nadie probó — ALTA, 2 agentes

La postulación de Partner usa el correo escrito en un formulario público para dos cosas que
necesitan un correo **probado**: el reclamo vincula el Partner aprobado al **usuario que ya tiene
ese correo**, verificado o no, y ese usuario puede cambiarlo sin verificar el anterior y llevarse el
vínculo (`F-8V2A1-003`); y la guarda de `PP1` rechaza por correo (una `PENDIENTE` o una espera tras
un rechazo), así que un tercero bloquea al dueño real cargando su dirección, y dos envíos simultáneos
pasan porque la guarda no es restricción de la base (`F-8V2A2-005`).

- `F-8V2A1-003` ALTA · `F-8V2A2-005` MEDIA
- Convergencia: `A1` llega por la autorización (a qué cuenta vincula), `A2` por la máquina (qué
  bloquea la guarda). Los dos citan el mismo §2.7 de `V/02` y el mismo §2.4 de `V/18`.

**Severidad.** ALTA, por `A1-003`: acceso indebido a un Partner aprobado (con su plan y su método
de cobro) en un camino plausible. `A2-005` es denegación de servicio sin plata: MEDIA.

**Juan.**

1. Juan registra una cuenta con `maria@negocio.com` y no la verifica.
2. María se postula con esa dirección; el admin aprueba y el aviso de reclamo va a esa casilla.
3. María reclama. El Partner queda en la cuenta de Juan, que después cambia su correo y se lo lleva.

**Qué hace falta decidir.** Aplicación con una pregunta de producto adentro: a qué cuenta vincula
el reclamo si el usuario del correo no lo verificó (el reclamo lo verifica, exige iniciar sesión, o
trata la dirección como de nadie), si el cambio de un correo nunca verificado puede llevarse un
vínculo, y si la guarda de `PP1` mira un correo probado o el admin puede anular la espera.

### R8 · El handler de desconocidos no consulta el manifiesto de sondas — MEDIA, 2 agentes

El corte exceptúa del 1b a las sondas con una medición abierta y describe sus cobros *«siguientes»*.
Desde `X-1` el handler que escribe una lápida de recepción **cancela el preapproval en el mismo
acto**: la sonda eximida muere en su primer evento y la medición se pierde. Lo mismo le pasa a la
sonda de la entrega del paso 3, que además abre una marca en producción.

- `F-8V2B3-004` MEDIA · `F-8V2C2-005` MEDIA
- `C2` lo anota también en su «fuera de mi vector» (la sonda de la entrega).

**Severidad.** MEDIA: no mueve plata de un cliente; obliga a adivinar si el handler respeta el
manifiesto.

**Juan.** Juan es el owner: deja viva la sonda que mide `GR-2`; tras el corte cobra, el handler no
la conoce, la cancela, y la fila de la matriz queda `UNKNOWN` sin sujeto, con una marca que le
propone devolverse su propio cobro.

**Qué hace falta decidir.** Aplicación: que los ids del manifiesto (y la sonda de la entrega)
queden exceptuados de la cancelación de `X-1`, o que el §4.2 deje de prometer cobros siguientes y
diga que el corte termina toda medición abierta.

### R9 · `listing` no está mapeado al esquema físico que existe hoy — MEDIA, 2 agentes

Los dos agentes midieron `packages/db` y llegan al mismo hueco desde dos lados. El diseño tiene una
sola entidad `listing`, pero no escribe si es una tabla nueva o columnas sobre las tres actuales,
y la traducción del corte está escrita sobre `accommodations`: gastronomía y experiencia no tienen
las columnas de `L5` y `L7`, y el *«cero filas»* es una medición que vence con `DEC-MIG-002`
(`F-8V2A3-003`). Y `PURGED` promete tratar *«uno por uno»* lo que cuelga de la ficha y enumera
dos, cuando el esquema actual tiene además conversaciones (con `restrict`), alertas de precio,
promociones, listados y reputación externos, ocupación y datos de IA (`F-8V2A2-006`).

- `F-8V2A3-003` MEDIA · `F-8V2A2-006` MEDIA
- Repite la familia de `F-8V1A3-010` (las reseñas en `PURGED`), con una lista más larga.

**Severidad.** MEDIA: obliga a adivinar; en el corte, la opción mala falla en el paso 3 y cae en
la rama de aborto.

**Juan.** Juan, turista, tenía una alerta de precio y una conversación sobre la ficha de Ana; la
ficha llega a `PURGED`. El job de alertas sigue evaluando una ficha sin precio y su bandeja muestra
una conversación sobre algo que no existe. Nadie decidió qué pasa.

**Qué hace falta decidir.** Aplicación con una pregunta del owner adentro: la correspondencia de
`listing` con las tablas actuales y la regla para una fila de gastronomía o experiencia en el
recuento (o que el corte frene si no da cero); y la lista cerrada de lo que cuelga de `listing` con
su tratamiento en `PURGED`. Qué pasa con datos de terceros (conversaciones, alertas) es del owner
(`DEC-DATA-005`), como las reseñas en la vuelta 1.

### R10 · La acción administrativa 15 quedó a medio especificar — MEDIA, 2 agentes

La acción 15 (editar el contenido de lo ajeno) entró al catálogo de `NUCLEO/08` §3 sin dos de sus
piezas. Promete *«el aviso de la fila 1 del cap. 19»*, y esa fila de `V/19` §4 es el botón Empezar
de Turista: no hay aviso definido (`F-8V2D1-002`). Y la regla 3 la declara capacidad del actor,
con los pasos 6 y 7 sobre un admin que no tiene conjunto: leída literal es inejecutable, leída como
«el permiso ya es la capacidad» deja al admin cargar contenido por encima del cupo del dueño
(`F-8V2A1-004`).

- `F-8V2A1-004` MEDIA · `F-8V2D1-002` MEDIA
- `A1-001` cita el mismo aviso de la fila 1 como si existiera, sin ver que apunta a otra cosa.

**Severidad.** MEDIA: obliga a adivinar; ningún camino mueve plata.

**Juan.** Soporte le restaura a María 25 fotos con un plan de 10; según la lectura, la acción no
corre o la ficha queda por encima del cupo sin cortesía ni plata, y María no recibe ningún aviso de
que alguien tocó su ficha.

**Qué hace falta decidir.** Aplicación: si los pasos 6 y 7 de la acción 15 se evalúan sobre el
sujeto (el dueño), y qué fila de `V/19` §4 y qué entrada de `NUCLEO/07` §6 es su aviso (o corregir
la frase si no lleva).

### R11 · El ancla de un grant no tiene de dónde resolver su plan — MEDIA, 2 agentes

El piso del grant es *«la versión de ese plan vigente el día que se firmó»* y lo escribe billing,
pero ninguna pregunta del §4.1 contesta *«cuál es la versión vigente del plan P»* ni *«el vendible
de `rank` más alto»*: `políticaDePlan` recibe una versión, y `rank` vive en verticales
(`F-8V2C1-004`). La herramienta del 3b tiene además una frase que pide anclar un plan de Alojamiento
*«en la vertical en que tenían comp»*, que sólo es coherente si las dos cortesías eran de
Alojamiento (`F-8V2B3-009`).

- `F-8V2C1-004` MEDIA · `F-8V2B3-009` BAJA
- Los dos atacan `16-fase-7…:130`. Repite la segunda pregunta de R8 de la vuelta 1 (*«¿quién
  resuelve la versión vigente del grant?»*), que no llegó al §4.1.

**Severidad.** MEDIA: obliga a adivinar; la mala lectura deja un piso más generoso para siempre o
lleva el 3b a la rama de aborto.

**Juan.** La pantalla del admin, abierta desde antes de Premium v3, le manda a billing la v2; billing
no puede comprobarlo sin leer `plan_version` y guarda v2. Juan queda con 30 fichas para siempre
donde se quería regalarle 20.

**Qué hace falta decidir.** Aplicación: una pregunta del §4.1 que devuelva la versión vigente (o el
vendible de `rank` más alto) de una vertical, o la regla de que billing valida con
`políticaDePlan(v).vigente`; y la frase del 3b corregida.

### R12 · El censo de emisores del aviso enumera filas, no la regla — MEDIA, 2 agentes

El contrato define como emisor *«toda escritura que cambia la respuesta»*, pero su censo nombra
filas sueltas, y le faltan dos: `T6`, `T7` y `T8`, que sacan la fuente de pre-trial
(`F-8V2A2-008`, `F-8V2C1-007`), y el **anclaje de una vertical nueva a un grant**, que el catálogo
de `NUCLEO/08` §3 tiene como acto y `V/02` §3.2 cuenta como cambio de cobertura (`F-8V2C1-003`).

- `F-8V2A2-008` BAJA · `F-8V2C1-007` BAJA · `F-8V2C1-003` MEDIA
- Convergencia a tres: `A2` y `C1` lo dan BAJA, y `D1` lo vio y lo descartó por la misma razón (la
  fuente que desaparece es `BASE` y el caché se invalida por *«toda transición de la máquina de
  trial»*). El anclaje es otra cosa: ahí sí cambia `cubierto`.
- Repite R9 de la vuelta 1 (el censo de emisores), con dos filas nuevas afuera.

**Severidad.** MEDIA por `C1-003`: sin aviso del anclaje, `PB3` se atrasa un día y `T2` no dispara
nunca. `T6`–`T8` hoy no tienen daño: BAJA.

**Juan.** Juan tiene un trial en Gastronomía; el `SUPER_ADMIN` le ancla Gastronomía a su grant
*Free Forever*. No sale aviso, el trial sigue, `T3` lo vence y le manda *«tu prueba venció,
suscribite»* a alguien a quien le acaban de regalar la vertical.

**Qué hace falta decidir.** Aplicación: el censo escrito como regla con la forma del de
consumidores, o completo (anclaje, `T6`–`T8`), y una pasada por el catálogo de `NUCLEO/08` §3 buscando
otros actos que cambien la respuesta.

### R13 · Una corrección que no llegó a la frase vecina — BAJA, 3 agentes

Tres textos vencidos, de tres agentes, con el mismo mecanismo: una corrección se aplicó en un lugar
y la frase de al lado quedó con la versión anterior.

- `F-8V2A2-007`: `T3` dice que arranca *«el reloj de retención»*, que desde el hecho 5 no es efecto
  suyo; seguido al pie de la letra pone `G-R6-B` en rojo.
- `F-8V2A3-006`: `V/21` §2.4 afirma y niega en el mismo párrafo que `PB2` corre sobre las fichas
  del corte.
- `F-8V2C2-007`: el paso 2 cita `RC-2` para *«leer por id es confiable»*, y eso es `RC-1`.

**Severidad.** BAJA: texto vencido.

**Juan.** El implementador de `V4` escribe `inactiva_desde` desde `T3` y `G-R6-B` lo rechaza como
escritor fuera de la lista.

**Qué hace falta decidir.** Aplicación: tachar o corregir las tres frases.

### R14 · La precisión 7 y el sujeto sin anclar abren lo ajeno — ALTA, 1 agente

La precisión 7 hace *existir* lo ajeno público para quien no es dueño, y está escrita pensando en
el turista que lee, pero su texto no la acota a lecturas. Una escritura con `actor = sujeto ≠
dueño` sobre una ficha `PUBLISHED` ajena no tiene regla que la pare: las cinco reglas del §3.2
disparan con `actor ≠ sujeto` (`F-8V2A1-001`). En el mismo eje, nadie escribe de dónde sale el
sujeto (la precisión 6 lo hizo para la vertical) ni qué permiso autoriza una **lectura** con
`actor ≠ sujeto`: las quince acciones con permiso son escrituras, y el §3.5 saca del paso 6 la
lectura *«de lo propio»* del sujeto que el pedido elige (`F-8V2A1-002`).

- `F-8V2A1-001` ALTA · `F-8V2A1-002` ALTA

**Severidad.** ALTA. Es **acceso indebido**, que es clase de CRÍT, pero en su forma de
contradicción: exige que el implementador ignore la tercera pregunta explícita del paso 4 y el marco
de lectura del párrafo. El §4 dice por qué no se propone subir.

**Juan.** Juan, host pago de Alojamiento, manda «editar ficha» con el id de la ficha publicada de
María. Actor y sujeto son Juan; la precisión 7 hace existir la ficha; los pasos 5 a 7 pasan con su
propio plan. La descripción de María cambia y nadie le avisa.

**Qué hace falta decidir.** Aplicación: la precisión 7 vale sólo para operaciones que no escriben
(y una escritura exige `sujeto = dueño`), qué contesta una escritura ajena sobre lo público; la
regla simétrica de la precisión 6 para el sujeto (para un no-admin, `sujeto = actor` y el pedido no
decide); qué permiso concreto autoriza cada inspección del §48; y el caso de `V5` sobre `PUBLISHED`,
incluida la compra de un addon `LISTING` sobre una ficha ajena.

### R15 · Quien paga sin pasar por `PB1` conserva el trial — ALTA, 1 agente

`T6` y `T8` son las dos filas que consumen el trial de quien ya es cliente, y las dos cuelgan del
evento de activación (`PB1`). El dueño del corte que contrata por teléfono nunca hace un `PB1`: sus
fichas vuelven solas por `PB3`, y el diseño dice dos veces que restituir no es publicar. Queda
pagando en `PRE_TRIAL` sin fila; el día que cancela y publica, `T1` le regala un trial entero, que
es la puerta que `T6` existe para cerrar (`F-8V2A2-001`). La carrera `T6`/`T8` contra un `PB1` en
vuelo llega al mismo estado, porque *«el lock de la máquina de trial»* se nombra y no se define
(`F-8V2A2-002`).

- `F-8V2A2-001` ALTA · `F-8V2A2-002` MEDIA
- Vecino por el desenlace, con otra causa: si el aviso sale dentro de la transacción (R16), `T8`
  tampoco dispara.

**Severidad.** ALTA: es el procedimiento que `V/21` §2.4 describe para toda la cartera del corte.
El daño es un trial regalado a un ex-cliente, no un cobro de más; y `2g` ya le regala a esa cartera
un trial, así que la pregunta es si se lo guarda para después.

**Juan.** Juan contrata por teléfono, sus fichas vuelven por `PB3`, paga ocho meses y cancela. Dos
meses después publica un borrador sin cobertura: `T1` le arranca un trial premium gratis.

**Qué hace falta decidir.** Decisión del owner, porque es la ejecución de `2g`: *¿la vuelta de una
ficha por `PB3`/`PB7` bajo un título que convierte cuenta como ejercicio del evento para `T8` (sin
que restituir pase a ser publicar para `T1`), o la cartera del corte que contrata sin publicar
conserva su trial para después de cancelar, dicho en el ⚠️ de `2g`?* Después es aplicación: qué es
el lock de la máquina de trial y si coincide con el de publicación.

### R16 · El emisor lee «en el mismo acto», la frase que el contrato tachó — ALTA, 1 agente

El contrato fija que el aviso sale **después del commit** y explica por qué: emitido dentro de la
transacción, el consumidor relee el estado viejo y el evento se consume sin efecto *«en todo
borrado»*. Pero la tabla de `B/03` §3.2, que es lo que lee quien emite, dice *«en el mismo acto»*,
y la frase que abre el censo en el propio contrato dice lo mismo. Ningún criterio de `B4` prueba el
orden. Si se emite dentro, `T2`, `T5` y `T8` no disparan nunca y `PB2`/`PB3` se atrasan un día.

- `F-8V2C1-002` ALTA

**Severidad.** ALTA: contradicción entre el emisor y el contrato que convierte un residuo declarado
en el camino principal.

**Juan.** Juan está en trial y se suscribe a Básico; `P1` emite dentro de su transacción, la
máquina de trial lee `cobrada: no` y consume el aviso. Diez días con trial premium y Básico sumados;
`T3` vence el trial y le manda la campaña de recuperación a un cliente que paga.

**Qué hace falta decidir.** Aplicación: `B/03` §3.2 y la frase del censo con *«después del commit»*,
y un caso de `B4` donde el consumidor relee justo después del aviso y ve el estado nuevo.

### R17 · La sucesora que vive del crédito no tiene período — ALTA, 1 agente

`DEC-SUB-006` convierte lo pagado sin usar en días de la sucesora corriendo su primer cobro, y
mientras dura ese crédito la sucesora no tiene ningún `covered_period`. Tres fórmulas leen
`covered_period` y le cortan lo pagado: `S11` fija el fin de servicio **en el acto** (el owner lo
cerró el 25/09 pensando en la ventana de 72 h, y el crédito dura semanas; `F-8V2B1-002`), la
cortesía re-emitida por `S9` se come el crédito (`F-8V2B1-004`), y `S36` no tiene *«último pago
acreditado»* que devolver (`F-8V2B1-005`).

- `F-8V2B1-002` ALTA · `F-8V2B1-004` MEDIA · `F-8V2B1-005` MEDIA

**Severidad.** ALTA por `B1-002`: plata perdida en un camino plausible (upgrade o arrepentimiento y
después baja), contra lo que la pantalla de baja promete.

**Juan.** Juan paga el día 1, pide la baja el 2, vuelve el 3 por el checkout (el crédito corre su
primer cobro al 31) y el 5 vuelve a pedir la baja: `S11` corta el servicio ese día. Pagó hasta el
31 y recibió hasta el 5; ninguna marca lo recoge.

**Qué hace falta decidir.** Decisión del owner, porque reabre lo que cerró el 2026-09-25 sobre
`S11`: *¿el crédito de `DEC-SUB-006` cuenta como período pagado para la baja, o esa baja se avisa
como pérdida antes de confirmar?* Después es aplicación: cuándo se re-emite la cortesía diferida
(al autorizar o al agotarse el crédito) y qué pago devuelve `S36` sobre una sucesora sin pagos (el
de la predecesora por `sucedida_por`).

### R18 · Una transición que cancela antes de escribir y pierde la carrera — ALTA, 1 agente

`S6` (y `S3`) manda la cancelación del preapproval **y después** escribe. Si en el medio entra el
pago (`S5`) o la autorización (`S2`) y sube la versión, la escritura de `S6` choca, relee `ACTIVE` y
no escribe; la cancelación ya salió. `S5` no relee el preapproval (a diferencia de `S7`), y el
espejo del §10.1 corta la fila `ACTIVE` con preapproval `cancelled` como baja del proveedor, sin
marca, con el período recién cobrado adentro.

- `F-8V2B2-001` ALTA
- Repite la familia de `F-8V1B2-004` (*«`S6` escribe después de la llamada y el espejo de su propio
  aviso lo gana»*), ahora con el pago ganando la carrera.

**Severidad.** ALTA: plata cobrada sin servicio, sin marca, en un camino plausible. `GR-1` midió que
cambiar la tarjeta dispara el reintento en uno o dos minutos, y la superficie del grace le dice a
Juan que la cambie.

**Juan.** Juan cambia la tarjeta el último día de grace; el barrido corre `S6` y manda cancelar;
el reintento entra y `S5` pasa la fila a `ACTIVE`; `S6` pierde la escritura; el aviso de
`cancelled` espeja la baja. Juan pagó y amanece con la ficha abajo.

**Qué hace falta decidir.** Aplicación: que la reevaluación del §10.3 mire el efecto remoto que ya
salió, o que `S5` y `S2` relean el preapproval y caigan en `CANCEL_SCHEDULED` como `S7`; y si el
espejo sobre una fila con `covered_period` vigente puede cortar sin marca.

### R19 · La fila de `refund` no sabe qué devolución del proveedor es la suya — ALTA, 1 agente

La fila de `refund` guarda un monto y ningún identificador de la devolución del proveedor, y pasa a
`EXECUTED` cuando *«la relectura del pago muestra la devolución acreditada»*. Con parciales (que
`RF2` produce ante un `2084`) un implementador asienta de más y otro deja la fila colgada, y el
barrido sólo detecta *«más reembolsado que nuestros `refund`»* (`F-8V2B2-002`). Con el aviso
perdido, nadie relee un `CONFIRMED`: el barrido lo toma como devolución fuera del flujo y la
persona asienta un `RF4` que duplica la fila (`F-8V2B2-005`).

- `F-8V2B2-002` ALTA · `F-8V2B2-005` MEDIA
- `D1` anota en su «fuera de mi vector» otro caso de la misma familia: `S36` en `GRACE_PERIOD` con
  un pago retenido por `S19` abre dos caminos de reembolso sobre el mismo pago.

**Severidad.** ALTA por `B2-002`: a Juan le falta plata y ningún detector lo ve.

**Juan.** Juan revoca; `RF1` por 15.000; el total da `2084` y se parte en dos de 7.500; el segundo
vuelve a fallar. La relectura muestra *una* devolución; una implementación asienta 15.000, el pago
queda `REFUNDED` y Juan recibió 7.500. El barrido no abre nada.

**Qué hace falta decidir.** Aplicación: qué identifica a una devolución dentro de una fila (o una
fila por parcial), qué monto suma `RF3`, qué estado toma una devolución a medias, quién relee un
`CONFIRMED` sin aviso, y qué detecta *«menos devuelto que lo asentado»*.

### R20 · La comparación de monto mira el preapproval y no el cobro, y sin reglas — ALTA, 1 agente

El barrido compara el monto esperado contra el `transaction_amount` **del preapproval**; nadie
compara el importe que el proveedor **cobró** (`P1` acredita cualquiera y decrementa la promo), y
la única comparación contra el esperado del período, la del `B/05` §3, no corre sobre una fila que
puede recibir el cobro. Un cobro de más en un ciclo con el preapproval ya corregido es invisible
(`F-8V2B3-001`). La comparación que sí existe tampoco está bien acotada: marca a toda fila viva
cuyo preapproval ya está cancelado cuando hay un aumento (`F-8V2B3-007`), y no tiene regla de
redondeo para montos derivados en centavos (`F-8V2B3-008`).

- `F-8V2B3-001` ALTA · `F-8V2B3-007` MEDIA · `F-8V2B3-008` MEDIA
- Vecino: `B2` anota en su «fuera de mi vector» la carrera entre la mutación de `S30` y la de un
  downgrade, y la da por cubierta por esta comparación, que es la que `B3-001` muestra ciega al
  importe cobrado.

**Severidad.** ALTA por `B3-001`: plata cobrada de más sin detector, en un camino que depende de un
comportamiento del proveedor sin medir (qué importe usa un registro ya creado cuando la mutación
cae en medio).

**Juan.** Juan canjea un 50 % minutos antes del lote; el registro del ciclo, creado antes, cobra
30.000; `P1` acredita, gasta la promo y `S30` restaura el monto. Al otro día el barrido ve 30.000
contra 30.000 y no marca nada.

**Qué hace falta decidir.** Aplicación con una medición: si `P1` (o el barrido) compara el importe
cobrado contra el esperado del período y con qué motivo marca; si la promo se decrementa sólo sobre
un cobro con descuento; que la comparación no corra sobre preapprovals `cancelled`; una regla única
de redondeo; y medir en el paso 0 qué importe cobra un registro ya creado.

### R21 · La población a avisar sale de la base y el censo del proveedor — ALTA, 1 agente

El censo del 1b sale del proveedor porque la base no ve todas las autorizaciones (ya se encontró
una viva, creada desde un link de plan). Pero la población a avisar y la lista con la que el owner
llama salen de la base. El titular de una autorización que sólo conoce el proveedor se cancela sin
llamada, sin correo del viejo (`local_row_not_found`) y sin estar en el detector de `G1-4`, que se
apoya en que *«el aviso previo lo dice»*.

- `F-8V2C2-003` ALTA
- Vecino de R2: las dos son declaraciones del corte con una población que no es la real.

**Severidad.** ALTA: plata cobrada por un período cortado, sin asiento ni aviso, en un camino
plausible (hay al menos un caso medido).

**Juan.** Juan se suscribió por el link público y el vínculo del viejo falló. El día del corte no
aparece en la población; el 1b lo cancela; el viejo no le manda correo; pagó un mes que no usa y
nadie de Hospeda lo contacta.

**Qué hace falta decidir.** Aplicación, o declaración con causa: que el manifiesto del 1b traiga el
pagador (`payer_email`) y esa persona entre a la población a avisar, o que se declare que se la
cancela sin aviso, con su población.

### R22 · Transiciones de verticales fuera del lock o con guarda sin fecha — MEDIA, 1 agente

La regla del lock de `V/03` §9 clasifica las transiciones en las que ocupan cupo y las que lo
liberan; `PB8`, `PB9` y `PB11` no están en ninguna, y `PB9` (el hard delete, irreversible) comparte
`desde` con `PB7` y `PB8` y corre el mismo día que el aviso imprime (`F-8V2A2-004`). Y `T4` mira el
estado y no la fecha: con el job de `T3` atrasado, un canje revive un trial vencido cuya fuente el
contrato ya había apagado (`F-8V2A2-003`).

- `F-8V2A2-004` MEDIA · `F-8V2A2-003` MEDIA
- Repite la nota de la vuelta 1 sobre `F-8V1A2-008`/`-009`: la regla del lock se aplicó a las
  transiciones de cupo y no a sus vecinas.

**Severidad.** MEDIA: carreras de borde. `A2-004` toca un borrado sin detector, pero exige que el
dueño actúe en el mismo minuto que el job.

**Juan.** El día que el aviso le fijó como fecha de borrado, Juan reactiva la ficha en el mismo
minuto en que corre `PB9` sobre su lectura vieja: el contenido se borra.

**Qué hace falta decidir.** Aplicación: si `PB9` toma el lock y relee adentro (o la regla general
de verificar el `desde` en la misma escritura), a qué lista van `PB8` y `PB11`, y si la guarda de
`T4` exige que la fecha de fin no haya pasado.

### R23 · El seudónimo del correo no tiene función escrita — MEDIA, 1 agente

Todo el trial de por vida y la pregunta 5 al abogado descansan en un *«seudónimo determinístico del
correo normalizado»* que ningún capítulo define: ni función, ni clave, ni qué pasa si la clave rota,
ni en qué dominios se sacan los puntos.

- `F-8V2A3-004` MEDIA

**Severidad.** MEDIA: obliga a adivinar, y dos de las respuestas cambian lo que se le pregunta al
abogado.

**Juan.** Se redeploya con el secreto del HMAC regenerado: Juan, que borró su cuenta después de su
trial, vuelve con el mismo correo y recibe otro.

**Qué hace falta decidir.** Aplicación, y después revisar el pliego legal: la función, la clave y
su rotación, y el alcance de la normalización.

### R24 · Retirar todos los planes no cierra la vertical a trials — MEDIA, 1 agente

`B/10` §4.1 afirma que retirados todos los vendibles la vertical *«queda cerrada a altas»*, pero
retirar un plan no escribe `vertical.admite_altas`, y `T1` mira la columna: con cero vendibles,
`T1` dispara y la derivación del plan de trial no tiene de dónde salir.

- `F-8V2A3-005` MEDIA

**Severidad.** MEDIA: obliga a adivinar; quema el único trial de una persona.

**Juan.** El owner retira los tres planes de Gastronomía para relanzar; Juan publica y se le consume
el trial de por vida sin haber probado nada.

**Qué hace falta decidir.** Aplicación: que `T1` exija una versión vigente y vendible, o que retirar
el último escriba `admite_altas = no`; y corregir `B/10` §4.1.

### R25 · Qué corre al asentar un cobro sobre una lápida — MEDIA, 1 agente

El cobro sobre una lápida *«se asienta»*, pero no está escrito si es `P1` entero. `P1` emite
comprobante y, siendo el primer pago de la fila, el aviso de cobertura con usuario y vertical, que
la lápida no tiene. Si el aviso falla dentro de la transacción, el `payment` no se escribe, y ése es
el único detector que `G3-1` declara.

- `F-8V2B3-005` MEDIA
- Vecino de R2: si este asiento falla, el detector de R2 no existe ni siquiera en la forma
  declarada.

**Severidad.** MEDIA: obliga a adivinar.

**Juan.** El handler corre `P1` sobre la lápida de Juan, el consumidor rechaza el aviso con `user`
nulo y la transacción se revierte: el cobro queda sin fila ni marca.

**Qué hace falta decidir.** Aplicación: en qué estado nace el `payment` sobre una lápida, y que `P1`
diga que sobre una lápida no emite comprobante ni aviso.

### R26 · «La implementación de arranque» no está delimitada — MEDIA, 1 agente

La real se enchufa sobre la de arranque y reusa su resolución del trial y de `BASE`, así que en
producción corre código de la de arranque; `G13` prohíbe que *«la implementación de arranque llegue
a producción»* sin decir qué pieza es (`F-8V2C1-005`). Y el criterio de `B4` exige un caso que la de
arranque no pase, dentro de un juego que el contrato quiere único y verde contra las dos
(`F-8V2C1-006`).

- `F-8V2C1-005` MEDIA · `F-8V2C1-006` MEDIA

**Severidad.** MEDIA: obliga a adivinar; el peor desenlace (una excepción a `G13` que deja pasar el
`no` a las fuentes de billing) necesita además un error humano bajo presión.

**Juan.** `G13` se pone rojo en el primer build de producción; alguien le agrega una excepción, pasa
también el cableado que responde `no`, y Juan paga Premium con las fichas abajo.

**Qué hace falta decidir.** Aplicación: el predicado de `G13` sobre un objeto nombrado (el `no` a
las cuatro fuentes de billing) y qué es *«las dos»* en el §6.2.

### R27 · El corte despublica por escritura directa y el caché público no se entera — MEDIA, 1 agente

La migración del paso 3 hace nacer `UNPUBLISHED_BY_BILLING` a toda ficha que estaba a la vista, con
una escritura directa. El código actual sirve las páginas con revalidación ISR y detecta páginas
viejas en 48 h; ningún paso del corte purga ni revalida.

- `F-8V2C2-006` MEDIA

**Severidad.** MEDIA: obliga a adivinar si horas de ficha visible son aceptables.

**Juan.** La página de Juan sigue en el borde; un turista le escribe sobre una ficha que el sistema
da por despublicada.

**Qué hace falta decidir.** Aplicación: un paso del corte que revalide o purgue las páginas de las
fichas que nacen despublicadas, y dónde va en el orden.

### R28 · `S36` no llegó a las enumeraciones de segundo orden — BAJA, 1 agente

`S36` entró el 2026-09-26 y sus espejos se recontaron donde la propia fila los nombraba, pero no en
las enumeraciones que remiten a ella desde otro lado: las salidas de `PAUSED` en `B/03` §3.2 y §5
(`F-8V2D1-003`) y la rama 6 de `B/12` §5.3 (`F-8V2D1-004`). La tercera es la lista de orfandad de
`B/16` §4.3, que tiene daño de plata y va en R1 (`F-8V2D1-001`).

- `F-8V2D1-003` BAJA · `F-8V2D1-004` BAJA

**Severidad.** BAJA: la fila de `S36` sí dice lo correcto; el daño exige construir desde la
enumeración y no desde la fila.

**Juan.** Quien construye la rama 6 desde `B/12` dispara el efecto 5 de `S18` sólo con `S23` o `S24`:
el pago retenido de Juan no le llega a nadie hasta que el barrido lo encuentra por otra vía.

**Qué hace falta decidir.** Aplicación: recontar las salidas de `PAUSED` y las filas 6 de las dos
tablas de `B/12` §5.3 con `S36`.

---

## 3. La crítica, verificada

**`F-8V2B1-001` se sostiene.** Reproduje el camino leyendo los capítulos citados, no el informe:

1. **La baja deja la principal viva.** La fila `S11` cancela el preapproval de la principal y la
   lleva a `CANCEL_SCHEDULED`, y no nombra complementos (`rg` sobre la fila, cero coincidencias con
   `complemento|S32|S21`).
   - `B/03:157` — «se cancela en el proveedor de inmediato»
2. **Esa fila viva no dispara la orfandad.** `B/16` §4.3 lo dice para `S26` con la misma razón que
   vale para `S11`:
   - `B/16:711` — «`CANCEL_SCHEDULED`, que sigue siendo fila viva. Lo que se evalúa en cada una es»
3. **El diseño sabe que `CANCEL_SCHEDULED` fabrica un huérfano con fecha**, y por eso no vende
   addons ahí; no hace lo mismo con los que ya estaban:
   - `B/16:121` — «venderle un addon ahí es fabricar un huérfano con fecha»
4. **El complemento cobra por su cuenta.** Es su propio preapproval (`DEC-ADDON-002`, impl. 6):
   - `B/16:688` — «es su propio preapproval y sigue cobrando por su cuenta hasta que alguien lo cancele.»
5. **Al morir, el motivo es el 14, «el cliente actuó», no devolver.** La tabla del reparto pone
   ahí la mitad de `S12` que no viene de `S26`, que es exactamente la de `S11`:
   - `B/03:1366` — «la mitad de `S12` que no viene de `S26`»
6. **Para la principal, el mismo hecho abre el motivo opuesto**:
   - `B/05:114` — «no debería existir. Se pone la marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_A_LA_BAJA`»
7. **La pantalla promete lo contrario, y sólo para `LISTING`**:
   - `B/19:109` — «y su cobro se corta»

**Busqué el «NO cierra» que la cubriera, y no está.** El «NO cierra» de `B/16` declara el destaque
que se sigue cobrando sobre una ficha que no se ve con la principal viva (`G2-3`), el complemento
que autoriza durante una pausa y el destaque de una ficha borrada con el empuje perdido. Ninguno
nombra el complemento que cobra un ciclo nuevo **después de la baja** dentro de `CANCEL_SCHEDULED`.
El ítem que habla de *«qué pasa con una suscripción de complemento cuando la principal se va»* dice
que está resuelto por la orfandad, que es justo lo que no corre en esa ventana.

**Y la decisión que el camino contradice es la del propio `DEC-SUB-009`**, que eligió cancelar ya y
no al vencimiento por una sola razón:

- `$D/01-decision-log.md:1262` — «el fallo cobra plata que no corresponde»

Con el complemento pasa lo que `DEC-SUB-009` descartó, y no por un fallo sino por diseño. Es plata
cobrada de más en el camino principal (toda baja desde `ACTIVE` de un cliente con addon recurrente,
con probabilidad alta de que el aniversario del addon caiga en la ventana), sin detector que
proponga devolverla. **CRÍT.**

Un matiz para la atribución, sin dictaminarla: la tanda del 2026-09-26 (`G2-2`) extendió la pausa
de complementos de la pausa del cliente a la suspensión y no a `CANCEL_SCHEDULED`; la fila 3-bis
de `B/19` es del 25/09 (`F-8CA2-003`) y el reparto de motivos es de `DEC-RF-006`. Si la CRÍT la
generó una tanda o estaba antes es lo que la cláusula 1 de `DEC-METH-013` pide mirar contra los
diffs.

---

## 4. Propuestas de cambio de severidad

### Subir a CRITICA

**Ninguna.** La atribución corre sólo sobre `F-8V2B1-001`. Tres candidatos se consideraron y se
dejan en ALTA; van con su razón para que el owner pueda discrepar:

| candidato | por qué se consideró | por qué no se propone |
|---|---|---|
| **R2** (`B3-002`, `C2-004`) | tres agentes ciegos; plata cobrada sin servicio; la declaración de `G3-1` tiene una población falsa, así que no está *«declarada con verdad»* | el daño depende de un comportamiento del proveedor sin medir (`GR-2`) o de una reversión observada en seis casos; la población es de un solo día de corte; y la salvedad 4 del barrido ve a los 3 días el preapproval que volvió a vivir. No es el camino principal |
| **R5** (`A3-001`, `C1-001`) | datos borrados sin detector, dos agentes | `B/10` §4.3 asigna la escritura con todas las letras al barrido de `B12`, y la regla del contrato es de vigilancia (*«se mira»*), no un guard: la lectura dañina exige que el implementador ignore su propio capítulo. Contradicción entre dos textos: ALTA por definición. Además la discontinuación es un acto raro del owner |
| **R14** (`A1-001`) | acceso indebido es clase de CRÍT | un solo agente, y la lectura que abre el acceso exige ignorar la tercera pregunta explícita del paso 4 (*«¿es del sujeto?»*) y el marco de lectura del párrafo de la precisión 7 |

R2 es **de plata** y su declaración tiene que reescribirse: por la cláusula 4 de `DEC-METH-013`, no
se declara con causa sin que el owner la lea (§6, pregunta 3).

### Otros cambios

| hallazgo | de | a | razón |
|---|---|---|---|
| `F-8V2B2-004` | MEDIA | **ALTA** | es el mismo hallazgo que `F-8V2B1-003` (paga y no recibe, sin detector ni camino de devolución) con otra severidad; el criterio lo pone en ALTA: plata perdida en un camino plausible que no es el principal. La muerte del proceso a mitad de respuesta no es un borde teórico: el propio corte recicla contenedores |

**Severidad final**, con esa propuesta: **1 CRITICA, 22 ALTA, 25 MEDIA y 8 BAJA** (56).

---

## 5. Contra la vuelta 1

| | FASE 8 completa (24/09) | vuelta 1 (26/09) | vuelta 2 (26/09) |
|---|---|---|---|
| hallazgos | 133 | 100 | **56** |
| CRÍT declarados | 15 | 1 (+2 racimos propuestos) | **1** (+0 propuestos) |
| ALTA | 45 | 28 | 21 (22 con la propuesta) |
| MEDIA | 53 | 47 | 26 (25) |
| BAJA | 20 | 24 | 8 |
| racimos | — | 12 convergentes | 13 convergentes + 15 de un agente |
| citas verificadas | — | 435 ok | 225 ok |

**La tendencia es 133/15 → 100/1 → 56/1.** El volumen cae a la mitad por vuelta y la BAJA casi
desaparece (24 → 8): los agentes encuentran menos texto vencido. El número de críticos no llega a
cero.

**Familias que repiten, con otra forma.**

- **El addon recurrente que sobrevive al servicio** (R3 y R2 de la vuelta 1, R6 del 24/09): ahora
  en `CANCEL_SCHEDULED` y en `S36` (R1). Es la **única CRÍT de esta vuelta**, y es la tercera ronda
  seguida en que esta familia da un crítico o un propuesto.
- **El corte y la lápida** (R4, R5 y R6 de la vuelta 1): la pregunta del cobro en vuelo que la
  vuelta 1 le dejó al owner se contestó (`G3-1`), y ahora se ataca la población con que se declaró
  (R2), la ventana entre pasos (R3), el asiento (R25) y las sondas (R8).
- **La rama de aborto y la infraestructura del corte** (clase nueva de la vuelta 1): ahora es el
  inventario de lo externo (R6).
- **El inventario de la frontera** (R8 de la vuelta 1): el hecho 4 (R5) y la versión vigente del
  plan (R11), que es la segunda pregunta de aquel R8, sin llegar al §4.1.
- **El censo de emisores** (R9 de la vuelta 1): quedan el anclaje y `T6`–`T8` (R12).
- **La regla del lock aplicada sólo a las transiciones de cupo** (nota de la vuelta 1): `PB9` y el
  lock de la máquina de trial (R22, R15).
- **Lo que cuelga de `PURGED`** (`F-8V1A3-010`): ahora con la lista del esquema (R9).
- **La transición que escribe después de la llamada** (`F-8V1B2-004`): ahora pierde contra el pago
  (R18).
- **La regla vieja en el lugar viejo** (R11 de la vuelta 1): R13 y R28.

**Familias nuevas.**

- **Lo que entró en la tanda anterior y no llegó a las enumeraciones de segundo orden**: `S36`
  (R1, R28, `B1-005`). Es el mismo mecanismo que la vuelta 1 vio en `K-9`, ahora sobre una
  transición.
- **La sucesora que vive del crédito** (R17).
- **Montos**: el importe cobrado que nadie compara, el redondeo y las devoluciones parciales (R19,
  R20).
- **El cobro de única vez** sin identidad de pedido ni recuperación (R4).
- **El eje sujeto/dueño de la autorización** (R14) y **la identidad de Partner** (R7).
- **El código actual contra el diseño**: cuatro racimos salen de medir `apps/` o `packages/db`
  (R3, R9, R21, R27), y uno de una observación del proveedor que la matriz no recoge (`C2-004`).

**Clases que no reaparecen.** Ningún agente reabre la ficha vieja sin estado de nacimiento (R1 de
la vuelta 1, su único CRÍT): `A1` y `A3` atacaron la tabla `L1`–`L8` y resistió. Tampoco el
desempate de un solo productor (R4 de la vuelta 1) ni el vínculo fila ↔ preapproval (R12): `B3`
dio por resistida la re-vinculación.

### Lo que esto le dice al criterio de `DEC-METH-013`

El criterio es *«se deja de girar cuando la tanda de arreglos anterior dejó de generar críticos»*,
con tope de dos vueltas. Esta es la segunda. **Hay un crítico declarado y sostenido**
(`F-8V2B1-001`); si la atribución contra los diffs lo imputa a la tanda del 26/09, la vuelta 2
generó un crítico y, por el tope, se pasa a declarar. Si la atribución lo ubica antes de esa tanda,
la tanda no generó críticos. En los dos casos no se abre una vuelta 3: el tope ya se alcanzó. Este
consolidado no dictamina la atribución.

---

## 6. Lo que le toca al owner

Cada pregunta sale de un racimo. Entre paréntesis, la opción que el diseño vigente sugiere cuando
sugiere una.

1. **R1**: ¿el complemento recurrente se cancela en el proveedor en el acto de la baja,
   sosteniendo su servicio hasta el fin de la principal, o su cobro posterior a la baja va a un
   motivo que propone devolver? (`DEC-SUB-009` sugiere cancelar ya).
2. **R1**: ¿qué motivo escribe `S21` cuando la orfandad la causó una revocación (`S36`)? (sin
   sugerencia; es del pliego legal de `B/22`).
3. **R2**: ¿se sostiene «no devolver» de `G3-1` con la población real (todo registro abierto o
   cancelación que se deshace, durante un ciclo), y se mide antes en el paso 0 lo que la achica?
   (sin sugerencia; `G3-1` se decidió sobre «minutos»).
4. **R4**: ¿el pago de única vez tiene un camino de devolución, o se amplía el «NO cierra» de
   `B/16` para decir que no lo tiene? (sin sugerencia).
5. **R5**: ¿el hecho 4 y lo que corre el día del fin de servicio quedan en billing como segunda
   escritura declarada del §4.1, o el fin de servicio pasa a ser un hecho que ejecuta verticales?
   (el texto de `B/10` §4.3 sugiere lo primero).
6. **R9**: ¿qué pasa con conversaciones, alertas y demás datos de terceros cuando una ficha llega a
   `PURGED`? (`DEC-DATA-005` sólo dice que la retención toca fichas).
7. **R15**: ¿la cartera del corte que contrata sin publicar consume su trial al convertir, o lo
   conserva para después de cancelar? (`2g` le regala el trial; `T6` existe para no guardarlo).
8. **R17**: ¿el crédito de `DEC-SUB-006` cuenta como período pagado para la baja? (lo cerrado el
   25/09 pensó sólo en la ventana de 72 h).
9. **R21**: ¿el titular de una autorización que sólo conoce el proveedor entra a la población a
   avisar, o se declara que se lo cancela sin aviso? (sin sugerencia).
10. **Corte de `DEC-METH-013`**: ¿se dictamina la atribución de `F-8V2B1-001` contra los diffs antes
    de pasar a declarar? (la cláusula 1 lo exige; el §3 deja las pistas).

El resto de los racimos (R3, R6–R8, R10–R14, R16, R18–R20, R22–R28) es trabajo de escritura sin
decisión de producto, salvo la pregunta de producto que R7 lleva adentro (a qué cuenta vincula el
reclamo).

---

## 7. Notas del consolidador

Marcadas como tales: no son hallazgos de ningún agente.

- **Un ataque «resistido» otra vez chocó con un hallazgo.** `D1` descartó el censo sin `T6`–`T8`
  como no-hallazgo, con la misma razón con que `A2` y `C1` lo dan BAJA: acá la lectura opuesta
  confirma la severidad en vez de romperla. Y `B1` dio por resistido *«complemento cobrando durante
  pausa o suspensión»*, que es cierto, mirando los dos estados sin servicio que `G2-2` cubrió; el
  tercero, `CANCEL_SCHEDULED`, es su propia CRÍT.
- **Dos agentes con la misma severidad distinta para el mismo hallazgo** (`B1-003` ALTA, `B2-004`
  MEDIA). Se propone alinear hacia arriba (§4).
- **R2 y R25 se refuerzan**: la declaración de `G3-1` apoya su detector en el `payment` asentado,
  y R25 muestra que ese asiento puede no escribirse. Arreglar la población de R2 sin R25 deja el
  detector sin garantía.
- **R16 y R15 terminan en el mismo estado** (una fila de `trial` que nadie escribe) por dos causas
  independientes; arreglar una no cierra la otra.
- **La convergencia sobre una misma línea**: `16-fase-7…:130` (el 3b) aparece en `B3` y `C1`, y
  `16-fase-7…:146` (el rollout) en `B3` y `C2`. El paso 3 del corte concentra cinco racimos (R3,
  R6, R8, R11, R27).
- **No se corrió el dictamen de atribución** de la cláusula 1 de `DEC-METH-013` (pregunta 10).

---

## 8. Trazabilidad

Los 56 IDs, cada uno con su racimo. Verificado con script: los IDs de esta tabla son exactamente
los 56 encabezados `### F-8V2` de los nueve informes, sin repetidos ni huérfanos.

| ID | informe | sev. informe | sev. propuesta | racimo |
|---|---|---|---|---|
| `F-8V2A1-001` | A1 | ALTA | ALTA | R14 |
| `F-8V2A1-002` | A1 | ALTA | ALTA | R14 |
| `F-8V2A1-003` | A1 | ALTA | ALTA | R7 |
| `F-8V2A1-004` | A1 | MEDIA | MEDIA | R10 |
| `F-8V2A2-001` | A2 | ALTA | ALTA | R15 |
| `F-8V2A2-002` | A2 | MEDIA | MEDIA | R15 |
| `F-8V2A2-003` | A2 | MEDIA | MEDIA | R22 |
| `F-8V2A2-004` | A2 | MEDIA | MEDIA | R22 |
| `F-8V2A2-005` | A2 | MEDIA | MEDIA | R7 |
| `F-8V2A2-006` | A2 | MEDIA | MEDIA | R9 |
| `F-8V2A2-007` | A2 | BAJA | BAJA | R13 |
| `F-8V2A2-008` | A2 | BAJA | BAJA | R12 |
| `F-8V2A3-001` | A3 | ALTA | ALTA | R5 |
| `F-8V2A3-002` | A3 | ALTA | ALTA | R6 |
| `F-8V2A3-003` | A3 | MEDIA | MEDIA | R9 |
| `F-8V2A3-004` | A3 | MEDIA | MEDIA | R23 |
| `F-8V2A3-005` | A3 | MEDIA | MEDIA | R24 |
| `F-8V2A3-006` | A3 | BAJA | BAJA | R13 |
| `F-8V2B1-001` | B1 | CRITICA | CRITICA | R1 |
| `F-8V2B1-002` | B1 | ALTA | ALTA | R17 |
| `F-8V2B1-003` | B1 | ALTA | ALTA | R4 |
| `F-8V2B1-004` | B1 | MEDIA | MEDIA | R17 |
| `F-8V2B1-005` | B1 | MEDIA | MEDIA | R17 |
| `F-8V2B1-006` | B1 | MEDIA | MEDIA | R2 |
| `F-8V2B2-001` | B2 | ALTA | ALTA | R18 |
| `F-8V2B2-002` | B2 | ALTA | ALTA | R19 |
| `F-8V2B2-003` | B2 | ALTA | ALTA | R4 |
| `F-8V2B2-004` | B2 | MEDIA | **ALTA** | R4 |
| `F-8V2B2-005` | B2 | MEDIA | MEDIA | R19 |
| `F-8V2B3-001` | B3 | ALTA | ALTA | R20 |
| `F-8V2B3-002` | B3 | ALTA | ALTA | R2 |
| `F-8V2B3-003` | B3 | ALTA | ALTA | R3 |
| `F-8V2B3-004` | B3 | MEDIA | MEDIA | R8 |
| `F-8V2B3-005` | B3 | MEDIA | MEDIA | R25 |
| `F-8V2B3-006` | B3 | MEDIA | MEDIA | R2 |
| `F-8V2B3-007` | B3 | MEDIA | MEDIA | R20 |
| `F-8V2B3-008` | B3 | MEDIA | MEDIA | R20 |
| `F-8V2B3-009` | B3 | BAJA | BAJA | R11 |
| `F-8V2C1-001` | C1 | ALTA | ALTA | R5 |
| `F-8V2C1-002` | C1 | ALTA | ALTA | R16 |
| `F-8V2C1-003` | C1 | MEDIA | MEDIA | R12 |
| `F-8V2C1-004` | C1 | MEDIA | MEDIA | R11 |
| `F-8V2C1-005` | C1 | MEDIA | MEDIA | R26 |
| `F-8V2C1-006` | C1 | MEDIA | MEDIA | R26 |
| `F-8V2C1-007` | C1 | BAJA | BAJA | R12 |
| `F-8V2C2-001` | C2 | ALTA | ALTA | R6 |
| `F-8V2C2-002` | C2 | ALTA | ALTA | R3 |
| `F-8V2C2-003` | C2 | ALTA | ALTA | R21 |
| `F-8V2C2-004` | C2 | ALTA | ALTA | R2 |
| `F-8V2C2-005` | C2 | MEDIA | MEDIA | R8 |
| `F-8V2C2-006` | C2 | MEDIA | MEDIA | R27 |
| `F-8V2C2-007` | C2 | BAJA | BAJA | R13 |
| `F-8V2D1-001` | D1 | ALTA | ALTA | R1 |
| `F-8V2D1-002` | D1 | MEDIA | MEDIA | R10 |
| `F-8V2D1-003` | D1 | BAJA | BAJA | R28 |
| `F-8V2D1-004` | D1 | BAJA | BAJA | R28 |

Conteo por racimo: R1 2 · R2 4 · R3 2 · R4 3 · R5 2 · R6 2 · R7 2 · R8 2 · R9 2 · R10 2 · R11 2 ·
R12 3 · R13 3 (convergentes: 31) · R14 2 · R15 2 · R16 1 · R17 3 · R18 1 · R19 2 · R20 3 · R21 1 ·
R22 2 · R23 1 · R24 1 · R25 1 · R26 2 · R27 1 · R28 2 (de un agente: 25). Total **56**.

---

## Key Learnings

1. La única CRÍT de esta vuelta es la misma familia que dio crítico en las dos rondas anteriores:
   **el addon recurrente con preapproval propio no hereda ninguna protección de la principal**.
   Cada acto que corta el cobro de la principal (baja, revocación, suspensión, pausa) hay que
   recorrerlo sobre sus complementos; `G2-2` lo hizo para dos estados sin servicio y dejó afuera
   `CANCEL_SCHEDULED`.
2. Una transición que entra tarde (`S36`) se recuenta donde su fila nombra sus espejos y se pierde
   en las enumeraciones que remiten a ella desde otro lado. Una lista declarada «para auditar que
   ninguna se olvidó» es exactamente el lugar donde se olvida.
3. Una declaración con población fija («minutos», «tres») caduca en silencio cuando otra decisión
   o una medición la agranda. Tres agentes ciegos la rompieron por tres lados distintos; la
   declaración tiene que leer su población de una consulta, no de un número.
4. «Cancelado = no cobra» es premisa de diseño y sostiene tres cosas a la vez (la lápida del corte,
   la exención de las terminales, el gate del paso 2). El código actual ya tenía una observación
   de producción que la contradice y que la matriz no recoge.
5. Una recuperación escrita en voz pasiva («se reenvía») no existe hasta que tiene actor; buscar
   quién la ejecuta es la forma más rápida de saber si está cerrada.
6. Agrupar sin excepciones (todo ID con racimo) sacó cinco convergencias que no estaban a la
   vista; la más útil es la rama de aborto (R6), donde dos agentes encontraron dos objetos
   externos distintos contra la misma frase *«no hay ninguno»*.
7. De los tres candidatos a CRÍT, ninguno aguantó el criterio: uno depende de un comportamiento
   sin medir, otro contradice el propio capítulo de su unidad y el tercero exige ignorar una
   pregunta explícita. Distinguir «contradicción con daño» (ALTA) de «daño determinado por el
   diseño» (CRÍT) fue lo que decidió los tres.
