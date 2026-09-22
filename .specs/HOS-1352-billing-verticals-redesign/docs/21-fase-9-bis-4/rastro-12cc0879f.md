---
title: FASE 9-bis-4 — Rastro por aparición del cierre de guards
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `12cc0879f`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ningún commit de esta tanda tocó**, van el archivo, las líneas, el §, la cita y **por
qué sigue siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse
falsa.

## Los commits

| sha | qué escribe |
|---|---|
| `fe5acb4ee` | `G-R6` pasa de las seis tablas de billing a **las nueve máquinas de las dos épicas** |
| `b985a19ff` | la fila de `G-R6` en `V/20` §2, con la razón: `listing.inactiva_desde` |
| `e98727349` | `G12` y `G13` entran al catálogo de `B/20` §2, y **las cifras se recuentan** |
| `0307d99c5` | `B/descomposicion.md` §2.1 deja de decir que el `20` §2 no los nombra |
| `afa716777` | `V/spec.md`: quince → **dieciséis**, y *«siete guards»* deja de darse por total |
| `12cc0879f` | `B/spec.md`: la celda del capítulo `20` nombra los **quince** que hoy cataloga |

## 1. Qué se escribió, en una frase por cambio

| # | cambio | qué quedó escrito |
|---|---|---|
| 1 | **`G-R6` alcanza las dos épicas** | el dominio del guard pasa a ser *«las tablas de transiciones de las nueve máquinas, en las dos épicas»*. Se retira el *«queda como pregunta al owner»*: la ampliación del mismo día de `DEC-TEST-001` la tomó |
| 2 | **su fila en `V/20` §2** | con la razón escrita, y la razón **no es la simetría** con `G-R4`/`G-R5`: es `listing.inactiva_desde`, la columna que `DEC-DATA-002` creó el mismo día, con **cuatro escritores** y **cinco consumidores** (`V/02` §2.5), y **lo que decide es el borrado irreversible del contenido de una ficha** |
| 3 | **`G12` y `G13` al catálogo** | vivían definidos **sólo** en `B/descomposicion.md` §2 y en ningún catálogo, en un § que se presenta como *«la lista, que es lo que permite preguntar «¿están todos?» una vez en vez de siete»*. Los dos van al de billing: `G13` vigila el contrato y billing es quien lo consume |
| 4 | **las cifras recontadas** | medidas acá y no copiadas — la tabla del §2 |

**Y una cosa que el cambio 2 agrega y no estaba pedida, porque medirla la hizo aparecer**: de los
**cuatro** hechos que escriben `inactiva_desde`, **sólo el tercero es una transición** (`PB1`,
`PB3`, `PB7`). Los otros tres se leen del registro de eventos de dominio, de la respuesta del
contrato y de `vertical.fin_de_servicio`. Como el predicado de `G-R6` es *«al menos una transición
la escribe»*, el guard queda **verde por el tercero solo** y lo que certifica es *«alguien la
mueve»*, nunca *«los cuatro hechos la escriben»*. Quedó escrito en `V/20` §2 porque el §2.1 obliga:
el texto con que un guard falla no puede afirmar más de lo que su predicado verifica.

## 2. Las cifras, medidas y no copiadas

Contadas el **2026-09-21** sobre el árbol en `12cc0879f`, recorriendo las dos tablas de catálogo y
las dos `descomposicion.md` con un recorrido de filas (`^\| \**(G[-A-Z0-9]+)\**\s*\|` sobre los
rangos de cada tabla), no a ojo:

| | cuántos |
|---|---|
| filas de `B/20` §2 | **15** — `G7` `G9` `G10` `G11` `G12` `G13`, los **seis** de `R1`, y `G-R4` `G-R5` `G-R6` |
| filas de `V/20` §2 | **16** — `G1`-`G6` `G8`, `G-R2` `G-R2-B`, `G-R3` `G-R3-B` `G-R3-C`, `G-R4` `G-R4-B` `G-R5` `G-R6` |
| **guards distintos** | **28** — 15 + 16 menos las **tres** referencias cruzadas (`G-R4`, `G-R5`, `G-R6`) |
| **con unidad** | **14** — 13 por su id (`G1` `G3` `G8` en `V1`; `G2` `G4` `G6` en `V5`; `G5` en `V6`; `G9` `G10` `G11` `G12` en `B1`; `G7` en `B2`; `G13` en `B4`) más `G-R5`, que `V9` nombra *«el de `D16`»* |
| **sin unidad** | **14** — los seis de `R1`, `G-R2` `G-R2-B`, `G-R3` `G-R3-B` `G-R3-C`, `G-R4` `G-R4-B`, `G-R6` |

