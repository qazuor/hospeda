// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeadlinesScreen } from '../DeadlinesScreen';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => [] }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, args?: Record<string, unknown>) => {
            const value = key
                .split('.')
                .slice(1)
                .reduce((node: any, part) => node?.[part], es) as string;
            return Object.entries(args ?? {}).reduce(
                (result, [name, item]) => result.replaceAll(`{${name}}`, String(item)),
                value ?? key
            );
        }
    })
}));

const vertical = {
    version: 2,
    values: {
        '1': { days: 90 },
        '2': { days: 180 },
        '3': { months: 3 },
        '4': { beforeArchiveDays: 7, beforeDeletionDays: 14 },
        '5': { daysBefore: [10, 5, 2, 0] },
        '6': { daysAfter: [1, 5, 15, 30, 60] },
        '7': { days: 365 },
        '8': { days: 4 },
        '9': { days: 30 }
    }
};
const billing = {
    version: 5,
    values: {
        '10': { cardHours: 72, manualDays: 7 },
        '11': { noticeDays: 60, contactDays: [30, 7] },
        '12': { noticeDays: 60, contactDays: [30, 7] },
        '13': { daysBefore: [5, 1] },
        '14': { daysBefore: 7 },
        '15': { hoursRemaining: 24 },
        '16': { days: 7 },
        '17': { days: 30 },
        '18': { days: 1 },
        '19': { minutes: 15 }
    }
};

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DeadlinesScreen />
        </QueryClientProvider>
    );
}

describe('AC:1704:10 TEST:1704:9 DeadlinesScreen', () => {
    it('reads both halves and renders their versions, rows, values, and clock rule', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            Promise.resolve({ data: { data: path.includes('vertical') ? vertical : billing } })
        );
        renderScreen();
        const verticalSection = await screen.findByTestId('deadlines-vertical');
        const billingSection = await screen.findByTestId('deadlines-billing');
        expect(verticalSection).toHaveTextContent('Versión 2');
        expect(billingSection).toHaveTextContent('Versión 5');
        for (const [key, name, value] of [
            ['1', 'Archivado por inactividad', '90'],
            ['4', 'Avisos previos de retención', '7'],
            ['5', 'Campaña previa al vencimiento de la prueba', '10, 5, 2, 0']
        ] as const) {
            const row = within(verticalSection).getByTestId(`deadline-row-${key}`);
            expect(row).toHaveTextContent(name);
            expect(row).toHaveTextContent(value);
        }
        const billingRow = within(billingSection).getByTestId('deadline-row-11');
        expect(billingRow).toHaveTextContent('Aviso previo de un aumento de precio');
        expect(billingRow).toHaveTextContent('60');
        expect(screen.getByText(es.deadlinesEditor.clocksRule)).toBeInTheDocument();
        expect(fetchApi.mock.calls).toEqual([
            [{ path: '/api/v1/admin/vertical-deadlines' }],
            [{ path: '/api/v1/admin/billing-deadlines' }]
        ]);
    });

    it('keeps vertical rows visible when billing fails and shows an alert', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            path.includes('vertical')
                ? Promise.resolve({ data: { data: vertical } })
                : Promise.reject(new Error('offline'))
        );
        renderScreen();
        expect(await screen.findByTestId('deadline-row-1')).toBeInTheDocument();
        const section = await screen.findByTestId('deadlines-billing');
        expect(within(section).getByRole('alert')).toHaveTextContent(
            es.deadlinesEditor.errors.load
        );
    });

    it('renders an optional missing deadline row without an edit action', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            Promise.resolve({ data: { data: path.includes('vertical') ? vertical : billing } })
        );
        renderScreen();
        const row = await screen.findByTestId('deadline-row-20');
        expect(row).toHaveTextContent(es.deadlinesEditor.noValue);
        expect(
            within(row).queryByRole('button', { name: es.deadlinesEditor.edit })
        ).not.toBeInTheDocument();
    });
});
