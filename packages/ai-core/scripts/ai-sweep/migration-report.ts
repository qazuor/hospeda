/**
 * Per-feature and overall reports of the model-migration sweep (HOS-2217).
 * Pure: no I/O.
 *
 * @module ai-core/scripts/ai-sweep/migration-report
 */

import {
    type GradeMap,
    MIGRATION_FEATURES,
    type MigrationConfig,
    type MigrationFeature,
    type MigrationResult,
    percentile,
    resultKey
} from './migration-lib.js';

/** One row per feature x variant. */
export interface FeatureRow {
    readonly feature: MigrationFeature;
    readonly variantKey: string;
    readonly n: number;
    readonly errors: number;
    readonly errorRate: number;
    /** Mean share of passed checks over answered calls. */
    readonly passRate: number | null;
    /** Share of calls whose every check passed; errored calls count as failures. */
    readonly effectivePassRate: number;
    readonly schemaValidRate: number | null;
    readonly productionAcceptRate: number | null;
    /** Calls that ended on finishReason `length` (hit the output cap). */
    readonly truncated: number;
    readonly p50LatencyMs: number;
    readonly p95LatencyMs: number;
    readonly p50TtftMs: number | null;
    readonly avgOutputTokens: number;
    readonly avgReasoningTokens: number;
    readonly avgCostUsd: number | null;
    readonly monthlyCostUsd: number | null;
    /** Cost per answer x each configured monthly quota (`config.monthlyQuotas`). */
    readonly quotaCostUsd: Readonly<Record<number, number | null>>;
    readonly avgScore: number | null;
    readonly gradedCount: number;
    /** Check names that failed most often (top 3, with counts). */
    readonly topFailures: readonly string[];
}

/** One row per variant across every feature. */
export interface OverallRow {
    readonly variantKey: string;
    readonly features: number;
    readonly n: number;
    readonly errorRate: number;
    /** Unweighted mean of the per-feature pass rates (each feature weighs the same). */
    readonly meanPassRate: number | null;
    readonly meanEffectivePassRate: number;
    readonly worstFeature: string;
    readonly monthlyCostUsd: number | null;
    /** Monthly cost relative to the baseline variant (first config model). */
    readonly costVsBaseline: number | null;
    readonly worstP95LatencyMs: number;
    readonly avgScore: number | null;
}

const mean = (values: readonly number[]): number | null =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

const rate = (values: readonly (boolean | null)[]): number | null => {
    const defined = values.filter((v): v is boolean => v !== null);
    return defined.length === 0 ? null : defined.filter(Boolean).length / defined.length;
};

/**
 * Groups results by feature and variant and computes both reports.
 *
 * @param input.results - Executed calls.
 * @param input.config - The migration config (volumes, baseline order).
 * @param input.grades - Optional blind grades keyed by result key.
 * @returns `{ featureRows, overallRows }`, in config/feature order.
 */
