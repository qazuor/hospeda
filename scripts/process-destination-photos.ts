/**
 * End-to-end destination photo pipeline:
 *   1. Process: optimize images to WebP and write them to a parallel folder.
 *   2. Upload: push processed assets to Cloudinary with deterministic publicIds.
 *   3. Update seeds: rewrite destination/user JSONs to point at the new assets.
 *
 * Input layout (your local folder):
 *   <input>/<destination-name>/featured
 *   <input>/<destination-name>/gallery/gallery-NN
 *   <input>/avatars/<user-id>          (optional)
 *
 * Output layout (mirrored, ready to upload manually if you skip --upload):
 *   <output>/<entityId>/featured.webp
 *   <output>/<entityId>/gallery-NN.webp
 *   <output>/avatars/<user-id>.webp
 *
 * Cloudinary publicIds:
 *   hospeda/seed/required/destinations/<entityId>/featured
 *   hospeda/seed/required/destinations/<entityId>/gallery-NN
 *   hospeda/seed/required/avatars/<user-id>
 *
 * Usage (from monorepo root):
 *   pnpm exec tsx scripts/process-destination-photos.ts                   # process only
 *   pnpm exec tsx scripts/process-destination-photos.ts --upload          # process + upload
 *   pnpm exec tsx scripts/process-destination-photos.ts --update-seeds    # process + upload + update JSONs
 *   pnpm exec tsx scripts/process-destination-photos.ts --update-seeds --dry-run   # plan without writing
 *
 * Optional flags:
 *   --input=<path>     Override input directory
 *   --output=<path>    Override output directory
 *   --quality=<n>      WebP quality (default 85)
 *   --max=<n>          Max dimension in pixels (default 1920)
 *   --photographer=<n> Attribution photographer name (default "qazuor")
 *   --license=<n>      Attribution license (default "Owned")
 *   --yes              Skip interactive confirmation before destructive steps
 */

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { type UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { config as loadEnv } from 'dotenv';
import sharp from 'sharp';

type CliFlags = {
    input: string;
    output: string;
    quality: number;
    max: number;
    photographer: string;
    license: string;
    upload: boolean;
    updateSeeds: boolean;
    dryRun: boolean;
    yes: boolean;
};

type DestinationMapping = {
    folderName: string;
    entityId: string;
    slug: string;
};

type UploadedAsset = {
    publicId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
};

type DestinationProcessed = {
    mapping: DestinationMapping;
    featured: { localPath: string; width: number; height: number } | null;
    gallery: { localPath: string; baseName: string; width: number; height: number }[];
    warnings: string[];
};

type DestinationUploaded = {
    mapping: DestinationMapping;
    featured: UploadedAsset | null;
    gallery: UploadedAsset[];
};

type AvatarProcessed = {
    userId: string;
    localPath: string;
    width: number;
    height: number;
};

type AvatarUploaded = {
    userId: string;
    asset: UploadedAsset;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SEED_DESTINATIONS_DIR = join(REPO_ROOT, 'packages/seed/src/data/destination');
const SEED_USERS_DIR = join(REPO_ROOT, 'packages/seed/src/data/user/required');

/**
 * Load env vars from common monorepo locations.
 * First file that defines a var wins (dotenv default = no override).
 */
function loadEnvFromMonorepo(): string[] {
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
    const loaded: string[] = [];
    for (const p of candidates) {
        if (existsSync(p)) {
            const result = loadEnv({ path: p });
            const count = Object.keys(result.parsed ?? {}).length;
            loaded.push(`${p} (${count} vars)`);
        }
    }
    return loaded;
}

const ENV_LOAD_LOG = loadEnvFromMonorepo();

const DEFAULT_INPUT = '/home/qazuor/Desktop/fotos destinos';
const DEFAULT_OUTPUT = '/home/qazuor/Desktop/fotos destinos-procesadas';
const CLOUDINARY_BASE_FOLDER = 'hospeda/seed/required';

function parseFlags(): CliFlags {
    const args = process.argv.slice(2);
    const get = (name: string, fallback: string): string => {
        const arg = args.find((a) => a.startsWith(`--${name}=`));
        return arg ? arg.slice(name.length + 3) : fallback;
    };
    const has = (name: string): boolean => args.includes(`--${name}`);
    const updateSeeds = has('update-seeds');
    return {
        input: get('input', DEFAULT_INPUT),
        output: get('output', DEFAULT_OUTPUT),
        quality: Number.parseInt(get('quality', '85'), 10),
        max: Number.parseInt(get('max', '1920'), 10),
        photographer: get('photographer', 'qazuor'),
        license: get('license', 'Owned'),
        upload: has('upload') || updateSeeds,
        updateSeeds,
        dryRun: has('dry-run'),
        yes: has('yes')
    };
}

function configureCloudinary(): void {
    const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
    const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error(
            'Missing Cloudinary credentials. Required env vars: ' +
                'HOSPEDA_CLOUDINARY_CLOUD_NAME, HOSPEDA_CLOUDINARY_API_KEY, HOSPEDA_CLOUDINARY_API_SECRET'
        );
    }
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });
}

