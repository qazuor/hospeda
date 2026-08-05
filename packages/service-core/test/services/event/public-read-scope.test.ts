/**
 * @file public-read-scope.test.ts
 * @description Outcome-level proof that the remaining public event reads —
 * `getByLocation`, `getByOrganizer` and `getUpcoming` — never publish an
 * unpublished event, for ANY actor.
 *
 * The per-method suites next to this file assert the FILTER handed to the
 * model — that `applyPublicReadFloor` (HOS-374) was called with the right
 * argument. This one runs a fake model that HONOURS that filter, so a
 * constraint the service forgets to send shows up as a row that should not be
 * there — an outcome, not a call argument.
 *
 * ## Why these three, and why it was live
 *
 * Each backs a route under `/api/v1/public/events`, a `PUBLIC_CACHE_ENDPOINTS`
 * prefix (`apps/api/src/middlewares/cache.constants.ts`), and each declares a
 * `cacheTTL`. Two independent defects rode on the pattern they used to share
 * with the pre-HOS-375 `getByAuthor`:
 *
 * 1. **Cache poisoning.** `generateCacheKey` builds `public:${path}${suffix}`
 *    with NO actor component and `cacheMiddleware` runs BEFORE `authMiddleware`,
 *    so the `EVENT_SOFT_DELETE_VIEW` branch let one editor's request store
 *    PRIVATE/DRAFT events under the shared anonymous entry for the whole TTL.
 * 2. **Unconditional leak.** None of them constrained `lifecycleState` or
 *    `moderationState`, so a `DRAFT`/`ARCHIVED`/unapproved row whose
 *    `visibility` is `PUBLIC` (the column default) reached anonymous callers
 *    regardless of caching.
 */

import { EventModel } from '@repo/db';
import type { EventLocationIdType, EventOrganizerIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { Actor } from '../../../src/types';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createTypedModelMock, makeEventMediaModelStub } from '../../utils/modelMockFactory';

const locationId = getMockId('event') as EventLocationIdType;
const organizerId = getMockId('event') as EventOrganizerIdType;

/** The author's real mix: one publishable event and four that are not. */
const PUBLISHED = createMockEvent({
    locationId,
    organizerId,
    slug: 'fiesta-de-la-playa',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED
});
const DRAFT = createMockEvent({
    locationId,
    organizerId,
    slug: 'borrador-sin-publicar',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    moderationState: ModerationStatusEnum.APPROVED
});
const ARCHIVED = createMockEvent({
    locationId,
    organizerId,
    slug: 'evento-archivado',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ARCHIVED,
    moderationState: ModerationStatusEnum.APPROVED
});
const PRIVATE = createMockEvent({
    locationId,
    organizerId,
    slug: 'evento-privado',
    visibility: VisibilityEnum.PRIVATE,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED
});
/** The third floor column (HOS-374 §7.6.1): the platform's verdict. */
const UNMODERATED = createMockEvent({
    locationId,
    organizerId,
    slug: 'evento-sin-moderar',
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING
});

const ALL = [PUBLISHED, DRAFT, ARCHIVED, PRIVATE, UNMODERATED];

/**
 * Applies the three floor keys the way the real model would.
 *
 * Deliberately ignores every OTHER filter key: `getUpcoming` also passes
 * `date.start: { $gte, $lte }`, an operator object no plain equality check can
 * evaluate, and those keys are not what this file is about.
 */
const honourScope = (where: Record<string, unknown>) =>
    ALL.filter(
        (event) =>
            (where.visibility === undefined || event.visibility === where.visibility) &&
            (where.lifecycleState === undefined || event.lifecycleState === where.lifecycleState) &&
            (where.moderationState === undefined || event.moderationState === where.moderationState)
    );

/** Both ends of the actor spectrum: the response is cached for both. */
const ACTORS: readonly (readonly [string, Actor])[] = [
    ['an anonymous-equivalent actor', createActor()],
    [
        'an actor holding every event view permission',
        createActor({
            permissions: [
                PermissionEnum.EVENT_SOFT_DELETE_VIEW,
                PermissionEnum.EVENT_VIEW_PRIVATE,
                PermissionEnum.EVENT_VIEW_DRAFT
            ]
        })
    ]
];

describe('EventService — public reads never publish unpublished events', () => {
    let service: EventService;
    let modelMock: EventModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll', 'findAllWithRelations']);
        (modelMock.findAll as Mock).mockImplementation(async (where: Record<string, unknown>) => {
            const items = honourScope(where);
            return { items, total: items.length };
        });
        (modelMock.findAllWithRelations as Mock).mockImplementation(
            async (_relations: unknown, where: Record<string, unknown>) => {
                const items = honourScope(where);
                return { items, total: items.length };
            }
        );
        service = new EventService({
            model: modelMock,
            logger: { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger,
            // Every public feed asserted below composes `media` from the
            // relational `event_media` rows (HOS-390). Without this stub the
            // read path reaches for a real EventMediaModel and each case fails
            // on "Database not initialized" instead of on the scope rule.
            eventMediaModel: makeEventMediaModelStub() as never
        });
    });

    it.each(ACTORS)('getByLocation returns only the published event to %s', async (_l, actor) => {
        const result = await service.getByLocation(actor, { locationId, page: 1, pageSize: 10 });

        expectSuccess(result);
        expect(result.data?.items.map((event) => event.slug)).toEqual([PUBLISHED.slug]);
        expect(result.data?.total).toBe(1);
    });

    it.each(ACTORS)('getByOrganizer returns only the published event to %s', async (_l, actor) => {
        const result = await service.getByOrganizer(actor, { organizerId, page: 1, pageSize: 10 });

        expectSuccess(result);
        expect(result.data?.items.map((event) => event.slug)).toEqual([PUBLISHED.slug]);
        expect(result.data?.total).toBe(1);
    });

    it.each(ACTORS)('getUpcoming returns only the published event to %s', async (_l, actor) => {
        const result = await service.getUpcoming(actor, { daysAhead: 30, page: 1, pageSize: 10 });

        expectSuccess(result);
        expect(result.data?.items.map((event) => event.slug)).toEqual([PUBLISHED.slug]);
        expect(result.data?.total).toBe(1);
    });

    it('excludes the fixtures by NAME, so a passing test names what was dropped', async () => {
        // Non-vacuity for the cases above: proves the fake model can return
        // these rows at all, and that each exclusion reason is exercised.
        const result = await service.getByLocation(createActor(), {
            locationId,
            page: 1,
            pageSize: 10
        });
        const slugs = (result.data?.items ?? []).map((event) => event.slug);

        expect(slugs).not.toContain(DRAFT.slug);
        expect(slugs).not.toContain(ARCHIVED.slug);
        expect(slugs).not.toContain(PRIVATE.slug);
        expect(slugs).not.toContain(UNMODERATED.slug);
        expect(slugs).toContain(PUBLISHED.slug);
        // The fake really does hold all five when nothing narrows it.
        expect(honourScope({})).toHaveLength(5);
    });
});
