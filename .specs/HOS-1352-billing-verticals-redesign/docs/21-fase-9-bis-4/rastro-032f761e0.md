---
title: FASE 9-bis-4 — Rastro por aparición de la familia de la baja
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `032f761e0`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que el commit no tocó**, van el archivo, las líneas, el §, la cita y **por qué sigue
siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse falsa.

## El commit

| sha | qué cierra |
|---|---|
| `032f761e0` | `F-8eB2-003` — la baja pasa de una fila a tres: `S22` desde `PAUSED` y `S23` desde `SUSPENDED` |

## 1. Qué se arregló, en una frase

`B/12` §7.2 decidía el caso entero de cancelar estando pausado —*«termina el servicio en el
acto»*— y **ninguna fila de `B/03` §3.2 lo ejecutaba**; `B/03` §3.1 enumeraba *«que la cancele una
persona»* como una de las tres salidas de `SUSPENDED` y `B/03` §7.1 colgaba de ese acto el tope de
la ventana de `MP4`. Con `S11` saliendo sólo de `ACTIVE`, el pausado que pedía irse caía en la
regla 1 del núcleo mientras `S10` lo devolvía a `ACTIVE` y le cobraba el ciclo siguiente, y el
pagador manual `SUSPENDED` quedaba encerrado con el candado `A` ocupado por una fila que nadie
podía matar.

**Las dos filas nuevas y sus `desde`:**

| fila | desde | hacia | qué se le manda al proveedor |
|---|---|---|---|
| `S22` | `PAUSED`, con cualquiera de los dos motivos | `CANCELLED` | se cancela el preapproval **de inmediato**, con la regla de relectura de `S17` — `EX-11` mide que una pausada rechaza toda modificación **y sí deja cancelar** |
| `S23` | `SUSPENDED` | `CANCELLED` | se cancela **si el preapproval seguía vivo**; sobre un **pagador manual no se manda nada**, porque no hay débito que detener (`B/06` §7) |

Ninguna de las dos pasa por `CANCEL_SCHEDULED`: en las dos **no queda período pagado que
sostener** —al pausar los días no usados se perdieron (`DEC-SUB-010`) y estando suspendido el §21
ya había cortado el servicio—, y el §3.3 ya lo prohibía desde `PAUSED`. `S13` es el precedente
exacto: alcanza a las filas en `PAUSED` y `SUSPENDED`, cancela el preapproval y las manda directo
a `CANCELLED`.

## 2. Qué se grepeó

**Términos NUEVOS** (los que el arreglo define): `S22` · `S23` · *«la baja tiene TRES filas»* ·
*«la salida de `PAUSED` que devuelve el servicio»* · la **sexta** rama de `B/12` §5.3 · las
**ocho** transiciones que sacan a una principal de las filas vivas · las **once** puertas a un
terminal · los **siete** casos que comparten `desde` sin compartir par · `fin_real` escrito por la
baja.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«`S10` es la única salida de `PAUSED`»* · *«cinco ramas»* / *«las
cinco de `B/12` §5.3»* · *«nueve puertas»* · *«cinco casos vivos»* · *«las seis que sacan a una
fila principal de las filas vivas»* · *«durante la pausa no hay servicio»* · *«que la cancele una
persona»* (sin fila detrás) · *«que nadie cancela»* leído como subconjunto · *«S11 + S12»* como la
cancelación entera · *«el servicio sigue hasta el fin del período pagado»* dicho sin condición ·
*«Entra por S8 o S9, sale por S10»*.

**Alcance**: los **53 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los
documentos de medición—, con y sin backticks, **incluidos los ocho archivos que el commit toca**.

**Medido sobre el árbol en `032f761e0`**: **152** líneas con al menos una aparición, repartidas en
**112** párrafos; **43** de esos párrafos los tocó el commit; **69** no, y son los que van abajo,
uno por uno. La partición se calculó con los rangos `+` de
`git diff --unified=0 032f761e0^..032f761e0` proyectados sobre los bloques separados por línea en
blanco —la unidad que `DEC-METH-010` obligación 1 fija es el **párrafo**, no el archivo ni la
línea—, no a ojo.

## 3. Las 69 apariciones no corregidas, una por una

