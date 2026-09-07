/**
 * @file ListingQrSheet.test.tsx
 * @description RTL tests for the printable QR sheet download island (HOS-982 PR 2).
 *
 * What is worth asserting here, and why each one is behaviour rather than detail:
 *
 * 1. **The request carries the session, on all three verticals.** The whole
 *    reason this is an island rather than an `<a download href="{API}/…">` is
 *    that a cross-origin anchor drops the cookie and writes a 401 to the owner's
 *    disk as a `.pdf` (measured in HOS-376). The per-vertical path segment is
 *    asserted in the same breath because a wrong one is a 404 the owner reads as
 *    "my listing is not published".
 * 2. **"Not published" comes from the caller's state, never from the 404.** The
 *    route answers ONE indistinguishable 404 for three different situations by
 *    design, so the panel MUST NOT be the thing that decides.
 * 3. **Each refusal keeps its own sentence.** A 429 resolves by waiting and a 401
 *    by signing in again; collapsing either into "try again later" sends the
 *    owner to retry something that cannot start working.
 * 4. **The control is operable without a mouse.** It has an accessible name, it
 *    is described by the explanatory line, and focus comes BACK to it when the
 *    work ends — `LoadingButton` disables itself while busy, and a disabled
 *    element loses focus.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingQrSheet } from '../../../src/components/shared/qr/ListingQrSheet.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

/** The download control, found the way a screen-reader user would name it. */
function downloadButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: /Descargar la hoja QR/ }) as HTMLButtonElement;
}

