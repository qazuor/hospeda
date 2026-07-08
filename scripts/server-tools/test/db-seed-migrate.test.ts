/**
 * Unit tests for `src/commands/db-seed-migrate.ts` arg parsing.
 *
 * Covers the pure `parseSeedMigrateArgs` helper. Docker, the DB URL resolution,
 * and the actual `pnpm db:seed:migrate` run involve live processes and are not
 * unit-tested here.
 */

import { describe, expect, it } from 'bun:test';
import { parseSeedMigrateArgs } from '../src/commands/db-seed-migrate.ts';

describe('parseSeedMigrateArgs', () => {
    it('defaults to the apply path with install ON and no flags', () => {
        const parsed = parseSeedMigrateArgs([]);
        expect(parsed.status).toBe(false);
        expect(parsed.install).toBe(true);
        expect(parsed.pull).toBe('ask');
        expect(parsed.skipConfirm).toBe(false);
    });

    it('enters read-only status mode with --status', () => {
        expect(parseSeedMigrateArgs(['--status']).status).toBe(true);
    });

    it('sets install=false only when --no-install is passed', () => {
        expect(parseSeedMigrateArgs(['--no-install']).install).toBe(false);
        expect(parseSeedMigrateArgs(['--status']).install).toBe(true);
    });

    it('parses pull intent (on/off/ask) independently of other flags', () => {
        expect(parseSeedMigrateArgs(['--pull', '--no-install']).pull).toBe('on');
        expect(parseSeedMigrateArgs(['--no-pull', '--yes']).pull).toBe('off');
        expect(parseSeedMigrateArgs([]).pull).toBe('ask');
    });

    it('sets skipConfirm only when --yes is passed', () => {
        expect(parseSeedMigrateArgs(['--yes']).skipConfirm).toBe(true);
        expect(parseSeedMigrateArgs([]).skipConfirm).toBe(false);
    });
});
