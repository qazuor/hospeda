---
title: "FASE 9 completa · propuesta de cambios al log de decisiones y a la matriz de MP"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: PROPOSAL
fase: 9
---

# FASE 9 completa — propuesta para el log y la matriz

**Este documento no edita nada.** Propone, para `01-decision-log.md` (en adelante `D/01`) y
`06-mp-validation-matrix.md` (`D/06`), el texto exacto que piden las decisiones del owner
([`10`](./10-decisiones-del-owner.md)) y las contradicciones de los informes `01`–`09`. Cada ítem
dice **qué** se inserta o se tacha, **dónde** (archivo:línea y el texto que hace de ancla, medidos
sobre el árbol del 2026-09-25) y **por qué**.

Las líneas se midieron antes de cualquier edición: **quien aplique, que lo haga de abajo hacia
arriba** dentro de cada archivo, o que vuelva a buscar el ancla, porque cada inserción corre las
líneas que le siguen.

## 0. Cómo leer las marcas, y el criterio

| marca | qué es | qué pide |
|---|---|---|
| 🆕 | **decisión nueva**: entrada `### DEC-…` nueva al final del log | **OK explícito del owner** al texto y al ID |
| 📌R | **registro de una decisión que el owner ya tomó** en `10`, como precisión de una entrada existente | OK al texto; la decisión ya está tomada |
| ✏️ | **corrección de registro**: una cifra, una cita o un puntero que quedó atrás; no decide nada | nada, salvo donde se indica |

**Criterio para 🆕 o 📌R**, aplicado a cada fila de `10`:

- **🆕** cuando la respuesta (a) va **contra la recomendación** o cambia el sentido de un texto
  `ACCEPTED`, o (b) crea **mecanismo, estado, acto o lista cerrada nueva sin entrada madre** en el
  log. La regla del log lo exige: *«Ninguna decisión vive en otro lado … Si no está acá, no se
  decidió»* (`D/01:12-16`).
- **📌R** cuando **aplica o acota** una entrada existente sin cambiarle el sentido. Va como hace el
  log hoy: un 📌 en el cuerpo y un puntero en el campo *Estado*, sin editar el contenido
  (`D/01:1420`, `:1451`; `D/01:1694`, `:1753`; `D/01:5144`, `:5174`).
- **Agrupar**: una 🆕 por dominio cuando varias respuestas comparten razón, para no inflar el log
  con entradas de una línea.

**IDs nuevos, verificados sin colisión** (script sobre `D/01` y `rg` sobre todo `.specs/`):
`DEC-SUB-022`, `DEC-MIG-005`, `DEC-RF-008`, `DEC-ADDON-007`, `DEC-AUTH-001`, `DEC-ENT-006`,
`DEC-ARCH-011`. Los máximos hoy son `SUB-021`, `MIG-004`, `RF-007`, `ADDON-006`, `ENT-005`,
`ARCH-010`, y `AUTH` no tiene ninguna (el área está declarada en `D/01:38-39`). Ninguno aparece
citado en ningún archivo del programa:

```text
rg -n -o 'DEC-(SUB-02[2-9]|ADDON-00[7-9]|RF-00[8-9]|DATA-00[6-9]|ARCH-01[1-9]|MIG-00[5-9]|TRIAL-01[1-9]|PROMO-00[3-9]|AUTH-00[0-9]|ENT-00[6-9]|MAIL-00[2-9]|CONC-00[4-9]|MP-009|GRANT-01[5-9])' .specs   # → cero
```

## 1. La propuesta en una tabla, de mayor a menor importancia

| # | marca | qué | cierra (`10` / informe) | archivo |
|---|---|---|---|---|
| 1 | 🆕 | `DEC-SUB-022`: la sucesora de quien venía pagando entra en grace; el barrido corta ese grace | 3c | `D/01` |
| 2 | 📌R | `DEC-SUB-021` y `DEC-MP-008` apuntan a `DEC-SUB-022`; `DEC-SUB-021` condicionada a `GR-1`, la promo del suspendido y el orden invertido | 3a, 3b, 3c; `01` C3 | `D/01` |
| 3 | 🆕 | `DEC-MIG-005`: el corte trata a la cartera vieja como clientes nuevos | 2a, 2d, 2g | `D/01` |
| 4 | 📌R | `DEC-MIG-003`: gate de completitud, backup, sólo hacia adelante, re-vinculación, sin siembra; `CT-4` y `C-7` | 2b, 2c, 2e, 2f, 2g; `02` CT-4; `09` C-7 | `D/01` |
| 5 | 📌R | `DEC-MIG-004`: la rama de aborto no se resuelve hablando; `#1`, `#15`, `#16`; la agenda del día 180; la cita del umbral | 2d, 5c; `02` CT-5; `09` C-7, C-10 | `D/01` |
| 6 | ✏️ | `DEC-MIG-002` → `SUPERSEDED EN PARTE por DEC-MIG-003` | `09` C-9 | `D/01` |
| 7 | 📌R | `DEC-MAIL-001`: el correo que agotó sus reintentos no bloquea | 1 | `D/01` |
| 8 | 🆕 | `DEC-RF-008`: máquina mínima de `refund` y acción administrativa 14 | 5a | `D/01` |
| 9 | 🆕 | `DEC-ADDON-007`: los addons siguen a su título | 4a, 4c, 4d, 4e | `D/01` |
| 10 | 📌R | `DEC-PROMO-001`: el piso del apilado se rechaza al canjear | 4b | `D/01` |
| 11 | 🆕 | `DEC-AUTH-001`: vertical inmutable y leída del recurso; lo ajeno sólo público; lo propio sin paso 6; invalidación por `user` | 7a, 8a–8d | `D/01` |
| 12 | 🆕 | `DEC-ENT-006`: la presencia de Partner, sin máquina, con carrusel y bit de moderación | 7b, 7c (+ `R13`) | `D/01` |
| 13 | 📌R | `DEC-ARCH-009`: la población excluye `MODERATED` e incluye a Partner | `08` §3.3-2; `06` contradicción 1 | `D/01` |
| 14 | 🆕 | `DEC-ARCH-011`: la vertical que no admite altas no admite suscripciones; el fin de servicio invalida el caché | 6a, 6b (+ `R11`) | `D/01` |
| 15 | 📌R | `DEC-TRIAL-010`: `T6` y `T8`, el botón inteligente, y el corte no es de esta decisión | 6c; `07` C-R12-1 | `D/01` |
| 16 | 📌R | `DEC-CONC-002`: precondición de la re-vinculación; cota de *«todavía no se sabe»*; nota «once→trece» | 2b, 3d; `04` C-R5-6 | `D/01` |
| 17 | 📌R | `DEC-DATA-002`: los hechos del reloj pasan de cuatro a seis | 5b (+ hecho 5 de `R9`) | `D/01` |
| 18 | 📌R | `DEC-DATA-005`: el registro de eventos no guarda el contenido | 8e | `D/01` |
| 19 | 📌R | `DEC-SUB-013`: la cuota la cierra la salida (tercera cláusula de `MP3`) | 8f | `D/01` |
| 20 | ✏️ | `DEC-DATA-004` y `DEC-TEST-001`: *«cinco consumidores»* → seis | `05` K-7 | `D/01` |
| 21 | ✏️ | `DEC-SUB-019`: la cita de `RN-3` no está registrada | `01` C2 | `D/01` |
| 22 | ✏️ | `DEC-ARCH-008`: el veredicto rige todo cambio de plan | `01` C9 | `D/01` |
| 23 | ✏️ | `DEC-RF-007`, `DEC-DATA-001`, `DEC-SUB-006`, `DEC-SUB-017`: punteros en *Estado* | convención del log | `D/01` |
| 24 | ✏️ | matriz: `GR-3` y `RC-7` sin tachar | `01` C1 | `D/06` |
| 25 | ✏️ | matriz: `RN-3` no registra lo que se le atribuye | `01` C2 | `D/06` |
| 26 | 📌R | matriz: `GR-1` condiciona `DEC-SUB-021`; `PA-6` acota `DEC-SUB-022`; `RC-1` y el control del corte (**sin fila nueva**) | 3a, 3c, 2f | `D/06` |
| 27 | ✏️ | matriz: *«Qué espera cada decisión»* y `updated:` | 3a, 3c, 4b | `D/06` |
| 28 | ✏️ | el Resumen del log, recontado con script | — | `D/01` |
| 29 | ✏️ | **fuera del log** (carril núcleo): `N/00` dice 111 y omite `DEC-SUB-003` | `09` C-13 | `nucleo/00-indice.md` |

---

## 2. El log, ítem por ítem

### 2.1 🆕 `DEC-SUB-022` — la sucesora de quien venía pagando (3c)

**Por qué nueva y no 📌**: va **contra la recomendación** (el orquestador recomendó la opción 1),
cambia la lectura *«grace por autorización»* de `B/03` §3.1, agrega un control al barrido, y el
owner pidió explícitamente *«entrada en el log»* (`10:29`). Además roza la regla 3 del log (`PA-6`
está `UNKNOWN`), y eso hay que argumentarlo por escrito, no en una nota.

**Dónde**: `D/01`, después de `DEC-METH-015` (su último renglón es `:5361`, *«…aprobada por el
owner.»*) y antes del `---` de `:5363`. Las siete 🆕 van ahí, en el orden de este documento.

```markdown
---

### DEC-SUB-022 — La sucesora de quien venía pagando entra en grace si falla su primer cobro, y el barrido corta ese grace si el proveedor ya se rindió

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-SUB-021`** —cubre la población que dejó con *«la persona se queda sin nada»*— **y
  `DEC-MP-008`** —sobre esta sucesora, un `cancelled` leído en el proveedor también termina el
  grace, no sólo un `paused`—. No supera a ninguna.
