/**
 * Case loading for the non-chat AI features of the model sweep (HOS-2217).
 *
 * The stored part of a case lives in `task-fixtures/<feature>.json`: the raw
 * input the production route receives (`input`), the automatic checks and the
 * grader notes. The provider request is NOT stored there: apps/api renders it
 * with the real route builders into `tasks.generated.json` (see README,
 * "Production parity"). This module joins the two and refuses a stale
 * generated file. Pure: no I/O.
 *
 * @module ai-core/scripts/ai-sweep/tasks
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { RubricFactSchema } from './quality.js';
import type { JsonSchemaDocument } from './sdk-json-schema.js';

/** The AI features this module covers (chat features stay in `cases.ts`). */
export const TASK_FEATURES = [
    'search',
    'translate',
    'text_improve',
    'post_generate',
    'accommodation_import',
    'faq_draft',
    'support'
] as const;

/** One non-chat feature. */
export type TaskFeature = (typeof TASK_FEATURES)[number];

/**
 * The production call a case exercises. `search` makes two calls per request
 * (filter extraction, then the reply), so it has two call kinds.
 */
export const TASK_CALLS = [
    'search_intent',
    'search_reply',
    'translate',
    'text_improve',
    'post_generate',
    'accommodation_import',
    'faq_draft',
    'support'
] as const;

/** One call kind. */
export type TaskCall = (typeof TASK_CALLS)[number];

/** The feature each call kind is billed and routed under. */
export const FEATURE_OF_CALL: Readonly<Record<TaskCall, TaskFeature>> = {
    search_intent: 'search',
    search_reply: 'search',
    translate: 'translate',
    text_improve: 'text_improve',
    post_generate: 'post_generate',
    accommodation_import: 'accommodation_import',
    faq_draft: 'faq_draft',
    support: 'support'
};

/** One expectation on a field of a structured answer (dot path, `[n]` not supported). */
export const SingleFieldExpectationSchema = z.object({
    path: z.string().min(1),
    op: z.enum(['equals', 'absent', 'present', 'oneOf', 'contains', 'matches', 'gte', 'lte']),
    value: z.unknown().optional(),
    /** Short label for the report; defaults to `path op value`. */
    label: z.string().optional()
});

/** One single-field expectation. */
export type SingleFieldExpectation = z.infer<typeof SingleFieldExpectationSchema>;

/**
 * A field expectation, or a disjunction of them for facts a good answer may
 * encode in more than one place (a pool as `hasPool: true` OR `amenitySlugs`
 * containing `pool`).
 */
export const FieldExpectationSchema = z.union([
    SingleFieldExpectationSchema,
    z.object({ anyOf: z.array(SingleFieldExpectationSchema).min(2), label: z.string().min(1) })
]);

/** One field expectation. */
export type FieldExpectation = z.infer<typeof FieldExpectationSchema>;

/**
 * Automatic checks of one case. Text checks apply to a text answer, or to the
 * text found at `textPaths` of a structured answer.
 */
export const TaskChecksSchema = z.object({
    /** Facts the answer must state (regex, case-insensitive, accent-insensitive). */
    mustInclude: z.array(RubricFactSchema).default([]),
    /** Facts the answer must NOT state (invented, contradicted or leaked). */
    mustNotClaim: z.array(RubricFactSchema).default([]),
    /** Language the answer text must be written in. */
    expectedLanguage: z.enum(['es', 'en', 'pt']).optional(),
    /** The right answer is a polite decline / scope statement. */
    expectsDecline: z.boolean().default(false),
    minChars: z.number().int().nonnegative().optional(),
    maxChars: z.number().int().positive().optional(),
    /** No lead-in ("Aquí tenés...", "Here is...", "Traducción:") and no wrapping quotes. */
    noPreamble: z.boolean().default(false),
    /** No markdown headings, bold, lists or fences. */
    noMarkdown: z.boolean().default(false),
    /** The answer must equal this text exactly (after trimming), e.g. a proper name. */
    mustEqual: z.string().optional(),
    /** Literal substrings that must survive verbatim (numbers, names). */
    preserve: z.array(z.string().min(1)).default([]),
    /** Structured answers: where the text checks read from (joined by a blank line). */
    textPaths: z.array(z.string().min(1)).default([]),
    /** Structured answers: per-field expectations. */
    expect: z.array(FieldExpectationSchema).default([]),
    /**
     * Structured answers: leaf-path prefixes a good answer may set. Any other
     * non-empty leaf is reported as a hallucinated field. Omit to skip the check.
     */
    allowedFields: z.array(z.string().min(1)).optional(),
    /**
     * Structured answers: string fields whose value must appear verbatim
     * (case/accent-insensitive) in the grounding text the model was given.
     */
    groundedFields: z.array(z.string().min(1)).default([]),
    /** Structured answers: a field that must hold HTML markup, not markdown or bare prose. */
    htmlField: z.string().optional()
});

/** Parsed checks. */
export type TaskChecks = z.infer<typeof TaskChecksSchema>;

/** One stored case of `task-fixtures/<feature>.json`. */
export const TaskFixtureCaseSchema = z.object({
    /** Unique across every feature; prefixed with the feature for readability. */
    id: z.string().min(1),
    call: z.enum(TASK_CALLS),
    /** Raw route input, rendered by apps/api. Its shape depends on `call`. */
    input: z.record(z.string(), z.unknown()),
    checks: TaskChecksSchema,
    /** What an ideal answer looks like (for the blind grader). */
    notes: z.string().min(1)
});

