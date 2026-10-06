# B · Cobro, corte y proceso: impacto de C2, C8, C13, C15, N2, N3, N4, N5, N8 y N9

Medido sobre el worktree del diseño (`HEAD 377a7c568b`), hospeda2 (clone principal, sin editar) y
qzpay (`HEAD 7240dca`). Abreviaturas: `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`,
`$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `$B` =
`.specs/HOS-1354-billing-cobro-y-proveedor`, `LOG` = `$D/01-decision-log.md`, `H2` =
`/home/qazuor/projects/WEBS/hospeda2`, `QZ` = `/home/qazuor/projects/PACKAGES/qzpay`. «Artifact» es
el texto vigente (`explicacion/vivo.txt`).

## Resumen

| punto | qué es | tamaño | lo más importante |
|---|---|---|---|
| **C8** | no se discontinúan verticales | **grande, pero SIMPLIFICA** | caen 4 decisiones enteras, 4 transiciones (`S25`–`S28`), 2 entradas del contrato, 1 tabla, 1 columna, 1 acción, 1 invariante, 1 hecho de reinicio, ~6 decisiones del owner `V2-*`; unas 850 líneas normativas dedicadas más ~300 menciones sueltas. Cero filas de matriz. |
| **C2** | sin convivencia ni interruptores | mediano | el repo ya no tiene convivencia de código, pero le faltan 3 cosas: cerrar `coexistence`/`feature flags` como «no existe», escribir el congelamiento `staging → main` desde que el paraguas entra a `staging`, y decidir dónde vive la herramienta del corte (hoy: «script del repositorio actual» que usa qzpay). |
| **C13** | el MP falso y la batería | mediano/grande | la tabla del repo (15 filas, `$B/docs/20-testing.md:457-475`) **no es** la lista de 13 del artifact; hay que reconciliarlas. La batería semanal/mensual no existe en el repo (sólo «la suite de sandbox corre las filas de la matriz», sin cadencia). |
| **C15** | migración de un plan retirado | grande (mecanismo nuevo) | el repo dice «es un acto distinto… por los caminos que ya existen» y no tiene mecanismo; el artifact define uno. Choca en letra con `B/10` §3.4 («no se programa una migración automática») y con el camino de upgrade (`DEC-SUB-007`, re-autoriza). |
| **N2** | qzpay | respuesta + 📌 | `DEC-ARCH-004` = reescribir en un package propio; qzpay sólo como referencia. Su implicación 5 («se absorben los modelos de las 27 tablas») quedó vieja con `DEC-MIG-003`. Recomiendo archivar qzpay después del corte. |
| **N3** | e2e en vez de smoke | mediano | el diseño ya lo pide (`$B/docs/20-testing.md:525-551`); falta el falso como servidor HTTP, el reloj controlable y el recorte explícito de la regla de smoke de `CLAUDE.md`. |
| **N4** | releer a MP siempre | chico/mediano | **ya está**: invariante `D17` (4 entradas) y `B/03` §10.1. Falta volverlo estructural (guard/tipos) y decir el alcance en pantallas. |
| **N5** | Codex/OpenCode con GLM/DeepSeek | mediano (proceso) | las 22 fichas de unidad viven como artifacts de claude.ai: un agente externo **no las puede leer**. Hay que bajarlas al repo, autosuficientes y con aceptación ejecutable. |
| **N8** | cancelar/pausar desde MP | hay **dos huecos** | se detecta (aviso o barrido diario), pero cancelar desde MP le corta el servicio a Juan **en el acto** (pierde lo pagado), sin aviso nuestro; y una pausa del pagador se leería como **mora** (`S6`). Nada de esto está medido. |
| **N9** | query string `source_news` | respuesta + remedición | el filtro **no es de qzpay: es de hospeda2** (HOS-159). Descarta en silencio todo aviso IPN. Contamina al menos la mitad de producción de `WH-5` y deja dudosa `EX-15`. Hay que medir de nuevo, con fila nueva. |

---

## C2 · No hay convivencia, ni interruptores, ni código para sostenerla

### 1. Qué dice hoy el diseño

- **La convivencia en producción ya está descartada** en tres lugares: `DEC-ARCH-007` (`LOG:2434`,
  *«no es la coexistencia en producción, no la hay, sino la espera»*), `DEC-MIG-002` (`LOG:2473-2485`,
  opción 3 «coexistencia de dos motores» descartada porque *«contamina la arquitectura nueva»*) y
  `$D/11-particion-del-programa.md:283`. El contrato no tiene tercera implementación (`$D/12-contrato-de-cobertura.md` §5.3).
- **Pero la FASE 7 del paraguas sigue listando `coexistence` y `feature flags` como ítems huérfanos
  pendientes**: `$D/16-fase-7-del-paraguas.md:40-45` (tabla con «—») y `:382-388` («Cuatro de los
  seis ítems huérfanos, `rollout`, `coexistence`, `feature flags` y `acceptance gates`… trabajo pendiente»).
- `DEC-ARCH-007` deja abierto *«cómo se integra sin activar es materia de la FASE 7»* (`LOG:2437-2438`).
- **La herramienta que cancela autorizaciones** (pasos 1a, 1b y 2): *«un script del repositorio
  actual… mergeado y promovido a `main` antes de que la rama del paraguas entre a `staging`»*
  (`$D/16-fase-7-del-paraguas.md:254-261`). El 1b lo hace *«el sistema viejo, que todavía corre… Es el
  único que sabe hacerlo»* (`:125`), y el 1a usa *«el método `expire` del adaptador de qzpay»* (`:124`, fila `EX-42`).
- Hay tres cosas del corte que funcionan como interruptores operativos (no de código): la regla del
  borde de Cloudflare que cierra y abre altas (pasos 0b, 3 y 5, `:123`, `:128`, `:134`), y el apuntado
  de la URL de notificación, que el propio texto llama *«el único interruptor que decide desde cuándo
  le llegan eventos al handler nuevo»* (`:128`).

### 2. Qué pide el owner

Todo el sistema nuevo de una vez; ni convivencia, ni interruptores, ni código para sostenerla. Pregunta
abierta: ¿la herramienta del corte es un script suelto fuera de los dos sistemas?

### 3. Qué hay que cambiar

- **`$D/16` §1 y §5**: `coexistence` y `feature flags` pasan de «—» a **«no existen, por decisión»**
  (con la cita de C2), igual que se hizo con `rollback` en §4.3. Quedan pendientes `rollout` y
  `acceptance gates`. Cambiar la palabra «interruptor» del paso 3 (`:128`) por «el apuntado de la URL»,
  para que el texto no afirme un interruptor que C2 prohíbe.
- **Declarar explícito qué NO es un interruptor**: la regla del borde del día del corte y el apuntado
  de la URL son **actos operativos del corte, fechados y verificados**, no banderas en el código. Sin esa
  frase, un lector de C2 puede «corregir» el corte sacándolas. El guard `G13` (un build de producción no
  importa la implementación de arranque del contrato, `$V/docs/20-testing.md:57`) tampoco es un
  interruptor: se queda.
- **Hueco que C2 destapa y el repo no escribe: el ítem `rollout`.** El nuevo sistema entra a la rama
  `staging` cuando el paraguas se mergea ahí (`DEC-ARCH-007`, `LOG:2411-2426`). Desde ese momento
  **ninguna promoción `staging → main` puede salir sin ser el corte**, porque arrastraría el billing
  nuevo a producción. Sin interruptores no hay otra forma de «tenerlo en staging y no en main». Hay que
  escribir ese congelamiento (y que los arreglos urgentes van por `main` con back-merge, como el hotfix
  de `CLAUDE.md`). Ver sub-pregunta C2-b.
- **`DEC-ARCH-007` 📌**: *«cómo se integra sin activar»* se contesta: no se activa nada; vive en la rama
  del paraguas y en el entorno de pruebas hasta el corte.
- **`DEC-MIG-001` punto 5** (`LOG:425`, `R-MIG-01` *«cómo se convive durante el rewrite»*): cerrarlo con C2
  (en `04-open-decisions.md:430` ya figura tachado; falta el 📌 en la decisión).
- **La herramienta del corte**: si pasa a script suelto (C2-a), cambian `$D/16:254-261` (dónde vive),
  `:124` (el 1a deja de usar el adaptador de qzpay y llama a la API directo), la fila `EX-42` de la matriz
  (hoy mide *«el `expire` de qzpay»*: pasa a medir la llamada del script) y `:179-182` (el argumento
  *«el código que sabe cancelar se va con el despliegue»* deja de ser cierto con un script suelto; el
  orden se sostiene igual por la otra razón, el cobro sin asiento de `:107-110`).
- Linear: ninguna unidad nueva. La herramienta del corte es de la FASE 7 del paraguas (ya lo es).

### 4. Sub-preguntas para el owner

#### C2-a. ¿Dónde vive la herramienta que cancela autorizaciones el día del corte?

1. **Script suelto en `scripts/cutover/` del repo, que no importa código del sistema viejo ni del
   nuevo**: habla con Mercado Pago por `fetch`, lee la base vieja con SQL de sólo lectura, escribe su
   manifiesto. *Recomendada*. Pros: cumple C2 a la letra, no toca el billing viejo, se puede correr y
   re-correr sin despliegue, se versiona. Costo: reescribir unas pocas llamadas (listar preapprovals sin
   filtro, cancelar, releer por id, vencer una `Preference`), y re-medir `EX-42` sobre esa llamada.
   Riesgo: bajo; las llamadas ya están medidas (`RC-1`, sonda 50).
2. **Script dentro del repo actual que usa el código viejo (qzpay)**, como dice hoy el diseño. Pros: ya
   escrito así. Contras: agrega código al sistema condenado y lo ata a qzpay (N2).
3. **Hacerlo a mano contra la API.** Descartada por el propio diseño (`$D/16:179-182`): sin
   idempotencia, sin registro, sin verificación.
Ejemplo: el 5/12 a la mañana, quien opera el corte corre `cancelar-autorizaciones --manifiesto` y la
autorización de Juan (y la de Luis, que sólo conocía Mercado Pago) queda `cancelled`, releída por id.

#### C2-b. ¿Cómo se prueba el nuevo sin interruptores y sin trabar `staging → main`?

1. **El paraguas se despliega en un entorno propio (una app de Coolify desde la rama del paraguas, con su
   base y su aplicación de MP de pruebas) y entra a `staging` recién la semana del corte.** *Recomendada*.
   Pros: `staging → main` sigue fluyendo meses. Contras: un entorno más que mantener. Riesgo: bajo.
2. **Entra a `staging` cuando esté terminado y se congela `staging → main` hasta el corte.** Pros: cero
   infraestructura. Contras: todo lo demás de Hospeda queda sin salir a producción durante el soak.
3. Interruptor en código: prohibido por C2.

### 5. Tamaño

**Mediano**: texto en `$D/16` y dos 📌; el `rollout` es un ítem nuevo de la FASE 7.

---

## C8 · Las verticales no se discontinúan: la medición completa

### 1. Qué dice hoy el diseño (lo que cae)

El acto de discontinuar tiene dos mitades (verticales cierra altas, billing fija la fecha, avisa y
cancela), una tabla, una pregunta del contrato, cuatro transiciones, un hecho de reinicio, una acción
administrativa y sus avisos. **El owner ya había dicho el 2026-09-21 que no se iba a discontinuar
ninguna** (`LOG:3986`, `LOG:4326`), y el diseño igual construyó el mecanismo.

#### Decisiones del log

| decisión | qué pasa | dónde |
|---|---|---|
| `DEC-SUB-015` (pausada no entra al piso) | **SUPERSEDED entera** (74 líneas) | `LOG:3970` |
| `DEC-SUB-018` (suspendida va a `CANCELLED`) | **SUPERSEDED entera** (26 líneas) | `LOG:5005` |
| `DEC-GRANT-010` (cortesía sobre vertical discontinuada se difiere) | **SUPERSEDED entera** (49 líneas); cae el ítem «sin resolver» del saldo de cortesía | `LOG:4289` |
| `DEC-ARCH-011` (admite altas + invalidación de la vertical entera) | **SUPERSEDED entera** (50 líneas): sus dos mitades son de la discontinuación | `LOG:6127` |
| `DEC-ARCH-006` | 📌: el contrato pierde `situaciónDeVertical` y `finDeServicio` | `LOG:2383-2392` |
| `DEC-RF-004` | 📌: el disparador 2 partido «sólo para la discontinuación» pierde su objeto | `LOG:4751-4818` |
| `DEC-RF-006` | 📌: el motivo 15 se renombra (sale `…_O_DISCONTINUACIÓN`); caen las precisiones `V2-d`/`V2-n`/`V2-p` que lo tocan | `LOG:5044`, `:5079`, `:5105` |
| `DEC-RF-008` | 📌: *«dieciséis acciones»* pasa a quince | `LOG:6000` |
| `DEC-DATA-002` | 📌: el hecho del fin de servicio sale de la lista del reloj | `LOG:3408` |
| `DEC-ADDON-004`, `DEC-SUB-013` | 📌 de texto: nombran `S26`/`S28` en enumeraciones | `LOG:3529`, `:3563`, `:3761` |

No confundir: *«fin de servicio»* también nombra la fecha de una **suscripción** (`DEC-SUB-009`,
`CANCEL_SCHEDULED`); eso **no** cae. Y `R-MP-01` (la API de reembolsos que MP anunció en
«discontinuación») tampoco: es otra cosa con la misma palabra (~22 menciones).

#### Máquinas de estado

- Billing (`$B/docs/03-maquinas-de-estado.md`): caen **`S25`, `S26`, `S27` y `S28`** (`:173-176`), y las
  secciones *«`S25` comparte el par de `S10`»* (`:920-949`) y *«La discontinuación de una vertical tiene
  TRES filas»* (`:950-1001`). **36 → 32 transiciones**. `S18` pierde la rama *«en `CANCEL_SCHEDULED`
  cuando las dos cayeron en la misma discontinuación»* (`:166`); `S1` pierde la guarda
  `admiteAltas` (`:149`) y conserva `vigente`/`vendible`; `S12`-vía-`S26` deja de existir; el par
  `S10`/`S25` sale de la cuenta de pares con dos filas (`$D/nucleo/03-maquinas-de-estado.md:96`: son 4,
  quedan 3). En la tabla del espejo (`:2757-2830`) la salvedad de la `CANCEL_SCHEDULED` de `S26` y la
  lista de «quince» cancelaciones nuestras pierden `S25`, `S27`, `S28`.
- **Las «catorce transiciones» que disparan la orfandad del complemento pasan a once**
  (`$B/docs/16-addons.md:744-760`: salen `S25`, `S27`, `S28`).
- Verticales (`$V/docs/03-maquinas-de-estado.md`): `T1` pierde *«y la vertical admite altas»* (`:51`),
  `T3` pierde la condición de la campaña de recuperación (`:53`), cae el párrafo de `TRIAL_ACTIVE` que
  deja de ser fuente desde el fin de servicio (`:76-80`), cae la fila *«la vertical no admite altas»*
  de la tabla de `PRE_TRIAL` (`:317`, se queda la `:318` de «sin versión vendible»), y cae entera la
  sección *«El día del fin de servicio: billing avisa, verticales ejecuta»* (`:1296-1364`, ~69 líneas),
  con `PB9` esperando el hecho 4.

#### Modelo de datos

- Cae la tabla **`vertical_discontinuation`** (`$B/docs/02-modelo-de-datos.md:32` y el párrafo `:38-43`).
- Cae la columna **`vertical.admite_altas`** (`$V/docs/02-modelo-de-datos.md:46`; el acto de discontinuar
  era el único que la escribía, `$B/docs/10-…:470` fila «cerrada a altas: ya no existe»). La fila de
  `vertical` sigue sin borrarse nunca, pero por C3 y no por esto.
- Cae la fila de invalidación del caché *«llega el fin de servicio de la vertical»*
  (`$V/docs/02-modelo-de-datos.md:633`, `:644`, `:667-668`).

**Contrato** (`$D/12-contrato-de-cobertura.md`)

- La firma pasa de **ocho entradas a seis**: salen `situaciónDeVertical(vertical) → { admiteAltas }` y
  `finDeServicio(vertical)` (`:1096-1104`); los campos pasan de doce a once (`:1211-1219`).
- **La dirección de ida pierde su única pregunta** (`:1115-1123`, `:1138-1139`): la regla de vigilancia
  del §4.2 ya no tiene *«mitad de ida»* que nombrar. El contrato vuelve a ser: billing empuja avisos y
  lee política; verticales no le pregunta nada a billing. **Es la simplificación más valiosa del punto.**
- Cae la subsección *«Una vertical discontinuada no cubre a nadie»* (`:560-639`, ~80 líneas) y la frase
  *«una columna que esto obliga a crear: `vertical.admite_altas`»* (`:1222-1241`).
- `§5.1`: la implementación de arranque ya no contesta `NINGUNA` a nada (`:1321`, `:1435`); `G13` pierde
  esa mitad de su predicado.

#### Núcleo

- Glosario: **los seis hechos que reinician la inactividad pasan a cinco** (`$D/nucleo/01-glosario.md:50-59`,
  renumerar: el de moderación pasa de 6 a 5), más `:89`, `:124`, `:139`, `:173-212`, `:503`. El artifact
  ya dice «cinco hechos» y «el quinto hecho: levantar una moderación».
- Invariante **`D14`** (*«anunciada la discontinuación… no se emite un cobro más»*,
  `$D/nucleo/04-invariantes.md:141`) cae, y se recuentan las listas que la nombran (`:290`, `:306`,
  `:314`, `:323`).
- Outbox (`$D/nucleo/07-outbox-y-notificaciones.md`): cae la fila *«la pausa alcanzada por una vertical
  discontinuada»* (`:244`, `:261`); `:225` y `:226` pierden la condición «si la vertical ya no admite
  altas»; `:247` pierde el camino `S28`.
- Auditoría (`$D/nucleo/08-auditoria-y-observabilidad.md`): cae la acción **16** (`:167`, `:175-179`,
  `:270`), su resumen en `DEC-OBS-001` y el ítem de re-emisión diferida por discontinuación (`:212`).

#### Capítulos de billing

- `$B/docs/10-verticales-planes-billing-options.md` **§4 entero** (`:123-492`, ~370 líneas): 4.1 a 4.6,
  la fórmula de la fecha, acortar la cola, los cuatro bordes, la tabla de situaciones. Queda §3 (retiro)
  y entra la migración (C15).
- `$B/docs/19-superficies.md`: caen las filas **14, 14-bis y 20** (`:127-128`, `:138`), la rama `S28` de la
  18 (`:135`), *«el acto a medias de la acción 16»* (`:215`) y `:305-307`; el motivo 15 se renombra (`:230`).
- `$B/docs/09-conciliacion.md:225-226` (`S27`, `S28`), `:646`, `:1098`; `$B/docs/14-…:677-678`;
  `$B/docs/20-testing.md:125` (`S27`), `:309`; `$B/docs/02-…:195`, `:729`, `:994`.

**Autorización**: `$V/docs/17-autorizacion.md:340-425` (la decimosexta, su sujeto, su excepción de
«capa de composición»). **16 → 15 acciones** (el artifact ya dice quince).

**Decisiones del owner `V2-*` recién aplicadas que caducan** (`$D/29-fase-8-vuelta-2/24-decisiones-del-owner-verificacion.md`):
enteras **`V2-g`** (acortar la cola), **`V2-h`** (capa de composición), **`V2-i`** (reintento de la mitad
de billing), **`V2-n`** (`S21` deduce la causa de `vertical_discontinuation`), **`V2-s`** (sujeto de la
acción 16), **`V2-z1`** (costo de la regla de `V2-n`); a medias **`V2-d`** (la mitad de `S26`; la
selección de `S32` en `S11` sigue) y **`V2-x`** (*«`PB9` espera el hecho 4»*). Seis enteras y dos a medias.

#### Descomposición

- **B12** pierde `S25`–`S28`, `vertical_discontinuation`, la respuesta real de `finDeServicio` y la mitad
  de billing de la acción 16 (`$B/descomposicion.md:138`, `:149`, `:753`); gana la migración (C15).
- **B3** pierde `admiteAltas` en `S1` (`:129`, `:744`); **B4** pierde *«una vertical discontinuada no cubre
  a nadie»* y la fila sembrada (`:130`); **B10** pierde tres disparadores de orfandad y la rama del motivo
  15; **B9** pierde la cortesía diferida por discontinuación (el segundo disparador de `S9` queda sólo con
  la sucesión); **B13** pierde las filas de superficies.
- **V2** pierde `situaciónDeVertical`, `admite_altas` y la mitad de verticales del acto
  (`$V/descomposicion.md:55`, `:322`, `:409-410`); **V3** la invalidación de la vertical entera (`:378`);
  **V4** la respuesta de arranque de `finDeServicio`; **V6** la corrida del día del fin de servicio
  (`:379`); **V9** el hecho 4 (`:62`).
- **Dependencias entre épicas: 12 → 11** (cae la fila 13, `$B/descomposicion.md:343`); las filas 6 y 7
  pierden `admiteAltas` y se quedan con `vigente`/`vendible` (`:336-337`).

**Corte**: `$D/16:129` (paso 3a) deja de sembrar *«`admite_altas` y fin de servicio»*; `:123` pierde el
argumento *«`admite_altas` del nuevo dice otra cosa»*.

#### Matriz, guards, casos borde

- **Matriz: cero filas caen** (ninguna mide la discontinuación; `EX-11`, que `S25` usaba, lo sigue usando `S22`).
- **Guards: ninguno cae entero.** Cambian textos: `G13` (el `NINGUNA`), `G-R6-B` («seis hechos»),
  `G-R4` (un par menos). La cláusula de `G-R1-F` que vigila que 14 y 15 no se abran juntas se queda
  (la revocación sigue abriendo el 15).
- **Casos borde**: el artifact ya sacó cinco (reintento de la mitad de billing, súper admin con ficha en
  la vertical que cierra, no borrar con el cierre sin anotar, acortar la cola, pausados fuera del piso).
  En el repo caen además los **cuatro bordes** de `$B/docs/10-…` §4.5 (`:430-446`).

**Cuánto se simplifica, en números** (conteo con `rg` sobre los 33 archivos normativos, sin fases ni rastros):

- **~530 líneas** nombran la discontinuación (menos ~22 que son `R-MP-01`, ajenas).
- **Bloques dedicados** que se borran enteros: B/10 §4 (~370), el día del fin de servicio en V/03 (~69),
  la subsección del contrato (~80), dos secciones de B/03 (~80) más 4 filas de tabla, cuatro decisiones
  (~200), la tabla de B/02 (~15). **Unas 850 líneas**, más ~300 menciones sueltas que se corrigen.
- **Mecanismo que no se construye**: 4 transiciones, 1 tabla, 1 columna, 2 entradas de contrato (y con ellas
  la dirección de ida entera), 1 acción administrativa con reintento automático y excepción de autorización,
  1 invariante, 1 hecho del reloj con su ejecutor diario, 4 avisos, 1 fila de invalidación de caché, 1
  dependencia entre épicas, 3 disparadores de orfandad.

### 2. Qué pide el owner

Sacar todo lo de discontinuar. Retirar planes sigue.

### 3. Qué hay que cambiar

Todo lo de arriba, en una tanda. Tres cuidados:

1. **Recontar, no restar**: la regla de `DEC-METH-010`/`DEC-METH-011` (resolución por aparición). Hay
   cuentas encadenadas: 36 transiciones, 14 disparadores, 16 acciones, 6 hechos, 8 entradas, 12 campos,
   12 dependencias, 4 pares, «quince» cancelaciones nuestras.
2. **La situación «en operación con todos los planes retirados» se queda** (`$B/docs/10-…:469`,
   `$V/docs/19-superficies.md:76` fila 29, `R24`): es la forma de dejar de vender una vertical sin cerrarla,
   y es lo que el artifact dice (*«Retirar todos los planes de una vertical sigue siendo posible y no la cierra»*).
3. **Las decisiones SUPERSEDED no se borran** (el log conserva historia): se marcan con la cita de C8.

### 4. Sub-preguntas para el owner

#### C8-a. ¿Se deja escrito en el repo un «si algún día hace falta», o se borra sin rastro?

1. **Una línea en `$B/docs/10-…` (donde estaba el §4)**: «discontinuar una vertical no se construye; si
   hiciera falta se diseña entonces; el diseño viejo está en `DEC-SUB-015/018`, `DEC-GRANT-010`,
   `DEC-ARCH-011`, SUPERSEDED». *Recomendada*: cero costo, y quien lo necesite en 2028 no parte de cero.
2. Borrar sin referencia. Riesgo: alguien lo re-diseña de cero y repite las 5 vueltas.

### 5. Tamaño

**Grande en volumen, pero es sólo borrar y recontar.** Una tanda de 1 a 2 días de agente con verificación
por aparición. Ningún mecanismo nuevo.

---

## C13 · El Mercado Pago falso y la batería que vigila al real

### 1. Qué dice hoy el diseño

- **Tesis**: *«El stub no simula al proveedor: reproduce sus mentiras medidas»* (`$B/docs/20-testing.md:454-455`).
- **La tabla del repo tiene 15 filas y no es la del artifact** (`:457-475`): `EX-15`, `EX-20`, `EX-34`,
  `EX-11`, `EX-5`, `RC-1`/`RC-4`, `EX-37`, `EX-12`, `PA-3`, `EX-3`, `RF-6`, `RF-4`, `RF-8`, `PC-2`, `EX-18`.
  Y declara un hueco: **las mentiras de la conciliación no están** (`RC-5/6/7`, `GR-3`, `WH-1/2/5`,
  `PS-2/6`, `charged_quantity`, `last_charged`, `:477-483`).
- **La vigilancia del real**: *«la suite de sandbox corre las filas de la matriz, no los casos de uso»*
  (`:506-517`), con guard de entorno y de presupuesto (`:519-521`). **Sin cadencia, sin producción, sin
  comparación de forma, sin vigía.**
- **B1** construye el adaptador y el falso, que *«tiene que mentir desde el primer día»*
  (`$B/descomposicion.md:127`, `:172-184`).

### 2. Qué pide el owner

Lista cerrada de 13 mentiras, cada una con su medición y su defensa; un control que falle si aparece una
sin esos datos; por defecto miente siempre; batería semanal en sandbox y mensual en producción que avisa y no ajusta.

### 3. Qué hay que cambiar

- **Reconciliar las dos listas.** Las 13 del artifact no son un subconjunto de las 15:
  - **Entran** (no estaban): el duplicado por pedido igual (`EX-17`, sonda 14), los avisos tardíos,
    repetidos, fuera de orden o perdidos (`WH-1`…`WH-5`, `RF-7`), el rechazo contado como cobro
    (conciliación, `RC-5/6`), el cobro en tandas del minuto 2 (`CT-3`/`PA-3`), la prueba gratis que se agrega
    sola (`EX-26`/`EX-29`/`EX-33`), el enlace que no vence (`EX-1`), la pausa que no se reanuda (`PS-4`).
    Con eso **se cierra la mayor parte del hueco declarado** en `:477-483`.
  - **Salen de la lista de mentiras** (no son mentiras, son reglas del contrato): `EX-12` (token de un uso),
    `RF-4` (clave de idempotencia obligatoria), `PC-2` (piso ARS 15 y techo), `EX-18` (moneda), `RF-6`
    (`200` con cuerpo vacío), `EX-11` (pausada rechaza cambios). El falso las tiene que reproducir igual.
    Ver C13-b.
  - **`EX-3`** (MP le escribe al cliente): el artifact dice que no se simula. Sale de la tabla con esa razón.
  - **El «5 de 8» de la primera mentira** no lo encontré como cifra en la matriz; las filas candidatas son
    `EX-34`, `EX-35`, `EX-20`, `EX-5` y la baja programada. **La tanda que la aplique tiene que citar las
    ocho filas o corregir la cifra.**
- **Guard nuevo en `$B/docs/20-testing.md` §2 (unidad B1)**: falla si una mentira del falso no tiene
  nombre, fila de matriz con fecha y cuenta, y test que la resiste. Y un segundo predicado: un test que
  apaga una mentira tiene que nombrarla y dar el motivo.
- **Separar «mentira medida» de «simulación»** (red cortada, respuesta perdida): el artifact lo pide;
  el repo no lo distingue.
- **§4 «La suite de sandbox» se reescribe como la batería de 1.5**: semanal contra la cuenta de pruebas;
  mensual en producción para lo que sólo se mide ahí (buscador `RC-1`, lotes `CT-3`, devoluciones `RF-8`,
  porque en sandbox las devoluciones dan `401`, `$D/03-handoff.md:1933`); compara resultado y **forma**
  (campos y tipos); **avisa por correo y no toca nada**; si no corre, lo detecta el vigía externo del
  barrido (`$B/docs/09-conciliacion.md:965-984`, que hoy vigila sólo el barrido).
- **Unidad**: el arnés de la batería va con **B1**; la programación y el vigía con B11 o con la FASE 7 del
  paraguas. Producción mensual usa autorizaciones propias del dueño (el guard de presupuesto ya existe).
- **N9 cruza acá**: la batería tiene que escuchar **los dos canales** (IPN y Webhooks), si no hereda el
  mismo punto ciego.

### 4. Sub-preguntas para el owner

**C13-a. ¿Producción mensual o semanal?** (la pregunta abierta del artifact)

1. **Mensual.** *Recomendada*. Cada corrida en producción cuesta plata real (mínimo ARS 15 por cobro,
   `PC-2`, más comisión), llena la casilla del dueño de correos de MP y usa la API de devoluciones que MP
   anunció en discontinuación (`R-MP-01`). Lo que sólo se mide en producción (buscador, lotes) cambia poco.
2. Semanal. Detecta antes, pero cuadruplica costo y ruido.
Ejemplo: el primer lunes del mes, la batería crea una autorización de ARS 15 con la tarjeta del dueño,
espera el lote, lee el buscador, devuelve y cancela; si el buscador de repente trae los 69 y no 15, le
llega un correo al dueño con «RC-1: esperaba subconjunto, obtuve completo».

#### C13-b. Las seis reglas del contrato que no son mentiras (`EX-12`, `RF-4`, `PC-2`, `EX-18`, `RF-6`, `EX-11`), ¿dónde viven?

1. **Una segunda lista, «reglas del contrato», que el falso también cumple y la batería también vigila.**
   *Recomendada*: mantiene limpia la lista de 13 y no pierde cobertura.
2. Adentro de las 13 (vuelven a ser 19). Más simple, pero mezcla «miente» con «exige».

### 5. Tamaño

**Mediano/grande**: reescritura de `$B/docs/20-testing.md` §3 y §4, un guard nuevo, alcance nuevo de B1,
y la batería como pieza operativa (sandbox + producción + vigía).

---

## C15 · Migrar a los clientes de un plan retirado

### 1. Qué dice hoy el diseño

- `$B/docs/10-…` §3.2 (`:39-52`): *«Migrar… es un acto distinto, explícito, por cliente o por cohorte, que
  pasa por los caminos que ya existen: `DEC-MP-002` si el precio le sube, `DEC-SUB-008` si algo le baja»*.
  **No hay mecanismo** (ni acción de cohorte, ni aviso, ni aplicación en la renovación).
- §3.4 (`:71-86`): *«No se fija plazo, no se programa una migración automática, no caduca»*; la cola se
  ve en el listado del §48.
- §3.5 (`:88-121`): la dirección la decide `direcciónDeCambio`, y *«la ventana de 60 días de `DEC-MP-002`
  no aplica»* al cambio **elegido** por el cliente.
- El upgrade elegido es *«el mismo mecanismo que el cambio de ciclo»* (`DEC-SUB-007`, `LOG:1127`), o sea
  re-autorización; el downgrade muta el monto ya y baja capacidades al fin del ciclo (`DEC-SUB-008`, `LOG:1198`).

### 2. Qué pide el owner

Acto aparte del súper admin: plan retirado → plan vivo de la misma vertical, aviso de 60 días
(configurable), se aplica en la renovación; mismo ciclo = mismo preapproval con otro monto; si el destino no
ofrece su ciclo, queda listado; excedente con fecha; pausados y en gracia esperan; si el cliente cambia o se
va durante el aviso, sale.

### 3. Qué hay que cambiar

- **Decisión nueva** (`DEC-SUB-0xx` o `DEC-ARCH-0xx`): la migración de cohorte. Y **📌 en `B/10` §3.2 y
  §3.4**: *«no se programa una migración automática»* sigue valiendo (nada migra por plazo), pero el
  súper admin **sí** puede programar una, que después se aplica sola a cada uno en su renovación. Sin el 📌
  las dos frases se leen contradictorias.
- **Choque con el camino de upgrade**: si la migración sube el precio, el artifact la lleva por la
  **mutación del monto** (como un aumento, `DEC-MP-001`/`DEC-MP-002`) y no por la sucesión con
  re-autorización de `DEC-SUB-007`. Es coherente (no hay cobro inmediato que cobrar, se aplica en la
  renovación), pero hay que decirlo: la migración es un **tercer camino** que no es ni el upgrade ni el
  downgrade elegidos.
- **Choque con `DEC-SUB-008`**: en un downgrade elegido el monto se muta ya y las capacidades bajan al fin
  del ciclo; en la migración **las dos cosas pasan en la renovación**. Otra combinación nueva, a escribir.
- **Máquina de billing (`B/03`)**: una transición nueva, «se aplica la migración» (re-ancla la fila a la
  versión destino en la renovación), con guardas: aviso cumplido, fila `ACTIVE`, sin cambio en curso, mismo
  ciclo ofrecido por el destino. Y la regla de relectura: la mutación del monto se confirma releyendo
  (`D5`: MP dice «ok» y no aplica, `EX-20`), **antes** del cobro de esa renovación (MP cobra el monto vigente
  al momento del cobro, `DW-1`, y en lotes con demora, `CT-3`). Si la relectura no confirma: marca, no se
  re-ancla. `EX-15`: la mutación no avisa, así que no se espera webhook.
- **Tablas**: una fila por migración (origen, destino, anuncio, quién la firmó) y su relación con cada
  suscripción alcanzada (estado: pendiente, aplicada, fuera porque cambió o se fue, «para resolver a mano»).
- **Acción administrativa**: se amplía «cambiar de plan a un cliente» (el artifact ya lo dice; siguen siendo
  quince). Resumen de `DEC-OBS-001` con la lista de afectados, subida o bajada por cliente y fecha.
- **Superficies (`B/19`)**: previsualización del panel (subida/bajada por cliente, precio actual y nuevo,
  fecha); tres correos (anuncio, 30 y 7 días) con cambio de promo si la pierde; listado «para resolver con
  él» de los que no tienen su ciclo en el destino.
- **Configurable (C9)**: los 60 días, con piso = el mínimo del aviso de aumento.
- **Unidades**: **B12** (dueña del catálogo que se retira) y **B8** (reusa la mutación y el excedente);
  **B13** (superficies); verticales ya da `direcciónDeCambio` (V2) y el excedente (V6). Linear: sin issue nueva
  si entra en B12; la sub-issue de B12 se reescribe.
- **Matriz**: no hace falta fila nueva para mutar el monto (`DW-1/2`, `DEC-MP-001`); sí conviene medir qué
  correo manda MP al cliente cuando el monto sube por esta vía (`EX-3` lo midió en baja: *«El vendedor
  Hospeda cambió el monto»*).
- **Casos borde que nacen**: cliente con cortesía temporal en el momento de aplicar; anual con renovación
  a 11 meses (el aviso de 60 días se cumple mucho antes y la migración espera); migración anunciada y
  después revertida (¿se puede cancelar una migración antes de aplicarse a todos?).

### 4. Sub-preguntas para el owner

#### C15-a. Juan tiene un anual del plan retirado que renueva dentro de 10 meses. ¿Espera 10 meses?

1. **Sí, se aplica en su renovación.** *Recomendada*: es lo que dice el artifact, no toca lo pagado y no
   requiere prorrateo. Costo: la versión retirada vive hasta un año más.
2. Aplicar a los 60 días devolviendo la parte no prestada. Más rápido, pero es reembolsar (y la API de
   devoluciones es el riesgo abierto más grande, `R-MP-01`).

#### C15-b. ¿El súper admin puede cancelar una migración ya anunciada?

1. **Sí, para los que todavía no se aplicaron, con correo «ya no cambia nada».** *Recomendada*: barato y
   evita quedar atado a un error de anuncio.
2. No: una vez anunciada, sigue.

### 5. Tamaño

**Grande**: decisión nueva, transición nueva, tabla nueva, superficies y avisos. Es el único punto de mi
alcance que **agrega** mecanismo.

---

## N2 · ¿Mantenemos qzpay?

### Qué decidió el diseño

`DEC-ARCH-004` (`LOG:2121-2211`), elegida por el owner el 2026-09-18:

- *«Se implementa de nuestro lado todo lo que se pueda»*; *«`qzpay` se absorbe. Deja de ser un paquete
  externo»*; *«un package del monorepo concentra el dominio de billing»*; API definida por lo que Hospeda
  necesita; adaptador intercambiable con guard (`G12`, condición A) y falso en memoria (condición B).
- Cifras: qzpay ~62.500 líneas en 9 paquetes; Hospeda usa **6 de 261 símbolos**; **ningún otro consumidor**;
  19 FK de hospeda hacia qzpay.
- `DEC-METH-007` (`LOG:2918-2920`): *«`DEC-ARCH-004` ya condenó todo lo que cuelga de qzpay, y el modelo
  nuevo es otro modelo»*. `$B/descomposicion.md:803-805` y `$B/spec.md:314`: *«salvo `qzpay`… se absorbe»*.

### Qué significa en concreto (mi lectura, con evidencia)

- **Se reescribe, no se copia.** «Absorber» leído junto con `DEC-METH-007` (filtro 1: sobrevive sólo lo
  cuyo sujeto sobrevive) y `DEC-MIG-003` (no se migra ninguna fila, `LOG:2737`) significa: el billing nuevo
  se escribe en un package propio contra las ocho capacidades del capítulo 06; qzpay no se importa ni se
  pega.
- **Se deja de depender de `@qazuor/qzpay-*`.** Hoy hay 10 dependencias en 5 `package.json` de hospeda2
  (`apps/api`, `apps/admin`, `packages/billing`, `packages/db`, `packages/service-core`). Después del corte,
  ninguna.
- **Hay una frase vieja en `DEC-ARCH-004`**: la implicación 5 (`LOG:2197-2199`) dice que se absorbe *«el 2 %
  del motor que se usa, más los modelos de las 27 tablas»*. Con `DEC-MIG-003` y el modelo nuevo, **los modelos
  de las 27 tablas tampoco se absorben**. Hay que ponerle un 📌: si no, un implementador la lee como permiso
  para portar el esquema de qzpay.

### Qué partes de qzpay sirven como referencia y cuáles no

- **Sirven, como lectura (no como código a copiar)**: el adaptador de Mercado Pago
  (`QZ/packages/mercadopago/src`, ~4.160 líneas): cómo se arma el cuerpo de un preapproval
  (`subscription.adapter.ts:54-75`, `:273-274`), cómo se lee `data.id` de la URL y se verifica la firma
  (`webhook.adapter.ts:100`, `:165`; el esquema HMAC lo cerró `EX-13`), `expire` de una `Preference`
  (`EX-42`), el mapeo de errores de devolución. Cada cosa que se reuse tiene que pasar el filtro 2 de
  `DEC-METH-007` (confianza demostrable: un test que falla si se rompe, contra una fila de la matriz).
- **No sirven**: `core` (22.611 líneas: el motor de servicios, trials delegados a MP, que `D12`/`G11`
  prohíben), `drizzle` (14.762: el esquema de 27 tablas y sus seis repartos), `hono`, `react`, `nestjs`,
  `stripe`, `cli`, `dev`. Tampoco el concepto `productDomain` (el último commit de qzpay, `7240dca`, *«require
  a productDomain when creating a plan»*, es trabajo sobre lo que C3 elimina).
- **El e2e actual depende de qzpay**: `H2/apps/api/test/e2e/helpers/mp-stub.ts` está tipado contra
  `QZPayMercadoPagoAdapter`; muere con él y lo reemplaza el falso de B1.

### Qué implica para `QZ` (el repo)

Sigue haciendo falta **hasta el corte**, porque el sistema viejo corre en producción con él (y quizás la
herramienta del corte, según C2-a). Después, no tiene consumidor.

### Recomendación y sub-pregunta

#### N2-a. ¿Qué se hace con qzpay?

1. **Congelarlo ya (sólo arreglos que bloqueen producción del sistema viejo), y el día del corte más el soak:
   archivar el repo en GitHub y marcar `deprecated` los paquetes en npm.** *Recomendada*. Costo cero; saca
   la tentación de seguir invirtiendo (hay commits recientes para `productDomain`). Riesgo: ninguno, no hay
   otros consumidores (medido).
2. Mantenerlo vivo como librería genérica. Contra `DEC-ARCH-004` (*«no hay reuso»*) y cuesta mantenimiento.
3. Borrarlo. Pierde la referencia que sí sirve para escribir el adaptador nuevo.
Y un **guard** en el repo del paraguas (como `G8` con `commerce`): falla si aparece `@qazuor/qzpay` en un
`package.json` o un import. Sin él, un agente que no encuentra una utilidad la instala de vuelta.

**Tamaño**: chico en el diseño (un 📌 y un guard); el trabajo de verdad ya está en B1–B13.

---

## N3 · E2E para reducir el smoke manual

### Qué dice hoy el diseño

- Cuatro capas (`$B/docs/20-testing.md:27-34`): dominio con falso, guards, sandbox, **E2E: *«los flujos
  críticos que hoy requieren smoke manual»***. §5 (`:525-551`) enumera siete flujos de billing; `V/20` §5
  suma el trial completo (`$V/docs/20-testing.md:375-378`).
- *«Lo que E2E no reemplaza es el smoke contra el proveedor real… un E2E que corre contra el stub hereda
  esa divergencia entera»* (`:550-551`). Regla transversal: ninguna aserción sobre un código de estado
  (`:555-565`).
- `DEC-TEST-001` (`LOG:4133`) y `DEC-TEST-002` (`LOG:4954`) son de guards, no de e2e. Regla de terminación:
  una unidad no termina sin sus guards escritos y rotos a propósito (`$V/descomposicion.md:476-484`).

### Qué hay hoy en hospeda2

- **56 flujos e2e de billing en vitest, en proceso** (`H2/apps/api/test/e2e/flows/billing/`), con un stub de
  MP que **se porta bien** (`helpers/mp-stub.ts`, 485 líneas) y webhooks firmados a mano.
- **Playwright contra builds reales** (`H2/apps/e2e`, SPEC-092), con Mailpit, `mp-webhook-helper.ts` y
  `qzpay-test-control`; 33 specs tocan algo de billing.
- **Suite de sandbox** aparte (`apps/api/test/e2e/sandbox`), manual o nocturna.
- **Smoke manual obligatorio** para todo PR de billing, y de producción para el núcleo (`CLAUDE.md`
  «Billing testing — manual smoke checklist required»); el checklist tiene 1.719 líneas y 61 secciones
  (`.qtm/specs/SPEC-143-…/docs/staging-smoke-checklist.md`).

### Qué haría falta para que el e2e reemplace la mayor parte del smoke

1. **El falso de C13 como servidor HTTP**, no como mock en proceso: así los builds reales (API, web, admin)
   le hablan igual que a MP, y el e2e de Playwright ejercita las mentiras (enlace roto, aviso tarde o
   duplicado, «ok» que no aplica).
2. **Un reloj controlable** para el sistema entero: grace de 10 días, pausa de meses, trial, retención de 90
   y 180, avisos a 30 y 7 días. Sin eso, los flujos que el smoke hoy «espera» no se pueden automatizar.
3. **Correo capturado** (Mailpit ya está) con aserciones sobre el contenido de `B/19` §4 y sobre el orden
   «nuestro correo antes del de MP».
4. **Cada flujo de §5 como spec de Playwright con criterio de aceptación**, y un mapa «sección del
   checklist manual → spec que la reemplaza». Lo que queda sin spec sigue manual.
5. **La batería de C13** reemplaza la parte del smoke que en realidad verificaba «MP sigue portándose así».

### Qué no puede reemplazar (MP real)

- El checkout alojado de MP (página, carga de tarjeta, 3DS, el enlace que MP devuelve) y lo que ve Juan ahí.
- Los correos que MP le manda al cliente (`EX-3`).
- La caché del borde y la revalidación en Cloudflare; el horario real de los crons y de los lotes de cobro.
- **Rechazos y devoluciones en sandbox no se pueden fabricar** (`PA-4`: los siete titulares de rechazo dan
  `402`; devoluciones `401` en sandbox): para eso ni el smoke de staging sirve hoy; sólo el e2e con el falso
  y la batería mensual en producción.

### Qué cambia en la planificación

- `$B/docs/20-testing.md` §5: agregar los cinco requisitos de arriba y la tabla «qué sigue manual».
- **Regla de `CLAUDE.md` (decisión del owner)**: hoy exige smoke de staging a todo PR de billing. Propuesta:
  en el sistema nuevo, **e2e verde + batería verde** alcanzan para PRs de billing, y el smoke manual queda
  para la lista de «no reemplazable» y para el corte. Sub-pregunta:

#### N3-a. ¿Se recorta la regla del smoke manual cuando el e2e cubra un flujo?

1. **Sí, sección por sección: cada sección del checklist que tenga su spec e2e sale del manual.**
   *Recomendada*: el ahorro llega de a poco y cada recorte tiene evidencia.
2. Todo de una cuando el sistema nuevo salga. Más rápido, más riesgo.
3. No se recorta. El e2e suma pero no ahorra (lo contrario de N3).

**Tamaño**: **mediano** en diseño (un capítulo y una regla de proceso); **grande** en construcción (el falso
HTTP y el reloj son infraestructura, van con B1 y con la unidad que tenga el e2e).

---

## N4 · Releer a Mercado Pago ante cualquier aviso y antes de decidir

### Qué dice hoy el diseño

**Ya está, y es la regla más repetida del diseño**:

- Invariante **`D17`** (`$D/nucleo/04-invariantes.md:144`, pedido del owner del 2026-09-24): *«Lo que dice el
  proveedor no se escribe ni se actúa sin releerlo por id»*, con cuatro entradas: el webhook es un aviso
  y se relee; la mutación nuestra se confirma releyendo (`D5`, `:132`); **un job de nuestro reloj le pregunta
  antes de actuar** (`S3`, `S6`, `A3`); **un acto del cliente cuya condición depende de ese estado** (`S1`).
- `$B/docs/03-maquinas-de-estado.md` §10.1 (`:2757-2762`): *«Nunca se escribe el estado que trae el evento… se
  relee el recurso por su id»*, con la tabla de pares (`:2774-2830`).
- Regla 2 de las unidades de billing (`$B/descomposicion.md:107-111`) y `$B/docs/20-testing.md` §6.

### Qué agrega el pedido del owner

Dos cosas que el repo no tiene:

1. **Que sea estructural, no una frase**: ningún guard vigila `D17` hoy (la lista de guards de
   `$B/docs/20-testing.md:48-68` no lo tiene).
2. **El alcance «antes de cualquier decisión»**: las acciones administrativas que dependen del estado en MP
   (devolver, revocar, asentar un pago de afuera, migrar de C15) no están enumeradas en `D17`; y las
   pantallas (Mi Suscripción) muestran el estado local, no releen.

### Qué hay que cambiar

- **📌 en `D17`**: agregar la quinta entrada, «toda acción administrativa que mueve plata o estado relee antes
  de actuar», y decir explícito que **mostrar** no es decidir (las pantallas leen lo local).
- **Guard por tipos, con B1**: el parser del aviso devuelve sólo `{ recurso, id, versión }` (sin estado); y las
  funciones de transición sólo aceptan una «lectura del proveedor» que produce `leerPorId`. Así «decidir desde
  el aviso» no compila. Y un guard estático que falle si un handler de webhook lee `status` del cuerpo.
- **N9 lo refuerza**: si todo aviso sólo dispara una relectura por id, **un aviso IPN sin firma no puede hacer
  daño** (lo peor que logra es que releamos). Eso habilita aceptar los dos canales.

**Tamaño**: **chico/mediano** (un 📌, un guard, un requisito de tipos en B1).

---

## N5 · Repartir la construcción entre Codex y OpenCode (GLM/DeepSeek), con Claude sólo coordinando

### Qué dice hoy el diseño y el contexto

- **22 unidades** (V1–V9, B1–B13) con dependencias, guards por unidad y «qué tiene que dejar demostrado»
  (`$V/descomposicion.md` §2–§4, `$B/descomposicion.md` §2–§4). La demostración es **una pregunta que alguien de
  afuera tiene que poder contestar** (`$V/descomposicion.md:478-479`), no un comando.
- **Cada ficha de unidad y el tablero son artifacts de claude.ai** (`$V/descomposicion.md:537-557`).
- El plan de OpenCode (`H2/docs/migration/opencode-gentle-ai-plan.md`, sin trackear): OpenAI para lo complejo,
  GLM/DeepSeek/Kilo para lo simple *«con límites de datos, costo y riesgo»* (`:18-19`), OpenKilo *«nunca para
  secretos, Linear sensible ni producción»* (`:304`, log `:141`); `AGENTS.md` corto como fuente de OpenCode
  V2, que **no lee `CLAUDE.md`** (log `:163-167`); `hops` sigue siendo dueño de worktrees, DB y puertos
  (`:187-199`); Task-master no migra al principio (`:23`). El log registra OpenCode 2.0.3 y Gentle-AI 2.9.0
  instalados el 2026-09-14 (`:55-106`).
- El diseño completo son ~27.500 líneas sólo en los archivos normativos principales (el log solo, 6.237).

### Qué cambia en la planificación

1. **Las fichas tienen que vivir en el repo, no en claude.ai.** Un agente de Codex u OpenCode no puede leer un
   artifact privado. Propuesta: `.specs/HOS-1353-…/unidades/V1.md` … y `.specs/HOS-1354-…/unidades/B1.md` …,
   generadas desde la descomposición.
2. **Fichas autosuficientes y chicas**: una ficha no puede decir «leé `B/03`» (un capítulo de 2.800 líneas no
   entra con holgura en el contexto de GLM/DeepSeek). Tiene que traer **las filas y secciones exactas**
   (transiciones por id, invariantes por id, filas de matriz), el contrato como **tipos TypeScript ya
   commiteados** (el contrato de cobertura y la interfaz de las ocho capacidades, escritos primero y en código:
   un objetivo que compila), qué archivos puede tocar y cuáles no, y los guards de su columna.
3. **Criterios de aceptación ejecutables**: cada «qué tiene que dejar demostrado» se convierte en comandos
   (`pnpm --filter … test -- <patrón>`, el guard, y **el caso que rompe el guard y tiene que ponerlo rojo**).
   El coordinador los corre él mismo: no le cree al informe del agente (en memoria hay precedentes de agentes
   que informan commits no pusheados y procedencias inventadas).
4. **Una regla de escalamiento**: el implementador no edita el diseño; si encuentra una contradicción, frena y
   la reporta. Va en la ficha y en el `AGENTS.md` del paraguas.
5. **Qué va a quién** (propuesta):

   | tipo de trabajo | agente | por qué |
   |---|---|---|
   | plata y concurrencia: B1 (adaptador + falso), B3, B5, B6, B7, B8, B11, el contrato (V4/B4) | **Codex (OpenAI)** | el plan ya reserva OpenAI para lo complejo; es donde un error es un doble cobro |
   | bien especificado y mecánico: B2, V1, guards como scripts, data-migrations del catálogo, i18n y textos de superficies (B13, V-superficies), scaffolding de tests | **OpenCode con GLM/DeepSeek** | tareas acotadas, con aceptación ejecutable, sin secretos |
   | coordinar, atomizar, revisar, mergear, Linear, correr aceptación | **Claude** | lo que pidió el owner |
   | revisión adversarial de cada PR | **un modelo de otra familia** que el que implementó | los errores de un modelo los repite un juez del mismo modelo |

6. **Nada de credenciales de MP de producción en ningún agente.** La batería mensual (C13) y el corte los opera
   una persona.
7. **Un worktree por unidad** con `hops`, y unidades paralelas sólo si el grafo lo permite (`§3` de cada
   descomposición).
8. **Codegraph**: el índice es del clone principal (lo dice `CLAUDE.md` global); para agentes externos no está
   garantizado (el plan lo deja «a evaluar», `:274-287`). Las fichas no pueden depender de él.

### Sub-pregunta

#### N5-a. ¿Quién escribe las 22 fichas del repo?

1. **Claude, como primera tarea de coordinación, antes de repartir nada; cada ficha revisada por el owner en
   tanda.** *Recomendada*: es trabajo de síntesis sobre un diseño que Claude ya recorrió; hacerlo con GLM
   arriesga fichas que resumen mal.
2. Cada agente arma la suya al arrancar. Más rápido, pero cada uno lee el diseño a su manera.
Ejemplo: la ficha de B7 trae `S4`–`S7` y `S19` copiadas, `DEC-SUB-019`, `DEC-MP-008`, las filas `GR-1`/`GR-3`,
el comando que corre sus tests y el que rompe su guard; Codex la implementa sin abrir `B/03`.

**Tamaño**: **mediano**, de proceso. No cambia el diseño; cambia la forma de las fichas y el tablero.

---

## N8 · Cancelar o pausar desde Mercado Pago, no desde Hospeda

### Qué dice hoy el diseño

- **Se detecta, por dos caminos**: el aviso de MP dispara una relectura por id (`$B/docs/03-…` §10.1), y el
  **barrido diario relee por id toda fila no terminal** (`$B/docs/09-conciliacion.md:157-165`, `:918-924`). O sea:
  a más tardar al día siguiente. (Con la salvedad de N9: si MP avisara esto sólo por IPN, queda sólo el barrido.)
- **Cancelación**: el par `cancelled` × estado vivo sin baja programada → *«espejar la baja decidida por el
  proveedor»* (`$B/docs/03-…:2798`), que lleva la fila a **`CANCELLED` en el acto**. `B/12` §1.4
  (`$B/docs/12-suscripcion.md:110-146`) lo escribió para la baja **del proveedor** (mora, antifraude, *«una
  cancelación desde su panel»*) y dice que recuperarlo *«exige re-autorizar desde cero»*.
- **Pausa**: el par `paused` × `ACTIVE`/`GRACE_PERIOD` → **`S6` por su segundo evento**, porque se asume que
  toda pausa del proveedor es **por mora** (`DEC-MP-008`, `LOG:5474`; `$B/docs/03-…` tabla del §10.1). `S6`
  suspende, cancela la autorización y avisa *«volvé a suscribirte»*.
- **Qué ve Juan**: no hay fila de aviso en `$B/docs/19-superficies.md` para «cancelaste desde Mercado Pago»
  (revisé las filas 3 a 22). Le llega sólo el correo de MP.
- **¿Está medido?** **No.** Ninguna fila de la matriz mide una acción del pagador desde su cuenta de MP. Lo más
  cercano es la pregunta abierta de si el cliente puede cambiar la tarjeta desde MP sobre una pausada
  (`$D/nucleo/00-indice.md:159-164`, `RN-3`). `EX-3` mide qué le escribe MP al cliente cuando **nosotros**
  cancelamos o pausamos.

### Los huecos

1. **Juan pierde lo que pagó.** Si paga el 1 y el 10 se da de baja **desde Hospeda**, sigue hasta el 30
   (`DEC-SUB-009`). Si lo hace **desde la app de MP**, el espejo lo corta el 10: fichas abajo esa noche, 20 días
   pagados perdidos. El mismo acto de Juan tiene dos resultados según el botón.
2. **Una pausa del pagador (si MP la permite) se trataría como mora**: suspensión, autorización cancelada y
   «volvé a suscribirte», para alguien que no debe nada. Hay una señal para distinguirlas: en la mora hay
   intentos rechazados en el ciclo (`GR-3`, `/authorized_payments/search`); en una pausa voluntaria, no.
3. **Sin aviso nuestro**: Juan no sabe qué pasa con sus fichas.

### Qué hay que cambiar

- **Fila nueva de matriz (`EX-5x`)**: con un comprador de prueba en sandbox, desde la cuenta de MP del
  comprador: ¿puede cancelar?, ¿puede pausar?, ¿puede cambiar la tarjeta?; ¿qué aviso llega y **por qué canal**
  (IPN y Webhooks, ver N9)?; ¿qué campo del preapproval distingue quién lo hizo? Sin esto, lo de abajo es
  especulativo.
- **Decisión del owner** sobre la cancelación (N8-a) y sobre la pausa (N8-b), con 📌 en `B/12` §1.4 y en
  `DEC-MP-008`.
- **`B/19`**: fila nueva, «tu suscripción se canceló desde Mercado Pago», con qué pasa con sus fichas y hasta
  cuándo.
- **Unidades**: B8 (la baja) o B11 (el espejo); B13 (el aviso).

### Sub-preguntas para el owner

#### N8-a. Juan se da de baja desde Mercado Pago a mitad de un mes pagado. ¿Qué pasa?

1. **Lo mismo que si se diera de baja en Hospeda: `CANCEL_SCHEDULED` con el período pagado, y le avisamos.**
   *Recomendada*: mismo acto, mismo resultado; ya existe el camino (es el que el espejo usa cuando la
   cancelación fue nuestra y perdió la escritura, `$B/docs/03-…:2798`). Costo: distinguir «baja del pagador»
   de «baja del proveedor»; si MP no da un campo, el criterio es «sin mora ni contracargo en curso». Riesgo:
   que un antifraude se lea como baja voluntaria y le demos días; es plata chica y el servicio ya estaba pagado.
2. Dejarlo como está (`CANCELLED` en el acto). Simple; injusto para Juan y posible reclamo.
3. Marca para una persona. Seguro, pero cada baja desde MP es trabajo manual.

#### N8-b. Si MP le deja pausar a Juan desde su cuenta, ¿qué hacemos?

1. **Medir primero (`EX-5x`); si se puede, espejarla como pausa del cliente (`S8`) cuando no hay intentos
   rechazados en el ciclo, y como mora (`S6`) cuando los hay.** *Recomendada*.
2. Tratar toda pausa leída como mora (lo de hoy). Le suspende la cuenta a quien sólo pausó.

**Tamaño**: **mediano** (una medición, dos decisiones, un aviso, una bifurcación en el espejo).

---

## N9 · El query string en la URL de notificaciones

### Dónde está y qué filtra

- **No lo agrega qzpay: lo agrega hospeda2.** qzpay pasa la URL tal cual (`QZ/packages/mercadopago/src/adapters/subscription.adapter.ts:273-274`,
  `checkout.adapter.ts:190-193`; en `QZ` no aparece `source_news`). En hospeda2:
  `buildNotificationUrl()` devuelve `…/api/v1/webhooks/mercadopago?source_news=webhooks`
  (`H2/apps/api/src/routes/billing/checkout-return-urls.ts:178-180`, HOS-159), y la URL del panel de la
  aplicación también lo lleva (`$D/mp-probes/RESULTS-2026-09-15.md:196`).
- **Filtra del lado nuestro, no del lado de MP.** El router **descarta con `200`** toda entrega que no traiga
  `source_news=webhooks`, con un log de nivel `debug` (`H2/apps/api/src/routes/webhooks/mercadopago/router.ts:207-227`).
  Las entregas **IPN** (`?id=…&topic=…`) llegan sin el marcador (medido en producción,
  `RESULTS-2026-09-15.md:1634-1636`) y mueren ahí. El objetivo era sacar el ruido de firmas inválidas del
  canal IPN duplicado (`router.ts:70-99`).
- **Víctimas conocidas**: antes de HOS-159, **todos** los avisos de suscripción que MP mandaba al
  `notification_url` se descartaban (`checkout-return-urls.ts:169-177`); y las `Preference` de Checkout Pro
  **sólo avisan por IPN**, así que su pago nunca entra por aviso (HOS-710, `H2/apps/api/src/services/addon.checkout.ts:79-90`).
- Dato que importa: el `notification_url` por preapproval **no se guarda** (vuelve `null`,
  `RESULTS-2026-09-15.md:202-205`); manda la URL de la aplicación.

### ¿Estaba en las mediciones?

- **Sandbox (sondas 08/09, el receptor propio)**: el Worker guarda **todo** lo que recibe, sin filtrar
  (`$D/mp-probes/probe-08-webhook-sink/worker.js:24`, `:112-113`), y la URL era
  `https://hos1352-webhook-sink.qazuor.workers.dev` sin query (`$D/03-handoff.md:1931`). **El descarte no
  actuó ahí.** Pero el receptor sólo vio **el canal que apuntaba a él** (la URL de Webhooks de la aplicación);
  si la app de prueba tenía IPN configurado a otro lado, lo que MP mande **sólo por IPN** no llegó al receptor.
  Eso no está registrado.
