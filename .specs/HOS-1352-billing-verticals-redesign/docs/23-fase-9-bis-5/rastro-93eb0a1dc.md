---
title: "FASE 9-bis-5 · rastro de la familia 1 — la retención y el piso"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 1 — la retención y el piso

Cierra los críticos **#1**, **#2** y **#3** de la FASE 8-bis-5 y los defectos **`H2`** y **`I1`**
del censo. **Ocho commits sobre el corpus de diseño**, más el de este rastro.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `6dc5aeb70` | **Crítico #1 · `F-8fA1-001`** — `G-R3` gana su mitad *(b)*: la versión de piso de cada vertical **tiene que otorgar** las dos claves de las filas 2 y 3 de su lista cerrada |
| `2e39e6224` | **Crítico #1 · `F-8fA1-002`** (`ALTA`) — *«clase de una clave»* se define en el glosario y pasa a ser el **cuarto atributo declarado** de una clave en el catálogo; `G-R3` lee un atributo en vez de juzgar |
| `a06de6f8b` | **Crítico #3 · `F-8fA3-001`** — el **hecho 2** del reloj queda enunciado como **estado comprobado** y no como cambio detectado, que es lo que sus ejecuciones ya hacían |
| `f89c32631` | **Crítico #2 · `F-8fA2-001`** — el **hard delete del día 180** relee en los cinco lugares donde el mecanismo está escrito, y *«dos momentos, no en uno»* pasa a **tres** |
| `dc6c2f5b9` | **Crítico #3 · `F-8fA3-004`** (`ALTA`) — el **hecho 4** gana ejecutor declarado: el barrido del día del fin de servicio (`B/10` §4.3) |
| `2f4e9543a` | **`H2`** (`MEDIA`) — `G-R6-B` gana la mitad *(c)*: comprueba que sus **cinco lectores declarados sigan leyendo** |
| `6a03ffd82` | **`I1`** (`ALTA`) — el corpus que `G-R6` recorre son **las tablas que los capítulos declaran**, no el subconjunto ya construido |
| `93eb0a1dc` | tres cuantificadores que los arreglos anteriores dejaban al borde (`V/03` §9, `NUCLEO/01` §1.2, `V/15` §3.4) |

---

## 2. Qué se arregló

1. **`G-R3` tiene tres mitades y cada una su mensaje.** *(a)* ninguna de las dos versiones no
   vendibles otorga una clave `COMERCIAL` ni un entitlement medido; *(b)* **la de piso otorga las
   dos claves de las filas 2 y 3** de su lista cerrada; *(c)* la capacidad de activación cumple el
   «si y sólo si». Antes el enunciado era negativo entero más un bicondicional sobre **una** clave,
   y las filas 2 y 3 no nombraban ningún guard: un catálogo sembrado sin ellas pasaba en verde.
2. **La clase de una clave es un atributo declarado, con dos valores y lista cerrada**
   —`COMERCIAL` y `DE_ACCESO`—, definido en `NUCLEO/01` §1.6 al lado de *«entitlement medido»* y
   reglado en `V/15` §3.4. Las dos claves del piso quedan clasificadas `DE_ACCESO` ahí, así que el
   que construya `G-R3` **no tiene que inventar la clasificación** sobre la primera clave de su vida.
3. **El hecho 2 es un estado comprobado.** Su enunciado decía *«`cubierto` pasa a verdadero»* —un
   cambio— y sus escrituras comprueban un valor. Queda elegido el estado, con sus tres razones, y
   queda separado del **evento** de `PB2`/`PB3`/`PB7`, que sí es un cambio y no se toca.
4. **El hard delete del día 180 relee, y lo dicen los cinco lugares.** `V/02` §4.2 regla 4 pasa de
   *«dos momentos»* a **tres**; `V/02` §2.5, `V/03` §9 y `12-contrato…` §3 nombran al tercer actor.
5. **La lista de los cuatro hechos enumera HECHOS, no ejecutores.** Un hecho puede tener varios
   —el 2 tiene tres— sin que la lista crezca, y eso es lo que impide que `G-R6-B` mitad *(a)* se
   ponga en rojo sobre la red en vez de sobre el defecto.
6. **El hecho 4 tiene ejecutor**: el barrido del día del fin de servicio, con tres precisiones —no
   es `PB2`, no es un escritor de más, y sin él el borrado se adelanta hasta 90 días—.
7. **`G-R6-B` vigila la mitad de lectores en las dos direcciones.** La *(c)* falla si uno de los
   cinco declarados dejó de leer. Para escritores la dirección simétrica **sigue rechazada**, con
   la razón de `DEC-TEST-001`.
8. **El dominio de `G-R6` son las tablas declaradas.** Con la otra lectura el guard nacía en rojo
   sobre el camino normal durante `B5` → `B7` → `B8`, y lo que se declara sin verificar es que el
   escritor declarado esté **implementado**.

---

## 3. Qué se grepeó

**Términos NUEVOS que esta familia introduce**: *«clase de una clave»* · `COMERCIAL` /
`DE_ACCESO` como clase · *«la cobertura se comprueba verdadera»* · *«estado leído»* /
*«cambio detectado»* · *«tres momentos, no en uno»* · *«mitad (b)»* y *«tres mitades»* de `G-R3` ·
*«lector declarado que ya no lee»* · *«el barrido del día del fin de servicio»* · *«las tablas que
los capítulos declaran»*.

