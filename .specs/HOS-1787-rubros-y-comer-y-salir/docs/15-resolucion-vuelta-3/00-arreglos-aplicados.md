---
title: Resolución vuelta 3 · Arreglos aplicados
linear: HOS-1787
created: 2026-10-25
---

# Resolución vuelta 3 · Arreglos aplicados

La vuelta 3 revisó sólo los deltas de la resolución de la vuelta 2 ([`../14-revision-vuelta-3/R-deltas.md`](../14-revision-vuelta-3/R-deltas.md)):
**0 CRÍTICA, 3 ALTA, 5 MEDIA, 7 BAJA**. Ninguno necesitó al owner, así que se aplicaron **los 15**. Las elecciones
técnicas quedaron como **DEC-FAC-070 a DEC-FAC-076** en `../01-decision-log.md`, todas **objetables**. Ajustan
decisiones anteriores, y el índice lo marca: DEC-FAC-020 (`menu.file`, ya retirado por la 062), 044 («fuera del
escaneo»), 060 (cómo se escanean las editadas), 063 (`delete` en `absent` con la acción 15), 065 (forma de datos,
default implícito, nombre del modo, lugar del servidor) y 069 (el bloqueo pasa a ser de merge).

**Con esto las revisiones quedan cerradas.** Próximo paso: crear en Linear los hijos 1-9 de HOS-1787 (los crea el
orquestador al cerrar la revisión) y descomponer en tareas.

## ALTA

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V3-01 | F-V3-001 | `docs/06-guards.md` (G-FAC-R1), `sub-specs/1-renombrado.md`, DEC-FAC-070 | Las cinco migraciones editadas y sus `meta/`, y los **tests de historia** (aplican migraciones hasta un tag anterior al renombrado o importan una data-migration; lista derivada por el guard), salen del escaneo de identificadores como historia. Las cinco editadas ganan un **chequeo de valores** (ningún literal de valor viejo; nombres de tabla y enum permitidos). Mutaciones y control negativo nuevos (la 0132, `cut-migration-over-data.test.ts`). Siguen siendo cinco exenciones |
| FIX-V3-02 | F-V3-002 | `sub-specs/3-resolvedor.md` (tabla de lectores, criterio), `2-catalogos.md`, `6-web-publica.md`, DEC-FAC-072 | El promedio y el conteo de una dimensión ligada a una sección `absent` no se publican; los votos se conservan. Fila nueva en la lista cerrada de lectores; criterio «restaurante que pasa a boliche no publica Comida» |
| FIX-V3-03 | F-V3-003 | `sub-specs/2-catalogos.md`, `3-resolvedor.md`, DEC-FAC-071 | Forma de datos en `votedOnly`: desglose derivado del catálogo, cada dimensión opcional, entero 1-5, «no votó» = clave ausente (`0` y `null` rechazados); agregado `Partial<Record<id, { average, count }>>`; `recomputeRating` con filas genéricas; `averageRating` = promedio de `overallRating` |

## MEDIA

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V3-04 | F-V3-004 | `sub-specs/7-admin.md`, `5-editor.md` | `menuUrl` sale de la config consolidada, el formulario y el alta del admin (como la carta), con sus tests; los e2e `listing-owner-01/02` y `listing-owner-self-service.md` pasan a editarlo en la carta |
| FIX-V3-05 | F-V3-005 | `sub-specs/5-editor.md`, `9-copy-del-embudo.md` | El upsell `owner.editor.menuManager.locked` (es/en/pt), que promete archivo y enlace en el plan básico, se reescribe en el sub-spec 5; el 9 cita el relevamiento (no hay otras promesas) |
| FIX-V3-06 | F-V3-006 | `sub-specs/2-catalogos.md`, `3-resolvedor.md` (sección «Servidor de reseñas»), `6-web-publica.md`, `docs/06-guards.md` (G-FAC-02 regla 12), DEC-FAC-073 | Validación, recálculo y golden pasan al sub-spec 3; experiencia **declara** `ReviewRules` (cuatro dimensiones sin ligar) y no hay default implícito; el modo legado se llama `legacyNullAsZero`; alojamiento no usa la base (verificado); se corrige dónde vive la imputación |
| FIX-V3-07 | F-V3-007 | `sub-specs/4-tipos-y-noche.md`, `7-admin.md`, `docs/06-guards.md` (G-FAC-10), DEC-FAC-074 | Las siete columnas de `nightInfo` entran a `LISTING_SUPPORT_EDIT_CONTENT_FIELDS`; `businessLines` va a `LISTING_NON_CONTENT_FIELDS`; G-FAC-10 compara el `SET` del purge con la lista de la acción 15 |
| FIX-V3-08 | F-V3-008 | `spec.md` (fases), `sub-specs/5-editor.md`, `6-web-publica.md`, `9-copy-del-embudo.md`, DEC-FAC-076 | Los sub-specs 5 y 6 dependen del 9 y no se mergean antes que él |

