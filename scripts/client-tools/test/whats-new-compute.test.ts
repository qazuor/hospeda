import { describe, expect, it } from 'bun:test';
import type { ComputeDeps } from '../src/commands/whats-new/compute.ts';
import { computeAudit, exitCodeForOutcome } from '../src/commands/whats-new/compute.ts';
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
        resolveCutoff: async () => ({ kind: 'derived', sha: 'c'.repeat(40) }),
        ...overrides
    };
}

/** The clean-result shape the exit-code tests assert against. */
const EMPTY_RESULT = {
    evaluated: [],
    unlabeled: [],
    conflicting: [],
    botExempt: [],
    preCutoff: [],
    unresolvedCommits: [],
    mismatches: [],
    cutoffConfigured: true,
    cutoff: { source: 'derived' as const, sha: 'c'.repeat(40) }
};

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

    it('should return NOT-OK when a pinned cutoff SHA does not resolve to a commit', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                resolveCutoff: async () => ({ kind: 'override', sha: 'deadbeef' }),
                readTimestamp: async () => null
            })
        });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.reason).toContain('deadbeef');
            expect(outcome.reason).toContain('whats-new-gate-cutoff.txt');
        }
    });

    // --- AC-18: an underivable cutoff is "I do not know", never "no cutoff" ---
    it('should return NOT-OK (exit 3) when the cutoff cannot be derived at all', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                resolveCutoff: async () => ({
                    kind: 'underivable',
                    reason: 'ningún commit agrega .github/workflows/whats-new-gate.yml'
                }),
                resolvePr: async () => ({ ok: true, prs: [{ ...PR, labels: [] }] })
            })
        });

        // The fail-open this guards: continuing with `cutoffTimestamp = null`
        // would produce a perfectly well-formed result in which NO PR is
        // pre-cutoff, and the operator would read a list of hundreds of
        // "unevaluated" PRs as a real finding.
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('whats-new-gate.yml');
        expect(exitCodeForOutcome({ outcome })).toBe(3);
        expect(exitCodeForOutcome({ outcome })).not.toBe(1);
    });

    it('should pass the resolved cutoff timestamp and its provenance through to classification', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({
                resolveCutoff: async () => ({ kind: 'derived', sha: 'deadbeef' }),
                readTimestamp: async () => 1000, // equals the commit's own timestamp
                resolvePr: async () => ({ ok: true, prs: [{ ...PR, labels: [] }] })
            })
        });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.result.preCutoff).toHaveLength(1);
            expect(outcome.result.cutoffConfigured).toBe(true);
            expect(outcome.result.cutoff).toEqual({ source: 'derived', sha: 'deadbeef' });
        }
    });

    it('should resolve the cutoff even when the range is empty, so its provenance is always reported', async () => {
        const outcome = await computeAudit({
            repoRoot: '/repo',
            cwd: '/repo',
            deps: makeDeps({ enumerate: async () => [] })
        });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) expect(outcome.result.cutoff?.source).toBe('derived');
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

describe('exitCodeForOutcome', () => {
    // --- AC-13: the exact mapping the mutation test targets ---
    it('should map a NOT-OK outcome (GitHub API failure) to exit 3, never 1', () => {
        const outcome = { ok: false as const, reason: 'HTTP 503 Service Unavailable' };

        expect(exitCodeForOutcome({ outcome })).toBe(3);
        expect(exitCodeForOutcome({ outcome })).not.toBe(1);
    });

    it('should map a clean OK outcome to exit 0', () => {
        const outcome = {
            ok: true as const,
            result: EMPTY_RESULT
        };

        expect(exitCodeForOutcome({ outcome })).toBe(0);
    });

    it('should map a blocked OK outcome to exit 1, never 3', () => {
        const outcome = {
            ok: true as const,
            result: {
                ...EMPTY_RESULT,
                unlabeled: [
                    {
                        sha: 'a'.repeat(40),
                        pr: PR,
                        outcome: { kind: 'unlabeled' as const }
                    }
                ]
            }
        };

        expect(exitCodeForOutcome({ outcome })).toBe(1);
        expect(exitCodeForOutcome({ outcome })).not.toBe(3);
    });

    it('should keep all three codes distinguishable', () => {
        const notOk = exitCodeForOutcome({ outcome: { ok: false as const, reason: 'x' } });
        const okClean = exitCodeForOutcome({
            outcome: {
                ok: true as const,
                result: EMPTY_RESULT
            }
        });

        expect(new Set([notOk, okClean]).size).toBe(2);
    });
});
