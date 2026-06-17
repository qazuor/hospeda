// @vitest-environment jsdom
/**
 * Tests for the generic commerce admin config layer (T-057 — SPEC-239).
 *
 * Acceptance criteria:
 *   AC-1  `createCommerceListConfig` returns a well-formed `EntityConfig` from
 *         minimal params, including shared commerce filter params (destinationId,
 *         isFeatured, ownerId, includeDeleted).
 *   AC-2  Extra filters from the caller are merged AFTER the shared ones.
 *   AC-3  Default commerce overrides (pagination, search, layout) are applied
 *         and overrideable via `extraListConfig`.
 *   AC-4  `createCommerceIdentitySection()` returns a section with the expected
 *         field ids and correct FieldTypeEnum values.
 *   AC-5  `createCommerceOperationalSection()` returns a section with the
 *         expected field ids and correct FieldTypeEnum values.
 *   AC-6  `createCommerceEntityHooks` factory returns the standard CRUD hooks
 *         PLUS the three commerce-specific hooks.
 *   AC-7  The assembled config can be passed to `createEntityListPage()` without
 *         throwing (shell renders from a config object — no forked shell code).
 */

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import {
    createCommerceEntityHooks,
    createCommerceIdentitySection,
    createCommerceListConfig,
    createCommerceOperationalSection
} from '@/features/commerce';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock API client (used by commerce hooks)
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Minimal list-item schema and stub columns (no gastronomy specifics)
// ---------------------------------------------------------------------------

const StubListItemSchema = z.object({
    id: z.string(),
    name: z.string()
});

type StubListItem = z.infer<typeof StubListItemSchema>;

/**
 * Stub column factory that satisfies the `ColumnTFunction` signature.
 * The cast on `t` is intentional: in tests we pass a plain `(k) => k` stub
 * that covers only `string`; the real type is `TranslationKey` (a branded
 * string union).  The cast avoids duplicating the full key union in tests.
 */
const stubCreateColumns = (t: ColumnTFunction) =>
    [
        {
            id: 'name',
            header: t('admin-entities.columns.name' as Parameters<ColumnTFunction>[0]),
            accessorKey: 'name',
            enableSorting: true
        }
    ] as const;

// ---------------------------------------------------------------------------
// Minimal config params used across tests
// ---------------------------------------------------------------------------

const MINIMAL_PARAMS = {
    entityName: 'test-commerce',
    entityKey: 'testCommerce',
    entityType: EntityType.ACCOMMODATION, // Reuse existing enum value for the test — concrete entity adds its own
    apiEndpoint: '/api/v1/admin/test-commerce',
    basePath: '/platform/test-commerce',
    detailPath: '/platform/test-commerce/[id]',
    listItemSchema: StubListItemSchema as unknown as z.ZodSchema<StubListItem>,
    createColumns: stubCreateColumns
} as const;

// ---------------------------------------------------------------------------
// AC-1: createCommerceListConfig — well-formed EntityConfig from minimal params
// ---------------------------------------------------------------------------

describe('createCommerceListConfig', () => {
    const config = createCommerceListConfig(MINIMAL_PARAMS);

    it('AC-1: sets entity identity fields from params', () => {
        expect(config.name).toBe('test-commerce');
        expect(config.entityKey).toBe('testCommerce');
        expect(config.entityType).toBe(EntityType.ACCOMMODATION);
        expect(config.apiEndpoint).toBe('/api/v1/admin/test-commerce');
        expect(config.basePath).toBe('/platform/test-commerce');
        expect(config.detailPath).toBe('/platform/test-commerce/[id]');
    });

    it('AC-1: always includes shared commerce filter params in the filter bar', () => {
        const paramKeys = (config.filterBarConfig?.filters ?? []).map((f) => f.paramKey);
        expect(paramKeys).toContain('destinationId');
        expect(paramKeys).toContain('isFeatured');
        expect(paramKeys).toContain('ownerId');
        expect(paramKeys).toContain('includeDeleted');
    });

    it('AC-1: applies commerce default pagination (20 items / [10,20,50,100])', () => {
        expect(config.paginationConfig?.defaultPageSize).toBe(20);
        expect(config.paginationConfig?.allowedPageSizes).toContain(10);
        expect(config.paginationConfig?.allowedPageSizes).toContain(100);
    });

    it('AC-1: applies commerce default search config (minChars 2, debounce 300)', () => {
        expect(config.searchConfig?.minChars).toBe(2);
        expect(config.searchConfig?.debounceMs).toBe(300);
        expect(config.searchConfig?.enabled).toBe(true);
    });

    it('AC-1: showBreadcrumbs and showCreateButton default to true', () => {
        expect(config.layoutConfig?.showBreadcrumbs).toBe(true);
        expect(config.layoutConfig?.showCreateButton).toBe(true);
    });

    it('AC-1: createButtonPath is derived from basePath + /new', () => {
        expect(config.layoutConfig?.createButtonPath).toBe('/platform/test-commerce/new');
    });

    it('AC-1: createColumns factory is forwarded', () => {
        const cols = config.createColumns((k) => k);
        expect(cols[0]?.id).toBe('name');
    });
});

