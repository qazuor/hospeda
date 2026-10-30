---
title: "FASE 9 vuelta 1 · G3 — el desempate de motivos y la conciliación"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G3: el desempate de motivos y la conciliación

Resuelve los **18** hallazgos del grupo G3: los cinco de R4, los tres de R12 y los diez sueltos de
`B2` y `B3` que no están en ningún racimo. La lista salió con un script contra el consolidado
(`27-fase-8-vuelta-1/00-hallazgos.md`): miembros de R4 y R12, más las filas del §3 cuyo ID empieza
con `F-8V1B2-` o `F-8V1B3-` y no figuran en ningún racimo.

**Abreviaturas de las citas.** `B/NN` es `$B/docs/NN-*.md`; `D/16` es
`$D/16-fase-7-del-paraguas.md`; `D/06` es `$D/06-mp-validation-matrix.md`; `D/01` es
`$D/01-decision-log.md`; `D/26-10` es `$D/26-fase-9-completa/10-decisiones-del-owner.md`. Toda
cita es una sola línea del archivo y se verificó con script sobre el worktree el 2026-09-26.

**Las dos listas cerradas quedan como están.** Nada de lo que sigue agrega un motivo a los 22 de
`B/02` §2.5 ni una acción a las 14 de `NUCLEO/08` §3. Donde un hallazgo parecía pedir un motivo
nuevo, el recorrido del dominio encontró uno de los 22 que ya dice lo que pasó.

---

## 1. Resumen

| hallazgo | ¿sigue llegando? | salida | capítulos afectados |
|---|---|---|---|
| `F-8V1B2-003` | sí | aplicación | `B/05` §3, `B/02` §2.5, `B/09` §3 |
| `F-8V1B3-002` | sí | aplicación **y owner** (G3-1) | `B/09` §3, `B/21` §2.5, `B/05` §3 |
| `F-8V1B2-002` | sí | aplicación | `B/05` §2 y §3, `B/03` `S11`/`S26` |
| `F-8V1B1-007` | sí | aplicación | `B/05` §3 |
| `F-8V1C2-013` | sí | aplicación | `B/05` §3 |
| `F-8V1B3-004` | sí | aplicación | `B/02` §2.2, `B/09` §2.4 |
| `F-8V1B2-007` | sí | aplicación | `B/09` §7 |
| `F-8V1B2-008` | sí | aplicación + declarar el residuo | `B/09` §7, `B/05` §1.2, «NO cierra» de `B/09` |
| `F-8V1B2-001` | sí | aplicación | `B/03` `S14`/`S15`, §10.3 |
| `F-8V1B3-001` | sí | **owner** (G3-2) | `B/09` §2.4, `B/21` §2.5, `B/02` §2.2 |
| `F-8V1B2-004` | sí | aplicación + declarar el residuo | `B/03` §10.1, «NO cierra» de `B/03` |
| `F-8V1B2-005` | sí | aplicación | `B/05` §3, `B/02` §2.2, `B/03` `S19` |
| `F-8V1B2-006` | sí | aplicación | `B/03` `S31` |
| `F-8V1B3-005` | sí | declarar (y corregir la frase) | `D/16` §4.2 y §4.3 |
| `F-8V1B2-009` | sí | aplicación | `B/03` `S6` |
| `F-8V1B2-010` | sí | aplicación | `B/02` §2.5 (motivos 6 y 8) |
| `F-8V1B2-011` | sí | aplicación | `B/03` §4 |
| `F-8V1B3-007` | sí | aplicación | `B/09` §3 (dos frases) |

Los 18 siguen llegando sobre el texto vigente. Por salida principal: **15 de aplicación, 2 del
owner y 1 a declarar**; además dos de aplicación dejan un residuo que se declara con su causa.

---

## 2. Los racimos

### 2.1 R4 · el desempate de motivos es lista cerrada y de un solo productor

**Causa.** La tabla de desempate de `B/05` §3 se escribió como **enumeración de transiciones** y
para **un productor**, el evento. Tiene tres filas, y la primera exige una fila `CANCELLED` que haya
producido alguna de esta lista (`B/05:307`):

> «`S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo del `B/03` §10.1»

El comodín nombra sólo dos estados (`B/05:309`): «la **1** sobre una fila `ABANDONED` o ya
`ACTIVE`, y las condiciones **2**, **3** y **4** enteras». Y la condición 1 que la tabla desempata
también enumera (`B/05:268`): «si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`, el pago no la
reactiva». Tres cosas quedan afuera:

- **estados que no nombra**: `CANCEL_SCHEDULED`, `PAUSED`, `PENDING_AUTHORIZATION` y
  `CHARGE_DECLINED`, que desde la FASE 8 completa se alcanza por nuestra llamada (`B/09:155`:
  «**nuestra llamada**, con la relectura de `S17`: `S16` cancela el preapproval de nuestro lado»);
- **filas que no nacen de una transición**: la lápida, que el propio `B/21` avisa que no entra en
  enumeraciones (`B/21:177`: «La lápida es la única fila `CANCELLED` de todo el sistema que ninguna
  transición produce»; `B/21:181`: «no aparece en ninguna enumeración de transiciones.»);
- **el segundo productor**: el barrido abre otro motivo por su cuenta (`B/05:241`: «Y si el cobro
  aprobado lo ve primero el barrido y no un evento»; `B/05:242`: «escribe él: abre la marca
  `COBRO_SIN_REGISTRAR` (`B/02` §2.5, `B/09` §3)»), y la comparación del barrido no mira el estado
  de la fila (`B/09:123`: «ve un registro con `payment.status` = `approved` que nosotros no tenemos
  acreditado»). El default de ese motivo es el opuesto (`B/02:937`: «así que no hay nada que
  devolver»). Y el barrido sí recorre terminales (`B/09:115`: «que no esté en un estado terminal,
  **más las terminales que las cuatro»).

