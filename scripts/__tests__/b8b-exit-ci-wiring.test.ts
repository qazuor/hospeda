import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    apiIntegrationCollection,
    integrationJobRunsBothSuites
} from './helpers/api-integration-collection';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');
const exists = (file: string): boolean => existsSync(path.join(root, file));
const self = fileURLToPath(import.meta.url);
const B8_TO_B8B = [1, 2, 3, 4, 5, 6, 7, 9] as const;
const B8_MAP = [
    {
        clause: 1,
        acs: ['AC:B8b:7'],
        tests: ['TEST:B8b:7'],
        file: 'packages/service-core/test/integration/services/subscription-plan-change-direction.test.ts'
    },
    {
        clause: 2,
        acs: ['AC:B8b:16'],
        tests: ['TEST:B8b:16'],
        file: 'packages/service-core/test/integration/services/scheduled-change-collisions.test.ts'
    },
    {
        clause: 3,
        acs: ['AC:B8b:4'],
        tests: ['TEST:B8b:4'],
        file: 'packages/service-core/test/integration/services/pause-price-increase.test.ts'
    },
    {
        clause: 4,
        acs: ['AC:B8b:5'],
        tests: ['TEST:B8b:5'],
        file: 'packages/service-core/test/integration/services/subscription-cancel-paused-s22.test.ts'
    },
    {
        clause: 5,
        acs: ['AC:B8b:11'],
        tests: ['TEST:B8b:11'],
        file: 'packages/service-core/test/integration/services/subscription-succession-dies-alone.test.ts'
    },
    {
        clause: 6,
        acs: ['AC:B8b:11', 'AC:B8b:12', 'AC:B8b:10'],
        tests: ['TEST:B8b:11', 'TEST:B8b:12', 'TEST:B8b:10'],
        file: 'packages/service-core/test/integration/services/subscription-reissue-courtesy-s9.test.ts'
    },
    {
        clause: 7,
        acs: ['AC:B8b:17'],
        tests: ['TEST:B8b:17'],
        file: 'apps/api/test/integration/billing-subscription/plan-change-route.test.ts'
    },
    {
        clause: 9,
        acs: ['AC:B8a:4', 'AC:B8b:5'],
        tests: ['TEST:B8a:4', 'TEST:B8b:5'],
        file: 'packages/service-core/test/integration/services/subscription-cancel-active-credit.test.ts'
    }
] as const;
const DEFERRED = { tests: ['TEST:B8b:25 (cortesía)'], issue: 'HOS-1590', phase: 'fase-2' } as const;
const FROM_EMPTY = {
    test: 'TEST:B8b:23',
    file: 'packages/db/test/integration/b8b-schema-from-empty.test.ts'
} as const;

// These paths were measured with git show --stat on the eight B8b merge commits.
const DECLARED_TOUCHES = [
    {
        file: 'packages/service-core/src/services/billing/reconciliation/sweep/our-cancellation-retry.ts',
        pr: '#4058',
        decision: 'D-1: compose paused cancellation retry with B7 sweep'
    },
    {
        file: 'packages/service-core/src/services/billing/reconciliation/sweep/our-cancellation-retry.ts',
        pr: '#4159',
        decision: 'D-1: compose S31 cancellation retry with B7 sweep'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/cancel-active-subscription.service.ts',
        pr: '#4162',
        decision: 'D-1: discard S38 queue on B8a cancellation'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/cancel-direct-subscription.service.ts',
        pr: '#4162',
        decision: 'D-1: discard S38 queue on B8a cancellation'
    },
    {
        file: 'apps/api/src/routes/webhooks/mercadopago-ports.ts',
        pr: '#4185',
        decision: 'PM-312: optional real succession port'
    },
    {
        file: 'apps/api/src/routes/webhooks/mercadopago.ts',
        pr: '#4185',
        decision: 'PM-312: compose webhook with real succession port'
    },
    {
        file: 'packages/service-core/src/services/billing/payment/record-charge-fact.service.ts',
        pr: '#4185',
        decision: 'PM-312: optional real succession port'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/activate-subscription.service.ts',
        pr: '#4185',
        decision: 'PM-312: optional real succession port'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/exit-grace.service.ts',
        pr: '#4185',
        decision: 'PM-312: optional real succession port'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/grace-reminder-notice.ts',
        pr: '#4203',
        decision: 'D-1 / HOS-1580 D-7: enqueue B7 grace notice'
    },
    {
        file: 'packages/service-core/src/services/billing/subscription/grace-started-notice.ts',
        pr: '#4203',
        decision: 'D-1 / HOS-1580 D-7: enqueue B7 grace notice'
    }
] as const;
const MERGES = [
    ['#4050', 'a15b85e7a9'],
    ['#4058', '8d8bce3d29'],
    ['#4068', 'bb83bfabe2'],
    ['#4159', 'a174796e43'],
    ['#4162', '40ca77a566'],
    ['#4173', '3640959253'],
    ['#4185', 'd77326cda8'],
    ['#4203', '70f1937a6a']
] as const;
// The measured ownership paths are independent of DECLARED_TOUCHES, so removing a declaration fails.
const OWNED_PATHS = new Set([
    'packages/service-core/src/services/billing/reconciliation/sweep/our-cancellation-retry.ts',
    'packages/service-core/src/services/billing/subscription/cancel-active-subscription.service.ts',
    'packages/service-core/src/services/billing/subscription/cancel-direct-subscription.service.ts',
    'apps/api/src/routes/webhooks/mercadopago-ports.ts',
    'apps/api/src/routes/webhooks/mercadopago.ts',
    'packages/service-core/src/services/billing/payment/record-charge-fact.service.ts',
    'packages/service-core/src/services/billing/subscription/activate-subscription.service.ts',
    'packages/service-core/src/services/billing/subscription/exit-grace.service.ts',
    'packages/service-core/src/services/billing/subscription/grace-reminder-notice.ts',
    'packages/service-core/src/services/billing/subscription/grace-started-notice.ts'
]);

