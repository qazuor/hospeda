---
title: "FASE 8-bis-4 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · B2 — máquinas, idempotencia y carreras

Quinta pasada de este vector sobre `HOS-1354`. La respuesta corta de esta vuelta es una sola frase,
y nombra al arreglo más productivo de la tanda:

> **El espejo del §10.1 pasó a ser una transición de primera clase —la séptima del dominio, el
> tercer camino de `S18` sin `S17`, la rama 5 del `B/12` §5.3— y NADIE recorrió su `desde`.** El
> §10.1 se lo escribe sobre **cinco** estados (*«cualquier estado vivo que no sea
> `CANCEL_SCHEDULED`»*), la nota del `B/03` §3.2 se lo escribe sobre **cuatro** (agregando
> `SUSPENDED` a mano) y la tabla de recorrido del mismo § se lo escribe sobre **dos** (`ACTIVE` ·
> `GRACE_PERIOD`). Los tres estados que la versión corta deja afuera —`PAUSED`,
> `PENDING_AUTHORIZATION` y `SUSPENDED`— son exactamente los que rompen tres afirmaciones que la
> misma tanda escribió como cerradas: *«no hay caso en que haya que pausar un preapproval que
> todavía no autorizó»* (`B/14` §4.4), *«son cinco ramas»* (`B/12` §5.3) y *«los apagan cuatro
> actos declarados, uno por rama»* (`B/03` §3.2).

Y una segunda, que no viene del espejo: **`S20` copió de `S13` la frase *«proceso idempotente y
reanudable fila por fila»* y su detector, y `S20` tiene DOS escrituras sobre DOS entidades donde
`S13` tiene una.** La primera saca a la fila de su propio `desde`, así que reanudar no la vuelve a
alcanzar, y la comprobación que el § nombra como su detector pregunta justo por la mitad que ya se
ejecutó.

Y una tercera, que es la más vieja y la más fácil de comprobar: **el acto de cancelar una
suscripción tiene UNA sola fila en toda la tabla, `S11`, con `desde` = `ACTIVE`**, y cuatro § de
tres capítulos lo declaran disponible desde `PAUSED` y desde `SUSPENDED` — uno de ellos es el
**tope** que `DEC-SUB-012` le puso a la reapertura de `MP4`.

**Trece hallazgos. Tres `CRITICA`, tres `ALTA` —dos de ellas siguen llegando con su ID viejo—,
seis `MEDIA` —una sigue llegando—, una `BAJA`.**

**Lo que medí yo, y cómo.** Todo sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-21, con el `HEAD`
en `635a2699f`: las **21** filas de la tabla de transiciones de `B/03` §3.2 y las **7** de su tabla
de recorrido; las **8** filas y los **2** comodines de `B/03` §10.1, cruzadas contra 4 estados del
proveedor × 9 nuestros = **36** pares; las **5** filas de `B/03` §7 y las **6** de §8; las **9**
puertas, las **4** salvedades y las **4** comprobaciones de cero llamadas de `B/09` §3; los **11**
guards de `B/20` §2; las **20** filas del inventario de `NUCLEO/01` §2.4 (6 + 4 en el grupo A,
10 en el B); las **tablas de transiciones** de las dos épicas, contadas con
`rg '^\| # \| desde \| evento'` sobre los dos árboles de `docs/`: **4** en billing y **3** en
verticales. La atribución por commit la medí con `git show --name-only` y con
`git log -L <rango>:<archivo>`, no con los mensajes de commit. **Ningún número de este informe
viene de otro informe**; las citas ajenas las verifiqué contra el texto del capítulo.

Abreviaturas: `B` es `HOS-1354-…/docs/`, `V` es `HOS-1353-…/docs/`, `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## CRITICAS

### F-8eB2-001 — El espejo mata a una predecesora `PAUSED`, que es el estado en que la deja una cortesía: `B/14` §4.4 declara ese caso inexistente, y el cierre le exige a `S18` pausar una sucesora en `PENDING_AUTHORIZATION` — o la cortesía firmada por `SUPER_ADMIN` se pierde y el cliente paga los días que le quedaban

**Qué se rompe.** Un cliente con una cortesía vigente —N días sin cobrar, firmados por
`SUPER_ADMIN`— está en medio de un cambio de plan. El proveedor da de baja su preapproval por su
cuenta. El espejo lo mata, `S18` cierra la sucesión, y a partir de ahí hay dos desenlaces y los dos
le cobran: o `S18` intenta dejar a la sucesora *«pausada con motivo `COURTESY`»* sobre una fila en
`PENDING_AUTHORIZATION` —una escritura que ninguna transición de la tabla declara, así que la regla
1 la manda a la marca— o no lo intenta y la sucesora autoriza, cobra y sigue cobrando con la
cortesía re-apuntada encima, que es textualmente *«una fila de base que no hace nada»*.

**El camino.**

1. **Una cortesía deja la fila en `PAUSED`, y eso es compatible con una sucesión en curso.** `S9`:
   `desde` `ACTIVE`, evento *«`SUPER_ADMIN` otorga cortesía»*, `hacia` `PAUSED` *(motivo
   `COURTESY`)*, condición *«no hay pausa vigente»* (`B/03` §3.2). Nada en esa fila mira si hay una
   sucesión declarada, y el propio § lo enumera como uno de los siete movimientos legales de una
   predecesora dentro de la ventana: *«| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía |
   `PAUSED` | **sí** |»* (tabla de recorrido, columna *«¿sigue siendo fila viva?»*).
2. **El espejo alcanza a `PAUSED`.** `B/03` §10.1, última fila: *«| `cancelled` | **cualquier estado
   vivo que no sea `CANCEL_SCHEDULED`** | `S12` si hay una baja programada; si no, **espejar la baja
   decidida por el proveedor** (`B/12` §1.4) |»*. Los vivos son **seis** y `PAUSED` es uno: *«Los
   «vivos» siguen siendo los mismos seis: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`,
   **`PAUSED`**, `SUSPENDED` y `CANCEL_SCHEDULED`»* (`B/02` §2.2). Y el hecho es alcanzable del lado
   del proveedor por medición propia del corpus: `EX-11` mide que estando pausada *«rechaza toda
   modificación con `400`, **pero sí deja cancelar**»* (`B/20` §3.2).
3. **Muerta así, la predecesora *«se murió sola»* y `S18` corre sin `S17`.** `B/03` §3.2: *«**`S18`
   sin `S17` es lo CORRECTO en `S12`, en `S16` y en el espejo del §10.1**»*, y su `desde` admite
   *«`PENDING_AUTHORIZATION` **cuando la predecesora se murió sola**»*.
4. **Y `B/14` §4.4 declara, con esas palabras, que este caso no existe.** Cita entera: *«**Y acá
   `S18` siempre corre sobre una sucesora ya `ACTIVE`, aunque su fila admita también
   `PENDING_AUTHORIZATION`.** El segundo camino de `S18` —la predecesora que se muere sola— sale de
   `S12` (`desde: CANCEL_SCHEDULED`) o de `S16` (`desde: ACTIVE`), y **una predecesora con cortesía
   vigente está `PAUSED`**, así que ninguna de las dos la alcanza (`B/03` §3.2). **No hay caso en que
   haya que pausar un preapproval que todavía no autorizó.**»* La enumeración es de **dos** caminos
   y hoy son **tres**: el tercero es el único que sale de `PAUSED`.
5. **Lo que el cierre tiene que ejecutar es una transición que no existe.** `B/02` §2.6, fila de la
   cortesía: *«**se re-apunta a la sucesora**, y la sucesora **queda pausada con motivo `COURTESY`
   por los días que quedaban**»*. Pero el `hacia` de `S18` es *«**el mismo estado**»* (`B/03` §3.2),
   y la única fila que lleva a `PAUSED` con motivo `COURTESY` es `S9`, cuyo `desde` es `ACTIVE`.
   Sobre una sucesora en `PENDING_AUTHORIZATION` no hay transición: por la regla 1 del núcleo
   —*«Un intento de transición que la tabla no declara **no se ejecuta** … si tocaba plata o estado,
   **pone la marca**»*— el cierre del cambio de plan normal termina en un incidente.
6. **Y si alguien lo implementa sin pausar —que es lo que la columna de efectos de `S18` dice, ya
   que nombra *«se re-apuntan»* y no *«se pausa»*— el daño es de plata y es silencioso.** La
   sucesora autoriza (`S2` → `ACTIVE`), arranca el período y cobra. La fila de `courtesy_grant`
   apunta a una `ACTIVE` que cobra, que es exactamente el modo de falla que el mismo §4.4 nombra:
   *«Una cortesía re-apuntada sobre una fila `ACTIVE` que sigue cobrando no es una cortesía: es una
   fila de base que no hace nada»*.
7. **Y nadie lo detecta.** El mismo §4.4 lo dice del caso hermano: *«el barrido no compara grants,
   la fila no queda marcada, y el cliente se entera cuando le cobran»*. Las cuatro comprobaciones de
   cero llamadas de `B/09` §3 miran `sucede_a`, el pago pendiente por `S19`, las anclas de un grant
   permanente y las instancias de addon. **Ninguna mira una cortesía.**

