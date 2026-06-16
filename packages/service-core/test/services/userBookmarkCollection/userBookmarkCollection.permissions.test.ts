/**
 * Unit tests for userBookmarkCollection.permissions.ts
 *
 * Covers checkCanAdminList (lines 48-55, previously uncovered).
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { checkCanAdminList } from '../../../src/services/userBookmarkCollection/userBookmarkCollection.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

describe('userBookmarkCollection.permissions — checkCanAdminList', () => {
    it('should allow actor with USER_BOOKMARK_COLLECTION_VIEW_ANY permission', () => {
        const actor = createActor({
            permissions: [PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY]
        });
        expect(() => checkCanAdminList(actor)).not.toThrow();
    });

    it('should throw FORBIDDEN when actor lacks USER_BOOKMARK_COLLECTION_VIEW_ANY permission', () => {
        const actor = createActor({ permissions: [] });
        expect(() => checkCanAdminList(actor)).toThrowError(ServiceError);
        try {
            checkCanAdminList(actor);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
