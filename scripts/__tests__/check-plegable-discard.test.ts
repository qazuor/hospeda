/**
 * @fileoverview
 * TEST:V3:3 (AC:V3:2): GUARD:G-R2 is green over the resolution and red on
 * purpose. Mutation (the one the spec names): remove from the fold the condition
 * "a live title that is not of type TRIAL" (admit complements with any title),
 * and the guard reddens. Removing the selector call is the other half.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { RESOLUTION_DIR, RULE_MESSAGES, run } from '../check-plegable-discard.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The real resolution files, keyed by file name. */
function resolutionFiles(): Record<string, string> {
    const dir = path.join(REPO_ROOT, RESOLUTION_DIR);
    return Object.fromEntries(
        readdirSync(dir)
            .filter((name) => name.endsWith('.ts'))
            .map((name) => [name, readFileSync(path.join(dir, name), 'utf8')])
    );
}

/** Writes the resolution (overridable per file) into a fresh tree. */
function makeTree({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr2-'));
    tempDirs.push(root);
    for (const [name, content] of Object.entries({ ...resolutionFiles(), ...overrides })) {
        const file = path.join(root, RESOLUTION_DIR, name);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    return root;
}

describe('TEST:V3:3 — GUARD:G-R2', () => {
    it('is green over the resolution', () => {
        const result = run();

        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree that keeps the discard wired', () => {
        expect(run({ root: makeTree() }).exitCode).toBe(0);
    });

    it('mutation: admitting complements with any title is red', () => {
        const result = run({
            root: makeTree({
                overrides: {
                    'plegable.ts':
                        'export function selectPlegableSources({ sources }: { readonly sources: readonly unknown[] }) {\n    return sources;\n}\n'
                }
            })
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['selector-gates-complement']}`);
        expect(result.output).not.toContain(`FAIL ${RULE_MESSAGES['fold-through-selector']}`);
    });

    it('mutation: a fold that bypasses the selector is red', () => {
        const result = run({
            root: makeTree({
                overrides: {
                    'fold.ts':
                        'export function foldPlegableSet({ sources }: { readonly sources: readonly unknown[] }) {\n    return sources;\n}\n'
                }
            })
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['fold-through-selector']}`);
        expect(result.output).not.toContain(`FAIL ${RULE_MESSAGES['selector-gates-complement']}`);
    });

    it('refuses a missing resolution', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'gr2-empty-'));
        tempDirs.push(root);

        const result = run({ root });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('has no production file');
    });
});

describe('TEST:V3:3 — G-R2 is plugged into the guards job', () => {
    const pkg = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

    it('runs as its own step of the guards job and inside check:guards', () => {
        const scripts = JSON.parse(pkg).scripts as Record<string, string>;

        expect(scripts['check:plegable-discard']).toBe('tsx scripts/check-plegable-discard.ts');
        expect(scripts['check:guards']).toContain('pnpm check:plegable-discard');
        expect(ci).toMatch(/run: pnpm check:plegable-discard/);
    });
});