function normalizeFolderName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/\p{Mn}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');
}

async function buildSlugMap(): Promise<Map<string, string>> {
    if (!existsSync(SEED_DESTINATIONS_DIR)) {
        throw new Error(`Seed destinations directory not found: ${SEED_DESTINATIONS_DIR}`);
    }
    const files = (await readdir(SEED_DESTINATIONS_DIR)).filter((f) => f.endsWith('.json'));
    const map = new Map<string, string>();
    for (const file of files) {
        const filePath = join(SEED_DESTINATIONS_DIR, file);
        const raw = await readFile(filePath, 'utf-8');
        try {
            const json = JSON.parse(raw) as { id?: string; slug?: string };
            if (json.id && json.slug) {
                map.set(json.slug, json.id);
            }
        } catch {
            // skip malformed silently
        }
    }
    return map;
}

async function discoverDestinations(
    inputDir: string,
    slugMap: Map<string, string>
): Promise<{ matched: DestinationMapping[]; unmatched: string[] }> {
    const entries = await readdir(inputDir, { withFileTypes: true });
    const folders = entries
        .filter((e) => e.isDirectory() && e.name !== 'avatars')
        .map((e) => e.name);

    const matched: DestinationMapping[] = [];
    const unmatched: string[] = [];

    for (const folder of folders) {
        const normalized = normalizeFolderName(folder);
        const entityId = slugMap.get(normalized);
        if (entityId) {
            matched.push({ folderName: folder, entityId, slug: normalized });
        } else {
            unmatched.push(folder);
        }
    }

    return { matched, unmatched };
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function processOne(
    inputPath: string,
    outputPath: string,
    flags: CliFlags
): Promise<{ inputBytes: number; outputBytes: number; width: number; height: number }> {
    const inputStat = await stat(inputPath);
    const result = await sharp(inputPath)
        .rotate()
        .resize({
            width: flags.max,
            height: flags.max,
            fit: 'inside',
            withoutEnlargement: true
        })
        .webp({ quality: flags.quality, smartSubsample: true, effort: 5 })
        .toFile(outputPath);
    return {
        inputBytes: inputStat.size,
        outputBytes: result.size,
        width: result.width,
        height: result.height
    };
}

async function processDestination(
    mapping: DestinationMapping,
    flags: CliFlags
): Promise<DestinationProcessed> {
    const inputFolder = join(flags.input, mapping.folderName);
    const outputFolder = join(flags.output, mapping.entityId);
    await mkdir(outputFolder, { recursive: true });

    console.log(`\n📂 ${mapping.folderName}  →  ${mapping.entityId}`);

    const result: DestinationProcessed = {
        mapping,
        featured: null,
        gallery: [],
        warnings: []
    };

    const inputFiles = await readdir(inputFolder);
    const featuredFile = inputFiles.find((f) => /^featured(\.[a-z0-9]+)?$/i.test(f));
    const featuredPath = featuredFile ? join(inputFolder, featuredFile) : '';
    if (featuredPath && existsSync(featuredPath)) {
        const outputPath = join(outputFolder, 'featured.webp');
        const r = await processOne(featuredPath, outputPath, flags);
        result.featured = { localPath: outputPath, width: r.width, height: r.height };
        if (r.width < 800 || r.height < 600) {
            result.warnings.push(`featured: low resolution (${r.width}x${r.height})`);
        }
        console.log(
            `   ✓ featured.webp        ${r.width}x${r.height}  ${formatBytes(r.inputBytes)} → ${formatBytes(r.outputBytes)}`
        );
    } else {
        result.warnings.push('featured: file not found');
        console.log('   ⚠ featured: missing');
    }

    const galleryFolder = join(inputFolder, 'gallery');
    if (existsSync(galleryFolder)) {
        const galleryFiles = (await readdir(galleryFolder))
            .filter((f) => /^gallery-\d+/i.test(f))
            .sort();
        for (const file of galleryFiles) {
            const inputPath = join(galleryFolder, file);
            const baseName = file.replace(/\.[^.]+$/, '');
            const outputPath = join(outputFolder, `${baseName}.webp`);
            const r = await processOne(inputPath, outputPath, flags);
            result.gallery.push({
                localPath: outputPath,
                baseName,
                width: r.width,
                height: r.height
            });
            if (r.width < 800 || r.height < 600) {
                result.warnings.push(`${file}: low resolution (${r.width}x${r.height})`);
            }
            if (r.inputBytes < 30 * 1024) {
                result.warnings.push(
                    `${file}: tiny input (${formatBytes(r.inputBytes)}), may be low quality`
                );
            }
            console.log(
                `   ✓ ${baseName}.webp        ${r.width}x${r.height}  ${formatBytes(r.inputBytes)} → ${formatBytes(r.outputBytes)}`
            );
        }
    } else {
        console.log('   ⚠ gallery: folder missing');
    }

    if (result.warnings.length > 0) {
        console.log('   ⚠ warnings:');
        for (const w of result.warnings) {
            console.log(`      • ${w}`);
        }
    }

    return result;
}

async function processAvatars(flags: CliFlags): Promise<AvatarProcessed[]> {
    const avatarsFolder = join(flags.input, 'avatars');
    if (!existsSync(avatarsFolder)) {
        return [];
    }
    const outputFolder = join(flags.output, 'avatars');
    await mkdir(outputFolder, { recursive: true });

    console.log('\n👤 avatars');
    const results: AvatarProcessed[] = [];

    const files = await readdir(avatarsFolder);
    for (const file of files) {
        const inputPath = join(avatarsFolder, file);
        const fileStat = await stat(inputPath);
        if (!fileStat.isFile()) {
            continue;
        }
        const baseName = file.replace(/\.[^.]+$/, '');
        const outputPath = join(outputFolder, `${baseName}.webp`);
        const r = await processOne(inputPath, outputPath, flags);
        results.push({
            userId: baseName,
            localPath: outputPath,
            width: r.width,
            height: r.height
        });
        const warnings: string[] = [];
        if (r.width < 400 || r.height < 400) {
            warnings.push(`avatar too small (${r.width}x${r.height}), use 400x400+`);
        }
        if (Math.abs(r.width - r.height) > Math.max(r.width, r.height) * 0.1) {
            warnings.push(`avatar not square (${r.width}x${r.height})`);
        }
        console.log(
            `   ✓ ${baseName}.webp        ${r.width}x${r.height}  ${formatBytes(r.inputBytes)} → ${formatBytes(r.outputBytes)}`
        );
        for (const w of warnings) {
            console.log(`      ⚠ ${w}`);
        }
    }

    return results;
}

async function uploadAsset(
    localPath: string,
    publicId: string,
    dryRun: boolean
): Promise<UploadedAsset> {
    if (dryRun) {
        return {
            publicId,
            url: `https://res.cloudinary.com/<cloud>/image/upload/v0/${publicId}`,
            width: 0,
            height: 0,
            bytes: 0
        };
    }
    const lastSlash = publicId.lastIndexOf('/');
    const assetFolder = lastSlash > 0 ? publicId.slice(0, lastSlash) : '';
    const result: UploadApiResponse = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        asset_folder: assetFolder,
        overwrite: true,
        resource_type: 'image',
        invalidate: true
    });
    return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        bytes: result.bytes
    };
}

