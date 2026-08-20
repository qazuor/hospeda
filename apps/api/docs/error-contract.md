# API error contract

What the API answers when a request cannot be served, and in what order it
decides. Written after the August 2026 production smoke, where five separate
findings turned out to be one route or one formatter drifting off this order.

Companion to [`route-architecture.md`](./route-architecture.md), which covers
the three tiers themselves.

## The order is the contract

```
1. authentication        → 401
2. route permission      → 403
3. input shape           → 400   (params → query → body)
4. existence / ownership → 404
5. business rules        → 409 / 422 / 403-gate
```

**No step may touch the database with a value an earlier step did not
validate.**

That single sentence is the whole of H-68: ownership ran at step 4 while shape
validation sat at step 3, so `GET /protected/events/abc` handed `abc` to
Postgres, the `uuid` cast failed, and 19 protected routes answered
`500 INTERNAL_ERROR`. Nobody had to type `abc` — a client building a URL from an
empty variable requests `/protected/events/undefined` and gets the same.

The order also decides H-165: a permission check that runs before the session
check answers 403 to someone the server never identified.

## The table

| Situation | Status | `error.code` |
|---|---|---|
| No session, protected or admin tier | **401** | `UNAUTHORIZED` |
| Signed in, lacks the declared permission | **403** | `FORBIDDEN` |
| Malformed param, query or body (non-UUID id included) | **400** | `VALIDATION_ERROR` |
| Resource does not exist | **404** | `NOT_FOUND` |
| Resource exists but belongs to somebody else | **404** | `NOT_FOUND` |
| …except a foreign RESTRICTED accommodation | **403** | `FORBIDDEN` |
| Well-formed but unprocessable | **422** | `VALIDATION_ERROR` |
| State conflict | **409** | `ALREADY_EXISTS` |
| Plan or limit gate | **403** | `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` |
| Server fault | **5xx** | `INTERNAL_ERROR` |

## Five rules

### R1 — `INTERNAL_ERROR` belongs to 5xx alone

A 4xx labelled `INTERNAL_ERROR` tells the client the failure is ours and worth a
retry, when the request itself is what needs to change (H-105). Both formatters
resolve the code through the single table in
[`utils/http-error-codes.ts`](../src/utils/http-error-codes.ts); an unlisted
status falls back by class, never to `INTERNAL_ERROR` for a 4xx.

### R2 — 401 before 403, always

A permission guard never runs ahead of the session guard. 401 means "I don't
know who you are" and sends the client to the login screen; 403 means "I know
who you are and it isn't enough". An administrator whose session expired must
not be told they lack permissions they hold.

Note the trap that caused H-165: the guest actor carries a **real UUID**
(`00000000-0000-4000-8000-000000000000`), so `!actor?.id` never fires. Ask
`isGuestActor(actor)`.

### R3 — the public tier does not require write permissions

A route under `/public/` whose service demands a `*_EDIT` permission is a design
error, not a restriction: it answers 403 to everyone and the endpoint is dead
(H-38). What keeps a public payload safe is the query — `visibility: PUBLIC`,
`lifecycleState: ACTIVE`, soft-delete — not a gate. On cached public prefixes the
gate cannot protect anything anyway: the cache runs before auth and its key
carries no `Authorization`.

### R4 — the twin formatters agree

`handleRouteError` (`utils/response-helpers.ts`) catches inside the route
factory; `createErrorHandler` (`middlewares/response.ts`) is `app.onError`. The
same error must produce the same body regardless of where in the stack it was
thrown. They previously held separate copies of the mapping "kept in sync by
comment" and drifted twice — HOS-283, then H-105. There is now one table and
nothing to sync.

#### `error.details` is debug-only, except for two public-contract codes

`error.details` is normally a **debug-only** field: both formatters strip it
unless `HOSPEDA_API_DEBUG_ERRORS` is on, so the server log keeps the structured
payload and the client gets only `code` + `message` (R5). `createErrorHandler`
(the global `app.onError`) has always emitted `details` for every 4xx
regardless of debug mode, though — a divergence between the two formatters
that stayed invisible because the limit/entitlement gate tests of the day
mounted their own hand-rolled `onError` instead of exercising
`handleRouteError` (HOS-700).