**Por qué `S12` y `S16` de verdad no alcanzaban, y el espejo sí.** Lo verifiqué contra las tres
celdas: `S12` sale de `CANCEL_SCHEDULED` y `S16` de `ACTIVE`, así que el razonamiento de `B/14`
§4.4 era correcto **sobre el dominio de dos caminos que existía cuando se escribió**. El espejo es
el único de los tres cuyo `desde` incluye `PAUSED`, y es el que `4e383480d` agregó **un commit
después** del que escribió ese párrafo.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S9`, `S17` con `PAUSED` entre sus cinco alcanzables,
`S18` con su `desde`, su `hacia` *«el mismo estado»* y la lista de los tres caminos sin `S17`; la
tabla de recorrido, fila 2) y §10.1 (la fila del espejo y el bloque *«y «de esta tabla» incluye el
§3.2»*); `B/02` §2.2 (los seis vivos) y §2.6 (la fila de la cortesía); `B/14` §4.4 (la enumeración
de dos y la frase *«no hay caso…»*); `B/20` §3.2 (`EX-11`); `NUCLEO/03` §1 regla 1;
`01-decision-log.md`, `DEC-GRANT-003`, `DEC-GRANT-006`.

**Severidad.** `CRITICA` — alguien paga de más: el beneficiario de una cortesía firmada por
`SUPER_ADMIN` termina pagando los días que le quedaban, sin marca, sin aviso y sin ningún proceso
que compare grants. La rama alternativa —la marca— convierte el cierre del camino normal en un
incidente sobre un cliente que no hizo nada mal.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos en commits consecutivos.** El **5** de la
familia de la sucesión (`f4edbdfdf`) escribió `B/14` §4.4 con su enumeración de dos caminos; el
**11/13** de la familia de `S13` (`4e383480d`) agregó *«y el espejo del §10.1»* como tercer camino
de `S18` sin `S17`. Lo verifiqué con `git log -L 264,272:…/14-promos-cortesias-y-grants.md` y
`git log -L 259,275:…/03-maquinas-de-estado.md`: el párrafo de `B/14` lo introduce `f4edbdfdf` y la
lista de tres la introduce `4e383480d`.

**¿Lo habría encontrado el grep?** **Sí, con el alcance nuevo; no con el viejo.** El término que el
arreglo redefine es *«la predecesora se murió sola»* / *«`S18` sin `S17`»*. `4e383480d` **sí toca
`B/14`** (lo medí con `git show --name-only`: la tabla del §2.3 de las instrucciones lo publica
igual), así que `DEC-METH-009` —*«sobre los capítulos que el commit NO toca»*— no lo miraba. La
obligación **1** de `DEC-METH-010` extiende el alcance a *«TODO EL CORPUS … incluidos los archivos
que el commit toca»*, y un `rg "se muere sola|S16"` sobre `B/14` devuelve el párrafo del §4.4 en una
línea.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el caso limpio de la obligación 2.**
`4e383480d` editó `B/14` **en el §2.2** —el párrafo *«Y vale igual cuando `S18` corre con la sucesora
todavía en `PENDING_AUTHORIZATION`»*, medido con `git show 4e383480d -- …/14-…md`— y **no tocó el
párrafo del §4.4**. O sea: es una aparición **no corregida, en un párrafo que ese commit no tocó**,
que es literalmente lo que la obligación 2 manda escribir *«archivo, § y por qué sigue siendo
correcta»*. Escribirlo habría obligado a contestar *«¿sigue siendo verdad que sólo `S12` y `S16`?»*,
y la respuesta la tenía el mismo commit. **La enmienda alcanzaba y no se ejecutó.**

---

### F-8eB2-002 — `S20` copió de `S13` *«idempotente y reanudable fila por fila»* teniendo DOS escrituras sobre dos entidades: la primera saca la fila de su propio `desde`, así que una corrida cortada deja el addon gratis para siempre, sin ancla-título, y el detector que el § nombra pregunta por la mitad que ya se ejecutó

**Qué se rompe.** Una corrida de `S20` que muere entre sus dos escrituras deja una instancia de
addon `ACTIVE`, sin cobro y **con su columna de ancla-título en nulo**. Esa columna es *«el
consumidor de la tercera cláusula del evento de `A5`»*: sin ella, el día que se revoque el grant
**nada apaga ese addon**, que es exactamente el desenlace que `B/16` §3.3 declara inadmisible. Y en
tres de los cuatro scopes —`LISTING`, `USER` y `GLOBAL`— **ninguna de las cuatro comprobaciones del
barrido lo encuentra nunca**, porque las dos que podrían miran cosas que en ese estado están sanas.

**El camino.**

1. **`S20` tiene dos escrituras sobre dos entidades**, y las dos están en su celda de efectos
   (`B/03` §3.2): (a) la suscripción de complemento va a `CANCELLED` y *«se cancela el preapproval
   en el proveedor»*; (b) *«**La instancia no cambia de estado**: si estaba `ACTIVE` sigue `ACTIVE`,
   ahora **colgando del ancla** como su título (`B/02` §2.4)»*.
2. **La (b) es una escritura real y no una lectura derivada.** `B/02` §2.4, fila `addon_instance`:
   *«**y el ancla del grant que sea su título, si lo es** … **El ancla del título apunta a
   `permanent_grant_vertical` y sí es anulable**: nula cuando el título es el ordinario de esa
   vertical, no nula cuando el addon vive de un grant»*. Antes de `S20` esa columna vale **nulo**
   —el addon se compró sobre una suscripción—, así que la conversión tiene que escribirla.
3. **Y la (a) saca la fila del `desde` de `S20`.** El `desde` es *«**toda fila viva DE COMPLEMENTO**
   del beneficiario … cuya instancia esté en uno de sus **dos** estados vivos»*. Ejecutada la (a), la
   fila de complemento está `CANCELLED`, que no está entre los seis vivos (`B/02` §2.2). **Volver a
   correr el acto entero ya no la alcanza.**
4. **Y la frase que promete la recuperación es de `S13` y allá es verdadera.** `B/03` §3.2: *«`S13`
   es idempotente y reanudable fila por fila. Volver a correrlo sobre una fila que ya cerró no
   escribe nada y no manda nada … así que **reanudar es volver a correr el acto entero**, no llevar
   un cursor»*. Sobre `S13` eso cierra, porque su efecto por fila es **uno** —el estado, más la
   llamada al proveedor, que es idempotente por la regla de relectura de `S17`—. Sobre `S20` la
   segunda escritura es sobre **otra entidad** y su guarda es el estado de la primera: no hay nada
   que vuelva a intentarla.
5. **El detector declarado es ciego a ese estado exacto.** `S20` cierra su celda con *«**Proceso
   idempotente y reanudable fila por fila**, con su detector en `B/09` §3»*, y el § lo explicita:
   *«`S20` corre en el mismo acto, con el mismo fan-out y el mismo modo de falla, así que la tercera
   comprobación lo cubre a él también»*. La tercera comprobación, verbatim (`B/09` §3): *«| una
   **fila viva de complemento** suya cuyo addon es **compatible con V**, si el grant lleva
   `includesAddons: true` | `S20` |»*. En el estado que produce el corte, la fila de complemento
   **ya no es viva**: la comprobación pregunta por la mitad que sí se ejecutó.
6. **La cuarta comprobación tampoco, y en tres scopes de cuatro no puede.** Su predicado
   (`B/09` §3): *«Si una instancia está en uno de sus dos estados con autorización que puede cobrar
   … y su objetivo **ya cumple la condición de orfandad del `B/16` §4.2**, **o el ancla que era su
   título ya no es la de un grant vivo**, `A5` no corrió»*. Las dos mitades fallan acá:
   - la **primera** mira el objetivo, y `B/16` §4.2 lo dice de frente: *«En `LISTING`, `USER` y
     `GLOBAL` el objetivo **nunca murió** —la ficha y la cuenta siguen ahí—, así que un addon de esos
     scopes cuyo título era el ancla **no queda huérfano al revocar** y esta condición no lo alcanza
     nunca»*;
   - la **segunda** pregunta por *«el ancla que era su título»*, y la columna quedó **nula**: no hay
     ancla que comparar. Sólo para `VERTICAL_SUBSCRIPTION` la primera mitad rescata el caso, y recién
     **después** de la revocación.
7. **Entonces la revocación no lo apaga**, que es lo que `A5` ganó su tercera cláusula para hacer.
   `B/03` §8, `A5`: *«se revoca el grant **del que cuelga el ancla que era su título**»*, y `B/02`
   §2.4 remata: *«**Su consumidor es la tercera cláusula del evento de `A5`** … Sin la columna, esa
   cláusula no tiene sujeto»*. El resultado es, con las palabras de `B/16` §3.3, *«el addon
   convertido **funcionando gratis para siempre y sin suscripción**»*.
8. **Y el mismo `B/03` §3.2 ya declaró que ése es el desenlace inadmisible**, en el recuadro que
   compara `S20` con el camino viejo: *«Lo que hacía inadmisible este camino no era que el addon
   quedara gratis: era que **nada lo volvía a apagar**»*.

**Por qué la corrida se corta de verdad y no es un borde.** El mismo § lo declara: `S20` es un
fan-out *«de N verticales × hasta seis estados, **con una llamada al proveedor por fila**»*, y la
llamada al proveedor está **entre** las dos escrituras. Es exactamente el punto donde `S13` se
justificó escribiendo su propia frase de idempotencia.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S20` celda de efectos y `desde`; el recuadro de
idempotencia de `S13`; el párrafo *«`S20` corre en el mismo acto … así que la tercera comprobación
lo cubre a él también»*) y §8 (`A5`, tercera cláusula); `B/02` §2.2 (los seis vivos) y §2.4
(`addon_instance`, el ancla del título anulable y su único consumidor); `B/09` §3 (la tercera y la
cuarta comprobación); `B/16` §3.3 (*«gratis para siempre y sin suscripción»*), §3.4 y §4.2 (el
recuadro de los tres scopes cuyo objetivo nunca muere); `NUCLEO/01` §2.4 fila 19;
`01-decision-log.md`, `DEC-ADDON-003`.

