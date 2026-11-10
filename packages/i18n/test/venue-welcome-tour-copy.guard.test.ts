/**
 * @file venue-welcome-tour-copy.guard.test.ts
 * @description HOS-2093: the welcome tour a venue owner sees on first login must stay
 * vertical-neutral (the vertical is "Food & nightlife", not a restaurant), speak of
 * "carta o barra" instead of a bare menu, use Rioplatense voseo with accents in es, and
 * the account menu label must be translated in en/pt.
 */

import { describe, expect, it } from 'vitest';
import enAccount from '../src/locales/en/account.json';
import esAccount from '../src/locales/es/account.json';
import ptAccount from '../src/locales/pt/account.json';

const LOCALES = { es: esAccount, en: enAccount, pt: ptAccount } as const;
type Lang = keyof typeof LOCALES;

const VENUE_KEYS = [
    ['greetingVenue', 'title'],
    ['greetingVenue', 'body'],
    ['listingVenue', 'body'],
    ['venueQr', 'title'],
    ['venueQr', 'body']
] as const;

const BANNED: Record<Lang, RegExp> = {
    es: /restaurante|\bmen[uú]\b/i,
    en: /restaurant|\bmenu\b/i,
    pt: /restaurante|card[aá]pio/i
};

function venueStrings(lang: Lang): readonly (readonly [string, string])[] {
    const tour = LOCALES[lang].welcomeTour as unknown as Record<string, Record<string, string>>;
    return VENUE_KEYS.map(([group, key]) => [`${group}.${key}`, tour[group]?.[key] ?? ''] as const);
}

describe('venue welcome tour copy is vertical-neutral (HOS-2093)', () => {
    for (const lang of ['es', 'en', 'pt'] as const) {
        for (const [path, value] of venueStrings(lang)) {
            it(`${lang} welcomeTour.${path} is non-empty and avoids restaurant/menu wording`, () => {
                expect(value).not.toBe('');
                expect(value).not.toMatch(BANNED[lang]);
            });
        }
    }

    it('es uses accented voseo forms', () => {
        const all = venueStrings('es')
            .map(([, v]) => v)
            .join(' | ');
        for (const form of ['acá', 'podés', 'público', 'Editá', 'Generá', 'consultá', 'cuántas']) {
            expect(all).toContain(form);
        }
        for (const bad of ['aca ', 'podes', 'publico', 'Edita ', 'Genera ', 'cuantas', 'codigo']) {
            expect(all).not.toContain(bad);
        }
    });

    it('uses the house neutral pattern for the offering', () => {
        const get = (l: Lang, p: string) => venueStrings(l).find(([k]) => k === p)?.[1] ?? '';
        expect(get('es', 'listingVenue.body')).toContain('carta o barra');
        expect(get('es', 'venueQr.body')).toContain('carta o barra');
        expect(get('en', 'listingVenue.body')).toContain('food or drinks');
        expect(get('en', 'venueQr.body')).toContain('food or drinks');
        expect(get('pt', 'listingVenue.body')).toContain('opções de comida ou bebida');
        expect(get('pt', 'venueQr.body')).toContain('opções de comida ou bebida');
    });
});

describe('es welcome tour is written with accents and voseo (HOS-2093)', () => {
    const tour = esAccount.welcomeTour as unknown as Record<string, Record<string, string>>;
    const all = Object.entries(tour).flatMap(([group, entries]) =>
        Object.entries(entries).map(([key, value]) => [`${group}.${key}`, value] as const)
    );
    const UNACCENTED =
        /\b(aca|podes|tenes|necesitas|rapido|facil|mas|donde|seccion|informacion|configuracion|descripcion|publico|publica|codigo|cuantas|estadias|anfitrion)\b/i;
    const TUTEO_IMPERATIVE = /^(Guarda|Activa|Revisa|Segui|Edita|Crea|Publica|Actualiza|Genera) /;

    for (const [path, value] of all) {
        it(`es welcomeTour.${path} has no unaccented words or tuteo imperatives`, () => {
            expect(value).not.toMatch(UNACCENTED);
            expect(value).not.toMatch(TUTEO_IMPERATIVE);
        });
    }
});

describe('account menu label is translated (HOS-2093)', () => {
    it('es keeps the Spanish label', () => {
        expect(esAccount.menu).toBe('Menú de cuenta');
    });
    it('en and pt are not the Spanish string', () => {
        expect(enAccount.menu).toBe('Account menu');
        expect(ptAccount.menu).toBe('Menu da conta');
        expect(enAccount.menu).not.toBe(esAccount.menu);
        expect(ptAccount.menu).not.toBe(esAccount.menu);
    });
});