async function uploadDestination(
    processed: DestinationProcessed,
    flags: CliFlags
): Promise<DestinationUploaded> {
    console.log(`\n📤 Uploading ${processed.mapping.entityId}`);
    const folder = `${CLOUDINARY_BASE_FOLDER}/destinations/${processed.mapping.entityId}`;

    const uploaded: DestinationUploaded = {
        mapping: processed.mapping,
        featured: null,
        gallery: []
    };

    if (processed.featured) {
        const publicId = `${folder}/featured`;
        const asset = await uploadAsset(processed.featured.localPath, publicId, flags.dryRun);
        uploaded.featured = asset;
        console.log(`   ✓ ${publicId}`);
    }

    for (const item of processed.gallery) {
        const publicId = `${folder}/${item.baseName}`;
        const asset = await uploadAsset(item.localPath, publicId, flags.dryRun);
        uploaded.gallery.push(asset);
        console.log(`   ✓ ${publicId}`);
    }

    return uploaded;
}

async function uploadAvatars(
    processed: AvatarProcessed[],
    flags: CliFlags
): Promise<AvatarUploaded[]> {
    if (processed.length === 0) {
        return [];
    }
    console.log('\n📤 Uploading avatars');
    const folder = `${CLOUDINARY_BASE_FOLDER}/avatars`;
    const results: AvatarUploaded[] = [];
    for (const item of processed) {
        const publicId = `${folder}/${item.userId}`;
        const asset = await uploadAsset(item.localPath, publicId, flags.dryRun);
        results.push({ userId: item.userId, asset });
        console.log(`   ✓ ${publicId}`);
    }
    return results;
}

