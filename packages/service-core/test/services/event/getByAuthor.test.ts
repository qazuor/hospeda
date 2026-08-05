/**
 * @file getByAuthor.test.ts
 * @description Tests for `EventService.getByAuthor`.
 *
 * HOS-375 made this method load-bearing: it is the ONLY source of events for
 * the public author page (`/autores/<slug>/`), which is now indexable and
 * sitemapped. Two things it used to get wrong:
 *
 * 1. It filtered `visibility` but NEVER `lifecycleState`, so a `DRAFT` or
 *    `ARCHIVED` event was published on that page AND counted toward the page's
 *    indexability gate (§6.5).
 * 2. It skipped even the `visibility` filter for actors holding
 *    `EVENT_SOFT_DELETE_VIEW`. Its only caller is a PUBLIC route whose cache
 *    key carries no actor, so one privileged request would store unpublished
 *    events under the shared anonymous entry.
 *
 * Both are now closed by routing the filters through
 * `applyPublicVisibilityScope`. The first block asserts the FILTER the model
 * receives; the second runs a fake model that honours that filter, so the
 * exclusion is proven as an outcome rather than as a call argument.
 */

import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

/** The scope every caller must receive, whoever they are. */
const PUBLISHED_SCOPE = {
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
} as const;

describe('EventService.getByAuthor', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const authorId = createUser().id;
    const actorWithPerm = createActor({
        permissions: [
            PermissionEnum.EVENT_SOFT_DELETE_VIEW,
            PermissionEnum.EVENT_VIEW_PRIVATE,
            PermissionEnum.EVENT_VIEW_DRAFT
        ]
    });
    const actorNoPerm = createActor();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('scopes an unprivileged actor to PUBLIC + ACTIVE', async () => {
        // Arrange
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.getByAuthor(actorNoPerm, { authorId, page: 1, pageSize: 10 });

        // Assert — `lifecycleState` is the half that used to be missing.
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { authorId, ...PUBLISHED_SCOPE },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('scopes a PRIVILEGED actor identically — the route is actor-blind', async () => {
        // The cache-poisoning guard. This route's cached body has no actor
        // component, so an editor's request must not widen what gets stored.
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        await service.getByAuthor(actorWithPerm, { authorId, page: 1, pageSize: 10 });

        expect(modelMock.findAll).toHaveBeenCalledWith(
            { authorId, ...PUBLISHED_SCOPE },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('should throw forbidden if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByAuthor(undefined, { authorId, page: 1, pageSize: 10 });
        expectUnauthorizedError(result);
    });

    it('should throw validation error if authorId is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByAuthor(actorWithPerm, {});
        expectValidationError(result);
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByAuthor(actorWithPerm, {
            authorId,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getByAuthor(actorWithPerm, {
            authorId,
            page: 1,
            pageSize: 10
        });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByAuthor(undefined, { authorId, page: 1, pageSize: 10 });
        expectUnauthorizedError(result);
    });
});

describe('EventService.getByAuthor — unpublished events never reach the author page', () => {
    let service: EventService;
    let modelMock: EventModel;
    const authorId = createUser().id;

    /** The author's real mix: one publishable event and three that are not. */
    const PUBLISHED = createMockEvent({
        authorId,
        slug: 'fiesta-de-la-playa',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    });
    const DRAFT = createMockEvent({
        authorId,
        slug: 'borrador-sin-publicar',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.DRAFT
    });
    const ARCHIVED = createMockEvent({
        authorId,
        slug: 'evento-archivado',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED
    });
    const PRIVATE = createMockEvent({
        authorId,
        slug: 'evento-privado',
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    });

    const ALL = [PUBLISHED, DRAFT, ARCHIVED, PRIVATE];

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        // A model that HONOURS the filters it is handed, so a filter the
        // service forgets to send shows up as a row that should not be there.
        (modelMock.findAll as Mock).mockImplementation(async (where: Record<string, unknown>) => {
            const items = ALL.filter((event) =>
                Object.entries(where).every(
                    ([key, value]) => (event as Record<string, unknown>)[key] === value
                )
            );
            return { items, total: items.length };
        });
        service = new EventService({
            model: modelMock,
            logger: { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger
        });
    });

    it.each([
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
    ])('returns only the published event to %s', async (_label, actor) => {
        const result = await service.getByAuthor(actor, { authorId, page: 1, pageSize: 10 });

        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');

        expect(data.items.map((event) => event.slug)).toEqual([PUBLISHED.slug]);
        // `total` drives the author page's indexability gate, so it has to
        // agree with `items` — a DRAFT counted here would tell Google a URL
        // exists that the page then renders as noindex.
        expect(data.total).toBe(1);
    });

    it('excludes the fixtures by NAME, so a passing test names what was dropped', async () => {
        // Non-vacuity for the case above: proves the fake model can return
        // these rows at all, and that each exclusion reason is exercised.
        const result = await service.getByAuthor(createActor(), {
            authorId,
            page: 1,
            pageSize: 10
        });
        const slugs = (result.data?.items ?? []).map((event) => event.slug);

        expect(slugs).not.toContain(DRAFT.slug);
        expect(slugs).not.toContain(ARCHIVED.slug);
        expect(slugs).not.toContain(PRIVATE.slug);
        expect(slugs).toContain(PUBLISHED.slug);
    });
});
