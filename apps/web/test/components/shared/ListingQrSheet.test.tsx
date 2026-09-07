/**
 * @file ListingQrSheet.test.tsx
 * @description RTL tests for the listing-QR island (HOS-982 PR 2).
 *
 * The panel talks to TWO routes and the difference matters, so the fetch stub
 * here dispatches by URL rather than answering everything the same way: `…/qr`
 * returns the symbol as JSON on mount, `…/qr-sheet` returns the PDF on click. A
 * stub that answered both identically would let a mix-up between them pass.
 *
 * What is worth asserting, and why each one is behaviour rather than detail:
 *
 * 1. **Both requests carry the session, on all three verticals.** The whole
 *    reason this is an island rather than an `<a download href="{API}/…">` is
 *    that a cross-origin anchor drops the cookie and writes a 401 to the owner's
 *    disk as a `.pdf` (measured in HOS-376). The per-vertical path segment is
 *    asserted in the same breath because a wrong one is a 404 the owner reads as
 *    "my listing is not published".
 * 2. **The code is shown before anything is downloaded.** That is the point of
 *    the endpoint: a button that saves a PDF blind tells nobody what they got.
 * 3. **A failed image never blocks the download.** The picture is what makes the
 *    action understandable, not what makes it work.
 * 4. **"Not published" comes from the caller's state, never from the 404.** The
 *    route answers ONE indistinguishable 404 for three different situations by
 *    design, so the panel MUST NOT be the thing that decides.
 * 5. **Each refusal keeps its own sentence.** A 429 resolves by waiting and a 401
 *    by signing in again; collapsing either into "try again later" sends the
 *    owner to retry something that cannot start working.
 * 6. **The control is operable without a mouse.** It has an accessible name, it
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
        t: (key: string, fallback?: string, params?: Record<string, string>) => {
            const text = fallback ?? key;
            return params
                ? text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => params[name] ?? '')
                : text;
        }
    })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

/** The scan URL the `/qr` route reports, and the markup it renders. */
const SCAN_URL = 'https://hospeda.test/qr/K7Qm2XbT/';
const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>';

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

/** A `Response`-shaped stub carrying the PDF. */
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

/** A `Response`-shaped stub carrying the symbol, in the API's envelope. */
function codeResponse(
    input: { status?: number; svg?: string | undefined; url?: string | undefined } = {}
): Response {
    const status = input.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => ({
            data: {
                svg: 'svg' in input ? input.svg : QR_SVG,
                url: 'url' in input ? input.url : SCAN_URL
            }
        })
    } as unknown as Response;
}

/**
 * Installs a fetch stub that answers each of the two routes separately.
 *
 * The suffix test is `/qr-sheet` FIRST and by `endsWith`, not `includes('/qr')`
 * — the latter matches both URLs and would silently answer the download with
 * JSON.
 */
