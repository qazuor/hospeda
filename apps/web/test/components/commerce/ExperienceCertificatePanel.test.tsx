/**
 * @file ExperienceCertificatePanel.test.tsx
 * @description RTL tests for the certificate panel island (HOS-1057).
 *
 * Four things are worth asserting here and nothing else is:
 *
 * 1. **Every request carries the session.** The reason the download is a fetch
 *    rather than an `<a download href="{API}/…">` is that a cross-origin anchor
 *    drops the cookie and saves a 401 to disk (measured in HOS-376). So
 *    `credentials: 'include'` is a behavioural requirement, not a detail.
 * 2. **A 403 is an upsell, and it renders NO FORM.** The panel is paid; showing
 *    an owner on the entry plan a form whose submit could only ever refuse is
 *    worse than showing them the plan sentence. The absence of the submit button
 *    is the load-bearing half — a test that only checks the message would pass on
 *    a panel that renders both.
 * 3. **The issued list comes back after a successful issue**, so the provider
 *    sees what they just created rather than an empty panel.
 * 4. **The file is handed over with the server's filename.**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceCertificatePanel } from '../../../src/components/commerce/ExperienceCertificatePanel.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/commerce/ExperienceCertificatePanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

const LISTING_ID = 'listing-1';
const CERTIFICATE_ID = 'cert-1';
const LIST_URL = `https://api.test/api/v1/protected/experiences/${LISTING_ID}/certificates`;

/** A JSON `Response`-shaped stub for the fetch mock. */
function jsonResponse(input: { status: number; body?: unknown }): Response {
    return {
        ok: input.status >= 200 && input.status < 300,
        status: input.status,
        headers: { get: () => null },
        json: async () => input.body ?? {}
    } as unknown as Response;
}

/** A PDF `Response`-shaped stub for the fetch mock. */
function pdfResponse(input: { status: number; disposition?: string }): Response {
    return {
        ok: input.status >= 200 && input.status < 300,
        status: input.status,
        headers: {
            get: (name: string) =>
                name === 'content-disposition' ? (input.disposition ?? null) : null
        },
        blob: async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    } as unknown as Response;
}

/** One issued certificate, as the API returns it. */
const ISSUED = {
    id: CERTIFICATE_ID,
    experienceId: LISTING_ID,
    recipientName: 'Ana Perez',
    completedAt: '2026-03-14',
    issuedAt: '2026-03-15T12:00:00.000Z'
};

function renderPanel() {
    return render(
        <ExperienceCertificatePanel
            listingId={LISTING_ID}
            locale="en"
        />
    );
}

describe('ExperienceCertificatePanel (HOS-1057)', () => {
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

    it('loads the issued list with the session cookie', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(jsonResponse({ status: 200, body: { certificates: [ISSUED] } }));
        vi.stubGlobal('fetch', fetchMock);

        renderPanel();

        await waitFor(() => expect(screen.getByText('Ana Perez')).toBeTruthy());
        expect(fetchMock).toHaveBeenCalledWith(
            LIST_URL,
            expect.objectContaining({ credentials: 'include' })
        );
    });

    it('renders the plan sentence and NO form when the API refuses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 403 })));

        renderPanel();

        await waitFor(() =>
            expect(
                screen.getByText(
                    'Los certificados están disponibles desde el plan Profesional de Experiencias.'
                )
            ).toBeTruthy()
        );
        // The load-bearing half: an owner who cannot issue is not shown a form.
        expect(screen.queryByTestId('experience-certificate-submit')).toBeNull();
    });

    it('issues, then reloads the list so the new row is visible', async () => {
        const fetchMock = vi
            .fn()
            // 1. the initial list — empty
            .mockResolvedValueOnce(jsonResponse({ status: 200, body: { certificates: [] } }))
            // 2. the POST
            .mockResolvedValueOnce(jsonResponse({ status: 201, body: { certificate: ISSUED } }))
            // 3. the reload
            .mockResolvedValueOnce(jsonResponse({ status: 200, body: { certificates: [ISSUED] } }));
        vi.stubGlobal('fetch', fetchMock);

        renderPanel();

        await waitFor(() =>
            expect(screen.getByTestId('experience-certificate-submit')).toBeTruthy()
        );

        fireEvent.change(screen.getByLabelText(/Nombre de quien la hizo/), {
            target: { value: 'Ana Perez' }
        });
        fireEvent.change(screen.getByLabelText(/Día en que la hizo/), {
            target: { value: '2026-03-14' }
        });
        fireEvent.click(screen.getByTestId('experience-certificate-submit'));

        await waitFor(() => expect(screen.getByText('Ana Perez')).toBeTruthy());

        const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
        expect(post).toBeDefined();
        expect(post?.[1]).toEqual(
            expect.objectContaining({
                credentials: 'include',
                body: JSON.stringify({ recipientName: 'Ana Perez', completedAt: '2026-03-14' })
            })
        );
    });

    it('hands the PDF over with the filename the server chose', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ status: 200, body: { certificates: [ISSUED] } }))
            .mockResolvedValueOnce(
                pdfResponse({
                    status: 200,
                    disposition: 'attachment; filename="certificado-ana-perez.pdf"'
                })
            );
        vi.stubGlobal('fetch', fetchMock);

        renderPanel();

        await waitFor(() =>
            expect(
                screen.getByTestId(`experience-certificate-download-${CERTIFICATE_ID}`)
            ).toBeTruthy()
        );
        fireEvent.click(screen.getByTestId(`experience-certificate-download-${CERTIFICATE_ID}`));

        await waitFor(() => expect(clickedAnchor).not.toBeNull());
        expect(clickedAnchor?.download).toBe('certificado-ana-perez.pdf');
        expect(fetchMock).toHaveBeenLastCalledWith(
            `${LIST_URL}/${CERTIFICATE_ID}/pdf`,
            expect.objectContaining({ credentials: 'include' })
        );
    });

    it('shows a retry message when the download fails', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ status: 200, body: { certificates: [ISSUED] } }))
            .mockResolvedValueOnce(pdfResponse({ status: 500 }));
        vi.stubGlobal('fetch', fetchMock);

        renderPanel();

        await waitFor(() =>
            expect(
                screen.getByTestId(`experience-certificate-download-${CERTIFICATE_ID}`)
            ).toBeTruthy()
        );
        fireEvent.click(screen.getByTestId(`experience-certificate-download-${CERTIFICATE_ID}`));

        await waitFor(() =>
            expect(
                screen.getByText('No pudimos generar el certificado. Probá de nuevo en un momento.')
            ).toBeTruthy()
        );
        expect(clickedAnchor).toBeNull();
    });
});
