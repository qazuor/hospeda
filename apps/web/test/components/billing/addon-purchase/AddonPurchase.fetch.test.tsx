import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const productId = '123e4567-e89b-42d3-a456-426614174001';
const listingId = '123e4567-e89b-42d3-a456-426614174003';
const success = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data })
});

afterEach(() => vi.unstubAllGlobals());

describe('AC:B10:11 browser API composition', () => {
    it('fetches owner offers and vertical publication state before the summary', async () => {
        const fetchMock = vi.fn(async (url: string) => {
            if (url.includes('/billing/addons/offers'))
                return success({
                    items: [
                        {
                            productId,
                            addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
                            name: 'Destaque',
                            description: null,
                            chargeKind: 'PERIODICO',
                            cycle: 'monthly',
                            price: 1200,
                            currency: 'ARS',
                            compatibleVerticals: ['accommodation'],
                            scopeType: 'LISTING',
                            validity: 'WHILE_SUBSCRIPTION_ALIVE',
                            validityDays: null,
                            freeUnderGrantVerticals: []
                        }
                    ]
                });
            if (url.includes('/billing/addons/instances')) return success({ items: [] });
            if (url.includes('/publish/listing-notices/accommodation'))
                return success({
                    trialRunning: false,
                    items: [
                        {
                            listingId,
                            publicationStatus: 'ARCHIVED',
                            recurringListingAddons: 0,
                            notices: []
                        }
                    ]
                });
            throw new Error(`Unexpected API route: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('crypto', { randomUUID: () => '123e4567-e89b-42d3-a456-426614174004' });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        fireEvent.click(await screen.findByTestId(`addon-target-${listingId}`));
        expect(
            screen.getByTestId('addon-hidden-listing-notice').getAttribute('data-notice-kind')
        ).toBe('RECURRING');
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname).sort()).toEqual([
            '/api/v1/protected/billing/addons/instances',
            '/api/v1/protected/billing/addons/offers',
            '/api/v1/protected/publish/listing-notices/accommodation'
        ]);
    });
});

describe('HOS-2312 server errors', () => {
    it.each([
        [500, 'An unexpected error occurred', true],
        [503, 'An error occurred', true],
        [409, 'Specific business message', false]
    ])('on %i the offers error shows %s only for 4xx', async (status, message, masked) => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: false,
                status,
                json: async () => ({ success: false, error: { code: 'X', message } })
            }))
        );
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        if (masked) {
            expect(await screen.findByText('No pudimos cargar los complementos.')).toBeTruthy();
            expect(screen.queryByText(message)).toBeNull();
        } else {
            expect(await screen.findByText(message)).toBeTruthy();
        }
    });
});