### `B/03-maquinas-de-estado.md` (21)

- **L40-51 · §3.1, la tabla de los nueve estados** — «`CANCEL_SCHEDULED` \| dada de baja en el
  proveedor, con servicio sostenido hasta el fin del período pagado» → sigue correcta y **es
  justamente la definición que las dos filas nuevas no cumplen**: por eso no pasan por ahí. La
  celda describe el estado, no la cancelación.
- **L161-164 · §3.2, el dominio por el lado de la predecesora** — «Recorrí las salidas de los tres
  estados desde los que una fila **puede ser sucedida** —`ACTIVE`, `GRACE_PERIOD`,
  `CANCEL_SCHEDULED`, el conjunto que `G-R1-A` vigila»* → sigue correcta: `G-R1-A` no cambió y
  `PAUSED`/`SUSPENDED` **no son estados desde los que se declara una sucesión**; se llega a ellos
  por las filas 1 a 3 de esa misma tabla.
- **L166-174 · §3.2, la tabla de siete del dominio** — las siete filas siguen siendo siete:
  `S22` y `S23` **no salen de ninguno de los tres estados** que la tabla recorre, y eso está
  escrito en el párrafo nuevo que el commit agregó debajo.
- **L176-181 · §3.2** — «La séptima no tiene fila numerada en esta tabla» → sigue correcta: el
  espejo sigue siendo la séptima de **esa** tabla, que no ganó filas.
- **L240-246 · §3.2** — «De las cuatro escrituras de `S18`, por dos de los tres caminos corren
  tres, y por el tercero corren las cuatro» → **sigue correcta y hay que leerla con cuidado**:
  *«los tres caminos»* son los de `S18` **sin `S17`** que ese párrafo analiza —`S12`, `S16` y el
  espejo—, y el commit le agregó dos más al evento de `S18`. La aritmética del párrafo no cambia:
  por `S22` y `S23` corren **las cuatro**, igual que por el espejo, porque la predecesora puede
  retener un pago por `S19` (es la rama 6 nueva). Lo que el párrafo afirma sobre `S12` y `S16` —que
  ahí la cuarta *«no puede aplicar»*— sigue intacto.
- **L248-257 · §3.2** — «El `desde` del espejo es *«cualquier estado vivo que no sea
  `CANCEL_SCHEDULED`»*, o sea que **incluye `GRACE_PERIOD` y `SUSPENDED`»* → sigue correcta: el
  espejo no cambió y su `desde` tampoco.
- **L283-294 · §3.2** — «`S18` sin `S17` es lo CORRECTO en `S12`, en `S16` y en el espejo» → sigue
  correcta **como enumeración de los casos que ese párrafo trata**, y el commit agregó los dos
  nuevos en la celda de `S18` y en el párrafo del dominio, que es donde la lista es normativa.
- **L309-313 · §3.2** — «un preapproval que la relectura encuentra ya `cancelled` —el
  arrepentimiento del §3.3, donde `S11` lo canceló *«de inmediato»*— no es una cancelación
  fallida» → sigue correcta: habla del arrepentimiento desde `CANCEL_SCHEDULED`, que sale de
  `S11` y de ningún otro lado.
- **L430-437 · §3.2, las dos escrituras de `S10`** — «una pausa cuyo `fin_previsto` ya pasó y que
  sigue sin `fin_real`, con su suscripción en `PAUSED`» → sigue correcta, y el commit la reforzó
  desde el otro lado: `S22` escribe `fin_real` **y** saca la fila de `PAUSED`, así que rompe las
  dos condiciones y no produce un falso positivo.
- **L501-512 · §3.2, el alcance de `S13`** — «`PENDING_AUTHORIZATION` es el caro» y
  «`CANCEL_SCHEDULED` entra por completitud: no tiene obligación de pago viva —`S11` ya canceló»
  → siguen correctas: son sobre el `desde` de `S13`, que no cambió, y la segunda razona sobre
  `CANCEL_SCHEDULED`, a donde sólo se llega por `S11`.
