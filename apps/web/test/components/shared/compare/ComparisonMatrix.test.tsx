/**
 * @file ComparisonMatrix.test.tsx
 * @description Unit tests for the comparison matrix island (SPEC-288 T-011).
 *
 * Coverage:
 * - Empty state when fewer than 2 accommodations are selected.
 * - Ready state: hydrates via the compare endpoint and renders one column per
 *   accommodation with its name + a details link.
 * - Error state: an ENTITLEMENT_REQUIRED (403) response shows the upsell panel
 *   with a link to the plans page.
 *
 * The store, API client and card transform are mocked so the matrix contract is
 * verified without network or localStorage.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonMatrix } from '../../../../src/components/shared/compare/ComparisonMatrix.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
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

// Card transform → minimal passthrough so the matrix renders deterministic cells.
vi.mock('../../../../src/lib/api/transforms', () => ({
    toAccommodationCardProps: ({ item }: { item: Record<string, unknown> }) => ({
        id: String(item.id),
        name: String(item.name),
        slug: String(item.slug),
        type: 'CABIN',
        summary: 'A nice place',
        averageRating: 4.5,
        reviewsCount: 3,
        isFeatured: false,
        location: { city: 'Concepción', state: '' },
        cityName: 'Concepción',
        featuredImage: { url: '' },
        price: { amount: 1000, currency: 'ARS', period: 'noche' }
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
        expect(cta).toHaveAttribute('href', '/es/suscriptores/planes/');
    });
});
