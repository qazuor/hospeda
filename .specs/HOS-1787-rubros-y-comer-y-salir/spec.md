---
title: Rubros de ficha (BusinessLine) y renombrado de Gastronomía a «Comer y salir» (venue)
linear: HOS-1787
statusSource: linear
created: 2026-10-25
status: draft
---

# HOS-1787 · Rubros de ficha y «Comer y salir»

> **Estado**: especificándose. Vuelta 1 de revisión adversarial consolidada (48 hallazgos) y respondida por el
> owner (DEC-FAC-026…039). Vuelta 2 consolidada (69 → 58 hallazgos), con los arreglos aplicados
> (DEC-FAC-040…059, objetables) y **respondida por el owner** (Q-11…Q-20 → DEC-FAC-060…069; OD-17…OD-26
> cerradas). Vuelta 3, acotada a los deltas, con **0 CRÍTICA** (3 ALTA, 5 MEDIA, 7 BAJA), toda aplicada sin necesitar
> al owner (DEC-FAC-070…076, objetables). **Revisiones cerradas.** Próximo: crear en Linear los hijos 1-9 de HOS-1787
> (los crea el orquestador al cerrar la revisión) y descomponer en tareas. El estado macro vive en Linear (HOS-1787);
> este archivo es el índice técnico.

## Qué es

1. **Rubros de ficha** (`BusinessLine`, «rubro» en la UI): un mecanismo **genérico** por el que una
   ficha de cualquier vertical declara uno o más rubros, y cada rubro habilita un conjunto de
   **secciones de contenido** (`ListingSection`). Un resolvedor único decide, por ficha y sección, si
   está `absent` (AUSENTE), `locked` (BLOQUEADA, con upsell) o `available` (DISPONIBLE), combinando los rubros de la ficha
   con el conjunto efectivo de entitlements del dueño (HOS-1353 V3).
2. **«Comer y salir»**: la vertical Gastronomía pasa a llamarse así en público (`/comer-y-salir/`)
   y `venue` en código y base, con renombrado total; arranca con los rubros `food` (URL `gastronomia`) y `nightlife` (URL `noche`).

Por qué y con qué alternativas: [`docs/00-PDR.md`](docs/00-PDR.md) y
[`docs/01-decision-log.md`](docs/01-decision-log.md) (DEC-FAC-001…076).

## Índice

| archivo | qué tiene |
|---|---|
| `docs/00-PDR.md` | requisitos del owner |
| `docs/01-decision-log.md` | decisiones con porqué y descartes |
| `docs/02-worklog.md` · `docs/03-handoff.md` | bitácora y próximo paso |
| `docs/04-open-decisions.md` | lo que falta decidir |
| `docs/05-discovery-a-renombrado.md` | huella real de `gastronom` en `staging` |
| `docs/05-discovery-b-superficies.md` | editor, superficies, `packages/verticals`, guards |
| `docs/06-guards.md` | lista cerrada de guards |
| `docs/10-revision-vuelta-1/` · `docs/11-resolucion-vuelta-1/` | vuelta 1: `00-consolidado.md`, `00-arreglos-aplicados.md`, `10-decisiones-del-owner.md` |
| `docs/12-revision-vuelta-2/` · `docs/13-resolucion-vuelta-2/` | vuelta 2: revisiones A/B/C, `00-consolidado.md`, `00-arreglos-aplicados.md`, `10-decisiones-del-owner.md` (Q-11…Q-20, respondidas) |
| `docs/14-revision-vuelta-3/` · `docs/15-resolucion-vuelta-3/` | vuelta 3 (deltas): `R-deltas.md`, `00-arreglos-aplicados.md` |
| `sub-specs/1-renombrado.md` … `7-admin.md`, `9-copy-del-embudo.md` | una por hijo de Linear (el 8, migración del editor de alojamiento, todavía no tiene sub-spec). Los hijos de Linear se crean al cerrar la revisión |

