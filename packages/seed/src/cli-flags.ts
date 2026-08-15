/**
 * @fileoverview
 * Flag registry and fail-closed validation for the seed CLI (HOS-510).
 *
 * ## Why this module exists
 *
 * Every flag in `cli.ts` is parsed with `args.includes('--x')`. That predicate
 * answers "was this flag passed?" and nothing else — it cannot distinguish an
 * absent flag from a MISSPELLED one, so an unrecognized token used to be
 * dropped without a word while the rest of the command ran normally.
 *
 * For a read-only flag that is not a cosmetic problem, it is a write. The
 * documented status command is `db:seed:migrate:status`
 * (`--data-migrate-status`), but the shape an operator reaches for is
 * `pnpm db:seed:migrate --status`, which expands to
 * `tsx ./src/cli.ts --data-migrate --status`. `--status` was discarded,
 * `--data-migrate` survived alone, and a command typed to LOOK at the ledger
 * applied every pending data-migration instead. Measured on a dev database on
 * 2026-08-15: `seed_migrations` went from 44 rows to 54, exit code 0, no
 * warning. Pointed at staging or production that is an unrequested mutation
 * performed by someone who believed they were querying.
 *
 * So the CLI now refuses to run at all when it sees a token it does not
 * recognize. The safe direction is refusing: a rejected run costs a retype, an
 * accepted one costs a migration nobody asked for.
 *
 * ## Why the registry lives here and not in `cli.ts`
 *
 * `cli.ts` parses its options inside an `IS_CLI_ENTRY` block whose side effects
 * (dotenv, `@repo/db`, the seed runner) make it unimportable from a unit test —
 * which is exactly why the parsing bug went uncovered for so long. Keeping the
 * registry and the validator as pure, side-effect-free exports here makes the
 * one decision that matters testable without spawning a process.
 *
 * @module cli-flags
 */

/**
 * Every boolean toggle the CLI recognizes, in the order `cli.ts` parses them.
 *
 * This list is the CONTRACT: a flag absent from it is refused, so adding a new
 * `args.includes('--x')` in `cli.ts` without adding `--x` here makes that flag
 * unusable rather than silently ignored. That is the intended failure
 * direction — a flag that errors gets noticed, a flag that does nothing does
 * not (see `--migrate` in {@link FLAG_HINTS}).
 */
export const SEED_CLI_BOOLEAN_FLAGS = [
    '--required',
    '--example',
    '--test-users',
    '--poi-catalog',
    '--reset',
    '--rollbackOnError',
    '--continueOnError',
    '--clean-images',
    '--validate-cache',
    '--allow-required-fallback',
    '--data-migrate',
    '--data-migrate-status',
    '--data-migrate-make',
    '--baseline-stamp',
    '--allow-destructive',
    '--destructive',
    '--help'
] as const;

/**
 * Every `--key=value` flag the CLI recognizes. Declared WITHOUT the trailing
 * `=` so the list reads as flag names; {@link validateSeedCliFlags} matches
 * `--key=` prefixes against it.
 */
export const SEED_CLI_VALUE_FLAGS = ['--exclude', '--group'] as const;

/**
 * The flag that takes a bare positional slug after it (`db:seed:make <slug>`).
 * The single positional in this CLI's surface, so it is named rather than
 * inferred.
 */
const POSITIONAL_OWNER_FLAG = '--data-migrate-make';

/**
 * Near-miss suggestions, keyed by the exact token an operator is likely to
 * type. Each entry exists because someone can plausibly reach for it and get
 * something worse than an error.
 *
 * `--status` is the one this module was written for. `--migrate` and `--count`
 * are not typos at all: `--migrate` was a real flag that `runSeed` never read
 * (parsed, recognized, and completely inert), and `--count` was documented in
 * `packages/seed/CLAUDE.md` for a CLI that never implemented it. Both were the
 * same silent-failure family as the bug above, so both are now named
 * explicitly instead of falling through to a bare "unknown flag".
 */
