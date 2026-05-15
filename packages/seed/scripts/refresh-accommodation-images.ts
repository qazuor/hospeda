#!/usr/bin/env tsx
/**
 * SPEC-119 — Refresh accommodation seed images via deterministic assignment.
 *
 * For each accommodation JSON of the requested type(s):
 *   1. Featured image: assigned by cyclic position within the type. For every type
 *      we sort the accommodations by id and assign `featured = pool[i % poolSize]`,
 *      so types with ≤ poolSize members get 100% unique featured images and types
 *      that exceed the pool wrap deterministically. This eliminates the random
 *      collisions that cause two listing cards to show the same hero image.
 *   2. Gallery: a deterministic random subset of the pool MINUS the featured URL.
 *      Seed PRNG with FNV-1a(id), pick gallery count N ∈ [5, 24], then pick N
 *      distinct URLs from the remaining 24.
 *
 * Rewrites `media.featuredImage` and `media.gallery` in place. Preserves every
 * other field (and the trailing newline / 2-space indent the project uses).
 *
 * Usage:
 *   pnpm --filter @repo/seed exec tsx scripts/refresh-accommodation-images.ts \
 *     --type CAMPING [--type APARTMENT ...] [--dry-run]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccommodationTypeEnum } from '@repo/schemas';
import {
    IMAGE_POOL_BY_TYPE,
    type ImageVariant,
    type PooledAccommodationType
} from '../src/data/accommodation/_image-pool.js';

type CliOptions = {
    readonly types: ReadonlySet<PooledAccommodationType>;
    readonly dryRun: boolean;
};

const GALLERY_MIN = 5;
const GALLERY_MAX = 24;
const GALLERY_RANGE = GALLERY_MAX - GALLERY_MIN + 1;

const POOL_TYPES = new Set<PooledAccommodationType>([
    AccommodationTypeEnum.APARTMENT,
    AccommodationTypeEnum.HOUSE,
    AccommodationTypeEnum.COUNTRY_HOUSE,
    AccommodationTypeEnum.CABIN,
    AccommodationTypeEnum.HOTEL,
    AccommodationTypeEnum.HOSTEL,
    AccommodationTypeEnum.CAMPING,
    AccommodationTypeEnum.ROOM
]);

const parseCli = (argv: readonly string[]): CliOptions => {
    const types = new Set<PooledAccommodationType>();
    let dryRun = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (a === '--type') {
            const v = argv[i + 1];
            i += 1;
            if (!v) throw new Error('--type requires a value');
            for (const t of v.split(',')) {
                const trimmed = t.trim().toUpperCase() as PooledAccommodationType;
                if (!POOL_TYPES.has(trimmed)) {
                    throw new Error(
                        `Unknown or non-pooled type: ${trimmed}. Pooled types: ${[...POOL_TYPES].join(', ')}`
                    );
                }
                types.add(trimmed);
            }
            continue;
        }
        throw new Error(`Unknown CLI arg: ${a}`);
    }
    if (types.size === 0) throw new Error('At least one --type is required');
    return { types, dryRun };
};

// FNV-1a 32-bit hash for stable seeds across runs and platforms.
const fnv1a32 = (input: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

// mulberry32 PRNG — small, deterministic, uniform enough for fixture work.
const mulberry32 = (seed: number) => {
    let a = seed >>> 0;
    return (): number => {
        a = (a + 0x6d2b79f5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
};

// Fisher-Yates shuffle, returns a NEW array.
const shuffle = <T>(items: readonly T[], rng: () => number): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'accommodation');

type ImageEntry = ImageVariant & { readonly moderationState: 'APPROVED' };

type Assignment = {
    readonly file: string;
    readonly id: string;
    readonly type: PooledAccommodationType;
    readonly featured: ImageEntry;
    readonly gallery: readonly ImageEntry[];
};

const toEntry = (variant: ImageVariant): ImageEntry => ({
    ...variant,
    moderationState: 'APPROVED'
});

const assignImages = (
    id: string,
    type: PooledAccommodationType,
    featuredIndex: number
): Pick<Assignment, 'featured' | 'gallery'> => {
    const pool = IMAGE_POOL_BY_TYPE[type];
    if (pool.length < GALLERY_MAX + 1) {
        throw new Error(
            `Pool for ${type} has only ${pool.length} URLs; need >= ${GALLERY_MAX + 1}.`
        );
    }
    const featured = pool[featuredIndex] as ImageVariant;
    const remaining = pool.filter((_, i) => i !== featuredIndex);
    const rng = mulberry32(fnv1a32(id));
    const count = GALLERY_MIN + Math.floor(rng() * GALLERY_RANGE);
    const galleryVariants = shuffle(remaining, rng).slice(0, count);
    return {
        featured: toEntry(featured),
        gallery: galleryVariants.map(toEntry)
    };
};

const listAccommodationFiles = (): string[] => {
    const out: string[] = [];
    for (const dest of readdirSync(DATA_DIR, { withFileTypes: true })) {
        if (!dest.isDirectory()) continue;
        if (dest.name.startsWith('_')) continue; // skip the _image-pool.ts dir entries if any
        const folder = join(DATA_DIR, dest.name);
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                out.push(join(folder, entry.name));
            }
        }
    }
    return out;
};

const main = (): void => {
    const opts = parseCli(process.argv.slice(2));
    const allFiles = listAccommodationFiles();

    // Group every accommodation by type so the cyclic featured-index assignment
    // is stable per type, regardless of which --type flags this run was given.
    type FileMeta = { readonly file: string; readonly id: string; readonly type: string };
    const byType = new Map<string, FileMeta[]>();
    for (const file of allFiles) {
        const raw = readFileSync(file, 'utf8');
        const json = JSON.parse(raw) as { id: string; type: string };
        if (!byType.has(json.type)) byType.set(json.type, []);
        (byType.get(json.type) as FileMeta[]).push({ file, id: json.id, type: json.type });
    }
    for (const list of byType.values()) {
        list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    const matched: Assignment[] = [];
    let skipped = 0;

    for (const [type, list] of byType) {
        const pooledType = type as PooledAccommodationType;
        if (!opts.types.has(pooledType)) {
            skipped += list.length;
            continue;
        }
        const pool = IMAGE_POOL_BY_TYPE[pooledType];
        list.forEach((meta, i) => {
            const featuredIndex = i % pool.length;
            const { featured, gallery } = assignImages(meta.id, pooledType, featuredIndex);
            matched.push({
                file: meta.file,
                id: meta.id,
                type: pooledType,
                featured,
                gallery
            });
        });
    }

    if (matched.length === 0) {
        console.log(`No files matched types ${[...opts.types].join(', ')}.`);
        return;
    }

    // Group counts per type for reporting.
    const counts = new Map<string, number>();
    const galleryCounts: number[] = [];
    for (const a of matched) {
        counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
        galleryCounts.push(a.gallery.length);
    }
    const avg = galleryCounts.reduce((s, v) => s + v, 0) / galleryCounts.length;
    const min = Math.min(...galleryCounts);
    const max = Math.max(...galleryCounts);

    console.log('--- Plan ---');
    for (const [t, n] of counts) console.log(`  ${t}: ${n} files`);
    console.log(`  Gallery counts: min=${min}, avg=${avg.toFixed(1)}, max=${max}`);
    console.log(`  Skipped: ${skipped} files (out of scope)`);
    console.log(opts.dryRun ? '--- DRY RUN: no files written ---' : '--- Writing ---');

    if (opts.dryRun) {
        // Print one sample per type so we can eyeball the shape.
        const seen = new Set<string>();
        for (const a of matched) {
            if (seen.has(a.type)) continue;
            seen.add(a.type);
            console.log(`\nSample ${a.type} — ${a.id}`);
            console.log(`  featured: ${a.featured.caption} (${a.featured.url.slice(-30)})`);
            console.log(`  gallery (${a.gallery.length}):`);
            for (const g of a.gallery.slice(0, 3)) {
                console.log(`    - ${g.caption} (${g.url.slice(-30)})`);
            }
            if (a.gallery.length > 3) console.log(`    ... +${a.gallery.length - 3} more`);
        }
        return;
    }

    let written = 0;
    for (const a of matched) {
        const raw = readFileSync(a.file, 'utf8');
        const json = JSON.parse(raw) as { media?: Record<string, unknown> };
        const media = json.media ?? {};
        json.media = {
            ...media,
            featuredImage: a.featured,
            gallery: a.gallery
        };
        // Preserve project indent (2 spaces) and trailing newline.
        writeFileSync(a.file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
        written += 1;
    }
    console.log(`Wrote ${written} files.`);
};

main();
