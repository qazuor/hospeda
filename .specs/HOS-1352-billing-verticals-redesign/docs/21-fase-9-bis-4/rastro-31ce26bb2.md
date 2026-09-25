---
title: FASE 9-bis-4 — Rastro por aparición de la ampliación de G-R6-B a sus dos mitades
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `31ce26bb2`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ningún commit de esta tanda tocó**, van el archivo, las líneas, el §, la cita y **por
qué sigue siendo correcta**. Cada línea de abajo se puede tomar sola y mostrarse falsa.

## Los commits

| sha | qué escribe |
|---|---|
| `1bd10b987` | `V/20` §2: `G-R6-B` pasa a vigilar **las dos mitades** de la lista, con **mensaje por mitad**, **dos** casos que lo hacen fallar a propósito, y la declaración de lo que no verifica reescrita |
| `8bfb9b67a` | `B/20` §2: la referencia cruzada y su párrafo dejan de decir *«la lista de escritores»* |
| `b58abd299` | `V/02` §2.5: la mitad de **consumidores** nombra su guard — y se mide la lista contra el corpus |
| `58ce14ad9` | `NUCLEO/01` §1.2: dice **dónde vive la otra mitad** y que la vigila el mismo guard |
| `31ce26bb2` | `V/descomposicion.md` §2.5: la elección de unidad **se vuelve a medir** con la mitad de lectores |

## 1. Qué se escribió, en una frase por cambio

| # | cambio | qué quedó escrito |
|---|---|---|
| 1 | **el predicado** | son **dos**: *(a)* una **escritura** de `listing.inactiva_desde` que no sea uno de los cuatro hechos del `NUCLEO/01` §1.2, y *(b)* una **lectura** que no figure entre los cinco consumidores del `V/02` §2.5 |
| 2 | **el mensaje** | **nombra la mitad que falló** — *«escritor fuera de la lista»* o *«lector fuera del inventario»*, nunca uno solo para las dos |
| 3 | **el caso que lo rompe** | pasa a ser **dos, uno por mitad**, y cada uno tiene que dar **su** texto: un rojo de *(a)* con el texto de *(b)* **es el guard fallando su propia condición** |
| 4 | **lo que ya no declara** | *«no mira a los cinco consumidores»* **se retira**: dejó de ser cierto |
| 5 | **lo que sigue declarando** | que **no verifica que los cuatro hechos tengan ejecutor** — pide una declaración por escritura, que es la forma rechazada. Y se agrega que **la mitad que falta es la misma en las dos listas**: ninguna comprueba que sus miembros declarados existan, sólo que no haya intrusos |
| 6 | **la unidad** | sigue siendo **`V6`**, y el argumento **se rehizo** en vez de darse por bueno — §2 de este rastro |

**Por qué el mensaje por mitad no es un adorno, dicho una vez más porque es la condición con que la
enmienda se aceptó**: un guard con dos predicados y un solo texto **afirma más de lo que verificó en
esa corrida** —quien lo lee no sabe si le sobra un escritor o le falta una fila de lectores, que se
arreglan en dos capítulos distintos—, y es **la misma regla con la que `DEC-TEST-001` rechazó el
segundo guard** que evaluó, tres párrafos más arriba en su propia entrada. Sin esa condición, la
cuarta enmienda se contradice con la entrada que la contiene.

## 2. La unidad, re-medida y no heredada

`G-R6-B` **sigue naciendo con `V6`**, y la elección **no se dio por buena**: el argumento anterior
se apoyaba en que V6 es donde nacen **las escrituras**, y la mitad nueva son **lecturas**, así que se
volvió a medir dónde nace cada una de las cinco. Medido sobre `V/descomposicion.md` §2 y §3:

| consumidor | de qué unidad es |
|---|---|
| `PB4` (día 90) y `PB5` (N meses) | **V6** — `03` §9 es su capítulo |
| el día 180 y los **dos avisos previos** | **V9** — `02` §4 y `01` §1.2 |
| la fecha que se le imprime al cliente (`19` §4 fila 18) | **V8** — el `19` es suyo |

