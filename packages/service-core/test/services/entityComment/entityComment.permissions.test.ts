import { EntityTypeEnum, PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assertCommentEntityType,
    checkCanCreateComment,
    checkCanListComments,
    checkCanModerateComment,
    checkCanViewComment
} from '../../../src/services/entityComment/entityComment.permissions';
import { createActor } from '../../factories/actorFactory';

const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

describe('entityComment.permissions', () => {
    describe('assertCommentEntityType', () => {
        it('accepts POST and EVENT', () => {
            expect(assertCommentEntityType(EntityTypeEnum.POST)).toBe(EntityTypeEnum.POST);
            expect(assertCommentEntityType(EntityTypeEnum.EVENT)).toBe(EntityTypeEnum.EVENT);
        });

        it('throws for unsupported entity types (AC-3)', () => {
            expect(() => assertCommentEntityType(EntityTypeEnum.ACCOMMODATION)).toThrow();
            expect(() => assertCommentEntityType(EntityTypeEnum.DESTINATION)).toThrow();
        });
    });

    describe('checkCanCreateComment', () => {
        it('passes with the matching _CREATE permission', () => {
            const actor = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.POST_COMMENT_CREATE]
            });
            expect(() => checkCanCreateComment(actor, EntityTypeEnum.POST)).not.toThrow();
        });

        it('throws when the actor holds the OTHER entity type create permission', () => {
            const actor = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.POST_COMMENT_CREATE]
            });
            expect(() => checkCanCreateComment(actor, EntityTypeEnum.EVENT)).toThrow();
        });
    });

    describe('checkCanViewComment / checkCanModerateComment', () => {
        it('view passes only with the matching _VIEW permission', () => {
            const actor = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.EVENT_COMMENT_VIEW]
            });
            expect(() => checkCanViewComment(actor, EntityTypeEnum.EVENT)).not.toThrow();
            expect(() => checkCanViewComment(actor, EntityTypeEnum.POST)).toThrow();
        });

        it('moderate passes only with the matching _MODERATE permission', () => {
            const actor = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.POST_COMMENT_MODERATE]
            });
            expect(() => checkCanModerateComment(actor, EntityTypeEnum.POST)).not.toThrow();
            expect(() => checkCanModerateComment(actor, EntityTypeEnum.EVENT)).toThrow();
        });
    });

    describe('checkCanListComments', () => {
        it('passes with at least one comment _VIEW permission', () => {
            const actor = createActor({
                id: ACTOR_ID,
                permissions: [PermissionEnum.EVENT_COMMENT_VIEW]
            });
            expect(() => checkCanListComments(actor)).not.toThrow();
        });

        it('throws when the actor holds no comment view permission', () => {
            const actor = createActor({ id: ACTOR_ID, permissions: [] });
            expect(() => checkCanListComments(actor)).toThrow();
        });
    });
});
