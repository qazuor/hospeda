import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    DestinationFaqAddInputSchema,
    DestinationFaqListInputSchema,
    DestinationFaqSchema
} from '../../../src/entities/destination/subtypes/destination.faq.schema.js';
import { createValidBaseFaq } from '../../fixtures/destination.fixtures.js';

/**
 * Tests for the SPEC-158 destination FAQ schema (mirrors the accommodation FAQ
 * schema). Covers the full entity schema, the add-input payload, and the
 * BaseFaqSchema field boundaries (question/answer min/max).
 */

const createValidDestinationFaq = () => ({
    ...createValidBaseFaq(),
    id: faker.string.uuid(),
    destinationId: faker.string.uuid()
});

describe('DestinationFaqSchema', () => {
    describe('Valid data', () => {
        it('validates a complete destination FAQ', () => {
            const result = DestinationFaqSchema.safeParse(createValidDestinationFaq());
            expect(result.success).toBe(true);
        });

        it('accepts a null category', () => {
            const result = DestinationFaqSchema.safeParse({
                ...createValidDestinationFaq(),
                category: null
            });
            expect(result.success).toBe(true);
        });

        it('accepts an answer at the 2000-char maximum', () => {
            const result = DestinationFaqSchema.safeParse({
                ...createValidDestinationFaq(),
                answer: 'a'.repeat(2000)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('rejects a question shorter than 10 chars', () => {
            const result = DestinationFaqSchema.safeParse({
                ...createValidDestinationFaq(),
                question: 'short'
            });
            expect(result.success).toBe(false);
        });

        it('rejects an answer longer than 2000 chars', () => {
            const result = DestinationFaqSchema.safeParse({
                ...createValidDestinationFaq(),
                answer: 'a'.repeat(2001)
            });
            expect(result.success).toBe(false);
        });

        it('rejects a missing destinationId', () => {
            const { destinationId: _omit, ...withoutDestinationId } = createValidDestinationFaq();
            const result = DestinationFaqSchema.safeParse(withoutDestinationId);
            expect(result.success).toBe(false);
        });
    });
});

describe('DestinationFaqAddInputSchema', () => {
    it('validates a well-formed add payload', () => {
        const result = DestinationFaqAddInputSchema.safeParse({
            destinationId: faker.string.uuid(),
            faq: {
                question: '¿Cómo llego a la ciudad desde Buenos Aires?',
                answer: 'En auto por la Ruta Nacional 14, o en micro de larga distancia.',
                category: 'Cómo llegar'
            }
        });
        expect(result.success).toBe(true);
    });

    it('rejects an add payload with a too-short answer', () => {
        const result = DestinationFaqAddInputSchema.safeParse({
            destinationId: faker.string.uuid(),
            faq: { question: '¿Cuándo conviene visitar?', answer: 'short' }
        });
        expect(result.success).toBe(false);
    });
});

describe('DestinationFaqListInputSchema', () => {
    it('requires a destinationId', () => {
        expect(DestinationFaqListInputSchema.safeParse({}).success).toBe(false);
        expect(
            DestinationFaqListInputSchema.safeParse({ destinationId: faker.string.uuid() }).success
        ).toBe(true);
    });
});
