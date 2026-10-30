---
title: Resolución vuelta 2 · Arreglos aplicados
linear: HOS-1787
created: 2026-10-25
---

# Resolución vuelta 2 · Arreglos aplicados

Igual que en la vuelta 1: se aplicó sólo lo que **no** necesita una decisión del owner ni depende de una
pendiente. Correcciones factuales, mecánica de migración, diseño del catálogo y del resolvedor con una opción
claramente mejor, y guards. Lo que sí necesita al owner está en
[`10-decisiones-del-owner.md`](10-decisiones-del-owner.md) (Q-11…Q-20). Los hallazgos están en
[`../12-revision-vuelta-2/00-consolidado.md`](../12-revision-vuelta-2/00-consolidado.md).

Las decisiones técnicas tomadas acá quedaron como **DEC-FAC-040 a DEC-FAC-059** en `../01-decision-log.md`,
todas **objetables**. Ninguna reemplaza una decisión del owner. Algunas ajustan decisiones técnicas
anteriores, y el índice lo marca: DEC-FAC-004 (`estandar` → `standard`, por la 031), 014 y 023 (el 301 de
`/carta/` lo reemplazan la 030 y la 042), 016 (`entity_subscriptions` fuera), 033 (su premisa la reemplaza la
049) y 035 (reseñas, pendiente de Q-16).

**Total: 47 arreglos** sobre los 48 hallazgos (a). F-V2-050 se registró como verificación dentro de la tarea,
no como cambio. Los 10 hallazgos (b) quedan en preguntas.

## Correcciones factuales

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V2-01 | F-V2-002 | `sub-specs/1-renombrado.md`, `docs/05-discovery-a-renombrado.md` §5 | `amenities/features.applicable_verticals[]` guardan `'gastronomy'` **en prod**: MV en la migración del renombrado + dual-write de los 42 JSON del seed, con su `count(*) = 0` |
| FIX-V2-02 | F-V2-003 | `spec.md`, `sub-specs/1-renombrado.md` | Prod **ejecuta** la migración de renombrado en el paso 3 del corte (0124 → 0125…0178 + renombrado). Criterio nuevo: ensayo del paso 3 sobre un clon de prod-main, incluida la comparación del paso 6 |
| FIX-V2-03 | F-V2-021 | `sub-specs/1-renombrado.md`, discovery A §5 | `ai_prompt_versions`, `ai_conversations`, `ai_request_log` al inventario (MV); `social_audit_log` NM |
| FIX-V2-04 | F-V2-029 | `sub-specs/1-renombrado.md`, discovery A §5, `docs/01-decision-log.md` (DEC-FAC-054) | La 0109 **no** re-notifica: reescribe los ids vistos. Los ids de What's New y del tour se renombran con una migración de seen-ids encadenada a la 0109. Frase del sub-spec 1 corregida |
| FIX-V2-05 | F-V2-047 | `sub-specs/1-renombrado.md` | Se borra la cita a una «guarda de inmutabilidad de migraciones» que no existe |
| FIX-V2-06 | F-V2-051 | `sub-specs/1-renombrado.md`, `docs/06-guards.md` (G-FAC-R2), discovery A §5 | El sticker codifica `/qr/<slug>/` (`qr/[slug].astro:8`), no `/q/<slug>`; smoke sobre la ruta real |
| FIX-V2-07 | F-V2-053 | `sub-specs/1-renombrado.md`, discovery A §5 | `publicar-restaurante` ya tiene un 301: su destino pasa a `PUBLISH_PAGE_PATH_BY_VERTICAL.venue`, un salto |
| FIX-V2-08 | F-V2-056 | `sub-specs/3-resolvedor.md` | Cita de `entitlement-step.ts` actualizada (predicado `isGranted`, `:21-38`); el resolvedor lee el conjunto efectivo una vez por pedido |
| FIX-V2-09 | F-V2-049 | varios, `docs/01-decision-log.md` (DEC-FAC-059) | Restos de vocabulario y contradicciones: `0177` → `0178`, «sección» como palabra del catálogo (la propiedad `listingSection` se mantiene), `domain_event` con su tratamiento real en prod (la tabla existe en el paso 3, sin filas de la vertical), superficies que no existen fuera |

