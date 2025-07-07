import { REntityTagModel, TagModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GetEntitiesByTagInput } from '../../../src/services/tag/tag.schemas';
import { TagService } from '../../../src/services/tag/tag.service';
import type { ServiceInput, ServiceOutput } from '../../../src/types';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

const mockTag = TagFactoryBuilder.create();
const mockActor = { id: 'user-1', role: RoleEnum.USER, permissions: [PermissionEnum.TAG_UPDATE] };
const baseActor = { id: 'user-2', role: RoleEnum.USER, permissions: [] };

describe('TagService.getEntitiesByTag', () => {
    let service: TagService;
    let mockModel: TagModel;
    let mockRelatedModel: REntityTagModel;
    let mockLogger: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        mockModel = createTypedModelMock(TagModel, []);
        mockRelatedModel = createTypedModelMock(REntityTagModel, ['findAllWithEntities']);
        mockLogger = createLoggerMock();
        service = new TagService({ logger: mockLogger }, mockModel, mockRelatedModel);
    });

    it('returns entities for a tag (success)', async () => {
        asMock(mockModel.findById).mockResolvedValue(mockTag);
        asMock(mockRelatedModel.findAllWithEntities).mockResolvedValue([
            { entityId: 'e1', entityType: EntityTypeEnum.ACCOMMODATION },
            { entityId: 'e2', entityType: EntityTypeEnum.DESTINATION }
        ]);
        const input: ServiceInput<GetEntitiesByTagInput> = { actor: mockActor, tagId: mockTag.id };
        const result: ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }> =
            await service.getEntitiesByTag(input);
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
        expect(result.data?.entities).toHaveLength(2);
        expect(result.data?.entities?.[0]?.entityId).toBe('e1');
    });

    it('returns empty array if no entities are associated', async () => {
        asMock(mockModel.findById).mockResolvedValue(mockTag);
        asMock(mockRelatedModel.findAllWithEntities).mockResolvedValue([]);
        const input: ServiceInput<GetEntitiesByTagInput> = { actor: mockActor, tagId: mockTag.id };
        const result: ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }> =
            await service.getEntitiesByTag(input);
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
        expect(result.data?.entities).toEqual([]);
    });

    it('filters by entityType if provided', async () => {
        asMock(mockModel.findById).mockResolvedValue(mockTag);
        asMock(mockRelatedModel.findAllWithEntities).mockResolvedValue([
            { entityId: 'e1', entityType: EntityTypeEnum.ACCOMMODATION }
        ]);
        const input: ServiceInput<GetEntitiesByTagInput> = {
            actor: mockActor,
            tagId: mockTag.id,
            entityType: EntityTypeEnum.ACCOMMODATION
        };
        const result: ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }> =
            await service.getEntitiesByTag(input);
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
        expect(result.data?.entities).toHaveLength(1);
        expect(result.data?.entities?.[0]?.entityType).toBe(EntityTypeEnum.ACCOMMODATION);
        expect(mockRelatedModel.findAllWithEntities).toHaveBeenCalledWith(
            mockTag.id,
            EntityTypeEnum.ACCOMMODATION
        );
    });

    it('returns NOT_FOUND if tag does not exist', async () => {
        asMock(mockModel.findById).mockResolvedValue(null);
        const input: ServiceInput<GetEntitiesByTagInput> = {
            actor: mockActor,
            tagId: 'nonexistent'
        };
        const result: ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }> =
            await service.getEntitiesByTag(input);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('returns FORBIDDEN if actor lacks TAG_UPDATE permission', async () => {
        asMock(mockModel.findById).mockResolvedValue(mockTag);
        const input: ServiceInput<GetEntitiesByTagInput> = { actor: baseActor, tagId: mockTag.id };
        const result: ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }> =
            await service.getEntitiesByTag(input);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});
