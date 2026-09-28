import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from '../safe-external-url.schema.js';

describe('safeExternalUrl', () => {
    const schema = safeExternalUrl('zodError.test.invalid');

    it.each([
        'https://example.com',
        'http://example.com/a?b=1',
        'HTTPS://EXAMPLE.COM'
    ])('accepts %s', (value) => {
        expect(schema.safeParse(value).success).toBe(true);
    });

    it.each([
        'javascript:alert(1)',
        'JaVaScRiPt:alert(1)',
        '\u0001javascript:alert(1)',
        ' javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'blob:https://example.com/abc',
        'ftp://example.com',
        '//example.com',
        'example.com',
        ''
    ])('rejects %j', (value) => {
        const result = schema.safeParse(value);
        expect(result.success).toBe(false);
    });

    it('reports the given i18n key', () => {
        const result = schema.safeParse('javascript:alert(1)');
        expect(result.success ? '' : result.error.issues[0]?.message).toBe('zodError.test.invalid');
    });

    it('stays a plain string schema so pick/omit/partial keep working', () => {
        expect(schema.constructor.name).toBe('ZodURL');
    });
});
