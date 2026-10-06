---
title: "FASE 9 vuelta 2 · aplicación — coherencia y espejos pendientes"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo E, coherencia y espejos pendientes

Tres trabajos: los espejos que los grupos A–D dejaron en archivos que tenían vedados, los
hallazgos que nadie tomó, y el barrido de conteos de la vuelta. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre lo que dejaron commiteado los grupos
A (`a0865c7bf7`), B (`2d285a3c7c`), C (`b500361f93`) y D (`a4387871b3`). Leí enteros sus
registros [`11-`](./11-aplicacion-maquinas-de-billing.md),
[`12-`](./12-aplicacion-el-corte.md), [`13-`](./13-aplicacion-la-costura.md) y
[`14-`](./14-aplicacion-verticales.md). `D/16` es `16-fase-7-del-paraguas.md`, `B/` es
`HOS-1354…/docs` y `V/` es `HOS-1353…/docs`. No toqué R18, R24 ni `B/03` §3.2/§10.1.

## 1. Qué se aplicó

### Espejo de R11 — el 3b ancla la vertical de la cortesía (`F-8V2C1-004`, `F-8V2B3-009`)

El texto que propuso el grupo C (registro `13-` §1), con la lectura aplicada: *«de la vertical en
que tenían `comp`»*, y Alojamiento si la cortesía era de Alojamiento.

- `D/16:130` — «con la versión que elige quien opera el corte, aceptada sólo si `políticaDePlan(v).vigente`»
- `B/21:128` — «de la vertical en que tenían»

### Espejo de R9 — el corte no avanza si Gastronomía o Experiencia no dan cero (`F-8V2A3-003`)

La regla vive en `V/21` §2.4 (*«se detiene antes del paso 3»*). La puse en el gate del paso 2,
que es el último control antes del 3, y en la lista de disparadores de la rama de aborto, porque
en ese punto el 1b ya canceló. La alternativa de contar también antes del 1a va como pregunta (§4).

- `D/16:126` — «tiene que dar cero»
- `D/16:284` — «Gastronomía o de Experiencia que no da cero»
- `B/21:74` — «Las de Gastronomía y de Experiencia tienen que dar cero, o el corte no avanza»

### R27 — el paso 4c revalida las páginas de las fichas que nacieron despublicadas (`F-8V2C2-006`)

El texto de base es el que propuso el grupo D (registro `14-` §5). Lo puse como fila **4c**,
después del 4b y antes del 5. Ahí la rama de aborto ya no cubre, así que no hace falta un inverso
en su inventario: si se revalidaba antes y se abortaba, quedaban páginas que dicen *«despublicada»*
sobre fichas que el backup restaura a la vista. Cuesta unos minutos más de página vieja (§4,
pregunta 3). La herramienta es de V6, igual que la escritura de nacimiento.

- `D/16:133` — «revalidar las páginas públicas de toda ficha que nació `UNPUBLISHED_BY_BILLING` o `PURGED`»
- La lista de herramientas: `D/16:263` — «de las páginas de las fichas que nacieron despublicadas»
- El inventario de la rama de aborto lo nombra como fuera de su alcance:
  `D/16:313` — «lo revalida el 4c»
- `V/21` §2.4: `V/21:163` — «página pública la revalida el paso 4c del corte»

### R13 — la cita de `RC-2` (`F-8V2C2-007`)

`RC-1` es la fila que mide que *«`GET /preapproval/{id}` es confiable»*, y `RC-2` es el historial
de pagos. El mismo error estaba copiado en cuatro capítulos de billing. En dos de ellos además
se afirmaba `VERIFIED`, que es el estado de `RC-2`: `RC-1` es `PARTIALLY_SUPPORTED`, por el
buscador. Corregí las cinco apariciones.

- `D/16:126` — «`RC-2` es el historial de pagos»
- `B/02:313` — «id es otra cosa y es»
- `B/06:72` — «por id, confiable»
- `B/09:39` — «por id sí es confiable»
- `B/03:2743` — «(`RC-1`; FASE 9 vuelta 2, `F-8V2C2-007`), mientras que»

