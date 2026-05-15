# Resume prompt — SPEC-117 (paste in next session)

```text
Estoy retomando SPEC-117 (Admin Pages Stabilization) post-context-reset.

LEER EN ORDEN antes de hacer nada:

1. `memory/project_spec_117_in_flight.md` — checkpoint condensado 2026-05-15
   con todo el progreso de Phase 6 (fixes + features pending).
2. `.claude/specs/SPEC-117-admin-pages-stabilization/spec.md` Part 5 — tabla
   de tasks + findings catalog actualizado.
3. Engram topic `spec/SPEC-117/checkpoint-2026-05-15-phase-6-fixes` — recap
   de decisiones técnicas y trade-offs aprobados (incluye el cambio de
   scope a "fix todo, incluso features missing").

## Estado en una línea

- Worktree: `~/projects/WEBS/hospeda-admin-pages-audit` branch
  `fix/admin-pages-audit`. **Clean**. HEAD `393bc3366`.
- **32 commits totales en la branch (incluye Phase 0..5/7/8 prior + Phase 6
  fixes de esta sesión).** Listo para PR contra `staging` cuando termine
  Phase 9.
- Phase 6 cerró **16 D-N.X findings**. Quedan **5 features missing**
  (delete UI, 5 entity-selects, sponsor Create dialog, owner-promotions
  Create UI, newsletter-campaigns Create UI) + **1 bug real** (D-8.1
  sponsor ghost-create) + **1 operational** (admin dev restart pendiente
  para verificar D-USERS.1 + D-POSTS.1 i18n SSR cache).

## Setup operativo (sin cambios de la sesión previa)

- API local en :3001 + admin local en :3000, ambos desde el WORKTREE.
- DB postgres `localhost:5436` (`hospeda_user/hospeda_pass/hospeda_dev`).
- Super-admin: `superadmin@hospeda.com` / `Audit2026!`.
- **Antes de continuar**: pedirle al user que reiniciée admin dev para
  verificar D-USERS.1 + D-POSTS.1 (i18n MISSING keys que están en JSON
  pero SSR cache stale). Receta: `Ctrl+C` en la terminal del admin →
  `rm -rf apps/admin/node_modules/.vite` → `pnpm dev`.
- Cambios en `@repo/schemas` o `@repo/service-core` necesitan
  `pnpm turbo run build --filter='@repo/<pkg>'` desde el worktree.

## Lo que YA está hecho (16 fixes de Phase 6, no re-tocar)

| Commit | Finding | Detalle |
|---|---|---|
| `b9331a26d` | **D-2.1** | Nested form fields write-block en CreateContent. Fix: flat-first read con nested fallback. |
| `c8bed6dbe` | **D-RELATIONS.1 partial** | posts.authorId → USER_SELECT, posts.relatedDestinationId + events.destinationId → DESTINATION_SELECT. 5 entity-select components faltantes documentados como follow-up. |
| `fb3db32b7` | **Smoke docs** | 5 reports: users, posts, tags-internal, accommodations, billing-newsletter. |
| `e45d31ff3` | **D-TAGS.1** | Filter `name`/`lifecycleState` → `search`/`status` mapping en 3 hooks (internal/post-tags/system). |
| `545e2e8ec` | **D-USERS.4 + D-ACCOM.1** | `authProviderUserId.optional()` → `.nullish()`; agregado field `summary` al accommodation create form. |
| `5b9391eca` | **D-4.1** | Field `destinationId` DESTINATION_SELECT agregado a event-locations create form. |
| `a461c3cb3` | **D-ACCOM.4 + D-ACCOM.5** | `location: .optional()` → `.nullish()` en accommodation schema; `useCreateAccommodationMutation` ahora desempaqueta `apiResponse.data` (antes devolvía el envelope). |
| `b0f0415aa` | **D-DROPDOWN.1 + D-USERS.3 + D-POSTS.4** | Spanish enum labels hardcoded en 5 configs (destinations, events, posts x2, users) para Visibility/Lifecycle/Moderation/PostCategory. |
| `1e8ff48bf` | **D-POSTS.3 + D-TOAST.1/2** | 11 routes con title distinto del body + gender correcto en success/error toasts. |
| `d7c9f7280` | **D-DISPLAYWEIGHT.1 + D-NAMING.1** | TextField acepta `type/min/max/step` props; NUMBER case en EntityFormSection los pasa. amenity.singular `Comodidad` → `Amenidad` (consistente con nav). |
| `23e57bab4` | **D-ACCOM.2/3 + D-POSTS.2** | `Input.tsx` usa `useId()` (no `randomUUID()`); EntitySelectField forwards `aria-required`; BooleanCell label vía i18n. |
| `393bc3366` | **D-USERS.2** | Edit row action agregado al users list (Link + ImpersonateButton en Fragment). |

## Lo que QUEDA (scope explícitamente aprobado por el user)

El user pidió fixear **TODO** incluso features missing. Estimado total: 7-10h.

### Bug real pendiente (orden 1)

**D-8.1 — Sponsor ghost-create**
- Síntoma: `/sponsors/new` Create reporta success toast + redirect, pero
  el row NO está en DB. UUID en la URL es válido pero no persiste.
- Sospecha actual: `useCreateAccommodationMutation` HAD el bug equivalente
  (response envelope unwrap mismatch), pero `useSponsorQuery.createSponsor`
  ya lo hace bien (`result.data.data`). Entonces sponsor tiene otro bug
  más profundo — quizás service.create devuelve un id fabricado sin
  commit, o un afterCreate hook rollback la transaction.
- Plan: reproducir en browser (cuidado, /sponsors/new me dio Navigation
  timeout antes — puede ser slow load o error JS). Si reproduce, verificar
  qué id devolvió el server vs qué está en DB. Inspeccionar
  `PostSponsorService.create` y sus hooks en
  `packages/service-core/src/services/postSponsor/`.

### Features missing (orden 2-5)

**Orden 2: D-USERS.5 + D-CONTENT.1 (delete UI bundle)**
- Agregar botón "Eliminar" con confirmation dialog a:
  - /access/users list row + detail (D-USERS.5)
  - /content/accommodation-amenities (D-CONTENT.1)
  - /content/accommodation-features (D-CONTENT.1)
  - /content/destination-attractions (D-CONTENT.1)
- Cada uno necesita: mutation hook (DELETE), confirm dialog,
  row action + detail action bar.
- Reusar patrón de `apps/admin/src/components/tags/AdminTagDeleteDialog.tsx`
  o `DeleteConfirmDialog.tsx`.
- DB: confirmar que cada tabla soporta soft-delete (`deleted_at` column).
  Users sí; amenities/features/attractions probablemente sí.

**Orden 3: D-RELATIONS.1 rest (5 entity-select components)**
- Crear:
  - `AccommodationSelectField` — para posts.relatedAccommodationId.
  - `EventSelectField` — para posts.relatedEventId.
  - `EventLocationSelectField` — para events.locationId.
  - `EventOrganizerSelectField` — para events.organizerId.
  - `SponsorshipSelectField` — para posts.sponsorshipId.
- Cada uno: copiar `UserSelectField.tsx` o `DestinationSelectField.tsx` como
  template. Tres util functions cada uno (search, loadByIds, loadInitial).
  Endpoint admin de la entidad correspondiente.
- Update configs en posts/events relations.consolidated.ts para usar los
  nuevos types (remover los TODO comments que dejamos en commit `c8bed6dbe`).
- Update FieldTypeEnum + EntityFormSection switch cases.

**Orden 4: D-SPONSORSHIP.1 (Create sponsorship dialog)**
- Implementar feature completa de Create sponsorship desde
  `/billing/sponsorships` "Crear patrocinio" button.
- Necesita: form dialog (sponsor select, post select, tier, dates, amount),
  mutation hook, i18n strings, validation schema. ~200-400 líneas.
- Verificar si el backend POST /admin/sponsorships ya existe (sí, ya
  cargué la list endpoint exitosamente).
- Niveles y Paquetes tabs probablemente tienen el mismo bug (no probado).

**Orden 5: D-OWNERPROMO.1 + D-NEWSLETTER.1 (Create UI missing)**
- `/billing/owner-promotions` y `/newsletter/campaigns` listas funcionan
  pero no tienen botón Crear.
- Product decision: confirmar con el user que el admin debería poder crear
  estas entidades (puede que sea read-only by design en owner-promotions).
- Si sí: dialog/page de Create + mutation + i18n.

### Operational (orden 6, 30s)

**D-USERS.1 + D-POSTS.1 i18n SSR cache restart**
- Las keys YA EXISTEN en `packages/i18n/src/locales/{es,en,pt}/admin-entities.json`
  (`columns.fullName`, `types.userRole.*`, `types.authProvider.*`,
  `types.postCategory.*`, `columns.sponsor/sponsorship`).
- /destinations carga 0 missing. /users + /posts + /permissions muestran
  MISSING porque el SSR Node cachea trans map stale del state pre-Phase 4.
- Acción del user: terminar admin dev con `Ctrl+C` → borrar
  `apps/admin/node_modules/.vite` → `pnpm dev`. Después verificar que
  todas las páginas muestran 0 `[MISSING:]`.

## Out-of-scope final (NO fixear en este spec)

- B-1..B-5 + N-2 — server-side billing/Brevo/BullMQ local config issues
  (M-2 retry-storm ya cierra el síntoma cliente). Already documented.
- CE-6/CE-8 third-party dev noise (documented in
  `apps/admin/CLAUDE.md` Common Gotchas).

## Modo de trabajo (regla del user)

- Hablamos en rioplatense.
- No commit hasta que el user lo pida explícitamente.
- Por cada finding tocado, mostrarle al user findings/cambios antes de
  proponer fix grande.
- Si un fix necesita debate (e.g. product decision, scope creep), parar
  y mostrar opciones con tradeoffs antes de tocar código.

## Arrancá

1. Pedirle al user que restartée admin dev (D-USERS.1+D-POSTS.1 verify).
2. Mientras tanto: arrancar con D-8.1 (sponsor ghost-create) — `/sponsors/new`,
   submit, capturar response body + DB state, comparar.
3. Después: orden 2-5 secuencial.
```