Two codes carry `details` the client is meant to read, so their `details` is
now emitted by `handleRouteError` too, with `HOSPEDA_API_DEBUG_ERRORS` off:

| `error.code` | `details` shape | Why the client needs it |
|---|---|---|
| `LIMIT_REACHED` | `{ limitKey, currentCount, maxAllowed, usagePercent, upgradeAudience, ... }` | `apps/web/src/lib/billing-limit-error.ts` reads `limitKey` to render the limit-specific toast (which limit, and the addon that unlocks it) instead of the generic fallback. |
| `ENTITLEMENT_REQUIRED` | `{ entitlementKey, ... }` | Same reasoning — the client needs to know which entitlement is missing to route the upgrade. |

This list is deliberately short — a conservative choice over opening `details`
on every 4xx, made explicitly by the issue owner (see HOS-700's decision
comment) because widening it changes the public contract of every route that
passes through `handleRouteError`. Every other code keeps the debug-only
behavior. Adding a third code here is a contract change: update
`PUBLIC_DETAILS_ERROR_CODES` in `utils/response-helpers.ts` **and** this table
in the same PR — do not fall back to "make it match the global handler" for
every code.

### R5 — an error body never carries SQL, a stack, or the raw input

The server log keeps all of it. The client gets the code and a message. This is
also what makes the 404-for-foreign-rows rule tolerable: support still sees
`Ownership denied` with the actor and the id.

## Why a foreign resource answers 404

