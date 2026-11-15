// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { BillingDeadlineValuesSchema, VerticalDeadlineValuesSchema } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
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
    version: 7,
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
    version: 3,
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
const response = (data: unknown) => Promise.resolve({ data: { data } });
const apiError = (message: string, status: number) =>
    new ApiError(message, { status, body: { message }, url: '/api/v1/admin/deadlines' });

describe('AC:1704:12 TEST:1704:11 DeadlineChangeRejections', () => {
    it('rejects cross-key vertical contradictions in the client without requesting preview', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            response(path.includes('vertical') ? vertical : billing)
        );
        renderScreen();
        const row = await screen.findByTestId('deadline-row-1');
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.edit }));
        fireEvent.change(within(row).getByLabelText(es.deadlinesEditor.fields.days), {
            target: { value: '200' }
        });
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.review }));
        expect(await within(row).findByRole('alert')).toHaveTextContent(
            VerticalDeadlineValuesSchema.safeParse({ ...vertical.values, '1': { days: 200 } }).error
                ?.issues[0]?.message ?? ''
        );
        expect(fetchApi).toHaveBeenCalledTimes(2);
    });

    it('rejects billing notice below 60 days without requesting preview', async () => {
        fetchApi.mockImplementation(({ path }: { path: string }) =>
            response(path.includes('vertical') ? vertical : billing)
        );
        renderScreen();
        const row = await screen.findByTestId('deadline-row-11');
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.edit }));
        fireEvent.change(within(row).getByLabelText(es.deadlinesEditor.fields.noticeDays), {
            target: { value: '30' }
        });
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.review }));
        expect(await within(row).findByRole('alert')).toHaveTextContent(
            BillingDeadlineValuesSchema.safeParse({
                ...billing.values,
                '11': { noticeDays: 30, contactDays: [30, 7] }
            }).error?.issues[0]?.message ?? ''
        );
        expect(fetchApi).toHaveBeenCalledTimes(2);
    });

    it.each([
        [400, 'La versión cambió; confirme de nuevo', es.deadlinesEditor.errors.rejected],
        [403, 'forbidden', es.deadlinesEditor.errors.forbidden],
        [500, 'generic', es.deadlinesEditor.errors.generic]
    ] as const)('shows the mapped server rejection for status %s without retry', async (status, message, expected) => {
        fetchApi.mockImplementation(({ path, method }: { path: string; method?: string }) => {
            if (!method) return response(path.includes('vertical') ? vertical : billing);
            if (path.endsWith('/preview'))
                return response({
                    currentVersion: 7,
                    currentValue: { days: 90 },
                    newValue: { days: 120 },
                    message: 'Preview ok'
                });
            throw apiError(message, status);
        });
        renderScreen();
        const row = await screen.findByTestId('deadline-row-1');
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.edit }));
        fireEvent.change(within(row).getByLabelText(es.deadlinesEditor.fields.days), {
            target: { value: '120' }
        });
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.review }));
        const review = await within(row).findByTestId('deadline-review-1');
        fireEvent.click(within(review).getByRole('button', { name: es.deadlinesEditor.confirm }));
        const alert = await within(row).findByRole('alert');
        if (expected === es.deadlinesEditor.errors.rejected)
            expect(alert).toHaveTextContent(
                'La API rechazó el cambio: La versión cambió; confirme de nuevo'
            );
        else expect(alert).toHaveTextContent(expected);
        expect(fetchApi).toHaveBeenCalledTimes(4);
        expect(fetchApi.mock.calls[3]).toEqual([
            {
                path: '/api/v1/admin/vertical-deadlines',
                method: 'POST',
                body: { key: 1, value: { days: 120 }, expectedVersion: 7, confirmed: true }
            }
        ]);
    });
});
