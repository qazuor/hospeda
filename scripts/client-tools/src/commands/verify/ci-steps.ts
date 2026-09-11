/** One executable step lifted from the CI workflow. */
export interface CiStep {
    /** Job it belongs to. */
    readonly job: string;
    /** The step's own name, as CI shows it. */
    readonly name: string;
    /** Shell command CI runs. */
    readonly run: string;
}

/** A step that cannot run here, and why. */
export interface SkippedStep {
    /** Job it belongs to. */
    readonly job: string;
    /** The step's name. */
    readonly name: string;
    /** Why it was left out. */
    readonly reason: string;
}

/** What the workflow yielded. */
export interface CiPlan {
    /** Steps that can run on this machine. */
    readonly steps: readonly CiStep[];
    /** Steps deliberately left out. */
    readonly skipped: readonly SkippedStep[];
}

interface RawWorkflow {
    readonly jobs?: Record<string, { readonly steps?: readonly RawStep[] } | undefined>;
}

interface RawStep {
    readonly name?: string;
    readonly run?: string;
}

/**
 * Steps whose command is meaningful in CI but not on a developer's machine.
 *
 * Matched on the command, not the step name: names get reworded, commands do
 * not. Anything not listed here runs — the default has to be "run it", or this
 * list quietly becomes the reason local passes and CI does not.
 */
const NOT_LOCAL = [
    { pattern: /resolve-ci-baseline/, reason: 'resuelve el baseline del runner de CI' },
    { pattern: /bun install --frozen-lockfile/, reason: 'instala dependencias del runner' },
    { pattern: /actions\/|::error::.*\$\{\{/, reason: 'sintaxis de GitHub Actions' }
] as const;

/**
 * Extracts the runnable steps of the named jobs from a CI workflow.
 *
 * Reading the workflow is the whole point: a local list of guards is a second
 * source of truth, and the moment CI gains a check the two disagree — which is
 * exactly the situation where "verifiqué" stops meaning anything.
 *
 * @param input.yaml - Raw contents of the workflow file.
 * @param input.jobs - Job ids to take steps from, in order.
 * @returns The runnable steps and the ones left out.
 */
export function planFromWorkflow({
    yaml,
    jobs
}: {
    readonly yaml: string;
    readonly jobs: readonly string[];
}): CiPlan {
    let parsed: RawWorkflow;
    try {
        parsed = Bun.YAML.parse(yaml) as RawWorkflow;
    } catch {
        return { steps: [], skipped: [] };
    }

    const steps: CiStep[] = [];
    const skipped: SkippedStep[] = [];

    for (const job of jobs) {
        for (const raw of parsed.jobs?.[job]?.steps ?? []) {
            const run = raw.run?.trim();
            if (run === undefined || run.length === 0) continue;
            const name = raw.name ?? run.split('\n')[0] ?? job;

            // A GitHub expression cannot be evaluated here at all: running it
            // would execute a literal `${{ ... }}` string.
            if (run.includes('${{')) {
                skipped.push({ job, name, reason: 'usa expresiones de GitHub Actions' });
                continue;
            }
            const excluded = NOT_LOCAL.find((entry) => entry.pattern.test(run));
            if (excluded !== undefined) {
                skipped.push({ job, name, reason: excluded.reason });
                continue;
            }
            steps.push({ job, name, run });
        }
    }
    return { steps, skipped };
}

/**
 * Groups steps by the job they came from, preserving order.
 *
 * @param input.steps - Steps to group.
 * @returns One entry per job, in first-seen order.
 */
export function groupByJob({
    steps
}: {
    readonly steps: readonly CiStep[];
}): readonly { readonly job: string; readonly steps: readonly CiStep[] }[] {
    const order: string[] = [];
    const byJob = new Map<string, CiStep[]>();
    for (const step of steps) {
        if (!byJob.has(step.job)) {
            byJob.set(step.job, []);
            order.push(step.job);
        }
        byJob.get(step.job)?.push(step);
    }
    return order.map((job) => ({ job, steps: byJob.get(job) ?? [] }));
}
