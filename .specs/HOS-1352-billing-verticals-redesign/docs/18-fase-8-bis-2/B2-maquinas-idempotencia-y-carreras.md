---
title: "FASE 8-bis-2 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · B2 — máquinas, idempotencia y carreras

Tercera pasada de este vector sobre `HOS-1354`, ahora sobre el diseño que la 9-bis produjo. La
pasada anterior tenía una respuesta corta —*«la sucesión resolvió el `INSERT` y no resolvió el
resto de la vida de la fila»*—. Ésta también, y es la contraria:

> **La 9-bis le dio a la sucesión su transición de cierre (`S17`), y `S17` termina la vida de la
> fila BORRANDO LA EVIDENCIA de que hubo una sucesión.** `sucede_a` no es sólo la mitad izquierda
> del candado `B`: es **el único puntero del corpus** que dice que una fila fue sucedida por otra,
> y **tres reglas escritas en otros capítulos lo leen** —la de huérfanos de `B/16` §4.2 (*«y no
> tiene sucesora»*), la herencia del contador de promos de `B/14` §2.2, y la condición 3 del pago
> tardío de `B/05` §3—. Limpiarlo *«en el mismo acto»* en que la predecesora llega a `CANCELLED`
> vuelve **inalcanzable** la primera de las tres, que es la que protege bienes pagados.

Y hay una segunda respuesta, que atraviesa cuatro hallazgos: **la 9-bis enumeró dominios y los
enumeró cortos.** El cambio 18 promete *«los ocho pares … enumerados con su veredicto»* sobre un
dominio que **son treinta y seis** (§F-8cB2-005, contado acá); el cambio 8 (`T6`) lee *«una
suscripción viva»* sobre el conjunto de seis estados del candado cuando su propia justificación
sólo vale para uno; el cambio 20 leyó `S16` *«por autorización»* y no recorrió la autorización de
una **sucesora**; y el cambio 15 escribió *«la predecesora sigue su camino a `CANCELLED` por
`S17`»* sobre una ventana de 72 h que tiene **dos** desenlaces.

**Catorce hallazgos. Cuatro `CRITICA`, seis `ALTA`, cuatro `MEDIA`.**

Tres advertencias de lectura:

1. **Los conteos de este informe los conté yo**, recorriendo las tablas citadas. Donde uso un
   número ajeno va su fila de la matriz con su fecha.
2. **El núcleo no es mío.** Donde el choque es **entre** el núcleo y un capítulo de billing lo
   reporto acá porque la mitad corregible es la de billing, y lo digo.
3. **`T6` vive en `V/03`** y su mitad de verticales es de `A2`. Lo reporto porque su condición
   —*«ya hay una suscripción viva»*— se resuelve **contra el conjunto de estados de billing**, y
   porque las instrucciones de esta fase lo nombran como eje de mi vector.

---

## CRITICAS

### F-8cB2-001 — `T6` consume el trial de por vida contra un checkout que todavía no autorizó nadie: quien lo abandona queda sin suscripción y sin trial, para siempre

**Qué se rompe.** Una persona en `PRE_TRIAL` abre un checkout, publica su ficha, y **pierde su
único trial de esa vertical de forma irreversible** — aunque nunca autorice y aunque el checkout
muera a las 72 h. La fila de `trial` se escribe **consumida**, es única de por vida y **no se borra
nunca**, ni en el hard delete del día 180. Termina sin suscripción, sin trial y con la ficha
despublicada.

**El camino.**

1. La persona está en `PRE_TRIAL`, que `V/03` §2 llama *«el estado más poblado del sistema»*.
2. Elige un plan. `S1`: *«no hay otro **origen** vivo para ese `user + vertical` … se acuña y
   persiste la clave de idempotencia antes de llamar al proveedor»* (`B/03` §3.2). La fila nace en
   `PENDING_AUTHORIZATION`.
3. **`PENDING_AUTHORIZATION` está entre los vivos.** `B/02` §2.2: *«Los «vivos» siguen siendo los
   mismos seis: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y
   `CANCEL_SCHEDULED`»*, y el mismo § explica por qué no se lo puede sacar: *«sin él **nada impide
   una tercera, una cuarta y una décima creación simultánea**»*.
