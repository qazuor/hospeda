import { describe, expect, it } from 'vitest';
import { formatInquirySummary } from '../../src/lib/format-inquiry-summary';

/** ICU mixes thin and no-break spaces into ranges; compare on plain spaces. */
const plain = (value: string | null) => value?.replace(/\s/g, ' ') ?? null;

describe('formatInquirySummary', () => {
    it('renders dates and guests as 12–15 dic · 2 huéspedes in es', () => {
        const summary = formatInquirySummary({
            locale: 'es',
            checkIn: '2026-12-12',
            checkOut: '2026-12-15',
            guests: 2
        });
        expect(plain(summary)).toBe('12–15 dic · 2 huéspedes');
    });

    it('uses the singular for one guest', () => {
        expect(formatInquirySummary({ locale: 'es', guests: 1 })).toBe('1 huésped');
    });

    it('localizes to en and pt', () => {
        const en = formatInquirySummary({
            locale: 'en',
            checkIn: '2026-12-12',
            checkOut: '2026-12-15',
            guests: 2
        });
        const pt = formatInquirySummary({ locale: 'pt', guests: 3 });
        expect(plain(en)).toBe('Dec 12 – 15 · 2 guests');
        expect(pt).toBe('3 hóspedes');
    });

    it('renders a lone check-in or check-out with its own wording', () => {
        expect(formatInquirySummary({ locale: 'es', checkIn: '2026-12-12' })).toBe(
            'Desde el 12 dic'
        );
        expect(formatInquirySummary({ locale: 'es', checkOut: '2026-12-15' })).toBe(
            'Hasta el 15 dic'
        );
    });

    it('does not shift the day with the reader timezone', () => {
        // A UTC-midnight stored date must keep naming the same day.
        expect(plain(formatInquirySummary({ locale: 'es', checkIn: '2026-12-01' }))).toBe(
            'Desde el 1 dic'
        );
    });

    it('returns null when the conversation carries no booking data', () => {
        expect(formatInquirySummary({ locale: 'es' })).toBeNull();
        expect(
            formatInquirySummary({ locale: 'es', checkIn: null, checkOut: null, guests: null })
        ).toBeNull();
    });
});
