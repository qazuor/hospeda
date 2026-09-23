---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 20
---

# 20 · Estrategia de testing

Mitad **BILLING** del capítulo 20 del programa. La otra mitad vive en la otra épica.

El §62 abre diciendo que *«testing forma parte del diseño desde el comienzo»* y reparte el trabajo
en cuatro capas. Este capítulo dice **qué va en cada una** y, sobre todo, resuelve las dos cosas
que el §62 deja sin decir y que deciden si la suite sirve:

- **qué tiene que mentir el proveedor falso** (§3), porque uno que se porte bien no prueba nada
  sobre el código que tiene que sobrevivir al real;
- **qué son exactamente los guards** que los capítulos anteriores fueron dejando (§2), que hoy
  están repartidos en siete lugares.

---

## 1. Las cuatro capas

| capa | qué cubre | contra qué corre |
|---|---|---|
| **dominio e integración** (§62.1) | los escenarios funcionales: estados, transiciones, trial, billing, grace, pausa, cancelación, upgrade, downgrade, promo, cortesía, grant, addons, entitlements, limits, autorización, conciliación, **carreras** e **idempotencia** | base real, proveedor falso |
| **guards** | propiedades del **código**, no de una ejecución | el árbol de fuentes, en CI |
| **sandbox del proveedor** (§62.3) | *«suite real más pequeña pero obligatoria»* | Mercado Pago sandbox |
| **E2E** (§62.4) | *«los flujos críticos que hoy requieren smoke manual»* | el sistema entero |

**El §62.1 dice algo que conviene no suavizar: *«cubrir 100 % de escenarios funcionales
relevantes. No obsesionarse con 100 % lines»*.** Un porcentaje de líneas se sube ejecutando
código sin afirmar nada sobre él; un escenario faltante es un caso que nadie pensó. Las dos
métricas no miden lo mismo y sólo una importa.

---

