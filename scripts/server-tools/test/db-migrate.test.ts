/**
 * Unit tests for `src/commands/db-migrate.ts` arg parsing.
 *
 * Covers the pure `parseMigrateArgs` helper. Docker, pg_dump, the migrate
 * sequence, and the actual `pnpm install` step involve live processes and are
 * not unit-tested here.
 */

import { describe, expect, it } from 'bun:test';
import { parseMigrateArgs } from '../src/commands/db-migrate.ts';

describe('parseMigrateArgs', () => {
    it('defaults every optional step to ON with no flags', () => {
        const parsed = parseMigrateArgs([]);
        expect(parsed.install).toBe(true);
        expect(parsed.build).toBe(true);
        expect(parsed.backup).toBe(true);
        expect(parsed.applyExtras).toBe(true);
        expect(parsed.reset).toBe(false);
        expect(parsed.pull).toBe('ask');
        expect(parsed.skipConfirm).toBe(false);
    });

    // BETA-102: a pulled commit can add a dependency, so `pnpm install` runs
    // after the pull by default; `--no-install` must opt out of just that step.
    it('sets install=false only when --no-install is passed', () => {
        expect(parseMigrateArgs(['--no-install']).install).toBe(false);
    });

    it('leaves install ON when --no-install is absent, even with other flags', () => {
        const parsed = parseMigrateArgs(['--no-build', '--no-backup', '--no-pull']);
        expect(parsed.install).toBe(true);
    });

    it('does not couple --no-install to the other step flags', () => {
        const parsed = parseMigrateArgs(['--no-install']);
        expect(parsed.build).toBe(true);
        expect(parsed.backup).toBe(true);
        expect(parsed.applyExtras).toBe(true);
    });

    it('parses pull intent independently of --no-install', () => {
        expect(parseMigrateArgs(['--pull', '--no-install']).pull).toBe('on');
        expect(parseMigrateArgs(['--no-pull', '--no-install']).pull).toBe('off');
    });
});
