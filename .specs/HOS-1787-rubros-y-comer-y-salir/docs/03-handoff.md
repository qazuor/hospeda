---
title: Handoff — HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
---

# 03 · Handoff

**Estado**: revisiones **cerradas**. Vuelta 3 (deltas de la vuelta 2): 15 hallazgos, **0 CRÍTICA** (3 ALTA, 5 MEDIA,
7 BAJA), todos aplicados sin necesitar al owner (DEC-FAC-070…076, objetables). Las vueltas 1 y 2 ya estaban cerradas
(DEC-FAC-018…069). No queda ninguna decisión abierta en `04-open-decisions.md`.

Lo que cambió la vuelta 3, en una línea cada uno:
- G-FAC-R1 separa historia (editadas, `meta/`, tests de migraciones viejas, fuera del escaneo) de valores (chequeo
  propio de las cinco editadas) (DEC-FAC-070).
- Reseñas: forma de datos con «no votó» = clave ausente (071); promedio de una dimensión con sección `absent` no se
  publica (072); servidor en el sub-spec 3, experiencia declara `ReviewRules`, modo `legacyNullAsZero` (073).
- `nightInfo` en la lista de la acción 15 y `businessLines` como no-contenido (074); soporte no vacía `absent` (075).
- Los sub-specs 5 y 6 dependen del 9 (076). `menuUrl` sale del admin; el upsell de la carta deja de prometer el enlace.

**Próximo paso**: crear en Linear los hijos 1-9 de HOS-1787 (incluido el **hijo 8**, migración del editor de
alojamiento, sin sub-spec todavía) — los crea el orquestador — y descomponer en tareas cada hijo.

**Verificaciones que quedaron para la tarea**: conteo de escritores directos de `business_lines` (A-007); si algo
parsea el rol de la cookie de sesión (A-022); si la bajada de plan cancela addons en el mismo acto (DEC-FAC-064); la
relación «HOS-1798 bloquea HOS-1787» en Linear; nombres propuestos (endpoint `section-preview`, clave `foodEvents`,
ícono, ítems de noche, emails nuevos de los usuarios de fixture).

**Pendientes de seguimiento** (fuera de este repo):
- Crear en Linear los hijos 1-9 de HOS-1787 (el 8 es la migración del editor de alojamiento al catálogo).
- **HOS-1798** bloquea el arranque; **HOS-1797** bloquea el sub-spec 6; el sub-spec 9 bloquea el merge de 5 y 6
  (DEC-FAC-076). **HOS-1796** (diferencial de noche, post-MVP). Bugs previos: HOS-1792, 1793, 1794 (post-MVP) y 1795.
- Relacionar HOS-1787 con V6 de HOS-1352: el sub-spec 1 es bloqueante del corte (DEC-FAC-028) y prod ejecuta la
  migración de renombrado en el paso 3 del corte.

**Dónde**: worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1787-docs`, branch `spec/HOS-1787-docs`, PR #3812.

**Leer primero**: `01-decision-log.md` (DEC-FAC-060…076), después `sub-specs/1-renombrado.md`.
