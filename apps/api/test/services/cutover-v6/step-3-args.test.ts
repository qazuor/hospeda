import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStep3Args } from '../../../src/services/cutover-v6/step-3.args.js';
import { STEP3_EXIT_CODE } from '../../../src/services/cutover-v6/step-3.service.js';

describe('TEST:1776:1 AC:1776:1 strict step 3 arguments and exit codes', () => {
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
    it('accepts owner ids and preserves the legacy value when omitted', () => {
        const ownerIds = [
            '550e8400-e29b-41d4-a716-446655440000',
            '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
        ];
        expect(parseStep3Args({ argv: ['--dry-run'] })).toEqual({
            ok: true,
            value: { dryRun: true }
        });
        expect(
            parseStep3Args({ argv: [`--owner-ids=${ownerIds.join(',')}`, '--dry-run'] })
        ).toEqual({
            ok: true,
            value: { dryRun: true, ownerIds }
        });
    });
    it('rejects empty, invalid, duplicate and repeated owner id values', () => {
        for (const argv of [
            ['--dry-run', '--owner-ids='],
            ['--dry-run', '--owner-ids=not-a-uuid'],
            [
                '--dry-run',
                '--owner-ids=550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440000'
            ],
            [
                '--dry-run',
                '--owner-ids=550e8400-e29b-41d4-a716-446655440000,550E8400-E29B-41D4-A716-446655440000'
            ],
            [
                '--dry-run',
                '--owner-ids=550e8400-e29b-41d4-a716-446655440000',
                '--owner-ids=6ba7b810-9dad-41d1-80b4-00c04fd430c8'
            ]
        ]) {
            expect(parseStep3Args({ argv }).ok).toBe(false);
        }
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

describe('TEST:1776:2 AC:1776:1 script wiring', () => {
    it('passes parsed owner ids to runStep3 only when supplied', () => {
        const source = readFileSync(
            new URL('../../../scripts/cutover-v6-step-3.ts', import.meta.url),
            'utf8'
        );
        expect(source).toContain(
            '...(parsed.value.ownerIds === undefined ? {} : { ownerIds: parsed.value.ownerIds })'
        );
        expect(source).toContain('dryRun: parsed.value.dryRun');
    });
});

describe('TEST:1776:4 AC:1776:3 production target guard', () => {
    it('refuses owner ids before any container or database lookup', () => {
        const source = readFileSync(
            new URL(
                '../../../../../scripts/server-tools/src/commands/cutover-step-3.ts',
                import.meta.url
            ),
            'utf8'
        );
        const guard = source.indexOf(
            'ownerIdsTargetRefusal({ target, ownerIds: options.ownerIds })'
        );
        expect(guard).toBeGreaterThan(-1);
        for (const effect of [
            'resolveRepoRoot()',
            "findContainer('api')",
            'resolveApiEnv({',
            'buildPostgresUrl({'
        ]) {
            expect(guard).toBeLessThan(source.indexOf(effect));
        }
        expect(source).toContain('die(targetRefusal, 2)');
    });
});
