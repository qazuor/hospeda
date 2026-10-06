---
title: "FASE 8 vuelta 2 · atribución de la crítica y de las ALTA de plata contra los diffs"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 — ¿lo generó la tanda del 2026-09-26?

Este documento aplica la **cláusula 1 de `DEC-METH-013`**: la atribución se dictamina contra los
diffs y no contra los mensajes de commit. Atribuye la única `CRITICA` de
`00-hallazgos.md` (`F-8V2B1-001`, racimo R1, junto con `F-8V2D1-001`) y, en una sección aparte,
las cinco ALTA de plata que el consolidado nombra como candidatas cercanas: R2, R5, R14, R3 (la
ventana entre los pasos 3 y 4) y R18 (`F-8V2B2-001`).

Hay tres veredictos:

- **GENERADO**: el texto que abre el camino entró en la tanda.
- **PREEXISTENTE**: el defecto ya estaba en `285a02442f`, y la tanda no lo tocó o lo tocó sin
  crearlo.
- **AGRAVADO**: ya existía, pero un hunk de la tanda lo hizo más probable o más caro.

> **Lo que este documento NO hace.** No propone arreglos, no cambia severidades y no decide
> destinos. Dice de dónde salió el texto.

Rutas: `$V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`,
`$B` = `.specs/HOS-1354-billing-cobro-y-proveedor`, `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`.
`B/NN` es `$B/docs/NN-…`, y lo mismo vale para `V/NN`. Las líneas `archivo:línea` son las de `HEAD`. Las
de la base se escriben como *«`285a02442f`, l. N»*.

---

## 1. El rango, medido

Con `git log --format='%h %ad' 285a02442f..HEAD`, contando los archivos de capítulo que toca cada
commit (se excluyen `28-`, `29-`, el handoff y el worklog):

| tramo | commits | qué tocan |
|---|---|---|
| antes de la tanda | `204a766e93`, `47e8c3ea85` (`DEC-MP-006`), `81f94c7c69`, `1e67aa9304`, `3188ada4fc` (informes y atribución de la vuelta 1) | ninguna línea citada abajo |
| **la tanda** | `64037c3816` (log), **`8fd622aabc`** (31 archivos: G1, G2, G3, G5), `442b0ad810`, **`d8f36d7cc0`** (G4), `d901e55122`, `e21c571b9b`, `4347cfd9de`, **`ae7e837d36`**, **`798c15b15d`**, `5e6a0baf2a`, `b2ab682baf` | los capítulos |
| arreglos de texto | `1cccd9119d` (`V/03` §9, `V/spec.md`, `$B/descomposicion.md` §2) | ninguna línea citada abajo |
| sólo informes | `236391e3b1`, `649597264d` | nada fuera de `29-` |

Método: primero `git blame -s -L n,n 285a02442f..HEAD` sobre cada línea que citan los informes. Una
línea con `^285a02442f` no cambió en la tanda. Para una línea que sí cambió, se abrió el hunk con
`git show <sha> -- <archivo>` o con `git diff --word-diff`. Ningún dictamen sale del mensaje de un
commit. Hubo un caso en que el texto de la tanda afirma más de lo que su diff hace: la frase que
agrega `e21c571b9b` declara recontados los espejos de `S36`, pero nombra `B/02`, `B/12`, `B/20` y el
contrato, y el diff no toca la lista de `B/16` §4.3. Eso es R1 (§2.2).

---

## 2. La crítica — R1

### 2.1 `F-8V2B1-001` · después de la baja, el addon recurrente cobra otro mes · **PREEXISTENTE**

El camino se arma con seis piezas. `git blame` dice que **ninguna** cambió en la tanda:

| pieza | en `HEAD` | blame | en la base |
|---|---|---|---|
| la baja cancela sólo la principal, sin nombrar complementos | `B/03` fila `S11`, l. 157 | `8fd622aabc` (ver abajo) | l. 153 |
| `CANCEL_SCHEDULED` es fila viva: no hay orfandad hasta `S12` | `B/16`, l. 711 | `^285a02442f` | l. 695 (`dac3debb90`, 23/09) |
| el complemento es su propio preapproval y cobra por su cuenta | `B/16`, l. 688 | `^285a02442f` | l. 672 (`4df3e9dfd7`, 17/09) |
| `S21` abre la marca 14, con la propuesta de no devolver | `B/16`, l. 898, 902 | `^285a02442f` | l. 880, 884 (23/09) |
| el reparto pone la mitad de `S12` que no viene de `S26` en el 14 | `B/03`, l. 1366 | `^285a02442f` | l. 1322 (`0e09e043b0`, 25/09) |
| la pantalla de la baja promete que el cobro se corta | `B/19` fila 3-bis, l. 109 | `^285a02442f` | l. 108 (`a9007b81e2`, 25/09) |

