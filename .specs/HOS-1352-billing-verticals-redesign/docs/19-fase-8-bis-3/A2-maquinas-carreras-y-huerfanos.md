---
title: "FASE 8-bis-3 · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · A2 — máquinas de estado, carreras y huérfanos

Cuarta pasada adversarial A2. Vector: transiciones que faltan, transiciones que nadie dispara,
transiciones que se pisan, estados sin salida, relojes sin dueño, efectos huérfanos y carreras.

**Once hallazgos: 2 `CRITICA`, 5 `ALTA`, 3 `MEDIA`, 1 `BAJA`.**
**Atribución: 10 de 11 los introdujo —o los volvió alcanzables— un arreglo de la 9-bis-2. De los
2 `CRITICA`, 2 de 2.**
**El grep de `DEC-METH-009` habría mostrado 1 de los 2 críticos**, y ese uno con un matiz que
importa: el término **sí se buscó** y la resolución se aplicó a la mitad del dominio.

**El resultado en una línea.** `DEC-METH-009` mide bien lo que se propuso medir y tiene **dos
fugas que no son la misma cosa**. La primera es que un capítulo que **no usa el término
redefinido** es invisible al grep aunque sea el dueño de la regla que se rompe: `V/11` —el
capítulo del trial, dueño del *«el trial no vuelve»*— **no contiene la palabra `cubierto` en
ningún predicado ni la cadena `T6` ni una sola vez** (lo conté con `rg`: una aparición de
*«cubierto»* como palabra corriente en la línea 271, cero de `T6`), así que la familia del trial
podía grepear `cubierto` todo lo que quisiera y ese capítulo nunca iba a aparecer. La segunda es
que el grep encuentra el término y **la resolución se declara terminada sobre una parte del
dominio**: la familia de `CHARGE_DECLINED` buscó *«terminal»* en el cap. 09, encontró la exención
del barrido, y la acotó **para la instancia de addon y no para la suscripción**, que es justo
donde quedó colgado el único caso de esta tanda que le debe plata al cliente (`F-8dA2-001`).

Los paths se abrevian como en los documentos anteriores: `NUCLEO` es `HOS-1352-…/docs/nucleo/`,
`V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y dónde.** Todo lo que sigue sale de contar sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-21, con `rg` y
`awk`:

| qué conté | resultado |
|---|---|
| tablas de transiciones en el corpus (encabezado `\| # \| desde \| evento`) | **7**: 3 en `V/03` (§2, §9, §11) y 4 en `B/03` (§3.2, §6, §7, §8) |
| filas de la tabla de suscripción `B/03` §3.2 | **19** (`S1`…`S19`) |
| pares `(desde, evento)` con dos filas declarados por el corpus | **3** en `NUCLEO/03` §1 regla 7; **1** en `V/20` §2 |
| apariciones de `T6` en `V/11-trial.md` | **0** |
| apariciones de `cubierto` en `V/11-trial.md` | **1**, y no es un predicado |
| filas vivas que no emiten fuente | **3** según `NUCLEO/01` §2.4; **4** según `B/02` §2.2 |

**No medí nada contra el proveedor**: donde hablo de Mercado Pago cito la medición que el
capítulo ya trae, con su identificador (`PA-3`, `PA-5`, `EX-39`, `RF-6`).

---

## 1. Los hallazgos

### CRITICA

### F-8dA2-001 — El reembolso del pago que `S19` retiene no lo dispara nadie en la única rama que lo debe: `S18` no lo declara entre sus efectos y el barrido del cap. 09 no alcanza a la predecesora, que quedó `CANCELLED`

**Qué se rompe.** Un cliente en `GRACE_PERIOD` cambia de plan —el camino que `DEC-SUB-003` eligió
como *«una salida del problema en vez de un muro»*—, su cuota vieja entra por `recycling`, `S19`
la registra y la retiene, la sucesora autoriza y la sucesión se cierra. El capítulo declara que en
esa rama **el pago se reembolsa**, porque el período que cubría *«se lo comió `S17`»*. **Ninguna
transición escribe el acto que lo pone en marcha, y el único barrido que podría encontrarlo
después no mira esa fila.** El cliente pagó un período entero que no le compró nada, el dinero
queda en nuestra cuenta, y no hay ningún proceso que lo señale — ni el día siguiente ni nunca.

**El camino.**

1. `B/12` §5.3 declara que el pago no se resuelve al entrar: *«**El pago acreditado no se reembolsa
   al entrar: queda pendiente, y se resuelve cuando la sucesión se resuelve.** Mientras tanto no
   reactiva, no se devuelve y **no se pierde**»*.
2. La primera de sus cuatro ramas es la del cambio de plan exitoso, que es la normal: *«**la
   sucesora autoriza** (`S2`) → `S17` mata a la predecesora y `S18` cierra | **se reembolsa, y lo
   confirma una persona** (`DEC-RF-002`): **al cerrar la sucesión se pone la marca** y el caso entra
   al canal de conciliación; el sistema **no ejecuta el reembolso solo**»*.
3. **`S18` no pone ninguna marca.** Sus efectos, textuales en `B/03` §3.2, son exactamente tres:
   *«se escribe **`sucedida_por`** en la predecesora, se **limpia `sucede_a`** en la sucesora, y
   los complementos de la predecesora se **re-apuntan** a ella (`B/16` §4.2)»*. El pago pendiente no
   figura. `S17` tampoco lo nombra.
4. **Y no la puede poner `S14`, que es la única fila que escribe la marca.** Su evento es
   *«divergencia que toca plata o estado»*, y el propio `S19` declara lo contrario sobre este pago:
   *«**no pone la marca** — es un caso diseñado, no una divergencia»*. `B/05` §3 lo repite: *«el pago
   **se registra y queda pendiente de resolución** … **sin marca y sin evento crítico**»*. Invocar
   `S14` acá es contradecir por escrito las dos secciones que definen el caso.
5. Por la regla 1 del núcleo —*«La tabla de transiciones es exhaustiva. Lo que no está, no pasa»*—
   el acto que `B/12` §5.3 promete **no se ejecuta**. Es exactamente la forma de `F-8cA2-003` del
   ciclo anterior, un nivel más abajo: la regla vive en la prosa de otro capítulo y la tabla no la
   lleva.
6. **El backstop existe y no llega.** `B/09` §3 agregó la comprobación que parecía cerrar esto:
   *«Si una fila tiene un pago acreditado **pendiente de resolución** (`B/03` §3.2, `S19`) y ya
   **no** es la predecesora de una sucesión en curso —la sucesora murió, o la sucesión se cerró—,
   su destino estaba determinado y nadie lo ejecutó: se resuelve por la rama que le corresponda»*.
7. **Pero el barrido no la ve.** El mismo §3 abre con *«Por cada fila de nuestro inventario … **que
   no esté en un estado terminal**, más las terminales que la salvedad del complemento devuelve al
   barrido»* y remacha: *«**Los estados terminales de una SUSCRIPCIÓN no se barren**: `CANCELLED`,
   `ABANDONED` y `CHARGE_DECLINED`»*. La salvedad que devuelve terminales al barrido es explícita
   en su sujeto: *«**Una instancia de addon** en estado terminal SÍ se barre»*. La predecesora que
   retiene el pago está en **`CANCELLED`**, porque `S17` acaba de llevarla ahí. **Es una
   suscripción, no un addon.**
8. **El contraste es lo que lo vuelve un defecto y no una omisión pareja.** De las cuatro ramas,
   tres tienen backstop y la cuarta no, y la que no lo tiene es la única que le debe plata al
   cliente:

   | rama | estado de la predecesora | ¿la barre el cap. 09? | ¿debe plata? |
   |---|---|---|---|
   | la sucesora autoriza (`S17`+`S18`) | **`CANCELLED`** | **no**, terminal | **sí, se reembolsa** |
   | la sucesora vence su ventana (`S3`) | `GRACE_PERIOD` o `SUSPENDED` | sí | no, reactiva |
   | la sucesión queda trabada | el que tenía, con la marca | sí, y hay una persona mirándola | lo resuelve esa persona |
   | cae un grant (`S13`) | `CANCELLED` | no, terminal | **no**, `DEC-GRANT-001` lo exime |

9. **Y el guard vigila la dirección opuesta.** `G-R1-D` (`B/20` §2) falla si un camino *«**reembolsa**
   el pago que quedó pendiente por `S19` **antes** de que la sucesión se resuelva»*. Impide
   devolverlo temprano; **nada impide no devolverlo nunca**. Lo mismo `D11` (*«lo que toca plata lo
   confirma una persona»*), cuyo apoyo en `NUCLEO/04` §3 es **servicio**: ni base ni guard.
10. `NUCLEO/08` §3 cierra el círculo por el lado del proceso: el reembolso es *«**sí**, **sin
    excepción**: `DEC-RF-002` resolvió el único caso que el diseño tenía candidato a excepción —el
    reembolso del pago pendiente al cerrar una sucesión— **a favor de la confirmación**»*. La acción
    existe en el catálogo de admin; **lo que no existe es lo que le pone el caso adelante a esa
    persona**.

**Dónde lo permite el diseño.**

- `B/12-suscripcion.md` §5.3, la tabla de las cuatro ramas y el párrafo *«El pago acreditado no se
  reembolsa al entrar»*.
- `B/03-maquinas-de-estado.md` §3.2, efectos de `S18` y de `S17`; fila `S19` (*«no pone la marca»*);
  fila `S14`.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.
- `B/05-idempotencia-y-concurrencia.md` §3, *«sin marca y sin evento crítico»*.
- `B/09-conciliacion.md` §3, el encabezado del barrido, *«Los estados terminales de una SUSCRIPCIÓN
  no se barren»*, la salvedad de la instancia de addon, y la comprobación del pago pendiente.
