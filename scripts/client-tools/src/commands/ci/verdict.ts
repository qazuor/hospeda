/** One check as GitHub reports it. */
export interface RawCheck {
    /** Check name. */
    readonly name?: string;
    /** `QUEUED` / `IN_PROGRESS` / `COMPLETED` for check runs. */
    readonly status?: string | null;
    /**
     * Outcome once completed.
     *
     * Empty string, not null, while a check is pending — which is exactly how a
     * `// null` fallback in a jq filter lets a pending run read as passing.
     */
    readonly conclusion?: string | null;
    /** Commit statuses use `state` instead of `conclusion`. */
    readonly state?: string | null;
}

/** How one check ended up. */
export type CheckOutcome = 'passed' | 'failed' | 'pending';

/** A check, classified. */
export interface Check {
    /** Check name. */
    readonly name: string;
    /** Its outcome. */
    readonly outcome: CheckOutcome;
    /** The raw conclusion, for display. */
    readonly detail: string;
}

/** Conclusions that mean the check is genuinely red. */
const FAILING = new Set([
    'FAILURE',
    'TIMED_OUT',
    'CANCELLED',
    'ACTION_REQUIRED',
    'STARTUP_FAILURE',
    'STALE',
    'ERROR'
]);

/** Conclusions that are not failures. A skipped job is not a red one. */
const PASSING = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL', 'EXPECTED']);

/**
 * Classifies one check.
 *
 * A missing or EMPTY conclusion means pending, never passing. GitHub returns
 * `""` rather than null while a run is in flight, so any check that treats
 * "falsy" as "no problem" reports seven queued jobs as green.
 *
 * @param input.raw - The check as reported.
 * @returns The classified {@link Check}.
 */
export function classifyCheck({ raw }: { readonly raw: RawCheck }): Check {
    const name = raw.name ?? '(sin nombre)';
    const verdict = (raw.conclusion ?? raw.state ?? '').toUpperCase();

    if (verdict === '') return { name, outcome: 'pending', detail: raw.status ?? 'PENDIENTE' };
    if (FAILING.has(verdict)) return { name, outcome: 'failed', detail: verdict };
    if (PASSING.has(verdict)) return { name, outcome: 'passed', detail: verdict };
    // An unknown verdict is not assumed good: a value nobody anticipated is a
    // reason to look, not to wave through.
    return { name, outcome: 'pending', detail: verdict };
}

/** The overall answer. */
export type Verdict = 'green' | 'red' | 'pending' | 'no-checks' | 'conflict';

/** Everything needed to report on a pull request. */
export interface PrStatus {
    /** Pull request number. */
    readonly number: number;
    /** `OPEN` / `MERGED` / `CLOSED`. */
    readonly state: string;
    /** `MERGEABLE` / `CONFLICTING` / `UNKNOWN`. */
    readonly mergeable: string;
    /** Every check, classified. */
    readonly checks: readonly Check[];
}

/**
 * Reduces the checks to one answer.
 *
 * Failures win over pending: a run still going does not soften one that already
 * broke. And "no checks at all" is its own answer, never green — a pull request
 * with a conflict never triggers a workflow, so zero checks means nothing ran,
 * not that everything passed.
 *
 * @param input.checks - Classified checks.
 * @returns The overall {@link Verdict}.
 */
export function verdictOf({ checks }: { readonly checks: readonly Check[] }): Verdict {
    if (checks.length === 0) return 'no-checks';
    if (checks.some((check) => check.outcome === 'failed')) return 'red';
    if (checks.some((check) => check.outcome === 'pending')) return 'pending';
    return 'green';
}

/**
 * The answer, combining the checks with the pull request's own state.
 *
 * @param input.status - The pull request's status.
 * @returns The overall {@link Verdict}.
 */
export function overallVerdict({ status }: { readonly status: PrStatus }): Verdict {
    // A conflicted pull request can NEVER be green, whatever its checks say.
    // GitHub does not dispatch `pull_request` workflows while it conflicts, so
    // every check on screen belongs to an earlier push — green for code that is
    // not what would merge. Reporting that as "verde" is the precise failure
    // this command exists to prevent.
    if (status.mergeable === 'CONFLICTING') return 'conflict';
    return verdictOf({ checks: status.checks });
}

/**
 * Explains why the answer is not simply "green", in the user's terms.
 *
 * @param input.status - The pull request's status.
 * @returns One line, or `null` when there is nothing extra to say.
 */
export function explainVerdict({ status }: { readonly status: PrStatus }): string | null {
    if (status.mergeable === 'CONFLICTING') {
        // A conflicted PR never dispatches `pull_request` workflows: there are
        // no checks because nothing ran, and a push "succeeds" perfectly while
        // CI never starts.
        return (
            'El PR tiene conflictos. GitHub no dispara los workflows así, ' +
            'y los checks que ves son de un push anterior: no dicen nada del código que se mergearía.'
        );
    }
    if (status.state === 'MERGED') {
        return 'El PR ya está mergeado. Cualquier commit nuevo en esta branch no tiene dónde revisarse: cortá una branch nueva.';
    }
    if (status.state === 'CLOSED') {
        return 'El PR está cerrado.';
    }
    if (verdictOf({ checks: status.checks }) === 'no-checks') {
        return 'No hay ni un check. O CI todavía no arrancó, o nunca se disparó para este PR.';
    }
    return null;
}

/**
 * Splits checks by outcome, preserving order within each group.
 *
 * @param input.checks - Classified checks.
 * @returns The three groups.
 */
export function groupChecks({ checks }: { readonly checks: readonly Check[] }): {
    readonly failed: readonly Check[];
    readonly pending: readonly Check[];
    readonly passed: readonly Check[];
} {
    return {
        failed: checks.filter((check) => check.outcome === 'failed'),
        pending: checks.filter((check) => check.outcome === 'pending'),
        passed: checks.filter((check) => check.outcome === 'passed')
    };
}
