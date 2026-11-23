/**
 * @file account-not-found.test.ts
 * @description Regression tests for the in-layout account 404 (HOS-2434): the
 * helper that builds the rewrite target, the page that renders it, and every
 * producer that used to return a bare, body-less 404.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_NOT_FOUND_BACK_TARGETS,
    buildAccountNotFoundTarget,
    resolveAccountNotFoundBackKey
} from '@/lib/account-not-found';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf8');
const PAGES = 'src/pages/[lang]/mi-cuenta';

describe('buildAccountNotFoundTarget', () => {
    it('targets the in-layout not-found page and carries the back key', () => {
        expect(buildAccountNotFoundTarget({ locale: 'en', back: 'messages' })).toBe(
            '/en/mi-cuenta/no-encontrado/?back=messages'
        );
    });

    it('defaults the back link to the account home', () => {
        expect(buildAccountNotFoundTarget({ locale: 'es' })).toContain('back=account');
    });
});

describe('resolveAccountNotFoundBackKey', () => {
    it('accepts every declared key', () => {
        for (const key of Object.keys(ACCOUNT_NOT_FOUND_BACK_TARGETS)) {
            expect(resolveAccountNotFoundBackKey({ value: key })).toBe(key);
        }
    });

    it.each([
        null,
        undefined,
        '',
        'https://evil.example',
        '__proto__',
        'toString'
    ])('falls back to the account home for %s', (value) => {
        expect(resolveAccountNotFoundBackKey({ value })).toBe('account');
    });
});

describe('mi-cuenta/no-encontrado.astro', () => {
    const source = read(`${PAGES}/no-encontrado.astro`);

    it('renders inside AccountLayout and keeps the 404 status', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('Astro.response.status = 404');
    });

    it('offers a way back and uses i18n for every text', () => {
        expect(source).toContain('href={buildUrl({ locale, path: target.path })}');
        expect(source).toContain("t('account.notFound.title'");
        expect(source).toContain('t(target.labelKey)');
    });
});

describe('bare 404 producers now render inside the account layout (HOS-2434)', () => {
    it.each([
        [`${PAGES}/consultas/[conversationId].astro`, "back: 'messages'"],
        [`${PAGES}/consultas-propietario/[conversationId].astro`, "back: 'ownerMessages'"],
        ['src/lib/editor/resolve-listing-editor-page.ts', "back: 'listings'"]
    ])('%s rewrites instead of returning an empty Response', (rel, backArg) => {
        const source = read(rel);
        expect(source).not.toContain('new Response(null, { status: 404 })');
        expect(source).toContain('buildAccountNotFoundTarget');
        expect(source).toContain('rewrite(');
        expect(source).toContain(backArg);
    });
});
