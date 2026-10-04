---
title: "FASE 9 vuelta 1 · atribución de los críticos de la FASE 8 vuelta 1 contra los diffs"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — ¿los críticos los generó la tanda anterior?

Este documento aplica la **cláusula 1 de `DEC-METH-013`**: *«un `CRITICA` cuenta como generado por
la tanda anterior, y la atribución se dictamina contra los DIFFS, nunca contra mensajes de
commit»*. Se atribuyen los tres críticos de `27-fase-8-vuelta-1/00-hallazgos.md` §2: el declarado
(R1) y los dos que el consolidador propone subir (R2, R4).

> **Lo que este documento NO hace.** No decide si R2 y R4 suben a `CRITICA`, no propone arreglos
> y no decide si se gira otra vuelta. Dictamina de dónde salió el texto que abre cada camino.

Convenciones de rutas, las mismas de los informes: `$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`,
`$B` = `.specs/HOS-1354-billing-cobro-y-proveedor`, `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`.
Las líneas son las del texto al cierre de la tanda (`285a02442f`); ningún commit posterior toca las
líneas citadas (ver §1).

---

## 1. El rango de la tanda, medido

Con `git log --format='%h %ad %s' --date=iso -- .specs/`:

| borde | SHA | fecha | qué contiene el diff |
|---|---|---|---|
| último commit **antes** | `94a1eb4760` | 2026-09-25 20:17 | sólo agrega `26-fase-9-completa/10-decisiones-del-owner.md` (54 líneas); no toca ningún capítulo |
| **primer** commit de la tanda | `75f64f111c` | 2026-09-25 20:27 | primer diff que aplica decisiones del `10-`: `$D/16-fase-7…`, `$V/docs/21-migracion.md`, `$B/docs/21-migracion.md` (2a a 2g y 5c) |
| **último** commit de la tanda | `285a02442f` | 2026-09-26 02:30 | sólo `03-handoff.md` |

Son **25 commits** sobre `.specs/` en `94a1eb4760..285a02442f`. Entre `2eaf593663` (los caminos
reejecutados, 18:15) y `75f64f111c` no hay ningún diff de capítulo, así que la **línea de base**
contra la que se mide es `94a1eb4760`.

Después de la tanda y antes de la auditoría (`81f94c7c69`, 02:57) entran `204a766e93` y
`47e8c3ea85` (`DEC-MP-006`). Sus diffs tocan `01-decision-log.md` en `DEC-MP-006`,
`11-particion…`, `$B/descomposicion.md`, `$B/spec.md` y `$B/docs/06-proveedor.md`: **ninguna** de
las líneas citadas por R1, R2 o R4. No alteran ningún dictamen.

Los registros `11-` a `22-` se usaron sólo para ubicar qué commit aplicó qué decisión. Todo
dictamen sale de `git blame -s <rango> 285a02442f` y de `git show <sha> -- <archivo>`.

---

## 2. R1 — el trial que `2g` regala no se alcanza · **GENERADO**

### 2.1 Qué produce el camino

El camino de `F-8V1C2-001` (y de `F-8V1A3-002`, `F-8V1D1-001`, `F-8V1A2-001`) tiene cuatro
ingredientes:

1. **la promesa**: la cartera vieja estrena el trial y su próxima publicación lo arranca por `T1`;
2. **la ficha baja**: el reconciliador del primer día corre `PB2` y la deja en `UNPUBLISHED_BY_BILLING`;
3. **el callejón**: ninguna fila del dueño sale de `UNPUBLISHED_BY_BILLING` (`PB1` sale de `DRAFT`,
   `PB6` de `PUBLISHED`);
4. **el botón**: la fila 23 manda a publicar a quien *«todavía no publicó»*.

### 2.2 Los hunks

**Ingrediente 1, la promesa — la escribió la tanda y borró el texto que cerraba el camino.**
`git blame` de `$V/docs/21-migracion.md:71-77` y `:154-157` da `75f64f111cd` en todas las líneas.
El hunk de `git show 75f64f111c -- $V/docs/21-migracion.md` (`@@ -59,14 +59,22 @@`) tacha la
siembra de trials consumidos y agrega la promesa:

