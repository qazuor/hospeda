// @vitest-environment jsdom
/**
 * Tests for the generic listing admin config layer (T-057 — SPEC-239).
 *
 * Acceptance criteria:
 *   AC-1  `createListingListConfig` returns a well-formed `EntityConfig` from
 *         minimal params, including shared listing filter params (destinationId,
 *         ownerId, includeDeleted).
 *   AC-2  Extra filters from the caller are merged AFTER the shared ones.
 *   AC-3  Default listing overrides (pagination, search, layout) are applied
 *         and overrideable via `extraListConfig`.
 *   AC-4  `createListingIdentitySection()` returns a section with the expected
 *         field ids and correct FieldTypeEnum values.
 *   AC-5  `createListingOperationalSection()` returns a section with the
 *         expected field ids and correct FieldTypeEnum values.
 *   AC-6  `createListingEntityHooks` factory returns the standard CRUD hooks
 *         PLUS the three listing-specific hooks.
 *   AC-7  The assembled config can be passed to `createEntityListPage()` without
 *         throwing (shell renders from a config object — no forked shell code).
 */

import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import {
    createListingEntityHooks,
    createListingIdentitySection,
    createListingListConfig,
    createListingOperationalSection
} from '@/features/listing';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Mock API client (used by listing hooks)
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
    entityName: 'test-listing',
    entityKey: 'testListing',
    entityType: EntityType.ACCOMMODATION, // Reuse existing enum value for the test — concrete entity adds its own
    apiEndpoint: '/api/v1/admin/test-listing',
    basePath: '/platform/test-listing',
    detailPath: '/platform/test-listing/[id]',
    listItemSchema: StubListItemSchema as unknown as z.ZodSchema<StubListItem>,
    createColumns: stubCreateColumns
} as const;

// ---------------------------------------------------------------------------
// AC-1: createListingListConfig — well-formed EntityConfig from minimal params
// ---------------------------------------------------------------------------

describe('createListingListConfig', () => {
    const config = createListingListConfig(MINIMAL_PARAMS);

    it('AC-1: sets entity identity fields from params', () => {
        expect(config.name).toBe('test-listing');
        expect(config.entityKey).toBe('testListing');
        expect(config.entityType).toBe(EntityType.ACCOMMODATION);
        expect(config.apiEndpoint).toBe('/api/v1/admin/test-listing');
        expect(config.basePath).toBe('/platform/test-listing');
        expect(config.detailPath).toBe('/platform/test-listing/[id]');
    });

    it('AC-1: always includes shared listing filter params in the filter bar', () => {
        const paramKeys = (config.filterBarConfig?.filters ?? []).map((f) => f.paramKey);
        expect(paramKeys).toContain('destinationId');
        expect(paramKeys).not.toContain('isFeatured');
        expect(paramKeys).toContain('ownerId');
        expect(paramKeys).toContain('includeDeleted');
    });

    it('AC-1: applies listing default pagination (20 items / [10,20,50,100])', () => {
        expect(config.paginationConfig?.defaultPageSize).toBe(20);
        expect(config.paginationConfig?.allowedPageSizes).toContain(10);
        expect(config.paginationConfig?.allowedPageSizes).toContain(100);
    });

    it('AC-1: applies listing default search config (minChars 2, debounce 300)', () => {
        expect(config.searchConfig?.minChars).toBe(2);
        expect(config.searchConfig?.debounceMs).toBe(300);
        expect(config.searchConfig?.enabled).toBe(true);
    });

    it('AC-1: showBreadcrumbs and showCreateButton default to true', () => {
        expect(config.layoutConfig?.showBreadcrumbs).toBe(true);
        expect(config.layoutConfig?.showCreateButton).toBe(true);
    });

    it('AC-1: createButtonPath is derived from basePath + /new', () => {
        expect(config.layoutConfig?.createButtonPath).toBe('/platform/test-listing/new');
    });

    it('AC-1: createColumns factory is forwarded', () => {
        const cols = config.createColumns((k) => k);
        expect(cols[0]?.id).toBe('name');
    });
});

// ---------------------------------------------------------------------------
// AC-2: extraFilters are merged after shared filters
// ---------------------------------------------------------------------------

