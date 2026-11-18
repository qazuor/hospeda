/**
 * @file recording-exclusions.test.ts
 * @description The session recorder's route exclusion list and its matcher
 * (HOS-2347 §6.5, AC-R1, AC-R2, AC-R4).
 */

import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    isRecordingExcludedPath,
    RECORDING_EXCLUDED_ROUTE_PREFIXES
} from '@/lib/analytics/recording-exclusions';

const PAGES_LANG_DIR = resolve(import.meta.dirname, '../../../src/pages/[lang]');

describe('isRecordingExcludedPath (HOS-2347)', () => {
    it.each([
        '/es/auth/signin/',
        '/en/mi-cuenta/favoritos/',
        '/pt/guest/messages/abc',
        '/es/suscriptores/checkout/?plan=x',
        '/es/publicar/nueva',
        '/es/feedback/',
        '/es/colaborar/fotos/',
        '/es/contacto/',
        '/es/partners/reclamar/',
        '/es/sumate/proveedor/',
        '/es/sumate/sponsor/',
        '/es/sumate/partner/',
        '/en/sumate/',
        '/es/newsletter/confirmado'
    ])('AC-R1: excludes %s', (pathname) => {
        expect(isRecordingExcludedPath({ pathname })).toBe(true);
    });

    it.each(
        RECORDING_EXCLUDED_ROUTE_PREFIXES.flatMap((prefix) =>
            ['es', 'en', 'pt'].map((lang) => `/${lang}/${prefix}/`)
        )
    )('AC-R1: excludes every prefix in every locale: %s', (pathname) => {
        expect(isRecordingExcludedPath({ pathname })).toBe(true);
    });

    it.each([
        '/es/',
        '/es/alojamientos/x/',
        '/es/publicaciones/',
        '/es/partners/foo/',
        '/es/suscriptores/planes/',
        '/es/sumatoria/',
        '/es/contactos-utiles/'
    ])('AC-R2: allows %s (prefix boundary)', (pathname) => {
        expect(isRecordingExcludedPath({ pathname })).toBe(false);
    });

    it('is case-insensitive and ignores the query string and the hash', () => {
        expect(isRecordingExcludedPath({ pathname: '/ES/Auth/SignIn' })).toBe(true);
        expect(isRecordingExcludedPath({ pathname: '/es/contacto#form' })).toBe(true);
        expect(isRecordingExcludedPath({ pathname: '/es/?next=/es/auth/' })).toBe(false);
    });

    it('matches with no locale segment and with no trailing slash', () => {
        expect(isRecordingExcludedPath({ pathname: '/auth/signin' })).toBe(true);
        expect(isRecordingExcludedPath({ pathname: '/es/contacto' })).toBe(true);
    });
});

describe('RECORDING_EXCLUDED_ROUTE_PREFIXES guard (HOS-2347 AC-R4)', () => {
    it.each(
        RECORDING_EXCLUDED_ROUTE_PREFIXES
    )('maps %s to an existing directory under src/pages/[lang]/', (prefix) => {
        // Arrange
        const dir = join(PAGES_LANG_DIR, prefix);

        // Act
        const isDirectory = (() => {
            try {
                return statSync(dir).isDirectory();
            } catch {
                return false;
            }
        })();

        // Assert
        expect(isDirectory, `${dir} must exist; a renamed route drops out of the exclusion`).toBe(
            true
        );
    });

    it('holds the eleven agreed route families, without duplicates', () => {
        expect(RECORDING_EXCLUDED_ROUTE_PREFIXES).toHaveLength(11);
        expect(new Set(RECORDING_EXCLUDED_ROUTE_PREFIXES).size).toBe(11);
    });
});