- `B/20-testing.md` §2, `G-R1-D`; `NUCLEO/04-invariantes.md` §3, `D11`; `NUCLEO/08` §3, fila
  *«reembolsar»*.

**Severidad.** `CRITICA`. Es **plata del cliente que queda en nuestra cuenta sin servicio a
cambio**, sobre el camino normal del mecanismo que el propio corpus llama *«el más caro del
sistema»*, con el capítulo afirmando por escrito que *«no se pierde»* — que es lo que garantiza que
nadie lo busque. Y es del lado caro de `PA-5`: el período ya lo consumió `S17`, así que no hay nada
que devolverle salvo el dinero.

**¿Es nuevo, o es el arreglo?** **Lo introdujo la composición del arreglo 13 con el cierre.** El
arreglo **13** movió el disparador del reembolso de *«la llegada del pago»* a *«el CIERRE de la
sucesión»* y enumeró las cuatro ramas — el diagnóstico es correcto y la enumeración también. El
**cierre** (`1c972a07b`, `DEC-RF-002`) convirtió el reembolso automático en *«se pone la marca y una
persona confirma»*, o sea **cambió el efecto por un acto que alguien tiene que escribir**, y no lo
escribió en ninguna tabla. Y el mismo cierre acotó la exención de terminales del cap. 09 **para el
complemento**, dejando a la suscripción `CANCELLED` afuera del único barrido que podía recogerlo.
Antes del 13 el reembolso salía solo al entrar el pago: era el desenlace equivocado en la rama del
abandono, pero **ocurría**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y ésta es la instancia que más enseña:
el término se buscó y la resolución se aplicó a medias.** El término redefinido por la familia de
`CHARGE_DECLINED` es **«terminal» / «no se barren»**, y la búsqueda lo encontró —la exención del
cap. 09 §3 está acotada, con su razón escrita, en el mismo commit—. Lo que se resolvió fue **una**
de las dos poblaciones que la exención deja afuera: la instancia de addon. La suscripción
`CANCELLED` que retiene un pago es la otra, y quedó sin resolver y sin declararse correcta, que es
el tercer camino que `DEC-METH-009` exige y el único que no tiene marca visible. La segunda
búsqueda —**«S18»** sobre los capítulos que el commit del cierre no toca— habría mostrado la lista
de efectos de `B/03` §3.2 sin la marca. No se hizo, o no se resolvió.

---

### F-8dA2-002 — El tercer renglón del dominio de `T1`/`T6` le regala el trial completo al ex-cliente el día que la vertical enciende los días, que es exactamente la puerta que el §10.2 existe para cerrar

**Qué se rompe.** En una vertical que declara evento de activación y tiene los **días de trial en
cero** —hoy Partner, y `DEC-TRIAL-003` planifica encenderla—, nadie sale de `PRE_TRIAL`: ni `T1` ni
`T6` disparan, así que **no se escribe fila de trial para nadie**, ni para quien contrata, publica,
paga meses y cancela. El día que se suben los días a `>0`, esa persona —que ya fue cliente, ya
publicó y ya se fue— vuelve, publica, y **`T1` le da un trial completo**, porque en ese instante
`cubierto` es falso. El sistema le regala servicio comercial a alguien cuya relación comercial ya
terminó, y lo hace **en bloque**, a toda la cohorte de ex-clientes de esa vertical, el día de un
cambio de configuración.

**El camino.**

1. `V/03` §2 recorre el dominio del par en tres renglones, y el tercero es deliberado: *«| no
   declara evento, **o** días = 0 | cualquiera | **ninguna de las dos dispara**, y la persona se
   queda en `PRE_TRIAL` |»*. El párrafo siguiente lo defiende: *«**La tercera fila es nueva y es
   deliberada.** `T6` no repetía la mitad de catálogo … `DEC-TRIAL-003` contempla exactamente ese
   día para Partner»*.