Citas en `HEAD`, que el script verifica:

- `B/16:711` — «que sigue siendo fila viva»
- `B/16:688` — «sigue cobrando por su cuenta»
- `B/16:902` — «COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA»
- `B/19:109` — «y su cobro se corta»

**La única pieza que la tanda tocó es la fila `S11`, y no le tocó lo que importa acá.** Con
`git diff --word-diff 285a02442f 8fd622aabc`, lo único que cambia en esa fila es la cláusula de la
extensión (R4 de la vuelta 1, `F-8V1B2-002`):

```diff
[-la-]{+~~la+}
[-manda.-]{+manda~~ la extensión que ese § manda es **`max(fin_de_servicio vigente, la fórmula recalculada)`**: una extensión nunca acorta (FASE 9 vuelta 1, R4, `F-8V1B2-002`).+}
```

Y la fila no nombra complementos, ni antes ni después:
`git show 285a02442f:$B/docs/03-maquinas-de-estado.md | sed -n 153p | rg -c "complemento|S32|S21"` no
encuentra nada, y lo mismo pasa con la línea 157 de `HEAD`.

**No hay agravante.** La tanda hizo tres cambios cerca del camino. Ninguno lo vuelve más probable ni
más caro:

1. **`G2-2`** (`8fd622aabc`, `B/16` §4.2) extiende la pausa de los complementos recurrentes de la
   pausa a la suspensión:

   ```diff
   -vendemos y no a una mora. **La suspensión no entra**: sigue como dice el párrafo de arriba. **Ni la
   +vendemos y no a una mora. ~~**La suspensión no entra**: sigue como dice el párrafo de arriba.~~
   +**Y la suspensión también** (owner 2026-09-26, `G2-2`: 4a extendida): `S6` pausa los
   +complementos recurrentes por la misma fila `S32`, sin fecha de fin, y la vuelta los reanuda
   ```

   Después de ese cambio, `CANCEL_SCHEDULED` es el único estado en que la principal dejó de cobrar y
   el complemento sigue cobrando. El cambio no crea eso: ese estado ya cobraba en la base.
2. **`ae7e837d36`** escribió en el «NO cierra» de `B/16` el caso *`S7` de `SUSPENDED` a
   `CANCEL_SCHEDULED`*. Ahí el complemento queda **pausado** (no cobra) hasta que `S12` lo apaga.
   Es la misma ventana, pero con el cobro cortado.
3. **`798c15b15d`** agregó la fila 3-ter justo debajo de la 3-bis (`+| 3-ter ✚ | al **comprar un
   destaque** …`), y `8fd622aabc` reescribió la fila 10: *«tampoco tus addons recurrentes, que quedan
   pausados»*. La 3-bis quedó como estaba.

**¿La tanda podía verlo? Sí, y de cerca.** Tocó la fila `S11`, escribió la regla de qué complementos
se pausan cuando la principal deja de cobrar, y razonó sobre `CANCEL_SCHEDULED` con un complemento
colgando. Además editó la fila de al lado de la pantalla que promete el corte. Las citas son de
texto que entró en la tanda:

- `B/16:676` — «Y la suspensión también»
- `B/16:1000` — «El complemento sigue pausado mientras la principal da servicio hasta su fin»

### 2.2 `F-8V2D1-001` · `S36` no está en la lista que dispara la orfandad · **GENERADO**

`S36` no existe en la base. `git show 285a02442f:$B/docs/03-maquinas-de-estado.md | rg -c S36` no
encuentra nada, y tampoco en `16-addons.md`. La fila nace en `8fd622aabc`:

```diff
+| **S36** ✚ | `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED` | **una persona registra la revocación del derecho de arrepentimiento** … | `CANCELLED` | …
```

Después la tanda recontó los espejos de `S36` **en todos lados menos en la lista de la orfandad**:

- `e21c571b9b` (`B/03` §2) escribe que los espejos están recontados, y nombra cuatro, sin `B/16`:

  ```diff
  +fila 12 de la tabla, y sus espejos en `B/02`, `B/12`, `B/20` y el contrato están recontados (FASE 9
  ```

- `4347cfd9de` y `798c15b15d` suben la salvedad 4 de trece a quince, y las puertas a terminal de
  `B/09` §3 a dieciocho. Esta última cuenta está **dentro de `B/16`**:

  ```diff
  +de puertas a un estado terminal de `B/09` §3 —que hoy tiene ~~**quince**~~ ~~**dieciséis**~~ ~~**diecisiete**~~ **dieciocho** (la decimoséptima, `S36`, FASE 9 vuelta 1; …
  ```

- La lista que `A5` manda a leer (`B/16` §4.3) y su recuento espejo en `B/03` §3.2 siguen en
  **trece**, sin `S36`. `B/03` l. 1349 es `^285a02442f`, igual que las l. 704 y 713 de `B/16`.

Citas en `HEAD`:

- `B/03:493` — «sus espejos en `B/02`, `B/12`, `B/20` y el contrato están recontados»
- `B/16:915` — «la decimoséptima, `S36`, FASE 9 vuelta 1»
- `B/03:1349` — «recontadas sobre la enumeración de»

**Dictamen.** La tanda escribió la transición y declaró sus espejos recontados, pero dejó afuera la
enumeración de la que depende `A5`. El agujero es de la tanda.

**¿La tanda podía verlo? Sí.** Editó `B/16` para contar `S36` en la línea 915, a unos doscientos
renglones de la lista del §4.3, y la frase de `e21c571b9b` enumera los espejos a mano.

### 2.3 R1 como racimo

La **CRÍT** (`F-8V2B1-001`) es **PREEXISTENTE**: el camino de la baja desde `ACTIVE` con un addon
recurrente se armó entre el 17/09 y el 25/09, y ninguna línea de la tanda lo abre. Su gemelo
**`F-8V2D1-001`** (ALTA) es **GENERADO**, porque `S36` entró sin la lista. Los dos terminan en el
motivo 14. Para la cuenta de `DEC-METH-013`, la tanda **no generó la crítica**, pero sí generó su
segunda puerta.

---

## 3. Las ALTA de plata candidatas

### 3.1 R2 · el cobro en vuelo del corte (`G3-1`) · **GENERADO**, sobre una premisa **PREEXISTENTE**

**Lo que escribió la tanda.** La tanda escribió la declaración de `G3-1`, con su población, y sacó
la lápida del corte del desempate y de la comparación. Todo está en `8fd622aabc`, sobre
`$B/docs/21-migracion.md`:

```diff
+**El cobro en vuelo del corte que sale bien no se devuelve** (owner 2026-09-26, `G3-1`, contra la
+… encuentra la lápida por su `provider_link` y **se asienta sobre ella sin marca** …
+propone devolverlo. **La lápida del corte (`origen_de_lápida = CORTE`) no entra al desempate de
+motivos** (cap. 05 §3) **ni a la comparación de cobros del barrido** (cap. 09 §3) …
+  **Población**: los clientes con un cobro en vuelo en la ventana de minutos del paso 1b —a lo sumo
+  los tres de la cartera—. **Detector**: el `payment` asentado sobre la lápida, que una consulta
```

- `B/21:398` — «en la ventana de minutos del paso 1b»
- `B/21:238` — «no entra al desempate de»

En la base el cobro en vuelo no pasaba en silencio. `285a02442f`, l. 137-152 de `B/21`, dice que
llegaba *«como un preapproval desconocido»* y que *«termina en una persona»* por la marca 6. Y
ninguna línea de la base dice *«ventana de minutos»* (`rg` no encuentra nada).

**Lo que ya estaba.** Hay dos premisas y ninguna cambió en la tanda:

- `B/09:168` — «Una fila terminal está exenta cuando su autorización quedó imposibilitada de cobrar por algo»
- `$D/16-fase-7-del-paraguas.md:152` — «El paso 2 es el gate»

En la base, la primera es la l. 145 de `B/09` (`4e383480d3`, 21/09) y la segunda la l. 140 de `$D/16-…`.
La matriz (`GR-1`, `GR-2`, `RC-6`) tampoco se tocó: sus l. 200, 201 y 280 son `^285a02442f`.

