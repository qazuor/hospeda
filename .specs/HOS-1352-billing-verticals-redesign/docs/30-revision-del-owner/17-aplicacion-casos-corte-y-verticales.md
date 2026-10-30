---
title: "Revisión del owner · casos vecinos 1 a 19: el corte y su proceso, y verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · casos vecinos 1 a 19: el corte y su proceso, y verticales

Los lotes A (casos 1 a 9) y B (casos 10 a 19) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), con el detalle original de
[`14-aplicacion-transversal-y-lote.md`](./14-aplicacion-transversal-y-lote.md) §3 y de los §
Casos vecinos de [`11-`](./11-aplicacion-simplificacion.md) y
[`12-`](./12-aplicacion-verticales-y-contrato.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `619c045c0c`, sin commits. Es la primera
tanda de casos: no había registros de casos anteriores que leer. No toqué los casos 20 a 50.
Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `D/16` la
FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y `$B/` la raíz de cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso N)`. En el texto
nuevo no escribí la palabra: el tipo de partner nuevo es `business`, y el valor viejo se nombra
como *«el valor del enum de hoy»*.

## 1. Qué se aplicó

### Caso 1 · el correo de baja del sistema viejo

Elección 1: el código viejo no se toca y el owner lo anticipa. Lo declaré como la única excepción a
*«el sistema no manda ningún aviso del corte»*, en los dos lugares que lo decían:

- `D/16:223` «salvo el correo de baja que el viejo manda al recibir cada cancelación del 1b»
- La remisión que dejaba el choque al owner, tachada:
  `D/16:278` «decidido: el código viejo no se toca y el correo sale, como la única excepción declarada»

### Caso 2 · no queda constancia del aviso (contra la recomendación)

No se registra a quién avisó el owner, ni por el sistema ni a mano. Nada en el diseño pedía
anotarlo (la lista del script dice *«a quién avisa»*, no *«a quién se avisó»*); lo dejé escrito, y
la consecuencia en los dos «NO cierra»:

- `D/16:271` «Y tampoco se registra a mano»
- `D/16:274` «si un cliente reclama después que no le avisaron de la pérdida del punto 3, no hay registro que lo muestre»
- `B/21:475` «Y no queda constancia de que el aviso se dio»
- `B/21:479` «consecuencia aceptada por el owner»

### Caso 3 · el script del corte, en `scripts/cutover/`

- `D/16:300` «Vive versionado en el repositorio, en `scripts/cutover/`, y archivarlo es borrarlo en un commit posterior al corte»
- `D/16:447` «Está versionado en `scripts/cutover/`»

### Caso 4 · `rollout`, cerrado

Cerrado en lo que hace a ramas (§4.4) y con el orden de despliegue en el §4.2. Queda pendiente sólo
`acceptance gates`:

- `D/16:20` «De su contenido hay cinco ítems resueltos»
- `D/16:26` «Sigue pendiente `acceptance gates`»
- `D/16:45` «Cerrado: las ramas son el §4.4 y el orden de despliegue es el §4.2»
- `D/16:451` «Con esto `rollout` queda cerrado en lo que hace a ramas»
- `D/16:480` «Uno de los seis ítems huérfanos, `acceptance gates`»

### Casos 5 y 6 · dos recuentos en el paso 0

- `D/16:128` «Y se toman dos recuentos sobre la cartera vieja»
- El 4c, que se saltea si da cero: `D/16:128` «si da cero, el paso 4c no tiene sujeto y se saltea»
- `D/16:139` «se mide en el paso 0, y si da cero el paso se saltea»
- `V/21:189` «Si hay alguna se mide en el paso 0, y si da cero el 4c se saltea»
- `$V/descomposicion.md:407` «se mide en el paso 0 y, si da cero, el paso se saltea»
- El dueño con varias fichas a la vista, sin gate:
  `D/16:128` «cuántos dueños tienen más de una ficha a la vista (`L8`) en la misma vertical»
- `V/21:194` «Cómo aparece: un recuento en el paso 0 del corte, que no es gate»
- `V/21:565` «Detector: el recuento del paso 0 del corte, que no es gate»

### Caso 7 · la lista de pasos de la baja de cuenta manual

Escrita en `NUCLEO/08` §1.3, donde vive `g1`, con el orden y la razón de cada paso, y con sus
espejos en la sub-spec de verticales:

- `nucleo/08:93` «La lista de pasos se escribe antes del corte, y el orden es parte de ella»
- `nucleo/08:97` «La baja del cobro»
- `nucleo/08:101` «por cada ficha»
- `nucleo/08:104` «La cuenta, al final»
- `$V/spec.md:450` «La lista se escribe antes del corte, en este orden»
- `$V/descomposicion.md:478` «con su lista de pasos escrita antes del corte»

### Caso 8 · la lista de pendientes de `G8`

Dos entradas cerradas: `packages/db/src/migrations/**` y `packages/seed/src/data-migrations/**`
(lo que el ledger del seed anota). La construye `V1`, dueña de `G8`:

- `V/20:53` «mientras tanto el guard lleva una lista de pendientes cerrada, con dos entradas y ninguna más»
- `V/20:53` «un build destinado a producción después del corte falla si no está vacía»
- `$V/spec.md:400` «y hasta el corte con una lista de pendientes cerrada, las dos historias»
- El criterio de `V1`: `$V/descomposicion.md:556` «agregar una tercera entrada a la lista falla»
- El invariante 32: `nucleo/04:75` «que hasta el paso 6 lleva esas dos historias en una lista de pendientes cerrada»
- El paso 6: `D/16:142` «y en el mismo commit se vacía la lista de pendientes de `G8`»

### Caso 9 · las 11 migraciones de datos del seed, congeladas

- `B/21:443` «Hasta entonces se congelan con sus valores adentro»
- `$B/descomposicion.md:634` «congeladas con sus valores adentro en el mismo cambio que borra el archivo»
- `D/16:142` «Y salen las 11 migraciones de datos del seed que importaban el archivo de configuración de planes»

### Casos 10 y 11 · el ancla de la cuota

- `V/15:517` «Con más de un título vivo, ancla el que da la cuota; si dos la dan, el que arrancó primero»
- `$V/descomposicion.md:470` «con dos títulos vivos que dan cuota, ancla el que arrancó primero»
- `D/12:110` «queda escrito así, y se confirma el día que la versión de piso otorgue un entitlement medido»
- `V/15:519` «El `BASE` ancla en el alta de la cuenta»

### Caso 12 · todo fin de la pausa reinicia el reloj

La regla, en sus cinco lugares. **El mecanismo no**: cuando la pausa termina sin volver a cubrir
(una baja desde la pausa), ningún hecho de la lista escribe el reinicio, y cómo se escribe es una
elección de diseño que no hice (§3, punto 1):

- `D/12:1090` «Y todo fin de la pausa, por cualquier camino, reinicia el reloj»
- `nucleo/01:207` «Y todo fin de la pausa, por cualquier camino, reinicia el reloj»
- `V/02:863` «y todo fin de la pausa, por cualquier camino, lo reinicia también»
- `V/03:1042` «pausa termina por otro camino, en una baja, el reloj se reinicia igual»
- `$V/descomposicion.md:471` «y también si la pausa termina en una baja»

### Casos 13 y 14 · la moderación desde `ARCHIVED`, y sólo fichas

- `V/03:489` «una moderada desde `ARCHIVED` vuelve por el origen de su archivado, no a `ARCHIVED`»
- `V/03:650` «Vale sólo para fichas»
- `V/18:125` «Y no tiene los dos niveles de la moderación de fichas»

### Caso 15 · el correo de confirmación en todo `PB12`

El nombre del correo pierde *«moderada»* (tachado, no renombrado aparte: la fila del catálogo no
cambia de número). Lo que sigue abierto del ⚠️ de `V/03` §9 es la fila de Mi Cuenta:

- `nucleo/07:250` «cualquier ficha, desde cualquier estado de salida de `PB12`»
- `V/03:490` «que sale en todo `PB12`, desde cualquiera de sus estados de salida»
- `V/03:758` «El correo, cerrado»
- `$V/descomposicion.md:472` «borrar cualquier ficha por `PB12` encola el correo de confirmación»

### Caso 16 · la mitad *(d)* de `G-R6-B`

- `V/20:67` «(d) Lectores de retención sin la pausa»
- `V/20:67` «TRES mitades de la lista cerrada»
- `B/20:60` «y, con un cuarto predicado, un lector que decide archivar, borrar o avisar y no consulta `retenciónDetenida`»
- `B/20:305` «tres mitades, con»
- `$V/descomposicion.md:117` «o uno de los que deciden archivar, borrar o avisar que no consulta»

### Caso 17 · sin prueba automática; el owner prueba en `staging`

- `V/21:573` «Sin prueba automática»
- `V/21:575` «el owner lo prueba a mano en `staging`, con fichas de prueba en una vertical con días en cero»

### Caso 18 · no se renumera

Sin cambio de texto: el diseño ya lo dice.

- `nucleo/01:54` «El número 4 queda vacío y los demás conservan el suyo»

### Caso 19 · el tipo de partner pasa a `business`

Medido en hospeda2 el 2026-09-29: el enum tiene tres valores, el viejo, `ngo` e `institution`, y la
etiqueta en español del viejo es «Comercio» (`packages/i18n/src/locales/es/partners.json:3`).

- `V/21:524` «a `business`»
- `V/21:527` «y la migración de datos de `V1` reescribe a `business` todo partner que tenga el valor viejo»
- `V/21:528` «la etiqueta en español sigue siendo «Comercio», sin cambios»
- `$V/descomposicion.md:480` «a `business`, con la etiqueta «Comercio» en español sin cambios»
- `$V/descomposicion.md:480` «y todos los que lo tenían quedan en `business`»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| ítems resueltos de la FASE 7 del paraguas | 4 | 5 (entra `rollout`) | `rg -n "rollout" D/16` sobre el diseño vigente: sólo `D/16` lo nombra como ítem | `D/16` (encabezado, tabla del §1, §5) |
| ítems huérfanos pendientes | 2 | 1 (`acceptance gates`) | ídem | `D/16` (encabezado, §5) |
| mitades de `G-R6-B` | 2 | 3 | leídas en la fila de `V/20` §2 | `V/20`, `B/20` (fila y párrafo) |
| predicados de `G-R6-B` | 3 | 4 | ídem | `B/20` (fila y párrafo), `$V/descomposicion.md` §2.5 |
| entradas de la lista de pendientes de `G8` | no existía | 2, cerrada | por construcción | `V/20`, `$V/spec.md`, `$V/descomposicion.md`, `nucleo/04`, `D/16` |
| decisiones precisadas sin `SUPERSEDED`, si el owner aprueba el §4 | 58 | 63 | `contar-precisadas.py` sobre una copia del log con las nueve líneas de *Estado* simuladas | sólo el log, si el owner lo aprueba |

**Lo que no se movió**: los 33 guards (18 · 15: la mitad nueva es de un guard que ya existía); las
21 acciones administrativas; las 33 transiciones vivas de la Suscripción; los cinco hechos del
reloj; las siete entradas del contrato y sus once campos en tres consultas (`retenciónDetenida`
sigue siendo un sí o no); las once dependencias entre épicas; las 111 filas de la matriz; el
catálogo de correos de `NUCLEO/07` §6 (el de `PB12` cambia de alcance, no de fila); los 17 pasos
del corte.

## 3. Casos vecinos (piden decisión, no los decidí)

1. **Cómo se escribe el reinicio del caso 12 cuando la pausa termina sin volver a cubrir** (una
   baja desde `PAUSED`, `S22`). Con la reanudación lo escribe el hecho 2, pero si la cobertura no
   vuelve ningún hecho de la lista escribe nada, y `G-R6-B` *(a)* rechaza cualquier otra
   escritura. Dos formas: **(a)** un hecho nuevo, el 7, *«termina la pausa pedida por el dueño»*.
   Mueve la lista de hechos de cinco a seis y sus espejos, y hay que detectar un cambio, que es lo
   que el §3 del contrato evita. **(b)** `retenciónDetenida` contesta también el instante en que
   terminó la última pausa, y sus lectores cuentan desde el más tardío entre `inactiva_desde` y
   ese instante: la pausa sigue sin escribir nada en verticales y `G-R6-B` no cambia, pero la
   respuesta deja de ser un sí o no y se mueven los campos del contrato. Recomiendo **(b)**,
   porque los que actúan ya preguntan al ejecutar. **Y un pedazo de `T2-3` no lo cubre la
   elección**: una pausa que vence y cuya reanudación no se aplica deja la fila en `PAUSED`, así
   que no termina, y el reloj queda detenido sin fin.
2. **Cómo distingue `G8` el build del paso 3 de uno posterior al corte.** El despliegue del paso 3
   es un build destinado a producción con la lista todavía llena, y el paso 6 la vacía después.
   Recomiendo que la regla se active con el commit del paso 6: ese commit borra la lista, y desde
   ahí `G8` falla si vuelve a aparecer. La otra forma es exceptuar por nombre el build del corte.
3. **Quién ejecuta los pasos de la baja de cuenta manual** (caso 7). `PB12` es *«el dueño la
   borra»*, y soporte no tiene acción administrativa que borre una ficha ajena ni que dé de baja
   la suscripción de otro (la tabla de acciones está cerrada en 21). Tres formas: que el usuario
   haga los pasos 1 y 2 antes de pedir la baja, y soporte haga sólo el 3; una acción
   administrativa nueva, que mueve el conteo; o escribir en la base a mano, que saltea el lock y el
   correo de `PB12`. Recomiendo la primera, que no agrega nada al sistema.
4. **El script del corte y `G8`** (caso 3). Versionado en `scripts/cutover/`, el script queda bajo
   `G8`, y lee la base vieja: el recuento de Gastronomía y Experiencia del 1a y los checkouts del
   viejo pueden necesitar nombrar el dominio viejo de las suscripciones. Recomiendo que arme ese
   valor sin escribir la palabra, como el propio guard, y no sumarlo a la lista de pendientes, que
   el caso 8 cerró en dos.

## 4. Para el log y la matriz (pide OK del owner)

Cada ID grepeado en `01-decision-log.md` el 2026-09-29: existen todos. Ninguno tiene un 📌 de los
casos vecinos. Cada uno suma a su *Estado*: *«y precisada el 2026-09-29, con OK del owner
(revisión del owner, casos vecinos, <casos>; ver su 📌)»*. **Los cinco primeros tienen hoy el
*Estado* en `ACCEPTED` a secas**, así que la cifra de precisadas pasa de 58 a 63 (§2). La matriz:
nada; ningún caso de este tramo mide algo del proveedor.

1. **`DEC-MIG-006`** (casos 5 y 6): *«En el paso 0 se toman dos recuentos sobre la cartera vieja:
   si el sistema viejo servía alguna ficha que el corte hace nacer `PURGED` o en `DRAFT`, y si da
   cero el paso 4c se saltea; y cuántos dueños tienen más de una ficha a la vista en la misma
   vertical, que no es gate y vuelve al owner si da más de cero.»*
2. **`DEC-DATA-006`** (caso 12): *«Todo fin de la pausa, por cualquier camino, reinicia el reloj,
   también una baja desde la pausa. Cómo se escribe ese reinicio cuando la cobertura no vuelve
   está pendiente.»* **Razón**: la decisión dice *«al volver»*, y la baja desde la pausa dejaba
   correr `PB4` y `PB9` al día siguiente.
3. **`DEC-DATA-007`** (casos 13, 14 y 15): *«Una ficha moderada desde `ARCHIVED` vuelve por el
   origen de su archivado. Los dos niveles valen sólo para fichas: la presencia de Partner conserva
   su bit sin niveles. Y el correo de confirmación del borrado sale en todo `PB12`, no sólo sobre
   una moderada.»*
4. **`DEC-ARCH-012`** (casos 8, 9 y 19): *«El tipo de partner se renombra a `business`, con la
   etiqueta "Comercio" en español sin cambios, y la migración de datos de V1 reescribe los que
   tienen el valor viejo. Hasta el paso 6 del corte `G8` lleva una lista de pendientes cerrada,
   las dos historias; el paso 6 la vacía, y un build destinado a producción después del corte
   falla si no está vacía. Las 11 migraciones de datos del seed que importaban el archivo de
   configuración de planes se congelan con sus valores adentro hasta que el paso 6 las saca.»*
   **Razón**: reemplaza *«con un nombre a definir con el owner»*.
5. **`DEC-ARCH-013`** (caso 9): *«Las 11 migraciones de datos del seed que importaban el archivo
   borrado se congelan con sus valores adentro, en el mismo cambio que lo borra, y salen en el
   paso 6 del corte.»*
6. **`DEC-DATA-005`** (caso 7): *«La lista de pasos de la baja de cuenta manual se escribe antes
   del corte, en este orden: la baja del cobro, `PB12` por cada ficha y la cuenta (`NUCLEO/08`
   §1.3).»*
7. **`DEC-ENT-002`** (casos 10 y 11): *«Con más de un título vivo ancla el que da la cuota; con
   dos, el que arrancó primero. El `BASE` ancla en el alta de la cuenta, y se confirma el día que
   la versión de piso otorgue un entitlement medido.»*
8. **`DEC-TEST-001`** (caso 16): *«`G-R6-B` suma una tercera mitad: un lector de
   `listing.inactiva_desde` que decide archivar, borrar o avisar y no consulta
   `retenciónDetenida`. El catálogo sigue en 33 guards.»*
9. **`DEC-ARCH-007`** (casos 3 y 4): *«`rollout` queda cerrado: las ramas son el §4.4 de la FASE 7
   del paraguas y el orden de despliegue el §4.2. El script del corte vive versionado en
   `scripts/cutover/` y se borra en un commit posterior al corte.»*

**Sin propuesta**: los casos 1, 2 y 17 no tocan ninguna decisión del log (el correo de baja y el
aviso en persona viven en `D/16`, y `G1-4` no tiene `DEC` propio); el 18 no cambia nada.

## Key Learnings

1. Una regla decidida sin su mecanismo (*«todo fin de pausa reinicia»*) choca con una lista cerrada
   de escritores: aplicarla sin preguntar cómo se escribe habría metido un escritor que `G-R6-B`
   rechaza.
2. *«Falla después del corte»* necesita saber cuándo es después: el mismo despliegue del corte es
   un build de producción con la lista llena.
3. Versionar una herramienta en el repositorio la pone bajo los guards del repositorio, aunque no
   se despliegue.
