/** TEST:V4:15 — G13 mutation controls over throwaway git trees. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-bootstrap-answers-never-in-production';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WATCHED = 'packages/verticals/src/coverage/bootstrap-billing-answers.ts';
const ANSWERS = [
    'bootstrapSubscriptionAnswer',
    'bootstrapCourtesyAnswer',
    'bootstrapGrantAnswer',
    'bootstrapAddonAnswer',
    'bootstrapRetentionStoppedAnswer',
    'bootstrapCanChargeAnswer'
] as const;
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tree(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g13-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [file, source] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}

function check(source: string, production: string, extra: Readonly<Record<string, string>> = {}) {
    const root = tree({
        [WATCHED]: 'export const placeholder = 1;\n',
        'packages/verticals/src/coverage/bootstrap-billing-for-verticals.ts':
            "import { bootstrapSubscriptionAnswer } from './bootstrap-billing-answers';\n",
        'apps/api/src/consumer.ts': source,
        ...extra
    });
    return run({ root, env: { HOSPEDA_PRODUCTION_BUILD: production }, minScannedFiles: 0 });
}

describe('TEST:V4:15 G13', () => {
    it.each(ANSWERS)('rejects production link to %s', (answer) => {
        const result = check(
            `import { ${answer} } from '@repo/verticals/coverage/bootstrap-billing-answers';\n`,
            '1'
        );
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`consumer.ts:1 links ${answer}`);
    });

    it('allows trial and BASE resolution in production', () => {
        expect(
            check(
                "import { resolveTrialAndBaseSources } from '@repo/verticals/coverage/trial-and-base-sources';\n",
                '1'
            ).exitCode
        ).toBe(0);
    });

    it('rejects a production import of the assembler', () => {
        const result = check(
            "import { createBootstrapBillingForVerticals } from '@repo/verticals/coverage/bootstrap-billing-for-verticals';\n",
            '1'
        );
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('consumer.ts:1 links las seis');
    });

    it('rejects the assembler imported through the package barrel', () => {
        const result = check(
            "import { createBootstrapBillingForVerticals } from '@repo/verticals';\n",
            '1'
        );
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('consumer.ts:1 links las seis');
    });

    it.each(ANSWERS)('is silent on the branch for %s', (answer) => {
        expect(
            check(`import { ${answer} } from '../bootstrap-billing-answers';\n`, '0').exitCode
        ).toBe(0);
    });

    it('rejects a barrel re-export of the watched answers', () => {
        const result = check('export const consumer = 1;\n', '1', {
            'packages/verticals/src/index.ts':
                "export * from './coverage/bootstrap-billing-answers';\n"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('index.ts:1 links las seis');
    });

    it.each([
        "export * from '@repo/verticals/coverage/bootstrap-billing-answers';\n",
        "const answers = import('@repo/verticals/coverage/bootstrap-billing-answers');\n",
        "const answers = require('@repo/verticals/coverage/bootstrap-billing-answers');\n"
    ])('rejects namespace, dynamic, or require links', (source) => {
        expect(check(source, '1').output).toContain('links las seis');
    });

    it('ignores comments and permits the assembler public barrel export', () => {
        const result = check(
            "// import { bootstrapGrantAnswer } from '@repo/verticals/coverage/bootstrap-billing-answers';\n",
            '1',
            {
                'packages/verticals/src/index.ts':
                    "export { createBootstrapBillingForVerticals } from './coverage/bootstrap-billing-for-verticals';\n"
            }
        );
        expect(result.exitCode).toBe(0);
    });

    it('fails loudly when the watched module is missing', () => {
        const root = tree({ 'apps/api/src/consumer.ts': 'export const x = 1;\n' });
        const result = run({ root, env: { HOSPEDA_PRODUCTION_BUILD: '0' }, minScannedFiles: 0 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('watched module missing');
    });

    it('passes on the real repository as a production build', () => {
        const result = run({ root: ROOT, env: { HOSPEDA_PRODUCTION_BUILD: '1' } });
        expect(result).toMatchObject({ exitCode: 0 });
    });
});
