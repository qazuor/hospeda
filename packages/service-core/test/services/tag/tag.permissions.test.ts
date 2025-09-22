import { PermissionEnum, RoleEnum, ServiceErrorCode, TagColorEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCountTags,
    checkCanCreateTag,
    checkCanDeleteTag,
    checkCanListTags,
    checkCanRestoreTag,
    checkCanSearchTags,
    checkCanUpdateTag,
    checkCanUpdateVisibilityTag,
    checkCanViewTag
} from '../../../src/services/tag/tag.permissions';
import { ServiceError } from '../../../src/types';
import { TagFactoryBuilder } from '../../factories/tagFactory';

const baseActor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };
const tag = TagFactoryBuilder.create({ name: 'Tag', slug: 'tag', color: TagColorEnum.BLUE });

describe('tag.permissions', () => {
    it('checkCanCreateTag allows with TAG_CREATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.TAG_CREATE] };
        expect(() => checkCanCreateTag(actor)).not.toThrow();
    });
    it('checkCanCreateTag throws without TAG_CREATE', () => {
        try {
            checkCanCreateTag(baseActor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanUpdateTag allows with TAG_UPDATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.TAG_UPDATE] };
        expect(() => checkCanUpdateTag(actor, tag)).not.toThrow();
    });
    it('checkCanUpdateTag throws without TAG_UPDATE', () => {
        try {
            checkCanUpdateTag(baseActor, tag);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanDeleteTag allows with TAG_DELETE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.TAG_DELETE] };
        expect(() => checkCanDeleteTag(actor, tag)).not.toThrow();
    });
    it('checkCanDeleteTag throws without TAG_DELETE', () => {
        try {
            checkCanDeleteTag(baseActor, tag);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanRestoreTag allows with TAG_UPDATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.TAG_UPDATE] };
        expect(() => checkCanRestoreTag(actor, tag)).not.toThrow();
    });
    it('checkCanRestoreTag throws without TAG_UPDATE', () => {
        try {
            checkCanRestoreTag(baseActor, tag);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    it('checkCanViewTag always allows (public)', () => {
        expect(() => checkCanViewTag(baseActor, tag)).not.toThrow();
    });

    it('checkCanListTags always allows (public)', () => {
        expect(() => checkCanListTags(baseActor)).not.toThrow();
    });

    it('checkCanSearchTags always allows (public)', () => {
        expect(() => checkCanSearchTags(baseActor)).not.toThrow();
    });

    it('checkCanCountTags always allows (public)', () => {
        expect(() => checkCanCountTags(baseActor)).not.toThrow();
    });

    it('checkCanUpdateVisibilityTag allows with TAG_UPDATE', () => {
        const actor = { ...baseActor, permissions: [PermissionEnum.TAG_UPDATE] };
        expect(() => checkCanUpdateVisibilityTag(actor, tag)).not.toThrow();
    });
    it('checkCanUpdateVisibilityTag throws without TAG_UPDATE', () => {
        try {
            checkCanUpdateVisibilityTag(baseActor, tag);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });
});
