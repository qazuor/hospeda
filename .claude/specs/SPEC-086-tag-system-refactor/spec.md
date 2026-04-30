# SPEC-086: Tag System Refactor (Two Subsystems: PostTag + User-Tag)

> **Status**: draft
> **Priority**: P2
> **Complexity**: High
> **Origin**: Product roadmap — user-level tagging need + public taxonomy for SEO + operational tags for moderation
> **Depends on**: None. Self-contained. Unblocks post-SPEC-085 conversation tagging follow-up.
> **Related**: SPEC-085 (messaging — conversation tagging deferred to follow-up that builds on this spec)
> **Breaking change**: Yes. New `post_tags` table. `tags` table refactored. PK on `r_entity_tag` changed. EntityTypeEnum expanded. PermissionEnum expanded.
> **Created**: 2026-04-17
> **Revised**: 2026-04-29 (architectural rewrite per `decisions.md`)
> **Type**: feature + architectural-consistency
> **Source of truth for design decisions**: `.claude/specs/SPEC-086-tag-system-refactor/decisions.md`
> **Source of truth for INTERNAL/SYSTEM tag content**: `.claude/specs/SPEC-086-tag-system-refactor/tag-seeds.md`

---

## Problem Statement

The current tag system is a single global pool of tags with no ownership, no type distinction, and no exposure control. Three concrete problems:

1. **No user-level tagging.** Every user sees and manages the same pool. A user cannot create private tags ("Check later", "VIP client", "Needs follow-up") without polluting the global pool.

2. **No public taxonomy for SEO.** Tags are not differentiated between public-facing categories (URLs like `/blog?tag=gastronomia`) and internal operational labels ("Spam", "Urgente"). Mixing them in one pool leaks internal labels and prevents a clean SEO taxonomy.

3. **No attribution on assignments.** The current `r_entity_tag` records which tag is on which entity, but not who applied it. Two users tagging the same entity with the same tag would collide at the DB level. There is no per-user assignment record.

---

## Architecture Overview

The original spec attempted to solve these problems with a single tag table discriminated by a `type × scope` matrix. That model is rejected. **Two independent subsystems** replace it:

| | **PostTag** | **User-Tag** |
|---|---|---|
| **Purpose** | Public, SEO-driven categorization for blog posts | Per-user organization for admin panel users + admin operational labels |
| **Audience** | Anonymous + authenticated + search engines | Admin panel users only (HOST/EDITOR/ADMIN/SUPER_ADMIN) — never web-public, never regular USER role |
| **Consumed by** | `apps/web` (public pages) + `apps/admin` (CRUD) | `apps/admin` exclusively (D-024) |
| **Created by** | Editors / admins | Admins (INTERNAL/SYSTEM) or admin-panel users for own USER tags |
| **URL exposure** | Yes (slug in URLs like `/blog?tag=guia-de-viaje`) | No |
| **Storage** | New table `post_tags`, join `r_post_post_tag` (no per-user) | Refactored `tags`, refactored `r_entity_tag` (with `assignedById`) |
| **Routes** | Admin CRUD + public read | Admin tier only (no `/protected/*` user-tag routes) |
| **i18n** | None in v1 | None in v1 |

The two subsystems coexist on the same entity. A blog post can have:
- PostTags ("Gastronomía", "Trekking") → public categorization, in URLs
- USER-Tag assignments ("Read later" by user A) → A's private organization

These never collide because they live in different tables with different semantics.

---

## Goals and Non-Goals

### Goals

- A blog post can be categorized via curated PostTags that drive public URL filters and SEO.
- Every user-tag carries a `type`: `INTERNAL` (admin-only), `SYSTEM` (any authenticated user), or `USER` (private to creator).
- USER-tag assignments are per-user with explicit `assignedById` attribution.
- INTERNAL tags are never visible to non-admin users in any surface.
- SYSTEM tags are usable by any authenticated user but never appear in public URLs.
- USER-tag creation is quota-controlled (default 50 ACTIVE per user, configurable).
- Hard delete with confirmation impact count.
- `EntityTypeEnum` expanded with `CONVERSATION`, `REVIEW`, `BILLING_SUBSCRIPTION`, `PAYMENT`.
- All new permissions follow `{ENTITY}_{ACTION}_{SCOPE}` UPPER_CASE.
- Required seeds for INTERNAL and SYSTEM user-tags + PostTags. Example seeds for non-super-admin user roles.

### Non-Goals

- Tag categories or hierarchy (PostTag is flat in v1).
- i18n on tag names (PostTag or User-Tag).
- Tag merge operations.
- Bulk tag UI operations.
- Tag usage analytics beyond what `getPopularTags` already exposes.
- ML-based tag suggestions.
- Wiring conversation tagging in SPEC-085 (deferred to follow-up).
- Migration plan for production data. Hospeda runs push-only against ephemeral dev DB; the refactor applies via `pnpm db:fresh-dev`.

---

## Actors

- **Anonymous visitor**: Sees PostTags on public post pages and PostTag-filtered listings. Never sees user-tags.
- **Authenticated user (regular, e.g. host)**: Creates and manages own USER tags. Applies SYSTEM tags or own USER tags to entities they can view.
- **Editor / Admin**: Manages SYSTEM and INTERNAL user-tags. Manages PostTags. Applies INTERNAL tags to entities.
- **Super-admin**: All admin powers + moderation of USER tags (`TAG_USER_DELETE_ANY`, `TAG_VIEW_ALL_USER_TAGS`) + cross-user attribution view (`TAG_VIEW_ALL_ASSIGNMENTS`).
- **System actor**: A reserved system user UUID used as `assignedById` for seed data, cron jobs, webhooks, and other automated tag assignments.

---

## Current State (As-Is)

The current `tags` table in `packages/db/src/schemas/tag/tag.dbschema.ts`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `slug` | text NOT NULL UNIQUE | Required and unique for ALL tags |
| `color` | TagColorPgEnum | |
| `icon` | text nullable | |
| `notes` | text nullable | |
| `lifecycleState` | LifecycleStatusPgEnum | Default ACTIVE |
| Audit fields | timestamps + uuid FKs | Standard |

The `r_entity_tag` join table has PK `(tagId, entityId, entityType)` with no ownership, scope, or attribution.

