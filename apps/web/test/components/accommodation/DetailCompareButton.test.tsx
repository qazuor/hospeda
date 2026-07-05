/**
 * @file DetailCompareButton.test.tsx
 * @description Unit tests for the DetailCompareButton React island (HOS-85 T-010).
 *
 * Coverage:
 * - Render: shows "Agregar a comparación" when the accommodation is not yet
 *   in the comparison list.
 * - Toggle: clicking adds the accommodation and flips the label to
 *   "En comparación"; clicking again removes it and restores the original
 *   label.
 * - Blocked / upsell (free / anonymous plan): info toast with a plans CTA.
 * - Blocked / limit (at per-plan cap): warning toast.
 *
 * Unlike CompareButton.test.tsx (which mocks `useCompareGuard` wholesale),
 * this suite exercises the REAL `useCompareGuard` + compare-store so the
 * add/remove/label-switch reactivity is verified end to end. Only
 * `useMyEntitlements` (the network-backed leaf) is mocked, mirroring
 * `useCompareGuard.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailCompareButton } from '../../../src/components/accommodation/DetailCompareButton.client';
import type { DetailCompareButtonProps } from '../../../src/components/accommodation/DetailCompareButton.client';
import { COMPARE_ENTITLEMENT_KEY, COMPARE_LIMIT_KEY } from '../../../src/hooks/useCompareGuard';
import { clearCompare } from '../../../src/store/compare-store';

const cssSrc = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailCompareButton.module.css'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => ({
    createT:
        (_locale: string) =>
        (key: string, fallback?: string, params?: Record<string, unknown>): string => {
            const text = fallback ?? key;
            if (!params) return text;
            return Object.entries(params).reduce(
                (acc, [paramKey, paramValue]) =>
                    acc.replaceAll(`{{${paramKey}}}`, String(paramValue)),
                text
            );
        }
}));

vi.mock('../../../src/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('../../../src/components/accommodation/DetailCompareButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ColumnIcon: ({ weight, size }: { weight?: string; size?: number }) => (
        <svg
            data-testid="compare-icon"
            data-weight={weight}
            width={size}
            aria-hidden="true"
        />
    ),
    CheckIcon: ({ weight, size }: { weight?: string; size?: number }) => (
        <svg
            data-testid="check-icon"
            data-weight={weight}
            width={size}
            aria-hidden="true"
        />
    )
}));

// Mock toast store so we can assert addToast calls.
const mockAddToast = vi.fn();
vi.mock('../../../src/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));

// Mock useMyEntitlements (mutable per-test value, hoist-safe) — the network
// leaf consumed by the REAL useCompareGuard. Everything above it (guard +
// compare-store) runs for real, so add/remove reactivity is genuine.
const mockEntitlements = vi.hoisted(() => ({
    value: {
        has: (_key: string) => false,
        limit: (_key: string) => -1,
        plan: null,
        isLoading: false,
        error: null as Error | null
    }
}));

vi.mock('../../../src/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => mockEntitlements.value
}));

/** Build a fake entitlements return for a plan with a given compare cap. */
function asPlan(maxItems: number): void {
    mockEntitlements.value = {
        has: (key: string) => key === COMPARE_ENTITLEMENT_KEY,
        limit: (key: string) => (key === COMPARE_LIMIT_KEY ? maxItems : -1),
        plan: null,
        isLoading: false,
        error: null
    };
}