4. Publica. Dispara **el evento de activación declarado por la vertical**, que es el evento de
   `T6`. Su condición es **`«ya hay una suscripción viva» para ese`user + vertical`»** (`V/03`
   §2, tabla de transiciones, `T6`). Se cumple: la del paso 2 lo está.
5. `T6` ejecuta su efecto: *«**crea la fila de `trial`, consumida**, sin reloj y sin campaña»*, con
   destino `TRIAL_CONVERTED`.
6. La persona abandona el checkout. A las 72 h, `S3`: *«pasaron **72 h** sin autorizar … se cancela
   el preapproval en el proveedor»* → `ABANDONED`.
7. **No hay vuelta.** `NUCLEO/04` §2.1 invariante 1: *«trial máximo una vez por `user + vertical` |
   `UNIQUE(user_id, vertical)` en `trial`, **sin condición de estado**»*; invariante 2: *«borrar
   ficha no devuelve trial | la fila de `trial` **no se borra nunca**, ni siquiera en el hard
   delete del día 180»*. El estado `TRIAL_CONVERTED` no tiene salida en la tabla de `V/03` §2.
8. Y queda sin cobertura: `TRIAL_CONVERTED` **no** es fuente viva (`V/03` §2, tabla de estados) y
   `ABANDONED` **no emite** (`12-contrato…` §2.6). Con `cubierto` pasando a falso, `PB2` despublica.

**Dónde lo permite el diseño.**

- `HOS-1353/docs/03-maquinas-de-estado.md` §2, `T6`: condición *«ya hay una suscripción viva para
  ese `user + vertical`»*.
- `HOS-1354/docs/02-modelo-de-datos.md` §2.2: la lista de los seis vivos, con
  `PENDING_AUTHORIZATION` adentro y la razón por la que no sale.
- `nucleo/04-invariantes.md` §2.1, invariantes 1 y 2.
- `HOS-1353/docs/03-maquinas-de-estado.md` §2, nota de `T6`: *«consumirlo **es lo correcto, no un
  castigo** … **no necesita probar lo que ya está pagando**»*.

**La premisa de OTRO arreglo que esto vuelve falsa, y es literal.** La justificación de `T6` es
*«no necesita probar lo que ya está pagando»*. El cambio 16 —`12-contrato-de-cobertura.md` §2.6—
decidió **lo contrario sobre el mismo estado**, y lo decidió midiendo el costo: *«**Una suscripción
esperando autorización NO emite fuente de cobertura** … Emitirla significa **hasta 72 horas de
servicio completo gratis, y repetibles** —se abandona el checkout y se empieza de nuevo—»*. O sea:
el contrato declara que una `PENDING_AUTHORIZATION` **no vale nada** porque puede abandonarse, y
`T6` le cobra por ella el activo más caro que una persona tiene una sola vez en la vida. Los dos
arreglos son de la misma tanda.

**La forma barata de verlo**: la condición de `T6` debería leer el mismo conjunto que el contrato
usa para `cubierto` —los estados que **emiten título**—, no el conjunto del candado, que existe
para otra cosa (impedir un segundo `INSERT`).

**Severidad.** `CRITICA` — un dato se pierde sin vuelta, por diseño y por escrito, sobre el estado
más poblado del sistema y sobre un camino (abandonar un checkout) que `B/03` §3.3.1 declara normal:
*«abandonarlo lo deja en `ABANDONED`, desde donde sí puede elegir otro»*.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 8** (`T6`, `V/03` §2). Antes de la 9-bis
no existía la transición y el caso quedaba *«colgado»* —`TRIAL_ACTIVE` sin salida alcanzable—, que
es un defecto distinto y **reversible**. El arreglo lo cerró escribiendo una fila **irreversible** y
recorrió el dominio de *«quien ya paga»* sin recorrer el de *«quien todavía no»*, que es la mitad
del conjunto que su propia condición abarca.

---

### F-8cB2-002 — `S17` limpia `sucede_a` en el mismo acto en que la predecesora llega a `CANCELLED`, así que *«y no tiene sucesora»* no se puede cumplir nunca: todo upgrade deja huérfanos los addons recurrentes y los cancela en el proveedor

**Qué se rompe.** El cliente que sube de plan **pierde los addons recurrentes que ya pagó**, y los
pierde de la forma que `B/16` §4.3 llama *«la que no puede fallar»*: **cancelados en el proveedor,
de inmediato**, y cancelar es irreversible (`PA-5`). Es exactamente el daño que el cambio 18 de la
9-bis vino a cerrar, reabierto por el cambio 11·12 de la misma tanda.

**El camino.**

1. Un cliente `ACTIVE` tiene dos addons recurrentes de scope `VERTICAL_SUBSCRIPTION`. Pide un
   upgrade. Nace la sucesora con `sucede_a` apuntando a la predecesora (`B/02` §2.2, candado `B`).
2. El cliente autoriza. `S2` lleva la sucesora a `ACTIVE`.
3. Corre `S17`, y su efecto tiene **dos mitades en un solo acto**: *«**se cancela en el proveedor**
   (es `D7`), y en el mismo acto **la sucesora limpia su `sucede_a`**»* (`B/03` §3.2, `S17`). La
   predecesora queda en `CANCELLED`.
4. Toca decidir qué pasa con los addons. `B/16` §4.2: *«`VERTICAL_SUBSCRIPTION` | queda huérfano
   cuando **la suscripción de esa vertical llegó a `CANCELLED` y no tiene sucesora**»*.
5. **La segunda mitad de esa condición ya no se puede cumplir.** *«Tiene sucesora»* sólo se puede
   evaluar de una forma: buscando una fila con `sucede_a` apuntando a ésta. `S17` la borró en el
   mismo acto en que escribió `CANCELLED`. **No existe ningún estado del mundo en el que una
   predecesora esté en `CANCELLED` y tenga una sucesora apuntándola**, porque la única transición
   que produce lo primero produce lo segundo.
6. Entonces la evaluación da *«huérfano»*, y `B/16` §4.3 dice qué se hace: *«los complementos …
   **se cancelan en el proveedor, de inmediato** — salvo los que se re-apuntan a una sucesora
   (§4.2), que no quedaron huérfanos»*. La salvedad nombra un estado inalcanzable.
7. `PA-5` **`VERIFIED`**: cancelar es **irreversible**. El cliente pagó el upgrade y perdió los
   addons en el mismo minuto.

**Lo único que lo evita es un orden que ningún capítulo declara.** Si el re-apuntado del §4.2
—*«se re-apunta a la sucesora, **en el mismo acto del upgrade**»*— ya corrió antes del paso 4, la
predecesora no tiene addons y no hay daño. Si corre después, o dentro del mismo acto pero más
tarde, el daño ocurre. **Es el mismo *«mismo acto»* sin instante que reporté en `F-8bB2-009` y que
la 9-bis no tocó** — pero ahora ya no es una ambigüedad entre dos lecturas defendibles: es lo único
que separa el camino normal del daño, porque **la cláusula escrita para que el orden no importara
dejó de poder ser verdadera**.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S17`, columna efectos (las dos mitades en un
  acto) y el párrafo *«El dominio que esto crea, recorrido»*, que enumera los dos valores de
  `sucede_a` **sobre la sucesora** y no menciona qué queda del lado de la predecesora.
- `HOS-1354/docs/16-addons.md` §4.2 (la condición *«y no tiene sucesora»* y el párrafo *«Una
  sucesión tampoco deja huérfano a nada, y es la mitad que faltaba»*) y §4.3.
- `06-mp-validation-matrix.md`, `PA-5` **`VERIFIED`**: *«Irreversible: reintentar da `400`»*.

**Severidad.** `CRITICA` — un dato se pierde sin vuelta (una autorización de cobro cancelada no se
revive) y el cliente pierde capacidades que pagó, en el camino declarado normal del mecanismo más
caro del sistema. `B/16` §4.3 lo califica solo: *«Falla hacia cobrar de más, y por eso es el que no
puede fallar»*.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y es el cruce de dos de la misma tanda.** El
cambio 11·12 (`S17` limpia `sucede_a`) vuelve falsa la premisa del arreglo de `B/16` §4.2 —que
existe una forma de saber que una `CANCELLED` fue sucedida—. Mi `F-8bB2-002` pedía exactamente que
`sucede_a` se limpiara; **la limpieza era correcta y su instante no se recorrió**: lo que hacía
falta era limpiarlo *después* de que todo lo que lee ese puntero haya corrido, y el texto elige el
*«mismo acto»*.

---

### F-8cB2-003 — El reembolso del cambio 15 se decide suponiendo que la sucesión siempre termina: si el cliente abandona el checkout, le devolvimos el pago que lo salvaba y después lo suspendemos por no pagar

**Qué se rompe.** Un cliente en `GRACE_PERIOD` que intenta cambiar de plan —que es **el camino de
recuperación** que `DEC-SUB-003` diseñó— y después abandona el checkout, termina así: el cobro
atrasado **entró**, nosotros **se lo reembolsamos**, y a los pocos días lo **suspendemos por falta
de pago**. Hospeda no cobra el período que sirvió entero, y el cliente pierde el servicio habiendo
pagado.

**El camino.**

1. Cliente en `GRACE_PERIOD`. Su cuota sigue en `recycling` y **puede entrar** (`B/12` §1.3 y
   §5.3, medido en producción el 2026-09-17).
2. Pide un cambio de plan, que `DEC-SUB-003` permite ahí a propósito. Nace la sucesora en
   `PENDING_AUTHORIZATION`.
3. El cobro reciclado entra dentro de la ventana. `B/12` §5.3: *«**`S5` no se aplica sobre una fila
   que ya declaró sucesión.** El pago entra, se registra, y **se reembolsa**; la predecesora sigue
   su camino a `CANCELLED` por `S17`»*.
4. **Ese *«sigue su camino»* es una suposición sobre el futuro, y tiene dos desenlaces.** El otro
   está declarado en la tabla del mismo corpus: `S3`, *«pasaron 72 h sin autorizar»* →
   `ABANDONED`. Y `B/03` §3.3.1 lo trata como una salida normal y ofrecida: *«abandonarlo lo deja
   en `ABANDONED`, desde donde sí puede elegir otro»*.
5. El cliente abandona. La sucesora muere. **La predecesora nunca llega a `CANCELLED`**: sigue en
   `GRACE_PERIOD`, ahora sin sucesora y con su único pago **reembolsado**.
6. El reloj del grace sigue corriendo (`B/03` §4: *«se agota el reloj → `SUSPENDED`»*). `S6`.
   `SUSPENDED` es §21: sin listado público, sin edición, sin creación, sin entitlements
   comerciales.
7. La salida `S7` pide *«el cobro entró de verdad»*. El único cobro que entró se lo devolvimos
   nosotros, y del lado del proveedor la cuota figura **pagada**, así que su reciclado se apagó: no
   va a volver a intentarlo.