- **L688-692 · §3.2, `S21`** — «Por qué no se aplica el patrón de `DEC-SUB-009` … sostiene el
  servicio hasta el fin del período pagado» → sigue correcta, y **ahora tiene dos hermanas**: es
  el mismo argumento que el commit escribió para `S22` y `S23`. Que tres filas distintas lo usen
  no lo debilita.
- **L694-708 · §3.2, `S21`** — «Lo que un `CANCEL_SCHEDULED` sostendría no es un destaque: es la
  fila de un cobro» → ídem: es el razonamiento del complemento, con su propio sujeto.
- **L740-745 · §3.3** — la fila «`CANCEL_SCHEDULED` → `ACTIVE`» y su razón («arrepentirse no es
  una transición: es una sucesión … `S11` ya canceló el preapproval de la predecesora») → sigue
  correcta: `S22` y `S23` no van a `CANCEL_SCHEDULED`, así que no agregan población a esa fila.
- **L757-763 · §3.3** — «una sucesora no puede ser sucedida mientras viva … salvo desde
  `CANCEL_SCHEDULED` y con la relectura que `B/02` §2.2 exige» → sigue correcta: es sobre el
  candado `B` y sobre la marca, no sobre la baja.
- **L883-890 · §5** — «`D16` y `G-R5` comparan dos cifras de configuración y no miran el tiempo
  que una fila concreta lleva en `PAUSED` … la quinta comprobación de cero llamadas» → sigue
  correcta: la quinta comprobación sigue existiendo, sigue siendo quinta y sigue midiendo el
  tiempo real de una pausa. Lo que el commit cambió es cómo se la nombra en `B/09` §3, que es un
  párrafo tocado.
- **L1052-1058 · §7.1** — «En el caso central no hay autorización que contradecir … y si lo
  hubiera, la fila ya no estaría en `SUSPENDED`» → **sigue correcta y el commit la reusa**: es
  exactamente la razón por la que `S23` no manda nada al proveedor sobre un pagador manual.
- **L1185-1192 · §7.2, la tabla de los cinco estados que no abren cuota** — «`CANCEL_SCHEDULED` \|
  **no** \| el servicio está sostenido *«hasta el fin del período pagado»* (§3.1) y `S12` llega ese
  día» → sigue correcta: `S22` y `S23` **no crean filas en `CANCEL_SCHEDULED`**, así que no le
  agregan población a esa celda, y las celdas de `PAUSED` y `SUSPENDED` dicen *«no»* por razones
  que la baja no toca (la decisión del owner y la cortesía).
- **L1406-1422 · §7.2, *«qué premisa de otro arreglo vuelve falsa este»*** — las cuatro filas que
  esa tabla declara → siguen correctas: son sobre `MP4`/`MP5` y el pago manual. La única celda que
  el commit tuvo que tocar ahí —la de las ramas de `B/12` §5.3— está en un hunk del commit.
- **L1428-1435 · §8, la tabla de la instancia de addon** — el `desde` de `A5`, *«toda instancia con
  una autorización que puede cobrar»* → sigue correcta: su sujeto es la **instancia**, y las dos
  filas nuevas son de suscripción. Lo que sí cambió —cuántas transiciones sacan a la principal de
  las filas vivas— vive en `B/16` §4.3 y se recontó ahí.
- **L1556-1562 · §8** — «En el addon convertido por `S20` normalmente no queda preapproval vivo …
  porque `S20` ya la sacó de las filas vivas» → sigue correcta: es sobre la suscripción de
  complemento y `S20`, que la baja no alcanza.
- **L1611-1632 · §10.1** — la tabla par por par y su recuadro («es la séptima del dominio que el
  §3.2 recorre …, la **sexta** de las que disparan la re-evaluación del addon huérfano …, un
  tercer camino por el que la predecesora se muere sola») → **siguen correctas, y hay que decir
  por qué las tres cifras sobrevivieron**: son **ordinales que identifican al espejo**, no totales.
  El espejo sigue siendo el séptimo de un dominio que no creció, el sexto de una lista que ahora
  tiene ocho —entró sexto y `S22`/`S23` entraron después— y un tercer camino de los que ahora son
  cinco. Si alguna se hubiera escrito como *«el último»* o *«de seis»*, sería falsa.

### `B/12-suscripcion.md` (4)

