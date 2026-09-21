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
| G-R1-A | **el camino que declara una sucesión** escribe `sucede_a` apuntando a una predecesora que **en ese acto** está fuera de `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, o a una que a su vez tenga `sucede_a` no nulo | cap. 02 §2.2, cap. 03 §3.2 (`S1`) |
| G-R1-B | una fila con `sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización, **o esa fecha no es la que el proveedor confirmó** | `D8`, cap. 12 §5.2, cap. 02 §2.2 |
| G-R1-C | un camino escribe **`sucedida_por` sin limpiar `sucede_a`**, o limpia **`sucede_a` sin escribir `sucedida_por`**, o **cierra una sucesión dejando algo colgando de la predecesora**: un complemento o la **redención de promo** sin re-apuntar, **o una cortesía vigente sin cerrar y sin `saldo_días`** —ésa **no** se re-apunta, `DEC-GRANT-007`—, o un **pago pendiente por `S19` sin una marca `requiere_conciliación` abierta con motivo `REEMBOLSO_POR_CONFIRMAR`** —la marca sin el motivo **pasaba el guard y no ordenaba nada**—; **o `S25` mata una `PAUSED · COURTESY` con días sin entregar y no le escribe el `saldo_días`** (`DEC-GRANT-010`) | `D15`, cap. 03 §3.2 (`S18` y `S25`), cap. 02 §2.2, §2.5 y §2.6, `DEC-RF-002` |
| G-R1-D | un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o **el de `MP4`**— que en ese instante es la **predecesora de una sucesión en curso** (tiene una sucesora **viva** con `sucede_a` apuntándola), o **reembolsa** el pago que quedó pendiente por `S19` **antes** de que la sucesión se resuelva | cap. 12 §5.3, cap. 03 §3.2 (`S5`, `S7`, `S19`) y §7.1 (`MP4`), cap. 05 §3 condición 3 |
| G-R1-E | un **predicado sobre `sucede_a`** —en la columna *condición* de una transición, en el enunciado de un invariante o en otro guard— pregunta si **hay una fila apuntando** sin exigir que esa fila **esté viva**; o un consumidor nuevo de *«fila viva»*, *«grant vivo»* o *«ancla viva»* **no figura** en el inventario que le corresponde en `NUCLEO/01` §2.4 —son **dos** inventarios y cada término va al suyo—; **o enumera el conjunto del sujeto equivocado** —los seis de la suscripción sobre una instancia de addon, o los dos de la instancia sobre una suscripción— | `NUCLEO/01` §2.4 reglas 2 y 3, cap. 02 §2.2, cap. 03 §3.2 (`S17`, `S19`, **`S20`** — el único que nombra **los dos** sujetos en un mismo predicado — y **`S21`**, que nombra la suscripción por su conjunto **vivo** y la instancia por un estado **terminal**, que es el caso en que el guard tiene que no pedir la enumeración de los dos) y §8 (`A5`) |
| G-R1-F | un camino **abre la marca `requiere_conciliación` sin nombrar un motivo** de la enumeración cerrada del cap. 02 §2.5, o nombra **uno que no está en esa tabla**; o un camino **levanta** la marca sin decir **cuál** de las abiertas; o el **listado accionable** (cap. 19 §4) la muestra **sin motivo, sin `puesta_en`, o sin el pago** cuando el motivo es uno de los cuatro que devuelven plata; **o un consumidor nuevo de *«marca abierta»* (`NUCLEO/01` §2.5) o de *«cortesía diferida»* (§2.6) no figura** en su inventario —son el **tercer** y el **cuarto** inventario del glosario y **ninguno** es de `G-R1-E`— | cap. 02 §2.2 y §2.5, cap. 03 §3.2 (`S14`, `S15`, `S18`), cap. 09 §3, cap. 19 §4, `NUCLEO/01` §2.5, `DEC-RF-002` |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** | cap. 03 §1 regla 7 (núcleo). **Referencia cruzada**: lo define `V/20` §2 y cubre las **seis** tablas de esta épica. El catálogo de guards es una sola numeración partida en dos capítulos, así que un guard del núcleo tiene que figurar en los dos o la mitad de su dominio queda sin vigilar en el papel |
| G-R5 | el **tope de una pausa** que declara el catálogo —cap. 03 §5 de **esta** épica—, pasado a días, **alcanza el día del hard delete** de la retención (`V/02` §4.1) | `D16` (cap. 04 §3, núcleo). **Referencia cruzada**: lo define `V/20` §2. Figura acá porque **el número que puede romperlo es de esta épica**: si alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin verlo |

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
de `R1` siguen siendo cinco**: lo que cambia es contra cuántas listas cuenta su segunda mitad.

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
