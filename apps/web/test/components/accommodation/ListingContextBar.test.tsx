/**
 * @file ListingContextBar.test.tsx
 * @description Unit tests for the ListingContextBar React island that powers
 * the editable trip-context bar (check-in, check-out, adults, children)
 * shown above the accommodations grid.
 *
 * Coverage:
 * - Initial mount does NOT trigger a debounced URL navigation (no self-loop).
 * - Editing each field (checkIn, checkOut, adults, children) routes through
 *   `debouncedNavigate` with the expected URLSearchParams payload.
 * - Existing URL params (sidebar filters) are preserved across edits.
 * - The "Limpiar" button resets values to the documented defaults and
 *   disappears once context is back to default.
 */

import { ListingContextBar } from '@/components/accommodation/ListingContextBar.client';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/accommodation/ListingContextBar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const debouncedNavigate = vi.fn<[URLSearchParams, ...unknown[]], void>();

vi.mock('@/components/shared/filters/hooks/useFilterDebounce', () => ({
    useFilterDebounce: () => ({
        debouncedNavigate,
        isPending: false,
        clearPending: vi.fn()
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setLocationSearch(search: string): void {
    // jsdom does not allow direct assignment to window.location, but
    // overriding via Object.defineProperty is safe per test.
    const url = new URL(`http://localhost/${search ? '?' : ''}${search}`);
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, search: url.search, href: url.href, pathname: '/' }
    });
}

function paramsToObject(params: URLSearchParams): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [key, value] of params.entries()) obj[key] = value;
    return obj;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
    debouncedNavigate.mockClear();
    setLocationSearch('');
});

afterEach(() => {
    setLocationSearch('');
});

// ---------------------------------------------------------------------------
// Tests: initial mount
// ---------------------------------------------------------------------------

