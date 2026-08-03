/**
 * Unit tests for the commerce media row builders (HOS-372).
 *
 * These builders feed BOTH halves of the dual-write: the baseline seeders
 * (`example/gastronomies.seed.ts`, `example/experiences.seed.ts`) and the
 * `0034-hos-372-commerce-media-to-relational` backfill migration. Sharing one
 * builder is what guarantees a freshly-seeded database and a backfilled one end
 * up with identical rows, so the ordering and defaulting rules are pinned here.
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildExperienceMediaRows,
    buildGastronomyMediaRows
} from '../src/utils/commerce-media-builder.js';
import type { FixtureMediaBlock } from '../src/utils/media-rows-builder.js';

const GASTRONOMY_ID = '390a09a5-dee0-5a59-83b1-21d4a62bd0c5';
const EXPERIENCE_ID = '686b70d4-aa3f-57c6-8958-a83eca33cd69';

const MEDIA: FixtureMediaBlock = {
    featuredImage: { url: 'https://cdn.example.com/featured.jpg', alt: 'Featured' },
    gallery: [
        { url: 'https://cdn.example.com/g1.jpg', alt: 'One' },
        { url: 'https://cdn.example.com/g2.jpg', alt: 'Two' }
    ]
};

describe('buildGastronomyMediaRows', () => {
    it('should stamp the gastronomy foreign key on every row', () => {
        const rows = buildGastronomyMediaRows({ gastronomyId: GASTRONOMY_ID, media: MEDIA });

        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row.gastronomyId).toBe(GASTRONOMY_ID);
        }
    });

    it('should place the featured image first with a dense 0-based sortOrder', () => {
        const rows = buildGastronomyMediaRows({ gastronomyId: GASTRONOMY_ID, media: MEDIA });

        expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
        expect(rows.map((row) => row.isFeatured)).toEqual([true, false, false]);
        expect(rows[0]?.url).toBe('https://cdn.example.com/featured.jpg');
    });

    it('should mark exactly one row featured, satisfying the unique index', () => {
        // A second featured row would violate the partial unique index on
        // (gastronomy_id) WHERE is_featured — the insert would fail at runtime.
        const rows = buildGastronomyMediaRows({ gastronomyId: GASTRONOMY_ID, media: MEDIA });

        expect(rows.filter((row) => row.isFeatured)).toHaveLength(1);
    });

    it('should start the gallery at sortOrder 0 when there is no featured image', () => {
        const rows = buildGastronomyMediaRows({
            gastronomyId: GASTRONOMY_ID,
            media: { gallery: MEDIA.gallery }
        });

        expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
        expect(rows.every((row) => row.isFeatured === false)).toBe(true);
    });

    it('should default moderation to APPROVED and keep rows visible and unarchived', () => {
        const rows = buildGastronomyMediaRows({ gastronomyId: GASTRONOMY_ID, media: MEDIA });

        for (const row of rows) {
            expect(row.moderationState).toBe(ModerationStatusEnum.APPROVED);
            expect(row.state).toBe('visible');
            expect(row.archivedAt).toBeNull();
        }
    });

    it('should honour an explicit moderation state instead of forcing APPROVED', () => {
        // Fixtures that exercise the rejected-moderation branch rely on this.
        const rows = buildGastronomyMediaRows({
            gastronomyId: GASTRONOMY_ID,
            media: {
                featuredImage: { url: 'https://cdn.example.com/f.jpg' },
                gallery: [{ url: 'https://cdn.example.com/r.jpg', moderationState: 'REJECTED' }]
            }
        });

        expect(rows[0]?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(rows[1]?.moderationState).toBe(ModerationStatusEnum.REJECTED);
    });

    it('should skip gallery entries with no url without leaving a sortOrder gap', () => {
        const rows = buildGastronomyMediaRows({
            gastronomyId: GASTRONOMY_ID,
            media: {
                gallery: [
                    { url: 'https://cdn.example.com/a.jpg' },
                    { url: '' },
                    { url: 'https://cdn.example.com/b.jpg' }
                ]
            }
        });

        // A gap here would break the dense-ordering invariant the remove/reorder
        // operations maintain at runtime.
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
    });

    it('should return no rows for an empty media block', () => {
        expect(buildGastronomyMediaRows({ gastronomyId: GASTRONOMY_ID, media: {} })).toEqual([]);
    });
});

describe('buildExperienceMediaRows', () => {
    it('should stamp the experience foreign key instead of the gastronomy one', () => {
        const rows = buildExperienceMediaRows({ experienceId: EXPERIENCE_ID, media: MEDIA });

        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row.experienceId).toBe(EXPERIENCE_ID);
        }
    });

    it('should produce the same ordering and defaults as the gastronomy builder', () => {
        // The two verticals' tables are identical apart from the FK, so their
        // rows must be identical too — a divergence here means the shared
        // builder was bypassed for one of them.
        const gastronomyRows = buildGastronomyMediaRows({
            gastronomyId: GASTRONOMY_ID,
            media: MEDIA
        });
        const experienceRows = buildExperienceMediaRows({
            experienceId: EXPERIENCE_ID,
            media: MEDIA
        });

        const withoutOwner = (rows: Array<Record<string, unknown>>) =>
            rows.map(({ gastronomyId: _g, experienceId: _e, ...rest }) => rest);

        expect(withoutOwner(experienceRows)).toEqual(withoutOwner(gastronomyRows));
    });
});