**Términos VIEJOS que se retiran o se estrechan**, grepeados aparte porque el consumidor no
actualizado no aparece buscando el nuevo: *«clase comercial»* usada sin definición · *«`cubierto`
pasa a verdadero»* y *«pasando a verdadero»* **como el hecho 2** · *«dos momentos, no en uno»* ·
*«las dos filas del reloj releen»* · *«las dos mitades»* de `G-R6-B` · *«La mitad que falta es la
misma en las dos listas»* · *«arranca el reloj de retención»* sin ejecutor · *«del corpus»* en el
predicado de `G-R6` · *«quinto escritor»*.

**Términos de ANCLA**, grepeados porque son los sujetos sobre los que los arreglos se apoyan:
`inactiva_desde` · *«cuatro hechos»* · *«cinco consumidores»* · *«lista cerrada»* · `G-R3` ·
`G-R6` · `G-R6-B` · *«recuperar lo suyo»* · *«versión de piso»* · *«dos versiones no vendibles»* ·
*«hard delete»* · *«hecho 2»* · *«hecho 4»* · *«relee»* / *«releen»* / *«releer»*.

**Alcance**: los **46 archivos** del corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, la partición y los documentos de medición—,
construidos con `fd -e md` sobre los tres directorios quitando los informes de fase (`14-…` a
`23-…`), el PDR, las probes, **el decision log y la matriz** (que el alcance de `DEC-METH-011`
excluye por definición y que las reglas duras prohíben tocar). Con y sin backticks, **incluidos los
once archivos del corpus que la familia toca**, contados con `git diff --name-only`.

**Medido sobre el árbol en `93eb0a1dc`**: **320** líneas con al menos una aparición, repartidas en
**187** párrafos; **55** los tocaron los commits de la familia, **132** no, y son los que van abajo.
La partición se calculó con los rangos `+` de `git diff --unified=0 3518afdef..93eb0a1dc`
proyectados sobre los bloques separados por línea en blanco —el párrafo es la unidad que
`DEC-METH-011` fija—, no a ojo.

> **Una advertencia sobre el barrido.** *«Relee»* / *«releen»* es el término más productivo de la
> familia y también el más contaminado: **31 de las 132** apariciones no corregidas son la regla del
> proveedor —*«releer el recurso en vez de creerle al webhook»*—, que comparte verbo con el reloj y
> no comparte sujeto. Van agrupadas y nombradas como lo que son, porque contarlas como hallazgos
> habría enterrado las que sí son del reloj.

---

## 4. Las 132 apariciones no corregidas, una por una

### Grupo A — *«relee / releen / releer»* del PROVEEDOR, no del reloj · 31 apariciones

**La cita, en las 31, cuantifica sobre un recurso del proveedor** —un preapproval, un pago,
una mutación de monto— **y el cuantificador es correcto para ese sujeto**: son la regla de `B/03`
§10.1 y de `B/06` §4.1, *«el evento es un aviso, se relee el recurso»*. Ninguna de las 31 dice ni
presupone cuántos actos releen **la cobertura**, que es el sujeto de los commits `f89c32631` y
`93eb0a1dc`; releer un preapproval y releer `cobertura()` son dos mecanismos distintos sobre dos
sistemas distintos, y el corpus nunca los mezcló. **Si alguna dijera *«los dos que releen»* o
*«todo lo que relee»*, sería falsa**; ninguna lo dice: todas nombran su recurso.

| archivo | líneas |
|---|---|
| `02-worklog.md` | L494, L682 |
| `03-handoff.md` | L85, L107, L176, L806 |
| `04-open-decisions.md` | L398 |
| `08-phase-1b-code-discovery.md` | L1104, L1120, L2150, L2152, L3008, L4006 |
| `10-evaluacion-de-proveedor.md` | L684, L750 |
| `B/03` | L1773, L1781, L1842 |
| `B/05` | L74, L159, L173 |
| `B/06` | L106 |
| `B/09` | L94, L190 |
| `B/12` | L78 |
| `B/16` | L275 |
| `B/19` | L88 (el aviso de la reapertura), L157 |
| `B/descomposicion.md` | L111 |
| `B/spec.md` | L104 |
| `03-handoff.md` | L162 (*«para no releer los tres commits»*, uso coloquial) |

### Grupo B — *«lista cerrada»* que NO es ninguna de las dos de `inactiva_desde` · 15 apariciones

