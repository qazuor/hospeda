---
title: Handoff vivo
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-09-15
status: CURRENT
---

# Handoff — estado del programa

> **Si sos un agente que acaba de entrar a este programa: leé esto entero antes de hacer
> nada, y después leé los documentos en el orden de abajo. No confíes en memoria implícita,
> ni en engram, ni en lo que diga otro CLAUDE.md sobre billing.** El PDR es explícito:
> conocimiento viejo reutilizado como si siguiera vigente es una de las causas de que
> estemos acá.

## Orden de lectura obligatorio

1. [`00-PDR.md`](./00-PDR.md) — el documento rector del owner. **Inmutable.**
2. [`01-decision-log.md`](./01-decision-log.md) — qué se decidió y por qué.
3. [`02-worklog.md`](./02-worklog.md) — qué se hizo, cronológicamente.
4. **Este archivo** — dónde estamos parados.
5. [`04-open-decisions.md`](./04-open-decisions.md) — qué falta decidir.
6. [`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md) — el análisis de dominio.
7. [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) — qué sabemos de MP (hoy: nada verificado).
8. [`07-facts-inventory.md`](./07-facts-inventory.md) — cuántos clientes reales hay.

---

## Última actualización: 2026-09-15

### Último punto completado

**FASE 0 completa** y **FASE 1A entregada**.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | ✅ entregada, **esperando respuestas del owner** |
| FASE 1B — discovery del sistema actual | 🔒 **bloqueada por orden del PDR §67** |
| FASE 1C — experimentación con MP | ⬜ no empezada |
| FASE 2 — Master Spec | 🔒 bloqueada por 7 decisiones estructurales |
| FASE 3-10 | ⬜ no empezadas |

### Próximo paso exacto

**El owner responde las preguntas de la sección 16 de
[`05-phase-1a-domain-analysis.md`](./05-phase-1a-domain-analysis.md)** — 21 en total, 7 de
ellas `[BLOCKING]`.

Cuando eso pase:

1. Registrar cada respuesta como `DEC-*` en [`01-decision-log.md`](./01-decision-log.md).
2. Cerrar los ítems correspondientes en [`04-open-decisions.md`](./04-open-decisions.md).
3. Anotar la sesión en [`02-worklog.md`](./02-worklog.md).
4. Recién entonces arrancar **FASE 1B**.

**No arranques FASE 1B antes de eso.** Es una instrucción explícita del owner (§67), no una
preferencia de estilo.

### Lo que NO hay que rehacer

- El PDR ya está guardado verbatim. No lo edites por ningún motivo.
- El análisis 1A ya está hecho. Si encontrás algo nuevo, **agregalo con un ID nuevo**; no
  reescribas los existentes, porque el owner va a responder por número.
- Los conteos de producción ya se hicieron el 2026-09-15. Volvé a medirlos sólo si pasó
  tiempo o si una decisión depende de un número que pudo moverse (el primer trial vence el
  **2026-09-26**).
- El issue paraguas ya existe: **HOS-1352**. No crees otro.

### Dónde está el trabajo

- **Worktree**: `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`
- **Branch**: `spec/HOS-1352-billing-verticals-redesign` (de `origin/staging` @ `60a39dae2`)
- **Linear**: [HOS-1352](https://linear.app/hospeda-beta/issue/HOS-1352)
- Sólo documentos. Cero código, cero migraciones.

### Prohibiciones vigentes

Hasta FASE 10, por §4 del PDR: sin código productivo, sin migraciones, sin borrar código,
sin tocar la DB productiva (lecturas sí), sin modificar la integración con MP, sin PRs de
implementación, y **sin conservar nada sólo porque ya existe**.

### Trampas concretas de este entorno

- `hops psql` con salida **vacía** significa que la query falló, no que haya cero filas.
  Un `UNION` largo se anula entero si una columna no existe. Partí las consultas.
- `--target=` va **antes** del subcomando y es obligatorio.
- El clone principal puede estar en detached HEAD o en la branch de otra sesión. Trabajá
  siempre en el worktree de arriba.
