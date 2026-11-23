import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isRestorableArchiveOrigin,
    type PublicationQueueEntry,
    planRestoration
} from '../../src/publication/publication-order';

const entry = (id: string, publishedAt: string | null): PublicationQueueEntry => ({
    id,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    publishedAt: publishedAt ? new Date(publishedAt) : null
});

describe('HOS-1640 restoration rules shared by PB7 and the MP4 preview', () => {
    it.each([
        [PublicationStatusEnum.PUBLISHED, true],
        [PublicationStatusEnum.UNPUBLISHED_BY_BILLING, true],
        [PublicationStatusEnum.DRAFT, false],
        [PublicationStatusEnum.MODERATED, false],
        [null, false],
        [undefined, false]
    ])('PB4/PB5: an archive origin of %s is restorable = %s', (origin, expected) => {
        // Arrange / Act
        const restorable = isRestorableArchiveOrigin({ origin });

        // Assert
        expect(restorable).toBe(expected);
    });

    it('PB7: gives the free slots to the newest manual publish first and leaves the rest out', () => {
        // Arrange
        const entries = [
            entry('old', '2026-01-01T00:00:00Z'),
            entry('new', '2026-03-01T00:00:00Z'),
            entry('cut', null)
        ];

        // Act
        const plan = planRestoration({ entries, available: 1 });

        // Assert
        expect(plan.restoring.map(({ id }) => id)).toEqual(['new']);
        expect(plan.withoutSlot.map(({ id }) => id)).toEqual(['old', 'cut']);
    });

    it('PB7: a null declared limit restores nothing, like recalculateCoverage', () => {
        // Arrange
        const entries = [entry('a', '2026-01-01T00:00:00Z')];

        // Act
        const plan = planRestoration({ entries, available: null });

        // Assert
        expect(plan.restoring).toEqual([]);
        expect(plan.withoutSlot.map(({ id }) => id)).toEqual(['a']);
    });

    it('PB7: a negative availability is clamped to zero', () => {
        // Arrange / Act
        const plan = planRestoration({ entries: [entry('a', null)], available: -2 });

        // Assert
        expect(plan.restoring).toEqual([]);
        expect(plan.withoutSlot).toHaveLength(1);
    });

    it('HOS-1810: a candidate at a taken place keeps no slot and the next one takes it', () => {
        // Arrange
        const entries = [
            entry('a', '2026-03-01T00:00:00Z'),
            entry('b', '2026-02-01T00:00:00Z'),
            entry('c', '2026-01-01T00:00:00Z')
        ];
        const places = new Map([
            ['a', { key: 'k1', exempt: false }],
            ['b', { key: 'k1', exempt: false }],
            ['c', { key: 'k2', exempt: false }]
        ]);

        // Act
        const plan = planRestoration({ entries, available: 2, places });

        // Assert
        expect(plan.restoring.map(({ id }) => id)).toEqual(['a', 'c']);
        expect(plan.locationConflict.map(({ id }) => id)).toEqual(['b']);
        expect(plan.withoutSlot).toEqual([]);
    });

    it('HOS-1810: a listing that stays published blocks its place; exceptions and null keys do not', () => {
        // Arrange
        const entries = [
            entry('blocked', '2026-03-01T00:00:00Z'),
            entry('exempt', '2026-02-01T00:00:00Z'),
            entry('keyless', '2026-01-01T00:00:00Z')
        ];
        const places = new Map([
            ['live', { key: 'k1', exempt: false }],
            ['blocked', { key: 'k1', exempt: false }],
            ['exempt', { key: 'k1', exempt: true }],
            ['keyless', { key: null, exempt: false }]
        ]);

        // Act
        const plan = planRestoration({ entries, available: 3, places, publishedIds: ['live'] });

        // Assert
        expect(plan.restoring.map(({ id }) => id)).toEqual(['exempt', 'keyless']);
        expect(plan.locationConflict.map(({ id }) => id)).toEqual(['blocked']);
    });
});
