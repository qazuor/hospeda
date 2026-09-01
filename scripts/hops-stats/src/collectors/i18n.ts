import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { I18nStats, NamespaceStats, Outcome } from '../types.js';

/** Where the locale files live, relative to the repository root. */
const LOCALES_DIR = 'packages/i18n/src/locales';

/** Spanish is the product's default, so it defines what a complete namespace is. */
const REFERENCE = 'es';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Flatten a nested translation object into dotted leaf paths.
 *
 * Only leaves count: an object is structure, not a translated string. Arrays are
 * treated as leaves because a list of strings is one translatable unit here.
 */
function leafKeys(value: Json, prefix = '', out: Set<string> = new Set()): Set<string> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        if (prefix.length > 0) out.add(prefix);
        return out;
    }
    for (const [key, child] of Object.entries(value)) {
        leafKeys(child, prefix.length === 0 ? key : `${prefix}.${key}`, out);
    }
    return out;
}

async function readNamespace(
    repo: string,
    locale: string,
    file: string
): Promise<Set<string> | null> {
    try {
        const text = await readFile(join(repo, LOCALES_DIR, locale, file), 'utf8');
        return leafKeys(JSON.parse(text) as Json);
    } catch {
        return null;
    }
}

/**
 * Translation coverage, measured against the default locale.
 *
 * "Missing" and "extra" are different problems: a missing key means the UI falls
 * back or shows a raw key to a user in that language, while an extra key is dead
 * weight left behind by a rename nobody propagated. Reporting one number for
 * both would hide which one you have.
 */
export async function collectI18n(repo: string): Promise<Outcome<I18nStats>> {
    let locales: string[];
    try {
        const entries = await readdir(join(repo, LOCALES_DIR), { withFileTypes: true });
        locales = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
    } catch {
        return { ok: false, reason: `no se encontró ${LOCALES_DIR} en este repositorio` };
    }
    if (!locales.includes(REFERENCE)) {
        return { ok: false, reason: `falta el locale de referencia '${REFERENCE}'` };
    }

    const others = locales.filter((l) => l !== REFERENCE);

    const refFiles = (await readdir(join(repo, LOCALES_DIR, REFERENCE)))
        .filter((f) => f.endsWith('.json'))
        .sort();
    if (refFiles.length === 0)
        return { ok: false, reason: 'el locale de referencia no tiene namespaces' };

    // A namespace that exists only in a translation is orphaned: nothing in the
    // reference locale will ever load it.
    const orphans = new Set<string>();
    for (const locale of others) {
        const files = (await readdir(join(repo, LOCALES_DIR, locale))).filter((f) =>
            f.endsWith('.json')
        );
        for (const file of files) if (!refFiles.includes(file)) orphans.add(`${locale}/${file}`);
    }

    const byNamespace: NamespaceStats[] = [];
    const missingByLocale: Record<string, number> = Object.fromEntries(others.map((l) => [l, 0]));
    const extraByLocale: Record<string, number> = Object.fromEntries(others.map((l) => [l, 0]));
    let totalKeys = 0;

    for (const file of refFiles) {
        const reference = await readNamespace(repo, REFERENCE, file);
        if (reference === null) continue;
        totalKeys += reference.size;

        const missing: Record<string, number> = {};
        const extra: Record<string, number> = {};
        for (const locale of others) {
            const translated = await readNamespace(repo, locale, file);
            if (translated === null) {
                // The whole file is absent: every key is missing, not zero.
                missing[locale] = reference.size;
                extra[locale] = 0;
                missingByLocale[locale] = (missingByLocale[locale] ?? 0) + reference.size;
                continue;
            }
            const absent = [...reference].filter((key) => !translated.has(key)).length;
            const surplus = [...translated].filter((key) => !reference.has(key)).length;
            missing[locale] = absent;
            extra[locale] = surplus;
            missingByLocale[locale] = (missingByLocale[locale] ?? 0) + absent;
            extraByLocale[locale] = (extraByLocale[locale] ?? 0) + surplus;
        }

        byNamespace.push({
            namespace: file.replace(/\.json$/, ''),
            keys: reference.size,
            missing,
            extra
        });
    }

    byNamespace.sort((a, b) => b.keys - a.keys);

    return {
        ok: true,
        data: {
            reference: REFERENCE,
            locales,
            namespaces: refFiles.length,
            totalKeys,
            byNamespace,
            missingByLocale,
            extraByLocale,
            orphanNamespaces: [...orphans].sort()
        }
    };
}
