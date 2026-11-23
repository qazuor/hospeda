/**
 * @file email-attribution-legal-copy.guard.test.ts
 * @description HOS-2359 (OD-7, AC-21): the privacy policy must tell readers, in
 * es, en and pt, that our emails carry an aggregate open pixel that does not
 * identify the recipient, that our links carry campaign parameters (UTM)
 * analysed with Umami, that Brevo measures newsletter opens and clicks, and that
 * there is no individual opt-out. Modelled on
 * `session-recording-legal-copy.guard.test.ts`.
 *
 * The copy writes "UTM", never the literal `utm_` prefix: the Spanish fallback is
 * duplicated into `apps/web/src`, where a static guard forbids that literal
 * outside `withUtm()`.
 *
 * Locale files are imported as modules: `test/setup.ts` stubs `node:fs` reads
 * under `locales/`, so an fs-based read would inspect a stub.
 */
import { describe, expect, it } from 'vitest';

type PrivacyFile = {
    readonly sections?: {
        readonly emailAttribution?: { readonly title?: string; readonly body?: string };
    };
};

const MODULES = import.meta.glob<PrivacyFile>('../src/locales/*/privacy.json', {
    eager: true,
    import: 'default'
});

const LOCALES = ['es', 'en', 'pt'] as const;

/** What each locale's paragraph must state (OD-7 items 1-6, spec §6.E.1). */
const REQUIRED: Readonly<Record<(typeof LOCALES)[number], readonly RegExp[]>> = {
    es: [/Brevo/, /UTM/, /Umami/, /agregada/, /misma imagen/, /aproximad/, /no se cuenta/],
    en: [/Brevo/, /UTM/, /Umami/, /aggregate/, /same image/, /approximate/, /not counted/],
    pt: [/Brevo/, /UTM/, /Umami/, /agregada/, /mesma imagem/, /aproximad/, /não é contada/]
};

describe('email and campaign attribution legal copy (HOS-2359 AC-21)', () => {
    for (const locale of LOCALES) {
        it(`${locale}/privacy.json carries the email and campaigns section`, () => {
            // Arrange
            const mod = MODULES[`../src/locales/${locale}/privacy.json`];

            // Act
            const section = mod?.sections?.emailAttribution;

            // Assert
            expect(section?.title, 'title').toBeTruthy();
            expect(section?.body, 'body').toBeTruthy();
            for (const pattern of REQUIRED[locale]) {
                expect(section?.body).toMatch(pattern);
            }
        });
    }

    it('never writes the literal utm_ prefix (the web fallback would trip its guard)', () => {
        for (const mod of Object.values(MODULES)) {
            const text = `${mod.sections?.emailAttribution?.title} ${mod.sections?.emailAttribution?.body}`;
            expect(text).not.toContain('utm_');
        }
    });

    it('checked all three locales', () => {
        expect(Object.keys(MODULES)).toHaveLength(LOCALES.length);
    });
});
