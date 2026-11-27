/**
 * @file PriceAlertButton.threshold.test.tsx
 * @description Dialog modes, live preview, visible threshold and cancel toast
 * for the price-alert island (HOS-2666, CARD-024 H-4 / CARD-040 H-1).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthSnapshot } from '../../helpers/auth-session';
import { tFromCatalog } from '../../helpers/i18n-catalog';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({ t: tFromCatalog }),
    createT: () => (key: string, fallback?: string) => fallback ?? key
}));
vi.mock('@/components/accommodation/PriceAlertButton.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const mockReadCachedAuthMe = vi.fn();
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

const mockAlertsList = vi.fn();
const mockToast = vi.fn();
vi.mock('@/store/toast-store', () => ({ addToast: (toast: unknown) => mockToast(toast) }));
vi.mock('@/lib/api/endpoints-protected', () => ({
    priceAlertsApi: { list: (params: unknown) => mockAlertsList(params) },
    effectiveSetApi: { get: vi.fn() }
}));
vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: () =>
        Promise.resolve({
            entitlements: { price_alerts: 1 },
            limits: { max_active_alerts: 10 },
            failed: false
        })
}));

import { PriceAlertButton } from '@/components/accommodation/PriceAlertButton';

const PROPS = {
    accommodationId: 'acc-1',
    apiUrl: 'http://localhost:3001',
    locale: 'es' as const,
    price: 85000,
    currency: 'ARS'
};

function stubCreate(data: Record<string, unknown>) {
    const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ success: true, data })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

async function openDialog() {
    const user = userEvent.setup();
    render(<PriceAlertButton {...PROPS} />);
    const trigger = await screen.findByRole('button', { name: /avisame si baja el precio/i });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    return user;
}

beforeEach(() => {
    vi.unstubAllGlobals();
    mockReadCachedAuthMe.mockReset();
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    mockAlertsList.mockReset();
    mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
    mockToast.mockClear();
});

describe('create dialog, percentage mode', () => {
    it('keeps submit disabled until a valid value and previews the resulting price', async () => {
        const user = await openDialog();
        const submit = screen.getByRole('button', { name: 'Crear alerta' });
        expect(submit).toBeDisabled();

        await user.type(screen.getByRole('spinbutton'), '10');
        expect(screen.getByText(/Te avisamos si baja a .*76\.500 o menos/)).toBeVisible();
        expect(submit).toBeEnabled();
    });

    it('sends the typed percentage as-is', async () => {
        const fetchMock = stubCreate({ id: 'n1', targetPercentDrop: 10 });
        const user = await openDialog();
        await user.type(screen.getByRole('spinbutton'), '10');
        await user.click(screen.getByRole('button', { name: 'Crear alerta' }));
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ accommodationId: 'acc-1', targetPercentDrop: 10 })
            })
        );
    });

    it('shows an inline error and keeps submit disabled out of range', async () => {
        const user = await openDialog();
        await user.type(screen.getByRole('spinbutton'), '150');
        expect(screen.getByRole('alert')).toHaveTextContent(/entre 1 y 100/);
        expect(screen.getByRole('button', { name: 'Crear alerta' })).toBeDisabled();
    });
});

describe('create dialog, target-price mode', () => {
    async function switchToPrice() {
        const user = await openDialog();
        await user.click(screen.getByRole('radio', { name: 'Precio objetivo' }));
        return user;
    }

    it('previews the equivalent drop and sends the computed percentage', async () => {
        const fetchMock = stubCreate({ id: 'n2', targetPercentDrop: 10 });
        const user = await switchToPrice();
        await user.type(screen.getByRole('textbox'), '76500');
        expect(screen.getByText('Equivale a una baja del 10%')).toBeVisible();
        expect(screen.getByText(/Te avisamos si baja a .*76\.500 o menos/)).toBeVisible();
        await user.click(screen.getByRole('button', { name: 'Crear alerta' }));
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ accommodationId: 'acc-1', targetPercentDrop: 10 })
            })
        );
    });

    it('rounds the saved percentage down so the user is not notified later', async () => {
        const fetchMock = stubCreate({ id: 'n3', targetPercentDrop: 17 });
        const user = await switchToPrice();
        await user.type(screen.getByRole('textbox'), '69701');
        expect(screen.getByText('Equivale a una baja del 17%')).toBeVisible();
        await user.click(screen.getByRole('button', { name: 'Crear alerta' }));
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ accommodationId: 'acc-1', targetPercentDrop: 17 })
            })
        );
    });

    it('rejects a price at or above the current one', async () => {
        const user = await switchToPrice();
        await user.type(screen.getByRole('textbox'), '90000');
        expect(screen.getByRole('alert')).toHaveTextContent(/menor al precio actual/);
        expect(screen.getByRole('button', { name: 'Crear alerta' })).toBeDisabled();
    });

    it('rejects a zero price', async () => {
        const user = await switchToPrice();
        await user.type(screen.getByRole('textbox'), '0');
        expect(screen.getByRole('alert')).toHaveTextContent(/mayor a cero/);
        expect(screen.getByRole('button', { name: 'Crear alerta' })).toBeDisabled();
    });
});

describe('active alert card and cancel', () => {
    beforeEach(() => {
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        id: 'alert-1',
                        accommodationId: 'acc-1',
                        targetPercentDrop: 10,
                        basePriceSnapshot: 8_500_000,
                        createdAt: '2026-11-25T12:00:00Z'
                    }
                ]
            }
        });
    });

    it('shows the real threshold and the price it implies', async () => {
        render(<PriceAlertButton {...PROPS} />);
        expect(
            await screen.findByText(/Te avisamos si baja un 10% o más \(a .*76\.500 o menos\)/)
        ).toBeVisible();
        expect(screen.getByText(/Creada el/)).toBeVisible();
        expect(screen.queryByText(/umbral predeterminado/)).not.toBeInTheDocument();
    });

    it('cancelling emits only the alert toast, never the favorites one', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        const user = userEvent.setup();
        render(<PriceAlertButton {...PROPS} />);
        await user.click(await screen.findByRole('button', { name: 'Cancelar alerta' }));
        await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
        expect(mockToast).toHaveBeenCalledWith({ type: 'success', message: 'Alerta cancelada' });
        expect(JSON.stringify(mockToast.mock.calls)).not.toMatch(/favoritos/i);
    });
});
