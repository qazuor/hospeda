/**
 * @fileoverview
 * TEST:V1:8 (AC:V1:5): GUARD:G1 is green over the branch and red on purpose:
 * (1) `x === 'gastronomy' ? A : B` added to shared code; (2) a vertical named
 * without its Axis-2 item (no activation-event entry). And
 * `check-no-binary-vertical-ternary.sh`, which G1 retires, is gone from the
 * repository, `package.json` and `ci.yml`.
 *
 * Carried over from the retired guard's test (TEST:U1:17, HOS-1419): the two
 * guards U1 deleted (`check-product-domain-vocabulary`,
 * `check-product-domain-raw-sql`) stay gone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '../../packages/schemas/src/catalog/vertical-activation-event.js';
import { findBinaryVerticalTernaries, RULE_MESSAGES, run } from '../check-vertical-axis-items.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g1-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

const SWITCH = `export function segment(v: string) {
    switch (v) {
        case 'gastronomy':
            return 'gastronomies';
        case 'experience':
            return 'experiences';
        default:
            throw new Error(\`unknown vertical \${v}\`);
    }
}
`;

/** A green tree: an exhaustive switch in shared code. */
const GREEN = { 'packages/shared/src/segment.ts': SWITCH, 'apps/api/src/index.ts': SWITCH };

function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('TEST:V1:8 — GUARD:G1', () => {
    it('is green over the branch', () => {
        const result = run();

        expect(result.output).toContain('OK: every vertical declares its activation event');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree with an exhaustive switch', () => {
        expect(guardOver().exitCode).toBe(0);
    });

    describe('mutation (1): a binary vertical ternary in shared code is red', () => {
        it.each([
            [
                'packages/shared/src/x.ts',
                "export const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
            ],
            [
                'apps/api/src/x.ts',
                "export const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
            ],
            [
                'packages/shared/src/x.ts',
                "export const f = (v: string) => (v !== 'experience' ? 1 : 2);\n"
            ],
            [
                'packages/shared/src/x.ts',
                'export const f = (v: string) => ("gastronomy" === v ? 1 : 2);\n'
            ],
            [
                'packages/shared/src/x.ts',
                "export const f = (v: string) =>\n    v === 'gastronomy'\n        ? 'gastronomies'\n        : 'experiences';\n"
            ]
        ])('%s: %s', (file, source) => {
            const result = guardOver({ overrides: { [file]: source } });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(`FAIL ${RULE_MESSAGES['G1(b)']}`);
            expect(result.output).toContain(`${file}:`);
            expect(result.output).not.toContain('FAIL G1(a)');
        });

        it('reports the line of the comparison', () => {
            const violations = findBinaryVerticalTernaries({
                file: 'x.ts',
                source: "const a = 1;\n\nexport const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
            });

            expect(violations.map((v) => v.line)).toEqual([3]);
        });
    });

    describe('what predicate (b) deliberately does not flag', () => {
        it.each([
            [
                'a test file',
                'packages/shared/src/x.test.ts',
                "const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
            ],
            [
                'a comment',
                'packages/shared/src/x.ts',
                "// v === 'gastronomy' ? A : B was HOS-1079\nexport const y = 1;\n"
            ],
            [
                'optional chaining',
                'packages/shared/src/x.ts',
                "export const f = (v: string, o?: { a: 1 }) => v === 'gastronomy' && o?.a;\n"
            ],
            [
                'nullish coalescing',
                'packages/shared/src/x.ts',
                "export const f = (v: string, o?: number) => (v === 'gastronomy') ?? o;\n"
            ],
            [
                'an if/return chain',
                'packages/shared/src/x.ts',
                "export function f(v: string) {\n    if (v === 'gastronomy') { return 1; }\n    return 2;\n}\n"
            ],
            [
                'code outside apps/api/src and packages/*/src',
                'apps/web/src/x.ts',
                "export const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
            ]
        ])('%s', (_label, file, source) => {
            expect(guardOver({ overrides: { [file]: source } }).exitCode).toBe(0);
        });
    });

    describe('mutation (2): a vertical named without its Axis-2 item is red', () => {
        it('red when a vertical has no activation-event entry', () => {
            const { partner: _dropped, ...withoutPartner } = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL;

            const result = run({
                root: makeTree({ files: GREEN }),
                minScannedFiles: 0,
                activationByVertical: withoutPartner
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(`FAIL ${RULE_MESSAGES['G1(a)']}`);
            expect(result.output).toContain("vertical 'partner' has no activation-event entry");
        });

        it('red when a new vertical is added to the enum without its entry', () => {
            const result = run({
                root: makeTree({ files: GREEN }),
                minScannedFiles: 0,
                verticals: [...Object.keys(VERTICAL_ACTIVATION_EVENT_BY_VERTICAL), 'wellness']
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain("vertical 'wellness' has no activation-event entry");
        });

        it('red when an entry is outside the closed event catalog, or names no vertical', () => {
            const result = run({
                root: makeTree({ files: GREEN }),
                minScannedFiles: 0,
                activationByVertical: {
                    ...VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
                    partner: 'user_signed_up',
                    addon: null
                }
            });

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain(
                'vertical \'partner\' declares "user_signed_up", outside the catalog'
            );
            expect(result.output).toContain("the map has an entry for 'addon'");
        });

        it('green when a vertical declares null (no trial, fails closed)', () => {
            const result = run({
                root: makeTree({ files: GREEN }),
                minScannedFiles: 0,
                activationByVertical: { ...VERTICAL_ACTIVATION_EVENT_BY_VERTICAL, tourist: null }
            });

            expect(result.exitCode).toBe(0);
        });
    });

    it('refuses a scan too small to be trusted', () => {
        const result = run({ root: makeTree({ files: GREEN }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('this is not a clean tree');
    });
});

describe('retired guards stay gone', () => {
    const pkg = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

    it('check-no-binary-vertical-ternary (retired by G1) is out of the tree, package.json and ci.yml', () => {
        const name = 'check-no-binary-vertical-ternary';

        expect(existsSync(path.join(REPO_ROOT, `scripts/${name}.sh`))).toBe(false);
        expect(existsSync(path.join(REPO_ROOT, `scripts/__tests__/${name}.test.ts`))).toBe(false);
        expect(pkg).not.toContain('no-binary-vertical-ternary');
        expect(ci).not.toContain('no-binary-vertical-ternary');
    });

    it('G1 runs as its own step of the guards job and inside check:guards', () => {
        const scripts = JSON.parse(pkg).scripts as Record<string, string>;

        expect(scripts['check:vertical-axis-items']).toBe(
            'tsx scripts/check-vertical-axis-items.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:vertical-axis-items');
        expect(ci).toMatch(/run: pnpm check:vertical-axis-items/);
    });

    it.each([
        'check-product-domain-vocabulary',
        'check-product-domain-raw-sql'
    ])('%s (deleted by U1) has no script and is absent from package.json and ci.yml', (name) => {
        expect(existsSync(path.join(REPO_ROOT, `scripts/${name}.sh`))).toBe(false);
        expect(pkg).not.toContain(name);
        expect(ci).not.toContain(name);
    });
});
