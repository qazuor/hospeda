/**
 * Unit tests for the HOS-220 / HOS-231 plan display-name resolver.
 *
 * `resolvePlanDisplayName` turns a `billing_plans.id` (UUID) into the plan's
 * buyer-visible display name (`metadata.displayName`, via `getPlanById` →
 * `mapDbToPlan`), so both the MP preapproval `reason` (HOS-220) and user-facing
 * notification `planName` (HOS-231) read e.g. "VIP" instead of the raw UUID or
 * the slug (`tourist-vip`). `resolvePlanChangeReason` is a semantic alias.
 * Both are best-effort: any failure resolves to `undefined`, letting the caller
 * keep its own fallback (the qzpay synthetic reason, or a generic label).
 *
 * @module test/services/billing/plan-change-reason
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPlanById } = vi.hoisted(() => ({ getPlanById: vi.fn() }));

vi.mock('../../../src/services/plan.service', () => ({ getPlanById }));

import {
    resolvePlanChangeReason,
    resolvePlanDisplayName
} from '../../../src/services/billing/plan-change-reason';

beforeEach(() => {
    getPlanById.mockReset();
});

describe('resolvePlanDisplayName', () => {
    it('returns the plan display name when the plan resolves', async () => {
        getPlanById.mockResolvedValue({ success: true, data: { name: 'VIP' } });

        const name = await resolvePlanDisplayName({ planId: 'plan-uuid' });

        expect(name).toBe('VIP');
        expect(getPlanById).toHaveBeenCalledWith('plan-uuid');
    });

    it('returns undefined when the plan is not found (caller uses its own fallback)', async () => {
        getPlanById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });

        expect(await resolvePlanDisplayName({ planId: 'missing' })).toBeUndefined();
    });

    it('returns undefined when the lookup throws', async () => {
        getPlanById.mockRejectedValue(new Error('db connection lost'));

        expect(await resolvePlanDisplayName({ planId: 'plan-uuid' })).toBeUndefined();
    });

    it('returns undefined when the resolved display name is blank', async () => {
        getPlanById.mockResolvedValue({ success: true, data: { name: '   ' } });

        expect(await resolvePlanDisplayName({ planId: 'plan-uuid' })).toBeUndefined();
    });
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
