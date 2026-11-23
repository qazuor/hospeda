/**
 * Writes `generated/email-pixel-manifest.json` from the email catalog (HOS-2359).
 *
 * Run after adding, removing or renaming a catalog entry:
 * `pnpm --filter @repo/notifications email:pixel-manifest`. The catalog attribution
 * guard fails CI while the committed file is stale.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildEmailPixelManifest,
    EMAIL_PIXEL_MANIFEST_PATH
} from '../src/catalog/pixel-manifest.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = buildEmailPixelManifest();
writeFileSync(
    join(packageRoot, EMAIL_PIXEL_MANIFEST_PATH),
    `${JSON.stringify(manifest, null, 4)}\n`,
    'utf-8'
);
process.stdout.write(`Wrote ${manifest.length} entries to ${EMAIL_PIXEL_MANIFEST_PATH}\n`);