**Qué movió esta tanda, y movió a mejor.** Los sin unidad **siguen siendo catorce**: `G12` y `G13`
tienen unidad declarada, y la fila de `G-R6` en `V/20` §2 es una referencia cruzada y no un guard
más. El denominador pasa de **26** a **28**, así que la proporción baja de **14 de 26** a **14 de
28**.

**Y la cifra que `B/20` §2 traía —*«12 de 26»*, *«13 de 27»*— estaba caduca por dos razones
independientes.** La primera: el **26** de `C2` (`F-8eC2-004`, medido sobre `635a2699f`) era la
**unión** de los catálogos **más** `G12` y `G13` leídos de la descomposición —`B/20` §2 listaba
**once** ese día—, así que no era comparable con un conteo de catálogo. La segunda, y es la que la
vuelve falsa: desde esa medición entraron al catálogo **dos guards más y los dos sin unidad**
—`G-R1-F` y el propio `G-R6`—, así que **sin unidad eran catorce y no doce desde antes de que esta
tanda tocara nada**. El *«13 de 27»* no describió ningún estado del corpus en ningún momento.

**Lo que NO se hizo, y con su razón escrita**: el segundo guard que `DEC-TEST-001` evaluó —*«toda
fila con `desde` de conjunto declara cuántas escrituras tiene y en qué orden»*— **sigue sin
agregarse**. La decisión lo rechazó: un guard estático sólo puede comprobar su forma, no su verdad,
y sería un guard que afirma más de lo que prueba. `B/20` §2 lo declara como clase sin vigilancia y
**así queda**.

## 3. Qué se grepeó

**Términos NUEVOS** (los que esta tanda define): *«las nueve máquinas, en las dos épicas»* como
dominio de `G-R6` · `G12` y `G13` **en el catálogo** · *«dieciséis guards»* (`V/20` §2) ·
*«quince guards»* (`B/20` §2) · *«28 guards distintos»* · *«14 sin unidad»* · **tres**
referencias cruzadas.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«las tablas de transiciones de esta épica»* como dominio de `G-R6` ·
*«las SEIS tablas de esta épica, no las nueve máquinas»* · *«queda como pregunta al owner»* (para
`G-R6`) · *«los dos guards que el capítulo 20 no nombra»* · *«faltan dos»* · *«si el `20` se
reescribe, los absorbe»* · *«fuera del catálogo»* (para `G12`/`G13`) · *«12 de 26»* · *«13 de 27»*
· *«11 de 24»* · *«quince guards»* leído como total de `V/20` · *«siete guards»* · *«`G7` y
`G9`–`G11`»* · *«los once guards»* · **dos** referencias cruzadas.

**Alcance**: los **51 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los
documentos de medición—, con y sin backticks, **incluidos los cinco archivos que la tanda toca**.
La lista se construyó con `fd -e md` sobre los tres directorios, quitando los informes de fase
(`14-…` a `21-…`) y el PDR, igual que los seis rastros anteriores.

**Medido sobre el árbol en `12cc0879f`**: **62** líneas con al menos una aparición, repartidas en
**34** párrafos; **13** de esos párrafos los tocaron los commits de la tanda; **21** no, y son los
que van abajo, uno por uno. La partición se calculó con los rangos `+` de
`git diff --unified=0 80f067b06..12cc0879f` proyectados sobre los bloques separados por línea en
blanco —la unidad que `DEC-METH-010` obligación 1 fija es el **párrafo**—, no a ojo.

**Los informes de fase y los rastros quedan fuera del alcance por convención, y eso tiene un
costo que hay que decir**: sobre los `14-…` a `21-…` los mismos términos dan **87 párrafos** más.
Son mediciones fechadas y **no se editan** — pero tres de ellos hoy **afirman lo contrario de lo
que el corpus dice**, y van nombrados en el §5 en vez de quedar tapados por la convención.

## 4. Las 21 apariciones no corregidas, una por una

### `01-decision-log.md` (3)