2. Mientras los días están en cero, esa persona **puede contratar y publicar igual**: su suscripción
   `ACTIVE` emite fuente con `hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6) y su plan vendible le
   otorga la clave de publicar. No necesita la capacidad de activación del pre-trial para nada —
   `V/02` §2.1 la ata al mismo *«si y sólo si»* (*«declara evento de activación y su plan de trial
   tiene días > 0»*), así que en esa vertical la versión de pre-trial no la lleva.
3. Cancela. `S11` → `S12` → `CANCELLED`, que **no emite** (`12-contrato…` §2.6). `cubierto` pasa a
   falso, `PB2` le baja las fichas. **Y sigue en `PRE_TRIAL`**: la máquina de trial nunca se movió,
   porque su único evento de entrada nunca cumplió la mitad de catálogo.
4. La vertical enciende el trial: se publica una versión del plan de trial con días `> 0`. Por el
   *«si y sólo si»* de `V/02` §2.1, **la versión de pre-trial gana la capacidad de activación** —es
   un dato del catálogo, no una rama—. La persona crea una ficha y la publica.
5. `T1` evalúa su guarda: *«la vertical declara evento **y** su plan de trial tiene días de trial >
   0 **y** `cubierto` es **falso**»*. Las tres se cumplen. **Dispara**, y `V/03` §2 describe el
   efecto: *«**crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj»*, y el plan
   de trial *«se deriva … del plan vendible de `rank` más alto»* (`V/02` §2.1). O sea: **las
   capacidades del premium, gratis, por el período completo**, a un ex-cliente.
6. **Y es exactamente el desenlace que el mismo capítulo declara que `T6` existe para impedir**:
   *«sin escribirla esa persona **se guardaría un trial para el día que cancele** — un trial gratis
   para quien ya fue cliente, que es la puerta que el §10.2 existe para cerrar»*. La puerta la
   cierra `T6` en las verticales con días `> 0`; en la del tercer renglón **no la cierra nadie**,
   porque `T6` tampoco dispara.
7. La población no es un borde: es **todo el que fue cliente de esa vertical antes del encendido**.
   `V/02` §2.2 hace la fila única *«de por vida»*, así que basta con que no exista ese día para que
   el candado no exista tampoco. Y `V/11` §3.2 pone el techo de días *«acumulados por `user +
   vertical`»* sobre un techo que en este caso arranca virgen.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, la tabla de tres renglones del dominio del par, el párrafo *«La
  tercera fila es nueva y es deliberada»*, y la justificación de `T6` (*«se guardaría un trial para
  el día que cancele»*).
- `V/02-modelo-de-datos.md` §2.1, el *«si y sólo si»* de la capacidad de activación y la asimetría
  de los dos planes no vendibles; §2.2, la unicidad de por vida.
- `12-contrato-de-cobertura.md` §2.6, `ACTIVE` emite y `CANCELLED` no.
- `V/11-trial.md`, capítulo entero: **no nombra a `T6` ni una vez** y no tiene ningún § sobre el
  encendido de una vertical.

**Severidad.** `CRITICA`. Es **alguien que paga de menos**: recibe el activo más caro que el diseño
regala una sola vez en la vida —las capacidades del plan de `rank` más alto, con su cuota de
trial— después de haber sido cliente, y el corpus declara por escrito que esa puerta está cerrada.
No es un borde de un caso: es el estado de toda una cohorte en el momento de un cambio de
configuración que ya está planificado.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2 junto con el 3.** El arreglo **3** le
dio a `T6` su mitad de catálogo (*«días de trial > 0»*) y con eso **creó el tercer renglón**, que
antes no existía: `T6` disparaba sobre una vertical con días en cero y le escribía la fila
consumida — mal por la razón que el capítulo enumera, y **bien** por ésta, porque el candado
quedaba puesto. El arreglo **2** le puso a `T1` la condición `cubierto` falso, que es lo que hace
que `T1` dispare años después sobre alguien que ya no está cubierto. Los dos arreglos son correctos
por separado; el renglón que producen juntos se recorrió sobre el eje *«qué pasa hoy»* y no sobre
el eje *«qué pasa el día del encendido»*, que es el único que `DEC-TRIAL-003` promete que va a
llegar.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y es la fuga estructural de la regla.**
Los términos que la familia del trial redefinió son **`cubierto`**, **«fuente viva de clase
`TÍTULO`»** y **«fila viva»**. El capítulo que se rompe es `V/11-trial.md`, dueño del §10.2
—*«el trial no vuelve»*— y de las siete respuestas que rodean esa regla. **Lo grepeé: `V/11` no
contiene la cadena `T6` ni una sola vez, y contiene `cubierto` una vez, en la línea 271, como
palabra corriente y no como predicado.** Un grep de cualquiera de los tres términos sobre ese
capítulo devuelve cero o una línea irrelevante. La regla busca el término redefinido; **el
capítulo que la rompe es el que nunca lo nombró**, y por construcción esos son invisibles. Es el
mismo hueco que mi informe anterior anotó fuera de vector (*«`T6` no aparece en ningún capítulo
fuera de `V/03` §2»*): entonces era un dato de higiene, acá es lo que hace que la regla nueva no
alcance.

---

### ALTA

### F-8dA2-003 — La única fila del espejo que no nombra transición escribe estado sin transición declarada, y es la sexta salida de las filas vivas que la lista de cinco de `B/16` §4.3 no cuenta

**Qué se rompe.** El arreglo 14 fijó el disparador de la cancelación de complementos en *«deja de
ser fila viva»* y enumeró **cinco** transiciones para poder auditar que ninguna se olvidó. Hay una
sexta y no está en la lista: la baja que decide el proveedor, que el espejo de `B/03` §10.1 manda
escribir **sin nombrar ninguna fila de la tabla**. Según cómo se resuelva esa ambigüedad, o el
camino escribe un estado que ninguna transición declara —lo que la regla 1 manda mandar a la marca,
dejando la fila `ACTIVE` con servicio entero sobre un preapproval que el proveedor ya canceló—, o
la auditoría de las cinco es incompleta desde el día que se escribió.

**El camino.**

1. `B/03` §10.1 enumera los ocho pares del espejo y **cinco de ellos nombran una fila**: `S2`, `S10`,
   `S8`, `S12`, y dos dicen *«nada: coinciden»*. El octavo dice: *«| `cancelled` | cualquier estado
   vivo que no sea `CANCEL_SCHEDULED` | **`S12`** si hay una baja programada; si no, **espejar la
   baja decidida por el proveedor** (`B/12` §1.4) |»*.
2. *«Espejar la baja decidida por el proveedor»* **no es una fila de `B/03` §3.2**. `S12` exige
   `CANCEL_SCHEDULED` como origen; sobre una `ACTIVE`, una `GRACE_PERIOD`, una `PAUSED` o una
   `SUSPENDED` no hay ninguna transición declarada hacia `CANCELLED` salvo `S13` (grant) y `S17`
   (sucesión), y ninguna de las dos es ésta.
3. `B/12` §1.4 tampoco la nombra: *«eso es un hecho suyo … y entra por la regla de no-retroceso: se
   relee y **se escribe lo leído**»*. Describe el acto, no la fila.
4. **Y el § se cierra afirmando lo contrario.** `B/03` §10.1: *«**Espejar un estado leído por id es
   una transición declarada de esta tabla, no un acto aparte.**»*, y su justificación: *«Por qué
   enumerar y no declarar que espejar es una excepción a la regla 1. La excepción … abría un camino
   que **escribe estado sin transición declarada**, que es exactamente lo que la regla 1 existe para
   impedir»*. La enumeración se eligió **por eso** y dejó un renglón que hace exactamente eso.
5. **Rama A: se aplica la regla 1.** El estado no se escribe, se pone la marca. La fila se queda
   `ACTIVE` —*«conserva el estado que tenía, y sigue cubriendo a quien estaba cubierto»* (`B/03`
   §3.1)— sobre un preapproval que el proveedor canceló, o sea **servicio comercial entero sin
   ninguna autorización que pueda cobrar**, indefinidamente. Es el desenlace que `B/12` §1.4
   describe como el camino de mora normal: *«nuestro grace puede ser más largo que la paciencia del
   proveedor, y si lo es, **la baja llega antes que nuestra suspensión**»*.
6. **Rama B: se escribe igual.** Entonces la fila sale de las filas vivas por un camino que
   `B/16` §4.3 no cuenta: *«Las transiciones que la cumplen son **las cinco** que en `B/03` §3.2
   sacan a una fila principal de las filas vivas: `S3`, `S12`, `S13`, `S16` y `S17`»*. Lo que acota
   el daño es que el predicado de §4.2 es sobre un estado y *«se vuelve a evaluar»*; lo que se
   pierde es la lista con la que se audita *«que ninguna se olvidó»*, que es para lo que la lista
   existe.
7. **Y hay un tercer consumidor que también la cuenta.** `B/20` §2, `G-R1-A`: *«la sucesión dura
   **hasta 72 h**, y en esa ventana **seis transiciones normales** sacan a una predecesora
   perfectamente legal del conjunto de tres … las conté sobre la tabla del cap. 03 §3.2»*. La misma
   tabla de seis está en `B/03` §3.2. Un `cancelled` leído sobre una predecesora `ACTIVE` durante la
   ventana es una **séptima**, y deja a la predecesora en un estado del que `S17` ya no la puede
   sacar.
8. `B/12` §5.3 hereda el error en su dominio: *«El dominio es el de las formas en que una sucesión
   en curso puede terminar, y **son cuatro**. Las enumeré sobre `B/03` §3.2»*. Una predecesora que
   el proveedor da de baja mientras retiene un pago por `S19` no cae en ninguna de las cuatro: no es
   `S17`+`S18`, no es `S3`, no es la trabada y no es `S13`. **El destino de ese pago no está
   declarado.**

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §10.1, la tabla de ocho pares, su renglón `cancelled` × estado vivo,
  la cita *«es una transición declarada de esta tabla»* y el párrafo *«Por qué enumerar»*; §3.2, la
  tabla de las seis transiciones de la ventana y las filas `S12`, `S13`, `S17`.
- `B/12-suscripcion.md` §1.4; §5.3, las cuatro ramas.
- `B/16-addons.md` §4.3, *«las cinco»*; §4.2, *«la condición es sobre un estado, así que se vuelve a
  evaluar»*.
- `B/20-testing.md` §2, `G-R1-A` y *«seis transiciones normales»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.

**Severidad.** `ALTA`. La rama A deja servicio comercial entero sin autorización de cobro sobre el
camino de mora, que `B/12` §1.4 declara frecuente; la rama B rompe tres conteos que se usan como
auditoría. No es `CRITICA` porque en la rama A el cliente **no paga de más** —nadie le cobra— y el
daño es servicio regalado a un moroso con la marca puesta y una alerta emitida, y en la rama B el
predicado de `B/16` §4.2 se re-evalúa y alcanza igual.

**¿Es nuevo, o es el arreglo?** **Lo volvió contable el arreglo 14, y el renglón sin fila es del
arreglo 18 de la tanda anterior.** El espejo con su renglón anónimo lo escribió el arreglo **18**
(9-bis); mi informe anterior contó sus pares faltantes (`F-8cA2-004`) y no miró que **uno de los
ocho que sí figuran no nombra transición**. Lo que la 9-bis-2 agregó es el arreglo **14**, que
convirtió *«cuando un título muere»* en *«deja de ser fila viva»* **con una lista cerrada de cinco
para auditar**: hasta ese día no había ningún conteo que la sexta pudiera falsear. Un conteo
declarado es lo que convierte una omisión en un defecto verificable.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término que el arreglo 14 redefine
es **«fila viva»** / **«deja de ser fila viva»**, y el renglón que lo rompe —`cancelled` × estado
vivo, en `B/03` §10.1— **no contiene esa cadena**: habla de *«cualquier estado vivo»*, con la
palabra suelta que `NUCLEO/01` §2.4 regla 2 acaba de prohibir en un predicado. El grep del término
nuevo no encuentra a los consumidores que siguen usando **el término viejo**, y ése es el conjunto
donde viven los defectos que el arreglo vino a corregir. Un grep de *«vivo»* a secas —la palabra
que se está retirando— sí lo habría mostrado, y la regla no lo pide.

---

### F-8dA2-004 — Cinco de las seis transiciones de la ventana dejan al cliente sin ninguna fuente, contra la premisa exacta con la que el contrato le negó la emisión a `PENDING_AUTHORIZATION`

**Qué se rompe.** El contrato decidió que una suscripción esperando autorización **no emite
cobertura**, y su defensa contra la objeción obvia es una sola frase: *«a quien está cambiando de
plan **lo sigue cubriendo su suscripción vieja**»*. La tabla de seis transiciones que el arreglo 8
escribió en `B/03` §3.2 enumera las formas en que la predecesora se mueve durante esa ventana, y
**en cinco de las seis deja de emitir**. El cliente que cambia de plan pierde `cubierto`, `PB2` le
despublica **toda la cartera de esa vertical**, y lo hace en mitad de un checkout que está por
pagar — durante hasta 72 horas y sin que nadie lo haya decidido.

**El camino.**

1. `12-contrato…` §2.6: *«**Una suscripción esperando autorización NO emite fuente de cobertura.**»*,
   y su defensa: *«**Y no deja a nadie en la nada**, que es la objeción obvia: a quien recién
   contrata **le sigue rigiendo el piso** (§2.5), y a quien está cambiando de plan **lo sigue
   cubriendo su suscripción vieja**, que es justamente lo que `D7` mantiene viva hasta que la nueva
   quede autorizada»*.
2. `B/03` §3.2 enumera las seis transiciones que mueven a la predecesora en esa ventana *«sin que
   nadie declare nada»*: `S8` y `S9` (`PAUSED`), `S6` (`SUSPENDED`), `S12` y `S13` (`CANCELLED`),
   `S16` (`CHARGE_DECLINED`).
3. Cruzo las seis contra la tabla de emisión del `12-contrato…` §2.6:

   | transición | estado de llegada | ¿emite? |
   |---|---|---|
   | `S8` | `PAUSED` por `CUSTOMER_REQUEST` | **no** — *«el servicio está detenido»* |
   | `S9` | `PAUSED` por `COURTESY` | **sí**, pero con `tipo: CORTESÍA` |
   | `S6` | `SUSPENDED` | **no** — *«sin entitlements comerciales»* |
   | `S12` | `CANCELLED` | **no** |
   | `S13` | `CANCELLED` | **no** (el grant emite por su lado) |
   | `S16` | `CHARGE_DECLINED` | **no** |

   **Cinco de seis no emiten.** La sucesora tampoco, por la regla del punto 1. `cubierto` es falso.
4. **Y el propio § lo mide, en su otro argumento, sin volver sobre éste.** Dos páginas más abajo:
   *«Las seis transiciones que mueven a la predecesora durante la ventana de 72 h … **la dejan en un
   estado que no emite en cinco de los seis casos**»*. Ese conteo se usa para probar que **no**
   puede haber dos fuentes `SUSCRIPCIÓN` a la vez, que es verdad; y es exactamente el dato que
   falsea la defensa de la página anterior. **La refutación está en la misma sección que la
   afirmación.**
5. El caso más limpio es el arrepentimiento, que `B/03` §3.3 declara camino normal: *«arrepentirse
   **no es una transición: es una sucesión**»*. Una `CANCEL_SCHEDULED` declara sucesora; le llega la
   fecha de fin de servicio antes de que la persona autorice; `S12` la mata. Hasta 72 h sin ninguna
   fuente. `PB2` dispara —*«`cubierto` pasa a falso»*— y baja **todas** las fichas de esa vertical,
   porque *«una suscripción cubre todas las fichas de su vertical (§12), así que un solo evento de
   billing mueve varias publicaciones a la vez»* (`V/03` §9).
6. **La vuelta existe pero no es gratis**: cuando la sucesora autoriza, `S2` la pone `ACTIVE`,
   `cubierto` vuelve a verdadero y `PB3` republica. Lo que quedó en el medio es la ficha fuera del
   sitio público durante el intervalo, y el `12-contrato…` §2.6 dice que eso no pasa.
7. **El diseño ya vio este daño una vez y lo cerró para un solo caso.** `B/12` §5.3: *«el reloj del
   grace no corre sobre un pago pendiente. Si la ventana de 72 h cruza el vencimiento del grace,
   `S6` mandaría a `SUSPENDED` —que **no emite fuente** (`12-contrato…` §2.6)— a alguien cuyo pago
   del período **está acreditado** … por eso `S6` lleva la condición»*. El razonamiento es
   exactamente el de este hallazgo, **aplicado a la única rama en que el cliente ya había pagado**.
   Las otras cinco producen la misma pérdida de cobertura y no llevan nada.

**Dónde lo permite el diseño.**

- `12-contrato-de-cobertura.md` §2.6, *«Una suscripción esperando autorización NO emite fuente»*, el
  párrafo *«Y no deja a nadie en la nada»*, la tabla de los nueve estados, y *«no emite en cinco de
  los seis casos»*.
- `B/03-maquinas-de-estado.md` §3.2, la tabla de las seis transiciones; §3.3, *«El arrepentimiento
  no le quema al cliente el período que ya pagó»*.
- `B/12-suscripcion.md` §5.3, el párrafo del reloj del grace.
- `V/03-maquinas-de-estado.md` §9, `PB2` y `PB3`.

**Severidad.** `ALTA`. El cliente pierde la presencia pública de toda su cartera durante hasta 72
horas en el acto de comprar un plan, y el capítulo que decidió la emisión afirma por escrito que no
puede pasar — lo que garantiza que nadie construya la defensa. No es `CRITICA` porque nadie paga de
más, nadie accede a lo que no le corresponde y `PB3` restituye: el estado `UNPUBLISHED_BY_BILLING`
existe precisamente para que la vuelta sea posible (`V/03` §9).

**¿Es nuevo, o es el arreglo?** **Lo volvió medible el arreglo 8 y lo dejó a medias el 12.** La
decisión de que `PENDING_AUTHORIZATION` no emita es del arreglo 16 (9-bis) y su defensa se escribió
cuando la predecesora *«se quedaba donde estaba»*, porque `S17` todavía no existía y nada la movía
sola. El arreglo **8** partió `S17`/`S18` y, para justificar el `desde` de cinco estados, **enumeró
las seis transiciones que la mueven sin que nadie declare nada** — ése es el conteo que vuelve
falsa la defensa, y lo aportó el arreglo mismo. El arreglo **12** leyó ese conteo, vio la pérdida de
emisión **en la fila 3** y le puso condición a `S6` sólo para el caso con pago acreditado.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y es la tercera forma de fuga.** El
término que el arreglo 8 redefine es **«fila viva»** y **«la predecesora»**; el que se rompe es
*«lo sigue cubriendo su suscripción vieja»*, una **premisa en prosa** del `12-contrato…` §2.6 que no
contiene ninguno de los dos. Un grep de *«sucesión»* sobre el contrato sí la habría alcanzado —el §
la nombra— y el commit **sí tocó el contrato** (`12-contrato…` §2.6 lleva el párrafo de las dos
fuentes `SUSCRIPCIÓN`), o sea que el capítulo estaba abierto y editado y la contradicción quedó a
dos páginas de distancia dentro de él. `DEC-METH-009` busca **afuera del commit**; esta clase de
defecto vive **adentro**, entre dos párrafos de la misma sección que el commit escribió.

---

### F-8dA2-005 — `MP1` enruta el pago manual a `S19` y el evento de `S19` es una cuota en `recycling`: la transición no está declarada, así que la regla 1 la manda a la marca sobre el camino normal

**Qué se rompe.** Un cliente en `GRACE_PERIOD` cambia de plan y paga la cuota vieja **por
transferencia**. El admin la registra. `B/03` §7 dice que ese pago *«queda pendiente por `S19`»* y
`G-R1-D` lo cuenta como uno de los **tres** lugares donde la regla se ejecuta. Pero el evento
declarado de `S19` es *«entra el pago de la cuota que sigue en `recycling`»*, y un pago manual no
está en `recycling` — ni siquiera pasa por el proveedor. Por la regla 1 el intento **no se ejecuta**,
se pone la marca y sale un evento crítico sobre el camino normal; y una fila marcada **no puede ser
sucedida**, que es lo que el cliente está haciendo en ese mismo momento.

**El camino.**

1. `B/03` §7, `MP1`: *«| `MP1` | `AWAITING` | el admin registra el pago | `REGISTERED` | la
   suscripción sale de `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora
   de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el
   daño no depende de por qué puerta entró el pago |»*.