- **Problema** (`26-fase-9-completa/01-…` §3.5, pendiente 3; sale de `F-8CB1-009`): *Juan* paga
  Básico hace un año. Pide Premium y autoriza; `S17` cancela Básico **al autorizar** y `S18`
  re-apunta sus addons a la sucesora. El primer cobro de Premium, diferido por `D8`, se rechaza. Como
  la sucesora no tiene ningún pago acreditado, corre `S16` y no `S4`: `CHARGE_DECLINED`, terminal, sin
  grace. Juan queda sin plan y con sus addons huérfanos, y tiene que suscribirse desde cero. Lo mismo
  desde `CANCEL_SCHEDULED` (el arrepentimiento). No le pasa al pagador manual —`S29` exige la cuota
  pagada— ni a la sucesora de una `SUSPENDED`, que no tenía servicio. Es el mecanismo que
  `DEC-SUB-021` cerró **en el grace**, sobre la población que quedó afuera.
- **Alternativas**: (1) aceptarlo y decirlo antes de confirmar el cambio; (2) una sucesora cuya
  predecesora venía pagando va a `S4` y no a `S16`; (3) `S17` espera el primer cobro de la sucesora,
  que es la alternativa (2) que `DEC-SUB-021` descartó.
- **Decisión**: **(2), más un control del owner.** Si falla el primer cobro de una sucesora **cuya
  predecesora venía pagando** —tenía al menos un pago acreditado—, **la sucesora entra en grace
  (`S4`) y no muere (`S16`)**. Y **el barrido diario relee su preapproval por id** (`D17`): si el
  proveedor lo **canceló** o lo **pausó**, el grace termina en el acto —`S6`: suspensión,
  cancelación de nuestro lado de lo que quede vivo, y aviso de suspensión con *«volvé a
  suscribirte»*—, con la misma forma que `DEC-MP-008`.
- **Las dos posiciones, porque va contra la recomendación**:
  - **La del orquestador, (1)**: es la única que no reabre la lectura *«grace por autorización»*
    (`B/03` §3.1), y la (2) se apoya en `PA-6`, que está `UNKNOWN`: si el proveedor cancela el
    preapproval ante un primer rechazo, ese grace espera un pago que no puede llegar.
  - **La del owner, (2)**: que Juan, que venía pagando, no quede sin nada. El riesgo de `PA-6` lo
    acota el control: a lo sumo **un día** de grace sobre un preapproval que el proveedor ya dio por
    perdido.
- **Por qué la regla 3 de este log no la frena** (*«una decisión sobre Mercado Pago no puede
  tomarse mientras su fila … diga `UNKNOWN`»*): **la decisión no depende de la respuesta de
  `PA-6`**. Si el proveedor reintenta, el grace cobra como cualquier otro y corre `S5`; si cancela o
  pausa, el barrido lo lee y corre `S6`. Lo que `PA-6` decide es **cuánto dura** ese grace, y el
  control lo acota a un día.
- **Lo que se resigna**: hasta un día de servicio sobre una sucesora que ya no puede cobrar; y que el
  grace deje de leerse sólo *«por autorización»*: para esta población se lee también por la relación
  con la predecesora.
- **Lo que no cambia**: el alta nueva y la sucesora de una `SUSPENDED` siguen muriendo por `S16`;
  y desde `GRACE_PERIOD` sigue sin declararse una sucesión (`DEC-SUB-021`).
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` fila 3c, sobre `01-…` §3.5 pendiente
  3; elección del owner del 2026-09-25, **contra la recomendación** (la primera presentación numeró
  mal las opciones y se volvió a preguntar).
```

### 2.2 📌R `DEC-SUB-021`, `DEC-MP-008` — 3a, 3b, 3c y el orden invertido (`01` C3)

**`DEC-SUB-021`, campo *Estado*** — `D/01:5186`. Reemplazar:

```markdown
- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
```

por:

```markdown
- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: la salida *«cambiá la tarjeta»* queda **condicionada a `GR-1`**; el suspendido que vuelve pierde la promo; la sucesora declarada en `ACTIVE` la decide **`DEC-SUB-022`**; ver su 📌) · **Decide**: owner
```

**`DEC-SUB-021`, cuerpo** — insertar después de `D/01:5218` (el *Origen*, *«…elección del owner del
2026-09-25.»*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 3a y 3b de
  `26-fase-9-completa/10`; `01-…` §3.5 pendiente 1, §2.5 pendiente 2 y contradicción `C3`).**
  1. **La frase *«los reintentos del proveedor cobran con ella»* queda CONDICIONADA a `GR-1`**, como
     `DEC-SUB-010` lo está a su segunda lectura. El *Contexto medido* no la mide: `EX-36` mide que la
     tarjeta **se puede** cambiar, no que el reintento de un cobro ya abierto use la nueva; y `GR-3`
     mide la ventana sobre sujetos de 1 y 2 días —cuántos reintentos caen dentro del grace de un plan
     mensual es extrapolación—. **Se mide con el próximo rechazo mensual real.** Mientras tanto, **la
     pantalla y los correos del grace no prometen que el reintento use la tarjeta nueva**. La
     decisión no cambia; cambia lo que se le promete al cliente.
  2. **El *Contexto medido* invierte un orden**: con `DEC-SUB-019` el grace es más corto que el
     ciclo, así que **es nuestro grace el que cae dentro de la ventana de reintentos del
     proveedor**, y no al revés. El reintento que cae después del grace es lo que `DEC-SUB-019`
     resignó.
  3. **El suspendido con tarjeta que vuelve por sucesión pierde su promo** (3b): `S18` no re-apunta
     la redención y el código no se canjea dos veces. **Se acepta, y se dice en el aviso de
     suspensión.** El owner lo dejó anotado para mejorarlo más adelante.
  4. **El primer cobro fallido de una sucesora declarada en `ACTIVE` o `CANCEL_SCHEDULED`**, que esta
     decisión dejaba con *«la persona se queda sin nada»*, lo decide **`DEC-SUB-022`**.

  La entrada no se edita en su contenido.
```

**`DEC-MP-008`, campo *Estado*** — `D/01:5105`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-SUB-022`**: sobre la sucesora que entra en grace por esa decisión, un `cancelled` leído en el proveedor también termina el grace con `S6`, no sólo un `paused` ·
```

Es la forma que el log usa para `DEC-SUB-019` (`D/01:5052-5054`): puntero en *Estado*, sin 📌 en el
cuerpo, porque la precisión la escribe la decisión que precisa.

### 2.3 🆕 `DEC-MIG-005` — el corte trata a la cartera vieja como clientes nuevos (2a, 2d, 2g)

**Por qué nueva**: las tres respuestas van **contra la recomendación** (`10:52-54`), comparten una
sola razón —*«los tomamos como clientes nuevos»*—, y 2g **revierte una regla que el owner aprobó el
mismo día** (`V/21` §2.4, consolidado `25-…/00-hallazgos.md:346`) y que nunca tuvo entrada en el log
(`07` `C-R12-1`). Una 📌 en `DEC-MIG-003` sola no alcanza: esa entrada decide *«no se migra»*, y
éstas deciden qué se descarta **a propósito** y por qué, con un posible apartamiento del PDR.

**Alternativa que se descarta**: tres entradas separadas (`MIG` para 2a y 2d, `TRIAL` para 2g).
Cuesta dos IDs más para una sola razón; si el owner prefiere el trial en su área, 2g se muda a
`DEC-TRIAL-011` sin tocar el texto.

**Dónde**: al final del log, después de `DEC-SUB-022`.

```markdown
---

### DEC-MIG-005 — El corte trata a la cartera vieja como clientes nuevos: no conserva nada del sistema viejo, no devuelve la diferencia del aborto y les regala el trial

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-MIG-003`** (qué se pierde y qué escribe el corte) **y `DEC-MIG-004`** (su #17 no
  alcanza a la rama de aborto). No supera a ninguna.
- **Problema**: tres preguntas del corte que la FASE 9 completa trajo al owner
  (`26-fase-9-completa/02-…` `AO-1` y `AO-4`; `07-…` `R12-OWNER-3`):
  1. qué pasa con las tablas de billing del sistema viejo y con las columnas que las copian, que
     desde el 2026-09-26 —el primer cobro, `ed00a8fd`— guardan pagos (`F-8CB3-014`, `F-8CA3-007`,
     `F-8CC2-007`);
  2. qué se hace con lo que cobra la rama de aborto a quien se re-suscribe por el link reactivado: el
     proveedor no repite el trial y le cobra en el acto (`F-8CC2-004`; `16-fase-7…` §4.2: *«Qué se
     hace con esa diferencia no está decidido»*);
  3. a quién le escribe el corte una fila de `trial` consumida (regla de capítulo del 2026-09-25,
     `V/21` §2.4).
- **Decisión**, las tres del owner y las tres **contra la recomendación**:
  1. **Del sistema viejo no se conserva nada** (2a): el historial no se guarda ni se congela, y las
     tablas se retiran. *«Recién arrancamos; a los clientes que hay los contactamos en persona, de a
     uno, y se vuelven a suscribir. Guardarlo sólo deja basura que después cuesta limpiar.»* Lo que el
     corte tuviera que leer del sistema viejo corre **antes** de retirar esas tablas; con el punto 3
     no queda nada que leer.
  2. **La diferencia que cobra la rama de aborto no se devuelve** (2d): quien se re-suscribe arranca
     un trial nuevo desde cero.
  3. **El corte no siembra trials consumidos** (2g): *«A los clientes ya suscriptos les regalamos el
     trial de nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la
     tengan que cargar de nuevo; la suscripción es como si recién arrancaran.»* **Revierte** la regla
     del 2026-09-25 *«el corte siembra trials consumidos»* (`V/21` §2.4; consolidado
     `25-fase-8-completa/00-hallazgos.md` §5, fila `R12`). **Lo que toca fichas se mantiene**:
     `inactiva_desde` = instante del corte (`NUCLEO/01` §1.2, fila `C`).
- **Las dos posiciones**:
  - **La recomendación**: (1) congelar las tablas viejas en solo lectura, con la retención de
    `payment`, porque un contracargo de un cobro viejo pide su comprobante; (2) aplicarle a la
    diferencia `DEC-MIG-004` —hablarlo, con reembolso manual si hace falta—; (3) sembrar la fila
    consumida sólo a quien ya ejerció el evento (fichas publicadas, suscripciones que autorizaron).
  - **La del owner**: la cartera es chica y conocida, se la llama de a uno y se la trata como
    clientes nuevos. Conservar o sembrar agrega filas heredadas que el sistema nuevo no necesita
    —el mismo argumento de `DEC-MIG-003`: *«el escenario más limpio posible»*—.
- **Lo que se resigna, declarado**:
  - **El comprobante de un cobro del sistema viejo.** Si alguien desconoce ante su banco un cargo
    cobrado bajo el sistema viejo, no hay registro nuestro; queda el del proveedor, cuyo buscador
    cubre doce meses (`DEC-CONC-002` impl. 4).
  - **El trial único como control**, para esta cohorte: quien ya tuvo trial lo vuelve a tener. Son
    personas conocidas.
  - **La diferencia cobrada en el aborto**, a quien se re-suscriba.
- **⚠️ Apartamiento del PDR, a confirmar por el owner**: el §25 enumera **«pagos»** entre lo que se
  conserva. Habla de la retención de una ficha inactiva, pero la lista no distingue de qué sistema.
  **Se propone declararlo** —sería el noveno del resumen— y llevar la pregunta al pliego del abogado
  (`13-…`). Si el owner lee que el §25 no alcanza a un sistema que se retira, no se declara.
- **Qué vuelve innecesario**: leer las tablas viejas en el corte; el censo de la fila de `trial` y sus
  bordes (`02-…` `DB-6`; `09-…` `DB-5` en su mitad de trial; `07-…` `R12-OWNER-3`); y la rama
  «conservar» de `F-8CC2-007`.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 2a, 2d y 2g, sobre `02-…` `AO-1`
  y `AO-4` y `07-…` `R12-OWNER-3`; respuestas del owner del 2026-09-25.
```

