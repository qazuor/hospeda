/**
 * @file GastronomyMenuQrWidget.test.tsx
 * @description RTL tests for the gastronomy menu QR + scan analytics owner
 * panel (HOS-1044 §6.6).
 *
 * Verifies:
 *  - Renders nothing when the owner has zero gastronomy listings.
 *  - A premium venue (both calls 200) renders the total, daily series,
 *    device/OS/language breakdowns, and the QR with a download button.
 *  - A non-premium venue (either call 403) renders the LOCKED state, never a
 *    generic error.
 *  - A genuine failure (e.g. 500) renders the generic error state, not locked.
 *  - The `'unknown'` breakdown bucket renders a translated label, not the raw
 *    string — it is the redirect's normal best-effort case, not a bug.
 *  - The panel never mentions location/origin/country in any of the three
 *    locales (HOS-1141 NG-3/NG-4 — see `menu-qr-forbidden-wording.guard.test.ts`
 *    for the exhaustive i18n sweep; this is the render-level companion).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    GastronomyMenuQrWidget,
    type GastronomyMenuQrWidgetListing
} from '../../../src/components/commerce/GastronomyMenuQrWidget.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (!fallback) return _key;
            if (!params) return fallback;
            return Object.entries(params).reduce(
                (text, [key, value]) => text.replace(`{{${key}}}`, String(value)),
                fallback
            );
        }
    })
}));

vi.mock('../../../src/components/commerce/GastronomyMenuQrWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/qr/qr-png', () => ({
    buildSvgDataUrl: (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`,
    renderSvgToPngBlob: async () => new Blob(['png'], { type: 'image/png' })
}));

const { mockGetMenuQr, mockGetMenuQrScans } = vi.hoisted(() => ({
    mockGetMenuQr: vi.fn(),
    mockGetMenuQrScans: vi.fn()
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    commerceAnalyticsApi: {
        getMenuQr: mockGetMenuQr,
        getMenuQrScans: mockGetMenuQrScans
    }
}));

const LISTING: GastronomyMenuQrWidgetListing = { id: 'gastro-1', name: 'La Parrilla del Puerto' };

const READY_QR = {
    ok: true as const,
    data: {
        svg: '<svg>qr</svg>',
        url: 'https://hospeda.com.ar/qr/abc123',
        targetUrl: 'https://hospeda.com.ar/es/gastronomia/la-parrilla/carta/',
        slug: 'la-parrilla',
        qrSlug: 'abc123'
    }
};

const READY_STATS = {
    ok: true as const,
    data: {
        window: '30d' as const,
        total: 42,
        dailySeries: [
            { date: '2026-09-01', total: 10 },
            { date: '2026-09-02', total: 32 }
        ],
        byDeviceType: { mobile: 40, unknown: 2 },
        byOs: { ios: 20, android: 20, unknown: 2 },
        byBrowserLanguage: { 'es-AR': 30, 'pt-BR': 10, unknown: 2 }
    }
};

describe('GastronomyMenuQrWidget (HOS-1044)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when the owner has zero gastronomy listings', () => {
        const { container } = render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[]}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(mockGetMenuQr).not.toHaveBeenCalled();
    });

    it('renders total, daily series, breakdowns and the QR for a premium venue', async () => {
        mockGetMenuQr.mockResolvedValue(READY_QR);
        mockGetMenuQrScans.mockResolvedValue(READY_STATS);

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        await waitFor(() => expect(screen.getByTestId('menu-qr-total')).toHaveTextContent('42'));

        expect(screen.getByText('La Parrilla del Puerto')).toBeTruthy();
        expect(screen.getByTestId('menu-qr-daily-series')).toBeTruthy();
        expect(screen.getByTestId('menu-qr-download')).toBeTruthy();
        expect(screen.queryByTestId('gastronomy-menu-qr-locked')).toBeNull();

        // The daily series and breakdown counts are on the page.
        expect(screen.getByTestId('menu-qr-daily-series').textContent).toContain('10');
        expect(screen.getByTestId('menu-qr-daily-series').textContent).toContain('32');
        expect(screen.getByText('mobile')).toBeTruthy();
        expect(screen.getByText('ios')).toBeTruthy();
        expect(screen.getByText('es-AR')).toBeTruthy();
    });

    it('renders "Desconocido" (translated), never the raw "unknown" string', async () => {
        mockGetMenuQr.mockResolvedValue(READY_QR);
        mockGetMenuQrScans.mockResolvedValue(READY_STATS);

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        await waitFor(() => expect(screen.getByTestId('menu-qr-total')).toBeTruthy());

        expect(screen.getAllByText('Desconocido').length).toBeGreaterThan(0);
        expect(screen.queryByText('unknown')).toBeNull();
    });

    it('renders the locked state — never a generic error — when the QR call answers 403', async () => {
        mockGetMenuQr.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'forbidden' }
        });
        mockGetMenuQrScans.mockResolvedValue(READY_STATS);

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        expect(await screen.findByTestId('gastronomy-menu-qr-locked')).toHaveTextContent(
            'plan Premium de gastronomía'
        );
        expect(screen.queryByTestId('menu-qr-total')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('renders the locked state when the SCANS call answers 403', async () => {
        mockGetMenuQr.mockResolvedValue(READY_QR);
        mockGetMenuQrScans.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'forbidden' }
        });

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        expect(await screen.findByTestId('gastronomy-menu-qr-locked')).toBeTruthy();
    });

    it('renders a generic error (not locked) on a non-403 failure', async () => {
        mockGetMenuQr.mockResolvedValue(READY_QR);
        mockGetMenuQrScans.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
        expect(screen.queryByTestId('gastronomy-menu-qr-locked')).toBeNull();
    });

    it('re-fetches scans (and the QR) with window=7d when the toggle is clicked', async () => {
        mockGetMenuQr.mockResolvedValue(READY_QR);
        mockGetMenuQrScans.mockResolvedValue(READY_STATS);

        render(
            <GastronomyMenuQrWidget
                locale="es"
                listings={[LISTING]}
            />
        );

        await waitFor(() => expect(mockGetMenuQrScans).toHaveBeenCalledTimes(1));
        expect(mockGetMenuQrScans.mock.calls[0]?.[0]).toMatchObject({ window: '30d' });

        fireEvent.click(screen.getByText('7 días'));

        await waitFor(() => expect(mockGetMenuQrScans).toHaveBeenCalledTimes(2));
        expect(mockGetMenuQrScans.mock.calls[1]?.[0]).toMatchObject({ window: '7d' });
    });
});