2. `B/20` §2, `G-R1-D`, lo confirma como uno de tres: *«**El guard existe porque la regla se ejecuta
   en tres lugares y no en uno**: `S5`, `S7` y **el efecto de `MP1`**»*.
3. `B/03` §3.2, `S19`: su evento es *«**entra el pago de la cuota que sigue en `recycling`**»*. El
   `recycling` es del proveedor y está medido como tal (`B/12` §1.3). Un pago manual **no es esa
   cuota**: `B/03` §7 abre diciendo que lo único propio del pago manual *«es cómo se constata el
   pago»*.
4. `NUCLEO/03` §1, regla 1: *«La tabla de transiciones es exhaustiva. Lo que no está, no pasa. Un
   intento de transición que la tabla no declara **no se ejecuta**: se registra como evento de
   dominio y, **si tocaba plata o estado, pone la marca `requiere_conciliación`** y emite el §22.1»*.
   El pago manual sobre una predecesora toca plata.
5. **Y el propio `S19` existe para impedir exactamente este desenlace**, dicho en su sección:
   *«Sin `S19`, el pago entrante sería una transición no declarada y la regla 1 lo mandaría a la
   marca, **convirtiendo el camino normal del cambio de plan desde grace en un incidente**»*. Con el
   evento escrito como está, eso sigue valiendo para la mitad manual del caso.
6. **El daño se compone**, porque la marca no es inocua acá: `B/02` §2.2 declara que *«mientras esté
   puesta sobre una fila, **ningún `sucede_a` puede apuntarla**»*, y esa fila **ya tiene** un
   `sucede_a` apuntándola. La sucesión queda en un estado que el modelo prohíbe escribir y nadie
   declara qué hacer con el vínculo existente.
7. La otra rama —que el implementador estire el evento de `S19` para cubrirlo— es la que el corpus
   prohíbe por escrito: `B/03` §10.1, *«un camino que **escribe estado sin transición declarada**,
   que es exactamente lo que la regla 1 existe para impedir»*.
8. Y hay una mitad más chica en el mismo sitio: `MP1` sólo nombra *«sale de `GRACE_PERIOD` por
   `S5`»*, mientras `B/12` §5.3 declara que *«son las dos transiciones, no una»* porque el reloj
   puede haberla pasado a `SUSPENDED` (`S7`). Un pago manual sobre una `SUSPENDED` no tiene
   desenlace escrito en `B/03` §7.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §7, `MP1` y el párrafo de apertura; §3.2, `S19` y `S5`; §10.1, *«Por
  qué enumerar»*.
- `B/20-testing.md` §2, `G-R1-D`.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.
- `B/02-modelo-de-datos.md` §2.2, el bloqueo de la sucesión por la marca.
- `B/12-suscripcion.md` §5.3, *«son las dos transiciones, no una»*.

**Severidad.** `ALTA`. Convierte el camino normal en un incidente y bloquea la sucesión que el
cliente está pagando, sobre el único de los seis cruces de `B/05` que el corpus llama *«el único …
que produce un doble cobro con dinero real»* en su vecindad. No es `CRITICA` porque el pago
**queda registrado** y la marca es conservadora —`S14` manda *«cero decisiones destructivas
automáticas»*—: hay una persona mirándolo, y el desenlace es una demora, no una pérdida.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 12**, que es literalmente la familia del
pago tardío: escribió `S19` con su evento, le puso la condición a `S5` y a `S7`, **y extendió `MP1`
al caso** en la misma tanda. Las tres escrituras son del mismo commit y la cuarta —que el evento de
`S19` admitiera el pago manual, o que `MP1` tuviera su propia fila— no se hizo.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, por definición de la regla.** El término
redefinido es **`S19`** / **«pendiente de resolución»**, y el consumidor que lo rompe —`MP1`— está
**adentro del mismo commit**: es una de las escrituras que el arreglo 12 hizo. `DEC-METH-009` busca
el término *«sobre los capítulos que el commit NO toca»*, y acá las dos mitades del defecto se
escribieron a la vez, a 330 líneas de distancia en el mismo archivo. La regla no tiene nada que
decir sobre la coherencia interna de un commit, y **dos de los once hallazgos de este informe son
de esa clase** (éste y `F-8dA2-008`).

---

### F-8dA2-006 — El catálogo de guards declara que `T1`/`T6` es «el único par» y el núcleo declara tres: el guard que «cuenta» que siga siendo uno falla sobre el camino normal desde el día que se escriba

**Qué se rompe.** `G-R4` es el mecanismo que convierte la regla 7 del núcleo en algo verificable en
vez de recordable, y su definición —la de `V/20` §2, que `B/20` declara canónica— dice que lo que el
guard cuenta es que `T1`/`T6` **siga siendo el único par**. El núcleo declara **tres**, y los otros
dos los escribió la misma tanda. Un guard implementado contra su definición sale en rojo sobre tres
pares legítimos desde su primer PR, y un guard que falla sobre el camino normal es un guard que
alguien relaja — argumento que `B/20` §2 hace por escrito, para `G-R1-A`, cuatro filas más abajo.

