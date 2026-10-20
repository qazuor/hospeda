import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CutoverManifest } from './types.ts';

/** Result of {@link writeManifest} and of each {@link ManifestWriter} write. */
export interface WriteManifestResult {
    /** Final path, or `null` when the file could not be written (the JSON then went to the fallback sink). */
    readonly writtenTo: string | null;
}

function freePath({ wanted }: { readonly wanted: string }): string {
    if (!existsSync(wanted)) return wanted;
    const { dir, name, ext } = path.parse(wanted);
    for (let n = 1; n < 1_000; n += 1) {
        const candidate = path.join(dir, `${name}-${n}${ext}`);
        if (!existsSync(candidate)) return candidate;
    }
    return path.join(dir, `${name}-${Date.now()}${ext}`);
}

let tempCounter = 0;

/** Writes `text` to a fresh temp file next to `finalPath` (exclusive create), then renames it into place. */
function atomicPut({
    finalPath,
    text
}: {
    readonly finalPath: string;
    readonly text: string;
}): void {
    tempCounter += 1;
    const temp = `${finalPath}.tmp-${process.pid}-${tempCounter}`;
    writeFileSync(temp, text, { flag: 'wx' });
    renameSync(temp, finalPath);
}

const toText = ({ value }: { readonly value: unknown }): string =>
    `${JSON.stringify(value, null, 2)}\n`;

/**
 * Writes a JSON record atomically (temp file, then rename) and never overwrites an existing
 * file: a free name is picked instead. When the write fails for any reason, the full JSON is
 * sent to `fallback` (stderr in the CLI) so the ids are never lost.
 *
 * @param input - the value, the wanted path and the fallback sink
 * @returns where the file landed, or `null` after the fallback dump
 */
export function writeJsonRecord({
    value,
    wantedPath,
    fallback
}: {
    readonly value: unknown;
    readonly wantedPath: string;
    readonly fallback: (text: string) => void;
}): WriteManifestResult {
    const text = toText({ value });
    try {
        mkdirSync(path.dirname(wantedPath), { recursive: true });
        const finalPath = freePath({ wanted: wantedPath });
        atomicPut({ finalPath, text });
        return { writtenTo: finalPath };
    } catch {
        fallback(text);
        return { writtenTo: null };
    }
}

/**
 * Writes one finished run manifest, atomically and never over an existing file.
 *
 * @param input - manifest, wanted path and the fallback sink
 * @returns where the file landed, or `null` after the fallback dump
 */
export function writeManifest({
    manifest,
    wantedPath,
    fallback
}: {
    readonly manifest: CutoverManifest;
    readonly wantedPath: string;
    readonly fallback: (text: string) => void;
}): WriteManifestResult {
    return writeJsonRecord({ value: manifest, wantedPath, fallback });
}

/** Writes the manifest of ONE run, checkpoint after checkpoint. Built by {@link createManifestWriter}. */
export interface ManifestWriter {
    /** Writes a checkpoint (`outcome: 'in-progress'`) or the finished record (any other outcome). */
    readonly write: (manifest: CutoverManifest) => WriteManifestResult;
    /** The file this run owns, or `null` before the first successful write. */
    readonly currentPath: () => string | null;
}

/**
 * True when the file at `file` is a partial manifest of the SAME run (same `startedAt`), which is
 * the only kind of file a checkpoint may replace.
 */
function isOwnPartial({
    file,
    startedAt
}: {
    readonly file: string;
    readonly startedAt: string;
}): boolean {
    try {
        const onDisk: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (typeof onDisk !== 'object' || onDisk === null) return false;
        return (
            Reflect.get(onDisk, 'outcome') === 'in-progress' &&
            Reflect.get(onDisk, 'startedAt') === startedAt
        );
    } catch {
        return false;
    }
}

/**
 * Incremental manifest writer (HOS-1427, owner decision 18). The first write claims a free file
 * name (never an existing file). Each later write replaces THAT file atomically (temp + rename),
 * but only while the file on disk is still this run's partial manifest; a finished record, or a
 * file that is not ours anymore, is never overwritten: the write then claims a new free name.
 * After the finished record is written the writer refuses further writes (they go to `fallback`).
 *
 * A partial manifest is told apart from a finished one by `outcome: 'in-progress'`.
 *
 * @param input - the wanted path and the fallback sink for writes that cannot land on disk
 * @returns the writer of one run
 */
export function createManifestWriter({
    wantedPath,
    fallback
}: {
    readonly wantedPath: string;
    readonly fallback: (text: string) => void;
}): ManifestWriter {
    let claimed: string | null = null;
    let finished = false;

    const write = (manifest: CutoverManifest): WriteManifestResult => {
        if (finished) {
            fallback(toText({ value: manifest }));
            return { writtenTo: null };
        }
        if (manifest.outcome !== 'in-progress') finished = true;
        if (claimed !== null && isOwnPartial({ file: claimed, startedAt: manifest.startedAt })) {
            try {
                atomicPut({ finalPath: claimed, text: toText({ value: manifest }) });
                return { writtenTo: claimed };
            } catch {
                fallback(toText({ value: manifest }));
                return { writtenTo: null };
            }
        }
        const result = writeJsonRecord({
            value: manifest,
            wantedPath: claimed ?? wantedPath,
            fallback
        });
        if (result.writtenTo !== null) claimed = result.writtenTo;
        return result;
    };

    return { write, currentPath: () => claimed };
}
