import { EventModel } from '@repo/db';
import {
    EventCategoryEnum,
    EventDatePrecisionEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import * as helpers from '../../../src/services/event/event.helpers';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createEventUpdateInput, createMockEvent } from '../../factories/eventFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock, makeEventMediaModelStub } from '../../utils/modelMockFactory';

describe('EventService.update', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_UPDATE] });
    const actorNoPerm = createActor();
    const existingEvent = createMockEvent({ visibility: VisibilityEnum.PUBLIC });
    const eventId = existingEvent.id;
    // No visibility here: HOS-374 §7.6.4 took it out of the update payload, and the
    // event update schema is strict.
    const updateInput = createEventUpdateInput();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'update']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({
            model: modelMock,
            logger: loggerMock,
            eventMediaModel: makeEventMediaModelStub() as never
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should update an event successfully', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({
            ...existingEvent,
            id: eventId,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject({
            ...existingEvent,
            id: eventId,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        const result = await service.update(actorNoPerm, eventId, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Mock existing event
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        // Input inválido para forzar VALIDATION_ERROR
        const invalidInput = { category: 'INVALID_CATEGORY' as any };
        const result = await service.update(actorWithPerm, eventId, invalidInput);
        expectValidationError(result);
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectInternalError(result);
    });

    /**
     * The slug is generated ONCE, in `_beforeCreate`, and an update never
     * touches it (H-19). This matches what `post` and `destination` already do.
     *
     * ## What this replaces, and why it was green while production broke
     *
     * Four tests used to live here asserting the opposite — "updates slug if
     * category changes", "…if name changes", "…if date.start changes", plus one
     * pinning the `Missing required fields for slug generation` throw. They
     * passed the whole time, which is exactly why the bug read as intended
     * behaviour. Two things made them blind:
     *
     *  - They asserted `result.data?.slug`, which is whatever `modelMock.update`
     *    was TOLD to resolve with. That is the mock echoing the test back, not
     *    the service writing a slug. The tests below assert the payload the
     *    service actually hands to `model.update`.
     *  - The one named "does not update slug if none of the relevant fields
     *    change" sent `{ isFeatured: true }`. The hook keyed off a field being
     *    PRESENT, never changed, so "absent" was the only case it covered. The
     *    admin form posts every field on every save — the one case no test
     *    exercised, and the one that changed Novembeer's public URL twice.
     *
     * `generateEventSlug` is mocked to a sentinel instead of calling through, so
     * a regression trips two independent detectors: the spy records a call, and
     * the sentinel appears in the persisted payload.
     */
    describe('slug stability on update (H-19)', () => {
        const SENTINEL = 'regenerated-slug-that-must-never-be-persisted';

        /** The data object handed to `model.update` — the effect at the source. */
        const persistedPayload = (): Record<string, unknown> =>
            ((modelMock.update as Mock).mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;

        beforeEach(() => {
            vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
            vi.spyOn(helpers, 'generateEventSlug').mockResolvedValue(SENTINEL);
            (modelMock.findById as Mock).mockResolvedValue(existingEvent);
            (modelMock.update as Mock).mockResolvedValue({ ...existingEvent, id: eventId });
        });

        it('leaves the slug alone when the admin form resubmits the whole event', async () => {
            // The production repro: every field posted, none of them edited.
            const result = await service.update(actorWithPerm, eventId, createEventUpdateInput());

            expectSuccess(result);
            expect(helpers.generateEventSlug).not.toHaveBeenCalled();
            expect(Object.keys(persistedPayload())).not.toContain('slug');
        });

        it.each([
            [
                'the category changes',
                () => createEventUpdateInput({ category: EventCategoryEnum.FESTIVAL })
            ],
            ['the name changes', () => createEventUpdateInput({ name: 'A brand new event name' })],
            [
                'date.start changes',
                () =>
                    createEventUpdateInput({
                        date: {
                            start: new Date('2030-09-01'),
                            end: new Date('2030-09-01'),
                            isAllDay: false,
                            recurrence: undefined,
                            precision: EventDatePrecisionEnum.EXACT
                        }
                    })
            ]
        ])('does not rewrite the public URL when %s', async (_case, buildInput) => {
            const result = await service.update(actorWithPerm, eventId, buildInput());

            expectSuccess(result);
            expect(helpers.generateEventSlug).not.toHaveBeenCalled();
            expect(Object.keys(persistedPayload())).not.toContain('slug');
        });

        it('honours a slug the caller sends explicitly', async () => {
            // The payload carries a name too, which is what used to trigger
            // regeneration — and the hook closed with `{ ...normalized, slug }`,
            // so the generated value overwrote the caller's. That is what made
            // the admin's "URL amigable" field inert and left direct SQL as the
            // only way to repair a slug.
            const result = await service.update(actorWithPerm, eventId, {
                slug: 'a-hand-picked-slug',
                name: 'A brand new event name'
            });

            expectSuccess(result);
            expect(persistedPayload().slug).toBe('a-hand-picked-slug');
            expect(persistedPayload().slug).not.toBe(SENTINEL);
        });

        it('accepts a name-only update instead of failing to build a slug (H-30)', async () => {
            // A partial body reached a hook that demanded category, name AND
            // date.start together, so it threw and the web editor answered 500
            // on every rename. With no regeneration there is nothing to
            // assemble, so a diff-shaped payload is ordinary.
            const result = await service.update(actorWithPerm, eventId, {
                name: 'A brand new event name'
            });

            expectSuccess(result);
            expect(persistedPayload().name).toBe('A brand new event name');
        });
    });
});
