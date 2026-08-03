/**
 * @file listPublicAuthors.test.ts
 *
 * Tests for `UserService.listPublicAuthors` (HOS-375 T-011).
 *
 * This method backs `GET /api/v1/public/authors`, an unauthenticated, edge-
 * cached endpoint whose only consumer is the dynamic sitemap. Three properties
 * make that safe, and they are what these tests pin: a guest is served rather
 * than refused, the payload never varies with the actor, and the request cannot
 * ask for an unbounded page.
 *
 * The row PREDICATE — who qualifies as a public author — lives in the model and
 * is tested there; this suite deliberately does not restate it.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor, createGuestActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.listPublicAuthors', () => {
    let service: UserService;
    let userModelMock: UserModel;

    // `createGuestActor` from the factory carries an EMPTY id, which
    // `validateActor` rejects — that is not what reaches this service in
    // production. `apps/api/src/utils/actor.ts` mints this sentinel UUID for
    // every unauthenticated public request, so the test uses it verbatim.
    const guest = createGuestActor({ id: '00000000-0000-4000-8000-000000000000' });
    const someUser = createActor({
        id: getMockId('user', 'someone') as string,
        roles: [RoleEnum.USER],
        permissions: []
    });

    const AUTHORS = [
        { slug: 'equipo-hospeda', updatedAt: new Date('2026-08-01T10:00:00.000Z') },
        { slug: 'carmen-silva', updatedAt: new Date('2026-07-30T09:00:00.000Z') }
    ];

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['listPublicAuthors']);
        service = createServiceTestInstance(UserService, userModelMock, createLoggerMock());
    });

    it('serves an anonymous guest instead of refusing them', async () => {
        // Arrange — this is the exact call the public authors route makes. A
        // permission check here would make the sitemap unbuildable.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: AUTHORS, total: 2 });
        // Act
        const result = await service.listPublicAuthors(guest);
        // Assert
        expectSuccess(result);
        expect(result.data?.items).toEqual(AUTHORS);
    });

    it('returns the items alongside a full pagination envelope', async () => {
        // Arrange
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: AUTHORS, total: 2 });
        // Act
        const result = await service.listPublicAuthors(guest, { page: 1, pageSize: 50 });
        // Assert
        expectSuccess(result);
        expect(result.data?.pagination).toEqual({
            page: 1,
            pageSize: 50,
            total: 2,
            totalPages: 1
        });
    });

    it('rounds totalPages UP, so the last partial page is never dropped', async () => {
        // Arrange — 21 authors at 10 per page is 3 pages, not 2. Truncating here
        // would silently omit the final author from the sitemap.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 21 });
        // Act
        const result = await service.listPublicAuthors(guest, { page: 1, pageSize: 10 });
        // Assert
        expect(result.data?.pagination.totalPages).toBe(3);
    });

    it('reports zero pages when nothing qualifies', async () => {
        // Arrange — a fresh environment before any author has a bio and avatar.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 0 });
        // Act
        const result = await service.listPublicAuthors(guest);
        // Assert
        expectSuccess(result);
        expect(result.data?.items).toEqual([]);
        expect(result.data?.pagination.totalPages).toBe(0);
    });

    it('defaults the pagination when the caller passes none', async () => {
        // Arrange
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 0 });
        // Act
        const result = await service.listPublicAuthors(guest);
        // Assert
        expect(result.data?.pagination.page).toBe(1);
        expect(result.data?.pagination.pageSize).toBe(50);
        expect(asMock(userModelMock.listPublicAuthors).mock.calls[0]?.[0]).toEqual({
            page: 1,
            pageSize: 50
        });
    });

    it('caps pageSize so one request cannot ask for every author', async () => {
        // Arrange — `?pageSize=100000` on a public endpoint would otherwise hand
        // the database an unbounded scan.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 0 });
        // Act
        const result = await service.listPublicAuthors(guest, { pageSize: 100_000 });
        // Assert — rejected at validation rather than silently clamped, so the
        // caller learns their request was not honoured.
        expect(result.error).toBeDefined();
        expect(asMock(userModelMock.listPublicAuthors)).not.toHaveBeenCalled();
    });

    it('rejects a page below 1', async () => {
        // Arrange — page 0 would compute a negative OFFSET.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 0 });
        // Act
        const result = await service.listPublicAuthors(guest, { page: 0 });
        // Assert
        expect(result.error).toBeDefined();
        expect(asMock(userModelMock.listPublicAuthors)).not.toHaveBeenCalled();
    });

    it('forwards the requested page straight through to the model', async () => {
        // Arrange — non-vacuity guard for the defaulting test above: the values
        // are defaults, not hardcoded.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: [], total: 0 });
        // Act
        await service.listPublicAuthors(guest, { page: 4, pageSize: 25 });
        // Assert
        expect(asMock(userModelMock.listPublicAuthors).mock.calls[0]?.[0]).toEqual({
            page: 4,
            pageSize: 25
        });
    });

    it('returns an identical payload to a guest and to a signed-in user', async () => {
        // Arrange — the route is edge-cached on a session-blind key, so any
        // actor-dependent branch here would serve one visitor's payload to
        // everyone.
        asMock(userModelMock.listPublicAuthors).mockResolvedValue({ items: AUTHORS, total: 2 });
        // Act
        const asGuest = await service.listPublicAuthors(guest, { page: 1, pageSize: 50 });
        const asMember = await service.listPublicAuthors(someUser, { page: 1, pageSize: 50 });
        // Assert
        expect(asMember.data).toEqual(asGuest.data);
    });

    it('returns INTERNAL_ERROR if the model throws', async () => {
        // Arrange
        asMock(userModelMock.listPublicAuthors).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.listPublicAuthors(guest);
        // Assert
        expectInternalError(result);
    });
});