## BAJA

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V3-09 | F-V3-009 | `sub-specs/1-renombrado.md` (mapa, criterio), discovery A §5 | Verificado: `settings.onboarding.adminTours` guarda `tourId → version`; la data-migration de seen-ids renombra también `web.gastronomy.welcome`, con test |
| FIX-V3-10 | F-V3-010 | `sub-specs/1-renombrado.md:53`, discovery A §5, `docs/01-decision-log.md` (índice de DEC-FAC-020), `sub-specs/2-catalogos.md` | Cinco migraciones en la etapa B; 0139 «que se edita»; `email_outbox` sin lectores tolerantes, `quota_window` sin «Q-01 antes/después», Cloudinary renombrada; `menu.file` marcado retirado; «accommodation, si la usa» cerrado |
| FIX-V3-11 | F-V3-011 | `sub-specs/3-resolvedor.md` | La fila «JSON-LD `hasMenu`, sitemap» se parte en dos: `hasMenu` admite el enlace; `/carta/` nunca va al sitemap con sólo el enlace |
| FIX-V3-12 | F-V3-012 | `sub-specs/3-resolvedor.md`, `5-editor.md`, `7-admin.md`, DEC-FAC-075 | En `absent`, la acción 15 sólo lee; `delete` sólo si el actor es el dueño |
| FIX-V3-13 | F-V3-013 | `sub-specs/1-renombrado.md` (criterio del ensayo) | El ensayo del paso 3 corre toda la cadena pendiente en el commit del corte, no una lista fija; la CUT-LIST de la 0148 se escribe con el vocabulario viejo |
| FIX-V3-14 | F-V3-014 | `sub-specs/1-renombrado.md` (mapa), discovery A §5 | Los usuarios de fixture `gastro-owner-julieta/rodrigo/valentina@local.test` entran al inventario y al mapa (nombres nuevos propuestos) |
| FIX-V3-15 | F-V3-015 | `spec.md`, frontmatter de los sub-specs, `sub-specs/9-copy-del-embudo.md` | Los hijos de Linear 1-9 los crea el orquestador al cerrar la revisión (no se crean acá); el inventario del sub-spec 9 se relevó (no hay correo de bienvenida propio de la vertical; entra el recordatorio de renovación). Los nombres «propuestos» (endpoint, `foodEvents`, ícono, ítems de noche) se fijan al descomponer |

## Lo que NO se aplicó

Nada quedó afuera. Dos cosas se dejaron para la descomposición a propósito, porque son nombres y no reglas: los
nombres «propuestos» de FIX-V3-15 y los emails nuevos de los usuarios de fixture (FIX-V3-14).

## Housekeeping

- `spec.md`: estado (revisiones cerradas, 0 CRÍTICA en la vuelta 3), índice con las carpetas 14 y 15, fases con 5 y 6
  dependiendo de 9, DEC-FAC-001…076.
- `docs/01-decision-log.md`: DEC-FAC-070…076 y marcas en el índice.
- `docs/02-worklog.md` y `docs/03-handoff.md` al día.
