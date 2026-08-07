import { PostModel } from '@repo/db';
import type { PostIdType } from '@repo/schemas';
import { LifecycleStatusEnum, PostCategoryEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import type { Actor } from '../../../src';
import { PUBLIC_READ_FLOOR } from '../../../src/services/moderation/public-read-floor';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import {
    createLoggerMock,
    createTypedModelMock,
    makePostMediaModelStub
} from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('PostService.getByCategory', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        roles: [RoleEnum.USER],
        permissions: []
    };
    const category = PostCategoryEnum.GENERAL;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService(
            { logger: loggerMock },
            modelMock,
            null,
            undefined,
            makePostMediaModelStub() as never
        );
    });

    it('scopes an AUTHENTICATED actor to PUBLIC + ACTIVE — the route is actor-blind', async () => {
        // `actor` above is a plain signed-in USER with no permissions at all.
        // The old code only defaulted `visibility` to PUBLIC when `!actor.id`,
        // so ANY logged-in visitor widened the result — and
        // `GET /api/v1/public/posts/category/{category}` declares
        // `cacheTTL: 300` under the `/api/v1/public/posts` prefix of
        // PUBLIC_CACHE_ENDPOINTS, whose key carries no actor. One such request
        // stored PRIVATE/DRAFT posts for every visitor for five minutes.
        const posts = [
            createMockPost({ category }),
            createMockPost({ id: getMockId('post', '2') as PostIdType, category })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });

        const result = await service.getByCategory(actor, { category });

        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ category, ...PUBLIC_READ_FLOOR });
    });

    it('should override a caller-supplied visibility with the public read floor', async () => {
        // HOS-374 §7.6.5: the public read floor is applied last on public read
        // paths, so a caller-supplied `visibility` (even PRIVATE) is overridden
        // rather than honored.
        const posts = [createMockPost({ category, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { category, visibility: VisibilityEnum.PRIVATE };

        const result = await service.getByCategory(actor, params);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            category,
            ...PUBLIC_READ_FLOOR
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [createMockPost({ category, createdAt: new Date('2024-07-01') })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = {
            category,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByCategory(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            category,
            createdAt: { gte: params.fromDate, lte: params.toDate },
            ...PUBLIC_READ_FLOOR
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = { category };
        const result = await service.getByCategory(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        /* Should return unauthorized error if actor is missing. */
        const result = await service.getByCategory(
            undefined as unknown as Actor, // purposely invalid to simulate missing actor
            { category }
        );
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid
        const result = await service.getByCategory(actor, { actor: 123 } as any);
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const params = { category };
        const result = await service.getByCategory(actor, params);
        expectInternalError(result);
    });
});

/**
 * The exact actor `apps/api/src/utils/actor.ts` builds for an unauthenticated
 * public request. Copied as a literal on purpose: the old visibility guard
 * keyed on `!actor.id`, and this non-empty UUID is precisely why that guard
 * never fired in production.
 */
const GUEST_ACTOR = {
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST],
    permissions: []
} as unknown as Actor;

/**
 * Outcome-level proof, as opposed to the call-argument assertions above: the
 * fake model HONOURS the filters it is handed, so a constraint the service
 * forgets to send shows up as a row that should not be there.
 */
describe('PostService.getByCategory — unpublished posts never reach the public list', () => {
    let service: PostService;
    let modelMock: PostModel;
    const category = PostCategoryEnum.GENERAL;

    /** One publishable post and three that are not. */
    const PUBLISHED = createMockPost({
        category,
        slug: 'nota-publicada',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    });
    const DRAFT = createMockPost({
        id: getMockId('post', '2') as PostIdType,
        category,
        slug: 'borrador-sin-publicar',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.DRAFT
    });
    const ARCHIVED = createMockPost({
        id: getMockId('post', '3') as PostIdType,
        category,
        slug: 'nota-archivada',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED
    });
    const PRIVATE = createMockPost({
        id: getMockId('post', '4') as PostIdType,
        category,
        slug: 'nota-privada',
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    });

    const ALL = [PUBLISHED, DRAFT, ARCHIVED, PRIVATE];

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        (modelMock.findAll as Mock).mockImplementation(async (where: Record<string, unknown>) => {
            const items = ALL.filter(
                (post) =>
                    (where.visibility === undefined || post.visibility === where.visibility) &&
                    (where.lifecycleState === undefined ||
                        post.lifecycleState === where.lifecycleState)
            );
            return { items, total: items.length };
        });
        // `getByCategory` composes `media` from the relational `post_media` rows
        // (HOS-390). Without the stub the read path reaches for a real
        // PostMediaModel and every case here fails on "Database not initialized"
        // rather than on the scope rule it is asserting.
        service = new PostService(
            { logger: createLoggerMock() },
            modelMock,
            null,
            undefined,
            makePostMediaModelStub() as never
        );
    });

    it.each([
        ['an anonymous visitor (the API GUEST actor)', GUEST_ACTOR],
        [
            'a plain signed-in user',
            {
                id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
                roles: [RoleEnum.USER],
                permissions: []
            } as Actor
        ]
    ])('returns only the published post to %s', async (_label, callerActor) => {
        // The anonymous case is the one that proves the old guard was DEAD.
        // It keyed on `!actor.id`, but `createGuestActor`
        // (apps/api/src/utils/actor.ts) hands every unauthenticated public
        // request a real UUID, so the branch never fired for anyone — the
        // route served PRIVATE and DRAFT posts to every visitor, cache or no
        // cache.
        const result = await service.getByCategory(callerActor, { category });

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it('excludes the fixtures by NAME, so a passing test names what was dropped', async () => {
        // Non-vacuity: proves the fake model can return these rows at all.
        const result = await service.getByCategory(GUEST_ACTOR, { category });
        const slugs = (result.data ?? []).map((post) => post.slug);

        expect(slugs).not.toContain(DRAFT.slug);
        expect(slugs).not.toContain(ARCHIVED.slug);
        expect(slugs).not.toContain(PRIVATE.slug);
        expect(slugs).toContain(PUBLISHED.slug);
        expect(ALL).toHaveLength(4);
    });
});
