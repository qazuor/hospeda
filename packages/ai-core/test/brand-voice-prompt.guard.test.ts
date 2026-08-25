/**
 * Static guard for the HOS-789 brand-voice invariants.
 *
 * ## Why this exists alongside `default-rules-equivalence.test.ts`
 *
 * That gate proves the SPEC-214 refactor never LOST a word: it compares the
 * composed prompt against a frozen baseline. It says nothing about whether a
 * given instruction is present — update both sides in lockstep (which is the
 * documented, legitimate way to edit a prompt) and it stays green no matter
 * what the wording became. Deleting the voseo instruction from the source and
 * from the baseline in the same commit passes it cleanly.
 *
 * This guard makes the opposite assertion: for every feature that emits text a
 * host or guest will read, the three HOS-789 invariants MUST be stated
 * somewhere in the prompt the model actually receives.
 *
 * ## What it asserts against
 *
 * The **composed** prompt (`content + "\n\n" + rules`), never one half. The two
 * halves are a deployment detail — an admin editing from the panel replaces
 * `content` and keeps `rules`, so an instruction may legitimately live in
 * either. What the model sees is the concatenation, and that is the only thing
 * worth asserting on. Anchoring on one half would fail the day someone moves a
 * sentence across the boundary without changing its meaning.
 *
 * ## Anchors
 *
 * Each check anchors on a token that cannot survive the instruction being
 * removed or neutered — "voseo" for the register, "proper noun" for the naming
 * rule — rather than on a full sentence, which a reword would break without any
 * loss of meaning.
 *
 * @module test/brand-voice-prompt.guard
 */

import type { AiFeature } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../src/engine/default-prompts.js';

/**
 * The prompt as the engine composes it before sending
 * (`composeSystemPrompt` in `src/config/prompt-resolver.ts`).
 */
function composed(feature: AiFeature): string {
    return `${DEFAULT_PROMPTS[feature]}\n\n${DEFAULT_RULES[feature]}`;
}

/**
 * Features whose output is Spanish prose a human reads — a listing description,
 * a chat reply, a support answer, a blog draft. These are the surfaces where a
 * tuteo/voseo mismatch is visible to a user.
 *
 * `search` and `accommodation_import` emit JSON, never prose, so a register
 * instruction there would be noise the model has to ignore. `translate` writes
 * prose but into en/pt from a Spanish source, so it carries the register rule
 * only as a conditional ("Spanish output MUST...").
 */
const SPANISH_PROSE_FEATURES: readonly AiFeature[] = [
    'text_improve',
    'chat',
    'support',
    'post_generate'
];

/**
 * Features that handle a proper name — either writing one into prose, carrying
 * one across languages, or extracting one from a page.
 */
const PROPER_NAME_FEATURES: readonly AiFeature[] = [
    'text_improve',
    'chat',
    'translate',
    'accommodation_import',
    'post_generate'
];

/**
 * Features that describe an accommodation and could therefore reach for the
 * word "destino" to do it.
 */
const DESTINO_FEATURES: readonly AiFeature[] = [
    'text_improve',
    'chat',
    'translate',
    'post_generate'
];

describe('HOS-789 — brand voice is stated in every prompt that needs it', () => {
    describe('rioplatense voseo (problem 1)', () => {
        for (const feature of SPANISH_PROSE_FEATURES) {
            it(`${feature} instructs voseo and names the forms to avoid`, () => {
                const prompt = composed(feature);

                expect(prompt.toLowerCase()).toContain('voseo');
                // The failure mode was not "no register stated" but "the wrong
                // register produced". Naming the tuteo forms explicitly is what
                // distinguishes this from a vague "use regional Spanish".
                expect(prompt).toContain('vení');
                expect(prompt).toContain('dejate');
            });
        }

        it('search does NOT carry the register instruction — it emits JSON, not prose', () => {
            expect(composed('search').toLowerCase()).not.toContain('voseo');
        });
    });

    describe('proper names are never translated (problem 2)', () => {
        for (const feature of PROPER_NAME_FEATURES) {
            it(`${feature} forbids translating a proper noun`, () => {
                const prompt = composed(feature).toLowerCase();

                expect(prompt).toContain('proper noun');
                expect(prompt).toContain('verbatim');
            });
        }

        it('translate spells out that the rule covers words INSIDE the name', () => {
            // The reported bug translated the descriptive half of a name
            // ("Cheroga Casa Quinta" → "Cheroga Country House"), so a rule that
            // only says "do not translate proper nouns" is not enough — the
            // model has to be told the inner words count too.
            const prompt = composed('translate');

            expect(prompt).toContain('Casa Quinta');
            expect(prompt.toLowerCase()).toContain('descriptive words');
        });

        it('translate resolves the conflict with its own terminology-adaptation rule', () => {
            // Rule 2 tells it to render "cabaña" as "cabin"; rule 6 tells it to
            // leave names alone. Without an explicit precedence, a listing named
            // "Cabañas del Río" sits squarely between them.
            expect(composed('translate')).toContain('OVERRIDES');
        });
    });

    describe('"destino" is not a word for an accommodation (problem 3)', () => {
        for (const feature of DESTINO_FEATURES) {
            it(`${feature} reserves "destino" for the geographic entity`, () => {
                expect(composed(feature)).toContain('destino');
                expect(composed(feature).toLowerCase()).toContain(
                    'to refer to an individual accommodation'
                );
            });
        }
    });
});
