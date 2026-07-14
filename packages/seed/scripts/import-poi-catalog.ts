#!/usr/bin/env tsx
/**
 * HOS-142 — imports HOS-141's staged POI pipeline output
 * (`scripts/poi-pipeline/output/*.json`) into the live seed data folder
 * (`src/data/pointOfInterest/`), per spec §6.1.
 *
 * This script is INTENTIONALLY conservative: it sanitizes known upstream
 * data-quality issues (see {@link sanitizeFixture}), then validates every
 * fixture against the real `PointOfInterestCreateInputSchema` (the exact
 * schema `service.create()` enforces at seed time) BEFORE writing anything,
 * and refuses to write ANY file if even one fixture still fails validation
 * after sanitizing — "fail the copy step loudly on any row that doesn't
 * validate" (spec §6.1). It also drops (never renames or duplicates) any new
 * fixture whose slug collides with one of the 12 pre-HOS-142 curated
 * fixtures already in the folder — see the collision-handling comment below.
 *
 * Usage:
 *   pnpm --filter @repo/seed import:poi-catalog          # validate + write
 *   pnpm --filter @repo/seed import:poi-catalog --dry-run # validate only
 *
 * Numbering continues the existing `NNN-point-of-interest-<slug>.json`
 * convention from `013` onward (the 12 existing fixtures are `001`-`012`),
 * assigned by sorting the pipeline's fixtures by `slug` (the pipeline itself
 * already writes its per-slug files in slug order, per
 * `scripts/poi-pipeline/OUTPUT-CONTRACT.md`'s determinism guarantee). On the
 * real HOS-141 output (as of 2026-07-14) this writes 908 fixtures — 914 rows
 * minus 6 that collide with a pre-HOS-142 curated slug — for 920 total files
 * under `src/data/pointOfInterest/` (see HOS-142 delegation report for the
 * exact 6 slugs).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PointOfInterestCreateInputSchema } from '@repo/schemas';

const REPO_ROOT = join(import.meta.dirname, '..');
const PIPELINE_OUTPUT_DIR = join(REPO_ROOT, 'scripts/poi-pipeline/output');
const LIVE_DATA_DIR = join(REPO_ROOT, 'src/data/pointOfInterest');

/** Files in the pipeline output directory that are NOT per-POI fixtures. */
const NON_FIXTURE_FILES = new Set(['destination-relations.json', 'report.json', 'report.md']);

/** Existing pre-HOS-142 fixture count (`001`-`012`), never touched by this script. */
const EXISTING_FIXTURE_COUNT = 12;

interface RawPoiFixture {
    readonly slug: string;
    readonly [key: string]: unknown;
}

/** One validation failure, keyed by the pipeline's `<slug>.json` filename. */
interface ValidationFailure {
    readonly file: string;
    readonly slug: string;
    readonly issues: string;
}

/** Max length of the `source` field, mirrors `PointOfInterestSchema.source`'s `.max(200)`. */
const SOURCE_MAX_LENGTH = 200;

/** Tally of how many rows each sanitization rule actually touched. */
interface SanitizeStats {
    verifiedAtNulled: number;
    sourceTruncated: number;
}

/**
 * Sanitizes one raw pipeline fixture BEFORE schema validation, fixing known
 * upstream (HOS-141) data-quality issues that the pipeline itself should
 * arguably have caught, but which this import step defensively normalizes
 * rather than blocking the whole catalog on:
 *
 * - `verifiedAt`: the schema requires a real `Date` instance
 *   (`z.date().nullish()`), but a static JSON fixture can only ever contain a
 *   string or `null` — no string, however well-formed, survives a JSON
 *   round-trip as a `Date`. The pipeline output carries a plain string here
 *   (in 159/914 rows, all the identical bogus Excel-serial artifact
 *   `"46214"`, not a real per-row verification date), so every non-null
 *   `verifiedAt` string is nulled out.
 * - `source`: multiple semicolon-joined URLs can exceed the schema's 200-char
 *   max (~22/914 rows). Takes just the first URL; if that alone still
 *   overflows, hard-truncates to 200 chars.
 *
 * @param data - The raw fixture as read from the pipeline output.
 * @param stats - Mutable tally, incremented per rule actually applied.
 * @returns A new object with the sanitized fields (fixture otherwise unchanged).
 */
