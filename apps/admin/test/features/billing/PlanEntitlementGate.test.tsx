import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanEntitlementGate } from '@/features/billing/PlanEntitlementGate';
import { useEffectiveSet } from '@/features/billing/use-effective-set';

vi.mock('@/features/billing/use-effective-set', () => ({ useEffectiveSet: vi.fn() }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

const mockedSet = vi.mocked(useEffectiveSet);
const renderGate = () =>
    render(
        <PlanEntitlementGate
            entitlementKey="respond_reviews"
            fallback={<span>locked</span>}
        >
            <span>reply</span>
        </PlanEntitlementGate>
    );

describe('TEST:B13a:23 AC:B13a:23 PlanEntitlementGate', () => {
    beforeEach(() => vi.clearAllMocks());
    it('shows the same content when the resolved key is present', () => {
        mockedSet.mockReturnValue({
            subject: null,
            has: () => true,
            limit: () => 0,
            isLoading: false,
            error: null
        });
        renderGate();
        expect(screen.getByText('reply')).toBeInTheDocument();
    });
    it('shows the fallback when the resolved key is absent', () => {
        mockedSet.mockReturnValue({
            subject: null,
            has: () => false,
            limit: () => 0,
            isLoading: false,
            error: null
        });
        renderGate();
        expect(screen.getByText('locked')).toBeInTheDocument();
    });
    it('shows the fallback when the read errors', () => {
        mockedSet.mockReturnValue({
            subject: null,
            has: () => false,
            limit: () => 0,
            isLoading: false,
            error: new Error('failed')
        });
        renderGate();
        expect(screen.getByText('locked')).toBeInTheDocument();
    });
});
