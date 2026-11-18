// @vitest-environment jsdom
/**
 * Component tests for restoring soft-deleted catalog rows (HOS-2340 US-1,
 * AC-1.1 to AC-1.9) on both the groups and the categories tab.
 *
 * Network is mocked at `@/lib/api/client`; translations are mocked globally in
 * `test/setup.tsx` to return the key, so assertions use i18n keys.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isGroupStillDeletedError } from '@/hooks/use-host-trade-categories';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { HostTradeCategoriesSection } from '../components/HostTradeCategoriesSection';
import { HostTradeCategoryGroupsSection } from '../components/HostTradeCategoryGroupsSection';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

const FULL_PERMISSIONS = [
    'hostTradeCategory.view',
    'hostTradeCategory.create',
    'hostTradeCategory.update',
    'hostTradeCategory.delete',
    'hostTradeCategory.restore'
];
const mockPermissions = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockPermissions.value
}));

const mockedFetchApi = vi.mocked(fetchApi);

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const DELETED_GROUP_ID = '33333333-3333-4333-8333-333333333333';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const DELETED_CATEGORY_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-11-01T00:00:00.000Z';

const group = (overrides: Record<string, unknown>) => ({
    slug: 'g',
    nameI18n: { es: 'Grupo', en: 'Group', pt: 'Grupo' },
    displayWeight: 10,
    lifecycleState: 'ACTIVE',
    deletedAt: null,
    ...overrides
});
const category = (overrides: Record<string, unknown>) => ({
    slug: 'c',
    groupId: GROUP_ID,
    nameI18n: { es: 'Cat', en: 'Cat', pt: 'Cat' },
    keywordsI18n: { es: [], en: [], pt: [] },
    displayWeight: 10,
    lifecycleState: 'ACTIVE',
    deletedAt: null,
    ...overrides
});

const LIVE_GROUP = group({ id: GROUP_ID, slug: 'vivo' });
const DELETED_GROUP = group({ id: DELETED_GROUP_ID, slug: 'borrado', deletedAt: NOW });
const LIVE_CATEGORY = category({ id: CATEGORY_ID, slug: 'viva' });
const DELETED_CATEGORY = category({ id: DELETED_CATEGORY_ID, slug: 'borrada', deletedAt: NOW });

const page = <T,>(items: T[]) => ({
    data: {
        success: true,
        data: { items, pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 } }
    },
    status: 200
});

/** Answers lists according to `includeDeleted`, and lets a test script the writes. */
function mockApi(write?: (input: { path: string; method?: string }) => unknown) {
    mockedFetchApi.mockImplementation(async (input) => {
        if (!input.method || input.method === 'GET') {
            const withDeleted = input.path.includes('includeDeleted=true');
            if (input.path.includes('/host-trade-category-groups')) {
                return page(withDeleted ? [LIVE_GROUP, DELETED_GROUP] : [LIVE_GROUP]) as never;
            }
            return page(withDeleted ? [LIVE_CATEGORY, DELETED_CATEGORY] : [LIVE_CATEGORY]) as never;
        }
        if (write) return (await write(input)) as never;
        return { data: { success: true }, status: 200 } as never;
    });
}

function renderWithClient(ui: ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const listPaths = () => mockedFetchApi.mock.calls.map(([input]) => input.path);
const restoreCalls = () =>
    mockedFetchApi.mock.calls.filter(([input]) => input.method === 'POST').map(([input]) => input);

beforeEach(() => {
    mockPermissions.value = FULL_PERMISSIONS;
    mockApi();
});
afterEach(() => vi.clearAllMocks());

describe('isGroupStillDeletedError', () => {
    it('recognizes the groupId validation refusal by its details', () => {
        const error = new ApiError('x', { status: 400, details: { field: 'groupId' } });
        expect(isGroupStillDeletedError(error)).toBe(true);
    });

    it('recognizes the server VALIDATION_ERROR code when the API strips the details', () => {
        const error = new ApiError('x', {
            status: 400,
            body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'x' } }
        });
        expect(isGroupStillDeletedError(error)).toBe(true);
    });

    it('does not treat a bare 400 or 422 without the server code as the group refusal', () => {
        expect(isGroupStillDeletedError(new ApiError('x', { status: 400 }))).toBe(false);
        expect(isGroupStillDeletedError(new ApiError('x', { status: 422 }))).toBe(false);
    });

    it('does not treat other failures as the group refusal', () => {
        expect(isGroupStillDeletedError(new ApiError('x', { status: 500 }))).toBe(false);
        expect(isGroupStillDeletedError(new ApiError('x', { status: 404 }))).toBe(false);
        expect(isGroupStillDeletedError(new Error('network'))).toBe(false);
    });
});

