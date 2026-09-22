---
title: Descomposición de la épica de verticales
linear: HOS-1353
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
---

# Descomposición de HOS-1353

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.

## 1. El criterio de corte

**Se corta siguiendo la cadena de preguntas del diseño**, no por capa técnica ni por capítulo.

Cortar **por capa** —toda la base, después todos los servicios, después la API— tiene el problema
conocido: nada funciona hasta el final, y el primer error de modelado se descubre cuando ya hay
tres capas encima. Cortar **por capítulo** es peor: los capítulos son ejes de diseño y se cruzan —
el `02` toca todo, el `15` y el `17` se necesitan mutuamente.

La cadena que sí ordena es la del propio sistema, y cada eslabón deja **una pregunta contestada**:

```text
¿qué verticales y qué claves existen?      → V1
¿qué otorga un plan?                        → V2
¿qué puede hacer esta cuenta?               → V3
¿tiene título vivo?                         → V4
¿puede hacer ESTO, acá y ahora?             → V5
¿qué pasa cuando algo baja?                 → V6
```

Las tres últimas —Partner, superficies, retención— no están en la cadena porque **no la
condicionan**: se apoyan en ella.

### 1.1 Dos reglas que valen para las nueve

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después es un
   guard que se escribe contra código ya escrito, y para entonces ya hay call sites que lo
   violan. Y cada uno **lleva su caso que lo hace fallar a propósito** — un guard que no puede
   fallar es un comentario con exit code 0.
2. **Ninguna unidad pregunta por dinero.** Si una lo necesita, es señal de que el corte de
   `DEC-ARCH-005` se está filtrando: se mira, no se resuelve en el lugar.

---

## 2. Las nueve unidades

| # | unidad | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|
| **V1** | **El catálogo y su doble guard** | el enum de verticales, su espejo en base, y el catálogo de claves de entitlement y limit en código | `02` §1 (núcleo) · `10` §1 | `G1` `G3` `G8` |
| **V2** | **El catálogo de planes** | `plan`, `plan_version` y sus entitlements y limits, con `rank`, vigente y vendible | `02` §2.1 · `10` §2 | **`G-R3`** |
| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación | `15` §1–3 · `02` §3 | **`G-R2`** **`G-R2-B`** |
| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde | `11` entero · `03` §2 · `02` §2.2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) | **`G-R4`** **`G-R4-B`** **`G-R6`** |
| **V5** | **La autorización** | ninguna operación se ejecuta sin pasar por los nueve pasos | `17` entero | `G2` `G4` `G6` **`G-R3-B`** **`G-R3-C`** |
| **V6** | **Publicación y excedente** | una ficha se publica, cae al perder cobertura, vuelve al recuperarla **—también desde `ARCHIVED`: sola por `PB7`, o a pedido del dueño por `PB8`, que la versión de piso le autoriza—**, y el excedente se resuelve solo **en las dos direcciones**: cae lo más reciente primero y **vuelve primero lo que cayó al final**, con el criterio escrito en los dos avisos | `03` §9 · `02` §2.5 · `15` §4 | `G5` **`G-R6-B`** |
| **V7** | **Partner** | la postulación con su máquina, la presencia como entitlement booleano, y el reclamo por correo | `18` entero · `03` §11 | — |
| **V8** | **Superficies** | Mi Cuenta, los mensajes que hay que decir, el panel de postulaciones | `19` | — |
| **V9** | **Retención** | el reloj de 90 y 180 días **con sus cuatro hechos de reinicio**, la anonimización, el hash del correo y los **tres** avisos | `02` §4 · `22` §3 · `01` §1.2 (núcleo) | — *(decía «el de `D16`», que era `G-R5`; se va a `B8` — §2.7)* |

### 2.1 Por qué V1 va primero aunque parezca infraestructura

Porque **dos de sus tres guards** son **los únicos que no se pueden agregar después sin reescribir lo
anterior**. `G1` prohíbe nombrar una vertical fuera de los ocho ítems del Eje 2 y `G3` verifica el
catálogo de claves **en las dos direcciones**. Si llegan en V5, para entonces hay cinco unidades
de código que los violan y el guard nace con una lista de excepciones — que es exactamente cómo
un guard deja de servir.