**Verificación de que el camino llega.** Las seis líneas citadas están vigentes. La lápida entra al
barrido en la primera corrida (`B/21:171`: «Entra al barrido aunque el paso 2 ya la haya visto
`cancelled`»), y desde el 2026-09-26 el preapproval viejo tiene un cobro `approved` sin `payment`
nuestro (`B/21:276`: «los hay desde el 2026-09-26, bajo el sistema viejo (§1.3), y»). El camino de
`F-8V1B3-002` es determinístico.

#### Dominio declarado

La regla cuantifica sobre **productor × estado de la fila al llegar el cobro**. Es una lista
cerrada:

- **Productores (3).** **E**, el evento del cobro (`B/05` C6, `P1`, §2 y §3). **B**, la comparación
  de cobros del período del barrido (`B/09` §3), con su caso particular, la relectura de `S6`.
  **R**, la re-vinculación de un preapproval desconocido (`B/09` §2.4). Quedan afuera por
  construcción el pago manual —su tope es la condición 1, y el admin no lo registra sobre una
  terminal— y el choque de `P1` con el `UNIQUE` de `covered_period`, que es ortogonal: da
  `COBRO_DUPLICADO` sobre toda fila que recibe el cobro y no depende del estado.
- **Estados (17 casos).** Los nueve de `B/03` §3.1, abiertos por origen donde el origen cambia el
  motivo, más la ausencia de fila. Van en la tabla del recorrido.

#### Recorrido del dominio

«Hoy» es lo que da el texto vigente; «propuesta» es lo que da el texto de abajo. **Puede recibir**
significa que el cobro paga un período que la fila da o dio, y entonces se asienta.

| # | estado al llegar el cobro | E hoy | B hoy | propuesta (E y B) |
|---|---|---|---|---|
| 1 | `PENDING_AUTHORIZATION` | sin clasificar; si se corre el §3, comodín `7` | la fila de estado corre `S2`, la de cobros abre `19` | puede recibir: se relee el preapproval, corre `S2` y el cobro se asienta sobre `ACTIVE` |
| 2 | `ACTIVE` | `P1` | `19` | igual que hoy |
| 3 | `GRACE_PERIOD` | cuatro condiciones: `S5` o `7` | `S5` por la relectura de `S6`; si no, `19` | igual que hoy |
| 4 | `SUSPENDED` | cuatro condiciones: `S7` o `7` | `19` | igual que hoy |
| 5 | predecesora de una sucesión en curso | `S19` si falla la 3 por la sucesora; `7` si falla la 2 o la 4 | `19` | `S19` falle la condición que falle (§3.2, `F-8V1B2-005`); B abre `19` y el asiento entra por `S19` |
| 6 | `PAUSED`, cobro anterior a la pausa | sin clasificar; comodín `7` | `19` | puede recibir: `P1` |
| 7 | `PAUSED`, cobro posterior a la pausa | comodín `7` | `19` (asentar) | `7` en los dos |
| 8 | `CANCEL_SCHEDULED` de `S11`, cobro anterior | `C2` fila 1, fórmula de `S11`; si se corre el §3, `7` | `19` | puede recibir: `C2` fila 1 con `max` |
| 9 | `CANCEL_SCHEDULED` de `S26`, cobro anterior | fórmula de `S11`: **acorta el piso** | `19` | puede recibir: `C2` fila 1 con `max`, deja el piso |
| 10 | `CANCEL_SCHEDULED` (`S7`, `S11`, `S26`), cobro posterior | `C2` fila 2: `2` | `19` (asentar) | `2` en los dos |
| 11 | `CANCELLED` por acto nuestro o del cliente, o espejo | `2` | `19` (asentar) | `2` en los dos |
| 12 | `CANCELLED` por `S13` o `S20` | `3` | `19` (asentar) | `3` en los dos |
| 13 | `CANCELLED`, lápida | comodín `7` | `19` sobre todo registro `approved`, **incluidos los del viejo** | `2` en los dos, sólo para cobros posteriores al fin de servicio de la lápida (G3-1 decide si se propone devolver) |
| 14 | `ABANDONED` (`S3`, `S28`, `S31`) | `7` | `19` (asentar) | `2` en los dos |
| 15 | `CHARGE_DECLINED` (`S16`) | sin clasificar | `19` (asentar) | `2` en los dos |
| 16 | desconocido que nombra una fila con vínculo | R: `6` («no» hay plata) | — | con cobro, `7` sobre esa fila; sin cobro, `6` |
| 17 | desconocido que no nombra ninguna fila | R: `6`, **no se puede escribir** | — | G3-2 decide dónde vive; con cobro, `7` |

Resultado: con la propuesta, **ningún caso de terminal, de lápida ni de cobro posterior a una baja
cae en `19`**, y ningún cobro que paga un período dado cae en un motivo con devolución. Los casos 2,
3 y 4 no cambian. El 14 pasa de `7` a `2` para cumplir el criterio que la tabla ya escribe
—«qué acto nuestro dejó cobrando»— y porque la lista vigente ya nombra `S31`, que termina en
`ABANDONED` desde `PENDING_AUTHORIZATION`: con la tabla vigente, `S31` está en una fila que exige
`CANCELLED`. Los dos motivos llevan **SÍ**, así que el cambio no mueve plata: cambia qué ve la
persona.

#### Propuesta de texto