8. El aviso previo, que `B/12` §5.3 declara *«lo que hace aceptable la decisión»*, tampoco cubre
   este desenlace. `B/19` §4, fila 15, dice qué se le promete: *«que **el cobro de la cuota impaga
   puede entrar igual**, antes de confirmar»*. Nada dice que se le va a devolver ni que, si
   abandona, ese reembolso lo deja en camino a la suspensión.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/12-suscripcion.md` §5.3, bloque *«Y si entra, NO reactiva a la predecesora»*.
- `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S3` y `S6`; §3.3.1 (abandonar es una salida
  ofrecida); §4 (el reloj del grace).
- `HOS-1354/docs/19-superficies.md` §4, fila 15 (el alcance exacto del aviso previo).
- `HOS-1354/docs/06-proveedor.md` §10 / `B/12` §5.3: el reembolso es *«la única capacidad que el
  cap. 06 §10 declara en riesgo de plataforma»* (`RF-6/7/8`), así que ni siquiera es una operación
  de la que se pueda depender.

**Severidad.** `CRITICA` — alguien paga de menos: Hospeda sirve un período completo (el §20 da
servicio entero durante el grace), cobra, devuelve, y además pierde al cliente. Y el cliente pierde
el servicio después de haber pagado, que es el desenlace que `DEC-SUB-003` existe para evitar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 15.** El texto es de la 9-bis entero, y
su razonamiento —*«el crédito de la sucesora ya se computó en cero suponiendo que ese período no se
iba a pagar nunca»*— **sólo vale si la sucesora nace**. La regla se escribió recorriendo el dominio
de una sucesión que se consuma, que es una de las dos ramas de una ventana de 72 h que el mismo
capítulo dimensiona.

---

### F-8cB2-004 — Un addon cuyo título cae en `CHARGE_DECLINED` no queda huérfano nunca —§4.2 nombra sólo `CANCELLED`—, así que cobra todos los meses con su capacidad apagada y con los dos detectores cerrados

**Qué se rompe.** El cliente que sube de plan y cuyo **primer cobro del plan nuevo** se rechaza
queda sin suscripción (ver `F-8cB2-008`) y **con sus addons recurrentes cobrando todos los meses**,
mientras el contrato apaga las capacidades que esos addons otorgan. Paga por algo que ya no
recibe, indefinidamente, y ninguna de las dos vías de detección lo ve.

**El camino.**

1. Cliente `ACTIVE` con un addon recurrente (`PERIÓDICO` + `MIENTRAS_VIVA_LA_SUSCRIPCIÓN`, la
   casilla del §38 en `B/16` §1.3). Cada addon recurrente **es su propio preapproval**
   (`DEC-ADDON-002`).
2. Upgrade. La sucesora autoriza, `S17` mata a la predecesora, el addon se re-apunta a la sucesora
   (`B/16` §4.2).
3. **El primer cobro de la sucesora se rechaza.** `S16`, con la condición nueva del cambio 20: *«es
   el primer cobro **DE ESA autorización**, y el proveedor la canceló al rechazarlo»*. Se cumple:
   es el primer cobro de ese preapproval. Destino: **`CHARGE_DECLINED`**, terminal.
4. Toca decidir sobre el addon. `B/16` §4.2 tiene **un solo estado** en la fila de
   `VERTICAL_SUBSCRIPTION`: *«la suscripción de esa vertical **llegó a `CANCELLED`** y no tiene
   sucesora»*. `CHARGE_DECLINED` no es `CANCELLED`. **No queda huérfano.**
5. Entonces `B/16` §4.3 no dispara: su preapproval **no se cancela** y *«sigue cobrando por su
   cuenta hasta que alguien lo cancele»*.
6. **Y la capacidad se apaga en el mismo movimiento.** `CHARGE_DECLINED` **no emite fuente**
   (`12-contrato…` §2.6, última fila), así que no queda ninguna de clase `TÍTULO`; y el cambio 2 de
   la 9-bis dice qué hace el pliegue entonces: *«**El pliegue del conjunto efectivo DESCARTA las
   fuentes de clase `COMPLEMENTO` cuando no hay ninguna de clase `TÍTULO` viva.**»* (§2.4). Cobra y
   no otorga.
7. **Los dos detectores están cerrados, y por razones distintas.** El barrido no mira la fila del
   título: `B/09` §3, *«Los estados terminales no se barren: `CANCELLED`, `ABANDONED` y
   `CHARGE_DECLINED`»*. Y el detector propio del §4.3 —*«un addon **en estado terminal** con su
   preapproval vivo es una discrepancia que el barrido ve»*— no aplica, porque **la instancia de
   addon está `ACTIVE`**: ninguna de `A4`, `A5` ni `A6` se disparó.
8. Del lado de la suscripción de complemento todo se ve sano: es una fila `ACTIVE` con su
   preapproval `authorized`, y el barrido la recorre y la aprueba.

**Dónde lo permite el diseño.**

- `HOS-1354/docs/16-addons.md` §4.2 (la fila `VERTICAL_SUBSCRIPTION`) y §4.3 (el efecto y su
  detector).
- `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S16`; §3.1 (`CHARGE_DECLINED` terminal).
- `HOS-1354/docs/09-conciliacion.md` §3 (los tres terminales exentos).
- `12-contrato-de-cobertura.md` §2.4 (el descarte del `COMPLEMENTO`) y §2.6 (`CHARGE_DECLINED` no
  emite).

**Severidad.** `CRITICA` — débito mensual con dinero real a alguien que no recibe nada a cambio,
sin detección. Es textualmente lo que `B/16` §4.3 describe como el modo de falla inaceptable: *«un
preapproval huérfano sin cancelar es un débito mensual a alguien que ya no es cliente»*.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son tres de la misma tanda apilados.** El estado
`CHARGE_DECLINED` y su exención del barrido son los cambios 6/9/14 de `R1` (reafirmados por el 19 y
el 20); el descarte del `COMPLEMENTO` sin título es el **cambio 2** de esta tanda; y la condición de
huérfano es el cambio 18 de `R1`, escrita cuando el único estado terminal de una suscripción con
addons era `CANCELLED`. **Ninguno de los tres revisó la lista del otro**: agregar un estado terminal
obliga a recorrer todas las listas que enumeran terminales, y el §4.2 de `B/16` es una de ellas y
no se tocó.

---

## ALTAS

### F-8cB2-005 — El espejo declara *«los ocho pares»* sobre un dominio de treinta y seis y deja dieciséis afuera, entre ellos `authorized × ACTIVE`: el barrido marca todas las noches a la cartera sana entera

**Qué se rompe.** La tabla nueva del cambio 18 declara, con todas las letras, que *«lo que **no**
figura acá es divergencia real»*. `authorized × ACTIVE` —el par que describe a **todo cliente que
paga y está al día**— no figura. Entonces cada relectura de una suscripción sana produce una
divergencia: el barrido diario marca la cartera completa, y **una fila marcada no puede declarar
una sucesión**, así que nadie puede cambiar de plan.

**El camino.**

1. `B/09` §3, fila *«estado»*: *«se compara el estado **contra el del proveedor, leído por id**; si
   difieren, **no se escribe el del proveedor**: se evalúa la transición contra la tabla del cap.
   03. **Si no existe, se pone la marca**»*. El barrido corre **diario** sobre toda fila no
   terminal (§7).
2. Una `ACTIVE` sana se relee y devuelve `authorized`.
3. Se busca el par en `B/03` §10.1. **No está.** Y el § cierra el punto: *«Lo que **no** figura acá
   es divergencia real, y ahí la marca es la respuesta correcta — deja de ser un falso positivo y
   pasa a señalar lo que su nombre dice»*.
4. `S14` pone la marca y emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin.
5. `B/02` §2.2: *«**Y la marca sí bloquea algo, a propósito**: mientras esté puesta **no se puede
   declarar una sucesión** sobre esa fila»*. Con la cartera marcada, `DEC-SUB-006` y `DEC-SUB-007`
   quedan inejecutables para todos.
6. Y el arreglo 19 le agrega reloj: *«Si sigue puesta pasado su plazo, **escala**»*. Escala la
   cartera entera.

**El dominio, contado.** El § declara *«El proveedor devuelve **cuatro** estados de preapproval»* —
respaldado por `RC-1`, que midió *«los 4 estados suman exactamente 153»* sobre 153 suscripciones—.
Nuestros estados **con fila** son nueve (`B/03` §3.1, sin contar *(sin fila)*). **El dominio es
4 × 9 = 36.** Recorrí las ocho filas de la tabla, contando sus dos comodines:

| estado del proveedor | pares cubiertos | cuáles |
|---|---|---|
| `pending` | **9 de 9** | uno explícito + *«cualquier otro»* |
| `authorized` | **4 de 9** | `PENDING_AUTHORIZATION`, `PAUSED`, `GRACE_PERIOD`, `SUSPENDED` |
| `paused` | **1 de 9** | `ACTIVE` |
| `cancelled` | **6 de 9** | `CANCEL_SCHEDULED` + *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»* (cinco) |
| | **20 de 36** | |

**Los dieciséis que faltan** son: `authorized ×` {`ACTIVE`, `CANCEL_SCHEDULED`, `ABANDONED`,
`CANCELLED`, `CHARGE_DECLINED`}; `paused ×` {`PENDING_AUTHORIZATION`, `GRACE_PERIOD`, `PAUSED`,
`SUSPENDED`, `CANCEL_SCHEDULED`, `ABANDONED`, `CANCELLED`, `CHARGE_DECLINED`}; y `cancelled ×`
{`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED`}.

**Y el patrón de lo que falta es lo que delata el corte.** El proveedor tiene cuatro estados y cada
uno tiene **un par «coinciden»** con el nuestro equivalente. La tabla escribe **uno solo** —
`pending / PENDING_AUTHORIZATION`, *«nada: coinciden»*—. Los otros tres —`authorized / ACTIVE`,
`paused / PAUSED`, `cancelled / CANCELLED`— **no están**, y son los tres estados en los que vive
toda la cartera.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §10.1, tabla *«Qué se
escribe, par por par»* y el bloque `>` que la sigue; `HOS-1354/docs/09-conciliacion.md` §3 y §7;
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (el bloqueo de sucesión); `06-mp-validation-matrix.md`,
`RC-1`.

**Severidad.** `ALTA`, y digo por qué no `CRITICA`: nadie paga de más ni de menos por este defecto
**directamente**. Lo que produce es que el mecanismo de cambio de plan quede inejecutable para toda
la cartera y que el canal de incidentes se llene con la cartera sana — con el efecto de segundo
orden de que las divergencias reales, que son las que cuestan plata, quedan enterradas. Es el
defecto de mayor volumen de esta pasada; no es el que mueve dinero por sí solo. *(La pasada
anterior calificó `CRITICA` a `F-8bB2-002`, que es de esta misma forma —una operación inhabilitada,
sin plata mal movida—. Con el criterio escrito en las instrucciones de esta fase, `ALTA` es lo que
corresponde a las dos.)*

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 18.** Y es el caso de libro de
`DEC-METH-008`. Antes de la 9-bis el choque entre *«se escribe lo leído»* y la regla 1 era
**ambiguo** (mi `F-8bB2-005`): una implementación razonable escribía el estado leído y no marcaba
nada. El arreglo lo volvió **determinista** — y determinista significa que los dieciséis pares que
no enumeró ahora tienen veredicto escrito, y es el peor de los dos.

---

### F-8cB2-006 — `S17` sobre una predecesora `CANCEL_SCHEDULED`: su cancelación obligatoria en el proveedor da `400` medido, así que el arrepentimiento —el camino que el cambio 17 abrió a propósito— termina en un incidente y con `sucede_a` sin limpiar para siempre

**Qué se rompe.** Todo cliente que programa su baja y se arrepiente queda, después de reautorizar,
con la sucesión **abierta para siempre**: la predecesora sin pasar a `CANCELLED`, la sucesora con
`sucede_a` no nulo ocupando el candado `B` de por vida, una marca `requiere_conciliación` puesta y
`G-R1-A` en rojo. **Es `F-8bB2-002` renacido en la rama de falla de su propio arreglo.**

**El camino.**

1. Un cliente pide la baja. `S11`: *«**se cancela en el proveedor de inmediato** y se guarda
   nuestra fecha de fin de servicio»*. Queda `CANCEL_SCHEDULED`, con el preapproval **ya
   cancelado**.
2. Se arrepiente. `B/03` §3.3 lo encamina: *«arrepentirse **no es una transición: es una
   sucesión**»*, y `B/02` §2.2 le abre la puerta incluso con la marca puesta, con la verificación
   del cambio 17: *«puede suceder cuando está en `CANCEL_SCHEDULED`, **si una relectura del
   preapproval por su id confirma que efectivamente está cancelado**»*.
3. Nace la sucesora, el cliente autoriza, `S2` la lleva a `ACTIVE`.
4. Corre `S17`, cuyo dominio declarado es *«la **predecesora**, en cualquier estado vivo»* —los
   seis de `B/02` §2.2, `CANCEL_SCHEDULED` incluido— y cuyo efecto es **obligatorio**: *«**se
   cancela en el proveedor** (es `D7`)»*.
5. **Ese `PUT` cae sobre un preapproval que ya está `cancelled`, y está medido qué devuelve.**
   `PA-5` **`VERIFIED`**, 2026-09-15, sandbox: *«`PUT {status:"cancelled"}`. **Irreversible:
   reintentar da `400`**»*. El paso 2 acaba de **confirmar por relectura** que está cancelado, así
   que la rama no es hipotética: es la única.
6. `B/03` §3.2 dice qué pasa entonces: *«Si la cancelación en el proveedor **falla**, `S17` no
   ocurre: la marca se pone y una persona lo mira, que es el camino declarado y no un hueco»*.
7. Resultado: predecesora en `CANCEL_SCHEDULED` **marcada**; sucesora `ACTIVE` con `sucede_a` no
   nulo. Cuando llegue la fecha de fin de servicio, `S12` la lleva a `CANCELLED` y `G-R1-A` pasa a
   fallar —*«apunta a una predecesora **fuera de** `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`»*—.
   El candado `B` queda ocupado de por vida: **ese cliente no puede volver a cambiar de plan**.

**La otra rama tampoco es buena, y conviene decirlo.** Si el `PUT` no fallara —si el proveedor
tolerara re-cancelar—, `S17` sí ocurre y lleva la predecesora de `CANCEL_SCHEDULED` a `CANCELLED`
**antes de su fecha de fin de servicio**. `12-contrato…` §2.6 mide el precio de eso: una
`CANCEL_SCHEDULED` emite fuente con *«**la fecha** de fin de servicio de `DEC-SUB-009`»* y una
`CANCELLED` **no emite nada**. Se apaga el período que el cliente ya pagó, que es literalmente lo
que `B/19` §5 le prometió en pantalla: *«el servicio sigue hasta el fin del período pagado, **con
esa fecha a la vista**»*. Y ningún capítulo declara que la sucesión del arrepentimiento compute el
crédito de `DEC-SUB-006` —`B/03` §3.3 sólo la encamina por el candado `B`, no por la compensación—.

**Y `S17` no tiene nada que prevenir en esta celda.** Su razón es `D7`, que existe contra el doble
cobro. El propio `B/03` §3.3 escribe que acá no lo hay: *«**No hay riesgo de doble cobro**: `S11` ya
canceló el preapproval de la predecesora «de inmediato», así que la única autorización que puede
cobrar es la de la sucesora»*.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S11`, `S17` y la
nota sobre la cancelación fallida) y §3.3; `HOS-1354/docs/02-modelo-de-datos.md` §2.2 (la excepción
con relectura, y la lista de vivos); `HOS-1354/docs/20-testing.md` §2, `G-R1-A`;
`12-contrato-de-cobertura.md` §2.6; `HOS-1354/docs/19-superficies.md` §5;
`06-mp-validation-matrix.md`, `PA-5`.