type DestinationJson = {
    media?: {
        featuredImage?: Record<string, unknown>;
        gallery?: Record<string, unknown>[];
        videos?: Record<string, unknown>[];
    };
    [key: string]: unknown;
};

type UserJson = {
    profile?: {
        avatar?: string;
        [key: string]: unknown;
    } | null;
    [key: string]: unknown;
};

async function backupFile(filePath: string): Promise<void> {
    const backupPath = `${filePath}.bak`;
    if (!existsSync(backupPath)) {
        await copyFile(filePath, backupPath);
    }
}

function buildImageEntry(
    asset: UploadedAsset,
    flags: CliFlags,
    existingCaption?: string
): Record<string, unknown> {
    const entry: Record<string, unknown> = {
        url: asset.url,
        publicId: asset.publicId,
        moderationState: 'APPROVED',
        attribution: {
            photographer: flags.photographer,
            license: flags.license
        }
    };
    if (existingCaption && existingCaption.length >= 3) {
        entry.caption = existingCaption;
    }
    return entry;
}

async function updateDestinationSeed(
    uploaded: DestinationUploaded,
    flags: CliFlags
): Promise<void> {
    const filePath = join(SEED_DESTINATIONS_DIR, `${uploaded.mapping.entityId}.json`);
    if (!existsSync(filePath)) {
        console.log(`   ⚠ seed not found: ${filePath}`);
        return;
    }

    const raw = await readFile(filePath, 'utf-8');
    const json = JSON.parse(raw) as DestinationJson;
    if (!json.media) {
        json.media = {};
    }

    if (uploaded.featured) {
        const previousCaption = json.media.featuredImage?.caption as string | undefined;
        json.media.featuredImage = buildImageEntry(uploaded.featured, flags, previousCaption);
    }

    if (uploaded.gallery.length > 0) {
        json.media.gallery = uploaded.gallery.map((asset) => buildImageEntry(asset, flags));
    }

    if (flags.dryRun) {
        console.log(`   [dry-run] would update ${filePath}`);
        return;
    }

    await backupFile(filePath);
    await writeFile(filePath, `${JSON.stringify(json, null, 4)}\n`, 'utf-8');
    console.log(`   ✓ updated ${uploaded.mapping.entityId}.json (backup at .bak)`);
}

async function updateUserSeed(uploaded: AvatarUploaded, flags: CliFlags): Promise<void> {
    const filePath = join(SEED_USERS_DIR, `${uploaded.userId}.json`);
    if (!existsSync(filePath)) {
        console.log(`   ⚠ user seed not found: ${filePath}`);
        return;
    }

    const raw = await readFile(filePath, 'utf-8');
    const json = JSON.parse(raw) as UserJson;
    if (!json.profile) {
        json.profile = {};
    }
    json.profile.avatar = uploaded.asset.url;

    if (flags.dryRun) {
        console.log(`   [dry-run] would update ${filePath}`);
        return;
    }

    await backupFile(filePath);
    await writeFile(filePath, `${JSON.stringify(json, null, 4)}\n`, 'utf-8');
    console.log(`   ✓ updated ${uploaded.userId}.json (backup at .bak)`);
}

