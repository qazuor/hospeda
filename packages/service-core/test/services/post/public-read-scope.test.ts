/**
 * @file public-read-scope.test.ts
 * @description Outcome-level proof that the five remaining public post reads —
 * `getNews`, `getFeatured`, `getByRelatedAccommodation`,
 * `getByRelatedDestination` and `getByRelatedEvent` — never publish an
 * unpublished post, for ANY actor.
 *
 * The per-method suites next to this file assert the FILTER handed to the
 * model — that `applyPublicReadFloor` (HOS-374) was called with the right
 * argument. This one runs a fake model that HONOURS that filter, so a
 * constraint the service forgets to send shows up as a row that should not be
 * there — an outcome, not a call argument. It is the post-side twin of
 * `test/services/event/public-read-scope.test.ts`.
 *
 * ## Why these five, and why it was live
 *
 * Each backs a route registered in `apps/api/src/routes/post/public/index.ts`
 * under `/api/v1/public/posts`, a `PUBLIC_CACHE_ENDPOINTS` prefix
 * (`apps/api/src/middlewares/cache.constants.ts`), and each declares a
 * `cacheTTL` (60 for news/featured, 300 for the three `related` routes). All
 * five carried the SAME guard the already-fixed `getByCategory` did:
 *
 * ```ts
 * if (validated.visibility) { ... } else if (!actor.id) { where.visibility = 'PUBLIC'; }
 * ```
 *
 * That guard was DEAD CODE. `createGuestActor` (`apps/api/src/utils/actor.ts`)
 * hands every unauthenticated public request a real UUID
 * (`00000000-0000-4000-8000-000000000000`), and `runWithLoggingAndValidation`
 * rejects an actor without an id outright — so `!actor.id` was never true for
 * any caller that reached these methods. Two defects rode on it:
 *
 * 1. **Unconditional leak.** `visibility` was effectively unfiltered, and
 *    `lifecycleState` / `moderationState` genuinely unfiltered, so a `PRIVATE`
 *    post — or a `DRAFT`/`ARCHIVED`/unapproved one whose `visibility` is
 *    `PUBLIC` (the column default) — reached anonymous callers directly.
 * 2. **Cache poisoning.** `generateCacheKey` builds `public:${path}${suffix}`
 *    with NO actor component and `cacheMiddleware` runs BEFORE
 *    `authMiddleware`, so the leaked rows were then served from the shared
 *    anonymous entry for the whole TTL.
 *
 * Both actors below are therefore load-bearing: the response is cached for
 * both, so both must see exactly the published post.
 */

import { PostModel } from '@repo/db';
import type {
    AccommodationIdType,
    DestinationIdType,
    EventIdType,
    PostIdType
} from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { Actor } from '../../../src/types';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const accommodationId = getMockId('accommodation') as AccommodationIdType;
const destinationId = getMockId('destination') as DestinationIdType;
const eventId = getMockId('event') as EventIdType;

/**
 * Every fixture satisfies EVERY method's non-scope filter at once (`isNews`,
 * `isFeatured` and all three `related*` ids), so a single fake model serves all
 * five reads and the only thing that can vary the outcome is the scope.
 */
const commonShape = {
    isNews: true,
    isFeatured: true,
    relatedAccommodationId: accommodationId,
    relatedDestinationId: destinationId,
    relatedEventId: eventId
} as const;

