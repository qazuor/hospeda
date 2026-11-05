/**
 * TEST:V8b:8 AC:V8b:7 pins the V8b evidence map and both independent phase
 * gates. This test does not run integration tests or Playwright: all assertions
 * are about PRESENCE in the tree and the CI wiring.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

interface Source {
    readonly file: string;
    readonly source: string;
    readonly titles: readonly string[];
}

// TEST and evidence files transcribed from .hoja/contexto.md §9.
const TEST_FILES: Readonly<Record<number, string>> = {
    1: 'apps/e2e/tests/verticals/v8b-partner-presence-row22.spec.ts',
    2: 'apps/e2e/tests/admin/adm-15-partner-applications-panel.spec.ts',
    3: 'apps/api/test/integration/partner-application/v7-claim-link.test.ts',
    4: 'apps/e2e/tests/verticals/v8b-partner-claim-row33.spec.ts',
    5: 'apps/api/test/integration/partner-application/v8b-pp1-unverified-session.test.ts',
    6: 'apps/api/test/integration/partner-presence/v8b-empty-presence.test.ts',
    7: 'apps/e2e/tests/admin/adm-19-partner-empty-presence.spec.ts',
    8: 'scripts/__tests__/check-additive-migrations.test.ts'
};

// LISTA:V8b clauses 1–6 as stated in .hoja/contexto.md §1.
const CLAUSE_TESTS: Readonly<Record<number, readonly number[]>> = {
    1: [1],
    2: [2],
    3: [3],
    4: [4],
    5: [5],
    6: [6, 7]
};

// AC:V8b:1–7 mapping from .hoja/contexto.md §1 and §9.
const AC_TESTS: Readonly<Record<number, readonly number[]>> = {
    1: [1],
    2: [2],
    3: [3],
    4: [4],
    5: [5],
    6: [6, 7],
    7: [8]
};

// API support cases named in .hoja/contexto.md §9; TEST:V8b:3 is declared
// covered by HOS-1486 in v7-claim-link.test.ts and v7-partner-claim.spec.ts.
const SUPPORT_FILES: readonly { readonly id: number; readonly file: string }[] = [
    { id: 1, file: 'apps/api/test/integration/partner-presence/v8b-owner-presence.test.ts' },
    { id: 2, file: 'apps/api/test/integration/partner-application/panel-list.test.ts' },
    { id: 2, file: 'apps/api/test/integration/partner-application/panel-list-clock.test.ts' },
    { id: 2, file: 'apps/api/test/routes/partner-application/admin/panel-list-route.test.ts' }
];

function collectSources(): readonly Source[] {
    const roots = [
        'apps/api/test',
        'apps/e2e/tests',
        'apps/web/test',
        'apps/admin/src',
        'scripts/__tests__'
    ];
    const packageDir = path.join(root, 'packages');
    for (const entry of readdirSync(packageDir, { withFileTypes: true })) {
        if (entry.isDirectory()) roots.push(`packages/${entry.name}/test`);
    }
    const files: string[] = [];
    const visit = (dir: string): void => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (/\.(?:test|spec)\.[tj]sx?$/.test(entry.name)) files.push(full);
        }
    };
    for (const dir of roots) visit(path.join(root, dir));
    return files.map((file) => {
        const source = readFileSync(file, 'utf8');
        const titles = [
            ...source.matchAll(
                /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|fixme))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
            )
        ].map((match) => match[2] ?? '');
        return { file: path.relative(root, file), source, titles };
    });
}

function namesId(text: string, id: string): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}

function jobBlock(source: string, job: string): string {
    const lines = source.split('\n');
    const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
    const start = lines.findIndex((line, index) => index > jobsAt && line === `  ${job}:`);
    if (start < 0) return '';
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}

function stepBlock(block: string, name: string): string {
    const steps = block.split(/^ {6}- name: /m);
    return steps.find((step) => step.startsWith(name)) ?? '';
}

const sources = collectSources();
const allTitles = sources.flatMap((source) => source.titles);

describe('TEST:V8b:8 AC:V8b:7 — V8b exit evidence and phase guards', () => {
    it('the title scanner finds TEST:V8b evidence in API, e2e, and scripts roots', () => {
        for (const expectedRoot of ['apps/api/test', 'apps/e2e/tests', 'scripts/__tests__']) {
            expect(
                sources.some(
                    ({ file, titles }) =>
                        file.startsWith(expectedRoot) &&
                        titles.some((title) => title.includes('TEST:V8b:'))
                ),
                expectedRoot
            ).toBe(true);
        }
    });

    it('each titled TEST:V8b case is present in its mapped file and API support files', () => {
        for (const id of [1, 2, 4, 5, 6, 7, 8]) {
            const file = TEST_FILES[id];
            expect(file, `TEST:V8b:${id} has a map entry`).toBeDefined();
            const source = sources.find((entry) => entry.file === file);
            expect(source, `${file} exists`).toBeDefined();
            expect(
                source?.titles.some((title) => namesId(title, `TEST:V8b:${id}`)),
                file
            ).toBe(true);
        }
        for (const support of SUPPORT_FILES) {
            expect(existsSync(path.join(root, support.file)), support.file).toBe(true);
            expect(read(support.file), support.file).toMatch(
                new RegExp(`TEST:V8b:${support.id}(?![0-9])`)
            );
        }
        expect(allTitles.some((title) => namesId(title, 'TEST:V8b:8'))).toBe(true);
    });

    it('TEST:V8b:3 remains covered by the declared HOS-1486 claim-link cases', () => {
        // PM-109 declares TEST:V8b:3 covered by HOS-1486's (c) and (b, f) cases.
        const source = read(TEST_FILES[3] ?? '');
        const wrongSecret = ['wrong-', '$', '{randomUUID()}'].join('');
        for (const anchor of [
            'sameActor.status).toBe(409)',
            "error.reason).toBe('PARTNER_ALREADY_CLAIMED')",
            wrongSecret,
            ')).status).toBe(404)',
            'JSON.stringify(body)).not.toContain(b.id)',
            'JSON.stringify(body)).not.toContain(b.email)'
        ])
            expect(source, anchor).toContain(anchor);
        expect(
            existsSync(path.join(root, 'apps/e2e/tests/verticals/v7-partner-claim.spec.ts'))
        ).toBe(true);
    });

    it('the clause and AC maps close over all eight TEST ids', () => {
        expect(
            Object.keys(CLAUSE_TESTS)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual([1, 2, 3, 4, 5, 6]);
        expect(
            Object.keys(AC_TESTS)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual([1, 2, 3, 4, 5, 6, 7]);
        const ids = new Set(Object.keys(TEST_FILES).map(Number));
        for (const group of [...Object.values(CLAUSE_TESTS), ...Object.values(AC_TESTS)])
            for (const id of group) expect(ids.has(id), `TEST id ${id} exists`).toBe(true);
        expect([...new Set(Object.values(AC_TESTS).flat())].sort((a, b) => a - b)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8
        ]);
    });

    it('the V8b e2e specs retain their title ids and required tags', () => {
        const specs = [
            ['apps/e2e/tests/verticals/v8b-partner-presence-row22.spec.ts', 'TEST:V8b:1', ['@p0']],
            [
                'apps/e2e/tests/admin/adm-15-partner-applications-panel.spec.ts',
                'TEST:V8b:2',
                ['@p0', '@admin']
            ],
            ['apps/e2e/tests/verticals/v8b-partner-claim-row33.spec.ts', 'TEST:V8b:4', ['@p0']],
            [
                'apps/e2e/tests/admin/adm-19-partner-empty-presence.spec.ts',
                'TEST:V8b:7',
                ['@p0', '@admin']
            ]
        ] as const;
        for (const [file, id, tags] of specs) {
            expect(existsSync(path.join(root, file)), file).toBe(true);
            const title = read(file).match(/test\.describe\([\s\S]*?\)/)?.[0] ?? '';
            expect(title, file).toContain(id);
            for (const tag of tags) expect(title, file).toContain(tag);
        }
    });

    it('AC:V8b:7 keeps drift and additive migrations as separate required Guards steps', () => {
        const ci = read('.github/workflows/ci.yml');
        const guards = jobBlock(ci, 'guards');
        const drift = stepBlock(guards, 'Check schema drift (SPEC-178)');
        const additive = stepBlock(
            guards,
            'Check a phase branch adds only additive migrations (GATE:FP.3, TEST:V8b:8)'
        );
        expect(drift).toContain('run: bash scripts/check-schema-drift.sh');
        expect(additive).toContain('run: pnpm check:additive-migrations');
        for (const step of [drift, additive]) {
            expect(step).not.toMatch(/continue-on-error:\s*true/);
            expect(step).not.toMatch(/^\s+if:\s*false\s*$/m);
        }
        expect(guards.indexOf(drift)).toBeLessThan(guards.indexOf(additive));
        expect(jobBlock(ci, 'ci-pass')).toMatch(/^\s+- guards\s*$/m);
        expect(ci).toMatch(/push:[\s\S]*?- ['"]?epic\/\*\*['"]?/);
        expect(ci).toMatch(/pull_request:[\s\S]*?- ['"]?epic\/\*\*['"]?/);
        const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
        expect(pkg.scripts['check:additive-migrations']).toBe(
            'tsx scripts/check-additive-migrations.ts'
        );
        expect(pkg.scripts['check:guards']?.split(' && ')).toContain(
            'pnpm check:additive-migrations'
        );
        expect(existsSync(path.join(root, 'scripts/check-additive-migrations.ts'))).toBe(true);
        expect(read('scripts/__tests__/check-additive-migrations.test.ts')).toContain('TEST:V8b:8');
    });

    it('ACC_25 has its own permission and the route requires it', () => {
        const catalog = read('packages/verticals/src/authorization/administrative-actions.ts');
        const action = /ACC_25:\s*\{([\s\S]*?)\n\s*\},/.exec(catalog)?.[1] ?? '';
        expect(action).toContain('PermissionEnum.PARTNER_EMPTY_PRESENCE');
        expect(action).not.toContain('PermissionEnum.PARTNER_MANAGE');
        expect(read('apps/api/src/routes/partners/admin/empty-presence.ts')).toContain(
            'requiredPermissions: [PermissionEnum.PARTNER_EMPTY_PRESENCE]'
        );
    });

    it('the migration guard names each owner-prohibited rule', () => {
        const guard = read('scripts/check-additive-migrations.ts');
        for (const rule of [
            'DROP_TABLE',
            'DROP_COLUMN',
            'RENAME_TABLE',
            'RENAME_COLUMN',
            'CHANGE_COLUMN_TYPE'
        ])
            expect(guard).toContain(rule);
    });
});
