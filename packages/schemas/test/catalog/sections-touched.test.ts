import { describe, expect, it } from 'vitest';
import {
    sectionsTouchedByBody,
    sectionTraitsTouchedByBody
} from '../../src/catalog/sections-touched';

describe('sections touched by update body', () => {
    it('ignores undefined, null, and an absent body', () => {
        expect(sectionsTouchedByBody({ vertical: 'venue', body: { menuUrl: null } })).toEqual([]);
        expect(sectionsTouchedByBody({ vertical: 'venue', body: undefined })).toEqual([]);
    });
    it('detects non-null catalog fields and their traits', () => {
        expect(
            sectionsTouchedByBody({
                vertical: 'venue',
                body: { menuUrl: 'https://example.com/menu' }
            })
        ).toEqual(['menu']);
        expect(
            sectionTraitsTouchedByBody({
                vertical: 'experience',
                body: { meetingPointDirections: ['Go north'] }
            })
        ).toEqual(['directions']);
        expect(
            sectionTraitsTouchedByBody({
                vertical: 'experience',
                body: { meetingPointDirections: null }
            })
        ).toEqual([]);
    });
});
