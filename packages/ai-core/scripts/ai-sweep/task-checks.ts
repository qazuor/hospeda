/**
 * Automatic checks for the non-chat AI features of the model sweep (HOS-2217).
 * Pure: no I/O.
 *
 * Structured answers get schema validity (against the schema the provider was
 * constrained with), production acceptance (the parse production runs on the
 * result), per-field expectations, hallucinated fields and grounding. Text
 * answers (and the text inside structured ones) get rubric facts, language,
 * decline, length, format and verbatim-preservation checks.
 *
 * Like `quality.ts`, every text check is a HEURISTIC. Read failures, and grade
 * blind, before concluding anything.
 *
 * @module ai-core/scripts/ai-sweep/task-checks
 */

import {
    AiFaqDraftOutputSchema,
    AiPostGenerateDraftSchema,
    SearchIntentEntitiesSchema
} from '@repo/schemas';
import { validateJsonSchema } from './json-schema-check.js';
import { detectLanguage, looksLikeDecline, matchesPattern } from './quality.js';
import type { FieldExpectation, OutputSchemaId, TaskCase, TaskChecks } from './tasks.js';

/** Result of all automatic checks on one answer. */
export interface TaskCheckResult {
    /** Check name to pass/fail. */
    readonly checks: Readonly<Record<string, boolean>>;
    /** Share of passed checks; `null` when no check applied. */
    readonly passRate: number | null;
    /** Every check passed. */
    readonly allPass: boolean;
    /** Structured answers: valid against the provider-side schema. */
    readonly schemaValid: boolean | null;
    /** Structured answers: the parse production runs on the result accepts it. */
    readonly productionAccepts: boolean | null;
    /** Structured answers: non-empty leaf paths outside `allowedFields`. */
    readonly hallucinatedFields: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a dot path (`entities.minGuests`) from a value.
 *
 * @param input.value - Root value.
 * @param input.path - Dot-separated keys.
 * @returns The value at the path, or `undefined`.
 */
export function getPath(input: { readonly value: unknown; readonly path: string }): unknown {
    let current: unknown = input.value;
    for (const key of input.path.split('.')) {
        if (!isRecord(current)) return undefined;
        current = current[key];
    }
    return current;
}

/** `undefined`, `null`, blank string and empty array count as "not set". */
export function isEmptyValue(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Lists the non-empty leaf paths of an object. Arrays are leaves.
 *
 * @param input.value - Root value.
 * @returns `{ paths }` in traversal order.
 */
export function listLeafPaths(input: { readonly value: unknown }): { readonly paths: string[] } {
    const paths: string[] = [];
    const walk = (node: unknown, prefix: string): void => {
        if (isRecord(node)) {
            for (const [key, child] of Object.entries(node)) {
                walk(child, prefix === '' ? key : `${prefix}.${key}`);
            }
            return;
        }
        if (!isEmptyValue(node) && prefix !== '') paths.push(prefix);
    };
    walk(input.value, '');
    return { paths };
}

const sameValue = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) && Array.isArray(b)) {
        const norm = (xs: readonly unknown[]) => xs.map((x) => JSON.stringify(x)).sort();
        return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
    }
    return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Evaluates one field expectation against a structured answer.
 *
 * @param input.object - The answer object.
 * @param input.expectation - The expectation.
 * @returns Whether it holds.
 */
export function evaluateExpectation(input: {
    readonly object: unknown;
    readonly expectation: FieldExpectation;
}): boolean {
    const e = input.expectation;
    if ('anyOf' in e) {
        return e.anyOf.some((expectation) =>
            evaluateExpectation({ object: input.object, expectation })
        );
    }
    const { path, op, value } = e;
    const actual = getPath({ value: input.object, path });
    switch (op) {
        case 'equals':
            return sameValue(actual, value);
        case 'absent':
            return isEmptyValue(actual);
        case 'present':
            return !isEmptyValue(actual);
        case 'oneOf':
            return Array.isArray(value) && value.some((v) => sameValue(actual, v));
        case 'contains':
            if (Array.isArray(actual)) return actual.some((a) => sameValue(a, value));
            return typeof actual === 'string' && typeof value === 'string'
                ? actual.toLowerCase().includes(value.toLowerCase())
                : false;
        case 'matches':
            return (
                typeof value === 'string' &&
                actual !== undefined &&
                actual !== null &&
                matchesPattern({ pattern: value, text: String(actual) })
            );
        case 'gte':
            return typeof actual === 'number' && typeof value === 'number' && actual >= value;
        case 'lte':
            return typeof actual === 'number' && typeof value === 'number' && actual <= value;
    }
}

