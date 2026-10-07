import { readFileSync } from 'node:fs';
import { z } from 'zod';

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

/**
 * The slice of a cutover manifest the abort inverses read: the version, the outcome (a partial
 * `in-progress` manifest is accepted on purpose, it is what an abort leaves) and the step-4b ids,
 * each optional because a run that aborted before step 4b has none of them.
 */
export const inverseManifestSchema = z.object({
    schemaVersion: z.literal(1),
    outcome: z.enum(['in-progress', 'ok', 'failed', 'dry-run']),
    probeId: safeId.optional(),
    paymentId: safeId.optional(),
    refundId: safeId.optional()
});

/** What {@link readInverseManifest} returns. */
export type InverseManifest = z.infer<typeof inverseManifestSchema>;

/**
 * Reads a cutover manifest BY FILE PATH and validates the fields the inverses act on.
 *
 * @param input - path of the manifest written by the cutover run
 * @returns the validated step-4b ids (each may be absent)
 * @throws Error when the file is unreadable, not JSON, or not a version-1 manifest
 */
export function readInverseManifest({ path }: { readonly path: string }): InverseManifest {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        throw new Error(`cutover manifest not found or unreadable at ${path}`);
    }
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        throw new Error(`cutover manifest at ${path} is not valid JSON`);
    }
    const parsed = inverseManifestSchema.safeParse(json);
    if (!parsed.success) {
        throw new Error(`cutover manifest at ${path} is not a version-1 manifest with safe ids`);
    }
    return parsed.data;
}