function stubFetch(
    answers: { code?: Response | Error; sheet?: Response | Error } = {}
): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async (url: string) => {
        const answer = String(url).endsWith('/qr-sheet')
            ? (answers.sheet ?? pdfResponse({ status: 200 }))
            : (answers.code ?? codeResponse());
        if (answer instanceof Error) {
            throw answer;
        }
        return answer;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

/**
 * A fetch stub whose SHEET answer is held open until the returned `release` is
 * called, so the busy state can be observed. The code route answers normally.
 */
function stubFetchWithPendingSheet(): {
    fetchMock: ReturnType<typeof vi.fn>;
    release: (value: Response) => void;
} {
    let resolveSheet: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(async (url: string) => {
        if (String(url).endsWith('/qr-sheet')) {
            return new Promise<Response>((resolve) => {
                resolveSheet = resolve;
            });
        }
        return codeResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, release: (value) => resolveSheet?.(value) };
}

/** The single call to the sheet route, whatever order the two requests ran in. */
function sheetCall(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/qr-sheet'));
    if (!call) {
        throw new Error('the sheet route was never requested');
    }
    return call as [string, RequestInit];
}

/** The single call to the code route. */
function codeCall(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/qr'));
    if (!call) {
        throw new Error('the code route was never requested');
    }
    return call as [string, RequestInit];
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

    describe('the code, before anything is downloaded', () => {
        it.each([
            ['accommodation', 'accommodations'],
            ['gastronomy', 'gastronomies'],
            ['experience', 'experiences']
        ] as const)('asks the %s route for it, with the session', async (vertical, segment) => {
            const fetchMock = stubFetch();

            renderPanel({ vertical });

            await screen.findByTestId('listing-qr-sheet-code');
            const [url, init] = codeCall(fetchMock);
            expect(url).toBe(`https://api.test/api/v1/protected/${segment}/listing-1/qr`);
            expect(init.credentials).toBe('include');
        });

        it('renders it as an inline image with an accessible name', async () => {
            stubFetch();

            renderPanel();

            const image = await screen.findByRole('img', { name: 'Código QR de tu ficha' });
            // `data:` and not a remote src: the CSP allows exactly this, and an
            // SVG loaded as an image cannot execute script.
            expect(image.getAttribute('src')).toBe(
                `data:image/svg+xml;charset=utf-8,${encodeURIComponent(QR_SVG)}`
            );
        });

        it('shows the URL the symbol encodes, so it can be checked by eye', async () => {
            stubFetch();

            renderPanel();

            expect(await screen.findByText(`El código lleva a: ${SCAN_URL}`)).toBeTruthy();
        });

        it('announces that it is loading before the answer arrives', () => {
            const { release } = stubFetchWithPendingSheet();

            renderPanel();

            expect(screen.getByTestId('listing-qr-sheet-code-loading')).toBeTruthy();
            release(pdfResponse({ status: 200 }));
        });

        it('is never asked for on an unpublished listing', () => {
            const fetchMock = stubFetch();

            renderPanel({ isPublished: false });

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('when the code cannot be shown', () => {
        it.each([
            ['the request is refused', { code: codeResponse({ status: 500 }) }],
            ['the request throws', { code: new Error('offline') }],
            ['the answer carries no svg', { code: codeResponse({ svg: undefined }) }],
            ['the answer carries no url', { code: codeResponse({ url: undefined }) }]
        ] as const)('says so quietly and keeps the download working — %s', async (_label, answers) => {
            stubFetch(answers);

            renderPanel();

            expect(await screen.findByTestId('listing-qr-sheet-code-error')).toBeTruthy();
            // The image is an enhancement; the button is the feature.
            expect(downloadButton()).toBeTruthy();
            fireEvent.click(downloadButton());
            await waitFor(() => expect(clickedAnchor).not.toBeNull());
        });
    });

    describe('the download request', () => {
        it.each([
            ['accommodation', 'accommodations'],
            ['gastronomy', 'gastronomies'],
            ['experience', 'experiences']
        ] as const)('asks the %s route with the session cookie', async (vertical, segment) => {
            const fetchMock = stubFetch();

            renderPanel({ vertical });
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            const [url, init] = sheetCall(fetchMock);
            expect(url).toBe(`https://api.test/api/v1/protected/${segment}/listing-1/qr-sheet`);
            // Without this the browser saves the 401 body to the owner's disk.
            expect(init.credentials).toBe('include');
        });

        it('sends the page locale so the sheet prints in the language being read', async () => {
            const fetchMock = stubFetch();

            renderPanel({ locale: 'en' });
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            const [, init] = sheetCall(fetchMock);
            expect((init.headers as Record<string, string>)['X-Client-Locale']).toBe('en');
        });

        it('does NOT send that locale when asking for the code', async () => {
            // The header decides what language the SHEET is printed in. The code
            // response carries no copy at all, and the destination it is minted
            // with is pinned server-side to the market locale — sending the
            // header there would imply a choice that endpoint does not make.
            const fetchMock = stubFetch();

            renderPanel({ locale: 'en' });

            await screen.findByTestId('listing-qr-sheet-code');
            const [, init] = codeCall(fetchMock);
            expect(init.headers).toBeUndefined();
        });

        /*
         * Named for the MECHANISM, not for the intent, after an adversarial
         * review pointed out the difference. The button is `disabled` while
         * busy, so a second `fireEvent.click` on it dispatches nothing at all —
         * which means a test called "ignores a second click" would stay green
         * with the in-handler re-entrancy guard deleted. What is actually
         * assertable from the outside is that the control refuses the second
         * click, and that is what this asserts. The guard inside `handleDownload`
         * is a second line that `disabled` makes unreachable from the UI; it is
         * kept for a caller that renders the button some other way, and nothing
         * here claims to cover it.
         */
        it('disables the button while working, so no second request can start', async () => {
            const { fetchMock, release } = stubFetchWithPendingSheet();

            renderPanel();
            // Held by reference: the SAME node stays mounted while it is busy,
            // but its accessible name becomes "Generando la hoja…", so looking it
            // up again by the idle name would fail before the assertion runs.
            const button = downloadButton();
            fireEvent.click(button);

            expect(button.disabled).toBe(true);
            fireEvent.click(button);

            expect(
                fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/qr-sheet'))
            ).toHaveLength(1);
            release(pdfResponse({ status: 200 }));
            await waitFor(() => expect(clickedAnchor).not.toBeNull());
        });
    });

    describe('the file', () => {
        it('is handed over using the filename the server chose', async () => {
            stubFetch({
                sheet: pdfResponse({
                    status: 200,
                    // Deliberately NOT `qr-${slug}.pdf`: the server re-slugifies
                    // the name it puts in the header (`FILENAME_SAFE` in
                    // `qr-sheet-response.ts`), so the two can legitimately
                    // differ — and if they were spelled the same here, this
                    // test and the fallback one below would assert the same
                    // string and neither could tell the header was ignored.
                    disposition: 'attachment; filename="qr-casa-del-r-o.pdf"'
                })
            });

            renderPanel();
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            expect(clickedAnchor?.download).toBe('qr-casa-del-r-o.pdf');
            expect(clickedAnchor?.href).toBe('blob:fake');
        });

        it('falls back to the slug when the server sent no filename', async () => {
            stubFetch();

            renderPanel();
            fireEvent.click(downloadButton());

            await waitFor(() => expect(clickedAnchor).not.toBeNull());
            expect(clickedAnchor?.download).toBe('qr-casa-del-rio.pdf');
        });

        it('announces the download in a live region once it is done', async () => {
            stubFetch();

            renderPanel();
            fireEvent.click(downloadButton());

            const done = await screen.findByTestId('listing-qr-sheet-ready');
            expect(done.getAttribute('role')).toBe('status');
            expect(done.textContent).toBe('Listo, descargamos tu hoja QR.');
        });
    });

    describe('"your listing is not published"', () => {
        it('comes from the caller, and hides the button entirely', () => {
            const fetchMock = stubFetch();

            renderPanel({ isPublished: false });

            expect(
                screen.getByText('Vas a poder descargar la hoja QR cuando tu ficha esté publicada.')
            ).toBeTruthy();
            expect(screen.queryByRole('button')).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('is NOT what a 404 renders — that one names the race, not the state', async () => {
            stubFetch({ sheet: pdfResponse({ status: 404 }) });

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
            stubFetch({ sheet: pdfResponse({ status }) });

            renderPanel();
            fireEvent.click(downloadButton());

            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toBe(message);
            expect(clickedAnchor).toBeNull();
        });

        it('renders the generic message when the request throws outright', async () => {
            stubFetch({ sheet: new Error('offline') });

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
            stubFetch();
            renderPanel();

            const describedBy = downloadButton().getAttribute('aria-describedby');
            expect(describedBy).toBeTruthy();
            expect(document.getElementById(describedBy as string)?.textContent).toBe(
                'Una hoja A4 con el código de tu ficha, para imprimir y pegar en la puerta o dejar en el mostrador.'
            );
        });

        it('marks itself busy and swaps the label while the sheet is generated', async () => {
            const { release } = stubFetchWithPendingSheet();

            renderPanel();
            fireEvent.click(downloadButton());

            const busy = await screen.findByRole('button', { name: /Generando la hoja/ });
            expect(busy.getAttribute('aria-busy')).toBe('true');

            release(pdfResponse({ status: 200 }));
            await waitFor(() => expect(clickedAnchor).not.toBeNull());
        });

        it('brings focus back to the button when the work ends', async () => {
            const { release } = stubFetchWithPendingSheet();

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

            release(pdfResponse({ status: 200 }));

            await waitFor(() => expect(document.activeElement).toBe(button));
        });
    });
});