**Y eso confirma V6 en vez de moverlo.** V8 y V9 van **después** de V6 en el orden del §3, así que
un guard que naciera con el último de sus consumidores llegaría **cuando los cinco ya existen** y
nacería con lista de excepciones — el caso de libro del §2.1. Naciendo en V6 ve llegar a los tres de
afuera **uno por uno**, y cada uno tiene que traer su fila al `02` §2.5 para pasar. **Este argumento
vivía sólo en el mensaje de `31ce26bb2`**, y un mensaje de commit no es evidencia: queda acá y en el
§2.5 de la descomposición.

## 3. Los conteos: **no se movieron**, y está medido

`G-R6-B` **no se duplica** —se le amplía el predicado a la misma fila—, así que el catálogo no gana
ni pierde filas. Recontado el **2026-09-21** sobre el árbol en `31ce26bb2` con el mismo recorrido de
filas de siempre (`^\| \**(G[-A-Z0-9]+)\**` sobre el rango de cada tabla, más la columna *guards* de
las dos `descomposicion.md`), **no a ojo y no copiado del rastro anterior**:

| | cuántos | ¿se movió? |
|---|---|---|
| filas de `B/20` §2 | **16** | no |
| filas de `V/20` §2 | **17** | no |
| **guards distintos** | **29** | no — 16 + 17 menos las **cuatro** referencias cruzadas |
| **con unidad** | **15** | no — `G-R6-B` ya nacía con `V6` |
| **sin unidad** | **14** | no |

**Ninguna de las cinco cifras se movió**, y por eso **ningún capítulo de conteo se tocó en esta
tanda**: `B/20` §2, `V/spec.md` y `B/spec.md` quedan como estaban. Esto se verificó recontando, no
deduciendo — que una ampliación de predicado *no debería* mover un conteo es una expectativa, y la
expectativa es exactamente lo que el programa no acepta como medición.

## 4. Una lista que hubo que medir antes de ponerle guard

Anclar la mitad *(b)* obligó a leer la lista de consumidores contra el resto del corpus, porque **un
guard sobre una lista ambigua no vigila nada**. Dos hallazgos, los dos escritos en `V/02` §2.5
(`b58abd299`):

1. ***«los dos avisos de schedule del cap. 07 §6»* NO contradice al núcleo, que cuenta tres.**
   `NUCLEO/07` §6 dice *«los tres contados sobre `listing.inactiva_desde`»* y *«los avisos de
   retención son tres y no dos»*. Se resuelve así: de los tres, **dos entran por el schedule** y el
   tercero —el del archivado, que `DEC-DATA-002` agregó— **entra por la superficie que imprime su
   fecha**, que es el quinto consumidor (`V/19` §4 fila 18, *«el aviso de ficha archivada»*). Los
   cinco son cinco y los tres avisos están todos. Queda dicho en el § para que nadie lo lea como una
   lista corta y la «arregle».
2. ***«que son los mismos cinco que el cap. 01 §1.2 enumera»* era falso, y se retiró.** Ese § **no
   enumera consumidores**: enumera los **cuatro hechos** que la escriben, y nombra de paso a **tres**
   de estos cinco —`PB4`, `PB5` y el día 180— al pedirles que relean antes de actuar. La lista de
   lectores **se cierra en `V/02` §2.5 y en ningún otro lado**, que es justo lo que el guard necesita
   para tener contra qué comparar.

## 5. Qué se grepeó

**Términos NUEVOS** (los que esta tanda define): *«las dos mitades»* de la lista de
`inactiva_desde` · *«lector fuera del inventario»* / *«escritor fuera de la lista»* como **mensajes
distintos** · *«el mensaje nombra la mitad»* · *«cuarta enmienda»* · *«los dos avisos previos»* ·
*«esta lista también es cerrada»* (la de consumidores).

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no aparece
buscando el nuevo: *«no mira a los cinco consumidores»* · *«la lista de escritores»* como
descripción **completa** del guard · *«los mismos cinco que el cap. 01 §1.2 enumera»* · *«los dos
avisos de schedule»* leído como lista corta · *«el guard protege las escrituras»* como argumento de
unidad.

**Términos de CONTEO**, grepeados aunque no se esperaba que se movieran, porque esperarlo no es
medirlo: *«diecisiete»* · *«dieciséis»* · *«quince guards»* · *«29 guards»* · *«sin unidad»* /
*«con unidad»* · *«referencias cruzadas»* · *«14 de 2N»*.

