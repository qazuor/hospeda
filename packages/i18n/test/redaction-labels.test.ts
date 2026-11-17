/**
 * Unit tests for `localizeRedactionTokens` (HOS-2320): the stored redaction
 * markers are technical, owners must see a label in their own language.
 */

import { describe, expect, it } from 'vitest';
import { localizeRedactionTokens } from '../src/redaction-labels';

describe('localizeRedactionTokens', () => {
    it.each([
        ['es', '[REDACTED_EMAIL]', '[email oculto]'],
        ['es', '[REDACTED_PHONE]', '[teléfono oculto]'],
        ['es', '[REDACTED_CARD]', '[tarjeta oculta]'],
        ['en', '[REDACTED_EMAIL]', '[email hidden]'],
        ['en', '[REDACTED_PHONE]', '[phone hidden]'],
        ['en', '[REDACTED_CARD]', '[card hidden]'],
        ['pt', '[REDACTED_EMAIL]', '[e-mail oculto]'],
        ['pt', '[REDACTED_PHONE]', '[telefone oculto]'],
        ['pt', '[REDACTED_CARD]', '[cartão oculto]']
    ] as const)('%s: %s -> %s', (locale, token, label) => {
        const { text } = localizeRedactionTokens({ text: `a ${token} b`, locale });
        expect(text).toBe(`a ${label} b`);
        expect(text).not.toContain('REDACTED');
    });

    it('replaces every occurrence of several kinds', () => {
        const { text } = localizeRedactionTokens({
            text: 'Llamenme al [REDACTED_PHONE] o a [REDACTED_EMAIL] o [REDACTED_PHONE]',
            locale: 'es'
        });
        expect(text).toBe('Llamenme al [teléfono oculto] o a [email oculto] o [teléfono oculto]');
    });

    it('leaves text without tokens untouched', () => {
        expect(localizeRedactionTokens({ text: 'Hay pileta?', locale: 'en' }).text).toBe(
            'Hay pileta?'
        );
    });

    it('does not touch unknown bracketed tokens', () => {
        expect(localizeRedactionTokens({ text: '[REDACTED_OTHER]', locale: 'es' }).text).toBe(
            '[REDACTED_OTHER]'
        );
    });
});
