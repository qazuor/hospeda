---
title: "FASE 8-bis-5 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · B1 — doble cobro y pérdida de pago

Sexta pasada adversarial sobre la épica de billing (`HOS-1354`), el núcleo y el contrato, con el
mismo vector: **los caminos por los que a alguien se le cobra dos veces, se le cobra lo que no
corresponde, paga por algo que no recibe, o paga y no queda registrado.**

**Trece hallazgos — seis nuevos y siete que siguen llegando. Dos `CRITICA`, y los dos los
introdujo la tanda de arreglos**, uno por la familia del pagador manual y el otro por la familia
de la sucesión.

El dato que esta pasada produce y ninguna anterior pudo:

> **Los dos `CRITICA` están escritos en un rastro, con su justificación, y las dos
> justificaciones son falsas.** `rastro-8f9f31ac0.md` §4 pregunta 1 declara que *«la mitad (2) de
> `DEC-SUB-013` —el que vuelve paga el período que arranca, no los que pasó suspendido— **se
> cumple entera con el tope**»*, y con el tope paga los dos. `rastro-f21d5d828.md` §3 declara que
> la tabla de las cuatro condiciones del pago tardío *«sigue correcta: las cuatro no cambian; **lo
> que cambió es el motivo con que se marca si alguna falla**»*, y ese motivo nuevo es exactamente
> lo que clasifica la plata del cliente como *«no hay nada que devolver»*.
>
> No es *«la enmienda no sirve»* ni *«no se aplicó»*: **se aplicó, se escribió, y la resolución
> estuvo mal en las dos**. Es el desenlace que el §1.4 de las instrucciones nombra como el
> hallazgo más fuerte que esta pasada puede producir, y hasta esta vuelta era inseñalable.

Regla de lectura: cada hallazgo se apoya en cita textual con archivo y §. Los conteos los conté yo
sobre el texto vigente de este worktree y digo cómo. Verifiqué las citas ajenas contra el texto
del capítulo, nunca contra el informe ni contra el rastro que las cita.

**Reparto con `B3`**: `RC-5` —`summarized.charged_quantity` cuenta intentos y `B/09` §4 decide
*«no cobró nunca»* con él— **lo toma `B3`**. Lo cruza mi camino en `F-8fB1-004` y lo cito sin
escribirlo como hallazgo propio.

---

## CRITICA

### F-8fB1-001 — El tope de `MP4` deja la fecha del próximo cobro EN el instante de la reactivación y la condición de `MP5` es «ya llegó»: el pagador manual que se reabre tras una suspensión larga paga un período que transcurrió suspendido, el reloj le abre otro en la misma corrida y `S4` lo devuelve a `GRACE_PERIOD` el mismo día — la plata que puso no le compra ni un día de servicio

**Qué se rompe.** Un Partner que paga por transferencia se atrasa, lo declaran impago, pasa tres
meses `SUSPENDED` y transfiere el día 100. El admin registra el pago: `MP4` liquida la cuota del
período que arrancó el día 0 —el que pasó **casi entero suspendido**— y, como el avance de un
ciclo cae en el pasado, **el tope pone la fecha del próximo cobro en el día 100**. En la primera
corrida del reloj `MP5` encuentra que *«la fecha ya llegó y ese período no tiene cuota»*, abre la
cuota del período que empieza hoy, y **en el mismo acto `S4` lo manda a `GRACE_PERIOD`** con el
reloj corriendo otra vez hacia `SUSPENDED`. **Debe dos períodos completos el día que volvió**, y
el que pagó no le compró ningún día futuro.

**El camino.**

1. **Lo que `MP4` registra es la cuota VIEJA, y el § lo dice dos veces.** *«`MP4` actúa sobre **la
   misma fila de `manual_payment`** que `MP2` o `MP3` cerraron, o sea sobre el mismo período, y
   registrarla es liquidar exactamente lo que se debía»* (`B/03` §7.1, *«lo adeudado»*), y §7.2 lo
   repite: *«lo que `MP4` acaba de registrar **es la cuota del período impago**»*.
2. **Ese período es uno de los que pasó suspendido, por construcción.** `MP5` abre la cuota al
   arrancar el período y **`S4` entra a `GRACE_PERIOD` en el mismo acto** (`B/03` §3.2, fila
   `MP5`); agotado el grace, `S6` lleva la fila a `SUSPENDED` **dentro de ese mismo período**. Con
   el default de diez días de `DEC-SUB-002`, de los treinta días que esa cuota cubre **veinte se
   pasaron sin listado público, sin edición, sin creación y sin entitlements** (`S6`, `B/03`
   §3.2).
3. **Y la mitad (b) de la decisión del owner manda exactamente lo contrario.** *«**No se crean
   mientras la suscripción está `SUSPENDED`.** **El que vuelve paga el período que arranca, no los
   que pasó suspendido**»* (`B/03` §7.2, decisión del owner del 2026-09-21). Con el tope puesto,
   el que vuelve paga **los dos**: el período que pasó suspendido (`MP4`) y el que arranca
   (`MP5`).
4. **El tope deja la fecha en el instante de la reactivación, que es el único valor que hace
   disparar a `MP5` en el acto.** *«si el avance del punto 2 cae en el pasado —la suspensión duró
   más que un período— la fecha pasa a ser **el instante de la reactivación**»* (`B/03` §7.2,
   *«qué mueve la fecha del próximo cobro»*; lo espeja `B/02` §2.2, *«un tope, que corre sólo en
   `MP4`: si el avance cae en el pasado, la fecha pasa a ser el instante de la reactivación. **Su
   único lector es `MP5`**»*). Y la condición de `MP5` es *«**la fecha del próximo cobro ya llegó**
   y ese período no tiene cuota»* (`B/03` §7.2), con su evento enunciado igual: *«llegó la fecha
   del próximo cobro»* (`B/03` §3.2, fila `MP5`). *«Ya llegó»* incluye **ahora**.
5. **La cuota nueva no choca con nada, así que se crea.** El período se identifica **por su fecha
   de inicio** —*«el valor que «la fecha del próximo cobro» tenía cuando la cuota se abrió»*
   (`B/02` §2.3)—, y la cuota vieja lleva el día 0: son dos períodos distintos, el
   `UNIQUE(subscription_id, período)` de `B/05` §C5 no se opone y la idempotencia de `MP5` tampoco.
6. **Y `S7` no sostiene lo que el §7.1 promete.** *«**Entonces `S7` sin escala** … la fila vuelve a
   emitir fuente … `cubierto` vuelve a verdadero»* y *«**nada es retroactivo** — lo que la
   reapertura devuelve es **servicio de acá en adelante**»* (`B/03` §7.1). Ese servicio *«de acá en
   adelante»* **se factura aparte, en la primera corrida del reloj**: la fila pasa por `ACTIVE` el
   tiempo que tarda el schedule y vuelve a `GRACE_PERIOD`. Lo que la reapertura devuelve no es
   servicio: es un estado que dura hasta la corrida siguiente.
7. **Y el § afirma que no queda nada más que cobrar.** *«No queda remanente que compensar ni que
   cobrar aparte»* (`B/03` §7.1, *«lo adeudado»*). Queda una cuota entera, abierta en el mismo
   acto.
8. **La justificación del tope invierte los hechos.** La tabla de §7.2 dice: *«`S7` por `MP4`,
   desde `SUSPENDED` | **avanza un ciclo, con el tope** | ahí no hubo servicio … y **es la mitad
   (b): el que vuelve paga el período que arranca**, no los que pasó suspendido»*. El período que
   arranca **no es el que `MP4` registra**: es el que `MP5` abre después, con su propia cuota. La
   fila justifica el tope diciendo que produce un solo cobro y produce dos.
9. **Y la narración del § sólo recorre el caso corto.** *«Con el tope, la fecha queda en el día
   30, el reloj no encuentra nada que abrir hasta ese día, y los diez días son los que compró»*
   (`B/03` §7.2, *«al reabrir por `MP4`»*). El caso largo —**la única población en la que el tope
   corre**— no se narra en ninguna parte del §.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §7.1 (*«lo adeudado»*,
*«`ACTIVE` directo»*), §7.2 (*«qué mueve la fecha del próximo cobro»*, su tabla de las tres vueltas
a `ACTIVE`, y *«al reabrir por `MP4`»*) y §3.2 (`MP4`, `MP5`, `S4`, `S6`, `S7`);
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (*«la fecha del próximo cobro»*) y §2.3 (el período
identificado por su fecha de inicio).