- **L73-74 · §1.4** — «`DEC-SUB-009` gobierna la baja que **pide el cliente**: cancelamos en el
  proveedor de inmediato y sostenemos el servicio hasta el fin del período pagado» → **sigue
  correcta con una lectura y sería falsa con otra**, y la lectura correcta es la que el §7.2 ya
  tenía: lo que se sostiene es **el período pagado**, y desde `PAUSED` o `SUSPENDED` no hay
  ninguno, así que la frase no promete días que no existen. El párrafo está acá para separar la
  baja del cliente del camino de mora, y esa separación no cambió.
- **L501-507 · §5.3** — «La marca va sobre la PREDECESORA y no sobre la sucesora» → sigue
  correcta, y **la rama 6 nueva la usa igual**: el pago cuelga de la predecesora, que es la fila
  que `S23` mató.
- **L578-580 · §6.2** — «El aumento espera a la reanudación y se aplica ahí … *«todo cambio pedido
  durante la pausa se aplica DESPUÉS de reanudar»*» → sigue correcta: **la baja no es un cambio
  que se aplique después de reanudar**, es la decisión de no reanudar. Un aumento encolado sobre
  una fila que `S22` mandó a `CANCELLED` no se aplica nunca, que es el mismo desenlace que la
  colisión 3 del §2.2 declara para el descenso.
- **L648-650 · §7.3** — «Pausar estando en `CANCEL_SCHEDULED` no es una transición de la máquina:
  el §26 exige `ACTIVE`» → sigue correcta y el commit la reforzó con el párrafo de arriba: ahí la
  ausencia de fila **es** la decisión, y acá faltaba la fila de una decisión ya tomada.

### `B/02-modelo-de-datos.md` (4)

- **L45-49 · §2.2, la tabla de entidades** — «`subscription_pause` \| … inicio, fin previsto, fin
  real \| a lo sumo una sin `fin_real` por suscripción» → sigue correcta, y **`S22` la respeta**:
  escribe `fin_real` al cancelar, así que no deja una pausa abierta sobre una fila muerta.
- **L158-162 · §2.2** — «Los «vivos» siguen siendo los mismos seis … Quedan afuera `ABANDONED`,
  `CANCELLED` y `CHARGE_DECLINED`» → sigue correcta: las filas nuevas **no agregan ni sacan
  estados**, mandan a un `CANCELLED` que ya estaba afuera.
- **L191-193 · §2.2** — «una fila marcada puede suceder cuando está en `CANCEL_SCHEDULED`, si una
  relectura … confirma» → sigue correcta: es sobre suceder, no sobre cancelar.
- **L195-200 · §2.2** — «El razonamiento era *«en ese estado `S11` ya canceló el preapproval»*» →
  sigue correcta: *«ese estado»* es `CANCEL_SCHEDULED`, al que sólo se llega por `S11`.

### `B/05-idempotencia-y-concurrencia.md` (2)

- **L86-89 · C2, la tabla de dos filas** — «el cobro es **anterior** a la cancelación \| … se
  extiende la fecha de fin de servicio» → **la tabla queda intacta y su alcance lo acota el
  párrafo que el commit agregó justo abajo**: las dos filas siguen siendo exactas para `S11`, que
  es la única baja que deja una fecha de fin que se pueda extender. Se resolvió acotando y no
  reescribiendo porque la fila **sigue siendo verdadera de su población**.
- **L228-236 · §3** — «El párrafo dice *«los seis de `B/02` §2.2»* y la tabla enumeraba cuatro» →
  sigue correcta: es la historia de la condición 3, sobre los estados vivos, que no cambiaron.

### `B/09-conciliacion.md` (1)

- **L178-212 · §3, el recuadro de la salvedad 1** — «El sujeto de esta salvedad son DOS filas …
  el estado terminal es de la **instancia** y el preapproval es de su **suscripción de
  complemento**» → sigue correcta: la salvedad 1 es de complementos y las dos filas nuevas son de
  principales (salvo que la baja caiga sobre una de complemento, y ahí entra por la 4 como
  cualquier otra cancelación nuestra).

### `B/16-addons.md` (3)

