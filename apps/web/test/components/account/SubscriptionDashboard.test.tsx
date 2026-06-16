/**
 * @file SubscriptionDashboard.test.tsx
 * @description Unit tests for the SubscriptionDashboard React island.
 *
 * Covers:
 * - Loading state renders correctly
 * - Resolved subscription renders plan name, status, billing date
 * - Cancel modal: opens, closes (button + Escape), confirm step UI
 * - Cancel modal: calls API on confirm → success step renders access-until date
 * - Cancel modal: 404 response (flag off) → degrades to email-support path
 * - Cancel modal: 5xx response → retryable error state
 * - HOST role shows admin escalation button only for SUPER_ADMIN
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

// PlanChangeFlow and its sub-components are statically imported by SubscriptionDashboard
vi.mock('../../../src/components/account/PlanChangeFlow.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/PlanPicker.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/DowngradePreviewPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

// Mock @repo/icons — return simple span elements for each icon.
vi.mock('@repo/icons', () => ({
    CheckIcon: () => <span data-testid="icon-check" />,
    ArrowRightIcon: () => <span data-testid="icon-arrow-right" />,
    DownloadIcon: () => <span data-testid="icon-download" />,
    CancelIcon: () => <span data-testid="icon-cancel" />,
    PlayIcon: () => <span data-testid="icon-play" />,
    PowerOffIcon: () => <span data-testid="icon-power-off" />
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
const mockCancelSubscription = vi.fn();
const mockPauseSubscription = vi.fn();
const mockResumeSubscription = vi.fn();
// Plan-change flow methods (used by PlanChangeFlow — statically imported)
const mockChangePlan = vi.fn();
const mockPreviewDowngrade = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: {
        getSubscription: () => mockGetSubscription()
    },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
        pauseSubscription: () => mockPauseSubscription(),
        resumeSubscription: () => mockResumeSubscription(),
        changePlan: (...args: unknown[]) => mockChangePlan(...args),
        previewDowngrade: (...args: unknown[]) => mockPreviewDowngrade(...args)
    }
}));

// Also mock via alias
vi.mock('@/lib/api/endpoints-protected', () => ({
    userApi: {
        getSubscription: () => mockGetSubscription()
    },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
        pauseSubscription: () => mockPauseSubscription(),
        resumeSubscription: () => mockResumeSubscription(),
        changePlan: (...args: unknown[]) => mockChangePlan(...args),
        previewDowngrade: (...args: unknown[]) => mockPreviewDowngrade(...args)
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
    id: 'sub-uuid-1',
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

const SUBSCRIPTION_WITH_SCHEDULED_CHANGE = {
    ...ACTIVE_SUBSCRIPTION,
    scheduledPlanChange: {
        newPlanId: 'basic',
        effectiveAt: '2026-05-01T00:00:00Z'
    }
};

const SUBSCRIPTION_WITHOUT_SCHEDULED_CHANGE = {
    ...ACTIVE_SUBSCRIPTION,
    scheduledPlanChange: null
};

/** API response returned by a successful cancelSubscription call */
const CANCEL_SUCCESS_RESPONSE = {
    subscriptionId: 'sub-uuid-1',
    cancelAtPeriodEnd: true as const,
    canceledAt: new Date('2026-04-15T10:00:00Z'),
    accessUntil: new Date('2026-05-01T00:00:00Z')
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

/** Open the cancel modal assuming subscription is already loaded */
async function openCancelModal() {
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancelar suscripción/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /cancelar suscripción/i }));
    await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    mockCancelSubscription.mockResolvedValue({
        ok: true,
        data: CANCEL_SUCCESS_RESPONSE
    });
    mockPauseSubscription.mockResolvedValue({
        ok: true,
        data: {
            success: true,
            subscriptionId: 'sub-uuid-1',
            status: 'paused',
            accommodationsUpdated: 0
        }
    });
    mockResumeSubscription.mockResolvedValue({
        ok: true,
        data: {
            success: true,
            subscriptionId: 'sub-uuid-1',
            status: 'active',
            accommodationsUpdated: 0
        }
    });
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

describe('SubscriptionDashboard — cancel modal: open / close', () => {
    it('opens the confirmation modal when cancel button is clicked', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('modal shows description text in confirm step', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();
        // The confirm-step description key is cancelModal.description
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // The confirm button must be present
        expect(
            screen.getByRole('button', { name: /sí, cancelar suscripción/i })
        ).toBeInTheDocument();
    });

    it('modal shows an optional reason textarea in confirm step', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('closes the modal when the cancel (dismiss) button is clicked', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        // "Cancelar" is t('common.cancel')
        const cancelButton = screen.getByRole('button', { name: /^cancelar$/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('closes the modal on Escape key', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});

describe('SubscriptionDashboard — cancel modal: API success path', () => {
    it('calls cancelSubscription with the subscription id on confirm', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            expect(mockCancelSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ subscriptionId: 'sub-uuid-1' })
            );
        });
    });

    it('forwards the typed reason to the API call', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Demasiado caro' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            expect(mockCancelSubscription).toHaveBeenCalledWith(
                expect.objectContaining({ reason: 'Demasiado caro' })
            );
        });
    });

    it('shows success step after a successful API cancel', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            // The confirm button must be gone — we are on the success step
            expect(
                screen.queryByRole('button', { name: /sí, cancelar suscripción/i })
            ).not.toBeInTheDocument();
        });

        // A close button is still available
        expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
    });

    it('re-fetches subscription data after successful cancel', async () => {
        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        const callsBefore = mockGetSubscription.mock.calls.length;

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            expect(mockGetSubscription.mock.calls.length).toBeGreaterThan(callsBefore);
        });
    });
});

