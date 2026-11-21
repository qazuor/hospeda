import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { apiIntegrationCollection } from './helpers/api-integration-collection';

/**
 * B6 exit evidence (TEST:B6:11, AC:B6:13, HOS-1555): this static check pins
 * the LISTA:B6 clauses in the tree (6 and 7 retired by HOS-2179 T-7) and their collection by CI. It does
 * not run those tests; the second exit run verifies they pass against the
 * fake provider. The index has its own database test. The B11 sweep is
 * deferred to HOS-1636.
 *
 * Every assertion is about presence. Parallel leaves edit these files, so
 * this test never pins counts, line numbers, absences, or file order.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

interface CorteEntry {
    readonly clause: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly files: readonly string[];
    readonly acOnly: readonly string[];
    /** Struck through in B6.md by HOS-2179 T-7: it owes no evidence, and the spec says why. */
    readonly retired?: true;
}
// LISTA:B6, B6.md:230-252; grouping from AC:B6:13 and TEST "Cubre" rows.
const clause = (
    clause: number,
    acs: readonly string[],
    tests: readonly string[],
    files: readonly string[],
    acOnly: readonly string[] = []
): CorteEntry => ({ clause, acs, tests, files, acOnly });
/** A LISTA:B6 clause HOS-2179 T-7 retired with the order refund channel. */
const retiredClause = (
    clause: number,
    acs: readonly string[],
    tests: readonly string[]
): CorteEntry => ({ clause, acs, tests, files: [], acOnly: [], retired: true });
const SPEC_B6 = '.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/10-corte/B6.md';
/** The note B6.md carries under every struck-through AC and TEST (HOS-2179 T-7). */
const RETIRED_NOTE =
    '**Retirada por HOS-2179 T-7** (`.specs/HOS-2179-addons-pago-unico-checkout-pro/spec.md` §5.11 y §6): el canal de devolución por orden salió con la orden; la devolución de un pago de página sale por el pago, como la de una suscripción (`openOneTimePageChargeMark` → `MARK_PROPOSAL` → `RF2`, `POST /v1/payments/{id}/refunds`).';
/** The note B6.md carries inside every struck-through LISTA clause (HOS-2179 T-7). */
const RETIRED_CLAUSE_NOTE =
    'retirada por HOS-2179 T-7: el canal de devolución por orden salió con la orden; la devolución de un pago de página sale por el pago (`openOneTimePageChargeMark` → `MARK_PROPOSAL` → `RF2`)';
