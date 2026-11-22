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
});
