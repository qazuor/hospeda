---
title: "FASE 8 vuelta 3 · atribución de la crítica y de las ALTA contra los diffs"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 — ¿lo generó la tanda posterior a la vuelta 2?

Este documento aplica la **cláusula 1 de `DEC-METH-013`**, como la pide `DEC-METH-016`: la atribución
se dictamina contra los diffs y no contra los mensajes de commit. Atribuye la única `CRITICA` de
`00-hallazgos.md` (`F-8V3A1-001`, en R1) y **las 26 ALTA restantes**, racimo por racimo. Son los 15
racimos con al menos una ALTA: R1 a R8 y R13 a R19. Se atribuyen todas, y no sólo la que encabeza
cada racimo, porque en casi todos los racimos las ALTA salen de textos distintos.

Hay tres veredictos:

- **GENERADO**: el texto que abre el camino, o el que lo vuelve contradictorio, entró en el rango.
- **PREEXISTENTE**: el defecto ya estaba en `377a7c568b`, y la tanda no lo tocó o lo tocó sin
  crearlo.
- **AGRAVADO**: ya existía, pero un hunk del rango lo hizo más probable o más caro.

> **Lo que este documento NO hace.** No propone arreglos, no cambia severidades y no decide
> destinos. Dice de dónde salió el texto y, cuando salió de la tanda, qué elección del owner
> aplicaba ese hunk.

Rutas: `$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`,
`$B` = `.specs/HOS-1354-billing-cobro-y-proveedor`, `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`.
`B/NN` es `$B/docs/NN-…`, `V/NN` es `$V/docs/NN-…`, `D/NN` es `$D/NN-…` y `nucleo/NN` es
`$D/nucleo/NN-…`. Las líneas `archivo:línea` son las de `HEAD` (`923b23586b`). Las de la base se
escriben *«`377a7c568b`, l. N»* y su texto va en bloques de código, fuera del script de citas.

---

## 1. El rango, medido

`git log --format='%h %ad %s' --date=short 377a7c568b..923b23586b -- .specs/` da **51 commits**. La
columna de capítulos cuenta los archivos que toca cada commit, sin las carpetas de informes
(`29-`, `30-`, `37-` y las demás `NN-…/`), el handoff, el worklog, el log de decisiones y la matriz
(que van aparte):

| tramo | commits con capítulos (archivos) | commits sin capítulos |
|---|---|---|
| **revisión del owner** (28/09) | **`a6db40430e`** (30: tanda 1, C2 y C8), **`91416e9a9a`** (27: tanda 2, C12, C14, N7), `f08bb14b28` (19: tanda 3, cobro), **`37c41d6e8e`** (21: tanda 4, C3, C9, `L2-a`), `a816654987` (5, con log y matriz) | `eb7427ba92`, `b513281e6b` |
| **76 casos vecinos** (29/09) | `e4ce09585f` (17), `e1004e7922` (17), `42a9e7baee` (21), `f1fbabaf8f` (22), `1b04e28ea9` (15), `e6b4378b09` (7), `a9910cd40f` (9), `cdc32fb830` (4, con log y matriz), `ae441bd196` (1) | `e2cb3adc4a`, `619c045c0c`, `3c62156670`, `0343ab8a88`, `02562d9681`, `f6f074963d`, `7d74ea3fda`, `abafb960f0`, `c51a642cd5` |
| **mediciones del 29/09** | `be09b5173d` (4, con la matriz), `e4bcc1d48d` (14), **`262adc4638`** (12, con log y matriz, lote L) | `4a780ac3a1`, `dd970399d4`, `66f27781c3`, `03373b7125` (sólo `mp-probes/`), `be920e4340`, `ce11412ec7`, `a9a8af363b`, `cbc7dbd503`, `61aa571c18` |
| **verificación corta y lotes M a P** | **`a11c925d68`** (24: lote M), **`9ab4761a6c`** (23: lote N), **`bd7298e3a5`** (11: lote O), **`d1b5e966a3`** (8: lote P) | `d5402635d9`, `a16dc3b44f`, `656398b692`, `d5b8da2ad6`, `222df18943`, `2175b7365b`, `df0272a598`, `2bb902ec72`, `72900377b1` (sólo `DEC-METH-016`), `923b23586b` |

En negrita, los commits que aparecen como hunk clave abajo. Método, en este orden:

1. `git blame -s -L n,n 377a7c568b..923b23586b -- <archivo>` sobre cada línea que citan los informes.
   Una línea con `^377a7c568b` no cambió en el rango.
2. Para una línea que sí cambió, `git log -S "<texto>"` sobre el rango para encontrar el commit que
   introdujo **la frase exacta** (el blame da el último que tocó el renglón, que en tablas largas
   suele ser otro), y después `git show --word-diff=plain <sha> -- <archivo>` para leer qué cambió.
3. Para PREEXISTENTE, el texto en `git show 377a7c568b:<archivo>`, con su número de línea.

Ningún dictamen sale del mensaje de un commit. Tres veces el blame habría engañado: la fila `partner`
de `V/02` (blame `91416e9a9a`, que sólo agregó dónde vive el contenido), la fila 3 del corte (blame
`d1b5e966a3`, cuando la frase de la prueba entró en `91416e9a9a`) y la línea de `B/16` §1.4 (blame
`9ab4761a6c`, que agregó un paréntesis a una regla de la base).

---

## 2. La crítica — R1

### 2.1 `F-8V3A1-001` · el reclamo verifica la cuenta del ocupante y el ocupante sigue adentro · **PREEXISTENTE**

El camino se arma con cuatro piezas de diseño. **Ninguna cambió en el rango**:

| pieza | en `HEAD` | blame | en la base |
|---|---|---|---|
| la regla 2: el reclamo verifica el correo porque *«esa persona es la de la sesión»* | `V/18` l. 264-267 | `^377a7c568b` | l. 271-274 |
| las tres reglas, y el ocupante como caso que cierran | `V/18` l. 255-259 | `^377a7c568b` | l. 262-266 |
| la regla 3 vale sólo para un correo **nunca** verificado | `V/18` l. 268-272 | `^377a7c568b` | l. 275-279 |
| el paso 2 deja operar con el correo sin verificar | `V/17` l. 122 | `^377a7c568b` | l. 119 |

Las líneas corrieron siete renglones porque `91416e9a9a` borró dos párrafos del §1.5 de `V/18` (el
encendido del trial de Partner, N7). El §2.4 quedó igual. Citas en `HEAD`:

- `V/18:265` — «esa persona es la de la sesión»
- `V/18:259` — «Tres reglas lo cierran»
- `V/18:268` — «Un correo nunca verificado no se cambia llevándose vínculos.»
- `V/17:122` — «Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada»

Y la base, con la marca de origen que confirma lo que decía el consolidado (el arreglo de `R7` de la
FASE 9 vuelta 2, del 2026-09-27, anterior a la base):

```text
377a7c568b:$V/docs/18-partner.md, l. 262
**Leer la casilla prueba la casilla, no la cuenta** (owner 2026-09-27, FASE 9 vuelta 2, `R7`;
377a7c568b:$V/docs/18-partner.md, l. 271-272
2. **Si la cuenta que reclama es la de ese correo y no lo tiene verificado, el reclamo lo
   verifica**: el link llega sólo a quien lee la casilla, y esa persona es la de la sesión. Si
```

