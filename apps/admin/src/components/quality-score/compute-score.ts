import type { EvaluatedSignal, ScoreResult, SignalConfig } from './types';

/**
 * Evaluate a list of quality signals against the current entity (or live
 * form values) and return the score plus its breakdown.
 *
 * Pure function — given the same inputs, returns the same output. Safe to
 * call on every render of the form provider in edit mode.
 *
 * **Scoring rule** (per spec §4.9):
 * - Only non-premium signals contribute to the denominator. Premium signals
 *   never lower the score, regardless of their `check` result.
 * - When a signal returns a `progress` value (0..1) we award partial credit
 *   so the bar grows as the host adds the first photo, types the first
 *   character of the description, etc. Signals without `progress` count
 *   binary: `done` = 1, `pending` = 0.
 * - Weights are relative within the entity (not absolute) — they normalize
 *   by `sum(weight)` so the engine doesn't care if the host wires 9 or 90
 *   signals.
 *
 * @param signals  Static config list for the entity.
 * @param entity   Snapshot of the entity (or live form values in edit).
 * @returns        Score in 0..100 plus the three groups for the popover.
 */
export function computeScore<TEntity extends Record<string, unknown>>(
    signals: readonly SignalConfig<TEntity>[],
    entity: TEntity
): ScoreResult {
    if (signals.length === 0) {
        return { score: 0, done: [], pending: [], premium: [] };
    }

    const done: EvaluatedSignal[] = [];
    const pending: EvaluatedSignal[] = [];
    const premium: EvaluatedSignal[] = [];

    let weightSum = 0;
    let weightedAchieved = 0;

    for (const signal of signals) {
        const evaluation = signal.check(entity);
        const evaluated: EvaluatedSignal = {
            id: signal.id,
            labelKey: signal.labelKey,
            weight: signal.weight,
            sectionId: signal.sectionId,
            status: evaluation.status,
            progress: evaluation.progress,
            hint: evaluation.hint
        };

        if (evaluation.status === 'premium') {
            premium.push(evaluated);
            continue;
        }

        weightSum += signal.weight;
        if (evaluation.status === 'done') {
            weightedAchieved += signal.weight;
            done.push(evaluated);
        } else {
            // Pending — but may have partial progress for ranged signals.
            const progress = clampProgress(evaluation.progress);
            weightedAchieved += signal.weight * progress;
            pending.push(evaluated);
        }
    }

    const score = weightSum > 0 ? Math.round((weightedAchieved / weightSum) * 100) : 0;
    return { score, done, pending, premium };
}

function clampProgress(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}
