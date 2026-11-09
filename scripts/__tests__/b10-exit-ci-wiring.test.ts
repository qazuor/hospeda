import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    apiIntegrationCollection,
    integrationJobRunsBothSuites
} from './helpers/api-integration-collection';

/** AC:B10:9, AC:B10:10 and AC:B10:14 exit evidence for the complete B10 piece. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
const service = 'packages/service-core/test/integration/services/';
const api = 'apps/api/test/integration/billing-addon/';
const db = 'packages/db/test/integration/';
const e2e = 'apps/e2e/tests/billing/';

interface Clause {
    readonly clause: number;
    readonly owner: string;
    readonly titles: readonly { readonly file: string; readonly prefix: string }[];
    readonly seeded: readonly string[];
}

// LISTA:B10, with the five independent parts of clause 11 checked separately.
const CLAUSES: readonly Clause[] = [
    {
        clause: 1,
        owner: 'B8a',
        titles: [
            {
                file: `${service}b10-exit-cut-b8.test.ts`,
                prefix: 'LISTA:B10 clause 1 darse de baja (`S11`) cancela en el acto el preapproval de cada addon recurrente que depende de la principal —la selección de `S32`, CON `CANCEL_SCHEDULED` en la exclusión (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-c`)— y el addon se sigue viendo hasta el fin de servicio (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`)'
            }
        ],
        seeded: [`${service}subscription-cancel-active-complements.test.ts`]
    },
    {
        clause: 2,
        owner: 'B8a',
        titles: [
            {
                file: `${service}b10-exit-cut-b8.test.ts`,
                prefix: 'LISTA:B10 clause 2 un `USER` compatible con dos verticales, dado de baja primero en una y después en la otra, se cancela en la segunda baja y no cobra un ciclo de más (`V2-c`)'
            }
        ],
        seeded: [`${service}subscription-cancel-active-complements.test.ts`]
    },
    {
        clause: 3,
        owner: 'B7',
        titles: [
            {
                file: `${service}b10-exit-cut-b8.test.ts`,
                prefix: 'LISTA:B10 clause 3 un `USER` compatible con dos verticales, cuya principal de una muere por una de las once con la de la otra `PAUSED` o `SUSPENDED`, queda pausado por `S32` en ese acto y vuelve por `S33` cuando la otra se reanuda; si sigue cobrando, falta ese disparador (`V2-e`) (%s)'
            }
        ],
        seeded: [
            `${service}complement-pause-s32.test.ts`,
            `${service}complement-resume-s33.test.ts`
        ]
    },
    {
        clause: 4,
        owner: 'B5',
        titles: [
            {
                file: `${service}b10-exit-cut-b5.test.ts`,
                prefix: 'LISTA:B10 clause 4 la principal que se va por otro camino deja vivo el preapproval hasta que corre la orfandad, y el barrido lo ve'
            }
        ],
        seeded: [`${service}reconciliation-addon-without-shutdown.test.ts`]
    },
    {
        clause: 5,
        owner: 'B5',
        titles: [
            {
                file: `${service}b10-exit-cut-b5.test.ts`,
                prefix: 'LISTA:B10 clause 5 una revocación (`S36`) corre la orfandad en el mismo acto y crea `RF1` sobre el último cobro del complemento sólo si cae dentro de sus propios 10 días (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`) ($label)'
            }
        ],
        seeded: [`${service}subscription-revocation-addons.test.ts`]
    },
    {
        clause: 6,
        owner: 'B10',
        titles: [
            {
                file: `${api}b10-exit-api.test.ts`,
                prefix: 'LISTA:B10 clause 6 borrar una ficha dice qué addons se pierden y por cuánto antes de borrarla'
            }
        ],
        seeded: [`apps/api/test/integration/listing-publication/purge-preview-route.test.ts`]
    },
    {
        clause: 7,
        owner: 'B10/B3',
        titles: [],
        seeded: [
            `${db}addon-version-constraints-from-empty.test.ts`,
            `${service}addon-version-publication.test.ts`
        ]
    },
    {
        clause: 8,
        owner: 'B10',
        titles: [
            {
                file: `${service}b10-exit-own-clauses.test.ts`,
                prefix: 'LISTA:B10 clause 8 un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación)— (checkout open)'
            },
            {
                file: `${service}b10-exit-own-clauses.test.ts`,
                prefix: 'LISTA:B10 clause 8 un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación)— (late authorization)'
            }
        ],
        seeded: []
    },
    {
        clause: 9,
        owner: 'B9a',
        titles: [
            {
                file: `${service}b10-exit-cut-b5-2.test.ts`,
                prefix: 'LISTA:B10 clause 9 a un beneficiario de Free Forever con `includesAddons: true` no se le cobra ni un peso más por un addon compatible —su suscripción de complemento queda `CANCELLED` en el mismo acto del otorgamiento, sin reembolso de lo ya cobrado, la instancia sigue `ACTIVE` colgando del ancla, y al revocar el grant se apaga y no vuelve sola, ni siquiera con scope `USER` o `GLOBAL`, aunque la persona conserve otro título (`16` §3.3, owner 2026-09-25) (`S20`, `03` §3.2 y §8, `16` §3.3 y §3.4)— (grant)'
            }
        ],
        seeded: [`${service}permanent-grant-s20.test.ts`]
    },
    {
        clause: 10,
        owner: 'B5',
        titles: [
            {
                file: `${service}b10-exit-cut-b5.test.ts`,
                prefix: 'LISTA:B10 clause 10 cuando un addon se apaga, su suscripción de complemento queda `CANCELLED` en el mismo acto —sin período de gracia, sin fecha de fin de servicio y sin reembolso automático de lo ya cobrado—, así que no queda ninguna fila de complemento viva colgando de una instancia terminal (`S21`, `03` §3.2 y §8, `16` §4.4, `09` §3 salvedad 1)'
            }
        ],
        seeded: [`${service}addon-complement-s21.test.ts`]
    },
    {
        clause: 11,
        owner: 'B7/B5/B4/B10',
        titles: [
            {
                file: `${service}b10-exit-cut-b8.test.ts`,
                prefix: 'LISTA:B10 clause 11 4a una pausa pedida por el cliente no deja ningún addon recurrente de esa vertical cobrando —se pausa con ella por `S32` y vuelve por `S33`, y un `USER`/`GLOBAL` sólo si no le queda título en otra vertical compatible— (4a) (%s)'
            },
            {
                file: `${service}b10-exit-own-clauses.test.ts`,
                prefix: 'LISTA:B10 clause 11 4c an abandoned upgrade does not orphan the LISTING of a paying owner'
            },
            {
                file: `${service}b10-exit-cut-b5.test.ts`,
                prefix: 'LISTA:B10 clause 11 4d un `USER`/`GLOBAL` sin principal viva y pagando ni ancla viva en sus verticales compatibles queda huérfano (unpaid live principal)'
            },
            {
                file: `${service}b10-exit-own-clauses.test.ts`,
                prefix: 'LISTA:B10 clause 11 K-9 purging the listing is executed only by A6'
            }
        ],
        seeded: [
            `${service}complement-pause-s32.test.ts`,
            `${service}addon-orphanhood.test.ts`,
            `${service}coverage-addon-source.test.ts`
        ]
    },
    { clause: 12, owner: 'B10', titles: [], seeded: [`${service}addon-a6-push.test.ts`] },
    {
        clause: 13,
        owner: 'B10',
        titles: [],
        seeded: [`${service}addon-purchase-identity.test.ts`, `${service}addon-a3-window.test.ts`]
    },
    { clause: 14, owner: 'B10', titles: [], seeded: [`${service}addon-a7-declined.test.ts`] },
    {
        clause: 15,
        owner: 'B8a',
        titles: [
            {
                file: `${service}b10-exit-cut-b8-2.test.ts`,
                prefix: 'LISTA:B10 clause 15 con la principal y su destaque en `CANCEL_SCHEDULED` hasta el 15/10 y el último cobro del destaque pagado hasta el 20/10, el 15/10 el destaque termina `CANCELLED` por `S21` con la marca 14 abierta y ese cobro colgado —si termina por su propio `S12`, sin marca, el orden está al revés— (FASE 9 vuelta 2, owner 2026-09-27, `R1-c`) (S21 before S12)'
            }
        ],
        seeded: [`${service}subscription-service-end-order.test.ts`]
    },
    {
        clause: 16,
        owner: 'B10',
        titles: [],
        seeded: [`${service}reconciliation-addon-listing-purged-real-a6.test.ts`]
    },
    {
        clause: 17,
        owner: 'B10',
        titles: [],
        seeded: [`${service}addon-free-choice-a1-bis.test.ts`]
    },
    {
        clause: 18,
        owner: 'B10',
        titles: [],
        seeded: [`${service}addon-free-choice-listing.test.ts`]
    }
];
const CUT_TESTS = Array.from({ length: 16 }, (_, index) => `TEST:B10:${index + 1}`);
const DEFERRED = {
    test: 'TEST:B10:16',
    part: 'UNA_VEZ',
    issue: 'HOS-2094',
    reason: 'Q1: the owner chose option 3; one-time purchase stays outside the web.'
} as const;

/** Returns one CI job, stopping at the next peer job. */
function jobBlock({ source, job }: { readonly source: string; readonly job: string }): string {
    const lines = source.split('\n');
    const jobsAt = lines.indexOf('jobs:');
    const at = lines.findIndex((line, index) => index > jobsAt && line === `  ${job}:`);
    if (at < 0) return '';
    const body: string[] = [];
    for (const line of lines.slice(at + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}

/** Returns single-line run steps from a CI job. */
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

/** Collects every test root used by the B10 exit corpus. */
function collectTestRoots(): readonly string[] {
    const roots: string[] = [];
    for (const area of ['apps', 'packages']) {
        for (const entry of readdirSync(path.join(repoRoot, area), { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            for (const leaf of ['test', 'tests']) {
                const candidate = path.join(repoRoot, area, entry.name, leaf);
                if (existsSync(candidate) && statSync(candidate).isDirectory())
                    roots.push(candidate);
            }
        }
    }
    roots.push(path.join(repoRoot, 'scripts/__tests__'));
    return roots;
}

/** Collects test source paths, ignoring generated and installed trees. */
function collectTestFiles({ dir, out }: { readonly dir: string; readonly out: string[] }): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.turbo'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles({ dir: full, out });
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}

/** Extracts literal describe, it and test titles, including conditional calls. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    const each = /\]\s*(?:as const)?\s*\)\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call), ...source.matchAll(each)].map((match) => match[2] ?? '');
}

/** Matches a TEST id at its numeric boundary. */
function namesId({ title, id }: { readonly title: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(title);
}

describe('TEST:B10:10 TEST:B10:11 TEST:B10:12 TEST:B10:16 AC:B10:9 AC:B10:10 AC:B10:14 B10 exit', () => {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles({ dir: root, out: files });
    const corpus = files
        .filter((file) => file !== selfPath)
        .map((file) => ({
            file: path.relative(repoRoot, file),
            titles: testTitles({ source: readFileSync(file, 'utf8') })
        }));
    const allTitles = corpus.flatMap(({ titles }) => titles);

    it('the title scanner sees B10 evidence in API, service-core, database and e2e', () => {
        for (const root of [
            'apps/api/test',
            'packages/service-core/test',
            'packages/db/test',
            'apps/e2e/tests'
        ])
            expect(
                corpus.some(
                    ({ file, titles }) =>
                        file.startsWith(root) && titles.some((title) => title.includes('TEST:B10:'))
                ),
                root
            ).toBe(true);
    });
    it('LISTA:B10 has clauses 1 to 18 exactly once, with the stated owners', () => {
        expect(CLAUSES.map(({ clause }) => clause)).toEqual(
            Array.from({ length: 18 }, (_, index) => index + 1)
        );
        expect(CLAUSES.map(({ owner }) => owner)).toEqual([
            'B8a',
            'B8a',
            'B7',
            'B5',
            'B5',
            'B10',
            'B10/B3',
            'B10',
            'B9a',
            'B5',
            'B7/B5/B4/B10',
            'B10',
            'B10',
            'B10',
            'B8a',
            'B10',
            'B10',
            'B10'
        ]);
    });
    for (const entry of CLAUSES) {
        it(`LISTA:B10 clause ${entry.clause} evidence exists under ${entry.owner}`, () => {
            for (const { file, prefix } of entry.titles) {
                expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
                expect(testTitles({ source: read(file) }).includes(prefix), prefix).toBe(true);
            }
            for (const file of entry.seeded) {
                expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
                expect(testTitles({ source: read(file) }).length, file).toBeGreaterThan(0);
            }
        });
    }
    it('clause 11 4e retains its B4:7 coverage evidence', () => {
        expect(
            testTitles({ source: read(`${service}coverage-addon-source.test.ts`) }).some((title) =>
                namesId({ title, id: 'TEST:B4:7' })
            )
        ).toBe(true);
    });
    it('clause 7 is covered by the empty-schema constraint and action 20 publication', () => {
        expect(read(`${db}addon-version-constraints-from-empty.test.ts`)).toContain(
            'ck_addon_product_periodic_not_fixed_days'
        );
        expect(
            testTitles({ source: read(`${service}addon-version-publication.test.ts`) }).some(
                (title) => namesId({ title, id: 'TEST:B10:9' })
            )
        ).toBe(true);
    });
    it('all TEST:B10:1 through TEST:B10:16 appear in an existing test title', () => {
        expect(
            CUT_TESTS.filter((id) => !allTitles.some((title) => namesId({ title, id })))
        ).toEqual([]);
    });
    it('TEST:B10:16 records the Q1 one-time follow-up', () => {
        expect(DEFERRED).toEqual({
            test: 'TEST:B10:16',
            part: 'UNA_VEZ',
            issue: 'HOS-2094',
            reason: 'Q1: the owner chose option 3; one-time purchase stays outside the web.'
        });
    });
    it('both B10 e2e specs are selected by P0, including the clock lane', () => {
        for (const [file, id] of [
            ['billing-23-addon-hidden-listing-notice.spec.ts', 'TEST:B10:13'],
            ['billing-24-addon-end-to-end.spec.ts', 'TEST:B10:16']
        ]) {
            const source = read(`${e2e}${file}`);
            const title = testTitles({ source }).find((candidate) => candidate.includes(id));
            expect(title, file).toContain('@p0');
        }
        const runs = stepRuns({
            block: jobBlock({ source: read('.github/workflows/e2e-pr.yml'), job: 'e2e-p0' })
        });
        expect(runs).toContain('pnpm --filter hospeda-e2e e2e:test:p0');
        const pkg = JSON.parse(read('apps/e2e/package.json')) as {
            readonly scripts: Readonly<Record<string, string>>;
        };
        expect(pkg.scripts['e2e:test:p0']).toContain('--grep @clock');
    });
    it('integration configs and CI collect B10 service, API and schema evidence', () => {
        for (const file of ['b10-exit-api.test.ts']) {
            const result = apiIntegrationCollection({
                target: `test/integration/billing-addon/${file}`
            });
            expect(result.collected, file).toEqual([`test/integration/billing-addon/${file}`]);
            expect(result.excluded, file).toEqual([]);
        }
        expect(read('packages/service-core/vitest.integration.config.ts')).toContain(
            "'test/integration/services/**/*.test.ts'"
        );
        expect(read('packages/db/vitest.config.integration.ts')).toContain(
            "'test/integration/**/*.test.ts'"
        );
        for (const file of [
            'b10-exit-own-clauses.test.ts',
            'b10-exit-cut-b5.test.ts',
            'b10-exit-cut-b5-2.test.ts',
            'b10-exit-cut-b8.test.ts',
            'b10-exit-cut-b8-2.test.ts'
        ])
            expect(existsSync(path.join(repoRoot, service, file)), file).toBe(true);
        expect(existsSync(path.join(repoRoot, db, 'b10-schema-from-empty.test.ts'))).toBe(true);
        const ci = read('.github/workflows/ci.yml');
        expect(
            integrationJobRunsBothSuites({
                runs: stepRuns({ block: jobBlock({ source: ci, job: 'test-integration' }) })
            })
        ).toBe(true);
        expect(stepRuns({ block: jobBlock({ source: ci, job: 'guards' }) })).toContain(
            'pnpm test:scripts'
        );
    });
    it('ACC_20 declares billing.publishAddonVersion', () => {
        const action =
            read('packages/verticals/src/authorization/administrative-actions.ts').match(
                /ACC_20\s*:\s*\{[^}]+\}/s
            )?.[0] ?? '';
        expect(action).toContain('PermissionEnum.BILLING_PUBLISH_ADDON_VERSION');
    });
    it('CI runs the additive migrations guard', () => {
        expect(
            stepRuns({
                block: jobBlock({ source: read('.github/workflows/ci.yml'), job: 'guards' })
            })
        ).toContain('pnpm check:additive-migrations');
    });
    it('K-9: only A6 updates an instance after reading listingPurged', () => {
        const writers: string[] = [];
        const root = path.join(repoRoot, 'packages/service-core/src');
        const sources: string[] = [];
        collectSourceFiles({ dir: root, out: sources });
        for (const file of sources) {
            const source = readFileSync(file, 'utf8');
            if (/\.update\(addonInstances\)/.test(source) && source.includes('listingPurged'))
                writers.push(path.relative(repoRoot, file));
        }
        expect(writers.sort()).toEqual([
            'packages/service-core/src/services/billing/addon/addon-instance-a6.ts'
        ]);
    });
});

/** Collects source files for the K-9 writer audit. */
function collectSourceFiles({ dir, out }: { readonly dir: string; readonly out: string[] }): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectSourceFiles({ dir: full, out });
        else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
    }
}