export function aggregateMigration(input: {
    readonly results: readonly MigrationResult[];
    readonly config: MigrationConfig;
    readonly grades?: GradeMap | undefined;
}): {
    readonly featureRows: FeatureRow[];
    readonly overallRows: OverallRow[];
    readonly quotas: readonly number[];
} {
    const groups = new Map<string, MigrationResult[]>();
    for (const r of input.results) {
        const key = `${r.feature}||${r.variantKey}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const featureRows: FeatureRow[] = [];
    for (const [key, list] of groups) {
        const [feature, variantKey] = key.split('||') as [MigrationFeature, string];
        const answered = list.filter((r) => r.error === null && r.outcome !== null);
        const outcomes = answered.flatMap((r) => (r.outcome ? [r.outcome] : []));
        const costs = list.flatMap((r) => (r.costUsd === null ? [] : [r.costUsd]));
        const ttfts = list.flatMap((r) => (r.ttftMs === null ? [] : [r.ttftMs]));
        const latencies = list.map((r) => r.latencyMs);
        const scores = list.flatMap((r) => {
            const g = input.grades?.[resultKey(r)];
            return g ? [g.score] : [];
        });
        const failures = new Map<string, number>();
        for (const o of outcomes) {
            for (const [name, ok] of Object.entries(o.checks)) {
                if (!ok) failures.set(name, (failures.get(name) ?? 0) + 1);
            }
        }
        const avgCostUsd = mean(costs);
        const volume = input.config.features[feature]?.monthlyCalls ?? null;
        const errors = list.length - answered.length;
        featureRows.push({
            feature,
            variantKey,
            n: list.length,
            errors,
            errorRate: errors / list.length,
            passRate: mean(outcomes.flatMap((o) => (o.passRate === null ? [] : [o.passRate]))),
            effectivePassRate: outcomes.filter((o) => o.allPass).length / list.length,
            schemaValidRate: rate(outcomes.map((o) => o.schemaValid)),
            productionAcceptRate: rate(outcomes.map((o) => o.productionAccepts)),
            truncated: list.filter((r) => r.finishReason === 'length').length,
            p50LatencyMs: percentile({ values: latencies, p: 50 }),
            p95LatencyMs: percentile({ values: latencies, p: 95 }),
            p50TtftMs: ttfts.length === 0 ? null : percentile({ values: ttfts, p: 50 }),
            avgOutputTokens: mean(list.map((r) => r.outputTokens)) ?? 0,
            avgReasoningTokens: mean(list.map((r) => r.reasoningTokens)) ?? 0,
            avgCostUsd,
            monthlyCostUsd: avgCostUsd === null || volume === null ? null : avgCostUsd * volume,
            quotaCostUsd: Object.fromEntries(
                input.config.monthlyQuotas.map((q) => [
                    q,
                    avgCostUsd === null ? null : avgCostUsd * q
                ])
            ),
            avgScore: mean(scores),
            gradedCount: scores.length,
            topFailures: [...failures.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => `${name} (${count})`)
        });
    }
    const featureOrder = (f: MigrationFeature) => MIGRATION_FEATURES.indexOf(f);
    const variantOrder = [...new Set(input.results.map((r) => r.variantKey))];
    featureRows.sort(
        (a, b) =>
            featureOrder(a.feature) - featureOrder(b.feature) ||
            variantOrder.indexOf(a.variantKey) - variantOrder.indexOf(b.variantKey)
    );

    const overallRows: OverallRow[] = variantOrder.map((variantKey) => {
        const rows = featureRows.filter((r) => r.variantKey === variantKey);
        const n = rows.reduce((a, r) => a + r.n, 0);
        const costs = rows.map((r) => r.monthlyCostUsd);
        const worst = [...rows].sort((a, b) => a.effectivePassRate - b.effectivePassRate)[0];
        const scores = input.results.flatMap((r) => {
            const g = r.variantKey === variantKey ? input.grades?.[resultKey(r)] : undefined;
            return g ? [g.score] : [];
        });
        return {
            variantKey,
            features: rows.length,
            n,
            errorRate: n === 0 ? 0 : rows.reduce((a, r) => a + r.errors, 0) / n,
            meanPassRate: mean(rows.flatMap((r) => (r.passRate === null ? [] : [r.passRate]))),
            meanEffectivePassRate: mean(rows.map((r) => r.effectivePassRate)) ?? 0,
            worstFeature: worst ? `${worst.feature} (${pct(worst.effectivePassRate)})` : 'n/a',
            monthlyCostUsd: costs.some((c) => c === null)
                ? null
                : costs.reduce<number>((a, c) => a + (c ?? 0), 0),
            costVsBaseline: null,
            worstP95LatencyMs: Math.max(0, ...rows.map((r) => r.p95LatencyMs)),
            avgScore: mean(scores)
        };
    });
    const baselineCost = overallRows[0]?.monthlyCostUsd ?? null;
    return {
        featureRows,
        quotas: input.config.monthlyQuotas,
        overallRows: overallRows.map((r) => ({
            ...r,
            costVsBaseline:
                r.monthlyCostUsd === null || baselineCost === null || baselineCost === 0
                    ? null
                    : r.monthlyCostUsd / baselineCost
        }))
    };
}

const pct = (n: number | null): string => (n === null ? 'n/a' : `${(n * 100).toFixed(0)}%`);
const usd = (n: number | null, digits = 4): string =>
    n === null ? 'n/a' : `$${n.toFixed(digits)}`;
const fmt = (n: number | null, digits = 0): string => (n === null ? 'n/a' : n.toFixed(digits));

/**
 * Renders the overall summary plus one table per feature.
 *
 * @param input.featureRows - From {@link aggregateMigration}.
 * @param input.overallRows - From {@link aggregateMigration}.
 * @returns Markdown.
 */
export function renderMigrationReport(input: {
    readonly featureRows: readonly FeatureRow[];
    readonly overallRows: readonly OverallRow[];
    readonly quotas?: readonly number[];
}): string {
    const out: string[] = [
        '## Overall (every feature weighs the same; the first variant is the baseline)',
        '',
        '| variant | features | calls | error rate | mean pass | mean all-pass | worst feature | USD/month | cost vs baseline | worst p95 ms | avg grade |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    ];
    for (const r of input.overallRows) {
        out.push(
            `| ${[
                r.variantKey.replaceAll('|', '/'),
                r.features,
                r.n,
                pct(r.errorRate),
                pct(r.meanPassRate),
                pct(r.meanEffectivePassRate),
                r.worstFeature,
                usd(r.monthlyCostUsd, 2),
                r.costVsBaseline === null ? 'n/a' : `${r.costVsBaseline.toFixed(2)}x`,
                fmt(r.worstP95LatencyMs),
                fmt(r.avgScore, 2)
            ].join(' | ')} |`
        );
    }
    const quotas = input.quotas ?? [];
    if (quotas.length > 0) {
        out.push(
            '',
            '## Quota projection (cost per answer x monthly answers per account)',
            '',
            `| feature | variant | ${quotas.map((q) => `USD/mo @${q}`).join(' | ')} |`,
            `| --- | --- | ${quotas.map(() => '---').join(' | ')} |`
        );
        for (const r of input.featureRows) {
            out.push(
                `| ${[
                    r.feature,
                    r.variantKey.replaceAll('|', '/'),
                    ...quotas.map((q) => usd(r.quotaCostUsd[q] ?? null, 4))
                ].join(' | ')} |`
            );
        }
    }
    const features = [...new Set(input.featureRows.map((r) => r.feature))];
    for (const feature of features) {
        out.push(
            '',
            `## ${feature}`,
            '',
            '| variant | n | errors | pass | all-pass | schema ok | prod accepts | truncated | p50 ms | p95 ms | TTFT p50 | avg out tok | avg reasoning tok | cost/answer | USD/month | avg grade | top failures |',
            '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
        );
        for (const r of input.featureRows.filter((x) => x.feature === feature)) {
            out.push(
                `| ${[
                    r.variantKey.replaceAll('|', '/'),
                    r.n,
                    `${r.errors} (${pct(r.errorRate)})`,
                    pct(r.passRate),
                    pct(r.effectivePassRate),
                    pct(r.schemaValidRate),
                    pct(r.productionAcceptRate),
                    r.truncated,
                    fmt(r.p50LatencyMs),
                    fmt(r.p95LatencyMs),
                    fmt(r.p50TtftMs),
                    fmt(r.avgOutputTokens, 1),
                    fmt(r.avgReasoningTokens, 1),
                    usd(r.avgCostUsd, 5),
                    usd(r.monthlyCostUsd, 2),
                    `${fmt(r.avgScore, 2)} (${r.gradedCount})`,
                    r.topFailures.join('; ').replaceAll('|', '/') || '-'
                ].join(' | ')} |`
            );
        }
    }
    return out.join('\n');
}
