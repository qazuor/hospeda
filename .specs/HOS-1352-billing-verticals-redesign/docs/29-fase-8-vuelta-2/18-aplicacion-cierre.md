---
title: "FASE 9 vuelta 2 · aplicación — grupo H"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo H, el cierre

Las cuatro últimas filas de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md):
`Q-ACC16`, `Q-ANUNCIO`, `Q-ESTADO` y `Q-UNKNOWN`. Las dos primeras cierran las preguntas 1 y 2
del §4 de [`17-aplicacion-ultimas-dos.md`](./17-aplicacion-ultimas-dos.md). Medido y editado en el
worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits. `B/` es `HOS-1354…/docs`, `V/`
es `HOS-1353…/docs`.

**Excepción a las reglas comunes, dada por el orquestador**: este grupo edita
`$D/01-decision-log.md`, porque el owner ya dio el OK (`Q-ESTADO` y `Q-ACC16`).

## 1. Qué se aplicó

### `Q-ACC16` — la acción administrativa 16, «discontinuar una vertical»

- La fila nueva de `NUCLEO/08` §3, con permiso de `SUPER_ADMIN`, auditoría, confirmación y el
  orden de las dos mitades:
  `nucleo/08:167` — «discontinuar una vertical»
- `nucleo/08:167` — «Si la mitad de billing falla, la acción la reintenta hasta que entra y le muestra al admin que el acto quedó a medias; nunca deshace la mitad de verticales»
- `nucleo/08:167` — «Es capacidad del actor: ningún cliente puede discontinuar una vertical»
- El recuento de la tabla: `nucleo/08:171` — «La tabla tiene DIECISÉIS filas»
- `nucleo/08:181` — «dicen dieciséis desde la FASE 9 vuelta 2»
- La lista de §3.1 regla 1 que nombra las filas agregadas:
  `nucleo/08:269` — «y la decimosexta la de»
- **`B/10` §4.3 remite a la acción 16**:
  `B/10:164` — «Es la acción 16 de `NUCLEO/08` §3,»
- **El texto de `Q-ALTAS` en verticales**, `V/02` §2.1, también remite:
  `V/02:120` — «la acción 16»
- `B/02` §2.1, la fila de `vertical_discontinuation`:
  `B/02:32` — «en la mitad de billing de la acción 16 de `NUCLEO/08` §3»
- Los espejos de `V/17` (§3.2 reglas 1, 3 y 5, §3.3, §3.4 y su ⚠️, §3.5):
  `V/17:335` — «dieciséis acciones del capítulo 08 §3 llevan permiso propio»
- `V/17:344` — «Las ~~quince~~ dieciséis son escrituras»
- `V/17:359` — «las catorce primeras y la decimosexta»
- `V/17:372` — «La decimosexta, discontinuar una vertical, sí está en la excepción»
- `V/17:386` — «vale para las ~~quince~~ dieciséis acciones»
- `V/17:408` — «~~quince~~ dieciséis acciones del capítulo 08 §3.»
- `V/17:419` — «La decimosexta, discontinuar una vertical, es plata»
- `V/17:461` — «decimosexta, `Q-ACC16`»
- `V/17:474` — «dieciséis acciones del cap. 08 §3 (`Q-ACC16`)»
- El §3.5, con la cifra en dígitos: `V/17:478` — «la 16, discontinuar una vertical»
- `$V/spec.md:211` — «y la decimosexta,»
- `B/19` §6: `B/19:202` — «~~quince~~ dieciséis del capítulo 08 §3 (núcleo)»
- Los siete espejos de `B/03` que dan la cifra del catálogo:
  `B/03:869` — «~~**quince**~~ **dieciséis** del `NUCLEO/08` §3»
