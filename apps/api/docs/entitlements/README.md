# Entitlements and listing authorization

The old entitlement middlewares (`entitlementMiddleware`, `requireEntitlement`,
`requireLimit`, the per-vertical gate files) no longer exist. They were removed with
the QZPay billing stack (HOS-1352). Architecture overview:
[root CLAUDE.md → Billing and verticals](../../../../CLAUDE.md#billing-and-verticals-hos-1352).

## How an operation is authorized

A protected listing route calls `enforceListingAccess`
(`apps/api/src/middlewares/listing-access.ts`), which calls `resolveListingAccess`
(`packages/verticals/src/authorization/resolve-listing-access.ts`). The pipeline, in
order, stopping at the first refusal:

1. Vertical precondition: the declared vertical must match the resource (else `NOT_FOUND`).
2. Step 1, who: a guest fails on every operation except `READ_PUBLIC` (`UNAUTHENTICATED`).
   Staff bypass of unverified actors is filtered by `src/middlewares/step2-staff-bypass.ts`.
3. Step 3, administrative action: only when the route declares one; the permission
   is checked and the listing owner becomes the subject.
4. Step 4, resource: ownership and publication state must admit the operation
   (`NOT_FOUND` / `FORBIDDEN`).
5. Step 5, coverage: the subject must hold at least one coverage source in the
   vertical (`NO_COVERAGE`).
6. Step 6, capability: the effective set must grant the operation's key
   (`OPERATION_STEP6_KEY`) plus any `requiredKeys` (`NO_CAPABILITY`).
7. Step 7, limit: the requested count must fit the limit in the effective set
   (`LIMIT_REACHED`).

The middleware maps each refusal to a `ServiceError` (`ENTITLEMENT_REQUIRED`,
`LIMIT_REACHED`, `FORBIDDEN`, ...), turned into HTTP by `src/middlewares/response.ts`.
Never throw `HTTPException(403)` for these.

## Effective set

`packages/verticals/src/effective-set/` computes what an account may do in a vertical
by folding its live coverage sources (plan versions, trial, grants) per the strategy
each key declares in the catalog. `effective-set-cache/` is the Redis cache in front of
it. Routes receive it through the `effectiveSet` port from
`apps/api/src/utils/listing-access/ports.ts`.

## Keys

Entitlement keys and limit keys, with scope, aggregation and enforcement, are the
catalog in `packages/schemas/src/catalog/` (`entitlement-keys.ts`, `limit-keys.ts`,
`key-catalog.ts`). The catalog holds names and attributes only; values live in plan
versions.

## Tourist VIP inheritance

A live non-trial title in any other vertical whose plan version has
`inheritsTouristVip` grants the Tourist VIP set in the tourist vertical
(`packages/verticals/src/effective-set/tourist-vip-inheritance.ts`; HTTP read:
`src/routes/billing-subscription/tourist-vip-inheritance.ts`).