/** Build a fake entitlements return for a user without the comparison gate. */
function asFree(): void {
    mockEntitlements.value = {
        has: (_key: string) => false,
        limit: (_key: string) => -1,
        plan: null,
        isLoading: false,
        error: null
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProps(overrides: Partial<DetailCompareButtonProps> = {}): DetailCompareButtonProps {
    return {
        accommodationId: 'acc-uuid-1',
        accommodationName: 'Cabaña del Río',
        locale: 'es',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    clearCompare();
    asPlan(2);
});

afterEach(() => {
    clearCompare();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Render
// ---------------------------------------------------------------------------

describe('DetailCompareButton — render', () => {
    it('renders "Agregar a comparación" when not in the comparison list', () => {
        // Arrange / Act
        render(<DetailCompareButton {...buildProps()} />);

        // Assert
        expect(screen.getByText('Agregar a comparación')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('compare-icon')).toBeInTheDocument();
    });

    it('sets a full-sentence aria-label independent of the visible .label text', () => {
        // Arrange / Act — the accessible name must not rely on the `.label`
        // span, since that span is visually hidden on mobile (HOS-85
        // post-review fix) via CSS `display: none`.
        render(<DetailCompareButton {...buildProps()} />);

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            'Agregar Cabaña del Río a la comparación'
        );
    });

    it('switches the aria-label to the "remove" phrasing once selected', () => {
        // Arrange
        render(<DetailCompareButton {...buildProps()} />);

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            'Quitar Cabaña del Río de la comparación'
        );
    });
});

// ---------------------------------------------------------------------------
// 2. Toggle reactivity (real store)
// ---------------------------------------------------------------------------

describe('DetailCompareButton — toggle reactivity', () => {
    it('adds the accommodation and switches the label to "En comparación" on click', () => {
        // Arrange
        render(<DetailCompareButton {...buildProps()} />);

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByText('En comparación')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('check-icon')).toBeInTheDocument();
        expect(mockAddToast).toHaveBeenCalledTimes(1);
        expect(mockAddToast.mock.calls[0]?.[0].type).toBe('success');
    });

    it('removes the accommodation and restores the original label on a second click', () => {
        // Arrange
        render(<DetailCompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button')); // add
        expect(screen.getByText('En comparación')).toBeInTheDocument();

        // Act
        fireEvent.click(screen.getByRole('button')); // remove

        // Assert
        expect(screen.getByText('Agregar a comparación')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        expect(mockAddToast).toHaveBeenCalledTimes(2);
        expect(mockAddToast.mock.calls[1]?.[0].type).toBe('success');
    });
});

// ---------------------------------------------------------------------------
// 3. Guard outcomes
// ---------------------------------------------------------------------------

describe('DetailCompareButton — guard outcomes', () => {
    it('shows an upsell toast with a plans CTA when the plan lacks the entitlement', () => {
        // Arrange
        asFree();
        render(<DetailCompareButton {...buildProps()} />);

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByText('Agregar a comparación')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('info');
        expect(arg.action?.href).toBe('/es/suscriptores/planes/');
    });

    it('shows a warning toast when the plan is at its per-plan cap', () => {
        // Arrange — a plan with a cap of 0 always denies new adds with "limit".
        asPlan(0);
        render(<DetailCompareButton {...buildProps()} />);

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByText('Agregar a comparación')).toBeInTheDocument();
        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('warning');
        expect(arg.action).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 4. Responsive mobile collapse (HOS-85 post-review fix)
// ---------------------------------------------------------------------------
//
// jsdom does not evaluate CSS media queries, so the icon-only mobile collapse
// is verified by reading the CSS Module source directly — the same pattern
// used across the app for Astro components and other CSS Modules (see e.g.
// WhatsAppCTA.test.ts).

describe('DetailCompareButton.module.css — mobile collapse', () => {
    it('declares a max-width: 767px breakpoint', () => {
        expect(cssSrc).toContain('@media (max-width: 767px)');
    });

    it('shrinks the button to a 2.5rem circle matching FavoriteButton standalone', () => {
        const mobileBlock = cssSrc.split('@media (max-width: 767px)')[1];
        expect(mobileBlock).toContain('width: 2.5rem');
    });

    it('hides the .label text within the mobile breakpoint', () => {
        const mobileBlock = cssSrc.split('@media (max-width: 767px)')[1];
        expect(mobileBlock).toMatch(/\.label\s*\{[^}]*display:\s*none/);
    });

    it('keeps the circular shape when combined with the sticky-scroll compact header', () => {
        const mobileBlock = cssSrc.split('@media (max-width: 767px)')[1];
        expect(mobileBlock).toMatch(/wave-header--compact[\s\S]*?\.button/);
    });
});