**Dictamen por hallazgo:**

| hallazgo | veredicto | por qué |
|---|---|---|
| `F-8V2B3-002` (ALTA) | **GENERADO** | contradice la población *«de minutos»*, que escribió `8fd622aabc` |
| `F-8V2B1-006` (MEDIA) | **GENERADO** | contradice *«a lo sumo los tres»*, que es el mismo hunk |
| `F-8V2C2-004` (ALTA) | **AGRAVADO** | el paso 2 que relee una sola vez es de la base. En la base, un preapproval que volvía a vivir terminaba en una marca frente a una persona (motivo 6, o `COBRO_SIN_REGISTRAR` por el desempate). Desde `8fd622aabc` se asienta **sin marca** y no aparece en ningún listado |
| `F-8V2B3-006` (MEDIA) | **PREEXISTENTE** | la exención de las terminales (`B/09` §3) no cambió |

La tanda **ejecutó una decisión del owner** (`G3-1`, elegida contra la recomendación). Lo que
generó no es la decisión sino **la población con la que se declaró**.

**¿La tanda podía verlo? Sí.** El mismo commit escribió la salvedad que admite que la cancelación
del 1b puede no aplicarse, y la matriz que cita (`GR-2` en `UNKNOWN`) ya estaba en la base.

### 3.2 R5 · el hecho 4 lo escribe billing en verticales · **GENERADO** (la contradicción), con piezas **PREEXISTENTES**

**Lo que ya estaba.** Todas estas líneas son `^285a02442f`:

- la escritura de billing sobre `listing.inactiva_desde` (`B/10`, l. 314-315);
- el glosario que se la asigna al barrido (`nucleo/01`, l. 57 y 182);
- las descomposiciones sin unidad (`$B/descomposicion.md`, l. 138 y 336; `$V/descomposicion.md`,
  l. 376);
- la fórmula de `fin_de_servicio`, que lee fechas de cobro (`B/10`, l. 250);
- el *«no cruzan fechas»* del contrato (`$D/12-…`, l. 980).

- `B/10:315` — «a cada ficha de la vertical»

**Lo que escribió la tanda.** La regla que vuelve esa escritura una filtración. En la base, la mitad
inversa de la regla sólo vigilaba **lecturas** (*«si billing necesita leer de verticales algo que
no está entre los siete campos»*). `d8f36d7cc0` (`G4-2` y `F-8V1A3-014`) agregó las **escrituras**
y declaró una sola:

```diff
+versión—, nunca qué otorga. **`extenderTrial` es la única escritura de billing en verticales**: el
…
+> campos, el veredicto de `direcciónDeCambio` y el sí o no de `fichaPurgada`—, **escribir en
+> verticales algo que no sea `extenderTrial`, o recibir de verticales un hecho que no sea el del
```

- `$D/12-contrato-de-cobertura.md:1066` — «es la única escritura de billing en verticales»
- `$D/12-contrato-de-cobertura.md:1166` — «verticales algo que no sea `extenderTrial`»

`git show 285a02442f:$D/12-contrato-de-cobertura.md | rg "única escritura"` no encuentra nada.

**Dictamen.** El consolidado dice que R5 es ALTA *«por definición»*, porque dos textos se
contradicen. La contradicción la creó la tanda: antes de `d8f36d7cc0`, la escritura del hecho 4
estaba sola y sin unidad, pero ningún texto la prohibía. Que nadie la construyera (`A3-001`) y que
nadie escribiera `vertical.fin_de_servicio` (`C1-001`) son huecos de la base. Lo que los vuelve un
camino con daño es la regla nueva.

**¿La tanda podía verlo? Sí.** El mismo hunk enumera una por una las entradas de la frontera y
recuenta todo el §4.1. No miró `B/10` §4.3, que es la única escritura inversa anterior.

### 3.3 R14 · la precisión 7 abre lo ajeno · **PREEXISTENTE**

La precisión 7 y los pasos de la resolución son de la base. Las l. 74, 186, 290, 299, 303, 309 y
452 de `V/17` son `^285a02442f`. En la base, el texto de la tabla de pasos está en la l. 72, y el de
la precisión en la l. 175.

- `V/17:74` — «Si el sujeto no es el dueño, el recurso existe sólo en estado público»

