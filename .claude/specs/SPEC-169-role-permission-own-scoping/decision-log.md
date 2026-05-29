# SPEC-169 — Decision Log (T-003 Owner-Review Gate)

> Record of the audit outputs and every §12-governed decision approved by the owner (qazuor)
> before any implementation started. Gate closed: 2026-05-29.

## Audit summary (T-001 + T-002)

- **Pass A (role × permission) — EXECUTED.** Live seed matches spec §3 EXACTLY. No discrepancy.
  Only non-staff broad grants: HOST(`ACCOMMODATION_VIEW_ALL`), CLIENT_MANAGER(5 grants, deferred),
  EDITOR(`POST_VIEW_ALL`/`POST_VIEW_PRIVATE`/`EVENT_VIEW_PRIVATE`, legitimate). USER/SPONSOR clean.
- **Pass B (endpoints + write-enforcement) — STATIC analysis** (worktree node_modules was incomplete
  at audit time; resolved later via `pnpm install`).
  - **Only non-staff-exploitable read leak = accommodation** (list + getById). All other leak-shaped
    endpoints are gated by permissions only staff (or SUPER_ADMIN catch-all) hold.
  - **No write-leaks** for any `_OWN`-holding role. Accommodation write ops match §2.2 exactly.
  - **Reference implementation found:** `apps/api/src/routes/conversations/admin/list.ts` already
    implements the §5.2 forced-owner-scoping pattern correctly. Mirror it.
  - Selectors that break when broad grants are removed: users, destinations, accommodations, events
    (+ event-organizers, event-locations are already SUPER_ADMIN-only today).

## Approved decisions

| # | Topic | Decision |
|---|-------|----------|
| D1 | Entities getting `_VIEW_OWN` | **Only accommodation** (`ACCOMMODATION_VIEW_OWN = 'accommodation.viewOwn'`). Systemic protection for ALL entities comes from the AC-6 audit test, not from fabricating unused `_VIEW_OWN` perms. (Owner approved the "only accommodation + audit test" approach.) |
| D2 | `_canAdminView` for non-owned (any visibility, incl PUBLIC) | **404 NOT_FOUND** — do not even confirm the resource exists (anti-enumeration). |
| D3 | Ownership resolver shape + scope | **Minimal, accommodation only** (`{ ownerColumn: 'ownerId', isOwner: (a,e) => e.ownerId === a.id }`). Generic/reusable shape so future entities replicate easily (§5.6, YAGNI). |
| D4 | `/options` lookup endpoints | Gating: `ACCESS_PANEL_ADMIN` (editor + admin both hold it). Entities: **users, destinations, accommodations, events, event-organizers, event-locations** (owner: "demosle llave también a editores y admin" → event-organizers/event-locations included, no longer super-only). Payload: `{ id, label, slug }` base; **accommodation additionally returns `type` and `destination`**. DRAFT-inclusive. |
| D5 | `beforeLoad` front guard | **Only `/accommodations` (the global list)** → redirect owner-scoped roles to `/me/accommodations`. Detail/edit/new are covered by the server (`_canAdminView`); no guard there. |
| D6 | Seed wording | HOST: remove `ACCOMMODATION_VIEW_ALL`, add `ACCOMMODATION_VIEW_OWN`, comment `// ACCOMMODATION: own accommodations only (SPEC-169: VIEW_OWN forces server-side owner scoping; VIEW_ALL removed — was a cross-tenant read leak)`. EDITOR: rationale comment `// EDITOR sees all editorial content by design (SPEC-169 §3 verdict). SUPER_ADMIN can narrow per-user via direct permission overrides.` CLIENT_MANAGER: untouched + known-debt comment. |
| D7 | Posts asymmetry (restore/hardDelete lack author fallback) | **Option C — document only + keep the owner-scoping pattern generic/reusable. Do NOT touch posts.** Posts uses a different model (automatic author fallback on update/delete/publish; permission-only on restore/hardDelete), NOT the OWN/ANY tier. Adding `_OWN` post perms now = dead code (no panel to assign them, no role using them) — same criterion as D1. The granular per-user model for posts is deferred to the future permissions-panel spec. This spec adds: (a) a doc note of the asymmetry, (b) a verification that the per-user direct-permission-override mechanism works at the engine level (so the future panel will function), (c) generic ownership pattern. |
| OQ1 | Broken `PostSponsorshipSelectField` → `/admin/post-sponsorships` (route not mounted) | **Separate bug, out of functional scope.** BUT during the selector-migration work, review/secure its authorization path so the blindaje is correct, or leave a clear comment that whoever fixes the mount must wire the `/options`-style gating properly. |
| OQ2 | event-organizer / event-location selectors super-only today | Give them the `/options` door too, accessible to **editor + admin** (folded into D4). |
| OQ3 | accommodation `/options` payload | name + destination + type + id (folded into D4). |
| OQ4 | dead `conversation.ownerId` admin-search param | **Out of scope.** Leave as-is. |
| OQ5 | posts restore/hardDelete/publish asymmetry | Covered by D7 (document, don't fix). |

## Standing scope guards (do not violate without re-consulting owner)

- **CLIENT_MANAGER is NOT touched** (§11 / §8 Q2). Deferred to a future spec; only a known-debt comment is added.
- **Posts are NOT modified** beyond documentation (D7).
- This spec's functional change is the accommodation read-leak fix; everything else is the
  cross-entity confirmation, the systemic audit test, the `/options` migration, and the front guard.
