/**
 * Unit tests for `src/lib/foreign-data.ts` — the window markers that tell
 * `hops r2-purge-foreign-backups` which staging-bucket objects were written
 * while the staging database held prod data (HOS-1957 G11).
 */

import { describe, expect, it } from 'bun:test';
import {
    buildCloseMarkerKey,
    buildOpenMarkerKey,
    classifyForeignObjects,
    computeWindows,
    hasOpenWindow,
    parseMarkers,
    restoreClosesWindow
} from '../src/lib/foreign-data.ts';
import type { R2Object } from '../src/lib/r2.ts';

function obj(key: string, iso: string | null): R2Object {
    return { key, size: 10, lastModified: iso === null ? null : new Date(iso) };
}

const OPEN = buildOpenMarkerKey({
    timestamp: '2026-10-29_120000Z',
    sourceTarget: 'prod',
    targetDb: 'hospeda_staging'
});
const CLOSE = buildCloseMarkerKey({ timestamp: '2026-10-30_180000Z', targetDb: 'hospeda_staging' });

/** The rehearsal as it lands in the staging bucket. */
const REHEARSAL: ReadonlyArray<R2Object> = [
    obj('manual/hospeda-postgres-2026-10-29_110000Z.dump.gpg', '2026-10-29T11:00:00Z'), // E0.1
    obj('manual/pre-restore-2026-10-29_115959Z.dump.gpg', '2026-10-29T11:59:59Z'), // E0.3 snapshot (staging data)
    obj(OPEN, '2026-10-29T12:00:00Z'),
    obj('manual/hospeda-postgres-2026-10-29_150000Z.dump.gpg', '2026-10-29T15:00:00Z'), // E2b
    obj('hospeda-postgres-2026-10-30_030000Z.dump.gpg', '2026-10-30T03:00:00Z'), // daily cron
    obj('manual/pre-migrate-2026-10-30_100000Z.dump.gpg', '2026-10-30T10:00:00Z'), // db-migrate
    obj('manual/pre-restore-2026-10-30_175000Z.dump.gpg', '2026-10-30T17:50:00Z'), // E-FIN snapshot (prod data)
    obj(CLOSE, '2026-10-30T18:00:00Z'),
    obj('hospeda-postgres-2026-10-31_030000Z.dump.gpg', '2026-10-31T03:00:00Z') // after: staging data
];

describe('marker keys', () => {
    it('never ends in .dump, so db-restore never offers a marker as a backup', () => {
        expect(OPEN.endsWith('.dump')).toBe(false);
        expect(OPEN.endsWith('.dump.gpg')).toBe(false);
        expect(CLOSE.endsWith('.dump')).toBe(false);
    });

    it('parses back the source and the database', () => {
        const markers = parseMarkers(REHEARSAL);
        expect(markers.map((m) => m.kind)).toEqual(['open', 'close']);
        expect(markers[0]?.sourceTarget).toBe('prod');
        expect(markers[0]?.targetDb).toBe('hospeda_staging');
        expect(markers[1]?.targetDb).toBe('hospeda_staging');
    });

    it('ignores look-alike keys outside the exact shape', () => {
        const markers = parseMarkers([
            obj('hops-foreign-data/open_x.json', '2026-10-29T12:00:00Z'),
            obj(
                'manual/hops-foreign-data/close_2026-10-29_120000Z_into-x.json',
                '2026-10-29T12:00:00Z'
            )
        ]);
        expect(markers).toHaveLength(0);
    });
});

