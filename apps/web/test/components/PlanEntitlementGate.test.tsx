/**
 * @file PlanEntitlementGate.test.tsx
 * @description Tests for PlanEntitlementGate component.
 * Verifies entitled vs locked state rendering, loading behavior, and upgrade CTA.
 */

import { PlanEntitlementGate } from '@/components/host/editor/PlanEntitlementGate.client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockHas = vi.fn((_key: string) => false);
let mockIsLoading = false;
let mockError: Error | null = null;

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: mockHas,
        isLoading: mockIsLoading,
        error: mockError,
        limit: vi.fn(() => -1),
        plan: null
    })
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: vi.fn()
    })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanEntitlementGate', () => {
    beforeEach(() => {
        mockHas = vi.fn((_key: string) => false);
        mockIsLoading = false;
        mockError = null;
    });

    it('renders children when user has the entitlement', () => {
        mockHas = vi.fn((key: string) => key === 'can_use_rich_description');

        render(
            <PlanEntitlementGate entitlementKey="can_use_rich_description">
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        expect(screen.getByTestId('gated-content')).toBeInTheDocument();
        expect(screen.getByText('Rich Editor')).toBeInTheDocument();
    });

    it('renders locked state when user lacks the entitlement', () => {
        mockHas = vi.fn(() => false);

        render(
            <PlanEntitlementGate
                entitlementKey="can_use_rich_description"
                upgradeUrl="/suscriptores/precios/"
            >
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        // Children should NOT be rendered
        expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
        // Upgrade link should be visible
        expect(screen.getByText(/Mejorar plan/i)).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', '/suscriptores/precios/');
    });

    it('renders custom fallback when provided and entitlement is missing', () => {
        mockHas = vi.fn(() => false);

        render(
            <PlanEntitlementGate
                entitlementKey="can_use_rich_description"
                fallback={<div data-testid="custom-fallback">Custom locked state</div>}
            >
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
        expect(screen.getByText('Custom locked state')).toBeInTheDocument();
    });

    it('shows children while loading (fail-open during load)', () => {
        mockIsLoading = true;

        render(
            <PlanEntitlementGate entitlementKey="can_use_rich_description">
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        // During loading, children are shown to avoid layout flash
        expect(screen.getByTestId('gated-content')).toBeInTheDocument();
    });

    it('renders fallback on error (fail-safe)', () => {
        mockError = new Error('Network error');

        render(
            <PlanEntitlementGate
                entitlementKey="can_use_rich_description"
                upgradeUrl="/suscriptores/precios/"
            >
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
        // Should show the default fallback with upgrade link
        expect(screen.getByRole('link')).toHaveAttribute('href', '/suscriptores/precios/');
    });

    it('renders without upgrade link when upgradeUrl is not provided', () => {
        mockHas = vi.fn(() => false);

        render(
            <PlanEntitlementGate entitlementKey="can_use_rich_description">
                <div data-testid="gated-content">Rich Editor</div>
            </PlanEntitlementGate>
        );

        expect(screen.queryByTestId('gated-content')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
