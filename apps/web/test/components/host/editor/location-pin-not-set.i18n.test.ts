/**
 * @file location-pin-not-set.i18n.test.ts
 * @description Source-level translations for the unplaced location pin notice
 * (HOS-1767, TEST:1767:17).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;

interface HostJson {
    readonly properties: {
        readonly editor: {
            readonly location: Record<string, string>;
        };
    };
}

function readHostJson({ locale }: { readonly locale: (typeof LOCALES)[number] }): HostJson {
    return JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../../../packages/i18n/src/locales/${locale}/host.json`),
            'utf8'
        )
    ) as HostJson;
}

describe('host.properties.editor.location.pinNotSet (HOS-1767)', () => {
    it.each(LOCALES)('TEST:1767:17 — %s has a non-empty notice', (locale) => {
        const { location } = readHostJson({ locale }).properties.editor;

        expect(typeof location.pinNotSet).toBe('string');
        expect(location.pinNotSet.trim().length).toBeGreaterThan(0);
    });
});
