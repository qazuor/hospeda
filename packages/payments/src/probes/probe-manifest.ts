/**
 * The probe manifest: the ids of the provider subjects that belong to a live
 * measurement, which the cutover must leave alone (B1.md "Las sondas son parte
 * del entregable"; `B/09` §2.4).
 *
 * The list lives as PURE DATA in `probes.json`, next to this file, at the fixed
 * path `PROBE_MANIFEST_PATH`. Two readers, two ways:
 * - production code imports THIS module, so a missing or malformed manifest
 *   fails the build or the module load, never silently empties the list;
 * - the cutover script reads the JSON file by its path, without importing any
 *   TypeScript.
 * Moving or renaming the file breaks the second reader: keep the path.
 */
import { z } from 'zod';
import probeManifestJson from './probes.json';

/** Repo-relative path of the JSON file. Other tooling reads it from here. */
export const PROBE_MANIFEST_PATH = 'packages/payments/src/probes/probes.json';

/** The manifest shape: a list of distinct, non-empty provider subject ids. */
export const ProbeManifestSchema = z.strictObject({
    ids: z
        .array(z.string().trim().min(1))
        .refine((ids) => new Set(ids).size === ids.length, { message: 'probe ids must be unique' })
});

/** A validated probe manifest. */
export interface ProbeManifest {
    readonly ids: readonly string[];
}

/**
 * Validates a manifest.
 *
 * @param args.input - The raw manifest (the parsed JSON)
 * @returns The validated, frozen manifest
 * @throws ZodError when the shape is wrong
 */
export function parseProbeManifest(args: { readonly input: unknown }): {
    readonly manifest: ProbeManifest;
} {
    const { ids } = ProbeManifestSchema.parse(args.input);
    return { manifest: Object.freeze({ ids: Object.freeze([...ids]) }) };
}

/** The versioned manifest, validated at module load. */
export const PROBE_MANIFEST: ProbeManifest = parseProbeManifest({
    input: probeManifestJson
}).manifest;

/**
 * Says whether a provider subject belongs to a probe.
 *
 * @param args.id - The provider subject id
 * @param args.manifest - The manifest to check against (defaults to the versioned one)
 * @returns Whether the id is listed
 */
export function isProbeSubject(args: { readonly id: string; readonly manifest?: ProbeManifest }): {
    readonly isProbe: boolean;
} {
    return { isProbe: (args.manifest ?? PROBE_MANIFEST).ids.includes(args.id) };
}
