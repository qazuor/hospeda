import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type ResolveEffectiveSetArgs,
    resolveEffectiveSet
} from '../../src/effective-set/resolve-effective-set';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';

const USER = 'admin-account-with-no-coverage-source';
const VERTICAL = VerticalEnum.ACCOMMODATION;

// The @repo/verticals typecheck includes test/** and fails if a role is added to this input.
type NoRoleInput = 'roles' extends keyof ResolveEffectiveSetArgs
    ? false
    : 'role' extends keyof ResolveEffectiveSetArgs
      ? false
      : true;
const noRoleInput: NoRoleInput = true;

describe('TEST:V5:22 - the effective set of an ADMIN with no source is the floor version (no -1 limit)', () => {
    it('resolves exactly the BASE source grants and has no role input', async () => {
        const catalog = createInMemoryCatalog();
        const baseVersionId = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    { key: 'max_photos_per_accommodation', value: 5, aggregationStrategy: 'SUM' },
                    { key: 'max_accommodations', value: 2, aggregationStrategy: 'SUM' }
                ],
                entitlements: [
                    {
                        key: 'edit_accommodation_info',
                        planQuota: 1,
                        trialQuota: 1,
                        aggregationStrategy: 'MAX'
                    }
                ]
            })
        );
        const base = CoverageSourceSchema.parse({
            type: 'BASE',
            reference: { kind: 'PLAN_VERSION', planVersionId: baseVersionId },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01T00:00:00.000Z'),
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: null
        });
        const result = await resolveEffectiveSet({
            reader: catalog.reader,
            billing: {
                coverage: async () => ({ covered: false, sources: [base] })
            },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });

        expect(result.entries).toEqual([
            { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
            { key: 'max_photos_per_accommodation', value: 5, strategy: 'SUM' },
            { key: 'max_accommodations', value: 2, strategy: 'SUM' }
        ]);
        expect(result.entries.every((entry) => entry.value !== -1)).toBe(true);
        expect(noRoleInput).toBe(true);
    });
});