async function confirm(message: string): Promise<boolean> {
    const rl = createInterface({ input, output });
    const answer = (await rl.question(`${message} (y/n) `)).trim().toLowerCase();
    rl.close();
    return answer === 'y' || answer === 'yes';
}

async function main() {
    const flags = parseFlags();

    console.log('🖼️  Destination photo pipeline');
    console.log(`   Input:        ${flags.input}`);
    console.log(`   Output:       ${flags.output}`);
    console.log(`   Format:       WebP (quality ${flags.quality}, max ${flags.max}px)`);
    console.log(
        `   Steps:        process${flags.upload ? ' → upload' : ''}${flags.updateSeeds ? ' → update-seeds' : ''}`
    );
    console.log(
        `   Mode:         ${flags.dryRun ? 'DRY RUN (no writes to Cloudinary or seeds)' : 'live'}`
    );

    if (!existsSync(flags.input)) {
        console.error(`\n❌ Input directory not found: ${flags.input}`);
        process.exit(1);
    }

    if (flags.upload) {
        console.log('\n📦 Env files loaded:');
        for (const e of ENV_LOAD_LOG) {
            console.log(`   • ${e}`);
        }
        if (ENV_LOAD_LOG.length === 0) {
            console.log('   (none found)');
        }
        configureCloudinary();
        console.log(`   Cloudinary:   ${process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME}`);
    }

    const slugMap = await buildSlugMap();
    console.log(`\n🔍 Loaded ${slugMap.size} destination slugs from seeds`);

    const { matched, unmatched } = await discoverDestinations(flags.input, slugMap);

    if (matched.length === 0) {
        console.error('\n❌ No matching destinations found in input folder.');
        process.exit(1);
    }

    console.log(`✓ Matched ${matched.length} destination(s):`);
    for (const m of matched) {
        console.log(`   • ${m.folderName}  →  ${m.entityId}`);
    }
    if (unmatched.length > 0) {
        console.log(`\n⚠ Unmatched (will skip): ${unmatched.join(', ')}`);
    }

    if ((flags.upload || flags.updateSeeds) && !flags.dryRun && !flags.yes) {
        const summary: string[] = [];
        if (flags.upload) {
            summary.push(
                `upload ${matched.length} destination folder(s) + avatars to Cloudinary (overwrite)`
            );
        }
        if (flags.updateSeeds) {
            summary.push(`rewrite ${matched.length} destination JSON(s) + matching user JSON(s)`);
        }
        const ok = await confirm(`\n⚠ About to ${summary.join(' AND ')}. Continue?`);
        if (!ok) {
            console.log('Aborted.');
            process.exit(0);
        }
    }

    await mkdir(flags.output, { recursive: true });

    // PHASE 1: PROCESS
    const processed: DestinationProcessed[] = [];
    for (const mapping of matched) {
        processed.push(await processDestination(mapping, flags));
    }
    const avatarsProcessed = await processAvatars(flags);

    if (!flags.upload) {
        console.log('\n✅ Process phase done. Run with --upload to push to Cloudinary.');
        return;
    }

    // PHASE 2: UPLOAD
    const uploaded: DestinationUploaded[] = [];
    for (const p of processed) {
        uploaded.push(await uploadDestination(p, flags));
    }
    const avatarsUploaded = await uploadAvatars(avatarsProcessed, flags);

    if (!flags.updateSeeds) {
        console.log('\n✅ Upload phase done. Run with --update-seeds to rewrite JSONs.');
        return;
    }

    // PHASE 3: UPDATE SEEDS
    console.log('\n📝 Updating seed JSONs');
    for (const u of uploaded) {
        await updateDestinationSeed(u, flags);
    }
    for (const a of avatarsUploaded) {
        await updateUserSeed(a, flags);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ All phases complete');
    console.log('   Backups of modified JSONs are at <file>.json.bak');
    console.log('   Review changes with: git diff packages/seed/src/data');
}

main().catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
});