function sanitizeFixture(data: RawPoiFixture, stats: SanitizeStats): RawPoiFixture {
    const sanitized: Record<string, unknown> = { ...data };

    if (typeof sanitized.verifiedAt === 'string') {
        sanitized.verifiedAt = null;
        stats.verifiedAtNulled++;
    }

    if (typeof sanitized.source === 'string' && sanitized.source.length > SOURCE_MAX_LENGTH) {
        const firstUrl = (sanitized.source.split(';')[0] ?? sanitized.source).trim();
        sanitized.source =
            firstUrl.length > SOURCE_MAX_LENGTH ? firstUrl.slice(0, SOURCE_MAX_LENGTH) : firstUrl;
        stats.sourceTruncated++;
    }

    return sanitized as RawPoiFixture;
}

/** Reads every real POI fixture from the staged pipeline output, sorted by slug. */
function readPipelineFixtures(): { file: string; data: RawPoiFixture }[] {
    const files = readdirSync(PIPELINE_OUTPUT_DIR)
        .filter((f) => f.endsWith('.json') && !NON_FIXTURE_FILES.has(f))
        .sort((a, b) => a.localeCompare(b));

    return files.map((file) => ({
        file,
        data: JSON.parse(readFileSync(join(PIPELINE_OUTPUT_DIR, file), 'utf-8')) as RawPoiFixture
    }));
}

/** Reads every already-seeded slug from the 12 pre-HOS-142 fixtures. */
function readExistingSlugs(): Set<string> {
    const files = readdirSync(LIVE_DATA_DIR).filter((f) => f.endsWith('.json'));
    const slugs = new Set<string>();
    for (const file of files) {
        const raw = JSON.parse(readFileSync(join(LIVE_DATA_DIR, file), 'utf-8')) as {
            slug: string;
        };
        slugs.add(raw.slug);
    }
    return slugs;
}

/** Validates one raw pipeline fixture against the real POI create schema. */
function validateFixture(file: string, data: RawPoiFixture): ValidationFailure | null {
    const result = PointOfInterestCreateInputSchema.safeParse(data);
    if (result.success) return null;
    return {
        file,
        slug: data.slug,
        issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')
    };
}