## 2. Los guards, en un solo lugar

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| G7 | un valor comercial vive **en código** | invariantes §64.15 y §64.16 |
| G9 | el `reason` que se manda al proveedor es **un identificador interno** y no copy para el cliente | `D9`, `EX-19` |
| G10 | un `init_point` del proveedor se muestra **sin sanear** | `D10`, `EX-37` |
| G11 | se le pide un **trial al proveedor** | `D12` |
| G12 | se importa el **SDK de la pasarela fuera del adaptador** | `DEC-ARCH-004`, condición A. Lo construye `B1` (`B/descomposicion.md` §2) |
| G13 | la implementación **de arranque** de `cobertura()` llega a producción | [contrato](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3. Lo construye `B4` (`B/descomposicion.md` §2), que es donde aparece la segunda implementación — **no puede nacer en `V4`**, porque mientras la de arranque es la única, un guard que prohíba su llegada a producción falla desde el primer día |
| G-R1-A | **el camino que declara una sucesión** escribe `sucede_a` apuntando a una predecesora que **en ese acto** está fuera de `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, o a una que a su vez tenga `sucede_a` no nulo | cap. 02 §2.2, cap. 03 §3.2 (`S1`) |
| G-R1-B | una fila con `sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización, **o esa fecha no es la que el proveedor confirmó** | `D8`, cap. 12 §5.2, cap. 02 §2.2 |
| G-R1-C | un camino escribe **`sucedida_por` sin limpiar `sucede_a`**, o limpia **`sucede_a` sin escribir `sucedida_por`**, o **cierra una sucesión dejando algo colgando de la predecesora**: un complemento o la **redención de promo** sin re-apuntar, **o una cortesía vigente sin cerrar y sin `saldo_días`** —ésa **no** se re-apunta, `DEC-GRANT-007`—, o un **pago pendiente por `S19` sin una marca `requiere_conciliación` abierta con motivo `REEMBOLSO_POR_CONFIRMAR`** —la marca sin el motivo **pasaba el guard y no ordenaba nada**—; **o `S25` mata una `PAUSED · COURTESY` con días sin entregar y no le escribe el `saldo_días`** (`DEC-GRANT-010`) | `D15`, cap. 03 §3.2 (`S18` y `S25`), cap. 02 §2.2, §2.5 y §2.6, `DEC-RF-002` |
| G-R1-D | un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o **el de `MP4`**— que en ese instante es la **predecesora de una sucesión en curso** (tiene una sucesora **viva** con `sucede_a` apuntándola), o **reembolsa** el pago que quedó pendiente por `S19` **antes** de que la sucesión se resuelva | cap. 12 §5.3, cap. 03 §3.2 (`S5`, `S7`, `S19`) y §7.1 (`MP4`), cap. 05 §3 condición 3 |
| G-R1-E | un **predicado sobre `sucede_a`** —en la columna *condición* de una transición, en el enunciado de un invariante o en otro guard— pregunta si **hay una fila apuntando** sin exigir que esa fila **esté viva**; o un consumidor nuevo de *«fila viva»*, *«grant vivo»* o *«ancla viva»* **no figura** en el inventario que le corresponde en `NUCLEO/01` §2.4 —son **dos** inventarios y cada término va al suyo—; **o enumera el conjunto del sujeto equivocado** —los seis de la suscripción sobre una instancia de addon, o los dos de la instancia sobre una suscripción— | `NUCLEO/01` §2.4 reglas 2 y 3, cap. 02 §2.2, cap. 03 §3.2 (`S17`, `S19`, **`S20`** — el único que nombra **los dos** sujetos en un mismo predicado — y **`S21`**, que nombra la suscripción por su conjunto **vivo** y la instancia por un estado **terminal**, que es el caso en que el guard tiene que no pedir la enumeración de los dos) y §8 (`A5`) |
| G-R1-F | un camino **abre la marca `requiere_conciliación` sin nombrar un motivo** de la enumeración cerrada del cap. 02 §2.5, o nombra **uno que no está en esa tabla**; o un camino **levanta** la marca sin decir **cuál** de las abiertas; o el **listado accionable** (cap. 19 §6) la muestra **sin motivo, sin `puesta_en`, sin TODOS los pagos que lleva colgados, sin su monto total o sin el default de `DEC-RF-003`** cuando el motivo es uno de los cuatro que devuelven plata; **o un camino que escribe un hecho con plata sobre una fila que ya tiene una marca abierta de ese mismo motivo no lo CUELGA de ella** —abrir una segunda, descartar el hecho o dejar que el `UNIQUE` lo rechace son las tres formas de perderlo (cap. 02 §2.2)—; **o un camino levanta una marca con algún pago colgado sin resolver** (cap. 03 §3.2, `S15`); **o un consumidor nuevo de *«marca abierta»* (`NUCLEO/01` §2.5) o de *«cortesía diferida»* (§2.6) no figura** en su inventario —son el **tercer** y el **cuarto** inventario del glosario y **ninguno** es de `G-R1-E`— | cap. 02 §2.2 y §2.5, cap. 03 §3.2 (`S14`, `S15`, `S18`), cap. 09 §3, cap. 19 §6, `NUCLEO/01` §2.5, `DEC-RF-002`, `DEC-RF-003` |
| **G-R6** | una **condición de transición lee una columna que NINGUNA transición escribe**. El guard recorre cada condición de las tablas de transiciones de **las nueve máquinas, en las dos épicas**, extrae las columnas que lee y exige que **al menos una transición del corpus las escriba** — donde *«el corpus»* son **las tablas que los capítulos declaran**, nunca el subconjunto ya construido, o el guard nace en rojo sobre el camino normal entre `B5` y `B8` | `DEC-TEST-001` y su ampliación del mismo día, cap. 03 §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: figura también en `V/20` §2, que escribe la razón de la ampliación — ahí vive `listing.inactiva_desde`, la columna sobre la que se decide el borrado irreversible |
| **G-R6-B** | **las dos mitades de la lista cerrada de `listing.inactiva_desde`, con tres predicados**: una **escritura** que no sea uno de los **cuatro hechos** del `NUCLEO/01` §1.2; una **lectura** que no figure entre los **cinco consumidores** del `V/02` §2.5; o **uno de esos cinco que ya no lee** la columna. **El mensaje nombra el predicado que falló** | `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; `V/02` §2.5. **Referencia cruzada**: lo define `V/20` §2, donde vive la columna. Figura acá porque **lo que puede romper la lista se escribe en esta épica**: el §4.3 del cap. 10 es donde está escrito que el reloj *«arranca acá, no antes»* —el cuarto hecho— **y, desde esta pasada, quién lo escribe: el barrido del día del fin de servicio, que es la única escritura de `listing.inactiva_desde` que sale de esta épica**; y el §7.1 del cap. 03 apoya el tope de la reapertura en que la lista **sea** cerrada |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** | cap. 03 §1 regla 7 (núcleo). **Referencia cruzada**: lo define `V/20` §2 y cubre las **seis** tablas de esta épica. El catálogo de guards es una sola numeración partida en dos capítulos, así que un guard del núcleo tiene que figurar en los dos o la mitad de su dominio queda sin vigilar en el papel |
| G-R5 | el **tope de una pausa** que declara el catálogo —cap. 03 §5 de **esta** épica—, pasado a días, **alcanza el día del hard delete** de la retención (`V/02` §4.1) | `D16` (cap. 04 §3, núcleo). **Referencia cruzada**: lo define `V/20` §2. Figura acá porque **el número que puede romperlo es de esta épica**: si alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin verlo. **Lo construye `B8`** (`B/descomposicion.md` §2.8), que es la unidad del cap. 03 §5 — **no `V9`**, que corre antes de que el tope exista (`F-8eC2-004`) |

**Los SEIS de `R1` son la contracara de las dos claves y de la marca, y conviene decir qué impide
cada uno.** *(Eran cinco hasta la FASE 9-bis-4. `G-R1-F` llegó con el motivo de la marca y es el
único de los seis cuyo sujeto no es `sucede_a` sino `reconciliation_mark`; está acá y no en otro
racimo porque la marca que más caro sale sin motivo es **la que `S18` abre al cerrar una
sucesión**.)*
`G-R1-A` impide **declarar** una sucesión desde una `SUSPENDED` —autorización de estado
indeterminado— o desde una `PAUSED`, donde `EX-11` mide que **el proveedor rechaza toda
modificación**; y de paso impide la cadena, que la clave `B` ya rechaza, en el momento de
escribirla en vez de al insertar.

**`G-R1-A` vigila el ACTO de declarar, no una propiedad permanente de la fila**, y la diferencia
no es de matiz: la sucesión dura **hasta 72 h**, y en esa ventana **ocho transiciones normales
sacan a una predecesora perfectamente legal del conjunto de tres** —`S8` y `S9` la pausan, `S6` la
suspende, y `S12`, `S13`, `S16`, el espejo de la baja decidida por el proveedor (cap. 03 §10.1) y
**`S24`** —la baja que la propia persona pide en medio del grace—
la matan; el dominio está recorrido en el cap. 03 §3.2, y **no coincide con sus filas
numeradas**—. Leído como
propiedad permanente, el guard se ponía en rojo sobre el camino normal, **exactamente durante la
ventana en que nadie lo puede distinguir de un rojo real**, y un guard que falla sobre el camino
normal es un guard que alguien va a relajar. Leído sobre el acto, el conjunto de tres es el
dominio correcto y coincide con el que `S1` exige.

`G-R1-B` es **`D8` hecho verificable en vez de recordable**, y
por eso **depende de la columna** que guarda la fecha con la que nació la fila (cap. 02 §2.2): sin
ella el guard no se puede escribir, y el invariante vuelve a ser algo que alguien tiene que
acordarse de cumplir.

**`G-R1-C` es el guard del CIERRE**, que es la mitad que faltaba: `A` y `B` vigilan cómo nace una
sucesión y ninguno vigilaba cómo termina. `S18` escribe `sucedida_por` en la predecesora y limpia
`sucede_a` en la sucesora, y las dos mitades son inseparables **en direcciones opuestas**: la
primera sin la segunda deja la sucesora ocupando el candado `B` con el `A` **vacío** —y un alta
nueva entra sin que nada la rechace—; la segunda sin la primera borra la única evidencia de que
hubo sucesión, y los complementos del que hizo un upgrade se cancelan de forma irreversible
(`B/16` §4.2). Es una propiedad del árbol de fuentes y se rompe a propósito comentando una de las
dos escrituras, que es lo que pide el §2.1.

**Y vigila las otras TRES escrituras del cierre, que es lo que cambió**: `S18` no tiene dos
efectos sino cinco, y los tres que se agregaron son los que **fallan en silencio**. Un cierre que
re-apunta los complementos y se olvida de la **redención de promo** deja al cliente pagando precio
de lista para siempre, y el barrido no lo ve porque compara contra el monto vigente de la
sucesora, que **es** el de lista (`B/14` §2.2). Uno que se olvida de la **cortesía** —que desde `DEC-GRANT-007` no se re-apunta sino que se
**cierra con su saldo de días**— deja una
columna no anulable apuntando a una `CANCELLED`, que no emite fuente, y **nada que `S9` pueda
re-emitir**. Y uno que cierra sobre una
predecesora con un pago pendiente por `S19` **sin poner la marca** deja plata del cliente en
nuestra cuenta sin nadie que la mire — es el único de los cinco que no tiene ningún otro
detector, porque la fila queda terminal (`DEC-RF-002`, `B/12` §5.3 ramas 1, 5 y 6). **Se rompe a
propósito comentando cada una de las cinco escrituras por separado**, y el inventario contra el
que se verifica es `B/02` §2.6.

**Y desde `DEC-GRANT-010` vigila un SEXTO camino que no es un cierre, y por eso hay que decirlo
en vez de dejarlo dentro de *«el guard del CIERRE»*.** `S25` —el fin de una pausa sobre un plan
que ya no se presta (`B/03` §3.2)— **difiere la cortesía con la misma columna que `S18`**, sin
que haya ninguna sucesión de por medio. Si se olvida de escribir el `saldo_días`, el desenlace es
**exactamente el mismo** que el del cierre que se olvida: días firmados por `SUPER_ADMIN` que
desaparecen en silencio. **El catálogo no gana un guard por esto** —`DEC-TEST-001` decidió cuál
es el único que se agrega— sino que el que ya existe gana el segundo escritor de la columna que
vigila. Es exactamente lo que `G-R1-D` ya hace con sus cuatro caminos, y por la misma razón: un
guard escrito sobre un camino no mira el segundo.

**`G-R1-E` es el guard del TÉRMINO, y existe porque el defecto que cierra no es una omisión sino
una paráfrasis.** `NUCLEO/01` §2.4 regla 2 ya prohíbe *«vivo»* sin calificar en un predicado, y
`S19` **no la violaba**: no usaba la palabra suelta, usaba **otra frase** —*«tiene una sucesora
con `sucede_a` apuntándola»*— que dice lo mismo **sin el adjetivo**, que es el caso que la regla
no contemplaba. Por eso este guard se ancla en la **columna**, no en la palabra: todo predicado
que mencione `sucede_a` tiene que decir además en qué estado está quien lo escribió. Su segunda
mitad vigila el inventario de `NUCLEO/01` §2.4, y es la parte que ningún grep sustituye: un
predicado nuevo **no aparece** buscando el término viejo, así que lo único que lo detecta es que
la lista de consumidores tenga una fila menos que los consumidores. Se rompe a propósito sacándole
*«viva»* a la condición de `S19`.

**Y esa segunda mitad vigila ahora DOS inventarios, porque el caso que la obligó a crecer fue el
peor de los dos.** *«Grant vivo»* y *«ancla viva»* llegaron al corpus **sin definición y sin
columna**: tres predicados los usaban —la tercera y la cuarta comprobación del barrido y la
tercera mitad de la orfandad del `B/16` §4.2— y ninguna búsqueda devolvía el hueco, porque **el
lugar donde faltaba la columna no nombraba el término**. Con el inventario, un cuarto consumidor
que llegue sin fila se cuenta igual que uno de *«fila viva»*. **El guard sigue siendo uno y los
de `R1` son SEIS**: lo que cambia es contra cuántas listas cuenta su segunda mitad. *(Este
renglón decía «cinco»; quedó caduco cuando `G-R1-F` entró en la misma tanda, y el conteo se
recalculó sobre la tabla de arriba.)*

**`G-R1-D` es el guard de la VENTANA**, que es el tercer momento: `A` vigila cómo nace la sucesión,
`C` cómo termina, y `D` lo que puede pasar **mientras dura**. Vigila dos escrituras opuestas y las
dos son de plata: reactivar a la predecesora con el cobro reciclado —que deja dos filas vivas con
el crédito de la sucesora ya computado en cero, y un período cobrado que `S17` se lleva puesto— y
reembolsar ese mismo pago **antes** de saber si la sucesión se consuma, que en la rama del
abandono le devuelve al cliente el pago que lo salvaba y lo manda a `SUSPENDED`. **El guard existe
porque la regla se ejecuta en cuatro lugares y no en uno**: `S5`, `S7`, el efecto de `MP1` y el de
`MP4`, y el camino que la olvide en cualquiera de los cuatro produce el daño entero. Se rompe a
propósito sacándole la condición a una sola de las cuatro.

**Y el tercer lugar sólo es real porque `S19` admite las dos puertas del pago.** Este guard
asume que el efecto de `MP1` **llega** a `S19`; mientras el evento de `S19` nombró sólo *«la
cuota que sigue en `recycling`»*, el pago manual no matcheaba ninguna fila, el intento caía en la
regla 1 y el guard vigilaba un camino que la tabla no dejaba recorrer — con el reloj del grace
corriendo igual sobre alguien que había pagado (cap. 03 §3.2). Un guard cuyo dominio la tabla no
puede satisfacer no está en rojo: está mirando a otro lado.

**El cuarto llegó con `MP4`, y es el que más fácil se olvida porque su origen no parece un pago
que reactive.** La reapertura de un `DECLARED_UNPAID` (cap. 03 §7.1) es un pago manual que entra
sobre una fila `SUSPENDED`, y si esa fila es la predecesora de una sucesión en curso, reactivarla
produce **el daño entero** de este guard: dos filas vivas con el crédito de la sucesora ya
computado en cero. Es la misma puerta de `MP1` con otro estado de origen, así que se vigila igual
y no necesita una regla propia — lo que necesita es **figurar**, porque un guard escrito sobre
tres caminos no mira el cuarto.

**`G-R6` es el guard de la COLUMNA MUERTA, y vigila una clase que ya costó un crítico de dinero.**
`MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura del corpus avanzaba esa
columna**, así que el pagador manual pagaba **una vez en la vida** y seguía cubierto para siempre
(`F-8eB1-002`). El defecto no es que la condición esté mal escrita: está perfectamente escrita y
**lee algo que nadie mueve**, que es un estado que ninguna lectura de la fila revela y ninguna
comparación del barrido detecta — los dos lados dicen lo mismo, porque el dato no cambió de
ninguno de los dos.

**Se verifica mecánicamente, y eso es lo que lo hace admisible.** Cruzar las columnas que una
condición **lee** contra las que alguna transición **escribe** es una comprobación **estructural**,
no un juicio: no hace falta entender qué significa la columna para saber si alguien la mueve. Es
la diferencia con el guard que `DEC-TEST-001` **rechazó**, abajo.

**Se rompe a propósito** sacándole a `S10` la escritura que avanza la fecha del próximo cobro
(cap. 03 §7.2, *«qué mueve la fecha del próximo cobro»*): esa columna queda con **dos** escritores
en vez de tres y el guard **sigue verde**, así que para ponerlo en rojo hay que sacarle **los
tres** — que es exactamente el estado en que `MP5` nació, y la prueba de que el predicado es
*«al menos una»* y no *«alguna que alguien recuerde»*.

**Y el corpus que recorre son las TABLAS DECLARADAS, no el subconjunto ya construido — sin esto el
guard nace en rojo sobre el camino normal.** *«Al menos una transición **del corpus**»* se puede
leer de dos maneras, y una de ellas lo vuelve inservible: el corpus son **nueve máquinas repartidas
en dos épicas que se construyen a lo largo de todo el programa**, así que una condición puede leer
una columna cuyo escritor llega en una unidad posterior. El caso está medido en este mismo catálogo:
**la fecha del próximo cobro tiene tres escrituras (cap. 03 §7.2) y una de ellas es `S10`, que
construye `B8`, mientras la condición que la lee es de `B5`** — con el dominio leído como *«lo ya
construido»*, el guard da **rojo durante `B5` → `B7` → `B8`**, tres unidades consecutivas del camino
crítico (`descomposicion.md` §3), **sobre código correcto**.

**Queda leído sobre las tablas que los capítulos declaran**, que existen completas desde antes de la
FASE 10, y por tres razones:

1. **Es el defecto que lo motivó, sin pérdida.** `F-8eB1-002` no fue una escritura que llegaba
   tarde: fue que **ningún lugar del diseño** avanzaba la columna que `MP5` leía. Ese defecto es
   visible sobre las tablas declaradas y el guard lo sigue atrapando entero.
2. **La otra lectura es la que alguien relaja.** Un guard que falla sobre el camino normal
   **exactamente durante la ventana en que nadie lo puede distinguir de un rojo real** es el mismo
   error que `G-R1-A` tenía leído como propiedad permanente, y está resuelto arriba de la misma
   manera: eligiendo el dominio sobre el que el predicado es verdadero cuando el sistema está bien.
3. **Y no le baja la fuerza**: sigue siendo una propiedad **del diseño** y no del avance, que es lo
   que la alternativa —acotarlo a las máquinas existentes en cada momento— le habría quitado.

**Lo que con esto NO verifica, dicho para que nadie lo lea de más**: que el escritor declarado esté
**implementado**. Una condición cuya escritura vive en una tabla que todavía es sólo un capítulo
**pasa en verde**, y eso es deliberado — la clase *«lo declarado no está construido»* es otra, no la
vigila este guard y **no la vigila ninguno**. Es el §2.1 sobre este mismo guard: el texto con que
falla no puede afirmar más de lo que el predicado verifica.

**Y su dominio son las NUEVE máquinas de las dos épicas, no las seis tablas de ésta.** Nació
acotado a billing porque el crítico que lo motivó era de billing y nadie planteó la extensión; la
ampliación del mismo día de `DEC-TEST-001` la tomó, y **no por simetría con `G-R4` y `G-R5`** sino
porque en verticales vive el candidato más fresco del corpus para exactamente este defecto:
**`listing.inactiva_desde`**, la columna que `DEC-DATA-002` creó ese mismo día y **lo que decide es
el borrado irreversible del contenido de una ficha**. La razón entera está escrita en `V/20` §2,
que es donde vive la columna; acá alcanza con decir que **el dominio del guard ya no es este
catálogo**. Termina, sí, siendo la tercera referencia cruzada del catálogo —`G-R4` y `G-R5` son
las dos anteriores, y `G-R6-B` la cuarta—, pero eso es la consecuencia y no el argumento.

**Y `G-R6-B` es el guard de LA LISTA de esa misma columna —sus dos mitades, con tres predicados—, que existe porque el
párrafo de arriba dejó dicho que `G-R6` no la cubre.** De los cuatro hechos que escriben
`listing.inactiva_desde` **sólo uno es una transición**, así que el predicado *«al menos una
transición la escribe»* queda verde por ése solo y los otros tres —el registro de eventos, la
respuesta del contrato y `vertical.fin_de_servicio`— **no los mira nadie**. Lo único que los
sostenía era la enumeración de `V/02` §2.5, y una lista cerrada sin guard es una promesa que este
programa ya rompió una vez. **Desde la cuarta enmienda vigila también la otra mitad de ese §, la de
los cinco consumidores**, porque **las dos fallan distinto y la segunda falla peor**: un lector no
inventariado **decide** con el reloj, y el lector más caro de esa columna es el hard delete del día
180. La enmienda lo aceptó con una condición que su fila repite: **el mensaje dice qué mitad
falló**, porque un guard con varios predicados y un solo texto afirma más de lo que verificó — la
misma regla con la que esta decisión rechazó el segundo guard, abajo. **Y sobre esa mitad vigila
las dos direcciones, que es lo que esta pasada le agregó**: la *(b)* rechaza un lector que el
inventario no nombra, y la *(c)* rechaza que uno de los **cinco declarados** haya dejado de leer —
el día que el hard delete del día 180 deje de leer la columna, el guard seguía verde y la lista
seguía diciendo que ese lector está ahí—. Para **escritores** la dirección simétrica sigue
rechazada, y con la razón de siempre: comprobar que un hecho tenga quien lo ejecute pide una
declaración, y un guard estático sólo puede comprobar que esté. **La razón entera, con sus
tres casos que lo hacen fallar a propósito —uno por predicado— y lo que sigue sin verificar, está escrita
en `V/20` §2**, que es donde vive la columna; acá alcanza con decir por qué figura en este catálogo:
**lo que puede romper la lista se escribe de este lado** —el cap. 10 §4.3 y el cap. 03 §7.1—, y un
quinto escritor agregado desde acá no obliga a abrir el capítulo de la otra épica. Es el mismo
argumento de `G-R5`, en la misma dirección.

**Y el SEGUNDO guard que esta tanda evaluó NO se agrega, con su razón escrita** (`DEC-TEST-001`).
Era *«toda fila con `desde` de conjunto declara cuántas escrituras tiene y en qué orden»*, y su
caso real es `F-8eB2-002`: `S20` copió de `S13` el *«idempotente y reanudable fila por fila»*
teniendo **dos** escrituras, sobre un argumento que supone una.

- **Vigila una convención de redacción** —*«declará tus escrituras»*— que un guard estático
  **sólo puede comprobar en su forma, no en su verdad**. Puede exigir que la fila **diga** cuántas
  escrituras tiene; **no puede verificar que sean ésas**.
- Sería **un guard que afirma más de lo que prueba**, y este capítulo ya tiene la regla escrita
  (§2.1): *«el texto con que falla no puede afirmar más de lo que el predicado verifica»*. Un
  guard así es **peor que no tenerlo**, porque declara cubierta una clase que no cubre.
- **Lo que queda sin vigilancia va declarado**: `S20` demostró que el error se comete **copiando
  de una fila que parece análoga**, y contra eso no hay comprobación estructural. Lo único que lo
  detecta es que alguien lea las dos filas juntas.

**Y `G12` y `G13` estaban definidos y fuera de este catálogo, que es el defecto que su llegada
cierra.** Vivían sólo en `B/descomposicion.md` §2, donde se numeraron *«para poder asignarlos a una
unidad»* con la nota *«si el `20` se reescribe, los absorbe»*. Un § que se presenta como *«la lista,
que es lo que permite preguntar «¿están todos?» una vez en vez de siete»* y deja dos afuera es un
**inventario que afirma completitud sin tenerla**, que es el patrón que la FASE 8-bis-4 encontró
cinco veces. Los dos entran **acá y no en `V/20` §2**, incluido `G13`: vigila el contrato, y el
consumidor del contrato es billing.

***El salto `G7` → `G9` no es un agujero, y conviene decirlo para que nadie lo busque.*** La
numeración `G1`-`G13` es **una sola, repartida entre las dos épicas**: `G1`-`G6` y `G8` están en
`V/20` §2, y `G7` más `G9`-`G13` están acá. Medido recorriendo las dos tablas, no deducido del
salto.

**Y el costo va con su cifra, recontada acá y no copiada.** Los guards de este programa **no corren
todavía** —son declaraciones en `B/20` §2 y `V/20` §2 hasta la FASE 10—, así que lo que decide si
alguno llega es que una unidad lo construya. Recontado sobre las dos tablas de catálogo y las dos
`descomposicion.md` el **2026-09-21**, sobre el árbol que deja el reparto de la **quinta enmienda**
de `DEC-TEST-001` —la que reparte los catorce sin unidad—, que es el último cambio de la serie:

| | cuántos | quiénes |
|---|---|---|
| filas de `B/20` §2 | **16** | `G7` `G9` `G10` `G11` `G12` `G13` · los **seis** de `R1` · `G-R4` `G-R5` `G-R6` `G-R6-B` |
| filas de `V/20` §2 | **17** | `G1`-`G6` `G8` · `G-R2` `G-R2-B` · `G-R3` `G-R3-B` `G-R3-C` · `G-R4` `G-R4-B` `G-R5` `G-R6` `G-R6-B` |
| **guards distintos** | **29** | 16 + 17 menos las **cuatro** referencias cruzadas: `G-R4`, `G-R5`, `G-R6` y `G-R6-B` |
| **con unidad que los construya** | **29** | los **15** que ya la tenían — `G1` `G3` `G8` (`V1`), `G2` `G4` `G6` (`V5`), `G5` y `G-R6-B` (`V6`), `G9` `G10` `G11` `G12` (`B1`), `G7` (`B2`), `G13` (`B4`), `G-R5` (ver abajo) — más los **14** que reparte la quinta enmienda: `G-R3` (`V2`), `G-R2` `G-R2-B` (`V3`), `G-R4` `G-R4-B` `G-R6` (`V4`), `G-R3-B` `G-R3-C` (`V5`), `G-R1-A` `G-R1-B` `G-R1-E` `G-R1-F` (`B3`), `G-R1-D` (`B7`), `G-R1-C` (`B8`) |
| **sin unidad** | **0** | y es la primera vez en la serie. El reparto, unidad por unidad y con su razón medida, está en `V/descomposicion.md` §2.6 y en `B/descomposicion.md` §2.8 |

**`G-R5` cambió de unidad y no de estado: era el único contado *«con unidad»* sin nombrarse.** La
celda de `V9` decía *«el de `D16`»* —por su invariante y no por su id— y `F-8eC2-004` midió que
estaba **en la épica equivocada**: el número que puede romperlo es el tope de pausa del cap. 03 §5
de esta épica, que construye **`B8`**, y `V9` corre antes de que ese número exista. Desde el reparto
de la quinta enmienda **lo construye `B8`, nombrado por su id** (`B/descomposicion.md` §2.8, y el
retiro de la celda en `V/descomposicion.md` §2.7). El conteo no se mueve por esto; lo que se mueve
es que el guard ahora puede fallar.

**Dónde vive el reparto, y por qué no se copia a cada fila de esta tabla.** La asignación de unidad
la hacen **las dos `descomposicion.md`**, que son los documentos que reparten trabajo; este § es el
catálogo, y *«el catálogo cataloga, no reparte trabajo»* (`B/descomposicion.md` §2.1). Las cuatro
filas que igual nombran su unidad —`G12`, `G13`, `G-R6-B` y `G-R5`— lo hacen como **referencia
cruzada** y no como fuente: las tres primeras porque su unidad está del otro lado de donde uno la
buscaría, y `G-R5` porque **su asignación ya estuvo mal una vez** y el catálogo es donde se lee
primero.

**Lo que movió la tanda del cierre de guards, y movió a mejor**: los **sin unidad siguieron siendo
catorce** —agregar `G12` y `G13` no suma ninguno, porque los dos **sí** tienen unidad, y la fila de
`G-R6` en `V/20` §2 es una referencia cruzada y no un guard más—, y el denominador pasó de **26** a
**28**: de **14 de 26** a **14 de 28**. Es lo contrario de lo que se temía al escribirlo.

**Y lo que movió `G-R6-B`, medido igual y no deducido**: el denominador pasa de **28** a **29** y
los sin unidad **quedaron en catorce**, porque este guard **nace con unidad** —`V6`, la que
construye la columna y las escrituras de `V/02` §2.5 y `V/03` §9— en vez de sumarse a los `G-R*`
huérfanos. **14 de 28 → 14 de 29.** Los **dos** guards que la FASE 9-bis-4 había agregado antes
—`G-R1-F` y el propio `G-R6`— **nacieron los dos sin unidad** (medido en `DEC-TEST-001`, no acá), y
éste no; no es mérito de nadie, es la regla 1 de las descomposiciones —*«cada guard va con la pieza
que protege, nunca al final»*— aplicada **en el acto de escribirlo**, que es el único momento en que
sale gratis. **Cuál es la pieza está discutido en `V/descomposicion.md` §2.5**, porque había dos
candidatas.

> **Los dos párrafos de arriba miden las tandas ANTERIORES al reparto y se dejan como están.** Su
> *«catorce»* es correcto para su momento y **es el número que la quinta enmienda vino a mover**:
> la cuenta viva es la de la tabla, **14 de 29 → 0 de 29**. Se anclan en vez de reescribirse por la
> misma razón por la que `DEC-TEST-001` ancló su cifra: son mediciones de un momento, y reescribir
> una medición vieja para que describa el presente es lo que hizo falsa la cifra que esa entrada
> traía.

**Y la cifra que este § traía —*«12 de 26»*, *«13 de 27»*— estaba caduca por dos razones
independientes, las dos medidas acá.** La primera: el **26** de `C2` (FASE 8-bis-4, `F-8eC2-004`,
sobre `635a2699f`) era la **unión** de los catálogos **más** `G12` y `G13` leídos de la
descomposición —`B/20` §2 listaba once ese día—, así que no era comparable con un conteo de
catálogo. La segunda, y es la que la vuelve falsa: desde esa medición entraron al catálogo **dos
guards más y los dos sin unidad** —`G-R1-F` y el propio `G-R6`—, así que **sin unidad son catorce y
no doce** desde antes de que esta tanda tocara nada. El *«13 de 27»* no describió ningún estado del
corpus en ningún momento.

`DEC-TEST-001` acepta el costo porque la alternativa —no escribir el guard— garantiza que no llegue
a la FASE 10.

### 2.1 Un guard se prueba rompiéndolo

**Todo guard de esta lista lleva un caso que lo hace fallar a propósito.** No es rigor de más: un
guard que no puede fallar es un comentario con exit code 0, y no hay forma de distinguirlo de uno
que funciona salvo rompiéndolo.

Vale igual para el mensaje: **el texto con que falla no puede afirmar más de lo que el predicado
verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo mira una forma
sintáctica está mintiendo con precisión, que es peor que no estar.

---

## 3. El proveedor falso tiene que mentir

### 3.1 La tesis

El §62.2 dice que *«la gran mayoría de escenarios se prueba contra provider falso/controlado»* y
no dice **cómo se comporta** ese falso. Si se lo escribe con el comportamiento razonable —acepta y
aplica, rechaza y explica, avisa cuando algo cambia— **se está probando el código contra un
proveedor que no tenemos.**

El capítulo 06 (épica de billing) y la matriz midieron lo contrario, repetidamente: **este
proveedor acepta y no aplica, responde `2xx` sobre operaciones que descarta, y avisa de cosas que
sus propios datos desmienten.**

> **El stub no simula al proveedor: reproduce sus mentiras medidas.** Cada una está fechada y con
> su fila; ninguna es una hipótesis sobre cómo podría fallar.

### 3.2 Las mentiras que el stub tiene que poder hacer

| lo que hace el proveedor real | fila |
|---|---|
| mutar el monto **no emite ningún webhook** — nos enteramos releyendo o no nos enteramos | `EX-15` |
| un `PUT` mixto **se aplica a medias**, con `200` | `EX-20` |
| la **fecha** de una suscripción viva es inmutable: cuatro formas de pedirlo, cuatro `200`, cero cambios | `EX-34` |
| **estando pausada rechaza toda modificación** con `400`, pero sí deja cancelar | `EX-11` |
| el campo `items` devuelve `201` y **se descarta en silencio** | `EX-5` |
| el `search` **ignora** nuestra referencia y devuelve todo; con un `status` inválido devuelve `200` y cero; y con `status=cancelled` devuelve **un subconjunto plausible** — 15 de 69 | `RC-1`, `RC-4` |
| el `init_point` **viene roto** | `EX-37` |
| el token de tarjeta es de **un solo uso** | `EX-12` |
| el cobro llega **tarde y con retraso variable**: ~26 min en producción, 33 medidos en sandbox | `PA-3` |
| le **escribe al cliente por su cuenta y primero**, en el alta, el cambio de monto, la pausa y la cancelación — y tres de esos correos afirman cosas falsas | `EX-3` |
| el reembolso idempotente devuelve **`200` y no `201`**, con **cuerpo vacío** | `RF-6` |
| `X-Idempotency-Key` es obligatoria y falla **antes** de toda validación de negocio | `RF-4` |
| hay un **rechazo sin explicar**: sobre el mismo pago, ARS 5 se rechaza con `2084` y ARS 14 entra | `RF-8` |
| piso **ARS 15**, techo **ARS 2.000.000**, con los mensajes exactos | `PC-2` |
| otra moneda da `400` | `EX-18` |

**El retraso variable del cobro merece su propia línea** porque es el que más código rompe: un
test cuyo cobro llega en el mismo instante en que vence el período **nunca ejecuta** el camino que
en producción se recorre siempre. El stub tiene que poder llegar tarde, y la suite tiene que
tener casos donde llega tarde.

### 3.3 Y de ahí sale qué es un escenario de carrera

El §62.1 pide cubrir *«races»* sin decir cuáles. Los seis cruces de concurrencia ya están
enumerados en el capítulo 05 (épica de billing), y la lista de arriba agrega los que sólo existen
porque el proveedor se comporta así: el cobro que llega después de suspender, la mutación que se
acepta y no se aplica, el webhook que no llega nunca, y el cliente que recibe el correo del
proveedor **antes** que el nuestro.

---

## 4. La suite de sandbox es chica, y prueba otra cosa

El §62.3 la pide *«más pequeña pero obligatoria»* y dice que *«verifica assumptions e integración
real»*. Conviene ser exacto sobre qué significa eso acá, porque no es lo mismo que probar nuestro
código:

**la suite de sandbox es una suite de regresión sobre la matriz de validación, no sobre el
sistema.**

`S-METH-01` fijó que **toda medición caduca cuando cambia el hecho que mide**, y no hay forma de
enterarse de que el proveedor cambió salvo volviendo a medir. Las mentiras del §3.2 son el
contrato con el que está escrito todo el código de proveedor: **si una deja de ser cierta, el
stub queda mintiendo de una forma que el real ya no tiene, y toda la capa de dominio pasa a estar
verificada contra una ficción.**

Entonces la suite de sandbox corre **las filas de la matriz**, no los casos de uso. Es chica
porque son pocas filas las que sostienen decisiones, y es obligatoria porque es lo único que
convierte a `S-METH-01` de una advertencia en un control.

**Con dos límites que el capítulo 06 (épica de billing) ya fijó y que valen igual acá**: guard de
entorno y guard de presupuesto — una sonda que pueda correr contra producción por error, o gastar
más de lo autorizado, no se ejecuta.

---

## 5. E2E: lo que hoy se hace a mano

El §62.4 lo dice sin ambigüedad: *«el objetivo es que cambios futuros no obliguen a repetir
manualmente todo billing»*. Los flujos críticos son los que mueven plata o cortan servicio:

1. alta y autorización de una suscripción, incluido **el checkout abandonado** que muere a las
   72 h (cap. 03, S3);
2. el ciclo completo de **impago**: cobro fallido → grace → suspensión → regularización;
3. **cambio de plan** y **cambio de ciclo**, que no son el mismo mecanismo (`DEC-SUB-006`,
   `DEC-SUB-007`, `DEC-SUB-008`);
4. **pausa** y reanudación, las dos formas: al vencer y anticipada;
5. **cancelación** con servicio sostenido hasta el fin del período (`DEC-SUB-009`);
6. **revocación**: reembolso total más cancelación en un solo acto (`DEC-RF-001`);
8. **contratación y vencimiento de un addon**, con el excedente que dispara.

**Lo que E2E no reemplaza** es el smoke contra el proveedor real: el §62.3 existe porque el stub y
el real pueden divergir, y un E2E que corre contra el stub hereda esa divergencia entera.

---

## 6. Una regla que atraviesa las cuatro capas

**Ninguna aserción se escribe sobre un código de estado.** Está medido nueve veces que este
proveedor devuelve `2xx` sobre operaciones que no aplicó (`D5`, cap. 04, núcleo). Un test que
afirma *«devolvió 200»* pasa exactamente igual con la operación aplicada y sin aplicar, que es la
definición de un test que no prueba nada.

**Se afirma sobre el estado releído**, campo por campo — que es la misma regla que el invariante
`D5` le impone al código de producción. El test y el sistema comprueban lo mismo de la misma
forma, y no por elegancia: si el test pudiera conformarse con menos, sería el test el que deja
pasar lo que el sistema no.
