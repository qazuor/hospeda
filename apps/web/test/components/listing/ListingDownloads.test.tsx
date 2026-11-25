import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingDownloads } from '../../../src/components/listing/ListingDownloads.client';

const { gate } = vi.hoisted(() => ({ gate: { value: 'open' } }));
vi.mock('../../../src/hooks/useListingPlanGate', () => ({
    useListingPlanGate: () => ({ gate: gate.value })
}));
vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test',
    isLoggingEnabled: () => false
}));

function renderDownloads(vertical: 'venue' | 'experience' = 'venue') {
    return render(
        <ListingDownloads
            vertical={vertical}
            listingId="listing-1"
            slug="listing"
            name="Test listing"
            locale="en"
            isPublished
        />
    );
}

function openMenu() {
    const trigger = screen.getByRole('button', { name: 'Download files for Test listing' });
    fireEvent.click(trigger);
    return trigger;
}

describe('ListingDownloads — D14', () => {
    beforeEach(() => {
        gate.value = 'open';
        vi.stubGlobal('fetch', vi.fn());
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:pdf')
        });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    it('offers both PDFs in one menu without fetching or showing an inline QR', () => {
        renderDownloads();
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getAllByRole('button')).toHaveLength(1);
        openMenu();
        expect(screen.getByRole('menuitem', { name: 'Download PDF sheet' })).toBeInTheDocument();
        expect(
            screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' })
        ).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'View QR code' })).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
        'venue',
        'experience'
    ] as const)('downloads both %s PDFs with credentials, locale and server filenames', async (vertical) => {
        const names: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            names.push(this.download);
        });
        vi.mocked(fetch).mockImplementation(
            async (url) =>
                new Response('%PDF', {
                    headers: {
                        'content-disposition': `attachment; filename="${String(url).endsWith('/brochure') ? 'brochure' : 'qr'}.pdf"`
                    }
                })
        );
        renderDownloads(vertical);
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download PDF sheet' }));
        await waitFor(() => expect(names).toEqual(['brochure.pdf']));
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' }));
        await waitFor(() => expect(names).toEqual(['brochure.pdf', 'qr.pdf']));
        const segment = vertical === 'venue' ? 'venues' : 'experiences';
        expect(fetch).toHaveBeenNthCalledWith(
            1,
            `https://api.test/api/v1/protected/${segment}/listing-1/brochure`,
            {
                credentials: 'include',
                headers: { 'X-Client-Locale': 'en' }
            }
        );
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            `https://api.test/api/v1/protected/${segment}/listing-1/qr-sheet`,
            {
                credentials: 'include',
                headers: { 'X-Client-Locale': 'en' }
            }
        );
    });

    it('opens the QR in a kit dialog on keyboard selection and restores focus on Escape', async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: {
                        svg: '<svg xmlns="http://www.w3.org/2000/svg" />',
                        url: 'https://hospeda.test/qr/test/'
                    }
                }),
                { headers: { 'content-type': 'application/json' } }
            )
        );
        renderDownloads();
        const trigger = openMenu();
        const menu = screen.getByRole('menu');
        fireEvent.keyDown(menu, { key: 'End' });
        const view = screen.getByRole('menuitem', { name: 'View QR code' });
        expect(view).toHaveFocus();
        fireEvent.click(view);
        expect(
            await screen.findByRole('dialog', { name: 'QR code: Test listing' })
        ).toBeInTheDocument();
        expect(await screen.findByTestId('listing-qr-sheet-code')).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            'https://api.test/api/v1/protected/venues/listing-1/qr',
            { credentials: 'include' }
        );
        expect(screen.queryByTestId('listing-qr-sheet-download')).toBeNull();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('keeps the free QR sheet actionable when the brochure is locked', () => {
        gate.value = 'locked';
        renderDownloads();
        openMenu();
        expect(
            screen.getByRole('menuitem', { name: /Download PDF sheet.*Premium/ })
        ).toHaveAttribute('href', '/en/planes/comer-y-salir/precios/');
        expect(
            screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' })
        ).not.toHaveAttribute('aria-disabled');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('turns a brochure API refusal into a plan link while retaining the QR download', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
        renderDownloads();
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download PDF sheet' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        openMenu();
        expect(
            await screen.findByRole('menuitem', { name: /Download PDF sheet.*Premium/ })
        ).toHaveAttribute('href', '/en/planes/comer-y-salir/precios/');
        expect(
            screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' })
        ).not.toHaveAttribute('aria-disabled');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('prevents another QR-sheet request while a download is pending', () => {
        vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
        renderDownloads();
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' }));
        openMenu();
        const pending = screen.getByRole('menuitem', { name: 'Generating the sheet…' });
        expect(pending).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(pending);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['es', 'Descargar', 'Ver código QR'],
        ['en', 'Download', 'View QR code'],
        ['pt', 'Baixar', 'Ver código QR']
    ] as const)('translates the compact actions in %s', (locale, label, qrLabel) => {
        render(
            <ListingDownloads
                vertical="venue"
                listingId="listing-1"
                slug="listing"
                name="Test"
                locale={locale}
                isPublished
            />
        );
        fireEvent.click(screen.getByText(label));
        expect(screen.getByRole('menuitem', { name: qrLabel })).toBeInTheDocument();
    });

    it.each([
        [401, 'Your session expired. Sign in again to download the sheet.'],
        [404, "We couldn't generate the sheet. Check that your listing is still published."],
        [429, 'You asked for the sheet several times in a row. Wait a minute and try again.']
    ] as const)('announces the QR-sheet refusal (%s) outside the closed menu', async (status, message) => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
        renderDownloads();
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download the QR sheet (PDF)' }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(message);
        expect(screen.queryByRole('menu')).toBeNull();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
