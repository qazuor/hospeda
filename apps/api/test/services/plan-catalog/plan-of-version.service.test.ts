/**
 * HOS-2328 — `readPlanOfVersion`: the catalog plan of a plan version, read by
 * that version's id only.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPlanOfVersion } from '../../../src/services/plan-catalog/plan-of-version.service';

const mocks = vi.hoisted(() => ({
    rows: [] as unknown[],
    eqCalls: [] as unknown[][]
}));

vi.mock('@repo/db', () => {
    const chain = {
        select: () => chain,
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        limit: async () => mocks.rows
    };
    return {
        getDb: () => chain,
        plans: { id: 'plans.id', slug: 'plans.slug', name: 'plans.name' },
        planVersions: { id: 'planVersions.id', planId: 'planVersions.planId' },
        eq: (...args: unknown[]) => {
            mocks.eqCalls.push(args);
            return {};
        }
    };
});

const VERSION = '55555555-5555-4555-8555-555555555555';

describe('readPlanOfVersion (HOS-2328)', () => {
    beforeEach(() => {
        mocks.rows = [];
        mocks.eqCalls = [];
    });

    it('returns the plan of the version, filtered by that version id', async () => {
        // Arrange
        mocks.rows = [{ slug: 'owner-pro', name: 'Catalog pro' }];

        // Act
        const plan = await readPlanOfVersion({ planVersionId: VERSION });

        // Assert
        expect(plan).toEqual({ slug: 'owner-pro', name: 'Catalog pro' });
        expect(mocks.eqCalls).toContainEqual(['planVersions.id', VERSION]);
    });

    it('returns null when no version has that id', async () => {
        // Act
        const plan = await readPlanOfVersion({ planVersionId: VERSION });

        // Assert
        expect(plan).toBeNull();
    });
});
