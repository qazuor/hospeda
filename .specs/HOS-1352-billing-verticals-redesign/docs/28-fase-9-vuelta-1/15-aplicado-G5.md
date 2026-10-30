---
title: "FASE 9 vuelta 1 · G5 aplicado — autorización, cobro, coherencia y registro"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G5 aplicado

Registro de la aplicación de `05-G5-autorizacion-cobro-y-coherencia.md` (§2, §3, §4 y la lista del
§6) y de las decisiones `G5-1` (**1**), `G5-2` (**2**), `G5-3` (**2, contra la recomendación**),
`G5-4` (**1**) y `G5-5` (**1**) de `10-decisiones-del-owner.md`. Las dos 📌 del log
(`DEC-ARCH-005`, `DEC-RF-001` parte 3) las escribió el orquestador y no se tocaron; de ellas se
aplicaron sólo `D/11` y `B/03` §6/§6.1. El ítem 22 (`D/03-handoff.md`) **no está en el alcance** y
no se tocó.

Abreviaturas: `B/NN` es `.specs/HOS-1354-billing-cobro-y-proveedor/docs/NN-*.md`, `V/NN` es
`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/NN-*.md`, `N/NN` es
`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/NN-*.md`, `D/11` es
`.specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md`; `B/desc`, `V/desc`,
`B/spec` y `V/spec` son las `descomposicion.md` y `spec.md` de cada épica. Las líneas son las del
worktree al cierre de esta pasada; otros grupos editan los mismos archivos y pueden correrlas.

## 1. Qué se aplicó

### 1.1 La lista del §6 del documento