/** Report label of an expectation: its `label`, else `path op value`. */
export function expectationLabel(expectation: FieldExpectation): string {
    if (expectation.label) return expectation.label;
    if ('anyOf' in expectation) return 'anyOf';
    const value = expectation.value === undefined ? '' : ` ${JSON.stringify(expectation.value)}`;
    return `${expectation.path} ${expectation.op}${value}`;
}

const PREAMBLE =
    /^\s*(["“«'`]|aqu[ií] (est[aá]|ten[eé]s|va|te dejo)|te dejo|here('s| is| are)\b|sure[,!.]|claro[,!.]|por supuesto|segue\b|aqui est[aá]|translation:|traducci[oó]n:|tradu[cç][aã]o:|texto mejorado:|improved (text|version)|versi[oó]n mejorada)/i;
const WRAPPED_IN_QUOTES = /^\s*["“«'][\s\S]*["”»']\s*$/;
const MARKDOWN = /(^|\n)\s*(#{1,6} |[-*+] |\d+\. )|\*\*|```|(^|\s)__\S/;
const HTML_TAG = /<(p|h[1-6]|ul|ol|li|strong|em|br|section|article|blockquote)[\s>/]/i;
const DECLINE_EN_PT =
    /(I can only|I can't help|I cannot help|I'm only able|outside (my|the) scope|só posso|não posso ajudar|fora do (meu )?escopo)/i;
/**
 * Reads a one-word classifier verdict exactly as production's
 * `parseClassifierVerdict` (apps/api/src/services/ai-chat-answer-classifier.ts)
 * does: uppercase, letters only, `UNANSWERED` before `ANSWERED`, anything else
 * `null`. ai-core may not import apps/api, so the apps/api parity test runs
 * both parsers over the same table.
 *
 * @param input.text - The raw model output.
 * @returns `{ verdict }`.
 */
export function parseAnswerVerdict(input: { readonly text: string }): {
    readonly verdict: 'answered' | 'unanswered' | null;
} {
    const normalized = input.text
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    if (normalized === 'UNANSWERED') return { verdict: 'unanswered' };
    if (normalized === 'ANSWERED') return { verdict: 'answered' };
    return { verdict: null };
}

const PLACEHOLDER_TOKEN = /\{\{\{HOSPEDA_URL_\d+\}\}\}/g;

const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Text checks of one answer (or of the text inside a structured answer).
 *
 * @param input.text - The answer text.
 * @param input.checks - The case checks.
 * @param input.placeholders - URL placeholders that must survive exactly once.
 * @returns `{ checks }`: name to pass/fail.
 */
export function checkText(input: {
    readonly text: string;
    readonly checks: TaskChecks;
    readonly placeholders: readonly string[];
}): { readonly checks: Record<string, boolean> } {
    const { text, checks } = input;
    const out: Record<string, boolean> = { notEmpty: text.trim() !== '' };
    for (const fact of checks.mustInclude)
        out[`include: ${fact.label}`] = matchesPattern({ pattern: fact.pattern, text });
    for (const fact of checks.mustNotClaim)
        out[`notClaim: ${fact.label}`] = !matchesPattern({ pattern: fact.pattern, text });
    if (checks.expectedLanguage)
        out[`language: ${checks.expectedLanguage}`] =
            detectLanguage(text) === checks.expectedLanguage;
    if (checks.expectsDecline) out.decline = looksLikeDecline(text) || DECLINE_EN_PT.test(text);
    if (checks.minChars !== undefined)
        out[`minChars ${checks.minChars}`] = text.length >= checks.minChars;
    if (checks.maxChars !== undefined)
        out[`maxChars ${checks.maxChars}`] = text.length <= checks.maxChars;
    if (checks.noPreamble) out.noPreamble = !PREAMBLE.test(text) && !WRAPPED_IN_QUOTES.test(text);
    if (checks.noMarkdown) out.noMarkdown = !MARKDOWN.test(text);
    if (checks.expectVerdict !== undefined) {
        out[`verdict: ${checks.expectVerdict}`] =
            parseAnswerVerdict({ text }).verdict === checks.expectVerdict;
    }
    if (checks.mustEqual !== undefined) out.exactText = text.trim() === checks.mustEqual.trim();
    for (const literal of checks.preserve) out[`preserve: ${literal}`] = text.includes(literal);
    if (input.placeholders.length > 0) {
        const found = text.match(PLACEHOLDER_TOKEN) ?? [];
        out.placeholdersIntact =
            found.length === input.placeholders.length &&
            input.placeholders.every((p) => found.filter((f) => f === p).length === 1);
    }
    return { checks: out };
}

/**
 * Whether production accepts an `accommodation_import` answer (HOS-2250).
 *
 * Production runs two steps, both in apps/api (which ai-core may not import):
 * the AI SDK validates the answer against the strict model-facing Zod schema
 * (every field required and nullable; unknown keys are stripped, not
 * rejected), then the route drops the `null` fields and re-parses with the
 * all-optional schema. The second step accepts everything the first accepts,
 * so the equivalent here is the stored model-facing JSON Schema without
 * `additionalProperties`. `apps/api/test/scripts/ai-sweep-tasks-parity.test.ts`
 * runs this and the real production chain over the same table.
 *
 * @param input.schema - The stored model-facing JSON Schema.
 * @param input.object - The model's answer.
 * @returns `{ accepted }`.
 */
export function accommodationImportProductionAccepts(input: {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly object: unknown;
}): { readonly accepted: boolean } {
    return {
        accepted: validateJsonSchema({
            schema: input.schema,
            value: input.object,
            options: { ignoreAdditionalProperties: true }
        }).valid
    };
}

/** The parse production runs on a structured result, per output schema. */
function productionAccepts(input: {
    readonly schemaId: OutputSchemaId;
    readonly object: unknown;
    readonly task: TaskCase;
}): boolean {
    switch (input.schemaId) {
        case 'search_intent':
            return (
                isRecord(input.object) &&
                SearchIntentEntitiesSchema.safeParse(input.object.entities).success
            );
        case 'post_generate':
            return AiPostGenerateDraftSchema.safeParse(input.object).success;
        case 'faq_draft':
            return AiFaqDraftOutputSchema.safeParse(input.object).success;
        case 'accommodation_import':
            return input.task.outputSchema === null
                ? false
                : accommodationImportProductionAccepts({
                      schema: input.task.outputSchema,
                      object: input.object
                  }).accepted;
    }
}

const summarize = (checks: Readonly<Record<string, boolean>>) => {
    const values = Object.values(checks);
    const passed = values.filter(Boolean).length;
    return {
        passRate: values.length === 0 ? null : passed / values.length,
        allPass: passed === values.length
    };
};

/**
 * Runs every automatic check of one case on one answer.
 *
 * @param input.task - The case.
 * @param input.text - The raw answer text (for structured calls, the JSON text).
 * @param input.object - The parsed object (structured calls only).
 * @returns {@link TaskCheckResult}.
 */
export function checkTaskAnswer(input: {
    readonly task: TaskCase;
    readonly text: string;
    readonly object?: unknown;
}): TaskCheckResult {
    const { task } = input;
    const { checks } = task;
    if (task.mode === 'text') {
        const text = checkText({ text: input.text, checks, placeholders: task.placeholders });
        return {
            checks: text.checks,
            ...summarize(text.checks),
            schemaValid: null,
            productionAccepts: null,
            hallucinatedFields: []
        };
    }
    const object = input.object;
    const out: Record<string, boolean> = {};
    const schemaValid =
        task.outputSchema !== null &&
        object !== undefined &&
        validateJsonSchema({ schema: task.outputSchema, value: object }).valid;
    out.schemaValid = schemaValid;
    const accepted =
        task.schemaId !== null && object !== undefined
            ? productionAccepts({ schemaId: task.schemaId, object, task })
            : false;
    out.productionAccepts = accepted;
    for (const expectation of checks.expect) {
        out[`field: ${expectationLabel(expectation)}`] = evaluateExpectation({
            object,
            expectation
        });
    }
    let hallucinatedFields: string[] = [];
    if (checks.allowedFields) {
        const allowed = checks.allowedFields;
        hallucinatedFields = listLeafPaths({ value: object }).paths.filter(
            (p) => !allowed.some((a) => p === a || p.startsWith(`${a}.`))
        );
        out.noHallucinatedFields = hallucinatedFields.length === 0;
    }
    const grounding = normalize(task.groundingText);
    for (const path of checks.groundedFields) {
        const value = getPath({ value: object, path });
        if (isEmptyValue(value)) continue;
        const values = Array.isArray(value) ? value : [value];
        out[`grounded: ${path}`] = values.every(
            (v) => typeof v !== 'string' || grounding.includes(normalize(v))
        );
    }
    if (checks.htmlField) {
        const html = getPath({ value: object, path: checks.htmlField });
        out[`html: ${checks.htmlField}`] =
            typeof html === 'string' && HTML_TAG.test(html) && !MARKDOWN.test(html);
    }
    if (checks.textPaths.length > 0) {
        const joined = checks.textPaths
            .map((p) => getPath({ value: object, path: p }))
            .filter((v): v is string => typeof v === 'string')
            .join('\n\n');
        const { notEmpty: _notEmpty, ...textChecks } = checkText({
            text: joined,
            checks,
            placeholders: task.placeholders
        }).checks;
        // An empty text field can be the right answer (`hasData: false`), so
        // presence is asserted through `expect` instead of `notEmpty`.
        Object.assign(out, textChecks);
    }
    return {
        checks: out,
        ...summarize(out),
        schemaValid,
        productionAccepts: accepted,
        hallucinatedFields
    };
}
