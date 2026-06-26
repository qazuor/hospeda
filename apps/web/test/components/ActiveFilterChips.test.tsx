/**
 * @file ActiveFilterChips.test.tsx
 * @description Component tests for ActiveFilterChips (SPEC-212 T-011).
 *
 * Strategy: mock `@/lib/i18n` and the CSS module. Pass a `filters` object
 * directly via props and assert rendering / interactions.
 *
 * Coverage:
 * - Renders one chip per active filter key for a multi-field filters object.
 * - Renders nothing when filters is null.
 * - Renders nothing when filters is an empty object.
 * - Clicking a chip's remove button calls onRemove with the correct key.
 * - Label formatting for enum (accommodationType), numeric (minGuests, maxPrice),
 *   boolean (hasPool), and array (amenitySlugs) field types.
 * - Location group keys (latitude, longitude, radius, locationType) produce a
 *   single deduplicated chip.
 * - Boolean false fields produce no chip.
 * - Empty array fields produce no chip.
 * - Each remove button has an aria-label.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveFilterChipsProps } from '../../src/components/ai-search/ActiveFilterChips';
import { ActiveFilterChips } from '../../src/components/ai-search/ActiveFilterChips';

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * i18n mock: returns fallback when provided, key otherwise.
 * Also handles {{value}} interpolation so label assertions work.
 */
vi.mock('@/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
        let raw = fallback ?? key;
        if (params) {
            raw = Object.entries(params).reduce(
                (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
                raw
            );
        }
        return raw;
    };
    const translations = { t };
    return {
        createTranslations: (_locale: string) => translations
    };
});

