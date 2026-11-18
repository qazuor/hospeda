// @vitest-environment jsdom
/**
 * Component tests for the category GROUPS half of the provider trade catalog
 * screen (HOS-919 T-043).
 *
 * Covers: the table renders the rows, the create dialog refuses a blank
 * Spanish name, the slug input is locked when editing, a `409 CATEGORY_IN_USE`
 * delete surfaces its own message (deactivation is the suggested way out), and
 * the menu entry exists only behind `HOST_TRADE_CATEGORY_VIEW`.
 *
 * Network is mocked at `@/lib/api/client`; translations are mocked globally in
 * `test/setup.tsx` to return the key, so assertions use i18n keys.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sidebars } from '@/config/ia/sidebars';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { HostTradeCategoryGroupsSection } from '../components/HostTradeCategoryGroupsSection';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

const mockPermissions = vi.hoisted(() => ({
    value: [
        'hostTradeCategory.view',
        'hostTradeCategory.create',
        'hostTradeCategory.update',
        'hostTradeCategory.delete'
    ] as string[]
}));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockPermissions.value
}));

const mockedFetchApi = vi.mocked(fetchApi);

const GROUP_ID = '11111111-1111-4111-8111-111111111111';

const GROUP_ROW = {
    id: GROUP_ID,
    slug: 'instalaciones',
    nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
    displayWeight: 10,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
};

const LIST_RESPONSE = {
    data: {
        success: true,
        data: {
            items: [GROUP_ROW],
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 }
        }
    },
    status: 200
};

function renderSection() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <HostTradeCategoryGroupsSection />
        </QueryClientProvider>
    );
}

/** Answers every GET with the list and lets a test script the writes. */
function mockApi(write?: (input: { path: string; method?: string; body?: unknown }) => unknown) {
    mockedFetchApi.mockImplementation(async (input) => {
        if (!input.method || input.method === 'GET') return LIST_RESPONSE as never;
        if (write) return (await write(input)) as never;
        return { data: { success: true, data: GROUP_ROW }, status: 200 } as never;
    });
}

beforeEach(() => {
    mockPermissions.value = [
        'hostTradeCategory.view',
        'hostTradeCategory.create',
        'hostTradeCategory.update',
        'hostTradeCategory.delete'
    ];
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('HostTradeCategoryGroupsSection', () => {
    it('renders the groups table with name, slug and state', async () => {
        mockApi();
        renderSection();

        const row = await screen.findByTestId(`group-row-${GROUP_ID}`);

        expect(within(row).getByText('Instalaciones')).toBeTruthy();
        expect(within(row).getByText('instalaciones')).toBeTruthy();
        expect(within(row).getByText('admin-pages.hostTradeCategories.state.active')).toBeTruthy();
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining('/api/v1/admin/host-trade-category-groups')
            })
        );
    });

    it('does not let the create dialog submit without a Spanish name', async () => {
        mockApi();
        renderSection();
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        fireEvent.click(screen.getByTestId('group-add'));
        fireEvent.change(await screen.findByTestId('group-slug'), {
            target: { value: 'nuevo-grupo' }
        });
        fireEvent.click(screen.getByTestId('group-save'));

        await waitFor(() => {
            expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        });
        const writes = mockedFetchApi.mock.calls.filter(([input]) => input.method === 'POST');
        expect(writes).toHaveLength(0);
    });

    it('creates a group with the typed slug and name', async () => {
        mockApi();
        renderSection();
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        fireEvent.click(screen.getByTestId('group-add'));
        fireEvent.change(await screen.findByTestId('group-slug'), {
            target: { value: 'nuevo-grupo' }
        });
        fireEvent.change(document.getElementById('field-nameI18n-es') as HTMLInputElement, {
            target: { value: 'Nuevo grupo' }
        });
        fireEvent.click(screen.getByTestId('group-save'));

        await waitFor(() => {
            const post = mockedFetchApi.mock.calls.find(([input]) => input.method === 'POST');
            expect(post?.[0].body).toMatchObject({
                slug: 'nuevo-grupo',
                nameI18n: { es: 'Nuevo grupo' }
            });
        });
    });

    it('locks the slug input while editing and never sends it in the PATCH', async () => {
        mockApi();
        renderSection();

        fireEvent.click(await screen.findByTestId(`group-edit-${GROUP_ID}`));
        const slugInput = (await screen.findByTestId('group-slug')) as HTMLInputElement;

        expect(slugInput.disabled).toBe(true);
        expect(slugInput.value).toBe('instalaciones');

        fireEvent.click(screen.getByTestId('group-save'));

        await waitFor(() => {
            const patch = mockedFetchApi.mock.calls.find(([input]) => input.method === 'PATCH');
            expect(patch?.[0].path).toContain(GROUP_ID);
            expect(patch?.[0].body).not.toHaveProperty('slug');
        });
    });

    it('sends lifecycleState INACTIVE when the active switch is turned off', async () => {
        mockApi();
        renderSection();

        fireEvent.click(await screen.findByTestId(`group-edit-${GROUP_ID}`));
        fireEvent.click(await screen.findByTestId('group-active'));
        fireEvent.click(screen.getByTestId('group-save'));

        await waitFor(() => {
            const patch = mockedFetchApi.mock.calls.find(([input]) => input.method === 'PATCH');
            expect(patch?.[0].body).toMatchObject({ lifecycleState: 'INACTIVE' });
        });
    });

    it('explains a 409 CATEGORY_IN_USE delete and suggests deactivating', async () => {
        mockApi(() => {
            throw new ApiError('conflict', {
                status: 409,
                code: 'CATEGORY_IN_USE' as never
            });
        });
        renderSection();

        fireEvent.click(await screen.findByTestId(`group-delete-${GROUP_ID}`));
        fireEvent.click(await screen.findByTestId('group-delete-confirm'));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.hostTradeCategories.groups.messages.inUse'
                })
            );
        });
    });

    it('hides the write buttons from a viewer without create, update or delete', async () => {
        mockPermissions.value = ['hostTradeCategory.view'];
        mockApi();
        renderSection();
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        expect(screen.queryByTestId('group-add')).toBeNull();
        expect(screen.queryByTestId(`group-edit-${GROUP_ID}`)).toBeNull();
        expect(screen.queryByTestId(`group-delete-${GROUP_ID}`)).toBeNull();
    });
});

describe('host trade category menu entry', () => {
    const items = (sidebars.plataformaSidebar?.items ?? []).flatMap((item) =>
        item.type === 'group' ? item.items : [item]
    );

    it('is declared next to the host-trades entries and gated by HOST_TRADE_CATEGORY_VIEW', () => {
        const link = items.find(
            (item) => item.type === 'link' && item.id === 'host-trade-categories'
        );

        expect(link).toBeDefined();
        expect(link).toMatchObject({
            route: '/content/host-trade-categories',
            permissions: ['HOST_TRADE_CATEGORY_VIEW']
        });
    });
});
