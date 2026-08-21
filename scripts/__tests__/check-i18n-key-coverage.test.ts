/**
 * Unit tests for the i18n key-coverage guard (HOS-619).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each one
 * builds a throwaway tree with its own locale files and asserts the verdict.
 * The repo-wide run is the CI step; this is what stops the predicate from
 * silently becoming unable to fail.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    blankComments,
    extractReferences,
    prune,
    readReferenceLocale,
    resolvesToATranslation,
    run
} from '../check-i18n-key-coverage.js';

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * Builds a throwaway repo with an `es` locale and some source files.
 *
 * @param params.locales - Namespace name to its JSON object.
 * @param params.sources - Repo-relative source path to its contents.
 * @param params.inventory - Optional frozen inventory entries.
 * @returns The absolute root of the throwaway repo.
 */
function makeRepo({
    locales,
    sources,
    inventory
}: {
    locales: Record<string, unknown>;
    sources: Record<string, string>;
    inventory?: Array<{ file: string; key: string }>;
}): string {
    const root = mkdtempSync(join(tmpdir(), 'i18n-guard-'));
    dirs.push(root);

    const localeDir = join(root, 'packages/i18n/src/locales/es');
    mkdirSync(localeDir, { recursive: true });
    for (const [ns, body] of Object.entries(locales)) {
        writeFileSync(join(localeDir, `${ns}.json`), JSON.stringify(body), 'utf8');
    }

    // The guard walks three roots; all must exist even when empty.
    for (const dir of ['apps/web/src', 'apps/admin/src', 'packages']) {
        mkdirSync(join(root, dir), { recursive: true });
    }
    for (const [rel, contents] of Object.entries(sources)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, contents, 'utf8');
    }

    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(
        join(root, 'scripts/i18n-fallback-inventory.json'),
        `${JSON.stringify({ entries: inventory ?? [] }, null, 4)}\n`,
        'utf8'
    );
    return root;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe('resolvesToATranslation', () => {
    it('accepts a key present verbatim', () => {
        const known = new Set(['nav.signIn']);
        expect(resolvesToATranslation({ key: 'nav.signIn', known })).toBe(true);
    });

    it('accepts a plural base key when both CLDR variants exist', () => {
        const known = new Set(['social.audiences.results_one', 'social.audiences.results_other']);
        expect(resolvesToATranslation({ key: 'social.audiences.results', known })).toBe(true);
    });

    it('rejects a plural base key when only one variant exists', () => {
        const known = new Set(['social.audiences.results_one']);
        expect(resolvesToATranslation({ key: 'social.audiences.results', known })).toBe(false);
    });

    it('rejects a key that is absent', () => {
        expect(resolvesToATranslation({ key: 'nav.signIn', known: new Set() })).toBe(false);
    });
});

describe('blankComments', () => {
    it('blanks a block comment while preserving line count', () => {
        const source = "/**\n * t('nav.signIn')\n */\nconst x = 1;";
        const out = blankComments(source);
        expect(out).not.toContain('nav.signIn');
        expect(out.split('\n')).toHaveLength(source.split('\n').length);
    });

    it('blanks a line comment but keeps a URL intact', () => {
        const out = blankComments("const url = 'https://x.test/a'; // t('nav.signIn')");
        expect(out).toContain('https://x.test/a');
        expect(out).not.toContain('nav.signIn');
    });
});

