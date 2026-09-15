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
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay, medido.

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa. FASE 1A entregada y respondida en sus 8 decisiones bloqueantes.**

El programa se reseteó hoy: el único documento heredado es el PDR (`DEC-METH-001`). Todo lo
demás se escribió de cero contra ese texto.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | 🟡 **8 bloqueantes cerradas; quedan 16 preguntas no bloqueantes** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada por `DEC-METH-001`: no se lee código hasta cerrar el diseño |
| FASE 1C — experimentación con Mercado Pago | 🟢 **desbloqueada, y es lo que más urge** |
| FASE 2 — Master Spec | ⛔ bloqueada por las 4 bloqueantes que decide el experimento |
| FASE 3 a 10 | ⬜ no empezadas |

### Próximo paso exacto

**Arrancar FASE 1C** — la experimentación contra Mercado Pago — y en paralelo seguir cerrando
con el owner las 16 preguntas no bloqueantes que quedan.

1C es lo que más urge porque **cuatro decisiones bloqueantes de FASE 2 sólo las puede cerrar
el experimento**, y porque `DEC-SUB-001` ya está tomada pero **no se puede implementar** hasta
saber si se puede correr la primera fecha de cobro sobre una suscripción autorizada
(`EX-7`/`EX-8`). Si no se puede, su plan B declarado es que el cambio de ciclo espere a la
renovación.

Reglas de 1C, del §58 al §61: nada se completa desde documentación ni memoria — **sólo con un
experimento ejecutado**, con request, response y webhook registrados. Las sondas van
versionadas en `docs/mp-probes/`, marcadas como no productivas.

Para cada respuesta nueva del owner: se registra **una decisión** en
[`01-decision-log.md`](./01-decision-log.md) con el formato del §3.4, y se marca el ítem
cerrado en [`04-open-decisions.md`](./04-open-decisions.md) **en el mismo commit**.

### Decisiones tomadas

**Diez**: dos de metodología (`DEC-METH-001` reset total, `DEC-METH-002` conteos autorizados)
y **ocho funcionales**, que son las 8 bloqueantes de FASE 2 que le correspondían al owner.

`DEC-SUB-001` está tomada pero **condicionada**: si `EX-8` resulta `NOT_SUPPORTED`, entra su
plan B sin volver a preguntar.

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
- Los conteos de producción están autorizados (`DEC-METH-002`), pero **sólo contar filas**.
  Y una salida **vacía** de la consola de SQL significa que la consulta falló y el error se
  tragó, **no** que haya cero filas: un `UNION` largo se anula entero si una sola columna no
  existe. Partir las consultas.
