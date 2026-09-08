import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../../lib/exec.ts';

/**
 * Path, relative to the repository root, of the What's New gate's OPTIONAL
 * cutoff override.
 *
 * The cutoff is normally DERIVED (see {@link deriveCutoffSha}); this file only
 * exists so an owner can pin a different SHA without touching code. When it
 * carries a SHA, that SHA wins; when it is empty (its committed state), the
 * derivation answers.
 */
export const CUTOFF_FILE_PATH = 'scripts/whats-new-gate-cutoff.txt';

/**
 * Path, relative to the repository root, of the gate workflow whose FIRST
 * commit is the cutoff (HOS-1214 D-6).
 *
 * The cutoff means "since the rule exists", and the rule is this workflow, so
 * the commit that added it IS the cutoff. Deriving it from git removes the one
 * step of the old design nobody could be reminded to take: writing the SHA into
 * a file after the workflow's own PR merged.
 */
export const GATE_WORKFLOW_PATH = '.github/workflows/whats-new-gate.yml';

/**
 * Refs the derivation walks, in order, stopping at the first that yields a
 * commit.
 *
 * `HEAD` first so the answer describes the checkout actually being audited
 * (including a promotion PR's merge commit in CI, and a local branch that
 * carries the workflow but has not merged yet). `origin/staging` second so an
 * operator sitting on an older branch — one cut before the workflow landed —
 * still derives the same commit instead of being told the rule does not exist.
 * Both refs share one history, so when both answer they answer identically.
 */
export const CUTOFF_DERIVATION_REFS: readonly string[] = ['HEAD', 'origin/staging'];

/** Where a resolved cutoff came from, or why there is none. */
export type CutoffResolution =
    | {
          /** A SHA was pinned in {@link CUTOFF_FILE_PATH} and wins over the derivation. */
          readonly kind: 'override';
          readonly sha: string;
      }
    | {
          /** No override; the SHA is the commit that added {@link GATE_WORKFLOW_PATH}. */
          readonly kind: 'derived';
          readonly sha: string;
      }
    | {
          /**
           * Neither source produced a SHA. This is a REPORTABLE state, never a
           * silent fallback — see {@link resolveCutoff}.
           */
          readonly kind: 'underivable';
          readonly reason: string;
      };

/**
 * Parses the override file's content into a SHA, or `null` when unset.
 *
 * Lines starting with `#` and blank lines are comments/spacing; the first
 * remaining line is the SHA. Exported separately from the file read so it can
 * be unit-tested without touching the filesystem.
 *
 * @param input.content - Raw file content.
 * @returns The trimmed SHA, or `null` when no such line is present.
 */
export function parseCutoffFile({ content }: { readonly content: string }): string | null {
    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith('#')) continue;
        return line;
    }
    return null;
}

/**
 * Reads the OPTIONAL pinned cutoff SHA.
 *
 * Returns `null` both when the file is missing and when it carries no SHA
 * line — both mean the same thing: no override, so the derivation decides.
 *
 * @param input.repoRoot - Absolute path to the repository root.
 * @returns The pinned SHA, or `null` when unset.
 */
export function readCutoffOverrideSha({ repoRoot }: { readonly repoRoot: string }): string | null {
    try {
        const content = readFileSync(join(repoRoot, CUTOFF_FILE_PATH), 'utf8');
        return parseCutoffFile({ content });
    } catch {
        return null;
    }
}

/**
 * Picks the introducing commit out of `git log --diff-filter=A` output.
 *
 * `git log` reports newest-first, so the commit that FIRST added the path is
 * the LAST line. That distinction only shows up if the file is ever deleted
 * and re-added — in which case "since the rule exists" is the first time it
 * existed, not the most recent re-add.
 *
 * @param input.stdout - Raw `git log --format=%H` output.
 * @returns The earliest adding commit's SHA, or `null` when there is none.
 */
export function pickIntroducingCommit({ stdout }: { readonly stdout: string }): string | null {
    const shas = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return shas.length === 0 ? null : (shas[shas.length - 1] as string);
}

