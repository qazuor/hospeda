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

const gastronomyId = faker.string.uuid();
const faqId = faker.string.uuid();

const validFaqPayload = () => ({
    question: 'What are the opening hours for this gastronomy?',
    answer: 'We are open from Monday to Saturday, 9am to 10pm.',
    category: 'Hours',
    displayOrder: 1,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: faker.string.uuid(),
    updatedById: null
});

describe('GastronomyFaqSchema', () => {
    it('should validate a valid FAQ with gastronomyId', () => {
        const data = {
            ...validFaqPayload(),
            id: faqId,
            gastronomyId
        };
        expect(() => VenueFaqSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid gastronomyId', () => {
        const data = { ...validFaqPayload(), id: faqId, gastronomyId: 'not-a-uuid' };
        expect(() => VenueFaqSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyFaqAddInputSchema', () => {
    it('should validate a valid add input', () => {
        const data = {
            gastronomyId,
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
            gastronomyId,
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
            gastronomyId,
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

    it('should reject missing gastronomyId', () => {
        const data = {
            faq: {
                question: 'Do you have parking?',
                answer: 'Yes, free parking available.'
            }
        };
        expect(() => VenueFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid gastronomyId', () => {
        const data = {
            gastronomyId: 'not-a-uuid',
            faq: {
                question: 'Do you have parking?',
                answer: 'Yes, free parking available.'
            }
        };
        expect(() => VenueFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyFaqUpdateInputSchema', () => {
    it('should validate a valid update input', () => {
        const data = {
            gastronomyId,
            faqId,
            faq: { question: 'Updated question about hours?' }
        };
        expect(() => VenueFaqUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing faqId', () => {
        const data = { gastronomyId, faq: { question: 'Q?' } };
        expect(() => VenueFaqUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should leave both flags absent on a partial edit that omits them (HOS-400)', () => {
        // A `.default()` here would fire on every partial edit and silently
        // reset a hidden FAQ back to public — the exact trap the HOS-393
        // JSDoc documents for FaqWithChannelVisibilityUpdatePayloadSchema.
        const data = { gastronomyId, faqId, faq: { question: 'Updated question about hours?' } };
        const parsed = VenueFaqUpdateInputSchema.parse(data);
        expect(Object.hasOwn(parsed.faq, 'isVisibleOnListing')).toBe(false);
        expect(Object.hasOwn(parsed.faq, 'isUsableByAi')).toBe(false);
    });
});

describe('GastronomyFaqRemoveInputSchema', () => {
    it('should validate a valid remove input', () => {
        const data = { gastronomyId, faqId };
        expect(() => VenueFaqRemoveInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid faqId', () => {
        expect(() => VenueFaqRemoveInputSchema.parse({ gastronomyId, faqId: 'bad' })).toThrow(
            ZodError
        );
    });
});

describe('GastronomyFaqListInputSchema', () => {
    it('should validate a valid list input', () => {
        expect(() => VenueFaqListInputSchema.parse({ gastronomyId })).not.toThrow();
    });

    it('should reject missing gastronomyId', () => {
        expect(() => VenueFaqListInputSchema.parse({})).toThrow(ZodError);
    });
});

describe('GastronomyFaqReorderInputSchema', () => {
    it('should validate a valid reorder input with {faqId, displayOrder} items', () => {
        const data = {
            gastronomyId,
            order: [
                { faqId, displayOrder: 0 },
                { faqId: faker.string.uuid(), displayOrder: 1 }
            ]
        };
        expect(() => VenueFaqReorderInputSchema.parse(data)).not.toThrow();
    });

    it('should reject empty order array', () => {
        expect(() => VenueFaqReorderInputSchema.parse({ gastronomyId, order: [] })).toThrow(
            ZodError
        );
    });

    it('should reject when order item has invalid faqId', () => {
        const data = {
            gastronomyId,
            order: [{ faqId: 'not-a-uuid', displayOrder: 0 }]
        };
        expect(() => VenueFaqReorderInputSchema.parse(data)).toThrow(ZodError);
    });
});
