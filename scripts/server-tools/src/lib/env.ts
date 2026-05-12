/**
 * Loads `.env.local` from the toolkit directory and exposes typed
 * accessors so commands don't have to repeat `process.env.X ?? throw`
 * everywhere.
 *
 * The toolkit deliberately reads its OWN `.env.local`, not the project
 * root one. Operational secrets (Coolify token, R2 keys) belong to the
 * operator, not to the application — keeping them isolated lets us
 * rotate independently and avoids tempting anyone to import them into
 * the API container.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';

/**
 * Resolve the `.env.local` path, trying several strategies in order so the
 * loader works in both development (`bun run src/index.ts ...`) and as a
 * compiled binary (`bun build --compile` ships the script through a virtual
 * `bunfs:///...` filesystem where `import.meta.url` is NOT a real filesystem
 * path — the previous `resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')`
 * approach silently fails in that mode).
 *
 * Order:
 *   1. `HOPS_ENV_FILE` env var — explicit operator override.
 *   2. Path relative to the running binary (`process.execPath`):
 *      `<binDir>/../hospeda/scripts/server-tools/.env.local` and
 *      `~/hospeda/scripts/server-tools/.env.local` (standard install).
 *   3. Path relative to the source file (only works in `bun run`).
 *   4. `process.cwd()/.env.local` (when invoked from the toolkit dir).
 */
function resolveEnvPath(): string {
    const explicit = process.env.HOPS_ENV_FILE;
    if (explicit && existsSync(explicit)) return explicit;

    const candidates: string[] = [];

    // Standard install location: ~/hospeda/scripts/server-tools/.env.local
    const home = homedir();
    if (home) {
        candidates.push(resolve(home, 'hospeda', 'scripts', 'server-tools', '.env.local'));
    }

    // Source-file-based path (works when running `bun run src/index.ts`).
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        candidates.push(resolve(here, '..', '..', '.env.local'));
    } catch {
        // import.meta.url is not a file: URL (compiled binary) — skip.
    }

    // Current working directory fallback (when cwd is the toolkit dir).
    candidates.push(resolve(process.cwd(), '.env.local'));

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    // Return the first candidate so callers get a useful path in error
    // messages even when the file does not exist.
    return candidates[0] ?? resolve(process.cwd(), '.env.local');
}

const envPath = resolveEnvPath();

let loaded = false;

function loadOnce(): void {
    if (loaded) return;
    loaded = true;
    if (!existsSync(envPath)) {
        return; // Tools that need values will surface a clear error.
    }
    // Use the `dotenv` package's parser (SPEC-103 T-053). It handles
    // edge cases the previous hand-rolled loop missed: inline comments
    // (`FOO=bar # tail`), multi-line values with escape sequences, and
    // escaped quotes inside values. Behaviour preserved: existing
    // `process.env` entries take precedence over file contents.
    const raw = readFileSync(envPath, 'utf-8');
    const parsed = parseDotenv(raw);
    for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

/**
 * Read an env var. Returns `undefined` when missing — callers that need
 * a hard requirement should use {@link required}.
 */
export function get(name: string): string | undefined {
    loadOnce();
    const value = process.env[name];
    return value && value.length > 0 ? value : undefined;
}

/**
 * Read an env var or die with a helpful error pointing the operator at
 * `.env.local.example`. Use this for the secrets that gate a command
 * (R2 keys, Coolify token).
 */
export function required(name: string): string {
    const value = get(name);
    if (!value) {
        throw new Error(
            `${name} is not set. Add it to scripts/server-tools/.env.local — see .env.local.example for the full list.`
        );
    }
    return value;
}

/**
 * Path to the toolkit's `.env.local`, exposed for tools that want to
 * mention it in error messages or open it in $EDITOR.
 */
export const envFilePath = envPath;
