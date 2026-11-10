// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAdminSubscriptionsPath } from '../../hooks/useAdminSubscriptions';
import { SubscriptionsListScreen } from '../SubscriptionsListScreen';

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        params,
        children,
        ...rest
    }: {
        to: string;
        params?: Record<string, string>;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => {
        let href = to;
        for (const [name, value] of Object.entries(params ?? {})) {
            href = href.replace(`$${name}`, value);
        }
        return React.createElement('a', { href, ...(rest as Record<string, unknown>) }, children);
    }
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            let value: unknown = es;
            for (const part of key.replace('admin-billing.', '').split('.')) {
                value =
                    typeof value === 'object' && value !== null
                        ? (value as Record<string, unknown>)[part]
                        : undefined;
            }
            return typeof value === 'string'
                ? Object.entries(params ?? {}).reduce(
                      (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
                      value
                  )
                : key;
        }
    })
}));

const permissions = vi.hoisted(() => ({
    current: ['billing.subscription.inspect'] as string[]
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions.current
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));

type HookArgs = {
    page: number;
    pageSize: number;
    q?: string;
    vertical?: string;
    status?: string;
};

const listHook = vi.hoisted(() => ({
    args: [] as HookArgs[],
    result: { current: {} as Record<string, unknown> }
}));

vi.mock('../../hooks/useAdminSubscriptions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../hooks/useAdminSubscriptions')>();
    return {
        ...actual,
        useAdminSubscriptions: (args: HookArgs) => {
            listHook.args.push(args);
            return listHook.result.current;
        }
    };
});

const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

const items = [
    {
        id: FIRST_ID,
        status: 'ACTIVE',
        class: 'PRINCIPAL',
        vertical: 'accommodation',
        owner: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'owner-one@example.test',
            displayName: 'Owner One',
            deleted: false
        },
        plan: {
            planId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            planName: 'Plan Base',
            planVersionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        },
        cycle: 'monthly',
        paymentMethod: 'CARD',
        nextChargeAt: '2026-12-07T03:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: SECOND_ID,
        status: 'PAUSED',
        class: 'COMPLEMENTO',
        vertical: 'venue',
        owner: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            email: 'owner-two@example.test',
            displayName: null,
            deleted: true
        },
        plan: null,
        cycle: null,
        paymentMethod: 'MANUAL',
        nextChargeAt: null,
        createdAt: '2026-02-01T00:00:00.000Z'
    }
];

const listPage = {
    items,
    pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 }
};

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <SubscriptionsListScreen />
        </QueryClientProvider>
    );
}

function lastArgs(): HookArgs {
    return listHook.args[listHook.args.length - 1] as HookArgs;
}

describe('HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        listHook.args = [];
        listHook.result.current = {
            isLoading: false,
            isError: false,
            data: listPage,
            refetch: vi.fn()
        };
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders exactly the rows returned by the list response', () => {
        renderScreen();
        expect(screen.getAllByTestId('subscriptions-row')).toHaveLength(items.length);
    });

    it('sends q after the debounce and returns to the first page', () => {
        renderScreen();
        expect(lastArgs()).toMatchObject({ page: 1 });

        fireEvent.click(screen.getByRole('button', { name: 'ui.table.next' }));
        expect(lastArgs()).toMatchObject({ page: 2 });

        fireEvent.change(screen.getByTestId('subscriptions-search'), {
            target: { value: 'owner-one@example.test' }
        });
        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(lastArgs().q).toBeUndefined();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(lastArgs()).toMatchObject({ page: 1, q: 'owner-one@example.test' });
    });

    it('sends the selected status and vertical filters', () => {
        renderScreen();
        fireEvent.change(screen.getByTestId('subscriptions-filter-status'), {
            target: { value: 'PAUSED' }
        });
        expect(lastArgs()).toMatchObject({ page: 1, status: 'PAUSED' });

        fireEvent.change(screen.getByTestId('subscriptions-filter-vertical'), {
            target: { value: 'venue' }
        });
        expect(lastArgs()).toMatchObject({ vertical: 'venue' });
    });

    it('requests the next page when pagination advances', () => {
        renderScreen();
        fireEvent.click(screen.getByRole('button', { name: 'ui.table.next' }));
        expect(lastArgs()).toMatchObject({ page: 2, pageSize: 20 });
    });

    it('links every row to its own detail page', () => {
        renderScreen();
        const hrefs = screen
            .getAllByTestId('subscriptions-row')
            .map((link) => link.getAttribute('href'));
        expect(hrefs).toEqual([
            `/billing/subscriptions/${FIRST_ID}`,
            `/billing/subscriptions/${SECOND_ID}`
        ]);
    });

    it('marks a deleted owner', () => {
        renderScreen();
        expect(screen.getAllByText(/Cuenta borrada/)).toHaveLength(1);
    });
});

describe('HOS-2081 list query path', () => {
    it('carries every filter that has a value and omits empty search terms', () => {
        expect(
            buildAdminSubscriptionsPath({
                page: 2,
                pageSize: 20,
                q: 'owner-one@example.test',
                vertical: 'venue' as never,
                status: 'PAUSED'
            })
        ).toBe(
            '/api/v1/admin/billing-subscription?page=2&pageSize=20&q=owner-one%40example.test&vertical=venue&status=PAUSED'
        );
        expect(buildAdminSubscriptionsPath({ page: 1, pageSize: 20, q: '   ' })).toBe(
            '/api/v1/admin/billing-subscription?page=1&pageSize=20'
        );
    });
});
