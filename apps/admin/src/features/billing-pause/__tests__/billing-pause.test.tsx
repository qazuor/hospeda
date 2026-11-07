// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingPauseScreen } from '../components/BillingPauseScreen';
import { pausePreviewPath } from '../hooks/useBillingPause';

vi.mock('@tanstack/react-router', async (importOriginal) => importOriginal());
const fetchApi = vi.fn();
vi.mock('@/lib/api/client', () => ({ fetchApi: (...args: unknown[]) => fetchApi(...args) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            let value: unknown = es;
            for (const segment of key.replace('admin-billing.', '').split('.'))
                value =
                    typeof value === 'object' && value !== null
                        ? (value as Record<string, unknown>)[segment]
                        : undefined;
            return typeof value === 'string'
                ? Object.entries(params ?? {}).reduce(
                      (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
                      value
                  )
                : key;
        }
    })
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => [PermissionEnum.BILLING_PAUSE_SUBSCRIPTION]
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/components/layout/SidebarPageLayout', () => ({ SidebarPageLayout: () => null }));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const preview = {
    subscriptionId: id,
    status: 'ACTIVE',
    offered: true,
    months: { min: 1, max: 2 },
    expectedEndAtByMonths: { '1': '2026-12-07T03:00:00.000Z', '2': '2027-01-07T03:00:00.000Z' },
    addons: { vertical: ['Extra'], account: [{ name: 'Cuenta', pauses: true }] },
    quota: { pausesLeft: 2, monthsLeft: 4 },
    openPause: null
};
function view() {
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <BillingPauseScreen subscriptionId={id} />
        </QueryClientProvider>
    );
}
beforeEach(() => {
    fetchApi.mockReset();
});
describe('TEST:B8b:22 AC:B8b:22 panel pause screen and hook', () => {
    it('confirms the full pause effects and sends expectedStatus', async () => {
        fetchApi.mockResolvedValueOnce({ data: { data: preview } }).mockResolvedValueOnce({
            data: {
                data: { outcome: 'PAUSED', expectedEndAt: preview.expectedEndAtByMonths['1'] }
            }
        });
        view();
        await screen.findByText(`Cliente: ${id}`);
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPause.review }));
        const confirm = screen.getByTestId('billing-pause-confirmation');
        expect(confirm.textContent).toContain(`La suscripción de ${id} se pausa hasta el`);
        expect(confirm.textContent).toContain(es.subscriptionPause.listingEffect);
        expect(confirm.textContent).toContain(es.subscriptionPause.retentionEffect);
        expect(confirm.textContent).toContain(es.subscriptionPause.addonEffect);
        expect(confirm.textContent).toContain('Extra');
        expect(confirm.textContent).toContain('Cuenta');
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPause.confirm }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/billing-subscription/${id}/pause`,
                method: 'POST',
                body: { confirmed: true, expectedStatus: 'ACTIVE', months: 1 }
            })
        );
        expect(pausePreviewPath({ subscriptionId: id })).toBe(
            `/api/v1/admin/billing-subscription/${id}/pause-preview`
        );
    });
    it('confirms early resume and shows the charge date', async () => {
        fetchApi
            .mockResolvedValueOnce({
                data: {
                    data: {
                        ...preview,
                        status: 'PAUSED',
                        offered: false,
                        reason: 'ALREADY_PAUSED',
                        openPause: {
                            reason: 'CUSTOMER_REQUEST',
                            expectedEndAt: '2027-01-07T03:00:00.000Z'
                        }
                    }
                }
            })
            .mockResolvedValueOnce({
                data: {
                    data: {
                        outcome: 'RESUMED',
                        nextCharge: {
                            at: '2026-11-17T03:00:00.000Z',
                            amountMinor: 100,
                            currency: 'ARS'
                        }
                    }
                }
            });
        view();
        await screen.findByText(`Cliente: ${id}`);
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPause.review }));
        expect(screen.getByTestId('billing-pause-confirmation').textContent).toContain(
            `La suscripción de ${id} se reanuda hoy`
        );
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPause.confirm }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/billing-subscription/${id}/resume`,
                method: 'POST',
                body: { confirmed: true, expectedStatus: 'PAUSED' }
            })
        );
        expect(await screen.findByTestId('billing-pause-result')).toHaveTextContent('17/11/2026');
    });
    it('allows action 9 permission at the action 9 route', async () => {
        const { Route } = await import(
            '@/routes/_authed/billing/subscriptions/$subscriptionId.pause'
        );
        expect(
            (Route.options.beforeLoad as (input: unknown) => unknown)({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_PAUSE_SUBSCRIPTION
                    ]
                }
            })
        ).toBeUndefined();
    });
    it('rejects action 10 permission at the action 9 route', async () => {
        const { Route } = await import(
            '@/routes/_authed/billing/subscriptions/$subscriptionId.pause'
        );
        let error: unknown;
        try {
            (Route.options.beforeLoad as (input: unknown) => unknown)({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN
                    ]
                }
            });
        } catch (caught) {
            error = caught;
        }
        expect(isRedirect(error)).toBe(true);
        expect((error as { options?: { to?: string } }).options?.to).toBe('/auth/forbidden');
    });
});
