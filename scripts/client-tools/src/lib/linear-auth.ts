import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');

/**
 * Where the key is looked for, in order.
 *
 * Two paths because the tool was renamed after the file was already in use:
 * checking both means an existing setup keeps working and nobody has to keep a
 * symlink alive just to bridge the rename.
 */
export const CONFIG_PATHS = [
    join(CONFIG_DIR, 'hospeda', 'stats.conf'),
    join(CONFIG_DIR, 'hops-stats', 'config')
] as const;

export const CONFIG_PATH = CONFIG_PATHS[0];

export const MISSING_KEY_HELP =
    `falta LINEAR_API_KEY.\n` +
    `     Generala en Linear → Settings → Security & access → Personal API keys.\n` +
    `     Guardala en ${CONFIG_PATHS[0]} como:\n` +
    `       LINEAR_API_KEY='lin_api_...'      (chmod 600)\n` +
    `     El archivo, y no solo la variable: una universal de fish no la ve un\n` +
    `     subproceso ni un cron.`;

export type KeySource = { readonly key: string; readonly origin: string };

/**
 * Every place a key could come from, in order of precedence.
 *
 * Plural on purpose. An environment variable holding a stale or rotated key used
 * to win outright and the config file was never reached, so a perfectly good
 * file sat there while the tool reported an authentication error. Callers try
 * each in turn and report WHICH one was rejected.
 */
export async function loadApiKeys(): Promise<KeySource[]> {
    const found: KeySource[] = [];
    const seen = new Set<string>();

    const add = (key: string, origin: string): void => {
        const clean = key.trim();
        if (clean.length === 0 || seen.has(clean)) return;
        seen.add(clean);
        found.push({ key: clean, origin });
    };

    const fromEnv = process.env['LINEAR_API_KEY'];
    if (fromEnv !== undefined) add(fromEnv, 'la variable de entorno LINEAR_API_KEY');

    for (const path of CONFIG_PATHS) {
        let text: string;
        try {
            text = await readFile(path, 'utf8');
        } catch {
            continue;
        }
        for (const line of text.split('\n')) {
            const match = /^\s*(?:export\s+)?LINEAR_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
            const raw = match?.[1];
            if (raw === undefined) continue;
            add(raw.replace(/^['"]|['"]$/g, ''), path);
        }
    }
    return found;
}

/** Kept for callers that only need to know whether any key exists. */
export async function loadApiKey(): Promise<string | null> {
    const keys = await loadApiKeys();
    return keys[0]?.key ?? null;
}