**El log no se edita** (regla dura de la fase), y además es **la fuente** de esta tanda: las tres
apariciones describen qué se decidió, y esta tanda no decide nada — ejecuta.

- **L2031-2076 · `DEC-ARCH-005`** — *«los capítulos se quedan donde están **y** las specs los
  absorben»* → homónimo de *«absorber»*: son capítulos mudándose entre épicas, no guards entrando
  a un catálogo. Nada de esta tanda lo toca.
- **L2319-2364 · la decisión sobre los 45 guards del repo** — *«exigir que los `G1`…`G13` del
  diseño nuevo **cubran lo que cubren los** [guards del repo]»* → sigue correcta, y **esta tanda
  la refuerza en vez de moverla**: nombra el rango `G1`…`G13` entero, que es exactamente el que
  ahora está catalogado completo. La decisión no afirma en ningún lado dónde vive cada uno.
- **L3721-3770 · `DEC-TEST-001`** — la decisión entera, con sus dos enmiendas → **es la fuente y
  no se toca.** Una sola precisión que no se corrige acá y se eleva al owner en el §6: la enmienda
  dice *«se creyó que agregar `G-R6` la empeoraba a 13 de 27»*, y la medición de arriba muestra
  que `G-R6` **ya estaba en el catálogo** cuando eso se escribió y que el conteo de sin-unidad ya
  era catorce. La **conclusión** de la enmienda —que sumar `G12` y `G13` mejora la proporción—
  **es verdadera y está medida**; lo que no describe ningún estado del corpus es la cifra
  intermedia.

### `02-worklog.md` (2)

Registro histórico de lo que se midió y se hizo, con su fecha puesta. No se edita.

- **L757-761 · las correcciones sobre los agentes que partieron los capítulos** — *«el agente
  anotó **las referencias cruzadas** metiendo la marca dentro del paréntesis»* → homónimo: son
  referencias entre capítulos partidos, no guards cruzados entre catálogos.
- **L914-918 · las seis correcciones de registro** — *«un catálogo de 11 (`G1`…`G11`, sin huecos)
  más `G12` y `G13` **huérfanos**, nacidos en las descomposiciones y **ausentes de todo capítulo
  `20`**»* → **era verdad el día que se escribió y hoy ya no lo es**, y se deja: es el registro de
  qué se creía en cada momento, que es la función declarada de este documento. **La orfandad que
  describe es exactamente la que el commit `e98727349` cierra** — es la línea que hay que releer
  para saber cuánto duró el hueco.

### `08-phase-1b-code-discovery.md` (1)

- **L1562-1564 · el medidor de límites** — *«sus dos apariciones **fuera del catálogo** son esa
  línea del medidor y `apps/web/src/lib/billing-limit-error.ts:142`»* → homónimo puro de *«fuera
  del catálogo»*: el catálogo es el de claves de limit del sistema viejo, no el de guards.

### `11-particion-del-programa.md` (3)

- **L189-194 · §4.1, el bloque corregido del 2026-09-18** — *«si los capítulos se quedan en un
  lugar **y además** cada spec los absorbe, hay dos fuentes para lo mismo»* → homónimo de
  *«absorber»*, y además sigue correcta: es el argumento de por qué los capítulos mixtos se
  partieron de verdad.
- **L207-209** — *«renumerarlos rompería las decenas de **referencias cruzadas** que existen entre
  capítulos»* → homónimo: referencias entre capítulos, no guards.
- **L215-217 · el párrafo tachado** — *«Mover 21 archivos … cuesta el riesgo de perder
  **referencias cruzadas** —hay decenas—»* → el mismo homónimo, y encima está tachado como
  registro de lo que se creía.

### `nucleo/00-indice.md` (1) · `nucleo/03-maquinas-de-estado.md` (1)

Las dos dicen *«las nueve máquinas»*, que es **el término que `G-R6` adopta**, no uno que se
retire. Las dos siguen correctas y son la fuente del número.

- **`00-indice.md` L90-98** — *«las siete reglas de lectura que valen para **las nueve máquinas**»*
  → sigue correcta: son siete reglas y nueve máquinas, y el dominio nuevo de `G-R6` es exactamente
  ese conjunto.
