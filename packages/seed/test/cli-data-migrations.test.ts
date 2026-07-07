import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    deriveMigrationGroup,
    handleDataMigrate,
    handleMake,
    handleMigrateStatus,
    parseGroupFlag,
    parsePositionalAfterFlag
} from '../src/cli.js';

/**
 * HOS-25 T-017 regression tests for the versioned seed data-migration CLI
 * surface wired into `packages/seed/src/cli.ts`:
 *
 * - `--data-migrate` / `--data-migrate --baseline-stamp` (`db:seed:migrate`)
 * - `--data-migrate-status` (`db:seed:migrate:status`)
 * - `--data-migrate-make <slug>` (`db:seed:make`)
 *
 * All underlying data-migration modules (`runner.js`, `baselineStamp.js`,
 * `status.js`, `make.js`) and the seed logger are mocked, so these tests
 * never touch a real database or the filesystem.
 */

const runMigrationsMock = vi.fn();
const baselineStampMock = vi.fn();
const getMigrationStatusMock = vi.fn();
const formatMigrationStatusMock = vi.fn();
const makeMigrationMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerSuccessMock = vi.fn();

vi.mock('../src/data-migrations/runner.js', () => ({
    runMigrations: runMigrationsMock
}));

vi.mock('../src/data-migrations/baselineStamp.js', () => ({
    baselineStamp: baselineStampMock
}));

vi.mock('../src/data-migrations/status.js', () => ({
    getMigrationStatus: getMigrationStatusMock,
    formatMigrationStatus: formatMigrationStatusMock
}));

vi.mock('../src/data-migrations/make.js', () => ({
    makeMigration: makeMigrationMock
}));

