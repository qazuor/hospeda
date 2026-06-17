#!/usr/bin/env tsx

/**
 * @file check-locales.ts
 * @description CI-friendly i18n parity checker.
 *
 * Validates that:
 *  1) Every JSON namespace present in any locale exists in ALL locales (es/en/pt).
 *  2) Every key present in the reference locale (`es`) is present in `en` and `pt`.
 *  3) Specific SPEC-096 namespaces required for the web app are present in all locales.
 *  4) (Soft) reports keys that are in non-reference locales but missing from `es` (extra keys).
 *
 * Exit codes:
 *  - 0: parity OK
 *  - 1: missing namespace(s) or missing key(s) in any locale
 *
 * Usage:
 *   tsx scripts/check-locales.ts
 *   pnpm --filter @repo/i18n check-locales
 *
 * Environment:
 *   - I18N_CHECK_STRICT_EXTRA=1 → also fail when non-reference locales contain
 *     keys missing from `es` (default: warn only).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LOCALES_DIR = resolve(import.meta.dirname, '../src/locales');
const REFERENCE_LOCALE = 'es';
const REQUIRED_LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof REQUIRED_LOCALES)[number];

/**
 * Namespaces introduced (or extended) by SPEC-096 that MUST exist in all locales.
 * Keep in sync with the spec when adding new web-only namespaces.
 */
const SPEC_096_REQUIRED_NAMESPACES = [
    'breadcrumbs',
    'categoryTiles',
    'tagChips',
    'shared',
    'seo',
    'nav',
    'footer',
    'common',
    'search',
    'contact',
    'ui',
    'account',
    // Gastronomy commerce listings (SPEC-239)
    'gastronomy',
    // Commerce shared — lead form, change-password, visibility (SPEC-239)
    'commerce'
] as const;

const STRICT_EXTRA = process.env.I18N_CHECK_STRICT_EXTRA === '1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CheckResult {
    readonly missingNamespaces: ReadonlyArray<{ locale: Locale; namespace: string }>;
    readonly missingKeys: ReadonlyArray<{ locale: Locale; namespace: string; key: string }>;
    readonly extraKeys: ReadonlyArray<{ locale: Locale; namespace: string; key: string }>;
    readonly missingRequiredNamespaces: ReadonlyArray<{ locale: Locale; namespace: string }>;
}

/**
 * Recursively extract dot-notation keys from a JSON object.
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/**
 * Read all JSON namespaces in a locale directory.
 */
