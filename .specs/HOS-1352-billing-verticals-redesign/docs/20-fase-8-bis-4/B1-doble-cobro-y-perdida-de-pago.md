---
title: "FASE 8-bis-4 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · B1 — doble cobro y pérdida de pago

Quinta pasada adversarial sobre la épica de billing (`HOS-1354`), el núcleo y el contrato de
cobertura, con el mismo vector: **los caminos por los que a alguien se le cobra dos veces, se le
cobra lo que no corresponde, se le cobra después de irse, o paga y no recibe lo que pagó.**

**Doce hallazgos —once nuevos y uno que sigue llegando—. Dos `CRITICA`, y los dos los introdujo
la decisión más chica de la tanda**: `DEC-SUB-013` / `MP5`, *«la cuota del manual»*, que entró en
el commit titulado *«cerrar los tres items chicos que quedaban»* (`1c17565e1`, seis archivos).

El dato que esta pasada produce, y es distinto del de las tres anteriores:

> Las vueltas 8-bis, 8-bis-2 y 8-bis-3 encontraron arreglos que **redefinían un término** y lo
> aplicaban de más o de menos. Ésta encuentra otra cosa: **un mecanismo nuevo cuya única condición
> lee un dato que nadie escribe**. `MP5` dispara sobre *«el período actual arrancó y no tiene
> fila»*, y el corpus entero tiene **dos** escrituras de *«período actual»* —`S2`, que lo arranca,
> y el re-anclaje de `MP4`— y **ninguna que lo avance**. El mecanismo no está mal enunciado: está
> enunciado sobre una columna que no se mueve.

Y el `CRITICA` gemelo es el reverso: la **única** escritura que sí mueve esa columna, el
re-anclaje de `MP4`, la mueve **sin condición**, así que le re-cobra al cliente los días del
período que acaba de pagar.

Los dos `CRITICA` están en el mismo `§7.2`, escrito entero por el mismo commit, y ninguno de los
dos es un término redefinido: **ningún grep los encuentra, y la resolución por aparición tampoco,
porque las dos apariciones son párrafos que ese commit escribió de cero.**

Regla de lectura: cada hallazgo se apoya en cita textual con archivo y §. Los conteos los conté yo
sobre el texto vigente del worktree y digo cómo. Verifiqué las citas ajenas contra el texto del
capítulo, no contra el informe que las cita.

---

## CRITICA

### F-8eB1-001 — El re-anclaje de `MP4` es incondicional, así que el pagador manual que se pone al día DENTRO del período que estaba pagando queda pagando dos veces los días que le quedaban: el período nuevo arranca en la reactivación y el reloj le abre la cuota siguiente en el acto

**Qué se rompe.** Un Partner que paga por transferencia se atrasa, lo declaran impago, transfiere
el día 20 de un período mensual que arrancó el día 0, y el admin lo registra. Paga **el importe
esperado de ese período entero** (`B/05` §3, condición 2). En el mismo instante la fila se
reactiva y **el período se re-ancla al día 20**, así que los diez días que quedaban del período
que acaba de pagar pasan a ser el arranque del período **siguiente**, `MP5` le abre la cuota, y
`S4` lo devuelve a `GRACE_PERIOD` con el reloj corriendo. **Los días 20 a 30 los paga dos veces**,
y ni el correo ni la pantalla lo dicen.

**El camino.**

1. **La reapertura registra la cuota VIEJA, no la del período que arranca.** *«`MP4` actúa sobre
   **la misma fila de `manual_payment`** que `MP2` o `MP3` cerraron, o sea sobre el mismo período,
   y registrarla es liquidar exactamente lo que se debía»* (`B/03` §7.1, *«lo adeudado»*), y lo
   repite el §7.2: *«lo que `MP4` acaba de registrar **es la cuota del período impago** —la misma
   fila que `MP2` o `MP3` cerraron, por el importe esperado de ese período»*.
2. **Y el período se re-ancla igual, sin mirar si el viejo terminó.** *«**`MP4` lleva la fila a
   `ACTIVE` por `S7`, y desde ese instante el reloj vuelve a crear. El período nuevo arranca EN LA
   REACTIVACIÓN**, no en el aniversario viejo: se re-ancla el «período actual» de la fila
   (`B/02` §2.2) al día en que `S7` la reactiva»* (`B/03` §7.2). **No lleva ninguna condición**: ni
   *«si la suspensión cruzó un cierre de período»*, ni *«si el período viejo ya venció»*.
3. **El argumento que lo justifica sólo vale para la suspensión larga, y está escrito así.**
   *«No es una elección, es lo único compatible con (b). **Con el ancla vieja, el inicio del
   período siguiente cae en el pasado —tantas veces como meses duró la suspensión—** y el reloj,
   en su primera corrida, crearía de golpe todas las cuotas que (b) mandó no crear»* (`B/03`
   §7.2). Cuando la reapertura cae **dentro** del período impago, el inicio del siguiente **no**
   cae en el pasado: cae el día 30, y con el ancla vieja no hay ninguna cuota de golpe que evitar.
   El remedio se aplica a una población en la que su propio motivo no existe.
4. **Y el reloj cobra en el acto, no el mes que viene.** `MP5` dispara cuando *«el período actual
   arrancó y no tiene fila»* (`B/03` §7.2) y **en el mismo acto la suscripción entra en
   `GRACE_PERIOD` por `S4`** (`B/03` §3.2, fila `MP5`). El período nuevo arrancó el día 20 y no
   tiene fila —la que `MP4` registró es la del período viejo—, así que la cuota se abre el día 20.
5. **Lo pagado sin usar no se compensa, y el corpus tiene la regla contraria escrita.**
   `DEC-SUB-006` define el crédito como *«lo pagado sin usar»* y `B/12` §5.2 lo cita para el
   cambio de plan. Acá hay diez días pagados sin usar y **ninguna transición los mira**: `S7` sólo
   *«restituye la publicación»* (`B/03` §3.2).
6. **Y el servicio que esos diez días compraron tampoco existió.** `S6` deja la fila *«sin listado
   público, sin edición, sin creación, sin entitlements comerciales»* (`B/03` §3.2) y §7.1 cierra
   que *«**nada es retroactivo** — lo que la reapertura devuelve es servicio de acá en adelante»*.
   O sea: del período que pagó entero recibió los días de grace y nada más, y el resto se lo
   re-cobran.
7. **Ningún aviso lo dice, y los dos que existen se escribieron en esta misma tanda.**
   `B/19` §4 fila 10-bis enumera *«qué devuelve la reapertura y qué no»* —servicio, publicación,
   `PB7`, el contenido que el hard delete borró, y `S19`— y **no nombra el período nuevo**. El
   correo *«reapertura tras un pago manual tardío»* de `NUCLEO/07` §6 dice *«**dos cosas y ninguna
   es opcional**: que el servicio volvió y desde cuándo, y qué pasó con la ficha»*. Ninguna de las
   dos es *«y desde hoy te corre un período nuevo»*.
8. **El § se preocupa por la dirección opuesta y la nombra.** *«**Y no le regala nada a nadie**:
   … el cliente pagó lo que debía y lo que empieza es un período nuevo por el que va a pagar»*
   (`B/03` §7.2). La frase es verdadera y esconde que el período nuevo **empieza encima del que ya
   pagó**.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §7.1 (*«lo adeudado»*),
§7.2 (*«al reabrir por `MP4`»* y la tabla de estados de `MP5`) y §3.2 (`MP5`, `S4`, `S6`, `S7`);
`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3, condición 2;
`HOS-1354/docs/19-superficies.md` §4, fila 10-bis;
`HOS-1352/docs/nucleo/07-outbox-y-notificaciones.md` §6, fila *«reapertura tras un pago manual
tardío»*.

**Severidad.** `CRITICA`. Es un cobro duplicado sobre días concretos, sobre el camino que
`DEC-SUB-012` declara *«el camino normal del que se atrasa y después paga»*, y con la elección de
producto invertida: el §7.1 argumenta que se reabre porque *«la persona **puso plata**»* y el
§7.2 le cobra el mismo período dos veces.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-013` (`MP5`), commit `1c17565e1`.** El
re-anclaje no existía antes de esa decisión; nació con ella, en el § que la implementa, y nació
sin condición.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es *«re-ancla»* / *«el período nuevo
arranca en la reactivación»*, y lo conté con `rg`: aparece **sólo en `B/03` §7.2**, en los tres
párrafos que ese commit escribió. El término viejo —*«período actual»*— aparece en **cinco**
líneas de dos archivos (`B/02` §2.2 una, `B/03` §7.2 cuatro), y el commit tocó los dos. Buscar
cualquiera de los dos, en cualquier dirección, devuelve sólo texto propio.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y hay que decir por qué.** La
obligación 2 manda escribir el rastro para cada aparición *«que no se corrige y está en un párrafo
que el commit no tocó»*. Acá la aparición **es** el párrafo que el commit escribió de cero: no hay
ninguna aparición previa que contradiga, porque el mecanismo no existía. **La enmienda no alcanza
a un defecto que nace entero adentro de la prosa nueva**, y éste es de esa clase.

