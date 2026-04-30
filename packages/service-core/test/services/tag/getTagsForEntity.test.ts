import { REntityTagModel, TagModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor, createGuestActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.getTagsForEntity', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({ name: 'Tag' });
    const input = { entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', entityType: 'POST' };
    const relation = { id: 'rel-1', tag };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById']);
        // getTagsForEntity (T-020) calls findByEntityAndActor for regular users
        // and findByEntityAll for actors with TAG_VIEW_ALL_ASSIGNMENTS.
        relModelMock = createTypedModelMock(REntityTagModel, [
            'findByEntityAndActor',
            'findByEntityAll'
        ]);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relModelMock);
        actor = createActor({ permissions: [] });
    });

    it('should return tags for an entity (success)', async () => {
        // Regular actor (no TAG_VIEW_ALL_ASSIGNMENTS) → findByEntityAndActor is called.
        // The model returns entity-tag relations; getTagsForEntity maps rel.tag to tags[].
        asMock(relModelMock.findByEntityAndActor).mockResolvedValue([relation]);
        const result = await service.getTagsForEntity(actor, input);
        expectSuccess(result);
        expect(result.data?.tags).toHaveLength(1);
        expect(result.data?.tags[0]).toEqual(tag);
    });

    it('should return an empty array if no tags are found', async () => {
        asMock(relModelMock.findByEntityAndActor).mockResolvedValue([]);
        const result = await service.getTagsForEntity(actor, input);
        expectSuccess(result);
        expect(result.data?.tags).toHaveLength(0);
    });

    it('should return empty array for anonymous actor (D-007)', async () => {
        // Anonymous actors (no id) see nothing from this subsystem (D-007).
        // The service guards before runWithLoggingAndValidation, returning { data: { tags: [] } }.
        const guestActor = createGuestActor();
        const result = await service.getTagsForEntity(guestActor, input);
        expect(result.error).toBeUndefined();
        expect(result.data?.tags).toEqual([]);
        expect(asMock(relModelMock.findByEntityAndActor)).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getTagsForEntity(actor, {
            entityId: '',
            entityType: 'POST'
        } as any);
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(relModelMock.findByEntityAndActor).mockRejectedValue(new Error('DB error'));
        const result = await service.getTagsForEntity(actor, input);
        expectInternalError(result);
    });
});
