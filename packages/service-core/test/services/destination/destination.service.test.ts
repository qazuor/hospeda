import type { DestinationType } from '@repo/types';
import type { DestinationId, UserId } from '@repo/types/common/id.types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createMockBaseModel } from '../../factories/baseServiceFactory';

/**
 * Helper to create branded IDs for tests.
 */
const asDestinationId = (id: string) => id as DestinationId;
const asUserId = (id: string) => id as UserId;

const createDestination = (overrides: Partial<DestinationType> = {}): DestinationType => ({
    id: asDestinationId(overrides.id ?? 'dest-1'),
    name: overrides.name ?? 'Test Destination',
    slug: overrides.slug ?? 'test-destination',
    summary: overrides.summary ?? 'A valid summary for the destination.',
    description: overrides.description ?? 'A valid description for the destination, long enough.',
    location: overrides.location ?? { state: 'A', zipCode: '1234', country: 'B' },
    media: overrides.media ?? {
        featuredImage: { url: 'img', moderationState: ModerationStatusEnum.APPROVED }
    },
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    createdById: overrides.createdById ?? asUserId('user-1'),
    updatedById: overrides.updatedById ?? asUserId('user-1')
});

/**
 * Subclase para expose protected methods
 */
class TestableDestinationService extends DestinationService {
    public canCreateEntity = super.canCreateEntity;
    public canUpdateEntity = super.canUpdateEntity;
    public canDeleteEntity = super.canDeleteEntity;
    public canRestoreEntity = super.canRestoreEntity;
    public canHardDeleteEntity = super.canHardDeleteEntity;
}

/**
 * destination.service.test.ts
 *
 * Base tests for DestinationService: construction, list, and model integration.
 * Uses Vitest and strong typing. Extend for advanced/permission tests.
 */
