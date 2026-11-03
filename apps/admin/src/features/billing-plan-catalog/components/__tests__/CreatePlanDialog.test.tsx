// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
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
function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PlanCatalogScreen />
        </QueryClientProvider>
    );
}
function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: es.planCatalogEditor.actions.createPlan }));
}
function fillPlan({ role = '', slug = 'new-plan' } = {}) {
    fireEvent.change(screen.getByLabelText(es.planCatalogEditor.createPlan.slug), {
        target: { value: slug }
    });
    fireEvent.change(screen.getByLabelText(es.planCatalogEditor.createPlan.name), {
        target: { value: 'Nuevo plan' }
    });
    if (role)
        fireEvent.change(screen.getByLabelText(es.planCatalogEditor.createPlan.role), {
            target: { value: role }
        });
}

describe('TEST:1704:17 CreatePlanDialog', () => {
    beforeEach(() =>
        fetchApi.mockResolvedValue({ data: { data: { vertical: 'accommodation', plans: [] } } })
    );
    it('sends the selected vertical without empty optional fields and announces creation', async () => {
        renderScreen();
        await screen.findByText(es.planCatalogEditor.empty);
        openDialog();
        fillPlan();
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.createPlan.submit })
        );
        expect(await screen.findByRole('status')).toHaveTextContent(
            es.planCatalogEditor.createPlan.created
        );
        expect(fetchApi.mock.calls[1][0]).toEqual({
            path: '/api/v1/admin/plan-catalog/plans',
            method: 'POST',
            body: { vertical: 'accommodation', slug: 'new-plan', name: 'Nuevo plan' }
        });
    });
    it('includes an explicit floor role', async () => {
        renderScreen();
        await screen.findByText(es.planCatalogEditor.empty);
        openDialog();
        fillPlan({ role: 'floor' });
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.createPlan.submit })
        );
        await screen.findByRole('status');
        expect(fetchApi.mock.calls.find(([request]) => request.method === 'POST')?.[0]).toEqual({
            path: '/api/v1/admin/plan-catalog/plans',
            method: 'POST',
            body: { vertical: 'accommodation', slug: 'new-plan', name: 'Nuevo plan', role: 'floor' }
        });
    });
    it('shows client validation and makes no create request for an empty slug', async () => {
        renderScreen();
        await screen.findByText(es.planCatalogEditor.empty);
        openDialog();
        fillPlan({ slug: '' });
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.createPlan.submit })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.invalid.split('{message}')[0]
        );
        expect(fetchApi.mock.calls.filter(([request]) => request.method === 'POST')).toHaveLength(
            0
        );
    });
    it('shows a literal conflict rejection', async () => {
        fetchApi.mockImplementation(({ method }: { method?: string } = {}) =>
            method === 'POST'
                ? Promise.reject(new ApiError('slug ya existe', { status: 409 }))
                : Promise.resolve({ data: { data: { vertical: 'accommodation', plans: [] } } })
        );
        renderScreen();
        await screen.findByText(es.planCatalogEditor.empty);
        openDialog();
        fillPlan();
        fireEvent.click(
            screen.getByRole('button', { name: es.planCatalogEditor.createPlan.submit })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.planCatalogEditor.errors.rejected.replace('{message}', 'slug ya existe')
        );
    });
});
