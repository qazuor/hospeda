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
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrochureDownloadButton } from '../../../src/components/commerce/BrochureDownloadButton.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/commerce/CommerceListingActions.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

/** Renders the button for a published gastronomy listing. */
function renderButton() {
    return render(
        <BrochureDownloadButton
            vertical="gastronomy"
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
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.test/api/v1/protected/gastronomies/listing-1/brochure');
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
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        await waitFor(() => expect(clickedAnchor).not.toBeNull());
        expect(clickedAnchor?.download).toBe('ficha-la-parrilla.pdf');
        expect(clickedAnchor?.href).toBe('blob:fake');
    });

    it('falls back to the slug when the server sent no filename', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 200 })));

        renderButton();
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        await waitFor(() => expect(clickedAnchor).not.toBeNull());
        expect(clickedAnchor?.download).toBe('ficha-la-parrilla.pdf');
    });

    it('shows the plan message on a 403 and downloads nothing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 403 })));

        renderButton();
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        expect(
            await screen.findByText(
                'La ficha en PDF está disponible en el plan Premium de tu rubro.'
            )
        ).toBeTruthy();
        expect(clickedAnchor).toBeNull();
    });

    it('shows a retry message on any other failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 500 })));

        renderButton();
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        expect(
            await screen.findByText('No pudimos generar la ficha. Probá de nuevo en un momento.')
        ).toBeTruthy();
        expect(clickedAnchor).toBeNull();
    });

    it('shows a retry message when the request throws outright', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

        renderButton();
        fireEvent.click(screen.getByTestId('commerce-brochure-download'));

        expect(
            await screen.findByText('No pudimos generar la ficha. Probá de nuevo en un momento.')
        ).toBeTruthy();
    });
});
