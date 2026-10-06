---
title: "FASE 8-bis · B1 — doble cobro y pérdida de pago"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · B1 — doble cobro y pérdida de pago

Segunda pasada adversarial sobre la épica de billing (`HOS-1354`), el núcleo y el contrato de
cobertura, con el mismo vector: **los caminos por los que a alguien se le cobra dos veces, se le
cobra lo que no corresponde, se le cobra después de irse, o paga y no recibe lo que pagó.**

**Catorce hallazgos nuevos. Siete `CRITICA`** — y **seis de los siete los introdujo la FASE 9**.
Es el dato que esta pasada existe para producir, y sale con un patrón que conviene decir antes de
los hallazgos:

> **El arreglo de `R1` agregó un eje a la clave y recorrió el dominio sobre el eje viejo.**
> `15-fase-9/00-dominios-de-los-racimos.md` §R1 §3 declara **«9 estados × 10 caminos = 90 pares
> ordenados»** y su Dimensión C explica por qué la clase *«no multiplica»*. **`sucede_a` sí
> multiplica**: la base ahora discrimina sobre él, así que el dominio real pasó a ser **9 × 10 × 2
> = 180 pares**, y `05-R1-resuelto.md` §4 recorrió **90** — la mitad de origen. La otra mitad no la
> miró nadie, y ahí vive `F-8bB1-001`.

El segundo patrón, y es el que produce cuatro hallazgos más: **la FASE 9 movió la precondición de
seguridad del mecanismo más caro del sistema (`D8`) de «recordable» a «verificable», y lo que
volvió verificable es el número que nunca estuvo en duda** — el que mandamos —, mientras prohibía
por escrito mirar el único que puede estar mal: el que el proveedor escribió.

Regla de lectura: cada hallazgo se apoya en una cita textual con archivo y §. Donde una medición de
`06-mp-validation-matrix.md` sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8bB1-001 — Una sucesora viva deja el candado `A` VACÍO: quien ya hizo un upgrade puede abrir un alta nueva y quedar con dos autorizaciones cobrando

**Qué se rompe.** Todo cliente que alguna vez completó un cambio de plan, un cambio de ciclo o un
arrepentimiento **queda permanentemente fuera del §11**. Desde ese día, un alta nueva en la misma
vertical entra sin que nada la rechace, y las dos autorizaciones cobran todos los meses. `EX-6`
mide que el proveedor **no las frena** — se llegó a seis conviviendo en producción, mismo
`payer_email`.

**El camino.**

1. Un cliente `ACTIVE` hace un upgrade. Nace la sucesora con `sucede_a` apuntando a la vieja, entra
   por el candado `B`, autoriza, y `D7` cancela la predecesora al llegar el webhook. Estado final:
   **una sola fila viva, `ACTIVE`, con `sucede_a` NO nulo.**
2. **Nada en ningún capítulo limpia `sucede_a`.** Un barrido completo de los dos repos encuentra la
   columna en nueve lugares y **ninguno la anula**: `B/02` §2.2 la declara *«FK anulable a
   `subscription`»* y nunca dice cuándo vuelve a nulo; `B/03` `S1` sólo la escribe; `D15` habla de
   qué no puede ser sucedido, no de dejar de ser sucesora. La fila vive el resto de su vida en el
   candado `B`.
3. **El candado `A` queda vacío**, porque su predicado es `sucede_a IS NULL` y no hay ninguna fila
   que lo cumpla.
4. El cliente pide un alta nueva (`C1`). La condición de `S1` es *«no hay otro **origen** vivo»* —
   y no lo hay. **La transición dispara.**
5. El `INSERT` nace con `sucede_a IS NULL`, así que sólo lo mira el candado `A`, que está vacío.
   **Entra.** Los dos guards tampoco: `G-R1-A` y `G-R1-B` se predican sobre *«una fila con
   `sucede_a` no nulo»*, y la fila nueva lo tiene nulo.
6. Quedan **dos filas principales vivas del mismo `user + vertical`**, cada una con su preapproval.
   La segunda autoriza y cobra; la primera nunca se cancela, porque `D7` sólo cancela *«la vieja»*
   de una sucesión **declarada**, y acá no se declaró ninguna.
7. Y no lo levanta nada: el barrido del cap. 09 §3 compara **cada suscripción contra el proveedor**,
   nunca dos nuestras entre sí — que es `F-8B1-014`, que sigue abierto.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2:

> ```text
> -- A · el compromiso: a lo sumo UNA fila principal de origen viva por user + vertical
> UNIQUE (user_id, vertical)
>   WHERE clase = principal
>     AND sucede_a IS NULL
>     AND estado ∈ {vivos}
> ```

y, tres párrafos abajo, la garantía que se da por probada:

> **El máximo de filas principales vivas pasa de una a dos, y no a un número abierto.** Dos,
> exactamente: un origen y su única sucesora.

Es cierto **durante** la sucesión y deja de serlo después: una sucesora que sobrevive a su
predecesora no es *«un origen y su única sucesora»*, es una sucesora sola con el candado de origen
libre.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, condición de `S1`:

> no hay otro **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión**
> (`sucede_a`)

Contra la prosa del mismo capítulo, §3.3, que lo prohíbe:

> dos vivas para el mismo `user + vertical`, **salvo una sucesión declarada** | es el §11, y su
> excepción está acotada por la base, no por una convención

**La base y la prosa dicen cosas distintas**, y la base es la que decide: la segunda fila no declara
ninguna sucesión, así que la excepción no la ampara, y sin embargo entra.

Y el recorrido que debería haberlo visto no podía verlo. `15-fase-9/05-R1-resuelto.md` §4.3, par
`(ACTIVE, C1)`:

> | C1 | candado `A` rechaza | **RECHAZA** — es el §11 haciendo exactamente su trabajo |

El veredicto es correcto **si la fila `ACTIVE` es de origen**. El recorrido está indexado por estado
y nunca pregunta por `sucede_a`, así que el par `(ACTIVE-sucesora, C1)` no existe en la grilla. Lo
mismo vale para `(GRACE_PERIOD-sucesora, C1)`, `(PAUSED-sucesora, C1)`, `(SUSPENDED-sucesora, C1)`
y `(CANCEL_SCHEDULED-sucesora, C1)`, y para los caminos `C4`…`C7` sobre las cinco.

**Severidad**: `CRITICA`. Es el doble cobro literal, sobre una población que crece con cada upgrade
del catálogo, y el candado que la FASE 9 escribió para impedirlo es el que lo habilita.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, y es el defecto exacto que
`DEC-METH-006` manda buscar: el eje que la resolución de `R1` agregó a la clave (`B/02` §2.2,
cambios 1 y 2 del §2 de `05-R1-resuelto.md`) duplicó el dominio y el recorrido se hizo sobre la
mitad vieja. Antes de la FASE 9 este camino lo rechazaba la clave única.

---

### F-8bB1-002 — `D8` no subió a verificable: la columna guarda la fecha que MANDAMOS y el capítulo prohíbe leer la que el proveedor escribió

**Qué se rompe.** La única precondición de seguridad de todo cambio de plan y de ciclo quedó
apoyada en un dato que **no puede estar mal**, mientras el dato que sí puede estar mal quedó
declarado fuera de alcance por escrito. Cuando el proveedor no respeta la fecha, la sucesora cobra
en el acto con la predecesora viva: el cliente paga dos veces el mismo período, y **ningún
mecanismo del diseño lo mira**.

**El camino.**

1. Se crea la sucesora con fecha de primer cobro futura. **Esa fecha se guarda en la fila**, y
   `G-R1-B` verifica que sea *«estrictamente futura»*.
2. `EX-38` mide, en **producción con tarjeta real**, que el proveedor **convierte esa `start_date`
   en un `free_trial` por su cuenta**: el request no lo nombra y el objeto queda con uno.
3. `EX-29` mide que el otorgamiento de ese `free_trial` **no lo decide el request**, que el patrón
   es reproducible (`✅ ✅ ❌`) y que **el mecanismo no está identificado**. En el caso `❌`, la
   relectura muestra `free_trial: null` y `next_payment_date` **en el instante del alta en vez de
   mañana**: el preapproval cobra ya.
