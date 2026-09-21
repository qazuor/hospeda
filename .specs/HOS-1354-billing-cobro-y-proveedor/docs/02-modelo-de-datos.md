---
title: Master Spec 02 — Modelo de datos
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 2
cierra:
  - C-ARCH-01
  - S-ARCH-01
  - M-ARCH-02
  - M-DATA-01
---

# 02 · Modelo de datos

La mitad de billing del capítulo 02 del programa. La otra mitad vive en la épica de verticales; lo transversal, en el núcleo.

---

## 2. Las entidades

### 2.1 Catálogo comercial

**Las otras cinco entidades del catálogo comercial — `vertical`, `plan`, `plan_version`, `plan_version_entitlement` y `plan_version_limit` — viven en la épica de verticales. Acá sólo `billing_option`.**

| entidad | qué guarda | restricciones |
|---|---|---|
| **`billing_option`** | el ciclo y su precio: mensual, trimestral, semestral o anual (§19), monto y moneda | `UNIQUE(plan_version_id, ciclo)` |

**El precio cuelga de la versión, no del plan**, y eso es lo que hace cumplible al §29: cambiar
un precio crea una versión nueva, así que «mostrar precio anterior/nuevo» pasa a ser
demostrable contra un registro en vez de una afirmación (`DEC-ARCH-001`).

**La moneda existe en el modelo aunque hoy tenga un solo valor.** Está medido que el proveedor
sólo acepta ARS —`USD` y `BRL` dan `400` (`EX-18`)—, pero el §57 pide que el dominio no quede
acoplado a Mercado Pago. La columna existe con una restricción que hoy admite un valor; sacarla
obligaría a una migración de esquema el día que haya un segundo proveedor, y agregarle un valor
a la restricción no obliga a nada.

### 2.2 Compromiso y ciclo de vida