**Severidad.** `CRITICA` — alguien accede a algo que no le corresponde, de forma permanente y sin
ningún detector: una capacidad comprada sigue otorgando gratis después de que se revocó el único
instrumento que la sostenía. No es un borde reversible: la columna que lo haría reparable es la que
la corrida no escribió.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-ADDON-003`** (`6bac7e63a`), que creó `S20`.
Lo verifiqué con `git show 6bac7e63a -- …/03-maquinas-de-estado.md`: la fila `S20` entra en ese
commit **ya con** la frase *«Proceso idempotente y reanudable fila por fila, con su detector en
`B/09` §3»* y con las dos escrituras en la misma celda. El defecto nace completo en texto nuevo.

**¿Lo habría encontrado el grep?** **Sí, con el alcance nuevo.** El término copiado es *«idempotente
y reanudable fila por fila»*. `6bac7e63a` toca `B/03` y `B/09`, así que `DEC-METH-009` no miraba
ninguno de los dos; la obligación **1** de `DEC-METH-010` sí, y `rg "reanudable fila por fila"`
sobre `B/03` devuelve **dos** apariciones —la de `S13` y la de `S20`— a 400 líneas de distancia.
Ponerlas una al lado de la otra es ver que el argumento de recuperación de `S13` (*«volver a
correrlo sobre una fila que ya cerró no escribe nada»*) supone **una** escritura por fila.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es la pregunta que separa las dos
cosas.** La obligación 2 manda escribir la justificación sólo de las apariciones *«que no se
corrigen y están en un párrafo que ese commit no tocó»*, y `6bac7e63a` **tocó ese bloque**: le
agregó abajo el párrafo *«Y `S20` corre en el mismo acto, con el mismo fan-out y el mismo modo de
falla…»*. La aparición cae **adentro** del párrafo editado, así que la obligación 2 no la manda
justificar y el rastro por aparición no la habría contenido. **Acá la enmienda no alcanza**, y lo
que faltaría es lo que la obligación 1 ya dice y la 2 no recoge: *«un archivo abierto no es un
párrafo leído»* tiene una simétrica —**un párrafo editado no es un párrafo verificado**—, y es la
que este caso pide.

---

### F-8eB2-003 — Cancelar una suscripción tiene UNA sola fila, `S11`, con `desde` = `ACTIVE`: `B/12` §7.2 decide qué pasa al cancelar estando pausado y `B/03` §3.1 y §7.1 cuelgan de *«que la cancele una persona»* desde `SUSPENDED` — el pausado que quiere irse no puede y paga el período siguiente, y el pagador manual suspendido queda encerrado para siempre

**Qué se rompe.** Un cliente en pausa decide no volver y pide la baja. `B/12` §7.2 tiene la decisión
escrita —*«termina el servicio en el acto»*, con la fecha de fin fijada en el día de la
cancelación—, y **ninguna fila de `B/03` §3.2 la ejecuta**. Por la regla 1 el intento se va a la
marca; mientras una persona lo mira, el reloj de la pausa vence, `S10` lo devuelve a `ACTIVE` y
**se le cobra el ciclo siguiente**. Y del otro lado, un pagador manual `SUSPENDED` no tiene ninguna
salida ejecutable: no puede cancelar, el espejo no lo alcanza y el candado `A` sigue ocupado con su
fila, así que **no puede darse de alta de nuevo ni irse**.

**El camino.**

1. **Recorrí las 21 filas de `B/03` §3.2 buscando el evento de la baja pedida por la persona. Es
   una:** *«| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor
   de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |»*. Ninguna otra
   fila declara ese evento, y lo verifiqué también con
   `rg "pide la baja|la cancele una persona|cancelar la suscripción" B/03`.
2. **`B/12` §7.2 decide el caso desde `PAUSED`, entero, y nombra su efecto.** Título: *«Cancelar
   estando pausado termina el servicio en el acto»*; cuerpo: *«durante la pausa no hay servicio …
   `DEC-SUB-009` sostiene el servicio hasta el fin del período pagado, y acá **no queda servicio que
   sostener**. La fecha de fin de servicio **es un dato nuestro** … así que la fijamos: es el día de
   la cancelación»*. Es una decisión sobre una transición que no existe.
3. **Y el § de al lado usa la exhaustividad para prohibir el orden inverso, sin ver que el suyo
   tampoco tiene fila.** `B/12` §7.3: *«Pausar estando en `CANCEL_SCHEDULED` **no es una transición
   de la máquina**: el §26 exige `ACTIVE`, y la tabla del capítulo 03 §1 es exhaustiva —*lo que no
   está, no pasa*—»*. La misma regla, aplicada al §7.2, dice que cancelar estando pausado tampoco
   pasa.
4. **`B/03` §3.3 declara que esa transición SÍ existe, por exclusión.** Su fila: *«| `PAUSED` →
   cualquier cosa que no sea `ACTIVE` o `CANCELLED` | … |»*. O sea que `PAUSED → CANCELLED` es de
   las que **no** están prohibidas — y tampoco está declarada en ningún lado.
5. **Desde `SUSPENDED` el mismo acto es una de las tres salidas que el §3.1 declara.** Cita entera:
   *«Su salida no es el candado: es pagar (`S7`), que el proveedor la dé de baja y la espejemos
   (`B/12` §1.4), o **que la cancele una persona**»*. La tercera no tiene fila.
6. **Y de esa tercera cuelga el TOPE que `DEC-SUB-012` le puso a `MP4`.** `B/03` §7.1: *«Eso cierra
   la ventana **con actos que ya existen**, no con un plazo: cuando **una persona cancela la
   suscripción** (§3.1 enumera esa salida, y es una de las doce acciones del `NUCLEO/08` §3) o
   cuando le cae un grant (`S13`), la fila pasa a `CANCELLED`, de donde el §3.3 ya declara que **no
   se vuelve**»*. Si ese acto no tiene transición, la ventana se cierra por **un** camino y no por
   dos: sólo el grant.
7. **Y para un pagador manual el grant es el único, porque los otros dos el propio §7.1 los
   descarta.** Verbatim: *«una `SUSPENDED` de pagador manual que nadie cancela se puede reabrir
   indefinidamente, porque **no hay preapproval que el proveedor dé de baja por mora** (`B/06` §7 …)
   y **el espejo del §10.1 nunca la alcanza**»*. El § lo acepta describiendo un subconjunto —*«que
   nadie cancela»*— y en realidad es **la población entera**: nadie puede.
8. **Y encerrarlo no es figurado: es el candado.** `SUSPENDED` está entre los seis vivos, así que la
   fila ocupa `A` (`B/02` §2.2) y *«el segundo `INSERT` lo rechaza la base»* (`B/03` §3.4 punto 4).
   Salir por una sucesión tampoco: `G-R1-A` sólo deja declarar una desde
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}` (`B/20` §2). Para volver a ser cliente de esa vertical
   tiene que pagar la cuota vieja — que es lo mismo que `B/03` §7.1 llama, para otro sujeto,
   *«el muro»*.
9. **Y el acto existe en el catálogo, así que el cliente y el admin lo ven ofrecido.** `NUCLEO/08`
   §3: *«| **cancelar** una suscripción | §24 | **sí**, e irreversible en el proveedor (`PA-5`) |»*.
   Y `S6` deja la fila *«con billing accesible»* (`B/03` §3.2). Lo que la superficie ofrece no tiene
   transición detrás.

**Y con `MP5` el agujero de `GRACE_PERIOD` deja de ser teórico para toda una población.** Desde
`DEC-SUB-013` el pagador manual entra en `GRACE_PERIOD` **en el primer instante de cada período**
—`MP5` abre la cuota *«y en el mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`»*
(`B/03` §7)—, así que la ventana en la que `S11` es alcanzable para él se reduce a los días entre
que el admin registra el pago y que arranca el período siguiente (ver `F-8eB2-011`).

**Dónde lo permite el diseño.** `B/03` §3.2 (`S11`, `S10`, `S6`, `S12`) y §3.1 (las tres salidas de
`SUSPENDED`) y §3.3 (la fila de `PAUSED`) y §3.4 punto 4 (el candado `A`) y §7 (`MP5`) y §7.1 (el
tope y el caso *«que nadie cancela»*); `B/12` §7.2 y §7.3; `B/02` §2.2 (los seis vivos y los dos
índices); `B/20` §2 (`G-R1-A`); `NUCLEO/08` §3 (el catálogo de doce); `NUCLEO/03` §1 regla 1;
`01-decision-log.md`, `DEC-SUB-009`, `DEC-SUB-010`, `DEC-SUB-012`.

**Severidad.** `CRITICA` — alguien paga de más por dos caminos distintos: el pausado que pidió la
baja y no la consigue cobra el ciclo siguiente cuando `S10` lo reanuda, sobre una decisión
(`B/12` §7.2) que dice explícitamente lo contrario; y el suspendido queda obligado a pagar una
cuota vieja como única forma de volver a existir en esa vertical, con el candado ocupado por una
fila que no puede matar.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es la que lo vuelve afirmable.**
Que `S11` salga sólo de `ACTIVE` es anterior a esta tanda. Lo que hizo el arreglo de `DEC-SUB-012`
(`71615bb41`) fue **poner a cargar sobre ese acto el tope de una ventana que mueve dinero**: el §7.1
eligió *«el tope ya está escrito y es una condición y no un reloj»* precisamente para no agregar una
cifra sin guard, y las dos salidas que nombra son *«una persona cancela»* y *«le cae un grant»*.
Antes de `MP4` nada dependía de que ese acto fuera ejecutable desde `SUSPENDED`; después, la
ventana entera. Y `B/12` §7.2 es de una tanda anterior, pero es lo que `F-8dB1-004` obligó a
reabrir al reescribir el dominio de salidas.

**¿Lo habría encontrado el grep?** **Sí.** El término que el arreglo introduce es *«el tope de la
reapertura»* / *«una persona cancela la suscripción»*. `71615bb41` toca `B/03`, `B/05`, `B/12`,
`B/19`, `B/20` y `nucleo/07` — o sea que bajo `DEC-METH-009` el choque es **interno a los capítulos
del commit** (`B/03` §7.1 contra `B/03` §3.2, y `B/12` §7.2), y la regla vieja no lo mira. Bajo la
obligación 1 de `DEC-METH-010` —todo el corpus, incluidos los archivos que el commit toca— un
`rg "pide la baja"` sobre `B/03` devuelve **una** fila y un `rg "cancela la suscripción|la cancele
una persona"` sobre `B/03` y `B/12` devuelve **tres** consumidores. Contar uno contra tres es la
comprobación entera.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí para `B/12` §7.2, no para `B/03` §3.1.**
`71615bb41` **no toca** `B/12` §7 (edita §5.3, medido con `git show`), así que esa aparición es
*«no corregida y en un párrafo que el commit no tocó»* y cae de lleno en la obligación 2. La de
`B/03` §3.1 está en el mismo archivo que el commit edita pero en otro §; bajo la obligación 1 entra
igual, y bajo la 2 depende de leer *«párrafo»* y no *«archivo»*, que es justamente la lectura que la
enmienda fija. **La enmienda alcanzaba, al menos por una de las dos puertas, y no se ejecutó.**