/** One stored case. */
export type TaskFixtureCase = z.infer<typeof TaskFixtureCaseSchema>;

/** Shape of one `task-fixtures/<feature>.json` file. */
export const TaskFixtureFileSchema = z.object({
    feature: z.enum(TASK_FEATURES),
    cases: z.array(TaskFixtureCaseSchema).min(1)
});

/** The engine request a route hands `aiService` (before the engine injects anything). */
export const EngineRequestSchema = z.object({
    feature: z.enum(TASK_FEATURES),
    locale: z.enum(['es', 'en', 'pt']),
    prompt: z.string().min(1).optional(),
    messages: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
        .optional(),
    /** `streamText` / `generateText` caller system (caller-wins). */
    system: z.string().min(1).optional(),
    /** `generateObject` caller system (replaces the resolved prompt). */
    systemPrompt: z.string().min(1).optional(),
    params: z
        .object({
            maxTokens: z.number().int().positive().optional(),
            temperature: z.number().optional()
        })
        .optional()
});

/** One engine request. */
export type EngineRequest = z.infer<typeof EngineRequestSchema>;

/** Output schema ids the generated file serializes. */
export const OUTPUT_SCHEMA_IDS = [
    'search_intent',
    'accommodation_import',
    'post_generate',
    'faq_draft'
] as const;

/** One output schema id. */
export type OutputSchemaId = (typeof OUTPUT_SCHEMA_IDS)[number];

const GeneratedTaskSchema = z.object({
    call: z.enum(TASK_CALLS),
    /** sha256 of `JSON.stringify(input)`: detects a fixture edited after generation. */
    inputDigest: z.string().length(64),
    /** `text`: generateText/streamText. `object`: generateObject. */
    mode: z.enum(['text', 'object']),
    /** Production streams this call (TTFT is measured only then). */
    stream: z.boolean(),
    request: EngineRequestSchema,
    schemaId: z.enum(OUTPUT_SCHEMA_IDS).optional(),
    /** URL placeholders the translate route substituted; each must survive once. */
    placeholders: z.array(z.string()).default([]),
    /** Text the answer must be grounded in (page text, listing context); may be empty. */
    groundingText: z.string().default('')
});

/** Shape of `tasks.generated.json` (written by apps/api). */
export const GeneratedTasksFileSchema = z.object({
    /** `toSdkJsonSchema(<production Zod schema>)` per output schema id. */
    schemas: z.record(z.enum(OUTPUT_SCHEMA_IDS), z.record(z.string(), z.unknown())),
    cases: z.record(z.string(), GeneratedTaskSchema)
});

/** Parsed generated file. */
export type GeneratedTasksFile = z.infer<typeof GeneratedTasksFileSchema>;

/** A runnable case: stored case + the rendered production request. */
export interface TaskCase extends TaskFixtureCase {
    readonly feature: TaskFeature;
    readonly mode: 'text' | 'object';
    readonly stream: boolean;
    readonly request: EngineRequest;
    readonly schemaId: OutputSchemaId | null;
    readonly outputSchema: JsonSchemaDocument | null;
    readonly placeholders: readonly string[];
    readonly groundingText: string;
}

/**
 * Digest of a case input, shared by the generator and the join.
 *
 * @param input - The fixture `input` object.
 * @returns `{ digest }` (hex sha256 of `JSON.stringify(input)`).
 */
export function digestInput(input: unknown): { readonly digest: string } {
    return { digest: createHash('sha256').update(JSON.stringify(input)).digest('hex') };
}

/**
 * Joins stored cases with the generated requests.
 *
 * Throws when a case id repeats, a case's call does not belong to its file's
 * feature, or the generated entry is missing or stale (different call or input
 * digest): the generated file must then be regenerated.
 *
 * @param input.files - Parsed fixture files.
 * @param input.generated - Parsed generated file.
 * @returns `{ cases }` in file order.
 */
export function joinTaskCases(input: {
    readonly files: readonly z.infer<typeof TaskFixtureFileSchema>[];
    readonly generated: GeneratedTasksFile;
}): { readonly cases: TaskCase[] } {
    const stale: string[] = [];
    const seen = new Set<string>();
    const cases: TaskCase[] = [];
    for (const file of input.files) {
        for (const c of file.cases) {
            if (seen.has(c.id)) throw new Error(`Duplicated task case id "${c.id}".`);
            seen.add(c.id);
            if (FEATURE_OF_CALL[c.call] !== file.feature) {
                throw new Error(
                    `Case "${c.id}": call "${c.call}" does not belong to feature "${file.feature}".`
                );
            }
            const g = input.generated.cases[c.id];
            if (!g || g.call !== c.call || g.inputDigest !== digestInput(c.input).digest) {
                stale.push(c.id);
                continue;
            }
            const outputSchema = g.schemaId ? (input.generated.schemas[g.schemaId] ?? null) : null;
            if (g.mode === 'object' && outputSchema === null) {
                throw new Error(`Case "${c.id}": object call without a generated output schema.`);
            }
            cases.push({
                ...c,
                feature: file.feature,
                mode: g.mode,
                stream: g.stream,
                request: g.request,
                schemaId: g.schemaId ?? null,
                outputSchema,
                placeholders: g.placeholders,
                groundingText: g.groundingText
            });
        }
    }
    if (stale.length > 0) {
        throw new Error(
            `tasks.generated.json is stale for: ${stale.join(', ')}. Regenerate it: ` +
                'CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-tasks.ts'
        );
    }
    return { cases };
}
