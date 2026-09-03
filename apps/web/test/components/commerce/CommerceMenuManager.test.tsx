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
                        isAvailable: true,
                        // HOS-1045. Present and null, which is what the API
                        // returns for a dish nobody photographed — NOT absent.
                        // The distinction matters here: this fixture is also
                        // what the 403 tests below save, and a dish carrying a
                        // photo would take them down the PREMIUM upsell branch
                        // instead of the Profesional one they assert.
                        photoUrl: null,
                        photoPublicId: null,
                        photoAlt: null
                    }
                ]
            }
        ],
        file: null
    }
};

const PHOTO_URL = 'https://res.cloudinary.com/demo/empanadas.jpg';

/** The same carta, with the dish photographed (HOS-1045). */
const LOADED_MENU_WITH_PHOTO = {
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
                        isAvailable: true,
                        photoUrl: PHOTO_URL,
                        photoPublicId: 'hospeda/dev/gastronomies/x/empanadas',
                        photoAlt: 'Empanadas recién horneadas'
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
                                isAvailable: true,
                                photoUrl: null,
                                photoPublicId: null,
                                photoAlt: null
                            }
                        ]
                    }
                ]
            }
        });
    });

    // ── The scheme gate (HOS-592 / F-02, via HOS-895) ───────────────────────
    //
    // `menuFileUrl` is not composed only by our upload route: three of the four
    // gastronomy write schemas are `.omit(...)`-based over `GastronomySchema`,
    // so they accepted `javascript:…` from a request body until HOS-895 named
    // the column in their omit lists. `z.string().url()` does not restrict the
    // scheme, so a schema-valid value is still a stored-XSS sink the moment it
    // reaches an `href`. The static guard proves the HELPER IS CALLED; these two
    // prove what it does — which is the half a guard cannot assert.

    it('renders no link at all for a javascript: menu file URL', async () => {
        mockGet.mockResolvedValue({
            ok: true,
            data: {
                sections: [],
                file: { url: 'javascript:alert(document.cookie)', kind: 'image' }
            }
        } as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/No se puede abrir este archivo/)).toBeInTheDocument();
        });

        // No anchor, and specifically no anchor carrying the payload — a
        // `not.toBeVisible()` here would pass on an element that merely renders
        // off-screen while still being clickable.
        expect(screen.queryByRole('link')).toBeNull();
        expect(document.querySelector('a[href^="javascript:"]')).toBeNull();

        // The row is still removable. Dropping the link must not strand the
        // owner with a file they cannot take down.
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    });

    it('renders the link for an ordinary https menu file URL', async () => {
        // The mirror: without it, a component that refused EVERY url would pass
        // the case above.
        mockGet.mockResolvedValue({
            ok: true,
            data: {
                sections: [],
                file: { url: 'https://res.cloudinary.com/demo/menu-file.pdf', kind: 'pdf' }
            }
        } as never);

        render(
            <CommerceMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'Ver el PDF' })).toBeInTheDocument();
        });

        expect(screen.getByRole('link', { name: 'Ver el PDF' })).toHaveAttribute(
            'href',
            'https://res.cloudinary.com/demo/menu-file.pdf'
        );
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

    // ── The photo per dish (HOS-1045) ───────────────────────────────────────
    //
    // The load-bearing property of the whole design: the photo is NOT held in a
    // table keyed by the dish's id — `PUT .../menu` mints a new id for every
    // dish on every save — so it survives only by riding INSIDE the submitted
    // document. A round trip that dropped it would look completely normal in
    // the editor and lose every picture on the owner's next save.

    it('round-trips the dish photo through a save, verbatim', async () => {
        mockGet.mockResolvedValue(LOADED_MENU_WITH_PHOTO as never);
        mockPut.mockResolvedValue({ ok: true, data: LOADED_MENU_WITH_PHOTO.data } as never);

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

        // The WHOLE body, spelled out. Not `expect.objectContaining`, which is
        // blind to a field that stopped being sent — and a silently dropped
        // `photoPublicId` is precisely the failure that would leave a billed
        // Cloudinary asset with nothing able to destroy it.
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
                                isAvailable: true,
                                photoUrl: PHOTO_URL,
                                photoPublicId: 'hospeda/dev/gastronomies/x/empanadas',
                                photoAlt: 'Empanadas recién horneadas'
                            }
                        ]
                    }
                ]
            }
        });
    });

    it('shows the PREMIUM upsell when the refused document carried a photo', async () => {
        // Two entitlements produce the same 403 with the same code, and the
        // payload is what tells them apart. Asserted against its mirror — the
        // `plan Profesional` test above saves a photo-less carta and gets the
        // other message — so a component that showed one message for every 403
        // fails one of the two.
        mockGet.mockResolvedValue(LOADED_MENU_WITH_PHOTO as never);
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
            expect(screen.getByRole('status')).toHaveTextContent(/plan Premium/);
        });

        // And Save stays usable. The way out of this refusal is to remove the
        // photos and save the carta without them, which a disabled button would
        // make impossible — the reason this lock is a separate state from the
        // carta lock, which DOES disable Save.
        expect(screen.getByRole('button', { name: 'Guardar carta' })).toBeEnabled();
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