**Severidad.** `ALTA` — la rama medida no mueve plata mal: inhabilita el cambio de plan de por vida
para ese cliente y convierte un camino normal en un incidente garantizado. La rama que sí mueve
plata (perder el período pagado) depende de una tolerancia del proveedor que `PA-5` mide **al
revés**, así que no la cuento como `CRITICA`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y es el cruce de dos de la misma tanda.** El
cambio 17 abrió el arrepentimiento desde una fila marcada y el cambio 11·12 le puso encima una
`S17` con efecto obligatorio sobre *«cualquier estado vivo»*. Cada uno recorrió su propio dominio;
**la celda `CANCEL_SCHEDULED × S17` es de los dos y no es de ninguno.**

---

### F-8cB2-007 — `S17` declara legítimos tres estados de predecesora que `G-R1-A` declara violación, y seis transiciones normales sacan a una predecesora legal del conjunto que el guard exige, dentro de la ventana de 72 h

**Qué se rompe.** El guard que la 9-bis dejó para vigilar la sucesión **falla sobre datos que la
tabla de transiciones declara correctos**. O el guard se apaga —y con él la única vigilancia de
`D15`—, o el equipo persigue rojos que son el camino normal.

**El camino, en dos direcciones.**

1. **`S17` amplía el conjunto.** `G-R1-A` falla cuando *«una fila con `sucede_a` no nulo apunta a
   una predecesora **fuera de** `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`»* (`B/20` §2), y el
   mismo § dice qué quiso prohibir: *«impide declarar una sucesión desde una `SUSPENDED` … o desde
   una `PAUSED`»*. `S17` declara su origen como *«la **predecesora**, en cualquier estado vivo»*, y
   los vivos son **seis** (`B/02` §2.2). **Tres de los seis —`PENDING_AUTHORIZATION`, `PAUSED` y
   `SUSPENDED`— son los que el guard rechaza.** Una transición cuyo dominio incluye estados que un
   guard declara imposibles es, o una transición con tres filas muertas, o un guard que va a fallar.
