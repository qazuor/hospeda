/**
 * HOS-2589 §7.6 / AC-21 / AC-30: the detail-page island reads the per-actor
 * endpoint with the cookie and the session seed of the place.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacePromotions } from '../../../src/components/promotions/PlacePromotions.client';
import { resetPromotionReadsForTests } from '../../../src/lib/promotions/visible-promotions-api';
import { envelope, lockedItem, visibleItem } from './promotion-fixtures';

const ENTITY_ID = '33333333-3333-4333-8333-333333333333';
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

describe('PlacePromotions', () => {
    it('reads /visible with credentials and the stored seed, then renders the cards', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url.includes('/plan-catalog')
                ? envelope({ vertical: 'tourist', plans: [], floor: null })
                : envelope({
                      items: [visibleItem(), lockedItem()],
                      meta: { isVip: false, freeQuota: 3 }
                  })
        );

        render(
            <PlacePromotions
                locale="es"
                apiUrl="https://api.test/"
                entityType="accommodation"
                entityId={ENTITY_ID}
            />
        );

        expect(await screen.findByText('Finde largo')).toBeInTheDocument();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const parsed = new URL(url);
        expect(parsed.pathname).toBe('/api/v1/public/owner-promotions/visible');
        expect(parsed.searchParams.get('entityType')).toBe('accommodation');
        expect(parsed.searchParams.get('entityId')).toBe(ENTITY_ID);
        expect(parsed.searchParams.get('seed')).toBe(
            sessionStorage.getItem(`promos:seed:accommodation:${ENTITY_ID}`)
        );
        expect(init.credentials).toBe('include');
        expect(screen.getByRole('heading', { name: 'Promociones' })).toBeInTheDocument();
    });

    it('renders nothing for a place without promotions or on a failed read', async () => {
        fetchMock.mockResolvedValue(envelope({ items: [], meta: { isVip: false, freeQuota: 3 } }));
        const { container } = render(
            <PlacePromotions
                locale="es"
                apiUrl="https://api.test"
                entityType="venue"
                entityId={ENTITY_ID}
            />
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();

        resetPromotionReadsForTests();
        fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
        const failed = render(
            <PlacePromotions
                locale="es"
                apiUrl="https://api.test"
                entityType="venue"
                entityId="44444444-4444-4444-8444-444444444444"
            />
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(failed.container).toBeEmptyDOMElement();
    });
});