**Severidad.** `CRITICA`. Es plata de más sobre el camino que `DEC-SUB-012` declara *«el camino
normal del que se atrasa y después paga»*, y contra la mitad (b) de `DEC-SUB-013` escrita con esas
palabras. El §7.1 argumenta que se reabre porque *«la persona **puso plata**»* y lo que esa plata
compra es cero días de servicio más una cuota nueva el mismo día.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia del pagador manual**
(`rastro-8f9f31ac0.md`, commits `11aac0088` y `89a38386c`), que reemplazó el re-anclaje
incondicional de `F-8eB1-001` por el tope. **El defecto no es el que había**: antes el re-anclaje
corría siempre y el daño estaba en la reapertura **dentro** del período —los días 20 a 30 pagados
dos veces—. Ese medio se cerró. Lo que el arreglo **conservó intacto** es el comportamiento sobre
la población larga, y **le puso encima una justificación que lo declara inexistente**.

**¿Lo habría encontrado el grep?** **No.** Los dos lados —el tope y la condición de `MP5`— viven
en `B/03` §7.2, que el commit escribió, y su espejo en `B/02` §2.2 lo escribió el mismo commit. El
término nuevo *«el instante de la reactivación»* aparece, contado con `rg` con y sin backticks
sobre los trece capítulos, el núcleo y el contrato, en **cuatro** líneas: `B/03` §3.2 (la celda de
`MP4`), `B/03` §7.2 dos veces y `B/02` §2.2 una — **los dos archivos que el commit escribió**. No
hay término viejo que se retire.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa** — el primero de los tres desenlaces del §1.4. `rastro-8f9f31ac0.md` §4, pregunta 1, línea
textual: *«La **mitad (2)** de la decisión —«el que vuelve paga el período que arranca, no los que
pasó suspendido»— **se cumple entera con el tope**; lo que cambia es el alcance del remedio, no la
elección.»* Con el tope, lo que se cumple es lo contrario: paga el que arranca **y** el que pasó
suspendido. Y hay una segunda línea, en otro rastro, que la ratifica sin verificarla:
`rastro-f21d5d828.md` §3, `B/03` — *«**L1409-1414 · §7.2** — el tope de `MP4` → **sigue
correcta**»*, sin argumento. **La regla se ejecutó, la aparición se recorrió dos veces y las dos
resoluciones fueron equivocadas.**

---

### F-8fB1-002 — `PAGO_TARDÍO_RECHAZADO` entra al catálogo de la marca con «¿hay plata del cliente que devolver? no», y sus CUATRO condiciones sólo fallan cuando la plata ya entró: el listado lo manda detrás de los cuatro motivos de dinero y sin default, que es literalmente el desenlace («el pago se quedaba») que el motivo se creó para cerrar — y el mismo hecho tiene dos motivos distintos declarados en el mismo capítulo

**Qué se rompe.** Alguien transfiere, o el proveedor le cobra una cuota reciclada, y el pago llega
sobre una fila que ya no lo puede recibir —`CANCELLED` por `S12`, por `S17`, por el espejo, o
`ABANDONED`—, o llega con otra fila viva del mismo `user + vertical`, o llega sobre un período que
ya tenía un pago acreditado. En los cuatro casos la plata **está en nuestra cuenta o ya salió de
su tarjeta** y no compró nada. El sistema abre la marca con motivo `PAGO_TARDÍO_RECHAZADO`, que el
catálogo clasifica **`no`** en la columna *«¿hay plata del cliente que devolver?»*, así que el
listado accionable lo ordena **detrás** de los cuatro que sí y **sin ninguna propuesta**. La
persona que lo abre encuentra un caso que el propio sistema le dice que no mueve plata.

**El camino, en dos mitades.**

**Mitad A · la clasificación es falsa sobre su población entera.**

1. **El catálogo lo declara.** *«| 7 | `PAGO_TARDÍO_RECHAZADO` | `S14`, desde el `B/05` §3 | leer
   **cuál de las cuatro condiciones falló** y resolver | **no** |»* (`B/02` §2.5, tabla de los
   trece motivos, última columna *«¿hay plata del cliente que devolver?»*).
2. **Y las cuatro condiciones que lo producen presuponen, todas, que el pago ya entró.** El § se
   titula *«Qué hace seguro a un **pago tardío**»* y arranca *«Un pago tardío es seguro de
   reactivar si y sólo si se cumplen las cuatro»* (`B/05` §3). Las recorrí una por una: la **1**
   falla sobre una fila `CANCELLED`, `ABANDONED` o ya `ACTIVE` —el pago existe, la fila no lo puede
   recibir—; la **2** falla porque *«el monto coincide»* no se cumple —hay un monto, distinto—; la
   **3** falla porque hay otra fila viva —*«queda pagando dos veces por la misma vertical»*, dice
   el propio §—; la **4** falla porque *«hay otro pago acreditado para el mismo período: **es un
   doble cobro**»*. **No existe una sola forma de llegar a este motivo sin que haya plata del
   cliente en juego.**
3. **Y la consecuencia de clasificarlo `no` está escrita en las dos superficies.** `B/19` §6: *«Se
   ordena poniendo **adelante los cuatro motivos** que significan «hay plata del cliente que
   devolver», que son **los únicos en los que esperar le cuesta al cliente**»*; y la tabla de
   defaults de ese mismo § no lo incluye, así que llega *«sin ninguna indicación»* — el estado que
   ese § declara, con todas las letras, **ya fallido**: *«el default vacío es el que ya falló … la
   persona que no sabe qué se espera de ella **no hace nada**»*.
4. **El guard está escrito para no verlo.** `G-R1-F` falla si el listado muestra la marca *«sin el
   default de `DEC-RF-003` **cuando el motivo es uno de los cuatro que devuelven plata**»*
   (`B/20` §2). La condición está acotada a los cuatro, así que sobre el 7 el guard es verde por
   construcción.
5. **Y es exactamente el modo de falla que el motivo vino a cerrar.** *«lo que le llegaba a la
   persona era una fila `CANCELLED` marcada, **indistinguible de las otras doce marcas**, sin nada
   que dijera que hay plata del cliente en nuestra cuenta. **El pago se quedaba.**»* (`B/02` §2.5,
   párrafo de apertura). Sobre el motivo 7 la marca ya no es indistinguible: **es distinguible y
   dice que no hay plata**, que es peor.

**Mitad B · el mismo hecho tiene dos motivos, y el motivo es lo que decide si la plata vuelve.**

6. **`B/05` §3 lo manda a `PAGO_TARDÍO_RECHAZADO`.** *«**Si falla cualquiera**, se pone la marca
   `requiere_conciliación` con motivo `PAGO_TARDÍO_RECHAZADO`»*.
7. **`B/05` §2, `C2`, manda el mismo hecho a `COBRO_POSTERIOR_A_LA_BAJA`.** *«**Desde `SUSPENDED`
   el cobro que entra es el que `S7` o `S19` esperaban, y llega tarde.** **La condición 1 del §3
   rechaza `CANCELLED`** … Así que la plata está en nuestra cuenta sin período que darle: **se pone
   la marca con motivo `COBRO_POSTERIOR_A_LA_BAJA`**»*, y el bullet siguiente dice lo mismo desde
   `GRACE_PERIOD` tras `S24`.
8. **Los dos motivos no son intercambiables: son la diferencia entre devolver y no.**
   `COBRO_POSTERIOR_A_LA_BAJA` es el motivo **2**, con `SÍ` en la última columna y **default en
   DEVOLVER** (`B/02` §2.5, `B/19` §6); `PAGO_TARDÍO_RECHAZADO` es el **7**, con `no` y sin
   default. **Un mismo pago tardío sobre una fila `CANCELLED` cae en los dos §§ del mismo
   capítulo**, y cuál de los dos gane decide si al cliente se le devuelve la plata.
