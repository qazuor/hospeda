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

    it('offers the brochure only — the QR moved to its own page (HOS-2688)', () => {
        renderDownloads();
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        openMenu();
        const items = screen.getAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual(['Download PDF sheet']);
        expect(screen.queryByRole('menuitem', { name: /QR/ })).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
        'venue',
        'experience'
    ] as const)('downloads the %s brochure with credentials, locale and server filename', async (vertical) => {
        const names: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            names.push(this.download);
        });
        vi.mocked(fetch).mockResolvedValue(
            new Response('%PDF', {
                headers: { 'content-disposition': 'attachment; filename="brochure.pdf"' }
            })
        );
        renderDownloads(vertical);
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download PDF sheet' }));
        await waitFor(() => expect(names).toEqual(['brochure.pdf']));
        const segment = vertical === 'venue' ? 'venues' : 'experiences';
        expect(fetch).toHaveBeenCalledWith(
            `https://api.test/api/v1/protected/${segment}/listing-1/brochure`,
            {
                credentials: 'include',
                headers: { 'X-Client-Locale': 'en' }
            }
        );
    });

    it('links a locked brochure to the plans page', () => {
        gate.value = 'locked';
        renderDownloads();
        openMenu();
        expect(
            screen.getByRole('menuitem', { name: /Download PDF sheet.*Premium/ })
        ).toHaveAttribute('href', '/en/planes/comer-y-salir/precios/');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('turns a brochure API refusal into a plan link', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
        renderDownloads();
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download PDF sheet' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        openMenu();
        expect(
            await screen.findByRole('menuitem', { name: /Download PDF sheet.*Premium/ })
        ).toHaveAttribute('href', '/en/planes/comer-y-salir/precios/');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it.each([
        ['es', 'Descargar'],
        ['en', 'Download'],
        ['pt', 'Baixar']
    ] as const)('translates the trigger in %s', (locale, label) => {
        render(
            <ListingDownloads
                vertical="venue"
                listingId="listing-1"
                slug="listing"
                name="Test"
                locale={locale}
            />
        );
        fireEvent.click(screen.getByText(label));
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    });
});