```diff
-  el checkout igual.~~ **Ya no se pierde** (FASE 8 completa, owner 2026-09-25): el corte escribe
+  el checkout igual.~~ ~~**Ya no se pierde** (FASE 8 completa, owner 2026-09-25): el corte escribe
   una fila de `trial` **ya consumida** por cada dueño que tenía ficha o suscripción en el sistema
…
+  trial: es la misma forma que la lápida de billing.~~ **El trial ya consumido de todo cliente
+  actual se pierde, y a propósito**: el corte no siembra trials consumidos, así que quien tenía
+  ficha o suscripción en el sistema viejo **puede estrenar el trial en el sistema nuevo** (owner
```

y, en `@@ -117,20 +130,31 @@`, bajo el guion preexistente de las llamadas:

```diff
 > se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve.
+> **Y desde `2g` tienen además el camino del cliente nuevo**: sin fila de `trial`, volver a
+> publicar —o el botón de suscribirse, que manda a publicar a quien todavía no publicó en esa
+> vertical (`V/19`; owner 2026-09-25, FASE 9 completa, `6c`)— les arranca el trial como a
+> cualquiera (`T1`, `V/03` §2).
```

El mismo cambio en la máquina de trial: `$V/docs/03-maquinas-de-estado.md:358-364` es
`8112cb93183`, y su hunk tacha *«deja a esa persona en `TRIAL_CONVERTED`»* y agrega:

```diff
+`PRE_TRIAL` sin fila y **su próxima publicación arranca un trial por `T1`**, como la de cualquiera;
```

En `$D/16-fase-7-del-paraguas.md:162-163` (`75f64f111cd`): *«**El corte no escribe filas de
`trial`**: los clientes actuales se tratan como nuevos»*. En el log, `DEC-MIG-005`
(`01-decision-log.md:5656` y siguientes) es `dd2e69af6f7`, también de la tanda. La decisión del
owner (`2g`) entró en `94a1eb4760`, un commit antes de la tanda y sin tocar capítulos.

**Ingrediente 2, la ficha baja — la tanda cambió el mecanismo, no el desenlace.**
`$V/docs/21-migracion.md:145-150` y `$D/16-…:168-171` son `75f64f111cd`. El hunk tacha
*«`PB2` se dispara **por el cambio de `cubierto`** … **se despublican la mañana del corte**»* y
agrega *«**las despublica la primera corrida del reconciliador diario de cobertura** … **dentro del
primer día**»*. Antes y después la ficha termina en `UNPUBLISHED_BY_BILLING`.

**Ingrediente 3, el callejón — preexistente.** En `$V/docs/03-maquinas-de-estado.md`:

| fila | línea | SHA | fecha |
|---|---|---|---|
| `PB1` (`DRAFT` →) | 506 | `edd75379995` | 2026-09-25 17:28 |
| `PB2`, `PB3` | 507-508 | `a8e5e576dd7` | 2026-09-25 17:13 |
| `PB6` (`PUBLISHED` → `DRAFT`) | 511 | `9796d4e2b3c` | 2026-09-18 12:54 |
| prosa *«desde donde no salía ninguna otra fila»* | 584 | `bffc37f836f` | anterior a la tanda |

La nota de `PB11` que cita `F-8V1C2-001` (`:516`, *«`PB1` sale sólo de `DRAFT`»*) sí es
`8112cb93183`, pero repite en prosa lo que la tabla ya decía; no abre nada.

**Ingrediente 4, el botón — lo escribió la tanda.** `$V/docs/19-superficies.md:69` (fila 23) es
`8112cb93183`; su hunk es una línea entera nueva (`+| 23 | el **botón de suscribirse** … **cuando
la persona todavía no publicó en esa vertical**`). La fila espejo `$B/docs/19-superficies.md:137`
(fila 21) es `0e09e043b02`. El segundo caso de `F-8V1A2-001` (el alta cuyo primer cobro rechaza)
sale de `$V/docs/03-maquinas-de-estado.md:222-226`, también `8112cb93183`:

```diff
+  persona queda en `PRE_TRIAL`: su próximo `PB1`, sin cobertura, arranca el trial por `T1`.
```

### 2.3 Lo que decía el texto antes de la tanda

El párrafo de contexto del mismo hunk de `75f64f111c`, que la tanda no tocó (`e6f4ff3a7d3`, 20/09),
ya decía que el evento de activación no volvería a ocurrir: *«Y el evento que los sacaría **ya
ocurrió**: `T1` dispara con *«la ficha queda publicada»*, que es la **transición** de publicar, y
sus fichas ya están publicadas.»* Con la fila consumida sembrada por el corte, eso era inocuo: el
dueño viejo amanecía en `TRIAL_CONVERTED`, no tenía trial que estrenar, y *«contratan»* cobrando el
primer ciclo **era el diseño**. El callejón de `UNPUBLISHED_BY_BILLING` existía, pero no dejaba
ninguna promesa sin cumplir.

