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

> **Esto todavía no es una spec.** Es el índice de un programa cuyo diseño está en curso. La
> Master Spec se escribe en **FASE 2**, y FASE 2 está bloqueada.

## Orden de lectura obligatorio

Cualquier agente o persona que entre a este programa lee, en este orden, **antes de hacer
nada** (§66):

| # | Documento | Qué es |
|---|---|---|
| 1 | [`docs/00-PDR.md`](./docs/00-PDR.md) | El PDR rector del owner. **Inmutable.** |
| 2 | [`docs/01-decision-log.md`](./docs/01-decision-log.md) | Qué se decidió y por qué |
| 3 | [`docs/02-worklog.md`](./docs/02-worklog.md) | Qué se hizo, cronológicamente |
| 4 | [`docs/03-handoff.md`](./docs/03-handoff.md) | Dónde estamos y cuál es el próximo paso exacto |
| 5 | [`docs/04-open-decisions.md`](./docs/04-open-decisions.md) | Qué falta decidir |
| 6 | [`docs/05-phase-1a-domain-analysis.md`](./docs/05-phase-1a-domain-analysis.md) | El análisis de dominio (FASE 1A) |
| 7 | [`docs/06-mp-validation-matrix.md`](./docs/06-mp-validation-matrix.md) | Qué sabemos de Mercado Pago (hoy: nada) |

**No confíes en memoria implícita, ni en engram, ni en ningún otro `CLAUDE.md`, ni en
documentación del repo, ni en un sistema de tracking.** El PDR es explícito al respecto (§3.5):
reutilizar conocimiento viejo como si siguiera vigente es una de las causas de que estemos acá.

## Reglas del programa

- **`00-PDR.md` no se edita nunca.** Toda desviación se registra como decisión en `01`.
- **Sólo hay tres fuentes válidas de fundamento**: el PDR, una medición propia fechada, o una
  respuesta explícita del owner. No el código, no la documentación del repo, no un sistema de
  tracking, no la memoria de un agente.
- **Si un documento cita un `§`, el texto se verifica contra el PDR antes de escribirlo.**
- **Ningún documento de este programa referencia trabajo anterior.** Una referencia así es un
  defecto, no una fuente.
- Una decisión `ACCEPTED` no se edita: se crea otra que la marque `SUPERSEDED`.
- Ninguna decisión sobre Mercado Pago se toma mientras su fila de la matriz diga `UNKNOWN`.
- **No se lee código para fundamentar una decisión funcional**, hasta que el diseño esté
  cerrado (`DEC-METH-001`).
- Todo documento declara `status: CURRENT | LEGACY | OBSOLETE | SUPERSEDED` en su frontmatter.
- El macro-estado del programa vive en **Linear (HOS-1352)**, no en estos archivos.

## Estado

| Fase | Estado |
|---|---|
| FASE 0 — bootstrap de documentación | ✅ completa |
| FASE 1A — análisis de dominio | 🟡 **entregada, esperando 25 respuestas del owner** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada |
| FASE 1C — experimentación con Mercado Pago | ⛔ bloqueada |
| FASE 2 — Master Spec | ⛔ bloqueada por 12 decisiones bloqueantes |
| FASE 3 — épicas | ⬜ |
| FASE 4 — spec por épica | ⬜ |
| FASE 5 — gap analysis contra legacy | ⬜ |
| FASE 6 — decisión rewrite / reuse | ⬜ |
| FASE 7 — estrategia de implementación | ⬜ |
| FASE 8 — revisión adversarial | ⬜ |
| FASE 9 — revisión final de diseño | ⬜ |
| FASE 10 — implementación | ⬜ |

**Decisiones funcionales tomadas: 0.** La única decisión registrada es de metodología.

## Próximo paso

**Que el owner responda las 25 preguntas** del §16 de
[`docs/05-phase-1a-domain-analysis.md`](./docs/05-phase-1a-domain-analysis.md).

Las 8 primeras frenan FASE 2. Nada — ni 1B, ni 1C, ni 2 — avanza antes de esas respuestas.

## Épicas

Se crean en FASE 3, como sub-issues de HOS-1352, cada una con su propia carpeta `.specs/`.

_(ninguna todavía)_
