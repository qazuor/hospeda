import { describe, expect, it } from 'vitest';
import { RUN_LEASE_TTL_MS } from '../src/utils/run-lease.ts';

describe('run lease defaults', () => {
    it('uses a five-minute lease by default', () => {
        expect(RUN_LEASE_TTL_MS).toBe(5 * 60_000);
    });
});
