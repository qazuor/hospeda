import { describe, expect, it } from 'vitest';
import {
    buildReport,
    geocodeAttempts,
    geocodeSuccessRate,
    type PipelineStats
} from '../../scripts/poi-pipeline/report.js';

const STATS: PipelineStats = {
    totalRows: 914,
    totalFixtures: 914,
    geocode: {
        alreadyHadCoords: 197,
        resolvedHigh: 500,
        resolvedMedium: 150,
        rejectedLowConfidence: 30,
        unresolved: 37,
        unresolvedSlugs: ['a', 'b']
    },
    categoryCoverageUsed: 40,
    categoryCoverageTotal: 40,
    slugCollisionsResolved: 46,
    destinationFixupsApplied: 2,
    relationsPrimary: 914,
    relationsNearby: 120,
    unresolvedNearby: []
};

describe('geocodeAttempts + geocodeSuccessRate', () => {
    it('sums the four coordinate-less outcomes (AC-8 basis)', () => {
        // 500 + 150 + 30 + 37 = 717 (the coordinate-less rows)
        expect(geocodeAttempts(STATS.geocode)).toBe(717);
    });

    it('computes the high/medium success rate', () => {
        expect(geocodeSuccessRate(STATS.geocode)).toBeCloseTo((500 + 150) / 717, 5);
    });

    it('reports a full rate when there was nothing to geocode', () => {
        expect(
            geocodeSuccessRate({
                alreadyHadCoords: 10,
                resolvedHigh: 0,
                resolvedMedium: 0,
                rejectedLowConfidence: 0,
                unresolved: 0,
                unresolvedSlugs: []
            })
        ).toBe(1);
    });
});

describe('buildReport', () => {
    it('produces JSON that round-trips the stats', () => {
        const { json } = buildReport(STATS);
        expect(JSON.parse(json)).toEqual(STATS);
    });

    it('produces Markdown with the headline totals', () => {
        const { markdown } = buildReport(STATS);
        expect(markdown).toContain('Input rows: **914**');
        expect(markdown).toContain('Slug collisions resolved: **46**');
        expect(markdown).toContain('Category coverage: **40/40**');
        expect(markdown).toContain('Destination fixups applied: **2**');
        expect(markdown).toContain('PRIMARY: **914**');
    });
});
