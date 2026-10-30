---
title: "FASE 8 · B2 — máquinas, idempotencia, carreras y huérfanos"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · B2 — máquinas, idempotencia, carreras y huérfanos

Pasada adversarial B2 sobre HOS-1354. El encargo del §65: **intentar romper el diseño**.

Veintidós hallazgos. Nueve `CRITICA`, nueve `ALTA`, cuatro `MEDIA`.

Dos cosas que conviene decir antes de la lista, porque atraviesan casi todos los hallazgos:

1. **La regla de lectura 5 del núcleo —*«Ninguna máquina consulta el estado del proveedor para
   decidir»*— es la que habilita la mitad de lo que sigue.** No la ataco como regla: la uso. Un
   reloj nuestro que decide sin releer decide sobre un estado que el proveedor ya movió, y las
   transiciones que ese reloj dispara son irreversibles (`PA-5`).
2. **La restricción de unicidad del capítulo 02 §2.2 es el único candado real del diseño**, y
   está puesta sobre un conjunto de estados que dos mecanismos ya decididos necesitan violar. Los
   hallazgos 001, 002, 008 y 011 son cuatro caras de esa misma piedra.

---

## CRITICAS

### F-8B2-001 — La restricción del §11 vuelve imposible todo cambio de ciclo y todo upgrade

**Qué se rompe.** El mecanismo de `DEC-SUB-006` y `DEC-SUB-007` —cancelar y recrear, con la
vieja viva hasta que la nueva se autorice— exige dos suscripciones vivas del mismo
`user + vertical`, y la restricción de la base las rechaza. El alta de la nueva **falla al
insertar**: ningún cliente puede cambiar de ciclo ni hacer un upgrade.

**El camino.**

1. Un cliente `ACTIVE` en mensual pide el anual.
2. `DEC-SUB-006` crea una suscripción nueva en `PENDING_AUTHORIZATION` y lo manda al checkout.
3. La vieja sigue `ACTIVE`: `D7` prohíbe cancelarla antes del webhook de autorización.
4. `INSERT` de la nueva → viola `UNIQUE(user_id, vertical) WHERE clase = principal AND estado ∈
   {vivos}`, porque`PENDING_AUTHORIZATION` **es** un estado vivo.
5. Si en la implementación se resuelve aflojando la restricción, se cae la condición 3 del
   capítulo 05 §3 (*«no hay otra suscripción viva»*), que es la que impide que un pago tardío deje
   a alguien pagando dos veces.

**Dónde lo permite el diseño.**