async function main(): Promise<void> {
    const dryRun = process.argv.includes('--dry-run');

    if (!existsSync(PIPELINE_OUTPUT_DIR)) {
        console.error(`Pipeline output directory not found: ${PIPELINE_OUTPUT_DIR}`);
        process.exitCode = 1;
        return;
    }

    const rawFixtures = readPipelineFixtures();
    console.log(`Read ${rawFixtures.length} POI fixtures from ${PIPELINE_OUTPUT_DIR}`);

    // ── 0. Sanitize known upstream (HOS-141) data-quality issues. ──
    const sanitizeStats: SanitizeStats = { verifiedAtNulled: 0, sourceTruncated: 0 };
    const fixtures = rawFixtures.map(({ file, data }) => ({
        file,
        data: sanitizeFixture(data, sanitizeStats)
    }));
    console.log(
        `Sanitized ${sanitizeStats.verifiedAtNulled} row(s): verifiedAt string -> null. ` +
            `Sanitized ${sanitizeStats.sourceTruncated} row(s): source truncated to first URL / ${SOURCE_MAX_LENGTH} chars.`
    );

    // ── 1. Schema validation — fail loudly, write nothing on any failure. ──
    const failures: ValidationFailure[] = [];
    for (const { file, data } of fixtures) {
        const failure = validateFixture(file, data);
        if (failure) failures.push(failure);
    }

    if (failures.length > 0) {
        const byPath: Record<string, number> = {};
        for (const f of failures) {
            for (const part of f.issues.split(' | ')) {
                const p = part.split(':')[0] ?? part;
                byPath[p] = (byPath[p] ?? 0) + 1;
            }
        }
        console.error(
            `\n${failures.length}/${fixtures.length} fixtures FAILED validation against PointOfInterestCreateInputSchema.`
        );
        console.error('Failures by field path:', byPath);
        console.error('\nFirst 10 failures:');
        for (const f of failures.slice(0, 10)) {
            console.error(` - ${f.file} (${f.slug}): ${f.issues}`);
        }
        console.error(
            '\nRefusing to write any fixture until every row validates (HOS-142 spec §6.1). ' +
                'The known sanitizable mismatches (verifiedAt strings, source overflow) are already ' +
                'handled by sanitizeFixture() above — a failure past that point is a NEW mismatch ' +
                'that needs its own fix, not a repeat of the original HOS-141/HOS-142 findings.'
        );
        process.exitCode = 1;
        return;
    }

    console.log(`All ${fixtures.length} fixtures validated successfully.`);

    // ── 2. Slug collision check against the 12 existing fixtures. ──
    // A handful of the 914 bulk-imported rows re-discover the SAME real-world
    // landmark the 12 HOS-113 hand-curated fixtures already cover (e.g. "Palacio
    // San José", "Parque Nacional El Palmar") — expected, since the bulk dataset
    // covers the full 22-destination catalog the 12 curated POIs are also part
    // of. The curated originals have real en/pt translations and vetted content,
    // the bulk duplicates do not, so on a collision the ORIGINAL wins: the
    // colliding bulk row is DROPPED (not written, not an error) rather than
    // creating two rows for the same landmark or renaming either slug.
    const existingSlugs = readExistingSlugs();
    if (existingSlugs.size !== EXISTING_FIXTURE_COUNT) {
        console.error(
            `Expected exactly ${EXISTING_FIXTURE_COUNT} existing fixtures in ${LIVE_DATA_DIR}, found ${existingSlugs.size}.`
        );
        process.exitCode = 1;
        return;
    }
    const collisions = fixtures.filter(({ data }) => existingSlugs.has(data.slug));
    if (collisions.length > 0) {
        console.warn(
            `${collisions.length} new fixture(s) collide with an existing (pre-HOS-142) slug — ` +
                'dropping the bulk-imported duplicate, keeping the curated original:',
            collisions.map((c) => c.data.slug)
        );
    }
    const deduped = fixtures.filter(({ data }) => !existingSlugs.has(data.slug));

    // ── 3. Duplicate-slug check within the remaining new set. ──
    const newSlugs = deduped.map(({ data }) => data.slug);
    const duplicates = newSlugs.filter((slug, i) => newSlugs.indexOf(slug) !== i);
    if (duplicates.length > 0) {
        console.error('Duplicate slugs within the new fixture set:', [...new Set(duplicates)]);
        process.exitCode = 1;
        return;
    }

    if (dryRun) {
        console.log(`Dry run: would write ${deduped.length} files to ${LIVE_DATA_DIR}.`);
        return;
    }

    // ── 4. Write, numbered 013 onward, sorted by slug. ──
    mkdirSync(LIVE_DATA_DIR, { recursive: true });
    const writtenFilenames: string[] = [];
    for (let i = 0; i < deduped.length; i++) {
        const { data } = deduped[i] as { data: RawPoiFixture };
        const num = String(i + 1 + EXISTING_FIXTURE_COUNT).padStart(3, '0');
        const id = `${num}-point-of-interest-${data.slug}`;
        const filename = `${id}.json`;
        const fixture = {
            $schema: '../../schemas/point-of-interest.schema.json',
            id,
            ...data
        };
        writeFileSync(join(LIVE_DATA_DIR, filename), `${JSON.stringify(fixture, null, 4)}\n`);
        writtenFilenames.push(filename);
    }

    console.log(
        `Wrote ${writtenFilenames.length} fixtures to ${LIVE_DATA_DIR} ` +
            `(${EXISTING_FIXTURE_COUNT + 1}-${EXISTING_FIXTURE_COUNT + writtenFilenames.length} numbering).`
    );

    // ── 5. Populate manifest-required.json's "pointOfInterestCatalog" key. ──
    // Generated from the actual written filenames (reviewable via `git diff`),
    // never hand-typed.
    const manifestPath = join(REPO_ROOT, 'src/manifest-required.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    manifest.pointOfInterestCatalog = writtenFilenames;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
    console.log(
        `Updated ${manifestPath} — pointOfInterestCatalog now lists ${writtenFilenames.length} filenames.`
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
