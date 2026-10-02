# 90 · Retirados

Todo ítem de las fuentes que **murió**: una decisión `SUPERSEDED`, un 📌 que la adjudicación dio por
muerto o que cayó con su decisión, una fila tachada o marcada *retirada*, un paso que *sale* y la
letra del owner que otra reemplazó. Cada uno lleva su ancla, su `Origen:` (la posición del ítem en
el SHA congelado, más la de la evidencia de su muerte) y **por qué murió**. **Nada de acá se
implementa**: está para que nadie lo «corrija» de vuelta ni lo reescriba sin saber que ya existió.

Fuentes de la muerte: el inventario (`estado` `SUPERSEDED` o `MUERTO`) y la adjudicación (veredicto
`MUERTO`) de `_trabajo/`. Son 40 ítems.

## Decisiones `SUPERSEDED`

<a id="dec-sub-001"></a>

### DEC-SUB-001 — Subir es inmediato, bajar de tier espera, tocar el ciclo se aplica ya

- **Por qué murió**: `SUPERSEDED` por [DEC-SUB-005](#dec-sub-005), que a su vez quedó `SUPERSEDED` por
  [DEC-SUB-006](01-decisiones-vigentes.md#dec-sub-006). Lo vigente sobre cambios de plan y de ciclo
  es `DEC-SUB-006` y las que la precisan.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:320, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:322

<a id="dec-sub-003"></a>

### DEC-SUB-003 — Cambiar de plan en grace está permitido, y es el camino de recuperación

- **Por qué murió**: `SUPERSEDED` por [DEC-SUB-021](01-decisiones-vigentes.md#dec-sub-021)
  (2026-09-25): en grace no se cambia de plan; el camino de recuperación es cambiar la tarjeta.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:729, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:731

<a id="dec-sub-005"></a>

### DEC-SUB-005 — El cambio de ciclo se hace cancelando y recreando, no mutando

- **Por qué murió**: `SUPERSEDED` por [DEC-SUB-006](01-decisiones-vigentes.md#dec-sub-006)
  (2026-09-16).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:994, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:996

<a id="dec-mig-004"></a>

### DEC-MIG-004 — La población de producción se resuelve por teléfono, no por diseño: es del owner y está cerrada

- **Por qué murió**: `SUPERSEDED` por [DEC-MIG-007](01-decisiones-vigentes.md#dec-mig-007)
  (2026-09-30, FASE 5, simplificación del corte, con OK del owner, lote E;
  `38-fase-5/20-simplificacion-del-corte.md` §11, S-56 y S-77): su mecanismo humano —el owner les
  habla a los suyos, por privado, y les pide que se vuelvan a suscribir— es la premisa 4 de
  `DEC-MIG-007`; los defectos #15 y #16, el umbral de unas veinte personas y el punto 4 de su 📌 (el
  límite del día 180 de la agenda de llamados) quedan sin sujeto. Sus dos 📌 mueren con ella
  ([DEC-MIG-004#📌1](#dec-mig-004-p1), [DEC-MIG-004#📌2](#dec-mig-004-p2)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3395, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3397

<a id="dec-sub-015"></a>

### DEC-SUB-015 — La suscripción pausada NO entra al piso de una vertical discontinuada: se le avisa, y al volver elige plan nuevo

- **Por qué murió**: `SUPERSEDED` (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se
  diseña entonces, y este texto queda como punto de partida. Sin decisión que la reemplace.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4300, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4302

<a id="dec-grant-010"></a>

### DEC-GRANT-010 — La cortesía sobre una vertical discontinuada se difiere; su re-emisión puede no llegar, y eso queda declarado

- **Por qué murió**: `SUPERSEDED` (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se
  diseña entonces, y este texto queda como punto de partida. Sin decisión que la reemplace.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4640, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4642

<a id="dec-sub-018"></a>

### DEC-SUB-018 — La suscripción SUSPENDIDA no entra al piso de una vertical discontinuada: va a `CANCELLED`

- **Por qué murió**: `SUPERSEDED` (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se
  diseña entonces, y este texto queda como punto de partida. Sin decisión que la reemplace.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5368, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5370

<a id="dec-arch-011"></a>

### DEC-ARCH-011 — Una vertical que deja de admitir altas deja de admitir suscripciones, y su fin de servicio invalida el caché de la vertical entera

- **Por qué murió**: `SUPERSEDED` (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se
  diseña entonces, y este texto queda como punto de partida. Sus dos 📌
  ([DEC-ARCH-011#📌1](#dec-arch-011-p1), [DEC-ARCH-011#📌2](#dec-arch-011-p2)) mueren con ella.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6722, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6724

## 📌 muertos

<a id="dec-arch-006-p4"></a>

### DEC-ARCH-006#📌4 — `finDeServicio` y `vertical_discontinuation`

- **Qué decía** (FASE 9 vuelta 2, `R5` y `Q-FECHA`): la fecha de fin de servicio de una vertical la
  calcula billing y verticales la pregunta por `finDeServicio`, con la fila `vertical_discontinuation`
  de billing, y `PB2`, el hecho 4 y la invalidación de la vertical los ejecuta el reconciliador
  diario.
- **Por qué murió** (adjudicación, entero): `finDeServicio`, `vertical_discontinuation` y el hecho 4
  salieron con C8 (revisión del owner, 2026-09-28): las verticales no se discontinúan, y la guarda
  `admiteAltas` salió con ella. La decisión viva es
  [DEC-ARCH-006](01-decisiones-vigentes.md#dec-arch-006).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2538, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:151

<a id="dec-arch-006-p5"></a>

### DEC-ARCH-006#📌5 — `PB9` y `finDeServicio`

- **Qué decía** (FASE 9 vuelta 2, verificación, `V2-x` sobre `N-B-03`): `PB9` no borra una ficha de
  una vertical cuya `finDeServicio` ya pasó mientras el reconciliador no escribió el hecho 4, así que
  `finDeServicio` tenía tres lectores en verticales.
- **Por qué murió** (adjudicación, entero): `finDeServicio` y el hecho 4 salieron con C8.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2546, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:151

<a id="dec-mig-003-p6"></a>

### DEC-MIG-003#📌6 — el Worker del borde que cerraba la ruta de avisos

- **Qué decía** (verificación corta, lote P-A): la ruta de avisos la cerraba un Worker del borde que
  contestaba `500` con una cabecera propia, prendido antes de apagar el contenedor viejo y apagado al
  final del paso 4.
- **Por qué murió** (adjudicación, entero): el Worker del borde salió (FASE 5, simplificación del
  corte, S-45); el propio log lo registra en el 📌 siguiente de
  [DEC-MIG-003](01-decisiones-vigentes.md#dec-mig-003): la ruta de avisos queda abierta durante todo
  el corte, como única excepción de la regla del 0b ([PASO:0b](30-el-corte.md#paso-0b)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3121, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3140

<a id="dec-mig-004-p1"></a>

### DEC-MIG-004#📌1 — la diferencia de la rama de aborto, los defectos #15 y #16 y la agenda del día 180

- **Qué decía** (FASE 9 completa, 2d y 5c): precisiones a `DEC-MIG-004` sobre la diferencia que
  cobraba la rama de aborto, la causa del #15 y el sujeto del #16, el desenlace del #1, la agenda de
  llamados del día 180 y la cita del umbral.
- **Por qué murió**: su decisión está `SUPERSEDED` ([DEC-MIG-004](#dec-mig-004)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3433, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3397

<a id="dec-mig-004-p2"></a>

### DEC-MIG-004#📌2 — nada llega al handler nuevo entre el paso 3 y el 4

- **Qué decía** (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`): las lápidas del corte se sembraban
  antes de apuntar la URL, así que el cobro en vuelo de un id desconocido encontraba su lápida del
  corte.
- **Por qué murió** (adjudicación, entero): la decisión está `SUPERSEDED`, y las lápidas del corte
  salieron (S-40; ver [PASO:4](#paso-4)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3444, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:3397

<a id="dec-mig-005-p1"></a>

### DEC-MIG-005#📌1 — el cobro sobre una lápida del corte, el detector y la pasada del proveedor

- **Qué decía** (FASE 9 vuelta 2, `R2`, `R21` y `R21-b`): el cobro sobre una lápida del corte no se
  devolvía sólo si era del día del corte; un detector corría después del corte; y una pasada de sólo
  lectura sobre el proveedor sumaba a los titulares que sólo conocía el proveedor.
- **Por qué murió** (adjudicación, entero): el propio log lo da por `SUPERSEDED` en un 📌 posterior
  de [DEC-MIG-005](01-decisiones-vigentes.md#dec-mig-005) (S-37, S-41, S-42): salieron la lápida del
  corte, el detector y la pasada del proveedor.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6438, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6471

<a id="dec-mig-005-p2"></a>

### DEC-MIG-005#📌2 — `EX-48` y `EX-50` en el paso 0

- **Qué decía** (FASE 9 vuelta 2, verificación, `V2-a`, `V2-m`, `V2-r`): el día del cobro se leía en
  la fecha del pago que aprobó el registro (`EX-48`), y el paso 0 contaba las anuales vivas del viejo
  (`EX-50`).
- **Por qué murió** (adjudicación, entero): `EX-48` y `EX-50` no se miden (S-57, S-58); el log lo
  registra en el 📌 posterior de [DEC-MIG-005](01-decisiones-vigentes.md#dec-mig-005).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6447, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6471

<a id="dec-mig-005-p4"></a>

### DEC-MIG-005#📌4 — la primera corrida del detector del día siguiente

- **Qué decía** (verificación corta, lote P-B): la primera corrida del detector, el día siguiente al
  corte, listaba los registros de cobro aprobados con un pago del día del corte y sin `payment`.
- **Por qué murió** (adjudicación, entero): el detector del día siguiente salió (S-42); el log lo
  registra en el 📌 posterior de [DEC-MIG-005](01-decisiones-vigentes.md#dec-mig-005).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6457, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6471

<a id="dec-rf-008-p2"></a>

### DEC-RF-008#📌2 — el catálogo con dieciséis acciones

- **Qué decía** (FASE 9 vuelta 2, `Q-ACC16`): el catálogo de acciones administrativas tenía
  dieciséis; la decimosexta era *«discontinuar una vertical»*.
- **Por qué murió** (adjudicación, entero): la acción 16, discontinuar una vertical, salió con C8; el
  log lo registra (*«sale la 16, discontinuar»*). Ver [ACC:16](#acc-16) y la decisión viva
  [DEC-RF-008](01-decisiones-vigentes.md#dec-rf-008).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6524, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6538

<a id="dec-arch-011-p1"></a>

### DEC-ARCH-011#📌1 — las dos mitades del acto, la fecha y la vertical sin planes vendibles

- **Qué decía** (FASE 9 vuelta 2, `R5`, `Q-ALTAS`, `Q-ALTAS-b`, `R24` y `Q-FECHA`): precisiones de
  la discontinuación de una vertical.
- **Por qué murió**: su decisión está `SUPERSEDED` ([DEC-ARCH-011](#dec-arch-011)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6747, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6724

<a id="dec-arch-011-p2"></a>

### DEC-ARCH-011#📌2 — acortar la cola, capa de composición y reintento

- **Qué decía** (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y `V2-i`): la acción 16 era
  *«discontinuar una vertical o acortar su cola»*, de capa de composición, con reintento automático
  de la mitad de billing.
- **Por qué murió**: su decisión está `SUPERSEDED` ([DEC-ARCH-011](#dec-arch-011)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6763, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6724

<a id="dec-mig-006-p1"></a>

### DEC-MIG-006#📌1 — los dos recuentos del paso 0

- **Qué decía** (revisión del owner, casos vecinos, casos 5 y 6): el paso 0 contaba si el viejo
  servía alguna ficha que nacía `PURGED` o en `DRAFT` (y si daba cero, el 4c se salteaba), y cuántos
  dueños tenían más de una ficha a la vista en la misma vertical.
- **Por qué murió** (adjudicación, entero): el log dice que *«su 📌 del 2026-09-29 sale entero»*
  (S-28): el 4c corre siempre, porque el corte borra fichas que el viejo servía, y una ficha por
  cuenta es premisa ([PASO:4c](30-el-corte.md#paso-4c)). La decisión viva es
  [DEC-MIG-006](01-decisiones-vigentes.md#dec-mig-006).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6937, .specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:6952

## Pasos, letras y filas de catálogo

<a id="paso-4"></a>

### PASO:4 — sembrar las lápidas del corte y abrir la ruta de avisos

- **Qué era**: sembrar las lápidas del corte con los ids cancelados y verificados, y abrir en el
  borde la ruta de avisos que cerraba el paso 3.
- **Por qué murió**: **Sale** (FASE 5, owner 2026-09-30, simplificación del corte, C; S-40, S-45):
  **no hay lápidas del corte ni ruta que abrir**. Un cobro tardío de un débito viejo entra por la
  lápida de recepción, como cualquier desconocido (`B/09` §2.4; S-46). Los pasos vivos están en
  [30-el-corte.md](30-el-corte.md#paso-4b).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:155

<a id="own-41-corte-del-mvp-t8-bi"></a>

### BI — quién rechaza la compra de Turista VIP mientras el plan vigente lo hereda

- **Qué era**: la letra del owner que ponía la dueña de ese rechazo en `B5`.
- **Por qué murió**: **reemplazada por BJ: la premisa era errónea, el checkout no es de `B5`**.
  Comprar Turista VIP es elegir un plan de la vertical Turista, es decir `S1` (`B/03` §3.2), y `S1`
  es de `B3` (`B/descomposicion.md` §2.12); `B5` es el registro del dinero y no tiene checkout. Lo
  vigente es [BJ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t8-bj) y el quinto 📌 de
  [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017-p5).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/41-corte-del-mvp/10-decisiones-del-owner.md:123

<a id="dep-8"></a>

### DEP:8 — `B4` y `finDeServicio`

- **Qué era**: la dependencia de **B4** (la implementación real del contrato) sobre `V2` por
  `finDeServicio`.
- **Por qué murió**: **Tachada** (FASE 9 vuelta 2, `R5`): la fecha la calcula billing, así que `B4`
  la lee de `B12` y ya no cruza la frontera. Y después `finDeServicio` salió del contrato con C8
  ([DEP:13](#dep-13)).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:382, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:387

<a id="dep-13"></a>

### DEP:13 — la respuesta real de `finDeServicio`

- **Qué era**: la dependencia de **B12** sobre `V4` por la respuesta real de `finDeServicio`.
- **Por qué murió**: **Tachada** (revisión del owner, 2026-09-28, C8): la pregunta salió del
  contrato, y con ella la única dependencia en que billing contestaba.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:387

<a id="inv-d14"></a>

### INV:D14 — anunciada la discontinuación de una vertical, no se emite un cobro más en ella

- **Por qué murió**: **retirado** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. El número no se reusa.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:141

<a id="inv-d16"></a>

### INV:D16 — el tope de una pausa, en días, es menor que el día del hard delete

- **Por qué murió**: **retirado** (revisión del owner, 2026-09-28, C14, `L1-c`): la pausa pedida por
  el dueño detiene el reloj de retención, así que el tope de pausa ya no tiene que quedar por debajo
  del día del borrado. Lo que lo reemplaza es una pregunta del contrato, `retenciónDetenida`
  (`12-contrato…` §4.1), que releen archivar, borrar y los avisos de retención. El número no se
  reusa, y con él sale su guard, `G-R5`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:143

<a id="trans-v-t7"></a>

### TRANS:V:T7 — `PRE_TRIAL` → `TRIAL_CONVERTED`, por el encendido de la prueba de una vertical

- **Por qué murió**: **retirada** (revisión del owner, 2026-09-28, N7): encender o apagar la prueba
  de una vertical queda fuera de esta versión, y el panel no deja pasar los días de prueba de una
  vertical de 0 a más de 0 ni al revés (`11` §8). Sin encendido no hay disparador. El número no se
  reusa.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:58

<a id="trans-b-s25"></a>

### TRANS:B:S25 — la pausa que termina sobre una vertical discontinuada

- **Por qué murió**: **retirada** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. El número no se reusa.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:175

<a id="trans-b-s26"></a>

### TRANS:B:S26 — la discontinuación sobre `ACTIVE` y `GRACE_PERIOD`

- **Por qué murió**: **retirada** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. El número no se reusa.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:176

<a id="trans-b-s27"></a>

### TRANS:B:S27 — la discontinuación sobre `SUSPENDED`

- **Por qué murió**: **retirada** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. El número no se reusa.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:177

<a id="trans-b-s28"></a>

### TRANS:B:S28 — la discontinuación sobre `PENDING_AUTHORIZATION`

- **Por qué murió**: **retirada** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. El número no se reusa.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:178

<a id="acc-16"></a>

### ACC:16 — discontinuar una vertical o acortar su cola

- **Por qué murió**: **sale de la tabla** (revisión del owner, 2026-09-28, C8): las verticales no se
  discontinúan. Con ella salen sus dos mitades, el reintento automático de la mitad de billing
  (`V2-i`), su condición de capa de composición y la exención por nombre de la regla de vigilancia
  (`V2-h`), acortar la cola (`V2-g`) y su sujeto en el resumen del §4.1 (`V2-s`). Discontinuar una
  vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces. **Retirar
  planes, también todos los de una vertical, sigue**: no es una fila de esta tabla sino una
  publicación del catálogo (`B/10` §3).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:206

## Las ocho clases de la tabla de traducción (`L1` a `L8`)

La tabla de `V/21` §2.4 traducía las columnas viejas de cada ficha a su estado de nacimiento.
**Sale entera, con sus ocho clases** (FASE 5, simplificación del corte, S-01): la migración del paso 3
escribe sólo las cinco fichas de la lista cerrada del owner y borra las de las demás cuentas
([PASO:3](30-el-corte.md#paso-3)). Donde una celda tenía un valor tachado, se lee como «antes».

<a id="l-l1"></a>

### L:L1 — `deleted_at` no nulo → `PURGED`, con el contenido borrado en el 5b

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:288, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l2"></a>

### L:L2 — `lifecycle_state = DRAFT` → `DRAFT`

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:289, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l3"></a>

### L:L3 — `lifecycle_state = ARCHIVED` → `DRAFT`

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:290, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l4"></a>

### L:L4 — `lifecycle_state = INACTIVE` y `billing_unpublished_at` nulo → `DRAFT`

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:291, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l5"></a>

### L:L5 — `lifecycle_state = INACTIVE` y `billing_unpublished_at` no nulo → `DRAFT` (antes `UNPUBLISHED_BY_BILLING`)

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:292, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l6"></a>

### L:L6 — `lifecycle_state = ACTIVE` y `visibility` distinta de `PUBLIC` → `DRAFT`

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:293, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l7"></a>

### L:L7 — `ACTIVE` + `PUBLIC` y (`owner_suspended` o `plan_restricted`) → `DRAFT` (antes `UNPUBLISHED_BY_BILLING`)

- **Por qué murió**: sale con la tabla (S-01).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:294, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283

<a id="l-l8"></a>

### L:L8 — `ACTIVE` + `PUBLIC`, sin marcas → `PUBLISHED`, con la prueba activa del corte

- **Por qué murió**: sale con la tabla (S-01); las cinco cuentas de la lista y su prueba las escribe
  ahora el [paso 3](30-el-corte.md#paso-3).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:295, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:283