- **Producción (`billing_webhook_events`)**: se lee **después** del descarte. Todo «no llegó» medido ahí
  puede ser «llegó por IPN y lo tiramos».
- `RF-7` (tres entregas por devolución) se leyó de los logs de acceso, **antes** del descarte: limpio.

### Qué hallazgos pueden estar contaminados

| hallazgo | fuente | ¿contaminado? |
|---|---|---|
| `WH-5`, mitad producción: *«2 de 2 cancelaciones por antifraude no produjeron `subscription.updated` y no están en el dead-letter»* (`$D/06-mp-validation-matrix.md:269`) | `billing_webhook_events` | **Sí, posible.** Hay una tercera explicación además de «pérdida» o «no se notifica»: llegó por IPN y el router la descartó en `debug`. |
| `EX-15`: *«mutar el monto NO emite ninguna entrega»* (`:335`) | receptor de sandbox, sólo canal Webhooks | **Dudoso.** Es «no emite por Webhooks». Si emite por IPN, el diseño igual está bien (relee), pero la frase es más fuerte que la medición. |
| `WH-1`…`WH-4`, mecánica de `WH-5` en sandbox | receptor propio | No por el filtro; sí acotado a un canal. |
| los positivos de producción de `WH-5` (32 ciclos, 26 pagos, 5 pausas recibidos) | `billing_webhook_events` | No: lo que llegó, llegó. |
| `RF-7` | logs de acceso | No. |
| cancelación del pagador desde MP (N8), cobro por `/v1/orders` | sin medir | Sin dato: hay que medir con los dos canales. |

