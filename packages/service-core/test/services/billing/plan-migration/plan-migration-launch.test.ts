import { describe, expect, it } from 'vitest';
import { mapPlanMigrationWriteError } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';

describe('AC:B12:2 action 17 launch write errors', () => {
    it.each([
        'uq_plan_migration_subscription_one_pending',
        'uq_plan_migration_subscription_pair'
    ])('maps its own unique constraint %s to a changed cohort', (constraint) => {
        expect(() =>
            mapPlanMigrationWriteError({ error: { cause: { code: '23505', constraint } } })
        ).toThrowError(expect.objectContaining({ reason: 'PLAN_MIGRATION_COHORT_CHANGED' }));
    });

    it('maps its own check constraints and rethrows unrelated failures', () => {
        expect(() =>
            mapPlanMigrationWriteError({
                error: { cause: { code: '23514', constraint: 'ck_plan_migration_notice_days' } }
            })
        ).toThrowError(expect.objectContaining({ reason: 'INVALID_PLAN_MIGRATION_INPUT' }));
        const unrelated = { cause: { code: '23505', constraint: 'uq_unrelated' } };
        expect(() => mapPlanMigrationWriteError({ error: unrelated })).toThrow(unrelated);
    });
});
