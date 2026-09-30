---
title: "FASE 5 · verificación ajena de la aplicación"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · verificación ajena de la aplicación

Verificador que no participó en la aplicación. Diff revisado: `git diff 5ae95205c2..HEAD -- .specs/`
(48 archivos, nueve commits de hoy, HEAD `bcfe2ccab3`). No se editó nada del diseño. Los números de
línea son del worktree en ese HEAD.

**Método.** Todas las búsquedas de contradicciones corren sobre el **texto vivo**: un script
(`live.py`, en el scratchpad de la sesión) parte cada archivo en unidades (párrafo, fila de tabla,
encabezado, ítem de lista), une las líneas de cada unidad y borra los `~~…~~` antes de buscar, así
que un tachado que cruza líneas no da falso positivo. El universo de diseño es `HOS-1352/spec.md`,
`HOS-1352/docs/1[0-6]-*.md`, `24-`, `nucleo/*`, y las `spec.md`, `descomposicion.md` y `docs/*` de
`HOS-1353` y `HOS-1354`. El log se revisó aparte, mirando sólo el 📌 más reciente de cada decisión.

## 1. Resumen

| control | resultado |
|---|---|
| decisiones del log | **142** encabezados distintos (`rg -o "^### DEC-[A-Z]+-\d+" … \| sort -u \| wc -l`); cabecera del log 142 = 125 + 17; `spec.md:156-158` y `nucleo/00-indice.md:44` dicen lo mismo |
| matriz | **117** = 63 · 16 · 24 · 14; esperan medición 9, no se miden 9 (`contar-filas-de-la-matriz.py`); `spec.md:90`, `:142` y `06-…:455` coinciden (103 cerradas = 117 − 14) |
| unidades | **24** en todas partes; ningún «23 unidades» vivo |
| guards | **34** = 18 · 15 · 1, recontado por script sobre la columna *guards* de las dos tablas de unidades (`V1` 4, `V3` 2, `V4` 4, `V5` 5, `V6` 3; `B1` 7, `B2` 1, `B3` 4, `B7` 1, `B8` 1, `B10` 1; `G8` en `U1`). **Un lugar dice 33** (VF5-02) y otro suma mal su lista (VF5-05) |
| dependencias entre épicas | **12** en todas partes; ningún «once» vivo que las cuente |
| citas de los registros `11-` a `27-` | **616** citas `archivo:línea «cita»` leídas con script: **494 (80,2 %)** en su línea ±2; **112 (18,2 %)** con el texto presente en el archivo pero corrido de línea; **10 (1,6 %)** ausentes. Las 10 ausentes y las 112 corridas son todas de registros anteriores a la tanda que movió o reescribió esas líneas (VF5-07). Los registros `22-`, `23-`, `24-`, `26-` y `27-` dan 100 % |
| forma | `markdownlint-cli2` sobre los 48 archivos del diff, desde la raíz del worktree: **0 problemas**. En los archivos de diseño, **0** `~~~~` y **0** unidades con `~~` impar; en los registros, cuatro fragmentos citados con `~~` impar (VF5-08) |