| entidad | qué guarda | restricciones |
|---|---|---|
| **`subscription`** | `user`, vertical, versión de plan anclada, billing option, estado, período actual, fecha de fin de servicio, clase (principal o de complemento), **`sucede_a`** y **`sucedida_por`** (dos FK anulables a `subscription`, y **nunca las dos puestas en la misma fila**), **`requiere_conciliación`** (booleano) y **la fecha de primer cobro con la que nació la fila** | **dos** índices parciales, no uno — ver abajo. Es el §11, **impuesto por la base y no por un chequeo** |
| **`subscription_pause`** | suscripción, **motivo** (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin real | a lo sumo una sin `fin_real` por suscripción |
| **`provider_link`** | el id del proveedor de una suscripción, cuál es el proveedor, y **la última `version` del recurso que aplicamos** | **`UNIQUE(proveedor, id_del_proveedor)`**. Es la condición de que la conciliación exista: `DEC-CONC-002` la apoya en **nuestro** inventario, y una suscripción cuyo id se pierde **es invisible para el barrido** |

> La `version` es el contador monótono por recurso que trae cada evento (`EX-2`). Guardarla es lo
> que permite descartar un evento viejo sin gastar una relectura (cap. 03 §10.1) y lo que hace
> visible el caso en que el recurso cambió **sin** que el proveedor avisara — mutar el monto lo
> salta sin emitir ninguna entrega (`EX-15`).

**El compromiso y la sucesión son dos cosas, y se escriben como dos claves.** Una sola clave estaba
haciendo cumplir dos invariantes distintos —*«un compromiso comercial por vertical»* y *«una
autorización de cobro por vertical»*— con el conjunto de estados como proxy de los dos a la vez, y
por eso fallaba en las dos direcciones: lo que incluía de más bloqueaba un compromiso que todavía
no existe, y lo que excluía de más liberaba una autorización que sigue viva.

```text
-- A · el compromiso: a lo sumo UNA fila principal de origen viva por user + vertical
UNIQUE (user_id, vertical)
  WHERE clase = principal
    AND sucede_a IS NULL
    AND estado ∈ {vivos}

-- B · la sucesión: a lo sumo UNA fila principal sucesora viva por user + vertical
UNIQUE (user_id, vertical)
  WHERE clase = principal
    AND sucede_a IS NOT NULL
    AND estado ∈ {vivos}
```

**El máximo de filas principales vivas pasa de una a dos, y no a un número abierto.** Dos,
exactamente: un origen y su única sucesora. Es el número que `DEC-SUB-006` pide y ni uno más. Y
**una sucesión no es una cadena**: al indexar `B` sobre `(user_id, vertical)` —y no sobre
`sucede_a`— una sucesora no puede ser sucedida mientras viva, sin ninguna regla extra, porque la
segunda sucesora colisiona con la primera.

**El candado `A` no puede quedar vacío mientras haya una fila viva, y por eso el cierre no espera
la autorización.** Los dos índices reparten a las filas vivas por su **propia** columna, y ninguno
de los dos puede mirar el estado de la otra fila: si la predecesora se muere sola —`S12`, `S16` o el espejo del §10.1,
tres de las siete transiciones que `B/03` §3.2 recorre— la sucesora sigue con `sucede_a` no nulo, o
sea en `B`, y **`A` queda libre para un alta nueva**. Ahí hay dos preapprovals que pueden cobrar
sobre el mismo `user + vertical`, y `EX-6` mide que el proveedor no frena la segunda. La base no
lo puede impedir sola, así que lo impide **el acto**: `S18` cierra la sucesión en cuanto la
predecesora deja de ser fila viva, aunque la sucesora siga en `PENDING_AUTHORIZATION`, y con eso
la sucesora pasa a `A` y el segundo `INSERT` lo rechaza la base (`B/03` §3.2 y §3.4 punto 4).

**Y hace falta una segunda columna, porque los candados leen una columna que se borra.**
`sucede_a` es **operativa**: mientras está puesta **sobre una fila viva** la sucesión está en
curso, y `S18` la limpia al
cerrarla para que la sucesora vuelva a ocupar el candado `A`. Eso es correcto para los candados y
destruye la única evidencia de que esa cancelación **fue una sucesión y no una baja** — y hay
consumidores que la necesitan **después**, cuando ya se borró:

| quién pregunta | qué pregunta | dónde |
|---|---|---|
| los complementos | *«la suscripción de la que cuelgo dejó de ser fila viva, ¿la releva una sucesión —cerrada por `sucedida_por`, o en curso por una fila viva con `sucede_a` apuntándola—, la releva un grant permanente, o quedé huérfano?»*. Lee **las dos columnas** porque su pregunta abarca la línea de tiempo entera, y `sucedida_por` recién existe cuando `S18` cierra. La tercera mitad —el grant— no se lee sobre estas columnas sino sobre las anclas del §2.4 | `B/16` §4.2 |
| el pago tardío | del lado de `sucede_a`, *«¿la está por superar una sucesora **viva** que todavía no autorizó?»*, que es la mitad que decide entre reactivar y dejar el pago pendiente (`B/03` §3.2, `S19`). Del lado de `sucedida_por` pregunta *«¿ya fue superada?»*, y esa mitad **es redundante con su condición 1** —una fila con `sucedida_por` está `CANCELLED` y la 1 ya la rechaza—: se conserva para que el evento crítico diga cuál de las dos cosas pasó, **no porque la columna le haga falta** | `B/05` §3, condición 3 |

**`sucedida_por` es esa evidencia, y es durable.** Se escribe **en la predecesora**, en el mismo
acto en que `S18` limpia `sucede_a` en la sucesora, y **no se borra nunca**. Las dos columnas
parten la vida de la relación en cuatro, sin superponerse:

- `sucede_a` no nulo **en una fila viva** → **sucesión en curso**. La escribe `S1`, la limpia `S18`.
- `sucede_a` no nulo **en una fila que ya no es viva** → **sucesión muerta sin cerrarse**: la
  sucesora venció su ventana (`S3`) o la mató `S13`, y **nadie limpia el puntero**. Es deliberado —
  `S13` lo llama *«el registro fiel de lo que pasó»* (`B/03` §3.2)— y es la razón por la que **el
  adjetivo «viva» es parte del predicado y no un adorno**: sin él, la predecesora de una sucesión
  que murió sigue siendo *«la predecesora de una sucesión en curso»* para siempre, con `S5`, `S6` y
  `S7` apagados y un pago retenido de por vida.
- `sucedida_por` no nulo → **sucesión terminada**. La escribe `S18`, no la limpia nadie.
- las dos nulas → **no hubo sucesión**, que es el caso de casi toda fila.

> **El puntero no tiene limpiador y no lo va a tener.** Limpiarlo borraría el único registro de que
> hubo un intento de cambio de plan, que es lo mismo que `sucedida_por` existe para evitar del otro
> lado. Lo que se acota es **la lectura**: todo predicado que pregunte por `sucede_a` pregunta
> además por el estado de quien lo escribió, y la condición **se vuelve a evaluar** porque es sobre
> un estado. El inventario de los que lo hacen está en `NUCLEO/01` §2.4.
>
> **Una regla sobre una sucesión se escribe nombrando la COLUMNA, nunca el verbo «declarar».**

**No es prolijidad: el verbo ya se usa con los dos sujetos y eso costó un doble cobro.** *«La fila
declara una sucesión»* de `S1` nombra a **la sucesora** —es la que se inserta con `sucede_a`
puesto— y la regla de la marca, unas líneas más abajo, decía *«no se puede declarar una sucesión
sobre esa fila»* nombrando a **la predecesora**, que es la que está siendo sucedida —por eso hoy
está reescrita como *«no puede ser sucedida»*—. Las dos lecturas eran razonables y estaban a
quince líneas de distancia. Una regla del `B/12` §5.3 se escribió sobre
*«una fila que ya declaró sucesión»* queriendo decir la predecesora, y leída al pie de la letra
eximía a la sucesora —donde era vacua— dejando intacto el caso que venía a cerrar.

**Las dos columnas dan los nombres que no se pueden leer al revés**, y son los que el resto del
corpus usa: la **sucesora** es la fila **con `sucede_a`**; la **predecesora** es la fila **a la
que un `sucede_a` apunta** mientras la sucesión está en curso, y la que **tiene `sucedida_por`**
una vez cerrada.

**Y «predecesora de una sucesión en curso» exige que la sucesora esté VIVA**, en toda aparición
del predicado y sin excepción. `B/16` §4.2 ya lo escribía así desde que existe y dejó escrito por
qué: *«la fila viva es parte del predicado, no un adorno»*. Sin el adjetivo el predicado **no
tiene forma de dejar de cumplirse**, porque nada limpia el puntero. **El inventario de quién lo
lee vive en un solo lugar y es `NUCLEO/01` §2.4** — quien escriba un predicado nuevo sobre
`sucede_a` agrega ahí su fila en el mismo acto.

Apunta de la predecesora a la sucesora, y no al revés, porque el consumidor que más la necesita
—el addon— parte de la fila muerta y necesita **cuál** es la sucesora, no sólo que existe.

**Ninguna de las dos claves la mira**, y es deliberado: un índice sobre `sucedida_por` volvería a
atar una decisión de unicidad a un dato histórico. Los candados siguen partidos por `sucede_a`, y
`sucedida_por` sólo se lee.

Lo que esto NO hace es sacar `PENDING_AUTHORIZATION` de los vivos, que es la salida que parece
equivalente y no lo es: sin él **nada impide una tercera, una cuarta y una décima creación
simultánea**, que es lo que `DEC-CONC-001` fue a evitar.

**Los «vivos» siguen siendo los mismos seis**: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`,
`PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`. Quedan afuera `ABANDONED`, `CANCELLED` y
`CHARGE_DECLINED`, los tres porque **no tienen autorización que pueda cobrar**: `S3` canceló el
preapproval, la suscripción terminó, o el proveedor lo canceló de forma terminal al rechazar el
primer cobro (`B/12` §4.4).

> **Éste es el conjunto que `NUCLEO/01` §2.4 llama «fila viva» PARA UNA SUSCRIPCIÓN, y es de esta
> épica.** El término tiene dos sujetos y **el otro se enumera en el cap. 03 §8**: una instancia
> de addon es fila viva en `PENDING_AUTHORIZATION` y en `ACTIVE`, que son **dos** y no seis. El
> programa usa además la palabra *«vivo»* para dos cosas distintas. La otra
> —**«fuente viva»**— es la del contrato de cobertura, y **no coinciden**: cuatro de estos seis
> **no emiten ninguna fuente** (`12-contrato…` §2.6). Una condición de la épica de verticales que
> se escriba sobre las filas vivas de acá **no se puede evaluar** del otro lado de la frontera, y
> ése fue el origen de dos críticos opuestos sobre la misma transición.

**`RECONCILIATION_REQUIRED` ya no figura acá porque dejó de ser un estado** (`B/03` §3.1): es la
marca `requiere_conciliación` sobre la fila, que conserva el estado que tenía. La exclusión de hoy
estaba escrita con una razón buena —*«si una suscripción necesita intervención humana, la persona
tiene que poder contratar de nuevo sin esperar a que alguien resuelva un caso»*— **y su precio era
un doble cobro**: la fila salía de los vivos con su preapproval `authorized` intacto, porque `S14`
manda *«cero decisiones destructivas automáticas»*, y `EX-6` mide que el proveedor no frena la
segunda.

**La marca no contradice esa razón: la cumple mejor.** Con la marca la persona **no espera nada**,
porque no pierde el servicio que tenía mientras alguien mira el caso — así que no necesita
contratar de nuevo. La comodidad que la exclusión compraba deja de hacer falta, y la fila **ocupa**
el candado en vez de liberarlo. Es la única dirección en que este modelado aprieta la restricción
en vez de aflojarla.

**Y la marca sí bloquea algo, a propósito**: mientras esté puesta sobre una fila, **ningún
`sucede_a` puede apuntarla** — o sea que esa fila no puede ser sucedida. Cancelar y recrear con una divergencia de plata sin resolver es
exactamente el movimiento que `DEC-CONC-002` parte 4 manda que mire una persona.

**La excepción, y es una sola, y lleva una verificación que no es opcional**: una fila marcada
**puede suceder cuando está en `CANCEL_SCHEDULED`, si una relectura del preapproval por su id
confirma que efectivamente está cancelado**.

**La verificación es lo que la vuelve segura, y sin ella la excepción se apoyaba en lo que la marca
pone en duda.** El razonamiento era *«en ese estado `S11` ya canceló el preapproval, así que el
daño que la marca previene no puede ocurrir ahí»* — pero **la divergencia más probable sobre una
`CANCEL_SCHEDULED` es justamente que esa cancelación no se aplicó**, y es lo que pone la marca. La
excepción se concedía sobre la premisa que la alarma acababa de cuestionar, y el resultado es una
sucesora cobrando mientras el preapproval de la predecesora, vivo, cobra también.

Releer no agrega un mecanismo: `D5` ya manda verificar **releyendo y comparando campo por campo**
toda mutación en el proveedor, y `D6` prohíbe el **buscador**, no la lectura por id — que el mismo
diseño declara confiable. Y si la relectura dice que el preapproval **sigue vivo**, la marca hace
lo que tiene que hacer: bloquear.

Sin excepción alguna, en cambio, alguien que programó su baja, tiene una marca puesta y quiere
volver antes del vencimiento **se queda afuera sin haberlo elegido** — por eso la excepción existe,
y por eso se verifica en vez de suponerse.

**La fecha de primer cobro que se guarda es LA QUE EL PROVEEDOR CONFIRMÓ, no la que mandamos.**
`D8` —*«una fecha de primer cobro futura es la precondición de seguridad de todo cambio de plan o
de ciclo»*— era un invariante **recordable**; con la columna pasa a ser **verificable**, y su
incumplimiento es literalmente el doble cobro.

**Guardar la que mandamos no verificaba nada: verificaba el único dato que no podía estar mal.** El
dato que sí puede estarlo es lo que el proveedor efectivamente escribió, y si no lo respeta la
sucesora cobra en el acto con la predecesora viva — el cliente paga dos veces el mismo período y
**ningún mecanismo del diseño lo mira**.

**Y leerla no contradice `D6`, que fue la razón por la que se descartó.** `D6` dice que **el
buscador** del proveedor no es fuente de verdad de nada, y está medido por qué: ignora nuestra
referencia, devuelve todo, y con un estado inválido devuelve cero con `200` (`RC-1`). **Leer por
id es otra cosa y es `VERIFIED`** (`RC-2`), y `D5` ya obliga a hacerlo: *«toda mutación en el
proveedor se verifica releyendo y comparando campo por campo»*. La fecha se escribe en esa misma
relectura, que ya ocurre. El guard sigue corriendo sin red, porque lee la columna.

### 2.3 Dinero

| entidad | qué guarda | restricciones |
|---|---|---|
| **`payment`** | suscripción, monto, moneda, estado del cap. 03 §6, **id del hecho en el proveedor**, fecha del hecho, monto reembolsado acumulado | **`UNIQUE(proveedor, id_del_hecho)`** — es la deduplicación del cap. 03 §10.2 |
| **`refund`** | **el pago que se devuelve —un `payment` o un `manual_payment`—**, monto, motivo, estado, quién lo confirmó | el acumulado nunca supera el monto del pago |
| **`manual_payment`** | suscripción, estado del cap. 03 §7, quién lo registró, cuándo, comprobante | |
| **`receipt`** | pago, número, PDF. **Comprobante no fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, sin huecos |
| **`idempotency_key`** | la clave, a qué operación corresponde, su resultado | **`UNIQUE(clave)`**, y se persiste **antes** de la primera llamada al proveedor (`DEC-CONC-001`) |

**El monto es entero**, en la unidad mínima de la moneda. No hay decimales de punto flotante en
ninguna columna de dinero.

**El `refund` cuelga del pago que se devuelve, y ese pago puede no ser un `payment`.** La
versión anterior decía sólo *«pago»* y la única entidad con ese nombre es `payment`, que es *«el
registro de un hecho en el proveedor»* (`B/16` §3.1) — así que un pago manual, que por
definición no tiene hecho en el proveedor, **quedaba sin ningún lugar donde asentar su
devolución**. Y hay una rama que la ordena: `S19` retiene el pago del período impago **entre por
la puerta que entre** (cap. 03 §3.2), y las ramas 1 y 5 de `B/12` §5.3 mandan devolverlo. Sin
esta columna el período quedaba cobrado y sin asiento de reversa, que es lo que el §4.1 conserva
íntegro. **No hace falta un estado nuevo en la máquina del pago manual** (cap. 03 §7): el
`manual_payment` sigue `REGISTERED` porque el pago existió, igual que un `payment` reembolsado
conserva su hecho, y lo que registra la devolución es la fila de `refund` con **quién la
confirmó** — que es lo que `DEC-RF-002` exige y lo único que distingue este camino del
automático que esa decisión rechazó.

### 2.4 Capacidades y concesiones

| entidad | qué guarda | restricciones |
|---|---|---|
| **`addon_product`** | **precio, recurrencia y verticales compatibles**, más **`version_id`** → `addon_version` (épica de verticales), que es **la versión que se vende hoy**: la que una compra nueva ancla | `version_id` **no es anulable**: sin ella el producto no se puede comprar. **NO es la referencia que transporta una fuente `ADDON`** — ésa la aporta la instancia |
| **`addon_instance`** | producto, **la `addon_version` que ANCLÓ al comprarse**, dueño, **objetivo** (ficha, suscripción de vertical, usuario o global), estado, inicio, fin, su suscripción de complemento si es recurrente | el objetivo corresponde al tipo de scope del producto; **la versión anclada no es anulable** |
| **`promo_code`** | código, tipo, valor, scope de verticales, **cupo total**, ventana de validez, stackable, usable con otra activa (§31, `DEC-PROMO-001`) | `UNIQUE(codigo)` |
| **`promo_redemption`** | código, user, cuándo, sobre qué suscripción | **`UNIQUE(promo_code_id, user_id)`** — es el §31, «Cada user: máximo un uso de cada código». **La suscripción se re-apunta en `S18`** (§2.6) |
| **`courtesy_grant`** | beneficiario, días o meses, inicio, fin, quién lo firmó, motivo, **la suscripción que pausa** | el que firma es `SUPER_ADMIN` (`DEC-GRANT-002`); la suscripción **no es anulable** y **se re-apunta en `S18`** (§2.6); **sin `scope`** — la cortesía es por suscripción (`DEC-GRANT-006`) |
| **`permanent_grant`** | beneficiario, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas (§35.4). **El scope de verticales NO es una columna: son sus anclas** | ídem; **al menos un ancla**, o el grant no otorga nada |
| **`permanent_grant_vertical`** | **el ancla, una por vertical del scope**: el grant, la vertical, **el `plan` que otorga en esa vertical** y **el piso del trinquete de esa vertical** | **`UNIQUE(permanent_grant_id, vertical)`**; el plan **no es anulable** y **pertenece a esa vertical**; el piso tampoco es anulable |

**`addon_product` se partió por campo, igual que el catálogo de planes.** El corte del §11.2 —*«no
es por entidad, es por campo»*— dejaba a esta entidad entera del lado de billing con capacidades
adentro. Ahora **el precio y la recurrencia viven acá y qué otorga vive en `addon_version`** (épica
de verticales, `V/02` §2.1), que es lo que permite que verticales resuelva lo que un addon otorga
**sin preguntarle nada a billing**. La instancia **ancla** su versión, igual que una suscripción
ancla la suya.

**Las dos columnas apuntan a `addon_version` y NO contestan la misma pregunta.** Confundirlas es
exactamente el defecto que el anclaje vino a cerrar, y hasta acá la tabla lo declaraba al revés en
la fila del producto:

| columna | qué contesta | qué pasa al publicar una versión nueva |
|---|---|---|
| **`addon_product.version_id`** | **qué se vende hoy**: la versión que una compra nueva ancla | se re-apunta, y eso cambia **lo que se va a comprar** |
| **`addon_instance.addon_version_id`** | **qué se compró**: es la **única** referencia que el contrato transporta para una fuente `ADDON` | **no se mueve**: lo ya comprado no cambia |

> **La referencia de una fuente `ADDON` sale SIEMPRE de la instancia, nunca del producto**
> (`V/02` §2.1, `12-contrato-de-cobertura.md` §2.1 y §2.7).

**Y no es una regla propia de los addons: es la del catálogo, con las mismas palabras.** `V/10` §2
la enuncia para los planes —*«el catálogo es lo que se puede comprar hoy; la suscripción es lo que
se compró»*—. Leer `addon_product.version_id` para resolver una fuente viva es mezclar las dos
lecturas, y el desenlace está medido: quien compró *«+30 fotos»* pasaría a tener lo que diga la
versión nueva, **sin comprar nada y sin que nadie se lo avise** (`V/02` §2.1). Por eso
`addon_product` **no necesita declararse inmutable**: re-apuntarlo es cómo se publica una versión,
y con la referencia viviendo en la instancia esa mutación ya no alcanza a nadie que haya comprado.

**Las concesiones no modifican el plan ni la suscripción: son fuentes independientes.** El §36
dice que un entitlement sigue activo «mientras al menos una source exista», y eso sólo se puede
calcular si cada fuente es su propia fila. Una cortesía que editara la suscripción sería
irreversible sin adivinar qué había antes.

**Las dos concesiones ganaron la columna que las vuelve resolubles**, y es la misma regla en los
dos casos: `12-contrato-de-cobertura.md` §2.3 declara que **una fuente sin referencia resoluble no
se puede expresar**, así que ninguna de las dos columnas admite nulo.

- **`courtesy_grant.subscription_id`** — el mecanismo ya la presuponía y la fila no la guardaba.
  `DEC-GRANT-003` implementa la cortesía *«pausando en el proveedor y sosteniendo el servicio de
  nuestro lado»* y `B/14` §4.3 confirma que sobre un grant no se otorga porque *«no queda nada que
  no cobrar»*: las dos frases dicen que **una cortesía presupone una suscripción**, y la fila no
  decía cuál. Con la columna, la referencia que transporta el `tipo: CORTESÍA` es **la versión
  anclada de la suscripción que pausa** — la misma que llevaría `SUSCRIPCIÓN`. Lo que el `tipo`
  aporta es la distinción que sí importa: una `PAUSED` por `CUSTOMER_REQUEST` **no cubre** (`B/16`
  §2.2, *«el servicio está detenido»*) y una `PAUSED` por `COURTESY` **sí**, porque lo sostenemos
  nosotros.
- **`courtesy_grant` NO lleva `scope`: la columna se retiró** (`DEC-GRANT-006`, owner,
  2026-09-21). Una cortesía cubre **la suscripción que pausa**, y nada más. Para dar cortesía en
  dos verticales se otorgan **dos cortesías**, una por suscripción — la capacidad no se pierde;
  lo único que no existe es el gesto único.
  - **Por qué no podía significar lo que el grant significa.** Una suscripción es de **una**
    vertical (§2.2) y la cortesía transporta la versión anclada de **la** suscripción que pausa,
    así que emite **una** fuente, en esa vertical (`12-contrato…` §2.7, fila de `cortesía`). Un
    `scope` de dos verticales era **una columna que se puede escribir y no hace nada** — el modo
    de falla que `B/16` §2.4 nombra para rechazarlo.
  - **Por qué acá se decidió al revés que en el grant**, que es la pregunta que vuelve: «N grants»
    se rechazó porque **revocar es la acción administrativa más grave** (`NUCLEO/08` §3) y con N
    instrumentos pasa a ser N actos de los que se puede olvidar uno. **Una cortesía se vence
    sola**, así que no hay revocación que se escape. Misma regla, instrumentos con distinta forma
    de terminar.
  - **Desviación declarada del PDR §34**, que pide scope plural *«de forma equivalente al sistema
    de Free Forever»*: **los dos instrumentos no son equivalentes**. El Free Forever ancla un plan
    por vertical y **no necesita que exista nada previo**; la cortesía **pausa algo que ya
    existe**. La prueba es el hueco que la analogía deja: con scope plural, **qué hace la cortesía
    en una vertical donde el beneficiario no tiene suscripción**. El §34.1 contesta extendiendo el
    trial, el §34.2 sosteniendo el servicio —**no son el mismo mecanismo**— y para quien no tiene
    nada en esa vertical **no hay respuesta escrita**.
  - **Lo que queda fijado**: nadie puede emitir la cortesía en una segunda vertical transportando
    la versión anclada de la suscripción de la primera, que sería el defecto del grant con otro
    `tipo`. Y si alguna vez se quiere el gesto único, es **una acción de superficie** que otorga N
    cortesías en una transacción, **no una columna que vuelve al modelo**.
- **El ancla es POR VERTICAL, y por eso es una tabla y no dos columnas.** Un plan pertenece a **una**
  vertical (`V/02` §2.1, `UNIQUE(vertical, slug)`) y un grant emite **una fuente por cada vertical de
  su scope** (`12-contrato…` §2.7). Con un solo `plan_id` las dos fuentes transportaban **la misma
  referencia**, y la segunda vertical resolvía sus capacidades leyendo el plan de la primera: una
  clave de una vertical alimentada desde otra, que es lo que el §64.10 prohíbe. **`UNIQUE(permanent_grant_id, vertical)`
  más «el plan pertenece a esa vertical» es lo que hace que la fila mala no se pueda escribir** — y
  la base es el único lugar donde eso se puede impedir de verdad: la regla escrita en el contrato no
  alcanzó, y esta tabla es la mitad que faltaba.
- **Y sigue siendo UN grant, con N anclas.** No son N grants de una vertical cada uno: la firma, el
  motivo, el `includesAddons` y **la revocación** son del instrumento (`NUCLEO/01` §1.5), y partirlo
  convertiría *«la acción administrativa más grave»* (`NUCLEO/08` §3) en N actos que hay que acordarse
  de hacer juntos. El `scope de verticales` del §35.4 se audita leyendo las anclas, que es la única
  forma de que no pueda contradecirlas.
- **Cada ancla apunta a un `plan_id`, y NO a una versión.** El grant resuelve **la versión vigente de
  ese plan, vendible o no**, y `UNIQUE(plan_id) WHERE vigente` garantiza que esa versión es unívoca y
  siempre existe. Anclar a una versión fija lo dejaría congelado; leer *«la vigente y sólo si es
  vendible»*, como la pricing, lo dejaría **sin nada** el día que se retira el plan, porque retirar
  un plan se hace publicando una versión no vendible (`D13`, cap. 10 §3.2). La regla de lectura, con
  las seis lecturas del catálogo ordenadas, está en `V/10` §2.
- **`permanent_grant_vertical.piso_del_trinquete`** — **la referencia a la versión de ESE plan que
  estaba vigente el día que se firmó**, nunca una copia de sus valores, por la misma razón que el
  piso del trial (`V/02` §2.2: el §10.3 prohíbe copiar a mano, y una copia además queda
  desactualizada). Seguir la versión vigente expone al beneficiario a que el plan **empeore**: una
  versión que reparte distinto le saca algo a quien tiene un «para siempre», sin que nadie lo haya
  decidido para esa persona. **Un grant nunca otorga menos de lo que otorgaba el día que se
  concedió**, y el instrumento no es nuevo: es el piso de `V/15` §2.5 aplicado acá. **Hay un piso por
  ancla y se compara contra el plan de su propia vertical**: uno solo para N verticales compararía las
  claves de una contra lo que otorgaba el plan de otra.
- **Una vertical sin ancla no recibe nada, y es la respuesta al scope *«todas actuales y futuras»* del
  §35.1.** Una fuente sin referencia resoluble **no se puede expresar** (`12-contrato…` §2.3), así que
  el grant no emite fuente donde no ancló; extenderlo a una vertical nueva es anclarle un plan, un acto
  de `SUPER_ADMIN` que queda auditado. **Y no alcanza con que quede auditado: es una de las acciones
  del catálogo de `NUCLEO/08` §3 —la fila del grant permanente, con su permiso y su confirmación— y
  dispara `S13` sobre la vertical que se ancla** (`12-contrato…` §2.8, `B/03` §3.2). Anclar hace
  cubrir, y lo que cubre cancela la obligación de pago de esa vertical; sin esa mitad el
  beneficiario sigue pagando lo que se le acaba de regalar. **Desanclar no está declarado**, y no se
  infiere de que las anclas sean filas.

**Anclar no es ser.** Una suscripción ancla una versión de plan y no es un plan: el grant sigue
siendo la entidad independiente que `NUCLEO/01` §1.5 describe. Y el retiro ya estaba resuelto —
`D13`: *«retirar un plan del catálogo no mueve ninguna suscripción»*. La alternativa, que el grant
declarara su propio juego de claves, es la que sí rompe algo: crea **una segunda forma de declarar
entitlements**, que `V/02` §1.2 impide.

### 2.6 Qué cuelga de una suscripción, y qué le pasa cuando otra la sucede

**Un upgrade cancela y recrea** (`DEC-SUB-007` alternativa C), así que la fila que llevaba todo se
va a `CANCELLED` y **cada cosa que le colgaba tiene que tener un destino declarado**. El §2.4
nombraba las entidades y ninguna decía qué le pasa en una sucesión; `S18` enumeraba sus efectos y
nombraba una sola de las tres. **Enumerar acá es lo que vuelve la pregunta contestable de una
vez**, en vez de descubrirse entidad por entidad:

| qué cuelga | columna | qué pasa cuando `S18` cierra la sucesión | por qué |
|---|---|---|---|
| **complementos** (addons recurrentes y de única vez) | `addon_instance.objetivo` con scope `VERTICAL_SUBSCRIPTION` | **se re-apuntan a la sucesora** | el objetivo no desapareció, se sucedió (`B/16` §4.2). Sin esto, todo upgrade cancela de forma irreversible los addons que el cliente pagó |
| **la redención de promo** | `promo_redemption.subscription_id` | **se re-apunta a la sucesora**, y el descuento se vuelve a aplicar sobre el monto de ella con la regla de `B/14` §2.2 —porcentual se recalcula, fijo se traslada—, **con el contador de N cobros donde estaba** | `B/14` §2.2 ya declaraba el resultado (*«la sucesora lo hereda»*) y ningún acto lo ejecutaba. El descuento vive **mutado en el monto del proveedor** (`DEC-MP-001`) y ese monto muere con el preapproval que `S17` cancela, así que sin el re-apunte el cliente pasa a pagar precio de lista **y nada lo detecta**: el barrido compara contra el monto vigente, y el monto vigente de la sucesora **es** el de lista |
| **la cortesía vigente** | `courtesy_grant.subscription_id` (no anulable) | **se re-apunta a la sucesora**, y la sucesora **queda pausada con motivo `COURTESY` por los días que quedaban** | una cortesía *«cubre la suscripción que pausa, y nada más»* (`DEC-GRANT-006`): re-apuntarla sin pausar deja una fuente que no sostiene nada, porque el mecanismo de la cortesía **es** la pausa (`DEC-GRANT-003`). Y no re-apuntarla deja la columna no anulable señalando una `CANCELLED`, que no emite fuente (`12-contrato…` §2.6): el beneficio que firmó `SUPER_ADMIN` desaparece en silencio |
| **el pago pendiente por `S19`** | `payment.subscription_id` **o `manual_payment.subscription_id`** — `S19` retiene el pago del período impago **entre por la puerta que entre** (cap. 03 §3.2) | **no se re-apunta**: el pago es un hecho de la fila que lo cobró. `S18` le pone a **esa** fila la marca `requiere_conciliación` y el reembolso lo confirma una persona (`DEC-RF-002`), asentado en un `refund` sobre el pago que se devuelve (§2.3) | re-apuntar un cobro a otra fila falsearía el registro contable, que el §4.1 conserva íntegro. Lo que se mueve no es el pago sino **quién tiene que mirarlo** |
| **pagos y pagos manuales ya resueltos, comprobantes, pausas cerradas, el `provider_link`** | varias | **no se re-apuntan** | son el histórico de esa fila y de su preapproval. Cada suscripción tiene el suyo |

**Las tres primeras son el acto, la cuarta es el aviso, y la quinta es historia.** Es la
distinción que `S18` tiene que ejecutar y la que `G-R1-C` vigila: un cierre que escribe las dos
columnas y deja alguna de las tres primeras apuntando a la predecesora es un cierre incompleto,
no un cierre.

**Y las tres primeras tienen el mismo modo de falla: son silenciosas.** Ninguna emite webhook,
ninguna cambia un estado que el barrido compare, y las tres le sacan al cliente algo que ya tenía
—capacidad comprada, descuento pactado, cortesía firmada— en el acto con el que decidió gastar
más. Por eso el inventario va acá y no repartido en tres capítulos.

> **Y un grant NO es una sucesión: no re-apunta nada, y tampoco se lleva nada puesto.** `S13`
> alcanza *«toda fila viva **principal**»* (`B/03` §3.2), así que **no toca la suscripción de
> complemento** —que es una fila de esta misma tabla, con su `clase`—; y el addon tampoco queda
> huérfano, porque el grant **releva** a la principal en esa vertical (`B/16` §4.2, tercera
> mitad de la condición). De las cinco filas de arriba la única que un grant mueve es la cuarta
> —el pago pendiente por `S19`—, y la mueve **apagando la bandera**, no re-apuntándola (rama 4 de
> `B/12` §5.3). Lo que queda **abierto y no lo decide ningún capítulo** es si un grant con
> `includesAddons: true` tiene que convertir a costo $0 un complemento que el beneficiario ya
> venía pagando: hoy se sigue cobrando, porque ningún acto declarado lo apaga.

---

## 4. Retención: qué se borra, qué se anonimiza, qué se conserva · cierra `M-DATA-01`

### 4.1 La lista

| | qué | por qué |
|---|---|---|
| **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación legal y contable |

---

## 5. Las restricciones que sostienen los invariantes

El §64 lista 37 invariantes. Estos son los que **la base puede hacer cumplir sola**, y por eso
son los que no dependen de que ningún camino de código se acuerde:

| invariante del §64 | restricción |
|---|---|
| 8 · máximo una suscripción principal por vertical | **dos** `UNIQUE` parciales sobre los estados vivos, partidos por `sucede_a` (§2.2). El invariante cuenta **compromisos, no filas**: durante la ventana del cambio de plan hay dos filas y un solo compromiso de pago |
| 10 · una acción en una vertical no afecta a otra | **`UNIQUE(permanent_grant_id, vertical)` en `permanent_grant_vertical`, más «el plan del ancla pertenece a esa vertical»** (§2.4). Es la mitad del §64.10 que el scope estructural del cap. 17 **no** alcanza: ahí la resolución pide la vertical, pero el cruce venía **adentro** de la fuente |
| 19 · los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` en `payment` |
| 26 · producto ≠ instancia | son dos tablas, y la instancia no repite ningún campo del producto |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04 (núcleo). Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.
