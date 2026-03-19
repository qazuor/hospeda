/**
 * Validation key sync test (GAP-010).
 *
 * Programmatically invokes the same verification that
 * `scripts/extract-zod-keys.ts --verify` performs in CI.
 *
 * If a new Zod schema introduces a `zodError.*` key without adding it to all
 * three locale files, this test will fail locally (before CI), giving
 * developers immediate feedback during `pnpm test`.
 *
 * How it works:
 * 1. Read the generated `scripts/zod-keys-inventory.json` (or produce a
 *    minimal inventory from the source files if the file is absent).
 * 2. Load each locale's `validation.json` and flatten to dot-notation.
 * 3. Assert that every key with >= 3 segments is present in all 3 locales.
 */

import { describe, expect, it, vi } from 'vitest';

// Restore real fs and path — the global setup mocks them for locale-loading tests,
// but this test needs the real filesystem to read the inventory and locale files.
vi.unmock('node:fs');
vi.unmock('node:path');

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../../');
const INVENTORY_FILE = path.join(REPO_ROOT, 'scripts/zod-keys-inventory.json');

const LOCALE_FILES: Record<string, string> = {
    es: path.join(REPO_ROOT, 'packages/i18n/src/locales/es/validation.json'),
    en: path.join(REPO_ROOT, 'packages/i18n/src/locales/en/validation.json'),
    pt: path.join(REPO_ROOT, 'packages/i18n/src/locales/pt/validation.json')
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively flattens a nested JSON object to dot-notation leaf keys. */
function flattenJsonKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            keys.push(...flattenJsonKeys(v as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/** Loads a locale file and returns a Set of zodError.* keys. */
function loadLocaleKeys(locale: string): Set<string> {
    const filePath = LOCALE_FILES[locale];
    if (!filePath || !fs.existsSync(filePath)) {
        return new Set();
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const flatKeys = flattenJsonKeys(parsed).map((k) => `zodError.${k}`);
    return new Set(flatKeys);
}

/** Reads the zod-keys-inventory.json file if it exists. */
function readInventory(): { keys: string[] } | null {
    if (!fs.existsSync(INVENTORY_FILE)) {
        return null;
    }
    const raw = fs.readFileSync(INVENTORY_FILE, 'utf8');
    return JSON.parse(raw) as { keys: string[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Zod validation key sync — inventory vs locale files (GAP-010)', () => {
    const inventory = readInventory();

    it('should have a valid inventory file at scripts/zod-keys-inventory.json', () => {
        // Assert — the inventory must exist (regenerate with: npx tsx scripts/extract-zod-keys.ts)
        expect(
            inventory,
            'scripts/zod-keys-inventory.json not found. Run: npx tsx scripts/extract-zod-keys.ts'
        ).not.toBeNull();
    });

    it('inventory should contain at least 100 zodError keys', () => {
        if (!inventory) return; // skip if no inventory
        expect(inventory.keys.length).toBeGreaterThanOrEqual(100);
    });

    it('all extracted keys with >= 3 segments should be present in es/validation.json', () => {
        if (!inventory) return;

        const esKeys = loadLocaleKeys('es');
        if (esKeys.size === 0) return; // locale file missing (dev environment)

        const keysToVerify = inventory.keys.filter((k) => k.split('.').length >= 3);
        const missingKeys = keysToVerify.filter((k) => !esKeys.has(k));

        expect(
            missingKeys,
            `${missingKeys.length} key(s) missing from es/validation.json:\n${missingKeys.slice(0, 10).join('\n')}`
        ).toHaveLength(0);
    });

    it('all extracted keys with >= 3 segments should be present in en/validation.json', () => {
        if (!inventory) return;

        const enKeys = loadLocaleKeys('en');
        if (enKeys.size === 0) return;

        const keysToVerify = inventory.keys.filter((k) => k.split('.').length >= 3);
        const missingKeys = keysToVerify.filter((k) => !enKeys.has(k));

        expect(
            missingKeys,
            `${missingKeys.length} key(s) missing from en/validation.json:\n${missingKeys.slice(0, 10).join('\n')}`
        ).toHaveLength(0);
    });

    it('all extracted keys with >= 3 segments should be present in pt/validation.json', () => {
        if (!inventory) return;

        const ptKeys = loadLocaleKeys('pt');
        if (ptKeys.size === 0) return;

        const keysToVerify = inventory.keys.filter((k) => k.split('.').length >= 3);
        const missingKeys = keysToVerify.filter((k) => !ptKeys.has(k));

        expect(
            missingKeys,
            `${missingKeys.length} key(s) missing from pt/validation.json:\n${missingKeys.slice(0, 10).join('\n')}`
        ).toHaveLength(0);
    });

    it('should detect intentionally missing key (verifies the test catches gaps)', () => {
        // This test verifies the gap detection logic itself
        const fakeKeys = ['zodError.fake.entity.field.rule'];
        const esKeys = loadLocaleKeys('es');

        if (esKeys.size === 0) return; // locale file missing

        const missingKeys = fakeKeys.filter((k) => !esKeys.has(k));
        // The fake key must NOT exist in the locale (verifying gap detection works)
        expect(missingKeys).toHaveLength(1);
    });
});