| ítem | archivo:línea | estado |
|---|---|---|
| 1 · `B/03` §4, grace: tachar la condición de `GR-1` | `B/03:1607` | hecho |
| 2 · `B/06` §11 `RN-3`: `PARTIALLY_SUPPORTED` y referencia a `B/09` | `B/06:412` | hecho, las dos cosas en la misma celda |
| 3 · `B/06` introducción: 94 medidas, 26/09 | `B/06:27-28` | hecho |
| 4 · `B/desc` §2.7, título: cuatro filas | `B/desc:354` | hecho |
| 5 · `B/09` §3: `EX-1` `PARTIALLY_SUPPORTED` | `B/09:173` | hecho |
| 6 · `V/17` §4.3 *«ningún rol es una fuente»*; `N/04` fila 13; `V/20` `G6` segunda mitad | `V/17:502-508`, `N/04:75`, `V/20:55` | hecho; además `V/spec:218` (§3.8) y `V/spec:381` (tabla de guards) |
| 7 · `N/08` §3 las dos reglas; `V/19` §2 fila Admin | `N/08:185-189`, `V/19:44` | hecho |
| 8 · las ocho menciones de la clave de presencia en singular | `V/17:188-190`, `V/17:451-453`, `V/spec:176-178`, `V/18:120`, `N/01:47`, `V/03:1067`, `V/19:89`, `V/21:388` | hecho; las líneas se corrieron respecto del documento (`V/03:1016`→`1067`, `V/19:87`→`89`, `V/21:330`→`388`) |
| 9 · `V/02` §2.1 pre-trial y piso no heredan VIP; `G-R3` (d) en `V/02` y `V/20`; `V/15` §6 | `V/02:157-161`, `V/02:277-300`, `V/20:61`, `V/15:476-480` | hecho; en `V/02` también se recontaron «tres mitades/tres mensajes» → cuatro y el dominio de (d) |
| 10 · el guest y el paso 1: `V/17` §1.2 fila 1 y §3.3; `V/02:223`; `V/20:309` | `V/17:71`, `V/17:343`, `V/02:229`, `V/20:310` | hecho |
| 11 · `V/17` §1.2: lista cerrada del paso 2 | `V/17:116-124` | hecho, con la nota de *«contratar»* afuera |
| 12 · `B/03` `A1`: la ficha objetivo es el recurso del paso 4 | `B/03:2491` | hecho |
| 13 · `B/03` `S1` y `B/12` §4.4: la `CHARGE_DECLINED` sin cancelar confirmada | `B/03:147`, `B/12:394-395` | hecho |
| 14 · `B/03` §6.1 `RF2` y regla del §6 | `B/03:1814`, `B/03:1789-1792` | hecho |
| 15 · `B/03` `S30`: `desde` con `GRACE_PERIOD` | `B/03:176` | hecho; también se corrigió *«su `desde` es `ACTIVE`»* dentro de la misma fila |
| 16 · `N/01` entrada *«pagando»*; líneas de la lectura ancha; `B/03:220-222` | `N/01:688-697`, `N/01:568`, `B/03:225-229`, `B/03:2491`, `B/03:2495`, `B/16:107`, `:114`, `:248`, `:386`, `:430`, `:600`, `:753`, `:934`, `B/desc:136` | hecho; ver §4 punto 2 (dos líneas más que las diez del documento) |
| 17 · `N/03` §1 regla 5 y `N/04` `D17` | `N/03:63-71`, `N/04:144` | hecho (`A3` también nombrado en `D17`) |
| 18 · `N/04:123`: sacar el número | `N/04:123` | hecho |
| 19 · `B/02:915`, `:939` y `B/06:412`: referencias a `B/09` | `B/02:915`, `B/02:958`, `B/06:412` | hecho; y una cuarta rota que el resolvedor no vio, en `N/04:144` (§4 punto 3) |
| 20 · `V/spec` §2: las épicas se citan | `V/spec:49-51` | hecho |
| 21 · `D/11` cabecera y §1 | `D/11:13-14`, `D/11:22-31` | hecho |
| 22 · `D/03-handoff.md` | — | **no**: fuera del alcance por instrucción; lo actualiza el orquestador. La contradicción (c) no aparece en ningún capítulo del alcance (`D/16:297-298` ya dice *«cuatro de los seis»*) |
| 23 · `V/desc` §4 fila `V4` | `V/desc:498` | hecho |
| 24 · los pasos de la autorización (y `V/spec:152` *«fuente viva»*) | `V/17:58-60`, `:98`, `:111`, `:194-196`, `:424-428`, `:445-447`; `V/02:239`; `V/20:319`; `V/spec:63`, `:151-155`, `:195`, `:330`; `V/desc:58`, `:257` | hecho |

### 1.2 Las decisiones

| decisión | archivo:línea | estado |
|---|---|---|
| `G5-1` (1): una acción administrativa nunca tiene `actor = sujeto` | regla 5 en `V/17:329-337` (y *«Cinco reglas»* en `V/17:306-307`); `N/08:191-192`; `V/spec:202-204`; caso de `V5` en `V/desc:499` y en su fila `V/desc:58` | hecho |
| `G5-2` (2): fila nueva *«editar el contenido de una ficha ajena»*, 14 → 15 | fila en `N/08:166`; *«QUINCE filas»* `N/08:169-175`; *«dicen quince»* `N/08:179`; `N/08:262-263`; `V/17:310-316`, `:321`, `:346`, `:354-357`, `:368`, `:394`, `:408`, `:412-413`; `V/19:44`; `B/19:199`; `B/03:824`, `:1928`, `:2037-2038`, `:2042`, `:2063`, `:2132`, `:2439` | hecho; recontado con script sobre la tabla de `N/08` §3: **15 filas** |
| `G5-3` (2, contra la recomendación): la vuelta anticipada sigue libre, con detector | «NO cierra» de `B/03:2775-2786` y de `B/12:1062-1075`; detector en `N/08` §4.1 (`N/08:305-317`, donde se define el resumen de `DEC-OBS-001`) y su mención en `B/09` §2.3 (`B/09:66-69`); puntero en la fila `S10` (`B/03:156`) y en el invariante 24 (`N/04:67`) | hecho |
| `G5-4` (1): construir ya la fila de la revocación | fila nueva **`S36`** (`B/03:182`); `RF1` la nombra (`B/03:1813`); `B/22` §2.2 (`B/22:105-117`); `B5` en `B/desc:131`; la acción *«cancelar»* de `N/08:159`; invariante 22 en `N/04:65`; `B/spec:61` (`S1`–`S36`) | hecho; la lista cerrada `S1`–`S35` pasa a **`S1`–`S36`** (única aparición del rango en el alcance: `B/spec:61`) |
| `G5-5` (1): `G13` en `V4` | fila nueva en `V/20:57`; tachada en `B/20:55`; `B/20:351-357` (razón falsa tachada, *«`G9`-`G12` acá»*), `B/20:367-370` (15 + 20, `G13` en `V4`), `B/20:384-387` (cuatro → tres filas con unidad); `B/spec:70` (quince guards); `B/desc:130`, `:163-170`, `:301-306`; `V/desc:57` (`G13` en `V4`), `:79-102` (§2.3 reescrito), `:149-151`, `:271-273`, `:459` (18 + 13), `:477-479`; `V/spec:63`, `:366-369`, `:383`, `:388` (veinte guards, ocho con id propio) | hecho; el total de **31** no cambia |

