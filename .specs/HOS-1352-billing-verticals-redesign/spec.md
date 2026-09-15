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
| 7 | [`docs/06-mp-validation-matrix.md`](./docs/06-mp-validation-matrix.md) | Qué sabemos de Mercado Pago, medido: 41 de 61 filas |
| 8 | [`docs/07-facts-inventory.md`](./docs/07-facts-inventory.md) | Cuántos clientes reales hay, medido |

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
| FASE 1A — análisis de dominio | ✅ **cerrada — 25 de 25 preguntas respondidas** |
| FASE 1B — discovery del sistema actual | ⛔ bloqueada hasta cerrar el diseño |
| FASE 1C — experimentación con Mercado Pago | 🟡 **en curso — 41 de 61 filas · reloj corriendo** |
| FASE 2 — Master Spec | ⛔ bloqueada por 2 de las 4 que decide el experimento (`BD-MP-01` pausa, `BD-MP-02` cortesía) |
| FASE 3 — épicas | ⬜ |
| FASE 4 — spec por épica | ⬜ |
| FASE 5 — gap analysis contra legacy | ⬜ |
| FASE 6 — decisión rewrite / reuse | ⬜ |
| FASE 7 — estrategia de implementación | ⬜ |
| FASE 8 — revisión adversarial | ⬜ |
| FASE 9 — revisión final de diseño | ⬜ |
| FASE 10 — implementación | ⬜ |

**Decisiones tomadas: 29** — 3 de metodología y **26 funcionales**. Las 25 preguntas de
FASE 1A están cerradas; queda **una** abierta que abrió FASE 1C (`BD-MP-04`).

## Próximo paso

**A partir del 2026-09-16 ~11:30, correr la
[sonda 06](./docs/mp-probes/probe-06-leer-el-reloj.sh).** El reloj arrancó el 15 a las 12:26:
siete suscripciones de **ciclo diario** vivas en el sandbox, una por bloque de filas. El ciclo
diario ya está verificado por relectura; lo que falta es ver al proveedor ejecutar un ciclo.

Detalle operativo: el manifiesto está en `/tmp/mp-probe-05/manifiesto.json`, con copia
versionada en `docs/mp-probes/manifiesto-reloj-2026-09-15.json`. Si se perdiera, **se pierde
el experimento**: por `RC-1` no hay forma de volver a encontrar esas suscripciones por nuestra
referencia.

De las cuatro bloqueantes de FASE 2, `BD-MP-03` quedó decidida (`DEC-MP-001`) y `BD-MP-04`
volvió al owner.

De las 25 preguntas de FASE 1A no queda ninguna abierta, pero **FASE 1C abrió una nueva**:
`BD-MP-04` (cómo se implementa un addon recurrente) tiene sus filas medidas y aun así **le
sobrevivió una elección de diseño** que la medición no toma. Está planteada con su cuadro
comparativo y una recomendación en
[`04-open-decisions.md`](./docs/04-open-decisions.md).

Lo demás que falta de parte del owner es **habilitación, no decisión**: credenciales, una
aplicación de Mercado Pago de pruebas aparte, y reembolsos en sandbox.

## Épicas

Se crean en FASE 3, como sub-issues de HOS-1352, cada una con su propia carpeta `.specs/`.

_(ninguna todavía)_