/**
 * Derives the cutoff: the commit that added {@link GATE_WORKFLOW_PATH}.
 *
 * Zero configuration, nothing to forget, and exactly the semantics the gate
 * wants — a PR merged before the rule existed was never a candidate for a
 * novelty decision. `audit-core.ts` compares commits by TIMESTAMP, not by
 * ancestry, so a commit reachable from any of {@link CUTOFF_DERIVATION_REFS}
 * serves regardless of which branch it lives on.
 *
 * @param input.cwd  - Repository directory to run `git` from.
 * @param input.refs - Refs to try, in order (defaults to
 *                      {@link CUTOFF_DERIVATION_REFS}).
 * @param input.path - Path to derive from (defaults to
 *                      {@link GATE_WORKFLOW_PATH}); a parameter only so the
 *                      "the workflow was renamed" case is testable.
 * @returns The introducing commit's SHA, or `null` when no ref knows the path.
 */
export async function deriveCutoffSha({
    cwd,
    refs = CUTOFF_DERIVATION_REFS,
    path = GATE_WORKFLOW_PATH
}: {
    readonly cwd: string;
    readonly refs?: readonly string[];
    readonly path?: string;
}): Promise<string | null> {
    for (const ref of refs) {
        const result = await run({
            command: 'git',
            args: ['log', '--diff-filter=A', '--format=%H', ref, '--', path],
            cwd,
            timeoutMs: 30_000
        });
        if (!result.ok) continue;
        const sha = pickIntroducingCommit({ stdout: result.stdout });
        if (sha !== null) return sha;
    }
    return null;
}

/** The `git`/filesystem calls {@link resolveCutoff} needs, as an injectable seam. */
export interface CutoffDeps {
    readonly readOverride: typeof readCutoffOverrideSha;
    readonly derive: typeof deriveCutoffSha;
}

/** The real dependencies, used outside tests. */
export const REAL_CUTOFF_DEPS: CutoffDeps = {
    readOverride: readCutoffOverrideSha,
    derive: deriveCutoffSha
};

/**
 * Resolves the cutoff SHA: the override if pinned, otherwise the derivation.
 *
 * **`underivable` is deliberately loud.** If someone renames or moves
 * {@link GATE_WORKFLOW_PATH}, `git log` on the old path answers nothing — and
 * a cutoff of "nothing" would quietly change what the gate reports (every PR
 * ever merged becomes in-scope, so the first promotion after the rename names
 * hundreds of PRs and reads as "the tool is broken"). So this returns an
 * explicit third state that the caller turns into exit `3` — *could not
 * determine* — naming the path it looked for. The remedy is either restoring
 * the path or pinning the SHA in {@link CUTOFF_FILE_PATH}, and the message
 * says both.
 *
 * @param input.repoRoot - Repository root (where the override file lives).
 * @param input.cwd      - Directory to run `git` from (may be a worktree).
 * @param input.deps     - Injectable seam, defaulting to {@link REAL_CUTOFF_DEPS}.
 * @returns The {@link CutoffResolution}.
 */
export async function resolveCutoff({
    repoRoot,
    cwd,
    deps = REAL_CUTOFF_DEPS
}: {
    readonly repoRoot: string;
    readonly cwd: string;
    readonly deps?: CutoffDeps;
}): Promise<CutoffResolution> {
    const override = deps.readOverride({ repoRoot });
    if (override !== null) return { kind: 'override', sha: override };

    const derived = await deps.derive({ cwd });
    if (derived !== null) return { kind: 'derived', sha: derived };

    return {
        kind: 'underivable',
        reason:
            `No pude derivar el cutoff: ningún commit agrega ${GATE_WORKFLOW_PATH} ` +
            `en ${CUTOFF_DERIVATION_REFS.join(' ni ')}. ` +
            '¿Se renombró o movió el workflow? Restaurá la ruta, o fijá el SHA a mano ' +
            `en ${CUTOFF_FILE_PATH}.`
    };
}
