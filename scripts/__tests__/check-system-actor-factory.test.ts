/** TEST:V5:15 — GUARD:G19 detects system actors built outside the factory. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-system-actor-factory';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = path.join(REPO_ROOT, '.hoja/tmp');
const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(files: Readonly<Record<string, string>>): string {
    mkdirSync(tempRoot, { recursive: true });
    const root = mkdtempSync(path.join(tempRoot, 'g19-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, source] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}

function check(
    files: Readonly<Record<string, string>>,
    allowlist: Parameters<typeof run>[0]['allowlist'] = {}
) {
    return run({ root: makeTree(files), minScannedFiles: 1, allowlist });
}

const service = 'packages/service-core/src/services/foo/foo.service.ts';
const middleware = 'apps/api/src/middlewares/actor.ts';

describe('TEST:V5:15 GUARD:G19', () => {
    it('accepts the real production tree with the frozen allowlist', () => {
        expect(run().exitCode).toBe(0);
    });

    it('exempts only the factory', () => {
        const result = check({
            'packages/service-core/src/utils/system-actor.ts':
                'const a = { _isSystemActor: true };',
            [service]: 'const ok = 1;'
        });
        expect(result.exitCode).toBe(0);
    });

    it('rejects an actor literal in a service and names its line', () => {
        const result = check({
            [service]:
                "const before = 1;\nconst actor = { id: 'x', roles: [], permissions: [], _isSystemActor: true };"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`G19: ${service}:2 (a) _isSystemActor assignment`);
    });

    it('rejects all permissions in an actor literal', () => {
        const result = check({
            [service]: 'const actor = { permissions: Object.values(PermissionEnum) };'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`G19: ${service}:1 (b) Object.values(PermissionEnum)`);
    });

    it('rejects all permissions through an intermediate variable', () => {
        const result = check({
            [service]: 'const all = Object.values(PermissionEnum); const a = { permissions: all };'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`G19: ${service}:1 (b) Object.values(PermissionEnum)`);
    });

    it('rejects property and element assignments', () => {
        const result = check({
            [service]: "x._isSystemActor = true;\nx['_isSystemActor'] = true;"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`G19: ${service}:1 (a) _isSystemActor assignment`);
        expect(result.output).toContain(`G19: ${service}:2 (a) _isSystemActor assignment`);
    });

    it('rejects shorthand and string named properties', () => {
        const result = check({
            [service]: "const a = { _isSystemActor };\nconst b = { '_isSystemActor': true };"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `G19: ${service}:1 (a) _isSystemActor shorthand assignment`
        );
        expect(result.output).toContain(`G19: ${service}:2 (a) _isSystemActor assignment`);
    });

    it('ignores false, type signatures, reads, and test files', () => {
        const result = check({
            [service]:
                'type Actor = { _isSystemActor?: boolean };\nconst apiKey = { _isSystemActor: false };\nif (actor._isSystemActor) {}',
            'apps/api/test/actor.ts':
                'const actor = { _isSystemActor: true, permissions: Object.values(PermissionEnum) };'
        });
        expect(result.exitCode).toBe(0);
    });

    it('enforces the exact allowlist count and reports extras', () => {
        const allowlist = { [middleware]: { mark: 'b' as const, count: 1, reason: 'human admin' } };
        const one = check({ [middleware]: 'Object.values(PermissionEnum);' }, allowlist);
        expect(one.exitCode).toBe(0);
        const two = check(
            { [middleware]: 'Object.values(PermissionEnum);\nObject.values(PermissionEnum);' },
            allowlist
        );
        expect(two.exitCode).toBe(1);
        expect(two.output).toContain(`G19: ${middleware}:2 (b) Object.values(PermissionEnum)`);
        const zero = check({ [middleware]: 'const actor = {};' }, allowlist);
        expect(zero.exitCode).toBe(1);
        expect(zero.output).toContain(`G19: ${middleware}:1 allowlist stale`);
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:system-actor-factory']).toBe(
            'tsx scripts/check-system-actor-factory.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:system-actor-factory');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toBeDefined();
        expect(guardsJob).toContain(
            'name: Check system actors are built only by the factory (GUARD:G19)'
        );
        expect(guardsJob).toContain('run: pnpm check:system-actor-factory');
    });
});
