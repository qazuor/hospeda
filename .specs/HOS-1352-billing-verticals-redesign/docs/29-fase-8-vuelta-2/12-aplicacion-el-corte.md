---
title: "FASE 9 vuelta 2 · aplicación — el corte"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo B, el corte

Racimos R2, R3, R6, R8 y R21 del [consolidado](./00-hallazgos.md), con las decisiones `R2` y `R21`
de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). R3, R6 y R8 son escritura sin
decisión. Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits,
sobre el estado que dejó el grupo A (23 motivos, con el 23 `ORDEN_PAGADA_SIN_INSTANCIA`). `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs` y `D/16` es `16-fase-7-del-paraguas.md`.

## 1. Qué se aplicó

### R2 · decisión `R2` — «no devolver» vale sólo para la ventana del corte

`F-8V2B3-002`, `F-8V2C2-004`, `F-8V2B1-006`, `F-8V2B3-006`.

- La ventana es el día del corte, leída en el `date_created` del registro de cobro. Un cobro sobre
  la lápida del corte posterior a ese día abre el motivo **7**, `PAGO_TARDÍO_RECHAZADO` (**SÍ**), el
  de pago tardío que ya existía. No hizo falta un motivo nuevo:
  `B/21:267` — «No devolver» vale sólo para la ventana del corte
- La regla, en el mismo bloque de `B/21` §2.5:
  `B/21:272` — «Uno posterior abre la marca `PAGO_TARDÍO_RECHAZADO`»
- El barrido compara los cobros posteriores sobre la lápida del corte, en la fila de los cobros
  del período de `B/09` §3:
  `B/09:162` — «Un registro aprobado con `date_created` posterior al día del corte sí se compara»
- El motivo 7 nombra el caso como productor, y la lápida de recepción de `B/02` §2.2 dice la regla
  por fecha: `B/02:80` — «si es posterior»
- El paso 0 mide dos cosas: si cancelar corta el reciclado y si una cancelación releída horas
  después sigue `cancelled`. Cita las seis reversiones del código actual (`F-8V2C2-004`):
  `D/16:122` — «Y se miden dos cosas que dan el tamaño de la población del cobro sobre la lápida del corte»
- La población se lee de la re-verificación y no queda fija (`B/21` §1.3):
  `B/21:87` — «sale la población del cobro sobre la lápida del corte»
- La re-verificación lee los registros abiertos de cada id del manifiesto:
  `B/21:90` — «la re-verificación lee, por cada id del»
- Se reescribió la declaración que decía *minutos* y *a lo sumo los tres* (el ítem de `G3-1` en
  lo que `B/21` no cierra):
  `B/21:452` — «Población, leída y no fijada»
- El detector corre después del corte, con dueño y dos fechas:
  `B/21:461` — «y corre DESPUÉS del corte»
- El detector tiene unidad en la lista de herramientas del corte:
  `D/16:254` — «Y el detector posterior al corte»
- La exención de las terminales espera a que cierre el registro del ciclo (`F-8V2B3-006`), en el
  criterio de `B/09` §3:
  `B/09:187` — «recién cuando cerró el registro de cobro del último ciclo de su preapproval»
- Por qué, y por qué no suma una salvedad:
  `B/09:191` — «Por qué el registro y no sólo la cancelación.»
- Las dos filas exentas de la tabla, espejo y `S17`, con la condición:
  `B/09:208` — «cerrado el registro de cobro del ciclo»
- La salvedad 4, que sigue después de la relectura, y la lápida, que mira los cobros:
  `B/09:234` — «el estado y los cobros, no el monto»

### R3 — la ventana entre el paso 3 y el paso 4 (`F-8V2B3-003`, `F-8V2C2-002`)

Se gobierna con el orden y sin mecanismo nuevo. Las lápidas se siembran **antes** de apuntar la
URL de notificación. El apuntado y su sonda salen del paso 3 y pasan a un paso nuevo, el **4b**,
así que ningún evento de un id del manifiesto le llega al handler nuevo sin lápida del corte.

