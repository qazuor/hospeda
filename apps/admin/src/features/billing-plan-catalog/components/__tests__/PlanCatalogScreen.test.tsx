// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCatalogScreen } from '../PlanCatalogScreen';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => ['MAINTENANCE_MODE_WRITE']
}));
vi.mock('@/hooks/use-translations', async () => {
    const { createTranslationMock } = await import('./translation-mock');
    return { useTranslations: createTranslationMock };
});

const withVersion = {
    planId: '11111111-1111-4111-8111-111111111111',
    slug: 'basic',
    name: 'Básico',
    description: null,
    pricingOrder: 1,
    role: null,
    currentVersion: {
        versionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        rank: 2,
        sellable: true,
        trialDays: 7,
        graceDays: 2,
        allowsPause: false,
        inheritsTouristVip: true,
        entitlements: [{ key: 'publish_accommodations' }],
        limits: [{ key: 'max_accommodations', value: 5 }],
        cycles: ['monthly']
    }
} as const;
const withoutVersion = {
    planId: '22222222-2222-4222-8222-222222222222',
    slug: 'trial',
    name: 'Prueba',
    description: null,
    pricingOrder: 2,
    role: 'trial',
    currentVersion: null
} as const;
function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PlanCatalogScreen />
        </QueryClientProvider>
    );
}

