/**
 * Tracking of "this bucket now receives another target's data" windows
 * (HOS-1957 G11).
 *
 * A cross-target restore (`hops --target=staging db-restore
 * --from-target=prod`) never writes the prod backup into the staging
 * bucket: it is downloaded to a temp file on the VPS and deleted after
 * `pg_restore`. But from that moment the STAGING database holds prod data,
 * so every backup the staging bucket receives afterwards carries it too:
 * the pre-restore snapshots of later restores, `db-backup-now`, the
 * pre-migrate backup of `db-migrate` and the daily cron. None of those
 * writers know where the data came from.
 *
 * So the restore drops two kinds of marker objects in the destination
 * bucket — data-free, a few bytes of JSON — and the window between them is
 * what `hops r2-purge-foreign-backups` deletes:
 *
 *   hops-foreign-data/open_<TS>_from-<source>_into-<db>.json
 *       written right before `pg_restore` of a cross-target restore.
 *   hops-foreign-data/close_<TS>_into-<db>.json
 *       written after a same-target restore into the MAIN database of a
 *       backup taken before the window opened (the pre-rehearsal backup).
 *
 * Window membership is decided by the R2 `lastModified` of each object
 * against the `lastModified` of the markers — one clock, the bucket's.
 */

import type { R2Object } from './r2.ts';
import type { Target } from './target.ts';

/** Prefix under which every marker lives. Never ends in `.dump`. */
export const FOREIGN_DATA_PREFIX = 'hops-foreign-data/';

const OPEN_MARKER =
    /^hops-foreign-data\/open_([0-9_\-Z]+)_from-(prod|staging)_into-([a-z0-9_]+)\.json$/;
const CLOSE_MARKER = /^hops-foreign-data\/close_([0-9_\-Z]+)_into-([a-z0-9_]+)\.json$/;

/** Key of the marker that opens a window. */
export function buildOpenMarkerKey(input: {
    readonly timestamp: string;
    readonly sourceTarget: Target;
    readonly targetDb: string;
}): string {
    return `${FOREIGN_DATA_PREFIX}open_${input.timestamp}_from-${input.sourceTarget}_into-${input.targetDb}.json`;
}

/** Key of the marker that closes the open window. */
export function buildCloseMarkerKey(input: {
    readonly timestamp: string;
    readonly targetDb: string;
}): string {
    return `${FOREIGN_DATA_PREFIX}close_${input.timestamp}_into-${input.targetDb}.json`;
}

/** A parsed marker. */
export interface ForeignDataMarker {
    readonly kind: 'open' | 'close';
    readonly key: string;
    readonly at: Date;
    /** Database named in the key. */
    readonly targetDb: string;
    /** Source target, for `open` markers. */
    readonly sourceTarget?: Target;
}

/**
 * Parse every marker in a listing. Objects outside the prefix, malformed
 * keys and objects with no `lastModified` are ignored (a marker that cannot
 * be placed in time cannot bound a window).
 */
export function parseMarkers(objects: ReadonlyArray<R2Object>): ReadonlyArray<ForeignDataMarker> {
    const out: ForeignDataMarker[] = [];
    for (const o of objects) {
        if (!o.lastModified) continue;
        const open = OPEN_MARKER.exec(o.key);
        if (open) {
            out.push({
                kind: 'open',
                key: o.key,
                at: o.lastModified,
                targetDb: open[3] ?? '',
                sourceTarget: open[2] as Target
            });
            continue;
        }
        const close = CLOSE_MARKER.exec(o.key);
        if (close) {
            out.push({ kind: 'close', key: o.key, at: o.lastModified, targetDb: close[2] ?? '' });
        }
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** One window: `[start, end)`; `end === null` means still open. */
export interface ForeignDataWindow {
    readonly start: Date;
    readonly end: Date | null;
}

/**
 * Fold the markers, oldest first, into windows. An `open` while a window is
 * already open does not restart it; a `close` with no open window is a
 * no-op.
 */
export function computeWindows(
    markers: ReadonlyArray<ForeignDataMarker>
): ReadonlyArray<ForeignDataWindow> {
    const windows: ForeignDataWindow[] = [];
    let start: Date | null = null;
    for (const m of [...markers].sort((a, b) => a.at.getTime() - b.at.getTime())) {
        if (m.kind === 'open' && start === null) {
            start = m.at;
        } else if (m.kind === 'close' && start !== null) {
            windows.push({ start, end: m.at });
            start = null;
        }
    }
    if (start !== null) windows.push({ start, end: null });
    return windows;
}

/** Whether a window is currently open (the database still holds foreign data). */
export function hasOpenWindow(windows: ReadonlyArray<ForeignDataWindow>): boolean {
    return windows.some((w) => w.end === null);
}

/** Whether a timestamp falls inside any window. */
export function isInsideWindow(at: Date, windows: ReadonlyArray<ForeignDataWindow>): boolean {
    const t = at.getTime();
    return windows.some((w) => t >= w.start.getTime() && (w.end === null || t < w.end.getTime()));
}

/** Result of {@link classifyForeignObjects}. */
export interface ForeignClassification {
    /** Data objects written while a window was open: they may carry foreign data. */
    readonly foreign: ReadonlyArray<R2Object>;
    /** The marker objects themselves. */
    readonly markers: ReadonlyArray<ForeignDataMarker>;
    readonly windows: ReadonlyArray<ForeignDataWindow>;
    /** Data objects with no `lastModified`: cannot be placed, reported apart. */
    readonly undatable: ReadonlyArray<R2Object>;
}

/**
 * Split a bucket listing into what a purge deletes and what it keeps.
 * Every non-marker object written inside a window is foreign — whatever
 * its name, because the daily cron, `db-backup-now`, `db-migrate` and the
 * pre-restore snapshot all write there and none of them is tagged.
 */
export function classifyForeignObjects(objects: ReadonlyArray<R2Object>): ForeignClassification {
    const markers = parseMarkers(objects);
    const windows = computeWindows(markers);
    const foreign: R2Object[] = [];
    const undatable: R2Object[] = [];
    for (const o of objects) {
        if (o.key.startsWith(FOREIGN_DATA_PREFIX)) continue;
        if (!o.lastModified) {
            if (windows.length > 0) undatable.push(o);
            continue;
        }
        if (isInsideWindow(o.lastModified, windows)) foreign.push(o);
    }
    return { foreign, markers, windows, undatable };
}

/**
 * Decide whether a same-target restore closes the open window: it must
 * restore the MAIN database from a backup written before the window opened
 * (the pre-rehearsal backup) — a backup taken inside a window still
 * carries the foreign data.
 */
export function restoreClosesWindow(input: {
    readonly windows: ReadonlyArray<ForeignDataWindow>;
    readonly crossTarget: boolean;
    readonly intoMainDatabase: boolean;
    readonly chosen: R2Object;
}): boolean {
    if (input.crossTarget || !input.intoMainDatabase) return false;
    if (!hasOpenWindow(input.windows)) return false;
    if (!input.chosen.lastModified) return false;
    return !isInsideWindow(input.chosen.lastModified, input.windows);
}
