/**
 * Case loading for the HOS-2095 sweep: the stored cases (`fixtures.json`), the
 * contexts apps/api generates with the real builders (`contexts.generated.json`)
 * and the join that turns them into runnable cases. Pure: no I/O.
 *
 * @module ai-core/scripts/ai-sweep/cases
 */

import { z } from 'zod';
import { appendReplyLanguageInstruction } from '../../src/language/reply-language.js';
import { RubricSchema } from './quality.js';

/** Heuristic rule ids a prompt case can request. */
export const RULE_IDS = ['minor-must-not-affirm-entry', 'unknown-must-say-dont-know'] as const;

/** One rule id. */
export type RuleId = (typeof RULE_IDS)[number];

/** Chat features the sweep measures. */
export const SWEEP_FEATURES = ['chat', 'chat_venue', 'chat_experience'] as const;

/** Page locales a case may declare. */
export const SWEEP_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * One prompt case, as stored in `fixtures.json`. The context and system message
 * are NOT stored here: they come from `contexts.generated.json`, rendered by the
 * real production builders (see README, "Contexts").
 */
export const FixtureCaseSchema = z.object({
    id: z.string().min(1),
    feature: z.enum(SWEEP_FEATURES),
    /** Entity id in `inputs/*.json` the context is rendered from. */
    entity: z.string().min(1),
    /** Page locale passed to the builders (labels, money, language fallback). */
    locale: z.enum(SWEEP_LOCALES).default('es'),
    /** Provenance: which real builder renders which input. */
    source: z.string().min(1),
    /** What the tourist types. */
    question: z.string().min(1),
    /** Ground truth for the automatic checks and the blind grader. */
    rubric: RubricSchema,
    /** Legacy heuristic rules (kept alongside the rubric). */
    rules: z.array(z.enum(RULE_IDS)).default([])
});

/** One stored case. */
export type FixtureCase = z.infer<typeof FixtureCaseSchema>;

/** Shape of `fixtures.json`. */
export const FixtureFileSchema = z.object({
    cases: z.array(FixtureCaseSchema).min(1)
});

const LocaleTableSchema = z.object({ es: z.string(), en: z.string(), pt: z.string() });

/** Shape of `contexts.generated.json` (written by apps/api, read here). */
export const GeneratedFileSchema = z.object({
    /** `buildChatSystemMessage('', prompt, locale)` per feature and locale. */
    systemSuffixes: z.object({
        chat: LocaleTableSchema,
        chat_venue: LocaleTableSchema,
        chat_experience: LocaleTableSchema
    }),
    cases: z.record(
        z.string(),
        z.object({
            feature: z.enum(SWEEP_FEATURES),
            entity: z.string().min(1),
            locale: z.enum(SWEEP_LOCALES),
            context: z.string().min(1)
        })
    )
});

/** Parsed generated file. */
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

/** A case ready to run: stored case + rendered context + full system message. */
export type PromptCase = FixtureCase & {
    /** Context block rendered by the real builder. */
    readonly context: string;
    /** Exact system message production sends (context + generated suffix). */
    readonly system: string;
};

/**
 * Joins the stored cases with their generated contexts. The system message is
 * `context + systemSuffixes[feature][locale]` plus the reply-language line
 * (`appendReplyLanguageInstruction`, as the chat route does): plain concatenation of strings the
 * real `buildChatSystemMessage` produced, so nothing here re-implements it.
 *
 * Throws when a case has no generated entry or its entity/feature/locale changed
 * since generation: the generated file is stale and must be regenerated.
 */
export function joinGeneratedCases(input: {
    readonly fixtures: readonly FixtureCase[];
    readonly generated: GeneratedFile;
}): PromptCase[] {
    const stale: string[] = [];
    const cases = input.fixtures.map((c) => {
        const g = input.generated.cases[c.id];
        if (!g || g.entity !== c.entity || g.feature !== c.feature || g.locale !== c.locale) {
            stale.push(c.id);
            return null;
        }
        // Same step as `toEngineMessages` in apps/api chat.ts (HOS-2095 round 2):
        // the reply-language line is the LAST line of the system message.
        const { system } = appendReplyLanguageInstruction({
            system: g.context + input.generated.systemSuffixes[c.feature][c.locale],
            latestUserMessage: c.question
        });
        return { ...c, context: g.context, system };
    });
    if (stale.length > 0) {
        throw new Error(
            `contexts.generated.json is stale for: ${stale.join(', ')}. Regenerate it: ` +
                'CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-contexts.ts'
        );
    }
    return cases.filter((c): c is PromptCase => c !== null);
}
