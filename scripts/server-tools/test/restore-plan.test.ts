/**
 * Unit tests for `src/lib/restore-plan.ts` — the pure decisions `hops
 * db-restore` takes before it touches R2 or Postgres (HOS-1957 G1/G15).
 *
 * The refusals come first on purpose: a cross-target restore onto prod, or
 * a `--target-db` that names the app's own database, must die before any
 * listing, download, snapshot or CREATE DATABASE runs.
 */

import { describe, expect, it } from 'bun:test';
import type { R2Object } from '../src/lib/r2.ts';
import {
    buildCreateDatabaseSql,
    buildDatabaseExistsSql,
    parseRestoreArgs,
    resolveRestoreSource,
    selectBackup,
    validateScratchDbName
} from '../src/lib/restore-plan.ts';

function obj(key: string, iso: string): R2Object {
    return { key, size: 1024, lastModified: new Date(iso) };
}

describe('resolveRestoreSource — refusals', () => {
    it('refuses restoring a staging backup onto prod', () => {
        expect(() => resolveRestoreSource({ activeTarget: 'prod', fromTarget: 'staging' })).toThrow(
            /onto prod/
        );
    });

    it('refuses an unknown --from-target value', () => {
        expect(() =>
            resolveRestoreSource({ activeTarget: 'staging', fromTarget: 'production' })
        ).toThrow(/Invalid --from-target/);
    });

    it('refuses an empty --from-target value', () => {
        expect(() => resolveRestoreSource({ activeTarget: 'staging', fromTarget: '' })).toThrow(
            /Invalid --from-target/
        );
    });
});

describe('resolveRestoreSource — accepted', () => {
    it('keeps prod restores exactly same-target when the flag is absent', () => {
        expect(resolveRestoreSource({ activeTarget: 'prod', fromTarget: null })).toEqual({
            sourceTarget: 'prod',
            crossTarget: false
        });
    });

    it('accepts an explicit --from-target=prod on prod as a same-target restore', () => {
        expect(resolveRestoreSource({ activeTarget: 'prod', fromTarget: 'prod' })).toEqual({
            sourceTarget: 'prod',
            crossTarget: false
        });
    });

    it('reads the prod bucket for a staging restore with --from-target=prod', () => {
        expect(resolveRestoreSource({ activeTarget: 'staging', fromTarget: 'prod' })).toEqual({
            sourceTarget: 'prod',
            crossTarget: true
        });
    });

    it('treats --from-target=staging on staging as same-target', () => {
        expect(resolveRestoreSource({ activeTarget: 'staging', fromTarget: 'staging' })).toEqual({
            sourceTarget: 'staging',
            crossTarget: false
        });
    });
});

describe('validateScratchDbName — refusals', () => {
    it("refuses the target's own configured database", () => {
        expect(() =>
            validateScratchDbName({ name: 'hospeda_staging', mainDatabase: 'hospeda_staging' })
        ).toThrow(/main database/);
    });

    it('refuses the prod main database (postgres)', () => {
        expect(() => validateScratchDbName({ name: 'postgres', mainDatabase: 'postgres' })).toThrow(
            /main database/
        );
    });

    it.each(['postgres', 'template0', 'template1'])('refuses the reserved database %s', (name) => {
        expect(() => validateScratchDbName({ name, mainDatabase: 'hospeda_staging' })).toThrow(
            /reserved/
        );
    });

    it.each([
        'Scratch',
        '1scratch',
        'scratch-db',
        'scratch"; DROP DATABASE hospeda_staging; --',
        'scratch db',
        '',
        'a'.repeat(64)
    ])('refuses the malformed name %p', (name) => {
        expect(() => validateScratchDbName({ name, mainDatabase: 'hospeda_staging' })).toThrow(
            /Invalid --target-db/
        );
    });
});