describe('TEST:1704:13 PlanCatalogScreen', () => {
    beforeEach(() =>
        fetchApi.mockResolvedValue({
            data: { data: { vertical: 'accommodation', plans: [withVersion, withoutVersion] } }
        })
    );
    it('renders current version fields and a plan without a version in ordered rows', async () => {
        renderScreen();
        expect(await screen.findByTestId('plan-catalog-table')).toBeInTheDocument();
        const first = await screen.findByTestId(`plan-row-${withVersion.planId}`);
        const second = screen.getByTestId(`plan-row-${withoutVersion.planId}`);
        expect(first).toHaveTextContent('Básico');
        for (const value of ['Vendible (sin rol)', '2', 'Sí', '7', '2', 'No', '1', '1', 'Mensual'])
            expect(within(first).getAllByText(value).length).toBeGreaterThan(0);
        expect(within(second).getAllByText('Prueba')).toHaveLength(2);
        expect(
            within(second).getAllByText(es.planCatalogEditor.noCurrentVersion).length
        ).toBeGreaterThan(0);
    });
    it('offers the cycle price action for a published plan version', async () => {
        renderScreen();
        const row = await screen.findByTestId(`plan-row-${withVersion.planId}`);
        expect(
            within(row).getByRole('button', { name: 'Cambiar precio del ciclo' })
        ).toBeInTheDocument();
    });
    it('previews and explicitly confirms a cycle price in integer centavos', async () => {
        fetchApi.mockImplementation(async (input: { path?: string } = {}) => {
            if (input.path?.endsWith('/preview') && input.path?.includes('billing-prices')) {
                return {
                    data: {
                        data: {
                            planVersionId: withVersion.currentVersion.versionId,
                            cycle: 'monthly',
                            currency: 'ARS',
                            previousAmount: 10000,
                            newAmount: 12500,
                            graceDays: 2,
                            customersReached: 0,
                            effectiveFrom: 'ON_CONFIRMATION',
                            message: 'Review'
                        }
                    }
                };
            }
            if (input.path === '/api/v1/admin/billing-prices') {
                return {
                    data: {
                        data: {
                            billingOption: {
                                id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                                planVersionId: withVersion.currentVersion.versionId,
                                cycle: 'monthly',
                                amount: 12500,
                                currency: 'ARS'
                            },
                            previousAmount: 10000,
                            newAmount: 12500,
                            domainEventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
                        }
                    }
                };
            }
            return {
                data: { data: { vertical: 'accommodation', plans: [withVersion, withoutVersion] } }
            };
        });
        renderScreen();
        const row = await screen.findByTestId(`plan-row-${withVersion.planId}`);
        fireEvent.click(
            within(row).getByRole('button', { name: es.planCatalogEditor.cyclePrice.action })
        );
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.cyclePrice.amount), {
            target: { value: '12500' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.cyclePrice.preview })
        );
        expect(await screen.findByTestId('cycle-price-preview')).toHaveTextContent(
            '10000 centavos ARS'
        );
        expect(screen.getByTestId('cycle-price-preview')).toHaveTextContent('12500 centavos ARS');
        const confirm = screen.getByRole('button', {
            name: es.planCatalogEditor.cyclePrice.confirm
        });
        expect(confirm).toBeDisabled();
        fireEvent.click(
            screen.getByLabelText(es.planCatalogEditor.cyclePrice.explicitConfirmation)
        );
        fireEvent.click(confirm);
        await screen.findByTestId(`plan-row-${withVersion.planId}`);
        const call = fetchApi.mock.calls.find(
            ([input]) => input.path === '/api/v1/admin/billing-prices'
        );
        expect(call?.[0]).toMatchObject({
            method: 'POST',
            body: {
                planVersionId: withVersion.currentVersion.versionId,
                cycle: 'monthly',
                amount: 12500,
                expectedPreviousAmount: 10000,
                confirmed: true
            }
        });
    });
    it('explains a customer conflict and links to plan migration', async () => {
        fetchApi.mockImplementation(async (input: { path?: string } = {}) => {
            if (input.path?.endsWith('/preview') && input.path?.includes('billing-prices')) {
                throw new (await import('@/lib/errors/api-error')).ApiError('Conflict', {
                    status: 409,
                    body: { error: { reason: 'PLAN_VERSION_HAS_CUSTOMERS' } }
                });
            }
            return {
                data: { data: { vertical: 'accommodation', plans: [withVersion, withoutVersion] } }
            };
        });
        renderScreen();
        const row = await screen.findByTestId(`plan-row-${withVersion.planId}`);
        fireEvent.click(
            within(row).getByRole('button', { name: es.planCatalogEditor.cyclePrice.action })
        );
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.cyclePrice.amount), {
            target: { value: '12500' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.cyclePrice.preview })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.cyclePrice.errors.hasCustomers
        );
        expect(
            screen.getByRole('link', { name: es.planCatalogEditor.cyclePrice.migrationLink })
        ).toHaveAttribute('href', '/billing/plan-migration');
    });
    it('explains when the cycle price changed after preview and links to migration', async () => {
        fetchApi.mockImplementation(async (input: { path?: string } = {}) => {
            if (input.path === '/api/v1/admin/billing-prices') {
                throw new (await import('@/lib/errors/api-error')).ApiError('Conflict', {
                    status: 409,
                    body: { error: { reason: 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW' } }
                });
            }
            if (input.path?.endsWith('/preview') && input.path?.includes('billing-prices')) {
                return {
                    data: {
                        data: {
                            planVersionId: withVersion.currentVersion.versionId,
                            cycle: 'monthly',
                            currency: 'ARS',
                            previousAmount: 10000,
                            newAmount: 12500,
                            graceDays: 2,
                            customersReached: 0,
                            effectiveFrom: 'ON_CONFIRMATION',
                            message: 'Review'
                        }
                    }
                };
            }
            return {
                data: { data: { vertical: 'accommodation', plans: [withVersion, withoutVersion] } }
            };
        });
        renderScreen();
        const row = await screen.findByTestId(`plan-row-${withVersion.planId}`);
        fireEvent.click(
            within(row).getByRole('button', { name: es.planCatalogEditor.cyclePrice.action })
        );
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.cyclePrice.amount), {
            target: { value: '12500' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.cyclePrice.preview })
        );
        const confirmation = await screen.findByTestId('cycle-price-preview');
        fireEvent.click(
            within(confirmation).getByLabelText(
                es.planCatalogEditor.cyclePrice.explicitConfirmation
            )
        );
        fireEvent.click(
            within(confirmation).getByRole('button', {
                name: es.planCatalogEditor.cyclePrice.confirm
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.cyclePrice.errors.changedSincePreview
        );
        expect(
            screen.getByRole('link', { name: es.planCatalogEditor.cyclePrice.migrationLink })
        ).toHaveAttribute('href', '/billing/plan-migration');
    });
    it('requests the selected vertical with the exact API call', async () => {
        renderScreen();
        await screen.findByTestId(`plan-row-${withVersion.planId}`);
        fireEvent.change(screen.getByTestId('plan-catalog-vertical'), {
            target: { value: 'venue' }
        });
        await screen.findByTestId(`plan-row-${withVersion.planId}`);
        expect(fetchApi.mock.calls[1][0]).toEqual({
            path: '/api/v1/admin/plan-catalog/plans?vertical=venue'
        });
    });
    it('shows the empty state and a load alert', async () => {
        fetchApi.mockResolvedValueOnce({
            data: { data: { vertical: 'accommodation', plans: [] } }
        });
        renderScreen();
        expect(await screen.findByText(es.planCatalogEditor.empty)).toBeInTheDocument();
        fetchApi.mockRejectedValueOnce(new Error('network'));
        fireEvent.change(screen.getByTestId('plan-catalog-vertical'), {
            target: { value: 'venue' }
        });
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.load
        );
    });
});
