import { describe, expect, it } from 'vitest';
import {
    LaunchPlanMigrationRequestSchema,
    PlanMigrationCancelInputSchema,
    PlanMigrationCancelResultSchema,
    PlanMigrationDetailSchema,
    PlanMigrationLaunchResponseSchema,
    PlanMigrationListItemSchema,
    PlanMigrationListQuerySchema,
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

describe('TEST:B12:6 AC:B12:6 y el panel la lista sin plazo y con su antigüedad desde el anuncio contracts', () => {
    it('uses the admin pagination defaults and bounds', () => {
        expect(PlanMigrationListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
        expect(PlanMigrationListQuerySchema.parse({ page: '2', pageSize: '100' })).toEqual({
            page: 2,
            pageSize: 100
        });
        expect(PlanMigrationListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
        expect(PlanMigrationListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    });

    it('requires all five state counts, including zero, and only unresolved rows carry age', () => {
        const id = crypto.randomUUID();
        const item = {
            id,
            reason: 'RETIREMENT',
            sourcePlanVersionId: crypto.randomUUID(),
            targetPlanVersionId: crypto.randomUUID(),
            sourcePlanName: 'Source',
            targetPlanName: 'Target',
            announcedAt: new Date('2026-10-01T12:00:00Z'),
            cancelledAt: null,
            counts: { PENDIENTE: 1, PARA_RESOLVER: 1, APLICADA: 0, FUERA: 0, CANCELADA: 0 }
        };
        expect(PlanMigrationListItemSchema.parse(item)).toEqual(item);
        const { APLICADA: _omitted, ...incomplete } = item.counts;
        expect(PlanMigrationListItemSchema.safeParse({ ...item, counts: incomplete }).success).toBe(
            false
        );
        const row = {
            id: crypto.randomUUID(),
            subscriptionId: crypto.randomUUID(),
            ownerUserId: crypto.randomUUID(),
            status: 'PARA_RESOLVER',
            outReason: null,
            applicationDate: null,
            appliedAt: null,
            ageDays: 12
        };
        const detail = { ...item, noticeDays: 60, deadlineVersion: 1, rows: [row] };
        expect(PlanMigrationDetailSchema.parse(detail)).toEqual(detail);
        expect(
            PlanMigrationDetailSchema.safeParse({
                ...detail,
                rows: [{ ...row, status: 'PENDIENTE' }]
            }).success
        ).toBe(false);
        expect(
            PlanMigrationDetailSchema.safeParse({
                ...detail,
                rows: [{ ...row, ageDays: null }]
            }).success
        ).toBe(false);
        expect(
            PlanMigrationDetailSchema.safeParse({
                ...detail,
                rows: [{ ...row, applicationDate: '2026-12-01' }]
            }).success
        ).toBe(false);
        expect(
            PlanMigrationDetailSchema.safeParse({
                ...detail,
                rows: [{ ...row, deadline: '2026-12-01' }]
            }).success
        ).toBe(false);
    });
});

describe('AC:B12:7 cancelar una migración anunciada contracts', () => {
    it('accepts only a migration UUID', () => {
        const planMigrationId = crypto.randomUUID();
        expect(PlanMigrationCancelInputSchema.safeParse({ planMigrationId }).success).toBe(true);
        expect(
            PlanMigrationCancelInputSchema.safeParse({ planMigrationId, extra: 1 }).success
        ).toBe(false);
        expect(PlanMigrationCancelInputSchema.safeParse({ planMigrationId: 'bad' }).success).toBe(
            false
        );
    });

    it('requires an exact timestamp and each nonnegative count', () => {
        const result = {
            planMigrationId: crypto.randomUUID(),
            cancelledAt: new Date(),
            rows: { cancelled: 2, alreadyStarted: 1, untouched: 3 }
        };
        expect(PlanMigrationCancelResultSchema.safeParse(result).success).toBe(true);
        expect(
            PlanMigrationCancelResultSchema.safeParse({
                ...result,
                rows: { ...result.rows, untouched: -1 }
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
            reason: 'RETIREMENT',
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