## Mecánica de migración

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V2-10 | F-V2-004 | `sub-specs/1-renombrado.md` | Objetos de Drizzle y objetos de los extras separados: los de extras se renombran **condicionalmente** (`IF EXISTS`), incluidos los triggers `trg_set_updated_at_<tabla>`, porque `extras/002` crea uno nuevo si no encuentra el viejo. Criterio con `pg_trigger` y `pg_type` |
| FIX-V2-11 | F-V2-005 | `sub-specs/2-catalogos.md`, `sub-specs/4-tipos-y-noche.md`, DEC-FAC-045 | `drizzle-kit migrate` corre todas las pendientes en **una** transacción (comentario de la 0126): «`ADD VALUE` en migración separada» no alcanza. Regla: ninguna migración versionada usa `BOLICHE`/`PUB` como valor del enum; donde haga falta, se compara `type::text` |
| FIX-V2-12 | F-V2-018 | `sub-specs/2-catalogos.md`, DEC-FAC-046 | Default `ARRAY['standard']` en `accommodations` y `experiences`; `venues` sin default (el validador lo resuelve). Secuencia `ADD COLUMN` → backfill → `NOT NULL` |
| FIX-V2-13 | F-V2-019 | `sub-specs/1-renombrado.md` | La ventana de staging tiene 6 pasos: apagar API, crons y webhook; reset de `hospeda_dev` antes de la plantilla; `--pull` sobre el commit de la imagen |
| FIX-V2-14 | F-V2-022 | `sub-specs/2-catalogos.md`, DEC-FAC-047 | La matriz tipo → rubros entra al CHECK de `venues` como `CASE type::text`; sin carrera entre dos PATCH |
| FIX-V2-15 | F-V2-043 | `sub-specs/1-renombrado.md` | Primera sentencia de la migración: `RAISE EXCEPTION` si la base no se reseteó, con un mensaje que dice qué hacer |
| FIX-V2-16 | F-V2-044 | `sub-specs/2-catalogos.md` | El backfill usa `CASE type::text` con `ELSE`, y su test compara contra una lista **fija** de valores del enum, para que un tipo nuevo no lo ponga rojo por accidente |
| FIX-V2-17 | F-V2-046 | `sub-specs/2-catalogos.md`, DEC-FAC-047 | `{food, food}` rechazado: CHECK y validador exigen rubros sin repetidos |
| FIX-V2-18 | F-V2-048 | `sub-specs/1-renombrado.md`, discovery A §5 | Orden fijo: `UPDATE qr_codes.target_url` antes del `RENAME VALUE` de `entity_type`, si no, el filtro no encuentra filas |
| FIX-V2-19 | F-V2-050 | `sub-specs/1-renombrado.md` | La cookie de sesión con `GASTRONOMY_OWNER` queda como verificación en la tarea (no verificado; el propio revisor lo marca) |

## Catálogo (sub-spec 2)

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V2-20 | F-V2-006 | `sub-specs/2-catalogos.md`, `3-resolvedor.md`, `5-editor.md`, DEC-FAC-040 | Cada sección declara sus `fields`; el resolvedor deriva `sectionsTouchedByBody`; proyector genérico; las claves del payload del editor salen del catálogo; G-FAC-02 regla 11 |
| FIX-V2-21 | F-V2-012 | `sub-specs/2-catalogos.md` | Tabla cerrada de secciones por vertical: venue, experiencia y alojamiento enumeradas, con grupo, clave y rasgos. Se termina el puntero circular |
| FIX-V2-22 | F-V2-026 | `sub-specs/2-catalogos.md`, `4-tipos-y-noche.md`, `6-web-publica.md`, DEC-FAC-050 | «De noche» sale de `headingWhenMultiLineKey` + `multiLine` del resolvedor; la edad sugerida de BOLICHE sale de `typeRules.BOLICHE.fieldDefaults`. Nada compara rubros ni tipos |
| FIX-V2-23 | F-V2-036 | `sub-specs/2-catalogos.md`, `5-editor.md`, `7-admin.md` | `resolveBusinessLineOptions` devuelve las opciones válidas para el tipo y el plan; la UI no las recalcula |
| FIX-V2-24 | F-V2-037 | `sub-specs/2-catalogos.md`, `3-resolvedor.md` | Ids de sección y de rasgo, y claves de `typeRules`, tipados (`BusinessLineValue<V>`, `Record<ListingTypeOf<V>, …>`) |
| FIX-V2-25 | F-V2-039 | `sub-specs/2-catalogos.md` | Contrato del límite de rubros por plan: limit de scope `vertical` en el paso 7, con `requested = |rubros resultantes|`; la bajada de plan nunca toca rubros |
| FIX-V2-26 | F-V2-055 | `sub-specs/2-catalogos.md`, `5-editor.md` | Contrato de error del validador: 400 `VALIDATION_ERROR` con `reason` (`EMPTY`, `DUPLICATE`, `NOT_IN_VERTICAL`, `NOT_ALLOWED_FOR_TYPE`, `MAX_EXCEEDED`, `EXCLUDED_PAIR`) y claves `zodError.venue.businessLines.*` |
| FIX-V2-27 | F-V2-058 | `sub-specs/2-catalogos.md`, DEC-FAC-059 | «Section» ya significa otra cosa en el admin y en el web: el término del catálogo queda definido y la propiedad `listingSection` de las rutas se mantiene |
| FIX-V2-28 | F-V2-041 | `spec.md`, `sub-specs/2-catalogos.md`, `4-tipos-y-noche.md`, DEC-FAC-045 | `PUB`/`BOLICHE` (enum, `ADD VALUE`, etiquetas, descripciones) pasan al sub-spec 2; el 4 depende de 2 **y** 3; HOS-1798 bloquea el arranque y HOS-1797 el sub-spec 6 |

