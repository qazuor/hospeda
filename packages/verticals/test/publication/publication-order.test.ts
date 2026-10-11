import { describe, expect, it } from 'vitest';
import {
    comparePublicationOrder,
    orderReturningCandidates,
    type PublicationQueueEntry,
    selectSurplusToLower
} from '../../src/publication/publication-order';

const date = (value: string) => new Date(value);

describe('publication order', () => {
    it('TEST:V6:5 orders publication ties by creation and id, with null first', () => {
        const publishedAt = date('2026-01-01T00:00:00Z');
        const sameCreated = date('2025-01-01T00:00:00Z');
        const entries: PublicationQueueEntry[] = [
            { id: 'z', createdAt: sameCreated, publishedAt },
            { id: 'a', createdAt: sameCreated, publishedAt },
            { id: 'older', createdAt: date('2024-01-01T00:00:00Z'), publishedAt },
            { id: 'recent-null', createdAt: date('2026-01-01T00:00:00Z'), publishedAt: null },
            { id: 'old-null', createdAt: date('2024-01-01T00:00:00Z'), publishedAt: null },
            { id: 'ancient', createdAt: sameCreated, publishedAt: date('1900-01-01T00:00:00Z') }
        ];
        expect(orderReturningCandidates({ entries }).map(({ id }) => id)).toEqual([
            'old-null',
            'recent-null',
            'ancient',
            'older',
            'a',
            'z'
        ]);
        expect(comparePublicationOrder(entries[4]!, entries[5]!)).toBeLessThan(0);
    });

    it('TEST:V6:5 selects the correct surplus at boundary limits', () => {
        const entries = ['a', 'b', 'c'].map((id, index) => ({
            id,
            createdAt: date(`2020-01-0${index + 1}T00:00:00Z`),
            publishedAt: date(`2021-01-0${index + 1}T00:00:00Z`)
        }));
        expect(
            selectSurplusToLower({ published: entries, limit: 0 }).map((item) => item.id)
        ).toEqual(['c', 'b', 'a']);
        expect(
            selectSurplusToLower({ published: entries, limit: Number.POSITIVE_INFINITY })
        ).toEqual([]);
        expect(selectSurplusToLower({ published: entries, limit: 3 })).toEqual([]);
        expect(selectSurplusToLower({ published: entries, limit: 4 })).toEqual([]);
        expect(
            selectSurplusToLower({ published: entries, limit: 2 }).map((item) => item.id)
        ).toEqual(['c']);
    });

    it('TEST:V6:5 keeps the published prefix independent of input permutation', () => {
        const entries = ['a', 'b', 'c', 'd'].map((id, index) => ({
            id,
            createdAt: date(`2020-01-0${index + 1}T00:00:00Z`),
            publishedAt: date(`2021-01-0${index + 1}T00:00:00Z`)
        }));
        for (const input of [
            entries,
            [...entries].reverse(),
            [entries[2]!, entries[0]!, entries[3]!, entries[1]!]
        ]) {
            expect(
                selectSurplusToLower({ published: input, limit: 2 }).map(({ id }) => id)
            ).toEqual(['d', 'c']);
            expect(
                orderReturningCandidates({ entries: input })
                    .slice(0, 2)
                    .map(({ id }) => id)
            ).toEqual(['a', 'b']);
        }
    });
});