`EntityTypeEnum` currently has five values: `ACCOMMODATION`, `DESTINATION`, `USER`, `POST`, `EVENT`.

`TagService` extends `BaseCrudRelatedService` and treats the pool as shared and global.

There are **43 existing tag JSON seed files** in `packages/seed/src/data/tag/` (e.g., `gastronomia`, `naturaleza`, `termas`). After this refactor, these seeds will be reclassified into PostTag and/or user-tag seeds based on their intended use. Reclassification is part of the seed work in this spec.

---

## PostTag Subsystem

### Domain Model

PostTags are flat (no hierarchy), single-language, and admin-curated. They drive public blog post categorization and SEO.

A post can have **multiple** PostTags. There is no per-user attribution on PostTag assignments — they are assigned by an editor/admin and apply globally to the post.

### Schema

#### `post_tags` (new table)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | |
| `name` | text | No | Unique |
| `slug` | text | No | Unique, lowercase, URL-safe |
| `color` | TagColorPgEnum | No | |
| `icon` | text | Yes | |
| `description` | text | Yes | |
| `lifecycleState` | LifecycleStatusPgEnum | No | Default ACTIVE |
| Audit fields | timestamps + uuid FKs | per field | Standard |

Indexes:
- `post_tags_name_uq` (unique) on `name`.
- `post_tags_slug_uq` (unique) on `slug`.
- `post_tags_lifecycle_idx` on `lifecycleState`.

#### `r_post_post_tag` (new table)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `postId` | uuid FK to `posts.id` | No | CASCADE on delete |
| `postTagId` | uuid FK to `post_tags.id` | No | CASCADE on delete |

PK: `(postId, postTagId)`. **No** per-user attribution.

### Visibility

- **Anonymous**: Sees ACTIVE PostTags on public post pages. Sees public listing filtered by PostTag slug.
- **Authenticated user**: Same as anonymous.
- **Admin with `POST_TAG_VIEW`**: Sees all PostTags including INACTIVE/ARCHIVED.

### Public URL Exposure

`/blog?tag=gastronomia` resolves to the PostTag with slug `gastronomia` and lifecycle `ACTIVE`. Inactive or archived slugs return empty list or 404 (implementation choice). No internal label is ever leaked because PostTag is a separate system from internal user-tags.

### Routes

```
# Admin
GET    /api/v1/admin/posts/tags                  POST_TAG_VIEW       List all PostTags
POST   /api/v1/admin/posts/tags                  POST_TAG_CREATE     Create
GET    /api/v1/admin/posts/tags/:id              POST_TAG_VIEW       Get one
PATCH  /api/v1/admin/posts/tags/:id              POST_TAG_UPDATE     Update
GET    /api/v1/admin/posts/tags/:id/impact       POST_TAG_VIEW       Count of posts using this tag
DELETE /api/v1/admin/posts/tags/:id              POST_TAG_DELETE     Hard delete
POST   /api/v1/admin/posts/:postId/tags          POST_TAG_ASSIGN     Set PostTags on a post
DELETE /api/v1/admin/posts/:postId/tags/:tagId   POST_TAG_ASSIGN     Remove a PostTag from a post

# Public
GET    /api/v1/public/posts/tags                  none               List ACTIVE PostTags
GET    /api/v1/public/posts/tags?withCounts=true  none               Same + usageCount per tag
```

Public endpoint:
- No pagination. Realistic volume is 50–200 PostTags.
- `Cache-Control: public, max-age=600` (10 minutes).
- `withCounts=true` adds `usageCount: number`. Off by default.

---

## User-Tag Subsystem

### Domain Model

User-tags are organizational tools, never public. Three types form a single dimension:

| Type | Created by | Usable by | Notes |
|------|-----------|-----------|-------|
| `INTERNAL` | Admin / seed | Admin / super-admin only | Operational labels: "Spam", "Fraud", "Urgente" |
| `SYSTEM` | Admin / seed | Any authenticated user | Shared organizational tags everyone benefits from |
| `USER` | The user | The owner only | Private personal organization |

There is no `scope` field. User-tags do not have public URLs, period. The previous `slug` column is removed from this subsystem.

### Service-Layer Invariants

Enforced before any DB write:

1. `type = USER` ⇒ `ownerId NOT NULL`.
2. `type IN (INTERNAL, SYSTEM)` ⇒ `ownerId IS NULL`.
3. Cross-type name collision: a USER tag with the same `name` as any existing INTERNAL or SYSTEM tag is rejected with a 409 conflict (service-layer enforced; not a DB constraint).
4. USER tag creation respects per-user quota (D-021).

### Schema

#### `tags` (refactored)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | |
| `name` | text | No | |
| `color` | TagColorPgEnum | No | |
| `icon` | text | Yes | |
| `description` | text | Yes | Replaces `notes` |
| `type` | TagTypePgEnum | No | `INTERNAL` / `SYSTEM` / `USER` |
| `ownerId` | uuid FK to `users.id` | Yes | NULL for INTERNAL+SYSTEM, required for USER. CASCADE on delete. |
| `lifecycleState` | LifecycleStatusPgEnum | No | Default ACTIVE |
| Audit fields | timestamps + uuid FKs | per field | Standard |

**Removed columns**: `slug` (no public URL on user-tags), `notes` (renamed to `description`).

Unique indexes (partial):
- `tags_internal_name_uq` (unique) on `name` WHERE `type = 'INTERNAL'`.
- `tags_system_name_uq` (unique) on `name` WHERE `type = 'SYSTEM'`.
- `tags_user_name_uq` (unique) on `(ownerId, name)` WHERE `type = 'USER'`.

Other indexes:
- `tags_type_idx` on `type`.
- `tags_owner_id_idx` on `ownerId`.
- `tags_lifecycle_idx` on `lifecycleState`.

#### `r_entity_tag` (refactored)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `tagId` | uuid FK to `tags.id` | No | CASCADE on delete |
| `entityId` | uuid | No | |
| `entityType` | EntityTypePgEnum | No | |
| `assignedById` | uuid FK to `users.id` | No | The user (or system user) who applied the assignment. CASCADE on user delete. |

**New PK**: `(tagId, entityId, entityType, assignedById)`.