9. **Y `G-R1-F` no dirime.** Su predicado es *«abre la marca **sin nombrar un motivo** de la
   enumeración cerrada … o nombra **uno que no está en esa tabla**»* (`B/20` §2): los dos motivos
   están en la tabla, así que las dos escrituras lo pasan. **Nada en el corpus exige que un hecho
   tenga un solo motivo.**

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.5 (el catálogo de los
trece, fila 7, y el párrafo de apertura); `HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3 (las
cuatro condiciones y su desenlace) y §2 `C2` (los tres bullets de `S22`/`S23`/`S24`);
`HOS-1354/docs/19-superficies.md` §6 (el orden del listado y la tabla de defaults);
`HOS-1354/docs/20-testing.md` §2 (`G-R1-F`).

**Severidad.** `CRITICA`. Hay plata del cliente que no compró nada, con un canal que la ordena
última y le dice a la persona que no hay nada que devolver. Es *«alguien paga de más»* con el
mecanismo de reparación apagado por su propia clasificación.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la sucesión**
(`rastro-f21d5d828.md`, el paso de `requiere_conciliación` de booleano a `reconciliation_mark` con
motivo). **Antes del arreglo el defecto no podía existir**: con un booleano no había clasificación
que fuera falsa, ni orden que mandara un motivo atrás, ni default que faltara. La mitad B tampoco:
los dos §§ escribían *«se pone la marca»* y eran la misma escritura. **El arreglo creó las dos
mitades en el mismo acto en que creó el instrumento.**

**¿Lo habría encontrado el grep?** **Sí, y es barato.** El término nuevo es
`PAGO_TARDÍO_RECHAZADO`. Contado con `rg`, con y sin backticks, sobre los capítulos y el núcleo:
**tres** apariciones —`B/02` §2.5, `B/05` §3 y `B/09` §3 (en el recuadro del plazo de la marca)—.
Leer las tres juntas pone la pregunta *«¿de dónde sale este motivo y qué tenía el cliente puesto
cuando salió?»* en la primera pantalla. El término viejo —*«se pone la marca
`requiere_conciliación`»*— es el que el propio arreglo declara que *«sigue diciendo lo mismo»*
(`B/02` §2.5 punto 4), y es justamente el que había que releer con la columna nueva al lado.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa.** `rastro-f21d5d828.md` §3, bloque `B/05-idempotencia-y-concurrencia.md`, línea textual:
*«**L175-180 · §3** — la tabla de las cuatro condiciones del pago tardío → **sigue correcta**: las
cuatro no cambian; **lo que cambió es el motivo con que se marca si alguna falla**.»* La
justificación nombra el cambio y lo descarta en la misma frase: **el motivo con que se marca es lo
único que decide si la plata vuelve**, y esa tabla es la que lo produce. Escribir *«sigue
correcta»* ahí exigía contestar *«¿y el motivo nuevo dice bien lo que pasa con la plata de estas
cuatro?»*, que es la pregunta que el arreglo entero existía para poder hacer. **La regla se
ejecutó sobre la aparición exacta y la resolución estuvo mal.**

---

## ALTA

### F-8fB1-003 — `S24` apaga el reloj del grace sobre un pagador manual y deja su cuota en `AWAITING` sin ninguna transición que la cierre: la transferencia en vuelo no tiene fila donde registrarse, y `C2` nombra sólo la puerta del reciclado del proveedor — contra el principio que toda esta tanda escribió tres veces

**Qué se rompe.** Un Partner en grace transfiere el día 8 y el día 9 se da de baja desde *Mi
Suscripción* (`S24`, self-service por `B/19` §5). La transferencia acredita el día 10. El admin
abre el caso y **no hay nada que registrar**: la fila de `manual_payment` quedó en `AWAITING` para
siempre, y las tres salidas de esa máquina son inejecutables. La plata queda en nuestra cuenta con
el cliente dado de baja y sin ningún motivo que la nombre.

**El camino.**

1. **En `GRACE_PERIOD` un pagador manual tiene SIEMPRE una cuota abierta.** *«un pagador manual
   llega a grace **porque su cuota de este período no se pagó**, así que esa cuota **ya existe** —es
   la que `MP1` registra— y el grace es su reloj»* (`B/03` §7.2, fila `GRACE_PERIOD`). La población
   de `S24` sobre un pagador manual no es un borde: **es el 100 %**.
2. **`S24` apaga el reloj y no dice nada de la cuota.** Su celda de efectos enumera la fecha de fin
   de servicio, la cancelación en el proveedor —*«sobre un pagador manual no se manda nada»*—, el
   disparo de `S18` y *«**Apaga el reloj del §4**»* (`B/03` §3.2). **La fila de `manual_payment` no
   aparece.**
3. **Y con el reloj apagado, las tres salidas de `AWAITING` mueren.** `MP3` sale de *«se agota el
   grace sin que el admin haga nada»* (`B/03` §7) — el grace ya no se agota. `MP2` tiene por efecto
   *«la suscripción va a `SUSPENDED` por `S6`»*, y `S6` sale de `GRACE_PERIOD`: sobre una
   `CANCELLED` no tiene sujeto. `MP1` tiene por efecto *«la suscripción sale de `GRACE_PERIOD` por
   `S5`»*, y la **condición 1** del `B/05` §3 —*«la suscripción existe y está en `GRACE_PERIOD` o
   `SUSPENDED`»*— **rechaza `CANCELLED`**. Por la regla 1 del núcleo, ninguna de las tres se
   ejecuta.
4. **Y el único § que mira lo que entra después de una baja nombra una sola de las dos puertas.**
   `C2` dice: *«**Desde `GRACE_PERIOD` el cobro que entra es el reciclado del proveedor**, y llega
   tarde. `S24` canceló el preapproval «de inmediato», así que lo que puede entrar después es un
   cobro que ya estaba en vuelo»* (`B/05` §2). Sobre un pagador manual **no hay preapproval que
   reciclar** (`B/06` §7, citado por `B/03` §7.1) y lo que entra es una transferencia. El bullet
   describe una población que en este método no existe y deja afuera la que sí.
5. **Y eso contradice el principio que esta misma tanda escribió tres veces.** *«el daño **no
   depende de por qué puerta entró el pago**»* (`B/03` §3.2, filas `MP1` y `MP4`); *«**son DOS las
   puertas** por las que puede entrar, no sólo el reciclado … el desenlace es idéntico»* (`B/12`
   §5.3); *«el evento se enuncia sobre el hecho —entró el pago del período impago— y no sobre el
   mecanismo que lo trajo»* (`B/03` §3.2, `S19`). El bullet de `C2` es el único lugar de la tanda
   donde la puerta manual volvió a quedar afuera.
6. **Y el desenlace que queda es el peor de los dos.** Si el admin intenta registrar igual, cae en
   `PAGO_TARDÍO_RECHAZADO` — que es el motivo que `F-8fB1-002` muestra clasificado *«no hay plata
   del cliente que devolver»*. Si no lo intenta, no hay marca de ninguna clase: ninguna de las
   **seis** comprobaciones de cero llamadas de `B/09` §3 mira una cuota de `manual_payment` en
   `AWAITING` —miran `sucede_a`, el pago pendiente por `S19`, las filas vivas bajo un ancla, una
   instancia de addon, el reloj de una pausa y una cortesía diferida—, y las salvedades 2 y 3
   devuelven al barrido la terminal **con marca** o **con un pago acreditado pendiente por `S19`**:
   una cuota `AWAITING` no es ninguna de las dos.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S24`, `S5`, `S6`),
§4 y §7 (la tabla de `MP1`/`MP2`/`MP3`) y §7.2 (la fila `GRACE_PERIOD`);
`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §2 `C2`, tercer bullet, y §3 condición 1;
`HOS-1354/docs/09-conciliacion.md` §3 (las cuatro salvedades y las seis comprobaciones).

**Severidad.** `ALTA`. Es plata del cliente que no queda registrada y que ningún proceso vuelve a
mirar. No la subo a `CRITICA` porque exige que la transferencia y la baja se crucen, y la ventana
—el tiempo de acreditación bancaria— no está medida en ninguna parte del corpus.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-014` (`S24`)**, de la tanda corta de las
ocho decisiones (`rastro-8d6b27a12.md`, commit `0f7b1e17d`). Antes de `S24` no había salida de
`GRACE_PERIOD` que no fuera `S5` o `S6`, y las dos dejan la cuota resuelta.

**¿Lo habría encontrado el grep?** **Sí.** El término viejo es `AWAITING`. Contado con `rg`, con y
sin backticks, sobre los trece capítulos y el núcleo: **21** líneas, todas en `B/02`, `B/03`,
`B/05` y `NUCLEO/01`. `0f7b1e17d` tocó `B/03`, así que la tabla del §7 estaba en el archivo abierto —y el
propio rastro declara haber grepeado *«el grace sale por `S5` o `S6`»* y haberlo corregido en
`B/03` §4, tres § más arriba de la tabla que deja huérfana.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y debería estar** — el
segundo desenlace del §1.4. Recorrí `rastro-8d6b27a12.md` entero: su bloque de `B/03` tiene **dos**
entradas de §7 —L1184-1191 y L1193-1203, las dos sobre el **tope de `MP4`**— y **ninguna sobre la
tabla del §7 ni sobre `AWAITING`**; la palabra no aparece en ninguno de los diez rastros. Las
apariciones de `MP2` y `MP3` no se corrigieron y viven en un párrafo que ese commit no tocó, así
que caen enteras dentro de la obligación 2. Y la línea que sí se escribió —*«`S24` **no le agrega
población**: su `desde` es `GRACE_PERIOD`, y `MP4` reabre desde `DECLARED_UNPAID` sobre una fila
`SUSPENDED`»*— **es verdadera y contesta la mitad equivocada**: razona sobre `MP4` y `SUSPENDED`,
que es la mitad que `S24` no toca, y no pregunta por `MP1` y `AWAITING`, que es la que crea.

---