/** One publishable post and four that are not. */
const PUBLISHED = createMockPost({
    ...commonShape,
    slug: 'nota-publicada',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const DRAFT = createMockPost({
    ...commonShape,
    id: getMockId('post', '2') as PostIdType,
    slug: 'borrador-sin-publicar',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.DRAFT
});
const ARCHIVED = createMockPost({
    ...commonShape,
    id: getMockId('post', '3') as PostIdType,
    slug: 'nota-archivada',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ARCHIVED
});
const PRIVATE = createMockPost({
    ...commonShape,
    id: getMockId('post', '4') as PostIdType,
    slug: 'nota-privada',
    visibility: VisibilityEnum.PRIVATE,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
/**
 * The third floor column (HOS-374 §7.6.1): the platform's verdict. A post the
 * author published and never archived is still not servable until moderation
 * approves it.
 */
const UNMODERATED = createMockPost({
    ...commonShape,
    id: getMockId('post', '5') as PostIdType,
    slug: 'nota-sin-moderar',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING
});

const ALL = [PUBLISHED, DRAFT, ARCHIVED, PRIVATE, UNMODERATED];

/**
 * Applies the three floor keys the way the real model would.
 *
 * Deliberately ignores every OTHER filter key: `getNews` also passes
 * `expiresAt: { gte, lte }`, an operator object no plain equality check can
 * evaluate, and those keys are not what this file is about.
 */
const honourScope = (where: Record<string, unknown>) =>
    ALL.filter(
        (post) =>
            (where.visibility === undefined || post.visibility === where.visibility) &&
            (where.lifecycleState === undefined || post.lifecycleState === where.lifecycleState) &&
            (where.moderationState === undefined || post.moderationState === where.moderationState)
    );

/**
 * The exact actor `apps/api/src/utils/actor.ts` builds for an unauthenticated
 * public request. Copied as a literal on purpose: the old guard keyed on
 * `!actor.id`, and this non-empty UUID is precisely why it never fired.
 */
const GUEST_ACTOR = {
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST],
    permissions: []
} as unknown as Actor;

/** Both ends of the actor spectrum: the response is cached for both. */
const ACTORS: readonly (readonly [string, Actor])[] = [
    ['an anonymous visitor (the API GUEST actor)', GUEST_ACTOR],
    [
        'an actor holding every post view permission',
        {
            id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
            roles: [RoleEnum.ADMIN],
            permissions: [
                PermissionEnum.POST_VIEW_PRIVATE,
                PermissionEnum.POST_VIEW_DRAFT,
                PermissionEnum.POST_SOFT_DELETE_VIEW
            ]
        } as unknown as Actor
    ]
];

describe('PostService — public reads never publish unpublished posts', () => {
    let service: PostService;
    let modelMock: PostModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        (modelMock.findAll as Mock).mockImplementation(async (where: Record<string, unknown>) => {
            const items = honourScope(where);
            return { items, total: items.length };
        });
        service = new PostService({ logger: createLoggerMock() }, modelMock);
    });

    it.each(ACTORS)('getNews returns only the published post to %s', async (_label, actor) => {
        const result = await service.getNews(actor, {});

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it.each(ACTORS)('getFeatured returns only the published post to %s', async (_label, actor) => {
        const result = await service.getFeatured(actor, {});

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it.each(
        ACTORS
    )('getByRelatedAccommodation returns only the published post to %s', async (_label, actor) => {
        const result = await service.getByRelatedAccommodation(actor, { accommodationId });

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it.each(
        ACTORS
    )('getByRelatedDestination returns only the published post to %s', async (_label, actor) => {
        const result = await service.getByRelatedDestination(actor, { destinationId });

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it.each(
        ACTORS
    )('getByRelatedEvent returns only the published post to %s', async (_label, actor) => {
        const result = await service.getByRelatedEvent(actor, { eventId });

        expectSuccess(result);
        expect((result.data ?? []).map((post) => post.slug)).toEqual([PUBLISHED.slug]);
    });

    it('excludes the fixtures by NAME, so a passing test names what was dropped', async () => {
        // Non-vacuity for every case above: proves the fake model can return
        // these rows at all, and that each exclusion reason is exercised.
        const result = await service.getNews(GUEST_ACTOR, {});
        const slugs = (result.data ?? []).map((post) => post.slug);

        expect(slugs).not.toContain(DRAFT.slug);
        expect(slugs).not.toContain(ARCHIVED.slug);
        expect(slugs).not.toContain(PRIVATE.slug);
        expect(slugs).not.toContain(UNMODERATED.slug);
        expect(slugs).toContain(PUBLISHED.slug);
        // The fake really does hold all five when nothing narrows it.
        expect(honourScope({})).toHaveLength(5);
    });
});
