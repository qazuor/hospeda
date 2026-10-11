import { describe, expect, it } from 'vitest';
import {
    meta,
    up
} from '../../src/data-migrations/0119-hos1481-partner-fixtures-without-tier-and-dates.js';

describe('HOS-1481 fixture dual-write', () => {
    it('reports zero rewritten partners without touching the database', async () => {
        const ctx = {} as Parameters<typeof up>[0];
        const result = await up(ctx);
        expect(meta).toMatchObject({ group: 'required', destructive: false });
        expect(result.counts).toEqual({ partnersRewritten: 0 });
        expect(result.summary).toContain('No partner rows');
    });
});