---

## ALTAS

### F-8eB2-004 — La sucesora también muere por el espejo, y esa forma de terminar no está entre las cinco ramas de `B/12` §5.3 ni entre los cuatro actos que apagan el pago pendiente: el método que el § declara —«sobre la tabla entera, no sobre sus filas numeradas»— se aplicó de un solo lado

**Qué se rompe.** Una predecesora en `GRACE_PERIOD` retiene un pago por `S19`. El proveedor cancela
el preapproval **de la sucesora**, que sigue esperando autorización. La sucesora muere por el
espejo, no por `S3`, así que **nadie reevalúa el pago pendiente**: la bandera queda puesta, `S6` no
corre, `S5` y `S7` no tienen quién los dispare, y la fila se queda en `GRACE_PERIOD` —que emite
fuente con `hasta: SIN_FECHA_CONOCIDA`, o sea servicio entero— hasta que el barrido diario ponga la
marca por una rama que no puede determinar.

**El camino.**

1. **El § declara su método y su dominio.** `B/12` §5.3: *«**El dominio es el de las formas en que
   una sucesión en curso puede terminar, y son cinco.** Se enumeran recorriendo las salidas de la
   predecesora (en `GRACE_PERIOD` o `SUSPENDED`) y **las de la sucesora (en
   `PENDING_AUTHORIZATION`)** — **sobre la tabla de transiciones del cap. 03 entera, no sobre sus
   filas numeradas**, que es la corrección que trajo la quinta»*.
2. **Las salidas de una sucesora en `PENDING_AUTHORIZATION`, recorridas con ese método, son
   cuatro**: `S2` (autoriza) → rama 1; `S3` (vence la ventana) → rama 2; `S13` (grant) → rama 4;
   y **el espejo del §10.1**, cuyo `desde` es *«cualquier estado vivo que no sea
   `CANCEL_SCHEDULED`»* y `PENDING_AUTHORIZATION` es uno de los seis vivos (`B/02` §2.2). **La
   cuarta no tiene rama.**
3. **El método se aplicó sólo del lado de la predecesora, y el propio § lo dice.** El recuadro que
   justifica la quinta habla exclusivamente de *«una salida real **de la predecesora**»*: *«el espejo
   de la baja que decide el proveedor **no tiene fila numerada** — así que recorrer las filas
   numeradas deja afuera una salida real de la predecesora»*. El mismo argumento sobre la sucesora
   no se escribió.
4. **Y la tabla de los cuatro actos hereda el hueco.** `B/03` §3.2: *«Los apagan **cuatro** actos
   declarados, uno por rama»*, con *«| la sucesora vence su ventana | **`S3`**, que lo reevalúa en el
   acto | reactivada por `S5` o `S7` |»*. `S3` sale de *«vence la ventana»* y **no** de *«el
   proveedor canceló»*: son dos eventos distintos, y sólo el primero lleva el efecto de reevaluación.
5. **Con eso los dos booleanos que el § identifica quedan trabados en direcciones opuestas.** El
   mismo § los nombra: *«las cuatro cuelgan de dos booleanos —*«¿hay una sucesora viva
   apuntándome?»*y *«¿hay un pago pendiente por `S19`?»*—»*. Tras el espejo el primero se apaga
   solo —la sucesora no es viva— pero el segundo **no**, porque quien lo apaga es un acto y no el
   paso del tiempo. Resultado: `S6` no corre (*«no hay un pago acreditado del período pendiente de
   resolución por `S19`»* es falsa) y `S5`/`S7` no se ejecutan porque su evento es *«entra el pago,
   **o se reevalúa** uno que quedó pendiente»* y nadie reevalúa.
6. **El backstop lo ve, y no lo puede resolver: lo manda a una persona.** `B/09` §3, segunda
   comprobación: *«… se resuelve por la rama que le corresponda de las **cinco** de `B/12` §5.3, y
   **si la rama no es determinable, se pone la marca**»*. Acá no es determinable por construcción:
   la rama no existe. Y el mismo § declara que eso no debería pasar en el curso normal — *«**es un
   backstop, no el disparador**. En el curso normal los cuatro actos de `B/03` §3.2 ya resolvieron el
   pago antes de que el barrido llegue»*.
7. **Y la marca tiene un costo propio sobre este cliente**: *«mientras esté puesta sobre una fila,
   **ningún `sucede_a` puede apuntarla**»* (`B/02` §2.2), o sea que la persona a la que el proveedor
   le canceló el checkout **no puede volver a intentar el cambio de plan** hasta que alguien
   resuelva.

**Dónde lo permite el diseño.** `B/12` §5.3 (el método declarado, la tabla de cinco ramas y la de
los cinco actos disparadores); `B/03` §3.2 (`S3` efecto, `S5`, `S6`, `S7`, `S19`, la tabla de los
cuatro actos) y §10.1 (el `desde` del espejo y el bloque de las cuatro consecuencias); `B/02` §2.2
(los seis vivos y la regla de la marca); `B/09` §3 (la segunda comprobación y su recuadro
*«backstop, no disparador»*); `12-contrato…` §2.6 (qué emite `GRACE_PERIOD`).

**Severidad.** `ALTA` — no la subo a `CRITICA` porque el dinero no se pierde: el barrido diario lo
alcanza (la fila no es terminal) y la marca lleva reloj con escalado (`B/09` §3). Lo que se rompe es
que el desenlace más común del lado del proveedor —cancelar un checkout que nadie completó— entra
como incidente no determinable, y de paso bloquea el reintento del cliente.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `F-8dB1-004` / la rama 5** (`4e383480d`), que
escribió el método *«sobre la tabla entera, no sobre sus filas numeradas»* y lo ejecutó sobre el eje
de la predecesora. La tabla de cuatro actos es del mismo commit.

**¿Lo habría encontrado el grep?** **No, y por la forma del defecto.** El término nuevo es *«el
espejo del §10.1»* / *«la rama 5»*, y un `rg "espejo"` sobre `B/12` §5.3 devuelve **las apariciones
que el arreglo acaba de escribir**, todas correctas. Lo que hay que ver no es una aparición sino una
**ausencia**: que el eje de la sucesora tiene cuatro salidas y la tabla tiene tres. Eso se cuenta
recorriendo el `desde` del espejo contra los seis vivos, no buscando un término.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La obligación 2 cuantifica sobre
apariciones del término **que no se corrigen**; acá todas las apariciones del término se
escribieron nuevas y correctas en ese mismo commit, y el hueco está en la enumeración que el commit
produjo. Es el límite conocido de la enmienda: **verifica lo que el término ya dice, no lo que el
dominio nuevo todavía no dice.**

---

### F-8dB2-006 (sigue llegando) — `S17` y `S18` siguen compartiendo `(ACTIVE, la sucesora quedó autorizada)` y lo que las separa sigue siendo un ROL escrito en la columna `desde`: la tabla de la regla 7 sigue diciendo tres, y la tanda le agregó dos casos que sí se molestó en declarar

**Qué se rompe.** Lo mismo que reporté en la 8-bis-3: el único control de la regla 7 del núcleo es
un guard definido sobre `(desde, evento)`, y la columna `desde` de `B/03` §3.2 **no contiene sólo
estados**. Con eso `G-R4` o cuenta un cuarto par y se pone en rojo sobre el camino normal de todo
cambio de plan, o está anclado en el texto y no verifica la propiedad que dice verificar.

**En qué paso llega hoy.** El par sigue entero y con más apoyo textual que antes:

