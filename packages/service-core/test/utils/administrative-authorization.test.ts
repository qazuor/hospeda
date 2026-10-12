import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import {
    isAction15AuthorizedFor,
    resolveAdministrativeAuthorization,
    runWithAdministrativeAuthorization
} from '../../src/utils/administrative-authorization';

const OWNER_ID = 'owner-1';
const OTHER_OWNER_ID = 'owner-2';
const ADMIN_ID = 'admin-1';

/** No role at all: the decision reads permissions and the scope only. */
const actor = (id: string, permissions: PermissionEnum[]): Actor => ({
    id,
    roles: [],
    permissions
});
const admin15 = actor(ADMIN_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]);
const acc15For = (subjectId: string) => ({ action: 'ACC_15' as const, subjectId });

describe('administrative authorization scope (ACC:15, HOS-1493)', () => {
    it('is not authorized outside any scope, even holding the permission', () => {
        // Act
        const authorized = isAction15AuthorizedFor({ actor: admin15, ownerId: OWNER_ID });

        // Assert
        expect(authorized).toBe(false);
        expect(resolveAdministrativeAuthorization()).toEqual({ authorization: null });
    });

    it('is authorized inside a scope bound to the listing owner', async () => {
        // Act
        const authorized = await runWithAdministrativeAuthorization({
            authorization: acc15For(OWNER_ID),
            run: async () => isAction15AuthorizedFor({ actor: admin15, ownerId: OWNER_ID })
        });

        // Assert
        expect(authorized).toBe(true);
    });

    it('does not cover a listing of a different owner', async () => {
        const authorized = await runWithAdministrativeAuthorization({
            authorization: acc15For(OTHER_OWNER_ID),
            run: async () => isAction15AuthorizedFor({ actor: admin15, ownerId: OWNER_ID })
        });

        expect(authorized).toBe(false);
    });

    it('does not cover the owner herself, nor an actor without the permission, nor an unknown owner', async () => {
        const results = await runWithAdministrativeAuthorization({
            authorization: acc15For(OWNER_ID),
            run: async () => [
                isAction15AuthorizedFor({
                    actor: actor(OWNER_ID, [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]),
                    ownerId: OWNER_ID
                }),
                isAction15AuthorizedFor({
                    actor: actor(ADMIN_ID, [PermissionEnum.ACCOMMODATION_UPDATE_ANY]),
                    ownerId: OWNER_ID
                }),
                isAction15AuthorizedFor({ actor: admin15, ownerId: null })
            ]
        });

        expect(results).toEqual([false, false, false]);
    });

    it('does not leak out of the scope once run settles', async () => {
        // Arrange
        await runWithAdministrativeAuthorization({
            authorization: acc15For(OWNER_ID),
            run: async () => undefined
        });

        // Act
        const authorized = isAction15AuthorizedFor({ actor: admin15, ownerId: OWNER_ID });

        // Assert
        expect(authorized).toBe(false);
    });
});