2. **Y la predecesora se mueve sola.** El guard está escrito como una propiedad **permanente** de
   la fila, sin instante; la sucesión dura **hasta 72 h** (`S3`). Recorrí las salidas de los tres
   estados permitidos y **seis transiciones** sacan a una predecesora legal del conjunto **sin que
   nadie declare una sucesión nueva**:

| # | desde | transición | a dónde | ¿queda en el conjunto de `G-R1-A`? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` (la persona pide pausar) | `PAUSED` | **no** |
| 2 | `ACTIVE` | `S9` (`SUPER_ADMIN` otorga cortesía) | `PAUSED` | **no** |
| 3 | `ACTIVE` | `S13` (*Free Forever*) | `CANCELLED` | **no** |
| 4 | `ACTIVE` | `S16` (primer cobro de esa autorización rechazado) | `CHARGE_DECLINED` | **no** |
| 5 | `GRACE_PERIOD` | `S6` (se agota el reloj) | `SUSPENDED` | **no** |
| 6 | `CANCEL_SCHEDULED` | `S12` (llega la fecha de fin) | `CANCELLED` | **no** |

   La 5 y la 6 no necesitan que nadie haga nada: son relojes. Un cliente que declara una sucesión
   con **un día de grace restante** o **un día antes de su fin de servicio** produce el rojo sin
   tocar un botón.
3. **Y `S17` no rescata el caso**, porque `S17` sólo ocurre si la sucesora **autoriza**. Si el
   cliente abandona, `S3` mata a la sucesora a las 72 h y el rojo se apaga solo; si autoriza, `S17`
   limpia `sucede_a` y también se apaga. **El rojo vive exactamente durante la ventana**, que es
   cuando nadie lo puede distinguir de uno real.

**Dónde lo permite el diseño.** `HOS-1354/docs/20-testing.md` §2 (`G-R1-A` y su párrafo
explicativo) y §2.1 (*«el texto con que falla no puede afirmar más de lo que el predicado
verifica»*); `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S6`, `S8`, `S9`, `S12`, `S13`, `S16`,
`S17`); `HOS-1354/docs/02-modelo-de-datos.md` §2.2 (los seis vivos).

**Severidad.** `ALTA` — el guard es el único apoyo declarado de `D15` fuera de la clave, y un guard
que falla sobre el camino normal es un guard que alguien va a relajar. `B/20` §2.1 lo dice para el
mensaje y vale igual para el predicado.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 11·12.** `G-R1-A` es de `R1` y describía
un mundo en el que la sucesión sólo tenía un `INSERT` que vigilar. `S17` le agregó a la sucesión una
**vida** —un origen en seis estados y una ventana durante la cual la predecesora sigue siendo una
suscripción normal— y nadie volvió a leer el guard.

---

### F-8cB2-008 — Con `S16` leído por autorización, un cliente al día que sube de plan y cuyo primer cobro nuevo rebota pierde las dos suscripciones: `S17` mató la vieja media hora antes de que supiéramos que la nueva no cobra

**Qué se rompe.** Un cliente que venía pagando sin problemas pide un upgrade, autoriza con una
tarjeta que resulta rechazada, y termina **sin ninguna suscripción**: la vieja cancelada de forma
irreversible por `S17`, la nueva en `CHARGE_DECLINED`, que el capítulo declara **terminal** y cuya
única salida es *«un alta nueva»*. La pérdida la produce una operación que el cliente pidió para
**pagar más**.

**El camino.**

1. Cliente `ACTIVE` al día, con pagos acreditados. Pide un upgrade; la sucesora nace y autoriza.
2. `S2` la lleva a `ACTIVE`. `S17` cancela a la predecesora en el proveedor —irreversible,
   `PA-5`— y la pasa a `CANCELLED`.
3. **El cobro real todavía no ocurrió.** `PA-3`, re-medido el 2026-09-17: el cobro real llega
   **entre 26 y 44 minutos** después de autorizar (`B/12` §4.3). Durante esa media hora el diseño
   ya destruyó la relación anterior.
4. El cobro se rechaza. `S16` con su condición nueva: *«es el **primer cobro DE ESA autorización**,
   y el proveedor la canceló al rechazarlo»*. **Se cumple exactamente**: es el primer cobro de ese
   preapproval. Destino `CHARGE_DECLINED`, *«**Terminal**: el proveedor la canceló al rechazarlo»*,
   y *«no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva**»*.
5. El cliente queda sin cobertura: ni `CANCELLED` ni `CHARGE_DECLINED` emiten fuente
   (`12-contrato…` §2.6), así que `cubierto` es falso y sus fichas se despublican.
6. Y arrastra `F-8cB2-004`: sus addons recurrentes siguen cobrando.

**Lo que esto le hace a la premisa de `DEC-SUB-006`.** Su implicación 1 es la razón por la que `D7`
existe: *«Si se cancela al iniciar el cambio y el cliente abandona el checkout, **se queda sin
nada**. Con este orden, **si nunca autoriza, la vieja sigue viva y no pasó nada**»*. El orden
protege contra *«no autoriza»*. **No protege contra «autoriza y el cobro rebota»**, que es un
desenlace que la misma tanda volvió terminal: la medición del §4.4 dice que ahí el proveedor cancela
el preapproval en el mismo milisegundo, así que no hay nada que reintentar de ninguno de los dos
lados.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.1 (`CHARGE_DECLINED`, y
el párrafo *«Y su condición es POR AUTORIZACIÓN, no por la historia de la persona»*) y §3.2 (`S16`,
`S17`); `HOS-1354/docs/12-suscripcion.md` §4.3 y §4.4; `01-decision-log.md`, `DEC-SUB-006`
implicación 1; `06-mp-validation-matrix.md`, `PA-5`.

