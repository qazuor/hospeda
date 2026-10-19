import { describe, expect, it } from 'vitest';
import { parseStep3Args } from '../../../src/services/cutover-v6/step-3.args.js';
import { STEP3_EXIT_CODE } from '../../../src/services/cutover-v6/step-3.service.js';

describe('TEST:1695:1 AC:1695:2 strict step 3 arguments and exit codes', () => {
    it('accepts dry-run mode', () => {
        expect(parseStep3Args({ argv: ['--dry-run'] })).toEqual({
            ok: true,
            value: { dryRun: true }
        });
    });
    it('accepts explicit write confirmation', () => {
        expect(parseStep3Args({ argv: ['--confirm-write-trials'] })).toEqual({
            ok: true,
            value: { dryRun: false }
        });
    });
    it('requires exactly one mode', () => {
        const empty = parseStep3Args({ argv: [] });
        expect(empty.ok).toBe(false);
        if (!empty.ok) expect(empty.reason).toContain('Refusing');
        const both = parseStep3Args({ argv: ['--dry-run', '--confirm-write-trials'] });
        expect(both.ok).toBe(false);
        if (!both.ok) expect(both.reason).toContain('Refusing');
    });
    it('names unknown and malformed flags', () => {
        const unknown = parseStep3Args({ argv: ['--dry-run', '--bogus'] });
        expect(unknown.ok).toBe(false);
        if (!unknown.ok) expect(unknown.reason).toContain('--bogus');
        const malformed = parseStep3Args({ argv: ['--confirm-write-trials=yes'] });
        expect(malformed.ok).toBe(false);
        if (!malformed.ok) expect(malformed.reason).toContain('Malformed');
    });
    it('rejects repeated flags and the step 3b confirmation flag', () => {
        const repeated = parseStep3Args({ argv: ['--dry-run', '--dry-run'] });
        expect(repeated.ok).toBe(false);
        if (!repeated.ok) expect(repeated.reason).toContain('Repeated');
        expect(parseStep3Args({ argv: ['--confirm'] })).toEqual({
            ok: false,
            reason: 'Unknown flag: --confirm'
        });
    });
    it('exposes the required exit code table', () => {
        expect(STEP3_EXIT_CODE).toEqual({
            dry_run: 0,
            completed: 0,
            already_done: 0,
            nothing_planned: 1
        });
    });
});