**El texto de diseño que abre el camino, la regla 2, ya estaba en la base.** La mitad del camino que
no sale del diseño (cómo entra la dueña a la cuenta del ocupante) es del código actual, que el
rango no toca.

**No hay agravante.** La tanda hizo tres cosas cerca, y ninguna abre ni abarata el camino:

1. `91416e9a9a` (N7) reescribió el §1.5 y el §1.6 de `V/18` y agregó a la fila `partner` de `V/02`
   dónde vive el contenido. No tocó el §2.4.
2. `a6db40430e` (`g3`) agregó a la precisión de `V/17` §1.2 qué hace el dueño con una ficha moderada.
   El paso 2 y su lista cerrada quedaron iguales.
3. La acción 24 (casos vecinos F-C, nombre de `9ab4761a6c`) **escribe un cierre de sesiones**, pero
   para la baja de cuenta y no para el reclamo:

   - `nucleo/08:203` — «sus sesiones se cierran y queda sin acceso»

**¿La tanda podía verlo? Sí, de costado.** Tocó el mismo capítulo y la misma fila del modelo, y
escribió en otro acto la regla que acá falta (cerrar sesiones). No volvió a leer el §2.4.

---

## 3. Las ALTA, racimo por racimo

### 3.1 R1 · el reclamo de Partner sin precondiciones

#### `F-8V3A1-002` · el link no vence y nada impide reclamar un Partner ya reclamado · **PREEXISTENTE**

Las tres líneas que cita el informe son de la base. La única que cambió de renglón es la fila
`partner` de `V/02`, y `git show --word-diff=plain 91416e9a9a` muestra que el cambio está en la
columna de qué guarda, no en la de restricciones:

```diff
(`partners.owner_user_id`, [-anulable)-]{+anulable). **Y el contenido de su presencia (la página y el carrusel) vive en la misma tabla de partners de hoy** (`partners`), no en una tabla nueva (revisión del owner, 2026-09-28, N7)+}
```

- `V/02:582` — «lo escribe sólo el acto de reclamar»
- `V/03:1296` — «Una `APROBADA` que nadie reclama tampoco vence»

```text
377a7c568b:$V/docs/02-modelo-de-datos.md, l. 587
| `owner_user_id` es **nulo hasta el reclamo** y lo escribe **sólo** el acto de reclamar (`18` §2.4): …
377a7c568b:$V/docs/03-maquinas-de-estado.md, l. 1378
que el rechazo se comunique. Una `APROBADA` que nadie reclama tampoco vence, y es inofensiva: la
```

**¿La tanda podía verlo? Sí.** Editó la misma fila de `V/02` en el mismo acto de N7.

#### `F-8V3A2-002` · una cuenta con varias presencias y una sola suscripción · **PREEXISTENTE**

Las seis líneas citadas dan `^377a7c568b`, salvo la fila `partner` (ver arriba). La premisa que se
rompe, *«una sola presencia por suscripción»*, y la unicidad por `user + vertical` son de la base:

- `V/18:76` — «presencia por suscripción»
- `B/02:156` — «a lo sumo UNA fila principal de origen viva por user + vertical»

```text
377a7c568b:$V/docs/18-partner.md, l. 75-76
fotos en mi página»*— usa **`VERTICAL_SUBSCRIPTION`**, y es exacto: como Partner tiene **una sola
presencia por suscripción**, ese scope la identifica sin ambigüedad. El §40 dice *«como mínimo»*
377a7c568b:$B/docs/02-modelo-de-datos.md, l. 147
-- A · el compromiso: a lo sumo UNA fila principal de origen viva por user + vertical
```

**¿La tanda podía verlo? Sí.** N7 decidió que el contenido de la presencia vive en `partners` (una
fila por Partner) y la acción 25 (lote N-G) vacía *«la presencia»* de un dueño. Las dos razonan sobre
la relación cuenta-Partner sin preguntar si es uno a uno.

### 3.2 R2 · la prueba del corte antes de su catálogo

#### `F-8V3A2-001` y `F-8V3A3-001` · la prueba se escribe en el paso 3, antes del 3a · **GENERADO** (`91416e9a9a`)

El orden (el catálogo en el 3a, **después** de la migración estructural) es de la base. Lo que la
tanda agregó es **una escritura nueva dentro de la estructural que depende de ese catálogo**:

```text
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 129
| 3a | **el catálogo de producción**: las data-migrations del catálogo nuevo (… el de trial, el de
pre-trial y el de piso con sus versiones) corren en el carril de datos del despliegue, después de la
migración estructural y antes de que arranque el proceso nuevo.
377a7c568b:$V/docs/21-migracion.md, l. 196
| `L8` | `ACTIVE` + `PUBLIC`, sin ninguna de las dos marcas | `UNPUBLISHED_BY_BILLING` |
```

En la base ninguna ficha nacía con prueba, y la estructural no escribía filas de `trial`. El hunk
que la pone ahí, en los dos lugares:

```diff
91416e9a9a:$D/16-fase-7-del-paraguas.md (fila 3, --word-diff)
{+§2.4) **y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante** (revisión del owner, 2026-09-28, C12; `V/21` §2.4, *«la prueba gratis que escribe el corte»*)—~~,+}
91416e9a9a:$V/docs/21-migracion.md
+> ficha `L8` una fila de `trial` en `TRIAL_ACTIVE`, que arranca en el instante del corte.**
+- **Qué se escribe**: la fila que escribe `T1` (`V/03` §2): el `user_id`, la vertical, el plan de
+  trial derivado de la versión vigente y vendible, las versiones vigentes al arrancar (el piso del
+- **Dónde y cuántas veces**: en la migración estructural del paso 3, **una sola vez**, como la
```

- `D/16:137` — «y la prueba gratis activa de cada dueño con una ficha a la vista, que arranca en ese instante»
- `D/16:138` — «después de la migración estructural y antes de que arranque el proceso nuevo»
- `V/21:389` — «en la migración estructural del paso 3»

**Aplicación de una elección del owner, con un efecto lateral.** C12 (*«la prueba gratis del dueño
arranca ese día»*, `30-…/00-puntos.md`) es la elección. **Dónde** se escribe la prueba (en la
estructural, por analogía con la escritura `C`) no lo eligió el owner: es la forma que le dio la
tanda, y ahí está el defecto.

**¿La tanda podía verlo? Sí, y lo vio para otra fila.** El lote N-H (`9ab4761a6c`) movió la versión
1 de los plazos a la estructural **precisamente** para que exista antes de la prueba del corte, y no
hizo lo mismo con el catálogo:

- `nucleo/02:164` — «antes que la escritura `C` y la prueba del corte, que la guardan»

```diff
9ab4761a6c:$D/nucleo/02-modelo-de-datos.md
-corte en `staging`, y la migración única del catálogo falla si alguno está vacío** (…): la primera versión de los plazos de cada mitad nace en el paso 3a
+… **la versión 1 de los plazos de cada mitad, con los quince valores, nace en la migración estructural del paso 3 (`16-fase-7…` §4.2), antes que la escritura `C` y la prueba del corte, que la guardan, y el paso 3a sólo la verifica**, …
```

