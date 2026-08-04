/**
 * @file field-input-id-contract.test.ts
 * @description Static guard for the HOS-373 field-to-input-id contract.
 *
 * ## Why this exists
 *
 * `focusFirstInvalidField` resolves an id with `document.getElementById`. When
 * the id is wrong, that returns `null` and the function does nothing — no
 * throw, no warning, no failing assertion anywhere. The feature degrades to
 * exactly the behaviour it was built to replace, and nobody finds out until a
 * user complains.
 *
 * So the contract needs to be checked against the markup, not trusted.
 *
 * ## How it discovers the ids
 *
 * By reading the map modules themselves and scanning the editors' section
 * sources for each id. Discovery is driven by the map (every key must be
 * accounted for), never by grepping for an `id=` pattern — a pattern scan
 * silently loses coverage the moment someone writes the attribute differently.
 *
 * Ids that are built dynamically are declared here explicitly, because a raw
 * text search cannot see them:
 *  - accommodation socials render as {`acc-${config.idSlug}`}
 *  - commerce socials render as {`ce-social-${key}`}
 *  - commerce openingHours renders as a conditional on the first day
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMERCE_FIELD_INPUT_IDS } from '@/components/commerce/editor/field-input-ids';
import { ACCOMMODATION_FIELD_INPUT_IDS } from '@/components/host/editor/field-input-ids';

const SRC = resolve(__dirname, '../../../src/components');

/** Reads every `.tsx` under a directory tree into one searchable string. */
function readTree(dir: string): string {
    const out: string[] = [];
    const walk = (current: string): void => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = resolve(current, entry.name);
            if (entry.isDirectory()) {
                walk(path);
            } else if (entry.name.endsWith('.tsx')) {
                out.push(readFileSync(path, 'utf8'));
            }
        }
    };
    walk(dir);
    return out.join('\n');
}

/**
 * Ids assembled at runtime from a template, with the literal fragment that
 * proves the generator exists. Keeping the fragment (rather than skipping the
 * id) means renaming the template still fails this test.
 */
const DYNAMIC_IDS: Readonly<Record<string, string>> = {
    // `id={`acc-${config.idSlug}`}` in host/editor/SocialNetworksSection
    'acc-facebook': 'acc-${config.idSlug}',
    'acc-instagram': 'acc-${config.idSlug}',
    'acc-twitter': 'acc-${config.idSlug}',
    'acc-linkedin': 'acc-${config.idSlug}',
    'acc-tiktok': 'acc-${config.idSlug}',
    'acc-youtube': 'acc-${config.idSlug}',
    // `id={`ce-social-${key}`}` in commerce/editor/SocialNetworksSection
    'ce-social-facebook': 'ce-social-${key}',
    'ce-social-instagram': 'ce-social-${key}',
    'ce-social-twitter': 'ce-social-${key}',
    'ce-social-tiktok': 'ce-social-${key}',
    'ce-social-youtube': 'ce-social-${key}',
    'ce-social-linkedIn': 'ce-social-${key}'
};

describe('field-to-input-id contract', () => {
    const accommodationSource = readTree(resolve(SRC, 'host'));
    const commerceSource = `${readTree(resolve(SRC, 'commerce'))}\n${accommodationSource}`;

    /** The rich-text editor is shared, so commerce also searches host sources. */
    const cases: ReadonlyArray<{
        readonly label: string;
        readonly map: Readonly<Record<string, string>>;
        readonly source: string;
    }> = [
        {
            label: 'accommodation',
            map: ACCOMMODATION_FIELD_INPUT_IDS,
            source: accommodationSource
        },
        { label: 'commerce', map: COMMERCE_FIELD_INPUT_IDS, source: commerceSource }
    ];

    for (const { label, map, source } of cases) {
        describe(label, () => {
            it('should map at least one field', () => {
                // Guards against the map being emptied and every assertion below
                // vacuously passing.
                expect(Object.keys(map).length).toBeGreaterThan(0);
            });

            for (const [field, id] of Object.entries(map)) {
                it(`should render an input with id "${id}" for "${field}"`, () => {
                    const dynamicFragment = DYNAMIC_IDS[id];
                    const needle = dynamicFragment ?? `id="${id}"`;
                    const found =
                        source.includes(needle) ||
                        // Some ids are passed as a JSX expression rather than a
                        // string literal (e.g. id={'ce-openingHours'} or a
                        // conditional), so accept the bare quoted id too.
                        source.includes(`'${id}'`) ||
                        source.includes(`"${id}"`);

                    expect(
                        found,
                        `No input renders id "${id}" (mapped from "${field}"). ` +
                            'Focus-on-error would silently do nothing for this field.'
                    ).toBe(true);
                });
            }
        });
    }
});
