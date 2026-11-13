// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { PlanMigrationDetail } from '../PlanMigrationDetail';
import { PlanMigrationList } from '../PlanMigrationList';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const es = await import('@repo/i18n/locales/es/admin-pages.json');
    function translate(key: string, values?: Record<string, string | number>) {
        const parts = key.split('.').slice(1);
        let node: unknown = es.default;
        for (const part of parts) node = (node as Record<string, unknown>)[part];
        return Object.entries(values ?? {}).reduce(
            (copy, [name, value]) =>
                copy
                    .replaceAll(`{{${name}}}`, String(value))
                    .replaceAll(`{${name}}`, String(value)),
            String(node)
        );
    }
    return {
        useTranslations: () => ({
            t: translate,
            tPlural: (key: string, count: number) =>
                translate(`${key}_${count === 1 ? 'one' : 'other'}`, { count })
        })
    };
});

const id = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const base = {
    id,
    reason: 'RETIREMENT',
    sourcePlanVersionId: '33333333-3333-4333-8333-333333333333',
    targetPlanVersionId: '44444444-4444-4444-8444-444444444444',
    sourcePlanName: 'Plan anterior',
    targetPlanName: 'Plan siguiente',
    announcedAt: '2025-01-01T00:00:00.000Z',
    cancelledAt: null,
    counts: { PENDIENTE: 2, PARA_RESOLVER: 1, APLICADA: 1, FUERA: 0, CANCELADA: 0 }
};
const unresolved = {
    id: '55555555-5555-4555-8555-555555555555',
    subscriptionId: '66666666-6666-4666-8666-666666666666',
    ownerUserId: '77777777-7777-4777-8777-777777777777',
    status: 'PARA_RESOLVER',
    outReason: null,
    applicationDate: null,
    appliedAt: null,
    ageDays: 12
};
const applied = {
    id: '88888888-8888-4888-8888-888888888888',
    subscriptionId: '99999999-9999-4999-8999-999999999999',
    ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'APLICADA',
    outReason: null,
    applicationDate: '2026-11-20',
    appliedAt: '2026-11-01T00:00:00.000Z',
    ageDays: null
};
const detail = { ...base, noticeDays: 60, deadlineVersion: 3, rows: [applied, unresolved] };
function setup(element: React.ReactNode) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
    return { client, invalidate };
}

describe('TEST:B12:6 AC:B12:6 y el panel la lista sin plazo y con su antigüedad desde el anuncio', () => {
    beforeEach(() => fetchApi.mockReset());
    it('renders the server page and requests the next page', async () => {
        fetchApi.mockImplementation(async (input?: { path: string }) => ({
            data: {
                data: {
                    items: [{ ...base, id: input?.path.includes('page=2') ? secondId : id }],
                    pagination: {
                        page: input?.path.includes('page=2') ? 2 : 1,
                        pageSize: 20,
                        total: 21,
                        totalPages: 2
                    }
                }
            }
        }));
        setup(<PlanMigrationList onSelect={vi.fn()} />);
        expect(await screen.findByTestId('plan-migration-list-row')).toHaveTextContent(
            'Plan anterior → Plan siguiente'
        );
        expect(screen.getByTestId('plan-migration-list-row')).toHaveTextContent('Para resolver: 1');
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: '/api/v1/admin/plan-migrations?page=2&pageSize=20'
            })
        );
        expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    });
    it('puts PARA_RESOLVER first, uses server ageDays and gives its row exactly two cells', async () => {
        fetchApi.mockResolvedValue({ data: { data: detail } });
        setup(
            <PlanMigrationDetail
                id={id}
                onClose={vi.fn()}
            />
        );
        const groups = await screen.findAllByTestId(/^plan-migration-rows-/);
        expect(groups.map((group) => group.getAttribute('data-testid'))).toEqual([
            'plan-migration-rows-PARA_RESOLVER',
            'plan-migration-rows-PENDIENTE',
            'plan-migration-rows-APLICADA',
            'plan-migration-rows-FUERA',
            'plan-migration-rows-CANCELADA'
        ]);
        const row = within(groups[0]!).getByTestId('plan-migration-detail-row');
        expect(row).toHaveTextContent(`${unresolved.subscriptionId}hace 12 días`);
        expect(within(row).getAllByRole('cell')).toHaveLength(2);
        expect(within(row).getByTestId('plan-migration-row-age')).toHaveTextContent('hace 12 días');
    });
});

describe('TEST:B12:7 AC:B12:7 cancelar una migración anunciada', () => {
    beforeEach(() => fetchApi.mockReset());
    it('explains counts, posts the id and invalidates list and detail', async () => {
        fetchApi.mockImplementation(async (input?: { method?: string }) => ({
            data: {
                data:
                    input?.method === 'POST'
                        ? {
                              planMigrationId: id,
                              cancelledAt: '2026-11-10T00:00:00.000Z',
                              rows: { cancelled: 3, alreadyStarted: 1, untouched: 0 }
                          }
                        : detail
            }
        }));
        const { invalidate } = setup(
            <PlanMigrationDetail
                id={id}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(await screen.findByTestId('plan-migration-cancel'));
        expect(await screen.findByText(/3 filas pendientes o para resolver/)).toHaveTextContent(
            '1 filas cuyo cambio ya empezó siguen su curso. No se toca ningún cobro.'
        );
        fireEvent.click(screen.getByTestId('plan-migration-cancel-confirm'));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/plan-migrations/${id}/cancel`,
                method: 'POST'
            })
        );
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-plan-migrations'] })
        );
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-plan-migration-detail', id] });
    });
    it('shows the already-cancelled error code from a 409', async () => {
        fetchApi.mockImplementation(async (input?: { method?: string }) => {
            if (input?.method === 'POST')
                throw new ApiError('cancelled', {
                    status: 409,
                    code: 'PLAN_MIGRATION_ALREADY_CANCELLED' as 'CONFLICT'
                });
            return { data: { data: detail } };
        });
        setup(
            <PlanMigrationDetail
                id={id}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(await screen.findByTestId('plan-migration-cancel'));
        fireEvent.click(screen.getByTestId('plan-migration-cancel-confirm'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'La migración ya estaba cancelada.'
        );
    });
    it('shows the missing migration error code from a 404', async () => {
        fetchApi.mockImplementation(async (input?: { method?: string }) => {
            if (input?.method === 'POST')
                throw new ApiError('missing', {
                    status: 404,
                    code: 'PLAN_MIGRATION_NOT_FOUND' as 'NOT_FOUND'
                });
            return { data: { data: detail } };
        });
        setup(
            <PlanMigrationDetail
                id={id}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(await screen.findByTestId('plan-migration-cancel'));
        fireEvent.click(screen.getByTestId('plan-migration-cancel-confirm'));
        expect(await screen.findByRole('alert')).toHaveTextContent('La migración no existe.');
    });
    it('disables cancellation for a cancelled migration', async () => {
        fetchApi.mockResolvedValue({
            data: { data: { ...detail, cancelledAt: '2026-11-09T00:00:00.000Z' } }
        });
        setup(
            <PlanMigrationDetail
                id={id}
                onClose={vi.fn()}
            />
        );
        expect(await screen.findByTestId('plan-migration-cancel')).toBeDisabled();
    });
});
