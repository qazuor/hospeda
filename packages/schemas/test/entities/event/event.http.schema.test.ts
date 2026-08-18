/**
 * @fileoverview
 * Tests for the event HTTP schemas and their domain mappers.
 *
 * Two concerns share this file because they share a surface.
 *
 * ## Authorship (HOS-374 D-2)
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
 * ## Fields that were accepted and never stored (H-134)
 *
 * The HTTP surface used to declare seven fields no write path persisted:
 * `capacity`, `isVirtual`, `isPrivate`, `requiresRegistration` and
 * `registrationUrl` have no domain field at all, and `price`/`currency` live
 * nested under `pricing`, which the UPDATE mapper never built. A client sent
 * them, got `200`, and nothing landed. Silent discard WITH an acknowledgement
 * of success is worse than a field that plainly does not exist — the caller
 * believes the value was saved. Both schemas are `.strict()` now so every one
 * of those keys is a loud `400`.
 *
 * ## The date rename (H-30)
 *
 * The HTTP surface calls them `startDate`/`endDate`; the domain nests them as
 * `date.start`/`date.end`. Only the mapper knows that, which is why a route
 * that skips it produces `Unrecognized keys: "startDate","endDate"` against the
 * strict domain schema.
 *
 * @module test/entities/event/event.http.schema
 */
import { describe, expect, it } from 'vitest';
import {
    EventCreateHttpSchema,
    EventUpdateHttpSchema,
    httpToDomainEventCreate,
    httpToDomainEventUpdate
} from '../../../src/entities/event/event.http.schema.js';
import { EventCategoryEnum, PriceCurrencyEnum } from '../../../src/enums/index.js';

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
    isFeatured: false
};

describe('EventCreateHttpSchema — authorship (HOS-374)', () => {
    it('does not require authorId', () => {
        const result = EventCreateHttpSchema.safeParse(validCreateBody);
        expect(result.success).toBe(true);
    });

    it('rejects authorId when a client still sends it', () => {
        // The schema is `.strict()` (H-134), so an unknown key is a 400 rather
        // than a silent strip. For authorship that is strictly stronger than the
        // stripping this test used to assert: a client that believed it was
        // setting the author now finds out it was not, instead of getting a 200
        // and a silently different author.
        const result = EventCreateHttpSchema.safeParse({
            ...validCreateBody,
            authorId: SOMEONE_ELSE_ID
        });

        expect(result.success).toBe(false);
    });
});

describe('EventCreateHttpSchema — fields that never had a domain home (H-134)', () => {
    // These five have no landing place on ANY write path: they are absent from
    // `EventSchema` entirely, so neither mapper could persist them even if it
    // tried. Accepting them was the bug.
    it.each([
        ['capacity', 250],
        ['isVirtual', true],
        ['isPrivate', true],
        ['requiresRegistration', true],
        ['registrationUrl', 'https://example.com/signup']
    ])('rejects %s instead of accepting and dropping it', (field, value) => {
        const result = EventCreateHttpSchema.safeParse({
            ...validCreateBody,
            [field]: value
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown key outright', () => {
        const result = EventCreateHttpSchema.safeParse({
            ...validCreateBody,
            somethingNobodyDeclared: 'x'
        });

        expect(result.success).toBe(false);
    });

    it('still accepts price and currency, which the create path does persist', () => {
        const result = EventCreateHttpSchema.safeParse({
            ...validCreateBody,
            price: 1500,
            currency: PriceCurrencyEnum.ARS
        });

        expect(result.success).toBe(true);
    });
});

describe('httpToDomainEventCreate — pricing (H-134)', () => {
    it('nests price and currency under pricing, so create really stores them', () => {
        const parsed = EventCreateHttpSchema.parse({
            ...validCreateBody,
            price: 1500,
            currency: PriceCurrencyEnum.ARS
        });

        const domain = httpToDomainEventCreate(parsed, ACTOR_ID);

        // Asserted field by field rather than with `objectContaining`, which
        // cannot tell a missing key from a present one.
        expect(domain.pricing?.price).toBe(1500);
        expect(domain.pricing?.currency).toBe(PriceCurrencyEnum.ARS);
        expect(domain.pricing?.isFree).toBe(false);
        expect(Object.keys(domain)).not.toContain('price');
        expect(Object.keys(domain)).not.toContain('currency');
    });

    it('marks a zero price as free', () => {
        const parsed = EventCreateHttpSchema.parse({ ...validCreateBody, price: 0 });

        expect(httpToDomainEventCreate(parsed, ACTOR_ID).pricing?.isFree).toBe(true);
    });
});

describe('EventUpdateHttpSchema — fields no update path persists (H-134)', () => {
    // `price` and `currency` join the list HERE and not on create: they do have
    // a domain home (`pricing`), but merging a partial price into an existing
    // nested object needs the stored row, which neither the mapper nor the
    // service does today. Until that exists, accepting them would be the same
    // 200-with-nothing-saved bug. Tracked as a follow-up on HOS-444.
    it.each([
        ['capacity', 250],
        ['isVirtual', true],
        ['isPrivate', true],
        ['requiresRegistration', true],
        ['registrationUrl', 'https://example.com/signup'],
        ['price', 1500],
        ['currency', PriceCurrencyEnum.ARS]
    ])('rejects %s instead of answering 200 without storing it', (field, value) => {
        const result = EventUpdateHttpSchema.safeParse({ [field]: value });

        expect(result.success).toBe(false);
    });

    it('still accepts the fields the update path really writes', () => {
        const result = EventUpdateHttpSchema.safeParse({
            name: 'An edited event name that is long enough',
            description: 'y'.repeat(80),
            category: EventCategoryEnum.FESTIVAL,
            startDate: '2030-02-01T10:00:00.000Z',
            endDate: '2030-02-01T18:00:00.000Z'
        });

        expect(result.success).toBe(true);
    });
});

describe('httpToDomainEventUpdate — the date rename (H-30)', () => {
    it('nests startDate and endDate into the domain date object', () => {
        const domain = httpToDomainEventUpdate({
            startDate: new Date('2030-02-01T10:00:00.000Z'),
            endDate: new Date('2030-02-01T18:00:00.000Z')
        });

        expect(domain.date?.start).toEqual(new Date('2030-02-01T10:00:00.000Z'));
        expect(domain.date?.end).toEqual(new Date('2030-02-01T18:00:00.000Z'));
    });

    it('does not leak the HTTP key names, which the domain schema rejects', () => {
        // This is the shape H-30 was really about: `EventUpdateInputSchema` is
        // strict, so a body carrying `startDate` reaches it as an unrecognized
        // key and 400s. Checking the key list — not `objectContaining` — is what
        // makes this assertion able to fail.
        const domain = httpToDomainEventUpdate({
            startDate: new Date('2030-02-01T10:00:00.000Z'),
            endDate: new Date('2030-02-01T18:00:00.000Z')
        });

        expect(Object.keys(domain)).not.toContain('startDate');
        expect(Object.keys(domain)).not.toContain('endDate');
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
