/**
 * @file PlanPurchaseButton.signups-paused.test.tsx
 * @description Admin-paused new paid signups (`newPaidSignupsFrozen`).
 *
 * A card whose click would START a new paid subscription renders the shared
 * "paused" notice instead of its checkout button. And when the page's flag is
 * stale (the freeze went on after SSR), the API's `NEW_PAID_SIGNUPS_FROZEN`
 * refusal is shown with the same localized copy, never the generic payment
 * error. The plan-change case (exempt) lives in its own file, because the
 * subscription lookup is a module singleton cached once per test file.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

const { PAUSED_BODY_COPY } = vi.hoisted(() => ({
    PAUSED_BODY_COPY: 'Las contrataciones nuevas están en pausa (test copy).'
}));

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

vi.mock('../../../src/lib/i18n', () => {
    const CATALOG: Record<string, string> = {
        'billing.checkout.signupsPaused.body': PAUSED_BODY_COPY,
        'common.apiError.NEW_PAID_SIGNUPS_FROZEN': PAUSED_BODY_COPY
    };
    const t = (key: string, fallback?: string) => CATALOG[key] ?? fallback ?? key;
    return {
        createTranslations: (_locale: string) => ({
            t,
            tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
        }),
        createT: (_locale: string) => t
    };
});

vi.mock('../../../src/lib/billing/trial-clock', () => ({
    fetchTrialClock: () =>
        Promise.resolve({
            isOnTrial: false,
            isExpired: true,
            daysRemaining: null,
            startedAt: '2026-01-01T00:00:00.000Z'
        }),
    resetTrialClockCache: () => undefined
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`,
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

const baseProps = {
    planSlug: 'owner-basico',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    plansPath: '/es/suscriptores/planes/',
    audience: 'owner' as const,
    ownPreapprovalEnabled: false
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

function mockAnonymous() {
    (useSession as MockUseSession).mockReturnValue({ data: null, isPending: false });
}

/**
 * No subscription anywhere (a NEW signup), and `/start-paid` answers the
 * freeze refusal — what a stale page flag would run into.
 */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/subscriptions/start-paid')) {
            return Promise.resolve({
                ok: false,
                status: 409,
                json: () =>
                    Promise.resolve({
                        error: {
                            code: 'NEW_PAID_SIGNUPS_FROZEN',
                            message: 'New subscriptions and purchases are temporarily paused.'
                        }
                    })
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null } })
        });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', buildFetchMock());
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PlanPurchaseButton — admin-paused new paid signups', () => {
    it('renders the paused notice instead of the checkout button for a new signup', async () => {
        // Arrange
        mockAuthenticated();

        // Act
        render(
            <PlanPurchaseButton
                {...baseProps}
                newPaidSignupsFrozen
            />
        );

        // Assert
        expect(await screen.findByTestId('plan-signups-paused-notice')).toHaveTextContent(
            PAUSED_BODY_COPY
        );
        expect(screen.queryByTestId('plan-cta-button')).not.toBeInTheDocument();
    });

    it('renders the paused notice for an anonymous visitor too', () => {
        // Arrange
        mockAnonymous();

        // Act
        render(
            <PlanPurchaseButton
                {...baseProps}
                newPaidSignupsFrozen
            />
        );

        // Assert
        expect(screen.getByRole('status')).toHaveTextContent(PAUSED_BODY_COPY);
        expect(screen.queryByTestId('plan-cta-button')).not.toBeInTheDocument();
    });

    it('renders the checkout button when signups are not paused', () => {
        // Arrange
        mockAuthenticated();

        // Act
        render(<PlanPurchaseButton {...baseProps} />);

        // Assert
        expect(screen.getByTestId('plan-cta-button')).toBeInTheDocument();
        expect(screen.queryByTestId('plan-signups-paused-notice')).not.toBeInTheDocument();
    });

    it('shows the paused copy when a stale page flag lets the click reach a frozen API', async () => {
        // Arrange
        mockAuthenticated();
        const user = userEvent.setup();
        render(<PlanPurchaseButton {...baseProps} />);

        // Act
        await user.click(screen.getByTestId('plan-cta-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(PAUSED_BODY_COPY);
        });
        expect(window.location.href).toBe('');
    });
});
