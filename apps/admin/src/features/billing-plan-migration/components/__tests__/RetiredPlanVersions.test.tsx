// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetiredPlanVersions } from '../RetiredPlanVersions';

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

const retired = {
    id: '11111111-1111-4111-8111-111111111111',
    planId: '22222222-2222-4222-8222-222222222222',
    name: 'Succession plan',
    vertical: 'accommodation',
    liveSubscriptionCount: 3
};

function setup() {
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <RetiredPlanVersions />
        </QueryClientProvider>
    );
}

describe('AC:B12:10 la cola del retiro se ve', () => {
    beforeEach(() => fetchApi.mockReset());

    it('muestra cada versión retirada con sus suscripciones vivas', async () => {
        fetchApi.mockResolvedValue({ data: { data: { items: [retired] } } });
        setup();
        const row = await screen.findByTestId(`retired-plan-version-${retired.id}`);
        expect(within(row).getByText('Succession plan')).toBeInTheDocument();
        expect(within(row).getByText('accommodation')).toBeInTheDocument();
        expect(within(row).getByText('3')).toBeInTheDocument();
        expect(screen.getByTestId('retired-plan-versions')).toHaveTextContent(
            'Suscripciones vivas'
        );
        expect(fetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/plan-migrations/retired-versions'
        });
    });

    it('sin versiones retiradas con clientes muestra su texto de vacío', async () => {
        fetchApi.mockResolvedValue({ data: { data: { items: [] } } });
        setup();
        expect(
            await screen.findByText('No hay versiones retiradas con suscripciones vivas.')
        ).toBeInTheDocument();
        expect(screen.queryByTestId(`retired-plan-version-${retired.id}`)).toBeNull();
    });

    it('si la lectura trae un cuerpo inválido muestra el error genérico', async () => {
        fetchApi.mockResolvedValue({
            data: { data: { items: [{ ...retired, liveSubscriptionCount: 0 }] } }
        });
        setup();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos completar la operación. Intentá de nuevo.'
        );
    });
});
