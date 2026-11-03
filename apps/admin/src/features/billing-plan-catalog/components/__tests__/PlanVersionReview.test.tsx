// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import type { AdminCatalogPlan } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
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
const confirmation = (
    changes = [
        { key: 'graceDays', kind: 'setting', from: 2, to: 5 },
        { key: 'max_accommodations', kind: 'limit', from: 8, to: 10 }
    ],
    anchoredCustomers = 3
) => ({
    planId: plan.planId,
    vertical: 'accommodation',
    role: null,
    sellable: true,
    currentVersionId: plan.currentVersion?.versionId ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    anchoredCustomers,
    changes,
    message: 'La versión afecta a clientes anclados.'
});
function renderForm() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PlanVersionForm
                plan={plan}
                onCancel={vi.fn()}
                onPublished={vi.fn()}
            />
        </QueryClientProvider>
    );
}
function setGrace(value: string) {
    fireEvent.change(screen.getByLabelText(es.planCatalogEditor.columns.graceDays), {
        target: { value }
    });
}
function reviewButton() {
    return screen.getByRole('button', { name: es.planCatalogEditor.form.review });
}

describe('TEST:1704:15 PlanVersionReview', () => {
    beforeEach(() => fetchApi.mockResolvedValue({ data: { data: confirmation() } }));
    it('sends the full content and renders key changes, reach and message', async () => {
        renderForm();
        setGrace('5');
        fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.form.addLimit }));
        const keySelect = screen
            .getAllByLabelText(es.planCatalogEditor.form.key)
            .at(-1) as HTMLSelectElement;
        fireEvent.change(keySelect, { target: { value: 'max_accommodations' } });
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.form.value), {
            target: { value: '10' }
        });
        fireEvent.click(reviewButton());
        const review = await screen.findByTestId(`plan-version-review-${plan.planId}`);
        expect(fetchApi.mock.calls[0][0]).toEqual({
            path: `/api/v1/admin/plan-catalog/plans/${plan.planId}/versions/preview`,
            method: 'POST',
            body: {
                rank: 4,
                sellable: true,
                trialDays: 14,
                graceDays: 5,
                allowsPause: true,
                inheritsTouristVip: false,
                entitlements: [{ key: 'publish_accommodations' }],
                limits: [{ key: 'max_accommodations', value: 10 }],
                cycles: ['monthly']
            }
        });
        expect(within(review).getByTestId('plan-change-setting-graceDays')).toHaveTextContent('2');
        expect(
            within(review).getByTestId('plan-change-limit-max_accommodations')
        ).toHaveTextContent('10');
        expect(within(review).getByText('Alcanza a 3 clientes anclados.')).toBeInTheDocument();
        expect(within(review).getByText(confirmation().message)).toBeInTheDocument();
    });
    it('uses singular reach and shows noChanges for an empty diff', async () => {
        fetchApi.mockResolvedValueOnce({ data: { data: confirmation([], 1) } });
        renderForm();
        fireEvent.click(reviewButton());
        const review = await screen.findByTestId(`plan-version-review-${plan.planId}`);
        expect(within(review).getByText('Alcanza a 1 cliente anclado.')).toBeInTheDocument();
        expect(within(review).getByText(es.planCatalogEditor.review.noChanges)).toBeInTheDocument();
    });
    it('rejects invalid grace values before making a request', async () => {
        renderForm();
        setGrace('');
        fireEvent.click(reviewButton());
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.invalid.split('{message}')[0]
        );
        expect(fetchApi).not.toHaveBeenCalled();
    });
    it('shows the literal server rejection and forbidden errors', async () => {
        fetchApi.mockRejectedValueOnce(
            new ApiError('gracia debe ser menor que el ciclo más corto', { status: 400 })
        );
        renderForm();
        fireEvent.click(reviewButton());
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'gracia debe ser menor que el ciclo más corto'
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.rejected.replace(
                '{message}',
                'gracia debe ser menor que el ciclo más corto'
            )
        );
    });
    it('shows forbidden for a 403 preview error', async () => {
        fetchApi.mockRejectedValueOnce(new ApiError('forbidden', { status: 403 }));
        renderForm();
        fireEvent.click(reviewButton());
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.forbidden
        );
    });
});