### 2.4 Dictamen

**GENERADO.** La tanda escribió la promesa (`75f64f111c`, `8112cb9318`), escribió el botón que
empuja hacia ella (`8112cb9318`, `0e09e043b0`) y **borró el texto que cerraba el camino**: la
siembra de la fila consumida que dejaba a la cartera en `TRIAL_CONVERTED`. El callejón es anterior,
pero sólo se vuelve crítico por la promesa.

Dos matices, sin mover el dictamen:

- **Las otras caras de `F-8V1A3-001` son preexistentes**: la ficha nacida `ARCHIVED`, la
  despublicada por el dueño, la `PENDING` de moderación, `is_featured`. Ya en la base (`e6f4ff3a7d3`)
  `V/21` §2.4 razonaba como si toda ficha amaneciera publicada, y ningún hunk de la tanda agregó ni
  quitó una traducción de columnas. Son `ALTA`, no forman el crítico.
- La tanda **ejecutó una decisión del owner** (`2g`). Que la haya generado no quiere decir que
  la decisión esté mal: quiere decir que el texto que la aplicó no revisó la máquina de
  publicación.

---

## 3. R2 — la llegada a `PURGED` no llega a billing · **PREEXISTENTE**

### 3.1 Qué produce el camino

El camino de `F-8V1A3-003` y `F-8V1C1-001` es este: `A6` espera un hecho de verticales (*«se borra
la ficha destino»*, `PB9`/`PB12`), el contrato no tiene ningún canal verticales → billing para ese
hecho, y nada más apaga el addon `LISTING`.

### 3.2 Los hunks

**El contrato sin canal — preexistente.** En `$D/12-contrato-de-cobertura.md`:

| línea | cita | SHA | fecha |
|---|---|---|---|
| 812 | *«Es lo único que billing le **empuja** a verticales.»* | `cf2ca9b305d` | 2026-09-18 |
| 941-946 | las consultas de política y *«La inversa transporta política y estado de catálogo»* | `4f34afa1ac7` | 2026-09-19 |
| 1018-1019 | *«si billing necesita leer de verticales algo que no está entre los siete campos»* | `64134689047` | 2026-09-23 |

`git diff 94a1eb4760 285a02442f -- $D/12-contrato-de-cobertura.md` no tiene ningún hunk sobre esas
líneas, ni ninguno que mencione `PURGED`, `A6` o un hecho en dirección inversa.

**`A6` y su evento — el evento es anterior a la tanda.** El hunk de `0e09e043b02` sobre
`$B/docs/03-maquinas-de-estado.md` muestra que el evento ya estaba en la base:

