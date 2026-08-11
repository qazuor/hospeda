/**
 * @fileoverview
 * Tests for the event HTTP schemas and their domain mappers, focused on
 * authorship (HOS-374 D-2).
 *
 * `authorId` used to be a required field on `EventCreateHttpSchema` that the
 * mapper passed straight through to the domain input, so any caller holding
 * `EVENT_CREATE` could attribute an event to an arbitrary user — and the update
 * mapper passed it through too, so authorship could be reassigned afterwards.
 *
 * Authorship is now resolved server-side from the authenticated actor. These
 * tests pin that down from both directions: the value must come from the actor,
 * and a body that still carries `authorId` must not be able to override it.
 *
 * @module test/entities/event/event.http.schema
 */
import { describe, expect, it } from 'vitest';
import {
    EventCreateHttpSchema,
    httpToDomainEventCreate,
    httpToDomainEventUpdate
} from '../../../src/entities/event/event.http.schema.js';
import { EventCategoryEnum } from '../../../src/enums/index.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZER_ID = '33333333-3333-4333-8333-333333333333';

/** A minimal valid create body, without `authorId`. */
const validCreateBody = {
    name: 'A perfectly reasonable event name',
    description: 'x'.repeat(80),
    category: EventCategoryEnum.OTHER,
    startDate: '2030-01-01T10:00:00.000Z',
    endDate: '2030-01-01T18:00:00.000Z',
    organizerId: ORGANIZER_ID,
    isFeatured: false,
    isVirtual: false,
    isPrivate: false,
    requiresRegistration: false
};

describe('EventCreateHttpSchema — authorship (HOS-374)', () => {
    it('does not require authorId', () => {
        const result = EventCreateHttpSchema.safeParse(validCreateBody);
        expect(result.success).toBe(true);
    });

    it('strips authorId when a client still sends it', () => {
        // The schema is a plain z.object, so unknown keys are stripped rather
        // than rejected — an existing client that keeps sending authorId keeps
        // working, it just no longer has any effect.
        const result = EventCreateHttpSchema.safeParse({
            ...validCreateBody,
            authorId: SOMEONE_ELSE_ID
        });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('authorId');
    });
});

describe('httpToDomainEventCreate — authorship (HOS-374)', () => {
    it('assigns authorship from the actor', () => {
        const parsed = EventCreateHttpSchema.parse(validCreateBody);

        const domain = httpToDomainEventCreate(parsed, ACTOR_ID);

        expect(domain.authorId).toBe(ACTOR_ID);
    });

    it('ignores an authorId present on the input object', () => {
        // Deliberately NOT parsed first. Parsing strips authorId, so a test that
        // parses only proves the schema strips — it says nothing about the
        // mapper. The route handler casts the body (`body as EventCreateHttp`)
        // rather than re-parsing, so the mapper must be safe on its own.
        const unsanitized = {
            ...validCreateBody,
            startDate: new Date(validCreateBody.startDate),
            endDate: new Date(validCreateBody.endDate),
            authorId: SOMEONE_ELSE_ID
        } as unknown as Parameters<typeof httpToDomainEventCreate>[0];

        const domain = httpToDomainEventCreate(unsanitized, ACTOR_ID);

        expect(domain.authorId).toBe(ACTOR_ID);
        expect(domain.authorId).not.toBe(SOMEONE_ELSE_ID);
    });
});

describe('httpToDomainEventUpdate — authorship (HOS-374)', () => {
    it('never emits authorId, so authorship cannot be reassigned', () => {
        // Authorship is assigned once, at creation. An update that carries an
        // authorId must not produce one in the domain payload — otherwise the
        // create-side fix is bypassable by creating then updating.
        const domain = httpToDomainEventUpdate({
            name: 'An edited event name that is long enough',
            authorId: SOMEONE_ELSE_ID
        } as Parameters<typeof httpToDomainEventUpdate>[0]);

        expect(domain.authorId).toBeUndefined();
    });
});