4. **La columna no se entera**, porque guarda lo que pedimos. `G-R1-B` tampoco, por la misma razón.
   Los dos verifican nuestra intención, nunca la respuesta.
5. Y el diseño **prohíbe por escrito** la única lectura que lo vería.
6. La red que quedaba —el barrido diario— está desarmada en el mismo capítulo: la comparación de
   `next_payment_date` está declarada **no divergencia**, por nombre.
7. La predecesora sigue viva (`D7` la cancela recién con el webhook de la sucesora), así que el
   período en curso queda cobrado dos veces, sobre días que el cliente ya había pagado.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2:

> **La fecha de primer cobro se guarda, y no se relee del proveedor.** `D8` [...] era un invariante
> **recordable**; con la columna pasa a ser **verificable** [...] Releerla del proveedor lo prohíbe
> `D6` (*«el buscador del proveedor no es fuente de verdad de nada»*) y además no serviría: un
> guard tiene que poder correr sin red.

**`D6` no dice eso.** `nucleo/04-invariantes.md` §3, `D6`: *«**El buscador** del proveedor no es
fuente de verdad de nada»*, y su origen es `RC-1`, que mide el `search`. El camino que haría falta
acá es `GET /preapproval/{id}`, que `RC-2` mide **`VERIFIED`** y que el cap. 03 §10.1 declara *«el
camino confiable»* y **obliga** a recorrer en cada webhook. Se invocó la regla del buscador para
prohibir la lectura por id.

`HOS-1354/docs/09-conciliacion.md` §3:

> | fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una
> divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`) |

`PS-6` mide el corrimiento **de una pausada**. Esa fila justifica ignorar el campo en un caso, y el
barrido lo ignora en todos — incluido el único en el que ese campo es el invariante.

`nucleo/04-invariantes.md` §3, `D8`, columna «dónde se hace cumplir»:

> **base**: la fecha con la que nació la fila se guarda en `subscription`, y un guard la verifica

El §1 del mismo capítulo define **base** como *«una restricción de la base lo impide»*. Una columna
que guarda un número no impide nada, y *«un guard la verifica»* es el nivel **guard**, que el mismo
§1 ordena **debajo** de servicio. `D8` no subió: cambió de apoyo y se declaró un escalón más arriba
del que ocupa. `NUCLEO`.

**Severidad**: `CRITICA`. Es doble cobro, y lo único que cambió respecto de la FASE 8 es que ahora
hay una columna y un guard que hacen creer que está cubierto.

**¿Es nuevo, o es el arreglo?** **Es el arreglo**. El camino es el de `F-8B1-004` y **sigue llegando
entero**; lo nuevo, y es lo grave, es que la FASE 9 agregó tres artefactos —la columna, `G-R1-B` y
la subida de nivel de `D8`— que **vuelven invisible** el hueco sin cerrarlo, y prohibió la
verificación que lo cerraría.

---

### F-8bB1-003 — «Un día como mínimo» contra una ventana de 72 h: toda sucesora autorizada después del primer día nace con la fecha ya vencida, y `EX-39` mide que no se puede mover

**Qué se rompe.** La precondición está escrita para ser cierta en el instante en que la fila nace, y
tiene que seguir siendo cierta hasta que el cliente autorice — que puede ser **71 horas después**.
Para el 97 % de esa ventana la fecha de primer cobro ya pasó, y no hay forma de corregirla.

**El camino.**

1. Un cliente `ACTIVE` pide cambiar de ciclo el lunes a las 10:00. La sucesora nace con fecha de
   primer cobro *«a un día como mínimo»*: martes 10:00. `G-R1-B` pasa — la fecha es estrictamente
   futura **en ese instante**.
2. El cliente no termina el checkout ese día. La ventana dura **72 h** (`S3`), así que tiene hasta
   el jueves a las 10:00.
3. Autoriza el miércoles a las 09:00. **La fecha de primer cobro pasó hace 23 horas.**
4. **No se puede mover.** `EX-39`, sonda 48: tres formas de correr la fecha sobre un preapproval
   **`pending`**, las tres `200`, `last_modified` congelado, la fecha sin moverse — con el control
   de `transaction_amount` que sí entró y sí movió `last_modified`. La conclusión textual del
   capítulo: *«`start_date` sirve **sólo al crear**, y punto»*.
5. `EX-38` mide que el proveedor tradujo esa `start_date` en un `free_trial` con
   `first_invoice_offset: N` **días contados desde la creación**. Un offset de un día, consumido
   hace 23 horas, es una prueba gratis vencida antes de empezar.
6. La predecesora sigue `ACTIVE` y su período está pagado, porque `D7` la cancela recién con el
   webhook de la sucesora — el mismo webhook que acaba de llegar. Los dos preapprovals cobran el
   mismo período.
7. **Y no hay una sola fila de las 90 medidas que diga qué hace el proveedor con una `start_date`
   pasada al autorizar.** `EX-33` midió tres autorizaciones a `+3`, `+2` y `+5` días, todas hechas
   **antes** de la fecha; `PA-3` mide que autorizar con `card_token_id` cobra en el acto en sandbox
   y ~26 min después en producción. Las dos apuntan a que cobra; ninguna lo mide.

**Dónde lo permite el diseño.**

`HOS-1354/docs/12-suscripcion.md` §5.2:

> **Toda sucesora nace con fecha de primer cobro a un día como mínimo.** Ninguna cobra hoy.

y el argumento con que se eligió ese número:

> el costo —que el cliente espere un día para el primer cobro del plan nuevo— es **a su favor**

El costo está calculado sobre un cliente que autoriza en el momento. Sobre el que autoriza al
tercer día, el costo es el doble cobro que la regla existe para impedir.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.4, punto 1, fija la otra mitad y no las cruza:

> **Duración máxima: 72 horas.** [...] más corto que el ciclo más corto que vendemos, para que una
> **ventana abierta nunca se superponga con un cobro**.

La restricción está escrita palabra por palabra —*«una ventana abierta nunca se superponga con un
cobro»*— y se verifica contra **el ciclo**, nunca contra la fecha de primer cobro de la sucesora,
que es el cobro que esa ventana sí se superpone.

Y los dos predicados no son el mismo. `B/12` §5.2 dice *«a un día como mínimo»*;
`HOS-1354/docs/20-testing.md` §2, `G-R1-B`, dice:

> una fila con `sucede_a` no nulo **no** nace con fecha de primer cobro **estrictamente futura**

*«Estrictamente futura»* se satisface con un segundo. El guard que congela la regla es más débil que
la regla, y el mensaje del guard afirma menos de lo que el capítulo promete — al revés del criterio
del §2.1 de ese mismo capítulo.

Además, el `B/05` §3 apoya su hueco deliberado en la misma premisa:

> **Y una sucesora en `PENDING_AUTHORIZATION` no bloquea, a propósito.** Todavía no puede cobrar
> —`D8` le exige fecha de primer cobro futura—

Para una sucesora de más de un día de antigüedad, **sí puede cobrar**, y entonces el pago tardío que
reactiva a la predecesora la deja pagando dos veces, que es exactamente lo que la condición 3 existe
para detener.

**Severidad**: `CRITICA`. El §61 es terminante —*«No comenzar implementación de una capability
crítica mientras siga `UNKNOWN`»*— y acá la precondición de seguridad del mecanismo más caro del
sistema descansa sobre un comportamiento del proveedor que **no tiene fila**, en el 97 % de la
ventana en que tiene que valer.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** *«Un día como mínimo»* es la salida (a) que
`05-R1-resuelto.md` §6 ítem 6 recomendó y que `B/12` §5.2 escribió. El número se eligió mirando el
choque con el crédito cero del grace y no se cruzó con la ventana de `S3`, que es el otro plazo del
mismo mecanismo.

---

### F-8bB1-004 — El cobro de `recycling` que §5.3 acepta REACTIVA a la predecesora, y el crédito de la sucesora ya se computó en cero

**Qué se rompe.** Un cliente en mora que mejora su plan paga el período viejo **entero**, y el
crédito por ese pago es **cero** porque se calculó suponiendo que ese período no se iba a pagar
nunca. No es la deuda que se le perdona y el proveedor le cobra igual —eso §5.3 lo anticipa—: es que
ese pago **no le compra nada**, y la fórmula que lo ignoró ya no se puede corregir.

**El camino.**

1. Cliente en `GRACE_PERIOD`. `DEC-SUB-003` lo invita a cambiar de plan: es *«el camino de
   recuperación»*, y `05-R1-resuelto.md` §4.4 lo ejecuta como sucesión (`SUCEDE`).
2. El crédito se computa **al crear** la sucesora, y en grace vale **cero** —*«el período en curso
   no se pagó»*—. De ese cero sale la fecha de primer cobro a un día.
3. La predecesora sigue viva, porque `D7` lo exige. Su cuota sigue en `recycling`, medido en
   producción el 2026-09-17.
4. **La cuota entra**, dentro de las 72 h. El capítulo lo acepta y avisa antes.
5. Pero ese pago no se queda quieto: pasa por `B/05` §3 y **las cuatro condiciones se cumplen** —la
   fila está en `GRACE_PERIOD` (1), el monto es el del período (2), no hay otra fila con título y
   *«una sucesora en `PENDING_AUTHORIZATION` no bloquea, a propósito»* (3), y no hay otro pago del
   período (4)—. **La predecesora vuelve a `ACTIVE` con el período pagado** (`S5`).
6. El cliente autoriza la sucesora. `D7` cancela la predecesora: un período **recién pagado**, con
   servicio sin usar, y **crédito cero**, porque el cero se calculó en el paso 2 y `EX-39` mide que
   la fecha de la sucesora no se puede mover para compensarlo.
7. Resultado: pagó el ciclo viejo completo, no usó nada de él, y empieza a pagar el nuevo al día
   siguiente.

**Dónde lo permite el diseño.**

`HOS-1354/docs/12-suscripcion.md` §5.2:

> **En grace, el período en curso no se pagó** — un cobro falló, que es la definición del estado.
> Entonces el crédito es **cero**

y §5.3, que ve la mitad del problema:

> Mientras la predecesora siga viva su cuota sigue en `recycling` (§1.3, medido) y **puede entrar**.
> Si entra dentro de las 72 h de la sucesión, el cliente **paga la deuda que le perdonamos**.
>
> > **Se acepta que el cobro pueda entrar, y se le avisa al cliente ANTES de que pase.**

*«La deuda que le perdonamos»* describe el cobro y **no** describe su consecuencia: que la premisa
del §5.2 —*«no se pagó»*— deja de ser cierta y el crédito queda mal calculado hacia abajo por un
ciclo entero.

Y el propio capítulo tiene la corrección escrita para el caso gemelo, en §5.4, sin aplicarla acá:

> Si la predecesora **renueva** dentro de esa ventana, el crédito quedó corto **por un ciclo
> entero**. [...] la salida no es corregir: es no llegar a ese caso. Cuando falten pocos días para
> la renovación, el cambio de plan se ofrece con **ventana reducida**

**La mitigación no alcanza al cobro de `recycling`**, y por una razón de mecanismo: se activa
*«cuando falten pocos días para la renovación»*, o sea contra una fecha conocida. El cobro reciclado
**no tiene fecha** —lo dispara el proveedor cuando quiere, y `GR-3` sigue `UNKNOWN`—, así que no hay
número que pueda cerrar esa ventana.

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3 es lo que convierte el cobro en una
reactivación, no en un simple ingreso, y lo hace **a propósito**.

**Severidad**: `CRITICA`. Es plata real del cliente, en el único camino que el diseño le ofrece a
quien está en mora, y el reembolso —la única salida— es *«la única capacidad que el cap. 06 §10
declara en riesgo de plataforma»*, como el propio §5.3 reconoce.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** §5.2 y §5.3 son texto nuevo de la FASE 9
(ítems 6 y 7 del §6 de `05-R1-resuelto.md`), y la interacción entre el crédito cero de §5.2 y el
cobro aceptado de §5.3 no existía antes, porque antes no existía la sucesión desde grace.

---

### F-8bB1-005 — La marca `requiere_conciliación` apaga el único detector de una divergencia de monto y congela la única salida del cliente: el cobro divergente sigue ejecutándose todos los ciclos

**Qué se rompe.** Una suscripción a la que el proveedor le cobra un monto distinto del pactado entra
en un estado del que **el sistema deja de hablar**: se alerta una vez, se la saca del barrido, y se
le bloquea al cliente el único acto con el que podría arreglarla. El cobro equivocado sigue saliendo
de su tarjeta todos los meses.

**El camino.**

1. El barrido diario encuentra que `transaction_amount` no coincide con nuestro monto. Es el caso
   que el cap. 09 §2.3 declara *«el que diverge en silencio»*, porque `EX-15` mide que mutar el
   monto **no emite webhook**.
2. `S14` pone la marca. §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero
   decisiones destructivas automáticas** — o sea que **el preapproval no se toca y sigue cobrando el
   monto divergente**.
3. **La fila sale del barrido.** No vuelve hasta que una persona levante la marca.
4. **El cliente no puede arreglarla.** La marca *«congela la sucesión»*, y la sucesión es el
   mecanismo de todo cambio de plan y de ciclo (`DEC-SUB-006`, `DEC-SUB-007`). Un cliente al que le
   están cobrando de más no puede bajarse de plan ni cambiar de ciclo.
5. No hay plazo. Ni `S14`, ni §22.1, ni el cap. 09 fijan un vencimiento para la intervención humana.
   Mientras nadie mire el correo, el cobro divergente corre indefinidamente y **el sistema no lo
   vuelve a decir ni una sola vez más**.

**Dónde lo permite el diseño.**

`HOS-1354/docs/09-conciliacion.md` §3:

> **Y una fila con la marca `requiere_conciliación` puesta tampoco se barre.** No porque no pueda
> divergir, sino al revés: **ya divergió y hay una persona mirándola**. Volver a compararla no
> agrega información y sí agrega ruido

*«Hay una persona mirándola»* es la premisa, y el diseño no tiene nada que la sostenga: lo único que
se emite es el correo del §22.1. *«No agrega información»* es falso para el caso de monto: cada
ciclo agrega **un cobro más** por el importe equivocado.

`HOS-1354/docs/02-modelo-de-datos.md` §2.2:

> **Y la marca sí bloquea algo, a propósito**: mientras esté puesta **no se puede declarar una
> sucesión** sobre esa fila.

y su única excepción:

> una fila marcada **sí puede suceder cuando está en `CANCEL_SCHEDULED`**

La excepción se eligió por mecanismo —ahí el preapproval ya está cancelado— y deja afuera
precisamente el estado en que el preapproval **está vivo y cobrando mal**.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S14`, confirma que nada se cancela:

> **cero decisiones destructivas automáticas**

**Severidad**: `CRITICA`. Alguien paga de más, todos los ciclos, y el cambio de la FASE 9 retiró la
alerta diaria que lo repetía.

**¿Es nuevo, o es el arreglo?** **Es el arreglo**, en sus dos mitades. Las dos son cambios de la
FASE 9: el cambio 14 del §2 de `05-R1-resuelto.md` (*«una fila marcada no se barre»*) y el bloqueo
de la sucesión de `B/02` §2.2. Antes de la FASE 9 la fila salía de los vivos y la persona *«podía
contratar de nuevo»* —que era la razón escrita del owner—, y el barrido la levantaba todos los días,
que `F-8B2-002` llamó ruido. Se cambió el ruido por el silencio y se le quitó al cliente la salida,
sin poner un plazo en el lugar de ninguna de las dos.

---

### F-8bB1-006 — El contrato no dice qué emite una suscripción en `PENDING_AUTHORIZATION`: o son 72 h de servicio completo gratis y repetibles, o son dos planes sumados durante toda la sucesión

**Qué se rompe.** El contrato de cobertura enumera el `hasta` de cuatro situaciones y deja **cuatro
de los nueve estados de suscripción sin respuesta**, entre ellos el que la FASE 9 volvió normal:
`PENDING_AUTHORIZATION`. Las dos lecturas posibles cuestan plata, en la misma dirección.

