/**
 * Declarative argv specs and fail-closed flag validation for every `hops`
 * command (HOS-510 follow-up).
 *
 * ## Why this module exists
 *
 * Every command in `src/commands/*.ts` parses its own argv with
 * `args.includes('--x')`. That predicate answers "was this flag passed?" and
 * nothing else — it cannot tell an absent flag from a misspelled one, so an
 * unrecognized token is dropped without a word while the rest of the command
 * runs normally.
 *
 * `@repo/seed` had the identical hole and it was not theoretical: `pnpm
 * db:seed:migrate --status` discarded the unknown `--status`, kept
 * `--data-migrate`, and applied every pending data-migration when the operator
 * had typed a command to LOOK at the ledger. Measured on a dev database on
 * 2026-08-15: `seed_migrations` went 44 rows → 54, exit code 0, no warning.
 *
 * `hops` is the same defect on a worse target: it runs against PRODUCTION.
 * The existing mitigation is real but partial — write paths log their mode
 * (`Mode: apply pending`) and prompt for confirmation with `defaultValue:
 * false` on prod, so a typo asks instead of mutating silently. That protects
 * the interactive operator and does nothing for `--yes`, for a CI invocation,
 * or for a read-only command that quietly did something other than what was
 * typed.
 *
 * So validation happens centrally, in `main()`, BEFORE the command runs.
 *
 * ## Why a shared validator instead of a check per command
 *
 * Patching each command re-creates the bug the next time someone adds one. The
 * spec below is a REQUIRED field on the `Command` interface, so a new command
 * cannot be registered without declaring its argv surface — the compiler is
 * the guard, and there is no list to keep in sync by hand.
 *
 * ## What this deliberately does NOT validate
 *
 * Positional arguments. The bug class this closes is "unknown FLAG silently
 * ignored"; positionals are already validated per command (each dies on a
 * missing or invalid `<kind>`). Leaving them alone is also what keeps the two
 * pass-through commands working — see {@link CommandArgvSpec.payloadAfterPositionals}.
 *
 * @module lib/cli-flags
 */

/**
 * Which spelling of `--key value` a given value flag accepts.
 *
 * This is declared PER FLAG, not per command, because the codebase is
 * genuinely inconsistent here and the inconsistency is load-bearing:
 *
 * - `'space'`  — only `--key value`. The common case: `logs -n 50`,
 *   `update --repo <path>`, `env-list --match <regex>`, `env-pull -o <path>`,
 *   `psql -f <path>`, `exec --env <prefix>`, `db-restore --target-db <name>`,
 *   `free-mem --warn-pct <n>`.
 * - `'equals'` — only `--key=value`. `db-superadmin-pass --email=` is the sole
 *   member, and it does not merely fail to support the spaced form: it
 *   explicitly `die()`s on it with its own message. Accepting `--email x` here
 *   would let this validator wave through an invocation the command then
 *   rejects.
 * - `'both'`   — either spelling: `billing-test-link`/`billing-test-reset`
 *   `--email` / `--buyer-email`, `env-check-rules --app`, and the three
 *   `r2-lifecycle` flags.
 */
export type ValueFlagSyntax = 'equals' | 'space' | 'both';

/** A flag that consumes a value, and the spelling(s) it accepts. */
export interface ValueFlagSpec {
    /** Flag name including dashes, e.g. `--email` or `-n`. */
    readonly name: string;
    /** Which spelling(s) the command's own parser actually accepts. */
    readonly syntax: ValueFlagSyntax;
}

/**
 * The complete argv surface of one command, as the command's own parser reads
 * it — NOT as its `--help` text describes it.
 *
 * The distinction is not pedantic. Six live mismatches between help text and
 * parsing code were found while writing this (undocumented `-y` aliases on
 * both billing commands; `env-check-rules --app api` in its spaced form). A
 * spec transcribed from help text would have rejected invocations that work
 * today, against production, which is a worse outcome than the hole it closes.
 */
export interface CommandArgvSpec {
    /** Every flag the parser treats as a standalone toggle, matched exactly. */
    readonly booleanFlags: readonly string[];

