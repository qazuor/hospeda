import { describe, expect, it } from 'vitest';
import { planMigrationCohortFingerprint } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';

describe('AC:B12:2 action 17 preview cohort fingerprint', () => {
    it('hashes sorted subscription and outcome pairs identically in either input order', () => {
        const rows = [
            {
                subscriptionId: '00000000-0000-4000-8000-000000000002',
                outcome: 'EXCLUDED' as const
            },
            {
                subscriptionId: '00000000-0000-4000-8000-000000000001',
                outcome: 'PENDIENTE' as const
            }
        ];
        const expected = 'b5aa6bee940d243fe3141a121876e5f62b6b3dc9733297154903d781b1ce4897';
        expect(planMigrationCohortFingerprint({ rows })).toBe(expected);
        expect(planMigrationCohortFingerprint({ rows: [...rows].reverse() })).toBe(expected);
    });
});
