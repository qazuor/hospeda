/**
 * @file icon-manifest-coverage.test.ts
 * @description Coverage guard for the committed icon-sprite manifest
 * (HOS-369 sprite-manifest): proves the manifest is not just internally
 * self-consistent (the drift guard's job) but that ACTUALLY RENDERING an
 * icon the app can reach, with sprite mode + the real manifest turned on,
 * produces a `<use>` reference rather than a silent fallback to inline.
 *
 * This is deliberately a DIFFERENT verification mechanism than the analyzer
 * itself: the drift guard re-runs the same static-scan logic that built the
 * manifest, so it can only catch the manifest disagreeing with a re-run of
 * itself — a bug IN the analyzer would pass both the analyzer and the drift
 * guard. This file instead renders real `@repo/icons` components through
 * `react-dom/server` (the same renderer the sprite generator and the SSR
 * process use) and inspects the actual markup, so a wrong glyph-name
 * assumption, a wrong weight assumption, or a JSON/expand round-trip bug
 * shows up as a real rendering difference, not just a re-derived number
 * matching itself.
 *
 * Covers the DATA-DRIVEN groups specifically (`scripts/icon-manifest/data-driven-groups.ts`)
 * — the hand-researched, harder-to-verify half of the manifest — rather than
 * every statically-imported call site, which the drift guard already
 * verifies is self-consistent by construction (it comes from the SAME source
 * scan that decides the manifest).
 */

import * as iconExports from '@repo/icons';
import {
    getIconSpriteName,
    hasIconSpriteSymbol,
    setIconSpriteBase,
    setIconSpriteSymbols
} from '@repo/icons';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveDataDrivenGroups } from '../../scripts/icon-manifest/data-driven-groups';
import iconSpriteManifest from '../../src/lib/icon-sprite-manifest.json';

const BASE = '/icons/sprite.9f3a1c07.svg';

/** Every manifest entry as a compact `"name:initials"` string, mirroring `icon-sprite.ts`. */
const MANIFEST_ENTRIES = Object.entries(iconSpriteManifest as Record<string, string>).map(
    ([name, initials]) => `${name}:${initials}`
);

/**
 * Turns real sprite mode on with the REAL committed manifest, exactly what
 * `apps/web` runs in production. A module-level singleton in `@repo/icons`,
 * so this must be redone before EVERY test, not once for the file — a
 * `describe()` body only runs once at collection time, before any `it`.
 */
function enableRealSpriteMode(): void {
    setIconSpriteBase(BASE);
    setIconSpriteSymbols({ symbols: MANIFEST_ENTRIES });
}

beforeEach(() => {
    enableRealSpriteMode();
});

const { groups, missing } = resolveDataDrivenGroups();

describe('data-driven icon groups render via <use> under the real manifest', () => {
    it('resolved every declared group with nothing missing', () => {
        expect(missing).toEqual([]);
    });

    for (const group of groups) {
        it(`${group.id}: every sprite-eligible glyph renders via <use> at every weight the group needs`, () => {
            expect(group.iconIdentifiers.length).toBeGreaterThan(0);

            const misses: string[] = [];
            let checked = 0;

            for (const identifier of group.iconIdentifiers) {
                const Component = (iconExports as Record<string, unknown>)[identifier];
                if (
                    Component === undefined ||
                    (typeof Component !== 'function' && typeof Component !== 'object')
                ) {
                    misses.push(`${identifier}: not exported from @repo/icons`);
                    continue;
                }

                // Brand-mark icons (FacebookIcon, WhatsappIcon, …) are never
                // sprite-eligible — `getIconSpriteName` returns null for them
                // by construction (see `glyph-resolver.ts`'s module doc). The
                // analyzer already excludes these from the manifest itself, so
                // this guard skips them too rather than failing on a rendering
                // property the app never claimed for them.
                if (getIconSpriteName(Component) === null) continue;
                checked++;

                for (const weight of group.weights) {
                    const html = renderToStaticMarkup(
                        createElement(Component as ComponentType<{ weight: string }>, { weight })
                    );
                    if (!html.includes('<use')) {
                        misses.push(
                            `${identifier} at weight="${weight}" rendered inline, not <use>`
                        );
                    }
                }
            }

            expect(misses).toEqual([]);
            // Non-vacuity: a group whose every identifier happened to be
            // brand-only would report zero misses without checking anything.
            expect(
                checked,
                `${group.id}: no sprite-eligible identifiers were actually checked`
            ).toBeGreaterThan(0);
        });
    }
});

describe('the manifest genuinely gates rendering (non-vacuity for the suite above)', () => {
    it('a glyph the manifest does NOT list renders inline even with sprite mode on', () => {
        // FacebookIcon is a brand mark — never in ANY manifest, by construction.
        // If this rendered via <use>, the coverage checks above would prove
        // nothing: every glyph would "pass" regardless of what the manifest
        // actually lists.
        const html = renderToStaticMarkup(createElement(iconExports.FacebookIcon, {}));

        expect(html).not.toContain('<use');
    });

    it('the real manifest actually restricts hasIconSpriteSymbol (proves the suite is not silently permissive)', () => {
        expect(hasIconSpriteSymbol({ symbol: 'DefinitelyNotAGlyph-regular' })).toBe(false);
    });

    it('at least one glyph per group is genuinely sprite-eligible (skip logic above is not swallowing everything)', () => {
        const allBrandOnly = groups.filter((group) =>
            group.iconIdentifiers.every(
                (identifier) =>
                    getIconSpriteName((iconExports as Record<string, unknown>)[identifier]) === null
            )
        );

        expect(allBrandOnly.map((group) => group.id)).toEqual([]);
    });
});
