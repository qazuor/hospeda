/**
 * Declarations of the three HOS-1957 G7 cutover wrappers: `hops cutover-step-3b`,
 * `hops cutover-step-4c` and `hops cutover-step-5b`.
 *
 * Each wrapper runs an EXISTING `apps/api/scripts/*.ts` tool against the target
 * with the api container's environment, exactly like `hops cutover-step-3`. The
 * wrappers own no business logic: what a step does lives in its script and the
 * service it calls. What lives here is only the argv surface each wrapper
 * accepts, how it maps onto the script's own flags, and which phrase the prod
 * typed confirmation asks for.
 *
 * @module lib/cutover-wrapper-specs
 */

import type { Target } from './target.ts';

/** A flag the wrapper forwards verbatim (after validation) to the wrapped script. */
export interface PassThroughFlag {
    /** Flag name including dashes; always spelled `--name=value`. */
    readonly name: string;
    /** How many times the flag may appear. The script still validates its values. */
    readonly maxOccurrences: number;
    /**
     * `path`: the value is a file path, resolved to an absolute path against the
     * operator's cwd and checked for existence before anything else runs. The
     * script runs from `apps/api` (`pnpm --dir apps/api exec`), so a relative
     * path would otherwise resolve against the wrong directory.
     */
    readonly kind: 'value' | 'path';
}

/** Everything that distinguishes one cutover wrapper from another. */
export interface CutoverWrapperSpec {
    /** The `hops` command name. */
    readonly name: string;
    /** Script path relative to `apps/api`. */
    readonly script: string;
    /** The wrapper flag that selects the write mode. */
    readonly writeFlag: string;
    /** Extra wrapper flags that mean the same as `--dry-run`. */
    readonly dryRunAliases: readonly string[];
    /** The flag the script itself reads for the write mode. */
    readonly childWriteFlag: string;
    /** The exact phrase the operator must type before a prod write. */
    readonly prodPhrase: string;
    /** What the write does, for the warning printed before the prod prompt. */
    readonly writeDescription: string;
    /** Targets on which the write mode is refused outright, before any lookup. */
    readonly writeRefusedOn: readonly Target[];
    /** Why the write is refused on {@link writeRefusedOn}; printed with the refusal. */
    readonly writeRefusalReason?: string;
    /** Flags forwarded to the script. */
    readonly passThrough: readonly PassThroughFlag[];
}

/**
 * Step 3b: the two `permanent_grant` (B9a). Wraps
 * `apps/api/scripts/cutover-b9a-step-3b.ts`, whose parser
 * (`step-3b.args.ts`) validates the UUIDs, the two distinct beneficiaries and
 * `--includes-addons`. The wrapper only checks the flag names and counts.
 */
export const CUTOVER_STEP_3B_SPEC: CutoverWrapperSpec = {
    name: 'cutover-step-3b',
    script: 'scripts/cutover-b9a-step-3b.ts',
    writeFlag: '--confirm',
    dryRunAliases: [],
    childWriteFlag: '--confirm',
    prodPhrase: 'grant-permanent-prod',
    writeDescription: 'This run WRITES the two permanent grants to the PRODUCTION database.',
    writeRefusedOn: [],
    passThrough: [
        { name: '--actor-user-id', maxOccurrences: 1, kind: 'value' },
        { name: '--beneficiary', maxOccurrences: 2, kind: 'value' },
        { name: '--plan-id', maxOccurrences: 1, kind: 'value' },
        { name: '--floor-plan-version-id', maxOccurrences: 1, kind: 'value' },
        { name: '--includes-addons', maxOccurrences: 1, kind: 'value' }
    ]
};

/**
 * Step 4c: revalidate the public pages of the listings step 3 deleted. Wraps
 * `apps/api/scripts/cutover-v6-step-4c.ts` (`runStep4c`, which already batches
 * through `revalidateMany`). `--extra-tags-file` / `--extra-prefixes-file` are
 * forwarded for the extra-purge input the script is gaining in a parallel
 * change; until that lands the script refuses them as unknown flags.
 */
export const CUTOVER_STEP_4C_SPEC: CutoverWrapperSpec = {
    name: 'cutover-step-4c',
    script: 'scripts/cutover-v6-step-4c.ts',
    writeFlag: '--confirm-purge',
    dryRunAliases: [],
    childWriteFlag: '--confirm-purge',
    prodPhrase: 'purge-prod',
    writeDescription: 'This run PURGES the PRODUCTION edge cache for the deleted listings.',
    writeRefusedOn: [],
    passThrough: [
        { name: '--extra-tags-file', maxOccurrences: 1, kind: 'path' },
        { name: '--extra-prefixes-file', maxOccurrences: 1, kind: 'path' }
    ]
};

/**
 * Step 5b: delete the deleted listings' remote photos and revoke their
 * calendar tokens. Wraps `apps/api/scripts/cutover-v6-step-5b.ts`.
 *
 * List-only is the default (`--list-only` is accepted as an explicit alias of
 * `--dry-run`); `--execute` maps onto the script's `--confirm-delete-remote`.
 * The write is REFUSED on staging: the rehearsal DB is a copy of prod, so its
 * photo paths and calendar tokens are prod resources, and nothing in the repo
 * proves staging's media/Google credentials cannot reach them.
 */
export const CUTOVER_STEP_5B_SPEC: CutoverWrapperSpec = {
    name: 'cutover-step-5b',
    script: 'scripts/cutover-v6-step-5b.ts',
    writeFlag: '--execute',
    dryRunAliases: ['--list-only'],
    childWriteFlag: '--confirm-delete-remote',
    prodPhrase: 'delete-remote-prod',
    writeDescription:
        'This run DELETES remote photos and REVOKES calendar tokens of PRODUCTION. Irreversible.',
    writeRefusedOn: ['staging'],
    writeRefusalReason:
        '--execute is refused on staging: the rehearsal DB is a copy of prod, so its photos and calendar tokens are PROD resources. Run list-only there.',
    passThrough: []
};
