import { describe, expect, it } from 'bun:test';
import type { CatalogEntry } from '../src/commands/whats-new/catalog.ts';
import { renderPendingEntries } from '../src/commands/whats-new/pending.ts';

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
    return {
        id: '2026-09-08-daily-menu-window',
        publishedAt: 'on-promotion',
        roles: ['GASTRONOMY_OWNER'],
        highlight: false,
        titleEs: 'Publicá el menú del día',
        bodyEs: 'Ahora podés cargar el menú del día desde tu panel.',
        originPrs: [3271, 3274],
        start: 0,
        end: 0,
        ...overrides
    };
}

describe('renderPendingEntries', () => {
    it('should print the entry TEXT, not just a count — reviewing must not require opening a file', () => {
        const report = renderPendingEntries({ entries: [makeEntry()] });

        expect(report).toContain('2026-09-08-daily-menu-window');
        expect(report).toContain('Publicá el menú del día');
        expect(report).toContain('Ahora podés cargar el menú del día desde tu panel.');
        expect(report).toContain('GASTRONOMY_OWNER');
        expect(report).toContain('#3271, #3274');
    });

    it('should offer the exact drop command, with every pending id already filled in', () => {
        const report = renderPendingEntries({
            entries: [makeEntry(), makeEntry({ id: 'second-one' })]
        });

        expect(report).toContain('hops whats-new drop 2026-09-08-daily-menu-window second-one');
    });

    it('should say "everyone" when the entry declares no roles', () => {
        const report = renderPendingEntries({ entries: [makeEntry({ roles: null })] });

        expect(report).toContain('everyone');
    });

    it('should mark a highlight entry, since it auto-opens a modal for users', () => {
        const report = renderPendingEntries({ entries: [makeEntry({ highlight: true })] });

        expect(report).toContain('[highlight]');
    });

    it('should ignore already-published entries entirely', () => {
        const report = renderPendingEntries({
            entries: [
                makeEntry({ id: 'live', publishedAt: '2026-09-01T00:00:00Z' }),
                makeEntry({ id: 'pending-one' })
            ]
        });

        expect(report).toContain('pending-one');
        expect(report).not.toContain('live');
        expect(report).toContain('1 What');
    });

    it('should say plainly when nothing is awaiting review', () => {
        const report = renderPendingEntries({
            entries: [makeEntry({ publishedAt: '2026-09-01T00:00:00Z' })]
        });

        expect(report).toContain('No What');
        expect(report).not.toContain('hops whats-new drop');
    });

    it('should say the entries are invisible until the promotion, so deleting one costs nothing', () => {
        const report = renderPendingEntries({ entries: [makeEntry()] });

        expect(report).toContain('INVISIBLE');
    });
});
