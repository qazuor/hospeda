// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { PlanMigrationScreen } from '../PlanMigrationScreen';

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
            tPlural: (key: string, count: number, values?: Record<string, string | number>) =>
                translate(`${key}_${count === 1 ? 'one' : 'other'}`, { ...values, count })
        })
    };
});

const planId = '22222222-2222-4222-8222-222222222222';
const increaseSource = {
    id: '11111111-1111-4111-8111-111111111111',
    planId,
    name: 'Anclada',
    vertical: 'accommodation',
    customerCount: 2
};
const increaseTarget = {
    id: '33333333-3333-4333-8333-333333333333',
    planId,
    name: 'Vigente',
    vertical: 'accommodation'
};
const retirementSource = {
    id: '44444444-4444-4444-8444-444444444444',
    planId: '55555555-5555-4555-8555-555555555555',
    name: 'Retirada',
    vertical: 'accommodation',
    customerCount: 1
};
const retirementTarget = {
    id: '66666666-6666-4666-8666-666666666666',
    planId: '77777777-7777-4777-8777-777777777777',
    name: 'Destino retiro',
    vertical: 'accommodation'
};
const options = {
    sources: [retirementSource],
    targets: { accommodation: [retirementTarget] },
    increases: [{ source: increaseSource, target: increaseTarget }]
};
const subscriptionId = '88888888-8888-4888-8888-888888888888';
const row = {
    subscriptionId,
    userId: '99999999-9999-4999-8999-999999999999',
    customerName: 'Ana',
    customerEmail: 'ana@example.test',
    status: 'ACTIVE',
    cycle: 'monthly',
    direction: 'UP',
    currentAmount: 100000,
    newAmount: 150000,
    currency: 'ARS',
    losesPromo: false,
    applicationDate: '2027-01-10',
    waits: false,
    outcome: 'PENDIENTE',
    excludedReason: null
};
const cohortFingerprint = 'a'.repeat(64);
const announcedAt = '2026-11-09T00:00:00.000Z';
const increasePreview = {
    source: increaseSource,
    target: increaseTarget,
    reason: 'PRICE_INCREASE',
    direction: 'UP',
    noticeDays: 60,
    deadlineVersion: 3,
    announcedAt,
    rows: [row],
    cohortFingerprint,
    launchable: true
};
const retirementPreview = {
    source: retirementSource,
    target: retirementTarget,
    reason: 'RETIREMENT',
    direction: 'UP',
    noticeDays: 60,
    deadlineVersion: 3,
    announcedAt,
    rows: [{ ...row, direction: 'UP' }],
    cohortFingerprint,
    launchable: true
};
const increaseResult = {
    planMigrationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    reason: 'PRICE_INCREASE',
    announcedAt,
    deadlineVersion: 3,
    noticeDays: 60,
    rows: [{ subscriptionId, outcome: 'PENDIENTE', applicationDate: '2027-01-10' }],
    excluded: []
};
const retirementResult = { ...increaseResult, reason: 'RETIREMENT' };

function setup() {
    fetchApi.mockImplementation(async (input?: { path?: string; body?: { reason?: string } }) => {
        if (input?.path?.endsWith('/options')) return { data: { data: options } };
        const increase = input?.body?.reason === 'PRICE_INCREASE';
        if (input?.path?.endsWith('/preview'))
            return { data: { data: increase ? increasePreview : retirementPreview } };
        return { data: { data: increase ? increaseResult : retirementResult } };
    });
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <PlanMigrationScreen />
        </QueryClientProvider>
    );
}

async function choosePair(
    reason: 'RETIREMENT' | 'PRICE_INCREASE',
    sourceId: string,
    targetId: string
) {
    await screen.findByTestId('plan-migration-reason');
    fireEvent.change(screen.getByTestId('plan-migration-reason'), { target: { value: reason } });
    fireEvent.change(screen.getByTestId('plan-migration-source'), { target: { value: sourceId } });
    fireEvent.change(screen.getByTestId('plan-migration-target'), { target: { value: targetId } });
}