### 3.3 R3 · las migraciones de `U1`

#### `F-8V3A3-002` · la limpieza del principio borra las columnas que la tabla de traducción lee · **GENERADO** (`9ab4761a6c`, sobre `91416e9a9a`)

Dos hunks del rango se combinan. Ninguno de los dos daña solo.

**El primero mueve el borrado al principio del programa.** En la base, las tablas y columnas del
cobro viejo se retiraban en la FASE 5, con el código que las lee, después del corte:

```text
377a7c568b:$B/docs/21-migracion.md, l. 421-422
  vuelta 1, R1). El sistema nuevo no lee ninguna, y se retiran con el código que las lee
  (FASE 5). *«Recién arrancamos; …
```

```diff
9ab4761a6c:$B/docs/21-migracion.md
-  (FASE 5). *«Recién arrancamos; a los clientes que hay los contactamos en persona, de a uno, y se
+  ~~(FASE 5)~~: **el código sale de la rama en la limpieza del principio, y su esquema con él, así que la migración que genera ese borrado las saca de la base en el paso 3 del corte** (`16-fase-7…` §4.6; verificación corta, 2026-09-29, lote N-A). …
9ab4761a6c:$D/16-fase-7-del-paraguas.md
+1. **Borra todo el cobro viejo**: `@qazuor/qzpay` con sus paquetes, en los cinco `package.json` que lo
+   esquema de las tablas viejas de billing, cuyo borrado genera la migración que las saca de la base en
```

- `D/16:510` — «esquema de las tablas viejas de billing, cuyo borrado genera la migración que las saca de la base en»
- `B/21:422` — «el código sale de la rama en la limpieza del principio»

La salvaguarda que el informe dice incumplible (*«corre antes de retirarlas»*) es de la base y quedó
igual; con la FASE 5 después del corte se cumplía por orden, y desde N-A no:

- `B/21:425` — «Si algún día algo del corte volviera a leerlas, corre antes de retirarlas.»

**El segundo vuelve dañina la confusión entre `L7` y `L8`.** En la base las dos clases nacían en el
mismo estado, así que perder las columnas que las separan no cambiaba nada (la fila `L8` de la base
está en §3.2):

```text
377a7c568b:$V/docs/21-migracion.md, l. 195
| `L7` | `ACTIVE` + `PUBLIC` y (`owner_suspended` o `plan_restricted`) | `UNPUBLISHED_BY_BILLING` |
```

`91416e9a9a` (C12, `L1-b`) las separó: `L7` pasa a `DRAFT` y `L8` a `PUBLISHED` con prueba.

- `V/21:228` — «y su dueño recibe la prueba activa del corte en esa vertical»

**Efecto lateral de dos elecciones del owner**: N-A (*«limpieza total al principio»*,
`32-decisiones-sobre-la-verificacion.md`) y C12 con `L1-b`. Ninguna de las dos pedía borrar
`owner_suspended` antes del paso 3; el alcance del borrado (*«todo lo que sólo el sistema viejo
usa»*) lo escribió la tanda.

**¿La tanda podía verlo? Sí.** `9ab4761a6c` reescribió en el mismo commit la frase de `B/21` §4 que
lista qué lee el corte, y dejó en pie *«el corte no necesita leerlas»*.

### 3.4 R4 · `puedeCobrarle` y `CANCEL_SCHEDULED`

#### `F-8V3C1-001` · `puedeCobrarle` da por cancelada en el proveedor una fila que billing sigue reintentando · **GENERADO** (`a11c925d68`)

`puedeCobrarle` no existe en la base: `git show 377a7c568b:$D/12-contrato-de-cobertura.md | rg -c puedeCobrarle`
no encuentra nada. La razón de hecho que el hallazgo contradice entra con la pregunta
(`git log -S "ya está dada de baja en el proveedor"` da sólo `a11c925d68`):

```diff
a11c925d68:$D/12-contrato-de-cobertura.md
+**`puedeCobrarle` es la otra pregunta de la dirección de ida, y entra por la baja de una cuenta** (verificación corta, 2026-09-29, lotes M-F y M-G). … **sin `CANCEL_SCHEDULED`**, porque ésa ya está dada de baja en el proveedor y termina sola por `S12` en su fecha de fin; …
```

- `D/12:1118` — «porque ésa ya está dada de baja en el proveedor»

La ventana de reintento que la contradice es de la base, sin cambios:

- `B/03:298` — «hasta 3 días después de la transición que decidió la cancelación»

```text
377a7c568b:$B/docs/03-maquinas-de-estado.md, l. 292
  que ya salió no se repite**: precisión 3, abajo— y la relectura después, **hasta 3 días después de la transición que decidió la cancelación**
```

**Aplicación directa de M-G** (*«la precondición pregunta por una autorización que puede cobrar (sin
`CANCEL_SCHEDULED`)»*). La justificación *«ya está dada de baja»* es de la tanda y es la que choca con
la base. `9ab4761a6c` (N-C) **achicó** la ventana al sumar la marca `CANCELACIÓN_SIN_CONFIRMAR`: sin
ella el `no` valía para siempre. No agrava.

**¿La tanda podía verlo? Sí.** El lote M nació de `VC-VT-03`, *«la 24 trabada por
`CANCEL_SCHEDULED`»*: la tanda razonó sobre ese estado y no releyó la regla de reintento de `B/03`.

### 3.5 R5 · el objeto de `G13`

#### `F-8V3C1-002` y `F-8V3D1-001` · `G13` no vigila las respuestas de arranque de ida · **GENERADO** (`91416e9a9a` y `a11c925d68`)

**En la base la lista estaba completa.** Enumeraba las dos respuestas de arranque que había, y la fila
de `V/20` decía lo mismo que el contrato:

```text
377a7c568b:$D/12-contrato-de-cobertura.md, l. 1434-1435
siempre. **Es el cableado que contesta por billing**: el `no` a las cuatro fuentes de billing y el
`NINGUNA` de `finDeServicio` (§5.1).
377a7c568b:$V/docs/20-testing.md, l. 57
| **G13** ✚ | … (el `no` a las cuatro fuentes de billing y el `NINGUNA` de `finDeServicio`), …
```

`a6db40430e` (C8) sacó `finDeServicio` de las dos, parejo. Después, dos respuestas de arranque nuevas
entraron al §5.1 y no a las dos listas:

1. `retenciónDetenida` (C14) entró al §6.3 del contrato y **no** a la fila de `V/20`, cuyo último
   cambio es el tachado de C8:

   ```diff
   91416e9a9a:$D/12-contrato-de-cobertura.md
   -`NINGUNA` de `finDeServicio`~~ (§5.1; revisión del owner, 2026-09-28, C8). La implementación de arranque lo tiene en un módulo propio,
   +`NINGUNA` de `finDeServicio`~~ (§5.1; revisión del owner, 2026-09-28, C8) **y el `no` de
   +`retenciónDetenida`** (revisión del owner, 2026-09-28, C14). La implementación de arranque lo tiene en un módulo propio,
   ```

