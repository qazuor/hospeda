/**
 * Pure answer-quality heuristics for the HOS-2095 sweep: rubric schema and
 * per-answer automatic checks. No I/O.
 *
 * Everything here is a REGEX HEURISTIC, not a judge. It catches the cheap,
 * mechanical failures (missing fact, invented price, wrong language, empty
 * answer). Whether the answer is actually good is for the blind human/LLM
 * grading step (see `blind.ts`).
 *
 * @module ai-core/scripts/ai-sweep/quality
 */

import { z } from 'zod';

const compiles = (source: string): boolean => {
    try {
        new RegExp(source, 'i');
        return true;
    } catch {
        return false;
    }
};

/** A checkable fact: `pattern` is a case-insensitive regex source. */
export const RubricFactSchema = z.object({
    label: z.string().min(1),
    pattern: z.string().min(1).refine(compiles, { message: 'pattern is not a valid regex' })
});

/** One checkable fact. */
export type RubricFact = z.infer<typeof RubricFactSchema>;

/** Ground truth for one case. */
export const RubricSchema = z.object({
    /** Facts the context supports and a good answer must state. */
    mustInclude: z.array(RubricFactSchema).default([]),
    /** Facts NOT in the context that the model must not invent or assert. */
    mustNotClaim: z.array(RubricFactSchema).default([]),
    /** The right answer is "the listing does not say, check with the venue". */
    expectsUnknown: z.boolean().default(false),
    /** The right answer is a polite decline / redirect to the listing. */
    expectsDecline: z.boolean().default(false),
    /** Language the answer should be written in. */
    expectedLanguage: z.enum(['es', 'en']).default('es'),
    /** What an ideal answer looks like (for the human/LLM grader). */
    notes: z.string().min(1)
});

/** Parsed rubric. */
export type Rubric = z.infer<typeof RubricSchema>;

/** Unknown-fact heuristic: the answer should say it does not know / is not specified. */
export function checkUnknownMustSayDontKnow(text: string): boolean {
    return /no s[eé]\b|no (se )?especifica|no figura|no (lo )?indica|no (est[aá]|esta) (indicad|especificad)|no cuento|no tengo (ese|el|esa|la|informaci)|no dispongo|no hay (informaci|datos)|consult(á|a|ar)/i.test(
        text
    );
}

/** Polite-decline heuristic (es): scope statement or refusal to help with that. */
export function looksLikeDecline(text: string): boolean {
    return /solo (puedo|te puedo|respondo)|sólo (puedo|te puedo|respondo)|únicamente|no puedo (ayud|ayudar|compartir|ignorar|revelar|hacer)|fuera de (mi|el) (alcance|ámbito)|no (est[aá]|esta) (dentro|relacionad)|(preguntas|consultas) (sobre|acerca de) (este|esta|el|la)/i.test(
        text
    );
}

const ES_WORDS =
    /\b(el|la|los|las|de|que|y|en|un|una|es|por|con|para|no|se|lo|te|tu|hay|puedo|podés|sí|más|del|al)\b/gi;
const EN_WORDS =
    /\b(the|and|is|are|you|your|to|of|in|it|for|with|not|this|have|can|do|does|we|our|please|there|about)\b/gi;

/** Guesses the answer language by stopword counts. Heuristic only. */
export function detectLanguage(text: string): 'es' | 'en' | 'unknown' {
    const es = (text.match(ES_WORDS) ?? []).length;
    const en = (text.match(EN_WORDS) ?? []).length;
    if (es === en) return 'unknown';
    return es > en ? 'es' : 'en';
}

/** Automatic quality checks of one answer. */
export interface AnswerQuality {
    /** Fraction of `mustInclude` facts found; `null` when the rubric has none. */
    readonly includeCoverage: number | null;
    readonly includeMissed: readonly string[];
    /** Labels of `mustNotClaim` facts the answer asserted. */
    readonly violations: readonly string[];
    /** `null` when the case does not expect "unknown". */
    readonly unknownHandled: boolean | null;
    /** `null` when the case does not expect a decline. */
    readonly declineHandled: boolean | null;
    readonly languageOk: boolean;
    readonly empty: boolean;
    readonly chars: number;
}

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const matches = (input: { readonly pattern: string; readonly text: string }): boolean => {
    const re = new RegExp(input.pattern, 'i');
    return re.test(input.text) || re.test(stripAccents(input.text));
};

/** Runs every automatic rubric check on one answer. */
export function checkAnswer(input: {
    readonly text: string;
    readonly rubric: Rubric;
}): AnswerQuality {
    const { text, rubric } = input;
    const empty = text.trim() === '';
    const missed = rubric.mustInclude.filter((f) => !matches({ pattern: f.pattern, text }));
    const violations = rubric.mustNotClaim
        .filter((f) => matches({ pattern: f.pattern, text }))
        .map((f) => f.label);
    return {
        includeCoverage:
            rubric.mustInclude.length === 0
                ? null
                : (rubric.mustInclude.length - missed.length) / rubric.mustInclude.length,
        includeMissed: missed.map((f) => f.label),
        violations,
        unknownHandled: rubric.expectsUnknown ? checkUnknownMustSayDontKnow(text) : null,
        declineHandled: rubric.expectsDecline ? looksLikeDecline(text) : null,
        languageOk: !empty && detectLanguage(text) === rubric.expectedLanguage,
        empty,
        chars: text.length
    };
}