### 2.4 📌R `DEC-MIG-003` — 2b, 2c, 2e, 2f, 2g; `CT-4` corregido por 2a/2g; `C-7`

**`CT-4` no se aplica como lo propuso `02`.** Su texto decía *«el trial consumido ya no se pierde
(`V/21` §2.4); el corte escribe `inactiva_desde` y la fila de `trial`»*. Con 2g eso quedó **al
revés**: el trial se regala a propósito, y el corte no escribe la fila de `trial`. Y *«nada de plata»*
no se corrige con *«destino: `AO-1`»*, porque 2a decidió que **no hay destino**. Lo que sigue
reemplaza la propuesta de `CT-4`.

**Campo *Estado*** — `D/01:2540-2541`. Reemplazar:

```markdown
- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED — **el orden del corte, precisado el 2026-09-24**
  (FASE 8 completa, racimo `R2`; ver el punto *«El orden del corte»* abajo) · **Decide**: owner
```

por:

```markdown
- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED — **el orden del corte, precisado el 2026-09-24**
  (FASE 8 completa, racimo `R2`; ver el punto *«El orden del corte»* abajo), **y el corte entero,
  precisado el 2026-09-25** (FASE 9 completa: el gate de completitud, el backup, sólo hacia
  adelante, la re-vinculación y el corte sin siembra; ver el segundo 📌 de ese punto y
  `DEC-MIG-005`) · **Decide**: owner
```

**Cuerpo** — insertar después de `D/01:2593` (*«…Detalle en `16-fase-7-del-paraguas.md` §4.2.»*,
cierre del 📌 del 24/09) y antes de `:2594` (*«- **⚠️ Condición de caducidad**»*):

```markdown
  - **📌 Precisado el 2026-09-25, con OK del owner** (FASE 9 completa, decisiones 2b, 2c, 2e, 2f y
    2g de `26-fase-9-completa/10`; `02-…` `AO-2`, `AO-3`, `AO-5`, `AO-6`, `CT-4`; `09-…` `C-7`).
    **El orden de base sigue sin cambiar.** Cambian cinco cosas:
    1. **El gate del paso 2 exige completitud** (2f): el conteo del recorrido sin filtro tiene que
       igualar el `total` de su paginado, y **todo id conocido** —los de nuestra base y los de los
       manifiestos de sonda— tiene que aparecer en él; si no, el corte no avanza. La premisa *«el
       recorrido sin filtro es completo»* **no está medida** (`RC-1` mide que los filtros mienten, no
       el recorrido), y este control hace que el corte no dependa de ella.
    2. **La rama de aborto restaura un backup** (2e): se toma antes de la migración del paso 3 y, si
       el corte aborta con la migración ya aplicada, se restaura. Lo que el sistema viejo anote en esa
       ventana se pierde, y por `DEC-MIG-005` no cuesta nada.
    3. **Pasado el paso 3 no hay vuelta atrás al sistema viejo** (2c): sólo arreglo hacia adelante
       —*«no va a pasar»*—. *«Lo único que sobrevive: el rollback del PROGRAMA»* (arriba) queda
       acotado a lo que ocurra **antes** del paso 3.
    4. **Un desconocido ya no se re-vincula con «el candidato más plausible»** (2b): sólo si su
       `external_reference` nombra una fila nuestra sin otro vínculo vivo; todo otro desconocido abre
       marca (`DEC-CONC-002`, su segundo 📌). La precisión del 2026-09-20 de arriba —*«el único camino
       automático para un desconocido es re-vincularlo — con la suscripción nueva de esa misma
       persona como candidato más plausible»*— **deja de describir el diseño**. La lápida sigue
       haciendo falta, para reconocer el cobro viejo como tal.
    5. **El corte no siembra trials consumidos ni lee el sistema viejo** (2g, `DEC-MIG-005`). Lo que
       escribe sigue siendo: las lápidas (paso 4), los dos `permanent_grant` y `inactiva_desde` =
       instante del corte en toda ficha preexistente.

    **Y tres frases de arriba, releídas el 2026-09-25**: *«**nada de plata** —no hay un solo pago
    histórico»* **caduca el 2026-09-26**, cuando cobra `ed00a8fd` bajo el sistema viejo, y esos pagos
    **no se conservan** (`DEC-MIG-005`). El *«trial ya consumido de seis personas»* **deja de ser una
    pérdida y pasa a ser lo decidido**: a toda la cartera vieja se le regala el trial; la cuenta de
    seis, que `F-8CA3-012` mostró tomada sobre un subconjunto, ya no decide nada. Y *«las fichas
    publicadas de Alojamiento se despublican la mañana del corte»* **tiene el mecanismo
    equivocado**: el corte no es un cambio de `cubierto`, así que `PB2` no dispara por evento; las
    baja **la primera corrida del reconciliador diario** (`DEC-ARCH-009`), dentro del primer día. El
    desenlace que se aceptó es el mismo. La entrada no se edita en su contenido.
```

### 2.5 📌R `DEC-MIG-004` — 2d, 5c; `CT-5`, `C-7`, `C-10`

**Campo *Estado*** — `D/01:2823`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 9 completa: la rama de aborto, los defectos #1, #15 y #16, la agenda del día 180 y la cita del umbral; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:2858` (fin del *Origen*, *«…el sistema nuevo esté
andando»*—.»*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 2d y 5c de
  `26-fase-9-completa/10`; `02-…` `CT-5`; `09-…` `C-7` y `C-10`).**
  1. ***«Se resuelve hablando»* NO alcanza a la diferencia que cobra la rama de aborto del corte**
     (2d): no se devuelve (`DEC-MIG-005`). El #17 sigue valiendo para lo que decía: un período pagado
     bajo el sistema viejo.
  2. **La causa del #15 y el sujeto del #16 caducaron el 2026-09-24**: el censo del paso 1b sale del
     recorrido del proveedor e incluye ids que la base no conoce, así que *«el cobro en vuelo es de
     uno de los tres conocidos»* y *«cancela "los tres"»* ya no son ciertos. **La conclusión del #15
     sigue**: un cobro en vuelo entre el paso 3 y el 4 de alguien que la base no conoce no se
     re-vincula —su `external_reference` no nombra una fila nuestra (`DEC-CONC-002`, segundo 📌)— y
     abre marca.
  3. **El desenlace del #1 ya no ocurre**: la cartera no queda publicada sin cobertura; la baja la
     primera corrida del reconciliador diario (`DEC-ARCH-009`), dentro del primer día. La causa del
     #1 sigue —el corte no es un cambio de `cubierto`— y la respuesta de esta decisión también.
  4. **La agenda de llamados tiene un límite de hecho en el día 180** (5c; `05-…` `OW-2`): la ficha
     preexistente de un dueño que no contrató llega a `PURGED` ese día. **No se hace nada especial**:
     *«tenemos 180 días para que lo hagan, es un montón de tiempo»*. Se declara para que no se vuelva
     a reportar (`V/21`, «NO cierra»).
  5. **La cita del umbral apunta a un § que no lo tiene**: *«unas 20 (`B/21` §2.4, hoy 8)»* está en
     **`V/21` §2.5**.

  La entrada no se edita en su contenido.
```

### 2.6 ✏️ `DEC-MIG-002` → `SUPERSEDED EN PARTE` (`09` `C-9`)

**Por qué ✏️ y no 🆕**: la supersesión ocurrió el 2026-09-19 con `DEC-MIG-003` (*«no se migra»*);
lo que falta es el puntero. Mueve una cifra del resumen (`SUPERSEDED` 5 → 6), y por eso `09` pide el
OK del owner.

**Campo *Estado*** — `D/01:2263`. Reemplazar:

```markdown
- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
```

por:

```markdown
- **Fecha**: 2026-09-19 · **Estado**: **SUPERSEDED EN PARTE por `DEC-MIG-003`** (2026-09-19): sobrevive *«se siguen tomando altas en el sistema actual»*; se cae *«se transcriben a mano cuando el rediseño esté listo»* —no se migra nada, y las altas nuevas se llaman como la cartera (`DEC-MIG-004` #16; y desde el 2026-09-25 se tratan como clientes nuevos, `DEC-MIG-005`)—. El puntero se registró el 2026-09-25 (FASE 9 completa, `F-8CB3-013`, `F-8CA3-013`) · **Decide**: owner
```

### 2.7 📌R `DEC-MAIL-001` — el `failed` no bloquea (1)

**Campo *Estado*** — `D/01:1492-1493`. Reemplazar `…ver su 📌) · **Decide**: owner` por:

```markdown
…ver su 📌), **y otra vez el mismo día** (FASE 9 completa: el correo que agotó sus reintentos tampoco bloquea; ver su segundo 📌) · **Decide**: owner
```

**Cuerpo** — insertar después de `D/01:1526` (*«…antes vivía sólo acá y ninguna transición lo
nombraba.»*) y antes de `:1527` (*«2. **Los correos falsos…»*), con la sangría del punto 1:

```markdown
     **📌 Precisado otra vez el 2026-09-25, con OK del owner (FASE 9 completa, decisión 1 de
     `26-fase-9-completa/10`; `04-…` §R5.5.1).** **Tampoco bloquea el correo que agotó sus
     reintentos** (`failed` en el outbox, `NUCLEO/07` §1.3): es, por definición, una falla que no
     pasó, y le cabe la razón del 📌 anterior. Se cancela igual y se escala como no-entregable, igual
     que sin destinatario. Sin esto, un `failed` trababa `S17` —cobraban las dos— y `S6` —el moroso
     seguía en grace con servicio entero y sin plazo—. **Lo que se acepta**: en una caída larga del
     proveedor de correo, algunas cancelaciones salen sólo con el correo del proveedor, que insinúa
     mora (`EX-3`). **La rama transitoria —el correo todavía puede salir— sigue bloqueando.**
