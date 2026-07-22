/**
 * @file CompareButton.test.tsx
 * @description Unit tests for the CompareButton React island (SPEC-288 T-008).
 *
 * Coverage:
 * - Render: aria-pressed reflects whether the accommodation is in the list.
 * - Add (allowed): toggle called, success toast with a "Comparar ahora" action.
 * - Remove (in list): success toast, no action link.
 * - Blocked / upsell (free / anonymous): info toast with plans CTA.
 * - Blocked / limit (at per-plan cap): warning toast.
 * - Loading: click is a no-op while entitlements are still resolving.
 * - Contextual variant (HOS-85): renders null while compare mode is off,
 *   renders the labeled add/remove control while it's on, and still routes
 *   through the same toggle/toast outcomes as the other variants.
 *
 * `useCompareGuard` is mocked so neither the compare-store selection nor
 * entitlements network are touched; the component contract is verified in
 * isolation. The compare-MODE store (`useCompareMode`/`setCompareMode`) is
 * used for real (not mocked) — same pattern as `test/store/compare-store.test.ts`
 * — and reset to `false` in `beforeEach`/`afterEach` since it's a module-level
 * singleton.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompareButtonProps } from '../../../../src/components/shared/compare/CompareButton.client';
import { CompareButton } from '../../../../src/components/shared/compare/CompareButton.client';
import { setCompareMode } from '../../../../src/store/compare-store';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));

vi.mock('../../../../src/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('../../../../src/components/shared/compare/CompareButton.module.css', () => ({
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
    )
}));

// Mock toast store so we can assert addToast calls.
const mockAddToast = vi.fn();
vi.mock('../../../../src/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));

// Mutable guard mock (hoist-safe) — individual tests reshape `value`.
const mockGuard = vi.hoisted(() => ({
    value: {
        isInList: (_id: string) => false,
        isLoading: false,
        maxItems: 2,
        toggle: (_id: string) =>
            ({ action: 'added', reason: null }) as {
                action: 'added' | 'removed' | 'blocked';
                reason: 'upsell' | 'limit' | null;
            }
    }
}));

vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => mockGuard.value
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProps(overrides: Partial<CompareButtonProps> = {}): CompareButtonProps {
    return {
        accommodationId: 'acc-uuid-1',
        accommodationName: 'Cabaña del Río',
        locale: 'es',
        ...overrides
    };
}

/** Reshape the guard mock for a test. */
function setGuard(partial: Partial<typeof mockGuard.value>): void {
    mockGuard.value = { ...mockGuard.value, ...partial };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.value = {
        isInList: (_id: string) => false,
        isLoading: false,
        maxItems: 2,
        toggle: (_id: string) => ({ action: 'added', reason: null })
    };
    setCompareMode(false);
});

afterEach(() => {
    vi.restoreAllMocks();
    setCompareMode(false);
});

// ---------------------------------------------------------------------------
// 1. Render
// ---------------------------------------------------------------------------

describe('CompareButton — render', () => {
    it('renders the compare icon button', () => {
        render(<CompareButton {...buildProps()} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByTestId('compare-icon')).toBeInTheDocument();
    });

    it('has aria-pressed=false when not in the comparison list', () => {
        setGuard({ isInList: () => false });
        render(<CompareButton {...buildProps()} />);
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });

    it('has aria-pressed=true when already in the comparison list', () => {
        setGuard({ isInList: () => true });
        render(<CompareButton {...buildProps()} />);
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
});

// ---------------------------------------------------------------------------
// 2. Toggle outcomes
// ---------------------------------------------------------------------------

describe('CompareButton — toggle outcomes', () => {
    it('shows a success toast with a compare-now action when added', () => {
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button'));

        expect(toggle).toHaveBeenCalledWith('acc-uuid-1', {
            name: 'Cabaña del Río',
            thumbnailUrl: undefined
        });
        expect(mockAddToast).toHaveBeenCalledTimes(1);
        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('success');
        expect(arg.action?.href).toBe('/es/alojamientos/comparar/');
    });

    it('shows a success toast without an action when removed', () => {
        setGuard({
            isInList: () => true,
            toggle: () => ({ action: 'removed', reason: null })
        });

        render(<CompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('success');
        expect(arg.action).toBeUndefined();
    });

    it('shows an upsell toast with a plans CTA when blocked for free/anonymous', () => {
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'upsell' }) });

        render(<CompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('info');
        expect(arg.action?.href).toBe('/es/suscriptores/turistas/');
    });

    it('shows a warning toast when blocked by the per-plan limit', () => {
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'limit' }) });

        render(<CompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('warning');
        expect(arg.action).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. Loading guard
// ---------------------------------------------------------------------------

describe('CompareButton — loading', () => {
    it('does not toggle while entitlements are still loading', () => {
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ isLoading: true, toggle });

        render(<CompareButton {...buildProps()} />);
        fireEvent.click(screen.getByRole('button'));

        expect(toggle).not.toHaveBeenCalled();
        expect(mockAddToast).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
});

// ---------------------------------------------------------------------------
// 4. Contextual variant (HOS-85)
// ---------------------------------------------------------------------------

describe('CompareButton — contextual variant (HOS-85)', () => {
    it('renders nothing when compare mode is off (the default)', () => {
        setCompareMode(false);

        const { container } = render(<CompareButton {...buildProps({ variant: 'contextual' })} />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders the "Agregar" label when compare mode is on and not selected', () => {
        setCompareMode(true);
        setGuard({ isInList: () => false });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('Agregar');
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders the "Agregado" label when compare mode is on and already selected', () => {
        setCompareMode(true);
        setGuard({ isInList: () => true });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('Agregado');
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles selection on click, same as the standalone variant', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);
        fireEvent.click(screen.getByRole('button'));

        expect(toggle).toHaveBeenCalledWith('acc-uuid-1', {
            name: 'Cabaña del Río',
            thumbnailUrl: undefined
        });
        expect(mockAddToast).toHaveBeenCalledTimes(1);
        expect(mockAddToast.mock.calls[0]?.[0].type).toBe('success');
    });

    it('still surfaces the upsell toast when blocked (free/anonymous)', () => {
        setCompareMode(true);
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'upsell' }) });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);
        fireEvent.click(screen.getByRole('button'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('info');
        expect(arg.action?.href).toBe('/es/suscriptores/turistas/');
    });

    it('still surfaces the limit toast when blocked (at per-plan cap)', () => {
        setCompareMode(true);
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'limit' }) });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);
        fireEvent.click(screen.getByRole('button'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('warning');
    });

    it('does not toggle while entitlements are still loading, same as other variants', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ isLoading: true, toggle });

        render(<CompareButton {...buildProps({ variant: 'contextual' })} />);
        fireEvent.click(screen.getByRole('button'));

        expect(toggle).not.toHaveBeenCalled();
        expect(mockAddToast).not.toHaveBeenCalled();
    });
});
