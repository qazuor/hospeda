/**
 * What a certificate says, asserted without rendering one (HOS-1057).
 *
 * ---
 * The two things in this module that can be wrong in a way nothing else catches:
 *
 * - **The QR's URL.** It is printed onto paper somebody keeps, so a wrong path
 *   segment is a permanent 404 that no deploy fixes. It is asserted LITERALLY
 *   rather than rebuilt from the same constants the code uses — a test that
 *   reuses the implementation's own segment agrees with any typo.
 * - **The date.** `completedAt` is a plain `YYYY-MM-DD` day. Feeding it to
 *   `new Date()` and formatting the result in the server's zone prints the day
 *   BEFORE for every western-hemisphere server, on the single field the
 *   recipient checks against their own memory. The test runs the boundary case
 *   (the 1st of a month) with the process pinned to a negative-offset zone,
 *   which is exactly the configuration that produces the bug.
 *
 * @module test/services/experience-certificate-content
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    buildCertificateContent,
    buildExperiencePublicUrl,
    formatCertificateDate
} from '../../src/services/experience-certificate/certificate-content.ts';

describe('buildExperiencePublicUrl (HOS-1057)', () => {
    it('points at the experience ficha, with the locale and the Spanish segment', () => {
        expect(
            buildExperiencePublicUrl({
                slug: 'pesca-en-el-rio-uruguay',
                locale: 'es',
                siteUrl: 'https://hospeda.com.ar'
            })
        ).toBe('https://hospeda.com.ar/es/experiencias/pesca-en-el-rio-uruguay/');
    });

    it('keeps the Spanish path segment in every locale', () => {
        // The segments are identical in all three locales — the web app's own
        // routing says so. A locale-specific segment here would 404.
        expect(
            buildExperiencePublicUrl({
                slug: 'kayak',
                locale: 'en',
                siteUrl: 'https://hospeda.com.ar'
            })
        ).toBe('https://hospeda.com.ar/en/experiencias/kayak/');
    });

    it('tolerates a trailing slash on the configured site URL', () => {
        expect(
            buildExperiencePublicUrl({
                slug: 'kayak',
                locale: 'es',
                siteUrl: 'https://hospeda.com.ar/'
            })
        ).toBe('https://hospeda.com.ar/es/experiencias/kayak/');
    });
});

describe('formatCertificateDate (HOS-1057)', () => {
    const originalTz = process.env.TZ;

    beforeAll(() => {
        // Buenos Aires: UTC-3. A `YYYY-MM-DD` parsed as UTC midnight and
        // rendered here lands on the PREVIOUS day, which is the whole bug.
        process.env.TZ = 'America/Argentina/Buenos_Aires';
    });

    afterAll(() => {
        process.env.TZ = originalTz;
    });

    it('prints the day that was stored, not the day before it', () => {
        // The 1st of a month is the case where the off-by-one also changes the
        // month name, so a wrong answer here is unmistakable.
        expect(formatCertificateDate({ completedAt: '2026-03-01', locale: 'es' })).toContain('1');
        expect(formatCertificateDate({ completedAt: '2026-03-01', locale: 'es' })).toContain(
            'marzo'
        );
        expect(formatCertificateDate({ completedAt: '2026-03-01', locale: 'es' })).not.toContain(
            'febrero'
        );
    });

    it('prints the day in the reader locale', () => {
        expect(formatCertificateDate({ completedAt: '2026-03-14', locale: 'en' })).toContain(
            'March'
        );
    });

    it('prints an unexpected value verbatim rather than blank', () => {
        // The schema forbids it; if one ever arrives, the honest thing on paper
        // is the raw string, not an empty line.
        expect(formatCertificateDate({ completedAt: 'not-a-date', locale: 'es' })).toBe(
            'not-a-date'
        );
    });
});

describe('buildCertificateContent (HOS-1057)', () => {
    const base = {
        certificate: { recipientName: 'Ana Pérez', completedAt: '2026-03-14' },
        experience: { slug: 'pesca-en-el-rio-uruguay', name: 'Pesca en el río Uruguay' },
        locale: 'es' as const,
        siteUrl: 'https://hospeda.com.ar'
    };

    it('carries the recipient VERBATIM', () => {
        // Never normalised, never title-cased: the provider typed a person's
        // name and the sheet prints what they typed.
        expect(buildCertificateContent(base).recipientName).toBe('Ana Pérez');
    });

    it('prefers the localized listing name over the raw column', () => {
        const content = buildCertificateContent({
            ...base,
            locale: 'en',
            experience: {
                ...base.experience,
                nameI18n: { es: 'Pesca en el río Uruguay', en: 'Fishing on the Uruguay river' }
            }
        });
        expect(content.experienceName).toBe('Fishing on the Uruguay river');
    });

    it('falls back to the raw name when the locale has no translation', () => {
        const content = buildCertificateContent({
            ...base,
            locale: 'pt',
            experience: { ...base.experience, nameI18n: { pt: null } }
        });
        expect(content.experienceName).toBe('Pesca en el río Uruguay');
    });

    it('points the QR at the listing public ficha', () => {
        expect(buildCertificateContent(base).publicUrl).toBe(
            'https://hospeda.com.ar/es/experiencias/pesca-en-el-rio-uruguay/'
        );
    });

    it('never leaves a line empty, so nothing prints as a blank row', () => {
        const content = buildCertificateContent(base);
        for (const line of [
            content.title,
            content.preamble,
            content.connector,
            content.dateLine,
            content.qrHint,
            content.footer
        ]) {
            expect(line.length).toBeGreaterThan(0);
        }
    });
});
