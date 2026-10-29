/**
 * Unit tests for `src/commands/r2-purge-foreign-backups.ts` and for the
 * wiring of the HOS-1957 flags into the command registry.
 *
 * The R2 calls are not exercised here (they need a bucket); the refusals
 * that decide whether a delete may happen at all are pure and come first.
 */

import { describe, expect, it } from 'bun:test';
import {
    isPurgeConfirmationValid,
    purgeTargetRefusal,
    sameBucketRefusal
} from '../src/commands/r2-purge-foreign-backups.ts';

const SRC = `${import.meta.dir}/../src`;

describe('purgeTargetRefusal', () => {
    it('refuses prod', () => {
        expect(purgeTargetRefusal('prod')).toMatch(/refused on --target=prod/);
    });

    it('allows staging', () => {
        expect(purgeTargetRefusal('staging')).toBeUndefined();
    });
});

describe('sameBucketRefusal', () => {
    it('refuses when the staging config points at the prod bucket', () => {
        expect(
            sameBucketRefusal({
                activeAccountId: 'acc',
                activeBucket: 'hospeda-backups',
                prodAccountId: 'acc',
                prodBucket: 'hospeda-backups'
            })
        ).toMatch(/same bucket as prod/);
    });

    it('allows a same-named bucket in another account', () => {
        expect(
            sameBucketRefusal({
                activeAccountId: 'staging-acc',
                activeBucket: 'hospeda-backups',
                prodAccountId: 'prod-acc',
                prodBucket: 'hospeda-backups'
            })
        ).toBeUndefined();
    });

    it('allows when prod is not configured on this host', () => {
        expect(
            sameBucketRefusal({
                activeAccountId: 'acc',
                activeBucket: 'hospeda-staging-backups',
                prodAccountId: undefined,
                prodBucket: undefined
            })
        ).toBeUndefined();
    });
});

describe('isPurgeConfirmationValid', () => {
    it('requires the exact bucket name', () => {
        expect(
            isPurgeConfirmationValid({ typed: 'hospeda-staging', bucket: 'hospeda-staging' })
        ).toBe(true);
        expect(isPurgeConfirmationValid({ typed: 'yes', bucket: 'hospeda-staging' })).toBe(false);
        expect(
            isPurgeConfirmationValid({ typed: 'HOSPEDA-STAGING', bucket: 'hospeda-staging' })
        ).toBe(false);
        expect(isPurgeConfirmationValid({ typed: '', bucket: 'hospeda-staging' })).toBe(false);
    });
});

describe('the --delete path', () => {
    it('checks the open window and the typed confirmation before the first delete', async () => {
        const source = await Bun.file(`${SRC}/commands/r2-purge-foreign-backups.ts`).text();
        const body = source.slice(source.indexOf('export async function r2PurgeForeignBackups'));
        const firstDelete = body.indexOf('r2.delete(');
        expect(firstDelete).toBeGreaterThan(-1);
        expect(body.indexOf('purgeTargetRefusal(target)')).toBeLessThan(firstDelete);
        expect(body.indexOf('hasOpenWindow(result.windows)')).toBeLessThan(firstDelete);
        expect(body.indexOf('isPurgeConfirmationValid(')).toBeLessThan(firstDelete);
        expect(body.indexOf('if (!doDelete)')).toBeLessThan(firstDelete);
    });

    it('offers no --yes bypass for the typed confirmation', async () => {
        const source = await Bun.file(`${SRC}/commands/r2-purge-foreign-backups.ts`).text();
        expect(source).not.toContain("'--yes'");
    });
});

describe('registry wiring (src/index.ts)', () => {
    async function entry(name: string, runName: string): Promise<string> {
        const source = await Bun.file(`${SRC}/index.ts`).text();
        const start = source.indexOf(`name: '${name}',`);
        expect(start).toBeGreaterThan(-1);
        return source.slice(start, source.indexOf(`run: ${runName}`, start));
    }

    it('registers r2-purge-foreign-backups as explicit-required with --delete', async () => {
        const block = await entry('r2-purge-foreign-backups', 'r2PurgeForeignBackups');
        expect(block).toContain("targetPolicy: 'explicit-required'");
        expect(block).toContain("'--delete'");
    });

    it('declares every value flag db-restore parses', async () => {
        const block = await entry('db-restore', 'dbRestore');
        for (const flag of ['--target-db', '--object', '--from-target']) {
            expect(block).toContain(`name: '${flag}', syntax: 'both'`);
        }
        expect(block).toContain("targetPolicy: 'explicit-required'");
    });

    it('db-restore resolves every refusal before it looks up a container', async () => {
        const source = await Bun.file(`${SRC}/commands/db-restore.ts`).text();
        const body = source.slice(source.indexOf('export async function dbRestore'));
        const plan = body.indexOf('planOrDie(argv)');
        expect(plan).toBeGreaterThan(-1);
        expect(plan).toBeLessThan(body.indexOf("findContainer('postgres')"));
        expect(plan).toBeLessThan(body.indexOf('createR2Client('));
    });
});
