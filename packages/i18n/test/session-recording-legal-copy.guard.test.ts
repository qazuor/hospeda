/**
 * @file session-recording-legal-copy.guard.test.ts
 * @description HOS-2347 (OQ-7): the privacy and cookie policies must tell
 * visitors that Hospeda may record anonymised session replays and heatmaps
 * with Umami. The guard asserts the section exists in es, en and pt, names
 * Umami, states the 60-day ceiling and never pins a fixed retention number.
 *
 * Locale files are imported as modules: `test/setup.ts` stubs `node:fs`
 * reads under `locales/`, so an fs-based read would inspect a stub.
 */

import { describe, expect, it } from 'vitest';

type SectionFile = {
    readonly recording?: Readonly<Record<string, string>>;
    readonly sections?: {
        readonly sessionRecording?: { readonly title?: string; readonly body?: string };
    };
};

const MODULES = import.meta.glob<SectionFile>('../src/locales/*/{cookies,privacy}.json', {
    eager: true,
    import: 'default'
});

const LOCALES = ['es', 'en', 'pt'] as const;
const FILES = ['cookies', 'privacy'] as const;

const recordingText = (mod?: SectionFile) =>
    [mod?.sections?.sessionRecording?.body, ...Object.values(mod?.recording ?? {})].join(' ');

/** Substrings each locale's paragraph must carry (masking, consent, sampling, retention). */
const REQUIRED: Readonly<Record<(typeof LOCALES)[number], readonly RegExp[]>> = {
    es: [
        /Umami/,
        /cookies de analítica/,
        /enmascaran/,
        /muestra/,
        /hasta 60 días/,
        /automáticamente/
    ],
    en: [/Umami/, /analytics cookies/, /masked/, /sample/, /up to 60 days/, /automatically/],
    pt: [/Umami/, /cookies de análise/, /mascarados/, /amostra/, /até 60 dias/, /automaticamente/]
};

describe('session recording legal copy (HOS-2347 OQ-7)', () => {
    for (const locale of LOCALES) {
        for (const file of FILES) {
            it(`${locale}/${file}.json carries the session recording section`, () => {
                // Arrange
                const mod = MODULES[`../src/locales/${locale}/${file}.json`];

                // Act
                const section = mod?.sections?.sessionRecording;

                // Assert
                expect(section?.title, 'title').toBeTruthy();
                expect(section?.body, 'body').toBeTruthy();
                for (const pattern of REQUIRED[locale]) {
                    expect(recordingText(mod)).toMatch(pattern);
                }
            });
        }
    }

    it('never calls the recordings anonymous: they are pseudonymous', () => {
        for (const mod of Object.values(MODULES)) {
            const text = `${mod.sections?.sessionRecording?.title} ${recordingText(mod)}`;
            expect(text).not.toMatch(/an[oó]nim|anonymi|an[oô]nim/i);
        }
        for (const [locale, pattern] of [
            ['es', /seudónimas/],
            ['en', /pseudonymous/],
            ['pt', /pseudônimas/]
        ] as const) {
            for (const file of FILES) {
                const body = recordingText(MODULES[`../src/locales/${locale}/${file}.json`]);
                expect(body).toMatch(pattern);
                expect(body).toMatch(/account|cuenta|conta/);
            }
        }
    });

    it('never pins a fixed retention: 14 and 30 days are not promised', () => {
        for (const mod of Object.values(MODULES)) {
            expect(recordingText(mod)).not.toMatch(/\b(14|30)\b/);
        }
    });
});
