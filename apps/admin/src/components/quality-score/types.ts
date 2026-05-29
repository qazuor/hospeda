import type { TranslationKey } from '@repo/i18n';

/**
 * Outcome of a single signal check against the entity / form state.
 *
 * - `done`:      the goal is met (counts toward score).
 * - `pending`:   the goal is not met (counts against score).
 * - `premium`:   the goal is gated behind a plan feature the user lacks;
 *                it never affects the score but surfaces in the popover
 *                as an honest upsell ("Llevalo más lejos").
 */
export type SignalStatus = 'done' | 'pending' | 'premium';

/**
 * Reasons exposed in the popover next to a pending signal so the host
 * understands WHY a signal is not "done" yet without re-reading the spec.
 * Optional — `undefined` falls back to the signal's generic label.
 */
export interface SignalHint {
    /** Short i18n key explaining what's still missing. */
    readonly key: TranslationKey;
    /** Optional interpolation params (e.g. counts, thresholds). */
    readonly params?: Readonly<Record<string, string | number>>;
}

/**
 * Static configuration for one quality signal.
 *
 * The signal is **config-driven**: each entity declares its own set in
 * `features/<entity>/config/score-signals.ts`. The engine never knows the
 * entity shape — `check` is opaque to it.
 */
export interface SignalConfig<TEntity extends Record<string, unknown>> {
    /** Stable id (used as React key and for telemetry). */
    readonly id: string;
    /** i18n key for the signal label shown in all three groups. */
    readonly labelKey: TranslationKey;
    /**
     * Weight in the normalized score. Heavier signals impact the score more
     * (per spec §4.9 fotos/precio/descripción should weigh more). Must be > 0.
     */
    readonly weight: number;
    /**
     * Accordion section id this signal belongs to. Clicking the "Para mejorar"
     * row opens that section and scrolls to it.
     */
    readonly sectionId: string;
    /**
     * Pure check function. Returns the current evaluation given the entity
     * snapshot (in view) or the live form values (in edit). MUST NOT call
     * any side effect — the engine reads it many times per second while
     * the host is typing.
     */
    readonly check: (entity: TEntity) => Omit<SignalEvaluation, 'config'>;
}

/**
 * Result of running a signal's `check` once.
 *
 * - `status`:   classification used to bucket the signal in the popover.
 * - `progress`: optional 0-1 fraction for signals with a count target
 *               (e.g. ≥5 fotos when only 2 are loaded → progress 0.4).
 *               Used to render an in-row progress hint AND to award partial
 *               credit so the score grows as soon as the host adds the
 *               first photo (motivational, per spec).
 * - `hint`:    optional in-popover explanation of what's missing.
 */
export interface SignalEvaluation {
    readonly status: SignalStatus;
    readonly progress?: number;
    readonly hint?: SignalHint;
    /** Populated by the engine — callers do not set this. */
    readonly config?: SignalConfig<Record<string, unknown>>;
}

/**
 * One evaluated signal as exposed by the engine to the UI.
 */
export interface EvaluatedSignal {
    readonly id: string;
    readonly labelKey: TranslationKey;
    readonly weight: number;
    readonly sectionId: string;
    readonly status: SignalStatus;
    readonly progress?: number;
    readonly hint?: SignalHint;
}

/**
 * Bucketed signals + the final 0-100 score returned by the engine.
 *
 * The score is computed ONLY over non-premium signals:
 *   score = round(100 * sum(weight × progress) / sum(weight))
 * Premium signals are surfaced in `premium[]` but excluded from the math
 * (spec §4.9 — "Premium no penaliza").
 */
export interface ScoreResult {
    /** Integer 0..100. */
    readonly score: number;
    /** Signals classified `done` (✓). */
    readonly done: readonly EvaluatedSignal[];
    /** Signals classified `pending` (✗) — surfaced as "Para mejorar". */
    readonly pending: readonly EvaluatedSignal[];
    /** Signals classified `premium` — surfaced as the disabled upsell group. */
    readonly premium: readonly EvaluatedSignal[];
}
