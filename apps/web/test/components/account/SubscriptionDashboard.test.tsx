/**
 * @file SubscriptionDashboard.test.tsx
 * @description Unit tests for the SubscriptionDashboard React island.
 *
 * Covers:
 * - Loading state renders correctly
 * - Resolved subscription renders plan name, status, billing date
 * - Cancel modal opens on button click and shows support contact instructions
 * - Cancel modal exposes a mailto link to support (self-cancel API pending; SPEC-147)
 * - HOST role shows admin escalation button
 * - USER role hides admin escalation button
 * - Empty state when no subscription
 * - Error state when fetch fails
 * - Invoice download action
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SubscriptionDashboard,
    type SubscriptionDashboardUser
} from '../../../src/components/account/SubscriptionDashboard.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/SubscriptionDashboard.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Mock @repo/icons — return simple span elements for each icon
vi.mock('@repo/icons', () => ({
    CheckIcon: () => <span data-testid="icon-check" />,
    ArrowRightIcon: () => <span data-testid="icon-arrow-right" />,
    DownloadIcon: () => <span data-testid="icon-download" />,
    CancelIcon: () => <span data-testid="icon-cancel" />
}));

// Mock env helper — must match the RESOLVED path that @/lib/env points to
vi.mock('../../../src/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

// Also mock via alias path so both import paths hit the same mock
vi.mock('@/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

// Mock the API endpoints
const mockGetSubscription = vi.fn();
const mockListInvoices = vi.fn();
// cancelSubscription was removed from the user dashboard — self-cancel is
// pending (SPEC-147). The mock stays so we can assert it is NEVER called.
const mockCancelSubscription = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: {
        getSubscription: () => mockGetSubscription()
    },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: () => mockCancelSubscription()
    }
}));

// Also mock via alias
vi.mock('@/lib/api/endpoints-protected', () => ({
    userApi: {
        getSubscription: () => mockGetSubscription()
    },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: () => mockCancelSubscription()
    }
}));

// Mock the toast store
const mockAddToast = vi.fn();
vi.mock('../../../src/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));

vi.mock('@/store/toast-store', () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args)
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ROLE: SubscriptionDashboardUser = { id: 'user-1', role: 'USER' };
const HOST_ROLE: SubscriptionDashboardUser = { id: 'user-2', role: 'HOST' };
const ADMIN_ROLE: SubscriptionDashboardUser = { id: 'user-3', role: 'ADMIN' };
const SUPER_ADMIN_ROLE: SubscriptionDashboardUser = { id: 'user-4', role: 'SUPER_ADMIN' };

const ACTIVE_SUBSCRIPTION = {
    planSlug: 'pro',
    planName: 'Plan Pro',
    status: 'active' as const,
    currentPeriodStart: '2026-04-01T00:00:00Z',
    currentPeriodEnd: '2026-05-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    monthlyPriceArs: 9900,
    paymentMethod: {
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2027
    }
};

const CANCELLED_SUBSCRIPTION = {
    ...ACTIVE_SUBSCRIPTION,
    status: 'cancelled' as const,
    cancelAtPeriodEnd: true
};

const TRIAL_SUBSCRIPTION = {
    ...ACTIVE_SUBSCRIPTION,
    status: 'trial' as const,
    paymentMethod: null
};

const MOCK_INVOICE = {
    id: 'inv-1',
    date: '2026-04-01',
    description: 'Plan Pro - Abril 2026',
    amount: 9900,
    currency: 'ARS',
    status: 'paid' as const,
    pdfUrl: 'https://example.com/invoice-1.pdf'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSubscriptionSuccess(data = ACTIVE_SUBSCRIPTION) {
    mockGetSubscription.mockResolvedValue({ ok: true, data: { subscription: data } });
    mockListInvoices.mockResolvedValue({
        ok: true,
        data: {
            items: [MOCK_INVOICE],
            pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 }
        }
    });
}

function mockSubscriptionLoading() {
    mockGetSubscription.mockReturnValue(new Promise(() => {}));
    mockListInvoices.mockReturnValue(new Promise(() => {}));
}

function mockSubscriptionError(message = 'Error de red') {
    mockGetSubscription.mockResolvedValue({ ok: false, error: { status: 500, message } });
    mockListInvoices.mockResolvedValue({ ok: false, error: { status: 500, message } });
}

function mockNoSubscription() {
    mockGetSubscription.mockResolvedValue({ ok: true, data: { subscription: null } });
    mockListInvoices.mockResolvedValue({
        ok: true,
        data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
    });
}

function renderDashboard(user: SubscriptionDashboardUser = USER_ROLE) {
    return render(
        <SubscriptionDashboard
            locale="es"
            user={user}
        />
    );
}

/** Wait until loading spinner is gone and content is rendered */
async function waitForLoaded() {
    await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    mockCancelSubscription.mockResolvedValue({ ok: true, data: { success: true } });
    vi.spyOn(window, 'open').mockImplementation(() => null);
});