**`B/05` §3, tabla de las cuatro condiciones, columna «qué pasa si no se cumple» de la fila 1.**
Tachar «si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`, el pago no la reactiva» y escribir:

> en **cualquier otro estado** el pago no la reactiva. Adónde va lo dice la tabla de desempate de
> abajo, que clasifica los nueve estados y la lápida. **Este § no corre sobre una fila que puede
> recibir el cobro** (lista de abajo).

**`B/05` §3, tabla de desempate: reemplazar las tres filas por estas tres, y agregar debajo la
lista de lo que el § no desempata.**

> | la fila al llegar el cobro | motivo |
> |---|---|
> | **una terminal cuyo preapproval canceló un acto nuestro o del cliente, o el proveedor**, salvo un *Free Forever*: `CANCELLED` por `S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo del `B/03` §10.1; `ABANDONED` por `S3`, `S28` o `S31`; `CHARGE_DECLINED` por `S16`; **la lápida del corte** (`B/21` §2.5). **Y una `CANCEL_SCHEDULED` —de `S7`, `S11` o `S26`— con el cobro posterior a la cancelación** | **`COBRO_POSTERIOR_A_LA_BAJA`** (§2 `C2`) |
> | `CANCELLED` por un *Free Forever*: `S13` o `S20` | **`COBRO_POSTERIOR_AL_GRANT`** (§2 `C3`) |
> | **cualquier otra forma de fallar**: la **1** sobre una `ACTIVE`, o sobre una `PAUSED` con el cobro posterior a la pausa; las condiciones **2**, **3** y **4** enteras; y **el cobro de un preapproval que no es el vínculo de la fila** (`B/09` §2.4) | **`PAGO_TARDÍO_RECHAZADO`** |
>
> **Lo que este § no desempata, porque la fila puede recibir el cobro**: una
> `PENDING_AUTHORIZATION` —se relee el preapproval por id, corre `S2` y el cobro se asienta sobre
> la fila ya `ACTIVE`—; una `ACTIVE` sobre el período en curso (`P1`); una `PAUSED` con el cobro
> anterior a la pausa (`P1`; `DEC-SUB-010` ya se llevó los días al pausar); una `CANCEL_SCHEDULED`
> con el cobro anterior a la cancelación (§2 `C2`, primera fila); y la predecesora de una sucesión
> en curso (`S19`).
>
> **La tabla la aplican los dos productores**: el evento del cobro y la comparación de cobros del
> barrido (`B/09` §3). El barrido abre `COBRO_SIN_REGISTRAR` **sólo** sobre una fila que puede
> recibir el cobro. Sobre cualquier otra abre el motivo que esta tabla asigna, con el cobro
> colgado. Escrita por criterio y no por productor, una fila nueva —o una escrita a mano— cae en
> la fila del acto que la dejó sin poder cobrar y no en el comodín.

**`B/05` §2 `C2`, primera fila.** Después de «**Se extiende la fecha de fin de servicio** hasta
cubrirlo», agregar:

> —con `max` sobre la fecha vigente: una extensión **nunca acorta** (`B/03` `S11`); sobre una fila
> de `S26` deja en pie el piso de la vertical—

**`B/03` §3.2, fila `S11`, efectos.** Tachar «la misma fórmula, recalculada, es la extensión que ese
§ manda» y escribir:

> la extensión que ese § manda es **`max(fin_de_servicio vigente, la fórmula recalculada)`**: una
> extensión nunca acorta.

**`B/03` §3.2, fila `S26`.** Después de «el pago que llegue se resuelve como el de cualquier
`CANCEL_SCHEDULED`», agregar: «—con el `max` de `S11`, que sobre esta fila conserva la fecha única
de la vertical—».

**`B/02` §2.5, tabla, columna «quién abre la marca».**

- Motivo 2: después de «`S14`, desde `C2` del `B/05` §2» agregar «**y desde la comparación de
  cobros del `B/09` §3, sobre las filas de la primera fila del desempate del `B/05` §3**».
- Motivo 3: lo mismo, con «la segunda fila».
- Motivo 7: después de la primera frase agregar «**y desde la comparación de cobros del `B/09` §3,
  sobre las filas de la tercera fila del desempate**».
- Motivo 19: después de «**el cobro aprobado que nunca asentamos**» agregar «**sólo sobre una fila
  que puede recibir el cobro** (`B/05` §3, lista de lo que no se desempata); sobre cualquier otra la
  misma comparación abre el 2, el 3 o el 7». La casilla **«no»** de la plata queda cierta.
- Los conteos no se mueven: los cuatro los abre `S14` y siguen siendo doce de veintidós.

**`B/09` §3, fila «cobros del período».** Después de «**el barrido no lo escribe**:» reemplazar
«se abre la **marca** con motivo **`COBRO_SIN_REGISTRAR`**» por:

> **sobre una fila que puede recibir el cobro** (`B/05` §3) se abre la **marca** con motivo
> **`COBRO_SIN_REGISTRAR`**; **sobre cualquier otra, el motivo que asigna la tabla de desempate del
> `B/05` §3**, con el cobro colgado. **Sobre una lápida se comparan sólo los registros cuyo cobro es
> posterior a su fecha de fin de servicio** (`B/21` §2.5): los anteriores son del sistema viejo, que
> no se conserva (`B/21` §4).

**`B/21` §2.5, después del párrafo del orden («primero se cancela en el proveedor»).** Agregar:

> **Su fecha de fin de servicio es el instante en que el paso 2 vio `cancelled` su preapproval**,
> igual que en toda baja que va directo a `CANCELLED` (cap. 03 `S24`). Es el corte que usa el
> barrido para separar el cobro del sistema viejo del cobro en vuelo, y no pide ninguna columna
> nueva. Un cobro que entra sobre la lápida después de esa fecha va al motivo
> `COBRO_POSTERIOR_A_LA_BAJA` (`B/05` §3, primera fila del desempate).

La columna de la fecha de fin de servicio existe (`B/02:47`: «**la fecha del próximo cobro**, fecha
de fin de servicio, clase (principal o de complemento)»), y su valor en una baja directa es el de
la cancelación (`B/05:124`: «la fila va **directo a `CANCELLED`** y su fecha de fin de servicio es
el día de la cancelación»). ⚠️ Que el registro de cobro traiga la fecha de aprobación del pago por
id no está medido: se verifica en FASE 10 con `EX-16`. Si no la trae, el corte es el
`date_created` del registro, y el cobro en vuelo creado antes de la cancelación queda afuera: se
declara en el «NO cierra» de `B/21` con esa causa.

#### Cómo deja de llegar cada miembro

- **`F-8V1B2-003`**: el barrido sobre una `CANCELLED` de `S24` abre `2` (caso 11), no `19`.
- **`F-8V1B3-002`**: sobre la lápida, el registro del 26/09 queda antes del fin de servicio y no se
  compara. El cobro en vuelo abre `2` (caso 13). Si se devuelve lo decide **G3-1**.