    /** Every flag that consumes a value, with the spelling(s) it accepts. */
    readonly valueFlags: readonly ValueFlagSpec[];

    /**
     * How many bare (non-dash) tokens the command consumes as its own
     * positionals before any pass-through payload begins. Only meaningful
     * together with {@link payloadAfterPositionals}.
     *
     * @defaultValue 0
     */
    readonly leadingPositionals?: number;

    /**
     * When true, validation STOPS at the first bare token past
     * {@link leadingPositionals}, treating everything after it as opaque
     * payload rather than as this command's argv.
     *
     * Exactly two commands need it, and both for a structural reason rather
     * than an oversight:
     *
     * - `exec <kind> [cmd...]` forwards its trailing argv verbatim into the
     *   container. In `hops exec api ls -la /repo`, the `-la` belongs to `ls`
     *   and must never be checked against `exec`'s flags.
     * - `psql` joins its remaining positionals into free-form SQL, which can
     *   legitimately contain `--` (a SQL line comment) and leading dashes.
     *
     * Note what this still catches: the boundary is the first BARE token, so
     * flags written before the payload are validated normally.
     * `hops exec api --shel` is refused (the `api` positional is consumed by
     * `leadingPositionals`, then `--shel` is checked), while
     * `hops exec api ls -la` stops at `ls`. Only tokens after the payload
     * begins go unchecked, which is the price of having a pass-through at all.
     */
    readonly payloadAfterPositionals?: boolean;

    /**
     * Near-miss suggestions keyed by the exact token an operator may type.
     * Reserved for tokens where the wrong guess is expensive or the right
     * answer is not guessable from `--help` alone.
     */
    readonly hints?: Readonly<Record<string, string>>;
}

/** One argument the command does not recognize, with a suggestion when one applies. */
export interface UnknownFlag {
    /** The offending token, verbatim as it was passed. */
    readonly flag: string;
    /** A near-miss suggestion, when the token matches a known footgun. */
    readonly hint?: string;
}

/** Input for {@link validateCommandFlags}. */
export interface ValidateCommandFlagsInput {
    /** The command's argv, with the command name and global `--target` already stripped. */
    readonly argv: readonly string[];
    /** The command's declared surface. */
    readonly spec: CommandArgvSpec;
}

/** Result of {@link validateCommandFlags}. */
export interface ValidateCommandFlagsResult {
    /** Every unrecognized token, in the order it appeared. Empty means the invocation is valid. */
    readonly unknown: readonly UnknownFlag[];
}

/** Hints that apply to every command, since these tokens are typed everywhere. */
const GLOBAL_HINTS: Readonly<Record<string, string>> = {
    '--dry-run':
        'no such global flag. Read-only previews are per command: db-seed-migrate has --status, billing-test-reset is dry-run by default (--execute writes), cron-trigger has --dry-run.',
    '--env':
        'to pick an environment use the GLOBAL --target=prod|staging, before or after the command name. (`exec` has its own --env <prefix>, which lists container env vars.)',
    '--prod': 'did you mean --target=prod?',
    '--staging': 'did you mean --target=staging?',
    '--force': 'no such flag; the confirmation skip is --yes.',
    '-y': 'did you mean --yes? (-y is only an alias on the billing-test-* commands.)'
};

/** Looks up the hint for a token, matching `--key=value` on its key. */
function hintFor(arg: string, spec: CommandArgvSpec): string | undefined {
    const key = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    return spec.hints?.[key] ?? GLOBAL_HINTS[key];
}

