// @vitest-environment jsdom
/** Tests for the stuck-refund list and the forms that pick from it (HOS-2560). */

import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import type { StuckRefund } from '@repo/schemas';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStuckRefundsPath } from '../../hooks/useStuckRefunds';
import { formatStuckRefundAge } from '../../stuck-refund-format';
import { StuckRefundsWorkspace } from '../StuckRefundsWorkspace';

const state = vi.hoisted(() => ({
    permissions: [] as string[],
    items: [] as unknown[],
    retry: vi.fn(),
    settle: vi.fn()
}));

function translate(key: string, params?: Record<string, unknown>): string {
    const text = key
        .split('.')
        .slice(1)
        .reduce((obj: any, part) => obj?.[part], es) as string | undefined;
    return Object.entries(params ?? {}).reduce(
        (out, [name, value]) => out.replace(`{{${name}}}`, String(value)),
        text ?? key
    );
}

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: string) => state.permissions.includes(permission)
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ locale: 'es', t: translate })
}));
vi.mock('../../hooks/useStuckRefunds', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useStuckRefunds: () => ({
        isLoading: false,
        isError: false,
        data: {
            items: state.items,
            pagination: {
                page: 1,
                pageSize: 50,
                total: state.items.length,
                totalPages: 1
            }
        },
        refetch: vi.fn()
    })
}));
vi.mock('../../hooks/useRetryRefundProviderCalls', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useRetryRefundProviderCalls: () => ({ mutateAsync: state.retry, isPending: false })
}));
vi.mock('../../hooks/useSettleRefundRemainder', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useSettleRefundRemainder: () => ({ mutateAsync: state.settle, isPending: false })
}));

const RETRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SETTLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NONE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const copy = es.proposedRefunds;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function stuck(overrides: Partial<StuckRefund> = {}): StuckRefund {
    return {
        refundId: RETRY_ID,
        amountMinor: 10000,
        currency: 'ARS',
        createdAt: hoursAgo(40),
        payment: { source: 'PAYMENT', id: PAYMENT_ID },
        providerCallCount: 1,
        unansweredCallCount: 1,
        oldestUnansweredAt: hoursAgo(2),
        acceptedAmountMinor: 0,
        suggestedAction: 'RETRY',
        ...overrides
    };
}

const row = (refundId: string) =>
    screen
        .getAllByTestId('stuck-refund')
        .find((element) => element.dataset.refundId === refundId) as HTMLElement;
const retryForm = () => screen.getByTestId('refund-provider-call-retry');
const settleForm = () => screen.getByTestId('refund-remainder-settlement');

beforeEach(() => {
    state.permissions = ['billing.refund', 'billing.settleExternal'];
    state.items = [
        stuck(),
        stuck({
            refundId: SETTLE_ID,
            oldestUnansweredAt: hoursAgo(30),
            acceptedAmountMinor: 4000,
            suggestedAction: 'SETTLE_REMAINDER'
        }),
        stuck({ refundId: NONE_ID, suggestedAction: null })
    ];
    state.retry.mockReset();
    state.settle.mockReset();
});

