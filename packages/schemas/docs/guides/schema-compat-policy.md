# Schema Compatibility Policy

Backward-compatibility rules for evolving Zod schemas in `@repo/schemas`. Enforced by code review and by compat test suites that replay historic shape fixtures against the current schemas.

## Table of Contents

- [Overview](#overview)
- [Additive-Only Policy](#additive-only-policy)
- [What Counts as Additive](#what-counts-as-additive)
- [What Counts as Breaking](#what-counts-as-breaking)
- [Migration Paths for Breaking Changes](#migration-paths-for-breaking-changes)
- [Historic Shape Fixtures](#historic-shape-fixtures)
- [Compat Test Pattern](#compat-test-pattern)
- [Review Checklist](#review-checklist)
- [Exceptions](#exceptions)

## Overview

`@repo/schemas` is the single source of truth for types and runtime validation across API, admin, web, workers, seeds, and background jobs. Every persisted row, cached blob, message payload, and stored JSONB column in the system is — at some point — validated by a schema defined here. A breaking change to a schema that has already shipped rejects data that used to parse successfully, which means:

- Stored JSONB columns (`posts.media`, `destinations.media`, addon `metadata`, event `extraInfo`, etc.) fail to hydrate into services.
- Cached API responses (signed URLs, search index snapshots) become poison pills until eviction.
- Queue messages produced by previous deploys stop being consumable by new consumers.
- Seed and fixture data shipped from old tags stops round-tripping.

The policy is therefore **additive-only** for all published schemas, with a strict migration path for the narrow set of cases where a breaking change is unavoidable.

## Additive-Only Policy

Published schemas MUST evolve by addition only. Once a field name, shape, or validation rule is shipped to `main`, it is considered part of the public contract and cannot be tightened, renamed, or removed without a migration path.

Concretely:

1. **Never rename a field.** Add the new name, keep the old name, and remove the old name only after a full migration cycle (see [Migration Paths](#migration-paths-for-breaking-changes)).
2. **Never remove a field.** Mark it `.optional()` and `@deprecated` via JSDoc instead; remove only after all producers and all stored/cached data have been migrated.
3. **Never tighten a rule.** Going from `z.string()` to `z.string().min(1)`, from `.optional()` to required, from a free enum to a bounded enum, or from `z.any()` to a structured schema is breaking. Put the tighter rule on a NEW field or a NEW schema variant.
4. **Never change a field's type.** `z.string()` to `z.number()`, `z.date()` to `z.string().datetime()`, array element shape changes — all breaking. Add a new field with the new type and phase out the old one.
5. **Always accept inputs that used to parse.** The ultimate test of the policy is: if a fixture captured from an older version of the schema parses today, the schema is compatible.

Conversely, the following changes ARE additive and safe:

- Adding a new `.optional()` field.
- Widening an enum (adding a new variant).
- Relaxing a validation rule (`.min(5)` → `.min(3)`, `.max(100)` → `.max(500)`).
- Going from required to `.optional()` on an EXISTING field.
- Adding a `.default(...)` that produces a value matching the current type.
- Adding a new schema, new type export, or new helper that does not replace an existing one.

## What Counts as Additive

| Change | Additive? | Notes |
|--------|-----------|-------|
| Add `.optional()` field `publicId` to `ImageSchema` | Yes | Old shapes parse unchanged |
| Add new enum variant `PENDING_REVIEW` to `ModerationStatusEnumSchema` | Yes | Widening is safe |
| Change `description.min(10)` to `description.min(3)` | Yes | Inputs that used to pass still pass |
| Change `featuredImage: ImageSchema` to `featuredImage: ImageSchema.optional()` | Yes | Drafts with no hero image now parse too (GAP-078-185) |
| Add new top-level `attribution` object with all-optional fields | Yes | Old payloads lack it, which is fine |
| Add `.default('Argentina')` to a previously required `country` field | Yes (with care) | Only if the default does not change semantics for in-flight data |

## What Counts as Breaking

| Change | Breaking? | Migration required |
|--------|-----------|--------------------|
| Rename `featuredImage` to `heroImage` | Yes | Dual-write period + `.transform()` alias |
| Remove `moderationState` from `ImageSchema` | Yes | Deprecate, make optional, migrate storage, remove later |
| Remove `DRAFT` from `LifecycleStateEnumSchema` | Yes | Backfill storage first, then remove |
| Tighten `url: z.string()` to `url: z.string().url()` | Yes | Can reject previously stored rows |
| Change `price: z.number()` to `price: z.number().int()` | Yes | Historic floats now reject |
| Change `createdAt: z.date()` to `createdAt: z.string().datetime()` | Yes | Type flip breaks consumers |
| Change array element shape (`gallery: z.array(ImageSchema)` inner shape) | Yes | Stored JSONB becomes invalid |

## Migration Paths for Breaking Changes

Breaking changes are never applied in a single commit. The only supported migration pattern has three phases:

1. **Additive phase (one release).** Introduce the new field or variant as optional. Teach writers to populate both old and new. Add a compat test that verifies BOTH shapes parse.
2. **Backfill phase (one or more releases).** Migrate every stored value (DB column, cache, queue, seed) to the new shape via a manual SQL migration in `packages/db/src/migrations/manual/` (see push-only migration policy in root `CLAUDE.md`). Keep the old field optional. Update readers to prefer new, fall back to old.
3. **Removal phase (final release).** Once no producer and no storage uses the old field, remove it. Update the compat fixture set — removed shapes move to `test/fixtures/historic/archived/` with a comment explaining when and why they were retired.

Every breaking change MUST be justified in an ADR or a SPEC entry referenced by the PR description. "The old name was ugly" is not a justification; "the old name conflicted with a new compliance requirement" might be.

## Historic Shape Fixtures

To mechanically enforce the additive-only policy, `@repo/schemas` keeps a catalog of historic shapes captured from real payloads and from previous schema versions. Current schemas MUST `safeParse` every historic fixture successfully (unless the fixture has been formally archived during a removal phase).

Fixture location: `packages/schemas/test/fixtures/historic/<domain>.historic.ts`.

Each historic fixture file exports:

- A set of plain-object fixtures representing shapes that were valid at some point in time.
- A short JSDoc comment per fixture noting WHEN the shape was produced (release tag, SPEC id) and WHY it is preserved.
- No faker usage and no randomness — historic fixtures are static, deterministic, and committed verbatim so that they can be diffed across time.

Example index:

```ts
// packages/schemas/test/fixtures/historic/media.historic.ts

/**
 * Pre-SPEC-078 image shape. Only required `url` and `moderationState`.
 * No `caption`, `description`, `publicId`, or `attribution`.
 */
export const imagePreSpec078 = {
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/legacy/hero.jpg',
    moderationState: 'APPROVED'
} as const;

/**
 * Pre-SPEC-078 media shape where `featuredImage` was required. Verifies that
 * the additive `gallery` / `videos` extensions did not break legacy payloads.
 */
export const mediaPreSpec078 = {
    featuredImage: imagePreSpec078
} as const;
```

## Compat Test Pattern

Each domain with historic fixtures has a dedicated `.compat.test.ts` file alongside the primary schema test. The compat suite is intentionally minimal: it asserts that today's schema can still parse yesterday's data.

```ts
// packages/schemas/src/common/__tests__/media.schema.compat.test.ts
import { describe, expect, it } from 'vitest';
import { ImageSchema, MediaSchema } from '../media.schema';
import {
    imagePreSpec078,
    mediaPreSpec078
} from '../../../test/fixtures/historic/media.historic';

describe('media schema — historic compat', () => {
    it('accepts pre-SPEC-078 image shape (url + moderationState only)', () => {
        const result = ImageSchema.safeParse(imagePreSpec078);
        expect(result.success).toBe(true);
    });

    it('accepts pre-SPEC-078 media shape (featuredImage only)', () => {
        const result = MediaSchema.safeParse(mediaPreSpec078);
        expect(result.success).toBe(true);
    });
});
```

Compat tests MUST:

- Live next to the primary schema tests (same directory, `.compat.test.ts` suffix).
- Only import historic fixtures from `test/fixtures/historic/`. Never use faker.
- Never be skipped. A failing compat test blocks the PR — either the change is additive (and the test should pass) or it is breaking (and the migration path above must be followed).

## Review Checklist

Reviewers of any PR that touches `packages/schemas/src/**` MUST confirm:

- [ ] No field was renamed or removed.
- [ ] No validation rule was tightened (including changes from optional to required).
- [ ] No field type was changed.
- [ ] Every new field is `.optional()` (or has a `.default(...)` compatible with existing data).
- [ ] If the change is intentionally breaking, an ADR / SPEC reference is in the PR body AND the three-phase migration plan is spelled out.
- [ ] Compat tests for the touched domain still pass.
- [ ] If a new historic shape was captured during this change, it was added under `test/fixtures/historic/`.

## Exceptions

The only exception to the additive-only policy is:

- **Pre-release / draft schemas** (`status: draft` in spec front-matter, not yet consumed by a shipped app). These may be freely reshaped until the owning SPEC transitions to `in-progress` or `completed`. After that, the policy locks in.

Everything else — including schemas that "obviously" nobody uses yet — is treated as public contract. If you are unsure whether a schema has shipped, assume it has.

## Related

- `packages/schemas/CLAUDE.md` — schema package guidelines.
- `packages/schemas/docs/guides/composition.md` — how to extend schemas additively.
- `packages/schemas/docs/guides/testing.md` — general testing patterns.
- `.claude/specs/SPEC-078-GAPS/spec.md` — source of the policy (GAP-078-122, GAP-078-201).
- Root `CLAUDE.md` → "Push-only Migration Policy" — how DB migrations interact with this policy.
