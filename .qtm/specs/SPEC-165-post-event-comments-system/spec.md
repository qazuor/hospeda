---
specId: SPEC-165
title: Post and Event Comments System
status: draft
complexity: high
owner: qazuor
created: 2026-05-27
revised: 2026-05-30
related:
  - SPEC-155 (admin-dashboards-v1 — origin; feeds EDITOR card H)
  - SPEC-164 (admin-billing-super-only — parallel spec, same sprint)
---

# SPEC-165 — Post and Event Comments System

> **Status**: DRAFT — full spec. Extracted from SPEC-155 Phase-1 scout 2026-05-27. All open questions resolved by owner 2026-05-30. Ready for task generation.

## 1. Origin

Extracted from SPEC-155 Phase-1 scout on 2026-05-27.

**Concrete finding**: SPEC-155 assumed a route `GET /api/v1/admin/comments/recent` (T-009) that could be built without DB changes. The scout found this to be a blocker: no `post_comments`, `event_comments`, or `entity_comments` table exists in the schema. The `posts` table has only an integer `comments` counter field (no per-comment storage). The `events` table has no comment-related field at all. Only `POST_COMMENT_CREATE` and `EVENT_COMMENT_CREATE` exist in `PermissionEnum` — the `_VIEW` and `_MODERATE` variants required by this system do not exist.

As a result, T-009 was tombstoned in SPEC-155, EDITOR dashboard card H ("Comentarios") renders a deferred placeholder pointing to this spec, and the full comments system is scoped here.

Once SPEC-165 ships, EDITOR dashboard card H automatically upgrades from the deferred placeholder to a live feed.

## 2. Goal

Design and implement a comment system for posts and events so that:

- Registered users can leave comments on blog posts and on events.
- Comments are published immediately (moderation is retroactive, not a blocking gate).
- EDITOR role users can view and moderate comments from the admin dashboard (EDITOR card H live feed + moderation queue).
- ADMIN and SUPER_ADMIN roles retain full comment management access.
- The `posts.comments` integer counter stays accurate (kept in sync by the service layer).

## 3. Resolved decisions

All decisions below are FINAL. They must not be re-opened during implementation.

### RD-1 — Storage: single unified table `entity_comments` (polymorphic)

A single table with `(entityType, entityId)` polymorphic FK pair is used. Two-table alternative (`post_comments` + `event_comments`) was rejected.

**Rationale**: matches the established project precedent (`user_bookmarks`, `r_entity_tag`). Reduces migration surface and allows the admin recent-comments feed to query a single table without UNION. The column accepts the full `EntityTypePgEnum` but the service validates and rejects any value outside `POST | EVENT` (see RD-3).

### RD-2 — Flat structure, no threading

Comments are stored flat (one level). No `parentId` column is introduced in this spec.

**Rationale**: reduces schema complexity for the initial MVP. Threading support can be added later by introducing a nullable `parentId` FK without a breaking schema change (see §9 Future evolution).

### RD-3 — entityType restricted to POST and EVENT at the service layer

The `entity_type` column accepts the full `EntityTypePgEnum` (shared pg enum). The `EntityCommentService` validates that the provided `entityType` is one of `['POST', 'EVENT']` and returns a `NOT_FOUND`-equivalent error for any other value. Adding ACCOMMODATION or DESTINATION later requires only new permissions + endpoints, not a schema change.

### RD-4 — moderationState DEFAULT = APPROVED (publish-immediately model)

New comments are APPROVED on insert. There is no blocking PENDING gate. Moderation is retroactive: an EDITOR or ADMIN can change `moderationState` to REJECTED from the admin moderation queue. REJECTED comments are hidden from public reads.

**Rationale**: low-friction UX for commenters; no bottleneck for editors who are not always online. PENDING flow can be toggled later as a config if needed.

### RD-5 — Registered users only

`authorId` always references a registered user on create. Anonymous/guest comments are not allowed. The API write endpoint is gated behind a valid Better Auth session. Unauthenticated requests receive 401.

**Column nullability clarification (resolved 2026-05-30 during T-001):** the `author_id` DB column is NULLABLE with `ON DELETE SET NULL`, not `NOT NULL`. A NOT NULL column combined with `ON DELETE SET NULL` is impossible in Postgres, and risk R6 explicitly requires preserving a deleted user's comments with a null author surfaced as "[Usuario eliminado]". The "registered users only" guarantee is therefore enforced at the service layer (the actor id is always set on create); the column is null only after the author account is later deleted. This reconciles RD-5 with §4.1 and risk R6.

### RD-6 — Rate limit: 5 comments per user per minute

The write endpoint is rate-limited using the existing `createPerRouteRateLimitMiddleware`. Limit: 5 requests per minute per authenticated user. Users hitting the limit receive 429.

### RD-7 — `posts.comments` counter kept in sync