A 403 for a row that exists but is not yours, against a 404 for one that does
not exist, tells any caller which ids are real (H-72). UUID v4 ids are not
brute-forceable, so this is metadata leakage rather than an open door — but the
repo had already settled the question in writing for benefit usages (HOS-376:
*"todo camino ajeno responde 404, nunca 403 — un 403 confirmaría que el id
existe"*), and `accommodation/protected/getById.ts` already complied. Posts and
events dissented only because they delegate to `ownershipMiddleware`.

Both branches now return an **identical** body. A difference in message would
leak exactly what the matching status is there to hide.

**What this costs**: from outside, "exists but is not yours" and "does not
exist" are no longer distinguishable, so a support report loses that hint. The
server log keeps it in full.

### Identical means the whole body, not the status (HOS-600)

H-72 fixed the middleware. HOS-600 found the same leak in **twelve** places that
do the ownership check themselves — five in `src/routes/`, seven in
`@repo/service-core` permission helpers — in two shapes. The second shape is the
one worth remembering, because it survived a review that compared status codes.

`/protected/users/:id` was the visible shape: **403** for a foreign account,
**404** for an unknown id, and the 403's message even named the permission the
caller was missing (*"Only self or users with USER_READ_ALL can view user"*).
Because `findOne` returns soft-deleted rows, it also disclosed accounts that had
been DELETED — not just that an id is real, but that it once was.

`/protected/accommodations/:id` was the invisible shape. Both branches answered
**404 `NOT_FOUND`**. The route hand-wrote `'Accommodation not found'`; the
service composed `` `${entityName} not found` `` → `'accommodation not found'`.
One capital letter, and any status-shaped audit passes it. The experience and
gastronomy twins had copied the same line.

Three rules follow:

1. **The message is composed in one place.** `entityNotFoundError({ entityName })`
   (`@repo/service-core`, `utils/not-found.ts`) builds both branches — the
   missing-row 404 inside `getByField`, and the ownership 404 in the route.
   Never hand-write `'<Entity> not found'` in a route that delegates existence
   to a service: two spellings of one response IS the defect, not the capital.
   Entity names shared between a service and its permissions module live in
   `services/entity-names.ts`, a module that imports nothing — declaring them
   anywhere else produced a cycle in which the class static initialised to
   `undefined` and every message became `'undefined not found'`.
2. **Run the permission check BEFORE the row lookup when that closes the
   oracle.** `user/protected/getById.ts` now refuses a foreign id without
   touching the database. Same body, and no timing difference either.
3. **A refusal names neither the permission nor the id** (rule R5 applied to
   4xx): `'You may only start a subscription for your own commerce listing.'`
   and `` `Entity not found: ${entityType} with id ${entityId}` `` were both
   replaced by a single constant shared by the two branches.

The service-layer half is the one no route-shaped grep finds: `canAccessBookmark`,
`canAccessCollection`, `checkCanAccessAlert` and two inline checks inside
`add`/`removeBookmarkFromCollection` all answered 403 for a foreign row without
ever writing `row.ownerId !== actor.id` in a route file. When sweeping for this
class, sweep both layers.

**Test the pair, not the branch.** Two adjacent green assertions —
"403 when foreign" next to "404 when missing" — is what the bug looked like from
inside the suite. Compare the two answers as ONE value
(`expect(foreign).toEqual(missing)`), never with `expect.objectContaining`,
which is blind to a field only one side carries.

### The write paths, and the one exception (HOS-706)

HOS-600 left two families answering 403 for a row that exists and is not yours,
because closing either was a product call rather than a contract repair. The
owner settled both. They resolved in **opposite directions**, and that is the
point worth keeping: the rule is not "403 is always wrong", it is "a refusal may
not disclose existence unless disclosing it is the product".

#### Resolved to 404 — every write path

`_canUpdate` / `_canSoftDelete` / `_canHardDelete` / `_canRestore` /
`_canUpdateVisibility` answered 403 for a foreign row across **15 entities** —
every entity whose table carries an owner column (`ownerId`, `authorId` or
`userId`): accommodation, accommodationReview, alert, destinationReview,
entityComment, event, experience, experienceReview, gastronomy, gastronomyReview,
ownerPromotion, post, tag, userBookmark, userBookmarkCollection. A caller holding
`*_UPDATE_OWN` learned from that 403 that the id was real.

The fix is one helper, `BaseService._assertWritePermission`, which every write
path reaches through `_getAndValidateEntity`. It runs the hook and passes a
failure through `maskForeignRowRefusal` (`@repo/service-core`,
`utils/foreign-row.ts`). The **authorisation boundary does not move** — the
caller is refused either way; only the disclosure is gone. Because the missing-row
404 (`validateEntity`) and the masked 404 (`entityNotFoundError`) compose the
same `${entityName} not found`, the two answers are byte-identical, not merely
equal in status.

Three refusals stay **403**, each for a different reason, and the mask is
deliberately conditional so they do:

1. **A non-FORBIDDEN error.** An `UNAUTHORIZED` belongs to an earlier tier (R2);
   a plain `Error` is a bug. Neither may be rewritten into a 404.
2. **A row with no owner column.** A catalog entity (amenity, destination,
   partner, attraction, ...) has no ownership dimension, so its 403 discloses
   nothing an admin-tier caller does not already know. Masking it would only make
   the admin panel lie about why a write failed.
3. **A refusal aimed at the row's OWNER.** Then the refusal is about the row's
   STATE, not its existence — `'Cannot edit this accommodation while the owner
   subscription is paused'`, `'Permission denied to update a published event'`.
   The owner already knows the row exists; a 404 would replace an actionable
   reason with a lie. **This is why the mask cannot simply rewrite every 403.**

`updateVisibility` needed its own wiring: it hands `_getAndValidateEntity` a
NO-OP check (that signature cannot carry the requested visibility) and runs the
real gate a few lines below, so "everything goes through `_getAndValidateEntity`"
was true of it while the leak stayed open. That shape is what the second static
assertion in the guard exists to catch.

#### Kept as 403 — the VIP hook, deliberately

`checkCanView` in `accommodation.permissions.ts` refuses a foreign RESTRICTED
listing with **403 `'VIP access required'`**, and that is a **standing, deliberate
exception to the 404 rule** — not an oversight, and not a leftover.

The reasoning is commercial, not technical: a RESTRICTED listing is an upsell
surface. Telling a visitor *"this exists and it is for VIPs"* is exactly what the
visibility tier is sold to do, so hiding it behind a 404 would remove the feature
rather than harden it. The disclosure is the product.

Its sibling — a foreign **PRIVATE** listing — was unified to **404** in the same
change. That one sold nothing: it only confirmed an id was real. So within one
function, PRIVATE now answers 404 and RESTRICTED answers 403, and the difference
is intentional.

**Do not "fix" the VIP 403.** A future sweep for 403-on-foreign-row will find it,
and it will look exactly like the twelve defects HOS-600 repaired. It is not one.
Changing it is an owner decision: edit this section first, then the code and the
test that pins it (`accommodation.permissions.test.ts`, *"keeps the VIP 403"*).

## What enforces this

- [`test/utils/error-contract.guard.test.ts`](../test/utils/error-contract.guard.test.ts)
  — six static assertions, each mutation-tested. A new route that leaves the
  contract fails here.
- `createProtectedRoute` throws **at boot** when a route declares `ownership`
  on a parameter it never declared in `requestParams`.
- [`test/middlewares/ownership.contract.test.ts`](../test/middlewares/ownership.contract.test.ts)
  — behaviour, including the assertion that a malformed id never reaches the
  fetcher. Status alone cannot tell the fix from a coincidence.
- [`test/utils/http-status-to-code.guard.test.ts`](../test/utils/http-status-to-code.guard.test.ts)
  — every status carries its code on both formatters, and no 4xx is
  `INTERNAL_ERROR`.
- [`test/utils/existence-disclosure.guard.test.ts`](../test/utils/existence-disclosure.guard.test.ts)
  — HOS-600, for routes that check ownership themselves rather than through the
  middleware. Two assertions: a branch comparing a row's owner to `actor.id`
  may not construct a 403, and a route that delegates existence to
  `service.getById` may not hand-write its own not-found message. Both
  mutation-tested against the original defects.
- [`packages/service-core/test/utils/write-path-existence-disclosure.guard.test.ts`](../../../packages/service-core/test/utils/write-path-existence-disclosure.guard.test.ts)
  — HOS-706, the WRITE half, and a sibling of the guard above rather than a
  duplicate: the refusal is built in `packages/service-core`, where no pattern
  over `apps/api/src/routes` can see it. Two assertions: the injected permission
  check may only be invoked inside `_assertWritePermission` (which must call
  `maskForeignRowRefusal`), and a file that fetches a row through
  `_getAndValidateEntity` may not then invoke a write-path hook outside the mask.
  Neither anchors on the literal `403` — a refusal can be built from a constant —
  and both carry instrument checks so a rename cannot leave them green while
  policing nothing. The mask's own decision table is pinned behaviourally by
  [`packages/service-core/test/utils/foreign-row.test.ts`](../../../packages/service-core/test/utils/foreign-row.test.ts),
  which a static guard cannot cover: a mask that rewrote every 403 would satisfy
  the guard and break the owner's refusals.
- [`test/routes/existence-disclosure.paired-probe.test.ts`](../test/routes/existence-disclosure.paired-probe.test.ts)
  — the behavioural half: foreign vs invented id on the users, accommodation,
  experience and gastronomy protected reads, compared as whole bodies. Note it
  un-mocks `@repo/service-core` locally: `test/setup.ts` replaces the package
  globally including `ServiceError` itself, and under that mock every route
  error becomes a 500 — a paired probe would compare two artefacts of the mock
  and pass with the bug in place.

## Known exception

The `@qazuor/qzpay-hono` admin tier under `/api/v1/admin/billing/*` builds its
own routes and does not pass through `createAdminRoute`, so the boot assertion
and the ownership guard do not reach it. Its authentication ordering is covered
directly by
[`test/middlewares/billing-admin-auth.middleware.test.ts`](../test/middlewares/billing-admin-auth.middleware.test.ts),
and its error bodies still land in `createErrorHandler`, so R1 and R4 hold. What
is NOT enforced there is R3-style param validation.