La cita de `RC-2` en `nucleo/04` (`D17`) es una lista de fuentes que incluye la lectura de pagos,
y está bien.

### R25 — qué corre al asentar un cobro sobre una lápida (`F-8V2B3-005`)

El asiento es `P1` con menos efectos. El `payment` pasa a `SUCCEEDED` y no se escribe
`covered_period`, no se toca ninguna promo ni se emite el aviso de cobertura, que no tendría
usuario ni vertical. La marca se escribe en la misma transacción que el `payment`, y desde R16 el
aviso sale después del commit, así que un consumidor caído no revierte el asiento.

- `B/03:1796` — «Sobre una lápida —la del corte o la de recepción— el asiento es este `P1`, con menos efectos»
- `B/21:269` — «Asentar es `P1` con menos efectos»

**El comprobante sí se emite.** El consolidado decía *«lo natural es que no»*, pero
`DEC-LEGAL-001` lo pone *«por cada cobro»*, y no emitirlo contradice una decisión firmada. Sin
destinatario, queda en su fila sin enviarse. Va como pregunta 2 para que el owner lo confirme.

### R20 — lo que es escritura (`F-8V2B3-007`, `F-8V2B3-008`)

- La comparación de monto no corre sobre una fila cuyo preapproval la relectura ve `cancelled`,
  la `CANCEL_SCHEDULED` y la `SUSPENDED` de tarjeta:
  `B/09:161` — «ni sobre una fila cuyo preapproval la relectura ve `cancelled`»
- El mismo recorte en `B/14` §2.4: `B/14:312` — «cuyo preapproval la relectura ve `cancelled`»
- Hay una sola regla de redondeo: la composición sin redondear, un solo redondeo al final, hacia
  abajo, con el mismo cálculo para quien muta y para quien compara.
  `B/14:52` — «Y el redondeo es uno, al final»
- La columna del barrido la nombra: `B/09:161` — «redondeado una sola vez y hacia abajo»

**Por qué hacia abajo.** Es la misma razón con que `B/14` §1.2 pone el porcentaje primero: a favor
del cliente. La diferencia con redondear al más cercano es de menos de un centavo por cobro, así
que no lo traté como dos lecturas con daño distinto: lo que importaba era que los dos lados
usaran la misma regla.

**`F-8V2B3-001` no se aplicó** (el importe cobrado que nadie compara): pide elegir productor,
motivo y cuándo se decrementa la promo, y las lecturas tienen daño distinto. Es la pregunta 1.

### Barrido de coherencia — espejos viejos arreglados

- `B/12` §5 decía *las otras veintiún*; ahora veintidós (23 − 1):
  `B/12:707` — «veintidós (FASE 9 vuelta 2)»
- `B/05` §3 decía *los otros veintiún motivos*; ahora veintidós:
  `B/05:300` — «veintidós motivos en el listado»
- `B/19` §3 decía *veintidós hoy*; ahora veintitrés:
  `B/19:209` — «veintitrés hoy: el 23 desde la FASE 9 vuelta 2»
- `B/19` §3 decía que el 15 *ordena como los otros seis*; ahora siete (ocho `SÍ`):
  `B/19:209` — «siete (FASE 9 vuelta 2).»
- `B/16` §4.3: la enumeración decía *las catorce* y listaba trece. `S31` estaba nombrada en el
  encabezado y no en la lista. `B/16:725` — «la sucesora del»

### Descomposiciones

| qué | unidad | dónde |
|---|---|---|
| el paso 4c | **V6** | fila, criterio y fila ✚ de §2.10 |
| el recuento que detiene el corte | **V6** | ya estaba (§2.10, `F-8V2A3-003`) |
| el ancla del 3b por la vertical de la cortesía | **B9** | ya estaba (grupo C) |
| el asiento sobre una lápida | **B11** | fila y criterio |
| la comparación de monto sin filas canceladas | **B11** | fila y criterio |
| el redondeo único | **B9** | fila y criterio |