describe('createListingListConfig — extraFilters', () => {
    it('AC-2: extra filters appear in filterBarConfig after shared filters', () => {
        const configWithExtras = createListingListConfig({
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
        const configWithExtras = createListingListConfig({
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

describe('createListingListConfig — extraListConfig overrides', () => {
    it('AC-3: overrides defaultPageSize when provided', () => {
        const config = createListingListConfig({
            ...MINIMAL_PARAMS,
            extraListConfig: {
                paginationConfig: { defaultPageSize: 10, allowedPageSizes: [10, 25] as const }
            }
        });
        expect(config.paginationConfig?.defaultPageSize).toBe(10);
    });

    it('AC-3: overrides search minChars when provided', () => {
        const config = createListingListConfig({
            ...MINIMAL_PARAMS,
            extraListConfig: {
                searchConfig: { minChars: 3, debounceMs: 500, enabled: true }
            }
        });
        expect(config.searchConfig?.minChars).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// AC-4: createListingIdentitySection
// ---------------------------------------------------------------------------

it('selects only the requested vertical permissions for shared sections', () => {
    const gastronomy = createListingOperationalSection('gastronomy');
    const experience = createListingOperationalSection('experience');
    expect(gastronomy.permissions?.edit).toEqual([
        PermissionEnum.GASTRONOMY_EDIT_OWN,
        PermissionEnum.GASTRONOMY_EDIT_ALL
    ]);
    expect(experience.permissions?.edit).toEqual([
        PermissionEnum.EXPERIENCE_EDIT_OWN,
        PermissionEnum.EXPERIENCE_EDIT_ALL
    ]);
    expect(createListingIdentitySection('experience').permissions?.view).toEqual([
        PermissionEnum.EXPERIENCE_VIEW_ALL
    ]);
});

describe('createListingIdentitySection', () => {
    const section = createListingIdentitySection('gastronomy');

    it('AC-4: returns a ConsolidatedSectionConfig with id "listing-identity"', () => {
        expect(section.id).toBe('listing-identity');
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

    it('AC-4: the identity section has no isFeatured field (column dropped, HOS-1419)', () => {
        expect(section.fields.find((f) => f.id === 'isFeatured')).toBeUndefined();
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
// AC-5: createListingOperationalSection
// ---------------------------------------------------------------------------

describe('createListingOperationalSection', () => {
    const section = createListingOperationalSection('gastronomy');

    it('AC-5: returns a ConsolidatedSectionConfig with id "listing-operational"', () => {
        expect(section.id).toBe('listing-operational');
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

    it('AC-5: contains the videos field with the correct type', () => {
        // HOS-372: videos are a top-level column now, not a key of the dropped
        // `media` blob, so the field id is `videos`. A dotted `media.videos` id
        // would submit a `media` object the update schema strips, and the videos
        // would never reach the DB.
        const videos = section.fields.find((f) => f.id === 'videos');
        expect(videos?.type).toBe(FieldTypeEnum.VIDEO_GALLERY);
    });

    it('AC-5: exposes no dotted media.videos field (HOS-372 regression)', () => {
        // Guards the exact mistake this change fixes: a reintroduced dotted id
        // still renders and still validates, it just silently persists nothing.
        expect(section.fields.map((f) => f.id)).not.toContain('media.videos');
    });

    it('HOS-382: no longer declares media.featuredImage or media.gallery', () => {
        // Regression guard: these two fields used to buffer uploads into a
        // `media` object on PATCH, but the `media` JSONB column was dropped
        // (HOS-372) and the update schema silently strips that key — every
        // photo submitted through these fields was orphaned in Cloudinary
        // with no DB row ever created. Photos are now managed exclusively via
        // the relational gallery tab (`ListingGalleryManager`).
        const ids = section.fields.map((f) => f.id);
        expect(ids).not.toContain('media.featuredImage');
        expect(ids).not.toContain('media.gallery');
    });

    it('HOS-382: still declares the videos field alongside the removed media.* ids', () => {
        // videos is intentionally unaffected by the media.* removal — it is
        // its own top-level column, not nested under `media`.
        expect(section.fields.map((f) => f.id)).toContain('videos');
    });

    it('AC-5: contains openingHours field (read-only JSON — structured object)', () => {
        const openingHours = section.fields.find((f) => f.id === 'openingHours');
        expect(openingHours).toBeDefined();
        // openingHours is a structured object ({ timezone, days }). It is rendered
        // read-only as JSON (a TEXTAREA fed it the raw object and crashed the admin
        // view). View-only: the owner edits hours on the web, not the admin panel.
        // TODO(SPEC-239): replace with a dedicated OPENING_HOURS widget when available.
        expect(openingHours?.type).toBe(FieldTypeEnum.JSON);
        expect(openingHours?.modes).toEqual(['view']);
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
// AC-6: createListingEntityHooks factory
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

describe('createListingEntityHooks', () => {
    const hooks = createListingEntityHooks<{ id: string; name: string }>({
        entityName: 'test-listing',
        apiEndpoint: '/api/v1/admin/test-listing'
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

    it('AC-6: exports the three listing-specific hooks', () => {
        expect(typeof hooks.useAssignOwnerMutation).toBe('function');
        expect(typeof hooks.useModerateReviewMutation).toBe('function');
        expect(typeof hooks.usePendingReviewsQuery).toBe('function');
    });

    it('AC-6: useAssignOwnerMutation calls POST assign-owner endpoint', async () => {
        const MOCK_ENTITY = { id: 'entity-1', name: 'Test Listing' };

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
                path: '/api/v1/admin/test-listing/entity-1/assign-owner',
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
                path: '/api/v1/admin/test-listing/reviews/review-uuid-1/moderate',
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
                path: expect.stringContaining('/api/v1/admin/test-listing/reviews')
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

describe('createListingListConfig — shell integration (AC-7)', () => {
    it('AC-7: config satisfies EntityConfig shape accepted by createEntityListPage', () => {
        // We verify the shape without actually rendering the full page
        // (that requires a router context which is heavy to set up here).
        // The type-level check happens at compile time; the runtime check
        // confirms the key fields the shell reads are all present and valid.
        const config = createListingListConfig(MINIMAL_PARAMS);

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
