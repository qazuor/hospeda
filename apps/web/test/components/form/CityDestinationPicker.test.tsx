/**
 * @file CityDestinationPicker.test.tsx
 * @description Unit tests for the CityDestinationPicker autocomplete island.
 *
 * Covers debounced fetch, selection callback, fallback link rendering, and
 * keyboard navigation (arrow down focus, escape close). Network access is
 * mocked at the destinationsApi module boundary.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityDestinationPicker } from '../../../src/components/form/CityDestinationPicker.client';

/** Debounce window plus a small buffer to flush the timer reliably. */
const DEBOUNCE_WAIT = 350;

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/components/form/CityDestinationPicker.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const listMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints', () => ({
    destinationsApi: {
        list: (...args: unknown[]) => listMock(...args)
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CityResult = {
    readonly id: string;
    readonly name: string;
    readonly path?: string;
    readonly slug: string;
};

function buildSuccessResponse(items: ReadonlyArray<CityResult>) {
    return {
        ok: true,
        data: {
            items,
            pagination: {
                page: 1,
                pageSize: 10,
                total: items.length,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false
            }
        }
    };
}

const sampleResults: ReadonlyArray<CityResult> = [
    {
        id: 'city-1',
        name: 'Concepción del Uruguay',
        path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
        slug: 'concepcion-del-uruguay'
    },
    {
        id: 'city-2',
        name: 'Concordia',
        path: '/argentina/litoral/entre-rios/concordia',
        slug: 'concordia'
    }
];

/**
 * Type the input and flush the debounce + the awaited fetch microtasks. Uses
 * advanceTimersByTimeAsync so the resolved promise inside the picker's
 * useEffect runs to completion before the test asserts.
 */
async function typeAndFlush(input: HTMLElement, value: string): Promise<void> {
    fireEvent.change(input, { target: { value } });
    await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_WAIT);
    });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.useFakeTimers();
    listMock.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CityDestinationPicker', () => {
    it('renders the "no encuentro mi ciudad" link pointing to the feedback page', () => {
        render(
            <CityDestinationPicker
                locale="es"
                onSelect={vi.fn()}
            />
        );

        const link = screen.getByTestId('city-picker-not-found') as HTMLAnchorElement;
        expect(link).toBeInTheDocument();
        expect(link.getAttribute('href')).toContain('/es/feedback/');
        expect(link.getAttribute('href')).toContain('subject=');
    });

    it('does not fetch when input is shorter than 2 characters', async () => {
        render(
            <CityDestinationPicker
                locale="es"
                onSelect={vi.fn()}
            />
        );

        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'c' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(listMock).not.toHaveBeenCalled();
    });

    it('fires a debounced fetch with destinationType=CITY once the user types 2+ chars', async () => {
        listMock.mockResolvedValue(buildSuccessResponse(sampleResults));

        render(
            <CityDestinationPicker
                locale="es"
                onSelect={vi.fn()}
            />
        );

        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'co' } });

        // Before the debounce window elapses, no call should have been made.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        expect(listMock).not.toHaveBeenCalled();

        // Past the debounce window, exactly one call should fire.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });

        expect(listMock).toHaveBeenCalledTimes(1);
        expect(listMock).toHaveBeenCalledWith(
            expect.objectContaining({ destinationType: 'CITY', q: 'co' })
        );
    });

    it('invokes onSelect with the destination id and name on click', async () => {
        listMock.mockResolvedValue(buildSuccessResponse(sampleResults));
        const onSelect = vi.fn();

        render(
            <CityDestinationPicker
                locale="es"
                onSelect={onSelect}
            />
        );

        const input = screen.getByRole('combobox');
        await typeAndFlush(input, 'concep');

        const option = screen.getByText('Concepción del Uruguay');
        fireEvent.mouseDown(option);

        expect(onSelect).toHaveBeenCalledWith('city-1', 'Concepción del Uruguay');
    });

    it('moves visual focus to the first option on ArrowDown', async () => {
        listMock.mockResolvedValue(buildSuccessResponse(sampleResults));

        render(
            <CityDestinationPicker
                locale="es"
                onSelect={vi.fn()}
            />
        );

        const input = screen.getByRole('combobox');
        await typeAndFlush(input, 'co');

        const combobox = screen.getByRole('combobox');
        expect(combobox.getAttribute('aria-expanded')).toBe('true');

        // After results land, index 0 is auto-highlighted. ArrowDown advances to 1.
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const options = screen.getAllByRole('option');
        expect(options[1].getAttribute('aria-selected')).toBe('true');

        // ArrowDown again wraps back to index 0.
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const optionsAfter = screen.getAllByRole('option');
        expect(optionsAfter[0].getAttribute('aria-selected')).toBe('true');
    });

    it('closes the dropdown when Escape is pressed', async () => {
        listMock.mockResolvedValue(buildSuccessResponse(sampleResults));

        render(
            <CityDestinationPicker
                locale="es"
                onSelect={vi.fn()}
            />
        );

        const input = screen.getByRole('combobox');
        await typeAndFlush(input, 'co');

        const combobox = screen.getByRole('combobox');
        expect(combobox.getAttribute('aria-expanded')).toBe('true');

        fireEvent.keyDown(input, { key: 'Escape' });

        expect(combobox.getAttribute('aria-expanded')).toBe('false');
    });
});