**El camino.**

1. `V/20` §2, párrafo de `G-R4`: *«`T1`/`T6` es **el único par con dos destinos que el diseño
   declara hoy** —que siga siendo el único es **lo que este guard cuenta**, no una lectura a
   mano—»*. Sin acotar a una épica: la fila de la tabla declara su dominio como *«sobre las nueve
   máquinas, **en las dos épicas**»*.
2. `NUCLEO/03` §1 regla 7 declara **tres**, con su tabla: `(PRE_TRIAL, evento de activación)` →
   `T1`/`T6`; `(GRACE_PERIOD, entra el pago)` → `S5`/`S19`; `(SUSPENDED, entra el pago)` →
   `S7`/`S19`. Y remacha que el número es del guard: *«**Que sean tres y no cuatro no es una
   afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**»*.
3. `V/03` §2 **sí** está corregido y por eso el defecto es aislable: *«es **el único par `(desde,
   evento)` con dos destinos distintos de esta épica**, y uno de los **tres** que el diseño declara
   hoy — los otros dos son `S5`/`S19` y `S7`/`S19`»*. La frase de `V/20` es la misma afirmación **sin
   la acotación que la vuelve cierta**.
4. `B/03` §3.2 confirma los dos pares nuevos: *«**`S19` y `S5` comparten `(GRACE_PERIOD, entra el
   pago)`, y `S19` y `S7` comparten el par sobre `SUSPENDED`** … Es la regla 7 del núcleo, y lo
   vigila `G-R4`»*.
5. `B/20` §2 declara que la definición vive del otro lado: *«**Referencia cruzada**: lo define
   `V/20` §2»*. O sea que el número equivocado está **en el único lugar que el corpus designa como
   la definición**, y el catálogo que sí conoce los pares nuevos remite a él.
6. Y `V/20` §2.1 tiene la regla que este párrafo viola en el sentido inverso: *«**el texto con que
   falla no puede afirmar más de lo que el predicado verifica**»*. Acá el texto afirma **menos** de
   lo que el dominio tiene, y el resultado es el mismo: un guard cuyo enunciado y cuyo dominio no
   coinciden.
7. Hay una segunda discordancia en el mismo par de líneas, más chica y del mismo origen: la **regla**
   de `NUCLEO/03` habla de *«dos filas que comparten `(desde, evento)`»* **sin calificar el
   destino**, y su tabla enumera sólo *«los pares con dos filas **y dos destinos distintos**»*. Un
   par con el mismo destino y guardas solapadas rompe la regla y queda afuera de lo que el guard
   cuenta. **Hoy no hay ninguno** —lo verifiqué recorriendo las 19 filas de `B/03` §3.2 y las 6 de
   `V/03` §2—, así que es dominio sin sujeto, no un defecto vivo.

**Dónde lo permite el diseño.**

- `V/20-testing.md` §2, la fila de `G-R4` y el párrafo *«`G-R4` y `G-R4-B` son el mismo defecto visto
  en dos planos»*; §2.1.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 7 y su tabla de tres.
- `V/03-maquinas-de-estado.md` §2, *«`T1` y `T6` comparten el par»*.
- `B/03-maquinas-de-estado.md` §3.2, *«`S19` y `S5` comparten»*.
- `B/20-testing.md` §2, la referencia cruzada de `G-R4` y el párrafo de `G-R1-A` (*«un guard que
  falla sobre el camino normal es un guard que alguien va a relajar»*).

**Severidad.** `ALTA`. `G-R4` es la única defensa que la regla 7 tiene, y la regla 7 es la única
defensa contra que el desenlace de una transición dependa del orden en que una implementación
recorra una tabla. Un guard que nace en rojo sobre tres pares legítimos se relaja o se borra, y lo
que se pierde con él es el conteo entero. No es `CRITICA` porque no hay plata ni acceso en juego
hoy: los tres pares **son** disjuntos, y lo roto es el instrumento que garantiza que el cuarto no
pase.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 12, sobre texto que escribió el arreglo
2.** La frase *«el único par»* la escribió la familia del trial (`49eb99f34`) y **era cierta el día
que se escribió**: `T1`/`T6` era el primero del programa. La familia del **pago tardío**
(`99e9d4e24`) agregó `S19` y con él los otros dos, actualizó `NUCLEO/03`, `V/03` y `B/03` — y no
tocó `V/20`, que es donde el guard se define.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, limpiamente, y es el mejor caso a favor
de la regla que da esta pasada.** El término que el arreglo 12 redefine es exactamente
**`(desde, evento)`** / **«el par»**: agregar un par a un conteo declarado es la definición de
redefinir un término. `V/20-testing.md` **no lo toca ese commit** y contiene la cadena dos veces
—en la fila de `G-R4` y en el párrafo de abajo—. Un `rg '\(desde, evento\)|único par'` sobre los
capítulos que el commit no toca lo devuelve en la primera corrida. **La regla existía y no se
ejecutó.**

---

### F-8dA2-007 — `A1` condiciona sobre un estado de la máquina de trial, que es de la otra épica y billing no puede leer; contradice a `V/11` §5.2, y `G-R4-B` sólo vigila la dirección inversa

**Qué se rompe.** La máquina de addons declara *«**Nunca durante un trial**»* como condición de su
primera transición. Es un estado de una máquina de la épica de verticales, y **no está entre los
siete campos que la dirección inversa del contrato le permite leer a billing**. El resultado son dos
capítulos contestando lo opuesto a la misma pregunta —`V/11` §5.2 dice *«¿Puede comprarlo? **Sí**»*
para quien tiene título en otra vertical— y una condición que el lado que tiene que evaluarla no
puede evaluar sin abrir un acoplamiento no declarado. La regla que acaba de escribirse para cortar
esto **sólo mira en una dirección**, y el guard también.

**El camino.**

1. `B/03` §8, `A1`: *«| `A1` | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una
   suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) |»*.
2. `V/11` §5.2 responde lo contrario para el caso que el §10.5 abre con la palabra *«solamente»*:
   *«**¿Puede comprarlo?** **Sí.** El §38 pide «una subscription válida compatible» y la tiene. La
   palabra «solamente» del §10.5 hace exactamente ese trabajo: lo que se prohíbe es comprar teniendo
   **nada más que** un trial»*. `A1` dice *«nunca»* y no lleva la palabra.
3. `12-contrato…` §4.1 enumera lo que billing **lee** de verticales, y son tres preguntas con siete
   campos: `políticaDePlan` (`díasDeGrace`, `díasDeTrial`, `permitePausa`, `vigente`, `vendible`),
   `situaciónDeVertical` (`admiteAltas`, `finDeServicio`) y `direcciónDeCambio`. **El estado de la
   máquina de trial de un `user + vertical` no está.** `díasDeTrial` es catálogo, no sujeto.
4. §4.2 dice qué hacer con eso: *«**Y en la otra dirección**: si billing necesita leer de verticales
   algo que no está en los seis campos del §4.1, vale lo mismo. **Una lectura no declarada es un
   acoplamiento que nadie está mirando**»*.
5. **La regla nueva que debería haberlo cortado mira sólo un lado.** `NUCLEO/01` §2.4 cierra con dos
   reglas de uso, y la primera es unidireccional: *«**Ninguna regla de la épica de verticales se
   condiciona sobre una fila viva**»*, con su justificación —*«el estado exacto de la suscripción no
   cruza»*—. La simétrica —ninguna regla de billing se condiciona sobre un estado de una máquina de
   verticales— **no está escrita**, aunque el §4.1 la implica.
6. **Y el guard hereda la asimetría.** `V/20` §2, `G-R4-B`: *«una condición o un evento de una máquina
   de **la épica de verticales** nombra un **estado de la suscripción** o de la instancia de
   addon»*. Por su propio enunciado, `A1` no lo dispara. No hay `G-R4-C`.
7. Las dos salidas son malas y ninguna está elegida: o billing lee la tabla de `trial` —el
   acoplamiento que el corte en dos épicas existe para impedir, y el §4.2 manda mirar—, o la
   condición no se implementa y `A1` queda con *«exige una suscripción principal válida y
   compatible»*, que es lo que `V/11` §5.2 quiere y **lo contrario de lo que `A1` escribe**.
8. Lo que acota el daño es que la fuga de capacidades la cierra otra regla: `V/11` §5.3, *«**Un addon
   de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un trial**»*, más el
   descarte de `COMPLEMENTO` sin `TÍTULO` de `V/15` §2.6 con su guard `G-R2`. Así que la venta puede
   ocurrir y el trial no recibe nada.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §8, `A1`.
- `V/11-trial.md` §5.1, §5.2 y §5.3.
- `12-contrato-de-cobertura.md` §4.1 (las tres preguntas y los siete campos) y §4.2 (la regla de
  vigilancia en las dos direcciones).
- `NUCLEO/01-glosario.md` §2.4, las dos reglas de uso.
- `V/20-testing.md` §2, `G-R4-B`.
- `V/15-entitlements-y-limits.md` §2.6, `G-R2`.

