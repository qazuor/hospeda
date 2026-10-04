---
title: "FASE 8-bis-4 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# B3 · conciliación, datos y migración — cuarta vuelta

**Vector**: lo que el barrido ve y lo que no, lo que la base guarda y lo que no, y el corte.
**Material**: `B/02`, `B/03` (§3.2, §7, §8, §10.1), `B/05`, `B/06` §7, `B/09`, `B/12` §5.3,
`B/14` §4.4, `B/16` §3.4 y §4.2-4.4, `B/20` §2, `B/21`, `NUCLEO/01` §2.4, `NUCLEO/03` §1,
`NUCLEO/04`, `12-contrato…` §2.8.

**Cómo se recorrió.** La vuelta anterior midió que **4 de mis 5 críticos** eran del modo *«la
ausencia»*: el término no aparece donde el defecto vive porque el defecto **es** que no aparece.
Así que esta vuelta se recorrió al revés, por **consumidor y no por término**: para cada
predicado nuevo del cap. 09 se preguntó *«¿contra qué columna se evalúa esto?»*, y para cada
efecto nuevo *«¿qué fila de qué tabla lo ejecuta?»*. Los cuatro ejes:

| eje | tamaño del dominio | recorrido | resultado |
|---|---|---|---|
| las **puertas a un estado terminal** de la tabla de `B/09` §3 | **9** — `S16`, el espejo, `S17`, `S12`, `S3`, `S13`, `S20`, `S21` y la lápida, contadas por mí sobre la tabla de hoy | 9 de 9 | **3 exentas y 6 no, y la aritmética cierra** (5 vuelven por la salvedad 4, `S21` por la 1). Lo que no cierra es **el par con que una vuelta termina** — `F-8eB3-005` |
| los **predicados de las cuatro comprobaciones de cero llamadas** × la columna contra la que se evalúa cada término | **11 términos** (`sucede_a`, fila viva, predecesora, pago pendiente, ancla viva, fila viva principal, fila viva de complemento, compatible con V, `includesAddons`, condición de orfandad, grant vivo) | 11 de 11 | **2 no tienen columna**: *«ancla viva»* y *«grant vivo»* — `F-8eB3-002`. Un tercero, *«pendiente de resolución»*, sigue sin tenerla (§2) |
| los **efectos declarados de `S18`** × la tabla que ejecuta cada uno | **4 escrituras, la tercera sobre 3 entidades** (`B/02` §2.6) | 6 de 6 | **una no tiene transición que la ejecute**: la pausa que la cortesía re-apuntada necesita — `F-8eB3-001` |
| el **`desde` de `S20`** contra el **predicado de la 3ª comprobación**, cláusula por cláusula | **4 cláusulas** (clase, instancia viva, compatibilidad del producto, objetivo de esa vertical) | 4 de 4 | **el detector es más ancho que la transición en la 4ª cláusula** — `F-8eB3-004` |

**Conteo de este informe** (contado sobre los `###` de la sección 1, no estimado):

| | |
|---|---|
| hallazgos nuevos | **9** |
| `CRITICA` | **3** |
| `ALTA` | **3** |
| `MEDIA` | **2** |
| `BAJA` | **1** |
| **atribuidos a un arreglo o a una decisión de la 9-bis-3** | **8 de 9** · **3 de 3** entre los `CRITICA` |
| de esos, **que el grep de `DEC-METH-009`/`010` habría encontrado** | **0 de 8** |
| de esos, **que la resolución POR APARICIÓN de `DEC-METH-010` habría atrapado** | **0 de 8** |
| **del modo «la ausencia»** | **6 de 9** · **3 de 3** entre los `CRITICA` |

**Números que cito y no medí yo**: los cuatro estados de preapproval salen de `RC-1`; los 26-44
minutos del primer cobro, de `PA-3` (`B/12` §4.3); la cancelación terminal del milisegundo, de
`B/12` §4.4; `EX-1` en `UNKNOWN`, de `B/06` §6; `EX-11`, `EX-15`, `EX-20`, `PA-5` de la matriz.
Las **nueve puertas**, las **cuatro salvedades**, las **cuatro comprobaciones** y los **20
consumidores** del inventario de `NUCLEO/01` §2.4 los conté yo sobre el texto de hoy.

**Límite respetado.** `DEC-MIG-004` cerró la población de producción y **este informe no la toca
por ningún ángulo**. El único hallazgo que roza el corte (`F-8eB3-007`) es sobre **la forma de la
fila lápida**, que `B/21` §2.5 generaliza con todas las letras a *«cualquier escritura manual
futura»* — no sobre las ocho filas, ni sobre su orden, ni sobre la cohorte.

---

## 1. Hallazgos

### F-8eB3-001 — La pausa que la cortesía re-apuntada necesita sobre la sucesora no tiene transición que la ejecute: `S18` va «al mismo estado» y el único evento que lleva a `PAUSED · COURTESY` es otro, así que el beneficiario paga todos los meses de la cortesía que le firmó `SUPER_ADMIN`

**Qué se rompe.** El cliente al que `SUPER_ADMIN` le regaló tres meses cambia de plan en el mes
uno. La cortesía se re-apunta a la sucesora, la sucesora sigue `ACTIVE` con su preapproval
autorizado, **y le cobran los dos meses que le habían regalado**. El propio capítulo lo escribe
como el desenlace que hay que impedir: *«Una cortesía re-apuntada sobre una fila `ACTIVE` que
sigue cobrando **no es una cortesía**: es una fila de base que no hace nada»* (`B/14` §4.4).

**El camino.**

1. `S18` re-apunta la cortesía. Es uno de sus cuatro efectos: *«todo lo que colgaba de la
   predecesora se re-apunta a la SUCESORA —los **complementos** …, la **redención de promo** … y
   la **cortesía vigente** (`B/14` §4.4), con el inventario completo en `B/02` §2.6»* (`B/03`
   §3.2).
2. **Y el re-apunte solo no alcanza, y los dos capítulos lo dicen.** `B/02` §2.6: *«se re-apunta
   a la sucesora, y la sucesora **queda pausada con motivo `COURTESY` por los días que
   quedaban**»*. `B/14` §4.4: *«el mecanismo de la cortesía **es** la pausa … así que la sucesora
   **queda pausada con motivo `COURTESY`** por los días que le quedaban, contados desde el
   cierre»*.
3. **`S18` no puede pausar a nadie: su columna `hacia` dice *«el mismo estado»***. Recorrí la fila
   entera de `S18` en `B/03` §3.2: `desde` = *«la sucesora viva»*, `hacia` = ***«el mismo
   estado»***. Un acto cuyo estado de llegada es el de partida no mueve la columna de estado de
   nadie, y la sucesora llega a `S18` en `ACTIVE` (o en `PENDING_AUTHORIZATION`).
4. **Y la única fila que lleva a `PAUSED` con motivo `COURTESY` tiene OTRO evento.** `S9`:
   *«`ACTIVE` | **`SUPER_ADMIN` otorga cortesía** | `PAUSED` *(motivo `COURTESY`)* | no hay pausa
   vigente (`DEC-GRANT-004`) | se pausa en el proveedor …»* (`B/03` §3.2). Cerrar una sucesión
   **no es** *«`SUPER_ADMIN` otorga cortesía»*: la cortesía ya estaba otorgada, y el acto que
   corre es `S18`. Recorrí las **21 filas** de la tabla del §3.2 y **`S9` es la única** que
   aterriza en `PAUSED · COURTESY`.
5. **Por la regla 1 del núcleo, entonces, la pausa no pasa**: *«La tabla de transiciones es
   exhaustiva. Lo que no está, no pasa»* (`NUCLEO/03` §1). Y no es una lectura forzada: es
   exactamente el argumento con el que esta misma tanda creó `S21` —*«la escritura es sobre la
   columna de estado de una **suscripción** … un efecto de la tabla de addon que moviera esa
   columna es exactamente lo que la regla 1 del núcleo no admite»* (`B/03` §3.2)—. Acá el sujeto
   escrito es el mismo (una suscripción) y el acto que lo escribiría (`S18`) declara no moverlo.
6. Queda la cortesía apuntando a una sucesora `ACTIVE`, que **cobra**. Y no hay detector: **el
   barrido no compara grants** (lo dice `B/14` §4.4 con esas palabras), las cuatro comprobaciones
   de cero llamadas miran `sucede_a`, el pago pendiente, las anclas y las instancias de addon
   —ninguna mira `courtesy_grant`—, y las cinco comparaciones de campo ven `ACTIVE` contra
   `authorized`, que **coincide**.
7. **El desenlace lo escribe el mismo §, para el caso que `S18` vino a cerrar**: *«El beneficio
   que firmó `SUPER_ADMIN` desaparece **en silencio** … y el cliente se entera cuando le cobran»*
   (`B/14` §4.4). El arreglo movió el silencio de un lugar a otro: antes la columna quedaba
   apuntando a una `CANCELLED`; ahora apunta a una fila que cobra.

