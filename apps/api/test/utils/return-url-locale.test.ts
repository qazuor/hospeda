import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { resolveReturnUrlLocale } from '../../src/utils/return-url-locale.js';

function context(headers: Record<string, string> = {}, accountLocale?: string): Context {
    return {
        get: () => (accountLocale ? { settings: { languageWeb: accountLocale } } : null),
        req: { header: (name: string) => headers[name] }
    } as unknown as Context;
}

describe('resolveReturnUrlLocale', () => {
    it('prefers the explicit client header over account and Accept-Language', () => {
        expect(
            resolveReturnUrlLocale(
                context({ 'x-client-locale': 'pt', 'accept-language': 'en' }, 'es')
            )
        ).toBe('pt');
    });

    it('uses account language when no explicit header is present', () => {
        expect(resolveReturnUrlLocale(context({ 'accept-language': 'en' }, 'pt'))).toBe('pt');
    });

    it('uses Accept-Language when neither explicit nor account language is present', () => {
        expect(resolveReturnUrlLocale(context({ 'accept-language': 'en-US,en;q=0.9' }))).toBe('en');
    });

    it('defaults to Spanish when no preference is present', () => {
        expect(resolveReturnUrlLocale(context())).toBe('es');
    });
});