**Severidad.** `ALTA`. Dos capítulos dan respuestas opuestas a una decisión de compra, y el
predicado que decide no lo puede evaluar el lado que tiene que evaluarlo sin abrir la lectura que el
§4.2 declara vigilada. No es `CRITICA` porque nadie accede a lo que no le corresponde: `V/11` §5.3 y
`G-R2` apagan el addon en la vertical en trial aunque la compra se concrete, así que el peor
desenlace es cobrarle a alguien un addon que no va a usar ahí — visible y reversible.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es la que importa.** La
contradicción entre `A1` y `V/11` §5.2 es anterior a la 9-bis-2. Lo que la 9-bis-2 agregó es
`NUCLEO/01` §2.4 con sus **dos reglas de uso** y `G-R4-B` en el catálogo: hasta ese día no existía
ninguna regla sobre qué puede nombrar la guarda de una máquina, así que `A1` era una imprecisión.
Desde que la regla existe —**y se escribió en una sola dirección**— `A1` es una violación declarada
que ningún guard alcanza, y el dominio que el arreglo crea (las guardas de las **siete** tablas de
transiciones, no las de tres) es el que no se recorrió.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término que la familia del trial
redefine es **«vivo» → «fila viva» / «fuente viva»**, y `A1` no lo contiene: dice *«Nunca durante un
trial»* y *«una suscripción principal **válida**»*. Un grep de `vivo` sobre `B/03` §8 devuelve cero.
El defecto no es que un consumidor use mal el término nuevo, sino que **la regla nueva se enunció
sobre un dominio más chico que el que su propio argumento cubre** — y eso no lo encuentra ninguna
búsqueda de texto: hay que recorrer el dominio, que es lo que `DEC-METH-008` pedía y `DEC-METH-009`
no reemplaza.

---

### MEDIA

### F-8dA2-008 — `B/03` §4 dice que durante la sucesión `S6` no se ejecuta, y la fila `S6` del §3.2 dice que sí salvo pago pendiente: el reloj del grace tiene dos reglas en el mismo capítulo

**Qué se rompe.** El § donde alguien va a buscar *«¿corre el reloj del grace?»* —el capítulo de
Grace— y la tabla normativa de transiciones dicen cosas distintas. Bajo la lectura del §4 un moroso
que cambia de plan y abandona el checkout se lleva **hasta 72 horas de servicio completo más allá de
su grace**; bajo la del §3.2 no. Y la tabla de seis transiciones del propio §3.2, que cuenta a `S6`
entre las que mueven a la predecesora, **es falsa bajo la lectura del §4**.

**El camino.**

1. `B/03` §4, Grace: *«Entra por `S4` y sale por `S5` o `S6` … **Mientras esa sucesión esté en curso,
   ni `S5` ni `S6` se ejecutan**: el pago que entre queda pendiente por `S19` y el reloj no vence
   sobre él (§3.2)»*. La condición que declara es **la sucesión en curso**.
2. `B/03` §3.2, fila `S6`: *«| `S6` | `GRACE_PERIOD` | se agota el reloj | `SUSPENDED` | **no hay un
   pago acreditado del período pendiente de resolución** por `S19` |»*. La condición que declara es
   **el pago pendiente**, que es otra cosa: sin pago, `S6` corre aunque la sucesión esté en curso.
3. La misma sección lo dice una tercera vez y del lado del §3.2: la fila 3 de la tabla de seis
   transiciones es *«| 3 | `GRACE_PERIOD` | `S6` — se agota el reloj, **salvo que haya un pago
   pendiente por `S19`** | `SUSPENDED` | **sí** [sigue siendo fila viva] |»*. Si `S6` no se ejecutara
   durante la sucesión, esa fila no existiría y las transiciones serían cinco.
4. `B/12` §5.3 razona con la versión del §3.2 y la necesita: *«La predecesora arranca la sucesión en
   `GRACE_PERIOD`, pero la ventana dura hasta 72 h y **el reloj del grace la puede pasar a
   `SUSPENDED` por `S6`** antes de que el cobro reciclado entre —es la fila 3 de las seis—. Sobre una
   `SUSPENDED` la reactivación posible ya no es `S5` sino `S7`»*. Toda la justificación de por qué
   `S19` cubre dos estados de origen se cae si `S6` no corre.
5. `S5` está en la misma frase del §4 y ahí la afirmación **sí** es correcta —la condición 3 de
   `B/05` §3 la bloquea durante toda la sucesión—, lo que hace más fácil leer la de `S6` como
   equivalente.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §4, la línea de apertura; §3.2, la fila `S6` y la fila 3 de la tabla
  de seis.
- `B/12-suscripcion.md` §5.3, *«son las dos transiciones, no una»*.

**Severidad.** `MEDIA`. La tabla del §3.2 es la normativa por la regla 1 y dice lo correcto, así que
la implementación tiene de dónde salir bien. Lo que está roto es que el capítulo de Grace —el lugar
donde se busca esto— afirma lo contrario, y su lectura regala hasta 72 h de servicio a un moroso.
No es `ALTA` porque el tope está acotado por la ventana y la dirección del error es visible.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 12**: la línea del §4 y la condición de
`S6` se escribieron en el mismo commit de la familia del pago tardío, con dos redacciones distintas
de la misma regla.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, por la misma razón que `F-8dA2-005`:** el
término redefinido —**`S19`**, *«pago pendiente de resolución»*— aparece en las dos redacciones, y
las dos están **adentro del commit**. El grep mira afuera.

---

### F-8dA2-009 — El dominio de `G-R4` está declarado con tres números distintos y ninguno es el que conté: nueve máquinas, nueve tablas, seis tablas, y hay siete

**Qué se rompe.** El guard que tiene que recorrer las tablas de transiciones no sabe cuántas hay. Su
definición dice *«las nueve máquinas»*, el capítulo que lo cita dice *«las nueve tablas»* y el
catálogo de la otra épica dice *«las **seis** tablas de esta épica»*. Conté los encabezados: hay
**siete** tablas de transiciones en todo el corpus, **cuatro** de ellas en billing. Un guard escrito
contra cualquiera de los tres números o no encuentra lo que busca, o afirma haber recorrido un
dominio que no recorrió — que es lo que `V/20` §2.1 prohíbe en una línea.

**El camino.**

1. `NUCLEO/03` §1 regla 7: *«lo vigila un guard: `G-R4`, sobre **las tablas de transiciones de las
   nueve máquinas**, en las dos épicas»*.
2. `V/03` §2: *«Lo cuenta `G-R4` sobre **las nueve tablas**, no una lectura a mano»*.
3. `B/20` §2: *«lo define `V/20` §2 y cubre **las seis** tablas de esta épica»*.
4. **Conté los encabezados `| # | desde | evento |` con `rg` sobre las dos épicas y el núcleo el
   2026-09-21: siete.** Tres en `V/03` (§2 Trial, §9 Publicación, §11 Postulación) y cuatro en `B/03`
   (§3.2 Suscripción, §6 Pago, §7 Pago manual, §8 Addon).
5. **La diferencia no es un error de conteo: es que dos de las nueve máquinas no tienen tabla**, y el
   núcleo lo declara. `NUCLEO/03` §1 regla 6: *«**Grace y Pause no son máquinas independientes** …
   Son sub-estados de Suscripción **con reloj propio y datos propios**»*. `B/03` §4 y §5 las
   describen con tablas de dos columnas (`cuándo entra`, `cuánto dura`, …), sin `desde` ni `evento`.
   Nueve máquinas, siete tablas.
6. El *«seis»* de `B/20` es el conteo de **máquinas** de esa mitad (Suscripción, Grace, Pausa, Pago,
   Pago manual, Addon) aplicado a la palabra *«tablas»*. Su dominio real es cuatro.
7. Y queda un sujeto sin clasificar que el arreglo 18 volvió relevante: la tabla del espejo de `B/03`
   §10.1, que **no** tiene encabezado de transición y sin embargo el § declara que sus filas *«son
   transiciones declaradas de esta tabla»*. No la conté como tabla de transiciones; si `G-R4` la
   cuenta, el número cambia otra vez.

**Dónde lo permite el diseño.**

- `NUCLEO/03-maquinas-de-estado.md` §1, reglas 6 y 7.
- `V/03-maquinas-de-estado.md` §2, *«las nueve tablas»*; §9 y §11, las otras dos tablas.
- `B/20-testing.md` §2, *«las seis tablas de esta épica»*.
- `V/20-testing.md` §2, la fila de `G-R4` (*«sobre las nueve máquinas»*) y §2.1.
- `B/03-maquinas-de-estado.md` §4 y §5 (sin tabla de transiciones); §10.1.

**Severidad.** `MEDIA`. Es un conteo y la corrección es una línea, pero es **el conteo con el que se
escribe el predicado de un guard**, y el corpus ya tiene el precedente de que un número congelado
parte una lista en dos (`F-8cA2-008`). No es `ALTA` porque las cuatro tablas de billing son las
cuatro que existen: un guard que las recorra todas no deja nada afuera aunque su enunciado diga seis.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 3, que es el que creó `G-R4`**, y lo
propagó el mismo arreglo con tres redacciones en tres capítulos. Antes de la 9-bis-2 no había guard
que necesitara conocer el número.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término nuevo es **`G-R4`** y la
cadena *«las nueve máquinas»* / *«las nueve tablas»*: las tres redacciones se escribieron en la misma
tanda, pero `V/03` §2 y `B/20` §2 son capítulos distintos del que define el guard, y un `rg 'G-R4'`
sobre el corpus devuelve los cuatro sitios en una corrida. La tercera obligación de `DEC-METH-009`
—*«cada aparición se resuelve»*— es exactamente la que faltó: las apariciones se escribieron, no se
compararon entre sí.

---

### F-8dA2-010 — `B/02` §2.2 sigue diciendo «cuatro de estos seis no emiten ninguna fuente» y `NUCLEO/01` §2.4 contó tres, en el párrafo que lo cita

**Qué se rompe.** El párrafo que define las filas vivas —y que remite al glosario como su
autoridad— contradice al glosario en el número que decide si un consumidor puede usar un conjunto
como proxy del otro. Y lo hace **en la misma cita**: el bloque de `B/02` §2.2 nombra a
`NUCLEO/01` §2.4 y en la línea siguiente da otro número.

**El camino.**

1. `B/02` §2.2, bloque de cita: *«Éste es el conjunto que `NUCLEO/01` §2.4 llama «fila viva» … La
   otra —**«fuente viva»**— es la del contrato de cobertura, y **no coinciden**: **cuatro de estos
   seis no emiten ninguna fuente** (`12-contrato…` §2.6)»*.
