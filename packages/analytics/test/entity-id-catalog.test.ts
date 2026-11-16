import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';
import { prepareAnalyticsEvent } from '../src/shared.js';

const UUID = '3f2b1c9e-5a4d-4e8b-9c1a-0d7e6f5a4b3c';

const accommodationViewed = {
    accommodation_id: 'a1',
    accommodation_slug: 'casa-rio'
};
const contactStarted = {
    accommodation_id: 'a1',
    contact_method: 'whatsapp',
    is_authenticated: false
};
const contactCompleted = {
    ...contactStarted,
    conversation_flow: 'chat'
};
const contactFailed = { failure_reason: 'rate_limited' };

const additiveCases = [
    [AnalyticsEvents.accommodationViewed, accommodationViewed],
    [AnalyticsEvents.contactOwnerStarted, contactStarted],
    [AnalyticsEvents.contactOwnerCompleted, contactCompleted],
    [AnalyticsEvents.contactOwnerFailed, contactFailed]
] as const;

describe('entity_id / entity_type on view and contact events (HOS-2119 T-016)', () => {
    describe.each(additiveCases)('%s', (name, base) => {
        const schema = AnalyticsEventSchemas[name];

        it('should accept entity_id and entity_type', () => {
            const result = schema.safeParse({
                ...base,
                entity_id: UUID,
                entity_type: 'ACCOMMODATION'
            });
            expect(result.success).toBe(true);
        });

        it('should stay valid without entity fields (compatibility)', () => {
            expect(schema.safeParse(base).success).toBe(true);
        });

        it('should reject an unknown entity_type', () => {
            const result = schema.safeParse({ ...base, entity_id: UUID, entity_type: 'NOPE' });
            expect(result.success).toBe(false);
        });

        it('should still reject forbidden PII keys through prepareAnalyticsEvent', () => {
            // Not a fresh literal: the extra PII key must reach the runtime guard.
            const withPii = {
                ...base,
                entity_id: UUID,
                entity_type: 'ACCOMMODATION' as const,
                email: 'x@y.z'
            };
            expect(() => prepareAnalyticsEvent({ name, properties: withPii })).toThrow(
                /Forbidden analytics property key: email/
            );
        });

        it('should not throw through prepareAnalyticsEvent without a PII key (control)', () => {
            expect(() =>
                prepareAnalyticsEvent({
                    name,
                    properties: { ...base, entity_id: UUID, entity_type: 'ACCOMMODATION' }
                })
            ).not.toThrow();
        });
    });

    describe.each(additiveCases)('%s entity constraints', (name, base) => {
        const schema = AnalyticsEventSchemas[name];

        it('should reject a non-uuid entity_id (e.g. a slug)', () => {
            const result = schema.safeParse({
                ...base,
                entity_id: 'casa-rio',
                entity_type: 'ACCOMMODATION'
            });
            expect(result.success).toBe(false);
        });

        it('should reject entity_id without entity_type', () => {
            expect(schema.safeParse({ ...base, entity_id: UUID }).success).toBe(false);
        });

        it('should reject entity_type without entity_id', () => {
            expect(schema.safeParse({ ...base, entity_type: 'ACCOMMODATION' }).success).toBe(false);
        });

        it.each(['VENUE', 'POST'])('should reject entity_type %s', (entity_type) => {
            expect(schema.safeParse({ ...base, entity_id: UUID, entity_type }).success).toBe(false);
        });
    });

    it('should keep accommodation_id required on accommodation_viewed', () => {
        const result = AnalyticsEventSchemas.accommodation_viewed.safeParse({
            accommodation_slug: 'x',
            entity_id: UUID,
            entity_type: 'ACCOMMODATION'
        });
        expect(result.success).toBe(false);
    });
});

describe('entity_viewed event', () => {
    it('should be registered in the catalog with a short name', () => {
        expect(AnalyticsEvents.entityViewed).toBe('entity_viewed');
        expect(AnalyticsEvents.entityViewed.length).toBeLessThanOrEqual(50);
    });

    it.each(['VENUE', 'EXPERIENCE', 'PARTNER'])('should accept %s', (entity_type) => {
        const result = AnalyticsEventSchemas.entity_viewed.safeParse({
            entity_type,
            entity_id: UUID,
            locale: 'es'
        });
        expect(result.success).toBe(true);
    });

    it('should reject a non-uuid entity_id', () => {
        const result = AnalyticsEventSchemas.entity_viewed.safeParse({
            entity_type: 'VENUE',
            entity_id: 'a-slug'
        });
        expect(result.success).toBe(false);
    });

    it('should require entity_id', () => {
        const result = AnalyticsEventSchemas.entity_viewed.safeParse({
            entity_type: 'VENUE',
            locale: 'es'
        });
        expect(result.success).toBe(false);
    });

    it('should require entity_type', () => {
        expect(AnalyticsEventSchemas.entity_viewed.safeParse({ entity_id: UUID }).success).toBe(
            false
        );
    });

    it.each(['ACCOMMODATION', 'POST', 'EVENT'])('should reject %s', (entity_type) => {
        const result = AnalyticsEventSchemas.entity_viewed.safeParse({
            entity_type,
            entity_id: UUID
        });
        expect(result.success).toBe(false);
    });

    it('should reject forbidden PII keys', () => {
        const withPii = { entity_type: 'VENUE' as const, entity_id: UUID, phone: '1' };
        expect(() =>
            prepareAnalyticsEvent({ name: AnalyticsEvents.entityViewed, properties: withPii })
        ).toThrow(/Forbidden analytics property key: phone/);
    });

    it('should not throw through prepareAnalyticsEvent without a PII key (control)', () => {
        expect(() =>
            prepareAnalyticsEvent({
                name: AnalyticsEvents.entityViewed,
                properties: { entity_type: 'VENUE', entity_id: UUID }
            })
        ).not.toThrow();
    });
});