Indexes:
- `r_entity_tag_assigned_by_idx` on `assignedById`.
- `r_entity_tag_entity_idx` on `(entityType, entityId)`.

### Visibility Rules

#### Picker (which tags an actor can apply)

| Actor | Picker shows |
|-------|-------------|
| Anonymous | N/A |
| Authenticated user A | `SYSTEM` (ACTIVE) + A's own `USER` (ACTIVE) |
| Admin with `TAG_INTERNAL_VIEW` | `INTERNAL` + `SYSTEM` + own `USER` (all ACTIVE) |
| Super-admin moderation | Separate moderation UI (not the picker) |

#### Entity tag list (which tags an actor sees on a given entity)

| Actor viewing entity | Sees |
|---|---|
| Anonymous | Nothing from this subsystem |
| Authenticated user A | Only assignments where `assignedById = A.id` |
| Admin with `TAG_VIEW_ALL_ASSIGNMENTS` | All assignments with attribution (assigning user shown) |

User A applying a SYSTEM tag to entity X creates A's own row. If user B independently applies the same SYSTEM tag to X, that's B's row — separate, with `assignedById = B.id`. Each user sees only their own assignments.

### Permission to Assign Requires Permission to See

Before any insert into `r_entity_tag`:
1. The tag exists.
2. The tag is in the actor's picker visibility (above).
3. The actor has read access to the target entity (D-009 — entity-level access check).

Examples:
- Regular user assigns INTERNAL tag → rejected (not in picker).
- Regular user assigns another user's USER tag by ID → rejected (not in picker).
- Regular user assigns SYSTEM tag to an accommodation they cannot view → rejected (no entity access).

### Quota

- Default: 50 ACTIVE USER tags per user.
- Env var: `HOSPEDA_TAG_USER_QUOTA_PER_USER` (integer).
- Falls back to 50 if unset or invalid.
- Counts only `type = USER` AND `lifecycleState = ACTIVE`.
- Concurrent-create race protected by PostgreSQL advisory lock keyed on `userId` (pattern from SPEC-064 in `@repo/db`).

### Cascade on User Delete

`tags.ownerId` FK uses `ON DELETE CASCADE`. When a user is hard-deleted:
1. All their USER tags are deleted (cascade from `users` to `tags`).
2. All assignments referencing those tags are deleted (cascade from `tags.id` to `r_entity_tag.tagId`).
3. Any assignments where the deleted user was `assignedById` (regardless of tag type) are also deleted (cascade from `users.id` to `r_entity_tag.assignedById`).

No orphans, no NULL violations.

### System User for Automated Assignments

A reserved system user is seeded with a fixed UUID. Used as `assignedById` for:
- Initial seed assignments.
- Cron-job-driven tagging (e.g., auto-tag abandoned drafts as INTERNAL "Abandoned").
- Webhook-driven tagging (e.g., billing event auto-tags subscription).

Constant: `SYSTEM_USER_ID` exported from a shared location (`@repo/db/constants` or equivalent). The system user has a non-loginable account state.

---

## Lifecycle State Machine

Both subsystems use the existing `LifecycleStatusEnum` (`ACTIVE`, `INACTIVE`, `ARCHIVED`). Standard transitions:

```
ACTIVE   → INACTIVE  (deactivate, hidden from picker)
ACTIVE   → ARCHIVED  (retire)
INACTIVE → ACTIVE
INACTIVE → ARCHIVED
ARCHIVED → ACTIVE
ARCHIVED → INACTIVE
```

- USER tag quota counts only `ACTIVE`.
- Pickers show only `ACTIVE` tags.
- The user manager UI shows all states (ACTIVE, INACTIVE, ARCHIVED) with visual distinction so users have history visibility.
- Public PostTag listings show only `ACTIVE`.

Hard-deleted tags are not in the lifecycle state machine. Deleted is permanent.

---

## Delete Semantics

Hard delete only, in both subsystems.

### Cascade

DB-level FK cascades remove all dependent rows when a tag is deleted. No service-layer cascade logic needed.

### Confirmation Flow

Two-step UX:
1. UI calls `GET .../:id/impact` to fetch the count of affected rows.
2. UI displays count in a confirmation dialog.
3. On confirm, UI calls `DELETE .../:id`.

Suggested UI copy:

- SYSTEM/INTERNAL: "You are about to permanently delete '{name}'. This will remove it from {N} entities across the platform. This action cannot be undone."
- USER (own): "You are about to permanently delete '{name}'. This will remove it from {N} of your tagged entities."
- PostTag: "You are about to permanently delete '{name}'. This will remove it from {N} posts and may affect SEO. This action cannot be undone."

### Who Can Delete

| Tag | Permission |
|---|---|
| INTERNAL | `TAG_INTERNAL_DELETE` |
| SYSTEM | `TAG_SYSTEM_DELETE` |
| USER (own) | `TAG_USER_DELETE_OWN` |
| USER (any) | `TAG_USER_DELETE_ANY` (super-admin) |
| PostTag | `POST_TAG_DELETE` |

There is no `TAG_USER_UPDATE_ANY`. Super-admin moderation of USER tags is delete-only.

---

## User Stories

### US-001: Regular user creates a personal USER tag

**Priority**: Must-have

#### AC-001-01: Creation succeeds with valid USER input
Given an authenticated user A with `TAG_USER_CREATE`,
When A creates a tag with `type = USER` and a unique name not used by SYSTEM/INTERNAL tags,
Then the tag is created with `ownerId = A.id`,
And the tag does not appear in any other user's picker.

#### AC-001-02: Creation fails when name collides with SYSTEM or INTERNAL tag
Given a SYSTEM tag named "Gastronomía" exists,
When A attempts to create a USER tag also named "Gastronomía",
Then the API returns 409,
And the error explains the name is reserved.

#### AC-001-03: Creation fails when user exceeds quota
Given A has 50 ACTIVE USER tags (or the configured quota),
When A attempts another USER tag,
Then the API returns a quota-exceeded error,
And no tag is created.

#### AC-001-04: Concurrent quota race is prevented
Given A has 49 ACTIVE USER tags and submits 2 simultaneous create requests,
When both reach the service,
Then exactly 50 tags exist after both complete (one succeeds, one fails),
Verifying the advisory lock works.

