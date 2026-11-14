---
title: Lectura de las conversaciones del chat de IA por el comercio y el staff (delta sobre HOS-2101)
linear: HOS-2075
statusSource: linear
created: 2026-11-14
status: approved
type: feature
areas:
  - api
  - web
  - admin
  - db
smokeGates:
  - status-needs-smoke-staging
---

# HOS-2075 · Lectura de las conversaciones del chat de IA

> **Estado**: decisiones del owner cerradas el 14/11/2026 (ver [Decisiones del owner](#decisiones-del-owner-14112026)). Verificado contra `origin/staging` (HEAD `bc2abd8c26`, 2026-11-14).

## 1. Hallazgo que cambia el alcance

HOS-2075 se escribió el 2026-11-07 con la premisa «nada en la plataforma lee las conversaciones». **Esa premisa ya no es cierta.**
HOS-2101 (Done el 2026-11-10) y HOS-2105 construyeron el panel «Preguntas a la IA» del dueño. Lo que hoy existe en `staging`:

| Pedido de HOS-2075 | Estado en `staging` | Evidencia |
|---|---|---|
| AC-1 el dueño ve lo que le preguntaron en **sus** fichas | HECHO, por ficha, últimos 12 meses, newest first | `apps/api/src/routes/ai/protected/listing-questions.ts:33-62`; servicio `apps/api/src/services/ai-listing-questions.service.ts:101-112` (`isListingOwnedBy`) y `:260-327` (`readQuestionBlock`) |
| AC-1 filtro por fecha | NO existe | `AiListingQuestionsQuerySchema` sólo tiene `entityType`, `entityId`, `othersCursor` (`packages/schemas/src/entities/ai/ai-listing-questions.schema.ts:~70-90`) |
| AC-2 turnos cliente/asistente en orden | PARCIAL: se muestra el par pregunta + respuesta, no la conversación. El id de conversación **no se expone a propósito** (header del schema: «never the conversation id, which would let a client correlate several questions to one person») | `ai-listing-questions.schema.ts:1-11` |
| AC-3 ficha ajena → 404 | HECHO | `listing-questions.ts:48-51` |
| AC-4 permiso nuevo en `PermissionEnum` | NO: la ruta autoriza por **propiedad de fila**, sin permiso (decisión de HOS-2101, «no hay entitlement nuevo»; mismo patrón que benefit usages) | `listing-questions.ts:44-51`, `.specs/HOS-2101-ai-questions-panel/spec.md` §4 NG-3 |
| AC-5 el dueño no ve la identidad | HECHO: el `select` nunca nombra `user_id` | `ai-listing-questions.service.ts:1-23` |
| AC-6 el staff puede consultarlas | NO existe ninguna ruta admin; HOS-2101 lo dejó fuera (NG-2) | `apps/api/src/routes/ai/` no tiene ruta de conversaciones; sólo `admin/post-generate.ts` y `admin/translate.ts` |
| AC-7 retención + purga | HECHO: 12 meses, **hard delete**, cron diario | `apps/api/src/services/ai-listing-questions-retention.ts:68-107`; `apps/api/src/cron/schedules.manifest.ts:254`; `AI_LISTING_QUESTIONS_RETENTION_MONTHS = 12` en `ai-listing-questions.schema.ts:37` |
| Datos personales | ABIERTO: el contenido se guarda y se muestra textual | `packages/db/src/schemas/ai/ai_messages.dbschema.ts` (comentario de `content`: «stored raw — NOT PII-scrubbed, §5.10»); `apps/api/src/services/ai-chat-persistence.ts:263-272` |
| Aviso al cliente | ABIERTO: el widget sólo dice que las respuestas pueden tener errores | `apps/web/src/components/accommodation/AiChatWidget.tsx:217` (`headerDisclaimer`); `packages/i18n/src/locales/es/accommodations.json:1008`, `es/venue.json:4`, `es/experience.json:4` (y en/pt) |

Además, el **resumen semanal por mail** (HOS-2101 §6.5) cita hasta 5 preguntas textuales por ficha: lo que se decida sobre datos personales también aplica al mail.

**Consecuencia**: esta spec NO reconstruye la lectura del dueño. Es el **delta** que falta para cerrar HOS-2075: vista del staff, tratamiento de datos personales, aviso al cliente y filtro por fecha (la vista de conversación completa para el dueño se descartó, ver Q-4).

## 2. Problema

1. El staff no puede ver las conversaciones para moderar un caso (una respuesta mala, un abuso, un reclamo). Hoy sólo hay SQL.
2. Un cliente puede haber escrito su teléfono o su mail en el chat. Hoy el dueño lo ve tal cual (y lo recibe por mail), y el cliente no sabe que el comercio lo lee.
3. El dueño no puede acotar por fecha (AC-1).

## 3. Alcance

### Dentro

- **S-1 Vista de staff** (Q-5): rutas admin de sólo lectura que listan conversaciones de IA de chat por ficha / fecha y abren una con sus turnos. Permiso NUEVO en `PermissionEnum`, sembrado SÓLO a SUPER_ADMIN.
- **S-2 Redacción al leer** (Q-2): `scrubPii` (`packages/ai-core/src/safety/pii-scrubber.ts`) aplicado al devolver texto en el panel del dueño, el mail semanal y la vista de staff. El texto guardado NO cambia.
- **S-3 Aviso al cliente** (Q-1): línea fija en el widget del chat de las tres verticales, es/en/pt.
- **S-4 Filtro por fecha** en el panel del dueño (`from` / `to` opcionales, dentro del horizonte de 12 meses).

### Fuera

- Vista de conversación completa para el dueño (Q-4). Se trackea aparte en **HOS-2188** como feature futura; esta spec no la toca.
- Cambiar la retención (Q-3): se mantienen 12 meses con borrado definitivo.
- Redactar al escribir / backfill: descartado (Q-2).
- Mostrarle al dueño el nombre o el contacto del cliente (OQ-1 de HOS-2101).
- `/conversations` y `routes/conversations/*` (mensajería dueño-huésped), el chat de búsqueda (`feature = 'search'`), responder al cliente.

## 4. Modelo de datos

**Estructural: sólo el valor del enum.** Las tablas y columnas ya existen (`ai_conversations.listing_entity_type/id`, índice `aiConversations_listing_idx`, `ai_messages.answer_status`). Un valor nuevo de `PermissionEnum` exige una migración estructural `ALTER TYPE "public"."permission_enum" ADD VALUE ...` (`pnpm db:generate`, migración `0203`), que corre ANTES de la data-migration que lo siembra. El permiso NO entra en `SUPER_ADMIN_EXCLUSIVE_PERMISSIONS` (eso impediría ampliarlo después a otro rol sin tocar código), y se registra como ubicación deliberada en `KNOWN_SYSTEM_FALLBACK_KEYS`.

- **Permiso nuevo**: valor en `packages/schemas/src/enums/permission.enum.ts`, familia camelCase (p. ej. `aiConversation.viewAny`, como `userBookmark.viewAny`). **Leer antes** `packages/schemas/test/enums/permission-naming-convention.guard.test.ts`: congela los 13 valores con puntos y falla ante un 14.º; el valor nuevo no lleva punto en el nombre de entidad, así que cumple la convención camelCase.
- **Seed dual-write** (regla de la raíz): (1) baseline del seed de roles/permisos para que una DB nueva lo tenga asignado a SUPER_ADMIN y (2) data-migration numerada (`pnpm db:seed:make <slug>`) que inserta la fila de `role_permission` para SUPER_ADMIN en DBs vivas. NO se asume el bypass de SUPER_ADMIN: la fila se siembra de verdad (R-4).

## 5. API

Respeta las tres capas y el orden de `apps/api/docs/error-contract.md` (401, 403, 400, 404, reglas).

| Tier | Ruta | Cambio | Autorización |
|---|---|---|---|
| Protected | `GET /api/v1/protected/ai/listing-questions` | **Extender** con `from`, `to` (ISO date, opcionales) y redacción al leer | propiedad de fila, sin permiso (ya es así); ficha ajena o inexistente: **404** nunca 403 |
| Admin | `GET /api/v1/admin/ai/conversations` | **Nueva**. Query: `entityType`, `entityId`, `from`, `to`, `page`+`pageSize` (NO `limit`) | `requiredPermissions: [PermissionEnum.<nuevo>]`, nunca por rol |
| Admin | `GET /api/v1/admin/ai/conversations/:id` | **Nueva**. Turnos en `created_at` ascendente | mismo permiso; id inexistente: 404 |

Reglas:

- Validar la forma ANTES de tocar la base (no-UUID: 400, no 500).
- Rutas admin con `createAdminListRoute` / `createAdminRoute` (rechazan parámetros desconocidos).
- La respuesta del staff NO incluye identidad del cliente. Se arma clave por clave, como `toListingQuestionsResponse` (`ai-listing-questions.service.ts:223-245`).
- `from`/`to` se validan contra el horizonte con `retentionCutoff`; `from` anterior al corte o `from > to`: 400.
- Bug de `scrubPii` hallado al implementar: `+54 9 3442 123456` dejaba el prefijo `+54 9` (el `\b` inicial no matchea antes de `+` y el `9` móvil no estaba contemplado). Se corrige en `packages/ai-core` con test de regresión; afecta también a la telemetría, a favor.
- Redacción: función pura `redactChatText({ text })` (RO-RO) que envuelve `scrubPii`, en `apps/api/src/services/`. UNA sola implementación, usada por el panel, el digest semanal y la vista de staff. `scrubPii` sobre-redacta a propósito (puede tocar números de precio); documentarlo en el JSDoc.

## 6. UI

- **Web (CSS Modules)**: `AiQuestionsPanel.client.tsx` + `.module.css`: selector de rango de fechas. Las páginas de `src/pages` siguen session-blind.
- **Widget del chat (S-3)**: una línea fija bajo `headerDisclaimer` en `AiChatWidget.tsx`, con las claves por vertical de `apps/web/src/lib/ai-chat-copy.ts` (`VERTICAL_SPECIFIC_KEYS`) o una clave compartida bajo `accommodations.aiChat.*`.
- **Admin (Tailwind v4 + Shadcn)**: `apps/admin/src/features/ai-conversations/` siguiendo `features/ai-usage/`; ruta en `apps/admin/src/routes/_authed/ai/`; acceso por el patrón de `apps/admin/src/lib/ai-access.ts`. Tabla TanStack con filtros de ficha y fechas.

## 7. i18n (es / en / pt)

- Aviso del widget. Texto es propuesto: "El comercio puede leer las preguntas que hagas en este chat. No compartas datos personales."
- Panel del dueño: etiquetas del filtro de fechas bajo `host.aiQuestions`, y nota de que los datos de contacto se ocultan.
- Admin: namespace del feature nuevo.
- Mail semanal: copy dentro de la plantilla (no usa `@repo/i18n`); la redacción no agrega copy.

## 8. Criterios de aceptación

1. Un dueño ve sólo preguntas de sus fichas; ficha ajena, borrada o inexistente: 404 (el test existente `apps/api/test/routes/ai-listing-questions.test.ts` sigue verde).
2. `GET /protected/ai/listing-questions?from=&to=` devuelve sólo lo del rango; `from` anterior al horizonte de 12 meses: 400 `VALIDATION_ERROR`; `from > to`: 400.
3. Con el permiso nuevo, el staff lista conversaciones por ficha y fecha y abre una con sus turnos en orden; sin el permiso: 403 `FORBIDDEN`; sin sesión: 401.
4. Ninguna respuesta (dueño ni staff) contiene `user_id`, email ni nombre del cliente (test de claves exactas).
5. Un mensaje con `juan@mail.com` y `+54 9 3442 123456` sale con `[REDACTED_EMAIL]` / `[REDACTED_PHONE]` en el panel, en el mail y en la vista de staff; el texto guardado en la base no cambia.
6. El widget de las tres verticales muestra el aviso en es, en y pt; la clave existe en los tres idiomas (guard de i18n).
7. El permiso existe en `PermissionEnum`, está sembrado SÓLO a SUPER_ADMIN (baseline + data-migration) y `permission-naming-convention.guard.test.ts` sigue verde.
8. La retención no cambia: 12 meses con borrado definitivo.
9. Para un visitante, el aviso del widget es el único cambio visible.

## 9. Tests

- **Unit** (`apps/api/test/services/`): `redactChatText` con email, teléfono AR, tarjeta con Luhn, falso positivo de precio, texto sin PII (idéntico).
- **API**: filtro de fechas (dentro, fuera, borde), 400 de `from` inválido, ficha ajena 404, anónimo 401; admin con y sin permiso (403), id inexistente 404, claves exactas de la respuesta.
- **Guards**: `permission-naming-convention.guard.test.ts`; `protected-get-write-permission.guard.test.ts` con las rutas GET nuevas; seed dual-write.
- **Web**: `AiQuestionsPanel.test.tsx` (filtro); test del widget con el aviso por idioma.
- **Mail**: el job `ai-questions-weekly-digest` y la plantilla sacan el texto redactado.

## 10. Smoke

Label **`status-needs-smoke-staging`**. Pasos: (1) con un turista, preguntar en el chat de una ficha con un teléfono y un mail; (2) ver el aviso en el widget en es/en/pt; (3) como dueño, ver la pregunta redactada y filtrar por fecha; (4) como SUPER_ADMIN abrir la conversación; con otro rol, 403; (5) disparar a mano el digest semanal y confirmar el mail redactado. What's New: se decide en el smoke.

## 11. Riesgos

- **R-1** Redactar mal: falsos positivos tapan un precio, falsos negativos dejan pasar un teléfono. Mitigado por redactar al LEER (reversible: se corrige el regex sin migrar datos).
- **R-2** El staff ve el hilo completo y, por tanto, texto libre de clientes: por eso el permiso es sólo SUPER_ADMIN y también se redacta.
- **R-3** Permiso sin seed no sirve a nadie: la data-migration es obligatoria.
- **R-4** Ninguna ruta llama al modelo: no consumen `ai_usage`.

## Decisiones del owner (14/11/2026)

Finales. Reemplazan a las opciones del borrador.

- **Q-1 Aviso al cliente**: línea fija en el widget indicando que el comercio puede leer las preguntas. es/en/pt.
- **Q-2 Datos personales**: redactar teléfonos y emails AL LEER con el `scrubPii` existente, en el panel del dueño, el mail semanal y la vista de staff. El almacenamiento queda textual.
- **Q-3 Retención**: se mantienen los 12 meses con borrado.
- **Q-4 Conversación completa para el dueño**: NO. Alcanza con el panel de preguntas actual. La idea queda como feature futura aparte en HOS-2188 (fuera de alcance acá).
- **Q-5 Vista de staff**: detrás de un permiso NUEVO de `PermissionEnum`, sembrado sólo a SUPER_ADMIN (dual-write: baseline + data-migration de `role_permission`; respetando la guard de naming).
- **Además**: el filtro por fecha entra en alcance.
