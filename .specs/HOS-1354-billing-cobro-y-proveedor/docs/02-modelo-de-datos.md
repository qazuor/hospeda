---
title: Master Spec 02 — Modelo de datos
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
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
| **`subscription`** | `user`, vertical, versión de plan anclada, billing option, estado, **la fecha del próximo cobro**, fecha de fin de servicio, clase (principal o de complemento), **`sucede_a`** y **`sucedida_por`** (dos FK anulables a `subscription`, y **nunca las dos puestas en la misma fila**) y **la fecha de primer cobro con la que nació la fila**. **No lleva ninguna columna de conciliación**: la marca es una fila aparte —`reconciliation_mark`, abajo— y **`requiere_conciliación` pasa a ser un PREDICADO derivado**, *«esta fila tiene al menos una marca abierta»* (§2.5) | **dos** índices parciales, no uno — ver abajo. Es el §11, **impuesto por la base y no por un chequeo** |
| **`reconciliation_mark`** | la suscripción, el **motivo** (enumeración cerrada, §2.5), **`puesta_en`**, **`levantada_en`** y **quién la levantó** (las dos anulables). **Los pagos que hay que devolver no son una columna de acá**: cuelgan de la marca en `reconciliation_mark_payment`, abajo | **`UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL`**: una fila puede tener **varias marcas abiertas a la vez, una por motivo**, y el mismo motivo no se duplica sobre la misma fila. **`S15` levanta UNA marca, no la fila** |
| **`reconciliation_mark_payment`** | la marca y **un** pago que hay que devolver — FK a `payment` **o** a `manual_payment`, por la misma razón por la que `refund` admite las dos puertas (§2.3) —, **cuándo se colgó** y **si ya se resolvió**: `resuelto_en` y el `refund` que lo asienta, las dos anulables | **`UNIQUE(marca, pago)`**: el mismo pago no se cuelga dos veces de la misma marca. Una marca lleva **cero, uno o N**: cero en los motivos que no piden pago, **N cuando el hecho que la abre se repite ciclo a ciclo** |
| **`subscription_pause`** | suscripción, **motivo** (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin real | a lo sumo una sin `fin_real` por suscripción |
| **`provider_link`** | el id del proveedor de una suscripción, cuál es el proveedor, y **la última `version` del recurso que aplicamos** | **`UNIQUE(proveedor, id_del_proveedor)`**. Es la condición de que la conciliación exista: `DEC-CONC-002` la apoya en **nuestro** inventario, y una suscripción cuyo id se pierde **es invisible para el barrido** |

> La `version` es el contador monótono por recurso que trae cada evento (`EX-2`). Guardarla es lo
> que permite descartar un evento viejo sin gastar una relectura (cap. 03 §10.1) y lo que hace
> visible el caso en que el recurso cambió **sin** que el proveedor avisara — mutar el monto lo
> salta sin emitir ninguna entrega (`EX-15`).

**La marca es una por `(fila, motivo)` y los HECHOS que la sostienen son N, y por eso el pago dejó
de ser una columna.** La restricción de arriba es correcta y no se toca: dos marcas abiertas del
mismo motivo sobre la misma fila serían el mismo caso dos veces en el listado. Lo que estaba mal
era **colgar un solo pago de una marca cuyo hecho se repite**. Los motivos 2, 3 y 12 del §2.5 salen
de un preapproval que sigue cobrando **todos los meses** sobre una fila que ya no compra nada —el
caso que la salvedad 4 del `B/09` §3 existe para cubrir: *«cancelar no emite webhook, así que si la
llamada no se aplicó no hay ninguna otra vía de aviso y el primer aviso es el cobro»*—, y ahí los
hechos son **uno por ciclo**. Con una FK singular el segundo cobro **no tenía dónde escribirse**:
el `UNIQUE` rechazaba la marca nueva y el pago quedaba sin ninguna fila que lo nombrara.

**El desenlace que eso producía es peor que no tener marca**, y conviene decirlo porque es el que
justifica la entidad: el listado le mostraba a la persona **un** pago con el default en devolver,
la persona devolvía **ése**, `S15` levantaba la marca y el caso se cerraba con los meses 2 a N
cobrados, sin `refund` y sin nadie que los mirara. Una marca muda decía *«hay un caso acá, andá a
mirar»*; una marca con un solo pago dice *«éste es el pago, devolvelo»*, **y la persona hace
exactamente eso**. Las tres consecuencias de la cardinalidad están escritas donde se ejecutan:
**el escritor acumula** en vez de rebotar (`B/05` §2 `C2` y `C3`, `B/03` §3.2 `S14`), **`S15` no
puede levantar una marca con pagos sin resolver** (`B/03` §3.2) y **el listado muestra cuántos y
por cuánto en total** (`B/19` §6).

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
tres de las ocho transiciones que `B/03` §3.2 recorre; y desde `DEC-SUB-014` también si se va
ella misma, por `S22`, `S23` o `S24`— la sucesora sigue con `sucede_a` no nulo, o
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
  sucesora venció su ventana (`S3`), la mató `S13` o la cortó `S28` al discontinuarse la vertical, y **nadie limpia el puntero**. Es deliberado —
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

#### La fecha del próximo cobro, y por qué no es la de primer cobro

**Son DOS columnas y confundirlas cuesta caro, así que van nombradas aparte.** *«La fecha de
primer cobro con la que nació la fila»* es **inmutable**: es la que el proveedor confirmó al
nacer, y existe para que `D8` sea verificable (arriba). *«La fecha del próximo cobro»* **se
mueve**, y es la misma cifra que el barrido compara contra `next_payment_date` (`B/09` §3).

**Se llamaba *«período actual»* y ese nombre se retira.** Nombraba un período —algo que se
atraviesa— cuando lo que la columna guarda es **una fecha**, y esa lectura es la que dejó a `MP5`
(`B/03` §7.2) disparando sobre *«el período actual arrancó»* mientras nadie declaraba quién
avanzaba un período.

**Quién la escribe depende de si hay débito en el proveedor, y son dos regímenes:**

- **Con débito**, las fechas las tiene el proveedor y son inmutables para nosotros (`EX-39`,
  `B/12` §5.4): la columna es **una copia**, y quien la escribe es la lectura del barrido —*«se
  registra»*, `B/09` §3—. **Ninguna regla del diseño la lee para decidir**, porque la decisión de
  cobrar es del proveedor.
- **Sin débito** —el pagador manual del §17.2, que *«no tiene nada que pausar porque no hay débito
  que detener»* (`B/06` §7)— **es la única copia que existe**, y sus escrituras están declaradas
  en las transiciones de `B/03` §7.2: `S2` la estrena, `MP1` y `MP4` la avanzan un ciclo al
  quedar registrada la cuota, y `S10` la avanza **tantos ciclos como hayan vencido durante la
  pausa, sin abrir cuota** —el espejo local de lo que el proveedor hace medido (`PS-6`) y
  `DEC-SUB-010` ya adoptó—. **Son tres y no hay una cuarta**: lo que la reapertura larga necesita
  no se escribe acá sino sobre el `período` de la cuota (§2.3, la **reimputación** de `MP4`), y el
  avance sale después de ese período nuevo. **Y la escritura de `S2` tiene acá población vacía**
  —no hay webhook de autorizada sobre una suscripción sin preapproval—, así que sobre un pagador
  manual **la estrena `MP1`** al registrar la primera cuota. **Su único lector es `MP5`.**

### 2.3 Dinero

| entidad | qué guarda | restricciones |
|---|---|---|
| **`payment`** | suscripción, monto, moneda, estado del cap. 03 §6, **id del hecho en el proveedor**, fecha del hecho, monto reembolsado acumulado | **`UNIQUE(proveedor, id_del_hecho)`** — es la deduplicación del cap. 03 §10.2 |
| **`refund`** | **el pago que se devuelve —un `payment` o un `manual_payment`—**, monto, motivo, estado, quién lo confirmó | el acumulado nunca supera el monto del pago |
| **`manual_payment`** | suscripción, **el período que cubre —identificado por su fecha de inicio**, que es el valor que *«la fecha del próximo cobro»* de §2.2 tenía cuando la cuota se abrió, **salvo que `MP4` la haya reimputado** (abajo)—, estado del cap. 03 §7, y —**sólo una vez registrado**— quién lo registró, cuándo, comprobante | **el período no es anulable**; los **tres del registro sí lo son**, y son nulos mientras la fila está `AWAITING`. **El monto no se guarda**: es el esperado para ese período, que se resuelve de la versión de plan anclada (`B/05` §3, condición 2) — copiarlo sería la copia a mano que el §10.3 prohíbe, y es además lo que hace que reimputar no cambie el monto esperado |
| **`receipt`** | pago, número, PDF. **Comprobante no fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, sin huecos |
| **`idempotency_key`** | la clave, a qué operación corresponde, su resultado | **`UNIQUE(clave)`**, y se persiste **antes** de la primera llamada al proveedor (`DEC-CONC-001`) |

**El monto es entero**, en la unidad mínima de la moneda. No hay decimales de punto flotante en
ninguna columna de dinero.

**El `refund` cuelga del pago que se devuelve, y ese pago puede no ser un `payment`.** La
versión anterior decía sólo *«pago»* y la única entidad con ese nombre es `payment`, que es *«el
registro de un hecho en el proveedor»* (`B/16` §3.1) — así que un pago manual, que por
definición no tiene hecho en el proveedor, **quedaba sin ningún lugar donde asentar su
devolución**. Y hay una rama que la ordena: `S19` retiene el pago del período impago **entre por
la puerta que entre** (cap. 03 §3.2), y las ramas 1, 5 y 6 de `B/12` §5.3 mandan devolverlo. Sin
esta columna el período quedaba cobrado y sin asiento de reversa, que es lo que el §4.1 conserva
íntegro. **No hace falta un estado nuevo en la máquina del pago manual** (cap. 03 §7): el
`manual_payment` sigue `REGISTERED` porque el pago existió, igual que un `payment` reembolsado
conserva su hecho, y lo que registra la devolución es la fila de `refund` con **quién la
confirmó** — que es lo que `DEC-RF-002` exige y lo único que distingue este camino del
automático que esa decisión rechazó.

**Y la fila de `manual_payment` nace VACÍA de registro, porque desde `MP5` la crea el sistema y no
una persona** —un reloj de la segunda cuota en adelante, el alta la primera (`B/03` §7.2)—. La cuota se abre al inicio del período —*«el mismo instante en que el proveedor
habría cobrado»*, `B/03` §7.2— y recién `MP1` o `MP4` escriben quién la registró, cuándo y con
qué comprobante: esos tres eran *«lo que guarda»* la fila y **no se pueden escribir al crearla**,
así que son anulables y nulos mientras esté `AWAITING`. **El período sí se escribe al crearla, y
no es una columna nueva de acá**: el `UNIQUE(subscription_id, período)` de `B/05` §C5 ya la
presuponía, y sin ella ni ese candado ni la condición 2 del `B/05` §3 —*«el monto esperado para
el período que cubre»*— tienen contra qué evaluarse. Es lo único que este arreglo le agrega a la
entidad: **no hay estado nuevo** (arriba) y **no hay columna de monto** (la resuelve la versión
anclada).

**Y el período se identifica por su fecha de inicio, que es lo que vuelve evaluables al candado y
a la idempotencia.** *«Ya existe una cuota para ese período»* —la condición de `MP5`— y
*«`UNIQUE(subscription_id, período)`»* piden que dos períodos se puedan distinguir, y lo único que
los distingue es cuándo arrancan. Al abrirse, la cuota copia la fecha del próximo cobro vigente
(§2.2) —**salvo la primera de un pagador manual, que se abre en el alta, cuando esa columna
todavía no existe: su período es el instante del alta**, y es `MP1` al registrarla el que estrena
la fecha (`B/03` §7.2)—; al registrarse, esa fecha avanza. **Por eso el avance de `B/03` §7.2 no
puede colisionar**:
deja siempre una fecha **estrictamente posterior** a la anterior, y las cuotas que existen son las
de períodos que arrancaron antes.

**El `período` se escribe DOS veces y no una, y la segunda es la reimputación de `MP4`.** La
primera es la de la creación, arriba. La segunda corre **sólo** cuando `MP4` registra un pago sobre
una cuota **cuyo período ya terminó** —la suspensión duró más que un período—: ahí la cuota pasa a
cubrir el período que arranca en la reactivación, porque registrarla contra el período viejo le
cobra a la persona uno que transcurrió entero sin servicio y deja la fecha del próximo cobro donde
`MP5` abre otro en la misma corrida (`B/03` §7.2, *«al reabrir por `MP4`»*). **No rompe nada de lo
de arriba**: el período sigue sin ser anulable, sigue identificando la cuota por su fecha de
inicio, y el `UNIQUE` no tiene contra qué chocar porque durante la suspensión no se creó ninguna
cuota. **Y no cambia el monto esperado**, que sale de la versión de plan anclada y no del período.
La escritura **se asienta en el evento de dominio de `MP4`** —la regla 4 del `NUCLEO/03` §1—, con
el período que la cuota tenía y el que pasó a cubrir.

### 2.4 Capacidades y concesiones

| entidad | qué guarda | restricciones |
|---|---|---|
| **`addon_product`** | **precio, recurrencia y verticales compatibles**, más **`version_id`** → `addon_version` (épica de verticales), que es **la versión que se vende hoy**: la que una compra nueva ancla | `version_id` **no es anulable**: sin ella el producto no se puede comprar. **NO es la referencia que transporta una fuente `ADDON`** — ésa la aporta la instancia |
| **`addon_instance`** | producto, **la `addon_version` que ANCLÓ al comprarse**, dueño, **objetivo** —su scope es uno de los cuatro del §40 y se escribe **con la grafía del §40, no con una prosa equivalente**: `LISTING`, `VERTICAL_SUBSCRIPTION`, `USER` o `GLOBAL`—, estado, inicio, fin, su suscripción de complemento si es recurrente, **y el ancla del grant que sea su título, si lo es** | el objetivo corresponde al tipo de scope del producto; **la versión anclada no es anulable**. **El ancla del título apunta a `permanent_grant_vertical` y sí es anulable**: nula cuando el título es el ordinario de esa vertical, no nula cuando el addon vive de un grant. El contrato transporta ese scope como `alcance` y **colapsa `VERTICAL_SUBSCRIPTION` en `VERTICAL`** (`12-contrato…` §2.7): aquélla es la etiqueta de transporte, **ésta es la canónica** |
| **`promo_code`** | código, tipo, valor, scope de verticales, **cupo total**, ventana de validez, stackable, usable con otra activa (§31, `DEC-PROMO-001`) | `UNIQUE(codigo)` |
| **`promo_redemption`** | código, user, cuándo, sobre qué suscripción | **`UNIQUE(promo_code_id, user_id)`** — es el §31, «Cada user: máximo un uso de cada código». **La suscripción se re-apunta en `S18`** (§2.6) |
| **`courtesy_grant`** | beneficiario, días o meses, inicio, fin, quién lo firmó, motivo, **la suscripción que pausa**, **`saldo_días`** (anulable) y **el cierre de ese saldo: `saldo_cerrado_en` y `motivo_cierre`** (las dos anulables, `DEC-GRANT-011`) | el que firma es `SUPER_ADMIN` (`DEC-GRANT-002`); la suscripción **no es anulable** y **NO se re-apunta en `S18`** — `S18` cierra la cortesía sobre la predecesora y le escribe el `saldo_días`, y `S9` la re-emite sobre la sucesora cuando ésta autoriza (`DEC-GRANT-007`, §2.6). **`S25` es su segundo escritor**, con la misma columna y la misma forma: la pausa que no puede reanudar sobre un plan retirado difiere la cortesía en vez de perderla, y `S9` la re-emite sobre el alta nueva (`DEC-GRANT-010`, `B/14` §4.6); **sin `scope`** — la cortesía es por suscripción (`DEC-GRANT-006`). **Las dos columnas del cierre van juntas** —las dos nulas o las dos escritas—, igual que las tres de la revocación del grant, y **sólo se escriben sobre un `saldo_días` no nulo**: cerrar es un desenlace del saldo, no del instrumento |
| **`permanent_grant`** | beneficiario, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas (§35.4), **y la revocación: `revocado_en`, quién la firmó y su `motivo_de_revocación`, en texto libre** (`DEC-GRANT-008`) | ídem; **al menos un ancla**, o el grant no otorga nada. **`revocado_en` es anulable y es lo único que contesta si el grant sigue vivo** (`NUCLEO/01` §2.4): **nulo es un *grant vivo***, escrito es uno revocado. **Las tres columnas de la revocación van juntas**: las tres nulas o las tres escritas — ninguna de las tres se escribe sola. **Revocar NO borra ninguna fila** — ni ésta ni sus anclas. **El scope de verticales NO es una columna: son sus anclas**. **`UNIQUE(beneficiario) WHERE revocado_en IS NULL`**: a lo sumo **un grant vivo** por beneficiario, y lo garantiza la base (`DEC-GRANT-009`) |
| **`permanent_grant_vertical`** | **el ancla, una por vertical del scope**: el grant, la vertical, **el `plan` que otorga en esa vertical** y **el piso del trinquete de esa vertical** | **`UNIQUE(permanent_grant_id, vertical)`**; el plan **no es anulable** y **pertenece a esa vertical**; el piso tampoco es anulable. **El ancla no tiene estado propio**: es ***ancla viva*** si y sólo si su grant lo es (`NUCLEO/01` §2.4), y **la fila sobrevive a la revocación** |

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

**Y la instancia gana una TERCERA referencia, que no contesta ninguna de esas dos preguntas: de
qué TÍTULO vive.** Las dos de arriba dicen *qué otorga* el addon; ésta dice *quién lo sostiene*, y
hasta acá **no existía** aunque `B/16` §3.1 afirmara que sí —*«la instancia dice que su título es
el grant … un campo que el modelo ya necesita, no uno nuevo»*—. Es `F-8dA3-007` de la `FASE
8-bis-3`, y se escribe **una sola vez para sus dos orígenes**: el addon que el beneficiario
**elige gratis** (`B/16` §3.2) y el que venía pagando y `S20` **convierte a costo $0**
(`B/16` §3.4).

- **Apunta al ANCLA, no al grant.** Un grant es *«UN instrumento con UN ANCLA POR CADA VERTICAL»*
  (§2.4 más abajo, `12-contrato…` §2.8) y el título **es por vertical** (`B/16` §2.4): con *«el
  grant»* no se sabría **en qué vertical** ese addon es gratis, que es justo lo que el pliegue
  pregunta al resolver la fuente. **La segunda razón que se daba acá caducó y se retira**: decía
  que *«retirar una vertical cortaría los addons de las otras o no cortaría ninguno»*, y retirar
  una vertical **no es un acto declarado** —*«desanclar no está declarado»*, más abajo en este
  mismo §—, así que describía un camino inexistente. La de arriba alcanza sola.
- **Es anulable, y eso no contradice el `12-contrato…` §2.3.** Lo que esa regla prohíbe sin
  excepción es que **la fuente** quede sin referencia resoluble, y la referencia de una fuente
  `ADDON` es la versión anclada por la instancia, que **no** es anulable. Esta columna es otra
  cosa: **el vínculo con el título**, y para el addon comprado sobre una suscripción no hay nada
  que guardar —la validez se evalúa al comprar (`B/16` §2.2)— así que nula es su valor correcto.
- **Su consumidor es la tercera cláusula del evento de `A5`** (`B/03` §8), que corta el addon
  **cuando se revoca el grant del que cuelga ese ancla**. Sin la columna, esa cláusula no tiene
  sujeto y *«al revocar el grant el addon se corta»* (`B/16` §3.3) vuelve a ser una frase sin
  transición para los scopes `LISTING`, `USER` y `GLOBAL`. **La cláusula nombra la revocación y
  no el retiro del ancla**, justamente porque desanclar no está declarado; la columna sigue
  apuntando al ancla porque lo que hay que saber es **en qué vertical** era gratis, no cuál se
  retira.
- **Y tiene un SEGUNDO consumidor, que la lee DESPUÉS de la revocación**: la segunda mitad de la
  cuarta comprobación de cero llamadas (`B/09` §3), *«el ancla que era su título ya no es la de un
  grant vivo»*. Esa pregunta sólo se puede contestar si la fila del ancla **sigue existiendo**
  cuando el grant ya no está vivo, que es exactamente por qué revocar **marca y no borra**
  (más abajo, *«revocar retira las anclas como TÍTULO, no como FILAS»*).
- **La escribe `S20` ANTES de cancelar el cobro, y el orden es parte de la transición**
  (`B/03` §3.2). `S20` tiene dos escrituras sobre dos entidades y **la que cancela la suscripción
  de complemento saca la fila de su propio `desde`**: hecha primero, una corrida cortada dejaba la
  instancia `ACTIVE`, sin cobro y **con esta columna en nulo** —o sea con la tercera cláusula de
  `A5` sin sujeto y con el addon gratis para siempre—. Escribiendo el título primero, lo que queda
  es una instancia ya anclada y un complemento todavía vivo, que es un estado **reanudable y
  detectable**.

**Y el vínculo con la suscripción de complemento se lee ahora en las dos direcciones.** Hasta acá
sólo se leía hacia adelante —la instancia dice cuál es su cobro—, y la vuelta no tenía consumidor:
cuando la instancia se apagaba, **la fila de complemento se quedaba sin estado declarado** y el
único proceso que la miraba la seleccionaba por el estado terminal de la instancia (`B/09` §3,
salvedad 1). Su consumidor es **`S21`** (`B/03` §3.2), que la lleva a `CANCELLED` en el mismo acto
—**sin gracia, sin fecha de fin de servicio y sin reembolso automático** (`B/16` §4.4)—. **Sigue
siendo un preapproval y no dos**: el del addon recurrente es el de esta fila, así que la
cancelación que `A5` y `A6` declaran es la misma que `S21` registra localmente.

**Las concesiones no modifican el plan ni la suscripción: son fuentes independientes.** El §36
dice que un entitlement sigue activo «mientras al menos una source exista», y eso sólo se puede
calcular si cada fuente es su propia fila. Una cortesía que editara la suscripción sería
irreversible sin adivinar qué había antes.

**Las dos concesiones ganaron la columna que las vuelve resolubles**, y es la misma regla en los
dos casos: `12-contrato-de-cobertura.md` §2.3 declara que **una fuente sin referencia resoluble no
se puede expresar**, así que ninguna de las dos columnas admite nulo.

- **`courtesy_grant.saldo_días`** (anulable) — **dónde vive la cortesía entre que su suscripción
  muere y la sucesora autoriza**, que es lo único nuevo que `DEC-GRANT-007` pide. Nula en el curso
  normal; con un número, la cortesía está **diferida** (`NUCLEO/01` §2.6): `S18` la cierra sobre la
  predecesora y escribe ahí los días que le quedaban, y `S9` la re-emite sobre la sucesora cuando
  llega a `ACTIVE`, recalculando `inicio` y `fin` y **volviendo el saldo a nulo**.
  - **`subscription_id` sigue sin admitir nulo, y por eso el saldo es una columna aparte.** La
    regla de arriba —*«una fuente sin referencia resoluble no se puede expresar»*— no cede: la
    cortesía diferida **sigue apuntando a la predecesora**, que es el registro fiel de qué
    suscripción pausó, y **la sucesora se alcanza por `predecesora.sucedida_por`** (§2.2), que es
    la primera escritura que `S18` hace en el mismo acto. Anular la columna habría perdido el
    único puntero que lleva a la sucesora.
  - **Y por `S25` la columna sirve para lo mismo por otro camino, que es la razón de que no haya
    hecho falta una columna nueva.** Ahí **no hay sucesión** —`G-R1-A` no deja declarar una desde
    `PAUSED`—, así que `sucedida_por` es nulo y la fila nueva se alcanza por **el beneficiario y
    la vertical** de la suscripción muerta, que esta misma columna sigue apuntando. Las dos
    resoluciones salen del mismo puntero; lo que cambia es el salto que se da desde él.
  - **Y una cortesía diferida no emite ninguna fuente, sin que haga falta escribirlo en el
    contrato.** Lo que emite `tipo: CORTESÍA` es **el estado de la suscripción** —`PAUSED` por
    `COURTESY`—, y la predecesora está `CANCELLED`, que no emite nada (`12-contrato…` §2.6). Es la
    diferencia con el grant, que sí necesitó decirlo (`12-contrato…` §2.8): un grant emite por sí
    mismo, una cortesía emite **por la fila que pausa**.
- **`courtesy_grant.saldo_cerrado_en` y `courtesy_grant.motivo_cierre`** (las dos anulables) —
  **el saldo diferido tiene desenlaces que no son la re-emisión, y hasta `DEC-GRANT-011` no tenían
  dónde asentarse.** Cuando la fila que tenía que recibir el saldo **no va a existir nunca**, el
  saldo se **cierra**: se escribe la fecha y el motivo, y esa cortesía **ya no se re-emite**. `S9`
  no puede tomarla y la **sexta** comprobación del `B/09` §3 no la levanta, porque las dos leen
  *«cortesía diferida»* y el término excluye la cerrada (`NUCLEO/01` §2.6).
  - **`motivo_cierre` es una enumeración CERRADA y hoy tiene DOS valores**, uno por cada acto que
    puede cerrar un saldo:

    | `motivo_cierre` | quién lo escribe | cuándo |
    |---|---|---|
    | **`VENTANA_DE_AUTORIZACIÓN_VENCIDA`** | **`S3`** (`B/03` §3.2) | la sucesora abandonó el checkout, así que no hay ninguna fila viva en esa vertical a la que volver (`DEC-GRANT-011`) |
    | **`GRANT_PERMANENTE_OTORGADO`** | **`S13`** (`B/03` §3.2) | un *Free Forever* pasa a cubrir esa vertical —otorgado o con la vertical recién anclada—, así que no queda ningún cobro que la cortesía pueda evitar (`B/14` §4.3) |

    Misma regla que el catálogo de motivos de la marca (§2.5): **un cerrador nuevo agrega su fila
    acá en el mismo acto en que se escribe**, y el conteo se recalcula, nunca se incrementa. **Lo
    que la enumeración compra no es el nombre: es que cerrar sea un acto ENUMERADO**, así que un
    camino que se lleve puesta una concesión de `SUPER_ADMIN` sin estar en esta tabla **no tiene
    motivo que escribir** y `G-R1-F` lo rechaza (`B/20` §2). Los desenlaces que **no** cierran
    siguen sin fila acá y esa ausencia se lee: el saldo que difirió `S25` sobre una vertical
    discontinuada **queda diferido y sin emitir**, declarado y no resuelto (`DEC-GRANT-010`,
    `B/14` §4.6).
  - **Y por qué cerrada, si `DEC-GRANT-008` eligió texto libre para la revocación de un grant.**
    La razón que esa decisión escribe es que *«son concesiones firmadas a mano por `SUPER_ADMIN`»*,
    o sea que **hay una persona escribiendo el motivo**. Acá no la hay: el que cierra es una
    **transición**, y un texto libre que escribe una transición es una frase enlatada — un valor de
    enumeración con más pasos, y encima ilegible para un guard.
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

**Y el instrumento gana la columna que dice si sigue vivo, porque tres predicados la preguntan y
ninguno podía contestarse.** Hasta acá `permanent_grant` **no declaraba ni estado ni revocación**:
la revocación existía **como acto** —una de las tres escrituras del catálogo de `NUCLEO/08` §3,
el evento de la tercera cláusula de `A5`— y **como acto no se puede leer después**. Los tres
consumidores que la leen después son:

| quién pregunta | qué pregunta | dónde |
|---|---|---|
| la **tercera comprobación** de cero llamadas | *«¿este beneficiario tiene un **ancla viva** en la vertical V?»* | `B/09` §3 |
| la **cuarta comprobación**, segunda mitad | *«¿el ancla que era su título sigue siendo la de un **grant vivo**?»* | `B/09` §3 |
| la **tercera mitad de la orfandad** | *«¿hay en esa vertical **un grant vivo** que valga como título?»* | `B/16` §4.2 |

Las tres son **backstops**: corren en el barrido diario, *«para la corrida en que ninguno se
ejecutó»* (`B/09` §3). Un evento sirve para disparar `A5` en el instante; **no sirve para un
predicado que se evalúa al día siguiente**. Sin la columna, las dos comprobaciones que esta tanda
escribió para ver *«lo que el diseño declara indetectable»* **no se podían evaluar**, y lo que
dejaban sin ver es que **alguien paga todos los meses algo que el §35.2 y el §35.3 declaran
gratis**.

**Y no estaba en ningún otro lado, porque el instrumento no vence.** `NUCLEO/01` §1.5 dice que el
grant *«no vence»*, contra la cortesía, que *«vence»* y guarda *«días o meses, inicio, fin»*. Un
instrumento que **sólo** termina por revocación y **no guarda la revocación** no tiene forma de
dejar de estar vivo — y ése es, con todas sus letras, el modo de falla que el
[`12-contrato-de-cobertura.md`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§2.6 ya había escrito para otra fuente: *«una fuente se emite porque un estado lo dice, y si ese
estado no se puede mover … la fuente sigue contando para `cubierto`»*. El grant emite con
`hasta: NO_VENCE`, así que era exactamente el caso, y nadie lo había leído sobre él.

> **Revocar retira las anclas como TÍTULO, no como FILAS.** Escribe `revocado_en` en el
> instrumento —**una** escritura, sobre **una** fila— y con eso las N anclas dejan de ser anclas
> vivas a la vez, que es lo que *«una revocación sobre un instrumento con un ancla por cada
> vertical»* (`12-contrato…` §2.8) siempre quiso decir. **Las filas de
> `permanent_grant_vertical` no se borran.**

**Y esa escritura guarda tres cosas, no dos: fecha, firmante y MOTIVO.** `DEC-GRANT-008` (owner,
2026-09-21) agregó el tercero, en **texto libre**.

- **Por qué hace falta.** Un *Free Forever* es una concesión **discrecional** de `SUPER_ADMIN`, y
  revocarla **le corta el servicio a alguien que no hizo nada para provocarlo**: `DEC-TRIAL-009`
  decidió que revocar *«consume el trial y no se repara»* apoyándose en que es *«una decisión
  legítima y deliberada»*, y **una decisión deliberada cuyo motivo no se registra es indefendible
  seis meses después** — empezando por ante el propio beneficiario que pregunta por qué le
  cortaron. La fecha dice **cuándo** y el firmante **quién**; sin el motivo, *«por qué»* no tiene
  dónde vivir.
- **Por qué libre y no de lista cerrada** —error / acuerdo vencido / abuso / otro—: el volumen es
  bajo, porque son concesiones firmadas a mano por `SUPER_ADMIN`, así que el texto libre **no
  genera basura**; y una lista cerrada obliga a mantenerla mientras el `otro` se come el resto.
- **No es un motivo de los de `reconciliation_mark`**, y conviene no confundirlos: aquéllos son
  una **enumeración cerrada** que un guard verifica (§2.5, `G-R1-F`) porque de ellos cuelga el
  comportamiento del listado. Éste **no gobierna ningún comportamiento**: es registro, y por eso
  puede ser libre sin romper nada.
- **La confirmación de revocar ya le pide a la persona que diga qué hace** (`B/19` §4, fila 13);
  lo que faltaba era **guardar por qué**, que es otra cosa.

**Y un beneficiario tiene a lo sumo UN grant vivo, garantizado por la base** — `DEC-GRANT-009`,
del mismo día:

> **`UNIQUE(beneficiario) WHERE revocado_en IS NULL`.** Es un índice **parcial**, restringido a las
> filas vivas: las revocadas quedan afuera y se pueden acumular sin límite, que es lo que el
> *«revocar marca y no borra»* de arriba necesita.

**Por qué en la base y no en los consumidores.** Con `revocado_en`, un beneficiario puede juntar
**N filas revocadas** y *«grant vivo»* se resuelve mirando `revocado_en IS NULL` — lo cual está
bien **mientras ese filtro esté en todos lados**, y el inventario de `NUCLEO/01` §2.4 dice que hoy
son **nueve** consumidores. La restricción convierte *«hay a lo sumo uno vivo»* en algo que la base
**garantiza** en vez de algo que nueve lugares tienen que recordar: **si un consumidor olvida el
filtro, encuentra a lo sumo una fila viva y no dos**, que es la diferencia entre un resultado
incompleto y uno **falso**.

**Y el precedente es de esta misma vuelta**: la columna existe porque *«el grant sigue vivo»* se
daba por sabido sin que nada lo garantizara, y el programa tiene medido que los inventarios se
olvidan — **la única lista que existía antes quedó corta en el mismo commit que creó su sexto
miembro** (`NUCLEO/01` §2.4).

**Por qué no rompe ningún caso contemplado**: el grant es *«UN instrumento con UN ANCLA POR CADA
VERTICAL»* (más arriba, `12-contrato…` §2.8), así que **la multiplicidad vive en
`permanent_grant_vertical`** y no en el grant. **Un segundo grant vivo para la misma persona no
tiene significado escrito en ningún lado**, y extender uno a una vertical más es **anclarle**, no
crearle otro.

**El costo aceptado, dicho en voz alta**: si algún día apareciera un caso legítimo de dos grants
vivos simultáneos, la restricción es **difícil de revertir** sobre datos ya escritos. Se acepta
porque hoy ese caso no existe en ningún capítulo.

**Las dos razones por las que no se borran, y las dos son de otros capítulos:**

1. **`addon_instance` apunta ahí.** La columna del título *«apunta a
   `permanent_grant_vertical`»* (arriba), y su segundo consumidor la lee **después** de la
   revocación. Borrar el ancla deja esa referencia colgando y **la segunda mitad de la cuarta
   comprobación se queda sin sujeto**, que es el mismo agujero por otra puerta.
2. **El corpus ya rechazaba ese mecanismo.** Reducir el scope de un grant entra *«por el catálogo
   con su propia fila, su confirmación y su transición — y **no como un efecto lateral de borrar
   una fila**»* (`12-contrato…` §2.8). Borrar anclas al revocar sería precisamente eso.

**Un grant revocado no emite ninguna fuente**, y va escrito acá porque la resolución del contrato
lo necesita: la fuente `GRANT` de una vertical existe **mientras el ancla de esa vertical esté
viva** (`12-contrato…` §2.8). `hasta: NO_VENCE` dice *«no hay fin por calendario»*, nunca
*«no se puede apagar»*.

**Y esto no le devuelve una máquina de estados al grant.** `revocado_en` es **una marca de un
acto**, como `fin_real` en `subscription_pause`: no hay transiciones, no hay `desde`/`hacia` y no
entra en ninguna tabla del cap. 03. Lo único que agrega es que el acto más grave del catálogo
**deje rastro legible**, que es lo que `NUCLEO/08` §3 ya exigía auditar y lo que ningún predicado
podía consultar.

**Anclar no es ser.** Una suscripción ancla una versión de plan y no es un plan: el grant sigue
siendo la entidad independiente que `NUCLEO/01` §1.5 describe. Y el retiro ya estaba resuelto —
`D13`: *«retirar un plan del catálogo no mueve ninguna suscripción»*. La alternativa, que el grant
declarara su propio juego de claves, es la que sí rompe algo: crea **una segunda forma de declarar
entitlements**, que `V/02` §1.2 impide.

### 2.5 La marca de conciliación: catorce motivos sobre la misma casilla, y cinco de ellos devuelven plata

**`requiere_conciliación` era un booleano y el diseño ya le escribía un MOTIVO.** `S18` pone la
marca *«con motivo **«reembolso por confirmar»**»* (cap. 03 §3.2) y las ramas 1, 5 y 6 de `B/12`
§5.3 —las que mandan devolver el pago que `S19` retuvo— **se apoyan en ese motivo y no en la
marca**. Un booleano no lo transporta: lo que le llegaba a la persona era una fila `CANCELLED`
marcada, **indistinguible de las otras trece marcas**, sin nada que dijera que hay plata del
cliente en nuestra cuenta. El pago se quedaba.

**Y el precedente de la forma está una tabla más arriba, decidido por el owner.** `DEC-GRANT-004`
implicación 1: *«el estado «pausada» de nuestra base **necesita un motivo, no sólo un booleano**»*,
porque en el proveedor una cortesía se ve idéntica a una pausa pedida por el cliente. `subscription_pause`
lleva su `motivo` por esa razón exacta y `S8` y `S9` lo escriben distinto. **La marca tiene la
misma forma y le faltaba la misma columna.**

#### El catálogo, contado sobre los escritores que hay hoy

**`S14` es el ACTO, no el motivo.** Su evento es *«divergencia que toca plata o estado»* y cubre
**siete** de los catorce casos de abajo; el motivo lo trae **el caso que lo disparó**, igual que el
de la pausa lo trae `S8` o `S9`. Los otros **siete** los abren actos que **no son `S14`** — `S18`,
las **seis** comprobaciones de cero llamadas del `B/09` §3 y **`S21`** —, y el propio `S19` declara
por escrito que su caso **no es una divergencia**.

| # | `motivo` | quién abre la marca | qué tiene que hacer la persona | ¿hay plata del cliente que devolver? |
|---|---|---|---|---|
| 1 | `REEMBOLSO_POR_CONFIRMAR` | **`S18`** al cerrar la sucesión, ramas 1, 5 y 6 de `B/12` §5.3 | confirmar el reembolso del pago que `S19` retuvo, por la puerta por la que entró (§2.3) | **SÍ**, y el monto está determinado — **es la suma de los pagos colgados de la marca** (§2.2), que acá es **uno**: `S19` retiene el del período impago |
| 2 | `COBRO_POSTERIOR_A_LA_BAJA` | `S14`, desde `C2` del `B/05` §2 | confirmar el reembolso de un cobro que llegó después de cancelar | **SÍ** |
| 3 | `COBRO_POSTERIOR_AL_GRANT` | `S14`, desde `C3` del `B/05` §2 | ídem, sobre un cobro posterior a un *Free Forever* | **SÍ** |
| 4 | `PAGO_PENDIENTE_SIN_RAMA` | la **segunda** comprobación del `B/09` §3, cuando la rama no es determinable | decidir el destino de un pago retenido por `S19` que ninguna de las seis ramas alcanzó | **puede**, y es la persona quien lo decide |
| 5 | `DIVERGENCIA_DE_MONTO` | `S14`, desde la comparación de monto del `B/09` §3 | decidir qué monto vale y mutarlo o aceptarlo | no, **y el cobro equivocado sigue saliendo todos los meses** |
| 6 | `TRANSICIÓN_NO_DECLARADA` | `S14`, desde la comparación de estado del `B/09` §3 **y desde la regla 1 del `NUCLEO/03` §1** | decidir qué estado vale y ejecutar la transición de la tabla que lo permita (`S15`) | no |
| 7 | `PAGO_TARDÍO_RECHAZADO` | `S14`, desde el `B/05` §3 — **menos la condición 1 sobre una fila `CANCELLED`**, que es del 2 o del 3 por la regla de desempate de ese mismo § | leer **cuál de las cuatro condiciones falló** y resolver | **SÍ** — ver abajo, *«por qué el 7 no puede llevar «no»»* |
| 8 | `REANUDACIÓN_NO_APLICADA` | `S14`, desde la rama de fallo de `S10`; **y la quinta comprobación** del `B/09` §3 | reanudar a mano o reclamarle al proveedor — el cliente está **sin servicio y sin cobro** | no |
| 9 | `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA` | la **primera** comprobación del `B/09` §3 | cerrar la sucesión que `S18` no cerró, antes de que el candado `A` vacío deje entrar un alta nueva | no |
| 10 | `FAN_OUT_DE_GRANT_INCOMPLETO` | la **tercera** comprobación del `B/09` §3 | reanudar `S13` / `S20` — el beneficiario **paga todos los meses algo declarado gratis** | no, pero **hay un cobro que cortar** |
| 11 | `ADDON_SIN_APAGAR` | la **cuarta** comprobación del `B/09` §3 | correr `A5` sobre una instancia viva cuyo título ya murió | no, pero **hay un cobro que cortar** |
| 12 | `COBRO_DURANTE_CORTESÍA` | `S14`, cuando el proveedor cobra **entre `S2` y la re-emisión de una cortesía diferida** (`S9`, `DEC-GRANT-007`) | confirmar el reembolso de un cobro sobre días que `SUPER_ADMIN` había regalado | **SÍ** — es el riesgo que `DEC-GRANT-007` aceptó por escrito, y devolverlo es el camino que esa decisión eligió |
| 13 | `CORTESÍA_SIN_RE_EMITIR` | la **sexta** comprobación del `B/09` §3 | pausar la sucesora y re-emitir la cortesía diferida que `S9` no re-emitió | **puede**: si ya cobró, sí; si todavía no, alcanza con re-emitirla |
| 14 | `COMPLEMENTO_CON_PERÍODO_COBRADO` | **`S21`**, cuando mata una suscripción de complemento **cuyo último cobro paga un período que todavía no terminó** (`B/03` §3.2, `B/16` §4.4) | decidir si se devuelve lo que queda del período — el addon se apagó el mismo día y esos días **no los va a usar nadie** | **puede**: `B/16` §4.4 decidió que *«el período ya pagado no se reembolsa»* y dejó por escrito *«si en un caso concreto corresponde devolver, entra por esa vía y la confirma una persona»* — **es esa persona, y este motivo es lo que la trae** |

**La enumeración es cerrada y el conteo se recalcula, no se incrementa**: un escritor nuevo agrega
su fila acá **en el mismo acto** en que se escribe, y `G-R1-F` (`B/20` §2) falla si alguna
transición o comprobación del corpus pone la marca sin nombrar un motivo de esta tabla. **Los dos
últimos llegaron con `DEC-GRANT-007` y son el ejemplo de por qué la regla dice *«se recalcula»***:
el 12 es el riesgo que esa decisión aceptó y el 13 su detector, y las dos cifras de este §
—catorce motivos, cinco que devuelven plata— se volvieron a contar sobre la tabla.

**El 14 llegó por lo mismo y conviene decir de dónde.** `S21` declaraba una vía —*«sin reembolso
del período ya cobrado; si corresponde devolver, entra por la vía del reembolso, que confirma una
persona (`DEC-RF-002`)»* (`B/03` §3.2)— **que nadie disparaba**, y desde que esta enumeración es
cerrada la ausencia dejó de ser una omisión y pasó a ser una imposibilidad: bajo `G-R1-F` esa vía
**no se podía escribir sin agregar una fila acá**. La acción existe en el catálogo de `NUCLEO/08`
§3 con su permiso, su auditoría y su confirmación, y ese mismo § dice que *«no sirve de nada si
nadie enruta el caso»*. El 14 es quien lo enruta.

#### Por qué el 7 no puede llevar «no»

**Las cuatro condiciones del `B/05` §3 sólo fallan con el pago ya acreditado**, y eso no es una
lectura: el § se titula *«Qué hace seguro a un **pago tardío**»* y arranca *«Un pago tardío es
seguro de reactivar si y sólo si se cumplen las cuatro»*. Recorridas una por una: la **1** falla
sobre una fila `CANCELLED`, `ABANDONED` o ya `ACTIVE` —el pago existe y la fila no lo puede
recibir—; la **2** falla porque el monto **no** coincide —hay un monto, distinto—; la **3** falla
porque hay otra fila viva y el cliente *«queda pagando dos veces por la misma vertical»*; la **4**
falla porque *«hay otro pago acreditado para el mismo período: **es un doble cobro**»*. **No hay
forma de llegar a este motivo sin plata del cliente en nuestra cuenta sobre un período que no
compró.**

**Llevaba `no` y eso lo mandaba al peor de los dos desenlaces.** El listado ordena adelante los
motivos con `SÍ` *«porque son los únicos en los que esperar le cuesta al cliente»* (`B/19` §6) y
sólo ésos llevan default: con `no`, el 7 llegaba **último y sin ninguna propuesta**, que es el
estado que ese mismo § declara **ya fallido** —*«la persona que no sabe qué se espera de ella no
hace nada»*—. Y es literalmente el desenlace que la columna `motivo` vino a cerrar: el párrafo de
arriba dice que con un booleano *«el pago se quedaba»* porque la marca era indistinguible; sobre el
7 la marca **era distinguible y decía que no había plata**, que es peor.

**Su default es DEVOLVER, con la excepción nombrada y no tapada.** De las cuatro formas de fallar,
tres no admiten otra salida —el pago no compra nada sobre una fila terminal o ya activa, no compra
nada cuando hay otra fila viva cobrando, y no compra nada cuando el período ya estaba pago—. La
cuarta, la condición **2**, sí: si el monto de más es *«un cambio de precio no propagado»* (`B/05`
§3), lo que corresponde es **aceptarlo y reactivar**, no devolver. Eso no pide un motivo aparte,
porque **cuál de las cuatro falló va en el evento crítico** y no en el motivo (`B/05` §3,
`NUCLEO/08` §4.3), y porque el default **no ejecuta nada**: la persona confirma o se niega
(`DEC-RF-002`, `DEC-RF-003`). Lo que se elige acá es contra qué se niega.

#### Qué cambia con el motivo, además de que se pueda leer

1. **El listado accionable deja de ser homogéneo.** `B/19` §6 muestra el motivo, **el default de
   lo que el sistema propone** (`DEC-RF-003`) y ordena primero
   los **cinco** motivos con `SÍ` en la última columna —1, 2, 3, **7** y 12—, que son los únicos donde
   **esperar le cuesta plata al cliente**.
2. **`S15` levanta UNA marca, no la fila.** Con un booleano, resolver una divergencia de monto
   apagaba en el mismo gesto un *«reembolso por confirmar»* que nadie había mirado. El `UNIQUE`
   parcial del §2.2 es lo que deja convivir las dos, y es el caso que la rama 3 de `B/12` §5.3
   —la sucesión trabada— ya declaraba: *«lo resuelve la misma persona, junto con la marca»*, que
   **sólo es verdad si las dos se ven**.
3. **La marca tiene reloj.** `puesta_en` es lo que vuelve evaluable la salvedad 2 del `B/09` §3
   —*«lo que el barrido le aporta no es la comparación con el proveedor sino **el reloj de la
   marca**»*— y su escalamiento *«si sigue puesta pasado su plazo»*. Con un booleano no había
   *«desde cuándo»* y esa salvedad nombraba como su razón de existir un dato que no existía. Es
   `F-8cB3-005`, abierta desde la FASE 8-bis-2, cerrada acá.
4. **`requiere_conciliación` sigue siendo el nombre del predicado**, así que cada frase del corpus
   que dice *«se pone la marca `requiere_conciliación`»* sigue diciendo lo mismo; lo que gana es
   **con qué motivo**. El predicado se define en `NUCLEO/01` §2.5 y su inventario de consumidores
   está ahí.

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
| **la cortesía vigente** | `courtesy_grant.subscription_id` (no anulable) + **`saldo_días`** (§2.4) | **NO se re-apunta: queda DIFERIDA.** `S18` la cierra sobre la predecesora y le escribe en `saldo_días` los días que le quedaban; **`S9` la re-emite sobre la sucesora cuando ésta llega a `ACTIVE`** —re-apuntando ahí sí `subscription_id`, recalculando `inicio`/`fin` y volviendo el saldo a nulo— y la deja `PAUSED` con motivo `COURTESY` | `DEC-GRANT-007`. Re-apuntarla en el cierre **pedía una pausa que ninguna transición declara**: el `hacia` de `S18` es *«el mismo estado»* y la única fila que llega a `PAUSED · COURTESY` es `S9`, cuyo `desde` es `ACTIVE`; sobre una sucesora en `PENDING_AUTHORIZATION` no hay transición, y la regla 1 del núcleo mandaba el cierre del camino normal a la marca. Y si alguien la re-apuntaba sin pausar, la sucesora autorizaba y **cobraba** con una cortesía encima que es *«una fila de base que no hace nada»*. Diferirla usa `S9` **tal como está**, sobre una fila `ACTIVE` que el proveedor sí deja pausar |
| **el pago pendiente por `S19`** | `payment.subscription_id` **o `manual_payment.subscription_id`** — `S19` retiene el pago del período impago **entre por la puerta que entre** (cap. 03 §3.2) | **no se re-apunta**: el pago es un hecho de la fila que lo cobró. `S18` le abre a **esa** fila una marca con motivo **`REEMBOLSO_POR_CONFIRMAR`** (§2.5), **con el pago colgado de ella** (§2.2), y el reembolso lo confirma una persona (`DEC-RF-002`), asentado en un `refund` sobre ese mismo pago (§2.3) | re-apuntar un cobro a otra fila falsearía el registro contable, que el §4.1 conserva íntegro. Lo que se mueve no es el pago sino **quién tiene que mirarlo** — y sin el motivo esa fila llegaba al listado indistinguible de las otras doce marcas |
| **pagos y pagos manuales ya resueltos, comprobantes, pausas cerradas, el `provider_link`** | varias | **no se re-apuntan** | son el histórico de esa fila y de su preapproval. Cada suscripción tiene el suyo |

**Las DOS primeras son el re-apunte, la tercera es el DIFERIMIENTO, la cuarta es el aviso, y la
quinta es historia.** El reparto cambió con `DEC-GRANT-007`: hasta entonces las tres primeras se
re-apuntaban y la cortesía era la que no se podía ejecutar. Es la distinción que `S18` tiene que
ejecutar y la que `G-R1-C` vigila: un cierre que escribe las dos
columnas y deja **un complemento o la redención** apuntando a la predecesora, **o una cortesía
vigente sin cerrar y sin saldo**, es un cierre incompleto, no un cierre.

> **Y la tercera tiene desde `DEC-GRANT-010` un segundo escritor que NO es este cierre.** `S25`
> (`B/03` §3.2) difiere la cortesía **con la misma columna** cuando una pausa no se puede reanudar
> porque su plan dejó de prestarse, y ahí **no hay sucesión ninguna**: no hay `sucedida_por` que
> escribir, no hay complementos ni redención que re-apuntar, y lo único que esa fila comparte con
> `S18` es **el diferimiento**. Va dicho acá porque este inventario es el que `G-R1-C` verifica, y
> un inventario que sólo nombre al cierre deja el segundo escritor sin vigilar (`B/14` §4.6).

**Y las tres primeras tienen el mismo modo de falla: son silenciosas.** Ninguna emite webhook,
ninguna cambia un estado que el barrido compare, y las tres le sacan al cliente algo que ya tenía
—capacidad comprada, descuento pactado, cortesía firmada— en el acto con el que decidió gastar
más. Por eso el inventario va acá y no repartido en tres capítulos. **Y la tercera tiene además un
segundo modo de falla que las otras dos no tienen**: el diferimiento se puede escribir bien y la
re-emisión no ocurrir nunca, porque `S9` es un acto y no un reloj — para eso está la **sexta**
comprobación de cero llamadas del `B/09` §3.

> **Y un grant NO es una sucesión: no re-apunta nada, y tampoco se lleva nada puesto.** `S13`
> alcanza *«toda fila viva **principal**»* (`B/03` §3.2), así que **no toca la suscripción de
> complemento** —que es una fila de esta misma tabla, con su `clase`—; y el addon tampoco queda
> huérfano, porque el grant **releva** a la principal en esa vertical (`B/16` §4.2, tercera
> mitad de la condición). De las cinco filas de arriba la única que un grant mueve por ser grant
> es la cuarta —el pago pendiente por `S19`—, y la mueve **apagando la bandera**, no
> re-apuntándola (rama 4 de `B/12` §5.3).
>
> **Y si el grant lleva `includesAddons: true`, la primera fila la mueve OTRO acto, que tampoco
> es una sucesión.** `S20` (`B/03` §3.2) **cancela** la suscripción de complemento de cada addon
> compatible y **la instancia pasa a colgar del ancla** —no de la sucesora, porque no hay
> sucesora—, que es el addon a costo $0 del §35.2 escrito por fin como un acto (`B/16` §3.4).
> Esto **no convierte al grant en una sucesión**: no hereda nada, no re-apunta la promo ni la
> cortesía y no cierra ningún candado. Lo único que comparte con `S18` es que el complemento
> **deja de colgar de donde colgaba**, y hacia dónde pasa a colgar es distinto: allá la sucesora,
> acá el ancla. Con el flag en `false` no se mueve nada y el complemento sigue cobrando.

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
| — · a lo sumo **un grant vivo** por beneficiario | **`UNIQUE(beneficiario) WHERE revocado_en IS NULL` en `permanent_grant`** (§2.4, `DEC-GRANT-009`). No está en el §64 —el PDR no lo enuncia— y entra acá por la misma razón que los otros: es lo que hace que **los nueve consumidores de *«grant vivo»*** (`NUCLEO/01` §2.4) no puedan encontrar dos filas si alguno olvida el filtro |
| 26 · producto ≠ instancia | son dos tablas, y la instancia no repite ningún campo del producto |
| — · toda columna de estado tiene dominio cerrado | restricción de dominio por columna (cap. 03 §1.2) |

**Los demás no los puede sostener la base** —dependen de la resolución en el servicio— y son el
capítulo 04 (núcleo). Lo que importa es la distinción: los de arriba **no admiten un camino que los
esquive**, los otros sí, y por eso los otros necesitan estar en un solo lugar.