```

El apartamiento del PDR que el resumen le cuenta (§43 y §64.25) **no cambia**: se achica, no
desaparece.

### 2.8 🆕 `DEC-RF-008` — la máquina del reembolso y la acción 14 (5a)

**Por qué nueva**: crea una **máquina** (`refund`), un **acto** y mueve una **lista cerrada** (el
catálogo de `NUCLEO/08` §3, 13 → 14). `DEC-RF-007` es la madre más cercana, pero decide que la
reparación **es** manual, no con qué acto se asienta.

```markdown
---

### DEC-RF-008 — El reembolso tiene máquina mínima, y lo que ocurrió por fuera del flujo se asienta con una acción administrativa nueva

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-RF-007`**: *«la reparación es manual»* gana el acto con que se asienta. No supera a
  ninguna.
- **Problema** (`F-8CB1-015`, que no llegó a ningún capítulo; `26-fase-9-completa/04-…` §R7.5.1 y
  `C-R7-1`): la fila de `refund` tiene una columna *estado* sin valores ni transiciones (`B/02` §2.3),
  así que el reintento que exige el `2084` (`DEC-RF-001` punto 3) no tiene dónde vivir. **Nada
  escribe** la devolución de un `manual_payment` ni la de un cobro más viejo que el plazo del
  proveedor (`DEC-RF-007`). Y los motivos 18 (`REEMBOLSO_FUERA_DEL_FLUJO`) y 19
  (`COBRO_SIN_REGISTRAR`) mandan a una persona a *«asentar»* con un acto que el catálogo no tiene,
  cuando `NUCLEO/08` §3 prohíbe ejecutar una escritura que no esté nombrada en ninguna fila.
- **Alternativas**: (1) máquina mínima y una acción administrativa nueva; (2) sólo el acto de lo
  hecho por fuera, con la fila de `refund` naciendo ya ejecutada; (3) declararlo de borde.
- **Decisión**: **(1)**.
  1. **`refund`: `REQUESTED → CONFIRMED → EXECUTED | FAILED`.** `EXECUTED` lo escribe la relectura
     del proveedor o, en una devolución por fuera, la persona con el comprobante de la transferencia.
     La confirmación sigue siendo humana (`DEC-RF-002`).
  2. **Una acción administrativa nueva: *«asentar un cobro o una devolución que ya ocurrió por
     fuera»***. Cierra los motivos 18 y 19 y la devolución manual, que son el mismo gesto. **El
     catálogo pasa de trece a catorce acciones.**
- **Motivo**: es plata que sale, en el camino principal de la revocación; no cumple la condición de
  borde de `DEC-METH-015`. Y es escribir lo que ya se hace.
- **Implicaciones**: el asiento de un cobro corre `P1` sobre una fila de `payment` creada en
  `PENDING` con el id del registro, que es lo que emite el comprobante y escribe `covered_period`
  (corrección `C-R7-1`, sin decisión). Las líneas que cuantifican sobre el catálogo —`NUCLEO/08` §3,
  `V/17` §3.2 reglas 1 y 3, §3.3, §3.4, y `B/19` §6— pasan de trece a catorce.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` fila 5a, sobre `04-…` §R7.5.1; elección
  del owner del 2026-09-25, la recomendada.
```

**Y `DEC-RF-007`, campo *Estado*** — `D/01:4966`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-RF-008`**: la reparación manual se asienta con la acción administrativa 14 ·
```

### 2.9 🆕 `DEC-ADDON-007` — los addons siguen a su título (4a, 4c, 4d, 4e)

**Por qué nueva**: cambia la **condición de huérfano** de `A5` para dos scopes (4c, 4d), le da
`PAUSED` a la suscripción de complemento (4a) y fija dónde se emite una fuente (4e). La madre sería
`DEC-ADDON-004`, pero `DEC-ADDON-003` punto 4 afirma *«La condición de huérfano no se toca»*: moverla
sin entrada propia es lo que `DEC-METH-011` pide no hacer en silencio. **No contradice
`DEC-ADDON-005`**: un ancla viva sigue sosteniendo al `USER`/`GLOBAL` compatible.

```markdown
---

### DEC-ADDON-007 — Los addons siguen a su título: se pausan con la pausa, mueren cuando ninguna principal los sostiene, y se emiten sólo donde son compatibles

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa** la condición de huérfano de `A5` que `DEC-ADDON-003` punto 4 y `DEC-ADDON-004` dan
  por fija. **No toca `DEC-ADDON-005`**: un ancla viva sigue sosteniendo al addon `USER`/`GLOBAL`
  compatible.
- **Problema** (`26-fase-9-completa/03-…` AL OWNER 1, 3, 4 y 5; `07-…` `R12-OWNER-2`):
  1. un cliente pausa cuatro meses y su addon recurrente le cobra los cuatro sin darle nada, porque
     sin título el pliegue lo descarta (`F-8CC1-004`);
  2. el arreglo de `F-8CA2-003` leía *«la principal **más reciente**»*: un upgrade abandonado deja
     como más reciente a la sucesora `ABANDONED`, y el destaque de quien sigue pagando queda huérfano
     y se cancela, irreversible (`PA-5`);
  3. un addon `USER`/`GLOBAL` sólo queda huérfano si se borra la cuenta: con el plan dado de baja, o
     con un primer cobro rechazado, sigue cobrando sin dar nada;
  4. el contrato no dice en qué verticales se emite un addon `USER`/`GLOBAL` (`F-8CA1-008`).
- **Decisión**, las cuatro por la opción recomendada:
  1. **La pausa pedida por el cliente pausa también sus addons recurrentes de esa vertical, por los
     mismos meses** (4a): `LISTING` y `VERTICAL_SUBSCRIPTION` siempre; `USER`/`GLOBAL` sólo si no
     le queda título en otra vertical compatible. **La suscripción de complemento gana `PAUSED`.**
  2. **Un `LISTING` queda huérfano sólo si NINGUNA principal de ese `user + vertical` está viva y no
     hay ancla viva** (4c), no por el estado de «la más reciente».
  3. **Un `USER`/`GLOBAL` queda huérfano si en ninguna vertical compatible de su producto hay una
     principal viva Y COBRADA ni un ancla viva** (4d). Absorbe `R12-OWNER-2`: el addon comprado
     antes del primer cobro de un plan que después se rechaza queda huérfano.
  4. **Un `USER`/`GLOBAL` se emite sólo en las verticales compatibles de su producto** (4e;
     `12-contrato…` §2.7), con un guard gemelo de `G-R2-B`.
- **Motivo**: la razón de `DEC-ADDON-004` —*«el addon complementa algo que ya no está»*— aplicada a
  lo que vendemos, no sólo a una mora. Cobra exactamente lo que se presta.
- **Lo que cuesta**: N llamadas más por pausa, cada una con relectura, que pueden fallar.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 4a, 4c, 4d y 4e; elecciones del
  owner del 2026-09-25, las recomendadas.
```

### 2.10 📌R `DEC-PROMO-001` — el piso del apilado (4b)

**Por qué 📌 y no 🆕**: `DEC-PROMO-001` impl. 5 (`D/01:780`) es la única entrada que nombra el piso
del apilado, y lo da por abierto (*«que **sigue abierta**»*), cuando `04-open-decisions.md:356` ya
lo tacha. 4b lo cierra.

**Campo *Estado*** — `D/01:759`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **implicación 5 precisada el 2026-09-25** (FASE 9 completa: el piso del apilado; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:780` (*«5. Se cruza con `A-PROMO-01` … que **sigue
abierta**.»*), antes de `:781`:

```markdown
     **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 4b; `03-…` AL OWNER
     2).** La mitad *«piso del apilado»* se cierra así: **un canje —o un apilado— cuyo monto compuesto
     cae bajo el piso del proveedor (ARS 15, `PC-2`) se rechaza al canjear**, con el motivo en
     pantalla. Lo gratis ya tiene dos instrumentos —el trial y la cortesía—, y la regla que mandaba
     pausar no tenía transición y dejaba una pausa sin fin (`F-8CB1-001`, paso 7).
```

### 2.11 🆕 `DEC-AUTH-001` — el orden de autorización (7a, 8a–8d)

**Por qué nueva**: `AUTH` no tiene ninguna entrada, y el orden de autorización (`V/17`) recibió el
2026-09-25 cinco respuestas del owner más una regla de la FASE 8 completa que **no tiene entrada**
(`F-8CA1-001`, *«la vertical se lee de la ficha»*, consolidado §5). 7a además crea una restricción
nueva (inmutabilidad) y una tercera mitad de `G2`.