- **L82-90 · §2.2** — la tabla de *«válida es `ACTIVE`, y sólo `ACTIVE`»*, con su fila de
  `CANCEL_SCHEDULED` → sigue correcta: decide si se puede **comprar** un addon según el estado del
  título, y la baja no agrega un estado nuevo.
- **L410-424 · §4.2** — «`S13` saca de las filas vivas a la suscripción principal de cada vertical
  que el grant ancla» → sigue correcta: es la tercera mitad de la orfandad, sobre `S13`. Lo que sí
  había que recontar —cuántas transiciones sacan a una principal— está en el §4.3, en un hunk del
  commit.
- **L618-628 · §4.4** — «Por qué no se aplica el patrón de `DEC-SUB-009` … sostiene el servicio
  hasta el fin del período pagado» → sigue correcta, con el mismo argumento que `S21` en `B/03` y
  el mismo que el commit escribió para `S22`/`S23`: sin período pagado no hay `CANCEL_SCHEDULED`
  que valga.

### `B/10-verticales-planes-billing-options.md` (1)

- **L141-146 · §4.3** — «cada suscripción viva se cancela en el proveedor de inmediato y pasa a
  `CANCEL_SCHEDULED` (`DEC-SUB-009`), con su fecha de fin de servicio sostenida de nuestro lado» →
  **NO se corrigió, y no porque siga siendo correcta: porque no es mía y arreglarla es una
  decisión.** El choque es real y anterior al commit —el §3.3 prohíbe `PAUSED → CANCEL_SCHEDULED`
  desde antes—, y lo que el commit sí hizo fue **declararlo** en *«Lo que esta mitad NO cierra»*
  de `B/03`. El acto de la discontinuación no es el de `S22`: lo decide `SUPER_ADMIN` y su piso de
  60 días es una compensación deliberada, así que no se resuelve leyéndolo como una de las tres
  filas de la baja. Va como pregunta 2 al owner.

### `B/14-promos-cortesias-y-grants.md` (1)

- **L264-271 · §4.4** — «acá `S18` siempre corre sobre una sucesora ya `ACTIVE` … El segundo
  camino de `S18` —la predecesora que se muere sola— sale de `S12` (`desde: CANCEL_SCHEDULED`) …»
  → **sigue correcta y es la más cerca de haberse vuelto falsa de todo el rastro**. Lo que la
  salva es su primera cláusula: el § trata el cruce *«cortesía temporal + cambio de plan»*, y una
  cortesía temporal vive sobre una fila en `PAUSED` por `COURTESY`, que **no puede declarar una
  sucesión** (`G-R1-A` sólo admite `ACTIVE`, `GRACE_PERIOD` y `CANCEL_SCHEDULED`). O sea que la
  predecesora de ese § nunca está en `PAUSED` cuando la sucesión se declara; si pausa después,
  `S22` la alcanza y el segundo camino de `S18` la cubre por la celda que el commit corrigió.
- *(Se verificó contra el texto, no contra el informe: la enumeración de ese párrafo es
  ilustrativa —*«sale de `S12` … y de `S16`»*— y no afirma ser cerrada.)*

### `B/20-testing.md` (1)

- **L48-60 · §2, el catálogo de guards** — `G-R1-A`, `G-R1-D`, `G-R1-E`, `G-R4` → **ninguno gana
  ni pierde dominio**. `G-R1-A` vigila el acto de **declarar** una sucesión y las dos filas nuevas
  no declaran ninguna; `G-R1-D` vigila los caminos que **reactivan** y las dos cancelan; `G-R1-E`
  cuenta consumidores de *«fila viva»* y **las dos filas nuevas no lo son** —su `desde` es un
  estado concreto y no el conjunto, que es por lo que el inventario de `NUCLEO/01` §2.4 no gana
  filas (obligación 4 de `DEC-METH-010`, evaluada y resuelta en negativo)—; y `G-R4` cuenta
  **pares**, que siguen siendo tres.

### `B/descomposicion.md` (1)

- **L347-361 · §4** — la tabla de lo que cada unidad deja demostrado, fila `B10` → sigue correcta:
  enumera obligaciones de cobertura sobre addons y cancelación de planes, sin fijar desde qué
  estados sale la baja.

### `NUCLEO/01-glosario.md` (5)

