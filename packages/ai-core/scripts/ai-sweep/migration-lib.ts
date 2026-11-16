/**
 * Pure core of the model-migration sweep (HOS-2217): config, the runnable-case
 * abstraction over chat and non-chat features, the call matrix, the dry-run
 * plan and the per-feature / overall reports. No I/O, no network.
 *
 * @module ai-core/scripts/ai-sweep/migration-lib
 */

import { z } from 'zod';
import { type PromptCase, SWEEP_FEATURES } from './cases.js';
import {
    approxTokens,
    DEFAULT_MONTHLY_QUOTAS,
    estimateCostUsd,
    type Grade,
    percentile,
    REASONING_EFFORTS,
    type ReasoningEffort,
    resultKey,
    type UsdRates
} from './lib.js';
import { type ProviderRequest, toProviderRequest } from './provider-call.js';
import { checkAnswer } from './quality.js';
import type { JsonSchemaDocument } from './sdk-json-schema.js';
import { checkTaskAnswer, type TaskCheckResult } from './task-checks.js';
import { TASK_FEATURES, type TaskCase } from './tasks.js';

/** Every AI feature the migration sweep covers, chat features first. */
export const MIGRATION_FEATURES = [...SWEEP_FEATURES, ...TASK_FEATURES] as const;

/** One feature. */
export type MigrationFeature = (typeof MIGRATION_FEATURES)[number];

const FeatureSettingsSchema = z.object({
    /** Production calls per month, for the cost projection (owner input; see README). */
    monthlyCalls: z.number().nonnegative(),
    /** Case ids to run; empty means every case of the feature. */
    caseIds: z.array(z.string()).default([])
});

/** Zod schema of `sweep.config.migration*.json`. The FIRST model is the baseline. */
export const MigrationConfigSchema = z.object({
    providers: z
        .array(
            z.object({
                id: z.string().min(1),
                baseURL: z.string().url().optional(),
                apiKeyEnv: z.string().min(1)
            })
        )
        .min(1),
    models: z
        .array(
            z.object({
                id: z.string().min(1),
                provider: z.string().min(1),
                reasoning: z.boolean().default(false),
                reasoningEfforts: z.array(z.enum(REASONING_EFFORTS)).default([]),
                rates: z
                    .object({
                        inputUsdPerMillion: z.number().nonnegative(),
                        outputUsdPerMillion: z.number().nonnegative()
                    })
                    .optional()
            })
        )
        .min(1),
    /** Output cap used only when production sends no `maxTokens` for the call. */
    maxOutputTokens: z.number().int().positive(),
    /** Per-feature override of `maxOutputTokens`. */
    featureMaxOutputTokens: z
        .partialRecord(z.enum(MIGRATION_FEATURES), z.number().int().positive())
        .default({}),
    repetitions: z.number().int().positive().default(1),
    concurrency: z.number().int().positive().default(2),
    maxCalls: z.number().int().positive(),
    /**
     * Monthly answer quotas (per account) for the quota-based projection, the
     * same one the chat sweep uses: cost per answer x quota. It stays useful
     * while measured production volumes are too small to project from.
     */
    monthlyQuotas: z.array(z.number().int().positive()).default([...DEFAULT_MONTHLY_QUOTAS]),
    /** Features to run. A feature missing here is not run. */
    features: z.partialRecord(z.enum(MIGRATION_FEATURES), FeatureSettingsSchema)
});

/** Parsed migration config. */
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

/** The automatic-check outcome of one answer, whatever the feature. */
export type CheckOutcome = TaskCheckResult;

/** A case of any feature, ready to run. */
export interface RunnableCase {
    readonly id: string;
    readonly feature: MigrationFeature;
    readonly mode: 'text' | 'object';
    readonly stream: boolean;
    /** The provider request for a given reasoning effort. */
    readonly buildRequest: (effort: ReasoningEffort | null) => ProviderRequest;
    /** Automatic checks of one answer. */
    readonly check: (answer: { readonly text: string; readonly object?: unknown }) => CheckOutcome;
    /** What a blind grader needs besides the answer. */
    readonly grading: Readonly<Record<string, unknown>>;
    /** Object calls: the JSON Schema the provider is constrained with. */
    readonly outputSchema: JsonSchemaDocument | null;
}

/**
 * Wraps a chat case: the system message is the generated production one and
 * the checks are `checkAnswer`'s, flattened to pass/fail.
 *
 * @param input.promptCase - A joined chat case.
 * @returns `{ runnable }`.
 */
