/**
 * Rule test for DEC-FAC-053 / AC:6:8 (HOS-1864).
 *
 * The product decision is legal, not stylistic: a venue chat may never tell a
 * visitor that someone below the ficha's minimum age can get in, must never
 * coach anyone around that age, must repeat the age and the legal notice
 * verbatim, and must defer to the venue. The clause belongs to
 * `DEFAULT_RULES.chat_venue` alone — the prompt may name "the minimum age" as
 * a topic but carries no prohibition, or the composed text would carry the
 * clause twice (the invariant `default-rules-equivalence.test.ts` enforces).
 *
 * These assertions anchor on the clause sentences themselves, not on the whole
 * block, so a legitimate rewording of an unrelated guardrail does not break
 * them while deleting or moving the age clause does.
 *
 * @module test/chat-venue-age-rules
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../src/engine/default-prompts.js';

/** One sentence per DEC-FAC-053 obligation, as it appears in the rules. */
const AGE_CLAUSES = [
    // HOS-2095 review A1: the sentence continues with the explicit-text exception.
    'You MUST NOT state or imply that anyone below the minimum age in your context may enter this venue',
    'You MUST NOT suggest any way to get around that minimum age',
    'repeat both verbatim',
    'tell the visitor to confirm it with the venue',
    'If your context does not state a minimum age, you MUST NOT infer that minors may enter',
    'You MUST NOT state that alcoholic beverages are sold or served to anyone under 18.'
] as const;

describe('DEFAULT_RULES.chat_venue — hard age and alcohol rules (DEC-FAC-053)', () => {
    it.each(AGE_CLAUSES)('contains the clause: %s', (clause) => {
        expect(DEFAULT_RULES.chat_venue).toContain(clause);
    });

    it('states the legal notice must be repeated verbatim, without paraphrasing', () => {
        expect(DEFAULT_RULES.chat_venue).toContain(
            'the legal notice exactly as your context states them'
        );
        expect(DEFAULT_RULES.chat_venue).toContain('without paraphrasing or softening them');
    });
});

describe('DEFAULT_PROMPTS.chat_venue — neutral, with no duplicated prohibition', () => {
    it('does not carry any of the age clauses', () => {
        for (const clause of AGE_CLAUSES) {
            expect(DEFAULT_PROMPTS.chat_venue).not.toContain(clause);
        }
    });

    it('carries no "MUST NOT" sentence at all', () => {
        expect(DEFAULT_PROMPTS.chat_venue).not.toContain('MUST NOT');
    });

    it('is no longer a dining assistant in a restaurant detail page', () => {
        expect(DEFAULT_PROMPTS.chat_venue).not.toContain('dining assistant');
        expect(DEFAULT_PROMPTS.chat_venue).not.toContain('restaurant detail page');
    });

    it('names the kind of place and the topics the context actually carries', () => {
        expect(DEFAULT_PROMPTS.chat_venue).toContain('a place to eat or to go out');
        expect(DEFAULT_PROMPTS.chat_venue).toContain('the minimum age');
        expect(DEFAULT_PROMPTS.chat_venue).toContain('the dress code');
    });
});

describe('the age clause is venue-only', () => {
    it('is absent from DEFAULT_RULES.chat', () => {
        expect(DEFAULT_RULES.chat).not.toContain('below the minimum age');
        expect(DEFAULT_RULES.chat).not.toContain('under 18');
    });

    it('is absent from DEFAULT_RULES.chat_experience', () => {
        expect(DEFAULT_RULES.chat_experience).not.toContain('below the minimum age');
        expect(DEFAULT_RULES.chat_experience).not.toContain('under 18');
    });
});
