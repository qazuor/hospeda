# ADR-025: Factory-Level Strict Response Strip

**Status**: Accepted
**Date**: 2026-04-29
**Spec**: SPEC-087

## Context

The Hospeda API exposes three tiers of routes (public, protected, admin) and
each tier has its own response schemas in `@repo/schemas` (e.g.
`AccommodationPublicSchema`, `OwnerPromotionPublicSchema`). The schemas are
declared on every route via the `responseSchema` option of the route factories
in `apps/api/src/utils/route-factory.ts`.

Until SPEC-062, that option was used **only** to generate OpenAPI
documentation: handlers returned arbitrary objects and the `responseSchema`
never touched the runtime payload. As a consequence, every admin-only field
that a service happened to retain (`lifecycleState`, `audit`, `ownerId`,
`moderation`, etc.) leaked into public responses by default unless the
handler manually called `XPublicSchema.parse(item)` before returning.

SPEC-062 introduced `stripWithSchema()` and wired it into `createResponse` /
`createPaginatedResponse` so the strip happens at the factory layer. The
chosen failure semantic at that point was **permissive**: when
`responseSchema.safeParse(payload)` failed, the helper logged a `warn` and
returned the original (unstripped) payload as a fallback. That kept routes
available, but a drift between handler payload and declared contract was
silenced — exactly the "extra field disclosure" risk the strip was meant to
prevent.

SPEC-087 reopened the question with the discovery in SPEC-063 T-022: the
public OwnerPromotion route was returning `lifecycleState` because the
service retained it and the per-handler strip had not been added yet. The
permissive fallback meant production would continue to leak silently while
the warning piled up in logs.

### Goal

Every public/protected route should drop fields that the declared
`responseSchema` does not pick. A drift between the handler's payload shape
and the declared schema is a server bug and must surface immediately, not
fall through with a log line.

## Considered Options

### Option A — Strict throw at the factory (chosen)

Modify `stripWithSchema` so that a `safeParse` failure logs a structured
**error** and throws `ServiceError(INTERNAL_ERROR)`. The global error handler
already maps `INTERNAL_ERROR` to HTTP 500 with a generic message that does
not include the unstripped payload. The caller never sees the leaked fields.

**Pros**:

- Single point of control. Every route that declares `responseSchema`
  inherits the contract.
- Drift is loud and debuggable. The first request after a deploy that
  introduces drift fails noisily; the issue lands on the on-call dashboard
  rather than rotting in `warn` logs.
- Handler authors can no longer rely on "the schema is just for docs".
  Either the schema matches the payload, or the route does not work.

**Cons**:

- Requires a one-time audit of every existing route to confirm none of them
  drift. We did this audit during SPEC-087 and it surfaced zero real drifts;
  the only failures were the permissive-mode unit tests themselves, which
  were rewritten to assert the new strict behavior.
- Per-item parse cost on list responses. `safeParse` for a 100-item page is
  measurable but well under the surrounding service / DB cost. No benchmark
  regression observed.

### Option B — Feature-flagged strict mode

`HOSPEDA_API_STRICT_RESPONSE_VALIDATION=true` in dev (throw), `false` in
prod (warn-and-fallback). Promote to default after a soak window.

**Rejected** because the audit in Option A surfaced zero drifts. A flag adds
config surface, two execution paths to test, and an inevitable "should we
flip the flag yet" debate. The drift risk is real but localized; we prefer
to fix it once and remove the option than to maintain two response
semantics.

### Option C — Per-handler strip + lint rule

Keep the factory permissive; add a `stripResponse(schema, payload)` helper
and a custom lint rule that flags public handlers missing the call.

**Rejected**: same per-handler boilerplate problem SPEC-087 was opened to
remove. Biome has limited custom-rule support and humans forget. The factory
is the one place that already has the schema; do the work there.

### Option D — Documentation-only

Add a section to `apps/api/CLAUDE.md` telling handler authors to strip
manually.

**Rejected**: SPEC-063 T-022 proves this does not hold. The first time an
admin-only field is added to a service retain set, a public route leaks it
until a dedicated test catches it.

## Decision

Adopt Option A. `stripWithSchema()` always parses with the declared
`responseSchema` and throws on failure. The route factory tests cover both
the happy path (extra fields dropped) and the drift path (HTTP 500 without
leak).

## Consequences

- Every public/protected route in `apps/api/src/routes/` is now
  runtime-validated against its `responseSchema`. The audit during SPEC-087
  confirmed no drifts in the current codebase.
- The previous per-handler strip in
  `apps/api/src/routes/owner-promotion/public/list.ts` (SPEC-063 T-022) is
  removed; the factory does the work.
- `apps/api/test/route-factory/response-strip.test.ts` covers the strict
  behavior via the real factory functions. The replacement
  `apps/api/test/schema-validation/field-enforcement/strict.test.ts`
  exercises the same semantics through the full app via the public
  accommodation route.
- Future handler authors do not need to do anything to opt in. Authors who
  break the contract see a 500 in dev/CI and a structured server-side error
  log; the response body never carries the unstripped payload.

## References

- SPEC-087 spec (closed by this ADR)
- SPEC-062 (introduced `stripWithSchema` in permissive mode)
- SPEC-063 T-022 (discovery of the leak in public OwnerPromotion list)
- `apps/api/src/utils/response-helpers.ts` — `stripWithSchema`,
  `createResponse`, `createPaginatedResponse`
- `apps/api/src/utils/route-factory.ts` — `createSimpleRoute`,
  `createCRUDRoute`, `createListRoute`
- `apps/api/src/utils/route-factory-tiered.ts` — public/protected/admin
  factories that delegate to the above