- `B/03:1994` — «~~quince~~ dieciséis (`G5-2`, `Q-ACC16`) acciones del»
- `B/03:2103` — «**dieciséis** desde la FASE 9 vuelta 2»
- `B/03:2108` — «dicen dieciséis, y por `F-8CA2-004`»
- `B/03:2129` — «y dieciséis desde la FASE 9 vuelta 2 por discontinuar una vertical»
- `B/03:2198` — «tiene ~~trece~~ ~~catorce~~ ~~quince~~ dieciséis (la decimosexta»
- `B/03:2505` — «~~quince~~ dieciséis (la decimosexta»
- **Unidades**. La acción es de **B12**, que ya era dueña de la mitad de billing y del reintento:
  `$B/descomposicion.md:138` — «esa acción es la 16 de `NUCLEO/08` §3»
- `$B/descomposicion.md:750` — «la acción 16 sin el permiso de `SUPER_ADMIN`, o sin confirmar, no escribe ninguna de las dos mitades»
- Del lado de verticales, **V2** (la mitad que escribe `admite_altas`, ya asignada por el grupo G)
  y **V5** (la clase), con fila ✚ en el §2.10 y criterio:
  `$V/descomposicion.md:409` — «la acción administrativa 16»
- `$V/descomposicion.md:58` — «y la acción 16 evaluada sobre el actor»
- `$V/descomposicion.md:526` — «y la acción 16 la ejecuta un `SUPER_ADMIN` sin que los pasos 5 a 7 consulten a ningún dueño de la vertical»

**Por qué la 16 es capacidad del actor.** El criterio de `V/17` §3.2 regla 3 es el objeto de la
acción. Las catorce primeras le dan al cliente algo a lo que no tiene derecho por sí mismo (su
objeto es dárselo), y por eso se evalúan sobre el actor. La decimoquinta hace por el dueño lo que
él mismo podría, sobre una ficha con cupo, y por eso se evalúa sobre el sujeto. La decimosexta no
es ninguna de las dos cosas para un cliente: ningún cliente puede discontinuar una vertical, y el
acto no recae sobre un dueño con cupo, sino sobre la vertical entera. Evaluada sobre el sujeto, los
pasos 5 a 7 no tienen a quién preguntar y la acción sería inejecutable, que es el defecto que
`NUCLEO/08` §3 le atribuye a una escritura sin fila. Evaluada sobre el actor, el permiso de
`SUPER_ADMIN` es la capacidad. Así que las capacidades del actor pasan de catorce a **quince**, y
el catálogo de quince a **dieciséis**.

### `Q-ANUNCIO` — el anuncio es el instante de la mitad de billing

- `B/10` §4.3, después del reintento de `Q-ALTAS-b`:
  `B/10:180` — «El anuncio es el instante en que entra la mitad de billing»
- `B/10:183` — «nadie recibe menos aviso que el que el §4.4 le promete»
- `B/10` §4.4, el piso: `B/10:379` — «y se cuenta desde el anuncio, que es el instante en»
- `B/02` §2.1, la fila de `vertical_discontinuation`, que guarda ese instante:
  `B/02:32` — «el instante en que entra la mitad de billing del acto, que es cuando salen los avisos, y no el de la mitad de verticales»
- La fila de la acción 16 en el núcleo lo repite:
  `nucleo/08:167` — «El anuncio es el instante en que entra la mitad de billing»
- Criterio de **B12**: `$B/descomposicion.md:750` — «el anuncio de `vertical_discontinuation` es el de billing»

### `Q-ESTADO` — las nueve marcas en el *Estado* del log

Cada una sigue el formato de sus vecinas (`DEC-RF-001`, `DEC-SUB-019`): la marca, el origen, qué
precisa en pocas palabras y *«ver su 📌»*.

- `$D/01-decision-log.md:1928` — «precisada el 2026-09-27, con OK del owner»
- `$D/01-decision-log.md:3852` — «la cortesía re-emitida arranca al agotarse el crédito»
- `$D/01-decision-log.md:1247` — «el crédito de `DEC-SUB-006` cuenta como período pagado; ver su 📌»
- `$D/01-decision-log.md:4988` — «los motivos 23 y 24, veinticuatro con nueve que devuelven»
- `$D/01-decision-log.md:5826` — «el titular que sólo conoce el proveedor; ver su 📌»
- `$D/01-decision-log.md:6064` — «las dos mitades del acto, dónde vive la fecha»
- `$D/01-decision-log.md:431` — «la lista cerrada de proveedores que ignoran puntos»
- `$D/01-decision-log.md:6130` — «la acción 15 no es capacidad del actor; ver su 📌»
- `$D/01-decision-log.md:919` — «el cobro asentado sobre una lápida emite comprobante»
- La celda del contador, con tachado:
  `$D/01-decision-log.md:6155` — «~~**35**~~ **44**»

**`DEC-AUTH-003` va sin «con OK del owner».** Su 📌 no lo lleva, porque `F-8V2A1-004` fue escritura
sin decisión (`17-` §3, entrada 15). Seguí el precedente de `DEC-MIG-004`, cuyo 📌 tampoco lo lleva
y cuyo *Estado* dice *«precisado el 2026-09-27»* a secas. El OK de `Q-ESTADO` es para poner la marca,
no para cambiar el origen del 📌.

### `Q-ACC16` en el log — el 📌 de `DEC-RF-008`

`rg -n "quince acciones|15 acciones|catorce acciones"` sobre el log da una sola decisión que fija
el número: `DEC-RF-008`, cuyo *Estado* dice *«quince acciones»* y cuyo 📌 del 2026-09-26 dice
*«el catálogo tiene hoy quince»*. `DEC-AUTH-003` nombra la fila decimoquinta, pero no fija el total.

- `$D/01-decision-log.md:5908` — «dieciséis acciones; ver su segundo 📌»
- `$D/01-decision-log.md:5935` — «El catálogo tiene dieciséis acciones»

### `Q-UNKNOWN` — `EX-43` a `EX-47` en las tres tablas de billing

Cada fila sale de la de la matriz (`$D/06-mp-validation-matrix.md:399-403`) y del registro que la
propuso: `11-` (`EX-43`), `12-` (`EX-44` a `EX-46`, con su reparto por unidad) y `15-` (`EX-47`).

- `$B/spec.md` §5.2 (fila · qué condiciona). El título seguía en cinco:
  `$B/spec.md:222` — «~~cinco~~ diez filas que siguen»
- `$B/spec.md:243` — «Condiciona `A3` sobre el addon de única vez»
- `$B/spec.md:244` — «da el tamaño de la población»
- `$B/spec.md:245` — «el código actual registra seis que no»
- `$B/spec.md:246` — «Condiciona el paso 4b del corte»
- `$B/spec.md:247` — «si cobra el viejo, lo ve el motivo 24»
- `B/06` §11 (qué falta saber · qué bloquea · cuándo se contesta):
  `B/06:418` — «pendiente de sonda; `EX-41` midió el reenvío inmediato»
- `B/06:419` — «sobre una sonda propia con un registro abierto»
- `B/06:420` — «`PA-5` midió la irreversibilidad en sandbox»
- `B/06:421` — «`WH-4` midió los reintentos, no su destino»
- `B/06:422` — «`PC-1` midió el monto vigente con la mutación mucho antes del cobro»
- El párrafo de abajo, que contaba cinco:
  `B/06:431` — «cinco lecturas del proveedor que pidió la FASE 9 vuelta 2»
- `$B/descomposicion.md` §2.7 (filas · unidad · qué bloquea de verdad):
  `$B/descomposicion.md:405` — «la comprobación de órdenes pagadas»
- `$B/descomposicion.md:406` — «la herramienta del corte (paso 0)»
- `$B/descomposicion.md:407` — «No bloquea ninguna unidad de esta épica»
- `$B/descomposicion.md:408` — «la herramienta del corte (paso 4b)»
- `$B/descomposicion.md:409` — «el motivo 24»

## 2. Conteos recontados

| lista | antes → ahora | comando | espejos |
|---|---|---|---|
| filas de `NUCLEO/08` §3 | 15 → **16** | `python3` sobre las filas de la tabla entre el título del §3 y el párrafo del recuento | `nucleo/08` (recuento, *«dicen»*, §3.1); `V/17` §3.2 reglas 1, 3 y 5, §3.3, §3.4 y su ⚠️, §3.5; `$V/spec.md` §3.7; `B/19` §6; `B/03` (siete líneas: `:869`, `:1994`, `:2103`, `:2108`, `:2129`, `:2198`, `:2505`); `DEC-RF-008` en el log |
| acciones que son capacidad del actor (`V/17` §3.2 regla 3) | 14 → **15** | la tabla menos la decimoquinta | `V/17` regla 3, los dos recuadros del §3.4, `$V/spec.md` §3.7 |
| precisadas sin `SUPERSEDED` | 35 → **44** | script propio sobre el *Estado* entero de cada `### DEC-`, con el criterio de la celda (precisada, recontada, enmendada o cerrada, sin `SUPERSEDED`); corrido también sobre la copia anterior, que dio 35 | la celda del resumen del log |
| decisiones del log | 126 → **126** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` | — |
| `UNKNOWN` en las tres tablas de billing | 5 → **10** en cada una | `python3`: las filas y los IDs `UNKNOWN` de la primera columna, sin lo tachado | `$B/spec.md` §5.2, `B/06` §11, `$B/descomposicion.md` §2.7 |
| filas de la matriz | 104 → **104** (10 `UNKNOWN`) | `python3 contar-filas-de-la-matriz.py` en `$D/` | ya estaban al día |

**Las tablas de `UNKNOWN` no tienen 10 filas físicas, y está bien.** Cada una cubre exactamente los
diez IDs abiertos (`PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` a `EX-47`), pero conserva las filas de
las que cerraron: `$B/spec.md` §5.2 tiene **11** filas (la de `GR-1`, tachada, y `RN-3` junto a
`GR-2`), `B/06` §11 tiene **12** (`RN-3` y `GR-1`, cerradas) y `$B/descomposicion.md` §2.7 tiene
**13** (`RN-3`/`GR-2` en una fila, más tres tachadas o cerradas: la vieja de cinco, `WH-5` y
`EX-1`). No borré ninguna: el estilo del diseño tacha y no borra.

**El contador del log daba 44, como pedía `Q-ESTADO`.** Las nueve suman y ninguna otra cambió. El
📌 nuevo de `DEC-RF-008` no mueve la cifra, porque esa decisión ya estaba contada por su
recuento del 2026-09-26.

## 3. Propuestas para el log y la matriz

Ninguna nueva. El log se editó con el OK del owner (`Q-ESTADO`, `Q-ACC16`), y la matriz no se
tocó: `EX-43` a `EX-47` ya estaban.

## 4. Preguntas abiertas

Ninguna. La clase de la acción 16 se decidió por el criterio de `V/17` §3.2 regla 3, como pidió el
orquestador (§1). Lo que no alcancé a decidir sin mecanismo nuevo va como caso vecino.

## 5. Casos vecinos

- **El sujeto de la acción 16 no es una cuenta.** `V/17` §3.2 regla 5 compara cuentas (*«nunca
  `actor = sujeto`»*), y `NUCLEO/08` §4.1 lista cada acción que mueve plata *«con actor y
  sujeto»*. El acto recae sobre una vertical y sobre todos sus dueños, así que la regla 5 se
  cumple sola y el resumen de `DEC-OBS-001` no tiene un sujeto que mostrar. Un `SUPER_ADMIN` que
  también es dueño en esa vertical se discontinúa a sí mismo sin que el paso 3 lo vea. No lo
  escribí: es una regla que falta, no un espejo.
- **Acortar la cola (`B/10` §4.4) no tiene fila propia.** Reescribe la fecha de
  `vertical_discontinuation` y reembolsa la parte no prestada. El reembolso es la fila de
  reembolsar, pero la reescritura de la fecha no la nombra ninguna fila, y la regla del catálogo
  dice que una escritura sin fila no se puede ejecutar. Tampoco la metí en la 16: la decisión
  habla del acto de discontinuar, no del de acortar.
- **Los tres avisos de `DEC-MP-002` se cuentan desde el anuncio**, *«al anunciar, a 30 días y a 7
  días»* (`B/10` §4.3), pero los dos últimos se cuentan hacia atrás desde la fecha de fin de
  servicio. `Q-ANUNCIO` no los mueve, y con la mitad de billing entrando tarde siguen siendo
  exactos. Lo dejo dicho porque la palabra *«anuncio»* aparece en los dos cálculos.
- **`V/17` §3.3 dice *«Doce mueven dinero o conceden servicio»*** y enumera después la 13, la 14,
  la 15 y ahora la 16, que también es plata. Esa frase queda exacta para las doce primeras, pero el
  total de las que tocan plata es catorce (las doce, la 14 y la 16). Nadie lo cuantifica en otro
  lado, así que no lo toqué.
- **La pregunta 3 de `17-` §5 sigue abierta**: el aviso del anuncio de `B/19` §4 fila 14 no dice
  que sale una sola vez si la mitad de billing se corta a mitad de los avisos y se reintenta. Con
  `Q-ANUNCIO` el anuncio es el instante de esa mitad, así que un reintento que reescriba el
  instante movería el piso. `UNIQUE(vertical)` impide una segunda fila, pero no dice si el
  reintento conserva el instante del primer intento.

## Key Learnings

1. Una acción nueva del catálogo mueve **dos** conteos, no uno: el del catálogo (15 → 16) y el de
   las capacidades del actor (14 → 15). `V/17` los escribe separados desde `F-8V2A1-004`, y la
   frase *«las catorce primeras»* deja de ser una forma de decir *«todas menos la última»*.
2. El registro `17-` dijo seis espejos, y eran más: `B/03` tiene siete líneas que dan la cifra del
   catálogo con su historia (`:869`, `:1994`, `:2103`, `:2108`, `:2129`, `:2198`, `:2505`), y
   `$V/spec.md` §3.7 repite la excepción. La lista de espejos del propio núcleo (*«`V/17` … y
   `B/19` §6»*) no los nombra.
3. Un grep por *«quince»* devuelve sobre todo otros conteos (motivos, transiciones, puertas,
   guards). Hubo que filtrar por *«08 §3»*, *«decimoquinta»* y *«acciones»* para quedarse con los
   espejos reales.
4. Para recontar el log conviene correr el script también sobre la copia anterior: que dé la cifra
   vieja (35) es lo que prueba que el criterio del script es el de la celda.
5. «Una tabla con 10 filas» y «una tabla que cubre 10 `UNKNOWN`» no son lo mismo cuando el estilo
   tacha y no borra. Se cuentan los IDs de la primera columna fuera del tachado.
