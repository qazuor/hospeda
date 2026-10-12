/**
 * @fileoverview
 * TEST:B4:8 (AC:B4:8): GUARD:G-R2-C is green over billing's real `ADDON` source
 * and red on purpose. The mutation the spec names: remove the filter by the
 * product's compatible verticals from the real `ADDON` source, so a
 * `USER`/`GLOBAL` instance is emitted in every vertical; the guard reddens
 * naming the source, and is green again once restored.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ADDON_SOURCES_FILE, RULE_MESSAGES, run } from '../check-addon-compatible-verticals.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The real source the guard watches. */
const REAL_SOURCE = readFileSync(path.join(REPO_ROOT, ADDON_SOURCES_FILE), 'utf8');

/** The exact filter line of the real source; every mutation below rewrites it. */
const FILTER = 'if (instance.product.compatibleVerticals.includes(args.vertical)) {';

/** The USER/GLOBAL branch of the real source, as written. */
const USER_GLOBAL_BRANCH = `            case 'USER':
            case 'GLOBAL':
                ${FILTER}
                    return { scope: scopeType, target: null };
                }
                return null;`;

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes the watched file (or nothing, when `source` is `null`) into a fresh tree. */
function makeTree({ source }: { readonly source: string | null }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr2c-'));
    tempDirs.push(root);
    if (source !== null) {
        const file = path.join(root, ADDON_SOURCES_FILE);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, source);
    }
    return root;
}

/** The real source with one fragment replaced; fails if the fragment is not there. */
function mutate({ from, to }: { readonly from: string; readonly to: string }): string {
    expect(REAL_SOURCE).toContain(from);
    return REAL_SOURCE.replace(from, to);
}

describe('TEST:B4:8 — GUARD:G-R2-C', () => {
    it('is green over the real ADDON source', () => {
        const result = run();

        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree that keeps the filter in the USER/GLOBAL branch', () => {
        expect(run({ root: makeTree({ source: REAL_SOURCE }) }).exitCode).toBe(0);
    });

    it('is green over an early bail-out on the negated filter', () => {
        const source = mutate({
            from: USER_GLOBAL_BRANCH,
            to: `            case 'USER':
            case 'GLOBAL':
                if (!instance.product.compatibleVerticals.includes(args.vertical)) return null;
                return { scope: scopeType, target: null };`
        });

        expect(run({ root: makeTree({ source }) }).exitCode).toBe(0);
    });

    it('is red, naming the source, when the filter is removed (the TEST:B4:8 mutation)', () => {
        const source = mutate({
            from: USER_GLOBAL_BRANCH,
            to: `            case 'USER':
            case 'GLOBAL':
                return { scope: scopeType, target: null };`
        });

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['compatible-vertical-filter']}`);
        expect(result.output).toContain(ADDON_SOURCES_FILE);
    });

    it('is red when the filter is replaced by `true`', () => {
        const source = mutate({ from: FILTER, to: 'if (true) {' });

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['compatible-vertical-filter']}`);
    });

    it('is red when the filter checks a constant vertical instead of the requested one', () => {
        const source = mutate({
            from: FILTER,
            to: "if (instance.product.compatibleVerticals.includes('accommodation')) {"
        });

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['compatible-vertical-filter']}`);
    });

    it('is red when `includes` runs over another property', () => {
        const source = mutate({
            from: FILTER,
            to: 'if (instance.product.otherVerticals.includes(args.vertical)) {'
        });

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['compatible-vertical-filter']}`);
    });

    it('is red when the filter is computed outside the USER/GLOBAL branch and does not gate it', () => {
        const withLooseFilter = mutate({
            from: USER_GLOBAL_BRANCH,
            to: `            case 'USER':
            case 'GLOBAL':
                return { scope: scopeType, target: null };`
        }).replace(
            '        switch (scopeType) {',
            '        const compatible = instance.product.compatibleVerticals.includes(args.vertical);\n        void compatible;\n        switch (scopeType) {'
        );
        expect(withLooseFilter).toContain('const compatible =');

        const result = run({ root: makeTree({ source: withLooseFilter }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['filter-gates-user-global']}`);
    });

    it('is red when the filter moves to another scope branch', () => {
        const source = mutate({
            from: USER_GLOBAL_BRANCH,
            to: `            case 'USER':
            case 'GLOBAL':
                return { scope: scopeType, target: null };`
        }).replace(
            "            case 'LISTING': {",
            `            case 'LISTING': {
                if (!instance.product.compatibleVerticals.includes(args.vertical)) return null;`
        );

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['filter-gates-user-global']}`);
    });

    it('fails loud when the watched file is absent', () => {
        const result = run({ root: makeTree({ source: null }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL G-R2-C: ${ADDON_SOURCES_FILE} does not exist`);
    });

    it('is red when the watched function is absent', () => {
        const source = REAL_SOURCE.replaceAll('resolveAddonSources', 'resolveSomethingElse');

        const result = run({ root: makeTree({ source }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`FAIL ${RULE_MESSAGES['resolver-present']}`);
    });
});

describe('TEST:B4:8 — G-R2-C is plugged into the guards job', () => {
    const pkg = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');

    it('runs as its own step of the guards job and inside check:guards, before fake-lies', () => {
        const scripts = JSON.parse(pkg).scripts as Record<string, string>;
        const chain = (scripts['check:guards'] ?? '').split('&&').map((step) => step.trim());

        expect(scripts['check:addon-compatible-verticals']).toBe(
            'tsx scripts/check-addon-compatible-verticals.ts'
        );
        expect(chain).toContain('pnpm check:addon-compatible-verticals');
        expect(chain.indexOf('pnpm check:addon-compatible-verticals')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        expect(chain.at(-1)).toBe('pnpm check:fake-lies');
        expect(ci).toMatch(/^\s+run: pnpm check:addon-compatible-verticals\s*$/m);
    });
});