- **L90-95 · §1.2** — «la pausa no aparece en la lista de arriba … Verticales no sabe que detrás
  de la pérdida de cobertura hay una pausa» → sigue correcta: la baja desde una pausa le quita
  cobertura a verticales exactamente igual que la pausa, por `cubierto`, sin nombrar el estado.
- **L209-215 · §2.2** — la tabla de estados por máquina, fila **Suscripción** con sus nueve → sigue
  correcta: **el commit agrega dos transiciones y ningún estado**.
- **L246-249 · §2.2** — «`CANCEL_SCHEDULED` existe aunque el proveedor ya esté cancelado …
  sostener el servicio de nuestro lado hasta el fin del período pagado» → sigue correcta: define
  el estado por su razón de existir, y esa razón es la que las dos filas nuevas **no** tienen.
- **L268-271 · §2.4** — «**fila viva** … De la **suscripción**, los **seis**» → sigue correcta: los
  seis son los mismos.
- **L415-427 · §3** — «el tope de UNA pausa … tiene que quedar por debajo del día del hard delete
  … porque el reloj de inactividad no se detiene» → sigue correcta: es `D16`, sobre dos cifras de
  configuración. La baja desde una pausa no alarga ninguna pausa.

### `NUCLEO/04-invariantes.md` (2)

- **L125-142 · §3, la tabla de invariantes de decisión** — `D3` (*«una pausa siempre tiene
  motivo»*), `D7`, `D8`, `D14`, `D15`, `D16` → siguen correctas. `D3` no cambia porque `S22` **lee**
  el motivo y no lo escribe; `D7` es sobre cuándo se cancela la vieja en una sucesión; `D14` es
  sobre la discontinuación, que sigue como estaba; `D15` y `D16` se recontaron en hunks del commit
  o no cambiaron de sujeto.
- **L247-283 · §5** — el resumen del reparto y su historia de correcciones → sigue correcta: el
  commit **no agrega ni mueve invariantes**, sólo precisa el alcance del 22, que está en un hunk.

### `12-contrato-de-cobertura.md` (3)

- **L187-194 · §2.5, la matriz `tipo` × `hasta`** — «`SUSCRIPCIÓN` \| `TÍTULO` —
  `CANCEL_SCHEDULED`» → sigue correcta: sigue siendo el único estado de suscripción que emite con
  `hasta: fecha`, y las dos filas nuevas **no crean filas en él**.
- **L285-290 · §2.6** — «**`fecha`** \| el fin ya está determinado: `CANCEL_SCHEDULED` con la fecha
  de `DEC-SUB-009`…» → ídem.
- **L312-323 · §2.6, qué emite cada estado** — las diez filas → siguen correctas: **una fila que
  `S22` o `S23` mandan a `CANCELLED` deja de emitir**, que es lo que esa tabla ya dice de
  `CANCELLED`. No hace falta una fila nueva porque el estado de llegada ya está en la tabla.

### `01-decision-log.md` (9)

> No se edita por regla dura de la fase. Van igual, porque el decision log es parte del corpus que
> `DEC-METH-010` obligación 1 manda recorrer.

- **L1220-1265 · `DEC-SUB-009`** — «la baja se haga efectiva al final del período ya pagado,
  manteniendo el servicio hasta entonces» y su implicación 3 → **sigue correcta y es la decisión
  que el commit ejecuta, no una que contradiga**: las dos filas nuevas aplican su implicación 3
  —*«la fecha de fin de servicio es un dato nuestro»*— a un caso en que ese dato es hoy.
- **L1592-1659 · `DEC-SUB-010`** — «los días no usados del ciclo en curso se pierden» → sigue
  correcta, y **es el fundamento del `desde` de `S22`**: por eso la baja desde una pausa no tiene
  período que sostener.
- **L2410-2437 · `DEC-CONC-003`** — la marca no es un estado → sigue correcta: las dos filas nuevas
  mueven la columna de estado y no la marca.
- **L2567-2603 · `DEC-METH-007`** — *«de las cinco del PDR»* → homónimo: son las cinco condiciones
  de *«bien testeado»*, no las ramas de `B/12` §5.3.
