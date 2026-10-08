/**
 * TEST:V3:4 (HOS-1440, V3.2, AC:V3:3; `V/15` §3): the resolution reads every key
 * through its scope. A vertical key asks for the vertical being resolved, so the
 * real resolution refuses to read one without it; a global key resolves by
 * `user` and does not need the vertical. The first case fails if
 * {@link resolveKeyScope} is disconnected from the path that reads keys.
 */
import { type CoverageArgs, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { describe, expect, it } from 'vitest';
import {
    MeteredKeyGlobalScopeError,
    MissingVerticalForVerticalKeyError,
    resolveGrantSet,
    resolveTrialSet
} from '../../src';
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
                vertical: '' as CoverageArgs['vertical'],
                planId: 'plan-without-vertical',
                sellable: true,
                current: true,
                limits: [{ key: 'max_accommodations', value: 3, aggregationStrategy: 'SUM' }]
            })
        );

        await expect(
            resolveGrantSet({
                reader: catalog.reader,
                billing: {
                    coverage: async () => ({ covered: true, sources: [grantSource(versionId)] })
                },
                userId: 'scope-user',
                vertical: '' as CoverageArgs['vertical']
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
            billing: {
                coverage: async () => ({ covered: true, sources: [grantSource(versionId)] })
            },
            userId: 'scope-user',
            vertical: '' as CoverageArgs['vertical']
        });

        expect(
            resolved?.entitlements.get({
                key: 'priority_support',
                userId: 'scope-user',
                vertical: null
            })
        ).toBe(Number.POSITIVE_INFINITY);
    });

    it('the trial path rejects a global entitlement with a trial quota', async () => {
        const catalog = createInMemoryCatalog();
        const basic = catalog.addPlanVersion(
            planVersionRow({
                planId: 'basic',
                vertical: 'accommodation',
                entitlements: [
                    {
                        key: 'priority_support',
                        planQuota: null,
                        trialQuota: 1,
                        aggregationStrategy: 'MAX'
                    }
                ]
            })
        );
        const trialVersion = catalog.addPlanVersion(
            planVersionRow({
                planId: 'trial',
                vertical: 'accommodation',
                sellable: false,
                rank: 1
            })
        );
        await expect(
            resolveTrialSet({
                reader: catalog.reader,
                trial: {
                    userId: 'scope-user',
                    vertical: 'accommodation',
                    trialPlanId: 'trial',
                    floor: {
                        entitlementsVersionId: basic,
                        limitsVersionId: basic,
                        trialPlanVersionId: trialVersion
                    }
                }
            })
        ).rejects.toThrow(MeteredKeyGlobalScopeError);
    });
});
