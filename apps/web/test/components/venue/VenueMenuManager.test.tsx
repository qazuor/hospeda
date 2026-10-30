/**
 * @file VenueMenuManager.test.tsx
 * @description The venue carta panel (HOS-895).
 *
 * Three things are asserted, and each is a decision that would otherwise be
 * invisible until an owner complained:
 *
 * 1. **The panel loads its own carta.** It is not fed by the SSR listing
 *    payload, so a broken `GET` shows an empty editor and silently discards
 *    what the owner typed on their last visit.
 * 2. **The save sends the WHOLE document, in CENTAVOS.** The owner types pesos
 *    and the column stores centavos; a display that divides without an input
 *    that multiplies the stored price by 100 on every save (HOS-809,
 *    the bug this repeats the fix for). The assertion is on the BODY, not on
 *    "some call happened" — the exact distinction the FAQ manager's H-89
 *    regression anchor documents.
 * 3. **A 403 is an upsell, not an error.** The structured carta is a
 *    `venue-pro` capability and this page carries no entitlement
 *    information, so the API is what decides. Showing "something went wrong"
 *    for a plan refusal turns an upsell into a bug report.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '../../../src/components/venue/VenueMenuManager.client';

vi.mock('../../../src/components/venue/VenueMenuManager.module.css', () => ({
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

// The fresh confirmation read (taken before any BLOCKING answer) mirrors the
// cached read unless a test sets it apart.
const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

import { apiClient } from '../../../src/lib/api/client';
import type { EntitlementsData } from '../../../src/lib/entitlements-cache';
import { getEntitlementsCached } from '../../../src/lib/entitlements-cache';

const mockEntitlements = vi.mocked(getEntitlementsCached);

// Unless a test says otherwise, the fresh read answers what the cached one did.
function mirrorFreshRead(): void {
    mockFreshEntitlements.mockImplementation((input: { vertical: string }) =>
        mockEntitlements(input as never)
    );
}

/** An effective set holding exactly `keys` (a resolved read, not a failure). */
function effectiveSet(keys: readonly string[]): EntitlementsData {
    return {
        entitlements: Object.fromEntries(keys.map((key) => [key, 1])),
        limits: {},
        hasLiveNonTrialTitle: false,
        failed: false
    };
}

/** What a Profesional owner's read holds for the menu. */
const ENTITLED = effectiveSet(['manage_venue_menu']);

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
                        photoPublicId: 'hospeda/dev/venues/x/empanadas',
                        photoAlt: 'Empanadas recién horneadas'
                    }
                ]
            }
        ],
        file: null
    }
};