**Severidad.** `ALTA` — un cliente al día pierde su servicio por completo en una operación de
upgrade. No lo pongo en `CRITICA` porque no hay cobro indebido y la relación es **reconstruible**
dando de alta de nuevo; lo que se pierde sin vuelta son sus addons, y eso ya está contado en
`F-8cB2-004` y `F-8cB2-002`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 20**, cruzado con el 11·12. La lectura
histórica anterior —*«ningún pago acreditado antes para ese `user + vertical`»*— **excluía** a este
cliente de `S16` (era el sujeto de mi `F-8bB2-003`, donde caía en un `GRACE_PERIOD` impagable). El
cambio 20 arregló esa celda correctamente y **movió al mismo sujeto a un estado terminal**, sin
recorrer qué pasa cuando la autorización cuyo primer cobro rebota es la de una **sucesora** y la
predecesora ya fue destruida.

---

### F-8cB2-009 — `D8` subió a nivel «base» apoyado en un guard que, tal como el cambio 13 lo redactó, no se puede escribir: compara una columna contra lo que el proveedor confirmó, y los guards corren contra el árbol de fuentes

**Qué se rompe.** La precondición de seguridad del mecanismo más caro del sistema —*«una fecha de
primer cobro futura»*, `D8`— queda **sin ningún apoyo ejecutable**. La base guarda un valor pero no
lo restringe contra nada, y el guard que el núcleo declara como su segunda mitad no es una propiedad
del código.

**El camino.**

1. `NUCLEO/04` §3, `D8`, columna *«dónde se hace cumplir»*: *«**base**: la fecha **que el proveedor
   confirmó** se guarda en `subscription` (cap. 02 §2.2, épica de billing), y **un guard la compara
   contra esa ventana**»*.
2. El §1 del mismo capítulo define *«base»* como *«una restricción de la base lo impide … **no
   admite ningún camino que lo esquive**»*. **Guardar una columna no impide nada**: `B/02` §2.2 la
   describe como un campo más de `subscription`, sin `CHECK` ni índice. Un `CHECK` tampoco podría
   escribirse: la ventana de autorización es **configuración global** (`B/03` §3.4 punto 1), no una
   columna de la fila.
3. Queda el guard. `B/20` §2, `G-R1-B`, con la mitad que agregó el cambio 13: *«una fila con
   `sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana
   de autorización, **o esa fecha no es la que el proveedor confirmó**»*.
4. **Las dos mitades hablan de filas, y los guards no ven filas.** `B/20` §1, tabla de las cuatro
   capas: *«**guards** | propiedades del **código**, no de una ejecución | **el árbol de fuentes,
   en CI**»*. La segunda mitad es peor que la primera: *«la que el proveedor confirmó»* sólo se
   puede comprobar **releyendo el proveedor**, que es una ejecución con red, y `NUCLEO/04` §3
   descarta esa vía en la misma frase con que promueve el invariante: *«un guard tiene que poder
   correr sin red»*.
5. Resultado: `D8` está contado como **base + guard** en el resumen del §5 —es uno de los tres que
   *«se sostienen en dos niveles a la vez»*— y en la práctica se sostiene en **cero**.

**Dónde lo permite el diseño.** `nucleo/04-invariantes.md` §1, §3 (`D8` y su párrafo *«`D8` subió de
nivel»*) y §5; `HOS-1354/docs/20-testing.md` §1 y §2 (`G-R1-B` y su explicación);
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (la columna, y *«El guard sigue corriendo sin red, porque
lee la columna»*).

**Severidad.** `ALTA` — el invariante cuyo incumplimiento `B/02` §2.2 llama *«literalmente el doble
cobro»* no tiene dónde hacerse cumplir. No es `CRITICA` porque el defecto es de **apoyo**, no de
regla: la regla de `B/12` §5.2 sigue siendo correcta y una implementación que la respete no cobra de
más.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 13**, sobre una promoción de nivel de la
tanda anterior. `B/02` §2.2 escribe la frase que lo delata —*«El guard sigue corriendo sin red,
porque **lee la columna**»*—: leer la columna alcanza para la mitad vieja del predicado y **no
alcanza para la que el cambio 13 le agregó**, que es precisamente comparar esa columna contra el
proveedor. La mitad nueva se escribió sin releer la capa en la que el guard vive.

**`NUCLEO`** en su mitad de invariantes: el reparto de niveles de `D8` es de `nucleo/04`. La mitad
corregible acá es la redacción de `G-R1-B` en `B/20` §2.

---

### F-8cB2-010 — Una cortesía otorgada durante la ventana de una sucesión muere con la predecesora y su `courtesy_grant` queda apuntando a una fila cancelada: nada re-apunta la columna que la 9-bis volvió no anulable

**Qué se rompe.** Un `SUPER_ADMIN` firma una cortesía de tres meses; el cliente completa un cambio
de plan que ya tenía en curso; **la cortesía desaparece**. La fila del grant sobrevive apuntando a
una suscripción `CANCELLED`, deja de emitir fuente, y los días regalados se pierden sin que nadie lo
vea.

**El camino.**

1. Cliente `ACTIVE` pide un upgrade. Nace la sucesora en `PENDING_AUTHORIZATION`; la ventana dura
   hasta 72 h.
2. Dentro de esa ventana, un `SUPER_ADMIN` otorga una cortesía. `S9`: `ACTIVE` → `PAUSED` *(motivo
   `COURTESY`)*, con condición *«no hay pausa vigente»*. **Nada en la tabla ni en `DEC-GRANT-004`
   condiciona `S9` a que no haya una sucesión declarada.** Se pausa en el proveedor y *«el servicio
   se sostiene de nuestro lado»* (`DEC-GRANT-003`).
3. Se escribe la fila de `courtesy_grant`, con la columna que la 9-bis le agregó: *«**la suscripción
   que pausa** … la suscripción **no es anulable**»* (`B/02` §2.4). Apunta a la predecesora.
4. El cliente autoriza. `S17` cancela a la predecesora y la pasa a `CANCELLED`.
5. **La cortesía se cae sin que nadie la toque.** `12-contrato…` §2.6: una `PAUSED` por `COURTESY`
   emite *«**sí**, como `tipo: CORTESÍA`»* con la fecha de fin de la cortesía; una `CANCELLED`
   **no emite**. La fuente que transportaba el regalo era la suscripción pausada, y ya no existe.
6. **Y nadie re-apunta la columna.** `B/16` §4.2 re-apunta los addons *«en el mismo acto del
   upgrade»* y `B/14` §2.2 declara que la sucesora hereda el contador de la promo. **Para la
   cortesía no hay ninguna regla equivalente en ningún capítulo**, y la columna no admite nulo, así
   que la fila queda con una referencia a algo terminal.
7. El contrato ya declaró qué significa eso: *«**Una fuente sin referencia resoluble no se puede
   expresar**»* (§2.3) — y acá la referencia existe pero apunta a una fila que no emite.
8. Ni siquiera se puede volver a otorgar: `DEC-GRANT-004`, ejecutado por `B/03` §5, dice que *«en
   pausa se intenta otorgar cortesía → **se bloquea**»* — y `S9` sobre la sucesora `ACTIVE` sí
   entraría, pero el `SUPER_ADMIN` tendría que enterarse primero, y nada se lo dice.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.4
(`courtesy_grant.subscription_id`, no anulable, y su justificación);
`HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S9`, `S17`) y §5;
`12-contrato-de-cobertura.md` §2.3 y §2.6; `HOS-1354/docs/16-addons.md` §4.2;
`HOS-1354/docs/14-promos-cortesias-y-grants.md` §2.2.

**Severidad.** `ALTA` — se pierde un beneficio firmado por `SUPER_ADMIN`, en silencio y sin
detección: la fila marcada no aparece, el barrido no compara grants, y el cliente sólo lo nota
cuando le cobran. No es `CRITICA` porque la fila del grant sobrevive y una persona puede re-emitirlo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos.** La columna
`courtesy_grant.subscription_id` es de la 9-bis (`B/02` §2.4) y `S17` también (cambio 11·12). La
columna se escribió recorriendo el dominio de *«una cortesía presupone una suscripción»* sin
recorrer el de *«esa suscripción puede ser sucedida»*; el re-apuntado de la sucesión se escribió
para addons y promos y **no enumeró a la tercera entidad que cuelga de una suscripción**, que la
misma tanda acababa de crear.

---

## MEDIAS

### F-8cB2-011 — La lápida del cambio 21 se justifica con el barrido, y el barrido no mira los `CANCELLED`

**Qué se rompe.** La única fila que el sistema nuevo escribe en el corte queda justificada por un
mecanismo que, por escrito, nunca la va a leer. Si alguien implementa la justificación tal como está
—esperar que el barrido *«encuentre el id»*— el caso que la lápida existe para atajar sigue abierto.

**El camino.**

1. `B/21` §2.5: *«**El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su
   `provider_link`**, escrita DESPUÉS de cancelarlo en el proveedor»*.
2. Su justificación: *«Con la lápida, **el barrido del cap. 09 encuentra el id** y resuelve
   «cancelado durante el corte» en vez de «huérfana»»*.
3. `B/09` §3, párrafo del cambio 19: *«**Los estados terminales no se barren**: `CANCELLED`,
   `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos importe»*. Y §3 abre con
   *«Por cada suscripción de nuestro inventario **que no esté en un estado terminal**»*.
