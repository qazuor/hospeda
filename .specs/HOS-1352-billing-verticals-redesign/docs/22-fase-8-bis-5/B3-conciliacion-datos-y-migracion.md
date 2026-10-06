---
title: "FASE 8-bis-5 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# B3 · conciliación, datos y migración — quinta vuelta

**Vector**: lo que el barrido ve y lo que no, lo que la base guarda y lo que no, y el corte.
**Material**: `B/02` (§2.2, §2.4, §2.5, §2.6, §5), `B/03` (§3.2, §7, §8, §10.1), `B/05` (§2, §3),
`B/09` entero, `B/12` §5.3, `B/14` §4.4 y §4.6, `B/16` §4.2-4.4, `B/19` §4 y §6, `B/20` §2,
`B/21`, `NUCLEO/01` §2.4-2.6, `NUCLEO/03` §1, `NUCLEO/04`, `NUCLEO/08` §3 y §4.3,
`12-contrato…` §2.6 y §2.8, `06-mp-validation-matrix.md` fila `RC-5`, y **cuatro de los diez
rastros de la 9-bis-4, leídos línea por línea**.

**Cómo se recorrió, y cambió respecto de la vuelta anterior.** Las tres vueltas previas midieron
que mi modo dominante era *«la ausencia»* —la columna que no existe, la fila que falta—. Esta
vuelta tiene un material que ninguna anterior tuvo, así que se recorrió en **dos pasadas**:

| pasada | qué se recorrió | tamaño | resultado |
|---|---|---|---|
| **1 · el rastro** | las entradas de los rastros que tocan **mis** archivos (`B/02`, `B/05`, `B/09`, `B/14`, `B/21`), línea por línea, verificadas **contra el texto de hoy** | **92 líneas**, en 4 rastros | **2 falsas** — `F-8fB3-003` y `F-8fB3-004`. Las dos son del mismo modo, y es un modo nuevo: *«la justificación era cierta en su SHA y un commit POSTERIOR DE LA MISMA TANDA la volvió falsa»* |
| **2 · el consumidor, no el término** | por cada predicado del cap. 09 y por cada motivo del `B/02` §2.5: *«¿contra qué columna se evalúa?»*, *«¿cuántas filas puede haber?»*, *«¿qué pasa en la corrida siguiente?»* | **13 motivos** × **11 escritores** (5 comparaciones + 6 comprobaciones), **3 disparadores de `S9`**, **7 tablas de transiciones** | 7 hallazgos |

**Conteo de este informe** (contado sobre los `###` de la sección 1, no estimado):

| | |
|---|---|
| hallazgos nuevos | **9** |
| `CRITICA` | **2** |
| `ALTA` | **5** |
| `MEDIA` | **1** |
| `BAJA` | **1** |
| **atribuidos a un arreglo, un guard o una decisión de la 9-bis-4** | **7 de 9** · **1 de 2** entre los `CRITICA` |
| de esos 7, **que el grep habría encontrado** | **1 de 7** |
| de esos 7, **que el rastro atrapó** (está en el rastro con justificación falsa) | **2 de 7** |
| de esos 7, **que el rastro debería haber cubierto y no cubrió** | **2 de 7** |
| de esos 7, **que caen en la exclusión viva de `DEC-METH-011`** (prosa que el commit escribió) | **3 de 7** |
| **del modo «la ausencia»** | **3 de 9** — bajó de 6 de 9 |

