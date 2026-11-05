import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** AC:V7:19, TEST:V7:21 — pins the existing fail-closed schema drift gate on CI. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

interface Source {
    readonly file: string;
    readonly source: string;
    readonly titles: readonly string[];
}

/** Lists test roots used as V7 evidence. */
function collectSources(): readonly Source[] {
    const roots = ['apps/api/test', 'apps/e2e/tests', 'packages/seed/test', 'scripts/__tests__'];
    const files: string[] = [];
    const visit = (dir: string): void => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
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

/** Finds one YAML job block without parsing unrelated workflow sections. */
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

/** Returns job dependencies in either YAML representation. */
function needsOf(block: string): readonly string[] {
    const inline = /^ {4}needs:\s*([\w-]+)\s*$/m.exec(block);
    if (inline?.[1]) return [inline[1]];
    const lines = block.split('\n');
    const start = lines.findIndex((line) => /^ {4}needs:\s*$/.test(line));
    return lines
        .slice(start + 1)
        .map((line) => /^ {6}- ([\w-]+)\s*$/.exec(line)?.[1] ?? '')
        .filter(Boolean);
}

const TEST_FILES: Readonly<Record<number, string>> = {
    1: 'apps/api/test/integration/partner-application/pp1-create.test.ts',
    2: 'apps/api/test/integration/partner-application/pp1-guard.test.ts',
    3: 'apps/api/test/integration/partner-application/cancel-wait.test.ts',
    4: 'apps/api/test/integration/partner-application/pp2-approve.test.ts',
    5: 'apps/api/test/integration/partner-application/pp3-reject.test.ts',
    6: 'apps/api/test/integration/partner-application/pp-overdue-clock.test.ts',
    7: 'apps/api/test/integration/partner-application/v7-claim-link.test.ts',
    8: 'apps/api/test/integration/partner-application/v7-claim-verifies-account.test.ts',
    9: 'apps/api/test/integration/partner-application/v7-claim-link.test.ts',
    10: 'apps/api/test/integration/partner-application/v7-email-change-with-link.test.ts',
    11: 'apps/api/test/integration/partner-application/v7-direct-create.test.ts',
    12: 'apps/api/test/integration/partner-application/v7-partner-role-kept.test.ts',
    13: 'apps/api/test/integration/partner-presence/v7-presence-by-key.test.ts',
    14: 'apps/api/test/integration/partner-presence/v7-presence-moderation.test.ts',
    15: 'apps/api/test/integration/partner-application/v7-no-alliance-leads.test.ts',
    16: 'scripts/__tests__/v7-readers-read-the-key.test.ts',
    17: 'apps/api/test/integration/partner-billing-setup/v7-action-6-route.test.ts',
    18: 'apps/e2e/tests/admin/adm-18-partner-billing-setup.spec.ts',
    19: 'packages/seed/test/integration/hos1487-partner-owner-from-empty.integration.test.ts',
    20: 'packages/seed/test/data-migrations/hos1487-partner-owner-family.integration.test.ts',
    21: 'scripts/__tests__/v7-exit-ci-wiring.test.ts',
    22: 'apps/e2e/tests/verticals/v7-partner-claim.spec.ts',
    23: 'apps/api/test/routes/partner-application/public/pp1-route.test.ts'
};

// INFERRED clause-to-test map from .hoja/notas.md §4 D-6; D-7 adds TEST:V7:10 and notes the mail-render gap.
const CLAUSE_TESTS: Readonly<Record<number, readonly number[]>> = {
    1: [4],
    2: [13],
    3: [2, 3, 7, 8, 10],
    4: [15],
    5: [4, 7, 12],
    6: [11],
    7: [16],
    8: [],
    9: [14],
    10: [17, 18]
};

// AC-to-TEST mapping transcribed from the TEST:V7 coverage declarations in V7.md §3 / .hoja/contexto.md §3.
const AC_TESTS: Readonly<Record<number, readonly number[]>> = {
    1: [1],
    2: [2],
    3: [3],
    4: [4],
    5: [5],
    6: [6],
    7: [7, 22],
    8: [8],
    9: [9],
    10: [10],
    11: [11],
    12: [12],
    13: [13],
    14: [14],
    15: [15],
    16: [16],
    17: [17, 18],
    18: [19, 20, 21],
    19: [21, 22],
    20: [23]
};

const TEST_IDS = Array.from({ length: 23 }, (_, index) => index + 1);
const AC_IDS = Array.from({ length: 20 }, (_, index) => index + 1);

describe('TEST:V7:21 AC:V7:19 AC:V7:18 — phase drift guard remains wired and fail-closed', () => {
    it('CI runs the guard in guards, and ci-pass depends on guards', () => {
        const ci = read('.github/workflows/ci.yml');
        const guards = jobBlock(ci, 'guards');
        expect(guards).toContain('name: Check schema drift (SPEC-178)');
        expect(guards).toContain('run: bash scripts/check-schema-drift.sh');
        expect(guards).not.toMatch(/continue-on-error:\s*true/);
        expect(guards).not.toMatch(/if:\s*false/);
        expect(needsOf(jobBlock(ci, 'ci-pass'))).toContain('guards');
        expect(ci).toMatch(/push:[\s\S]*?- ['"]?epic\/\*\*['"]?/);
        expect(ci).toMatch(/pull_request:[\s\S]*?- ['"]?epic\/\*\*['"]?/);
    });

    it('drift script and tests retain positive confirmation and real/empty drift cases', () => {
        const script = read('scripts/check-schema-drift.sh');
        const tests = read('scripts/__tests__/check-schema-drift.test.ts');
        expect(script).toContain('No schema changes, nothing to migrate');
        expect(script).toContain('grep -qF "${NO_CHANGES_MARKER}"');
        expect(script).toContain('exit 1');
        expect(tests).toContain('fails on real drift');
        expect(tests).toContain('fails when the output is empty');
    });

    it('each V7 migration has a journal entry and matching snapshot', () => {
        const migrations = path.join(root, 'packages/db/src/migrations');
        const journal = read('packages/db/src/migrations/meta/_journal.json');
        const names = readdirSync(migrations);
        const snapshots = readdirSync(path.join(migrations, 'meta'));
        const candidates = names.filter((name) =>
            /^(?:0152_v611_partners_for_v7|.*hos148[4-9].*)\.sql$/.test(name)
        );
        expect(candidates.length).toBeGreaterThan(0);
        for (const file of candidates) {
            const prefix =
                file
                    .replace(/\.sql$/, '')
                    .split('_')
                    .slice(0, 1)[0] ?? '';
            expect(journal, `${file} journal entry`).toContain(
                `"tag": "${file.replace(/\.sql$/, '')}"`
            );
            expect(snapshots).toContain(`${prefix}_snapshot.json`);
        }
    });
});

describe('AC:V7:19 — LISTA:V7 evidence in the tree', () => {
    const sources = collectSources();
    const titles = sources.flatMap((source) => source.titles);

    it('the scanner finds TEST:V7 titles in each evidence root', () => {
        for (const rootPath of [
            'apps/api/test',
            'apps/e2e/tests',
            'packages/seed/test',
            'scripts/__tests__'
        ]) {
            expect(
                sources.some(
                    ({ file, titles: fileTitles }) =>
                        file.startsWith(rootPath) &&
                        fileTitles.some((title) => title.includes('TEST:V7:'))
                ),
                rootPath
            ).toBe(true);
        }
    });

    it('each TEST:V7:1..23 is a named title in its concrete mapped file', () => {
        for (const id of TEST_IDS) {
            const file = TEST_FILES[id];
            expect(file, `TEST:V7:${id} has a map entry`).toBeDefined();
            const source = sources.find((entry) => entry.file === file);
            expect(source, `${file} exists`).toBeDefined();
            expect(
                source?.titles.some((title) => namesId(title, `TEST:V7:${id}`)),
                `${file} names TEST:V7:${id}`
            ).toBe(true);
        }
        expect(titles.some((title) => namesId(title, 'TEST:V7:21'))).toBe(true);
    });

    it('the ten clause and twenty AC maps close over TEST:V7:1..23 and AC:V7:1..20', () => {
        expect(
            Object.keys(CLAUSE_TESTS)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
        expect(
            Object.keys(AC_TESTS)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual(AC_IDS);
        for (const ids of [...Object.values(CLAUSE_TESTS), ...Object.values(AC_TESTS)])
            for (const id of ids) expect(TEST_IDS).toContain(id);
        expect([...new Set(Object.values(AC_TESTS).flat())].sort((a, b) => a - b)).toEqual(
            TEST_IDS
        );
    });

    it('V7 e2e specs retain their titles and required tags', () => {
        const specs = [
            ['apps/e2e/tests/verticals/v7-partner-claim.spec.ts', 'TEST:V7:22', '@p0'],
            ['apps/e2e/tests/admin/adm-15-partner-applications-panel.spec.ts', '', ''],
            ['apps/e2e/tests/admin/adm-16-partner-direct-create.spec.ts', '', ''],
            ['apps/e2e/tests/admin/adm-17-partner-presence-moderation.spec.ts', '', ''],
            ['apps/e2e/tests/admin/adm-18-partner-billing-setup.spec.ts', 'TEST:V7:18', '@p0']
        ] as const;
        for (const [file, id, tag] of specs) {
            expect(existsSync(path.join(root, file)), file).toBe(true);
            const source = read(file);
            if (id) expect(source.match(/test\.describe\([\s\S]*?\)/)?.[0]).toContain(id);
            if (tag) expect(source.match(/test\.describe\([\s\S]*?\)/)?.[0]).toContain(tag);
        }
    });

    it('the historical name guard still excludes exactly four artifacts', () => {
        const guard = read('scripts/check-partner-no-tier-and-dates.ts');
        const match = /const HISTORICAL_FILE_EXCLUSIONS = \[([\s\S]*?)\] as const/.exec(guard);
        expect(match).not.toBeNull();
        expect([...(match?.[1] ?? '').matchAll(/'([^']+)'/g)]).toHaveLength(4);
    });
});