### ¿Hay que medir de nuevo? Sí, acotado

- **Fila nueva `WH-6`**: *«¿Qué entrega MP por el canal IPN que no entrega por Webhooks?»*. En sandbox: apuntar
  **las dos URLs** de la aplicación de prueba (IPN y Webhooks) al receptor, con una marca por canal en la
  ruta; repetir la secuencia de la sonda 09 (crear, mutar monto, pausar, reanudar, cancelar) con 90 s entre
  acciones; sumar una cancelación **por el comprador desde su cuenta** (N8) y un pago por `/v1/orders`.
- **Re-abrir `EX-15`** con el resultado (si por IPN hay aviso de mutación, la fila se reescribe).
- **Re-abrir la sub-medición antifraude de `WH-5`**: provocar una cancelación por antifraude a propósito
  (la fila ya decía *«hace falta repetirlo a propósito»*) con los dos canales escuchando. Antes, un intento
  barato: buscar en los logs de acceso de producción de esa ventana si hubo `POST …?id=…&topic=preapproval`
  (lo más probable es que la retención ya los haya borrado).
- La batería de C13 escucha los dos canales desde el primer día.

### Qué implica para el diseño

- **El handler nuevo (paso 4b del corte) no tiene que copiar el descarte.** Como todo aviso sólo dispara una
  relectura por id (N4, `D17`), **un aviso IPN no firmado no puede escribir nada**: lo peor que logra un
  tercero es que releamos. Propuesta: aceptar los dos canales como disparadores, deduplicar por
  `(recurso, id)` en una ventana corta, releer. Eso cierra además el hueco de HOS-710 para cualquier cobro de
  una vez. Hay que escribirlo en `$B/docs/06-proveedor.md` (hoy sólo cuenta las tres entregas de `RF-7`,
  `:230-233`) y en `B/03` §10.1.

