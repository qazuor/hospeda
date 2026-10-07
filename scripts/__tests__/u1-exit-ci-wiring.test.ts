import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:U1:22 and TEST:U1:23 (AC:U1:12, AC:U1:13): the exit evidence of U1
 * (HOS-1421) for the CI wiring the momento-1 gate relies on.
 *
 * - G8 is plugged into `pnpm check:guards` AND is a step of the `guards` job
 *   (owner 2026-10-07, CO: one CI step per guard is the repo convention).
 * - `guards` and `test-integration` gate `CI Pass` (CN: `test-integration`'s
 *   global-setup applies the whole migration chain on an empty database, so a
 *   migration that does not apply from scratch never reaches `CI Pass`).
 * - The PR e2e suite runs `db:migrate` against a fresh service database.
 *
 * Every assertion is anchored on its own job block, never on a whole-file match.
 * The workflows are read as text by indentation: the repo has no YAML parser
 * among its root dependencies and this test does not add one.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

const G8_SCRIPT = 'scripts/check-old-grouping-word.sh';

/**
 * Returns the lines of one job under `jobs:` (its header up to the next job
 * header or the next top-level key). Empty when the job does not exist.
 */
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

/** Returns the job names listed in a job's `needs:` (list or single-value form). */
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

/** Returns the commands of every `run:` step of a job (single-line form). */
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

/** Resolves the shell command each `pnpm <script>` of `check:guards` runs. */
function checkGuardsCommands(): readonly string[] {
    const chain = rootPkg.scripts['check:guards'] ?? '';
    return chain.split('&&').map((part) => {
        const step = part.trim();
        const script = /^pnpm (?:run )?(\S+)$/.exec(step)?.[1];
        return script ? (rootPkg.scripts[script] ?? step) : step;
    });
}

describe('U1 exit: CI wiring (TEST:U1:22, TEST:U1:23)', () => {
    describe('G8 (TEST:U1:22)', () => {
        it('is part of pnpm check:guards', () => {
            expect(checkGuardsCommands().some((command) => command.includes(G8_SCRIPT))).toBe(true);
        });

        it('is a step of the guards job of ci.yml', () => {
            const guards = jobBlock({ source: ciYml, job: 'guards' });
            expect(guards.length).toBeGreaterThan(0);
            expect(stepRuns({ block: guards })).toContain(`bash ${G8_SCRIPT}`);
        });
    });

    describe('CI Pass needs', () => {
        const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });

        it('waits on the guards job', () => {
            expect(needs).toContain('guards');
        });

        it('waits on test-integration, the from-scratch migration barrier (TEST:U1:23)', () => {
            expect(needs).toContain('test-integration');
        });
    });

    describe('PR e2e suite (TEST:U1:23)', () => {
        const e2e = jobBlock({ source: e2eYml, job: 'e2e-p0' });

        it('runs on a fresh postgres service database', () => {
            expect(e2e).toMatch(/^ {4}services:\s*$/m);
            expect(e2e).toMatch(/^ {6}postgres:\s*\n\s+image: postgres:/m);
        });

        it('applies the versioned migrations with db:migrate', () => {
            expect(stepRuns({ block: e2e })).toContain('pnpm --filter @repo/db db:migrate');
        });

        it('carries no job-level exemption', () => {
            expect(e2e).not.toMatch(/^ {4}if:/m);
        });
    });
});