---

### US-002: Regular user tags an entity with their own USER tag

**Priority**: Must-have

#### AC-002-01: Assignment recorded with attribution
Given user A has USER tag "VIP" and is viewing accommodation X (which A can read),
When A applies "VIP" to X,
Then `r_entity_tag` row is created with `tagId = VIP.id`, `entityId = X.id`, `entityType = ACCOMMODATION`, `assignedById = A.id`.

#### AC-002-02: Other user does not see A's assignment
Given user A has applied "VIP" to X,
When user B views X's tags,
Then "VIP" is not in B's view.

#### AC-002-03: Two users independently apply the same SYSTEM tag
Given SYSTEM tag "Pet-friendly",
When A and B both apply it to restaurant R,
Then two rows exist with different `assignedById`.

#### AC-002-04: Assignment fails on inaccessible entity
Given accommodation Z is private and A cannot view it,
When A attempts to apply any tag to Z,
Then the API returns 403.

#### AC-002-05: Assignment fails on tag not in picker
Given INTERNAL tag "Spam" exists and A is a regular user,
When A attempts to apply "Spam" to entity X,
Then the API returns 403.

---

### US-003: Regular user manages personal tag pool

**Priority**: Must-have

#### AC-003-01: Sees only own tags in manager
Given users A and B have their own USER tags,
When A opens the personal tag manager,
Then A sees only A's tags.

#### AC-003-02: Deletes own tag with confirmation
Given A has a USER tag applied to 4 entities,
When A initiates deletion and confirms after seeing impact count of 4,
Then the tag and all 4 assignments are removed.

#### AC-003-03: Quota indicator reflects state
Given A has 38/50 ACTIVE USER tags,
When A views the manager,
Then "38 / 50" is shown,
And create is enabled.

#### AC-003-04: Manager shows all lifecycle states with distinction
Given A has 5 ACTIVE, 2 INACTIVE, 1 ARCHIVED USER tags,
When A views the manager,
Then all 8 are visible with visual distinction by lifecycle.

---

### US-004: Admin manages SYSTEM and INTERNAL tags

**Priority**: Must-have

#### AC-004-01: Admin creates SYSTEM tag
Given admin with `TAG_SYSTEM_CREATE`,
When admin creates `type = SYSTEM`, `name = "Pet-friendly"`,
Then tag is created with `ownerId = NULL`,
And appears in any authenticated user's picker.

#### AC-004-02: Admin creates INTERNAL tag
Given admin with `TAG_INTERNAL_CREATE`,
When admin creates `type = INTERNAL`, `name = "Spam"`,
Then tag is created with `ownerId = NULL`,
And does NOT appear in regular user pickers.

#### AC-004-03: Admin deletes SYSTEM tag with confirmation
Given SYSTEM "Pet-friendly" applied 120 times,
When admin opens delete flow,
Then UI shows impact count 120 before confirming.

---

### US-005: Editor manages PostTags and assigns them to posts

**Priority**: Must-have

#### AC-005-01: Editor creates PostTag with required slug
Given editor with `POST_TAG_CREATE`,
When editor creates `name = "Gastronomía"`, `slug = "gastronomia"`,
Then PostTag is created and unique slug enforced.

#### AC-005-02: Duplicate slug rejected
Given PostTag with slug "gastronomia" exists,
When editor creates another with same slug,
Then API returns 409.

#### AC-005-03: Editor assigns multiple PostTags to a post
Given post P and PostTags ["Gastronomía", "Trekking"],
When editor assigns both to P,
Then 2 rows exist in `r_post_post_tag` for post P.

---

### US-006: Anonymous visitor browses public PostTag taxonomy

**Priority**: Must-have

#### AC-006-01: Public listing returns only ACTIVE PostTags
Given several PostTags with mixed lifecycle states,
When anonymous calls `GET /api/v1/public/posts/tags`,
Then only ACTIVE PostTags are returned.

#### AC-006-02: Public URL filter works on PostTag slug
Given PostTag "Gastronomía" with slug "gastronomia" applied to 3 posts,
When anonymous accesses `/blog?tag=gastronomia`,
Then those 3 posts are listed.

#### AC-006-03: Non-existent slug returns empty or 404
Given no PostTag with slug "spam" exists,
When anonymous accesses `/blog?tag=spam`,
Then result is empty or 404,
And no internal label is leaked (because INTERNAL is a separate subsystem).

---

### US-007: Super-admin views all assignments with attribution

**Priority**: Must-have

#### AC-007-01: All assignments visible with attribution
Given entity X with assignments by users A, B,
When super-admin with `TAG_VIEW_ALL_ASSIGNMENTS` views X via admin endpoint,
Then all assignments appear with assigning user's identifier.

#### AC-007-02: Without permission, only own assignments visible
Given a regular admin without `TAG_VIEW_ALL_ASSIGNMENTS`,
When they call the standard entity-tag endpoint,
Then only their own assignments are returned.

---

### US-008: Super-admin moderates USER tags

**Priority**: Must-have

#### AC-008-01: Browse all USER tags
Given users A, B, C have USER tags,
When super-admin with `TAG_VIEW_ALL_USER_TAGS` opens moderation view,
Then all USER tags across users are shown with owner identifier.

#### AC-008-02: Delete any USER tag
Given user B has an abusive USER tag,
When super-admin with `TAG_USER_DELETE_ANY` deletes it,
Then tag is permanently removed,
And all B's assignments referencing it are removed.

---

## UX Considerations

### Tag Picker (User-Tag system, admin panel only)

- Searchable dropdown used wherever an entity can be tagged within the admin panel (D-024).
- Loads SYSTEM (ACTIVE) tags + actor's own USER (ACTIVE) tags. Admins also see INTERNAL.
- Search: substring match on `name` (case-insensitive).
- Results grouped: "Sistema (SYSTEM)" → "Internos (INTERNAL, admins)" → "Tus tags (USER)".
- Bottom: "+ Crear tag personal" → opens inline form (name, color, optional description).
- If at quota: "+ Crear" replaced by quota-reached notice.
- Already applied (by current actor) tags appear checked.
- **Not present in `apps/web`**. Regular USER-role visitors do not see this picker.

### PostTag Picker (admin only, on post edit page)

