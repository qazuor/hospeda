---
title: Handoff vivo
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Handoff — estado del programa

> **Si sos un agente o una persona que acaba de entrar a este programa: leé esto entero antes
> de hacer nada, y después leé los documentos en el orden de abajo.**
>
> **No confíes en memoria implícita, ni en engram, ni en ningún `CLAUDE.md`, ni en
> documentación del repo, ni en un sistema de tracking.** El PDR es explícito (§3.5):
> reutilizar conocimiento viejo como si siguiera vigente es una de las causas de que estemos
> acá. Este programa ya tuvo que resetearse una vez por exactamente eso (`DEC-METH-001`).

## Orden de lectura obligatorio (§66)

1. [`00-PDR.md`](./00-PDR.md) — el documento rector del owner. **Inmutable.**
2. [`01-decision-log.md`](./01-decision-log.md) — qué se decidió y por qué.
3. [`02-worklog.md`](./02-worklog.md) — qué se hizo, cronológicamente.
4. **Este archivo** — dónde estamos parados.
5. [`04-open-decisions.md`](./04-open-decisions.md) — qué falta decidir.
6. [`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md) — el análisis de dominio.
7. [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) — qué sabemos de Mercado Pago
   (55 filas: 16 `VERIFIED`, 8 parciales, 2 `NOT_SUPPORTED`, 29 `UNKNOWN`).
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay, medido.

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa. FASE 1A entregada y COMPLETAMENTE respondida: las 25 preguntas cerradas.
FASE 1C en curso: 26 de 55 filas medidas, y las sondas 05 y 06 escritas y listas para correr.**

El programa se reseteó hoy: el único documento heredado es el PDR (`DEC-METH-001`). Todo lo
demás se escribió de cero contra ese texto.

Dos de las cuatro bloqueantes de FASE 2 tienen todas sus filas cerradas, y **terminaron
distinto**: `BD-MP-03` quedó decidida (**`DEC-MP-001`**, se muta el monto del preapproval),
y `BD-MP-04` **no la cerró la medición** — le sobrevivió una elección de diseño y volvió al
owner.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | ✅ **cerrada — 25 de 25 preguntas respondidas, 29 decisiones** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada por `DEC-METH-001`: no se lee código hasta cerrar el diseño |
| FASE 1C — experimentación con Mercado Pago | 🟡 **en curso — 26 de 55 filas medidas** |
| FASE 2 — Master Spec | ⛔ bloqueada por `BD-MP-01` (pausa) y `BD-MP-02` (cortesía) |
| FASE 3 a 10 | ⬜ no empezadas |

### Próximo paso exacto

**Seguir FASE 1C.** Las 25 preguntas de FASE 1A están respondidas, pero **FASE 1C abrió una**:
`BD-MP-04` (cómo se implementa un addon recurrente) tiene sus filas medidas y aun así **le
sobrevivió una elección de diseño**, planteada con su cuadro y una recomendación en
[`04-open-decisions.md`](./04-open-decisions.md).

**Antes de medir nada más, leer el §0 de
[`mp-probes/RESULTS-2026-09-15.md`](./mp-probes/RESULTS-2026-09-15.md)**: Mercado Pago acepta
cambios que no aplica y responde `2xx`. Cinco casos medidos. **Toda mutación exige relectura y
comparación campo por campo**; ninguna fila de la matriz se marca por el código de estado.

Lo que falta se divide en **lo que sólo necesita arrancar** y **lo que necesita al owner**.

### Lo que sólo necesita arrancar: el reloj

Diecisiete filas (`RN-1..3`, `GR-1..3`, `PS-2`/`4`/`5`/`6`, `PA-4`, `EX-1`, `UP-1`/`2`,
`DW-1`/`2`, `CT-1`/`3`) no están en `UNKNOWN` por falta de permisos: **están esperando que
pase tiempo**. La pausa de la sonda 02 duró 1,3 s.

Pero **la espera es de un día, no de un mes**, y eso sale de una medición ya hecha: al
rechazar `frequency_type: "years"` el proveedor contestó *"valid ones are `[days, months]`"*
(`FR-4`). Un ciclo **diario** pone un ciclo real a 24 h.

Las dos sondas ya están escritas y verificadas en seco:

| Sonda | Qué hace |
|---|---|
| [`probe-05-arrancar-el-reloj.sh`](./mp-probes/probe-05-arrancar-el-reloj.sh) | Crea **siete** suscripciones de ciclo diario, una por bloque de filas, deja hechas las mutaciones del día 0 y escribe un manifiesto |
| [`probe-06-leer-el-reloj.sh`](./mp-probes/probe-06-leer-el-reloj.sh) | Vuelve a las 24 h, 48 h y 72 h, y reporta el **delta** entre dos fotos fechadas |

**Que el ciclo diario se autorice y se ejecute NO está medido.** Es lo primero que comprueba
la sonda 05, por relectura — si el proveedor acepta `days` y guarda otra cosa, se ve en el
acto y no 24 h después. Es el mismo patrón del §0.

**Correr la 05 es lo más urgente del programa**: es lo único cuyo costo es tiempo de
calendario, y hasta que no arranque, todo lo demás corre detrás.

### Lo que necesita al owner

| Qué | Para qué |
|---|---|
| Las **credenciales** del sandbox en el entorno de la sesión | Sin esto no corre ninguna sonda. **No están en el repo** y no deben entrar |
| Una **aplicación de Mercado Pago aparte** para pruebas | El webhook es **por aplicación** y su URL **no se puede cambiar por API** (`403`). La app de sandbox actual apunta al staging de Hospeda, así que medir webhooks hoy es medir nuestra propia capa legacy — justo lo que el §58 prohíbe. Desbloquea `WH-2`, `WH-3`, `WH-5` y la firma |
| Qué credenciales habilitan **reembolsos** en sandbox | `RF-1`/`RF-2` dieron `401 "Unauthorized use of live credentials"`. Eso no dice que el proveedor no reembolse: dice que estas credenciales no lo pueden pedir |
| Acceso a la **casilla del comprador de prueba** | `EX-3`: qué le comunica el proveedor al cliente por su cuenta |

Reglas de 1C, del §58 al §61: nada se completa desde documentación ni memoria — **sólo con un
experimento ejecutado**, con request, response y webhook registrados. Las sondas van
versionadas en `docs/mp-probes/`, marcadas como no productivas.

Para cada respuesta nueva del owner: se registra **una decisión** en
[`01-decision-log.md`](./01-decision-log.md) con el formato del §3.4, y se marca el ítem
cerrado en [`04-open-decisions.md`](./04-open-decisions.md) **en el mismo commit**.

### Decisiones tomadas

**Veintinueve**: tres de metodología y **veintiséis funcionales**. Veinticinco cubren las 25
preguntas de FASE 1A, incluidas las 8 bloqueantes que le correspondían al owner.

Tres son **apartamientos declarados del PDR** (`DEC-ENT-001` del §10.3, `DEC-GRANT-002` del
§34, y `DEC-LEGAL-001` explicitando que "cuando entre ARCA" no es un disparador). Dos se
tomaron **contra la recomendación**, con su riesgo escrito: `DEC-ENT-004` y `DEC-GRANT-001`,
cancelar sin reembolso.

`DEC-SUB-001` ya **no está en pie**: FASE 1C la dejó sin mecanismo (`EX-4` es `NOT_SUPPORTED`
y falla en silencio) y la reemplazó **`DEC-SUB-005`** — misma política, ejecutada cancelando y
recreando con la primera fecha corrida, en ese orden. `EX-8` salió `VERIFIED`, así que el plan
B que la condicionaba ("esperar a la renovación") no hizo falta.

Si alguien encuentra una afirmación funcional en cualquier documento de este programa que no
esté respaldada por el PDR, por una medición fechada o por una respuesta del owner, es un
defecto: hay que marcarlo, no usarlo.

### Reglas duras que rigen ahora

- **`00-PDR.md` no se edita nunca** (§3.1). Toda desviación se registra como decisión en `01`.
- **Una decisión `ACCEPTED` no se edita**: se crea otra que la marque `SUPERSEDED`.
- **No se toca código productivo** hasta FASE 10 (§4), y por `DEC-METH-001` **ni siquiera se
  lee código** para fundamentar una decisión funcional, hasta que el diseño esté cerrado.
- **No se implementa ninguna capability cuya fila de la matriz diga `UNKNOWN`** (§61), ni se
  toma ninguna decisión que dependa de ella.
- **No se clasifica nada como `KEEP` / `ADAPT` / `REWRITE`** antes de definir el criterio al
  empezar FASE 5. Es un **gate** (`DEC-METH-003`), no un pendiente, y toda clasificación lleva
  su argumento escrito.
- **Ningún documento de este programa referencia trabajo anterior.** Si encontrás una
  referencia así, es un defecto.
- Los hallazgos de 1A **no se reescriben**. Si aparece algo nuevo, se agrega con un ID nuevo.

### Lo que NO hay que rehacer

- El PDR ya está guardado, verbatim, con su integridad verificada contra el historial de git.
- El análisis 1A ya está entregado. Si algo le falta, se **agrega**; no se reescribe.
- El issue paraguas ya existe: **HOS-1352**. No crear otro.

### Dónde está el trabajo

- **Worktree**: `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`
- **Branch**: `spec/HOS-1352-billing-verticals-redesign`
- **Linear**: HOS-1352
- Sólo documentos. Cero código, cero migraciones, cero cambios en la DB.

### Trampas concretas de este entorno

- El clone principal del repo puede estar en `detached HEAD` o en la branch de otra sesión.
  **Trabajá siempre en el worktree de arriba.**
- Los conteos de producción están autorizados (`DEC-METH-002`), pero **sólo contar filas**.
  Y una salida **vacía** de la consola de SQL significa que la consulta falló y el error se
  tragó, **no** que haya cero filas: un `UNION` largo se anula entero si una sola columna no
  existe. Partir las consultas.
