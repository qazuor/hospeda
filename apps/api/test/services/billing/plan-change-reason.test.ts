/**
 * Unit tests for the HOS-220 MercadoPago plan-change reason resolver.
 *
 * `resolvePlanChangeReason` turns a `billing_plans.id` (UUID) into the plan's
 * buyer-visible display name so the MP preapproval `reason` reads e.g. "VIP"
 * instead of the raw UUID. It is best-effort: any failure resolves to
 * `undefined`, letting the qzpay adapter keep its synthetic fallback.
 *
 * @module test/services/billing/plan-change-reason
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPlanById } = vi.hoisted(() => ({ getPlanById: vi.fn() }));

vi.mock('../../../src/services/plan.service', () => ({ getPlanById }));

import { resolvePlanChangeReason } from '../../../src/services/billing/plan-change-reason';

beforeEach(() => {
    getPlanById.mockReset();
});

describe('resolvePlanChangeReason', () => {
    it('returns the plan display name when the plan resolves', async () => {
        getPlanById.mockResolvedValue({ success: true, data: { name: 'VIP' } });

        const reason = await resolvePlanChangeReason({ planId: 'plan-uuid' });

        expect(reason).toBe('VIP');
        expect(getPlanById).toHaveBeenCalledWith('plan-uuid');
    });

    it('returns undefined when the plan is not found', async () => {
        getPlanById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });

        const reason = await resolvePlanChangeReason({ planId: 'missing' });

        expect(reason).toBeUndefined();
    });

    it('returns undefined when the lookup throws', async () => {
        getPlanById.mockRejectedValue(new Error('db connection lost'));

        const reason = await resolvePlanChangeReason({ planId: 'plan-uuid' });

        expect(reason).toBeUndefined();
    });

    it('returns undefined when the resolved display name is blank', async () => {
        getPlanById.mockResolvedValue({ success: true, data: { name: '   ' } });

        const reason = await resolvePlanChangeReason({ planId: 'plan-uuid' });

        expect(reason).toBeUndefined();
    });
});
