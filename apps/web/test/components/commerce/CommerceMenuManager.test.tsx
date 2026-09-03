/**
 * @file CommerceMenuManager.test.tsx
 * @description The gastronomy carta panel (HOS-895).
 *
 * Three things are asserted, and each is a decision that would otherwise be
 * invisible until an owner complained:
 *
 * 1. **The panel loads its own carta.** It is not fed by the SSR listing
 *    payload, so a broken `GET` shows an empty editor and silently discards
 *    what the owner typed on their last visit.
 * 2. **The save sends the WHOLE document, in CENTAVOS.** The owner types pesos
 *    and the column stores centavos; a display that divides without an input
 *    that multiplies multiplies the stored price by 100 on every save (HOS-809,
 *    the bug this repeats the fix for). The assertion is on the BODY, not on
 *    "some call happened" — the exact distinction the FAQ manager's H-89
 *    regression anchor documents.
 * 3. **A 403 is an upsell, not an error.** The structured carta is a
 *    `gastronomy-pro` capability and this page carries no entitlement
 *    information, so the API is what decides. Showing "something went wrong"
 *    for a plan refusal turns an upsell into a bug report.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceMenuManager } from '../../../src/components/commerce/CommerceMenuManager.client';

vi.mock('../../../src/components/commerce/CommerceMenuManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);

const LISTING_ID = '22222222-2222-4222-8222-222222222222';

/** A carta with one course and one dish priced at ARS 2.500 (250 000 centavos). */
const LOADED_MENU = {
    ok: true as const,
    data: {
        sections: [
            {
                name: 'Entradas',
                description: null,
                items: [
                    {
                        name: 'Empanadas',
                        description: 'De carne cortada a cuchillo',
                        priceCents: 250_000,
                        isAvailable: true
                    }
                ]
            }
        ],
        file: null
    }
};

describe('CommerceMenuManager (HOS-895)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads the carta from its own endpoint and shows what is stored', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        expect(mockGet).toHaveBeenCalledWith({
            path: `/api/v1/protected/gastronomies/${LISTING_ID}/menu`
        });
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
        // The owner sees PESOS; the state and the wire carry centavos.
        expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    });

    it('saves the whole document, with the price back in centavos', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockPut.mockResolvedValue({ ok: true, data: LOADED_MENU.data } as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar carta' }));

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledTimes(1);
        });

        // The BODY, not merely "a call happened". A round trip that read pesos
        // and wrote pesos would satisfy any assertion weaker than this one, and
        // would multiply every stored price by 100 on the next save.
        expect(mockPut).toHaveBeenCalledWith({
            path: `/api/v1/protected/gastronomies/${LISTING_ID}/menu`,
            body: {
                sections: [
                    {
                        name: 'Entradas',
                        description: null,
                        items: [
                            {
                                name: 'Empanadas',
                                description: 'De carne cortada a cuchillo',
                                priceCents: 250_000,
                                isAvailable: true
                            }
                        ]
                    }
                ]
            }
        });
    });

    it('shows a plan refusal as the upsell it is, not as a failure', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockPut.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'entitlement required' }
        } as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar carta' }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(/plan Profesional/);
        });

        // And the two ungated fallbacks are still offered — a refused save must
        // not read as "there is no way to show a menu on your plan".
        expect(screen.getByRole('status').textContent?.includes('foto o un PDF')).toBe(true);
    });

    it('shows a genuine failure as a failure, not as an upsell', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockPut.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        } as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar carta' }));

        // The mirror of the case above: without it, a component that showed the
        // upsell for EVERY failure would pass that test.
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('No se pudo guardar la carta.');
        });
    });
});
