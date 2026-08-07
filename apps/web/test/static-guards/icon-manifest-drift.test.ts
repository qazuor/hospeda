/**
 * @file icon-manifest-drift.test.ts
 * @description Drift guard for the committed icon-sprite manifest (HOS-369
 * sprite-manifest). Same shape as the repo's migration drift guard: a
 * generated artifact is committed for a reason (the SSR server runs from
 * `dist` and cannot re-derive it at request time), and CI must fail the
 * moment source drifts from what was committed rather than let the two
 * silently diverge.
 *
 * Re-runs the exact analyzer `pnpm icons:build-manifest` runs
 * (`analyzeIconManifest` + `pairsToCompactManifest`) and compares its output
 * to `src/lib/icon-sprite-manifest.json` byte-for-byte (including the
 * generator's own serialization — 4-space indent, trailing newline — so a
 * manually hand-edited manifest fails here too, not just a source-derived
 * mismatch).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeIconManifest, pairsToCompactManifest } from '../../scripts/icon-manifest/analyze';

const MANIFEST_PATH = resolve(__dirname, '../../src/lib/icon-sprite-manifest.json');

function serializeManifest(manifest: Record<string, string>): string {
    return `${JSON.stringify(manifest, null, 4)}\n`;
}

describe('icon-sprite-manifest.json drift guard', () => {
    it('matches exactly what the analyzer currently derives from source', () => {
        const report = analyzeIconManifest();
        const expected = serializeManifest(pairsToCompactManifest(report.pairs));
        const committed = readFileSync(MANIFEST_PATH, 'utf8');

        expect(
            committed,
            'The committed icon-sprite manifest is stale. Run `pnpm icons:build-manifest` (from apps/web) and commit the result.'
        ).toBe(expected);
    });

    it('is non-trivial — a manifest that collapsed to empty would still "match" an empty analyzer run', () => {
        // Non-vacuity for the test above: proves the comparison is between two
        // REAL, non-empty manifests, not two empty strings that happen to be equal.
        const report = analyzeIconManifest();

        expect(report.pairs.size).toBeGreaterThan(50);
    });

    it('is a strict subset of what the pre-HOS-369 full sprite would have shipped', () => {
        // Sanity bound on the manifest itself: it must never grow to reference
        // every glyph the package exports (that would defeat the whole point of
        // subsetting) nor collapse to zero (that would inline every icon).
        const report = analyzeIconManifest();
        const pairCount = [...report.pairs.values()].reduce(
            (total, weights) => total + weights.size,
            0
        );

        expect(pairCount).toBeGreaterThan(0);
        expect(pairCount).toBeLessThan(988);
    });
});
