# SPEC-169 — Tracked Debt Items

Deferred work intentionally left out of SPEC-169 scope, recorded here so it is
not lost. Each item is allow-listed / commented in code so it cannot silently
spread.

## D-1 — CLIENT_MANAGER broad grants not tightened

**Status**: Deferred (role unused)
**Where**: `packages/seed/src/required/rolePermissions.seed.ts` (CLIENT_MANAGER block)

`CLIENT_MANAGER` holds 5 broad grants:

- `USER_READ_ALL`
- `ACCOMMODATION_VIEW_ALL`
- `ACCOMMODATION_VIEW_PRIVATE`
- `DESTINATION_VIEW_ALL`
- `DESTINATION_VIEW_PRIVATE`

These were left untouched (decision D6 / standing scope guard). The role is not
assigned to any active user flow today, so owner-scoping it would be untestable
churn against an unused surface. The grants are explicitly allow-listed in the
AC-6 audit test (`packages/seed/test/role-permission-audit.test.ts`) with a
comment, so they do **not** trip the systemic guard — but the allow-list also
means any *new* broad grant added to CLIENT_MANAGER would.

**Revisit when**: the role is activated for real client-management flows, most
likely alongside the per-user permission panel (SPEC-170). At that point decide,
per entity, whether CLIENT_MANAGER needs `_VIEW_ALL`, an owner/tenant-scoped
view, or a narrower grant.

## D-2 — Posts read model not migrated to OWN/ANY tiers

**Status**: Documented only (decision D7)
**Where**: posts service + permissions (unchanged by this spec)

Posts use a different access model than accommodation: automatic author-fallback
on update/delete/publish, permission-only on restore/hardDelete — not the
OWN/ANY tier. There is an asymmetry: `restore`/`hardDelete` lack the
author-fallback that `update`/`delete`/`publish` have. SPEC-169 does **not**
change posts (adding `_OWN` post perms now would be dead code — no role holds
them, no panel assigns them). The granular per-user model for posts is deferred
to SPEC-170. SPEC-169 only verified that the per-user direct-permission-override
mechanism works at the engine level, so the future panel will function.

## D-3 — `PostSponsorshipSelectField` → unmounted route (OQ1)

**Status**: Out of scope, commented
**Where**: `apps/admin/src/components/.../post-sponsorship-api.utils.ts`

The selector points at `/admin/post-sponsorships`, a route that is not mounted.
This is a separate, pre-existing bug. It was left with a SPEC-169/OQ1 comment:
whoever mounts the route must wire the `/options`-style gating
(`ACCESS_PANEL_ADMIN`, `{ id, label, slug }` payload) so it does not re-introduce
a broad-grant requirement.

## D-4 — Shared vs local `checkCanFindOptions`

**Status**: Minor cleanup, optional
**Where**: `service-core/src/utils/permission.ts` (shared) + accommodation local copy

`checkCanFindOptions` was placed shared and reused by 5 services; accommodation
kept its local copy (T-017 scope). A follow-up may collapse the local copy into
the shared one. No behavioral difference today.