1. **`S17`**: `desde` = *«la **predecesora**, si sigue siendo fila viva — las cinco alcanzables:
   **`ACTIVE`**, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`»*, evento = *«su sucesora
   quedó **autorizada**, confirmado por relectura»*, `hacia` = `CANCELLED`.
   **`S18`**: `desde` = *«la **sucesora viva**: en **`ACTIVE`**…»*, evento = *«**la misma
   autorización que disparó `S2`**…»*, `hacia` = *«el mismo estado»*. Mismo estado de origen, mismo
   hecho del mundo, dos destinos distintos.
2. **Las condiciones siguen sin separarlas.** `S17`: *«la fila tiene una **sucesora viva** con
   `sucede_a` apuntándola»* — la predecesora la cumple. `S18`: *«la predecesora **ya no es fila
   viva**»* — sobre una fila que **no tiene** predecesora eso no es falso: es **vacuo**. El adjetivo
   *«viva»* que la tanda le agregó a `S17` no cambia esto, porque no dice nada sobre el rol de la
   fila evaluada.
3. **Y la tanda demostró que sabe escribir la salvedad, tres veces, para otros pares.** `NUCLEO/03`
   §1 regla 7 enumera hoy **cinco** casos de *«compartir el `desde` no es compartir el par»* —`T7`,
   `S18` desde `PENDING_AUTHORIZATION`, `A5` desde `PENDING_AUTHORIZATION`, `PB7`/`PB8` y
   `S20`/`S21`— y `B/03` §3.2 agrega los suyos (*«`S13` y `S20` comparten el evento y NO comparten
   el par»*, *«`S21` no agrega ningún par»*, *«`MP4` no agrega ningún par»*). **El par `S17`/`S18`
   no aparece en ninguna de esas ocho salvedades**, y es el único de todos ellos donde `desde` y
   evento coinciden de verdad.
4. **La tabla de la regla 7 sigue con tres filas** —`T1`/`T6`, `S5`/`S19`, `S7`/`S19`— y sigue
   delegando: *«**Que sean tres y no cuatro no es una afirmación de este capítulo: es lo que `G-R4`
   cuenta en cada PR**»*.

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 7 (`NUCLEO`); `B/03` §3.2 (`S13`, `S14`,
`S15`, `S17`, `S18`, `S19`, `S20`, `S21` — recorrí las 21 filas: **ocho** celdas `desde` no son
estados); `B/20` §2 (`G-R4`) y §2.1; `V/20` §2; `V/03` §2 (*«es **el único** par `(desde, evento)`
con dos destinos distintos de esta épica**, y uno de los **tres** que el diseño declara hoy»*).

**Severidad.** `ALTA` — el par sigue siendo disjunto de verdad (los dos candados de `B/02` §2.2 lo
garantizan), así que no mueve plata por sí solo. Lo que queda sin apoyo es la regla que garantiza
que **los próximos** pares lo sean, sobre una tabla que la tanda hizo crecer de diecinueve filas a
veintiuna.

**¿Es nuevo, o es el arreglo?** Es **`F-8dB2-006` que sigue llegando**, con su ID viejo. La mitad
nueva es de la tanda: `S20` y `S21` sumaron dos celdas `desde` más que no son estados (hoy son
**ocho** de veintiuna, contra seis de diecinueve), y el núcleo pasó de tres salvedades de
*«compartir el `desde`»* a cinco sin incorporar la única que comparte también el evento.

**¿Lo habría encontrado el grep?** **No**, por la razón de siempre: lo que hay que comprobar no es
una aparición del término sino **contar pares recorriendo la tabla**, que es lo que hace el propio
guard. `NUCLEO/03` lo tocaron cuatro commits de la tanda (`a85f5bb7e`, `456563988`, `71615bb41`,
`1c17565e1`, medidos con `git show --name-only`) y los cuatro agregaron una salvedad nueva sin
recontar.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La aparición —la tabla de tres de
`NUCLEO/03`— está **en un párrafo que esos commits sí tocaron**: le agregaron casos al bloque de
*«compartir el `desde` no es compartir el par»* justo debajo. Es el mismo modo de falla que
`F-8eB2-002`: un párrafo editado no es un párrafo verificado.

---

### F-8cB2-005 (sigue llegando) — El espejo sigue teniendo ocho filas sobre treinta y seis pares, y ahora carga CUATRO compromisos estructurales que antes no cargaba: `authorized × ACTIVE` y `paused × PAUSED` siguen sin figurar, y la regla de cierre los declara divergencia real

**Qué se rompe.** Lo mismo que medí en la 8-bis-2 y que `C1` dejó en `ALTA`: la tabla del §10.1
enumera **ocho** filas sobre un dominio de **4 estados del proveedor × 9 nuestros = 36 pares**, y su
cierre dice *«Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta
correcta»*. El par más común del sistema —`authorized × ACTIVE`, toda renovación normal— no figura.

**En qué paso llega hoy, y qué cambió.** Recontado sobre el texto de hoy: la tabla sigue con ocho
filas y dos comodines. `pending` está cubierto entero (2 filas); `authorized` cubre
`PENDING_AUTHORIZATION`, `PAUSED` y `GRACE_PERIOD`·`SUSPENDED` y deja afuera **`ACTIVE`,
`CANCEL_SCHEDULED` y los tres terminales**; `paused` cubre sólo `ACTIVE` y deja afuera **`PAUSED`**;
`cancelled` cubre `CANCEL_SCHEDULED` y los cinco vivos restantes y deja afuera **los tres
terminales** —o sea que todo preapproval que cancelamos nosotros (`S3`, `S12`, `S13`, `S17`, `S20`,
`S21`) produce, al releerse, un par no enumerado sobre una fila ya terminal—.

**Lo que esta tanda le agregó encima, que es el paso nuevo.** La tabla dejó de ser sólo el mapeo de
webhooks y pasó a sostener cuatro afirmaciones estructurales, todas escritas en su propio bloque:
*«la **séptima** del dominio que el §3.2 recorre …, la **sexta** de las que disparan la
re-evaluación del addon huérfano (`B/16` §4.3), **un tercer camino** por el que la predecesora se
muere sola y `S18` cierra la sucesión sin `S17`, y la **rama 5** de `B/12` §5.3»*. Y su fila
`authorized × GRACE_PERIOD·SUSPENDED` ganó la salvedad de `S19`, que es hoy el consumidor **10** del
inventario de `NUCLEO/01` §2.4. Una tabla que marca la cartera sana entera no es un detalle de
ruido cuando cuatro mecanismos de estado cuelgan de ella.

**Dónde lo permite el diseño.** `B/03` §10.1 (las ocho filas, el bloque de cierre y el recuadro de
las cuatro consecuencias) y §3.1 (los nueve estados); `B/02` §2.2 (los seis vivos y los tres que no);
`B/09` §3 (la comparación *«estado | el del proveedor, leído por id»*).

**Severidad.** `ALTA`, la que `C1` ya le fijó en la 8-bis-2. No la subo: el desenlace es una
inundación de marcas, no un cobro mal hecho — pero es la inundación la que entierra el único
detector de la divergencia de monto, que sí mueve plata.

**¿Es nuevo, o es el arreglo?** Es **`F-8cB2-005` que sigue llegando**, con su ID viejo (`B1` lo
reportó en paralelo como `F-8cB1-003` y `B3` lo recontó en la 8-bis-3 como `F-8cB3-004`). Lo que la
tanda cambió es el peso que la tabla soporta, no su contenido: el único edit de la 9-bis-3 sobre
ella es la salvedad de `S19` más el recuadro de las cuatro consecuencias.

**¿Lo habría encontrado el grep?** No aplica del todo —el hallazgo es anterior— pero sobre el edit
de esta tanda: **no**. El término es *«espejar»* / *«los ocho pares»*, y `a85f5bb7e` y `1c17565e1`
tocan `B/03` §10.1 directamente; el defecto está **adentro** de la tabla que editan.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, por lo mismo: la aparición está en el
párrafo editado. Y además el defecto no es una aparición sino un **conteo de cobertura**, que ningún
rastro por término produce.

---

## MEDIAS

### F-8eB2-005 — El mismo capítulo le da al espejo TRES `desde` distintos en doce líneas de distancia: dos estados en la tabla de recorrido, cuatro en la nota de abajo y cinco en el §10.1

**Qué se rompe.** La transición sobre la que la tanda apoyó cuatro mecanismos nuevos no tiene un
dominio: tiene tres, y cada consumidor lee el que le queda más cerca. Los tres estados de diferencia
son exactamente los que producen `F-8eB2-001` (`PAUSED`) y `F-8eB2-004` (`PENDING_AUTHORIZATION`).

**El camino.** Las tres redacciones, verificadas contra el texto:

| dónde | qué dice el `desde` del espejo | cuántos estados |
|---|---|---|
| `B/03` §3.2, tabla de recorrido, fila 7 | *«\| 7 \| `ACTIVE` · `GRACE_PERIOD` \| **el espejo de la baja decidida por el proveedor** (§10.1) … \|»* | **2** |
| `B/03` §3.2, recuadro doce líneas más abajo | *«El `desde` del espejo es *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»*, o sea que **incluye `GRACE_PERIOD` y `SUSPENDED`**»* | **4** (los cita nombrando dos y citando el comodín) |
| `B/03` §10.1, última fila | *«\| `cancelled` \| **cualquier estado vivo que no sea `CANCEL_SCHEDULED`** \| … \|»* | **5** |

La tabla de recorrido tiene la excusa de que su dominio declarado son *«las salidas de los tres
estados desde los que una fila **puede ser sucedida**»*, y `PAUSED` y `SUSPENDED` no están entre
ellos. **Pero sus propias filas 1, 2 y 3 llevan una predecesora legal a `PAUSED` y a `SUSPENDED`
dentro de la ventana**, con la columna *«¿sigue siendo fila viva?»* en **sí** — y desde ahí el
recorrido no vuelve a recorrer nada. El dominio está recorrido **un nivel**, y el § afirma que
*«queda recorrido en los dos ejes»*.

**Dónde lo permite el diseño.** `B/03` §3.2 (la tabla de recorrido y su recuadro) y §10.1 (la fila
del espejo); `B/02` §2.2 (los seis vivos).

**Severidad.** `MEDIA` — por sí sola es una tabla con tres redacciones; su consecuencia de plata
está contada en `F-8eB2-001` y `F-8eB2-004` y no la cuento tres veces.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 11/13** (`4e383480d`), que escribió la fila 7 y
el recuadro en el mismo acto, y la tabla de recorrido pasó de seis filas a siete sin unificar la
redacción con la del §10.1 que la fila cita.

**¿Lo habría encontrado el grep?** **Sí.** El término es *«el espejo»* / *«la baja decidida por el
proveedor»*, y `rg "espejo"` sobre `B/03` devuelve hoy **quince** apariciones; tres de ellas son
estas. Leerlas juntas es la comprobación.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las tres apariciones están en párrafos
que `4e383480d` escribió o editó, así que ninguna cae en *«no corregida y en un párrafo que el
commit no tocó»*. Mismo límite que `F-8eB2-002`.

---

### F-8eB2-006 — El preámbulo del §3 cuenta DOS transiciones con `desde` de conjunto y hay TRES: `S21` entró sin que su propio commit actualizara la lista de auditoría que el §3 existe para sostener

**Qué se rompe.** El § que obliga a toda transición futura escrita sobre un conjunto a decir si
alcanza a las de complemento —*«toda transición futura que se escriba sobre un conjunto tiene que
contestar lo mismo»*— publica el inventario contra el que se audita esa regla, y ese inventario
tiene una fila menos que sus miembros. Quien pregunte *«¿están todas?»* recibe que sí.

**El camino.**

1. El preámbulo, verbatim (`B/03` §3): *«Una transición cuyo `desde` se escribe como un **conjunto
   de filas** —y en esta tabla hay **dos**, `S13` y `S20`— tiene que decir si alcanza también a las
   de complemento»*.
2. **`S21` es la tercera.** Su `desde`: *«**toda fila viva DE COMPLEMENTO** —los **seis** estados de
   la suscripción— **de la que cuelga una instancia de addon**»*. Es un conjunto de filas, y el § la
   obliga a contestar: contesta, con *«**Las principales no entran, y acá no hace falta acotarlo**:
   de una principal no cuelga ninguna instancia»*. **La regla se cumplió; el conteo no se movió.**
3. **Y el `NUCLEO/01` §2.4 sí la incorporó**, como fila 20. O sea que el inventario del núcleo tiene
   a `S21` y el preámbulo del capítulo que lo obliga, no.
4. Lo verifiqué con `git log -L 21,40:…/03-maquinas-de-estado.md`: `4e383480d` crea el párrafo con
   *«una sola, `S13`»*; `6bac7e63a` lo pasa a *«dos, `S13` y `S20`»*; **`456563988`, que crea `S21`
   y sí toca `B/03`, no lo modifica**.

**Dónde lo permite el diseño.** `B/03` §3 (el preámbulo) y §3.2 (`S13`, `S20`, `S21`);
`NUCLEO/01` §2.4 (el inventario, filas 1, 19 y 20).

**Severidad.** `MEDIA` — no hay daño de plata y `S21` sí contesta lo que el § pide. Lo que queda mal
es el número contra el cual se audita la regla, que es el mismo modo de falla que ya costó un `ALTA`
en la vuelta anterior (`F-8dB2-007`: *«la lista que la tanda escribió para poder preguntar «¿están
todas?» contesta que sí cuando falta una»*).

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-ADDON-004`** (`456563988`).