describe('classifyForeignObjects', () => {
    it('selects exactly the objects written inside the window', () => {
        const result = classifyForeignObjects(REHEARSAL);
        expect(result.foreign.map((o) => o.key)).toEqual([
            'manual/hospeda-postgres-2026-10-29_150000Z.dump.gpg',
            'hospeda-postgres-2026-10-30_030000Z.dump.gpg',
            'manual/pre-migrate-2026-10-30_100000Z.dump.gpg',
            'manual/pre-restore-2026-10-30_175000Z.dump.gpg'
        ]);
    });

    it('keeps the pre-rehearsal backup and everything after the close', () => {
        const keys = classifyForeignObjects(REHEARSAL).foreign.map((o) => o.key);
        expect(keys).not.toContain('manual/hospeda-postgres-2026-10-29_110000Z.dump.gpg');
        expect(keys).not.toContain('manual/pre-restore-2026-10-29_115959Z.dump.gpg');
        expect(keys).not.toContain('hospeda-postgres-2026-10-31_030000Z.dump.gpg');
    });

    it('never lists the markers as foreign data', () => {
        const keys = classifyForeignObjects(REHEARSAL).foreign.map((o) => o.key);
        expect(keys).not.toContain(OPEN);
        expect(keys).not.toContain(CLOSE);
    });

    it('treats a window with no close as running until now', () => {
        const withoutClose = REHEARSAL.filter((o) => o.key !== CLOSE);
        const result = classifyForeignObjects(withoutClose);
        expect(hasOpenWindow(result.windows)).toBe(true);
        expect(result.foreign.map((o) => o.key)).toContain(
            'hospeda-postgres-2026-10-31_030000Z.dump.gpg'
        );
    });

    it('lists nothing when the bucket has no markers', () => {
        const result = classifyForeignObjects(REHEARSAL.filter((o) => !o.key.startsWith('hops-')));
        expect(result.foreign).toHaveLength(0);
        expect(result.windows).toHaveLength(0);
    });

    it('reports undatable objects apart instead of guessing', () => {
        const result = classifyForeignObjects([...REHEARSAL, obj('manual/odd.dump', null)]);
        expect(result.undatable.map((o) => o.key)).toEqual(['manual/odd.dump']);
        expect(result.foreign.map((o) => o.key)).not.toContain('manual/odd.dump');
    });
});

describe('computeWindows', () => {
    it('does not restart a window on a second open', () => {
        const markers = parseMarkers([
            obj(OPEN, '2026-10-29T12:00:00Z'),
            obj(
                buildOpenMarkerKey({
                    timestamp: '2026-10-29_130000Z',
                    sourceTarget: 'prod',
                    targetDb: 'hos1957_scratch'
                }),
                '2026-10-29T13:00:00Z'
            )
        ]);
        const windows = computeWindows(markers);
        expect(windows).toHaveLength(1);
        expect(windows[0]?.start.toISOString()).toBe('2026-10-29T12:00:00.000Z');
        expect(windows[0]?.end).toBeNull();
    });

    it('ignores a close with no open window', () => {
        expect(computeWindows(parseMarkers([obj(CLOSE, '2026-10-30T18:00:00Z')]))).toHaveLength(0);
    });
});

describe('restoreClosesWindow', () => {
    const openWindows = computeWindows(parseMarkers([obj(OPEN, '2026-10-29T12:00:00Z')]));
    const preRehearsal = obj(
        'manual/hospeda-postgres-2026-10-29_110000Z.dump.gpg',
        '2026-10-29T11:00:00Z'
    );
    const e2b = obj('manual/hospeda-postgres-2026-10-29_150000Z.dump.gpg', '2026-10-29T15:00:00Z');

    it('closes when the pre-rehearsal backup is restored into the main database', () => {
        expect(
            restoreClosesWindow({
                windows: openWindows,
                crossTarget: false,
                intoMainDatabase: true,
                chosen: preRehearsal
            })
        ).toBe(true);
    });

    it('does not close when restoring a backup taken inside the window (the 2b)', () => {
        expect(
            restoreClosesWindow({
                windows: openWindows,
                crossTarget: false,
                intoMainDatabase: true,
                chosen: e2b
            })
        ).toBe(false);
    });

    it('does not close on a scratch-database restore', () => {
        expect(
            restoreClosesWindow({
                windows: openWindows,
                crossTarget: false,
                intoMainDatabase: false,
                chosen: preRehearsal
            })
        ).toBe(false);
    });

    it('does not close on a cross-target restore', () => {
        expect(
            restoreClosesWindow({
                windows: openWindows,
                crossTarget: true,
                intoMainDatabase: true,
                chosen: preRehearsal
            })
        ).toBe(false);
    });

    it('does not close when no window is open', () => {
        expect(
            restoreClosesWindow({
                windows: [],
                crossTarget: false,
                intoMainDatabase: true,
                chosen: preRehearsal
            })
        ).toBe(false);
    });
});
