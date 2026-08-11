/**
 * The API's single source for `z` (HOS-430).
 *
 * Every schema in `apps/api` must import `z` from here, never from
 * `@hono/zod-openapi` and never from `zod` directly. Two independent reasons,
 * and each one alone is enough to justify this module:
 *
 * ## 1. `@hono/zod-openapi` re-exports `z` untyped
 *
 * Its `z` re-export resolves to `any` as of 1.5.2 (it was correctly typed in
 * 1.4.0 — verified against that version as a control). Because `any` silences
 * rather than errors, taking that re-export means `z.object({...})` yields an
 * `any` schema and `.parse()` returns `any`: request and response schemas stop
 * being type-checked at all, and CI stays green while it happens. Only the
 * handful of call sites that tripped `noImplicitAny` ever surfaced an error.
 * Sourcing `z` from `zod` itself restores full inference and makes any future
 * `@hono/zod-openapi` release unable to degrade our schemas again.
 *
 * ## 2. `.openapi()` is a monkey-patch, and it needs ordering
 *
 * `.openapi()` is NOT part of zod. `@hono/zod-openapi` patches it onto zod's
 * prototype as an import side effect (both packages resolve to the same zod
 * instance, which is what makes the patch visible at all). The accompanying
 * `declare module 'zod'` augmentation is global, so `.openapi()` type-checks
 * from ANY module whether or not the patch has actually run.
 *
 * That gap is the hazard: a module importing `z` straight from `zod` compiles
 * fine and then throws `.openapi is not a function` at runtime if it happens to
 * evaluate before anything has imported `@hono/zod-openapi`. Whether it breaks
 * depends on module evaluation order — so it can pass in the running app and
 * fail in a unit test that imports a schema file on its own.
 *
 * The side-effect import below closes that gap by construction: anything that
 * reaches `z` through this module has already applied the patch.
 *
 * @see HOS-430
 * @see apps/api/test/utils/zod-barrel.guard.test.ts — keeps the old import from creeping back
 */

// Side-effect import: applies `.openapi()` to zod's prototype. Do NOT remove or
// convert this to a type-only import — the patch is the whole point.
import '@hono/zod-openapi';
import { z } from 'zod';

export { z };
