/**
 * Verify which assets exist in Cloudinary under the seed prefix.
 *
 * Usage (from monorepo root):
 *   pnpm exec tsx scripts/check-cloudinary-uploads.ts
 *
 * Optional flag:
 *   --prefix=<value>   Override search prefix (default "hospeda/seed/required")
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
    console.log(`🔍 Checking Cloudinary for prefix: ${prefix}`);
    console.log(`   Cloud: ${cloudName}\n`);

    let nextCursor: string | undefined;
    const allResources: {
        public_id: string;
        bytes: number;
        width: number;
        height: number;
        secure_url: string;
    }[] = [];

    do {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix,
            max_results: 500,
            next_cursor: nextCursor
        });
        for (const r of result.resources) {
            allResources.push({
                public_id: r.public_id,
                bytes: r.bytes,
                width: r.width,
                height: r.height,
                secure_url: r.secure_url
            });
        }
        nextCursor = result.next_cursor;
    } while (nextCursor);

    if (allResources.length === 0) {
        console.log('❌ No assets found under that prefix.');
        console.log('\nThis can mean:');
        console.log('  • The upload silently failed.');
        console.log(
            '  • Your Cloudinary account is in Dynamic Folders mode and the assets were stored at root with a different asset_folder.'
        );
        console.log('\nTry listing all resources without prefix:');
        console.log('  pnpm exec tsx scripts/check-cloudinary-uploads.ts --prefix=""');
        return;
    }

    console.log(`✅ Found ${allResources.length} asset(s)\n`);

    const grouped = new Map<
        string,
        { public_id: string; bytes: number; width: number; height: number; secure_url: string }[]
    >();
    for (const r of allResources) {
        const segments = r.public_id.split('/');
        const folder = segments.slice(0, -1).join('/');
        if (!grouped.has(folder)) {
            grouped.set(folder, []);
        }
        const list = grouped.get(folder);
        if (list) {
            list.push(r);
        }
    }

    const folders = [...grouped.keys()].sort();
    for (const folder of folders) {
        const items = grouped.get(folder) ?? [];
        console.log(`📁 ${folder} (${items.length} item${items.length === 1 ? '' : 's'})`);
        for (const item of items.slice(0, 3)) {
            const baseName = item.public_id.split('/').pop();
            console.log(
                `   • ${baseName}  ${item.width}x${item.height}  ${(item.bytes / 1024).toFixed(1)} KB`
            );
        }
        if (items.length > 3) {
            console.log(`   ... +${items.length - 3} more`);
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Total: ${allResources.length} assets in ${folders.length} folder(s)`);
    console.log('\nSample URL (open in browser):');
    console.log(`  ${allResources[0]?.secure_url}`);
    console.log('\nDashboard URL to view all:');
    console.log(
        `  https://console.cloudinary.com/console/c-${cloudName}/media_library/search?q=${encodeURIComponent(prefix)}`
    );
}

main().catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
});
