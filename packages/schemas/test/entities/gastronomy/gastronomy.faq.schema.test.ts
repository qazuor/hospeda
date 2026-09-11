import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyFaqAddInputSchema,
    GastronomyFaqListInputSchema,
    GastronomyFaqRemoveInputSchema,
    GastronomyFaqReorderInputSchema,
    GastronomyFaqSchema,
    GastronomyFaqUpdateInputSchema
} from '../../../src/entities/gastronomy/subtypes/gastronomy.faq.schema.js';

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
        expect(() => GastronomyFaqSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid gastronomyId', () => {
        const data = { ...validFaqPayload(), id: faqId, gastronomyId: 'not-a-uuid' };
        expect(() => GastronomyFaqSchema.parse(data)).toThrow(ZodError);
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
        expect(() => GastronomyFaqAddInputSchema.parse(data)).not.toThrow();
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
        const parsed = GastronomyFaqAddInputSchema.parse(data);
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
        const parsed = GastronomyFaqAddInputSchema.parse(data);
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
        expect(() => GastronomyFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid gastronomyId', () => {
        const data = {
            gastronomyId: 'not-a-uuid',
            faq: {
                question: 'Do you have parking?',
                answer: 'Yes, free parking available.'
            }
        };
        expect(() => GastronomyFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyFaqUpdateInputSchema', () => {
    it('should validate a valid update input', () => {
        const data = {
            gastronomyId,
            faqId,
            faq: { question: 'Updated question about hours?' }
        };
        expect(() => GastronomyFaqUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing faqId', () => {
        const data = { gastronomyId, faq: { question: 'Q?' } };
        expect(() => GastronomyFaqUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should leave both flags absent on a partial edit that omits them (HOS-400)', () => {
        // A `.default()` here would fire on every partial edit and silently
        // reset a hidden FAQ back to public — the exact trap the HOS-393
        // JSDoc documents for FaqWithChannelVisibilityUpdatePayloadSchema.
        const data = { gastronomyId, faqId, faq: { question: 'Updated question about hours?' } };
        const parsed = GastronomyFaqUpdateInputSchema.parse(data);
        expect(Object.hasOwn(parsed.faq, 'isVisibleOnListing')).toBe(false);
        expect(Object.hasOwn(parsed.faq, 'isUsableByAi')).toBe(false);
    });
});

describe('GastronomyFaqRemoveInputSchema', () => {
    it('should validate a valid remove input', () => {
        const data = { gastronomyId, faqId };
        expect(() => GastronomyFaqRemoveInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid faqId', () => {
        expect(() => GastronomyFaqRemoveInputSchema.parse({ gastronomyId, faqId: 'bad' })).toThrow(
            ZodError
        );
    });
});

describe('GastronomyFaqListInputSchema', () => {
    it('should validate a valid list input', () => {
        expect(() => GastronomyFaqListInputSchema.parse({ gastronomyId })).not.toThrow();
    });

    it('should reject missing gastronomyId', () => {
        expect(() => GastronomyFaqListInputSchema.parse({})).toThrow(ZodError);
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
        expect(() => GastronomyFaqReorderInputSchema.parse(data)).not.toThrow();
    });

    it('should reject empty order array', () => {
        expect(() => GastronomyFaqReorderInputSchema.parse({ gastronomyId, order: [] })).toThrow(
            ZodError
        );
    });

    it('should reject when order item has invalid faqId', () => {
        const data = {
            gastronomyId,
            order: [{ faqId: 'not-a-uuid', displayOrder: 0 }]
        };
        expect(() => GastronomyFaqReorderInputSchema.parse(data)).toThrow(ZodError);
    });
});
