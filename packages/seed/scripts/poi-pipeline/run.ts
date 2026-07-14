#!/usr/bin/env tsx
/**
 * HOS-141 — POI data-cleaning pipeline CLI.
 *
 * Standalone dev script that turns the consolidated POI CSV export into a
 * staged, validated, seed-ready dataset (JSON fixtures + destination-relations
 * + a report). It intentionally lives outside `src/` so the `@repo/seed`
 * runtime can never accidentally import it (HOS-141 spec NG-1/NG-4).
 *
 * Usage:
 *   pnpm --filter @repo/seed exec tsx scripts/poi-pipeline/run.ts \
 *     [--dry-run] [--limit=<N>] [--input=<path>]
 *
 *   `--dry-run`:       geocode + transform but DO NOT write fixtures; print the
 *                      report to stdout (validate match rate cheaply first).
 *   `--limit=<N>`:     process only the first N input rows (for a dry-run
 *                      sample). Must be a positive integer.
 *   `--input=<path>`:  absolute path to the source CSV. Defaults to
 *                      {@link DEFAULT_INPUT_PATH}.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCachedGeocoder, fileCacheIO } from './cache.js';
import { writePoiFixtures } from './emit.js';
import { createNominatimGeocoder } from './geocoder.js';
import { createGooglePlacesGeocoder } from './google-places.js';
import { loadCsv } from './loader.js';
import { runPipeline } from './pipeline.js';
import { writeRelations } from './relations.js';
import { buildReport, writeReport } from './report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default absolute path to the consolidated POI CSV export used as pipeline
 * input when `--input` is not supplied.
 */
export const DEFAULT_INPUT_PATH = '/home/qazuor/Downloads/POIS/Hospeda-POIs-Consolidado.csv';

/**
 * Absolute path to the pipeline's staged output directory (§6.4). Never the
 * real seed data folder — output only ever lands here until a human reviews
 * and HOS-142 promotes it into `packages/seed/src/data/pointOfInterest/`.
 */
export const OUTPUT_DIR = path.resolve(__dirname, 'output');

/** Committed geocode cache path (§6.3.3) — warm re-runs make zero network calls. */
export const CACHE_PATH = path.resolve(__dirname, 'geocode-cache.json');

/** Committed Google Places cache path — separate file so a re-run costs $0. */
export const GOOGLE_CACHE_PATH = path.resolve(__dirname, 'google-places-cache.json');

/**
 * Hard cap on live Google Places calls per run (belt; the Google Cloud Console
 * quota is the server-side suspenders). The batch is ~618, so 750 leaves head-
 * room without risking a runaway bill.
 */
const GOOGLE_MAX_REQUESTS = 750;

/** Nominatim User-Agent (required by its ToS). */
const USER_AGENT = 'hospeda-poi-pipeline/1.0 (+https://github.com/qazuor/hospeda; HOS-141)';

/**
 * Parsed CLI options for a POI pipeline run.
 */
export interface PipelineArgs {
    /** When `true`, the pipeline must not write any output (default: `false`). */
    readonly dryRun: boolean;
    /** Optional cap on the number of input rows to process. */
    readonly limit?: number;
    /** Absolute path to the source CSV. Defaults to {@link DEFAULT_INPUT_PATH}. */
    readonly input: string;
}

/**
 * Parses the `--limit=<N>` flag's value out of raw argv tokens.
 *
 * @param argv - Raw argv tokens (see {@link parseArgs}).
 * @returns The parsed positive integer, or `undefined` when the flag is absent.
 * @throws {Error} If present with a value that is not a positive integer.
 */