```markdown
---

### DEC-AUTH-001 — La vertical de un recurso es inmutable y se lee del recurso; lo ajeno existe sólo en público, lo propio no consulta el paso 6, y el caché se invalida por `user`

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Registra además** una regla que el owner aprobó el mismo día en la FASE 8 completa y no tenía
  entrada: **`F-8CA1-001`, la vertical de una operación sobre una ficha se lee de la ficha, nunca del
  pedido** (`V/17` §1.2, precisión 6).
- **Problema** (`26-fase-9-completa/08-…` Owner 1; `09-…` `AO-1` a `AO-4`): cinco huecos del orden de
  autorización de `V/17`:
  1. una ficha publicada en Alojamiento se edita cambiándole la vertical a Gastronomía y queda
     publicada sin cobertura ahí; y las fotos de una presencia de Partner se cuentan contra la
     vertical que declara quien las sube;
  2. `S6` suspende Alojamiento y se invalida sólo `user + Alojamiento`: la herencia de Turista VIP y
     las claves globales siguen cacheadas en las otras verticales (`F-8CA1-002`, `F-8CA1-003`);
  3. el paso 2 nombra una cuenta *«inhabilitada»* que no tiene dato, transición ni acción
     (`F-8CA1-010`);
  4. el paso 4 no dice qué puede leer un visitante de lo ajeno (`F-8CA1-011`);
  5. el suspendido no tiene clave para leer lo suyo, justo cuando tiene que regularizar
     (`F-8CA1-013`).
- **Decisión**, las cinco por la opción recomendada:
  1. **La precisión 6 vale para todo recurso que guarda su vertical** —la ficha y su contenido, la
     presencia de Partner, la instancia de addon— **y la vertical de una ficha es inmutable desde el
     alta** (*«nunca una ficha debería poder cambiar de vertical»*, owner). Tercera mitad de `G2`:
     *«una operación escribe la vertical de un recurso que ya existe»*.
  2. **La invalidación del caché del conjunto efectivo es por `user`, no por `user + vertical`**
     (`V/02` §3.2, regla 3): una fuente puede otorgar en otra vertical que la suya.
  3. **«Inhabilitado por abuso» sale del paso 2**; el abuso se trata ficha por ficha con
     `MODERATED` (`PB10`).
  4. **En el paso 4, lo ajeno existe sólo en estado público**: ficha `PUBLISHED`; presencia de
     Partner con la clave vigente y sin moderar (`DEC-ENT-006`).
  5. **Las lecturas de lo propio —Mi Cuenta, su billing, sus fichas— no consultan el paso 6.**
- **Lo que se resigna**: (2) una relectura por vertical del user en cada invalidación; (3) un
  abusador puede crear fichas nuevas y cada una se modera a mano —el abuso es teórico a esta escala
  (`DEC-TRIAL-004`, 22 usuarios)—; (5) la excepción es sólo para esas tres lecturas, no para una
  lectura comercial que alguien llame *«propia»*.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 7a y 8a a 8d, sobre `08-…` Owner
  1 y `09-…` `AO-1` a `AO-4`; elecciones del owner del 2026-09-25, las recomendadas.
```

### 2.12 🆕 `DEC-ENT-006` — la presencia de Partner (7b, 7c, y `R13`)

**Por qué nueva**: 7b crea una **clave de entitlement** nueva y 7c un **dato** (el bit) escrito por
una acción administrativa. Y la regla que precisan —`R13`, *«la página de Partner no tiene máquina:
se ve mientras exista el entitlement»*— **no tiene entrada** (consolidado §5, fila `R13`).

```markdown
---

### DEC-ENT-006 — La presencia pública de Partner es un entitlement sin máquina: la página y el carrusel son claves, y el admin la baja con un bit de moderación

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Registra además** la regla del owner del mismo día que no tenía entrada, **`R13`**: *«La página
  propia de Partner Gold no tiene máquina de estados. La lectura pública pregunta si el partner tiene
  HOY el entitlement de presencia pública»*; si no, responde que no existe, 404 (`V/18` §1.6).
- **Problema** (`26-fase-9-completa/08-…` Owner 2 y 3): el carrusel de la home no tiene regla —cero
  apariciones de *«carrusel»* en el diseño— y un Silver que deja de pagar no tiene quién lo retire; y
  sin máquina, el admin no puede bajar una página por su contenido sin **cancelarle el cobro**.
- **Decisión**, las dos por la opción recomendada:
  1. **Clave propia *«presencia en el carrusel»***, que otorgan Gold y Silver, con el mismo caché y el
     mismo reconciliador que la página (7b).
  2. **Un bit de moderación de la presencia**, escrito sólo por la misma acción administrativa que
     `PB10` —moderar o levantar la moderación—; **la presencia se ve si tiene la clave Y no está
     moderada** (7c). Sigue sin haber máquina: es una condición más en la lectura. **El catálogo de
     acciones no crece por esto.**
- **Motivo**: es la forma que `V/18` §1.2 ya eligió para la página —*«una capacidad que se tiene o no
  se tiene»*—, y separa moderación de cobranza, que el código de hoy separa a propósito.
- **Implicaciones**: la población del reconciliador diario de cobertura pasa a ser, en Partner, *«todo
  `user + Partner` con una clave de presencia»* (`DEC-ARCH-009`, su 📌).
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 7b y 7c, sobre `08-…` Owner 2 y 3;
  elecciones del owner del 2026-09-25, las recomendadas.
```

### 2.13 📌R `DEC-ARCH-009` — la población del reconciliador

**Campo *Estado*** — `D/01:5254`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: la población excluye `MODERATED` e incluye a Partner; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:5278` (el *Origen*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa; `08-…` §3.3 contradicción 2 y
  `06-…` *«la población del reconciliador»*; `F-8CA2-004`, `R13`, `DEC-ENT-006`).** La población de
  la *Decisión* quedó más angosta que su aplicación, en dos sentidos: (1) **excluye también las
  fichas `MODERATED`**, además de `DRAFT` y `PURGED` —una ficha moderada no se republica por
  cobertura—; (2) **incluye a todo `user + Partner` con una clave de presencia** (página o carrusel,
  `DEC-ENT-006`), que no tiene fichas: sobre ése no corre ninguna transición; resuelve en vivo si el
  conjunto efectivo otorga la clave, lo compara con el caché y, si difieren, **invalida** (`V/03` §9,
  `V/18` §1.6). La entrada no se edita en su contenido.
```

### 2.14 🆕 `DEC-ARCH-011` — la vertical que no admite altas (6a, 6b, y `R11`)

**Por qué nueva**: 6a pone una **guarda nueva** en `S1` que lee un campo de la frontera, y 6b una
**fila nueva** en la lista de invalidación de `V/02` §3.2. La regla que ejecutan —`R11`, *«una
vertical discontinuada no cubre a nadie desde su fin de servicio»*— **no tiene entrada**
(consolidado §5). `ARCH` porque es una lectura cruzada: billing lee `admiteAltas` del contrato.

```markdown
---

### DEC-ARCH-011 — Una vertical que deja de admitir altas deja de admitir suscripciones, y su fin de servicio invalida el caché de la vertical entera

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Registra además** la regla del owner del mismo día que no tenía entrada, **`R11`**: *una vertical
  discontinuada no cubre a nadie desde su fin de servicio* (`12-contrato…` §2.6, `B/10` §4.3).
- **Problema** (`26-fase-9-completa/06-…` AL OWNER `S1` y γ):
  1. `S1` no mira si la vertical admite altas: una alta nueva —o una sucesión— en una vertical que se
     está discontinuando nace con un preapproval que **sigue cobrando después del fin de servicio**,
     contra *«Se deja de cobrar antes de dejar de prestar. Nunca al revés.»* (`B/10` §4). El arreglo
     de `R11` cerró los trials (`T1`) y no las suscripciones;
  2. el día del fin de servicio la fuente deja de emitirse, pero **nadie invalida el caché** de quien
     cubría un grant, una cortesía o un trial: el reconciliador no encuentra diferencia de fichas —el
     barrido ya las bajó— y la entrada sigue otorgando capacidades de una vertical cerrada.
- **Decisión**, las dos por la opción recomendada:
  1. **`S1` exige `situaciónDeVertical(vertical).admiteAltas`**, para el alta nueva **y** para la
     sucesión; la pricing no ofrece planes de esa vertical, y el mensaje es *«esta vertical ya no
     admite altas»* (6a).
  2. **Fila nueva en `V/02` §3.2: llega `fin_de_servicio` → se invalidan todas las entradas de esa
     vertical**; lo ejecuta el barrido del día (`B/10` §4.3), que ya recorre sus fichas (6b).
- **Motivo**: usa un campo que la frontera ya transporta —no hay campo nuevo— y el ejecutor que ya
  existe ese día. Invalidar es borrar, así que lo peor que pasa es recalcular de más.
- **Lo que se resigna**: quien está en `CANCEL_SCHEDULED` en esa vertical no puede cambiar de plan
  durante la cola de la discontinuación.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 6a y 6b, sobre `06-…`; elecciones
  del owner del 2026-09-25, las recomendadas.
```

### 2.15 📌R `DEC-TRIAL-010` — `T6`, `T8`, el botón, y el corte (6c; `07` `C-R12-1`)

**Por qué 📌 y no 🆕**: `T8` y el botón aplican el principio de la propia decisión —*«un alta que no
ocurrió no consume el trial»*— a la otra puerta de la máquina. `C-R12-1` pedía agregar *«Y el
corte»*; con 2g se agrega **para decir que no es de acá, y que se revirtió**.

**Campo *Estado*** — `D/01:5284`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: `T6` y `T8`, el botón que manda a publicar, y el corte no es de esta decisión; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:5302` (el *Origen*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 6c y 2g de
  `26-fase-9-completa/10`; `07-…` `R12-OWNER-1` y `C-R12-1`).**
  1. **`T6` exige un título que convierte**, el mismo término de `T2`. *Juan* se suscribía, publicaba a
     los diez minutos cubierto por una suscripción con `cobrada: no`, y `T6` le escribía la fila de
     trial consumida; si el primer cobro se rechazaba, perdía un trial que nunca usó. Es la otra
     puerta de lo que esta decisión cerró. **Fila nueva `T8`**: `PRE_TRIAL` → `TRIAL_CONVERTED` al
     aparecer un título que convierte, con la condición *«ya ejerció el evento de activación»*;
     escribe la fila consumida, igual que `T7`. Si el cobro se rechaza, la persona queda en
     `PRE_TRIAL` y su próximo `PB1` arranca el trial.
  2. **Y del owner, además: el botón de suscribirse es inteligente.** Si el usuario todavía no
     publicó en esa vertical, **lo manda a publicar** —lo que arranca el trial— en vez de al checkout.
     `T8` queda como red para quien llega al checkout por otro camino (`V/19`, `B/19`).
  3. **El corte no es parte de esta decisión.** El consolidado de la FASE 8 completa le atribuyó
     *«el corte siembra trials consumidos»* (`25-fase-8-completa/00-hallazgos.md` §5, fila `R12`), y
     esa regla nunca estuvo en esta entrada. **Quedó revertida el mismo día**: el corte no siembra
     trials (`DEC-MIG-005`).

  La entrada no se edita en su contenido.
```