## Resolvedor y cadena de autorización (sub-spec 3)

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V2-29 | F-V2-007 | `sub-specs/3-resolvedor.md`, `5-editor.md`, DEC-FAC-041 | Las rutas declaran intención `read` / `write` / `delete`; borrar en `locked` se expresa como intención `delete` (vaciar la sección, no por ítem) |
| FIX-V2-30 | F-V2-008 | `sub-specs/2-catalogos.md`, `3-resolvedor.md`, DEC-FAC-051 (objetable) | QR de mesa: el rasgo `menu.qr` usa `menu_qr_scan_metrics` (premium, como hoy) y la ruta `menuQr` cambia su operación para no tirar 500. Se mantiene el statu quo comercial, por eso no es pregunta |
| FIX-V2-31 | F-V2-010 | `sub-specs/3-resolvedor.md`, `docs/06-guards.md` (G-FAC-04), DEC-FAC-049 | Experiencia migra su gate de indicaciones al resolvedor (HOS-1049 es un rasgo `locked`); alojamiento declara sus claves pero su código queda en una lista exenta contada que vacía el hijo 8; `chat.ts` cambia su `Record` entero |
| FIX-V2-32 | F-V2-025 | `sub-specs/3-resolvedor.md`, DEC-FAC-051 | Un rasgo dentro de una sección `locked` está `locked` |
| FIX-V2-33 | F-V2-034 | `sub-specs/3-resolvedor.md`, DEC-FAC-048 | El 4b le responde 409 `SECTION_ABSENT` sólo al dueño; a un tercero, 404 `NOT_FOUND` |
| FIX-V2-34 | F-V2-035 | `sub-specs/3-resolvedor.md`, DEC-FAC-048 | El 4b corre también en `CREATE`; firma `sections?: { requested: { id, intent }[]; resultingBusinessLines }` |
| FIX-V2-35 | F-V2-040 | `sub-specs/3-resolvedor.md`, `docs/06-guards.md` (G-FAC-06), DEC-FAC-055 | `getMenu`, `getDailySpecials`, `getEvents` protegidos pasan a la cadena (`READ_OWN`, intención `read`); el acceso del personal con `VIEW_ALL` se preserva (acción 15 o V8, con test) |
| FIX-V2-36 | F-V2-013 | `sub-specs/3-resolvedor.md`, `6-web-publica.md`, `docs/06-guards.md` (G-FAC-R2), DEC-FAC-042 | `/carta/` sin carta disponible → **302 `no-store`** a la ficha, no 301: el estado es reversible |

