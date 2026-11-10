/**
 * @file business-line-sections.test.ts
 * @description HOS-1865 (6.5, AC:6:9). The plan comparison table needs to know
 * which public business lines own a catalog section without importing the
 * catalog value itself (G-FAC-03 keeps its importers on a closed allowlist).
 * `resolveSectionBusinessLines` is that read-only bridge.
 */

import { describe, expect, it } from 'vitest';
import { resolveSectionBusinessLines } from '../../src/catalog/business-lines.js';

describe('resolveSectionBusinessLines', () => {
    it('TEST:6.5:3 maps each owned venue section to its public line', () => {
        expect(
            resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'menu' }).map(
                (line) => line.value
            )
        ).toEqual(['food']);
        expect(
            resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'dailySpecials' }).map(
                (line) => line.value
            )
        ).toEqual(['food']);
        expect(
            resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'nightInfo' }).map(
                (line) => line.value
            )
        ).toEqual(['nightlife']);
    });

    it('TEST:6.5:3 returns no owner for a section no public line declares', () => {
        expect(
            resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'venueEvents' })
        ).toEqual([]);
    });

    it('TEST:6.5:3 returns no owner for a common section or a non-public line', () => {
        expect(resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'basicInfo' })).toEqual(
            []
        );
        // The experience vertical only has the non-public `standard` line.
        expect(
            resolveSectionBusinessLines({ vertical: 'experience', sectionId: 'meetingPoint' })
        ).toEqual([]);
    });

    it('carries the public URL slug beside the value', () => {
        const [line] = resolveSectionBusinessLines({ vertical: 'venue', sectionId: 'menu' });
        expect(line?.value).toBe('food');
        expect(typeof line?.urlSlug).toBe('string');
        expect(line?.urlSlug.length).toBeGreaterThan(0);
    });
});
