import { describe, expect, it } from 'vitest';
import { resolveBusinessLinesChange } from '../../src/listing-sections/business-lines-change';

describe('TEST:7.3:2 resolveBusinessLinesChange', () => {
    it('adds a line and shows the sections it owns', () => {
        expect(
            resolveBusinessLinesChange({
                vertical: 'venue',
                before: ['food'],
                after: ['food', 'nightlife']
            })
        ).toEqual({
            addedLines: ['nightlife'],
            removedLines: [],
            shownSections: ['nightInfo'],
            hiddenSections: []
        });
    });

    it('removes a line and hides the sections it owned, in catalog order', () => {
        expect(
            resolveBusinessLinesChange({
                vertical: 'venue',
                before: ['food', 'nightlife'],
                after: ['nightlife']
            })
        ).toEqual({
            addedLines: [],
            removedLines: ['food'],
            shownSections: [],
            hiddenSections: ['menu', 'dailySpecials']
        });
    });

    it('returns four empty lists when the selection did not change', () => {
        expect(
            resolveBusinessLinesChange({
                vertical: 'venue',
                before: ['food', 'nightlife'],
                after: ['nightlife', 'food']
            })
        ).toEqual({
            addedLines: [],
            removedLines: [],
            shownSections: [],
            hiddenSections: []
        });
    });

    it('discards a stored value the catalog does not declare', () => {
        expect(
            resolveBusinessLinesChange({
                vertical: 'venue',
                before: ['food', 'unknown-line'],
                after: ['nightlife', 'unknown-line']
            })
        ).toEqual({
            addedLines: ['nightlife'],
            removedLines: ['food'],
            shownSections: ['nightInfo'],
            hiddenSections: ['menu', 'dailySpecials']
        });
    });
});