### F-8fB1-004 — El grace del pagador manual ES el beneficio de entrada que `B/12` §4.3 prohíbe: `S2` → `MP5` → `S4` lo pone en `GRACE_PERIOD` con servicio entero en el acto del alta, y el mecanismo que `§4.5` declara que cierra el ciclo —morir en `CHARGE_DECLINED`— tiene ahí población vacía, escrita y argumentada

**Qué se rompe.** Quien contrata un plan Partner con pago manual recibe los días de grace
—default **10**, `DEC-SUB-002`— **con servicio entero** sin haber transferido un peso, y si nunca
transfiere el ciclo se puede repetir: `S6` lo suspende, `S23` cierra la fila y libera el candado
`A`, y un alta nueva vuelve a empezar en grace. `B/12` §4.5 declara por escrito que eso no puede
pasar, y su razón no aplica a esta población.

**El camino.**

1. **El alta entra directo al grace, y el § lo construye así a propósito.** *«La fila llega a
   `ACTIVE` y la fecha es ese instante, así que la primera corrida del reloj abre la primera
   cuota»* (`B/03` §7.2, escritura 1) y `MP5` *«en el mismo acto la suscripción entra en
   `GRACE_PERIOD` por `S4`»* (`B/03` §3.2). **No hay ningún estado intermedio en el que la cuota
   esté abierta y la fila no esté en grace.**
2. **Y en grace el servicio es entero.** *«arranca el reloj del §4; el servicio **sigue entero**
   (§20)»* (`B/03` §3.2, `S4`), y `GRACE_PERIOD` **sí emite fuente** (`12-contrato…` §2.6).
3. **La regla que lo prohíbe está escrita en imperativo.** *«**El grace no es un beneficio de
   entrada.** Una suscripción cuyo **primer cobro de esa autorización** se rechaza no pasa por
   `GRACE_PERIOD`: va a **`CHARGE_DECLINED`**, que es terminal»* (`B/12` §4.3).
4. **Y su garantía de no-repetición cuelga de un mecanismo que acá no tiene sujeto.** *«lo que
   cierra ese ciclo no es el contador sino el destino: **cada reintento muere en `CHARGE_DECLINED`
   sin pasar por `GRACE_PERIOD`**, así que **no hay diez días que cosechar** por más veces que se
   repita»* (`B/12` §4.5, punto 1). Sobre un pagador manual `S16` **no corre**, y el propio
   capítulo lo declara: *«`S16` exige que sea **el primer cobro de esa autorización** y que **el
   proveedor la haya cancelado al rechazarlo**; un pagador manual **no tiene autorización en el
   proveedor** … así que las dos mitades son falsas y **`CHARGE_DECLINED` tiene acá población
   vacía**»* (`B/03` §7.2, *«cómo entra el grace»*).
5. **Y ese § saca de ahí la conclusión invertida.** Dice *«**no cae en el §4.3** … por el predicado
   de `S16` y no por una excepción»*. Lo que el predicado vacío de `S16` establece es que el
   **remedio** del §4.3 no tiene sujeto acá, no que su **regla** no se viole: la regla es *«el
   grace no es un beneficio de entrada»*, y acá el grace **es** la entrada. El § contesta una
   pregunta distinta de la que el §4.3 hace.
6. **Y el ciclo se puede repetir desde que `S23` existe.** *«**Libera el candado `A`** … y de paso
   le devuelve a la persona el alta nueva que el candado le bloqueaba»* (`B/03` §3.2, `S23`). Antes
   de `S23` un pagador manual `SUSPENDED` quedaba encerrado —es la razón escrita de esa fila—, así
   que la cosecha se daba **una sola vez**. Con `S23` self-service (`B/19` §5), se da **por
   intento**, que es exactamente la palabra con que `B/12` §4.3 describe el daño que rechazó:
   *«Conceder el grace falla hacia **diez días gratis por intento, repetibles**»*.

**Dónde lo permite el diseño.** `HOS-1354/docs/12-suscripcion.md` §4.3 y §4.5 punto 1;
`HOS-1354/docs/03-maquinas-de-estado.md` §7.2 (*«cómo entra el grace»* y la escritura 1), §3.2
(`S2`, `S4`, `S16`, `S23`, `MP5`) y §4; `HOS-1352/docs/12-contrato-de-cobertura.md` §2.6.

**Severidad.** `ALTA`. Es *«alguien paga de menos»* de forma repetible, sobre la única vertical
donde el §17.2 admite el método, y el corpus contiene la regla contraria escrita en imperativo con
su garantía de no-repetición apoyada en un mecanismo que ahí no existe. **No la subo a `CRITICA`
por una razón que hay que declarar**: hoy la población es cero, porque ninguna transición lleva a
un pagador manual a `ACTIVE` (`F-8eB1-005`, más abajo, sigue llegando). **El día que el capítulo 13
escriba esa alta, este hallazgo pasa a `CRITICA` sin que nadie toque el §7.2** — y ése es
exactamente el tipo de caso que el §4 de las instrucciones admite del hueco del 13.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y hay que decir cuál.** La entrada al grace por
`MP5` la escribió `DEC-SUB-013` en la tanda anterior; lo que **esta** tanda agregó es la
repetibilidad, con `S23` liberando el candado `A` (`rastro-032f761e0.md`, la baja), y el párrafo
*«cómo entra el grace»* sobrevivió a las dos tandas sin que nadie lo cruzara con `B/12` §4.5.

**¿Lo habría encontrado el grep?** **Sí.** El término es *«el grace no es un beneficio de
entrada»*. Contado con `rg`: **cinco** líneas en dos archivos —**dos** en `B/12` (§4.3, título y
regla) y **tres** en `B/03` (§7.2 y §3.2)—. El commit de `S23` (`rastro-032f761e0.md`) **no tocó
`B/12` §4.3 ni §4.5**, así que la
aparición vive en capítulo intacto y la búsqueda la devuelve en la primera pantalla.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y debería estar.**
Recorrí `rastro-032f761e0.md`: su bloque de `B/12` no tiene ninguna entrada de §4.3 ni de §4.5, y
la palabra *«beneficio de entrada»* no aparece en ninguno de los diez rastros. La aparición no se
corrigió y vive en un párrafo que ningún commit de la tanda tocó: cae entera dentro de la
obligación 2, y escribir *«sigue siendo correcta»* sobre *«no hay diez días que cosechar por más
veces que se repita»* exigía contestar *«¿y cuando el destino no es `CHARGE_DECLINED`?»*.

---

### F-8eB1-004 (sigue llegando) — El reembolso que `S21` declara posible sigue sin nadie que enrute el caso, y ahora la ausencia es demostrable por construcción: el catálogo de motivos de la marca es CERRADO, tiene trece, y ninguno es el suyo

**Dónde llega hoy.** El texto de `S21` está intacto: *«**Sin reembolso del período ya cobrado**; si
corresponde devolver, entra por la vía del reembolso, que **confirma una persona**
(`DEC-RF-002`)»* (`B/03` §3.2), y `B/16` §4.4 lo repite. Lo que cambió es que **ahora se puede
probar que nadie lo enruta**, cosa que en la 8-bis-4 sólo se podía argumentar: `B/02` §2.5 declara
*«la enumeración es **cerrada** y el conteo se recalcula»*, lista **trece** motivos, y `G-R1-F`
*«falla si alguna transición o comprobación del corpus pone la marca sin nombrar un motivo de esta
tabla»* (`B/20` §2). Recorrí los trece: ninguno nombra un complemento huérfano con período
cobrado. **Así que la vía que `S21` declara no sólo no tiene quién la dispare: bajo `G-R1-F` no se
puede escribir sin agregar un motivo catorce.**

**Y el hueco simétrico se cerró en la tanda, lo que hace más visible éste.** `S24` produjo la
segunda fila de la rama 6 y ese caso **sí** tiene motivo, default y orden en el listado
(`DEC-RF-003`, `B/19` §6). El de `S21` no tiene ninguno de los tres.

**Severidad.** `ALTA`, la misma que en la 8-bis-4: plata del cliente por servicio no recibido, sin
devolución y sin nadie que la mire. `NUCLEO/08` §3 sigue diciendo *«una acción con permiso,
auditoría y confirmación declarados **no sirve de nada si nadie enruta el caso**»*.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4** (`F-8eB1-004`,
`DEC-ADDON-004`). La tanda de la marca (`rastro-f21d5d828.md`) construyó el catálogo cerrado y
**no le agregó fila**, con lo que convirtió una omisión en una imposibilidad declarada.

---

### F-8eB1-005 (sigue llegando) — Ninguna transición lleva a un pagador manual a `ACTIVE`, así que el §7 entero sigue con población vacía: lo verifiqué otra vez sobre el texto de hoy y `S2` no cambió una palabra

