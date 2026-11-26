import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';
import { buildExperienceContactPrice } from '@/lib/listing-contact/listing-channels';
import { getListingPriceCardDisplay } from '@/lib/listing-contact/listing-contact-price';
import { resolvePriceCardAction } from '@/lib/listing-contact/price-card-action';

describe('ListingPriceCard', () => {
    it('CARD-025 H-2: uses one prominent heading for either price state', () => {
        const source = readFileSync(
            resolve(__dirname, '../../../src/components/listing/contact/ListingPriceCard.astro'),
            'utf8'
        );

        expect(source.includes('<h2 class="listing-price-card__title">{display.title}</h2>')).toBe(
            true
        );
        expect(/\.listing-price-card__title\s*\{[^}]*font: var\(--app-title\)/.test(source)).toBe(
            true
        );
    });

    it('CARD-025 H-2 / CARD-026 H-2: gives an unpriced stay a request CTA and reply expectation', () => {
        const action = resolvePriceCardAction({ canInquire: true });
        const display = getListingPriceCardDisplay({ price: null, locale: 'es', hostReply: true });

        expect(action.kind === 'inquire' && createTranslations('es').t(action.labelKey)).toBe(
            'Pedir precio'
        );
        expect(display).toEqual({
            title: 'Precio a consultar',
            note: 'El anfitrión te responderá con el precio.'
        });
    });

    it('CARD-055 H-2: keeps a safe venue menu ahead of available direct contact', () => {
        const menuHref = 'https://example.com/menu';
        const action = resolvePriceCardAction({
            menuHref,
            phoneHref: 'tel:+543441234567',
            email: 'owner@example.com'
        });

        expect(action).toMatchObject({ kind: 'menu', href: menuHref });
        expect('labelKey' in action && createTranslations('es').t(action.labelKey)).toBe(
            'Ver carta'
        );
    });

    it('CARD-055 H-2 / CARD-058 H-1: uses a real dial link before email if no menu is usable', () => {
        const phoneHref = 'tel:+543441234567';
        const action = resolvePriceCardAction({
            menuHref: 'bad menu',
            phoneHref,
            email: 'owner@example.com'
        });

        expect(action).toMatchObject({ kind: 'phone', href: phoneHref });
        expect('labelKey' in action && createTranslations('es').t(action.labelKey)).toBe('Llamar');
    });

    it('CARD-058 H-1: formats centavos in the title and preserves the per-person unit', () => {
        const price = buildExperienceContactPrice({
            priceFrom: 650_000,
            priceUnit: 'per_person',
            isPriceOnRequest: false
        });
        const display = getListingPriceCardDisplay({ price, locale: 'es' });

        expect(display.title.replace(/\s/g, '')).toBe('Desde$6.500');
        expect(display.unit).toBe('/persona');
        expect(display.note).toBeUndefined();
    });

    it.each([
        ['es', 'Precio a consultar', 'Consultá el precio por email.', 'Escribir un email'],
        ['en', 'Price on request', 'Ask for the price by email.', 'Send an email'],
        ['pt', 'Preço sob consulta', 'Consulte o preço por e-mail.', 'Enviar um e-mail']
    ] as const)('CARD-061 H-1: an email-only experience advertises the email route in %s', (locale, title, note, label) => {
        const price = buildExperienceContactPrice({
            priceFrom: 0,
            priceUnit: null,
            isPriceOnRequest: false
        });
        const action = resolvePriceCardAction({ phoneHref: 'tel:12', email: 'kayak@example.com' });
        const display = getListingPriceCardDisplay({
            price,
            locale,
            byEmail: action.kind === 'email'
        });

        expect(action).toMatchObject({ kind: 'email', href: 'mailto:kayak@example.com' });
        expect('labelKey' in action && createTranslations(locale).t(action.labelKey)).toBe(label);
        expect(display).toEqual({ title, note });
    });

    it('does not offer a CTA if no channel or inquiry flow is usable', () => {
        const input = {
            menuHref: 'bad menu',
            phoneHref: 'tel:12',
            email: 'nobody@example.com?bcc=x'
        };
        const action = resolvePriceCardAction(input);

        expect(action).toEqual({ kind: 'none' });
    });
});
