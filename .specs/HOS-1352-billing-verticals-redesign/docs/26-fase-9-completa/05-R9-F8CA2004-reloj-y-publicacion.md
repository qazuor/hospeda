---
title: "FASE 9 completa · R9 y F-8CA2-004 — el reloj de inactividad y la máquina de publicación"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R9 y `F-8CA2-004` — el reloj de inactividad y la máquina de publicación

`DEC-METH-004` exige dos cosas para declarar resuelto un racimo: que el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llegue, **y** que la regla corregida se verifique
contra todo el dominio que cuantifica. Este documento hace las dos cosas para **R9** (el reloj de
`listing.inactiva_desde`, ocho hallazgos) y para el crítico suelto **`F-8CA2-004`** (la baja por
moderación y el borrado del dueño), porque los dos viven en la misma tabla: la máquina de
publicación de `V/03` §9.

**Este documento no edita nada.** Las correcciones se proponen; las aplica el orquestador.

Abreviaturas de rutas: `N/` es `HOS-1352-…/docs/nucleo/`, `V/` es
`HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B/` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, `contrato` es `HOS-1352-…/docs/12-contrato-de-cobertura.md`
y `log` es `HOS-1352-…/docs/01-decision-log.md`. Los números después de `:` son líneas del texto
de hoy.

---

## 1. La regla corregida, tal como quedó

### 1.1 El reloj arranca al perder la cobertura, en toda ficha del dueño

`N/01-glosario.md:48`, la definición:

> El tiempo que lleva **sin estar a la vez publicada y cubierta**, contado desde **el más
> reciente** de los ~~cuatro~~ **cinco** hechos que la reinician —y, en una ficha que ya existía el
> día del corte, **desde el corte** si ninguno de los cinco ocurrió después

`N/01-glosario.md:58`, el hecho 5:

> **el dueño pierde la cobertura en la vertical de la ficha** —el `cubierto` del contrato pasa a
> falso para ese `user + vertical`—, y se escribe en **toda** ficha del dueño en esa vertical,
> **publicada o no**

con **tres ejecutores** (la primera rama de `PB2`, el recálculo que despierta el aviso, y el
reconciliador diario de cobertura cuando el aviso se perdió) y **nunca** la segunda rama de `PB2`.

### 1.2 El corte siembra la fecha del corte

`N/01-glosario.md:59`, la escritura `C`:

> toda ficha que ya existía el día del corte **nace en el modelo nuevo con `inactiva_desde` = el
> instante del corte**, nunca con su `created_at`

repetida en `V/02-modelo-de-datos.md:330` y `V/21-migracion.md:148-151`.

### 1.3 Los tres actos del reloj releen, y el borrado es una transición que exige `ARCHIVED`

`N/01-glosario.md:142-144`: *«`PB4`, `PB5` y el hard delete del día 180 —desde la FASE 8
completa, la fila `PB9` de `V/03` §9 (`F-8CA2-008`)— **releen la cobertura del `user + vertical`
en el momento de ejecutar**»*. `V/03-maquinas-de-estado.md:446`: *«**Exige `ARCHIVED`**: sale sólo
de ahí, así que el aviso del archivado salió siempre antes»*, y `PURGED` *«es final»*.

### 1.4 La retención sólo toca fichas (`DEC-DATA-005`)

`log:5236-5238`: *«**El proceso de archivar y purgar es sólo para fichas.** El usuario, sus
preferencias, sus señales de identidad y sus datos personales **no se tocan**, tampoco dentro de
eventos o del outbox»*. En el capítulo: `V/02-modelo-de-datos.md:541-543`.

### 1.5 `MODERATED` y `PB10`–`PB12` (`F-8CA2-004`)

`V/03-maquinas-de-estado.md:452-454`: *«**La máquina tiene seis estados y doce transiciones**:
`DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`, **`PURGED`** y **`MODERATED`**, y de
`PB1` a **`PB12`**»*.

### 1.6 Los guards que la sostienen

| guard | predicado de hoy | fuente |
|---|---|---|
| `D16` / `G-R5` | el tope de pausa, en días, alcanza el día del hard delete | `N/04-invariantes.md:143`, `V/20-testing.md:64` |
| `G-R5-B` | el `N` de `PB5`, pasado a días, **no es menor que 6 meses** | `V/20-testing.md:65`; cota *«6 meses literal»*, `V/20-testing.md:255-256` |
| `G-R6` | una condición lee una columna que ninguna transición escribe | `V/20-testing.md:66` |
| `G-R6-B` | (a) escritor fuera de los cinco hechos y de `C`; (b) lector fuera de los seis; (c) lector declarado que ya no lee | `V/20-testing.md:67` |

---

## 2. La máquina de publicación, recontada con script

Script: `r9_pub.py` (scratchpad de la sesión), que parsea las filas `PB*` de
`V/03-maquinas-de-estado.md:436-449` y extrae los estados de las columnas `desde` y `hacia`.
Salida literal:

```text
transiciones: 12 estados: 6 ['ARCHIVED', 'DRAFT', 'MODERATED', 'PUBLISHED', 'PURGED', 'UNPUBLISHED_BY_BILLING']
pares (desde,fila) = 19
ARCHIVED sale por ['PB7', 'PB8', 'PB9', 'PB10', 'PB12']
DRAFT sale por ['PB1', 'PB5', 'PB10', 'PB12']
MODERATED sale por ['PB11']
PUBLISHED sale por ['PB2', 'PB4', 'PB6', 'PB10', 'PB12']
PURGED sale por []
UNPUBLISHED_BY_BILLING sale por ['PB3', 'PB4', 'PB10', 'PB12']
```