**El camino, rama (a) — servicio gratis repetible.**

1. Una persona pide un alta. Nace la fila en `PENDING_AUTHORIZATION`. Todavía no autorizó nada y no
   pagó nada.
2. El contrato define la clase `TÍTULO` por **tipo**, no por estado: *«`TRIAL` · `SUSCRIPCIÓN` ·
   `CORTESÍA` · `GRANT`»*. Una fila de suscripción es de tipo `SUSCRIPCIÓN`.
3. `cubierto` se calcula *«sólo sobre las fuentes de clase `TÍTULO`»*, así que si billing emite la
   fuente, **la persona queda cubierta**.
4. El `hasta` no tiene valor declarado para ese estado, y el único que le calza es
   `SIN_FECHA_CONOCIDA`, que §2.6 empareja con *«suscripción `ACTIVE`»*. Ningún aviso con ventana se
   dispara.
5. A las 72 h la fila muere en `ABANDONED` y el candado `A` queda libre. **Se repite el alta.** Son
   tandas de 72 horas de servicio completo, indefinidas, sin un cobro.

**El camino, rama (b) — los dos planes sumados.**

1. Un cliente `ACTIVE` en el plan Basic declara una sucesión al plan Pro.
2. Durante la ventana **conviven dos filas principales**, y `cobertura(user, vertical)` devuelve
   *«**todas** las fuentes vivas»*: dos fuentes de tipo `SUSCRIPCIÓN`, con **dos `referencia`
   distintas** — la versión de plan de Basic y la de Pro.
3. Verticales pliega el conjunto efectivo con las cuatro estrategias de `V/15` §2.2, que el propio
   contrato §2.7 declara **asociativas**: `SUMA`, `MÁXIMO`, `MÍNIMO`, `MEJOR_DECLARADO`.
4. Sobre todo limit agregado con `SUMA`, el cliente recibe **Basic + Pro** durante hasta 72 h, sin
   haber autorizado el segundo.
5. Si abandona el checkout, la sucesora muere y el reconciliador de excedentes le baja fichas que
   publicó de buena fe.

**Dónde lo permite el diseño.**

`12-contrato-de-cobertura.md` §2.6 enumera los cuatro valores de `hasta` y los cuatro casos que los
producen: `CANCEL_SCHEDULED`, fin de cortesía, vencimiento de addon `DÍAS_FIJOS`, fin del trial,
grant permanente, título `BASE`, suscripción `ACTIVE`, addon `MIENTRAS_VIVA_LA_SUSCRIPCIÓN`, y la
fuente de trial en `PRE_TRIAL`. **No aparecen `PENDING_AUTHORIZATION`, `GRACE_PERIOD`, `PAUSED` ni
`SUSPENDED`.** De los cuatro, tres tienen su respuesta en otro capítulo —el §20 da servicio completo
en grace, el §21 deja al suspendido *«sin entitlements comerciales»*, y `B/02` §2.4 distingue la
pausa por motivo— y **`PENDING_AUTHORIZATION` no la tiene en ninguno**.

§2.4, la regla que el propio contrato escribió para el caso gemelo:

> Con `cubierto` definido como *«al menos una fuente viva»*, ese suspendido quedaría cubierto por su
> propio addon — **dejó de pagar y sigue adentro**, y el fail-open lo habría **introducido el
> arreglo**

Es literalmente la misma forma de defecto, un estado más arriba del ciclo: **nunca pagó y ya está
adentro.**

§2.2, que es lo que produce la rama (b):

> **`fuentes`** | **todas** las fuentes vivas, de las tres clases, no la que manda

§2.7, que garantiza que sumar es correcto y por eso peligroso acá:

> Las cuatro estrategias de agregación de `V/15` §2.2 —`SUMA`, `MÁXIMO`, `MÍNIMO`,
> `MEJOR_DECLARADO`— son **asociativas**

Y §4, que impide arreglarlo del lado de verticales:

> **El estado exacto de la suscripción no cruza.** Verticales no distingue `ACTIVE` de
> `GRACE_PERIOD`

O sea que **sólo billing puede decidir qué estados emiten fuente**, y billing no lo dijo en ningún
lado.

**Severidad**: `CRITICA`. La rama (a) es servicio completo regalado y repetible; la rama (b) es la
suma de dos planes para quien pagó uno. Las dos son *«se entrega y no se cobra»*.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad cara es el arreglo.** La omisión de
`PENDING_AUTHORIZATION` es vieja; la rama (b) **no existía antes de la FASE 9**, porque dos filas
principales vivas eran imposibles. El contrato reescribió `hasta` de dos valores a cuatro (§2.6) en
la misma pasada que hizo normal la convivencia, y no agregó el renglón que la convivencia necesita.

---

### F-8bB1-007 — `S16` excluye a quien pagó una vez en su vida, pero el proveedor cancela por el primer cobro DE ESE preapproval: se le promete un grace de diez días que no puede terminar en pago

**Qué se rompe.** A un cliente que vuelve después de haber pagado alguna vez, y cuya tarjeta rebota,
se le da `GRACE_PERIOD` con servicio completo durante diez días sobre una autorización que el
proveedor **ya canceló de forma terminal**. El grace no puede terminar bien: no hay preapproval que
cobre. Son diez días de servicio garantizado sin ninguna posibilidad de cobrarlos, y el aviso le
pide que regularice algo que no tiene con qué.

**El camino.**

1. Una persona paga un mes de Alojamiento en 2025. Cancela. Queda un pago acreditado para ese
   `user + vertical`, **para siempre** (§4.5 punto 1).
2. Vuelve hoy con una tarjeta que no va a pagar. Alta, autorización, `ACTIVE`.
3. El **primer cobro de ese preapproval** se rechaza. `B/12` §4.4 mide, en producción, que el
   proveedor **cancela la suscripción en el mismo instante** en que manda la cuota a `recycling` —y
   que la cancelación es terminal.
4. `S16` **no dispara**, porque su condición es *«ningún pago acreditado antes para ese
   `user + vertical`»* y esta persona tiene uno de hace un año. Dispara `S4`: `GRACE_PERIOD`.
5. El §20 da servicio completo durante el grace: fichas publicadas, edición, entitlements.
6. **La salida buena no existe.** `S5` es *«entra el pago»*, y no hay autorización que lo ejecute:
   `PUT {status:"authorized"}` sobre esa suscripción devuelve
   `400 "Invalid transition from cancelled to authorized"`. El único desenlace posible es `S6` a los
   diez días.
7. Y el aviso miente por construcción: §4.5 punto 3 ordena que a quien nunca pagó se le diga *«el
   cobro no entró y cómo volver a intentarlo»* en vez de *«tenés diez días para regularizar»*. Esta
   persona cae del lado del *«tenés diez días»* por una condición que mira su historia, no su
   autorización.