2. `NUCLEO/01` §2.4: *«De las **seis** filas vivas, **tres no emiten ninguna fuente**:
   `PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED` cuando el motivo es `CUSTOMER_REQUEST`. Y la
   cuarta discrepancia es de otra forma: `PAUSED` por `COURTESY` **sí** emite, pero con `tipo:
   CORTESÍA`»*.
3. La tabla del `12-contrato…` §2.6 lo resuelve y le da la razón al glosario: de los seis vivos,
   `PAUSED` por `COURTESY` emite (*«**sí**, como `tipo: CORTESÍA`»*). Tres no emiten.
4. `V/03` §2 también cuenta tres —*«Los otros tres son los que valen la pena mirar, y son
   `PENDING_AUTHORIZATION`, `PAUSED` por `CUSTOMER_REQUEST` y `SUSPENDED`»*—, que es sobre lo que se
   apoya `DEC-TRIAL-008`. Así que el corpus tiene **un** capítulo con el número viejo y tres con el
   nuevo.
5. La diferencia no es cosmética para quien lee `B/02`: si `PAUSED` por `COURTESY` no emitiera,
   `cubierto` sería falso durante una cortesía y `PB2` bajaría las fichas de alguien a quien
   `DEC-GRANT-003` le sostiene el servicio a propósito.

**Dónde lo permite el diseño.**

- `B/02-modelo-de-datos.md` §2.2, el bloque de cita (línea 136 del archivo).
- `NUCLEO/01-glosario.md` §2.4, el párrafo *«los dos conjuntos no coinciden»* (línea 240).
- `12-contrato-de-cobertura.md` §2.6, la tabla de los nueve estados.
- `V/03-maquinas-de-estado.md` §2, *«Consecuencia declarada»*.

**Severidad.** `MEDIA`. Ningún mecanismo lee el número —lee la tabla del §2.6—, así que el daño es de
lectura. Lo reporto porque es el número con el que un implementador decide si puede usar *«fila
viva»* como proxy de *«fuente viva»*, que es el error que el corpus declara haber pagado con **dos
críticos opuestos** sobre la misma transición.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo de la familia del trial que escribió
`NUCLEO/01` §2.4.** El *«cuatro»* de `B/02` era correcto bajo la lectura anterior, en la que
`PAUSED` se contaba entero; el §2.4 lo desagregó en *«tres que no emiten + uno que emite otra cosa»*
y no corrigió el sitio que lo cita.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y la aparición se tocó sin resolverse.**
El término redefinido es **«fila viva»**, y `B/02` §2.2 no sólo lo contiene: **la cita a
`NUCLEO/01` §2.4 se agregó en ese mismo párrafo**, o sea que alguien llegó ahí siguiendo el término
y editó el bloque. Lo que no se hizo es el tercer paso —*«cada aparición se resuelve»*—: se actualizó
la referencia y se dejó el número viejo dos líneas abajo. Es la misma forma que `F-8dA2-001`: el
grep llegó, la resolución quedó a medias.

---

### BAJA

### F-8dA2-011 — `V/18` §1.5 sostiene que Partner está a salvo porque «la transición `T1` no puede ocurrir», y desde el arreglo 2 son dos las transiciones que habría que descartar

**Qué se rompe.** La única garantía escrita de que a un Partner no se le queme el trial nombra
**una** de las dos transiciones que salen de `PRE_TRIAL`. La garantía sigue siendo cierta —lo
verifiqué contra el texto—, pero está argumentada sobre la mitad del dominio, y es el capítulo que
un implementador de Partner va a leer.

**El camino.**

1. `V/18` §1.5: *«*«Máximo una ficha durante trial»*no alcanza a Partner por una razón anterior:
   **Partner no tiene trial.** Sus planes lo tienen en cero (`DEC-TRIAL-003`) y no declara evento de
   activación (`DEC-TRIAL-006`), así que **la transición `T1` no puede ocurrir**»*.
2. Desde el arreglo 2, `T1` **no es la única** salida de `PRE_TRIAL`: `T6` comparte `desde` y evento
   (`V/03` §2), y su efecto —*«crea la fila de `trial`, **consumida**»*— es el que le quema el trial a
   alguien para siempre.
3. **La garantía se sostiene igual**, por dos razones que el corpus escribe en otro lado: `V/03` §2
   dice que *«`T6` comparte el evento con `T1`»* y `V/02` §2.1 remacha *«Partner … **ningún evento
   declarado** … y por lo tanto **ninguna de las dos transiciones dispara ahí**»*. O sea que la
   afirmación correcta existe — en dos capítulos que no son el de Partner.
4. Lo que queda roto es la forma del argumento: el §1.5 razona por enumeración de transiciones y su
   enumeración quedó corta, que es el patrón que la propia 9-bis-2 corrigió tres veces (`PB2`, `PB3`,
   `B/16` §4.3). Y se compone con `F-8dA2-002`: Partner es exactamente la vertical del tercer renglón.

**Dónde lo permite el diseño.**

- `V/18-partner.md` §1.5.
- `V/03-maquinas-de-estado.md` §2, `T6` y el párrafo del par.
- `V/02-modelo-de-datos.md` §2.1, *«ninguna de las dos transiciones dispara ahí»*.

**Severidad.** `BAJA`. La conclusión es correcta hoy y está sostenida por dos capítulos más. Lo
reporto porque es una razón caduca debajo de una conclusión correcta, que es la clase de defecto que
ningún guard mira y que se vuelve falso el día que Partner declare su evento — el día que
`DEC-TRIAL-003` planifica.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2**, que agregó `T6` a la tabla y no
recorrió los capítulos que razonaban sobre `T1` como la única salida de `PRE_TRIAL`.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término nuevo es **`T6`**, y un
`rg 'T1'` sobre los capítulos que el commit no toca devuelve `V/18` §1.5 en la primera corrida. Es
la búsqueda inversa a la obvia —se busca el término **viejo** para encontrar a quien razona sin el
nuevo— y `DEC-METH-009` pide buscar el redefinido, no el que se queda corto. La variante que sirve
acá es *«y su complemento»*.

---

## 2. Hallazgos anteriores que siguen llegando sobre el texto nuevo

No cuentan como hallazgos nuevos (§4 de las instrucciones). Sólo los que **siguen llegando** y
cambiaron de forma con la 9-bis-2.

| ID | veredicto | en qué paso llega ahora |
|---|---|---|
| `F-8cA2-001` | **RETIRADO por `DEC-MIG-004`** | No lo reporto: la población de producción es del owner y está cerrada. Lo anoto sólo porque el mecanismo que lo producía —`PB2` no dispara sin un valor anterior— **sigue vivo fuera del corte**, y es lo que hace que `F-8dA2-004` termine en `UNPUBLISHED_BY_BILLING` y no en algo peor. |
| `F-8cA2-002` | **CORTA** | **paso 4**. El arreglo 2 lo cerró: `T6` ya no lee *«una suscripción viva»* sino `cubierto`, y los cuatro estados que no emiten mandan a `T1`. `DEC-TRIAL-008` declara el precio. **El daño vuelve por otro extremo**, y es `F-8dA2-002`: no por quemar el trial de quien no tiene nada, sino por regalárselo a quien ya fue cliente. |
| `F-8cA2-003` | **CORTA** | **paso 4**. El arreglo 12 corrigió el sujeto —*«la **predecesora** … la fila que **tiene** una sucesora»*— y lo bajó a la tabla en tres escrituras (`S5`, `S7`, `S19`). La forma del defecto **reaparece un nivel abajo**: la regla del reembolso volvió a quedar sólo en la prosa (`F-8dA2-001`). |
| `F-8cA2-004` | **SIGUE** | **paso 2**. La tabla del espejo sigue con **ocho** filas sobre los mismos 40 pares; el arreglo 12 le agregó una salvedad a una fila (`authorized` × `GRACE_PERIOD`·`SUSPENDED`) y no agregó pares. Se suma `F-8dA2-003`: una de las ocho que sí están no nombra transición. |
| `F-8cA2-005` | **CORTA** | **paso 2**. `T1` y `T6` son disjuntas por construcción sobre `cubierto`, y la regla 7 del núcleo lo exige en general. Lo que queda es el conteo del guard (`F-8dA2-006`). |
| `F-8cA2-006` | **SIGUE** | **paso 3**. **Ningún documento dice qué estados de la instancia de addon emiten fuente.** Lo verifiqué otra vez: el mapa del `12-contrato…` §2.6 sigue titulado *«de la suscripción»* y sus filas siguen siendo los nueve de `B/03` §3.1. `A1` (`PENDING_AUTHORIZATION` de addon) sigue sin respuesta. |
| `F-8cA2-007` | **SIGUE, y ahora alcanza a los addons** | **paso 5**. `S17` sigue cancelando contra una autorización que `D8` garantiza que no cobró. Lo nuevo es el arreglo 10: `S18` **re-apunta los complementos a la sucesora**, así que cuando el primer cobro de la sucesora se rechaza (`S16`), los addons —ya colgados de ella— quedan huérfanos por `B/16` §4.2 y se les cancela el preapproval, que `PA-5` mide irreversible. El arreglo que salvó los addons del upgrade se los entrega al `CHARGE_DECLINED` siguiente. |
| `F-8cA2-009` | **SIGUE** | **paso 2**. Ninguna de las **siete** tablas de transiciones ganó columna de clase de actor; conté los encabezados. `S17`, `S18`, `S19` y los ocho espejos siguen sin declarar clase, y `V/17` §3.4 sigue cubriendo sólo *«las disparadas por el reloj»*. |
| `F-8cA2-011` | **SIGUE** | **paso 3**. El reloj de la marca sigue sin ser transición, sin actor y sin destino para *«escala»*. Y ahora le cuelga un caso más: la marca que `B/12` §5.3 pone al cerrar la sucesión, que nadie escribe (`F-8dA2-001`). |
| `F-8cA2-014` | **SIGUE, con plata** | **paso 2**. La exención de terminales del cap. 09 se acotó **para la instancia de addon** y la lápida sigue siendo una `subscription` en `CANCELLED`. La misma exención es la que deja colgado el pago pendiente de `F-8dA2-001`: el arreglo llegó al § correcto y se detuvo en la primera de las dos poblaciones. |
| `F-8bA2-005` · `F-8bA2-006` · `F-8bA2-007` · `F-8A2-005` · `F-8A2-013` · `F-8A2-017` | **SIGUEN** | Sin cambio respecto de la 8-bis-2. Verifiqué los tres conteos que los sostienen: cero columnas de clase en las siete tablas, ningún barrido de verticales que compare publicación contra cobertura, y `G5` sigue comprobándose *«sobre los efectos declarados de las transiciones del capítulo 03»*. |

