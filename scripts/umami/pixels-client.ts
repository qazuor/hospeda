import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
    listAll,
    pickUnique,
    type UmamiClientConfig,
    type UpsertResult,
    umamiRequest
} from './client.js';

/**
 * Pixel endpoints of the Umami 3.5 client (HOS-2359 §6.E): one open pixel per email
 * catalog template, created from the generated manifest
 * `packages/notifications/generated/email-pixel-manifest.json`.
 *
 * Natural key: `slug` (Umami enforces it unique instance-wide; a duplicate POST
 * answers 500 with an empty body, measured M-1). Same upsert semantics as the other
 * resources: created / updated (name drift) / unchanged, reads only in dry-run.
 * Newsletter campaign pixels (`newsletter-*`) are created by the api at dispatch and
 * are never touched here.
 */

/** Slug prefix of the template pixels this script manages. */
export const MANAGED_PIXEL_PREFIX = 'email-';

/** Path of the generated manifest, relative to the repository root. */
export const EMAIL_PIXEL_MANIFEST_REPO_PATH =
    'packages/notifications/generated/email-pixel-manifest.json';

/** Zod schema of a pixel as returned by the API. */
export const pixelSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
});

/** A pixel as returned by the API. */
export type UmamiPixel = z.infer<typeof pixelSchema>;

/** Desired state of a pixel. Natural key: `slug`. */
export interface PixelDefinition {
    readonly name: string;
    readonly slug: string;
}

const manifestSchema = z
    .array(
        z.object({
            key: z.string().min(1),
            name: z.string().min(1),
            utmCampaign: z.string().min(1),
            pixelSlug: z.string().startsWith(MANAGED_PIXEL_PREFIX).max(100)
        })
    )
    .min(1);

/**
 * Reads the generated email pixel manifest and maps it to pixel definitions.
 *
 * @param input.path - Absolute path of the manifest; defaults to the repository's
 * @returns One definition per catalog template
 * @throws {Error} When the file is missing or does not match the manifest shape
 */
export function loadEmailPixelDefinitions(
    input: { readonly path?: string } = {}
): readonly PixelDefinition[] {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const path = input.path ?? join(repoRoot, EMAIL_PIXEL_MANIFEST_REPO_PATH);
    const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf-8')));
    if (!parsed.success) {
        throw new Error(
            `${EMAIL_PIXEL_MANIFEST_REPO_PATH} is malformed; run pnpm --filter @repo/notifications email:pixel-manifest`
        );
    }
    return parsed.data.map((entry) => ({ name: entry.name, slug: entry.pixelSlug }));
}

/**
 * Lists every pixel the credential can see (all pages). Umami scopes the list to the
 * caller's own pixels (measured M-4).
 *
 * @param input.config - Client configuration
 */
export function listPixels(input: {
    readonly config: UmamiClientConfig;
}): Promise<readonly UmamiPixel[]> {
    return listAll({ config: input.config, path: '/api/pixels', schema: pixelSchema });
}

/**
 * Creates the pixel when absent, renames it when its name drifted, does nothing when
 * equal. In dry-run it only reads.
 *
 * @param input.config - Client configuration (`dryRun` honoured)
 * @param input.definition - Desired pixel
 * @param input.existing - Pixels already listed (one list call per run, not per pixel)
 * @returns What happened (or would happen)
 * @throws {UmamiApiError} On API failure or when the slug is ambiguous
 */
export async function upsertPixel(input: {
    readonly config: UmamiClientConfig;
    readonly definition: PixelDefinition;
    readonly existing: readonly UmamiPixel[];
}): Promise<UpsertResult<UmamiPixel>> {
    const { config, definition } = input;
    const dryRun = config.dryRun === true;
    const current = pickUnique({
        matches: input.existing.filter((pixel) => pixel.slug === definition.slug),
        label: `pixels with slug "${definition.slug}"`,
        endpoint: '/api/pixels'
    });

    if (!current) {
        if (dryRun) return { action: 'created', dryRun, resource: null };
        const created = await umamiRequest({
            config,
            method: 'POST',
            path: '/api/pixels',
            body: { name: definition.name, slug: definition.slug },
            schema: pixelSchema
        });
        return { action: 'created', dryRun, resource: created };
    }

    if (current.name === definition.name) {
        return { action: 'unchanged', dryRun, resource: current };
    }
    if (dryRun) return { action: 'updated', dryRun, resource: current };
    const updated = await umamiRequest({
        config,
        method: 'POST',
        path: `/api/pixels/${current.id}`,
        body: { name: definition.name },
        schema: pixelSchema
    });
    return { action: 'updated', dryRun, resource: updated };
}
