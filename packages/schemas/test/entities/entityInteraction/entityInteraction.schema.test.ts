import { describe, expect, it } from 'vitest';
import {
    EntityInteractionCaptureBodySchema,
    EntityInteractionKindEnum,
    EntityInteractionKindEnumSchema
} from '../../../src/index.js';

const ID = '550e8400-e29b-41d4-a716-446655440000';
const EVENT = '660e8400-e29b-41d4-a716-446655440000';
const base = { entityType: 'VENUE', entityId: ID };

describe('EntityInteractionCaptureBodySchema', () => {
    it.each([
        'PHONE_CLICK',
        'MAP_CLICK',
        'WEBSITE_CLICK',
        'INSTAGRAM_CLICK',
        'WHATSAPP_CLICK'
    ])('accepts %s without an eventId', (kind) => {
        expect(EntityInteractionCaptureBodySchema.safeParse({ ...base, kind }).success).toBe(true);
    });

    it.each(['TICKET_CLICK', 'EVENT_IMPRESSION'])('accepts %s with an eventId', (kind) => {
        expect(
            EntityInteractionCaptureBodySchema.safeParse({ ...base, kind, eventId: EVENT }).success
        ).toBe(true);
    });

    it.each([
        'TICKET_CLICK',
        'EVENT_IMPRESSION'
    ])('rejects %s without an eventId (AC-5)', (kind) => {
        const r = EntityInteractionCaptureBodySchema.safeParse({ ...base, kind });
        expect(r.success).toBe(false);
        expect(r.error?.issues[0]?.message).toBe('zodError.entityInteraction.eventId.required');
    });

    it('rejects PHONE_CLICK carrying an eventId (AC-5)', () => {
        const r = EntityInteractionCaptureBodySchema.safeParse({
            ...base,
            kind: 'PHONE_CLICK',
            eventId: EVENT
        });
        expect(r.success).toBe(false);
        expect(r.error?.issues[0]?.message).toBe('zodError.entityInteraction.eventId.forbidden');
    });

    it('rejects entity types other than VENUE', () => {
        const r = EntityInteractionCaptureBodySchema.safeParse({
            entityType: 'ACCOMMODATION',
            entityId: ID,
            kind: 'PHONE_CLICK'
        });
        expect(r.success).toBe(false);
    });

    it('rejects a non-uuid entityId and a non-uuid eventId', () => {
        expect(
            EntityInteractionCaptureBodySchema.safeParse({
                ...base,
                entityId: 'x',
                kind: 'MAP_CLICK'
            }).success
        ).toBe(false);
        expect(
            EntityInteractionCaptureBodySchema.safeParse({
                ...base,
                kind: 'TICKET_CLICK',
                eventId: 'x'
            }).success
        ).toBe(false);
    });
});

describe('EntityInteractionKindEnumSchema', () => {
    it('covers every enum value and rejects others', () => {
        for (const value of Object.values(EntityInteractionKindEnum)) {
            expect(EntityInteractionKindEnumSchema.safeParse(value).success).toBe(true);
        }
        expect(EntityInteractionKindEnumSchema.safeParse('phone_click').success).toBe(false);
    });
});
