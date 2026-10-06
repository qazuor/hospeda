import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../check-old-grouping-word.sh'
);
const word = 'comm' + 'erce';
let root: string;

function git(...args: string[]): void {
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function tracked(file: string, content: string): void {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    git('add', '--', file);
}

function run(): { code: number; output: string } {
    try {
        return { code: 0, output: execFileSync('bash', [script], { cwd: root, encoding: 'utf8' }) };
    } catch (error) {
        const failure = error as { status: number | null; stdout: string };
        return { code: failure.status ?? 1, output: failure.stdout };
    }
}

describe('TEST:U1:7 scoped grouping word guard', () => {
    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), 'old-grouping-guard-'));
        git('init', '-q');
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('passes a clean tree', () => {
        tracked('CLAUDE.md', 'Clean guidance\n');
        expect(run().code).toBe(0);
    });

    for (const file of [
        'CLAUDE.md',
        'packages/i18n/src/example.ts',
        '.specs/HOS-123-example/spec.md',
        '.qtm/example.md'
    ]) {
        it(`rejects content in ${file}`, () => {
            tracked(file, `retired ${word} grouping\n`);
            const result = run();
            expect(result.code).toBe(1);
            expect(result.output).toContain(file);
        });
    }

    it('rejects a spec path containing the word', () => {
        const file = `.specs/HOS-123-${word}/spec.md`;
        tracked(file, 'clean content\n');
        const result = run();
        expect(result.code).toBe(1);
        expect(result.output).toContain(file);
    });

    it('exempts umbrella specs', () => {
        tracked('.specs/HOS-1352-x/spec.md', word);
        expect(run().code).toBe(0);
    });

    it('does not scan outside the four surfaces', () => {
        tracked('apps/x.ts', word);
        expect(run().code).toBe(0);
    });
});
