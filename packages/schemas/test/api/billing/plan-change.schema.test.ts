import { describe, expect, it } from 'vitest';
import {
    type PlanChangeRequest,
    PlanChangeRequestSchema,
    type PlanChangeResponse,
    PlanChangeResponseSchema,
    PlanChangeStatusEnum
} from '../../../src/api/billing/plan-change.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';

describe('Plan Change Schemas', () => {
    describe('PlanChangeStatusEnum', () => {
        it('should contain active and scheduled values', () => {
            expect(PlanChangeStatusEnum.ACTIVE).toBe('active');
            expect(PlanChangeStatusEnum.SCHEDULED).toBe('scheduled');
        });
    });

    describe('PlanChangeRequestSchema', () => {
        it('should validate a valid plan change request', () => {
            const request = {
                newPlanId: 'plan_owner_pro',
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newPlanId).toBe('plan_owner_pro');
                expect(result.data.billingInterval).toBe(BillingIntervalEnum.MONTHLY);
            }
        });

        it('should validate with annual billing interval', () => {
            const request = {
                newPlanId: 'plan_owner_basico',
                billingInterval: BillingIntervalEnum.ANNUAL
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(true);
        });

        it('should reject empty newPlanId', () => {
            const request = {
                newPlanId: '',
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should reject missing newPlanId', () => {
            const request = {
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should reject missing billingInterval', () => {
            const request = {
                newPlanId: 'plan_owner_pro'
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should reject invalid billingInterval value', () => {
            const request = {
                newPlanId: 'plan_owner_pro',
                billingInterval: 'weekly'
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should reject non-string newPlanId', () => {
            const request = {
                newPlanId: 123,
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should reject newPlanId exceeding max length', () => {
            const request = {
                newPlanId: 'a'.repeat(101),
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            const result = PlanChangeRequestSchema.safeParse(request);

            expect(result.success).toBe(false);
        });

        it('should infer correct TypeScript type', () => {
            const request: PlanChangeRequest = {
                newPlanId: 'plan_owner_pro',
                billingInterval: BillingIntervalEnum.MONTHLY
            };

            expect(request.newPlanId).toBeDefined();
            expect(request.billingInterval).toBeDefined();
        });
    });

    describe('PlanChangeResponseSchema', () => {
        it('should validate a valid upgrade response', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                proratedAmount: 750000,
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.subscriptionId).toBe('sub_123');
                expect(result.data.previousPlanId).toBe('plan_owner_basico');
                expect(result.data.newPlanId).toBe('plan_owner_pro');
                expect(result.data.proratedAmount).toBe(750000);
                expect(result.data.status).toBe('active');
            }
        });

        it('should validate a valid downgrade response (scheduled)', () => {
            const response = {
                subscriptionId: 'sub_456',
                previousPlanId: 'plan_owner_pro',
                newPlanId: 'plan_owner_basico',
                effectiveAt: '2026-03-07T00:00:00.000Z',
                status: PlanChangeStatusEnum.SCHEDULED
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('scheduled');
                expect(result.data.proratedAmount).toBeUndefined();
            }
        });

        it('should allow proratedAmount to be optional', () => {
            const response = {
                subscriptionId: 'sub_789',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(true);
        });

        it('should allow proratedAmount of zero', () => {
            const response = {
                subscriptionId: 'sub_789',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                proratedAmount: 0,
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.proratedAmount).toBe(0);
            }
        });

        it('should reject negative proratedAmount', () => {
            const response = {
                subscriptionId: 'sub_789',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                proratedAmount: -100,
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject missing subscriptionId', () => {
            const response = {
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject missing previousPlanId', () => {
            const response = {
                subscriptionId: 'sub_123',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject missing newPlanId', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject missing effectiveAt', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject invalid effectiveAt format', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: 'not-a-date',
                status: PlanChangeStatusEnum.ACTIVE
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject missing status', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z'
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should reject invalid status value', () => {
            const response = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                status: 'invalid_status'
            };

            const result = PlanChangeResponseSchema.safeParse(response);

            expect(result.success).toBe(false);
        });

        it('should infer correct TypeScript type', () => {
            const response: PlanChangeResponse = {
                subscriptionId: 'sub_123',
                previousPlanId: 'plan_owner_basico',
                newPlanId: 'plan_owner_pro',
                effectiveAt: '2026-02-07T15:00:00.000Z',
                proratedAmount: 750000,
                status: PlanChangeStatusEnum.ACTIVE
            };

            expect(response.subscriptionId).toBeDefined();
            expect(response.status).toBeDefined();
        });
    });
});