- **`F-8V1B2-002`**: el cobro anterior sobre una `CANCEL_SCHEDULED` no entra al §3 (casos 8 y 9) y
  la extensión es `max`, así que el piso de `S26` queda.
- **`F-8V1B1-007`**: `CHARGE_DECLINED` (caso 15) y la lápida (caso 13) tienen celda.
- **`F-8V1C2-013`**: la lápida sale del comodín y va a `2`.

### 2.2 R12 · el vínculo fila ↔ preapproval no está definido

**Causa.** La precondición de la re-vinculación (`B/09:72`: «se re-vincula sólo si el
`external_reference` del preapproval nombra una fila nuestra que no») se apoya en dos cosas que
ningún capítulo define: qué valor lleva el `external_reference` (`B/09:76`: «sistema nuevo nace con
nuestro `external_reference` (`PA-2`)», sin valor) y qué hace «vivo» a un `provider_link`, que no
tiene estado y sólo es único por id del proveedor (`B/02:51`: «**`UNIQUE(proveedor,
id_del_proveedor)`**. Es la condición de que la conciliación exista»). El barrido de creaciones
reusa sin esa precondición (`B/09:803`: «Si encuentra un preapproval `pending`, se reusa en vez de
crear otro»), y tras una búsqueda vacía no dice cuándo se crea de nuevo (`B/05:65`: «se midió sobre
el de estado—, así que **una búsqueda vacía no prueba que la suscripción no»).

**Verificación.** `rg -n external_reference` sobre `$B/docs` da nueve líneas, y ninguna fija un
valor: son el buscador que lo ignora, la re-vinculación y la medición de `EX-41`. Sigue llegando.

#### Dominio declarado

La regla cuantifica sobre **cada preapproval que el barrido de creaciones o la re-vinculación
encuentra, según a qué nombra su `external_reference`**. Cuatro casos cerrados: (a) esta fila, (b)
otra fila nuestra, (c) ninguna fila —nonce viejo, sonda o basura—, (d) esta fila, pero hay más de
un `pending` que la nombra. Y dos estados de la fila buscada: sin vínculo todavía, o ya vinculada.

#### Recorrido del dominio

| caso | barrido de creaciones (fila sin vínculo) | re-vinculación (llega un desconocido) |
|---|---|---|
| (a) nombra esta fila, uno solo | se reusa y se vincula | se re-vincula si la fila no tiene vínculo; si lo tiene, es el caso 16 de R4 |
| (b) nombra otra fila nuestra | no se toca: es de la búsqueda de esa fila | se re-vincula a esa fila si no tiene vínculo; si lo tiene, caso 16 de R4 |
| (c) no nombra ninguna fila | no se reusa | caso 17 de R4 (G3-2) |
| (d) más de un `pending` nombra esta fila | se reusa el de `date_created` más reciente y se cancelan los otros | no aplica: un `pending` no cobra |

Con `UNIQUE(subscription_id)`, «vínculo vivo» deja de ser un estado y pasa a ser «la fila tiene su
`provider_link`». El caso de `F-8V1B3-004` (P2 nombra X, y X ya tiene P1) va a persona siempre, y
X nunca queda con dos ids.

#### Propuesta de texto

**`B/02` §2.2, fila `provider_link`.** En «qué guarda», antes de «el id del proveedor», agregar
«**la suscripción que vincula**». En «restricciones», después de
`UNIQUE(proveedor, id_del_proveedor)`, agregar:

> **y `UNIQUE(subscription_id)`**: una suscripción tiene **a lo sumo un vínculo**, y el vínculo no
> tiene estado. *«Otro `provider_link` vivo»* (`B/09` §2.4) se lee *«la fila ya tiene su
> `provider_link`»*. **El `external_reference` de todo preapproval que crea el sistema nuevo es el
> `id` de su fila de `subscription`**, principal o de complemento. Se escribe en el cuerpo de la
> creación, con la clave ya persistida (`B/05` §1.1): no es un nonce ni el id del usuario.

La justificación de «uno por fila» ya está en el modelo: en una sucesión cada fila conserva el
suyo (`B/02:1073`: «son el histórico de esa fila y de su preapproval. Cada suscripción tiene el
suyo»).

**`B/09` §2.4.** Tachar «Cada preapproval del sistema nuevo nace con nuestro `external_reference`
(`PA-2`)» y escribir: «Cada preapproval del sistema nuevo nace con **el `id` de su fila de
`subscription`** como `external_reference` (`PA-2`, `B/02` §2.2)».

**`B/09` §7, fila del barrido de creaciones.** Después de «**Si encuentra un preapproval `pending`,
se reusa en vez de crear otro**» agregar:

> **sólo si su `external_reference` nombra esta fila**: el que nombra otra fila nuestra es de la
> búsqueda de ésa, y el que no nombra ninguna no se reusa nunca. **Si hay más de uno que nombra
> esta fila**, se reusa el de `date_created` más reciente y los otros se cancelan con la regla de
> relectura de `S17` y **sin** correo, porque no es una baja: un `pending` no cobró nada. **Tras una
> búsqueda vacía**, la corrida siguiente vuelve a crear, con una clave nueva acuñada y persistida
> antes de llamar (`B/05` §1.1). **Mientras la fila siga en `PENDING_AUTHORIZATION`**, el barrido
> sigue buscando por su `payer_email` y cancela así todo `pending` que la nombre y no sea su
> vínculo: es la creación perdida que apareció tarde.

**`B/09` §7, párrafo «Los dos barridos son idempotentes».** Agregar a las escrituras permitidas:
«**y, el de creaciones, la cancelación de un `pending` duplicado que nombra la fila** —sin plata y
sin estado, con la regla de relectura de `S17`—».

**`B/09` «NO cierra», bullet nuevo** (residuo de borde, `DEC-METH-015`):

