/**
 * Schemas of the host AI questions panel (HOS-2101).
 *
 * The response item is `.strict()` so the anonymity of the panel is a schema
 * property: a field identifying the tourist cannot ride along unnoticed.
 */

import { describe, expect, it } from 'vitest';
import {
    AiListingQuestionSchema,
    AiListingQuestionsQuerySchema,
    UserSettingsWebPatchSchema
} from '../../../src/index.js';

const ID = '11111111-2222-4333-8444-555555555555';

describe('AiListingQuestionsQuerySchema', () => {
    it('accepts the three chat verticals with a uuid', () => {
        for (const entityType of ['accommodation', 'venue', 'experience'] as const) {
            expect(
                AiListingQuestionsQuerySchema.safeParse({ entityType, entityId: ID }).success
            ).toBe(true);
        }
    });

    it('rejects a non-uuid id and an unknown vertical', () => {
        expect(
            AiListingQuestionsQuerySchema.safeParse({ entityType: 'venue', entityId: 'abc' })
                .success
        ).toBe(false);
        expect(
            AiListingQuestionsQuerySchema.safeParse({ entityType: 'partner', entityId: ID }).success
        ).toBe(false);
    });
});

describe('AiListingQuestionSchema', () => {
    const item = {
        id: ID,
        question: '¿Aceptan mascotas?',
        answer: 'Ese dato no está en la ficha.',
        askedAt: '2026-11-09T12:00:00.000Z',
        answerStatus: 'unanswered'
    };

    it('accepts an anonymous item', () => {
        expect(AiListingQuestionSchema.safeParse(item).success).toBe(true);
    });

    it.each([
        'userId',
        'userName',
        'email',
        'conversationId'
    ])('rejects an item carrying %s', (key) => {
        expect(AiListingQuestionSchema.safeParse({ ...item, [key]: 'x' }).success).toBe(false);
    });
});

describe('UserSettingsWebPatchSchema — aiQuestionsDigest', () => {
    it('accepts the digest opt-out through the strict web patch', () => {
        expect(UserSettingsWebPatchSchema.safeParse({ aiQuestionsDigest: false }).success).toBe(
            true
        );
    });
});
