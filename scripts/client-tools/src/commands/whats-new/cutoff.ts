import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Path, relative to the repository root, of the What's New gate's cutoff file.
 *
 * This is the ONLY place the cutoff SHA is allowed to live. `hops whats-new
 * audit` reads it here; the future `.github/workflows/whats-new-gate.yml`
 * (HOS-1214 block 3) must read the same file rather than carrying its own copy
 * in the workflow YAML — see the file's own header comment for why a
 * duplicated cutoff is worse than no cutoff at all.
 */
export const CUTOFF_FILE_PATH = 'scripts/whats-new-gate-cutoff.txt';

/**
 * Parses the cutoff file's content into a SHA, or `null` when unconfigured.
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
 * Reads the What's New gate's cutoff SHA, the single source of truth shared
 * with the (future) promotion workflow.
 *
 * Returns `null` both when the file is missing and when it carries no SHA
 * line — both mean the same thing operationally: **no cutoff is configured
 * yet**. Callers must treat that as an explicit, reportable state (no PR is
 * exempted by age), never as a silent fallback to "everything is exempt" or
 * "nothing is exempt" without saying so. See `buildAuditResult`'s
 * `cutoffConfigured` field.
 *
 * @param input.repoRoot - Absolute path to the repository root.
 * @returns The configured SHA, or `null` when unset.
 */
export function readCutoffSha({ repoRoot }: { readonly repoRoot: string }): string | null {
    try {
        const content = readFileSync(join(repoRoot, CUTOFF_FILE_PATH), 'utf8');
        return parseCutoffFile({ content });
    } catch {
        return null;
    }
}
