/**
 * @file i18n-catalog.ts
 * @description Test-side `t()` that resolves against the REAL `es` catalog.
 *
 * HOS-616 moved inline Spanish fallbacks out of the call sites and into the
 * locale files. Mocks shaped like `(key, fallback) => fallback ?? key` used to
 * render real copy purely because the copy was duplicated in the source; once
 * the fallback is gone they render the dotted key, and every assertion written
 * against visible text breaks.
 *
 * Resolving against the catalog keeps those assertions meaningful AND makes
 * them stricter than before: a key that does not exist can no longer be
 * papered over by a fallback string sitting next to it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../packages/i18n/src/locales/es'
);

const cache = new Map<string, Record<string, unknown>>();

/**
 * Reads one `es` namespace file, memoized per namespace.
 *
 * @param namespace - The namespace, i.e. the first dotted segment of a key.
 * @returns The parsed namespace object, or an empty object when absent.
 */
function readNamespace({ namespace }: { namespace: string }): Record<string, unknown> {
    const hit = cache.get(namespace);
    if (hit) return hit;
    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(readFileSync(join(LOCALES_DIR, `${namespace}.json`), 'utf8'));
    } catch {
        parsed = {};
    }
    cache.set(namespace, parsed);
    return parsed;
}

/**
 * Interpolates both placeholder dialects used in this app: `{{name}}` and `{name}`.
 *
 * @param text - The resolved template.
 * @param params - Values to substitute, keyed by placeholder name.
 * @returns The interpolated string.
 */
function interpolate({ text, params }: { text: string; params?: Record<string, unknown> }): string {
    if (!params) return text;
    return Object.entries(params).reduce(
        (acc, [name, value]) =>
            acc
                .replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(value))
                .replace(new RegExp(`\\{\\s*${name}\\s*\\}`, 'g'), String(value)),
        text
    );
}

/**
 * Resolves a translation key against the real `es` catalog.
 *
 * @param key - Fully-qualified dotted key, e.g. `newsletter.confirmYourEmail.resend`.
 * @param fallback - Optional inline fallback, honoured only when the key is absent.
 * @param params - Optional interpolation values.
 * @returns The catalog text, the fallback, or the key itself — matching production's order.
 */
export function tFromCatalog(
    key: string,
    fallback?: string,
    params?: Record<string, unknown>
): string {
    const [namespace, ...rest] = key.split('.');
    let node: unknown = readNamespace({ namespace });
    for (const segment of rest) {
        if (node === null || typeof node !== 'object') {
            node = undefined;
            break;
        }
        node = (node as Record<string, unknown>)[segment];
    }
    const resolved = typeof node === 'string' ? node : (fallback ?? key);
    return interpolate({ text: resolved, params });
}