**Seis estados y doce transiciones: coincide con `V/03:452-454` y con el diccionario
`N/01-glosario.md:425`.** `PURGED` no tiene salida (final). `MODERATED` tiene una sola (`PB11`).
Todos los estados son alcanzables desde `DRAFT`.

**Lo que el recuento no encuentra: la fila de nacimiento.** Ninguna fila tiene `DRAFT` como
destino desde *«sin fila»*: la creación de la ficha no es una transición declarada. Se buscó
`estado inicial|nace en .?DRAFT|nace como borrador|crear la ficha|crearla|se crea en \`DRAFT\``
sobre `V/` y `N/`: la única aparición útil es la palabra *«crearla»* del hecho 1
(`N/01-glosario.md:54`). La regla 2 del núcleo (`N/03-maquinas-de-estado.md:50-54`) declara el
estado inicial de una máquina *«cuya fila nace en su primera transición»* y da dos ejemplos
(suscripción y trial); publicación no está. Va como borde en §6.2 (`B-9`).

---

## 3. El dominio de R9 y de `F-8CA2-004`

| dimensión | qué enumera | fuente de cada eje | tamaño |
|---|---|---|---|
| **A** | estado de la ficha × evento que le llega | estados: `V/03:452-454`; eventos: tabla de abajo | 6 × 15 = **90** |
| **B** | quién escribe el hecho 5 en cada estado, con el aviso entregado y perdido | `N/01:58`, `V/03:902-907`, `V/03:953-959` | 6 × 2 = **12** |
| **C** | la población del corte: ficha publicada o no × dueño cubierto o no ese día | `V/21:100-107`, `V/21:142-156` | 2 × 2 = **4** |
| **D** | lo que la retención puede tocar (`DEC-DATA-005`) | `V/02:541-543`, `B/02-modelo-de-datos.md:1096`, `N/08-auditoria-y-observabilidad.md:71-79` | **8** |
| **E** | los predicados de los guards del racimo | §1.6 | **6** |
| | | | **120** |

**Los 15 eventos del eje A**, cada uno con la fila o el hecho que lo nombra:

| # | evento | fuente |
|---|---|---|
| E1 | el dueño publica | `PB1`, `V/03:438` |
| E2 | el dueño pierde la cobertura (`cubierto` pasa a falso) | `PB2` rama 1, `V/03:439`; hecho 5, `N/01:58` |
| E3 | el excedente tras un downgrade (cupo baja, `cubierto` sigue verdadero) | `PB2` rama 2, `V/03:439` |
| E4 | `cubierto` pasa a verdadero | `PB3`/`PB7` rama 1, `V/03:440,444`; hecho 2, `N/01:55` |
| E5 | el cupo vuelve a alcanzar sin que `cubierto` cambie | `PB3`/`PB7` rama 2 |
| E6 | día 90 sobre `inactiva_desde` | `PB4`, `V/03:441` |
| E7 | `N` meses sobre `inactiva_desde` | `PB5`, `V/03:442` |
| E8 | el dueño despublica | `PB6`, `V/03:443` |
| E9 | el dueño reactiva | `PB8`, `V/03:445` |
| E10 | día 180 sobre `inactiva_desde` | `PB9`, `V/03:446` |
| E11 | un admin modera | `PB10`, `V/03:447` |
| E12 | un admin levanta la moderación | `PB11`, `V/03:448` |
| E13 | el dueño borra | `PB12`, `V/03:449` |
| E14 | un acto del dueño que no cambia estado (editar, exportar) | hecho 1, `N/01:54` |
| E15 | el fin de servicio de la vertical | hecho 4, `N/01:57`; `B/10` §4.3 |

**Criterio**: cada par tiene que tener **una** respuesta en el texto —una fila, un hecho escrito,
un no-op explicable o una prohibición por la regla 1— y la escritura o lectura de
`inactiva_desde` en ese par tiene que ser coherente con la definición de §1.1 y con que nada borre
antes de lo que los avisos prometen.

---

## 4. Los caminos reejecutados

### `F-8CA2-001` — el hard delete cae a mitad de una pausa · **DEJA DE LLEGAR**

1. *Juan tiene la ficha `PUBLISHED` y cubierta; la columna tiene hasta 90 días.* Sigue siendo
   cierto: la relectura de `PB4` reinicia (`V/03:478-480`).
2. *Pausa en X+85: `cubierto` pasa a falso, `PB2` baja la ficha, «ninguno de los cuatro hechos se
   escribe».* **Corta acá.** `V/03:439`: *«**En la primera rama escribe `listing.inactiva_desde`
   con el instante de la caída**»*. La columna pasa a X+85.
3. *X+90: `PB4` archiva.* Ahora `PB4` cuenta desde X+85: archiva en X+175 (día 90 de la pausa).
4. *X+180: el hard delete borra.* Ahora `PB9` cuenta desde X+85: día 180 de la pausa, X+265.
5. *X+205: Juan reanuda.* La reanudación del día 120 (X+205) llega antes: hecho 2 en todas sus
   fichas (`N/01:55`, `V/02:643-648`) y `PB7` la republica (`V/03:444`). `D16` compara la
   desigualdad correcta (`N/04-invariantes.md:153-173`).