---

## 3. Ataques que intenté y el diseño resistió

1. **Publicar gratis para siempre estando en `TRIAL_EXPIRED`.** Era el ataque más prometedor:
   `PB1` (*«el dueño publica»*) **no tiene ninguna condición de cobertura** en `V/03` §9, y `PB2`
   exige que `cubierto` **pase** a falso — sobre alguien que ya lo tiene en falso no hay cambio que
   disparar, así que la ficha quedaría publicada sin cobertura y sin nadie que la baje (no existe
   barrido, `F-8A2-005`). **Lo cierra el catálogo, no la máquina**: `V/02` §2.1 declara que la
   versión de piso otorga *«ninguna capacidad comercial, y la de contratar una suscripción»*, y que
   **la capacidad de activación vive sólo en la versión de pre-trial**, con su *«si y sólo si»*. Un
   `TRIAL_EXPIRED` resuelve contra el piso y el paso 6 lo frena. El guard `G-R3` vigila las dos
   versiones y la propia condición. La defensa está donde dice que está.
2. **Conseguir dos trials encadenando `T6` y `T1`.** Cerrado en tres niveles, igual que la vuelta
   anterior, y el arreglo 2 no abrió ninguno: las dos salen de `PRE_TRIAL`, ninguna transición
   vuelve ahí, y `V/02` §2.2 hace la fila única de por vida por `user` y por hash de correo.
3. **Hacer que `T1` y `T6` dispararan las dos.** Imposible por construcción: piden el mismo catálogo
   y difieren en el valor de un booleano. Recorrí el dominio entero —dos valores de `cubierto` ×
   dos de la mitad de catálogo— y los tres renglones del capítulo lo cubren. Lo que encontré no es un
   solapamiento sino **qué pasa cuando el catálogo cambia** (`F-8dA2-002`).
4. **Quedarme con dos autorizaciones cobrando después de un cambio de plan.** Cerrado y bien
   argumentado: `S17` cancela con relectura previa (`PA-5`), `S18` cierra con las dos escrituras
   inseparables y `G-R1-C` las vigila en las dos direcciones. La única rama que deja dos vivas es la
   cancelación fallida, **declarada, con marca y con una persona mirándola**, y su costo de cobertura
   está escrito en `12-contrato…` §2.6. Es el mejor recorrido de dominio del corpus.
5. **Reactivar la predecesora con el cobro reciclado.** Cerrado en la tabla y no sólo en la prosa,
   que era el defecto de la vuelta anterior: la condición está en `S5`, en `S7` y en la condición 3
   de `B/05` §3, `S19` declara qué sí pasa, y `G-R1-D` vigila los tres call sites con su caso de
   ruptura. Lo que falla no es el bloqueo sino **el destino del pago retenido** (`F-8dA2-001`).
6. **Dejar el pago de `S19` colgado para siempre.** Lo intenté por las cuatro ramas y **tres están
   cubiertas**: el backstop de `B/09` §3 las levanta en la rama del abandono y en la trabada, y
   `DEC-GRANT-001` exime la del grant. Sólo la primera se me escapó, y no por falta de mecanismo sino
   porque el mecanismo no barre `CANCELLED`. El diseño **sí** anticipó el riesgo: escribió la
   comprobación *«el pago pendiente cuya sucesión ya terminó»* con el argumento exacto (*«un pago
   retenido para siempre, que del lado del cliente se lee como un cobro sin servicio y sin
   devolución»*). Le faltó una población.
7. **Hacer que `S19` se disparara sobre una `CANCEL_SCHEDULED` para retener un pago que nadie espera.**
   No hay sujeto: `S11` cancela el preapproval *«de inmediato»*, así que no queda cuota en
   `recycling` que pueda entrar, y `S19` declara su `desde` en dos estados. El razonamiento está
   escrito en `B/03` §3.3.
8. **Encadenar sucesiones o suceder una fila marcada.** Cortado por la base sin regla extra (el
   candado `B` indexado sobre `user + vertical`) y por la marca, cuya única excepción
   —`CANCEL_SCHEDULED`— **lleva relectura obligatoria por id** con su razón escrita. Sin cambios
   respecto de la vuelta anterior, y sigue siendo correcto.
9. **Colar una transición que la tabla no declara por la puerta del espejo.** Sigue cerrada como
   decisión —se enumeró en vez de declarar una excepción a la regla 1— y la forma es la correcta. Lo
   que falla es una fila concreta de la enumeración (`F-8dA2-003`), no el mecanismo.
10. **Cancelarle los addons a alguien en pleno upgrade.** Cerrado por el arreglo 10 y es un buen
    arreglo: `B/16` §4.2 lee **las dos columnas** —`sucedida_por` para después del cierre, una fila
    viva con `sucede_a` para durante—, con el argumento de por qué cada mitad sola falla en la
    dirección contraria. Recorrí los tres estados de la relación y no encontré un cuarto. Lo que sí
    encontré es que el re-apunte los expone al `S16` de la sucesora, y eso es `F-8cA2-007`
    agrandado, no un hueco de este arreglo.
11. **Quemarle el trial a toda la base de Partner con `T6`.** Falla cerrado y por dato, igual que la
    vuelta anterior: la mitad de catálogo que el arreglo 3 le agregó a `T6` exige días `> 0`, y
    Partner los tiene en cero. **El arreglo 3 es correcto y cierra lo que dice cerrar.** El defecto
    que encontré está del otro lado de la misma puerta: no en consumir el trial antes de tiempo sino
    en **no haberlo consumido nunca** cuando la puerta se abra (`F-8dA2-002`).
12. **Usar `S15` para resolver una conciliación saltando a un estado arbitrario, ahora que hay 19
    filas.** Recorrí las cinco nuevas y no hay ninguna alcanzable sólo por ahí: `S15` *«no mueve la
    columna de estado»* y el cambio, si corresponde, se ejecuta con una transición de la misma tabla.
    `S18` explícitamente lo admite como su segundo disparador (*«o una resolución de `S15` sobre la
    sucesión trabada»*), que es la forma correcta: un estado que se puede volver a evaluar, no una
    entrega que no se repite.

---

## 4. Fuera de mi vector

Anotado y no perseguido.

1. **`NUCLEO`** — `NUCLEO/03` §1 regla 7 enuncia la regla sobre *«dos filas que comparten `(desde,
   evento)`»* y su tabla enumera sólo *«los pares con dos filas **y dos destinos distintos**»*. Hoy
   no hay ningún par con el mismo destino y guardas solapadas —lo verifiqué sobre las 19 filas de
   `B/03` §3.2 y las 6 de `V/03` §2—, así que es dominio sin sujeto. **Pasada C.**
2. **`NUCLEO`** — `NUCLEO/04` §3 da a `D11` (*«lo que toca plata lo confirma una persona»*) el apoyo
   **servicio**, sin base ni guard, y `DEC-RF-002` acaba de apoyar en él el reembolso del pago
   pendiente. El invariante que sostiene la decisión nueva es el único de los tres niveles que no
   tiene mecanismo. **Pasada C.**
3. **`NUCLEO`** — `NUCLEO/08` §3 declara que *«no hay ninguna operación automática sobre dinero»* y
   el catálogo de acciones administrativas **no tiene una fila para «resolver un pago pendiente de
   una sucesión»**: la fila *«reembolsar»* existe, pero nada dice quién le pone el caso adelante a
   esa persona. Es la mitad de proceso de `F-8dA2-001`. **Pasada C.**
4. **Contrato (`C1`)** — `12-contrato…` §2.6 afirma en un párrafo que la predecesora *«sigue
   cubriendo»* durante la ventana y mide en otro que *«no emite en cinco de los seis casos»*. Lo
   reporto como `F-8dA2-004` porque el daño es de máquina; la contradicción interna del contrato es
   de la costura.
5. **Addons (`B1`/`B2`)** — `F-8cA2-006` sigue llegando y el arreglo 6 lo rozó sin cerrarlo:
   aclaró **qué referencia** transporta una fuente `ADDON` (la de la instancia, no la del producto)
   y no **cuándo** la transporta. Los cinco estados de la instancia siguen sin mapa de emisión.
6. **Doble cobro (`B1`)** — `F-8dA2-001` y `F-8dA2-005` son daños de plata y los reporto porque el
   defecto es de máquina: un efecto que ninguna transición declara y un evento que no cubre a su
   propio consumidor. La cuantificación es de la pasada B.
7. **Método (`C1`)** — de los once hallazgos, **dos son contradicciones internas a un mismo commit**
   (`F-8dA2-005` y `F-8dA2-008`) y **uno vive entre dos párrafos de la misma sección que el commit
   escribió** (`F-8dA2-004`). `DEC-METH-009` busca afuera del commit por construcción, así que esa
   clase le es invisible. Si la regla se amplía, la ampliación barata es **leer entero el § que se
   toca**, no un grep más.
