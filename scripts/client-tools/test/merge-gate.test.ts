import { describe, expect, it } from 'bun:test';
import type { Check } from '../src/commands/ci/verdict.ts';
import {
    evaluateMergeGate,
    exitCodeForGate,
    type MergeVerdict
} from '../src/commands/merge/gate.ts';
import type { PrSnapshot } from '../src/lib/github.ts';

const passed: Check = { name: 'CI Pass', outcome: 'passed', detail: 'SUCCESS' };
const failed: Check = { name: 'E2E P0 Suite', outcome: 'failed', detail: 'FAILURE' };
const pending: Check = { name: 'Unit Tests (shard 3/5)', outcome: 'pending', detail: 'IN_PROGRESS' };

/** A pull request that would merge, so each test can break exactly one thing. */
function makePr(overrides: Partial<PrSnapshot> = {}): PrSnapshot {
    return {
        number: 3149,
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        isDraft: false,
        baseRefName: 'staging',
        title: '[NOSPEC:algo] fix(web): algo',
        checks: [passed],
        ...overrides
    };
}

describe('evaluateMergeGate', () => {
    it('should let a clean, green, staging-bound PR through', () => {
        // Measured shape of PR #3149: MERGEABLE / CLEAN.
        expect(evaluateMergeGate({ pr: makePr() }).verdict).toBe('ready');
    });

    it('should answer "unknown" while GitHub has not computed mergeability', () => {
        // Measured on this repo: four of five open PRs answered UNKNOWN on the
        // first query and resolved on the next one. Reading that as mergeable
        // is a fail-open; reading it as a conflict is a lie.
        const result = evaluateMergeGate({
            pr: makePr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' })
        });

        expect(result.verdict).toBe('unknown');
        expect(result.reason).toContain('reconsultando');
    });

    it('should ask about UNKNOWN before reading the fields that are unknown', () => {
        // Order matters: the conflict rule reads `mergeable`, which is the very
        // field still being computed. Checking conflict first would call every
        // freshly-queried PR conflict-free.
        expect(
            evaluateMergeGate({ pr: makePr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' }) })
                .verdict
        ).toBe('unknown');
    });

    it('should block a conflicted PR', () => {
        // Measured shape of PR #3146: CONFLICTING / DIRTY.
        const result = evaluateMergeGate({
            pr: makePr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })
        });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('push anterior');
    });

    it('should block a PR that is behind, however green its checks', () => {
        // This is the case the manual jq never caught: every check green, and
        // green for a merge-base that is not the one it would merge into.
        const result = evaluateMergeGate({
            pr: makePr({ mergeStateStatus: 'BEHIND', checks: [passed, passed] })
        });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('merge-base');
    });

    it('should block while checks are still running', () => {
        // Measured shape of PRs #3151/#3152/#3153: MERGEABLE / UNSTABLE.
        const result = evaluateMergeGate({
            pr: makePr({ mergeStateStatus: 'UNSTABLE', checks: [passed, pending] })
        });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('hops ci --wait');
    });

    it('should name the checks that are red', () => {
        const result = evaluateMergeGate({
            pr: makePr({ mergeStateStatus: 'UNSTABLE', checks: [passed, failed] })
        });

        expect(result.reason).toContain('E2E P0 Suite');
    });

    it('should never call an empty check list mergeable', () => {
        const result = evaluateMergeGate({ pr: makePr({ checks: [] }) });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('no corrió nada');
    });

    it('should block a draft', () => {
        expect(evaluateMergeGate({ pr: makePr({ isDraft: true }) }).verdict).toBe('blocked');
    });

    it('should block anything not aimed at staging', () => {
        const result = evaluateMergeGate({ pr: makePr({ baseRefName: 'main' }) });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('main');
    });

    it('should tell a merged PR that new commits need a new branch', () => {
        const result = evaluateMergeGate({ pr: makePr({ state: 'MERGED' }) });

        expect(result.verdict).toBe('blocked');
        expect(result.reason).toContain('branch nueva');
    });

    it('should give exactly one reason, never a list to triage', () => {
        // Conflicted AND red AND behind: the reader gets the first blocking
        // fact, which is the thing to go fix.
        const result = evaluateMergeGate({
            pr: makePr({
                mergeable: 'CONFLICTING',
                mergeStateStatus: 'DIRTY',
                checks: [failed, pending]
            })
        });

        expect(result.reason).toContain('conflictos');
        expect(result.reason).not.toContain('E2E P0 Suite');
    });

    it('should let NOTHING but a clean green PR read as ready', () => {
        // The fail-open sweep: one broken field at a time, and none of them may
        // come out mergeable.
        const broken: readonly Partial<PrSnapshot>[] = [
            { state: 'CLOSED' },
            { state: 'MERGED' },
            { isDraft: true },
            { baseRefName: 'main' },
            { mergeable: 'UNKNOWN' },
            { mergeStateStatus: 'UNKNOWN' },
            { mergeable: 'CONFLICTING' },
            { mergeStateStatus: 'DIRTY' },
            { mergeStateStatus: 'BEHIND' },
            { mergeStateStatus: 'BLOCKED' },
            { checks: [] },
            { checks: [passed, pending] },
            { checks: [passed, failed] }
        ];

        for (const overrides of broken) {
            expect({
                overrides,
                verdict: evaluateMergeGate({ pr: makePr(overrides) }).verdict
            }).not.toEqual({ overrides, verdict: 'ready' });
        }
    });
});

describe('exitCodeForGate', () => {
    it('should keep "no sé" apart from "no se puede"', () => {
        const codes = {
            ready: exitCodeForGate({ verdict: 'ready' }),
            blocked: exitCodeForGate({ verdict: 'blocked' }),
            unknown: exitCodeForGate({ verdict: 'unknown' })
        };

        expect(codes).toEqual({ ready: 0, blocked: 1, unknown: 3 });
        expect(new Set(Object.values(codes)).size).toBe(3);
    });

    it('should give only "ready" a success code', () => {
        const verdicts: readonly MergeVerdict[] = ['blocked', 'unknown'];

        expect(verdicts.filter((verdict) => exitCodeForGate({ verdict }) === 0)).toEqual([]);
    });
});
