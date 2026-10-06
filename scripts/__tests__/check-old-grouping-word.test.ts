import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * TEST:U1:8 and TEST:U1:9 (GUARD:G8). Every case runs the real script, or a copy
 * of it with one constant or list entry mutated, inside a throwaway git repo.
 * The retired word is assembled in parts so this file does not trip the guard.
 */
const realScript = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../check-old-grouping-word.sh'
);
const word = 'comm' + 'erce';
const PDR = '.specs/HOS-1352-billing-verticals-redesign/docs/00-PDR.md';
const HISTORY_ENTRIES = '    "$HISTORY_DB"\n    "$HISTORY_SEED"\n';
const EMPTY_LIST = /ALLOWLIST=\(\n[\s\S]*?\n\)/;
let root: string;
let script: string;

function git(...args: string[]): void {
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function tracked(file: string, content: string): void {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    git('add', '--', file);
}

/** Writes a mutated copy of the guard (outside the repo under test) and runs that one. */
function mutateScript(mutate: (source: string) => string): void {
    const source = readFileSync(realScript, 'utf8');
    const mutated = mutate(source);
    expect(mutated).not.toBe(source);
    script = `${root}-guard-copy.sh`;
    writeFileSync(script, mutated);
}

function run(extraEnv: Record<string, string> = {}): { code: number; output: string } {
    try {
        return {
            code: 0,
            output: execFileSync('bash', [script], {
                cwd: root,
                encoding: 'utf8',
                env: { ...process.env, ...extraEnv }
            })
        };
    } catch (error) {
        const failure = error as { status: number | null; stdout: string };
        return { code: failure.status ?? 1, output: failure.stdout };
    }
}

function setup(prefix: string): void {
    root = mkdtempSync(path.join(tmpdir(), prefix));
    script = realScript;
    git('init', '-q');
}

function teardown(): void {
    rmSync(root, { recursive: true, force: true });
    if (script !== realScript) rmSync(script, { force: true });
}

const step6On = (source: string): string => source.replace('STEP6_RULE=off', 'STEP6_RULE=on');
const closureOn = (source: string): string => source.replace('CLOSURE_RULE=off', 'CLOSURE_RULE=on');

describe('TEST:U1:8 whole-repository grouping word guard', () => {
    beforeEach(() => setup('old-grouping-guard-'));
    afterEach(teardown);

    it('is born green on a clean tree', () => {
        tracked('CLAUDE.md', 'Clean guidance\n');
        tracked('apps/api/src/index.ts', 'export const a = 1;\n');
        expect(run().code).toBe(0);
    });

    it('does not contain the word itself', () => {
        expect(readFileSync(realScript, 'utf8').toLowerCase()).not.toContain(word);
    });

    for (const file of [
        'apps/api/src/service.ts',
        'CLAUDE.md',
        'packages/i18n/src/example.ts',
        'docs/guide.md',
        '.specs/HOS-123-example/spec.md',
        '.qtm/example.md'
    ]) {
        it(`mutation 1: the word in ${file} is red and names the file`, () => {
            tracked(file, `retired ${word.toUpperCase()} grouping\n`);
            const result = run();
            expect(result.code).toBe(1);
            expect(result.output).toContain(file);
        });
    }

    it('mutation 1: a file NAME containing the word is red', () => {
        const file = `apps/web/src/Some${word}Thing.ts`;
        tracked(file, 'clean content\n');
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain(file);
    });

    it('mutation 2: a fourth folder in the list is red', () => {
        tracked('CLAUDE.md', 'Clean\n');
        mutateScript((source) =>
            source.replace('    "$PROGRAM_SPECS"\n)', '    "$PROGRAM_SPECS"\n    "apps/legacy/"\n)')
        );
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain('apps/legacy/');
    });

    it('mutation 2: a list of two entries is red while both time rules are off', () => {
        tracked('CLAUDE.md', 'Clean\n');
        mutateScript((source) => source.replace('    "$HISTORY_SEED"\n', ''));
        expect(run().code).toBe(1);
    });

    it('mutation 3: a NEW extra naming the word is red', () => {
        const file = 'packages/db/src/migrations/extras/999-new.sql';
        tracked(file, `-- mentions ${word}\n`);
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain(file);
    });

    it('mutation 3: an extra whose NAME carries the word is red', () => {
        tracked(`packages/db/src/migrations/extras/032-${word}-media.sql`, 'select 1;\n');
        expect(run().code).toBe(1);
    });

    for (const file of [
        '.specs/HOS-123-other-issue/spec.md',
        '.specs/HOS-1351-sibling/spec.md',
        '.qtm/specs/SPEC-1/spec.md'
    ]) {
        it(`mutation 4: ${file} naming the word is red`, () => {
            tracked(file, `${word}\n`);
            const result = run();
            expect(result.code).toBe(1);
            expect(result.output).toContain(file);
        });
    }

    it('mutation 5: the word in the PDR is green', () => {
        tracked(PDR, `${word} was the retired grouping\n`);
        expect(run().code).toBe(0);
    });

    it('the PDR exemption is by exact path: a same-named file elsewhere is red', () => {
        tracked(PDR, word);
        tracked('.specs/HOS-9999-other/docs/00-PDR.md', word);
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain('.specs/HOS-9999-other/docs/00-PDR.md');
        expect(result.output).not.toContain(`${PDR} (`);
    });

    for (const file of [
        `packages/db/src/migrations/0010-${word}-thing.sql`,
        `packages/seed/src/data-migrations/0034-${word}.ts`,
        '.specs/HOS-1352-x/spec.md',
        '.specs/HOS-1353-x/spec.md',
        '.specs/HOS-1354-x/spec.md'
    ]) {
        it(`the allowlist lets ${file} through`, () => {
            tracked(file, word);
            expect(run().code).toBe(0);
        });
    }
});

describe('TEST:U1:9 time rules of the grouping word guard', () => {
    beforeEach(() => {
        setup('old-grouping-time-');
        tracked('CLAUDE.md', 'Clean\n');
    });
    afterEach(teardown);

    it('both constants ship off', () => {
        const source = readFileSync(realScript, 'utf8');
        expect(source).toContain('STEP6_RULE=off');
        expect(source).toContain('CLOSURE_RULE=off');
    });

    it('mutation 2: rule off, production build, full list is green', () => {
        expect(run({ HOSPEDA_PRODUCTION_BUILD: '1' }).code).toBe(0);
    });

    it('mutation 1: rule on, histories still in the list, production build is red', () => {
        mutateScript(step6On);
        const result = run({ HOSPEDA_PRODUCTION_BUILD: '1' });
        expect(result.code).toBe(1);
        expect(result.output).toContain('step-6 rule');
    });

    it('mutation 1: rule on, only one history back, production build is red', () => {
        mutateScript((source) => step6On(source).replace('    "$HISTORY_SEED"\n', ''));
        const result = run({ HOSPEDA_PRODUCTION_BUILD: '1' });
        expect(result.code).toBe(1);
        expect(result.output).toContain('step-6 rule');
    });

    it('rule on, the same list on a non-production build is green', () => {
        mutateScript(step6On);
        expect(run({ HOSPEDA_PRODUCTION_BUILD: '0' }).code).toBe(0);
    });

    it('rule on, histories taken out, production build is green', () => {
        mutateScript((source) => step6On(source).replace(HISTORY_ENTRIES, ''));
        expect(run({ HOSPEDA_PRODUCTION_BUILD: '1' }).code).toBe(0);
    });

    it('mutation 3: closure rule on, an entry left in the list is red', () => {
        mutateScript((source) => closureOn(step6On(source)).replace(HISTORY_ENTRIES, ''));
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain('closure rule');
    });

    it('closure rule on, empty list, is green', () => {
        mutateScript((source) => closureOn(step6On(source)).replace(EMPTY_LIST, 'ALLOWLIST=()'));
        expect(run({ HOSPEDA_PRODUCTION_BUILD: '1' }).code).toBe(0);
    });

    it('closure rule on, empty list, the word in a former program spec is red', () => {
        tracked('.specs/HOS-1352-x/spec.md', word);
        mutateScript((source) => closureOn(step6On(source)).replace(EMPTY_LIST, 'ALLOWLIST=()'));
        expect(run().code).toBe(1);
    });

    describe('the PDR exemption with the program folders out of the list', () => {
        const emptyList = (source: string): string =>
            closureOn(step6On(source)).replace(EMPTY_LIST, 'ALLOWLIST=()');

        it('the word in the PDR is green by name alone', () => {
            tracked(PDR, `${word} was the retired grouping\n`);
            mutateScript(emptyList);
            expect(run().code).toBe(0);
        });

        it('the word in a sibling of the PDR is red and names the sibling', () => {
            const sibling = '.specs/HOS-1352-billing-verticals-redesign/docs/foo.md';
            tracked(PDR, word);
            tracked(sibling, word);
            mutateScript(emptyList);
            const result = run();
            expect(result.code).toBe(1);
            expect(result.output).toContain(sibling);
            expect(result.output).not.toContain(`${PDR} (`);
        });
    });
});