**Dónde lo permite el diseño.** `B/03` §3.2 (la fila de `S18`, columna `hacia`; la fila de `S9`,
columna evento) contra `B/02` §2.6 (fila de la cortesía) y `B/14` §4.4. `NUCLEO/03` §1 regla 1.

**Y hay una segunda mitad que el mismo § deja abierta, cualquiera sea la que se elija.** `B/14`
§4.4 sostiene que *«`S18` siempre corre sobre una sucesora ya `ACTIVE` … porque **una predecesora
con cortesía vigente está `PAUSED`**»*. Esa premisa se lee de dos maneras y las dos cierran mal:

- **Si es verdadera**, entonces **la población entera de esta fila es vacía**: desde `PAUSED`
  *«el cambio de plan NO se ofrece»* —*«reanudá tu suscripción para cambiar de plan»*, `B/03`
  §3.3.1— y `G-R1-A` sólo deja declarar una sucesión desde `{ACTIVE, GRACE_PERIOD,
  CANCEL_SCHEDULED}` (`B/20` §2). Nunca hay una sucesión con cortesía vigente en la predecesora,
  y `B/02` §2.6 enumera como uno de sus tres re-apuntes algo que no puede ocurrir.
- **Si es falsa** —`S10` deja volver *«antes»* del fin, así que una cortesía con `fin` futuro
  puede convivir con una fila `ACTIVE`—, entonces la sucesora **sí** puede estar en
  `PENDING_AUTHORIZATION` cuando `S18` cierra por `S12`/`S16`/el espejo, y la pausa habría que
  aplicarla sobre un preapproval que todavía no autorizó — el caso que §4.4 declara inexistente.

**Severidad.** `CRITICA`. El beneficiario de una concesión firmada por `SUPER_ADMIN` **paga los
meses que le regalaron**, y el único mecanismo que el diseño declara para lo que diverge en
silencio tiene escrito que no mira esa entidad.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 7** de la 9-bis-3 (`f4edbdfdf`: *«el tercer
efecto de `S18` alcanza TRES entidades; `B/02` gana el §2.6»*). Antes de ese arreglo `S18`
nombraba **sólo los complementos**, cuyo re-apunte es una escritura de puntero y nada más. Al
sumar la cortesía, el efecto pasó a incluir **un cambio de estado** —y el arreglo lo escribió en
la prosa de dos capítulos sin darle fila a la única escritura que la tabla exige declarar.

**¿Lo habría encontrado el grep?** **No, ni con el término nuevo ni con el viejo.** El término
nuevo es *«cortesía vigente»* y el viejo es *«el re-apunte del complemento»*. `f4edbdfdf` toca
`B/03`, `B/02` y `B/14`, que son **los tres capítulos donde el término aparece**; grepearlo sobre
los que el commit **no** toca devuelve cero. Y el defecto es una **ausencia**: la fila que falta
en la tabla del §3.2 no contiene la palabra *«cortesía»*, porque no existe.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La obligación 2 manda escribir el
rastro *«por aparición no corregida, en un párrafo que el commit no tocó»*. Acá **no hay
aparición**: lo que falta es una fila en una tabla, y una fila inexistente no es una aparición de
ningún término. Es el límite estructural que mi informe anterior nombró y que la enmienda no
cambia: **`DEC-METH-010` recorre apariciones y este defecto es un hueco.** Lo que sí lo habría
atrapado es la obligación **4** —la lista de consumidores— aplicada al revés: *«¿qué transición
ejecuta cada uno de los cuatro efectos de `S18`?»*, que es una tabla de cuatro filas.

---

### F-8eB3-002 — `NUCLEO` · «Ancla viva» y «grant vivo» son el predicado de las comprobaciones 3 y 4 y el modelo no tiene dónde escribirlos: `permanent_grant` no declara ni estado ni revocación, así que los dos únicos detectores del fan-out de `S13`/`S20` no se pueden evaluar

**Qué se rompe.** Las dos comprobaciones que esta tanda agregó para ver *«lo que el diseño declara
indetectable»* —el beneficiario que sigue pagando una vertical que el grant le regaló, y el addon
cuyo título se revocó y nadie apagó— **se condicionan sobre si un grant sigue vivo**, y la base no
tiene ninguna columna que conteste eso. Los detectores no existen, y lo que detectaban es que
alguien paga todos los meses algo declarado gratis.

**El camino.**

1. **La tercera comprobación** arranca por ahí: *«Si un beneficiario tiene un **ancla viva** en la
   vertical V (`permanent_grant_vertical`, `B/02` §2.4) y además **una de estas dos cosas**, el
   fan-out no terminó de correr y se pone la **marca**»* (`B/09` §3). Sin *«ancla viva»* el
   predicado no arranca.
2. **La cuarta lleva el mismo término con otro nombre**: *«… y su objetivo **ya cumple la
   condición de orfandad del `B/16` §4.2**, **o el ancla que era su título ya no es la de un grant
   vivo**, `A5` no corrió: se pone la marca»* (`B/09` §3). Y su recuadro insiste en que eso es
   barato: *«que el grant del ancla siga vivo es **un dato de nuestra base**»*.
3. **Y la tercera mitad de la orfandad, que las dos delegan, también**: *«**ningún grant
   permanente la releva**: no hay en esa vertical **un grant vivo** que valga como título»*
   (`B/16` §4.2).
4. **Ese dato no está en la base.** `B/02` §2.4, fila completa: *«**`permanent_grant`** |
   beneficiario, `includesAddons`, quién lo firmó, motivo, suscripciones afectadas (§35.4). **El
   scope de verticales NO es una columna: son sus anclas** | ídem; **al menos un ancla**, o el
   grant no otorga nada»*. **No hay estado, no hay `revocado_en`, no hay ventana.** Y la fila del
   ancla tampoco: *«**`permanent_grant_vertical`** | **el ancla, una por vertical del scope**: el
   grant, la vertical, el `plan` que otorga en esa vertical y el piso del trinquete»*.
5. **Y no está en ningún otro lado, porque el instrumento no vence.** `NUCLEO/01` §1.5: *«el grant
   la firma `SUPER_ADMIN` y **no vence**»*, contra la cortesía, que *«vence»* y **sí** guarda
   *«días o meses, inicio, fin»* (`B/02` §2.4). Un instrumento que sólo termina por revocación y
   no guarda la revocación **no tiene forma de dejar de estar vivo**. Lo verifiqué:
   `rg -n "grant vivo|anclas? viva"` sobre las dos épicas y el núcleo devuelve **cuatro
   apariciones de *«ancla viva»*** (`B/09` ×2, `B/03` §3.2, `NUCLEO/01` §2.4) y **tres de *«grant
   vivo»*** (`B/09`, `B/16` §4.2, y `S13` como *«uno vivo»*), **y ninguna definición**.
6. **La revocación existe como ACTO y no como estado.** `NUCLEO/08` §3 la declara *«la acción
   administrativa más grave»*, `B/03` §8 la usa como **evento** de la tercera cláusula de `A5`, y
   `12-contrato…` §2.8 dice que *«retira todas las anclas del instrumento de una vez»*. Un evento
   sirve para disparar `A5` en el acto; **no sirve para un predicado que se evalúa después**, que
   es lo único que hacen las comprobaciones del barrido —*«es un **backstop**, no el
   disparador … existe para la corrida en que ninguno se ejecutó»* (`B/09` §3)—.
7. **Y *«retira las anclas»* tiene dos lecturas y las dos rompen algo.** Si retirar es **borrar**
   la fila de `permanent_grant_vertical`, entonces `addon_instance.ancla_del_grant` —que *«apunta
   a `permanent_grant_vertical`»* (`B/02` §2.4)— queda apuntando a una fila que no existe, y la
   segunda mitad de la cuarta comprobación no se puede leer **porque su sujeto se borró**; además
   el mismo corpus rechaza ese mecanismo: *«no como un efecto lateral de **borrar una fila**»*
   (`12-contrato…` §2.8). Si retirar es **marcar**, la marca es la columna que el §2.4 no declara.
8. **Lo que queda sin detector es lo caro.** La tercera comprobación es el único mecanismo del
   diseño para *«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
   **coincide**»* (`B/03` §3.2, citado por `B/09` §3), con su desenlace escrito: *«**paga todos
   los meses una vertical que el grant le regaló**, con el §35.3 ordenando lo contrario»* y
   *«**paga todos los meses un addon que el flag le declaró gratis**»* (`B/09` §3, tabla de la
   tercera comprobación).

**Dónde lo permite el diseño.** `B/09` §3 (3ª y 4ª comprobaciones) y `B/16` §4.2 (tercera mitad)
contra `B/02` §2.4 (las dos filas del grant), `NUCLEO/01` §1.5 y `12-contrato…` §2.8.

