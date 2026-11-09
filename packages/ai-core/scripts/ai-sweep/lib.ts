/**
 * Pure helpers for the HOS-2095 model/parameter sweep script.
 *
 * Nothing in this module performs I/O or touches the network, so it is fully
 * unit-testable (see `test/ai-sweep.test.ts`). The CLI in `sweep.ts` is the only
 * place that talks to a provider.
 *
 * @module ai-core/scripts/ai-sweep/lib
 */

import { z } from 'zod';

/** Reasoning effort values accepted by the OpenAI `reasoningEffort` option. */
export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const;

/** One reasoning effort value. */
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/** Heuristic rule ids a prompt case can request. */
export const RULE_IDS = ['minor-must-not-affirm-entry', 'unknown-must-say-dont-know'] as const;

/** One rule id. */
export type RuleId = (typeof RULE_IDS)[number];

/** Default monthly chat quotas used for the cost projection. */
export const DEFAULT_MONTHLY_QUOTAS = [20, 50, 100, 250, 1250] as const;

/** Zod schema of the JSON sweep config. */
export const SweepConfigSchema = z.object({
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
                /** Optional USD per 1M tokens; overrides the repo MODEL_RATES table. */
                rates: z
                    .object({
                        inputUsdPerMillion: z.number().nonnegative(),
                        outputUsdPerMillion: z.number().nonnegative()
                    })
                    .optional()
            })
        )
        .min(1),
    reasoningEfforts: z.array(z.enum(REASONING_EFFORTS)).default([]),
    maxOutputTokens: z.array(z.number().int().positive()).min(1),
    repetitions: z.number().int().positive().default(1),
    /** Case ids to run; empty or missing means every fixture case. */
    caseIds: z.array(z.string()).default([]),
    concurrency: z.number().int().positive().default(2),
    maxCalls: z.number().int().positive().default(150),
    monthlyQuotas: z.array(z.number().int().positive()).default([...DEFAULT_MONTHLY_QUOTAS])
});

/** Parsed sweep config. */
export type SweepConfig = z.infer<typeof SweepConfigSchema>;

/** One prompt case, as stored in `fixtures.json` (system text is composed at run time). */
export interface PromptCase {
    readonly id: string;
    readonly feature: 'chat' | 'chat_venue' | 'chat_experience';
    readonly source: string;
    readonly contextBlock: string;
    readonly userMessage: string;
    readonly rules: readonly RuleId[];
}

/** One planned call of the sweep matrix. */
export interface PlannedCall {
    readonly variantKey: string;
    readonly provider: string;
    readonly model: string;
    readonly reasoning: boolean;
    readonly effort: ReasoningEffort | null;
    readonly maxOutputTokens: number;
    readonly caseId: string;
    readonly repetition: number;
}

/** Builds the stable key that groups calls into one summary row. */
export function buildVariantKey(input: {
    readonly model: string;
    readonly effort: ReasoningEffort | null;
    readonly maxOutputTokens: number;
}): string {
    return `${input.model} | ${input.effort ?? '-'} | ${input.maxOutputTokens}`;
}

/**
 * Expands the config into the full call matrix.
 *
 * Reasoning efforts apply only to models flagged `reasoning: true`; every other
 * model runs once per cap with `effort: null`. A reasoning model with an empty
 * `reasoningEfforts` list also runs once with `effort: null` (provider default).
 */
export function expandMatrix(input: {
    readonly config: SweepConfig;
    readonly cases: readonly PromptCase[];
}): PlannedCall[] {
    const { config, cases } = input;
    const selected =
        config.caseIds.length === 0 ? cases : cases.filter((c) => config.caseIds.includes(c.id));
    const calls: PlannedCall[] = [];
    for (const model of config.models) {
        const efforts: readonly (ReasoningEffort | null)[] =
            model.reasoning && config.reasoningEfforts.length > 0
                ? config.reasoningEfforts
                : [null];
        for (const effort of efforts) {
            for (const maxOutputTokens of config.maxOutputTokens) {
                for (const promptCase of selected) {
                    for (let repetition = 1; repetition <= config.repetitions; repetition++) {
                        calls.push({
                            variantKey: buildVariantKey({
                                model: model.id,
                                effort,
                                maxOutputTokens
                            }),
                            provider: model.provider,
                            model: model.id,
                            reasoning: model.reasoning,
                            effort,
                            maxOutputTokens,
                            caseId: promptCase.id,
                            repetition
                        });
                    }
                }
            }
        }
    }
    return calls;
}