**¿Lo habría encontrado el grep?** **Sí.** El término es *«conjunto de filas»* / *«toda fila
viva»*. `456563988` toca `B/03`, así que `DEC-METH-009` no lo miraba; bajo la obligación 1 un
`rg "conjunto de filas"` sobre `B/03` devuelve **una sola** aparición, que es ese preámbulo.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** El preámbulo es un párrafo que
`456563988` **no tocó** (lo medí con `git log -L`), y la aparición no se corrigió: cae exactamente
en lo que la obligación 2 manda escribir. **La enmienda alcanzaba y no se ejecutó.** Y la obligación
**4** también lo pedía por el otro lado, y ahí sí se cumplió: la fila 20 del inventario del núcleo
entró en el mismo commit.

---

### F-8dB2-012 (sigue llegando) — `G-R4` sigue declarando que cubre «las seis tablas de esta épica»: conté cuatro en billing y siete en el programa, con el mismo comando y el mismo resultado que hace una vuelta

**Qué se rompe.** El guard al que `NUCLEO/03` §1 le delega el número de pares tiene su alcance
declarado sobre un conjunto que no existe.

**En qué paso llega hoy.** Recontado el 2026-09-21 con
`rg '^\| # \| desde \| evento' HOS-1354-…/docs/ HOS-1353-…/docs/`:

| épica | tablas de transiciones | cuáles |
|---|---|---|
| billing | **4** | `B/03` §3.2 (suscripción), §6 (pago), §7 (pago manual), §8 (addon) |
| verticales | **3** | `V/03` §2 (trial), §9 (publicación), §11 (postulación de Partner) |
| **total** | **7** | |

Contra `B/20` §2, fila `G-R4`, verbatim y sin cambios desde la vuelta anterior: *«cubre las
**seis** tablas de esta épica»*. Y `V/20` §2: *«sobre las **nueve** máquinas, en las dos épicas»* —
nueve máquinas es correcto (`NUCLEO/03` lo justifica), **siete tablas** no es lo mismo, y `B/03` §4
y §5 (Grace y Pausa) siguen siendo tablas de dos columnas sin `desde` ni `evento`, porque
`NUCLEO/03` §1 regla 6 declara que no son máquinas propias.

**Dónde lo permite el diseño.** `B/20` §2 (`G-R4`); `V/20` §2 (`G-R4`); `NUCLEO/03` §1 reglas 6 y 7;
`NUCLEO/01` §2.2; `B/03` §4 y §5.

**Severidad.** `MEDIA` — sin cambios respecto de la vuelta anterior.

**¿Es nuevo, o es el arreglo?** Es **`F-8dB2-012` que sigue llegando**, con su ID viejo. `B/20` fue
tocado por tres commits de esta tanda (`a85f5bb7e`, `4e383480d`, `6bac7e63a`, medidos con
`git show --name-only`) —`G-R1-D` pasó de tres sitios a cuatro y `G-R1-E` es nuevo— y la celda de
`G-R4` quedó igual.

**¿Lo habría encontrado el grep?** **No**, por la razón de la vuelta anterior: el defecto no es una
aparición de `G-R4` sino **contar tablas**, que es lo que hace el propio guard.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, y acá el motivo es distinto y vale
anotarlo: la aparición está en un archivo y una tabla que tres commits editaron, y lo que hay que
resolver no es *«¿esta frase sigue siendo correcta después de mi cambio?»* —no lo era **antes**
tampoco— sino *«¿este número es cierto?»*. La obligación 2 vigila la **estabilidad** de una
afirmación bajo un cambio, no su **verdad**.

---

### F-8eB2-007 — `G-R1-E` se ancla en tres lugares donde puede vivir un predicado —condición, invariante, guard— y el predicado sobre `sucede_a` que decide si un pago reactiva vive en un cuarto: la columna de EFECTOS de `MP1` y `MP4`, que no figuran en el inventario que su segunda mitad cuenta

**Qué se rompe.** El guard que la tanda escribió para cerrar el defecto que costó un `CRITICA` —la
paráfrasis que omite *«viva»*— deja afuera por enumeración la columna donde esa misma paráfrasis
está escrita hoy, dos veces, sobre el acto que mueve dinero.

**El camino.**

1. **El predicado de `G-R1-E`, verbatim** (`B/20` §2): *«un **predicado sobre `sucede_a`** —**en la
   columna *condición* de una transición, en el enunciado de un invariante o en otro guard**—
   pregunta si **hay una fila apuntando** sin exigir que esa fila **esté viva**; o un consumidor
   nuevo del término *«fila viva»* **no figura** en el inventario de `NUCLEO/01` §2.4 …»*. Tres
   lugares, enumerados.
2. **La paráfrasis vive hoy en un cuarto.** `MP1`, columna **efectos** (`B/03` §7): *«la suscripción
   sale de `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora de una
   sucesión en curso**»*. `MP4`, columna **efectos**: *«la suscripción sale de `SUSPENDED` por `S7`
   — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: misma herencia
   y misma razón que `MP1`»*. Ninguna de las dos dice *«viva»*.
3. **Y es la columna que decide, no una glosa.** `B/20` §2 lo escribe él mismo al explicar
   `G-R1-D`: *«**El guard existe porque la regla se ejecuta en cuatro lugares y no en uno**: `S5`,
   `S7`, **el efecto de `MP1`** y **el de `MP4`**, y el camino que la olvide en cualquiera de los
   cuatro produce el daño entero»*.
4. **Ninguna de las dos figura en el inventario, que es lo que la segunda mitad del guard cuenta.**
   Recorrí las **20** filas de `NUCLEO/01` §2.4 (6 + 4 en el grupo A, 10 en el B): están `S17` (7),
   `S19` (8), `B/12` §5.3 (13), `G-R1-D` (14), la primera comprobación del barrido (15) y la
   partición de `B/02` §2.2 (16). **`MP1` y `MP4` no tienen fila.** Y la regla de uso 3 del mismo §
   lo exige: *«**quien escribe un consumidor nuevo agrega su fila al inventario de arriba en el
   mismo acto**, antes de declarar el cambio aplicado»*.
5. **El commit de `MP4` no podía cumplirla**: `71615bb41` toca `nucleo/07`, `B/03`, `B/05`, `B/12`,
   `B/19` y `B/20` — **no `nucleo/01`** (medido con `git show --name-only`).

**Por qué hoy no produce daño.** `G-R1-D` está escrito con el adjetivo puesto —*«tiene una sucesora
**viva** con `sucede_a` apuntándola»*— y cubre los cuatro sitios, así que un implementador que siga
el guard hace lo correcto. Lo que falla es la **detección** del caso siguiente: el guard del término
no mira la columna donde el término se está usando, y el inventario que su segunda mitad compara
arranca con dos filas menos que sus consumidores, así que *«la lista tiene una fila menos que los
consumidores»* ya es verdad el día que el guard se escribe.

**Dónde lo permite el diseño.** `B/20` §2 (`G-R1-E` y su párrafo, `G-R1-D` y el suyo); `B/03` §7
(`MP1`, `MP4`); `NUCLEO/01` §2.4 (`NUCLEO`: el inventario de 20 y la regla de uso 3).

**Severidad.** `MEDIA` — no hay daño de plata hoy porque `G-R1-D` cubre el comportamiento. Lo que
queda sin vigilancia es el mecanismo que la tanda construyó para que el defecto no vuelva.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos**: `G-R1-E` lo crea `f4edbdfdf` (familia
de la sucesión) con su enumeración de tres lugares, y `MP4` lo crea `71615bb41` (`DEC-SUB-012`) sin
poder agregar su fila al inventario.

**¿Lo habría encontrado el grep?** **Sí, el de `71615bb41`.** El término es *«la predecesora de una
sucesión en curso»*. `71615bb41` **no toca** `nucleo/01`, así que hasta `DEC-METH-009` lo alcanzaba:
un `rg "sucesión en curso"` sobre `NUCLEO/01` devuelve el inventario y su regla de uso 3, que dice
en una línea qué había que hacer. **Es el caso más barato de los trece.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** El inventario y su regla de uso 3 están
en un archivo y un párrafo que `71615bb41` no tocó, y la aparición no se corrigió: es exactamente lo
que la obligación 2 manda escribir, y la obligación **4** —*«el arreglo que crea un consumidor nuevo
agrega la fila antes de declararse aplicado»*— lo pide de frente. **La enmienda alcanzaba por dos
puertas y no se ejecutó por ninguna.**

---

### F-8eB2-008 — `MP5` pone a todo pagador manual en `GRACE_PERIOD` el primer instante de cada período, y de ahí salen tres consecuencias que ningún § recorre: `S11` y `S8` dejan de ser alcanzables la mayor parte del ciclo, no se le puede vender un addon, y el catálogo le manda el aviso de impago a alguien que no debe nada

**Qué se rompe.** El pagador manual queda estructuralmente en el estado que el resto del diseño usa
para significar *«no pagó»*, sin haber dejado de pagar nada. Tres reglas escritas contra ese
significado se le aplican por el estado y no por el hecho.

**El camino.**

1. **`MP5` y `S4` corren en el mismo acto.** `MP5` (`B/03` §7): *«**es la entrada de esta máquina, y
   la crea el sistema, no un admin.** Sólo corre con la suscripción en **`ACTIVE`** …, y **en el
   mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`**»*. Y `S4` lo confirma desde su
   evento: *«en un pagador manual eso es que `MP5` abrió la cuota del período y **no hay pago
   acreditado contra ella**»*. Al abrirse la cuota no hay pago por definición.
