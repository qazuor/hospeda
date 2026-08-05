import { EventModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { PUBLIC_READ_FLOOR } from '../../../src/services/moderation/public-read-floor';
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

/**
 * Tests for EventService.getByAuthor
 * Covers: éxito (con y sin permiso especial), forbidden, validación, edge, error interno.
 */
describe('EventService.getByAuthor', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const authorId = createUser().id;
    const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createActor();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should apply the public read floor even when the actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        // HOS-374 §7.6.5: EVENT_SOFT_DELETE_VIEW no longer widens this public read
        // path — the floor is unconditional, so only public events are mocked back.
        const events = [
            createMockEvent({ authorId, visibility: VisibilityEnum.PUBLIC }),
            createMockEvent({ authorId, visibility: VisibilityEnum.PUBLIC })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 2 });
        // Act
        const result = await service.getByAuthor(actorWithPerm, {
            authorId,
            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { authorId, ...PUBLIC_READ_FLOOR },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('should apply the public read floor for an actor without elevated permissions', async () => {
        // Arrange
        const events = [createMockEvent({ authorId, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getByAuthor(actorNoPerm, { authorId, page: 1, pageSize: 10 });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { authorId, ...PUBLIC_READ_FLOOR },
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

/**
 * HOS-375 outcome test: `getByAuthor` is the ONLY source of events for the
 * public author page (`/autores/<slug>/`), which is indexable and sitemapped.
 *
 * The block above asserts the FILTER the model is HANDED. This one runs a fake
 * model that HONOURS that filter, so an exclusion the service forgets to
 * request shows up as a row that should not be there — the difference between
 * "we passed the right argument" and "the wrong rows cannot come back".
 *
 * It also pins `total`, which drives the page's indexability gate (§6.5): a
 * `total` that counts rows `items` never shows would tell Google a URL exists
 * that the page then renders as `noindex`.
 */
describe('EventService.getByAuthor — unpublished events never reach the author page', () => {
    let service: EventService;
    let modelMock: EventModel;
    const authorId = createUser().id;

    /** The author's real mix: one publishable event and four that are not. */
    const PUBLISHED = createMockEvent({
        authorId,
        slug: 'fiesta-de-la-playa',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED
    });
    const DRAFT = createMockEvent({
        authorId,
        slug: 'borrador-sin-publicar',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.DRAFT,
        moderationState: ModerationStatusEnum.APPROVED
    });
    const ARCHIVED = createMockEvent({
        authorId,
        slug: 'evento-archivado',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        moderationState: ModerationStatusEnum.APPROVED
    });
    const PRIVATE = createMockEvent({
        authorId,
        slug: 'evento-privado',
        visibility: VisibilityEnum.PRIVATE,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED
    });
    /** The third floor column (HOS-374): approved by the platform, or invisible. */
    const UNMODERATED = createMockEvent({
        authorId,
        slug: 'evento-sin-moderar',
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.PENDING
    });

    const ALL = [PUBLISHED, DRAFT, ARCHIVED, PRIVATE, UNMODERATED];

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
        expect(slugs).not.toContain(UNMODERATED.slug);
        expect(slugs).toContain(PUBLISHED.slug);
    });
});
