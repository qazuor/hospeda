/**
 * @file venue-menu-upsell-copy.guard.test.ts
 * @description The carta upsell must not promise a file or a link separately
 * (HOS-1787 leaf 5.3, AC:5:8, TEST:5.3:3).
 *
 * DEC-FAC-062 makes the WHOLE carta the paid capability: dishes, uploaded file
 * and external link. The pre-5.3 copy advertised "upload a photo or a PDF" as
 * the feature, which read as a promise of that one piece. The negative rule is
 * what the owner approved: no single file type and no separate "link" promise.
 *
 * The guard is static on purpose — copy drifts silently, and the three locales
 * would drift independently. It scans the two upsell keys per locale and the
 * Spanish fallbacks rendered by both upsell components when a key is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MANAGER_SOURCE_PATH = path.resolve(
    __dirname,
    '../../../src/components/venue/VenueMenuManager.client.tsx'
);

const PLAN_NOTICE_SOURCE_PATH = path.resolve(
    __dirname,
    '../../../src/components/venue/VenueMenuPlanNotice.client.tsx'
);

const I18N_LOCALES_DIR = path.resolve(__dirname, '../../../../../packages/i18n/src/locales');

/** The two upsell keys this leaf rewrites. */
const UPSELL_KEYS = ['locked', 'lockedPreTrial'] as const;

/**
 * Forbidden promises per language: a single deliverable (file type, image,
 * document) or the act of sending one, plus the link as a feature of its own.
 *
 * The bare noun for the carta's uploaded file ("archivo"/"file"/"arquivo") is
 * deliberately absent: the approved copy names the carta's contents as a whole
 * and uses that noun, so it is not a promise of a separate deliverable.
 */
const FORBIDDEN_TERMS_BY_LOCALE: Readonly<Record<'es' | 'en' | 'pt', readonly string[]>> = {
    es: ['pdf', 'foto', 'enlace', 'imagen', 'documento', 'subir'],
    en: ['pdf', 'photo', 'link', 'image', 'document', 'upload'],
    pt: ['pdf', 'foto', 'link', 'imagem', 'documento', 'enviar']
};

/** The word that names the section in each language. */
const SECTION_WORD_BY_LOCALE: Readonly<Record<'es' | 'en' | 'pt', string>> = {
    es: 'carta',
    en: 'menu',
    pt: 'cardápio'
};

interface MenuManagerCopy {
    readonly locked?: unknown;
    readonly lockedPreTrial?: unknown;
}

function loadUpsellStrings(locale: 'es' | 'en' | 'pt'): string[] {
    const filePath = path.join(I18N_LOCALES_DIR, locale, 'venue.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
        owner?: { editor?: { menuManager?: MenuManagerCopy } };
    };
    const menuManager = content.owner?.editor?.menuManager;

    return UPSELL_KEYS.map((key) => menuManager?.[key]).filter(
        (value): value is string => typeof value === 'string'
    );
}

/** Reads a JSX string attribute from the manager source. */
function sourceAttribute(name: string): string {
    const source = fs.readFileSync(MANAGER_SOURCE_PATH, 'utf-8');
    const match = source.match(new RegExp(`${name}="([^"]+)"`));

    if (!match?.[1]) {
        throw new Error(`VenueMenuManager is missing the "${name}" fallback`);
    }

    return match[1];
}

/** Reads the Spanish fallback passed to `t(key, fallback)` in a source file. */
function translationFallback(sourcePath: string, key: string): string {
    const source = fs.readFileSync(sourcePath, 'utf-8');
    const match = source.match(
        new RegExp(`'venue\\.owner\\.editor\\.menuManager\\.${key}'\\s*,\\s*'([^']+)'`)
    );

    if (!match?.[1]) {
        throw new Error(`${path.basename(sourcePath)} is missing the "${key}" fallback`);
    }

    return match[1];
}

function assertNoForbiddenPromises(fallbacks: readonly string[], origin: string): void {
    const hits = fallbacks.flatMap((text) =>
        forbiddenHits(text, FORBIDDEN_TERMS_BY_LOCALE.es).map((term) => `"${term}" in "${text}"`)
    );

    expect(hits, `Forbidden promises in ${origin}: ${hits.join(', ')}`).toEqual([]);
}

function forbiddenHits(text: string, terms: readonly string[]): string[] {
    const lower = text.toLowerCase();
    return terms.filter((term) => lower.includes(term));
}

describe('carta upsell wording (AC:5:8)', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`the ${locale} upsell names the carta and promises no file type or link`, () => {
            const strings = loadUpsellStrings(locale);

            expect(
                strings,
                `menuManager.${UPSELL_KEYS.join('/')} missing in ${locale}`
            ).toHaveLength(UPSELL_KEYS.length);

            const hits = strings.flatMap((text) =>
                forbiddenHits(text, FORBIDDEN_TERMS_BY_LOCALE[locale]).map(
                    (term) => `"${term}" in "${text}"`
                )
            );

            expect(hits, `Forbidden promises found in ${locale}/venue.json`).toEqual([]);

            // The positive half: the copy still names what it unlocks. Without
            // this, deleting the sentence altogether would pass the negative test.
            expect(strings.join(' ').toLowerCase()).toContain(SECTION_WORD_BY_LOCALE[locale]);
        });
    }

    it('the Spanish fallbacks rendered by the manager carry no forbidden promise', () => {
        assertNoForbiddenPromises(
            [sourceAttribute('messageFallback'), sourceAttribute('preTrialMessageFallback')],
            'VenueMenuManager fallbacks'
        );
    });

    it('the Spanish fallbacks rendered by the plan notice carry no forbidden promise', () => {
        assertNoForbiddenPromises(
            [
                translationFallback(PLAN_NOTICE_SOURCE_PATH, 'locked'),
                translationFallback(PLAN_NOTICE_SOURCE_PATH, 'lockedPreTrial')
            ],
            'VenueMenuPlanNotice fallbacks'
        );
    });
});
