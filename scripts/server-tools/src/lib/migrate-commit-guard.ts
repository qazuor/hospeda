/**
 * Commit-equality guard for `hops db-migrate` (HOS-1957 G4).
 *
 * Cutover step 3 migrates "on the same commit as the new image": whoever
 * migrates reads its own copy of the code on the VPS checkout, so a checkout
 * that is not the commit Coolify will build applies a different migration set
 * than the image expects. This module refuses to continue in that case.
 *
 * Where the expected commit comes from: NOT from the api container. At act (b)
 * the old app is already stopped and the new image is not running yet, so any
 * container still exposing `HOSPEDA_COMMIT_SHA` / `SOURCE_COMMIT` carries the
 * OLD commit. The operator passes the commit the image will be built from
 * (`--expect-commit=<sha>`) and this guard compares it with the checkout HEAD.
 *
 * Everything here is pure or takes injected dependencies: no git, no Docker.
 */

/** Minimum length of an expected commit, matching `cutover-step-3`'s 10-char prefix. */
export const MIN_EXPECTED_COMMIT_LENGTH = 10;

/** Result of {@link checkMigrateCommit}. */
export type MigrateCommitCheck =
    | { readonly ok: true }
    | { readonly ok: false; readonly message: string };

/** Input for {@link checkMigrateCommit}. */
export interface CheckMigrateCommitInput {
    /** `git rev-parse HEAD` in the checkout that will migrate (full SHA). */
    readonly checkoutSha: string;
    /** Commit the image to be deployed is built from, as given by the operator. */
    readonly expectedCommit: string | undefined;
}

const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * Compare the checkout HEAD with the commit the image will be built from.
 *
 * Fail closed: a missing, blank, `unknown`, non-hex or too-short expected
 * commit is refused, as is an unreadable checkout SHA. An abbreviated expected
 * commit (at least {@link MIN_EXPECTED_COMMIT_LENGTH} hex chars) matches by
 * prefix, case-insensitively.
 *
 * @param input - Checkout SHA and expected commit.
 * @returns `{ ok: true }` or `{ ok: false, message }` naming both SHAs.
 */
export function checkMigrateCommit(input: CheckMigrateCommitInput): MigrateCommitCheck {
    const checkout = input.checkoutSha.trim().toLowerCase();
    const expected = input.expectedCommit?.trim().toLowerCase();

    if (expected === undefined || expected.length === 0 || expected === 'unknown') {
        return {
            ok: false,
            message: `Cannot verify the image commit: no expected commit was given. Checkout HEAD is ${checkout || '<unreadable>'}. Pass --expect-commit=<sha> (the commit Coolify will build). Nothing was applied.`
        };
    }
    if (expected.length < MIN_EXPECTED_COMMIT_LENGTH || !HEX_PATTERN.test(expected)) {
        return {
            ok: false,
            message: `Expected commit '${input.expectedCommit}' is not a SHA of at least ${MIN_EXPECTED_COMMIT_LENGTH} hex characters. Nothing was applied.`
        };
    }
    if (checkout.length === 0 || !HEX_PATTERN.test(checkout)) {
        return {
            ok: false,
            message: `Cannot read the checkout HEAD (got '${checkout}'). Expected image commit is ${expected}. Nothing was applied.`
        };
    }
    if (checkout.startsWith(expected)) return { ok: true };

    return {
        ok: false,
        message: `Checkout HEAD ${checkout} is NOT the image commit ${expected}. Align the checkout to the commit Coolify will build, then retry. Nothing was applied.`
    };
}

/** Input for {@link runMigratePullPhase}. */
export interface RunMigratePullPhaseInput {
    /** A `git pull` will happen in this run. */
    readonly shouldPull: boolean;
    /** Run `pnpm install` after the pull (only when pulling). */
    readonly install: boolean;
    /** Value of `--expect-commit`, when given. */
    readonly expectCommit: string | undefined;
    /** `git pull` in the checkout. Throws or exits on failure. */
    readonly pull: () => Promise<void>;
    /** `git rev-parse HEAD` in the checkout. */
    readonly readCheckoutSha: () => Promise<string>;
    /** `pnpm install --frozen-lockfile`. */
    readonly installDeps: () => Promise<void>;
}

/** Result of {@link runMigratePullPhase}. */
export type MigratePullPhaseResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly message: string };

/**
 * Pull phase of `db-migrate` with the commit guard in the right place.
 *
 * Order: refuse a pull that has no `--expect-commit` (before touching the
 * checkout), pull, read HEAD, compare, and only then install dependencies. The
 * caller runs build, backup and migrate strictly after this returns `ok`.
 * With no pull and no `--expect-commit` the phase does nothing (unchanged
 * behaviour); with `--expect-commit` alone the checkout is still verified.
 *
 * @param input - Flags and injected effects.
 * @returns `ok`, or the refusal message the caller must print before exiting non-zero.
 */
export async function runMigratePullPhase(
    input: RunMigratePullPhaseInput
): Promise<MigratePullPhaseResult> {
    const wantsGuard = input.shouldPull || input.expectCommit !== undefined;
    if (
        input.shouldPull &&
        (input.expectCommit === undefined || input.expectCommit.trim() === '')
    ) {
        return {
            ok: false,
            message:
                'db-migrate with a git pull requires --expect-commit=<sha>: the commit the new image is built from. Nothing was pulled or applied.'
        };
    }

    if (input.shouldPull) await input.pull();

    if (wantsGuard) {
        let checkoutSha: string;
        try {
            checkoutSha = await input.readCheckoutSha();
        } catch (error) {
            return {
                ok: false,
                message: `Cannot read the checkout HEAD: ${error instanceof Error ? error.message : String(error)}. Nothing was applied.`
            };
        }
        const check = checkMigrateCommit({
            checkoutSha,
            expectedCommit: input.expectCommit
        });
        if (!check.ok) return check;
    }

    if (input.shouldPull && input.install) await input.installDeps();
    return { ok: true };
}
