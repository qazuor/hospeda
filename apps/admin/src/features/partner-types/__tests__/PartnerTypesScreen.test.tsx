// @vitest-environment jsdom
/**
 * Component tests for the partner type catalog screen (HOS-2336).
 *
 * Covers AC-3.1 (rows with name, slug, weight, state and partner count),
 * AC-3.3 (slug locked on edit, never in the PATCH), AC-3.4 (a 409
 * PARTNER_TYPE_IN_USE names its count; another 409 does not read as in use),
 * AC-3.5 ("Mostrar borrados" asks for deleted rows; restore hidden without
 * `partnerType.restore`) and AC-3.6 (menu entry gated by PARTNER_TYPE_VIEW).
 *
 * Network is mocked at `@/lib/api/client`; translations are mocked globally in
 * `test/setup.tsx` to return the key, so assertions use i18n keys.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sidebars } from '@/config/ia/sidebars';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { PartnerTypesScreen } from '../components/PartnerTypesScreen';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

const ALL_PERMISSIONS = [
    'partnerType.view',
    'partnerType.create',
    'partnerType.update',
    'partnerType.delete',
    'partnerType.restore'
];
const mockPermissions = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockPermissions.value
}));

const mockedFetchApi = vi.mocked(fetchApi);

const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';

const MEDIA_ROW = {
    id: MEDIA_ID,
    slug: 'media',
    nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
    displayWeight: 40,
    lifecycleState: 'ACTIVE',
    partnerCount: 3,
    deletedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
};

const DELETED_ROW = {
    ...MEDIA_ROW,
    id: PERSON_ID,
    slug: 'person',
    nameI18n: { es: 'Persona' },
    displayWeight: 50,
    partnerCount: 0,
    deletedAt: '2026-11-10T00:00:00.000Z'
};

const listResponse = (items: readonly unknown[]) => ({
    data: {
        success: true,
        data: { items, pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 } }
    },
    status: 200
});

/** Answers GETs with the list (deleted rows only when asked) and scripts the writes. */
function mockApi(write?: (input: { path: string; method?: string; body?: unknown }) => unknown) {
    mockedFetchApi.mockImplementation(async (input) => {
        if (!input.method || input.method === 'GET') {
            const withDeleted = input.path.includes('includeDeleted=true');
            return listResponse(withDeleted ? [MEDIA_ROW, DELETED_ROW] : [MEDIA_ROW]) as never;
        }
        if (write) return (await write(input)) as never;
        return { data: { success: true, data: MEDIA_ROW }, status: 200 } as never;
    });
}

function renderScreen() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <PartnerTypesScreen />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    mockPermissions.value = [...ALL_PERMISSIONS];
    mockedFetchApi.mockReset();
    mockAddToast.mockReset();
});

describe('PartnerTypesScreen', () => {
    it('renders name, slug, weight, state and partner count (AC-3.1)', async () => {
        mockApi();
        renderScreen();

        const row = await screen.findByTestId(`partner-type-row-${MEDIA_ID}`);
        expect(row.textContent).toContain('Medio');
        expect(row.textContent).toContain('media');
        expect(row.textContent).toContain('40');
        expect(row.textContent).toContain('3');
        expect(screen.getByTestId(`partner-type-state-${MEDIA_ID}`).textContent).toBe(
            'admin-pages.partnerTypes.state.active'
        );
    });

    it('locks the slug while editing and never sends it in the PATCH (AC-3.3)', async () => {
        const writes: { path: string; method?: string; body?: unknown }[] = [];
        mockApi((input) => {
            writes.push(input);
            return { data: { success: true, data: MEDIA_ROW }, status: 200 };
        });
        renderScreen();

        fireEvent.click(await screen.findByTestId(`partner-type-edit-${MEDIA_ID}`));
        expect((screen.getByTestId('partner-type-slug') as HTMLInputElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId('partner-type-save'));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes[0]).toMatchObject({ path: `/api/v1/admin/partner-types/${MEDIA_ID}` });
        expect(writes[0]?.method).toBe('PATCH');
        expect(writes[0]?.body).not.toHaveProperty('slug');
    });

    it('names the count when a delete answers 409 PARTNER_TYPE_IN_USE (AC-3.4)', async () => {
        mockApi(() => {
            throw new ApiError('conflict', {
                status: 409,
                code: 'PARTNER_TYPE_IN_USE' as never,
                details: { partnerTypeId: MEDIA_ID, count: 3 }
            });
        });
        renderScreen();

        fireEvent.click(await screen.findByTestId(`partner-type-delete-${MEDIA_ID}`));
        fireEvent.click(await screen.findByTestId('partner-type-delete-confirm'));

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.partnerTypes.messages.inUse'
                })
            )
        );
    });

    it('does not read another 409 as in use', async () => {
        mockApi(() => {
            throw new ApiError('conflict', { status: 409, code: 'ALREADY_EXISTS' as never });
        });
        renderScreen();

        fireEvent.click(await screen.findByTestId(`partner-type-delete-${MEDIA_ID}`));
        fireEvent.click(await screen.findByTestId('partner-type-delete-confirm'));

        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'admin-pages.partnerTypes.messages.deleteError'
                })
            )
        );
    });

    it('shows deleted rows behind the toggle and restores one (AC-3.5)', async () => {
        const writes: { path: string; method?: string }[] = [];
        mockApi((input) => {
            writes.push(input);
            return { data: { success: true, data: DELETED_ROW }, status: 200 };
        });
        renderScreen();
        await screen.findByTestId(`partner-type-row-${MEDIA_ID}`);
        expect(screen.queryByTestId(`partner-type-row-${PERSON_ID}`)).toBeNull();

        fireEvent.click(screen.getByTestId('partner-types-show-deleted'));
        await screen.findByTestId(`partner-type-row-${PERSON_ID}`);
        expect(screen.getByTestId(`partner-type-state-${PERSON_ID}`).textContent).toBe(
            'admin-pages.partnerTypes.state.deleted'
        );
        fireEvent.click(screen.getByTestId(`partner-type-restore-${PERSON_ID}`));

        await waitFor(() =>
            expect(writes).toEqual([
                expect.objectContaining({
                    path: `/api/v1/admin/partner-types/${PERSON_ID}/restore`,
                    method: 'POST'
                })
            ])
        );
    });

    it('hides restore and every write button without their permissions (AC-3.5, AC-3.6)', async () => {
        mockPermissions.value = ['partnerType.view'];
        mockApi();
        renderScreen();
        await screen.findByTestId(`partner-type-row-${MEDIA_ID}`);
        fireEvent.click(screen.getByTestId('partner-types-show-deleted'));
        await screen.findByTestId(`partner-type-row-${PERSON_ID}`);

        expect(screen.queryByTestId('partner-type-add')).toBeNull();
        expect(screen.queryByTestId(`partner-type-edit-${MEDIA_ID}`)).toBeNull();
        expect(screen.queryByTestId(`partner-type-delete-${MEDIA_ID}`)).toBeNull();
        expect(screen.queryByTestId(`partner-type-restore-${PERSON_ID}`)).toBeNull();
    });
});

describe('partner type menu entry (AC-3.6)', () => {
    const items = (sidebars.plataformaSidebar?.items ?? []).flatMap((item) =>
        item.type === 'group' ? item.items : [item]
    );

    it('is gated by PARTNER_TYPE_VIEW', () => {
        const link = items.find((item) => item.type === 'link' && item.id === 'partner-types');

        expect(link).toMatchObject({
            route: '/content/partner-types',
            permissions: ['PARTNER_TYPE_VIEW']
        });
    });
});