- `$V/descomposicion.md:403` — «el paso 4c del corte: revalidar las páginas públicas»
- `$V/descomposicion.md:59` — «en el paso 4c del corte, la revalidación de las páginas públicas»
- `$V/descomposicion.md:523` — «la herramienta del paso 4c le pide al caché de páginas»
- `$B/descomposicion.md:135` — «el monto compuesto se redondea una sola vez, hacia abajo»
- `$B/descomposicion.md:741` — «un 15 % y un 10 % apilados sobre ARS 9.999»
- `$B/descomposicion.md:137` — «la comparación de monto no corre sobre una fila cuyo preapproval»
- `$B/descomposicion.md:743` — «un cobro sobre una lápida deja un `payment` en `SUCCEEDED`»

**Criterios que contradigan lo aplicado.** Busqué con `rg` sobre las dos `descomposicion.md` y los
dos `spec.md` una veintena de patrones de lo que cambió en la vuelta: *no se devuelve*, *sin marca*, *no
cancela los addons*, *hecho 4*, `fin_de_servicio`, *conserva el trial*, *paso 3*, *URL*,
*reclam*, *capacidad del actor*, *la de arranque*, *mismo acto*, `S36`, *precisión 7*,
`T3`, *lock*, *fila 1*, *de Alojamiento*, `RC-2`, *redonde*, *seudónimo*, y otros.
Siempre descontando lo tachado. **No quedó ninguno**: el de B10 que encontró el grupo A ya está
tachado (`$B/descomposicion.md:742`), y el resto dice lo aplicado. Todo lo nuevo de los grupos
A–D tiene unidad en su registro, y lo verifiqué contra la fila ✚ o contra el criterio.

## 2. Conteos recontados

Todo con `python3` sobre la fuente, descontando lo tachado (`re.sub(r'~~.*?~~','',…)`), y cada
espejo buscado por número **y por palabra** sobre `$D/nucleo`, `$V`, `$B`, el contrato y `D/16`.

