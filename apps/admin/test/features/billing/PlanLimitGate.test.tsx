import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanLimitGate } from '@/features/billing/PlanLimitGate';
import { useEffectiveSet } from '@/features/billing/use-effective-set';

vi.mock('@/features/billing/use-effective-set', () => ({ useEffectiveSet: vi.fn() }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

const mockedSet = vi.mocked(useEffectiveSet);
const show = (count: number) =>
    render(
        <PlanLimitGate
            limitKey="max_accommodations"
            currentCount={count}
            fallback={<span>blocked</span>}
        >
            <span>allowed</span>
        </PlanLimitGate>
    );

describe('TEST:B13a:23 AC:B13a:23 PlanLimitGate', () => {
    beforeEach(() => vi.clearAllMocks());
    it.each([
        [5, 3, 'allowed'],
        [5, 5, 'blocked'],
        [Number.POSITIVE_INFINITY, 5, 'allowed'],
        [0, 0, 'blocked']
    ])('with limit %s and count %s shows %s', (limit, count, expected) => {
        mockedSet.mockReturnValue({
            subject: null,
            has: () => false,
            limit: () => limit,
            isLoading: false,
            error: null
        });
        show(count);
        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
