---
id: SPEC-170
slug: user-permission-management
title: Per-User Granular Permission Management Panel
status: draft
owner: qazuor
created: 2026-05-29
relatedSpecs:
  - SPEC-169  # role permission audit + owner-scoped data access (spun off from D7)
  - SPEC-154  # admin config-driven IA (the /access section lives here)
tags:
  - permissions
  - admin
  - rbac
  - frontend
---

# SPEC-170 — Per-User Granular Permission Management Panel

> ⛔ **DECISION PROTOCOL (inherited from SPEC-169 §12):** This spec is in `draft`.
> The open questions in §8 are NOT resolved. Do not start implementation until the
> owner reviews them. If anything is ambiguous or has more than one viable option,
> STOP and consult the owner — do not decide autonomously.

## 1. Summary

Today the platform can grant or revoke an **individual permission to a single user**,
on top of (or beyond) what their role grants — the backend for this already exists and
works. What's missing is the **admin panel to manage it**: the page
`/access/users/:id/permissions` shows a user's role and inherited permissions but is
**read-only**, and its "Direct Permission Overrides" card is a half-finished stub. There
is no UI (and no API endpoints) to actually **grant** or **revoke** a per-user permission.

This spec builds that management surface: the API endpoints + the admin UI to view, grant,
and revoke per-user permission overrides, with the ~270-permission catalog organized by
category for a usable picker.

It also **documents the posts permission situation** (the asymmetry surfaced by SPEC-169):
because posts use an automatic author-fallback model rather than the `_OWN`/`_ANY` tier,
this panel enables some posts use-cases out of the box and leaves others needing a follow-up
permission-model decision. See §6.

## 2. Background — what exists today (audited under SPEC-169)

**Backend: ~95% complete and functional.**

- **DB model exists.** Table `user_permission` (`packages/db/src/schemas/user/r_user_permission.dbschema.ts`):
  `(userId, permission)` composite PK, FK to users with cascade delete, indexed on both columns.
  Companion `role_permission` table holds the role→permission map.
- **Service exists.** `PermissionService`
  (`packages/service-core/src/services/permission/permission.service.ts`) exposes
  `assignPermissionToUser`, `revokePermissionFromUser`, `assignPermissionToRole`, plus
  gating helpers (`canAssignPermissions`, `canRevokePermissions`, `canViewPermissions`).
- **Auth-time resolution already merges overrides.** `apps/api/src/middlewares/actor.ts`
  (~164-173): for non-SUPER_ADMIN actors it fetches role permissions
  (`getPermissionsForRole`, cached) and **merges** the per-user set
  (`getUserPermissions({ userId })`), de-duplicates, and that becomes `actor.permissions`.
  SUPER_ADMIN short-circuits to "all permissions".
- **Catalog is rich.** `PermissionEnum` (~270 permissions) + `PermissionCategoryEnum`
  (~59 categories) in `packages/schemas/src/enums/permission.enum.ts`.

**Frontend: ~20% complete.**

- Route `/access/users/:id/permissions` exists
  (`apps/admin/src/routes/_authed/access/users/$id_.permissions.tsx`) and renders the
  user's role + inherited permissions — **read-only**.
- The "Direct Permission Overrides" card is a **stub**: the header/description exist but
  the body is unfinished (no controls, cut off mid-`CardContent`).
- `/access/roles` and `/access/permissions` exist as read-only catalog views.
- **No grant/revoke UI, no permission-picker component, no API integration.**

**Net:** the hard layer (data model, service, auth resolution) is done. This spec is
mostly an **API-surface + UI build**, not a backend redesign.

## 3. Goals / Non-goals

**Goals**
- Expose API endpoints to **list / grant / revoke** per-user permission overrides.
- Complete the admin UI: a usable, categorized permission picker + grant/revoke flow on the
  user permissions page, replacing the stub.
- Make the effective-permissions view clear: show what comes from the **role** vs what is a
  **direct override**, and let the admin add/remove only the overrides.
- Gate the panel itself correctly (only users who may manage permissions can grant/revoke).
- Document the posts permission model so the owner knows exactly which posts use-cases this
  panel enables and which need a follow-up decision (§6).

**Non-goals**
- Re-architecting the permission model or the catalog (it already exists).
- Editing the **role→permission** seed map from the UI (this spec manages **per-user**
  overrides, not role definitions — role editing is a separate, larger decision).