| lista | antes → ahora | comando | resultado |
|---|---|---|---|
| motivos, `B/02` §2.5 | 22 → **23** | filas `^\| \d+( ✚)? \| \`MOTIVO\` \|` | 23. Palabra: `veintid[oó]s\|veinti[uú]n`. Espejos viejos: `B/12:707`, `B/05:300` y `B/19:209`, arreglados. Los demás son historia con fecha o *«las otras veintidós»* (23 − 1), que está bien |
| motivos con `SÍ` | 7 → **8** | la última columna de la misma tabla | SÍ 1, 2, 3, 7, 12, 15, 20, 23 · puede 4, 13, 14. Palabra: `siete` cerca de `SÍ`/*devolver*. El único viejo era *los otros seis* en `B/19:209`, arreglado. Los *siete SÍ* de `B/02` §2.5 y de `B/09` §7 son historia fechada |
| disparadores de orfandad, `B/16` §4.3 | 13 → **14** | los `S\d+` de la enumeración, más el espejo | **13** en la enumeración: faltaba `S31`, que el encabezado contaba. Arreglado (`B/16:725`), y ahora da 14. Palabra: `trece\|doce\|catorce` cerca de *orfandad*. `B/03:2561` y `B/19:227` dicen catorce |
| entradas del §4.1 del contrato | 7 → **8** | una entrada por línea del bloque `text` | 8 (7 preguntas y 1 operación), y 12 campos en las cuatro consultas. Palabra: `(seis\|siete\|ocho) (entradas\|preguntas)`. Sólo `D/12:1207`. El *«siete campos en tres preguntas»* de `$V/descomposicion.md:323` está marcado *«así era ese día»* |
| dependencias de billing sobre verticales, `$B/descomposicion.md` §2.6 | 11 → **12** | filas `^\| \d+` sin tachar | 12 (1–7, 9–13). Palabra: `once\|doce` cerca de *dependencia*. Sólo el título y `:359` |
| precisiones de `V/17` §1.2 | 7 → **8** | ítems `^\d+\. \*\*` hasta `### 1.3` | 8. Palabra: *precisiones*. `V/17:81` y `$V/spec.md:169` dicen ocho. Las demás son otras listas |
| acciones que son capacidad del actor | 15 → **14** (catálogo **15**) | la regla 3 de `V/17` §3.2 | Palabra: `quince\|catorce` cerca de *acción*/*capacidad*. Los *«quince»* restantes son el catálogo (`V/17:335`, `:378`, `:400`, `:464`), y está bien. *«Catorce»* está en `V/17:358`, `:422` y `:450` |
| filas de `V/19` §4 | 13 → **16** | `^\| (~~)?\d+` en el §4 | 16 (1, 2, 4, 8, 9, 18–28). No hay conteo congelado |
| filas de la tabla del corte, `D/16` §4.2 | 11 → 13 (grupo B) → **14** (4c) | `rg -c '^\| (0\|0b\|1a\|1b\|2\|2b\|3\|3a\|3b\|4\|4b\|4c\|5\|5b) \|'` | 14. Palabra: `(once\|doce\|trece\|catorce) pasos`, *«pasos del corte»*. No hay conteo congelado |
| salidas de `PAUSED`, `B/03` §3.2 | 5 → **6** terminales (grupo A) | filas `S\d+` con `PAUSED` en *desde* | 11 filas con `PAUSED` en *desde*. Las terminales son `S13`, `S17`, `S22`, `S25`, `S36` y el espejo. `B/03:820` dice seis y `B/09:575` dice siete, que son las que no son `S10`. Sin espejos viejos |
| comprobaciones de la rama de aborto | — | la frase de `D/16` §4.2 | suma el recuento de Gastronomía y Experiencia. No hay conteo congelado |

## 3. Propuestas para el log y la matriz

Grepeados antes: `DEC-MIG-003` (`$D/01-decision-log.md:2674`), `DEC-LEGAL-001` (`:911`). La
matriz llega hasta `EX-42` (`$D/06-mp-validation-matrix.md:398`), y los grupos A y B propusieron
`EX-43` a `EX-46`.

1. **`DEC-MIG-003`**, sumado al 📌 que propuso el grupo B (registro `12-` §3, punto 3). Razón: el
   gate y la rama de aborto ganan un disparador, y el corte gana un paso fuera de la rama. Texto
   propuesto, como viñeta más de ese 📌:
   > - El gate del paso 2 exige además que el recuento de fichas de Gastronomía y de Experiencia
   >   de la re-verificación dé cero; si no, el corte entra en la rama de aborto (`V/21` §2.4;
   >   FASE 9 vuelta 2, `F-8V2A3-003`). Y el paso 4c, después del 4b y fuera de la rama, revalida
   >   las páginas públicas de las fichas que nacieron despublicadas (`F-8V2C2-006`).
2. **Matriz, fila nueva**, con la numeración que siga a las de A y B (acá `EX-47`). Razón: sin
   medirlo no se sabe si el caso de `F-8V2B3-001` existe:
   > | **EX-47** ✚ | Si el monto de un preapproval se muta **después** de creado el registro de
   > cobro del ciclo (antes del lote, o durante sus reintentos), ¿el registro cobra el monto viejo
   > o el nuevo? | el importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; FASE 9 vuelta 2,
   > `F-8V2B3-001`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte sobre una sonda propia.
   > `PC-1` midió el monto vigente con la mutación mucho antes del cobro. Si cobra el viejo, la
   > pregunta 1 de este registro deja de ser teórica |
   El recuento pasaría a 104 filas con las de A y B, y los `UNKNOWN` suben uno. Los espejos están
   en `B/spec` §5.2, `$B/descomposicion.md` §2.7 y `B/06`, y no los toqué.

