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
 * - Blocked / upsell (free / anonymous plan): catalog badge and plans popover.
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
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import type { DetailCompareButtonProps } from '../../../src/components/accommodation/DetailCompareButton.client';
import { DetailCompareButton } from '../../../src/components/accommodation/DetailCompareButton.client';
import { COMPARE_ENTITLEMENT_KEY, COMPARE_LIMIT_KEY } from '../../../src/hooks/useCompareGuard';
import { clearCompare } from '../../../src/store/compare-store';

const cssSrc = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailCompareButton.module.css'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => {
    const interpolate = (text: string, params?: Record<string, unknown>): string => {
        if (!params) return text;
        return Object.entries(params).reduce(
            (acc, [paramKey, paramValue]) => acc.replaceAll(`{{${paramKey}}}`, String(paramValue)),
            text
        );
    };
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string =>
        interpolate(
            key === 'common.card.compareUsage'
                ? 'Comparás {{count}} de {{max}}'
                : key === 'accommodations.comparison.gate.benefit'
                  ? 'Compare up to {{count}} with {{plan}}'
                  : (fallback ?? key),
            params
        );
    const tPlural = (key: string, count: number, params?: Record<string, unknown>): string =>
        t(key, undefined, { ...params, count });
    return {
        createT: (_locale: string) => t,
        createTranslations: (_locale: string) => ({ t, tPlural })
    };
});

vi.mock('../../../src/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('../../../src/components/accommodation/DetailCompareButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    CrownIcon: () => null,
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

it('shows the effective compare cap and updates visible usage after toggling', () => {
    asPlan(8);
    render(<DetailCompareButton {...buildProps()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-description', 'Comparás 0 de 8');
    expect(screen.getByText('0/8')).toBeVisible();

    fireEvent.click(button);

    expect(screen.getByText('1/8')).toBeVisible();
    expect(button).toHaveAttribute('aria-description', 'Comparás 1 de 8');
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

    it('starts the accessible name with the visible label and appends the accommodation name', () => {
        // Arrange / Act — an aria-label would replace the visible text and trip
        // axe's label-content-name-mismatch rule (WCAG 2.5.3).
        render(<DetailCompareButton {...buildProps()} />);

        // Assert
        const button = screen.getByRole('button');
        expect(button).not.toHaveAttribute('aria-label');
        expect(button).toHaveAccessibleName(/^Agregar a comparación\s*,\s*Cabaña del Río$/);
    });

    it('switches the accessible name to the "added" label once selected', () => {
        // Arrange
        render(<DetailCompareButton {...buildProps()} />);

        // Act
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByRole('button')).toHaveAccessibleName(
            /^En comparación\s*,\s*Cabaña del Río$/
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
    it.each([
        false,
        true
    ])('removes an existing selection without entitlement (loading: %s)', (loading) => {
        const props = buildProps();
        const { rerender } = render(<DetailCompareButton {...props} />);
        fireEvent.click(screen.getByRole('button'));
        asFree();
        mockEntitlements.value = { ...mockEntitlements.value, isLoading: loading };
        rerender(<DetailCompareButton {...props} />);

        const remove = screen.getByRole('button', { name: /En comparación/, pressed: true });
        fireEvent.click(remove);

        expect(
            screen.getByRole('button', { name: /Agregar a comparación/, pressed: false })
        ).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the catalog badge before opening a capacity-aware plans popover', () => {
        // Arrange
        asFree();
        render(
            <DetailCompareButton
                {...buildProps()}
                planName="Explorer Plus"
                planCapacity={7}
            />
        );

        // Act
        expect(screen.getByText('Explorer Plus')).toBeVisible();
        fireEvent.click(screen.getByRole('button'));

        // Assert
        expect(screen.getByText('Agregar a comparación')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveTextContent('Compare up to 7 with Explorer Plus');
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            `/es/${PRICING_PAGE_PATH_BY_AUDIENCE.tourist}/`
        );
        expect(mockAddToast).not.toHaveBeenCalled();
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

    it.each([
        undefined,
        0,
        -1,
        1.5,
        Infinity
    ])('does not advertise a numeric cap of %s', (planCapacity) => {
        asFree();
        render(
            <DetailCompareButton
                {...buildProps()}
                planName="Explorer Plus"
                planCapacity={planCapacity}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('dialog')).toHaveTextContent(
            'accommodations.comparison.gate.upsellMessage'
        );
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

    it('visually hides (never display:none) the .label text within the mobile breakpoint', () => {
        // display:none would empty the accessible name now that there is no aria-label.
        const mobileBlock = cssSrc.split('@media (max-width: 767px)')[1];
        expect(mobileBlock).toMatch(/\.label\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
        expect(mobileBlock).not.toMatch(/\.label\s*\{[^}]*display:\s*none/);
    });

    it('keeps the circular shape when combined with the sticky-scroll compact header', () => {
        const mobileBlock = cssSrc.split('@media (max-width: 767px)')[1];
        expect(mobileBlock).toMatch(/wave-header--compact[\s\S]*?\.button/);
    });
});