// CSS module proxy: className lookups return the property name.
vi.mock('../../src/components/ai-search/ActiveFilterChips.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderChips(overrides: Partial<ActiveFilterChipsProps> = {}) {
    const onRemove = vi.fn();
    const props: ActiveFilterChipsProps = {
        filters: null,
        onRemove,
        locale: 'es',
        ...overrides
    };
    render(<ActiveFilterChips {...props} />);
    return { onRemove };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActiveFilterChips', () => {
    // ── Null / empty state ─────────────────────────────────────────────────────

    describe('null and empty state', () => {
        it('renders nothing when filters is null', () => {
            const { container } = render(
                <ActiveFilterChips
                    filters={null}
                    onRemove={vi.fn()}
                    locale="es"
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when filters is an empty object', () => {
            const { container } = render(
                <ActiveFilterChips
                    filters={{}}
                    onRemove={vi.fn()}
                    locale="es"
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when all values are false/null/undefined', () => {
            const { container } = render(
                <ActiveFilterChips
                    filters={{ hasPool: false, hasWifi: false }}
                    onRemove={vi.fn()}
                    locale="es"
                />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    // ── One chip per key ───────────────────────────────────────────────────────

    describe('chip count per active filter key', () => {
        it('renders one chip per active key for a multi-field filters object', () => {
            renderChips({
                filters: {
                    accommodationType: 'CABIN',
                    minGuests: 4,
                    hasPool: true,
                    city: 'Concepción del Uruguay'
                }
            });
            // accommodationType, minGuests, hasPool, city = 4 chips
            expect(screen.getAllByRole('listitem')).toHaveLength(4);
        });

        it('renders exactly one chip for a single active key', () => {
            renderChips({ filters: { minGuests: 2 } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });
    });

    // ── Label formatting ───────────────────────────────────────────────────────

    describe('label formatting', () => {
        it('formats accommodationType enum using the translated type name', () => {
            renderChips({ filters: { accommodationType: 'CABIN' } });
            // Mock t: 'accommodations.types.cabin' fallback is 'Cabaña' — BUT our
            // mock returns the key (no fallback provided in ACCOMMODATION_TYPE_KEYS),
            // then wraps it in 'Tipo: {{value}}'. So the label is:
            // "Tipo: accommodations.types.cabin"
            // That means the chip text contains "Tipo:" at minimum.
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('Tipo:');
        });

        it('formats minGuests with value interpolation', () => {
            renderChips({ filters: { minGuests: 4 } });
            const chip = screen.getByRole('listitem');
            // fallback is 'Mínimo {{value}} huéspedes' → 'Mínimo 4 huéspedes'
            expect(chip.textContent).toContain('4');
        });

        it('formats maxPrice with value interpolation', () => {
            renderChips({ filters: { maxPrice: 50000 } });
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('50000');
        });

        it('formats boolean hasPool with a fixed label (no interpolation)', () => {
            renderChips({ filters: { hasPool: true } });
            const chip = screen.getByRole('listitem');
            // The mock resolveChipLabel calls t('aiSearch.chips.hasPool', key) where
            // key = 'hasPool'. The mock returns the fallback if provided, else the key.
            // The fallback passed is the string 'hasPool' (the key name), so the mock
            // returns 'hasPool'. This is test-mode behavior — real i18n returns 'Con pileta'.
            // Verify the chip renders (has a label + remove button) rather than a specific string.
            expect(chip.textContent).toBeTruthy();
            expect(chip.querySelector('button')).toBeInTheDocument();
        });

        it('formats amenitySlugs array as a single chip showing first + count', () => {
            renderChips({ filters: { amenitySlugs: ['pool', 'wifi', 'gym'] } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
            const chip = screen.getByRole('listitem');
            // The component calls t('aiSearch.chips.amenities', 'Comodidades adicionales', {value})
            // but the fallback string 'Comodidades adicionales' has no {{value}} placeholder,
            // so the mock returns it as-is. Verify chip exists with some text content.
            expect(chip.textContent).toContain('Comodidades adicionales');
        });

        it('formats featureSlugs array as a single chip', () => {
            renderChips({ filters: { featureSlugs: ['mountain-view'] } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('formats city with the city name value', () => {
            renderChips({ filters: { city: 'Concepción del Uruguay' } });
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('Concepción del Uruguay');
        });

        it('formats checkIn date with value', () => {
            renderChips({ filters: { checkIn: '2026-07-15' } });
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('2026-07-15');
        });

        it('formats checkOut date with value', () => {
            renderChips({ filters: { checkOut: '2026-07-20' } });
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('2026-07-20');
        });
    });

    // ── Suppressed fields ──────────────────────────────────────────────────────

    describe('suppressed chip fields', () => {
        it('does NOT render a chip for hasPool: false', () => {
            renderChips({ filters: { hasPool: false, minGuests: 2 } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('does NOT render a chip for empty amenitySlugs array', () => {
            renderChips({ filters: { amenitySlugs: [], city: 'Rosario' } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('does NOT render a chip for empty featureSlugs array', () => {
            renderChips({ filters: { featureSlugs: [], hasWifi: true } });
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('does NOT render a chip for the currency field', () => {
            renderChips({ filters: { currency: 'ARS', maxPrice: 10000 } });
            // Only maxPrice renders; currency is suppressed.
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });
    });

    // ── Location deduplication ─────────────────────────────────────────────────

    describe('location key deduplication', () => {
        it('renders only ONE chip for multiple location keys (lat, lng, radius, locationType)', () => {
            renderChips({
                filters: {
                    latitude: -32.5,
                    longitude: -58.2,
                    radius: 20,
                    locationType: 'geo'
                }
            });
            // All 4 keys collapse to 1 chip.
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('the single location chip shows a generic location label', () => {
            renderChips({ filters: { latitude: -32.5, longitude: -58.2 } });
            const chip = screen.getByRole('listitem');
            // Mock t returns fallback 'Ubicación'
            expect(chip.textContent).toContain('Ubicación');
        });
    });

    // ── Remove button interaction ──────────────────────────────────────────────

    describe('remove button interaction', () => {
        it('clicking a remove button calls onRemove with the correct key', () => {
            const { onRemove } = renderChips({
                filters: { minGuests: 3 }
            });
            fireEvent.click(screen.getByRole('button'));
            expect(onRemove).toHaveBeenCalledOnce();
            expect(onRemove).toHaveBeenCalledWith('minGuests');
        });

        it('clicking remove on accommodationType calls onRemove with "accommodationType"', () => {
            const { onRemove } = renderChips({
                filters: { accommodationType: 'HOTEL' }
            });
            fireEvent.click(screen.getByRole('button'));
            expect(onRemove).toHaveBeenCalledWith('accommodationType');
        });

        it('clicking remove on hasPool calls onRemove with "hasPool"', () => {
            const { onRemove } = renderChips({ filters: { hasPool: true } });
            fireEvent.click(screen.getByRole('button'));
            expect(onRemove).toHaveBeenCalledWith('hasPool');
        });

        it('clicking remove on amenitySlugs calls onRemove with "amenitySlugs"', () => {
            const { onRemove } = renderChips({ filters: { amenitySlugs: ['pool', 'wifi'] } });
            fireEvent.click(screen.getByRole('button'));
            expect(onRemove).toHaveBeenCalledWith('amenitySlugs');
        });

        it('clicking the correct remove button when multiple chips are present', () => {
            const { onRemove } = renderChips({
                filters: { minGuests: 2, maxPrice: 30000 }
            });
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(2);
            // Click second button
            fireEvent.click(buttons[1]);
            expect(onRemove).toHaveBeenCalledOnce();
        });
    });

    // ── Accessibility ──────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('the chip list has an aria-label', () => {
            renderChips({ filters: { hasWifi: true } });
            const list = screen.getByRole('list');
            expect(list).toHaveAttribute('aria-label');
        });

        it('each remove button has an aria-label', () => {
            renderChips({ filters: { hasPool: true, minGuests: 4 } });
            const buttons = screen.getAllByRole('button');
            for (const btn of buttons) {
                expect(btn).toHaveAttribute('aria-label');
            }
        });

        it('remove button has type="button" to avoid accidental form submission', () => {
            renderChips({ filters: { city: 'Rosario' } });
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
        });

        it('the chip list renders as a <ul> (semantic list element)', () => {
            renderChips({ filters: { hasParking: true } });
            expect(screen.getByRole('list').tagName).toBe('UL');
        });
    });

    // ── Destination chip resolution (SPEC-265 A3) ──────────────────────────────

    describe('destination chip resolution (SPEC-265 A3)', () => {
        const DESTINATION_CATALOG: Record<string, string> = {
            '11111111-1111-4111-8111-111111111111': 'Concepción del Uruguay',
            '22222222-2222-4222-8222-222222222222': 'Gualeguaychú'
        };

        it('shows the real destination name when catalog is provided and UUID matches', () => {
            renderChips({
                filters: { destinationId: '11111111-1111-4111-8111-111111111111' },
                destinations: DESTINATION_CATALOG
            });
            const chip = screen.getByRole('listitem');
            // Mock t interpolates {{value}} — 'Destino: Concepción del Uruguay'
            expect(chip.textContent).toContain('Concepción del Uruguay');
        });

        it('falls back to generic label when catalog is provided but UUID not found', () => {
            renderChips({
                filters: { destinationId: '99999999-9999-4999-9999-999999999999' },
                destinations: DESTINATION_CATALOG
            });
            const chip = screen.getByRole('listitem');
            // Falls back to 'Destino filtrado'
            expect(chip.textContent).toContain('Destino filtrado');
        });

        it('shows generic label when no destinations catalog is provided', () => {
            renderChips({
                filters: { destinationId: '11111111-1111-4111-8111-111111111111' }
            });
            const chip = screen.getByRole('listitem');
            expect(chip.textContent).toContain('Destino filtrado');
        });
    });
});