## 4. Preguntas abiertas

1. **R20, `F-8V2B3-001`: quién compara el importe cobrado y con qué motivo.**
   - **A: la comparación de cobros del barrido (`B/09` §3) compara el `transaction_amount` de cada
     registro aprobado contra el monto esperado del período que cubre, con un motivo nuevo, el 24,
     con `SÍ`.** **Daño**: ninguno de producto, pero el motivo nuevo mueve los dos conteos otra
     vez (24 motivos, 9 `SÍ`) con sus espejos en el núcleo, y el cobro de más se ve al día
     siguiente, no en el acto.
   - **B: `P1` compara en el acto y reusa el 5, `DIVERGENCIA_DE_MONTO`.** **Daño**: el 5 lleva
     *«no»*, así que el cobro de más se ve pero no se propone devolver, y Juan tiene que reclamar.
   - **Y en las dos**: si la promo se decrementa sólo sobre un cobro que salió con el descuento.
     Si sí, la promo de Juan no se pierde. Si no, como hoy, se pierde con el cobro de más. La
     fila `EX-47` (§3) dice si el caso existe.
   - Recomiendo **A**, con el decremento condicionado. No la apliqué: es mecanismo y motivo nuevo.
2. **R25: si el asiento sobre una lápida emite comprobante.** Apliqué **sí**, por
   `DEC-LEGAL-001` (*«por cada cobro»*). **Daño**: un número correlativo en un comprobante que no
   se envía a nadie, y que si la marca 7 devuelve el cobro queda como cualquier comprobante de un
   cobro devuelto. **La otra lectura, no emitirlo** (lo que sugería el consolidado): **daño**, un
   cobro retenido sin comprobante, contra una decisión firmada que necesitaría un 📌 del owner.
3. **R27: dónde va el paso 4c.** Apliqué **después del 4b**, fuera de la rama de aborto.
   **Daño**: las páginas viejas siguen visibles los minutos entre el paso 3 y el 4c. **La otra
   lectura, inmediatamente después del 3**: menos minutos, pero la rama de aborto gana un tercer
   objeto externo, con su inverso (volver a revalidar después de restaurar). Sin ese inverso, un
   aborto deja fichas restauradas que se ven como despublicadas hasta 48 h.
4. **R9: cuándo se cuenta Gastronomía y Experiencia.** Apliqué la letra de `V/21` §2.4: antes del
   paso 3, en el gate del paso 2. Pero en ese punto el 1b ya canceló, así que un recuento que no
   da cero manda el corte a la rama de aborto, y los clientes se re-suscriben por el link
   reactivado. **La otra lectura**: contar también antes del 1a, y no arrancar si ya ahí da una
   fila. **Daño**: ninguno, es la misma consulta. Pero es un control más, y una ficha creada entre
   ese recuento y el paso 2 la sigue viendo sólo el gate. Recomiendo sumar el recuento previo; no
   lo agregué porque ningún texto lo pide.

## 5. Casos vecinos

- **`B/16` §4.3, la segunda enumeración** (*«las que matan a la sucesora que relevaba»*: `S3`,
  `S13`, `S28`, `S31`). No revisé si `S36` sobre una sucesora sin autorizar entra ahí. Es otra
  enumeración de segundo orden, la familia de R28.
- **El paso 5 no espera al 4c.** Lo dejé así porque abrir altas no depende del caché. Si el owner
  quiere el 4c antes de dar el corte por sano, alcanza con sumarlo a la condición del 5.
- **El asiento del motivo 19 sobre una lápida** (`B/05` §3, *«cada una recibe el cobro por su
  propio camino»*) no nombra la lápida: sobre la del corte con un cobro del día, la persona que
  asienta tendría que correr el `P1` reducido de R25. No lo toqué.
- **`DEC-LEGAL-001` y los comprobantes de lápidas de recepción de sondas del manifiesto**: cada
  cobro de sonda consume un número. Es plata del owner, sin daño de cliente.