function filesUnder(dir: string): string[] {
    return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const relative = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return filesUnder(relative);
        return entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name) ? [relative] : [];
    });
}
function sourceFilesUnder(dir: string): string[] {
    return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const relative = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return sourceFilesUnder(relative);
        return entry.isFile() && /\.(json|astro|tsx?|jsx?)$/.test(entry.name) ? [relative] : [];
    });
}
function titles(source: string): string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
function hasId(title: string, id: string): boolean {
    return new RegExp(`${id}(?![0-9])`).test(title);
}
function jobBlock(source: string, job: string): string {
    const lines = source.split('\n');
    const start = lines.indexOf(`  ${job}:`);
    if (start < 0) return '';
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}
function runs(block: string): string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}
function measuredTouches(): { file: string; pr: string }[] {
    return MERGES.flatMap(([pr, sha]) => {
        const output = execFileSync(
            'git',
            ['diff-tree', '--no-commit-id', '--name-only', '-r', `${sha}^1`, sha],
            { cwd: root, encoding: 'utf8' }
        );
        return output
            .trim()
            .split('\n')
            .filter((file) => OWNED_PATHS.has(file))
            .map((file) => ({ file, pr }));
    });
}

// TEST:B8b:23: static part of the B8b exit; the DB and real integration tests run separately.
describe('AC:B8b:23 - B8b exit: LISTA:B8b evidence in the tree, G-R1-C wired, AU gone, e2e in P0, suite collected (HOS-1581)', () => {
    it('maps LISTA:B8 clauses 1-7 and 9 to titled evidence, without repetition', () => {
        expect(B8_MAP.map(({ clause }) => clause)).toEqual(B8_TO_B8B);
        const missing = B8_MAP.flatMap(({ file, tests }) => {
            const fileTitles = exists(file) ? titles(read(file)) : [];
            return tests.some((id) => fileTitles.some((title) => hasId(title, id))) ? [] : [file];
        });
        expect(missing).toEqual([]);
        // Clause 6 and 9 each need two evidence files for their two distinct effects.
        for (const [file, id] of [
            [
                'packages/service-core/test/integration/services/subscription-succession-dies-alone.test.ts',
                'TEST:B8b:11'
            ],
            [
                'packages/service-core/test/integration/services/subscription-succession-close-s18.test.ts',
                'TEST:B8b:10'
            ],
            [
                'packages/service-core/test/integration/services/subscription-cancel-paused-s22.test.ts',
                'TEST:B8b:5'
            ],
            [
                'packages/service-core/test/integration/services/subscription-cancel-active-credit.test.ts',
                'TEST:B8a:4'
            ]
        ])
            expect(titles(read(file)).some((title) => hasId(title, id))).toBe(true);
    });
    it('finds TEST:B8b:1..27 in test titles and declares exactly the courtesy deferral', () => {
        const roots = [
            'packages/service-core/test',
            'packages/db/test',
            'apps/api/test',
            'apps/e2e/tests',
            'scripts/__tests__'
        ];
        const treeTitles = roots
            .flatMap(filesUnder)
            .filter((file) => path.join(root, file) !== self)
            .flatMap((file) => titles(read(file)));
        const missing = Array.from({ length: 27 }, (_, i) => `TEST:B8b:${i + 1}`).filter(
            (id) => !treeTitles.some((title) => hasId(title, id))
        );
        expect(missing).toEqual([]);
        expect(DEFERRED).toEqual({
            tests: ['TEST:B8b:25 (cortesía)'],
            issue: 'HOS-1590',
            phase: 'fase-2'
        });
    });
    it('wires G-R1-C and additive migrations into package scripts and the guards job', () => {
        const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
            .scripts;
        const guards = jobBlock(read('.github/workflows/ci.yml'), 'guards');
        expect(scripts['check:succession-close']).toBe('tsx scripts/check-succession-close.ts');
        expect(scripts['check:guards']).toContain('pnpm check:succession-close');
        expect(runs(guards)).toContain('pnpm check:succession-close');
        expect(runs(guards)).toContain('pnpm check:additive-migrations');
    });
    it('finds zero AU keys or unavailable-plan text in locales and web source', () => {
        const localeFiles = readdirSync(path.join(root, 'packages/i18n/src/locales')).flatMap(
            (locale) =>
                readdirSync(path.join(root, 'packages/i18n/src/locales', locale)).map(
                    (name) => `packages/i18n/src/locales/${locale}/${name}`
                )
        );
        const webFiles = sourceFilesUnder('apps/web/src');
        const matches = [...localeFiles, ...webFiles].filter((file) =>
            /planChangeUnavailable|todavía no se puede cambiar/i.test(read(file))
        );
        expect(matches).toEqual([]);
    });
    it('has titled real S18, S31, S38 and S1 integration evidence for AC:B8b:24', () => {
        for (const [file, id] of [
            [
                'packages/service-core/test/integration/services/subscription-succession-close-s18.test.ts',
                'TEST:B8b:10'
            ],
            [
                'packages/service-core/test/integration/services/subscription-successor-cut-s31.test.ts',
                'TEST:B8b:13'
            ],
            [
                'apps/api/test/integration/billing-subscription/scheduled-change-real-applier-wiring.test.ts',
                'TEST:B8b:24'
            ],
            [
                'apps/api/test/integration/billing-subscription/plan-change-route-succession.test.ts',
                'TEST:B8b:24'
            ]
        ])
            expect(titles(read(file)).some((title) => hasId(title, id))).toBe(true);
    });
    it('declares every measured B3/B5/B7/B8a touch with PR and decision (D-1)', () => {
        const actual = measuredTouches()
            .map(({ file, pr }) => `${pr}:${file}`)
            .sort();
        const declared = DECLARED_TOUCHES.map(({ file, pr, decision }) => {
            expect(decision.length).toBeGreaterThan(0);
            return `${pr}:${file}`;
        }).sort();
        expect(declared).toEqual(actual);
    });
    it('puts both TEST:B8b:26 specs in P0 on epic branches', () => {
        for (const file of [
            'apps/e2e/tests/billing/billing-21-plan-change-end-to-end.spec.ts',
            'apps/e2e/tests/billing/billing-22-pause-end-to-end.spec.ts'
        ]) {
            expect(exists(file)).toBe(true);
            expect(
                titles(read(file)).some(
                    (title) => title.includes('TEST:B8b:26') && title.includes('@p0')
                )
            ).toBe(true);
        }
        const workflow = read('.github/workflows/e2e-pr.yml');
        expect(workflow).toContain("- 'epic/**'");
        expect(runs(workflow)).toContain('pnpm --filter hospeda-e2e e2e:test:p0');
    });
    it('names TEST:B8b:23 from-empty and collects every B8b integration file', () => {
        expect(exists(FROM_EMPTY.file)).toBe(true);
        expect(titles(read(FROM_EMPTY.file)).some((title) => hasId(title, FROM_EMPTY.test))).toBe(
            true
        );
        expect(read('packages/db/vitest.config.integration.ts')).toContain(
            "'test/integration/**/*.test.ts'"
        );
        expect(read('packages/service-core/vitest.integration.config.ts')).toContain(
            "'test/integration/services/**/*.test.ts'"
        );
        const api = apiIntegrationCollection({ target: 'test/integration/billing-subscription' });
        expect(api.collected.length).toBeGreaterThan(0);
        expect(api.excluded).toEqual([]);
        const ci = read('.github/workflows/ci.yml');
        expect(integrationJobRunsBothSuites({ runs: runs(jobBlock(ci, 'test-integration')) })).toBe(
            true
        );
    });
});