---

### F-8eB1-002 — `MP5` dispara sobre «el período actual arrancó» y en todo el corpus hay DOS escrituras de esa columna y ninguna la avanza: después de la primera cuota, la del pagador manual no se abre nunca más y el servicio queda gratis en silencio, que es el daño que `MP5` vino a cerrar

**Qué se rompe.** El Partner que paga por transferencia paga **una sola vez en su vida**. Pagada
la primera cuota, `S5` lo devuelve a `ACTIVE`, el período nunca avanza, `MP5` no vuelve a
encontrar *«un período actual sin fila»*, no se abre ninguna cuota más, nadie le pide nada y
—porque `ACTIVE` emite fuente con `hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6)— **sigue
cubierto para siempre**.

**El camino.**

1. **La condición de `MP5` es una sola y es sobre esa columna.** *«la condición no es «es hoy»
   sino **«el período actual arrancó y no tiene fila»**»* (`B/03` §7.2), y la idempotencia se
   apoya en lo mismo: *«**Idempotente por condición**: no crea si ya existe una fila de
   `manual_payment` para ese período»* (`B/03` §3.2, fila `MP5`).
2. **La columna existe.** `subscription` guarda *«…estado, **período actual**, fecha de fin de
   servicio…»* (`B/02` §2.2).
3. **Y tiene exactamente DOS escrituras declaradas en todo el corpus.** Lo conté con
   `rg "período actual|arranca el período|inicio de período|inicio del período"` sobre los trece
   capítulos de `HOS-1354`, los ocho del núcleo y el contrato: **ocho líneas en tres archivos**, y
   sólo dos son escrituras — `S2`, *«arranca el período»* (`B/03` §3.2), y el re-anclaje de `MP4`,
   *«se re-ancla el «período actual» de la fila al día en que `S7` la reactiva»* (`B/03` §7.2).
   **Ninguna la avanza de un período al siguiente.**
4. **El § lo sabe y le atribuye el acto a una transición que no lo declara.** La fila
   `GRACE_PERIOD` de su propia tabla dice: *«el período **no avanza** mientras el pago no entra:
   **`S5` es lo que lo cierra**»* (`B/03` §7.2). **`S5` no declara ese efecto**: su celda de
   efectos, entera, es *«se apaga el reloj»* (`B/03` §3.2). Es la regla 1 del núcleo aplicada al
   propio capítulo que la invoca cinco veces — *«lo que la tabla no declara, no pasa»*.
5. **Para el pagador con tarjeta no hace falta, y el § dice por qué, con lo que convierte el hueco
   en específico de esta población.** *«el pagador con tarjeta que reactiva no re-ancla nada,
   **porque las fechas las tiene el proveedor** y son inmutables (`EX-39`, `B/12` §5.4)»*
   (`B/03` §7.2). El pagador manual **no tiene proveedor** —*«no hay débito en el proveedor»*
   (`B/06` §7, citado en `B/03` §7.1)—, así que las fechas no las tiene nadie.
6. **Y el desenlace está nombrado como inadmisible por la decisión que creó `MP5`.** *«La cuota
   **la crea un reloj** … No la crea un admin a mano: **una cuota que nadie crea es servicio
   gratis en silencio**»* (`B/03` §7.2, decisión del owner). La segunda cuota, y la tercera, y
   todas, no las crea nadie.
7. **Ningún detector lo ve.** El barrido compara *«estado | monto vigente | fecha del próximo
   cobro | cobros del período | la `version`»* contra el proveedor (`B/09` §3), y **no hay
   proveedor** que leer sobre un pagador manual. Las **cuatro** comprobaciones de cero llamadas
   miran `sucede_a`, el pago pendiente por `S19`, el ancla de un grant y una instancia de addon;
   ninguna pregunta si una suscripción de pagador manual tiene una cuota abierta.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §7.2 (la condición de
`MP5`, su tabla de estados y la frase *«`S5` es lo que lo cierra»*) y §3.2 (`S2`, `S5`, `MP5`);
`HOS-1354/docs/02-modelo-de-datos.md` §2.2 (la columna) y §2.3 (`manual_payment`, *«el período que
cubre»*); `HOS-1354/docs/09-conciliacion.md` §3.

**Severidad.** `CRITICA`. Alguien paga de menos —una vez, para siempre— sobre una vertical entera
(**Partner**, la única donde el §17.2 admite el método), y el propio § nombra ese desenlace como
lo que vino a impedir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-013` (`MP5`), commit `1c17565e1`.**
Antes de `MP5` la máquina no tenía entrada y `F-8B2-018` lo decía; el arreglo le puso una entrada
**condicionada a un dato que ninguna transición mueve**, y declaró la premisa vieja falsa: *««la
máquina de pago manual no tiene entrada…» | **queda FALSA en sus dos mitades**»* (`B/03` §7.2,
tabla de premisas).

**¿Lo habría encontrado el grep?** **Sí, y es el más barato de los doce.** El término nuevo es
*«período actual»*, y el propio commit lo usa como condición. Un `rg "período actual"` sobre el
corpus entero devuelve **cinco** líneas, cuatro de ellas del archivo que el commit escribía, y la
quinta es la columna de `B/02` §2.2 — que el commit **también tocó**. La pregunta que faltaba no
es de búsqueda sino de lectura del resultado: *«de las cinco, ¿cuántas escriben?»*. Dos. *«¿Alguna
avanza?»* Ninguna.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Las cinco apariciones están en los
dos archivos que el commit editó, y cuatro de las cinco son prosa que escribió de cero. La
obligación 2, escrita para *«apariciones no corregidas en párrafos que el commit no tocó»*, tiene
cero sujetos acá. Lo que hacía falta es la obligación **4** —*«cada término que el núcleo define
lleva su lista de consumidores»*— aplicada a un término que **el núcleo no define**: *«período
actual»* no está en `NUCLEO/01`, así que no tiene lista y no hay nada que actualizar ni contra qué
contar.

---

## ALTA

### F-8eB1-003 — `B/14` §4.4 enumera DOS de los tres caminos por los que la predecesora se muere sola, y el que falta —el espejo— es el único que sale de `PAUSED`: la cortesía que firmó `SUPER_ADMIN` se re-apunta a una sucesora que ninguna transición puede pausar, y el cliente empieza a pagar

**Qué se rompe.** Un beneficiario de cortesía que está cambiando de plan, y al que el proveedor le
cancela el preapproval pausado, queda con la cortesía re-apuntada a una fila en
`PENDING_AUTHORIZATION`. Ninguna transición de la tabla lleva una fila de ese estado a `PAUSED`
—`S9` sale de `ACTIVE`—, así que la cortesía **no se ejecuta**: la sucesora autoriza, entra a
`ACTIVE` y cobra el precio entero por los días que `SUPER_ADMIN` había regalado. Y
`courtesy_grant.subscription_id` **no es anulable** (`B/02` §2.4), así que la fila queda apuntando
a una suscripción que cobra, que es exactamente la forma que §4.4 llama *«una fila de base que no
hace nada»*.

**El camino.**

1. **La predecesora puede estar `PAUSED` durante la ventana, y la propia tabla lo enumera.** Las
   siete transiciones que sacan a una predecesora de su estado durante la sucesión incluyen
   *«1 | `ACTIVE` | `S8` … | `PAUSED` | sí»* y *«2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga
   cortesía | `PAUSED` | sí»* (`B/03` §3.2).
2. **El segundo evento de `S18` son TRES caminos, y el tercero sale de `PAUSED`.** La celda de
   `S18` dice *«la predecesora dejó de ser fila viva sin `S17` — por `S12`, por `S16` **o por el
   espejo de la baja decidida por el proveedor (§10.1)**»* (`B/03` §3.2), y el `desde` del espejo
   es *«`cancelled` | **cualquier estado vivo que no sea `CANCEL_SCHEDULED`**»* (`B/03` §10.1).
   `PAUSED` es uno de los seis vivos (`B/02` §2.2).
3. **Y el proveedor sí deja cancelar una pausada**: *«está medido que **estando pausada el
   proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar**»* (`B/03` §3.3).
4. **`B/14` §4.4 enumera dos y concluye sobre dos.** *«El segundo camino de `S18` —la predecesora
   que se muere sola— sale de `S12` (`desde: CANCEL_SCHEDULED`) o de `S16` (`desde: ACTIVE`), y
   **una predecesora con cortesía vigente está `PAUSED`**, así que ninguna de las dos la alcanza
   (`B/03` §3.2). **No hay caso en que haya que pausar un preapproval que todavía no
   autorizó.**»* El espejo no está, y es el único de los tres cuyo `desde` incluye `PAUSED`.