4. La lápida nace `CANCELLED`. **El barrido no la lee nunca.**
5. El mecanismo que sí funciona es otro, y es el que hay que escribir: la lápida guarda un
   `provider_link` con `UNIQUE(proveedor, id_del_proveedor)` (`B/02` §2.2), así que **el webhook
   del cobro tardío resuelve** contra ella y deja de ser *«un preapproval desconocido»* — que es la
   detección de `B/09` §2.2, no la de §2.3.

**Dónde lo permite el diseño.** `HOS-1354/docs/21-migracion.md` §2.5;
`HOS-1354/docs/09-conciliacion.md` §2.2, §2.3 y §3; `HOS-1354/docs/02-modelo-de-datos.md` §2.2
(`provider_link`).

**Severidad.** `MEDIA` — la lápida sigue cumpliendo su función por la otra vía y el daño que evita
—*«el cobro viejo se imputa como pago del ciclo nuevo: pagó dos veces y el sistema registra una»*—
sigue evitado. Lo que está mal es la razón escrita, y una razón caduca bajo una conclusión correcta
es la que nadie revisa.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 21**, apoyado en una premisa que el
cambio 19 —de la misma tanda, en `B/09` §3— dejó escrita en contra. El cambio 19 reafirmó y amplió
la lista de terminales exentos **el mismo día** en que el 21 empezó a depender de que uno de ellos
se barriera.

---

### F-8cB2-012 — El reloj de la marca *«escala»* hacia un lugar que no existe: el §22.1 ya es el techo

**Qué se rompe.** La única cota que el cambio 19 le puso a una divergencia de plata sin resolver no
tiene efecto declarado, así que no se puede implementar de dos maneras distintas: se puede
implementar de ninguna.

**El camino.**

1. `B/09` §3: *«**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**: es una
   divergencia de plata que nadie resolvió, y sin reloj el servicio que la fila sostiene **no tiene
   cota**. El plazo es configuración, como todos los del §42»*.
2. *«Escala»* no nombra actor, destino ni efecto. Lo que hay arriba es `S14`, y su efecto ya es el
   máximo que el diseño tiene: *«evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero
   decisiones destructivas automáticas**»* (`B/03` §3.2).
3. Las dos lecturas posibles son incompatibles con el resto: **repetir el §22.1** es exactamente lo
   que el mismo § acaba de decidir que no se hace (*«lo que no vuelve a emitir es una alerta por
   corrida sobre un caso ya abierto»*, apoyado en `DEC-OBS-001`); y **cortar el servicio** es una
   decisión destructiva automática, que el §22.1 prohíbe de frente.
4. Y la frase *«el servicio que la fila sostiene no tiene cota»* declara el problema que el reloj
   viene a cerrar **sin cerrarlo**: sin efecto, el reloj sólo mide.

**Dónde lo permite el diseño.** `HOS-1354/docs/09-conciliacion.md` §3;
`HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S14`, `S15`); `HOS-1354/docs/19-superficies.md` §6
(el listado accionable, que es el canal y no tiene columna de vencimiento).

**Severidad.** `MEDIA` — no rompe nada por sí solo; deja sin cerrar la cota que su propio texto
declara necesaria, y con `F-8cB2-005` encima el reloj vence sobre la cartera entera.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 19**, en su segunda mitad. La primera
—que la fila marcada se siga barriendo— cierra bien la mitad de `F-8bB2-007` que le tocaba.

---

### F-8cB2-013 — `F-8bB2-007`, mitad que sigue llegando: la fila marcada volvió al barrido y nunca salió del camino de webhooks, así que el estado que la persona diagnosticó se mueve debajo

**Qué se rompe.** Lo mismo que reporté en la pasada anterior, en su mitad no arreglada: quien abre
un caso de conciliación diagnostica un estado y `S15` se ejecuta contra otro.

**En qué paso llega ahora.** El cambio 19 resolvió el paso 2 de aquel camino —la fila marcada **sí**
se barre, sólo se agrega el aviso—. El paso 3 quedó igual: *«cada webhook se procesa normalmente:
relee, escribe lo leído, registra el pago. **Nada en el §10.1 ni en el §3.2 menciona la marca**»*.
Lo verifiqué sobre el texto nuevo: `B/03` §10.1 y §3.2 siguen sin nombrarla, y `S15` sigue diciendo
*«si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo
permita**»* — evaluada contra el estado de hoy, no contra el que produjo el incidente.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §10.1 y §3.2 (`S15`);
`HOS-1354/docs/09-conciliacion.md` §3.

**Severidad.** `MEDIA` — la mitad cara (el punto ciego permanente) la cerró el cambio 19; queda la
carrera entre el diagnóstico humano y el camino de webhooks.

**¿Es nuevo, o es el arreglo?** Es **`F-8bB2-007` parcialmente arreglado**. Lo reporto con su ID
viejo, como pide el §4 de las instrucciones.

---

### F-8cB2-014 — La salida que `S15` le ofrece a una sucesión trabada es `S17`, y el evento de `S17` es un webhook que ya llegó y no se vuelve a emitir

**Qué se rompe.** Cuando `S17` no ocurre —la rama que `F-8cB2-006` mide como la única del
arrepentimiento, y la que `DEC-SUB-006` implicación 3 ya anticipaba para el upgrade—, la persona que
resuelve el caso no tiene con qué ejecutar la transición que falta.

**El camino.**

1. `S17` no ocurre; la marca queda puesta (`B/03` §3.2, nota final del §3.2).
2. `S15`: *«se levanta la marca; si además corresponde un cambio de estado, **se ejecuta la
   transición de esta misma tabla que lo permita**»*.