- **`03-maquinas-de-estado.md` L75-77 · regla 7** — *«lo vigila un guard: `G-R4`, sobre las tablas
  de transiciones de **las nueve máquinas, en las dos épicas**»* → sigue correcta, y es **el
  precedente literal que la ampliación de `G-R6` copia**: el núcleo ya escribía un dominio de
  nueve máquinas para un guard catalogado en los dos lados.

### `HOS-1353-…/descomposicion.md` (1)

- **L81-84 · §2.3** — *«la descomposición de billing encontró el que le correspondía: **`G13`**, la
  tercera defensa del contrato §6.3 … **No puede nacer acá**»* → **sigue correcta entera**. Lo
  que esta tanda cambió es **dónde está catalogado** `G13`, no **qué unidad lo construye**: sigue
  siendo `B4`, y el argumento de por qué no puede nacer en `V4` es el que `B/20` §2 ahora repite
  en su fila. Esta sección era ya la que impedía leer la ausencia como un olvido.

### `HOS-1354-…/descomposicion.md` (5)

El §2.1 lo corrigió `0307d99c5`; estas cinco están en párrafos que ningún commit tocó.

- **L109-123 · la tabla de las trece unidades** — `B1` con *«`G9` `G10` `G11` `G12`»* y `B4` con
  *«`G13`»* → **siguen correctas y son la fuente de la columna de unidad** que `B/20` §2 ahora
  cita. Catalogar un guard no le cambia el dueño.
- **L137-140 · la tabla de `G12` y `G13`** — *«se importa el SDK de la pasarela **fuera del
  adaptador**»* / *«la implementación **de arranque** de `cobertura()` llega a producción»* →
  **siguen correctas**: son los enunciados, y `B/20` §2 los adopta **palabra por palabra**. Que el
  mismo enunciado esté en dos lugares es lo que `DEC-TEST-001` pidió, y el catálogo remite acá por
  la unidad en vez de repetir el reparto.
- **L146-149 · §2.2** — *«`G12` es el caso de libro de la regla 1: si llega en B5, para entonces
  hay cuatro unidades que importan el SDK y el guard nace con su lista de excepciones»* → sigue
  correcta: es un argumento de **orden de construcción**, que el catálogo no toca.
- **L210-215 · el guion de `B1`** — *«Escribir la interfaz del adaptador y `G12`»* → sigue
  correcta por lo mismo.
- **L249-251 · el guion de `B4`** — *«Y acá nace `G13`, no antes»* → sigue correcta, y es el
  argumento que la fila nueva de `B/20` §2 cita textualmente.

### `HOS-1353-…/docs/20-testing.md` (2)

Los dos párrafos que ya explicaban una referencia cruzada, y **ninguno afirma que sean dos**.

- **L90-97 · §2, `G-R5`** — *«**Es cruzado**: el tope vive en el catálogo de billing y el día 180
  en el capítulo 02 de esta épica, así que `B/20` §2 lo repite como referencia cruzada, igual que
  `G-R4`»* → sigue correcta: describe a `G-R5` y a `G-R4`, que se cruzan **en esa dirección**
  (definidos acá, repetidos allá). `G-R6` es la tercera y se cruza **en la dirección contraria**,
  lo cual no desmiente nada de este párrafo.
- **L119-122 · §2, `G-R4`** — *«Esta fila es la definición; `B/20` §2 la repite como referencia
  cruzada … **Es un guard, no dos.**»* → sigue correcta, y es **la regla que la fila de `G-R6`
  aplica**: por eso los guards distintos son 28 y no 29.

### `HOS-1354-…/docs/03-maquinas-de-estado.md` (1)

- **L1398-1404 · §7.2, *«Qué mueve la fecha del próximo cobro»*** — *«Y que sean TRES y no cero es
  lo que `G-R6` vigila desde la FASE 9-bis-4 (`B/20` §2, `DEC-TEST-001`)»* → **sigue correcta**:
  afirma que el guard cubre **esta** columna, y ampliar el dominio del guard a las nueve máquinas
  no le quita ninguna. La cita apunta al § correcto y ese § sigue definiendo el guard.

### `HOS-1354-…/docs/20-testing.md` (1)

- **L172-178 · §2, *«`G-R6` es el guard de la COLUMNA MUERTA»*** — *«`MP5` disparaba sobre «el
  período actual arrancó» y ninguna escritura del corpus avanzaba esa columna»* → sigue correcta:
  es el **origen** del guard, que la ampliación no cambia. El párrafo describe de dónde salió, no
  hasta dónde llega; hasta dónde llega lo dice el párrafo siguiente, que `fe5acb4ee` reescribió.