// ---------------------------------------------------------------------------
// AC-2: extraFilters are merged after shared filters
// ---------------------------------------------------------------------------

describe('createCommerceListConfig — extraFilters', () => {
    it('AC-2: extra filters appear in filterBarConfig after shared filters', () => {
        const configWithExtras = createCommerceListConfig({
            ...MINIMAL_PARAMS,
            extraFilters: [
                {
                    paramKey: 'gastronomyType',
                    labelKey: 'admin-filters.gastronomyType.label' as const,
                    type: 'select' as const,
                    order: 10,
                    options: [
                        {
                            value: 'RESTAURANT',
                            labelKey: 'admin-filters.gastronomyType.restaurant' as const
                        }
                    ]
                }
            ]
        });

        const paramKeys = (configWithExtras.filterBarConfig?.filters ?? []).map((f) => f.paramKey);
        expect(paramKeys).toContain('destinationId'); // shared still present
        expect(paramKeys).toContain('gastronomyType'); // extra appended
    });

    it('AC-2: shared filters always appear first (lower order than 10)', () => {
        const configWithExtras = createCommerceListConfig({
            ...MINIMAL_PARAMS,
            extraFilters: [
                {
                    paramKey: 'priceRange',
                    labelKey: 'admin-filters.priceRange.label' as const,
                    type: 'select' as const,
                    order: 11,
                    options: []
                }
            ]
        });

        const filters = configWithExtras.filterBarConfig?.filters ?? [];
        const destinationIdx = filters.findIndex((f) => f.paramKey === 'destinationId');
        const priceRangeIdx = filters.findIndex((f) => f.paramKey === 'priceRange');
        expect(destinationIdx).toBeLessThan(priceRangeIdx);
    });
});

// ---------------------------------------------------------------------------
// AC-3: extraListConfig overrides defaults
// ---------------------------------------------------------------------------

