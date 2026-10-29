import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCardTrialGate } from '@/components/billing/PlanCardTrialGate.client';
import { resetPricingSituationCacheForTests } from '@/lib/billing/pricing-situation';

const pricingSituation = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { pricingSituation }
}));

beforeEach(() => {
    vi.clearAllMocks();
    resetPricingSituationCacheForTests();
});

describe('PlanCardTrialGate', () => {
    it('keeps the SSR children before resolution and for first use or a read error', async () => {
        pricingSituation.mockResolvedValueOnce({
            ok: true,
            data: { situation: 'FIRST_USE', trialDays: 14 }
        });
        const { rerender } = render(
            <PlanCardTrialGate vertical="accommodation">
                <p>Trial offer</p>
            </PlanCardTrialGate>
        );
        expect(screen.getByText('Trial offer')).toBeInTheDocument();
        await waitFor(() => expect(pricingSituation).toHaveBeenCalledTimes(1));
        expect(screen.getByText('Trial offer')).toBeInTheDocument();

        resetPricingSituationCacheForTests();
        pricingSituation.mockResolvedValueOnce({
            ok: false,
            error: { status: 500, message: 'offline' }
        });
        rerender(
            <PlanCardTrialGate vertical="venue">
                <p>Trial offer</p>
            </PlanCardTrialGate>
        );
        await waitFor(() => expect(pricingSituation).toHaveBeenCalledTimes(2));
        expect(screen.getByText('Trial offer')).toBeInTheDocument();
    });

    it.each([
        { situation: 'SUBSCRIBED', status: 'ACTIVE', planVersionId: 'v1', billingOptionId: 'm1' },
        { situation: 'TOURIST_VIP_INHERITED' }
    ] as const)('removes the children when the situation rules out trial', async (situation) => {
        pricingSituation.mockResolvedValue({ ok: true, data: situation });
        render(
            <PlanCardTrialGate vertical="tourist">
                <p>Trial offer</p>
            </PlanCardTrialGate>
        );
        expect(screen.getByText('Trial offer')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Trial offer')).not.toBeInTheDocument());
    });

    it('does not fetch for null verticals', () => {
        render(
            <PlanCardTrialGate vertical={null}>
                <p>Trial offer</p>
            </PlanCardTrialGate>
        );
        expect(screen.getByText('Trial offer')).toBeInTheDocument();
        expect(pricingSituation).not.toHaveBeenCalled();
    });
});