**Marcado `NUCLEO`, por su mitad de glosario**, que es un defecto propio y no un reflejo: la
regla 2 de `NUCLEO/01` §2.4 dice *«**«Vivo» sin calificar no se usa en un predicado**»*, y el
**consumidor 17 de su propio inventario** cita el predicado con *«un beneficiario con **un ancla
viva** en la vertical V»* y sólo comenta que *«las dos mitades enumeran **los seis**: las dos
filas son suscripciones»*. El inventario **enumeró los dos «vivos» que sabía nombrar y dejó pasar
el tercero dentro de la misma frase**, y `G-R1-E` no lo ve porque está anclado en `sucede_a` y en
*«fila viva»* (`B/20` §2).

**Severidad.** `CRITICA`. Los dos detectores que esta tanda escribió para el estado que el diseño
declara indetectable **no se pueden evaluar**, y lo que no se detecta es un cobro mensual sobre
algo que el §35.2 y el §35.3 ordenan no cobrar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 12** (`4e383480d`, la tercera comprobación de cero
llamadas) más **`DEC-ADDON-006`** (`456563988`, que reescribió la tercera cláusula de `A5` sobre
*«la REVOCACIÓN»* y le dio a la cuarta comprobación su segunda mitad). Antes de los dos, ningún
predicado del barrido preguntaba por el estado de un grant: la cuarta comprobación miraba sólo el
objetivo y la tercera no existía. **La decisión de `DEC-ADDON-006` está bien tomada** —*«desanclar
no está declarado»* es correcto y verificado—; lo que falta es la columna que su predicado
necesita, que es otra cosa.

**¿Lo habría encontrado el grep?** **No, con ninguno de los dos.** El término **nuevo** es
*«ancla viva»* / *«grant vivo»*, y `rg` sobre los capítulos que `4e383480d` **no** toca devuelve
**cero**: `B/09`, `B/03`, `B/16` y `nucleo/01` son los cuatro donde aparece y los cuatro están en
la lista de archivos del commit (§2.3 de las instrucciones). El término **viejo** —*«se retira el
ancla»*— desapareció del corpus con el propio arreglo. Y el defecto es una **ausencia**: la
columna que falta no se nombra en ninguna parte.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las cuatro apariciones de *«ancla
viva»* están en archivos que el commit **sí** tocó y, tres de ellas, en párrafos que el commit
**escribió**, así que quedan fuera de lo que la obligación 2 manda rastrear. Y la aparición que
importaría —la fila de `permanent_grant` en `B/02` §2.4— **no contiene el término**, porque el
defecto es justamente que no lo contiene. Es la obligación **4** la que alcanzaba: *«cada término
que el núcleo define lleva su lista de consumidores»* — sólo que acá el término es uno que el
núcleo **no** define, y una lista de consumidores de un término indefinido nadie la abre.

---

### F-8eB3-003 — `requiere_conciliación` está declarado «booleano» y `S18` le escribe un MOTIVO: la única instrucción que dice «devolvéle la plata» no tiene columna, así que el reembolso de las ramas 1 y 5 llega al humano como una marca más

**Qué se rompe.** El cliente pagó un período que `S17` (rama 1) o la baja del proveedor (rama 5)
se llevaron puesto, y el diseño decidió devolvérselo. El acto que lo ordena es **la marca con un
motivo**, y la columna que la guarda es un **booleano**. Lo que el humano ve en el listado
accionable es una fila `CANCELLED` marcada, indistinguible de las otras marcas, sin nada que diga
que hay plata para devolver. El pago se queda.

**El camino.**

1. La columna, tal como está declarada: *«**`requiere_conciliación`** (booleano)»* (`B/02` §2.2),
   y el §3.1 de `B/03` lo repite: *«**`requiere_conciliación` es una marca booleana sobre la
   fila**, no un estado»*.
2. **`S18` le escribe un motivo.** Su cuarto efecto: *«**si la predecesora retiene un pago
   pendiente por `S19`, se le pone a ELLA la marca `requiere_conciliación`** **con motivo
   *«reembolso por confirmar»*** (rama 1 de `B/12` §5.3, `DEC-RF-002`)»* (`B/03` §3.2).
3. **Y las dos ramas que mueven dinero se apoyan en ese motivo, no en la marca.** `B/12` §5.3,
   rama 1: *«`S18`, en el mismo acto del cierre, le pone la marca `requiere_conciliación` a la
   PREDECESORA —la dueña del pago— **con motivo *«reembolso por confirmar»***, y el caso entra al
   canal de conciliación; el sistema **no ejecuta el reembolso solo**»*. Rama 5: *«le pone a
   **ella** la marca **con motivo *«reembolso por confirmar»***»*. `B/02` §2.6 lo repite en el
   inventario.
4. **Un booleano no transporta un motivo**, y la superficie que tiene que mostrarlo lee sólo la
   marca: *«el **listado accionable** de las filas con la marca `requiere_conciliación` … El
   listado muestra **el estado real de la fila**, que la marca ya no pisa»* (`B/19` §4). El estado
   real de la fila es `CANCELLED`, que es el mismo de toda predecesora sucedida.
5. **Y la marca la escriben además otros cinco caminos con motivos incompatibles**: `S14` por
   divergencia (`B/03` §3.2), el barrido por monto o por estado (`B/09` §3), `C2`/`C3` del `B/05`
   §2, la condición fallida del `B/05` §3, y las cuatro comprobaciones de cero llamadas. Los seis
   escriben `true` en la misma casilla.
6. **El desenlace es el que `DEC-RF-002` puso en manos de una persona.** `B/12` §5.3 lo dice: sin
   el reloj y sin el canal, *«**lo confirma una persona**» significa «lo confirma una persona si se
   acuerda»*. Con la marca sin motivo, ni siquiera hay qué acordarse: el caso llega
   indistinguible.
7. **La misma columna tiene un segundo consumidor que tampoco cabe**, y esta tanda se lo agregó:
   la **salvedad 2** devuelve una terminal marcada al barrido *«hasta que una persona la levante
   (`S15`)»* y declara que *«lo que el barrido le aporta no es la comparación con el proveedor sino
   **el reloj de la marca**, que es lo único que hace que el caso no quede abierto para siempre»*
   (`B/09` §3). Un booleano **no tiene reloj**: no dice desde cuándo está puesto, así que *«si
   sigue puesta pasado su plazo, **escala**»* (`B/09` §3) no se puede evaluar. Es
   `F-8cB3-005` —abierta desde la 8-bis-2— **ascendida de observación a dependencia**: hasta esta
   tanda el reloj era una frase; ahora es la razón declarada de existir de una salvedad.

**Dónde lo permite el diseño.** `B/02` §2.2 (la columna) y `B/19` §4 (el listado) contra `B/03`
§3.2 (`S18`, cuarto efecto), `B/12` §5.3 (ramas 1 y 5) y `B/09` §3 (salvedad 2 y el reloj).

**Severidad.** `CRITICA`. El cliente pagó un período que el diseño declaró perdonado, la única
rama que mueve dinero tiene su orden escrita en un campo que no existe, y la marca que la
transporta no se distingue de las otras seis que escriben esa casilla. Paga de más y la plata se
queda.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 4** (`f4edbdfdf`: *«`S18` gana un CUARTO efecto …
y el cap. 09 pasa de una salvedad a TRES»*), que es el que introdujo la frase *«con motivo
«reembolso por confirmar»»* en los tres lugares, más la **salvedad 2** del mismo commit, que es la
que volvió al reloj una dependencia. Antes del arreglo la rama 1 no tenía acto —era
`F-8dB3-003`—; **el acto se escribió y se escribió sobre una columna que no lo admite**.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es *«motivo «reembolso por
confirmar»»*, que nace con el commit y por definición no tiene apariciones viejas. Grepeando el
término **viejo** —`requiere_conciliación`— sobre los capítulos que `f4edbdfdf` **no** toca: los
únicos son `B/16` (que no la menciona) y `NUCLEO/01` §2.2/§2.4; **los diez lugares que la
mencionan** —`B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/19`, `B/20`, `nucleo/03`, `nucleo/04`,
`nucleo/08`— **están todos dentro del radio de ese commit o del siguiente**. Es el modo *«interno
al commit»*, con el agravante de que el radio abarca el corpus entero.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y acá la razón es precisa.** La
aparición decisiva es la declaración de tipo en `B/02` §2.2 —*«(booleano)»*—, y ese párrafo
**`f4edbdfdf` lo tocó** (agregó `sucedida_por` a la misma fila de la tabla). La obligación 2
acota su rastro a *«párrafos que el commit no tocó»*, así que la única aparición que contradice al
arreglo cae **justo afuera**. Es el caso que la obligación 1 anticipa —*«un archivo abierto no es
un párrafo leído»*— llevado un paso más allá: **acá el párrafo también se abrió, se editó, y la
contradicción estaba en la misma celda de la misma tabla.**

---