**Dónde llega hoy.** `MP5` *«**Sólo corre con la suscripción en `ACTIVE`**»* (`B/03` §3.2), y el
único camino al `ACTIVE` inicial sigue siendo `S2`, cuyo evento es *«**webhook de autorizada**,
confirmado por relectura»* (`B/03` §3.2) — lo conté con `rg` sobre los trece capítulos: *«webhook
de autorizada»* devuelve **una** línea, la fila `S2`, que no ganó ninguna cláusula. Un pagador
manual *«no tiene débito en el proveedor»* (`B/06` §7, citado dos veces en `B/03` §7.1), así que no
hay preapproval que autorice y el evento no ocurre; a las 72 h `S3` lo manda a `ABANDONED`.

**Y la tanda lo ratificó desde dos lados sin mirarlo.** La fila `PENDING_AUTHORIZATION` del §7.2
sigue razonando *«todavía no hay fecha del próximo cobro: **la estrena `S2`** al arrancar el
período»*; y `B/03` §3.1 agregó, para `S23`, que sobre un pagador manual la baja *«era la única de
las tres que podía existir»* — un párrafo entero sobre las salidas de una fila que no puede nacer.

**Severidad.** `ALTA`, sin cambios. No mueve plata por sí solo, pero deja sin población las cinco
filas del §7, dos decisiones del owner (`DEC-SUB-012`, `DEC-SUB-013`), tres escrituras de columna,
un guard (`G-R6`) y `F-8fB1-004`.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4**, y es del hueco del capítulo
13. **Ningún commit de las cinco familias lo tocó** — verificado contra la tabla del §2.3 de las
instrucciones: ninguna de las diez líneas de rastro nombra el alta de un pagador manual.

---

### F-8eB1-006 (sigue llegando, `NUCLEO`) — `MP1` y `MP4` escriben el predicado del grupo B sobre `sucede_a` y siguen sin figurar en el inventario de `NUCLEO/01` §2.4: son DOS consumidores faltantes, no uno, y la regla que lo obliga está escrita en imperativo en ese mismo §

**Dónde llega hoy.** Conté el inventario sobre el texto vigente: **20 filas**, 10 en el grupo A
(1-6 y 17-20) y 10 en el grupo B (7-16). **Ninguna es `MP1` ni `MP4`**, y las dos celdas escriben
el término textual: *«o queda pendiente por `S19`, **si es la predecesora de una sucesión en
curso**»* (`B/03` §3.2, filas `MP1` y `MP4`), que es el mismo predicado que el inventario lista
para `S17`, `S19`, `G-R1-D` y la regla de `B/12` §5.3. La regla 3 del propio § sigue diciendo
*«**quien escribe un consumidor nuevo agrega su fila al inventario de arriba en el mismo acto**»*,
y el § declara por qué importa más que cualquier búsqueda: *«un predicado nuevo **no aparece**
buscando el término viejo, así que lo único que lo detecta es que la lista de consumidores tenga
una fila menos que los consumidores»*.

**Lo que sí verifiqué y está bien, y hay que acreditarlo.** `S22`, `S23` y `S24` **no** son
consumidores —su `desde` es un estado concreto—, y `B/03` §3.2 lo declara con su razón: *«ninguna
de las tres es consumidora de «fila viva», así que el inventario de `NUCLEO/01` §2.4 no gana
filas»*. Recorrí las tres y es correcto. El inventario de *«ancla viva»* ganó sus filas y el de
*«grant vivo»* también.

**Severidad.** `ALTA` como registro, igual que en la 8-bis-4: no hay daño hoy —las dos delegan en
`S19`, que sí lleva el adjetivo—, pero es la lista que hace ejecutable a `G-R1-E`.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4**, con **un consumidor más de
los que reporté**: entonces conté sólo `MP4`; `MP1` lleva la misma frase desde antes y tampoco
figura.

---

## MEDIA

### F-8fB1-005 — `B/03` §3.2 da TRES enumeraciones distintas de «los caminos por los que la predecesora se muere sola» —seis, cuatro y cinco— en cien líneas, y la de cinco omite `S24` y cierra con «en ninguno de los tres»

**Qué se rompe.** Quien lea el § para saber cuándo `S18` cierra la sucesión sin `S17` —que es el
acto que abre la marca `REEMBOLSO_POR_CONFIRMAR` sobre el pago que `S19` retuvo— encuentra tres
respuestas incompatibles en el mismo §, y la que está escrita como conclusión es la más corta.

**El camino.** Las tres, textuales y en orden de aparición:

1. **Seis** — *«Cuando la predecesora se muere sola —por `S12`, por `S16`, por el espejo del
   §10.1, o porque ella misma pidió la baja estando pausada (`S22`), suspendida (`S23`) o en el
   grace (`S24`)—»* (encabezado de *«Por qué `S18` también sale de `PENDING_AUTHORIZATION`»*).
2. **Cuatro de las ocho** — *«En `S12`, en `S16`, en **el espejo** y en **`S24`** corre **sin
   `S17`**»* (`S18` corre en siete de las ocho).
3. **Cinco** — *«**`S18` sin `S17` es lo CORRECTO en los CINCO caminos por los que la predecesora
   se muere sola —`S12`, `S16`, el espejo del §10.1, `S22` y `S23`—**, y en ninguno de **los tres**
   deja viva una autorización»*. **`S24` no está**, y el *«los tres»* del cierre es el conteo
   anterior a `S22`/`S23`/`S24`: el párrafo argumenta sobre tres y afirma sobre cinco.

4. **El dominio correcto es el de la escritura 5, y sí incluye `S24`**: *«**el espejo** (rama 5),
   **`S23` y `S24`** (las dos filas de la rama 6) y el cierre normal con `S17` (rama 1)»* (`B/03`
   §3.2, tabla de las dos escrituras con dominio propio), y `B/12` §5.3 lo espeja.

**Severidad.** `MEDIA`. **No hay pérdida de plata**: el dominio que decide quién abre la marca del
reembolso está escrito aparte y sí nombra `S24`. Lo que queda mal es la frase que un implementador
lee como la regla, y el *«en ninguno de los tres»* que argumenta sobre un conjunto que ya no es el
que enumera.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la baja** (`rastro-032f761e0.md`, `S22` y `S23`) y
**la tanda corta** (`rastro-8d6b27a12.md`, `S24`), en dos pasos: la primera llevó *«tres»* a
*«cinco»* en la enumeración y dejó el *«los tres»* del cierre; la segunda agregó `S24` en dos de
las tres enumeraciones y no en la que la primera había tocado.

**¿Lo habría encontrado el grep?** **Sí.** El término es *«se muere sola»* / *«sin `S17`»*, y las
tres apariciones están en `B/03` §3.2, que los dos commits tocaron — o sea que la obligación 1
(*«todo el corpus, incluidos los archivos que el commit toca»*) la cruza, y la 2 no.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: cae en la exclusión que
`DEC-METH-011` dejó viva a propósito.** `rastro-8d6b27a12.md` §4 registra dos correcciones vecinas
—*«`S18` escritura 4 | enumeraba los caminos por los que no corre sin `S24` | `S24` es otro»* y
*«`S18` escritura 5 | «el espejo, `S23` y el cierre normal» | también `S24`»*— y las dos son de
párrafos que el commit editó. La tercera enumeración vive en el mismo archivo, veinte líneas más
arriba de la primera, y **el commit no la tocó**, así que cae en el modo 3 de `C1` §4.4: el párrafo
no editado dentro del archivo editado, que la obligación 2 sí alcanza y no se recorrió.

---

### F-8eB1-011 (sigue llegando, y hoy es peor) — `B/09` §3 sigue diciendo «Es la rama que mueve dinero, y la única de las cuatro que lo hace»: las ramas son SEIS y las que mueven dinero son TRES, y la línea que se corrigió está cuatro renglones abajo en el mismo recuadro

**Dónde llega hoy.** El párrafo es textual, verificado sobre `B/09` §3: *«*«La sucesión se cerró»*
la deja en `CANCELLED` por `S17` — **terminal** … Es la rama que mueve dinero, y **la única de las
cuatro** que lo hace.»* Y `B/12` §5.3 cierra, hoy: *«**Las seis ramas** valen para las dos puertas,
y **las TRES que abren la marca de dinero** ya tienen dónde asentarla»* — las ramas 1, 5 y 6.

**Y el agravante es el mismo de la vuelta pasada, repetido.** Cuatro renglones más abajo, en el
**mismo recuadro**, el texto sí se actualizó: *«`S18` abre la marca `REEMBOLSO_POR_CONFIRMAR` —por
la rama 1, por la 5 **y por la 6**»*. La aparición equivocada estuvo en pantalla mientras se
escribía la corregida, por segunda tanda consecutiva.