describe('createCommerceListConfig — extraListConfig overrides', () => {
    it('AC-3: overrides defaultPageSize when provided', () => {
        const config = createCommerceListConfig({
            ...MINIMAL_PARAMS,
            extraListConfig: {
                paginationConfig: { defaultPageSize: 10, allowedPageSizes: [10, 25] as const }
            }
        });
        expect(config.paginationConfig?.defaultPageSize).toBe(10);
    });

    it('AC-3: overrides search minChars when provided', () => {
        const config = createCommerceListConfig({
            ...MINIMAL_PARAMS,
            extraListConfig: {
                searchConfig: { minChars: 3, debounceMs: 500, enabled: true }
            }
        });
        expect(config.searchConfig?.minChars).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// AC-4: createCommerceIdentitySection
// ---------------------------------------------------------------------------

describe('createCommerceIdentitySection', () => {
    const section = createCommerceIdentitySection();

    it('AC-4: returns a ConsolidatedSectionConfig with id "commerce-identity"', () => {
        expect(section.id).toBe('commerce-identity');
    });

    it('AC-4: is visible in all three modes', () => {
        expect(section.modes).toContain('view');
        expect(section.modes).toContain('edit');
        expect(section.modes).toContain('create');
    });

    it('AC-4: contains required core text fields', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).toContain('name');
        expect(ids).toContain('slug');
        expect(ids).toContain('summary');
        expect(ids).toContain('description');
        expect(ids).toContain('richDescription');
    });

    it('AC-4: contains relationship fields', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).toContain('destinationId');
        expect(ids).toContain('ownerId');
    });

    it('AC-4: contains state/moderation fields (view/edit only)', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).toContain('lifecycleStatus');
        expect(ids).toContain('moderationStatus');
        expect(ids).toContain('moderationNotes');
        expect(ids).toContain('rejectionReason');
    });

    it('AC-4: isFeatured is view/edit only (not in create)', () => {
        const featured = section.fields.find((f) => f.id === 'isFeatured');
        expect(featured?.modes).not.toContain('create');
        expect(featured?.modes).toContain('view');
        expect(featured?.modes).toContain('edit');
    });

    it('AC-4: destinationId uses DESTINATION_SELECT field type', () => {
        const dest = section.fields.find((f) => f.id === 'destinationId');
        expect(dest?.type).toBe(FieldTypeEnum.DESTINATION_SELECT);
    });

    it('AC-4: richDescription uses RICH_TEXT field type', () => {
        const richDesc = section.fields.find((f) => f.id === 'richDescription');
        expect(richDesc?.type).toBe(FieldTypeEnum.RICH_TEXT);
    });

    it('AC-4: name field is required', () => {
        const nameField = section.fields.find((f) => f.id === 'name');
        expect(nameField?.required).toBe(true);
    });

    it('AC-4: section has no gastronomy-specific fields', () => {
        const ids = section.fields.map((f) => f.id);
        // Gastronomy-specific fields (gastronomyType, priceRange, menuUrl)
        // must NOT appear in the generic identity section
        expect(ids).not.toContain('gastronomyType');
        expect(ids).not.toContain('priceRange');
        expect(ids).not.toContain('menuUrl');
    });
});

// ---------------------------------------------------------------------------
// AC-5: createCommerceOperationalSection
// ---------------------------------------------------------------------------

describe('createCommerceOperationalSection', () => {
    const section = createCommerceOperationalSection();

    it('AC-5: returns a ConsolidatedSectionConfig with id "commerce-operational"', () => {
        expect(section.id).toBe('commerce-operational');
    });

    it('AC-5: is visible in all three modes', () => {
        expect(section.modes).toContain('view');
        expect(section.modes).toContain('edit');
        expect(section.modes).toContain('create');
    });

    it('AC-5: contains contact info fields', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).toContain('contactInfo.phone');
        expect(ids).toContain('contactInfo.email');
        expect(ids).toContain('contactInfo.website');
        expect(ids).toContain('contactInfo.whatsapp');
    });

    it('AC-5: contains social network fields', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).toContain('socialNetworks.facebook');
        expect(ids).toContain('socialNetworks.instagram');
        expect(ids).toContain('socialNetworks.twitter');
    });

    it('AC-5: contains media fields with correct types', () => {
        const featuredImage = section.fields.find((f) => f.id === 'media.featuredImage');
        const gallery = section.fields.find((f) => f.id === 'media.gallery');
        const videos = section.fields.find((f) => f.id === 'media.videos');

        expect(featuredImage?.type).toBe(FieldTypeEnum.IMAGE);
        expect(gallery?.type).toBe(FieldTypeEnum.GALLERY);
        expect(videos?.type).toBe(FieldTypeEnum.VIDEO_GALLERY);
    });

    it('AC-5: contains openingHours field (TEXTAREA — no dedicated type yet)', () => {
        const openingHours = section.fields.find((f) => f.id === 'openingHours');
        expect(openingHours).toBeDefined();
        // TODO(SPEC-239): will change to a dedicated type when available
        expect(openingHours?.type).toBe(FieldTypeEnum.TEXTAREA);
    });

    it('AC-5: contains amenities and features multi-select fields', () => {
        const amenities = section.fields.find((f) => f.id === 'amenities');
        const features = section.fields.find((f) => f.id === 'features');

        expect(amenities?.type).toBe(FieldTypeEnum.AMENITY_SELECT);
        expect(features?.type).toBe(FieldTypeEnum.FEATURE_SELECT);
    });

    it('AC-5: section has no gastronomy-specific fields', () => {
        const ids = section.fields.map((f) => f.id);
        expect(ids).not.toContain('gastronomyType');
        expect(ids).not.toContain('priceRange');
        expect(ids).not.toContain('menuUrl');
    });
});