La tanda tocó **el mismo párrafo y el mismo paso** dos veces, y ninguna de las dos acota la
precisión a lecturas:

1. En la precisión 7, `8fd622aabc` precisa la clave de Partner (`F-8V1A1-004`):
   `-   presencia de Partner **con la clave vigente y sin moderar**` →
   `+   presencia de Partner ~~…~~ **con la clave de esa superficie** …`.
2. En el paso 1, `8fd622aabc` escribe la excepción del `Guest` **como lectura**:

   ```diff
   +| 1 | **quién es** | ¿hay un actor ~~?~~ **autenticado**? El `Guest` es un actor (§3.3) y **falla acá**, salvo en una lectura de lo ajeno en estado público (precisión 7) …
   ```

- `V/17:71` — «salvo en una lectura de lo ajeno en estado público»

La tanda también escribió dos textos que `A1-001` y `A1-002` citan: la fila 15 de `NUCLEO/08` §3,
*«editar el contenido de una ficha ajena»* (`G5-2`), y la fila Admin de `V/19` (*«para leer; para
escribir, sólo lo que nombra una fila…»*). Los dos **restringen** la escritura ajena al admin con
permiso, y ninguno abre el camino del host. La lectura ajena sin permiso definido (`A1-002`) ya
estaba en la base: *«todo lo anterior, de cualquier persona, como actor distinto del sujeto»*.

**Dictamen.** Es **PREEXISTENTE** para `F-8V2A1-001` y para `F-8V2A1-002`.

**¿La tanda podía verlo? Sí, y es el caso más claro de los seis.** Escribió *«lectura»* en el paso 1
para la precisión 7 y no llevó esa palabra a la precisión misma, que editó en el mismo commit.

### 3.4 R3 · la ventana entre los pasos 3 y 4 del corte · **GENERADO** (el choque), sobre una ventana **PREEXISTENTE**

**Lo que ya estaba.** La ventana: el paso 4 va después del paso 3 porque *«la fila es del esquema
nuevo: no puede existir antes del paso 3»* (`285a02442f`, l. 126 de `$D/16-…`). También estaba la
premisa del contenedor viejo: `$D/16-…`, l. 146 y 149, son `^285a02442f`.

- `$D/16-fase-7-del-paraguas.md:146` — «Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons»

En la base, un cobro de un id que no conocía la base, llegado en la ventana, no escribía ninguna fila:
abría la marca 6 y lo miraba una persona (`285a02442f`, `B/09`, l. 72-74). `rg "recepción"` no
encuentra nada en `B/09`, `B/02`, `B/21` ni `$D/16-…` de la base.

**Lo que escribió la tanda.** Lo que convierte la ventana en un choque:

- **la lápida de recepción** (`G3-2`, `8fd622aabc` sobre `B/09` §2.4):

  ```diff
  +si no nombra ninguna, de una lápida de recepción** (owner 2026-09-26, `G3-2`): el handler escribe
  +una `subscription` con la forma de fila de la lápida del corte … y su `provider_link`, y de ella cuelgan el `payment` y la marca, `PAGO_TARDÍO_RECHAZADO` si
  ```

- **el paso 4 ampliado** a los ids que la base no conoce (R6, `8fd622aabc` sobre `$D/16-…`, l. 131):
  `+| 4 | **sembrar las lápidas** … **y verificados, conocidos por la base o no, sondas incluidas salvo las del manifiesto**`.

- `$D/16-fase-7-del-paraguas.md:316` — «el handler le escribe una lápida de recepción»
- `$D/16-fase-7-del-paraguas.md:131` — «conocidos por la base o no»

**Dictamen.** `F-8V2B3-003` y `F-8V2C2-002` son **GENERADOS**. Con el texto de la base, la ventana
terminaba en una marca frente a una persona, sin fila y sin choque del `UNIQUE`. Con `G3-2` y R6, el
handler escribe una fila con `provider_link` y con la propuesta de devolver, y el paso 4 intenta
escribir la misma. La ventana y la premisa del contenedor viejo que devuelve 500 son anteriores.

**¿La tanda podía verlo? Sí.** El mismo commit escribió las dos formas de lápida y el paso 4.

### 3.5 R18 · `S6` y `S3` cancelan antes de escribir (`F-8V2B2-001`) · **PREEXISTENTE**