- El paso 3 queda sin el apuntado:
  `D/16:128` — «El apuntado de la URL y su sonda pasaron al paso 4b, después de las lápidas»
- La ruta nueva tiene que ser distinta de la vieja. Si fuera la misma, el interruptor sería el
  despliegue (condición de `F-8V2C2-001`):
  `D/16:128` — «Y la ruta del handler nuevo es distinta de la del viejo»
- El paso 4 va antes del 4b, y la regla de la herramienta ante el choque:
  `D/16:131` — «Y va antes del 4b»
- La fila 4b, con el ⚠️ de a qué URL va un reintento:
  `D/16:132` — «A qué URL va el reintento de un evento emitido antes del apuntado no está medido»
- La regla de la herramienta ante `UNIQUE(proveedor, id)` es saltear el choque con la lápida del
  corte del mismo id, porque correrla dos veces tiene que dar lo mismo. Ante cualquier otra fila
  aborta sin escribir, porque ese choque sólo existe si el orden se rompió y la rama de aborto
  todavía cubre. Saltear dejaría el cobro con la marca de devolver, contra `G3-1`:
  `B/21:174` — «la herramienta distingue dos choques»
- `B/21` §2.5: el paso 4 antes del apuntado.
  `B/21:171` — «Y corre antes de que la URL de notificación apunte al handler nuevo»
- El 500 del viejo ante un cobro que no resuelve (HOS-276), en el párrafo de `DB-5`:
  `D/16:151` — «Eso vale para los eventos de»
- La frontera de la rama de aborto incluye el paso 4 y el 4b:
  `D/16:281` — «incluye el paso 4 y el 4b»
- El paso 5 abre después del 4b: `D/16:133`.

### R6 — la rama de aborto (`F-8V2A3-002`, `F-8V2C2-001`)

- La declaración falsa, tachada. En su lugar va el inventario de lo que el corte cambió afuera de
  la base, cada cosa con su inverso: la URL, que se devuelve y se verifica con una entrega real,
  y la sonda de la entrega.
  `D/16:299` — «salvo la sonda, y era falsa»
- El borrado externo de las `L1` se difiere a un paso **5b**, pasada la rama de aborto. Se difiere
  entero, la base y lo externo, porque partido dejaba fotos sin fila que las nombre (la segunda
  lectura de `A3`):
  `D/16:134` — «borrar el contenido de las `L1`»
- La rama lo dice: `D/16:305` — «Las fotos y los»
- `V/21` §2.4: `V/21:192` — «no corre en la migración: lo corre la herramienta del corte de V6 en el paso 5b»
- El paso 4 deja de ser la única escritura a mano:
  `D/16:184` — «El paso 4 y el 5b son las dos escrituras a mano del corte»

### R8 — el handler consulta el manifiesto de sondas (`F-8V2B3-004`, `F-8V2C2-005`)

- `B/09` §2.4: el handler consulta el manifiesto de sondas del corte antes de cancelar.
  `B/09:99` — «el handler consulta el manifiesto de sondas del corte»
- Sobre esos ids escribe lápida, `payment` y marca, y no cancela. El barrido tampoco, porque sin
  llamada nuestra la lápida no entra a la salvedad 4:
  `B/09:103` — «y no manda cancelar»
- La sonda de la entrega (4b) no está en el manifiesto. Su lápida de recepción con la marca 6 es
  la evidencia de la entrega, y la levanta quien opera el corte:
  `D/16:132` — «Su evento escribe una lápida de recepción con la marca `TRANSICIÓN_NO_DECLARADA`»

### R21 · decisión `R21` — el pagador del manifiesto del 1b entra a la población (`F-8V2C2-003`)

- `B/21` §1.3: `B/21:80` — «Y el titular de toda autorización que el censo del 1b cancela»
- El aviso le llega después del 1b. Es la lectura literal de *el manifiesto del 1b*, y la otra
  queda como pregunta (§4):
  `B/21:84` — «su aviso llega después de la cancelación y no antes»
