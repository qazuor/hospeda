/**
 * `featuredByEntitlement` is not writable from a request body (HOS-1286).
 *
 * The column is the paid product this issue sells: holding it features a
 * listing in search results. It is written by the add-on checkout confirmation,
 * the sync primitives and the reconcile cron — and by nothing a caller can
 * reach.
 *
 * ## Why this file exists next to the HOS-1113 guard
 *
 * `write-input-server-written.guard.test.ts` already froze the accepted field
 * set of every write schema, and it is what caught this: adding the column to
 * the two commerce base schemas landed it in `GastronomyUpdateInputSchema`
 * automatically, because those schemas are built with `.omit()` and a field is
 * accepted unless it is named. An owner could have sent
 * `featuredByEntitlement: true` in their own PATCH and featured their listing
 * without buying the add-on.
 *
 * That guard is a frozen-set diff, so it phrases the failure as "this set
 * changed". These cases phrase it as the thing that must never be true —
 * **a hostile body cannot set this field** — and they name the two commerce
 * verticals explicitly, so removing the omit from ONE of them fails with the
 * vertical in the message rather than as a set delta.
 *
 * @module test/entities/commerce-featured-by-entitlement-not-writable
 */

import { describe, expect, it } from 'vitest';
import {
    ExperienceAdminCreateInputSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../../src/entities/experience/experience.crud.schema.js';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyOwnerCreateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../src/entities/gastronomy/gastronomy.crud.schema.js';

/** Minimal `safeParse` surface — the schemas differ in their generics. */
interface Parseable {
    safeParse(value: unknown): { success: boolean; data?: unknown };
}

/**
 * Every write schema a REQUEST BODY can reach, per commerce vertical.
 *
 * Both verticals are listed for all four tiers on purpose. The bug this file
 * guards was present in exactly one of the eight (gastronomy's generic update)
 * while the other seven were already correct — so a table that checked "the
 * vertical" rather than each schema would have passed.
 */
const WRITE_SCHEMAS: ReadonlyArray<{
    vertical: 'gastronomy' | 'experience';
    name: string;
    schema: Parseable;
}> = [
    {
        vertical: 'gastronomy',
        name: 'GastronomyOwnerCreateInputSchema',
        schema: GastronomyOwnerCreateInputSchema as unknown as Parseable
    },
    {
        vertical: 'gastronomy',
        name: 'GastronomyOwnerUpdateInputSchema',
        schema: GastronomyOwnerUpdateInputSchema as unknown as Parseable
    },
    {
        vertical: 'gastronomy',
        name: 'GastronomyAdminCreateInputSchema',
        schema: GastronomyAdminCreateInputSchema as unknown as Parseable
    },
    {
        vertical: 'gastronomy',
        name: 'GastronomyUpdateInputSchema',
        schema: GastronomyUpdateInputSchema as unknown as Parseable
    },
    {
        vertical: 'experience',
        name: 'ExperienceOwnerCreateInputSchema',
        schema: ExperienceOwnerCreateInputSchema as unknown as Parseable
    },
    {
        vertical: 'experience',
        name: 'ExperienceOwnerUpdateInputSchema',
        schema: ExperienceOwnerUpdateInputSchema as unknown as Parseable
    },
    {
        vertical: 'experience',
        name: 'ExperienceAdminCreateInputSchema',
        schema: ExperienceAdminCreateInputSchema as unknown as Parseable
    },
    {
        vertical: 'experience',
        name: 'ExperienceUpdateInputSchema',
        schema: ExperienceUpdateInputSchema as unknown as Parseable
    }
];

describe('HOS-1286 — featuredByEntitlement is never accepted from a request body', () => {
    it.each(WRITE_SCHEMAS)('$name ($vertical) does not carry featuredByEntitlement through', ({
        schema
    }) => {
        // Parsing may FAIL for unrelated reasons (a create schema wants a
        // name, a destinationId, …) — that is fine and not what is under
        // test. What must never happen is the key surviving into `data`,
        // because that is the value the service would write.
        const result = schema.safeParse({ featuredByEntitlement: true });

        const data = (result.data ?? {}) as Record<string, unknown>;
        expect(Object.hasOwn(data, 'featuredByEntitlement')).toBe(false);
    });

    it.each(
        WRITE_SCHEMAS
    )('$name ($vertical) still strips it when the body is otherwise plausible', ({ schema }) => {
        // The single-key body above could be rejected wholesale before any
        // stripping happens, which would make the assertion vacuous. This
        // one rides alongside fields these schemas do accept, so the parse
        // gets far enough for the strip to be the thing doing the work.
        const result = schema.safeParse({
            name: 'A plausible listing',
            summary: 'A plausible summary that is long enough to look real.',
            description:
                'A plausible description that is comfortably long enough to pass any minimum length check applied to it.',
            featuredByEntitlement: true
        });

        const data = (result.data ?? {}) as Record<string, unknown>;
        expect(Object.hasOwn(data, 'featuredByEntitlement')).toBe(false);
    });

    it('accepts isFeatured where it is meant to, so the strip is not blanket', () => {
        // Non-vacuity, and the distinction that matters: `isFeatured` is the
        // ADMIN-curated flag and stays writable on the admin tier. A change that
        // stripped both would pass every assertion above while quietly removing
        // a capability admin has.
        const result = GastronomyUpdateInputSchema.safeParse({ isFeatured: true });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ isFeatured: true });
    });
});