#### N9-a. ¿Qué hace el handler nuevo con un aviso IPN?

1. **Lo acepta como disparador de relectura, sin firma, deduplicado.** *Recomendada*: no pierde avisos y no
   abre riesgo porque el aviso nunca es la fuente. Costo: ~3 entregas por hecho (`RF-7`) de relecturas extra;
   con la cartera de Hospeda es nada.
2. Lo descarta como hoy. Mantiene el punto ciego.
3. Lo registra sin actuar (para medir) y decide después de `WH-6`.

**Tamaño**: **mediano**: una fila nueva, dos re-aperturas, una decisión del handler.

---

## Choques con otras decisiones vigentes

1. **C15 vs `B/10` §3.4**: *«no se programa una migración automática»* contra una migración que se aplica
   sola en cada renovación. Se resuelve con un 📌 (lo automático es la aplicación, no la decisión).
2. **C15 vs `DEC-SUB-007`**: el upgrade elegido re-autoriza; la migración que sube el precio muta el monto.
   No es contradicción (una es inmediata y la otra en la renovación), pero hay que escribirla como tercer camino.
3. **C2 vs `$D/16:124-125` y `:254-261`**: la herramienta del corte vive hoy en el código viejo y usa qzpay.
   Choca con C2 si se lee a la letra y con N2 (dependencia de qzpay).