The existing `posts.comments` integer column is KEPT and kept accurate. The service increments it on create, and recomputes it (via `COUNT`) on soft-delete and on moderation state change (APPROVED ↔ REJECTED). Dashboard cards and post listings that consume this counter are not broken.

`events` has no equivalent counter; no counter update is needed for events.

### RD-8 — Notifications: out of MVP scope

Notifications to EDITOR when a new comment arrives are explicitly out of scope for this spec (see §9).

### RD-9 — Reuse `POST_COMMENT_CREATE` / `EVENT_COMMENT_CREATE` as write gate

`POST_COMMENT_CREATE` (`post.comment.create`) and `EVENT_COMMENT_CREATE` (`event.comment.create`) already exist in `PermissionEnum` (lines 209 and 188 respectively). This spec REUSES them as the runtime write gate for comment creation and own-comment deletion — no new `_WRITE` variant is introduced.

**Rationale**: Adding `_WRITE` alongside existing `_CREATE` would create two nearly-synonymous permissions with no behavioral distinction, forcing a future cleanup spec just to remove one. The project's additive-only schema policy (never rename or remove enum entries) makes that cleanup costly. Reusing `_CREATE` respects that policy and avoids the duplication.

**Current state of `_CREATE` grants**: these permissions are already granted in the seed to some roles but have never been wired to any endpoint. T-004 must reconcile grants (add to TOURIST/HOST where missing, do not duplicate where already present). The existing role-acceptance tests for EDITOR and ADMIN that assert `_CREATE` remain valid and must not be broken.

## 4. Data model

### 4.1 Table: `entity_comments`

Follows the same conventions as `user_bookmarks` (polymorphic FK, compound index on `entityId + entityType + deletedAt`, soft-delete via `deletedAt`, full audit fields).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, defaultRandom | |
| `entity_type` | EntityTypePgEnum | NOT NULL | Service restricts to POST \| EVENT |
| `entity_id` | uuid | NOT NULL | No FK constraint (polymorphic) |
| `author_id` | uuid | NULLABLE, FK → users (SET NULL on delete) | Registered users only (enforced at service layer); becomes NULL only after the author user is deleted |
| `content` | text | NOT NULL | No maximum length enforced at DB layer; Zod limits to 2000 chars |
| `moderation_state` | ModerationStatusPgEnum | NOT NULL, DEFAULT 'APPROVED' | PENDING \| APPROVED \| REJECTED |
| `created_at` | timestamptz | NOT NULL, defaultNow | |
| `updated_at` | timestamptz | NOT NULL, defaultNow | |
| `created_by_id` | uuid | FK → users (SET NULL) | Audit |
| `updated_by_id` | uuid | FK → users (SET NULL) | Audit |
| `deleted_at` | timestamptz | nullable | Soft-delete marker |
| `deleted_by_id` | uuid | FK → users (SET NULL) | Audit |

**Index**: compound `(entity_id, entity_type, deleted_at)` — identical pattern to `idx_user_bookmarks_entity_active`.

**No `adminInfo` jsonb field** in MVP (not needed; moderation metadata is in-column).

**Trigger**: the existing `set_updated_at` trigger (applied via `apply-postgres-extras.sh`) must cover this table after schema push.

### 4.2 New permissions (PermissionEnum additions)

Four new entries to add to `packages/schemas/src/enums/permission.enum.ts` in the POST and EVENT sections:

| Enum key | String value | What it gates | Status |
|----------|-------------|---------------|--------|
| `POST_COMMENT_CREATE` | `post.comment.create` | Create + delete own comment on a post | **Reused write gate (already exists, line 209)** |
| `POST_COMMENT_VIEW` | `post.comment.view` | Read approved + all comments (admin-level) | New |
| `POST_COMMENT_MODERATE` | `post.comment.moderate` | Approve / reject / hard-delete any post comment | New |
| `EVENT_COMMENT_CREATE` | `event.comment.create` | Create + delete own comment on an event | **Reused write gate (already exists, line 188)** |
| `EVENT_COMMENT_VIEW` | `event.comment.view` | Read approved + all comments (admin-level) | New |
| `EVENT_COMMENT_MODERATE` | `event.comment.moderate` | Approve / reject / hard-delete any event comment | New |

**No `_WRITE` entries**: per RD-9, `_WRITE` variants are NOT added. `_CREATE` serves as the write gate. The four truly new entries are `_VIEW` and `_MODERATE` for POST and EVENT.

**PermissionCategoryEnum**: add `POST_COMMENT = 'POST_COMMENT'` and `EVENT_COMMENT = 'EVENT_COMMENT'` entries.

### 4.3 Role seed assignments

Entries to add to `packages/seed/src/required/rolePermissions.seed.ts`:

| Role | Permissions granted |
|------|-------------------|
| `TOURIST` | `POST_COMMENT_CREATE`, `EVENT_COMMENT_CREATE` |
| `HOST` | `POST_COMMENT_CREATE`, `EVENT_COMMENT_CREATE` |
| `EDITOR` | `POST_COMMENT_CREATE`, `POST_COMMENT_VIEW`, `POST_COMMENT_MODERATE`, `EVENT_COMMENT_CREATE`, `EVENT_COMMENT_VIEW`, `EVENT_COMMENT_MODERATE` |
| `ADMIN` | same as EDITOR |
| `SUPER_ADMIN` | runtime bypass covers all (no seed change needed) |

**Note**: VIEWER and GUEST roles (unauthenticated) receive NO comment permissions. Public comment reads (APPROVED only) are done via the public API tier without a permission gate (see §5).

**Note on `_CREATE` reconciliation**: `POST_COMMENT_CREATE` and `EVENT_COMMENT_CREATE` may already be granted to some roles in the current seed. T-004 must inspect existing grants and add only where missing — do not create duplicate entries. The existing role-acceptance tests for EDITOR (`role-acceptance.editor`) and ADMIN (`role-acceptance.admin-super`) that already assert `_CREATE` remain valid and must not be broken.

## 5. API surface

### 5.1 Three-tier overview

| Tier | URL prefix | Auth | Consumer |
|------|-----------|------|---------|
| Public | `/api/v1/public/...` | None | Web app thread (read APPROVED only) |
| Protected | `/api/v1/protected/...` | Session (Better Auth) | Web app (write + own delete) |
| Admin | `/api/v1/admin/comments/...` | Session + permission | Admin panel |

### 5.2 Public endpoints

**`GET /api/v1/public/posts/:postId/comments`**

- Returns paginated list of APPROVED, non-deleted comments for a post.
- No auth required.
- Query params: `page` (default 1), `pageSize` (default 20, max 50).
- Sorted by `createdAt` ascending (oldest first = natural thread order).
- Response shape per item: `{ id, authorName, content, createdAt }`.
- Returns 404 if `postId` does not match a published post.

**`GET /api/v1/public/events/:eventId/comments`**

- Same contract as above, scoped to events.
- Returns 404 if `eventId` does not match a published event.

### 5.3 Protected endpoints

**`POST /api/v1/protected/posts/:postId/comments`**

- Requires valid session. Requires `POST_COMMENT_CREATE` permission.
- Rate-limited: 5 requests/minute per user (via `createPerRouteRateLimitMiddleware`).
- Body: `{ content: string }` (1–2000 chars, validated by Zod).
- Creates comment with `moderationState: APPROVED`, `authorId` from session.
- Increments `posts.comments` counter atomically in the same service call.
- Returns 201 with the created comment object.
- Returns 401 if no session, 403 if permission missing, 429 if rate limited, 404 if post not found.

**`POST /api/v1/protected/events/:eventId/comments`**

- Same contract as above, scoped to events. No counter update (events has no comments field).

**`DELETE /api/v1/protected/comments/:commentId`**

- Requires valid session.
- Soft-deletes the comment. Only the comment author may delete their own comment (service checks `comment.authorId === actor.id`). Returns 403 if not the author (and not admin — admins use the admin tier).
- Decrements `posts.comments` counter if the deleted comment was for a POST and was APPROVED.
- Returns 204 on success, 404 if not found or already deleted, 403 if not the author.

### 5.4 Admin endpoints

**`GET /api/v1/admin/comments/recent`**

- Required by SPEC-155 EDITOR card H.
- Requires `POST_COMMENT_VIEW` AND `EVENT_COMMENT_VIEW`.
- Query params: `pageSize` (default 10, max 50). No pagination beyond pageSize for this feed endpoint.
- Returns comments across both POST and EVENT entities, sorted by `createdAt` desc.
- Includes all `moderationState` values (APPROVED, PENDING, REJECTED).
- Response shape per item: `{ id, entityType, entityId, content, authorName, moderationState, createdAt }`.

**`GET /api/v1/admin/comments`**

- Full admin list with pagination and filters.
- Requires `POST_COMMENT_VIEW` OR `EVENT_COMMENT_VIEW` (at least one).
- Query params extend `AdminSearchBaseSchema`: `entityType` (POST | EVENT | undefined), `moderationState`, `entityId`, `authorId`, `includeDeleted` (default false), `page`, `pageSize`, `sort`, `search`.
- Returns paginated list with full comment detail.

**`GET /api/v1/admin/comments/:commentId`**

- Requires `POST_COMMENT_VIEW` (if POST) or `EVENT_COMMENT_VIEW` (if EVENT). Service resolves entityType from the stored comment to determine which permission to check.

**`PATCH /api/v1/admin/comments/:commentId/moderation`**

- Requires `POST_COMMENT_MODERATE` or `EVENT_COMMENT_MODERATE` (resolved from stored entityType).
- Body: `{ moderationState: 'APPROVED' | 'REJECTED' }`.
- Updates `moderationState`. If entityType is POST, recomputes `posts.comments` counter (add 1 for REJECTED → APPROVED, subtract 1 for APPROVED → REJECTED).
- Returns 200 with updated comment.