**Alcance**: los **51 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los documentos
de medición—, con y sin backticks, **incluidos los cinco archivos que la tanda toca**. La lista se
construyó con `fd -e md` sobre los tres directorios, quitando los informes de fase (`14-…` a `21-…`)
y el PDR, igual que los ocho rastros anteriores.

**Medido sobre el árbol en `31ce26bb2`**: **210** líneas con al menos una aparición, repartidas en
**129** párrafos; **11** de esos párrafos los tocaron los commits de la tanda; **118** no, y son los
que van abajo. La partición se calculó con los rangos `+` de
`git diff --unified=0 c6ec03026..31ce26bb2` proyectados sobre los bloques separados por línea en
blanco —la unidad que `DEC-METH-010` obligación 1 fija es el **párrafo**—, no a ojo.

> **Una advertencia sobre el barrido, porque la primera pasada la dio mal.** Correrlo con las
> palabras sueltas *«consumidor»* y *«lector»* devolvió **204 párrafos**, casi todos homónimos de
> cualquier consumidor de cualquier término del corpus. El barrido útil se ancla en **el sujeto**
> —`inactiva_desde`, *«cinco consumidores»*, *«cuatro hechos»*— y no en la palabra que el sujeto usa.
> Queda anotado porque el número grande se lee como rigor y es lo contrario: ruido que entierra las
> apariciones que importan.

## 6. Las 118 apariciones no corregidas

### A · `01-decision-log.md` (18 párrafos)

**El log no se edita** (regla dura de la fase) y **es la fuente**: la cuarta enmienda de
`DEC-TEST-001` es el encargo entero de esta tanda.

- **L3788-3838 · `DEC-TEST-001`, tercera y cuarta enmiendas** (14 líneas) — *«`G-R6-B` vigila las
  DOS mitades de la lista … el mensaje del guard tiene que decir QUÉ MITAD falló»* → **es el encargo
  textual, y lo que se escribió es eso**: dos predicados, dos textos, dos casos que lo rompen.
- **L3721-3764 · el cuerpo de la entrada y la ampliación a las dos épicas** — *«ahí vive
  `inactiva_desde` … con cuatro escritores nuevos y cinco consumidores»* → **sigue correcta, y es la
  premisa que la mitad (b) usa**: los cinco consumidores son los que ahora tienen guard.
- **L3766-3771 · la tabla de cifras** — *«filas de `B/20` §2: 16 · `V/20` §2: 17 · distintos: 29 ·
  sin unidad: 14»* → **sigue correcta**, y esta tanda **la deja en pie porque no movió ninguna**
  (§3). Está anclada al SHA `7676082e6` por el commit `05fabfe1f`, que es lo que la vuelve una
  medición y no una afirmación sobre el presente.
- **L3773-3786 · la nota que la ancla** — *«estas cifras están ancladas a un SHA y NO describen el
  presente»* → **sigue correcta y hoy dice de más a favor nuestro**: el árbol en `31ce26bb2` tiene
  las mismas cinco cifras que el árbol en `7676082e6`.
- **L3020-3055 · `DEC-DATA-002`** — *«sus «dos avisos» ahora son tres»* y *«cuatro hechos de
  reinicio y lista cerrada»* → **sigue correcta entera**, y **es la que resuelve el hallazgo 1 del
  §4**: los avisos son tres desde acá, y el `V/02` §2.5 los reparte dos + uno.
- **L867 y L869-898 · `DEC-DATA-001`** — *«oculto del público, visible para el dueño, con dos
  avisos»* → **correcta en su fecha y ya enmendada por `DEC-DATA-002`**, que le agregó el tercero.
  El log guarda la decisión como se tomó; la enmienda vive en la entrada que la hizo.
- **L1295-1348 · `DEC-MP-002`** — *«con tres avisos previos, el correo del proveedor llega como
  confirmación»* → **homónimo**: son los tres avisos de aumento, no los de retención.
- **L3424-3470** — *«la clave del outbox que manda los dos avisos una sola vez en la vida de la
  ficha»* → cita el estado **anterior** de un defecto ya corregido; es registro de la decisión.
- **L3190-3241** — *«`DEC-DATA-002` acaba de volverlo no-monótono — cuatro hechos de reinicio»* →
  sigue correcta: usa la lista, no la define.