/**
 * Partitions a command's argv into recognized and unrecognized tokens.
 *
 * Pure: no filesystem, no environment, no process exit. The caller decides
 * what a non-empty `unknown` means (`main()` refuses to dispatch).
 *
 * Recognized shapes:
 * - a boolean toggle listed in `spec.booleanFlags`, matched EXACTLY (so
 *   `--yes=true` is refused: it is a different token, and accepting it would
 *   reopen the "looks handled, is not" hole this closes);
 * - `--key=value` whose key is a value flag accepting `'equals'` or `'both'`,
 *   with a non-empty value;
 * - `--key` followed by a separate value token, for a value flag accepting
 *   `'space'` or `'both'` — the value token is consumed and never validated,
 *   so a value that itself looks like a flag still works;
 * - any bare (non-dash) token, which this validator leaves to the command;
 * - a lone `--` separator.
 *
 * @param input - See {@link ValidateCommandFlagsInput}.
 * @returns See {@link ValidateCommandFlagsResult}.
 *
 * @example
 * ```ts
 * validateCommandFlags({
 *     argv: ['--statuss'],
 *     spec: { booleanFlags: ['--status'], valueFlags: [] }
 * });
 * // => { unknown: [{ flag: '--statuss' }] }
 * ```
 */
export function validateCommandFlags(input: ValidateCommandFlagsInput): ValidateCommandFlagsResult {
    const { argv, spec } = input;

    const unknown: UnknownFlag[] = [];
    const leading = spec.leadingPositionals ?? 0;
    let bareSeen = 0;

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === undefined) {
            continue;
        }

        // A lone `--` ends this command's own flags. For a pass-through
        // command it also opens the payload; `exec` strips exactly this token
        // before forwarding.
        if (arg === '--') {
            if (spec.payloadAfterPositionals) {
                break;
            }
            continue;
        }

        if (!arg.startsWith('-')) {
            bareSeen++;
            // Past the command's own positionals, a pass-through command's
            // remaining argv belongs to something else entirely.
            if (spec.payloadAfterPositionals && bareSeen > leading) {
                break;
            }
            continue;
        }

        if (spec.booleanFlags.includes(arg)) {
            continue;
        }

        if (arg.includes('=')) {
            const key = arg.slice(0, arg.indexOf('='));
            const value = arg.slice(arg.indexOf('=') + 1);
            const match = spec.valueFlags.find((flag) => flag.name === key);
            if (match && match.syntax !== 'space' && value.length > 0) {
                continue;
            }
            unknown.push({ flag: arg, ...withHint(arg, spec) });
            continue;
        }

        const match = spec.valueFlags.find((flag) => flag.name === arg);
        if (match && match.syntax !== 'equals') {
            // Consume the value token unvalidated: it is data, and it may
            // legitimately start with a dash (a negative number, a regex).
            index++;
            continue;
        }

        unknown.push({ flag: arg, ...withHint(arg, spec) });
    }

    return { unknown };
}

/** Builds the optional `hint` property, omitted entirely when there is none. */
function withHint(arg: string, spec: CommandArgvSpec): { hint?: string } {
    const hint = hintFor(arg, spec);
    return hint ? { hint } : {};
}

/** Input for {@link formatUnknownFlagsError}. */
export interface FormatUnknownFlagsErrorInput {
    /** The command the tokens were passed to, for the `--help` pointer. */
    readonly commandName: string;
    /** The unrecognized tokens reported by {@link validateCommandFlags}. */
    readonly unknown: readonly UnknownFlag[];
}

/**
 * Renders the refusal message printed before `hops` exits non-zero.
 *
 * States plainly that nothing ran. After a refused command the operator's
 * first question is always "did it touch anything before it stopped?", and for
 * this refusal the answer is a guaranteed no: validation happens before the
 * target policy is applied, before any container is looked up, and before any
 * connection is opened.
 *
 * @param input - See {@link FormatUnknownFlagsErrorInput}.
 * @returns A multi-line message: one line per unknown token with its hint when
 *   one applies, then the refusal statement and the `--help` pointer.
 */
export function formatUnknownFlagsError(input: FormatUnknownFlagsErrorInput): string {
    const { commandName, unknown } = input;

    const lines: string[] = [];
    lines.push(`Unrecognized argument${unknown.length === 1 ? '' : 's'} for '${commandName}':`);
    for (const entry of unknown) {
        lines.push(`  ${entry.flag}${entry.hint ? ` — ${entry.hint}` : ''}`);
    }
    lines.push('');
    lines.push(
        `Refusing to run: nothing was executed, no container was contacted and no connection was opened. Run 'hops ${commandName} --help' to see every supported flag.`
    );

    return lines.join('\n');
}
