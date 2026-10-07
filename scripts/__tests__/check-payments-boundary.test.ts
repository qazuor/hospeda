/**
 * @fileoverview
 * TEST:B1:10 (AC:B1:10, AC:B1:2): GUARD:G16, its two predicates, by mutation.
 *
 * Each case builds a throwaway git tree that is green, applies ONE mutation and
 * runs the guard over it: (a) the legacy billing library added to any
 * `package.json` or imported anywhere, (b) the payments package importing from
 * `apps/`. Each mutation turns the guard red with its own predicate's message;
 * a dependency on an internal `@repo/*` package leaves it green. P-3, carried
 * over from the retired `check-no-qzpay.sh`, is mutated the same way.
 *
 * The library's name is assembled from parts, so this file never trips G16.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findAppImports,
    findLegacyInCode,
    findLegacyInManifest,
    LEGACY_PREFIX,
    RULE_MESSAGES,
    run
} from '../check-payments-boundary.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEGACY_CORE = `${LEGACY_PREFIX}-core`;

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g16-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;

/** A green tree: two apps, the payments package depending on @repo/*, an api source file. */
const GREEN: Readonly<Record<string, string>> = {
    'package.json': json({ name: 'root', devDependencies: { vitest: '^4' } }),
    'apps/api/package.json': json({
        name: 'hospeda-api',
        dependencies: { '@repo/payments': 'workspace:*' }
    }),
    'apps/web/package.json': json({ name: 'hospeda-web' }),
    'apps/api/src/index.ts': "import { FakePaymentProvider } from '@repo/payments';\n",
    'packages/payments/package.json': json({
        name: '@repo/payments',
        dependencies: { zod: '^4', '@repo/logger': 'workspace:*' }
    }),
    'packages/payments/src/index.ts':
        "import { logger } from '@repo/logger';\nexport const x = logger;\n",
    // Prose naming the library is not a dependency.
    'docs/history.md': `Billing used to run on ${LEGACY_CORE}.\n`,
    'apps/api/src/note.ts': `// it used to import '${LEGACY_CORE}'\nexport const y = 1;\n`
};