### 1.3 Las contradicciones y el registro

| qué | archivo:línea | estado |
|---|---|---|
| (a) `G13` | ver `G5-5` | hecho |
| (b) pasarela | `D/11:13-14`, `D/11:22-31` | hecho (la 📌 de `DEC-ARCH-005` es del orquestador) |
| (c) FASE 7 | — | **no**: sólo vive en `D/03-handoff.md`, fuera del alcance |
| (d) criterio de `V4` | `V/desc:498` | hecho |
| (e) nueve pasos | ítem 24 | hecho |
| texto vencido de la matriz (`R11`) | ítems 1-5 | hecho |
| `N/04:123` 117 → sin número | ítem 18 | hecho |
| las 3 referencias rotas a `B/09` | ítem 19 | hecho, más una cuarta |

## 2. Lo que dejó declarado la opción contra la recomendación (`G5-3`)

La vuelta anticipada de una pausa sigue libre —*«volver cuando quiera»* del §26.2 a la letra—, y
con eso **una pausa de menos de un ciclo que cruza una fecha de cobro salteada regala ese ciclo**:
el proveedor saltea el cobro mientras la fila está `paused` y al volver cobra en el ciclo siguiente
(`PS-2`, `PS-5`, `PS-6`). Queda declarado, con su causa y *«owner 2026-09-26, `G5-3`»*:

- en `B/03`, *«lo que esta mitad NO cierra»*, primera entrada: la premisa de `DEC-SUB-010` (*«vuelve
  el mismo día del mes en que pausó»*) no vale con la vuelta libre; también queda el sobrecobro
  inverso (pausar el 5, volver el 25); ninguna transición lo detecta;
- en `B/12`, *«lo que este capítulo NO cierra»*, primera entrada: el costo para el cliente —hasta
  tres ciclos gratis por año, cifra del documento— y el sobrecobro inverso;
- **el detector**, en `N/08` §4.1, que es donde el diseño define el resumen de `DEC-OBS-001`: un
  tipo del resumen sin marca, que el barrido diario (`B/09` §2.3) llena con las pausas terminadas
  por `S10` cuyo `fin_real` cayó a menos de un ciclo del inicio y que cruzaron una fecha de cobro
  salteada, leídas de `subscription_pause` y de la fecha del próximo cobro, sin llamar al proveedor.
  No abre marca ni corta nada.

Lo que **no** se tocó: `DEC-SUB-010` en el log (propuesta en §3) y la superficie `B/19` (la opción 1
la tocaba; la 2 no necesita pantalla nueva).

## 3. Propuestas para el log y la matriz

Ninguna para la matriz. Para el log, cuatro 📌 y dos entradas nuevas; el texto es exacto.

