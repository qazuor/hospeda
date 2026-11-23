/**
 * The per-template Umami pixel manifest (HOS-2359 §6.E.3, owner decision OD-2).
 *
 * `pnpm umami:setup` cannot import this package (the root depends on `@repo/config`
 * only, and the catalog pulls React templates), so the list of pixels it must create
 * is a committed, generated file: `generated/email-pixel-manifest.json`. The catalog
 * attribution guard fails when the committed file differs from what this function
 * derives from {@link EMAIL_CATALOG}.
 *
 * @module catalog/pixel-manifest
 */

import { buildEmailTemplateCampaign, buildEmailTemplatePixelSlug } from '@repo/analytics';
import { EMAIL_CATALOG } from './catalog.js';
import type { EmailCatalogEntry, EmailCatalogKey } from './types.js';

/** Path of the committed manifest, relative to the package root. */
export const EMAIL_PIXEL_MANIFEST_PATH = 'generated/email-pixel-manifest.json';

/** Command that regenerates the manifest. */
export const EMAIL_PIXEL_MANIFEST_COMMAND =
    'pnpm --filter @repo/notifications email:pixel-manifest';

/** One pixel `umami:setup` creates for one catalog template. */
export interface EmailPixelManifestEntry {
    /** Catalog key, e.g. `auth.reset-password`. */
    readonly key: EmailCatalogKey;
    /** Umami pixel name: `Email · <catalog Spanish name>`. */
    readonly name: string;
    /** `utm_campaign` its links carry. */
    readonly utmCampaign: string;
    /** Umami pixel slug (`email-<key token>`). */
    readonly pixelSlug: string;
}

/**
 * Derives the pixel manifest from the catalog, sorted by key.
 *
 * @param input - Optional `catalog` override (tests); defaults to {@link EMAIL_CATALOG}
 * @returns One entry per catalog template
 */
export function buildEmailPixelManifest(
    input: { readonly catalog?: readonly EmailCatalogEntry[] } = {}
): readonly EmailPixelManifestEntry[] {
    const catalog = input.catalog ?? EMAIL_CATALOG;
    return catalog
        .map((entry) => ({
            key: entry.key,
            name: `Email · ${entry.name}`,
            utmCampaign: buildEmailTemplateCampaign({ key: entry.key }),
            pixelSlug: buildEmailTemplatePixelSlug({ key: entry.key })
        }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
