/**
 * @file CompareCardSelect.test.tsx
 * @description Unit tests for the CompareCardSelect whole-card compare
 * selection overlay (HOS-85 post-review fix).
 *
 * Coverage:
 * - Renders `null` (no DOM) while compare mode is off — the fix for the
 *   original bug where the contextual CompareButton never hydrated.
 * - Renders the overlay (role="checkbox") while compare mode is on, with
 *   `aria-checked` reflecting whether the accommodation is selected.
 * - Unselected renders NO check icon at all (so nothing covers the card's
 *   FavoriteButton); selected renders a large, centered check icon
 *   (post-review fix, HOS-85 — replaces the old always-present corner badge).
 * - Activating the overlay (click or Enter/Space) toggles the selection and
 *   blocks the click from reaching an ancestor `<a>` (no navigation) via
 *   `preventDefault` + `stopPropagation`.
 * - Surfaces the same added/removed/upsell/limit toasts as CompareButton.
 * - Defers while entitlements are loading.
 *
 * `useCompareGuard` is mocked so neither the compare-store selection nor
 * entitlements network are touched. The compare-MODE store
 * (`useCompareMode`/`setCompareMode`) is used for real (not mocked) — same
 * pattern as `test/components/shared/compare/CompareButton.test.tsx` — and
 * reset to `false` in `beforeEach`/`afterEach` since it's a module-level
 * singleton.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareCardSelect } from '../../../../src/components/shared/compare/CompareCardSelect.client';
import type { CompareCardSelectProps } from '../../../../src/components/shared/compare/CompareCardSelect.client';
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

vi.mock('../../../../src/components/shared/compare/CompareCardSelect.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    CheckCircleIcon: ({ weight, size }: { weight?: string; size?: number }) => (
        <svg
            data-testid="check-circle-icon"
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

function buildProps(overrides: Partial<CompareCardSelectProps> = {}): CompareCardSelectProps {
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
// 1. Compare-mode gating (the bug this component fixes)
// ---------------------------------------------------------------------------

describe('CompareCardSelect — compare mode gating', () => {
    it('renders nothing when compare mode is off (the default)', () => {
        setCompareMode(false);

        const { container } = render(<CompareCardSelect {...buildProps()} />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders the overlay checkbox when compare mode is on', () => {
        setCompareMode(true);

        render(<CompareCardSelect {...buildProps()} />);

        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 2. Selected-state rendering
// ---------------------------------------------------------------------------

describe('CompareCardSelect — selected state', () => {
    it('has aria-checked=false and renders no check icon when not selected', () => {
        setCompareMode(true);
        setGuard({ isInList: () => false });

        render(<CompareCardSelect {...buildProps()} />);

        const overlay = screen.getByRole('checkbox');
        expect(overlay).toHaveAttribute('aria-checked', 'false');
        // Post-review fix (HOS-85): unselected renders NO icon/badge at all —
        // nothing may cover the card's FavoriteButton in the same corner.
        expect(screen.queryByTestId('check-circle-icon')).not.toBeInTheDocument();
    });

    it('has aria-checked=true and shows a large, centered check icon when selected', () => {
        setCompareMode(true);
        setGuard({ isInList: () => true });

        render(<CompareCardSelect {...buildProps()} />);

        const overlay = screen.getByRole('checkbox');
        expect(overlay).toHaveAttribute('aria-checked', 'true');
        const icon = screen.getByTestId('check-circle-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('width', '48');
        // The icon's wrapping span carries the "centered over the photo"
        // positioning class from the CSS module (mocked to the literal
        // class-name string).
        expect(icon.parentElement).toHaveClass('selectedCheck');
    });

    it('is keyboard-focusable (tabIndex=0)', () => {
        setCompareMode(true);

        render(<CompareCardSelect {...buildProps()} />);

        expect(screen.getByRole('checkbox')).toHaveAttribute('tabindex', '0');
    });
});

// ---------------------------------------------------------------------------
// 3. Activation blocks navigation (the design requirement)
// ---------------------------------------------------------------------------

describe('CompareCardSelect — blocks card navigation on activation', () => {
    it('calls preventDefault on click (dispatchEvent returns false)', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareCardSelect {...buildProps()} />);
        const wasNotCancelled = fireEvent.click(screen.getByRole('checkbox'));

        // fireEvent's dispatchEvent returns false when preventDefault() was
        // called on the (cancelable) click event.
        expect(wasNotCancelled).toBe(false);
        expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('stops the click from bubbling to an ancestor <a>', () => {
        setCompareMode(true);
        const parentOnClick = vi.fn();

        render(
            <a
                href="/detail"
                onClick={parentOnClick}
            >
                <CompareCardSelect {...buildProps()} />
            </a>
        );
        fireEvent.click(screen.getByRole('checkbox'));

        expect(parentOnClick).not.toHaveBeenCalled();
    });

    it('activates on Enter keydown and prevents default', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareCardSelect {...buildProps()} />);
        const wasNotCancelled = fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });

        expect(wasNotCancelled).toBe(false);
        expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('activates on Space keydown and prevents default', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareCardSelect {...buildProps()} />);
        const wasNotCancelled = fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });

        expect(wasNotCancelled).toBe(false);
        expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('ignores unrelated keydowns', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Tab' });

        expect(toggle).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 4. Toggle outcomes (toasts) — identical contract to CompareButton
// ---------------------------------------------------------------------------

describe('CompareCardSelect — toggle outcomes', () => {
    beforeEach(() => setCompareMode(true));

    it('shows a success toast with a compare-now action when added', () => {
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ toggle });

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.click(screen.getByRole('checkbox'));

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

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.click(screen.getByRole('checkbox'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('success');
        expect(arg.action).toBeUndefined();
    });

    it('shows an upsell toast with a plans CTA when blocked for free/anonymous', () => {
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'upsell' }) });

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.click(screen.getByRole('checkbox'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('info');
        expect(arg.action?.href).toBe('/es/suscriptores/planes/');
    });

    it('shows a warning toast when blocked by the per-plan limit', () => {
        setGuard({ toggle: () => ({ action: 'blocked', reason: 'limit' }) });

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.click(screen.getByRole('checkbox'));

        const arg = mockAddToast.mock.calls[0]?.[0];
        expect(arg.type).toBe('warning');
        expect(arg.action).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 5. Loading guard
// ---------------------------------------------------------------------------

describe('CompareCardSelect — loading', () => {
    it('does not toggle while entitlements are still loading', () => {
        setCompareMode(true);
        const toggle = vi.fn(() => ({ action: 'added' as const, reason: null }));
        setGuard({ isLoading: true, toggle });

        render(<CompareCardSelect {...buildProps()} />);
        fireEvent.click(screen.getByRole('checkbox'));

        expect(toggle).not.toHaveBeenCalled();
        expect(mockAddToast).not.toHaveBeenCalled();
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-busy', 'true');
    });
});