Lo que el hallazgo decía de *«toda otra pérdida de cobertura»* también corta: el hecho 5 no
depende de la causa (`N/01:58`).

### `F-8CA3-001` — el reloj arranca antes de que la ficha quede inactiva · **DEJA DE LLEGAR**

Mismo mecanismo con fechas. Paso 3 (*«`PB2` no escribe la columna: `inactiva_desde` sigue en
30-may»*) corta por `V/03:439`: la columna pasa a 27-ago. Paso 4: `PB4` archiva el 25-nov, no el
28-ago. Paso 5: el 25-dic Juan reanuda (hecho 2) y el día 180 (23-feb) ya no llega. La premisa que
sostenía `D16` pasó a ser verdadera: *«la desigualdad que `D16` compara es la que de verdad
protege»* (`N/04-invariantes.md:160-161`).

### `F-8CA3-002` — el corte siembra `created_at` y borra al día siguiente · **DEJA DE LLEGAR**, con un remanente propio abierto

1. *Pedro, ficha de marzo de 2026, corte en enero de 2027.* Igual.
2. *El implementador usa `created_at`.* **Corta acá.** `V/02:330`: *«nace en el modelo nuevo con
   el instante del corte, **nunca con su `created_at`**»*; `V/21:148-149` lo repite.
3. *La mañana del corte `PB2` despublica.* Igual, y además escribe el hecho 5 en el mismo instante
   (`V/21:151-152`).
4. *Primera corrida de `PB4`: archiva.* No: corte + 90 no llegó.
5. *Primera corrida del hard delete: borra.* No: corte + 180 no llegó, y `PB9` exige `ARCHIVED`.
6. *`PB7` devuelve una ficha vacía.* Ya no aplica (`PURGED` es final, `V/03:446`).

**Remanente**: el mismo hallazgo decía *«si la agenda de llamados pasa del día 180, el borrado
llega igual»* y proponía *«el día 180 como límite de la agenda»*. Eso **sigue llegando** y el texto
lo deja al owner: `V/21:158-164`, *«**la agenda de llamados tiene un límite de hecho en el día
180** … **si se declara y cómo se vigila lo decide el owner**»*. Va a §6.1 como `OW-2`.

### `F-8CC2-003` — la lista cerrada sólo admite el valor destructivo · **DEJA DE LLEGAR**

1–2. Las filas existen y la columna no admite nulo: igual.
3. *«El único hecho que aplica a una fila preexistente es el 1»* y `G-R6-B` rechaza `now()`.
   **Corta acá.** La escritura `C` está en la lista (`N/01:59`) y el guard la admite por su lugar:
   `V/20-testing.md:67`, *«**ni la escritura `C` del corte en la migración estructural del
   corte**»*.
4–6. Rosa nace con el instante del corte; ni `PB4` ni `PB9` corren en la primera noche.

### `F-8CA2-008` — `PB3`/`PB7` republican una ficha vaciada · **DEJA DE LLEGAR**

1. *La ficha A pasó el día 180: contenido borrado, estado `ARCHIVED`.* **Corta acá.** `PB9` la
   lleva a `PURGED` (`V/03:446`).
2. *`PB3`/`PB7` ordenan una cola.* `PURGED` no está en el `desde` de ninguna de las dos (script,
   §2) y *«Una ficha `PURGED` no es candidata»* (`V/03:702-704`).
3. *Sube A vacía.* No sube, y no ocupa cupo (`V/03:711-713`).

### `F-8CA2-014` — el día 180 y `PB5` sin orden · **DEJA DE LLEGAR**, con un borde nuevo

*«El día 180 borra los borradores y no exige `ARCHIVED`»*: corta por `V/02:541`, *«**Sólo sobre
una ficha en `ARCHIVED`**»*, y por el `desde` de `PB9`. *«`N` sin cota contra 180»*: corta por
`G-R5-B` (`V/20:65`). *«Lo mismo si el job de `PB4` estuvo caído»*: corta, porque sin `ARCHIVED`
no hay `PB9` (`V/02:551-552`). **El borde que deja**: la cota es *«6 meses literal»*
(`V/20:255-256`), y 6 meses son 181–184 días, no 180. Va a §6.2 (`B-2`).

### `F-8CD1-009` — la lista de lectores dice «cinco» y enumera seis · **DEJA DE LLEGAR**

Paso 1 (*«quien construye `G-R6-B` cuenta cinco»*): corta por `V/02:393-401`, que numera **(1)** a
**(6)**, y por `V/20:67` y `B/20-testing.md:63`, que dicen *«seis»*. **Remanente de registro**: el
log sigue diciendo *«cinco»* (`log:4311`); el propio capítulo lo anota como pendiente
(`V/02:417-418`). Va a §6.3 (`K-7`).

### `F-8CA3-009` — el día 180 es de una ficha y borra cosas de la persona · **DEJA DE LLEGAR**

*«Un dueño con dos fichas … pierde las preferencias de la cuenta»*: corta por `V/02:541-543`
(sólo el contenido de **esa** ficha y sus borradores; lo de la persona se conserva). *«Ve
anonimizados los eventos de su suscripción viva»*: corta por `N/08-auditoria-y-observabilidad.md:71-76`,
*«**La retención no escribe en este registro**»*. *«Los datos personales de la fila de `user` no
aparecen en ninguno de los tres renglones»*: corta, están en *«Se conserva íntegro, siempre»*
(`V/02:543`). El borrado de la cuenta pedido por el usuario queda **declarado** fuera de la
decisión (`log:5242-5243`, `V/02:595-599`, `N/08:76-79`).