**Dónde lo permite el diseño.**

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S16`:

> | S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **ningún pago acreditado
> antes** para ese `user + vertical` | el proveedor ya canceló el preapproval de forma **terminal**

**La condición y el efecto no hablan del mismo sujeto.** El efecto es un hecho del **preapproval**;
la condición es una propiedad del **historial del user**. El proveedor no conoce nuestro
`user + vertical`: cancela por el primer cobro de la autorización que él creó. Los dos clientes
—el que nunca pagó y el que pagó en 2025— le presentan al proveedor **exactamente el mismo hecho**,
y el diseño los manda a dos estados distintos, uno de los cuales promete un desenlace imposible.

`HOS-1354/docs/12-suscripcion.md` §4.5, punto 1:

> **«Ningún pago acreditado» se cuenta por `user + vertical`, no por suscripción.**

y §4.4, que dice la conclusión correcta y la aplica sólo a la mitad de los casos:

> **Entonces no hay suscripción que suspender**, y la regla de §4.3 se refuerza en vez de
> contradecirse: un primer cobro rechazado **no es una suscripción con un problema, es un alta que
> no ocurrió**.

Esa frase es verdadera para los dos clientes y el diseño la aplica a uno.

**Severidad**: `CRITICA`. Diez días de servicio completo, entregados y no cobrables, por cada
intento, a cualquiera que haya pagado una vez — y el camino se repite cancelando y volviendo.

**¿Es nuevo, o es el arreglo?** **El desajuste lo introdujo `S16`**, que es nuevo. La mitad de
*«diez días gratis repetibles»* es `F-8B1-010`, que sigue llegando (ver §Reejecución) y que
`05-R1-resuelto.md` §4.6 declara *«cerrado dos veces»* — cierre que sólo alcanza al cliente que
**nunca** pagó. Lo nuevo es que ahora el grace concedido es **estructuralmente irrecuperable**,
porque la medición de §4.4 dice que del otro lado ya no hay nada.

---

## ALTA

### F-8bB1-008 — §1.3 y `S16` leen la MISMA medición al revés, y si la cuota reciclada entra cae sobre una fila sin transición y fuera del barrido

**Qué se rompe.** El mismo hecho observado —una cuota en `recycling` sobre un primer cobro
rechazado— produce dos estados incompatibles según qué sección del capítulo 12 lea quien implemente.
Y si el proveedor termina acreditando esa cuota reciclada, el pago cae sobre una fila terminal para
la que no existe ninguna transición y que el barrido ya no mira.

**El camino.**

1. `B/12` §1.3 fija la regla general: *«el proveedor rechazó y **va a reintentar** | **`PENDING`** |
   sigue `ACTIVE`»*, y *«`FAILED` significa «el proveedor se dio por vencido», no «un intento salió
   mal»»*. La observación que la sostiene es exactamente la de §4.4: la cuota `7032034055` en
   `status: recycling`.
2. `S16` dispara sobre *«el **primer** cobro se rechaza»* — un rechazo, que §1.3 acaba de declarar
   que **no es un veredicto**.
3. Sobre el mismo sujeto medido, `recycling` (va a reintentar) y la cancelación terminal conviven en
   el mismo milisegundo. §1.3 lo lee como *«seguí esperando»* y §4.4 como *«se terminó»*.
4. Si el reintento de esa cuota **entra** —que es lo que `recycling` significa—, el pago llega sobre
   una fila `CHARGE_DECLINED`. `B/05` §3 condición 1 enumera de dónde puede venir un pago tardío
   —*«`GRACE_PERIOD` o `SUSPENDED`»*— y de dónde no —*«`CANCELLED`, `ABANDONED` o ya `ACTIVE`»*—:
   **`CHARGE_DECLINED` no está en ninguna de las dos listas.** Cae en *«falla cualquiera»* y se pone
   la marca.
5. Y la marca no lleva a ningún lado: `S15` dice *«si además corresponde un cambio de estado, se
   ejecuta **la transición de esta misma tabla que lo permita**»*, y desde `CHARGE_DECLINED`, que es
   terminal, **no hay ninguna**. La persona que lo resuelva sólo puede levantar la marca.
6. El barrido tampoco: `B/09` §3 suma `CHARGE_DECLINED` a los terminales que **no se barren**.

**Dónde lo permite el diseño.** `HOS-1354/docs/12-suscripcion.md` §1.3, la tabla de dos filas; §4.4,
la medición del 2026-09-17; `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S16` y `S15`;
`HOS-1354/docs/09-conciliacion.md` §3: *«Los estados terminales no se barren: `CANCELLED`,
`ABANDONED` y `CHARGE_DECLINED` **no pueden divergir hacia nada que nos importe**»*.

**Si la medición vuelve al revés**: nadie midió si la cuota en `recycling` de un preapproval
cancelado de forma terminal puede acreditarse. `GT-1` mide que **cancelar frena el cobro** de una
cuota **agendada**, que no es lo mismo que una cuota ya reciclada. Si puede, el paso 4 es plata del
cliente entrando sin contraparte, sin servicio y sin detector; si no puede, `§1.3` está describiendo
un reintento que para este caso no existe, y hay que decirlo donde se define `FAILED`.

**Severidad**: `ALTA`. La contradicción es textual y decide, sin que nadie la haya decidido, si un
cliente cuya tarjeta rebotó recibe diez días de servicio o ninguno.

**¿Es nuevo, o es el arreglo?** **Es el arreglo**: `S16` es nuevo (cambio 9 del §2 de
`05-R1-resuelto.md`) y se escribió sin cruzarlo con §1.3, que es la sección que define qué significa
un rechazo en este diseño.

---

### F-8bB1-009 — `G-R1-A` y `G-R1-B` son predicados sobre FILAS puestos en la capa de guards, y `G-R1-A` leído como dato falla sobre TODA sucesión sana

**Qué se rompe.** Los dos guards que la FASE 9 escribió como *«la contracara de las dos claves»* no
se pueden ejecutar donde el diseño los puso. Si alguien los implementa en el lugar declarado, no
verifican nada; si los implementa como control de datos, `G-R1-A` dispara sobre cada sucesión que
terminó bien. En las dos lecturas, la defensa de `D8` y de `D15` queda sin dueño.

**El camino.**

1. `HOS-1354/docs/20-testing.md` §1 define la capa: *«**guards** | propiedades del **código**, no de
   una ejecución | el árbol de fuentes, en CI»*.
2. Los dos están escritos como predicados sobre filas: *«**una fila** con `sucede_a` no nulo apunta
   a una predecesora fuera de…»* y *«**una fila** con `sucede_a` no nulo **no** nace con fecha de
   primer cobro estrictamente futura»*. Ninguna de las dos se puede evaluar sobre el árbol de
   fuentes.
3. Leído como control de datos, `G-R1-A` exige que la predecesora esté en
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`. Pero `D7` manda cancelar la predecesora al llegar el
   webhook de la sucesora, así que **toda sucesión que termina bien deja una fila apuntando a una
   `CANCELLED`**. El guard falla sobre el desenlace correcto, y sobre cada uno.
4. Y `G-R1-B` dice *«nace con»*: es una propiedad del instante de creación, que ninguna verificación
   posterior puede distinguir de una fecha que se cumplió y pasó. Sobre la fila de ayer, el
   predicado es indecidible.

**Dónde lo permite el diseño.** `HOS-1354/docs/20-testing.md` §2, la tabla de guards, y su párrafo
siguiente:

> `G-R1-B` es **`D8` hecho verificable en vez de recordable**, y por eso **depende de la columna**
> que guarda la fecha con la que nació la fila (cap. 02 §2.2): sin ella el guard no se puede
> escribir

La columna vuelve el dato **legible**; no vuelve el predicado **estático**. Y el §2.1 del mismo
capítulo fija el criterio que esto incumple: *«Todo guard de esta lista lleva un caso que lo hace
fallar a propósito»* y *«el texto con que falla no puede afirmar más de lo que el predicado
verifica»*.

`nucleo/04-invariantes.md` §3 apoya `D8` en *«**base**: […] y un guard la verifica»* y `D15` en
*«**base**: los dos índices parciales»*. Para `D15` la base alcanza; para `D8` el apoyo declarado es
el guard que no se puede escribir donde está.

**Severidad**: `ALTA`. Es el andamiaje entero de `F-8bB1-002` y `F-8bB1-003`: si los dos guards no
corren, las dos defensas nuevas de la sucesión son prosa.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** Los dos guards son del §2 de `05-R1-resuelto.md`
(§1.8) y entraron a `B/20` §2 en la misma pasada.

---

### F-8bB1-010 — El re-apunte del addon no declara en qué instante ocurre, y las dos lecturas cuestan plata en direcciones opuestas

**Qué se rompe.** *«En el mismo acto del upgrade»* no nombra un instante, porque un upgrade no es un
acto: es una ventana de hasta 72 h con dos filas vivas. Según cuál de los dos instantes se
implemente, el cliente pierde un addon que paga o conserva uno que ya no tiene con qué sostener.

**El camino.**

