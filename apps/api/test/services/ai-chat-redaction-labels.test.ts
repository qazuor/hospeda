/**
 * Drift guard (HOS-2320): every marker the redactor can emit must have a
 * localized label, so owners never see a raw `[REDACTED_*]` token.
 */

import { type PiiKind, scrubPii } from '@repo/ai-core';
import { localizeRedactionTokens } from '@repo/i18n';
import { describe, expect, it } from 'vitest';

const SAMPLES: Record<PiiKind, string> = {
    email: 'Escribime a juan.perez@example.com por favor',
    phone: 'Llamame al +54 9 3442 123456 hoy',
    card: 'Mi tarjeta es 4111 1111 1111 1111 gracias'
};

describe('redaction markers have owner-facing labels', () => {
    it.each(Object.keys(SAMPLES) as PiiKind[])('%s', (kind) => {
        const { scrubbed } = scrubPii({ text: SAMPLES[kind] });
        expect(scrubbed).toContain('[REDACTED_');
        for (const locale of ['es', 'en', 'pt'] as const) {
            const { text } = localizeRedactionTokens({ text: scrubbed, locale });
            expect(text).not.toContain('REDACTED');
        }
    });
});