### `F-8CA2-004` — moderar y borrar no tienen transición · **DEJA DE LLEGAR**, y abre otra cosa

1. *Juan publica spam.* Igual.
2. *El admin no tiene fila; si la lleva a `DRAFT` o a `UNPUBLISHED_BY_BILLING`, la máquina la
   deshace.* **Corta acá.** `PB10` (`V/03:447`) la lleva a `MODERATED`, y el script confirma que
   `MODERATED` no está en el `desde` de `PB1`, `PB3` ni `PB7`: sólo sale por `PB11`. El reconciliador
   la excluye de su población (`V/03:881-885`).
3. *«Borrar la ficha» no tiene fila, y de él dependen `A6` y la orfandad `LISTING`.* **Corta.**
   `PB12` (`V/03:449`) lleva a `PURGED`; `B/16-addons.md:444-449` dice que *«la ficha se borró»*
   es cualquier llegada a `PURGED`.

**Lo que el arreglo abre** (no es el camino del hallazgo, es uno nuevo): `PB11` devuelve la ficha
a `DRAFT` **sin escribir el reloj** (`V/03:588-589`), y con una moderación larga sobre un dueño
sin cobertura la cadena `PB11` → `PB5` → `PB9` borra el contenido en días. Va a §6.1 como `OW-1`.
Y la doble puerta `A5`/`A6` sobre la misma llegada a `PURGED` choca con la regla 7 del núcleo
(§6.3, `K-9`).

---

## 5. El dominio recorrido

### 5.1 Eje A — 6 estados × 15 eventos

Códigos: **T** transición declarada (con su fila); **H** sin transición, escribe un hecho del
reloj; **N** no aplica o no hace nada; **X** intento sin fila, que por la regla 1
(`N/03:34-37`) no se ejecuta. `!` marca un residuo (§6). Lectores de la columna: `PB4` en
`PUBLISHED`/`UNPUBLISHED_BY_BILLING`, `PB5` en `DRAFT`, `PB9` en `ARCHIVED`.

| | `DRAFT` | `PUBLISHED` | `UNPUBLISHED_BY_BILLING` | `ARCHIVED` | `MODERATED` | `PURGED` |
|---|---|---|---|---|---|---|
| **E1** publica | T `PB1` (hechos 1 y 3) | N | X (sale por `PB3` o el reconciliador, `V/03:870`) | X (vía `PB8`) | X (`V/03:448`) | X |
| **E2** pierde cobertura | H hecho 5, recálculo | T `PB2` r1 (hecho 5) | H hecho 5, recálculo | **H! hecho 5** (`K-3`) | H hecho 5 (`V/03:594-595`) | **H!** (`B-4`) |
| **E3** excedente | N | T `PB2` r2 (no escribe) | N | N | N | N |
| **E4** vuelve cobertura | H hecho 2 | H hecho 2 (red) | T `PB3` r1 si cupo; si no, H | T `PB7` r1 si origen y cupo; si no, H | H hecho 2 | **H!** (`B-4`) |
| **E5** vuelve cupo | N | N | T `PB3` r2 (hecho 3) | T `PB7` r2 | N | N |
| **E6** día 90 | N | T `PB4` (relee) | T `PB4` (relee) | N | N (`V/03:590-591`) | N |
| **E7** `N` meses | **T! `PB5`** (`B-2`) | N | N | N | N | N |
| **E8** despublica | X | T `PB6` (hecho 1) | X (riesgo aceptado, `V/03:974-977`) | N | X | X |
| **E9** reactiva | X | N | N | T `PB8` (hecho 1) | X | X |
| **E10** día 180 | N (exige `ARCHIVED`) | N | N | T `PB9` (relee) | N (declarado, `V/03:626-627`) | N |
| **E11** modera | T `PB10` | T `PB10` | T `PB10` | T `PB10` | N | X (final) |
| **E12** levanta | N | N | N | N | **T! `PB11`** (`OW-1`) | N |
| **E13** borra | T `PB12` | T `PB12` | T `PB12` | T `PB12` | **X!** (`K-4`) | X |
| **E14** acto del dueño | H hecho 1 | H hecho 1 | H hecho 1 | H hecho 1 (exportar; editar lo rechaza el paso 4, `V/17:79-82`) | **H!** sin definir (declarado, `V/03:620-622`) | N |
| **E15** fin de servicio | H hecho 4 | T `PB2` r1 + H hecho 4 | H hecho 4 | H hecho 4 | H hecho 4 | **H!** (`B-4`) |

Recuento (script `r9_grid.py`, scratchpad de la sesión):

```text
pares: 90 {'T': 23, 'H': 19, 'N': 34, 'X': 14}
celdas con residuo: 8
```

Las 23 celdas **T** cubren las doce filas (`PB2` aparece en tres celdas, `PB3`, `PB4` y `PB7` en
dos, `PB10` y `PB12` en cuatro). **Ningún par tiene dos filas**: coincide con `N/03:142-146`. Las
**14 X** son intentos que la tabla no declara; ninguno es un acto que el diseño prometa, salvo
`E13 × MODERATED`, que es `K-4`.