### F-8eB3-004 — La tercera comprobación es más ancha que el `desde` de `S20` en la cláusula que el mismo arreglo le agregó: marca todos los días al complemento de otra vertical que `S20` correctamente no tocó

**Qué se rompe.** Un beneficiario tiene un *«Boost»* de scope `LISTING` sobre una ficha de
**Gastronomía**, con un producto compatible con Gastronomía **y** con Alojamiento. Le otorgan un
*Free Forever* que ancla **Alojamiento**, con `includesAddons: true`. `S20` **no** alcanza ese
complemento —y hace bien: su objetivo no es de la vertical anclada—, pero la tercera comprobación
sí lo encuentra, **todos los días**, y le pone la marca. Y una fila marcada *«no puede ser
sucedida —ningún `sucede_a` puede apuntarla»* (`B/03` §3.3): el cliente queda sin poder cambiar
nada sobre una fila que está perfecta.

**El camino.**

1. **El `desde` de `S20` tiene cuatro cláusulas**, y la cuarta es la que importa: *«toda fila viva
   DE COMPLEMENTO del beneficiario —los seis estados— **cuya instancia esté en uno de sus dos
   estados vivos** y **cuyo `addon_product` declare compatible la vertical que el acto ancla**;
   **para los scopes con vertical propia —`VERTICAL_SUBSCRIPTION` y `LISTING`— además su objetivo
   tiene que ser de esa vertical** (`B/16` §3.4)»* (`B/03` §3.2).
2. **El predicado del detector tiene dos.** `B/09` §3, segunda fila de la tabla de la tercera
   comprobación: *«una **fila viva de complemento** suya **cuyo addon es compatible con V**, si el
   grant lleva `includesAddons: true`»*. No dice nada del **objetivo**, ni del estado de la
   **instancia**.
3. **Y la copia del inventario del núcleo repite la versión corta**: *«…ni una fila viva DE
   COMPLEMENTO **de un addon compatible con V** si el grant lleva `includesAddons: true`»*
   (`NUCLEO/01` §2.4, consumidor 17).
4. **El resultado es un falso positivo sobre el camino normal.** *«Compatible con V»* es una
   propiedad del **producto** (*«verticales compatibles»*, `B/02` §2.4) y por definición puede ser
   plural: `B/16` §3.4 titula su § *«sólo los compatibles, y «compatible» ya estaba definido»*
   precisamente porque un producto lo puede ser en varias. Todo complemento cuyo producto sea
   compatible con la vertical anclada **y cuyo objetivo sea de otra** queda marcado, y su
   población no es un borde: es cada addon de scope `LISTING` o `VERTICAL_SUBSCRIPTION` de un
   beneficiario multi-vertical.
5. **Y no hay salida**: la comprobación declara que *«**No necesita excepción por carrera** …
   Si alguna vez la hubiera, el desenlace es la marca —una persona—, no una cancelación
   automática»* (`B/09` §3). O sea que la fila vuelve a marcarse en la corrida siguiente, y la
   siguiente, porque nada cambia el hecho que la dispara.
6. **El costo está escrito en el propio corpus, dos veces.** `B/09` §3: la marca *«además le
   bloquea al cliente el único acto con el que podría salir»* y *«ahoga el listado accionable»*.
   `B/20` §2, sobre `G-R1-A`: *«un guard que falla **sobre el camino normal** es un guard que
   alguien va a relajar»* — y relajar esta comprobación apaga el único detector de `F-8eB3-002`.

**Dónde lo permite el diseño.** `B/09` §3 (tabla de la tercera comprobación, fila 2) y
`NUCLEO/01` §2.4 (consumidor 17) contra `B/03` §3.2 (`desde` de `S20`) y `B/16` §3.4.

**Severidad.** `ALTA`. No hay pérdida de plata directa, pero la marca bloquea al cliente el cambio
de plan de forma permanente, arranca un reloj que escala, y empuja a relajar la comprobación de la
que depende un `CRITICA`. No la subo porque el daño es un bloqueo y un incidente, no un cobro.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 12** (`4e383480d`, la tercera comprobación) cruzado
con **`DEC-ADDON-003`** (`6bac7e63a`, que creó `S20`). Los dos commits **escribieron el mismo
predicado en dos lugares con distinta precisión**: el que fija qué hace la transición lleva las
cuatro cláusulas, el que fija qué detecta el barrido lleva dos.

**¿Lo habría encontrado el grep?** **No.** El término es **`S20`**, y `6bac7e63a` toca `B/09`,
`B/03`, `B/02`, `B/16`, `B/19`, `B/20`, `nucleo/01`, `nucleo/04` y `nucleo/08` — o sea **todos** los
capítulos donde `S20` aparece. Grepear *«los capítulos que el commit NO toca»* devuelve cero. Es
el modo **interno al commit**, tercera instancia en mi vector.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las dos apariciones que hay que
comparar —la fila de la tabla del `B/09` §3 y el consumidor 17 de `NUCLEO/01` §2.4— **las escribió
ese mismo commit**, así que ninguna es *«una aparición no corregida en un párrafo que el commit no
tocó»*. La enmienda no alcanza por construcción: **compara el arreglo contra el resto del corpus y
nunca el arreglo contra sí mismo en dos archivos.**

---

### F-8eB3-005 — El par con que una salvedad 4 termina bien —el proveedor dice `cancelled` sobre nuestra `ABANDONED`— no está en ninguna tabla, así que el ÉXITO de la salvedad produce la marca sobre toda ventana de checkout vencida

**Qué se rompe.** La salvedad 4 devuelve al barrido las terminales cuya cancelación fue nuestra,
*«hasta que la relectura la vea `cancelled`»*. El día que la relectura la ve `cancelled` —o sea el
día que todo salió bien— el barrido tiene que **evaluar ese par contra la tabla del cap. 03**, y
el par no está: la tabla del §10.1 enumera `cancelled` contra `CANCEL_SCHEDULED` y contra
*«cualquier estado **vivo**»*, y `ABANDONED` no es vivo. Por la regla del propio §10.1, *«lo que no
figura acá es divergencia real»*: **marca**. Sobre cada checkout que venció, que es la población
terminal que más crece.

**El camino.**

1. `S3` es una de las seis puertas *«no exentas»*: *«`S3` → `ABANDONED` | **nuestra llamada**: el
   job que recorre las vencidas *«cancela el preapproval en el proveedor»* … | **no**»* (`B/09`
   §3, tabla de las nueve puertas).
2. La salvedad 4 la devuelve al barrido: *«**cinco** de las **seis** filas *«no»* …: `S12`,
   **`S3`**, `S13`, `S20` y la lápida … **hasta que la relectura lo vea `cancelled`**»* (`B/09`
   §3).
3. **Y el barrido, sobre esa fila, corre las cinco comparaciones de campo**, la primera de las
   cuales es: *«estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se
   **evalúa la transición contra la tabla del cap. 03**. Si no existe, se pone la **marca**»*
   (`B/09` §3).
4. **El par no existe en la tabla que espeja.** Conté las **ocho** filas de `B/03` §10.1: las dos
   de `cancelled` son *«`cancelled` | `CANCEL_SCHEDULED` | nada: es lo esperado»* y *«`cancelled` |
   **cualquier estado vivo que no sea `CANCEL_SCHEDULED`** | `S12` … o espejar»*. Los *«vivos»*
   son los **seis** de `B/02` §2.2 y `ABANDONED` **no está entre ellos** — *«Quedan afuera
   `ABANDONED`, `CANCELLED` y `CHARGE_DECLINED`»*.
5. **Y la tabla declara qué pasa con lo que no enumera**: *«Lo que **no** figura acá es
   **divergencia real**, y ahí la marca es la respuesta correcta — deja de ser un falso positivo y
   pasa a señalar lo que su nombre dice»* (`B/03` §10.1).
6. **La otra lectura no salva el caso**: si *«la tabla del cap. 03»* es la del §3.2, tampoco hay
   ninguna transición que salga de `ABANDONED` —*«`ABANDONED` → `ACTIVE` | la ventana venció …»*
   es de las que **no existen** (§3.3)—, así que el resultado es el mismo. **Las dos lecturas
   marcan.**
7. **Y no es sólo `ABANDONED`.** El mismo razonamiento alcanza a `cancelled` contra nuestra
   `CANCELLED` —la salida normal de `S12`, `S13`, `S20`, `S21` y la lápida—, que tampoco figura
   entre las ocho filas: *«cualquier estado **vivo**»* las excluye a todas. La diferencia es que
   ahí se puede argumentar que los dos lados *«no difieren»* y la comparación ni se dispara;
   sobre `ABANDONED` **no se puede**, porque los nombres son distintos.
8. El costo, escrito por el propio capítulo: la marca *«ahoga el listado accionable»* y *«lleva
   reloj … **escala**»* (`B/09` §3). La población son todas las ventanas de 72 h que vencen, que
   es la parte de la cartera que el mismo § llama *«la que más crece»*.

