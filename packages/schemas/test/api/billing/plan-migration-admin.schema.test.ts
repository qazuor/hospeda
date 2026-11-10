import { describe, expect, it } from 'vitest';
import {
    LaunchPlanMigrationRequestSchema,
    PlanMigrationLaunchResponseSchema,
    PlanMigrationPreviewRequestSchema,
    PlanMigrationPreviewRowSchema
} from '../../../src/api/billing/plan-migration-admin.schema.js';

describe('AC:B12:2 action 17 preview contracts', () => {
    it('accepts two UUIDs and rejects unknown input keys', () => {
        const input = {
            sourcePlanVersionId: crypto.randomUUID(),
            targetPlanVersionId: crypto.randomUUID()
        };
        expect(PlanMigrationPreviewRequestSchema.safeParse(input).success).toBe(true);
        expect(PlanMigrationPreviewRequestSchema.safeParse({ ...input, rank: 1 }).success).toBe(
            false
        );
    });

    it('requires the named preview fields and local date', () => {
        const row = {
            subscriptionId: crypto.randomUUID(),
            userId: crypto.randomUUID(),
            customerName: null,
            customerEmail: 'customer@example.test',
            status: 'ACTIVE',
            cycle: 'monthly',
            direction: 'UP',
            currentAmount: 1000,
            newAmount: 2000,
            currency: 'ARS',
            losesPromo: false,
            applicationDate: '2026-12-31',
            waits: false,
            outcome: 'PENDIENTE',
            excludedReason: null
        };
        expect(PlanMigrationPreviewRowSchema.safeParse(row).success).toBe(true);
        expect(
            PlanMigrationPreviewRowSchema.safeParse({
                ...row,
                applicationDate: '2026-12-31T00:00:00Z'
            }).success
        ).toBe(false);
    });
});

describe('AC:B12:2 action 17 launch contracts', () => {
    it('requires the cohort fingerprint and rejects unknown keys', () => {
        const input = {
            sourcePlanVersionId: crypto.randomUUID(),
            targetPlanVersionId: crypto.randomUUID(),
            cohortFingerprint: 'a'.repeat(64)
        };
        expect(LaunchPlanMigrationRequestSchema.safeParse(input).success).toBe(true);
        expect(LaunchPlanMigrationRequestSchema.safeParse({ ...input, extra: 1 }).success).toBe(
            false
        );
        expect(
            LaunchPlanMigrationRequestSchema.safeParse({
                sourcePlanVersionId: input.sourcePlanVersionId,
                targetPlanVersionId: input.targetPlanVersionId
            }).success
        ).toBe(false);
    });

    it('requires every persisted customer and excluded reason', () => {
        const result = {
            planMigrationId: crypto.randomUUID(),
            announcedAt: new Date(),
            deadlineVersion: 2,
            noticeDays: 90,
            rows: [
                {
                    subscriptionId: crypto.randomUUID(),
                    outcome: 'PARA_RESOLVER',
                    applicationDate: '2027-01-02'
                }
            ],
            excluded: [{ subscriptionId: crypto.randomUUID(), excludedReason: 'ACTOR_IS_SUBJECT' }]
        };
        expect(PlanMigrationLaunchResponseSchema.safeParse(result).success).toBe(true);
        expect(
            PlanMigrationLaunchResponseSchema.safeParse({
                ...result,
                rows: [
                    {
                        subscriptionId: result.rows[0]?.subscriptionId,
                        outcome: 'EXCLUDED',
                        applicationDate: null
                    }
                ]
            }).success
        ).toBe(false);
    });
});
