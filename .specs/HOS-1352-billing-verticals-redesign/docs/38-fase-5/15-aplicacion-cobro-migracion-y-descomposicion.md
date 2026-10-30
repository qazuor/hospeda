---
title: "FASE 5 · aplicación — cobro, migración, descomposición y spec"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación en la épica del cobro: `B/21`, la descomposición y la spec

Siglas: `B` = `.specs/HOS-1354-billing-cobro-y-proveedor`; `B/21` = `B/docs/21-migracion.md`;
`B/desc` = `B/descomposicion.md`; `B/spec` = `B/spec.md`. Las líneas son las del worktree del
programa después de esta aplicación. Fuente: [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md)
y [`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md), con el owner eligiendo la 1
en A, B, C, D y E.

## 1. Archivos tocados

- `B/docs/21-migracion.md`
- `B/descomposicion.md`
- `B/spec.md`

Nada más. Sin commits, sin `git add`.

## 2. Qué se aplicó

### 2.1 Simplificación del corte, lote C (la lápida del corte, la ventana y el detector)

- **S-40** (lápida del corte), `B/21:200` «**El corte no escribe ninguna fila de rastro**»; el
  título del §2.5 cambia, `B/21:198` «Un cobro tardío de un débito viejo entra como cualquier
  desconocido»; y el efecto sobre el owner, `B/21:208` «que decida la devolución**». Quedan
  tachados el párrafo de la única fila de rastro, el recuadro del compromiso que se conserva, *«Qué
  lleva y sobre qué ids»* con el paso 4, el `UNIQUE` y el Worker.
- **S-40**, `B/21:187` «(el paso 4 salió: FASE 5, simplificación del corte, S-40)» (los grants ya
  no van *«antes de las lápidas del paso 4»*).
- **S-40 y S-49** (la re-vinculación sigue), `B/21:247` «**Por qué hace falta la regla de»; y
  `B/21:278` «una sonda que siguió viva** (la lápida del corte salió».
- **S-40**, `B/21:288` «**La lápida de recepción no compite por el candado del §11**»; se tacha el
  recuadro del barrido sobre la lápida del corte.
- **S-40 y S-70**, `B/21:312` «que ninguna transición produce, y `origen_de_lápida` queda con un
  solo valor, `RECEPCIÓN`**».
- **S-40**, `B/21:321` «cancelar primero y escribir después, como».
- **S-41 y S-76** (la ventana) y `G3-1`, `B/21:329` «*(Los cuatro bloques que siguen hablaban del
  cobro sobre la lápida del corte»; se tachan el asiento sin marca, la ventana del día del corte, la
  posición de `2d` extendida y la ⚠️ que los acompañaba.
- **S-42 y S-74** (el detector y su segunda corrida), `B/21:673` «*(Sale entero con la lápida del
  corte»: el punto del «NO cierra» sobre el cobro en vuelo, tachado entero.
- «NO cierra», el cobro tardío, `B/21:608` «después del corte le aparece al owner**».
- **S-66** (`B11`), `B/desc:137` «**y un cobro tardío de un preapproval del sistema viejo entra por la
  lápida de recepción como cualquier desconocido»; su columna de capítulos, `B/desc:137` «*(sale con
  la lápida del corte: FASE 5, S-66)*»; el criterio de `B11`, `B/desc:854` «sin asentarse callado**»
  (salen la herramienta del paso 4, la ventana del corte y la lista del detector del día siguiente;
  queda el criterio de `R6` sobre la fila principal sin usuario).
- **S-74**, la fila del lote X del §2.11, `B/desc:696` «*(Sale: la segunda corrida del detector salió
  con la lápida del corte».
- `B/21` deja de ser capítulo de `B11`, `B/desc:914` «**`B/21` es capítulo de una unidad, y sólo por
  una».
- `B/spec:71` «**y, de las fichas, sólo la de cada cuenta de la lista cerrada que fija el owner» (con
  el cobro tardío por la lápida de recepción en la misma celda).

### 2.2 Simplificación del corte: re-verificación, población, aviso y titular sin detector

- **S-30**, `B/21:64` «**No se re-verifica: el tamaño de la cartera ya no decide nada**».
- **S-29, S-06, S-07, S-37, S-38, S-51, S-74**, `B/21:69` «**Y lo que seguía en este § sale
  entero**»; los cuatro párrafos del §1.3 (re-verificación, recuento de Gastronomía y Experiencia,
  población a avisar, `REJECTED`, pasada del proveedor, titular sin detector, segunda corrida y
  anuales) quedan tachados.
- **S-50**, `B/21:592` «owner, que les avisa por privado**».
- **S-29**, `B/21:597` «**Mueve plata, y su población son las cuentas».
- **S-53**, `B/21:606` «*(Lo de la constancia sale: lo cubre».
- **S-37 y S-38**, `B/21:627` «*(El titular que sólo conoce el proveedor sale».

### 2.3 Simplificación del corte, lote A (la lista cerrada) y `DEC-MIG-002`

- **S-03** y `DEC-MIG-002` precisada, `B/21:461` «**Y lo que entre al sistema viejo hasta el corte no
  se conserva, salvo que el owner lo sume a la»; y la fila 1 de la tabla del §3.3, `B/21:449`
  «**quien entra no se conserva, salvo que el owner lo sume a la lista cerrada del corte**».
- **S-56**, `B/21:465` «**Sale el umbral de unas veinte personas con su condición de caducidad**».
- Lote E (`DEC-MIG-004` superada por `DEC-MIG-007`), `B/21:433` «~~`DEC-MIG-004` #16~~ `DEC-MIG-007`,
  que la superó», y el título del §3.3.
- **S-01 y S-12** (las pruebas de la lista, que escribe el script del corte, lote 2 D), `B/21:481`
  «**Verticales escribe una prueba activa para cada cuenta de la lista cerrada del owner, y la».
- **S-40**, `B/21:475` «`permanent_grant` del §2.4, que son cortesías del diseño nuevo; la lápida
  del corte salió**».

### 2.4 Simplificación del corte, §7: filas de la matriz

- **S-43 y S-59** (`EX-42`), `B/desc:436` «el vencimiento de las `Preference` del viejo salió del
  1a»; `B/spec:269` «el 1a ya no vence `Preference`».
- **S-57** (`EX-48`), `B/desc:442` y `B/spec:275` «su único sujeto era la ventana del corte, que
  salió».
- **S-58** (`EX-50`), `B/desc:443` y `B/spec:276` «la segunda corrida del detector salió, y el owner
  ya dio el hecho».
- **S-60** (`EX-44`, `EX-45`), `B/desc:438` y `B/desc:439` «perdió el sujeto del corte y queda por su
  uso de producto (FASE 5, owner 2026-09-30, simplificación del corte; S-60) |»; `B/spec:271`
  «Condiciona ~~el cobro sobre la lápida del corte y~~ la exención de las terminales»; `B/spec:272`
  «**se mide en sandbox antes de `B11`, fuera del paso 0**».
- **S-61** (`EX-47`), `B/desc:441` «**Se mide en sandbox antes de `B11`, fuera del paso 0**: es de
  producto»; `B/spec:274` «~~Se mide en el paso 0 del corte~~ **Se mide en sandbox antes de `B11`».
- **S-60 y S-61** juntas, `B/desc:452` «**Y `EX-44`, `EX-45` y `EX-47` también se miden en sandbox
  antes de `B11`».
- **S-62** (`EX-59`), `B/desc:446` y `B/spec:278` «**Sujeto retirado**: el detector del titular».

Las tres «no se mide» llevan la marca `🚫 **No se mide, por decisión**`.

### 2.5 Lote 1 (lo que borra `U1`) en `B/21` §4

- **B** (`billing_notification_log`), `B/21:492` «`billing_notification_log`**, que es la bitácora
  de todos los correos de la plataforma y no del».
- **C** (las migraciones de datos del seed salen en `U1`), `B/21:550` «**`U1` saca de la rama las
  migraciones de datos del seed que usan el cobro viejo**»; se tacha el congelado del caso 9.
- **D** (Partner), `B/21:497` «`partners`, sus FK y los tres crons de Partner, que borra `U1`**».
- **E y F** (lista cerrada, destaque en las tres tablas), `B/21:499` «**en una lista cerrada**
  (FASE 5,» y `B/21:503` «`experiences.has_active_subscription`, con sus lectores».
- **J**, en `B/21:461` (arriba) y en `B/spec:71`.

### 2.6 Lote 3 B y S-09 (las tres columnas de `accommodations`)

- `B/21:522` «`billing_unpublished_at`, que sobreviven a `U1` porque tienen lectores fuera del
  cobro: `V6`»; se tachan la razón `L5`/`L7` y la condición de orden respecto de la clasificación.

### 2.7 Lote 2

- **A** (`U2`), `B/desc:707` «**Y entre `U1` y las primeras unidades que encolan va `U2`, el outbox
  común**»; el grafo, `B/desc:711` «U1 ──► U2 (del paraguas: el outbox común, FASE 5, lote 2 A) ──►
  B4 y B12»; `B4` espera a `U2`, `B/desc:130` «**y el aviso de que la cobertura cambió se encola en
  el outbox común» y `B/desc:725` «**B4** una vez que estén B3, **B5**, `V4` **y `U2`**»; `B12`
  espera a `U2`, `B/desc:138` «**y los correos de la migración y de su cancelación salen por el
  outbox común».
- **A**, conteo de unidades, `B/desc:794` «~~**23**~~ **24** unidades»; los guards siguen en 33.
- **B y E** (`B1`), `B/desc:127` «**y quedan para esta unidad las variables de entorno de Mercado
  Pago que `U1` no borra».
- **D** (catálogo como SQL generado), `B/21:178` «generado por un script TypeScript que un guard
  regenera y compara» y `B/21:564` «TypeScript que un guard regenera y compara; las pruebas y los
  seudónimos de las cinco cuentas los».

### 2.8 Lote 5 F (`B6`)

- `B/desc:132` «**y desde la FASE 5 las devoluciones de una misma orden van de a una»; la fila de
  `EX-58` del §2.11, `B/desc:690` «**con dos devoluciones pedidas sobre la misma orden, la segunda no
  sale» (se tacha la rama *«de su mismo monto»* del lote AK); el criterio de `B6`, `B/desc:849` «**y
  dos devoluciones pedidas a la vez sobre la misma orden salen de a una».

### 2.9 Frontmatter

- `updated: 2026-09-30` en los tres archivos (`B/21:6`, `B/desc:6`, `B/spec:6`).

## 3. Lo que no se aplicó y por qué

- **S-68 (`B9`)**: MANTENER; la fila de `B9` no se tocó.
- **El 📌 *«Caducó el 2026-09-26»* de `B/21` §1.3** quedó sin tachar, aunque S-30 cita esas líneas:
  dice un hecho (el primer cobro de la historia) que citan el §3.1 y el §4 (*«los hay desde el
  2026-09-26 … (§1.3)»*), no una re-verificación. Lo que S-30 retira, la re-verificación, está
  tachado en `B/21:63`.
- **Lote 1 A, G, H, I; lote 2 C; lotes 3 A, C a F; lotes 4 y 6; S-02, S-04, S-05, S-08, S-10, S-11,
  S-14 a S-28, S-31 a S-36, S-39, S-44 a S-48, S-52, S-54, S-55, S-63 a S-65, S-67, S-69, S-71 a S-73,
  S-75, S-77, S-78**: no tienen texto en mis tres archivos (viven en `16-`, `V/21`, `V/desc`, el
  log o la matriz). `EX-46` (S-65) queda como estaba.
- **Lote 1 I** (los enums del cobro) y **lote 2 E en su mitad de `U1`** (las variables que borra):
  mis archivos no enumeran lo que borra `U1`; sólo se escribió en `B1` lo que le queda.
- **La nota de `RF2` sobre `RF-6`** (lote 5 F) vive en `B/03` §6.1; en `B/desc` sólo quedó dicha en la
  fila de `B6`.
- **Los conteos de la matriz en `B/desc` §2.7 y `B/spec` §5.2** (117 filas, 16 `UNKNOWN`) no se
  tocaron: ningún estado cambia con la FASE 5, y el recuento vigente es de su dueño (ver §4).

## 4. Para otro dueño

- **`B/03` §6.1** (`RF2`, `RF3`): sacar la rama *«de su mismo monto»* para órdenes, decir que un
  `409` es error de programación y corregir la nota de `RF2` sobre `RF-6` (es del pago). Texto
  propuesto, al final de `RF3`: *«~~toma la devolución de la orden de su mismo monto~~ en una orden,
  el id sale por resta contra las devoluciones ya registradas, y las de una misma orden se piden de a
  una (FASE 5, owner 2026-09-30, lote 5 F)»*.
- **`B/02`, `B/05`, `B/06`, `B/09`, `B/16`** (S-70): las menciones a la lápida del corte (7, 5, 2, 2 y
  1 según `20-` §8) se limpian; `origen_de_lápida` queda con un solo valor (ver §5).
- **`16-fase-7-del-paraguas.md` §4.2, *«Las herramientas del corte»***: deja de repartir la lápida
  del §2.5 a `B11`; `B/desc:914` ya dice que `B/21` sólo es capítulo de `B9`.
- **`V/21` §2.5** (S-56): el umbral de unas veinte personas; `B/21` §3.3 ya no lo cita como vigente.
- **La matriz** (`06-mp-validation-matrix.md`): `EX-42`, `EX-48`, `EX-50` con `🚫 **No se mide, por
  decisión**`; `EX-44`, `EX-45`, `EX-47` en sandbox antes de `B11`; nota de sujeto retirado en
  `EX-59`. Y el recuento que citan `B/desc` §2.7 y `B/spec` §5.2 está atrasado: `20-` §13 da 117
  filas con 14 `UNKNOWN` y `EX-59` ya `PARTIALLY_SUPPORTED`; cuando el dueño de la matriz recuente,
  esos dos encabezados se actualizan con su cifra.
- **El log**: `DEC-MIG-002` precisada (*«lo que entre hasta el corte no se conserva salvo que el
  owner lo sume a la lista»*), `DEC-MIG-004` superada, `DEC-MIG-005` y `DEC-CONC-002` precisadas;
  `B/21` ya los cita así.
- **Líneas que citan el consolidado y `03-`**: `B/21:438` (`billing_*` entero) está ahora en
  `B/21:491-492`; `B/21:440-443` (`is_featured`) en `B/21:499-508`; `B/21:474-480` (las 11
  migraciones) tachado en `B/21:543-549` y reemplazado en `B/21:550-556`; `B/desc:129`, `:138` y
  `:699` no se movieron.

## 5. Vuelve al owner

### 5.1 `origen_de_lápida` · ¿queda la columna con un solo valor, o sale?

Con la lápida del corte afuera, la columna `origen_de_lápida` sólo puede valer `RECEPCIÓN`. `20-`
§8 (S-70) dice *«puede salir la columna»*, sin decidirlo. Ejemplo: a Juan le entra un cobro de un
débito viejo después del corte; su lápida de recepción lleva `clase = LÁPIDA` y, hoy, también
`origen_de_lápida = RECEPCIÓN`, que ya no distingue nada.

1. **Sale la columna**: `clase = LÁPIDA` alcanza para reconocer la fila. Costo: texto en `B/02`
   §2.2, `B/09` §2.4 y los capítulos de S-70. Riesgo: bajo; si algún día vuelve otra lápida, se
   agrega. **Recomendada**: una columna que no distingue nada es un lugar más donde equivocarse.
2. **Queda con un solo valor**. Costo: cero. Riesgo: un enum de un valor que alguien va a leer como
   si hubiera otros.

## 6. Conteos

- Menciones de «FASE 5» por archivo, con `rg -c 'FASE 5' <archivo>` contra la copia de antes:
  `B/21` 4 → 35; `B/desc` 2 → 24; `B/spec` 1 → 9.
- Líneas del diff, con `git diff --numstat`: `B/21` +198 −108; `B/desc` +29 −25; `B/spec` +9 −9.
- Marcas «no se mide», con `rg -c '🚫 \*\*No se mide, por decisión'`: `B/desc` 3, `B/spec` 3.
- Unidades y guards, con `rg -o '\*\*24\*\* unidades|\*\*33\*\* repartidos' B/descomposicion.md`: 24 y
  33.
- Piezas `S-NN` citadas, con `rg -o 'S-[0-9]{2}'` sobre los tres archivos: 30 valores distintos, de los que
  uno, `S-13`, es un falso positivo que sale de `HOS-13…`: 29 piezas.
- Delimitadores de tachado: ningún `~~~~` en los tres archivos (script en Python); `markdownlint-cli2`
  desde la raíz del worktree: 0 errores antes y 0 después en los tres.