const CORTE_MAP: readonly CorteEntry[] = [
    clause(
        1,
        ['AC:B6:1', 'AC:B6:11'],
        ['TEST:B6:1', 'TEST:B6:9'],
        [
            'packages/service-core/test/integration/services/refund-confirm-1.test.ts',
            'apps/api/test/integration/billing-refund/confirm-refund-route.test.ts',
            'packages/payments/test/charge-interface-not-mandate.test.ts',
            'apps/api/test/cron/one-time-charge-no-clock.guard.test.ts'
        ]
    ),
    clause(
        2,
        ['AC:B6:5'],
        ['TEST:B6:4'],
        [
            'packages/service-core/test/integration/services/refund-execute-1.test.ts',
            'packages/service-core/test/integration/services/refund-execute-2.test.ts',
            'packages/service-core/test/integration/services/provider-notice-refund-execute.test.ts',
            'apps/api/test/integration/webhooks/mercadopago-refund-execute.test.ts',
            'packages/payments/test/mercadopago-charge-refunds.test.ts'
        ],
        [
            'packages/service-core/test/integration/services/provider-notice-refund-execute.test.ts',
            'apps/api/test/integration/webhooks/mercadopago-refund-execute.test.ts',
            'packages/payments/test/mercadopago-charge-refunds.test.ts'
        ]
    ),
    clause(
        3,
        ['AC:B6:3'],
        ['TEST:B6:3'],
        [
            'packages/service-core/test/integration/services/refund-confirm-3.test.ts',
            'packages/payments/test/fake-refund-refusal.test.ts'
        ]
    ),
    clause(
        4,
        ['AC:B6:7'],
        ['TEST:B6:5'],
        [
            'packages/service-core/test/integration/services/refund-window-confirm.test.ts',
            'packages/service-core/test/services/billing/refund/refund-window.test.ts',
            'apps/api/test/integration/billing-refund/confirm-refund-route.test.ts',
            'apps/api/test/integration/billing-subscription/open-refunds-route.test.ts'
        ],
        ['apps/api/test/integration/billing-subscription/open-refunds-route.test.ts']
    ),
    clause(
        5,
        ['AC:B6:4', 'AC:B6:5', 'AC:B6:12'],
        ['TEST:B6:4', 'TEST:B6:10'],
        [
            'packages/service-core/test/integration/services/refund-confirm-3.test.ts',
            'packages/service-core/test/integration/services/refund-execute-1.test.ts',
            // HOS-2179 T-7 retired the card order; TEST:B6:10 / AC:B6:12 hold on the payment page.
            'packages/service-core/test/integration/services/addon-purchase-identity.test.ts',
            'packages/service-core/test/integration/services/addon-one-time-page.test.ts'
        ]
    ),
    // Clauses 6 and 7 were the order refunds; HOS-2179 T-7 struck them through in B6.md.
    retiredClause(6, ['AC:B6:8'], ['TEST:B6:6']),
    retiredClause(7, ['AC:B6:9'], ['TEST:B6:7'])
];
const RETIRED_IDS = CORTE_MAP.filter(({ retired }) => retired).flatMap(({ acs, tests }) => [
    ...acs,
    ...tests
]);
/** The resend (AC:B6:10) outlives the order channel: it is the payment refund's own. */
const RESEND = {
    ac: 'AC:B6:10',
    test: 'TEST:B6:8',
    file: 'packages/service-core/test/integration/services/refund-resend.test.ts'
} as const;