/** Renders the panel for a published listing of the given vertical. */
function renderPanel(
    overrides: Partial<ComponentProps<typeof ListingQrSheet>> = {}
): ReturnType<typeof render> {
    return render(
        <ListingQrSheet
            vertical="accommodation"
            listingId="listing-1"
            slug="casa-del-rio"
            locale="es"
            isPublished={true}
            {...overrides}
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

describe('ListingQrSheet (HOS-982)', () => {
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

    describe('the request', () => {
        it.each([
            ['accommodation', 'accommodations'],
            ['gastronomy', 'gastronomies'],
            ['experience', 'experiences']
        ] as const)('asks the %s route with the session cookie', async (vertical, segment) => {
            const fetchMock = vi.fn().mockResolvedValue(pdfResponse({ status: 200 }));
            vi.stubGlobal('fetch', fetchMock);

            renderPanel({ vertical });
            fireEvent.click(downloadButton());

            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(`https://api.test/api/v1/protected/${segment}/listing-1/qr-sheet`);
            // Without this the browser saves the 401 body to the owner's disk.
            expect(init.credentials).toBe('include');
        });

        it('sends the page locale so the sheet prints in the language being read', async () => {
            const fetchMock = vi.fn().mockResolvedValue(pdfResponse({ status: 200 }));
            vi.stubGlobal('fetch', fetchMock);

            renderPanel({ locale: 'en' });
            fireEvent.click(downloadButton());

            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>)['X-Client-Locale']).toBe('en');
        });

        it('ignores a second click while the first is still running', async () => {
            let release: ((value: Response) => void) | undefined;
            const fetchMock = vi.fn().mockReturnValue(
                new Promise<Response>((resolve) => {
                    release = resolve;
                })
            );
            vi.stubGlobal('fetch', fetchMock);

            renderPanel();
            // Held by reference: the SAME node stays mounted while it is busy,
            // but its accessible name becomes "Generando la hoja…", so looking it
            // up again by the idle name would fail before the assertion runs.
            const button = downloadButton();
            fireEvent.click(button);
            fireEvent.click(button);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            release?.(pdfResponse({ status: 200 }));
            await waitFor(() => expect(clickedAnchor).not.toBeNull());
        });
    });

    describe('the file', () => {
        it('is handed over using the filename the server chose', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    pdfResponse({
                        status: 200,
                        // Deliberately NOT `qr-${slug}.pdf`: the server re-slugifies
                        // the name it puts in the header (`FILENAME_SAFE` in
                        // `qr-sheet-response.ts`), so the two can legitimately
                        // differ — and if they were spelled the same here, this
                        // test and the fallback one below would assert the same
                        // string and neither could tell the header was ignored.
                        disposition: 'attachment; filename="qr-casa-del-r-o.pdf"'
                    })
                )
            );

            renderPanel();
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            expect(clickedAnchor?.download).toBe('qr-casa-del-r-o.pdf');
            expect(clickedAnchor?.href).toBe('blob:fake');
        });

        it('falls back to the slug when the server sent no filename', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 200 })));

            renderPanel();
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            expect(clickedAnchor?.download).toBe('qr-casa-del-rio.pdf');
        });

        it('announces the download in a live region once it is done', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 200 })));

            renderPanel();
            fireEvent.click(downloadButton());

            const status = await screen.findByRole('status');
            expect(status.textContent).toBe('Listo, descargamos tu hoja QR.');
        });
    });

    describe('"your listing is not published"', () => {
        it('comes from the caller, and hides the button entirely', () => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            renderPanel({ isPublished: false });

            expect(
                screen.getByText('Vas a poder descargar la hoja QR cuando tu ficha esté publicada.')
            ).toBeTruthy();
            expect(screen.queryByRole('button')).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('is NOT what a 404 renders — that one names the race, not the state', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status: 404 })));

            renderPanel();
            fireEvent.click(downloadButton());

            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toBe(
                'No pudimos generar la hoja. Revisá que tu ficha siga publicada.'
            );
            expect(
                screen.queryByText(
                    'Vas a poder descargar la hoja QR cuando tu ficha esté publicada.'
                )
            ).toBeNull();
            expect(clickedAnchor).toBeNull();
        });
    });

    describe('refusals keep their own sentence', () => {
        it.each([
            [429, 'Pediste la hoja varias veces seguidas. Esperá un minuto y probá de nuevo.'],
            [401, 'Se cerró tu sesión. Volvé a entrar para descargar la hoja.'],
            [500, 'No pudimos generar la hoja. Probá de nuevo en un momento.']
        ] as const)('renders the %s message', async (status, message) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse({ status })));

            renderPanel();
            fireEvent.click(downloadButton());

            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toBe(message);
            expect(clickedAnchor).toBeNull();
        });

        it('renders the generic message when the request throws outright', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

            renderPanel();
            fireEvent.click(downloadButton());

            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toBe(
                'No pudimos generar la hoja. Probá de nuevo en un momento.'
            );
        });
    });

    describe('accessibility', () => {
        it('describes the button with the line explaining what the sheet is', () => {
            vi.stubGlobal('fetch', vi.fn());
            renderPanel();

            const describedBy = downloadButton().getAttribute('aria-describedby');
            expect(describedBy).toBeTruthy();
            expect(document.getElementById(describedBy as string)?.textContent).toBe(
                'Una hoja A4 con el código de tu ficha, para imprimir y pegar en la puerta o dejar en el mostrador.'
            );
        });

        it('marks itself busy and swaps the label while the sheet is generated', async () => {
            let release: ((value: Response) => void) | undefined;
            vi.stubGlobal(
                'fetch',
                vi.fn().mockReturnValue(
                    new Promise<Response>((resolve) => {
                        release = resolve;
                    })
                )
            );

            renderPanel();
            fireEvent.click(downloadButton());

            const busy = await screen.findByRole('button', { name: /Generando la hoja/ });
            expect(busy.getAttribute('aria-busy')).toBe('true');

            release?.(pdfResponse({ status: 200 }));
            await waitFor(() => expect(clickedAnchor).not.toBeNull());
        });

        it('brings focus back to the button when the work ends', async () => {
            let release: ((value: Response) => void) | undefined;
            vi.stubGlobal(
                'fetch',
                vi.fn().mockReturnValue(
                    new Promise<Response>((resolve) => {
                        release = resolve;
                    })
                )
            );

            renderPanel();
            const button = downloadButton();
            button.focus();
            fireEvent.click(button);

            // What the browser does to a control that becomes `disabled`: focus
            // leaves it. jsdom does NOT — it keeps the disabled button focused —
            // so the loss is reproduced explicitly here. Without this the
            // assertion below would pass with the restore removed, which is the
            // whole thing being tested.
            const elsewhere = document.createElement('input');
            document.body.appendChild(elsewhere);
            elsewhere.focus();
            expect(document.activeElement).toBe(elsewhere);

            release?.(pdfResponse({ status: 200 }));

            await waitFor(() => expect(document.activeElement).toBe(button));
        });
    });
});