**Severidad.** `MEDIA`. No cambia el desenlace —la salvedad 3 y la comprobación alcanzan las tres
ramas—, pero es un conteo congelado sobre la única parte del capítulo 09 que decide qué se hace
con plata retenida, y ya lleva dos tandas.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4** (`F-8eB1-011`), **con el conteo
corrido otra vez**: reporté *«cinco ramas, dos mueven dinero»*; hoy son seis y tres.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y cae en la misma
exclusión de siempre.** Grepeé *«la única de las cuatro»* y *«la rama que mueve dinero»* sobre los
diez rastros: **cero apariciones**. `rastro-8d6b27a12.md` §3 tiene cuatro entradas de `B/09` §3 y
ninguna es ésta; `rastro-f21d5d828.md` §3 tiene cuatro y tampoco. El párrafo está inmediatamente
arriba de un hunk editado, o sea en el hueco que `F-8eB1-011` señaló como *«el dato metodológico
más útil»* de la vuelta anterior — **y la 9-bis-4 no lo cerró, porque `DEC-METH-011` no levantó la
exclusión.**

---

### F-8eB1-008 (sigue llegando, la mitad) — `C3` sigue hablando de «la suscripción» en singular y `S21` sigue sin ningún cruce de los seis: un cobro que se acredita después de que `S21` canceló un complemento no tiene quién declare que se pone la marca

**Dónde llega hoy.** `C3` es textual e intacto: *«si un cobro se acredita **después** de que el
grant canceló **la suscripción**, no debería poder ocurrir por `GT-1` — y si ocurre igual, **se
pone la marca … con motivo `COBRO_POSTERIOR_AL_GRANT`**»* (`B/05` §2). **La mitad de `S20` se puede
leer cubierta por extensión** —`S20` también es *«el grant cancelando una suscripción»*, y los
trece motivos le dan destino—, así que esa mitad de mi hallazgo de la vuelta pasada la doy por
cerrable. **La de `S21` no**: su disparador no es un grant ni una cancelación pedida por el
cliente, sino que su instancia llegó a `CANCELLED` por `A5` o `A6` (`B/03` §3.2), y los seis cruces
del §52 siguen siendo seis sin que ninguno lo nombre.

**Y `C2` sí se amplió en la tanda**, con tres bullets nuevos para `S22`, `S23` y `S24`, lo que
muestra que el § se abrió y se recorrió: la ampliación fue por el eje de la baja y no por el de los
complementos.

**Severidad.** `MEDIA`, bajada desde la de la vuelta pasada porque la mitad de `S20` se puede leer
cubierta. El retraso del cobro está medido *«entre 26 y 44 minutos»* (`PA-3`), así que la ventana
no es un borde.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4** (`F-8eB1-008`,
`DEC-ADDON-004`).

---

### F-8eB1-010 (sigue llegando, `NUCLEO`) — `D16` y `G-R5` siguen comparando el tope de pausa del CATÁLOGO contra el hard delete, y la quinta comprobación que la tanda agregó NO alcanza a una cortesía larga: su condición es «el `fin_previsto` ya pasó», y una cortesía de 200 días no vence antes del día 180

**Dónde llega hoy.** El invariante no cambió: `D16` compara *«el tope de una pausa, en días»* del
catálogo contra el día del hard delete, y `G-R5` compara *«esas dos»* cifras (`B/20` §2). La
cortesía sigue sin tope —*«cortesía sobre cortesía → **se suman los días**»* (`B/03` §5)— y `S9`
sigue sin pasar por `puedePausar()` (`B/03` §3.2 y §7.2).

**Lo que la tanda agregó, y por qué no alcanza.** `B/09` §3 declara ahora el punto ciego con todas
las letras: *«`D16` compara … **dos cifras de configuración**, las dos … **ciegas a que una pausa
concreta lleve 140 días abierta**. `G-R5` sigue en verde en ese escenario»*, y pone delante la
**quinta comprobación**. Pero su condición es *«una `subscription_pause` **sin `fin_real`** cuyo
**`fin_previsto` ya pasó**»*: sobre una cortesía de 200 días el `fin_previsto` cae el día 200 y el
hard delete corre el **180**, así que el detector **está callado justamente durante la ventana en
que el contenido se borra**. El detector encontrado cubre la reanudación que no ocurre, no la pausa
legítimamente más larga que el hard delete.

**Severidad.** `MEDIA`, sin cambios. Pérdida de datos sin vuelta sobre una población chica y con un
`SUPER_ADMIN` humano eligiendo los días.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis-4** (`F-8eB1-010`, `DEC-DATA-002`).
Lo que la tanda de la retención agregó (`rastro-5836ec219.md`) es el detector vecino y la
declaración del punto ciego; el punto ciego sigue ahí.

---

### F-8bB1-009 (sigue llegando, cuarta vuelta) — `G-R1-D` sigue enunciado como una propiedad de una ejecución en una capa que declara que los guards son propiedades del árbol de fuentes

**Dónde llega hoy.** Verificado sobre `B/20`: la capa sigue definida como *«**guards** |
propiedades del **código**, no de una ejecución | **el árbol de fuentes, en CI**»* (§1), y `G-R1-D`
sigue diciendo *«un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o el de `MP4`—
**que en ese instante** es la predecesora de una sucesión en curso … o **reembolsa** el pago …
**antes** de que la sucesión se resuelva»* (§2). *«En ese instante»* y *«antes de que la sucesión
se resuelva»* siguen siendo propiedades de una corrida.

**El conteo, recontado por mí sobre la tabla vigente.** Los guards de la familia `R1` son **seis**
desde que entró `G-R1-F` —el § lo dice y lo verifiqué—, más `G-R4`, `G-R5`, `G-R6` y `G-R6-B`. De
los nuevos, **`G-R1-F` y `G-R6` están bien planteados**: el primero lee el texto de los caminos
contra una tabla cerrada, el segundo cruza las columnas que leen las condiciones contra las que
escriben las transiciones — *«eso es una propiedad del texto, no de una ejecución»*, dice el propio
`B/03` §7.2. Siguen siendo **tres** los que enuncian propiedades de una corrida: `G11`, `G-R1-B` y
`G-R1-D`.

**Severidad.** `MEDIA`, sin el agravante que la 8-bis-3 le sumaba. Es el andamiaje, no el daño.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis** (`F-8bB1-009`). La tanda le sumó
dos guards hermanos bien planteados y no revisó el enunciado del viejo.

---

## BAJA

### F-8fB1-006 — `B/03` §7.1 y §7.2 cuentan DOCE puertas a un estado terminal y `B/09` §3 y `B/16` §4.4 cuentan TRECE: falta `S25`, y el rastro registra la corrección como «doce/trece»

**Qué se rompe.** Nada operativo: la salvedad 4 de `B/09` §3 enumera *«**nueve** de las **diez**
filas «no»»* y las conté una por una sobre su tabla — son diez y la lista es correcta. Lo que queda
mal es la cifra narrativa en dos lugares de `B/03`.

**El camino.** Contado con `rg` sobre los capítulos: `B/03` §7.1 —*«Sus puertas son **doce** desde
que `S22`, `S23` y `S24` le agregaron tres»*— y `B/03` §7.2 —*«sus puertas son **doce** desde
`S22`, `S23` y `S24`»*— contra `B/09` §3 —*«un conjunto de **trece** puertas a un estado
terminal»*, con su tabla de trece filas, **`S25` incluida**— y `B/16` §4.4 —*«que hoy tiene
**trece**»*—. La decimotercera es `S25`, que las dos frases de `B/03` no cuentan porque enumeran
sólo las tres bajas.

**Severidad.** `BAJA`. Es un conteo congelado que no gobierna ninguna decisión: la lista operativa
está en `B/09` §3 y es correcta.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda corta** (`rastro-8d6b27a12.md`).

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro, y la línea registra la
corrección con las dos cifras a la vez.** `rastro-8d6b27a12.md` §4, tabla de premisas volvidas
falsas: *«| `B/03` §7.1 y §7.2 | *«once puertas»*, *«tres pares»*, *«cinco comprobaciones»* |
**doce/trece**, cuatro, seis |»*. La celda de la derecha da dos valores para un solo sujeto y el
texto quedó con el más chico en los dos lugares. **La regla se ejecutó sobre la aparición exacta y
la corrección se aplicó a medias.**

---

## `NUCLEO` — lo que encontré en `docs/nucleo/` y no resuelvo acá

1. **`F-8eB1-006`** — `MP1` y `MP4` siguen fuera del inventario de `NUCLEO/01` §2.4 (20 filas,
   contadas por mí). `ALTA` como registro. **Son dos consumidores faltantes, no uno.**
2. **`F-8eB1-010`** — `D16` (`NUCLEO/04`) y `G-R5` siguen ciegos a la cortesía, y el detector nuevo
   no alcanza la ventana que importa. `MEDIA`.
