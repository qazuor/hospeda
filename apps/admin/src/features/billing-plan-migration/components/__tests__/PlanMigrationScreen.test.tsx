// @vitest-environment jsdom
import { formatCurrency } from '@repo/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { PlanMigrationScreen } from '../PlanMigrationScreen';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const es = await import('@repo/i18n/locales/es/admin-pages.json');
    return {
        useTranslations: () => ({
            tPlural: (key: string, count: number, values?: Record<string, string | number>) =>
                translate(`${key}_${count === 1 ? 'one' : 'other'}`, { ...values, count }),
            t: translate
        })
    };
    function translate(key: string, values?: Record<string, string | number>) {
        const parts = key.split('.').slice(1);
        let node: unknown = es.default;
        for (const part of parts) node = (node as Record<string, unknown>)[part];
        return Object.entries(values ?? {}).reduce(
            (text, [name, value]) =>
                text
                    .replaceAll(`{{${name}}}`, String(value))
                    .replaceAll(`{${name}}`, String(value)),
            String(node)
        );
    }
});

const source = {
    id: '11111111-1111-4111-8111-111111111111',
    planId: '22222222-2222-4222-8222-222222222222',
    name: 'Retirado',
    vertical: 'accommodation',
    versionNumber: 1,
    customerCount: 3
};
const target = {
    id: '33333333-3333-4333-8333-333333333333',
    planId: '44444444-4444-4444-8444-444444444444',
    name: 'Nuevo',
    vertical: 'accommodation',
    versionNumber: 1
};
const downTarget = {
    id: '14141414-1414-4414-8414-141414141414',
    planId: '15151515-1515-4515-8515-151515151515',
    name: 'Destino de bajada',
    vertical: 'accommodation',
    versionNumber: 1
};
const other = {
    id: '55555555-5555-4555-8555-555555555555',
    planId: '66666666-6666-4666-8666-666666666666',
    name: 'Otra vertical',
    vertical: 'venue',
    versionNumber: 1
};
const options = {
    sources: [source],
    targets: { accommodation: [target, downTarget], venue: [other] }
};
const rows = [
    {
        subscriptionId: '77777777-7777-4777-8777-777777777777',
        userId: '88888888-8888-4888-8888-888888888888',
        customerName: 'Ana',
        customerEmail: 'ana@example.test',
        status: 'ACTIVE',
        cycle: 'monthly',
        direction: 'UP',
        currentAmount: 100000,
        newAmount: 150000,
        currency: 'ARS',
        losesPromo: true,
        applicationDate: '2027-01-10',
        waits: false,
        outcome: 'PENDIENTE',
        excludedReason: null
    },
    {
        subscriptionId: '99999999-9999-4999-8999-999999999999',
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        customerName: 'Beto',
        customerEmail: 'beto@example.test',
        status: 'PAUSED',
        cycle: 'monthly',
        direction: 'UP',
        currentAmount: 200000,
        newAmount: null,
        currency: 'ARS',
        losesPromo: false,
        applicationDate: null,
        waits: false,
        outcome: 'PARA_RESOLVER',
        excludedReason: null
    },
    {
        subscriptionId: '12121212-1212-4212-8212-121212121212',
        userId: '13131313-1313-4313-8313-131313131313',
        customerName: 'Dani',
        customerEmail: 'dani@example.test',
        status: 'PAUSED',
        cycle: 'monthly',
        direction: 'UP',
        currentAmount: 120000,
        newAmount: 150000,
        currency: 'ARS',
        losesPromo: false,
        applicationDate: '2027-01-11',
        waits: true,
        outcome: 'PENDIENTE',
        excludedReason: null
    },
    {
        subscriptionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        customerName: null,
        customerEmail: 'owner@example.test',
        status: 'ACTIVE',
        cycle: 'monthly',
        direction: null,
        currentAmount: 100000,
        newAmount: null,
        currency: 'ARS',
        losesPromo: false,
        applicationDate: null,
        waits: false,
        outcome: 'EXCLUDED',
        excludedReason: 'ACTOR_IS_SUBJECT'
    },
    {
        subscriptionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        customerName: 'Cora',
        customerEmail: 'cora@example.test',
        status: 'ACTIVE',
        cycle: 'monthly',
        direction: null,
        currentAmount: 100000,
        newAmount: null,
        currency: 'ARS',
        losesPromo: false,
        applicationDate: null,
        waits: false,
        outcome: 'EXCLUDED',
        excludedReason: 'ALREADY_IN_MIGRATION'
    }
] as const;
const preview = {
    source,
    target,
    direction: 'UP',
    noticeDays: 60,
    deadlineVersion: 3,
    announcedAt: '2026-11-09T00:00:00.000Z',
    rows,
    cohortFingerprint: 'a'.repeat(64),
    launchable: true
};
const result = {
    planMigrationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    announcedAt: preview.announcedAt,
    deadlineVersion: 3,
    noticeDays: 60,
    rows: [
        {
            subscriptionId: rows[0].subscriptionId,
            outcome: 'PENDIENTE',
            applicationDate: '2027-01-10'
        }
    ],
    excluded: [{ subscriptionId: rows[3].subscriptionId, excludedReason: 'ACTOR_IS_SUBJECT' }]
};
function setup({
    launchable = true,
    direction = 'UP'
}: {
    launchable?: boolean;
    direction?: 'UP' | 'DOWN';
} = {}) {
    fetchApi.mockImplementation(async (input?: { path: string }) => ({
        data: {
            data: input?.path.endsWith('/options')
                ? options
                : input?.path.endsWith('/preview')
                  ? {
                        ...preview,
                        target: direction === 'DOWN' ? downTarget : target,
                        launchable,
                        direction,
                        rows: preview.rows.map((row) => ({
                            ...row,
                            direction: row.outcome === 'EXCLUDED' ? null : direction
                        }))
                    }
                  : result
        }
    }));
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <PlanMigrationScreen />
        </QueryClientProvider>
    );
}
async function previewSelection(targetId: string = target.id) {
    await screen.findByTestId('plan-migration-source');
    fireEvent.change(screen.getByTestId('plan-migration-source'), { target: { value: source.id } });
    fireEvent.change(screen.getByTestId('plan-migration-target'), { target: { value: targetId } });
    fireEvent.click(screen.getByTestId('plan-migration-preview-button'));
    await screen.findByTestId(`plan-migration-row-${rows[0].subscriptionId}`);
}

