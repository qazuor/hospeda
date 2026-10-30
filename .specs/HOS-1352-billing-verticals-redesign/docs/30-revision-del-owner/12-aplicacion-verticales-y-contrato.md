---
title: "Revisión del owner · aplicación, tanda 2: verticales y el contrato"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación, tanda 2: verticales y el contrato

C4 con `L2-e` y `L2-f1`/`f2`/`f3` (la cuota por fecha del ciclo), C12 con `L1-a` y `L1-b` (el corte
con la ficha a la vista publicada y una prueba activa), C10 con `L2-i` y `g3` (moderación en dos
niveles), C14 con `L1-c` (la pausa detiene la retención), N6 con `L1-d` (el domicilio del
contrato), C7 (entrar como, sólo la condición) y los ítems de N7 que le tocan a verticales, de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `a6db40430e`, sin commits. Leído antes el
registro de la tanda 1 ([`11-aplicacion-simplificacion.md`](./11-aplicacion-simplificacion.md)):
la discontinuación ya no existe, el contrato estaba en 6 entradas y las citas de abajo parten de
ahí. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `D/16`
la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y `$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, 2026-09-28, <punto>)`. Donde salió un mecanismo
entero (`T7` con el encendido, `R15`, `D16` con `G-R5`), la sección quedó reducida a una línea
tachada con lo que decía más la causa. Los números retirados (`T7`, `D16`, `G-R5`) **no se
reusan**: quedan como fila tachada. **No toqué** el espacio entre archivado y borrado (tanda 4),
los plazos configurables (C9), la migración de un plan retirado (C15) ni las notas N de cobro.

## 1. Qué se aplicó

### C4, `L2-e`, `L2-f1`, `L2-f2`, `L2-f3` · la cuota mensual por la fecha del ciclo

- El campo nuevo de la fuente, en la firma: `D/12:88` «desde:      instante | SIN_EMPEZAR»
- De siete a ocho campos, con qué trae cada tipo: `D/12:104` «Y de siete a ocho con `desde`»
- Su fila en el censo del §2.1, con su único lector: `D/12:130` «la ventana de la cuota mensual (`V/15` §7), que lo lee sólo al abrir una ventana nueva»
- El censo de emisores lo nombra: `D/12:838` «`desde` (revisión del owner, 2026-09-28, C4), `hasta`, `alcance`»
- Declarado en el §4 como instante que no es de cobro: `D/12:1006` «Y cruza un instante que no es de cobro: `desde`»
- La regla de vigilancia lo nombra: `D/12:1232` «ni en la fila `desde` (revisión del owner, 2026-09-28, C4)»
- La implementación de arranque lo devuelve: `D/12:1313` «Y devuelve `desde` en las dos fuentes que resuelve»
- La regla, en un § nuevo: `V/15:501` «## 7. La ventana de la cuota mensual · cierra la implicación 2 de `DEC-ENT-002`»
- La prueba gratis también renueva (`L2-f1`): `V/15:516` «La prueba gratis también renueva cada mes, desde el día en que arrancó»
- Del 29 al 31 (`L2-f2`), calculado siempre desde el ancla: `V/15:518` «Del 29 al 31, el último día de los meses cortos»
- El complemento (`L2-f3`): `V/15:522` «Un complemento que suma cuota suma a la del título que lo cubre y renueva el mismo día»
- El cambio de plan (`L2-e`): `V/15:525` «Al cambiar de plan, la ventana en curso sigue hasta su fin»
- Su NO cierra: `V/15:553` «fecha del ciclo de cada persona, §7.»
- La tabla nueva: `V/02:300` «| **`cuota_ventana`** ✚ |»
- `V/11` §4.3 corregido, contra la recomendación: `V/11:228` «La cuota de trial se renueva cada mes, desde el día en que arrancó la prueba»
- El peor caso de la §4.2 se multiplica: `V/11:209` «× meses que el techo de días permite»
- Su NO cierra: `V/11:463` «la del trial también es mensual, desde el día en que arrancó (§4.3, `L2-f1`)»
- `$V/spec.md:440` «por la fecha del ciclo de cada persona, también en anual y en la prueba gratis (`15` §7)»
- El huso: `nucleo/07:122` «Y el día del reset es el del ciclo de cada persona»
- Los espejos del recuento de campos: `$B/spec.md:179` «por fuente, y a ocho con `desde`»
- `$B/descomposicion.md:126` «con los ~~siete~~ ocho campos de la fuente»
- `$V/descomposicion.md:53` «ocho campos, con `piso` (9h) y `desde`»