**Cada una de estas citas cuantifica sobre su propio conjunto y ninguna sobre el de los cuatro
hechos ni el de los cinco consumidores.** Son cuatro conjuntos distintos: el **Eje 2** (ocho
ítems), los **trece motivos** de la marca, los **cuatro inventarios** del glosario y el **motivo de
revocación**, que es deliberadamente **libre y no de lista cerrada**. Los commits de esta familia no
agregaron ni quitaron miembros de ninguno de los cuatro, así que las cuatro cardinalidades siguen
midiendo lo que medían.

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `NUCLEO/01` L682 | *«El Eje 2 es una lista cerrada. Todo lo que no está en ella es Eje 1»* | el Eje 2 son los **ocho ítems** del `NUCLEO/01` §4 y esta familia no tocó ninguno |
| `NUCLEO/01` L391 | *«Esta lista es el control, no un registro»* | es el inventario de *«fila viva»* del §2.4, otro conjunto |
| `NUCLEO/01` L537 | la marca `requiere_conciliación` como **predicado derivado** | es el §2.5, el tercer inventario; su sujeto son marcas, no la columna del reloj |
| `NUCLEO/08` L220-222, L266 | *«Libre y no de lista cerrada»* (motivo de revocación) · *«no es una lista cerrada»* (los dos casos que cortan) | son la decisión de `DEC-GRANT-008` y el corte del barrido; ninguno es una lista de escritores ni de lectores |
| `V/10` L31, L64 | *«lista cerrada de ocho ítems»* · *«caen dentro de la lista cerrada»* | Eje 2 otra vez, con su cardinalidad intacta |
| `V/18` L19 | *«ya ubicó esa diferencia dentro de la lista cerrada del Eje 2»* | ídem |
| `V/spec` L55, L83, L94 | *«el Eje 2 como lista cerrada»* · *«lista cerrada de ocho ítems»* · *«Las dos caen dentro»* | ídem, en el índice y el resumen |
| `B/02` L535-537, L643, L664 | *«por qué libre y no de lista cerrada»* · *«sin nombrar un motivo de esta tabla»* · *«sigue siendo el nombre del predicado»* | los trece motivos de la marca y el motivo libre de revocación; dos conjuntos de billing |
| `B/14` L402 | *«el único acto del corpus que produce este caso es la discontinuación»* | cuantifica sobre los actos que dejan una pausada en un plan que se retira, no sobre escritores de `inactiva_desde`. `dc6c2f5b9` **le agrega a ese mismo acto** una escritura, sin agregar ni quitar actos |

### Grupo C — el día 90 y el día 180 citados como FECHA, sin decir quién relee · 23 apariciones

**Ninguna de estas citas cuantifica sobre actores ni sobre relecturas**: todas nombran el borrado
por su fecha —o la desigualdad que lo separa del tope de pausa— y siguen siendo verdaderas con tres
actores exactamente igual que con dos, porque **ninguna dice cuántos son**. Las incluyo una por una
porque el barrido las devuelve y porque la tentación era descartarlas en bloque como *«homónimas»*:
no lo son, hablan del mismo reloj; lo que pasa es que hablan de **cuándo** y no de **quién**.

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `05-phase-1a` L948, L967, L971 | *«hard delete a los 180»*, *«el §25 ordena hard delete a los 180 días»*, *«el hard delete no elimine nada»* | es la lectura del PDR que abrió `M-DATA-01`; describe la orden, no su ejecución |
| `NUCLEO/01` L48 | *«el reloj del §25 … el que disparan `PB4` (día 90) y `PB5`, y sobre el que se cuenta el día 180»* | enumera **quién dispara el archivado** —`PB4` y `PB5`, que son dos y siguen siendo dos— y del día 180 dice que *«se cuenta sobre»* el mismo reloj, que es cierto. **No dice que sólo `PB4` y `PB5` relean** |
| `NUCLEO/01` L153, L159 | *«sigue corriendo hasta el hard delete del día 180»* · *«se reinicia al salir de ella por el hecho 2»* | es el caso de la pausa: el reloj corre y el hecho 2 lo reinicia. Con el hecho 2 leído como estado, *«al salir de la pausa»* sigue siendo cuando se comprueba verdadero |
| `NUCLEO/01` L288 | *«día 180 hard delete de lo eliminable, con dos avisos previos»* | los avisos de `DEC-DATA-001`; su conteo lo fija `NUCLEO/07` §6 y esta familia no lo movió |
| `NUCLEO/01` L650-655 | *«Lo que la salva es que la cobertura vuelva antes del 180 … 120 < 180 … cada reanudación reinicia el reloj»* | `D16` y su cuenta. La relectura del día 180 **no cambia la desigualdad**: es una red adicional sobre el mismo número |
| `NUCLEO/04` L45, L142 | invariante 2 (*«ni siquiera en el hard delete del día 180»*) y `D16` | el primero cuantifica sobre **la fila de `trial`**; el segundo sobre **dos cifras de configuración**. Ninguno sobre relecturas |
| `NUCLEO/07` L284 | *«si la suspensión cruzó el día 180, el hard delete ya se llevó el contenido»* | describe el desenlace cuando **no** hubo cobertura que releer; con cobertura, la relectura nueva lo evita, que es la dirección en que el arreglo mejora esta frase sin volverla falsa |
| `NUCLEO/08` L61 | *«si la auditoría guardara copias del contenido, el hard delete del §25 no…»* | es la razón de modelo de `domain_event`; sujeto distinto |
| `V/02` L412, L417, L458 | *«soft delete a los 90 y hard delete a los 180»* · *«el hard delete no eliminaría nada»* · *«exportar antes es lo que hace defendible el hard delete»* | las tres son sobre **qué** se borra y por qué es defendible, no sobre quién relee |
| `V/03` L344, L414 | *«el día 180 el hard delete les borraba el contenido»* · *«seguía hasta el hard delete del día 180»* | los dos son relatos del desenlace **anterior** a `DEC-DATA-002`/`DEC-DATA-003`, en pasado |
| `B/03` L458, L1036 | *«el día del hard delete (cap. 04 §3)»* · *«4 pausas-mes, unos 120 días, contra 180»* | `D16` visto desde billing; dos cifras |
| `B/09` L434-441 | *«`G-R5` sigue en verde en ese escenario, y tiene razón: no es su pregunta»* + *«con el reloj de inactividad corriendo hacia el hard delete del día 180»* | cuantifica sobre **lo que `G-R5` compara** —dos cifras— y declara explícitamente la mitad que no cubre. La relectura nueva no es una cifra y no entra en ese predicado |
| `B/12` L60 | *«S4 → `GRACE_PERIOD`, y ahí arranca el reloj»* | es el reloj del grace, no el de inactividad |
| `13-pliego` L110 | *«los tres momentos pueden no coincidir»* | homónimo literal de *«tres momentos»*: son los tres momentos fiscales de una suscripción |
| `NUCLEO/04` L205 | *«en tres momentos distintos»* | homónimo: los tres momentos en que un dato parece válido y no lo es |

