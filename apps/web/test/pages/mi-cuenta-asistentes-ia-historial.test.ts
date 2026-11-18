/**
 * @file mi-cuenta-asistentes-ia-historial.test.ts
 * @description The assistant history page (HOS-2348, spec HOS-2335 §6.9).
 *
 * - AC-C48: the page renders nothing per user on the server; the island is
 *   the only per-user render. Astro cannot be rendered in Vitest, so the
 *   source is read and asserted on (the web's Astro test strategy).
 * - AC-C48: every i18n key the history island and its rows use exists in es,
 *   en and pt. The keys are read from the sources, so a new key is covered.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(__dirname, '../..');
const PAGE = resolve(WEB, 'src/pages/[lang]/mi-cuenta/asistentes-ia/historial.astro');
const INDEX = resolve(WEB, 'src/pages/[lang]/mi-cuenta/asistentes-ia/index.astro');
const SOURCES = [
    PAGE,
    INDEX,
    resolve(WEB, 'src/components/account/AiActivityHistory.client.tsx'),
    resolve(WEB, 'src/components/account/AiActivityItem.tsx')
];
const LOCALES = ['es', 'en', 'pt'] as const;

/** Removes comments, so prose that names a forbidden read is not matched. */
function code(path: string): string {
    return readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

/** The `account.aiAssistants.activity` keys a source names statically. */
function keysIn(source: string): readonly string[] {
    const literal = [...source.matchAll(/'account\.aiAssistants\.activity\.([A-Za-z.]+)'/g)];
    const templated = [...source.matchAll(/`\$\{KEY\}\.([A-Za-z.]+)`/g)];
    return [...literal, ...templated].map((match) => match[1] ?? '');
}

/** Looks a dotted path up in a locale's `aiAssistants.activity` block. */
function lookUp(locale: (typeof LOCALES)[number], key: string): unknown {
    const account: { aiAssistants: { activity: Record<string, unknown> } } = JSON.parse(
        readFileSync(resolve(WEB, `../../packages/i18n/src/locales/${locale}/account.json`), 'utf8')
    );
    return key.split('.').reduce<unknown>((node, part) => {
        return typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined;
    }, account.aiAssistants.activity);
}

describe('assistant history page (AC-C48)', () => {
    const page = code(PAGE);

    it('reads no session on the server', () => {
        expect(page).not.toMatch(/Astro\.locals\.user/);
        expect(page).not.toMatch(/const\s*\{[^}]*\buser\b[^}]*\}\s*=\s*Astro\.locals/);
        expect(page).not.toMatch(/Astro\.request\.headers/);
        expect(page).not.toMatch(/endpoints-protected/);
    });

    it('leaves the per-user list to the island, hydrated on load', () => {
        expect(page).toMatch(/<AiActivityHistory\s+client:load\b/);
        expect(page).toContain('connectUrl={assistantsUrl}');
    });

    it('builds the 401 sign-in link from its own path, the same for every user', () => {
        expect(page).toContain('signinUrl={signinUrl}');
        expect(page).toMatch(
            /buildLoginRedirect\(\{\s*locale,\s*currentUrl: buildUrl\(\{ locale, path: 'mi-cuenta\/asistentes-ia\/historial' \}\)/
        );
    });

    it('says why it hydrates on load', () => {
        expect(readFileSync(PAGE, 'utf8')).toMatch(/Hydration: `client:load`/);
    });

    it('is linked from the assistants page, and links back to it', () => {
        expect(code(INDEX)).toContain("path: 'mi-cuenta/asistentes-ia/historial'");
        expect(page).toContain("path: 'mi-cuenta/asistentes-ia'");
    });
});

describe('assistant history copy (AC-C48)', () => {
    const keys = [...new Set(SOURCES.flatMap((path) => keysIn(code(path))))];

    it('finds the keys it checks', () => {
        expect(keys.length).toBeGreaterThan(15);
        expect(keys).toEqual(expect.arrayContaining(['filters.includeReads', 'empty.title']));
    });

    it.each(LOCALES)('%s has every static key', (locale) => {
        const missing = keys.filter((key) => typeof lookUp(locale, key) !== 'string');
        expect(missing).toEqual([]);
    });

    it.each(LOCALES)('%s labels every result, step, outcome and target', (locale) => {
        const required = [
            'result.done',
            'result.deniedByHospeda',
            'result.declinedByYou',
            'result.error',
            'steps.preview',
            'steps.commit',
            'outcomes.success',
            'outcomes.denied',
            'outcomes.error',
            'target.conversation',
            'target.unavailable'
        ];
        expect(required.filter((key) => typeof lookUp(locale, key) !== 'string')).toEqual([]);
    });
});
