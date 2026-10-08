/**
 * @fileoverview
 * TEST:B1:9 (AC:B1:9, DEC-TEST-003): GUARD:G15, its two predicates, by mutation.
 *
 * Each case builds a throwaway git tree holding a green fake (a closed list, a
 * fake telling two of its lies in one place each) and a green test (turning a
 * lie off by name and with why), applies ONE mutation and runs the guard over
 * it. The spec's mutations turn it red with the message of their predicate:
 * (a) a lie added to the fake without its row, and, apart, a row losing its
 * defense test; (b) a test turning M1 off without naming it. The real tree is
 * green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    checkLieRows,
    FAKE_LISTS_FILE,
    MIN_SCANNED_FILES,
    PREDICATE_MESSAGES,
    RUNTIME_CHECK_TEST,
    run
} from '../check-fake-lies.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FAKE = 'packages/payments/src/fake/fake-provider.ts';
const A_TEST = 'apps/api/test/billing/checkout.test.ts';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g15-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A whole lie row. */
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: `lie ${id}`,
    does: 'what it does',
    measured: [{ row: 'EX-1', date: '2026-09-15', accounts: ['sandbox'] }],
    defenseTest: 'TEST:B3:6',
    ...overrides
});

const listOf = (rows: readonly unknown[]) =>
    JSON.stringify({ lies: rows, rules: [], simulations: [] });

/** The fake, telling the lies it is given, one call each. */
const fake = ({ lies = ['M1', 'M3'] }: { readonly lies?: readonly string[] } = {}) =>
    `export class Fake {
    private lying(args: { readonly lie: string }): boolean { return true; }
${lies.map((lie, i) => `    m${i}() { return this.lying({ lie: '${lie}' }); }`).join('\n')}
}
`;

/** A test building the fake with `options`. */
const aTest = ({ options }: { readonly options: string }) =>
    `const fake = new FakePaymentProvider({ clock, ${options} });\n`;

