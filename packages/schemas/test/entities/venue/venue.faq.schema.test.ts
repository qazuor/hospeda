import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    VenueFaqAddInputSchema,
    VenueFaqListInputSchema,
    VenueFaqRemoveInputSchema,
    VenueFaqReorderInputSchema,
    VenueFaqSchema,
    VenueFaqUpdateInputSchema
} from '../../../src/entities/venue/subtypes/venue.faq.schema.js';

const venueId = faker.string.uuid();
const faqId = faker.string.uuid();

const validFaqPayload = () => ({
    question: 'What are the opening hours for this venue?',
    answer: 'We are open from Monday to Saturday, 9am to 10pm.',
    category: 'Hours',
    displayOrder: 1,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: faker.string.uuid(),
    updatedById: null
});

describe('VenueFaqSchema', () => {
    it('should validate a valid FAQ with venueId', () => {
        const data = {
            ...validFaqPayload(),
            id: faqId,
            venueId
        };
        expect(() => VenueFaqSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid venueId', () => {
        const data = { ...validFaqPayload(), id: faqId, venueId: 'not-a-uuid' };
        expect(() => VenueFaqSchema.parse(data)).toThrow(ZodError);
    });
});

describe('VenueFaqAddInputSchema', () => {
    it('should validate a valid add input', () => {
        const data = {
            venueId,
            faq: {
                question: 'Do you have parking available nearby?',
                answer: 'Yes, free parking is available on the street.'
            }
        };
        expect(() => VenueFaqAddInputSchema.parse(data)).not.toThrow();
    });

    it('should default isVisibleOnListing and isUsableByAi to true (HOS-400)', () => {
        // Same fragment HOS-393 gave accommodation_faqs: a client that omits
        // the flags gets exactly the behaviour FAQs had before they existed.
        const data = {
            venueId,
            faq: {
                question: 'Do you have parking available nearby?',
                answer: 'Yes, free parking is available on the street.'
            }
        };
        const parsed = VenueFaqAddInputSchema.parse(data);
        expect(parsed.faq.isVisibleOnListing).toBe(true);
        expect(parsed.faq.isUsableByAi).toBe(true);
    });

    it('should preserve an explicit false for both flags (HOS-400)', () => {
        const data = {
            venueId,
            faq: {
                question: 'Do you have parking available nearby?',
                answer: 'Yes, free parking is available on the street.',
                isVisibleOnListing: false,
                isUsableByAi: false
            }
        };
        const parsed = VenueFaqAddInputSchema.parse(data);
        expect(parsed.faq.isVisibleOnListing).toBe(false);
        expect(parsed.faq.isUsableByAi).toBe(false);
    });

    it('should reject missing venueId', () => {
        const data = {
            faq: {
                question: 'Do you have parking?',
                answer: 'Yes, free parking available.'
            }
        };
        expect(() => VenueFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid venueId', () => {
        const data = {
            venueId: 'not-a-uuid',
            faq: {
                question: 'Do you have parking?',
                answer: 'Yes, free parking available.'
            }
        };
        expect(() => VenueFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('VenueFaqUpdateInputSchema', () => {
    it('should validate a valid update input', () => {
        const data = {
            venueId,
            faqId,
            faq: { question: 'Updated question about hours?' }
        };
        expect(() => VenueFaqUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing faqId', () => {
        const data = { venueId, faq: { question: 'Q?' } };
        expect(() => VenueFaqUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should leave both flags absent on a partial edit that omits them (HOS-400)', () => {
        // A `.default()` here would fire on every partial edit and silently
        // reset a hidden FAQ back to public — the exact trap the HOS-393
        // JSDoc documents for FaqWithChannelVisibilityUpdatePayloadSchema.
        const data = { venueId, faqId, faq: { question: 'Updated question about hours?' } };
        const parsed = VenueFaqUpdateInputSchema.parse(data);
        expect(Object.hasOwn(parsed.faq, 'isVisibleOnListing')).toBe(false);
        expect(Object.hasOwn(parsed.faq, 'isUsableByAi')).toBe(false);
    });
});

describe('VenueFaqRemoveInputSchema', () => {
    it('should validate a valid remove input', () => {
        const data = { venueId, faqId };
        expect(() => VenueFaqRemoveInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid faqId', () => {
        expect(() => VenueFaqRemoveInputSchema.parse({ venueId, faqId: 'bad' })).toThrow(ZodError);
    });
});

describe('VenueFaqListInputSchema', () => {
    it('should validate a valid list input', () => {
        expect(() => VenueFaqListInputSchema.parse({ venueId })).not.toThrow();
    });

    it('should reject missing venueId', () => {
        expect(() => VenueFaqListInputSchema.parse({})).toThrow(ZodError);
    });
});

describe('VenueFaqReorderInputSchema', () => {
    it('should validate a valid reorder input with {faqId, displayOrder} items', () => {
        const data = {
            venueId,
            order: [
                { faqId, displayOrder: 0 },
                { faqId: faker.string.uuid(), displayOrder: 1 }
            ]
        };
        expect(() => VenueFaqReorderInputSchema.parse(data)).not.toThrow();
    });

    it('should reject empty order array', () => {
        expect(() => VenueFaqReorderInputSchema.parse({ venueId, order: [] })).toThrow(ZodError);
    });

    it('should reject when order item has invalid faqId', () => {
        const data = {
            venueId,
            order: [{ faqId: 'not-a-uuid', displayOrder: 0 }]
        };
        expect(() => VenueFaqReorderInputSchema.parse(data)).toThrow(ZodError);
    });
});
