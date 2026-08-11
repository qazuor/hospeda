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
 * - while the gate is resolving, no branch the visitor could act on is shown;
 * - an existing alert wins over the locked and max-reached branches, so a
 *   downgraded visitor can still cancel an alert they already hold.
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
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
const mockGetEntitlements = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    priceAlertsApi: { list: (params: unknown) => mockAlertsList(params) },
    billingApi: { getEntitlements: (params: unknown) => mockGetEntitlements(params) }
}));

// Imported after the mocks so the module graph picks them up.
import { PriceAlertButton } from '@/components/accommodation/PriceAlertButton';

const PROPS = {
    accommodationId: 'acc-1',
    apiUrl: 'http://localhost:3001',
    locale: 'es' as const,
    children: <div data-testid="signin-cta">Iniciá sesión para crear la alerta</div>
};

/**
 * Entitlements payload granting price alerts with the given active limit.
 *
 * Built from the real `@repo/billing` enums rather than string literals. The
 * first draft of this file hardcoded `'PRICE_ALERTS'` / `'MAX_ACTIVE_ALERTS'`,
 * whose actual values are `price_alerts` / `max_active_alerts` — so every
 * "entitled" case silently resolved to the LOCKED branch and the test was
 * asserting the wrong component state. Using the enums makes a future rename
 * break this loudly instead.
 */
function entitled(maxActiveAlerts: number) {
    return {
        ok: true as const,
        data: {
            entitlements: [EntitlementKey.PRICE_ALERTS],
            limits: { [LimitKey.MAX_ACTIVE_ALERTS]: maxActiveAlerts }
        }
    };
}

describe('PriceAlertButton — anonymous variant', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockAlertsList.mockReset();
        mockGetEntitlements.mockReset();
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
        expect(mockGetEntitlements).not.toHaveBeenCalled();
    });
});

describe('PriceAlertButton — resolved gate', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockAlertsList.mockReset();
        mockGetEntitlements.mockReset();
    });

    it('shows a disabled button, not the locked upsell, while resolving', async () => {
        // Never-settling lookups: the state a real visitor sees for one RTT.
        mockAlertsList.mockReturnValue(new Promise(() => undefined));
        mockGetEntitlements.mockReturnValue(new Promise(() => undefined));

        render(<PriceAlertButton {...PROPS} />);

        const button = await screen.findByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        // The locked branch links to the plans page; showing it here would flash
        // a false "your plan does not include this" at an entitled visitor.
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('offers the create action when entitled and under the limit', async () => {
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        mockGetEntitlements.mockResolvedValue(entitled(5));

        render(<PriceAlertButton {...PROPS} />);

        const button = await screen.findByRole('button', { name: /avisame si baja el precio/i });
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(mockAlertsList).toHaveBeenCalledWith({});
        expect(mockGetEntitlements).toHaveBeenCalledWith({});
    });

    it('shows the locked upsell when the plan lacks the entitlement', async () => {
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: { entitlements: [], limits: {} }
        });

        render(<PriceAlertButton {...PROPS} />);

        // BETA-201: the upsell targets the TOURIST plans page, since every owner
        // plan already inherits this entitlement.
        const link = await screen.findByRole('link');
        expect(link.getAttribute('href')).toContain('suscriptores/turistas');
    });

    it('disables the button when the plan limit is reached', async () => {
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'a1', accommodationId: 'other' }] }
        });
        mockGetEntitlements.mockResolvedValue(entitled(1));

        render(<PriceAlertButton {...PROPS} />);

        await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
        expect(screen.getByRole('button').getAttribute('title')).toMatch(/límite/i);
    });

    it('offers cancel when an alert exists for THIS accommodation, even at the limit', async () => {
        // The precedence that keeps a downgraded visitor from being stranded
        // with an alert they can see but not cancel.
        mockAlertsList.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'alert-9', accommodationId: 'acc-1' }] }
        });
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: { entitlements: [], limits: { [LimitKey.MAX_ACTIVE_ALERTS]: 1 } }
        });

        render(<PriceAlertButton {...PROPS} />);

        expect(await screen.findByRole('button', { name: /cancelar alerta/i })).toBeEnabled();
    });

    it('falls back to the locked branch when the entitlements call fails', async () => {
        // Fail-closed: offering a create the plan may not allow would bounce the
        // visitor off a 403.
        mockAlertsList.mockResolvedValue({ ok: true, data: { items: [] } });
        mockGetEntitlements.mockRejectedValue(new Error('network'));

        render(<PriceAlertButton {...PROPS} />);

        expect(await screen.findByRole('link')).toBeInTheDocument();
    });
});
