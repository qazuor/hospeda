import { describe, expect, it } from 'vitest';
import { resolveBusinessLinesOnCreate } from '../../../src/services/listing/base-listing.service';

describe('TEST:2.3:3 AC:2:11 create business line preselection', () => {
    it.each([
        ['venue', 'BOLICHE', ['nightlife']],
        ['venue', 'CAFE', ['food']],
        ['venue', 'BAR', ['food', 'nightlife']],
        ['accommodation', 'CABIN', ['standard']],
        ['experience', 'EXCURSION', ['standard']]
    ] as const)('%s %s defaults to its catalog preselection', (vertical, type, expected) => {
        expect(resolveBusinessLinesOnCreate({ vertical, type })).toEqual(expected);
    });

    it('preserves explicitly supplied create values for the later validator', () => {
        expect(
            resolveBusinessLinesOnCreate({
                vertical: 'venue',
                type: 'BOLICHE',
                businessLines: ['food']
            })
        ).toEqual(['food']);
    });
});