**`DELETE /api/v1/admin/comments/:commentId`** (soft-delete)

- Requires `POST_COMMENT_MODERATE` or `EVENT_COMMENT_MODERATE`.
- Soft-deletes any comment regardless of author.
- Recomputes `posts.comments` if entityType is POST and comment was APPROVED.
- Returns 204.

**`DELETE /api/v1/admin/comments/:commentId/hard`** (hard-delete)

- Requires `POST_COMMENT_MODERATE` or `EVENT_COMMENT_MODERATE`.
- Permanently removes the record. Use with caution; intended for illegal/abusive content.
- Recomputes `posts.comments` if applicable.
- Returns 204.

**`POST /api/v1/admin/comments/:commentId/restore`**

- Requires `POST_COMMENT_MODERATE` or `EVENT_COMMENT_MODERATE`.
- Restores a soft-deleted comment (clears `deletedAt`). Only possible if not hard-deleted.
- Returns 200 with restored comment.

## 6. Frontend

### 6.1 Web (apps/web)

**Technology**: Astro components for static structure. React island (`client:visible`) only for the interactive submit form and optimistic comment list updates.

**Styling**: vanilla CSS / CSS Modules (`*.module.css`). No Tailwind utility classes.

**i18n**: all user-facing strings in `packages/i18n` locale files for `es`, `en`, `pt`. Keys under `comments.*` namespace.

**Post detail page** (`apps/web/src/pages/blog/[slug].astro` or equivalent):
- Thread section rendered below the post content.
- Thread displays APPROVED comments, sorted oldest-first, paginated (load-more or infinite scroll — UX detail for implementation).
- Submit form shown to authenticated users; replaced by "Iniciá sesión para comentar" CTA for guests.
- Existing `posts.comments` counter in the post header is untouched (still rendered from the integer field).

**Event detail page** (`apps/web/src/pages/events/[slug].astro` or equivalent):
- Same thread component reused (parametrized by `entityType` + `entityId`).

**Empty state**: "Sé el primero en comentar" message when thread has zero approved comments.

**Error states**:
- Submit fails (network/API error): inline error message below the form, form content preserved.
- Rate limit (429): "Demasiados comentarios, esperá un momento." message.
- Unauthenticated submit attempt: redirect to login or show login modal (consistent with site convention).

**Loading state**: skeleton placeholder while comments load on first render.

### 6.2 Admin (apps/admin)

**Technology**: TanStack Start file-based routing. TanStack Query for server state. Shadcn UI components. TanStack Form + Zod for forms. Tailwind CSS v4.

**EDITOR card H upgrade** (SPEC-155 dependency):
- Replaces the deferred placeholder with a live feed calling `GET /api/v1/admin/comments/recent`.
- Displays last 10 comments across posts and events.
- Each item shows: entity type badge (POST/EVENT), content excerpt (truncated), author name, `moderationState` badge, relative timestamp.
- Gated by `POST_COMMENT_VIEW AND EVENT_COMMENT_VIEW` (card uses `onMissing: 'hide'` pattern from IA config).

**Moderation queue** (`/admin/comments`):
- Full list route with filters: entity type, moderation state, date range, free-text search.
- Table columns: entity (type + link), content excerpt, author, moderation state, created at, actions.
- Inline actions: Approve, Reject, Delete (soft), with confirmation dialog for hard-delete.
- Bulk moderation: select multiple → approve/reject/delete batch (nice-to-have, can be deferred to follow-up).

**Comment detail page** (`/admin/comments/:id`):
- Full comment content.
- Author info (name, link to user profile).
- Entity link (to the post or event).
- Moderation history (if tracked via `updatedAt` + `updatedById` — no separate audit table in MVP).
- Action buttons: Approve / Reject / Soft-delete / Restore / Hard-delete.

## 7. Acceptance criteria

### Group A — Data integrity

- **AC-1**: Given the schema is applied. When `entity_comments` is inspected. Then it has columns `id`, `entity_type`, `entity_id`, `author_id`, `content`, `moderation_state`, `created_at`, `updated_at`, `created_by_id`, `updated_by_id`, `deleted_at`, `deleted_by_id`, and a compound index on `(entity_id, entity_type, deleted_at)`.
- **AC-2**: Given a new comment is created. When the record is read back. Then `moderation_state` is `'APPROVED'` by default (no explicit value needed from the caller).
- **AC-3**: Given the service receives `entityType: 'ACCOMMODATION'`. When it attempts to create a comment. Then the service returns an error (`INVALID_ENTITY_TYPE` or equivalent) and no record is inserted.
- **AC-4**: Given a soft-deleted comment. When it is queried via the public endpoint. Then it is excluded from results (as if it does not exist).

### Group B — Permissions

