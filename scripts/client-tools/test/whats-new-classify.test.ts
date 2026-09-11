import { describe, expect, it } from 'bun:test';
import {
    type ClassifiablePr,
    classifyPr,
    outcomeBlocks
} from '../src/commands/whats-new/classify.ts';
import { WHATS_NEW_DONE_LABEL, WHATS_NEW_NONE_LABEL } from '../src/commands/whats-new/labels.ts';

function makePr(overrides: Partial<ClassifiablePr> = {}): ClassifiablePr {
    return { author: 'qazuor', labels: [], ...overrides };
}

describe('classifyPr', () => {
    it('should call a PR carrying whats-new-none "evaluated"', () => {
        const outcome = classifyPr({
            pr: makePr({ labels: [WHATS_NEW_NONE_LABEL] }),
            preCutoff: false
        });

        expect(outcome).toEqual({ kind: 'evaluated', label: WHATS_NEW_NONE_LABEL });
    });

    it('should call a PR carrying whats-new-done "evaluated"', () => {
        const outcome = classifyPr({
            pr: makePr({ labels: [WHATS_NEW_DONE_LABEL] }),
            preCutoff: false
        });

        expect(outcome).toEqual({ kind: 'evaluated', label: WHATS_NEW_DONE_LABEL });
    });

    it('should block a PR carrying neither label', () => {
        const outcome = classifyPr({ pr: makePr({ labels: [] }), preCutoff: false });

        expect(outcome.kind).toBe('unlabeled');
        expect(outcomeBlocks({ outcome })).toBe(true);
    });

    it('should treat both labels at once as a conflict, not a double evaluation', () => {
        const outcome = classifyPr({
            pr: makePr({ labels: [WHATS_NEW_NONE_LABEL, WHATS_NEW_DONE_LABEL] }),
            preCutoff: false
        });

        expect(outcome.kind).toBe('conflict');
        expect(outcomeBlocks({ outcome })).toBe(true);
    });

    it('should exempt a dependabot PR even with no label', () => {
        const outcome = classifyPr({ pr: makePr({ author: 'dependabot[bot]' }), preCutoff: false });

        expect(outcome.kind).toBe('bot-exempt');
        expect(outcomeBlocks({ outcome })).toBe(false);
    });

    it('should exempt a github-actions PR even with no label', () => {
        const outcome = classifyPr({
            pr: makePr({ author: 'github-actions[bot]' }),
            preCutoff: false
        });

        expect(outcome.kind).toBe('bot-exempt');
    });

    it('should exempt a pre-cutoff PR even with no label', () => {
        const outcome = classifyPr({ pr: makePr({ labels: [] }), preCutoff: true });

        expect(outcome.kind).toBe('pre-cutoff');
        expect(outcomeBlocks({ outcome })).toBe(false);
    });

    it('should let the bot exemption win over the pre-cutoff check', () => {
        // Order matters: a bot-authored PR is exempt for a reason that has
        // nothing to do with age, so it must read as bot-exempt even when it
        // also happens to be pre-cutoff.
        const outcome = classifyPr({
            pr: makePr({ author: 'dependabot[bot]' }),
            preCutoff: true
        });

        expect(outcome.kind).toBe('bot-exempt');
    });

    it('should never let a real human author read as bot-exempt', () => {
        const outcome = classifyPr({
            pr: makePr({ author: 'qazuor', labels: [] }),
            preCutoff: false
        });

        expect(outcome.kind).not.toBe('bot-exempt');
    });
});

describe('outcomeBlocks', () => {
    it('should block only conflict and unlabeled', () => {
        const kinds = ['evaluated', 'conflict', 'unlabeled', 'bot-exempt', 'pre-cutoff'] as const;
        const blocking = kinds.filter((kind) => outcomeBlocks({ outcome: { kind } }));

        expect(blocking.sort()).toEqual(['conflict', 'unlabeled']);
    });
});