- **L2031-2076**, **L2246-2295**, **L3057-3077**, **L3083-3132**, **L3302-3356** — *«las dos
  mitades»* de un `ci.yml`, de una decisión, de un arreglo → **homónimos** de la expresión más
  común del corpus; ninguno habla de esta lista.
- **L1878-1913** — *«una lista cerrada que el capítulo 08 declara»* → homónimo.
- **L3671-3686** — *«por qué libre y no de lista cerrada»* → homónimo, y en la dirección contraria.
- **L2739-2752** — *«los diecisiete críticos distintos»* → homónimo del número.

### B · `02-worklog.md` (5) · `03-handoff.md` (1) · `04-open-decisions.md` (3)

Registro histórico y tablero; no se editan.

- **`02-worklog.md` L215-234** y **L267-270** — *«los dos avisos tapan el silencio»* → registro de
  lo que `DEC-DATA-001` resolvió el día que lo resolvió; el tercero llegó después.
- **`02-worklog.md` L352** — *«las diecisiete filas»* → homónimo.
- **`02-worklog.md` L757-761** — *«las referencias cruzadas»* entre capítulos → homónimo.
- **`02-worklog.md` L933-936** y **`03-handoff.md` L459-463** — *«la unión de las dos mitades es
  1–14»* → homónimo: las dos mitades de una lista de superficies.
- **`04-open-decisions.md` L223-243** y **L380-394** — *«los dos avisos tapan el silencio»*, *«los
  tres avisos son transaccionales no suprimibles»* → las dos correctas en su contexto: la primera es
  el registro del cierre de `R-DATA-01`, la segunda ya cuenta **tres**.
- **`04-open-decisions.md` L267-276** — *«lista cerrada de ocho ítems»* → homónimo.

### C · Documentos de medición de la FASE 1 (10)

Mediciones fechadas con su método; no se editan, y ninguna habla de esta columna.

- **`08-phase-1b` L293**, **L1363-1364**, **L3156-3160** — *«las dos mitades»* de un esquema, de un
  archivo, de una expiración → homónimos.
- **`08-phase-1b` L1606**, **L4294**, **L4320-4321**, **L5991-5995** — *«diecisiete»*,
  *«dieciséis»* → homónimos de conteos de otra cosa.
- **`10-evaluacion-de-proveedor.md` L809-813** — *«siete de los diecisiete crons»* → homónimo.
- **`mp-probes/RESULTS-2026-09-15.md` L275-278** — *«no cuatro hechos distintos sobre el mismo
  recurso»* → homónimo de *«hechos»*: son reintentos de una llamada.
- **`mp-probes/RESULTS-2026-09-15.md` L379-382** — *«las diecisiete filas»* → homónimo.

### D · `11-particion` (3) · `12-contrato` (3) · `13-pliego` (1)

- **`11-particion` L156-180** — *«PARTIDO — §2.1 menos `billing_option`, §2.5 y §3 a verticales»* →
  **sigue correcta y es la que explica por qué el `02` §2.5 es de verticales**, que es donde vive la
  lista que este guard vigila.
- **`11-particion` L207-209** y **L215-217** — *«referencias cruzadas entre capítulos»* → homónimo,
  y el segundo está tachado.
- **`12-contrato` L261-272** — *«las tres cosas de su lista cerrada»* → homónimo.
- **`12-contrato` L488-489** — *«las dos mitades son necesarias»* → homónimo.
- **`12-contrato` L597-603 · §3** — *«el instante se escribe en `listing.inactiva_desde`»* →
  **sigue correcta y es un escritor de la lista**, el hecho 2. La mitad (a) lo ampara; la (b) no lo
  toca, porque escribe y no lee.
- **`13-pliego` L65-68** — *«los 60 días y los tres avisos son decisión comercial nuestra»* →
  homónimo: los de `DEC-MP-002`.

### E · El núcleo (17)

- **`00-indice.md` L86-88** — *«un glosario en dos mitades deja de ser un glosario»* → homónimo, y
  con gracia: es el argumento de por qué el núcleo **no** se parte.
- **`01-glosario.md` L41-48 · la definición de *«Inactividad»*** — *«el más reciente de los cuatro
  hechos … la columna `listing.inactiva_desde`»* → **sigue correcta**; el guard no toca el término.
- **`01-glosario.md` L50 · el encabezado de la tabla** — *«Los cuatro hechos … y la lista es
  cerrada»* → sigue correcta: es la lista de la mitad (a).
