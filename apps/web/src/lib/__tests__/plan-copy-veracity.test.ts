/**
 * Retains the claim guard for locale copy while the paid plan catalogue is
 * rebuilt. Plan-to-entitlement comparisons resume with the V2 catalogue.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

const PHANTOM_PHRASES: Readonly<Record<(typeof LOCALES)[number], readonly string[]>> = {
    es: ['sin publicidad', 'sin anuncios', 'traslados al aeropuerto', 'soporte 24/7'],
    en: ['ad-free', 'ad free', 'airport transfer', '24/7 support'],
    pt: ['sem anúncios', 'sem publicidade', 'traslados ao aeroporto', 'suporte 24/7']
};

describe('marketing copy veracity (HOS-331)', () => {
    it.each(LOCALES)('keeps phantom claims out of public billing copy (%s)', (locale) => {
        const billing = readFileSync(resolve(LOCALES_DIR, locale, 'billing.json'), 'utf8');
        const adminBilling = readFileSync(
            resolve(LOCALES_DIR, locale, 'admin-billing.json'),
            'utf8'
        );
        const copy = `${billing}\n${adminBilling}`.toLowerCase();
        for (const phrase of PHANTOM_PHRASES[locale]) {
            expect(copy, `${locale}: ${phrase}`).not.toContain(phrase);
        }
    });
});
