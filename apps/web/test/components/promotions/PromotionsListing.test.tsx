/**
 * HOS-2589 D-2 / AC-31: the `/promociones/` island paginates with one session seed.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsListing } from '../../../src/components/promotions/PromotionsListing.client';
import { resetPromotionReadsForTests } from '../../../src/lib/promotions/visible-promotions-api';
import { envelope, lockedItem, visibleItem } from './promotion-fixtures';

const fetchMock = vi.fn();

beforeEach(() => {
    resetPromotionReadsForTests();
    sessionStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
});

function listingPage(page: number, title: string) {
    return envelope({
        items: [visibleItem({ title }), lockedItem()],
        meta: { isVip: false, freeQuota: 3 },
        pagination: { page, pageSize: 12, total: 30, totalPages: 3 }
    });
}

describe('PromotionsListing', () => {
    it('reads each page with the same listing seed and shows the place link', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes('/plan-catalog')) return envelope({ vertical: 'tourist', plans: [] });
            const page = Number(new URL(url).searchParams.get('page'));
            return listingPage(page, `Promo página ${page}`);
        });

        render(
            <PromotionsListing
                locale="es"
                apiUrl="https://api.test"
            />
        );
        expect(await screen.findByText('Promo página 1')).toBeInTheDocument();
        expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(await screen.findByText('Promo página 2')).toBeInTheDocument();

        const listingCalls = fetchMock.mock.calls
            .map(([url]) => new URL(url as string))
            .filter((url) => url.pathname.endsWith('/listing'));
        expect(listingCalls.map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
        const seeds = new Set(listingCalls.map((url) => url.searchParams.get('seed')));
        expect(seeds.size).toBe(1);
        expect([...seeds][0]).toBe(sessionStorage.getItem('promos:seed:listing'));
    });

    it('shows the empty state', async () => {
        fetchMock.mockResolvedValue(
            envelope({
                items: [],
                meta: { isVip: true, freeQuota: 3 },
                pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 }
            })
        );
        render(
            <PromotionsListing
                locale="es"
                apiUrl="https://api.test"
            />
        );
        expect(
            await screen.findByText('No hay promociones activas por ahora. Volvé pronto.')
        ).toBeInTheDocument();
    });

    it('shows the error state with a retry', async () => {
        fetchMock.mockResolvedValueOnce(new Response('x', { status: 500 }));
        fetchMock.mockResolvedValueOnce(listingPage(1, 'Recuperada'));
        render(
            <PromotionsListing
                locale="es"
                apiUrl="https://api.test"
            />
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos cargar las promociones.'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByText('Recuperada')).toBeInTheDocument();
    });
});
