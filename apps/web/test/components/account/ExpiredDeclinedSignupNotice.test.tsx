/**
 * @file ExpiredDeclinedSignupNotice.test.tsx
 * @description HOS-2193: the restart notice of an expired declined signup, its link and the page
 * wiring that feeds it.
 *
 * @module test/components/account/ExpiredDeclinedSignupNotice
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExpiredDeclinedSignupNotice } from '../../../src/components/account/ExpiredDeclinedSignupNotice';
import { NEUTRAL_PLANS_PATH, plansPathForVertical } from '../../../src/lib/billing/addon-purchase';
import { SUPPORTED_LOCALES } from '../../../src/lib/i18n';

const PAGE = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro'),
    'utf8'
);

describe('ExpiredDeclinedSignupNotice', () => {
    it('renders the title, the body and one link to the given plans page', () => {
        // Arrange
        const href = '/es/planes/comer-y-salir/precios/';
        // Act
        render(
            <ExpiredDeclinedSignupNotice
                locale="es"
                vertical="venue"
                title="No pudimos cobrar tu suscripción"
                body="Tu suscripción al plan Pro (Comer y salir) no se pudo cobrar."
                ctaLabel="Empezar de nuevo"
                href={href}
            />
        );
        // Assert
        const link = screen.getByRole('link', { name: 'Empezar de nuevo' });
        expect(link.getAttribute('href')).toBe(href);
        expect(screen.getByText('No pudimos cobrar tu suscripción')).toBeInTheDocument();
        expect(
            screen.getByText('Tu suscripción al plan Pro (Comer y salir) no se pudo cobrar.')
        ).toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByTestId('expired-declined-signup-venue')).toBeInTheDocument();
    });
});

describe('plansPathForVertical', () => {
    it.each([
        ['accommodation', 'planes/anfitriones/precios'],
        ['venue', 'planes/comer-y-salir/precios'],
        ['experience', 'planes/experiencias/precios'],
        ['tourist', 'planes/turistas/precios'],
        ['partner', NEUTRAL_PLANS_PATH],
        ['toString', NEUTRAL_PLANS_PATH]
    ])('sends %s to %s', (vertical, expected) => {
        expect(plansPathForVertical({ vertical })).toBe(expected);
    });
});

describe('subscription page wiring (HOS-2193)', () => {
    it('mounts one notice per expired declined signup, linked to its vertical plans page', () => {
        expect(PAGE).toContain(
            '(ownSubscriptions?.expiredDeclinedSignups ?? []).map((notice) => ('
        );
        expect(PAGE).toContain('<ExpiredDeclinedSignupNotice');
        expect(PAGE).toContain(
            'href={buildUrl({ locale, path: plansPathForVertical({ vertical: notice.vertical }) })}'
        );
        expect(PAGE).toContain("t('account.subscription.mine.expiredDeclined.cta')");
    });

    it('does not hydrate the notice (the page already reads the owner during SSR)', () => {
        const start = PAGE.indexOf('<ExpiredDeclinedSignupNotice');
        const end = PAGE.indexOf('/>', start);
        expect(PAGE.slice(start, end)).not.toContain('client:');
    });
});

describe('expiredDeclined copy', () => {
    it.each([
        ['es', 'Empezar de nuevo'],
        ['en', 'Start again'],
        ['pt', 'Começar de novo']
    ])('has the %s call to action and placeholders', (locale, cta) => {
        const account = JSON.parse(
            readFileSync(
                resolve(
                    __dirname,
                    '../../../../../packages/i18n/src/locales',
                    locale,
                    'account.json'
                ),
                'utf8'
            )
        ) as {
            subscription: {
                mine: { expiredDeclined: { title: string; body: string; cta: string } };
            };
        };
        const copy = account.subscription.mine.expiredDeclined;
        expect(copy.cta).toBe(cta);
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.body).toContain('{{plan}}');
        expect(copy.body).toContain('{{vertical}}');
    });

    it.each(
        SUPPORTED_LOCALES
    )('has the expiredDeclined keys in the %s account file, for every supported locale', (locale) => {
        const account = JSON.parse(
            readFileSync(
                resolve(
                    __dirname,
                    '../../../../../packages/i18n/src/locales',
                    locale,
                    'account.json'
                ),
                'utf8'
            )
        ) as { subscription: { mine: { expiredDeclined?: Record<string, string> } } };
        expect(Object.keys(account.subscription.mine.expiredDeclined ?? {}).sort()).toEqual([
            'body',
            'cta',
            'title'
        ]);
    });
});
