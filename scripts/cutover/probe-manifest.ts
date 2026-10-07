import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** Shape of the versioned probe manifest (`{ "ids": string[] }`), validated locally. */
export const probeManifestSchema = z.object({
    ids: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/))
});

/**
 * Reads the probe manifest BY FILE PATH (a JSON read, never an import) and validates it.
 * The file is owned by another unit; this script only consumes it.
 *
 * @param input - absolute or cwd-relative path of the manifest
 * @returns the enumerated probe ids, deduplicated
 * @throws Error when the file is unreadable, not JSON, or does not match the schema
 */
export function readProbeManifest({ path }: { readonly path: string }): readonly string[] {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        throw new Error(`probe manifest not readable at ${path}`);
    }
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error(`probe manifest at ${path} is not valid JSON`);
    }
    const parsed = probeManifestSchema.safeParse(json);
    if (!parsed.success) {
        throw new Error(`probe manifest at ${path} does not match { "ids": string[] }`);
    }
    return [...new Set(parsed.data.ids)];
}