5. **Sin esa conclusión, el efecto de `S18` no tiene cómo ejecutarse.** `S18` re-apunta la
   cortesía *«y la sucesora **queda pausada con motivo `COURTESY` por los días que quedaban**»*
   (`B/02` §2.6, `B/14` §4.4). Sobre una sucesora en `PENDING_AUTHORIZATION` eso pide una pausa
   que ninguna fila declara —`S9` es `ACTIVE → PAUSED`— y una llamada de pausa sobre un preapproval
   sin autorizar que **nadie midió**: la matriz del `B/20` §3.2 tiene `EX-11` para la pausada y
   `EX-39` para las fechas, y nada para pausar una `pending`.
6. **Y el guard del cierre se pone en rojo o se cumple mintiendo.** `G-R1-C` falla cuando un
   cierre deja *«la **cortesía vigente** sin re-apuntar»* (`B/20` §2): re-apuntarla sin pausar
   pasa el guard y no da cortesía; no re-apuntarla lo rompe. Las dos salidas son malas y el §
   que las tendría que dirimir declaró que el caso no existe.

**Dónde lo permite el diseño.**
`HOS-1354/docs/14-promos-cortesias-y-grants.md` §4.4;
`HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S8`, `S9`, `S18`, la tabla de las siete), §3.3 y
§10.1; `HOS-1354/docs/02-modelo-de-datos.md` §2.4 y §2.6;
`HOS-1354/docs/20-testing.md` §2 (`G-R1-C`).

**Severidad.** `ALTA`. El cliente paga lo que una cortesía firmada tenía que cubrir, y el
beneficio desaparece sin marca y sin aviso — el modo de falla que §4.4 describe entero para
rechazar la alternativa. No la subo a `CRITICA` porque el disparador —que el proveedor cancele un
preapproval pausado— **no está medido** en la matriz, así que la población es real pero no está
cuantificada.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 4 y 6** (`f4edbdfdf`, el cuarto efecto de `S18` y
su salida desde `PENDING_AUTHORIZATION`), **con el agravante de que el arreglo 8 lo tuvo abierto y
corrigió el gemelo**. `f4edbdfdf` escribió los dos párrafos de `B/14` —§2.2 punto final y §4.4—
con la misma enumeración de dos caminos. Después `4e383480d` **corrigió el de §2.2** —lo verifiqué
con `git show 4e383480d -- .../14-promos…`: `- … sola por «S12» o «S16»` / `+ … sola por «S12»,
por «S16» o por el espejo de la baja decidida por el proveedor`— y **dejó §4.4 como estaba, 130
líneas más abajo, en el mismo archivo**.

**¿Lo habría encontrado el grep?** **No el de `DEC-METH-009`, sí el de `DEC-METH-010`.** El
término es *«se murió sola»* / *«`S12` o `S16`»*, y `B/14` **es uno de los archivos que los dos
commits tocaron**, así que la búsqueda *«sobre los capítulos que el commit NO toca»* no lo cruza.
La regla nueva, cuyo alcance es **todo el corpus** y cuya unidad es el **párrafo**, sí: hay dos
párrafos con la misma frase en el mismo archivo y se corrigió uno.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el caso más limpio de los doce.**
La aparición de §4.4 **no se corrigió** y está **en un párrafo que `4e383480d` no tocó** —tocó el
de §2.2—, o sea que cae exactamente dentro de lo que la obligación 2 manda escribir: *«archivo, §
y por qué sigue siendo correcta»*. Escribirlo habría obligado a contestar *«¿por qué sigue siendo
correcto que sean dos acá si acabo de corregir a tres allá?»*, y no hay respuesta. **La enmienda
alcanzaba y no se ejecutó** — y el commit declara *«Seis premisas volvieron falsas»* sin ninguna
cifra de apariciones (§2.3 de las instrucciones).

---

### F-8eB1-004 — `S21` mata el cobro de un complemento en el acto con el período ya cobrado, declara que «si corresponde devolver, entra por la vía del reembolso» y no hay nada que enrute ese caso: es el mismo hueco que `DEC-RF-002` cerró para `S19`, reabierto por la puerta de al lado

**Qué se rompe.** A alguien le cancelan la suscripción principal por una baja que decidió el
proveedor —la salida esperada del camino de mora (`B/12` §1.4)—, su *«Boost 30 días»* queda
huérfano el día 3 del mes, `A5` lo apaga y `S21` cancela su suscripción de complemento **sin
reembolso y sin marca**. Los 27 días que pagó no se usan, no se devuelven y **nadie se entera de
que hay algo que mirar**.

**El camino.**

1. **`S21` corta el cobro en el acto y sin gracia.** *«**Sin período de gracia y sin fecha de fin
   de servicio** … **Sin reembolso del período ya cobrado**; si corresponde devolver, entra por la
   vía del reembolso, que **confirma una persona** (`DEC-RF-002`)»* (`B/03` §3.2, fila `S21`), y
   `B/16` §4.4 lo repite: *«Si en un caso concreto corresponde devolver, entra por esa vía **y la
   confirma una persona**»*.
2. **Nada pone a nadie adelante de ese caso.** `S21` no pone la marca —su celda de efectos no la
   nombra—, y `S14` tampoco corre: su evento es *«divergencia que toca plata o estado»*
   (`B/03` §3.2) y esto no es una divergencia sino un desenlace diseñado. Lo conté sobre `B/09`
   §3: las **cuatro** salvedades devuelven la fila al barrido, y las **tres** que podrían
   enrutarla son la marca (que no está), el pago pendiente por `S19` (que `S20` declara población
   vacía para un complemento, y `S21` hereda) y la relectura del preapproval — ninguna mira
   *«período cobrado y no entregado»*.
3. **Y el corpus tiene la regla escrita, en el capítulo que gobierna las acciones.** *«una acción
   con permiso, auditoría y confirmación declarados **no sirve de nada si nadie enruta el caso**»*
   (`NUCLEO/08` §3). Ese § construye el enrutado para el reembolso de `S19` —`S18` pone la marca,
   el barrido la escala— y cierra: *«Sin las dos mitades de arriba, esas dos filas describen un
   trámite que nadie empieza»*. Para `S21` las dos mitades no existen.
4. **El criterio del owner apunta al revés.** El criterio de las cinco decisiones de producto es
   *si la pérdida la causa un acto deliberado NUESTRO y la persona no puso plata nueva → se
   declara y no se repara; **si la persona PUSO PLATA → se le da salida***. Acá la persona puso
   plata —pagó el período del addon— y la pérdida **no la causó un acto deliberado nuestro**: la
   causó la baja que decidió el proveedor. No hay salida.
5. **Y donde sí hay aviso, es por otra puerta.** `B/19` §4 fila 3 obliga a decir *«qué addons se
   pierden y por cuánto»* **al borrar una ficha** —o sea para `A6`, donde el acto es del cliente—.
   Para la orfandad no hay fila: la 10 (*aviso de suspensión*) nombra *«los **días de addon** que
   se le van a ir»* y la suspensión **no deja huérfano a nada** (`B/16` §4.2). La población de
   `S21` que duele es justo la que ningún aviso cubre.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S21`, `S14`) y §8
(`A5`, `A6`); `HOS-1354/docs/16-addons.md` §4.4; `HOS-1354/docs/09-conciliacion.md` §3 (las cuatro
salvedades y las cuatro comprobaciones); `HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md`
§3; `HOS-1354/docs/19-superficies.md` §4, filas 3 y 10.

**Severidad.** `ALTA`. Es plata del cliente por un servicio que no recibió, sin devolución y sin
nadie que la mire. No la subo a `CRITICA` porque el corpus ya decidió, tres veces con el mismo
criterio (`DEC-GRANT-001` para `S13`, `B/16` §3.4 para `S20`, `B/16` §4.4 para `S21`), que **el
período ya cobrado no se devuelve** — lo que falta no es la decisión sino el enrutado de su propia
excepción declarada.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-ADDON-004` (`S21`), commit `456563988`.**
Antes de `S21` la suscripción de complemento no tenía estado declarado y el hueco era *«en qué
estado queda»*; el arreglo lo cerró y creó, con la misma fila, la frase *«si corresponde devolver,
entra por la vía del reembolso»* sin quién la dispare.

**¿Lo habría encontrado el grep?** **Sí.** El término es *«entra por la vía del reembolso»* /
*«lo confirma una persona»* / `DEC-RF-002`. `456563988` tocó diez archivos y **no tocó
`NUCLEO/08`**, que es donde vive la regla que esto viola —*«no sirve de nada si nadie enruta el
caso»*— y la tabla de dos filas que enruta el caso gemelo. Un `rg "DEC-RF-002"` sobre los
capítulos intactos la pone en la primera pantalla.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** La aparición vive en `NUCLEO/08` §3,
**no se corrigió** y está **en un párrafo que ese commit no tocó** (no tocó el archivo). Cae
entero dentro de la obligación 2, y escribir *«sigue siendo correcta»* sobre ella exigía contestar
por qué el enrutado que ese § declara imprescindible para `S19` no hace falta para `S21`.