describe('TEST:B12:2 AC:B12:2 la acción 17 y su previsualización en el panel', () => {
    beforeEach(() => fetchApi.mockReset());
    it('AC:B12:2 antes de confirmar ve a cada cliente alcanzado con subida o bajada —según direcciónDeCambio—, su precio actual y el nuevo, y su fecha; la cuenta propia se muestra excluida', async () => {
        setup();
        await previewSelection();
        const rendered = rows.map((row) =>
            screen.getByTestId(`plan-migration-row-${row.subscriptionId}`)
        );
        expect(rendered).toHaveLength(5);
        expect(within(rendered[0]).getByTestId('plan-migration-row-direction')).toHaveTextContent(
            'Sube'
        );
        expect(within(rendered[1]).getByTestId('plan-migration-row-direction')).toHaveTextContent(
            'Sube'
        );
        expect(
            within(rendered[0]).getByTestId('plan-migration-row-current-amount')
        ).toHaveTextContent(
            new RegExp(
                formatCurrency({ value: 1000, locale: 'es-AR', currency: 'ARS' })
                    .replaceAll(/\s/g, '\\s')
                    .replaceAll('$', '\\$')
            )
        );
        expect(within(rendered[0]).getByTestId('plan-migration-row-new-amount')).toHaveTextContent(
            new RegExp(
                formatCurrency({ value: 1500, locale: 'es-AR', currency: 'ARS' })
                    .replaceAll(/\s/g, '\\s')
                    .replaceAll('$', '\\$')
            )
        );
        expect(within(rendered[0]).getByTestId('plan-migration-row-date')).toHaveTextContent(
            '2027-01-10'
        );
        expect(rendered[0]).toHaveTextContent('Pierde la promoción');
        expect(within(rendered[1]).getByTestId('plan-migration-row-new-amount')).toHaveTextContent(
            '—'
        );
        expect(within(rendered[1]).getByTestId('plan-migration-row-date')).toHaveTextContent(
            'A resolver'
        );
        expect(within(rendered[2]).getByTestId('plan-migration-row-date')).toHaveTextContent(
            'Espera a que vuelva'
        );
        expect(within(rendered[3]).getByTestId('plan-migration-row-excluded')).toHaveTextContent(
            'Excluida'
        );
        expect(rendered[3]).toHaveTextContent('Es tu propia cuenta');
        expect(rendered[4]).toHaveTextContent('Ya está en otra migración');
    });
    it('AC:B12:2 muestra la bajada de una segunda previsualización del par de versiones', async () => {
        setup({ direction: 'DOWN' });
        await previewSelection(downTarget.id);
        expect(fetchApi.mock.calls[1]?.[0]).toEqual({
            path: '/api/v1/admin/plan-migrations/preview',
            method: 'POST',
            body: { sourcePlanVersionId: source.id, targetPlanVersionId: downTarget.id }
        });
        expect(
            within(screen.getByTestId(`plan-migration-row-${rows[0].subscriptionId}`)).getByTestId(
                'plan-migration-row-direction'
            )
        ).toHaveTextContent('Baja');
    });
    it('lista sólo destinos vigentes y vendibles de la misma vertical del origen', async () => {
        setup();
        await screen.findByTestId('plan-migration-source');
        fireEvent.change(screen.getByTestId('plan-migration-source'), {
            target: { value: source.id }
        });
        expect(
            Array.from(
                (screen.getByTestId('plan-migration-target') as HTMLSelectElement).options
            ).map((option) => option.value)
        ).toEqual(['', target.id, downTarget.id]);
        expect(
            (screen.getByTestId('plan-migration-source') as HTMLSelectElement).options[1]
                ?.textContent
        ).toContain('Retirado · versión 1 · 3 clientes');
    });
    it('confirma con cohortFingerprint y muestra filas escritas y excluidas', async () => {
        setup();
        await previewSelection();
        fireEvent.click(screen.getByTestId('plan-migration-confirm'));
        expect(await screen.findByTestId('plan-migration-result')).toHaveTextContent(
            result.planMigrationId
        );
        expect(screen.getByTestId('plan-migration-result')).toHaveTextContent(
            'Filas escritas: 1. Excluidas: 1'
        );
        expect(fetchApi.mock.calls.at(-1)?.[0]).toEqual({
            path: '/api/v1/admin/plan-migrations',
            method: 'POST',
            body: {
                sourcePlanVersionId: source.id,
                targetPlanVersionId: target.id,
                cohortFingerprint: preview.cohortFingerprint
            }
        });
    });
    it('ante PLAN_MIGRATION_COHORT_CHANGED avisa y vuelve a previsualizar', async () => {
        setup();
        await previewSelection();
        fetchApi.mockImplementationOnce(async () => {
            throw new ApiError('changed', {
                status: 409,
                code: 'PLAN_MIGRATION_COHORT_CHANGED' as 'CONFLICT'
            });
        });
        fireEvent.click(screen.getByTestId('plan-migration-confirm'));
        expect(await screen.findByTestId('plan-migration-error')).toHaveTextContent(
            'La cohorte cambió'
        );
        expect(
            await screen.findByTestId(`plan-migration-row-${rows[0].subscriptionId}`)
        ).toBeInTheDocument();
        expect(fetchApi.mock.calls.map(([input]) => input.path)).toEqual([
            '/api/v1/admin/plan-migrations/options',
            '/api/v1/admin/plan-migrations/preview',
            '/api/v1/admin/plan-migrations',
            '/api/v1/admin/plan-migrations/preview'
        ]);
    });
    it('deshabilita confirmar si launchable es false', async () => {
        setup({ launchable: false });
        await previewSelection();
        expect(screen.getByTestId('plan-migration-confirm')).toBeDisabled();
    });
});