2. `puedeCobrarle` (M-F) entró al §5.1 con su `no`, y **ni** al §6.3 **ni** a `V/20`:

   ```diff
   a11c925d68:$D/12-contrato-de-cobertura.md
   +2026-09-28, C14; …), **y a `puedeCobrarle` contesta `no`**, porque sin billing no hay suscripción que cobre (verificación corta, 2026-09-29, lote M-F)~~, **y a
   ```

- `D/12:1340` — «y a `puedeCobrarle` contesta `no`»
- `D/12:1465` — «(revisión del owner, 2026-09-28, C14). La implementación de arranque lo tiene en un módulo propio,»
- `V/20:57` — «el `no` a las cuatro fuentes de billing»

**Efecto lateral de C14 y de M-F.** La forma enumerada es de la base (FASE 9 vuelta 2,
`F-8V2C1-005`); lo generado es la lista vencida.

**¿La tanda podía verlo? Sí.** Las dos veces escribió la respuesta de arranque en el mismo capítulo, a
130 líneas del §6.3, y la primera vez editó el §6.3 mismo.

### 3.6 R6 · la compra de addon sin identidad propia

#### `F-8V3B2-001` · orden sin respuesta más pantalla recargada: dos cobros · **PREEXISTENTE**

Las tres piezas del camino son de la base: el pedido acuñado **al abrirse** la pantalla, `A3` que
reenvía a las 72 horas tratándolo como `EX-41`, y la comprobación que sólo mira `ABANDONED`.

- `B/16:101` — «La pantalla de compra acuña un identificador de pedido al abrirse»
- `B/03:2526` — «`A3` reenvía la orden con la misma clave y el mismo cuerpo antes de abandonar»

```text
377a7c568b:$B/docs/16-addons.md, l. 101
> `R4`, `F-8V2B2-003`). La pantalla de compra acuña un identificador de pedido al abrirse; `A1` lo
377a7c568b:$B/docs/03-maquinas-de-estado.md, l. 2581
| A3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | … **`A3` reenvía la orden con la misma clave y el mismo cuerpo antes de abandonar** —`EX-41`: si ya existía vuelve la misma y no cobra dos veces—. …
```

La tanda escribió al lado. `9ab4761a6c` (N-B, *«el `402` que no llega»*) agregó el reenvío del
**segundo pedido con el mismo identificador**:

```diff
9ab4761a6c:$B/docs/16-addons.md (--word-diff)
existe y no manda otra [-orden;-]{+orden (salvo que la instancia todavía no tenga id de orden: ahí reenvía la misma, §1.4; verificación corta, 2026-09-29, lote N-B);+} una recompra es otro pedido, con otro identificador.
```

- `B/16:120` — «El segundo pedido que la encuentra así reenvía la orden con la misma clave y el mismo cuerpo»

Ese reenvío cubre el doble clic de la misma pantalla. La pantalla recargada acuña `P2`, no encuentra
`I1` y no pasa por ahí. **No crea el camino ni lo abarata.**

**¿La tanda podía verlo? Sí, de cerca.** N-B escribió el párrafo del §1.4 sobre la respuesta perdida,
que es el caso de este hallazgo, y lo cerró para la misma pantalla.

#### `F-8V3B1-001` · el reenvío de `A3` vuelve con error y la orden pagada queda sin detector · **PREEXISTENTE**

La afirmación que el camino rompe, *«toda `ABANDONED` tiene el id»*, es de la base. `262adc4638`
(lote L-C, `A7`) le sumó una segunda razón, sin tocar el caso del reenvío con error:

```diff
262adc4638:$B/docs/09-conciliacion.md (--word-diff)
nunca tuvo respuesta, `A3` no abandona (`B/03` §8), {+**y `A7` abandona con el id que vino en el+}
{+error**,+} así que toda `ABANDONED` tiene el id de su
```

- `B/09:790` — «así que toda `ABANDONED` tiene el id de su»
- `B/06:444` — «Si devuelve error con la orden existente»

```text
377a7c568b:$B/docs/09-conciliacion.md, l. 772
nunca tuvo respuesta, `A3` no abandona (`B/03` §8), así que toda `ABANDONED` tiene el id de su
377a7c568b:$B/docs/06-proveedor.md, l. 418
| **`EX-43`** ✚ | … | **no bloquea**: condiciona `A3` sobre el addon de única vez (`B/03` §8; `R4`), que es de **B10**. Si devuelve error con la orden existente, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas del barrido de **B11**, motivo 23 …
```

**¿La tanda podía verlo? Sí.** Editó la misma oración que el camino desmiente.

#### `F-8V3B1-002` · `A3` puede crear y cobrar la orden 72 horas después · **PREEXISTENTE**

`A3` reenvía en la base (`377a7c568b`, l. 2581 de `B/03`, arriba), y el riesgo de crear la orden ya
estaba nombrado en el barrido: la frase es contexto sin cambios del hunk de `262adc4638`.

- `B/09:787` — «reenviar con la clave puede crear la orden si nunca»

El reenvío que agregó N-B es del segundo pedido, con la persona presente, y no el de las 72 horas.

**¿La tanda podía verlo? Sí.** N-B escribió *«si no la tenía, la crea»* para su reenvío, que es el
mismo riesgo del de `A3`.

#### `F-8V3B1-003` · el addon recurrente no tiene candado contra el doble clic · **PREEXISTENTE**

Las seis líneas citadas dan `^377a7c568b`. El recurrente usa la máquina de la principal sin tope y el
candado `A` es sólo de la principal:

- `B/03:25` — «una por addon recurrente»

```text
377a7c568b:$B/docs/03-maquinas-de-estado.md, l. 25
complemento —una por addon recurrente, `DEC-ADDON-002`— usan **esta misma máquina**, sin tope
```

**¿La tanda podía verlo? No.** `git diff 377a7c568b..923b23586b -- $B/16-addons.md $B/03-maquinas-de-estado.md | rg '^[-+].*(doble clic|candado)'`
no trae ninguna línea sobre el recurrente.

### 3.7 R7 · la fila de `refund` sin su devolución

#### `F-8V3B1-004` y `F-8V3B2-003` · el reenvío no devuelve el id, y nadie reenvía · **PREEXISTENTE**

La celda de `RF2` y la medición que la contradice están en la base, sin cambios en el rango (`git blame`
de `B/03` l. 1835-1850 y de `B/09` l. 768-771: todo `^377a7c568b`):

- `B/03:1844` — «Una llamada sin respuesta se reenvía con la misma clave y el mismo cuerpo»
- `D/06:313` — «no devuelve el refund original en el cuerpo»

```text
377a7c568b:$B/docs/03-maquinas-de-estado.md, l. 1902
| RF2 | `REQUESTED` | … Una llamada sin respuesta se reenvía con la misma clave y el mismo cuerpo, y vuelve la misma devolución con su id (`RF-6`) |
377a7c568b:$D/06-mp-validation-matrix.md, l. 312
| RF-6 ✚ | ¿El reembolso es idempotente? | … (trata una reentrega correcta como fallo), y **no devuelve el refund original** en el cuerpo, así que hay que tenerlo guardado …
```