### Grupo D — la lista de los cuatro hechos y la de los cinco consumidores · 14 apariciones

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `NUCLEO/01` L50 | *«**Los cuatro hechos** que reinician la inactividad, y la lista es cerrada»* | el encabezado cuantifica **hechos**, y siguen siendo cuatro: `a06de6f8b` reemplazó el enunciado del segundo y no agregó ni quitó filas; `f89c32631` y `dc6c2f5b9` agregaron **ejecutores**, que es lo que el mismo § declara ahora que la lista **no** cuenta |
| `NUCLEO/01` L104-111 | *«El hecho 2 se lee de la CONSULTA y nunca del aviso … el aviso despierta el recálculo, y el recálculo vuelve a preguntar»* | es exactamente la lectura de estado que `a06de6f8b` eligió. La cita no dice *«y nadie más pregunta»*: dice qué hace el aviso |
| `NUCLEO/01` L114 | *«y el hard delete del día 180 **releen la cobertura** … en el momento de ejecutar»* | es la línea que era única en el corpus y que los otros cuatro lugares ahora acompañan; su cuantificador —tres actores— es el que quedó |
| `NUCLEO/07` L86 | *«el reloj de retención se reinicia por cualquiera de los **cuatro hechos**»* | *«cualquiera de los cuatro»* cuantifica sobre hechos y sigue siendo exacto; ninguna de las tres relecturas es un quinto hecho |
| `NUCLEO/07` L223-226 | la fila de retención (*«los tres contados sobre `listing.inactiva_desde`»*) y las tres filas vecinas | los **tres avisos** de retención son los de `DEC-DATA-002` y siguen siendo tres; la fila cuenta **avisos**, no lectores ni escritores. `DEC-DATA-004` ratificó el reparto que hace que el renglón de `V/02` §2.5 diga *«dos»* sin contradecirla |
| `NUCLEO/07` L243 | *«y **desde cuándo se cuentan los 180** — que es `listing.inactiva_desde`»* | es el quinto consumidor de la lista de `V/02` §2.5, la superficie que imprime la fecha. Sigue leyendo, que es justo lo que la mitad *(c)* nueva vigila |
| `V/02` L282 | la fila de `listing` (*«`inactiva_desde` no es anulable … nace con el instante de su creación, que es el hecho 1»*) | cuantifica sobre la nulabilidad y sobre el hecho 1; ninguno de los dos se movió |
| `V/02` L287-290 | *«un «más reciente de cuatro» no se deriva de ninguna máquina: **tres de los cuatro hechos no son transiciones** de publicación y el cuarto es de la otra épica»* | cuenta **hechos contra transiciones** y sigue dando 3 y 1. El ejecutor que `dc6c2f5b9` le puso al hecho 4 **es un barrido, no una transición**, así que confirma el renglón en vez de moverlo |
| `V/02` L294 | *«Se escribe en los cuatro hechos y en ninguna otra parte»* | sobrevive entera: los tres actos que releen escriben **el hecho 2**, y el barrido del fin de servicio escribe **el hecho 4**. El párrafo que `f89c32631` insertó arriba es el que lo dice sin ambigüedad |
| `V/02` L307-312 | *«La lista **no** la vigila `G-R6` … de estos cuatro hechos **uno solo es una transición**, así que queda verde por ése»* | el reparto 1/4 no se movió, por lo mismo del renglón anterior |
| `V/02` L314-322 | *«Y la leen **cinco** consumidores, y esta lista también es cerrada»* con su paréntesis explicativo | **ratificada por `DEC-DATA-004` `H1`** y no tocada. Los tres commits que agregan relecturas no agregan **lectores**: `PB4`, `PB5` y el día 180 ya figuraban en los cinco. El párrafo que `f89c32631` insertó debajo dice explícitamente que estar en una lista no saca de la otra |
| `V/02` L333-337 | *«Quien agregue una lectura de `inactiva_desde` agrega su fila en el mismo acto»* | es la mitad *(b)*, y sigue siendo exacta para lo que cuantifica: **agregar**. La dirección contraria —sacar— la agrega el párrafo que `2f4e9543a` puso a continuación, y no contradice a ésta |
| `V/03` L294-299 | las filas `PB3`, `PB4`, `PB5`, `PB6`, `PB7`, `PB8` | `PB3` y `PB7` disparan por *«`cubierto` **pasa a** verdadero»* y eso **se conserva a propósito**: el evento de una transición es un cambio. `PB4` y `PB5` dicen *«relee la cobertura antes de archivar»*, que sigue siendo verdadero de las dos filas de esta máquina |
| `B/03` L1166-1173 | *«`DEC-DATA-002` le puso a la inactividad **cuatro hechos de reinicio** con lista cerrada … el primero es «un acto del dueño»»* y el punto 3 sobre `D16` | las dos citas cuantifican sobre **hechos** y sobre **dos cifras**; los cuatro hechos siguen siendo cuatro y `G-R5` sigue comparando las mismas dos |

