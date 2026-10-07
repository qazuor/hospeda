import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CutoverManifest } from './types.ts';

/** Result of {@link writeManifest}. */
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

/**
 * Writes the run manifest atomically (temp file, then rename) and never overwrites an
 * existing file: the manifest is written AFTER irreversible cancellations, so losing
 * the ids is worse than a surprising file name. When the write fails for any reason,
 * the full JSON is sent to `fallback` (stderr in the CLI) so the ids are never lost.
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
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    try {
        mkdirSync(path.dirname(wantedPath), { recursive: true });
        const finalPath = freePath({ wanted: wantedPath });
        const temp = `${finalPath}.tmp-${process.pid}`;
        writeFileSync(temp, text, { flag: 'wx' });
        renameSync(temp, finalPath);
        return { writtenTo: finalPath };
    } catch {
        fallback(text);
        return { writtenTo: null };
    }
}
