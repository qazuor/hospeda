/**
 * @file PriceAlertButton.test.tsx
 * @description Tests for the price-alert island (SPEC-286 T-011, rewritten for
 * HOS-369 WB0-7).
 *
 * The component had no tests at all while its four gate booleans arrived as SSR
 * props — there was nothing to arrange, so nothing was asserted. WB0-7 moved the
 * gate into the browser (`usePriceAlertGateState`), which is exactly when it
 * became worth pinning: the component now has a resolving state it did not have
 * before, and getting that state wrong is invisible until a real visitor hits it.
 *
 * The invariants under test:
 * - the SSR / edge-cached output is the anonymous `children`, never a button;
 * - a visitor with no session triggers no protected request;
 * - while the lookup is resolving, no branch the visitor could act on is shown;
 * - an existing alert for this accommodation renders the cancel action.
 *
 * HOS-1637 (AC:B13a:21): the client-side plan gate — locked upsell and
 * max-reached state, read from the old billing's entitlements — was removed;
 * the island no longer calls the old billing client, and whether a visitor may
 * create an alert is the API's answer to the create request.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthSnapshot } from '../../helpers/auth-session';
import { tFromCatalog } from '../../helpers/i18n-catalog';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: tFromCatalog
    }),
    createT: () => (key: string, fallback?: string) =>
        key === 'common.apiError.ENTITLEMENT_REQUIRED'
            ? 'Tu plan no incluye esta función. Actualizalo para continuar.'
            : (fallback ?? key)
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
const mockGetEffectiveSet = vi.fn();
const mockToast = vi.fn();
vi.mock('@/store/toast-store', () => ({ addToast: (toast: unknown) => mockToast(toast) }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    priceAlertsApi: { list: (params: unknown) => mockAlertsList(params) },
    effectiveSetApi: { get: vi.fn() }
}));
vi.mock('@/lib/entitlements-cache', () => ({ getEntitlementsCached: () => mockGetEffectiveSet() }));

// Imported after the mocks so the module graph picks them up.
import { PriceAlertButton } from '@/components/accommodation/PriceAlertButton';

afterEach(() => vi.unstubAllGlobals());

const PROPS = {
    accommodationId: 'acc-1',
    apiUrl: 'http://localhost:3001',
    locale: 'es' as const,
    planName: 'Explorer'
};

describe('PriceAlertButton — anonymous variant', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockAlertsList.mockReset();
    });

    it('shows the pre-click paid-plan badge while the session is unresolved', () => {
        // This is the SSR / edge-cached output.
        mockReadCachedAuthMe.mockReturnValue(null);
        render(<PriceAlertButton {...PROPS} />);

        expect(
            screen.getByRole('button', { name: /avisame si baja el precio.*explorer/i })
        ).toBeVisible();
    });

    it('opens the same plans popover as for free, without reading private alerts', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: false }));
        render(<PriceAlertButton {...PROPS} />);

        await userEvent.click(
            screen.getByRole('button', { name: /avisame si baja el precio.*explorer/i })
        );
        expect(screen.getByRole('link', { name: 'Ver planes' })).toBeVisible();
        expect(mockAlertsList).not.toHaveBeenCalled();
    });
});

describe('TEST:B13a:25 PriceAlertButton effective-set gate', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockAlertsList.mockReset();
        mockGetEffectiveSet.mockReset();
        mockToast.mockClear();
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: { price_alerts: 1 },
            limits: { max_active_alerts: 10 },
            failed: false
        });
    });

    it('shows a disabled button while resolving', async () => {
        // A never-settling lookup: the state a real visitor sees for one RTT.
        mockAlertsList.mockReturnValue(new Promise(() => undefined));

        render(<PriceAlertButton {...PROPS} />);

        const button = await screen.findByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('offers the create action when the visitor has no alert for this accommodation', async () => {
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'a1', accommodationId: 'other' }] }
        });

        render(<PriceAlertButton {...PROPS} />);

        const button = await screen.findByRole('button', { name: /avisame si baja el precio/i });
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(screen.getByText('Explorer')).toBeVisible();
        expect(mockAlertsList).toHaveBeenCalledWith({});
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('offers cancel when an alert exists for THIS accommodation', async () => {
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        id: 'alert-9',
                        accommodationId: 'acc-1',
                        targetPercentDrop: 17,
                        createdAt: '2026-09-10T12:00:00Z'
                    }
                ]
            }
        });

        render(<PriceAlertButton {...PROPS} />);

        expect(await screen.findByRole('button', { name: /cancelar alerta/i })).toBeEnabled();
        expect(screen.getByText(/17/)).toBeVisible();
        expect(screen.getByText(/10 sept/i)).toBeVisible();
    });

    it('locks when the alert lookup fails', async () => {
        mockAlertsList.mockRejectedValue(new Error('network'));

        render(<PriceAlertButton {...PROPS} />);

        const upsell = await screen.findByRole('button', {
            name: /avisame si baja el precio.*explorer/i
        });
        expect(upsell).toHaveAttribute('aria-haspopup', 'dialog');
        expect(upsell).toHaveTextContent('Explorer');
        expect(upsell.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    });
    it('locks without capability and disables at the exact quota', async () => {
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: {},
            limits: { max_active_alerts: 2 },
            failed: false
        });
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        const { unmount } = render(<PriceAlertButton {...PROPS} />);
        const upsell = await screen.findByRole('button', {
            name: /avisame si baja el precio.*explorer/i
        });
        expect(upsell).toHaveAttribute('aria-haspopup', 'dialog');
        expect(upsell).toHaveTextContent('Explorer');
        expect(upsell.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
        unmount();
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: { price_alerts: 1 },
            limits: { max_active_alerts: 2 },
            failed: false
        });
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    { id: 'a', accommodationId: 'elsewhere' },
                    { id: 'b', accommodationId: 'elsewhere' }
                ]
            }
        });
        render(<PriceAlertButton {...PROPS} />);
        expect(
            await screen.findByRole('button', { name: /límite de alertas alcanzado/i })
        ).toBeDisabled();
    });
    it('keeps cancel available for this listing when capability is absent', async () => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'own', accommodationId: 'acc-1' }] }
        });
        render(<PriceAlertButton {...PROPS} />);
        expect(await screen.findByRole('button', { name: /cancelar alerta/i })).toBeEnabled();
    });
    it('locks when the effective-set read failed', async () => {
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: { price_alerts: 1 },
            limits: {},
            failed: true
        });
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        render(<PriceAlertButton {...PROPS} />);
        expect(
            await screen.findByRole('button', {
                name: /avisame si baja el precio.*explorer/i
            })
        ).toBeInTheDocument();
    });
    it('opens the paid-plan popover on click and restores focus on dismissal', async () => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        const user = userEvent.setup();
        const href = window.location.href;
        render(<PriceAlertButton {...PROPS} />);
        const trigger = await screen.findByRole('button', {
            name: /avisame si baja el precio.*explorer/i
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(trigger);
        expect(screen.getByRole('dialog')).toHaveTextContent('Explorer');
        expect(screen.getByRole('link', { name: 'Ver planes' })).toBeVisible();
        expect(window.location.href).toBe(href);
        await user.click(screen.getByRole('button', { name: 'Ahora no' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });
    it('posts the percentage only after confirmation and shows the saved alert and toast', async () => {
        const user = userEvent.setup();
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    success: true,
                    data: { id: 'saved', targetPercentDrop: 17, createdAt: '2026-09-10T12:00:00Z' }
                })
            )
        );
        vi.stubGlobal('fetch', fetchMock);
        render(<PriceAlertButton {...PROPS} />);
        const trigger = await screen.findByRole('button', { name: /avisame si baja el precio/i });
        await waitFor(() => expect(trigger).toBeEnabled());
        await user.click(trigger);
        expect(fetchMock).not.toHaveBeenCalled();
        await user.type(screen.getByRole('spinbutton'), '17');
        await user.click(screen.getByRole('button', { name: 'Crear alerta' }));
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ accommodationId: 'acc-1', targetPercentDrop: 17 })
            })
        );
        expect(await screen.findByRole('button', { name: 'Cancelar alerta' })).toBeVisible();
        expect(screen.getByText(/17/)).toBeVisible();
        expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
                message: expect.stringMatching(/por email/i)
            })
        );
    });
    it('translates an ENTITLEMENT_REQUIRED refusal and hides the API English message', async () => {
        const user = userEvent.setup();
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message: 'English API refusal',
                            status: 403
                        }
                    }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        render(<PriceAlertButton {...PROPS} />);
        await user.click(await screen.findByRole('button', { name: /avisame si baja el precio/i }));
        await user.type(screen.getByRole('spinbutton'), '10');
        await user.click(screen.getByRole('button', { name: 'Crear alerta' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tu plan no incluye esta función. Actualizalo para continuar.'
        );
        expect(screen.queryByText('English API refusal')).not.toBeInTheDocument();
    });
});