const FLAG_HINTS: Readonly<Record<string, string>> = {
    '--status':
        'did you mean --data-migrate-status? That is the read-only report, exposed as `pnpm db:seed:migrate:status`.',
    '--dry-run':
        'did you mean --data-migrate-status? This CLI has no dry-run mode; the status report is the read-only view.',
    '--make': 'did you mean --data-migrate-make <slug>? (exposed as `pnpm db:seed:make <slug>`)',
    '--baseline': 'did you mean --baseline-stamp?',
    '--migrate':
        'removed: it was parsed but never read, so it never did anything. Structural migrations are `pnpm db:migrate`; seed data-migrations are --data-migrate.',
    '--count':
        'no such flag: example volume is fixed by the static JSON fixtures under src/example/, not by a count.',
    '-h': 'did you mean --help?',
    '--h': 'did you mean --help?'
};

/** A single argument the CLI does not recognize, plus a suggestion when one applies. */
export interface UnknownSeedCliFlag {
    /** The offending argument, verbatim as it was passed. */
    readonly flag: string;

    /** A near-miss suggestion, when the token matches a known footgun. */
    readonly hint?: string;
}

/** Input for {@link validateSeedCliFlags}. */
export interface ValidateSeedCliFlagsInput {
    /** Raw `process.argv.slice(2)` arguments. */
    readonly args: readonly string[];
}

/** Result of {@link validateSeedCliFlags}. */
export interface ValidateSeedCliFlagsResult {
    /** Every unrecognized argument, in the order it appeared. Empty means the invocation is valid. */
    readonly unknown: readonly UnknownSeedCliFlag[];
}

/**
 * Looks up the near-miss hint for a token, matching `--key=value` on its key.
 */
function hintFor(arg: string): string | undefined {
    const key = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    return FLAG_HINTS[key];
}

/**
 * Partitions a raw argument list into recognized and unrecognized tokens.
 *
 * Pure: no filesystem, no environment, no process exit. The caller decides what
 * a non-empty `unknown` means (`cli.ts` refuses to run).
 *
 * Recognized shapes:
 * - a boolean toggle listed in {@link SEED_CLI_BOOLEAN_FLAGS}, matched EXACTLY
 *   (so `--reset=true` is rejected: it is a different token, and accepting it
 *   would re-open the "looks handled, is not" hole this closes);
 * - a `--key=value` pair whose key is listed in {@link SEED_CLI_VALUE_FLAGS},
 *   with a non-empty value;
 * - the bare slug positional immediately after `--data-migrate-make`;
 * - a lone `--` separator, which pnpm may forward when args are passed through
 *   `pnpm run <script> -- <args>`.
 *
 * Everything else — unknown flags, stray positionals, a value flag with no
 * value — is unrecognized.
 *
 * @param input - See {@link ValidateSeedCliFlagsInput}.
 * @returns See {@link ValidateSeedCliFlagsResult}.
 *
 * @example
 * ```ts
 * validateSeedCliFlags({ args: ['--data-migrate', '--status'] });
 * // => { unknown: [{ flag: '--status', hint: 'did you mean --data-migrate-status? ...' }] }
 * ```
 */
