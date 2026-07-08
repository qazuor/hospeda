/**
 * @file TestDailyPlanButton.test.tsx
 * @description Unit tests for the TestDailyPlanButton React island (hidden
 * daily test-plan page).
 *
 * Covers: unauthenticated note, checkout POST payload (planSlug +
 * billingInterval), redirect on success, and inline error on a non-ok
 * response (the expected outcome when HOSPEDA_SHOW_TEST_BILLING_PLAN is off
 * server-side).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestDailyPlanButton } from '../../../src/components/billing/TestDailyPlanButton.client';

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    }
}));

vi.mock('../../../src/components/billing/TestDailyPlanButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

function mockUnauthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: null,
        isPending: false
    });
}

function buildFetchMock(opts: { ok?: boolean; body?: unknown } = {}) {
    const { ok = true, body } = opts;
    return vi.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(body ?? {})
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('TestDailyPlanButton', () => {
    it('shows a log-in note with a sign-in link when unauthenticated', () => {
        // Arrange
        mockUnauthenticated();

        // Act
        render(<TestDailyPlanButton locale="es" />);

        // Assert
        expect(screen.getByText(/Iniciá sesión/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute(
            'href',
            '/es/auth/signin/'
        );
        expect(screen.queryByTestId('test-daily-plan-button')).not.toBeInTheDocument();
    });

    it('POSTs planSlug=owner-test-daily and billingInterval=monthly on click', async () => {
        // Arrange
        mockAuthenticated();
        const fetchMock = buildFetchMock({
            ok: true,
            body: { data: { checkoutUrl: 'https://mp.test/checkout/daily' } }
        });
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<TestDailyPlanButton locale="es" />);

        // Act
        await user.click(screen.getByTestId('test-daily-plan-button'));

        // Assert
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
        });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/billing/subscriptions/start-paid');
        const parsedBody = JSON.parse(init.body as string);
        expect(parsedBody).toEqual({
            planSlug: 'owner-test-daily',
            billingInterval: 'monthly'
        });
    });

    it('redirects to the returned checkoutUrl on success', async () => {
        // Arrange
        mockAuthenticated();
        vi.stubGlobal(
            'fetch',
            buildFetchMock({
                ok: true,
                body: { data: { checkoutUrl: 'https://mp.test/checkout/daily' } }
            })
        );
        const user = userEvent.setup();
        render(<TestDailyPlanButton locale="es" />);

        // Act
        await user.click(screen.getByTestId('test-daily-plan-button'));

        // Assert
        await waitFor(() => {
            expect(window.location.href).toBe('https://mp.test/checkout/daily');
        });
    });

    it('shows an inline error when the API rejects the checkout (e.g. flag off -> PLAN_NOT_FOUND)', async () => {
        // Arrange
        mockAuthenticated();
        vi.stubGlobal(
            'fetch',
            buildFetchMock({
                ok: false,
                body: { error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' } }
            })
        );
        const user = userEvent.setup();
        render(<TestDailyPlanButton locale="es" />);

        // Act
        await user.click(screen.getByTestId('test-daily-plan-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});