- **`01-glosario.md` L69-76 · el hecho 2 leído de la consulta** — *«se escribe el instante en
  `listing.inactiva_desde`»* → escritor de la lista, correcta.
- **`01-glosario.md` L228-233** — *«día 180 hard delete de lo eliminable, con dos avisos previos
  (`DEC-DATA-001`)»* → **sigue correcta con la lectura que el `V/02` §2.5 acaba de fijar**: los
  **previos** son dos, y el tercero es el del archivado. Es la misma partición dos + uno, escrita
  desde el otro lado.
- **`01-glosario.md` L345-356** y **L435-460** — *«`G-R1-E` … en sus dos mitades»* → **homónimo que
  conviene no leer de más**: son las dos mitades de `G-R1-E`, no las de `G-R6-B`. Que los dos guards
  tengan dos mitades cada uno es la coincidencia de forma que el `V/20` §2 explica, no una relación.
- **`01-glosario.md` L624-625** — *«El Eje 2 es una lista cerrada»* → homónimo.
- **`07-outbox` L83-88** — *«el reloj de retención se reinicia por cualquiera de los cuatro
  hechos»* → sigue correcta: usa la lista de la mitad (a).
- **`07-outbox` L135-140** — *«los avisos de retención son el …»* → sigue correcta; habla de
  supresión, no de cuántos.
- **`07-outbox` L210-226 · el catálogo de avisos** — *«antes del día 90, al archivar y antes del día
  180, los tres contados sobre `listing.inactiva_desde` (`V/02` §2.5)»* → **sigue correcta, y es la
  fuente del hallazgo 1 del §4**. No se edita: el que tenía que explicar la partición dos + uno era
  el `V/02` §2.5, que es quien dice *«cinco»*.
- **`07-outbox` L228-234** y **L279-288** — *«los tres avisos de `DEC-MP-002`»*, *«no reemplaza a
  los tres avisos de retención»* → la primera es homónima (aumento), la segunda es correcta.
- **`07-outbox` L236-244** — *«los avisos de retención son tres y no dos, y el del medio es el que
  faltaba»* → **sigue correcta y es la línea que resuelve la aparente contradicción**; el `V/02`
  §2.5 ahora la cita.
- **`08-auditoria` L172-177** — *«sin las dos mitades de arriba»* → homónimo.
- **`08-auditoria` L217-222** y **L264-267** — *«libre y no de lista cerrada»*, *«es una lista
  cerrada: un doble cobro real detectado…»* → homónimos.

### F · La épica de verticales (33)

- **`descomposicion.md` L52-62 · la tabla de unidades** — `V6` con *«`G5` `G-R6-B`»* y `V9` con
  *«el reloj … con sus cuatro hechos de reinicio»* → **siguen correctas**: la celda de V6 es la
  asignación que el §2.5 argumenta, y la de V9 describe lo que V9 construye, que el guard **no**
  cambia. La tabla no dice que V9 sea dueña de ningún guard de esta columna.
- **`descomposicion.md` L99 · el título del §2.5** — *«`G-R6-B` va con V6 y no con V9»* → **sigue
  correcta**, y el cuerpo del § es lo que `31ce26bb2` rehízo con la mitad de lectores.
- **`V/02` L179-180** — *«Son tres cosas y la lista es cerrada»* → homónimo.
- **`V/02` L247-249 · la tabla de `listing`** — *«`inactiva_desde` no es anulable … el hecho 1»* →
  correcta; escritor.
- **`V/02` L254-259** — *«tres de los cuatro hechos no son transiciones»* → **sigue correcta y es
  el motivo de la mitad (a)**.
- **`V/02` L261-265** — *«Se escribe en los cuatro hechos y en ninguna otra parte»* → **es el
  enunciado que la mitad (a) verifica, palabra por palabra**; intacto a propósito.
- **`V/02` L267-272** — el párrafo que nombra al guard por la mitad (a) — *«que sea cerrada lo
  verifica un guard, `G-R6-B`»* → **sigue correcta**, y el de la mitad (b) se escribió **aparte y
  más abajo** en vez de mezclarse acá: son dos listas y cada una dice lo suyo.
- **`V/02` L365-368** y **L370-374** — *«cap. 01 §1.2 la define y enumera los cuatro hechos»*, *«se
  cuentan sobre una columna»* → correctas.