---

### F-8eB1-005 — Ninguna transición lleva a un pagador manual a `ACTIVE`, y `MP5` sólo corre ahí: el §7 entero —`MP1`, `MP2`, `MP3`, `MP4` y `MP5`— tiene población vacía, y `F-8B2-018` se declara cerrado «en sus dos mitades» una capa más arriba de donde estaba el agujero

**Qué se rompe.** El Partner al que el §17.2 le admite pago manual no puede llegar nunca a tener
una suscripción vigente: nace en `PENDING_AUTHORIZATION`, el único camino a `ACTIVE` es un webhook
del proveedor que en su método **no existe**, y a las 72 h `S3` lo manda a `ABANDONED`. Todo el §7
—incluida la decisión `DEC-SUB-012` de esta tanda— describe un trámite sobre filas que no pueden
existir.

**El camino.**

1. **`MP5` corre sobre un solo estado.** *«**Sólo corre con la suscripción en `ACTIVE`** —los
   otros cinco estados vivos están descartados uno por uno en el §7.2»* (`B/03` §3.2, fila `MP5`).
2. **Y el único camino a `ACTIVE` desde el estado inicial es `S2`, cuyo evento es del proveedor.**
   *«S2 | `PENDING_AUTHORIZATION` | **webhook de autorizada, confirmado por relectura** |
   `ACTIVE`»* (`B/03` §3.2). Lo verifiqué contra la tabla entera de las veintiún filas: las otras
   que llegan a `ACTIVE` son `S5` (desde `GRACE_PERIOD`), `S7` (desde `SUSPENDED`) y `S10` (desde
   `PAUSED`) — las tres presuponen que la fila **ya estuvo** `ACTIVE`.
3. **El pagador manual no tiene nada en el proveedor, y el propio capítulo lo declara dos
   veces.** *«El pagador manual **no tiene débito en el proveedor** (`B/06` §7), así que `PA-5` no
   tiene sujeto: **no hay preapproval cancelado que reactivar**»* y *«**no hay preapproval que el
   proveedor dé de baja por mora** … y el espejo del §10.1 nunca la alcanza»* (`B/03` §7.1). Sin
   preapproval no hay webhook de autorización, así que el evento de `S2` no ocurre.
4. **Y el §7.2 apoya su propia tabla en ese `S2`.** La fila `PENDING_AUTHORIZATION` dice
   *«**todavía no hay período**: el período lo arranca `S2` (§3.2) … La primera cuota es la del
   primer período, y ése empieza cuando la fila llega a `ACTIVE`»*. El descarte es correcto y
   convierte el hueco en total: la fila **nunca** llega a `ACTIVE`.
5. **El catálogo de acciones no tiene sustituto.** Sus doce filas incluyen *«configurar el **plan y
   el método de pago** de un Partner»* (`NUCLEO/08` §3), que no es una transición de la tabla del
   §3.2 y no mueve la columna de estado — y *«lo que no se puede es ejecutar una escritura que no
   esté nombrada en ninguna fila»*.
6. **Y la tanda declara el hueco cerrado.** *««la máquina de pago manual no tiene entrada, y su
   grace no tiene quién lo abra» (`F-8B2-018`) | la FASE 8 adversarial | **queda FALSA en sus dos
   mitades**: la entrada es `MP5` y el grace entra por `S4`»* (`B/03` §7.2, tabla de premisas).
   La entrada de la máquina de **pago manual** quedó declarada; la de la **suscripción** del
   pagador manual, que es su precondición, no.

**Dónde lo permite el diseño.** `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (`S1`, `S2`, `S3`,
`MP5`), §7.1 y §7.2; `HOS-1354/docs/06-proveedor.md` §7;
`HOS-1352/docs/nucleo/08-auditoria-y-observabilidad.md` §3.

**Severidad.** `ALTA`. No mueve plata por sí solo —nadie cobra y nadie recibe—, pero vacía la
población de las cinco filas del §7 y de una decisión del owner de esta misma tanda
(`DEC-SUB-012`), y hace inejecutable la única vertical donde el método está admitido.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y hay que decir cuál.** El hueco de fondo —cómo
nace la suscripción de un pagador manual— es anterior a la tanda y nunca estuvo escrito. Lo que
**sí** es el arreglo (`DEC-SUB-013`, `1c17565e1`) es (a) atar `MP5` a un estado inalcanzable para
su propia población y (b) **declarar `F-8B2-018` falso «en sus dos mitades»**, que es lo que hace
que nadie vuelva a mirar.

**¿Lo habría encontrado el grep?** **No.** El término nuevo es *«sólo `ACTIVE`»* / *«los otros
cinco estados vivos»*, y las dos apariciones están en `B/03`, que el commit escribió. El término
viejo —`F-8B2-018`— aparece en `B/03` §7.2 y en los informes de fase, ninguno en un capítulo
intacto.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** La aparición donde vive el defecto es
la fila `PENDING_AUTHORIZATION` de una tabla que el commit escribió de cero, y su celda razona
correctamente hacia adelante (*«el período lo arranca `S2`»*) sin preguntar si `S2` es alcanzable.
La obligación 2 no tiene sujeto y la obligación 3 —grepear el término viejo— devuelve sólo texto
propio. **Lo que hacía falta es una pregunta de método, no de búsqueda**: *«el estado que acabo de
poner como condición, ¿lo produce alguna transición para este sujeto?»*.

---

### F-8eB1-006 — `NUCLEO` · `MP4` escribe un predicado del grupo B sobre `sucede_a` y no figura en el inventario de `NUCLEO/01` §2.4: es la mitad de `G-R1-E` que el propio núcleo declara insustituible por grep, y el commit que creó el consumidor no tocó el archivo

**Qué se rompe.** El control que la 9-bis-3 construyó para que un predicado nuevo sobre `sucede_a`
no se escriba sin el adjetivo *«viva»* tiene, desde esta tanda, **un consumidor que no está en la
lista**. Y el núcleo declara por escrito que esa lista es lo único que lo detecta.

**El camino.**

1. **`MP4` escribe el predicado.** *«la suscripción sale de `SUSPENDED` por `S7` — **o queda
   pendiente por `S19`, si es la predecesora de una sucesión en curso**»* (`B/03` §3.2, fila
   `MP4`). *«La predecesora de una sucesión en curso»* es el término del grupo B, el mismo que el
   inventario lista para `S17`, `S19`, `G-R1-D` y la regla de `B/12` §5.3.
2. **El inventario no lo tiene.** Lo conté sobre el texto vigente: `NUCLEO/01` §2.4 tiene **20
   filas** —10 en el grupo A (1-6, 17-20) y 10 en el grupo B (7-16)—, y **ninguna es `MP4`**. La
   fila 8 es *«la condición de `S19`»*; la 13, *«el sujeto de la regla de `B/12` §5.3»*.
3. **Y la regla que lo obliga está escrita en ese mismo §, en imperativo.** *«**quien escribe un
   consumidor nuevo agrega su fila al inventario de arriba en el mismo acto, antes de declarar el
   cambio aplicado**. Lo vigila `G-R1-E` (`B/20` §2), en sus dos mitades»* (`NUCLEO/01` §2.4,
   regla 3).
4. **La otra mitad del mismo consumidor SÍ se actualizó, lo que prueba que se miró una y no la
   otra.** `G-R1-D` pasó de tres call sites a cuatro para nombrar a `MP4` —*«`S5`, `S7`, el efecto
   de `MP1` y el de `MP4`»*— y `B/20` §2 lo argumenta: *«lo que necesita es **figurar**, porque un
   guard escrito sobre tres caminos no mira el cuarto»*. El inventario del núcleo, que es la
   **segunda** mitad de `G-R1-E`, no ganó su fila.
5. **Y el núcleo dice por qué eso importa más que cualquier búsqueda.** *«un predicado nuevo **no
   aparece** buscando el término viejo, así que lo único que lo detecta es que la lista de
   consumidores tenga una fila menos que los consumidores»* (`NUCLEO/01` §2.4, cierre del grupo B,
   y `B/20` §2 lo repite: *«es la parte que ningún grep sustituye»*).

**Dónde lo permite el diseño.** `HOS-1352/docs/nucleo/01-glosario.md` §2.4 (el inventario y su
regla 3); `HOS-1354/docs/03-maquinas-de-estado.md` §3.2 (fila `MP4`) y §7.1;
`HOS-1354/docs/20-testing.md` §2 (`G-R1-D`, `G-R1-E`).

**Severidad.** `ALTA` como registro, con el mismo criterio con que la 8-bis-3 calificó el caso
gemelo (*«`NUCLEO/01` §2.4 dice «los cinco predicados» y hoy son seis»*): no hay daño hoy —`MP4`
delega en `S19`, que sí lleva el adjetivo—, pero es **la lista que hace ejecutable a `G-R1-E`** y
quedó corta en el mismo acto que creó su consumidor, que es literalmente el defecto que `G-R1-E`
existe para impedir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-012` (`MP4`), commit `71615bb41`.**