- Multi-select of ACTIVE PostTags.
- No quota.
- Search by name.
- "+ Create new PostTag" requires `POST_TAG_CREATE`.

### Admin Tag Management

Three sections:
1. **PostTags**: standard CRUD.
2. **System & Internal Tags** (`tags` table): filterable by `type` and lifecycle.
3. **User Tag Moderation**: visible only with `TAG_VIEW_ALL_USER_TAGS`. Grouped by owner. Read + delete only.

### Own-Tag Manager (admin panel account area)

Lives in the admin panel under the user's own account/settings area. Available to any admin-panel user (HOST/EDITOR/ADMIN/SUPER_ADMIN).

- Lists all of the actor's USER tags (ACTIVE + INACTIVE + ARCHIVED with visual distinction).
- Quota indicator bar (active count / limit).
- Per-tag row: name, color, applied-to count, edit, delete.
- Delete shows impact count before confirmation.

This page does NOT exist in the web public app (D-024).

### Empty States

- Picker no results: "No tags found matching '{query}'." + "Create '{query}' as a new personal tag" if not at quota.
- User manager empty: "You have not created any personal tags yet." + CTA.
- Admin lists empty: standard empty CTAs.

### Error States

- Quota exceeded: inline error near form. "You have reached your limit of {N} personal tags."
- Name conflict: "The name '{name}' is already used by a system tag."
- Inaccessible entity: "You cannot tag this entity."
- INTERNAL tag attempted by regular user: "This tag is not available."

### Accessibility

- Pickers keyboard-navigable (arrows, Enter, Escape).
- Screen reader: "Tag picker, {N} tags available."
- Quota indicator: `aria-label="Tag usage: {used} of {total}"`.
- Delete confirms: focus trap, primary action confirms.

---

## API Surface

### PostTag — Admin

```
GET    /api/v1/admin/posts/tags                  POST_TAG_VIEW
POST   /api/v1/admin/posts/tags                  POST_TAG_CREATE
GET    /api/v1/admin/posts/tags/:id              POST_TAG_VIEW
PATCH  /api/v1/admin/posts/tags/:id              POST_TAG_UPDATE
GET    /api/v1/admin/posts/tags/:id/impact       POST_TAG_VIEW
DELETE /api/v1/admin/posts/tags/:id              POST_TAG_DELETE
POST   /api/v1/admin/posts/:postId/tags          POST_TAG_ASSIGN
DELETE /api/v1/admin/posts/:postId/tags/:tagId   POST_TAG_ASSIGN
```

### PostTag — Public

```
GET /api/v1/public/posts/tags                    none
GET /api/v1/public/posts/tags?withCounts=true    none
```

### User-Tag — Admin

```
# INTERNAL CRUD
GET    /api/v1/admin/tags/internal              TAG_INTERNAL_VIEW
POST   /api/v1/admin/tags/internal              TAG_INTERNAL_CREATE
GET    /api/v1/admin/tags/internal/:id          TAG_INTERNAL_VIEW
PATCH  /api/v1/admin/tags/internal/:id          TAG_INTERNAL_UPDATE
GET    /api/v1/admin/tags/internal/:id/impact   TAG_INTERNAL_VIEW
DELETE /api/v1/admin/tags/internal/:id          TAG_INTERNAL_DELETE

# SYSTEM CRUD
GET    /api/v1/admin/tags/system                TAG_SYSTEM_VIEW
POST   /api/v1/admin/tags/system                TAG_SYSTEM_CREATE
GET    /api/v1/admin/tags/system/:id            TAG_SYSTEM_VIEW
PATCH  /api/v1/admin/tags/system/:id            TAG_SYSTEM_UPDATE
GET    /api/v1/admin/tags/system/:id/impact     TAG_SYSTEM_VIEW
DELETE /api/v1/admin/tags/system/:id            TAG_SYSTEM_DELETE

# USER moderation
GET    /api/v1/admin/tags/user                  TAG_VIEW_ALL_USER_TAGS
DELETE /api/v1/admin/tags/user/:id              TAG_USER_DELETE_ANY

# Cross-user attribution view
GET    /api/v1/admin/entities/:type/:id/tags    TAG_VIEW_ALL_ASSIGNMENTS
```

### User-Tag — Own CRUD (admin tier)

Per D-024, user-tag flows live entirely under `/admin/*`. The previously planned `/protected/tags/*` tier is removed. Admin panel auth gates the tier; permissions distinguish own vs all.

```
# Own USER CRUD (any admin-panel user with TAG_USER_*_OWN)
GET    /api/v1/admin/tags/own                       TAG_USER_VIEW_OWN
POST   /api/v1/admin/tags/own                       TAG_USER_CREATE
PATCH  /api/v1/admin/tags/own/:id                   TAG_USER_UPDATE_OWN
GET    /api/v1/admin/tags/own/:id/impact            TAG_USER_VIEW_OWN
DELETE /api/v1/admin/tags/own/:id                   TAG_USER_DELETE_OWN

# Entity assignment (any admin-panel user)
GET    /api/v1/admin/entities/:type/:id/tags/own         TAG_ASSIGN_VIEW
POST   /api/v1/admin/entities/:type/:id/tags             TAG_ASSIGN_ADD
DELETE /api/v1/admin/entities/:type/:id/tags/:tagId      TAG_ASSIGN_REMOVE
```

The `/admin/entities/:type/:id/tags` (no `/own` suffix) is the **super-admin attribution view** with `TAG_VIEW_ALL_ASSIGNMENTS`, distinct from `/admin/entities/:type/:id/tags/own` which returns only the calling actor's assignments.

---

## Permissions

All new permissions added to `PermissionEnum` in `packages/schemas/src/enums/permission.enum.ts`.

### User-Tag system