**¿La tanda podía verlo? Poco.** Las mediciones del 29/09 no volvieron sobre `RF-6`, y la tanda tocó
`B/09` en la comprobación de órdenes (`262adc4638`), no en la de devoluciones.

### 3.8 R8 · la pérdida declarada de `G1-4`

#### `F-8V3C2-004` · *«el trial lo compensa»* no vale para el anual · **PREEXISTENTE**

La frase y el recuento de anuales que no vuelve al owner son de la base:

- `D/16:257` — «el trial que estrena lo compensa de hecho»
- `B/21:473` — «que suele cubrir»

```text
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 228
   que tenga vigentes se pierden con el corte, y **el trial que estrena lo compensa de hecho**.
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 122
…sa población y hasta cuándo. **No es condición del corte**: dice cuándo cae la segunda corrida y no cambia qué cubre la regla.
```

`git log -S "No es condición del corte"` ubica esa frase en `348ee0222d` y `18077a6d41`, los dos
anteriores a la base. C12 cambió el mecanismo del trial (lo escribe el corte en vez de estrenarse al
publicar), pero no la población del anual ni la frase.

**¿La tanda podía verlo? Sí.** Reescribió la fila 0 del corte cuatro veces (`a6db40430e`,
`91416e9a9a`, `e4ce09585f`, `d1b5e966a3`), a dos oraciones del recuento de anuales.

#### `F-8V3B3-001` · el detector del titular desconocido lee un `payer_email` vacío · **PREEXISTENTE**

El manifiesto *«con su `payer_email`»* (arreglo `R21` de la vuelta 2) y la medición del campo vacío
son de la base:

- `B/21:497` — «con su `payer_email`, que suman esas personas a la lista»
- `D/06:334` — «el `GET` lo devuelve vacío, nunca el mail real»

```text
377a7c568b:$B/docs/21-migracion.md, l. 467
  **Detector**: la pasada y el manifiesto, con su `payer_email`, que suman esas personas a la lista
377a7c568b:$D/06-mp-validation-matrix.md, l. 333
| EX-19 | ¿Qué campos se pueden **reescribir** sobre una autorizada? | … **`payer_email` NO**: `200` y no cambia, y el `GET` lo devuelve **vacío**, nunca el mail real. …
```

**¿La tanda podía verlo? Sí.** `be09b5173d` agregó `EX-56`, sobre la identidad del pagador en un
preapproval, a dos filas de `EX-19`.

### 3.9 R13 · la precisión 7

#### `F-8V3A1-003` · la precisión 7 prohíbe escribir mensajes y reseñas en una ficha ajena · **PREEXISTENTE**

El blame de `V/17` l. 190-208 da `^377a7c568b` entero. La regla *«una escritura exige `sujeto =
dueño`»* es el arreglo `R14` de la vuelta 2, como decía el consolidado:

- `V/17:204` — «escritura exige `sujeto = dueño`»
- `V/02:440` — «FAQ, reseñas, conversaciones— sigue colgando de la misma fila»

```text
377a7c568b:$V/docs/17-autorizacion.md, l. 197-202
   **Y vale sólo para lo que no escribe** (FASE 9 vuelta 2, `F-8V2A1-001`). …
   misma respuesta de la precisión 1, sin una segunda. Es escritura todo lo que muta el recurso o
377a7c568b:$V/docs/02-modelo-de-datos.md, l. 445
FAQ, reseñas, conversaciones— sigue colgando de la misma fila, y su lista cerrada está en el
```

**¿La tanda podía verlo? Sí.** `a6db40430e` (`g3`) editó la lista de precisiones de `V/17` §1.2 para
decir qué hace el dueño con una ficha moderada, sobre la misma cuestión de quién escribe qué.

### 3.10 R14 · restaurar no deshace lo de afuera

#### `F-8V3C2-001` · el backup del paso 6 se restaura encima de las altas del paso 5 · **GENERADO** (`37c41d6e8e`)

La garantía del paso 5 es de la base, y en la base era verdad: después del 5 no había restauración.

```text
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 134
| 5 | **abrir las altas del sistema nuevo**: … Hasta acá el sistema nuevo no crea nada en el proveedor, así que la rama de aborto nunca restaura un backup encima de un preapproval vivo …
```

`37c41d6e8e` agrega el paso 6 **después** de abrir las altas, con su propia restauración:

```diff
37c41d6e8e:$D/16-fase-7-del-paraguas.md
+| 6 ✚ | **reemplazar la historia de migraciones de la base por una foto de la base tal como queda después del corte, y lo mismo con las migraciones de datos del seed** (revisión del owner, 2026-09-28, C3, `L2-a`). …
+… a foto. **Si algo falla, se restaura el backup de este paso**, que deja la base igual a como terminó el 5b |
```

- `D/16:143` — «así que la rama de aborto nunca restaura un backup encima de un preapproval vivo»
- `D/16:145` — «Si algo falla, se restaura el backup de este paso»

**Efecto lateral de `L2-a`** (*«se ensaya antes en staging, con backup»*). El owner eligió el backup;
que se restaure con las altas abiertas lo escribió la tanda.

**¿La tanda podía verlo? Sí.** En el mismo hunk editó la fila 5 (*«y la foto del paso 6»*) y dejó en
pie su garantía.

#### `F-8V3C2-002` · el aborto no cuenta los avisos que el receptor nuevo ya confirmó · **AGRAVADO** (`bd7298e3a5`, `9ab4761a6c`)

**El mecanismo es de la base.** La rama de aborto ya cubría hasta el 4b, y el 4b ya hacía llegar al
handler nuevo los reintentos pendientes **antes** de terminar, a propósito:

```text
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 128
El paso 3 termina cuando el despliegue está sano, el 3b y el paso 4 verificados y la sonda de la entrega del 4b cancelada**: la rama de aborto cubre hasta ahí …
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 132
| 4b | **apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo, verificada con una entrega real** … **Va después del paso 4** para que los reintentos de lo que el viejo no tragó —un cobro que no resuelve lo responde con 500 a propósito (HOS-276), y lo que llegó durante el rollout falló— lleguen con la lápida ya escrita … ⚠️ **A qué URL va el reintento de un evento emitido antes del apuntado no está medido** (`WH-4` midió los reintentos, no su destino) …
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 328
   viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva
```

Un reintento confirmado entre el apuntado y el fin del 4b, seguido de un aborto, ya se perdía.

**La tanda lo volvió más probable de dos maneras:**

1. **Lo adelantó y le sacó la duda.** Con el receptor en la misma ruta (O-B), la ruta se abre en el
   paso 4, antes del 4b, y todo reintento que el Worker rechazó llega seguro al handler nuevo (en la
   base, el ⚠️ dejaba abierto que fuera a la ruta vieja):

   ```diff
   bd7298e3a5:$D/16-fase-7-del-paraguas.md
   +… **Y, con las lápidas verificadas, abrir en el borde la ruta de avisos que cerró el paso 3**, verificado con una petición desde afuera que ya no vuelve con el código del cierre …
   ```

