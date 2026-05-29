import { LimitProgressIndicator } from '@/features/billing/LimitProgressIndicator';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the two dependencies of LimitProgressIndicator so we can pin both the
 * staff-bypass decision and the resolved limit per case. The hooks live in
 * separate files so each mock targets its own module path.
 */
vi.mock('@/features/billing/use-should-show-entitlement-gates', () => ({
    useShouldShowEntitlementGates: vi.fn()
}));

vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: vi.fn()
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        // Echo back the key with rough interpolation — tests assert on
        // structural state, not exact copy. Using the key keeps the
        // assertions independent of the actual i18n strings.
        t: (key: string, vars?: Record<string, unknown>) => {
            if (!vars) return key;
            return `${key}|${Object.entries(vars)
                .map(([k, v]) => `${k}=${v}`)
                .join(',')}`;
        }
    })
}));

import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useShouldShowEntitlementGates } from '@/features/billing/use-should-show-entitlement-gates';

const mockedShouldGate = vi.mocked(useShouldShowEntitlementGates);
const mockedEntitlements = vi.mocked(useMyEntitlements);

function withEntitlements({
    limit,
    isLoading = false,
    error = null
}: {
    limit: number;
    isLoading?: boolean;
    error?: Error | null;
}) {
    mockedEntitlements.mockReturnValue({
        has: () => false,
        limit: () => limit,
        plan: null,
        isLoading,
        error
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('LimitProgressIndicator', () => {
    it('renders null for staff (gate bypass)', () => {
        // Arrange — staff role: shouldGate is false
        mockedShouldGate.mockReturnValue(false);
        withEntitlements({ limit: 5 });

        // Act
        const { container } = render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={3}
                resourceLabel="Fotos"
            />
        );

        // Assert — empty DOM means the staff bypass worked.
        expect(container.firstChild).toBeNull();
    });

    it('renders null while entitlements are loading (no flicker)', () => {
        // Arrange — HOST but query still in flight
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: 10, isLoading: true });

        // Act
        const { container } = render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={3}
            />
        );

        // Assert
        expect(container.firstChild).toBeNull();
    });

    it('renders null when the plan has the key as unlimited (-1)', () => {
        // Arrange — premium tier with unlimited photos
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: -1 });

        // Act
        const { container } = render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={20}
            />
        );

        // Assert — no indicator for unlimited
        expect(container.firstChild).toBeNull();
    });

    it('shows the count, label and below-limit copy when under the cap', () => {
        // Arrange — host-pro: 15 photos max, used 3 (20%)
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: 15 });

        // Act
        render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={3}
                resourceLabel="Fotos"
            />
        );

        // Assert — counter + label visible.
        expect(screen.getByText('3 / 15')).toBeInTheDocument();
        expect(screen.getByText('Fotos')).toBeInTheDocument();
        // Below-limit copy keyed off the same i18n key.
        expect(screen.getByText(/admin-entities\.limitGate\.belowLimit/)).toBeInTheDocument();
        // No upgrade CTA while below the cap.
        expect(
            screen.queryByText(/admin-entities\.limitGate\.upgradeLink/)
        ).not.toBeInTheDocument();
    });

    it('shows the at-limit copy and the upgrade CTA at the cap', () => {
        // Arrange — host-basico: 5 photos max, used 5 (100%)
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: 5 });

        // Act
        render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={5}
            />
        );

        // Assert — counter + at-limit copy + CTA.
        expect(screen.getByText('5 / 5')).toBeInTheDocument();
        expect(screen.getByText(/admin-entities\.limitGate\.atLimit/)).toBeInTheDocument();
        expect(screen.getByText(/admin-entities\.limitGate\.upgradeLink/)).toBeInTheDocument();
    });

    it('shows the upgrade CTA when over the cap too', () => {
        // Arrange — host-basico with legacy photos: 5 max, but 8 already saved
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: 5 });

        // Act
        render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={8}
            />
        );

        // Assert
        expect(screen.getByText('8 / 5')).toBeInTheDocument();
        expect(screen.getByText(/admin-entities\.limitGate\.upgradeLink/)).toBeInTheDocument();
    });

    it('renders null when entitlements query errors out', () => {
        // Arrange — silence over flicker on transient errors
        mockedShouldGate.mockReturnValue(true);
        withEntitlements({ limit: 5, error: new Error('boom') });

        // Act
        const { container } = render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={3}
            />
        );

        // Assert
        expect(container.firstChild).toBeNull();
    });
});
