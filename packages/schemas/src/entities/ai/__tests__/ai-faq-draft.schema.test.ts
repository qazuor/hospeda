import { describe, expect, it } from 'vitest';
import { AiFaqDraftOutputSchema, AiFaqDraftResponseSchema } from '../ai-faq-draft.schema.js';

describe('AI FAQ draft schemas', () => {
    it('accepts the strict structured model output', () => {
        expect(AiFaqDraftOutputSchema.parse({ hasData: true, draft: 'There is Wi-Fi.' })).toEqual({
            hasData: true,
            draft: 'There is Wi-Fi.'
        });
    });

    it('enforces null draft exactly when hasData is false', () => {
        const messageId = '11111111-1111-4111-8111-111111111111';
        expect(
            AiFaqDraftResponseSchema.safeParse({ messageId, hasData: false, draft: null }).success
        ).toBe(true);
        expect(
            AiFaqDraftResponseSchema.safeParse({ messageId, hasData: true, draft: null }).success
        ).toBe(false);
        expect(
            AiFaqDraftResponseSchema.safeParse({ messageId, hasData: false, draft: 'answer' })
                .success
        ).toBe(false);
    });

    it('rejects unknown model and HTTP response fields', () => {
        expect(
            AiFaqDraftOutputSchema.safeParse({ hasData: true, draft: 'answer', extra: true })
                .success
        ).toBe(false);
        expect(
            AiFaqDraftResponseSchema.safeParse({
                messageId: '11111111-1111-4111-8111-111111111111',
                hasData: true,
                draft: 'answer',
                extra: true
            }).success
        ).toBe(false);
    });
});