describe('DestinationService', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>>;
    const baseActor = { id: 'u1', permissions: [] as PermissionEnum[], role: RoleEnum.USER };
    const destinationMock = createDestination();

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>();
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        vi.clearAllMocks();
    });

    it('should construct without error', () => {
        expect(service).toBeInstanceOf(DestinationService);
    });

    it('should call model.findAll in listEntities', async () => {
        // Arrange
        const mockData = [createDestination()];
        (mockModel.findAll as unknown as import('vitest').Mock).mockResolvedValueOnce(mockData);
        // Act
        const result = await (
            service as unknown as {
                listEntities: (...args: unknown[]) => Promise<DestinationType[]>;
            }
        ).listEntities({});
        // Assert
        expect(mockModel.findAll).toHaveBeenCalledWith({});
        expect(result).toEqual(mockData);
    });

    it('should handle model.findAll error in listEntities', async () => {
        (mockModel.findAll as unknown as import('vitest').Mock).mockRejectedValueOnce(
            new Error('DB error')
        );
        await expect(
            (
                service as unknown as {
                    listEntities: (...args: unknown[]) => Promise<DestinationType[]>;
                }
            ).listEntities({})
        ).rejects.toThrow('DB error');
    });

    describe('Permission checks', () => {
        it('allows create with explicit permission', async () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.DESTINATION_CREATE] };
            const res = await service.canCreateEntity(actor);
            expect(res.canCreate).toBe(true);
        });
        it('denies create to others', async () => {
            const actor = { ...baseActor };
            const res = await service.canCreateEntity(actor);
            expect(res.canCreate).toBe(false);
        });
        it('allows update for ADMIN, SUPER_ADMIN or explicit permission', async () => {
            for (const role of [RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]) {
                const actor = { ...baseActor, role };
                const res = await service.canUpdateEntity(actor, destinationMock);
                expect(res.canUpdate).toBe(true);
            }
            const actor = { ...baseActor, permissions: [PermissionEnum.DESTINATION_UPDATE] };
            const res = await service.canUpdateEntity(actor, destinationMock);
            expect(res.canUpdate).toBe(true);
        });
        it('denies update to others', async () => {
            const actor = { ...baseActor };
            const res = await service.canUpdateEntity(actor, destinationMock);
            expect(res.canUpdate).toBe(false);
        });
        it('allows delete for ADMIN, SUPER_ADMIN or explicit permission', async () => {
            for (const role of [RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]) {
                const actor = { ...baseActor, role };
                const res = await service.canDeleteEntity(actor, destinationMock);
                expect(res.canDelete).toBe(true);
            }
            const actor = { ...baseActor, permissions: [PermissionEnum.DESTINATION_DELETE] };
            const res = await service.canDeleteEntity(actor, destinationMock);
            expect(res.canDelete).toBe(true);
        });
        it('denies delete to others', async () => {
            const actor = { ...baseActor };
            const res = await service.canDeleteEntity(actor, destinationMock);
            expect(res.canDelete).toBe(false);
        });
        it('allows restore for ADMIN, SUPER_ADMIN or explicit permission', async () => {
            for (const role of [RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]) {
                const actor = { ...baseActor, role };
                const res = await service.canRestoreEntity(actor, destinationMock);
                expect(res.canRestore).toBe(true);
            }
            const actor = { ...baseActor, permissions: [PermissionEnum.DESTINATION_UPDATE] };
            const res = await service.canRestoreEntity(actor, destinationMock);
            expect(res.canRestore).toBe(true);
        });
        it('denies restore to others', async () => {
            const actor = { ...baseActor };
            const res = await service.canRestoreEntity(actor, destinationMock);
            expect(res.canRestore).toBe(false);
        });
        it('allows hard delete for ADMIN, SUPER_ADMIN or explicit permission', () => {
            for (const role of [RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]) {
                const actor = { ...baseActor, role };
                const res = service.canHardDeleteEntity(actor, destinationMock);
                expect(res.canHardDelete).toBe(true);
            }
            const actor = { ...baseActor, permissions: [PermissionEnum.DESTINATION_DELETE] };
            const res = service.canHardDeleteEntity(actor, destinationMock);
            expect(res.canHardDelete).toBe(true);
        });
        it('denies hard delete to others', () => {
            const actor = { ...baseActor };
            const res = service.canHardDeleteEntity(actor, destinationMock);
            expect(res.canHardDelete).toBe(false);
        });
    });

    describe('Input validation', () => {
        it('accepts valid input', () => {
            const valid = (
                service as unknown as {
                    inputSchema: { safeParse: (input: unknown) => { success: boolean } };
                }
            ).inputSchema.safeParse({
                name: 'Valid Name',
                slug: 'valid-slug',
                summary: 'A valid summary for the destination.',
                description: 'A valid description for the destination, long enough.',
                location: {
                    state: 'ER',
                    zipCode: '3200',
                    country: 'Argentina',
                    street: 'Av. Costanera',
                    number: '1234',
                    city: 'Concordia'
                },
                media: {
                    featuredImage: {
                        url: 'https://cdn.hospeda.com/img1.jpg',
                        moderationState: ModerationStatusEnum.APPROVED
                    }
                },
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            });
            expect(valid.success).toBe(true);
        });
        it('rejects input with invalid enums', () => {
            const invalid = (
                service as unknown as {
                    inputSchema: { safeParse: (input: unknown) => { success: boolean } };
                }
            ).inputSchema.safeParse({
                name: 'Valid Name',
                slug: 'valid-slug',
                summary: 'A valid summary for the destination.',
                description: 'A valid description for the destination, long enough.',
                location: { state: 'A', zipCode: '1234', country: 'B' },
                media: {
                    featuredImage: { url: 'img', moderationState: 'INVALID_ENUM' }
                },
                visibility: 'INVALID_ENUM',
                lifecycleState: 'INVALID_ENUM',
                moderationState: 'INVALID_ENUM'
            });
            expect(invalid.success).toBe(false);
        });
        it('rejects input with missing required fields', () => {
            const invalid = (
                service as unknown as {
                    inputSchema: { safeParse: (input: unknown) => { success: boolean } };
                }
            ).inputSchema.safeParse({});
            expect(invalid.success).toBe(false);
        });
        it('rejects input with too short name', () => {
            const invalid = (
                service as unknown as {
                    inputSchema: { safeParse: (input: unknown) => { success: boolean } };
                }
            ).inputSchema.safeParse({
                name: 'A',
                slug: 'slug',
                summary: 'short summary',
                description: 'desc',
                location: { state: 'A', zipCode: '1234', country: 'B' },
                media: {
                    featuredImage: { url: 'img', moderationState: ModerationStatusEnum.APPROVED }
                },
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            });
            expect(invalid.success).toBe(false);
        });
        it('rejects input with incomplete location', () => {
            const invalid = (
                service as unknown as {
                    inputSchema: { safeParse: (input: unknown) => { success: boolean } };
                }
            ).inputSchema.safeParse({
                name: 'Valid Name',
                slug: 'valid-slug',
                summary: 'A valid summary for the destination.',
                description: 'A valid description for the destination, long enough.',
                location: { state: 'A' },
                media: {
                    featuredImage: { url: 'img', moderationState: ModerationStatusEnum.APPROVED }
                },
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            });
            expect(invalid.success).toBe(false);
        });
    });

    describe('Model integration', () => {
        it('calls model.create with correct data', async () => {
            const input = createDestination();
            (mockModel.create as unknown as import('vitest').Mock).mockResolvedValueOnce(input);
            // Simulate actor with permission
            const actor = { ...baseActor, role: RoleEnum.ADMIN };
            const result = await service.create({ actor, ...input });
            expect(mockModel.create).toHaveBeenCalledWith({ actor, ...input });
            expect(result.data).toEqual(input);
        });
        it('calls model.update with correct data', async () => {
            // Arrange
            const validLocation = {
                state: 'ER',
                zipCode: '3200',
                country: 'Argentina',
                street: 'Av. Costanera',
                number: '1234',
                city: 'Concordia'
            };
            const validMedia = {
                featuredImage: {
                    url: 'https://example.com/image.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                }
            };
            const entity = createDestination({ location: validLocation, media: validMedia });
            const updateFields = { name: 'Nombre actualizado' };
            const actor = { ...baseActor, role: RoleEnum.ADMIN };
            (mockModel.findById as unknown as import('vitest').Mock).mockResolvedValueOnce(entity);
            (mockModel.update as unknown as import('vitest').Mock).mockResolvedValueOnce({
                ...entity,
                ...updateFields
            });

            // Act
            const result = await service.update({
                actor,
                id: entity.id,
                ...omit(entity, 'id'),
                ...updateFields,
                location: validLocation,
                media: validMedia
            });

            // Assert
            expect(mockModel.update).toHaveBeenCalledWith(
                { id: entity.id },
                expect.objectContaining(updateFields)
            );
            expect(result.data).toEqual({ ...entity, ...updateFields });
        });
        it('handles model.create error', async () => {
            (mockModel.create as unknown as import('vitest').Mock).mockRejectedValueOnce(
                new Error('DB error')
            );
            const input = createDestination();
            const actor = { ...baseActor, role: RoleEnum.ADMIN };
            const result = await service.create({ actor, ...input });
            expect(result.error).toBeDefined();
            expect(result.error?.message).toMatch(/DB error/);
        });
    });
});

// Utilidad local para omitir una clave de un objeto
const omit = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
    const { [key]: _, ...rest } = obj;
    return rest;
};