- **`V/02` L427-430 · §4.2 regla 4** — *«se ejecuta en dos momentos, no en uno»* → **sigue correcta
  y sigue siendo la línea que explica por qué «cuatro hechos» no es «cuatro escrituras»**.
- **`V/03` L155-156** y **L271-280** — *«las dos mitades de la guarda»* → homónimos.
- **`V/03` L290-299 · la tabla `PB1`-`PB8`** — `PB4` y `PB5` *«contado sobre
  `listing.inactiva_desde`»* → **siguen correctas y ahora son consumidores inventariados**: están en
  los cinco. `PB2` sigue sin escribir ni leer la columna, que es lo que el caso *(a)* viola a
  propósito.
- **`V/03` L313-322** — *«reinician el reloj escribiendo `listing.inactiva_desde`»* → correcta;
  segundo momento del hecho 2.
- **`V/10` L31-33**, **L62-65**, **`V/15` L56**, **`V/18` L17-20**, **`V/spec` L83-85**, **L92-94**,
  **L122-124** — *«lista cerrada»* del Eje 2 y de las estrategias de agregación → **homónimos**.
- **`V/17` L340-341** — *«las dos mitades van juntas»* → homónimo.
- **`V/19` L57-65 · fila 18** — *«la fecha … que es `listing.inactiva_desde` + 180»* → **sigue
  correcta y es el QUINTO consumidor**, el que el §4 de este rastro identifica con el aviso del
  archivado. Es el único de los cinco que vive fuera de los capítulos `02`, `03` y `07`.
- **`V/20` L68-78** y **L80-89 · los dos párrafos de `G-R6`** — *«los cuatro escritores no son
  cuatro transiciones … y no este guard»* → **siguen correctas y no se tocan**: son el motivo de que
  `G-R6-B` exista, y la segunda sigue diciendo la verdad sobre `G-R6`, que es de quien habla.
- **`V/20` L91-97** — *«esa lista cerrada dejó de ser la única vigilancia»* → sigue correcta; lo que
  cambió está en los párrafos siguientes, que `1bd10b987` reescribió.
- **`V/20` L147-152** — *«`B/20` §2 lo repite como referencia cruzada por la razón de `G-R5`»* →
  **sigue correcta**: la razón del cruce no cambia por ampliarle el predicado al guard.
- **`V/20` L154-161** y **L183-186** — *«igual que `G-R4`»*, *«Es un guard, no dos»* → correctas;
  ninguna afirma cuántas referencias cruzadas hay.
- **`V/spec.md` L51-63**, **L303-308**, **L323-324** — *«diecisiete guards»*, *«los diez que no
  están en esta tabla»*, *«la regla que vale para los diecisiete»* → **siguen correctas y están
  medidas hoy** (§3): la ampliación no agrega filas.
- **`V/spec.md` L69-73** — *«el núcleo … y el método del modelo»* con *«dos mitades»* → homónimo.

### G · La épica de billing (24)

- **`B/02` L528-543** — *«por qué libre y no de lista cerrada»* → homónimo.
- **`B/03` L309-311**, **L396-401**, **L1321-1329**, **L1386-1391**, **L1577-1593** — *«las dos
  mitades»* de una decisión, de una guarda, de una tabla de defectos → **homónimos**.
- **`B/03` L1159-1175 · §7.1** — *«`DEC-DATA-002` le puso a la inactividad cuatro hechos de reinicio
  con lista cerrada»* → **sigue correcta, y esta tanda la refuerza igual que la anterior**: su
  argumento depende de que la lista sea cerrada, y ahora las **dos** mitades tienen guard.
- **`B/03` L1398-1404 · §7.2** — *«que sean TRES y no cero es lo que `G-R6` vigila»* → correcta;
  habla de la fecha del próximo cobro, no de esta columna.
- **`B/09` L232-257** y **L360-401** — *«las dos mitades»* de una relectura y de un *«el que no
  puede fallar»* → homónimos.
- **`B/10` L158-178** y **L204-205** — *«no dice lo mismo que los tres avisos»*, *«los tres avisos
  de `DEC-MP-002`»* → **homónimos**: son los de la discontinuación.
- **`B/19` L79-98** — *«los tres avisos de aumento»* → homónimo.
- **`B/22` L55-63** y **L65-67** — *«los tres avisos de aumento»* → homónimos.
- **`B/20` L94-101** — *«las dos mitades son inseparables en direcciones opuestas»* (`G-R1-C`) →
  homónimo.