> **Un `pending` duplicado que aparece recién después de `S2` queda vivo** (declarado por
> `DEC-METH-015`). **Causa**: el barrido de creaciones deja de buscar cuando la fila sale de
> `PENDING_AUTHORIZATION`, y un `pending` no vence (`EX-1`). No mueve plata: su enlace nunca se le
> mostró a nadie, porque la respuesta de esa creación se perdió. Si igual se autorizara y cobrara,
> llega como desconocido que nombra una fila vinculada: `PAGO_TARDÍO_RECHAZADO`, con **SÍ**.

La regla «no se crea otra» de `B/03` §3.4 punto 4 no cambia: la creación nueva es de **la misma
fila**, y el candado `A` sigue rechazando una segunda fila (`B/03:1540`: «4. **Qué pasa si vuelve
a intentar**: **no** se crea otra. Se reusa la vigente si le queda»).

#### Cómo deja de llegar cada miembro de R12

- **`F-8V1B3-004`**: el valor está fijado, «vivo» es «existe» y hay `UNIQUE(subscription_id)`.
- **`F-8V1B2-007`**: el reuso exige que el `pending` nombre esta fila, así que el del addon queda
  para la fila del addon.
- **`F-8V1B2-008`**: hay regla tras la búsqueda vacía, y el `pending` que aparece tarde se cancela
  mientras la fila espera. El residuo posterior a `S2` queda declarado.

---

## 3. Hallazgos sueltos

### F-8V1B2-001 — levantar una marca y colgarle un pago no se serializan

**Sigue llegando.** La guarda de `S15` (`B/03:157`: «y ningún pago colgado de esa marca sin
resolver») y el colgado de `S14` (`B/03:156`: «le cuelga a la abierta el pago que el caso trae»)
escriben tablas distintas. No hay locks (`B/05:35`: «Cada caso de abajo se resuelve con una
restricción»), y la optimista es por fila (`B/03:2747`: «Entre la relectura y la escritura puede
entrar otra. Cada fila con estado lleva una»).

**Aplicación.** `B/03` §3.2, fila `S14`, al final de «Y abrir es ACUMULATIVO», agregar:

> **Colgar un pago escribe la marca**: en la misma transacción que inserta en
> `reconciliation_mark_payment`, `S14` le sube la versión a la `reconciliation_mark` con la
> condición `levantada_en IS NULL` (§10.3). Si esa escritura no encuentra la marca abierta porque
> `S15` la levantó en el medio, `S14` abre una nueva: el `UNIQUE` parcial la admite.

Y en la fila `S15`: «**escribe `levantada_en` contra la versión de la marca que leyó**: si un `S14`
le colgó un pago en el medio, la escritura falla, se relee y la guarda ya no se cumple». No agrega
mecanismo: es la concurrencia optimista del §10.3 aplicada a la marca, que es una fila con estado
—abierta o levantada—.

### F-8V1B3-001 — el cobro de un preapproval desconocido no tiene fila donde anotarse

**Sigue llegando.** La regla (`B/09:73`: «Todo otro desconocido —uno que no nombra ninguna fila, o
que») manda abrir una marca que cuelga de una suscripción, y `payment` exige una suscripción o una
instancia (`B/02:326`: «Más un CHECK de que exactamente una de las dos referencias»). El motivo que
le toca dice que no hay plata (`B/02:924`: «decidir qué estado vale y ejecutar la transición de la
tabla que lo permita (`S15`)»), con «no» en la última columna.

**Partición.** El recorrido de R4 separa dos poblaciones:

- **El desconocido que nombra una fila nuestra ya vinculada** (caso 16): la fila existe, así que la
  marca se puede escribir. Es **aplicación**: si trae un cobro va a `PAGO_TARDÍO_RECHAZADO` sobre
  esa fila, y sin cobro a `TRANSICIÓN_NO_DECLARADA`. Texto en `B/09` §2.4: después de «abre la
  marca con motivo `TRANSICIÓN_NO_DECLARADA`», agregar «**—o, si lo que llega es un cobro aprobado,
  `PAGO_TARDÍO_RECHAZADO` (`B/05` §3), porque es plata que la fila no puede tomar—**».
- **El desconocido que no nombra ninguna fila** (caso 17): no hay suscripción donde colgar nada.
  Dónde vive es una decisión de modelo, y es **G3-2**. Su población es real y no es de borde: la
  sonda enumerada que cobra todos los meses (`D/16:131`: «llega como desconocida. Las enumeradas
  cobran la tarjeta del owner y caen en la marca por la»), el cobro en vuelo sin lápida
  (`B/21:153`: «lápida porque su id sólo estaba en el proveedor, una sonda que siguió viva—») y lo
  que el censo no vio (`F-8V1B3-005`). Mueve plata, así que no se declara.

### F-8V1B2-004 — `S6` escribe después de la llamada, y el espejo de su propio aviso lo gana

**Sigue llegando.** `B/03:346`: «la transición se escribe después de la llamada (precisión 2), así
que el». El par (`B/03:2694`) dice «**`S12`** si hay una baja programada; si no, **espejar la baja
decidida por el proveedor**». Tiene excepciones escritas para `S16` y para la sucesora de 3c, y
ninguna para `S6`.

**Aplicación.** En `B/03` §10.1, par `cancelled` × «cualquier estado vivo…», agregar una tercera
salvedad, con la forma de la de `S16`:

> — **y salvo sobre una fila en `GRACE_PERIOD` cuyo reloj del §4 ya se agotó: eso es `S6` por su
> primer evento**, que ya mandó esa cancelación y todavía no escribió. Corre `S6`, llegue antes el
> aviso que llegue; su correo ya salió una vez (§3.2, precisión 3) y no se repite.

**Residuo a declarar** en «lo que esta mitad NO cierra» de `B/03`:

> **`S6` por su segundo o su tercer evento que muere entre la llamada y la escritura** (declarado
> por `DEC-METH-015`). El espejo lleva la fila a `CANCELLED` en vez de `SUSPENDED`, sin el aviso de
> suspensión. **Causa**: esos dos eventos —la pausa del proveedor y el contracargo— no dejan en
> nuestra base un dato que el par pueda leer antes de que `S6` escriba. No mueve plata: el
> preapproval ya está cancelado. En el caso del contracargo sobre una predecesora, la sucesora
> sobrevive con la marca `CONTRACARGO` abierta, que es su detector.

### F-8V1B2-005 — un pago de otro monto sobre la predecesora de una sucesión tiene dos filas

**Sigue llegando.** `S19` retiene sin marca (`B/03:161`: «es un caso diseñado y no una
divergencia, así que `S14` no aplica»). El §3 exime sólo la condición 3 (`B/05:329`: «Con una
excepción, y es la única: la condición 3 falla porque la otra fila viva es la sucesora de»). Y la
marca se lee como invariante (`B/02:241`: «`sucede_a` puede apuntarla** — o sea que esa fila no
puede ser sucedida»).

**Aplicación.** El diseño ya contesta: el destino lo decide el cierre (`B/05:420`: «pago lo decide
**el cierre** de la sucesión y no su llegada»).

- `B/05` §3, párrafo de la excepción: tachar «la condición 3 falla porque la otra fila viva es la
  sucesora de ésta, con la sucesión en curso» y escribir «**la fila es la predecesora de una
  sucesión en curso**, falle la condición que falle: el pago de su período impago lo retiene `S19`
  y lo reevalúa el cierre». El doble cobro de un período ya pagado no es de este §: lo abre `P1`
  como `COBRO_DUPLICADO`.
- `B/02` §2.2, párrafo de la marca: tachar «ningún `sucede_a` puede apuntarla» y escribir «**ningún
  `sucede_a` puede escribirse apuntándola** —se chequea al declarar la sucesión—. Una marca que se
  abre sobre una predecesora con la sucesión ya en curso no la deshace: la sucesión sigue y la marca
  queda sobre la predecesora, que la salvedad 2 del `B/09` §3 sigue barriendo».

### F-8V1B2-006 — `S31` corre por evento y `S17` por estado

**Sigue llegando.** `B/03:173`: «su predecesora se corta por un contracargo». `B/03:159`: «y su
condición, que es sobre un estado, se vuelve a evaluar». El orden se escribió sólo contra `S18`
(`B/03:154`: «encuentra a la sucesora por su `sucede_a`, que `S18` limpia, así que corre antes de
que `S18` evalúe»).

**Aplicación.** `B/03` §3.2, fila `S31`, efectos, agregar:

> **`S31` se escribe en la misma transacción que la escritura de `S6` —o de `S12`— que la dispara.**
> Su llamada de cancelación sale después y, como en `S3`, la fila llega a su destino pase lo que
> pase con ella: la reintenta la salvedad 4. Entre las dos escrituras no hay ventana donde `S17`
> pueda cancelar a la predecesora y `S18` limpiar el puntero.

### F-8V1B3-005 — el gate del censo no ve lo único que el censo existe para encontrar

**Sigue llegando.** `D/16:122`: «el conteo del recorrido tiene que igualar el `total` del
paginado», y la misma línea afirma: «este control la vuelve condición del gate en vez de premisa».
La matriz registra omisiones sin señal (`D/06:275`: «Faltan 54 y no hay ninguna señal de que
falten.»).

**Declarar** (residuo de borde; una fuente independiente sería mecanismo nuevo sobre una API que
`R-MP-01` da por discontinuada). Con G3-2 resuelta, lo que el censo no ve se detecta en su primer
cobro y llega a la persona con **SÍ**.

- `D/16` §4.2, paso 2: tachar «este control la vuelve condición del gate en vez de premisa» y
  escribir «este control la vuelve condición del gate **para los ids conocidos**; una autorización
  desconocida que el recorrido omita no la ve ningún control del corte (§4.3)».
- `D/16` §4.3, bullet nuevo: «**Una autorización viva que el recorrido sin filtro no devuelve
  sobrevive al corte** (declarado por `DEC-METH-015`). **Causa**: el gate compara el recorrido
  contra sí mismo y contra ids conocidos, y la completitud del recorrido no está medida (`RC-1`).
  Se detecta en su primer cobro, que llega como desconocido (`B/09` §2.4), y la marca le propone a
  la persona devolverlo».

### F-8V1B2-009 — `S6` sobre una fila `ACTIVE` remite a `S5`, que no sale de `ACTIVE`

**Sigue llegando.** `B/03:148`: «el webhook se perdió o llegó tarde: **`S6` no ocurre** y lo que
corre es `S5`, con sus condiciones». `B/05:280`: «entra `GRACE_PERIOD → ACTIVE` (`S5`) o `SUSPENDED
→ ACTIVE` (`S7`)».

**Aplicación.** `B/03` §3.2, fila `S6`, guarda: después de «lo que corre es `S5`, con sus
condiciones» agregar «**—sobre una fila `ACTIVE`, que no tiene grace que apagar, lo que corre es
`P1` sobre ese cobro, creando la fila de `payment` si no existe, con la misma regla de asiento de
`S5`—**».

### F-8V1B2-010 — dos filas del catálogo de marcas omiten a uno de sus escritores

**Sigue llegando.** Motivo 8 (`B/02:926`): «`S14`, desde la rama de fallo de `S10`; **y la quinta
comprobación** del `B/09` §3», sin `S33`, que sí lo abre (`B/03:175`: «**Si la relectura sigue
viendo `paused`, `S33` no ocurre**: la fila se queda `PAUSED`»). Motivo 6 sin la re-vinculación
(`B/09:75`: «`TRANSICIÓN_NO_DECLARADA`** (`B/02` §2.5, motivo 6) y lo mira una persona»).

**Aplicación.** `B/02` §2.5: motivo 8, «desde la rama de fallo de `S10` **o de `S33`**»; motivo 6,
agregar «**y desde la re-vinculación rechazada del `B/09` §2.4, cuando lo que llega no es un
cobro**» (la mitad con cobro es el 7, ver `F-8V1B3-001`). Los conteos no se mueven: los dos siguen
abiertos por `S14`.