const GREEN: Readonly<Record<string, string>> = {
    [FAKE_LISTS_FILE]: listOf([row('M1'), row('M2'), row('M3')]),
    [FAKE]: fake(),
    // A file with lie ids in its comments only: comments are not code.
    'packages/payments/src/fake/notes.ts': "// M1 and 'M2' are told elsewhere\nexport {};\n",
    [A_TEST]: aTest({ options: "honestAbout: [{ lie: 'M1', why: 'the honest path' }]" }),
    // The runtime twin's own test writes the refusals; (b) does not read it.
    [RUNTIME_CHECK_TEST]: aTest({ options: "honestAbout: [{ lie: 'M99' }]" })
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('G15 over a green tree', () => {
    it('passes: every lie told is listed whole, every lie turned off is named with why', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:9 predicate (a): the spec mutations turn G15 red', () => {
    it('a lie added to the fake without its row fails, naming predicate (a)', () => {
        const { exitCode, output } = guardOver({
            overrides: { [FAKE]: fake({ lies: ['M1', 'M3', 'M14'] }) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(PREDICATE_MESSAGES.a);
        expect(output).not.toContain(PREDICATE_MESSAGES.b);
        expect(output).toContain(`${FAKE}:5  tells 'M14', which is not in the list`);
    });

    it('a row without its defense test fails, naming predicate (a)', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                [FAKE_LISTS_FILE]: listOf([
                    row('M1', { defenseTest: undefined }),
                    row('M2'),
                    row('M3')
                ])
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(PREDICATE_MESSAGES.a);
        expect(output).toContain('M1: no test proving our code resists it');
    });
});

describe('G15 predicate (a): every other way to break it', () => {
    it.each([
        ['no name', { name: ' ' }, 'M2: no name'],
        ['no measurement', { measured: [] }, 'M2: no matrix row with its date and account'],
        [
            'a measurement without its date',
            { measured: [{ row: 'EX-1', accounts: ['sandbox'] }] },
            'M2: no matrix row with its date and account'
        ],
        [
            'a measurement without its account',
            { measured: [{ row: 'EX-1', date: '2026-09-15', accounts: [] }] },
            'M2: no matrix row with its date and account'
        ],
        ['a defense that is not a test id', { defenseTest: 'B6' }, 'M2: no test proving']
    ])('a row with %s fails', (_case, overrides, detail) => {
        const { exitCode, output } = guardOver({
            overrides: { [FAKE_LISTS_FILE]: listOf([row('M1'), row('M2', overrides), row('M3')]) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(detail);
    });

    it('the same lie told in two places fails', () => {
        const { exitCode, output } = guardOver({
            overrides: { [FAKE]: fake({ lies: ['M1', 'M3', 'M1'] }) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain("'M1' is told in 2 places; a lie lives in one");
    });

    it('a lie told without its name as a literal fails', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/payments/src/fake/other.ts':
                    'export const f = (id: string, x: X) => x.lying({ lie: id });\n'
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('a lie told without its name as a literal');
    });

    it('a lie id named in the fake outside a lying call fails', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/payments/src/fake/other.ts':
                    "export const sneaky = (honest: Set<string>) => !honest.has('M2');\n"
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain("names the lie 'M2' outside a lying({ lie }) call");
    });

    it('a missing or broken list fails', () => {
        const broken = guardOver({ overrides: { [FAKE_LISTS_FILE]: '{ not json' } });
        expect(broken.exitCode).toBe(1);
        expect(broken.output).toContain('the list has no `lies` array');
    });
});

describe('TEST:B1:9 predicate (b): the spec mutation turns G15 red', () => {
    it('a test turning M1 off without naming it fails, naming predicate (b)', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                [A_TEST]: aTest({ options: "honestAbout: [{ why: 'the honest path' }]" })
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(PREDICATE_MESSAGES.b);
        expect(output).not.toContain(PREDICATE_MESSAGES.a);
        expect(output).toContain(`${A_TEST}:1  an entry does not name its lie and its reason`);
    });
});

describe('G15 predicate (b): every other way to break it', () => {
    it.each([
        ['without saying why', "honestAbout: [{ lie: 'M1' }]", 'an entry does not name'],
        [
            'with a blank reason',
            "honestAbout: [{ lie: 'M1', why: '  ' }]",
            "turns off 'M1' without saying why"
        ],
        [
            'a lie not in the list',
            "honestAbout: [{ lie: 'M14', why: 'x' }]",
            "turns off 'M14', which is not a lie"
        ],
        [
            'the lie from a variable',
            "honestAbout: [{ lie: id, why: 'x' }]",
            'an entry does not name'
        ],
        ['the list from a variable', 'honestAbout: offList', 'not an array literal'],
        [
            'a spread entry',
            "honestAbout: [...all, { lie: 'M1', why: 'x' }]",
            'not an object literal'
        ],
        [
            'an extra key',
            "honestAbout: [{ lie: 'M1', why: 'x', also: 'M2' }]",
            'an entry does not name'
        ],
        ['a shorthand property', 'honestAbout', 'not an array literal']
    ])('turning a lie off %s fails', (_case, options, detail) => {
        const { exitCode, output } = guardOver({ overrides: { [A_TEST]: aTest({ options }) } });
        expect(exitCode).toBe(1);
        expect(output).toContain(PREDICATE_MESSAGES.b);
        expect(output).toContain(detail);
    });

    it.each([
        ['a sibling test of the runtime twin', 'packages/payments/test/fake-lies.test.ts'],
        [
            'the runtime twin under another extension',
            'packages/payments/test/fake-switches.test.tsx'
        ]
    ])('reads %s: only the exact runtime-twin path is skipped', (_case, file) => {
        const { exitCode, output } = guardOver({
            overrides: { [file]: aTest({ options: "honestAbout: [{ lie: 'M99' }]" }) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(PREDICATE_MESSAGES.b);
        expect(output).toContain(`${file}:1`);
    });

    it('reads production code too, not only tests', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'apps/api/src/dev/fake.ts': aTest({ options: "honestAbout: [{ lie: 'M1' }]" })
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('apps/api/src/dev/fake.ts:1');
    });

    it('accepts several lies, each named with why', () => {
        const { exitCode } = guardOver({
            overrides: {
                [A_TEST]: aTest({
                    options:
                        "honestAbout: [\n{ lie: 'M1', why: 'one' },\n{ why: \"two\", lie: 'M3' },\n]"
                })
            }
        });
        expect(exitCode).toBe(0);
    });
});

describe('the list predicate, unit by unit', () => {
    it('reads the ids of a whole list', () => {
        expect(checkLieRows({ raw: JSON.parse(listOf([row('M1'), row('M2')])) })).toEqual({
            ids: ['M1', 'M2'],
            violations: []
        });
    });
});

describe('G15 cannot pass vacuously', () => {
    it('fails when fewer files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: GREEN }) });
        expect(MIN_SCANNED_FILES).toBe(1000);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not a clean tree');
    });

    it('fails when the fake or its list is missing', () => {
        const { [FAKE_LISTS_FILE]: _list, ...withoutList } = GREEN;
        const result = run({ root: makeTree({ files: withoutList }), minScannedFiles: 0 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('list missing');
    });

    it('is green over this repository', { timeout: 30_000 }, () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});

describe('G15 wiring', () => {
    const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
        readonly scripts: Readonly<Record<string, string>>;
    };
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8').split('\n');
    const start = ci.indexOf('  guards:');
    const end = ci.findIndex(
        (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
    );
    const guardsJob = start === -1 ? '' : ci.slice(start, end === -1 ? undefined : end).join('\n');

    it('has its own script and closes pnpm check:guards', () => {
        expect(rootPkg.scripts['check:fake-lies']).toBe('tsx scripts/check-fake-lies.ts');
        const chain = (rootPkg.scripts['check:guards'] ?? '').split('&&').map((s) => s.trim());
        expect(chain.at(-1)).toBe('pnpm check:fake-lies');
    });

    it('is a step of the guards job of ci.yml, right after G17', () => {
        expect(guardsJob).toMatch(/^\s+run: pnpm check:fake-lies\s*$/m);
        expect(guardsJob.indexOf('run: pnpm check:fake-lies')).toBeGreaterThan(
            guardsJob.indexOf('run: pnpm check:decision-rereads-by-id')
        );
    });
});
