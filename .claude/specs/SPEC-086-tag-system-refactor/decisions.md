# SPEC-086 — Final Design Decisions

> **Status**: Approved
> **Date**: 2026-04-29
> **Supersedes**: Open questions and ambiguities in `spec.md` v1
> **Outcome**: `spec.md` to be rewritten using these decisions as source of truth

This document captures the final architectural decisions for SPEC-086 after the design review. Where these decisions conflict with `spec.md` v1, **these decisions win**.

---

## D-001: Two separate systems (Option A)

The original spec mixed two unrelated domains under a single `tags` table with a `scope` discriminator. This is rejected.

The system is split into two independent subsystems with no shared schema, service, or routes.

### Subsystem 1 — PostTag (public taxonomy)

- **Purpose**: Public, SEO-driven content categorization for blog posts.
- **Audience**: Anonymous visitors, search engines, authenticated users.
- **Created by**: Editors / admins only.
- **URL exposure**: Yes. Slug appears in public URLs (e.g., `/blog?tag=gastronomia`).
- **Storage**: New table `post_tags`, separate from `tags`. Join table `r_post_post_tag` with simple PK `(postId, postTagId)`. No per-user attribution.
- **Routes**: Admin CRUD + public read.
- **i18n**: None in v1. Single-language `name` and `slug`.

### Subsystem 2 — User-Tag (per-user organization + admin labels)

- **Purpose**: Personal organization for authenticated users + internal operational labels for admins.
- **Audience**: Never anonymous. Always scoped to authenticated actor.
- **Storage**: Existing `tags` table (refactored) + `r_entity_tag` (refactored with `assignedById`).
- **Routes**: Admin and protected tiers only. **No public route.**

The two subsystems coexist on the same entity. Example: a post may have PostTags ("Gastronomía") for SEO **and** a user's personal USER tag ("Read later") for that user's organization. They live in different tables and never collide.

---

## D-002: TagTypeEnum has three values, no `scope`

The orthogonal `type × scope` model is rejected. A single dimension with three values:

| Value | Created by | Usable by | Public URL? | Slug? |
|-------|-----------|-----------|-------------|-------|
| `INTERNAL` | Admin / seed | Admin / super-admin only | No | No (always NULL) |
| `SYSTEM` | Admin / seed | Any authenticated user | No (user-tags never go public) | No (always NULL) |
| `USER` | The user themselves | The owner only | No | No (always NULL) |

`TagScopeEnum` is **removed** from the design entirely.

The `tags.slug` column is **removed** from the table. User-tags do not have public URLs.

---

## D-003: No migration. Direct schema changes via push.

Hospeda follows push-only development (no prod DB, fresh DB on every breaking change). All migration-related sections of `spec.md` v1 are deleted:

- No blue/green deployment.
- No PK swap planning.
- No `ALTER TYPE ... ADD VALUE` separate migrations.
- No backfill of `type = SYSTEM` for legacy rows.
- No rename migration for `notes` → `description`.

Implementation:
- Drop and recreate tables/columns as needed via Drizzle schema changes.
- Run `pnpm db:fresh-dev` to apply.
- Re-seed.

This means the `tags` table is essentially built fresh: new columns, removed columns, new PK on `r_entity_tag`. Done.

---

## D-004: Cascade delete USER tags on user delete

When a user is hard-deleted, all their `USER` tags are cascade-deleted via the `tags.ownerId` FK.

```ts
ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' })
```

Cascade on `tags` deletion is already in place on `r_entity_tag.tagId` (existing FK). So when the user is deleted: user → cascade → user's tags → cascade → user's assignments. Clean, no orphans.

This supersedes the `SET NULL` strategy from `spec.md` v1 (R-006).

---

## D-005: System user UUID for automated assignments

`r_entity_tag.assignedById` is `NOT NULL` always.

For seed data, cron jobs, webhooks, and any automated tag assignment, a reserved system user UUID is used as the assigner.

- Constant: `SYSTEM_USER_ID` defined in `@repo/db/constants` (or equivalent shared location).
- Value: a fixed UUID seeded into `users` table with role `SYSTEM` (new role) and a non-loginable account state.
- All automated assignments reference this UUID as `assignedById`.

This preserves the `NOT NULL` invariant without forcing a real human actor for system-driven assignments.

---

## D-006: Picker visibility per actor

Tags shown in the **picker** (when applying tags to an entity) by actor:

| Actor | Picker shows |
|-------|-------------|
| Anonymous | N/A — no picker for anonymous users |
| Authenticated user A | `SYSTEM` tags + A's own `USER` tags |
| Admin (with `TAG_INTERNAL_VIEW`) | `INTERNAL` + `SYSTEM` + own `USER` tags |
| Super-admin moderation context | All tags including other users' `USER` tags (separate moderation UI, not the picker) |