### 2.2 Por qué el trial y el contrato son la misma unidad

Porque **el trial es la implementación de arranque del contrato** (`DEC-ARCH-006`). Separarlos
dejaría el puerto sin ninguna fuente que lo responda de verdad, y ahí la única opción sería un
simulacro que contesta siempre lo mismo — que es justo lo que la decisión descartó, porque **deja
sin ejercer la mitad interesante: perder la cobertura**.

### 2.3 Hay un guard de V4 que NO nace en V4, y nace del otro lado

*(Este § decía *«esta tabla dejó a V4 sin guards»*, y desde el reparto del §2.6 V4 tiene tres:
`G-R4`, `G-R4-B` y `G-R6`. Lo que sigue valiendo entero es el caso de `G13`, que es de otra
naturaleza: es un guard **sobre** lo que V4 construye y que **no puede nacer acá**.)*

El que le correspondía a V4 y no podía nacer en V4 lo encontró la descomposición de billing:
**`G13`**, la tercera defensa del
[contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3 — *«un
guard impide que la implementación de arranque llegue a producción»*.

**No puede nacer acá.** Mientras la de arranque es la única implementación que existe, un guard que
prohíba su llegada a producción **falla desde el primer día**, y un guard que falla desde el primer
día nace con una lista de excepciones — que es exactamente el argumento del §2.1, leído al revés.

Nace en **B4** de la otra épica, que es donde aparece la segunda implementación. Queda anotado acá
para que nadie lo lea como un olvido.

### 2.4 Por qué el excedente va con publicación y no con entitlements

El reconciliador se define en el `15` §4, pero **lo que hace es despublicar**, y su criterio —cae
lo más reciente primero— sólo se puede verificar con fichas de verdad. Construirlo en V3 sería
escribirlo sin poder probarlo.

### 2.5 `G-R6-B` va con V6 y no con V9, y las dos candidatas eran razonables

`G-R6-B` (`20` §2) falla si **algo toca `listing.inactiva_desde` desde un lugar que las listas
cerradas no nombran**: una **escritura** que no sea uno de los cuatro hechos del `01` §1.2 (núcleo),
o una **lectura** que no figure entre los cinco consumidores del `02` §2.5 (cuarta enmienda de
`DEC-TEST-001`). Las dos unidades que lo podían reclamar son **V6**, que crea la columna
(`02` §2.5) y **escribe** en ella —`PB1`, `PB3` y `PB7` son el tercer hecho, y la relectura de
`PB4`/`PB5` es el segundo momento del segundo (`02` §4.2 regla 4)—, y **V9**, que es la dueña del
`01` §1.2 y del reloj que la **lee**.

**Va con V6 por la regla 1 leída entera**: el guard protege **las piezas que tocan la columna**, no
las listas como texto, y **V6 es la unidad donde nacen las primeras** — la columna, sus escrituras
y los dos lectores que archivan. Y por el argumento del §2.1 leído sobre el orden real: **V9
depende de V4 y V6** (§3), así que un guard que llegue con V9 llega **después de todos los
escritores que existen**, que es la definición de *«un guard que se escribe contra código ya
escrito»*. Puesto en V6, lo que puede aparecer después es **una pieza nueva** — que es exactamente
lo que viene a rechazar.

**Y la mitad de lectores refuerza la elección en vez de moverla, aunque sus consumidores nazcan
tarde.** De los cinco, `PB4` y `PB5` son de V6; el día 180 y los dos avisos previos son de **V9**;
la fecha que se le imprime al cliente es de **V8**. Un guard que naciera con el último de ellos
llegaría cuando los cinco ya existen y **nacería con lista de excepciones**; naciendo en V6 ve
llegar a los tres de afuera **uno por uno**, y cada uno tiene que traer su fila al `02` §2.5 para
pasar. Es el caso de libro del §2.1, con lectores en vez de escritores.

**Lo que V9 conserva es su parte**: la lista del `01` §1.2 es su capítulo y el guard la cita; si
alguien agrega un quinto hecho, **el cambio es de V9 y el rojo lo da el guard de V6**. Es la misma
forma de `G13`, que vigila el contrato de V4 y nace en `B4` (§2.3): **dónde se construye un guard y
qué documento define su lista son dos preguntas distintas.**

### 2.6 Los ocho guards de esta épica que no tenían unidad, y por qué cada uno cae donde cae

La columna de arriba dejaba **ocho** guards de `V/20` §2 sin ninguna unidad que los construya, y
`C2` lo venía reportando **tres vueltas seguidas** (`F-8dC2-003` → `F-8eC2-004`). La **quinta
enmienda de `DEC-TEST-001`** decide repartirlos ahora, con tres condiciones que gobiernan lo que
sigue: **la razón va medida y con cita**, **la unidad nace ANTES o CON lo que el guard vigila** —el
criterio del §2.5, que es el que `G-R5` violó— y **lo que no tiene unidad clara se declara sin
dueño**. Los ocho tienen unidad medida; lo que queda abierto está en el §2.8 y son preguntas, no
asignaciones faltantes.

| guard | unidad | qué construye esa unidad que hace que el guard pueda existir ahí |
|---|---|---|
| **`G-R3`** | **V2** | las **dos versiones no vendibles** que el guard vigila — son `plan_version`, y `02` §2.1 es capítulo de V2 |
| **`G-R2`** | **V3** | **la resolución**, que el propio `15` §2.6 declara *«el sujeto del guard»* |
| **`G-R2-B`** | **V3** | **el trinquete por vertical** del `GRANT`, que se compara adentro de esa misma resolución (`15` §2.5) |
| **`G-R4`** | **V4** | **la primera tabla de transiciones del programa**: la de trial, `03` §2 |
| **`G-R4-B`** | **V4** | esa misma tabla **y el contrato** cuyo §4 el guard hace cumplir |
| **`G-R6`** | **V4** | la misma primera tabla — mismo dominio que `G-R4` |
| **`G-R3-B`** | **V5** | **la clase** *«transición disparada por el reloj»*, que `17` §3.4 declara |
| **`G-R3-C`** | **V5** | **el paso 5** y la declaración que el guard lee, que `17` §3.5 pide con todas las letras |

**`G-R3` va con V2 porque su sujeto nace ahí y no antes.** El guard sale de `02` §2.1, que es
capítulo de V2, y lo que vigila son **las dos versiones no vendibles** —la de pre-trial y la de
piso—, que son `plan_version`: exactamente lo que V2 deja funcionando (*«`plan`, `plan_version` y
sus entitlements y limits, con `rank`, vigente y vendible»*). Antes de V2 no hay ninguna versión
que se pueda sembrar mal, así que el guard **nace con su sujeto y no contra él**. Y V2 es la
**segunda** unidad del §3, con lo cual todo lo que después lee esas versiones —la resolución de
V3, el paso 5 de V5, y la reactivación desde `ARCHIVED` *«que la versión de piso le autoriza»*
(§4, fila V5)— llega **uno por uno**. Importa que sea temprano por lo que el catálogo dice de este
guard: *«es el que más carga lleva … si alguien siembra una de esas dos versiones con una clave
comercial, toda la plataforma la recibe gratis, para siempre»* (`V/20` §2).

**`G-R2` va con V3 porque el capítulo que lo crea nombra su sujeto.** `15` §2.6 cierra diciendo
*«Se comprueba sobre la resolución y no sobre cada call site, porque `V/17` §1.3 ya obliga a que
los pasos se resuelvan en un solo lugar; **ese lugar es el sujeto del guard**»*. Ese lugar —el
pliegue del conjunto efectivo y sus cuatro estrategias— **lo construye V3** (`15` §1–3). Fuera de
V3 el guard no tiene dónde pararse: no es una propiedad de los call sites.

**`G-R2-B` va con V3 por el mismo capítulo, y su consumidor llega de la otra épica.** `15` §2.5
termina con *«Lo vigila `G-R2-B` (`V/20` §2)»*, y lo que vigila es el **trinquete por vertical** de
la fuente `GRANT` —*«toma la fuente `GRANT` de esa vertical … y ninguna otra»*—, que se compara
*«al final»* dentro de la resolución. La fuente `GRANT` la enchufa **B9** de la otra épica, que en
`B/descomposicion.md` §3 está después de `B7 → B8`: naciendo en V3 el guard **ve llegar al grant**
en vez de heredarlo escrito.

**`G-R4` va con V4 porque V4 construye la primera de las nueve máquinas.** El guard vigila *«las
nueve máquinas, en las dos épicas»*, y esta épica tiene tres: trial (`03` §2, **V4**), publicación
(`03` §9, V6) y postulación de Partner (`03` §11, V7). La más temprana del §3 es la de V4, y las
**seis de billing** no compiten por ser primeras: `DEC-ARCH-005` parte el programa en dos épicas
donde verticales *«arranca»* y billing *«espera»*, y `B/descomposicion.md` §2.3 mide que hoy *«lo
único que arranca es B2 y la interfaz de B1»*, ninguna de las dos con tabla de transiciones. Y el
par que el guard cuenta nace ahí mismo: de los **cuatro** pares con dos destinos que el diseño
declara hoy, `T1`/`T6` es de esta máquina y los otros tres —`S5`/`S19`, `S7`/`S19`, `S10`/`S25`—
son de la tabla de suscripción, que construyen B7 y B8 (`B/20` §2). Naciendo en V4 el guard ve
llegar **ocho tablas una por una**; naciendo en cualquier otro lado nace contra tablas ya escritas.

**`G-R4-B` va con V4 porque el defecto que lo motivó es de la propia máquina de V4.** El guard
falla si una máquina **de esta épica** nombra un estado de la suscripción, y sale del §4 del
contrato — que **lo trae V4** (su fila del §2 lo lista entre sus capítulos). El caso es `T6`:
estaba escrita sobre *«una suscripción viva»*, *«un predicado que el §4 del contrato le prohíbe
evaluar al lado que tiene que evaluarlo»* (`V/20` §2). Las otras dos máquinas de la épica son de V6
y V7, las dos posteriores a V4 en el §3.

**`G-R6` va con V4 por el mismo orden, y hay una razón propia por la que ahí es seguro.** Su
dominio es el mismo de `G-R4` —*«las nueve máquinas, en las dos épicas»*— así que la primera tabla
del programa es el lugar que la regla 1 pide. Lo propio es esto: su predicado es **global**
(*«exige que al menos una transición **del corpus** las escriba»*), y un predicado global evaluado
sobre un corpus a medio construir puede dar **rojos falsos**. Con las máquinas de esta épica no
puede: el §4 del contrato le prohíbe a una máquina de verticales leer del otro lado —que es
justamente lo que `G-R4-B` hace cumplir—, así que **ninguna condición de V4, V6 o V7 lee una
columna que sólo escriba billing**. Eso vuelve a la primera tabla un lugar seguro para nacer, y no
sólo el más temprano. Lo que el predicado global sí deja abierto está en el §2.8, como pregunta.

**`G-R3-B` va con V5 porque antes de V5 no hay nada que leer.** La **clase** que vigila —*«las
transiciones disparadas por el reloj»*, y que *«nunca otorga»*— la declara `17` §3.4, y `17 entero`
es de V5. El capítulo además insiste en que *«la clase se declara transición por transición, nunca
se infiere»*: **la declaración es el mecanismo, y el mecanismo lo construye V5**. El caso que el
capítulo usa, `T3`, es de la máquina de V4 y ya existe cuando V5 llega — y **no es una excepción
heredada**, porque lo que V5 construye es el acto de clasificar, y `T3` se clasifica al
construirlo. Los relojes que vienen después —`PB4` y `PB5` de V6, el de retención de V9, y los de
billing— llegan uno por uno.

**`G-R3-C` va con V5 porque el capítulo de V5 lo pide con todas las letras.** `17` §3.5 lo enumera
como su tercera parte —*«Un guard que lo hace cumplir: toda operación de dominio **declara** si
pasa por el paso 5, y el build falla si alguna no lo declara»*— y explica por qué no puede llegar
después: *«sin él, alguien agrega una operación dentro de ocho meses, no se pregunta nada, y nadie
se entera — la fábrica de exenciones por ruta»*. El paso 5 y los otros ocho son de V5, y la
enumeración que el guard vuelve completa *«se arma sola a medida que se construyen las
superficies»*, que son V8 y B13: las dos posteriores.

### 2.7 `G-R5` se va a `B8`, porque la celda de `V9` estaba en la épica equivocada

`F-8eC2-004` lo reportó y **se confirma recorriendo los dos grafos del §3**. La celda de `V9` decía
*«el de `D16`»* —o sea `G-R5`, nombrado por su invariante y no por su id— y el guard compara **dos
cifras de configuración**: el **tope de una pausa**, que declara `B/03` §5 (*«**4 pausas-mes** por
pausa»*), y el **día del hard delete**, que declara `V/02` §4.1. De las dos, la que `V9` construye
es la segunda: sus capítulos son `02` §4, `22` §3 y `01` §1.2 (núcleo), y **`B/03` §5 no está entre
ellos**. El catálogo de billing ya lo había advertido por escrito, doce líneas antes de que la
celda se escribiera: *«Figura acá porque **el número que puede romperlo es de esta épica**: si
alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin
verlo»* (`B/20` §2).

**Y el orden no lo deja mal ubicado: lo deja inejecutable.** `V9` corre *«una vez que estén V4 y
V6»* (§3), temprano y sin esperar a billing; el tope lo construye **B8**, que en
`B/descomposicion.md` §3 está después de la bisagra —`B1 → B3 → B5 → B7 → B8`— y después de todo
lo que espera a la pasarela. El guard se construiría **antes que el número que compara**, y ahí no
llega tarde: llega tan temprano que **no tiene contra qué fallar**, que es *«un comentario con exit
code 0»* — la regla 1 de esta descomposición leída al revés.

**Va a `B8`, que es la unidad que construye el tope**, y la razón entera, del lado que lo
construye, está en `B/descomposicion.md` §2.8. Es la misma forma de `G13` (§2.3) y de `G-R6-B`
(§2.5) con el eje cambiado: **dónde se construye un guard y qué documento declara sus números son
dos preguntas distintas.** `V9` conserva lo suyo — el día 180 es de su capítulo y el guard lo cita;
si alguien mueve ese número, **el cambio es de `V9` y el rojo lo da el guard de `B8`**.

### 2.8 Lo que el reparto deja abierto, y es una pregunta y no un hueco

**`G-R6` tiene un predicado global y el corpus se construye por partes.** El guard exige que *«al
menos una transición **del corpus** escriba»* cada columna que una condición lee, y el corpus son
nueve máquinas repartidas en dos épicas que se construyen a lo largo de todo el programa. Del lado
de verticales eso es inofensivo (§2.6), pero del lado de billing **una condición puede leer una
columna cuyo escritor llega en una unidad posterior** — el caso medido está en el propio catálogo:
la fecha del próximo cobro tiene **tres** escrituras (`B/03` §7.2) y una de ellas es `S10`, que es
de B8, mientras la condición que la lee es de B5. Entre B5 y B8 el guard daría **rojo sobre el
camino normal**, que es lo que la fila de `G-R1-A` describe como *«un guard que alguien va a
relajar»*.

**No se resuelve acá, y a propósito.** Resolverlo sería decidir **qué comprueba** el guard —por
ejemplo, acotar el corpus a las máquinas ya construidas—, y eso es cambiar su enunciado, no su
dueño. **Queda como pregunta para el owner**, con las dos salidas que se ven: que el guard evalúe
sobre las máquinas existentes en cada momento, o que su rojo sea informativo hasta que las nueve
estén. La asignación a V4 no depende de cuál se elija: en las dos, la primera tabla sigue siendo el
lugar más temprano donde puede nacer.

---

## 3. El orden, y qué se puede hacer en paralelo

```text
V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6 ──► V8
                                └──► V7 ──┘
                      └──────────────► V9
```

| | |
|---|---|
| **camino crítico** | `V1 → V2 → V3 → V4 → V5 → V6 → V8` |
| **en paralelo** | **V7** una vez que esté V5 · **V9** una vez que estén V4 y V6 |
| **nada arranca antes que V1** | y V1 no depende de nada |

**V5 es la bisagra**: hasta ahí se construyen capacidades, y de ahí en adelante se consumen. Es
también el punto donde el contrato deja de ser una definición y pasa a tener un consumidor real —
el paso 5.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando
la unidad se declara terminada.

| # | la unidad está lista cuando… |
|---|---|
| **V1** | agregar una clave al código sin agregarla a la base **falla**, y al revés también; y nombrar una vertical sin implementar su ítem del Eje 2 **falla** |
| **V2** | dos versiones vendibles y vigentes con el mismo `rank` en la misma vertical **son imposibles**, no un empate a desempatar |
| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ese `user + vertical` |
| **V4** | un trial vence de verdad, `cobertura()` pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` **es imposible** |
| **V5** | un recurso ajeno, uno archivado y uno inexistente **contestan lo mismo al que no es su dueño** —y una ficha `ARCHIVED` le acepta a **su** dueño verla, exportarla y reactivarla **aunque no tenga ninguna fuente de clase `TÍTULO`**, porque la versión de piso lo otorga (`02` §2.1)—; y una cuenta inhabilitada no puede averiguar qué permisos tiene probando operaciones |
| **V6** | un trial que vence baja la ficha a `UNPUBLISHED_BY_BILLING` y no a `DRAFT`, y al recuperar cobertura vuelve **sólo** la que bajó el sistema |
| **V7** | aprobar una postulación con el correo de un tercero **no vincula nada** hasta que alguien con acceso a esa casilla lo reclame |
| **V8** | ninguna superficie decide por sí misma: lo que se oculta ya está rechazado por V5 |
| **V9** | la fila de `trial` sobrevive al borrado de la cuenta, y su hash **no** se anonimiza |

---

## 5. Dónde vive cada unidad

Las nueve están en Linear como sub-issues de `HOS-1353`, y cada una tiene su ficha publicada.
El estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están listas: una unidad lo está
cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **V1** | [HOS-1355](https://linear.app/hospeda-beta/issue/HOS-1355) | [ficha](https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o) |
| **V2** | [HOS-1356](https://linear.app/hospeda-beta/issue/HOS-1356) | [ficha](https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R) |
| **V3** | [HOS-1357](https://linear.app/hospeda-beta/issue/HOS-1357) | [ficha](https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6) |
| **V4** | [HOS-1358](https://linear.app/hospeda-beta/issue/HOS-1358) | [ficha](https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa) |
| **V5** | [HOS-1359](https://linear.app/hospeda-beta/issue/HOS-1359) | [ficha](https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX) |
| **V6** | [HOS-1360](https://linear.app/hospeda-beta/issue/HOS-1360) | [ficha](https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY) |
| **V7** | [HOS-1361](https://linear.app/hospeda-beta/issue/HOS-1361) | [ficha](https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb) |
| **V8** | [HOS-1362](https://linear.app/hospeda-beta/issue/HOS-1362) | [ficha](https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq) |
| **V9** | [HOS-1363](https://linear.app/hospeda-beta/issue/HOS-1363) | [ficha](https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd) |

**Las otras cuatro fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ).

---

## 6. Lo que esta descomposición NO decide

- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`).
  Esta descomposición dice **qué hay que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Si cada unidad es un issue de Linear.** Depende de si conviene verlas en el roadmap o
  alcanza con el tracking interno de la épica.
