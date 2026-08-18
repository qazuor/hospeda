/**
 * @file video-gate-shape.guard.test.ts
 * @description Static guard against the two ways the video gate died before
 * (NOSPEC:gate-video-inerte).
 *
 * `CAN_EMBED_VIDEO` shipped as a plan gate that enforced nothing for months, and
 * no behaviour test could see it, because the failure was not a wrong result —
 * it was code inspecting data shapes that no longer existed:
 *
 *   1. `filtered.videoUrl` — a field declared by no accommodation schema.
 *   2. `Array.isArray(filtered.media)` with a `type === 'video'` filter — the
 *      pre-HOS-372 shape, when `media` was a flat array instead of
 *      `{ featuredImage, gallery, videos }`.
 *
 * A filter that matches nothing removes nothing and throws nothing, so every
 * "does not break the payload" test stayed green. The unit tests that were
 * supposed to cover it used FIXTURES built to the same dead shapes, which is why
 * they agreed with the code instead of with the database.
 *
 * A behaviour test can prove the gate works today. Only a static check can stop
 * the shape from being reintroduced, so that is what this file is.
 *
 * Every assertion runs against the source with comments STRIPPED: the module
 * documents its own history and names `videoUrl` and `hasEntitlement` in prose
 * while using neither. A plain substring search over the raw file would fail on
 * the explanation rather than on the defect.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FILTER_PATH = resolve(__dirname, '../../src/utils/entitlement-filter.ts');

/**
 * Source with block comments, line comments and string literals removed.
 *
 * String literals go too: an entitlement key is referenced as
 * `EntitlementKey.CAN_EMBED_VIDEO`, never as a bare string, so nothing this
 * guard looks for legitimately lives inside quotes — but a log message might
 * quote a field name and read as a false positive.
 */
function executableSource(): string {
    return readFileSync(FILTER_PATH, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

describe('video gate — dead shapes cannot come back', () => {
    it('the comment stripper actually strips (guard on the guard)', () => {
        const raw = readFileSync(FILTER_PATH, 'utf8');
        const stripped = executableSource();

        // If this fails the stripper is broken and every assertion below is
        // vacuous — passing because it sees an empty haystack, not a clean one.
        // The probe is a phrase that exists ONLY in prose, so its disappearance
        // proves comments were removed. It must not be a token that also has a
        // legitimate code occurrence, or the probe passes for the wrong reason.
        const COMMENT_ONLY_PROBE = 'HOS-372';
        expect(raw).toContain(COMMENT_ONLY_PROBE);
        expect(stripped).not.toContain(COMMENT_ONLY_PROBE);
        // And the code itself survived — a stripper that ate everything would
        // satisfy every `not.toMatch` below.
        expect(stripped).toContain('export function filterAccommodationByEntitlements');
        expect(stripped.length).toBeGreaterThan(1000);
    });

    it('does not read a `videoUrl` field', () => {
        const src = executableSource();

        // Anchored on the property-access and declaration forms, NOT on the bare
        // word: `videoUrlPatterns` is a legitimate local inside `stripVideoUrls`,
        // and a guard that flagged it would be reporting its own imprecision as a
        // defect.
        expect(src).not.toMatch(/\.videoUrl\b(?!Patterns)/);
        expect(src).not.toMatch(/\bvideoUrl\s*\??\s*:/);
    });

    it('does not treat `media` as an array of typed items', () => {
        const src = executableSource();

        // The marker of the dead shape is the per-item `type` discriminant — the
        // flat `[{ type: 'video' }]` array that predates HOS-372. String literals
        // are blanked by the stripper, so `item.type !== 'video'` reads as
        // `type !== ''` here.
        expect(src).not.toMatch(/\btype\s*[!=]==\s*''/);

        // `Array.isArray` is deliberately NOT banned: the readers use it NEGATED,
        // to narrow `media` to an object before touching it. Banning the call
        // would flag the defensive check that makes the new code total.
        expect(src).toMatch(/!Array\.isArray\(/);
    });

    it('does not derive the gate from the requesting user', () => {
        const src = executableSource();

        // The payload is shared-cached with no auth in the cache key (HOS-19,
        // HOS-353). Reading the viewer here serves the first viewer's plan
        // result to everyone for the TTL.
        expect(src).not.toMatch(/hasEntitlement\s*\(/);
        expect(src).not.toMatch(/userEntitlements/);
    });

    it('clears every surface that carries video', () => {
        const src = executableSource();

        // `videos` reaches the wire twice: the top-level column, and the copy
        // `composeAccommodationMedia` splices into `media.videos`. The public
        // schema picks both, so clearing one leaves the other serving the same
        // URLs — the failure mode `richDescription` + `richDescriptionI18n`
        // already document.
        expect(src).toMatch(/delete\s+filtered\.videos/);
        expect(src).toMatch(/videos:\s*\[\]/);
        expect(src).toMatch(/stripVideoUrls\s*\(/);
    });

    it('re-applies the video gate in the fail-closed catch', () => {
        const src = executableSource();
        const catchBlock = src.slice(src.indexOf('} catch'));

        // Every OWNER-gated field is re-applied after a throw, so the gate does
        // not depend on statement order. Video became owner-gated, so it joins.
        expect(catchBlock).toMatch(/CAN_EMBED_VIDEO/);
        expect(catchBlock).toMatch(/stripVideoContent\s*\(/);
    });
});