const BEYOND_LISTA = {
    acs: ['AC:B6:2', 'AC:B6:6'],
    test: 'TEST:B6:2',
    files: [
        'packages/service-core/test/integration/services/refund-confirm-2.test.ts',
        'packages/service-core/test/integration/services/refund-fail-decline.test.ts'
    ]
} as const;
const FROM_EMPTY = {
    test: 'TEST:B6:11',
    file: 'packages/db/test/integration/b6-order-refund-index.test.ts',
    index: 'uq_refund_call_order_awaiting_id',
    schema: 'packages/db/src/schemas/vertical/refund-call.dbschema.ts'
} as const;
const DEFERRED = [
    {
        what: 'the sweep that resends unanswered refund calls and sends the order refund the index held back',
        acs: ['AC:B11:14'],
        issue: 'HOS-1636',
        phase: 'fase-2',
        letter: 'CT',
        source: 'B11.md:1619'
    }
];
const DEFERRED_FUNCTIONS = [
    {
        name: 'resendUnansweredRefundCalls',
        file: 'packages/service-core/src/services/billing/refund/resend-refund-call.service.ts',
        exportLine: "export * from './billing/refund/resend-refund-call.service.js';"
    }
] as const;

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
    const lines = block.split('\n');
    const at = lines.findIndex((line) => /^ {4}needs:\s*$/.test(line));
    if (at === -1) return [];
    const needs: string[] = [];
    for (const line of lines.slice(at + 1)) {
        const item = /^ {6}- ([A-Za-z0-9_-]+)\s*$/.exec(line);
        if (!item?.[1]) break;
        needs.push(item[1]);
    }
    return needs;
}
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}
function collectTestRoots(): readonly string[] {
    const roots: string[] = [];
    for (const area of ['apps', 'packages'] as const) {
        const areaDir = path.join(repoRoot, area);
        if (!existsSync(areaDir)) continue;
        for (const entry of readdirSync(areaDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            for (const leaf of ['test', 'tests'] as const) {
                const candidate = path.join(areaDir, entry.name, leaf);
                if (existsSync(candidate) && statSync(candidate).isDirectory())
                    roots.push(candidate);
            }
        }
    }
    const scriptsTests = path.join(repoRoot, 'scripts/__tests__');
    if (existsSync(scriptsTests)) roots.push(scriptsTests);
    return roots;
}
function collectTestFiles(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles(full, out);
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}
function collectSources(): readonly string[] {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles(root, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .map((file) => readFileSync(file, 'utf8'));
}
function titlesInRoot({ root }: { readonly root: string }): readonly string[] {
    const files: string[] = [];
    const full = path.join(repoRoot, root);
    if (!existsSync(full)) return [];
    collectTestFiles(full, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .flatMap((file) => testTitles({ source: readFileSync(file, 'utf8') }));
}

describe('TEST:B6:11 AC:B6:13 - B6 exit: LISTA:B6 evidence in the tree, the sweep deferred, suite collected (HOS-1555)', () => {
    const allTitles = collectSources().flatMap((source) => testTitles({ source }));
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the scanner is not blind', () => {
        it('reads TEST:B6 titles under every specified test root', () => {
            const roots = [
                'apps/api/test',
                'packages/db/test',
                'packages/payments/test',
                'packages/service-core/test'
            ];
            const blindRoots = roots.filter(
                (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B6:'))
            );
            expect(blindRoots).toEqual([]);
        });
    });

    describe('(b) every LISTA clause has TEST titles and evidence files', () => {
        for (const entry of CORTE_MAP.filter(({ retired }) => !retired)) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                const missingFiles: string[] = [];
                for (const file of entry.files) {
                    if (!existsSync(path.join(repoRoot, file))) {
                        missingFiles.push(`${file} (missing)`);
                        continue;
                    }
                    const titles = testTitles({ source: read(file) });
                    const ids = entry.acOnly.includes(file) ? entry.acs : entry.tests;
                    if (!ids.some((id) => titles.some((title) => namesId({ text: title, id }))))
                        missingFiles.push(`${file} (no title names ${ids.join(', ')})`);
                }
                expect(
                    missingTitles,
                    `TEST ids without a title: ${missingTitles.join(', ')}`
                ).toEqual([]);
                expect(
                    missingFiles,
                    `evidence files without the title: ${missingFiles.join(', ')}`
                ).toEqual([]);
            });
        }
    });

    describe('(c) the index exists on a database migrated from empty', () => {
        it(`${FROM_EMPTY.test} names the test and index in the schema and test`, () => {
            const exists = existsSync(path.join(repoRoot, FROM_EMPTY.file));
            const source = exists ? read(FROM_EMPTY.file) : '';
            const titles = testTitles({ source });
            expect(exists, `${FROM_EMPTY.file} is missing`).toBe(true);
            expect(
                titles.some((title) => namesId({ text: title, id: FROM_EMPTY.test })),
                `${FROM_EMPTY.file} has no title naming ${FROM_EMPTY.test}`
            ).toBe(true);
            expect(source, `${FROM_EMPTY.file} does not name ${FROM_EMPTY.index}`).toContain(
                FROM_EMPTY.index
            );
            expect(
                read(FROM_EMPTY.schema),
                `${FROM_EMPTY.schema} does not name ${FROM_EMPTY.index}`
            ).toContain(FROM_EMPTY.index);
        });
    });

    describe('(d) B6 ids and clause coverage', () => {
        it('every TEST:B6 id from 1 to 11 has a title outside this file', () => {
            const ids = Array.from({ length: 11 }, (_, index) => `TEST:B6:${index + 1}`).filter(
                (id) => !RETIRED_IDS.includes(id)
            );
            const missing = ids.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing, `TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
        });
        it('every AC:B6 id from 1 to 12 has a title outside this file', () => {
            const ids = Array.from({ length: 12 }, (_, index) => `AC:B6:${index + 1}`).filter(
                (id) => !RETIRED_IDS.includes(id)
            );
            const missing = ids.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing, `AC ids without a title: ${missing.join(', ')}`).toEqual([]);
        });
        it('maps clauses 1 to 7 once and covers the ACs named by AC:B6:13', () => {
            const clauses = CORTE_MAP.map((entry) => entry.clause);
            const expectedClauses = Array.from({ length: 7 }, (_, index) => index + 1);
            const mappedAcs = new Set(CORTE_MAP.flatMap((entry) => entry.acs));
            const exitAcs = ['AC:B6:1', 'AC:B6:11', 'AC:B6:5', 'AC:B6:3', 'AC:B6:7', 'AC:B6:12'];
            expect(new Set(clauses).size).toBe(clauses.length);
            expect([...clauses].sort((a, b) => a - b)).toEqual(expectedClauses);
            expect(exitAcs.filter((id) => !mappedAcs.has(id))).toEqual([]);
        });
        it('retired clauses and ids are struck through in B6.md with the HOS-2179 note', () => {
            const spec = read(SPEC_B6);
            for (const { clause: number } of CORTE_MAP.filter(({ retired }) => retired)) {
                const at = spec.search(new RegExp(`^${number}\\. ~~`, 'm'));
                expect(at, `LISTA:B6 clause ${number} is struck through`).toBeGreaterThan(-1);
                // The span ends where the next clause starts (or the list ends), as in B10, so
                // one clause's note never covers its neighbour.
                const next = spec.indexOf(`\n${number + 1}. `, at);
                const span = spec.slice(at, next > -1 ? next : spec.indexOf('\n\n', at));
                const noteAt = span.indexOf(RETIRED_CLAUSE_NOTE);
                expect(noteAt, `clause ${number} note`).toBeGreaterThan(-1);
                expect(
                    span.slice(0, noteAt).trimEnd(),
                    `clause ${number} text is struck through up to its note`
                ).toMatch(new RegExp(`^${number}\\. ~~[^~]+~~ —$`));
            }
            for (const id of RETIRED_IDS) {
                const start = spec.indexOf(`\n${id}\n`);
                expect(start, `${id} heading`).toBeGreaterThan(-1);
                const lines = spec
                    .slice(start + 1, spec.indexOf('\n\n<a id=', start))
                    .split('\n')
                    .slice(1);
                expect(lines[0], `${id} carries the retired note`).toBe(RETIRED_NOTE);
                // Every body line is struck through: only the metadata lines stay plain.
                const body = lines
                    .slice(1)
                    .filter((line) => line.trim() && !/^(Tipo|Cubre|Fuente):/.test(line));
                expect(body.length, `${id} has a body`).toBeGreaterThan(0);
                expect(
                    body.filter((line) => !/^~~.+~~$/.test(line)),
                    `${id} body lines not struck through`
                ).toEqual([]);
            }
        });
        it('no test title still claims a retired B6 id', () => {
            expect(
                RETIRED_IDS.filter((id) => allTitles.some((title) => namesId({ text: title, id })))
            ).toEqual([]);
        });
        it(`${RESEND.test} ${RESEND.ac} keeps its resend evidence`, () => {
            expect(
                testTitles({ source: read(RESEND.file) }).some(
                    (title) =>
                        namesId({ text: title, id: RESEND.test }) &&
                        namesId({ text: title, id: RESEND.ac })
                )
            ).toBe(true);
        });
        it('keeps RF5 and charged-back evidence beyond LISTA:B6', () => {
            const missingFiles = BEYOND_LISTA.files.filter(
                (file) => !existsSync(path.join(repoRoot, file))
            );
            const missingTitles = BEYOND_LISTA.files.filter(
                (file) =>
                    !testTitles({ source: read(file) }).some((title) =>
                        namesId({ text: title, id: BEYOND_LISTA.test })
                    )
            );
            expect(missingFiles, `missing evidence files: ${missingFiles.join(', ')}`).toEqual([]);
            expect(
                missingTitles,
                `files without ${BEYOND_LISTA.test}: ${missingTitles.join(', ')}`
            ).toEqual([]);
            expect(BEYOND_LISTA.acs).toEqual(['AC:B6:2', 'AC:B6:6']);
        });
    });

    describe('(e) the B11 sweep is deferred as data', () => {
        it('records HOS-1636 phase 2 CT and keeps the resend function exported', () => {
            const entry = DEFERRED[0];
            expect(DEFERRED).toHaveLength(1);
            expect(entry).toEqual({
                what: 'the sweep that resends unanswered refund calls and sends the order refund the index held back',
                acs: ['AC:B11:14'],
                issue: 'HOS-1636',
                phase: 'fase-2',
                letter: 'CT',
                source: 'B11.md:1619'
            });
            const servicesIndex = read('packages/service-core/src/services/index.ts');
            for (const contract of DEFERRED_FUNCTIONS) {
                const source = read(contract.file);
                expect(
                    new RegExp(`^\\s*export async function ${contract.name}\\b`, 'm').test(source),
                    `${contract.file} does not export ${contract.name}`
                ).toBe(true);
                expect(
                    servicesIndex,
                    `services/index.ts does not re-export ${contract.name}`
                ).toContain(contract.exportLine);
            }
            // TEST:B6:6 and TEST:B6:7 left with the order refunds (HOS-2179 T-7); the resend stays.
            for (const id of ['TEST:B6:8'])
                expect(
                    allTitles.some((title) => namesId({ text: title, id })),
                    `${id} has no title`
                ).toBe(true);
        });
    });

    describe('(f) the fake provider has the measured lies and rules', () => {
        it('maps M13 to TEST:B6:3; RP14, RP15 and RP16 left with the order path (HOS-2179 T-7)', () => {
            const fakeLists = JSON.parse(read('packages/payments/src/fake/fake-lists.json')) as {
                readonly lies: readonly { readonly id: string; readonly defenseTest?: string }[];
                readonly rules: readonly { readonly id: string }[];
            };
            const m13 = fakeLists.lies.find((entry) => entry.id === 'M13');
            const ruleIds = new Set(fakeLists.rules.map((entry) => entry.id));
            expect(m13?.defenseTest, 'M13 does not name TEST:B6:3').toBe('TEST:B6:3');
            for (const id of ['RP14', 'RP15', 'RP16'])
                expect(ruleIds.has(id), `${id} was retired and must not come back`).toBe(false);
        });
    });

    describe('(g) the suite is collected and gated', () => {
        it('integration configs and API collection include the B6 evidence', () => {
            expect(read('packages/service-core/vitest.integration.config.ts')).toContain(
                "'test/integration/services/**/*.test.ts'"
            );
            expect(read('packages/db/vitest.config.integration.ts')).toContain(
                "'test/integration/**/*.test.ts'"
            );
            const apiFolder = apiIntegrationCollection({
                target: 'test/integration/billing-refund'
            });
            expect(
                apiFolder.collected.length,
                'billing-refund has no collected tests'
            ).toBeGreaterThan(0);
            expect(apiFolder.excluded, 'billing-refund has excluded tests').toEqual([]);
            for (const file of [
                'test/integration/webhooks/mercadopago-refund-execute.test.ts',
                'test/integration/billing-subscription/open-refunds-route.test.ts'
            ]) {
                const result = apiIntegrationCollection({ target: file });
                expect(result.collected, `${file} is not collected`).toContain(file);
                expect(result.excluded, `${file} is excluded`).toEqual([]);
            }
            expect(read('packages/payments/vitest.config.ts')).toContain("'test/**/*.test.ts'");
            expect(read('apps/api/vitest.config.ts')).toContain("'test/**/*.test.ts'");
        });
        it('guards runs test:scripts and ci-pass needs guards, test-unit and test-integration', () => {
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            const missing = ['guards', 'test-unit', 'test-integration'].filter(
                (job) => !needs.includes(job)
            );
            expect(guards.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
            expect(missing, `ci-pass is missing jobs: ${missing.join(', ')}`).toEqual([]);
        });
    });
});
