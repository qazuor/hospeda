/**
 * Fail-closed guard: no update/patch schema may materialise a `.default()` for
 * a key the caller did not send.
 *
 * ## The defect this exists to prevent
 *
 * In Zod 4, `.partial()` does NOT suppress `.default()`:
 *
 * ```
 * z.object({ a: z.string(), b: z.boolean().default(false) })
 *   .partial()
 *   .parse({ a: 'x' })                    // → { a: 'x', b: false }
 * ```
 *
 * `b` was never sent, yet it comes out of the parse. Services spread that
 * parsed object into `model.update()`, which issues a literal SQL `SET` of
 * every key present — so a PATCH touching one field silently overwrites others
 * with their defaults. The user sees an optimistic UI showing what they
 * intended and a database holding something else; the divergence only surfaces
 * on the next page load.
 *
 * ## Why a guard and not N tests
 *
 * This has been found three times, in three unrelated waves:
 *
 * - **SPEC-217** introduced `stripShapeDefaults` and applied it to ~32 canonical
 *   `*UpdateInputSchema` exports.
 * - **HOS-375** found the NESTED variant (a default inside an object field,
 *   which `stripShapeDefaults` does not reach — it peels one level).
 * - **H-129** (Aug 2026 smoke) found it live in production on the external
 *   listing toggles: turning "show link" on turned "show reviews" off, because
 *   the owner UI sends exactly one field per toggle.
 *
 * Each wave fixed the instances it knew about. The sweep after H-129 found
 * fifteen more, every one of them reaching `.partial()` by a path the SPEC-217
 * pass had not walked — owner/self-service schemas derived straight from the
 * entity, and the `social/*` CRUD template. Fixing them one at a time leaves
 * the next path open, which is how this got to three waves. A predicate over
 * every export closes the class instead of the instance.
 *
 * ## How it probes, and why field-by-field
 *
 * For each schema it takes the object shape and asks every field directly:
 * `field.safeParse(undefined)`. A field that accepts `undefined` and hands back
 * something other than `undefined` is, by definition, materialising a value for
 * a key the caller never sent. That is the exact user-visible behaviour rather
 * than an introspection of Zod internals, so it cannot drift when Zod changes
 * how it represents defaults.
 *
 * An earlier draft parsed `{}` against the whole schema instead. It worked, but
 * it skipped every schema with a required key — around sixty of them, including
 * real update bodies like `AccommodationFaqUpdateInputSchema`. A schema with a
 * required `id` AND a defaulted flag is exactly as vulnerable, and the whole-object
 * probe could not see it. Asking each field separately has no such blind spot.
 *
 * ## What it does not cover
 *
 * Only the TOP level of each shape, matching what `stripShapeDefaults` fixes.
 * The nested variant (a default inside an object-typed field) is HOS-375's
 * territory and has its own recursive regression test at
 * `test/entities/user/user.settings-patch.hos375.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as schemaModule from '../src/index.js';

/**
 * The barrel, widened to a plain record.
 *
 * Iterating `Object.entries` over the module namespace directly makes TypeScript
 * build a union of every exported schema type, which exceeds its complexity
 * limit (`TS2590`). Nothing here depends on those types — the guard probes
 * behaviour — so collapsing to `unknown` values is both sufficient and the
 * only thing that compiles.
 */
const schemas = schemaModule as unknown as Record<string, unknown>;

/** The parse surface we probe. Avoids depending on Zod's exported types. */
interface Parseable {
    readonly safeParse: (value: unknown) => { success: boolean; data?: unknown };
}

/** An object schema, i.e. one exposing a `shape`. */
interface WithShape {
    readonly shape: Record<string, Parseable>;
}

const isParseable = (value: unknown): value is Parseable =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function';

const getShape = (value: unknown): Record<string, Parseable> | null => {
    const shape = (value as { shape?: unknown }).shape;
    if (typeof shape !== 'object' || shape === null) {
        return null;
    }
    return (shape as WithShape['shape']) ?? null;
};

/**
 * Exports whose name marks them as an update/patch input.
 *
 * **`Update`/`Patch` can appear anywhere in the name, not just at the start.**
 * The first draft anchored on `/^(Update|Patch).*Schema$/` and matched 15
 * exports — missing `HostTradeOwnerUpdateSchema`,
 * `SocialPlatformFormatUpdateSchema`, `updatePartnerSchema` and most of the
 * `social/*` family, i.e. nearly every schema it was written to catch. It would
 * have shipped green over live bugs. Keep this permissive: a few extra schemas
 * being checked costs nothing, a missed one costs everything.
 */