### 2.16 📌R `DEC-CONC-002` — la re-vinculación, *«todavía no se sabe»* y la nota de `C-R5-6` (2b, 3d)

**Campo *Estado*** — `D/01:1420`. Reemplazar `…ver su 📌) · **Decide**: owner` por:

```markdown
…ver su 📌), **y otra vez el mismo día** (FASE 9 completa: la precondición de la re-vinculación y la cota de *«todavía no se sabe»*; ver su segundo 📌) · **Decide**: owner
```

**Cuerpo** — insertar después de `D/01:1462` (*«…sigue siendo divergencia, y la mira una
persona.»*, fin del 📌 del punto 4) y antes de `:1463` (*«- **Motivo**:»*), con la sangría del punto
4:

```markdown
     *(Nota del 2026-09-25, FASE 9 completa `04-…` `C-R5-6`: «once» era la cifra el día de la
     decisión; hoy son **trece** de las catorce filas «no», con `S31` y `S16` —`B/09` §3, salvedad 4—.
     El texto de arriba no se edita.)*
     **📌 Precisado otra vez el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 2b y 3d de
     `26-fase-9-completa/10`).**
     - **La re-vinculación automática tiene precondición** (2b; `02-…` `AO-2`, `F-8CB3-008`): se
       reescribe el `external_reference` de un preapproval desconocido **sólo si ese
       `external_reference` ya nombra una fila nuestra que no tiene otro vínculo vivo con el
       proveedor**. Todo otro desconocido **abre marca** y lo mira una persona. Cada preapproval del
       sistema nuevo nace con nuestro `external_reference` (`PA-2`), así que una huérfana legítima
       siempre nombra su fila; lo que no la nombra —del sistema viejo, una sonda, un id que sólo
       existía en el proveedor— no tiene candidato seguro, y *«el candidato más plausible»* imputaba
       el cobro al ciclo nuevo de la misma persona: pagaba dos veces y se registraba una. **La
       implicación 2 cambia en el mismo sentido**: el `SubscriptionNotResolvedError` dispara la
       re-vinculación sólo si se cumple la precondición; si no, la marca.
     - **«Todavía no se sabe» tiene cota: a los 3 días, marca** (3d; `01-…` §2.5 pendiente 4,
       `F-8CB3-004`). Si la lectura del `B/09` §4 sigue en *«todavía no se sabe»* —el contador del
       proveedor va delante de su listado— tres días después de la primera vez, se abre marca con un
       motivo nuevo, que entra al listado accionable. Es la forma del 📌 de arriba —reintentar y, a
       los 3 días, marcar— para un caso trabado que no es divergencia. Mientras tanto `S6` sigue sin
       actuar.
```

⚠️ **El número del motivo nuevo no lo fija esta propuesta**: `01` lo llama *«el 21»*, y `03` propone
otro motivo nuevo, `PAUSA_NO_APLICADA` (`F-8CB2-003`, corrección sin decisión), que también sería el
21. Si se aplican los dos, el catálogo de `B/02` §2.5 pasa de **20 a 22**, y las nueve citas de
*«veinte motivos»* (`09` §5) se recuentan. Es del carril billing; queda anotado para el orquestador.

### 2.17 📌R `DEC-DATA-002` — los hechos del reloj, de cuatro a seis (5b, y el hecho 5 de `R9`)

**Por qué 📌**: `DEC-DATA-002` punto 2 (`D/01:3123-3126`) es donde el log fija *«cuatro hechos de
reinicio y lista cerrada»*. **Ya estaba atrasada antes de esta ronda**: el hecho 5 (*«el dueño pierde
la cobertura»*) lo agregó la FASE 8 completa (`R9`, owner 2026-09-25) y `N/01` §1.2 ya dice *«~~cuatro~~
cinco»* (`nucleo/01-glosario.md:48`, `:50`). 5b agrega el sexto.

**Campo *Estado*** — `D/01:3104`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **el punto 2, precisado el 2026-09-25** (FASE 8 y FASE 9 completas: la lista cerrada tiene **seis** hechos; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:3126` (*«…es **que el reloj fuera monótono**.»*), antes de
`:3127`:

```markdown
     **📌 Precisado el 2026-09-25, con OK del owner.** La lista cerrada **tiene seis hechos**
     (`NUCLEO/01` §1.2). El **quinto**, *«el dueño pierde la cobertura en la vertical de la ficha»*, lo
     agregó la FASE 8 completa (racimo `R9`) y no se había registrado acá. El **sexto**, *«se levanta
     la moderación»* (`PB11`), lo agrega la FASE 9 completa (decisión 5b; `05-…` `OW-1`), con la razón
     del hecho 4: mientras la ficha estaba moderada el dueño **no podía** actuar, y contar ese tiempo
     lo castigaba por una decisión nuestra —sin reinicio, levantar una moderación larga llevaba a
     `PB5` y a `PB9` en días—. La escritura única del corte (fila `C`) sigue sin ser un hecho, y
     `G-R6-B` admite el escritor nuevo.
```

**No se tocan**, y se justifica por aparición (`DEC-METH-012`): `DEC-SUB-012` (`D/01:3294`, *«cuatro
hechos de reinicio»*) usa la cifra para argumentar que el tope *«se reinicia solo»*; con seis el
argumento es más fuerte, y era exacta en su fecha. `DEC-SUB-012` (`D/01:3300`, `:3322-3323`, *«doce
acciones administrativas»*) también era exacta en su fecha, y su argumento no depende de la cifra.

### 2.18 📌R `DEC-DATA-005` — el registro de eventos y el contenido (8e)

**Campo *Estado*** — `D/01:5224`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: el registro de eventos no guarda el contenido de una ficha; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:5248` (el *Origen*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 8e; `09-…` `AO-5`,
  `F-8CA3-004`).** La promesa *«el día 180 borra el contenido de esa ficha»* tenía una copia que la
  retención no alcanza: el registro de eventos, append-only (`NUCLEO/08` §1.3), guardaba el valor
  anterior y el nuevo de cada edición. **En los campos de contenido de una ficha —los que borra el día
  180— el evento guarda sólo el NOMBRE del campo**, no sus valores; los demás campos (estado, plan,
  monto, fechas) siguen con los dos. Y se corrige `NUCLEO/01` §1.2, hecho 1: crear, editar y exportar
  se registran como eventos aunque no sean transiciones. Lo que se pierde: poder mostrar *«qué decía
  antes»* una ficha, que ningún capítulo pide.
```

### 2.19 📌R `DEC-SUB-013` — la cuota la cierra la salida (8f)

**Campo *Estado*** — `D/01:3392`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 9 completa: la cuota de quien se va; ver su 📌) ·
```

**Cuerpo** — insertar después de `D/01:3457` (fin del *Origen*, *«…que era la recomendada.»*), antes
del `---`:

```markdown
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 8f; `09-…` `AO-6`,
  `F-8CB2-005`).** La cuota la abre un reloj **y la cierra la salida**: **tercera cláusula de `MP3`**
  —si la suscripción sale de `GRACE_PERIOD` o de `PENDING_AUTHORIZATION` por cualquier transición que
  no sea `S5`, `S6`, `S2`/`S29` ni `S3`, la cuota abierta pasa a `DECLARED_UNPAID` **sin efecto sobre
  la suscripción**—, en las **diez** salidas del dominio: seis desde el grace (`S13`, `S17`, `S20`,
  `S21`, `S24`, `S26`) y cuatro desde `PENDING_AUTHORIZATION` (`S13`, `S20`, `S21`, `S28`). Sin esto
  la cuota de quien se iba quedaba `AWAITING` para siempre, y registrarla con `MP1` avanzaba un ciclo
  la fecha de una suscripción `CANCELLED`. La máquina sigue con tres estados; `MP4` desde ahí exige la
  fila viva por la condición 1 de `B/05` §3.
```

### 2.20 ✏️ `DEC-DATA-004` y `DEC-TEST-001` — *«cinco consumidores»* son seis (`05` `K-7`)

`K-7` cita sólo `D/01:4311`. **Hay dos apariciones más**: el título de la misma entrada
(`D/01:4291`, *«la lista de los cinco»*) y la cuarta enmienda de `DEC-TEST-001` (`D/01:3923`,
*«sus **cuatro escritores** y sus **cinco consumidores**»*; y `:3905`, `:3913`, *«cuatro
escritores»*). Búsqueda:

```text
rg -n -i 'cinco consumidores|los cinco|cuatro escritores|cuatro hechos' 01-decision-log.md
```

**`DEC-DATA-004`, campo *Estado*** — `D/01:4293`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **la cifra de `H1`, precisada el 2026-09-25**: los consumidores de `inactiva_desde` son **seis**, no cinco (FASE 8 completa `F-8CD1-009`; `V/02` §2.5). Se ratificó la forma de la lista, no su cifra ·
```

**`DEC-TEST-001`, campo *Estado*** — `D/01:3822`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **las cifras de su tercera y cuarta enmienda, precisadas el 2026-09-25**: `inactiva_desde` la escriben hoy **seis hechos más la fila `C`** del corte, y la leen **seis** consumidores (`NUCLEO/01` §1.2, `V/02` §2.5). El guard vigila la lista, no la cifra ·
```

Ninguna de las dos necesita 📌 en el cuerpo: es una cifra, y el puntero la da entera.

### 2.21 ✏️ `DEC-SUB-019` — la cita de `RN-3` (`01` `C2`)

Verificado: `D/01:5064-5065` dice *«y `next_payment_date` avanzando igual sobre un cobro rechazado —
`RN-3`, 2026-09-24»*. La fila `RN-3` (`D/06:193`) está `UNKNOWN` y su 📌 mide que *«reactivar no
reintenta lo adeudado»*; `next_payment_date` no aparece en esa celda. Lo que **sí** está registrado
es que la fecha avanza **estando pausada** (`PS-2`, `D/06:208`; `PS-6`, `D/06:212`;
`mp-probes/RESULTS-2026-09-23.md` §8: *«el `next_payment_date` de `04adf298ae` avanzó de 23/09 a 24/09
estando pausada y sin cobrar»*). **No encontré un registro del caso *autorizada con el ciclo
rechazado*** en la matriz ni en los resultados de sondas.

**Campo *Estado*** — `D/01:5052-5054`. Reemplazar:

```text
…y el espejo la lee como `S6` · **Decide**:
```

por:

```markdown
…y el espejo la lee como `S6`; **y su cita de `RN-3`, precisada el 2026-09-25** (FASE 9 completa, `01-…` `C2`; ver su 📌) · **Decide**:
```

**Cuerpo** — insertar después de `D/01:5099` (fin del *Origen*), antes del `---`:

```markdown
- **📌 Precisado el 2026-09-25 (FASE 9 completa, `01-…` `C2`; registro, sin decisión).** La cita
  *«`next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24»* **no está
  registrada en `RN-3`** ni en ninguna fila de la matriz. Lo registrado es que la fecha avanza
  **estando pausada** (`PS-2`, `PS-6`) y que no se puede correr por pedido (`EX-34`). Hasta que se
  registre con fecha y sujeto, **se lee *«observado, no registrado»***. La decisión no depende de esa
  cita: si la fecha esperara, cancelar el preapproval al vencer el grace sigue evitando el cobro
  tardío; lo que cambia es el tamaño del daño que cuenta el ejemplo.
```

Las otras dos citas (`B/03` §3.2 `S11`, `B/02` §2.3) son del carril billing.

### 2.22 ✏️ `DEC-ARCH-008` — el veredicto rige todo cambio de plan (`01` `C9`)

Verificado: `D/01:2713-2714` conserva *«que es justamente el único caso donde la regla hace falta»*;
el contrato lo tacha en `12-contrato-de-cobertura.md:935` y dice *«El veredicto rige TODO cambio de
plan»* en `:936`.

**Campo *Estado*** — `D/01:2693`. Reemplazar `**Estado**: ACCEPTED ·` por:

```markdown
**Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa, `F-8CD1-003`): el veredicto rige **todo** cambio de plan, no sólo el del plan retirado; *«el único caso donde la regla hace falta»* (motivo de descartar (2)) quedó corto, ver `12-contrato…` §4.1 ·
```

### 2.23 ✏️ Punteros que faltan en *Estado* (convención del log)

El resumen dice que una entrada precisada *«lleva el puntero en su campo Estado»* (`D/01:5372`).
Tres entradas tienen 📌 en el cuerpo y *Estado* sin puntero:

| entrada | *Estado* | el 📌 |
|---|---|---|
| `DEC-DATA-001` | `D/01:869` | `:895` |
| `DEC-SUB-006` | `D/01:1027` | `:1093` |
| `DEC-SUB-017` | `D/01:4595` | `:4618` |

Texto a agregar tras `ACCEPTED` en cada una, en ese orden:

```markdown
 — **el punto 4, cerrado el 2026-09-25 por `DEC-DATA-005`** (ver su 📌)
 — **precisada el 2026-09-25** (FASE 8 completa, `F-8CB1-002`: la excepción de `D8`; ver su 📌)
 — **precisada el 2026-09-25** (FASE 8 completa: el pago retenido por `S19`; ver su 📌)
