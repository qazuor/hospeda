/**
 * Regression + drift-guard tests for the i18n type generator's filename →
 * runtime namespace resolution (HOS-127).
 *
 * The generator used to derive each namespace verbatim from the locale JSON
 * filename, so `destination.json` / `event.json` produced `destination.*` /
 * `event.*` keys — but the runtime registers those namespaces in the PLURAL
 * form (`destinations` / `events`). The generated `TranslationKey` union
 * therefore promised keys that never resolve at runtime. `resolveNamespace`
 * closes that gap; these tests pin the remap and, crucially, guard against the
 * broader "generated types lie" drift class going forward.
 */

import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FILENAME_NAMESPACE_OVERRIDES, resolveNamespace } from '../scripts/generate-types';
import { namespaces } from '../src/config';

const ES_LOCALE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/locales/es');

/**
 * Base names (filename minus `.json`) of every Spanish locale file. `es` is the
 * source-of-truth locale (see `defaultLocale`); en/pt mirror it, so checking one
 * locale is sufficient for namespace-shape assertions.
 */
function localeFileBaseNames(): readonly string[] {
    return readdirSync(ES_LOCALE_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
}

/**
 * Locale JSON files that exist on disk but are intentionally NOT registered as a
 * runtime namespace. Every file NOT in this allowlist MUST resolve to a
 * registered namespace — that is the drift guard. A NEW orphan added here must
 * reference a tracking issue.
 *
 * HOS-163 emptied this set: `cookies` / `partners` were registered in
 * `config.shared.ts` (they were a live en/pt bug — their `t()` calls fell back
 * to Spanish), and the five genuinely-dead files (`breadcrumbs`,
 * `categoryTiles`, `seo`, `shared`, `tagChips`) were deleted. The honesty test
 * below keeps this allowlist from going stale.
 */
const KNOWN_UNREGISTERED_FILES: ReadonlySet<string> = new Set([]);

describe('generate-types namespace resolution (HOS-127)', () => {
    it('remaps the singular locale filenames to their plural runtime namespace', () => {
        expect(resolveNamespace('destination')).toBe('destinations');
        expect(resolveNamespace('event')).toBe('events');
    });

    it('never emits the singular prefix for the remapped files', () => {
        expect(resolveNamespace('destination')).not.toBe('destination');
        expect(resolveNamespace('event')).not.toBe('event');
    });

    it('passes filenames through unchanged when the namespace equals the filename', () => {
        expect(resolveNamespace('home')).toBe('home');
        expect(resolveNamespace('accommodations')).toBe('accommodations');
        expect(resolveNamespace('auth-ui')).toBe('auth-ui');
        expect(resolveNamespace('admin-billing')).toBe('admin-billing');
    });

    it('ties every override to a real runtime namespace (single source of truth)', () => {
        // Guard: if a namespace is renamed in config.shared.ts, this fails loudly
        // instead of silently regenerating a mismatched union again.
        const registered = new Set<string>(namespaces);
        for (const [fileBaseName, runtimeNamespace] of Object.entries(
            FILENAME_NAMESPACE_OVERRIDES
        )) {
            // The remapped target must be an actually-registered namespace.
            expect(registered.has(runtimeNamespace)).toBe(true);
            // The raw filename must NOT be a registered namespace — otherwise the
            // override would be unnecessary (or actively wrong).
            expect(registered.has(fileBaseName)).toBe(false);
        }
    });

    it('resolves every locale JSON file to a registered runtime namespace (drift guard)', () => {
        // The real guard the ticket is about: a locale file whose resolved
        // namespace is not registered emits keys into TranslationKey that never
        // resolve at runtime. A NEW such file (not in the HOS-163 allowlist)
        // fails here — register it in config.shared.ts / config.admin.ts, or add
        // it to KNOWN_UNREGISTERED_FILES with a tracking issue.
        const registered = new Set<string>(namespaces);
        const unexpectedOrphans = localeFileBaseNames().filter(
            (base) => !registered.has(resolveNamespace(base)) && !KNOWN_UNREGISTERED_FILES.has(base)
        );
        expect(unexpectedOrphans).toEqual([]);
    });

    it('has no locale file named after an override target (collision guard)', () => {
        // If a file were named after an override's TARGET (e.g. `destinations.json`
        // next to `destination.json`), both would merge into the same namespace
        // prefix with no error. Nothing should sit on top of a remap target.
        const targets = new Set<string>(Object.values(FILENAME_NAMESPACE_OVERRIDES));
        const collisions = localeFileBaseNames().filter((base) => targets.has(base));
        expect(collisions).toEqual([]);
    });

    it('keeps the known-unregistered allowlist honest (prune it as HOS-163 resolves files)', () => {
        // Prevents a stale allowlist from masking a re-registered/deleted file.
        const registered = new Set<string>(namespaces);
        const onDisk = new Set<string>(localeFileBaseNames());
        for (const base of KNOWN_UNREGISTERED_FILES) {
            // Still on disk (deleting the file means removing it from the allowlist).
            expect(onDisk.has(base)).toBe(true);
            // Still genuinely unregistered (registering it means removing it here so
            // the drift guard starts covering it).
            expect(registered.has(resolveNamespace(base))).toBe(false);
        }
    });
});