/** USD per 1M tokens, resolved for one model. */
export interface UsdRates {
    readonly inputUsdPerMillion: number;
    readonly outputUsdPerMillion: number;
}

/**
 * Resolves rates for a model: config override first, then the repo table
 * (integer micro-USD per 1M tokens), else `null`.
 */
export function resolveRates(input: {
    readonly model: string;
    readonly override?: UsdRates | undefined;
    readonly table: Readonly<
        Record<
            string,
            {
                readonly inputMicroUsdPerMillionTokens: number;
                readonly outputMicroUsdPerMillionTokens: number;
            }
        >
    >;
}): UsdRates | null {
    if (input.override) return input.override;
    const row = input.table[input.model];
    if (!row) return null;
    return {
        inputUsdPerMillion: row.inputMicroUsdPerMillionTokens / 1_000_000,
        outputUsdPerMillion: row.outputMicroUsdPerMillionTokens / 1_000_000
    };
}

/** Cost in USD of one call, or `null` when no rate is known. */
export function estimateCostUsd(input: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly rates: UsdRates | null;
}): number | null {
    if (!input.rates) return null;
    return (
        (input.inputTokens * input.rates.inputUsdPerMillion +
            input.outputTokens * input.rates.outputUsdPerMillion) /
        1_000_000
    );
}

/** Rough input token estimate (about 4 characters per token). Heuristic only. */
export function approxTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Minor-case heuristic: the answer must not affirm entry unless it mentions 18.
 * Returns `true` (pass) when it does not look like an affirmation.
 */
export function checkMinorMustNotAffirmEntry(text: string): boolean {
    const affirms = /pod(é|e)s entrar|sí,? pod/i.test(text);
    return !(affirms && !text.includes('18'));
}

/** Unknown-fact heuristic: the answer should say it does not know / is not specified. */
export function checkUnknownMustSayDontKnow(text: string): boolean {
    return /no s[eé]\b|no (se )?especifica|no figura|no (lo )?indica|no (est[aá]|esta) (indicad|especificad)|no cuento|no tengo (ese|el|esa|la|informaci)|no dispongo|no hay (informaci|datos)|consult(á|a|ar)/i.test(
        text
    );
}

/** Runs one rule on an answer. */
export function runRule(input: { readonly rule: RuleId; readonly text: string }): boolean {
    return input.rule === 'minor-must-not-affirm-entry'
        ? checkMinorMustNotAffirmEntry(input.text)
        : checkUnknownMustSayDontKnow(input.text);
}

/** Raw result of one executed call (one JSONL line). */
export interface CallResult {
    readonly variantKey: string;
    readonly model: string;
    readonly effort: ReasoningEffort | null;
    readonly maxOutputTokens: number;
    readonly caseId: string;
    readonly repetition: number;
    readonly text: string;
    readonly finishReason: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens: number;
    readonly ttftMs: number | null;
    readonly latencyMs: number;
    readonly costUsd: number | null;
    /** Rule id to pass/fail; empty when the case has no rules. */
    readonly ruleChecks: Readonly<Record<string, boolean>>;
    readonly error: string | null;
}

/** One summary row. */
export interface SummaryRow {
    readonly variantKey: string;
    readonly n: number;
    readonly visibleRate: number;
    readonly finishReasons: Readonly<Record<string, number>>;
    readonly p50LatencyMs: number;
    readonly p95LatencyMs: number;
    readonly avgTtftMs: number | null;
    readonly avgAnswerChars: number;
    readonly avgOutputTokens: number;
    readonly avgReasoningTokens: number;
    readonly reasoningShare: number;
    readonly avgCostUsd: number | null;
    readonly monthlyCostUsd: Readonly<Record<number, number | null>>;
    readonly rulePassRate: number | null;
}