## Producto y web (sub-specs 4 a 7)

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V2-37 | F-V2-014 | `sub-specs/4-tipos-y-noche.md`, `6-web-publica.md`, DEC-FAC-052 | «Abierto ahora»: un turno pertenece al día en que empieza; test viernes/sábado 23:30–06:00. El badge se calcula en el cliente sobre HTML cacheado |
| FIX-V2-38 | F-V2-017 | `sub-specs/6-web-publica.md`, DEC-FAC-053 | Reglas duras de edad y alcohol para el chat de IA en `DEFAULT_RULES.chat_venue` |
| FIX-V2-39 | F-V2-045 | `sub-specs/4-tipos-y-noche.md`, DEC-FAC-058 | Forma de `nightInfo`: `entry_note_i18n`, `dress_code_note_i18n`, CHECKs de precio, `min_age` 13–30, fecha del precio sólo si cambia, `paid` → otro borra el precio |
| FIX-V2-40 | F-V2-032 | `sub-specs/7-admin.md`, DEC-FAC-056 | El aviso in-app de «te cambiaron los rubros» dura 30 días, se colapsa, desaparece al editar; `ALREADY_OPEN` si ya hay uno |
| FIX-V2-41 | F-V2-033 | `sub-specs/7-admin.md`, DEC-FAC-057 | El admin no edita `nightInfo`; REQUEST_FIX queda como política; el PATCH del admin pasa por la cadena |
| FIX-V2-42 | F-V2-052 | `sub-specs/6-web-publica.md` | Slugs reservados `rubro` y `page` para que un local no pierda su `/carta/` |
| FIX-V2-43 | F-V2-054 | `sub-specs/5-editor.md` | El tour es por rol: su paso del QR se salta si el target no existe |

## Guards (`docs/06-guards.md`)

| fix | hallazgo | qué cambió |
|---|---|---|
| FIX-V2-44 | F-V2-015 | G-FAC-R1 rediseñado (DEC-FAC-044): fuera del escaneo la migración de renombrado y su `meta/`, y las data-migrations del seed; exención (a) como lista cerrada de **tema** (incluye la dimensión `gastronomy` del rating de destino, que no se renombra); (b) aclarada; regla 5 nueva sobre **valores** de i18n y notificaciones; control negativo |
| FIX-V2-45 | F-V2-011 | G-FAC-03(a) por **operando tipado** `BusinessLine` con el checker de TypeScript (DEC-FAC-043), no por texto; control negativo con `rate-limit.ts` y el rating de reseña |
| FIX-V2-46 | F-V2-023, F-V2-038, F-V2-057 | G-FAC-10 nuevo (el purge cubre cada columna de contenido); G-FAC-08 compara también el catálogo de alojamiento con la lista manual; G-FAC-07 suma `routes/plan-catalog/` y las rutas `billing-*` |
| FIX-V2-47 | F-V2-007, 040, 046, 047 | G-FAC-06 exige que la ruta use la cadena y que `DELETE`/vaciado declare `delete`; G-FAC-01 verifica también la matriz `CASE` y el default; G-FAC-09 pasa a «ninguna validación fuera del validador» y cuenta `resolveBusinessLineOptions` |

## Housekeeping

- `spec.md`: estado, índice de archivos de la vuelta 2, tabla de fases (HOS-1798, 4 depende de 2 y 3), `0178`,
  prod ejecuta el renombrado.
- `docs/01-decision-log.md`: DEC-FAC-040…059 agregadas y marcas en el índice de las que se ajustan.
- `docs/04-open-decisions.md`: OD-17…OD-26, una por pregunta.
- `docs/02-worklog.md` y `docs/03-handoff.md` al día.

## Lo que NO se aplicó (espera al owner)

F-V2-001 (Q-11), 020 (Q-12), 009 (Q-13), 042 (Q-14), 031 (Q-15), 024 (Q-16), 027 (Q-17), 028 (Q-18), 030
(Q-19), 016 (Q-20). Los sub-specs ya nombran la pregunta pendiente en el lugar donde la respuesta cambia algo.

## Después de las respuestas del owner (2026-10-25)

Las diez preguntas quedaron respondidas (DEC-FAC-060…069) y aplicadas en los sub-specs 1-7, el nuevo sub-spec 9
(copy del embudo), `06-guards.md` (G-FAC-R1 sin la tile de la home y con cinco migraciones editadas; G-FAC-02 regla 12;
G-FAC-05 ampliado a reseñas y al aviso de bajada), discovery A §5 y `spec.md`. Q-13 y Q-16 fueron contra la
recomendada; lo que eso cambió está en DEC-FAC-062 y DEC-FAC-065.