**Números que cito y no medí yo**: `RC-5`, `RC-6`, `EX-6`, `EX-11`, `EX-15`, `EX-20`, `PS-4`,
`PS-6`, `GR-3` y `PA-3` salen de `06-mp-validation-matrix.md`; la población de producción (8 filas,
2 `comp`), de `07-facts-inventory.md`. **Los conté yo sobre el texto de hoy**: los **13** motivos de
`B/02` §2.5, las **6** comprobaciones de cero llamadas y las **4** salvedades de `B/09` §3, las
**10** puertas *«no»* de la tabla de las trece, los **9** consumidores de *«grant vivo»*/*«ancla
viva»* de `NUCLEO/01` §2.4, los **8** de *«cortesía diferida»* de §2.6, las **8** filas de `B/03`
§10.1 y las **7** tablas de transiciones de las dos épicas.

**Límite respetado.** `DEC-MIG-004` cerró los cinco críticos de la población de producción y **este
informe no reabre ninguno de los cinco**. `F-8fB3-003` toca `B/21` §2.4 y no toca ni el orden del
procedimiento, ni la lápida, ni la cohorte, ni `PB2`, ni el período ya pagado: toca una
**restricción de la base que se creó después de escrito el capítulo**. `DEC-MP-003` y `DEC-MP-004`
no aparecen; la discontinuación de una vertical tampoco, salvo para mostrar que `B/14` §4.6 la
usa para dar por cerrado un caso **distinto** (`F-8fB3-005`).

---

## 1. Hallazgos

### F-8fB3-001 — `B/09` §4 decide «no cobró nunca» con `charged_quantity`, que cuenta INTENTOS: sobre un alta rechazada la regla concluye «sí cobró», y es la regla que el §3 usa para la cuarta de sus cinco comparaciones

**Qué se rompe.** A un cliente le rechazan el único cobro de su suscripción. El preapproval queda
con `charged_quantity: 1` y `charged_amount: 0`. El barrido diario llega a esa fila, corre la
comparación *«cobros del período»*, la resuelve por el §4, lee el contador en **uno** y concluye
**«cobró»**. La suscripción de alguien que no pagó un peso pasa por el barrido como una que pagó,
y el único proceso que mira la cartera entera queda **con el signo invertido** sobre la población
del primer cobro rechazado — que es la misma que `S16` manda a `CHARGE_DECLINED` y la misma sobre
la que `B/12` §4.4 le pide al cliente que empiece de nuevo.

**El camino.**

1. **El §4 lo decide con ese campo, y es su primera fila.** *«`GET /authorized_payments/search?preapproval_id=`
   devuelve **cero** por tres causas distintas»*, y la primera: *«**no cobró nunca** | el preapproval
   tiene `charged_quantity` en cero o nulo»* (`B/09` §4).
2. **Y lo eleva a regla del carril**: *«**La regla que sale de esto: la conciliación nunca concluye
   «no cobró» desde ese endpoint.** Concluye desde el contador del preapproval, y usa el endpoint
   para traer el detalle»* (`B/09` §4).
3. **El contador no cuenta cobros.** `RC-5` (`NOT_SUPPORTED`, producción, 2026-09-22): *«el
   preapproval `792eb0064a…`, cuyo **único** cobro fue rechazado por el proveedor, quedó con
   **`charged_quantity: 1` y `charged_amount: 0`** — y de yapa **`last_charged_amount: 15`**, o sea
   tres campos del mismo objeto contándose distinto»*; y `renov-ok` con *«`charged_quantity: 6` y
   `charged_amount: 75` = **cinco** cobros de ARS 15 más el rechazado contado como sexto»*.
4. **Aplicada al sujeto medido, la regla da lo contrario de lo que es.** `charged_quantity` en uno
   **no** es *«cero o nulo»*, así que la primera fila no se cumple, y el §4 no tiene ninguna otra
   que la cubra: las otras dos causas son el **lag** (*«cobró y el endpoint todavía no lo
   indexó»*) y **el id de otra cuenta** (*«la lectura por id del preapproval falla»*), y ninguna de
   las dos es verdadera acá — la lectura por id funciona y no hay nada que indexar. **El § se
   titula *«Los tres modos de «cero cobros»»* y hay un cuarto**: cobró cero **porque el cobro se
   rechazó**, con el contador en uno.
5. **No es un § suelto: es el que resuelve una de las cinco comparaciones del barrido.** La cuarta
   fila de la tabla del §3 es *«cobros del período | los `authorized_payments` del preapproval |
   **ver §4**»*. O sea que el defecto no vive en una nota al pie: vive en el brazo del barrido que
   decide si una fila cobró.
6. **Y la única salida alternativa que el § ofrece también está medida en falso.** *«usa el
   endpoint para traer el detalle»* se apoya en el `status` del `authorized_payment`, y `RC-6`
   —`NOT_SUPPORTED`, el mismo día— mide que *«el `status` de un authorized_payment **no dice si se
   cobró**»*. Las dos mitades de la regla del §4 —el contador para concluir, el endpoint para el
   detalle— están hoy medidas como no aptas para lo que el § les pide.
7. **El desenlace concreto, dicho sobre una persona.** El cliente cuyo primer cobro se rechazó
   entra a `CHARGE_DECLINED` (`S16`) y el proveedor cancela la autorización *«en el mismo
   milisegundo»* (`B/12` §4.4). Esa fila está **exenta** del barrido por la primera puerta de la
   tabla de las trece, así que el daño no se ve ahí. Se ve en las poblaciones donde el mismo
   contador decide y la fila **sigue viva**: la fila `authorized × GRACE_PERIOD · SUSPENDED` del
   `B/03` §10.1 —*«el preapproval está vivo y **nuestro reloj dice que no cobró**»*— y la ventana de
   tolerancia del `B/09` §6.2, que *«no puede tratar como divergencia un cobro que todavía no
   apareció»*. En las dos, *«¿cobró?»* se contesta con el contador, y un intento rechazado lo sube
   igual: el barrido concluye que el cobro entró y **deja de mirar** a una fila cuyo cobro falló.

**Dónde lo permite el diseño.** `B/09` §4 (las tres filas y la regla), `B/09` §3 (cuarta
comparación, que delega en el §4), `B/09` §6.2 y `B/03` §10.1 (fila `authorized × GRACE_PERIOD ·
SUSPENDED`), contra `RC-5` y `RC-6` de `06-mp-validation-matrix.md`.

**Severidad.** `CRITICA`. El único proceso periódico del sistema concluye *«cobró»* sobre una
suscripción que no cobró, y las dos poblaciones donde eso importa son las que el diseño mira
justamente para no dejar a alguien pagando —o sin pagar— sin que nadie lo vea. La matriz lo ancló
con la palabra *«contradice una regla escrita»* y con el sujeto medido en producción.

**¿Es nuevo, o es el arreglo?** **Es nuevo, y no lo introdujo ninguna tanda de arreglos.** El §4
está escrito desde que existe el capítulo; lo que cambió el 2026-09-22 es que **se midió el campo**
y resultó ser otra cosa. Es el §4.1 de las instrucciones de esta pasada, tomado como encargo.

**¿Lo habría encontrado el grep?** No aplica (no lo introdujo un arreglo). Si se aplicara: el
término es **`charged_quantity`**, y `rg -n "charged_quantity"` sobre las dos épicas, el núcleo y
el contrato devuelve **2 líneas en 1 archivo** —las dos del `B/09` §4— y **nada más en todo el
corpus**. O sea que el campo que decide *«¿cobró?»* está nombrado en dos renglones y las dos
poblaciones donde su respuesta importa (`B/03` §10.1 y `B/09` §6.2) lo citan **sin nombrarlo**:
*«nuestro reloj dice que no cobró»*, *«un cobro que todavía no apareció»*. **La pregunta se
propaga sin el término**, que es por qué grepear el campo no da el alcance del defecto.

**¿La resolución POR APARICIÓN lo habría atrapado?** No aplica por lo mismo. Lo que sí vale decir:
**ninguno de los diez rastros tiene una sola entrada sobre `B/09` §4.** Lo verifiqué con
`rg -n "tres modos|cero cobros|charged"` sobre los diez, y devuelve cero apariciones del §. Los
rastros que tocan `B/09` (`f21d5d828`, 4 entradas; `8d6b27a12`, 10) recorrieron los §2.4, §3 y §5
y **saltearon el §4 entero**, que es el único § del capítulo que decide contra un campo del
proveedor. No es un defecto del rastro —nada de la tanda tocó ese §— pero sí dice dónde **no** hay
cobertura: la obligación recorre **apariciones de términos que la tanda movió**, y un § que la
tanda no movió es invisible aunque su premisa se haya caído afuera.

---

### F-8fB3-002 — La marca lleva UN pago y es única por `(fila, motivo)`: el segundo cobro posterior a una baja no tiene dónde escribirse, y la persona devuelve el único que el listado le nombra y levanta el caso con el resto de la plata adentro

**Qué se rompe.** Una cancelación nuestra que el proveedor aceptó y no aplicó deja un preapproval
cobrando **todos los meses** sobre una fila `CANCELLED`. El primer cobro abre la marca
`COBRO_POSTERIOR_A_LA_BAJA` con **la referencia a ese cobro**. El segundo, el tercero y el cuarto
**no pueden abrir ninguna**: el `UNIQUE` los rechaza. El listado accionable le muestra a la persona
**un** pago, con el default en **devolver**; la persona devuelve ése, `S15` levanta la marca, el
caso se cierra — y los meses 2 a N quedan cobrados, sin marca, sin `refund` y sin nadie que los
mire. **Es estrictamente peor que el booleano**: el booleano decía *«hay un caso acá, andá a
mirar»*; la fila dice *«éste es el pago, devolvelo»*, y la persona hace exactamente eso.

**El camino.**

1. **La marca es una fila con UNA referencia a UN pago**: *«**`reconciliation_mark`** | la
   suscripción, el **motivo** …, **`puesta_en`**, **`levantada_en`** … y **el pago que hay que
   devolver** cuando el motivo lo pide — FK anulable a `payment` **o** a `manual_payment`»* (`B/02`
   §2.2). Es **una** FK, no una lista.
2. **Y es única por fila y motivo**: *«**`UNIQUE(subscription_id, motivo) WHERE levantada_en IS
   NULL`**: una fila puede tener **varias marcas abiertas a la vez, una por motivo**, y el mismo
   motivo no se duplica sobre la misma fila»* (`B/02` §2.2). El plural que el modelo admite es
   **por motivo**, y `NUCLEO/01` §2.5 lo confirma como el punto del término: *«el corpus escribe
   **trece** motivos distintos sobre el mismo sujeto»*.
3. **La población con dos cobros del mismo motivo es alcanzable, y la enumera el propio capítulo.**
   `S13` —el *Free Forever*— *«no tiene rama de fallo declarada: su destino es `CANCELLED` **pase
   lo que pase con la llamada**»* (`B/09` §3, tabla de las trece puertas). Si esa llamada no se
   aplicó —`EX-20` mide que *«un `PUT` con varios campos se aplica a medias con un solo `200`»*—
   la fila queda `CANCELLED` y el preapproval **`authorized`, cobrando en su ciclo**. Y *«cancelar
   **no emite webhook** (`EX-15`), así que si la llamada no se aplicó **no hay ninguna otra vía de
   aviso** y **el primer aviso es el cobro**»* (`B/09` §3, salvedad 4). Cada cobro que entra es,
   con las palabras de `B/05` §2 `C3`, *«un cobro posterior a un regalo»* → **marca
   `COBRO_POSTERIOR_AL_GRANT`, «también con la referencia al cobro»**. El ciclo es mensual: son N
   cobros, N referencias, **una sola casilla**.
4. **Y el estado no se corrige solo mientras tanto.** La salvedad 4 devuelve esa fila al barrido
   *«hasta que la relectura lo vea `cancelled`»* — y la relectura no lo va a ver nunca, porque la
   llamada falló y **ninguna transición la reintenta**: `S13` es *«reanudable fila por fila»*, no
   automática. Así que la fila queda en el barrido indefinidamente, con el preapproval cobrando.
5. **El listado cierra el caso sobre el único pago que conoce.** `B/19` §6: el listado muestra
   *«**el MOTIVO de cada marca, desde cuándo está abierta y, en las que devuelven plata, el pago,
   el monto y QUÉ PROPONE EL SISTEMA**»*, y para `COBRO_POSTERIOR_AL_GRANT` lo que propone es
   **devolver**. `S15` *«levanta **UNA** marca —la del motivo que esa persona resolvió—»* (`B/03`
   §3.2). Levantada esa, el `UNIQUE` vuelve a admitir una nueva… **para el cobro siguiente**, no
   para los que ya entraron: nadie guardó sus ids, porque la casilla estaba ocupada cuando
   llegaron.
6. **Y `G-R1-F` no lo ve, porque no es lo que vigila.** El guard falla si un camino *«abre la
   marca sin nombrar un motivo … o nombra uno que no está en esa tabla»*, o si el listado la
   muestra *«sin motivo, sin `puesta_en`, sin el pago o sin el default»* (`B/20` §2). Las tres
   cosas se cumplen: hay motivo, hay `puesta_en`, hay **un** pago. Lo que el guard no pregunta es
   **si había más de uno**.
7. **La cifra del §2.5 se vuelve falsa por el otro lado.** `B/02` §2.5 lo enuncia como una
   propiedad: *«**el monto está determinado**»* (fila 1) y, para los cuatro motivos con `SÍ`,
   *«hay plata del cliente que devolver»*. Con N cobros y una referencia, el monto determinado es
   el de **uno** de ellos, y el listado ordena *«adelante los cuatro motivos»* mostrando una cifra
   que es una fracción de la deuda.

**Dónde lo permite el diseño.** `B/02` §2.2 (la entidad `reconciliation_mark` y su `UNIQUE`) y
`B/02` §2.5 (fila 1 y filas 2-3) contra `B/05` §2 `C2` y `C3`, `B/09` §3 (tabla de las trece
puertas, fila de `S13`; salvedad 4), `B/19` §6 (el listado y el default) y `B/03` §3.2 (`S15`).

**Severidad.** `CRITICA`. Plata del cliente que el diseño declara que hay que devolver se queda en
nuestra cuenta, y el mecanismo que la deja adentro es **el que se escribió para no perderla**: la
marca con motivo, con referencia y con default. El daño crece con el tiempo —un cobro por ciclo— y
el acto que lo sella es el de la persona que **hizo bien su trabajo**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo de la familia de la sucesión** (`3310c9376`, dentro
de `rastro-f21d5d828.md`: *«`requiere_conciliación` deja de ser un booleano: la marca gana motivo,
reloj y referencia al pago, y pasa a ser una fila»*), más `DEC-RF-003` (`6b27f7615`), que le agregó
el **default en DEVOLVER**. Antes del arreglo la marca no nombraba ningún pago: la persona tenía
que buscar los cobros ella misma, y encontraba los N. El arreglo cerró `F-8eB3-003` —mi propio
crítico de la vuelta pasada, y bien— **y de paso convirtió una marca muda en una instrucción
precisa y parcial**, que es peor que muda porque se ejecuta.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es `reconciliation_mark` /
`UNIQUE(subscription_id, motivo)`, y `3310c9376` toca `B/02`, `B/03`, `B/05`, `B/09`, `B/12`,
`B/19`, `B/20` y el núcleo — o sea **todos** los archivos donde la marca aparece. Grepear *«los
capítulos que el commit NO toca»* devuelve cero. Y el defecto no es una aparición sino una
**cardinalidad**: el número de filas que la restricción admite contra el número de hechos que el
corpus puede producir. Ningún término lo nombra.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y el rastro lo muestra.**
`rastro-f21d5d828.md` §`B/05` tiene **cuatro** entradas y las cuatro son sobre las condiciones del
pago tardío; **ninguna es sobre `C2`/`C3` del §2**, que son las dos que escriben un motivo con
referencia al cobro. Y las apariciones que habría que comparar —la declaración del `UNIQUE` en
`B/02` §2.2 y las filas de `C2`/`C3`— **las escribió o editó ese mismo commit**, así que caen en la
exclusión que `DEC-METH-011` dejó viva a propósito: **modo 1 de `C1` §4.4** (la prosa que el commit
escribe). Es la tercera vez que mi vector reporta ese modo en tres vueltas.

---

### F-8fB3-003 — Línea de rastro FALSA: `rastro-ce52dce5f.md` declara correcta la única escritura del corte porque «nacen con `revocado_en` nulo», y el `UNIQUE` que `DEC-GRANT-009` definió sobre ese predicado —en la misma tanda, dos commits después— es el que puede rechazar la segunda

**Qué se rompe.** El corte escribe **dos** `permanent_grant` para las dos cortesías heredadas. Si
las dos son del mismo beneficiario, **la base rechaza el segundo `INSERT`** y una de las dos
cuentas amanece sin grant: sin `cubierto`, alcanzada por `PB2`, disparando `T1` en vez de `T6` —
que es exactamente el efecto que `B/21` §2.4 declara que hay que producir y que *«se observa allá»*.
Y no hay salida por la vía que el propio § prescribe: las dos cortesías son de **la misma
vertical**, así que colapsarlas en *«un grant con dos anclas»* choca con
`UNIQUE(permanent_grant_id, vertical)`.

**La línea de rastro, citada.** `rastro-ce52dce5f.md`, sección *«`B/12`, `B/19`, `B/21` y
`descomposicion.md` de billing (6)»*:

> - **`21-migracion.md` L129-133 · §2.4** — «Las dos cortesías se escriben como `permanent_grant`»
>   → **sigue correcta: nacen con `revocado_en` nulo.**

**Por qué es falsa hoy.**

1. **La justificación nombra el predicado exacto sobre el que se definió la restricción.**
   `ce52dce5f` es el commit que **creó** `revocado_en` (17:55 `-03` del 2026-09-21, medido con
   `git log -1 --format=%ad`). `01599ec6a` —`DEC-GRANT-008` y `DEC-GRANT-009`, de la tanda corta de
   las ocho decisiones, **posterior**— escribió: *«**`UNIQUE(beneficiario) WHERE revocado_en IS
   NULL`**: a lo sumo **un grant vivo** por beneficiario, y lo garantiza la base»* (`B/02` §2.4 y
   §5). O sea que *«nacen con `revocado_en` nulo»* dejó de ser la razón por la que la escritura es
   inocua y pasó a ser **la razón por la que dos no entran**.
2. **Y el capítulo nunca se volvió a mirar.** `git log 5ac5e92c9~1..HEAD -- …/21-migracion.md`
   devuelve **cero commits**: ninguno de los 76 de la tanda tocó `B/21`. Y `rg "B/21|21-migracion"`
   sobre `rastro-8d6b27a12.md` —el rastro de la familia que escribió el `UNIQUE`— devuelve
   **cero**: la familia que creó la restricción **no recorrió el único capítulo que escribe filas
   de esa tabla a mano**.
3. **Y el corpus se contradice sobre si son uno o dos beneficiarios, así que la línea no se puede
   salvar leyéndola bien.** `B/21` §3.2 (a): *«las dos `comp` son **del owner**»*. `B/21` §2.4:
   *«**las dos cuentas** amanecen con `cubierto` verdadero»*. Las dos frases están en el mismo
   capítulo, a once líneas. Y `07-facts-inventory.md` **no lo resuelve**: su consulta 2 devuelve
   `status`, fechas de trial, fin de período y plan —*«`comp` | alojamiento | mensual | 2»*,
   *«`owner-premium` ×3 (las 2 `comp` + 1 `trialing`)»*— y **no trae el `user_id`**. El dato del
   que depende que el corte se pueda ejecutar **no está medido en ninguna parte del corpus**.
4. **El camino de escape que el mismo § prescribe no aplica.** `B/21` §2.4 cierra con:
   *«escribir **dos grants** de una vertical cada uno es el otro extremo, porque revocar pasaría a
   ser dos actos… Lo que se multiplica es la fila de `permanent_grant_vertical`, **nunca la
   concesión**»*. Multiplicar el ancla exige verticales distintas —`UNIQUE(permanent_grant_id,
   vertical)`, `B/02` §2.4—, y las dos `comp` son **las dos de alojamiento**
   (`07-facts-inventory.md`, tabla del §1.2). Con un beneficiario y una vertical, el modelo admite
   **una** concesión, no dos: la segunda cortesía heredada **no tiene forma escribible**.
5. **Y la segunda entrada del mismo rastro sobre el mismo §, cuatro líneas más abajo, es la que lo
   prueba.** `rastro-ce52dce5f.md` declara correcta la frase de los *«dos grants»* diciendo que es
   *«la forma del modelo que hace que la columna nueva viva donde vive: `revocado_en` está en la
   concesión justamente porque revocar es **un** acto»*. **Las dos entradas leen la misma columna
   y llegan a conclusiones incompatibles sobre la misma escritura**: la primera dice que dos filas
   están bien porque la columna nace nula, la segunda dice que la columna está en la concesión
   porque la concesión es una.

**Dónde lo permite el diseño.** `B/21` §2.4 (la receta del corte, y sus dos frases sobre la
población) contra `B/02` §2.4 y §5 (`UNIQUE(beneficiario) WHERE revocado_en IS NULL` y
`UNIQUE(permanent_grant_id, vertical)`) y `07-facts-inventory.md` §1.2.

**Severidad.** `ALTA`. La **única** escritura que el sistema nuevo hace en el corte puede ser
rechazada por la base, y si lo es, una cuenta amanece sin la cobertura que el capítulo promete —con
la consecuencia cruzando la frontera a verticales, donde `PB2` y `T1` la observan—. No es `CRITICA`
porque el corte lo ejecuta una persona que va a ver el error del `INSERT`; lo que no va a ver es
**qué escribir en su lugar**, porque el modelo no admite la forma que el capítulo describe.

**¿Es nuevo, o es el arreglo?** **Es `DEC-GRANT-009`** (`01599ec6a`, de la tanda corta de las ocho
decisiones), que es la decisión que puso la restricción en la base. La decisión está bien tomada
—su razón es impecable y está escrita: *«si un consumidor olvida el filtro, encuentra a lo sumo una
fila viva y no dos»*—; lo que falta es que nadie recorrió los **escritores** de la tabla cuando se
le agregó una restricción de unicidad, y el único escritor manual del corpus es `B/21`.

**¿Lo habría encontrado el grep?** **Sí, y es el único de este informe del que se puede decir.** El
término nuevo es `UNIQUE(beneficiario)` —está en la lista de términos grepeados de
`rastro-8d6b27a12.md` §2, textualmente— y el viejo es `permanent_grant`. `rg "permanent_grant"`
sobre los capítulos que `01599ec6a` **no** toca devuelve `B/21` §2.4 de una: la frase *«Las dos
cortesías se escriben como `permanent_grant`»*. El grep del arreglo se hizo **sobre el término
nuevo** —que por definición no aparece en ningún lado viejo— y el término viejo que sí lo
encontraba no se grepeó, aunque la propia obligación 2 lo manda.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa** — el desenlace más fuerte del §1.4. La aparición **sí** fue recorrida, **sí** está en un
párrafo que ningún commit tocó, y **sí** lleva su *«por qué sigue siendo correcta»* escrito. Lo que
falló no es la ejecución de la regla: es que la justificación se escribió **mirando el estado del
árbol en su SHA** y el commit que la invalidó llegó **dos horas después, en la misma tanda**. Es un
modo que `DEC-METH-011` no contempla y que no es la exclusión de la prosa propia: la línea es
correcta en `ce52dce5f` y falsa en `HEAD`, **sin que nadie haya editado ni el capítulo ni el
rastro**. Un rastro sin fecha de caducidad declara una propiedad del árbol y se lee como una
propiedad del texto.

---

### F-8fB3-004 — Línea de rastro FALSA: `rastro-032f761e0.md` declara «sigue correcta» un párrafo de `B/14` §4.4 que un commit posterior de la misma tanda declara falso en sus tres cláusulas — y lo que sobrevive de él pone a `S22` y a `S18` dando dos destinos opuestos a la misma cortesía en el mismo acto

**Qué se rompe.** Una persona con la cortesía que le firmó `SUPER_ADMIN`, con un cambio de plan
abierto, pide la baja de la fila vieja. `S22` dice que **la cortesía termina con ella** y la
pantalla se lo avisa antes de confirmar. `S18` —que ese mismo `S22` dispara— dice que la cortesía
**se cierra y se le escribe el `saldo_días`** para que `S9` la re-emita sobre la sucesora. Los dos
actos corren en el mismo instante sobre la misma fila de `courtesy_grant`, y **`G-R1-C` falla sobre
el que se implemente**: si gana `S22`, el guard declara el cierre incompleto (*«una cortesía
vigente sin cerrar y sin `saldo_días`»*); si gana `S18`, la persona recibe días que la pantalla le
acaba de decir que perdía.

**La línea de rastro, citada.** `rastro-032f761e0.md`, sección `B/14-promos-cortesias-y-grants.md`
(1):

> - **L264-271 · §4.4** — «acá `S18` siempre corre sobre una sucesora ya `ACTIVE` … El segundo
>   camino de `S18` —la predecesora que se muere sola— sale de `S12` (`desde: CANCEL_SCHEDULED`) …»
>   → **sigue correcta y es la más cerca de haberse vuelto falsa de todo el rastro**. Lo que la
>   salva es su primera cláusula: … la predecesora de ese § nunca está en `PAUSED` cuando la
>   sucesión se declara; si pausa después, `S22` la alcanza y el segundo camino de `S18` la cubre…
> - *(Se verificó contra el texto, no contra el informe: la enumeración de ese párrafo es
>   ilustrativa —«sale de `S12` … y de `S16`»— y no afirma ser cerrada.)*

**Por qué es falsa hoy.**

1. **El corpus la declara falsa con todas las letras.** `B/14` §4.4 tiene hoy un sub-§ titulado
   ***«La población NO es vacía, y el corpus la enumera»***, que abre así: *«**La versión anterior
   de este § afirmaba lo contrario y por eso el defecto duró dos tandas.** Decía: «acá `S18`
   siempre corre sobre una sucesora ya `ACTIVE` … el segundo camino de `S18` sale de `S12` o de
   `S16`, y una predecesora con cortesía vigente está `PAUSED`, así que ninguna de las dos la
   alcanza…» **Las tres cláusulas se caen, y cada una por su lado**»*. Es **la misma cita**, palabra
   por palabra, que el rastro declaró correcta.
2. **La cronología está medida y es de la misma tanda.** `032f761e0` es de las **17:33:31 `-03`**
   del 2026-09-21; `70d83299d` —el commit de `DEC-GRANT-007` que reescribió ese §— está **después
   de `ce52dce5f` (17:55:19)** en `git log` del archivo, o sea a menos de una hora. Medido con
   `git log -1 --format=%ad --date=iso` sobre cada sha y `git log -- 14-promos-cortesias-y-grants.md`.
3. **Y la parte del rastro que es razonamiento PROPIO —no cita— también es falsa.** El paréntesis
   dice que *«la enumeración de ese párrafo es **ilustrativa** … y no afirma ser cerrada»*. `B/14`
   §4.4 hoy la trata como **la cláusula 1 de las tres que se caen**: *«**La enumeración era de dos
   caminos y hoy son cinco** —`S12`, `S16`, el espejo del §10.1, `S22` y `S23`—. El §2.2 de este
   mismo capítulo ya los corrigió a tres un commit después, **130 líneas más arriba**, y este
   párrafo quedó como estaba»*. El rastro usó exactamente la defensa —*«es ilustrativa»*— que el
   capítulo rechazó.
4. **Y el puente que el rastro tendió —«`S22` la alcanza y el segundo camino de `S18` la cubre»—
   abre un defecto que ningún capítulo resuelve.** Es la única mitad de la entrada que sigue en
   pie, y es la que rompe: `S18` corre **sólo** cuando hay una **sucesora viva** (su `desde` es
   *«la sucesora viva: en `ACTIVE`, o en `PENDING_AUTHORIZATION` cuando la predecesora se murió
   sola»*, `B/03` §3.2), y `S22` está **nombrado en su segundo evento** —*«o porque pidió la baja
   ella misma estando pausada (`S22`)»*—. O sea: cuando `S22` dispara `S18`, hay sucesora por
   construcción. Y ahí los dos efectos se contradicen:
   - **`S22`**: *«**Y si el motivo era `COURTESY` la cortesía termina con ella**: esa fila sí emite
     fuente … y deja de emitirla hoy, así que la confirmación lo dice antes (`B/19` §4, fila 8)»*.
   - **`S18`**, cuarta escritura: *«**si la predecesora tiene una cortesía vigente, NO se
     re-apunta: se CIERRA sobre ella y se le escribe el `saldo_días`** que le quedaba, para que
     `S9` la re-emita sobre la sucesora cuando ésta llegue a `ACTIVE`»*.
5. **Y la frase que el corpus escribió para reconciliarlas se apoya en una premisa que `S18`
   refuta por su propio `desde`.** `B/14` §4.4 cierra: *«**Ni contradice a `S22`, que hace lo
   contrario con la misma cortesía.** Ahí la persona pide la baja estando pausada y la cortesía
   «termina con ella» — no se difiere, **porque no hay ninguna sucesora que la reciba**»*. En la
   población que el rastro construyó **sí la hay**: es la condición sin la cual `S18` no corre, y
   `S18` está nombrado en el evento de `S22` justamente porque corre. La reconciliación es correcta
   para la baja **sin sucesión** —la mayoría— y falsa para la única población en que las dos filas
   se cruzan.
6. **`G-R1-C` queda sin veredicto.** El guard vigila *«cierra una sucesión dejando … **una
   cortesía vigente sin cerrar y sin `saldo_días`**»* (`B/20` §2), y su inventario es `B/02` §2.6,
   que dice **NO se re-apunta: queda DIFERIDA** sin excepción por `S22`. Una implementación que
   respete `S22` pone el guard en rojo **sobre el camino normal de la baja estando pausado** — que
   es, con las palabras del propio `B/20` §2, *«un guard que alguien va a relajar»*.

**Dónde lo permite el diseño.** `rastro-032f761e0.md` §`B/14` contra `B/14` §4.4 (el sub-§ *«La
población NO es vacía»* y el párrafo de cierre sobre `S22`), `B/03` §3.2 (`S22` efectos, `S18`
`desde` y cuarta escritura), `B/02` §2.6 (fila de la cortesía), `B/19` §4 fila 8 y `B/20` §2
(`G-R1-C`).

**Severidad.** `ALTA`. No hay un cobro de más determinado —según qué lado gane, el cliente pierde
días que le avisaron que perdía, o gana días que le avisaron que perdía— pero el guard que vigila
el cierre **no tiene verdad que verificar** sobre una población enumerada, y la pantalla dice una
de las dos cosas sin que el corpus haya elegido cuál. No la subo a `CRITICA` porque la pérdida,
del lado de `S22`, es una decisión tomada (`DEC-GRANT-004` (1)).

**¿Es nuevo, o es el arreglo?** **Es el arreglo de la baja** (`032f761e0`, *«la baja pasa de una
fila a tres»*) cruzado con **`DEC-GRANT-007`** (`70d83299d`, la cortesía diferida). Los dos son de
la 9-bis-4 y están a menos de una hora. `S22` existía sin cortesía diferida; la cortesía diferida
se escribió sin `S22` en la cabeza; y el único lugar donde alguien los cruzó es la línea de rastro
que declaró correcta la premisa que el segundo iba a tirar.

**¿Lo habría encontrado el grep?** **No.** El término nuevo de `032f761e0` es `S22`/`S23`, y
`rg "S22"` sobre `B/14` devuelve hoy **la frase de cierre del §4.4** — pero esa frase la escribió
`70d83299d`, o sea el commit **posterior**: en el momento del grep no existía. Y el término nuevo
de `70d83299d` es *«cortesía diferida»* / `saldo_días`, que `rg` sobre `B/03` devuelve **dentro de
la celda de `S22`… no**: la celda de `S22` dice *«la cortesía termina con ella»* y **no nombra el
saldo ni el diferimiento**. Cuarto caso del modo *«la ausencia»* en mi vector: el lugar donde
faltaba la excepción no contiene el término.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa** — segundo del informe, y del mismo modo que `F-8fB3-003`: la línea era verdadera en su SHA
y un commit posterior de la misma tanda la volvió falsa. Con el agravante de que **el rastro
señaló el riesgo y lo desestimó**: escribió *«es la más cerca de haberse vuelto falsa de todo el
rastro»* y la dio por buena igual. Una resolución que identifica su propia línea más frágil y la
declara correcta con un argumento que el corpus va a rechazar una hora después es, exactamente, lo
que el §1.3 de las instrucciones dice que esta pasada puede medir por primera vez.

---

### F-8fB3-005 — La cortesía diferida cuya sucesora abandona queda varada para siempre: los TRES disparadores de `S9` y las DOS consultas de la sexta comprobación la excluyen, y `B/14` §4.6 la da por cerrada llamándola «el mismo hueco» que otro que sí está cerrado con causa

**Qué se rompe.** A un cliente le firmó `SUPER_ADMIN` N días de cortesía. Cambia de plan; la
predecesora se muere sola (el espejo, `S12`, `S16`, `S22`, `S23` o `S24`) y `S18` **difiere** la
cortesía con su `saldo_días`. La sucesora **no termina el checkout** y `S3` la manda a `ABANDONED`
a las 72 h. El cliente vuelve a suscribirse en esa vertical —que sigue abierta, y es lo que `B/12`
§4.4 le pide que haga—, su fila nueva llega a `ACTIVE`, **y la cortesía no se re-emite nunca**.
Paga el precio entero por días que le habían regalado. Y **nadie lo ve**: la sexta comprobación de
cero llamadas, que es el backstop que `B/14` §4.4 exhibe como la garantía del mecanismo nuevo,
tiene sus **dos** consultas escritas de forma que ninguna alcanza este caso.

**El camino.**

1. **El saldo queda escrito.** `S18`, cuarta escritura: *«se CIERRA sobre ella y se le escribe el
   `saldo_días`»* (`B/03` §3.2), y la fila sigue apuntando a la predecesora, que queda `CANCELLED`
   **con `sucedida_por` no nulo** (`B/02` §2.2: *«`sucedida_por` … se escribe **en la
   predecesora**, en el mismo acto en que `S18` limpia `sucede_a`»*).
2. **La sucesora muere sin llegar nunca a `ACTIVE`.** `S3`: *«`PENDING_AUTHORIZATION` | vence la
   ventana | `ABANDONED` | pasaron **72 h** sin autorizar»* (`B/03` §3.2).
3. **Los tres disparadores de `S9` fallan, uno por uno** (`B/03` §3.2):
   - el **primero** es *«`SUPER_ADMIN` otorga cortesía»* — no ocurre; la cortesía ya estaba
     otorgada;
   - el **segundo** exige *«una `courtesy_grant` con `saldo_días` no nulo cuyo `subscription_id`
     apunta a una fila cuyo **`sucedida_por` es esta**»* — y el `sucedida_por` de la predecesora
     apunta a la **`ABANDONED`**, no al alta nueva;
   - el **tercero** exige *«una fila recién autorizada que NO es sucesora de nadie … cuya
     suscripción **murió por `S25`**»* — y ésta murió por `S17` / `S12` / el espejo.
   Por la regla 1 del núcleo —*«la tabla es exhaustiva; lo que no está, no pasa»* (`NUCLEO/03`
   §1)— la re-emisión **no ocurre**.
4. **Las dos consultas de la sexta comprobación fallan también** (`B/09` §3, tabla *«de dónde viene
   el saldo»*):
   - la primera pide *«la suscripción a la que la cortesía apunta tiene **`sucedida_por` no nulo**,
     y esa sucesora está en **`ACTIVE`**»* — el `sucedida_por` está, pero la sucesora está
     `ABANDONED`;
   - la segunda pide *«la suscripción a la que apunta está `CANCELLED` **sin `sucedida_por`**»* —
     y lo tiene.
   La comprobación es, con las palabras de `NUCLEO/01` §2.6 (consumidor 4), *«una cortesía diferida
   cuya sucesora, **o cuyo alta nueva**, ya está `ACTIVE`»*, y el alta nueva sólo se alcanza *«por
   el beneficiario y la vertical»* cuando **no hubo sucesión**. Acá hubo.
5. **Y el corpus lo da por cerrado con una equivalencia que es falsa.** `B/14` §4.6 cierra:
   *«Queda como pregunta al owner, **junto con la que `B/09` §3 ya dejó abierta para el saldo de
   una sucesora que abandona: son el mismo hueco por dos puertas**»*. **No son el mismo hueco**, y
   la diferencia es la que decide si hay algo que hacer:
   - en la puerta de `DEC-GRANT-010` *«una vertical discontinuada **queda cerrada a altas para
     siempre** (`B/10` §4.5, borde 4) … **en esa vertical no va a haber nunca una fila nueva que
     llegue a `ACTIVE`**»* — la población receptora es **vacía por construcción**, así que no hay
     nada que re-emitir y `DEC-GRANT-010` lo declara con causa;
   - en la puerta de la sucesora que abandona **la vertical sigue abierta**, la persona vuelve
     —`B/12` §4.4 le pide exactamente eso— y **la fila receptora existe**. Lo que falta no es una
     decisión del owner: es **una cláusula** en un mecanismo que ya está escrito.
6. **La prueba de que el mecanismo ya está escrito.** El tercer disparador de `S9` cubre
   literalmente esta forma —*«una fila recién autorizada que NO es sucesora de nadie tiene una
   cortesía diferida del MISMO beneficiario y la MISMA vertical»*— y la excluye **por una sola
   cláusula**, la de la causa de muerte. `B/14` §4.6 lo dice sin ver la consecuencia: *«Lo único
   que cambia es cómo se llega a la fila nueva»*.
7. **Y el §2.6 del núcleo declara lo contrario de lo que pasa.** *«**Y la fila sigue apuntando a
   la suscripción que pausaba**, que es lo que la mantiene resoluble, con **dos** saltos posibles
   desde ahí»*. Acá los dos saltos existen y los dos caen en el vacío: `sucedida_por` lleva a una
   `ABANDONED`, y el salto por beneficiario + vertical está condicionado a que `sucedida_por` sea
   nulo.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S9` tres disparadores, `S18` cuarta escritura, `S3`)
y `B/09` §3 (sexta comprobación, sus dos filas y su recuadro de cierre) contra `B/14` §4.6 (la
equivalencia *«el mismo hueco por dos puertas»*), `NUCLEO/01` §2.6 (el término y su consumidor 4) y
`NUCLEO/03` §1 regla 1.

**Severidad.** `ALTA`. El beneficiario paga el precio entero por días que `SUPER_ADMIN` firmó, y el
detector que el diseño exhibe como la garantía de que *«si la re-emisión no ocurre, hay quién lo
vea»* (`B/14` §4.4) está apagado sobre esta población. No la subo a `CRITICA` porque el destino del
saldo **sí** está declarado abierto en `B/09` §3 —*«no está decidido … queda como pregunta al
owner»*—; lo que **no** está declarado ni es una pregunta abierta es que las dos puertas sean el
mismo hueco, ni que el detector no lo vea.

**¿Es nuevo, o es el arreglo?** **Es `DEC-GRANT-007`** (`70d83299d`, la cortesía que se difiere)
ampliada por **`DEC-GRANT-010`** (`e828cd76c`, el tercer disparador y la sexta comprobación por dos
caminos). Antes de `DEC-GRANT-007` la cortesía no se difería: moría con la predecesora y el defecto
era otro —el mío, `F-8eB3-001` de la vuelta pasada—. El arreglo creó **la espera**, y la espera
necesita que alguien la termine; el arreglo escribió dos formas de terminarla y el caso más común
de que la sucesora no llegue —abandonar un checkout, 72 h, la población que `S3` recorre todos los
días— no es ninguna de las dos.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es `saldo_días` / *«cortesía
diferida»*. Lo medí: `rg -l "saldo_días"` sobre las dos épicas, el núcleo y el contrato devuelve
**ocho** archivos, y `git show --name-only e828cd76c` devuelve **ocho**, de los cuales **siete son
los mismos**. El único capítulo con el término que el commit **no** toca es `B/descomposicion.md`,
que enumera unidades de trabajo y no contiene ninguna mitad del predicado. Grepear *«los capítulos
que el commit NO toca»* devuelve, en la práctica, nada útil. Y el defecto es una **ausencia**: la
cláusula que falta en el tercer disparador no nombra ningún término, porque no existe.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y la aparición decisiva está en el
rastro declarada correcta por otra razón.** `rastro-8d6b27a12.md` §`B/09` tiene la entrada
**L474-494 · §3, el recuadro de la sexta** — *«las otras cinco comprobaciones … ninguna mira una
cortesía»* → *«sigue correcta: sigue siendo la única que mira una cortesía, y **lo que cambió es
que ahora la mira por dos caminos en vez de uno**, lo cual está en un hunk del commit»*. La línea
es **verdadera** —la comprobación sigue siendo la única— y por eso no es un hallazgo contra el
rastro: lo que la línea no pregunta es si los **dos caminos** cubren el dominio, que es la pregunta
que la obligación 2 no hace porque recorre apariciones y no dominios. Y las dos apariciones que
habría que comparar —el tercer disparador de `S9` y la segunda fila de la tabla de la sexta— **las
escribió ese mismo commit**: **modo 1 de `C1` §4.4**, la exclusión viva.

---

### F-8fB3-006 — El tercer disparador de `S9` se evalúa sobre una CAUSA —«murió por `S25`»— que ninguna columna registra, y su backstop del cap. 09 usa un predicado más ancho: la transición y el detector seleccionan conjuntos distintos

**Qué se rompe.** Nadie puede escribir el tercer disparador de `S9` tal como está enunciado: no hay
ninguna columna en `subscription` que diga **por qué transición** murió una fila. Quien lo
implemente va a copiar el predicado del barrido —el único escrito contra columnas— y ese predicado
es **más ancho**, así que `S9` va a re-emitir cortesías sobre filas que `S25` nunca produjo; o va a
inventarse una columna que ningún capítulo declara, que es lo que la regla 1 del núcleo prohíbe.

**El camino.**

1. **La transición nombra la transición**: *«…**o una fila recién autorizada que NO es sucesora de
   nadie tiene una cortesía diferida del MISMO beneficiario y la MISMA vertical, **cuya suscripción
   murió por `S25`**»* (`B/03` §3.2, `S9`, tercer disparador).
2. **Y `B/14` §4.6 lo repite igual**: *«la fila nueva es **un alta nueva** (`S1`), y se la alcanza
   por **el beneficiario y la vertical** de la suscripción muerta»*. `NUCLEO/01` §2.6, consumidor 8:
   *«un alta nueva del mismo beneficiario y la misma vertical tiene una cortesía diferida
   esperándola»* — **ninguno de los dos vuelve a nombrar `S25`**, así que las tres redacciones del
   mismo disparador no dicen lo mismo.
3. **El modelo no guarda la causa.** `subscription` guarda *«`user`, vertical, versión de plan
   anclada, billing option, estado, la fecha del próximo cobro, fecha de fin de servicio, clase,
   `sucede_a`, `sucedida_por` y la fecha de primer cobro»* (`B/02` §2.2). **No hay ninguna columna
   de causa de baja**, y `B/02` §2.2 declara además que *«`revocado_en` es una marca de un acto … no
   hay transiciones, no hay `desde`/`hacia`»* para el grant, pero para la suscripción no declara
   ningún equivalente. La única columna que distingue **cómo** murió una fila es `sucedida_por`, y
   distingue exactamente una cosa: *«fue una sucesión o fue una baja»*.
4. **El barrido usó otro predicado, y es el único evaluable.** `B/09` §3, sexta comprobación, fila
   2: *«la suscripción a la que apunta está `CANCELLED` **sin `sucedida_por`**, y el beneficiario
   tiene **otra fila en `ACTIVE` en la misma vertical**»*. Dos columnas, las dos existen. **Pero no
   es el mismo conjunto**: *«`CANCELLED` sin `sucedida_por`»* incluye **toda** baja sin sucesión
   —`S11`+`S12`, `S22`, `S23`, `S24`, `S13`, el espejo— y no sólo `S25`.
5. **El conjunto extra no es hipotético.** `S13` alcanza *«toda fila viva PRINCIPAL … los seis
   estados»*, o sea también una `PAUSED · COURTESY`, y la deja `CANCELLED` sin `sucedida_por`.
   `S13` **no escribe `saldo_días`** —`B/02` §2.6 lo dice: *«de las cinco filas de arriba la única
   que un grant mueve por ser grant es la cuarta»*—, así que hoy esa fila no tiene saldo y el
   detector no se dispara. **La coincidencia es accidental**: la separa el estado de `saldo_días`,
   no el predicado, y cualquier acto futuro que difiera una cortesía sin ser `S25` queda dentro del
   detector y fuera de la transición.
6. **Y la asimetría es la peor de las dos direcciones posibles.** El detector es el **backstop** y
   la transición es **el curso normal**: un backstop más ancho que su transición marca casos que
   nadie puede resolver, y un backstop más angosto deja huecos. Acá es el primero, y el desenlace
   escrito para una marca sin acción posible ya está dicho en el mismo capítulo: *«marcar ese caso
   sería abrirle a una persona, **todos los días y para siempre**, un caso que no tiene ninguna
   acción posible — que es lo contrario de para qué existe el listado accionable»* (`B/09` §3,
   sexta comprobación).

**Dónde lo permite el diseño.** `B/03` §3.2 (`S9`, tercer disparador) contra `B/02` §2.2 (las
columnas de `subscription`), `B/09` §3 (sexta comprobación, fila 2), `B/14` §4.6 y `NUCLEO/01` §2.6
(consumidor 8).

**Severidad.** `MEDIA`. Hoy nadie paga de más porque el único escritor de `saldo_días` sin sucesión
**es** `S25`, así que los dos conjuntos coinciden de hecho. Lo que está mal es que coinciden por
accidente y no por construcción, y que el enunciado normativo **no se puede evaluar** contra
ninguna columna, que es la clase de defecto que esta épica ya pagó tres veces (*«pendiente de
resolución»*, *«ancla viva»*, *«grant vivo»*).

**¿Es nuevo, o es el arreglo?** **Es `DEC-GRANT-010`** (`e828cd76c`), que creó el tercer disparador.
Es la tercera redacción del mismo predicado escrita en el mismo día por el mismo autor, y las tres
difieren.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es **`S25`**, y `e828cd76c` toca los
seis archivos donde `S25` aparece. Grepear los que **no** toca devuelve cero. Y el término que lo
encontraría no es un término: es la pregunta *«¿contra qué columna se evalúa esta cláusula?»*, que
es la obligación **4** dada vuelta y no un `rg`.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las tres apariciones del disparador
—`B/03` §3.2, `B/14` §4.6, `NUCLEO/01` §2.6— **las escribió ese commit**, así que caen enteras en
la exclusión que `DEC-METH-011` dejó viva: **modo 1 de `C1` §4.4**. Y `rastro-8d6b27a12.md` lo
confirma sin querer: su entrada sobre la sexta comprobación dice *«lo cual está **en un hunk del
commit**»*, o sea que el autor identificó la aparición y la excluyó por la regla, correctamente.
**El arreglo contra sí mismo en tres archivos sigue siendo el modo que ninguna enmienda toca.**

---

### F-8fB3-007 — `G-R6` está anclado en la columna `condición`, que CINCO de las siete tablas de transiciones no tienen —incluida la del pago manual, que es el caso que lo creó—: el guard que `DEC-TEST-001` eligió no puede re-detectar el crítico que lo motivó

**Qué se rompe.** `DEC-TEST-001` evaluó dos guards y eligió uno: `G-R6`, *«una condición de
transición lee una columna que NINGUNA transición escribe»*. El crítico que lo motivó —`F-8eB1-002`,
*«`MP5` disparaba sobre «el período actual arrancó» y ninguna escritura del corpus avanzaba esa
columna, así que el pagador manual pagaba una vez en la vida y seguía cubierto para siempre»*—
vive en una tabla que **no tiene columna `condición`**, y el predicado que leía la columna muerta
está en la columna **`evento`**. Aplicado a la letra, el guard lee **cero** predicados de la máquina
que lo creó: queda verde sobre su propio caso testigo.

**El camino.**

1. **El enunciado del guard nombra una columna**: *«una **condición de transición** lee una columna
   que NINGUNA transición escribe. El guard recorre **cada condición** de las tablas de
   transiciones de las nueve máquinas, en las dos épicas, extrae las columnas que lee y exige que
   al menos una transición del corpus las escriba»* (`B/20` §2; idéntico en `V/20` §2).
2. **Su origen está escrito y es el pago manual.** `V/20` §2: *«Nació en `B/20` §2 acotado a las
   seis tablas de billing, porque el crítico que lo motivó era de billing: **`MP5` disparaba sobre
   «el período actual arrancó»** y ninguna escritura del corpus avanzaba esa columna … (`F-8eB1-002`)»*.
   `B/20` §2 lo cita igual: *«`DEC-TEST-001` y su ampliación del mismo día, cap. 03 §7.2 (`MP5`),
   `F-8eB1-002`»*.
3. **La tabla del pago manual no tiene columna `condición`.** Su encabezado, verbatim:
   `| # | desde | evento | hacia | efectos |` (`B/03` §7, línea 1099). **Cinco columnas y ninguna
   es `condición`.** Y el predicado de `MP5` está en `evento`: *«un reloj abre el período … **llegó
   la fecha del próximo cobro** (`B/02` §2.2)»*.
4. **No es la única.** Medí los encabezados de las tablas de transiciones de las dos épicas con
   `rg -n "\| *desde *\|" --glob '*.md'` sobre `HOS-1353/docs`, `HOS-1354/docs` y `nucleo/`, y
   son **siete** tablas de máquina:

   | tabla | encabezado | ¿lleva `condición`? |
   |---|---|---|
   | `B/03` §3.2 · suscripción | `# \| desde \| evento \| hacia \| condición \| efectos` | **sí** |
   | `B/03` §6 · pago | `# \| desde \| evento \| hacia \| nota` | **no** |
   | `B/03` §7 · pago manual | `# \| desde \| evento \| hacia \| efectos` | **no** |
   | `B/03` §8 · instancia de addon | `# \| desde \| evento \| hacia \| nota` | **no** |
   | `V/03` (la primera) | `# \| desde \| evento \| hacia \| condición \| efectos` | **sí** |
   | `V/03` (las otras dos) | `# \| desde \| evento \| hacia \| nota` ×2 | **no** |

   **Dos de siete.** Un guard que declara recorrer nueve máquinas lee, leído a la letra, los
   predicados de dos.
5. **Y las que no la tienen son las que más predicado meten en otras columnas.** `S13` pone su
   dominio entero en `desde` (*«toda fila viva PRINCIPAL del beneficiario en cada vertical que el
   acto ancla»*); `S20` pone **cuatro cláusulas** en `desde`; `S9` pone **tres disparadores** en
   `evento`; `S21` pone su sujeto en `desde` y su condición de re-evaluación en `condición`. El
   corpus no usa `condición` como el lugar donde vive el predicado: la usa como una de cuatro.
6. **El guard lo declara, para otra cosa, y eso lo hace verificable.** `V/20` §2 escribe con todas
   las letras el §2.1 aplicado a sí mismo: *«el texto con que falla no puede afirmar más de lo que
   el predicado verifica»*, y enumera qué **no** verifica (*«no verifica que los cuatro hechos
   tengan quien los ejecute»*). No dice en ninguna de esas advertencias que su barrido sólo alcanza
   la columna `condición` de dos tablas.
7. **La consecuencia sobre el caso real.** Si mañana alguien vuelve a escribir un `MP5` que dispare
   sobre una columna muerta, o si —como en `F-8fB3-006`— un disparador de `S9` se evalúa contra algo
   que ninguna columna registra, `G-R6` no lo ve: el primero porque el predicado está en `evento`,
   el segundo porque el predicado **no nombra ninguna columna**, y un extractor de columnas sobre
   un predicado sin columnas devuelve el conjunto vacío, que satisface *«todas las que lee alguien
   las escribe»* **vacuamente**.

**Dónde lo permite el diseño.** `B/20` §2 y `V/20` §2 (el enunciado de `G-R6`, su origen y su lista
de lo que no verifica) contra `B/03` §7 (encabezado de la tabla y celda de `MP5`) y los encabezados
de las siete tablas, medidos arriba.

**Severidad.** `ALTA`. El único guard que `DEC-TEST-001` aceptó de los dos que evaluó no puede
volver a encontrar el crítico con el que se justificó, y el modo de falla de ese crítico es que
alguien *«pagaba una vez en la vida y seguía cubierto para siempre»*. Es la forma de fail-open que
el propio `V/20` §2 nombra —*«un guard que queda verde por un escritor de cuatro»*— aplicada al
guard entero en vez de a una de sus mitades.

**¿Es nuevo, o es el arreglo?** **Es `DEC-TEST-001`** (`ec47ed85e`, de la tanda corta de las ocho
decisiones), que es la decisión que creó `G-R6` y su ampliación a las dos épicas. La decisión de
**cuál** guard va está bien tomada y su razón está escrita; lo que nadie recorrió es **contra qué
recorre**.

**¿Lo habría encontrado el grep?** **No, y acá el grep sí se corrió y no podía servir.**
`ec47ed85e` toca **dos** archivos (`B/03` y `B/20`, medido con `git show --name-only`), y
`rg -c "G-R6"` sobre el corpus devuelve **7 archivos / 39 líneas**, así que grepear *«los capítulos
que el commit NO toca»* devuelve **5 archivos y 23 líneas reales** — `V/20`, `V/02`,
`V/descomposicion`, `B/descomposicion` y `nucleo/01`. **Las 23 son copias y referencias cruzadas
del enunciado del propio guard**: ninguna es la contradicción, porque la contradicción no está en
un texto que diga `G-R6` sino en **los encabezados de las cinco tablas sin `condición`** —cuatro
`| # | desde | evento | hacia | nota |` y una `| # | desde | evento | hacia | efectos |`—. Y sobre
`B/03`, que el commit **sí** toca, `rg "G-R6"` devuelve **una** línea,
la referencia cruzada, a mil quinientas líneas del encabezado que lo desmiente. Es el modo *«a un
término de distancia»*, tercera instancia en mi vector: **el término que lo encuentra es
`condición`**, una palabra común del corpus, y el lugar donde vive la contradicción es una fila de
tabla sin prosa.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No está en el rastro y no debía estar.** La
aparición decisiva —el encabezado `| # | desde | evento | hacia | efectos |` de `B/03` §7— **no
contiene el término `G-R6`** ni ningún otro término del arreglo, y `rastro-8d6b27a12.md` no tiene
ninguna entrada sobre encabezados de tabla en ninguno de sus 91 párrafos. Cae en el modo que mi
informe anterior nombró y que esta vuelta confirma: **la obligación recorre apariciones de términos
y un encabezado de tabla no es una aparición de nada.** La pregunta que lo encuentra es *«¿el
predicado del guard existe en el artefacto que dice recorrer?»*, que es una tabla de siete filas y
se contesta con un `rg` de encabezados, no de términos.

---

### F-8fB3-008 — `B/09` §7 sostiene la idempotencia del barrido en «ninguno escribe», que hoy es falso en once lugares: lo que de verdad la sostiene es el `UNIQUE` que el § no nombra, y lo único que ese `UNIQUE` no decide —si `puesta_en` se conserva o se reescribe— es el reloj del que cuelga el escalamiento

**Qué se rompe.** El barrido corre todos los días. Sobre una divergencia que persiste —y el
capítulo declara que persisten: *«el cobro equivocado sigue saliendo de su tarjeta todos los
meses»*— vuelve a evaluar el mismo predicado y vuelve a **abrir la marca**. El corpus no dice qué
pasa entonces, y su única frase sobre el tema afirma que la pregunta no existe. Hay dos lecturas y
las dos rompen algo: o el `INSERT` choca contra el `UNIQUE` **todos los días** sobre la población
más grande del listado, o se reescribe la fila y con ella `puesta_en` — y ahí *«si sigue abierta
pasado su plazo, **escala**»* **nunca se cumple**, porque el plazo se reinicia cada veinticuatro
horas.

**El camino.**

1. **La frase**: *«**Los dos barridos son idempotentes**: correrlos dos veces no produce nada
   distinto, **porque ninguno escribe salvo la reparación de vínculo del §2.4**»* (`B/09` §7).
2. **Y es falsa en once lugares del §3 del mismo capítulo**, contados por mí sobre la tabla y los
   párrafos de hoy: **cinco comparaciones**, de las cuales dos abren marca (`TRANSICIÓN_NO_DECLARADA`
   y `DIVERGENCIA_DE_MONTO`) y una *«relee entero»* el recurso; y **seis comprobaciones de cero
   llamadas**, que abren `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`, `PAGO_PENDIENTE_SIN_RAMA`,
   `FAN_OUT_DE_GRANT_INCOMPLETO`, `ADDON_SIN_APAGAR`, `REANUDACIÓN_NO_APLICADA` y
   `CORTESÍA_SIN_RE_EMITIR`. La segunda comprobación además **resuelve**: *«se resuelve por la rama
   que le corresponda de las seis de `B/12` §5.3»*.
3. **La marca dejó de ser una casilla y pasó a ser un `INSERT`.** `B/02` §2.2: la entidad
   `reconciliation_mark`, con `UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL`. Escribir
   `true` sobre `true` es idempotente por la forma del dato; **insertar una fila no lo es por la
   forma del dato**, lo es por la restricción — y el § que declara la idempotencia **no nombra la
   restricción**.
4. **El § sí previó la re-emisión del AVISO, y sólo ésa.** *«**Lo que se agrega es el AVISO, nunca
   la comparación.** El barrido sigue corriendo sobre la fila; lo que no vuelve a emitir es una
   alerta por corrida sobre un caso ya abierto»* (`B/09` §3). Eso resuelve el correo y `DEC-OBS-001`;
   **no dice nada de la fila**.
5. **Y `puesta_en` es lo único que el `UNIQUE` no decide.** Un `INSERT ... ON CONFLICT DO NOTHING`
   conserva la marca original y su reloj; un `DO UPDATE` la pisa. Las dos son escrituras legítimas
   bajo la misma restricción y el corpus no elige. El precio de elegir mal está escrito: *«**La
   marca lleva reloj** … Si sigue abierta pasado su plazo, **escala**: es una divergencia de plata
   que nadie resolvió, y **sin reloj el servicio que la fila sostiene no tiene cota**»* (`B/09` §3),
   y `NUCLEO/01` §2.5 lo inventaría como el consumidor 7 del término.
6. **La población en la que eso cuesta plata está nombrada y es la mayor.** Los motivos que el
   barrido re-abre todos los días incluyen `DIVERGENCIA_DE_MONTO` —*«**y el cobro equivocado sigue
   saliendo todos los meses**»* (`B/02` §2.5, fila 5)—, `FAN_OUT_DE_GRANT_INCOMPLETO` —*«el
   beneficiario **paga todos los meses algo declarado gratis**»* (fila 10)— y `ADDON_SIN_APAGAR`
   (fila 11). En los tres, el escalamiento es lo único que acota la espera, y en los tres la
   comprobación se vuelve a disparar en cada corrida porque **nada cambia el hecho que la
   dispara**.
7. **Y no hay guard.** `G-R1-F` vigila que se nombre un motivo de la tabla, que `S15` diga cuál
   levanta y que el listado muestre `puesta_en` (`B/20` §2). **Ninguna de las tres mira qué pasa
   cuando el mismo escritor vuelve al día siguiente.**

**Dónde lo permite el diseño.** `B/09` §7 contra `B/09` §3 (las cinco comparaciones, las seis
comprobaciones, el recuadro del aviso agregado y el escalamiento por reloj), `B/02` §2.2 (el
`UNIQUE`) y §2.5 (filas 5, 10 y 11), `NUCLEO/01` §2.5 (consumidor 7) y `B/20` §2 (`G-R1-F`).

**Severidad.** `ALTA`. En la lectura del `DO UPDATE` el escalamiento se apaga sobre los tres
motivos que significan un cobro mensual indebido, y el escalamiento es lo único que el diseño
declara que impide que un caso *«quede abierto para siempre»*. No la subo a `CRITICA` porque la
plata no se pierde por esta vía sola: el caso sigue en el listado, con una persona que puede
mirarlo. Lo que se pierde es la **cota**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo de la familia de la sucesión** (`3310c9376`, la
marca como fila con reloj), sobre una frase que ya era imprecisa y que este arreglo volvió
**falsa con consecuencia**. Es `F-8dB3-007` (2ª mitad), abierta desde la vuelta 3, **ascendida**:
cuando la reporté, el daño era que la corrida siguiente re-resolvía lo ya resuelto; ahora el daño
es que el reloj que la salvedad 2 declara como su razón de existir puede no avanzar nunca.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es `reconciliation_mark` /
`puesta_en`, y `rg "puesta_en"` sobre `B/09` §7 devuelve **cero**: ese § no nombra la marca, ni el
motivo, ni el reloj. El término viejo —*«idempotente»*— sí lo devuelve, pero no está en la lista de
términos de ningún rastro: lo verifiqué con `rg -n "idempotent"` sobre los diez, que devuelve
**cuatro** apariciones y **las cuatro son sobre `S13`/`S20`**, ninguna sobre el barrido.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y debería estar.** El
§7 de `B/09` es un párrafo que **ningún commit de la tanda tocó**, dentro de un archivo que
`f21d5d828` y `8d6b27a12` sí tocaron —o sea el sujeto exacto de la obligación 2— y **no figura en
ninguna de las 14 entradas que los dos rastros dedican a `B/09`**. La razón es la de siempre y vale
medirla: la obligación se aplica *«por aparición del término»*, y el término elegido fue
`requiere_conciliación` / *«marca»* / *«motivo»*, **ninguno de los cuales aparece en ese párrafo**.
Es el modo *«a un término de distancia»* por segunda vuelta consecutiva en mi vector: quien
convierte una casilla en una fila tiene que grepear **el verbo** —*«escribe»*— y no el sujeto.

---

### F-8fB3-009 — `B/05` §3 sigue diciendo «los otros diez» sobre un catálogo de trece motivos: el conteo lo escribió un commit y lo invalidó el siguiente de la MISMA familia, dentro del alcance del mismo rastro

**Qué se rompe.** Nada operativo: es una cifra en una frase explicativa. Se reporta porque es la
instancia más limpia del modo que `DEC-METH-011` deja vivo, y porque `B/02` §2.5 declara
explícitamente la regla que esta línea incumple.

**El camino.**

1. `B/05` §3, cierre: *«**Cuál de las cuatro condiciones falló va en el evento y no en el motivo**:
   el motivo es lo que separa este caso de **los otros diez** en el listado»*.
2. El catálogo tiene **trece** motivos (`B/02` §2.5, contados por mí sobre la tabla de hoy:
   `REEMBOLSO_POR_CONFIRMAR`, `COBRO_POSTERIOR_A_LA_BAJA`, `COBRO_POSTERIOR_AL_GRANT`,
   `PAGO_PENDIENTE_SIN_RAMA`, `DIVERGENCIA_DE_MONTO`, `TRANSICIÓN_NO_DECLARADA`,
   `PAGO_TARDÍO_RECHAZADO`, `REANUDACIÓN_NO_APLICADA`, `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`,
   `FAN_OUT_DE_GRANT_INCOMPLETO`, `ADDON_SIN_APAGAR`, `COBRO_DURANTE_CORTESÍA`,
   `CORTESÍA_SIN_RE_EMITIR`). `PAGO_TARDÍO_RECHAZADO` es el 7.º, así que **los otros son doce**.
3. **La regla que incumple está escrita**: *«La enumeración es cerrada y **el conteo se recalcula,
   no se incrementa**: un escritor nuevo agrega su fila acá **en el mismo acto** … **Los dos
   últimos llegaron con `DEC-GRANT-007`** y son el ejemplo de por qué la regla dice «se
   recalcula»»* (`B/02` §2.5).
4. **La cronología es de un commit de distancia, y está medida.**
   `git log -S'los otros diez' -- 05-idempotencia-y-concurrencia.md` devuelve **un solo commit**:
   `3310c9376` (*«la marca de conciliacion lleva motivo y reloj»*), que la escribió cuando había
   **once** motivos y era **correcta**. `git log -S'CORTESÍA_SIN_RE_EMITIR' -- 02-modelo-de-datos.md`
   devuelve `70d83299d`, que agregó los motivos 12 y 13. **Los dos son de la familia `f21d5d828`**
   —los tres commits de esa familia son `3310c9376`, `70d83299d` y `f21d5d828`—, o sea **dentro del
   alcance de un solo rastro**.
5. **El rastro grepeó la cifra hermana y la corrigió, y ésta no.** `rastro-8d6b27a12.md` §2 lista
   entre sus términos viejos *«seis de los once motivos»*, y su entrada sobre `B/02` L619-623 dice:
   *«(Es la cifra que `B/03` §3.2 citaba mal —«seis de los once»— y que el commit de `S24` corrigió
   allá, contra este texto.)»*. La misma tanda encontró y arregló la cifra que **contiene la
   palabra «motivos»** y no la que dice **«los otros diez»** a secas.
6. **Y el rastro de la familia declaró el recuento ejecutado.** `rastro-8d6b27a12.md`, entrada
   `B/02` L641-646: *««La enumeración es cerrada y el conteo se recalcula, no se incrementa» →
   sigue correcta, y esta tanda la ejecutó … **se recontó y el resultado fue el mismo**, trece y
   cuatro. Un recuento que no cambia el número sigue siendo un recuento»*. El recuento se hizo
   sobre la tabla; **no sobre sus consumidores**.

**Dónde lo permite el diseño.** `B/05` §3 (última frase) contra `B/02` §2.5 (la tabla de trece y la
regla del recuento).

**Severidad.** `BAJA`. Una cifra en prosa que no gobierna ningún comportamiento. La reporto porque
es el caso puro del modo, con las dos puntas medibles y a un commit de distancia.

**¿Es nuevo, o es el arreglo?** **Es el arreglo de la familia de la sucesión**: lo escribió
`3310c9376` correcto y lo volvió falso `70d83299d`, el commit siguiente de la misma familia.

**¿Lo habría encontrado el grep?** **No, y se puede decir por qué exactamente.** La lista de
términos de `rastro-f21d5d828.md` y la de `8d6b27a12.md` incluyen *«once motivos»*, *«seis de los
once»* y *«trece motivos»*. La frase de `B/05` **no contiene la palabra «motivos»**: dice *«los
otros diez»*, un ordinal pelado. Un grep de términos no encuentra un número suelto, y **el número
suelto es la forma más común de un conteo congelado**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No está en el rastro y no debía estar, por
la exclusión viva.** El párrafo lo **escribió** `3310c9376`, o sea el propio commit de la familia:
**modo 1 de `C1` §4.4**. `rastro-f21d5d828.md` tiene **cuatro** entradas sobre `B/05` §3 —L175-180,
L200-207, L222-226, L244-251— y ninguna es ésta, correctamente según la regla. **Es la tercera
instancia de este informe del mismo modo**, y las tres tienen la misma forma: *«el commit A de una
familia escribe una afirmación verdadera y el commit B de la misma familia la vuelve falsa»*. La
obligación 2 compara el arreglo **contra el resto del corpus** y nunca **la familia contra sí
misma**.

---

## 2. Hallazgos de vueltas anteriores que siguen llegando sobre el texto de hoy

Verificados uno por uno contra el texto de los capítulos, no contra mis informes. Van con su ID
viejo y el paso en que llegan hoy; **no los cuento** en el conteo de arriba.

| ID viejo | qué era | por qué sigue llegando, sobre el texto de hoy |
|---|---|---|
| `F-8eB3-005` | el par con que la salvedad 4 termina bien no está en la tabla del `B/03` §10.1 | **sigue entero y creció de 5 a 9**. Conté las **8** filas de `B/03` §10.1 hoy: siguen siendo ocho y las de `cancelled` siguen siendo *«`cancelled` × `CANCEL_SCHEDULED`»* y *«`cancelled` × cualquier estado **vivo** que no sea `CANCEL_SCHEDULED`»*. Ni `ABANDONED` ni `CANCELLED` son vivos (`B/02` §2.2). Y la salvedad 4 nombra hoy **nueve** puertas —`S12`, `S3`, `S13`, `S20`, `S22`, `S23`, `S24`, `S25` y la lápida—, todas terminales: **el día que la relectura confirma es el día de la marca**, hoy con motivo `TRANSICIÓN_NO_DECLARADA` (`B/02` §2.5, motivo 6), que la 9-bis-4 le dio nombre sin cambiar el desenlace. Sobre `S3` es la población que el propio § llama *«la parte de la cartera que más crece»* |
| `F-8eB3-008` | `G-R1-C` nombra como *«el único sin otro detector»* justo la escritura que SÍ lo tiene | **intacto, y con la cifra actualizada al alza**. `B/20` §2 dice hoy: *«uno que cierra sobre una predecesora con un pago pendiente por `S19` sin poner la marca … **es el único de los cinco que no tiene ningún otro detector**, porque la fila queda terminal»*. Sigue siendo la única de las cinco que **sí** tiene otro detector: la **salvedad 3** (*«hasta que la bandera se apague»*) y la **segunda comprobación** (`B/09` §3). La frase pasó de *«de los cuatro»* a *«de los cinco»* sin que nadie revisara su contenido |
| `F-8eB3-002` | *«ancla viva»* y *«grant vivo»* eran predicados sin columna | **CERRADO**. `B/02` §2.4 declara hoy *«**`revocado_en` es anulable y es lo único que contesta si el grant sigue vivo**»*, con firmante y motivo, más `UNIQUE(beneficiario) WHERE revocado_en IS NULL`; `NUCLEO/01` §2.4 define los dos términos y lleva su inventario de **nueve** consumidores, que conté. Lo doy por cerrado — y `F-8fB3-003` es el residuo del cierre, no una reapertura |
| `F-8eB3-003` | `requiere_conciliación` booleano con un motivo escrito encima | **CERRADO en la forma, abierto en la cardinalidad**. La marca es hoy `reconciliation_mark` con motivo, `puesta_en`, `levantada_en` y referencia al pago. Lo que quedó es `F-8fB3-002` (un pago por marca) y `F-8fB3-008` (qué pasa en la corrida siguiente) |
| `F-8eB3-001` | la pausa que la cortesía re-apuntada necesitaba no tenía transición | **CERRADO por `DEC-GRANT-007`**, que cambió el mecanismo entero: no se re-apunta, se difiere, y `S9` la re-emite. Lo que quedó abierto es el **final** de la espera: `F-8fB3-005` |
| `F-8dB3-007` | ninguna columna dice que un pago está *«pendiente de resolución»* | **sigue entero**. `B/02` §2.3 sigue diciendo que `payment` guarda *«estado del cap. 03 §6»* y `manual_payment` *«estado del cap. 03 §7»*, y ninguno de los dos dominios tiene *«pendiente»*. El corpus la sigue llamando **«la bandera»** —`S13` la apaga, la rama 4 la apaga, la salvedad 3 espera *«hasta que la bandera se apague»*, `B/02` §2.6— y **ninguna declaración**. Recontado con `rg -n "bandera"`: sigue sin declarar |
| `F-8eB3-006` | el barrido no tiene rama para una suscripción sin preapproval | **mitad cerrada, mitad abierta**. La tabla de las trece puertas ganó las dos salvedades del pagador manual —*«`S23` … **salvo sobre un pagador manual, que sí está exenta**: ahí no hubo llamada porque no hay débito que detener»*, ídem `S24`—, o sea que alguien recorrió el caso. Lo que **sigue sin escribirse** es el alcance del §3: *«Por cada fila de nuestro inventario … que no esté en un estado terminal»* sigue sin excluir a nadie por método de pago, y las cinco comparaciones siguen siendo todas contra el recurso del proveedor. `rg "pagador manual\|pago manual"` sobre `B/09` sigue devolviendo **cero** |
| `F-8eB3-004` | la tercera comprobación es más ancha que el `desde` de `S20` | **intacto**. `B/09` §3, fila 2 de la tercera comprobación, hoy: *«una **fila viva de complemento** suya **cuyo addon es compatible con V**, si el grant lleva `includesAddons: true`»* — dos cláusulas. El `desde` de `S20` sigue teniendo **cuatro**, con *«para los scopes con vertical propia … además su objetivo tiene que ser de esa vertical»*. `NUCLEO/01` §2.4 consumidor 17 sigue repitiendo la versión corta |
| `F-8eB3-007` | la lápida vuelve al barrido y tres comparaciones no tienen lado izquierdo | **intacto, y sin haber sido mirado**: `git log 5ac5e92c9~1..HEAD -- 21-migracion.md` devuelve **cero commits**. La lápida sigue siendo *«la única fila `CANCELLED` … que ninguna transición produce»* y la salvedad 4 sigue nombrándola |
| `F-8cB3-007` | `G-R1-B` exige una llamada al proveedor desde CI | **intacto**: `B/20` §2 sigue diciendo *«o esa fecha **no es la que el proveedor confirmó**»* |
| `F-8cB3-020` | `B/02` §4 cierra `M-DATA-01` con una tabla de una fila | **intacto**: la conté hoy, sigue teniendo **una** fila |

---

## 3. Lo que esta pasada dice sobre `DEC-METH-011`, medido en mi vector

**El rastro funciona, y por primera vez se puede decir con un número mío**: de 92 líneas revisadas
una por una, **2 resultaron falsas**, y las dos produjeron hallazgos que ninguna vuelta anterior
podía producir (`F-8fB3-003` y `F-8fB3-004`). **Ese es el aporte real de `DEC-METH-011` y no es
chico**: una tasa de error del 2,2 % sobre justificaciones escritas es un dato que el programa
nunca tuvo.

**Y las dos falsas son del mismo modo, que es nuevo y que la enmienda no contempla.**

> **Un rastro declara una propiedad del ÁRBOL y se lee como una propiedad del TEXTO.** Las dos
> líneas eran **verdaderas en su SHA** y las volvió falsas un commit **posterior de la misma
> tanda** —`ce52dce5f` → `01599ec6a`, dos horas; `032f761e0` → `70d83299d`, menos de una—. Nadie
> editó el capítulo ni el rastro. El rastro **no lleva la fecha de caducidad de lo que afirma**.

Eso no es la exclusión de la prosa propia (modos 1 y 2 de `C1` §4.4) ni un grep mal elegido: es que
la unidad de la obligación es **la familia** y la caducidad ocurre **entre familias**. El reparto de
mis 7 atribuidos:

| por qué la enmienda no alcanzó | cuáles | qué haría falta |
|---|---|---|
| **el rastro se ejecutó y la justificación caducó por un commit posterior de la MISMA tanda** | `F-8fB3-003`, `F-8fB3-004` | que el rastro de la última familia **re-verifique las líneas de los rastros anteriores**, no sólo las apariciones del corpus. `12cc0879f` §5, `ce52dce5f` §6 y `8d6b27a12` §5 ya lo hacen **para lo que corrigieron**; lo que falta es lo que **invalidaron sin tocar** |
| **la aparición cae en el sujeto de la obligación 2 y NO se recorrió** | `F-8fB3-008` (`B/09` §7), y la mitad del `F-8fB3-002` que vive en `B/05` §2 | nada nuevo: la regla alcanzaba. Lo que falló es el **término elegido** — quien convierte una casilla en una fila tiene que grepear el verbo (*«escribe»*, *«idempotente»*) y no el sujeto |
| **la aparición está en un párrafo que el propio commit ESCRIBIÓ** — la exclusión viva | `F-8fB3-005`, `F-8fB3-006`, `F-8fB3-009` | comparar la **familia contra sí misma**: los tres son *«el commit A escribe algo verdadero y el commit B de la misma familia lo vuelve falso»*. Son **3 de 7**, y es el número que el §7 de las instrucciones le pide a `C1` para decidir la corrección B |
| **la aparición decisiva no es una aparición** — un encabezado de tabla, una cardinalidad, un § que la tanda no movió | `F-8fB3-007`, `F-8fB3-001` | la obligación **4** dada vuelta: *«¿el artefacto que mi guard dice recorrer existe?»* y *«¿cuántas filas admite la restricción que acabo de escribir, contra cuántos hechos puede producir el corpus?»*. Las dos son tablas de menos de diez filas |

**La medición que este vector propone para la vuelta que viene**, y es concreta: **cuántas líneas
de rastro caducan por un commit posterior de la misma tanda**. Es contable —para cada línea, si el
`git log -S` de su cita devuelve un commit posterior al sha del rastro, la línea está en riesgo— y
es la única de las tres causas de arriba que se puede automatizar entera. Mis dos falsas de 92 lo
habrían sido las dos.

---

## 4. Un patrón de mi vector, que cambió de forma y conviene decirlo

La vuelta pasada conté que **4 de los 6 predicados del barrido no tenían columna**. Hoy el cuadro es
otro, y vale medirlo igual:

| lo que el barrido pregunta hoy | la columna que necesita | ¿existe? |
|---|---|---|
| ¿tiene `sucede_a` no nulo y su predecesora ya no es fila viva? | `sucede_a`, `estado` | **sí** |
| ¿tiene un pago acreditado **pendiente de resolución**? | ninguna declarada | **no** — `F-8dB3-007`, abierta desde la vuelta 3 |
| ¿este beneficiario tiene un **ancla viva** en V? | `permanent_grant.revocado_en` | **sí, desde la 9-bis-4** |
| ¿el ancla que era título de esta instancia es de un **grant vivo**? | ídem | **sí** |
| ¿esta marca está abierta, y **desde cuándo**? | `reconciliation_mark.levantada_en`, `puesta_en` | **sí** — pero lo que la reescribe no está declarado (`F-8fB3-008`) |
| ¿por qué está marcada esta fila? | `reconciliation_mark.motivo` | **sí** |
| ¿hay una pausa vencida sin `fin_real` con su fila en `PAUSED`? | `subscription_pause.fin_previsto`, `fin_real` | **sí** |
| ¿hay una cortesía diferida cuya fila receptora ya está `ACTIVE`? | `courtesy_grant.saldo_días`, `sucedida_por` | **sí, y no alcanza** — el dominio no cierra (`F-8fB3-005`) |

**De 6 predicados sin columna pasamos a 1 de 8.** La tanda arregló de verdad lo que este vector
venía reportando tres vueltas seguidas, y hay que decirlo con el mismo peso con que se reportó.
**Lo que reemplazó al patrón viejo es uno nuevo, y son cuatro de mis nueve hallazgos**: ya no es
*«el predicado no tiene columna»* sino ***«la columna existe y el conjunto que el predicado
selecciona no coincide con el que su consumidor necesita»*** — el `UNIQUE` que admite una fila
donde el corpus produce N (`F-8fB3-002`), el guard anclado en una columna que su tabla no tiene
(`F-8fB3-007`), la transición que selecciona por una causa y su backstop por dos columnas
(`F-8fB3-006`), y los tres disparadores que no cubren el dominio de la espera que crearon
(`F-8fB3-005`). **Es el mismo defecto una capa más arriba**, y no se contesta con un inventario de
columnas: se contesta con un inventario de **cardinalidades y dominios**.

---

## 5. Ataques que intenté y el diseño resistió

**1. Que el `UNIQUE(beneficiario) WHERE revocado_en IS NULL` rompa la revocación y el re-otorgamiento.**
Era mi candidato más obvio contra `DEC-GRANT-009` y está cerrado con todas las letras: *«Es un
índice **parcial**, restringido a las filas vivas: las revocadas quedan afuera y se pueden acumular
sin límite, que es lo que el «revocar marca y no borra» de arriba necesita»* (`B/02` §2.4). Reintenté
por el lado del ancla —¿un grant revocado y uno nuevo compiten por `UNIQUE(permanent_grant_id,
vertical)`?— y tampoco: esa clave es **por grant**, así que dos instrumentos distintos anclan la
misma vertical sin colisión. **El único residuo es el escritor manual del corte** (`F-8fB3-003`), y
es de otro capítulo.

**2. Que la sexta comprobación marque el instante legítimo entre `S2` y `S9`.** El recuadro se
anticipa: *«`S9` corre en el mismo acto de la autorización; lo que esta comprobación levanta es la
corrida que **no se ejecutó**, contra un barrido diario»*, y el cobro de ese instante *«entra por su
propia marca, `COBRO_DURANTE_CORTESÍA`»*. Lo verifiqué contra la tabla de `B/02` §2.5: el motivo 12
existe, tiene escritor (`S14`) y tiene `SÍ` en la columna del dinero. **El riesgo está aceptado, con
su vía de salida escrita y su fila en el catálogo.**

**3. Que la quinta comprobación produzca un falso positivo sobre `S25`.** Era el ataque más
prometedor porque `S25` *«comparte evento con `S10`»*, o sea que dispara en el mismo instante en
que el detector espera una reanudación. **Está cerrado y contado**: `S25` *«escribe **las dos
columnas que el detector mira** —`fin_real` en la pausa y `CANCELLED` en la suscripción—, mientras
que la rama de fallo de `S10` no escribe ninguna de las dos»*. Recorrí las **cuatro** salidas de
`PAUSED` (`S10`, `S22`, `S13`, `S25`) contra las **tres** condiciones del detector y las tres se
rompen en las cuatro salidas salvo en la que corresponde. **Es la comprobación mejor cerrada del
capítulo.**

**4. Que la partición entre las cuatro salvedades se solape o deje un hueco, ahora que son diez
puertas.** La rehice entera sobre la tabla de hoy: **nueve** por la 4, **`S21`** por la 1, y las dos
mitades de `S23` y `S24` sobre pagador manual **exentas en la tabla de arriba** y explícitamente
fuera de la 4 —*«no vuelve al barrido a esperar una relectura que no existe»*—. Cierra sin
solapamiento y sin hueco, y el criterio que separa la 1 de la 4 sigue escrito y verificable. **Las
tres puertas nuevas (`S23`, `S24`, `S25`) se agregaron con su veredicto razonado una por una**, que
es lo contrario de lo que pasó con `S20`/`S21` dos tandas atrás.

**5. Que el `UNIQUE(subscription_id, período) WHERE el pago está acreditado` deje entrar dos pagos
al mismo `S19`.** Reintenté con las dos puertas de `S19` —el reciclado del proveedor y el registro
a mano— y no se pisan: la ventana de una sucesión es de **72 h** y un período es de un ciclo, así
que hay un solo período en juego, y `C5` impide dos acreditados sobre él. **La referencia única al
pago de la marca es correcta en esa rama**; donde falla es en `COBRO_POSTERIOR_A_LA_BAJA` y
`COBRO_POSTERIOR_AL_GRANT` (`F-8fB3-002`), que no están acotados por ninguna ventana.

**6. Que el motivo de la revocación en texto libre rompa `G-R1-F`.** Está anticipado y bien
separado: *«**No es un motivo de los de `reconciliation_mark`**, y conviene no confundirlos:
aquéllos son una **enumeración cerrada** que un guard verifica … Éste **no gobierna ningún
comportamiento**: es registro»* (`B/02` §2.4). Dos campos con el mismo nombre y dos regímenes
distintos, declarados en el mismo §.

**7. Que el listado accionable cuente mal los motivos que devuelven plata.** Conté las tres
apariciones de la cifra —`B/02` §2.5 (*«cuatro de los trece»*), `B/09` §2.4 (*«Cuatro de los trece
motivos»*), `B/19` §6 (*«los cuatro motivos»*), `NUCLEO/04` invariante 21 y `NUCLEO/08` §3— y las
**cinco dan cuatro**, sobre las mismas filas 1, 2, 3 y 12. La única grieta es que los motivos 4 y 13
dicen *«puede»* y el `B/09` §3 le pide al listado un trato especial para el 4 —*«el listado no lo
muestra como una divergencia más»*— que `B/19` §6 resuelve con un default explícito (*«**nada**, y
es el único»*) en vez de con el orden. **Se sostiene**, y lo anoto acá porque estuvo cerca.

**8. Que `revocar` deje `addon_instance.ancla_del_grant` apuntando a una fila borrada.** Cerrado en
tres lugares con la misma razón y con su consumidor nombrado: *«**Revocar NO borra ninguna fila** —
ni ésta ni sus anclas»* (`B/02` §2.4), *«la pregunta se hace DESPUÉS de la revocación, que es por
qué el ancla no se borra»* (`B/09` §3) y *«el corpus ya rechazaba ese mecanismo … **no como un
efecto lateral de borrar una fila**»* (`12-contrato…` §2.8). Es el ataque que en la vuelta pasada
abrió `F-8eB3-002` y hoy está cerrado por los dos lados.

**9. Que el corte escriba la lápida sobre un preapproval vivo, o que compita por el candado.** Sin
cambios y sin grietas nuevas: el orden sigue siendo parte de la regla y `CANCELLED` sigue fuera de
los vivos. **No toqué la población de producción por ningún ángulo**; `F-8fB3-003` es sobre la
**forma escribible** de una fila, no sobre las ocho ni sobre la cohorte.

---

## 6. Líneas de rastro que ataqué

**Criterio de selección.** Mi vector vive en cinco archivos (`B/02`, `B/05`, `B/09`, `B/14`,
`B/21`), así que ataqué **todas** las entradas que los diez rastros dedican a esos cinco, más los
bloques de `B/03` §3.2 y `B/20` que tocan la marca, la cortesía y los guards. Los cuatro rastros
elegidos son los que concentran esas entradas: `8d6b27a12` (las ocho decisiones: 10 entradas sobre
`B/09` y 9 sobre `B/02`), `f21d5d828` (la sucesión: 17 + 4 + 2), `032f761e0` (la baja: 30) y
`ce52dce5f` (el grant: 20). **Los otros seis los ataqué por término, no línea por línea** —con
`rg` sobre *«idempotent»*, *«charged»*, *«tres modos»*, *«cero cobros»*, *«S22»*, *«diez/once/trece
motivos»*— y ninguno tiene entradas en mi terreno.

| rastro | entradas leídas una por una | falsas hoy |
|---|---|---|
| `rastro-8d6b27a12.md` (`B/09` ×10, `B/02` ×9) | **19** | 0 |
| `rastro-f21d5d828.md` (`B/05`…`B/12` ×17, `B/21` ×4, `HOS-1353/21` ×2) | **23** | 0 |
| `rastro-032f761e0.md` (`B/03`, `B/02`, `B/14`, `B/20`, `descomposicion`) | **30** | **1** — la de `B/14` L264-271 (`F-8fB3-004`) |
| `rastro-ce52dce5f.md` (`B/12`/`B/19`/`B/21` ×16, `B/09`/`B/03` ×4) | **20** | **1** — la de `21-migracion.md` L129-133 (`F-8fB3-003`) |
| **total** | **92** | **2** (2,2 %) |

**Las dos falsas, con su cita exacta**, están en `F-8fB3-003` y `F-8fB3-004`. Las dos comparten
forma: **verdaderas en su SHA, falsas en `HEAD`, sin que nadie editara el capítulo ni el rastro**.

**Dos que estuvieron cerca y NO son falsas, y vale decir por qué**, porque la diferencia es la que
separa un hallazgo de un ruido:

- `rastro-8d6b27a12.md`, `B/09` **L474-494 · §3, el recuadro de la sexta** — *«sigue siendo la
  única que mira una cortesía, y lo que cambió es que ahora la mira **por dos caminos** en vez de
  uno»*. **Es verdadera**: la comprobación sigue siendo la única y los caminos son dos. Lo que la
  línea no afirma —y por eso no es falsa— es que los dos caminos **cubran el dominio**, que es
  `F-8fB3-005`. Una justificación correcta sobre una propiedad que no es la que importa **no es una
  justificación falsa**, y contarla como tal inflaría el número que esta pasada existe para medir.
- `rastro-ce52dce5f.md`, `21-migracion.md` **L142-149 · §2.4** — *«escribir dos grants de una
  vertical cada uno … es el otro extremo»* → *«sigue correcta, y es la forma del modelo que hace
  que la columna nueva viva donde vive»*. **Es verdadera y además es la que prueba que la de arriba
  es falsa**: las dos leen `revocado_en` y llegan a conclusiones incompatibles sobre la misma
  escritura. La reporto adentro de `F-8fB3-003` como evidencia, no como una tercera falsa.

**Y una verificación que hice y dio cero, que va porque un cero medido es un resultado**: las tres
secciones de auto-corrección que los rastros declaran —`rastro-12cc0879f.md` §5,
`rastro-ce52dce5f.md` §6 y `rastro-8d6b27a12.md` §5— dicen haber invalidado líneas de rastros
anteriores. **Verifiqué contra el texto de hoy las que caen en mi terreno** (las de `B/09`, `B/02`
y `B/20`) y **todas las que declaran corregido están efectivamente corregidas**. La
auto-corrección documentada del programa es real; lo que no alcanza es su **alcance**: las tres
secciones corrigen lo que el commit **tocó**, y mis dos falsas son líneas que otro commit
**invalidó sin tocar**.