describe('SubscriptionDashboard — loading state', () => {
    it('shows a loading spinner on initial render', () => {
        mockSubscriptionLoading();
        renderDashboard();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('loading container has correct aria-live attribute', () => {
        mockSubscriptionLoading();
        renderDashboard();
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
    });
});

describe('SubscriptionDashboard — resolved subscription', () => {
    it('renders the plan name after loading', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText('Plan Pro')).toBeInTheDocument();
        });
    });

    it('renders the active status badge', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            // The status text is derived from t() with a fallback of 'Active'
            // Since translations are not fully loaded in test, we look for the badge element
            const badge = document.querySelector('[class*="badge"]');
            expect(badge).toBeInTheDocument();
        });
    });

    it('renders the next billing date section label', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText(/próxima facturación/i)).toBeInTheDocument();
        });
    });

    it('renders the card payment method with brand and last4', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText(/Visa •••• 4242/)).toBeInTheDocument();
        });
    });

    it('renders MercadoPago as payment method when no card', async () => {
        mockSubscriptionSuccess(TRIAL_SUBSCRIPTION);
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText(/MercadoPago/i)).toBeInTheDocument();
        });
    });

    it('renders the upgrade link pointing to plans page', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            const link = screen.getByRole('link', { name: /mejorar plan|ver planes/i });
            expect(link).toHaveAttribute('href', '/es/suscriptores/planes/');
        });
    });

    it('renders cancel button for active subscription', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });
    });

    it('hides cancel button for already-cancelled subscription', async () => {
        mockSubscriptionSuccess(CANCELLED_SUBSCRIPTION);
        renderDashboard();
        await waitForLoaded();
        expect(
            screen.queryByRole('button', { name: /cancelar suscripción/i })
        ).not.toBeInTheDocument();
    });
});

