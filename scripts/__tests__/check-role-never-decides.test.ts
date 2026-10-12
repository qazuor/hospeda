/** TEST:V5:20 — GUARD:G6 detects role constants used by authorization. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-role-never-decides';
import { findRoleDecisions, readRoleValues } from '../role-decision-scan';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(
    extra: Readonly<Record<string, string>> = {},
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
        'apps/api/src/routes/accommodation/protected/update.ts': 'export const update = 1;',
        'scripts/guards/role-decision-exceptions.json': JSON.stringify({ exceptions }),
        '.specs/HOS-1352-example/spec.md': 'fixture citation',
        ...extra
    };
    for (const [file, source] of Object.entries(files)) {
        const full = path.join(root, file);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, source);
    }
    return root;
}

function check(extra: Readonly<Record<string, string>>, exceptions: readonly object[] = []) {
    const root = tree(extra, exceptions);
    return run({
        root,
        minScannedFiles: 1,
        exceptionsPath: 'scripts/guards/role-decision-exceptions.json'
    });
}

function exception(
    file: string,
    symbol: string,
    form: string,
    count = 1,
    spec: string[] = ['.specs/HOS-1352-example/spec.md:1']
) {
    return { file, symbol, form, count, why: 'spec retains this identity check', spec };
}

describe('TEST:V5:20 - G6 half (a): an authorization that decides only by role', () => {
    it('accepts the real tree and the cited exceptions', () => {
        expect(run().exitCode).toBe(0);
    }, 30_000);

    it('rejects the specification mutation in a protected route', () => {
        const result = check({
            'apps/api/src/routes/accommodation/protected/update.ts':
                "if (actor.role === 'ADMIN') { return next(); }"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toMatch(
            /^FAIL GUARD:G6 \(a\) an authorization decides only by role:/
        );
        expect(result.output).toContain('apps/api/src/routes/accommodation/protected/update.ts:1');
        expect(result.output).toContain('compare');
    });

    it('detects membership arguments and role constant sets', () => {
        const arg = check({
            'packages/service-core/src/services/x.ts': 'actor.roles.includes(RoleEnum.ADMIN);'
        });
        expect(arg.output).toContain('membership-arg');
        const variable = check({
            'packages/service-core/src/services/x.ts':
                'const STAFF = new Set([RoleEnum.ADMIN, RoleEnum.EDITOR]); STAFF.has(role);'
        });
        expect(variable.output).toContain('membership-set');
        const property = check({
            'packages/service-core/src/services/x.ts':
                'class Foo { private static readonly EXEMPT = new Set([RoleEnum.SUPER_ADMIN]); } Foo.EXEMPT.has(r);'
        });
        expect(property.output).toContain('membership-set');
    });

    it('detects switch cases, role comparisons in callbacks, and literal role sets', () => {
        expect(
            check({
                'packages/service-core/src/services/x.ts':
                    'switch (role) { case RoleEnum.SUPER_ADMIN: return true; }'
            }).output
        ).toContain('switch-case');
        expect(
            check({
                'packages/service-core/src/services/x.ts': 'roles.some((r) => r === RoleEnum.HOST);'
            }).output
        ).toContain('compare');
        expect(
            check({
                'packages/service-core/src/services/x.ts':
                    '[RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN].includes(r);'
            }).output
        ).toContain('membership-set');
    });

    it('ignores non-role collisions, assignments, variable comparisons, and calculated maps', () => {
        const source =
            "msg.role === 'user'; validated.actorSide === 'GUEST'; held.role === role; plan.role === TRIAL_PLAN_ROLE; const PLAN_ROLES = ['trial','pre_trial','floor']; !PLAN_ROLES.includes(input.role); const map = { [RoleEnum.ADMIN]: fullAdminRole }; const role = RoleEnum.HOST;";
        const result = check({ 'packages/service-core/src/services/x.ts': source });
        expect(result.exitCode).toBe(0);
    });

    it('excludes tests, seed data and clients', () => {
        const result = check({
            'apps/api/test/x.ts': "actor.role === 'ADMIN';",
            'packages/seed/src/x.ts': "actor.role === 'ADMIN';",
            'apps/web/src/x.ts': "actor.role === 'ADMIN';"
        });
        expect(result.exitCode).toBe(0);
    });

    it('enforces exact exception counts and stale detection', () => {
        const file = 'apps/api/src/utils/x.ts';
        const text = 'if (actor.role === RoleEnum.ADMIN) {}\nif (actor.role === RoleEnum.HOST) {}';
        const excess = check({ [file]: text }, [exception(file, '<module>', 'compare', 1)]);
        expect(excess.exitCode).toBe(1);
        expect(excess.output).toContain(`${file}:2`);
        const stale = check({ [file]: 'const x = 1;' }, [exception(file, '<module>', 'compare')]);
        expect(stale.output).toContain('exception stale');
    });

    it('validates citation content, existence, bounds and duplicate keys', () => {
        const file = 'apps/api/src/utils/x.ts';
        const src = 'actor.role === RoleEnum.ADMIN;';
        expect(
            check({ [file]: src, '.specs/HOS-1352-example/spec.md': 'one' }, [
                exception(file, '<module>', 'compare', 1, ['.specs/HOS-1352-example/spec.md:2'])
            ]).output
        ).toContain('exceeds file length');
        expect(
            check({ [file]: src, '.specs/HOS-1352-example/spec.md': 'one\ntwo' }, [
                exception(file, '<module>', 'compare', 1, [])
            ]).output
        ).toContain('invalid exception');
        expect(
            check({ [file]: src }, [
                exception(file, '<module>', 'compare', 1, ['.specs/HOS-1352-example/missing.md:1'])
            ]).output
        ).toContain('does not exist');
        const duplicate = exception(file, '<module>', 'compare');
        expect(
            check({ [file]: src, '.specs/HOS-1352-example/spec.md': 'one' }, [duplicate, duplicate])
                .output
        ).toContain('duplicate exception');
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:role-never-decides']).toBe('tsx scripts/check-role-never-decides.ts');
        expect(scripts['check:guards']).toContain(
            'pnpm check:role-never-decides && pnpm check:fake-lies'
        );
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(REPO, '.github/workflows/ci.yml'), 'utf8');
        const job = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(job).toContain(
            'Check no authorization decides only by role and no role enters the effective set (GUARD:G6)'
        );
        expect(job).toContain('run: pnpm check:role-never-decides');
    });
});

describe('G6 scanner unit predicates', () => {
    it('uses the twelve RoleEnum values from the source enum', () => {
        expect([...readRoleValues({ root: REPO })]).toEqual([
            'SUPER_ADMIN',
            'ADMIN',
            'CLIENT_MANAGER',
            'EDITOR',
            'HOST',
            'GASTRONOMY_OWNER',
            'EXPERIENCE_OWNER',
            'PARTNER_OWNER',
            'SPONSOR',
            'USER',
            'GUEST',
            'SYSTEM'
        ]);
    });

    it('attributes anonymous returned arrow findings to their variable', () => {
        const source =
            'const actorMiddleware = () => { return async (c, next) => { if (c.actor.role === RoleEnum.ADMIN) return next(); }; };';
        expect(
            findRoleDecisions({ file: 'x.ts', source, roleValues: new Set(['ADMIN']) })[0]?.symbol
        ).toBe('actorMiddleware');
    });

    it('skips object-literal callback keys when finding the enclosing named method', () => {
        const source =
            'class Service { assignPermissionToUser() { this.run({ execute: async () => targetUserRoles.includes(RoleEnum.ADMIN) }); } }';
        expect(
            findRoleDecisions({ file: 'x.ts', source, roleValues: new Set(['ADMIN']) })[0]?.symbol
        ).toBe('assignPermissionToUser');
    });
});
