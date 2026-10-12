/** TEST:V5:21 — GUARD:G6 detects role reads during effective-set construction. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-role-never-decides';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(
    extra: Readonly<Record<string, string>> = {},
    omit: readonly string[] = [],
    exceptions: readonly object[] = []
): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g6-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    const files: Record<string, string> = {
        'packages/schemas/src/enums/role.enum.ts': readFileSync(
            path.join(REPO, 'packages/schemas/src/enums/role.enum.ts'),
            'utf8'
        ),
        'packages/verticals/src/effective-set/resolve-effective-set.ts':
            'export async function resolveEffectiveSet() {}',
        'packages/verticals/src/effective-set-cache/x.ts': 'export const cache = 1;',
        'packages/verticals/src/coverage/x.ts': 'export const coverage = 1;',
        'packages/verticals/src/quota/x.ts': 'export const quota = 1;',
        'apps/api/src/utils/listing-access/x.ts': 'export const access = 1;',
        'packages/verticals/src/authorization/entitlement-step.ts': 'export const step = 1;',
        'packages/verticals/src/authorization/limit-step.ts': 'export const step = 1;',
        'apps/api/src/utils/effective-set-cache.ts': 'export const cache = 1;',
        'apps/api/src/utils/entitlement-filter.ts': 'export const filter = 1;',
        'apps/api/src/routes/user/protected/effective-set.ts': 'export const route = 1;',
        'apps/api/src/routes/user/admin/effective-set.ts': 'export const route = 1;',
        'scripts/guards/role-decision-exceptions.json': JSON.stringify({ exceptions }),
        '.specs/HOS-1352-test/spec.md': 'fixture citation',
        ...extra
    };
    for (const [file, source] of Object.entries(files)) {
        if (omit.includes(file)) continue;
        const full = path.join(root, file);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, source);
    }
    return root;
}

function check(
    extra: Readonly<Record<string, string>> = {},
    omit: readonly string[] = [],
    exceptions: readonly object[] = []
) {
    return run({
        root: tree(extra, omit, exceptions),
        minScannedFiles: 1,
        exceptionsPath: 'scripts/guards/role-decision-exceptions.json'
    });
}

describe('TEST:V5:21 - G6 half (b): a role entered the effective set', () => {
    it('rejects the specification mutation in resolveEffectiveSet', () => {
        const file = 'packages/verticals/src/effective-set/resolve-effective-set.ts';
        const result = check({
            [file]: 'export async function resolveEffectiveSet(args: { roles?: string[] }) { if (args.roles?.includes(RoleEnum.SUPER_ADMIN)) return []; }'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toMatch(/^FAIL GUARD:G6 \(b\) a role entered the effective set:/);
        expect(result.output).toContain(file);
    });

    it('detects role API calls, role table imports, enum imports and newly scoped files', () => {
        expect(
            check({
                'apps/api/src/utils/listing-access/ports.ts':
                    'const roles = await getUserRoles({ userId });'
            }).output
        ).toContain('getUserRoles');
        expect(
            check({
                'packages/verticals/src/effective-set/fold.ts':
                    "import { userRole } from '@repo/db';"
            }).output
        ).toContain('userRole');
        expect(
            check({
                'packages/verticals/src/effective-set/fold.ts':
                    "import { RoleEnum } from '@repo/schemas';"
            }).output
        ).toContain('RoleEnum');
        expect(
            check({
                'packages/verticals/src/quota/staff.ts':
                    "if (user.roles.includes('SUPER_ADMIN')) {}"
            }).output
        ).toContain('reads .roles');
    });

    it('discovers effectiveSet consumers outside the fixed folders', () => {
        const result = check({
            'apps/api/src/routes/foo/bar.ts':
                'if (actor.roles.length) ports.effectiveSet({ userId, vertical });'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('apps/api/src/routes/foo/bar.ts');
    });

    it('ignores plan roles in coverage code', () => {
        const result = check({
            'packages/verticals/src/coverage/plan-reader.ts':
                'reader.findCurrentVersionByRole({ vertical, role: FLOOR_PLAN_ROLE }); eq(plans.role, role);'
        });
        expect(result.exitCode).toBe(0);
    });

    it('fails closed when the resolveEffectiveSet anchor or a required prefix is missing', () => {
        const noAnchor = check({
            'packages/verticals/src/effective-set/resolve-effective-set.ts':
                'export async function resolveSet() {}'
        });
        expect(noAnchor.output).toContain('no scanned file declares');
        const noCoverage = check({}, ['packages/verticals/src/coverage/x.ts']);
        expect(noCoverage.output).toContain(
            'no scanned file under packages/verticals/src/coverage/'
        );
    });

    it('does not allow half (a) exceptions to silence half (b)', () => {
        const file = 'packages/verticals/src/effective-set/fold.ts';
        const result = check(
            { [file]: 'const role = RoleEnum.ADMIN;' },
            [],
            [
                {
                    file,
                    symbol: '<module>',
                    form: 'compare',
                    count: 1,
                    why: 'test exception',
                    spec: ['.specs/HOS-1352-test/spec.md:1']
                }
            ]
        );
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('reads RoleEnum');
    });
});