| Permission | Holder | Description |
|---|---|---|
| `TAG_INTERNAL_CREATE` | Admin | Create INTERNAL tags |
| `TAG_INTERNAL_UPDATE` | Admin | Update INTERNAL tags |
| `TAG_INTERNAL_DELETE` | Admin | Delete INTERNAL tags |
| `TAG_INTERNAL_VIEW` | Admin | View INTERNAL tags in picker and admin UI |
| `TAG_INTERNAL_ASSIGN` | Admin | Apply INTERNAL tags to entities |
| `TAG_SYSTEM_CREATE` | Admin | Create SYSTEM tags |
| `TAG_SYSTEM_UPDATE` | Admin | Update SYSTEM tags |
| `TAG_SYSTEM_DELETE` | Admin | Delete SYSTEM tags |
| `TAG_SYSTEM_VIEW` | Admin | View SYSTEM tags in admin context |
| `TAG_USER_CREATE` | All authenticated | Create own USER tag |
| `TAG_USER_UPDATE_OWN` | All authenticated | Update own USER tag |
| `TAG_USER_DELETE_OWN` | All authenticated | Delete own USER tag |
| `TAG_USER_VIEW_OWN` | All authenticated | View own USER tag pool |
| `TAG_USER_DELETE_ANY` | Super-admin | Delete any user's USER tag |
| `TAG_VIEW_ALL_USER_TAGS` | Super-admin | Browse all USER tags |
| `TAG_VIEW_ALL_ASSIGNMENTS` | Super-admin | View all assignments with attribution |
| `TAG_ASSIGN_VIEW` | All authenticated | View own assignments on any entity |
| `TAG_ASSIGN_ADD` | All authenticated | Apply a visible tag to an accessible entity |
| `TAG_ASSIGN_REMOVE` | All authenticated | Remove own assignment |

### PostTag system

| Permission | Holder | Description |
|---|---|---|
| `POST_TAG_CREATE` | Admin / editor | Create PostTag |
| `POST_TAG_UPDATE` | Admin / editor | Update PostTag |
| `POST_TAG_DELETE` | Admin | Delete PostTag |
| `POST_TAG_VIEW` | Admin / editor | View PostTag in admin context |
| `POST_TAG_ASSIGN` | Admin / editor | Assign / unassign PostTags on a post |

Public read of PostTag does not require a permission.

---

## EntityTypeEnum Expansion

Add four values to `EntityTypeEnum`:

| Value | Purpose | Wired in this spec |
|---|---|---|
| `CONVERSATION` | Ready for post-SPEC-085 follow-up | No (infrastructure only) |
| `REVIEW` | Tagging of review entities by operators | Yes |
| `BILLING_SUBSCRIPTION` | Billing-context tagging by billing admins | Yes |
| `PAYMENT` | Payment-record tagging by billing admins | Yes |

`POST` remains in `EntityTypeEnum` and remains valid for `r_entity_tag` — users may apply USER tags to posts for personal organization. PostTags on posts are a separate system.

Updates land in three locations:
1. `packages/schemas/src/enums/entity-type.enum.ts`
2. `packages/db/src/schemas/enums.dbschema.ts` (pgEnum)
3. Hospeda runs push-only with fresh DB, so no separate `ALTER TYPE` migration is required.

---

## i18n

A new `tags` namespace is added to `@repo/i18n` covering both subsystems (PostTag UI is admin-side only, `tags` namespace covers user-facing strings).

- `packages/i18n/src/locales/es/tags.json` (primary, Argentina default)
- `packages/i18n/src/locales/en/tags.json`
- `packages/i18n/src/locales/pt/tags.json`

Key groups:

| Key group | Contents |
|---|---|
| `tags.type.*` | Display names for INTERNAL, SYSTEM, USER |
| `tags.lifecycle.*` | Display names for ACTIVE/INACTIVE/ARCHIVED (or reuse shared keys) |
| `tags.errors.*` | Quota exceeded, name conflict, inaccessible entity, not visible |
| `tags.picker.*` | Picker UI strings (groups, create CTA, search placeholder) |
| `tags.manager.*` | User tag manager strings |
| `tags.admin.*` | Admin management panel strings |
| `tags.delete.*` | Confirmation dialog with dynamic impact count |
| `postTags.admin.*` | PostTag admin UI strings |

PostTag content (name, slug, description) is **not** translated in v1 — single language only.

---

## Seeds

The seed phase produces required seeds (always run) and example seeds (dev/staging fixtures). Two distinct purposes:

- **Required seeds** establish the platform's operational baseline: tags admins need on day one.
- **Example seeds** populate realistic dev/staging data for testing UX and demos.

The 43 existing tag JSON files in `packages/seed/src/data/tag/` are **reclassified** as part of this work. Each is reviewed and assigned to one of: PostTag, SYSTEM user-tag, or removed.

### Required Seeds

Run via `pnpm db:seed` in all environments (dev, staging, prod-eventual).

#### R-1 — System User

Seed the reserved system user with fixed UUID `SYSTEM_USER_ID`.

- Role: `SYSTEM` (a new role added to the role enum, non-loginable).
- Used as `assignedById` for all subsequent seed assignments and runtime automated assignments.
- Idempotent: created only if not present.

#### R-2 — INTERNAL user-tags (operational labels)

The canonical content list lives in **`tag-seeds.md`** (companion document). That doc defines the full set of INTERNAL tags, their target entity types, suggested colors, and applier types.

All seeded with `type = INTERNAL`, `ownerId = NULL`, `lifecycleState = ACTIVE`, `createdById = SYSTEM_USER_ID`.

The seed implementation reads from `tag-seeds.md` (or its derived JSON files under `packages/seed/src/data/tag/internal-*.json`) and inserts each entry. If the tag list in `tag-seeds.md` changes, seed JSON files and seed tasks are updated to match — `tag-seeds.md` is the single source of truth for INTERNAL content.

#### R-3 — SYSTEM user-tags (shared labels)

The canonical content list lives in **`tag-seeds.md`** (companion document). That doc defines the full set of SYSTEM tags, their target entity types, suggested colors, and applier types.

All seeded with `type = SYSTEM`, `ownerId = NULL`, `lifecycleState = ACTIVE`, `createdById = SYSTEM_USER_ID`.

The seed implementation reads from `tag-seeds.md` (or its derived JSON files under `packages/seed/src/data/tag/system-*.json`) and inserts each entry. If the tag list in `tag-seeds.md` changes, seed JSON files and seed tasks are updated to match — `tag-seeds.md` is the single source of truth for SYSTEM content.

#### R-4 — PostTags (public taxonomy)

A baseline set of PostTags for blog content categorization. Sourced from reclassification of the existing 43 tag JSON files. Suggested public taxonomy after review:

- Travel themes: `Naturaleza`, `Aventura`, `Gastronomía`, `Cultura`, `Historia`, `Relax`, `Familia`, `Vida nocturna`
- Activities: `Senderismo`, `Pesca`, `Kayak`, `Camping`, `Termas`, `Ciclismo`, `Deportes acuáticos`, `Yoga`
- Geographic: `Río Paraná`, `Río Uruguay`, `Delta`, `Entre Ríos`, `Litoral`
- Seasonal: `Verano`, `Invierno`

Each seeded with `name`, `slug` (URL-safe), `color`, `description`, `lifecycleState = ACTIVE`. The implementation team reviews each of the 43 existing tag JSONs and decides: (a) keep as PostTag, (b) keep as SYSTEM user-tag, (c) drop. The above is a starting suggestion, not exhaustive.

### Example Seeds

Run only with the example seed flag (dev/staging only). Provide realistic data for testing UX flows.

#### E-1 — USER tags for non-super-admin test users

For each test user with role `HOST`, `EDITOR`, or `ADMIN` already seeded, create a small set of example USER tags so the user manager UI and the picker have realistic personal tags.

Suggested per-user example tags:

- HOST role: `Reservar después`, `Cliente VIP`, `Necesita seguimiento`, `Para verano`
- EDITOR role: `Pendiente edición`, `Para destacar`, `Verificar fuentes`, `Idea para post`
- ADMIN role: `Revisar`, `Pendiente decisión`, `Caso de prueba`, `Para reunión`

All seeded with `type = USER`, `ownerId = <test-user-id>`, `lifecycleState = ACTIVE`, `createdById = <test-user-id>`.

**Super-admin test users do NOT get example USER tags** — they exercise the moderation and admin views, not the personal tag UX.

#### E-2 — Example PostTag assignments

Apply 2–4 PostTags to each example blog post seeded by the existing post fixtures.

#### E-3 — Example user-tag assignments

For each test user with example USER tags (E-1), apply 1–2 of their USER tags + 1–2 SYSTEM tags to entities they can view (their own accommodations, posts they authored, etc.). `assignedById = <test-user-id>` for the user's own assignments, `assignedById = SYSTEM_USER_ID` if seed-driven defaults are needed.

This provides realistic data for:
- Testing per-user attribution rules.
- Testing the entity tag list UI for both regular users and super-admins.
- Testing impact counts on tag deletion.

### Seed Implementation Notes

- New required seed files in `packages/seed/src/required/`:
  - `systemUser.seed.ts` (R-1)
  - `internalTags.seed.ts` (R-2)
  - `systemTags.seed.ts` (R-3)
  - `postTags.seed.ts` (R-4)
- New example seed files in `packages/seed/src/example/`:
  - `userTags.seed.ts` (E-1)
  - `postTagAssignments.seed.ts` (E-2)
  - `entityTagAssignments.seed.ts` (E-3)
- Update `packages/seed/src/manifest-required.json` to register R-1..R-4 in the correct dependency order: System User → INTERNAL/SYSTEM tags → PostTags. PostTag assignments to posts depend on posts being seeded first.
- Update `packages/seed/src/manifest-example.json` to register E-1..E-3 with dependencies on test users and posts.
- Reclassification of the 43 existing files in `packages/seed/src/data/tag/` is captured in a single sub-task: each JSON either becomes a PostTag JSON (moved to `data/postTag/`) or a SYSTEM user-tag JSON (kept under `data/tag/` with new schema fields), or is removed if obsolete.

---

## Risks

**R-001 (Low): Race on USER tag creation exceeds quota.**
Mitigated by advisory lock per `userId` in the create transaction (D-010). Pattern reused from SPEC-064.

**R-002 (Low): Cross-type name collision is service-layer enforced, not DB-enforced.**
Concurrent creation of a SYSTEM tag and a USER tag with the same name could race past the service check. In practice, SYSTEM tags are created infrequently by admins, so the race is very unlikely. If it ever materializes, a partial unique index spanning types can be added later.

**R-003 (Medium): Reclassification of 43 existing tag JSONs is a manual judgment call.**
Each existing tag must be assigned by a human reviewer to PostTag, SYSTEM, or dropped. The spec proposes an initial classification but the implementation team must finalize it. This affects required seed content.

**R-004 (Low): SYSTEM tags applied by user A look identical to SYSTEM tags applied by user B in admin attribution view.**
The admin UI must clearly show `assignedById` per row to disambiguate. The data is available; surfacing it is a UI requirement.

**R-005 (Low): The `tags.ownerId` cascade on user delete removes USER tags AND all their assignments.**
This is by design. A deleted user takes their personal organization with them. Other users' assignments and SYSTEM/INTERNAL tags are unaffected.

---

## Acceptance Criteria

| # | Criterion | Verifiable by |
|---|-----------|--------------|
| AC-F01 | A USER tag with type=USER and no ownerId returns 400. | Automated test |
| AC-F02 | A SYSTEM tag with type=SYSTEM and a non-null ownerId returns 400. | Automated test |
| AC-F03 | A USER tag with name colliding with existing SYSTEM/INTERNAL returns 409. | Automated test |
| AC-F04 | Two users independently apply same SYSTEM tag to same entity → two rows with different `assignedById`. | Automated test |
| AC-F05 | User A's assignments on entity X are not in user B's view. | Automated test |
| AC-F06 | Super-admin with `TAG_VIEW_ALL_ASSIGNMENTS` sees all assignments with attribution. | Automated test |
| AC-F07 | Regular user attempting to apply INTERNAL tag → 403. | Automated test |
| AC-F08 | User attempting to apply tag to entity they cannot view → 403. | Automated test |
| AC-F09 | USER tag creation beyond quota → quota error, no tag created. | Automated test |
| AC-F10 | Concurrent USER tag creates at quota boundary → exactly quota tags after both. | Automated test |
| AC-F11 | Hard-deleting a tag cascade-deletes all assignments. | Automated test |
| AC-F12 | Deleting a user cascades to their USER tags AND assignments. | Automated test |
| AC-F13 | Public PostTag listing returns only ACTIVE PostTags. | Automated test |
| AC-F14 | `/blog?tag=gastronomia` works for ACTIVE PostTag, returns empty/404 for inactive or unknown. | Automated test |
| AC-F15 | EntityTypeEnum contains 4 new values. | Type check |
| AC-F16 | All new permissions present in PermissionEnum. | Type check |
| AC-F17 | `HOSPEDA_TAG_USER_QUOTA_PER_USER` env var overrides default 50. | Automated test |
| AC-F18 | `description` column replaces `notes`. No `notes` in any response. | Schema validation |
| AC-F19 | i18n keys for `tags.*` and `postTags.*` present in es/en/pt. | File existence check |
| AC-F20 | Required seeds populate System User + INTERNAL tags + SYSTEM tags + PostTags. | Run `pnpm db:seed`, query DB |
| AC-F21 | Example seeds populate USER tags for HOST/EDITOR/ADMIN test users (not super-admin). | Run example seed, query DB |
| AC-F22 | Example seeds populate PostTag assignments on test posts and entity-tag assignments per actor. | Run example seed, query DB |
| AC-F23 | Search via `safeIlike` substring on `name` returns expected matches in picker, manager, admin list. | Automated test |
| AC-F24 | PostTag public endpoint sets `Cache-Control: public, max-age=600`. | Automated test |