- **Si el re-apunte es al declarar la sucesión**: el addon pasa a colgar de una fila
  `PENDING_AUTHORIZATION` que puede morir a las 72 h. Al morir, `A5` —*«se da de baja, o queda
  huérfano»*— lo lleva a `CANCELLED` y `B/16` §4.3 cancela su preapproval *«de inmediato»*, todo
  esto mientras la predecesora sigue perfectamente `ACTIVE`. El cliente que abandonó un checkout
  pierde un addon recurrente que estaba pagando — que es textualmente el daño que el re-apunte se
  escribió para evitar.
- **Si el re-apunte es al autorizar**: hay que ejecutarlo en el mismo instante en que `D7` cancela
  la predecesora, y `B/16` §4.2 define huérfano como *«llegó a `CANCELLED` **y no tiene sucesora**»*
  — una condición que se evalúa contra el estado de otra fila durante la transición de esa fila. Si
  el orfanato se evalúa primero, `§4.3` cancela el preapproval del addon *«de inmediato»* y `PA-5`
  mide que eso es irreversible.

**Dónde lo permite el diseño.** `HOS-1354/docs/16-addons.md` §4.2:

> El addon **se re-apunta a la sucesora**, en el mismo acto del upgrade: no se cancela y no se
> rehace, deja de colgar de la fila vieja y pasa a colgar de la nueva.

y §4.3:

> | los complementos pueden quedar huérfanos | **se cancelan en el proveedor, de inmediato** — salvo
> los que se re-apuntan a una sucesora (§4.2), que no quedaron huérfanos |

*«De inmediato»* y *«no quedaron huérfanos»* se evalúan los dos contra un estado que está cambiando,
y ningún § dice cuál se lee primero.

**Severidad**: `ALTA`. Una de las dos ramas cancela irreversiblemente un preapproval que el cliente
paga, en el camino normal de abandonar un checkout.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** El re-apunte es el cambio 18 del §2 de
`05-R1-resuelto.md`, recomendado en su §6 ítem 4. La decisión es correcta; lo que falta es el
instante, y sin él la implementación elige.

---

### F-8bB1-011 — Desde que el cambio de ciclo también es una sucesión, «la sucesora hereda el contador» y «N cobros no sobrevive al cambio de ciclo» se contradicen

**Qué se rompe.** Un descuento de *«3 cobros»* pactado sobre un plan mensual puede quedar aplicado
sobre **tres cobros anuales**. Es plata nuestra, por treinta y tres meses más de los pactados, y
las dos reglas que deciden están en el mismo capítulo.

**El camino.**

1. `B/14` §2.2 dice, sin condición de dirección ni de ciclo: *«el contador de **N cobros** |
   **sigue donde estaba**»*, y el párrafo siguiente explica el mecanismo nuevo: *«en el upgrade,
   porque **la sucesora hereda**»*.
2. `B/14` §2.3 dice, para el cambio de ciclo: *«porcentual, **N cobros** | **no** [sobrevive] |
   «3 cobros» son tres meses o **tres años** según el ciclo»*.
3. **Los dos son ahora el mismo mecanismo.** `DEC-SUB-006` (ciclo) y `DEC-SUB-007` (upgrade)
   cancelan y recrean, y la FASE 9 los unificó bajo la sucesión. Antes, §2.2 hablaba de una fila que
   **sobrevivía** y §2.3 de una que **se destruía**: el mecanismo distinguía los dos casos y las dos
   reglas no podían chocar.
4. Quien implemente *«la sucesora hereda el contador y los addons»* como propiedad de la sucesión
   —que es como está escrito— hereda también en el cambio de ciclo.

**Dónde lo permite el diseño.** `HOS-1354/docs/14-promos-cortesias-y-grants.md` §2.2 y §2.3, tal
cual. Y `05-R1-resuelto.md` §2.1, que es donde se produce el choque:

> Con eso, `B/14` §2.2 —*«el contador de N cobros **sigue donde estaba**»*— **conserva su veredicto
> y cambia de mecanismo**: en el downgrade porque la fila sobrevive, y en el upgrade porque **la
> sucesora hereda** el contador.

Conservar el veredicto y cambiar el mecanismo es exactamente lo que mueve la frontera: el veredicto
de §2.3 dependía del mecanismo viejo.

**Severidad**: `ALTA`. El texto del §2.3 sigue ahí y un lector cuidadoso lo encuentra, así que el
daño exige una lectura razonable y equivocada, no una imposible. Pero es la lectura que el §2.2
invita.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** (cambio 17 del §2 de `05-R1-resuelto.md`). La
herencia se introdujo mirando el upgrade y no se cruzó con la tabla del ciclo, tres párrafos abajo.

---

### F-8bB1-012 — Un addon cuya suscripción muere en `CHARGE_DECLINED` no queda huérfano por la definición del §4.2, y su preapproval no se cancela ni se barre

**Qué se rompe.** Un débito mensual recurrente a alguien cuya suscripción nunca llegó a cobrarse ni
una vez. Es la forma de `F-8B1-006` recreada por el estado nuevo: el addon sigue vivo porque la
definición de huérfano nombra un estado que esta suscripción no alcanza.

**El camino.**

1. Alta, `S2`, `ACTIVE`. `PA-3` mide que en producción pasan **entre 26 y 44 minutos** entre
   autorizar y el primer cobro. Durante esa media hora la suscripción es `ACTIVE`, que es el único
   estado que `B/16` §2.2 acepta para contratar un addon.
2. El cliente contrata un addon recurrente. `DEC-ADDON-002`: preapproval propio, cobro propio.
3. Llega el rechazo del primer cobro. `S16`: `CHARGE_DECLINED`, terminal.
4. **El addon no queda huérfano.** `B/16` §4.2 define, para el scope `VERTICAL_SUBSCRIPTION`: *«la
   suscripción de esa vertical llegó a **`CANCELLED`** y no tiene sucesora»*. `CHARGE_DECLINED` no
   es `CANCELLED`, así que la condición nunca se cumple y `A5` no dispara.
5. **Su preapproval no se cancela**, porque `§4.3` sólo cancela *«los complementos [que] pueden
   quedar huérfanos»*.
6. **Y no lo levanta el barrido**: `B/09` §3 acaba de sumar `CHARGE_DECLINED` a los terminales que
   no se barren. El addon cobra todos los meses a alguien que no tiene ninguna suscripción.

**Dónde lo permite el diseño.** `HOS-1354/docs/16-addons.md` §4.2, la tabla de scopes;
`HOS-1354/docs/09-conciliacion.md` §3: *«Los estados terminales no se barren: `CANCELLED`,
`ABANDONED` y `CHARGE_DECLINED`»*; `HOS-1354/docs/03-maquinas-de-estado.md` §8, `A5`.

**Severidad**: `ALTA`. La ventana para contratar el addon es de media hora, así que el caso es raro;
la omisión, en cambio, es categórica: **ningún** addon bajo una suscripción `CHARGE_DECLINED`
orfana, por definición, y el estado es nuevo y terminal.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** `CHARGE_DECLINED` es un valor nuevo del dominio
cerrado de estados y entró en dos listas (`B/02` §2.2 los no-vivos, `B/09` §3 los terminales) y no
en la tercera, que es la que decide si un cobro recurrente se apaga.

---

## MEDIA

### F-8bB1-013 — La «ventana reducida» del §5.4 choca con las 72 h de `S3`, que son configuración global y las que lee la limpieza

**Qué se rompe.** La mitigación que el capítulo 12 propone para el crédito corto necesita una
ventana de autorización **por sucesión**, y la ventana del diseño es **una sola, global**. Si se
implementa como un número distinto, el job de limpieza —que es lo único que cancela el preapproval
al vencer— sigue leyendo 72 h y deja viva una autorización que puede cobrar durante días.

**El camino.** `B/12` §5.4 cierra con *«el cambio de plan se ofrece con **ventana reducida** […]
Cuántos días es «pocos» queda por definir: **es un número, no un mecanismo**»*. Pero `B/03` §3.4
punto 1 declara la ventana *«configuración, no constante (§9), y vive en **las opciones globales de
billing**»*, y el punto 2 define la limpieza como *«un job [que] recorre **las vencidas**»* contra
esa duración. Una ventana por fila es un mecanismo, no un número: exige una columna, y exige que la
limpieza la lea. Sin eso, una sucesora con ventana de 24 h queda `PENDING_AUTHORIZATION` con su
preapproval vivo durante 48 h más de lo previsto, ocupando el candado `B` y autorizable — y si
autoriza, cobra con la fecha de primer cobro ya vencida, que es `F-8bB1-003`.