describe('validateScratchDbName — accepted', () => {
    it.each([
        'hos1957_scratch',
        'postgres_restore_test',
        '_tmp',
        'a'.repeat(63)
    ])('accepts %s', (name) => {
        expect(validateScratchDbName({ name, mainDatabase: 'hospeda_staging' })).toBe(name);
    });
});

describe('SQL builders', () => {
    it('quotes the identifier in CREATE DATABASE', () => {
        expect(buildCreateDatabaseSql({ name: 'hos1957_scratch' })).toBe(
            'CREATE DATABASE "hos1957_scratch"'
        );
    });

    it('builds the existence probe against pg_database', () => {
        expect(buildDatabaseExistsSql({ name: 'hos1957_scratch' })).toBe(
            "SELECT 1 FROM pg_database WHERE datname = 'hos1957_scratch'"
        );
    });

    it('refuses to build SQL for a name that fails the regex', () => {
        expect(() => buildCreateDatabaseSql({ name: 'x"; DROP DATABASE postgres; --' })).toThrow(
            /Invalid --target-db/
        );
        expect(() => buildDatabaseExistsSql({ name: "x' OR '1'='1" })).toThrow(
            /Invalid --target-db/
        );
    });
});

describe('parseRestoreArgs', () => {
    it('parses the defaults', () => {
        expect(parseRestoreArgs([])).toEqual({
            indexHint: null,
            objectKey: null,
            targetDb: null,
            fromTarget: null,
            skipSnapshot: false,
            skipConfirm: false
        });
    });

    it('accepts --from-target in both spellings', () => {
        expect(parseRestoreArgs(['--from-target=prod']).fromTarget).toBe('prod');
        expect(parseRestoreArgs(['--from-target', 'prod']).fromTarget).toBe('prod');
    });

    it('accepts --object in both spellings', () => {
        const key = 'manual/hospeda-postgres-2026-10-29_120000Z.dump.gpg';
        expect(parseRestoreArgs([`--object=${key}`]).objectKey).toBe(key);
        expect(parseRestoreArgs(['--object', key]).objectKey).toBe(key);
    });

    it('does not read a numeric value of a flag as the index', () => {
        expect(parseRestoreArgs(['--target-db', 'scratch1']).indexHint).toBeNull();
        expect(parseRestoreArgs(['3', '--yes']).indexHint).toBe(3);
    });

    it('refuses N together with --object', () => {
        expect(() => parseRestoreArgs(['2', '--object', 'manual/x.dump'])).toThrow(
            /either N or --object/
        );
    });

    it('refuses a value flag with no value', () => {
        expect(() => parseRestoreArgs(['--object'])).toThrow(/--object requires/);
        expect(() => parseRestoreArgs(['--target-db'])).toThrow(/--target-db requires/);
        expect(() => parseRestoreArgs(['--from-target'])).toThrow(/--from-target requires/);
        expect(() => parseRestoreArgs(['--object', '--yes'])).toThrow(/--object requires/);
    });
});

describe('selectBackup', () => {
    const backups = [
        obj('manual/hospeda-postgres-2026-10-29_120000Z.dump.gpg', '2026-10-29T12:00:00Z'),
        obj('hospeda-postgres-2026-10-29_030000Z.dump.gpg', '2026-10-29T03:00:00Z')
    ];

    it('selects by exact object name', () => {
        expect(
            selectBackup({ backups, objectKey: 'hospeda-postgres-2026-10-29_030000Z.dump.gpg' })
        ).toBe(backups[1]);
    });

    it('refuses a name that is not in the listing, naming the bucket listing size', () => {
        expect(() =>
            selectBackup({ backups, objectKey: 'hospeda-postgres-2026-10-29_030000Z.dump' })
        ).toThrow(/not found among the 2 backup/);
    });

    it('never matches a prefix or substring', () => {
        expect(() => selectBackup({ backups, objectKey: 'manual/' })).toThrow(/not found/);
    });

    it('returns null when no selector was given (interactive picker)', () => {
        expect(selectBackup({ backups, objectKey: null })).toBeNull();
    });
});