---

## Phased Implementation Outline

This outline is high-level. Atomic task breakdown is produced by `/task-master:task-from-spec` after spec approval.

### Phase 1: Enums and permissions
- Add `TagTypeEnum` (`INTERNAL`, `SYSTEM`, `USER`) as TS enum, Zod `nativeEnum`, pgEnum.
- Add `SYSTEM` role (or equivalent) for the system user, if not already present.
- Add 4 new values to `EntityTypeEnum` and `EntityTypePgEnum`.
- Add all new permissions to `PermissionEnum`.

### Phase 2: DB schema
- Drop existing `tags.slug` and `tags.notes` columns; add `description`, `type`, `ownerId`.
- Add partial unique indexes on `tags`.
- Refactor `r_entity_tag`: add `assignedById`, change PK to `(tagId, entityId, entityType, assignedById)`.
- Add `post_tags` and `r_post_post_tag` tables.
- Set up FK cascades per spec.
- Apply via `pnpm db:fresh-dev`.

### Phase 3: Zod schemas (`@repo/schemas`)
- New `postTag.schema.ts`, `postTag.crud.schema.ts`, `postTag.query.schema.ts`.
- Refactored `tag.schema.ts` with new fields, removed slug.
- Refactored `r_entity_tag` schemas to include `assignedById`.
- Access schemas for new permission tiers.

### Phase 4: DB models
- New `PostTagModel`, `RPostPostTagModel`.
- Refactored `TagModel`, `REntityTagModel`.

### Phase 5: Service refactor
- New `PostTagService` extending `BaseCrudRelatedService`.
- Refactored `TagService`:
  - Type invariants on create/update.
  - Quota enforcement on USER tag create with advisory lock.
  - Cross-type name collision check.
  - Picker visibility scoping per actor.
  - Entity-access check before assignment.
  - `assignedById` injection on assign.
  - Per-user attribution scoping on `getTagsForEntity`.
  - `getPopularTags` returns DISTINCT entityId-based counts.
- Updated permission check functions in `tag.permissions.ts` and new `postTag.permissions.ts`.

### Phase 6: API routes
- Admin routes for INTERNAL, SYSTEM, USER moderation.
- Protected routes for USER CRUD and entity assignments.
- Admin routes for PostTag CRUD and post assignments.
- Public route for PostTag listing.
- Impact-count routes for confirmation dialogs.

### Phase 7: Admin UI (TanStack Start)

All user-tag UI lives in the admin panel (D-024). Sections:
- PostTag management (CRUD + assignment to posts).
- INTERNAL tag management (CRUD).
- SYSTEM tag management (CRUD).
- Own-USER tag manager (per-actor CRUD with quota indicator and lifecycle visual distinction). Accessible to any admin-panel user via account/settings area.
- Reusable Tag Picker component (used wherever an entity is editable in the admin: accommodation edit, event edit, post edit, user detail, etc.).
- USER tag moderation section (gated by `TAG_VIEW_ALL_USER_TAGS`).
- Cross-user attribution view on entity detail pages (gated by `TAG_VIEW_ALL_ASSIGNMENTS`).

### Phase 8: Web (public) — PostTag only

The public web app (`apps/web`) does NOT consume user-tags (D-024). Web work in this spec is limited to:
- Public PostTag-filtered post listings (e.g., `/blog?tag=guia-de-viaje`) — verify existing implementation aligns with the new `post_tags` table.
- PostTag display chips on blog post pages.
- PostTag-driven sitemap entries (SEO).

No tag picker, no tag manager, no user-tag UI in the web app.

### Phase 9: i18n
- Add `tags.*` and `postTags.*` keys to es/en/pt.
- Wire keys into picker, manager, admin, and error components.

### Phase 10: Seeds
- Implement R-1 (System User), R-2 (INTERNAL), R-3 (SYSTEM), R-4 (PostTags) under `packages/seed/src/required/`.
- Reclassify the 43 existing `data/tag/*.json` files: move to `data/postTag/` or update for new `tags` schema or delete.
- Update `manifest-required.json` with dependencies.
- Implement E-1 (USER tags for HOST/EDITOR/ADMIN), E-2 (PostTag assignments), E-3 (entity-tag assignments) under `packages/seed/src/example/`.
- Update `manifest-example.json` with dependencies.
- Verify with `pnpm db:fresh-dev` that all seeds populate cleanly.

### Phase 11: Tests
- Unit tests for service invariants (type invariants, quota with race, cross-type collision, picker visibility, entity access).
- Integration tests for all new API routes with permission and visibility coverage.
- Tests for cascades on user delete and tag delete.
- Regression coverage for existing tag functionality where it survived the refactor.
- Seed verification tests (counts and shape after seed).

---

## Open Questions

None remaining. All design ambiguities are resolved in `decisions.md`. Implementation-time judgment calls are scoped to:
- Final list of INTERNAL/SYSTEM/PostTag content (product input, not architectural).
- Reclassification of the 43 existing tag JSONs (manual review).
- Choice of color/icon defaults for seeded tags (cosmetic, not architectural).
