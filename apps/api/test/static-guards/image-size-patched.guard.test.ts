/**
 * @file image-size-patched.guard.test.ts
 * @description Pins the `image-size` that parses user uploads to a release that
 * fixes GHSA-w3rx-r6r6-pgpr (ICNS) and GHSA-5p2g-fcmc-qvqq (JXL/HEIF) (HOS-418).
 *
 * `packages/media/src/server/validate-media-file.ts` runs `imageSize()` on every
 * uploaded buffer, and `image/heic` is an allowed entity type, so a crafted HEIF
 * reaching a vulnerable parser hangs the API process.
 *
 * Why this guard exists even though `pnpm audit` runs in CI: both advisories are
 * listed in `pnpm-workspace.yaml` -> `auditConfig.ignoreGhsas`, because
 * apps/mobile's metro still pins image-size@1.x (build-time only, no user input,
 * no 1.x fix). An ignore silences the advisory for EVERY path, so the audit can
 * no longer see a regression on the path that matters. This test checks that
 * path directly, by resolving the package exactly as Node does at runtime:
 *
 * - from apps/api, because tsup externalises `image-size` and the production
 *   image loads the API's own copy (see `tsup.config.ts`);
 * - from packages/media, which is what its test suite and any other consumer load.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '../../../..');

/** First release carrying the fix for both advisories. */
const PATCHED = [2, 0, 3] as const;

/**
 * Reads the version of `image-size` that Node resolves from a package directory.
 *
 * `image-size` does not export `./package.json`, so the manifest is found by
 * walking up from the resolved entry point.
 */
function resolveImageSizeVersion({ fromDir }: { readonly fromDir: string }): string {
    const entry = createRequire(join(fromDir, 'package.json')).resolve('image-size');
    let dir = dirname(entry);
    while (dir !== dirname(dir)) {
        try {
            const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as {
                readonly name?: string;
                readonly version?: string;
            };
            if (manifest.name === 'image-size' && manifest.version) return manifest.version;
        } catch {
            // No package.json at this level; keep walking up.
        }
        dir = dirname(dir);
    }
    throw new Error(`image-size package.json not found above ${entry}`);
}

/**
 * Compares a `major.minor.patch` version against {@link PATCHED}.
 */
function isPatched({ version }: { readonly version: string }): boolean {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));
    for (let i = 0; i < PATCHED.length; i++) {
        const current = parts[i] ?? 0;
        const floor = PATCHED[i] ?? 0;
        if (current !== floor) return current > floor;
    }
    return true;
}

describe('image-size on the upload path is patched (HOS-418)', () => {
    it.each([
        ['apps/api (the copy the production bundle loads)', 'apps/api'],
        ['packages/media (where validateMediaFile lives)', 'packages/media']
    ])('%s resolves image-size >= 2.0.3', (_label, packageDir) => {
        const version = resolveImageSizeVersion({ fromDir: join(REPO_ROOT, packageDir) });

        expect(isPatched({ version }), `resolved image-size@${version}`).toBe(true);
    });

    it('compares versions numerically, not lexically', () => {
        expect(isPatched({ version: '2.0.2' })).toBe(false);
        expect(isPatched({ version: '1.2.1' })).toBe(false);
        expect(isPatched({ version: '2.0.3' })).toBe(true);
        expect(isPatched({ version: '2.0.10' })).toBe(true);
        expect(isPatched({ version: '10.0.0' })).toBe(true);
    });
});