## 6. Los 56 hallazgos

Verificado con script: los IDs de esta tabla son exactamente los 56 encabezados `### F-8V2` de
los nueve informes, sin repetidos ni faltantes, y cada uno tiene un estado (el comando va abajo de
la tabla).

| ID | racimo | estado | grupo · registro | nota |
|---|---|---|---|---|
| `F-8V2A1-001` | R14 | aplicado | D · `14-` | |
| `F-8V2A1-002` | R14 | aplicado | D · `14-` | |
| `F-8V2A1-003` | R7 | aplicado | D · `14-` | con la pregunta 1 de `14-` (correo sin verificar) |
| `F-8V2A1-004` | R10 | aplicado | D · `14-` | |
| `F-8V2A2-001` | R15 | aplicado | D · `14-` | |
| `F-8V2A2-002` | R15 | aplicado | D · `14-` | |
| `F-8V2A2-003` | R22 | aplicado | D · `14-` | |
| `F-8V2A2-004` | R22 | aplicado | D · `14-` | |
| `F-8V2A2-005` | R7 | aplicado | D · `14-` | |
| `F-8V2A2-006` | R9 | aplicado | D · `14-`, espejo E · `15-` | con la pregunta 4 de `14-` (clase del correo) |
| `F-8V2A2-007` | R13 | aplicado | D · `14-` | |
| `F-8V2A2-008` | R12 | aplicado | C · `13-` | |
| `F-8V2A3-001` | R5 | aplicado | C · `13-` | con las preguntas 1 y 2 de `13-` (dónde guarda billing la fecha; quién escribe `admite_altas`) |
| `F-8V2A3-002` | R6 | aplicado | B · `12-` | |
| `F-8V2A3-003` | R9 | aplicado | D · `14-`, espejo E · `15-` | con la pregunta 4 de `15-` (cuándo se cuenta) |
| `F-8V2A3-004` | R23 | aplicado | D · `14-` | con la pregunta 2 de `14-` (dominios de la normalización) |
| `F-8V2A3-005` | R24 | pendiente del owner | — | pregunta 3 de `14-`; `B/10` §4.1 sin tocar |
| `F-8V2A3-006` | R13 | aplicado | D · `14-` | |
| `F-8V2B1-001` | R1 | aplicado | A · `11-` | con la pregunta 2 de `11-` (orden `S12`/`S21`) |
| `F-8V2B1-002` | R17 | aplicado | A · `11-` | |
| `F-8V2B1-003` | R4 | aplicado | A · `11-` | |
| `F-8V2B1-004` | R17 | aplicado | A · `11-` | |
| `F-8V2B1-005` | R17 | aplicado | A · `11-` | |
| `F-8V2B1-006` | R2 | aplicado | B · `12-` | |
| `F-8V2B2-001` | R18 | pendiente del owner | — | pregunta 1 de `11-` |
| `F-8V2B2-002` | R19 | aplicado | A · `11-` | |
| `F-8V2B2-003` | R4 | aplicado | A · `11-` | |
| `F-8V2B2-004` | R4 | aplicado | A · `11-` | |
| `F-8V2B2-005` | R19 | aplicado | A · `11-` | |
| `F-8V2B3-001` | R20 | pendiente del owner | — | pregunta 1 de `15-`; fila `EX-47` propuesta |
| `F-8V2B3-002` | R2 | aplicado | B · `12-` | |
| `F-8V2B3-003` | R3 | aplicado | B · `12-` | con la pregunta 2 de `12-` (texto de `G4-1`) |
| `F-8V2B3-004` | R8 | aplicado | B · `12-` | |
| `F-8V2B3-005` | R25 | aplicado | E · `15-` | con la pregunta 2 de `15-` (comprobante) |
| `F-8V2B3-006` | R2 | aplicado | B · `12-` | |
| `F-8V2B3-007` | R20 | aplicado | E · `15-` | |
| `F-8V2B3-008` | R20 | aplicado | E · `15-` | |
| `F-8V2B3-009` | R11 | aplicado | C · `13-`, espejos E · `15-` | con la pregunta 3 de `13-` |
| `F-8V2C1-001` | R5 | aplicado | C · `13-` | |
| `F-8V2C1-002` | R16 | aplicado | C · `13-` | |
| `F-8V2C1-003` | R12 | aplicado | C · `13-` | |
| `F-8V2C1-004` | R11 | aplicado | C · `13-`, espejos E · `15-` | |
| `F-8V2C1-005` | R26 | aplicado | C · `13-` | |
| `F-8V2C1-006` | R26 | aplicado | C · `13-` | |
| `F-8V2C1-007` | R12 | aplicado | C · `13-` | |
| `F-8V2C2-001` | R6 | aplicado | B · `12-` | |
| `F-8V2C2-002` | R3 | aplicado | B · `12-` | |
| `F-8V2C2-003` | R21 | aplicado | B · `12-` | con la pregunta 1 de `12-` (aviso previo) |
| `F-8V2C2-004` | R2 | aplicado | B · `12-` | |
| `F-8V2C2-005` | R8 | aplicado | B · `12-` | |
| `F-8V2C2-006` | R27 | aplicado | E · `15-` | con la pregunta 3 de `15-` (lugar del 4c) |
| `F-8V2C2-007` | R13 | aplicado | E · `15-` | |
| `F-8V2D1-001` | R1 | aplicado | A · `11-` | |
| `F-8V2D1-002` | R10 | aplicado | D · `14-` | |
| `F-8V2D1-003` | R28 | aplicado | A · `11-` | |
| `F-8V2D1-004` | R28 | aplicado | A · `11-` | |

