import { describe, expect, it } from 'bun:test';
import {
    type Check,
    classifyCheck,
    explainVerdict,
    groupChecks,
    overallVerdict,
    type PrStatus,
    verdictOf
} from '../src/commands/ci/verdict.ts';

function makeStatus(overrides: Partial<PrStatus> = {}): PrStatus {
    return {
        number: 3098,
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        checks: [],
        ...overrides
    };
}

const passed: Check = { name: 'Lint', outcome: 'passed', detail: 'SUCCESS' };
const failed: Check = { name: 'E2E P0 Suite', outcome: 'failed', detail: 'FAILURE' };
const pending: Check = { name: 'Build', outcome: 'pending', detail: 'IN_PROGRESS' };

describe('classifyCheck', () => {
    it('should treat an EMPTY conclusion as pending, never as passing', () => {
        // GitHub returns "" — not null — while a run is in flight. A `// null`
        // fallback in jq is exactly how seven queued jobs read as green.
        expect(
            classifyCheck({ raw: { name: 'x', conclusion: '', status: 'IN_PROGRESS' } }).outcome
        ).toBe('pending');
    });

    it('should treat a missing conclusion as pending', () => {
        expect(classifyCheck({ raw: { name: 'x', status: 'QUEUED' } }).outcome).toBe('pending');
    });

    it('should not call a skipped or neutral check a failure', () => {
        expect(classifyCheck({ raw: { name: 'x', conclusion: 'SKIPPED' } }).outcome).toBe('passed');
        expect(classifyCheck({ raw: { name: 'x', conclusion: 'NEUTRAL' } }).outcome).toBe('passed');
    });

    it('should catch every shape of failure', () => {
        for (const conclusion of ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED']) {
            expect({ conclusion, outcome: classifyCheck({ raw: { conclusion } }).outcome }).toEqual(
                {
                    conclusion,
                    outcome: 'failed'
                }
            );
        }
    });

    it('should read a commit status, which reports state instead of conclusion', () => {
        expect(classifyCheck({ raw: { name: 'x', state: 'SUCCESS' } }).outcome).toBe('passed');
    });

    it('should not wave through a verdict nobody anticipated', () => {
        expect(classifyCheck({ raw: { name: 'x', conclusion: 'SOMETHING_NEW' } }).outcome).toBe(
            'pending'
        );
    });
});

describe('verdictOf', () => {
    it('should let a failure win over anything still running', () => {
        // A run still going does not soften one that already broke.
        expect(verdictOf({ checks: [passed, pending, failed] })).toBe('red');
    });

    it('should report pending while anything is unfinished', () => {
        expect(verdictOf({ checks: [passed, pending] })).toBe('pending');
    });

    it('should be green only when every check passed', () => {
        expect(verdictOf({ checks: [passed, passed] })).toBe('green');
    });

    it('should never call an empty check list green', () => {
        // Zero checks means nothing ran, not that everything passed.
        expect(verdictOf({ checks: [] })).toBe('no-checks');
    });
});

describe('overallVerdict', () => {
    it('should refuse to call a conflicted PR green, whatever its checks say', () => {
        // Measured on PR #3098: 18 checks green, conflicting. GitHub does not
        // dispatch workflows while a PR conflicts, so those greens belong to an
        // earlier push and say nothing about what would merge.
        const status = makeStatus({ mergeable: 'CONFLICTING', checks: [passed, passed] });

        expect(verdictOf({ checks: status.checks })).toBe('green');
        expect(overallVerdict({ status })).toBe('conflict');
    });

    it('should pass the checks through when the PR is mergeable', () => {
        expect(overallVerdict({ status: makeStatus({ checks: [passed] }) })).toBe('green');
        expect(overallVerdict({ status: makeStatus({ checks: [failed] }) })).toBe('red');
    });

    it('should not treat UNKNOWN mergeability as a conflict', () => {
        // GitHub reports UNKNOWN while it computes: that is not a conflict.
        expect(
            overallVerdict({ status: makeStatus({ mergeable: 'UNKNOWN', checks: [passed] }) })
        ).toBe('green');
    });
});

describe('explainVerdict', () => {
    it('should explain a conflict in terms of what the checks are worth', () => {
        const text = explainVerdict({ status: makeStatus({ mergeable: 'CONFLICTING' }) });

        expect(text).toContain('push anterior');
    });

    it('should warn that a merged PR cannot review new commits', () => {
        const text = explainVerdict({ status: makeStatus({ state: 'MERGED' }) });

        expect(text).toContain('branch nueva');
    });

    it('should say nothing extra for an ordinary green PR', () => {
        expect(explainVerdict({ status: makeStatus({ checks: [passed] }) })).toBeNull();
    });
});

describe('groupChecks', () => {
    it('should split the three outcomes', () => {
        const groups = groupChecks({ checks: [passed, failed, pending, passed] });

        expect(groups.passed).toHaveLength(2);
        expect(groups.failed).toHaveLength(1);
        expect(groups.pending).toHaveLength(1);
    });
});