### C14, `L1-c` · la pausa del dueño detiene la retención

- La pregunta nueva, en la firma: `D/12:1060` «retenciónDetenida(user, vertical) → sí | no»
- Qué contesta y quién la lee: `D/12:1076` «Sus únicos lectores son archivar (`PB4` y `PB5`), borrar (`PB9`) y los avisos de retención»
- La dirección de ida vuelve a tener una pregunta (corrige lo que escribió la tanda 1): `D/12:1069` «le pregunta una sola cosa, `retenciónDetenida`»
- El recuento: `D/12:1182` «Son siete entradas: seis preguntas y una operación»
- Su constructor: `D/12:1217` «y `retenciónDetenida` en `B4`, con la respuesta de arranque en V4»
- El §4, donde `DEC-TRIAL-008` cerraba la frontera: `D/12:1032` «Se abre, lo mínimo, por otro»
- La regla de vigilancia: `D/12:1234` «C14: la dirección de ida vuelve»
- La de arranque contesta `no`, y queda bajo `G13`: `D/12:1432` «y el `no` de `retenciónDetenida`»
- El núcleo, donde el reloj no se detenía: `nucleo/01:198` «La pausa pedida por el dueño detiene el reloj»
- `nucleo/01:829` «El tope de una pausa ya no está atado al borrado»
- `D16` retirado con su número: `nucleo/04:139` «la pausa pedida por el dueño detiene el reloj de retención, así que el tope de pausa ya no tiene que quedar por debajo del día del borrado»
- Sus tres párrafos, reducidos: `nucleo/04:144` «Salen con `D16`»
- `nucleo/04:293` «Recorrido otra vez el 2026-09-28, al retirar `D16`»
- `nucleo/00:98` «52 invariantes»
- `G-R5` retirado en los dos catálogos: `V/20:63` «retirado** (revisión del owner, 2026-09-28, C14, `L1-c`): la pausa pedida por el dueño detiene el reloj de retención (`12-contrato…` §4.1»
- `V/20:218` «Salen con `G-R5`»
- `B/20:365` «la cifra no se mueve y la composición sí»
- Los tres lectores releen: `V/03:481` «con `sí`, que es una pausa pedida por el dueño en esa vertical, no archiva»
- `V/03:486` «con `sí`, que es una pausa pedida por el dueño en esa vertical, no borra»
- `V/02:858` «Y durante una pausa pedida por el dueño el reloj»
- `V/03:1027` «El reloj se detiene durante la pausa pedida por el dueño y la ficha no se archiva»
- El aviso al pausar ya no promete archivado: `B/19:108` «mientras dure la pausa no se archiva, no se borra ni recibe avisos de retención»
- Billing, donde la pausa cruzaba el día 90: `B/03:1678` «Desde la revisión del owner la pausa pedida por el cliente detiene el reloj de retención»
- `B/03:1675` «Y el reloj de inactividad de verticales se detiene mientras dure la pausa»
- `B/03:810` «Verticales se entera sólo para no avanzar el»
- `B/09:608` «la pausa pedida por el»
- `B8` pierde `G-R5`: `$B/descomposicion.md:453` «la pausa pedida por el dueño detiene el reloj de retención y el guard se quedó sin sujeto»
- `V/descomposicion.md` §2.7, como historia: `$V/descomposicion.md:252` «`B8` ya no lo construye»

### C12, `L1-a`, `L1-b` · el corte con la ficha a la vista publicada y una prueba activa

- El encabezado del §2.4 y el resumen de la decisión: `V/21:82` «con su ficha a la vista publicada y una prueba gratis que arranca ese día»
- `L8` nace publicada, `L5` y `L7` en borrador: `V/21:221` «y su dueño recibe la prueba activa del corte en esa vertical»
- `V/21:223` «`L5` y `L7` nacen en borrador y no bajadas por billing»
- Varias fichas a la vista, no se diseña: `V/21:190` «Un dueño con más de una ficha a la vista en la misma vertical no se diseña»
- La escritura nueva, en un apartado propio: `V/21:369` «#### La prueba gratis que escribe el corte»
- Los dos gates nuevos: `V/21:397` «La lista de proveedores del seudónimo tiene que estar cerrada y medida antes del corte»
- `V/21:400` «El recuento de cuentas de la cartera que comparten seudónimo en la misma vertical»
- Las dos cuentas del owner, declaradas como en `01-impacto-producto.md`: `V/21:157` «Y desde C12 se declara así»
- El argumento contra sembrar, marcado como superado: `V/21:325` «el owner eligió exactamente la alternativa de este»
- El corte ya escribe una fila de verticales: `V/21:363` «Del lado de verticales el corte escribe una clase de fila nueva»
- Los NO cierra: `V/21:534` «el dueño del corte con una ficha a la vista amanece en»
- `V/21:545` «Varias fichas a la vista de un mismo dueño y vertical el día del corte: no se diseña»
- `R15` sale entera: `V/03:241` «La mitad de `R15` salió»
- `V/03:249` «Tres párrafos y dos citas explicaban la extensión de `R15`»
- La guarda de `T8`: `V/03:55` «la extensión `R15` salió»
- `PB3` y `PB7` no evalúan `T8` adentro: `V/03:480` «(sale con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`)»
- `PB1` pierde la cartera del corte: `V/03:478` «la cartera del corte ya no: nace con su ficha publicada y su prueba activa, o en `DRAFT`»
- `$V/spec.md:248` «la salvedad `R15` salió»
- `$V/spec.md:422` «las que estaban a la vista nacen `PUBLISHED`, como recién creadas»
- El corte, pasos 0, 2, 3 y 4c: `D/16:124` «Y desde C12 es condición del corte»
- `D/16:128` «Y el recuento de cuentas de la cartera que comparten seudónimo en la misma vertical tiene que dar cero»
- `D/16:130` «y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante»
- `D/16:135` «desde C12 ninguna nace `UNPUBLISHED_BY_BILLING`»
- El guion, puntos 1 y 2: `D/16:239` «sigue publicada, sin perder nada de lo cargado, y ese día»
- `D/16:243` «Cómo se queda: contratando antes»
- `D/16:212` «Las fichas que estaban a la vista nacen `PUBLISHED` y su dueño amanece con una prueba gratis»
- El núcleo admite la escritura por su lugar: `nucleo/01:69` «escribe una: la prueba activa de cada dueño con una ficha a la vista»
- El botón de suscribirse ya no alcanza al dueño con ficha a la vista: `V/19:66` «el dueño del corte que tenía una ficha a la vista no llega acá»

### C10, `L2-i`, `g3` · moderación en dos niveles

- `PB10` guarda de dónde venía: `V/03:487` «Y guarda de dónde venía»
- `PB11` con la guarda de origen, y ya no es la única salida: `V/03:488` «Ya no es la única salida de `MODERATED`»
- `PB13`, nueva: `V/03:490` «| **PB13** ✚ | `MODERATED` |»
- `PB12` desde `MODERATED`, con correo de confirmación (`g3`): `V/03:489` «Sobre una `MODERATED` la borra el dueño y no el admin»
- La máquina pasa a trece transiciones: `V/03:494` «seis estados y ~~doce~~ trece transiciones»
- El § nuevo: `V/03:645` «#### La moderación en dos niveles»
- Qué puede hacer el dueño sobre una moderada: `V/03:672` «verla, exportarla, editarla y borrarla; no publicarla»
- El par nuevo con dos destinos: `V/03:717` «comparten el par `(MODERATED, un admin levanta la baja)` con»
- Los ⚠️ que cierra: `V/03:732` «`PB12` sale de `MODERATED`, con»
- `V/03:748` «y al cambiar de nivel: cerrado»
- El lock: `V/03:844` «`PB11` y `PB13` lo toman»
- La marca, en el modelo: `V/02:410` «| **`pedido_de_arreglo`** ✚ |»
- La acción administrativa, que sigue siendo una: `nucleo/08:164` «Desde la revisión del owner, en dos niveles y cambiable en las dos direcciones»
- `nucleo/08:178` «pedir un arreglo, bajar, cambiar de nivel o levantar»
- Los avisos nuevos: `nucleo/07:240` «| **pedido de arreglo** ✚ |»
- `nucleo/07:241` «| **cambio de nivel de la moderación** ✚ |»
- `nucleo/07:242` «| **moderación levantada** ✚ |»
- `nucleo/07:243` «| **ficha moderada borrada por su dueño** ✚ |»
- Las superficies, filas 30 y 31 y el listado del panel: `V/19:73` «cuando un admin le pide un arreglo sin bajar la ficha»
- `V/19:74` «| 31 ✚ |»
- `V/19:83` «el listado de arreglos pendientes»
- La autorización, paso 4: `V/17:89` «Y una ficha `MODERATED` acepta de su dueño verla, exportarla, editarla y borrarla»
- La tabla de pares con dos destinos: `nucleo/03:93` «| `(MODERATED, un admin levanta la baja)` ✚ |»
- `V/20:253` «`T1`/`T6` y `PB11`/`PB13`»
- `$V/descomposicion.md:206` «`PB11`/`PB13` de la de publicación»
- `V/03:279` «el otro es `PB11`/`PB13`»
- `B/03:758` «entró otro en la otra épica, `PB11`/`PB13`»

### N6, `L1-d` · el domicilio del contrato

- El §7 deja de decir que es FASE 5: `D/12:1450` «El domicilio ya está decidido; el»
- El § nuevo: `D/12:1454` «### 7.1 Dónde vive: un package compartido, único punto de comunicación»
- Las cuatro cosas: `D/12:1456` «Toda comunicación entre verticales y billing pasa»
- El segundo juego de casos: `D/12:1397` «Y hay un segundo juego, el de la dirección inversa»
- La regla de vigilancia gana un guard, para una parte: `D/12:1286` «Desde la revisión del owner hay uno, y cubre una parte»
- `G14`: `V/20:54` «| **G14** ✚ | **una mitad importa a la otra**»
- `$V/spec.md:401` «| `G14` ✚ |»
- `V1` crea el package y `G14`: `$V/descomposicion.md:50` «y el package del contrato»
- Billing prueba contra el simulador: `$B/descomposicion.md:317` «Y desde la revisión del owner las dependencias que pasan por el contrato son de integración, no»
- El reparto de la tanda en unidades, § nuevo: `$V/descomposicion.md:456` «### 2.11 Lo que la revisión del owner agregó, y qué unidad lo construye»

### C7 · «entrar como», sólo la condición

- `nucleo/08:196` «el cliente queda para una versión posterior, y su condición se escribe hoy»
- `V/17:382` «se va a agregar en una»
- `V/17:641` «Su condición queda escrita hoy»
- `$V/spec.md:444` «va a agregar; su condición»

### N7 · los ítems del §12 que le tocan a verticales

- Baja de cuenta fuera de la épica (`g1`): `nucleo/08:85` «Queda fuera»
- `$V/spec.md:446` «La baja de cuenta pedida por el usuario»
- `D/12:974` «fuera de esta épica y hecho a mano por soporte con una lista»
- Las señales que sólo observan no se guardan (`g2`): `V/22:33` «Teléfono, identificador fiscal y dispositivo NO se guardan»
- El contenido de Partner vive en la tabla de hoy: `V/02:561` «Y el contenido de su presencia (la página y el carrusel) vive en la misma tabla de partners de hoy»
- `V/18:156` «el contenido de la presencia vive en la»
- Los avisos de retención releen el estado y la pausa: `nucleo/07:238` «Y releen además el estado de la ficha y la pausa»
- `V/03:766` «releen el estado de la ficha y la pausa, y no salen sobre»
- Se saca encender o apagar la prueba de una vertical; `T7` retirada con su número: `V/03:54` «encender o apagar la prueba de una vertical queda fuera de esta versión, y el panel no deja pasar»
- `V/11:380` «## 8. ~~El día que una vertical enciende su trial~~ Los días de prueba de una vertical no pasan de cero a más ni al revés»
- `V/03:358` «#### ~~La fila de los días en cero no es un estado final: `T7` la cierra el día del encendido~~»
- `V/18:94` «Salen con»
- `D/12:870` «Las siete**, en las dos implementaciones»
- `nucleo/01:459` «tres: `T1`, `T6` y `T8`»
- `nucleo/03:110` «y con él el primero de los casos: quedan nueve»

## 2. Conteos que cambiaron

Recontados con script sobre la tabla o el bloque, no restados.

| qué | antes | ahora | espejos corregidos |
|---|---|---|---|
| campos por fuente (`D/12` §2) | 7 | 8 (`desde`) | `D/12` (nota del §2), `$B/spec.md`, `$B/descomposicion.md` (`B4`), `$V/descomposicion.md` (`V4`) |
| entradas del contrato §4.1 | 6 (5 + 1) | 7 (6 + 1) | `D/12` (recuento y constructores: «las otras cinco») |
| campos en consultas | 11 en 3 | 11 en 3 | sin cambio: `retenciónDetenida` es un sí o no, como `fichaPurgada` |
| invariantes del §3 | 16 | 15 (`D16` retirado, con número) | `nucleo/04` (tabla, §5, recorrido), `nucleo/00` |
| total de invariantes | 53 | 52 | `nucleo/04`, `nucleo/00` |
| apoyos de guard del §3 | 6 | 5; apoyos totales 20 → 19 | `nucleo/04` |
| filas de `V/20` §2 | 21 | 21 (sale `G-R5`, entra `G14`) | `B/20` (tabla de recuento), `$V/spec.md` (índice y §5, que decía «veinte» sin `G-R9`) |
| filas de `B/20` §2 | 15 | 14 | `B/20`, `$B/spec.md` |
| referencias cruzadas | 4 | 3 | `B/20`, `$V/spec.md`, `$B/spec.md` |
| guards distintos y con unidad | 32 | 32 | `B/20` |
| guards por épica | 19 verticales · 13 billing | 20 · 12 | `$V/descomposicion.md` §4, `$B/descomposicion.md` §4 |
| guards con id propio de verticales | 8 | 9 (`G14`) | `$V/spec.md` §5 |
| transiciones vivas de la máquina de trial | 8 | 7 (`T7` retirada, con número) | `$V/descomposicion.md` (`V4`, dos lugares), `D/12` §3 |
| salidas de `PRE_TRIAL` | 4 | 3 | `nucleo/01`, `V/02`, `V/18` (tres) |
| transiciones de la máquina de publicación | 12 | 13 (`PB13`) | `V/03` |
| pares `(desde, evento)` con dos destinos | 3 | 4 (`PB11`/`PB13`) | `nucleo/03` (tabla y texto), `V/03` (dos), `V/20`, `$V/descomposicion.md`, `B/03` (cuatro) |
| casos de *«compartir el `desde` no es compartir el par»* | 10 | 9 (sale `T7`) | `nucleo/03` (dos) |
| filas de `V/19` §4 | 29 | 31 | sin espejo con cifra |

**Lo que no se movió**: las quince acciones administrativas (moderar sigue siendo una, con más
escrituras); los cinco hechos del reloj (la pausa no es un hecho: los lectores preguntan); las once
dependencias entre épicas (el simulador cambia qué se prueba antes, no el grafo); los 24 motivos;
las filas de la matriz.

## 3. Para el log y la matriz (pide OK del owner)

Todos los IDs grepeados en `01-decision-log.md`; `DEC-MIG-006`, `DEC-DATA-006` y `DEC-DATA-007` no
existen (los últimos de cada prefijo son `DEC-MIG-005` y `DEC-DATA-005`).

1. **`DEC-MIG-006` nueva (C12, `L1-a`, `L1-b`)**. Texto: *«El día del corte, las fichas que
   estaban a la vista (`L8`) nacen `PUBLISHED`, como recién creadas, y la migración estructural le
   escribe a cada `(dueño, vertical)` con una de ellas una fila de `trial` en `TRIAL_ACTIVE` que
   arranca en el instante del corte, con el seudónimo de la función de `T1` y la campaña previa.
   Las que el sistema viejo tenía bajadas por falta de pago (`L5`, `L7`) nacen en `DRAFT`, y cae
   entera la regla `R15`. Gates del corte: la lista de proveedores del seudónimo cerrada y medida
   antes del corte, y el recuento de cuentas de la cartera que comparten seudónimo en la misma
   vertical en cero. Un dueño con más de una ficha a la vista no se diseña: hoy no hay ninguno. Las
   dos cuentas del owner reciben la prueba y el grant del 3b; `T2` la consume. SUPERSEDE a `G1-1`
   (R1, FASE 9 vuelta 1) en lo que decía de la cartera, y precisa `DEC-MIG-005` punto 3: el corte
   sigue sin sembrar trials consumidos y siembra uno activo.»* **Razón**: `G1-1` no tiene `DEC`
   propio, así que el SUPERSEDED se escribe acá.
2. **📌 en `DEC-MIG-005` punto 3**: *«Precisado por `DEC-MIG-006` (revisión del owner, C12): no se
   siembran trials consumidos; se siembra uno activo a cada dueño con una ficha a la vista.»*
3. **`DEC-DATA-006` nueva (C14, `L1-c`)**. Texto: *«La pausa pedida por el dueño detiene el reloj
   de retención de sus fichas en esa vertical: mientras dure no se archivan, no se borran y no
   reciben avisos de retención; al volver, el reloj se reinicia (hecho 2). Cruza como una pregunta
   de ida del contrato, `retenciónDetenida(user, vertical)`, que contesta billing (sí sólo con una
   `PAUSED` por `CUSTOMER_REQUEST`) y que leen SÓLO `PB4`, `PB5`, `PB9` y los avisos de retención,
   al ejecutar. No va en `fuentes` ni en `cubierto`. Salen `D16` y `G-R5`. SUPERSEDE a
   `DEC-DATA-002` en lo que decía de que el reloj corre durante la pausa y en la desigualdad que
   la protegía.»*
4. **📌 en `DEC-TRIAL-008`**: *«La frontera se abrió lo mínimo por otro caso (`DEC-DATA-006`): la
   pausa del dueño cruza como `retenciónDetenida`, con lectores cerrados de retención. La máquina
   de trial no la lee, y lo que esta decisión protegía queda intacto.»*
5. **`DEC-DATA-007` nueva (C10, `L2-i`, `g3`)**. Texto: *«Moderación en dos niveles, a elección
   del admin y cambiable en las dos direcciones: pedir un arreglo sin bajar la ficha (una marca,
   `pedido_de_arreglo`, no un estado) o bajarla (`MODERATED`). Al levantar la baja, o al pasarla a
   sólo pedido, la ficha vuelve a donde estaba: `DRAFT` si era borrador (`PB11`), y si estaba
   publicada o bajada por billing, `UNPUBLISHED_BY_BILLING` con `PB3` en el mismo acto (`PB13`).
   Sobre una `MODERATED` el dueño puede verla, exportarla, editarla y borrarla (`PB12`, con correo
   de confirmación), no publicarla. Avisos al pedir, al cambiar de nivel y al levantar; listado de
   arreglos pendientes en el panel. Sigue siendo una acción administrativa con un permiso.»*
   **Razón**: supera en parte lo que `F-8CA2-004` (FASE 8 completa) creó como `PB10`/`PB11`, que
   no tiene `DEC` propio.
6. **📌 en `DEC-ENT-002` implicación 2**: *«Cerrada (revisión del owner, C4): la cuota corre por la
   fecha del ciclo de cada persona, el día del `desde` del título, también en anual; del 29 al 31,
   el último día de los meses cortos, calculado desde el ancla; al cambiar de plan la ventana en
   curso sigue con el cupo del plan nuevo menos lo gastado y la fecha nueva rige desde la
   siguiente; un complemento suma a la ventana del título. `V/15` §7.»*
7. **📌 en `DEC-ENT-001`**: *«La cuota de trial también se renueva cada mes, desde el día en que
   arrancó la prueba (revisión del owner, `L2-f1`, contra la recomendación). `V/11` §4.3.»*
8. **📌 en `DEC-ARCH-006`**, que **reemplaza el 📌 2 propuesto por la tanda 1** (*«la dirección de
   ida vuelve a no tener preguntas»*, que dejó de ser cierto con C14): *«El contrato vive en un
   package compartido del monorepo, único punto de comunicación entre las épicas, con las dos
   interfaces, sus validaciones, los simuladores de cada lado y los dos juegos de casos; `G14`
   prohíbe que una mitad importe a la otra; el nombre es FASE 5 (N6, `L1-d`). La fuente gana
   `desde` (C4) y la dirección de ida tiene una pregunta, `retenciónDetenida` (C14).»*
9. **📌 en `DEC-TRIAL-003`** (y **`DEC-TRIAL-006`**, que difiere el evento de Partner): *«Encender o
   apagar la prueba de una vertical queda fuera de esta versión: el panel no deja pasar los días
   de prueba de 0 a más de 0 ni al revés, y `T7` salió (revisión del owner, N7). Partner queda en
   cero.»*
10. **📌 en `DEC-TRIAL-004` implicación 2**: *«Teléfono, identificador fiscal y dispositivo no se
    guardan; la consulta legal queda sólo por el seudónimo (revisión del owner, N7, `g2`;
    seguimiento HOS-1394).»*
11. **📌 en `DEC-DATA-005`**: *«La baja de cuenta pedida por el usuario queda fuera de esta épica:
    soporte a mano con una lista de pasos, y se corrige la FAQ (revisión del owner, N7, `g1`;
    HOS-1393).»*
12. **📌 en `DEC-AUTH-003`**: *«"Entrar como" el cliente se agrega en una versión posterior, con la
    condición de que se registre como hecho por el admin en nombre del cliente; cuando se diseñe,
    se reabre el "ni las que se agreguen" de `NUCLEO/08` §3 (revisión del owner, C7).»*
13. **Las decisiones de informes que caducan** (históricos, no los edito): `G1-1` y R1 (FASE 9
    vuelta 1) en lo que decían de la cartera; `R15` (FASE 9 vuelta 2) entera; `N-B-01` (su arreglo
    era dentro de `R15`); `G2-4` (el ⚠️ de `T7`); `F-8CA2-012` en lo que pedía del encendido de
    Partner. Propongo la misma nota de caducidad al pie que la tanda 1 propuso para las `V2-*`.
14. **Matriz**: nada. Ninguna fila mide lo que esta tanda tocó.

## 4. Casos vecinos (piden decisión, no los decidí)

1. **Qué `desde` ancla con más de un título vivo** (una prueba y una suscripción en los minutos
   antes de `T2`, o una cortesía sobre una suscripción). `V/15` §7 dice *«el `desde` del título que
   da la cuota»* y no elige entre dos.
2. **El `desde` del `BASE` es el alta de la cuenta**: lo escribí así en el contrato por la regla del
   owner (*«si la fuente no es suscripción, cuenta el día que arrancó»*). Hoy la versión de piso no
   otorga ningún entitlement medido, así que no ancla nada; si algún día lo otorga, conviene
   confirmarlo.
3. **Una pausa que termina sin volver.** El owner dijo *«al volver se reinicia»*. Si desde `PAUSED`
   la persona se da de baja (`S22`), `retenciónDetenida` pasa a `no` y el reloj sigue desde el
   hecho 5 del primer día de la pausa: `PB4` y `PB9` pueden correr al día siguiente sobre fichas
   con más de 180 días. Lo mismo si la pausa vence y la reanudación no se aplica: el reloj queda
   detenido sin fin (el cliente sin servicio y sin borrado). ¿El fin de la pausa, por cualquier
   camino, reinicia el reloj?
4. **Una ficha moderada desde `ARCHIVED`.** L2-i nombra *«publicada»* y *«borrador»*. Escribí que
   cuenta por el origen de su archivado (un archivado de `PB4` vuelve por `PB13`; uno de `PB5`, por
   `PB11`). La lectura literal, *«vuelve a donde estaba»*, sería volver a `ARCHIVED`, que es un
   tercer destino y una fila más.
5. **Si los dos niveles valen para la presencia de Partner**, que tiene su bit de moderación. Lo
   apliqué sólo a fichas.
6. **El correo de confirmación del borrado**: `g3` lo pide sobre una ficha moderada. ¿Sale en todo
   `PB12`? El ⚠️ de `V/03` §9 lo sigue dejando abierto para las demás.
7. **El paso 4c puede quedar sin sujeto.** Con la `L8` publicada, le quedan las `PURGED` y las
   `L5`/`L7` en borrador sólo si el sistema viejo las servía; no está medido si alguna aparecía en
   un listado o en la página de un destino (las 22 purgas).
8. **Cómo se nota un dueño con más de una ficha a la vista** (`L1-a`). No lo convertí en gate; lo
   natural es contarlo en la re-verificación del paso 0. ¿Gate o sólo recuento?
9. **La lista de pasos de la baja manual** (`g1`): no escribí los pasos. El orden importa (una
   cuenta que se borra con una autorización viva sigue cobrando, y una ficha que se borra sin
   `PB12` no apaga su destaque hasta el barrido).
10. **Quién construye el rechazo del panel** a pasar los días de prueba de 0 a más de 0: es de la
    unidad que construya la edición de plazos del panel (C9, tanda 4).
11. **Un guard para `retenciónDetenida`**: el informe de impacto proponía *«todo lector de
    `inactiva_desde` que decide archivar, borrar o avisar consulta `retenciónDetenida`»* (sería una
    mitad nueva de `G-R6-B`). La decisión no lo pide; no lo agregué.
12. **La prueba del corte en una vertical con días en cero**: hoy no hay fichas fuera de
    Alojamiento y el panel no deja apagarla, así que no tiene población; lo dejé dicho en el NO
    cierra de `V/21`.

## Key Learnings

1. Una decisión que abre la frontera (C14) invalida en silencio lo que otra tanda acababa de
   escribir (*«verticales no le pregunta nada a billing»*, tanda 1): conviene releer lo recién
   aplicado antes de proponer 📌 sobre la misma decisión.
2. *«Vuelve a donde estaba»* no cabe en una sola fila de máquina: separa por origen y agrega un
   par con dos destinos, y eso mueve un conteo que vive en seis lugares.
3. Sacar una regla (`R15`) exigía primero verificar su condición de caducidad (ninguna ficha del
   corte nace `UNPUBLISHED_BY_BILLING` bajo un dueño en `PRE_TRIAL`), que sólo se cumple con `L1-b`.
4. Un guard retirado y uno nuevo pueden dejar el total igual y la composición distinta: el recuento
   tiene que decirlo, o el número estable esconde el cambio.