**¿Lo habría encontrado el grep?** **No, y el propio núcleo explica por qué**: `MP4` no usa el
término *«fila viva»* ni la palabra *«viva»*, usa la frase *«la predecesora de una sucesión en
curso»*. Es exactamente la **paráfrasis** que la regla 3 de `NUCLEO/01` §2.4 nombra como el caso
que ninguna búsqueda devuelve.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y ésta es la evidencia de que la
obligación 2 y la 4 no son intercambiables.** La obligación 2 recorre **apariciones de un término
que ya existe**; acá el defecto es una **ausencia** —una fila que no está— y no hay ninguna
aparición que recorrer. Lo que alcanzaba es la obligación **4**, la condicional, y no se ejecutó:
`71615bb41` tocó siete archivos y **`nucleo/01` no es ninguno** (medido contra la tabla del §2.3
de las instrucciones), mientras que los dos commits vecinos que sí crearon consumidores nuevos
—`6bac7e63a` con `S20` y `456563988` con `S21`— **sí** tocaron `nucleo/01` y agregaron sus filas
19 y 20.

---

## MEDIA

### F-8eB1-007 — El pagador manual tiene DOS puertas de reactivación desde `SUSPENDED` y sólo una re-ancla el período: la otra —`MP4` → `S19` → `S3` → `S7`— no tiene regla, y las dos terminan en la misma transición

**Qué se rompe.** Nada, en un solo sentido: falla hacia dos comportamientos distintos sin que nada
diga cuál vale, y el que la prosa deja sin regla es **el correcto** (ver `F-8eB1-001`), así que un
implementador que unifique va a elegir el que cobra dos veces.

**El camino.**

1. **El re-anclaje se declara específico de la puerta y no de la transición.** *«**Es específico
   de esta puerta y no se escribe en `S7`**»* (`B/03` §7.2).
2. **Y hay una segunda puerta que llega a `S7` sin pasar por el efecto de `MP4`.** Si la fila es
   la predecesora de una sucesión en curso, *«`MP4` hereda esa condición igual que `MP1`»* y el
   pago **no reactiva**: queda pendiente por `S19` (`B/03` §3.2 y §7.1). La reactivación la
   dispara después **`S3`**, que *«reevalúa el pago pendiente en el acto»* (`B/03` §3.2), y el
   destino es *«`S5` o `S7`, según el estado»* (`B/12` §5.3, rama 2).
3. **La población es alcanzable y el propio corpus la construyó.** `G-R1-A` sólo deja declarar una
   sucesión desde `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED` (`B/20` §2), y la fila 3 de las
   siete —`S6`, el reloj del grace— la lleva a `SUSPENDED` dentro de la ventana (`B/03` §3.2).
   Ahí `MP3` ya cerró el `manual_payment` en `DECLARED_UNPAID` y `MP4` es su puerta.
4. **En esa rama la reactivación no la ejecuta `MP4`**, así que la regla del §7.2 —enunciada sobre
   *«`MP4` lleva la fila a `ACTIVE` por `S7`»*— **no tiene sujeto**, y por la regla 1 del núcleo
   el período no se re-ancla.

**Severidad.** `MEDIA`. No hay daño en esta rama —justamente porque no re-ancla—, pero deja dos
respuestas para la misma pregunta sobre la misma transición, y la que está escrita es la que
`F-8eB1-001` muestra incorrecta.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-013` (`MP5`), `1c17565e1`**, que escribió
el re-anclaje atándolo a `MP4` mientras `DEC-SUB-012` (`71615bb41`, el commit anterior) ya había
declarado que `MP4` **no siempre** reactiva.

**¿Lo habría encontrado el grep?** **Sí.** El término es `MP4`, y `1c17565e1` **no tocó `B/12`**
(medido contra la tabla del §2.3), que es donde vive la rama 2 y su *«`S5` o `S7`, según el
estado»*. Un `rg 'MP4'` sobre los capítulos intactos devuelve `B/12` §5.3 en la primera pantalla.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** La aparición de `MP4` en `B/12` §5.3
no se corrigió y está en un párrafo que `1c17565e1` no tocó: cae dentro de la obligación 2, y
escribir *«sigue siendo correcta»* sobre ella exigía cruzar *«`MP4` reactiva»* con *«`MP4` no
reactiva si hay sucesión»*.

---

### F-8eB1-008 — `S20` y `S21` multiplicaron las cancelaciones que dispara un solo acto y los seis cruces del `B/05` no se recorrieron: `C3` habla de «la suscripción» en singular y el cobro que entra después de un `S21` no tiene ningún cruce

**Qué se rompe.** Un cobro en vuelo que se acredita después de que `S20` o `S21` cancelaron una
suscripción de complemento no cae en ninguno de los seis cruces, así que no hay quién declare que
se pone la marca — y el retraso del cobro está medido *«entre 26 y 44 minutos»* (`PA-3`), o sea
que la ventana no es un borde.

**El camino.**

1. **`C3` se escribió para `S13` y habla en singular.** *«si un cobro se acredita **después** de
   que el grant canceló **la suscripción**, no debería poder ocurrir por `GT-1` — y si ocurre
   igual, **se pone la marca**»* (`B/05` §2, `C3`).
2. **Desde `S20` el mismo acto cancela 1 + N.** *«con `includesAddons: true` son varios cobros,
   enumerados uno por uno … **el cliente recibe un correo del proveedor por cada preapproval**
   (`EX-3`)»* (`B/19` §4, fila 13-bis).
3. **Y `S21` no tiene ningún cruce.** Su disparador no es ni una cancelación que pide el cliente
   (`C2`: *«Se pide la cancelación mientras entra un cobro»*) ni un grant (`C3`): es que su
   instancia llegó a `CANCELLED` por `A5` o `A6` (`B/03` §3.2). Los seis cruces del §52 siguen
   siendo seis y ninguno lo nombra.
4. **`B/05` no se abrió en ninguno de los dos commits.** Medido contra la tabla del §2.3 de las
   instrucciones: `6bac7e63a` (`DEC-ADDON-003`, `S20`) tocó 12 archivos y `456563988`
   (`DEC-ADDON-004`, `S21`) tocó 10, y **`B/05` no está en ninguna de las dos listas**.

**Severidad.** `MEDIA`. `C3` se puede leer como que cubre el caso de `S20` por extensión, y el
desenlace declarado —la marca— es el mismo; lo que falta es que esté escrito, y para `S21` no hay
ni siquiera la extensión.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-ADDON-003` y `DEC-ADDON-004`.**

**¿Lo habría encontrado el grep?** **Sí.** El término es *«grant»* / *«cancela el preapproval»*, y
`B/05` es un capítulo **intacto** por los dos commits. Un `rg 'grant'`sobre él devuelve `C3` en
la primera línea.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí.** La aparición vive en un archivo que
ninguno de los dos commits tocó, no se corrigió, y cae entera dentro de la obligación 2. Ninguno
de los dos commits reportó cifra de apariciones (§2.3).

---

### F-8eB1-009 — El tope de la reapertura de `MP4` se apoya en «cuando una persona cancela la suscripción», y `S11` sale de `ACTIVE`: una `SUSPENDED` de pagador manual no tiene ninguna transición a `CANCELLED` salvo un grant, así que el tope que el § declara «con actos que ya existen» tiene un solo acto y es un regalo

**Qué se rompe.** El §7.1 sustituye un plazo por una condición y enumera los actos que la hacen
cumplir. Para su propia población, uno de los dos actos **no se puede ejecutar**, así que la
ventana de reapertura no tiene más tope que un *Free Forever*.

**El camino.**

1. **El tope enumerado son dos actos.** *«Eso cierra la ventana **con actos que ya existen**, no
   con un plazo: **cuando una persona cancela la suscripción** (§3.1 enumera esa salida, y es una
   de las doce acciones del `NUCLEO/08` §3) **o cuando le cae un grant** (`S13`), la fila pasa a
   `CANCELLED`»* (`B/03` §7.1).
2. **La transición que ejecuta el primero sale de `ACTIVE`.** *«S11 | `ACTIVE` | pide la baja |
   `CANCEL_SCHEDULED`»* (`B/03` §3.2). La población del tope está en `SUSPENDED`.
3. **Y desde `SUSPENDED` no hay otra puerta para este método.** Recorrí las veintiún filas del
   §3.2: las que llegan a `CANCELLED` desde un estado vivo son `S12` (desde `CANCEL_SCHEDULED`),
   `S13`, `S17` (pide una sucesora viva), `S20`/`S21` (de complemento) y el espejo del §10.1 — y el
   espejo **no alcanza a un pagador manual**, porque *«no hay preapproval que el proveedor dé de
   baja por mora … y el espejo del §10.1 nunca la alcanza»* (`B/03` §7.1, dos párrafos más abajo
   del tope).