- Lo que pierde, declarado como en `G1-4`:
  `B/21:427` — «con un aviso que no es previo»
- El script del censo trae el `payer_email`: `D/16:250` — «que trae, por cada id, su pagador»
- El aviso: `D/16:207` — «Al titular de una autorización que sólo conoce el proveedor»

### Unidades

| qué | unidad | dónde |
|---|---|---|
| el motivo 7 sobre la lápida del corte (evento y barrido); la exención con el registro cerrado; el detector posterior; la regla de choque del paso 4; el handler que no cancela sondas del manifiesto | **B11** | fila `$B/descomposicion.md:137`, criterio `$B/descomposicion.md:732` |
| el borrado de las `L1` en el 5b | **V6** | fila `$V/descomposicion.md:59`, criterio `$V/descomposicion.md:510` |
| el `payer_email` en el manifiesto; las dos mediciones del paso 0; el 4b y la devolución de la URL en la rama de aborto | la FASE 7 del paraguas (herramienta 1 y quien opera el corte, `D/16` §4.2) | — |

- `$B/descomposicion.md:137` — «sólo el del día del corte»
- `$B/descomposicion.md:732` — «sobre una lápida del corte, un cobro con»
- `$V/descomposicion.md:59` — «en el paso 5b del corte y no en la migración»
- `$V/descomposicion.md:510` — «la herramienta del paso 5b la deja sin contenido»

## 2. Conteos recontados

| lista | antes | ahora | comando | espejos |
|---|---|---|---|---|
| motivos de la marca | 23 | **23** | no se sumó ninguno: el cobro posterior va al 7 | — |
| salvedades del barrido | 4 | **4** | la condición del registro va dentro del criterio de exención | — |
| puertas a un terminal · exentas | 18 · 2 | **18 · 2** | tabla de `B/09` §3, sin filas nuevas | — |
| filas de la tabla del corte (`D/16` §4.2) | 11 | **13** (4b, 5b) | `rg -c '^\| (0\|0b\|1a\|1b\|2\|2b\|3\|3a\|3b\|4\|4b\|5\|5b) \|'` | no hay conteo congelado: `rg` de «pasos del corte», «once pasos» y parecidos sin resultados |
| escrituras a mano del corte | 1 | **2** (paso 4, 5b) | la frase de `D/16` §4.2 | única cita, `D/16:184` |
| filas de la matriz | 99 | **99** | sólo propuestas (§3) | — |

## 3. Propuestas para el log y la matriz

Grepeados antes: `DEC-MIG-003` (`$D/01-decision-log.md:2674`), `DEC-MIG-004` (`:2994`),
`DEC-MIG-005` (`:5738`). `G3-1` no figura en el log: vive en el diseño.

1. **`DEC-MIG-004`, punto 2 de su 📌 del 2026-09-25** (`$D/01-decision-log.md:3037`). Su conclusión
   sobre el #15 (el cobro en vuelo entre el paso 3 y el 4 que abre marca) deja de ser cierta.
   Texto propuesto:
   > 📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`)**: entre el
   > paso 3 y el 4 no llega nada al handler nuevo. Las lápidas se siembran antes de apuntar la URL
   > (el nuevo paso 4b de `16-fase-7…` §4.2), así que el cobro en vuelo de un id que la base no
   > conoce encuentra su lápida del corte y se asienta por la regla de `G3-1`, sin marca si es del
   > día del corte.
2. **`DEC-MIG-005`**. Es donde vive *«no se devuelve la diferencia»* del corte. Razón: `R2` y `R21`
   le cambian la población. Texto propuesto:
   > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R2` y `R21`)**: el cobro
   > sobre una lápida del corte no se devuelve sólo si es del día del corte (`date_created` del
   > registro). Uno posterior abre `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolverlo. La
   > población se lee de la re-verificación del día del corte, y un detector corre después del
   > corte, con dueño y fecha (`B/21` «NO cierra»). El titular de una autorización que sólo
   > conoce el proveedor entra a la población a avisar por el `payer_email` del manifiesto del
   > 1b. Su aviso llega después de la cancelación, y lo que pierde se declara como en `G1-4`.
3. **`DEC-MIG-003`, 📌 del 2026-09-25, puntos 2 y 3** (`$D/01-decision-log.md:2733`). Razón: la
   rama de aborto ahora tiene inventario externo, y su frontera incluye las lápidas. Texto
   propuesto:
   > 📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2A3-002`, `F-8V2C2-001`,
   > `F-8V2B3-003`)**:
   >
   > - La rama de aborto devuelve la URL de notificación a la ruta del viejo y la verifica con una
   >   entrega real.
   > - El borrado del contenido de las `L1` pasa al paso 5b, después de abrir altas, porque el
   >   backup no restaura fotos ni tokens.
   > - El apuntado de la URL es el paso 4b, después de las lápidas. El paso 3, que es hasta donde
   >   cubre la rama de aborto, termina con el 4b verificado y su sonda cancelada. El punto de no
   >   retorno no se mueve.