```

---

## 3. La matriz

**Ninguna fila se agrega, se quita ni cambia de estado.** Los conteos siguen en 98 (55 · 14 · 23 · 6).
Después de aplicar, verificarlo con `python3 contar-filas-de-la-matriz.py` desde `D`.

### 3.1 ✏️ `GR-3` y `RC-7` sin tachar (`01` `C1`)

**`GR-3`**, `D/06:201`, celda *Conclusión*. Tres reemplazos:

1. `**Medida entera, y son cuatro intentos dentro de una ventana de 24 h.**` →

   ```markdown
   **Medida entera, y son cuatro intentos dentro de una ventana de ~~24 h~~ un ciclo** (24 h en los sujetos de `1 days`; ver el 📌 del 2026-09-24 al final de esta celda).
   ```

2. Donde dice:

   ```text
   y el ciclo tiene **`expire_date` = `date_created` + 24 h exactas**
   ```

   →

   ```markdown
   y el ciclo tiene **`expire_date` = `date_created` + 24 h exactas** (sobre `1 days`: es un ciclo)
   ```

3. Donde dice:

   ```text
   existe para separarlas con un sujeto de `2 days` y **está bloqueada**: dos intentos de alta murieron por antifraude del proveedor (`cc_rejected_high_risk`), que cancela el preapproval en ~83 s.
   ```

   →

   ```markdown
   existe para separarlas con un sujeto de `2 days` ~~y **está bloqueada**: dos intentos de alta murieron por antifraude del proveedor (`cc_rejected_high_risk`), que cancela el preapproval en ~83 s~~ **y se destrabó el 2026-09-24, al tercer intento** (los dos primeros murieron por antifraude, `cc_rejected_high_risk`, en ~83 s): ver el 📌 del final.
   ```

**`RC-7`**, `D/06:280`, celda *Conclusión*. Dos reemplazos:

1. Donde dice:

   ```text
   viene con `expire_date` = `date_created` **+ 24 h exactas**
   ```

   →

   ```markdown
   viene con `expire_date` = `date_created` **+ ~~24 h exactas~~ un ciclo** (24 h exactas en los sujetos de `1 days`)
   ```

2. Donde dice:

   ```text
   🚧 **Sigue sin saberse si las 24 h son fijas o son el ciclo** — ver el bloqueo de la sonda 49 en `GR-3`
   ```

   →

   ```markdown
   ~~🚧 **Sigue sin saberse si las 24 h son fijas o son el ciclo** — ver el bloqueo de la sonda 49 en `GR-3`~~
   ```

   (queda el 📌 del 2026-09-24 que sigue, que ya lo contesta).

**Por qué**: quien lee sólo el comienzo de la celda sigue leyendo *«24 h»*, que es la forma que leyó
`F-8CB3-012`.

### 3.2 ✏️ `RN-3` no registra lo que se le atribuye (`01` `C2`)

`D/06:193`, al final de la celda *Conclusión*, después de *«…si el proveedor vuelve a pausar o cobra
bien»*, agregar:

```markdown
📌 **2026-09-25, registro (FASE 9 completa, `26-fase-9-completa/01-…` `C2`)**: esta fila **no** registra que `next_payment_date` avance sobre un cobro **rechazado**, aunque `DEC-SUB-019`, `B/03` §3.2 (`S11`) y `B/02` §2.3 se lo atribuyen. Lo registrado es que avanza **estando pausada** (`PS-2`, `PS-6`; `04adf298ae`, [mediciones del 23/09](./mp-probes/RESULTS-2026-09-23.md) §8) y que no se corre por pedido (`EX-34`). Sobre una `authorized` con el ciclo rechazado no hay lectura fechada: hasta que la haya, esas citas se leen *«observado, no registrado»*
```

La fila sigue `UNKNOWN`. Si alguien tiene la lectura (fecha, sujeto, antes/después), se registra
acá con esos datos en vez de esta nota.

### 3.3 📌R `GR-1`, `PA-6` y `RC-1` (3a, 3c, 2f) — y por qué 2f no lleva fila nueva

**`GR-1`**, `D/06:199`, al final de la *Conclusión*, después de *«…y eso no se probó»*:

```markdown
📌 **2026-09-25 (FASE 9 completa, decisión 3a del owner)**: **condiciona a `DEC-SUB-021`** —su salida *«cambiá la tarjeta; los reintentos del proveedor cobran con ella»*—. Se mide con el próximo rechazo mensual real: si un pago con la tarjeta cambiada entra dentro de la ventana del ciclo fallido y lo cierra. Hasta entonces la superficie del grace no lo promete
```

**`PA-6`**, `D/06:176`, al final de la *Conclusión*, después de *«…exige una tarjeta real sin
saldo»* (depende del OK de `DEC-SUB-022`):

```markdown
📌 **2026-09-25 (FASE 9 completa, `DEC-SUB-022`)**: hay un segundo camino que toca esta fila, y tampoco la necesita para decidir: la sucesora de quien venía pagando entra en **grace** si falla su primer cobro, y el barrido diario relee su preapproval; si el proveedor lo canceló o lo pausó, corre `S6`. **La respuesta de esta fila decide cuánto dura ese grace, acotado a un día**; sigue sin bloquear
```

**2f / `AO-6` — ¿fila nueva? No.** `AO-6` ofrecía dos opciones: (1) un control en el paso 2 del
corte, o (2) *«una fila nueva en la matriz que mida la completitud antes del corte»*. **El owner
eligió la 1** (`10:25`). Una fila nueva quedaría `UNKNOWN` hasta medirla, sumaría una `UNKNOWN` al
recuento y **no la necesita ninguna decisión**: el control verifica en el momento lo que la fila
mediría una vez, y su resultado *«caduca con el tamaño de la cuenta»* (`02` `AO-6`). Lo que sí
conviene es dejar constancia en la fila que usa el recorrido como referencia sin haberlo contrastado.

**`RC-1`**, `D/06:274`, al final de la *Conclusión*, después de *«…contra ids propios»*:

```markdown
📌 **2026-09-25 (FASE 9 completa, `02-…` `AO-6`, decisión 2f del owner)**: el **recorrido sin filtro** que esta fila usa como referencia (*«recorriendo las 76 sin filtro»*) **nunca se contrastó con nada**, y el corte se apoya en él (`16-fase-7…` §4.2, paso 1b). No se mide: **el gate del paso 2 lo verifica en el momento** —el conteo tiene que igualar el `total` del paginado y todo id conocido tiene que aparecer—, y si no, el corte no avanza (`DEC-MIG-003`, 📌 del 2026-09-25)
```

### 3.4 ✏️ *«Qué espera cada decisión»* y el frontmatter

`D/06`, tabla *«Qué espera cada decisión»* (`:516-532`). Agregar al final, después de la fila de
`A-PROMO-01` (`:532`), y reemplazar esa fila:

```markdown
| ~~`A-PROMO-01` piso del descuento apilado~~ | `PC-2` ✅ → **decidida el 2026-09-25**: el canje o el apilado bajo el piso se rechaza al canjear (`DEC-PROMO-001`, 📌) |
| `DEC-SUB-021` la salida *«cambiá la tarjeta»* | **`GR-1`**: la decisión está **condicionada** a esta fila desde el 2026-09-25 |
| `DEC-SUB-022` el grace de la sucesora que venía pagando | `PA-6`: **no bloquea**; su respuesta decide cuánto dura ese grace, acotado a un día |
```

Y el frontmatter no tiene `updated:` (`09` §8): agregar `updated: 2026-09-25` después de
`created: 2026-09-15` (`D/06:5`).

### 3.5 `C11` — no toca la matriz

`01` `C11` señala `B/06-proveedor.md:408` (*«`RN-3` … **EN CURSO** … se lee tras su cobro del
2026-09-24»*) y `:421` (*«Tres de las ~~cuatro~~ cinco»* con seis filas). La matriz ya tiene el 📌
del 24/09 en `RN-3`; lo atrasado es `B/06`, **carril billing**. Con §3.2 aplicado, el texto que `C11`
propone para `B/06` sigue siendo correcto.

---

## 4. El Resumen del log, recontado con script

Script (en el scratchpad de la sesión, `recontar-resumen.py`): lee los encabezados `### DEC-`, el
campo *Estado* y los 📌 de cada entrada de `D/01` hoy, y proyecta con las listas de esta propuesta.

