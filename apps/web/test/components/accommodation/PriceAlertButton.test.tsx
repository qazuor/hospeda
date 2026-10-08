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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthSnapshot } from '../../helpers/auth-session';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
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

vi.mock('@/lib/api/endpoints-protected', () => ({
    priceAlertsApi: { list: (params: unknown) => mockAlertsList(params) }
}));

// Imported after the mocks so the module graph picks them up.
import { PriceAlertButton } from '@/components/accommodation/PriceAlertButton';

const PROPS = {
    accommodationId: 'acc-1',
    apiUrl: 'http://localhost:3001',
    locale: 'es' as const,
    children: <div data-testid="signin-cta">Iniciá sesión para crear la alerta</div>
};

describe('PriceAlertButton — anonymous variant', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockAlertsList.mockReset();
    });

    it('renders the sign-in children while the session is unresolved', () => {
        // This is the SSR / edge-cached output.
        mockReadCachedAuthMe.mockReturnValue(null);
        render(<PriceAlertButton {...PROPS} />);

        expect(screen.getByTestId('signin-cta')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders the sign-in children for a confirmed guest, and calls nothing', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: false }));
        render(<PriceAlertButton {...PROPS} />);

        expect(screen.getByTestId('signin-cta')).toBeInTheDocument();
        await waitFor(() => expect(mockAlertsList).not.toHaveBeenCalled());
    });
});

describe('PriceAlertButton — resolved lookup', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockAlertsList.mockReset();
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
        expect(mockAlertsList).toHaveBeenCalledWith({});
        // No plan upsell link and no max-reached state: the old gate is gone.
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByTitle(/límite/i)).not.toBeInTheDocument();
    });

    it('offers cancel when an alert exists for THIS accommodation', async () => {
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'alert-9', accommodationId: 'acc-1' }] }
        });

        render(<PriceAlertButton {...PROPS} />);

        expect(await screen.findByRole('button', { name: /cancelar alerta/i })).toBeEnabled();
    });

    it('offers the create action when the alert lookup fails', async () => {
        mockAlertsList.mockRejectedValue(new Error('network'));

        render(<PriceAlertButton {...PROPS} />);

        const button = await screen.findByRole('button', { name: /avisame si baja el precio/i });
        await waitFor(() => expect(button).not.toBeDisabled());
    });
});
