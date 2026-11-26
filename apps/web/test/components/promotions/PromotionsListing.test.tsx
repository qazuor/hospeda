/**
 * HOS-2589 D-2 / AC-31: the `/promociones/` island paginates with one session seed.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsListing } from '../../../src/components/promotions/PromotionsListing.client';
import { resetPromotionReadsForTests } from '../../../src/lib/promotions/visible-promotions-api';
import { envelope, lockedItem, visibleItem } from './promotion-fixtures';

const fetchMock = vi.fn();
const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock('@/lib/auth-client', () => ({
    useSession: () => ({ data: auth.signedIn ? { user: {} } : null, isPending: false })
}));
vi.mock('@/components/promotions/use-promotion-policy', () => ({
    useVipPlanName: ({ enabled }: { enabled: boolean }) => ({
        vipPlanName: enabled ? 'Explorer' : null
    })
}));

beforeEach(() => {
    auth.signedIn = true;
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

    it('shows zero visible promotions and account CTAs to a guest', async () => {
        auth.signedIn = false;
        fetchMock.mockResolvedValue(
            envelope({
                items: [lockedItem(), lockedItem({ key: 'k2', audience: 'plus' })],
                meta: { isVip: false, freeQuota: 0 },
                pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 }
            })
        );

        render(
            <PromotionsListing
                locale="es"
                apiUrl="https://api.test"
            />
        );

        expect(await screen.findByText('Ves 0 de 2 promociones')).toBeVisible();
        expect(
            screen.getByText('Creá tu cuenta gratis o iniciá sesión para ver promociones')
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute(
            'href',
            '/es/auth/signup/?returnUrl=%2Fes%2Fpromociones%2F'
        );
        expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toHaveLength(3);
        const cards = screen.getAllByRole('article');
        expect(cards).toHaveLength(2);
        for (const card of cards) {
            expect(within(card).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
                'href',
                expect.stringContaining('/auth/signin/')
            );
        }
        expect(screen.queryByRole('link', { name: 'Ver alojamiento' })).not.toBeInTheDocument();
    });

    it('lets VIP readers toggle between all offers and plan exclusives', async () => {
        fetchMock.mockResolvedValue(
            envelope({
                items: [
                    visibleItem(),
                    visibleItem({
                        id: '33333333-3333-4333-8333-333333333333',
                        audience: 'vip',
                        title: 'Escapada exclusiva'
                    })
                ],
                meta: { isVip: true, freeQuota: 0 },
                pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 }
            })
        );
        render(
            <PromotionsListing
                locale="es"
                apiUrl="https://api.test"
            />
        );
        const filter = await screen.findByRole('checkbox', {
            name: 'Solo exclusivas del plan Explorer'
        });
        expect(screen.getByText('Tenés acceso a las 2 promociones')).toBeVisible();
        expect(screen.getAllByRole('article')).toHaveLength(2);

        fireEvent.click(filter);

        expect(screen.queryByRole('heading', { name: 'Finde largo' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Escapada exclusiva' })).toBeVisible();

        fireEvent.click(filter);
        expect(screen.getAllByRole('article')).toHaveLength(2);
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