**Dónde lo permite el diseño.** `HOS-1354/docs/12-suscripcion.md` §5.4;
`HOS-1354/docs/03-maquinas-de-estado.md` §3.4, puntos 1 y 2.

**Severidad**: `MEDIA`. No cobra de más por sí solo: alarga la ventana de `F-8bB1-003`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — §5.4 es texto nuevo de la FASE 9.

---

### F-8bB1-014 — El candado de `C5` sigue escrito como si existiera, y la remediación que `R1` se pidió a sí misma no se aplicó

**Qué se rompe.** `05-R1-resuelto.md` §5 demostró que la restricción que el capítulo 05 declara
como la red contra el único doble cobro con dinero real **no se puede construir hoy**, y fijó tres
cosas que sí se podían hacer. **La primera no se hizo**, así que el capítulo sigue prometiendo una
red que no existe y el lugar donde la ausencia se vería sigue callado.

**El camino.** `B/05` §2, `C5`, sigue diciendo textualmente: *«es el único que se lleva a la base:
**`UNIQUE(subscription_id, período) WHERE el pago está acreditado`**»* y *«La restricción es la red;
la relectura es para que el admin entienda lo que pasó en vez de ver un error»*. `B/02` §2.3 sigue
sin columna de período en `payment`, y `manual_payment` sigue en otra tabla y sin monto. Y `B/02` §5
—*«Las restricciones que sostienen los invariantes»*— sigue listando cuatro filas sin decir que
ésta falta.

`05-R1-resuelto.md` §5, remediación 1:

> **Queda dicho que el candado no existe hoy**, en vez de figurar en un capítulo como si existiera.
> `B/02` §5 […] **no lo incluye**, y esa omisión es hoy la única señal de que falta. **Debe volverse
> explícita.**

**Dónde lo permite el diseño.** `HOS-1354/docs/05-idempotencia-y-concurrencia.md` §2, `C5`;
`HOS-1354/docs/02-modelo-de-datos.md` §2.3 y §5.

**Severidad**: `MEDIA`. El doble cobro de fondo es `F-8B3-002`, que la FASE 9 declaró incerrable con
su causa —y eso el §4 de las instrucciones permite dejar abierto—. Lo que se reporta acá es que la
única acción que `R1` sí podía ejecutar sobre él quedó sin ejecutar, y mientras tanto el capítulo 05
lee como si la red estuviera puesta.

**¿Es nuevo, o es el arreglo?** Ninguno de los dos: es **una remediación declarada de la FASE 9 que
no se aplicó**.

---

## Reejecución de los 18 hallazgos de la FASE 8 sobre el texto nuevo

**Cortan 2. Siguen llegando 16.** Ninguno de los 16 lo empeoró la FASE 9 salvo donde se indica.

| id | título abreviado | ¿corta? | dónde |
|---|---|---|---|
| `F-8B1-001` | el `UNIQUE` hace inejecutable todo upgrade y todo cambio de ciclo | **CORTA** | **paso 4**: la fila nace con `sucede_a` no nulo, el candado `A` no la ve y el `B` está vacío. El paso 5 cae con la condición nueva de `S1` (*«no hay otro **origen** vivo»*) |
| `F-8B1-002` | `RECONCILIATION_REQUIRED` deja el preapproval vivo y habilita una segunda | **CORTA** | **paso 2**: no hay tal estado; la fila conserva el suyo y ocupa el candado `A`. El paso 5 cae con la condición 3 reescrita de `B/05` §3. **Con una reserva**: si la fila marcada es una **sucesora**, el candado `A` está vacío y el camino vuelve a llegar — es `F-8bB1-001` |
| `F-8B1-003` | la recuperación tras un timeout usa un filtro que devuelve un subconjunto | llega entero | `B/05` §1.2 no se tocó; `RC-1` sigue midiendo el subconjunto en producción |
| `F-8B1-004` | la fecha de primer cobro es un `free_trial` que el proveedor otorga sin mecanismo conocido | llega entero | **paso 6 intacto**: *«nada en el diseño aborta»*. La columna y `G-R1-B` verifican lo que mandamos, y `B/02` §2.2 prohíbe releer. Es `F-8bB1-002` |
| `F-8B1-005` | una cortesía sobre un ciclo no mensual regala el ciclo entero | llega entero | `S9` sigue con la condición *«no hay pausa vigente»* y sigue sin pasar por `puedePausar()` |
| `F-8B1-006` | el preapproval huérfano sigue cobrando y el barrido no lo mira | llega entero, **peor** | `B/16` §4.3 y `B/09` §3 siguen contradiciéndose, y la FASE 9 **agregó un tercer terminal** (`CHARGE_DECLINED`) a la lista de los que no se barren |
| `F-8B1-007` | un descuento entre cero y el piso se ejecuta como pausa | llega entero | `B/14` §1.3 punto 2 sin cambios |
| `F-8B1-008` | el reembolso no tiene clave persistida antes de la llamada | llega entero | la fila `refund` de `B/02` §2.3 sin cambios: sin clave, sin unicidad, sin orden de persistencia |
| `F-8B1-009` | la limpieza de las 72 h cancela sin releer | llega entero, **peor** | `S3` y §3.4 punto 2 sin cambios. Ahora puede destruir una **sucesora** recién autorizada cuya fecha de primer cobro ya venció y cuyo cobro ya salió |
| `F-8B1-010` | «ningún pago acreditado» es un booleano de por vida | llega entero | §4.5 punto 1 sin cambios. `05-R1-resuelto.md` §4.6 lo declara *«cerrado dos veces»*, y los dos cierres sólo alcanzan a quien **nunca** pagó. Ver `F-8bB1-007` |
| `F-8B1-011` | la revocación y el cruce `C2` se contradicen | llega entero | `C2` sin cambios |
| `F-8B1-012` | el `2084` prescribe un reintento automático sobre un contrato incompleto | llega entero | cap. 03 §6 sin cambios |
| `F-8B1-013` | los tres avisos de un reembolso llevan el id del PAGO | llega entero | `C6` y la fila `refund` sin cambios |
| `F-8B1-014` | la reconciliación que `DEC-SUB-006` pidió no está en el capítulo 09 | llega entero, **peor** | las cinco comparaciones del §3 y los tres procesos del §7 sin cambios. Ahora el par origen+sucesora es **operación normal**, así que el detector que falta cubre un estado deliberado en vez de un error |
| `F-8B1-015` | un descuento de «N cobros» no declara qué consume un cobro | llega entero | `B/14` §2.2 ganó *«la sucesora hereda»* y sigue sin definir el evento de consumo. Ver `F-8bB1-011` |
| `F-8B1-016` | una cortesía consume (o no) la cuota de pausas | llega entero | `subscription_pause` y `DEC-SUB-004` sin cambios |
| `F-8B1-017` | el tope acumulado de reembolsos no es una restricción de base | llega entero | `B/02` §5 se editó (fila 8) y no incorporó ésta |
| `F-8B1-018` | el comprobante es correlativo «sin huecos» y no tiene contradocumento | llega entero | `receipt` sin cambios |

---

## Verificación del recorrido de `15-fase-9/05-R1-resuelto.md` §4

Se recorrieron los 90 pares de la grilla más los 10 de la adenda. **Los 100 veredictos son
correctos sobre el eje que la grilla declara**, y en tres pares el veredicto se apoya en un
argumento que conviene anotar:

| par | veredicto | nota |
|---|---|---|
| `GRACE_PERIOD` × `C2`/`C3` | `SUCEDE` | correcto, y el §4.4 lo dice: *«lo que no cierra es el dinero»*. Lo que no queda dicho es que el dinero **empeora** con el cobro reciclado — `F-8bB1-004` |
| `GRACE_PERIOD` × `C9` | `RECHAZA` (cierra) | el veredicto de la base es correcto y **la consecuencia no está declarada**: la marca congela `C2`/`C3`, que es la única salida que `DEC-SUB-003` le ofrece a esa persona, mientras el reloj del grace corre. Debería estar entre los abiertos, no entre los cerrados |
| `ACTIVE` × `C9` | `RECHAZA` — *«es `F-8B1-002` cerrado»* | correcto para una fila de origen; para una sucesora marcada, el candado `A` está vacío y `F-8B1-002` vuelve — `F-8bB1-001` |

