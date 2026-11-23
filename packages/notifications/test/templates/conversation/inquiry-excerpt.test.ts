import { describe, expect, it } from 'vitest';
import {
    buildInquiryExcerpt,
    formatInquiryDates,
    INQUIRY_EXCERPT_MAX_LENGTH,
    maskPhone
} from '../../../src/templates/conversation/inquiry-excerpt';

describe('buildInquiryExcerpt (HOS-2568)', () => {
    it('keeps plain text untouched', () => {
        expect(buildInquiryExcerpt({ message: 'Hola, ¿hay lugar en enero?' }).excerpt).toBe(
            'Hola, ¿hay lugar en enero?'
        );
    });

    it.each([
        ['an http link', 'entrá a http://evil.test/a?b=1 ya', 'entrá a [enlace] ya'],
        ['an https link', 'mirá https://evil.test', 'mirá [enlace]'],
        ['a www link', 'mirá www.evil.test/x', 'mirá [enlace]'],
        ['a bare domain', 'visitá evil.com/promo hoy', 'visitá [enlace] hoy'],
        ['a custom scheme', 'abrí javascript://x', 'abrí [enlace]'],
        ['an email', 'escribí a ana.p@evil.test ahora', 'escribí a [email] ahora'],
        ['a phone with separators', 'llamá al +54 3442 123456 hoy', 'llamá al [teléfono] hoy'],
        ['a plain phone', 'mi cel 3442123456', 'mi cel [teléfono]'],
        ['a dashed phone', 'mi cel 3442-123-456', 'mi cel [teléfono]']
    ])('neutralizes %s', (_label, message, expected) => {
        expect(buildInquiryExcerpt({ message }).excerpt).toBe(expected);
    });

    it.each([
        ['a bracketed international phone', 'llamá +54 (3442) 123-456 hoy', 'llamá [teléfono] hoy'],
        ['a double-spaced phone', 'llamá 3442  123456 hoy', 'llamá [teléfono] hoy'],
        ['a fullwidth-digit phone', 'llamá ０３４４２１２３４５６ hoy', 'llamá [teléfono] hoy'],
        ['a phone split by newlines', 'llamá 3442\n123\n456 hoy', 'llamá [teléfono] hoy'],
        ['a bracket-obfuscated domain', 'entrá a evil[.]com ya', 'entrá a [enlace] ya'],
        ['a paren-obfuscated domain', 'entrá a evil(.)com/x ya', 'entrá a [enlace] ya'],
        ['an ideographic-stop domain', 'entrá a evil。com ya', 'entrá a [enlace] ya'],
        ['a [dot] domain', 'entrá a evil[dot]com ya', 'entrá a [enlace] ya'],
        ['a hxxps link', 'entrá a hxxps[:]//evil[.]com/x ya', 'entrá a [enlace] ya'],
        ['a fullwidth link', 'entrá a ｈｔｔｐ：／／evil.test ya', 'entrá a [enlace] ya'],
        ['an [at] email', 'escribí a ana[at]evil[.]com ya', 'escribí a [email] ya']
    ])('neutralizes %s (HOS-2568 review B1)', (_label, message, expected) => {
        expect(buildInquiryExcerpt({ message }).excerpt).toBe(expected);
    });

    it('stays linear on long hostile input', () => {
        const hostile = [
            'a.'.repeat(2500),
            `${'x@'.repeat(2500)}y`,
            '1 '.repeat(2500),
            `${'a'.repeat(5000)}!`,
            'http://'.repeat(700)
        ];

        const started = performance.now();
        for (const message of hostile) {
            buildInquiryExcerpt({ message });
        }

        expect(performance.now() - started).toBeLessThan(500);
    });

    it('strips NUL characters', () => {
        expect(buildInquiryExcerpt({ message: 'a\u0000b' }).excerpt).toBe('a b');
    });

    it('leaves short numbers such as guest counts alone', () => {
        expect(buildInquiryExcerpt({ message: 'Somos 4 personas, 3 noches' }).excerpt).toBe(
            'Somos 4 personas, 3 noches'
        );
    });

    it('collapses whitespace and control characters to a single line', () => {
        expect(buildInquiryExcerpt({ message: 'a\n\n b\t\tc\u0007d' }).excerpt).toBe('a b c d');
    });

    it('cuts to the maximum length with an ellipsis', () => {
        const { excerpt } = buildInquiryExcerpt({ message: 'x'.repeat(500) });

        expect(excerpt).toHaveLength(INQUIRY_EXCERPT_MAX_LENGTH);
        expect(excerpt.endsWith('…')).toBe(true);
    });

    it('does not add an ellipsis to text that fits', () => {
        const message = 'y'.repeat(INQUIRY_EXCERPT_MAX_LENGTH);

        expect(buildInquiryExcerpt({ message }).excerpt).toBe(message);
    });

    it('never cuts a marker in half', () => {
        const message = `${'a'.repeat(112)} https://evil.test/muy/largo`;
        const { excerpt } = buildInquiryExcerpt({ message });

        expect(excerpt).not.toMatch(/\[[^\]]*…$/);
        expect(excerpt.endsWith('…')).toBe(true);
    });

    it('neutralizes a link before cutting so no fragment of it survives', () => {
        const message = `${'a'.repeat(100)} http://evil.test/abcdefghijklmnop`;

        expect(buildInquiryExcerpt({ message }).excerpt).not.toContain('evil');
    });

    it('returns an empty excerpt for a blank message', () => {
        expect(buildInquiryExcerpt({ message: '  \n ' }).excerpt).toBe('');
    });
});

describe('maskPhone (HOS-2568)', () => {
    it('keeps only the last three digits', () => {
        expect(maskPhone({ phone: '+54 3442 123456' }).masked).toBe('*** 456');
    });

    it('returns empty when there are no digits', () => {
        expect(maskPhone({ phone: 'n/a' }).masked).toBe('');
    });
});

describe('formatInquiryDates (HOS-2568)', () => {
    it('formats both dates', () => {
        expect(formatInquiryDates({ checkIn: '2026-12-12', checkOut: '2026-12-15' })).toBe(
            '12/12/2026 al 15/12/2026'
        );
    });

    it('renders a lone date', () => {
        expect(formatInquiryDates({ checkIn: '2026-12-12' })).toBe('12/12/2026');
    });

    it('drops anything that is not a plain date', () => {
        expect(formatInquiryDates({ checkIn: 'http://evil.test', checkOut: null })).toBe('');
    });
});
