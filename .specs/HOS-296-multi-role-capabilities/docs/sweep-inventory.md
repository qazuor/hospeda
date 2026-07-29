# §7.2 manual sweep — sites the compiler will not find

Companion to `spec.md` §7.2 and §7.3, produced by an explicit grep sweep of the
worktree at `feat/hos-296-multi-role-capabilities` (cut from `origin/staging`
at `2c8cb6a9d`).

The spec is right that "the type system does the inventory" holds only for code
that imports the type. This file is the actual list, including **sites the spec
does not name**. Everything marked NEW below was found by this sweep and is not
in `spec.md`.

## 1. Session consumers — the spec's table of four is incomplete

`spec.md` §7.1 lists four consumers. There are **six**. The two extra ones share
the exact failure mode the spec documents for `auth-cache.ts`: a hand-written
cast that keeps the compiler quiet while the value silently becomes `undefined`.

| # | Site | Reads | In spec? |
|---|---|---|---|
| 1 | `apps/web/src/lib/auth-cache.ts:85-93,207` | `/auth/me`, local `AuthMeResponseBody` | yes |
| 2 | `apps/web/src/lib/middleware-helpers.ts:408,452` | `/api/auth/get-session` | yes |
| 3 | `apps/admin/src/lib/auth-session.ts:94,132` | `get-session` (+ `/auth/me` for permissions) | yes |
| 4 | `apps/mobile` `app/_layout.tsx` → `useSession()` | `get-session` via Better Auth client | yes |
| 5 | `apps/web/src/lib/middleware-helpers.ts:804-836` (`isAdminBypassUser`) | `/auth/me`, cast `data?.data?.actor?.role` at `:827` | **NEW** |
| 6 | `apps/mobile/src/components/profile/ProfileScreen.tsx:291` | `session.user` cast `as { role?: string }` | **NEW** |

Plus a seventh, client-side in web:

| 7 | `apps/web/src/components/sections/HostLandingCta.client.tsx:73` | `session.user` cast `as { readonly role?: string }` | **NEW** |

**This table was itself a floor, not a ceiling.** Layer 4 found two more sites
that neither the spec nor this document listed, and both were higher-impact than
several that are listed:

| 8 | `apps/web/src/layouts/Header.astro:143,171-174,292` | `serverUser?.role === 'HOST' \| 'ADMIN' \| 'CLIENT_MANAGER' \| 'SUPER_ADMIN'` — gates `isAlreadyHost`, i.e. the **site-wide "Publicá" CTA**, plus a conditional entitlements fetch. Also a **fifth** ad-hoc staff set (`ROLES_WITH_ACCOMMODATIONS_NAV` minus EDITOR). |
| 9 | `apps/web/src/pages/[lang]/mi-cuenta/suscripcion/index.astro:45` | a second hand-cast `(user as { role?: string }).role ?? 'USER'` — would have degraded **every** subscriber to `'USER'`, sending hosts to the tourist plan catalog. |

**Why the sweep that produced this file missed #9, and how not to repeat it:**
the cast grep was run with `--include=*.ts --include=*.tsx` and therefore never
looked at `.astro` files at all. In an Astro app the frontmatter is code. Always
include `--include=*.astro`.

Run **both** greps, not one — they find disjoint sets:

```
grep -rn "as { *\(readonly \)\?role" apps/web/src --include=*.ts --include=*.tsx --include=*.astro
grep -rn "\.role\b" apps/web/src
```

### Why 5, 6 and 7 matter

- **#5 `isAdminBypassUser`** — returns `false` for everyone once `role` is
  `undefined`. No compile error, no runtime error.
  <br>**CORRECTION (layer 4).** This entry originally claimed the consequence was
  that "every ADMIN/SUPER_ADMIN loses the profile-completion guard bypass". That
  is wrong: they never had it. `PROFILE_COMPLETION_BYPASS_ROLES`
  (`apps/web/src/lib/routes.ts:101`) is `['admin', 'super_admin']` — **lowercase**
  — while every real role value is uppercase (`RoleEnum.ADMIN === 'ADMIN'`), and
  `middleware-helpers.test.ts` pins `'Admin' → false` as intended
  case-sensitivity. The comparison has never matched a real actor, so the bypass
  has been dead since it shipped. The migration still has to happen (the field is
  gone either way), but the case-sensitive comparison was deliberately preserved
  byte-for-byte so that fixing it — which would grant admins the bypass for the
  first time — is not misattributed to multi-role. Its own issue.