### 5.2 Eje B — quién escribe el hecho 5, con el aviso entregado y perdido

| estado de la ficha | aviso entregado | aviso perdido |
|---|---|---|
| `PUBLISHED` | `PB2` r1 | reconciliador, al día siguiente (`V/03:904`) |
| `DRAFT` | recálculo | **nadie** si el dueño sólo tiene borradores — **declarado** (`V/03:956-959`) |
| `UNPUBLISHED_BY_BILLING` | recálculo | reconciliador **sólo si** el dueño tiene otra ficha en `PUBLISHED` — **`B-1`** |
| `ARCHIVED` | recálculo | ídem — **`B-1`** |
| `MODERATED` | recálculo | ídem — **`B-1`** |
| `PURGED` | recálculo, por la letra | ídem; sin efecto — `B-4` |

La fila del reconciliador exige *«`cubierto` **falso** y al menos una ficha en `PUBLISHED`»*
(`V/03:904`). El borde declarado nombra sólo al dueño *«que sólo tiene borradores»*
(`V/03:956`, `N/01:253-256`, `contrato:845`, `N/04:171`); el dueño cuyas fichas están todas en
`UNPUBLISHED_BY_BILLING`, `ARCHIVED` o `MODERATED` sí está en la población (`V/03:881-882`) y
tampoco dispara. **9 de 12 cubiertos, 1 declarado, 2 sin declarar (`B-1`, `B-4`).**

### 5.3 Eje C — la población del corte

| | dueño sin cobertura ese día | dueño cubierto ese día (las dos cortesías del owner, `V/21:100-107`) |
|---|---|---|
| ficha publicada | `C` + hecho 5 por `PB2`, mismo instante (`V/21:151-152`) | `C`; `PB2` no dispara (`V/21:106-107`) |
| ficha no publicada | `C` + hecho 5 por el recálculo | `C` (`V/21:153-156`) |

**4 de 4 con valor legítimo.** El residuo del eje no es de valor sino de plazo: `OW-2`.

### 5.4 Eje D — lo que la retención puede tocar

| ítem | qué hace el día 180 | fuente |
|---|---|---|
| contenido de la ficha | se borra, sólo en `ARCHIVED` | `V/02:541` |
| sus borradores | se borran con ella | `V/02:541`, `V/02:554-559` |
| preferencias de la cuenta | se conservan | `V/02:543` |
| señales de identidad | se conservan | `V/02:543`, `V/22-lo-legal.md:44-46` |
| datos personales en eventos y outbox | se conservan | `V/02:543`, `N/08:71-76` |
| fila de `trial` | se conserva | `V/02:543` |
| la fila de `user` | se conserva | `V/02:543` |
| pagos, reembolsos, comprobantes | se conservan | `B/02-modelo-de-datos.md:1096` |

**8 de 8 coherentes entre `V/02`, `N/08`, `V/22` y `DEC-DATA-005`.** Se buscó texto vivo que
siguiera diciendo que el día 180 anonimiza o borra algo de la persona
(`preferencias de la cuenta|se anonimiza|anonimiza al|anonimizan|señales de identidad`, sin las
líneas tachadas): las únicas apariciones son del **borrado de la cuenta**, proceso declarado fuera
de la decisión.

### 5.5 Eje E — los guards

| guard | ¿su predicado protege la regla de hoy? |
|---|---|
| `D16` / `G-R5` | **sí**: con el hecho 5 la premisa *«arranca el primer día de la pausa»* es verdadera en toda ficha del dueño (`N/04:162-168`) |
| `G-R5-B` | **sí, con un borde**: 6 meses literales dejan un hueco de 1 a 4 días sobre el 180 (`B-2`) |
| `G-R6` | **sí**: `PB9` gana una condición que lee la columna, escrita por transiciones que ya existían (`V/20:259-265`) |
| `G-R6-B` (a) | **sí**: cinco hechos más `C`, con los ejecutores contados por hecho (`V/20:67`) |
| `G-R6-B` (b) | **sí**: seis lectores (`V/02:393-401`) |
| `G-R6-B` (c) | **sí**: los mismos seis |

**6 de 6.**

### 5.6 El recuento

| eje | casos | sin residuo | residuo declarado | residuo nuevo |
|---|---|---|---|---|
| A | 90 | 82 | 2 (`MODERATED × E13`, `× E14`) | 6 |
| B | 12 | 9 | 1 | 2 |
| C | 4 | 4 | — | — |
| D | 8 | 8 | — | — |
| E | 6 | 5 | — | 1 |
| **total** | **120** | **108** | **3** | **9** |

Los nueve residuos nuevos no son nueve problemas: salen de cinco causas (`OW-1`, `K-3`, `B-1`,
`B-2`, `B-4`).

---

## 6. Residuos

### 6.1 AL OWNER

#### `OW-1` · Levantar una moderación larga borra el contenido en días

**El caso.** Juan publica su alojamiento en trial (`PB1`, `T1`). Al día 10 un admin se la modera
por error (`PB10`). El día 14 le vence el trial sin pagar: el hecho 5 le escribe
`inactiva_desde` = día 14 en todas sus fichas, también en la moderada (`V/03:594-595`). Juan
reclama y el admin levanta la moderación el día 230 (`PB11`, a `DRAFT`). `PB11` **no escribe el
reloj** (`V/03:588-589`: *«Ni `PB10` ni `PB11` escriben `listing.inactiva_desde`: las ejecuta un
admin»*). Esa noche `PB5` ve que pasaron `N` meses desde el día 14, relee, Juan sigue sin
cobertura, y archiva, con un aviso que imprime como fecha de borrado el día 194, ya pasado
(lector 6, `V/02:399-400`). En la corrida siguiente `PB9` ve que pasó el día 180, relee, y
**borra el contenido**. Juan pierde su ficha uno o dos días después de que un admin decidió que
estaba bien.