3. La transición que corresponde es `S17`, y su evento declarado es *«**webhook de que su sucesora
   quedó autorizada**, confirmado por relectura»*.
4. Ese webhook **ya llegó** y el proveedor no lo reemite por pedido: `WH-4` mide reintentos ante un
   `500` nuestro, no reemisiones a demanda, y `B/03` §10 aclara que el id del evento *«cambia en
   cada reentrega»*. El único disparador de `S17` es un hecho pasado.
5. La relectura sí se puede repetir y devolvería `authorized` sobre la sucesora — pero eso es el
   camino del §10.1, que va contra la tabla de los pares, y **`authorized × ACTIVE` no está en esa
   tabla** (`F-8cB2-005`): no hay nada que espejar y sí una marca nueva.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S15`, `S17`) y
§10.1; `01-decision-log.md`, `DEC-SUB-006` implicación 3 (*«Hace falta una reconciliación para el
caso en que la nueva quede autorizada y la cancelación de la vieja falle»*).

**Severidad.** `MEDIA` — es el borde de resolución de `F-8cB2-006` y su daño concreto ya está
contado ahí. Lo separo porque el defecto es de `S15`, no de `S17`: la promesa *«la transición de
esta misma tabla que lo permita»* supone que toda transición tiene un evento **re-ejecutable por una
persona**, y `S17` es la primera que no lo tiene.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el cambio 11·12.** `S15` se redactó en la tanda
anterior, cuando todas las transiciones de la tabla se disparaban por un acto nuestro, por un reloj
o por un estado releído. `S17` introdujo la primera cuyo disparador es **una entrega del proveedor**,
y nadie volvió a leer `S15`.

---

## Ataques que intenté y el diseño resistió

Nueve, y los pongo porque el valor de esta sección es que la próxima pasada no los repita.

1. **`S17` deja dos filas vivas si la cancelación en el proveedor tarda.** No: la nota del §3.2 es
   explícita y correcta —*«Si la cancelación en el proveedor falla, `S17` no ocurre: la marca se
   pone»*—, y `NUCLEO/03` regla 3 ya ordena que los efectos remotos vivan fuera de la transacción.
   El orden implícito (cancelar, después escribir) es el mismo que el §2.5 de `B/21` declara para la
   lápida. **El hueco no está en el orden: está en qué queda cuando falla** (`F-8cB2-006`).

2. **El candado `B` queda consumido para siempre después del primer cambio de plan**
   (`F-8bB2-002`). **Cerrado.** `S17` limpia `sucede_a` y el §3.2 recorre explícitamente el dominio
   de dos valores: *«la sucesora puede tener `sucede_a` **no nulo** … o **nulo** … **No hay un tercer
   estado**»*. Lo verifiqué contra el texto y contra los dos candados del `B/02` §2.2: `A` vuelve a
   estar ocupado y `B` libre. El arreglo es correcto; lo que no se recorrió es **quién más leía ese
   puntero** (`F-8cB2-002`).

3. **La condición histórica de `S16` deja sin salida al cliente que vuelve** (`F-8bB2-003`).
   **Cerrado por el cambio 20.** La condición nueva es *«es el primer cobro **DE ESA
   autorización**»*, sin ninguna referencia a la historia de la persona, y el §3.1 escribe por qué
   la histórica estaba mal. Verificado en el texto de `B/03` §3.1 y §3.2 y en `B/12` §4.3/§4.5.
   Lo que sí quedó es un sujeto nuevo en la celda (`F-8cB2-008`).

4. **`S16` es inalcanzable porque un rechazo reciclado es `PENDING`** (`F-8bB2-006`). **Cerrado por
   el cambio 20 sin nombrarlo**: la condición ya no se dispara por *«el cobro falló»* sino por *«el
   proveedor la canceló al rechazarlo»*, que es un hecho del preapproval y no del pago, y el §4.4 lo
   mide en el mismo milisegundo. La tensión con la tabla de `B/12` §1.3 sigue existiendo sobre el
   **pago** (queda `PENDING`), pero ya no bloquea la transición de la **suscripción**.

5. **La regla 1 del núcleo vuelve marca a los pares del espejo** (`F-8bB2-005`). **Cerrado en su
   forma, no en su alcance.** El §10.1 resuelve el choque enumerando y declara por qué no hizo una
   excepción a la regla 1 —*«abría un camino que escribe estado sin transición declarada»*—, que es
   el razonamiento correcto. El defecto que queda es aritmético, no conceptual (`F-8cB2-005`).

6. **La excepción de `CANCEL_SCHEDULED` se apoya en lo que la marca pone en duda**
   (`F-8bB2-004`). **Cerrado por el cambio 17.** La relectura por id es la verificación que
   faltaba, `D6` prohíbe el buscador y no la lectura por id (`RC-2` `VERIFIED`), y `B/02` §2.2
   escribe explícitamente la rama de falla: *«si la relectura dice que el preapproval sigue vivo, la
   marca hace lo que tiene que hacer: bloquear»*. El ataque no pasa.

7. **La fecha de primer cobro de una sucesora puede quedar en el pasado dentro de la ventana**
   (`F-8bB2-010`). **Cerrado por el cambio 14.** Atarla al vencimiento de la ventana es más fuerte
   que el *«un día como mínimo»* anterior, y se lee igual aunque la ventana cambie. Intenté el
   ataque inverso —que la regla **pise** el crédito de `DEC-SUB-006` en un cambio de ciclo con
   muchos días sin usar— y **no pasa**: la segunda frase del §5.2 la fija como piso, no como
   asignación (*«**Ninguna puede cobrar antes** de que su propia ventana se cierre»*), y `G-R1-B`
   verifica esa misma dirección. Anoto el intento porque la redacción perdió el *«como mínimo»*
   explícito que tenía antes, y el piso queda sostenido por una sola frase.

8. **El barrido apaga el único detector sobre la fila marcada** (`F-8bB2-007`, mitad cara).
   **Cerrado por el cambio 19**, con el argumento correcto: *«lo que se apaga así no es el ruido: es
   el único detector»*, y el mecanismo de agregación de `DEC-OBS-001` en vez de una exención. Queda
   la mitad menor (`F-8cB2-013`).

9. **Una pausa tomada dentro de la ventana de una sucesión se pierde con la predecesora.** Lo
   intenté por el lado de la cuota del §26.3 —*«4 pausas-mes por pausa y 8 acumulados en 12 meses …
   **sobreviven a cancelar y volver a suscribirse**»*— buscando que `S17` destruyera la pausa y
   dejara la cuota consumida. **No lo sostengo como hallazgo propio**: la cuota se cuenta por
   `user + vertical` y sobrevive por diseño, así que consumirla no es un defecto sino la política, y
   lo que sí se pierde en ese camino es la **cortesía**, que sí tiene dueño, fila y columna — y va
   como `F-8cB2-010`.

---

## Lo que cae fuera de mi vector, y a quién le toca

- **El monto del crédito** cuando el arrepentimiento desde `CANCEL_SCHEDULED` se ejecuta (la rama
  de plata de `F-8cB2-006`): es de `B1`.
- **`T6` desde la mitad de verticales** —qué le pasa a la publicación y a `PB2` cuando el trial
  nace consumido y después la suscripción muere— es de `A2`. Acá va sólo la mitad que se resuelve
  contra el conjunto de estados de billing.
- **El reparto de niveles de `D8`** (`F-8cB2-009`) es `nucleo/04`: **`NUCLEO`**, para la pasada C.
- **Los dieciséis pares del espejo** cruzan la frontera con el contrato en dos celdas
  (`CHARGE_DECLINED` y `ABANDONED` leídos como `cancelled`), y ahí se toca con `C1`.
