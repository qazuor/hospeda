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

## Última actualización: 2026-09-15 (segunda sesión)

### Último punto completado

**FASE 0 completa**, **FASE 1A entregada y respondida**: el owner cerró **36 decisiones**.

### Estado por fase

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | ✅ **cerrada** — 36 decisiones tomadas |
| FASE 1B — discovery del sistema actual | 🟢 **desbloqueada** |
| FASE 1C — experimentación con MP | 🟢 **desbloqueada, y es la que más urge** |
| FASE 2 — Master Spec | 🟡 1 bloqueante abierta (`BD-MP-04`), depende de 1C |
| FASE 3-10 | ⬜ no empezadas |

### Próximo paso exacto

**Arrancar FASE 1C**, y 1B en paralelo si hay capacidad.

1C va primero porque hay seis cosas esperando su resultado:

| Espera | Filas de la matriz |
|---|---|
| `BD-MP-01` mecanismo de pausa | `PA-1`…`PA-7` |
| `BD-MP-02` cortesía sobre suscripción viva | `CO-1`…`CO-3` |
| `BD-MP-03` cambio de precio sobre vigentes | `PR-1`…`PR-3` |
| `BD-MP-04` addons recurrentes (**la última bloqueante**) | `AD-1`, `AD-2` |
| Plan B de `DEC-SUB-001`: ¿se puede correr la primera fecha de cobro? | `PA-5`, `PA-6`, `F-5` |
| `DEC-LEGAL-001`: ¿se pueden emitir reembolsos? | (agregar fila) |

Reglas de 1C, del PDR §58-61: nada se completa desde documentación ni memoria — **sólo con un
experimento ejecutado**, con request, response y webhook registrados. Las sondas van
versionadas en `docs/mp-probes/`, marcadas como no productivas.

### Lo que NO hay que rehacer

- El PDR ya está guardado verbatim. No lo edites por ningún motivo.
- **Las 36 decisiones ya están tomadas.** No las re-litigues ni le vuelvas a preguntar al
  owner lo que ya respondió: está todo en [`01-decision-log.md`](./01-decision-log.md). Si una
  decisión resulta inviable por lo que aparezca en 1B o 1C, se crea una **nueva** que marque
  la anterior `SUPERSEDED` — no se edita la vieja.
- El análisis 1A es el registro de lo que se encontró. Si aparece algo nuevo, **agregalo con
  un ID nuevo**; no reescribas los existentes.
- Los conteos de producción se hicieron el 2026-09-15. Volvé a medirlos sólo si pasó tiempo o
  si una decisión depende de un número que pudo moverse (el primer trial vence el
  **2026-09-26**).
- El issue paraguas ya existe: **HOS-1352**. No crees otro.

### Cinco decisiones con riesgo declarado

No son errores: son decisiones del owner con su costo anotado. Están en la tabla "Para revisar
más adelante" de [`04-open-decisions.md`](./04-open-decisions.md). La que más conviene volver
a mirar es **`DEC-METH-004`** (sin criterio fijo para KEEP vs REWRITE) al empezar FASE 5, con
las piezas concretas a la vista.

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