**Dónde lo permite el diseño.** `B/09` §3 (salvedad 4 y la comparación de estado) contra `B/03`
§10.1 (las ocho filas y su regla de cierre), `B/03` §3.3 y `B/02` §2.2 (los seis vivos).

**Severidad.** `ALTA`. Nadie paga de más por este camino, pero el éxito de la salvedad que esta
tanda escribió para vigilar seis puertas produce un incidente por fila, sobre la población más
grande del sistema, en el canal del que depende cada `CRITICA` de este informe.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 11** (`4e383480d`: *«la exención de terminales
deja de ser una lista y pasa a ser CRITERIO … con tabla de siete puertas»*, hoy nueve), que es el
que creó la salvedad 4 y con ella la población de filas **terminales** que el barrido relee.
Antes del arreglo ninguna `ABANDONED` entraba al barrido, así que el par nunca se evaluaba.

**¿Lo habría encontrado el grep?** **No con el término del arreglo, sí con otro.** El término que
el arreglo redefine es *«estado terminal»* / *«exención»*, y grepearlo sobre `B/03` §10.1 devuelve
**cero**: esa tabla no usa la palabra *«terminal»* ni una vez — habla de *«cualquier estado
**vivo**»*, que es el complemento. Grepeando **`cancelled`** el párrafo aparece de una. Es la
misma forma exacta de `F-8dB3-001` de mi vuelta anterior: **el arreglo nombra su término con el
símbolo del conjunto que agrega, y la contradicción vive en el capítulo que enumera el
complemento.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y por un pelo.** La tabla del §10.1
**es** un párrafo que `4e383480d` no tocó, dentro de un archivo que sí tocó — o sea **el sujeto
exacto que la obligación 2 manda rastrear**. Pero la obligación se aplica *«por aparición del
término»*, y en ese párrafo **el término no aparece**. La enmienda habría alcanzado si el término
elegido fuera `cancelled` en vez de *«terminal»*, que es una decisión que `DEC-METH-010` deja al
que arregla. **Es el único hallazgo de este informe en que la enmienda estuvo a un término de
distancia.**

---

### F-8eB3-006 — El barrido no tiene rama para una suscripción sin preapproval, y desde `MP5` el pagador manual es exactamente eso: la frase que declara que nada cambia —«no hay ninguno»— es la razón por la que las cinco comparaciones no se pueden evaluar

**Qué se rompe.** La suscripción de un pagador manual entra al inventario del barrido como
cualquier otra fila viva, y **no tiene id de preapproval que leer**. Las cinco comparaciones de
campo no tienen contra qué correr. Según cómo se implemente, o se marca todos los días —y una
fila marcada *«no puede ser sucedida»*, así que el pagador manual no puede cambiar de plan
nunca— o se saltea en silencio, y entonces el único proceso periódico del sistema tiene un agujero
que ningún texto declara.

**El camino.**

1. **El alcance del barrido no excluye a nadie por método de pago**: *«**Por cada fila de nuestro
   inventario** —suscripción principal o suscripción de complemento (`DEC-ADDON-002`)— que no esté
   en un estado terminal, más las terminales que las cuatro salvedades …»* (`B/09` §3).
2. **Y el mecanismo es leer por id, sin alternativa declarada**: *«Se guarda el id de cada
   suscripción y **se leen de a una, por id**»*, y *«guardar ese id … pasa a ser **la condición de
   que la conciliación exista**. Una suscripción cuyo id se pierde es **invisible para el
   barrido**»* (`B/09` §2.1). Las cinco comparaciones son todas contra el recurso del proveedor:
   *«el del proveedor, leído por id»*, *«`transaction_amount`»*, *«`next_payment_date`»*, *«los
   `authorized_payments` del preapproval»* y *«la `version` del recurso»* (`B/09` §3).
3. **El pagador manual no tiene ninguno de los cinco, y el corpus lo dice tres veces.** `B/06` §7:
   *«un pago manual mensual **no tiene nada que pausar** porque **no hay débito que detener**»*.
   `B/03` §7.2: *«un pagador manual **no tiene autorización en el proveedor** (`B/06` §7)»*.
   `B/03` §7, `MP5`: *«es la entrada de esta máquina, y **la crea el sistema**»* — el cobro lo
   constata una cuota nuestra, no un hecho del proveedor.
4. **Y la frase que cierra el arreglo lo dice como si fuera la razón de que nada cambie.**
   `B/03` §7.2, *«lo que NO cambia»*: *«**El barrido de `B/09` §3 sigue con nueve puertas, cuatro
   salvedades y cuatro comprobaciones de cero llamadas.** `MP5` no lleva ninguna suscripción a un
   estado terminal y **no toca ningún preapproval — no hay ninguno**»*. *«No hay ninguno»* es
   exactamente la premisa que rompe el barrido, escrita como la premisa que lo deja intacto.
5. **Si se lee al pie de la letra, marca.** La comparación de estado dice *«se evalúa la transición
   contra la tabla del cap. 03. **Si no existe, se pone la marca**»*, y una lectura fallida por
   falta de id no produce ninguna transición evaluable. La marca entonces *«le bloquea al cliente
   ser sucedido»* (`B/02` §2.2, `B/03` §3.3) y arranca el reloj que escala.
6. **Si se lee con sentido común, se saltea — y ese salteo no está escrito en ninguna parte.**
   `B/09` §7 enumera los procesos y sus frecuencias, y ninguno dice *«sólo sobre suscripciones con
   `provider_link`»*. Por la regla 1 del núcleo, una exclusión que ninguna tabla declara es una
   exclusión que cada implementación inventa a su manera.
7. **Y hay un daño residual en las dos lecturas**: si el pagador manual sale del barrido, **sale
   también de las cuatro comprobaciones de cero llamadas**, que viven dentro de él (*«Por cada fila
   de nuestro inventario … Y hay una comprobación que no le pregunta nada al proveedor»*). Las
   cuatro se contestan con un `JOIN` sobre nuestra propia base y **ninguna necesita un
   preapproval** — pero están escritas adentro del proceso que sí lo necesita. Un pagador manual
   que sea predecesora de una sucesión abierta, o que retenga un pago pendiente por `S19` —que
   `MP1` y `MP4` le pueden dejar puesto (`B/03` §7)—, se queda sin los dos detectores.

**Dónde lo permite el diseño.** `B/09` §2.1, §3 y §7 contra `B/03` §7 (`MP5`), `B/03` §7.2 (*«lo
que NO cambia»* y *«cómo entra el grace»*) y `B/06` §7.

**Severidad.** `ALTA`. Bloqueo permanente del cambio de plan para una población entera, o un
agujero no declarado en el único proceso periódico —y, por arrastre, en las cuatro comprobaciones
que no necesitaban el proveedor para nada—. No es `CRITICA` porque ninguna de las dos ramas mueve
plata por sí sola.

**¿Es nuevo, o es el arreglo?** **Es `DEC-SUB-013`** (*«la cuota del manual»*, la última de las
tres chicas de `1c17565e1`), que es la decisión que creó `MP5` y con ella la primera suscripción
del diseño que **existe sin preapproval por construcción**. Antes de `MP5` el pago manual era una
máquina de tres salidas sin entrada (`F-8B2-018`), o sea una población que ninguna corrida podía
alcanzar; el arreglo la volvió alcanzable y el barrido no se recorrió.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es **`MP5`** / *«pagador manual»*, y
grepearlo sobre los capítulos que `1c17565e1` **no** toca —el commit toca log, `nucleo/03`,
`B/02`, `B/03`, `B/09`, `B/16`— devuelve el `B/06` §7 y el `B/12`, que dicen lo mismo que el
arreglo y no lo contradicen. Sobre **`B/09`, que el commit SÍ toca**, `rg "pagador manual|pago
manual"` devuelve **cero**: el capítulo de conciliación **no nombra el método de pago ni una
vez**. Cuarta instancia del modo *«la ausencia»*.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** El párrafo donde el defecto vive —el
encabezado del `B/09` §3, *«Por cada fila de nuestro inventario»*— es un párrafo que `1c17565e1`
no tocó, así que **cae dentro del sujeto de la obligación 2**; pero **no contiene ninguna
aparición del término**, ni del nuevo ni del viejo. Es el mismo límite de `F-8eB3-002`: la
obligación recorre apariciones y este defecto es un párrafo que **debería** nombrar el término y
no lo nombra. La pregunta que lo encuentra es la inversa —*«¿en qué capítulos debería aparecer
este término?»*—, que es una lista de consumidores y no un `rg`.

---

### F-8eB3-007 — La lápida vuelve al barrido por la salvedad 4 y tres de las cinco comparaciones no tienen lado izquierdo: es una `subscription` que ninguna transición produjo y a la que el §2.2 le exige columnas que nadie puede llenar

