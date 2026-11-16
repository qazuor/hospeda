/**
 * Fail-closed command-line parsing shared by `sweep.ts` and `migration.ts`
 * (HOS-2217).
 *
 * Both CLIs spend real money with `--execute`, and their hard call cap comes
 * from a flag. A malformed value (`--max-calls abc`, `--max-calls --execute`)
 * used to become `NaN`, and `calls > NaN` is always false: the cap vanished.
 * Every helper here throws {@link CliArgError} instead, and the CLIs exit
 * non-zero on it. Pure: no I/O.
 *
 * @module ai-core/scripts/ai-sweep/cli-args
 */

/** A malformed command line. The CLIs print its message and exit with code 2. */
export class CliArgError extends Error {
    override readonly name = 'CliArgError';
}

/**
 * Reads the value of a `--flag value` pair.
 *
 * @param input.argv - The arguments after the script path.
 * @param input.flag - The flag, `--` included.
 * @returns `{ value }`: `null` when the flag is absent.
 * @throws {CliArgError} When the flag is present without a value, or its
 *   "value" is another flag (`--max-calls --execute`).
 */
export function readFlag(input: { readonly argv: readonly string[]; readonly flag: string }): {
    readonly value: string | null;
} {
    const i = input.argv.indexOf(input.flag);
    if (i < 0) return { value: null };
    const value = input.argv[i + 1];
    if (value === undefined || value.trim() === '') {
        throw new CliArgError(`${input.flag} needs a value.`);
    }
    if (value.startsWith('--')) {
        throw new CliArgError(`${input.flag} needs a value, got the flag "${value}".`);
    }
    return { value };
}

/**
 * Reads a flag that must be a positive integer (call caps, concurrency).
 *
 * @param input.argv - The arguments after the script path.
 * @param input.flag - The flag, `--` included.
 * @returns `{ value }`: `null` when the flag is absent.
 * @throws {CliArgError} On anything but digits forming an integer >= 1.
 */
export function readPositiveIntFlag(input: {
    readonly argv: readonly string[];
    readonly flag: string;
}): { readonly value: number | null } {
    const { value } = readFlag(input);
    if (value === null) return { value: null };
    const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new CliArgError(`${input.flag} must be a positive integer, got "${value}".`);
    }
    return { value: parsed };
}

/** A provider entry of a sweep config, as far as its key is concerned. */
export interface KeyedProvider {
    readonly id: string;
    readonly apiKeyEnv: string;
    readonly baseURL?: string | undefined;
}

/**
 * Picks the API key of one provider.
 *
 * `--api-key-file` holds ONE key, meant for the first-party provider. It is
 * applied only to providers WITHOUT a custom `baseURL`: a third-party
 * OpenAI-compatible endpoint always reads its own `apiKeyEnv`, so the
 * first-party key is never sent to someone else's server.
 *
 * @param input.provider - The provider entry.
 * @param input.keyFileContent - Content of `--api-key-file`, or `null`.
 * @param input.env - The environment to read `apiKeyEnv` from.
 * @returns `{ apiKey, source }`: `apiKey` is `null` when none was found.
 */
export function resolveProviderKey(input: {
    readonly provider: KeyedProvider;
    readonly keyFileContent: string | null;
    readonly env: Readonly<Record<string, string | undefined>>;
}): { readonly apiKey: string | null; readonly source: string } {
    const { provider } = input;
    if (input.keyFileContent !== null && !provider.baseURL) {
        const key = input.keyFileContent.trim();
        return { apiKey: key === '' ? null : key, source: '--api-key-file' };
    }
    const key = input.env[provider.apiKeyEnv]?.trim() ?? '';
    return { apiKey: key === '' ? null : key, source: `env var ${provider.apiKeyEnv}` };
}