## 5. Tres líneas de `rastro-8d6b27a12.md` que esta tanda vuelve falsas

**No se edita un rastro ajeno** — es evidencia fechada de lo que esa tanda hizo y creyó, y
corregirlo borraría justamente lo que `DEC-METH-011` quiere poder contradecir. Va nombrado acá,
que es la forma que la decisión prevé: *«la vuelta que viene puede tomar una línea del rastro y
mostrar que la resolución era falsa»*.

| dónde | qué dice | por qué es falsa hoy |
|---|---|---|
| **L472-475 · §6, pregunta 4** | *«**`G-R6` quedó acotado a las seis tablas de billing** y la clase existe en las otras tres máquinas … extenderlo pide una fila en `V/20` §2, **que la decisión no tomó**»* | la decisión **la tomó** el mismo día, en la ampliación de `DEC-TEST-001`, y la fila existe desde `b985a19ff`. La pregunta está **contestada**, no abierta |
| **L476-481 · §6, pregunta 5** | *«El catálogo de guards de `B/20` §2 **no lista a `G12` ni a `G13`** … **No se agregaron** porque agregarlos mueve la cifra»* | los lista desde `e98727349`. Y el motivo declarado se invirtió al medirlo: agregarlos **mejora** la proporción, porque los dos tienen unidad |
| **L292-296 · `descomposicion.md` L350-364** | *«**Y `G-R6` no entra acá** … `DEC-TEST-001` acepta por escrito que el guard nuevo nace **sin unidad que lo construya** —*«13 de 27»*—»* | **la conclusión sigue siendo verdadera y la razón caducó**: `G-R6` efectivamente no tiene unidad (está entre los catorce), pero el *«13 de 27»* que la sostiene no describe ningún estado del corpus, y `DEC-TEST-001` lo dejó tachado ese mismo día |

La tercera es la más incómoda de las tres, y por eso va nombrada: es una **razón caduca debajo de
una conclusión correcta**, que es el caso que ningún guard ve y que sólo encuentra alguien que va
a buscar la razón.

**Una línea del mismo rastro que SIGUE correcta**, para que no se lea de más: **L275-278**,
*«`G-R6` **no es de `R1`**. Su sujeto no es `sucede_a` ni `reconciliation_mark` sino las columnas
que una condición lee»* → **sigue verdadera**, y la fila nueva de `V/20` §2 no la mueve: `G-R6`
abre racimo propio y los de `R1` siguen siendo seis.

## 6. Preguntas para el owner

1. **La cifra intermedia de `DEC-TEST-001` no describe ningún estado del corpus, y el log no se
   edita.** La enmienda dice *«se creyó que agregar `G-R6` la empeoraba a 13 de 27»*; medido, el
   corpus estaba en **14 de 26** antes de esta tanda y queda en **14 de 28**. La **conclusión** de
   la enmienda —que sumar `G12` y `G13` mejora la proporción— **es correcta y está medida**. ¿Se
   enmienda la cifra en el log —que es una decisión del owner sobre su propio texto—, o queda como
   está con este rastro y `B/20` §2 como el lugar donde vive el número medido?
2. **Catorce de veintiocho guards no tienen unidad que los construya, y la mitad son los
   `G-R*`.** La regla 1 de las dos descomposiciones dice que *«cada guard va con la pieza que
   protege, nunca al final»*, y `F-8eC2-004` ya midió que por construcción van a llegar al final.
   Esta tanda **no lo empeora** pero tampoco lo arregla: ninguno de los catorce ganó dueño.
   ¿Se abre el reparto de los `G-R*` a unidades como trabajo propio, o se deja declarado para la
   FASE 10?
3. **`G-R6` sobre `inactiva_desde` queda verde por un solo escritor de cuatro.** Los otros tres
   hechos de reinicio no son transiciones, así que el guard no los ve y lo único que los vigila es
   la enumeración cerrada del `V/02` §2.5. ¿Alcanza con eso —que es lo que quedó escrito—, o la
   FASE 10 tiene que darle a esa lista un guard propio, como `G-R1-E` tiene para sus inventarios?