- **L3020-3055 y L3057-3077 · `DEC-DATA-002`** — «el reloj SÍ corre durante la pausa, y se
  reinicia al reanudar» → siguen correctas: la baja desde una pausa **no reanuda**, así que no
  reinicia nada, y de ahí en adelante la ficha sigue el camino de una suscripción cancelada.
- **L3138-3154 · `DEC-ADDON-004`** — «el costo sería un `CANCEL_SCHEDULED` con reloj y fecha de fin
  de servicio sobre un estado vacío» → **sigue correcta y es el mismo argumento que el commit usa**
  para no mandar a `S22`/`S23` por ahí.
- **L3190-3241 · `DEC-SUB-012`** — «cancelar la suscripción (una de las doce acciones …)» y el tope
  *«con actos, no con el calendario»* → **sigue correcta y recién ahora es ejecutable**: el acto
  que esa decisión eligió como tope existía en el catálogo y no en la máquina. El commit no cambia
  la decisión; le da la fila que le faltaba.
- **L3302-3342 · `DEC-SUB-013`** — «`CANCEL_SCHEDULED` porque ningún período nuevo empieza antes de
  `S12`» → sigue correcta: `MP5` no abre cuota en `CANCEL_SCHEDULED`, y las filas nuevas no crean
  filas ahí.

### `03-handoff.md` (2) · `04-open-decisions.md` (2) · `02-worklog.md` (1)

- **`03-handoff.md` L97-111 y L173-178** — el resumen de lo que dejó la 9-bis («`S17` cancela la
  predecesora y limpia `sucede_a`») → siguen correctas: describen `S17` y `S18`, que el commit
  extiende sin contradecir.
- **`04-open-decisions.md` L24-108 y L470-472** — *«las cinco decisiones»* y el estado de las
  preguntas de FASE 1A → homónimos: no son las ramas de `B/12` §5.3.
- **`02-worklog.md` L975-977** — «`D-04` afirma ser *«la única salida que además cierra
  `F-8A1-005`»*» → homónimo exacto del término retirado: *«única salida»* acá es una salida de
  diseño, no una transición desde `PAUSED`.

### Documentos de medición (5)

- **`06-mp-validation-matrix.md` L201-208 · `BD-MP-01`** y **`mp-probes/RESULTS-2026-09-15.md`
  L2864-2868 · `PS-4`/`PS-5`/`PS-6`** — «estando pausada …» → **son mediciones y no afirmaciones
  de diseño**: `PS-6` dice que el ciclo que vence estando pausada avanza la fecha sin cobrar, y
  eso es lo que el commit cita para justificar que desde `PAUSED` no hay cobro en vuelo que
  extender (`B/05` C2).
- **`08-phase-1b-code-discovery.md` L2442-2444 y L5685-5689** — *«las cinco de `mercadopago`»* y
  *«las cinco de `billing_subscriptions`»* → homónimos: son conteos del código actual.
- **`08-phase-1b-code-discovery.md` L6357-6361 · `F-1B-131`** — «el §24 pide que la cancelación
  normal *«se hace efectiva al final del período ya pagado»*» → sigue correcta **como cita del
  PDR**, y el adjetivo *«normal»* es el mismo que el commit precisó en el invariante 22.

### `V/02-modelo-de-datos.md` (1)

- **L413-419 · §4.2** — «Alguien pausa hasta 4 pausas-mes —unos 120 días—, `PB2` le baja la ficha
  el primer día y `PB4` …» → sigue correcta: es el caso testigo de la retención sobre una pausa que
  **termina reanudando**. Si esa persona se va por `S22`, deja de haber pausa y la ficha sigue el
  camino de una cancelación, que esas mismas reglas ya cubren por `cubierto`.

## 4. Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto (13)