El mecanismo es de la base. Las l. 151, 153, 361 y 2801 de `B/03` son `^285a02442f`: la
transición se escribe después de la llamada, `S5` no relee el preapproval, y la escritura que no
coincide relee y reevalúa. También son de la base `B/05`, l. 90, y `B/12`, l. 165 (`GR-1`).

- `B/03:361` — «La transición se escribe después de la llamada»

La tanda tocó **la fila exacta del espejo** que corta a Juan (`B/03`, l. 2747, `8fd622aabc`). Le
agregó una excepción para la carrera hermana, `F-8V1B2-004` (el aviso de `S6` le gana a su propia
escritura):

```diff
{+— **y salvo sobre una fila en `GRACE_PERIOD` cuyo reloj del §4 ya se agotó: eso es `S6` por su primer evento**, que ya mandó esa cancelación y todavía no escribió. …+}
```

- `B/03:2747` — «y salvo sobre una fila en `GRACE_PERIOD` cuyo reloj del §4 ya se agotó»

La excepción se ancla en el **estado** `GRACE_PERIOD`. Cuando gana `S5`, la fila ya está en
`ACTIVE`, la excepción no aplica y el espejo corta igual que en la base. El arreglo no crea el
camino ni lo abarata: lo deja donde estaba.

**Dictamen.** Es **PREEXISTENTE**.

**¿La tanda podía verlo? Sí.** Arregló esta misma carrera con el otro ganador, y escribió la
excepción sobre un estado en vez de sobre el efecto remoto que ya había salido. Es el patrón que
la misma tanda nombra en el contrato (`d8f36d7cc0`, `F-8V1C1-007`): *«una condición escrita sobre un estado se rompe cada vez que
una decisión abre el estado vecino»*.

---

## 4. Tabla de cierre

| hallazgo | sev. | veredicto | hunk clave | ¿la tanda tocó lo mismo? |
|---|---|---|---|---|
| **`F-8V2B1-001`** (R1) | **CRÍT** | **PREEXISTENTE** | fila `S11` en `8fd622aabc`: sólo la cláusula `max(…)`; el resto del camino es `^285a02442f` (§2.1) | sí: `S11`, `G2-2` en `B/16` §4.2 y la fila 3-ter pegada a la 3-bis |
| `F-8V2D1-001` (R1) | ALTA | **GENERADO** | la fila nueva de `S36` (`8fd622aabc`); los espejos recontados sin `B/16` (`e21c571b9b`) | sí: contó `S36` dentro de `B/16` (l. 915) |
| `F-8V2B3-002` (R2) | ALTA | **GENERADO** | `+**Población**: … ventana de minutos del paso 1b —a lo sumo los tres` (`8fd622aabc`) | sí: el mismo hunk |
| `F-8V2C2-004` (R2) | ALTA | **AGRAVADO** | gate de la base; `+… se asienta sobre ella sin marca` (`8fd622aabc`) | sí |
| `F-8V2B1-006` (R2) | MEDIA | **GENERADO** | igual que `B3-002` | sí |
| `F-8V2B3-006` (R2) | MEDIA | **PREEXISTENTE** | `B/09`, l. 168, `^285a02442f` | no |
| `F-8V2A3-001` (R5) | ALTA | **GENERADO** (la contradicción) | la línea `+` de *«es la única escritura de billing en verticales»* (`d8f36d7cc0`) | sí: recontó el §4.1 entero |
| `F-8V2C1-001` (R5) | ALTA | **GENERADO** (la contradicción) | la línea `+` de *«escribir en verticales algo que no sea extenderTrial»* (`d8f36d7cc0`) | sí |
| `F-8V2A1-001` (R14) | ALTA | **PREEXISTENTE** | `V/17`, l. 74 y 186, `^285a02442f` | sí: editó la precisión 7 y el paso 1 |
| `F-8V2A1-002` (R14) | ALTA | **PREEXISTENTE** | `V/17`, l. 290-309, `^285a02442f` | sí: la fila Admin de `V/19` |
| `F-8V2B3-003` (R3) | ALTA | **GENERADO** | `+si no nombra ninguna, de una lápida de recepción` (`8fd622aabc`) | sí: el mismo commit escribió el paso 4 |
| `F-8V2C2-002` (R3) | ALTA | **GENERADO** | igual, más `+… conocidos por la base o no` (paso 4) | sí |
| `F-8V2B2-001` (R18) | ALTA | **PREEXISTENTE** | la excepción `GRACE_PERIOD` del espejo (`8fd622aabc`) no alcanza a `ACTIVE` | sí: la misma fila |