- **AC-5**: Given the four new permission entries are added. When `PermissionEnum` is inspected at runtime. Then `POST_COMMENT_VIEW`, `POST_COMMENT_MODERATE`, `EVENT_COMMENT_VIEW`, `EVENT_COMMENT_MODERATE` are all present with their respective string values. Additionally, the pre-existing `POST_COMMENT_CREATE` (`post.comment.create`) and `EVENT_COMMENT_CREATE` (`event.comment.create`) remain present and unmodified.
- **AC-6**: Given a TOURIST role user. When the seed is applied. Then that role includes `POST_COMMENT_CREATE` and `EVENT_COMMENT_CREATE` but does NOT include any `_MODERATE` or `_VIEW` permission from this spec.
- **AC-7**: Given an EDITOR role user. When the seed is applied. Then that role includes all six comment permissions: `POST_COMMENT_CREATE`, `POST_COMMENT_VIEW`, `POST_COMMENT_MODERATE`, `EVENT_COMMENT_CREATE`, `EVENT_COMMENT_VIEW`, `EVENT_COMMENT_MODERATE`.

### Group C — Public endpoints

- **AC-8**: Given a published post with 3 approved comments and 1 rejected comment. When an unauthenticated request hits `GET /api/v1/public/posts/:postId/comments`. Then the response contains exactly 3 items (APPROVED only), sorted oldest-first, with no `moderationState` field exposed in the public response.
- **AC-9**: Given a post that does not exist or is not published. When `GET /api/v1/public/posts/:postId/comments` is called. Then the response is 404.
- **AC-10**: Given a published event with zero approved comments. When `GET /api/v1/public/events/:eventId/comments` is called. Then the response is 200 with an empty items array (not 404).

### Group D — Protected write endpoint

- **AC-11**: Given an authenticated user with `POST_COMMENT_CREATE`. When they POST `{ content: "valid comment" }` to `POST /api/v1/protected/posts/:postId/comments`. Then the response is 201, the comment has `moderationState: 'APPROVED'`, and `posts.comments` is incremented by 1.
- **AC-12**: Given an unauthenticated request. When it hits `POST /api/v1/protected/posts/:postId/comments`. Then the response is 401.
- **AC-13**: Given an authenticated user. When they POST a comment with `content` exceeding 2000 characters. Then the response is 422 (validation error) and no record is inserted.
- **AC-14**: Given an authenticated user with `POST_COMMENT_CREATE`. When they POST 6 comments to the same endpoint within 60 seconds. Then the 6th request receives 429 (rate limited) and no record is inserted.
- **AC-15**: Given an authenticated user who is the author of a comment. When they call `DELETE /api/v1/protected/comments/:commentId`. Then the comment is soft-deleted (204) and `posts.comments` is decremented if applicable.
- **AC-16**: Given an authenticated user who is NOT the author of a comment. When they call `DELETE /api/v1/protected/comments/:commentId`. Then the response is 403.

### Group E — Admin moderation

- **AC-17**: Given an authenticated EDITOR. When they call `GET /api/v1/admin/comments/recent`. Then the response contains up to 10 items sorted by `createdAt` desc, including comments of any `moderationState`, with fields `{ id, entityType, entityId, content, authorName, moderationState, createdAt }`.
- **AC-18**: Given an authenticated user without `POST_COMMENT_VIEW` AND `EVENT_COMMENT_VIEW`. When they call `GET /api/v1/admin/comments/recent`. Then the response is 403.
- **AC-19**: Given an authenticated EDITOR. When they PATCH `{ moderationState: 'REJECTED' }` on an APPROVED post comment. Then the comment's `moderationState` becomes `REJECTED` and `posts.comments` is decremented by 1.
- **AC-20**: Given an authenticated EDITOR. When they PATCH `{ moderationState: 'APPROVED' }` on a REJECTED post comment. Then the comment's `moderationState` becomes `APPROVED` and `posts.comments` is incremented by 1.
- **AC-21**: Given an admin user with `POST_COMMENT_MODERATE`. When they call `DELETE /api/v1/admin/comments/:commentId` (soft-delete). Then any comment (regardless of author) is soft-deleted and the counter is adjusted.
- **AC-22**: Given an admin user with `POST_COMMENT_MODERATE`. When they call `DELETE /api/v1/admin/comments/:commentId/hard`. Then the record is permanently removed from the database.
- **AC-23**: Given a soft-deleted comment. When an admin with `POST_COMMENT_MODERATE` calls `POST /api/v1/admin/comments/:commentId/restore`. Then `deleted_at` and `deleted_by_id` are cleared and the comment reappears in listings.

### Group F — Counter integrity

- **AC-24**: Given a post that starts with `comments = 5`. When 2 new comments are created and 1 existing APPROVED comment is soft-deleted. Then `posts.comments` is 6.
- **AC-25**: Given a post with `comments = 3`. When a comment is moderated from APPROVED to REJECTED. Then `posts.comments` becomes 2. When the same comment is later restored to APPROVED. Then `posts.comments` becomes 3 again.
- **AC-26**: Given an event comment is created or deleted. Then `events` table is NOT modified (no counter field exists).

