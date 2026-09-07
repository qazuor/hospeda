import { describe, expect, it } from 'bun:test';
import {
    type ApiPr,
    parseMergeSubjectPrNumber,
    pickMergedPr
} from '../src/commands/whats-new/range.ts';

function makePr(overrides: Partial<ApiPr> = {}): ApiPr {
    return { number: 1, title: 't', author: 'a', labels: [], merged: false, ...overrides };
}

describe('parseMergeSubjectPrNumber', () => {
    it('should read the PR number out of a real merge-commit subject', () => {
        expect(
            parseMergeSubjectPrNumber({
                subject:
                    'Merge pull request #3191 from qazuor/feat/hos-1129-qr-brochure-certificate'
            })
        ).toBe(3191);
    });

    it('should return null for an ordinary commit subject', () => {
        expect(
            parseMergeSubjectPrNumber({ subject: 'fix(api): handle the empty-body case' })
        ).toBeNull();
    });

    it('should return null when the pattern appears mid-sentence, not at the start', () => {
        // Anchored on purpose: a commit that merely MENTIONS a merge is not a
        // merge commit, and reading it as one would fabricate an association.
        expect(
            parseMergeSubjectPrNumber({
                subject: 'docs: explain Merge pull request #123 style commits'
            })
        ).toBeNull();
    });

    it('should return null for an empty subject', () => {
        expect(parseMergeSubjectPrNumber({ subject: '' })).toBeNull();
    });
});

describe('pickMergedPr', () => {
    it('should pick the single PR when there is only one', () => {
        const pr = makePr({ number: 42, merged: true });

        expect(pickMergedPr({ prs: [pr] })).toEqual(pr);
    });

    it('should pick the merged PR out of several, regardless of position', () => {
        const open = makePr({ number: 1, merged: false });
        const merged = makePr({ number: 2, merged: true });

        expect(pickMergedPr({ prs: [open, merged] }).number).toBe(2);
        expect(pickMergedPr({ prs: [merged, open] }).number).toBe(2);
    });

    it('should fall back to the first PR when none are merged', () => {
        const first = makePr({ number: 1, merged: false });
        const second = makePr({ number: 2, merged: false });

        expect(pickMergedPr({ prs: [first, second] }).number).toBe(1);
    });
});