**Conteo.** La crítica declarada es **0 de 1** generada. Contando su gemelo, R1 da 1 de 2. Entre
las candidatas ALTA, R2 (en su parte de ALTA), R3 y R5 nacieron en la tanda; R14 y R18, no. Las
cinco tienen algo en común: **la tanda tocó el mismo párrafo o la misma máquina**.

---

## 5. El criterio de corte de `DEC-METH-013`, aplicado

- `$D/01-decision-log.md:5073` — «Si a la segunda la tanda sigue generando críticos, no se sigue girando»
- `$D/01-decision-log.md:5075` — «Lo que quede se declara con causa, caso por caso, y lo elige el owner.»
- `$D/01-decision-log.md:5077` — «Un `CRITICA` de dinero no se declara con causa sin que lo lea el owner»

1. **El tope ya se alcanzó.** Ésta es la vuelta 2 de 2, así que la cláusula 2 no manda otra vuelta,
   cualquiera sea la atribución. Que la crítica sea preexistente **no reabre el ciclo** y **no la
   exime** de destino.
2. **La señal de la cláusula 1 cambia de lado.** En la vuelta 1, la crítica que quedó en pie era de
   la tanda (R1 de `28-…/00-atribucion-de-criticos.md`). Ésta no lo es. La tanda del 26/09 **no
   generó críticos**. Si el tope no se hubiera alcanzado, éste sería el caso en que la condición de
   corte se cumple.
3. **Cláusula 3: todo se declara caso por caso y lo elige el owner.** Para R1 hay dos destinos
   posibles: arreglar `S11` y la lista del §4.3, o declararlo con causa. Elegir es del owner.
   `F-8V2D1-001`, generado, es trabajo de registro, pero comparte con la crítica la pregunta del
   motivo de `S21` tras `S36`, y esa pregunta es del owner.
4. **Cláusula 4: R1 es de dinero.** Se cobra un mes de complemento después de la baja y la
   propuesta es no devolverlo, así que **no se declara con causa sin que el owner lo lea**. Lo mismo
   vale para las ALTA de plata que el owner decida tratar como críticas. R2 ya está marcada así en
   el consolidado (§4, pregunta 3). Si el owner sube R2, la parte que subiría (la población de
   `G3-1`) es **generada**, y además es la ejecución de una decisión suya.

---

## Key Learnings

1. **Tocar el párrafo no es generar el defecto.** Las tres piezas que la tanda editó al lado de la
   crítica (`S11`, `G2-2`, la fila 3-ter) están a una línea del camino y ninguna lo abre. Sin
   `--word-diff` sobre la fila `S11`, el blame (`8fd622aabc`) habría dado GENERADO.
2. **Un arreglo que enumera a mano deja afuera justo la lista que importa.** `e21c571b9b` declara
   los espejos de `S36` recontados y nombra cuatro. La quinta, `B/16` §4.3, es de la que depende
   `A5`. Es el único GENERADO de R1.
3. **La tanda generó contradicciones, no mecanismos.** R5 y R3 nacen de una regla o de una fila nueva
   (`extenderTrial` como única escritura, la lápida de recepción) que choca con texto viejo que nadie
   releyó. El mecanismo dañino (la escritura del hecho 4, la ventana) es de la base.
4. **Declarar una decisión con una población fija genera un hallazgo aunque la decisión esté bien.**
   `G3-1` es del owner. Lo generado es *«ventana de minutos, a lo sumo tres»*, un número que la
   matriz de la base ya desmentía.
5. **Una excepción anclada en un estado repite la familia.** El arreglo de `F-8V1B2-004` protege
   `GRACE_PERIOD`, y `F-8V2B2-001` es la misma carrera con la fila ya en `ACTIVE`. No es generado,
   pero muestra que arreglar por estado deja abierto al vecino.
6. **La atribución de esta vuelta da 0 de 1 en la crítica declarada.** Es la primera vez en la
   serie que la crítica en pie es toda preexistente. Con el tope alcanzado, eso no cambia qué hacer:
   declarar caso por caso, con el owner leyendo lo de dinero.