1. **`DEC-RF-008`**, parte 2 y *Implicaciones* (dicen *«el catálogo pasa de trece a catorce
   acciones»* y *«pasan de trece a catorce»*, líneas ~5760 y ~5766 del log):

   > 📌 Recontado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-2`): el catálogo tiene hoy
   > **quince** acciones —la decimoquinta, *«editar el contenido de una ficha ajena»*, sin publicar,
   > destacar ni borrar—, y las líneas que lo cuantifican (`NUCLEO/08` §3, `V/17` §3.2 reglas 1 y 3,
   > §3.3, §3.4 y su ⚠️, §3.5, `B/19` §6) dicen quince. Lo de arriba es exacto para su fecha.

2. **`DEC-TEST-001`** (*«Se agregan a `B/20` §2»*, sobre `G12` y `G13`, línea ~4003):

   > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-5`): `G13` **pasó a `V/20`
   > §2 y lo construye `V4`**, como dice el contrato §6.3; la razón que lo traía a billing
   > (*«el consumidor del contrato es billing»*) era falsa. `B/20` §2 lista 15 filas y `V/20` §2, 20;
   > el total de 31 guards no cambia (18 en verticales y 13 en billing por columna de unidad).

3. **`DEC-SUB-010`**, después del *Motivo*:

   > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-3`, contra la
   > recomendación): la vuelta anticipada **sigue libre** (§26.2 a la letra), así que la premisa
   > *«vuelve el mismo día del mes en que pausó»* vale sólo para quien vuelve en el fin previsto. Una
   > pausa de menos de un ciclo que cruza una fecha de cobro salteada regala ese ciclo, y el
   > sobrecobro inverso existe. **Se acepta y se declara** (`B/03` y `B/12`, *«lo que … NO
   > cierra»*) y **se mide**: el barrido lista esas pausas en el resumen de `DEC-OBS-001`
   > (`NUCLEO/08` §4.1).

4. **`DEC-RF-001`**, parte 4 (convive con la 📌 de la parte 3, que no se toca):

   > 📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-4`): la parte 4 saca de
   > alcance **el botón**, no el derecho. Hasta que el botón entre, la revocación que llega por
   > correo o por soporte la registra una persona con *«cancelar una suscripción»* y motivo
   > revocación, y la ejecuta **`S36`** (`B/03` §3.2): desde `ACTIVE`, `GRACE_PERIOD` o
   > `CANCEL_SCHEDULED`, dentro de los 10 días, cancela el preapproval, corta el servicio en el acto
   > y crea `RF1` por el total. Es la operación única de la parte 1, y es lo que el botón va a llamar.

5. **Entrada nueva** (ID a asignar por el orquestador; familia de autorización o de admin), para
   `G5-1`:

   > **Una acción administrativa nunca tiene `actor = sujeto`.** Fecha 2026-09-26 · ACCEPTED ·
   > owner. **Problema**: con roles aditivos, quien confirma una acción del catálogo de `NUCLEO/08`
   > §3 podía ser el interesado, y `D11` se cumplía a la letra sin proteger nada. **Decisión**: el
   > paso 3 la rechaza (*«sin permiso»*) y la hace otra cuenta con el permiso; regla sin lista.
   > **Costo**: quien administra y es cliente necesita una segunda cuenta. **Dónde**: `V/17` §3.2
   > regla 5, `NUCLEO/08` §3, criterio de `V5`. **Origen**: `28-…/05-…` §5 `G5-1`, opción 1, la
   > recomendada.