describe('VenueMenuManager (HOS-895)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorFreshRead();
        mockEntitlements.mockResolvedValue(ENTITLED);
    });

    it('loads the carta from its own endpoint and shows what is stored', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        expect(mockGet).toHaveBeenCalledWith({
            path: `/api/v1/protected/venues/${LISTING_ID}/menu`
        });
        expect(screen.getByDisplayValue('Empanadas')).toBeInTheDocument();
        // The owner sees PESOS; the state and the wire carry centavos.
        expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    });

    it('saves the whole document, with the price back in centavos', async () => {
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockPut.mockResolvedValue({ ok: true, data: LOADED_MENU.data } as never);

        render(
            <VenueMenuManager
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
            path: `/api/v1/protected/venues/${LISTING_ID}/menu`,
            body: {
                sections: [
                    {
                        name: 'Entradas',
                        description: null,
                        nameI18n: null,
                        descriptionI18n: null,
                        items: [
                            {
                                name: 'Empanadas',
                                description: 'De carne cortada a cuchillo',
                                priceCents: 250_000,
                                isAvailable: true,
                                photoUrl: null,
                                photoPublicId: null,
                                photoAlt: null,
                                nameI18n: null,
                                descriptionI18n: null
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
    // venue write schemas are `.omit(...)`-based over `VenueSchema`,
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
            <VenueMenuManager
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
            <VenueMenuManager
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
        // The read failed and fell open, so only the 403 can tell the panel.
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockPut.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'entitlement required' }
        } as never);

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Entradas')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar carta' }));

        await waitFor(() => {
            expect(screen.getByTestId('venue-menu-plan-notice')).toHaveTextContent(
                /plan Profesional/
            );
        });

        // The photo/PDF upload needs the SAME entitlement, so the notice must not
        // offer it as a way out (the old copy did, and that upload 403'd too).
        expect(screen.queryByText(/Mientras tanto/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Guardar carta' })).toBeDisabled();
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
            <VenueMenuManager
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
            path: `/api/v1/protected/venues/${LISTING_ID}/menu`,
            body: {
                sections: [
                    {
                        name: 'Entradas',
                        description: null,
                        nameI18n: null,
                        descriptionI18n: null,
                        items: [
                            {
                                name: 'Empanadas',
                                description: 'De carne cortada a cuchillo',
                                priceCents: 250_000,
                                isAvailable: true,
                                photoUrl: PHOTO_URL,
                                photoPublicId: 'hospeda/dev/venues/x/empanadas',
                                photoAlt: 'Empanadas recién horneadas',
                                nameI18n: null,
                                descriptionI18n: null
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
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'entitlement required' }
        } as never);

        render(
            <VenueMenuManager
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
            <VenueMenuManager
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

describe('upload control (HOS-1763)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorFreshRead();
        mockGet.mockResolvedValue(LOADED_MENU as never);
        mockEntitlements.mockResolvedValue(ENTITLED);
    });

    it('renders an i18n upload button and no native browser text (TEST:1763:1a)', async () => {
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Subir foto o PDF')).toBeInTheDocument();
        });

        // The label is ours, not the browser's chrome.
        expect(screen.queryByText(/Choose File/i)).toBeNull();
        expect(container.querySelector('input[type="file"]')).not.toBeNull();
    });

    it('shows the chosen file name, and a placeholder before choosing (TEST:1763:1b)', async () => {
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Ningún archivo elegido')).toBeInTheDocument();
        });

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        fireEvent.change(input, {
            target: {
                files: [new File(['x'], 'carta.pdf', { type: 'application/pdf' })]
            }
        });

        expect(await screen.findByText('carta.pdf')).toBeInTheDocument();
    });

    it('hides the input without taking it out of the accessibility tree (TEST:1763:1c)', () => {
        const css = readFileSync(
            resolve(__dirname, '../../../src/components/venue/VenueMenuManager.module.css'),
            'utf8'
        );
        const selector = '.uploadLabel input[type="file"]';
        const start = css.indexOf(selector);
        expect(start).toBeGreaterThanOrEqual(0);

        const block = css.slice(start, css.indexOf('}', start));
        expect(block).toContain('clip: rect(0, 0, 0, 0)');
        // `display: none` would remove it from both the tab order and the
        // accessibility tree, leaving the label as a mouse-only target.
        expect(block).not.toContain('display: none');
    });

    it('clears the file input so the same file can be chosen again (TEST:1763:1d)', async () => {
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Ningún archivo elegido')).toBeInTheDocument();
        });

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        // A real browser keeps the chosen path in `value` and skips `change`
        // when the same file is picked twice, so a failed upload could not be
        // retried. jsdom never fills `value` from `files`, so that browser
        // condition is simulated here with an own accessor (jsdom refuses a
        // non-empty assignment to a file input). Without
        // `event.target.value = ''` the path would survive and the assertion
        // below fails.
        let value = 'C:\\fakepath\\carta.pdf';
        Object.defineProperty(input, 'value', {
            configurable: true,
            get: () => value,
            set: (next: string) => {
                value = next;
            }
        });

        fireEvent.change(input, {
            target: {
                files: [new File(['x'], 'carta.pdf', { type: 'application/pdf' })]
            }
        });

        expect(input.value).toBe('');
        expect(await screen.findByText('carta.pdf')).toBeInTheDocument();
    });
});

