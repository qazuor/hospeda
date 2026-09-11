import { describe, expect, it } from 'bun:test';
import { resolvePublishedAtMarkers } from '../src/commands/whats-new/resolve-dates.ts';

const MERGED_AT = '2026-09-10T18:00:00Z';

describe('resolvePublishedAtMarkers', () => {
    it('is a true no-op when zero markers are present', () => {
        const content = `
export const whatsNewEntries = [
    {
        id: '2026-09-01-real-date',
        publishedAt: '2026-09-01T00:00:00Z',
        title: { es: 'hola' }
    }
];
`;

        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT });

        expect(result.resolvedCount).toBe(0);
        expect(result.resolvedIds).toEqual([]);
        // True no-op: byte-identical to the input, not just "equivalent".
        expect(result.updatedContent).toBe(content);
    });

    it('resolves a single marker to the merge timestamp exactly', () => {
        const content = `
export const whatsNewEntries = [
    {
        id: '2026-09-10-single-entry',
        publishedAt: 'on-promotion',
        title: { es: 'hola' }
    }
];
`;

        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT });

        expect(result.resolvedCount).toBe(1);
        expect(result.resolvedIds).toEqual(['2026-09-10-single-entry']);
        expect(result.updatedContent).toContain(`publishedAt: '${MERGED_AT}'`);
        expect(result.updatedContent).not.toContain('on-promotion');
    });

    it('spreads hours descending across multiple markers while preserving declared newest-first order', () => {
        const content = `
export const whatsNewEntries = [
    {
        id: '2026-09-10-newest',
        publishedAt: 'on-promotion',
        title: { es: 'newest' }
    },
    {
        id: '2026-09-10-middle',
        publishedAt: 'on-promotion',
        title: { es: 'middle' }
    },
    {
        id: '2026-09-10-oldest',
        publishedAt: 'on-promotion',
        title: { es: 'oldest' }
    }
];
`;

        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT, hoursApart: 1 });

        expect(result.resolvedCount).toBe(3);
        // Declared (newest-first) order preserved exactly in resolvedIds.
        expect(result.resolvedIds).toEqual([
            '2026-09-10-newest',
            '2026-09-10-middle',
            '2026-09-10-oldest'
        ]);

        expect(result.updatedContent).toContain("publishedAt: '2026-09-10T18:00:00Z'"); // newest = merge time
        expect(result.updatedContent).toContain("publishedAt: '2026-09-10T17:00:00Z'"); // middle = -1h
        expect(result.updatedContent).toContain("publishedAt: '2026-09-10T16:00:00Z'"); // oldest = -2h
        expect(result.updatedContent).not.toContain('on-promotion');

        // The three resolved dates must appear in file order matching declared
        // order: newest's date text physically precedes middle's, which
        // precedes oldest's.
        const newestPos = result.updatedContent.indexOf('2026-09-10T18:00:00Z');
        const middlePos = result.updatedContent.indexOf('2026-09-10T17:00:00Z');
        const oldestPos = result.updatedContent.indexOf('2026-09-10T16:00:00Z');
        expect(newestPos).toBeLessThan(middlePos);
        expect(middlePos).toBeLessThan(oldestPos);
    });

    it('never touches an entry that already carries a real date, marker or not, in the same file', () => {
        const content = `
export const whatsNewEntries = [
    {
        id: '2026-09-10-marker',
        publishedAt: 'on-promotion',
        title: { es: 'marker' }
    },
    {
        id: '2026-09-01-already-dated',
        publishedAt: '2026-09-01T00:00:00Z',
        title: { es: 'already dated, must stay untouched' }
    }
];
`;

        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT });

        expect(result.resolvedCount).toBe(1);
        expect(result.resolvedIds).toEqual(['2026-09-10-marker']);
        // The real date is byte-identical to its original text.
        expect(result.updatedContent).toContain("publishedAt: '2026-09-01T00:00:00Z'");
        expect(result.updatedContent).toContain(`publishedAt: '${MERGED_AT}'`);
    });

    it('preserves every other field, comment and formatting byte-for-byte around a resolved marker', () => {
        const content = `// leading comment, must survive untouched
export const whatsNewEntries = [
    {
        id: '2026-09-10-full-entry',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['HOST'],
        title: { es: 'título', en: 'title', pt: 'título' },
        body: { es: 'cuerpo', en: 'body', pt: 'corpo' }
    }
];
`;

        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT });

        expect(result.resolvedCount).toBe(1);
        expect(result.updatedContent).toContain('// leading comment, must survive untouched');
        expect(result.updatedContent).toContain('highlight: true');
        expect(result.updatedContent).toContain("roles: ['HOST']");
        expect(result.updatedContent).toContain(
            "title: { es: 'título', en: 'title', pt: 'título' }"
        );
        expect(result.updatedContent).toContain("body: { es: 'cuerpo', en: 'body', pt: 'corpo' }");
    });

    it('throws on an unparseable mergedAt rather than silently producing an Invalid Date string', () => {
        const content = `
export const whatsNewEntries = [
    { id: 'x', publishedAt: 'on-promotion' }
];
`;
        expect(() => resolvePublishedAtMarkers({ content, mergedAt: 'not-a-real-date' })).toThrow();
    });
});