| dónde | qué decía | por qué dejó de ser cierta |
|---|---|---|
| `B/03` §3.2, título | *«`S10` es la única salida de `PAUSED`»* | `S22` es otra |
| `B/03` §5, celda *«quién la termina»* | citaba ese título | ídem |
| `B/09` §3, quinta comprobación | *«el único estado que la única salida de `PAUSED` puede dejar colgado»* | ídem |
| `B/03` §5, encabezado | *«Entra por S8 o S9, sale por S10»* | ídem |
| `B/03` §3.2, evento de `S18` | *«sin `S17` — por `S12`, por `S16` o por el espejo»* | son cinco causas |
| `B/12` §5.3 | *«las formas … son cinco»* | `S23` sobre una predecesora con pago pendiente es la sexta |
| `B/16` §4.3 | *«las seis que sacan a una fila principal de las filas vivas»* | son ocho |
| `B/09` §3 | *«nueve puertas a un estado terminal»* y *«cinco de las seis filas no»* | once y siete de ocho |
| `NUCLEO/03` §1 regla 7 | *«cinco casos vivos»* que comparten `desde` | son siete |
| `NUCLEO/04` `D15` | *«`S18` corre en tres de las cinco»* | cuatro de seis |
| `NUCLEO/04` invariante 22 | *«la cancelación normal … S11 + S12»* sin decir qué es *«normal»* | hay dos bajas más, sin período que conservar |
| `B/12` §2.2 colisión 3 | *«las dos cosas caen en el mismo instante — el fin del período pagado»* | desde `PAUSED`/`SUSPENDED` caen hoy |
| `B/19` §5 | *«el servicio sigue hasta el fin del período pagado, con esa fecha a la vista»* | esa fecha puede ser hoy |

**Y una premisa de los dos rastros anteriores dejó de ser cierta:**

- **`rastro-5836ec219.md` L372** — justificaba `B/03` §5 L794 (*«Entra por S8 o S9, sale por
  S10»*) con *«sigue correcta: `S10` sigue siendo la única salida, que es precisamente por qué su
  rama de fallo era obligatoria»*. **La primera mitad es hoy falsa** —`S22` y `S13` son salidas de
  `PAUSED`— y **la segunda sigue intacta**: la rama de fallo de `S10` era obligatoria porque es la
  única salida que **devuelve el servicio**, que es lo que el título corregido dice ahora. El
  rastro no se edita (es de otra familia y la regla lo prohíbe); queda anotado acá.
- Del **`rastro-8f9f31ac0.md`** no dejó de ser cierta ninguna: sus términos son la fecha del
  próximo cobro y el tope de `MP4`, y las dos filas nuevas **no la mueven** —mandan la fila a
  `CANCELLED`, donde ya no hay próximo cobro—. La única línea vecina es la de `MP4`, y el tope que
  ahí se declara **recién ahora es ejecutable**, que es el sentido contrario a volverse falsa.

## 5. Preguntas para el owner

1. **La baja desde `GRACE_PERIOD` no tiene fila y no se decidió acá.** Es el cuarto estado desde el
   que alguien puede pedir irse, y `DEC-SUB-009` no selecciona una fecha: el período en curso
   **no está pagado** —su cobro falló— y el último pagado ya terminó. Las dos respuestas posibles
   son **cortar hoy** (como `S22`/`S23`) o **dejar correr el reloj del grace**, que le regala los
   días que el §20 ya le estaba dando. Quedó declarada abierta en `B/03`, *«Lo que esta mitad NO
   cierra»*.
2. **La baja de la discontinuación (`B/10` §4.3) manda a `CANCEL_SCHEDULED` también a las filas en
   `PAUSED`, y el §3.3 lo prohíbe.** Es anterior a este arreglo, pero el commit lo vuelve visible.
   Hace falta decidir qué estado ocupa una pausada durante los 60 días de piso, y con eso escribir
   su fila.
3. **La rama 6 de `B/12` §5.3 deja la devolución en manos de una persona y no fija un default.**
   Es coherente con `DEC-RF-002`, pero si el owner quiere un default —devolver siempre, o no
   devolver nunca, cuando el que canceló es el cliente— conviene escribirlo ahí y no en cada caso.
4. **`B/12` §2.2 colisión 4 justifica encolar el descenso *«durante la pausa no hay publicación ni
   servicio (§26.1)»*, y eso es verdad de `CUSTOMER_REQUEST` y falso de `COURTESY`** — el mismo
   defecto de razón que el commit corrigió en el §7.2. **No se tocó**: el desenlace que declara
   (esperar) podría no ser el mismo para una cortesía, y eso es una decisión de producto.