**Cobertura.** Muestreadas con script sobre el texto vivo, todas presentes: lote 1 A (criterio de
`V5`), B (`billing_notification_log`), C, D, E, F, G, H, I (790 valores), J; lote 2 C, D, E
(`STATEMENT_DESCRIPTOR`); lote 3 A, C (`PB12` y acción 23; en el último 📌 de `DEC-AUTH-003` ya dice
`PB12`), D (*«antes del merge de `V6`»*), E (`HOSPEDA_CRON_ADAPTER`), F (`db-migrate --pull`); lote
4 A (`alliance_leads`), B + F + N (rol de socio: `V/17:76`, `:699`, `V/18:351`, `V/desc:540`,
`DEC-ENT-006`), C, D, E (`V/02:1001`), F + J + M (devoluciones de una orden: `B/05`, `B/09`,
`B/desc`), G (`ban_expires`); simplificación A a E; aplicación A (regla hasta el reintento:
`16-:132`, `:384`, `:421`, `V/21:99`, `DEC-MIG-005` 📌 `01:6422`), B (herramienta de `V6`, salvo
VF5-01), C, D + P (tabla de paso, fuera del esquema de Drizzle; ningún *«el backup la incluye»*
vivo), E (`G18`, salvo VF5-02 y VF5-04), G, H + O (seis columnas de `partners`; `starts_at` y
`ends_at` los borra `V7`), I (salvo VF5-03), K, L (`fullAdminRole` vacío: `V/17:480`, `V/desc:533`,
`:624`; confirmado contra `origin/staging:apps/api/src/lib/auth.ts:76-89`). `U1` y `U2` se
describen igual en `16-:774-805`, `nucleo/07:67-83`, `nucleo/08:170-177`, `11-:183-184`,
`V/desc:530`, `:549`, `:559-560`, `B/desc:707`, `:711`, `:725`, `spec.md:18-24` y el 📌 de
`DEC-ARCH-014` (`01:7436-7448`): `U2` depende de `U1`, la esperan `V6`, `V9`, `B4` y `B12`, absorbe la
bitácora renombrada, trae correlación, id de corrida y huso, el reloj queda en `B1`, no suma guards
ni dependencias entre épicas.

**Contradicciones vivas buscadas y no encontradas**: lápida del corte, Worker del borde, detector
posterior al corte, ventana o regla del día del corte, clasificación `L1`–`L8`, umbral de veinte,
`PB9` como borrado del dueño, 23 unidades, rol al aprobar la postulación, alta directa que fija
dueño, backup del 2b que *«incluye»* la tabla de paso, espera de 30 minutos, lista de rutas,
prueba en producción del paso 0. Todas sus apariciones vivas dicen que la pieza **sale**.

## 2. Hallazgos

### VF5-01 · BLOQUEA · «el script del corte» sigue escribiendo las cinco pruebas

- `16-fase-7-del-paraguas.md:131` (paso 0): «**las cinco pruebas que el script del corte escribe
  después de la migración del paso 3, a las cuentas de la lista cerrada del owner**»
- `16-fase-7-del-paraguas.md:138` (paso 3a): «(FASE 5, owner 2026-09-30, lote 2 D: la prueba del
  corte, que los lee, la escribe después de migrar el script del corte)»
- `HOS-1354/docs/21-migracion.md:488-489`: «**Verticales escribe una prueba activa para cada cuenta
  de la lista cerrada del owner, y la escribe el script del corte con la función de la aplicación**»
- `HOS-1354/docs/21-migracion.md:575-576`: «las pruebas y los seudónimos de las cinco cuentas los
  escribe después el script del corte»

**Contradice** la letra B del lote de la aplicación: las pruebas y sus seudónimos los escribe **la
herramienta del corte de `V6`, que es del sistema nuevo**; el script suelto no importa código de
ningún sistema. `V/21:99`, `:494`, `nucleo/01:62`, `:76`, `nucleo/02:106`, `:197` y el log ya
dicen *«herramienta de `V6`»*; estos cuatro lugares quedaron con el texto del lote 2 D. El 5b y el
3a de `16-` son justo los que lee quien opera el corte.

**Arreglo (mecánico)**: en las cuatro, tachar *«el script del corte»* y escribir *«la herramienta
del corte de `V6`, que es del sistema nuevo»*, con el origen *(FASE 5, lote de la aplicación, owner
2026-09-30, B)*.

### VF5-02 · BLOQUEA · `16-` sigue diciendo 33 guards, 17 de verticales

- `16-fase-7-del-paraguas.md:784-785`: «**El reparto de guards cambia y el total no**: 17 de
  verticales, 15 de billing y 1 de `U1`, 33 (`V/descomposicion.md` §4, `B/descomposicion.md` §4)»

**Contradice** la letra E del lote de la aplicación (33 → 34) y el recuento por script (18 · 15 ·
1). Es la misma sección que diez líneas antes, en la fila de `U2`, dice *«ninguno de los ~~33~~ 34
guards»*.