- **`B/20` L173-179** — *«`G-R6` es el guard de la COLUMNA MUERTA»* → correcta; es su origen.
- **`B/20` L192-200** — *«la tercera referencia cruzada … `G-R6-B` la cuarta»* → **sigue correcta**:
  son cuatro y siguen siendo cuatro (§3).
- **`B/20` L248-252**, **L254-260**, **L262-265**, **L267-275**, **L277-284 · el bloque de cifras**
  — *«16 · 17 · 29 · 15 con unidad · 14 sin»*, *«14 de 28 → 14 de 29»* → **siguen correctas, y se
  recontaron en vez de darse por buenas** (§3). Ninguna se movió, así que el bloque queda intacto.
- **`B/spec.md` L44-58** — *«dieciséis guards … las cuatro referencias cruzadas»* → sigue correcta.

## 7. Lo que esta ampliación vuelve falso afuera de su alcance

**No se edita un rastro ajeno ni el propio** — son evidencia fechada. Van nombrados acá, que es la
forma que `DEC-METH-011` prevé.

| dónde | qué dice | por qué es falso hoy |
|---|---|---|
| **`rastro-7676082e6.md` §1, fila 4** | *«lo que NO verifica: … y **los cinco consumidores** de la misma lista»* | **la cuarta enmienda se los dio.** El guard los vigila desde `1bd10b987`, con mensaje propio |
| **`rastro-7676082e6.md` §6, pregunta 2** | *«¿Se le agrega esa mitad a `G-R6-B` … o se deja declarada para la FASE 10?»* | **está contestada**: el owner eligió agregársela al mismo guard, el mismo día. La pregunta dejó de estar abierta, y la razón que se escribió —*«las dos mitades fallan distinto y la segunda falla peor»*— es más fuerte que la que la pregunta proponía |
| **`rastro-7676082e6.md` §4, grupo H, entrada `V/02` L274-277** | *«los cinco consumidores … **queda sin guard a propósito**»* | dejó de ser cierto por lo mismo. La entrada describía bien el estado de su SHA |
| **`rastro-7676082e6.md` §2, último párrafo** | *«el guard protege **las escrituras**, y V9 llega después de todas ellas»* | **la conclusión sigue en pie y la razón quedó corta**: protege escrituras **y lecturas**, y tres de los cinco lectores son de V8 y V9. El argumento rehecho —§2 de este rastro— **confirma V6**, así que la celda no se movió |
| **`rastro-7676082e6.md` §6, pregunta 1** | *«¿Se enmienda la cifra en el log … o se declara que `B/20` §2 es el único lugar donde vive el número medido?»* | **contestada por `05fabfe1f`**, que no es de esta tanda: el owner eligió **anclarla al SHA**, que es la tercera salida y ninguna de las dos que la pregunta ofrecía |

**Y una línea del mismo rastro que SIGUE correcta, para que no se lea de más**: §2, *«no verifica
que los cuatro hechos tengan quien los ejecute … pide que cada escritura declare cuál de los cuatro
ejecuta»*. **Eso no cambió y no va a cambiar por esta vía**: es la forma que `DEC-TEST-001` rechazó,
y la cuarta enmienda no la reabre.

## 8. Preguntas para el owner

1. **La mitad (b) se probó contra una lista que hubo que reparar para poder anclarla.** El §4 lo
   documenta: *«los mismos cinco que el cap. 01 §1.2 enumera»* era falso y se retiró, y la partición
   dos + uno de los avisos quedó explicada. **Ninguna de las dos cosas cambia quiénes son los cinco**
   — pero si el criterio es que los **tres** avisos figuren juntos en el renglón y el quinto pase a
   ser otra cosa, la lista se reescribe y el guard cuenta lo mismo. ¿Queda como está?
2. **Ninguna de las dos mitades comprueba que sus miembros declarados existan**, sólo que no haya
   intrusos. Para escritores está decidido —comprobarlo es la forma rechazada—; **para lectores no
   se evaluó**: *«el día 180 no lee la columna»* sería un rojo verificable sin pedirle a nadie que
   declare nada. ¿Se mira en la FASE 10 o se declara fuera de alcance como la otra mitad?