### F-8V1B2-011 — la lista de salidas del grace omite el espejo

**Sigue llegando.** `B/03:1557`: «Sub-estado de Suscripción con reloj propio. Entra por `S4` y sale
por `S5`, por `S6` o por», sin el espejo, que desde el grace sigue ocurriendo (`B/03:378`:
«**Desde `GRACE_PERIOD` sigue ocurriendo**, pero ya como salida de un estado alcanzable»).

**Aplicación.** `B/03` §4, después de «o por `S26`, que la manda a `CANCEL_SCHEDULED` […]» agregar
«**, o por el espejo de la baja decidida por el proveedor** (§10.1), con las dos salvedades de ese
par —`S16` y `S6`—».

### F-8V1B3-007 — `B/09` atribuye a `EX-15` que cancelar no emite webhook

**Sigue llegando.** `B/09:180`: «cancelar **no emite webhook** (`EX-15`), así que si la llamada no
se aplicó». `B/09:274`: «y **mutar o cancelar no emite webhook**». La matriz dice lo contrario
(`D/06:335`: «Crear, pausar, reanudar y cancelar **sí** notifican.»).

**Aplicación.** En `B/09:180`, tachar «cancelar **no emite webhook** (`EX-15`), así que si la
llamada no se aplicó» y escribir «el aviso de cancelación existe **sólo si la cancelación se
aplicó** (`EX-15` mide que cancelar sí notifica), así que si la llamada no se aplicó». En
`B/09:274`, tachar «y **mutar o cancelar no emite webhook**» y escribir «y **mutar no emite webhook,
y cancelar sólo avisa si se aplicó**».

---

## 4. Preguntas al owner

### G3-1 · ¿El cobro en vuelo del corte que sale bien se le propone devolver?

**Una línea**: un cobro del preapproval viejo que entra **después** de la cancelación del paso 1b
no le compra nada a nadie, porque el cliente arranca de cero con trial: ¿la marca le propone a la
persona devolverlo?

**Por qué es del owner.** `DEC-MIG-005` resignó la diferencia de la rama de aborto (`D/26-10:23`:
«**no se devuelve**: quien se re-suscribe arranca un trial nuevo desde cero»). No habló de un cobro
en vuelo del corte que sale bien. Y la cartera se trata como cliente nuevo, que es un dato decidido.

1. **Se propone devolver, y confirma una persona.** El cobro va a `COBRO_POSTERIOR_A_LA_BAJA`, con
   **SÍ** y default devolver (`B/19` §6). Costo: una confirmación por cobro, sobre tres clientes y
   una ventana de minutos. Riesgo: ninguno de diseño, porque el default no ejecuta nada y quien lo
   mira puede negarse si se habló otra cosa con el cliente. Capítulos: los textos de R4, tal cual.
2. **No se devuelve.** Extiende el espíritu de 2d. El cobro se asienta sobre la lápida sin marca y
   se declara en el «NO cierra» de `B/21`. Costo: no hay trabajo manual. Riesgo: el cliente pagó un
   mes que no usa, lo ve en su resumen y puede desconocerlo ante el banco, y el comprobante de ese
   cobro ya no existe de nuestro lado (`B/21` «NO cierra»). Capítulos: `B/21` §2.5 y «NO cierra»,
   `B/09` §3 (la lápida sale de la comparación de cobros), `B/05` §3 (la lápida no entra al
   desempate).

**Recomendación: la 1.** No decide la plata por adelantado: se la pone delante a una persona con
la propuesta correcta, y el owner ya llama a esos clientes uno por uno. La 2 es coherente con 2d y
el owner podría elegirla. Su costo es que la herramienta no dice nada de un cobro que el cliente sí
ve, y eso es lo que R4 vino a cerrar.

**Juan.** Juan es uno de los tres clientes. A las 13:35 el paso 1b cancela su preapproval; a las
14:02 el proveedor procesa un cobro de ARS 18.000 que ya estaba en vuelo, y el aviso llega al
sistema nuevo. Con la 1, la bandeja le muestra a la operadora «cobro posterior a la baja, proponer
devolver»: ella lo confirma, o lo niega porque el owner ya acordó con Juan otra cosa. Con la 2, el
cobro queda asentado y nadie lo mira. Juan arranca su trial, y un mes después pregunta por esos
18.000.

### G3-2 · ¿Dónde vive un preapproval desconocido que no nombra ninguna fila nuestra?

**Una línea**: el cobro de un preapproval que no nombra ninguna fila no tiene suscripción de la que
colgar la marca ni el `payment`. ¿Qué fila se le da?

1. **Una lápida de recepción.** El webhook escribe una `subscription` en `CANCELLED` con su
   `provider_link` y la forma de fila que R6 le dé a la lápida del corte. Sobre ella cuelgan el
   `payment` y la marca: `PAGO_TARDÍO_RECHAZADO` si trae cobro, `TRANSICIÓN_NO_DECLARADA` si no. El
   cobro siguiente del mismo preapproval ya es conocido y se cuelga de la marca abierta, así que la
   sonda del owner da un solo caso acumulativo. Costo: una escritura en el handler. No suma motivo
   ni entidad. Riesgo: depende de que R6 resuelva las columnas de la lápida sin fuente (usuario,
   plan). Capítulos: `B/09` §2.4, `B/21` §2.5, `B/02` §2.2 (nota en la lápida).
2. **La marca y el pago sin suscripción.** `reconciliation_mark` y `payment` pasan a admitir una
   referencia al id del proveedor en lugar de la suscripción, con CHECK de exactamente una. Costo:
   dos cambios de esquema y un tercer caso en todo lo que lee esas FK, incluido `refund`. Riesgo:
   cada consumidor de la marca que supone una suscripción se rompe. Capítulos: `B/02` §2.2 y §2.3,
   `B/03` §6.1, `B/19` §6.
