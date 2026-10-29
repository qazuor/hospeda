/**
 * Unit tests for the verifier command line (HOS-1957).
 */
import { describe, expect, it } from 'vitest';
import { parseVerifyArgs } from '../../../src/services/cutover-v6/verify.args.js';

describe('parseVerifyArgs', () => {
    it('accepts one check, or both', () => {
        expect(parseVerifyArgs({ argv: ['--journal'] })).toEqual({ ok: true, checks: ['journal'] });
        expect(parseVerifyArgs({ argv: ['--catalog', '--journal'] })).toEqual({
            ok: true,
            checks: ['catalog', 'journal']
        });
    });

    it('refuses to run with no check', () => {
        const result = parseVerifyArgs({ argv: [] });
        expect(result.ok).toBe(false);
    });

    it('refuses unknown and repeated flags', () => {
        expect(parseVerifyArgs({ argv: ['--journal=1'] }).ok).toBe(false);
        expect(parseVerifyArgs({ argv: ['--catalog', '--catalog'] }).ok).toBe(false);
    });
});