- Introducing `_OWN`/`_ANY` permission tiers for posts (that's a model change — §6 / §8 Q4).
- Negative overrides (revoking a permission a user gets *from their role*) unless §8 Q2 says so.

## 4. Design (high level — subject to §8 open questions)

### 4.1 API endpoints (admin tier)
- `GET  /api/v1/admin/users/:id/permissions` — returns the user's effective permission set,
  split into `{ fromRole: [...], overrides: [...] }` so the UI can render the distinction.
- `POST /api/v1/admin/users/:id/permissions` — grant a per-user permission. Body `{ permission }`.
  Calls `PermissionService.assignPermissionToUser`.
- `DELETE /api/v1/admin/users/:id/permissions/:permission` — revoke a per-user override.
  Calls `PermissionService.revokePermissionFromUser`.
- Gating: a dedicated permission (e.g. `USER_PERMISSIONS_MANAGE`) or the existing
  `canAssignPermissions`/`canViewPermissions` checks. **(§8 Q1 — confirm the gate.)**

### 4.2 Admin UI
- Replace the stub "Direct Permission Overrides" card with:
  - The current overrides as removable chips/rows (revoke with confirm).
  - An "add permission" control: a **searchable picker grouped by `PermissionCategoryEnum`**
    (built dynamically from the catalog), excluding permissions the user already has from
    their role (or showing them disabled with a "from role" badge — §8 Q3).
  - Toasts on grant/revoke; optimistic update + invalidation via TanStack Query.
- Keep the inherited-from-role list visible and clearly labelled as non-editable here.

### 4.3 Catalog grouping
- The picker needs `category → permissions[]` grouping. Today the enum has categories but no
  explicit category→permissions map. Derive it (by permission-name prefix / a small static
  map in `@repo/schemas`). **(§8 Q3.)**

## 5. Functional Requirements (draft)

- **REQ-1** An authorized admin can see, for a given user, which permissions come from the
  role vs which are direct overrides.
- **REQ-2** An authorized admin can grant a per-user permission from the full catalog,
  organized by category and searchable.
- **REQ-3** An authorized admin can revoke a per-user override (with confirmation).
- **REQ-4** A granted/revoked override takes effect on the user's next auth resolution
  (`actor.permissions` already merges overrides — REQ is to verify end-to-end).
- **REQ-5** The panel itself is gated: a user without the manage-permissions capability
  cannot reach or call the grant/revoke endpoints.
- **REQ-6** SUPER_ADMIN behavior is unchanged (still "all permissions"; overrides are moot for it).

## 6. ⚠️ The posts permission situation (commented, per owner request)

This is the asymmetry SPEC-169 deliberately did **not** fix (SPEC-169 decision D7). It's
documented here because this panel is where it becomes relevant.

**How posts authorization works today** (`packages/service-core/src/services/post/post.permissions.ts`):

| Post operation | Permission | Author fallback (`actor.id === post.authorId`)? |
|----------------|-----------|--------------------------------------------------|
| update | `POST_UPDATE` | ✅ yes — author can edit own |
| delete (soft) | `POST_DELETE` | ✅ yes — author can delete own |
| publish/unpublish | `POST_PUBLISH_TOGGLE` | ⚠️ no explicit check in the file — inherited from base `_canUpdate` (needs confirmation; treated as effectively update-gated) |
| **restore** | `POST_RESTORE` | ❌ no — permission-only |
| **hard delete** | `POST_HARD_DELETE` | ❌ no — permission-only |

Posts use a **single permission per operation + inline author fallback** model. They do
**not** use the `_OWN`/`_ANY` split that accommodation uses.

**What this panel enables for posts, and what it doesn't:**

- ✅ "Let user *Pepe* manage his **own** posts (edit/delete/publish)": **already works** with
  zero override needed — Pepe is the author, the fallback covers it.
- ✅ "Let *Pepe* manage **all** posts (incl. restore / hard delete of anyone's post)": grant
  `POST_RESTORE` / `POST_HARD_DELETE` via this panel. Works — but it's **all posts, not just
  his own** (these perms have no owner scoping).
- ❌ "Let *Pepe* restore / hard-delete **only his own** posts": **NOT possible today.** There
  is no `POST_RESTORE_OWN` / `POST_HARD_DELETE_OWN`, and `restore`/`hardDelete` have no author
  fallback. Enabling this requires a model change (add the `_OWN` tier to posts + author
  fallback, mirroring accommodation). See §8 Q4 — this is a **separate decision**, intentionally
  out of the default scope, exactly as agreed in SPEC-169.

> Recommendation carried over from SPEC-169: do **not** add `_OWN` post permissions
> speculatively. Decide §8 Q4 only if a concrete need appears.

## 7. Acceptance Criteria (BDD, draft)

```
AC-1  Given an admin with the manage-permissions capability on the user permissions page
      When they open a user's page
      Then permissions are shown split into "from role" and "direct overrides".

AC-2  Given the same admin
      When they grant a permission via the categorized picker
      Then POST .../permissions is called, the override appears, and a success toast shows.

AC-3  Given a user with a direct override
      When the admin revokes it (and confirms)
      Then DELETE .../permissions/:permission is called and the override disappears.

AC-4  Given a user who just received an override
      When they re-authenticate
      Then actor.permissions includes the override (end-to-end resolution check).

AC-5  Given a user WITHOUT the manage-permissions capability
      When they attempt to reach the panel or call grant/revoke
      Then they are blocked (UI guard + API 403).

AC-6  Given the catalog (~270 permissions)
      When the picker renders
      Then permissions are grouped by category and searchable, and role-inherited ones are
      not offered as grantable duplicates (disabled or filtered — per §8 Q3).
```

## 8. Open Questions (for owner — must resolve before implementation)

- **Q1 — Gating.** What capability gates this panel? A new `USER_PERMISSIONS_MANAGE`
  permission, or reuse the existing `canAssignPermissions`/`canViewPermissions` checks in
  `PermissionService`? Who should hold it by default (SUPER_ADMIN only? ADMIN too?).
- **Q2 — Negative overrides.** Scope is per-user *additive* overrides (grant beyond role).
  Do we also need to **subtract** a permission a user gets from their role (a deny override)?
  The current `user_permission` table only models additive grants — a deny model would need
  schema + resolution changes. Recommendation: **additive only** for v1.
- **Q3 — Picker UX for role-inherited permissions.** When adding overrides, should
  role-inherited permissions be **hidden**, or **shown disabled** with a "from role" badge?
  And how do we build the category→permissions grouping (static map in `@repo/schemas` vs
  derive by name prefix)?
- **Q4 — Posts `_OWN` model (the §6 case).** Do we want, in a FUTURE spec, to add
  `POST_RESTORE_OWN` / `POST_HARD_DELETE_OWN` (+ author fallback) so "manage only my own
  posts (full lifecycle)" becomes assignable? Default per SPEC-169: **no, defer** — confirm.
- **Q5 — Confirm `POST_PUBLISH_TOGGLE` behavior.** The audit could not find an explicit
  publish check in `post.permissions.ts`; it appears to inherit base update gating. Confirm
  the real behavior so §6's table is accurate (this is a verification task, not a change).
- **Q6 — Audit log.** Should grant/revoke actions be written to an audit trail (who changed
  whose permissions, when)? Recommendation: **yes**, given the security weight.

## 9. Risks

- **R-1** Granting a broad permission (e.g. a `_VIEW_ALL`) to a user via this panel re-opens
  exactly the kind of cross-tenant exposure SPEC-169 closed. Mitigation: the panel surfaces
  the permission's meaning clearly; consider a "broad/sensitive" warning on `_VIEW_ALL` /
  `_READ_ALL` / `_HARD_DELETE` grants. (Tie-in to SPEC-169's AC-6 audit test, which only
  guards ROLES, not per-user overrides — see Q6/audit.)
- **R-2** The catalog is large (~270). A bad picker UX makes mistakes likely. Mitigation:
  category grouping + search + clear descriptions.
- **R-3** Overrides are resolved at auth time; a change may not reflect until the user's
  session/token refreshes. Mitigation: document the propagation timing; consider forcing a
  permission re-resolution.

## 10. Out of scope

- Editing role→permission definitions from the UI (separate spec).
- Posts `_OWN`/`_ANY` model change (§8 Q4 — deferred).
- CLIENT_MANAGER role activation/tightening (still owned by a future SPEC per SPEC-169 §11).
- Deny/negative overrides unless Q2 flips.

## 11. Notes

- Spun off from SPEC-169 decision D7 (see `.claude/specs/SPEC-169-role-permission-own-scoping/decision-log.md`).
- Backend audit confidence: high (model + service + actor resolution all confirmed present).
  Frontend: the stub at `$id_.permissions.tsx` is the anchor to extend.
