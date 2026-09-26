---
title: "FASE 9 vuelta 1 · segunda tanda de OK aplicada — log, unidades y S36"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — segunda tanda de OK aplicada

Aplicación de los ítems **H a M** de `10-decisiones-del-owner.md` § *«Segunda tanda de OK»*, más el
recuento del Resumen del log y los tres residuos que dejó G4 (`14-aplicado-G4.md` §4). Los ítems
A–G los aplicó otra pasada. Fui el único agente editando. **Excepción a las reglas de aplicación**:
esta pasada **sí** editó `01-decision-log.md`, sólo para H, I y la fila del Resumen. Rutas: `V/` =
`.specs/HOS-1353-…/`, `B/` = `.specs/HOS-1354-…/`, `D/` = `.specs/HOS-1352-…/docs/`. Las líneas
son las del worktree al cerrar esta pasada.

## 1. Qué se aplicó

| ítem | archivo:línea | estado |
|---|---|---|
| **H** · implicación 5 de `DEC-ARCH-006` (`G4-2`), texto exacto de `14-` §3 ítem 1, a continuación de la 4 (`G2-1`) | `D/01-decision-log.md:2280-2289` (implicación), `:2223` (Estado: *«y G4-2: …; ver sus implicaciones 4 y 5»*) | hecho |
| **I** · 📌 en `DEC-MIG-002` (`G4-1`), texto exacto de `14-` §3 ítem 2 | `D/01-decision-log.md:2390-2394` (📌, debajo de la *Decisión*), `:2368` (Estado) | hecho |
| Recuento · fila *«Precisadas sin `SUPERSEDED`»* del Resumen | `D/01-decision-log.md:6004` | hecho: ~~29~~ **34**, con los cinco nuevos en la lista. Ver §1.1 |
| **J** · la revocación y el borrado del token de calendario en `PURGED` (`G1-5`) | `V/descomposicion.md:59` (V6, en `PB12`), `:62` (V9, en `PB9`), `:510` (criterio de V6), `:513` (criterio de V9), `:384` (censo del §2.10) | hecho |
| **K** · `B10` consume el empuje *«la ficha llegó a `PURGED`»* y corre `A6` (`G2-1`) | `B/descomposicion.md:136` (fila B10), `:341` (§2.6 fila 11: el *«no está asignado»* tachado), `:728` (criterio de B10: empuje en el acto, red por `fichaPurgada`, idempotente frente a los dos) | hecho |
| **L** · `V8` construye la acción administrativa 15 (`G5-2`), con permiso propio y auditoría | `V/descomposicion.md:61` (fila V8; capítulos: se suma `08` §1.2 y §3 del núcleo), `:512` (criterio de V8), `:385` (censo del §2.10) | hecho |
| **M** · `S36` dispara `S18` en la predecesora de una sucesión en curso | `B/docs/03-maquinas-de-estado.md:182` (fila `S36`), `:164` (disparadores de `S18`), `:485` (el texto que enumera dónde corre `S18` sin `S17`), `:479-482` (la cuenta de las nueve, ver §4.1), `:562` (escritura 5 de `S18`: rama 6), `:740` (tabla de ramas del pago pendiente) | hecho, con un residuo de conteo (§4.1) |
| Residuo (a) · `V/21` ~198, el botón sin la regla única | `V/docs/21-migracion.md:205-210` | hecho. **La línea 198 está dentro del recuadro tachado** (texto histórico, no se toca); el recuadro vigente (`:205`) citaba `V/19` fila 23 pero afirmaba sin condición que el botón los manda a publicar. Se le agregó la condición de la regla única y sus dos otras salidas |
| Residuo (b) · `B/09` ~592, la cortesía condicionada a *«sucesora en `ACTIVE`»* | — | **no**: el diseño no lo contesta sin decisión. Ver §4.2 |
| Residuo (c) · por dónde extiende un trial `SUPER_ADMIN` | — | **no**: el diseño no lo dice. Queda como pregunta para el owner, §4.3 |

### 1.1 El recuento de *«Precisadas sin `SUPERSEDED`»*

Script sobre `01-decision-log.md`: por cada encabezado `### DEC-<ÁREA>-<NNN>`, el campo *Estado*
**entero** (ocupa varias líneas en `DEC-MAIL-001` y `DEC-METH-006`; leerlo de una sola línea las
dejaba afuera), descartando los que dicen `SUPERSEDED`.

- **Total de decisiones: 126**, de las cuales **15** `DEC-METH-*`. No cambió.
- Estado con *precisada/precisado/recontada* y sin `SUPERSEDED`: **32**.
- Más **dos** cuyo Estado dice *cerrado/cerrada* por una precisión: `DEC-DATA-001` (el punto 4,
  cerrado por `DEC-DATA-005`; ya estaba en la lista) y `DEC-MP-006` (cláusula 1 cerrada el
  2026-09-26, con 📌). **Total: 34.**
- Cruzado contra la lista vieja de 29: los 29 siguen, y entran **`DEC-ARCH-005`**, **`DEC-RF-001`**,
  **`DEC-SUB-010`**, **`DEC-RF-008`** y **`DEC-MP-006`**. Los dos conjuntos coinciden.