**Qué se rompe.** La única fila que el sistema nuevo escribe a mano vuelve al barrido por diseño, y
el barrido la compara campo por campo contra el proveedor. Tres de los cinco campos no existen de
nuestro lado, así que la fila que existe **para que el barrido la encuentre** entra a él
produciendo divergencias. **Esto no es sobre la población de producción ni sobre el orden del
procedimiento** —`DEC-MIG-004` cerró las dos cosas—: es sobre la forma de la fila, y `B/21` §2.5
la generaliza explícitamente a *«cualquier escritura manual futura»*.

**El camino.**

1. La lápida es *«una `subscription` en `CANCELLED` con su `provider_link`, escrita DESPUÉS de
   cancelarlo en el proveedor»* (`B/21` §2.5), y el mismo § declara que *«**es la única fila
   `CANCELLED` de todo el sistema que ninguna transición produce**, y eso no es exclusivo del
   corte: **cualquier escritura manual futura hereda el mismo agujero**»*.
2. **Vuelve al barrido por la salvedad 4**, y `B/21` §2.5 lo celebra como el cierre del defecto
   anterior: *«La cubre la **salvedad 4** del cap. 09 §3 … así que vuelve al barrido **hasta que
   la relectura la vea `cancelled`**»*. La tabla de las nueve puertas la lista: *«la **lápida** del
   corte → `CANCELLED` | **una persona a mano** … | **no**»* (`B/09` §3).
3. **Y el barrido, sobre cualquier fila que alcanza, corre las cinco comparaciones.** Tres de
   ellas no tienen contra qué correr en una lápida:
   - **monto vigente** — se compara contra `transaction_amount`. El monto nuestro sale de *«la
     versión de plan anclada»* (`B/02` §2.2), y una lápida escrita a mano por un compromiso del
     sistema viejo **no tiene una versión del catálogo nuevo que anclar**; la columna, además, no
     está declarada anulable.
   - **la `version` del recurso** — *«la última que aplicamos»*, que vive en `provider_link`
     (`B/02` §2.2). Sobre una lápida **nunca aplicamos ninguna**, así que *«si la del proveedor es
     mayor, **el recurso cambió sin avisarnos**: se relee entero»* es verdadero desde la primera
     corrida y para siempre.
   - **cobros del período** — *«los `authorized_payments` del preapproval»* contra un *«período
     actual»* que la lápida no tiene.
4. **Y la comparación de estado cae en `F-8eB3-005`**: el par *«el proveedor dice `cancelled`,
   nosotros decimos `CANCELLED`»* no figura en las ocho filas de `B/03` §10.1.
5. **La consecuencia es la inversa de la que la lápida busca.** Su razón de ser es que *«el barrido
   del cap. 09 **encuentra el id** y resuelve *«cancelado durante el corte»* en vez de
   *«huérfana»*»* (`B/21` §2.5). Con tres comparaciones sin lado izquierdo, lo que resuelve es
   *«divergencia»*, y el caso que la lápida vino a evitar —un cobro viejo imputado al ciclo nuevo—
   queda sepultado entre sus propios falsos positivos.

**Dónde lo permite el diseño.** `B/21` §2.5 contra `B/09` §3 (salvedad 4 y las cinco
comparaciones) y `B/02` §2.2 (las columnas de `subscription` y de `provider_link`).

**Severidad.** `MEDIA`. No hay plata en juego y hay una persona ejecutando el corte, pero el
detector que la lápida existe para alimentar arranca en rojo, y la generalización que `B/21` §2.5
declara —*«cualquier escritura manual futura»*— hace que el defecto no se agote con el corte.

**¿Es nuevo, o es el arreglo?** **No es esta tanda.** El vínculo lápida ↔ salvedad 4 lo escribió
la tanda **anterior** (el recuadro *«y el barrido la recorre de verdad»*), y `B/21` es de los
archivos que `1e3c3fc9e` tocó sin volver sobre este §. Lo reporto porque **sigue en pie sobre el
texto de hoy** y porque la salvedad 4 cambió de forma en esta tanda —pasó a nombrar cinco
puertas— sin que nadie recorriera qué le pasa a cada una dentro del barrido.

**¿Lo habría encontrado el grep?** No aplica (no lo introdujo un arreglo de la 9-bis-3). Si se
aplicara hoy: el término sería *«lápida»*, que aparece en **dos** archivos —`B/21` y
`16-fase-7-del-paraguas.md`— y en ninguno de los dos vive la otra mitad, que son las columnas de
`B/02` §2.2. **Ausencia otra vez.**

**¿La resolución POR APARICIÓN lo habría atrapado?** No aplica por lo mismo.

---

### F-8eB3-008 — `G-R1-C` justifica su alcance nombrando como «el único sin otro detector» justo la escritura que SÍ lo tiene desde esta tanda, y exonera a las tres que el `B/02` §2.6 declara silenciosas

**Qué se rompe.** El guard del cierre vigila cuatro escrituras y su prosa dice cuál de las cuatro
es la más frágil. Nombra la equivocada. Quien lea esa frase para decidir dónde poner el caso de
ruptura —que el §2.1 del mismo capítulo exige para cada guard— va a probar la que ya tiene
backstop y va a confiar en las tres que no lo tienen.

**El camino.**

1. `B/20` §2 dice, sobre el cuarto efecto: *«uno que cierra sobre una predecesora con un pago
   pendiente por `S19` **sin poner la marca** deja plata del cliente en nuestra cuenta sin nadie
   que la mire — **es el único de los cuatro que no tiene ningún otro detector**, porque la fila
   queda terminal»*.
2. **Esa escritura es la única de las cuatro que SÍ tiene otro detector, y lo ganó en esta misma
   tanda.** La **salvedad 3** devuelve al barrido *«una suscripción terminal con un pago acreditado
   pendiente de resolución por `S19` … hasta que la bandera se apague»*, y la **segunda
   comprobación de cero llamadas** la resuelve o la marca (`B/09` §3). El propio `B/09` lo escribe
   como la razón de existir de la salvedad 3: *«la 3 cubre la que **debería** tenerla y no la tiene
   porque `S18` no llegó a ponerla»*.
3. **Y las tres que la frase exonera son las que no tienen ninguno**, con el diagnóstico escrito
   dos párrafos antes en el mismo guard: *«Un cierre que re-apunta los complementos y se olvida de
   la **redención de promo** deja al cliente pagando precio de lista para siempre, **y el barrido
   no lo ve** porque compara contra el monto vigente de la sucesora, que **es** el de lista»*, y
   *«Uno que se olvida de la **cortesía** deja una columna no anulable apuntando a una
   `CANCELLED`»*. `B/02` §2.6 lo generaliza: *«las tres primeras tienen el mismo modo de falla:
   **son silenciosas**. Ninguna emite webhook, **ninguna cambia un estado que el barrido
   compare**»*.
4. **No es una contradicción abstracta**: el §2.1 exige *«un caso que lo hace fallar a propósito»*
   por guard y esta frase dice cuál priorizar. Y `NUCLEO/04` agrega el modo de falla que la vuelve
   cara: *«`G-R1-C` **se cumple de forma vacua cuando no ocurre ninguna de las dos escrituras**»*.

**Dónde lo permite el diseño.** `B/20` §2 (la prosa de `G-R1-C`) contra `B/09` §3 (salvedad 3 y
segunda comprobación) y `B/02` §2.6.

**Severidad.** `MEDIA`. La conclusión operativa del guard —vigilar las cuatro— es correcta; lo que
está mal es la única frase que dice cuál mirar primero, y apunta al revés.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 4** (`f4edbdfdf`, el cuarto efecto de `S18` y la
salvedad 3): la frase de `B/20` se escribió con el arreglo, y la salvedad 3 que la vuelve falsa
**se escribió en el mismo commit**. Es una razón que nació caduca.

**¿Lo habría encontrado el grep?** **No.** El término es *«salvedad»* / *«pago pendiente por
`S19`»*, y `B/20` es **uno de los 17 archivos que `f4edbdfdf` toca**. Grepear *«los capítulos que
el commit NO toca»* no llega nunca a `B/20`. Modo **interno al commit**, y con las dos mitades a
seis líneas de distancia en dos archivos que el mismo commit escribió.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La aparición está en un párrafo que
ese commit **escribió**, así que queda fuera del sujeto de la obligación 2 por definición. Es el
caso puro de *«la enmienda no alcanza»*: **una razón que el arreglo redacta y su propio arreglo
invalida no es una aparición vieja que resolver.**

---

### F-8eB3-009 — La salvedad 4 afirma que «`S20` es de complemento y las otras cuatro son principales», y `S3` corre también sobre filas de complemento

**Qué se rompe.** Nada, hoy. Es una afirmación sobre la clase de las filas de una población, dentro
del párrafo que justifica por qué la salvedad no parte por clase. Quien la lea para dimensionar la
población de la salvedad 4 cuenta mal, y quien la use para elegir el índice sobre el que corre el
barrido lo escribe sobre el conjunto equivocado.

**El camino.**