describe('StuckRefundsWorkspace', () => {
    it('lists each stuck refund with its calls, age, accepted amount and one suggested action', () => {
        // Act
        render(<StuckRefundsWorkspace />);

        // Assert
        expect(screen.getAllByTestId('stuck-refund')).toHaveLength(3);
        const settle = row(SETTLE_ID);
        expect(within(settle).getByTestId('stuck-refund-calls')).toHaveTextContent('hace 30 h');
        expect(within(settle).getByTestId('stuck-refund-accepted')).toHaveTextContent('40');
        expect(within(settle).getAllByRole('button')).toHaveLength(1);
        expect(
            within(settle).getByRole('button', { name: copy.stuck.actions.SETTLE_REMAINDER })
        ).toBeTruthy();
        expect(
            within(row(RETRY_ID)).getByRole('button', { name: copy.stuck.actions.RETRY })
        ).toBeTruthy();
        expect(within(row(RETRY_ID)).queryByTestId('stuck-refund-accepted')).toBeNull();
        expect(within(row(NONE_ID)).queryByRole('button')).toBeNull();
        expect(row(NONE_ID)).toHaveTextContent(copy.stuck.noAction);
    });

    it('shows the empty state when nothing is stuck', () => {
        state.items = [];
        render(<StuckRefundsWorkspace />);
        expect(screen.getByTestId('stuck-refunds-empty')).toHaveTextContent(copy.stuck.empty);
    });

    it('picks the refund in «Retry with MP» and focuses its selector when the row action is clicked', async () => {
        // Arrange
        state.retry.mockResolvedValue({
            refundId: RETRY_ID,
            status: 'EXECUTED',
            calls: [],
            execution: 'EXECUTED'
        });
        render(<StuckRefundsWorkspace />);

        // Act
        fireEvent.click(
            within(row(RETRY_ID)).getByRole('button', { name: copy.stuck.actions.RETRY })
        );

        // Assert: the selector holds the refund and has the focus; the review sends it.
        const select = within(retryForm()).getByLabelText(copy.picker.label) as HTMLSelectElement;
        expect(select.value).toBe(RETRY_ID);
        await waitFor(() => expect(document.activeElement).toBe(select));
        fireEvent.click(
            within(retryForm()).getByRole('button', { name: copy.providerRetry.review })
        );
        fireEvent.click(
            within(retryForm()).getByRole('button', { name: copy.providerRetry.confirm })
        );
        await waitFor(() => expect(state.retry).toHaveBeenCalledWith({ refundId: RETRY_ID }));
    });

    it('picks the refund in the remainder settlement when its row action is clicked', () => {
        render(<StuckRefundsWorkspace />);
        fireEvent.click(
            within(row(SETTLE_ID)).getByRole('button', {
                name: copy.stuck.actions.SETTLE_REMAINDER
            })
        );
        const select = within(settleForm()).getByLabelText(copy.picker.label) as HTMLSelectElement;
        expect(select.value).toBe(SETTLE_ID);
        expect(
            (within(retryForm()).getByLabelText(copy.picker.label) as HTMLSelectElement).value
        ).toBe('');
    });

    it('offers every stuck refund in the selectors, labeled by amount, payment and age', () => {
        render(<StuckRefundsWorkspace />);
        const select = within(retryForm()).getByLabelText(copy.picker.label);
        const options = within(select).getAllByRole('option');
        expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual([
            '',
            RETRY_ID,
            SETTLE_ID,
            NONE_ID
        ]);
        expect(options[2]).toHaveTextContent('cccccccc · hace 30 h');
    });

    it('hides the settle button and form from who may not run action 14', () => {
        // Arrange
        state.permissions = ['billing.refund'];

        // Act
        render(<StuckRefundsWorkspace />);

        // Assert
        expect(within(row(SETTLE_ID)).queryByRole('button')).toBeNull();
        expect(screen.queryByTestId('refund-remainder-settlement')).toBeNull();
        expect(screen.queryByTestId('refund-remainder-settlement-by-id')).toBeNull();
        expect(within(row(RETRY_ID)).getByRole('button')).toBeTruthy();
    });

    it('keeps the by-id fallback, which still submits a typed refund id', async () => {
        // Arrange
        const typed = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        state.retry.mockResolvedValue({
            refundId: typed,
            status: 'EXECUTED',
            calls: [],
            execution: 'EXECUTED'
        });
        render(<StuckRefundsWorkspace />);
        const fallback = within(screen.getByTestId('refund-operate-by-id'));
        const byId = within(screen.getByTestId('refund-provider-call-retry-by-id'));
        expect(fallback.getByText(copy.operateById.title)).toBeTruthy();

        // Act
        fireEvent.change(byId.getByLabelText(copy.providerRetry.refundId), {
            target: { value: 'not-a-uuid' }
        });
        const review = byId.getByRole('button', { name: copy.providerRetry.review });
        expect(review).toBeDisabled();
        fireEvent.change(byId.getByLabelText(copy.providerRetry.refundId), {
            target: { value: typed }
        });
        fireEvent.click(review);
        fireEvent.click(byId.getByRole('button', { name: copy.providerRetry.confirm }));

        // Assert
        await waitFor(() => expect(state.retry).toHaveBeenCalledWith({ refundId: typed }));
        expect(screen.getByTestId('refund-remainder-settlement-by-id')).toBeTruthy();
    });
});

describe('stuck-refund helpers', () => {
    it('builds the list path', () => {
        expect(buildStuckRefundsPath({ page: 2, pageSize: 50 })).toBe(
            '/api/v1/admin/billing-refunds/stuck?page=2&pageSize=50'
        );
    });

    it('formats the age in minutes, hours or days', () => {
        const now = new Date('2026-11-22T12:00:00.000Z');
        const age = (since: string) => formatStuckRefundAge({ since, now, t: translate });
        expect(age('2026-11-22T11:50:00.000Z')).toBe('hace 10 min');
        expect(age('2026-11-21T06:00:00.000Z')).toBe('hace 30 h');
        expect(age('2026-11-18T12:00:00.000Z')).toBe('hace 4 d');
    });

    it('has the same stuck, picker and by-id keys in es, en and pt', () => {
        const keysOf = (node: unknown, prefix = ''): string[] =>
            typeof node === 'object' && node !== null
                ? Object.entries(node).flatMap(([key, value]) => keysOf(value, `${prefix}${key}.`))
                : [prefix];
        for (const section of ['stuck', 'picker', 'operateById'] as const) {
            const esKeys = keysOf(es.proposedRefunds[section]).sort();
            expect(keysOf(en.proposedRefunds[section]).sort()).toEqual(esKeys);
            expect(keysOf(pt.proposedRefunds[section]).sort()).toEqual(esKeys);
        }
    });
});