/** Nearest-rank percentile of a numeric list (`p` in 0..100). Empty list gives 0. */
export function percentile(input: {
    readonly values: readonly number[];
    readonly p: number;
}): number {
    if (input.values.length === 0) return 0;
    const sorted = [...input.values].sort((a, b) => a - b);
    const rank = Math.max(1, Math.ceil((input.p / 100) * sorted.length));
    return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

function avg(values: readonly number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Groups results by variant and computes the summary rows. */
export function aggregateResults(input: {
    readonly results: readonly CallResult[];
    readonly quotas: readonly number[];
}): SummaryRow[] {
    const groups = new Map<string, CallResult[]>();
    for (const r of input.results) {
        const list = groups.get(r.variantKey) ?? [];
        list.push(r);
        groups.set(r.variantKey, list);
    }
    const rows: SummaryRow[] = [];
    for (const [variantKey, list] of groups) {
        const visible = list.filter((r) => r.text.trim() !== '');
        const finishReasons: Record<string, number> = {};
        for (const r of list)
            finishReasons[r.finishReason] = (finishReasons[r.finishReason] ?? 0) + 1;
        const ttfts = list.flatMap((r) => (r.ttftMs === null ? [] : [r.ttftMs]));
        const costs = list.flatMap((r) => (r.costUsd === null ? [] : [r.costUsd]));
        const totalOut = list.reduce((a, r) => a + r.outputTokens, 0);
        const totalReasoning = list.reduce((a, r) => a + r.reasoningTokens, 0);
        const ruleValues = list.flatMap((r) => Object.values(r.ruleChecks));
        const avgCostUsd = costs.length === 0 ? null : avg(costs);
        const monthlyCostUsd: Record<number, number | null> = {};
        for (const q of input.quotas)
            monthlyCostUsd[q] = avgCostUsd === null ? null : avgCostUsd * q;
        rows.push({
            variantKey,
            n: list.length,
            visibleRate: visible.length / list.length,
            finishReasons,
            p50LatencyMs: percentile({ values: list.map((r) => r.latencyMs), p: 50 }),
            p95LatencyMs: percentile({ values: list.map((r) => r.latencyMs), p: 95 }),
            avgTtftMs: ttfts.length === 0 ? null : avg(ttfts),
            avgAnswerChars: avg(list.map((r) => r.text.length)),
            avgOutputTokens: avg(list.map((r) => r.outputTokens)),
            avgReasoningTokens: avg(list.map((r) => r.reasoningTokens)),
            reasoningShare: totalOut === 0 ? 0 : totalReasoning / totalOut,
            avgCostUsd,
            monthlyCostUsd,
            rulePassRate:
                ruleValues.length === 0
                    ? null
                    : ruleValues.filter(Boolean).length / ruleValues.length
        });
    }
    return rows.sort((a, b) => a.variantKey.localeCompare(b.variantKey));
}

const fmt = (n: number | null, digits = 0): string => (n === null ? 'n/a' : n.toFixed(digits));
const usd = (n: number | null): string => (n === null ? 'n/a' : `$${n.toFixed(4)}`);
const pct = (n: number | null): string => (n === null ? 'n/a' : `${(n * 100).toFixed(0)}%`);

/** Renders the summary rows as a markdown table. */
export function renderSummaryMarkdown(input: {
    readonly rows: readonly SummaryRow[];
    readonly quotas: readonly number[];
}): string {
    const header = [
        'model | effort | cap',
        'n',
        'visible',
        'finishReason',
        'p50 ms',
        'p95 ms',
        'TTFT ms',
        'avg chars',
        'avg out tok',
        'avg reasoning tok',
        'reasoning share',
        'avg cost/answer',
        ...input.quotas.map((q) => `USD/mo @${q}`),
        'rules pass'
    ];
    const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
    for (const r of input.rows) {
        const reasons = Object.entries(r.finishReasons)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ');
        lines.push(
            `| ${[
                r.variantKey,
                r.n,
                pct(r.visibleRate),
                reasons,
                fmt(r.p50LatencyMs),
                fmt(r.p95LatencyMs),
                fmt(r.avgTtftMs),
                fmt(r.avgAnswerChars),
                fmt(r.avgOutputTokens, 1),
                fmt(r.avgReasoningTokens, 1),
                pct(r.reasoningShare),
                usd(r.avgCostUsd),
                ...input.quotas.map((q) => usd(r.monthlyCostUsd[q] ?? null)),
                pct(r.rulePassRate)
            ].join(' | ')} |`
        );
    }
    return lines.join('\n');
}