export function validateSeedCliFlags(input: ValidateSeedCliFlagsInput): ValidateSeedCliFlagsResult {
    const { args } = input;

    const booleanFlags: readonly string[] = SEED_CLI_BOOLEAN_FLAGS;
    const valueFlags: readonly string[] = SEED_CLI_VALUE_FLAGS;

    const unknown: UnknownSeedCliFlag[] = [];

    // Index of the one bare positional this CLI accepts: the slug that follows
    // `--data-migrate-make`. Resolved up front so the scan below can wave it
    // through by position rather than by guessing at its shape.
    const positionalOwnerIndex = args.indexOf(POSITIONAL_OWNER_FLAG);
    const slugIndex = positionalOwnerIndex === -1 ? -1 : positionalOwnerIndex + 1;

    for (const [index, arg] of args.entries()) {
        if (arg === '--') {
            continue;
        }

        if (!arg.startsWith('--')) {
            // The only legal bare token is the make slug, and only in the slot
            // immediately after its owning flag.
            if (index === slugIndex) {
                continue;
            }
            unknown.push({ flag: arg, ...(hintFor(arg) ? { hint: hintFor(arg) } : {}) });
            continue;
        }

        if (arg.includes('=')) {
            const key = arg.slice(0, arg.indexOf('='));
            const value = arg.slice(arg.indexOf('=') + 1);
            if (valueFlags.includes(key) && value.length > 0) {
                continue;
            }
            unknown.push({ flag: arg, ...(hintFor(arg) ? { hint: hintFor(arg) } : {}) });
            continue;
        }

        if (booleanFlags.includes(arg)) {
            continue;
        }

        unknown.push({ flag: arg, ...(hintFor(arg) ? { hint: hintFor(arg) } : {}) });
    }

    return { unknown };
}

/** Input for {@link formatUnknownFlagsError}. */
export interface FormatUnknownFlagsErrorInput {
    /** The unrecognized arguments reported by {@link validateSeedCliFlags}. */
    readonly unknown: readonly UnknownSeedCliFlag[];
}

/**
 * Renders the refusal message printed before the CLI exits non-zero.
 *
 * States plainly that nothing ran — the operator's next question after a
 * failed seed command is always "did it do anything before it stopped?", and
 * for this refusal the answer is a guaranteed no: validation happens before the
 * database connection is even opened.
 *
 * @param input - See {@link FormatUnknownFlagsErrorInput}.
 * @returns A multi-line message: one line per unknown flag (with its hint when
 *   one applies), then the refusal statement and the `--help` pointer.
 */
export function formatUnknownFlagsError(input: FormatUnknownFlagsErrorInput): string {
    const { unknown } = input;

    const lines: string[] = [];
    lines.push(`Unrecognized argument${unknown.length === 1 ? '' : 's'}:`);
    for (const entry of unknown) {
        lines.push(`  ${entry.flag}${entry.hint ? ` — ${entry.hint}` : ''}`);
    }
    lines.push('');
    lines.push(
        'Refusing to run: nothing was executed and no database connection was opened. Run with --help to see every supported flag.'
    );

    return lines.join('\n');
}

/**
 * Usage text for `--help`.
 *
 * Grouped by what an invocation DOES rather than alphabetically, because the
 * distinction that matters when reading this list is which commands write.
 */
export const SEED_CLI_USAGE = `Usage: pnpm --filter @repo/seed seed [flags]

Seeding:
  --required                    Seed the required catalog data.
  --example                     Seed the example/demo data.
  --test-users                  Seed the dev-only test users.
  --poi-catalog                 Seed the points-of-interest catalog.
  --reset                       Wipe first, then seed (implies --clean-images).
  --exclude=<a,b>               Skip the named entities.
  --allow-required-fallback     Allow required data to fall back when incomplete.
  --rollbackOnError             Roll back the whole run on the first error.
  --continueOnError             Keep going past errors.

Seed data-migrations:
  --data-migrate                Run every pending data-migration.  [WRITES]
  --data-migrate-status         Report applied/pending. Read-only.  [SAFE]
  --data-migrate-make <slug>    Scaffold a new data-migration file.
  --group=required|example      Group for --data-migrate-make.
  --baseline-stamp              Record pending migrations as applied.  [WRITES]
  --allow-destructive           Permit destructive migrations in production.
  --destructive                 Scaffold the new migration as destructive.

Images:
  --clean-images                Delete the Cloudinary seed prefix.  [WRITES]
  --validate-cache              Drop stale entries from the local image cache.

Other:
  --help                        Show this message.

Unrecognized flags are refused rather than ignored (HOS-510): a discarded
--status once turned a status check into a full migration run.`;