2. **Entonces la fila sale de `ACTIVE` el día 1 de cada período y vuelve cuando el admin registra.**
   El § lo escribe como diseño: *«los dos [`MP1` y `MP2`] declaran que la suscripción está en
   `GRACE_PERIOD` cuando el admin actúa»*.
3. **Consecuencia 1 — no puede cancelar ni pausar durante esa ventana.** `S11` y `S8` salen sólo de
   `ACTIVE` (`B/03` §3.2). Es el agravante de `F-8eB2-003`: para esta población el acto de la baja
   tiene una ventana intermitente además de no tener fila desde `SUSPENDED`.
4. **Consecuencia 2 — no se le puede vender un addon, y por una razón que sobre él es falsa.**
   `B/16` §2.2: *«| `GRACE_PERIOD` | **no** | el servicio corre, pero **hay un cobro que no entró**:
   venderle algo más a **quien no pudo pagar lo anterior** es agrandarle la deuda |»*. El pagador
   manual está ahí el día 1 del período: no hay ningún cobro que haya fallado y nadie dejó de pagar
   nada. El § lo declara *«la lectura que más se equivoca»* para otro caso y acá lo ejecuta él mismo.
5. **Consecuencia 3 — el aviso.** `B/03` §4, *«qué pasa durante»*: *«§20: servicio activo, fichas
   publicadas, edición activa, entitlements activos, **advertencias y correos**»*, con los del §42.3
   *«relativos al vencimiento»*. `MP5` recorrió **dos** destinatarios —admin y cliente— y para el
   cliente concluyó que *«ya está cubierto por *«renovación por venir»*»*; lo que no recorrió es que
   **`S4` dispara por su cuenta las advertencias del grace**, que le dicen a alguien al día que
   regularice.
6. **Y el § sí verificó la mitad vecina, lo que muestra que el recorrido existió y se quedó corto.**
   Chequeó `CHARGE_DECLINED` (*«población vacía»*), `puedePausar()` para las dos clases de pausa,
   `C5`, las cuatro condiciones de `B/05` §3 y el catálogo de doce acciones. **`S11`, `B/16` §2.2 y
   las advertencias del §20 no están en esa lista.**

**Dónde lo permite el diseño.** `B/03` §7 (`MP5`, `MP1`, `MP2`) y §7.2 (las seis filas de *«desde
qué estados se crea»*, *«cómo entra el grace»*, *«el aviso»* y *«lo que NO cambia»*) y §3.2 (`S4`,
`S8`, `S11`) y §4 (qué pasa durante el grace); `B/16` §2.2 y §2.3; `NUCLEO/07` §6;
`01-decision-log.md`, `DEC-SUB-002`, `DEC-SUB-013`.

**Severidad.** `MEDIA` — no mueve plata mal y la cobertura no se pierde (`GRACE_PERIOD` emite
fuente, `12-contrato…` §2.6). Lo que se rompe es que el estado deja de significar una sola cosa para
una vertical entera —Partner, que el §17.2 admite como el caso del pagador manual— y tres reglas
escritas contra el significado viejo se le aplican igual.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-013`** (`71615bb41`), que creó `MP5` y
eligió deliberadamente reusar `S4` en vez de una fila nueva (*«con `MP5` el hecho queda nombrado y
**no hace falta una fila nueva**»*).

**¿Lo habría encontrado el grep?** **Sí, para dos de las tres.** El término nuevo es *«`MP5` abrió
la cuota»* / *«el grace del pagador manual»*. `71615bb41` **no toca `B/16`**, así que hasta
`DEC-METH-009` alcanzaba: `rg "GRACE_PERIOD" B/16` devuelve la fila de §2.2 con su razón escrita en
la misma celda. Para las advertencias del §20 el grep es sobre `B/03` §4, en el archivo que el
commit sí toca — ahí hace falta la obligación 1.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, la de `B/16` §2.2.** Es un archivo que
`71615bb41` no tocó y un párrafo que nadie corrigió: cae de lleno en la obligación 2. La de
`B/03` §4 también, porque el commit editó §7 y §7.2 y **no** §4. **La enmienda alcanzaba por las
dos y no se ejecutó.**

---

### F-8eB2-009 — `S13` declara que apaga la bandera del pago pendiente «en el mismo acto» y su `desde` no alcanza a la única fila que puede tenerla cuando el grant cae sobre una sucesión ya cerrada

**Qué se rompe.** La rama 4 de `B/12` §5.3 —*«cae un grant *Free Forever*»*— tiene su acto
disparador declarado como `S13`, y `S13` apaga la bandera **sobre las filas que alcanza**. Cuando el
grant cae después de que `S18` ya cerró la sucesión, la predecesora está `CANCELLED` —fuera del
`desde` de `S13`, que son *«los seis estados»* vivos— y la bandera, si `S18` no llegó a resolverla,
no la apaga nadie por esa puerta.

**El camino.**

1. `S13` efecto, verbatim: *«**Y si alguna de las filas alcanzadas retenía un pago pendiente por
   `S19`, la bandera se apaga en el mismo acto, sin reembolso**»*. El sujeto es *«las filas
   alcanzadas»*, y el `desde` es *«toda fila viva PRINCIPAL … los seis estados»*.
2. Una predecesora cuya sucesión **ya se cerró** está `CANCELLED` (`S17`), que no es uno de los seis
   (`B/02` §2.2). El grant que cae después no la alcanza.
3. En el curso normal eso está bien: `S18` ya le puso la marca por la rama 1 y la bandera ya se
   resolvió. **El caso que queda es el de la corrida en que `S18` no ejecutó su cuarta escritura**,
   que es precisamente lo que `G-R1-C` vigila y lo que la segunda comprobación de `B/09` §3 existe
   para detectar.
4. Y ahí la salvedad **3** del barrido sí la devuelve —*«una suscripción terminal con un pago
   acreditado pendiente de resolución por `S19` … hasta que la bandera se apague»*—, así que el caso
   está cubierto. **Lo que no está es la frase**: la tabla de los cinco actos disparadores de
   `B/12` §5.3 atribuye la rama 4 a *«`S13` (efecto) | **las dos** [filas]»*, y sobre una sucesión ya
   cerrada `S13` alcanza a **una** —la sucesora, si sigue viva— o a ninguna.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S13` `desde` y efecto, `S17`, `S18`); `B/12` §5.3 (la
rama 4 y la tabla de los cinco actos, columna *«sobre qué fila»*); `B/09` §3 (salvedad 3 y segunda
comprobación); `B/02` §2.2 (los seis vivos).

**Severidad.** `MEDIA` — el desenlace de plata es el correcto y el barrido lo alcanza por la
salvedad 3, que esta misma tanda escribió. Lo que queda mal es la atribución *«las dos»* de la tabla
de disparadores, que es la lista contra la que alguien va a auditar si cada rama tiene acto.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 13/rama 5** (`4e383480d`), que escribió la tabla
de los cinco actos, cruzado con `1c17565e1`, que le agregó a `S13` el apagado de la bandera. La
tabla se escribió antes de que `S13` tuviera ese efecto y no se recorrió después.

**¿Lo habría encontrado el grep?** **Sí, con el alcance nuevo.** El término es *«la bandera se
apaga»* / *«pendiente por `S19`»*. `1c17565e1` toca `B/03`, `B/09` y `B/02` — **no `B/12`**, así que
hasta `DEC-METH-009` alcanzaba: `rg "rama 4|apaga la bandera" B/12` devuelve la fila de la tabla en
una línea.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** `B/12` §5.3 es un archivo y un párrafo
que `1c17565e1` no tocó, y la aparición no se corrigió. **La enmienda alcanzaba y no se ejecutó.**

