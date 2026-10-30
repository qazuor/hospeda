import { describe, expect, it } from 'vitest';
import type { EntitlementsData } from '../../../src/lib/entitlements-cache';
import { buildUsageBadge, getUsageThreshold } from '../../../src/lib/host/usage-badge';

const effective = (limit: number): EntitlementsData => ({
    entitlements: { max_accommodations: 1 },
    limits: { max_accommodations: limit },
    hasLiveNonTrialTitle: true,
    failed: false
});

describe('TEST:B13a:25 usage badge on the effective set', () => {
    it('shows different usage against different effective quotas', () => {
        expect(buildUsageBadge({ effectiveSet: effective(2), currentUsage: 2 })).toMatchObject({
            maxAllowed: 2,
            threshold: 'exceeded'
        });
        expect(buildUsageBadge({ effectiveSet: effective(15), currentUsage: 2 })).toMatchObject({
            maxAllowed: 15,
            threshold: 'ok'
        });
    });
    it('omits unlimited, absent, and failed capacity reads', () => {
        expect(buildUsageBadge({ effectiveSet: effective(Infinity), currentUsage: 2 })).toBeNull();
        expect(
            buildUsageBadge({ effectiveSet: { ...effective(3), limits: {} }, currentUsage: 2 })
        ).toBeNull();
        expect(
            buildUsageBadge({ effectiveSet: { ...effective(3), failed: true }, currentUsage: 2 })
        ).toBeNull();
    });
    it.each([
        [79, 'ok'],
        [80, 'warning'],
        [89, 'warning'],
        [90, 'critical'],
        [99, 'critical'],
        [100, 'exceeded']
    ] as const)('uses %i percent as %s', (pct, expected) => {
        expect(getUsageThreshold(pct, 100)).toBe(expected);
    });
});
