// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import type { AdminCatalogPlan } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { PlanCatalogScreen } from '../PlanCatalogScreen';
import { PlanVersionForm } from '../PlanVersionForm';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => ['MAINTENANCE_MODE_WRITE']
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string, values?: Record<string, unknown>) => {
            const text =
                key
                    .split('.')
                    .slice(1)
                    .reduce((node: any, part) => node?.[part], es) ?? key;
            return Object.entries(values ?? {}).reduce(
                (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
                text
            );
        },
        tPlural: (key: string, count: number) => {
            const parts = key.split('.').slice(1);
            const leaf = parts.pop();
            const parent = parts.reduce((node: any, part) => node?.[part], es);
            return (parent?.[`${leaf}_${count === 1 ? 'one' : 'other'}`] ?? key).replaceAll(
                '{{count}}',
                String(count)
            );
        }
    })
}));
const plan: AdminCatalogPlan = {
    planId: '11111111-1111-4111-8111-111111111111',
    slug: 'plus',
    name: 'Plus',
    description: null,
    pricingOrder: 1,
    role: null,
    currentVersion: {
        versionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        rank: 4,
        sellable: true,
        trialDays: 14,
        graceDays: 2,
        allowsPause: true,
        inheritsTouristVip: false,
        cycles: ['monthly'],
        entitlements: [{ key: 'publish_accommodations' }],
        limits: []
    }
} as const;
const preview = {
    planId: plan.planId,
    vertical: 'accommodation',
    role: null,
    sellable: true,
    currentVersionId: plan.currentVersion?.versionId ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    anchoredCustomers: 1,
    changes: [],
    message: 'Sin cambios.'
};
const published = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    planId: plan.planId,
    vertical: 'accommodation',
    rank: 4,
    sellable: true,
    current: true,
    trialDays: 14,
    graceDays: 2,
    allowsPause: true,
    inheritsTouristVip: false,
    createdAt: '2026-01-01T00:00:00.000Z'
};
function renderNode(node: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('TEST:1704:16 PlanVersionPublish', () => {
    beforeEach(() => {
        fetchApi.mockImplementation(({ path }: { path: string }) => {
            if (path.endsWith('/preview')) return Promise.resolve({ data: { data: preview } });
            if (path.endsWith('/versions')) return Promise.resolve({ data: { data: published } });
            return Promise.resolve({
                data: { data: { vertical: 'accommodation', plans: [plan] } }
            });
        });
    });
    it('publishes the reviewed content with confirmed and refreshes the catalog', async () => {
        renderNode(<PlanCatalogScreen />);
        await screen.findByTestId(`plan-row-${plan.planId}`);
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.actions.publish }));
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.form.review }));
        await screen.findByTestId(`plan-version-review-${plan.planId}`);
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.review.confirm }));
        expect(await screen.findByRole('status')).toHaveTextContent(
            es.planCatalogEditor.published.replace('{id}', published.id)
        );
        expect(fetchApi.mock.calls[1][0]).toEqual({
            path: `/api/v1/admin/plan-catalog/plans/${plan.planId}/versions/preview`,
            method: 'POST',
            body: {
                rank: 4,
                sellable: true,
                trialDays: 14,
                graceDays: 2,
                allowsPause: true,
                inheritsTouristVip: false,
                entitlements: [{ key: 'publish_accommodations' }],
                limits: [],
                cycles: ['monthly']
            }
        });
        expect(fetchApi.mock.calls[2][0]).toEqual({
            path: `/api/v1/admin/plan-catalog/plans/${plan.planId}/versions`,
            method: 'POST',
            body: {
                rank: 4,
                sellable: true,
                trialDays: 14,
                graceDays: 2,
                allowsPause: true,
                inheritsTouristVip: false,
                entitlements: [{ key: 'publish_accommodations' }],
                limits: [],
                cycles: ['monthly'],
                confirmed: true
            }
        });
        expect(
            fetchApi.mock.calls.filter(
                ([request]) =>
                    request.path === '/api/v1/admin/plan-catalog/plans?vertical=accommodation'
            )
        ).toHaveLength(2);
    });
    it('returns to the draft without losing edits', async () => {
        renderNode(
            <PlanVersionForm
                plan={plan}
                onCancel={vi.fn()}
                onPublished={vi.fn()}
            />
        );
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.columns.graceDays), {
            target: { value: '6' }
        });
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.form.review }));
        await screen.findByTestId(`plan-version-review-${plan.planId}`);
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.review.back }));
        expect(screen.getByLabelText(es.planCatalogEditor.columns.graceDays)).toHaveValue(6);
    });
    it('shows a publish rejection after one request and does not retry', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            path.endsWith('/preview')
                ? Promise.resolve({ data: { data: preview } })
                : Promise.reject(
                      new ApiError(
                          'rank repetido entre las versiones vendibles y vigentes de la vertical',
                          { status: 400 }
                      )
                  )
        );
        renderNode(
            <PlanVersionForm
                plan={plan}
                onCancel={vi.fn()}
                onPublished={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.form.review }));
        await screen.findByTestId(`plan-version-review-${plan.planId}`);
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.review.confirm }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'rank repetido entre las versiones vendibles y vigentes de la vertical'
        );
        expect(
            fetchApi.mock.calls.filter(([request]) => request.path.endsWith('/versions'))
        ).toHaveLength(1);
    });
});