4. **Matriz, tres filas nuevas** (`$D/06-mp-validation-matrix.md`, junto a `GR-2` y a `EX-43`, que
   propuso el grupo A):
   > | **EX-44** ✚ | ¿Cancelar un preapproval **corta el reciclado** de un registro de cobro abierto (`scheduled`/`recycling`), o un cambio de medio posterior todavía lo cobra? | el cobro sobre la lápida del corte y la exención de las terminales (`B/21` §2.5, `B/09` §3; FASE 9 vuelta 2, `R2`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2) sobre una sonda propia con un registro abierto. No es condición del corte: da el tamaño de la población |
   > | **EX-45** ✚ | Una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato, ¿sigue `cancelled` releída **horas después**? | el gate del paso 2 y el cobro sobre la lápida del corte (FASE 9 vuelta 2, `F-8V2C2-004`) | `UNKNOWN` | — | — | — | El código actual registra seis que no (`preapproval-recovery.service.ts:22`, HOS-937); se mide en el paso 0. `PA-5` midió la irreversibilidad en sandbox |
   > | **EX-46** ✚ | ¿A qué URL va el **reintento** de una notificación emitida antes de cambiar la URL de notificación de la aplicación: a la de entonces o a la vigente? | el paso 4b del corte (FASE 9 vuelta 2, `F-8V2C2-002`) | `UNKNOWN` | — | — | — | `WH-4` midió los reintentos, no su destino. Si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del «NO cierra» de `B/21` sobre `G3-1` |

   El recuento pasa de 99 filas a 102, o a 103 con la `EX-43` del grupo A. Los `UNKNOWN` suben tres.
   Los espejos están en `B/spec` §5.2, `$B/descomposicion.md` §2.7 y `B/06`, y no los toqué. Por
   unidad, `EX-44` y `EX-46` caerían en B11 y en la FASE 7 del paraguas, y `EX-45` en la FASE 7.

## 4. Preguntas abiertas

1. **`R21`: cuándo le llega el aviso al titular que sólo conoce el proveedor.** Hay dos lecturas:
   - **A, la aplicada, literal**: su pagador sale del manifiesto del 1b, así que el aviso llega
     *después* de la cancelación. **Daño**: se entera tarde, sin el punto 4 del guion (*«no
     contrate nada en el viejo»*) antes de actuar. Como las altas ya están cerradas desde el 0b,
     ese punto le importa poco. Lo que sí pierde es la llamada antes de ver el cobro cortado.
   - **B**: una pasada de sólo lectura del recorrido del proveedor antes del aviso (la misma
     herramienta del 1b, sin cancelar) le da el `payer_email` a tiempo para un aviso previo.
     **Daño**: ninguno para el cliente. Cuesta una corrida más de la herramienta, y la lista puede
     envejecer entre esa pasada y el 1b, así que el manifiesto del 1b sigue haciendo falta.
   La decisión dice *«el manifiesto del 1b»*, y por eso apliqué A. Si el owner quería un aviso
   previo, es B.
