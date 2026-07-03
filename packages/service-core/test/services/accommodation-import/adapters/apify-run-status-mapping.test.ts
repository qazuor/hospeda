/**
 * Unit tests for the Apify run-status -> ImportFailureCode mapping
 * (HOS-50 / SPEC-277 R3).
 *
 * Covers all 6 `ApifyRunStatus` values, one case each, asserting the exact
 * mapping. Apify has no native "blocked" run status, so this mapping never
 * returns `source_blocked` — only the start-time HTTP-429 path (handled
 * elsewhere) can produce that code.
 */

import { describe, expect, it } from 'vitest';

import type { ApifyRunStatus } from '../../../../src/services/accommodation-import/adapters/apify-client.js';
import { mapApifyRunStatusToFailureCode } from '../../../../src/services/accommodation-import/adapters/apify-run-status-mapping.js';

describe('mapApifyRunStatusToFailureCode', () => {
    it('maps READY to null (not a terminal state)', () => {
        expect(mapApifyRunStatusToFailureCode('READY')).toBeNull();
    });

    it('maps RUNNING to null (not a terminal state)', () => {
        expect(mapApifyRunStatusToFailureCode('RUNNING')).toBeNull();
    });

    it('maps SUCCEEDED to null (a success, not a failure)', () => {
        expect(mapApifyRunStatusToFailureCode('SUCCEEDED')).toBeNull();
    });

    it('maps TIMED-OUT to the timeout failure code', () => {
        expect(mapApifyRunStatusToFailureCode('TIMED-OUT')).toBe('timeout');
    });

    it('maps FAILED to the provider_error failure code', () => {
        expect(mapApifyRunStatusToFailureCode('FAILED')).toBe('provider_error');
    });

    it('maps ABORTED to the provider_error failure code', () => {
        expect(mapApifyRunStatusToFailureCode('ABORTED')).toBe('provider_error');
    });

    it('never returns source_blocked for any status (no native blocked signal)', () => {
        const statuses: ApifyRunStatus[] = [
            'READY',
            'RUNNING',
            'SUCCEEDED',
            'FAILED',
            'TIMED-OUT',
            'ABORTED'
        ];
        for (const status of statuses) {
            expect(mapApifyRunStatusToFailureCode(status)).not.toBe('source_blocked');
        }
    });
});