3. **Lo que verifiqué y está bien.** `NUCLEO/07` §6 gana la fila *«reapertura tras un pago manual
   tardío»* con **tres** cosas obligatorias, incluida *«**cuándo vence la próxima cuota** … si el
   atraso fue más largo, **hoy**, y la cuota ya está abierta»*: el aviso **sí** dice lo que
   `F-8fB1-001` cobra. Lo que falta no es el aviso: es la decisión de cobrar los dos períodos.
   `NUCLEO/08` §3 sigue con sus doce filas y su regla *«no sirve de nada si nadie enruta el caso»*
   bien escrita; lo que falta es su aplicación a `S21`. `NUCLEO/01` §2.5 y §2.6 ganaron sus dos
   inventarios nuevos con `G-R1-F` vigilándolos.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta pasada** movió:

1. **El alta de un pagador manual**, que sigue sin escribirse (`F-8eB1-005`). De ella cuelgan hoy
   `F-8fB1-001` y `F-8fB1-004`: el primero se ejecuta apenas exista, el segundo **cambia de
   severidad** apenas exista. Si el 13 resuelve el alta creando igual un preapproval, `B/03` §7.1 y
   `B/06` §7 —*«no hay débito en el proveedor»*— hay que reescribirlos, y con ellos el tope, las
   tres escrituras de la fecha y la mitad de `DEC-SUB-012`.
2. **Con qué se devuelve una transferencia.** `B/02` §2.3 ya admite que un `refund` cuelgue de un
   `manual_payment`, pero no hay hecho en el proveedor al que mandarle nada, y `F-8fB1-003` agrega
   una población que **ni siquiera tiene fila donde registrar el ingreso** antes de devolverlo.
3. **El reembolso que `S21` declara posible** (`F-8eB1-004`): sin motivo en la tabla cerrada, sin
   marca, sin reloj y sin nadie que enrute el caso.

---

## Cómo dio la medición que esta pasada existe para producir

| | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 | **8-bis-5 (`B1`)** |
|---|---|---|---|---|---|
| hallazgos | 14 | 12 | 9 | 12 | **13** — 6 nuevos + 7 que siguen llegando |
| `CRITICA` · `ALTA` · `MEDIA` · `BAJA` | 7 · 5 · 2 · 0 | 5 · 5 · 2 · 0 | 3 · 4 · 2 · 0 | 2 · 4 · 6 · 0 | **2 · 5 · 5 · 1** |
| **`CRITICA` atribuidos a la tanda anterior** | 6 de 7 | 5 de 5 | 3 de 3 | 2 de 2 | **2 de 2** |
| **`CRITICA` que el grep habría encontrado** | — | — | 2 de 3 | 1 de 2 | **1 de 2** |
| **`CRITICA` que la resolución por aparición habría atrapado** | — | — | — | 0 de 2 | **2 de 2 — y las dos estaban EN el rastro, mal resueltas** |

Los conteos de las cuatro primeras columnas salen de las tablas finales de mis informes
anteriores; los de la quinta los conté sobre este archivo.

### El veredicto sobre `DEC-METH-011`, desde mi vector

**La enmienda se ejecutó, y eso es lo primero que hay que decir.** Los cuatro rastros que toqué
existen, nombran sus commits, declaran su método de partición y se pueden leer línea por línea.
Ninguna vuelta anterior podía escribir esta sección.

**Y lo que la enmienda cambió es qué clase de problema es el que queda.** La tabla, por hallazgo:

| # | hallazgo | ¿el commit tocó el capítulo del defecto? | ¿lo encontraba el grep? | ¿la resolución por aparición? |
|---|---|---|---|---|
| 001 | el tope y la cuota inmediata | **sí**, lo escribió | no | **SÍ — está en el rastro, dos veces, mal resuelta** |
| 002 | `PAGO_TARDÍO_RECHAZADO` | **sí** | **sí** | **SÍ — está en el rastro, mal resuelta** |
| 003 | `S24` y la cuota `AWAITING` | **sí** | **sí** | **no está, y debería estar** |
| 004 | el grace de entrada | no (`B/12` §4.3 intacto) | **sí** | **no está, y debería estar** |
| 005 | las tres enumeraciones | **sí** | no (los tres lados en `B/03`) | **no está, y debería estar** |
| 006 | doce contra trece puertas | **sí** | **sí** | **está, y la corrección se aplicó a medias** |

**Tres desenlaces, y son los tres del §1.4, con proporciones que importan:**

1. **La resolución equivocada (001, 002, 006).** **La mitad de mis hallazgos nuevos, y los dos
   `CRITICA`.** La regla se ejecutó, la aparición se recorrió, se escribió una justificación y la
   justificación era falsa. **Es un problema distinto de los cuatro anteriores**, y hay que decirlo
   con claridad: en las vueltas 8-bis a 8-bis-4 el generador era *«no se miró»*; acá es *«se miró y
   se concluyó mal»*. Lo primero se arregla con una obligación; lo segundo, no — ninguna regla de
   proceso hace verdadera una conclusión.
2. **La regla no ejecutada sobre esa aparición (003, 004).** Las dos viven en párrafos que ningún
   commit tocó, o sea dentro de la obligación 2, y ninguna figura en ninguno de los diez rastros.
   Las dos las encontraba el grep del término viejo (`AWAITING`, *«beneficio de entrada»*). **La
   cobertura por familia no es cobertura por término**: los diez rastros grepean los términos que
   la familia **define**, y los dos que faltan son términos que la familia **rompe sin nombrar**.
3. **La exclusión viva (005, y `F-8eB1-011` que sigue llegando).** El párrafo no editado dentro del
   archivo editado. `DEC-METH-011` la dejó *«medida para la vuelta que viene»* y ésta es la vuelta:
   **de mis seis nuevos, uno cae ahí**, más uno que sigue llegando de la vuelta pasada por la misma
   puerta. Es una proporción baja — y el que sigue llegando lleva dos tandas en el mismo hueco, con
   la línea corregida cuatro renglones abajo de la equivocada. Lo dejo señalado como medición, no
   como propuesta: eso es del owner.

**Un sesgo que hay que declarar, igual que las cuatro vueltas anteriores.** El §2 manda mirar
primero lo que cambió, así que la búsqueda estaba dirigida al tope de `MP4`, a `MP5`, a
`S22`/`S23`/`S24`/`S25`, a `reconciliation_mark` y a `courtesy_grant.saldo_días`. Recorrí también
las superficies que la tanda **no** tocó de mi vector —`B/05` §2, `B/12` §4.3 y §4.5, `B/06`,
`B/22`— y produjeron **dos** de los seis nuevos (`F-8fB1-002` en su mitad B y `F-8fB1-004`), los
dos porque el texto debajo de ellas cambió. **Y hay un sesgo heredado que se agravó**: cinco de mis
trece caen sobre el pagador manual, que sigue siendo la población que tres decisiones del owner
tocaron y que **todavía no puede existir**.

---

## Ataques que intenté y el diseño resistió

- **Cobrar dos veces el mismo período por las dos puertas del pago manual.** Resiste, y ahora con
  la pieza que le faltaba: el `UNIQUE(subscription_id, período) WHERE el pago está acreditado`
  (`B/05` §C5) es evaluable desde que el período **se identifica por su fecha de inicio** y la
  cuota nace con ella escrita (`B/02` §2.3). Probé `MP1` × reciclado, `MP4` × reciclado y `MP4` ×
  reapertura repetida: los tres chocan contra la misma clave, y la condición 4 del `B/05` §3 los
  rechaza antes.
- **Que el tope de `MP4` colisione con una cuota existente.** Resiste y está argumentado en los dos
  archivos: *«deja siempre una fecha **estrictamente posterior** a la anterior, y las cuotas que
  existen son las de períodos que arrancaron antes»* (`B/02` §2.3, `B/03` §7.2). Recorrí las tres
  escrituras y el tope uno por uno con un período de 30 días y suspensiones de 5, 20, 30, 35 y 100
  días: ninguna deja la fecha atrás de donde estaba. **El defecto que encontré no es la colisión:
  es que el valor que deja dispara `MP5` en el acto.**
- **Que `MP1` avance la fecha sobre un pago que después se reembolsa.** Resiste, y lo verifiqué
  rama por rama. El avance es incondicional en la celda de `MP1`, así que corre también cuando
  `S19` retiene el pago. Recorrí las seis ramas de `B/12` §5.3: en la 1, la 4, la 5 y la 6 la
  predecesora queda `CANCELLED` —la fecha avanzada no la lee nadie—; la 2 **reactiva** y ahí el
  avance es correcto; la 3 termina en `CANCELLED` cuando `S15` resuelve y `S18` cierra. **No queda
  ninguna rama en que una fila viva conserve una fecha avanzada sobre plata devuelta.**