describe('extractReferences', () => {
    const namespaces = new Set(['nav']);

    /** Writes one source file into a throwaway dir and extracts from it. */
    function refsOf(contents: string) {
        const root = mkdtempSync(join(tmpdir(), 'i18n-refs-'));
        dirs.push(root);
        const file = join(root, 'Sample.tsx');
        writeFileSync(file, contents, 'utf8');
        return extractReferences({ file, namespaces });
    }

    it('finds a plain call and reports no fallback', () => {
        const refs = refsOf("const a = t('nav.signIn');");
        expect(refs).toHaveLength(1);
        expect(refs[0]?.key).toBe('nav.signIn');
        expect(refs[0]?.hasFallback).toBe(false);
    });

    it('flags the second argument as a fallback', () => {
        const refs = refsOf("const a = t('nav.signIn', 'Iniciar sesión');");
        expect(refs[0]?.hasFallback).toBe(true);
    });

    it('finds a call split across lines and reports the right line', () => {
        const refs = refsOf(
            "const a = 1;\nconst b = t(\n    'nav.signIn',\n    'Iniciar sesión'\n);"
        );
        expect(refs).toHaveLength(1);
        expect(refs[0]?.hasFallback).toBe(true);
        expect(refs[0]?.line).toBe(2);
    });

    it('finds a key hidden behind an as-TranslationKey cast', () => {
        const refs = refsOf("const a = t('nav.signIn' as TranslationKey);");
        expect(refs.map((r) => r.key)).toEqual(['nav.signIn']);
    });

    it('does not count a tPlural cast twice', () => {
        const refs = refsOf("const a = tPlural('nav.signIn' as TranslationKey, n);");
        expect(refs).toHaveLength(1);
        expect(refs[0]?.hasFallback).toBe(false);
    });

    it('treats a tPlural count as a count, never as a fallback', () => {
        const refs = refsOf("const a = tPlural('nav.signIn', total, { count: total });");
        expect(refs[0]?.hasFallback).toBe(false);
    });

    it('ignores a first segment that is not a locale namespace', () => {
        expect(refsOf("const a = t('router.push.now');")).toHaveLength(0);
    });

    it('ignores a key that only appears inside a comment', () => {
        expect(refsOf("// t('nav.signIn')\nconst a = 1;")).toHaveLength(0);
    });
});

describe('readReferenceLocale', () => {
    it('indexes namespaces and fully-qualified leaf keys', () => {
        const root = makeRepo({ locales: { nav: { auth: { signIn: 'Entrar' } } }, sources: {} });
        const index = readReferenceLocale({ localesDir: join(root, 'packages/i18n/src/locales') });
        expect([...index.namespaces]).toEqual(['nav']);
        expect(index.keys.has('nav.auth.signIn')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

describe('check 1 — every referenced key resolves', () => {
    it('passes when the key exists', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signIn');" }
        });
        expect(run(root)).toBe(0);
    });

    it('fails when the key exists in no locale', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signOut');" }
        });
        expect(run(root)).toBe(1);
    });

    it('fails when the key is hidden behind a cast', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/admin/src/A.tsx': "t('nav.signOut' as TranslationKey);" }
        });
        expect(run(root)).toBe(1);
    });

    it('passes a tPlural base key backed by its CLDR variants', () => {
        const root = makeRepo({
            locales: { nav: { results_one: 'uno', results_other: 'varios' } },
            sources: { 'apps/admin/src/A.tsx': "tPlural('nav.results' as TranslationKey, n);" }
        });
        expect(run(root)).toBe(0);
    });
});

describe('check 2 — the fallback inventory only shrinks', () => {
    it('passes when an absent key with a fallback is already listed', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signOut', 'Salir');" },
            inventory: [{ file: 'apps/web/src/A.tsx', key: 'nav.signOut' }]
        });
        expect(run(root)).toBe(0);
    });

    it('fails on a fallback site that is not listed', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signOut', 'Salir');" }
        });
        expect(run(root)).toBe(1);
    });

    it('fails on a listed site that no longer exists, so the list cannot rot', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signIn');" },
            inventory: [{ file: 'apps/web/src/A.tsx', key: 'nav.signOut' }]
        });
        expect(run(root)).toBe(1);
    });

    it('fails when the same key moves to a file the inventory does not name', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/B.tsx': "t('nav.signOut', 'Salir');" },
            inventory: [{ file: 'apps/web/src/A.tsx', key: 'nav.signOut' }]
        });
        expect(run(root)).toBe(1);
    });
});

describe('prune', () => {
    it('drops dead entries and never invents one', () => {
        const root = makeRepo({
            locales: { nav: { signIn: 'Entrar' } },
            sources: { 'apps/web/src/A.tsx': "t('nav.signOut', 'Salir');t('nav.other', 'Otro');" },
            inventory: [
                { file: 'apps/web/src/A.tsx', key: 'nav.signOut' },
                { file: 'apps/web/src/A.tsx', key: 'nav.gone' }
            ]
        });
        expect(prune(root)).toBe(0);
        const after = JSON.parse(
            readFileSync(join(root, 'scripts/i18n-fallback-inventory.json'), 'utf8')
        ) as { entries: Array<{ key: string }> };
        // `nav.gone` is dropped; the live-but-unlisted `nav.other` is NOT added,
        // which is what stops prune from being a way to silence a violation.
        expect(after.entries.map((e) => e.key)).toEqual(['nav.signOut']);
        expect(run(root)).toBe(1);
    });
});