## Fases (hijos de HOS-1787)

| # | sub-spec | depende de | bloquea |
|---|---|---|---|
| 1 | [Renombrado `gastronomy` → `venue`](sub-specs/1-renombrado.md) | **HOS-1798** (bloque de billing del CLAUDE.md, bloquea el arranque) | todas |
| 2 | [Catálogos + columna `business_lines` + tipos `PUB`/`BOLICHE`](sub-specs/2-catalogos.md) | 1 | 3, 4 |
| 3 | [Resolvedor + paso de autorización](sub-specs/3-resolvedor.md) | 2 | 4, 5, 6, 7 |
| 4 | [Sección `nightInfo`](sub-specs/4-tipos-y-noche.md) | 2, **3** (su criterio es el 409 del paso 4b, F-V2-041) | 5, 6 |
| 5 | [Editor del dueño](sub-specs/5-editor.md) | 3, 4, **9** (DEC-FAC-076) | — |
| 6 | [Web pública](sub-specs/6-web-publica.md) | 3, 4, **9** (DEC-FAC-076), **HOS-1797** (paginación compartida) | — |
| 7 | [Admin](sub-specs/7-admin.md) | 2, 3 | — |
| 9 | [Copy neutro del embudo](sub-specs/9-copy-del-embudo.md) | 1, 2 | **5 y 6** (no se mergean antes, DEC-FAC-076) |

Relacionadas, aparte: **HOS-1798** (reescribir el bloque de billing del CLAUDE.md; bloquea el arranque; relación tomada del revisor, no consultada en Linear); «una ficha = un local físico = una dirección»; **hijo 8** (migración del editor de alojamiento al catálogo, pendiente de crear en Linear); HOS-1797 (paginación compartida); HOS-1796 (diferencial de noche, post-MVP).

## Contexto de arquitectura

Construye sobre lo que HOS-1352 dejó en `staging` (merge del 2026-10-20, #3726): catálogo de claves
(`packages/schemas/src/catalog/`), conjunto efectivo
(`packages/verticals/src/effective-set/resolve-effective-set.ts`), cadena de autorización de fichas
(`packages/verticals/src/authorization/resolve-listing-access.ts`) y el patrón de espejo código ↔ base
con GUARD:G18. Puntos de coordinación: HOS-1362 (V8), acción 15; y **el corte V6 de HOS-1352**.

**Staging no es prod** (F-V1-001): prod corre la migración `0124` y no tiene ese mundo (`vertical`,
`catalog_key`, `plan*`, `subscription`, `trial`, `domain_event`, `email_outbox`); staging va por la
`0178`. El mundo nuevo llega a prod con el corte V6, cuyo paso 6 aplasta la historia en
`0000_baseline.sql` y borra los módulos de data-migration. El renombrado cae **antes** del corte y es
bloqueante del corte (DEC-FAC-028); como prod salta de la `0124` al mundo nuevo en el paso 3 del corte, prod
**ejecuta** la migración de renombrado sobre su base vieja, y ese camino se ensaya sobre un clon de prod
(F-V2-003, sub-spec 1). El corte nunca puede caer entre dos PRs del renombrado.

## Reglas que gobiernan todo

1. **Ningún código pregunta por un rubro concreto**: pregunta por secciones, y sólo a través del
   resolvedor.
2. **El rubro no toca plata**: billing no lo lee.
3. **Una clave significa una sola cosa** (HOS-1353 cap. 15 §2.3): ninguna clave vale distinto según
   el rubro.
4. **Lo público nunca depende del visitante**: el resolvedor público usa el conjunto efectivo del
   dueño, y un cambio de plan o de rubro purga la cache.
5. **Cambiar de rubro oculta, no borra**, y lo oculto no sale por ningún lector: la lista cerrada de
   lectores de contenido vive en el sub-spec 3.

## Próximo paso

Descomposición en tareas de cada hijo. Ver `docs/03-handoff.md`.
