import { describe, expect, it } from 'bun:test';
import type { ComputeDeps } from '../src/commands/whats-new/compute.ts';
import { computeAudit } from '../src/commands/whats-new/compute.ts';
import { WHATS_NEW_NONE_LABEL } from '../src/commands/whats-new/labels.ts';
import type { ApiPr, RangeCommit } from '../src/commands/whats-new/range.ts';

const COMMIT: RangeCommit = {
    sha: 'a'.repeat(40),
    timestamp: 1000,
    subject: 'Merge pull request #3271 from qazuor/x'
};

const PR: ApiPr = {
    number: 3271,
    title: '[HOS-1] feat(web): thing',
    author: 'qazuor',
    labels: [WHATS_NEW_NONE_LABEL],
    merged: true
};

/** A full set of dependencies that succeed, so a test can break exactly one. */
function makeDeps(overrides: Partial<ComputeDeps> = {}): ComputeDeps {
    return {
        enumerate: async () => [COMMIT],
        resolveSlug: async () => 'qazuor/hospeda2',
        resolvePr: async () => ({ ok: true, prs: [PR] }),
        readTimestamp: async () => 500,
        readCutoff: () => null,
        ...overrides
    };
}

describe('computeAudit', () => {
    it('should classify a clean range end to end', async () => {
        const outcome = await computeAudit({ repoRoot: '/repo', cwd: '/repo', deps: makeDeps() });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.result.evaluated).toHaveLength(1);
        }
    });

    // --- AC-13: this is the block's most important test ---
    it('should return NOT-OK (never a blocked result) when the GitHub API call fails', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                resolvePr: async () => ({ ok: false, error: 'HTTP 503 Service Unavailable' })
            })
        });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.reason).toContain('API de GitHub');
            expect(outcome.reason).toContain('503');
        }
        // The crucial distinction: a `ComputeOutcome` with `ok: false` carries no
        // `AuditResult` at all, so a caller cannot accidentally read it as
        // "0 unlabeled" and report a false-clean, nor as "1 unlabeled" and
        // report a false-blocked. There is no result to misread.
        expect('result' in outcome).toBe(false);
    });

    it('should return NOT-OK when the range cannot be enumerated', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ enumerate: async () => null })
        });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('rango');
    });

    it('should return NOT-OK when the repo slug cannot be resolved', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ resolveSlug: async () => null })
        });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('owner/repo');
    });

    it('should return NOT-OK when a configured cutoff SHA does not resolve to a commit', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ readCutoff: () => 'deadbeef', readTimestamp: async () => null })
        });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('deadbeef');
    });

    it('should pass the resolved cutoff timestamp through to classification', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                readCutoff: () => 'deadbeef',
                readTimestamp: async () => 1000, // equals the commit's own timestamp
                resolvePr: async () => ({ ok: true, prs: [{ ...PR, labels: [] }] })
            })
        });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.result.preCutoff).toHaveLength(1);
            expect(outcome.result.cutoffConfigured).toBe(true);
        }
    });

    it('should stop at the first commit that fails to resolve, never partially reporting', async () => {
        let calls = 0;
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                enumerate: async () => [COMMIT, { ...COMMIT, sha: 'b'.repeat(40) }],
                resolvePr: async () => {
                    calls += 1;
                    return { ok: false, error: 'boom' };
                }
            })
        });

        expect(outcome.ok).toBe(false);
        expect(calls).toBe(1);
    });
});