**Por qué es del owner y no de borde.** No hace falta que nada falle: es la ejecución normal de
`PB11`. Y borra datos. El texto lo anticipa a medias (`V/03:591-593`: *«`PB5` la puede archivar en
cuanto se cumplan sus `N` meses, con su relectura de cobertura y su aviso»*) sin ver que `PB9` viene
detrás, y dos lugares afirman lo contrario: `N/08:153` (*«**no mueve dinero ni borra**»*) y
`V/03:442` (*«el día 180 cae así siempre después del archivado y de su aviso»*). Contradice además
la razón del hecho 4: *«ahí el dueño **no puede** actuar, así que contar su ausencia lo castigaría
por una decisión nuestra»* (`N/01:57`). Mientras está moderada, Juan tampoco puede actuar.

**Opciones.**

1. **`PB11` reinicia el reloj.** Se agrega un sexto hecho, *«se levanta la moderación»*, con la
   razón del hecho 4. Costo: la lista cerrada pasa de cinco a seis hechos (`N/01` §1.2, `V/02`
   §2.5, `V/20` §2 y las citas que dicen «cinco»), y `G-R6-B` (a) lo admite. Riesgo bajo. Cierra
   sólo este camino.
2. **`PB9` exige además un mínimo de K días en `ARCHIVED`**, leído del registro de eventos de
   dominio, como `PB7` ya lee su origen (`V/03:788-794`). Cierra esta cadena y también `B-2` y
   `B-3`. Costo: la fecha que imprime el lector 6 pasa a ser la más tardía entre
   `inactiva_desde + 180` y `archivado + K`, cambia la fila 18 de `V/19` §4, y hay que fijar K.
   Riesgo medio: toca el lector más caro de la columna.
3. **Aceptar y declarar**: la moderación que dura más que el reloj termina en borrado inmediato.

**Recomendación: 1.** Es el único camino de los tres que ocurre sin una falla. Aplica una razón
que el diseño ya escribió, y los otros dos (`B-2`, `B-3`) quedan bien servidos como borde
declarado. Si el owner prefiere cerrar la familia entera, la 2.

#### `OW-2` · La agenda de llamados del corte tiene un límite de hecho en el día 180, y sigue sin decidirse

**El caso.** Pedro tiene un alojamiento en el sistema viejo. El día del corte su ficha nace con
`inactiva_desde` = corte, `PB2` la despublica y le escribe el hecho 5 en el mismo instante. El
día 90, `PB4` la archiva. Al owner se le atrasa la agenda y lo llama el día 200. Pero el día 180
`PB9` releyó, Pedro seguía sin cobertura, y la ficha quedó en `PURGED`. Pedro contrata y no vuelve
nada: `PURGED` es final (`V/03:446`).

**Estado del texto.** `V/21:158-164`: *«**la agenda de llamados tiene un límite de hecho en el día
180** … El hallazgo propone declararlo como límite de la agenda (`F-8CA3-002`); **si se declara y
cómo se vigila lo decide el owner**»*. Es el único punto de R9 que el texto deja explícitamente
abierto, contra el *«ninguno quedó abierto»* del consolidado (`25-fase-8-completa/00-hallazgos.md`
§5). Lo atenúa que los tres avisos de retención son transaccionales y le llegan igual
(`N/07-outbox-y-notificaciones.md:231`), pero son correos, no la llamada.

**Opciones.**

1. **Declararlo como límite del procedimiento del corte**: la lista de dueños con ficha
   preexistente lleva fecha tope corte + 150 días (deja margen antes del aviso previo al 180), y el
   owner la vigila. Costo casi nulo; riesgo: depende de una persona, sobre unas doce fichas que el
   owner conoce (`V/21:170-171`).
2. **`PB9` no actúa sobre fichas preexistentes hasta que el dueño tuvo cobertura una vez en el
   sistema nuevo.** Costo: una guarda permanente para una población de una sola vez, que es lo que
   el §56 pide no construir (`V/21:172-173`).
3. **Sembrar `C` con un valor posterior al corte.** Rompe la definición de §1.1 (la fila `C` es el
   instante del corte) para comprar tiempo.

**Recomendación: 1.** Son pocas fichas, el owner las conoce a todas, y el propio capítulo ya
eligió la llamada sobre el mecanismo por la misma razón.

### 6.2 DE BORDE

Todos se verificaron contra el «NO cierra» de su capítulo con `rg` sobre `V/`, `N/` y el contrato.