export function chatRunnable(input: { readonly promptCase: PromptCase }): {
    readonly runnable: RunnableCase;
} {
    const c = input.promptCase;
    return {
        runnable: {
            id: c.id,
            feature: c.feature,
            mode: 'text',
            stream: true,
            buildRequest: (effort) => ({
                kind: 'text',
                feature: c.feature,
                system: c.system,
                messages: [{ role: 'user', content: c.question }],
                params: effort ? { reasoningEffort: effort } : undefined
            }),
            check: ({ text }) => {
                const q = checkAnswer({ text, rubric: c.rubric });
                const checks: Record<string, boolean> = {
                    notEmpty: !q.empty,
                    noViolations: q.violations.length === 0,
                    languageOk: q.languageOk,
                    noRawCodes: q.rawCodes.length === 0,
                    noOwnerVoice: !q.ownerVoice,
                    noImpossiblePromise: !q.impossiblePromise
                };
                if (q.includeCoverage !== null) checks.fullCoverage = q.includeCoverage === 1;
                if (q.unknownHandled !== null) checks.unknownHandled = q.unknownHandled;
                if (q.declineHandled !== null) checks.declineHandled = q.declineHandled;
                const values = Object.values(checks);
                const passed = values.filter(Boolean).length;
                return {
                    checks,
                    passRate: passed / values.length,
                    allPass: passed === values.length,
                    schemaValid: null,
                    productionAccepts: null,
                    hallucinatedFields: []
                };
            },
            grading: { context: c.context, question: c.question, notes: c.rubric.notes },
            outputSchema: null
        }
    };
}

/**
 * Wraps a non-chat case.
 *
 * @param input.task - A joined task case.
 * @returns `{ runnable }`.
 */
export function taskRunnable(input: { readonly task: TaskCase }): {
    readonly runnable: RunnableCase;
} {
    const t = input.task;
    return {
        runnable: {
            id: t.id,
            feature: t.feature,
            mode: t.mode,
            stream: t.stream,
            buildRequest: (effort) =>
                toProviderRequest({ request: t.request, mode: t.mode, effort }).providerRequest,
            check: ({ text, object }) => checkTaskAnswer({ task: t, text, object }),
            grading: {
                call: t.call,
                input: t.input,
                ...(t.groundingText === '' ? {} : { groundingText: t.groundingText }),
                notes: t.notes
            },
            outputSchema: t.outputSchema
        }
    };
}

/** One planned call. */
export interface MigrationCall {
    readonly variantKey: string;
    readonly provider: string;
    readonly model: string;
    readonly effort: ReasoningEffort | null;
    readonly feature: MigrationFeature;
    readonly caseId: string;
    readonly repetition: number;
    readonly maxOutputTokens: number;
    readonly request: ProviderRequest;
}

/** Variant key of the migration sweep: model and effort (caps are per feature). */
export function migrationVariantKey(input: {
    readonly model: string;
    readonly effort: ReasoningEffort | null;
}): string {
    return `${input.model} | ${input.effort ?? '-'}`;
}

/**
 * The effective output cap of a call: production's `maxTokens` when it sends
 * one, else the feature override, else the config default.
 */
export function effectiveCap(input: {
    readonly request: ProviderRequest;
    readonly feature: MigrationFeature;
    readonly config: MigrationConfig;
}): number {
    return (
        input.request.params?.maxTokens ??
        input.config.featureMaxOutputTokens[input.feature] ??
        input.config.maxOutputTokens
    );
}

/**
 * Selects the cases to run: features listed in the config (narrowed by
 * `onlyFeatures` when given) and, per feature, its `caseIds` when non-empty.
 *
 * @throws On an unknown feature in `onlyFeatures` or an unknown case id.
 */
export function selectCases(input: {
    readonly config: MigrationConfig;
    readonly cases: readonly RunnableCase[];
    readonly onlyFeatures: readonly string[] | null;
}): { readonly selected: RunnableCase[] } {
    const configured = MIGRATION_FEATURES.filter((f) => input.config.features[f] !== undefined);
    if (input.onlyFeatures) {
        const unknown = input.onlyFeatures.filter(
            (f) => !(configured as readonly string[]).includes(f)
        );
        if (unknown.length > 0) {
            throw new Error(
                `--features: not configured: ${unknown.join(', ')} (configured: ${configured.join(', ')})`
            );
        }
    }
    const active = input.onlyFeatures
        ? configured.filter((f) => input.onlyFeatures?.includes(f))
        : configured;
    const selected: RunnableCase[] = [];
    for (const feature of active) {
        const ids = input.config.features[feature]?.caseIds ?? [];
        const ofFeature = input.cases.filter((c) => c.feature === feature);
        const missing = ids.filter((id) => !ofFeature.some((c) => c.id === id));
        if (missing.length > 0) {
            throw new Error(`Feature ${feature}: unknown case ids ${missing.join(', ')}`);
        }
        selected.push(
            ...(ids.length === 0 ? ofFeature : ofFeature.filter((c) => ids.includes(c.id)))
        );
    }
    return { selected };
}

/** Expands models x efforts x cases x repetitions. */
export function expandMigrationMatrix(input: {
    readonly config: MigrationConfig;
    readonly cases: readonly RunnableCase[];
}): { readonly calls: MigrationCall[] } {
    const calls: MigrationCall[] = [];
    for (const model of input.config.models) {
        const efforts: readonly (ReasoningEffort | null)[] =
            model.reasoning && model.reasoningEfforts.length > 0 ? model.reasoningEfforts : [null];
        for (const effort of efforts) {
            for (const c of input.cases) {
                const request = c.buildRequest(effort);
                for (let repetition = 1; repetition <= input.config.repetitions; repetition++) {
                    calls.push({
                        variantKey: migrationVariantKey({ model: model.id, effort }),
                        provider: model.provider,
                        model: model.id,
                        effort,
                        feature: c.feature,
                        caseId: c.id,
                        repetition,
                        maxOutputTokens: effectiveCap({
                            request,
                            feature: c.feature,
                            config: input.config
                        }),
                        request
                    });
                }
            }
        }
    }
    return { calls };
}