2. **Le dio al 4b una segunda forma de fallar con la ruta abierta**: la entrega IPN de un pago real
   (N-D).

   ```diff
   9ab4761a6c:$D/16-fase-7-del-paraguas.md
   +… (verificación corta, 2026-09-29, lote N-D): … **la herramienta del corte hace un pago chico con la tarjeta del owner, mira que su entrega IPN quedó guardada en `provider_notification`** (`B/02` §2.7) **y lo devuelve** …
   ```

- `D/16:140` — «abrir en el borde la ruta de avisos que cerró el paso 3»
- `D/16:141` — «Como la sonda de Webhooks, sin la entrega vista el 4b no termina»

**Efecto lateral de O-B y de N-D**, las dos elecciones del owner. Ninguna decidía qué hace el aborto
con lo ya confirmado.

**¿La tanda podía verlo? Sí.** Reescribió los pasos 4 y 4b tres veces (`9ab4761a6c`, `bd7298e3a5`,
`d1b5e966a3`). No reescribió la lista de la rama de aborto.

#### `F-8V3C2-003` · después de un aborto, `main` tiene el sistema nuevo · **GENERADO** (`a6db40430e`, con `9ab4761a6c`)

La base no tenía modelo de ramas para el corte. Desplegaba con una mitad en producción ya activa, y
retiraba las tablas viejas en la FASE 5:

```text
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 122
| 0 | **el despliegue, ensayado en staging y verde** —**con una mitad en producción**: …
377a7c568b:$D/16-fase-7-del-paraguas.md, l. 323
   3 alcanzó a reemplazar la imagen**: se vuelve a desplegar la imagen vieja, se reencienden su
```

`a6db40430e` (`L3-b`) escribe las dos frases que abren el camino: `main` recibe el sistema nuevo en
el paso 3, y los hotfixes siguen saliendo de `main`.

```diff
a6db40430e:$D/16-fase-7-del-paraguas.md
+   §4.2. La promoción `staging → main` es parte del corte: es lo que despliega el paso 3.
+3. **Los arreglos urgentes van a `main` como hoy**: rama desde `main`, PR a `main` y, después, el
```

- `D/16:462` — «La promoción `staging → main` es parte del corte: es lo que despliega el paso 3.»
- `D/16:463` — «Los arreglos urgentes van a `main` como hoy»

El daño del camino (*«borra `billing_*`»*) sale de la migración de `U1`, que `9ab4761a6c` (N-A) pone
en el paso 3 (§3.3). La frase del aborto que vuelve a desplegar la imagen vieja es de la base y no
nombra la rama.

**Aplicación directa de `L3-b`** en la promoción. Que el aborto no la revierta es un efecto lateral.

**¿La tanda podía verlo? Sí.** Escribió el §4.4 entero y la línea de `D/16` l. 542 (*«corre `main`,
con el sistema viejo, hasta el paso 3»*, `9ab4761a6c`), que es el estado que un aborto no restaura.

### 3.11 R15 · el carril de extras

#### `F-8V3A3-003` · el paso 6 barre el carril de extras · **GENERADO** (`37c41d6e8e`)

El carril y el trigger de `trial` son de la base:

- `V/02:907` — «rechaza todo `DELETE` sobre `trial`»

```text
377a7c568b:$V/docs/02-modelo-de-datos.md, l. 903
> rechaza con un trigger que rechaza todo `DELETE` sobre `trial`**, en el carril de extras
```

El paso 6, que reemplaza `packages/db/src/migrations/**` entero (el carril vive adentro), entra con
el mismo hunk de §3.10 (`37c41d6e8e`, `+| 6 ✚ |`). `git log -S "migración de partida"` sobre el
rango da sólo ese commit.

- `D/16:145` — «una sola migración de partida»

**Efecto lateral de `L2-a`** (*«se reemplaza toda la historia por una foto de la base»*). El owner no
eligió cómo se genera la foto ni si incluye el carril.

**¿La tanda podía verlo? Sí.** La misma tanda 4 escribió en `nucleo/02` que la tabla de claves la
escribe la migración (`37c41d6e8e`, l. 110), que es una de las filas que la foto tiene que llevar.

#### `F-8V3A3-004` · un trigger del código actual borra los favoritos que el diseño conserva · **PREEXISTENTE**

El blame de `V/02` l. 700-740 da `^377a7c568b` en los 41 renglones, y la fila `L1` de `V/21` también:

- `V/02:732` — «para él la ficha no existe»
- `V/02:708` — «así que ningún `ON DELETE CASCADE` corre»

```text
377a7c568b:$V/docs/02-modelo-de-datos.md, l. 735
| **los favoritos** de un turista | del turista | **se conservan**: para él la ficha no existe (cap. 17 §1.2, precisión 7), y la superficie la trata así | `user_bookmarks` |
377a7c568b:$V/docs/02-modelo-de-datos.md, l. 711
| **Se borra** al día 180 | … **Sólo sobre una ficha en `ARCHIVED`**, y la ficha pasa a **`PURGED`** (`PB9`, … el borrado es del contenido, no un `DELETE` de `listing`, así que ningún `ON DELETE CASCADE` corre …
```

Es el código actual contra una regla de antes del rango, como decía el consolidado.

**¿La tanda podía verlo? No.** No tocó `V/02` §4.1.

### 3.12 R16 · devolución y contracargo

#### `F-8V3B2-002` · un pago contracargado sigue propuesto para devolver · **PREEXISTENTE**

Las seis líneas citadas dan `^377a7c568b`:

- `B/03:1765` — «Esté en el estado que esté la fila, `S14` abre la marca con motivo `CONTRACARGO`»
- `B/09:715` — «Por cada `payment` en `SUCCEEDED`»

```text
377a7c568b:$B/docs/03-maquinas-de-estado.md, l. 1823
| **P6** ✚ | `SUCCEEDED` — **o `PARTIALLY_REFUNDED`** … **Esté en el estado que esté la fila, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) con este pago col…
377a7c568b:$B/docs/09-conciliacion.md, l. 699
sigue cubierto y el servicio sigue. **Por cada `payment` en `SUCCEEDED` —o `PARTIALLY_REFUNDED`
```

**¿La tanda podía verlo? No.** Ninguna decisión del rango toca `P6`, `RF1` ni `RF2`.

### 3.13 R17 · el `cancelled` que se deshace

#### `F-8V3B3-002` · las cancelaciones que se deshacen caen en la población exenta · **PREEXISTENTE**

El criterio de exención (arreglo `R2` de la vuelta 2) y el alcance de `EX-45` son de la base. La fila
de `EX-45` en la matriz también da `^377a7c568b`:

- `B/09:199` — «nuestra llamada ya fue confirmada por una relectura»
- `B/06:446` — «nada de esta épica: condiciona el gate del paso 2 del corte»

```text
377a7c568b:$B/docs/09-conciliacion.md, l. 192
> canceló el proveedor**, o **nuestra llamada ya fue confirmada por una relectura**. **Y en los
377a7c568b:$B/docs/06-proveedor.md, l. 420
| **`EX-45`** ✚ | si una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato sigue `cancelled` releída **horas después** | **nada de esta épica**: condiciona el gate del paso 2 del corte y el cobro sobre su lápida (`F-8V2C2-004`). …
```

