/**
 * Migrate existing Cloudinary assets so they appear in the correct
 * folder in the Media Library when the account is in "Dynamic Folders" mode.
 *
 * For each asset under the given prefix, sets `asset_folder` equal to
 * the parent path of its `public_id`. No re-upload happens — this only
 * updates metadata, so URLs and versions stay the same.
 *
 * Usage (from monorepo root):
 *   pnpm exec tsx scripts/fix-cloudinary-asset-folders.ts                  # dry-run by default
 *   pnpm exec tsx scripts/fix-cloudinary-asset-folders.ts --apply          # actually update
 *   pnpm exec tsx scripts/fix-cloudinary-asset-folders.ts --apply --prefix=hospeda/seed/required
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

function loadEnvFromMonorepo(): void {
    const candidates = [
        join(REPO_ROOT, '.env'),
        join(REPO_ROOT, '.env.local'),
        join(REPO_ROOT, 'apps/api/.env'),
        join(REPO_ROOT, 'apps/api/.env.local'),
        join(REPO_ROOT, 'apps/web/.env'),
        join(REPO_ROOT, 'apps/web/.env.local'),
        join(REPO_ROOT, 'apps/admin/.env'),
        join(REPO_ROOT, 'packages/seed/.env')
    ];
    for (const p of candidates) {
        if (existsSync(p)) {
            loadEnv({ path: p });
        }
    }
}

loadEnvFromMonorepo();

function getFlag(name: string, fallback: string): string {
    const args = process.argv.slice(2);
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.slice(name.length + 3) : fallback;
}

function hasFlag(name: string): boolean {
    return process.argv.slice(2).includes(`--${name}`);
}

type CloudinaryResource = {
    public_id: string;
    asset_folder?: string;
};

async function main() {
    const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
    const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        console.error('❌ Missing HOSPEDA_CLOUDINARY_* env vars');
        process.exit(1);
    }
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });

    const prefix = getFlag('prefix', 'hospeda/seed/required');
    const apply = hasFlag('apply');

    console.log('🔧 Cloudinary asset_folder migration');
    console.log(`   Cloud:  ${cloudName}`);
    console.log(`   Prefix: ${prefix}`);
    console.log(
        `   Mode:   ${apply ? 'APPLY (will update assets)' : 'DRY RUN (use --apply to commit)'}\n`
    );

    let nextCursor: string | undefined;
    const resources: CloudinaryResource[] = [];

    do {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix,
            max_results: 500,
            next_cursor: nextCursor
        });
        for (const r of result.resources as CloudinaryResource[]) {
            resources.push(r);
        }
        nextCursor = result.next_cursor;
    } while (nextCursor);

    if (resources.length === 0) {
        console.log('No assets found under that prefix.');
        return;
    }

    let alreadyOk = 0;
    let toFix = 0;
    let updated = 0;
    let failed = 0;

    for (const r of resources) {
        const lastSlash = r.public_id.lastIndexOf('/');
        const expectedFolder = lastSlash > 0 ? r.public_id.slice(0, lastSlash) : '';
        const currentFolder = r.asset_folder ?? '';

        if (currentFolder === expectedFolder) {
            alreadyOk += 1;
            continue;
        }

        toFix += 1;

        if (!apply) {
            console.log(
                `   would set "${expectedFolder}" on ${r.public_id} (currently "${currentFolder}")`
            );
            continue;
        }

        try {
            await cloudinary.api.update(r.public_id, {
                resource_type: 'image',
                type: 'upload',
                asset_folder: expectedFolder
            });
            updated += 1;
            if (updated % 10 === 0 || updated === toFix) {
                console.log(`   ✓ updated ${updated}/${toFix}`);
            }
        } catch (err) {
            failed += 1;
            console.error(`   ✗ failed for ${r.public_id}:`, (err as Error).message);
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Total assets:  ${resources.length}`);
    console.log(`Already OK:    ${alreadyOk}`);
    console.log(`Needs fix:     ${toFix}`);
    if (apply) {
        console.log(`Updated:       ${updated}`);
        if (failed > 0) {
            console.log(`Failed:        ${failed}`);
        }
    } else {
        console.log('\nRun again with --apply to perform updates.');
    }
}

main().catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
});
