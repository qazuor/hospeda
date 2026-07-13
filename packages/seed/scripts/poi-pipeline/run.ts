#!/usr/bin/env tsx
/**
 * HOS-141 T-001 — POI data-cleaning pipeline CLI scaffold.
 *
 * Standalone dev script that will eventually turn the consolidated POI CSV
 * export into staged, validated seed-ready fixtures. It intentionally lives
 * outside `src/` so the `@repo/seed` runtime can never accidentally import
 * it (HOS-141 spec NG-1/NG-4). This first cut only wires up argument
 * parsing — CSV parsing, geocoding, and fixture emission are added by later
 * HOS-141 tasks.
 *
 * Usage:
 *   pnpm --filter @repo/seed exec tsx scripts/poi-pipeline/run.ts \
 *     [--dry-run] [--limit=<N>] [--input=<path>]
 *
 *   `--dry-run`:       print the resolved options and exit without writing
 *                      anything (default: `false`).
 *   `--limit=<N>`:     cap processing to the first N input rows. Must be a
 *                      positive integer. Omit to process every row.
 *   `--input=<path>`:  absolute path to the source CSV. Defaults to
 *                      {@link DEFAULT_INPUT_PATH}.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default absolute path to the consolidated POI CSV export used as pipeline
 * input when `--input` is not supplied.
 */
export const DEFAULT_INPUT_PATH = '/home/qazuor/Downloads/POIS/Hospeda-POIs-Consolidado.csv';

/**
 * Absolute path to the pipeline's staged output directory.
 *
 * This is scratch space for the pipeline's own intermediate and final
 * artifacts (cleaned CSV, validation reports, etc.). It MUST NEVER be the
 * real seed data folder (`packages/seed/src/data/pointOfInterest/`) — see
 * HOS-141 spec §6.4 — output only ever lands here until a human reviews and
 * manually promotes the result into the seed data folder.
 *
 * Nothing is written here yet; this constant is a placeholder for later
 * HOS-141 tasks.
 */
export const OUTPUT_DIR = path.resolve(__dirname, 'output');

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
 * @returns The parsed positive integer, or `undefined` when the flag is
 *   absent.
 * @throws {Error} If the flag is present with a value that is not a
 *   positive integer.
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
 * Follows the same `--flag` / `--key=value` conventions used elsewhere in
 * `@repo/seed`'s CLIs (see `src/cli.ts`'s `parseGroupFlag`): boolean flags
 * are checked with `argv.includes(...)`, valued flags are `--key=value`
 * pairs extracted with `startsWith`/`slice`.
 *
 * @param argv - Raw argv tokens, already sliced past the node/script path
 *   (i.e. `process.argv.slice(2)`).
 * @returns The parsed, defaulted pipeline options.
 * @throws {Error} If `--limit` is present with a value that is not a
 *   positive integer.
 *
 * @example
 * ```ts
 * parseArgs([])                     // { dryRun: false, input: DEFAULT_INPUT_PATH }
 * parseArgs(['--dry-run'])          // { dryRun: true, input: DEFAULT_INPUT_PATH }
 * parseArgs(['--limit=20'])         // { dryRun: false, limit: 20, input: DEFAULT_INPUT_PATH }
 * parseArgs(['--input=/tmp/x.csv']) // { dryRun: false, input: '/tmp/x.csv' }
 * ```
 */
export function parseArgs(argv: readonly string[]): PipelineArgs {
    const dryRun = argv.includes('--dry-run');
    const limit = parseLimitArg(argv);

    const inputArg = argv.find((arg) => arg.startsWith('--input='));
    const input = inputArg ? inputArg.slice('--input='.length) : DEFAULT_INPUT_PATH;

    return limit === undefined ? { dryRun, input } : { dryRun, limit, input };
}

/**
 * Placeholder pipeline entrypoint.
 *
 * Currently only resolves and logs the CLI options; later HOS-141 tasks
 * extend this with CSV parsing, geocoding, and staged-output emission.
 */
function main(): void {
    const options = parseArgs(process.argv.slice(2));
    console.log('[poi-pipeline] Resolved options:', options);
    console.log(`[poi-pipeline] Staged output directory (unused so far): ${OUTPUT_DIR}`);
}

/**
 * True when this module is being executed as a CLI entry point (not
 * imported as a library), so unit tests can safely import {@link parseArgs}
 * without triggering {@link main}'s side effects.
 */
const IS_CLI_ENTRY = process.argv[1]
    ? path.resolve(process.argv[1]) === path.resolve(__filename)
    : false;

if (IS_CLI_ENTRY) {
    main();
}