describe('ListingContextBar — initial mount', () => {
    it('does not trigger a debounced navigation on first render', () => {
        // Arrange / Act — mounting with no overrides should be a no-op so we
        // don't immediately re-navigate to the URL we just arrived from.
        render(<ListingContextBar locale="es" />);

        // Assert
        expect(debouncedNavigate).not.toHaveBeenCalled();
    });

    it('still skips the initial debounced call when initial values are provided', () => {
        // Arrange / Act — even with hydrated values from the URL, the first
        // effect run is a sentinel that flips `isInitialRender.current` and
        // returns. Re-emitting would be a wasted hop.
        render(
            <ListingContextBar
                locale="es"
                initialCheckIn="2026-02-10"
                initialCheckOut="2026-02-14"
                initialAdults={3}
                initialChildren={1}
            />
        );

        // Assert
        expect(debouncedNavigate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Tests: editing fields
// ---------------------------------------------------------------------------

describe('ListingContextBar — debounced URL sync on edit', () => {
    it('emits checkIn through debouncedNavigate when the user picks a date', () => {
        // Arrange
        render(<ListingContextBar locale="es" />);
        const checkInInput = screen.getByLabelText('Llegada') as HTMLInputElement;

        // Act
        fireEvent.change(checkInInput, { target: { value: '2026-03-01' } });

        // Assert — the hook is called exactly once with the new param set
        // (the hook itself owns the 500ms debounce; we mock it out so we
        // can observe the payload directly).
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        const params = debouncedNavigate.mock.calls[0][0];
        expect(paramsToObject(params)).toMatchObject({
            checkIn: '2026-03-01',
            adults: '2',
            children: '0'
        });
        expect(params.has('checkOut')).toBe(false);
    });

    it('emits checkOut updates and keeps the existing checkIn value', () => {
        // Arrange — pre-load with a checkIn already set (typical "edit"
        // scenario after the user arrived with both values from a search).
        render(
            <ListingContextBar
                locale="es"
                initialCheckIn="2026-03-01"
            />
        );
        const checkOutInput = screen.getByLabelText('Salida') as HTMLInputElement;

        // Act
        fireEvent.change(checkOutInput, { target: { value: '2026-03-05' } });

        // Assert
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        const params = debouncedNavigate.mock.calls[0][0];
        expect(paramsToObject(params)).toMatchObject({
            checkIn: '2026-03-01',
            checkOut: '2026-03-05',
            adults: '2',
            children: '0'
        });
    });

    it('emits adults updates via the stepper buttons', () => {
        // Arrange
        render(<ListingContextBar locale="es" />);
        const incrementButton = screen.getByLabelText('Adultos +');

        // Act
        fireEvent.click(incrementButton);

        // Assert — adults went from 2 to 3.
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        expect(paramsToObject(debouncedNavigate.mock.calls[0][0])).toMatchObject({
            adults: '3',
            children: '0'
        });
    });

    it('emits children updates via the stepper buttons', () => {
        // Arrange
        render(<ListingContextBar locale="es" />);
        const incrementButton = screen.getByLabelText('Niños +');

        // Act
        fireEvent.click(incrementButton);

        // Assert
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        expect(paramsToObject(debouncedNavigate.mock.calls[0][0])).toMatchObject({
            adults: '2',
            children: '1'
        });
    });

    it('preserves unrelated URL params already on window.location.search', () => {
        // Arrange — the sidebar may have set sidebar-owned filters earlier
        // (e.g. `type=hotel,cabin`). The context bar reads the live URL on
        // every change so those params must survive the navigation.
        setLocationSearch('type=hotel%2Ccabin&hasWifi=true');
        render(<ListingContextBar locale="es" />);

        // Act
        fireEvent.click(screen.getByLabelText('Adultos +'));

        // Assert
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        const params = debouncedNavigate.mock.calls[0][0];
        const obj = paramsToObject(params);
        expect(obj).toMatchObject({
            type: 'hotel,cabin',
            hasWifi: 'true',
            adults: '3',
            children: '0'
        });
    });

    it('drops checkIn from the URL when the user clears the date', () => {
        // Arrange — start with a checkIn already in state.
        render(
            <ListingContextBar
                locale="es"
                initialCheckIn="2026-03-01"
            />
        );
        const checkInInput = screen.getByLabelText('Llegada') as HTMLInputElement;

        // Act — emptying the input should trigger a navigation that omits
        // the param entirely (not `checkIn=`).
        fireEvent.change(checkInInput, { target: { value: '' } });

        // Assert
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        const params = debouncedNavigate.mock.calls[0][0];
        expect(params.has('checkIn')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Tests: clear button
// ---------------------------------------------------------------------------

describe('ListingContextBar — clear button', () => {
    it('is hidden by default when context matches the documented defaults', () => {
        // Arrange / Act — default values: adults=2, children=0, no dates.
        render(<ListingContextBar locale="es" />);

        // Assert
        expect(screen.queryByLabelText('Limpiar contexto')).toBeNull();
    });

    it('is visible when any non-default value is present', () => {
        // Arrange / Act
        render(
            <ListingContextBar
                locale="es"
                initialAdults={4}
            />
        );

        // Assert
        expect(screen.getByLabelText('Limpiar contexto')).toBeInTheDocument();
    });

    it('resets all fields to defaults and emits a clean navigation', () => {
        // Arrange — non-default values across the board.
        render(
            <ListingContextBar
                locale="es"
                initialCheckIn="2026-03-01"
                initialCheckOut="2026-03-05"
                initialAdults={4}
                initialChildren={2}
            />
        );
        const clearButton = screen.getByLabelText('Limpiar contexto');

        // Act
        fireEvent.click(clearButton);

        // Assert — after the reset all four state slices changed so the
        // effect fires once with the documented defaults (adults=2,
        // children=0) and no date params at all.
        expect(debouncedNavigate).toHaveBeenCalledTimes(1);
        const params = debouncedNavigate.mock.calls[0][0];
        const obj = paramsToObject(params);
        expect(obj.adults).toBe('2');
        expect(obj.children).toBe('0');
        expect(params.has('checkIn')).toBe(false);
        expect(params.has('checkOut')).toBe(false);
        // And the button itself disappears now that defaults are restored.
        expect(screen.queryByLabelText('Limpiar contexto')).toBeNull();
    });
});
