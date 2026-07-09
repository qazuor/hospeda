/**
 * Unit tests for `src/commands/logs-clear.ts`.
 *
 * Covers the pure argv parser only: help/kind/flag validation. The
 * side-effecting parts (findContainer, docker inspect, the confirm
 * prompt, and the sudo truncate) are not covered here.
 */

import { describe, expect, it } from 'bun:test';
import { parseLogsClearArgs } from '../src/commands/logs-clear.ts';

describe('parseLogsClearArgs(argv)', () => {
    describe('help', () => {
        it('shows help when no args are given', () => {
            expect(parseLogsClearArgs([]).showHelp).toBe(true);
        });

        it('shows help for --help', () => {
            expect(parseLogsClearArgs(['--help']).showHelp).toBe(true);
        });

        it('shows help for -h', () => {
            expect(parseLogsClearArgs(['-h']).showHelp).toBe(true);
        });
    });

    describe('valid kinds', () => {
        it.each(['api', 'web', 'admin'] as const)('accepts kind %s', (kind) => {
            const parsed = parseLogsClearArgs([kind]);
            expect(parsed.kind).toBe(kind);
            expect(parsed.error).toBeUndefined();
            expect(parsed.showHelp).toBe(false);
            expect(parsed.skipConfirm).toBe(false);
        });
    });

    describe('--yes', () => {
        it('sets skipConfirm', () => {
            const parsed = parseLogsClearArgs(['api', '--yes']);
            expect(parsed.kind).toBe('api');
            expect(parsed.skipConfirm).toBe(true);
            expect(parsed.error).toBeUndefined();
        });
    });

    describe('invalid input', () => {
        it('errors on an unknown kind', () => {
            const parsed = parseLogsClearArgs(['postgres']);
            expect(parsed.kind).toBeUndefined();
            expect(parsed.error).toContain('Unknown kind');
        });

        it('errors on a bogus kind', () => {
            const parsed = parseLogsClearArgs(['bogus']);
            expect(parsed.error).toContain('Unknown kind');
        });

        it('errors on an unknown flag', () => {
            const parsed = parseLogsClearArgs(['api', '--force']);
            expect(parsed.error).toContain('Unknown argument');
        });
    });
});
