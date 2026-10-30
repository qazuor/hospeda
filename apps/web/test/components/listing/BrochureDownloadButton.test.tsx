/**
 * @file BrochureDownloadButton.test.tsx
 * @description RTL tests for the printable-ficha download island (HOS-1058).
 *
 * Three things are worth asserting here and nothing else is:
 *
 * 1. **The request carries the session.** The whole reason this is an island
 *    rather than an `<a download href="{API}/…">` is that a cross-origin anchor
 *    drops the cookie and saves a 401 to disk (measured in HOS-376). So
 *    `credentials: 'include'` is a behavioural requirement, not a detail.
 * 2. **A 403 is an upsell, not a failure.** The sheet is premium; the owner
 *    index has no entitlement data, so the API decides and the refusal must
 *    read as a plan message.
 * 3. **The file is handed over, with the server's filename.**
 * 4. **Below Premium it is an upsell, not a broken button** (owner decision,
 *    2026-10-29): the effective set is read up front, and an owner without
 *    `download_listing_pdf` gets a locked link to the plans page instead.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrochureDownloadButton } from '../../../src/components/listing/BrochureDownloadButton.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/listing/ListingActions.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

// The fresh confirmation read (taken before any BLOCKING answer) mirrors the
// cached read unless a test sets it apart.
const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

import type { EntitlementsData } from '../../../src/lib/entitlements-cache';
import { getEntitlementsCached } from '../../../src/lib/entitlements-cache';

const mockEntitlements = vi.mocked(getEntitlementsCached);

// Unless a test says otherwise, the fresh read answers what the cached one did.
function mirrorFreshRead(): void {
    mockFreshEntitlements.mockImplementation((input: { vertical: string }) =>
        mockEntitlements(input as never)
    );
}

/** A resolved effective set holding exactly `keys`. */
function effectiveSet(keys: readonly string[]): EntitlementsData {
    return {
        entitlements: Object.fromEntries(keys.map((key) => [key, 1])),
        limits: {},
        hasLiveNonTrialTitle: true,
        failed: false
    };
}

/** Renders the button for a published venue listing. */
function renderButton() {
    return render(
        <BrochureDownloadButton
            vertical="venue"
            listingId="listing-1"
            slug="la-parrilla"
            locale="en"
        />
    );
}

/** A `Response`-shaped stub for the fetch mock. */
function pdfResponse(input: { status: number; disposition?: string }): Response {
    return {
        ok: input.status >= 200 && input.status < 300,
        status: input.status,
        headers: {
            get: (name: string) =>
                name === 'content-disposition' ? (input.disposition ?? null) : null
        },
        blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    } as unknown as Response;
}

describe('BrochureDownloadButton (HOS-1058)', () => {
    let clickedAnchor: HTMLAnchorElement | null;

    beforeEach(() => {
        clickedAnchor = null;
        vi.restoreAllMocks();
        mirrorFreshRead();
        // A Premium owner by default: every download test below needs one.
        mockEntitlements.mockResolvedValue(effectiveSet(['download_listing_pdf']));
        // jsdom implements neither of these.
        Object.defineProperty(URL, 'createObjectURL', {
            value: vi.fn(() => 'blob:fake'),
            configurable: true
        });
        Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
        // Intercept the synthetic click so jsdom does not try to navigate.
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            clickedAnchor = this;
        });
    });

    it('fetches the brochure WITH the session cookie and the page locale', async () => {
        const fetchMock = vi.fn().mockResolvedValue(pdfResponse({ status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.test/api/v1/protected/venues/listing-1/brochure');
        // Without this the browser saves a 401 to the owner's disk.
        expect(init.credentials).toBe('include');
        expect((init.headers as Record<string, string>)['X-Client-Locale']).toBe('en');
    });

    it('hands the file over using the filename the server chose', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                pdfResponse({
                    status: 200,
                    disposition: 'attachment; filename="ficha-la-parrilla.pdf"'
                })
            )
        );

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        await waitFor(() => expect(clickedAnchor).not.toBeNull());
        expect(clickedAnchor?.download).toBe('ficha-la-parrilla.pdf');
        expect(clickedAnchor?.href).toBe('blob:fake');
    });

    it('falls back to the slug when the server sent no filename', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 200 })));

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        await waitFor(() => expect(clickedAnchor).not.toBeNull());
        expect(clickedAnchor?.download).toBe('ficha-la-parrilla.pdf');
    });

    it('shows the plan message on a 403 and downloads nothing', async () => {
        // The read failed and fell open, so only the API can say no.
        mockEntitlements.mockResolvedValue({ ...effectiveSet([]), failed: true });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 403 })));

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        expect(
            await screen.findByText(
                'La ficha en PDF está disponible en el plan Premium de tu rubro.'
            )
        ).toBeTruthy();
        expect(clickedAnchor).toBeNull();
        // ...and the action turns into the same upsell link a known lock shows.
        expect(screen.getByTestId('listing-brochure-upsell')).toBeTruthy();
    });

    it('below Premium: a locked link with a Premium badge to the plans page', async () => {
        mockEntitlements.mockResolvedValue(effectiveSet(['manage_venue_menu']));
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        renderButton();

        const link = await screen.findByTestId('listing-brochure-upsell');
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toContain('planes/comer-y-salir/precios');
        expect(link.textContent).toContain('Descargar ficha en PDF');
        expect(link.textContent).toContain('Premium');
        // The reason is announced with the link, not only shown next to it.
        const hint = screen.getByText(
            'La ficha en PDF está disponible en el plan Premium de tu rubro.'
        );
        expect(link.getAttribute('aria-describedby')).toBe(hint.id);
        expect(screen.queryByTestId('listing-brochure-download')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('below Premium on an experience: links to the experience plans', async () => {
        mockEntitlements.mockResolvedValue(effectiveSet([]));

        render(
            <BrochureDownloadButton
                vertical="experience"
                listingId="listing-2"
                slug="kayak"
                locale="es"
            />
        );

        const link = await screen.findByTestId('listing-brochure-upsell');
        expect(link.getAttribute('href')).toContain('planes/experiencias/precios');
        expect(mockEntitlements).toHaveBeenCalledWith({ vertical: 'experience' });
    });

    it('on Premium: stays a normal download button, no lock, no badge', async () => {
        let resolveRead: (value: EntitlementsData) => void = () => {};
        mockEntitlements.mockReturnValue(
            new Promise<EntitlementsData>((resolve) => {
                resolveRead = resolve;
            })
        );

        renderButton();

        // The gate is open by construction until the read resolves, so the
        // assertions below only mean something once it HAS resolved.
        await act(async () => {
            resolveRead(effectiveSet(['download_listing_pdf']));
        });

        expect(mockFreshEntitlements).not.toHaveBeenCalled();
        expect(screen.getByTestId('listing-brochure-download').tagName).toBe('BUTTON');
        expect(screen.queryByTestId('listing-brochure-upsell')).toBeNull();
        expect(screen.queryByText('Premium')).toBeNull();
    });

    it('shows a retry message on any other failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 500 })));

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        expect(
            await screen.findByText('No pudimos generar la ficha. Probá de nuevo en un momento.')
        ).toBeTruthy();
        expect(clickedAnchor).toBeNull();
    });

    it('shows a retry message when the request throws outright', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

        renderButton();
        fireEvent.click(screen.getByTestId('listing-brochure-download'));

        expect(
            await screen.findByText('No pudimos generar la ficha. Probá de nuevo en un momento.')
        ).toBeTruthy();
    });
});
