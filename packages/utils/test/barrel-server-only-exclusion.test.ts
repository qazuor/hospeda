import { describe, expect, it } from 'vitest';
import * as barrel from '../src/index';

/**
 * Regression guard for the admin-app `ReferenceError: process is not defined`.
 *
 * The `safe-fetch` / `safe-fetch-ip` modules are server-only (they import
 * `undici`, which evaluates `process.versions.node` at module top-level). When
 * they were re-exported from the package barrel, importing ANY symbol from
 * `@repo/utils` in a client bundle (e.g. `formatMicroUsd`) pulled undici into
 * the browser and crashed the admin app on load.
 *
 * These symbols must stay OUT of the barrel and be imported via the dedicated
 * `@repo/utils/safe-fetch` subpath instead. This test fails if any of them is
 * re-added to `src/index.ts`.
 */
describe('@repo/utils barrel server-only exclusion', () => {
    it('does not re-export server-only safe-fetch symbols', () => {
        expect((barrel as Record<string, unknown>).safeExternalFetch).toBeUndefined();
        expect((barrel as Record<string, unknown>).safeExternalFetchBuffer).toBeUndefined();
        expect((barrel as Record<string, unknown>).isBlockedAddress).toBeUndefined();
    });

    it('still exports browser-safe utilities (barrel not broken)', () => {
        expect(typeof (barrel as Record<string, unknown>).formatMicroUsd).toBe('function');
    });
});