3. **Declararlo.** Queda en la correlación de logs, sin listado accionable. Costo: nada. Riesgo:
   mueve plata sin que nadie la vea, así que no cumple la condición de residuo de `DEC-METH-015`.

**Recomendación: la 1.** Reusa la forma de fila que el corte ya necesita: todo lo que viene de
afuera y no nombra una fila nuestra se asienta igual, se escriba a mano o al recibirlo. No suma un
motivo a los 22 ni una acción a las 14. La 2 es más «pura» y el owner podría preferirla si R6
elige un tipo de fila propio para la lápida. En ese caso, la lápida de recepción usa ese tipo y la
diferencia entre las dos opciones desaparece.

**Juan.** El censo no vio el preapproval viejo de Juan (`F-8V1B3-005`), que cobra ARS 18.000 un mes
después del corte. Con la 1, el aviso escribe la lápida de recepción y la marca «pago tardío,
proponer devolver», y la operadora devuelve desde el `payment` por `RF1`. Con la 3, el cobro queda
en un log. Juan lo ve en la tarjeta y el sistema no tiene nada que mostrarle a nadie.

---

## 5. Trabajo de aplicación sin decisión

1. `B/05` §3, fila 1 de las cuatro condiciones: la columna «qué pasa» pasa a «cualquier otro
   estado» y remite al desempate (§2.1).
2. `B/05` §3, tabla de desempate: las tres filas nuevas por criterio, la lista de lo que no se
   desempata y la frase de los dos productores (§2.1).
3. `B/05` §2 `C2`, primera fila: extensión con `max` (§2.1).
4. `B/03` §3.2 `S11`: la extensión es `max(vigente, fórmula)`; `S26`: remite a ese `max` (§2.1).
5. `B/02` §2.5, «quién abre» de los motivos 2, 3, 7 y 19: los dos productores, y el 19 sólo sobre
   una fila que puede recibir (§2.1).
6. `B/09` §3, fila «cobros del período»: el 19 sólo sobre una fila que puede recibir, el resto por
   el desempate, y la lápida comparada desde su fin de servicio (§2.1).
7. `B/21` §2.5: el fin de servicio de la lápida es el instante del paso 2; ⚠️ sobre la fecha de
   aprobación sin medir (§2.1). **Condicionado a G3-1**: si el owner elige la 2, este punto y el 6
   se reescriben con su texto.
8. `B/02` §2.2 `provider_link`: la suscripción, `UNIQUE(subscription_id)` y el valor del
   `external_reference` (§2.2).
9. `B/09` §2.4: el `external_reference` es el `id` de la fila (§2.2); el desconocido con cobro que
   nombra una fila vinculada va a `PAGO_TARDÍO_RECHAZADO` (§3, `F-8V1B3-001`).
10. `B/09` §7: reuso sólo del `pending` que nombra la fila, duplicados cancelados, regla tras la
    búsqueda vacía, y la escritura nueva en el párrafo de idempotencia (§2.2).
11. `B/09` «NO cierra»: el `pending` duplicado que aparece después de `S2` (§2.2).
12. `B/03` `S14` y `S15`: colgar un pago sube la versión de la marca, y `S15` escribe contra ella
    (§3, `F-8V1B2-001`).
13. `B/03` §10.1, par `cancelled` × vivo: salvedad de `S6` por reloj agotado; y «NO cierra» de
    `B/03`: `S6` por su segundo o tercer evento que muere entre la llamada y la escritura
    (§3, `F-8V1B2-004`).
14. `B/05` §3, excepción: toda condición sobre la predecesora en curso va a `S19`; `B/02` §2.2: la
    marca bloquea la **escritura** de `sucede_a` (§3, `F-8V1B2-005`).
15. `B/03` `S31`: misma transacción que `S6`/`S12` (§3, `F-8V1B2-006`).
16. `D/16` §4.2 paso 2 y §4.3: el gate cubre ids conocidos, y el residuo queda declarado (§3,
    `F-8V1B3-005`).
17. `B/03` `S6`: sobre `ACTIVE` corre `P1`, no `S5` (§3, `F-8V1B2-009`).
18. `B/02` §2.5: `S33` en el motivo 8, la re-vinculación sin cobro en el 6 (§3, `F-8V1B2-010`).
19. `B/03` §4: el espejo entre las salidas del grace (§3, `F-8V1B2-011`).
20. `B/09` §3, dos frases sobre `EX-15` (§3, `F-8V1B3-007`).

Ninguno mueve las cifras cerradas: 22 motivos (7 SÍ, 3 puede, 12 no), `S14` abre 12 y otros actos
10, y siguen siendo 14 acciones administrativas.

---

## 6. Key Learnings

1. Un desempate escrito por criterio —«qué acto dejó cobrando un preapproval»— cubre sin
   enumerar a la lápida, a `CHARGE_DECLINED` y a `ABANDONED`; el escrito por transiciones deja
   afuera toda fila que nace a mano, y el propio `B/21` ya lo advertía.
2. El segundo productor de una marca tiene que pasar por la misma tabla: el defecto de R4 no era
   un motivo faltante, era que `COBRO_SIN_REGISTRAR` se abría sin preguntar si la fila podía
   recibir el cobro.
3. Sobre una fila escrita a mano en el corte, toda comparación que lee el historial del proveedor
   necesita un corte temporal. La columna de fin de servicio ya lo daba, sin columna nueva.
4. «Vínculo vivo» sobre una entidad sin estado se arregla quitando el adjetivo:
   `UNIQUE(subscription_id)` convierte la precondición en «existe o no existe».
5. Una «extensión» que se recalcula con la fórmula de otra fila puede acortar. Toda extensión de
   una fecha de fin se escribe como `max`.
6. La regla de la marca que bloquea la sucesión se leía como invariante y rompía una sucesión ya en
   curso. Leída al escribir `sucede_a`, cumple su propósito y deja de chocar con `S19`.
7. De los 18 hallazgos, sólo dos piden al owner. El resto lo contesta el diseño vigente, y hacía
   falta escribirlo en el lugar donde un implementador lo va a buscar.
