/**
 * Smoke tests for Billing module routes (14 pages).
 *
 * Verifies that each billing page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// ---------------------------------------------------------------------------
// The global @tanstack/react-router mock in setup.tsx already includes
// createFileRoute, useSearch, useParams, etc. No override needed here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Additional global mocks needed by billing pages
// ---------------------------------------------------------------------------

/** Mock @/hooks/use-toast (used by addons, exchange-rates, settings) */
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        addToast: vi.fn(),
        toast: vi.fn()
    })
}));

/** Mock @/components/ui/ToastProvider (used by webhook-events, invoices, etc.) */
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({
        addToast: vi.fn(),
        toast: vi.fn()
    }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

/** Mock @repo/billing (used by plans page for ALL_PLANS fallback) */
vi.mock('@repo/billing', () => ({
    ALL_PLANS: []
}));

/** Mock @repo/i18n (used by settings page for formatDate) */
vi.mock('@repo/i18n', () => ({
    formatDate: () => '01/01/2026'
}));

/** Mock @/lib/format-helpers (used by invoices, webhook-events, notification-logs) */
vi.mock('@/lib/format-helpers', () => ({
    formatArs: () => '$0',
    formatShortDate: () => '01/01',
    formatDateWithTime: () => '01/01 00:00',
    formatDateWithSeconds: () => '01/01 00:00:00'
}));

/** Mock @tanstack/react-form (used by settings page) */
vi.mock('@tanstack/react-form', () => ({
    useForm: () => ({
        Field: ({ children }: { children: (field: Record<string, unknown>) => React.ReactNode }) =>
            children({
                state: { value: '', meta: { errors: null } },
                handleChange: vi.fn(),
                handleBlur: vi.fn()
            }),
        handleSubmit: vi.fn(),
        reset: vi.fn(),
        setFieldValue: vi.fn(),
        state: { isDirty: false }
    })
}));

// ---------------------------------------------------------------------------
// Feature module mocks
// ---------------------------------------------------------------------------

vi.mock('@/features/billing-plans', () => ({
    usePlansQuery: () => ({
        data: { items: [], pagination: { total: 0 } },
        isLoading: false,
        error: null
    }),
    useTogglePlanActiveMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useDeletePlanMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useCreatePlanMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdatePlanMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    getPlanColumns: () => [],
    PlanDialog: () => <div data-testid="plan-dialog" />
}));

vi.mock('@/features/billing-addons', () => ({
    usePurchasedAddonsQuery: () => ({
        data: { items: [], pagination: { total: 0 } },
        isLoading: false,
        error: null
    }),
    useForceExpirePurchasedAddonMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useForceActivatePurchasedAddonMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    getPurchasedAddonColumns: () => [],
    PurchasedAddonDetailsDialog: () => <div data-testid="addon-details-dialog" />
}));

vi.mock('@/features/billing-subscriptions/hooks', () => ({
    useSubscriptionsQuery: () => ({ data: { items: [] }, isLoading: false, isError: false }),
    useCancelSubscriptionMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useChangePlanMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useExtendTrialMutation: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('@/features/billing-subscriptions/types', () => ({}));

vi.mock('@/features/billing-subscriptions/utils', () => ({
    getPlanBySlug: () => null
}));

vi.mock('@/features/billing-subscriptions/CancelSubscriptionDialog', () => ({
    CancelSubscriptionDialog: () => <div data-testid="cancel-sub-dialog" />
}));

vi.mock('@/features/billing-subscriptions/ChangePlanDialog', () => ({
    ChangePlanDialog: () => <div data-testid="change-plan-dialog" />
}));

vi.mock('@/features/billing-subscriptions/ExtendTrialDialog', () => ({
    ExtendTrialDialog: () => <div data-testid="extend-trial-dialog" />
}));

vi.mock('@/features/billing-subscriptions/SubscriptionDetailsDialog', () => ({
    SubscriptionDetailsDialog: () => <div data-testid="sub-details-dialog" />
}));

vi.mock('@/features/billing-subscriptions/SubscriptionFilters', () => ({
    SubscriptionFilters: () => <div data-testid="sub-filters" />
}));

vi.mock('@/features/billing-subscriptions/SubscriptionsTable', () => ({
    SubscriptionsTable: () => <div data-testid="sub-table" />
}));

vi.mock('@/features/billing-invoices/hooks', () => ({
    useInvoicesQuery: () => ({ data: { items: [] }, isLoading: false, isError: false }),
    usePayInvoiceMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useVoidInvoiceMutation: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('@/features/billing-payments/hooks', () => ({
    usePaymentsQuery: () => ({ data: { items: [] }, isLoading: false, isError: false }),
    useRefundPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock('@/features/billing-payments/PaymentDetailDialog', () => ({
    PaymentDetailDialog: () => <div data-testid="payment-detail-dialog" />
}));

vi.mock('@/features/billing-payments/PaymentFilters', () => ({
    PaymentFilters: () => <div data-testid="payment-filters" />
}));

vi.mock('@/features/billing-payments/PaymentsTable', () => ({
    PaymentsTable: () => <div data-testid="payments-table" />
}));

vi.mock('@/features/billing-payments/RefundDialog', () => ({
    RefundDialog: () => <div data-testid="refund-dialog" />
}));

vi.mock('@/features/billing-payments/types', () => ({}));

vi.mock('@/features/promo-codes', () => ({
    usePromoCodesQuery: () => ({
        data: { items: [], pagination: { total: 0 } },
        isLoading: false,
        error: null
    }),
    useCreatePromoCodeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdatePromoCodeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeletePromoCodeMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useTogglePromoCodeActiveMutation: () => ({ mutate: vi.fn(), isPending: false }),
    getPromoCodeColumns: () => []
}));

vi.mock('@/features/owner-promotions/hooks', () => ({
    useOwnerPromotionsQuery: () => ({
        data: { items: [], pagination: { total: 0 } },
        isLoading: false,
        error: null
    }),
    useDeleteOwnerPromotionMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useTogglePromotionActiveMutation: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('@/features/owner-promotions/types', () => ({}));

vi.mock('@/features/billing-webhook-events', () => ({
    useWebhookEventsQuery: () => ({ data: [], isLoading: false, isError: false }),
    useDeadLetterEventsQuery: () => ({ data: [], isLoading: false, isError: false }),
    useRetryWebhookEventMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

vi.mock('@/features/billing-notification-logs', () => ({
    useNotificationLogsQuery: () => ({ data: [], isLoading: false, isError: false })
}));

vi.mock('@/features/exchange-rates', () => ({
    useExchangeRatesQuery: () => ({ data: [], isLoading: false, error: null }),
    useExchangeRateConfigQuery: () => ({ data: null }),
    useCreateManualOverrideMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteManualOverrideMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useTriggerFetchNowMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateConfigMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    getExchangeRateColumns: () => [],
    ManualOverrideDialog: () => <div data-testid="manual-override-dialog" />,
    RateHistoryView: () => <div data-testid="rate-history-view" />,
    FetchConfigForm: () => <div data-testid="fetch-config-form" />
}));

vi.mock('@/features/billing-metrics', () => ({
    useSystemUsageStatsQuery: () => ({ data: null, isLoading: false, error: null }),
    useApproachingLimitsQuery: () => ({ data: null, isLoading: false, error: null }),
    useCustomerSearchQuery: () => ({ data: null, isLoading: false, error: null }),
    useCustomerUsageQuery: () => ({ data: null, isLoading: false, error: null }),
    SystemStatsCards: () => <div data-testid="system-stats-cards" />,
    ApproachingLimitsTable: () => <div data-testid="approaching-limits-table" />,
    UsageDisplay: () => <div data-testid="usage-display" />
}));

vi.mock('@/features/cron-jobs', () => ({
    CronJobsPanel: () => <div data-testid="cron-jobs-panel" />
}));

vi.mock('@/features/billing-settings', () => ({
    useBillingSettingsQuery: () => ({ data: null, isLoading: false, error: null }),
    useUpdateBillingSettingsMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

// ---------------------------------------------------------------------------
// Layout & UI component mocks
// ---------------------------------------------------------------------------

/** Mock SidebarPageLayout to avoid pulling in the full sidebar tree */
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="sidebar-page-layout">{children}</div>
    )
}));

/** Mock DataTable to avoid complex table rendering */
vi.mock('@/components/table/DataTable', () => ({
    DataTable: () => <div data-testid="data-table" />,
    ColumnType: {},
    BadgeColor: {}
}));

vi.mock('@/components/ui/alert-dialog', () => ({
    AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogAction: ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
    ),
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => <span />
}));

// ---------------------------------------------------------------------------
// Route sub-component mocks (imported from ./components/ in route files)
// ---------------------------------------------------------------------------

vi.mock('@/features/billing-invoices/components/InvoiceDetailDialog', () => ({
    InvoiceDetailDialog: () => <div data-testid="invoice-detail-dialog" />,
    getStatusLabel: () => 'status',
    getStatusVariant: () => 'default'
}));

vi.mock('@/features/billing-notification-logs/components/NotificationDetailDialog', () => ({
    NotificationDetailDialog: () => <div data-testid="notification-detail-dialog" />,
    getChannelLabel: () => 'channel',
    getStatusLabel: () => 'status',
    getStatusVariant: () => 'default',
    getTypeLabel: () => 'type'
}));

vi.mock('@/features/promo-codes/components/PromoCodeDeleteDialog', () => ({
    PromoCodeDeleteDialog: () => <div data-testid="promo-code-delete-dialog" />
}));

vi.mock('@/features/owner-promotions/components/PromotionDetailDialog', () => ({
    PromotionDetailDialog: () => <div data-testid="promotion-detail-dialog" />
}));

vi.mock('@/features/owner-promotions/components/PromotionFormDialog', () => ({
    PromotionFormDialog: () => <div data-testid="promotion-form-dialog" />
}));

vi.mock('@/features/sponsorships/components/SponsorshipsTab', () => ({
    SponsorshipsTab: () => <div data-testid="sponsorships-tab" />
}));

vi.mock('@/features/sponsorships/components/SponsorshipLevelsTab', () => ({
    SponsorshipLevelsTab: () => <div data-testid="sponsorship-levels-tab" />
}));

vi.mock('@/features/sponsorships/components/SponsorshipPackagesTab', () => ({
    SponsorshipPackagesTab: () => <div data-testid="sponsorship-packages-tab" />
}));

vi.mock('@/features/billing-webhook-events/components/WebhookEventDetailDialog', () => ({
    WebhookEventDetailDialog: () => <div data-testid="webhook-event-detail-dialog" />,
    getStatusLabel: () => 'status',
    getStatusVariant: () => 'default',
    getTypeLabel: () => 'type'
}));

// ---------------------------------------------------------------------------
// Import route modules AFTER mocks are set up
// ---------------------------------------------------------------------------

import { Route as AddonsRoute } from '@/routes/_authed/billing/addons';
import { Route as CronRoute } from '@/routes/_authed/billing/cron';
import { Route as ExchangeRatesRoute } from '@/routes/_authed/billing/exchange-rates';
import { Route as InvoicesRoute } from '@/routes/_authed/billing/invoices';
import { Route as MetricsRoute } from '@/routes/_authed/billing/metrics';
import { Route as NotificationLogsRoute } from '@/routes/_authed/billing/notification-logs';
import { Route as OwnerPromotionsRoute } from '@/routes/_authed/billing/owner-promotions';
import { Route as PaymentsRoute } from '@/routes/_authed/billing/payments';
import { Route as PlansRoute } from '@/routes/_authed/billing/plans';
import { Route as PromoCodesRoute } from '@/routes/_authed/billing/promo-codes';
import { Route as SettingsRoute } from '@/routes/_authed/billing/settings';
import { Route as SponsorshipsRoute } from '@/routes/_authed/billing/sponsorships';
import { Route as SubscriptionsRoute } from '@/routes/_authed/billing/subscriptions';
import { Route as WebhookEventsRoute } from '@/routes/_authed/billing/webhook-events';

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe('Billing Module Smoke Tests', () => {
    it('renders billing/plans page without crashing', async () => {
        const Page = PlansRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/addons page without crashing', async () => {
        const Page = AddonsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/subscriptions page without crashing', async () => {
        const Page = SubscriptionsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/invoices page without crashing', async () => {
        const Page = InvoicesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/payments page without crashing', async () => {
        const Page = PaymentsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/promo-codes page without crashing', async () => {
        const Page = PromoCodesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/owner-promotions page without crashing', async () => {
        const Page = OwnerPromotionsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/sponsorships page without crashing', async () => {
        const Page = SponsorshipsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/webhook-events page without crashing', async () => {
        const Page = WebhookEventsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/notification-logs page without crashing', async () => {
        const Page = NotificationLogsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/exchange-rates page without crashing', async () => {
        const Page = ExchangeRatesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/metrics page without crashing', async () => {
        const Page = MetricsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/cron page without crashing', async () => {
        const Page = CronRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders billing/settings page without crashing', async () => {
        const Page = SettingsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });
});