- **Que `S22` se lleve un período pagado de un pagador manual.** Resiste por población vacía, y por
  dos razones independientes: `S8` exige `puedePausar()`, que sobre un pagador manual es `false`
  (`B/06` §7, `B/03` §7.2), y `S9` sale de `ACTIVE`, estado en el que un pagador manual **no tiene
  cuota abierta** —`MP5` la abre y `S4` lo saca en el mismo acto—. Recorrí las dos puertas.
- **Que `S23` deje colgado el pago que `S19` retenía.** Resiste por tres capas: `S18` corre sin
  `S17` y abre la marca con motivo `REEMBOLSO_POR_CONFIRMAR` (escritura 5, con su dominio escrito),
  la rama 6 de `B/12` §5.3 tiene acto y default en DEVOLVER (`DEC-RF-003`), y la salvedad 3 de
  `B/09` §3 devuelve la terminal al barrido hasta que la bandera se apague. Probé la combinación
  peor —`S24` sobre una predecesora con pago retenido y sucesora en `PENDING_AUTHORIZATION`— y las
  tres corren.
- **Que `S20` deje un complemento cobrando lo que acaba de declarar gratis.** Resiste, y el orden
  normativo es lo que lo sostiene: *«**Primero la instancia** … **Después el cobro**»* (`B/03`
  §3.2), con la segunda fila de la tercera comprobación de `B/09` §3 preguntando exactamente por el
  estado que una corrida cortada deja. Verifiqué que con el orden inverso la población de esa
  comprobación queda vacía, que es lo que `B/16` §3.4 argumenta.
- **Que la cortesía diferida se pierda o se cobre.** Resiste por cuatro piezas que verifiqué una
  por una contra el texto y no contra el informe: `saldo_días` en `courtesy_grant` (`B/02` §2.4),
  la escritura 4 de `S18` con su dominio, los **tres** disparadores de `S9` y la **sexta**
  comprobación de cero llamadas con sus dos preguntas (`B/09` §3). El cobro del proveedor entre
  `S2` y `S9` **está declarado con motivo propio** (`COBRO_DURANTE_CORTESÍA`, con `SÍ` en la
  columna de dinero y default en devolver) — es el riesgo que `DEC-GRANT-007` aceptó por escrito y
  no lo reporto.
- **Dos cortesías vivas sobre el mismo beneficiario, o dos grants.** Resiste: `DEC-GRANT-009` lleva
  el `UNIQUE(beneficiario) WHERE revocado_en IS NULL` a la base, y `S9` exige *«no hay pausa
  vigente»*.
- **Que la marca de reembolso se apague junto con otra al resolverla.** Cerrado de verdad: `S15`
  *«levanta UNA marca —la del motivo que esa persona resolvió—, no la fila»* (`B/03` §3.2), con el
  `UNIQUE` parcial de `B/02` §2.2 detrás y la rama 3 de `B/12` §5.3 declarando las dos marcas
  abiertas. Era el medio que la 8-bis-2 abrió como `F-8cB3-005`.
- **Los cinco críticos que `DEC-MIG-004` retiró.** No los toqué por ningún ángulo, y los recorrí
  para confirmar que ninguno de mis trece es uno de ellos disfrazado.
- **`DEC-MP-003` y `DEC-MP-004` sin implementar.** No los reporto: el §4 de las instrucciones los
  declara pendientes y conocidos. Sí verifiqué lo que ese § deja abierto —si `B/03` §10.1 espejando
  esa pausa con `S8`/`CUSTOMER_REQUEST` **rompe algo más**— y del lado del dinero **no encontré
  nada nuevo**: una pausa con motivo `CUSTOMER_REQUEST` sobre un pagador con tarjeta no abre cuota,
  no mueve la fecha (la corre el proveedor, `PS-6`) y `S22` desde ahí no deja período pagado que
  sostener. El daño que la decisión ya enumera —que se le cuente como pausa del cliente contra los
  topes del §26.3— es el único que encontré.
- **`RC-5` y `B/09` §4.** Lo crucé al recorrer `F-8fB1-004`: si `charged_quantity` cuenta intentos,
  un alta manual rechazada no se distingue de una cobrada. **No lo escribo como hallazgo: es de
  `B3` por el reparto del §4.1.**

---

## Líneas de rastro que ataqué

**Revisé 186 afirmaciones sobre las 1.030 declaradas**, repartidas en **cuatro** de los diez
rastros. Elegí esos cuatro porque son los que tocan plata en mi vector: el pagador manual (la
columna que decide cuándo se cobra), la sucesión (la marca que decide si la plata vuelve), la baja
(qué queda por cobrar desde cada estado) y las ocho decisiones (que tocaron los cuatro anteriores).
**No revisé** `rastro-5836ec219.md` (la retención), `rastro-ce52dce5f.md` (el grant y el addon) ni
los cuatro de guards —`12cc0879f`, `7676082e6`, `31ce26bb2`, `40b922120`—: sus sujetos son el reloj
de inactividad y el catálogo de guards, y los verifiqué contra el corpus en vez de contra su
rastro. Es una omisión declarada, no un cero medido.

| rastro | qué revisé | cuántas | falsas |
|---|---|---|---|
| [`rastro-8f9f31ac0.md`](../21-fase-9-bis-4/rastro-8f9f31ac0.md) · el pagador manual | **entero**: las 65 apariciones del §3 y las 4 preguntas del §4 | **69** | **1** |
| [`rastro-f21d5d828.md`](../21-fase-9-bis-4/rastro-f21d5d828.md) · la sucesión | los bloques de `B/03`, `B/05`, `B/06`, `B/09`, `B/10` y `B/12` del §3 | **35** | **1** |
| [`rastro-8d6b27a12.md`](../21-fase-9-bis-4/rastro-8d6b27a12.md) · las ocho decisiones | §1, §2, los bloques de `B/03` y `B/09` del §3, las 24 filas del §4, los 6 puntos del §5 y las 5 preguntas del §6 | **48** | **3** |
| [`rastro-032f761e0.md`](../21-fase-9-bis-4/rastro-032f761e0.md) · la baja | las apariciones de §3 que nombran período pagado, cuota, `MP1`–`MP5` o pagador manual, más las 13 filas del §4, sus 2 bullets y las 4 preguntas del §5 | **34** | **0** |

**Las cinco que resultaron falsas, con su línea:**

1. **`rastro-8f9f31ac0.md` §4, pregunta 1** — *«La **mitad (2)** de la decisión —«el que vuelve
   paga el período que arranca, no los que pasó suspendido»— **se cumple entera con el tope**»*.
   **Falsa**: con el tope paga los dos. Es `F-8fB1-001`.
2. **`rastro-f21d5d828.md` §3, `B/05` L175-180** — *«la tabla de las cuatro condiciones del pago
   tardío → **sigue correcta**: las cuatro no cambian; **lo que cambió es el motivo con que se
   marca si alguna falla**»*. **Falsa en su conclusión**: el motivo nuevo es lo que clasifica esa
   plata como *«nada que devolver»*. Es `F-8fB1-002`.
3. **`rastro-8d6b27a12.md` §5, punto 5** — *«**`rastro-8f9f31ac0.md`** (el pagador manual) —
   **ninguna dejó de ser cierta**»*. **Falsa**: la pregunta 1 de ese rastro ya era falsa cuando se
   escribió, no dejó de ser cierta después.
4. **`rastro-8d6b27a12.md` §5, punto 6** — *«**`rastro-f21d5d828.md`** y **`rastro-5836ec219.md`**
   — **no se encontró ninguna justificación caduca**»*. **Falsa** para el primero, por la línea 2
   de esta lista.
5. **`rastro-8d6b27a12.md` §4, fila `B/03` §7.1 y §7.2** — la corrección registrada como
   *«**doce/trece**»*. **Aplicada a medias**: el texto quedó en doce en los dos lugares y el conteo
   real es trece. Es `F-8fB1-006`.

**Y dos líneas que verifiqué a fondo porque eran las más expuestas, y resultaron verdaderas.** Las
anoto porque un cero medido también es un resultado:

- **`rastro-f21d5d828.md` §3, `B/03` L1422-1437** — *«el riesgo aceptado de `DEC-GRANT-007` («el
  proveedor puede cobrar») **no tiene población** sobre un pagador manual, lo cual es estrictamente
  mejor»*. **Verdadera**: sin preapproval no hay cobro entre `S2` y `S9`. Y la conclusión
  *«estrictamente mejor»* también se sostiene: la re-emisión de `S9` no depende del proveedor.
- **`rastro-032f761e0.md` §3, `B/03` L1185-1192** — *«`S22` y `S23` **no crean filas en
  `CANCEL_SCHEDULED`**, así que no le agregan población a esa celda»*. **Verdadera**, y la
  verifiqué contra la tabla de los cinco estados que no abren cuota. **Lo que esa línea no cubre es
  la celda de `GRACE_PERIOD`**, que `S24` rompió una tanda después y ningún rastro volvió a mirar
  — es `F-8fB1-003`.