describe('SubscriptionDashboard — cancel modal', () => {
    it('opens the confirmation modal when cancel button is clicked', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('closes the modal when the close button is clicked', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // The modal's secondary button is "Cerrar" (t('common.close', 'Cerrar')).
        const closeButton = screen.getByRole('button', { name: /cerrar/i });
        fireEvent.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('closes the modal on Escape key', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('renders a mailto link to support inside the modal', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const supportLink = screen.getByRole('link', { name: /soporte/i });
        expect(supportLink.getAttribute('href')).toMatch(/^mailto:info@hospeda\.com\?subject=/);
    });

    it('does not call the cancel API when the modal opens (self-cancel pending; SPEC-147)', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // The dashboard should NOT call the protected cancel endpoint — that
        // route does not exist (legacy DELETE /protected/billing/subscriptions/current).
        // Self-cancel is tracked under SPEC-147.
        expect(mockCancelSubscription).not.toHaveBeenCalled();
    });
});

describe('SubscriptionDashboard — role-conditional admin button', () => {
    it('shows admin button for HOST role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(HOST_ROLE);

        await waitFor(() => {
            // Admin button text is "Más opciones (panel admin)"
            const adminLink = screen.getByRole('link', { name: /más opciones/i });
            expect(adminLink).toBeInTheDocument();
        });
    });

    it('shows admin button for ADMIN role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(ADMIN_ROLE);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /más opciones/i })).toBeInTheDocument();
        });
    });

    it('shows admin button for SUPER_ADMIN role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(SUPER_ADMIN_ROLE);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /más opciones/i })).toBeInTheDocument();
        });
    });

    it('admin button points to admin billing settings URL', async () => {
        mockSubscriptionSuccess();
        renderDashboard(HOST_ROLE);

        await waitFor(() => {
            const adminLink = screen.getByRole('link', { name: /más opciones/i });
            expect(adminLink).toHaveAttribute('href', 'http://localhost:3000/billing/settings');
        });
    });

    it('admin button opens in a new tab', async () => {
        mockSubscriptionSuccess();
        renderDashboard(HOST_ROLE);

        await waitFor(() => {
            const adminLink = screen.getByRole('link', { name: /más opciones/i });
            expect(adminLink).toHaveAttribute('target', '_blank');
            expect(adminLink).toHaveAttribute('rel', 'noreferrer noopener');
        });
    });

    it('hides admin button for USER role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(USER_ROLE);

        await waitForLoaded();
        expect(screen.queryByRole('link', { name: /más opciones/i })).not.toBeInTheDocument();
    });
});

describe('SubscriptionDashboard — empty state', () => {
    it('renders the empty state when user has no subscription', async () => {
        mockNoSubscription();
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText(/sin suscripción activa/i)).toBeInTheDocument();
        });
    });

    it('empty state has a link to plans page', async () => {
        mockNoSubscription();
        renderDashboard();

        await waitFor(() => {
            const link = screen.getByRole('link', { name: /mejorar plan|ver planes/i });
            expect(link).toHaveAttribute('href', '/es/suscriptores/planes/');
        });
    });
});

describe('SubscriptionDashboard — error state', () => {
    it('renders the error state when fetch fails', async () => {
        mockSubscriptionError('Error de red');
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Error de red')).toBeInTheDocument();
        });
    });

    it('error state has a retry button', async () => {
        mockSubscriptionError();
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
        });
    });

    it('retry button re-fetches the subscription', async () => {
        mockSubscriptionError();
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
        });

        // Now mock a successful response for the retry
        mockGetSubscription.mockResolvedValue({
            ok: true,
            data: { subscription: ACTIVE_SUBSCRIPTION }
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
        });

        await waitFor(() => {
            expect(screen.getByText('Plan Pro')).toBeInTheDocument();
        });
    });
});

describe('SubscriptionDashboard — invoice download', () => {
    it('renders the download invoice button', async () => {
        mockSubscriptionSuccess();
        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /descargar última factura/i })
            ).toBeInTheDocument();
        });
    });

    it('opens the invoice PDF URL in a new tab', async () => {
        mockSubscriptionSuccess();
        // The download button calls listInvoices again — set up mock for that second call too
        mockListInvoices.mockResolvedValue({
            ok: true,
            data: {
                items: [MOCK_INVOICE],
                pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 }
            }
        });

        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /descargar última factura/i })
            ).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /descargar última factura/i }));
        });

        await waitFor(() => {
            expect(window.open).toHaveBeenCalledWith(
                'https://example.com/invoice-1.pdf',
                '_blank',
                'noreferrer'
            );
        });
    });

    it('shows info toast when no invoices are available', async () => {
        mockSubscriptionSuccess();
        // On the download click, return an empty list
        mockListInvoices.mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
        });

        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /descargar última factura/i })
            ).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /descargar última factura/i }));
        });

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
        });
    });
});
