import { describe, expect, it } from 'vitest';
import { businessLineToUrlSlug, urlSlugToBusinessLine } from '../../src/catalog/business-lines.js';
import { sectionsTouchedByBody } from '../../src/catalog/sections-touched.js';

describe('listing catalog helpers', () => {
    it('finds sections touched by non-null body values', () => {
        expect(
            sectionsTouchedByBody({
                vertical: 'venue',
                body: { menuUrl: 'https://example.com/menu' }
            })
        ).toEqual(['menu']);
        expect(sectionsTouchedByBody({ vertical: 'venue', body: { menuUrl: null } })).toEqual([]);
        expect(
            sectionsTouchedByBody({
                vertical: 'experience',
                body: { name: 'Tour', meetingPoint: 'Dock' }
            })
        ).toEqual(['basicInfo', 'meetingPoint']);
        expect(
            sectionsTouchedByBody({ vertical: 'accommodation', body: { slug: undefined } })
        ).toEqual([]);
    });
    it('maps business line URL slugs in both directions', () => {
        expect(businessLineToUrlSlug({ value: 'food' })).toEqual({ urlSlug: 'gastronomia' });
        expect(businessLineToUrlSlug({ value: 'nightlife' })).toEqual({ urlSlug: 'noche' });
        expect(urlSlugToBusinessLine({ urlSlug: 'gastronomia' })).toEqual({ value: 'food' });
        expect(urlSlugToBusinessLine({ urlSlug: 'noche' })).toEqual({ value: 'nightlife' });
        expect(urlSlugToBusinessLine({ urlSlug: 'food' })).toEqual({ value: undefined });
    });
});