/** Runs the guard over a tree built from GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('G16 over a green tree', () => {
    it('passes, with a payments dependency on an internal @repo/* package', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });
});

describe('G16 predicate (a): the legacy library in any package.json or import', () => {
    it.each([
        [
            'a dependency of an app',
            'apps/web/package.json',
            json({ name: 'hospeda-web', dependencies: { [LEGACY_CORE]: '1' } })
        ],
        [
            'a devDependency of the root',
            'package.json',
            json({ name: 'root', devDependencies: { [LEGACY_PREFIX]: '1' } })
        ],
        [
            'a peerDependency of a tool',
            'tools/x/package.json',
            json({ name: 'x', peerDependencies: { [`${LEGACY_PREFIX}-react`]: '1' } })
        ]
    ])('turns red on %s, naming predicate (a)', (_case, file, content) => {
        const { exitCode, output } = guardOver({ overrides: { [file]: content } });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G16(a)']);
        expect(output).toContain(file);
        expect(output).not.toContain(RULE_MESSAGES['G16(b)']);
    });

    it.each([
        ['a static import', `import { x } from '${LEGACY_CORE}';`],
        ['a re-export', `export * from "${LEGACY_PREFIX}-drizzle";`],
        ['a dynamic import', `const m = await import('${LEGACY_PREFIX}-hono');`],
        ['a require', `const m = require('${LEGACY_PREFIX}');`],
        ['a test mock', `vi.mock('${LEGACY_PREFIX}-mercadopago/sub');`]
    ])('turns red on %s in any code file, naming predicate (a)', (_case, line) => {
        const { exitCode, output } = guardOver({
            overrides: { 'packages/db/src/a.ts': `${line}\n` }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G16(a)']);
        expect(output).toContain('packages/db/src/a.ts:1');
    });
});

describe('G16 predicate (b): the payments package importing from apps/', () => {
    it.each([
        ['a relative path into apps/', "import { db } from '../../../apps/api/src/db';"],
        ['an app package name', "import { app } from 'hospeda-api';"],
        ['an app package subpath', "import { app } from 'hospeda-web/src/x';"],
        ['an alias with an apps/ segment', "import { app } from '@/apps/admin/x';"]
    ])('turns red on %s, naming predicate (b)', (_case, line) => {
        const { exitCode, output } = guardOver({
            overrides: { 'packages/payments/src/leak.ts': `${line}\n` }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G16(b)']);
        expect(output).toContain('packages/payments/src/leak.ts:1');
        expect(output).not.toContain(RULE_MESSAGES['G16(a)']);
    });

    it('turns red when the payments manifest declares an app', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/payments/package.json': json({
                    name: '@repo/payments',
                    dependencies: { 'hospeda-api': 'workspace:*' }
                })
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G16(b)']);
    });

    it('does not apply outside the payments package', () => {
        const { exitCode } = guardOver({
            overrides: {
                'packages/other/src/x.ts': "import { app } from '../../../apps/api/src/db';\n"
            }
        });
        expect(exitCode).toBe(0);
    });
});

describe('P-3 (carried from check-no-qzpay.sh): the demolished surface stays gone', () => {
    it.each([
        ['an old billing route', 'apps/api/src/routes/billing/index.ts'],
        ['the old storage adapter', 'packages/db/src/billing/drizzle-adapter.ts'],
        ['a retired cron job', 'apps/api/src/cron/jobs/dunning.job.ts']
    ])('turns red when %s comes back, naming P-3', (_case, file) => {
        const { exitCode, output } = guardOver({ overrides: { [file]: 'export {};\n' } });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['P-3']);
        expect(output).toContain(file.startsWith('apps/api/src/cron') ? file : path.dirname(file));
    });
});

describe('G16 cannot pass vacuously', () => {
    it('fails when the payments package is missing', () => {
        const { 'packages/payments/package.json': _gone, ...rest } = GREEN;
        const result = run({ root: makeTree({ files: rest }), minScannedFiles: 0 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('cannot be enforced');
    });

    it('fails when fewer code files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: GREEN }), minScannedFiles: 1000 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not a clean tree');
    });

    it('is green over this repository', () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});

describe('the predicates, unit by unit', () => {
    it('reads only dependency blocks of a manifest, not script names', () => {
        const source = json({ name: 'x', scripts: { [LEGACY_PREFIX]: 'echo' } });
        expect(findLegacyInManifest({ file: 'package.json', source })).toEqual([]);
    });

    it('skips comment lines in code', () => {
        expect(findLegacyInCode({ file: 'a.ts', source: ` * see '${LEGACY_CORE}'\n` })).toEqual([]);
    });

    it('lets a payments import of @repo/* through', () => {
        expect(
            findAppImports({
                root: '/r',
                file: 'packages/payments/src/a.ts',
                source: "import { x } from '@repo/billing-verticals-contract';\n",
                appNames: ['hospeda-api']
            })
        ).toEqual([]);
    });
});

describe('G16 wiring', () => {
    const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
        readonly scripts: Readonly<Record<string, string>>;
    };

    /** The `guards` job of ci.yml, from its header to the next job header. */
    const guardsJob = (() => {
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8').split(
            '\n'
        );
        const start = ci.indexOf('  guards:');
        const end = ci.findIndex(
            (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
        );
        return start === -1 ? '' : ci.slice(start, end === -1 ? undefined : end).join('\n');
    })();

    it('has its own script and is part of pnpm check:guards', () => {
        expect(rootPkg.scripts['check:payments-boundary']).toBe(
            'tsx scripts/check-payments-boundary.ts'
        );
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:payments-boundary');
    });

    it('is a step of the guards job of ci.yml', () => {
        expect(guardsJob.length).toBeGreaterThan(0);
        expect(guardsJob).toMatch(/^\s+run: pnpm check:payments-boundary\s*$/m);
    });
});

describe('the retired check-no-qzpay.sh', () => {
    const OLD = `check-no-${'qz'}${'pay'}`;

    it('is gone from scripts/, package.json and ci.yml', () => {
        expect(existsSync(path.join(REPO_ROOT, `scripts/${OLD}.sh`))).toBe(false);
        expect(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).not.toContain(OLD);
        expect(
            readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8')
        ).not.toContain(OLD);
    });
});
