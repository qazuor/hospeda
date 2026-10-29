/**
 * @file step-4c.args.ts
 * @description Strict argument parsing for the step 4c command (HOS-1957).
 */

/** Parsed step 4c command line. */
export interface Step4cArgs {
    readonly dryRun: boolean;
    readonly confirmPurge: boolean;
    /** Extra cache tags to purge, merged with the legacy set generated in code. */
    readonly extraTagsFile?: string;
    /** Extra URL prefixes (host + path) to purge, merged with the legacy set generated in code. */
    readonly extraPrefixesFile?: string;
}

/** Result of {@link parseStep4cArgs}. */
export type ParseStep4cArgsResult =
    | { readonly ok: true; readonly value: Step4cArgs }
    | { readonly ok: false; readonly error: string };

const VALUE_FLAGS = ['--extra-tags-file', '--extra-prefixes-file'] as const;

/**
 * Parses `--dry-run`, `--confirm-purge`, `--extra-tags-file <path>` and
 * `--extra-prefixes-file <path>` (the value may also be given as `--flag=<path>`).
 * Unknown flags and missing values are errors.
 */
export function parseStep4cArgs({
    argv
}: {
    readonly argv: readonly string[];
}): ParseStep4cArgsResult {
    let dryRun = false;
    let confirmPurge = false;
    const values: Record<string, string> = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index] as string;
        if (token === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (token === '--confirm-purge') {
            confirmPurge = true;
            continue;
        }
        const [name, inline] = token.split(/=(.*)/s, 2) as [string, string | undefined];
        if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
            return { ok: false, error: `Unknown flag: ${token}` };
        }
        const value = inline ?? argv[++index];
        if (value === undefined || value === '' || value.startsWith('--')) {
            return { ok: false, error: `Missing value for ${name}` };
        }
        values[name] = value;
    }
    return {
        ok: true,
        value: {
            dryRun,
            confirmPurge,
            ...(values['--extra-tags-file'] ? { extraTagsFile: values['--extra-tags-file'] } : {}),
            ...(values['--extra-prefixes-file']
                ? { extraPrefixesFile: values['--extra-prefixes-file'] }
                : {})
        }
    };
}

/** One value per line; blank lines and `#` comments are ignored; surrounding whitespace is trimmed. */
export function parseListFile({ content }: { readonly content: string }): readonly string[] {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/** Merges lists, trimming and de-duplicating, keeping first-seen order. */
export function mergeUnique({
    lists
}: {
    readonly lists: readonly (readonly string[])[];
}): readonly string[] {
    return [...new Set(lists.flat())];
}
