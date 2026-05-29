import { LimitProgressIndicator } from '@/features/billing/LimitProgressIndicator';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the single dependency of LimitProgressIndicator so we can pin the
 * resolved limit per case. Since SPEC-171 the component no longer reads a
 * role-aware bypass hook — the entitlements resolver is the single source of
 * truth (staff receive the unlimited sentinel `-1`), so a `-1` limit is all we
 * need to model both the staff case and an unlimited plan.
 */
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
    it('renders null for staff (resolver returns unlimited -1, SPEC-171)', () => {
        // Arrange — staff get the unlimited sentinel straight from the motor.
        withEntitlements({ limit: -1 });

        // Act
        const { container } = render(
            <LimitProgressIndicator
                limitKey="MAX_PHOTOS_PER_ACCOMMODATION"
                currentCount={3}
                resourceLabel="Fotos"
            />
        );

        // Assert — empty DOM: unlimited means nothing to indicate.
        expect(container.firstChild).toBeNull();
    });

    it('renders null while entitlements are loading (no flicker)', () => {
        // Arrange — HOST but query still in flight
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