**¿La tanda podía verlo? Sí, de costado.** Las mediciones del 29/09 (`e4bcc1d48d`) reescribieron
`B/06` y `B/09`, pero sobre los dos canales y no sobre `EX-45`.

### 3.14 R18 · plazos fuera de la lista cerrada

#### `F-8V3B3-003` · la ventana y el plazo de escalamiento no son de nadie · **GENERADO** (la contradicción, `37c41d6e8e`)

La ventana *«configurable»* sin valor es de la base:

- `B/09:738` — «La ventana es un parámetro configurable, y su longitud NO está medida.»

```text
377a7c568b:$B/docs/09-conciliacion.md, l. 722
**La ventana es un parámetro configurable, y su longitud NO está medida.** …
```

La regla que la vuelve contradictoria (todo plazo que decide cuándo pasa algo sale de **una lista
cerrada**) no existe en la base: `git show 377a7c568b:$D/nucleo/02-modelo-de-datos.md | rg -n 'lista, cerrada'`
no encuentra nada. Entra con la tanda 4:

```diff
37c41d6e8e:$D/nucleo/02-modelo-de-datos.md
+cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel**, con la acción *«cambiar un plazo»*
+**La lista, cerrada.** Cada mitad es dueña de sus claves, como del resto de su catálogo.
```

- `nucleo/02:131` — «cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel»
- `nucleo/02:142` — «La lista, cerrada.»

**Aplicación directa de C9 y `L2-g`.** Como en la vuelta 2 (R5), lo generado es la contradicción; el
mecanismo (una ventana sin valor que un implementador puede dejar en cero) ya estaba.

**¿La tanda podía verlo? Sí.** Escribió la lista para que ningún plazo quedara afuera, y no recorrió
los *«configurable»* de `B/09`.

### 3.15 R19 · la clave de canje

#### `F-8V3C1-003` · `extenderTrial` se declara idempotente y verticales no guarda la clave · **PREEXISTENTE**

Las líneas citadas dan `^377a7c568b` (`D/12` l. 1155-1170 entero):

- `D/12:1166` — «la clave de canje hace idempotente el»
- `B/14:362` — «verticales corre `T4`»

```text
377a7c568b:$D/12-contrato-de-cobertura.md, l. 1162
se pisan. Billing asienta el canje sólo con `ACEPTADA`; la clave de canje hace idempotente el
377a7c568b:$B/docs/14-promos-cortesias-y-grants.md, l. 360
`extenderTrial(user, vertical, días, claveDeCanje)` (`12-contrato…` §4.1), verticales corre `T4`
```

**¿La tanda podía verlo? Sí, de costado.** Sumó `puedeCobrarle` al §4.1 y recontó sus entradas, pero
no releyó la de `extenderTrial`.

---

## 4. Las marcas del consolidado, contra los diffs

| marca de `00-hallazgos.md` §5 | racimos con ALTA | lo que dicen los diffs |
|---|---|---|
| 12 *«candidatos a generados por la revisión del owner»* | R2, R3, R4, R5, R14, R15, R18 (R10, R11, R12, R20 y R22 no tienen ALTA) | **se confirman seis de siete**. R2, R3, R4, R5 y R18 salen GENERADO; R14 sale 2 GENERADO y 1 AGRAVADO; R15 se parte: `A3-003` GENERADO y `A3-004` PREEXISTENTE, como ya decía el consolidado |
| 8 *«nacidos de arreglos de la FASE 9 vuelta 2»* | R1, R6, R7, R8, R13, R17 (R9 y R28 son MEDIA) | **se confirman todas como PREEXISTENTE** en este rango: el texto defectuoso está en la base con su marca de la vuelta 2. En R6 y R8 la tanda escribió al lado (N-B, `A7`, `EX-56`) sin crear el camino |
| 9 sin pieza posterior | R16, R19 | **PREEXISTENTE**, las dos |

Una corrección al consolidado: la frase de la prueba del corte **no** es de la tanda de los lotes M
a P, que es donde el blame la ubica (`d1b5e966a3`). Es de `91416e9a9a`, del 28/09.

---

## 5. Tabla de cierre

| racimo | hallazgo | sev. | veredicto | commit clave | elección del owner que aplicaba el hunk |
|---|---|---|---|---|---|
| R1 | **`F-8V3A1-001`** | **CRÍT** (propuesta ALTA) | **PREEXISTENTE** | la regla 2 en la base, l. 271 de `V/18` | — (arreglo `R7` de la vuelta 2) |
| R1 | `F-8V3A1-002` | ALTA | PREEXISTENTE | `91416e9a9a` tocó la fila, no la restricción | — |
| R1 | `F-8V3A2-002` | ALTA | PREEXISTENTE | base, l. 76 de `V/18` y l. 147 de `B/02` | — |
| R2 | `F-8V3A2-001` | ALTA | **GENERADO** | `91416e9a9a` (prueba en la estructural) | C12, con efecto lateral en dónde |
| R2 | `F-8V3A3-001` | ALTA | **GENERADO** | `91416e9a9a` | C12 |
| R3 | `F-8V3A3-002` | ALTA | **GENERADO** | `9ab4761a6c` (limpieza al principio), sobre `91416e9a9a` (`L7` ≠ `L8`) | N-A y C12 con `L1-b`, efecto lateral |
| R4 | `F-8V3C1-001` | ALTA | **GENERADO** | `a11c925d68` (*«ya está dada de baja»*) | M-G, aplicación directa |
| R5 | `F-8V3C1-002` | ALTA | **GENERADO** | `91416e9a9a` y `a11c925d68` | C14 y M-F, efecto lateral |
| R5 | `F-8V3D1-001` | ALTA | **GENERADO** | `91416e9a9a` y `a11c925d68` | C14 y M-F |
| R6 | `F-8V3B2-001` | ALTA | PREEXISTENTE | base; `9ab4761a6c` (N-B) escribió al lado | — |
| R6 | `F-8V3B1-001` | ALTA | PREEXISTENTE | base; `262adc4638` editó la oración | — |
| R6 | `F-8V3B1-002` | ALTA | PREEXISTENTE | base, l. 2581 de `B/03` | — |
| R6 | `F-8V3B1-003` | ALTA | PREEXISTENTE | base, l. 25 de `B/03` | — |
| R7 | `F-8V3B1-004` | ALTA | PREEXISTENTE | base, l. 1902 de `B/03` | — |
| R7 | `F-8V3B2-003` | ALTA | PREEXISTENTE | base | — |
| R8 | `F-8V3C2-004` | ALTA | PREEXISTENTE | base, l. 228 y 122 de `D/16` | — |
| R8 | `F-8V3B3-001` | ALTA | PREEXISTENTE | base, l. 467 de `B/21` | — |
| R13 | `F-8V3A1-003` | ALTA | PREEXISTENTE | base, l. 197-202 de `V/17` | — |
| R14 | `F-8V3C2-001` | ALTA | **GENERADO** | `37c41d6e8e` (paso 6 con su backup) | `L2-a`, efecto lateral |
| R14 | `F-8V3C2-002` | ALTA | **AGRAVADO** | base (4b y aborto); `bd7298e3a5` y `9ab4761a6c` | O-B y N-D, efecto lateral |
| R14 | `F-8V3C2-003` | ALTA | **GENERADO** | `a6db40430e` (§4.4), con `9ab4761a6c` | `L3-b`, aplicación directa; N-A |
| R15 | `F-8V3A3-003` | ALTA | **GENERADO** | `37c41d6e8e` (paso 6) | `L2-a`, efecto lateral |
| R15 | `F-8V3A3-004` | ALTA | PREEXISTENTE | base, l. 711 y 735 de `V/02` | — |
| R16 | `F-8V3B2-002` | ALTA | PREEXISTENTE | base | — |
| R17 | `F-8V3B3-002` | ALTA | PREEXISTENTE | base, l. 192 de `B/09` y l. 420 de `B/06` | — |
| R18 | `F-8V3B3-003` | ALTA | **GENERADO** (la contradicción) | `37c41d6e8e` (la lista cerrada) | C9 y `L2-g`, aplicación directa |
| R19 | `F-8V3C1-003` | ALTA | PREEXISTENTE | base, l. 1162 de `D/12` | — |

