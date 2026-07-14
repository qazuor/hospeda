#!/usr/bin/env tsx
/**
 * HOS-142 T-0xx — imports HOS-141's staged POI pipeline output
 * (`scripts/poi-pipeline/output/*.json`) into the live seed data folder
 * (`src/data/pointOfInterest/`), per spec §6.1.
 *
 * This script is INTENTIONALLY conservative: it validates every transformed
 * fixture against the real `PointOfInterestCreateInputSchema` (the exact
 * schema `service.create()` enforces at seed time) BEFORE writing anything,
 * and refuses to write ANY file if even one fixture fails validation — "fail
 * the copy step loudly on any row that doesn't validate" (spec §6.1). It also
 * refuses to run if any new slug collides with one of the 12 pre-HOS-142
 * fixtures already in the folder.
 *
 * Usage:
 *   pnpm --filter @repo/seed import:poi-catalog          # validate + write
 *   pnpm --filter @repo/seed import:poi-catalog --dry-run # validate only
 *
 * Numbering continues the existing `NNN-point-of-interest-<slug>.json`
 * convention from `013` onward (the 12 existing fixtures are `001`-`012`),
 * assigned by sorting the pipeline's fixtures by `slug` (the pipeline itself
 * already writes its per-slug files in slug order, per
 * `scripts/poi-pipeline/OUTPUT-CONTRACT.md`'s determinism guarantee).
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

    const fixtures = readPipelineFixtures();
    console.log(`Read ${fixtures.length} POI fixtures from ${PIPELINE_OUTPUT_DIR}`);

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
            '\nRefusing to write any fixture until every row validates (HOS-142 spec §6.1). See the ' +
                'HOS-142 delegation report for the known upstream mismatches (nameI18n/descriptionI18n ' +
                'en/pt nulls, verifiedAt date-vs-string, source length overflow).'
        );
        process.exitCode = 1;
        return;
    }

    console.log(`All ${fixtures.length} fixtures validated successfully.`);

    // ── 2. Slug collision check against the 12 existing fixtures. ──
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
        console.error(
            `${collisions.length} new fixture(s) collide with an existing slug:`,
            collisions.map((c) => c.data.slug)
        );
        process.exitCode = 1;
        return;
    }

    // ── 3. Duplicate-slug check within the new 914. ──
    const newSlugs = fixtures.map(({ data }) => data.slug);
    const duplicates = newSlugs.filter((slug, i) => newSlugs.indexOf(slug) !== i);
    if (duplicates.length > 0) {
        console.error('Duplicate slugs within the new fixture set:', [...new Set(duplicates)]);
        process.exitCode = 1;
        return;
    }

    if (dryRun) {
        console.log(`Dry run: would write ${fixtures.length} files to ${LIVE_DATA_DIR}.`);
        return;
    }

    // ── 4. Write, numbered 013 onward, sorted by slug. ──
    mkdirSync(LIVE_DATA_DIR, { recursive: true });
    let written = 0;
    for (let i = 0; i < fixtures.length; i++) {
        const { data } = fixtures[i] as { data: RawPoiFixture };
        const num = String(i + 1 + EXISTING_FIXTURE_COUNT).padStart(3, '0');
        const id = `${num}-point-of-interest-${data.slug}`;
        const fixture = {
            $schema: '../../schemas/point-of-interest.schema.json',
            id,
            ...data
        };
        writeFileSync(join(LIVE_DATA_DIR, `${id}.json`), `${JSON.stringify(fixture, null, 4)}\n`);
        written++;
    }

    console.log(
        `Wrote ${written} fixtures to ${LIVE_DATA_DIR} (${EXISTING_FIXTURE_COUNT + 1}-${EXISTING_FIXTURE_COUNT + written} numbering).`
    );
    console.log(
        'Next step: add every new filename to manifest-required.json\'s "pointOfInterestCatalog" key.'
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