const PATCH_SCHEMA_NAME = /(update|patch)/i;

/**
 * Names excluded because they describe a RESPONSE, not a request body.
 *
 * A default on a response schema is harmless and often correct: it documents
 * what the server returns for a field the server always fills. The defect being
 * guarded is specific to a body that gets spread into a SQL `SET`, and an
 * `*OutputSchema` / `*ResponseSchema` is never wired as a `requestBody`.
 *
 * This is a scope statement, not an escape hatch: the exclusion is by suffix,
 * which the codebase applies consistently, and it excludes a KIND of schema
 * rather than named individuals. Adding a real update body to this list — by
 * naming it `…OutputSchema` — would be visible in review as an obviously wrong
 * name.
 */
const RESPONSE_SCHEMA_NAME = /(Output|Response)Schema$/;

/** One schema's verdict. */
interface Probe {
    readonly name: string;
    readonly materialised: readonly string[];
}

function probeAll(): { offenders: Probe[]; unprobed: string[] } {
    const offenders: Probe[] = [];
    const unprobed: string[] = [];

    for (const [name, value] of Object.entries(schemas)) {
        if (
            !PATCH_SCHEMA_NAME.test(name) ||
            RESPONSE_SCHEMA_NAME.test(name) ||
            !isParseable(value)
        ) {
            continue;
        }

        const shape = getShape(value);
        if (shape === null) {
            // Wrapped (e.g. in `.superRefine()`), so the shape is not reachable.
            // Fall back to probing the whole schema with an empty object.
            const result = value.safeParse({});
            if (!result.success) {
                unprobed.push(name);
                continue;
            }
            const keys =
                typeof result.data === 'object' && result.data !== null
                    ? Object.keys(result.data)
                    : [];
            if (keys.length > 0) {
                offenders.push({ name, materialised: keys });
            }
            continue;
        }

        const materialised = Object.entries(shape)
            .filter(([, field]) => {
                if (!isParseable(field)) {
                    return false;
                }
                const parsed = field.safeParse(undefined);
                return parsed.success && parsed.data !== undefined;
            })
            .map(([key]) => key);

        if (materialised.length > 0) {
            offenders.push({ name, materialised });
        }
    }

    return { offenders, unprobed };
}

describe('update/patch schemas must not materialise defaults', () => {
    it('checks a meaningful number of schemas — a silent zero would pass vacuously', () => {
        // A renamed convention or a broken barrel export would make the real
        // assertion below pass over an empty set. Verify the instrument detects
        // anything at all before trusting what it reports.
        const checked = Object.entries(schemas).filter(
            ([name, value]) =>
                PATCH_SCHEMA_NAME.test(name) &&
                !RESPONSE_SCHEMA_NAME.test(name) &&
                isParseable(value)
        );
        expect(checked.length).toBeGreaterThan(100);
    });

    it('detects a default that survives .partial() — the instrument works', () => {
        // Positive control. Without this, "0 offenders" could equally mean
        // "everything is fixed" or "the probe never fires".
        const vulnerable = z.object({ a: z.string(), b: z.boolean().default(false) }).partial();

        const field = vulnerable.shape.b as unknown as Parseable;
        const parsed = field.safeParse(undefined);

        expect(parsed.success).toBe(true);
        expect(parsed.data).toBe(false);
    });

    it('no schema materialises a value for an absent key', () => {
        const { offenders } = probeAll();

        const detail = offenders
            .map((o) => `  ${o.name} → would SET: ${o.materialised.join(', ')}`)
            .join('\n');

        expect(
            offenders,
            offenders.length === 0
                ? ''
                : `${offenders.length} update/patch schema(s) materialise a default for a key the caller never sent.\n` +
                      'On a partial PATCH each one silently overwrites those columns.\n' +
                      'Fix: wrap the shape in stripShapeDefaults(...) before .partial().\n' +
                      `${detail}\n`
        ).toEqual([]);
    });

    it('leaves nothing silently unprobed', () => {
        const { unprobed } = probeAll();

        // A schema lands here only when it exposes no `shape` (it is wrapped)
        // AND rejects `{}`. Nothing in the codebase does both today. If this
        // starts failing, the newcomer needs a hand-written regression test —
        // do NOT widen this assertion to absorb it.
        expect(unprobed).toEqual([]);
    });
});