**Conteo.** Sobre los **27 hallazgos de severidad ALTA o mayor** (las 26 ALTA más la CRÍT que el
consolidado propone bajar):

| veredicto | cuántos | cuáles |
|---|---|---|
| **GENERADO** | **10** | `A2-001`, `A3-001`, `A3-002`, `C1-001`, `C1-002`, `D1-001`, `C2-001`, `C2-003`, `A3-003`, `B3-003` |
| **AGRAVADO** | **1** | `C2-002` |
| **PREEXISTENTE** | **16** | `A1-001` (CRÍT), `A1-002`, `A2-002`, `B2-001`, `B1-001`, `B1-002`, `B1-003`, `B1-004`, `B2-003`, `C2-004`, `B3-001`, `A1-003`, `A3-004`, `B2-002`, `B3-002`, `C1-003` |

La crítica declarada es **0 de 1** generada. Entre las 26 ALTA, **10 generadas y 1 agravada**. Por
tramo, las once salen de seis commits: `91416e9a9a` y `a6db40430e` (revisión del owner, 28/09),
`37c41d6e8e` (tanda 4 de la misma revisión), `a11c925d68` (lote M) y `9ab4761a6c`, `bd7298e3a5` (lotes
N y O). Los casos vecinos y las mediciones del 29/09 no generaron ninguna ALTA. El lote P
(`d1b5e966a3`) sólo aparece reescribiendo líneas.

---

## 6. El criterio de corte, aplicado

- `$D/01-decision-log.md:6061` — «por única vez**; no la reemplaza»
- `$D/01-decision-log.md:6075` — «Con críticos, se declaran con el owner»
- `$D/01-decision-log.md:5389` — «Lo que quede se declara con causa, caso por caso, y lo elige el owner.»
- `$D/01-decision-log.md:5391` — «Un `CRITICA` de dinero no se declara con causa sin que lo lea el owner»

1. **Esta vuelta es la excepción, y no abre otra.** `DEC-METH-016` se aparta del tope de
   `DEC-METH-013` sólo para esta vuelta, así que la atribución no manda una vuelta 4, cualquiera sea
   el resultado. Que la crítica sea preexistente **no la exime de destino**.
2. **La señal de la cláusula 1.** Si el owner sostiene la CRÍT, la tanda posterior a la vuelta 2 **no
   generó críticos** (0 de 1), igual que en la vuelta 2. Si acepta bajarla, la vuelta no tiene
   críticos sobre qué atribuir. En los dos casos la tanda **sí generó ALTA**: 10 de 26, más una
   agravada, y todas en piezas que la propia tanda escribió (la prueba del corte, `U1`,
   `puedeCobrarle`, el paso 6, la promoción a `main`, la lista cerrada de plazos).
3. **Cláusula 3: todo se declara con el owner, caso por caso.** Para `F-8V3A1-001` hay dos preguntas
   que son del owner y no de este documento: si acepta la baja a ALTA (`00-hallazgos.md` §6,
   pregunta 1) y, si no, qué destino le da (arreglar el reclamo o declararlo con causa).
4. **Cláusula 4: la CRÍT toca plata.** El camino termina con Mercado Pago cobrándole Gold a la dueña
   por un Partner que controla otra persona. Si el owner la sostiene como CRÍT, **no se declara con
   causa sin que la lea**. Lo mismo vale para las ALTA de plata que el owner decida tratar como
   críticas. De las once que salieron generadas o agravadas, tocan plata `C1-001` (cobro sobre una
   cuenta dada de baja), `C2-001` y `C2-002` (preapprovals vivos sin fila y un cliente que paga dos
   veces), `C2-003` (tablas del sistema que cobra, borradas), `A2-001` y `A3-001` (cobertura gratis
   sin fin sobre la cartera `L8`) y `B3-003` (el motivo 23 apagado). Cuáles se tratan así lo elige
   el owner.

---

## Key Learnings

1. **La crítica de esta vuelta es toda preexistente, otra vez.** Las cuatro piezas de diseño del
   camino de `F-8V3A1-001` están en la base con la marca `R7` de la vuelta 2. Es la segunda vuelta
   seguida con la CRÍT en pie fuera de la tanda.
2. **La tanda no generó críticos, pero sí ALTA: 10 de 26, más una agravada.** Todas en piezas que la
   tanda escribió. Ninguna en los casos vecinos ni en las mediciones: las once salen de la revisión del
   owner (28/09) y de los lotes M a O.
3. **El patrón es el de la vuelta 2: la tanda genera contradicciones de orden, no mecanismos nuevos.**
   La prueba en la estructural choca con el 3a de la base; `U1` al principio choca con la salvaguarda
   de `B/21` §4; el paso 6 choca con la garantía del paso 5. Las tres nacen de **mover una escritura
   de lugar** sin recorrer qué existe en ese instante.
4. **La tanda vio el problema de orden en una fila y no en la vecina.** N-H subió los plazos a la
   estructural *«antes que la prueba del corte»* y dejó el catálogo en el 3a. Un arreglo que nombra
   su razón (*«que la guardan»*) es la pista para buscar las otras filas que la misma razón alcanza.
5. **Dos arreglos correctos se combinan en un defecto.** `A3-002` no lo abre ningún hunk solo: C12
   separa `L7` de `L8`, y N-A borra las columnas que las separan. El blame por línea no lo ve. Hay
   que preguntar qué hacía falta para que el daño exista y buscar cada pieza.
6. **El blame de una fila de tabla larga miente sobre el origen.** La fila 3 del corte da
   `d1b5e966a3` (lote P), y la frase de la prueba entró en `91416e9a9a`. Sin `git log -S` sobre la
   frase exacta, el consolidado habría ubicado R2 en los lotes y no en la revisión del owner.
7. **Una enumeración completa en la base se vence en la tanda.** El objeto de `G13` estaba completo
   en la base; lo vencieron C14 y M-F al agregar respuestas de arranque al §5.1. Es GENERADO aunque la
   forma de lista sea de antes.