```diff
-| A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` | **se consume** …
+| A6 | `ACTIVE` —**o `PENDING_AUTHORIZATION`**: … | se borra la ficha destino —**cualquier llegada a `PURGED`**: `PB9`, el día 180, o `PB12`, el dueño (`V/03` §9)— | `CANCELLED` | **es la ÚNICA fila que ejecuta el borrado de la ficha** (FASE 9 completa, `K-9` de `05`) …
```

**Lo que `K-9` cambió.** El mismo commit saca el borrado de la orfandad de `A5`
(`$B/docs/16-addons.md:428`, `0e09e043b02`):

```diff
-| `LISTING` | … **una de dos**: la ficha **se borró** —**cualquier llegada a `PURGED`**: `PB9`, el día 180, o `PB12`, el dueño …
+| `LISTING` | … **ninguna suscripción principal de ese `user + vertical`** … es fila viva … **El borrado de la ficha ya no está en esta fila**: lo ejecuta sólo `A6` …
```

### 3.3 Por qué `K-9` no abre el camino

En la base, las **dos** puertas —la primera mitad de la orfandad de `A5` y `A6`— esperaban el
**mismo** hecho de verticales, *«la ficha se borró»* = llegada a `PURGED`, y el contrato no lo
transportaba para ninguna. Además, por la regla 7 del núcleo, con las dos filas compartiendo
`(ACTIVE, llegada a PURGED)` **no corría ninguna** (el hunk de `0e09e043b02` en `$B/docs/16-addons.md`
lo dice en su justificación: *«leída al pie de la letra, **ninguna corría y el addon seguía
cobrando**»*). `K-9` cerró esa colisión y dejó una sola puerta **con el mismo hecho sin
transporte** que ya tenían las dos. No escribió ni borró el texto que abre el camino.

### 3.4 Dictamen

**PREEXISTENTE** para el crítico propuesto: el hueco es el contrato (`cf2ca9b305d`, `4f34afa1ac7`,
`64134689047`), anterior a la tanda y sin tocar por ella.

**Lo que sí es de la tanda son los eslabones de registro del racimo, no el crítico**: `K-9` se aplicó
en `$B` y no cruzó a `$V` ni al núcleo. Las notas de `PB9`/`PB12` que siguen mandando el borrado a
`A5` (`$V/docs/03-maquinas-de-estado.md:514` y `:681-684`, `edd75379995` y `a8e5e576dd7`, anteriores)
y el inventario del glosario (`$D/nucleo/01-glosario.md:571`, `d08e7ea202c`, 23/09) **quedaron
vencidos** por el cambio de `0e09e043b02`. Eso genera `F-8V1A2-002`, `F-8V1C1-013` y `F-8V1D1-009`
(ALTA/BAJA/MEDIA). El daño de plata no depende de ellos: con esas notas corregidas, billing seguiría
sin enterarse del borrado.

---

## 4. R4 — el desempate de motivos es lista cerrada de un solo productor · **PREEXISTENTE**

### 4.1 Qué produce el camino

El camino que sostiene la propuesta de `CRITICA` es el del **segundo productor**: el barrido ve un
cobro `approved` sin `payment` sobre una fila terminal y abre `COBRO_SIN_REGISTRAR`, cuyo default
es *«no hay nada que devolver: asentarlo»* (`F-8V1B2-003`; sobre la lápida, determinístico,
`F-8V1B3-002`). Los otros tres hallazgos (`F-8V1B2-002`, `F-8V1B1-007`, `F-8V1C2-013`) son celdas
que faltan en la tabla del desempate.

### 4.2 Los hunks

| ingrediente | archivo:línea | SHA | fecha |
|---|---|---|---|
| el barrido recorre terminales devueltas por las salvedades | `$B/docs/09-conciliacion.md:115-116` | `4e383480d30` | 2026-09-21 |
| si el barrido ve el cobro primero, abre `COBRO_SIN_REGISTRAR` | `$B/docs/05-idempotencia-y-concurrencia.md:241-242` | `00150d12f3a` / `5933e22db41` | 2026-09-25 02:50 / 12:41 |
| la comparación de cobros abre el motivo 19 sin mirar el estado de la fila | `$B/docs/09-conciliacion.md:123` | `2a2587ef745` (ver abajo) | — |
| el 19 pasa a **no** devolver | `$B/docs/02-modelo-de-datos.md:981-986` | `b6402ef6af2` | 2026-09-25 13:11 |
| la lápida entra al barrido | `$B/docs/21-migracion.md:166-170`, `177-181` | `4e383480d30` | 2026-09-21 |
| el desempate: tres filas, comodín | `$B/docs/05-idempotencia-y-concurrencia.md:302-316` | `4f20c02ca83` | 2026-09-23 |
| condición 1, sin `CANCEL_SCHEDULED` ni `CHARGE_DECLINED` | `$B/docs/05-idempotencia-y-concurrencia.md:268` | `9867d56ffed` | 2026-09-17 |
| `S26` remite a *«cualquier `CANCEL_SCHEDULED`»* | `$B/docs/03-maquinas-de-estado.md:168` | `70df15dfb3c` | 2026-09-25 01:51 |

`$B/docs/09-conciliacion.md:123` figura como `2a2587ef745` (tanda), pero su hunk deja **intacta**
la cláusula del motivo 19 (aparece igual en la línea `-` y en la `+`: *«se abre la **marca** con
motivo **`COBRO_SIN_REGISTRAR`** … (`DEC-CONC-002` punto 4; FASE 8 completa, `F-8CB3-003`)»*) y sólo
agrega al final:

```diff
+… pendiente 6, owner 2026-09-25). **Y si la lectura del §4 da *«intentó y se rechazó»* sobre el período en curso de una fila `ACTIVE` con al menos un pago acreditado, corre `S4`** (owner 2026-09-25; FASE 9 completa, 9a …
```

que es una rama sobre filas `ACTIVE`, ajena al camino.

### 4.3 Lo que la tanda tocó al lado del camino

Tres hunks de la tanda caen cerca. Ninguno abre el camino:

1. **La fila 1 del desempate** (`$B/docs/05-…:307`, `0a15f63c78d`) **amplía** la enumeración:

   ```diff
   -| la condición **1** falla porque la fila está `CANCELLED` **y la cancelamos nosotros o la pidió el cliente** — `S11`/`S12`, `S17`, `S22`, `S23`, `S24` o el espejo del `B/03` §10.1 | **`COBRO_POSTERIOR_A_LA_BAJA`** (§2 `C2`) |
   +| … — ~~`S11`/`S12`, `S17`, `S22`, `S23`, `S24` o el espejo del `B/03` §10.1~~ **toda transición que lleva la fila a `CANCELLED` salvo las de un *Free Forever***: `S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo … |
   ```

   Cierra cuatro celdas que caían en el comodín. La forma de lista cerrada, y la ausencia de
   `CHARGE_DECLINED` y de la lápida, estaban en la base (`4f20c02ca83`).

2. **La fila 19** (`$B/docs/02-…:937`, `0a15f63c78d`) precisa qué es asentar:

   ```diff
   +… y decidir a qué período corresponde. **Precisado: asentarlo es crear la fila de `payment` en `PENDING` con el id del registro y correr `P1` sobre ella** —que emite el comprobante, escribe `covered_period` …
   ```

   Vuelve concreto el daño (comprobante y `covered_period` sobre una fila `CANCELLED`). Pero el
   default que da la instrucción equivocada, **no** devolver, es anterior (`b6402ef6af2`), y el
   camino ya terminaba en *«asentar el cobro: registrarlo»*.

3. **La lápida en el barrido** (`$B/docs/21-migracion.md:167-173`, `75f64f111cd`):

   ```diff
   -> §4.2), así que vuelve al barrido **hasta que la relectura la vea `cancelled`**. Es exactamente
   +> §4.2; FASE 9 completa, `CT-2`/`C-6`), así que vuelve al barrido **hasta que la relectura la vea
   +> `cancelled`**. **Entra al barrido aunque el paso 2 ya la haya visto `cancelled`**, y no mueve
   ```

   La frase nueva no agrega la entrada: la **conserva** frente al paso 2 que la misma tanda
   introdujo. En la base no había paso 2, y la lápida ya entraba en la primera corrida.

Y un hecho externo que la tanda **registró**, no generó: el cobro del 2026-09-26 (`CT-6`,
`$B/docs/21-migracion.md:73-76`, `75f64f111cd`). El texto de la base decía *«no hay ninguno»*,
una premisa que el calendario volvía falsa. Es la clase *«medición externa»* que `DEC-METH-013`
excluye del conteo.

### 4.4 Dictamen

**PREEXISTENTE.** Los tres ingredientes del camino crítico —terminales en el barrido, motivo 19
desde la comparación de cobros sin mirar el estado, default de no devolver— son anteriores a la
tanda, y ninguno de sus hunks los toca. La tanda amplió la enumeración sin cambiarle la forma,
precisó qué hace *«asentar»* y conservó la entrada de la lápida.

Hay **una sola pregunta del racimo que pisa texto de la tanda**: la del owner en `F-8V1B3-002`
(*¿el cobro en vuelo de la ventana del corte se devuelve?*). Existe porque `2a`/`DEC-MIG-005`
(`75f64f111c`, `dd2e69af6f`) decidieron no conservar nada y resignaron sólo la diferencia de la
rama de aborto. Es una **pregunta sin contestar**, no el camino del crítico, y no cambia el
dictamen.

---

## 5. Tabla de cierre

| crítico | dictamen | SHA(s) que deciden | hunk |
|---|---|---|---|
| **R1** · el trial de `2g` es inalcanzable (`F-8V1C2-001` + 4) | **GENERADO** | `75f64f111c` (`$V/21`, `$D/16`), `8112cb9318` (`$V/03` §2, `$V/19` fila 23), `0e09e043b0` (`$B/19` fila 21); callejón preexistente en `9796d4e2b3`, `a8e5e576dd`, `edd7537999` | `+> **Y desde 2g tienen además el camino del cliente nuevo**` · `+PRE_TRIAL sin fila y **su próxima publicación arranca un trial por T1**` · tachado de *«el corte escribe una fila de trial ya consumida»* (§2.2) |
| **R2** · `PURGED` no llega a billing (propuesto) | **PREEXISTENTE** (los eslabones de registro, generados por `K-9`) | `cf2ca9b305`, `4f34afa1ac`, `6413468904` (contrato); `0e09e043b0` (`K-9`, no abre el camino) | la línea `-` de `A6` en `0e09e043b0` ya decía *«se borra la ficha destino»* · ningún hunk de la tanda sobre `$D/12` §3 ni §4 (§3.2) |
| **R4** · desempate de un solo productor (propuesto) | **PREEXISTENTE** | `4e383480d3`, `00150d12f3`, `5933e22db4`, `b6402ef6af`, `4f20c02ca8`, `9867d56ffe`; la tanda, al lado: `0a15f63c78`, `75f64f111c`, `2a2587ef74` | la cláusula del 19 en `$B/09:123`, igual en `-` y `+` · `+… **toda transición que lleva la fila a CANCELLED salvo las de un Free Forever**` (amplía la lista, no abre el camino) (§4.2, §4.3) |

**Conteo: 1 de 3 generados por la tanda.** Si sólo se cuenta el crítico declarado (R1), **1 de 1**.
Si el owner rechaza las dos propuestas, los que quedan en pie son todos de la tanda; si las acepta,
se suman dos preexistentes.

## 6. Qué implica para `DEC-METH-013`, sin decidir por el owner

- **La condición de corte no se cumple, se lea como se lea.** Queda un crítico declarado, y es de
  la tanda. El consolidado ya lo había leído así (*«plausible no es el dictamen»*); ahora está
  medido contra el diff.
- **La vuelta que viene es la 2, la última del tope** (cláusula 2). Si la tanda que arregle R1
  vuelve a generar un crítico, se pasa a declarar.
- **Si el owner sube R2 y R4, no cuentan para decidir si se gira.** Son preexistentes: el texto que
  abre su camino es anterior al 25/09 20:27 y ninguna tanda del ciclo 8↔9 lo generó. Es lo que
  `DEC-METH-013` llama *«girar por algo que girar no arregla»*: esa condición **no** los manda a
  declarar ni prohíbe arreglarlos. Sólo dice que no son la señal del corte. Siguen necesitando
  destino: arreglo o declaración con causa, elegido por el owner (cláusula 3).
- **La cláusula 4 aplica igual a R2 y R4**: los dos son de plata del cliente, así que no se declaran
  con causa sin que los lea el owner.
- **La serie de atribución.** Las vueltas anteriores daban 25/25, 17/17, 13/14, 12/12 y 6/8. Ésta da
  **1/3** (o 1/1 contando sólo los declarados). Es la primera vez que los generados son minoría
  entre los críticos propuestos. Que el único generado venga de **ejecutar una decisión del owner
  contra una máquina que el texto no releyó** es un dato sobre el tipo de arreglo que genera
  críticos, no un veredicto sobre la decisión.

## Key Learnings

1. El `blame` de una línea da el último commit que la tocó, no quién abrió el camino.
   `$B/09:123` figura como `2a2587ef74` (tanda), pero en su hunk la cláusula del motivo 19 aparece
   igual en `-` y en `+`. Sin abrir el hunk, R4 habría salido GENERADO.
2. Un crítico puede ser GENERADO aunque sus piezas mecánicas sean viejas. El callejón de
   `UNPUBLISHED_BY_BILLING` data del 18/09. Lo que lo volvió crítico fue que la tanda escribió una
   promesa y borró la fila consumida que lo hacía inocuo. Hay que atribuir el texto que **abre** el
   camino, y a veces ese texto es un borrado.
3. Que un arreglo mueva la puerta (`K-9`, de dos filas a una) no lo hace dueño del hueco que la
   puerta ya tenía. El canal verticales → billing faltaba igual con las dos filas. Lo que sí genera
   `K-9` son las notas vencidas del otro lado de la costura.
4. Un hecho externo que la tanda registra (el cobro del 26/09, `CT-6`) no es un crítico generado:
   corrige una premisa que el calendario volvía falsa. Entra en la clase *«medición externa»* que
   `DEC-METH-013` saca del conteo.
5. La línea de base se mide, no se supone. El primer commit posterior a los caminos reejecutados
   (`94a1eb4760`) no toca capítulos, y los dos commits entre la tanda y la auditoría
   (`204a766e93`, `47e8c3ea85`) no tocan ninguna línea citada. Sin verificarlo, el rango habría
   sido una hipótesis.