function parseLimitArg(argv: readonly string[]): number | undefined {
    const limitArg = argv.find((arg) => arg.startsWith('--limit='));
    if (!limitArg) {
        return undefined;
    }
    const raw = limitArg.slice('--limit='.length);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value '${raw}'. Expected a positive integer.`);
    }
    return parsed;
}

/**
 * Parses raw CLI argv tokens into typed {@link PipelineArgs}.
 *
 * @param argv - Raw argv tokens, already sliced past the node/script path.
 * @returns The parsed, defaulted pipeline options.
 * @throws {Error} If `--limit` is present with a non-positive-integer value.
 */
export function parseArgs(argv: readonly string[]): PipelineArgs {
    const dryRun = argv.includes('--dry-run');
    const limit = parseLimitArg(argv);
    const inputArg = argv.find((arg) => arg.startsWith('--input='));
    const input = inputArg ? inputArg.slice('--input='.length) : DEFAULT_INPUT_PATH;
    return limit === undefined ? { dryRun, input } : { dryRun, limit, input };
}

/**
 * Runs the pipeline end to end against a real CSV + a cached Nominatim
 * geocoder, writing the staged output unless `--dry-run`.
 *
 * @param args - The parsed CLI options.
 */
async function main(args: PipelineArgs): Promise<void> {
    // Only assert the full 914-row count on an unlimited, non-dry-run pass.
    const expectedRows = args.limit === undefined ? 914 : undefined;
    const allRows = loadCsv({ path: args.input, expectedRows });
    const rows = args.limit === undefined ? allRows : allRows.slice(0, args.limit);
    console.log(`[poi-pipeline] Loaded ${rows.length} row(s) from ${args.input}`);

    const geocoder = createCachedGeocoder({
        geocoder: createNominatimGeocoder({ userAgent: USER_AGENT }),
        io: fileCacheIO(CACHE_PATH)
    });

    // Google Places fallback is enabled only when the API key is present in the
    // environment — no key means Nominatim-only and zero paid calls.
    const placesKey = process.env.HOSPEDA_GOOGLE_PLACES_API_KEY?.trim();
    const fallbackGeocoder = placesKey
        ? createCachedGeocoder({
              geocoder: createGooglePlacesGeocoder({
                  apiKey: placesKey,
                  maxRequests: GOOGLE_MAX_REQUESTS
              }),
              io: fileCacheIO(GOOGLE_CACHE_PATH)
          })
        : undefined;
    console.log(
        fallbackGeocoder
            ? '[poi-pipeline] Google Places fallback ENABLED (key present).'
            : '[poi-pipeline] Google Places fallback DISABLED (no HOSPEDA_GOOGLE_PLACES_API_KEY). Nominatim only.'
    );

    console.log('[poi-pipeline] Running pipeline (geocoding coordinate-less rows)...');
    const { fixtures, relations, stats } = await runPipeline({ rows, geocoder, fallbackGeocoder });

    if (args.dryRun) {
        console.log('[poi-pipeline] DRY RUN — not writing output. Report:\n');
        console.log(buildReport(stats).markdown);
        console.log(
            `[poi-pipeline] Live provider calls this run: Nominatim ${geocoder.networkCalls}, Google Places ${fallbackGeocoder?.networkCalls ?? 0}`
        );
        return;
    }

    const written = writePoiFixtures({ fixtures, outputDir: OUTPUT_DIR });
    writeRelations({ relations, outputDir: OUTPUT_DIR });
    writeReport({ stats, outputDir: OUTPUT_DIR });
    console.log(
        `[poi-pipeline] Wrote ${written} fixtures + destination-relations.json + report to ${OUTPUT_DIR}`
    );
    console.log(
        `[poi-pipeline] Live provider calls this run: Nominatim ${geocoder.networkCalls}, Google Places ${fallbackGeocoder?.networkCalls ?? 0}`
    );
}

/**
 * True when this module is executed as a CLI entry point (not imported), so
 * tests can import {@link parseArgs} without triggering {@link main}.
 */
const IS_CLI_ENTRY = process.argv[1]
    ? path.resolve(process.argv[1]) === path.resolve(__filename)
    : false;

if (IS_CLI_ENTRY) {
    main(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error('[poi-pipeline] FAILED:', error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