### Grupo E — `G-R3`, la versión de piso y sus tres cosas · 19 apariciones

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `02-worklog` L970 | *«ampliar `G-R3` para que cubra **las dos** versiones no vendibles»* | es el registro de lo que se hizo en la FASE 9; *«las dos»* cuantifica sobre **versiones vigiladas** y sigue siendo dos — la mitad *(b)* nueva alcanza sólo a la de piso y no agrega una tercera versión |
| `03-handoff` L336 | *«`G-R3` ampliado a las dos»* | ídem, en el handoff |
| `12-contrato` L94 | la fila de `cubierto` (*«`PB2`, `PB3` y `PB7` —en su primera rama…—; … y el reloj de inactividad, que se reinicia cuando **la respuesta** trae este campo en verdadero»*) | ya decía *«la respuesta … en verdadero»*, que es un estado: es el consumidor mejor escrito del hecho 2 y `a06de6f8b` lo ratifica en vez de moverlo |
| `12-contrato` L250 | el blockquote de `BASE` (*«Transporta la referencia a la versión de piso … su `hasta` es `NO_VENCE`»*) | cuantifica sobre qué transporta la fuente, no sobre qué otorga la versión |
| `12-contrato` L264-267 | *«No otorga ninguna clave comercial … las **tres** cosas de su lista cerrada … `G-R3` se comprueba sobre las **dos versiones no vendibles** de cada vertical, no sobre una»* | las **tres** cosas siguen siendo tres y las **dos** versiones siguen siendo dos: `6dc5aeb70` agregó un predicado, no una fila ni una versión. El párrafo que ese mismo commit insertó debajo es el que dice que las filas 2 y 3 también tienen guard |
| `V/02` L132 | *«…capacidad comercial—, **la capacidad de activación de la vertical**, y la de contratar una suscripción»* | es la lista de la versión de **pre-trial**, que la mitad *(b)* **no** alcanza — y el blockquote nuevo lo dice con esas palabras |
| `V/02` L179 | *«Otorga exactamente lo mínimo para que alguien exista … **pueda recuperar lo suyo** y pueda volver a contratar»* | el encabezado de la lista de tres, intacto: el arreglo exige que se cumpla, no cambia qué es |
| `V/02` L386-387 | *«si a la versión de piso se le sembró una clave comercial —el escenario exacto que `G-R3` dice vigilar—, retirarla no invalidaba nada»* | cuantifica sobre la mitad *(a)* y sobre la invalidación del caché; la *(b)* no siembra ni retira nada |
| `V/03` L425 | la celda *«con qué la autoriza … **la versión de piso**, «recuperar lo suyo» — su población **no tiene ninguna otra**»* | *«no tiene ninguna otra»* cuantifica sobre las fuentes de la población de `PB8` y es lo que vuelve indispensable la mitad *(b)*; sigue siendo exacto |
| `V/10` L129 | *«el grant y las dos versiones no vendibles **resuelven lo que alguien tiene**»* | cuantifica sobre quién resuelve, no sobre qué otorga |
| `V/17` L157-158 | *«Se le contesta en el paso 6, porque la versión de piso de Alojamiento **no otorga ninguna capacidad comercial**»* | es la mitad *(a)* aplicada al cruce de verticales y sigue siendo verdadera; la *(b)* obliga a lo que la de Alojamiento **sí** otorga, que es por vertical |
| `V/17` L163-165 | el blockquote *«…no abre este cruce por otra puerta, por **dos razones independientes**»* | las dos razones —por vertical y sobre ficha propia— no dependen de si hay guard: siguen siendo dos y siguen siendo independientes |
| `V/19` L64 | la fila 18 del catálogo de superficies | cuantifica sobre qué dice el aviso de archivado; ninguna de sus cláusulas nombra guards |
| `V/20` L217-218 | *«`G-R3` es el que más carga lleva … si alguien siembra una de esas dos versiones con una clave comercial, toda la plataforma la recibe gratis»* | el párrafo que `6dc5aeb70` insertó **inmediatamente debajo** es el que agrega la otra dirección. Éste sigue siendo verdadero de lo que cuantifica: la siembra de más, sobre las dos versiones |
| `V/spec` L155 | *«…aunque no pague nada, porque la versión de piso otorga «recuperar lo suyo»»* | la afirmación es la misma que `V/17` §1.2 hacía con la palabra *«hoy»*; acá no la tiene, así que no depende del catálogo de un día |
| `V/spec` L263-265 | *«Y otorga TRES cosas, no dos … La tercera es la que vuelve ejecutable la defensa del hard delete»* | **tres** sigue siendo tres, y *«vuelve ejecutable»* es justamente lo que la mitad *(b)* pasa a exigir |
| `V/descomposicion` L147-154, L156-162 | la tabla de asignación (*«`G-R3` → V2»*) y su razón (*«su sujeto nace ahí y no antes»*) | la asignación **no se mueve** y se verificó contra el criterio 2 de la quinta enmienda de `DEC-TEST-001`: el atributo `clase` vive en el catálogo de claves, que deja funcionando **`V1`**, y `V1` corre antes que `V2`. Queda dicho en `V/15` §3.4 (commit `93eb0a1dc`) para que nadie repita el error de `G-R5` |
| `V/descomposicion` L312 | *«una ficha `ARCHIVED` le acepta a **su** dueño verla, exportarla y reactivarla … porque la versión de piso lo otorga»* | es el criterio de aceptación de `V5`; que la versión de piso lo otorgue pasó de ser un hecho del catálogo a una obligación con guard, lo que vuelve **más** verificable este criterio sin cambiar su enunciado |