4. **El § nombra la consecuencia y le atribuye la causa equivocada.** *«una `SUSPENDED` de pagador
   manual **que nadie cancela** se puede reabrir indefinidamente»*. No es que nadie la cancele: es
   que **nadie puede**.

**Severidad.** `MEDIA`. El § ya acepta la ventana indefinida y acota los dos daños de plata con
las condiciones 3 y 4 del `B/05` §3. Lo que queda mal es que el tope se presenta como accionable
y no lo es, que es lo que hace que nadie vuelva a mirarlo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-SUB-012` (`MP4`), commit `71615bb41`**, que
escribió el tope entero.

**¿Lo habría encontrado el grep?** **No.** El término es *«cancela la suscripción»* / `S11`, y los
dos lados —el tope y la fila `S11`— están **en `B/03`**, que el commit escribió. Es la misma forma
que la 8-bis-3 midió cuatro veces: el defecto está adentro del capítulo que el commit tocó.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** El tope es prosa nueva y `S11` no es
una aparición del término que el arreglo redefine: es una fila de tabla que nadie tocó ni tenía
por qué tocar. Lo que hacía falta es la misma pregunta de método de `F-8eB1-005`: *«el acto que
estoy nombrando como tope, ¿lo puede ejecutar la fila sobre la que lo estoy escribiendo?»*.

---

### F-8eB1-010 — `NUCLEO` · `D16` y `G-R5` comparan el tope de pausa del CATÁLOGO contra el hard delete, y el único instrumento que puede pausar más allá de los 180 días es la cortesía, que no tiene tope y suma días sobre sí misma

**Qué se rompe.** `SUPER_ADMIN` otorga una cortesía larga —o dos encima—, la fila queda `PAUSED`
más de 180 días, el reloj de inactividad no se detiene, y el hard delete se lleva el contenido de
un cliente al que le estábamos regalando el servicio. El invariante que existe para impedir
exactamente eso no mira ese camino.

**El camino.**

1. **El invariante se enuncia sobre el tope del catálogo.** *«**El tope de una pausa, en días, es
   menor que el día del hard delete.** Hoy son **4 pausas-mes** —unos 120 días, cap. 03 §5— contra
   **180**»* (`NUCLEO/04`, `D16`), y el guard hace lo mismo: *«el **tope de una pausa** que declara
   el catálogo —cap. 03 §5 de **esta** épica—, pasado a días, **alcanza el día del hard delete**»*
   (`B/20` §2, `G-R5`).
2. **Ese tope es el de la pausa del cliente, y la cortesía no pasa por él.** Los límites de `B/03`
   §5 son *«los del §26.3, reexpresados en meses»* y `S8` los hace cumplir vía `puedePausar()`.
   **`S9` no pasa por `puedePausar()`**: su condición es *«no hay pausa vigente
   (`DEC-GRANT-004`)»* (`B/03` §3.2), y el propio §7.2 lo subraya —*«`S9` no pasa por
   `puedePausar()`»*—.
3. **Y la cortesía no tiene tope y se acumula.** *«cortesía sobre cortesía → **se suman los días**
   y el aviso dice la fecha de fin nueva»* (`B/03` §5). Recorrí `B/14` §4 entero y `B/02` §2.4: la
   fila `courtesy_grant` guarda *«días o meses»* sin ninguna restricción de máximo.
4. **Y el reloj sigue corriendo.** *«el reloj de inactividad **no se detiene** durante la pausa:
   se reinicia recién al reanudar»* (`NUCLEO/04`, `D16`). Que `PAUSED` por `COURTESY` **sí** emita
   fuente (`12-contrato…` §2.6) no lo detiene: el reloj lo mueven los cuatro hechos de reinicio de
   `NUCLEO/01` §1.2, y ninguno es *«estar cubierto»*.

**Severidad.** `MEDIA`. Es pérdida de datos sin vuelta sobre una población chica y con un actor
humano adelante —`SUPER_ADMIN` elige los días—, pero el invariante se declara *«lo único que
impide que una pausa del catálogo llegue a borrar contenido»* y el instrumento que más fácil lo
supera es el que no mira.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-DATA-002`**, la decisión que creó `D16` y
`G-R5` (commit `621332e7c`). El invariante nació acotado al catálogo.

**¿Lo habría encontrado el grep?** **Sí.** El término nuevo es *«tope de una pausa»* / `D16`; el
viejo es *«pausas-mes»*. `621332e7c` tocó 18 archivos y **no tocó `B/03` §5 de billing en su mitad
de pausa** —tocó `B/03`, `B/10`, `B/19` y `B/20` de esta épica—, pero sobre todo **no tocó
`B/14`**, donde vive la cortesía y su acumulación. Un `rg 'cortesía'` cruzado con *«pausa»* sobre
los capítulos intactos devuelve `B/14` §4.2 y §4.4.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, por la obligación 3.** El término viejo
que se retira es *«que el reloj fuera monótono»*, y recorrer sus apariciones lleva a preguntar
**quién más pausa**. La respuesta —`S9`— está en la misma tabla del §3.2 que el commit tocó, y en
`B/14`, que no tocó: la aparición de `B/14` §4.2 (*«mientras corre la cortesía no se cobra nada»*)
cae dentro de la obligación 2.

---

### F-8eB1-011 — `B/09` §3 dice «la rama que mueve dinero, y la única de las cuatro que lo hace»: hoy son cinco y mueven dinero dos, y la aparición estaba en el CONTEXTO del diff que corrigió la línea siguiente

**Qué se rompe.** Quien lea el backstop del capítulo 09 para saber qué hacer con un pago retenido
va a buscar **una** rama que devuelva plata y va a encontrarse con dos, y la que el párrafo
describe —*«la deja en `CANCELLED` por `S17`»*— es la que **no** corresponde en la rama 5, donde a
la predecesora la mata el espejo.

**El camino.**

1. **El párrafo, textual:** *«*«La sucesión se cerró»*la deja en `CANCELLED` por `S17` —
   **terminal**, y sin la salvedad 3 esta mitad de la comprobación era inalcanzable por
   construcción … **Es la rama que mueve dinero, y la única de las cuatro que lo hace.**»*
   (`B/09` §3).
2. **Hoy son cinco y mueven dinero dos.** *«Las cinco ramas valen para las dos puertas, y **las
   dos que devuelven plata** ya tienen dónde asentarla. *«El pago»* de la **rama 1** y de la
   **rama 5** es el que `S19` retuvo»* (`B/12` §5.3).
3. **Y en la rama 5 no la mata `S17`.** *«**`S18` cierra la sucesión sin `S17`** (la predecesora ya
   no es fila viva)»* (`B/12` §5.3, rama 5).
4. **La aparición estaba literalmente en pantalla cuando se corrigió la línea de abajo.** Lo medí
   con `git show 4e383480d -- .../09-conciliacion.md`: el hunk que cambia *«los **tres** actos»* →
   *«los **cuatro** actos»* lleva como **líneas de contexto inmediatamente anteriores** *«Es la
   rama que mueve dinero, y la única de las / cuatro que lo hace.»*.

**Severidad.** `MEDIA`. No cambia el desenlace —la salvedad 3 y la comprobación siguen alcanzando
las dos ramas—, pero es un conteo congelado sobre la única parte del capítulo 09 que decide qué se
hace con plata retenida.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: 8/`F-8dB1-004`** (la quinta rama, commit
`4e383480d`), sobre una frase que había escrito el arreglo anterior (`f4edbdfdf`).

**¿Lo habría encontrado el grep?** **No.** El término es *«las cuatro ramas»* / *«la rama que
mueve dinero»*, y `B/09` **es uno de los trece archivos que `4e383480d` tocó**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el dato metodológico más útil de
esta pasada.** La obligación 2 se acota, textual, a las apariciones *«que no se corrigen y están
en un párrafo que el commit no tocó»*. Acá el párrafo **sí** se tocó —la línea siguiente cambió en
el mismo hunk—, así que la aparición cae **justo afuera** del rastro que la enmienda manda
escribir. **La obligación 1 dice lo contrario** —*«el alcance es todo el corpus … incluidos los
archivos que el commit toca, porque un archivo abierto no es un párrafo leído»*— y la 2 la
contradice al acotarse: entre las dos queda un hueco, y es exactamente donde vive este defecto.
No es *«la enmienda no se ejecutó»* ni *«la enmienda no sirve»*: es **la enmienda excluye este
caso por escrito**.

---

### F-8bB1-009 (sigue llegando) — `G-R1-D` sigue enunciado como una propiedad de una ejecución en una capa que declara que los guards son propiedades del árbol de fuentes, y la lista pasó de nueve filas a once