- **`DEC-MIG-002` no suma** aunque recibió su 📌 hoy (ítem I): está `SUPERSEDED EN PARTE` y se
  cuenta en esa fila. `DEC-METH-013` y `DEC-ENT-006` tienen el emoji 📌 en el cuerpo pero no son
  precisiones (uno es un encabezado de historia, el otro cita el 📌 de otra entrada).

La fila dice la cifra con tachado (~~26~~ ~~29~~ **34**), el criterio y la exclusión de `DEC-MIG-002`.
**No toqué** la fila *«Decisiones de la FASE 9 completa»* (su *~~15~~ 18 precisiones* es de la
FASE 9 completa, del 25/09) ni ninguna otra.

**markdownlint** (`npx markdownlint-cli2`) sobre los 6 archivos tocados: resultado en §5.

## 2. Lo que dejó declarado una opción contra la recomendación

Ninguna: esta tanda son OK a propuestas, no elecciones entre opciones.

## 3. Propuestas para el log y la matriz

Ninguna nueva. H e I se aplicaron directamente (excepción de esta tarea).

## 4. Residuos y choques

### 4.1 La cuenta de las nueve salidas no incluye a `S36` (de M)

`S36` sale de `ACTIVE`, `GRACE_PERIOD` o `CANCEL_SCHEDULED`. Desde `ACTIVE` y `CANCEL_SCHEDULED`
—dos de los tres estados de declaración— es una **salida terminal del conjunto** que la tabla de
`B/03` §3.2 *«el dominio, recorrido por el lado de la PREDECESORA»* no numera: sería la fila 12, y
las **nueve** pasarían a **diez** (siete terminales, no seis), y *«`S18` corre en SIETE de las
nueve»* a *«OCHO de las diez»*. La cifra se repite en `B/02:150`, `B/12:612`, `B/20:116` y
`D/12-contrato-de-cobertura.md:455` (este último, además, razona si la salida deja al cliente
*«caer al piso sin que nadie declare nada»*, que para `S36` es el mismo argumento que para `S24`: lo
pidió él). **No lo recontré**: M pedía la tabla de `S18` y el texto que enumera quién la dispara, y
la cascada toca cinco archivos y un razonamiento del contrato. Quedó dicho en `B/03:479-482`. Y un
hueco previo del mismo párrafo: *«`S18` sin `S17` es lo CORRECTO en los CINCO caminos»*
(`B/03` ~608) no nombra ni a `S24` ni a `S36`.

### 4.2 `B/09` ~592: la cortesía diferida condicionada a *«sucesora en `ACTIVE`»*

El detector busca la sucesora **en `ACTIVE`** para decir que `S9` no re-emitió el saldo. Con 3c
la sucesora puede pasar a `GRACE_PERIOD`; si llegó ahí sin que `S9` corriera, el detector no la ve.
**Pero no es la misma forma que el contrato corrigió**: allá la condición se ensanchó a *«ya
autorizó, en cualquier estado posterior»* porque la emisión no depende del estado de la sucesora;
acá `S9` sale **sólo de `ACTIVE`**, así que sobre una sucesora en grace no hay transición declarada
que re-emita, y ensanchar el detector abre un caso sin acción nombrada. Decidir si se ensancha, y
qué hace la persona con esa fila, **es del owner**.

### 4.3 Pregunta para el owner: por dónde extiende un trial `SUPER_ADMIN`

`extenderTrial` (contrato §4.1) es la única escritura de billing en verticales y la definen para
**el canje** de una extensión, con el techo ya aplicado. La extensión firmada por `SUPER_ADMIN`
**pasa el techo** (`V/11` §3.4), la *«cortesía durante el trial»* extiende el trial en días
(`B/14` §4.5, línea 662) y `NUCLEO/08` §3 la lista como acción *«extender un trial»* sin decir de
qué épica es. **Ningún texto dice** si esa acción es de verticales (corre `T4` sobre su propia
máquina y no cruza el contrato) o de billing (y entonces pasa por `extenderTrial` con otra
semántica de techo), ni qué unidad la construye. No lo decidí.

## 5. Verificación

markdownlint sobre `D/01-decision-log.md`, `V/descomposicion.md`, `V/docs/21-migracion.md`,
`B/descomposicion.md`, `B/docs/03-maquinas-de-estado.md` y este registro: **0 issues en 6
archivos, exit 0**.

## Key Learnings

1. El campo *Estado* del log ocupa a veces varias líneas: un recuento que lee sólo la línea del
   `**Estado**` pierde entradas (`DEC-MAIL-001`, `DEC-METH-006`) y da 30 donde son 34.
2. Un 📌 del owner no convierte en *«precisada sin `SUPERSEDED`»* a una entrada ya superseded en
   parte (`DEC-MIG-002`): se cuenta en la fila de supersesión.
3. Un residuo que cita una línea puede estar apuntando a texto tachado (`V/21:198`); el espejo
   vigente estaba unas líneas más abajo y era el que tenía el defecto.
4. Sumar un disparador a `S18` arrastra el conteo del dominio de la predecesora: la tabla de
   salidas del conjunto de declaración es una lista cerrada con cinco espejos fuera del capítulo.
