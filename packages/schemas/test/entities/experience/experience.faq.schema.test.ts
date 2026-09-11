import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ExperienceFaqAddInputSchema,
    ExperienceFaqListInputSchema,
    ExperienceFaqRemoveInputSchema,
    ExperienceFaqReorderInputSchema,
    ExperienceFaqSchema,
    ExperienceFaqUpdateInputSchema
} from '../../../src/entities/experience/subtypes/experience.faq.schema.js';

const experienceId = faker.string.uuid();
const faqId = faker.string.uuid();

const validFaqPayload = () => ({
    question: 'What are the opening hours for this experience?',
    answer: 'The excursion departs every day from 9am to 10am.',
    category: 'Hours',
    displayOrder: 1,
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: faker.string.uuid(),
    updatedById: null
});

describe('ExperienceFaqSchema', () => {
    it('should validate a valid FAQ with experienceId', () => {
        const data = {
            ...validFaqPayload(),
            id: faqId,
            experienceId
        };
        expect(() => ExperienceFaqSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid experienceId', () => {
        const data = { ...validFaqPayload(), id: faqId, experienceId: 'not-a-uuid' };
        expect(() => ExperienceFaqSchema.parse(data)).toThrow(ZodError);
    });

    it('should default isVisibleOnListing and isUsableByAi to true when absent (HOS-400)', () => {
        const data = { ...validFaqPayload(), id: faqId, experienceId };
        const parsed = ExperienceFaqSchema.parse(data);
        expect(parsed.isVisibleOnListing).toBe(true);
        expect(parsed.isUsableByAi).toBe(true);
    });
});

describe('ExperienceFaqAddInputSchema', () => {
    it('should validate a valid add input', () => {
        const data = {
            experienceId,
            faq: {
                question: 'Do you provide equipment for the activity?',
                answer: 'Yes, all safety equipment is included in the price.'
            }
        };
        expect(() => ExperienceFaqAddInputSchema.parse(data)).not.toThrow();
    });

    it('should default isVisibleOnListing and isUsableByAi to true (HOS-400)', () => {
        // Same fragment HOS-393 gave accommodation_faqs: a client that omits
        // the flags gets exactly the behaviour FAQs had before they existed.
        const data = {
            experienceId,
            faq: {
                question: 'Do you provide equipment for the activity?',
                answer: 'Yes, all safety equipment is included in the price.'
            }
        };
        const parsed = ExperienceFaqAddInputSchema.parse(data);
        expect(parsed.faq.isVisibleOnListing).toBe(true);
        expect(parsed.faq.isUsableByAi).toBe(true);
    });

    it('should preserve an explicit false for both flags (HOS-400)', () => {
        const data = {
            experienceId,
            faq: {
                question: 'Do you provide equipment for the activity?',
                answer: 'Yes, all safety equipment is included in the price.',
                isVisibleOnListing: false,
                isUsableByAi: false
            }
        };
        const parsed = ExperienceFaqAddInputSchema.parse(data);
        expect(parsed.faq.isVisibleOnListing).toBe(false);
        expect(parsed.faq.isUsableByAi).toBe(false);
    });

    it('should reject missing experienceId', () => {
        const data = {
            faq: {
                question: 'Do you provide equipment?',
                answer: 'Yes, all equipment included.'
            }
        };
        expect(() => ExperienceFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid experienceId', () => {
        const data = {
            experienceId: 'not-a-uuid',
            faq: {
                question: 'Do you provide equipment?',
                answer: 'Yes, all equipment included.'
            }
        };
        expect(() => ExperienceFaqAddInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('ExperienceFaqUpdateInputSchema', () => {
    it('should validate a valid update input', () => {
        const data = {
            experienceId,
            faqId,
            faq: { question: 'Updated question about departure times?' }
        };
        expect(() => ExperienceFaqUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing faqId', () => {
        const data = { experienceId, faq: { question: 'Q?' } };
        expect(() => ExperienceFaqUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should leave both flags absent on a partial edit that omits them (HOS-400)', () => {
        // A `.default()` here would fire on every partial edit and silently
        // reset a hidden FAQ back to public — the exact trap the HOS-393
        // JSDoc documents for FaqWithChannelVisibilityUpdatePayloadSchema.
        const data = {
            experienceId,
            faqId,
            faq: { question: 'Updated question about departure times?' }
        };
        const parsed = ExperienceFaqUpdateInputSchema.parse(data);
        expect(Object.hasOwn(parsed.faq, 'isVisibleOnListing')).toBe(false);
        expect(Object.hasOwn(parsed.faq, 'isUsableByAi')).toBe(false);
    });
});

describe('ExperienceFaqRemoveInputSchema', () => {
    it('should validate a valid remove input', () => {
        const data = { experienceId, faqId };
        expect(() => ExperienceFaqRemoveInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid faqId', () => {
        expect(() => ExperienceFaqRemoveInputSchema.parse({ experienceId, faqId: 'bad' })).toThrow(
            ZodError
        );
    });
});

describe('ExperienceFaqListInputSchema', () => {
    it('should validate a valid list input', () => {
        expect(() => ExperienceFaqListInputSchema.parse({ experienceId })).not.toThrow();
    });

    it('should reject missing experienceId', () => {
        expect(() => ExperienceFaqListInputSchema.parse({})).toThrow(ZodError);
    });
});

describe('ExperienceFaqReorderInputSchema', () => {
    it('should validate a valid reorder input with {faqId, displayOrder} items', () => {
        const data = {
            experienceId,
            order: [
                { faqId, displayOrder: 0 },
                { faqId: faker.string.uuid(), displayOrder: 1 }
            ]
        };
        expect(() => ExperienceFaqReorderInputSchema.parse(data)).not.toThrow();
    });

    it('should reject empty order array', () => {
        expect(() => ExperienceFaqReorderInputSchema.parse({ experienceId, order: [] })).toThrow(
            ZodError
        );
    });

    it('should reject when order item has invalid faqId', () => {
        const data = {
            experienceId,
            order: [{ faqId: 'not-a-uuid', displayOrder: 0 }]
        };
        expect(() => ExperienceFaqReorderInputSchema.parse(data)).toThrow(ZodError);
    });
});
