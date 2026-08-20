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

## Known exception

The `@qazuor/qzpay-hono` admin tier under `/api/v1/admin/billing/*` builds its
own routes and does not pass through `createAdminRoute`, so the boot assertion
and the ownership guard do not reach it. Its authentication ordering is covered
directly by
[`test/middlewares/billing-admin-auth.middleware.test.ts`](../test/middlewares/billing-admin-auth.middleware.test.ts),
and its error bodies still land in `createErrorHandler`, so R1 and R4 hold. What
is NOT enforced there is R3-style param validation.
