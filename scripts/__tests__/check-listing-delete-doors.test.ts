/** AC:V6:25 (HOS-1477) — the guard keeps every listing delete or restore door outside PB12 and action 23 out. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DOORS_INVENTORY_PATH, run } from '../check-listing-delete-doors';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_INVENTORY = readFileSync(path.join(REPO_ROOT, DOORS_INVENTORY_PATH), 'utf8');
const KEPT_FILES: readonly string[] = (
    JSON.parse(REAL_INVENTORY) as { readonly kept: readonly { readonly file: string }[] }
).kept.map((row) => row.file);
const KEPT_SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
    KEPT_FILES.map((file) => [file, readFileSync(path.join(REPO_ROOT, file), 'utf8')])
);
const ACC_PURGE = 'apps/api/src/routes/accommodation/protected/purge.ts';
const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(
    files: Readonly<Record<string, string>>,
    options: { readonly inventory?: string; readonly omit?: readonly string[] } = {}
): string {
    const root = mkdtempSync(path.join(tmpdir(), 'v6-25-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    const all: Record<string, string> = {
        [DOORS_INVENTORY_PATH]: options.inventory ?? REAL_INVENTORY,
        ...KEPT_SOURCES,
        ...files
    };
    for (const file of options.omit ?? []) delete all[file];
    for (const [file, source] of Object.entries(all)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}

function check(
    files: Readonly<Record<string, string>>,
    options: { readonly inventory?: string; readonly omit?: readonly string[] } = {}
) {
    return run({ root: makeTree(files, options), minScannedFiles: 1 });
}

function route(method: string, routePath: string): string {
    return (
        "import { createProtectedRoute } from '../../../utils/route-factory';\n" +
        'export const r = createProtectedRoute({\n' +
        `    method: '${method}',\n` +
        `    path: ${routePath},\n` +
        '    handler: async () => ({})\n' +
        '});\n'
    );
}

describe('AC:V6:25 listing delete doors guard', () => {
    describe('TEST:1814:4 AC:1:16 follows VenueModel and drops its retired name', () => {
        it('TEST:1814:4 AC:1:16 detects VenueModel and ignores GastronomyModel', () => {
            const venueClass = check({
                'packages/db/src/models/venue/venue.model.ts':
                    'new VenueModel({ logger }).hardDelete(actor, id);\n'
            });
            expect(venueClass.exitCode).toBe(1);
            expect(venueClass.output).toContain('new VenueModel({ logger }).hardDelete(...)');

            const venueReceiver = check({
                'packages/db/src/models/venue/venue.model.ts': 'venueModel.softDelete(actor, id);\n'
            });
            expect(venueReceiver.exitCode).toBe(1);
            expect(venueReceiver.output).toContain('venueModel.softDelete(...)');

            const oldClass = ['Gastro', 'nomy', 'Model'].join('');
            const oldModel = check({
                'packages/db/src/models/venue/venue.model.ts': `new ${oldClass}({ logger }).hardDelete(actor, id);\n`
            });
            expect(oldModel.exitCode).toBe(0);
        });
    });

    describe('TEST:1814:4 AC:1:16 follows VenueService and drops its retired name', () => {
        it('TEST:1814:4 AC:1:16 detects VenueService and ignores GastronomyService', () => {
            const file = 'packages/service-core/src/services/venue/venue.service.ts';
            const venueClass = check({
                [file]: 'new VenueService({ logger }).hardDelete(actor, id);\n'
            });
            expect(venueClass.exitCode).toBe(1);
            expect(venueClass.output).toContain('new VenueService({ logger }).hardDelete(...)');

            const venueReceiver = check({ [file]: 'venueService.softDelete(actor, id);\n' });
            expect(venueReceiver.exitCode).toBe(1);
            expect(venueReceiver.output).toContain('venueService.softDelete(...)');

            const oldClass = ['Gastro', 'nomy', 'Service'].join('');
            const oldService = check({
                [file]: `new ${oldClass}({ logger }).hardDelete(actor, id);\n`
            });
            expect(oldService.exitCode).toBe(0);

            const oldReceiver = [['gastro', 'nomy'].join(''), 'service'].join('');
            const legacyReceiver = check({ [file]: `${oldReceiver}.softDelete(actor, id);\n` });
            expect(legacyReceiver.exitCode).toBe(0);
        });
    });

    it('accepts the repository tree', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/^OK AC:V6:25: \d+ route files scanned, /);
        expect(result.output).toContain(
            '13 retired doors absent, 6 kept doors (PB12 x3, ACC:23 x3)'
        );
    });

    it('(p1) rejects a retired door file that exists again', () => {
        const file = 'apps/api/src/routes/venue/admin/restore.ts';
        const result = check({ [file]: 'export const x = 1;\n' });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL AC:V6:25 (p1): ${file}:1 retired door`);
    });

    it('(p2) rejects a delete of the listing itself, double quoted, in experience/protected', () => {
        const file = 'apps/api/src/routes/experience/protected/removeIt.ts';
        const result = check({ [file]: route('delete', '"/{id}"') });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL AC:V6:25 (p2): ${file}:2 registers delete /{id}`);
    });

    it('(p2) rejects a hard delete of a listing', () => {
        const file = 'apps/api/src/routes/experience/protected/wipe.ts';
        const result = check({ [file]: route('delete', "'/{id}/hard'") });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p2): ${file}:2 registers delete /{id}/hard`
        );
    });

    it('(p2) rejects a listing restore with any method', () => {
        const file = 'apps/api/src/routes/accommodation/admin/bringBack.ts';
        const result = check({ [file]: route('post', '`/{id}/restore`') });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p2): ${file}:2 registers post /{id}/restore`
        );
    });

    it('(p2) rejects an account hard delete in user/admin', () => {
        const file = 'apps/api/src/routes/user/admin/wipeUser.ts';
        const result = check({ [file]: route('delete', "'/{id}/hard'") });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p2): ${file}:2 registers delete /{id}/hard`
        );
    });

    it('(p3) rejects a tree where a kept door disappeared', () => {
        const result = check({}, { omit: [ACC_PURGE] });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL AC:V6:25 (p3): ${ACC_PURGE}:1 kept door`);
    });

    it('(p4) rejects a listing service soft delete call', () => {
        const file = 'apps/api/src/services/x/a.ts';
        const result = check({
            [file]: 'export const f = async (actor, id) => {\n    await accommodationService.softDelete(actor, id);\n};\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p4): ${file}:2 calls accommodationService.softDelete(...)`
        );
    });

    it('(p4) rejects a hard delete on a freshly built listing service', () => {
        const file = 'packages/service-core/src/x/b.ts';
        const result = check({
            [file]: 'export const f = async (actor, id) =>\n    await new VenueService({ logger }).hardDelete(actor, id);\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p4): ${file}:2 calls new VenueService({ logger }).hardDelete(...)`
        );
    });

    it('TEST:1814:4 AC:1:16 recognizes VenueService and venueservice but not legacy names', () => {
        const file = 'apps/api/src/services/x/a.ts';
        for (const source of [
            'export const f = (actor, id) => new VenueService({ logger }).hardDelete(actor, id);\n',
            'export const f = (actor, id) => venueservice.hardDelete(actor, id);\n'
        ]) {
            expect(check({ [file]: source }).exitCode).toBe(1);
        }
        const legacy = check({
            [file]: 'export const f = (actor, id) => new GastronomyService({ logger }).hardDelete(actor, id);\n'
        });
        expect(legacy.exitCode).toBe(0);
    });

    it('(p4) rejects an account hard delete call', () => {
        const file = 'apps/api/src/services/x/c.ts';
        const result = check({
            [file]: 'export const f = (actor, id) => userService.hardDelete(actor, id);\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p4): ${file}:1 calls userService.hardDelete(...)`
        );
    });

    it('(p4) rejects a class that declares softDeleteOwnDraft', () => {
        const file = 'packages/service-core/src/x/d.ts';
        const result = check({
            [file]: 'export class S {\n    async softDeleteOwnDraft() {}\n}\n'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `FAIL AC:V6:25 (p4): ${file}:2 declares a softDeleteOwnDraft method`
        );
    });

    it('accepts sub-resource deletes, other folders, other services, tests and comments', () => {
        const result = check({
            'apps/api/src/routes/accommodation/protected/deleteMedia.ts': route(
                'delete',
                "'/{id}/media/{mediaId}'"
            ),
            'apps/api/src/routes/accommodation/reviews/admin/hardDelete.ts': route(
                'delete',
                "'/{id}/hard'"
            ),
            'apps/api/src/services/x/e.ts':
                'export const f = (actor, id) => accommodationReviewService.softDelete(actor, id);\n' +
                'export const g = (actor, id) => userPermissionModel.hardDelete(actor, id);\n' +
                '// accommodationService.softDelete(actor, id);\n',
            'apps/api/src/services/x/e.test.ts': 'accommodationService.softDelete(actor, id);\n'
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/^OK AC:V6:25: /);
    });

    it('rejects an inventory that does not load, has a row without spec, or repeats a file', () => {
        const broken = check({}, { inventory: '{ not json' });
        expect(broken.exitCode).toBe(1);
        expect(broken.output).toContain('cannot load');
        const parsed = JSON.parse(REAL_INVENTORY) as Record<string, Record<string, unknown>[]>;
        const noSpec = structuredClone(parsed);
        delete noSpec.retired?.[0]?.spec;
        const noSpecResult = check({}, { inventory: JSON.stringify(noSpec) });
        expect(noSpecResult.exitCode).toBe(1);
        expect(noSpecResult.output).toContain('has no file, method, path or spec');
        const repeated = structuredClone(parsed);
        repeated.outOfScope?.push({ ...repeated.kept?.[0] });
        const repeatedResult = check({}, { inventory: JSON.stringify(repeated) });
        expect(repeatedResult.exitCode).toBe(1);
        expect(repeatedResult.output).toContain('repeats file');
    });

    it('rejects a scan smaller than the minimum', () => {
        const result = run({ root: makeTree({}), minScannedFiles: 7 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('scanned 6 route files; expected at least 7');
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:listing-delete-doors']).toBe(
            'tsx scripts/check-listing-delete-doors.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:listing-delete-doors');
        expect((scripts['check:guards'] ?? '').trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toBeDefined();
        expect(guardsJob).toContain(
            'name: Check no listing delete or restore door outside PB12 and action 23 (AC:V6:25)'
        );
        expect(guardsJob).toContain('run: pnpm check:listing-delete-doors');
    });
});