1. `B/09` §3, salvedad 4: *«**`S20` es de complemento y las otras cuatro son principales**, y eso
   no cambia nada acá: lo que la salvedad mira es **quién canceló**, no de qué clase es la fila»*.
2. Las *«otras cuatro»* son `S12`, `S3`, `S13` y la lápida. **`S3` corre sobre las dos clases**, y
   lo declara el capítulo que decide qué pasa con un complemento abandonado: *«**`A3` no entra**, y
   no por olvido. Lleva la instancia a `ABANDONED`, y ahí la fila de complemento **ya tiene
   transición propia: es `S3`**, la misma ventana de 72 h, con su misma cancelación en el
   proveedor»* (`B/03` §3.2, *«el complemento que sobrevive a su instancia»*; idéntico en `B/16`
   §4.4).
3. La conclusión de la salvedad **no cambia** —mira quién canceló, no la clase—, así que el daño es
   de conteo y no de cobertura.

**Dónde lo permite el diseño.** `B/09` §3 (salvedad 4) contra `B/03` §3.2 y `B/16` §4.4.

**Severidad.** `BAJA`. La enumeración se equivoca en una propiedad que el mismo párrafo declara
irrelevante.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 11** (`4e383480d`, la exención como criterio)
ampliado por `DEC-ADDON-003` (`6bac7e63a`), que fue el que agregó `S20` a la lista y escribió la
frase sobre las clases.

**¿Lo habría encontrado el grep?** **Sí.** El término es **`S3`**, y `rg -n "S3" 16-addons.md`
—capítulo que `6bac7e63a` **sí** toca, pero en un § (§4.4) cuya frase sobre `A3` viene de un
commit anterior— devuelve la frase *«la fila de complemento ya tiene transición propia: es `S3`»*.
Es el tipo de aparición que el grep resuelve bien.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** La aparición de `S3` en `B/16` §4.4
está en un **párrafo que `6bac7e63a` no tocó** dentro de un archivo que sí tocó, no fue corregida,
y contradice la frase nueva. **Es exactamente el sujeto de la obligación 2 y no se ejecutó** — el
único hallazgo de este informe del que eso se puede decir sin condiciones, y es el de severidad
más baja.

---

## 2. Hallazgos de vueltas anteriores que siguen llegando sobre el texto de hoy

Los verifiqué uno por uno contra el texto de los capítulos, no contra mis informes. Van con su ID
viejo y el paso en que llegan hoy; **no los cuento** en el conteo de arriba.

| ID viejo | qué era | por qué sigue llegando, sobre el texto de hoy |
|---|---|---|
| `F-8dB3-007` | ninguna columna dice que un pago está *«pendiente de resolución»* | **sigue entero y con cuatro consumidores nuevos**. `B/02` §2.3 sigue diciendo que `payment` guarda *«…estado del cap. 03 §6…»* (cinco estados, ninguno es *«pendiente»*) y que `manual_payment` guarda *«…estado del cap. 03 §7…»* (tres, ídem). Y el corpus ahora la llama **«la bandera»** en cuatro lugares que mandan **apagarla**: `S13` (*«la bandera se apaga en el mismo acto»*, `B/03` §3.2), la rama 4 de `B/12` §5.3, la salvedad 3 de `B/09` §3 (*«hasta que la bandera se apague»*) y `B/02` §2.6. **Un booleano que nadie declara, con cuatro actos que lo apagan.** Lo conté con `rg -n "bandera"`: 8 apariciones, cero declaraciones |
| `F-8dB3-007` (2ª mitad) | la corrida siguiente del barrido re-resuelve lo que la anterior resolvió | **peor que antes**: `B/09` §7 sigue diciendo *«**Los dos barridos son idempotentes**: correrlos dos veces no produce nada distinto, porque **ninguno escribe salvo la reparación de vínculo del §2.4**»*, y el §3 del mismo capítulo tiene hoy **cuatro** comprobaciones que escriben la marca y **una** (la segunda) que *«se resuelve por la rama que le corresponda de las cinco de `B/12` §5.3»*, o sea que **reactiva**. Eran dos comprobaciones cuando lo reporté; son cuatro |
| `F-8cB3-005` | la marca lleva reloj y la columna es booleana | **ascendida a dependencia declarada** — ver `F-8eB3-003` punto 7. `B/02` §2.2 sigue diciendo *«(booleano)»* |
| `F-8cB3-004` | el espejo cubre 20 de 36 pares | **recontado sobre la tabla de hoy**: sigue teniendo **ocho** filas y `authorized × ACTIVE` —la renovación normal— sigue sin figurar. Lo nuevo es que ahora tiene un consumidor más: la comparación de estado del barrido sobre las terminales que la salvedad 4 devuelve (`F-8eB3-005`) |
| `F-8dB3-010` | el espejo manda ejecutar una transición que la tabla no tiene | **se arregló por declaración, no por fila**, y alcanza: `B/03` §3.2 ahora dice *«**La séptima no tiene fila numerada en esta tabla, y no por eso deja de ser una transición de ella**»* y el §10.1 lo sostiene en cuatro lugares (dominio del §3.2, `B/16` §4.3, `S18` sin `S17`, rama 5 de `B/12` §5.3). **Lo doy por cerrado** |
| `F-8cB3-007` | `G-R1-B` exige una llamada al proveedor desde CI | **intacto**: `B/20` §2 sigue diciendo *«o esa fecha **no es la que el proveedor confirmó**»* |
| `F-8cB3-006` | el barrido excusa `next_payment_date` | fila intacta: *«se registra; **no es por sí sola una divergencia**»* |
| `F-8cB3-019` | `B/05` §C5 afirma una red que la base no tenía | **se arregló**: `B/02` §2.3 ahora declara *«**el período que cubre**»* en `manual_payment` y dice con todas las letras que *«el `UNIQUE(subscription_id, período)` de `B/05` §C5 ya la presuponía»*. **Cerrado** |
| `F-8cB3-020` | `B/02` §4 cierra `M-DATA-01` con una tabla de una fila | **intacto**: la conté hoy, sigue teniendo **una** fila |

---

## 3. Lo que esta pasada dice sobre si `DEC-METH-010` cortó el generador

**Mi vector, medido**: de 9 hallazgos nuevos, **8 los introdujo un arreglo o una decisión de la
9-bis-3**, y los **3 `CRITICA` son 3 de 3**. La proporción de atribuidos **no bajó**, por cuarta
vez.

**Y la enmienda tampoco movió el número que ella misma vino a mover.** De los 8 atribuidos, la
resolución por aparición habría atrapado **uno** —`F-8eB3-009`, el de severidad más baja— y de los
tres críticos, **ninguno**. El reparto de por qué, que es lo que la instrucción pide separar:

| por qué la enmienda no alcanza | cuáles | qué haría falta |
|---|---|---|
| **el defecto es una AUSENCIA y no hay aparición que resolver** — la fila que falta en la tabla, la columna que no existe, el capítulo que nunca nombra el sujeto | `F-8eB3-001`, `002`, `003`, `006`, `007` | la obligación **4** dada vuelta: no *«la lista de consumidores del término que redefino»* sino **«la lista de columnas contra las que se evalúa el predicado que escribo»** y **«la lista de transiciones que ejecutan los efectos que enumero»**. Las dos son tablas de 3-6 filas y las dos se contestan sin `rg` |
| **la aparición está en un párrafo que el propio commit ESCRIBIÓ** — la obligación 2 lo excluye por definición | `F-8eB3-004`, `008` | comparar el arreglo **contra sí mismo en dos archivos**. `F-8eB3-004` son dos copias del mismo predicado con distinta precisión, escritas por el mismo autor el mismo día; `F-8eB3-008` es una razón que el arreglo redacta y su propio arreglo invalida |
| **la aparición cae en el sujeto de la obligación 2 y NO se ejecutó** | `F-8eB3-009` | nada nuevo: la regla alcanzaba |
| **a un término de distancia** — el párrafo es el sujeto correcto pero el término elegido no aparece en él | `F-8eB3-005` | que *«el término que el arreglo redefine»* incluya **el complemento del conjunto**: quien agrega población a *«terminal»* tiene que grepear *«vivo»* |
| **no es de esta tanda** | `F-8eB3-007` | — |

**La conclusión que este vector sostiene, y es la misma que la vuelta pasada con un año más de
evidencia**: `DEC-METH-010` corrigió lo que `DEC-METH-009` hacía mal —recorrer archivos en vez de
párrafos, olvidar el término viejo— y **no toca el modo dominante**, que sigue siendo la ausencia:
**5 de 9 hallazgos y 3 de 3 críticos**. Una obligación que recorre apariciones no puede encontrar
un párrafo que debería existir y no existe, por más fino que sea el grep, y esta vuelta agrega una
segunda clase que tampoco toca: **la contradicción que el arreglo escribe consigo mismo**, porque
las dos mitades están en párrafos que el commit redactó y la obligación 2 los excluye a propósito.

