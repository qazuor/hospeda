/**
 * Unit tests for the single, product-wide locale-precedence resolver
 * (HOS-605 / HOS-609 / HOS-617): explicit URL locale > account preference >
 * `Accept-Language` > default.
 *
 * The three regression cases at the bottom of this file correspond exactly
 * to the owner's decision table on HOS-617 (2026-08-21):
 *
 * | Issue   | Situation                                                | Expected |
 * |---------|-----------------------------------------------------------|----------|
 * | HOS-605 | Paid from `/es/`, profile says `en`                        | `es` (URL wins) |
 * | HOS-609 | Spanish account, English browser, no locale in target URL | `es` (account wins) |
 * | HOS-617 | `pt` must resolve like any other supported locale          | `pt` |
 */

import { describe, expect, it } from 'vitest';
import { matchAcceptLanguage, resolveDisplayLocale } from '../src/locale-resolution';

const SUPPORTED = ['es', 'en', 'pt'] as const;
const DEFAULT = 'es';

describe('matchAcceptLanguage', () => {
    it('returns the default and matched=false when the header is null', () => {
        const result = matchAcceptLanguage({
            header: null,
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'es', matched: false });
    });

    it('returns the default and matched=false when the header is empty', () => {
        const result = matchAcceptLanguage({
            header: '',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'es', matched: false });
    });

    it('matches an exact supported tag', () => {
        const result = matchAcceptLanguage({
            header: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', matched: true });
    });

    it('folds a regional tag to its primary subtag (pt-BR -> pt)', () => {
        const result = matchAcceptLanguage({
            header: 'pt-BR,pt;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'pt', matched: true });
    });

    it('respects q-values when ranking candidates', () => {
        const result = matchAcceptLanguage({
            header: 'de,en;q=0.8,es;q=0.5',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', matched: true });
    });

    it('is case-insensitive', () => {
        const result = matchAcceptLanguage({
            header: 'EN-US,EN;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', matched: true });
    });

    it('falls back to default with matched=false when nothing matches', () => {
        const result = matchAcceptLanguage({
            header: 'de,fr;q=0.9,it;q=0.8',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'es', matched: false });
    });

    it('drops a malformed q-value entry instead of letting it win', () => {
        const result = matchAcceptLanguage({
            header: 'en;q=oops,es;q=0.7',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'es', matched: true });
    });
});

describe('resolveDisplayLocale — precedence order', () => {
    it('step 1: an explicit URL locale wins over everything else', () => {
        const result = resolveDisplayLocale({
            urlLocale: 'en',
            accountLocale: 'pt',
            acceptLanguageHeader: 'fr',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', source: 'url' });
    });

    it('step 2: the account preference wins when there is no URL locale', () => {
        const result = resolveDisplayLocale({
            urlLocale: null,
            accountLocale: 'pt',
            acceptLanguageHeader: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'pt', source: 'account' });
    });

    it('step 3: Accept-Language wins when there is no URL locale or account preference', () => {
        const result = resolveDisplayLocale({
            accountLocale: null,
            acceptLanguageHeader: 'pt-BR',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'pt', source: 'accept-language' });
    });

    it('step 4: falls back to the default when nothing else resolves', () => {
        const result = resolveDisplayLocale({
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'es', source: 'default' });
    });

    it('an unsupported URL locale is ignored, falling through to the account preference', () => {
        const result = resolveDisplayLocale({
            urlLocale: 'de',
            accountLocale: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', source: 'account' });
    });

    it('an unsupported account preference is ignored, falling through to Accept-Language', () => {
        const result = resolveDisplayLocale({
            accountLocale: 'fr',
            acceptLanguageHeader: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result).toEqual({ locale: 'en', source: 'accept-language' });
    });

    it('defaults supportedLocales/defaultLocale to the platform catalog when omitted', () => {
        const result = resolveDisplayLocale({ urlLocale: 'pt' });
        expect(result).toEqual({ locale: 'pt', source: 'url' });
    });
});

describe('resolveDisplayLocale — regression cases (HOS-605 / HOS-609 / HOS-617)', () => {
    it('HOS-605: paid from /es/ with an English profile preference — the URL of origin wins, not the profile', () => {
        const result = resolveDisplayLocale({
            urlLocale: 'es',
            accountLocale: 'en',
            acceptLanguageHeader: 'en-US',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result.locale).toBe('es');
        expect(result.source).toBe('url');
    });

    it('HOS-609: Spanish account, English browser, no locale in the destination URL — the account preference wins', () => {
        const result = resolveDisplayLocale({
            urlLocale: null,
            accountLocale: 'es',
            acceptLanguageHeader: 'en-US,en;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result.locale).toBe('es');
        expect(result.source).toBe('account');
    });

    it('HOS-617: pt resolves through Accept-Language exactly like es/en (no second-class locale)', () => {
        const result = resolveDisplayLocale({
            acceptLanguageHeader: 'pt-BR,pt;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result.locale).toBe('pt');
        expect(result.source).toBe('accept-language');
    });

    it('HOS-617: pt resolves as an account preference exactly like es/en', () => {
        const result = resolveDisplayLocale({
            accountLocale: 'pt',
            acceptLanguageHeader: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(result.locale).toBe('pt');
        expect(result.source).toBe('account');
    });
});
