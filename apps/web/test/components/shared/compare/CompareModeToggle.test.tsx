/**
 * @file CompareModeToggle.test.tsx
 * @description Unit tests for the CompareModeToggle React island (HOS-85 T-004,
 * active-state label post-review fix, entitlement-gate post-review fix).
 *
 * Coverage:
 * - Render: visible toggle label text (off state).
 * - Active state: label switches to the compact "Comparando" text plus an
 *   inline guidance hint, replacing the removed `CompareModeBanner`.
 * - `aria-pressed` reflects the current compare-mode flag.
 * - Mounts hydrate the compare-mode flag from storage via `loadCompareModeFromStorage`.
 * - Entitlement gate (post-review fix):
 *   - Entitled click toggles the mode via `toggleCompareMode`.
 *   - Guest click (not authenticated, no entitlement) opens the auth-required
 *     popover and does NOT toggle the mode.
 *   - Authenticated click without the entitlement opens the upsell popover
 *     and does NOT toggle the mode.
 *   - While entitlements are loading, the button stays enabled (aria-busy) and a
 *     click activates compare mode optimistically (the per-card guard still gates
 *     selection) — a stuck isLoading must never permanently disable the toggle.
 *
 * The compare-store and useCompareGuard hook are mocked so the test drives
 * state directly without touching localStorage or the network.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareModeToggle } from '../../../../src/components/shared/compare/CompareModeToggle.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));

vi.mock('../../../../src/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('../../../../src/components/shared/compare/CompareModeToggle.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ColumnIcon: ({ weight, size }: { weight?: string; size?: number }) => (
        <svg
            data-testid="compare-mode-icon"
            data-weight={weight}
            width={size}
            aria-hidden="true"
        />
    )
}));

const mockToggleCompareMode = vi.fn();
const mockLoadCompareModeFromStorage = vi.fn();
const mockMode = vi.hoisted(() => ({ value: false }));

vi.mock('../../../../src/store/compare-store', () => ({
    useCompareMode: () => mockMode.value,
    toggleCompareMode: (...args: unknown[]) => mockToggleCompareMode(...args),
    loadCompareModeFromStorage: (...args: unknown[]) => mockLoadCompareModeFromStorage(...args)
}));

/** Mutable guard state driven per-test; defaults to "entitled" so existing render tests are unaffected. */
const mockGuard = vi.hoisted(() => ({
    value: { canCompare: true, isLoading: false }
}));

vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => mockGuard.value
}));

// Mock AuthRequiredPopover so we can assert on its presence without needing
// its internal CSS/portal/positioning dependencies (mirrors FavoriteButton.test.tsx).
vi.mock('../../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: ({ message, onClose }: { message: string; onClose: () => void }) => (
        // biome-ignore lint/a11y/useSemanticElements: mock element — <dialog> not needed in test DOM
        <div
            role="dialog"
            data-testid="auth-required-popover"
        >
            <p>{message}</p>
            <button
                type="button"
                onClick={onClose}
            >
                Cerrar
            </button>
        </div>
    )
}));

vi.mock('../../../../src/components/shared/compare/CompareUpsellPopover.client', () => ({
    CompareUpsellPopover: ({
        message,
        ctaLabel,
        onClose
    }: {
        message: string;
        ctaLabel: string;
        onClose: () => void;
    }) => (
        // biome-ignore lint/a11y/useSemanticElements: mock element — <dialog> not needed in test DOM
        <div
            role="dialog"
            data-testid="compare-upsell-popover"
        >
            <p>{message}</p>
            <a href="/es/suscriptores/turistas/">{ctaLabel}</a>
            <button
                type="button"
                onClick={onClose}
            >
                Cerrar
            </button>
        </div>
    )
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockMode.value = false;
    mockGuard.value = { canCompare: true, isLoading: false };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareModeToggle — render', () => {
    it('renders the visible toggle label', () => {
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByText('Comparar alojamientos')).toBeInTheDocument();
    });

    it('has aria-pressed=false when compare mode is off', () => {
        mockMode.value = false;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });

    it('has aria-pressed=true when compare mode is on', () => {
        mockMode.value = true;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks data-active when compare mode is on', () => {
        mockMode.value = true;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute('data-active', 'true');
    });

    it('does not set data-active when compare mode is off', () => {
        mockMode.value = false;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByRole('button')).not.toHaveAttribute('data-active');
    });
});

describe('CompareModeToggle — active-state label (post-review fix)', () => {
    it('shows the compact "Comparando" label when compare mode is on', () => {
        mockMode.value = true;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByText('Comparando')).toBeInTheDocument();
    });

    it('shows the inline guidance hint when compare mode is on', () => {
        mockMode.value = true;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.getByText('Elegí los alojamientos que querés comparar')).toBeInTheDocument();
    });

    it('does not show the off-state label or the hint when compare mode is off', () => {
        mockMode.value = false;
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(screen.queryByText('Comparando')).not.toBeInTheDocument();
        expect(
            screen.queryByText('Elegí los alojamientos que querés comparar')
        ).not.toBeInTheDocument();
    });
});

describe('CompareModeToggle — hydration', () => {
    it('re-hydrates the compare-mode flag from storage on mount', () => {
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        expect(mockLoadCompareModeFromStorage).toHaveBeenCalledTimes(1);
    });
});

describe('CompareModeToggle — entitlement gate (post-review fix)', () => {
    it('toggles compare mode when the plan includes the comparison entitlement', () => {
        mockGuard.value = { canCompare: true, isLoading: false };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(mockToggleCompareMode).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compare-upsell-popover')).not.toBeInTheDocument();
    });

    it('opens the auth-required popover on guest click and does not toggle the mode', () => {
        mockGuard.value = { canCompare: false, isLoading: false };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={false}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(mockToggleCompareMode).not.toHaveBeenCalled();
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
        expect(screen.queryByTestId('compare-upsell-popover')).not.toBeInTheDocument();
    });

    it('closes the auth-required popover via its onClose callback', () => {
        mockGuard.value = { canCompare: false, isLoading: false };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={false}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cerrar'));
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });

    it('opens the upsell popover on an authenticated click without the entitlement and does not toggle the mode', () => {
        mockGuard.value = { canCompare: false, isLoading: false };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(mockToggleCompareMode).not.toHaveBeenCalled();
        expect(screen.getByTestId('compare-upsell-popover')).toBeInTheDocument();
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
    });

    it('closes the upsell popover via its onClose callback', () => {
        mockGuard.value = { canCompare: false, isLoading: false };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByTestId('compare-upsell-popover')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cerrar'));
        expect(screen.queryByTestId('compare-upsell-popover')).not.toBeInTheDocument();
    });

    it('keeps the button enabled while entitlements are loading (never permanently disabled)', () => {
        mockGuard.value = { canCompare: false, isLoading: true };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        // A stuck isLoading must never disable this primary control.
        expect(screen.getByRole('button')).toBeEnabled();
        expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('activates compare mode optimistically on click while entitlements are loading (per-card guard still gates)', () => {
        mockGuard.value = { canCompare: false, isLoading: true };
        render(
            <CompareModeToggle
                locale="es"
                isAuthenticated={true}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        // Optimistic activation instead of a no-op; the CompareCardSelect guard
        // still gates actual selection, so no gate popover flashes here.
        expect(mockToggleCompareMode).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compare-upsell-popover')).not.toBeInTheDocument();
    });
});