4. **C2 vs el flujo de ramas de `CLAUDE.md`** (`staging → main`): sin interruptores, lo que entra a `staging`
   sale en la próxima promoción. Hay que elegir C2-b.
5. **N8 vs `DEC-SUB-009`**: la misma baja da dos resultados según el botón.
6. **N8 vs `DEC-MP-008`**: «toda pausa del proveedor es mora» deja de ser cierto si el pagador puede pausar.
7. **N9 vs `EX-15` y `WH-5`**: dos filas `VERIFIED` que pueden ser más fuertes que su medición.
8. **N2 vs `DEC-ARCH-004` implicación 5**: frase vieja que habilita portar el esquema de qzpay.

## Resumen final

Ocho puntos y tres preguntas medidos. **C8 es la simplificación grande**: cae el acto entero de discontinuar
(cuatro decisiones, `S25`–`S28`, `vertical_discontinuation`, `admite_altas`, la acción 16, `D14`, un hecho del
reloj y dos entradas del contrato, con lo que el contrato deja de tener dirección de ida). Son unas 850 líneas
dedicadas más ~300 menciones, y ninguna fila de matriz. **C15 es lo único que agrega mecanismo.** **N9**
encontró que el filtro no es de qzpay sino de hospeda2, que tira en silencio todo lo que llega por IPN, y que
eso contamina al menos la parte de producción de `WH-5`: hace falta una fila nueva (`WH-6`) que escuche los dos
canales. **N8** muestra dos huecos (baja desde MP pierde lo pagado; pausa desde MP se lee como mora) y nada
medido. **N4 ya está** (`D17`) y sólo pide volverse guard. **N2**: reescribir en un package propio, qzpay sólo
como referencia, archivarlo después del corte. **N5**: las fichas tienen que bajar del artifact al repo,
autosuficientes y con aceptación ejecutable.