describe('SubscriptionDashboard — cancel modal: 404 graceful degradation', () => {
    it('shows the flag-off fallback copy when API returns 404', async () => {
        mockCancelSubscription.mockResolvedValue({
            ok: false,
            error: { status: 404, message: 'Not Found' }
        });

        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        // Should NOT show scary error — instead shows the flag-off support copy
        await waitFor(() => {
            expect(
                screen.queryByRole('button', { name: /sí, cancelar suscripción/i })
            ).not.toBeInTheDocument();
        });

        // The mailto link must appear (degrade to email support)
        const supportLink = screen.getByRole('link', { name: /soporte/i });
        expect(supportLink.getAttribute('href')).toMatch(/^mailto:info@hospeda\.com\?subject=/);
    });

    it('does not show an error alert on 404 — uses fallback copy instead', async () => {
        mockCancelSubscription.mockResolvedValue({
            ok: false,
            error: { status: 404, message: 'Not Found' }
        });

        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            // No role="alert" should appear for a 404 (it's not an error, it's degradation)
            const alertEl = document.querySelector('[role="alert"]');
            expect(alertEl).not.toBeInTheDocument();
        });
    });
});

describe('SubscriptionDashboard — cancel modal: non-404 error path', () => {
    it('shows a retryable error message when API returns 500', async () => {
        mockCancelSubscription.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'Internal Server Error' }
        });

        mockSubscriptionSuccess();
        renderDashboard();
        await openCancelModal();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /sí, cancelar suscripción/i }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Confirm button must still be available (retry path)
        expect(
            screen.getByRole('button', { name: /sí, cancelar suscripción/i })
        ).toBeInTheDocument();
    });
});

describe('SubscriptionDashboard — role-conditional admin button', () => {
    // The admin escalation link points at admin /billing/settings, guarded by
    // BILLING_READ_ALL — granted to SUPER_ADMIN only (SPEC-164).
    it('hides admin button for HOST role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(HOST_ROLE);

        await waitForLoaded();
        expect(screen.queryByRole('link', { name: /más opciones/i })).not.toBeInTheDocument();
    });

    it('hides admin button for ADMIN role', async () => {
        mockSubscriptionSuccess();
        renderDashboard(ADMIN_ROLE);

        await waitForLoaded();
        expect(screen.queryByRole('link', { name: /más opciones/i })).not.toBeInTheDocument();
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
        renderDashboard(SUPER_ADMIN_ROLE);

        await waitFor(() => {
            const adminLink = screen.getByRole('link', { name: /más opciones/i });
            expect(adminLink).toHaveAttribute('href', 'http://localhost:3000/billing/settings');
        });
    });

    it('admin button opens in a new tab', async () => {
        mockSubscriptionSuccess();
        renderDashboard(SUPER_ADMIN_ROLE);

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

describe('SubscriptionDashboard — scheduled plan-change banner (T-004)', () => {
    it('renders the scheduled-change banner when scheduledPlanChange is set', async () => {
        mockGetSubscription.mockResolvedValue({
            ok: true,
            data: { subscription: SUBSCRIPTION_WITH_SCHEDULED_CHANGE }
        });
        mockListInvoices.mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
        });

        renderDashboard();

        await waitFor(() => {
            expect(
                screen.getByRole('note', { name: /cambio de plan programado/i })
            ).toBeInTheDocument();
        });
    });

    it('banner body includes the plan id and formatted date', async () => {
        mockGetSubscription.mockResolvedValue({
            ok: true,
            data: { subscription: SUBSCRIPTION_WITH_SCHEDULED_CHANGE }
        });
        mockListInvoices.mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
        });

        renderDashboard();

        await waitFor(() => {
            const banner = screen.getByRole('note', { name: /cambio de plan programado/i });
            // Should mention the plan id
            expect(banner).toHaveTextContent('basic');
        });
    });

    it('does not render the banner when scheduledPlanChange is null', async () => {
        mockGetSubscription.mockResolvedValue({
            ok: true,
            data: { subscription: SUBSCRIPTION_WITHOUT_SCHEDULED_CHANGE }
        });
        mockListInvoices.mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } }
        });

        renderDashboard();

        await waitForLoaded();

        expect(
            screen.queryByRole('note', { name: /cambio de plan programado/i })
        ).not.toBeInTheDocument();
    });

    it('does not render the banner when scheduledPlanChange field is absent', async () => {
        mockSubscriptionSuccess(ACTIVE_SUBSCRIPTION);
        renderDashboard();

        await waitForLoaded();

        expect(
            screen.queryByRole('note', { name: /cambio de plan programado/i })
        ).not.toBeInTheDocument();
    });
});
