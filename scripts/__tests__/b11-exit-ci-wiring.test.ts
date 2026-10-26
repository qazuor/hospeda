import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:1611:1 fixes the presence of B11's exit evidence and daily cron wiring.
 * It does NOT run the integration tests; corrida 4 and CI do that. Clauses 8,
 * 17 and 18 are deferred to HOS-1636 (AC:B11:14, fase-2, CT, B11.md:1619).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORTE = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21] as const;
const DEFERRED = [8, 17, 18].map((clause) => ({
    clause,
    acs: ['AC:B11:14'],
    issue: 'HOS-1636',
    phase: 'fase-2',
    letter: 'CT',
    source: 'B11.md:1619'
}));
function jobBlock({ source, job }: { readonly source: string; readonly job: string }): string {
    const lines = source.split('\n');
    const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
    if (jobsAt === -1) return '';
    const headerAt = lines.findIndex((line, index) => index > jobsAt && line === `  ${job}:`);
    if (headerAt === -1) return '';
    const body: string[] = [];
    for (const line of lines.slice(headerAt + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}
function needsOf({ block }: { readonly block: string }): readonly string[] {
    const inline = /^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/m.exec(block);
    if (inline?.[1]) return [inline[1]];
    const lines = block.split('\n'),
        at = lines.findIndex((line) => /^ {4}needs:\s*$/.test(line));
    if (at === -1) return [];
    const needs: string[] = [];
    for (const line of lines.slice(at + 1)) {
        const item = /^ {6}- ([A-Za-z0-9_-]+)\s*$/.exec(line);
        if (!item?.[1]) break;
        needs.push(item[1]);
    }
    return needs;
}
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
function gameSources() {
    return readdirSync(path.join(repoRoot, 'packages/service-core/test/integration/services'))
        .filter((file) => /^reconciliation-exit-game.*\.test\.ts$/.test(file))
        .map((file) => ({
            file,
            source: readFileSync(
                path.join(repoRoot, 'packages/service-core/test/integration/services', file),
                'utf8'
            )
        }));
}
function deepIds(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(deepIds);
    if (value && typeof value === 'object')
        return Object.entries(value).flatMap(([key, child]) => [
            ...(key === 'id' && typeof child === 'string' ? [child] : []),
            ...deepIds(child)
        ]);
    return [];
}

describe('TEST:1611:1 AC:B11:20 la evidencia de la salida de B11 está en el árbol', () => {
    const games = gameSources();
    it('accounts for clauses 1 through 21 exactly once as cut or deferred', () => {
        const cut = new Set<number>(CORTE),
            deferred = new Set(DEFERRED.map((row) => row.clause));
        expect([...cut].filter((n) => deferred.has(n))).toEqual([]);
        expect([...cut, ...deferred].sort((a, b) => a - b)).toEqual(
            Array.from({ length: 21 }, (_, i) => i + 1)
        );
        expect(DEFERRED).toEqual(
            [8, 17, 18].map((clause) => ({
                clause,
                acs: ['AC:B11:14'],
                issue: 'HOS-1636',
                phase: 'fase-2',
                letter: 'CT',
                source: 'B11.md:1619'
            }))
        );
    });
    it('has one game case for every cut clause and no deferred case', () => {
        expect(games.length).toBeGreaterThan(0);
        const titled = games.map(({ file, source }) => ({
            file,
            titles: testTitles({ source }),
            source
        }));
        for (const clause of CORTE) {
            const prefix = new RegExp(`^LISTA:B11 cláusula ${clause}(?::| \\()`);
            const hits = titled.flatMap((game) =>
                game.titles.filter((title) => prefix.test(title))
            );
            expect(hits, `missing LISTA:B11 clause ${clause}`).not.toHaveLength(0);
            if (clause === 9) {
                expect(hits.some((title) => title.includes('(primera mitad)'))).toBe(true);
                expect(hits.some((title) => title.includes('(segunda mitad)'))).toBe(true);
            }
        }
        for (const clause of DEFERRED)
            expect(
                titled
                    .flatMap((game) => game.titles)
                    .some((title) =>
                        new RegExp(`^LISTA:B11 cláusula ${clause.clause}(?::| \\()`).test(title)
                    )
            ).toBe(false);
        for (const game of titled) {
            expect(game.source).toContain("describe('TEST:B11:20");
        }
    });
    it('registers the enabled daily reconciliation sweep in registry and manifest', () => {
        const job = readFileSync(
            path.join(repoRoot, 'apps/api/src/cron/jobs/billing-reconciliation-sweep.job.ts'),
            'utf8'
        );
        expect(job).toContain("name: 'billing-reconciliation-sweep'");
        expect(job).toContain("schedule: '0 6 * * *'");
        expect(job).toContain('enabled: true');
        expect(
            readFileSync(path.join(repoRoot, 'apps/api/src/cron/registry.ts'), 'utf8')
        ).toContain('billingReconciliationSweepJob');
        expect(
            readFileSync(path.join(repoRoot, 'apps/api/src/cron/schedules.manifest.ts'), 'utf8')
        ).toContain("name: 'billing-reconciliation-sweep'");
    });
    it('keeps the cron and game comparison factories in the same order', () => {
        const job = readFileSync(
            path.join(repoRoot, 'apps/api/src/cron/jobs/billing-reconciliation-sweep.job.ts'),
            'utf8'
        );
        const fixture = readFileSync(
            path.join(
                repoRoot,
                'packages/service-core/test/integration/services/reconciliation-exit-game-fixtures.ts'
            ),
            'utf8'
        );
        const block = /comparisons:\s*\[([\s\S]*?)\]/.exec(job)?.[1] ?? '';
        const names = [
            ...block.matchAll(
                /\b(createStateComparison|createPeriodChargesComparison|createAmountComparison)\s*\(/g
            )
        ].map((m) => m[1]);
        const fixtureNames = [
            ...fixture.matchAll(
                /\b(createStateComparison|createPeriodChargesComparison|createAmountComparison)\s*\(/g
            )
        ].map((m) => m[1]);
        expect(names, 'el juego de salida dejó de imitar las comparaciones del cron').toEqual([
            'createStateComparison',
            'createPeriodChargesComparison',
            'createAmountComparison'
        ]);
        expect(
            fixtureNames,
            'el juego de salida dejó de imitar las comparaciones del cron'
        ).toEqual(names);
    });
    it('records exercised fake lies and ends check:guards with check:fake-lies', () => {
        const fake = JSON.parse(
            readFileSync(path.join(repoRoot, 'packages/payments/src/fake/fake-lists.json'), 'utf8')
        ) as unknown;
        const ids = deepIds(fake);
        for (const id of ['M4', 'M5', 'M7', 'RP5', 'RP7', 'RP11']) expect(ids).toContain(id);
        const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts['check:guards']?.trim().split('&&').at(-1)?.trim()).toBe(
            'pnpm check:fake-lies'
        );
    });
    it('pins the exact three immediate reconciliation templates', () => {
        const source = readFileSync(
            path.join(repoRoot, 'apps/api/test/cron/email-outbox-template-registry.guard.test.ts'),
            'utf8'
        );
        expect(source).toContain("describe('TEST:1608:3");
        const array = /immediateTemplates\s*=\s*\[([\s\S]*?)\]/.exec(source)?.[1] ?? '';
        const templates = [...array.matchAll(/'([^']+)'/g)].map((match) => match[1]);
        expect(
            templates,
            'la lista cerrada de inmediatos de B11 es de tres (owner H3 de HOS-1607 + HOS-1608)'
        ).toEqual([
            'billing.duplicate-charge-detected',
            'billing.mark-escalated',
            'billing.revocation-refund-failed'
        ]);
    });
    it('has the existing B11 guards and runs integration tests as a CI gate', () => {
        const sweep =
            'packages/service-core/test/services/billing/reconciliation/sweep-never-lists-from-search.guard.test.ts';
        const seen =
            'packages/service-core/test/integration/services/reconciliation-cancellation-seen.test.ts';
        expect(existsSync(path.join(repoRoot, sweep))).toBe(true);
        expect(readFileSync(path.join(repoRoot, sweep), 'utf8')).toContain('TEST:B11:1');
        expect(existsSync(path.join(repoRoot, seen))).toBe(true);
        expect(readFileSync(path.join(repoRoot, seen), 'utf8')).toContain('TEST:B11:26');
        expect(
            readFileSync(
                path.join(repoRoot, 'packages/service-core/vitest.integration.config.ts'),
                'utf8'
            )
        ).toContain("'test/integration/services/**/*.test.ts'");
        const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
        const integration = jobBlock({ source: ci, job: 'test-integration' });
        // HOS-1775: the packages leg and the sharded API legs.
        expect(integration).toContain('pnpm test:integration');
        expect(integration).toContain('pnpm turbo run test:integration --filter=hospeda-api');
        expect(needsOf({ block: jobBlock({ source: ci, job: 'ci-pass' }) })).toContain(
            'test-integration'
        );
    });
});
