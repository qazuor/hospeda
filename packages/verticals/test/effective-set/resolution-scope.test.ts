/**
 * TEST:V3:4 (HOS-1440, V3.2, AC:V3:3; `V/15` §3): the resolution reads every key
 * through its scope. A vertical key asks for the vertical being resolved, so the
 * real resolution refuses to read one without it; a global key resolves by
 * `user` and does not need the vertical. The first case fails if
 * {@link resolveKeyScope} is disconnected from the path that reads keys.
 */
import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { describe, expect, it } from 'vitest';
import { MissingVerticalForVerticalKeyError, resolveGrantSet } from '../../src';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';

const SINCE = new Date('2026-01-01T00:00:00.000Z');

/** A GRANT whose reference and floor are the same plan version. */
function grantSource(planVersionId: string) {
    return CoverageSourceSchema.parse({
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: planVersionId
    });
}

describe('TEST:V3:4 — the resolution reads every key by its scope', () => {
    it('a vertical key cannot be resolved by the resolution without a vertical', async () => {
        const catalog = createInMemoryCatalog();
        const versionId = catalog.addPlanVersion(
            planVersionRow({
                vertical: '',
                planId: 'plan-without-vertical',
                sellable: true,
                current: true,
                limits: [{ key: 'max_accommodations', value: 3, aggregationStrategy: 'SUM' }]
            })
        );

        await expect(
            resolveGrantSet({
                reader: catalog.reader,
                vertical: '',
                sources: [grantSource(versionId)]
            })
        ).rejects.toThrow(MissingVerticalForVerticalKeyError);
    });

    it('a global key resolves by `user` even without a vertical', async () => {
        const catalog = createInMemoryCatalog();
        const versionId = catalog.addPlanVersion(
            planVersionRow({
                vertical: '',
                planId: 'plan-global',
                sellable: true,
                current: true,
                entitlements: [
                    {
                        key: 'priority_support',
                        planQuota: null,
                        trialQuota: null,
                        aggregationStrategy: 'MAX'
                    }
                ]
            })
        );

        const resolved = await resolveGrantSet({
            reader: catalog.reader,
            vertical: '',
            sources: [grantSource(versionId)]
        });

        expect(resolved?.entitlements.get('priority_support')).toBe(Number.POSITIVE_INFINITY);
    });
});