// ── Known before the click (owner decision, 2026-10-29) ─────────────────────
//
// Measured on staging: a pre-trial owner's DRAFT venue got 403
// ENTITLEMENT_REQUIRED from `POST .../menu-file` while the copy invited the
// upload. The panel now reads the effective set and disables what would fail.

/** A pre-trial owner: may still activate the trial and holds no title. */
const PRE_TRIAL = effectiveSet(['activate_trial']);

/** A `Response`-shaped stub for the raw multipart upload. */
function uploadResponse(input: { status: number; code?: string }): Response {
    return {
        ok: input.status >= 200 && input.status < 300,
        status: input.status,
        json: async () => (input.code ? { error: { code: input.code, message: 'x' } } : {})
    } as unknown as Response;
}

/** Picks a PDF in the panel's file input. */
function pickPdf(input: HTMLInputElement): void {
    fireEvent.change(input, {
        target: { files: [new File(['x'], 'carta.pdf', { type: 'application/pdf' })] }
    });
}

describe('menu plan gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mirrorFreshRead();
        mockGet.mockResolvedValue(LOADED_MENU as never);
    });

    function renderPanel() {
        return render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
            />
        );
    }

    it('pre-trial owner: upload and Save disabled, with the publish-to-unlock reason', async () => {
        mockEntitlements.mockResolvedValue(PRE_TRIAL);

        const { container } = renderPanel();

        const notice = await screen.findByTestId('venue-menu-plan-notice');
        expect(notice).toHaveTextContent('La carta se habilita cuando publiques tu ficha');
        // No plan link: publishing, not paying, is what unlocks it.
        expect(screen.queryByRole('link', { name: 'Ver planes' })).toBeNull();

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        await waitFor(() => {
            expect(input).toBeDisabled();
        });
        expect(input).toHaveAttribute('aria-describedby', notice.id);
        expect(screen.getByRole('button', { name: 'Guardar carta' })).toBeDisabled();
    });

    it('a PAID owner who never trialed gets the plan reason, never "publish to unlock"', async () => {
        // The pre-trial source is merged whenever no trial row exists, so a
        // paying Básico owner still carries `activate_trial`.
        mockEntitlements.mockResolvedValue({
            ...effectiveSet(['activate_trial']),
            hasLiveNonTrialTitle: true
        });

        renderPanel();

        const notice = await screen.findByTestId('venue-menu-plan-notice');
        expect(notice).toHaveTextContent('está disponible desde el plan Profesional');
        expect(notice).not.toHaveTextContent('cuando publiques');
    });

    it('owner without a trial left: the Profesional reason with a link to the plans', async () => {
        mockEntitlements.mockResolvedValue(effectiveSet([]));

        const { container } = renderPanel();

        const notice = await screen.findByTestId('venue-menu-plan-notice');
        expect(notice).toHaveTextContent('está disponible desde el plan Profesional');
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            expect.stringContaining('planes/comer-y-salir/precios')
        );
        expect(container.querySelector('input[type="file"]')).toBeDisabled();
    });

    it('a 403 ENTITLEMENT_REQUIRED on the upload lands in the notice', async () => {
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(uploadResponse({ status: 403, code: 'ENTITLEMENT_REQUIRED' }));

        const { container } = renderPanel();
        await screen.findByText('Ningún archivo elegido');

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        pickPdf(input);

        expect(await screen.findByTestId('venue-menu-plan-notice')).toHaveTextContent(
            /plan Profesional/
        );
        expect(screen.queryByText('No se pudo subir el archivo del menú.')).toBeNull();
        expect(input).toBeDisabled();
        fetchMock.mockRestore();
    });

    it('a 403 with another code on the upload is the ordinary, retryable error', async () => {
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(uploadResponse({ status: 403, code: 'EMAIL_NOT_VERIFIED' }));

        const { container } = renderPanel();
        await screen.findByText('Ningún archivo elegido');

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        pickPdf(input);

        expect(await screen.findByText('No se pudo subir el archivo del menú.')).toBeTruthy();
        expect(screen.queryByTestId('venue-menu-plan-notice')).toBeNull();
        // Not latched: the owner can retry.
        expect(input).toBeEnabled();
        fetchMock.mockRestore();
    });

    it('a 403 with another code on Save is the ordinary error and does not lock', async () => {
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        mockPut.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'EMAIL_NOT_VERIFIED', message: 'verify your email' }
        } as never);

        renderPanel();
        await screen.findByDisplayValue('Entradas');

        fireEvent.click(screen.getByRole('button', { name: 'Guardar carta' }));

        expect(await screen.findByText('No se pudo guardar la carta.')).toBeTruthy();
        expect(screen.queryByTestId('venue-menu-plan-notice')).toBeNull();
        expect(screen.getByRole('button', { name: 'Guardar carta' })).toBeEnabled();
    });

    it('«Eliminar» is disabled while the menu is gated', async () => {
        mockGet.mockResolvedValue({
            ok: true,
            data: {
                ...LOADED_MENU.data,
                file: { url: 'https://res.cloudinary.com/demo/menu.pdf', kind: 'pdf' }
            }
        } as never);
        mockEntitlements.mockResolvedValue(effectiveSet([]));

        renderPanel();

        const notice = await screen.findByTestId('venue-menu-plan-notice');
        const remove = screen.getByRole('button', { name: 'Eliminar' });
        expect(remove).toBeDisabled();
        expect(remove).toHaveAttribute('aria-describedby', notice.id);
    });

    it('a 403 ENTITLEMENT_REQUIRED on «Eliminar» lands in the notice', async () => {
        const mockDelete = vi.mocked(apiClient.delete);
        mockGet.mockResolvedValue({
            ok: true,
            data: {
                ...LOADED_MENU.data,
                file: { url: 'https://res.cloudinary.com/demo/menu.pdf', kind: 'pdf' }
            }
        } as never);
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        mockDelete.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' }
        } as never);

        renderPanel();
        fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

        expect(await screen.findByTestId('venue-menu-plan-notice')).toHaveTextContent(
            /plan Profesional/
        );
        expect(screen.queryByText('No se pudo eliminar el archivo del menú.')).toBeNull();
    });

    it('a stale cached block loses to a fresh read that grants the entitlement', async () => {
        mockEntitlements.mockResolvedValue(effectiveSet([]));
        mockFreshEntitlements.mockResolvedValue(ENTITLED);

        const { container } = renderPanel();
        await screen.findByDisplayValue('Entradas');

        await waitFor(() => {
            expect(mockFreshEntitlements).toHaveBeenCalledWith({ vertical: 'venue' });
        });
        await act(async () => {});

        expect(screen.queryByTestId('venue-menu-plan-notice')).toBeNull();
        expect(container.querySelector('input[type="file"]')).toBeEnabled();
    });

    it('entitled owner: no notice, upload and Save enabled (unchanged)', async () => {
        let resolveRead: (value: EntitlementsData) => void = () => {};
        mockEntitlements.mockReturnValue(
            new Promise<EntitlementsData>((resolve) => {
                resolveRead = resolve;
            })
        );

        const { container } = renderPanel();
        await screen.findByDisplayValue('Entradas');

        // Only once the read has RESOLVED does an assertion about the gate mean
        // anything: before it, the gate is open by construction.
        await act(async () => {
            resolveRead(ENTITLED);
        });

        expect(mockFreshEntitlements).not.toHaveBeenCalled();
        expect(screen.queryByTestId('venue-menu-plan-notice')).toBeNull();
        expect(container.querySelector('input[type="file"]')).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Guardar carta' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Agregar sección' })).toBeEnabled();
    });
});