2. **R3: la frontera de la rama de aborto.** El orden elegido mete el paso 4 y el 4b dentro del
   *«paso 3 termina cuando…»* que fijó `G4-1`. Es un cambio de texto de una decisión del owner,
   aunque no de su efecto: las lápidas son filas de la base y el backup las restaura. Las
   alternativas del consolidado eran dos:
   - que el handler consulte el manifiesto del 1b: pide cargar en el handler un manifiesto que
     nace el mismo día, que es mecanismo nuevo;
   - que la herramienta convierta una lápida de recepción en una del corte: `origen_de_lápida` es
     inmutable, y la marca 7 ya abierta seguiría proponiendo devolver.

   Ninguna de las dos gobierna la ventana sin mecanismo nuevo. Lo dejo aplicado y señalado, para
   que el owner confirme el texto de `G4-1`.

## 5. Casos vecinos

- **`B/05` §3 no está espejado, porque me estaba vedado tocarlo.** Sigue diciendo que la lápida
  del corte no desempata en ningún caso (`B/05:335`, «Y lo que no desempata por decisión: la
  lápida del corte»). Pasa lo mismo en `B/05:249` (*«sobre la lápida del corte nada»*), en
  `B/05:275` (*«ni sobre la lápida del corte»*) y en la tercera fila de la tabla de desempate
  (`B/05:316`), que tiene que sumar *«el cobro posterior al día del corte sobre una lápida del
  corte»* al 7. **Es un espejo pendiente del orquestador.** Sin él, `B/05` contradice a `B/21`,
  `B/09` y `B/02`.
- **La herramienta del 3b** (grants) no dice qué hace si se corre dos veces. Por la regla del paso
  4 debería saltear su propia fila y abortar ante otra, pero no es mío.
- **La marca 7 sobre la lápida de recepción de una sonda del manifiesto** lleva **SÍ** y le propone
  al owner devolverse su propio cobro. Quedó dicho que la levanta sin devolver, pero la marca nace
  con ese default.
- **El segundo corrido del detector sobre un plan anual del viejo.** `RC-7` midió `expire_date` =
  un ciclo sobre ciclos de 1 y 2 días. Si el viejo tiene suscripciones anuales (el `CLAUDE.md` del
  repo describe el anual del sistema actual), la segunda fecha puede quedar hasta un año después
  del corte. No está medido.
- **El `payer_email` no se cruza con las cuentas de Hospeda.** El titular puede tener cuenta con
  otro correo. No se intenta emparejarlo, y la llamada lo resuelve.
- **R27, vecino de R6**: los grants del 3b suben fichas por `PB3`, y el caché público (ISR y borde)
  no se entera. Es otro objeto afuera de la base, aunque no lo destruye el corte.

## Key Learnings

1. Una declaración de población (*«minutos»*, *«los tres»*) se caía por tres lados a la vez. El
   arreglo no fue corregir el número: fue sacar la fecha del cobro (`date_created`) como frontera,
   para que la regla no dependa de cuánta gente cae adentro.
2. La ventana entre el paso 3 y el 4 se gobernó sin mecanismo, sólo con el orden: el apuntado de la
   URL es el único interruptor que decide cuándo llegan eventos. Eso obligó a fijar que la ruta
   nueva sea distinta de la vieja, y con eso el hallazgo condicionado de `C2-001` dejó de serlo.
3. Diferir el borrado de las `L1` sólo en lo externo creaba otro defecto: fotos sin fila que las
   nombre. Hubo que diferirlo entero, y aceptar `PURGED` con contenido por unos minutos.
4. La exención de terminales se pudo atar al registro de cobro sin agregar una quinta salvedad. La
   condición entra en el criterio de *«imposibilitada de cobrar»* y no mueve ninguna cifra
   congelada.
5. Un archivo vedado (`B/05`) deja la aplicación con una contradicción que no se puede cerrar
   desde acá. Hay que declararla como espejo pendiente y no darla por aplicada.