## Key Learnings

1. El descarte de avisos IPN (`?source_news=webhooks`) es código de hospeda2 (router del webhook, HOS-159), no de qzpay; qzpay pasa `notificationUrl` tal cual.
2. Toda medición de «el aviso no llegó» leída de `billing_webhook_events` en producción está aguas abajo de ese descarte; el receptor propio de sandbox no filtra, pero sólo escucha el canal que apunta a él.
3. Con la regla `D17` (el aviso sólo dispara relectura por id), aceptar IPN sin firma no tiene riesgo de escritura; el descarte deja de tener razón de ser en el sistema nuevo.
4. El espejo de `cancelled` sin baja programada corta el servicio en el acto; una baja del pagador desde MP pierde lo pagado, a diferencia de la baja desde Hospeda (`DEC-SUB-009`). No hay fila de matriz para acciones del pagador desde MP.
5. `DEC-MP-008` asume que toda pausa leída del proveedor es mora; si el pagador puede pausar desde MP, se le suspendería la cuenta.
6. C8 elimina la única pregunta de ida del contrato (`finDeServicio`) y con ella `situaciónDeVertical`: el contrato vuelve a ser de una sola dirección para consultas.
7. `DEC-ARCH-004` implicación 5 («se absorben los modelos de las 27 tablas») quedó vieja con `DEC-MIG-003`; «absorber qzpay» en la práctica es reescribir.
8. Las fichas de las 22 unidades y el tablero viven como artifacts de claude.ai: un agente de Codex/OpenCode no las puede leer; hay que bajarlas al repo.
9. La tabla de mentiras del falso en el repo (15 filas) no coincide con la lista cerrada de 13 del artifact; seis filas del repo son reglas del contrato, no mentiras.
10. Sin interruptores, el paraguas en la rama `staging` bloquea toda promoción `staging → main` hasta el corte; el ítem `rollout` de la FASE 7 no lo escribe.