- **#7 `HostLandingCta`** — `isHostMode` (`:74`) goes permanently `false`, so the
  "Ir al panel de anfitrión" CTA disappears from `/publicar/` for every host.
  Same class of failure as the `MobileMenu` CTA the spec already documents.
  <br>Note it mounts `client:only="react"` (`pages/[lang]/publicar/index.astro:251`),
  so it has no SSR output — but `publicar` **is** already in
  `SESSION_OPTIONAL_SEGMENTS` (`apps/web/src/lib/routes.ts:28`), so the
  frontmatter does have the user and can hand roles down as a prop. Preferred fix
  is to route it through `auth-cache.ts`, which is already the client-side
  `/auth/me` plumbing, rather than adding a second mechanism.
- **#6 `ProfileScreen`** — §6.7 only names `apps/mobile/src/lib/auth/roles.ts:42,66`.
  This is a second mobile site with the same cast.

## 2. Raw SQL in `apps/e2e` — plus one reader the spec misses

Confirmed as written in §7.2:

- `apps/e2e/fixtures/api-helpers.ts:252` (`setUserRole`) — `UPDATE users SET role = $1 WHERE id = $2`
- `apps/e2e/fixtures/db-helpers.ts:89` (`demoteHostToUser`) — `UPDATE users SET role = 'USER' WHERE id = $1`
- `apps/e2e/tests/admin/spec172-amenity-chips-smoke.spec.ts:94` — same, inline

**NEW** — a fourth e2e site, a reader rather than a writer:

- `apps/e2e/fixtures/api-helpers.ts:264-290` — local type
  `data?: { actor?: { id: string; role?: string } }` over the `/auth/me` envelope,
  returning `{ id, role }`. Used by tests asserting role transitions after
  onboarding. Same hand-cast mirror category, in e2e rather than app code.

Also note `api-helpers.ts:31` (`readonly role: UserRole`) and `:166`/`:228`/`:237-241`
— the `createUser` fixture's own typed surface, which the compiler *does* see.

False positives to ignore (unrelated Postgres setting, not our column):
`SET LOCAL session_replication_role = 'replica'` in `test-cleanup.ts:71,147` and
`spec172-amenity-chips-smoke.spec.ts:181`.

## 3. A fourth "staff" role set

`spec.md` §12 names two sets that already disagree, and §7.3 adds a third. There
is a **fourth**, in web:

| Set | Where | Members |
|---|---|---|
| `STAFF_BILLING_BYPASS_ROLES` | `entitlement.ts:354-359`, dup at `owner-entitlement.ts:208-217` | SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER |
| `PRIVILEGED_ROLES` | `accommodation.service.ts:213-218` | HOST, ADMIN, CLIENT_MANAGER, SUPER_ADMIN |
| `BILLING_EXEMPT_ROLES` | `accommodation.service.ts:224-228` | ADMIN, CLIENT_MANAGER, SUPER_ADMIN |
| `BILLING_ADMIN_ROLES` | `apps/web/src/components/account/SubscriptionDashboard.client.tsx:597` | **NEW — verify members before migrating** |

## 4. Web read sites beyond §5.5

§5.5 covers `isHostRole` (13 occurrences / 6 files), the four `isCommerceOwnerRole`
walls and the five `resolveSubscriptionPlansPath` call sites. These are additional
`Astro.locals.user.role` reads not enumerated there:

- `apps/web/src/env.d.ts:40` — `App.Locals.user.role: string | null`. This is the
  **contract** every `.astro` page reads through. Typed, so the compiler catches
  it — but `src/types/app-locals.guard.ts` exists to fail the typecheck if the
  augmentation stops loading, so change both together.
- `apps/web/src/layouts/AccountLayout.astro:48`
- `apps/web/src/pages/[lang]/mi-cuenta/index.astro:186` (prop `userRole`)
- `apps/web/src/pages/[lang]/mi-cuenta/publica/index.astro:44` (prop to `DiscoveryDoorHub`)
- `apps/web/src/pages/[lang]/mi-cuenta/aliados/index.astro:43,51`
- `apps/web/src/pages/[lang]/mi-cuenta/preferencias/index.astro:43` (prop to `RestartTour`)
- `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro:59` —
  **inline raw role check**: `user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'`
- `apps/web/src/components/shared/navigation/MobileMenuIsland.astro:42` +
  `MobileMenu.client.tsx:112` — SSR role hint for first paint
- `apps/web/src/components/account/SubscriptionDashboard.client.tsx:55,187,597,798`
- `apps/web/src/hooks/use-account-permissions.ts:87,132,150`
- `apps/web/src/config/tours.ts:126` — `getWelcomeTourForRole(role)`

## 5. Admin local mirrors

- `apps/admin/src/contexts/auth-context.tsx:24,153`
- `apps/admin/src/lib/dashboard-sources.ts:89`
- `apps/admin/src/contexts/dashboard-resolver-context.tsx:75`
- `apps/admin/src/features/users/components/CustomerTypeBadge.tsx:12,21`
- `apps/admin/src/components/entity-form/types/field-config.types.ts:15`
- `apps/admin/src/hooks/use-auth-context.ts:48-59` (`useHasRole`/`useHasAnyRole`,
  already flagged in §5.5 as a latent violation)

## 6. A fourth blind-spot CATEGORY the spec does not name: Zod ↔ Drizzle drift

Found while implementing layer 1. `packages/db` typechecks **completely clean**
after `users.role` was dropped, and it should not.

`UserSchema.role: RoleEnumSchema` (`packages/schemas/src/entities/user/user.schema.ts:144`)
still exists and still promises the field. `packages/db` compiles anyway because
`BaseModelImpl<User>` is generic over the **Zod-inferred entity type**, never
derived from the Drizzle table. So schema/column drift on `users` is invisible to
`tsc` in *both* directions: anything reading `user.role` off a `User`-typed model
result compiles fine and is `undefined` at runtime.

That is the same silent-`undefined` failure mode §7.2 calls "the worst kind" for
`auth-cache.ts`, but structural rather than hand-written — no cast required to
trigger it. §7.2 lists three categories (raw SQL, hand-cast local mirrors, prose);
this is a fourth, and it lives inside `packages/db`/`packages/schemas` rather than
in an app.

## 7. `conversations` is an unlisted role-reading subsystem

Surfaced by the layer-1 compiler inventory. Roughly **25 errors across 13 files**
that neither §5.5 nor §7.3 enumerates:

- `apps/api/src/routes/conversations/**` — `initiate.ts` (4), `archive.ts`,
  `list.ts`, `reply.ts`, `public/guest-reply.ts`, `public/guest-thread.ts` (2 each)
- `apps/api/src/cron/jobs/conversation-token-reminder.job.ts` (3)
- `apps/api/src/cron/jobs/conversation-notification.job.ts` (2)
- `packages/service-core/src/services/conversation/*.ts`

Also undercounted: `newsletter-subscriber.service.ts` (6) and
`apps/api/src/middlewares/authorization.ts` (5).

The spec's read-site inventory is a floor, not a ceiling.

## 8. Prose

Confirmed exactly as §7.2 says — three comments reading "NEVER check `actor.role`
directly", at `commerce.permissions.ts:8`, `gastronomy.permissions.ts:13`,
`experience.permissions.ts:13`. Total `actor.role` hits across `apps/api` +
`packages/service-core` (excluding tests): **27**, matching the spec.