/** Approximate input tokens of a provider request (4 chars/token). */
export function requestInputTokens(request: ProviderRequest): number {
    if (request.kind === 'object') return approxTokens(request.prompt);
    const messages = (request.messages ?? []).map((m) => m.content).join('\n');
    return approxTokens(`${request.system ?? ''}${request.prompt ?? ''}${messages}`);
}

/** Worst-case plan of one feature (or the total, `feature: 'TOTAL'`). */
export interface PlanRow {
    readonly feature: MigrationFeature | 'TOTAL';
    readonly calls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    /** Worst-case USD; a lower bound when `costKnown` is false. */
    readonly costUsd: number;
    readonly costKnown: boolean;
}

/** Builds the dry-run plan: per feature and total, every call hitting its cap. */
export function planCalls(input: {
    readonly calls: readonly MigrationCall[];
    readonly ratesFor: (model: string) => UsdRates | null;
}): { readonly rows: PlanRow[] } {
    const byFeature = new Map<MigrationFeature, PlanRow>();
    for (const call of input.calls) {
        const prev = byFeature.get(call.feature) ?? {
            feature: call.feature,
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            costKnown: true
        };
        const inTok = requestInputTokens(call.request);
        const cost = estimateCostUsd({
            inputTokens: inTok,
            outputTokens: call.maxOutputTokens,
            rates: input.ratesFor(call.model)
        });
        byFeature.set(call.feature, {
            feature: call.feature,
            calls: prev.calls + 1,
            inputTokens: prev.inputTokens + inTok,
            outputTokens: prev.outputTokens + call.maxOutputTokens,
            costUsd: prev.costUsd + (cost ?? 0),
            costKnown: prev.costKnown && cost !== null
        });
    }
    const rows = MIGRATION_FEATURES.flatMap((f) => {
        const row = byFeature.get(f);
        return row ? [row] : [];
    });
    const total = rows.reduce<PlanRow>(
        (acc, r) => ({
            feature: 'TOTAL',
            calls: acc.calls + r.calls,
            inputTokens: acc.inputTokens + r.inputTokens,
            outputTokens: acc.outputTokens + r.outputTokens,
            costUsd: acc.costUsd + r.costUsd,
            costKnown: acc.costKnown && r.costKnown
        }),
        { feature: 'TOTAL', calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, costKnown: true }
    );
    return { rows: [...rows, total] };
}

/** Renders the dry-run plan as a markdown table. */
export function renderPlanMarkdown(input: { readonly rows: readonly PlanRow[] }): string {
    const lines = [
        '| feature | calls | input tok (approx) | output tok (cap) | worst case USD |',
        '| --- | --- | --- | --- | --- |'
    ];
    for (const r of input.rows) {
        const cost = `${r.costKnown ? '' : '>= '}$${r.costUsd.toFixed(4)}`;
        lines.push(
            `| ${r.feature} | ${r.calls} | ${r.inputTokens} | ${r.outputTokens} | ${cost} |`
        );
    }
    return lines.join('\n');
}

/** Raw result of one executed call (one JSONL line). */
export interface MigrationResult {
    readonly variantKey: string;
    readonly model: string;
    readonly effort: ReasoningEffort | null;
    readonly feature: MigrationFeature;
    readonly caseId: string;
    readonly repetition: number;
    readonly maxOutputTokens: number;
    /** The answer text (for object calls, the JSON of the object). */
    readonly text: string;
    /** Object calls only: the parsed object. */
    readonly object?: unknown;
    readonly finishReason: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens: number;
    readonly ttftMs: number | null;
    readonly latencyMs: number;
    readonly costUsd: number | null;
    readonly error: string | null;
    /** `null` for errored calls. */
    readonly outcome: CheckOutcome | null;
}

/**
 * Re-runs the automatic checks of stored results with the CURRENT checks, so a
 * check fix re-scores old answers. Results of unknown cases keep their outcome.
 */
export function recheckResults(input: {
    readonly results: readonly MigrationResult[];
    readonly cases: readonly RunnableCase[];
}): { readonly results: MigrationResult[] } {
    const byId = new Map(input.cases.map((c) => [c.id, c]));
    return {
        results: input.results.map((r) => {
            const c = byId.get(r.caseId);
            if (!c || r.error !== null) return r;
            return { ...r, outcome: c.check({ text: r.text, object: r.object }) };
        })
    };
}

/** Grades keyed by {@link resultKey} (re-exported for the report). */
export type GradeMap = Readonly<Record<string, Grade>>;

export { percentile, resultKey };
