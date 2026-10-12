/** TEST:V5:25 — GUARD:G-R3-C: every domain operation declares whether it passes step 5. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ENUMERATION_FILE, RESOLVER_FILE, run } from '../check-step5-declared';

const ROOT = path.resolve(import.meta.dirname, '../..');
const UPDATE_ROUTE = 'apps/api/src/routes/accommodation/protected/update.ts';
const TREE_FILES = [
    ENUMERATION_FILE,
    RESOLVER_FILE,
    'apps/api/src/types/authorization.ts',
    'packages/verticals/src/authorization/resource-vertical.ts',
    'apps/api/src/middlewares/listing-access.ts',
    UPDATE_ROUTE,
    'apps/api/src/routes/experience/protected/brochure.ts'
] as const;
const REAL_REPO_TIMEOUT = 60_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr3c-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const file of TREE_FILES) write(root, file, readFileSync(path.join(ROOT, file), 'utf8'));
    return root;
}

function write(root: string, file: string, source: string): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
}

function mutate(root: string, file: string, from: string, to: string): void {
    const source = readFileSync(path.join(root, file), 'utf8');
    expect(source).toContain(from);
    writeFileSync(path.join(root, file), source.replace(from, to));
}

function runTree(root: string): { readonly exitCode: number; readonly output: string } {
    return run({ root, minScannedFiles: 1, minOperationSites: 1 });
}

describe('TEST:V5:25 - G-R3-C: a domain operation that does not declare step 5', () => {
    it(
        'accepts the real repository and the unmutated minimal tree',
        () => {
            const real = run();
            expect(real.exitCode).toBe(0);
            expect(real.output).toContain('OK GUARD:G-R3-C: 10 domain operations');
            const tree = runTree(tempTree());
            expect(tree.exitCode).toBe(0);
            expect(tree.output).toContain('(5 pass, 5 do not)');
        },
        REAL_REPO_TIMEOUT
    );

    it('fails when TRANSFER joins the enumeration without its step-5 declaration (spec mutation)', () => {
        const root = tempTree();
        mutate(
            root,
            ENUMERATION_FILE,
            "'CREATE'\n] as const;",
            "'CREATE',\n    'TRANSFER'\n] as const;"
        );
        const result = runTree(root);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'FAIL GUARD:G-R3-C: undeclared: domain operation TRANSFER does not declare whether it passes step 5'
        );
    });

    it('fails when an existing declaration line is deleted', () => {
        const root = tempTree();
        mutate(
            root,
            ENUMERATION_FILE,
            '    EXPORT: false,\n    REACTIVATE: true',
            '    REACTIVATE: true'
        );
        const result = runTree(root);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('undeclared: domain operation EXPORT');
    });

    it('fails on a computed value and on a spread', () => {
        const computed = tempTree();
        mutate(
            computed,
            ENUMERATION_FILE,
            '    EDIT: true,\n    PUBLISH',
            "    EDIT: Boolean('x'),\n    PUBLISH"
        );
        const first = runTree(computed);
        expect(first.exitCode).toBe(1);
        expect(first.output).toContain('computed: EDIT declares step 5 with a computed value');
        const spread = tempTree();
        mutate(
            spread,
            ENUMERATION_FILE,
            '    CREATE: true\n};',
            '    CREATE: true,\n    ...OTHER_STEP5\n};'
        );
        const second = runTree(spread);
        expect(second.exitCode).toBe(1);
        expect(second.output).toContain('computed: ...OTHER_STEP5');
    });

    it('fails on a declaration that is not a domain operation', () => {
        const root = tempTree();
        mutate(
            root,
            ENUMERATION_FILE,
            '    CREATE: true\n};',
            '    CREATE: true,\n    ARCHIVE: true\n};'
        );
        const result = runTree(root);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('unknown: ARCHIVE');
    });

    it('fails when the resolver no longer reads the declaration', () => {
        const root = tempTree();
        mutate(
            root,
            RESOLVER_FILE,
            'if (OPERATION_PASSES_STEP5[args.operation])',
            "if (args.operation !== 'READ_OWN')"
        );
        const result = runTree(root);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not read: resolveListingAccess');
    });

    it('fails when a route names an undeclared or computed operation', () => {
        const cast = tempTree();
        mutate(cast, UPDATE_ROUTE, "operation: 'EDIT'", "operation: 'EDITX' as 'EDIT'");
        const first = runTree(cast);
        expect(first.exitCode).toBe(1);
        expect(first.output).toMatch(
            /site: apps\/api\/src\/routes\/accommodation\/protected\/update\.ts:\d+ names operation EDITX/
        );
        const call = tempTree();
        mutate(call, UPDATE_ROUTE, "operation: 'EDIT'", 'operation: pickOperation()');
        const second = runTree(call);
        expect(second.exitCode).toBe(1);
        expect(second.output).toContain('names operation pickOperation()');
    });

    it('accepts a pass-through of a declared operation and ignores test files', () => {
        const root = tempTree();
        write(
            root,
            'packages/verticals/src/authorization/pass-through.ts',
            'export const probe = (config: { operation: "EDIT" }, facts: null) =>\n' +
                '    resolveResourceStep({ actorId: null, facts, operation: config.operation });\n'
        );
        write(
            root,
            'apps/api/test/x.test.ts',
            "resolveResourceStep({ actorId: null, facts: null, operation: 'NOPE' });\n"
        );
        expect(runTree(root).exitCode).toBe(0);
    });

    it('fails closed without the enumeration file or with too few sites', () => {
        const missing = tempTree();
        unlinkSync(path.join(missing, ENUMERATION_FILE));
        const first = runTree(missing);
        expect(first.exitCode).toBe(1);
        expect(first.output).toContain(`cannot read ${ENUMERATION_FILE}`);
        const few = run({ root: tempTree(), minOperationSites: 999, minScannedFiles: 1 });
        expect(few.exitCode).toBe(1);
        expect(few.output).toContain('expected at least 999');
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:step5-declared']).toBe('tsx scripts/check-step5-declared.ts');
        expect(scripts['check:guards']).toContain('pnpm check:step5-declared');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toContain(
            'name: Check every domain operation declares whether it passes step 5 (GUARD:G-R3-C)'
        );
        expect(guardsJob).toContain('run: pnpm check:step5-declared');
    });
});