---

## BAJA

### F-8eB2-010 — La lista de flujos críticos de E2E salta del 6 al 8: el ítem 7 se perdió y el que quedó en su lugar no menciona ni grants ni cortesías ni pago manual

**Qué se rompe.** La lista que `B/20` §5 publica como *«los flujos críticos … los que mueven plata o
cortan servicio»* tiene siete ítems numerados 1, 2, 3, 4, 5, 6 y **8**. No hay ítem 7, así que o se
borró uno sin renumerar —y nadie sabe cuál— o la numeración miente sobre cuántos son.

**El camino.** Lo conté con `rg '^[0-9]+\. ' B/20` sobre el texto de hoy: devuelve las líneas 234,
236, 237, 239, 240, 241 y 242, con los números `1 2 3 4 5 6 8`.

**Y la lista se quedó corta además de saltada**, contra lo que la tanda agregó: no hay un flujo para
el **grant** (`S13` + `S20`, dos fan-outs con una llamada por fila y su ejecución parcial declarada
indetectable), ni para el **pago manual** (`MP1`…`MP5`, la máquina entera que la tanda cerró), ni
para la **cortesía** sobre una sucesión (`S18` cuarto efecto). El ítem 6 nombra *«revocación»*, pero
la de `DEC-RF-001` —reembolso más cancelación—, no la del grant.

**Dónde lo permite el diseño.** `B/20` §5 (la lista) y §2 (los once guards, que sí crecieron).

**Severidad.** `BAJA` — no hay daño de plata y el hueco es de cobertura declarada, no de
comportamiento.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, indirectamente: el 3 y `DEC-ADDON-003`.** `B/20`
fue tocado por tres commits de la tanda (`a85f5bb7e`, `4e383480d`, `6bac7e63a`), los tres para
agregar o reescribir guards en §2, y ninguno bajó al §5.

**¿Lo habría encontrado el grep?** **No.** No hay término que buscar: es una numeración.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No**, por lo mismo. Es el tipo de defecto que
sólo encuentra contar una lista, que es lo que las instrucciones de esta fase piden explícitamente y
lo que ninguna regla de la tanda cubre.

---

## Ataques que intenté y el diseño resistió

Diez, y van porque el valor de esta sección es que la próxima pasada no los repita.

1. **`S13` alcanza a las suscripciones de complemento y le borra los addons al beneficiario de
   *Free Forever*** (`F-8dB2-002`, `CRITICA` de la vuelta anterior). **Cerrado, y por el lado
   correcto.** El `desde` dice *«toda fila viva **PRINCIPAL**»*, el §3 obliga a toda transición
   sobre un conjunto a contestar, `B/16` §4.2 ganó su tercera mitad —*«ningún grant permanente la
   releva»*— y `S20` cubre la otra dirección con **una condición evaluada** en vez de pertenencia.
   Verifiqué las tres filas de scope del §3.4 contra `B/16` §4.2 y contra el *«conserva los dos»*
   del `12-contrato…` §2.4: hoy son consistentes.

2. **El reembolso de la rama 1 no tiene disparador** (`F-8dB2-003`, `CRITICA`). **Cerrado.** `S18`
   tiene hoy *«**cuatro** escrituras»* y la cuarta es, verbatim, *«si la predecesora retiene un pago
   pendiente por `S19`, se le pone a **ELLA** la marca `requiere_conciliación` con motivo *«reembolso
   por confirmar»*»*; `G-R1-C` la vigila por separado y la salvedad 3 de `B/09` §3 devuelve la fila
   terminal al barrido. Las tres piezas están y encajan.

3. **`S19` no admite el pago manual** (`F-8dB2-004`, `CRITICA`). **Cerrado, y con la razón escrita.**
   El evento pasó a enunciarse *«sobre el HECHO —entró el pago del período impago, por cualquiera de
   sus DOS puertas— y no sobre el mecanismo»*, y `MP4` entra por la misma puerta sin ampliarlo.
   Intenté una tercera puerta y el § la cierra contando: *«las formas de que entre plata del período
   impago son exactamente dos, y las dos están declaradas»*. Recorrí el corpus y no encontré una
   tercera.

4. **Nadie limpia `sucede_a` y cuatro de cinco predicados no exigen *«viva»*** (`F-8dB2-001`,
   `CRITICA`). **Cerrado por construcción, no por parche.** La tabla de estados de la relación pasó
   a **cuatro** con el cuarto nombrado (*«sucesión muerta sin cerrarse»*), el adjetivo está en `S17`,
   `S19`, `B/12` §5.3, `B/16` §4.2 y `G-R1-D`, y el inventario de `NUCLEO/01` §2.4 lo convierte en
   contable con `G-R1-E`. Recorrí las 20 filas del inventario buscando una sin adjetivo y no la hay;
   lo que falta no es un adjetivo sino dos consumidores (`F-8eB2-007`).

5. **La rama 4 deja la bandera puesta para siempre** (`F-8dB2-013`, `BAJA`). **Cerrado**: `S13`
   apaga la bandera en el acto, con la razón escrita en su propia celda (*«dejarla puesta sobre una
   `CANCELLED` deja un «pendiente» que ningún barrido alcanza y que todo conteo de pagos pendientes
   cuenta de más»*). Lo que quedó es la atribución de la tabla de disparadores (`F-8eB2-009`).

6. **`S21` alcanza también a una suscripción principal, porque el verbo *«cuelga»* nombra dos
   relaciones distintas en `B/02`.** No lo sostengo: el `desde` dice *«toda fila viva **DE
   COMPLEMENTO**»*, así que el conjunto ya está partido por `clase` antes de llegar al verbo. La
   frase *«acá no hace falta acotarlo»* es una explicación de por qué la acotación es redundante, no
   la acotación misma — que sí está.

7. **`S20` y `S21` comparten el `desde` con las mismas palabras y se pueden satisfacer a la vez.**
   No: `S20` declara explícitamente *«**La instancia no cambia de estado**»*, así que en su acto no
   hay ninguna instancia llegando a `CANCELLED`, que es el evento de `S21`. Y `NUCLEO/03` §1 regla 7
   lo anota como el quinto caso de *«compartir el `desde` no es compartir el par»*. El razonamiento
   es correcto y verificable sobre las dos celdas.

8. **`D16` se rompe con pausas encadenadas: 8 pausas-mes acumuladas son ~240 días contra 180 del
   hard delete.** No: el reloj **se reinicia al salir de cada pausa** por el hecho 2 de
   `NUCLEO/01` §1.2 (*«`cubierto` pasa a verdadero»*), y `V/03` §9 lo dice con esas palabras —*«las
   pausas encadenadas no acumulan porque cada reanudación reinicia»*—. Intenté también la pausa por
   `COURTESY`, que no pasa por `puedePausar()` y no tiene tope declarado: ahí no hay exposición
   porque una `PAUSED` por `COURTESY` **sí** emite fuente (`12-contrato…` §2.6), así que no acumula
   inactividad. `G-R5` compara el número correcto.

9. **`MP5` acumula cuotas al reactivar por `MP4`, porque el ancla vieja deja los inicios de período
   en el pasado.** No: el § lo vio y lo resolvió con el re-anclaje (*«**No es una elección, es lo
   único compatible con (b)**»*), y la idempotencia de `MP5` —*«no crea si ya existe una fila de
   `manual_payment` para ese período»*— es una condición sobre la fila y no sobre la fecha, así que
   correr tarde no pierde un período y correr dos veces no crea dos. Intenté también hacer colisionar
   el `UNIQUE(subscription_id, período)` de `B/05` §C5 con el re-anclaje y el § lo separa
   explícitamente: ese `UNIQUE` es *«sobre pagos acreditados»* y una cuota en `AWAITING` no lo está.

10. **`T7` le devuelve el trial a quien nunca lo tuvo, o se lo quema dos veces al encenderse y
    apagarse una vertical.** No lo sostengo: su `desde` es `PRE_TRIAL` y quien ya tiene fila no está
    ahí, así que un segundo encendido no la alcanza; y su condición —*«ya ejerció el hecho que la
    vertical declara como evento de activación»*— se lee contra el registro append-only de eventos de
    dominio (`NUCLEO/08` §1.3), que es duradero y no cruza la frontera. La tabla de dos poblaciones
    del §*«por qué la condición es «ya ejerció el evento» y no `cubierto`»* recorre el dominio
    entero.

---

## Lo que cae fuera de mi vector, y a quién le toca

- **Cuánto cuesta la cortesía perdida de `F-8eB2-001` en dinero** —si corresponde crédito o
  reembolso, y con qué regla de `DEC-SUB-006`— es de `B1`.
- **`F-8eB2-002` visto desde la cobertura** —qué le pasa al pliegue y a `PB2` cuando una instancia
  queda `ACTIVE` sin ancla-título y el grant se revoca— toca a `A2`.
- **La detección de `F-8eB2-002` desde el barrido** —si la cuarta comprobación tiene que mirar
  también la instancia cuyo ancla-título es nula sobre un beneficiario con ancla viva— es de `B3`.
- **`F-8eB2-006` y `F-8dB2-012`** son defectos de conteos que viven mitad en `B/03`/`B/20` y mitad
  en `NUCLEO/03` §1 regla 7; **el enunciado de la regla y el alcance de `G-R4` son `NUCLEO`**, para
  la pasada C.
- **`F-8eB2-007`** es mitad `B/20` y mitad `NUCLEO/01` §2.4: el inventario y su regla de uso 3 son
  **`NUCLEO`**.
- **`F-8dB2-006`**, igual que la vuelta anterior: la mitad corregible es la columna `desde` de
  `B/03` §3.2 y por eso va acá; **el enunciado de la regla 7 es `NUCLEO`**.
