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
   (hoy: **nada**, las 53 filas en `UNKNOWN`).

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa. FASE 1A entregada y esperando respuesta del owner.**

El programa se reseteó hoy: el único documento heredado es el PDR (`DEC-METH-001`). Todo lo
demás se escribió de cero contra ese texto.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | 🟡 **entregada, esperando las 25 respuestas del owner** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada por §67 y por `DEC-METH-001` |
| FASE 1C — experimentación con Mercado Pago | ⛔ bloqueada: mismo orden, más la pregunta 24 |
| FASE 2 — Master Spec | ⛔ bloqueada por 12 decisiones bloqueantes |
| FASE 3 a 10 | ⬜ no empezadas |

### Próximo paso exacto

**Que el owner responda las 25 preguntas del §16 de
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md).**

Nada avanza antes de eso. Las 8 primeras son bloqueantes de FASE 2; las otras 17 no frenan
pero se necesitan igual para escribir la Master Spec sin inventar.

Cuando lleguen las respuestas:

1. Se registra **una decisión por respuesta** en
   [`01-decision-log.md`](./01-decision-log.md), con el formato del §3.4 y declarando de qué
   fuente sale su fundamento.
2. Se marca cada ítem cerrado en [`04-open-decisions.md`](./04-open-decisions.md), **en el
   mismo commit**.
3. Recién entonces se habilitan 1B y 1C.

### Decisiones tomadas

**Una**, y es de metodología: `DEC-METH-001` (reset total). **Cero decisiones funcionales.**

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
- **No se clasifica nada como `KEEP` / `ADAPT` / `REWRITE`**: eso es FASE 5, y su criterio ni
  siquiera está definido (pregunta 25).
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
- Si en algún momento se autorizan conteos de producción (pregunta 24): una salida **vacía**
  de la consola de SQL significa que la consulta falló y el error se tragó, **no** que haya
  cero filas. Un `UNION` largo se anula entero si una sola columna no existe. Partir las
  consultas.
