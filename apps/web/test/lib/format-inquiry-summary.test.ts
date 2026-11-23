import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    describe.each([
        'America/Argentina/Buenos_Aires',
        'America/Los_Angeles',
        'Asia/Tokyo'
    ])('with the process timezone set to %s', (zone) => {
        beforeEach(() => {
            vi.stubEnv('TZ', zone);
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('really runs in that zone: a UTC-midnight instant is another local day west of UTC', () => {
            // Guards the test itself: without it the cases below could pass in any zone.
            const probe = new Date('2026-12-01T00:00:00Z');
            expect(probe.getDate()).toBe(zone === 'Asia/Tokyo' ? 1 : 30);
        });

        it('keeps the stored day instead of shifting it with the reader timezone', () => {
            expect(plain(formatInquirySummary({ locale: 'es', checkIn: '2026-12-01' }))).toBe(
                'Desde el 1 dic'
            );
            expect(
                plain(
                    formatInquirySummary({
                        locale: 'es',
                        checkIn: '2026-12-01',
                        checkOut: '2026-12-04'
                    })
                )
            ).toBe('1–4 dic');
        });
    });

    it('returns null when the conversation carries no booking data', () => {
        expect(formatInquirySummary({ locale: 'es' })).toBeNull();
        expect(
            formatInquirySummary({ locale: 'es', checkIn: null, checkOut: null, guests: null })
        ).toBeNull();
    });
});