- `docs/02-modelo-de-datos.md` §2.2: *«**`UNIQUE(user_id, vertical) WHERE clase = principal AND
  estado ∈ {vivos}`** — es el §11, **impuesto por la base y no por un chequeo**»*, y más abajo
  *«Los «vivos» de la restricción del §11 son: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`,
  `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`»*.
- `nucleo/04-invariantes.md` §3, `D7`: *«**La suscripción vieja se cancela sólo al recibir el
  webhook de que la nueva quedó autorizada**»*.
- `nucleo/07-outbox-y-notificaciones.md` §5.3: *«el estado intermedio no es destructivo porque
  **las dos conviven** (`EX-6`)»*.
- `docs/03-maquinas-de-estado.md` §3.3: *«dos vivas para el mismo `user + vertical` | es el §11.
  La condición está en S1, y el capítulo 05 la hace cumplir con una restricción de unicidad»*.

Los dos últimos se contradicen en una línea: uno dice que conviven y el otro que la base lo
impide.

**Severidad.** `CRITICA` — obliga a rediseñar la restricción o el mecanismo.

**Necesita decisión del owner.** **Sí.** La salida no es técnica: o el §11 se hace cumplir sobre
un conjunto de estados más chico (y hay una ventana de hasta 72 h con dos vivas, que es
exactamente lo que el §11 fue a prohibir), o el cambio de ciclo deja de pasar por el checkout.

---

### F-8B2-002 — `RECONCILIATION_REQUIRED` es una trampa: se entra desde cualquiera y no se sale

**Qué se rompe.** Una suscripción que entra en `RECONCILIATION_REQUIRED` sale del conjunto de
«vivos», el cliente contrata de nuevo, y después **S15 no puede devolverla a ningún estado vivo**
porque la restricción de unicidad ya está ocupada. Queda en `RECONCILIATION_REQUIRED` para
siempre, con su preapproval vivo del otro lado.

**El camino.**

1. Cliente `ACTIVE`. El barrido detecta una divergencia de monto (`EX-15`: mutar no emite
   webhook) y dispara S14 → `RECONCILIATION_REQUIRED`.
2. El capítulo 02 saca ese estado de los «vivos» **a propósito**, para que la persona pueda
   contratar de nuevo.
3. El cliente, sin servicio y sin explicación, contrata de nuevo: S1 pasa su condición y nace una
   segunda suscripción `PENDING_AUTHORIZATION` → `ACTIVE`. Ahora hay **dos preapprovals vivos**.
4. Días después una persona resuelve el caso viejo. S15 dice *«el estado que corresponda»*, y el
   que corresponde es `ACTIVE` o `CANCEL_SCHEDULED`: los dos vivos. El `UPDATE` **falla**.
5. El único destino que la base acepta es `CANCELLED` — o sea que resolver un caso de
   conciliación sólo puede terminar matando la suscripción, decida lo que decida la persona.
6. Y mientras tanto el barrido la sigue leyendo: el capítulo 09 §3 sólo exime `CANCELLED` y
   `ABANDONED`, así que genera la misma divergencia todos los días.

**Dónde lo permite el diseño.**

- `docs/02-modelo-de-datos.md` §2.2: *«Quedan afuera `ABANDONED`, `CANCELLED` y
  `RECONCILIATION_REQUIRED` — el último a propósito: si una suscripción necesita intervención
  humana, la persona tiene que poder contratar de nuevo sin esperar a que alguien resuelva un
  caso»*.
- `docs/03-maquinas-de-estado.md` §3.2, S14 (*«desde: cualquiera»*) y S15 (*«una persona resuelve
  | el estado que corresponda»*).

**Severidad.** `CRITICA` — pérdida de estado irrecuperable más una segunda autorización cobrando.

**Necesita decisión del owner.** **Sí.** La decisión de sacar `RECONCILIATION_REQUIRED` de los
vivos está escrita con su razón; la consecuencia de arriba no lo está.

---

### F-8B2-003 — El job de las 72 h cancela, irreversible, un preapproval recién autorizado

**Qué se rompe.** Una autorización real muere por un retraso de webhook. `ABANDONED → ACTIVE` no
existe, cancelar en el proveedor es irreversible (`PA-5`), y el cliente queda autorizado-y-muerto.
Si ya se ejecutó el `card_validation` o el primer cobro, además pagó.

**El camino.**

1. `t = 0`: se crea el preapproval, `PENDING_AUTHORIZATION`.
2. `t = 71 h 59 m`: el cliente vuelve por el enlace y autoriza en el checkout.
3. El aviso del proveedor tarda: `WH-2` midió entregas entre **0,6 s y 32 s**, y ante un `500`
   reintenta a **+18,8 min** y **+35,1 min** (`WH-4`). El cobro real llega ~26 min después
   (`PA-3`).
4. `t = 72 h 00 m`: el job de limpieza lee **nuestra** fila —todavía `PENDING_AUTHORIZATION`—,
   evalúa S3, cuya condición *«pasaron 72 h sin autorizar»* se cumple contra nuestro estado, y
   ejecuta: `ABANDONED` + **cancelar el preapproval en el proveedor**.
5. El webhook de autorización llega a `t = 72 h 04 m`. `ABANDONED → ACTIVE` no existe.
6. El cliente ve un correo del proveedor que dice *«Pagaste la suscripción»* (`EX-3`) y una
   plataforma que le dice que su ventana venció.

El diseño **tiene** la regla que evitaría esto y la aplica en otro lado: el capítulo 14 §3.3 exige
que el job de vencimiento re-lea *«dentro de su propia transacción»*. Esa relectura es **local**, y
el hecho que decide está del lado del proveedor, donde la regla de lectura 5 prohíbe mirar.

**Dónde lo permite el diseño.**

- `docs/03-maquinas-de-estado.md` §3.4 punto 2: *«un job recorre las vencidas, las lleva a
  `ABANDONED` y **cancela el preapproval en el proveedor**. Sin ese segundo paso queda una
  autorización viva que puede cobrar»* — no pide releer antes de cancelar.
- `nucleo/03-maquinas-de-estado.md` §1 regla 5: *«**Ninguna máquina consulta el estado del
  proveedor para decidir.** Consulta el suyo»*.
- `docs/03-maquinas-de-estado.md` §3.3: *«`ABANDONED` → `ACTIVE` | la ventana venció y el
  preapproval se canceló»*.

**Severidad.** `CRITICA` — pérdida irreversible de una autorización válida.

**Necesita decisión del owner.** **No.** Es un defecto de mecanismo: la salida obvia es releer el
recurso antes de cancelar, y eso obliga a declarar una excepción acotada a la regla 5 (como ya
tiene `DEC-MAIL-001` frente al §64.25).

---

### F-8B2-004 — El barrido diario fabrica un `RECONCILIATION_REQUIRED` por cada cliente que se da de baja

**Qué se rompe.** `CANCEL_SCHEDULED` es, **por diseño**, un estado en el que nuestro estado y el
del proveedor no coinciden. El barrido compara justamente eso y no tiene exención para él, así que
todos los días convierte cada baja en un incidente, arrastra a esos clientes al `F-8B2-002` y
ahoga el canal que el capítulo 08 declaró primario.

**El camino.**

1. Un cliente pide la baja. S11: se cancela en el proveedor **de inmediato** y la fila queda
   `CANCEL_SCHEDULED` con nuestra fecha de fin de servicio a 20 días.
2. Esa noche corre el barrido. La fila no está en un estado terminal, así que se lee por id.
3. El proveedor devuelve `cancelled`. Nuestro estado dice `CANCEL_SCHEDULED`.
4. El barrido *«evalúa la transición contra la tabla»*: la única que va de `CANCEL_SCHEDULED` a
   algo es S12, cuya condición —*«llega la fecha de fin de servicio»*— **no se cumple** (faltan 20
   días).
5. La transición no corresponde → `RECONCILIATION_REQUIRED`, correo a `SUPER_ADMIN`, entrada en
   el listado accionable. **Y la fila sale de los «vivos»**, con todo lo del `F-8B2-002`.
6. Se repite todas las noches, por cada baja de la cartera.

**Dónde lo permite el diseño.**

- `docs/09-conciliacion.md` §3: *«estado | el del proveedor, leído por id | **no se escribe el del
  proveedor**: se evalúa la transición contra la tabla del cap. 03. Si no existe,
  `RECONCILIATION_REQUIRED`»*, y *«**Los estados terminales no se barren**: `CANCELLED` y
  `ABANDONED`…»* — `CANCEL_SCHEDULED` no está exento.
- `nucleo/01-glosario.md` §2.2: *«**`CANCEL_SCHEDULED` existe aunque el proveedor ya esté
  cancelado**»*.

**Severidad.** `CRITICA` — destruye el canal de incidentes y arrastra cada baja a la trampa 002.

**Necesita decisión del owner.** **No.** La exención es obvia; lo que hay que decidir es dónde se
escribe la lista de divergencias **esperadas**, que hoy no existe como concepto.

---

### F-8B2-005 — Dos capítulos de la misma épica discrepan sobre si un upgrade conserva la suscripción

**Qué se rompe.** De esa discrepancia depende si un upgrade destruye los addons del cliente, el
contador de una promo de N cobros y el descenso programado. Hoy el diseño dice las dos cosas, y
cada capítulo que lee una de las dos construye encima.

**El camino.**

1. Un cliente con un addon *+5 fichas* de scope `VERTICAL_SUBSCRIPTION`, una promo porcentual de
   3 cobros con 2 consumidos, y un descenso programado, pide un upgrade.
2. **Leyendo el capítulo 12**: el upgrade cancela y recrea. La suscripción llega a `CANCELLED` →
   el addon queda huérfano por la regla del capítulo 16 §4.2 → se cancela **en el proveedor, de
   inmediato** → el cliente pierde lo que pagó. La promo muere con la fila. El descenso también.
3. **Leyendo el capítulo 14**: la suscripción sobrevive, la promo se recalcula sobre el precio
   nuevo y *«el contador de N cobros sigue donde estaba»*. El addon no se toca.
4. Las dos lecturas son defendibles contra el texto. Quien implemente elige, y nada falla.

**Dónde lo permite el diseño.**

- `docs/12-suscripcion.md` §2.2, colisión 2: *«un upgrade | **muere con la suscripción vieja.**
  `DEC-SUB-007` ejecuta el upgrade cancelando y recreando, y la nueva nace sin cola»*.
- `docs/14-promos-cortesias-y-grants.md` §2.1: *«**cambiar de PLAN con el mismo ciclo** muta el
  monto y **la suscripción sobrevive** (`DEC-SUB-007`, `DEC-SUB-008`)»*.
- `docs/10-verticales-planes-billing-options.md` §3.5: *«si nada baja, sigue el camino de upgrade
  (`DEC-SUB-007`): inmediato»* — una tercera formulación, compatible con las dos.

**Severidad.** `CRITICA` — decide la destrucción silenciosa de bienes pagados.

**Necesita decisión del owner.** **No** para dirimirlo (`DEC-SUB-007` ya dice cuál es), **sí**
para lo que se descubre al dirimirlo: si el upgrade cancela y recrea, **hay que decidir qué pasa
con los addons del cliente**, y eso no está escrito en ningún capítulo.

---

### F-8B2-006 — Un doble clic en «contratar addon» crea dos autorizaciones recurrentes, y nada lo impide

**Qué se rompe.** Las suscripciones de complemento **no tienen ninguna restricción de unicidad**,
y el candado de idempotencia no cubre el caso: la clave se acuña por intento. El cliente termina
con dos preapprovals del mismo addon cobrándole todos los meses.

**El camino.**

1. El cliente hace doble clic en «contratar» un addon `PERIÓDICO`.
2. Cada request acuña y persiste **su propia** clave —`§3.3`: *«Volver a intentar crea una fila
   nueva, con clave de idempotencia nueva»*—, así que `UNIQUE(clave)` no colisiona.
3. A1 exige *«una suscripción principal válida y compatible»*. Las dos la tienen.
4. `EX-17` midió que el proveedor **no deduplica por ningún mecanismo**: diez intentos, diez ids.
5. Nacen dos `addon_instance` en `PENDING_AUTHORIZATION` y dos preapprovals. El cliente autoriza
   los dos, o autoriza uno y el otro muere a las 72 h dejando su preapproval (ver `F-8B2-016`).
6. La única defensa que el diseño declara contra el doble clic —*«diez altas simultáneas del
   mismo `user + vertical` dejan una fila»*— es la restricción de unicidad, y sólo existe para la
   principal.

**Dónde lo permite el diseño.**

- `nucleo/01-glosario.md` §1.4: *«Las de complemento no tienen tope propio»*.
- `docs/02-modelo-de-datos.md` §2.4, `addon_instance`: la única restricción declarada es *«el
  objetivo corresponde al tipo de scope del producto»*.
- `docs/03-maquinas-de-estado.md` §8, A1: la condición es la suscripción principal, y nada más.
- `descomposicion.md` §4, B3: *«diez altas simultáneas del mismo `user + vertical` dejan **una**
  fila y **un** id en el proveedor»* — el criterio de aceptación no alcanza a los complementos.

**Severidad.** `CRITICA` — débito recurrente duplicado con dinero real.

**Necesita decisión del owner.** **No.** Falta declarar qué es la unicidad de una instancia de
addon: por `(dueño, producto, objetivo)` con los estados vivos, presumiblemente. Es una decisión
de modelo, no comercial.

---

### F-8B2-007 — El barrido no mira los estados terminales, y el capítulo 16 cuenta con que sí

**Qué se rompe.** El huérfano que el capítulo 16 declara *«el que no puede fallar»* —un
preapproval vivo colgado de un addon muerto— es exactamente el que el capítulo 09 decidió no
barrer. Nadie lo ve: mutar y cancelar no emiten webhook, y la fila está en un estado exento.

**El camino.**

1. Se borra la ficha destino de un addon recurrente. A6: la instancia pasa a `CANCELLED`.
2. El capítulo 16 §4.3 ordena cancelar su preapproval en el proveedor. La llamada falla —timeout,
   `403`, o el `2xx` que no aplica nada del §0—.
3. `D5` exige verificar releyendo. Si esa relectura también falla, o si el proceso muere entre
   una cosa y la otra, la fila local ya quedó en `CANCELLED`.
4. El barrido diario recorre *«cada suscripción de nuestro inventario que no esté en un estado
   terminal»*. `CANCELLED` está exento. **Nadie vuelve a mirar.**
5. El preapproval cobra todos los meses a alguien que ya no es cliente, y como cobrar sí emite
   webhook, ese webhook llega y no resuelve a ninguna suscripción viva: cae en el mismo
   `SubscriptionNotResolvedError` que el capítulo 09 §5 registra como bug vivo, reintentado cinco
   veces y descartado.

**Dónde lo permite el diseño.**

- `docs/09-conciliacion.md` §3: *«**Los estados terminales no se barren**: `CANCELLED` y
  `ABANDONED` **no pueden divergir hacia nada que nos importe**, y barrerlos es gastar llamadas»*.
- `docs/16-addons.md` §4.3: *«Lo que lo hace detectable es el barrido del capítulo 09 […]: **un
  addon en estado terminal con su preapproval vivo es una discrepancia que el barrido ve**»*.

Los dos no pueden ser ciertos a la vez.

**Severidad.** `CRITICA` — cobro recurrente a un ex cliente, sin detección.

**Necesita decisión del owner.** **No.** Lo que falta es un criterio: lo terminal no es el estado
de la suscripción sino el del **vínculo con el proveedor**, y esa distinción no existe en el
modelo.

---

### F-8B2-008 — `SUSPENDED` tras un primer cobro rechazado no tiene salida y bloquea el reintento

**Qué se rompe.** El capítulo 12 §4.3 manda a `SUSPENDED` a quien nunca pagó; §4.4 dice que su
reintento *«es una suscripción NUEVA»*. `SUSPENDED` es un estado vivo, así que la nueva no se
puede crear. Y la única salida de `SUSPENDED` —S7— exige un cobro que el proveedor ya no puede
ejecutar porque canceló el preapproval de forma terminal.

**El camino.**

1. Alta. La tarjeta pasa la validación de ARS 0 y el primer cobro se rechaza.
2. Regla de §4.3: sin ningún pago acreditado para ese `user + vertical`, **no hay grace**: va
   directo a `SUSPENDED`.
3. Medido el 2026-09-17: el proveedor **cancela la suscripción en el mismo milisegundo**, y
   `PUT {status:"authorized"}` devuelve `400 "Invalid transition from cancelled to authorized"`.
4. S7 (`SUSPENDED → ACTIVE`) pide *«el cobro entró de verdad»*. No hay preapproval que lo ejecute.
5. El cliente arregla su tarjeta y vuelve a contratar. La restricción rechaza el alta: hay una
   viva en `SUSPENDED`.
6. No queda transición: S13 necesita a un `SUPER_ADMIN`, y S14 lo manda a la trampa del 002.

El capítulo declara el residuo vecino —que `ABANDONED` y *«intentó y lo rechazaron»* comparten
estado y hay que decirle cosas distintas al cliente— y **no declara éste**, que es el que le
impide volver.

**Dónde lo permite el diseño.**

- `docs/12-suscripcion.md` §4.3: *«va directo a `SUSPENDED`»*; §4.4 punto 1: *«**El reintento del
  cliente es una suscripción NUEVA, con id nuevo.** No se recupera la anterior —no se puede—»*.
- `docs/02-modelo-de-datos.md` §2.2: `SUSPENDED` está en los «vivos».
- `docs/03-maquinas-de-estado.md` §3.2, S7, condición: *«el cobro entró de verdad»*.

**Severidad.** `CRITICA` — cierra el camino de recuperación de todo cliente con una tarjeta que
rebotó, que es el caso más común que existe.

**Necesita decisión del owner.** **Sí.** Se cruza con la regla de §4.3, que el owner aprobó
eligiendo hacia dónde falla. Esta consecuencia no estaba en esa elección.

---

### F-8B2-009 — Si el proveedor cancela por mora, `GRACE_PERIOD` es un estado inalcanzable

**Qué se rompe.** El capítulo 12 hace arrancar el reloj del grace *«cuando el proveedor deja de
reintentar»*, detectado releyendo. Lo único medido sobre ese momento es que el proveedor
**cancela**. Si eso vale también para las renovaciones, S4 nunca se dispara: la relectura devuelve
`cancelled`, la regla de no-retroceso lo espeja, y `GRACE_PERIOD`, S5, S6, el dunning, los correos
del §42.3 y la máquina de pago manual quedan sin ningún camino que los alcance.

**El camino.**

1. Renovación. El cobro se rechaza; la cuota queda `recycling` y nuestro pago queda `PENDING`,
   con la suscripción `ACTIVE` (§1.3).
2. El proveedor agota sus reintentos. Releemos para saberlo — que es lo único que el diseño
   acepta.
3. La relectura devuelve `cancelled`: es lo medido en producción para el primer cobro, con los
   dos hechos compartiendo el milisegundo.
4. `§1.4`: *«Si el proveedor da de baja la suscripción por su cuenta […] se relee y se escribe lo
   leído»*. La fila va a `CANCELLED`.
5. `GRACE_PERIOD` nunca se ocupa. Los diez días de `DEC-SUB-002`, los avisos relativos al
   vencimiento, `DEC-SUB-003` (cambiar de plan como camino de recuperación) y las tres
   transiciones del pago manual describen un estado al que no se llega.
6. Y si en vez de eso el proveedor la deja en un estado indistinguible de «sigue intentando»,
   pasa lo simétrico: el reloj **nunca arranca** y la suscripción se queda `ACTIVE` con un período
   impago para siempre.

**Dónde lo permite el diseño.**

- `docs/12-suscripcion.md` §1.2: *«**El reloj del grace arranca cuando el proveedor deja de
  reintentar** […] **Y eso se detecta releyendo el recurso, nunca contando días.**»*; §1.5:
  *«`GR-3` […] **sigue `UNKNOWN`** […] **Esta sección no la usa.** Se escribió justamente para no
  necesitarla»*.
- `docs/06-proveedor.md` §11: *«`GR-3` | cuántas veces reintenta el proveedor, **y en qué estado
  la deja** | **cuántos días tiene que durar nuestro grace**»*.
- `docs/12-suscripcion.md` §4.4: *«el proveedor **cancela la suscripción en el mismo instante** en
  que manda la cuota a `recycling` […] y esa cancelación es **terminal**»*.

§1.5 afirma que la sección no necesita `GR-3`, y `GR-3` es literalmente *«en qué estado la deja»*,
que es el hecho que §1.2 va a leer. La independencia declarada no existe.

**Severidad.** `CRITICA` — si la medición vuelve así, el grace entero es papel.

**Necesita decisión del owner.** **Sí**, aunque no hoy: si el proveedor cancela por mora, hay que
decidir si el grace se sostiene **de nuestro lado sin autorización viva** (como la cortesía) o si
deja de existir como concepto.

---

## ALTAS

### F-8B2-010 — Dos `UNIQUE` sobre `payment` se confunden y un cobro real se traga en silencio

**Qué se rompe.** El handler de webhooks trata *cualquier* fallo de inserción como «alguien ya lo
procesó, no hago nada». Hay dos restricciones distintas sobre `payment` y una de ellas puede
rechazar un cobro **legítimo y nuevo**. Ese cobro desaparece del registro sin emitir nada.

**El camino.**

1. El cobro del período se rechaza y entra en `recycling`; nuestro pago queda `PENDING` (no
   acreditado, así que no ocupa el cupo del período).
2. Un admin, avisado del impago, registra el pago manual. MP1 relee, no encuentra un pago
   acreditado, y escribe `REGISTERED`: el período queda ocupado.
3. El reciclado del proveedor **entra**. Llega el webhook del cobro.
4. El `INSERT` del `payment` acreditado viola `UNIQUE(subscription_id, período) WHERE el pago
   está acreditado`.
5. C6 dice qué hacer con un `INSERT` que falla: *«la segunda instancia falla al insertar y **no
   hace nada más**»*. El handler no puede distinguir cuál de las dos restricciones saltó.
6. Un cobro real, con dinero movido, no queda registrado y nadie emite
   `RECONCILIATION_REQUIRED`. La única vía de detección es el barrido comparando
   `authorized_payments`, que el propio capítulo 09 §4 advierte que devuelve cero por tres causas
   distintas.

Además, **`período` no es una columna de `payment`** en el capítulo 02 §2.3, que enumera
*«suscripción, monto, moneda, estado […], id del hecho en el proveedor, fecha del hecho, monto
reembolsado acumulado»*. La restricción que el capítulo 05 lleva a la base está escrita sobre un
dato que el modelo no declara, y `PS-6` midió que el proveedor **corre el período sin cobrar**, así
que derivarlo de fechas no es seguro.

**Dónde lo permite el diseño.** `docs/05-idempotencia-y-concurrencia.md` C5 y C6;
`docs/02-modelo-de-datos.md` §2.3.

**Severidad.** `ALTA` — la mitad de plata la toma B1; lo que reporto es que el mecanismo de
deduplicación no distingue dos causas de fallo y convierte una en un no-op.

**Necesita decisión del owner.** **No.**

---

### F-8B2-011 — Otorgar *Free Forever* cancela los addons que el grant venía a incluir

**Qué se rompe.** S13 lleva la suscripción a `CANCELLED`. El capítulo 16 define huérfano a un
addon de scope `VERTICAL_SUBSCRIPTION` **exactamente** por eso, y ordena cancelarlo en el
proveedor de inmediato. El regalo más grande del sistema destruye los complementos del
beneficiario en el mismo acto.

**El camino.**

1. Un cliente `ACTIVE` con dos addons recurrentes de scope `VERTICAL_SUBSCRIPTION`.
2. `SUPER_ADMIN` le otorga *Free Forever* con `includesAddons: true`.
3. S13: la suscripción principal va a `CANCELLED`.
4. Capítulo 16 §4.2: scope `VERTICAL_SUBSCRIPTION` queda huérfano *«cuando la suscripción de esa
   vertical llegó a `CANCELLED`»*.
5. Capítulo 16 §4.3: los complementos huérfanos **se cancelan en el proveedor, de inmediato**.
6. El beneficiario pierde los dos addons. El capítulo 16 §2.4 dice que el grant vale como título
   *en lugar de* la suscripción, y §3.2 que el grant **habilita pero no enciende**, así que tiene
   que volver a elegirlos uno por uno — y los que eran `DÍAS_FIJOS` ya consumieron su reloj, que
   `DEC-ADDON-001` no congela.

Todo el capítulo 16 §3.3 razona sobre **revocar** el grant. Otorgarlo sobre alguien que ya tiene
addons no lo mira nadie.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.2, S13;
`docs/16-addons.md` §4.2, §4.3, §2.4, §3.2.

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **Sí.** Qué pasa con los addons pagos de alguien a quien se le
regala todo es una decisión comercial, y el §35.2 la sugiere sin resolverla.

---

### F-8B2-012 — Ninguna transición declara el aviso de cobertura, lo único que esta épica debe

**Qué se rompe.** El contrato de cobertura entrega *«un hecho y un aviso»*. El aviso no figura en
la columna de efectos de ninguna de las quince transiciones de Suscripción, ni de las seis de
Addon. `PB2` —despublicar por pérdida de cobertura— cuelga de una señal sin emisor declarado, y la
lista de invalidación del caché tampoco se dispara.

**El camino.**

1. S6 lleva una suscripción a `SUSPENDED`. El §21 dice *«sin entitlements comerciales»*, o sea
   que la cobertura se perdió.
2. La columna «efectos» de S6 dice *«§21: sin listado público, sin edición, sin creación, sin
   entitlements comerciales»* — describe la consecuencia y no nombra el evento que la otra épica
   espera.
3. La regla 4 del núcleo obliga a dejar un **evento de dominio**, que es otra cosa: es registro,
   no la señal de frontera.
4. Verticales no se entera. La ficha sigue publicada hasta que algo la haga recalcular.

Y falta la otra mitad: **ningún capítulo declara qué estados cuentan como `cubierto`.** El
contrato sólo resuelve el par `ACTIVE`/`GRACE_PERIOD` (*«los dos cubren»*). `PAUSED`,
`CANCEL_SCHEDULED`, `SUSPENDED`, `PENDING_AUTHORIZATION` y `RECONCILIATION_REQUIRED` no tienen
respuesta escrita en ningún lado, y cada uno tiene una distinta.

**Dónde lo permite el diseño.**

- `HOS-1352/docs/12-contrato-de-cobertura.md` §3: *«Es lo único que billing le **empuja** a
  verticales»*.
- `docs/03-maquinas-de-estado.md` §3.2: ningún renglón de la columna «efectos» lo nombra.
- `nucleo/03-maquinas-de-estado.md` §1 regla 4: *«Toda transición deja un evento de dominio»*.

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **No**, salvo por un caso: si `PAUSED` cubre o no. El §26.1
detiene el servicio, pero `DEC-GRANT-003` implementa la **cortesía** pausando y sostiene el
servicio de nuestro lado. O sea que el mismo estado cubre o no según el motivo, y eso hay que
escribirlo.

---

### F-8B2-013 — La clave del outbox no distingue períodos: el segundo aviso no sale nunca

**Qué se rompe.** La ocurrencia de un correo de schedule es *«el sujeto más el hito»*, y el
ejemplo del propio capítulo es `sub:<id>:renov:-5d`. El sujeto es la suscripción, que vive años.
El segundo mes, la clave ya existe y la restricción de unicidad **descarta el aviso en silencio**.

**El camino.**

1. Mes 1: sale `sub:42:renov:-5d`. Perfecto.
2. Mes 2: el job calcula la misma ocurrencia. `UNIQUE(destinatario, plantilla, ocurrencia)` la
   rechaza. **No hay correo, y no hay error visible**: es exactamente el comportamiento que la
   clave fue a producir.
3. Lo mismo con el grace: un cliente que falla un cobro en marzo, se recupera por S5 y vuelve a
   fallar en abril **no recibe ninguno de los avisos del §42.3** en abril.
4. Lo mismo con el aumento: `sub:42:aumento:-30d` sirve una vez. El **segundo** aumento de precio
   de la vida de esa suscripción no se puede avisar.
5. El punto 4 es el más caro, porque el capítulo 22 apoya la prueba del §29 justo ahí: *«La clave
   de una-sola-vez del capítulo 07 §2 —el sujeto más el hito, `sub:<id>:aumento:-30d`— hace que
   **cada aviso sea localizable por lo que es**»*. Un aviso que no se envió es localizable como
   ausencia.

El capítulo **sabe** que la ocurrencia necesita un componente variable y lo resolvió para un solo
caso: *«si el trial se extiende […] la ocurrencia entonces incluye la fecha objetivo vigente»*. La
misma corrección no se aplicó a nada recurrente.

**Dónde lo permite el diseño.** `nucleo/07-outbox-y-notificaciones.md` §2 (la tabla de
ocurrencias, *«**Y el reloj no entra en la clave**»*, y la excepción del trial);
`docs/22-lo-legal.md` §1.2.

**Severidad.** `ALTA` — silencia correos transaccionales no suprimibles, uno de ellos con valor
probatorio.

**Necesita decisión del owner.** **No.**

---

### F-8B2-014 — El correo que bloquea la cancelación puede ser imposible de enviar

**Qué se rompe.** `DEC-MAIL-001` bloquea la acción antes de cancelar. La jerarquía de supresión
del capítulo 07 dice que un rebote duro suprime **todo, incluso lo transaccional**. Un cliente con
la dirección rota nunca puede ser cancelado, y el camino donde eso pasa es justo el que deja dos
autorizaciones vivas.

**El camino.**

1. Un cliente cambia de ciclo. Nace la nueva, la vieja sigue `ACTIVE` (`D7`).
2. Llega el webhook de que la nueva quedó autorizada. Toca cancelar la vieja.
3. El correo previo a la cancelación **bloquea la acción**: es la excepción declarada al §64.25.
4. La dirección del cliente rebota duro. Causa 1 de la jerarquía: *«suprime **todo**, incluso lo
   transaccional»*.
5. El correo nunca pasa a `sent`. §1.3 escala el caso a una persona; la acción de dominio **sigue
   bloqueada**, porque §5.3 dice *«si el correo falla, no se cancela y se reintenta»*.
6. Las dos suscripciones quedan vivas y cobrando hasta que alguien mire el escalamiento.

Y hay un segundo borde en el mismo mecanismo: `processing` con dueño y vencimiento devuelve la
fila a `pending` cuando el proceso muere. Si el proceso murió **después** de entregar, el reintento
manda el aviso dos veces; si el bloqueo se levanta al ver `sent`, la ventana entre el envío y el
commit del estado es una carrera con el correo del proveedor, que llega *«por su cuenta y siempre
primero»*.

**Dónde lo permite el diseño.** `nucleo/07-outbox-y-notificaciones.md` §4.2 (jerarquía), §1.2,
§1.3, §5.3; `nucleo/04-invariantes.md` §2.5 nota al §64.25.

**Severidad.** `ALTA` — el doble cobro lo toma B1; lo que reporto es el bloqueo sin cota.

**Necesita decisión del owner.** **Sí.** Hay que decidir el techo: cuántos intentos, y qué pasa
cuando la única obligación de aviso es inexigible porque la dirección no existe.

---

### F-8B2-015 — Pausar en cortesía está decidido, prohibido por la tabla e imposible afuera

**Qué se rompe.** `DEC-GRANT-004` decidió que se permite; el capítulo 19 obliga a la superficie a
ofrecerlo (*«que la pierde, y dejarlo elegir»*); la tabla del capítulo 03 no tiene esa transición;
el capítulo 02 permite una sola pausa sin `fin_real`; y `EX-11` midió que estando pausada el
proveedor rechaza **hasta volver a pausar**.

**El camino.**

1. Cliente en cortesía. Su suscripción está `PAUSED` con motivo `COURTESY`.
2. Pide pausar por su cuenta. `puedePausar()` arranca con `estado == ACTIVE`: da `false`.
3. S8 va de `ACTIVE` a `PAUSED`. `PAUSED → PAUSED` con cambio de motivo no existe, y §3.3
   prohíbe *«`PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED`»*.
4. La única implementación posible es reanudar (S10) y volver a pausar (S8). Eso abre una ventana
   `ACTIVE` contra el proveedor, y `PS-6` midió que estando pausada la fecha de cobro **avanza
   igual**: si el `next_payment_date` ya venció durante la cortesía, la reanudación puede
   entregarle un cobro a alguien a quien le estábamos regalando el servicio.
5. Además, `subscription_pause` admite *«a lo sumo una sin `fin_real` por suscripción»*: la fila
   de cortesía hay que cerrarla, y con ella se pierde el dato de cuántos días de regalo quedaban.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §5 (*«en cortesía pide pausar →
**se permite**»*) y §3.3; `nucleo/01-glosario.md` §3 (`puedePausar`);
`docs/02-modelo-de-datos.md` §2.2; `docs/19-superficies.md` §4 fila 5.

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **No** sobre la política —ya está decidida—; **sí** sobre si la
ventana de reanudación es aceptable, porque puede cobrar.

---

### F-8B2-016 — A3 no cancela nada en el proveedor: cada addon abandonado deja una autorización viva

**Qué se rompe.** A3 (*«vence la ventana → `ABANDONED`, mismas 72 h que S3»*) hereda la duración
de S3 y **no** su efecto. S3 declara explícitamente que sin cancelar en el proveedor *«queda una
autorización viva que puede cobrar»*. Un addon recurrente abandonado deja exactamente eso, y por
el `F-8B2-007` el barrido no lo mira.

**El camino.**

1. El cliente inicia la contratación de un addon `PERIÓDICO`. Nace el preapproval propio
   (`DEC-ADDON-002`).
2. Abandona el checkout. A las 72 h, A3 lleva la instancia a `ABANDONED`.
3. La tabla de A3 no declara ningún efecto sobre el proveedor, y el job de limpieza del §3.4
   está escrito para la ventana de **Suscripción**.
4. El preapproval queda `pending`. `EX-1` sigue `UNKNOWN`: no se sabe si vence solo — y el
   capítulo 06 §6 dice, sobre la ventana de suscripción, que **por eso** se cancela
   explícitamente.
5. `ABANDONED` es terminal: el barrido lo exime. Si ese `pending` alguna vez se autoriza, cobra a
   alguien cuya instancia local está muerta.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §8 (A3) contra §3.2 (S3) y §3.4
punto 2; `docs/06-proveedor.md` §6 (*«Falla hacia el lado seguro sin saber la respuesta»*).

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **No.**

---

### F-8B2-017 — A2 autoriza un addon sobre una principal que ya dejó de ser válida

**Qué se rompe.** «Válida» se evalúa en A1 y nunca más. Entre A1 y A2 pasan hasta 72 h, y en esa
ventana la principal puede pausarse, caer en grace, programar su baja o morir. El capítulo 16
llama a eso *«fabricar un huérfano con fecha»* y lo prohíbe sólo en el momento de comprar.

**El camino.**

1. `t=0`: el cliente contrata un addon. A1 verifica que la principal esté `ACTIVE`. Pasa.
2. `t=2 h`: el cliente pide la baja. S11: la principal va a `CANCEL_SCHEDULED`.
3. `t=5 h`: el cliente completa el checkout del addon. A2 —*«se autoriza → `ACTIVE`»*— **no tiene
   condición**.
4. Nace un addon `ACTIVE` colgado de una suscripción que tiene fecha de defunción, y con su
   propio preapproval cobrando.
5. Cuando la principal llega a `CANCELLED`, el addon queda huérfano y hay que cancelarlo en el
   proveedor: dos cobros, dos correos del proveedor y una baja que el cliente ya había pedido.

El mismo agujero con `PAUSED` es peor: `EX-11` mide que estando pausada el proveedor rechaza toda
modificación, así que ni siquiera se puede arreglar hasta que reanude.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §8, A2 (columna condición vacía);
`docs/16-addons.md` §2.2 (la tabla de estados válidos, escrita para el acto de comprar).

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **No.**

---

### F-8B2-018 — La máquina de pago manual no tiene entrada, y su grace no tiene quién lo abra

**Qué se rompe.** `AWAITING` no se alcanza desde ningún lado: las tres transiciones del §7 salen
de él y ninguna entra. Y la entrada al grace —S4, *«un cobro falla»*— describe un hecho que en el
pago manual **no ocurre**: nadie cobra, simplemente no llega la plata. Con la regla de §4.3
encima, el resultado práctico es que el primer período impago de un Partner va directo a
`SUSPENDED`.

**El camino.**

1. Un Partner se configura con pago manual (§17.2). No hay preapproval ni débito.
2. Llega el vencimiento del primer período y el pago no aparece.
3. No hay ningún evento *«un cobro falla»*: S4 no se dispara y la suscripción sigue `ACTIVE`.
4. MP3 dice *«se agota el grace sin que el admin haga nada → `DECLARED_UNPAID`»*, pero el grace
   nunca arrancó, y `AWAITING` nunca se creó.
5. Si en la implementación se resuelve haciendo que el vencimiento abra el grace, entra §4.3: un
   `user + vertical` **sin ningún pago acreditado** no pasa por `GRACE_PERIOD`. El Partner
   —alta administrada, sin self-service— queda suspendido antes de que el admin tenga un día para
   registrar la transferencia.
6. Y el §7 declara que la notificación al admin *«es parte del flujo y no un efecto colateral,
   porque sin ella nadie va a registrar nada»*: ese correo cuelga de un estado que no se creó.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §7 (MP1/MP2/MP3, todas desde
`AWAITING`) y §3.2 (S4); `docs/12-suscripcion.md` §4.3.

**Severidad.** `ALTA`.

**Necesita decisión del owner.** **Sí.** Hay que decidir si la regla «el grace no es un beneficio
de entrada» aplica al pago manual, donde no hay tarjeta que rebote y el impago puede ser una
transferencia que tarda dos días.

---

## MEDIAS

### F-8B2-019 — Las prohibiciones del §3.3 contradicen el «desde: cualquiera» de S14

**Qué se rompe.** Bajo la regla 1 del núcleo (*«La tabla de transiciones es exhaustiva. Lo que no
está, no pasa»*), las dos mitades de la misma tabla dicen cosas opuestas. La lectura conservadora
—que las prohibiciones ganan— vuelve el detector de divergencias **inalcanzable desde los estados
donde la divergencia sale más cara**.

**El camino.**

1. Una suscripción `CANCELLED` tiene su preapproval vivo cobrando (el caso del `F-8B2-007`).
2. S14 admite *«cualquiera»* como origen, así que la divergencia debería poder elevarse.
3. §3.3 dice *«`CANCELLED` → cualquier cosa | […] Una suscripción terminada no revive»*, y
   `RECONCILIATION_REQUIRED` es «cualquier cosa».
4. Lo mismo con `PAUSED`: §3.3 prohíbe todo destino que no sea `ACTIVE` o `CANCELLED`.
5. Y lo mismo hacia adentro del capítulo 05: C2 resuelve un cobro anterior a la cancelación
   *«extendiendo la fecha de fin de servicio»*, lo cual, si S12 ya corrió, exige mover una fila
   `CANCELLED` — que §3.3 prohíbe de frente.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.2 (S14) contra §3.3;
`docs/05-idempotencia-y-concurrencia.md` C2; `nucleo/03-maquinas-de-estado.md` §1 regla 1.

**Severidad.** `MEDIA` — no falla solo, pero decide si dos hallazgos críticos tienen salida.

**Necesita decisión del owner.** **No.**

---

### F-8B2-020 — Una cortesía consume, o no, la cuota de pausa del cliente, y nadie lo dijo

**Qué se rompe.** La cortesía se implementa **pausando**, y los límites de pausa se cuentan *«por
`user + vertical`»* sin mirar el motivo. Leído literal, tres cortesías de un `SUPER_ADMIN` agotan
las tres pausas por ventana del cliente y le quitan un derecho que su plan le vende.

**El camino.**

1. `SUPER_ADMIN` otorga tres cortesías de un mes a lo largo del año, cada una implementada como
   una pausa.
2. `cuotaDePausaDisponible(user, vertical)` cuenta pausas por `user + vertical`. Tres pausas
   consumidas, tres pausas-mes de las ocho.
3. El cliente pide su pausa en diciembre y `puedePausar()` devuelve `false` por *«máximo 3 pausas
   por ventana»*.
4. La superficie tiene que explicarle que perdió un derecho porque le regalamos algo.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §5 (*«**límites** […] Se cuentan
por `user + vertical`»*, sin distinguir motivo); `nucleo/01-glosario.md` §3, término 4.

**Severidad.** `MEDIA`.

**Necesita decisión del owner.** **Sí.** Es una decisión comercial de una línea, y hoy la toma
quien implemente.

---

### F-8B2-021 — MP2 dispara S6 sin su evento, y S15 aterriza en «el estado que corresponda»

**Qué se rompe.** El capítulo que declara la tabla exhaustiva la usa dos veces como si no lo
fuera. Si un evento declarado puede saltearse y un destino puede ser «el que corresponda»,
entonces la tabla es una convención, que es justo lo que la regla 2 del núcleo va a evitar.

**El camino.**

1. S6 está declarada con el evento *«se agota el reloj»*.
2. MP2 dice: *«la suscripción va a `SUSPENDED` por S6, **sin esperar el reloj**»* — invoca la
   transición y anula su evento.
3. S15 declara como destino *«el estado que corresponda»*, sin conjunto. Un humano puede llevarla
   a `ACTIVE` desde `CANCELLED`, que §3.3 prohíbe, y nada lo distingue de una resolución legítima.
4. Quien implemente lee dos precedentes de que las transiciones se pueden invocar por nombre
   salteando su guarda.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §7 (MP2), §3.2 (S6, S15);
`nucleo/03-maquinas-de-estado.md` §1 reglas 1 y 2.

**Severidad.** `MEDIA`.

**Necesita decisión del owner.** **No.**

---

### F-8B2-022 — El candado de idempotencia no define la contención ni la respuesta perdida

**Qué se rompe.** `DEC-CONC-001` fija **cuándo** se persiste la clave y **dónde** vive, y no fija
qué hace el segundo que la encuentra sin resultado. Con `EX-17` midiendo que el proveedor no
deduplica y `PA-3` midiendo que una creación autorizada cobra, la diferencia entre «espero» y
«reintento» es la diferencia entre un cobro y dos.

**El camino.**

1. Primer click: se persiste la clave, sale la llamada al proveedor.
2. Segundo click a los 400 ms: la clave existe, `resultado` vacío.
3. El diseño no dice si eso devuelve el resultado anterior (no hay), si espera, si falla, o si
   reintenta la llamada. Para la principal lo tapa la restricción de unicidad; para un addon no
   hay nada (`F-8B2-006`).
4. Variante peor: la primera llamada **crea y no responde**. La fila queda
   `PENDING_AUTHORIZATION` sin id del proveedor en `provider_link`. El capítulo 09 §2.1 dice que
   *«una suscripción cuyo id se pierde es invisible para el barrido»*.
5. Esa fila bloquea al cliente 72 h por la restricción de unicidad, y cuando el job de limpieza
   la venza **no va a poder cancelar nada**, porque no tiene el id que S3 necesita.
6. El barrido de creaciones sin respuesta existe *«cada pocos minutos»*, pero ningún capítulo dice
   qué escribe cuando encuentra la suscripción huérfana por correo del pagador: ni en qué estado
   deja la fila, ni si repara `provider_link`, ni qué pasa si encuentra **dos**.

**Dónde lo permite el diseño.** `docs/05-idempotencia-y-concurrencia.md` §1.1 y §1.2;
`docs/02-modelo-de-datos.md` §2.3 (`idempotency_key`: *«la clave, a qué operación corresponde, su
resultado»*, `UNIQUE(clave)`); `docs/09-conciliacion.md` §7.

**Severidad.** `MEDIA` — el daño concreto ya está contado en 006; lo que falta acá es la
semántica, y sin ella cada unidad la inventa distinta.

**Necesita decisión del owner.** **No.**

---

## Ataques que intenté y el diseño resistió

Vale la pena registrarlos: son los lugares donde busqué y no encontré.

1. **Dos webhooks del proveedor desordenados.** No hay forma de producir un retroceso: §10.1
   relee el recurso por id y escribe lo leído, así que los dos órdenes convergen al mismo estado.
   El argumento de por qué la regla **no se apoya en ordenar** —*«un evento ordenado sigue sin
   decir el estado actual»*— es correcto y resiste el caso del `EX-15` (mutación sin entrega),
   que el `version` del barrido levanta aparte.
2. **Deduplicar por id de notificación.** Intenté romperlo con `WH-4` (el reintento cambia el id
   **y** re-firma). El diseño ya no usa el id del evento: usa el `version` para descartar y el id
   del **hecho** para los cobros. Las dos mediciones que lo sostienen (`WH-1`, `RF-7`) están
   citadas donde corresponde.
3. **La carrera del canje de promo el día del vencimiento del trial.** Es el mejor diseño de
   carrera del programa: *«gana el estado escrito, nunca la hora»* más el job releyendo la fecha
   **dentro de su propia transacción**. No encontré por dónde entrarle, y la mitad que se suele
   olvidar —que el canje rechazado no se consume— también está.
4. **C1, el pago que entra mientras corre la suspensión.** La reevaluación de la transición
   dentro de la transacción que escribe, con la versión de la fila, cierra el intermedio. No hace
   falta elegir ganador y el diseño explica por qué.
5. **Canjear el mismo promo dos veces.** `UNIQUE(promo_code_id, user_id)` en la base, no un
   chequeo. Igual que el §11, es el nivel correcto.
6. **Confundir una cortesía con una pausa pedida por el cliente al reanudar.** El motivo
   obligatorio con dominio cerrado, y la regla de que el reloj lee el motivo y nunca al proveedor,
   resuelven un caso que `EX-3` mide como indistinguible del otro lado. Es la mejor pieza del
   capítulo 03 §5.
7. **La ventana de 72 h contra el ciclo más corto.** La justificación —más larga que la demora
   máxima medida, más corta que el ciclo mensual— aguanta: no hay forma de que una ventana abierta
   se superponga con un cobro **de la misma suscripción**. Lo que sí rompe es la superposición con
   la suscripción **vieja** durante un cambio de ciclo, y eso es otro hallazgo.
8. **La cuota de pausa sobreviviendo a cancelar y resuscribirse.** `DEC-SUB-004` la cuenta por
   `user + vertical`; el bypass evidente está cerrado.
9. **Un `2xx` cerrando una mutación.** Busqué un lugar donde el diseño le crea a un código de
   estado y no lo hay: `D5`, la regla 4.1 del capítulo 06, la regla 2 de la descomposición y la
   regla del capítulo 20 §6 lo prohíben en producción y en los tests.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, esto es lo que no tiene dónde vivir hasta que el 13 se escriba. No lo reporto como
hallazgo: lo reporto como el alcance real del hueco.

1. **La máquina de Pago no tiene productor.** El capítulo 03 §6 declara P1–P5 y ningún capítulo
   dice **quién escribe `PENDING`**, con qué disparador, ni con qué clave de deduplicación antes de
   que exista el id del hecho. Todo `F-8B2-010` depende de eso.
2. **La detección de «el proveedor se dio por vencido»**, que es el disparador de S4 y el único
   dato que hace arrancar el reloj del grace. El capítulo 12 la delega a una relectura cuyo
   criterio de lectura no está escrito en ningún lado. `F-8B2-009` entero vive acá.
3. **La entrada de la máquina de Pago manual**: quién crea `AWAITING`, contra qué hito del
   período, y con qué reloj. `F-8B2-018`.
4. **La recuperación de una creación cuya respuesta se perdió.** El capítulo 05 §1.2 define la
   **pregunta** (por pagador y estado) y no el **efecto**: en qué estado queda la fila, si se
   repara `provider_link`, qué se hace con dos resultados. `F-8B2-022`.
5. **Si hay un reloj o dos.** La pregunta del `spec.md` §5.1 decide si S4 existe como evento
   propio o es una lectura del proveedor, y si los reintentos son nuestros —*«terreno regulado»*—
   con su propia idempotencia, su techo por ventana y sus códigos no reintentables. Ninguna de
   esas tres cosas tiene hoy un lugar en ninguna máquina.
6. **La acumulación de parciales de P5 contra el saldo**, con `RF-3` en `UNKNOWN`, y qué estado
   local queda mientras un reembolso está pedido y no confirmado — hoy no hay estado entre
   `SUCCEEDED` y `PARTIALLY_REFUNDED` para «pedido, pendiente de confirmación humana».
7. **El `período` de la restricción C5**, que no es una columna de `payment` y que `PS-6` mide que
   el proveedor corre sin cobrar.

---

## Fuera de mi vector

Lo que vi y le toca a otro. Los defectos del núcleo van marcados `NUCLEO`.

- **B1 (doble cobro / pérdida de pago)** — le cedo las mitades de plata de `F-8B2-003`,
  `F-8B2-010` y `F-8B2-014`, y uno entero que es suyo: durante las 72 h de un cambio de ciclo, la
  `start_date` de la nueva quedó **congelada al crearla** (`EX-34`: la fecha de una viva es
  inmutable) mientras la vieja puede ejecutar un cobro más. `D8` —*«Una fecha de primer cobro
  futura es la precondición de seguridad de todo cambio de plan o de ciclo»*— se evalúa una vez, al
  principio de una ventana durante la cual el hecho que la sostiene puede cambiar, y no hay forma
  de corregirla después.
- **B3 (conciliación, datos, migración)** — `receipt` declara `UNIQUE(numero)`, **sin huecos**
  (cap. 02 §2.3). Una secuencia sin huecos no la puede sostener una restricción de unicidad bajo
  transacciones que abortan, y ningún capítulo dice dónde vive esa garantía.
- **B3** — el capítulo 09 §6.2 fija la ventana de tolerancia del barrido *«contra el retraso
  medido»*, y los retrasos medidos son de tres órdenes distintos (~100 s, ~26 min, ~33 min) más
  los reintentos de `WH-4` a +18,8 y +35,1 min. Qué número se elige, y qué pasa con la cola que
  nadie midió, es materia de conciliación.
- **`NUCLEO`** — `nucleo/03-maquinas-de-estado.md` §1 regla 5 (*«Ninguna máquina consulta el
  estado del proveedor para decidir»*) y `docs/12-suscripcion.md` §1.2 (*«eso se detecta releyendo
  el recurso»*) se contradicen de frente sobre una transición concreta, S4. La regla 5 es la que
  hace posible `F-8B2-003`; o lleva una excepción declarada, o el capítulo 12 está fuera de regla.
- **`NUCLEO`** — `nucleo/04-invariantes.md` §5: la columna de decisiones suma 16 (2+11+3), el
  texto dice *«suma 14 sobre 12 invariantes»*, los invariantes `D` son **catorce** (`D1`–`D14`), y
  el cierre dice *«Cuarenta y nueve invariantes»*, que es 37+12. El total correcto es 51. No cambia
  ninguna decisión, pero es un conteo que alguien va a citar.
- **`NUCLEO`** — `docs/10-verticales-planes-billing-options.md` §4.6 dice *«El §63 pide ocho
  máquinas y el capítulo 03 las tiene»*, mientras el núcleo y el glosario ya registraron que son
  **nueve** desde que se agregó la Postulación de Partner. Es una línea caduca bajo una conclusión
  correcta.
- **B3 / producto** — el catálogo de correos del capítulo 07 §6 **no tiene ninguna pieza para la
  ventana de `PENDING_AUTHORIZATION`**, que es donde `EX-3` acaba de medir que el proveedor calla
  y que el propio diseño declara *«nuestro único canal»*. El §3.4 punto 3 sólo describe una
  pantalla, y la persona que abandonó un checkout es, por definición, la que no está mirando la
  pantalla. Lo dejo acá porque es una falta de alcance de notificaciones, no una máquina rota.