| id | residuo | ¿declarado? |
|---|---|---|
| `B-1` | dueño sin ninguna ficha en `PUBLISHED`, con fichas en `UNPUBLISHED_BY_BILLING`, `ARCHIVED` o `MODERATED`, y aviso de la caída perdido: el reconciliador no dispara y el reloj queda viejo | **no**: lo declarado nombra sólo *«el dueño que sólo tiene borradores»* (`V/03:956`, `N/01:253-256`, `contrato:810,845`, `N/04:171`) |
| `B-2` | `G-R5-B` acepta un `N` entre 180 días y 6 meses: `PB5` archiva en el día 180 o después y `PB9` borra en la corrida siguiente | **no** (`rg '180 días' V/20-testing.md` junto a `G-R5-B`: nada; el texto tachado de `V/20:253-255` decía *«Hoy son lo mismo»*, y no lo son) |
| `B-3` | un job de `PB4` o `PB5` caído más de su plazo: al volver, archiva y `PB9` borra enseguida | **a medias**: `V/02:551-552` declara *«no se borra hasta que se archive»*, no que después se borra sin espacio |
| `B-4` | los hechos 2, 4 y 5 escriben, por la letra *«toda ficha»*, también en `PURGED` y en `MODERATED`, y los avisos previos se programan sobre esa columna (`N/07:231`) sin decir en qué estados: pueden anunciar un archivado o un borrado que ninguna fila va a ejecutar | **no** (`V/03:623-625` declara que faltan los avisos de moderar y borrar, no éste) |
| `B-5` | el dueño no puede bajar a `DRAFT` una ficha en `UNPUBLISHED_BY_BILLING` para que no se republique | **sí**: `V/03:974-977` (riesgo aceptado por `DEC-DATA-003`) |
| `B-6` | `PB12` no sale de `MODERATED` | **sí**: `V/03:616-619` (y ver `K-4`) |
| `B-7` | el contenido de una ficha moderada no tiene fin | **sí**: `V/03:626-627` |
| `B-8` | qué acepta del dueño una ficha `MODERATED` | **sí**: `V/03:620-622` |
| `B-9` | la creación de la ficha no es una fila, y la regla 2 del núcleo no nombra a publicación | **no** (búsqueda en §2) |
| `B-10` | la pausa que no reanuda llega al día 180 aunque `D16` esté verde | **sí**: `N/04:175-182`, `B/03-maquinas-de-estado.md:1586-1592` |

**Texto propuesto para los no declarados** (no se escribió en ningún capítulo):

- **`B-1`**, en `V/03` §9, ⚠️ del reconciliador, punto 1, reemplazando el sujeto (y el mismo cambio
  en `N/01:253-256`, `contrato:810` y `:845`, y `N/04:171`):
  > 1. **El dueño que no tiene ninguna ficha en `PUBLISHED` no dispara la primera fila.** Si se
  > pierde el aviso de su caída, nadie escribe el hecho 5 en sus fichas: no hay ficha publicada que
  > delate la diferencia. Vale para el que sólo tiene borradores —que además está fuera de la
  > población— y para el que tiene todas sus fichas en `UNPUBLISHED_BY_BILLING`, `ARCHIVED` o
  > `MODERATED`. Su red sigue siendo la relectura de `PB4`, `PB5` y `PB9` sobre el reloj viejo.
  > **Causa**: la fila compara estados de ficha, y la ficha publicada es la única que guarda la
  > memoria de que hubo cobertura.
- **`B-2`**, en `V/20` §2, al final del párrafo de `G-R5-B`:
  > ⚠️ **6 meses no son 180 días**: son 181 a 184. Un `N` entre 180 días y 6 meses pasa el guard, y
  > `PB5` archiva el día 180 o después; `PB9` borra en la corrida siguiente, con el aviso del
  > archivado sin espacio para exportar. **Causa**: la cota se eligió literal y el borrado cuenta
  > días. Con `N` en meses enteros el hueco no existe.
- **`B-3`**, en `V/02` §4.1, en el 📌 de las cerradas, después de *«no se borra hasta que se
  archive»*:
  > Y cuando se archive, el día 180 puede estar ya vencido: `PB9` borra en la corrida siguiente, sin
  > el espacio que el aviso del archivado supone. **Causa**: `PB9` cuenta sobre `inactiva_desde`, no
  > sobre el instante del archivado. Pasa sólo si el job del archivado estuvo caído más que su plazo.
- **`B-4`**, en `V/03` §9, *«La moderación y el borrado del dueño»*, como punto 6 del ⚠️:
  > **Punto 6.** **Los avisos previos de retención no dicen en qué estados se programan.** El reloj se
  > escribe en `MODERATED` —el hecho 5 alcanza a toda ficha del dueño— y, por la letra, también en
  > `PURGED`. Sobre una ficha moderada, el aviso anuncia un archivado o un borrado que `PB4`, `PB5` y
  > `PB9` no van a ejecutar; sobre una purgada, algo que ya pasó. **Causa**: los avisos leen la
  > columna (`V/02` §2.5, lectores 4 y 5) y no el estado.
- **`B-9`**, en `V/03` §9, debajo del recuento de estados:
  > **La ficha nace en `DRAFT`, y nacer no es una fila de esta tabla.** Es el hecho 1 —crearla— y la
  > forma de la regla 2 del cap. 03 §1 (núcleo): el estado inicial vive en la creación de la fila.
  > Sin esta línea, la regla 1 leída al pie de la letra no deja crear una ficha.

### 6.3 CONTRADICCIONES DE TEXTO