vi.mock('../src/utils/logger.js', () => ({
    logger: {
        error: loggerErrorMock,
        success: loggerSuccessMock,
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

/**
 * `process.exit` throws a sentinel error instead of actually killing the
 * test process, so control flow really does stop at the call site (matching
 * its real `never` return type) and the handler's returned promise rejects
 * predictably.
 */
class ProcessExitError extends Error {
    constructor(public readonly code: number | undefined) {
        super(`process.exit(${code})`);
    }
}

describe('HOS-25 T-017: data-migration CLI flag parsing', () => {
    describe('deriveMigrationGroup', () => {
        it('returns "required" when only --required is set', () => {
            expect(deriveMigrationGroup({ required: true, example: false })).toBe('required');
        });

        it('returns "example" when only --example is set', () => {
            expect(deriveMigrationGroup({ required: false, example: true })).toBe('example');
        });

        it('returns undefined when neither flag is set', () => {
            expect(deriveMigrationGroup({ required: false, example: false })).toBeUndefined();
        });

        it('returns undefined when both flags are set', () => {
            expect(deriveMigrationGroup({ required: true, example: true })).toBeUndefined();
        });
    });

    describe('parseGroupFlag', () => {
        it('returns undefined when --group= is absent', () => {
            expect(parseGroupFlag(['--data-migrate-make', 'my-slug'])).toBeUndefined();
        });

        it('parses --group=required', () => {
            expect(parseGroupFlag(['--group=required'])).toBe('required');
        });

        it('parses --group=example', () => {
            expect(parseGroupFlag(['--group=example'])).toBe('example');
        });

        it('throws on an invalid --group value', () => {
            expect(() => parseGroupFlag(['--group=bogus'])).toThrow(/Invalid --group value/);
        });
    });

    describe('parsePositionalAfterFlag', () => {
        it('returns the value immediately following the flag', () => {
            expect(
                parsePositionalAfterFlag(
                    ['--data-migrate-make', 'my-slug', '--group=example'],
                    '--data-migrate-make'
                )
            ).toBe('my-slug');
        });

        it('returns undefined when the flag is absent', () => {
            expect(
                parsePositionalAfterFlag(['--group=example'], '--data-migrate-make')
            ).toBeUndefined();
        });

        it('returns undefined when the flag is the last argument', () => {
            expect(
                parsePositionalAfterFlag(['--data-migrate-make'], '--data-migrate-make')
            ).toBeUndefined();
        });

        it('returns undefined when the flag is immediately followed by another flag', () => {
            expect(
                parsePositionalAfterFlag(
                    ['--data-migrate-make', '--destructive'],
                    '--data-migrate-make'
                )
            ).toBeUndefined();
        });
    });
});

describe('HOS-25 T-017: handleDataMigrate', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        runMigrationsMock.mockReset();
        baselineStampMock.mockReset();
        loggerErrorMock.mockReset();
        loggerSuccessMock.mockReset();
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
            throw new ProcessExitError(code);
        });
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it('calls runMigrations with the mapped group/allowDestructive/env when --baseline-stamp is absent', async () => {
        runMigrationsMock.mockResolvedValue({
            applied: ['0001-foo'],
            skipped: [],
            pendingCount: 1
        });

        await handleDataMigrate({
            group: 'required',
            allowDestructive: true,
            baselineStamp: false
        });

        expect(runMigrationsMock).toHaveBeenCalledWith({
            group: 'required',
            allowDestructive: true,
            env: process.env
        });
        expect(baselineStampMock).not.toHaveBeenCalled();
        expect(loggerSuccessMock).toHaveBeenCalledWith({
            msg: 'Applied 1 data-migration(s) (0 already up to date).'
        });
    });

    it('omits group when neither --required nor --example scoped it', async () => {
        runMigrationsMock.mockResolvedValue({ applied: [], skipped: [], pendingCount: 0 });

        await handleDataMigrate({
            group: undefined,
            allowDestructive: false,
            baselineStamp: false
        });

        expect(runMigrationsMock).toHaveBeenCalledWith({
            group: undefined,
            allowDestructive: false,
            env: process.env
        });
    });

    it('calls baselineStamp instead of runMigrations when --baseline-stamp is set', async () => {
        baselineStampMock.mockResolvedValue({ stamped: ['0001-foo', '0002-bar'] });

        await handleDataMigrate({ group: 'example', allowDestructive: false, baselineStamp: true });

        expect(baselineStampMock).toHaveBeenCalledWith({ group: 'example' });
        expect(runMigrationsMock).not.toHaveBeenCalled();
        expect(loggerSuccessMock).toHaveBeenCalledWith({
            msg: 'Baseline-stamped 2 data-migration(s).'
        });
    });

    it('logs the error message and exits(1) when runMigrations throws', async () => {
        runMigrationsMock.mockRejectedValue(new Error('gate refused'));

        await expect(
            handleDataMigrate({ group: undefined, allowDestructive: false, baselineStamp: false })
        ).rejects.toThrow(ProcessExitError);

        expect(loggerErrorMock).toHaveBeenCalledWith('gate refused');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('logs the error message and exits(1) when baselineStamp throws', async () => {
        baselineStampMock.mockRejectedValue(new Error('stamp failed'));

        await expect(
            handleDataMigrate({ group: undefined, allowDestructive: false, baselineStamp: true })
        ).rejects.toThrow(ProcessExitError);

        expect(loggerErrorMock).toHaveBeenCalledWith('stamp failed');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});

describe('HOS-25 T-017: handleMigrateStatus', () => {
    beforeEach(() => {
        getMigrationStatusMock.mockReset();
        formatMigrationStatusMock.mockReset();
    });

    it('fetches status scoped to the given group and console.logs the formatted report', async () => {
        const status = { applied: [], pending: [], appliedCount: 0, pendingCount: 0 };
        getMigrationStatusMock.mockResolvedValue(status);
        formatMigrationStatusMock.mockReturnValue('0 applied, 0 pending');
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await handleMigrateStatus({ group: 'required' });

        expect(getMigrationStatusMock).toHaveBeenCalledWith({ group: 'required' });
        expect(formatMigrationStatusMock).toHaveBeenCalledWith(status);
        expect(logSpy).toHaveBeenCalledWith('0 applied, 0 pending');

        logSpy.mockRestore();
    });
});

describe('HOS-25 T-017: handleMake', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        makeMigrationMock.mockReset();
        loggerErrorMock.mockReset();
        loggerSuccessMock.mockReset();
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
            throw new ProcessExitError(code);
        });
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it('maps the positional slug + group + destructive flags to makeMigration', async () => {
        makeMigrationMock.mockResolvedValue({
            filePath: '/repo/packages/seed/src/data-migrations/0004-remove-legacy-feature.ts',
            name: '0004-remove-legacy-feature'
        });

        await handleMake({ slug: 'remove-legacy-feature', group: 'example', destructive: true });

        expect(makeMigrationMock).toHaveBeenCalledWith({
            slug: 'remove-legacy-feature',
            group: 'example',
            destructive: true
        });
        expect(loggerSuccessMock).toHaveBeenCalledWith({
            msg: 'Created data-migration: /repo/packages/seed/src/data-migrations/0004-remove-legacy-feature.ts'
        });
    });

    it('logs usage and exits(1) without calling makeMigration when slug is missing', async () => {
        await expect(
            handleMake({ slug: undefined, group: undefined, destructive: false })
        ).rejects.toThrow(ProcessExitError);

        expect(makeMigrationMock).not.toHaveBeenCalled();
        expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringMatching(/kebab-case/));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('logs the error message and exits(1) when makeMigration throws', async () => {
        makeMigrationMock.mockRejectedValue(new Error('Invalid slug'));

        await expect(
            handleMake({ slug: 'Bad Slug', group: undefined, destructive: false })
        ).rejects.toThrow(ProcessExitError);

        expect(loggerErrorMock).toHaveBeenCalledWith('Invalid slug');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