```text
HOY  decisiones 117 unicos 117 meth 15 func 102
HOY  SUPERSEDED 5 ['DEC-SUB-001', 'DEC-MIG-001', 'DEC-SUB-003', 'DEC-SUB-005', 'DEC-MP-003']
HOY  precisadas por otra 2 | con 📌 9 [DATA-001, SUB-006, CONC-002, MAIL-001, GRANT-003, GRANT-004, MIG-003, SUB-017, SUB-020] | total 11
PROP decisiones 124 meth 15 func 109
PROP SUPERSEDED 6
PROP precisadas (sin SUPERSEDED) 24 nuevas en esta tanda 13
PROP condicionadas a FASE 1C 2
```

**Un hallazgo del recuento, fuera de los informes**: la fila *«Precisadas sin `SUPERSEDED`»* dice
**2** (`D/01:5372`), y hoy son **11**. Cuenta sólo las precisadas **por otra decisión**
(`DEC-SUB-019`, `DEC-METH-006`) y deja afuera las nueve que tienen 📌 con OK del owner, ocho de ellas
del 2026-09-25 (el propio consolidado las lista: `25-…/00-hallazgos.md:353-356`). `09` §5 recontó
los conteos del handoff y no ésta, que no figura en él.

**Las filas que cambian** (`D/01:5369-5382`):

| fila | hoy | propuesta |
|---|---|---|
| Decisiones tomadas | **117** — con `DEC-TRIAL-010` … | **124** — con las **siete de la FASE 9 completa** (2026-09-25): **`DEC-SUB-022`** (la sucesora de quien venía pagando entra en grace), **`DEC-MIG-005`** (el corte trata a la cartera vieja como clientes nuevos), **`DEC-RF-008`** (máquina del reembolso y acción 14), **`DEC-ADDON-007`** (los addons siguen a su título), **`DEC-AUTH-001`** (el orden de autorización), **`DEC-ENT-006`** (la presencia de Partner) y **`DEC-ARCH-011`** (la vertical que no admite altas); y las del 2026-09-25 de la FASE 8 completa: *(sigue el texto de hoy desde «**`DEC-TRIAL-010`**»)* |
| De metodología | 15 | 15 *(por prefijo; once —`DEC-METH-005` a `-015`— están bajo el encabezado funcional porque se escribieron en orden cronológico; `09` `C-15`)* |
| Funcionales | 102 | **109** |
| Precisadas sin `SUPERSEDED` | **2** | **24** — **por otra decisión**: `DEC-SUB-019` (`DEC-MP-008`), `DEC-METH-006` (`DEC-METH-008`, `-013`), `DEC-MP-008` (`DEC-SUB-022`), `DEC-RF-007` (`DEC-RF-008`); **con 📌 del owner**: `DEC-DATA-001`, `DEC-SUB-006`, `DEC-CONC-002`, `DEC-MAIL-001`, `DEC-GRANT-003`, `DEC-GRANT-004`, `DEC-MIG-003`, `DEC-SUB-017`, `DEC-SUB-020`, `DEC-SUB-021`, `DEC-ARCH-008`, `DEC-ARCH-009`, `DEC-TRIAL-010`, `DEC-DATA-002`, `DEC-DATA-004`, `DEC-TEST-001`, `DEC-DATA-005`, `DEC-MIG-004`, `DEC-SUB-013`, `DEC-PROMO-001`. La entrada vieja no se edita en su contenido. ⚠️ **Leer `DEC-METH-006` sola da el criterio de corte equivocado** *(se conserva)* |
| `SUPERSEDED` | **5** | **6** — agrega **`DEC-MIG-002` EN PARTE** por `DEC-MIG-003` (sobrevive *«se siguen tomando altas»*, se cae *«se transcriben a mano»*; puntero registrado el 2026-09-25) |
| Decisiones condicionadas a FASE 1C | **1** | **2** — `DEC-SUB-010` (sin cambio) y **`DEC-SUB-021`**, a `GR-1`: si un pago con la tarjeta cambiada durante el grace cierra el ciclo fallido |
| Apartamientos declarados del PDR | **8** | **8**, o **9** si el owner acepta el de `DEC-MIG-005` (§25, *«Conservar: … pagos»*) |
| *(fila nueva)* Decisiones de la FASE 9 completa | — | **7 nuevas y 13 precisiones**, del 2026-09-25, sobre las 32 respuestas del owner a los 33 puntos (`26-fase-9-completa/10`) |

Las demás filas no cambian. *«Decisiones de arquitectura del owner: 4, las cuatro del 2026-09-18»*
está acotada a esa fecha (hoy hay diez `ARCH`); no la toco, pero su encabezado se lee como total.

---

## 5. Fuera del log y la matriz

### 5.1 ✏️ `N/00` — carril **núcleo**, no log (`09` `C-13`)

`nucleo/00-indice.md:42-45` dice *«son **111** al 2026-09-24»* y lista como `SUPERSEDED` a
`DEC-SUB-001`, `DEC-SUB-005`, `DEC-MIG-001` en parte y `DEC-MP-003` en parte: **falta `DEC-SUB-003`**
(superada entera por `DEC-SUB-021`), y es el lugar donde un implementador busca qué decisiones valen.
Texto propuesto, para quien tenga el carril núcleo:

```markdown
2. **una decisión registrada** en `01-decision-log.md` — son **117** al 2026-09-25 (**124** si se
   aceptan las siete nuevas de `26-fase-9-completa/14`), recontadas con `rg -c "^### DEC-"` menos la
   plantilla del formato. Las `SUPERSEDED` no cuentan como fuente: `DEC-SUB-001`, `DEC-SUB-003` y
   `DEC-SUB-005` enteras, `DEC-MIG-001` y `DEC-MIG-002` sólo en lo que `DEC-MIG-003` reemplazó, y
   `DEC-MP-003` sólo en lo que `DEC-MP-008` reemplazó;
```

(`DEC-MIG-002` entra si se aplica §2.6.)

### 5.2 Para el orquestador, porque no es de ningún carril de capítulos

- **`16-fase-7-del-paraguas.md` está en el rango `D/14-*`…`D/26-*` que el contexto común prohíbe
  editar**, y es donde viven el orden del corte y su rama de aborto. 2c, 2e y 2f, y `02` `CT-1`,
  `CT-2`, `CT-3` y `DB-1`…`DB-7`, caen ahí. Hace falta decidir quién lo edita.
- **Reglas del owner del 2026-09-25 que no tienen entrada en el log**, fuera de las que esta
  propuesta ya registra (`R9` hecho 5 en `DEC-DATA-002`; `R11` en `DEC-ARCH-011`; `R13` en
  `DEC-ENT-006`; `F-8CA1-001` en `DEC-AUTH-001`; *«el corte siembra trials»*, revertida en
  `DEC-MIG-005`): `R14` (lock por `user + vertical`), `F-8CA2-004` (`MODERATED` y `PURGED` por el
  dueño), `R6` (*«las promos no sobreviven a un cambio de plan»*) y `R7` (motivos 17 a 20). Por
  *«si no está acá, no se decidió»* (`D/01:12-16`) les falta registro; no lo propongo acá porque
  ninguna de las decisiones de `10` las toca.
- **El número de motivo nuevo** (§2.16): 3d y `PAUSA_NO_APLICADA` compiten por el 21.

### 5.3 Lo que no pude verificar

- **El registro de *«`next_payment_date` avanza sobre un cobro rechazado»***: busqué en la matriz y
  en `mp-probes/RESULTS-*.md`; sólo está el caso pausado. Si existe fuera de esos archivos, §2.21 y
  §3.2 se reemplazan por el registro con fecha y sujeto.
- **Si el §25 del PDR alcanza a los pagos de un sistema que se retira**: es lectura, y la dejo al
  owner (§2.3).
- **Las citas de líneas de capítulos** (`B/`, `V/`, contrato) las tomé de los informes y verifiqué
  por muestreo (`12-contrato…:935-936`, `B/09:157`, `nucleo/01-glosario.md:48-58`,
  `nucleo/07-outbox-y-notificaciones.md:48`, `nucleo/08-auditoria-y-observabilidad.md:142-163`,
  `V/02:393-441`, `V/21` §2.5); **todas las de `D/01` y `D/06` las verifiqué una por una**.