### Group G — Web frontend

- **AC-27**: Given a visitor browses a published post detail page. When the page renders. Then a comment thread section appears below the post content showing approved comments.
- **AC-28**: Given an authenticated user on a post detail page. When they submit a comment via the form. Then the comment appears in the thread without a full page reload (optimistic or refetch after success).
- **AC-29**: Given an unauthenticated visitor on a post detail page. When they view the comment section. Then the submit form is replaced by a login CTA. No comment can be submitted without authentication.
- **AC-30**: Given a published event with zero approved comments. When a visitor views the event detail page. Then an empty state message is displayed in the comment section (not an error, not blank).

### Group H — Admin panel UI

- **AC-31**: Given SPEC-155 EDITOR card H is wired to this spec's endpoint. When an EDITOR loads their dashboard. Then card H displays the 10 most recent comments (any moderation state) with entity type, excerpt, author, state badge, and timestamp.
- **AC-32**: Given no comments exist yet. When an EDITOR loads card H. Then an empty state is displayed (not an error).
- **AC-33**: Given an EDITOR navigates to `/admin/comments`. When the page loads. Then a filterable, paginated list of all comments is shown with inline Approve / Reject / Delete actions.
- **AC-34**: Given an EDITOR clicks Approve on a REJECTED comment from the moderation queue. When the action completes. Then the comment's state badge updates to APPROVED without a full page reload.

### Group I — i18n

- **AC-35**: Given the i18n package has `es`, `en`, and `pt` locale files. When any user-facing comment string is rendered (thread header, empty state, form placeholder, error messages, action labels). Then all three locales provide a translation (no missing key fallback visible to the user).

### Group J — Tests

- **AC-36**: Given the test suite runs. When unit tests for `EntityCommentService` execute. Then create, soft-delete, moderate, and counter-sync scenarios achieve at least 90% branch coverage.
- **AC-37**: Given the integration test suite runs. When tests call the public + protected + admin comment endpoints against the test DB. Then all AC-8 through AC-26 scenarios have a corresponding test case passing.
- **AC-38**: Given seed tests run. When assertions check `ROLE_PERMISSIONS[RoleEnum.TOURIST]`. Then `POST_COMMENT_CREATE` and `EVENT_COMMENT_CREATE` are present, and `POST_COMMENT_MODERATE` is absent.
- **AC-39**: Given seed tests run. When assertions check `ROLE_PERMISSIONS[RoleEnum.EDITOR]`. Then all six comment permissions are present: `POST_COMMENT_CREATE`, `POST_COMMENT_VIEW`, `POST_COMMENT_MODERATE`, `EVENT_COMMENT_CREATE`, `EVENT_COMMENT_VIEW`, `EVENT_COMMENT_MODERATE`.

## 8. Scope

### In scope

- `entity_comments` table (DB schema + Drizzle model + migration).
- Four new `PermissionEnum` entries (`_VIEW` + `_MODERATE` for POST and EVENT) + two new `PermissionCategoryEnum` entries. Reuse of existing `POST_COMMENT_CREATE` / `EVENT_COMMENT_CREATE` as write gate (no new `_WRITE` entries).
- Role seed assignments for TOURIST, HOST, EDITOR, ADMIN.
- `EntityCommentService` in `packages/service-core` (create, soft-delete own, moderate, list, hard-delete, restore, counter sync).
- `EntityCommentModel` in `packages/db`.
- Zod schemas in `packages/schemas` (base, CRUD, query, HTTP, admin-search, access).
- Public API endpoints: GET comments for post / event.
- Protected API endpoints: POST comment on post / event; DELETE own comment.
- Admin API endpoints: recent feed, list, get, PATCH moderation, soft-delete, hard-delete, restore.
- Web thread component on post detail + event detail pages.
- Web authenticated submit form (React island).
- Admin EDITOR card H upgrade (replaces SPEC-155 placeholder).
- Admin moderation queue page (`/admin/comments`).
- Admin comment detail page (`/admin/comments/:id`).
- i18n strings for `es`, `en`, `pt`.
- `posts.comments` counter sync via service layer.
- `set_updated_at` trigger registration for `entity_comments` in `apply-postgres-extras.sh`.
- Unit + integration tests (≥ 90% coverage on service, ≥ AC-37 on routes).

### Out of scope

- Threaded / nested replies (parentId). See §9.
- Anonymous / guest comments.
- Comment reactions (likes, upvotes).
- Comment editing (update content after creation). Can be added later; no edit endpoint in MVP.
- Notification to EDITOR on new comment arrival.
- ACCOMMODATION or DESTINATION comment endpoints (table supports them; no endpoints or permissions in this spec).
- Rich text / markdown rendering in comments (plain text only in MVP).
- Comment reporting by users (flag for moderation). Future feature.
- Spam detection / automatic moderation (e.g., Akismet).
- Bulk moderation UI (nice-to-have; deferred to follow-up if EDITOR feedback requests it).
- Comment search from the public web (admin search is in scope; web-side search is not).
- Audit log entries per moderation action (the `updatedAt` + `updatedById` fields serve as a lightweight record in MVP).
- Email digest of comments to post/event authors.

