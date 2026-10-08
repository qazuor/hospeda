/**
 * TEST:V2:10 (a) — unit, without a database: cause (a) of G-R3 (HOS-1436, piece
 * V2.3, AC:V2:7) decides whether an entitlement is metered with the pure
 * function `isMeteredEntitlement` that `@repo/verticals` exports (V3.2,
 * HOS-1440 / HOS-1654), not with a rule of the plan-catalog module.
 *
 * A version of a non-sellable role (`pre_trial` or `floor`) that grants a
 * metered entitlement is rejected with `clave de más`; one that grants a BASE
 * key without quotas is not rejected by (a).
 *
 * The integration twin of this case is
 * `apps/api/test/integration/plan-publication/plan-publication.rejections.test.ts`
 * (same test id, with the database).
 */
import { getCatalogKey, type PlanRole, type PlanVersionContentInput } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PLAN_PUBLICATION_REJECTIONS } from '../../../src/services/plan-catalog/plan-publication.rejections';
import type { PublicationContext } from '../../../src/services/plan-catalog/plan-publication.types';
import { validatePublication } from '../../../src/services/plan-catalog/plan-publication.validation';

const PLAN_ID = '00000000-0000-0000-0000-000000000001';

/** The class of each key, read from the code catalog like the reader does. */
function keyClassesFor(keys: readonly string[]): ReadonlyMap<string, string> {
    return new Map(
        keys.map((key) => {
            const definition = getCatalogKey({ key });
            if (!definition) throw new Error(`the catalog does not declare ${key}`);
            return [key, definition.keyClass];
        })
    );
}

/** A hand-built context of a non-sellable role; it touches no database. */
function contextOf(input: {
    role: PlanRole;
    entitlements: PlanVersionContentInput['entitlements'];
}): PublicationContext {
    return {
        planId: PLAN_ID,
        vertical: 'accommodation',
        activationEvent: null,
        role: input.role,
        previous: null,
        catalog: [],
        content: {
            rank: 1,
            sellable: false,
            trialDays: 0,
            graceDays: 0,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: input.entitlements,
            limits: []
        },
        keyClasses: keyClassesFor(input.entitlements.map((item) => item.key))
    };
}

describe('TEST:V2:10 (a) — a non-sellable version and the metered decision', () => {
    it('pre_trial: a metered entitlement (both quotas) is rejected with clave de más', () => {
        const context = contextOf({
            role: 'pre_trial',
            entitlements: [{ key: 'subscribe_to_plan', planQuota: 5, trialQuota: 5 }]
        });

        expect(() => validatePublication({ context })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('pre_trial: a BASE entitlement without quotas is not rejected by (a)', () => {
        const context = contextOf({
            role: 'pre_trial',
            entitlements: [{ key: 'subscribe_to_plan' }]
        });

        expect(() => validatePublication({ context })).not.toThrow();
    });

    it('floor: a metered entitlement (both quotas) is rejected with clave de más', () => {
        const context = contextOf({
            role: 'floor',
            entitlements: [{ key: 'subscribe_to_plan', planQuota: 5, trialQuota: 5 }]
        });

        expect(() => validatePublication({ context })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('floor: its two BASE keys without quotas are not rejected by (a)', () => {
        const context = contextOf({
            role: 'floor',
            // The floor must grant both required keys anyway (cause (b)), so the
            // only cause that could fire on the metered decision under test is (a).
            entitlements: [{ key: 'subscribe_to_plan' }, { key: 'recover_own_listing' }]
        });

        expect(() => validatePublication({ context })).not.toThrow();
    });
});