describe('categories tab', () => {
    it('hides deleted rows by default and does not send includeDeleted (AC-1.1)', async () => {
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        expect((screen.getByTestId('category-show-deleted') as HTMLInputElement).checked).toBe(
            false
        );
        expect(screen.queryByTestId(`category-row-${DELETED_CATEGORY_ID}`)).toBeNull();
        expect(listPaths().some((path) => path.includes('includeDeleted'))).toBe(false);
    });

    it('shows deleted rows with a badge and a restore button when toggled on (AC-1.2, AC-1.3)', async () => {
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        fireEvent.click(screen.getByTestId('category-show-deleted'));

        const row = await screen.findByTestId(`category-row-${DELETED_CATEGORY_ID}`);
        expect(within(row).getByText('admin-pages.hostTradeCategories.state.deleted')).toBeTruthy();
        expect(screen.getByTestId(`category-restore-${DELETED_CATEGORY_ID}`)).toBeTruthy();
        expect(screen.queryByTestId(`category-edit-${DELETED_CATEGORY_ID}`)).toBeNull();
        expect(screen.queryByTestId(`category-delete-${DELETED_CATEGORY_ID}`)).toBeNull();
        // the live row keeps its normal actions and has no restore
        expect(screen.getByTestId(`category-edit-${CATEGORY_ID}`)).toBeTruthy();
        expect(screen.queryByTestId(`category-restore-${CATEGORY_ID}`)).toBeNull();
        expect(
            listPaths().some(
                (path) =>
                    path.includes('/host-trade-categories?') && path.includes('includeDeleted=true')
            )
        ).toBe(true);
    });

    it('does not render the restore button without the restore permission (AC-1.3)', async () => {
        mockPermissions.value = FULL_PERMISSIONS.filter((p) => p !== 'hostTradeCategory.restore');
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        fireEvent.click(screen.getByTestId('category-show-deleted'));
        await screen.findByTestId(`category-row-${DELETED_CATEGORY_ID}`);

        expect(screen.queryByTestId(`category-restore-${DELETED_CATEGORY_ID}`)).toBeNull();
    });

    it('restores a category, toasts and refetches the lists (AC-1.5)', async () => {
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        const button = await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`);
        const getsBefore = listPaths().length;

        fireEvent.click(button);

        await waitFor(() => {
            expect(restoreCalls()[0]?.path).toBe(
                `/api/v1/admin/host-trade-categories/${DELETED_CATEGORY_ID}/restore`
            );
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'success',
                    message: 'admin-pages.hostTradeCategories.categories.messages.restored'
                })
            );
        });
        // both catalog lists are invalidated, so they are read again
        await waitFor(() => expect(listPaths().length).toBeGreaterThan(getsBefore + 1));
        expect(
            listPaths()
                .slice(getsBefore)
                .some((path) => path.includes('/host-trade-category-groups'))
        ).toBe(true);
    });

    it('disables the button and shows the progress label while restoring (AC-1.8)', async () => {
        let release: () => void = () => undefined;
        mockApi(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ data: { success: true }, status: 200 });
                })
        );
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        fireEvent.click(await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`));

        await waitFor(() => {
            const pending = screen.getByTestId(
                `category-restore-${DELETED_CATEGORY_ID}`
            ) as HTMLButtonElement;
            expect(pending.disabled).toBe(true);
            expect(pending.textContent).toBe('admin-pages.hostTradeCategories.actions.restoring');
        });
        release();
    });

    it('shows the generic message for a bare 400 without the server code (AC-1.7)', async () => {
        mockApi(() => {
            throw new ApiError('bad request', { status: 400 });
        });
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        fireEvent.click(await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.hostTradeCategories.messages.restoreError'
                })
            );
        });
    });

    it('explains the group must be restored first from the real server shape (AC-1.6)', async () => {
        mockApi(() => {
            throw new ApiError('group deleted', {
                status: 400,
                body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'x' } }
            });
        });
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        fireEvent.click(await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    message:
                        'admin-pages.hostTradeCategories.categories.messages.restoreGroupDeleted'
                })
            );
        });
    });

    it('explains that the group must be restored first (AC-1.6)', async () => {
        mockApi(() => {
            throw new ApiError('group deleted', { status: 400, details: { field: 'groupId' } });
        });
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        fireEvent.click(await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message:
                        'admin-pages.hostTradeCategories.categories.messages.restoreGroupDeleted'
                })
            );
        });
        await waitFor(() => {
            const button = screen.getByTestId(
                `category-restore-${DELETED_CATEGORY_ID}`
            ) as HTMLButtonElement;
            expect(button.disabled).toBe(false);
        });
    });

    it('shows a generic error and refetches on any other failure (AC-1.7)', async () => {
        mockApi(() => {
            throw new ApiError('boom', { status: 500 });
        });
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));
        const button = await screen.findByTestId(`category-restore-${DELETED_CATEGORY_ID}`);
        const getsBefore = listPaths().length;

        fireEvent.click(button);

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.hostTradeCategories.messages.restoreError'
                })
            );
        });
        await waitFor(() => expect(listPaths().length).toBeGreaterThan(getsBefore));
    });

    it('keeps a row visible with the badge after deleting it while the toggle is on (AC-1.9)', async () => {
        let deleted = false;
        mockedFetchApi.mockImplementation(async (input) => {
            if (input.method === 'DELETE') {
                deleted = true;
                return { data: { success: true }, status: 200 } as never;
            }
            if (input.path.includes('/host-trade-category-groups'))
                return page([LIVE_GROUP]) as never;
            const row = deleted ? { ...LIVE_CATEGORY, deletedAt: NOW } : LIVE_CATEGORY;
            return page([row]) as never;
        });
        renderWithClient(<HostTradeCategoriesSection />);
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        fireEvent.click(screen.getByTestId('category-show-deleted'));

        fireEvent.click(await screen.findByTestId(`category-delete-${CATEGORY_ID}`));
        fireEvent.click(await screen.findByTestId('category-delete-confirm'));

        const row = await screen.findByTestId(`category-row-${CATEGORY_ID}`);
        await waitFor(() => {
            expect(
                within(screen.getByTestId(`category-row-${CATEGORY_ID}`)).getByText(
                    'admin-pages.hostTradeCategories.state.deleted'
                )
            ).toBeTruthy();
        });
        expect(row).toBeTruthy();
    });
});