**Arreglo (mecánico)**: tachar *«17»* y *«33»* y escribir *«18 de verticales, 15 de billing y 1 de
`U1`, 34 (entra `G18`, de `V1`: FASE 5, lote de la aplicación, owner 2026-09-30, E)»*.

### VF5-03 · BLOQUEA · `origen_de_lápida` sigue viva en `16-`

- `16-fase-7-del-paraguas.md:147`: «el handler escribe al recibir el primer cobro una lápida con
  `origen_de_lápida = RECEPCIÓN`, de la que cuelgan el `payment` y la marca `PAGO_TARDÍO_RECHAZADO`»

**Contradice** la letra I del lote de la aplicación: sale la columna y su restricción, *«`clase =
LÁPIDA` alcanza»* (ya aplicado en `B/02`, `B/09`, `B/21:200`, `:293`). Es la única aparición viva
de la columna en todo el diseño.

**Arreglo (mecánico)**: tachar *«con `origen_de_lápida = RECEPCIÓN`»* y escribir *«de recepción
(`clase = LÁPIDA`; sale la columna `origen_de_lápida`: FASE 5, lote de la aplicación, owner
2026-09-30, I)»*.

### VF5-04 · BLOQUEA · a qué unidad va el guard 34: se aplicó una opción que el owner nunca eligió

- `38-fase-5/25-aplicacion-lote-de-aplicacion-nucleo-y-log.md:109-127`: la pregunta *«A qué mitad y
  a qué unidad suma el guard 34»*, con tres opciones y la 1 (`V1`) recomendada, queda en
  *«Vuelve al owner»*.
- `38-fase-5/23-…:177-181`: «`G18` en `V1`, condicionado a la pregunta de `25-` §5».
- `38-fase-5/10-decisiones-del-owner.md`: la segunda tanda (M a P) toma sólo *«registros `23-` §5
  y `24-` §5»*; **la de `25-` §5 no se le planteó al owner** y no hay letra que la conteste.
- Aun así, la segunda tanda la volvió definitiva como *«arreglo mecánico»*
  (`26-…:84-88`, `27-…:72-75`): `V/desc:54` y `:583-584`, `V/20:59`, `V/spec:390`, `B/desc:794-795`,
  `B/20:390-392` dicen hoy *«`G18`, de `V1`»* sin condición, y `spec.md:158` sigue diciendo
  *«Ninguna pregunta del owner queda abierta»*.

**Contradice** la regla de la FASE 5 de que ninguna elección se toma sin letra del owner, y
`DEC-TEST-001` (*«la unidad nazca ANTES o CON lo que el guard vigila»*) sólo acota la respuesta, no
la da. Es una decisión nueva disfrazada de arreglo mecánico.

**Vuelve al owner.** El guard nuevo es el control que regenera el SQL de la tabla de claves y del
catálogo y lo compara con el que viaja en la migración. Hay que decidir qué unidad lo construye.
Ejemplo: `V1` agrega la clave que deja a Juan destacar su ficha. Si el control todavía no existe,
nada avisa si el SQL que se commiteó no trae esa clave, y el panel no la puede asignar a ningún
plan.

1. **`V1`, en verticales (queda como está escrito hoy).** Costo: ninguno, ya está aplicado. Riesgo:
   bajo; el control nace con la primera carga que vigila, la de la tabla de claves.
   **Recomendada.**
2. **`V6`, en verticales, con el catálogo.** Costo: mover la fila y los conteos de `V1` a `V6` en
   seis archivos. Riesgo: medio; entre `V1` y `V6` la tabla de claves de Juan no tiene control.
3. **`U1`, del paraguas, como `G8`.** Costo: mover a `U1` y pasar el reparto a 17 · 15 · 2. Riesgo:
   choca con `DEC-ARCH-014`: `U1` no construye nada del diseño nuevo, salvo el package vacío.

Si elige la 1, alcanza con registrar la letra en `10-` y quitar *«condicionado»* de `23-` §5;
el diseño ya está bien.

