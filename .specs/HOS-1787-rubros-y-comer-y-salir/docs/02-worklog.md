---
title: Worklog — HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
---

# 02 · Worklog

Bitácora cronológica. Una entrada por paso; lo que se decidió va al decision log, no acá.

## 2026-10-24/25 · Conversación de producto
- Se compararon vertical nueva vs. una vertical con variantes, planes por familia, addons ocultos
  y addon de rubro extra. Resultado: DEC-FAC-001 a DEC-FAC-017.
- Verificado contra `origin/staging`: la épica HOS-1352 entró el 2026-10-20 (#3726); V1–V5 Done y en
  `packages/verticals`; V6/V7/V8/V9 en Backlog en Linear aunque con commits parciales en `staging`
  (el estado de Linear no refleja el código).

## 2026-10-25 · Arranque de la especificación
- Creado HOS-1787 (paraguas, `kind-needs-spec`).
- Worktree de docs pelado `hospeda-spec-hos-1787-docs`, branch `spec/HOS-1787-docs` desde
  `origin/staging`.
- Escritos `00-PDR.md` y `01-decision-log.md`.
- Lanzado el relevamiento (2 subagentes): huella del renombrado; editor, superficies y enganches en
  `packages/verticals`.
- 2026-10-25 · Escritos discovery A/B, 04 ampliado (OD-01…07), 06-guards, spec.md y 7 sub-specs. Lanzada la vuelta 1 de revisión (3 revisores opus).
- 2026-10-25 · Vuelta 1 consolidada: 68 hallazgos de origen (A 22, B 22, C 24) → 48 (4 CRÍTICA, 17 ALTA, 21 MEDIA, 6 BAJA) en `10-revision-vuelta-1/00-consolidado.md`; verificados contra el código los reclamos dudosos. 41 arreglos sin decisión aplicados (`11-resolucion-vuelta-1/00-arreglos-aplicados.md`), DEC-FAC-018…025 agregadas, OD-08…14 abiertas, 10 preguntas al owner (`11-resolucion-vuelta-1/10-decisiones-del-owner.md`, Q-01 = antes o después del corte V6) y 5 bugs previos propuestos como issues aparte.
- 2026-10-25 · Respuestas del owner a la vuelta 1 (Q-01…Q-10, cierre de OD-14, y después OD-15/OD-16). Registradas como DEC-FAC-026…039; OD-01…16 cerradas con puntero; `10-decisiones-del-owner.md` con la respuesta bajo cada pregunta y los ids de Linear de los bugs previos (HOS-1792, 1793, 1794, 1795; el #2 pasó a HOS-1797). Sub-specs 1 a 7 reescritos con el vocabulario final (`BusinessLine`, `ListingSection`, `SectionTrait`, `absent/locked/available`, `SECTION_ABSENT`, `business_lines`), sin variante «después del corte» ni «PENDIENTE (Q-xx)». `06-guards.md`: G-FAC-R1 con las cinco excepciones por nombre, G-FAC-01 reducido al CHECK, G-FAC-08 (lista de alojamiento congelada) y G-FAC-09 (un solo validador). Los discovery A/B y la revisión de la vuelta 1 conservan el vocabulario viejo a propósito (son registros de la vuelta). Spec todavía sin trackear ni commitear.
- 2026-10-25 · Vuelta 2 de revisión (A datos y migración 22, B producto y edge cases 26, C arquitectura 21) consolidada: 69 → 58 hallazgos (2 CRÍTICA, 15 ALTA, 25 MEDIA, 16 BAJA; 48 (a), 10 (b)) en `12-revision-vuelta-2/00-consolidado.md`. Verificados contra el código (worktree `hospeda-hos-1795-claude-md`, `origin/staging` @ a44b8f05b4) todos los CRÍTICA y ALTA; tres puntos donde los revisores se equivocaron (B-014, C-003, la edición de la 0109 en A-017) y cinco no verificados. 47 arreglos aplicados (`13-resolucion-vuelta-2/00-arreglos-aplicados.md`) en los sub-specs 1-7, `06-guards.md` (G-FAC-R1 rediseñado, G-FAC-03(a) por tipo, G-FAC-10 nuevo), discovery A §5 y `spec.md` (fases con HOS-1798, el 4 depende de 2 y 3). DEC-FAC-040…059 (objetables). OD-17…26 abiertas como Q-11…Q-20 (`13-resolucion-vuelta-2/10-decisiones-del-owner.md`). Spec todavía sin trackear ni commitear.
- 2026-10-25 · Respuestas del owner a la vuelta 2 (Q-11…Q-20) registradas como DEC-FAC-060…069; OD-17…26 cerradas; `13-resolucion-vuelta-2/10-decisiones-del-owner.md` en `respondida` con la respuesta bajo cada pregunta. Dos contra la recomendada: Q-13 = 3 (el enlace de carta pasa a ser pago dentro de `menu`; se retira el rasgo `file`, `menu` vuelve a poder estar `locked` entera) y Q-16 = 2 (dimensiones de reseña declaradas en el catálogo con `boundSection` y `dimensionAveraging`, default `legacyImputed` para no mover experiencia, test golden). Nuevo `sub-specs/9-copy-del-embudo.md` (Q-20; el 8 queda para alojamiento). Aplicado en sub-specs 1-7, guards (G-FAC-R1, G-FAC-02 regla 12, G-FAC-05), discovery A y `spec.md`. Spec todavía sin trackear ni commitear.