describe('groups tab', () => {
    it('hides deleted rows by default (AC-1.1)', async () => {
        renderWithClient(<HostTradeCategoryGroupsSection />);
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        expect((screen.getByTestId('group-show-deleted') as HTMLInputElement).checked).toBe(false);
        expect(screen.queryByTestId(`group-row-${DELETED_GROUP_ID}`)).toBeNull();
        expect(listPaths().some((path) => path.includes('includeDeleted'))).toBe(false);
    });

    it('shows deleted groups with a badge and restore, hiding edit and delete (AC-1.2, AC-1.3)', async () => {
        renderWithClient(<HostTradeCategoryGroupsSection />);
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        fireEvent.click(screen.getByTestId('group-show-deleted'));

        const row = await screen.findByTestId(`group-row-${DELETED_GROUP_ID}`);
        expect(within(row).getByText('admin-pages.hostTradeCategories.state.deleted')).toBeTruthy();
        expect(screen.getByTestId(`group-restore-${DELETED_GROUP_ID}`)).toBeTruthy();
        expect(screen.queryByTestId(`group-edit-${DELETED_GROUP_ID}`)).toBeNull();
        expect(screen.queryByTestId(`group-delete-${DELETED_GROUP_ID}`)).toBeNull();
    });

    it('does not render the restore button without the permission (AC-1.3)', async () => {
        mockPermissions.value = FULL_PERMISSIONS.filter((p) => p !== 'hostTradeCategory.restore');
        renderWithClient(<HostTradeCategoryGroupsSection />);
        await screen.findByTestId(`group-row-${GROUP_ID}`);

        fireEvent.click(screen.getByTestId('group-show-deleted'));
        await screen.findByTestId(`group-row-${DELETED_GROUP_ID}`);

        expect(screen.queryByTestId(`group-restore-${DELETED_GROUP_ID}`)).toBeNull();
    });

    it('restores a group, toasts and refetches (AC-1.4)', async () => {
        renderWithClient(<HostTradeCategoryGroupsSection />);
        await screen.findByTestId(`group-row-${GROUP_ID}`);
        fireEvent.click(screen.getByTestId('group-show-deleted'));
        const button = await screen.findByTestId(`group-restore-${DELETED_GROUP_ID}`);
        const getsBefore = listPaths().length;

        fireEvent.click(button);

        await waitFor(() => {
            expect(restoreCalls()[0]?.path).toBe(
                `/api/v1/admin/host-trade-category-groups/${DELETED_GROUP_ID}/restore`
            );
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'success',
                    message: 'admin-pages.hostTradeCategories.groups.messages.restored'
                })
            );
        });
        await waitFor(() => expect(listPaths().length).toBeGreaterThan(getsBefore));
    });

    it('shows a generic error when the restore fails (AC-1.7)', async () => {
        mockApi(() => {
            throw new ApiError('boom', { status: 500 });
        });
        renderWithClient(<HostTradeCategoryGroupsSection />);
        await screen.findByTestId(`group-row-${GROUP_ID}`);
        fireEvent.click(screen.getByTestId('group-show-deleted'));
        fireEvent.click(await screen.findByTestId(`group-restore-${DELETED_GROUP_ID}`));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.hostTradeCategories.messages.restoreError'
                })
            );
        });
    });
});
