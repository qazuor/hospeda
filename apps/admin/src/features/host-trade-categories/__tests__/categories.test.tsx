// @vitest-environment jsdom
/**
 * Component tests for the CATEGORIES half of the provider trade catalog screen
 * (HOS-919 T-044).
 *
 * Covers: the per-locale keywords tag input (lowercase, 30 words and 40
 * characters per locale), the group select offering active groups only, the
 * active switch sending `lifecycleState`, the slug lock on edit and the
 * `409 CATEGORY_IN_USE` explanation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { HostTradeCategoriesSection } from '../components/HostTradeCategoriesSection';
import { addKeyword } from '../lib/keywords';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => [
        'hostTradeCategory.view',
        'hostTradeCategory.create',
        'hostTradeCategory.update',
        'hostTradeCategory.delete'
    ]
}));

const mockedFetchApi = vi.mocked(fetchApi);

const ACTIVE_GROUP_ID = '11111111-1111-4111-8111-111111111111';
const INACTIVE_GROUP_ID = '33333333-3333-4333-8333-333333333333';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';

const GROUPS = [
    {
        id: ACTIVE_GROUP_ID,
        slug: 'instalaciones',
        nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
        displayWeight: 10,
        lifecycleState: 'ACTIVE'
    },
    {
        id: INACTIVE_GROUP_ID,
        slug: 'viejo',
        nameI18n: { es: 'Grupo viejo', en: 'Old group', pt: 'Grupo antigo' },
        displayWeight: 20,
        lifecycleState: 'INACTIVE'
    }
];

const CATEGORY = {
    id: CATEGORY_ID,
    slug: 'plomeria',
    groupId: ACTIVE_GROUP_ID,
    nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
    keywordsI18n: { es: ['cañeria'], en: [], pt: [] },
    displayWeight: 10,
    lifecycleState: 'ACTIVE'
};

const page = <T,>(items: T[]) => ({
    data: {
        success: true,
        data: { items, pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 } }
    },
    status: 200
});

function mockApi(write?: (input: { path: string; method?: string }) => unknown) {
    mockedFetchApi.mockImplementation(async (input) => {
        if (!input.method || input.method === 'GET') {
            return (
                input.path.includes('/host-trade-category-groups') ? page(GROUPS) : page([CATEGORY])
            ) as never;
        }
        if (write) return (await write(input)) as never;
        return { data: { success: true, data: CATEGORY }, status: 200 } as never;
    });
}

function renderSection() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <HostTradeCategoriesSection />
        </QueryClientProvider>
    );
}

function lastWrite(method: string) {
    return mockedFetchApi.mock.calls.find(([input]) => input.method === method)?.[0];
}

beforeEach(() => mockApi());
afterEach(() => vi.clearAllMocks());

describe('addKeyword rules', () => {
    it('lowercases and trims the word', () => {
        expect(addKeyword({ keywords: [], raw: '  Pozo Ciego ' }).keywords).toEqual(['pozo ciego']);
    });

    it('rejects a 41 character word and accepts 40', () => {
        expect(addKeyword({ keywords: [], raw: 'a'.repeat(41) }).rejection).toBe('tooLong');
        expect(addKeyword({ keywords: [], raw: 'a'.repeat(40) }).rejection).toBeUndefined();
    });

    it('rejects the 31st word and a duplicate', () => {
        const thirty = Array.from({ length: 30 }, (_, index) => `w${index}`);
        expect(addKeyword({ keywords: thirty, raw: 'extra' }).rejection).toBe('tooMany');
        expect(addKeyword({ keywords: ['pozo'], raw: 'POZO' }).rejection).toBe('duplicate');
    });
});

describe('HostTradeCategoriesSection', () => {
    it('renders categories with their group name', async () => {
        renderSection();
        const row = await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        expect(within(row).getByText('Plomería')).toBeTruthy();
        expect(within(row).getByText('Instalaciones')).toBeTruthy();
    });

    it('lists only active groups in the group select of the create dialog', async () => {
        renderSection();
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        fireEvent.click(screen.getByTestId('category-add'));
        const select = (await screen.findByTestId('category-group')) as HTMLSelectElement;
        const labels = Array.from(select.options).map((option) => option.textContent);

        expect(labels).toContain('Instalaciones');
        expect(labels).not.toContain('Grupo viejo');
    });

    it('normalizes keywords to lowercase per locale when added from the editor', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));

        fireEvent.change(await screen.findByTestId('keywords-en-input'), {
            target: { value: 'Septic TANK' }
        });
        fireEvent.click(screen.getByTestId('keywords-en-add'));
        fireEvent.click(screen.getByTestId('category-save'));

        await waitFor(() => {
            expect(lastWrite('PATCH')?.body).toMatchObject({
                keywordsI18n: { es: ['cañeria'], en: ['septic tank'] }
            });
        });
    });

    it('shows the 40 character limit error and does not add the word', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));

        fireEvent.change(await screen.findByTestId('keywords-pt-input'), {
            target: { value: 'x'.repeat(41) }
        });
        fireEvent.click(screen.getByTestId('keywords-pt-add'));

        expect(screen.getByTestId('keywords-pt-error')).toBeTruthy();
        expect(screen.queryByTestId(`keyword-pt-${'x'.repeat(41)}`)).toBeNull();
    });

    it('stops accepting words after 30 in one locale', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));
        const input = await screen.findByTestId('keywords-en-input');

        for (let index = 0; index < 31; index += 1) {
            fireEvent.change(input, { target: { value: `word${index}` } });
            fireEvent.click(screen.getByTestId('keywords-en-add'));
        }

        expect(screen.getAllByTestId(/^keyword-en-/)).toHaveLength(30);
        expect(screen.getByTestId('keywords-en-error')).toBeTruthy();
    });

    it('removes a keyword with its remove button', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));

        fireEvent.click(await screen.findByTestId('keyword-remove-es-cañeria'));
        fireEvent.click(screen.getByTestId('category-save'));

        await waitFor(() => {
            const body = lastWrite('PATCH')?.body as { keywordsI18n: { es?: string[] } };
            expect(body.keywordsI18n.es ?? []).toEqual([]);
        });
    });

    it('sends lifecycleState INACTIVE when the active switch is turned off', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));
        fireEvent.click(await screen.findByTestId('category-active'));
        fireEvent.click(screen.getByTestId('category-save'));

        await waitFor(() => {
            expect(lastWrite('PATCH')?.body).toMatchObject({ lifecycleState: 'INACTIVE' });
        });
    });

    it('locks the slug on edit and keeps it out of the PATCH body', async () => {
        renderSection();
        fireEvent.click(await screen.findByTestId(`category-edit-${CATEGORY_ID}`));

        expect(((await screen.findByTestId('category-slug')) as HTMLInputElement).disabled).toBe(
            true
        );
        fireEvent.click(screen.getByTestId('category-save'));

        await waitFor(() => {
            expect(lastWrite('PATCH')?.body).not.toHaveProperty('slug');
        });
    });

    it('creates a category with the chosen group and slug', async () => {
        renderSection();
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        fireEvent.click(screen.getByTestId('category-add'));
        fireEvent.change(await screen.findByTestId('category-slug'), {
            target: { value: 'gasista' }
        });
        fireEvent.change(document.getElementById('field-nameI18n-es') as HTMLInputElement, {
            target: { value: 'Gasista' }
        });
        fireEvent.change(screen.getByTestId('category-group'), {
            target: { value: ACTIVE_GROUP_ID }
        });
        fireEvent.click(screen.getByTestId('category-save'));

        await waitFor(() => {
            expect(lastWrite('POST')?.body).toMatchObject({
                slug: 'gasista',
                groupId: ACTIVE_GROUP_ID,
                nameI18n: { es: 'Gasista' }
            });
        });
    });

    it('explains a 409 CATEGORY_IN_USE delete and suggests deactivating', async () => {
        mockApi(() => {
            throw new ApiError('conflict', { status: 409, code: 'CATEGORY_IN_USE' as never });
        });
        renderSection();

        fireEvent.click(await screen.findByTestId(`category-delete-${CATEGORY_ID}`));
        fireEvent.click(await screen.findByTestId('category-delete-confirm'));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'error',
                    message: 'admin-pages.hostTradeCategories.categories.messages.inUse'
                })
            );
        });
    });

    it('filters the list by group and by lifecycle state', async () => {
        renderSection();
        await screen.findByTestId(`category-row-${CATEGORY_ID}`);

        fireEvent.change(screen.getByTestId('category-filter-group'), {
            target: { value: ACTIVE_GROUP_ID }
        });
        fireEvent.change(screen.getByTestId('category-filter-state'), {
            target: { value: 'INACTIVE' }
        });

        await waitFor(() => {
            const paths = mockedFetchApi.mock.calls.map(([input]) => input.path);
            expect(
                paths.some(
                    (path) =>
                        path.includes('/host-trade-categories?') &&
                        path.includes(`groupId=${ACTIVE_GROUP_ID}`) &&
                        path.includes('lifecycleState=INACTIVE')
                )
            ).toBe(true);
        });
    });
});