### Grupo F — `G-R6` y `G-R6-B` en catálogos y descomposiciones · 22 apariciones

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `V/20` L68-77 | *«`G-R6` llega a este catálogo por una columna concreta … con **cuatro escritores** y **cinco consumidores**»* | los dos números siguen siendo cuatro y cinco: **el «cuatro» cuenta los hechos**, que es lo que `V/02` §2.5 enumera, y el «cinco» es la lista ratificada por `DEC-DATA-004`. `93eb0a1dc` dejó escrito en `NUCLEO/01` §1.2 que lo enumerado es el lado que escribe y son hechos, no ejecutores, para que este renglón no se lea como un censo de actores |
| `V/20` L85-88 | *«sobre `inactiva_desde` el guard queda **verde por el tercero solo** … nunca «los cuatro hechos la escriben»»* | el reparto es el mismo: de los cuatro hechos sólo el tercero es una transición. El ejecutor nuevo del hecho 4 es un **barrido** |
| `V/20` L91-94 | *«si `G-R6` queda verde por un escritor de cuatro, a los otros tres no los mira nadie»* | ídem; la proporción 1 de 4 no se movió |
| `V/20` L108 | *«el sujeto de `R6` son «las columnas que una condición lee» y el de éste es **quién toca una columna**»* | sigue siendo la separación de sujetos, y la mitad *(c)* nueva es del mismo sujeto: quién toca la columna |
| `V/20` L180 | *«`DEC-DATA-002` le puso a la inactividad cuatro hechos de reinicio con lista cerrada»* citado desde `B/03` §7.1 | cuenta hechos |
| `V/descomposicion` L55-62 | la tabla de las nueve unidades (`V2` con `G-R3`, `V4` con `G-R6`, `V9` con la retención) | ninguna asignación cambia; la de `G-R6` a `V4` se apoya en que *«ninguna condición de V4, V6 o V7 lee una columna que sólo escriba billing»*, que `6a03ffd82` no toca |
| `V/descomposicion` L82, L103, L210, L219, L232, L247 | las referencias sueltas a `G-R4`/`G-R6`, el título del §2.5, `G-R3-B`, `G-R3-C`, `G-R5` y el cierre del §2.7 | cada una cuantifica sobre su guard y su unidad; ninguna sobre el dominio de `G-R6` ni sobre las mitades de `G-R6-B` |
| `V/descomposicion` L254-255 | *«`G-R6` tiene un predicado global y el corpus se construye por partes»* | es el enunciado del defecto, y **queda a propósito**: el § que lo contiene fue reescrito para decir que era un defecto y no una pregunta, y el diagnóstico sigue siendo el correcto. Lo que cambió es el § de abajo, que ahora lo resuelve en vez de dejarlo abierto |
| `B/20` L173-174 | *«`G-R6` es el guard de la COLUMNA MUERTA … ninguna escritura del corpus avanzaba esa columna»* | describe `F-8eB1-002`, que es un defecto **de las tablas declaradas** —ningún capítulo escribía la columna— y por eso el guard lo sigue atrapando con el dominio que `6a03ffd82` fija |
| `B/20` L224-229 | *«el dominio del guard ya no es este catálogo … la tercera referencia cruzada»* | cuantifica sobre las **épicas** que el guard alcanza y sobre el conteo de referencias cruzadas, que siguen siendo cuatro |
| `B/03` L1398 | *«Y que sean TRES y no cero es lo que `G-R6` vigila»* | las **tres** escrituras de la fecha del próximo cobro siguen siendo tres, y son las que hacen que el guard esté verde: es exactamente el caso que `6a03ffd82` usa para fijar el dominio |
| `B/03` L119 | la fila `S4` (*«en un pagador manual eso es que `MP5` abrió la cuota…»*) | es la condición que lee la columna; que su escritor sea de `B8` es el caso medido de `I1` y queda verde con el dominio declarado |
| `B/03` L1682 | *«no aparece en ninguna otra parte del corpus»* | homónimo de *«del corpus»*: cuantifica sobre un acto, no sobre el dominio de un guard |
| `B/descomposicion` L375, L400-402 | la razón de `G-R5` en `B8` y el precedente *«dónde se construye un guard y qué documento define su lista son dos preguntas distintas»* | las dos siguen valiendo, y la segunda es la que se usó para verificar que `G-R3` puede quedarse en `V2` con su atributo naciendo en `V1` |
| `B/10` L193, L208-210 | el blockquote *«Esto NO es el retiro de un plan del §3»* y el párrafo *«El día del fin de servicio … arranca el reloj de retención»* | el primero cuantifica sobre **qué acto** produce el caso; el segundo describe el día, y el párrafo que `dc6c2f5b9` insertó debajo es el que le pone ejecutor a esa frase sin desmentirla |

