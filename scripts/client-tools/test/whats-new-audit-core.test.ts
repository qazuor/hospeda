import { describe, expect, it } from 'bun:test';
import {
    blocksPromotion,
    buildAuditResult,
    type CommitResolution,
    exitCodeForAudit
} from '../src/commands/whats-new/audit-core.ts';
import { WHATS_NEW_DONE_LABEL, WHATS_NEW_NONE_LABEL } from '../src/commands/whats-new/labels.ts';
import type { ApiPr, RangeCommit } from '../src/commands/whats-new/range.ts';

function makeCommit(overrides: Partial<RangeCommit> = {}): RangeCommit {
    return {
        sha: 'a'.repeat(40),
        timestamp: 1_000_000,
        subject: 'Merge pull request #3271 from qazuor/x',
        ...overrides
    };
}

function makePr(overrides: Partial<ApiPr> = {}): ApiPr {
    return {
        number: 3271,
        title: '[HOS-1] feat(web): thing',
        author: 'qazuor',
        labels: [],
        merged: true,
        ...overrides
    };
}

function resolution(overrides: Partial<CommitResolution> = {}): CommitResolution {
    return { commit: makeCommit(), prs: [makePr()], ...overrides };
}

describe('buildAuditResult', () => {
    it('should bucket an evaluated PR as evaluated', () => {
        const result = buildAuditResult({
            resolutions: [resolution({ prs: [makePr({ labels: [WHATS_NEW_NONE_LABEL] })] })],
            cutoffTimestamp: null
        });

        expect(result.evaluated).toHaveLength(1);
        expect(result.unlabeled).toHaveLength(0);
    });

    it('should bucket an unlabeled PR as unlabeled and block', () => {
        const result = buildAuditResult({
            resolutions: [resolution({ prs: [makePr({ labels: [] })] })],
            cutoffTimestamp: null
        });

        expect(result.unlabeled).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(true);
        expect(exitCodeForAudit({ result })).toBe(1);
    });

    it('should bucket a doubly-labeled PR as conflicting and block', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    prs: [makePr({ labels: [WHATS_NEW_NONE_LABEL, WHATS_NEW_DONE_LABEL] })]
                })
            ],
            cutoffTimestamp: null
        });

        expect(result.conflicting).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(true);
    });

    it('should exempt a bot-authored PR even unlabeled, and not block', () => {
        const result = buildAuditResult({
            resolutions: [resolution({ prs: [makePr({ author: 'dependabot[bot]', labels: [] })] })],
            cutoffTimestamp: null
        });

        expect(result.botExempt).toHaveLength(1);
        expect(result.unlabeled).toHaveLength(0);
        expect(blocksPromotion({ result })).toBe(false);
    });

    it('should exempt a PR whose commit timestamp is at or before the cutoff', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    commit: makeCommit({ timestamp: 500 }),
                    prs: [makePr({ labels: [] })]
                })
            ],
            cutoffTimestamp: 500
        });

        expect(result.preCutoff).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(false);
    });

    it('should NOT exempt a PR whose commit timestamp is after the cutoff', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    commit: makeCommit({ timestamp: 501 }),
                    prs: [makePr({ labels: [] })]
                })
            ],
            cutoffTimestamp: 500
        });

        expect(result.preCutoff).toHaveLength(0);
        expect(result.unlabeled).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(true);
    });

    it('should report cutoffConfigured false when no cutoff was passed', () => {
        const result = buildAuditResult({ resolutions: [], cutoffTimestamp: null });

        expect(result.cutoffConfigured).toBe(false);
    });

    it('should report cutoffConfigured true once a cutoff timestamp is passed', () => {
        const result = buildAuditResult({ resolutions: [], cutoffTimestamp: 42 });

        expect(result.cutoffConfigured).toBe(true);
    });

    // --- AC-8: a first-parent commit resolving to no PR is a direct push ---
    it('should treat a commit with zero resolved PRs as an unresolved direct push, and block', () => {
        const result = buildAuditResult({
            resolutions: [resolution({ prs: [] })],
            cutoffTimestamp: null
        });

        expect(result.unresolvedCommits).toHaveLength(1);
        expect(result.unresolvedCommits[0]?.sha).toBe('a'.repeat(40));
        expect(blocksPromotion({ result })).toBe(true);
        expect(exitCodeForAudit({ result })).toBe(1);
    });

    it('should NOT exempt an unresolved direct push by cutoff', () => {
        // Deliberate: cutoff exemption is about backfilling novelty LABELS onto
        // legacy PRs (NG-4), never about grandfathering a direct push, which the
        // branch workflow forbids regardless of when it happened.
        const result = buildAuditResult({
            resolutions: [resolution({ commit: makeCommit({ timestamp: 1 }), prs: [] })],
            cutoffTimestamp: 999_999
        });

        expect(result.unresolvedCommits).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(true);
    });

    // --- disagreement between the API's PR and the merge-subject parse ---
    it('should report, but not resolve, a mismatch between the API PR and the merge subject', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    commit: makeCommit({ subject: 'Merge pull request #9999 from qazuor/other' }),
                    prs: [makePr({ number: 3271, labels: [WHATS_NEW_NONE_LABEL] })]
                })
            ],
            cutoffTimestamp: null
        });

        expect(result.mismatches).toHaveLength(1);
        expect(result.mismatches[0]).toEqual({
            sha: 'a'.repeat(40),
            apiNumber: 3271,
            subjectNumber: 9999
        });
        // The API's PR is still used for classification — evaluated, not blocked.
        expect(result.evaluated).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(false);
    });

    it('should not report a mismatch when the subject has no PR reference at all', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({ commit: makeCommit({ subject: 'chore: something unrelated' }) })
            ],
            cutoffTimestamp: null
        });

        expect(result.mismatches).toHaveLength(0);
    });

    // --- measured 2026-09-07 against this repo's real history: a merge
    // commit can resolve to TWO PRs, one merged and one still-open ---
    it('should pick the MERGED pr when the API associates more than one, regardless of order', () => {
        const openStackedPr = makePr({ number: 9999, merged: false, labels: [] });
        const mergedPr = makePr({ number: 3271, merged: true, labels: [WHATS_NEW_NONE_LABEL] });

        const result = buildAuditResult({
            // Merged PR listed SECOND on purpose: the API's order is not
            // documented as stable, and this must not depend on it.
            resolutions: [resolution({ prs: [openStackedPr, mergedPr] })],
            cutoffTimestamp: null
        });

        expect(result.evaluated).toHaveLength(1);
        expect(result.evaluated[0]?.pr.number).toBe(3271);
        expect(result.unlabeled).toHaveLength(0);
    });

    it('should fall back to the first PR when none of the associated PRs are merged', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    prs: [
                        makePr({ number: 1, merged: false }),
                        makePr({ number: 2, merged: false })
                    ]
                })
            ],
            cutoffTimestamp: null
        });

        expect(result.unlabeled).toHaveLength(1);
        expect(result.unlabeled[0]?.pr.number).toBe(1);
    });

    it('should keep buckets independent across several PRs at once', () => {
        const result = buildAuditResult({
            resolutions: [
                resolution({
                    commit: makeCommit({ sha: 'b'.repeat(40) }),
                    prs: [makePr({ number: 1, labels: [WHATS_NEW_NONE_LABEL] })]
                }),
                resolution({
                    commit: makeCommit({ sha: 'c'.repeat(40) }),
                    prs: [makePr({ number: 2, labels: [] })]
                }),
                resolution({
                    commit: makeCommit({ sha: 'd'.repeat(40) }),
                    prs: [makePr({ number: 3, author: 'dependabot[bot]', labels: [] })]
                })
            ],
            cutoffTimestamp: null
        });

        expect(result.evaluated).toHaveLength(1);
        expect(result.unlabeled).toHaveLength(1);
        expect(result.botExempt).toHaveLength(1);
        expect(blocksPromotion({ result })).toBe(true);
    });
});