6. **Entrada nueva** (ID a asignar), para `G5-2`:

   > **El admin edita el contenido de una ficha ajena con una acción propia, y nada más.** Fecha
   > 2026-09-26 · ACCEPTED · owner. **Decisión**: fila decimoquinta de `NUCLEO/08` §3 —crear en
   > borrador a nombre del dueño, corregir, restaurar contenido—, **sin publicar, destacar ni
   > borrar**; toda otra escritura del admin sobre lo ajeno necesita una fila. Con dos reglas que
   > valen para toda fila: un acto ajeno nunca es *«el dueño publica»* (no dispara `T1`) y ningún
   > borrado de ficha sale de otra fila que `PB9`/`PB12`. **Dónde**: `NUCLEO/08` §3, `V/17` §3,
   > `V/19` §2. **Origen**: `28-…/05-…` §5 `G5-2`, opción 2, la recomendada.

## 4. Residuos y choques con otros grupos

1. **`S36` no dice qué pasa si la fila es la predecesora de una sucesión en curso.** `S23` y `S24`
   disparan `S18` en ese caso; la opción 1 de `G5-4` no lo nombraba y no lo inventé. Es el mismo
   hueco de forma que ya cerraron esas dos filas: una pasada tiene que decir si `S36` también
   dispara `S18` (probable) y recorrer `G-R1-C` sobre ella.
2. **«Pagando» alcanzó doce líneas y no diez.** El documento contó diez con `cobrada`; dos más de
   `B/16` usan el plural *«cobradas»* con la misma lectura ancha (`B/16:600` y `:934`, orfandad
   `USER`/`GLOBAL`) y se cambiaron igual. Las demás apariciones de `cobrada` son el bit del
   contrato y no se tocaron.
3. **Una cuarta referencia rota a `B/09` §6.2**, en `N/04:144` (`D17`), escrita como *«cap. 09 §4 y
   §6.2, épica de billing»*: el resolvedor del documento sólo reconocía la forma `` `B/NN` §x ``.
   Corregida a *«§6, punto 2»*. Conviene que el resolvedor también lea la forma *«cap. NN §x
   (épica de …)»*.
4. **La fila decimoquinta no tiene unidad de construcción asignada.** Ni la opción ni el documento
   la asignan; la candidata natural es `V6` (la ficha) o `V8` (superficies). Queda para el
   orquestador; no lo decidí.
5. **Contradicción (c)**: sólo vive en `D/03-handoff.md:79`, `:154`, `:291`, fuera de mi alcance.
6. **Choques de edición**: `B/03` lo editaban otros grupos al mismo tiempo; varios `Edit` fallaron
   por archivo modificado y se reintentaron sobre el texto releído, sin pisar nada ajeno. En
   `B/03` ya hay textos de `R4` (`F-8V1B2-002` en `S11`) y de otro grupo en `S1` (`F-8V1C1-006`)
   con los que conviví.
7. **Vecino de `R1`**: la regla del destaque quedó en la fila 15 (*«sin destacar»*) y en la fila
   Admin de `V/19`; la migración del `is_featured` manual es de `R1`, otro grupo.
8. markdownlint sobre los 26 archivos tocados: **0 issues** (exit 0).

## Key Learnings

1. Cuando una decisión mueve una fila de un catálogo a otro, el conteo total puede quedar igual y
   aun así cambian **seis** cifras: filas de cada catálogo, guards por columna de unidad de cada
   épica, «con id propio» y la lista de «las filas que nombran su unidad».
2. Un resolvedor de referencias que reconoce una sola forma sintáctica deja pasar las otras: la
   cuarta referencia rota a `B/09` §6.2 estaba escrita como *«cap. 09 §6.2, épica de billing»*.
3. Contar una palabra con `rg` sin plural subestima el dominio: *«cobradas»* tenía la misma lectura
   ancha que *«cobrada»*.
4. En archivos editados en paralelo, leer y editar en el **mismo** bloque de llamadas evita el
   «modificado desde la lectura»; leer en un bloque y editar en el siguiente falla seguido.
5. Una opción elegida contra la recomendación se escribe mejor en tres lugares complementarios: el
   costo para el cliente (capítulo de producto), la causa en la máquina (capítulo de transiciones)
   y el detector donde vive el canal que lo muestra, que no siempre es el capítulo del barrido.