## 9. Future evolution

The following items are intentionally deferred. They are listed here so that no current decision forecloses them.

**Threaded replies**: adding a nullable `parent_id uuid FK → entity_comments(id)` column to `entity_comments` would enable one level of replies without a schema rewrite. The flat query used by the public endpoint would need a `parentId IS NULL` filter to return only top-level comments.

**More entity types**: ACCOMMODATION and DESTINATION can be added by: (a) adding `ACCOMMODATION_COMMENT_VIEW/WRITE/MODERATE` and `DESTINATION_COMMENT_VIEW/WRITE/MODERATE` to `PermissionEnum`, (b) extending the service `ALLOWED_ENTITY_TYPES` allowlist, (c) adding public/protected/admin endpoints. No schema migration needed.

**PENDING moderation mode**: if the platform needs pre-moderation, adding a config flag that overrides the DEFAULT from `APPROVED` to `PENDING` on create requires only a service-level change.

**Notifications**: once the notifications system (see `packages/notifications`) supports an `ENTITY_COMMENT_RECEIVED` event type, wiring the service to emit it on create is a small addition.

**Comment analytics**: a `view_count` or engagement metrics field on comments could be added additively.

**Spam / auto-moderation**: a webhook or inline call to an external moderation service (e.g., Perspective API) can be added to the create path as a middleware concern without touching the data model.

## 10. Risks

| Risk | Likelihood | Mitigation |
|------|:---:|---|
| Counter drift: `posts.comments` gets out of sync if service bypassed or direct DB writes occur | Medium | Service enforces counter update via `runWithLoggingAndValidation`. A periodic reconciliation job (recount from `entity_comments`) can be added as a cron if drift is detected in production. AC-24/AC-25/AC-26 test the happy path. |
| `EntityTypePgEnum` constraint: the `entity_type` column accepts all enum values at DB level; invalid types could be inserted if the service check is bypassed | Low | Service validation in `EntityCommentService` is the gate. Integration tests verify that invalid entity types are rejected. DB-level CHECK constraint can be added in a follow-up migration if extra safety is needed. |
| Rate limit bypass: a user rotates sessions or IPs to exceed 5/min | Low | Rate limit is per authenticated user ID (session-bound), not IP. IP-based rate limiting is a platform-level concern outside this spec. |
| SPEC-155 EDITOR card H dependency: card H wiring references the `GET /api/v1/admin/comments/recent` endpoint; if the endpoint schema changes, SPEC-155 card breaks | Low | Endpoint response shape is locked in §5.4. Any breaking change requires a new version path. AC-17 regression-tests the contract. |
| Missing `set_updated_at` trigger: `entity_comments.updated_at` won't auto-update if the trigger is not registered | Medium | Add table to `apply-postgres-extras.sh` as part of T-001. Post-migration checklist includes running the extras script. AC-1 can include a smoke check via integration test. |
| Soft-delete cascade: `author_id` FK is SET NULL on user deletion. A deleted user's comments remain but show null author | Low-Medium | Public response maps null `authorId` to a "[Usuario eliminado]" display name in the service layer. Covered by the response DTO mapping. |

## 11. Dependencies

- **`packages/db` — `ModerationStatusPgEnum`**: already defined in `enums.dbschema.ts` (imported from `@repo/schemas`). Reused as-is.
- **`packages/db` — `EntityTypePgEnum`**: already defined. Reused as-is.
- **`packages/schemas` — `ModerationStatusEnum`**: already defined. Reused as-is.
- **`packages/service-core` — `BaseCrudService`, `Result<T>`, `runWithLoggingAndValidation`**: this spec's service extends these. No changes to the base.
- **`apps/api` — `createPerRouteRateLimitMiddleware`**: already defined in `apps/api/src/middlewares/rate-limit.ts`. Reused as-is.
- **SPEC-155 EDITOR card H**: this spec is a blocker for the card H live feed. SPEC-155 can be deployed with the placeholder and upgraded once SPEC-165 ships.
- **Better Auth session middleware**: already in place for the protected tier. No changes.

## 12. Tasks sketch

The following is a high-level task breakdown by layer. Exact task files are generated separately.

### Layer 0 — Schema & DB

- T-001: Add `entity_comments` table to Drizzle schema (`packages/db/src/schemas/`). Register `set_updated_at` trigger in `apply-postgres-extras.sh`. Generate + apply migration.
- T-002: Implement `EntityCommentModel` in `packages/db/src/models/` extending `BaseModel`.

### Layer 1 — Permissions & seed

