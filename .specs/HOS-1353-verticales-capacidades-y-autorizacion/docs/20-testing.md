---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 20
---

# 20 · Estrategia de testing

Mitad **VERTICALES** del capítulo 20 del programa. La otra mitad vive en la otra épica.

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
| G1 | una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2 | cap. 01 §4.4 (núcleo) |
| G2 | una operación de dominio **no declara** su contexto de vertical | cap. 17 §2.3 (épica de verticales) |
| G3 | una clave usada en código **no existe en la base**, o una de la base **no existe en el catálogo** — las dos direcciones | cap. 02 §1.2 |
| G4 | una transición de suscripción o de trial **escribe roles** | cap. 17 §4.4 (épica de verticales) |
| G5 | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes | cap. 15 §4.2 (épica de verticales) |
| G6 | una autorización **decide sólo por rol** | invariantes §64.12 y §64.13 |
| G8 | aparece `commerce` en fuentes activas | invariante §64.32, §55 |
| G-R2 | el pliegue del conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto no tiene ninguna de clase `TÍTULO` viva — en cualquiera de sus dos tramos | cap. 15 §2.6 |
| G-R2-B | una fuente `GRANT` transporta **un plan de otra vertical** que la de la fuente | cap. 15 §2.5, `12-contrato…` §2.8 |
| G-R3 | **tres mitades, con tres mensajes**. **(a)** una de las **dos versiones no vendibles** de una vertical —la de pre-trial o la de piso— otorga una clave de la clase comercial o un entitlement medido; **(b)** la versión de piso de una vertical **no otorga** alguna de las **dos claves** que las filas 2 y 3 de su lista cerrada declaran —*«contratar una suscripción»* y *«recuperar lo suyo»*—; **(c)** la capacidad de activación no cumple el «si y sólo si» | cap. 02 §2.1 |
| G-R3-B | una transición **disparada por el reloj** otorga algo, en vez de quitar | cap. 17 §3.4 |
| G-R3-C | una **operación de dominio no declara** si pasa por el paso 5 | cap. 17 §3.5 |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** — sobre las nueve máquinas, en las dos épicas | cap. 03 §1 regla 7 (núcleo) |
| G-R4-B | una condición o un evento de una máquina de **la épica de verticales** nombra un **estado de la suscripción** o de la instancia de addon | `12-contrato…` §4 |
| G-R5 | el **tope de una pausa** que declara el catálogo, pasado a días, **alcanza el día del hard delete** de la retención | `D16` (cap. 04 §3, núcleo), cap. 03 §5 (épica de billing), cap. 02 §4.1. **Lo construye `B8`** de la otra épica, que es la unidad del tope de pausa (`B/descomposicion.md` §2.8) — **la celda de `V9` que lo nombraba *«el de `D16`»* se retira**, porque `V9` corre antes de que ese número exista (`F-8eC2-004`, `descomposicion.md` §2.7) |
| **G-R5-B** | el **`N` de `PB5`** que declara la configuración, pasado a días, **no es menor que 6 meses** | cap. 03 §9 (`PB5`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25. **Misma forma que `G-R5`**: compara una cifra de configuración contra una cota, y ninguna búsqueda de texto lo vería cambiar. **Lo construye `V6`**, la unidad que construye `PB5` y su `N` (`descomposicion.md` §2) |
| G-R6 | una **condición de transición lee una columna que NINGUNA transición escribe** — sobre las **nueve** máquinas, en las dos épicas, y contra **las tablas que los capítulos declaran** y no contra el subconjunto ya construido (`B/20` §2) | `DEC-TEST-001` y su ampliación del mismo día, `B/03` §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: lo define `B/20` §2, donde nació. Figura acá porque **la columna que más caro sale muerta es de esta épica**: `listing.inactiva_desde` (cap. 02 §2.5) |
| **G-R6-B** | **las DOS mitades de la lista cerrada de `listing.inactiva_desde`** (cap. 02 §2.5). **(a) Escritores**: una escritura de la columna —el efecto de una transición, un camino de servicio o un barrido— que **no sea uno de los ~~cuatro~~ cinco hechos** del cap. 01 §1.2 (núcleo) **ni la escritura `C` del corte en la migración estructural del corte** —el quinto, ~~**la primera rama de `PB2`**~~ **la pérdida de cobertura del dueño en la vertical**, entra a la lista **con sus dos ejecutores** —la primera rama de `PB2` sobre la ficha publicada y el recálculo que el aviso despierta sobre las demás del dueño— y la segunda rama de `PB2` sigue afuera (FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, owner 2026-09-25)—. **(b) Consumidores**: una lectura de la columna que **no figure entre los ~~cinco~~ seis consumidores** que el cap. 02 §2.5 enumera y cierra (recontados, `F-8CD1-009`). **(c) Consumidores que dejaron de serlo**: uno de esos **~~cinco~~ seis** que **ya no lee** la columna. **El mensaje nombra la mitad que falló** — *«escritor fuera de la lista»*, *«lector fuera del inventario»* o *«lector declarado que ya no lee»*, nunca uno solo para las tres | `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; cap. 02 §2.5 —*«se escribe en los ~~cuatro~~ cinco hechos —y en la escritura única del corte— y en ninguna otra parte»*, *«y la leen ~~cinco~~ seis consumidores»*—; `DEC-DATA-002`. Lo construye **V6** (`descomposicion.md` §2). `B/20` §2 lo repite como referencia cruzada |

**`G-R6` llega a este catálogo por una columna concreta y no por simetría, y conviene decir cuál.**
Nació en `B/20` §2 acotado a las seis tablas de billing, porque el crítico que lo motivó era de
billing: `MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura del corpus
avanzaba esa columna**, así que el pagador manual pagaba una vez en la vida y seguía cubierto para
siempre (`F-8eB1-002`). La ampliación no se pide porque *«también podría pasar acá»* —eso vale para
cualquier guard— sino porque **acá vive el candidato más fresco del corpus**: `listing.inactiva_desde`,
la columna que `DEC-DATA-002` creó **el mismo día** que esta decisión, con **cuatro escritores** y
**cinco consumidores** —hoy **cinco hechos más la escritura del corte** y **seis consumidores**
(FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, `F-8CD1-009`, owner 2026-09-25)— (cap. 02 §2.5, que
enumera las dos listas y las cierra). Y sobre todo: **lo
que esa columna decide es el borrado irreversible del contenido de una ficha** — `PB4` archiva en
`inactiva_desde + 90` y el hard delete borra en `inactiva_desde + 180` (cap. 02 §4.1). En billing la
clase costó dinero; **acá cuesta datos sin vuelta**, y ésa es la diferencia que justifica la fila.

**Y hay que decir qué NO afirma el guard sobre esta columna, porque los ~~cuatro~~ cinco escritores
no son ~~cuatro~~ cinco transiciones.** El predicado es *«al menos una transición la escribe»*, y
de los ~~cuatro~~ cinco hechos de reinicio del cap. 01 §1.2 (núcleo) **sólo el tercero** —la ficha
vuelve a `PUBLISHED` por `PB1`, `PB3` o `PB7`— ~~**y el quinto** —la primera rama de `PB2`, FASE 8
completa, `F-8CA2-001`, owner 2026-09-25— son transiciones~~ es una transición entera, **y el
quinto lo es a medias**: sobre la ficha publicada lo ejecuta la primera rama de `PB2`
(`F-8CA2-001`), y sobre las demás fichas del dueño en la vertical el recálculo que el aviso
despierta, que no es una transición (FASE 8 completa, owner 2026-09-25). El primero se lee del registro de
eventos de dominio, el segundo de la respuesta del contrato y el cuarto de
`vertical.fin_de_servicio`; la escritura del corte es de la migración. Así que sobre
`inactiva_desde` el guard queda **verde por ~~el tercero solo~~ cualquiera de los dos** —`PB1`/`PB3`/`PB7`
o `PB2`—, sin mirar al recálculo que ejecuta la otra mitad del quinto, y lo que
certifica es *«alguien la mueve»*, nunca *«los ~~cuatro~~ cinco hechos la escriben»*. Es el §2.1
aplicado a su propio mensaje: el texto con que falla no puede afirmar más de lo que el predicado
verifica. **Que los otros tres escritores estén es lo que vigila el cap. 02 §2.5**, que los enumera
y declara la lista cerrada, y no este guard.

**Y esa lista cerrada dejó de ser la única vigilancia: desde la tercera enmienda de `DEC-TEST-001`
lleva guard propio, `G-R6-B`.** El párrafo de arriba es su motivo entero — si `G-R6` queda verde
por un escritor de ~~cuatro~~ cinco, **a los otros ~~tres~~ cuatro no los mira nadie** y lo único que los sostiene es la
enumeración del cap. 02 §2.5. **Una lista cerrada sin guard es una promesa que en este programa ya
se rompió una vez**: `DEC-TEST-001` lo dice con el caso —*«la única lista que existía quedó corta
en el mismo commit que creó su sexto miembro»*— y acá lo que la lista sostiene no es un conteo,
es **el borrado irreversible del contenido de una ficha**.

**Su papel es el de `G-R1-E` y su forma también, que es por qué es una letra de `R6` y no un
racimo nuevo.** `G-R1-E` ancla su segunda mitad en un inventario —*«un consumidor nuevo no figura
en la lista»*— porque ahí **ningún grep sustituye la cuenta**: una pieza nueva **no aparece
buscando el término viejo**, así que lo único que lo detecta es que la lista tenga una fila menos
que las piezas. Desde la cuarta enmienda la coincidencia es literal: **la mitad (b) de este guard
es la mitad de `G-R1-E`**, sobre otro inventario. El precedente de la letra es `G-R1-F`, que entró
como sexto de `R1` **con un sujeto distinto del racimo** —la marca y no `sucede_a`— porque el daño
estaba pegado al de sus hermanos. Acá es lo mismo: el sujeto de `R6` son *«las columnas que una
condición lee»* y el de éste es **quién toca una columna, escribiéndola o leyéndola**, pero la
columna es la misma, el día es el mismo, y `G-R6` **ya declaró por escrito que no lo cubre**.

**Vigila las DOS mitades de esa lista y, sobre la de lectores, las DOS DIRECCIONES: son tres
predicados.** La cuarta enmienda de `DEC-TEST-001` le sumó los **consumidores** al mismo guard, y el
argumento no es la simetría: **las dos mitades fallan distinto y la segunda falla peor**. Un
escritor fuera de la lista **mueve el reloj** cuando no corresponde — grave, y todavía reparable
mientras la ficha exista. Un consumidor que nadie registró **lee el reloj y decide con él**, y el
consumidor más caro de esta columna **es el hard delete del día 180** (cap. 02 §4.1): un lector no
inventariado es **un lugar que borra contenido sin que la lista sepa que existe**. Es además la
mitad que el precedente ya cubre — `G-R1-E` vigila exactamente eso para los inventarios del núcleo.
La tercera, *(c)*, es esa misma mitad leída al revés y entró en esta pasada; su razón está cuatro
párrafos más abajo.

**El mensaje dice QUÉ MITAD falló, y la condición no es cosmética: es el §2.1 sobre este mismo
guard.** Un guard que vigila varias cosas y falla con un solo texto **afirma más de lo que su
predicado verificó en esa corrida** —el que lo lee no sabe si le sobra un escritor, si le falta una
fila de lectores o si se le fue un lector declarado, que son tres arreglos distintos en dos
capítulos distintos—, y es **la misma regla con la que `DEC-TEST-001` rechazó el segundo guard** que
evaluó. Sin mensaje diferenciado, la enmienda que agrega la mitad se contradice con la entrada que
la contiene. Así que son **tres predicados con tres textos**, en un guard con un id.

**Se rompe a propósito tres veces, una por predicado, y cada una tiene que dar SU mensaje.** *(a)*
~~Se le agrega la escritura a **`PB2`** —la ficha que cae al perder cobertura (cap. 03 §9)—, que es
el escritor de más creíble de todos: *«la ficha acaba de quedar inactiva, sellemos el instante»* se
lee bien y **corre el día 90 y el día 180 hacia adelante en cada caída**, con lo cual una ficha que
va y viene no llega nunca al borrado.~~ **Ese caso dejó de ser un rojo**: desde la FASE 8 completa
la escritura de `PB2` en su primera rama **es** el hecho 5 del cap. 01 §1.2 (núcleo) (`F-8CA2-001`,
`F-8CA3-001`, owner 2026-09-25), y la razón que la prohibía —*«corre el día 90 y el día 180 hacia
adelante en cada caída»*— era la dirección correcta: sin ella el borrado caía hasta 90 días antes.
**El rojo de *(a)* se prueba ahora con la otra rama de la misma transición**: se le agrega la
escritura a **la rama del excedente de `PB2`**, que baja la ficha **con la cobertura verdadera**
y por eso no es ningún hecho — y el rojo tiene que decir *«escritor fuera de la lista»* aunque la
misma transición escriba legítimamente en su otra rama, que es lo que prueba que el guard cuenta
hechos y no ejecutores. **Y la prueba sigue valiendo después de que el hecho 5 pasara a alcanzar
todas las fichas del dueño** (FASE 8 completa, owner 2026-09-25), revisada y no supuesta: la
ficha excedente **sí** recibe ahora el hecho 5, pero **cuando el dueño pierde la cobertura**, y se
lo escribe el recálculo que el aviso despierta; la rama del excedente de `PB2` corre con `cubierto`
verdadero, así que en **su** instante no ocurrió ningún hecho y su escritura sigue fuera de la
lista. Queda, además, más filosa: la misma ficha puede recibir una escritura legítima de un
ejecutor y una ilegítima de otro, y el guard tiene que distinguirlas **por el hecho**, no por la
ficha ni por la columna. *(b)* Se le agrega un **lector** que la lista no nombra —el
caso barato es una superficie que quiera mostrar *«hace cuánto está inactiva»*— **sin** su fila en
el cap. 02 §2.5. *(c)* Se le **saca la lectura al día 180** dejando su fila intacta en el cap. 02
§2.5. Las tres tienen que poner el guard en rojo, y **un rojo de una con el texto de otra es el
guard fallando su propia condición**: se prueba mirando el texto, no el exit code.

**Y hay que decir lo que sigue SIN verificar, porque se lee de más.** **No verifica que los
~~cuatro~~ cinco hechos tengan quien los ejecute**, que es justo la mitad que `G-R6` deja abierta.
Comprobarlo pide que cada escritura **declare cuál de los ~~cuatro~~ cinco ejecuta**, y un guard estático sólo puede comprobar
que la declaración **esté**, nunca que sea cierta — que es **exactamente la forma que
`DEC-TEST-001` rechazó** para el segundo guard de esa decisión. Así que `G-R6` y `G-R6-B` juntos
certifican *«alguien la mueve»*, *«nadie de más la mueve»* y *«nadie de más la lee»*, **nunca *«los
~~cuatro~~ cinco la mueven»***: quitarle la escritura a uno de los ~~cuatro~~ cinco —al recálculo del hecho 2, por
ejemplo, que el cap. 02 §4.2 regla 4 declara **en tres momentos y no en uno**— deja a los dos en
verde.

**Y la mitad que falta NO es la misma en las dos listas, que es lo que esta pasada separa.** El
renglón de acá decía que ninguna de las dos comprueba que sus miembros declarados **existan**, y la
simetría no se sostiene:

- **Para escritores es la forma rechazada y sigue rechazada.** Comprobar que un hecho tenga quien lo
  ejecute pide que cada escritura **declare cuál de los ~~cuatro~~ cinco ejecuta**, y un guard estático sólo
  puede comprobar que la declaración **esté** — exactamente el segundo guard que `DEC-TEST-001`
  rechazó. Queda afuera **del catálogo de guards**, con su razón — **y desde `DEC-TEST-002` la
  cubre un criterio de terminación**, que no es un guard y por eso la objeción no lo alcanza: lo
  contesta una persona al declarar lista la unidad (`descomposicion.md` §4, con el desarrollo en
  `B/descomposicion` §4).
- **Para lectores es un HECHO comprobable y entra: es la mitad *(c)*.** *«El día 180 no lee
  `listing.inactiva_desde`»* es un rojo verificable **sin pedirle a nadie que declare nada** —se
  mira si la lectura está, igual que la mitad *(b)* mira si sobra una—, que es el mismo criterio con
  el que esa decisión aceptó este guard y rechazó el otro. La mitad quedó afuera por analogía con un
  caso que no es el mismo.

**Y la dirección importa, porque es la que se paga con contenido.** La *(b)* atrapa a un lector que
nadie inventarió; la *(c)* atrapa a un lector inventariado que **desapareció** — y el día que el hard
delete del día 180 deje de leer la columna, por un refactor, un rename o una reescritura del
cálculo, **el guard seguía verde y la lista seguía diciendo que ese lector está ahí**. Es el patrón
*«un inventario que afirma completitud sin tenerla»* aplicado a la defensa del único acto
irreversible del programa. **Se rompe a propósito sacándole al día 180 su lectura de la columna sin
tocar el cap. 02 §2.5**, y el rojo tiene que decir *«lector declarado que ya no lee»* y nombrarlo.

**Y `G-R6-B` sigue sin afirmar nada sobre ejecutores, con tres mitades igual que con dos.** La
*(c)* cuenta **lecturas**, no actos: que el hecho 2 tenga sus tres ejecutores (`V/02` §4.2, regla 4)
no lo verifica este guard ni ningún otro, y decirlo acá es lo que impide que las tres mitades se
lean como *«la lista entera está vigilada»*.

**Y `B/20` §2 lo repite como referencia cruzada por la razón de `G-R5` y no por simetría**: lo que
puede romperlo se escribe **en la otra épica**. Dos lugares medidos. `B/10` §4.3 es donde está
escrito que el reloj *«arranca acá, no antes»*, que **es** el cuarto hecho; y `B/03` §7.1 apoya el
tope de la reapertura en que la lista **sea** cerrada —*«`DEC-DATA-002` le puso a la inactividad
cuatro hechos de reinicio con lista cerrada»* —hoy cinco, `B/03` §7.1 ya lo dice así—, y de ahí sale que el tope *«ya no es monótono»*—.
Un ~~quinto~~ escritor **nuevo** agregado desde billing rompe las dos cosas **sin que nadie abra
este capítulo**. *(El quinto hecho, el de la FASE 8 completa, no salió de billing: ~~es `PB2`, de
esta épica~~ sus dos ejecutores —`PB2` y el recálculo que el aviso despierta— son de esta épica —
`F-8CA2-001`, owner 2026-09-25.)*

**`G-R5` vigila una desigualdad entre dos números de configuración, y por eso existe.** El
arreglo de `F-8cC1-001` deja al cliente que pausa a salvo del borrado **porque 120 es menor que
180**, no porque el reloj se detenga: no se detiene, se reinicia al reanudar (cap. 01 §1.2,
núcleo). Es una premisa verdadera el día que se escribe y que **nadie vuelve a mirar** el día que
alguien suba el tope de pausa —el quinto modo que `DEC-METH-010` declara no cubierto por ninguna
búsqueda de texto—. Un guard es lo único que la vuelve a mirar sola.

**Y hasta la FASE 8 completa la desigualdad que compara no era la que protegía** (`F-8CA2-001`,
`F-8CA3-001`). *«120 < 180»* protege sólo si el reloj arranca el primer día de la pausa, y **nada lo
escribía ese día**: guardaba el último reinicio, que sobre una ficha publicada y cubierta tiene
hasta 90 días, así que lo que había que comparar era `tope + 90 < 180` y `G-R5` daba verde sobre una
cuenta falsa. **Desde el hecho 5 del cap. 01 §1.2 (núcleo; owner 2026-09-25) `PB2` escribe
`listing.inactiva_desde` en el instante en que baja la ficha por perder la cobertura**, que en una
pausa es su primer día, y la desigualdad de `G-R5` pasa a ser la que de verdad separa a ese cliente
del borrado. El guard no cambia de predicado: cambia que **ahora su premisa es verdadera**. Su
alcance es el de `D16` ~~—la ficha que estaba publicada al empezar la pausa—; la que ya estaba abajo
queda abierta en el cap. 01 §1.2 (núcleo)~~ —**toda ficha del dueño en esa vertical**, publicada o
no, porque el hecho 5 es *«el dueño pierde la cobertura en la vertical»* y el recálculo que el aviso
despierta le escribe el mismo instante a la que `PB2` no baja (FASE 8 completa, owner
2026-09-25)—. **Por eso ahora alcanza**: el primer día de la pausa es el valor de la columna en
todas las fichas que el borrado puede tocar, no sólo en la publicada. Lo que sigue abierto en el
cap. 01 §1.2 (núcleo) es el disparo —el aviso perdido o repetido—, y `G-R5`, que compara dos
cifras, no lo vería de ninguna forma. **Es cruzado**: el tope vive
en el catálogo de billing y el día 180 en el capítulo 02 de esta épica, así que `B/20` §2 lo
repite como referencia cruzada, igual que `G-R4`.

**Y vigila esa mitad y no la otra, que hay que decirlo para que nadie lea de más.** *«Se reinicia
al reanudar»* presupone que **la reanudación ocurre**, y eso no es una cifra del catálogo: es una
llamada al proveedor que puede no aplicarse. `G-R5` sigue en verde sobre una pausa que venció hace
veinte días y no reanudó —las dos cifras que compara no cambiaron—, así que **esa mitad la cubren
otras dos piezas y ninguna es un guard**: la rama de fallo de `S10` (`B/03` §3.2) y la **quinta**
comprobación de cero llamadas del barrido (`B/09` §3).

**`G-R5-B` es la misma clase sobre el otro reloj de la ficha** (FASE 8 completa, `F-8CA2-014`,
owner 2026-09-25). `PB5` archiva un borrador a los `N` meses y el hard delete borra a los 180
días, **sobre la misma columna**; con `N ≥ 6` meses el borrado alcanzaba a un borrador sin que
hubiera pasado por el archivado ni por su aviso. Lo cierran dos reglas juntas: **`PB9` exige
`ARCHIVED`** —eso lo dice la tabla del cap. 03 §9 y no necesita guard: es su `desde`— y **`N` se
valida menor que 6 meses**, que es configuración y por eso lleva guard, igual que `D16`. **Se rompe
a propósito** poniendo `N` en 6 meses, y el rojo tiene que nombrar a `PB5` y la cifra.
~~⚠️ **Lo que no está decidido**: si la cota es **6 meses literal** o **el día del hard delete**
—como `D16`, que compara contra el 180 y no contra un número fijo—. Hoy son lo mismo; el día que
alguien mueva el 180, dejan de serlo. El predicado de arriba toma la letra del owner.~~ **Cerrado
el 2026-09-25 (owner, FASE 8 completa)**: **la cota es 6 meses literal**, como dice el predicado de
arriba; **la unidad que lo construye sigue siendo `V6`**, y **no se agrega un invariante `D18`**.

**`PB9` no mueve ni a `G-R6` ni a `G-R6-B`, revisado y no supuesto.** El hard delete pasó a ser
una transición (`PB9`, cap. 03 §9; `F-8CA2-008`), pero **lee la columna igual que antes** —es el
lector *(3)* del cap. 02 §2.5, con otro nombre— y **no la escribe** salvo por la relectura que trae
la cobertura verdadera, que es el hecho 2 y ya estaba en la lista. Así que los seis lectores y los
cinco hechos quedan como estaban, y la mitad *(c)* se sigue rompiendo igual: sacándole a `PB9` su
lectura de la columna. `G-R6` gana una condición más que lee `inactiva_desde`, escrita por las
mismas transiciones que ya la escribían.

**`G-R4` y `G-R4-B` son el mismo defecto visto en dos planos, y hacen falta los dos.** El primero
mira **la forma** de una tabla: dos guardas que se pueden satisfacer a la vez dejan el desenlace
en el orden de recorrido, y los pares con dos destinos que el diseño declara hoy son **cuatro**:
`T1`/`T6` acá, y `S5`/`S19`, `S7`/`S19` y `S10`/`S25` en la tabla de suscripción (`B/03` §3.2).
**Cuántos son es lo que este guard cuenta**, no una lectura a mano — y el cuarto entró en la FASE
9-bis-4 por una decisión sobre planes retirados (`DEC-SUB-015`), no porque nadie estuviera
mirando esta lista. *(Este párrafo decía que `T1`/`T6` era el único; ya no lo era desde que `S19`
compartió par con `S5` y con `S7`.)* El segundo
mira **de qué habla** una guarda: `T6` estaba escrita sobre *«una suscripción viva»*, un predicado
que el §4 del contrato **le prohíbe evaluar** al lado que tiene que evaluarlo, así que su
implementación iba a leer otra cosa sin decirlo. Disjuntas y **evaluables** son dos propiedades
distintas; `T6` fallaba las dos, y cada guard atrapa una.

**`G-R4` es del núcleo y el catálogo de guards está partido en dos épicas** —la numeración es una
sola—. Esta fila es la definición; `B/20` §2 la repite como referencia cruzada, para que las seis
tablas de billing no queden vigiladas por un guard que su propio catálogo no nombra. **Es un
guard, no dos.**

**`G-R3` es el que más carga lleva, y conviene decir por qué.** El arreglo del trial concentra todo
en un solo dato: **si alguien siembra una de esas dos versiones con una clave comercial, toda la
plataforma la recibe gratis, para siempre, sin consumir ningún trial**. Es un punto único de falla
que antes no existía, y la comparación honesta no es *«¿esto abre algo?»* sino *«¿abre más o menos
que la alternativa?»*: la exención por ruta abre un agujero **por cada ruta que alguien marque**, y
ninguna herramienta lo cuenta; ésta abre uno solo, en una tabla, que un guard puede contar en cada
PR.

**Y hasta esta pasada sólo sabía prohibir, que es la mitad barata del punto único de falla.** Su
enunciado era **negativo entero** —*«ninguna … otorga»*— más un bicondicional cuyo dominio es **una
sola** clave, la de activación. La lista de lo que el piso otorga es de **tres** filas y es cerrada
(cap. 02 §2.1), y **sólo la primera nombraba un guard**: la 1 *es* la mitad en negativo. Así que un
catálogo al que le faltara la fila 2 o la 3 **pasaba en verde**, y el desenlace de cada ausencia lo
escribe el propio capítulo: sin la 3, *«esa persona no puede ejecutar ninguno de los ~~cuatro~~ cinco
reinicios y el día 180 le borra el contenido»* (cap. 02 §2.1); sin la 2, un `TRIAL_EXPIRED`, un
`Turista Free` y un `Guest` **no pueden suscribirse** —*«queda afuera para siempre»*
(`12-contrato…` §2.5)—. **La mitad `(b)` es esa dirección.** Es la misma corrección que la cuarta
enmienda de `DEC-TEST-001` le hizo a `G-R6-B` sobre otra lista cerrada, y por la misma razón: **una
lista cerrada vigilada en una sola dirección declara una cobertura que no tiene.**

**La `(b)` se puede formar sin juicio, y ésa es la condición con que entra.** Pregunta si **dos
claves nombradas** están entre las que la versión de piso de cada vertical otorga en el catálogo:
no hay que entender qué significan, igual que `G-R6` no necesita entender qué significa una columna
(`B/20` §2). Y **no** verifica que otorgar esas dos claves alcance para ejecutar `PB8` ni el alta —
eso son los nueve pasos del cap. 17 §3.5 y este guard no los recorre—; verifica que **estén**.

**Y la `(a)` recién ahora se puede formar, que es la otra mitad del arreglo.** *«Clave de la clase
comercial»* era un término **sin definición en ningún capítulo y sin atributo en el catálogo**:
quien construyera el guard tenía que inventar la clasificación clave por clave, y la primera que le
tocaba era la que la lista del piso acababa de agregar. Si la clasificaba comercial, el guard se
ponía en rojo sobre el catálogo **correcto** y la salida obvia era sacar la clave — que es el
crítico que el cap. 02 §2.1 cerró. **La clase es hoy el cuarto atributo declarado de una clave**
(cap. 15 §3.4), con dos valores y lista cerrada, y su definición está en el glosario al lado de la
de *«entitlement medido»*, que es la otra mitad del mismo predicado (`NUCLEO/01` §1.6). El guard lee
un atributo; no juzga.

**Se rompe a propósito tres veces, una por mitad, y cada una tiene que dar SU mensaje.** *(a)* se le
siembra a la versión de piso de una vertical una clave comercial cualquiera. *(b)* se le **saca** a
esa misma versión la clave *«recuperar lo suyo»*, que es exactamente el catálogo con el que el hard
delete del día 180 se vuelve indefendible. *(c)* se le pone la capacidad de activación a la versión
de pre-trial de una vertical que no declara evento. **Un rojo de una mitad con el texto de otra es
el guard fallando su propia condición** (§2.1): son tres arreglos distintos, en dos tablas
distintas, y el que lo lea tiene que saber cuál le tocó.

**G1 y G2 son la pinza** y ya se explicó en el capítulo 17 §2.3 (épica de verticales): uno acota
**quién puede** nombrar una vertical, el otro obliga a que las operaciones **lo hagan**. Por
separado cada uno deja pasar lo que el otro atrapa.

### 2.1 Un guard se prueba rompiéndolo

**Todo guard de esta lista lleva un caso que lo hace fallar a propósito.** No es rigor de más: un
guard que no puede fallar es un comentario con exit code 0, y no hay forma de distinguirlo de uno
que funciona salvo rompiéndolo.

Vale igual para el mensaje: **el texto con que falla no puede afirmar más de lo que el predicado
verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo mira una forma
sintáctica está mintiendo con precisión, que es peor que no estar.

---

## 5. E2E: lo que hoy se hace a mano

7. **trial** completo: activación, campaña previa, vencimiento, campaña de recuperación y
   conversión tardía;
