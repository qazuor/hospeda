/**
 * @fileoverview
 * Unit tests for AccommodationService.findOptions (SPEC-169 §5.5 / decision D4).
 *
 * Verifies:
 * - The payload shape: { id, label, slug, type, destination }, where destination is the
 *   minimal { id, name, slug } projection (or null when the relation is absent).
 * - Gating: admin-panel access ONLY. An ACCESS_PANEL_ADMIN actor with NO _VIEW_ALL/_VIEW_OWN
 *   succeeds (the whole point of the lookup tier); an actor without admin access is FORBIDDEN.
 * - DRAFT-inclusivity: the method delegates to the model's searchWithRelations, which only
 *   excludes soft-deleted rows (never publication state), so DRAFT entities are returned.
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        DestinationModel: vi.fn().mockImplementation(() => ({ findById: vi.fn() }))
    };
});

/** Minimal mock for AccommodationModel. */
class MockAccommodationModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    searchWithRelations = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    getTable = vi.fn();
    getTableName = vi.fn().mockReturnValue('accommodations');
}

const panelOnlyActor = {
    id: 'editor-1',
    role: RoleEnum.EDITOR,
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
};

const noAccessActor = {
    id: 'user-1',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
};

const draftRow = {
    id: 'acc-draft-1',
    name: 'Draft Hotel',
    slug: 'draft-hotel',
    type: 'HOTEL',
    lifecycleState: 'DRAFT',
    destination: { id: 'dest-1', name: 'Concepcion del Uruguay', slug: 'concepcion-del-uruguay' }
};

const rowWithoutDestination = {
    id: 'acc-2',
    name: 'Cabin',
    slug: 'cabin',
    type: 'CABIN',
    lifecycleState: 'ACTIVE',
    destination: undefined
};

describe('AccommodationService.findOptions (SPEC-169 §5.5)', () => {
    let mockModel: MockAccommodationModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockAccommodationModel();
        mockModel.searchWithRelations.mockResolvedValue({ items: [], total: 0 });
        service = new AccommodationService({} as ServiceConfig, mockModel as never);
    });

    it('projects { id, label, slug, type, destination } for a matched row', async () => {
        // Arrange
        mockModel.searchWithRelations.mockResolvedValue({ items: [draftRow], total: 1 });

        // Act
        const result = await service.findOptions(panelOnlyActor, { q: 'draft' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            {
                id: 'acc-draft-1',
                label: 'Draft Hotel',
                slug: 'draft-hotel',
                type: 'HOTEL',
                destination: {
                    id: 'dest-1',
                    name: 'Concepcion del Uruguay',
                    slug: 'concepcion-del-uruguay'
                }
            }
        ]);
    });

    it('returns destination: null when the relation is absent', async () => {
        // Arrange
        mockModel.searchWithRelations.mockResolvedValue({
            items: [rowWithoutDestination],
            total: 1
        });

        // Act
        const result = await service.findOptions(panelOnlyActor, {});

        // Assert
        expect(result.data?.items[0]?.destination).toBeNull();
    });

    it('is DRAFT-inclusive: a DRAFT row is returned (no publication-state filter)', async () => {
        // Arrange
        mockModel.searchWithRelations.mockResolvedValue({ items: [draftRow], total: 1 });

        // Act
        const result = await service.findOptions(panelOnlyActor, {});

        // Assert: the DRAFT row surfaced unchanged
        expect(result.data?.items.map((i) => i.id)).toContain('acc-draft-1');
    });

    it('passes q and limit through to the model search', async () => {
        // Act
        await service.findOptions(panelOnlyActor, { q: 'hotel', limit: 5 });

        // Assert
        expect(mockModel.searchWithRelations).toHaveBeenCalledOnce();
        const [searchParams] = mockModel.searchWithRelations.mock.calls[0] as [
            { q?: string; pageSize?: number }
        ];
        expect(searchParams.q).toBe('hotel');
        expect(searchParams.pageSize).toBe(5);
    });

    it('defaults limit to 20 when not provided', async () => {
        // Act
        await service.findOptions(panelOnlyActor, {});

        // Assert
        const [searchParams] = mockModel.searchWithRelations.mock.calls[0] as [
            { pageSize?: number }
        ];
        expect(searchParams.pageSize).toBe(20);
    });

    it('succeeds for an ACCESS_PANEL_ADMIN-only actor (no _VIEW_ALL required)', async () => {
        // Act
        const result = await service.findOptions(panelOnlyActor, {});

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([]);
    });

    it('is FORBIDDEN for an actor without admin-panel access', async () => {
        // Act
        const result = await service.findOptions(noAccessActor, {});

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mockModel.searchWithRelations).not.toHaveBeenCalled();
    });
});
