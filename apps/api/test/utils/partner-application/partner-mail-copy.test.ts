import { describe, expect, it } from 'vitest';
import en from '../../../../../packages/i18n/src/locales/en/notifications.json';
import es from '../../../../../packages/i18n/src/locales/es/notifications.json';
import pt from '../../../../../packages/i18n/src/locales/pt/notifications.json';
import { resolvePartnerMailCopy } from '../../../src/utils/partner-application/partner-mail-copy.js';

const locales = { es, en, pt } as const;

describe('partner application mail copy', () => {
    it.each(['es', 'en', 'pt'] as const)('resolves complete claim copy from %s JSON', (locale) => {
        const source = locales[locale].partnerApplication.claimNotice;
        expect(
            resolvePartnerMailCopy({ kind: 'claim-notice', locale, partnerName: 'Casa' })
        ).toEqual({
            subject: source.subject,
            preview: source.preview.replace('{{partnerName}}', 'Casa'),
            heading: source.heading.replace('{{partnerName}}', 'Casa'),
            paragraphs: [source.body, source.singleUse, source.ignore],
            cta: source.cta
        });
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('resolves complete rejected copy from %s JSON', (locale) => {
        const source = locales[locale].partnerApplication.rejected;
        const date = new Intl.DateTimeFormat(
            locale === 'es' ? 'es-AR' : locale === 'pt' ? 'pt-BR' : 'en-US',
            { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' }
        ).format(new Date('2026-11-04T02:30:00.000Z'));
        expect(
            resolvePartnerMailCopy({
                kind: 'rejected',
                locale,
                reapplyAfter: new Date('2026-11-04T02:30:00.000Z')
            })
        ).toEqual({
            subject: source.subject,
            preview: source.preview,
            heading: source.heading,
            paragraphs: [source.body, source.reapply.replace('{{date}}', date)]
        });
    });

    it('formats dates in the Buenos Aires market timezone', () => {
        const copy = resolvePartnerMailCopy({
            kind: 'rejected',
            locale: 'es',
            reapplyAfter: new Date('2026-11-04T02:30:00.000Z')
        });
        expect(copy.paragraphs[1]).toContain('3 de noviembre de 2026');
    });
});