**Lo que yo mediría antes de la próxima vuelta**: no la proporción de atribuidos, sino **cuántos
críticos se contestan con una tabla de menos de diez filas escrita ANTES del arreglo**. En mi
vector son **3 de 3**: *«qué transición ejecuta cada efecto de `S18`»* (4 filas, `F-8eB3-001`),
*«contra qué columna se evalúa cada término de cada comprobación»* (11 filas, `F-8eB3-002`) y
*«qué escribe cada acto en `requiere_conciliación`»* (6 filas, `F-8eB3-003`). Ninguna de las tres
es una búsqueda: las tres son un **inventario cerrado** que el arreglo tiene que escribir para
poder declararse aplicado, y las tres se pueden verificar leyéndolas.

---

## 4. Un patrón que este vector ve y conviene nombrar: el barrido creció por el lado de los detectores y no por el de las columnas

Las comprobaciones de cero llamadas pasaron de **dos a cuatro** en dos tandas, y las salvedades de
**una a cuatro**. Las ocho se justifican con el mismo argumento —*«cuesta cero llamadas, todas esas
filas están en nuestra base»*— y el argumento es correcto **para siete**. Lo que ninguna de las dos
tandas recorrió es la otra mitad de esa frase: **contra qué columna**.

| lo que el barrido pregunta hoy | la columna que necesita | ¿existe? |
|---|---|---|
| ¿esta fila tiene `sucede_a` no nulo y su predecesora ya no es fila viva? | `sucede_a`, `estado` | **sí** (`B/02` §2.2) |
| ¿esta fila tiene un pago acreditado **pendiente de resolución**? | ninguna declarada | **no** — `F-8dB3-007`, abierta desde la vuelta 3 |
| ¿este beneficiario tiene un **ancla viva** en V? | ninguna declarada | **no** — `F-8eB3-002` |
| ¿el ancla que era título de esta instancia es de un **grant vivo**? | ninguna declarada | **no** — `F-8eB3-002` |
| ¿esta fila terminal tiene la marca, y **desde cuándo**? | `requiere_conciliación` (booleano) | **la mitad** — `F-8eB3-003` |
| ¿por qué está marcada esta fila? | ninguna declarada | **no** — `F-8eB3-003` |

**Cuatro de los seis predicados que el barrido evalúa hoy no tienen columna**, y los cuatro nacieron
en las dos últimas tandas. Lo anoto acá y no como hallazgo aparte porque **no es un defecto
adicional**: es la forma que tienen los tres que ya reporté, y el número —4 de 6— es el que dice
que el modo no es casual.

---

## 5. Ataques que intenté y el diseño resistió

**1. Hacer que `S18` se ejecute a medias y deje la promo y la cortesía colgando de la
predecesora.** Era mi candidato a `CRITICA` más fuerte —`B/02` §2.6 y `B/20` §2 dicen los dos que
esas dos escrituras *«fallan en silencio»* y que *«el barrido no lo ve»*—, y **lo cierra la regla
3 del núcleo**: *«Una transición es **atómica** junto con sus efectos locales. Los efectos remotos
—el proveedor, el correo— nunca están dentro de esa transacción»* (`NUCLEO/03` §1). Las cuatro
escrituras de `S18` son **todas locales** y ninguna llama al proveedor, así que la ejecución
parcial no tiene dominio. **Es la diferencia exacta con `S13` y `S20`**, que sí son fan-outs con
una llamada remota por fila y por eso necesitan idempotencia declarada y un detector. La asimetría
está bien puesta y la regla 3 la sostiene sin decir una palabra de `S18`.

**2. Hacer que una cancelación de `S17` que el proveedor acepta y no aplica salga del barrido por
la exención.** `EX-20` mide que *«un `PUT` con varios campos **se aplica a medias con un solo
`200`**»*, así que *«la llamada salió bien»* no es *«la llamada se aplicó»* — y el veredicto de
`S17` en la tabla de las nueve puertas es *«**sí**, por construcción»*. **Está cerrado, y no por
esa tabla**: `B/03` §10.4 declara la obligación general —*«**toda mutación se verifica releyendo y
comparando campo por campo cada campo que se mandó**»*— y `B/06` la hace regla del carril. Con esa
verificación, una cancelación que no se aplicó **no llega a «salió bien»**, `S17` no ocurre y la
fila no llega a terminal, que es exactamente lo que su renglón afirma. **La exención de `S17` es la
única de las tres que descansa en una regla de otro capítulo, y la regla existe.**

**3. Meter una fila de complemento en el candado del §11, o encadenar sucesiones con `sucedida_por`
puesta.** Sigue rechazado por la base: el `WHERE clase = principal` de los dos índices parciales y
el indexado de `B` sobre `(user_id, vertical)` (`B/02` §2.2). **Lo reintenté con `S20` y `S21`
encima** —las dos salen de *«toda fila viva de complemento»*— y no cambia nada: ninguna de las dos
toca una fila principal y los dos índices las ignoran por la cláusula de clase.

**4. Contar dos veces la misma fila entre la salvedad 1 y la salvedad 4, o dejarla sin ninguna.**
Recorrí las **seis** puertas *«no exentas»* contra las **cuatro** salvedades y la partición cierra
sin solapamiento y sin hueco: cinco entran por la 4, `S21` por la 1, y el criterio que las separa
está escrito y es verificable —*«la 1 selecciona por el estado terminal de su INSTANCIA; en `S20`
la instancia no es terminal, en `S21` sí»*—. **Es la parte mejor cerrada de este capítulo**, y el
recuadro que lo explica se anticipa a las dos lecturas equivocadas antes de que alguien las haga.

**5. Que el barrido se coma la cartera terminal entera con cuatro salvedades en vez de una.** Las
cuatro tienen condición de corte y tres de ellas son la misma —*«hasta que la relectura lo vea
`cancelled`»*—, así que la población es **la cola de las que no confirmaron**, no la cartera. La
segunda (*«hasta que una persona la levante»*) no tiene corte automático, pero su población es la
de las filas marcadas, que por definición ya tiene un humano asignado. **El costo está acotado y
la acotación está escrita en las cuatro.**

**6. Concluir *«no cobró»* desde el endpoint de cobros, y listar la cartera desde el buscador del
proveedor.** Las dos trampas mejor documentadas del carril siguen cerradas, con la misma regla y
sin variantes, en cinco lugares (`B/09` §2.1, §4 y §1, `B/03` §10.1, `B/02` §2.2). **Ninguno de los
once commits de esta tanda abrió una puerta ahí.**

**7. Que `S21` mande una segunda cancelación al proveedor sobre el mismo preapproval.** Cerrado en
tres capítulos con el mismo argumento y contado: *«un addon recurrente tiene **un** preapproval y
es el de esta fila … Volver a escribirla acá serían dos llamadas por el mismo recurso»* (`B/03`
§3.2, `B/16` §4.4, `B/02` §2.4). **`S21` declara explícitamente que no manda nada**, que es la
forma correcta de una fila que sólo escribe estado local.

**8. Que el corte escriba una lápida sobre un preapproval vivo.** El orden sigue siendo parte de la
regla —*«primero se cancela en el proveedor, después se escribe»*— con su razón escrita, y
`CANCELLED` sigue fuera de los vivos, así que no compite por el candado (`B/21` §2.5, `B/02` §2.2).
**Lo que encontré no es el orden ni el candado sino la forma de la fila** (`F-8eB3-007`). **Y no
toqué la población de producción por ningún ángulo**: `DEC-MIG-004` la cerró y este informe no la
reabre.

**9. Que la idempotencia de `MP5` choque con el `UNIQUE` de `B/05` §C5 y deje dos cuotas del mismo
período.** No se pisan, y el § lo recorre: el `UNIQUE` es *«`WHERE el pago está acreditado`»* y una
cuota en `AWAITING` **no lo está**, así que la idempotencia de `MP5` es su propia condición —*«que
no exista ya un `manual_payment` de ese período»*— y las dos conviven. **Recorrí los seis estados
vivos contra *«¿se crea la cuota?»* y los cinco «no» tienen razón escrita**, incluidas las dos
poblaciones vacías. Es el arreglo más completo de la tanda en mi vector, y su único residuo es que
nadie miró qué le hace al barrido (`F-8eB3-006`).

**10. Que un grant emita en una vertical donde no ancló, o que el piso del trinquete compare contra
el plan de otra.** `UNIQUE(permanent_grant_id, vertical)` más *«el plan pertenece a esa vertical»*
más *«hay un piso **por ancla**»* lo hacen imposible de escribir, y la base lo hace cumplir (`B/02`
§2.4). **Lo reintenté con `S20` encima** —que es el primer acto que lee el ancla como título de una
instancia— y la dirección nueva también está cerrada: la instancia *«apunta al **ANCLA**, no al
grant»* justamente para saber **en qué vertical** es gratis. **Lo que falta no es la referencia sino
el estado de lo referenciado** (`F-8eB3-002`).