**Resumen**: 53 aplicados y 3 pendientes del owner (`B2-001` por R18, `A3-005` por R24 y
`B3-001` por la pregunta 1 de este registro). Ninguno quedó declarado. Once de los aplicados
llevan una pregunta abierta sobre la lectura elegida.

La verificación, desde `29-fase-8-vuelta-2/`:

```text
python3 - <<'EOF'
import re,glob
h=[m.group(1) for f in sorted(glob.glob('[A-D][0-9]-*.md')) for l in open(f)
   for m in [re.match(r'^### (F-8V2[A-D]\d-\d{3})',l)] if m]
t=[r for r in re.findall(r'(?m)^\| `(F-8V2[A-D]\d-\d{3})` \|[^|]*\| ([^|]+) \|',
   open('15-aplicacion-coherencia.md').read())]
ids=[i for i,_ in t]
print(len(h),len(set(h)),len(ids),len(set(ids)),set(h)==set(ids),
      all(s.strip() for _,s in t))
EOF
# 56 56 56 56 True True
```

## Key Learnings

1. Un error de cita no vive en un solo lugar. `RC-2` por `RC-1` estaba en cinco capítulos, y en
   dos de ellos arrastraba además el estado de la fila equivocada (`VERIFIED`). Corregir sólo la
   línea del hallazgo dejaba cuatro copias.
2. Una enumeración puede tener bien el total y mal la lista. `B/16` §4.3 decía *«las catorce»* y
   listaba trece, porque `S31` estaba contada en el encabezado. Contar los elementos y no la
   palabra fue lo que lo encontró.
3. Buscar espejos por palabra encontró tres que el número no: *«veintiún»* (dos veces) y
   *«veintidós hoy»*. Y hubo un cuarto que ninguna cifra nombraba: *«ordena como los otros seis»*,
   que depende del conteo de `SÍ` sin decirlo.
4. Dónde va un paso nuevo del corte depende de la rama de aborto. Antes de su frontera, todo lo
   que toca afuera de la base pide un inverso en el inventario. Después, no pide nada.
5. *«Lo natural es que no»* en un consolidado no alcanza para contradecir una decisión firmada
   (`DEC-LEGAL-001`). Se aplicó la decisión, y la otra lectura quedó como pregunta.
