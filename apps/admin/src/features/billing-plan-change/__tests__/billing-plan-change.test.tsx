// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingPlanChangeScreen } from '../components/BillingPlanChangeScreen';
import { planChangeOptionsPath } from '../hooks/useBillingPlanChange';

const fetchApi = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => importOriginal());
let permissions: PermissionEnum[] = [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN];
vi.mock('@/lib/api/client', () => ({ fetchApi: (...args: unknown[]) => fetchApi(...args) }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => permissions }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
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
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const currentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const targetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const inspection = {
    status: 'ACTIVE',
    billingOptionId: currentId,
    subject: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', displayName: 'Cliente Uno' },
    currentPlan: { planName: 'Plan Base', cycle: 'monthly' }
};
const option = (billingOptionId: string, planName: string, current: boolean) => ({
    billingOptionId,
    planId: crypto.randomUUID(),
    planVersionId: crypto.randomUUID(),
    planName,
    cycle: 'monthly',
    amountMinor: 10000,
    currency: 'ARS',
    current
});
function setup(result: object) {
    fetchApi.mockImplementation(({ method, path }: { method?: string; path: string }) => {
        if (method === 'POST') return Promise.resolve({ data: { data: result } });
        if (path === planChangeOptionsPath(id))
            return Promise.resolve({
                data: {
                    data: {
                        subscriptionId: id,
                        vertical: 'accommodation',
                        options: [
                            option(currentId, 'Plan Base', true),
                            option(targetId, 'Plan Plus', false)
                        ]
                    }
                }
            });
        return Promise.resolve({ data: { data: inspection } });
    });
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <BillingPlanChangeScreen subscriptionId={id} />
        </QueryClientProvider>
    );
}
beforeEach(() => {
    fetchApi.mockReset();
    permissions = [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN];
});
describe('ACC_10 admin plan change screen', () => {
    it('omits the current option and confirms customer, plans, path and body', async () => {
        setup({
            outcome: 'SUCCESSION',
            checkoutUrl: 'https://example.test/checkout',
            firstChargeAt: '2026-12-01T00:00:00.000Z',
            creditDays: 4
        });
        await screen.findByText('Cliente: Cliente Uno');
        const select = screen.getByLabelText(
            es.subscriptionPlanChange.destination
        ) as HTMLSelectElement;
        expect(select.options).toHaveLength(2);
        expect(Array.from(select.options, (option) => option.value)).toEqual(['', targetId]);
        fireEvent.change(select, { target: { value: targetId } });
        fireEvent.change(screen.getByLabelText(es.subscriptionPlanChange.note), {
            target: { value: 'Cliente aceptó' }
        });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.review }));
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            'Cliente Uno: de Plan Base a Plan Plus'
        );
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.confirm }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/billing-subscription/${id}/plan-change`,
                method: 'POST',
                body: {
                    billingOptionId: targetId,
                    expectedStatus: 'ACTIVE',
                    confirmed: true,
                    note: 'Cliente aceptó'
                }
            })
        );
        expect(screen.getByTestId('billing-plan-change-SUCCESSION').textContent).toContain(
            'El plan actual sigue hasta que el cliente autorice'
        );
        expect(
            (screen.getByLabelText(es.subscriptionPlanChange.checkoutLabel) as HTMLInputElement)
                .value
        ).toBe('https://example.test/checkout');
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.copy }));
        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith('https://example.test/checkout')
        );
        expect(screen.getByTestId('billing-plan-change-SUCCESSION').textContent).toContain('4');
    });
    it.each([
        [
            {
                outcome: 'DOWNGRADE',
                effectiveAt: '2026-12-01T00:00:00.000Z',
                amountMinor: 0,
                surplus: { applicable: false }
            },
            'DOWNGRADE',
            'se aplicará'
        ],
        [{ outcome: 'REGRET', amountMinor: 1000 }, 'REGRET', 'revirtió']
    ])('shows %s outcome', async (result, outcome, message) => {
        setup(result);
        await screen.findByText('Cliente: Cliente Uno');
        fireEvent.change(screen.getByLabelText(es.subscriptionPlanChange.destination), {
            target: { value: targetId }
        });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.review }));
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.confirm }));
        expect((await screen.findByTestId(`billing-plan-change-${outcome}`)).textContent).toContain(
            message
        );
    });
    it('gates the screen with the action permission', () => {
        permissions = [];
        setup({ outcome: 'REGRET', amountMinor: 0 });
        expect(screen.queryByTestId('billing-plan-change-screen')).toBeNull();
    });
    it('requires the action 10 permission in beforeLoad', async () => {
        const { Route } = await import(
            '@/routes/_authed/billing/subscriptions/$subscriptionId.plan-change'
        );
        const beforeLoad = Route.options.beforeLoad as (input: unknown) => unknown;
        expect(
            beforeLoad({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN
                    ]
                }
            })
        ).toBeUndefined();
        let error: unknown;
        try {
            beforeLoad({
                context: {
                    permissions: [
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.BILLING_PAUSE_SUBSCRIPTION
                    ]
                }
            });
        } catch (caught) {
            error = caught;
        }
        expect(isRedirect(error)).toBe(true);
    });
});