### Grupo G — los conteos congelados de guards · 5 apariciones, RECONTADAS

**Ninguno se movió, y está recontado y no deducido.** Los commits de esta familia **no agregan ni
quitan filas de guard**: `G-R3` gana dos mitades sobre la fila que ya tenía y `G-R6-B` gana un
tercer predicado sobre la suya. Recontado el 2026-09-23 sobre el árbol en `93eb0a1dc` con el
recorrido de filas de siempre (`^\| \**(G[-A-Z0-9]+)\**` sobre el rango de cada tabla):

| | cuántos | ¿se movió? |
|---|---|---|
| filas de `B/20` §2 | **16** | no |
| filas de `V/20` §2 | **17** | no |
| **guards distintos** | **29** | no — 16 + 17 menos las **cuatro** referencias cruzadas |

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `B/20` L291-294 | la tabla de conteos (*«16»*, *«17»*, *«29»*, *«con unidad: 29»*) | las tres primeras cifras están recontadas arriba; la cuarta no se toca porque esta familia no reasigna ninguna unidad |
| `B/20` L308 | *«las filas que igual nombran su unidad —`G12`, `G13`, `G-R6-B` y `G-R5`— lo hacen como referencia»* | cuantifica sobre **cuatro filas nombradas**, y ninguna de las cuatro cambió de unidad |
| `B/20` L315, L318-322, L340 | *«el denominador pasó de 26 a…»*, *«14 de 28 → 14 de 29»*, *«sin unidad son catorce»* | son mediciones **ancladas a un momento** —la FASE 9-bis-4— y lo dicen; describen un movimiento pasado, no el presente, que es la forma que `DEC-TEST-001` eligió justamente para que no caduquen |

### Grupo H — apariciones sueltas que ninguna de las anteriores cubre · 3

| archivo · § | cita | por qué sigue siendo correcta |
|---|---|---|
| `04-open-decisions` L270 | *«lista cerrada de ocho ítems; todo lo demás es Eje 1»* | Eje 2 |
| `V/03` L44 | la fila `T1` (*«la vertical declara evento **y** su plan de trial tiene días > 0 **y** `cubierto` es falso»*) | es el antecedente del *«si y sólo si»* que `G-R3` mitad *(c)* verifica, y esa mitad **no cambió**: `6dc5aeb70` la renombró de mitad única a *(c)* y conservó su predicado palabra por palabra |
| `V/02` L429-431 | *«El hecho 2 se resuelve **preguntándole al contrato**, nunca leyendo el aviso que lo empuja, y `PB4` y `PB5` vuelven a preguntar en el momento de archivar»* | *«`PB4` y `PB5`»* acá cuantifica sobre **quién archiva**, y archivar lo hacen esos dos y nadie más — el día 180 no archiva: borra. La frase no dice *«y nadie más pregunta»*; el §4.2 regla 4, dos páginas abajo y reescrito por `f89c32631`, es el que enumera los tres momentos |

---

## 5. Premisas ajenas que el arreglo volvió falsas, y se corrigieron en el mismo acto

**Cinco, y las cinco están ejecutadas enteras. Cada fila se verifica con un `rg` y sin razonar.**

| premisa que quedó falsa | dónde vivía | qué se hizo, entero |
|---|---|---|
| *«El reinicio … **se ejecuta en dos momentos, no en uno**»* — el hard delete releía y ese renglón lo dejaba afuera | `V/02` §4.2 regla 4 | reescrito a **tres momentos**, con el párrafo que explica por qué el tercero es el que no puede faltar (`f89c32631`) |
| *«las **dos filas del reloj** releen antes de actuar»* — leído como *«los dos únicos que releen»* | `V/03` §9 | la frase gana *«y no son las únicas que releen, sólo las únicas que tienen fila acá»* **y** un párrafo que declara al tercer actor (`f89c32631` + `93eb0a1dc`) |
| *«las **dos filas** que actúan sobre ese reloj vuelven a preguntar»* | `12-contrato…` §3 | reescrito a **los tres actos**, nombrando al hard delete (`f89c32631`) |
| *«lo que se enumera acá son **escritores**»* — colisionaba con *«la lista enumera hechos, no ejecutores»*, que es lo que vuelve bien definida la mitad *(a)* de `G-R6-B` | `NUCLEO/01` §1.2 | reescrito a *«el lado que ESCRIBE, y son hechos y no ejecutores —un hecho puede tener varios, y el 2 tiene tres—»* (`93eb0a1dc`) |
| *«**La mitad que falta es la misma en las dos listas**: ninguna de las dos comprueba que sus miembros declarados existan»* — deja de ser cierta para lectores | `V/20` §2 | reemplazada por los dos casos separados: para escritores sigue rechazada con su razón, para lectores entra como mitad *(c)* (`2f4e9543a`) |