### VF5-05 · MENOR · `B/20` suma 15 donde lista 16

- `HOS-1354/docs/20-testing.md:392`: «más los **15** que ya la tenían — `G1` `G3` ~~`G8`~~ (`V1`),
  **`G8` (`U1`** … **`G14` (`V1`** … **y `G18` (`V1`**»

La lista tiene 16 ids (`G1`, `G3`, `G8`, `G2`, `G4`, `G6`, `G5`, `G-R6-B`, `G9`–`G12`, `G7`, `G13`,
`G14`, `G18`): al agregar `G18` (letra E) no se subió la cifra. El total de la fila (34) cuadra igual,
porque 3 + 16 + 14 + 3 − 2 (las dos que pasan al panel) = 34.

**Arreglo (mecánico)**: *«~~**15**~~ **16** que ya la tenían»*.

### VF5-06 · MENOR · `EX-46` se justifica con un párrafo que salió

- `06-mp-validation-matrix.md:403`: «Si va a la vieja, el evento se pierde y su cobro cae en el
  punto (3) del «NO cierra» de `B/21` sobre `G3-1`»
- `HOS-1354/spec.md:273`: «si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del
  «NO cierra» de `B/21` sobre `G3-1`, que ve el barrido de **B11**»
- `HOS-1354/descomposicion.md:440`: «si va a la vieja, el cobro cae en el punto (3) del «NO cierra»
  de `B/21` sobre `G3-1`, que ve el barrido»

**Contradice** la letra C de la simplificación (S-40, S-70): el bloque de `G3-1` salió entero
(`B/21:332-333`, `:644`). `B/06:462` ya lo corrigió (*«y su cobro lo ve el barrido de B11 como el de
cualquier desconocido»*); los otros tres quedaron. No cambia ninguna regla (la fila ya está *«sin
sujeto»*), pero manda a leer un párrafo tachado.

**Arreglo (mecánico)**: copiar en los tres el texto de `B/06:462`, con el origen *(la lápida del
corte salió: FASE 5, simplificación del corte, S-40 y S-70)*.

### VF5-07 · MENOR · las citas de los registros viejos quedaron corridas

616 citas leídas: 494 en su línea (±2), 112 con el texto presente en otra línea, 10 ausentes. Por
registro: `11-` 65/26/3, `12-` 35/0/2, `13-` 65/18/4, `14-` 46/8/1, `15-` 48/11/0, `17-` 21/3/0,
`18-` 17/36/0, `21-` 8/1/0, `25-` 15/9/0; los demás, 100 %. Los corrimientos son todos positivos y
coinciden con las tandas posteriores (`18-` contra el log: +9 a +113; `13-` contra `V/21`: +15 a
+22). Las 10 ausentes son texto que una tanda posterior reescribió por decisión: *«el script del
corte escribe las cinco pruebas»* (letra B; `11-:70`, `12-:88`, `12-:90`, `13-:77`, `13-:78`,
`13-:80`, `13-:144`, `14-:148`), *«ninguno de los 33 guards»* (letra E; `11-:166`) y *«borra las
columnas de pago de `partners`»* (letra H; `11-:145`). Ninguna falla es un error de la aplicación.
Los registros ya advierten *«las citas son de líneas del worktree al terminar esta aplicación»*.

**Arreglo (mecánico, opcional)**: una línea al pie de `11-` a `18-` que diga que las tandas
posteriores (`22-` a `27-`) movieron sus líneas y reescribieron las citas de las letras B, E y H.

### VF5-08 · MENOR · `~~` impar en cuatro citas de los registros

- `12-aplicacion-nucleo-y-contrato.md:118`: «``corte en `staging`~~ **antes del merge de `V6`**``»
- `13-aplicacion-verticales-migracion-y-descomposicion.md:56`: «`(FASE 9 vuelta 1, R7)~~ no se re-cuentan`»
- `17-aplicacion-cobro-capitulos-b.md:39`: «`| ~~la **lápida** del corte`»
- `17-aplicacion-cobro-capitulos-b.md:44`: «`~~ **la lápida de recepción** (**la de recepción**`»

Son fragmentos citados, que cortan un tachado a la mitad. `markdownlint` no los ve. El diseño está
limpio: ninguna unidad con `~~` impar y ningún `~~~~` fuera de código.

**Arreglo (mecánico)**: envolver cada fragmento en backticks, o cerrar el tachado dentro de la cita.

## 3. Decisiones inventadas

Aparte de VF5-04, las elecciones que la aplicación escribió sin letra están marcadas como
*«lo derivé y lo marco»* y no eligen entre alternativas: cómo se verifica la regla del 0b
(`16-:132`), el alcance de `U2` sin correos del catálogo (`16-:776`) y *«el backup no contiene la
tabla»* (`22-:81-85`). Ninguna otra elección nueva apareció en el texto vivo muestreado.

## 4. Conteo de hallazgos

4 BLOQUEA (VF5-01 a VF5-04: tres mecánicos y uno que vuelve al owner) · 4 MENOR (VF5-05 a VF5-08,
todos mecánicos).

## 5. Arreglos aplicados

Aplicados los mecánicos `VF5-01`, `VF5-02`, `VF5-03`, `VF5-05` y `VF5-06`, con el origen de su letra más
*«verificación, `VF5-NN`»*. `VF5-04` queda para el owner; `VF5-07` y `VF5-08` no se tocan (son citas
de registros históricos). Citas verificadas con script; `markdownlint-cli2` sobre los seis archivos
de diseño tocados: 0 problemas.

- **`VF5-01`** (letra B). Una búsqueda sobre el texto vivo de todo `$D`, `$V` y `$B` (sin el log ni
  los registros) no dio otras copias de *«el script del corte»* escribiendo las pruebas; sus demás
  apariciones vivas hablan del vencimiento de `EX-42` o del armado del valor viejo, no de las pruebas.
  - `16-fase-7-del-paraguas.md:131` «las cinco pruebas que ~~el script del corte~~ la herramienta del corte de `V6`»
  - `16-fase-7-del-paraguas.md:138` «la escribe después de migrar ~~el script del corte~~ la herramienta del corte de `V6`»
  - `HOS-1354/docs/21-migracion.md:489` «escribe ~~el script del corte~~ la herramienta del corte de `V6`, que es del sistema nuevo, con la función»
  - `HOS-1354/docs/21-migracion.md:576` «escribe después ~~el script del corte~~ la herramienta del corte de `V6`»
- **`VF5-02`** (letra E).
  - `16-fase-7-del-paraguas.md:784` «~~17~~ 18 de verticales»
  - `16-fase-7-del-paraguas.md:785` «~~33~~ 34 (entra `G18`, de `V1`»
- **`VF5-03`** (letra I). `16-fase-7-del-paraguas.md:167` «de recepción (`clase = LÁPIDA`; sale la columna»
- **`VF5-05`** (letra E). `HOS-1354/docs/20-testing.md:392` «más los ~~**15**~~ **16**»
- **`VF5-06`** (S-40 y S-70, texto de `B/06:462`). Sin cambio de estado en la fila de la matriz;
  recuento `cd $D && python3 contar-filas-de-la-matriz.py`: **117** = 63 · 16 · 24 · 14.
  - `06-mp-validation-matrix.md:403` «**y su cobro lo ve el barrido de B11 como el de cualquier desconocido**»
  - `HOS-1354/spec.md:273` «**y su cobro lo ve el barrido de B11 como el de cualquier desconocido**»
  - `HOS-1354/descomposicion.md:440` «**y su cobro lo ve el barrido de B11 como el de cualquier desconocido**»

Una nota para el owner, sin elegir nada: en `16-:784` el encabezado *«el reparto de guards cambia y
el total no»* quedó como estaba (el arreglo de `VF5-02` no lo tocaba) y ahora convive con 33 → 34;
la línea que atribuye `G18` a `V1` sigue sujeta a `VF5-04`.