**Dónde llega hoy.** El defecto de capa **está intacto** y la tanda le agregó un call site sin
tocar el enunciado. `B/20` §1 sigue definiendo la capa como *«**guards** | propiedades del
**código**, no de una ejecución | **el árbol de fuentes, en CI**»*, y `G-R1-D` sigue diciendo
*«un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o **el de `MP4`**— **que en ese
instante** es la predecesora de una sucesión en curso … o **reembolsa** el pago que quedó
pendiente por `S19` **antes** de que la sucesión se resuelva»* (`B/20` §2). *«En ese instante»* y
*«antes de que la sucesión se resuelva»* siguen siendo propiedades de una corrida, mientras la
forma de romperlo —*«Se rompe a propósito sacándole la condición a una sola de las cuatro»*— sí es
del árbol. El enunciado y el modo de rotura siguen describiendo dos guards distintos.

**Lo que sí se cerró, y hay que acreditarlo.** El agravante que la 8-bis-3 le sumó por la vía de
`F-8dB1-001` —*«`G-R1-D` prohíbe el remedio que `B/09` §3 manda ejecutar»*— **está resuelto**: el
predicado ahora pide *«una sucesora **viva** con `sucede_a` apuntándola»*, así que reactivar
después de que la sucesora murió ya no lo dispara. Ése era el medio crítico del hallazgo y se fue.

**El conteo, recontado por mí sobre la tabla vigente.** La lista tiene **once** filas —`G7`, `G9`,
`G10`, `G11`, `G-R1-A` a `G-R1-E`, `G-R4` y `G-R5`—, no las nueve que conté en la 8-bis-3, y
siguen siendo **tres** las que enuncian propiedades de una ejecución: `G11`, `G-R1-B` y `G-R1-D`.
`G-R1-E` entra bien —su predicado es sobre el texto de los predicados y sobre una lista—, y
`G-R5` también: compara dos cifras del catálogo.

**Severidad.** `MEDIA` como defecto de capa, sin el agravante que lo subía. Es el andamiaje, no el
daño.

**¿Es nuevo, o es el arreglo?** **Sigue llegando desde la 8-bis** (`F-8bB1-009`), y **el arreglo
de `DEC-SUB-012` le sumó el cuarto call site sin revisar el enunciado**: `B/20` §2 argumenta con
cuidado por qué `MP4` *«tiene que figurar»* y no se pregunta si la frase en la que lo hace figurar
es verificable en CI.

---

## `NUCLEO` — resumen de lo que encontré en `docs/nucleo/` y no resuelvo acá

1. **`F-8eB1-006`** — `MP4` no figura en el inventario de `NUCLEO/01` §2.4 (20 filas contadas por
   mí). `ALTA` como registro.
2. **`F-8eB1-010`** — `D16` (`NUCLEO/04`) y su guard sólo miran el tope de pausa del catálogo, no
   la cortesía. `MEDIA`.
3. **`F-8eB1-004`** apoya su tesis en `NUCLEO/08` §3 —*«no sirve de nada si nadie enruta el
   caso»*—, que está bien escrito; lo que falta es su aplicación a `S21`. No es defecto del
   núcleo.
4. **Lo que se cerró de mi lista anterior**: `D15` está corregido *«hacia abajo»* y hoy nombra los
   dos rastros y las cinco ramas; `NUCLEO/01` §2.4 pasó de *«los cinco predicados»* a un
   inventario de 20 filas con `G-R1-E` vigilándolo; `NUCLEO/07` §6 y `B/19` §4 fila 15 ya dicen
   *«la devolución no es instantánea»* y nombran las dos puertas. **Los tres `NUCLEO` de la
   8-bis-3 están cerrados.**

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta pasada** movió:

1. **Cómo se le cobra a un pagador manual, si es que se le cobra.** `F-8eB1-002` y `F-8eB1-005`
   dejan el §7 apoyado en dos cosas que el capítulo 13 tendría que aportar: **qué acto lleva a
   `ACTIVE` una suscripción sin preapproval**, y **qué avanza su «período actual»**. Si el 13
   resuelve el alta del pagador manual como *«una suscripción sin recurso en el proveedor»*, los
   dos huecos se cierran ahí; si la resuelve creando igual un preapproval, entonces `B/03` §7.1 y
   `B/06` §7 —*«no hay débito en el proveedor»*— hay que reescribirlos, y con ellos la mitad de
   `DEC-SUB-012`.
2. **Cómo se asienta y se ejecuta el reembolso de un `manual_payment`.** `B/02` §2.3 ya admite que
   `refund` cuelgue de los dos, así que el residuo de `F-8dB1-005` se movió: lo que falta es **con
   qué se devuelve** una transferencia —no hay hecho en el proveedor al que mandarle un refund— y
   cómo un reintento manual no devuelve dos veces sin la columna del id del refund que
   `DEC-RF-002` declaró innecesaria.
3. **El reembolso que `S21` declara posible** (`F-8eB1-004`): sin marca, sin reloj y sin nadie que
   enrute el caso.

---

## Cómo dio la medición que esta pasada existe para producir

| | 8-bis | 8-bis-2 | 8-bis-3 | **8-bis-4 (`B1`)** |
|---|---|---|---|---|
| hallazgos | 14 | 12 | 9 | **12** — 11 nuevos + 1 que sigue llegando |
| `CRITICA` · `ALTA` · `MEDIA` · `BAJA` | 7 · 5 · 2 · 0 | 5 · 5 · 2 · 0 | 3 · 4 · 2 · 0 | **2 · 4 · 6 · 0** |
| **`CRITICA` atribuidos a la tanda anterior** | 6 de 7 | 5 de 5 | 3 de 3 | **2 de 2** |
| **`CRITICA` que el grep habría encontrado** | — | — | 2 de 3 | **1 de 2** |
| **`CRITICA` que la resolución por aparición habría atrapado** | — | — | — | **0 de 2** |

Los conteos de las tres primeras columnas salen de las tablas finales de mis informes anteriores;
los de la cuarta los conté sobre este archivo.

### El veredicto sobre `DEC-METH-010`, desde mi vector

**La enmienda funcionó donde su premisa se cumple, y hay que decirlo primero.** De los doce, **la
resolución por aparición habría atrapado cuatro** —`F-8eB1-003`, `F-8eB1-004`, `F-8eB1-007` y
`F-8eB1-008`—, y el primero es el más limpio que vi en cuatro pasadas: **dos párrafos con la misma
frase, en el mismo archivo, y el commit corrigió uno**. Cuatro de doce es real para una regla que
cuesta leer lo que ya se abrió.

**Y falló en los dos `CRITICA`, por una razón que no es la de las vueltas anteriores.** La tabla,
con la forma que las instrucciones piden:

| # | hallazgo | ¿el commit tocó el capítulo del defecto? | ¿lo encontraba el grep? | ¿la resolución por aparición? |
|---|---|---|---|---|
| 001 | el re-anclaje incondicional | **sí**, lo escribió | no | **no** — prosa nueva, sin aparición previa |
| 002 | *«período actual»* sin escritura que lo avance | **sí**, lo escribió | **sí** | **no** — ídem |
| 003 | la cortesía y el tercer camino | sí (los dos) | no (el viejo), **sí** (el nuevo, corpus entero) | **sí** |
| 004 | el reembolso de `S21` sin enrutado | no (`NUCLEO/08` intacto) | **sí** | **sí** |
| 005 | el pagador manual sin camino a `ACTIVE` | **sí**, lo escribió | no | **no** |
| 006 | `MP4` fuera del inventario | no (`nucleo/01` intacto) | **no** (es una ausencia) | **no** — es la obligación **4**, no la 2 |
| 007 | dos puertas, un re-anclaje | no (`B/12` intacto) | **sí** | **sí** |
| 008 | los seis cruces sin recorrer | no (`B/05` intacto) | **sí** | **sí** |
| 009 | el tope que nadie puede ejecutar | **sí** (los dos lados en `B/03`) | no | **no** |
| 010 | `D16` sin la cortesía | no (`B/14` intacto) | **sí** | **sí**, por la obligación 3 |
| 011 | *«la única de las cuatro»* | **sí** | no | **no — excluido por escrito** |

**Tres modos que ninguna de las tres obligaciones cubre, y son distintos entre sí:**

1. **El defecto que nace entero adentro de la prosa nueva** (001, 002, 005, 009). No hay ninguna
   aparición previa que recorrer porque el mecanismo no existía, y no hay ningún término viejo que
   grepear porque no se retiró ninguno. Las tres obligaciones están escritas contra *«el texto que
   ya estaba y quedó falso»*; éstos son *«el texto nuevo que nació falso»*. **Son cuatro de once
   nuevos, y los dos `CRITICA` están acá.**
2. **La ausencia** (006). La obligación 2 recorre apariciones; una fila que falta en una lista no
   es una aparición de nada. Lo cubre la obligación **4** —la condicional—, y la evidencia de que
   funciona cuando se ejecuta es que **dos de los tres commits que crearon consumidores nuevos sí
   tocaron `nucleo/01` y agregaron su fila**, y el tercero no.