**Y una que NO se volvió falsa aunque lo parezca, verificada antes de tocar nada**: la lista de los
**cinco consumidores** de `V/02` §2.5 y el criterio de orden entre `PB3` y `PB7` están **ratificados
por `DEC-DATA-004`** (2026-09-23) y no se tocaron. Que tres de los cinco lectores además escriban
no agrega ni quita consumidores, y el párrafo que lo aclara lo dice con esas palabras.

**Y otra que conviene declarar aunque sea propia**: el renglón de `V/20` §2 que llamaba a `PB2`
*«el quinto escritor más creíble de todos»* perdió su ordinal, porque con hechos y ejecutores
separados *«quinto»* dejaba de tener un conjunto que lo sostuviera. Dice ahora *«el escritor de más
creíble de todos»*, sin número.

---

## 6. Lo que este rastro vuelve falso de los anteriores

**Dos líneas de la 9-bis-4, las dos del rastro de la retención.**

1. **`rastro-5836ec219.md` §2, sobre `V/02` L210 y `V/20` L59** — declaraba correctas las dos
   apariciones de *«clase comercial»* con la justificación *«recuperar lo suyo no es una clave
   comercial ni un entitlement medido»*. **La justificación no era falsa y el juicio era
   defendible**, pero aplicaba una clasificación que ningún capítulo definía: era el `ALTA`
   `F-8fA1-002`. Desde `2e39e6224` la clasificación existe como atributo declarado, así que esas
   dos líneas pasan de *«presuponen resuelto lo que no está escrito»* a apoyarse en `V/15` §3.4.
2. **`rastro-5836ec219.md` L245-246, sobre `V/02` §4.2 regla 4** — decía *««Lo que reinicia la
   inactividad es `cubierto` pasando a verdadero» → sigue correcta»*. **La cita ya no existe con
   esas palabras**: `a06de6f8b` la reemplazó por *«la cobertura comprobada verdadera»*. La línea del
   rastro no era falsa el día que se escribió —lo era su alcance, que resolvía *«de dónde se lee»* y
   no *«con qué predicado se escribe»*— y hoy quedó sin sujeto.

**Y una del rastro de los guards.** `rastro-12cc0879f.md` y `rastro-31ce26bb2.md` describen
`G-R6-B` como *«las dos mitades»*; desde `2f4e9543a` son **dos mitades con tres predicados**. El
conteo de guards **no se movió** —sigue siendo 29—, que es lo que esos rastros medían.

---

## 7. Preguntas para el owner

**Tres, y las tres van también en la respuesta al orquestador, no sólo acá.**

1. **`F-8fA3-002` queda vivo y sin familia asignada.** Elegir el predicado de **estado** para el
   hecho 2 —que es lo que las tres escrituras ya hacían, y lo que evita que `G-R6-B` se ponga en
   rojo sobre la red— deja en pie que **`PB4` relee, encuentra cubierto al dueño del excedente y no
   archiva nunca**, con lo que la segunda rama de `PB7` no tiene población y la retención del §25 no
   corre sobre esos datos. **No lo introduje**: `V/03` §9 y `V/02` §4.2 ya preguntaban por el
   `user + vertical` antes de esta familia. Pero tampoco lo cierro, y el reparto de la 9-bis-5 no se
   lo asigna a ninguna de las siete familias. **¿A quién va?** El arreglo probable toca el sujeto de
   la relectura —por ficha y no por `user + vertical`—, que es terreno de `PB3`, `PB4` y `PB7`.
2. **La `clase` de una clave es un atributo nuevo del catálogo y eso es una decisión de modelo.**
   La escribí porque sin ella el predicado de `G-R3` no se puede formar y el `ALTA` no se cierra, y
   la apoyé en el precedente del scope y la estrategia de agregación (`V/15` §2.3 y §3.2) y en que
   `NUCLEO/02` §1.2 prohíbe **valores, precios y asignaciones** en código y no metadatos de una
   clave. **Queda pedir la ratificación**, como `DEC-DATA-004` hizo con las tres formas de la tanda
   anterior: dos valores (`COMERCIAL` / `DE_ACCESO`) y lista cerrada, o tres si aparece una clave
   que no caiga en ninguno.
3. **El dominio de `G-R6` lo fijé sin consultar, y la alternativa que descarté era una de las dos
   que el censo ofrecía.** `I1` proponía *«evaluar sobre las máquinas existentes»* o *«rojo
   informativo»*; escribí una tercera —**las tablas declaradas**— porque las dos primeras o pierden
   la propiedad de diseño o dejan meses sin nadie mirando. La contrapartida está declarada en
   `B/20` §2 y es real: **un escritor declarado y no implementado pasa en verde, y esa clase no la
   vigila ningún guard del programa.** Si el owner quiere esa clase vigilada, es un guard nuevo y
   `DEC-TEST-001` es la entrada donde se decide.