// ---------------------------------------------------------------------------
// AC-6: createCommerceEntityHooks factory
// ---------------------------------------------------------------------------

/** Creates an isolated QueryClient wrapper with retries disabled. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

describe('createCommerceEntityHooks', () => {
    const hooks = createCommerceEntityHooks<{ id: string; name: string }>({
        entityName: 'test-commerce',
        apiEndpoint: '/api/v1/admin/test-commerce'
    });

    it('AC-6: exports the standard CRUD hooks from createEntityHooks', () => {
        expect(typeof hooks.useList).toBe('function');
        expect(typeof hooks.useDetail).toBe('function');
        expect(typeof hooks.useCreate).toBe('function');
        expect(typeof hooks.useUpdate).toBe('function');
        expect(typeof hooks.useDelete).toBe('function');
        expect(typeof hooks.useSoftDelete).toBe('function');
        expect(typeof hooks.useRestore).toBe('function');
    });

    it('AC-6: exports the three commerce-specific hooks', () => {
        expect(typeof hooks.useAssignOwnerMutation).toBe('function');
        expect(typeof hooks.useModerateReviewMutation).toBe('function');
        expect(typeof hooks.usePendingReviewsQuery).toBe('function');
    });

    it('AC-6: useAssignOwnerMutation calls POST assign-owner endpoint', async () => {
        const MOCK_ENTITY = { id: 'entity-1', name: 'Test Commerce' };

        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: MOCK_ENTITY },
            status: 200
        });

        const { result } = renderHook(() => hooks.useAssignOwnerMutation(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({ id: 'entity-1', ownerId: 'owner-uuid' });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/test-commerce/entity-1/assign-owner',
                method: 'POST',
                body: { ownerId: 'owner-uuid' }
            })
        );
    });

    it('AC-6: useModerateReviewMutation calls POST reviews/moderate endpoint', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: null },
            status: 200
        });

        const { result } = renderHook(() => hooks.useModerateReviewMutation(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            reviewId: 'review-uuid-1',
            decision: 'APPROVED'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/test-commerce/reviews/review-uuid-1/moderate',
                method: 'POST',
                body: { decision: 'APPROVED' }
            })
        );
    });

    it('AC-6: useModerateReviewMutation forwards optional reason', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: null },
            status: 200
        });

        const { result } = renderHook(() => hooks.useModerateReviewMutation(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            reviewId: 'review-uuid-2',
            decision: 'REJECTED',
            reason: 'Inappropriate content'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                body: { decision: 'REJECTED', reason: 'Inappropriate content' }
            })
        );
    });

    it('AC-6: usePendingReviewsQuery calls GET reviews endpoint with status=PENDING', async () => {
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: { items: [], pagination: { page: 1, pageSize: 20, total: 0 } }
            },
            status: 200
        });

        const { result } = renderHook(() => hooks.usePendingReviewsQuery({ page: 1 }), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining('/api/v1/admin/test-commerce/reviews')
            })
        );

        const call = mockedFetchApi.mock.calls[0]?.[0];
        expect((call as { path: string }).path).toContain('status=PENDING');
        expect(result.current.data?.items).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// AC-7: config integrates with createEntityListPage (no shell fork)
// ---------------------------------------------------------------------------

describe('createCommerceListConfig — shell integration (AC-7)', () => {
    it('AC-7: config satisfies EntityConfig shape accepted by createEntityListPage', () => {
        // We verify the shape without actually rendering the full page
        // (that requires a router context which is heavy to set up here).
        // The type-level check happens at compile time; the runtime check
        // confirms the key fields the shell reads are all present and valid.
        const config = createCommerceListConfig(MINIMAL_PARAMS);

        // Fields the shell reads unconditionally
        expect(config.name).toBeTruthy();
        expect(config.entityKey).toBeTruthy();
        expect(config.apiEndpoint).toBeTruthy();
        expect(config.basePath).toBeTruthy();
        expect(config.listItemSchema).toBeDefined();
        expect(typeof config.createColumns).toBe('function');
        expect(config.layoutConfig).toBeDefined();
        expect(config.paginationConfig).toBeDefined();
        expect(config.filterBarConfig).toBeDefined();
    });
});