**Lo que el recorrido no cubre, y es su defecto de forma**: la grilla es
`9 estados × 10 caminos × {clase = principal}`. La resolución agregó `sucede_a` como eje de la
**base**, así que el dominio pasó a ser `9 × 10 × 2 = 180`. Los 90 recorridos son la mitad
`sucede_a IS NULL`; los **otros 90**, con la fila existente siendo una **sucesora**, no se miraron.
`F-8bB1-001` sale de **treinta** de ellos: los seis estados vivos que una sucesora puede alcanzar,
cruzados con los cinco caminos que piden una fila de **origen** (`C1`, `C4`, `C5`, `C6`, `C7`). En
los treinta, la base **acepta** exactamente lo que en la mitad de origen rechaza.

---

## Ataques que intenté y el diseño resistió

- **Encadenar sucesiones.** Intenté que una sucesora fuera sucedida para llegar a tres, cuatro y
  diez filas vivas. El candado `B`, indexado sobre `(user_id, vertical)` y no sobre `sucede_a`, lo
  rechaza sin ninguna regla extra. **Resiste**, y el argumento de `B/02` §2.2 es correcto tal como
  está escrito.
- **Dos sucesoras desde dos orígenes.** Imposible por construcción: el candado `A` sólo admite un
  origen vivo.
- **Reutilizar la ventana de `PENDING_AUTHORIZATION` con un segundo `INSERT`.** El candado `A`
  incluye ese estado, así que el *«no se crea otra, se reusa la vigente»* del §3.4 punto 4 **dejó de
  depender de que el camino se acuerde**. Es una mejora real sobre la FASE 8.
- **`RECONCILIATION_REQUIRED` liberando el candado.** Cerrado de verdad: la fila conserva su estado
  y lo ocupa. Es la única dirección en que el rediseño aprieta, y el argumento —*«la comodidad que
  la exclusión compraba deja de hacer falta»*— es correcto.
- **Declarar una sucesión desde `SUSPENDED` o desde `PAUSED`.** `G-R1-A` lo impide, y la mitad de
  `PAUSED` está apoyada en una medición (`EX-11`, re-verificada en producción sobre monto,
  frecuencia, `end_date` y volver a pausar). El bloqueo es correcto — lo que falla es dónde vive el
  guard (`F-8bB1-009`).
- **Usar `CHARGE_DECLINED` para escapar del bloqueo de `SUSPENDED`.** No se puede abusar: el estado
  es terminal y su preapproval está cancelado de forma terminal y **medido** (`B/12` §4.4). Que el
  alta nueva entre es lo correcto.
- **Cobrar dos veces el mismo hecho por webhook duplicado.** `UNIQUE(proveedor, id_del_hecho)` más
  la relectura por id del cap. 03 §10.1. Sigue resistiendo — salvo el reembolso, que no trae id
  propio (`F-8B1-013`).
- **Webhooks al revés sobre una sucesión.** La sucesora es un recurso nuevo con su propio contador
  `version`, así que no hereda un `version` que la haga descartar su primer evento. **Resiste.**
- **Pago manual mientras el cliente paga por el proveedor, dentro de una misma suscripción.** La
  relectura previa a `AWAITING → REGISTERED` y `D11` siguen siendo la mitigación honesta; lo que no
  hay es el candado, y eso está declarado (`F-8B3-002`, `F-8bB1-014`).
- **Aplicar dos veces el mismo descuento sobre un cobro.** Sigue sin haber camino: el monto es un
  estado del preapproval, no una operación que se repita. Y el orden de composición sigue dando
  ARS 700 y nunca 720.
- **Arrepentirse de un `CANCEL_SCHEDULED` para conseguir un doble cobro.** No se puede: `S11` ya
  canceló el preapproval *«de inmediato»* y `PA-5` mide que es irreversible, así que la única
  autorización viva es la de la sucesora. El bloque de diez pares del §4.7 está bien resuelto.
- **Que el grant permanente quede sin resolver al retirarse su plan.** `UNIQUE(plan_id) WHERE
  vigente` más *«la vigente, vendible o no»* más el trinquete lo cierran, y el argumento de por qué
  **no** se lee como la pricing está bien escrito.

---

## `NUCLEO` — lo que encontré en `docs/nucleo/` y no resuelvo acá

1. **`D8` está declarado en el nivel `base` y no lo ocupa.** `nucleo/04-invariantes.md` §3 lo apoya
   en *«**base**: la fecha con la que nació la fila se guarda en `subscription`, y un guard la
   verifica»*, mientras el §1 del mismo capítulo define `base` como *«una restricción de la base lo
   impide»* y ordena guard **debajo** de servicio. Una columna no impide nada. Es la mitad de
   `F-8bB1-002`.
2. **El conteo de invariantes volvió a no cerrar, y lo rompió la misma corrección.** El §5 dice
   *«base | 6 | 2»*, *«total | 37 | 14»* y cierra con *«**Cincuenta y un** invariantes, y **ocho**
   los sostiene la base»*. La tabla del §3 tiene ahora **15 filas** (`D1`…`D15`) y **cuatro** de
   ellas declaran `base` (`D2`, `D3`, `D8`, `D15`). La aritmética del propio documento da
   `37 + 15 = 52` y `6 + 4 = 10`. La nota al pie del §5 —*«Corregido el 2026-09-19 — FASE 8»*—
   corrigió 49 → 51 por `D13` y `D14`, y la FASE 9 agregó `D15` y subió `D8` sin volver a tocarla.
   `BAJA`, y es el documento cuya utilidad depende de poder preguntar *«¿están todos?»*.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta pasada** movió:

1. **Qué hace el proveedor con una `start_date` que ya pasó al momento de autorizar.** Es
   `F-8bB1-003` y no tiene fila en la matriz. Es la única medición nueva que este informe pide, es
   una sonda de sandbox sin costo, y decide si la precondición de seguridad del mecanismo más caro
   del sistema vale durante su ventana o sólo en su primer día.
2. **Si la cuota en `recycling` de un preapproval cancelado de forma terminal puede acreditarse.**
   Es `F-8bB1-008`. `GT-1` mide una cuota **agendada**, no una reciclada.
3. **Qué se hace con un cobro que llega contra una fila `CHARGE_DECLINED`.** No hay transición, no
   hay barrido y `B/05` §3 no lo enumera en ninguna de sus dos listas.
4. **Qué es el «período» de un pago manual**, que es lo que le falta al candado de `C5`
   (`F-8B3-002`, `F-8bB1-014`), y sigue sin capítulo.
5. **La mecánica del reembolso entera** —`F-8B1-008`, `F-8B1-012`, `F-8B1-013`, y `RF-3` en
   `UNKNOWN`—, que es de dónde tiene que salir la salida de `F-8bB1-004`.

---

## Fuera de mi vector

- **`F-8bB1-006` rama (b) toca a verticales**, porque quien pliega las dos fuentes es `V/15` §2. La
  causa es de billing —emitir dos fuentes `SUSCRIPCIÓN` sin decir cuál cubre— y la consecuencia se
  ejecuta del otro lado de la frontera. Le corresponde a `C1`.
- **Los dos huecos que `05-R1-resuelto.md` §6 ítem 10 dejó abiertos** —cambiar de plan antes de
  autorizar, y durante una pausa— son de superficie y no mueven plata. `B/03` §3.3.1 los cerró
  diciendo el no en voz alta para los dos, así que el residuo declarado en `§4.1`/`§4.5` del
  recorrido ya no es *«ningún capítulo lo nombra»*: ahora lo nombra. Vale recontar ese par de
  abiertos.
- **`G-R1-A` como control de acceso a la operación de sucesión** —quién puede declararla, sobre qué
  fila— es de `A1`.