function readLocaleNamespaces(locale: Locale): Map<string, Record<string, unknown>> {
    const dir = join(LOCALES_DIR, locale);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const namespaces = new Map<string, Record<string, unknown>>();

    for (const file of files) {
        const filePath = join(dir, file);
        if (!statSync(filePath).isFile()) continue;
        const namespace = file.replace(/\.json$/, '');
        const content = readFileSync(filePath, 'utf-8');
        try {
            namespaces.set(namespace, JSON.parse(content) as Record<string, unknown>);
        } catch (error) {
            console.error(`❌ Failed to parse ${filePath}:`, error);
            process.exit(1);
        }
    }

    return namespaces;
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

function check(): CheckResult {
    const locales = new Map<Locale, Map<string, Record<string, unknown>>>();
    for (const locale of REQUIRED_LOCALES) {
        locales.set(locale, readLocaleNamespaces(locale));
    }

    const reference = locales.get(REFERENCE_LOCALE);
    if (!reference) {
        throw new Error(`Reference locale '${REFERENCE_LOCALE}' not found`);
    }

    // Build the union of all namespaces present anywhere.
    const allNamespaces = new Set<string>();
    for (const ns of reference.keys()) allNamespaces.add(ns);
    for (const locale of REQUIRED_LOCALES) {
        const map = locales.get(locale);
        if (!map) continue;
        for (const ns of map.keys()) allNamespaces.add(ns);
    }

    const missingNamespaces: Array<{ locale: Locale; namespace: string }> = [];
    const missingKeys: Array<{ locale: Locale; namespace: string; key: string }> = [];
    const extraKeys: Array<{ locale: Locale; namespace: string; key: string }> = [];
    const missingRequiredNamespaces: Array<{ locale: Locale; namespace: string }> = [];

    // 1) Required SPEC-096 namespaces present in every locale.
    for (const requiredNs of SPEC_096_REQUIRED_NAMESPACES) {
        for (const locale of REQUIRED_LOCALES) {
            const map = locales.get(locale);
            if (!map?.has(requiredNs)) {
                missingRequiredNamespaces.push({ locale, namespace: requiredNs });
            }
        }
    }

    // 2) Per-namespace parity vs the reference locale.
    for (const namespace of allNamespaces) {
        const refContent = reference.get(namespace);
        const refKeys = refContent ? new Set(extractKeys(refContent)) : new Set<string>();

        for (const locale of REQUIRED_LOCALES) {
            const map = locales.get(locale);
            const localeContent = map?.get(namespace);
            if (!localeContent) {
                missingNamespaces.push({ locale, namespace });
                continue;
            }
            const localeKeys = new Set(extractKeys(localeContent));

            // Keys missing in the locale (relative to reference).
            for (const refKey of refKeys) {
                if (!localeKeys.has(refKey)) {
                    missingKeys.push({ locale, namespace, key: refKey });
                }
            }

            // Keys present in locale but not in reference (extra).
            if (locale !== REFERENCE_LOCALE) {
                for (const localeKey of localeKeys) {
                    if (!refKeys.has(localeKey)) {
                        extraKeys.push({ locale, namespace, key: localeKey });
                    }
                }
            }
        }
    }

    return { missingNamespaces, missingKeys, extraKeys, missingRequiredNamespaces };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportAndExit(result: CheckResult): void {
    const { missingNamespaces, missingKeys, extraKeys, missingRequiredNamespaces } = result;

    let hasError = false;

    if (missingRequiredNamespaces.length > 0) {
        hasError = true;
        console.error('\n❌ Missing SPEC-096 required namespaces:');
        for (const { locale, namespace } of missingRequiredNamespaces) {
            console.error(`   - [${locale}] ${namespace}.json`);
        }
    }

    if (missingNamespaces.length > 0) {
        hasError = true;
        console.error('\n❌ Missing namespaces (present in another locale but not in this one):');
        for (const { locale, namespace } of missingNamespaces) {
            console.error(`   - [${locale}] ${namespace}.json`);
        }
    }

    if (missingKeys.length > 0) {
        hasError = true;
        // Group output by locale + namespace for readability.
        const grouped = new Map<string, string[]>();
        for (const { locale, namespace, key } of missingKeys) {
            const bucket = `[${locale}] ${namespace}`;
            const arr = grouped.get(bucket) ?? [];
            arr.push(key);
            grouped.set(bucket, arr);
        }
        console.error('\n❌ Missing keys (present in `es` but not in this locale):');
        for (const [bucket, keys] of grouped) {
            console.error(`   ${bucket}: ${keys.length} key(s)`);
            for (const key of keys.slice(0, 10)) {
                console.error(`     • ${key}`);
            }
            if (keys.length > 10) {
                console.error(`     ... (${keys.length - 10} more)`);
            }
        }
    }

    if (extraKeys.length > 0) {
        const label = STRICT_EXTRA ? '❌ Extra keys' : '⚠️  Extra keys (warning)';
        console.error(`\n${label} (present in non-es locale but not in es):`);
        const grouped = new Map<string, string[]>();
        for (const { locale, namespace, key } of extraKeys) {
            const bucket = `[${locale}] ${namespace}`;
            const arr = grouped.get(bucket) ?? [];
            arr.push(key);
            grouped.set(bucket, arr);
        }
        for (const [bucket, keys] of grouped) {
            console.error(`   ${bucket}: ${keys.length} key(s)`);
            for (const key of keys.slice(0, 10)) {
                console.error(`     • ${key}`);
            }
            if (keys.length > 10) {
                console.error(`     ... (${keys.length - 10} more)`);
            }
        }
        if (STRICT_EXTRA) hasError = true;
    }

    if (!hasError) {
        console.log('✅ i18n parity OK across all locales (es/en/pt)');
    }

    process.exit(hasError ? 1 : 0);
}

reportAndExit(check());
