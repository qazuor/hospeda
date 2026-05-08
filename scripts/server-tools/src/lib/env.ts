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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const toolkitRoot = resolve(here, '..', '..');
const envPath = resolve(toolkitRoot, '.env.local');

let loaded = false;

function loadOnce(): void {
    if (loaded) return;
    loaded = true;
    if (!existsSync(envPath)) {
        return; // Tools that need values will surface a clear error.
    }
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Strip a single layer of surrounding quotes — common in dotenv
        // files (`FOO="bar"`).
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
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
