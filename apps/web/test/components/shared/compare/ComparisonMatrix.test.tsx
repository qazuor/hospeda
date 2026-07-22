/**
 * @file ComparisonMatrix.test.tsx
 * @description Unit tests for the comparison matrix island (SPEC-288 T-011,
 * HOS-85 T-008).
 *
 * Coverage:
 * - Empty state when fewer than 2 accommodations are selected.
 * - Ready state: hydrates via the compare endpoint and renders one column per
 *   accommodation with its name + a details link.
 * - Error state: an ENTITLEMENT_REQUIRED (403) response shows the upsell panel
 *   with a link to the plans page.
 * - HOS-85 T-008: the "highlight differences" toggle (default ON) shades rows
 *   whose values differ and can be turned off; best-value markers (cheapest
 *   price, highest rating) render independently of the toggle state.
 * - HOS-85 T-009: the mobile layer — scroll-snap container class on the
 *   table wrapper, sticky-column class on the attribute cells, the amber
 *   best-value dot (mobile adaptation of the T-008 badge), and the scroll
 *   hint. Assertions are class/element/testid presence only (jsdom does not
 *   evaluate the `@media` rules that gate the actual mobile behavior).
 *
 * The store, API client and card transform are mocked so the matrix contract is
 * verified without network or localStorage.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonMatrix } from '../../../../src/components/shared/compare/ComparisonMatrix.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createT:
        (_locale: string) => (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const template = fallback ?? key;
            if (!params) {
                return template;
            }
            return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
                name in params ? String(params[name]) : `{{${name}}}`
            );
        }
}));

vi.mock('../../../../src/components/shared/compare/ComparisonMatrix.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@repo/icons', () => ({
    StarIcon: ({ size }: { size?: number }) => (
        <svg
            data-testid="star-icon"
            width={size}
            aria-hidden="true"
        />
    )
}));

vi.mock('../../../../src/lib/colors', () => ({
    getAccommodationTypeLabel: ({ type }: { type: string }) => `type:${type}`
}));

vi.mock('../../../../src/lib/format-utils', () => ({
    formatPrice: ({ amount }: { amount: number }) => `$${amount}`
}));

// Card transform → passthrough that honors per-item overrides (price,
// averageRating, type, ...) when present on the raw compare-response item,
// falling back to fixed defaults otherwise. This lets tests build items that
// differ on a single attribute without re-mocking the whole module.
vi.mock('../../../../src/lib/api/transforms', () => ({
    toAccommodationCardProps: ({ item }: { item: Record<string, unknown> }) => ({
        id: String(item.id),
        name: String(item.name),
        slug: String(item.slug),
        type: (item.type as string | undefined) ?? 'CABIN',
        summary: (item.summary as string | undefined) ?? 'A nice place',
        averageRating: (item.averageRating as number | undefined) ?? 4.5,
        reviewsCount: (item.reviewsCount as number | undefined) ?? 3,
        isFeatured: (item.isFeatured as boolean | undefined) ?? false,
        location: { city: 'Concepción', state: '' },
        cityName: (item.cityName as string | undefined) ?? 'Concepción',
        featuredImage: { url: '' },
        price: (item.price as { amount: number; currency: string; period: string } | undefined) ?? {
            amount: 1000,
            currency: 'ARS',
            period: 'noche'
        }
    })
}));

const mockCompare = vi.fn();
vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    protectedAccommodationsApi: {
        compare: (...args: unknown[]) => mockCompare(...args)
    }
}));

const mockStore = vi.hoisted(() => ({ value: { ids: [] as string[], items: [] as unknown[] } }));
vi.mock('../../../../src/store/compare-store', () => ({
    useCompareStore: () => mockStore.value
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setIds(ids: string[]): void {
    mockStore.value = { ids, items: ids.map((id) => ({ id })) };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockStore.value = { ids: [], items: [] };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ComparisonMatrix', () => {
    it('shows the empty state when fewer than 2 items are selected', () => {
        setIds(['a']);

        render(<ComparisonMatrix locale="es" />);

        expect(screen.getByText('No hay alojamientos para comparar')).toBeInTheDocument();
        expect(mockCompare).not.toHaveBeenCalled();
    });

    it('hydrates and renders a column per accommodation', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a' },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b' }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        expect(await screen.findByText('Cabaña A')).toBeInTheDocument();
        expect(screen.getByText('Cabaña B')).toBeInTheDocument();
        expect(mockCompare).toHaveBeenCalledWith({ ids: ['a', 'b'] });

        // The details link points at the accommodation detail page.
        const links = screen.getAllByRole('link', { name: 'Ver detalle' });
        expect(links[0]).toHaveAttribute('href', '/es/alojamientos/cabana-a/');
    });

    it('shows the upsell panel when the entitlement is missing (403)', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED' }
        });

        render(<ComparisonMatrix locale="es" />);

        const cta = await screen.findByRole('link', { name: 'Ver planes' });
        expect(cta).toHaveAttribute('href', '/es/suscriptores/turistas/');
    });
});

describe('ComparisonMatrix — diff highlighting and best-value markers (HOS-85 T-008)', () => {
    it('highlights a differing row by default (toggle defaults ON)', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a', price: { amount: 1000 } },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b', price: { amount: 1500 } }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const priceRow = await screen.findByTestId('comparison-row-price');
        expect(priceRow).toHaveClass('rowDiffers');

        const toggle = screen.getByRole('button', { name: /Resaltar diferencias/ });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('does not highlight a row where all values are equal', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a' },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b' }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const typeRow = await screen.findByTestId('comparison-row-type');
        expect(typeRow).not.toHaveClass('rowDiffers');
    });

    it('removes the highlight when toggled off but keeps the best-value marker', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a', price: { amount: 1000 } },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b', price: { amount: 1500 } }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const priceRow = await screen.findByTestId('comparison-row-price');
        expect(priceRow).toHaveClass('rowDiffers');
        expect(screen.getByTestId('best-value-price-a')).toBeInTheDocument();

        const toggle = screen.getByRole('button', { name: /Resaltar diferencias/ });
        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(priceRow).not.toHaveClass('rowDiffers');
        expect(screen.getByTestId('best-value-price-a')).toBeInTheDocument();
    });

    it('marks the cheapest accommodation with the best-value marker on the price row', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a', price: { amount: 1500 } },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b', price: { amount: 900 } }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        await screen.findByTestId('comparison-row-price');
        expect(screen.getByTestId('best-value-price-b')).toBeInTheDocument();
        expect(screen.queryByTestId('best-value-price-a')).not.toBeInTheDocument();
    });

    it('marks the highest-rated accommodation with the best-value marker on the rating row', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a', averageRating: 3.2 },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b', averageRating: 4.9 }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        await screen.findByTestId('comparison-row-rating');
        expect(screen.getByTestId('best-value-rating-b')).toBeInTheDocument();
        expect(screen.queryByTestId('best-value-rating-a')).not.toBeInTheDocument();
    });
});

describe('ComparisonMatrix — mobile layer (HOS-85 T-009)', () => {
    it('renders the accommodation columns inside a scroll-snap container', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a' },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b' }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const scrollContainer = await screen.findByTestId('comparison-scroll-container');
        expect(scrollContainer).toHaveClass('scrollSnapContainer');
        // Desktop's horizontal-scroll wrapper class must still be present —
        // the snap container is additive, not a replacement (T-008 intact).
        expect(scrollContainer).toHaveClass('tableWrap');
    });

    it('keeps the attribute column sticky on both the corner cell and row labels', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a' },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b' }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const cornerCell = await screen.findByTestId('comparison-corner-cell');
        expect(cornerCell).toHaveClass('stickyCol');

        const priceLabel = await screen.findByTestId('comparison-row-label-price');
        expect(priceLabel).toHaveClass('stickyCol');
    });

    it('renders an amber best-value dot alongside the desktop badge', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a', price: { amount: 900 } },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b', price: { amount: 1500 } }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        await screen.findByTestId('best-value-price-a');
        const dot = screen.getByTestId('best-value-dot-price-a');
        expect(dot).toHaveClass('bestValueDot');
        expect(dot).toHaveAttribute('aria-label', 'Mejor valor en Precio');
        // Only the winning accommodation gets a dot.
        expect(screen.queryByTestId('best-value-dot-price-b')).not.toBeInTheDocument();
    });

    it('shows the mobile scroll hint', async () => {
        setIds(['a', 'b']);
        mockCompare.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', name: 'Cabaña A', slug: 'cabana-a' },
                    { id: 'b', name: 'Cabaña B', slug: 'cabana-b' }
                ]
            }
        });

        render(<ComparisonMatrix locale="es" />);

        const hint = await screen.findByTestId('comparison-scroll-hint');
        expect(hint).toHaveClass('scrollHint');
        expect(hint).toHaveTextContent('Deslizá para ver más →');
    });
});
