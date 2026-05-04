/**
 * @file DateRangeFilter.test.tsx
 * @description Unit tests for the DateRangeFilter sidebar component.
 * Verifies trigger label rendering, popover open/close, range selection
 * round-trip through onChange, and clear behavior.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateRangeFilter } from '../../../../../src/components/shared/filters/filter-types/DateRangeFilter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock(
    '../../../../../src/components/shared/filters/filter-types/DateRangeFilter.module.css',
    () => ({
        default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
    })
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONFIG = {
    id: 'dates',
    label: 'Fechas',
    type: 'date-range' as const,
    checkInPlaceholder: 'Llegada',
    checkOutPlaceholder: 'Salida'
};

const LOCALE = 'es' as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DateRangeFilter', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the configured check-in placeholder when no value is set', () => {
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '', to: '' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        expect(screen.getByRole('button', { name: /fechas/i })).toBeInTheDocument();
        // The trigger label uses `config.checkInPlaceholder` when present.
        expect(screen.getByText(/llegada/i)).toBeInTheDocument();
    });

    it('falls back to the default placeholder string when no checkInPlaceholder is provided', () => {
        const minimalConfig = { id: 'dates', label: 'Fechas', type: 'date-range' as const };
        render(
            <DateRangeFilter
                config={minimalConfig}
                value={{ from: '', to: '' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        expect(screen.getByText(/elegí tus fechas/i)).toBeInTheDocument();
    });

    it('shows the formatted date range when both from/to are set', () => {
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '2026-06-01', to: '2026-06-07' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        // Local-day formatting (DD/MM)
        expect(screen.getByText(/01\/06\s*[–-]\s*07\/06/)).toBeInTheDocument();
    });

    it('renders a clear button when a value is present', () => {
        const onChange = vi.fn();
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '2026-06-01', to: '2026-06-07' }}
                onChange={onChange}
                locale={LOCALE}
            />
        );
        const clearBtn = screen.getByRole('button', { name: /limpiar fechas/i });
        fireEvent.click(clearBtn);
        expect(onChange).toHaveBeenCalledWith({ from: '', to: '' });
    });

    it('does NOT render a clear button when value is empty', () => {
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '', to: '' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
    });

    it('opens a portaled popover with role="dialog" when the trigger is clicked', () => {
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '', to: '' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        const trigger = screen.getByRole('button', { name: /fechas/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: /fechas/i })).toBeInTheDocument();
    });

    it('closes the popover when Escape is pressed', () => {
        render(
            <DateRangeFilter
                config={CONFIG}
                value={{ from: '', to: '' }}
                onChange={() => {}}
                locale={LOCALE}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /fechas/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
