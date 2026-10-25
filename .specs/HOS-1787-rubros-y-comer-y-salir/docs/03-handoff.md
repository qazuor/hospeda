---
title: Handoff — HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
---

# 03 · Handoff

**Estado**: vueltas 1 y 2 de revisión adversarial **cerradas**. Vuelta 2: 58 hallazgos, 47 arreglos técnicos
(DEC-FAC-040…059, todavía objetables: el owner no las objetó ni las aceptó explícitamente) y las diez preguntas
respondidas (DEC-FAC-060…069). No queda ninguna decisión abierta en `04-open-decisions.md`.

Dos respuestas fueron contra la recomendada y cambiaron el diseño:
- **Q-13 = 3** (DEC-FAC-062): `menuUrl` pasa de `price` a `menu` y es pago; se borra el «enlace gratis» de
  `menu-projection.ts`; el rasgo `file` desaparece; `menu` puede estar `locked` entera.
- **Q-16 = 2** (DEC-FAC-065): `ReviewRules` en el catálogo (dimensiones ligadas a secciones, modo de promedio); la
  base compartida de reseñas gana un modo con default = el cálculo de hoy, para que experiencia no cambie.

**Próximo paso**: descomposición en tareas de cada hijo (1-7 y 9), o una vuelta 3 acotada sobre lo que cambiaron
Q-13 y Q-16 si el owner la quiere.

**Verificaciones que quedaron para la tarea**: conteo de escritores directos de `business_lines` (A-007); si algo
parsea el rol de la cookie de sesión (A-022); qué hace hoy el recálculo de experiencia con `null` (lo fija el test
golden); si la bajada de plan cancela addons en el mismo acto (DEC-FAC-064); si alojamiento usa la base compartida de
reseñas; ubicación de los correos de bienvenida y de textos que prometan el enlace de carta gratis (sub-spec 9); la
relación «HOS-1798 bloquea HOS-1787» en Linear; si el mapa de progreso de tours guarda ids.

**Pendientes de seguimiento** (fuera de este repo):
- Crear en Linear los hijos 1-7 y 9 de HOS-1787, y el **hijo 8** (migración del editor de alojamiento al catálogo).
- **HOS-1798** bloquea el arranque; **HOS-1797** bloquea el sub-spec 6; el sub-spec 9 bloquea el lanzamiento de la
  noche en prod. **HOS-1796** (diferencial de noche, post-MVP). Bugs previos: HOS-1792, 1793, 1794 (post-MVP) y 1795.
- Relacionar HOS-1787 con V6 de HOS-1352: el sub-spec 1 es bloqueante del corte (DEC-FAC-028) y prod ejecuta la
  migración de renombrado en el paso 3 del corte.

**Dónde**: worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1787-docs`. La carpeta
`.specs/HOS-1787-rubros-y-comer-y-salir/` sigue **sin trackear y sin commitear**.

**Leer primero**: `01-decision-log.md` (DEC-FAC-060…069), después `sub-specs/1-renombrado.md`.