| id | un lado | el otro lado | corrección propuesta |
|---|---|---|---|
| `K-1` | `contrato:824-826`: *«las dos filas de `V/03` §9 —`PB4` y `PB5`— **y el hard delete del día 180** … que no es una fila de ninguna máquina»* | `V/03:446`: el hard delete es **`PB9`** | *«**las tres filas del reloj** de `V/03` §9 —`PB4`, `PB5` y **`PB9`**, el hard delete del día 180 (`V/02` §4.1 y §4.2 regla 4), que es el único irreversible—»* |
| `K-2` | `contrato:111`: *«cada dueño con fichas fuera de `DRAFT` y `PURGED`»* | `contrato:804` y `V/03:881-882`: fuera de `DRAFT`, `PURGED` **y `MODERATED`** | agregar *«y `MODERATED`»* en `:111` |
| `K-3` | `N/01:239-240`: *«**Queda de este punto una precisión sin cerrar**: *«todas»* incluye por la letra a las fichas ya `ARCHIVED`»* | `N/01:58` (*«toda ficha del dueño … publicada o no»*), `V/02:361`, `V/03:594-595`, `V/03:904` | cerrarla: *«**Incluye a las `ARCHIVED` y a las `MODERATED`**, y no es un detalle: la relectura de `PB9` reinicia una ficha archivada de un dueño cubierto cada 180 días, así que su reloj puede tener hasta 180 días al perderse la cobertura; sin el hecho 5, `PB9` la borraría el primer día de una pausa»*. **Pesa**: si un implementador lee la precisión como exclusión, reabre `F-8CA2-001` sobre las archivadas de un cliente que paga |
| `K-4` | `V/02:216`: *«el dueño la borra **siempre**, con o sin plan»* (y `00-hallazgos.md` §5: *«el dueño borra con `PB12` a `PURGED`, siempre, con o sin plan»*) | `V/03:449`: el `desde` de `PB12` no tiene `MODERATED`; `V/03:616-619` lo declara | `V/02:216`: *«el dueño la borra con o sin plan, desde cualquier estado salvo `MODERATED` (`V/03` §9, ⚠️ punto 1)»*. Si el owner quiso decir *«también moderada»*, el cambio es a la tabla y no a esta línea |
| `K-5` | `V/03:442`: *«el día 180 cae así **siempre** después del archivado y de su aviso»*; `V/02:549`: *«el aviso del archivado salió siempre antes»* | `OW-1`, `B-2`, `B-3`: el orden se cumple, el espacio no | *«después del archivado; el espacio entre los dos no está garantizado»*, con referencia a los residuos (depende de `OW-1`) |
| `K-6` | `N/08:153`: levantar la moderación *«**no mueve dinero ni borra**»* | la cadena `PB11` → `PB5` → `PB9` de `OW-1` | depende de `OW-1`; con la opción 1 la frase queda verdadera |
| `K-7` | `log:4311`: *«la lista de los **cinco** consumidores de `inactiva_desde`»* | `V/02:393-401` (seis), `V/20:67` | corregir en el log a *«seis»*; ya anotado como pendiente en `V/02:417-418` |
| `K-8` | `N/01:425-428`: las filas `Publicación`, `Postulación de Partner`, `Grace` y `Pausa` del diccionario de estados | el blockquote de `N/01:416-424` las absorbe: no hay línea en blanco y no se muestran como tabla | mover el blockquote debajo de la fila `Pausa` (`:428`) |
| `K-9` | `N/03:68` (regla 7): *«Dos filas que comparten `(desde, evento)` tienen guardas disjuntas»*, y si se solapan *«el intento cae en la regla 1 —no se ejecuta»* (`:76-78`) | `B/16:444-449`: toda llegada a `PURGED` dispara `A5` (huérfano) **y** `A6` (*«se borra la ficha destino»*), las dos desde `ACTIVE` | leída al pie de la letra, ninguna corre y el addon `LISTING` sigue cobrando. Es de R6 (addons), no de R9: se propone declararlo como décimo caso de la regla 7 (mismo destino, mismo motivo 14) o dejarle a `A6` sólo el borrado que no es llegada a `PURGED`. Toca plata si se lee literal: **conviene que lo mire quien cierra R6** |

---

## 7. Veredicto

| hallazgo | veredicto |
|---|---|
| `F-8CA2-001` | DEJA DE LLEGAR |
| `F-8CA3-001` | DEJA DE LLEGAR |
| `F-8CA3-002` | DEJA DE LLEGAR en su camino numerado; su frase final sobre la agenda **sigue llegando** (`OW-2`) |
| `F-8CC2-003` | DEJA DE LLEGAR |
| `F-8CA2-008` | DEJA DE LLEGAR |
| `F-8CA2-014` | DEJA DE LLEGAR (borde `B-2`) |
| `F-8CD1-009` | DEJA DE LLEGAR (registro `K-7`) |
| `F-8CA3-009` | DEJA DE LLEGAR |
| `F-8CA2-004` | DEJA DE LLEGAR; el arreglo abre `OW-1` |

**La máquina de publicación está completa como tabla**: seis estados, doce transiciones, ningún
par con dos filas, y cada uno de los 90 pares estado × evento tiene respuesta escrita. **Donde no
cierra es en el reloj**: una transición nueva (`PB11`) devuelve la ficha sin reiniciarlo (`OW-1`),
y la red del aviso perdido es más angosta de lo declarado (`B-1`).

**R9 no se declara resuelto** mientras `OW-1` y `OW-2` no tengan respuesta del owner y `K-3` no se
aplique. `K-3` no pide decisión: es cerrar un texto que ya dice lo correcto en otros cuatro
lugares.
