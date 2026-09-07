import { describe, expect, it } from 'bun:test';
import type { AuditResult } from '../src/commands/whats-new/audit-core.ts';
import { renderAuditReport } from '../src/commands/whats-new/report.ts';

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
    return {
        evaluated: [],
        unlabeled: [],
        conflicting: [],
        botExempt: [],
        preCutoff: [],
        unresolvedCommits: [],
        mismatches: [],
        cutoffConfigured: true,
        ...overrides
    };
}

describe('renderAuditReport', () => {
    it('should say OK and never name a PR when the result is clean', () => {
        const report = renderAuditReport({ result: makeResult() });

        expect(report).toContain('OK');
        expect(report).not.toContain('#');
    });

    it('should warn explicitly when the cutoff is not configured', () => {
        const report = renderAuditReport({ result: makeResult({ cutoffConfigured: false }) });

        expect(report).toContain('Cutoff not configured');
    });

    it('should NOT warn about the cutoff when it is configured', () => {
        const report = renderAuditReport({ result: makeResult({ cutoffConfigured: true }) });

        expect(report).not.toContain('Cutoff not configured');
    });

    it('should name unlabeled PRs by number and title, never say "something is missing"', () => {
        const report = renderAuditReport({
            result: makeResult({
                unlabeled: [
                    {
                        sha: 'a'.repeat(40),
                        pr: {
                            number: 3271,
                            title: '[HOS-1102] feat(web): host trade QR flow',
                            author: 'x',
                            labels: [],
                            merged: true
                        },
                        outcome: { kind: 'unlabeled' }
                    }
                ]
            })
        });

        expect(report).toContain('#3271');
        expect(report).toContain('host trade QR flow');
        expect(report.toLowerCase()).not.toContain('something is missing');
        expect(report).toContain('hops whats-new audit --fix');
    });

    it('should name a conflicting PR separately from an unlabeled one', () => {
        const report = renderAuditReport({
            result: makeResult({
                conflicting: [
                    {
                        sha: 'b'.repeat(40),
                        pr: {
                            number: 42,
                            title: 'both labels',
                            author: 'x',
                            labels: [],
                            merged: true
                        },
                        outcome: { kind: 'conflict' }
                    }
                ]
            })
        });

        expect(report).toContain('#42');
        expect(report).toContain('mutually exclusive');
    });

    it('should name a direct-push commit by SHA', () => {
        const report = renderAuditReport({
            result: makeResult({
                unresolvedCommits: [{ sha: 'c'.repeat(40), subject: 'oops: direct push' }]
            })
        });

        expect(report).toContain('c'.repeat(40));
        expect(report).toContain('direct push');
    });

    it('should report a mismatch without letting it block on its own', () => {
        const report = renderAuditReport({
            result: makeResult({
                mismatches: [{ sha: 'd'.repeat(40), apiNumber: 1, subjectNumber: 2 }]
            })
        });

        expect(report).toContain('disagreement');
        expect(report).toContain('API says #1');
        expect(report).toContain('subject says #2');
        expect(report).toContain('OK'); // still a clean, non-blocked report
    });

    it('should count exactly the blocking items in the headline', () => {
        const report = renderAuditReport({
            result: makeResult({
                unlabeled: [
                    {
                        sha: 'e'.repeat(40),
                        pr: { number: 1, title: 'a', author: 'x', labels: [], merged: true },
                        outcome: { kind: 'unlabeled' }
                    }
                ],
                conflicting: [
                    {
                        sha: 'f'.repeat(40),
                        pr: { number: 2, title: 'b', author: 'x', labels: [], merged: true },
                        outcome: { kind: 'conflict' }
                    }
                ],
                unresolvedCommits: [{ sha: 'g'.repeat(40), subject: 'c' }]
            })
        });

        expect(report).toContain('Promotion blocked: 3 item(s)');
    });
});