- T-003: Add 4 new `PermissionEnum` entries (`POST_COMMENT_VIEW`, `POST_COMMENT_MODERATE`, `EVENT_COMMENT_VIEW`, `EVENT_COMMENT_MODERATE`) + 2 `PermissionCategoryEnum` entries to `packages/schemas/src/enums/permission.enum.ts`. Do NOT add `_WRITE` variants; reuse existing `_CREATE` as write gate (per RD-9).
- T-004: Reconcile role seed grants in `packages/seed/src/required/rolePermissions.seed.ts`. Inspect current grants for `POST_COMMENT_CREATE` / `EVENT_COMMENT_CREATE` and add to TOURIST/HOST/EDITOR/ADMIN only where missing (do not duplicate). Add `_VIEW` + `_MODERATE` grants for EDITOR/ADMIN. Add seed unit tests (AC-38, AC-39).

### Layer 2 — Schemas (packages/schemas)

- T-005: Create `entity-comment` schema files (`base`, `crud`, `query`, `http`, `access`, `admin-search`) in `packages/schemas/src/entities/`.

### Layer 3 — Service core

- T-006: Implement `EntityCommentService` in `packages/service-core/src/services/`. Covers create (with counter sync), soft-delete own, moderate (with counter sync), list (public + admin), get by ID, hard-delete, restore. Validates `entityType` allowlist. Unit tests ≥ 90% branch coverage (AC-36).

### Layer 4 — API (apps/api)

- T-007: Public endpoints — `GET /api/v1/public/posts/:postId/comments` and `GET /api/v1/public/events/:eventId/comments`.
- T-008: Protected endpoints — `POST /api/v1/protected/posts/:postId/comments`, `POST /api/v1/protected/events/:eventId/comments`, `DELETE /api/v1/protected/comments/:commentId`. Wire rate-limit middleware on POST endpoints.
- T-009: Admin endpoints — `GET /api/v1/admin/comments/recent`, `GET /api/v1/admin/comments`, `GET /api/v1/admin/comments/:id`, `PATCH /api/v1/admin/comments/:id/moderation`, `DELETE /api/v1/admin/comments/:id`, `DELETE /api/v1/admin/comments/:id/hard`, `POST /api/v1/admin/comments/:id/restore`.
- T-010: Integration tests for all endpoint groups (AC-37).

### Layer 5 — Web (apps/web)

- T-011: Implement comment thread component (Astro + React island) for post detail page.
- T-012: Implement comment thread component for event detail page (reuse T-011 component).
- T-013: Implement authenticated submit form (React island, rate limit feedback, error states, empty state).

### Layer 6 — Admin (apps/admin)

- T-014: Upgrade EDITOR dashboard card H from placeholder to live feed (wire `GET /api/v1/admin/comments/recent`).
- T-015: Implement moderation queue page (`/admin/comments`) with filters, pagination, inline actions.
- T-016: Implement comment detail page (`/admin/comments/:id`) with full content + moderation actions.

### Layer 7 — i18n

- T-017: Add `comments.*` translation keys to `es`, `en`, and `pt` locale files in `packages/i18n`.

### Dependency order

```
T-001 → T-002
T-003 → T-004
T-001 + T-002 + T-003 → T-005 → T-006
T-006 → T-007 → T-010
T-006 → T-008 → T-010
T-006 → T-009 → T-010
T-010 → T-011 → T-012 → T-013
T-009 → T-014
T-009 → T-015
T-009 → T-016
T-017 (can run in parallel after T-005)
```

## 13. References

- `packages/db/src/schemas/user/user_bookmark.dbschema.ts` — polymorphic FK pattern + compound index + audit fields (this spec's schema MOLDE).
- `packages/schemas/src/enums/moderation-status.enum.ts` — `ModerationStatusEnum` (PENDING/APPROVED/REJECTED). Reused as-is.
- `packages/schemas/src/enums/moderation-status.schema.ts` — `ModerationStatusEnumSchema` (Zod). Reused as-is.
- `packages/db/src/schemas/enums.dbschema.ts` — `EntityTypePgEnum`, `ModerationStatusPgEnum`. Reused as-is.
- `packages/schemas/src/enums/permission.enum.ts` — `POST_COMMENT_CREATE` (line 209) and `EVENT_COMMENT_CREATE` (line 188) confirmed present; reused as write gate per RD-9. `POST_COMMENT_VIEW/MODERATE` and `EVENT_COMMENT_VIEW/MODERATE` confirmed ABSENT (as of 2026-05-30 audit). Four new entries to add.
- `apps/api/src/middlewares/rate-limit.ts` — `createPerRouteRateLimitMiddleware`.
- `apps/api/docs/route-architecture.md` — three-tier route pattern.
- `packages/db/src/schemas/post/post.dbschema.ts` — `posts.comments` integer counter field (line 64). Kept in sync by this spec.
- `.claude/specs/SPEC-155-admin-dashboards-v1/spec.md` — T-009 tombstone; EDITOR card H deferred placeholder referencing this spec.
