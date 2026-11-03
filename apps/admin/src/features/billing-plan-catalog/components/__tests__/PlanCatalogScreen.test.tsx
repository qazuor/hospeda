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
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string, values?: Record<string, unknown>) => {
            const value =
                key
                    .split('.')
                    .slice(1)
                    .reduce((node: any, part) => node?.[part], es) ?? key;
            return Object.entries(values ?? {}).reduce(
                (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
                value
            );
        },
        tPlural: (key: string, count: number) => {
            const parts = key.split('.').slice(1);
            const leaf = parts.pop();
            const parent = parts.reduce((node: any, part) => node?.[part], es);
            return (
                parent?.[`${leaf}_${count === 1 ? 'one' : 'other'}`]?.replaceAll(
                    '{{count}}',
                    String(count)
                ) ?? key
            );
        }
    })
}));

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
