# 02 · Núcleo — Glosario y modelo conceptual

Este archivo fija **los nombres** del sistema nuevo. Todo lo que el resto de la spec use tiene que
estar acá, y nada de lo que esté acá se redefine en otro archivo. Existe por una razón concreta: el
§63 del PDR pide modelar ocho máquinas de estado, y sin un diccionario único cada épica inventa el
suyo, que es exactamente cómo se llega a lo que el §1 describe —*«implementaciones divergentes»*,
*«conceptos obsoletos»*—.

Es prosa del núcleo, sin ítems de inventario: los invariantes, las acciones administrativas y los
plazos están en [`02-nucleo.md`](02-nucleo.md); las transiciones, guards y motivos, en
[`04-catalogos.md`](04-catalogos.md).

> **Plazos.** Donde este glosario dice 90 o 180 días, o los días de una campaña de avisos, se lee
> *«el plazo, con ese valor al inicio»*: son los plazos configurables de la lista cerrada,
> [PLAZO:1](02-nucleo.md#plazo-1) (archivado) y [PLAZO:2](02-nucleo.md#plazo-2) (borrado), entre
> otros (`NUCLEO/02` §1.5; revisión del owner, 2026-09-28, C9).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:18, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:20, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:159

## 1. Las entidades

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:29

### 1.1 Persona y acceso

| término | qué es |
|---|---|
| **User** | Cuenta autenticada (§6). Es la unidad de identidad de todo el modelo. |
| **Guest** | Persona sin autenticar (§6). **No es un Turista**: el §36.2 lo dice explícitamente. |
| **Turista** | Un User usando capacidades de turista (§6). Todo User autenticado es `Turista Free` por estado base (§14), **sin suscripción real**. |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:31, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:35, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:36, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:37

### 1.2 Vertical y lo que publica

| término | qué es |
|---|---|
| **Vertical** | Categoría de producto dentro de Hospeda (§6). Hoy: Turista, Alojamiento, Gastronomía, Experiencia, Partner. |
| **Vertical comercial** | La que puede participar de planes y billing (§6). Hoy son las cinco. |
| **Vertical con ficha** | Alojamiento, Gastronomía, Experiencia (§6). |
| **Ficha** | Recurso publicable con **exactamente un** User dueño (§6). No hay multi-dueño. Un User puede tener varias. |
| **Presencia de Partner** | La página propia de Partner Gold (§17.1). El §17.1 ordena **no** forzarla al modelo `Ficha` pese al parecido, así que es una entidad distinta. **No tiene máquina de estados**: la lectura pública pregunta si el partner tiene **hoy** el entitlement **de la página propia** (FASE 9 vuelta 1, `F-8V1A1-004`) y, si no, responde que no existe; el contenido se conserva y la página vuelve sola si vuelve a Gold (`V/18` §1.6; FASE 8 completa, `F-8CA1-005`, `F-8CA2-005`, `F-8CA3-006`, owner 2026-09-25). **Son dos claves y una condición** desde la FASE 9 completa: la página (Gold) y **la presencia en el carrusel** (Gold y Silver), y las dos se ven sólo si **la presencia no está moderada** —un bit que escribe un admin con la misma acción que modera una ficha— (owner 2026-09-25, decisiones 7b y 7c). |
| **Inactividad** (de una ficha) | El tiempo que lleva **sin estar a la vez publicada y cubierta**, contado desde **el más reciente** de los **cinco** hechos que la reinician (el sexto, owner 2026-09-25, FASE 9 completa, decisión 5b; el 4 salió con la revisión del owner, 2026-09-28, C8) —y, en una ficha que ya existía el día del corte, **desde el corte** si ninguno de los cinco ocurrió después (la escritura `C` de la tabla de abajo; FASE 8 completa, `F-8CA3-002`, `F-8CC2-003`, owner 2026-09-25)—. Es el reloj del §25 —*«desde que queda efectivamente inactiva»*— el que disparan [`PB4`](04-catalogos.md#trans-v-pb4) (día 90, [PLAZO:1](02-nucleo.md#plazo-1)) y [`PB5`](04-catalogos.md#trans-v-pb5), y sobre el que se cuenta el día 180 ([PLAZO:2](02-nucleo.md#plazo-2); cap. 02 §4, épica de verticales). **Ese instante es un dato y tiene dónde vivir: la columna `listing.inactiva_desde`** (`V/02` §2.5). |

**Los cinco hechos que reinician la inactividad, más la escritura única del corte, y la lista es
cerrada** (numerados 1, 2, 3, 5 y 6: el 4 salió con la revisión del owner, 2026-09-28, C8):

| # | hecho | de dónde se lee | por qué reinicia |
|---|---|---|---|
| 1 | un **acto del dueño** sobre la ficha: crearla, editarla, publicarla, despublicarla, exportarla, reactivarla | el registro append-only de eventos de dominio (cap. 08 §1.3). **Crear, editar y exportar se registran como eventos aunque no sean transiciones**, y de los campos de contenido guardan sólo el nombre (cap. 08 §1.2; owner 2026-09-25, FASE 9 completa, decisión 8e, `F-8CA3-004`) | alguien la está usando, que es lo contrario de estar inactiva |
| 2 | **la cobertura se comprueba verdadera** — un ESTADO leído, nunca un cambio detectado | **la respuesta del contrato** —el campo `cubierto` del contrato de cobertura (`12-contrato…` §2.1)—, **vuelta a pedir**. El aviso del §3 del contrato dice **cuándo** preguntar y no contesta la pregunta | estar cubierto **es** no estar inactivo. Reinicia **por sí solo**, aunque la ficha no vuelva a publicarse —si el cupo no alcanza, por ejemplo— porque lo que terminó es la ausencia, no el cupo |
| 3 | la ficha **vuelve a `PUBLISHED`** — [`PB1`](04-catalogos.md#trans-v-pb1), [`PB3`](04-catalogos.md#trans-v-pb3) o [`PB7`](04-catalogos.md#trans-v-pb7) (cap. 03 §9, épica de verticales) | la propia máquina | una ficha publicada no acumula inactividad; su reloj arranca recién cuando deja de estarlo |
| 4 | — (vacío) | — | **Sale de la lista** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan, así que no hay fin de servicio de una vertical que reinicie nada. El número 4 queda vacío y los demás conservan el suyo, para que ninguna cita a *«el hecho 5»* o *«el hecho 6»* cambie de sujeto |
| 5 | **el dueño pierde la cobertura en la vertical de la ficha** —el `cubierto` del contrato pasa a falso para ese `user + vertical`—, y se escribe en **toda** ficha del dueño en esa vertical, **publicada o no**: la publicada, el borrador y la excedente que ya estaba abajo arrancan juntas el mismo instante (FASE 8 completa, owner 2026-09-25). **Tres ejecutores, un hecho**: sobre la ficha publicada lo escribe **la primera rama de [`PB2`](04-catalogos.md#trans-v-pb2)** (cap. 03 §9, épica de verticales), que es la que la baja; sobre las que no estaban publicadas lo escribe **el recálculo que el mismo aviso despierta** (`12-contrato…` §3), **sin transición de publicación**; **y si el aviso se perdió, el reconciliador diario de cobertura**, que corre `PB2` y escribe las demás en el mismo acto (`V/03` §9; [`DEC-ARCH-009`](01-decisiones-vigentes.md#dec-arch-009), owner 2026-09-25). **No lo escribe la segunda rama de `PB2`**, la del excedente tras un downgrade, que baja la ficha **sin** que `cubierto` cambie (`F-8CA2-001`, `F-8CA3-001`) | la propia máquina, para la publicada; **el aviso de la caída más la relectura** del contrato, para las demás —**o, sin aviso, la pregunta diaria del reconciliador** (`DEC-ARCH-009`)— | es el instante en que la ficha **deja de estar a la vez publicada y cubierta**, que es donde la definición de arriba y el propio hecho 3 —*«su reloj arranca recién cuando deja de estarlo»*— dicen que el reloj arranca. Sin él la columna guardaba **el último reinicio**, que sobre una ficha publicada y cubierta lo escribe la relectura de `PB4` y puede tener **hasta 90 días** en el instante de la caída. **Y en las que no estaban publicadas es el mismo instante por la misma razón**: el borrador guardaba hasta `N` meses (la relectura de `PB5`) y la excedente hasta 90 días (la de `PB4`). **Su alcance es todas las fichas del dueño en la vertical** |
| 6 | **se levanta la moderación de la ficha** — **[`PB11`](04-catalogos.md#trans-v-pb11)** (cap. 03 §9, épica de verticales) | la propia máquina | mientras la ficha estuvo en `MODERATED` el dueño **no podía** actuar sobre ella, así que contar esa ausencia lo castigaría por una decisión nuestra. Sin él, una moderación larga sobre un dueño sin cobertura terminaba en `PB11` → `PB5` → [`PB9`](04-catalogos.md#trans-v-pb9): el borrado en días, después de que un admin decidiera que la ficha estaba bien (owner 2026-09-25; FASE 9 completa, decisión 5b, `OW-1`) |
| C | **la escritura única del corte**: **cada ficha de la lista cerrada que fija el owner, una por cada una de las cinco cuentas de [`DEC-MIG-007`](01-decisiones-vigentes.md#dec-mig-007), que son las únicas que la migración carga: las demás se borran en el corte** (FASE 5, owner 2026-09-30, lote 1 J; la escritura sigue, simplificación del corte, S-14), **nace en el modelo nuevo con `inactiva_desde` = el instante del corte**, nunca con su `created_at` (FASE 8 completa, `F-8CA3-002`, `F-8CC2-003`, owner 2026-09-25; `V/21` §2.4) | la migración estructural del corte, **una vez** —**por corte que termina**: un corte abortado se restaura del backup y su escritura no cuenta; el reintento escribe `C` con su propio instante (owner 2026-09-25; FASE 9 completa, `2e`; `D/16` §4.2)— y en ningún otro lugar | **no es un reinicio** —ese día a la ficha no le pasa nada—: es el valor de arranque de una columna no anulable sobre filas que ya existían. Con `created_at`, toda ficha de más de 180 días se archivaba y se borraba **en la primera corrida** después del corte, con los tres avisos de retención fechados en el pasado |

**Por qué el corte es una fila `C` y no un hecho más** (FASE 8 completa, `F-8CC2-003`, owner
2026-09-25). Es la forma que menos mueve la lista: **los hechos siguen siendo lo que pasa en la vida
de una ficha**, y cada cita que los cuenta dice su número sin salvedad, mientras que la escritura del
corte ocurre **una sola vez en la vida del programa** y no la puede repetir nada. (Verticales escribe
además en el corte **una** fila de `trial`: **la prueba activa de cada una de las cinco cuentas de la
lista, que escribe la herramienta del corte de [`V6`](10-corte/V6.md#pieza-v6), que es del sistema
nuevo** —el script suelto del corte sigue sin importar código de ningún sistema; FASE 5, lote de la
aplicación, owner 2026-09-30, B—, **con la función de la aplicación, después de la migración**
(revisión del owner, 2026-09-28, C12; FASE 5, owner 2026-09-30, lote 2 D; simplificación del corte,
S-12), **que tampoco es una transición y se admite por su lugar, como `C`**. Los dueños del sistema
viejo arrancan como clientes nuevos: owner 2026-09-25, FASE 9 completa, decisión 2g.) Pero la
escritura `C` **no queda fuera de la lista**, porque lo que la lista cierra son las **escrituras** de
la columna y ésta es una: [`G-R6-B`](04-catalogos.md#guard-g-r6-b) mitad *(a)* la admite **por su
lugar** —la migración estructural del corte— y **la misma escritura en cualquier otro lugar es un
escritor fuera de la lista**.

**Que la lista sea cerrada lo verifica un guard, `G-R6-B` (`V/20` §2), y no la memoria del que
escribe.** Una escritura de `listing.inactiva_desde` que no sea uno de estos cinco —o la escritura
`C` del corte, en su lugar— lo pone en rojo, y quien agregue un hecho nuevo agrega su fila acá **en
el mismo acto**. Es la misma regla que los cuatro inventarios del §2.4, §2.5 y §2.6, con la
diferencia de que **lo que se enumera acá es el lado que ESCRIBE, y son hechos y no ejecutores** —un
hecho puede tener varios, y el 2 tiene **cuatro** (el cuarto, el reconciliador diario de cobertura,
`DEC-ARCH-009`)—: la lista de **lectores** de la misma columna vive en `V/02` §2.5 y **la vigila el
mismo guard, con un mensaje propio** (cuarta enmienda de [`DEC-TEST-001`](01-decisiones-vigentes.md#dec-test-001)).
**No la vigila [`G-R6`](04-catalogos.md#guard-g-r6)**: ése cruza las columnas que una condición
**lee** contra las que alguna transición **escribe**, y de estos **cinco hechos** (revisión del owner,
2026-09-28, C8) **el tercero y el sexto son transiciones enteras —el sexto es `PB11` (FASE 9
completa, 5b)— y el quinto lo es a medias** —sobre la ficha publicada lo ejecuta la primera rama de
`PB2`, y sobre las demás el recálculo que el aviso despierta **o el reconciliador diario de
cobertura** (`DEC-ARCH-009`), que **no** son transiciones (FASE 8 completa, owner 2026-09-25)—, así
que queda verde por `PB1`/`PB3`/`PB7`, por `PB2` **o por `PB11`** y no mira a los otros dos **ni a
los ejecutores del quinto que no son transición** — está medido y dicho en `V/20` §2.

**El hecho 2 es un ESTADO COMPROBADO y no un cambio detectado.** Las dos escrituras declaradas del
hecho comprueban un valor: el recálculo escribe *«cuando vuelve a preguntar y **trae** `cubierto`
verdadero»* y `PB4`/`PB5` escriben *«si el `user + vertical` **está** cubierto»* (`V/02` §4.2 regla
4, `V/03` §9). Los dos enunciados posibles —estado o cambio— producen sistemas distintos y **no hay
una tercera lectura**, así que queda elegido el estado, por tres razones:

1. **El cambio no es observable donde más hace falta.** El que ejecuta relee *porque el aviso se
   puede haber perdido* —el párrafo de abajo—, y sin el aviso no hay ningún cambio que detectar: lo
   único que tiene delante es un valor. Enunciarlo como cambio vuelve **inejecutable** la única red
   contra el modo de falla que el propio diseño declara frecuente.
2. **El §3 del contrato ya lo ordena así.** Prohíbe decidir con lo que trae el evento y manda
   **preguntar el estado**; un predicado de cambio obliga a recordar el valor anterior, que es
   precisamente la memoria que ese § no quiere que nadie guarde.
3. **Y es lo que vuelve legítimas las escrituras que ya existen.** Con el predicado de cambio, la
   relectura de `PB4`/`PB5` **no es ninguno de los hechos** —en el momento de archivar `cubierto` no
   cambia, ya vale verdadero— y `G-R6-B` mitad *(a)* se pondría en rojo **sobre la red y no sobre el
   defecto**, con lo que la salida obvia del que lo vea es sacar la relectura y reabrir el borrado
   que [`DEC-DATA-002`](01-decisiones-vigentes.md#dec-data-002) cerró.

> ⚠️ **Y esto NO toca el evento de `PB3` ni el de `PB7`, que siguen siendo un CAMBIO.** Una
> transición se dispara por un cambio —es lo que la hace una transición— y las dos lo dicen así en
> `V/03` §9. Lo que se separa acá es que **la misma frase estaba nombrando dos cosas distintas**: el
> evento de una máquina, que ocurre una vez y en un instante, y el hecho de un reloj, que cualquiera
> que actúe sobre él tiene que poder comprobar **en el momento de actuar**, las veces que haga falta.

**Y la lista enumera HECHOS, no ejecutores, que es lo que hace bien definida a la mitad *(a)* de
`G-R6-B`.** El guard rechaza *«una escritura que no sea uno de los cinco hechos»* —ni la escritura
`C` del corte, en su lugar—: la pregunta que contesta es **de cuál de los cinco es** la escritura,
nunca **quién** la hizo. Un hecho puede tener más de un ejecutor sin que la lista crezca —el 2 los
tiene, **y desde la FASE 8 completa el 5 también: `PB2` y el recálculo** (owner 2026-09-25)**, y
desde `DEC-ARCH-009` el reconciliador diario de cobertura en los dos**— y por eso el guard **no**
cuenta escritores: cuenta hechos. Que el 5 pasara de una ficha a todas las del dueño en la vertical
**agregó un ejecutor y ningún hecho**; el 6 —levantar una moderación, `PB11`— sí es un hecho nuevo,
con su razón (owner, FASE 9 completa, 5b). **El reconciliador tampoco agrega ninguno** (owner
2026-09-25): es un ejecutor más del 2 y del 5. **Y la misma transición puede escribir un hecho en
una rama y ninguno en la otra**: `PB2` escribe el hecho 5 cuando baja la ficha porque `cubierto` pasó
a falso, y **nada** cuando la baja por el excedente, donde la cobertura sigue verdadera; esa segunda
escritura sería un escritor fuera de la lista (FASE 8 completa, `F-8CA2-001`, owner 2026-09-25).
*(El propio `V/20` §2 ya declara que ninguno de los dos guards verifica que los cinco hechos tengan
quien los ejecute; eso es una comprobación distinta y sigue sin hacerse.)*

**El hecho 2 se lee de la CONSULTA y nunca del aviso, y ésa es la diferencia entre reiniciar el
reloj y creerle a un mensaje.** El §3 del contrato lo prohíbe con todas las letras —*«el evento no
reemplaza la consulta … un consumidor que decidiera con lo que trae el evento estaría creyéndole a un
mensaje en vez de al estado»*— y este reloj **decide**: decide borrar. Así que el aviso hace acá
exactamente lo que hace en los otros dos consumidores que ya cuelgan de él —la invalidación del caché
y el reconciliador, *«una lista, dos consumidores»* (`V/15` §4.2)—: **despierta el recálculo, y el
recálculo vuelve a preguntar**. Si `cubierto` viene verdadero, se escribe el instante en
`listing.inactiva_desde` (`V/02` §2.5).

**Y como un aviso se puede perder, el que ACTÚA vuelve a preguntar antes de actuar.** `PB4`, `PB5` y
el hard delete del día 180 —la fila `PB9` de `V/03` §9 (FASE 8 completa, `F-8CA2-008`)— **releen la
cobertura del `user + vertical` en el momento de ejecutar** y, si está cubierta, reinician el reloj
en vez de avanzar. Es el mismo §3 aplicado al otro extremo, y es lo que vuelve el aviso perdido un
retraso y no un borrado: sin esta relectura el modo de falla cae del lado caro —el aviso que no llega
deja el reloj corriendo sobre alguien que volvió—, y el propio diseño ya declara que estos avisos se
pierden (`V/02` §3.2, regla 2: *«si la invalidación falla, la operación de dominio no falla»*). Ahí
cuesta rendimiento; acá costaría el contenido.

**Son TRES los que releen: `PB4`, `PB5` y `PB9`.** El día 180 es el único de los tres que no tiene
vuelta: lo que `PB4` archiva lo recupera [`PB8`](04-catalogos.md#trans-v-pb8), y lo que el día 180
borra no lo recupera nada. **Y la relectura que trae la cobertura verdadera no es un escritor
intruso**: escribe el **hecho 2**, del que es uno de sus **cuatro** ejecutores —el cuarto es el
reconciliador diario de cobertura (`DEC-ARCH-009`), que **no** es uno de los tres que releen: no
avanza sobre el reloj, pregunta para restituir—, así que `G-R6-B` mitad *(a)* la acepta por la lista
y no por una excepción. **Y los dos avisos previos de retención también releen** (FASE 8 completa,
`F-8CA2-015`, owner 2026-09-25; cap. 07 §6), **sin ser de los tres**: no escriben la columna ni
avanzan el reloj, sólo no salen si el dueño está cubierto.

**Los otros hechos tienen fuente durable**: el 1 sale del registro append-only de eventos de dominio
(cap. 08 §1.3), el 3, **el 5 y el 6** de la propia máquina de publicación. El 2 era **el único de
los cinco sin estado detrás**, y es justamente el que impide que el día 180 alcance a alguien que
volvió (`V/02` §4.1).

**El reloj no es monótono.** La lectura literal —*el tiempo desde que la ficha dejó de estar
publicada*, sin nada que lo reinicie— hacía que la ficha de alguien que **pausa** su suscripción
bajara por `PB2` el primer día de la pausa, cruzara el día 90 —el tope de una pausa es de **4
pausas-mes**, unos 120 días (cap. 03 §5, épica de billing)— y siguiera corriendo hasta el hard delete
del día 180: se le borraba el contenido a un cliente que no canceló nada y que usó una función que le
vendimos.

> **La pausa pedida por el dueño detiene el reloj** (revisión del owner, 2026-09-28, C14, `L1-c`).
> Mientras la persona tiene en esa vertical una suscripción `PAUSED` por `CUSTOMER_REQUEST`, sus
> fichas de esa vertical no se archivan, no se borran y no reciben avisos de retención; al volver de
> la pausa, el reloj se reinicia. **La pausa sigue sin ser un hecho de la lista de arriba** y no
> escribe la columna: lo que cambió es que **los que avanzan sobre el reloj preguntan**. `PB4`, `PB5`
> y `PB9`, y los avisos de retención, releen al ejecutar la pregunta `retenciónDetenida` del contrato
> (`12-contrato…` §4.1) además de `cubierto`, y con `sí` no hacen nada. Al reanudar, la fila vuelve a
> emitir, `cubierto` pasa a verdadero y el hecho 2 reinicia el reloj. **Y todo fin de la pausa, por
> cualquier camino, reinicia el reloj**, también una baja desde la pausa que no vuelve a cubrir
> (revisión del owner, casos vecinos, 2026-09-29, caso 12; `12-contrato…` §4.1), **sin escribir
> nada: `retenciónDetenida` devuelve también cuándo terminó la última pausa, y los lectores cuentan
> desde el más tardío entre `listing.inactiva_desde` y ese instante** (revisión del owner, casos
> vecinos, 2026-09-29, caso F-A; `12-contrato…` §4.1) (**y `PB9`, además, desde
> `coberturaPerdidaEn`, el más tardío de los tres**: FASE 9 vuelta 3, owner 2026-09-30, lote Q). La
> lista de hechos no cambia. **Con eso sale `D16`** ([INV:D16](90-retirados.md#inv-d16)) y con él
> la cota del tope de pausa contra el borrado: el tope de pausa deja de estar atado al día 180. La
> cuenta `tope + 90 < 180` que sostenía esa cota queda como historia en la fuente congelada.

**Desde el hecho 5 (owner 2026-09-25) el primer día de una pausa es exactamente el día en que el
hecho 5 escribe la columna en todas las fichas del dueño en la vertical, estuvieran publicadas o no
cuando la pausa empezó** (FASE 8 completa, `F-8CA2-001`, `F-8CA3-001`, owner 2026-09-25).

> ⚠️ **Lo que el hecho 5 NO alcanza** (FASE 8 completa, owner 2026-09-25):
>
> 1. **Cerrado por el owner (2026-09-25)**: el hecho 5 es *«el dueño pierde la cobertura en la
>    vertical»* y se escribe en toda ficha suya en esa vertical; las que no estaban publicadas las
>    escribe el recálculo que despierta el aviso de la caída (tabla de arriba). **Incluye a las
>    `ARCHIVED` y a las `MODERATED`**, y no es un detalle (FASE 9 completa, `K-3`): la relectura de
>    `PB9` reinicia una ficha archivada de un dueño cubierto cada 180 días, así que su reloj puede
>    tener hasta 180 días al perderse la cobertura; sin el hecho 5, `PB9` la borraría el primer día
>    de una pausa. Es lo que ya dicen la definición del hecho 5 (*«toda ficha del dueño … publicada
>    o no»*), `V/02` §2.5 y `V/03` §9; leer la precisión como exclusión reabría `F-8CA2-001` sobre
>    las archivadas de un cliente que paga.
> 2. **El hecho 5 cuelga de un aviso, en sus ejecutores** —**cerrado con la red por
>    `DEC-ARCH-009`** (owner 2026-09-25), salvo un borde declarado—: `PB2` dispara por el CAMBIO de
>    `cubierto` (`V/03` §9), y el recálculo de las no publicadas corre porque el aviso lo despierta;
>    los dos dependen de un aviso que el diseño declara que se pierde (`V/02` §3.2). La red: el
>    reconciliador diario de cobertura (`V/03` §9) encuentra al día siguiente la ficha publicada sin
>    cobertura, corre `PB2` y escribe el hecho 5 en todas las fichas del dueño en la vertical, en el
>    mismo acto. **El borde que queda, declarado con su causa
>    ([`DEC-METH-015`](01-decisiones-vigentes.md#dec-meth-015))**: el dueño **sin ninguna ficha en
>    `PUBLISHED` en el momento de la caída** (FASE 9 completa, `B-1`): el que sólo tiene borradores,
>    que además no está en la población del reconciliador —fichas fuera de `DRAFT`, `PURGED` **y
>    `MODERATED`** (`F-8CA2-004`)—, **y el que tiene todas sus fichas en `UNPUBLISHED_BY_BILLING`,
>    `ARCHIVED` o `MODERATED`**, que está adentro. Ninguno tiene ficha publicada que delate la
>    diferencia, así que su red sigue siendo la relectura de `PB4`, `PB5` y `PB9` sobre el reloj
>    viejo, **y puede adelantar el borrado** (`V/03` §9, ⚠️ del reconciliador, punto 1). **Causa**:
>    la fila del reconciliador compara estados de ficha, y la ficha publicada es la única que guarda
>    la memoria de que hubo cobertura.
> 3. **El recálculo escribe un CAMBIO sin la memoria que lo detecta** (owner, 2026-09-25). `PB2` sabe
>    que hubo pérdida porque la ficha estaba en `PUBLISHED` —el estado es la memoria— y un aviso
>    repetido la encuentra ya abajo y no hace nada. Sobre una ficha no publicada no hay estado que
>    diga *«antes estaba cubierto»*: el recálculo sólo tiene el aviso —que lleva la dirección,
>    `12-contrato…` §3, y al que no se le puede creer para decidir— y una relectura que trae
>    `cubierto` falso. Si escribe cada vez que relee falso tras un aviso, un aviso repetido o uno que
>    no cambia `cubierto` **corre el reloj hacia adelante** mientras la cobertura sigue ausente, y el
>    borrado se atrasa sin límite. **📌 Aceptado y declarado por el owner el 2026-09-25**: no se le
>    agrega memoria. El error va hacia el lado seguro —**un aviso repetido puede ATRASAR el borrado
>    de una ficha no publicada, nunca ADELANTARLO**—, así que el contenido vive más tiempo y nadie
>    pierde nada. Mientras la cobertura sigue ausente, los avisos para ese `user + vertical` son los
>    de un cambio, y no un goteo. Darle memoria costaba una columna por `user + vertical` con su
>    ciclo, y el guard `G-R6-B` tendría que conocerla.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:39, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:47, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:48, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:50, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:54, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:55, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:56, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:57, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:58, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:59, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:60, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:62, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:87, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:107, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:127, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:133, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:152, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:161, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:169, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:188, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:195, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:210, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:227, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:233, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:247, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:269, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:287

### 1.3 Catálogo comercial

| término | qué es |
|---|---|
| **Plan** | Identidad y cosmética: nombre, descripción, orden en la pricing. **Muta libremente**, sin crear versión ([`DEC-ARCH-001`](01-decisiones-vigentes.md#dec-arch-001)). |
| **Versión de plan** | Precio, limits, entitlements, `rank`, flag de vendible, días de grace y días de trial. **Inmutable** (`DEC-ARCH-001`, [`DEC-ARCH-002`](01-decisiones-vigentes.md#dec-arch-002), [`DEC-SUB-002`](01-decisiones-vigentes.md#dec-sub-002), [`DEC-TRIAL-003`](01-decisiones-vigentes.md#dec-trial-003)). Toda lectura de configuración comercial resuelve versión primero. |
| **Billing option** | El ciclo y su precio: mensual, trimestral, semestral, anual (§18, §19). |
| **Plan de trial** | El plan especial que se asigna al arrancar un trial (§10.3). **No es elegible** por el User. Deriva sus entitlements del plan vendible de `rank` más alto y sus limits del de `rank` más bajo, y después aplica los overrides declarados ([`DEC-TRIAL-001`](01-decisiones-vigentes.md#dec-trial-001)), con trinquete ([`DEC-TRIAL-002`](01-decisiones-vigentes.md#dec-trial-002)). |
| **`rank`** | El orden explícito de un plan dentro de su vertical (`DEC-ARCH-002`). Participan **sólo los vendibles**. Dos vendibles con el mismo `rank` en la misma vertical es un estado inválido, no un empate a desempatar. |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:294, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:298, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:299, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:300, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:301, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:302

### 1.4 Compromiso de pago

Acá se cierra `A-SUB-01`, y la respuesta ya la determinó una decisión.

| término | qué es |
|---|---|
| **Suscripción principal** | El compromiso de pago que da acceso a una vertical. **Máximo uno por User + Vertical** (§11) — un **compromiso**, no una fila: durante la ventana de un cambio de plan conviven un origen y su **única** sucesora, y siguen siendo un solo compromiso de pago (cap. 02 (épica de billing) §2.2). |
| **Suscripción de complemento** | El compromiso de pago de **un** addon recurrente. [`DEC-ADDON-002`](01-decisiones-vigentes.md#dec-addon-002) decidió que cada addon recurrente es una autorización aparte en el proveedor, con su propio ciclo, su propio cobro y su propia baja. |

**El adjetivo «main» del §11 es correcto y necesario**: sí existen suscripciones que no son la
principal. Lo que el §11 acota es **sólo** la principal. Las de complemento no tienen tope propio:
su tope es el del addon que las origina.

Y no existen sueltas: el §38 exige *«una subscription válida compatible»* para adquirir un addon,
así que una de complemento **siempre** cuelga de una principal viva. Qué pasa cuando la principal se
va es el capítulo 16 de billing (§41, `E-ADDON-04`).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:304, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:310, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:311, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:313, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:317

### 1.5 Concesiones

| término | qué es |
|---|---|
| **Promo code** | Un código que el User canjea. Dos tipos: extensión de trial y descuento (§31). |
| **Cortesía temporal** | N **meses enteros** de servicio sin cobrar, otorgados por `SUPER_ADMIN` (§34, [`DEC-GRANT-002`](01-decisiones-vigentes.md#dec-grant-002)), **sólo sobre planes mensuales** (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25; [`DEC-GRANT-003`](01-decisiones-vigentes.md#dec-grant-003) impl. 6, cap. 14 (billing) §4.7). Se implementa **pausando** en el proveedor y sosteniendo el servicio de nuestro lado (`DEC-GRANT-003`). La cortesía durante el trial (§34.1) extiende el trial y sigue en días. |
| **Grant permanente** | *Free Forever*. Sólo `SUPER_ADMIN` (§35). Se modela como entidad independiente, no como un plan. |

Las tres se distinguen por **quién la inicia y cuánto dura**: la promo la canjea el User y es
acotada; la cortesía la firma `SUPER_ADMIN` y vence; el grant la firma `SUPER_ADMIN` y no vence.

> **«No vence» no es «no termina»: el grant termina por revocación y sólo por revocación, y esa
> revocación se guarda.** La cortesía trae su fin escrito en la fila —*«meses, inicio, fin»*— y el
> grant no tiene ninguno que anticipe nada, así que lo único que puede apagarlo es un acto. Ese acto
> **deja marca**: `permanent_grant.revocado_en` (cap. 02 (billing) §2.4), que es lo que vuelve
> evaluable *«grant vivo»* (§2.4). Leído como *«no tiene forma de dejar de estar vivo»*, este renglón
> dejaba tres predicados del diseño sin nada contra qué evaluarse.
>
> **Y esa marca guarda TRES cosas: cuándo, quién y POR QUÉ.** El motivo es **texto libre** y entra
> por [`DEC-GRANT-008`](01-decisiones-vigentes.md#dec-grant-008): revocar *«consume el trial y no se
> repara»* ([`DEC-TRIAL-009`](01-decisiones-vigentes.md#dec-trial-009)) apoyándose en que es una
> decisión deliberada, y **una decisión deliberada cuyo motivo no se registra es indefendible seis
> meses después** — empezando por ante el beneficiario al que le cortaron el servicio sin que
> hiciera nada. De las tres concesiones de esta tabla es la única cuyo final es **un acto de
> alguien** en vez de un calendario, así que es la única que tiene un *«por qué»* que guardar.
>
> **Y un beneficiario tiene a lo sumo UN grant vivo, y lo garantiza la base**, no los **nueve**
> consumidores del término: `UNIQUE(beneficiario) WHERE revocado_en IS NULL`
> ([`DEC-GRANT-009`](01-decisiones-vigentes.md#dec-grant-009), cap. 02 (billing) §2.4). El índice
> es **parcial**, así que las revocadas se acumulan sin límite — que es exactamente lo que *«revocar
> marca y no borra»* necesita.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:321, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:325, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:326, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:327, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:329, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:333, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:340, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:348

### 1.6 Capacidades

| término | qué es |
|---|---|
| **Entitlement** | Una capability, booleana o **medida** ([`DEC-ENT-001`](01-decisiones-vigentes.md#dec-ent-001)). Puede venir de plan, herencia de Turista VIP, addon, cortesía o grant (§36); mientras al menos una fuente lo otorgue, sigue activo. |
| **Entitlement medido** | El que tiene costo marginal por uso. Declara **dos** cuotas: la del plan y la del trial, menor (`DEC-ENT-001`). La cuota se resetea **todos los meses**, sea cual sea el ciclo de pago, y lo no usado se pierde ([`DEC-ENT-002`](01-decisiones-vigentes.md#dec-ent-002)). |
| **Clase de una clave** | Cuál de **dos** es, y la lista es cerrada: **`COMERCIAL`** o **`DE_ACCESO`**. Se declara **con la clave, en el catálogo**, igual que su scope y su estrategia de agregación (`V/15` §3.4), y por la misma razón que aquéllas: es una propiedad del **significado** de la clave y no de cada plan. Es lo que [`G-R3`](04-catalogos.md#val-g-r3) lee. |
| **Clave de la clase comercial** | La que al ejercerse **produce o sostiene presencia pública** en su vertical, o **consume** un limit o la cuota de un entitlement medido. Es lo que se vende, y es lo que **ninguna de las dos versiones no vendibles** puede otorgar (`V/02` §2.1). Su complemento es **`DE_ACCESO`**: existir, **recuperar lo propio** y **volver a contratar**, que es exactamente lo que la versión de piso otorga y nada más. |
| **Limit** | Un tope numérico con scope explícito. **Se acumulan** entre fuentes (§37). Al desaparecer una fuente se recalcula el límite efectivo. |
| **Addon: producto** | La definición: capability, precio, recurrencia, verticales compatibles, duración, efectos, tipo de scope (§39). |
| **Addon: instancia** | Lo que un User concreto tiene: dueño, objetivo, inicio, fin, estado, pago (§39). |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:353, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:357, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:358, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:359, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:360, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:361, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:362, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:363

### 1.7 Registro

| término | qué es |
|---|---|
| **Comprobante** | El PDF que se emite por cada cobro hasta que entre ARCA. **Nunca se lo llama factura fiscal** (§54, [`DEC-LEGAL-001`](01-decisiones-vigentes.md#dec-legal-001)). |
| **Evento de dominio** | El registro de que algo del dominio pasó, no un log técnico (§49). |
| **Outbox** | El registro del intento de notificación, con sus estados y reintentos (§44). **Uno solo**: lo construye [`U2`](10-corte/U2.md#pieza-u2) y absorbe la bitácora de correos que [`U1`](10-corte/U1.md#pieza-u1) renombra desde `billing_notification_log` (cap. 07 §1.4; FASE 5, owner 2026-09-30, lotes 1 B y 2 A). |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:365, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:369, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:370, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:371

## 2. El glosario de estados

El §63 pide ocho máquinas. El capítulo 03 define **diez** — las ocho del §63 más la **Postulación
de Partner**, que el capítulo 18 (verticales) §2.1 declara agregada al núcleo, **y el Reembolso**
(owner 2026-09-25; FASE 9 completa, decisión 5a). Acá se fijan **los nombres** y, sobre todo, se
separa la colisión que el PDR trae. Cierra `M-ARCH-01`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:375, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:377

### 2.1 Los dos `SUSPENDED` del PDR son estados distintos

El PDR usa la misma palabra para dos situaciones que no se comportan igual:

- **§10.6** — el trial venció y la persona **no se suscribió**: `TRIAL_ACTIVE -> SUSPENDED`.
- **§20/§21** — el pago falló y el grace se agotó: `GRACE_PERIOD -> SUSPENDED`.

Difieren en tres cosas medibles, y por eso no pueden compartir nombre:

| | trial vencido | impago tras el grace |
|---|---|---|
| ¿hubo dinero de por medio? | **no**, nunca pagó | **sí**, y quedó un cobro sin entrar |
| campaña de recuperación del §10.7 (+1, +5, +15, +30, +60) | **sí** — el §10.7 la define exactamente para este caso | **no** — el §10.7 habla de *«Recovery post-trial»* |
| qué le falta para volver | suscribirse por primera vez | regularizar un pago — **el pagador manual**, registrando la cuota ([`MP4`](04-catalogos.md#trans-b-mp4)); **el pagador con tarjeta**, volviendo a suscribirse por el checkout, como **sucesora** de la suspendida, porque al suspenderlo se canceló su preapproval y ya no hay cobro que pueda entrar ([`DEC-SUB-019`](01-decisiones-vigentes.md#dec-sub-019)) |

**Se separan así**, y estos son los nombres canónicos:

| estado | qué significa |
|---|---|
| **`TRIAL_EXPIRED`** | El trial terminó sin suscripción. Es el `SUSPENDED` del §10.6. |
| **`SUSPENDED`** | El grace se agotó sin pago — **o el proveedor pausó por mora antes** ([`DEC-MP-008`](01-decisiones-vigentes.md#dec-mp-008)). Es el `SUSPENDED` del §20 y §21. **Sobre un pagador con tarjeta, el preapproval ya está cancelado** (`DEC-SUB-019`): la suspensión corta el cobro, no sólo el servicio. |

**Las consecuencias del §21 valen para los dos por igual** —sin listado público, sin edición, sin
creación, sin entitlements comerciales, datos conservados, Mi Cuenta en sólo lectura, billing
accesible, recuperación posible—. Lo que cambia es la comunicación, no el acceso.

**Apartamiento declarado del PDR, registrado como
[`DEC-ARCH-003`](01-decisiones-vigentes.md#dec-arch-003)** (2026-09-17, aprobado por el owner). El
§10.6 escribe `SUSPENDED` y esta spec escribe `TRIAL_EXPIRED`; el PDR no se edita (§3.1), así que la
desviación vive en el decision log.

**Y el reloj de retención del §25 arranca igual en los dos.** El §25 dice *«desde que queda
efectivamente inactiva»*, y las dos lo son: día 90 sale del sitio público conservando acceso del
dueño, día 180 hard delete de lo eliminable —el contenido de la ficha y sus borradores, nunca nada de
la persona, y la ficha pasa a `PURGED` ([`DEC-DATA-005`](01-decisiones-vigentes.md#dec-data-005),
`V/03` §9 [`PB9`](04-catalogos.md#trans-v-pb9))—, con dos avisos previos
([`DEC-DATA-001`](01-decisiones-vigentes.md#dec-data-001)) y un tercero el día que se archiva (cap.
07 §6). *«Efectivamente inactiva»* es el término del §1.2: el reloj corre en los dos **y los dos lo
reinician si la cobertura vuelve**, que es lo que separa a quien se fue de quien volvió.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:389, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:393, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:402, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:408, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:409, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:411, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:415, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:420

### 2.2 Los nombres de estado, completos

Lo que sigue es el diccionario; las transiciones que existen están en
[`04-catalogos.md`](04-catalogos.md).

| máquina | estados |
|---|---|
| **Trial** | `PRE_TRIAL` · `TRIAL_ACTIVE` · `TRIAL_CONVERTED` · `TRIAL_EXPIRED` |
| **Suscripción** | `PENDING_AUTHORIZATION` · `ABANDONED` · `ACTIVE` · `GRACE_PERIOD` · `PAUSED` · `SUSPENDED` · `CANCEL_SCHEDULED` · `CANCELLED` · `CHARGE_DECLINED`. **`RECONCILIATION_REQUIRED` no está en la lista porque no es un estado**: es la marca `requiere_conciliación` sobre la fila, que conserva el suyo — y **tampoco es un booleano**, es una fila con motivo y reloj (§2.5) |
| **Pago** | `PENDING` · `SUCCEEDED` · `FAILED` · `REFUNDED` · `PARTIALLY_REFUNDED` · **`CHARGED_BACK`** — el sexto, un contracargo, desde la FASE 8 completa (`F-8CB3-009`, [`DEC-SUB-020`](01-decisiones-vigentes.md#dec-sub-020); cap. 03 (billing) §6) |
| **Pago manual** | `AWAITING` · `REGISTERED` · `DECLARED_UNPAID` |
| **Addon (instancia)** | `PENDING_AUTHORIZATION` · `ABANDONED` · `ACTIVE` · `EXPIRED` · `CANCELLED` |
| **Publicación** | `DRAFT` · `PUBLISHED` · `UNPUBLISHED_BY_BILLING` · `ARCHIVED` · **`PURGED`** · **`MODERATED`** — el quinto, final: la ficha cuyo contenido borró el día 180 (`PB9`) **o su dueño ([`PB12`](04-catalogos.md#trans-v-pb12))**, que no se republica ni cuenta para el cupo; desde la FASE 8 completa (`F-8CA2-008`, `DEC-DATA-005`, owner 2026-09-25; `V/03` §9). **El sexto, `MODERATED`**: la ficha que un admin bajó con motivo ([`PB10`](04-catalogos.md#trans-v-pb10)); no la republica el dueño ni el sistema, no cuenta para el cupo y sólo un admin la saca, al estado que corresponda por su origen: `DRAFT` ([`PB11`](04-catalogos.md#trans-v-pb11)) o `UNPUBLISHED_BY_BILLING` por [`PB13`](04-catalogos.md#trans-v-pb13), con `PB3` en el mismo acto si hay cobertura y cupo; un archivado cuenta por el origen del archivado (`DEC-DATA-007`, 📌 de C10) |
| **Postulación de Partner** | `PENDIENTE` · `APROBADA` · `RECHAZADA` |
| **Grace** | no es una máquina propia: es el sub-estado `GRACE_PERIOD` de Suscripción, con su reloj |
| **Pausa** | no es una máquina propia: es el sub-estado `PAUSED` de Suscripción, **con un motivo obligatorio** |
| **Reembolso** ✚ | `REQUESTED` · `CONFIRMED` · `EXECUTED` · `FAILED` — **la décima máquina**, mínima: `CONFIRMED` es la confirmación de una persona ([`DEC-RF-001`](01-decisiones-vigentes.md#dec-rf-001), [INV:D11](02-nucleo.md#inv-d11)), y `EXECUTED` lo escribe la relectura del proveedor o, en una devolución hecha por fuera de él, la persona que la asienta con la acción administrativa [ACC:14](02-nucleo.md#acc-14) (la decimocuarta de `NUCLEO/08` §3). Sus transiciones, [`RF1`](04-catalogos.md#trans-b-rf1)–[`RF5`](04-catalogos.md#trans-b-rf5), viven en el cap. 03 (épica de billing) §6.1 (owner 2026-09-25; FASE 9 completa, decisión 5a, `F-8CB1-015`) |

> **`ABANDONED` existe porque `M-SUB-01` exige que la ventana del preapproval sin autorizar tenga
> duración máxima y limpieza**, y sin un estado de salida esa ventana no vence nunca.
>
> **La postulación de Partner es la NOVENA máquina.** `M-PARTNER-01` pregunta textualmente si la
> postulación *«es una entidad con estados propios»*, y lo es — hay una decisión humana en el medio,
> así que `APROBADA` y `RECHAZADA` no son el mismo dato con distinto signo. Se agrega al núcleo en
> vez de declararse en su subdominio, que es la regla del índice.
>
> **El reembolso es la DÉCIMA** (FASE 9 completa, decisión 5a). La fila `refund` guardaba
> *«estado»* sin valores ni transiciones, y el reintento del `2084` no tenía dónde vivir.

**`PAUSED` lleva motivo, y no es un detalle de implementación.**
[`DEC-GRANT-004`](01-decisiones-vigentes.md#dec-grant-004) lo fija: en el proveedor una cortesía y
una pausa pedida por el cliente **se ven idénticas**, así que la intención vive en nuestro lado o no
existe. El motivo es un valor cerrado —`CUSTOMER_REQUEST` o `COURTESY`— y **el reloj que reanuda lee
el motivo, nunca el estado del proveedor**.

**`PRE_TRIAL` es un estado real**, no la ausencia de uno: es donde vive quien entró a la vertical y
todavía no publicó, con borradores ilimitados, sin capacidades comerciales y sin consumir trial
([`DEC-TRIAL-007`](01-decisiones-vigentes.md#dec-trial-007)).

**Real no quiere decir con fila.** Una fila en `PRE_TRIAL` no llevaría **ni un dato** que su
ausencia no lleve: el hash del correo normalizado, el piso del trinquete, la referencia al plan y las
dos fechas se escriben **todos** en [`T1`](04-catalogos.md#trans-v-t1) (cap. 02 §2.2, épica de
verticales). Lo que hace real a `PRE_TRIAL` son sus reglas y **sus transiciones de salida — tres:
`T1`, [`T6`](04-catalogos.md#trans-v-t6) y [`T8`](04-catalogos.md#trans-v-t8)** ([`T7`](90-retirados.md#trans-v-t7)
salió: revisión del owner, 2026-09-28, N7) (`V/03` §2)—, y todas existen sin fila.

**`CANCEL_SCHEDULED` existe aunque el proveedor ya esté cancelado.**
[`DEC-SUB-009`](01-decisiones-vigentes.md#dec-sub-009) decidió cancelar en el proveedor de inmediato
y sostener el servicio de nuestro lado hasta el fin del período pagado: durante esa ventana la
suscripción no está ni `ACTIVE` ni `CANCELLED`, y la fecha de fin de servicio **es un dato
nuestro**, no del proveedor.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:428, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:434, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:435, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:436, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:437, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:438, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:439, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:440, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:443, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:445, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:449, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:455, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:461, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:466, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:470, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:476

### 2.3 Dos reglas sobre los nombres

1. **Un estado se llama igual en toda la spec, en la base y en la API.** No hay mapa de traducción
   entre capas. Si hiciera falta uno, es señal de que hay dos vocabularios y entonces hay un defecto
   de diseño, no un problema de nombres.
2. **El vocabulario es cerrado y la base lo restringe.** El §63 pide máquinas explícitas; una
   columna que acepte cualquier cadena no tiene máquina, tiene una convención. El modelo de datos
   fija que cada columna de estado lleva su restricción de dominio.

> **Quién siembra los cuatro inventarios de este §2.** Los §2.4, §2.5 y §2.6 los cuentan
> [`G-R1-E`](04-catalogos.md#guard-g-r1-e) y [`G-R1-F`](04-catalogos.md#guard-g-r1-f). **Son
> capítulos de [`B3`](10-corte/B3.md#pieza-b3)** (`B/descomposicion.md` §2.9 punto 2), que es la
> unidad que construye esos dos guards y los términos más tempranos que enumeran. **`B3` los siembra
> enteros y cada unidad posterior trae su propia fila cuando llega**, que es la misma regla que cada
> inventario ya declara abajo. Lo que entró por `V9` es el **§1.2**, los cinco hechos de reinicio (y
> la escritura `C` del corte), y no estos inventarios. *(`V9` se partió con el corte del MVP
> (owner, letras Z y AC): el registro de los actos del dueño, fuente del hecho 1, es de
> [`V9a`](10-corte/V9a.md#pieza-v9a), al corte; el reloj de 90 y 180 días con sus cinco hechos de
> reinicio, que lee el hecho 1 de ese registro, es de [`V9b`](20-fase-1/V9b.md#pieza-v9b); y la
> columna `listing.inactiva_desde` con la escritura `C` es de [`V6`](10-corte/V6.md#pieza-v6), cuya
> migración la crea —`V/descomposicion.md` §2, filas de `V9a` y `V9b`, y el párrafo de la escritura
> `C`—.)*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:481, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:483, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:486, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:490, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:496, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:72, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:73, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:439

### 2.4 «Vivo» nombra cuatro conjuntos, y nunca el mismo

La palabra decidía tres cosas caras —el candado del §11, el disparo de
[`S17`](04-catalogos.md#trans-b-s17) y la condición de [`T6`](04-catalogos.md#trans-v-t6)— y el
glosario tiene que definirla, por su propia regla de que *«todo lo que el resto de la spec use tiene
que estar acá»*. Los dos primeros conjuntos que nombraba difieren en **la mitad de sus seis
estados**. Acá se separan, y cada uno tiene un nombre propio que ya no se puede confundir con los
otros.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **fila viva** | una fila —de suscripción o de instancia de addon— que **ocupa el lugar del usuario en esa vertical**: la que todavía tiene una autorización que puede cobrar, **o la suspendida, a la que tiene que apuntar la vuelta** (reescrito el 2026-09-24 por decisión del owner): desde [`DEC-SUB-019`](01-decisiones-vigentes.md#dec-sub-019) una `SUSPENDED` de tarjeta **ya no puede cobrar** y sigue siendo viva, porque si dejara de serlo el candado se abriría y la vuelta entraría como un alta suelta, dejando **dos filas** en la misma vertical. Siendo viva, la vuelta **tiene** que entrar como sucesora y la suspendida se cierra al autorizarse (`S17`) | **son dos enumeraciones, una por sujeto.** De la **suscripción**, los **seis**: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED` (cap. 02 (épica de billing) §2.2). De la **instancia de addon**, los **dos**: `PENDING_AUTHORIZATION` y `ACTIVE` (cap. 03 (billing) §8) | el candado del §11: impedir un segundo `INSERT` **mientras una fila ocupa el lugar del usuario en esa vertical** —la que sigue pudiendo cobrar, o la suspendida a la que tiene que apuntar la vuelta— (FASE 8 completa, `F-8CD1-010`) |
| **fuente viva** | una fuente que el contrato de cobertura **devuelve hoy** en `fuentes` | la lista de esa respuesta, resuelta en el momento (`12-contrato…` §2) | resolver la cobertura y las capacidades: los pasos 5 y 6 de la autorización |
| **grant vivo** | un `permanent_grant` **que todavía no fue revocado** | **no se enumera con estados: es una columna.** `revocado_en` **nulo** (cap. 02 (billing) §2.4). No hay máquina de estados del grant y no hay más valores que esos dos | contestar **después del acto** si la concesión sigue en pie: los tres backstops de abajo, que corren en el barrido diario y no en el instante de revocar |
| **ancla viva** | una fila de `permanent_grant_vertical` **cuyo grant está vivo** | **no tiene enumeración propia**: el ancla no lleva estado, así que se deriva **entera** del grant (cap. 02 (billing) §2.4) | preguntar por **una vertical concreta**, que es lo que el grant solo no contesta: el título es por vertical |

**Los dos últimos llegaron tarde y por el mismo camino que el resto de este §**: tres predicados los
usaban —la tercera y la cuarta comprobación del barrido y la tercera mitad de la orfandad— y **el
modelo no tenía dónde escribirlos**, así que los tres eran inevaluables. Es la misma forma de
defecto que [`S19`](04-catalogos.md#trans-b-s19): el término estaba en uso, no estaba definido, y su
ausencia no la devolvía ninguna búsqueda **porque el lugar donde faltaba no lo nombraba**. La columna
la agrega el cap. 02 (billing) §2.4 y la razón entera está ahí.

> **«Grant vivo» y «ancla viva» son UN conjunto y su proyección, no dos independientes.** Revocar es
> **una** escritura sobre el instrumento y las N anclas dejan de ser vivas **a la vez**; no existe un
> ancla viva de un grant revocado ni un grant vivo sin anclas vivas. Se separan por el **sujeto del
> predicado**, exactamente como las dos enumeraciones de *«fila viva»*: el que pregunta por una
> vertical dice *«ancla viva»*, el que pregunta por el instrumento dice *«grant vivo»*.

**Los tres que quedan afuera de la primera lo están por la razón que le da su nombre**:
`ABANDONED`, `CANCELLED` y `CHARGE_DECLINED` **no tienen autorización que pueda cobrar** —
[`S3`](04-catalogos.md#trans-b-s3) canceló el preapproval, la suscripción terminó, o
**[`S16`](04-catalogos.md#trans-b-s16) lo canceló al leer el primer cobro rechazado —de nuestro
lado, o ya lo había hecho el proveedor—** (FASE 9 completa, `C-R12-2`; `B/03` §3.2, `S16`). **Y
tampoco son la fila a la que tiene que apuntar la vuelta**, que es la otra mitad de la definición:
la `SUSPENDED` de tarjeta tampoco puede cobrar desde `DEC-SUB-019` y sigue adentro **sólo** por esa
mitad (fila de arriba). No poder cobrar ya no alcanza para quedar afuera (FASE 8 completa,
`F-8CD1-010`).

**Y en la instancia de addon quedan afuera otros tres, por lo mismo**: `ABANDONED`, `EXPIRED` y
`CANCELLED`. **La segunda enumeración se escribió cuando un consumidor la necesitó**, y la necesitó
caro: el `desde` de [`A5`](04-catalogos.md#trans-b-a5) decía `ACTIVE` y nada más, así que una
instancia que autorizaba **después** de que su título murió nacía con su preapproval cobrando y
ninguna transición la alcanzaba (cap. 03 (billing) §8). La definición de arriba **ya nombraba los dos
sujetos** y sólo enumeraba uno; el que faltaba es el que se coló. **Las dos enumeraciones no se
mezclan**: cuál aplica lo decide el sujeto del predicado, y todos los del inventario de abajo lo
nombran.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:499, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:501, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:509, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:510, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:511, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:512, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:514, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:521, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:528, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:538

#### El inventario de consumidores de «fila viva»

**Esta lista es el control, no un registro.** Es lo único del corpus que convierte *«fila viva»* de
un término en algo verificable, y quedó corta en el mismo commit que creó su sexto miembro —`S19`,
que escribió el predicado **sin el adjetivo** y con eso congeló para siempre la fila de todo cliente
que alguna vez abandonó un cambio de plan—. Por eso se mantiene entera y **la verifica un guard**
([`G-R1-E`](04-catalogos.md#guard-g-r1-e), `B/20` §2), no la memoria del que escribe.

Todos están del lado de billing y sobre filas de billing, que es la regla 1 de abajo. Se parten en
dos grupos porque **fallan distinto**:

**A · Preguntan «¿ESTA fila es viva?».** El error posible es enumerar mal el conjunto, y se detecta
comparando contra los seis.

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | el **alcance de [`S13`](04-catalogos.md#trans-b-s13)** | cap. 03 (billing) §3.2 | *«toda fila viva **principal** del beneficiario en cada vertical que el acto ancla»* — el adjetivo *«principal»* es parte del predicado: sin él entraban también las **suscripciones de complemento**, que son filas vivas del beneficiario en esa vertical, y el grant cancelaba los addons pagados |
| 2 | el **`desde` de [`S17`](04-catalogos.md#trans-b-s17)** | cap. 03 (billing) §3.2 | *«la predecesora, si sigue siendo fila viva»* — las cinco alcanzables |
| 3 | la **condición de cierre de [`S18`](04-catalogos.md#trans-b-s18)** | cap. 03 (billing) §3.2 | *«la predecesora ya no es fila viva»* |
| 4 | el **`desde` de `S18`** | cap. 03 (billing) §3.2 | la **sucesora viva**: `ACTIVE`, o `PENDING_AUTHORIZATION` si la predecesora murió sola |
| 5 | la **primera mitad del addon huérfano** | cap. 16 (billing) §4.2 | *«la suscripción de esa vertical dejó de ser fila viva»* — **la lee también la fila `LISTING`**, que remite a este mismo predicado sobre la principal de la vertical de la ficha en vez de reescribirlo (FASE 8 completa, `F-8CA2-003`, owner 2026-09-25): el consumidor es el mismo, no uno nuevo. **Y lo lee sobre un conjunto y no sobre una fila** (FASE 9 completa): el `LISTING` queda huérfano si **ninguna** principal de ese `user + vertical` es fila viva (decisión 4c), y el `USER`/`GLOBAL` si en **ninguna vertical compatible** hay una principal fila viva **y pagando** (§2.4, al final) ni un ancla viva (decisión 4d; owner 2026-09-25). Sigue siendo el mismo consumidor |
| 6 | la **condición 3 del pago tardío** | cap. 05 (billing) §3 | *«no hay otra fila viva principal del mismo `user + vertical`»* — las seis, `PENDING_AUTHORIZATION` incluido |
| 17 | la **tercera comprobación del barrido** | cap. 09 (billing) §3 | *«un beneficiario con un ancla viva en la vertical V no debería tener una fila viva **principal** en V, **ni una fila viva DE COMPLEMENTO de un addon compatible con V** si el grant lleva `includesAddons: true`»* — el detector de la ejecución parcial de `S13` **y de [`S20`](04-catalogos.md#trans-b-s20)**, que corren en el mismo acto. Las dos mitades enumeran **los seis**: las dos filas son suscripciones. **Y el *«ancla viva»* de su predicado es el OTRO término**, con su propio inventario (más abajo) |
| 18 | el **`desde` de [`A5`](04-catalogos.md#trans-b-a5)** | cap. 03 (billing) §8 | *«toda instancia con una autorización que puede cobrar»* — es **un consumidor cuyo sujeto es SÓLO una instancia de addon**, como el 23, el 25 y el 26 (la lista está en las filas, no en esta celda; FASE 9 vuelta 1, `N-G2V-03`); **el 19 y el 24 la nombran junto con una suscripción** (FASE 9 vuelta 1, `F-8V1D1-009`), así que su enumeración es la de **dos**, no la de seis. Decía `ACTIVE` y nada más, y la mitad que faltaba —`PENDING_AUTHORIZATION`— es la ventana de autorización por la que un complemento nacía cobrando sobre un título ya muerto |
| 19 | el **alcance de `S20`** | cap. 03 (billing) §3.2 | *«toda fila viva **DE COMPLEMENTO** del beneficiario … cuya instancia esté en uno de sus dos estados vivos»* — es **un consumidor con dos sujetos a la vez, como el 24** (FASE 9 vuelta 1, `N-G2V-03`): enumera **los seis** para la suscripción de complemento y **los dos** para la instancia, y ninguna de las dos enumeraciones sirve para la otra. Es el reverso exacto del 1: `S13` dice *«principal»* para dejar los complementos afuera, `S20` dice *«de complemento»* para que sean los únicos adentro |
| 20 | el **`desde` de [`S21`](04-catalogos.md#trans-b-s21)** | cap. 03 (billing) §3.2 | *«toda fila viva **DE COMPLEMENTO** de la que cuelga una instancia de addon»* — enumera **los seis**, los de la suscripción, y **no enumera** el conjunto de la instancia: la nombra por un **estado terminal concreto**, `CANCELLED`, que es su condición. Por eso éste no cuenta entre los consumidores con dos sujetos a la vez —el 19 y el 24— (FASE 9 vuelta 1): acá el segundo sujeto no aporta una enumeración de *«fila viva»*, aporta su opuesto. **Y no necesita el adjetivo que el 1 sí necesita**: de una fila principal no cuelga ninguna instancia, así que el conjunto queda partido por el sujeto y no por una acotación |
| 21 ✚ | el **`desde` de [`S31`](04-catalogos.md#trans-b-s31)** | cap. 03 (billing) §3.2 | la **sucesora viva** de una sucesión en curso cuya predecesora un contracargo acaba de cortar: `PENDING_AUTHORIZATION`, o `ACTIVE` con `S17` sin confirmar (FASE 8 completa, pendiente 8, owner 2026-09-25) |
| 23 ✚ | el **`desde` de [`A6`](04-catalogos.md#trans-b-a6)** | cap. 03 (billing) §8 | *«`ACTIVE` —o `PENDING_AUTHORIZATION`»*: los **dos** de la instancia, la misma enumeración que el 18. Entró con `K-9` (FASE 9 completa), cuando el borrado salió de `A5`: si el conjunto vivo de la instancia cambia, cambian los dos (FASE 9 vuelta 1, `F-8V1D1-009`) |
| 24 ✚ | el **`desde` de [`S32`](04-catalogos.md#trans-b-s32)** | cap. 03 (billing) §3.2 | la fila de complemento en `ACTIVE` **y** su instancia viva: dos sujetos, como el 19 (FASE 9 completa, 4a; inventariado en la FASE 9 vuelta 1) |
| 25 ✚ | la **cuarta comprobación del barrido** | cap. 09 (billing) §3 | *«si una instancia está en uno de sus **dos** estados con autorización que puede cobrar —`PENDING_AUTHORIZATION` o `ACTIVE`»*, incluida su mitad de `fichaPurgada`, que es la red del empuje de `G2-1`: los **dos** de la instancia, la misma enumeración que el 18 y el 23 (FASE 9 vuelta 1, `N-G2V-03`) |
| 26 ✚ | la **búsqueda del consumidor del empuje *«la ficha llegó a `PURGED`»*** | `12-contrato…` §3.1 | *«las instancias en uno de sus dos estados vivos … de scope `LISTING` con ese `objetivo`»*: los **dos** de la instancia. Entró con `G2-1` (owner 2026-09-26) diciendo *«instancias vivas»* sin enumerar, y una implementación con la lista vieja no encontraba la instancia en un estado nuevo y la dejaba al barrido: el día de atraso que el empuje venía a evitar (FASE 9 vuelta 1, `N-G2V-03`) |
| 27 ✚ | la **respuesta de `puedeCobrarle`** | `12-contrato…` §4.1 | *«¿le queda a esta cuenta una autorización que todavía puede cobrar?»*: toda suscripción de la cuenta, principal o de complemento y en cualquier vertical, en una de las filas vivas **menos `CANCEL_SCHEDULED`; o una `CANCEL_SCHEDULED` o una terminal cuyo preapproval canceló una llamada nuestra que ninguna relectura vio todavía `cancelled` (`B/09` §3, salvedades 1 y 4); o una terminal cuyo preapproval canceló el proveedor tras un cobro rechazado, mientras no pase el plazo 16 ([PLAZO:16](02-nucleo.md#plazo-16), 7 días) desde la primera relectura que lo vio `cancelled`, que es lo que el barrido todavía relee ([`EX-45`](04-catalogos.md#mp-ex-45)); o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta sobre una suscripción suya. Es la respuesta entera, y contesta sobre la cancelación confirmada por Mercado Pago, no sobre el estado de la fila** (FASE 9 vuelta 3, owner 2026-09-30, lote D; F-8V3C1-004, F-8V3D1-002; la terminal que canceló el proveedor tras un rechazo, lote AE y VC3-cobro-02): la `CANCEL_SCHEDULED` decía que ya estaba dada de baja en el proveedor, y el barrido reintenta su cancelación hasta 3 días con el preapproval `authorized`; sin la marca, además, contestaba `no` justo cuando el barrido deja de reintentar. **De las filas vivas entran las seis, la sexta mientras su cancelación no esté confirmada**: la pregunta es si puede cobrar, no si ocupa el lugar; la `SUSPENDED` entra aunque la de tarjeta ya no cobre, porque la de pagador manual reabre por [`MP4`](04-catalogos.md#trans-b-mp4) (cap. 03 (billing) §7.1). **Lo que cuenta `G-R1-E` es esta fila, la mitad de *«fila viva»***; la mitad de la marca es la fila 12 del inventario de *«marca abierta»* (§2.5), que cuenta `G-R1-F`, y la de las terminales sin confirmar no enumera ningún conjunto de este glosario: cita las salvedades de `B/09` §3 en vez de reescribirlas. **Qué relectura confirmó la cancelación lo guarda `provider_link.cancelado_visto_en`**, el instante de la primera relectura que vio el preapproval `cancelled`: con la columna escrita la suscripción deja de contar **(la que canceló el proveedor tras un rechazo, recién cuando pasa el plazo 16 desde ese instante; lote AE)**, y una relectura que lo vuelve a ver vivo la vacía (`B/02` §2.2, `B/09` §3; FASE 9 vuelta 3, owner 2026-09-30, lote Z). La evalúa billing y lo que cruza es sólo el sí o no; su lector es la acción 24 ([ACC:24](02-nucleo.md#acc-24)), de verticales, que espera mientras contesta `sí` (verificación corta, 2026-09-29, lotes M-F y M-G) |

**B · Preguntan «¿hay OTRA fila viva apuntándola?».** El error posible es **omitir el adjetivo**, y
es el que ya ocurrió: sin él el predicado **no tiene forma de dejar de cumplirse**, porque nada
limpia `sucede_a` cuando la sucesora se muere (`B/02` §2.2, cuarto estado de la relación).

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 7 | la **condición de `S17`** | cap. 03 (billing) §3.2 | *«tiene una sucesora **viva** con `sucede_a` apuntándola»* |
| 8 | la **condición de [`S19`](04-catalogos.md#trans-b-s19)** | cap. 03 (billing) §3.2 | ídem — y es el que entró sin el adjetivo |
| 9 | la **tabla de los cuatro estados de la relación** | cap. 03 (billing) §3.2 | qué candado ocupa cada uno |
| 10 | la **salvedad de la fila `authorized × GRACE_PERIOD·SUSPENDED`** | cap. 03 (billing) §10.1 | si marcar es un falso positivo |
| 11 | la **segunda mitad del addon huérfano** | cap. 16 (billing) §4.2 | *«y no hay una fila viva con `sucede_a` apuntándola»* — el único que lo escribió bien desde el principio — **la lee también la fila `LISTING`**, que remite a este mismo predicado sobre la principal de la vertical de la ficha en vez de reescribirlo (FASE 8 completa, `F-8CA2-003`, owner 2026-09-25): el consumidor es el mismo, no uno nuevo |
| 12 | la **segunda mitad de la condición 3** | cap. 05 (billing) §3 | *«una sucesora viva que ya autorizó»* |
| 13 | el **sujeto de la regla de `B/12` §5.3** | cap. 12 (billing) §5.3 | *«la predecesora de una sucesión en curso»* |
| 14 | **[`G-R1-D`](04-catalogos.md#guard-g-r1-d)** | cap. 20 (billing) §2 | el mismo predicado, como guard |
| 15 | la **primera comprobación del barrido** | cap. 09 (billing) §3 | *«la predecesora a la que apunta ya no es fila viva»* |
| 16 | la **partición en cuatro por columna** | cap. 02 (billing) §2.2 | la definición operativa de *«sucesión en curso»* |
| 22 ✚ | la **guarda de sucesión de [`S6`](04-catalogos.md#trans-b-s6)** | cap. 03 (billing) §3.2 | *«`S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso —una sucesora viva apuntándola—»*, por los dos primeros eventos; por el tercero la guarda no corre (owner, 2026-09-24 y 2026-09-25; FASE 8 completa, `F-8CD1-010`) |

**El grupo B es el que hay que mirar dos veces, y hay una razón medida.** Un predicado del grupo A
que se equivoque enumera un conjunto y se compara contra seis nombres; uno del grupo B que se
equivoque **parafrasea** —*«tiene una sucesora con `sucede_a` apuntándola»* dice lo mismo que *«hay
una fila viva con `sucede_a` apuntándola»* menos el adjetivo—, y ninguna búsqueda por el término lo
devuelve, porque el término no está. Lo único que lo encuentra es que este inventario tenga una fila
menos que los consumidores, que es la mitad que `G-R1-E` cuenta.

**El 6 vigila una autorización que puede cobrar, que es este conjunto, y no el de «un estado que dé
título».** Su enumeración decía *«un estado que dé título»* y listaba **cuatro** —el conjunto de
`12-contrato…` §2.6—, cuando el peligro que vigila es **una autorización que puede cobrar**. Los dos
conjuntos coincidían hasta que `PENDING_AUTHORIZATION` dejó de emitir fuente, y desde entonces la
diferencia entre ellos era justamente el estado por el que se colaba un doble cobro.

**Y los dos primeros conjuntos no coinciden, con la distancia contada contra la tabla de diez filas
del `12-contrato…` §2.6.** De las **seis** filas vivas **de la suscripción**, **tres no emiten
ninguna fuente**: `PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED` cuando el motivo es
`CUSTOMER_REQUEST`. Y la cuarta discrepancia es de otra forma: `PAUSED` por `COURTESY` **sí** emite,
pero con `tipo: CORTESÍA` y no como suscripción — o sea que `PAUSED` es el único de los seis cuya
respuesta **no la decide el estado**, sino el motivo.

Una fila viva no implica una fuente viva, y una fuente viva no implica una fila viva —un grant
permanente y el piso `BASE` no tienen fila de suscripción ninguna—. **Las dos direcciones fallan**,
así que no hay ninguna lectura en la que una sea el proxy de la otra.

**Y «viva» tampoco es «cubre».** Una fuente viva puede ser de clase `BASE` o `COMPLEMENTO`, y
ninguna de las dos cuenta para `cubierto` (`12-contrato…` §2.4): estar en la lista y contar para la
cobertura son dos preguntas, y la segunda se escribe **nombrando la clase**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:546, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:548, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:557, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:562, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:563, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:564, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:565, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:566, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:567, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:568, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:569, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:570, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:571, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:572, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:573, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:574, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:575, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:576, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:577, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:579, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:585, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:595, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:597, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:604, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:611, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:618, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:622

#### El inventario de consumidores de «grant vivo» y «ancla viva»

**Es la misma clase de control que el de arriba y existe por la misma razón medida**: los tres
predicados que preguntan por un grant vivo estaban escritos **antes** de que el término tuviera
columna, y ninguno de los tres figuraba en ninguna lista. Se mantiene entero, con la misma regla:
**quien escribe un consumidor nuevo agrega su fila acá en el mismo acto**, y lo vigila la segunda
mitad de [`G-R1-E`](04-catalogos.md#guard-g-r1-e) (`B/20` §2).

**Se parten por el sujeto del predicado**, que es lo único que decide cuál de los dos nombres va.

**A · Preguntan por una VERTICAL concreta → «ancla viva».**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | la **tercera comprobación del barrido** | cap. 09 (billing) §3 | *«si un beneficiario tiene un **ancla viva** en la vertical V y además una fila viva principal suya en V —o una de complemento compatible, con `includesAddons: true`— el fan-out no terminó de correr»* |
| 2 | la **tercera mitad de la condición de orfandad** | cap. 16 (billing) §4.2 | *«ningún grant permanente la releva: no hay en esa vertical **un grant vivo** que valga como título»* — nombra el instrumento y **pregunta por una vertical**, así que el conjunto que evalúa es el del ancla — **la lee también la fila `LISTING`**, que remite a este mismo predicado sobre la principal de la vertical de la ficha en vez de reescribirlo (FASE 8 completa, `F-8CA2-003`, owner 2026-09-25): el consumidor es el mismo, no uno nuevo |
| 3 | la **excepción del §2.4 de addons** | cap. 16 (billing) §2.4 | *«un grant permanente vale como título en lugar de la suscripción `ACTIVE`»*, y **vale sólo donde el grant ancló** (§4.2): sin ancla viva en esa vertical no hay título |
| 4 | la **incompatibilidad cortesía × grant** | cap. 14 (billing) §4.3 | *«sobre un grant no se otorga cortesía»* — el predicado es *«hay un **ancla viva** en la vertical de esa suscripción»*, porque lo que lo justifica es que no quede obligación de pago, y sobre un grant **revocado** sí queda |

**B · Preguntan por el INSTRUMENTO → «grant vivo».**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 5 | la **segunda mitad de la cuarta comprobación del barrido** | cap. 09 (billing) §3 | *«el ancla que era su título ya no es la de un **grant vivo**»* — el sujeto es la instancia y lo que se lee es el grant al que su ancla pertenece |
| 6 | el **evento de [`S13`](04-catalogos.md#trans-b-s13)** | cap. 03 (billing) §3.2 | *«`SUPER_ADMIN` otorga un* Free Forever*, o le ancla una vertical nueva a un **grant vivo**»* — anclarle una vertical a uno revocado no es un acto: no hay instrumento al que agregarle nada |
| 7 | el **evento de [`S20`](04-catalogos.md#trans-b-s20)** | cap. 03 (billing) §3.2 | ídem — es el mismo acto, y por eso los dos comparten el evento |
| 8 | la **tercera cláusula del evento de [`A5`](04-catalogos.md#trans-b-a5)** | cap. 03 (billing) §8 | *«se revoca el grant del que cuelga el ancla que era su título»* — es **el escritor**, no un lector: es el acto que hace que el grant deje de estar vivo, y por eso figura acá |
| 9 | la **invalidación del caché de entitlements** | cap. 02 (verticales) §3.2 | *«se otorga o se revoca … un grant, o se le ancla una vertical nueva a un **grant vivo**»* — es el único consumidor **fuera de billing**, y llega como evento, no como predicado: verticales no lee la columna (regla 1) |

**Tres reglas de uso, porque la ambigüedad ya costó tres críticos distintos:**

1. **Ninguna regla de la épica de verticales se condiciona sobre una fila viva.** No es una
   preferencia: **no puede**, porque *«el estado exacto de la suscripción no cruza»* (`12-contrato…`
   §4) y lo único que verticales recibe es `cubierto` y `fuentes`. Una condición de verticales
   escrita sobre filas vivas es inejecutable del lado que tiene que evaluarla, y el que la escriba va
   a terminar leyendo `cubierto` —que es **otro conjunto**— sin decirlo.
2. **«Vivo» sin calificar no se usa en un predicado.** En prosa explicativa se entiende solo; en la
   columna *condición* de una tabla de transiciones, en el enunciado de un invariante o en el de un
   guard va **«fila viva»**, **«fuente viva de clase `TÍTULO`»**, **«grant vivo»** o **«ancla
   viva»**, nunca la palabra sola. Lo vigila [`G-R4-B`](04-catalogos.md#guard-g-r4-b) (`V/20` §2)
   para el primer caso, que es el que cruza la frontera. **Los dos últimos nombres llegaron después
   de la regla, y es lo que la regla no alcanzó a impedir**: el evento de `S13` decía *«le ancla una
   vertical nueva a **uno vivo**»* —la palabra sola, sobre un sujeto que este glosario todavía no
   definía—, y el consumidor 17 de *«fila viva»* citaba *«un **ancla viva**»* enumerando sólo los
   dos *«vivos»* que sabía nombrar. **La regla se cumplía a medias porque el término no existía**:
   ningún guard puede exigir que se califique con un nombre que el glosario no tiene.
3. **Y tampoco se usa una PARÁFRASIS que lo omita, que es el caso que la regla 2 no contemplaba.**
   `S19` no violó la regla 2 —no usó la palabra suelta—: escribió *«tiene una sucesora con
   `sucede_a` apuntándola»*, que dice lo mismo que el predicado correcto **menos el adjetivo**, y con
   eso se saltó el único control que existía. Así que un predicado que mencione `sucede_a` **dice
   además en qué estado está la fila que lo escribió**, y **quien escribe un consumidor nuevo agrega
   su fila al inventario que le corresponda —el de *«fila viva»* o el de *«grant vivo»* / *«ancla
   viva»*— en el mismo acto**, antes de declarar el cambio aplicado. Lo vigila `G-R1-E` (`B/20` §2),
   en sus dos mitades. **Y hay dos inventarios más en este glosario** —el de *«marca abierta»* (§2.5)
   y el de *«cortesía diferida»* (§2.6)—, que **no son de `G-R1-E`**: sus sujetos no son conjuntos
   *«vivos»* sino un caso abierto y un instrumento en espera, y los vigila
   [`G-R1-F`](04-catalogos.md#guard-g-r1-f).

**El caso testigo, y son dos en direcciones opuestas.** [`T6`](04-catalogos.md#trans-v-t6) se
escribió con *«ya hay una suscripción viva»* leyendo las seis filas vivas, y sobre las tres que no
emiten fuente eso significaba **quemarle a alguien su trial único de por vida sin darle nada a
cambio**; leerlo como `cubierto` —el único conjunto que verticales puede observar— dejaba a
[`T1`](04-catalogos.md#trans-v-t1) disparando sobre esas mismas tres, con el desenlace opuesto. **El
mismo término, dos consumidores, dos daños opuestos**, y ninguna de las dos lecturas era arreglable
sin nombrar la otra.

**Y un término vecino que no es de «vivo» pero tuvo la misma forma de defecto: *«cobrada»* decía dos
cosas** (FASE 9 vuelta 1, `F-8V1D1-002`). Las dos lecturas están decididas y no se tocan; se separan
por nombre:

| término | qué es |
|---|---|
| **pagando** (una principal) | Tiene al menos un pago acreditado, **o** es la sucesora de una predecesora que venía pagando (owner 2026-09-25, 9e; la misma lectura de [`S4`](04-catalogos.md#trans-b-s4)). Es lo que exigen la validez de un addon ([`A1`](04-catalogos.md#trans-b-a1)) y su orfandad (`A5`, 4d). **No es el campo `cobrada` del contrato**, que mira sólo la fila y viene en `no` sobre esa sucesora (`12-contrato…` §2.1): son dos predicados y cada consumidor usa el suyo |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:626, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:628, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:636, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:640, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:641, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:642, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:643, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:645, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:649, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:650, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:651, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:652, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:653, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:655, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:657, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:662, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:672, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:684, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:691, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:697

### 2.5 «Marca abierta»: el otro término que estaba en uso y no estaba definido

**`requiere_conciliación` no es una columna: es un PREDICADO**, así que entra acá por la misma
razón que los cuatro conjuntos del §2.4: el corpus lo usa en la condición de una transición, en el
enunciado de un invariante y en el de un guard.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **marca abierta** | una fila de `reconciliation_mark` **sin `levantada_en`** | **no se enumera con estados: es una columna anulable.** Abierta o levantada, no hay más valores (cap. 02 (billing) §2.2) | contestar *«¿hay un caso que una persona todavía no resolvió sobre esta fila?»* — y **cuál**, porque la marca lleva su `motivo` |
| **`requiere_conciliación`** | el **predicado derivado** *«esta suscripción tiene **al menos una** marca abierta»* | se evalúa sobre las marcas de la fila; **no hay ninguna columna con ese nombre** | conservar verbatim las frases del corpus que ya decían *«la marca `requiere_conciliación`»*, que siguen siendo exactas |

> **El plural es el punto, y por eso el término es *«abierta»* y no *«puesta»*.** El corpus escribe
> **veinticuatro** motivos distintos sobre el mismo sujeto (cap. 02 (billing) §2.5; el catálogo de
> motivos está en [`04-catalogos.md`](04-catalogos.md), [MOT:1](04-catalogos.md#mot-1) a
> [MOT:24](04-catalogos.md#mot-24); el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y `R20`; el 16
> desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`, FASE
> 8 completa, owner 2026-09-25; el 20, `COBRO_DUPLICADO`, desde la pendiente 6; el 21 y el 22 desde
> la FASE 9 completa —`B/02` §2.5: `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y
> `PAUSA_NO_APLICADA`, `F-8CB2-003`—), y **nueve de ellos significan *«hay plata del cliente que
> devolver»*** (el octavo y el noveno desde la FASE 9 vuelta 2, `R4` y `R20`, como dice la fila 6
> de abajo; residuo corregido el 2026-10-02). Con un booleano, dos
> casos simultáneos eran uno solo y [`S15`](04-catalogos.md#trans-b-s15) los apagaba juntos; el que
> se perdía era el del dinero, porque es el que ninguna superficie nombraba. *«Puesta»* describe una
> casilla; *«abierta»* describe **un caso**, que es lo que una persona levanta de a uno.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:699, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:701, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:708, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:709, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:711, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:714, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:716

#### El inventario de consumidores de «marca abierta»

**Misma regla que los dos inventarios del §2.4, y acá la vigila
[`G-R1-F`](04-catalogos.md#guard-g-r1-f)** (`B/20` §2) —no `G-R1-E`, cuyo sujeto son los conjuntos
*«vivos»*—: quien escribe un consumidor nuevo agrega su fila acá **en el mismo acto**. Es el
**tercero** de los cuatro inventarios del glosario. Se parten por lo que preguntan.

**A · Preguntan «¿hay alguna marca abierta sobre esta fila?» — el predicado `requiere_conciliación`.**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 1 | el **`desde` de [`S15`](04-catalogos.md#trans-b-s15)** | cap. 03 (billing) §3.2 | *«cualquiera **con una marca abierta**»* |
| 2 | la **prohibición de ser sucedida** | cap. 03 (billing) §3.3 y cap. 02 (billing) §2.2 | *«una fila con una marca abierta no puede ser sucedida»*, cualquiera sea el motivo |
| 3 | la **salvedad 2 del barrido** | cap. 09 (billing) §3 | *«una suscripción terminal con al menos una marca abierta»*, hasta que **las levanten todas** |
| 4 | la **condición 3 del pago tardío**, segunda mitad | cap. 05 (billing) §3 | *«la sucesión quedó trabada **con la marca puesta**»* |

**B · Preguntan por UN motivo concreto.**

| # | quién | dónde | qué pregunta |
|---|---|---|---|
| 5 | **[`G-R1-C`](04-catalogos.md#guard-g-r1-c)** | cap. 20 (billing) §2 | *«un pago pendiente por [`S19`](04-catalogos.md#trans-b-s19) sin una marca abierta con motivo `REEMBOLSO_POR_CONFIRMAR`»* — **es el consumidor que el booleano volvía vacuo**: la marca sin motivo pasaba el guard |
| 6 | el **listado accionable** | cap. 19 (billing) §6 | ordena por motivo, pone adelante los **nueve** que devuelven plata (cap. 19 §6; el séptimo desde la pendiente 6, owner 2026-09-25; el octavo y el noveno desde la FASE 9 vuelta 2, `R4` y `R20`) y muestra **todos los pagos colgados de la marca con su monto total** y **el default de lo que el sistema propone** ([`DEC-RF-003`](01-decisiones-vigentes.md#dec-rf-003)) — **que desde [`DEC-RF-006`](01-decisiones-vigentes.md#dec-rf-006) se lee por motivo en los veinticuatro**, porque el único que no se leía así, el que abre [`S21`](04-catalogos.md#trans-b-s21), se partió en **dos** motivos: el **14** ([MOT:14](04-catalogos.md#mot-14)) propone no devolver y el **15** ([MOT:15](04-catalogos.md#mot-15)) devolver (cap. 02 (billing) §2.5, cap. 03 (billing) §3.2) |
| 7 | el **escalamiento por reloj** | cap. 09 (billing) §3 | *«si sigue abierta pasado su plazo, escala»* — lee `puesta_en`, **por marca**, así que el plazo puede depender del motivo |
| 8 | la **entrada del §22.1 para el reembolso por confirmar** | cap. 08 (núcleo) §4.3 | *«el monto a devolver, el pago que lo origina y por qué puerta entró»* — es el mismo dato que la marca **guarda**, en vez de vivir sólo en un evento que pasa |
| 9 | **`G-R1-F`** | cap. 20 (billing) §2 | que todo escritor nombre un motivo de la tabla, que ningún levantado sea *«la fila»*, **que un hecho con plata sobre una marca abierta del mismo motivo se cuelgue de ELLA** y **que no se levante una marca con pagos colgados sin resolver** |
| 10 | **[`S14`](04-catalogos.md#trans-b-s14), antes de abrir** | cap. 03 (billing) §3.2 | *«¿esta fila ya tiene una marca abierta con ESTE motivo?»* — si la tiene, **le cuelga el pago en vez de abrir una segunda** (cap. 02 (billing) §2.2) |
| 11 | **`S15`, antes de levantar** | cap. 03 (billing) §3.2 | *«¿le queda a esta marca algún pago colgado sin resolver?»* — es la guarda que impide cerrar el caso con plata adentro |
| 12 ✚ | la **respuesta de `puedeCobrarle`**, su mitad de la marca | `12-contrato…` §4.1 | *«¿hay una marca abierta con motivo `CANCELACIÓN_SIN_CONFIRMAR` sobre alguna suscripción de esta cuenta?»*: si la hay, contesta `sí` y la acción 24 ([ACC:24](02-nucleo.md#acc-24)) espera. La otra mitad es la fila 27 de *«fila viva»* (§2.4) (FASE 9 vuelta 3, owner 2026-09-30, lote D; F-8V3C1-004, F-8V3D1-002) |

**Y una regla de uso, que es la regla 2 del §2.4 sobre este sujeto**: en la columna *condición* de
una transición, en un invariante o en un guard **no se escribe *«marcada»* ni *«con la marca
puesta»* a secas** cuando lo que importa es **cuál**. Va *«con una marca abierta»* para el predicado
y **el motivo con su nombre** para el caso. La diferencia ya costó un crítico:
[`S18`](04-catalogos.md#trans-b-s18) escribía un motivo que la columna no admitía y **las tres ramas
que mueven dinero se apoyaban en él**.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:722, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:724, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:729, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:733, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:734, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:735, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:736, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:738, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:742, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:743, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:744, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:745, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:746, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:747, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:748, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:749, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:751

### 2.6 «Cortesía diferida»: la que espera a que la sucesora autorice

**Entra acá por la misma razón que las anteriores**: desde
[`DEC-GRANT-007`](01-decisiones-vigentes.md#dec-grant-007) hay un predicado en la columna *evento* de
una transición ([`S9`](04-catalogos.md#trans-b-s9)), uno en una comprobación del barrido y uno en un
guard, y los tres preguntan lo mismo.

| término | qué es | dónde se enumera | para qué existe |
|---|---|---|---|
| **cortesía diferida** | un `courtesy_grant` con **`saldo_meses` no nulo** y **`saldo_cerrado_en` nulo** | **no se enumera con estados: son dos columnas anulables** (cap. 02 (billing) §2.4). Corriente, diferida o **con el saldo cerrado**, no hay más valores | sostener los meses que `SUPER_ADMIN` firmó (en meses desde `F-8CB1-001`) **entre que la suscripción que pausaban muere y la siguiente autoriza** — la **sucesora** de un cambio de plan (`DEC-GRANT-007`) (el alta nueva salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan) |
| **cortesía vigente** | un `courtesy_grant` **no diferido** cuyo `fin` todavía no pasó | el `fin` de la fila, contra hoy | el predicado de siempre: *«¿este beneficiario está en cortesía hoy?»* |

> **Una cortesía diferida NO es una cortesía vigente, y los dos términos conviven a propósito.** La
> diferida **no cubre a nadie hoy** —su suscripción está `CANCELLED` y una `CANCELLED` no emite
> ninguna fuente (`12-contrato…` §2.6)—, y la vigente sí. Es la misma distinción que el §2.4 hace
> entre *«fila viva»* y *«fuente viva»*: el instrumento existe y no está emitiendo. **Y la fila sigue
> apuntando a la suscripción que pausaba**, que es lo que la mantiene resoluble, con **un** salto
> desde ahí: la **sucesora** se alcanza por `sucedida_por` (`DEC-GRANT-007`) (el segundo salto, al
> alta nueva, salió con la revisión del owner, 2026-09-28, C8).
>
> **Y el saldo CERRADO no es una tercera clase de cortesía: es la diferida que ya no va a volver.**
> El saldo tiene **cuatro** cierres —la sucesora que abandona el checkout
> ([`S3`](04-catalogos.md#trans-b-s3), [`DEC-GRANT-011`](01-decisiones-vigentes.md#dec-grant-011)),
> el grant que pasa a cubrir esa vertical ([`S13`](04-catalogos.md#trans-b-s13), cap. 14 (billing)
> §4.3), el destino de plan **no mensual —trimestral, semestral o anual—**
> ([`S18`](04-catalogos.md#trans-b-s18), FASE 8 completa; el `S2` del alta salió con la revisión del
> owner, 2026-09-28, C8; `DESTINO_DE_PLAN_NO_MENSUAL`, FASE 9 completa, contradicción 1 de `03`
> §R4.5) y **la sucesora que se corta porque un contracargo cortó a su predecesora**
> ([`S31`](04-catalogos.md#trans-b-s31), FASE 8 completa, pendiente 8)—, los cuatro escriben
> `saldo_cerrado_en` y su `motivo_cierre` (cap. 02 (billing) §2.4), y **el término los deja afuera a
> propósito**: si *«cortesía diferida»* siguiera siendo *«saldo no nulo»* a secas, los **dos**
> lugares que leen el término para hacer algo —el segundo disparador de `S9` y la sexta comprobación
> del barrido— seguirían persiguiendo un saldo que ya tuvo desenlace. **Se estrecha el término en
> vez de borrar el `saldo_meses`** porque los meses cerrados son el registro de qué se perdió, y el
> aviso que se le manda al beneficiario los nombra (cap. 19 (billing) §4, fila 18, y en el otro
> cierre la confirmación del §3.1 del capítulo de billing).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:760, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:762, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:768, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:769, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:771, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:776, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:782, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:783, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:792

#### El inventario de consumidores de «cortesía diferida»

**Misma regla y mismo guard que el §2.5** —lo vigila [`G-R1-F`](04-catalogos.md#guard-g-r1-f), que
es el que mira los términos que no son conjuntos *«vivos»*—: quien escribe un consumidor nuevo
agrega su fila acá en el mismo acto.

| # | quién | dónde | qué hace con el término |
|---|---|---|---|
| 1 | la **cuarta escritura de [`S18`](04-catalogos.md#trans-b-s18)** | cap. 03 (billing) §3.2 | **es el ÚNICO ESCRITOR**: cierra la cortesía sobre la predecesora y le escribe `saldo_meses` |
| 2 | el **segundo disparador de [`S9`](04-catalogos.md#trans-b-s9)** | cap. 03 (billing) §3.2 | *«una sucesora recién autorizada tiene una cortesía diferida esperándola»* — y es el que **borra** el saldo al re-emitir |
| 3 | la **fila de la cortesía** en el inventario del cierre | cap. 02 (billing) §2.6 | declara que **no se re-apunta**: se difiere |
| 4 | la **sexta comprobación del barrido** | cap. 09 (billing) §3 | *«una cortesía diferida cuya sucesora ya está `ACTIVE`»* — `S9` no corrió (el alta nueva y el tercer disparador salieron con la revisión del owner, 2026-09-28, C8) |
| 5 | **[`G-R1-C`](04-catalogos.md#guard-g-r1-c)** | cap. 20 (billing) §2 | *«un cierre que deja una cortesía vigente sin cerrar y sin `saldo_meses`»* ([`S25`](90-retirados.md#trans-b-s25) salió con la revisión del owner, 2026-09-28, C8) |
| 6 | el **cruce cortesía × cambio de plan** | cap. 14 (billing) §4.4 | es el § que lo explica entero, con su población y su riesgo aceptado |
| 7 | — (vacío) | — | **sale** (revisión del owner, 2026-09-28, C8): el efecto de `S25`; `S25` y [`DEC-GRANT-010`](90-retirados.md#dec-grant-010) eran de la discontinuación. La cuarta escritura de `S18` (el 1) queda como único escritor |
| 8 | — (vacío) | — | **sale** (revisión del owner, 2026-09-28, C8): el tercer disparador de `S9`; sin `S25` no hay cortesía diferida esperando un alta nueva, sólo una sucesora |
| 9 | el **cierre del saldo**, en [`S3`](04-catalogos.md#trans-b-s3) y en [`S13`](04-catalogos.md#trans-b-s13) | cap. 03 (billing) §3.2 | **SACAN una fila del término** (no son los únicos: el cierre de `S31` es el 11, pendiente 8; y el de `S18` por plan no mensual, FASE 8 completa —FASE 9 completa, contradicción 1 de `03` §R4.5—, tampoco figura acá): la sucesora abandonó el checkout (`DEC-GRANT-011`) o un grant pasó a cubrir esa vertical (`B/14` §4.3), el saldo se cierra y esa cortesía deja de ser diferida |
| 10 | la **superficie de «Mi Suscripción»** | cap. 19 (billing) §3 | es el único consumidor que **no** decide nada con el término: lo **muestra** — *«te quedan N meses, que empiezan a correr cuando completes el pago»* ([`DEC-GRANT-012`](01-decisiones-vigentes.md#dec-grant-012); en meses desde `F-8CB1-001`) |
| 11 ✚ | el **cierre del saldo en [`S31`](04-catalogos.md#trans-b-s31)** | cap. 03 (billing) §3.2 | **saca una fila del término**, como el 9: la sucesora que esperaba el saldo se corta porque un contracargo cortó a su predecesora, y el saldo se cierra con `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA` (cap. 02 (billing) §2.4; FASE 8 completa, pendiente 8, owner 2026-09-25) |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:796, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:798, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:803, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:804, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:805, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:806, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:807, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:808, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:809, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:810, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:811, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:812, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:813

## 3. Dónde vive la pausa

Cierra `A-SUB-02`. El §26 pide **tres** condiciones simultáneas para pausar: suscripción `ACTIVE`,
**billing mensual**, y *«plan que permita pause»*. El §18 reparte esas condiciones en dos entidades
distintas —el ciclo vive en el billing option, la política en el plan—, así que la pregunta *«¿este
cliente puede pausar?»* se respondería en cada lugar donde alguien se acuerde de hacer las dos
preguntas.

**Se resuelve derivando, no declarando dos veces.** La respuesta a esa pregunta es **una sola
función del núcleo**, y es el único lugar del sistema donde se responde:

```text
puedePausar(suscripción) =
      estado == ACTIVE                                  (§26)
  AND billingOption.ciclo == mensual                    (§26)
  AND versiónDePlan.permitePausa                        (§26 + DEC-ARCH-001)
  AND cuotaDePausaDisponible(user, vertical)            (§26.3 + DEC-SUB-004)
  AND NOT hayUnaCortesíaVigente(suscripción)            (DEC-GRANT-004, caso 2 invertido)
```

Cinco precisiones, cada una con su fundamento (la quinta, FASE 8 completa, `F-8CB1-001`):

1. **El flag vive en la versión de plan, no en el plan.** Quitarle la pausa a un plan tiene efecto
   sobre lo que el cliente puede hacer, y [`DEC-ARCH-001`](01-decisiones-vigentes.md#dec-arch-001)
   fija que lo que tiene efecto se versiona. Nadie pierde la pausa retroactivamente.
2. **La cuota se cuenta por `user + vertical`**, sobrevive a cancelar y volver a suscribirse
   ([`DEC-SUB-004`](01-decisiones-vigentes.md#dec-sub-004)), y se expresa en **meses**: los 120 días
   del §26.3 son 4 pausas-mes y los 240 son 8 ([`DEC-SUB-010`](01-decisiones-vigentes.md#dec-sub-010)).
   **El tope de una pausa ya no está atado al borrado** (revisión del owner, 2026-09-28, C14): la
   pausa pedida por el dueño detiene el reloj de retención (§1.2), así que `D16`
   ([INV:D16](90-retirados.md#inv-d16)) salió y con él su guard, `G-R5`.
3. **El último término no bloquea, avisa.** [`DEC-GRANT-004`](01-decisiones-vigentes.md#dec-grant-004)
   permite pausar estando en cortesía **avisando que la pierde**, y deja que el cliente elija. O sea:
   **no la decide `puedePausar()`** —que exige `estado == ACTIVE`, y la fila en cortesía está
   `PAUSED`—: **la decide la fila `PAUSED · COURTESY` → `PAUSED · CUSTOMER_REQUEST`
   ([`S35`](04-catalogos.md#trans-b-s35))** de la mitad de billing del capítulo 03 §3.2 (FASE 9
   completa, contradicción 5 de `R4` del informe `03`), y la superficie está obligada a mostrar la
   advertencia antes de confirmar.
4. **La pausa se pide en meses enteros** y empieza cuando el cliente la pide (`DEC-SUB-010`). No
   existe la pausa intra-ciclo: con el mínimo de un mes, la pausa que salía estrictamente peor que no
   pausar no se puede expresar.
5. **La cortesía temporal usa la misma validación** (FASE 8 completa, `F-8CB1-001`, owner
   2026-09-25; [`DEC-GRANT-003`](01-decisiones-vigentes.md#dec-grant-003) impl. 6): sólo sobre
   planes mensuales y en meses enteros, porque también se implementa pausando.
   [`S9`](04-catalogos.md#trans-b-s9) toma de esta función **el término del ciclo mensual** (cap. 03
   (billing) §3.2), **y sólo ése**: ni `permitePausa`, ni la cuota, ni la composición que deja
   afuera al pagador manual (**decidido por el owner el 2026-09-25**: la cortesía es un regalo
   nuestro, no un pedido del cliente, así que no gasta su cuota de pausas, no depende de que el plan
   permita pausar, y alcanza al pagador manual, cuya fecha de cobro es nuestra).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:817, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:819, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:825, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:828, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:837, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:839, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:842, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:846, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:858, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:865, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:868

## 4. El criterio Eje 1 / Eje 2

Cierra `O-ARCH-01` y `S-ARCH-02`. Éste es el hueco que hace verificable al §7, y el de
consecuencias más largas.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:876, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:878

### 4.1 El problema, exactamente

El §7 exige *«un único motor genérico de billing»* y prohíbe un billing por vertical. El §8 define
el **Eje 2** como *«Comportamiento específico de vertical»*, o sea que la variación por vertical es
legítima y esperada.

No hay contradicción formal entre las dos. El problema es que **sin un criterio escrito, cualquier
divergencia futura se justifica a sí misma como Eje 2** — que es literalmente cómo el §5.2 describe
lo que pasó: *«En vez de reutilizar correctamente Alojamientos, aparecieron caminos separados»*. Una
regla que no puede ser violada no es una regla.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:880, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:882, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:886

### 4.2 El criterio

**El Eje 2 es una lista cerrada. Todo lo que no está en ella es Eje 1 y no admite variante por
vertical.**

Se eligió una lista enumerada y no un principio abstracto por una razón: un principio —*«lo que hace
única a la vertical»*— se puede argumentar en los dos sentidos para casi cualquier pieza, y entonces
no descarta nada. Una lista se puede verificar contra una pieza concreta con una sola pregunta:
*¿está adentro?*

**Agregarle un ítem a la lista es una decisión registrada en el decision log**, no una configuración
más. Es el mismo mecanismo con que [`DEC-TRIAL-001`](01-decisiones-vigentes.md#dec-trial-001) acotó
los overrides del plan de trial, y por el mismo motivo: una lista que crece sin control vuelve
decorativo al principio que la contiene.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:891, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:893, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:896, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:901

### 4.3 La lista, completa

Ocho decisiones, cada una con el § que la habilita:

| # | decisión legítimamente por vertical | fundamento |
|---|---|---|
| 1 | **Qué evento activa el trial** | §10.4 lo exige: *«Partner y cualquier vertical futura sin Listing deberán definir su evento funcional equivalente explícitamente»*. Ya tabulado en [`DEC-TRIAL-006`](01-decisiones-vigentes.md#dec-trial-006). |
| 2 | **Qué recurso publica**, y si publica alguno | §6 le da ficha a tres verticales y se la niega a Turista; §17.1 le da a Partner Gold una presencia que **no** es una ficha. |
| 3 | **Qué sección aporta a Mi Cuenta** | §45: *«Cada vertical aporta menú/sección adecuada»*. |
| 4 | **Qué claves de entitlement y de limit tienen sentido** en ella | §36.1: un entitlement no debe escapar accidentalmente a otra vertical. |
| 5 | **Qué camino de alta admite**: self-service o administrado | §17.3: *«Partner MUST NOT utilizar onboarding self-service»*. |
| 6 | **Si hereda los beneficios de Turista VIP** | §16: *«puede configurar desde DB si hereda»*. |
| 7 | **Qué métodos de pago admite** | §17.2, y con su advertencia textual: *«No: `if partner -> cash`»*. Es configuración por plan, no una rama por vertical. |
| 8 | **Su página de pricing** | §47: *«Cada vertical: pricing propia»*. |

**Todo lo demás es Eje 1**, y la lista de lo que eso incluye no es corta: el alta y la autorización
de una suscripción, el cambio de plan y de ciclo, la pausa, el grace, la cancelación, el cobro, el
reembolso, los promo codes, las cortesías, los grants, la resolución de entitlements y limits, la
conciliación, la auditoría, el outbox y la retención.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:906, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:908, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:912, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:919, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:921

### 4.4 Cómo se verifica

Un criterio que nadie puede comprobar vuelve al punto de partida. Esta lista es comprobable
mecánicamente, y la spec lo pide explícitamente:

**Toda pieza que nombre una vertical y no implemente uno de los ocho ítems es una violación del
§7.** Eso es un guard estático, no una revisión de código — la diferencia importa porque el §3.3
declara que este programa atraviesa varias ventanas de contexto, y un criterio que dependa de que
alguien se acuerde no sobrevive a eso.

El capítulo 20 (testing) lo detalla junto con el resto de la estrategia de testing. Lo que queda
fijado acá es la regla: **la lista tiene ocho ítems, y crece sólo por decisión registrada.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:926, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:931, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:936

### 4.5 La trampa que este criterio evita a propósito

[`DEC-METH-003`](01-decisiones-vigentes.md#dec-meth-003) dejó anotada una trampa para el criterio de
FASE 5, y vale igual acá: una regla del tipo *«no nombra ninguna vertical en su lógica»* mandaría
**todo el Eje 2 a incumplimiento por definición**, porque el §8 define el Eje 2 justamente como
comportamiento específico de vertical.

Por eso el criterio no es *«no nombrar una vertical»* sino *«nombrarla sólo para uno de los ocho»*.
La diferencia es lo que lo hace aplicable en vez de vacuo.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:939, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:941, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:946

## 5. El mapa conceptual, en una figura

```text
User ──┬── es Turista Free siempre (§14, sin suscripción)
       │
       ├── por cada Vertical:
       │     ├── Trial (uno de por vida, §10.1)
       │     ├── Suscripción principal (un compromiso, §11 — hasta dos filas durante una sucesión)
       │     │     ├── ancla a → Versión de plan (DEC-ARCH-001)
       │     │     ├── y a → Billing option (§18)
       │     │     └── cubre → todas las fichas de esa vertical (§12)
       │     └── Fichas (varias, una por dueño, §6)
       │
       ├── Suscripciones de complemento (una por addon recurrente, DEC-ADDON-002)
       ├── Cortesías temporales (§34)
       └── Grant permanente (§35, con su scope de verticales)

Entitlements y limits efectivos = agregación de:
    versión de plan + herencia Turista VIP + addons + cortesía + grant
    (§36: mientras al menos una fuente lo otorgue, sigue activo)
```

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:951, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:953, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:968

## Lo que este glosario NO cierra

- **`M-ARCH-02`** (caché e invalidación) es del modelo de datos.
- **Las transiciones** entre los estados nombrados en §2.2 están en
  [`04-catalogos.md`](04-catalogos.md). Acá están los nombres, no las reglas de movimiento.
- **Qué pasa cuando una suscripción principal se va y quedan complementos vivos** es del capítulo 16
  de billing (`E-ADDON-04`).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:975, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:977, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:980
