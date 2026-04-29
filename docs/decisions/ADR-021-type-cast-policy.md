# ADR-021: `as unknown as X` Double-Cast Policy

**Status**: Accepted
**Date**: 2026-04-29
**Spec**: SPEC-039

## Context

The codebase contained ~200 occurrences of the `as unknown as X` double-cast
pattern across production source. This pattern silences TypeScript's type
checker entirely — there is no compile-time or runtime check that the value
on the left actually conforms to the type on the right. Misuse falls into
three categories:

- **Category A — runtime risk**: data fetched from untrusted/network sources
  (webhooks, API responses, third-party SDK payloads) cast directly to a
  domain type without any runtime validation. A backend shape change
  silently corrupts the consumer.
- **Category B — Drizzle ORM limitation**: query results from Drizzle models
  cast to domain types because the ORM's inferred shape doesn't always line
  up with the application-level entity shape. No runtime risk (the data has
  already been validated/typed by the DB schema), but the cast hides
  legitimate type drift.
- **Category C — library type-variance workaround**: cases where two types
  are structurally compatible but TypeScript can't prove it (route-factory
  generics, branded-type vs unbranded equivalence, etc.). No runtime risk.

## Decision

### Decisions

1. **All Category A casts are removed from app source**. Untrusted data must
   be parsed through a Zod schema before it reaches the cast site.
   Preferred location for the parse is the data-entry boundary (e.g. the
   `queryFn` of a TanStack Query hook), so consumers receive properly typed
   values without local casts.
2. **Every remaining cast (Cat B and Cat C) carries a documenting marker**:
   - `// DRIZZLE-LIMITATION: <reason>` for casts inside
     `packages/db/src/models/**` (Drizzle ORM type-inference gaps).
   - `// TYPE-WORKAROUND: <reason>` for casts everywhere else (route-factory
     generics, branded-type compatibility, JSONB shape, etc.).

   The marker may appear on the cast's line (end-of-line) or on any of the
   5 lines immediately above it (multi-line cast expressions can have the
   marker a few lines above the `as unknown as` token).
3. **CI guard**: `scripts/check-type-casts.sh` scans every `as unknown as`
   in tracked production source and fails CI if any cast lacks the
   appropriate marker. There is NO baseline file — the bar is "all casts
   documented", which means a single new undocumented cast fails the build.
4. **Adding a cast requires reviewer scrutiny**. The marker comment is the
   author's evidence; the reviewer's job is to confirm the justification
   stands (structural equivalence, branded type, runtime-safe shape, etc.)
   and that a Zod parse / proper typing isn't the better fix.

### Out of scope for this ADR

- A Biome lint rule that enforces the marker convention automatically. The
  shell guard is sufficient for now; a Biome rule can replace it later
  without a new policy decision.
- Test files. Tests are excluded from the guard — type assertions in tests
  exist to construct mocks and don't carry runtime risk.
- `@repo/schemas` is excluded — branded-type variance there is intentional
  and lives in the schema source of truth.

## Consequences

### Positive

- Untrusted data paths are validated before reaching the UI/service code,
  reducing the blast radius of a backend shape change.
- The CI guard prevents regression: a new undocumented cast fails CI.
- The decision to defer Cat B is explicit, not hidden. A follow-up spec is
  expected.

### Negative

- Adding a new genuinely-needed cast forces the author to write a
  justification comment, which is a small friction tax. Acceptable — that
  friction surfaces the cast in code review where it can be challenged.
- Reviewers must read each marker on a new cast and verify the justification
  is honest. There is no automatic semantic check; the convention relies on
  reviewer attention.

### Neutral

- The marker convention is a project-local string match, not a TypeScript or
  Biome-level enforcement. A future Biome rule could replace the shell
  guard without a new policy decision.

## References

- `scripts/check-type-casts.sh` — documentation-enforcement guard
- 91 casts documented at adoption (23 `// DRIZZLE-LIMITATION:`, 68
  `// TYPE-WORKAROUND:`).
