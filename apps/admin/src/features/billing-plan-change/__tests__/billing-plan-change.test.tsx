// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import billingEs from '@repo/i18n/locales/es/billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRedirect } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
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
            let value: unknown = key.startsWith('billing.') ? billingEs : es;
            const translationKey = key.startsWith('billing.')
                ? key.replace('billing.', '')
                : key.replace('admin-billing.', '');
            for (const segment of translationKey.split('.'))
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
    currentPlan: { planName: 'Professional', planSlug: 'owner-pro', cycle: 'monthly' }
};
const option = (
    billingOptionId: string,
    planName: string,
    current: boolean,
    planSlug = 'owner-pro',
    amountMinor = 10000,
    direction: 'UP' | 'DOWN' = 'DOWN'
) => ({
    billingOptionId,
    planId: crypto.randomUUID(),
    planVersionId: crypto.randomUUID(),
    planName,
    planSlug,
    cycle: 'monthly',
    amountMinor,
    currency: 'ARS',
    current,
    direction: current ? 'NONE' : direction
});
function setup(result: object, optionsError?: Error, targetDirection: 'UP' | 'DOWN' = 'DOWN') {
    fetchApi.mockImplementation(({ method, path }: { method?: string; path: string }) => {
        if (method === 'POST') return Promise.resolve({ data: { data: result } });
        if (path === planChangeOptionsPath(id) && optionsError) return Promise.reject(optionsError);
        if (path === planChangeOptionsPath(id))
            return Promise.resolve({
                data: {
                    data: {
                        subscriptionId: id,
                        vertical: 'accommodation',
                        nextChargeAt: '2026-12-01T03:00:00.000Z',
                        currentCycle: 'monthly',
                        options: [
                            option(currentId, 'Professional', true, 'owner-pro'),
                            option(targetId, 'Basic', false, 'owner-basico', 20000, targetDirection)
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
    it('translates plans and cycle and previews date and next charge before confirming', async () => {
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
        expect(
            screen.getByText(es.subscriptionPlanChange.current.replace('{plan}', 'Profesional'))
        ).toBeTruthy();
        expect(screen.getByTestId('billing-plan-change-screen').textContent).not.toContain(
            'Professional'
        );
        expect(select.textContent).toContain('Básico · Mensual');
        expect(select.textContent).not.toContain('Basic');
        expect(select.options).toHaveLength(2);
        expect(Array.from(select.options, (option) => option.value)).toEqual(['', targetId]);
        fireEvent.change(select, { target: { value: targetId } });
        fireEvent.change(screen.getByLabelText(es.subscriptionPlanChange.note), {
            target: { value: 'Cliente aceptó' }
        });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.review }));
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            'Cliente Uno: de Profesional a Básico'
        );
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            '01/12/2026'
        );
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            'Próximo cobro:'
        );
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            new Intl.NumberFormat('es', { style: 'currency', currency: 'ARS' }).format(200)
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

    it('shows when a plan change needs a new checkout', async () => {
        setup(
            { outcome: 'SUCCESSION', checkoutUrl: 'https://example.test/checkout' },
            undefined,
            'UP'
        );
        await screen.findByText('Cliente: Cliente Uno');
        fireEvent.change(screen.getByLabelText(es.subscriptionPlanChange.destination), {
            target: { value: targetId }
        });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.review }));
        expect(screen.getByTestId('billing-plan-change-confirmation').textContent).toContain(
            es.subscriptionPlanChange.previewNeedsCheckout
        );
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
    it('explains that Partner plan changes require revocation and reconfiguration', async () => {
        setup(
            { outcome: 'REGRET', amountMinor: 0 },
            new ApiError('Partner plan changes are not supported.', {
                status: 422,
                code: 'VALIDATION_ERROR',
                body: {
                    error: { details: { reason: 'PARTNER_PLAN_CHANGE_UNSUPPORTED' } }
                }
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.subscriptionPlanChange.partnerUnsupported
        );
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

describe('HOS-2238 admin plan change refusals', () => {
    async function confirmChange(postError: unknown) {
        setup({});
        const post = fetchApi.getMockImplementation();
        fetchApi.mockImplementation((input: { method?: string; path: string }) =>
            input.method === 'POST' ? Promise.reject(postError) : post?.(input)
        );
        await screen.findByText('Cliente: Cliente Uno');
        fireEvent.change(screen.getByLabelText(es.subscriptionPlanChange.destination), {
            target: { value: targetId }
        });
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.review }));
        fireEvent.click(screen.getByRole('button', { name: es.subscriptionPlanChange.confirm }));
    }

    it('explains a subscription without a declared payer email instead of the generic error', async () => {
        await confirmChange(
            new ApiError('Unprocessable', {
                status: 422,
                body: {
                    error: {
                        code: 'VALIDATION_ERROR',
                        reason: 'PAYER_EMAIL_UNDECLARED',
                        details: { reason: 'PAYER_EMAIL_UNDECLARED' }
                    }
                }
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.subscriptionPlanChange.payerEmailUndeclared
        );
    });

    it('keeps the generic error for any other refusal', async () => {
        await confirmChange(new ApiError('Conflict', { status: 409, body: { error: {} } }));
        expect(await screen.findByRole('alert')).toHaveTextContent(es.subscriptionPlanChange.error);
    });
});
