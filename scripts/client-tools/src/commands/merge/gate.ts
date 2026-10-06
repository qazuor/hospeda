import type { PrSnapshot } from '../../lib/github.ts';
import { groupChecks, verdictOf } from '../ci/verdict.ts';

/**
 * What the gate concluded.
 *
 * `unknown` is not a soft `blocked`: it means GitHub never told us, and a
 * caller must be able to retry rather than go looking for a problem that was
 * never reported.
 */
export type MergeVerdict = 'ready' | 'blocked' | 'unknown';

/** The gate's answer: one verdict and the single reason for it. */
export interface MergeGateResult {
    /** The conclusion. */
    readonly verdict: MergeVerdict;
    /** The ONE reason, in the user's terms. Empty when ready. */
    readonly reason: string;
}

/** Branch every pull request is expected to target. */
export const EXPECTED_BASE = 'staging';

/**
 * Umbrella integration branches (`epic/**`, DEC-CI-001 in the root CLAUDE.md).
 *
 * A multi-epic program reaches `staging` as ONE unit through its umbrella, so
 * its leaf PRs legitimately target `epic/<name>` instead of the integration
 * base. The umbrella's own PR to `staging` still goes through the normal rule.
 * The name must have something after the slash: a bare `epic/` is no branch.
 */
const UMBRELLA_BASE = /^epic\/.+/;

/**
 * Whether a base branch is acceptable for a pull request.
 *
 * @param input.base - The PR's base branch.
 * @param input.expectedBase - The declared integration base.
 * @returns True for the integration base or an umbrella `epic/**` branch.
 */
function isAcceptedBase({
    base,
    expectedBase
}: {
    readonly base: string;
    readonly expectedBase: string;
}): boolean {
    return base === expectedBase || UMBRELLA_BASE.test(base);
}

/**
 * Decides whether a pull request may be merged.
 *
 * Rules are evaluated in order and the FIRST one that blocks is the only one
 * reported. A list of six problems is a list to triage; the first blocking
 * reason is the thing to go fix.
 *
 * The title is deliberately NOT checked here. The `Validate PR Title` workflow
 * already enforces it and its result arrives with the checks, so re-deriving
 * the rule would create a second source of truth that drifts the first time
 * somebody edits the workflow.
 *
 * @param input.pr - The pull request as GitHub reports it.
 * @returns The {@link MergeGateResult}.
 */
export function evaluateMergeGate({
    pr,
    expectedBase = EXPECTED_BASE
}: {
    readonly pr: PrSnapshot;
    readonly expectedBase?: string;
}): MergeGateResult {
    if (pr.state === 'MERGED') {
        return {
            verdict: 'blocked',
            reason: 'Ya está mergeado. Un commit nuevo acá queda huérfano: cortá branch nueva.'
        };
    }
    if (pr.state !== 'OPEN') {
        return { verdict: 'blocked', reason: `El PR está ${pr.state}, no abierto.` };
    }
    if (pr.isDraft) {
        return { verdict: 'blocked', reason: 'Es un draft. Sacalo de draft antes de mergear.' };
    }
    if (!isAcceptedBase({ base: pr.baseRefName, expectedBase })) {
        return {
            verdict: 'blocked',
            reason: `Apunta a «${pr.baseRefName}», no a «${expectedBase}». El trabajo debe entrar por la base de integración declarada; las promociones posteriores requieren una decisión explícita.`
        };
    }

    // Asked BEFORE the conflict and BEHIND rules, because those read the very
    // fields that are still UNKNOWN: GitHub computes mergeability lazily and
    // the first query returns UNKNOWN while it starts. Measured on this repo:
    // four of five open PRs answered UNKNOWN, and the next query resolved them
    // all. Treating that as mergeable is a fail-open; as a conflict, a lie.
    if (pr.mergeable === 'UNKNOWN' || pr.mergeStateStatus === 'UNKNOWN') {
        return {
            verdict: 'unknown',
            reason: 'GitHub todavía no calculó si el PR se puede mergear. Se resuelve reconsultando.'
        };
    }

    if (pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY') {
        return {
            verdict: 'blocked',
            reason: 'Tiene conflictos. Y ojo: GitHub no dispara workflows así, con lo cual los checks que se ven son de un push anterior.'
        };
    }
    if (pr.mergeStateStatus === 'BEHIND') {
        return {
            verdict: 'blocked',
            reason: 'La base avanzó y el PR quedó atrás. Los checks verdes son de OTRO merge-base: no dicen nada de lo que se mergearía. Actualizá la branch.'
        };
    }
    if (pr.mergeStateStatus === 'BLOCKED') {
        return {
            verdict: 'blocked',
            reason: 'GitHub lo marca BLOCKED: falta una revisión o una regla de protección.'
        };
    }

    // The checks are judged from the checks themselves, not from UNSTABLE:
    // that status says "not green" without saying whether something failed or
    // something is still running, and those need different answers.
    const checksVerdict = verdictOf({ checks: pr.checks });
    if (checksVerdict === 'no-checks') {
        return {
            verdict: 'blocked',
            reason: 'No hay ni un check. Cero checks no es que esté todo bien: es que no corrió nada.'
        };
    }
    if (checksVerdict === 'pending') {
        const { pending } = groupChecks({ checks: pr.checks });
        return {
            verdict: 'blocked',
            reason: `Todavía corren ${pending.length} checks. Esperalos con \`hops ci --wait\`.`
        };
    }
    if (checksVerdict === 'red') {
        const { failed } = groupChecks({ checks: pr.checks });
        const names = failed.map((check) => check.name).join(', ');
        return { verdict: 'blocked', reason: `Hay ${failed.length} check(s) en rojo: ${names}.` };
    }

    return { verdict: 'ready', reason: '' };
}

/**
 * The exit code for a verdict.
 *
 * `unknown` gets its own code for the same reason it does in `ci --wait`: not
 * knowing must never be reported as a decision.
 *
 * @param input.verdict - The gate's conclusion.
 * @returns The process exit code.
 */
export function exitCodeForGate({ verdict }: { readonly verdict: MergeVerdict }): number {
    if (verdict === 'ready') return 0;
    if (verdict === 'unknown') return 3;
    return 1;
}