3. **El párrafo que el commit EDITÓ** (011). La obligación 1 dice *«incluidos los archivos que el
   commit toca, porque un archivo abierto no es un párrafo leído»*; la obligación 2 acota el
   rastro a *«un párrafo que el commit no tocó»*. **Las dos no dicen lo mismo**, y en el hueco
   entre ellas vive un defecto cuya aparición estaba en el contexto del diff. Lo dejo señalado
   como observación de la medición y no como propuesta: eso es del owner.

**Un sesgo que hay que declarar, igual que las tres vueltas anteriores.** El §2 de las
instrucciones manda mirar primero lo que cambió, así que la búsqueda estaba dirigida a `MP4`,
`MP5`, `S18`, `S19`, `S20` y `S21`. Recorrí también las superficies que la tanda **no** tocó de mi
vector —`B/06`, `B/10`, `B/14`, `B/21`, `B/22`— y produjeron **dos** hallazgos (`F-8eB1-003` y
`F-8eB1-010`), los dos porque el texto debajo de ellas cambió. Y hay un sesgo nuevo que la tanda
creó: **seis de los doce caen sobre el pagador manual**, que es la población que tres de las ocho
decisiones tocaron y que ningún capítulo había recorrido entero antes.

---

## Ataques que intenté y el diseño resistió

- **Dejar el candado `A` vacío y meter un alta nueva** (`F-8dB1-002`, `CRITICA` de la vuelta
  anterior). **Cerrado de verdad, y lo verifiqué por los tres caminos.** `S18` sale ahora también
  de `PENDING_AUTHORIZATION` *«cuando la predecesora se murió sola»* (`B/03` §3.2), la aritmética
  está escrita —*«la sucesora pasa a `A` y el segundo `INSERT` lo rechaza la base»* (`B/02`
  §2.2)—, `B/09` §3 **retiró** la excepción que leía el lado equivocado del candado y explica cuál
  era, y `B/12` §4.4 y `B/19` §4 fila 16-bis cambiaron la oferta de *«empezar de nuevo»* por
  *«terminá o cancelá el checkout»*. Recorrí las tres muertes solas —`S12`, `S16` y el espejo— y en
  las tres el cierre corre sin esperar la autorización.
- **Congelar una fila para siempre con un `sucede_a` que nadie limpia** (`F-8dB1-001`, el `CRITICA`
  más caro de la vuelta anterior). **Cerrado.** La relación tiene cuatro estados declarados
  (`B/03` §3.2), `S19` lleva *«una **sucesora viva** con `sucede_a` apuntándola»*, `G-R1-D` y
  `G-R1-E` lo vigilan desde los dos lados, y el inventario de `NUCLEO/01` §2.4 pasó de cinco
  predicados a veinte consumidores en dos grupos. Recorrí los diez del grupo B uno por uno: **los
  diez llevan el adjetivo**.
- **Destruir la promo en el upgrade** (`F-8dB1-003`). **Cerrado.** `S18` tiene cuatro escrituras y
  la tercera alcanza tres entidades —complementos, redención de promo y cortesía— con el inventario
  en `B/02` §2.6, `B/14` §2.2 nombra el acto en tres pasos y `G-R1-C` se rompe *«comentando cada
  una de las cuatro escrituras por separado»*. Verifiqué las tres contra `B/02` §2.6 y contra
  `B/14`, no contra el informe que las citaba.
- **La quinta forma de terminar la sucesión** (`F-8dB1-004`). **Cerrada**, y bien: la rama 5
  existe, declara su acto (`S18` sin `S17`), dice qué ve el cliente (*«cae al piso por lo que le
  quede de ventana»*) y `B/12` §5.3 reescribió el **método** de enumeración —*«sobre la tabla de
  transiciones del cap. 03 entera, no sobre sus filas numeradas»*—, que era el defecto real.
  Volví a recorrer las salidas de una predecesora en `GRACE_PERIOD` y en `SUSPENDED` y no encontré
  una sexta.
- **El reembolso de un pago manual sin dónde asentarse** (`F-8dB1-005`). **Cerrado**: `refund`
  cuelga de *«un `payment` **o un `manual_payment`**»* (`B/02` §2.3), `B/03` §7 lo declara con su
  razón (*«el estado del `manual_payment` **no se mueve**»*) y `B/12` §5.3 cierra que *«las dos que
  devuelven plata ya tienen dónde asentarla»*. Lo que queda es del capítulo 13 y lo digo arriba.
- **El aviso que promete una devolución instantánea** (`F-8dB1-006`). **Cerrado en los dos
  consumidores**, verificado leyéndolos: `NUCLEO/07` §6 y `B/19` §4 fila 15 dicen los dos *«la
  devolución no es instantánea … la confirma una persona»* y los dos nombran la puerta manual.
- **La mitad inalcanzable de la condición 3** (`F-8dB1-007`). **Cerrada declarándola**, que es la
  salida correcta: `B/05` §3 ahora dice *«La mitad `sucedida_por` es redundante con la condición 1,
  y se declara así en vez de presentarse como el caso que salva»*, con las dos razones por las que
  se conserva. `B/02` §2.2 lo espeja.
- **Cobrar dos veces el mismo período por las dos puertas del pago manual.** Resiste: `C5` lleva el
  `UNIQUE(subscription_id, período) WHERE el pago está acreditado` a la base (`B/05` §2), la
  condición 4 del §3 lo repite del lado de la reactivación, y desde `MP5` la fila de
  `manual_payment` **nace con el período escrito** (`B/02` §2.3), que es lo que ese `UNIQUE`
  presuponía. Recorrí el cruce `MP1` × reciclado y `MP4` × reciclado y los dos chocan contra la
  misma clave.
- **Colar un pago retenido por `S19` que nadie resuelva.** Resiste por tres capas: los cuatro actos
  de `B/03` §3.2, la segunda comprobación de cero llamadas de `B/09` §3, y las salvedades 2 y 3 que
  devuelven al barrido la terminal con marca o con pago pendiente. Probé la combinación peor —`S18`
  que no corre, predecesora `CANCELLED` por el espejo, sucesora viva— y **la primera** comprobación
  la agarra: *«tiene `sucede_a` no nulo y la predecesora ya no es fila viva»* → marca.
- **Que `S20` deje un complemento cobrando por la ejecución parcial del fan-out.** Resiste: la
  tercera comprobación de cero llamadas lo cubre con su segunda fila, condicionada al flag, y la
  salvedad 4 devuelve la fila al barrido hasta que la relectura vea el preapproval `cancelled`.
  Verifiqué que `S20` entra por la 4 y `S21` por la 1, y que las dos poblaciones son disjuntas.
- **Que `S20` y `S21` manden dos cancelaciones por el mismo preapproval.** Resiste, y está
  argumentado en los dos lados: *«un addon recurrente tiene **un** preapproval y es el de esta
  fila»* (`B/03` §3.2, `S21`) y `B/16` §4.4 con las mismas palabras.
- **Convertir a $0 un addon de una vertical que el grant no ancló.** Resiste donde tiene que
  resistir —*«El que no es compatible sigue cobrándose»* (`B/16` §3.4)— y la fuga `USER`/`GLOBAL`
  **está declarada, acotada con tres razones y con apagado** (`DEC-ADDON-005`). No la reporto: es
  una de las ocho decisiones.
- **Cobrarle al beneficiario de un *Free Forever* la vertical que le acaban de anclar.** Resiste:
  `S13` tiene dos disparadores, alcanza los seis estados, y su ejecución parcial tiene detector con
  cero llamadas que cubre los dos orígenes.
- **Encadenar sucesiones para llegar a tres autorizaciones.** Sigue cerrado por el índice `B` sobre
  `(user_id, vertical)`, y `G-R1-A` lo rechaza además en el acto de declarar.
- **Reabrir un `DECLARED_UNPAID` sobre una fila que ya volvió por otra puerta.** Resiste: la
  condición 3 del `B/05` §3 lo rechaza y `B/03` §7.1 lo dice explícito —*«la **3** rechaza la
  reapertura si la persona ya volvió por otra puerta —tendría dos filas vivas y dos cobros»*—.
- **Cobrarle un recargo al que paga tarde.** Resiste y está escrito: *«Ningún capítulo del programa
  tiene recargo, interés ni punitorio, y crear uno acá sería una decisión de producto que esta fila
  no toma»* (`B/03` §7.1).
- **Acumular cuotas durante la suspensión del pagador manual.** Resiste: la mitad (b) de
  `DEC-SUB-013` lo prohíbe y lo argumenta contra dos decisiones anteriores. El defecto que sí
  encontré es el **remedio** de esa mitad (`F-8eB1-001`), no la mitad.
- **Los cinco críticos que `DEC-MIG-004` retiró.** No los toqué por ningún ángulo, y los recorrí
  para confirmar que ninguno de mis doce es uno de ellos disfrazado.
