// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('AC:1704:11 TEST:1704:10 DeadlineChangeFlow', () => {
    it('previews and confirms vertical changes with the read version, then refreshes that half', async () => {
        fetchApi.mockImplementation(({ path, method }: { path: string; method?: string }) => {
            if (!method) return response(path.includes('vertical') ? vertical : billing);
            if (path.endsWith('/preview'))
                return response({
                    currentVersion: 7,
                    currentValue: { days: 90 },
                    newValue: { days: 120 },
                    message: 'Los relojes ya arrancados conservan la suya'
                });
            return response({
                ...vertical,
                version: 8,
                values: { ...vertical.values, '1': { days: 120 } }
            });
        });
        renderScreen();
        const row = await screen.findByTestId('deadline-row-1');
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.edit }));
        fireEvent.change(within(row).getByLabelText(es.deadlinesEditor.fields.days), {
            target: { value: '120' }
        });
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.review }));
        const review = await within(row).findByTestId('deadline-review-1');
        expect(review).toHaveTextContent('90');
        expect(review).toHaveTextContent('120');
        expect(review).toHaveTextContent('Los relojes ya arrancados conservan la suya');
        expect(fetchApi).toHaveBeenNthCalledWith(3, {
            path: '/api/v1/admin/vertical-deadlines/preview',
            method: 'POST',
            body: { key: 1, value: { days: 120 } }
        });
        fireEvent.click(within(review).getByRole('button', { name: es.deadlinesEditor.confirm }));
        expect(await within(row).findByRole('status')).toHaveTextContent('Publicada la versión 8.');
        expect(fetchApi).toHaveBeenNthCalledWith(4, {
            path: '/api/v1/admin/vertical-deadlines',
            method: 'POST',
            body: { key: 1, value: { days: 120 }, expectedVersion: 7, confirmed: true }
        });
        expect(fetchApi).toHaveBeenCalledTimes(5);
        expect(fetchApi).toHaveBeenLastCalledWith({ path: '/api/v1/admin/vertical-deadlines' });
    });

    it('routes billing changes to the billing API and keeps typed values when backing out', async () => {
        fetchApi.mockImplementation(({ path, method }: { path: string; method?: string }) =>
            method
                ? response({
                      currentVersion: 3,
                      currentValue: { daysBefore: [5, 1] },
                      newValue: { daysBefore: [4, 1] },
                      message: 'review'
                  })
                : response(path.includes('vertical') ? vertical : billing)
        );
        renderScreen();
        const row = await screen.findByTestId('deadline-row-13');
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.edit }));
        const input = within(row).getByRole('textbox');
        fireEvent.change(input, { target: { value: '4, 1' } });
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.review }));
        const review = await within(row).findByTestId('deadline-review-13');
        expect(fetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/billing-deadlines/preview',
            method: 'POST',
            body: { key: 13, value: { daysBefore: [4, 1] } }
        });
        fireEvent.click(within(review).getByRole('button', { name: es.deadlinesEditor.back }));
        expect(within(row).getByRole('textbox')).toHaveValue('4, 1');
        const calls = fetchApi.mock.calls.length;
        fireEvent.click(within(row).getByRole('button', { name: es.deadlinesEditor.cancel }));
        expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
        expect(fetchApi).toHaveBeenCalledTimes(calls);
    });
});
