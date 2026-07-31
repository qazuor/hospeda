/**
 * @file getPublicProfileBySlug.test.ts
 *
 * Regression suite for UserService.getPublicProfileBySlug.
 *
 * The bug: the public author route called `getBySlug`, whose `_canView` gate is
 * "self or USER_READ_ALL". Every anonymous visitor therefore got a 403 on
 * `GET /api/v1/public/users/by-slug/{slug}`, which the web app maps to a 404 —
 * so the author link on every post byline was dead.
 *
 * These tests pin the three properties that make bypassing that gate safe:
 * a guest is served, the payload carries ONLY public fields, and the payload
 * does not vary with the actor (the route is edge-cached with a session-blind
 * key).
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor, createGuestActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.getPublicProfileBySlug', () => {
    let service: UserService;
    let userModelMock: UserModel;
    const userId = getMockId('user', 'author-1') as string;
    const slug = 'carmen-silva';

    // The factory's guest carries an EMPTY id, which `validateActor` rejects —
    // that is not what reaches this service in production. `createGuestActor`
    // in `apps/api/src/utils/actor.ts` mints this sentinel UUID for every
    // unauthenticated public request, so the test uses it verbatim.
    const guest = createGuestActor({ id: '00000000-0000-4000-8000-000000000000' });
    const self = createActor({ id: userId, roles: [RoleEnum.USER], permissions: [] });
    const otherUser = createActor({
        id: getMockId('user', 'someone-else') as string,
        roles: [RoleEnum.USER],
        permissions: []
    });

    /** An author row carrying private data the projection must never emit. */
    const authorRow = () =>
        createUser({
            id: userId,
            slug,
            displayName: 'Carmen Silva',
            email: 'carmen@private.test',
            profile: { avatar: 'https://cdn.test/carmen.jpg', bio: 'Escribe sobre el litoral.' }
        });

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findOne']);
        service = createServiceTestInstance(UserService, userModelMock, createLoggerMock());
    });

    it('serves an anonymous guest instead of throwing FORBIDDEN', async () => {
        // Arrange — this is the exact call the public author route makes.
        asMock(userModelMock.findOne).mockResolvedValue(authorRow());
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert
        expectSuccess(result);
        expect(result.data?.slug).toBe(slug);
        expect(result.data?.displayName).toBe('Carmen Silva');
    });

    it('emits ONLY the public author fields, never private user data', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(authorRow());
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert — an exact key set, so a future field added to the projection
        // has to be reviewed here rather than silently reaching a public URL.
        expect(Object.keys(result.data ?? {}).sort()).toEqual([
            'avatar',
            'bio',
            'displayName',
            'id',
            'slug'
        ]);
    });

    it('returns the identical payload to a guest, the user themselves and a third party', async () => {
        // Arrange — the route is edge-cached on a session-blind key, so any
        // actor-dependent field here would poison the cache for everyone.
        asMock(userModelMock.findOne).mockResolvedValue(authorRow());
        // Act
        const asGuest = await service.getPublicProfileBySlug(guest, { slug });
        const asSelf = await service.getPublicProfileBySlug(self, { slug });
        const asOther = await service.getPublicProfileBySlug(otherUser, { slug });
        // Assert
        expect(asSelf.data).toEqual(asGuest.data);
        expect(asOther.data).toEqual(asGuest.data);
    });

    it('returns null when no user owns that slug', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert
        expectSuccess(result);
        expect(result.data).toBeNull();
    });

    it('treats a soft-deleted user as absent', async () => {
        // Arrange — `findOne` does not filter `deleted_at`, so without the
        // explicit guard a deleted author would keep serving a 200 publicly.
        asMock(userModelMock.findOne).mockResolvedValue(
            createUser({ id: userId, slug, deletedAt: new Date() })
        );
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert
        expectSuccess(result);
        expect(result.data).toBeNull();
    });

    it('nulls avatar and bio when the profile is unset', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(
            createUser({ id: userId, slug, displayName: undefined, profile: undefined })
        );
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert
        expectSuccess(result);
        expect(result.data?.avatar).toBeNull();
        expect(result.data?.bio).toBeNull();
        expect(result.data?.displayName).toBeNull();
    });

    it('returns INTERNAL_ERROR if the model throws', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.getPublicProfileBySlug(guest, { slug });
        // Assert
        expectInternalError(result);
    });
});