function bodyOf(pathSuffix: string) {
    const call = fetchApi.mock.calls.find(([input]) => input?.path?.endsWith(pathSuffix));
    return call?.[0]?.body;
}

describe('AC:B12:9 el aumento se lanza por la acción 17 con el motivo «aumento»', () => {
    beforeEach(() => fetchApi.mockReset());

    it('con «aumento» los selects muestran el par de increases y no las versiones retiradas', async () => {
        setup();
        await screen.findByTestId('plan-migration-reason');
        fireEvent.change(screen.getByTestId('plan-migration-reason'), {
            target: { value: 'PRICE_INCREASE' }
        });
        const source = screen.getByTestId('plan-migration-source') as HTMLSelectElement;
        expect(Array.from(source.options).map((option) => option.value)).toEqual([
            '',
            increaseSource.id
        ]);
        expect(source.options[1]?.textContent).toContain('Anclada · 2 clientes');
        fireEvent.change(source, { target: { value: increaseSource.id } });
        const target = screen.getByTestId('plan-migration-target') as HTMLSelectElement;
        expect(Array.from(target.options).map((option) => option.value)).toEqual([
            '',
            increaseTarget.id
        ]);
    });

    it('previsualiza y lanza con reason PRICE_INCREASE', async () => {
        setup();
        await choosePair('PRICE_INCREASE', increaseSource.id, increaseTarget.id);
        fireEvent.click(screen.getByTestId('plan-migration-preview-button'));
        await screen.findByTestId(`plan-migration-row-${subscriptionId}`);
        expect(bodyOf('/preview')).toEqual({
            sourcePlanVersionId: increaseSource.id,
            targetPlanVersionId: increaseTarget.id,
            reason: 'PRICE_INCREASE'
        });
        fireEvent.click(screen.getByTestId('plan-migration-confirm'));
        expect(await screen.findByTestId('plan-migration-result')).toHaveTextContent(
            increaseResult.planMigrationId
        );
        expect(fetchApi.mock.calls.at(-1)?.[0]?.body).toEqual({
            sourcePlanVersionId: increaseSource.id,
            targetPlanVersionId: increaseTarget.id,
            cohortFingerprint,
            reason: 'PRICE_INCREASE'
        });
    });

    it('con «retiro» el body del preview y del lanzamiento queda como hoy, sin reason', async () => {
        setup();
        await choosePair('RETIREMENT', retirementSource.id, retirementTarget.id);
        fireEvent.click(screen.getByTestId('plan-migration-preview-button'));
        await screen.findByTestId(`plan-migration-row-${subscriptionId}`);
        expect(bodyOf('/preview')).toEqual({
            sourcePlanVersionId: retirementSource.id,
            targetPlanVersionId: retirementTarget.id
        });
        fireEvent.click(screen.getByTestId('plan-migration-confirm'));
        await screen.findByTestId('plan-migration-result');
        expect(fetchApi.mock.calls.at(-1)?.[0]?.body).toEqual({
            sourcePlanVersionId: retirementSource.id,
            targetPlanVersionId: retirementTarget.id,
            cohortFingerprint
        });
    });

    it('un rechazo PLAN_MIGRATION_INCREASE_CYCLE_MISSING muestra su texto', async () => {
        setup();
        await choosePair('PRICE_INCREASE', increaseSource.id, increaseTarget.id);
        fetchApi.mockImplementationOnce(async () => {
            throw new ApiError('cycle', {
                status: 422,
                code: 'PLAN_MIGRATION_INCREASE_CYCLE_MISSING' as 'VALIDATION_ERROR'
            });
        });
        fireEvent.click(screen.getByTestId('plan-migration-preview-button'));
        expect(await screen.findByTestId('plan-migration-error')).toHaveTextContent(
            'La versión nueva no ofrece todos los ciclos de los clientes.'
        );
    });
});
