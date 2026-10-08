/**
 * @fileoverview
 * TEST:V3:7 (AC:V3:5): GUARD:G-R2-B is green over the resolution and red on
 * purpose. Mutations (the one the spec names): make the resolution of one
 * vertical take the GRANT source (or its floor) of another vertical, and the
 * guard reddens.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { RESOLUTION_DIR, RULE_MESSAGES, run } from '../check-grant-floor-by-vertical.js';

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
    const root = mkdtempSync(path.join(tmpdir(), 'gr2b-'));
    tempDirs.push(root);
    for (const [name, content] of Object.entries({ ...resolutionFiles(), ...overrides })) {
        const file = path.join(root, RESOLUTION_DIR, name);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    return root;
}

describe('TEST:V3:7 — GUARD:G-R2-B', () => {
    it('is green over the resolution', () => {
        const result = run();

        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree that keeps the by-vertical wiring', () => {
        expect(run({ root: makeTree() }).exitCode).toBe(0);
    });

    it('mutation: selecting the grant without the `GRANT` filter is red', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replace("source.type === 'GRANT' && ", '');
        expect(mutated).not.toBe(source);

        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-source-by-type']}`);
    });

    it('mutation: not comparing the reference vertical is red', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replace(
            'if (reference.vertical !== args.vertical) {',
            'if (false) {'
        );
        expect(mutated).not.toBe(source);

        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-floor-by-vertical']}`);
    });

    it('mutation: reading the floor from somewhere else is red', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replaceAll('grant.floor', 'null');
        expect(mutated).not.toBe(source);

        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-floor-by-vertical']}`);
    });

    it('mutation: not comparing the floor version vertical is red (real cross read)', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replace(
            'if (floorSummary.vertical !== args.vertical) {',
            'if (false) {'
        );
        expect(mutated).not.toBe(source);

        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-floor-by-vertical']}`);
    });

    it('mutation: querying coverage for another vertical is red', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replace(
            'args.billing.coverage({ userId: args.userId, vertical: args.vertical });',
            "args.billing.coverage({ userId: args.userId, vertical: 'gastronomy' });"
        );
        expect(mutated).not.toBe(source);
        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-coverage-identity']}`);
    });

    it('mutation: querying coverage for another user is red', () => {
        const source = resolutionFiles()['grant-ratchet.ts'] as string;
        const mutated = source.replace(
            'userId: args.userId, vertical: args.vertical });',
            "userId: 'other-user', vertical: args.vertical });"
        );
        expect(mutated).not.toBe(source);
        const result = run({ root: makeTree({ overrides: { 'grant-ratchet.ts': mutated } }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['grant-coverage-identity']}`);
    });

    it('refuses a missing resolution', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'gr2b-empty-'));
        tempDirs.push(root);

        const result = run({ root });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('has no production file');
    });
});

describe('TEST:V3:7 — G-R2-B is plugged into the guards job', () => {
    const pkg = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

    it('runs as its own step of the guards job and inside check:guards', () => {
        const scripts = JSON.parse(pkg).scripts as Record<string, string>;

        expect(scripts['check:grant-floor-by-vertical']).toBe(
            'tsx scripts/check-grant-floor-by-vertical.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:grant-floor-by-vertical');
        expect(ci).toMatch(/run: pnpm check:grant-floor-by-vertical/);
    });
});