**Key change vs spec.md v1**: Regular authenticated users do NOT see `INTERNAL` tags in their picker, ever. This eliminates the leak risk from OQ-004.

---

## D-007: Entity-tag visibility per actor

Tags shown **on an entity** (e.g., when viewing accommodation X's tag list):

| Actor viewing entity | Sees |
|---|---|
| Anonymous | Nothing from this system. (Anonymous tag display lives in PostTag system on posts only.) |
| Authenticated user A | Only assignments where `assignedById = A.id`. Period. |
| Admin with `TAG_VIEW_ALL_ASSIGNMENTS` | All assignments on the entity, with `assignedById` populated for attribution UI. |

User-tags are an organization tool, not a social feature. User A sees only what A applied. SYSTEM tags applied by others on the same entity by other users are not visible to A on that entity (but A can still apply the same SYSTEM tag from the picker — it just creates A's own row).

---

## D-008: Permission to assign a tag requires permission to see it

Before any insert into `r_entity_tag`, the service validates:

1. The tag exists.
2. The actor's picker visibility (D-006) includes that tag.

Examples:
- Regular user trying to assign an `INTERNAL` tag → rejected (not in their picker).
- Regular user trying to assign another user's `USER` tag (by ID) → rejected (not in their picker).
- Regular user assigning a `SYSTEM` tag or their own `USER` tag → allowed.

This is enforced at the service layer, not just the route layer.

---

## D-009: Entity-level access required to apply tags

Before any insert into `r_entity_tag`, the service also validates that the actor has read access to the target entity.

- If the user cannot view the entity, they cannot tag it.
- Implementation: each entity type (ACCOMMODATION, EVENT, POST, etc.) exposes a `canView(actor, entityId)` check via its service. The TagService delegates to that check before assignment.

This applies to all 9 entity types (`ACCOMMODATION`, `DESTINATION`, `USER`, `POST`, `EVENT`, `CONVERSATION`, `REVIEW`, `BILLING_SUBSCRIPTION`, `PAYMENT`).

---

## D-010: Quota race protected by advisory lock

`USER` tag creation acquires a PostgreSQL advisory lock keyed on `userId` for the duration of the create transaction.

```ts
await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
```

The pattern is already established in `@repo/db` from SPEC-064. The lock is automatically released at transaction end. Performance impact is negligible because realistic concurrency for a single user creating tags is essentially zero.

This supersedes R-003 in `spec.md` v1.

---

## D-011: Hard delete only, with impact count

Tags use **hard delete**. Cascade via FK removes all `r_entity_tag` rows. No soft delete.

Before delete:
- A separate endpoint `GET /tags/:id/impact` returns the count of `r_entity_tag` rows referencing the tag.
- The UI displays this count in a confirmation dialog.
- The DELETE endpoint executes the cascade unconditionally — confirmation is enforced at the UI layer.

For PostTag deletion, same pattern: impact count via separate endpoint, then DELETE.

---

## D-012: No `TAG_USER_UPDATE_ANY` permission

Super-admin moderation of `USER` tags is delete-only. No rename action.

Rationale: rename creates zombie tags with names users didn't choose, which is worse UX than deletion. If a user has an abusive tag, deleting it is the cleanest moderation action.

If a real use case for non-destructive moderation appears later, the permission can be added then. YAGNI.

---

## D-013: PostTag public endpoint

```
GET /api/v1/public/posts/tags
GET /api/v1/public/posts/tags?withCounts=true
```

- Returns all `ACTIVE` PostTags.
- No pagination. Realistic volume is 50–200 tags total.
- `Cache-Control: public, max-age=600` (10 minutes).
- `withCounts=true` adds `usageCount: number` per tag (count of posts using it). Default off.
- No filter by entityType — PostTags only apply to posts.

Admin endpoints follow the standard CRUD pattern at `/api/v1/admin/posts/tags`.

---

## D-014: Search via `safeIlike` substring on name only

Search behavior across all three search contexts (user picker, user manager, admin list):

```ts
where(safeIlike(tags.name, query))
```

- Substring match (`%query%`), case-insensitive.
- Searches `name` column only. `description` is not searched.
- `safeIlike` from `@repo/db` enforces wildcard escaping (project policy).
- No FTS, no trigram, no prefix-only optimization.

Volume per search context:
- User picker: ~200 SYSTEM + ~50 user's USER tags = ~250 rows max.
- User manager: ~50 user's tags max.
- Admin list: ~200 SYSTEM tags + paginated INTERNAL/USER moderation views.

Performance is irrelevant at these volumes. Simplicity wins.

---

## D-015: i18n on tags — none

Neither PostTag nor user-tag system has translated `name` or `slug` columns in v1.

If multilingual SEO ranking on EN/PT becomes a priority later, PostTag can be extended with `nameTranslations: jsonb` and `slugTranslations: jsonb` non-breakingly.

---

## D-016: Open questions resolved

| Original OQ | Resolution |
|---|---|
| OQ-001 (auto-generated slugs for INTERNAL) | Slug column removed entirely from user-tag system. N/A. |
| OQ-002 (show ARCHIVED in user manager) | Yes, with visual distinction. Quota only counts ACTIVE. |
| OQ-003 (TAG_USER_UPDATE_ANY) | Not added. See D-012. |
| OQ-004 (INTERNAL visible to regular users) | Resolved by 3-type model. INTERNAL is admin-only. See D-002 and D-006. |

---

## D-017: Final permission set

Naming follows the project convention `{ENTITY}_{ACTION}_{SCOPE}` UPPER_CASE.

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
| `TAG_USER_DELETE_ANY` | Super-admin | Delete any user's USER tag (moderation) |
| `TAG_VIEW_ALL_USER_TAGS` | Super-admin | Browse all USER tags across users |
| `TAG_VIEW_ALL_ASSIGNMENTS` | Super-admin | View all assignments with attribution |
| `TAG_ASSIGN_VIEW` | All authenticated | View own assignments on any entity |
| `TAG_ASSIGN_ADD` | All authenticated | Apply a tag (visible to actor) to an entity |
| `TAG_ASSIGN_REMOVE` | All authenticated | Remove own assignment |

`TAG_SYSTEM_ASSIGN` is intentionally **not** a separate permission. Any authenticated user can assign SYSTEM tags via `TAG_ASSIGN_ADD` because SYSTEM tags are visible to them by definition (D-006).

`TAG_USER_UPDATE_ANY` is intentionally not included (D-012).

### PostTag system

| Permission | Holder | Description |
|---|---|---|
| `POST_TAG_CREATE` | Admin | Create PostTag |
| `POST_TAG_UPDATE` | Admin | Update PostTag |
| `POST_TAG_DELETE` | Admin | Delete PostTag |
| `POST_TAG_VIEW` | Admin | View PostTag in admin context |
| `POST_TAG_ASSIGN` | Admin | Assign / unassign PostTags on a post |

Public read of PostTag does not require a permission.

---

## D-018: Final schema shape

### `post_tags` (new table)

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

Unique indexes:
- `post_tags_name_idx` (unique) on `name`.
- `post_tags_slug_idx` (unique) on `slug`.
- `post_tags_lifecycle_idx` on `lifecycleState`.

### `r_post_post_tag` (new table)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `postId` | uuid FK | No | CASCADE on delete |
| `postTagId` | uuid FK to post_tags.id | No | CASCADE on delete |

PK: `(postId, postTagId)`. No per-user attribution.

### `tags` (refactored)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | |
| `name` | text | No | |
| `color` | TagColorPgEnum | No | |
| `icon` | text | Yes | |
| `description` | text | Yes | Renamed from `notes` |
| `type` | TagTypePgEnum | No | INTERNAL / SYSTEM / USER |
| `ownerId` | uuid FK to users.id | Yes | NULL for INTERNAL+SYSTEM, required for USER. CASCADE on delete. |
| `lifecycleState` | LifecycleStatusPgEnum | No | Default ACTIVE |
| Audit fields | timestamps + uuid FKs | per field | Standard |

Removed: `slug` column (no public URL on user-tags).

Service-layer invariants:
1. `type = USER` ⇒ `ownerId NOT NULL`.
2. `type IN (INTERNAL, SYSTEM)` ⇒ `ownerId IS NULL`.

Unique indexes:
- `tags_internal_name_idx` (unique) on `name` WHERE `type = 'INTERNAL'`.
- `tags_system_name_idx` (unique) on `name` WHERE `type = 'SYSTEM'`.
- `tags_user_name_idx` (unique) on `(ownerId, name)` WHERE `type = 'USER'`.

Cross-type name collision (USER vs SYSTEM/INTERNAL with same name) is rejected at service layer with a 409 conflict error. Not enforced by DB constraint.

Other indexes:
- `tags_type_idx` on `type`.
- `tags_owner_id_idx` on `ownerId`.
- `tags_lifecycle_idx` on `lifecycleState`.

### `r_entity_tag` (refactored)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `tagId` | uuid FK to tags.id | No | CASCADE on delete |
| `entityId` | uuid | No | |
| `entityType` | EntityTypePgEnum | No | |
| `assignedById` | uuid FK to users.id | No | The user (or system user) who applied this assignment. CASCADE on user delete. |

PK: `(tagId, entityId, entityType, assignedById)`.

Indexes:
- `r_entity_tag_assigned_by_idx` on `assignedById`.
- `r_entity_tag_entity_idx` on `(entityType, entityId)`.

---

## D-019: EntityTypeEnum additions

Add four values to `EntityTypeEnum`: `CONVERSATION`, `REVIEW`, `BILLING_SUBSCRIPTION`, `PAYMENT`.

Note: `POST` stays in `EntityTypeEnum` and remains a valid `entityType` for `r_entity_tag` — users may apply USER tags to posts for personal organization. PostTags on posts are a separate system (D-001).

---

## D-020: API surface

### Admin — User-Tag system

```
/api/v1/admin/tags/internal       (CRUD)
/api/v1/admin/tags/system         (CRUD)
/api/v1/admin/tags/user           (GET list, DELETE :id) — moderation
/api/v1/admin/tags/:id/impact     (GET) — for delete confirmation
/api/v1/admin/entities/:type/:id/tags  (GET) — all assignments with attribution
```

### Protected — User-Tag system

```
/api/v1/protected/tags/user       (CRUD on own)
/api/v1/protected/tags/user/:id/impact  (GET) — for delete confirmation
/api/v1/protected/entities/:type/:id/tags         (GET, POST own assignment)
/api/v1/protected/entities/:type/:id/tags/:tagId  (DELETE own assignment)
```

### Admin — PostTag system

```
/api/v1/admin/posts/tags           (CRUD)
/api/v1/admin/posts/tags/:id/impact (GET) — for delete confirmation
```

### Public — PostTag system

```
/api/v1/public/posts/tags          (GET, optional ?withCounts=true)
```

No public endpoint for the user-tag system.

---

## D-021: Quota config

- Default: 50 ACTIVE USER tags per user.
- Env var: `HOSPEDA_TAG_USER_QUOTA_PER_USER` (integer).
- Read at service startup. Falls back to 50 if unset or invalid.
- Quota check counts only `type = 'USER'` AND `lifecycleState = 'ACTIVE'`.
- Race protected by advisory lock (D-010).

---

## D-022: Lifecycle states

User-tags use existing `LifecycleStatusEnum` (`ACTIVE`, `INACTIVE`, `ARCHIVED`).

- Quota counts only `ACTIVE`.
- User manager UI shows all states with visual distinction (ARCHIVED tags are dimmed but visible).
- Picker shows only `ACTIVE` tags.

PostTags also use the same enum. `ACTIVE` PostTags appear in public listings.

---

## D-023: Out of scope (still)

The following remain explicitly out of scope, per `spec.md` v1 Non-Goals:

- Tag categories / hierarchy (PostTag is flat in v1, can be extended later).
- Tag merge operations.
- Bulk operations.
- ML-based tag suggestions.
- Wiring conversation tagging in SPEC-085 (deferred to follow-up).
- i18n on tag names (D-015).

---

## D-024: User-tags are admin-panel-only (added 2026-04-29)

The user-tag system (INTERNAL + SYSTEM + USER) is exposed **only in the admin panel** (`apps/admin`). The web app (`apps/web`) does NOT consume any user-tag UI.

**Consumers**:
- `apps/admin`: full user-tag UI — pickers, manager, moderation, attribution. Used by HOST / EDITOR / ADMIN / SUPER_ADMIN roles.
- `apps/web`: shows **only PostTags** (public, on blog post pages and in tag-filtered post listings). No user-tag elements anywhere.

**Implications**:
- All user-tag API routes live under `/api/v1/admin/*`. The previously planned `/api/v1/protected/tags/*` tier is dropped — there is no web-app-side user-tag flow.
- Permission gating still distinguishes own-vs-all: HOST creates only own USER tags via `TAG_USER_CREATE`, super-admin moderates via `TAG_VIEW_ALL_USER_TAGS` / `TAG_USER_DELETE_ANY`. The tier is uniformly `/admin/*`; permissions decide who sees what.
- Phase 8 in `spec.md` (originally "User-Facing UI" in Astro) is removed except for PostTag display on the public blog. All user-tag UI work moves to Phase 7 (Admin UI).
- Regular USER-role visitors continue to use the existing **bookmarks** feature for personal organization. Bookmarks and user-tags do not overlap in scope.

**Why this matters**: simplifies the surface dramatically. One UI codebase (admin), one API tier (`/admin`), one auth model (admin-tier auth with permission gating). The original spec had user-tag features split across web + admin, which doubled the work and forced duplicate component logic.

---

## Next steps

1. Rewrite `spec.md` from scratch using these decisions as the source of truth. The original `spec.md` v1 contains too many obsolete sections (migration, scope, USER+PUBLIC blocking) to be edited in place.
2. After approved spec rewrite, run `/task-master:task-from-spec` to generate the atomic task breakdown.
3. Begin Phase 1 (enum additions + permission additions) only after the new spec is approved.
