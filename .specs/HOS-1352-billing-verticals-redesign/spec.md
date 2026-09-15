---
title: Rediseño integral de Verticales, Billing, Trials, Entitlements, Limits y Complementos
linear: HOS-1352
statusSource: linear
created: 2026-09-15
type: feature
areas:
  - billing
  - api
  - db
  - web
  - admin
---

# Rediseño integral de Verticales y Billing

> **Esto no es una spec todavía.** Es el índice de un programa cuyo diseño está en curso.
> La Master Spec se escribe en **FASE 2**, y FASE 2 está bloqueada.

## Orden de lectura obligatorio

Cualquier agente o persona que entre a este programa lee, en este orden, **antes de hacer
nada**:

| # | Documento | Qué es |
|---|---|---|
| 1 | [`docs/00-PDR.md`](./docs/00-PDR.md) | El PDR rector del owner. **Inmutable.** |
| 2 | [`docs/01-decision-log.md`](./docs/01-decision-log.md) | Qué se decidió y por qué |
| 3 | [`docs/02-worklog.md`](./docs/02-worklog.md) | Qué se hizo, cronológicamente |
| 4 | [`docs/03-handoff.md`](./docs/03-handoff.md) | Dónde estamos y cuál es el próximo paso exacto |
| 5 | [`docs/04-open-decisions.md`](./docs/04-open-decisions.md) | Qué falta decidir |
| 6 | [`docs/05-phase-1a-domain-analysis.md`](./docs/05-phase-1a-domain-analysis.md) | El análisis de dominio (FASE 1A) |
| 7 | [`docs/06-mp-validation-matrix.md`](./docs/06-mp-validation-matrix.md) | Qué sabemos de MercadoPago (hoy: nada verificado) |
| 8 | [`docs/07-facts-inventory.md`](./docs/07-facts-inventory.md) | Cuántos clientes reales hay |

**No confíes en memoria implícita, en engram, ni en lo que diga otro `CLAUDE.md` sobre
billing.** El PDR es explícito al respecto: reutilizar conocimiento viejo como si siguiera
vigente es una de las causas de que estemos acá.

## Reglas del programa

- `00-PDR.md` **no se edita nunca**. Toda desviación se registra como decisión en `01`.
- Todo documento declara `status: CURRENT | LEGACY | OBSOLETE | SUPERSEDED` en su frontmatter.
- Ningún documento justifica una decisión de diseño citando el código existente antes de
  FASE 5.
- El macro-estado del programa vive en **Linear (HOS-1352)**, no en estos archivos.
- Una decisión sobre MercadoPago no se toma mientras su fila de la matriz diga `UNKNOWN`.

## Estado

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | ✅ **cerrada** — 36 decisiones tomadas |
| FASE 1B — discovery del sistema actual | 🟢 desbloqueada |
| FASE 1C — experimentación con MP | 🟢 desbloqueada, y es la que más urge |
| FASE 2 — Master Spec | 🟡 1 bloqueante abierta (`BD-MP-04`), depende de 1C |
| FASE 3 — épicas | ⬜ |
| FASE 4 — spec por épica | ⬜ |
| FASE 5 — gap analysis contra legacy | ⬜ |
| FASE 6 — decisión rewrite/reuse | ⬜ |
| FASE 7 — estrategia de implementación | ⬜ |
| FASE 8 — revisión adversarial | ⬜ |
| FASE 9 — revisión final de diseño | ⬜ |
| FASE 10 — implementación | ⬜ |

## Próximo paso

**Arrancar FASE 1C** (experimentación contra MercadoPago), y 1B en paralelo si hay capacidad.
1C va primero porque hay seis cosas esperando su resultado, incluida la última decisión
bloqueante de FASE 2. Detalle en [`docs/03-handoff.md`](./docs/03-handoff.md).

## Épicas

Se crean en FASE 3, como sub-issues de HOS-1352, cada una con su propia carpeta `.specs/`.

_(ninguna todavía)_
